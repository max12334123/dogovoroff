import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as staffDomain from "../features/staff/staff-domain.mjs";

// Resolve Next's extensionless imports while executing the real server loader in Node.
const serverUrl = new URL("../features/staff/staff-server.js", import.meta.url);
const serverSource = (await readFile(serverUrl, "utf8")).replace(
  /from "(\.[^"]+)"/g,
  (_, path) => `from "${new URL(/\.(?:m?js)$/.test(path) ? path : `${path}.js`, serverUrl).href}"`,
);
const { loadStaffData } = await import(`data:text/javascript;base64,${Buffer.from(serverSource).toString("base64")}`);

const USER = "11111111-1111-4111-8111-111111111111";
const LAWYER = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";
const ORG = "b1111111-1111-4111-8111-111111111111";
const MATTER = "a1111111-1111-4111-8111-111111111111";

test("overview distinguishes a named employee, no assignment, and unavailable data", () => {
  assert.equal(typeof staffDomain.getStaffAssignmentLabel, "function");
  assert.equal(staffDomain.getStaffAssignmentLabel({ assignmentStatus: "assigned", assignedLawyerName: "Сотрудник А" }), "Сотрудник А");
  assert.equal(staffDomain.getStaffAssignmentLabel({ assignmentStatus: "unassigned" }), "Сотрудник не назначен");
  assert.equal(staffDomain.getStaffAssignmentLabel({ assignmentStatus: "unavailable" }), "Данные о назначении временно недоступны");
  assert.equal(staffDomain.getStaffAssignmentLabel({}), "Данные о назначении временно недоступны");
});

function fixture({ role = "admin", ids = [MATTER], assignmentResult } = {}) {
  const calls = [];
  const results = {
    organization_members: { data: role ? [{ organization_id: ORG, role }] : [], error: null },
    organizations: { data: [{ id: ORG, name: "Тестовая организация" }], error: null },
    matters: { data: ids.map((id) => ({
      id, organization_id: ORG, reference: "ТЕСТ", title: "Тестовое дело", summary: "",
      status: "active", created_by: USER, created_at: "2026-09-01T10:00:00Z", updated_at: "2026-09-01T10:00:00Z",
    })), error: null },
  };
  const supabase = {
    calls,
    assignmentResult: assignmentResult ?? { data: [{ matter_id: MATTER, assigned_lawyer_id: LAWYER, assigned_lawyer_name: "Сотрудник А" }], error: null },
    from(table) {
      calls.push({ table });
      const builder = {
        select() { return builder; }, eq() { return builder; }, in() { return builder; },
        order() { return builder; }, limit() { return builder; },
        then(resolve, reject) { return Promise.resolve(results[table] ?? { data: [], error: null }).then(resolve, reject); },
      };
      return builder;
    },
    async rpc(name, args) {
      calls.push({ name, args });
      if (name === "list_assignable_staff" || name === "list_intake_requests") return { data: [], error: null };
      assert.equal(name, "list_staff_matter_assignments");
      return typeof supabase.assignmentResult === "function" ? supabase.assignmentResult(args) : supabase.assignmentResult;
    },
  };
  return supabase;
}

test("staff overview receives the actual responsible employee from the protected read model", async () => {
  const supabase = fixture();
  const { matters } = await loadStaffData(supabase, USER);
  assert.equal(matters[0].assignedLawyerId, LAWYER);
  assert.equal(matters[0].assignedLawyerName, "Сотрудник А");
  assert.equal(matters[0].assignmentStatus, "assigned");
  assert.deepEqual(supabase.calls.find((call) => call.name === "list_staff_matter_assignments").args, { target_matter_ids: [MATTER] });
  assert.equal(supabase.calls.some(({ table }) => table === "profiles" || table === "matter_participants"), false);
});

