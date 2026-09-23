import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const expandName = "20260923110423_add_ordinary_document_registration_rpc.sql";
const contractName = "20260923110424_secure_ordinary_document_registration.sql";
const migrationText = (name) => readFileSync(
  new URL(`../supabase/migrations/${name}`, import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");

test("ordinary document registration expands before revoking legacy INSERT", () => {
  const expand = migrationText(expandName);
  const contract = migrationText(contractName);
  const functionStart = "create or replace function private.register_matter_document(";
  const contractBoundary = "revoke insert on table public.documents";

  assert.ok(expandName < contractName, "the additive migration must sort first");
  assert.ok(expand.includes(functionStart));
  assert.ok(contract.includes(contractBoundary));
  assert.equal(
    expand.slice(expand.indexOf(functionStart)).trim(),
    contract.slice(contract.indexOf(functionStart), contract.indexOf(contractBoundary)).trim(),
    "the expand and contract stages must expose the same guarded RPC",
  );
  assert.doesNotMatch(expand, /\brevoke\s+insert\b|\bdrop\s+policy\b/i);
  assert.match(contract, /revoke insert on table public\.documents from public, anon, authenticated;/i);
});
