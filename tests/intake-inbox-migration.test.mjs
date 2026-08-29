import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationSource = await readFile(
  new URL("../supabase/migrations/20260829102331_add_intake_inbox.sql", import.meta.url),
  "utf8",
);

test("intake inbox migration isolates contact data behind explicit RPC boundaries", () => {
  assert.match(migrationSource, /alter table public\.intake_requests enable row level security;/);
  assert.match(migrationSource, /alter table public\.intake_requests force row level security;/);
  assert.match(
    migrationSource,
    /revoke all on table public\.intake_requests from public, anon, authenticated;/,
  );
  assert.match(migrationSource, /security invoker[\s\S]*store_intake_request|store_intake_request[\s\S]*security invoker/);
  assert.match(
    migrationSource,
    /revoke all on function public\.store_intake_request\([\s\S]*from public, anon, authenticated, service_role;/,
  );
  assert.match(
    migrationSource,
    /grant execute on function public\.store_intake_request\([\s\S]*to service_role;/,
  );
  assert.match(migrationSource, /on conflict \(organization_id, submission_id\) do nothing/);
});

test("intake inbox migration checks organization membership before staff access", () => {
  assert.match(migrationSource, /create or replace function public\.list_intake_requests/);
  assert.match(migrationSource, /create or replace function public\.update_intake_request_status/);
  assert.match(migrationSource, /create or replace function public\.create_matter_from_intake_request/);
  assert.match(migrationSource, /actor_id uuid := \(select auth\.uid\(\)\)/);
  assert.match(migrationSource, /member\.role in \('admin', 'lawyer'\)/);
  assert.match(migrationSource, /request_organization_id <> target_organization_id/);
  assert.match(migrationSource, /from public\.intake_requests as intake[\s\S]*for update;/);
  assert.match(migrationSource, /from public\.create_matter_for_client_email\(/);
  assert.doesNotMatch(migrationSource, /delete from public\.intake_requests/i);
});

test("intake inbox migration indexes every foreign-key access path", () => {
  assert.match(
    migrationSource,
    /create index intake_requests_organization_status_submitted_idx[\s\S]*\(organization_id, status, submitted_at desc\)/,
  );
  assert.match(
    migrationSource,
    /create unique index intake_requests_matter_id_unique_idx[\s\S]*\(matter_id\)/,
  );
  assert.match(
    migrationSource,
    /create index intake_requests_handled_by_idx[\s\S]*\(handled_by\)/,
  );
});
