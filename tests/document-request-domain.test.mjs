import assert from "node:assert/strict";
import test from "node:test";

import {
  DOCUMENT_REQUEST_STATUS,
  MAX_DOCUMENT_REQUEST_FILES,
  canTransitionDocumentRequest,
  getClientPrimaryDocumentRequest,
  getDocumentRequestErrorMessage,
  mapDocumentRequest,
  validateCancelDocumentRequest,
  validateCreateDocumentRequest,
  validateReviewDocumentRequest,
  validateSubmitDocumentRequest,
  validateUpdateDocumentRequest,
  validateWithdrawDocumentRequestFile,
} from "../features/document-requests/document-request-domain.mjs";

const MATTER_ID = "11111111-1111-4111-8111-111111111111";
const REQUEST_ID = "22222222-2222-4222-8222-222222222222";
const DOCUMENT_ID = "33333333-3333-4333-8333-333333333333";

test("request draft validation normalizes bounded staff input", () => {
  assert.deepEqual(validateCreateDocumentRequest({
    matterId: MATTER_ID,
    title: "  Договор и приложения  ",
    instructions: "  Приложите подписанный договор.  ",
    dueOn: "2026-09-05",
  }), {
    valid: true,
    value: {
      matterId: MATTER_ID,
      title: "Договор и приложения",
      instructions: "Приложите подписанный договор.",
      dueOn: "2026-09-05",
    },
    error: "",
  });
  assert.equal(validateCreateDocumentRequest({ matterId: "bad", title: "Документы" }).valid, false);
  assert.equal(validateCreateDocumentRequest({ matterId: MATTER_ID, title: " " }).valid, false);
  assert.equal(validateCreateDocumentRequest({ matterId: MATTER_ID, title: "x".repeat(241) }).valid, false);
  assert.equal(validateCreateDocumentRequest({ matterId: MATTER_ID, title: "Документы", dueOn: "05.09.2026" }).valid, false);
  assert.equal(validateCreateDocumentRequest({ matterId: MATTER_ID, title: "Документы", dueOn: "2026-02-30" }).valid, false);
  assert.equal(validateCreateDocumentRequest({
    matterId: MATTER_ID,
    title: "Документы",
    instructions: "  Страница 1\nСтраница 2  ",
  }).value.instructions, "Страница 1\nСтраница 2");
});

test("request commands require stable identifiers and bounded review notes", () => {
  assert.equal(validateSubmitDocumentRequest({ requestId: REQUEST_ID }).valid, true);
  assert.equal(validateCancelDocumentRequest({ requestId: REQUEST_ID }).valid, true);
  assert.equal(validateUpdateDocumentRequest({ requestId: REQUEST_ID, matterId: MATTER_ID, title: "Паспорт" }).valid, true);
  assert.equal(validateWithdrawDocumentRequestFile({ requestId: REQUEST_ID, documentId: DOCUMENT_ID }).valid, true);
  assert.equal(validateReviewDocumentRequest({ requestId: REQUEST_ID, decision: "changes_requested", note: "" }).valid, false);
  assert.equal(validateReviewDocumentRequest({ requestId: REQUEST_ID, decision: "accepted", note: "скрытый текст" }).value.note, null);
  assert.equal(validateReviewDocumentRequest({ requestId: REQUEST_ID, decision: "cancelled", note: "" }).valid, false);
});

test("request transition rules cover every mutable and terminal state", () => {
  const can = (from, to, overrides = {}) => canTransitionDocumentRequest({
    from,
    to,
    activeFileCount: 1,
    reviewNote: "Нужно заменить страницу.",
    ...overrides,
  });
  assert.equal(can("requested", "submitted"), true);
  assert.equal(can("changes_requested", "submitted"), true);
  assert.equal(can("submitted", "accepted"), true);
  assert.equal(can("submitted", "changes_requested"), true);
  for (const from of ["requested", "submitted", "changes_requested"]) {
    assert.equal(can(from, "cancelled"), true);
  }
  assert.equal(can("requested", "submitted", { activeFileCount: 0 }), false);
  assert.equal(can("requested", "submitted", { activeFileCount: 21 }), false);
  assert.equal(can("submitted", "changes_requested", { reviewNote: " " }), false);
  assert.equal(can("accepted", "submitted"), false);
  assert.equal(can("cancelled", "requested"), false);
  assert.equal(can("requested", "accepted"), false);
});

test("mapped requests keep files grouped and choose the next client action deterministically", () => {
  const base = {
    matter_id: MATTER_ID,
    title: "Документы",
    instructions: "",
    last_review_note: null,
    submitted_at: null,
    reviewed_at: null,
    created_at: "2026-08-30T05:00:00.000Z",
    updated_at: "2026-08-30T05:00:00.000Z",
  };
  const requested = mapDocumentRequest({ ...base, id: REQUEST_ID, status: "requested", due_on: "2026-09-05" }, []);
  const changes = mapDocumentRequest({ ...base, id: "44444444-4444-4444-8444-444444444444", status: "changes_requested", due_on: null }, []);

  assert.equal(MAX_DOCUMENT_REQUEST_FILES, 20);
  assert.equal(requested.statusLabel, "Ожидаем документы");
  assert.equal(requested.activeDocumentCount, 0);
  assert.equal(getClientPrimaryDocumentRequest([requested, changes]).id, changes.id);
  assert.equal(DOCUMENT_REQUEST_STATUS.ACCEPTED, "accepted");
});

test("provider errors become bounded Russian messages", () => {
  assert.equal(getDocumentRequestErrorMessage({ code: "42501", message: "private detail" }), "У вас нет прав выполнить это действие.");
  assert.equal(getDocumentRequestErrorMessage({ message: "request_state_changed" }), "Запрос уже изменился. Обновите страницу и попробуйте ещё раз.");
  assert.equal(getDocumentRequestErrorMessage({ message: "request_file_limit" }), "К одному запросу можно прикрепить не более 20 файлов.");
  assert.doesNotMatch(getDocumentRequestErrorMessage({ message: "secret provider trace" }), /secret|provider/i);
});
