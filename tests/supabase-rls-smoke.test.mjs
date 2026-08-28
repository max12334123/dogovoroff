import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("isolated SQL smoke suite is transactional and covers read and write boundaries", async () => {
  const source = await readFile(
    new URL("../supabase/tests/rls-isolation-smoke.sql", import.meta.url),
    "utf8",
  );

  assert.match(source, /^begin;/m);
  assert.match(source, /^rollback;/m);
  assert.doesNotMatch(source, /^commit;/m);
  assert.match(source, /set local role authenticated;/i);
  assert.match(source, /set local role anon;/i);
  assert.match(source, /request\.jwt\.claim\.sub/);
  assert.match(source, /client_a:matters/);
  assert.match(source, /client_b:matters/);
  assert.match(source, /lawyer:matters/);
  assert.match(source, /admin:matters/);
  assert.match(source, /anonymous:matters/);
  assert.match(source, /try_insert_message/);
  assert.match(source, /try_insert_document/);
  assert.match(source, /RLS isolation check failed/);
  assert.doesNotMatch(source, /service_role|@|email/i);
});

test("staff assignment SQL smoke suite is transactional and covers every role", async () => {
  const source = await readFile(
    new URL("../supabase/tests/staff-assignment-smoke.sql", import.meta.url),
    "utf8",
  );

  assert.match(source, /^begin;/m);
  assert.match(source, /^rollback;/m);
  assert.doesNotMatch(source, /^commit;/m);
  assert.match(source, /client:create-denied/);
  assert.match(source, /lawyer:create-denied/);
  assert.match(source, /anonymous:create-denied/);
  assert.match(source, /admin:create-complete/);
  assert.match(source, /admin:unconfirmed-client-denied/);
  assert.match(source, /admin:other-org-denied/);
  assert.match(source, /database:two-participants/);
  assert.match(source, /assigned-client:matter-visible/);
  assert.match(source, /assigned-lawyer:matter-visible/);
  assert.match(source, /persistent_rows', 0/);
  assert.doesNotMatch(source, /service_role/i);
});
