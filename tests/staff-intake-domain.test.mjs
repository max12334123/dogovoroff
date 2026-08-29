import assert from "node:assert/strict";
import test from "node:test";

let subject = {};
try {
  subject = await import("../features/staff/staff-intake-domain.mjs");
} catch {
  subject = {};
}

const REQUESTS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    status: "new",
    name: "Анна Петрова",
    phone: "+7 912 345-67-89",
    service: "Арбитраж и суды",
    message: "Нужно подготовить иск",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    status: "contacted",
    name: "Иван",
    phone: "+7 922 000-00-00",
    service: "Договоры и претензии",
    message: "Проверить поставку",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    status: "matter_created",
    name: "Мария",
    phone: "+7 933 000-00-00",
    service: "ЖКХ",
    message: "Готовое дело",
  },
];

test("staff inbox filtering separates open, completed, and searched requests", () => {
  assert.equal(typeof subject.filterStaffIntakeRequests, "function", "staff inbox filtering is not implemented");

  assert.deepEqual(subject.filterStaffIntakeRequests(REQUESTS, "", "open"), REQUESTS.slice(0, 2));
  assert.deepEqual(subject.filterStaffIntakeRequests(REQUESTS, "", "completed"), [REQUESTS[2]]);
  assert.deepEqual(subject.filterStaffIntakeRequests(REQUESTS, "поставку", "all"), [REQUESTS[1]]);
  assert.deepEqual(subject.filterStaffIntakeRequests(REQUESTS, "+7 912", "all"), [REQUESTS[0]]);
});

test("staff inbox status update accepts only mutable statuses and UUID request IDs", () => {
  assert.equal(typeof subject.validateIntakeStatusUpdate, "function", "staff inbox status validation is not implemented");

  assert.deepEqual(subject.validateIntakeStatusUpdate({
    requestId: "11111111-1111-4111-8111-111111111111",
    status: "reviewing",
  }), {
    valid: true,
    value: {
      requestId: "11111111-1111-4111-8111-111111111111",
      status: "reviewing",
    },
  });
  assert.equal(subject.validateIntakeStatusUpdate({ requestId: "bad", status: "reviewing" }).valid, false);
  assert.equal(subject.validateIntakeStatusUpdate({
    requestId: "11111111-1111-4111-8111-111111111111",
    status: "matter_created",
  }).valid, false);
});

test("staff inbox builds safe matter defaults without exposing the internal precheck excerpt", () => {
  assert.equal(typeof subject.getIntakeAssignmentDefaults, "function", "intake assignment defaults are not implemented");

  const defaults = subject.getIntakeAssignmentDefaults({
    ...REQUESTS[0],
    precheckExcerpt: "Внутренний черновик для юриста",
  });
  assert.deepEqual(defaults, {
    organizationId: REQUESTS[0].organizationId,
    title: "Обращение: Арбитраж и суды",
    summary: "Нужно подготовить иск",
    stageTitle: "Первичная проверка",
    stageDetail: "",
    nextActionTitle: "",
    nextActionDescription: "",
  });
  assert.doesNotMatch(JSON.stringify(defaults), /Внутренний черновик/);
});

test("staff inbox translates database errors without exposing provider details", () => {
  assert.equal(typeof subject.getIntakeErrorMessage, "function", "staff inbox error mapping is not implemented");
  assert.equal(subject.getIntakeErrorMessage({ message: "intake_request_not_found" }), "Заявка не найдена или уже недоступна.");
  assert.equal(subject.getIntakeErrorMessage({ message: "intake_already_converted" }), "По этой заявке дело уже создано.");
  assert.equal(subject.getIntakeErrorMessage({ message: "intake_request_closed" }), "Сначала верните заявку в работу.");
  assert.equal(subject.getIntakeErrorMessage({ message: "private database details" }), "Не удалось обновить заявку. Попробуйте ещё раз.");
});

test("staff inbox maps only the bounded RPC fields used by the interface", () => {
  assert.equal(typeof subject.mapIntakeRequestRows, "function", "staff inbox RPC mapping is not implemented");

  const result = subject.mapIntakeRequestRows([{
    id: "11111111-1111-4111-8111-111111111111",
    organization_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    submission_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    status: "new",
    name: "Анна",
    phone: "+7 912 345-67-89",
    service: "Арбитраж и суды",
    message: "Нужна консультация",
    form_mode: "Быстрая заявка",
    precheck_mode: "Не проводился",
    precheck_practice: "Не проводился",
    precheck_excerpt: "Не проводился",
    submitted_at: "2026-08-29T08:00:00.000Z",
    updated_at: "2026-08-29T08:05:00.000Z",
    matter_id: null,
    internal_secret: "must-not-leak",
  }]);

  assert.deepEqual(result, [{
    id: "11111111-1111-4111-8111-111111111111",
    organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    submissionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    status: "new",
    name: "Анна",
    phone: "+7 912 345-67-89",
    service: "Арбитраж и суды",
    message: "Нужна консультация",
    formMode: "Быстрая заявка",
    precheckMode: "Не проводился",
    precheckPractice: "Не проводился",
    precheckExcerpt: "Не проводился",
    submittedAt: "2026-08-29T08:00:00.000Z",
    updatedAt: "2026-08-29T08:05:00.000Z",
    matterId: null,
  }]);
  assert.equal("internalSecret" in result[0], false);
});

test("intake conversion validation requires the selected request UUID", () => {
  assert.equal(typeof subject.validateIntakeMatterAssignment, "function", "intake conversion validation is not implemented");
  assert.deepEqual(subject.validateIntakeMatterAssignment({
    intakeRequestId: "11111111-1111-4111-8111-111111111111",
  }), {
    valid: true,
    value: { intakeRequestId: "11111111-1111-4111-8111-111111111111" },
  });
  assert.equal(subject.validateIntakeMatterAssignment({ intakeRequestId: "bad" }).valid, false);
});
