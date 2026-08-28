import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getAdminOrganizationIds,
  getStaffRoleLabel,
  hasStaffAccess,
} from "../features/staff/staff-domain.mjs";

const [pageSource, clientSource, assignmentFormSource, serverSource, actionsSource, middlewareSource, supabaseMiddlewareSource] = await Promise.all([
  readFile(new URL("../app/staff/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../features/staff/staff-client.jsx", import.meta.url), "utf8"),
  readFile(new URL("../features/staff/staff-assignment-form.jsx", import.meta.url), "utf8"),
  readFile(new URL("../features/staff/staff-server.js", import.meta.url), "utf8"),
  readFile(new URL("../features/staff/staff-actions.js", import.meta.url), "utf8"),
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
  assert.deepEqual(getAdminOrganizationIds([
    { organization_id: "org-a", role: "admin" },
    { organization_id: "org-b", role: "lawyer" },
    { organization_id: "org-a", role: "admin" },
  ]), ["org-a"]);
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

test("only administrators receive the matter assignment workflow", () => {
  assert.match(serverSource, /assignmentOrganizations/);
  assert.match(serverSource, /list_assignable_staff/);
  assert.match(pageSource, /assignmentOrganizations={staffData\.assignmentOrganizations}/);
  assert.match(clientSource, /StaffAssignmentForm/);
  assert.match(assignmentFormSource, /createMatterAssignment/);
  assert.match(assignmentFormSource, /Создать и назначить дело/);
  assert.match(assignmentFormSource, /type="email"/);
});

test("assignment server action authenticates, checks admin membership, and calls the atomic RPC", () => {
  assert.match(actionsSource, /"use server"/);
  assert.match(actionsSource, /auth\.getClaims\(\)/);
  assert.match(actionsSource, /organization_members/);
  assert.match(actionsSource, /\.eq\("role", "admin"\)/);
  assert.match(actionsSource, /\.rpc\("create_matter_for_client_email"/);
  assert.doesNotMatch(actionsSource, /service_role|SUPABASE_SERVICE|clientEmail.*console|console.*clientEmail/);
});
