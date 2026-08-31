import assert from "node:assert/strict";
import test from "node:test";

import {
  createDocumentRequestActionHandlers,
  createProtectedViewRefresher,
} from "../features/document-requests/document-request-action-core.mjs";
import { registerDocumentMetadata } from "../features/cabinet/cabinet-document-registration.mjs";

const MATTER_ID = "11111111-1111-4111-8111-111111111111";
const REQUEST_ID = "22222222-2222-4222-8222-222222222222";
const DOCUMENT_ID = "33333333-3333-4333-8333-333333333333";

function createRpcClient(resolver) {
  const calls = [];
  return {
    calls,
    client: {
      rpc(name, args) {
        calls.push({ name, args, singleCalls: 0 });
        return {
          async single() {
            calls.at(-1).singleCalls += 1;
            return resolver(name, args);
          },
        };
      },
    },
  };
}

test("action handlers validate first, call one narrow RPC, and normalize successful output", async () => {
  const { calls, client } = createRpcClient(async (name) => ({
    data: {
      request_id: REQUEST_ID,
      request_status: name === "review_document_request" ? "accepted" : "requested",
      request_updated_at: "2026-08-31T06:00:00.000Z",
      ...(name === "withdraw_document_request_file" ? {
        document_id: DOCUMENT_ID,
        document_status: "archived",
      } : {}),
    },
    error: null,
  }));
  let authenticationCalls = 0;
  let refreshCalls = 0;
  const handlers = createDocumentRequestActionHandlers({
    async getAuthenticatedClient() {
      authenticationCalls += 1;
      return { supabase: client, userId: "user-1" };
    },
    refreshProtectedViews() {
      refreshCalls += 1;
    },
    reportError() {
      assert.fail("successful actions must not report errors");
    },
  });

  const cases = [
    {
      run: handlers.createDocumentRequest,
      input: { matterId: MATTER_ID, title: "  Паспорт  ", instructions: "  Все страницы  ", dueOn: "2026-09-10" },
      rpc: "create_document_request",
      args: { target_matter_id: MATTER_ID, new_title: "Паспорт", new_instructions: "Все страницы", new_due_on: "2026-09-10" },
      message: "Запрос документов создан.",
    },
    {
      run: handlers.updateDocumentRequest,
      input: { requestId: REQUEST_ID, matterId: MATTER_ID, title: "Договор", instructions: "", dueOn: "" },
      rpc: "update_document_request",
      args: { target_request_id: REQUEST_ID, new_title: "Договор", new_instructions: null, new_due_on: null },
      message: "Запрос документов обновлён.",
    },
    {
      run: handlers.submitDocumentRequest,
      input: { requestId: REQUEST_ID },
      rpc: "submit_document_request",
      args: { target_request_id: REQUEST_ID },
      message: "Комплект отправлен на проверку.",
    },
    {
      run: handlers.reviewDocumentRequest,
      input: { requestId: REQUEST_ID, decision: "accepted", note: "не передавать" },
      rpc: "review_document_request",
      args: { target_request_id: REQUEST_ID, new_decision: "accepted", new_note: null },
      message: "Комплект принят.",
    },
    {
      run: handlers.cancelDocumentRequest,
      input: { requestId: REQUEST_ID },
      rpc: "cancel_document_request",
      args: { target_request_id: REQUEST_ID },
      message: "Запрос документов отменён.",
    },
    {
      run: handlers.withdrawDocumentRequestFile,
      input: { requestId: REQUEST_ID, documentId: DOCUMENT_ID },
      rpc: "withdraw_document_request_file",
      args: { target_request_id: REQUEST_ID, target_document_id: DOCUMENT_ID },
      message: "Файл отозван из комплекта.",
    },
  ];

  for (const item of cases) {
    const result = await item.run(item.input);
    assert.equal(result.ok, true);
    assert.equal(result.message, item.message);
    assert.equal(result.data.requestId, REQUEST_ID);
    assert.equal(calls.at(-1).name, item.rpc);
    assert.deepEqual(calls.at(-1).args, item.args);
    assert.equal(calls.at(-1).singleCalls, 1);
  }

  assert.equal(authenticationCalls, cases.length);
  assert.equal(refreshCalls, cases.length);
  assert.deepEqual(calls.at(-1), {
    name: "withdraw_document_request_file",
    args: { target_request_id: REQUEST_ID, target_document_id: DOCUMENT_ID },
    singleCalls: 1,
  });
});

