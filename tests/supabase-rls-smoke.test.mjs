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

test("intake inbox SQL smoke suite is transactional and covers the server boundary", async () => {
  const source = await readFile(
    new URL("../supabase/tests/intake-inbox-smoke.sql", import.meta.url),
    "utf8",
  );

  assert.match(source, /^begin;/m);
  assert.match(source, /^rollback;/m);
  assert.doesNotMatch(source, /^commit;/m);
  assert.match(source, /set local role service_role;/i);
  assert.match(source, /anonymous:store-denied/);
  assert.match(source, /client:list-denied/);
  assert.match(source, /lawyer:update-status/);
  assert.match(source, /admin:convert-new/);
  assert.match(source, /admin:convert-closed-denied/);
  assert.match(source, /database:request-linked/);
  assert.match(source, /persistent_rows', 0/);
});

test("document request SQL smoke is transactional and covers role transitions", async () => {
  const source = await readFile(
    new URL("../supabase/tests/document-requests-smoke.sql", import.meta.url),
    "utf8",
  );
  assert.match(source, /^begin;/m);
  assert.match(source, /^rollback;/m);
  assert.doesNotMatch(source, /^commit;/m);
  assert.match(source, /client_a:read-own/);
  assert.match(source, /client_a:read-client_b-denied/);
  assert.match(source, /client_b:register-client_a-denied/);
  assert.match(source, /lawyer:create/);
  assert.match(source, /client_a:submit/);
  assert.match(source, /lawyer:return-with-note/);
  assert.match(source, /admin:accept/);
  assert.match(source, /client_a:direct-write-denied/);
  assert.match(source, /database:documents-ready/);
  assert.match(source, /database:events-generic/);
  assert.match(
    source,
    /'client_a:submit-empty-denied'[\s\S]*?where label = 'A'\)\)::int, 0\);/,
  );
  assert.match(source, /create temporary table document_request_sensitive_values/);
  assert.match(
    source,
    /insert into pg_temp\.document_request_sensitive_values[\s\S]*'Synthetic request A'[\s\S]*'Synthetic review note'[\s\S]*'synthetic-first\.pdf'/,
  );
  assert.match(source, /database:events-generic[\s\S]*document_request_sensitive_values/);
  assert.match(source, /create temporary table document_request_event_baseline/);
  assert.match(source, /create temporary table document_request_audit_baseline/);
  assert.match(source, /create temporary table document_request_created_event_ids/);
  assert.match(source, /create temporary table document_request_created_audit_ids/);
  assert.match(source, /insert into pg_temp\.document_request_event_baseline[\s\S]*public\.matter_events/);
  assert.match(source, /insert into pg_temp\.document_request_audit_baseline[\s\S]*public\.audit_events/);
  assert.match(
    source,
    /database:events-generic[\s\S]*document_request_created_event_ids[\s\S]*document_request_sensitive_values/,
  );
  assert.match(
    source,
    /document_request_created_audit_ids[\s\S]*Document request smoke failed: audit text exposure/,
  );
  assert.match(source, /Document request smoke failed: missing request events/);
  assert.match(source, /Document request smoke failed: missing request audits/);
  assert.match(source, /rollback;[\s\S]*'persistent_rows'/);
  assert.match(source, /document_requests[\s\S]*storage\.objects/);
  assert.doesNotMatch(source, /service_role|@|real client/i);

  const runnerSource = await readFile(
    new URL("../scripts/supabase-rls-smoke.mjs", import.meta.url),
    "utf8",
  );
  assert.match(
    runnerSource,
    /\{ table: "document_requests", idColumn: "matter_id", select: "matter_id" \}/,
  );
});
