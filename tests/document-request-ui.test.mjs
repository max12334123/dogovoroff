import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [clientSource, staffSource, cssSource, cabinetSource] = await Promise.all([
  readFile(new URL("../features/document-requests/client-document-requests.jsx", import.meta.url), "utf8"),
  readFile(new URL("../features/document-requests/staff-document-requests.jsx", import.meta.url), "utf8").catch(() => ""),
  readFile(new URL("../features/document-requests/document-requests.module.css", import.meta.url), "utf8"),
  readFile(new URL("../features/cabinet/cabinet-client.jsx", import.meta.url), "utf8"),
]);

test("client requests expose one contextual action and an explicit submit boundary", () => {
  assert.match(clientSource, /Требуется от вас/);
  assert.match(clientSource, /Отправить комплект на проверку/);
  assert.match(clientSource, /Повторить регистрацию/);
  assert.match(clientSource, /Отозвать файл/);
  assert.match(clientSource, /Подтвердить отзыв/);
  assert.match(clientSource, /Не более 20 файлов/);
  assert.match(clientSource, /aria-live="polite"/);
  assert.match(clientSource, /requestId/);
  assert.match(clientSource, /registerMatterDocument/);
  assert.match(clientSource, /submitDocumentRequest/);
  assert.match(clientSource, /withdrawDocumentRequestFile/);
  assert.doesNotMatch(clientSource, /dangerouslySetInnerHTML|localStorage|sessionStorage/);
});

test("failed registrations stay independently retryable and file selection keeps a visible focus boundary", () => {
  assert.match(clientSource, /pendingRegistrations/);
  assert.match(clientSource, /\[registration\.id\]: registration/);
  assert.match(clientSource, /Object\.values\(pendingRegistrations\)/);
  assert.match(clientSource, /registration\.requestId === request\.id/);
  assert.match(cssSource, /\.secondaryButton:focus-within/);
});

test("request layout is touch-safe, wraps long text, and stays card-based on mobile", () => {
  assert.match(cssSource, /min-height:\s*44px/);
  assert.match(cssSource, /overflow-wrap:\s*anywhere/);
  assert.match(cssSource, /@media \(max-width: 680px\)/);
  assert.doesNotMatch(cssSource, /white-space:\s*nowrap/);
});

test("cabinet renders requests ahead of the generic next action without removing ordinary documents", () => {
  assert.match(cabinetSource, /ClientDocumentRequests/);
  assert.match(cabinetSource, /clientPrimaryDocumentRequest/);
  assert.match(cabinetSource, /Другие документы/);
  assert.match(cabinetSource, /Других документов пока нет/);
  assert.match(cabinetSource, /DocumentRegister/);
});

test("staff request controls create, review, cancel, and keep private text out of navigation", () => {
  assert.match(staffSource, /Запросить документы/);
  assert.match(staffSource, /Принять комплект/);
  assert.match(staffSource, /Подтвердить принятие/);
  assert.match(staffSource, /Вернуть на исправление/);
  assert.match(staffSource, /Отменить запрос/);
  assert.match(staffSource, /Подтвердить отмену/);
  assert.match(staffSource, /createDocumentRequest/);
  assert.match(staffSource, /updateDocumentRequest/);
  assert.match(staffSource, /reviewDocumentRequest/);
  assert.match(staffSource, /cancelDocumentRequest/);
  assert.match(staffSource, /role="status"/);
  assert.doesNotMatch(staffSource, /service_role|SUPABASE_SERVICE|dangerouslySetInnerHTML/);
});

test("staff request completion waits for a refreshed request card before returning focus", () => {
  assert.match(staffSource, /const \[pendingFocusRequestId, setPendingFocusRequestId\] = useState\(null\);/);
  assert.match(staffSource, /setPendingFocusRequestId\(requestId\);/);
  assert.match(staffSource, /if \(!requests\.some\(\(request\) => request\.id === pendingFocusRequestId\)\) return;/);
  assert.match(staffSource, /cardRefs\.current\.get\(pendingFocusRequestId\)\?\.focus/);
  assert.match(staffSource, /setPendingFocusRequestId\(null\);/);
});
