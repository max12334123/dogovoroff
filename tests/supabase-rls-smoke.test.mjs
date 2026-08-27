import assert from "node:assert/strict";
import test from "node:test";

import {
  assertVisibleIds,
  getRlsSmokeConfig,
  parseIdList,
} from "../scripts/supabase-rls-smoke.mjs";

test("RLS smoke configuration never accepts incomplete production credentials", () => {
  assert.deepEqual(getRlsSmokeConfig({ SUPABASE_E2E_ENABLED: "false" }), { enabled: false });
  assert.deepEqual(
    getRlsSmokeConfig({
      SUPABASE_E2E_ENABLED: "true",
      NEXT_PUBLIC_SUPABASE_URL: "https://cflfyqupfgjyfbrjfvtq.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    }),
    {
      enabled: true,
      missing: [
        "SUPABASE_E2E_CLIENT_A_TOKEN",
        "SUPABASE_E2E_CLIENT_B_TOKEN",
        "SUPABASE_E2E_LAWYER_TOKEN",
        "SUPABASE_E2E_ADMIN_TOKEN",
        "SUPABASE_E2E_MATTER_A_ID",
        "SUPABASE_E2E_MATTER_B_ID",
        "SUPABASE_E2E_LAWYER_MATTER_IDS",
        "SUPABASE_E2E_ADMIN_MATTER_IDS",
      ],
    },
  );
});

test("RLS smoke configuration normalizes bounded matter id lists", () => {
  assert.deepEqual(
    parseIdList("  matter-a , matter-b,matter-a "),
    ["matter-a", "matter-b"],
  );
  assert.deepEqual(parseIdList(""), []);
  assert.deepEqual(parseIdList(null), []);
});

test("RLS smoke assertions compare sets without exposing row contents", () => {
  assert.equal(assertVisibleIds("client A", "matters", ["a", "a"], ["a"]), true);
  assert.throws(
    () => assertVisibleIds("client A", "matters", ["a", "b"], ["a"]),
    /RLS smoke check failed for client A matters/,
  );
});
