import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  filterStaffAuditEvents,
  filterStaffMatters,
  filterStaffNavigation,
  getAdminOrganizationIds,
  getStaffMatterQueue,
  getStaffRoleLabel,
  hasStaffAccess,
} from "../features/staff/staff-domain.mjs";
import { validateMatterWorkflow } from "../features/staff/staff-workflow-domain.mjs";

const [pageSource, clientSource, assignmentFormSource, detailsFormSource, serverSource, actionsSource, middlewareSource, supabaseMiddlewareSource] = await Promise.all([
  readFile(new URL("../app/staff/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../features/staff/staff-client.jsx", import.meta.url), "utf8"),
  readFile(new URL("../features/staff/staff-assignment-form.jsx", import.meta.url), "utf8"),
  readFile(new URL("../features/staff/staff-matter-details-form.jsx", import.meta.url), "utf8"),
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
  assert.match(clientSource, /updateMatterWorkflow/);
  assert.match(clientSource, /Сохранить рабочий статус/);
  assert.match(clientSource, /Скачать/);
  assert.doesNotMatch(clientSource, /service_role|SUPABASE_SERVICE|localStorage|sessionStorage/);
});

test("only administrators receive the matter metadata editor", () => {
  assert.match(serverSource, /includeOrganizationId: true/);
  assert.match(serverSource, /assignmentOrganizations/);
  assert.match(clientSource, /StaffMatterDetailsForm/);
  assert.match(clientSource, /Редактировать реквизиты/);
  assert.match(clientSource, /canEditDetails/);
  assert.match(actionsSource, /validateMatterDetails/);
  assert.match(actionsSource, /\.rpc\("update_matter_details"/);
  assert.match(detailsFormSource, /role="dialog"/);
  assert.match(detailsFormSource, /aria-modal="true"/);
  assert.match(detailsFormSource, /Сохранить реквизиты/);
  assert.match(detailsFormSource, /MAX_MATTER_SUMMARY_LENGTH/);
  assert.match(detailsFormSource, /responseDueAt/);
});

test("only administrators receive the matter assignment workflow", () => {
  assert.match(serverSource, /assignmentOrganizations/);
  assert.match(serverSource, /list_assignable_staff/);
  assert.match(pageSource, /assignmentOrganizations={staffData\.assignmentOrganizations}/);
  assert.match(clientSource, /StaffAssignmentForm/);
  assert.match(clientSource, /Новое дело/);
  assert.match(assignmentFormSource, /createMatterAssignment/);
  assert.match(assignmentFormSource, /Шаг \$\{step\} из 2/);
  assert.match(assignmentFormSource, /role="dialog"/);
  assert.match(assignmentFormSource, /aria-modal="true"/);
  assert.match(assignmentFormSource, /Номер сформирован автоматически/);
  assert.match(assignmentFormSource, /Создать дело/);
  assert.match(assignmentFormSource, /type="email"/);
});

test("staff dashboard separates team actions, client waiting, and archive without exposing client identity", () => {
  const matters = [
    { reference: "DO-1", title: "Проверка договора", summary: "Поставка", state: "active", nextAction: null },
    { reference: "DO-2", title: "Согласование", summary: "Услуги", state: "active", nextAction: { title: "Загрузить файл" } },
    { reference: "DO-3", title: "Завершённое дело", summary: "Архив", state: "archived", nextAction: null },
    { reference: "DO-4", title: "Приостановленное дело", summary: "Пауза", state: "paused", nextAction: null },
  ];

  assert.equal(getStaffMatterQueue(matters[0]), "action");
  assert.equal(getStaffMatterQueue(matters[1]), "waiting");
  assert.equal(getStaffMatterQueue(matters[2]), "archive");
  assert.equal(getStaffMatterQueue(matters[3]), "paused");
  assert.deepEqual(filterStaffMatters(matters, "поставка", "action"), [matters[0]]);
  assert.deepEqual(filterStaffMatters(matters, "", "waiting"), [matters[1]]);
  assert.deepEqual(filterStaffMatters(matters, "", "archive"), [matters[2]]);
  assert.match(clientSource, /Сегодня в работе/);
  assert.match(clientSource, /Требуют вашего действия/);
  assert.match(clientSource, /Ожидают клиента/);
  assert.match(clientSource, /Приостановлены/);
  assert.match(clientSource, /queueId="paused"/);
  assert.doesNotMatch(serverSource, /auth\.users|client_email/);
});

test("admin audit feed stays technical and follows the matter search", () => {
  const matters = [{
    id: "a1111111-1111-4111-8111-111111111111",
    reference: "DO-1",
    title: "Проверка договора",
    summary: "Поставка",
  }];
  const events = [
    { id: "event-1", matterId: matters[0].id, action: "matter.updated", entityType: "matter" },
    { id: "event-2", matterId: matters[0].id, action: "document.created", entityType: "documents" },
  ];

  assert.deepEqual(filterStaffAuditEvents(events, matters, "проверка"), events);
  assert.deepEqual(filterStaffAuditEvents(events, matters, "неизвестно"), []);
  assert.match(serverSource, /audit_events/);
  assert.match(serverSource, /limit\(80\)/);
  assert.match(pageSource, /initialAuditEvents={staffData\.auditEvents}/);
  assert.match(pageSource, /canViewAudit={staffData\.canViewAudit}/);
  assert.match(clientSource, /Журнал действий/);
  assert.match(clientSource, /canViewAudit/);
  assert.deepEqual(filterStaffNavigation([
    { id: "today" },
    { id: "inbox" },
    { id: "audit" },
  ], { canViewAudit: false, intakeEnabled: false }).map((item) => item.id), ["today"]);
  assert.deepEqual(filterStaffNavigation([
    { id: "today" },
    { id: "inbox" },
    { id: "audit" },
  ], { canViewAudit: true, intakeEnabled: true }).map((item) => item.id), ["today", "inbox", "audit"]);
  assert.match(clientSource, /Тексты сообщений, содержимое документов и email здесь не отображаются/);
  assert.doesNotMatch(clientSource, /actor_id|author_id/);
});

test("staff workflow action validates the payload before calling the protected RPC", () => {
  assert.equal(validateMatterWorkflow({ matterId: "bad", status: "active" }).valid, false);
  assert.match(actionsSource, /validateMatterWorkflow/);
  assert.match(actionsSource, /.rpc\("update_matter_workflow"/);
  assert.match(actionsSource, /revalidatePath\("\/staff"\)/);
});

test("staff workflow draft refreshes when the selected matter data changes", () => {
  assert.match(clientSource, /setWorkflowDraft\(getWorkflowDraft\(matter\)\)/);
  assert.match(clientSource, /\}, \[matter\]\);/);
});

test("staff stages keep stable keys even when fallback fixture titles repeat", () => {
  assert.match(clientSource, /key=\{stage\.id \?\? `\$\{stage\.title\}-\$\{index\}`\}/);
});

test("reopening a matter chooses an available stage instead of leaving an empty current stage", () => {
  assert.match(clientSource, /field === "status" && \(value === "active" \|\| value === "paused"\)/);
  assert.match(clientSource, /stageId: matter\?\.stages\?\.\[0\]\?\.id \?\? ""/);
});

test("assignment server action authenticates, checks admin membership, and calls the atomic RPC", () => {
  assert.match(actionsSource, /"use server"/);
  assert.match(actionsSource, /auth\.getClaims\(\)/);
  assert.match(actionsSource, /organization_members/);
  assert.match(actionsSource, /\.eq\("role", "admin"\)/);
  assert.match(actionsSource, /\.rpc\("create_matter_for_client_email"/);
  assert.doesNotMatch(actionsSource, /service_role|SUPABASE_SERVICE|clientEmail.*console|console.*clientEmail/);
});
