import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-e2e-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// HARDCODED E2E INSTANCE ID - NEVER ACCEPT FROM PARAMETERS
const E2E_INSTANCE_ID = "3ba42fcc-3bd4-4330-99dd-bf0a6a4edbf1";
const E2E_INSTANCE_SLUG = "e2e";

type Scenario = "basic" | "with_reservations" | "with_offers" | "full";

interface ScenarioRequest {
  scenario: Scenario;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Security Layer 1: Verify E2E token
    const e2eToken = req.headers.get("x-e2e-token");
    const expectedToken = Deno.env.get("E2E_SEED_TOKEN");
    
    if (!expectedToken) {
      console.error("[SECURITY] E2E_SEED_TOKEN not configured");
      return new Response(
        JSON.stringify({ error: "E2E infrastructure not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!e2eToken || e2eToken !== expectedToken) {
      console.error("[SECURITY] Invalid or missing E2E token");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: ScenarioRequest = await req.json();
    const scenario = body.scenario || "basic";
    
    if (!["basic", "with_reservations", "with_offers", "full"].includes(scenario)) {
      return new Response(
        JSON.stringify({ error: "Invalid scenario. Use: basic, with_reservations, with_offers, full" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Security Layer 2: Verify E2E instance exists with correct slug
    const { data: instance, error: instanceError } = await supabase
      .from("instances")
      .select("id, slug, name, short_name")
      .eq("id", E2E_INSTANCE_ID)
      .eq("slug", E2E_INSTANCE_SLUG)
      .single();

    if (instanceError || !instance) {
      console.error("[SECURITY] E2E instance verification failed:", instanceError);
      return new Response(
        JSON.stringify({ 
          error: "E2E instance not found or slug mismatch",
          details: "This endpoint only works for the designated E2E test instance"
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[E2E SCENARIO] Loading scenario "${scenario}" for instance: ${instance.name}`);

    const createdData: Record<string, number> = {};

    // Helper to get today and nearby dates
    const today = new Date();
    const formatDate = (date: Date) => date.toISOString().split("T")[0];
    const addDays = (date: Date, days: number) => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    };

    // SCENARIO: basic - stations, categories, services
    // Check if basic data exists, if not create it
    const { data: existingStations } = await supabase
      .from("stations")
      .select("id")
      .eq("instance_id", E2E_INSTANCE_ID);

    if (!existingStations || existingStations.length === 0) {
      // Create stations
      const { data: stations, error: stationsError } = await supabase
        .from("stations")
        .insert([
          { instance_id: E2E_INSTANCE_ID, name: "Stanowisko 1", type: "washing", sort_order: 1, active: true },
          { instance_id: E2E_INSTANCE_ID, name: "Stanowisko 2", type: "washing", sort_order: 2, active: true },
          { instance_id: E2E_INSTANCE_ID, name: "PPF", type: "ppf", sort_order: 3, active: true },
        ])
        .select();

      if (stationsError) {
        console.error("[E2E SCENARIO] Error creating stations:", stationsError);
      } else {
        createdData.stations = stations?.length ?? 0;
      }
    }

    // Get stations for later use
    const { data: allStations } = await supabase
      .from("stations")
      .select("id, name, type")
      .eq("instance_id", E2E_INSTANCE_ID)
      .eq("active", true)
      .order("sort_order");

    const washingStation = allStations?.find(s => s.type === "washing");

    // Check/create service category
    let categoryId: string;
    const { data: existingCategories } = await supabase
      .from("service_categories")
      .select("id")
      .eq("instance_id", E2E_INSTANCE_ID);

    if (!existingCategories || existingCategories.length === 0) {
      const { data: category, error: catError } = await supabase
        .from("service_categories")
        .insert({
          instance_id: E2E_INSTANCE_ID,
          name: "Myjnia",
          slug: "myjnia",
          sort_order: 1,
          active: true
        })
        .select()
        .single();

      if (catError) {
        console.error("[E2E SCENARIO] Error creating category:", catError);
        categoryId = "";
      } else {
        categoryId = category.id;
        createdData.service_categories = 1;
      }
    } else {
      categoryId = existingCategories[0].id;
    }

    // Check/create services
    const { data: existingServices } = await supabase
      .from("services")
      .select("id")
      .eq("instance_id", E2E_INSTANCE_ID);

    if ((!existingServices || existingServices.length === 0) && categoryId) {
      const { data: services, error: servicesError } = await supabase
        .from("services")
        .insert([
          {
            instance_id: E2E_INSTANCE_ID,
            category_id: categoryId,
            name: "Mycie podstawowe",
            shortcut: "MP",
            duration_small: 30,
            duration_medium: 40,
            duration_large: 50,
            price_small: 50,
            price_medium: 70,
            price_large: 90,
            requires_size: true,
            sort_order: 1,
            active: true
          },
          {
            instance_id: E2E_INSTANCE_ID,
            category_id: categoryId,
            name: "Mycie premium",
            shortcut: "MX",
            duration_small: 60,
            duration_medium: 80,
            duration_large: 100,
            price_small: 100,
            price_medium: 130,
            price_large: 160,
            requires_size: true,
            sort_order: 2,
            active: true
          },
          {
            instance_id: E2E_INSTANCE_ID,
            category_id: categoryId,
            name: "Odkurzanie",
            shortcut: "ODK",
            duration_minutes: 20,
            price_from: 30,
            requires_size: false,
            sort_order: 3,
            active: true
          },
        ])
        .select();

      if (servicesError) {
        console.error("[E2E SCENARIO] Error creating services:", servicesError);
      } else {
        createdData.services = services?.length ?? 0;
      }
    }

    // Get services for later use
    const { data: allServices } = await supabase
      .from("services")
      .select("id, name")
      .eq("instance_id", E2E_INSTANCE_ID)
      .eq("active", true);

    const firstService = allServices?.[0];

    // SCENARIO: with_reservations
    if (scenario === "with_reservations" || scenario === "full") {
      // Create test customers first
      const { data: customers, error: custError } = await supabase
        .from("customers")
        .insert([
          {
            instance_id: E2E_INSTANCE_ID,
            name: "Jan Testowy",
            phone: "+48111222333",
            phone_verified: true,
            source: "e2e"
          },
          {
            instance_id: E2E_INSTANCE_ID,
            name: "Anna E2E",
            phone: "+48444555666",
            phone_verified: true,
            source: "e2e"
          },
          {
            instance_id: E2E_INSTANCE_ID,
            name: "Piotr Mock",
            phone: "+48777888999",
            phone_verified: false,
            source: "e2e"
          },
        ])
        .select();

      if (custError) {
        console.error("[E2E SCENARIO] Error creating customers:", custError);
      } else {
        createdData.customers = customers?.length ?? 0;
      }

      // Create customer vehicles
      if (customers && customers.length > 0) {
        const { data: vehicles, error: vehError } = await supabase
          .from("customer_vehicles")
          .insert([
            {
              instance_id: E2E_INSTANCE_ID,
              customer_id: customers[0].id,
              phone: customers[0].phone,
              model: "BMW X5",
              plate: "WE 12345",
              car_size: "large"
            },
            {
              instance_id: E2E_INSTANCE_ID,
              customer_id: customers[1].id,
              phone: customers[1].phone,
              model: "Audi A4",
              plate: "WA 99999",
              car_size: "medium"
            },
            {
              instance_id: E2E_INSTANCE_ID,
              customer_id: customers[2].id,
              phone: customers[2].phone,
              model: "VW Polo",
              plate: "WX 55555",
              car_size: "small"
            },
          ])
          .select();

        if (vehError) {
          console.error("[E2E SCENARIO] Error creating vehicles:", vehError);
        } else {
          createdData.customer_vehicles = vehicles?.length ?? 0;
        }
      }

      // Create reservations with various statuses
      if (washingStation && firstService) {
        const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();
        
        const reservations = [
          // Today's reservations
          {
            instance_id: E2E_INSTANCE_ID,
            reservation_date: formatDate(today),
            start_time: "09:00",
            end_time: "10:00",
            customer_name: "Jan Testowy",
            customer_phone: "+48111222333",
            vehicle_plate: "WE 12345",
            car_size: "large",
            service_id: firstService.id,
            station_id: washingStation.id,
            status: "confirmed",
            confirmation_code: generateCode()
          },
          {
            instance_id: E2E_INSTANCE_ID,
            reservation_date: formatDate(today),
            start_time: "10:30",
            end_time: "11:30",
            customer_name: "Anna E2E",
            customer_phone: "+48444555666",
            vehicle_plate: "WA 99999",
            car_size: "medium",
            service_id: firstService.id,
            station_id: washingStation.id,
            status: "pending",
            confirmation_code: generateCode()
          },
          {
            instance_id: E2E_INSTANCE_ID,
            reservation_date: formatDate(today),
            start_time: "14:00",
            end_time: "15:00",
            customer_name: "Piotr Mock",
            customer_phone: "+48777888999",
            vehicle_plate: "WX 55555",
            car_size: "small",
            service_id: firstService.id,
            station_id: washingStation.id,
            status: "in_progress",
            confirmation_code: generateCode()
          },
          // Tomorrow's reservations
          {
            instance_id: E2E_INSTANCE_ID,
            reservation_date: formatDate(addDays(today, 1)),
            start_time: "09:00",
            end_time: "10:30",
            customer_name: "Tomek Jutro",
            customer_phone: "+48123123123",
            vehicle_plate: "KR ABC12",
            car_size: "medium",
            service_id: firstService.id,
            station_id: washingStation.id,
            status: "confirmed",
            confirmation_code: generateCode()
          },
          // Yesterday (completed)
          {
            instance_id: E2E_INSTANCE_ID,
            reservation_date: formatDate(addDays(today, -1)),
            start_time: "11:00",
            end_time: "12:00",
            customer_name: "Marek Wczoraj",
            customer_phone: "+48321321321",
            vehicle_plate: "PO XYZ99",
            car_size: "large",
            service_id: firstService.id,
            station_id: washingStation.id,
            status: "completed",
            completed_at: addDays(today, -1).toISOString(),
            confirmation_code: generateCode()
          },
          // Cancelled reservation
          {
            instance_id: E2E_INSTANCE_ID,
            reservation_date: formatDate(addDays(today, 2)),
            start_time: "10:00",
            end_time: "11:00",
            customer_name: "Ania Anulowana",
            customer_phone: "+48999888777",
            vehicle_plate: "GD TEST1",
            car_size: "small",
            service_id: firstService.id,
            station_id: washingStation.id,
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            confirmation_code: generateCode()
          },
        ];

        const { data: resData, error: resError } = await supabase
          .from("reservations")
          .insert(reservations)
          .select();

        if (resError) {
          console.error("[E2E SCENARIO] Error creating reservations:", resError);
        } else {
          createdData.reservations = resData?.length ?? 0;
        }
      }
    }

    // SCENARIO: with_offers
    if (scenario === "with_offers" || scenario === "full") {
      // Create basic offers
      const { data: offers, error: offersError } = await supabase
        .from("offers")
        .insert([
          {
            instance_id: E2E_INSTANCE_ID,
            offer_number: "E2E-001",
            status: "draft",
            customer_data: { name: "Klient Draft", phone: "+48111000111", email: "draft@test.pl" },
            vehicle_data: { brand: "BMW", model: "X5", plate: "WE DRAFT" },
            total_net: 1000,
            total_gross: 1230,
            vat_rate: 23
          },
          {
            instance_id: E2E_INSTANCE_ID,
            offer_number: "E2E-002",
            status: "sent",
            sent_at: new Date().toISOString(),
            customer_data: { name: "Klient Wysłany", phone: "+48222000222", email: "sent@test.pl" },
            vehicle_data: { brand: "Audi", model: "A6", plate: "WA SENT" },
            total_net: 2500,
            total_gross: 3075,
            vat_rate: 23
          },
          {
            instance_id: E2E_INSTANCE_ID,
            offer_number: "E2E-003",
            status: "completed",
            sent_at: addDays(today, -7).toISOString(),
            approved_at: addDays(today, -5).toISOString(),
            completed_at: addDays(today, -1).toISOString(),
            customer_data: { name: "Klient Zrealizowany", phone: "+48333000333", email: "done@test.pl" },
            vehicle_data: { brand: "Mercedes", model: "C300", plate: "PO DONE" },
            total_net: 5000,
            total_gross: 6150,
            vat_rate: 23
          },
        ])
        .select();

      if (offersError) {
        console.error("[E2E SCENARIO] Error creating offers:", offersError);
      } else {
        createdData.offers = offers?.length ?? 0;
      }
    }

    // SCENARIO: full - add yard vehicles and hall
    if (scenario === "full") {
      // Yard vehicles
      const { data: yardData, error: yardError } = await supabase
        .from("yard_vehicles")
        .insert([
          {
            instance_id: E2E_INSTANCE_ID,
            customer_name: "Klient Plac 1",
            customer_phone: "+48500500500",
            vehicle_plate: "WE YARD1",
            car_size: "medium",
            arrival_date: formatDate(today),
            status: "waiting",
            notes: "Czeka na mycie premium"
          },
          {
            instance_id: E2E_INSTANCE_ID,
            customer_name: "Klient Plac 2",
            customer_phone: "+48600600600",
            vehicle_plate: "KR YARD2",
            car_size: "large",
            arrival_date: formatDate(addDays(today, -1)),
            deadline_time: "14:00",
            status: "waiting",
            notes: "Pilne - odbiór do 14:00"
          },
        ])
        .select();

      if (yardError) {
        console.error("[E2E SCENARIO] Error creating yard vehicles:", yardError);
      } else {
        createdData.yard_vehicles = yardData?.length ?? 0;
      }

      // Create a hall
      if (allStations && allStations.length > 0) {
        const { data: hallData, error: hallError } = await supabase
          .from("halls")
          .insert({
            instance_id: E2E_INSTANCE_ID,
            name: "Hala Testowa",
            slug: "hala-test",
            station_ids: allStations.slice(0, 2).map(s => s.id),
            visible_fields: { customer_name: true, customer_phone: false, admin_notes: false },
            allowed_actions: { edit: true, delete: false, add_services: true },
            active: true,
            sort_order: 1
          })
          .select();

        if (hallError) {
          console.error("[E2E SCENARIO] Error creating hall:", hallError);
        } else {
          createdData.halls = hallData?.length ?? 0;
        }
      }
    }

    console.log(`[E2E SCENARIO] Scenario "${scenario}" loaded successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        scenario,
        instance: {
          id: E2E_INSTANCE_ID,
          slug: E2E_INSTANCE_SLUG,
          name: instance.name
        },
        createdData,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[E2E SCENARIO] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
