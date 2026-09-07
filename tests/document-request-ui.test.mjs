import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [clientSource, staffSource, cssSource, cabinetClientSource, cabinetOverviewSource, cabinetActionSource] = await Promise.all([
  readFile(new URL("../features/document-requests/client-document-requests.jsx", import.meta.url), "utf8"),
  readFile(new URL("../features/document-requests/staff-document-requests.jsx", import.meta.url), "utf8").catch(() => ""),
  readFile(new URL("../features/document-requests/document-requests.module.css", import.meta.url), "utf8"),
  readFile(new URL("../features/cabinet/cabinet-client.jsx", import.meta.url), "utf8"),
  readFile(new URL("../features/cabinet/cabinet-overview.jsx", import.meta.url), "utf8"),
  readFile(new URL("../features/cabinet/cabinet-navigation-domain.mjs", import.meta.url), "utf8"),
]);
const cabinetSource = [cabinetClientSource, cabinetOverviewSource, cabinetActionSource].join("\n");

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

test("client request cards wire the prioritized domain action to exactly one primary control", () => {
  assert.match(clientSource, /getClientPrimaryDocumentRequestAction/);
  assert.match(clientSource, /primaryAction\?\.requestId === request\.id/);
  assert.match(clientSource, /primaryAction\?\.action === "add_file"/);
  assert.match(clientSource, /primaryAction\?\.action === "submit"/);
  assert.match(clientSource, /isPrimaryAddFileAction \? styles\.primaryButton : styles\.secondaryButton/);
  assert.match(clientSource, /isPrimarySubmitAction \? styles\.primaryButton : styles\.secondaryButton/);
  assert.match(cssSource, /\.primaryButton:focus-within/);
  assert.match(cssSource, /\.primaryButton\[aria-disabled="true"\]/);
});

test("request layout is touch-safe, wraps long text, and stays card-based on mobile", () => {
  assert.match(
    cssSource,
    /\.fileButton\s*\{[^}]*min-height:\s*44px;[^}]*align-items:\s*center;/,
  );
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
  assert.match(cabinetSource, /getDocumentsSideAction/);
  assert.match(cabinetSource, /documentsSideAction === "managed_request"/);
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

test("staff document create, edit, review and confirmations share one progressive surface", () => {
  assert.match(staffSource, /const \[activeEditor, setActiveEditor\] = useState\(null\)/);
  assert.match(staffSource, /activeEditor === "create" \? <form/);
  assert.match(staffSource, /activeEditor === `review:\$\{request.id\}` \? <div/);
  assert.match(staffSource, /activeEditor === `accept:\$\{request.id\}`/);
  assert.match(staffSource, /activeEditor === `cancel:\$\{request.id\}`/);
  assert.doesNotMatch(staffSource, /\[editingId|\[acceptingId|\[cancellingId/);
  assert.match(staffSource, /useDraftRegistration\(draftRegistry, "documents", dirty/);
  assert.match(staffSource, /requestTransition\(\(\) =>/);
});
