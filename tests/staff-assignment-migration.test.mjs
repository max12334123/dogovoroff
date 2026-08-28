import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationSource = await readFile(
  new URL("../supabase/migrations/20260827153000_add_admin_matter_assignment.sql", import.meta.url),
  "utf8",
);

test("assignment RPC is atomic and restricted to authenticated administrators", () => {
  assert.match(migrationSource, /create or replace function public\.create_matter_for_client_email/);
  assert.match(migrationSource, /security definer/);
  assert.match(migrationSource, /set search_path = ''/);
  assert.match(migrationSource, /auth\.uid\(\)/);
  assert.match(migrationSource, /om\.role = 'admin'/);
  assert.match(migrationSource, /revoke all on function public\.create_matter_for_client_email[\s\S]*from public/);
  assert.match(migrationSource, /grant execute on function public\.create_matter_for_client_email[\s\S]*to authenticated/);
});

test("assignment RPC accepts only a confirmed exact email and creates the complete case", () => {
  assert.match(migrationSource, /lower\(btrim\(coalesce\(target_client_email, ''\)\)\)/);
  assert.match(migrationSource, /lower\(au\.email\) = normalized_email/);
  assert.match(migrationSource, /au\.email_confirmed_at is not null/);
  assert.match(migrationSource, /insert into public\.matters/);
  assert.match(migrationSource, /insert into public\.matter_participants/);
  assert.match(migrationSource, /'client'::public\.matter_participant_role/);
  assert.match(migrationSource, /'lawyer'::public\.matter_participant_role/);
  assert.match(migrationSource, /insert into public\.matter_stages/);
});

test("staff directory RPC is admin-only and returns no email addresses", () => {
  assert.match(migrationSource, /create or replace function public\.list_assignable_staff/);
  assert.match(migrationSource, /returns table \(\s*user_id uuid,\s*display_name text,\s*member_role public\.organization_role\s*\)/);
  assert.doesNotMatch(migrationSource, /returns table \([^)]*email/i);
  assert.match(migrationSource, /revoke all on function public\.list_assignable_staff[\s\S]*from public/);
  assert.match(migrationSource, /grant execute on function public\.list_assignable_staff[\s\S]*to authenticated/);
});
