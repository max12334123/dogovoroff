import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getWorkflowErrorMessage,
  validateMatterWorkflow,
} from "../features/staff/staff-workflow-domain.mjs";

const MATTER_ID = "a1111111-1111-4111-8111-111111111111";
const STAGE_ID = "a1111111-aaaa-4111-8111-111111111111";
const LAWYER_ID = "33333333-3333-4333-8333-333333333333";

test("workflow validation normalizes editable matter fields", () => {
  const result = validateMatterWorkflow({
    matterId: MATTER_ID,
    status: " active ",
    stageId: STAGE_ID,
    nextActionTitle: "  Загрузить договор ",
    nextActionDescription: "  PDF до 10 МБ. ",
    nextActionDueAt: "2026-09-03",
    assignmentTouched: true,
    assignedLawyerId: LAWYER_ID,
  });

  assert.deepEqual(result, {
    valid: true,
    value: {
      matterId: MATTER_ID,
      status: "active",
      stageId: STAGE_ID,
      nextActionTitle: "Загрузить договор",
      nextActionDescription: "PDF до 10 МБ.",
      nextActionDueAt: "2026-09-03",
      assignmentTouched: true,
      assignedLawyerId: LAWYER_ID,
    },
    error: "",
  });
});

test("completed and archived matters cannot retain a client next action", () => {
  const result = validateMatterWorkflow({
    matterId: MATTER_ID,
    status: "completed",
    stageId: STAGE_ID,
    nextActionTitle: "Загрузить договор",
    nextActionDescription: "Описание",
    nextActionDueAt: "2026-09-03",
  });

  assert.equal(result.valid, true);
  assert.equal(result.value.nextActionTitle, null);
  assert.equal(result.value.nextActionDescription, null);
  assert.equal(result.value.nextActionDueAt, null);
});

test("workflow validation rejects malformed values and keeps assignment optional", () => {
  assert.equal(validateMatterWorkflow({ matterId: MATTER_ID, status: "unknown" }).valid, false);
  assert.equal(validateMatterWorkflow({ matterId: MATTER_ID, status: "active", nextActionDescription: "Без названия" }).valid, false);
  assert.equal(validateMatterWorkflow({ matterId: MATTER_ID, status: "active", nextActionDueAt: "завтра" }).valid, false);

  const result = validateMatterWorkflow({ matterId: MATTER_ID, status: "paused" });
  assert.equal(result.valid, true);
  assert.equal(result.value.assignmentTouched, false);
  assert.equal(result.value.assignedLawyerId, null);

  const dueDateWithoutStep = validateMatterWorkflow({
    matterId: MATTER_ID,
    status: "active",
    nextActionDueAt: "2026-09-03",
  });
  assert.equal(dueDateWithoutStep.value.nextActionDueAt, null);
});

test("workflow error messages do not expose provider details", () => {
  assert.equal(getWorkflowErrorMessage({ code: "42501", message: "private detail" }), "У вас нет прав изменять это дело.");
  assert.equal(getWorkflowErrorMessage({ code: "42501", message: "assignment_requires_admin" }), "Назначать ответственного может только администратор организации.");
  assert.equal(getWorkflowErrorMessage({ message: "stage_not_available" }), "Выбранный этап не относится к этому делу.");
  assert.equal(getWorkflowErrorMessage({ message: "stage_required_for_active" }), "Для активного дела нужен хотя бы один этап.");
  assert.equal(getWorkflowErrorMessage({ message: "unexpected" }), "Не удалось обновить дело. Попробуйте ещё раз.");
});

test("workflow RPC protects organization identity and updates the complete workflow atomically", async () => {
  const source = await readFile(
    new URL("../supabase/migrations/20260829080000_add_matter_workflow_management.sql", import.meta.url),
    "utf8",
  );

  assert.match(source, /prevent_matter_organization_change/);
  assert.match(source, /organization_immutable/);
  assert.match(source, /create or replace function public\.update_matter_workflow/);
  assert.match(source, /security definer/);
  assert.match(source, /set search_path = ''/);
  assert.match(source, /private\.can_manage_matter/);
  assert.match(source, /private\.is_org_admin\(target_organization_id\)/);
  assert.match(source, /if new_status is null/);
  assert.match(source, /stage_required_for_active/);
  assert.match(source, /status = 'current'/);
  assert.match(source, /assignment_requires_admin/);
  assert.match(source, /update public\.matters/);
  assert.match(source, /update public\.matter_stages/);
  assert.match(source, /update_assignment/);
  assert.match(source, /delete from public\.matter_participants/);
  assert.match(source, /grant execute on function public\.update_matter_workflow/);
  assert.doesNotMatch(source, /service_role/i);
});