test("refresh replaces an assignment and then explicitly reports its removal", async () => {
  const supabase = fixture();
  await loadStaffData(supabase, USER);
  supabase.assignmentResult = { data: [{ matter_id: MATTER, assigned_lawyer_id: OTHER, assigned_lawyer_name: "Сотрудник Б" }], error: null };
  const updated = await loadStaffData(supabase, USER);
  assert.equal(updated.matters[0].assignedLawyerId, OTHER);
  assert.equal(updated.matters[0].assignedLawyerName, "Сотрудник Б");
  supabase.assignmentResult = { data: [{ matter_id: MATTER, assigned_lawyer_id: null, assigned_lawyer_name: null }], error: null };
  const removed = await loadStaffData(supabase, USER);
  assert.equal(removed.matters[0].assignmentStatus, "unassigned");
  assert.equal(removed.matters[0].assignedLawyerId, null);
  assert.equal(removed.matters[0].assignedLawyerName, null);
});

test("missing RPC and omitted unauthorized rows remain unavailable rather than unassigned", async () => {
  for (const assignmentResult of [
    { data: null, error: { code: "PGRST202", message: "private provider detail" } },
    { data: [], error: null },
  ]) {
    const { matters } = await loadStaffData(fixture({ assignmentResult }), USER);
    assert.equal(matters[0].assignmentStatus, "unavailable");
    assert.equal(matters[0].assignedLawyerId, null);
    assert.equal(matters[0].assignedLawyerName, null);
    assert.doesNotMatch(JSON.stringify(matters), /private provider detail/);
  }
});

test("assignment errors other than missing function fail without provider-sensitive details", async () => {
  for (const code of ["42501", "PGRST301", "42883"]) {
    await assert.rejects(loadStaffData(fixture({ assignmentResult: { data: null, error: { code, message: "private provider detail" } } }), USER),
      (error) => error.message === `Staff matter assignment query failed: ${code}`);
  }
});

test("lawyers use the protected matter reader without access to the admin staff directory", async () => {
  const supabase = fixture({ role: "lawyer" });
  const { matters, assignmentOrganizations } = await loadStaffData(supabase, USER);
  assert.equal(matters[0].assignedLawyerName, "Сотрудник А");
  assert.deepEqual(assignmentOrganizations, []);
  assert.equal(supabase.calls.some(({ name }) => name === "list_assignable_staff"), false);
});

test("nonstaff and empty workspaces never request assignments", async () => {
  const nonstaff = fixture({ role: null });
  assert.equal(await loadStaffData(nonstaff, USER), null);
  assert.equal(nonstaff.calls.some(({ name }) => name === "list_staff_matter_assignments"), false);
  const empty = fixture({ ids: [] });
  assert.deepEqual((await loadStaffData(empty, USER)).matters, []);
  assert.equal(empty.calls.some(({ name }) => name === "list_staff_matter_assignments"), false);
});

test("large workspaces use bounded batches and never merge unexpected returned matter IDs", async () => {
  const ids = Array.from({ length: 101 }, (_, index) => `a1111111-1111-4111-8111-${String(index).padStart(12, "0")}`);
  const supabase = fixture({ ids, assignmentResult: ({ target_matter_ids }) => ({
    data: [...target_matter_ids.map((id) => ({ matter_id: id, assigned_lawyer_id: null, assigned_lawyer_name: null })),
      { matter_id: "unauthorized", assigned_lawyer_id: OTHER, assigned_lawyer_name: "Не выводить" }], error: null,
  }) });
  const { matters } = await loadStaffData(supabase, USER);
  assert.deepEqual(supabase.calls.filter(({ name }) => name === "list_staff_matter_assignments").map(({ args }) => args.target_matter_ids.length), [100, 1]);
  assert.equal(matters.length, 101);
  assert.equal(matters.every((matter) => matter.assignmentStatus === "unassigned"), true);
  assert.doesNotMatch(JSON.stringify(matters), /Не выводить|unauthorized/);
});
