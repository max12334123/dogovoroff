import assert from "node:assert/strict";
import test from "node:test";

import {
  getAssignmentErrorMessage,
  validateMatterAssignment,
} from "../features/staff/staff-assignment-domain.mjs";

const VALID_INPUT = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  clientEmail: " Client@Example.RU ",
  reference: " D-2026-001 ",
  title: " Проверка договора ",
  summary: "  Краткое описание ситуации.  ",
  lawyerId: "22222222-2222-4222-8222-222222222222",
  stageTitle: " Первичная проверка ",
  stageDetail: " Изучить полученные документы. ",
  nextActionTitle: " Загрузите договор ",
  nextActionDescription: " PDF или DOCX до 10 МБ. ",
};

test("matter assignment validation normalizes a complete admin form", () => {
  const result = validateMatterAssignment(VALID_INPUT);

  assert.equal(result.valid, true);
  assert.deepEqual(result.value, {
    organizationId: VALID_INPUT.organizationId,
    clientEmail: "client@example.ru",
    reference: "D-2026-001",
    title: "Проверка договора",
    summary: "Краткое описание ситуации.",
    lawyerId: VALID_INPUT.lawyerId,
    stageTitle: "Первичная проверка",
    stageDetail: "Изучить полученные документы.",
    nextActionTitle: "Загрузите договор",
    nextActionDescription: "PDF или DOCX до 10 МБ.",
  });
});

test("matter assignment accepts an unassigned lawyer and optional copy", () => {
  const result = validateMatterAssignment({
    ...VALID_INPUT,
    lawyerId: "",
    summary: "",
    stageDetail: "",
    nextActionTitle: "",
    nextActionDescription: "",
  });

  assert.equal(result.valid, true);
  assert.equal(result.value.lawyerId, null);
  assert.equal(result.value.nextActionTitle, null);
  assert.equal(result.value.nextActionDescription, null);
});

test("matter assignment rejects malformed identifiers and email", () => {
  assert.equal(validateMatterAssignment({ ...VALID_INPUT, organizationId: "organization" }).valid, false);
  assert.equal(validateMatterAssignment({ ...VALID_INPUT, lawyerId: "lawyer" }).valid, false);
  assert.equal(validateMatterAssignment({ ...VALID_INPUT, clientEmail: "not-an-email" }).valid, false);
});

test("matter assignment enforces database length and consistency limits", () => {
  assert.equal(validateMatterAssignment({ ...VALID_INPUT, reference: " " }).valid, false);
  assert.equal(validateMatterAssignment({ ...VALID_INPUT, title: "x".repeat(241) }).valid, false);
  assert.equal(validateMatterAssignment({ ...VALID_INPUT, summary: "x".repeat(5001) }).valid, false);
  assert.equal(validateMatterAssignment({ ...VALID_INPUT, stageTitle: "x".repeat(201) }).valid, false);
  assert.equal(validateMatterAssignment({ ...VALID_INPUT, stageDetail: "x".repeat(1001) }).valid, false);
  assert.equal(validateMatterAssignment({ ...VALID_INPUT, nextActionTitle: "", nextActionDescription: "Есть описание" }).valid, false);
});

test("assignment database errors are translated without leaking provider details", () => {
  assert.equal(getAssignmentErrorMessage({ code: "23505" }), "Дело с таким номером уже существует.");
  assert.equal(getAssignmentErrorMessage({ message: "client_not_found" }), "Клиент с таким подтверждённым email не найден.");
  assert.equal(getAssignmentErrorMessage({ message: "lawyer_not_available" }), "Выбранный сотрудник недоступен для этой организации.");
  assert.equal(getAssignmentErrorMessage({ message: "raw database details" }), "Не удалось создать дело. Попробуйте ещё раз.");
});
