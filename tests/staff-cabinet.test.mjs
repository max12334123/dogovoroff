import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getStaffRoleLabel, hasStaffAccess } from "../features/staff/staff-domain.mjs";

const [pageSource, clientSource, serverSource, middlewareSource, supabaseMiddlewareSource] = await Promise.all([
  readFile(new URL("../app/staff/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../features/staff/staff-client.jsx", import.meta.url), "utf8"),
  readFile(new URL("../features/staff/staff-server.js", import.meta.url), "utf8"),
  readFile(new URL("../middleware.js", import.meta.url), "utf8"),
  readFile(new URL("../lib/supabase/middleware.js", import.meta.url), "utf8"),
]);

test("staff access is limited to organization lawyers and administrators", () => {
  assert.equal(hasStaffAccess([]), false);
  assert.equal(hasStaffAccess([{ role: "client" }]), false);
  assert.equal(hasStaffAccess([{ role: "lawyer" }]), true);
  assert.equal(hasStaffAccess([{ role: "admin" }]), true);
  assert.equal(getStaffRoleLabel([{ role: "lawyer" }]), "Юрист");
  assert.equal(getStaffRoleLabel([{ role: "lawyer" }, { role: "admin" }]), "Администратор");
  assert.equal(getStaffRoleLabel([{ role: "client" }]), "");
});

test("staff route verifies claims and membership before loading matters", () => {
  assert.match(pageSource, /auth\.getClaims\(\)/);
  assert.match(pageSource, /loadStaffData/);
  assert.match(middlewareSource, /\/staff\/:path\*/);
  assert.match(supabaseMiddlewareSource, /startsWith\("\/staff"\)/);
  assert.match(serverSource, /organization_members/);
  assert.match(serverSource, /hasStaffAccess/);
  assert.match(serverSource, /export async function loadStaffData/);
});

test("staff UI can respond by matter without exposing privileged credentials", () => {
  assert.match(clientSource, /sendMatterMessage/);
  assert.match(clientSource, /Сообщение клиенту/);
  assert.match(clientSource, /role="status"/);
  assert.doesNotMatch(clientSource, /service_role|SUPABASE_SERVICE|localStorage|sessionStorage/);
});
