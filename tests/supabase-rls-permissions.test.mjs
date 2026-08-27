import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const migrationsDirectory = new URL("../supabase/migrations/", import.meta.url);

test("authenticated users can execute only the private predicates required by RLS", async () => {
  const migrationFiles = await readdir(migrationsDirectory);
  const migrationName = migrationFiles.find((name) => name.endsWith("_grant_authenticated_rls_helper_execution.sql"));

  assert.ok(migrationName, "A forward migration for RLS helper permissions must exist");

  const source = await readFile(new URL(migrationName, migrationsDirectory), "utf8");
  const grantedFunctions = [...source.matchAll(
    /grant execute on function private\.([a-z_]+\((?:uuid|text)\)) to authenticated;/g,
  )].map((match) => match[1]);

  assert.match(source, /grant usage on schema private to authenticated;/);
  assert.deepEqual(grantedFunctions, [
    "is_org_admin(uuid)",
    "can_access_organization(uuid)",
    "can_access_matter(uuid)",
    "can_manage_matter(uuid)",
    "can_access_matter_text(text)",
  ]);
  assert.doesNotMatch(source, /grant execute on function private\.(?:set_updated_at|record_matter_audit|record_child_insert_audit)/);
  assert.doesNotMatch(source, /grant (?:usage|execute)[^;]+ to (?:public|anon);/);
  assert.doesNotMatch(source, /\b(?:drop|truncate|delete)\b/i);
});
