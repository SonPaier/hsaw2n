import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BUCKETS = [
  "instance-logos",
  "protocol-photos",
  "reservation-photos",
  "employee-photos",
  "service-photos",
  "price-lists",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: only service_role or super_admin
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let isAuthorized = token === serviceRoleKey;
    if (!isAuthorized && authHeader?.startsWith("Bearer ")) {
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabaseUser.auth.getUser();
      if (user) {
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          serviceRoleKey
        );
        const { data: roles } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        isAuthorized = roles?.some((r) => r.role === "super_admin") || false;
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const dryRun = body.dry_run ?? true;
    const bucketFilter: string | undefined = body.bucket; // optional: migrate single bucket
    const batchLimit = body.batch_limit ?? 200; // max files per bucket per run

    const source = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);
    const targetUrl = Deno.env.get("TARGET_SUPABASE_URL")!;
    const targetKey = Deno.env.get("TARGET_SUPABASE_SERVICE_ROLE_KEY")!;
    const target = createClient(targetUrl, targetKey);

    const log: string[] = [];
    const errors: string[] = [];
    let totalFiles = 0;
    let totalMigrated = 0;
    let totalSkipped = 0;

    const bucketsToMigrate = bucketFilter
      ? BUCKETS.filter((b) => b === bucketFilter)
      : BUCKETS;

    // Recursive list all files in a bucket
    const listAllFiles = async (
      bucket: string,
      prefix = "",
      limit = 1000
    ): Promise<string[]> => {
      const paths: string[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await source.storage
          .from(bucket)
          .list(prefix, { limit, offset, sortBy: { column: "name", order: "asc" } });

        if (error) {
          errors.push(`${bucket}/${prefix}: list error - ${error.message}`);
          return paths;
        }

        if (!data || data.length === 0) {
          hasMore = false;
          break;
        }

        for (const item of data) {
          const fullPath = prefix ? `${prefix}/${item.name}` : item.name;

          if (item.id === null) {
            // It's a folder, recurse
            const subPaths = await listAllFiles(bucket, fullPath, limit);
            paths.push(...subPaths);
          } else {
            paths.push(fullPath);
          }
        }

        offset += data.length;
        if (data.length < limit) hasMore = false;
      }

      return paths;
    };

    for (const bucket of bucketsToMigrate) {
      log.push(`--- Bucket: ${bucket} ---`);

      const files = await listAllFiles(bucket);
      totalFiles += files.length;
      log.push(`${bucket}: ${files.length} plików znalezionych`);

      if (dryRun) {
        if (files.length > 0) {
          log.push(`${bucket}: przykład: ${files.slice(0, 3).join(", ")}`);
        }
        continue;
      }

      let migrated = 0;
      let skipped = 0;

      for (const filePath of files) {
        // Stop when we've uploaded enough in this run
        if (migrated >= batchLimit) {
          log.push(`${bucket}: osiągnięto limit batcha (${batchLimit}), uruchom ponownie`);
          break;
        }

        try {
          // Check if file already exists on target
          const dir = filePath.includes("/") ? filePath.substring(0, filePath.lastIndexOf("/")) : "";
          const fileName = filePath.includes("/") ? filePath.substring(filePath.lastIndexOf("/") + 1) : filePath;

          const { data: existingList } = await target.storage
            .from(bucket)
            .list(dir, { limit: 1, search: fileName });

          if (existingList && existingList.some((f) => f.name === fileName && f.id !== null)) {
            skipped++;
            continue;
          }

          // Download from source
          const { data: fileData, error: downloadError } = await source.storage
            .from(bucket)
            .download(filePath);

          if (downloadError || !fileData) {
            errors.push(`${bucket}/${filePath}: download error - ${downloadError?.message}`);
            continue;
          }

          // Upload to target
          const { error: uploadError } = await target.storage
            .from(bucket)
            .upload(filePath, fileData, {
              upsert: false,
              contentType: fileData.type || "application/octet-stream",
            });

          if (uploadError) {
            if (uploadError.message?.includes("already exists") || uploadError.message?.includes("Duplicate")) {
              skipped++;
            } else {
              errors.push(`${bucket}/${filePath}: upload error - ${uploadError.message}`);
            }
          } else {
            migrated++;
          }
        } catch (e) {
          errors.push(`${bucket}/${filePath}: ${String(e)}`);
        }
      }

      totalMigrated += migrated;
      totalSkipped += skipped;
      log.push(`${bucket}: ${migrated} przesłanych, ${skipped} pominiętych (już istnieją)`);
    }

    return new Response(
      JSON.stringify(
        {
          success: true,
          dry_run: dryRun,
          total_files: totalFiles,
          total_migrated: totalMigrated,
          total_skipped: totalSkipped,
          log,
          errors,
        },
        null,
        2
      ),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err), stack: (err as Error)?.stack }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