test("invalid and expired-session actions stop before the database", async () => {
  let authenticationCalls = 0;
  const handlers = createDocumentRequestActionHandlers({
    async getAuthenticatedClient() {
      authenticationCalls += 1;
      return { supabase: null, userId: null };
    },
    refreshProtectedViews() {
      assert.fail("failed actions must not revalidate");
    },
    reportError() {
      assert.fail("validation and session failures are not provider errors");
    },
  });

  const invalid = await handlers.createDocumentRequest({ matterId: "bad", title: "Документы" });
  assert.equal(invalid.ok, false);
  assert.match(invalid.message, /дело/i);
  assert.equal(authenticationCalls, 0);

  const expired = await handlers.submitDocumentRequest({ requestId: REQUEST_ID });
  assert.deepEqual(expired, { ok: false, message: "Сессия истекла. Войдите повторно." });
  assert.equal(authenticationCalls, 1);
});

test("provider failures expose a bounded message and log only code and status", async () => {
  const reports = [];
  let refreshCalls = 0;
  const { client } = createRpcClient(async () => ({
    data: null,
    error: { code: "42501", status: 403, message: "secret provider trace with client title" },
  }));
  const handlers = createDocumentRequestActionHandlers({
    async getAuthenticatedClient() {
      return { supabase: client, userId: "user-1" };
    },
    refreshProtectedViews() {
      refreshCalls += 1;
    },
    reportError(details) {
      reports.push(details);
    },
  });

  const result = await handlers.submitDocumentRequest({ requestId: REQUEST_ID });
  assert.deepEqual(result, { ok: false, message: "У вас нет прав выполнить это действие." });
  assert.deepEqual(reports, [{ code: "42501", status: 403 }]);
  assert.equal(refreshCalls, 0);
  assert.doesNotMatch(JSON.stringify(reports), /secret|client title/i);
});

test("protected view refresher invalidates both employee and client routes", () => {
  const paths = [];
  const refresh = createProtectedViewRefresher((path) => paths.push(path));

  refresh();

  assert.deepEqual(paths, ["/cabinet", "/staff"]);
});

test("document metadata registration routes linked files through the atomic RPC", async () => {
  const linkedCalls = [];
  const linkedSupabase = {
    rpc(name, args) {
      linkedCalls.push({ name, args, singleCalls: 0 });
      return {
        async single() {
          linkedCalls.at(-1).singleCalls += 1;
          return { data: { document_id: DOCUMENT_ID }, error: null };
        },
      };
    },
    from() {
      assert.fail("linked files must not use a direct table insert");
    },
  };
  const linked = await registerDocumentMetadata({
    supabase: linkedSupabase,
    userId: "user-1",
    document: {
      id: DOCUMENT_ID,
      matterId: MATTER_ID,
      requestId: REQUEST_ID,
      storagePath: `${MATTER_ID}/${DOCUMENT_ID}/document.pdf`,
      originalName: "Договор.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
    },
  });

  assert.equal(linked.linked, true);
  assert.deepEqual(linkedCalls, [{
    name: "register_document_request_file",
    args: {
      target_request_id: REQUEST_ID,
      new_document_id: DOCUMENT_ID,
      new_storage_path: `${MATTER_ID}/${DOCUMENT_ID}/document.pdf`,
      new_original_name: "Договор.pdf",
      new_mime_type: "application/pdf",
      new_size_bytes: 1024,
    },
    singleCalls: 1,
  }]);
});

test("ordinary document metadata keeps the existing direct insert path", async () => {
  const tableCalls = [];
  const ordinarySupabase = {
    rpc() {
      assert.fail("ordinary documents must not call the request RPC");
    },
    from(table) {
      return {
        async insert(payload) {
          tableCalls.push({ table, payload });
          return { data: null, error: null };
        },
      };
    },
  };
  const ordinary = await registerDocumentMetadata({
    supabase: ordinarySupabase,
    userId: "user-1",
    document: {
      id: DOCUMENT_ID,
      matterId: MATTER_ID,
      requestId: null,
      storagePath: `${MATTER_ID}/${DOCUMENT_ID}/document.pdf`,
      originalName: "Договор.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
    },
  });

  assert.equal(ordinary.linked, false);
  assert.deepEqual(tableCalls, [{
    table: "documents",
    payload: {
      id: DOCUMENT_ID,
      matter_id: MATTER_ID,
      request_id: null,
      storage_path: `${MATTER_ID}/${DOCUMENT_ID}/document.pdf`,
      original_name: "Договор.pdf",
      mime_type: "application/pdf",
      size_bytes: 1024,
      uploaded_by: "user-1",
    },
  }]);
});
