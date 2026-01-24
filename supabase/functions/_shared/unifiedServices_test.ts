import "jsr:@std/dotenv/load";
import { assertEquals, assertExists } from "jsr:@std/assert";

// ============================================================================
// USS - Unified Services / Categories Database Tests
// These tests verify the unified_services and unified_categories schema
// by calling the test-unified-services edge function
// ============================================================================

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const E2E_SEED_TOKEN = Deno.env.get("E2E_SEED_TOKEN") || "";

Deno.test("USS-SUITE: Run unified services integration tests", async () => {
  // Skip if no E2E token configured
  if (!E2E_SEED_TOKEN) {
    console.log("⚠️  Skipping USS tests - E2E_SEED_TOKEN not configured");
    return;
  }

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/test-unified-services`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "x-e2e-token": E2E_SEED_TOKEN,
      },
      body: JSON.stringify({}),
    }
  );
  
  const body = await response.text();
  
  assertEquals(response.status, 200, `Expected 200, got ${response.status}: ${body}`);
  
  const result = JSON.parse(body);
  
  assertExists(result.summary, "Missing summary in response");
  
  console.log("\n📊 Test Results:");
  console.log(`   Total: ${result.summary.total}`);
  console.log(`   Passed: ${result.summary.passed}`);
  console.log(`   Failed: ${result.summary.failed}`);
  console.log(`   Status: ${result.summary.status}\n`);
  
  // Log failed tests
  if (result.results) {
    const failed = result.results.filter((r: { passed: boolean }) => !r.passed);
    if (failed.length > 0) {
      console.log("❌ Failed tests:");
      for (const test of failed) {
        console.log(`   - ${test.name}: ${test.error}`);
      }
    }
  }
  
  assertEquals(result.summary.failed, 0, `${result.summary.failed} tests failed`);
});
