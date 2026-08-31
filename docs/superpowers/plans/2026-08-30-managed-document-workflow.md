# Managed Document Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить в личный кабинет и рабочую панель безопасные запросы комплектов документов с несколькими файлами, явной отправкой на проверку, возвратом на исправление и принятием.

**Architecture:** Новая изолированная возможность размещается в `features/document-requests`. PostgreSQL хранит запросы и проверяет все переходы через узкие RPC и RLS; существующая таблица документов получает nullable-ссылку на запрос. Действующий `loadCabinetData` строит единый RLS-отфильтрованный read model для клиента и сотрудника, а UI подключает небольшие клиентский и служебный компоненты без нового глобального раздела.

**Tech Stack:** Next.js 15.5.21 App Router, React 19.1.5, JavaScript ESM, Supabase Auth/PostgreSQL/Storage/RLS, native `node:test`, CSS Modules.

**Spec:** `docs/superpowers/specs/2026-08-30-managed-document-workflow-design.md`

## Global Constraints

- Не добавлять production- или development-зависимости.
- Поддерживать PDF, DOC, DOCX, JPG и PNG размером до 10 МБ каждый.
- Разрешать не более 20 активных файлов в одном запросе; ограничение проверяет PostgreSQL.
- Не открывать, не преобразовывать и не передавать загруженные файлы в AI.
- Не выдавать клиенту физическое удаление Storage; отзыв файла переводит метаданные в `archived`.
- Не менять публичные юридические документы, политику обработки данных и согласия.
- Не отправлять названия запросов, имена файлов, инструкции и замечания в уведомления, аудит, аналитику или серверные логи.
- Существующие документы с `request_id is null` продолжают работать в блоке «Другие документы».
- Все новые SQL-функции используют `security definer set search_path = ''`, полные имена объектов, повторную проверку `auth.uid()` и явные `revoke`/`grant`.
- Сначала применять миграцию только к бесплатному `dogovoroff-test`; Production не изменять без отдельного подтверждения.
- Перед каждым коммитом запускать целевой тест и `git diff --check`; перед передачей результата запускать весь `npm.cmd test` и `npm.cmd run build`.

## File Map

**Create**

- `features/document-requests/document-request-domain.mjs` — чистая валидация, статусы, сортировка и безопасные сообщения ошибок.
- `features/document-requests/document-request-actions.js` — server actions для создания, изменения, отправки, проверки, отмены и отзыва файла.
- `features/document-requests/client-document-requests.jsx` — клиентские карточки, загрузка, повтор регистрации, отправка и отзыв.
- `features/document-requests/staff-document-requests.jsx` — форма запроса и проверка комплекта сотрудником.
- `features/document-requests/document-requests.module.css` — общие стили модуля с мобильными и accessibility-состояниями.
- `supabase/migrations/20260830140000_add_document_requests.sql` — enum, таблица, nullable-ссылка, RLS, RPC, события и аудит.
- `supabase/tests/document-requests-smoke.sql` — транзакционная проверка пяти ролей и очистки.
- `tests/document-request-domain.test.mjs` — поведение чистого домена.
- `tests/document-request-migration.test.mjs` — статический контракт миграции.
- `tests/document-request-actions.test.mjs` — контракт server actions и регистрации файла.
- `tests/document-request-ui.test.mjs` — структура, копирайтинг, доступность и отсутствие чувствительных полей.
- `docs/decisions/0006-managed-document-requests.md` — краткий ADR фактически реализованного решения.

**Modify**

- `features/cabinet/cabinet-write-domain.mjs:111-151` — необязательный `requestId` в регистрации документа.
- `features/cabinet/cabinet-actions.js:31-88` — связанный файл регистрируется через RPC и безопасно повторяется.
- `features/cabinet/cabinet-server.js:51-226` — загрузка и нормализация запросов, связь с документами, безопасные события.
- `features/cabinet/cabinet-client.jsx:94-347,454-742` — подключение клиентского модуля и сохранение обычных документов.
- `features/cabinet/cabinet.module.css:826-1640` — интеграционные отступы и адаптивная сетка.
- `features/staff/staff-domain.mjs:59-75` — очередь учитывает комплекты, ожидающие проверки или клиента.
- `features/staff/staff-client.jsx:1-90,200-453,536-920` — подключение служебного модуля и нейтральные подписи аудита.
- `features/staff/staff.module.css:525-700,1745-1995` — размещение блока запросов на desktop/mobile.
- `features/notifications/notification-domain.mjs:1-55` — allowlist событий запросов.
- `scripts/supabase-rls-smoke.mjs:20-38` — read-only проверка `document_requests`.
- `tests/cabinet-write-domain.test.mjs` — регистрация с `requestId`.
- `tests/cabinet-server.test.mjs` — новый read model и нейтральные уведомления.
- `tests/cabinet.test.mjs` — интеграция клиентского компонента.
- `tests/staff-cabinet.test.mjs` — очередь и интеграция служебного компонента.
- `tests/notification-domain.test.mjs` — allowlist без чувствительной копии.
- `tests/supabase-rls-smoke.test.mjs` — новый transactional smoke и ресурс read-only проверки.
- `docs/supabase-e2e.md` — порядок запуска пятого SQL-сценария.
- `docs/cabinet-mvp.md` — фактический объём и ограничения после завершения.

---

### Task 1: Pure document-request domain

**Files:**

- Create: `features/document-requests/document-request-domain.mjs`
- Create: `tests/document-request-domain.test.mjs`

**Interfaces:**

- Consumes: `isUuid(value)` from `features/cabinet/cabinet-write-domain.mjs`.
- Produces: `DOCUMENT_REQUEST_STATUS`, `MAX_DOCUMENT_REQUEST_FILES`, `canTransitionDocumentRequest`, `validateCreateDocumentRequest`, `validateUpdateDocumentRequest`, `validateSubmitDocumentRequest`, `validateReviewDocumentRequest`, `validateCancelDocumentRequest`, `validateWithdrawDocumentRequestFile`, `mapDocumentRequest`, `getClientPrimaryDocumentRequest`, `getDocumentRequestErrorMessage`.

- [ ] **Step 1: Write failing behavioral tests**

Create `tests/document-request-domain.test.mjs` with fixed UUIDs and explicit cases:

```js
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
```

- [ ] **Step 2: Run the domain test and verify the red state**

Run:

```powershell
npm.cmd test -- tests/document-request-domain.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `document-request-domain.mjs`.

- [ ] **Step 3: Implement the pure domain**

Create `features/document-requests/document-request-domain.mjs` with these exact public constants and shapes:

```js
import { isUuid } from "../cabinet/cabinet-write-domain.mjs";

export const DOCUMENT_REQUEST_STATUS = Object.freeze({
  REQUESTED: "requested",
  SUBMITTED: "submitted",
  CHANGES_REQUESTED: "changes_requested",
  ACCEPTED: "accepted",
  CANCELLED: "cancelled",
});

export const MAX_DOCUMENT_REQUEST_FILES = 20;
export const MAX_DOCUMENT_REQUEST_TITLE_LENGTH = 240;
export const MAX_DOCUMENT_REQUEST_TEXT_LENGTH = 2000;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const STATUS_LABELS = Object.freeze({
  requested: "Ожидаем документы",
  submitted: "Получено, на проверке",
  changes_requested: "Нужно исправить",
  accepted: "Принято",
  cancelled: "Отменено",
});

export function canTransitionDocumentRequest({
  from,
  to,
  activeFileCount = 0,
  reviewNote = "",
} = {}) {
  if (to === DOCUMENT_REQUEST_STATUS.CANCELLED) {
    return [
      DOCUMENT_REQUEST_STATUS.REQUESTED,
      DOCUMENT_REQUEST_STATUS.SUBMITTED,
      DOCUMENT_REQUEST_STATUS.CHANGES_REQUESTED,
    ].includes(from);
  }
  if (to === DOCUMENT_REQUEST_STATUS.SUBMITTED) {
    return [DOCUMENT_REQUEST_STATUS.REQUESTED, DOCUMENT_REQUEST_STATUS.CHANGES_REQUESTED].includes(from)
      && Number.isInteger(activeFileCount)
      && activeFileCount >= 1
      && activeFileCount <= MAX_DOCUMENT_REQUEST_FILES;
  }
  if (from === DOCUMENT_REQUEST_STATUS.SUBMITTED && to === DOCUMENT_REQUEST_STATUS.ACCEPTED) {
    return true;
  }
  if (from === DOCUMENT_REQUEST_STATUS.SUBMITTED && to === DOCUMENT_REQUEST_STATUS.CHANGES_REQUESTED) {
    return typeof reviewNote === "string" && reviewNote.trim().length > 0
      && reviewNote.trim().length <= MAX_DOCUMENT_REQUEST_TEXT_LENGTH;
  }
  return false;
}

function invalid(error) {
  return { valid: false, error };
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanDate(value) {
  const dueOn = cleanText(value);
  if (!dueOn) return null;
  if (!DATE_PATTERN.test(dueOn)) return false;
  const [year, month, day] = dueOn.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return false;
  return dueOn;
}

function validateDraft(input, requireRequestId) {
  if (!input || typeof input !== "object" || !isUuid(input.matterId)) return invalid("Некорректное дело.");
  if (requireRequestId && !isUuid(input.requestId)) return invalid("Некорректный запрос документов.");
  const title = cleanText(input.title);
  const instructions = cleanText(input.instructions) || null;
  const dueOn = cleanDate(input.dueOn);
  if (!title || title.length > MAX_DOCUMENT_REQUEST_TITLE_LENGTH) return invalid("Название запроса должно содержать от 1 до 240 символов.");
  if (instructions && instructions.length > MAX_DOCUMENT_REQUEST_TEXT_LENGTH) return invalid("Инструкция не должна превышать 2000 символов.");
  if (dueOn === false) return invalid("Укажите корректную дату.");
  return {
    valid: true,
    value: {
      ...(requireRequestId ? { requestId: input.requestId } : {}),
      matterId: input.matterId,
      title,
      instructions,
      dueOn,
    },
    error: "",
  };
}

export function validateCreateDocumentRequest(input) {
  return validateDraft(input, false);
}

export function validateUpdateDocumentRequest(input) {
  return validateDraft(input, true);
}

function validateRequestId(input) {
  return input && typeof input === "object" && isUuid(input.requestId)
    ? { valid: true, value: { requestId: input.requestId }, error: "" }
    : invalid("Некорректный запрос документов.");
}

export const validateSubmitDocumentRequest = validateRequestId;
export const validateCancelDocumentRequest = validateRequestId;

export function validateReviewDocumentRequest(input) {
  const request = validateRequestId(input);
  if (!request.valid) return request;
  const decision = cleanText(input.decision);
  if (![DOCUMENT_REQUEST_STATUS.ACCEPTED, DOCUMENT_REQUEST_STATUS.CHANGES_REQUESTED].includes(decision)) return invalid("Выберите корректное решение.");
  const note = decision === DOCUMENT_REQUEST_STATUS.CHANGES_REQUESTED ? cleanText(input.note) : null;
  if (decision === DOCUMENT_REQUEST_STATUS.CHANGES_REQUESTED && (!note || note.length > MAX_DOCUMENT_REQUEST_TEXT_LENGTH)) return invalid("Укажите пояснение до 2000 символов.");
  return { valid: true, value: { requestId: input.requestId, decision, note }, error: "" };
}

export function validateWithdrawDocumentRequestFile(input) {
  if (!input || !isUuid(input.requestId) || !isUuid(input.documentId)) return invalid("Некорректный файл запроса.");
  return { valid: true, value: { requestId: input.requestId, documentId: input.documentId }, error: "" };
}

export function mapDocumentRequest(row, documents = []) {
  const requestDocuments = documents.filter((document) => document.requestId === row.id);
  const activeDocuments = requestDocuments.filter((document) => document.statusValue !== "archived");
  return {
    id: row.id,
    matterId: row.matter_id,
    title: row.title,
    instructions: row.instructions || "",
    dueOn: row.due_on || null,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] || "Запрос документов",
    lastReviewNote: row.last_review_note || "",
    submittedAt: row.submitted_at || null,
    reviewedAt: row.reviewed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    documents: requestDocuments,
    activeDocumentCount: activeDocuments.length,
    requiresClientAction: row.status === DOCUMENT_REQUEST_STATUS.REQUESTED || row.status === DOCUMENT_REQUEST_STATUS.CHANGES_REQUESTED,
    awaitingStaff: row.status === DOCUMENT_REQUEST_STATUS.SUBMITTED,
    terminal: row.status === DOCUMENT_REQUEST_STATUS.ACCEPTED || row.status === DOCUMENT_REQUEST_STATUS.CANCELLED,
  };
}

export function getClientPrimaryDocumentRequest(requests = []) {
  const priority = { changes_requested: 0, requested: 1 };
  return requests
    .filter((request) => request.requiresClientAction)
    .sort((left, right) => {
      const statusDelta = priority[left.status] - priority[right.status];
      if (statusDelta) return statusDelta;
      const leftDue = left.dueOn || "9999-12-31";
      const rightDue = right.dueOn || "9999-12-31";
      return leftDue.localeCompare(rightDue) || String(left.createdAt).localeCompare(String(right.createdAt));
    })[0] || null;
}

export function getDocumentRequestErrorMessage(error) {
  if (error?.code === "42501") return "У вас нет прав выполнить это действие.";
  const messages = {
    request_state_changed: "Запрос уже изменился. Обновите страницу и попробуйте ещё раз.",
    request_file_limit: "К одному запросу можно прикрепить не более 20 файлов.",
    request_file_required: "Добавьте хотя бы один документ.",
    request_review_note_required: "Укажите, что клиенту необходимо исправить.",
    request_not_found: "Запрос документов не найден.",
    request_file_not_found: "Документ запроса не найден.",
    document_registration_conflict: "Файл уже зарегистрирован с другими данными. Обновите страницу и попробуйте ещё раз.",
  };
  return messages[error?.message] || "Не удалось обновить запрос документов. Попробуйте ещё раз.";
}
```

- [ ] **Step 4: Run the domain test and the existing cabinet-domain regression test**

Run:

```powershell
npm.cmd test -- tests/document-request-domain.test.mjs tests/cabinet-write-domain.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Check and commit the domain**

Run:

```powershell
git diff --check
git add features/document-requests/document-request-domain.mjs tests/document-request-domain.test.mjs
git commit -m "feat: add document request domain"
```

### Task 2: Add the PostgreSQL authorization boundary

**Files:**

- Create: `supabase/migrations/20260830140000_add_document_requests.sql`
- Create: `tests/document-request-migration.test.mjs`

**Interfaces:**

- Consumes: `private.can_access_matter(uuid)`, `private.can_manage_matter(uuid)`, `private.set_updated_at()`, existing `documents`, `matter_events`, `audit_events`, bucket `matter-documents`.
- Produces: enum `public.document_request_status`, table `public.document_requests`, `documents.request_id`, and RPCs `create_document_request`, `update_document_request`, `register_document_request_file`, `submit_document_request`, `review_document_request`, `cancel_document_request`, `withdraw_document_request_file`.

**SQL error contract:** every missing identity or failed role check raises SQLSTATE `42501` with
a fixed non-sensitive message. State/input failures use only the fixed message keys listed in
Task 1. Qualify every table column with an alias so PL/pgSQL output-column names cannot make
queries ambiguous.

- [ ] **Step 1: Write the failing migration contract test**

Create `tests/document-request-migration.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../supabase/migrations/20260830140000_add_document_requests.sql", import.meta.url),
  "utf8",
);

test("document request migration creates an additive RLS-isolated model", () => {
  assert.match(source, /create type public\.document_request_status as enum \('requested', 'submitted', 'changes_requested', 'accepted', 'cancelled'\)/);
  assert.match(source, /create table public\.document_requests/);
  assert.match(source, /alter table public\.documents[\s\S]*add column request_id uuid/);
  assert.match(source, /alter table public\.document_requests enable row level security/);
  assert.match(source, /alter table public\.document_requests force row level security/);
  const selectGrant = source.match(/grant select\s*\(([\s\S]*?)\)\s*on table public\.document_requests to authenticated/i);
  assert.ok(selectGrant, "authenticated receives an explicit column-level select grant");
  assert.doesNotMatch(selectGrant[1], /created_by|reviewed_by/i);
  assert.doesNotMatch(source, /grant (?:insert|update|delete)[^;]+document_requests/i);
  assert.match(source, /request_id is null[\s\S]*private\.can_access_matter/);
  assert.doesNotMatch(source, /drop table|drop type|truncate/i);
});

test("document request RPCs check identity, state, limits, Storage ownership, and grants", () => {
  for (const name of [
    "create_document_request",
    "update_document_request",
    "register_document_request_file",
    "submit_document_request",
    "review_document_request",
    "cancel_document_request",
    "withdraw_document_request_file",
  ]) {
    const start = source.indexOf(`create or replace function public.${name}`);
    assert.notEqual(start, -1, `${name} must exist`);
    const end = source.indexOf("$$;", start);
    assert.notEqual(end, -1, `${name} must have a closed body`);
    const definition = source.slice(start, end + 3);
    assert.match(definition, /security definer/i, `${name} must be security definer`);
    assert.match(definition, /set search_path = ''/i, `${name} must pin an empty search path`);
    assert.match(definition, /auth\.uid\(\)/, `${name} must check identity internally`);
  }
  assert.match(source, /private\.can_manage_matter/);
  assert.match(source, /matter_participants[\s\S]*role = 'client'/);
  assert.match(source, /pg_advisory_xact_lock/);
  assert.match(source, /request_file_limit/);
  assert.match(source, /storage\.objects/);
  assert.match(source, /owner_id::text = actor_id::text/);
  assert.match(source, /request_review_note_required/);
  assert.match(source, /update public\.documents[\s\S]*status = 'ready'/);
  assert.match(source, /update public\.documents[\s\S]*status = 'archived'/);
  assert.match(source, /revoke all on function public\./);
  assert.match(source, /grant execute on function public\./);
  assert.equal((source.match(/revoke all on function public\./g) || []).length, 7);
  assert.equal((source.match(/grant execute on function public\./g) || []).length, 7);
  assert.doesNotMatch(source, /service_role/i);
});

test("document request events and audit never copy request or file text", () => {
  assert.match(source, /document_request\.created/);
  assert.match(source, /document_request\.updated/);
  assert.match(source, /document_request\.submitted/);
  assert.match(source, /document_request\.changes_requested/);
  assert.match(source, /document_request\.accepted/);
  assert.match(source, /document_request\.cancelled/);
  assert.match(source, /document_request\.file_withdrawn/);
  assert.match(source, /insert into public\.audit_events/);
  assert.doesNotMatch(source, /public_text\s*[:=][^;]*(?:title|original_name|last_review_note)/i);
});
```

- [ ] **Step 2: Run the migration contract and verify the red state**

Run:

```powershell
npm.cmd test -- tests/document-request-migration.test.mjs
```

Expected: FAIL with `ENOENT` for the migration.

- [ ] **Step 3: Add enum, table, indexes, RLS, and the nullable document link**

Start `supabase/migrations/20260830140000_add_document_requests.sql` with this concrete schema:

```sql
create type public.document_request_status as enum (
  'requested',
  'submitted',
  'changes_requested',
  'accepted',
  'cancelled'
);

create table public.document_requests (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters (id) on delete cascade,
  title text not null,
  instructions text,
  due_on date,
  status public.document_request_status not null default 'requested',
  last_review_note text,
  created_by uuid not null references auth.users (id) on delete restrict,
  reviewed_by uuid references auth.users (id) on delete set null,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_requests_title_length check (char_length(btrim(title)) between 1 and 240),
  constraint document_requests_instructions_length check (instructions is null or char_length(btrim(instructions)) between 1 and 2000),
  constraint document_requests_review_note_length check (last_review_note is null or char_length(btrim(last_review_note)) between 1 and 2000)
);

create index document_requests_matter_status_due_idx
  on public.document_requests (matter_id, status, due_on);
create index document_requests_created_by_idx
  on public.document_requests (created_by);
create index document_requests_reviewed_by_idx
  on public.document_requests (reviewed_by)
  where reviewed_by is not null;

alter table public.documents
  add column request_id uuid references public.document_requests (id);
create index documents_request_created_idx
  on public.documents (request_id, created_at desc)
  where request_id is not null;

create trigger document_requests_set_updated_at
before update on public.document_requests
for each row execute function private.set_updated_at();

alter table public.document_requests enable row level security;
alter table public.document_requests force row level security;
revoke all on table public.document_requests from public, anon, authenticated;
grant select (
  id,
  matter_id,
  title,
  instructions,
  due_on,
  status,
  last_review_note,
  submitted_at,
  reviewed_at,
  created_at,
  updated_at
) on table public.document_requests to authenticated;

create policy document_requests_select_accessible
on public.document_requests for select
to authenticated
using ((select private.can_access_matter(document_requests.matter_id)));

drop policy if exists documents_insert_accessible on public.documents;
create policy documents_insert_accessible
on public.documents for insert
to authenticated
with check (
  uploaded_by = (select auth.uid())
  and request_id is null
  and storage_path like matter_id::text || '/%'
  and (select private.can_access_matter(documents.matter_id))
);
```

- [ ] **Step 4: Add a private client predicate and privacy-safe activity writer**

Add two private functions. `private.is_matter_client(uuid)` returns `true` only for the
current `auth.uid()` row in `matter_participants` with role `client`. The activity writer
looks up `matter_id` and `organization_id`, inserts one generic `matter_events` row only
when `safe_public_text` is non-null, and always inserts one technical `audit_events` row:

```sql
create or replace function private.is_matter_client(target_matter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.matter_participants as participant
      where participant.matter_id = target_matter_id
        and participant.user_id = (select auth.uid())
        and participant.role = 'client'
    );
$$;

create or replace function private.record_document_request_activity(
  target_request_id uuid,
  safe_action text,
  safe_public_text text,
  target_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_matter_id uuid;
  target_organization_id uuid;
begin
  select request.matter_id, matter.organization_id
  into target_matter_id, target_organization_id
  from public.document_requests as request
  join public.matters as matter on matter.id = request.matter_id
  where request.id = target_request_id;

  if safe_public_text is not null then
    insert into public.matter_events (matter_id, event_type, public_text, actor_id)
    values (target_matter_id, safe_action, safe_public_text, target_actor_id);
  end if;

  insert into public.audit_events (
    organization_id, matter_id, actor_id, action, entity_type, entity_id
  ) values (
    target_organization_id, target_matter_id, target_actor_id,
    safe_action, 'document_request', target_request_id
  );
end;
$$;

revoke all on function private.is_matter_client(uuid) from public, anon, authenticated;
revoke all on function private.record_document_request_activity(uuid, text, text, uuid)
from public, anon, authenticated;
```

- [ ] **Step 5: Add create and restricted update RPCs**

Use these parameter names and signatures:

```sql
public.create_document_request(
  target_matter_id uuid,
  new_title text,
  new_instructions text,
  new_due_on date
)
public.update_document_request(
  target_request_id uuid,
  new_title text,
  new_instructions text,
  new_due_on date
)
```

Both functions return this stable table shape:

```sql
returns table (
  request_id uuid,
  request_status public.document_request_status,
  request_updated_at timestamptz
)
```

Inside each function set `actor_id := (select auth.uid())`, reject null identity with SQLSTATE
`42501`, normalize title with `btrim(new_title)` and optional instruction with
`nullif(btrim(new_instructions), '')`, then enforce title 1–240 and instruction at most 2000.

Creation requires `(select private.can_manage_matter(target_matter_id))`, inserts
`created_by = actor_id`, and returns the inserted id/status/updated timestamp.

Update must execute this sequence in the same transaction:

1. `select matter_id, status ... for update` by `target_request_id`; missing row raises
   `request_not_found`.
2. Require `private.can_manage_matter(locked_matter_id)`.
3. Require status `requested`; otherwise raise `request_state_changed`.
4. Reject when an active linked row exists:

```sql
if exists (
  select 1 from public.documents as document
  where document.request_id = target_request_id
    and document.status <> 'archived'
) then
  raise exception 'request_state_changed';
end if;
```

5. Compare nullable instruction/date with `is not distinct from`. If normalized
   title/instruction/date equal the stored values, return the current row without writing an
   event. Otherwise update only those three fields and return the new timestamp.

Creation records:

```sql
perform private.record_document_request_activity(
  created_request_id,
  'document_request.created',
  'Запрошены документы.',
  actor_id
);
```

Restricted metadata update records only technical audit:

```sql
perform private.record_document_request_activity(
  target_request_id,
  'document_request.updated',
  null,
  actor_id
);
```

- [ ] **Step 6: Add atomic linked-file registration**

Implement this exact public signature:

```sql
create or replace function public.register_document_request_file(
  target_request_id uuid,
  new_document_id uuid,
  new_storage_path text,
  new_original_name text,
  new_mime_type text,
  new_size_bytes bigint
)
returns table (
  document_id uuid,
  request_id uuid,
  document_status public.document_status
)
language plpgsql
security definer
set search_path = ''
```

The body must execute in this order:

1. Require `actor_id := (select auth.uid())`.
2. Lock the request row `for update` and load `matter_id` and status.
3. Require `private.is_matter_client(matter_id)`; do not rely on Storage policy as the role
   check.
4. Normalize original name and MIME with `btrim`/`lower`, require size from 1 through
   `10485760`, name 1–255 and MIME 1–160, and reject `/`, `\` or POSIX control characters
   in the original name. Then require one of these exact path/MIME pairs:

```sql
(normalized_mime = 'application/pdf'
  and new_storage_path = locked_matter_id::text || '/' || new_document_id::text || '/document.pdf')
or (normalized_mime = 'application/msword'
  and new_storage_path = locked_matter_id::text || '/' || new_document_id::text || '/document.doc')
or (normalized_mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  and new_storage_path = locked_matter_id::text || '/' || new_document_id::text || '/document.docx')
or (normalized_mime = 'image/jpeg'
  and new_storage_path in (
    locked_matter_id::text || '/' || new_document_id::text || '/document.jpg',
    locked_matter_id::text || '/' || new_document_id::text || '/document.jpeg'
  ))
or (normalized_mime = 'image/png'
  and new_storage_path = locked_matter_id::text || '/' || new_document_id::text || '/document.png')
```

5. Require an exact row in `storage.objects` with bucket `matter-documents`, the same path,
   `owner_id::text = actor_id::text`, `metadata ->> 'size' = new_size_bytes::text`, and
   `lower(metadata ->> 'mimetype') = normalized_mime`.
6. Query `public.documents` by `new_document_id`. If it already has the same request, matter,
   path, normalized name, MIME, size and uploader, return it without checking mutable state,
   counting the limit or inserting an event. A different existing row raises
   `document_registration_conflict`.
7. For a new row require request status in `requested`, `changes_requested`; otherwise raise
   `request_state_changed`.
8. Serialize the limit with:

```sql
perform pg_advisory_xact_lock(hashtextextended(target_request_id::text, 0));
```

9. Count non-archived linked documents; `>= 20` raises `request_file_limit`.
10. Insert one `public.documents` row with `request_id = target_request_id` and
    `uploaded_by = actor_id`; the existing document trigger records `document.created`.

- [ ] **Step 7: Add submit, review, cancel, and withdraw RPCs**

Use these exact signatures:

```sql
public.submit_document_request(target_request_id uuid)
public.review_document_request(
  target_request_id uuid,
  new_decision public.document_request_status,
  new_note text
)
public.cancel_document_request(target_request_id uuid)
public.withdraw_document_request_file(
  target_request_id uuid,
  target_document_id uuid
)
```

`submit_document_request`, `review_document_request`, and `cancel_document_request` return:

```sql
returns table (
  request_id uuid,
  request_status public.document_request_status,
  request_updated_at timestamptz
)
```

`withdraw_document_request_file` returns:

```sql
returns table (
  request_id uuid,
  request_status public.document_request_status,
  document_id uuid,
  document_status public.document_status,
  request_updated_at timestamptz
)
```

For each function, lock the request `for update`, authenticate and recheck the role. Check an
identical already-applied result before the ordinary source-state guard so a lost successful
response can be retried safely. Compare nullable notes with `is not distinct from`. Apply
these exact rules:

- submit: client only; `requested|changes_requested -> submitted`; count active files again,
  require 1–20, and raise `request_file_required`/`request_file_limit` outside that range;
  set `submitted_at = now()`; identical `submitted` retry returns current row; event text
  `Комплект документов отправлен на проверку.`;
- review: manager only; decision only `accepted|changes_requested`; require current
  `submitted`; require non-empty note for changes; set reviewer/time; accepted sets active
  linked documents to `ready`; identical decision with the same normalized note returns;
- cancel: manager only; allow `requested|submitted|changes_requested`; `accepted` raises
  `request_state_changed`; set reviewer/time; `cancelled` retry returns; event text
  `Запрос документов отменён.`;
- withdraw: client uploader only; request only `requested|changes_requested`; set one linked
  non-archived document to `archived`; record technical action
  `document_request.file_withdrawn` with null public text. If that same uploader retries the
  same request/document after it is already archived, return the archived row without a
  second audit record.

Use these privacy-safe review events:

```sql
case new_decision
  when 'accepted' then 'document_request.accepted'
  else 'document_request.changes_requested'
end
```

```sql
case new_decision
  when 'accepted' then 'Комплект документов принят.'
  else 'Комплект документов возвращён на исправление.'
end
```

- [ ] **Step 8: Revoke and grant every RPC explicitly**

Add this complete privilege block after all definitions:

```sql
revoke all on function public.create_document_request(uuid, text, text, date)
from public, anon, authenticated;
grant execute on function public.create_document_request(uuid, text, text, date)
to authenticated;

revoke all on function public.update_document_request(uuid, text, text, date)
from public, anon, authenticated;
grant execute on function public.update_document_request(uuid, text, text, date)
to authenticated;

revoke all on function public.register_document_request_file(uuid, uuid, text, text, text, bigint)
from public, anon, authenticated;
grant execute on function public.register_document_request_file(uuid, uuid, text, text, text, bigint)
to authenticated;

revoke all on function public.submit_document_request(uuid)
from public, anon, authenticated;
grant execute on function public.submit_document_request(uuid)
to authenticated;

revoke all on function public.review_document_request(uuid, public.document_request_status, text)
from public, anon, authenticated;
grant execute on function public.review_document_request(uuid, public.document_request_status, text)
to authenticated;

revoke all on function public.cancel_document_request(uuid)
from public, anon, authenticated;
grant execute on function public.cancel_document_request(uuid)
to authenticated;

revoke all on function public.withdraw_document_request_file(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.withdraw_document_request_file(uuid, uuid)
to authenticated;

comment on function public.create_document_request(uuid, text, text, date)
is 'Creates a document request after checking matter-management access.';
comment on function public.update_document_request(uuid, text, text, date)
is 'Updates untouched requested-state metadata after checking management access.';
comment on function public.register_document_request_file(uuid, uuid, text, text, text, bigint)
is 'Registers an owned Storage object in an editable document request.';
comment on function public.submit_document_request(uuid)
is 'Submits an editable client document request for staff review.';
comment on function public.review_document_request(uuid, public.document_request_status, text)
is 'Accepts or returns a submitted document request after checking management access.';
comment on function public.cancel_document_request(uuid)
is 'Cancels a non-terminal document request after checking management access.';
comment on function public.withdraw_document_request_file(uuid, uuid)
is 'Soft-archives a client-owned file while its request is editable.';
```

Do not grant the private predicate or activity writer.

- [ ] **Step 9: Run the migration contract and existing permission tests**

Run:

```powershell
npm.cmd test -- tests/document-request-migration.test.mjs tests/supabase-rls-permissions.test.mjs tests/staff-workflow.test.mjs
git diff --check
```

Expected: PASS.

- [ ] **Step 10: Commit the additive database boundary**

```powershell
git add supabase/migrations/20260830140000_add_document_requests.sql tests/document-request-migration.test.mjs
git commit -m "feat: add secure document request schema"
```

### Task 3: Server actions and idempotent request-file registration

**Files:**

- Create: `features/document-requests/document-request-actions.js`
- Create: `tests/document-request-actions.test.mjs`
- Modify: `features/cabinet/cabinet-write-domain.mjs:111-151`
- Modify: `features/cabinet/cabinet-actions.js:31-88`
- Modify: `tests/cabinet-write-domain.test.mjs`

**Interfaces:**

- Consumes: Task 1 validators/error translator and Task 2 RPCs.
- Produces: `createDocumentRequest`, `updateDocumentRequest`, `submitDocumentRequest`, `reviewDocumentRequest`, `cancelDocumentRequest`, `withdrawDocumentRequestFile`; `registerMatterDocument(input)` accepts `requestId?: uuid`.

- [ ] **Step 1: Write failing action and registration tests**

Create `tests/document-request-actions.test.mjs` as a source-contract test and extend the
existing domain test:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [requestActions, cabinetActions] = await Promise.all([
  readFile(new URL("../features/document-requests/document-request-actions.js", import.meta.url), "utf8"),
  readFile(new URL("../features/cabinet/cabinet-actions.js", import.meta.url), "utf8"),
]);

test("document request actions validate, authenticate, call narrow RPCs, and revalidate both views", () => {
  for (const action of ["createDocumentRequest", "updateDocumentRequest", "submitDocumentRequest", "reviewDocumentRequest", "cancelDocumentRequest", "withdrawDocumentRequestFile"]) {
    assert.match(requestActions, new RegExp(`export async function ${action}`));
  }
  assert.match(requestActions, /auth\.getClaims\(\)/);
  assert.match(requestActions, /if \(!userId\)[\s\S]*SESSION_ERROR/);
  assert.match(requestActions, /\.rpc\("create_document_request"/);
  assert.match(requestActions, /\.rpc\("update_document_request"/);
  assert.match(requestActions, /\.rpc\("submit_document_request"/);
  assert.match(requestActions, /\.rpc\("review_document_request"/);
  assert.match(requestActions, /\.rpc\("cancel_document_request"/);
  assert.match(requestActions, /\.rpc\("withdraw_document_request_file"/);
  assert.match(requestActions, /revalidatePath\("\/cabinet"\)/);
  assert.match(requestActions, /revalidatePath\("\/staff"\)/);
  assert.match(requestActions, /data:\s*\{\s*requestId:/);
  assert.doesNotMatch(requestActions, /service_role|SUPABASE_SERVICE|lastReviewNote.*console|title.*console/i);
});

test("linked document registration uses the request RPC and preserves ordinary inserts", () => {
  assert.match(cabinetActions, /document\.requestId[\s\S]*\.rpc\("register_document_request_file"/);
  assert.match(cabinetActions, /requestId[^\n]+null[\s\S]*from\("documents"\)\.insert/);
  assert.match(cabinetActions, /getDocumentRequestErrorMessage/);
  assert.match(cabinetActions, /revalidatePath\("\/staff"\)/);
  assert.doesNotMatch(cabinetActions, /service_role|SUPABASE_SERVICE/);
});
```

Add to `tests/cabinet-write-domain.test.mjs`:

```js
test("document registration accepts only an optional UUID request link", () => {
  const linked = validateDocumentRegistration({
    id: DOCUMENT_ID,
    matterId: MATTER_ID,
    requestId: "44444444-4444-4444-8444-444444444444",
    storagePath: `${MATTER_ID}/${DOCUMENT_ID}/document.pdf`,
    originalName: "Договор.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1024,
  });
  assert.equal(linked.valid, true);
  assert.equal(linked.value.requestId, "44444444-4444-4444-8444-444444444444");
  assert.equal(validateDocumentRegistration({ ...linked.value, requestId: "bad" }).valid, false);
});
```

- [ ] **Step 2: Run tests and verify they fail for missing actions/request link**

```powershell
npm.cmd test -- tests/document-request-actions.test.mjs tests/cabinet-write-domain.test.mjs
```

Expected: FAIL because the actions file and `requestId` behavior do not exist.

- [ ] **Step 3: Extend validated document registration**

In `validateDocumentRegistration`, normalize absent request to `null`, reject a non-UUID,
and include `requestId` in the returned `value`:

```js
const requestId = input.requestId === undefined || input.requestId === null || input.requestId === ""
  ? null
  : input.requestId;
if (requestId !== null && !isUuid(requestId)) {
  return invalid("Некорректный запрос документов.");
}

return {
  valid: true,
  value: {
    id: input.id,
    matterId: input.matterId,
    requestId,
    storagePath: expectedStoragePath,
    originalName: upload.originalName,
    mimeType: upload.mimeType,
    sizeBytes: upload.sizeBytes,
  },
  error: "",
};
```

- [ ] **Step 4: Route linked registration through the RPC**

Import `getDocumentRequestErrorMessage` from the new domain module. Keep the existing Storage
verification first. Replace only the database-write branch:

```js
const writeResult = document.requestId
  ? await supabase
    .rpc("register_document_request_file", {
      target_request_id: document.requestId,
      new_document_id: document.id,
      new_storage_path: document.storagePath,
      new_original_name: document.originalName,
      new_mime_type: document.mimeType,
      new_size_bytes: document.sizeBytes,
    })
    .single()
  : await supabase.from("documents").insert({
    id: document.id,
    matter_id: document.matterId,
    request_id: null,
    storage_path: document.storagePath,
    original_name: document.originalName,
    mime_type: document.mimeType,
    size_bytes: document.sizeBytes,
    uploaded_by: userId,
  });
```

Translate linked-RPC errors with `getDocumentRequestErrorMessage`; keep the ordinary
document fallback unchanged. On success revalidate both protected routes and return
`Документ добавлен к запросу.` for a linked file.

- [ ] **Step 5: Implement the six server actions**

Create `features/document-requests/document-request-actions.js` with one authenticated
helper and one RPC helper. The helper must not log input values:

```js
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../../lib/supabase/server";
import {
  getDocumentRequestErrorMessage,
  validateCancelDocumentRequest,
  validateCreateDocumentRequest,
  validateReviewDocumentRequest,
  validateSubmitDocumentRequest,
  validateUpdateDocumentRequest,
  validateWithdrawDocumentRequestFile,
} from "./document-request-domain.mjs";

const SESSION_ERROR = "Сессия истекла. Войдите повторно.";

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  return { supabase, userId: error ? null : data?.claims?.sub || null };
}

function refreshProtectedViews() {
  revalidatePath("/cabinet");
  revalidatePath("/staff");
}
```

Each exported action validates before authentication, calls exactly one Task 2 RPC with the
following normalized argument object, and uses `.single()`:

| Action | RPC arguments |
| --- | --- |
| create | `{ target_matter_id: value.matterId, new_title: value.title, new_instructions: value.instructions, new_due_on: value.dueOn }` |
| update | `{ target_request_id: value.requestId, new_title: value.title, new_instructions: value.instructions, new_due_on: value.dueOn }` |
| submit | `{ target_request_id: value.requestId }` |
| review | `{ target_request_id: value.requestId, new_decision: value.decision, new_note: value.note }` |
| cancel | `{ target_request_id: value.requestId }` |
| withdraw | `{ target_request_id: value.requestId, target_document_id: value.documentId }` |

Require `data.request_id`; on success call `refreshProtectedViews()` and return:

```js
{
  ok: true,
  message: successMessage,
  data: {
    requestId: data.request_id,
    status: data.request_status,
    updatedAt: data.request_updated_at,
    ...(data.document_id ? {
      documentId: data.document_id,
      documentStatus: data.document_status,
    } : {}),
  },
}
```

Validation/session/RPC failures return only `{ ok: false, message }`. Log only
`{ code: error?.code, status: error?.status }`, never revalidate after failure, and use these
success messages:

- create: `Запрос документов создан.`
- update: `Запрос документов обновлён.`
- submit: `Комплект отправлен на проверку.`
- accepted review: `Комплект принят.`
- changes review: `Комплект возвращён на исправление.`
- cancel: `Запрос документов отменён.`
- withdraw: `Файл отозван из комплекта.`

- [ ] **Step 6: Run action/domain regressions**

```powershell
npm.cmd test -- tests/document-request-actions.test.mjs tests/cabinet-write-domain.test.mjs tests/cabinet.test.mjs
git diff --check
```

Expected: PASS.

- [ ] **Step 7: Commit the server boundary**

```powershell
git add features/document-requests/document-request-actions.js features/cabinet/cabinet-write-domain.mjs features/cabinet/cabinet-actions.js tests/document-request-actions.test.mjs tests/cabinet-write-domain.test.mjs
git commit -m "feat: add document request server actions"
```

### Task 4: Build the RLS-filtered read model and safe notifications

**Files:**

- Modify: `features/cabinet/cabinet-server.js:1-226`
- Modify: `features/notifications/notification-domain.mjs:1-55`
- Modify: `features/staff/staff-domain.mjs:59-75`
- Modify: `tests/cabinet-server.test.mjs`
- Modify: `tests/notification-domain.test.mjs`
- Modify: `tests/staff-cabinet.test.mjs`

**Interfaces:**

- Consumes: Task 1 `mapDocumentRequest` and `getClientPrimaryDocumentRequest`.
- Produces: every matter has `documentRequests`, `clientPrimaryDocumentRequest`, `hasSubmittedDocumentRequest`; documents expose `requestId` and `statusValue`.

- [ ] **Step 1: Extend fixture tests before the loader**

Add `document_requests` to `createSupabaseFixture` in `tests/cabinet-server.test.mjs` and add
`request_id` to the linked document. Assert:

```js
assert.equal(matters[0].documentRequests.length, 1);
assert.equal(matters[0].documentRequests[0].documents[0].name, "Договор.pdf");
assert.equal(matters[0].clientPrimaryDocumentRequest.id, "c1111111-1111-4111-8111-111111111111");
assert.equal(matters[0].hasSubmittedDocumentRequest, false);
assert.deepEqual(supabase.requestedMatterIds.get("document_requests"), [MATTER_ID]);
assert.doesNotMatch(JSON.stringify(matters[0].notifications), /Договор и приложения|Договор\.pdf|Исправьте/);
```

Add notification cases:

```js
test("document request notifications use fixed generic copy", () => {
  const notification = createSafeNotification({
    id: "event-1",
    matterId: MATTER_ID,
    type: "document_request.changes_requested",
    createdAt: "2026-08-30T05:00:00.000Z",
    title: "Паспорт",
    note: "Исправьте страницу",
  });
  assert.equal(notification.title, "Комплект нужно уточнить");
  assert.equal(notification.targetView, "documents");
  assert.doesNotMatch(JSON.stringify(notification), /Паспорт|Исправьте/);
});
```

Extend the staff queue fixture so `submitted` maps to `action`, while `requested` and
`changes_requested` map to `waiting`.

- [ ] **Step 2: Run read-model tests and verify the red state**

```powershell
npm.cmd test -- tests/cabinet-server.test.mjs tests/notification-domain.test.mjs tests/staff-cabinet.test.mjs
```

Expected: FAIL because the loader and queue ignore requests.

- [ ] **Step 3: Load and map requests once per protected page**

In `loadCabinetData`:

1. Query `document_requests` alongside stages/events/documents/messages using:

```js
supabase
  .from("document_requests")
  .select("id,matter_id,title,instructions,due_on,status,last_review_note,submitted_at,reviewed_at,created_at,updated_at")
  .in("matter_id", matterIds)
  .order("created_at", { ascending: false })
```

2. Add `request_id` to the document select and map each document to:

```js
{
  id: document.id,
  requestId: document.request_id || null,
  name: document.original_name,
  storagePath: document.storage_path,
  mimeType: document.mime_type,
  sizeBytes: document.size_bytes,
  statusValue: document.status,
  status: DOCUMENT_STATUS_LABELS[document.status] || "Получен",
  updatedAt: document.updated_at,
  updated: DATE_FORMATTER.format(new Date(document.updated_at)),
}
```

3. Map request rows with the already mapped matter documents, then return:

```js
documentRequests,
clientPrimaryDocumentRequest: getClientPrimaryDocumentRequest(documentRequests),
hasSubmittedDocumentRequest: documentRequests.some((request) => request.awaitingStaff),
```

4. Treat any request query error like the existing detail query errors without appending
provider text.

- [ ] **Step 4: Extend the notification allowlist and event mapping**

Add fixed entries to `NOTIFICATION_COPY`:

```js
"document_request.created": {
  title: "Запрошены документы",
  description: "В кабинете появился новый запрос документов.",
  targetView: "documents",
},
"document_request.submitted": {
  title: "Комплект отправлен",
  description: "Комплект документов передан на проверку.",
  targetView: "documents",
},
"document_request.changes_requested": {
  title: "Комплект нужно уточнить",
  description: "По комплекту документов появилось замечание.",
  targetView: "documents",
},
"document_request.accepted": {
  title: "Комплект принят",
  description: "Проверка комплекта документов завершена.",
  targetView: "documents",
},
"document_request.cancelled": {
  title: "Запрос отменён",
  description: "Запрос документов больше не требует действий.",
  targetView: "documents",
},
```

Add this local helper and use it for the existing `matterEvents` notification branch. Never
pass `public_text` to the notification constructor:

```js
function createEventNotification(event, matterId) {
  const input = {
    id: event.id,
    matterId,
    type: event.event_type,
    createdAt: event.created_at,
  };
  return createSafeNotification(input) ?? createSafeNotification({
    ...input,
    type: "matter.event.created",
  });
}
```

- [ ] **Step 5: Make the staff queue request-aware**

Insert after archive/paused handling in `getStaffMatterQueue`:

```js
const requests = Array.isArray(matter.documentRequests) ? matter.documentRequests : [];
if (requests.some((request) => request.status === "submitted")) return "action";
if (requests.some((request) => request.status === "requested" || request.status === "changes_requested")) return "waiting";
```

Then retain the existing `nextAction` fallback.

- [ ] **Step 6: Run focused tests and commit**

```powershell
npm.cmd test -- tests/cabinet-server.test.mjs tests/notification-domain.test.mjs tests/staff-cabinet.test.mjs
git diff --check
git add features/cabinet/cabinet-server.js features/notifications/notification-domain.mjs features/staff/staff-domain.mjs tests/cabinet-server.test.mjs tests/notification-domain.test.mjs tests/staff-cabinet.test.mjs
git commit -m "feat: expose safe document request read model"
```

### Task 5: Add the client document-request experience

**Files:**

- Create: `features/document-requests/client-document-requests.jsx`
- Create: `features/document-requests/document-requests.module.css`
- Create: `tests/document-request-ui.test.mjs`
- Modify: `features/cabinet/cabinet-client.jsx:94-347,454-742`
- Modify: `features/cabinet/cabinet.module.css:1089-1640`
- Modify: `tests/cabinet.test.mjs`

**Interfaces:**

- Consumes: `matterId`, mapped requests, existing document download callback, Task 3 actions and cabinet upload helpers.
- Produces: default component `ClientDocumentRequests({ matterId, requests, mode, downloadingId, downloadFeedback, onDownload })`.

- [ ] **Step 1: Write the failing client UI contract**

Create `tests/document-request-ui.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the UI test and verify the red state**

```powershell
npm.cmd test -- tests/document-request-ui.test.mjs
```

Expected: FAIL because client component and CSS do not exist.

- [ ] **Step 3: Implement the client request component**

Create a client component with this public signature and state boundary:

```jsx
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createUuidV4 } from "../../lib/submission-id.mjs";
import { registerMatterDocument } from "../cabinet/cabinet-actions";
import {
  DOCUMENT_BUCKET,
  buildDocumentStoragePath,
  validateDocumentUpload,
} from "../cabinet/cabinet-write-domain.mjs";
import {
  submitDocumentRequest,
  withdrawDocumentRequestFile,
} from "./document-request-actions";
import styles from "./document-requests.module.css";

export default function ClientDocumentRequests({
  matterId,
  requests = [],
  mode = "full",
  downloadingId = null,
  downloadFeedback = { tone: "neutral", text: "" },
  onDownload,
}) {
  const router = useRouter();
  const statusRef = useRef(null);
  const cardRefs = useRef(new Map());
  const [busyKey, setBusyKey] = useState("");
  const [feedback, setFeedback] = useState({ tone: "neutral", text: "" });
  const [pendingRegistration, setPendingRegistration] = useState(null);
```

Implement these concrete behaviors:

- `mode="overview"` renders the single request passed by `OverviewView`; this is the
  precomputed `clientPrimaryDocumentRequest`, or the newest `submitted` request when no
  client action is required. A submitted request renders `Комплект находится на проверке`
  without upload.
- Full mode renders non-cancelled requests first, then cancelled requests collapsed in a
  quiet list.
- Every card shows the text status, active-file count and, when present, a semantic
  `<time dateTime={request.dueOn}>` deadline formatted with the existing Russian locale.
- File change validates one file, creates a stable UUID, uploads to the existing bucket,
  obtains the browser Supabase client through the existing dynamic
  `import("../../lib/supabase/browser")` pattern,
  calls `registerMatterDocument` with `requestId`, keeps the complete registration payload
  in `pendingRegistration` if the RPC response is lost or fails, and renders a separate
  `Повторить регистрацию` button that reuses the same UUID without a second Storage upload.
- Submit calls `submitDocumentRequest({ requestId })`; withdraw calls
  `withdrawDocumentRequestFile({ requestId, documentId })` only for active files in
  `requested|changes_requested`.
- `Отозвать файл` first opens inline `Подтвердить отзыв`/`Оставить файл` controls; do not use
  a browser modal or archive on the first click.
- The file input uses the existing PDF/DOC/DOCX/JPG/PNG `accept` list, is unavailable at 20
  active files, and explains `Не более 20 файлов`. Submit is disabled until at least one
  active file is registered.
- Every mutation disables only the current request and reports through one `aria-live`
  region. Give the feedback node and each request card `tabIndex={-1}`. On failure, focus
  `statusRef` with `preventScroll: true`; on success, call `router.refresh()` and use
  `requestAnimationFrame` to focus `cardRefs.current.get(requestId)` so focus stays on the
  updated card.
- Accepted/cancelled cards contain no file input or mutation button.
- Display `lastReviewNote` only for `changes_requested` and submitted-after-correction;
  hide it for accepted/cancelled.
- A download click clears local mutation feedback, calls the existing `onDownload`, and lets
  the same live region render `downloadFeedback` until a new local mutation message exists.

- [ ] **Step 4: Integrate overview and document views**

Import `ClientDocumentRequests` into `cabinet-client.jsx`.

In `OverviewView`, render the request module instead of `UploadControl` only while one
request requires client action or is awaiting staff. This preserves the existing general
next action after all requests become accepted/cancelled:

```jsx
{matter.clientPrimaryDocumentRequest || matter.hasSubmittedDocumentRequest ? (
  <ClientDocumentRequests
    matterId={matter.id}
    requests={matter.clientPrimaryDocumentRequest
      ? [matter.clientPrimaryDocumentRequest]
      : matter.documentRequests.filter((request) => request.status === "submitted").slice(0, 1)}
    mode="overview"
    downloadingId={downloadingId}
    downloadFeedback={documentFeedback}
    onDownload={onDownload}
  />
) : (
  <UploadControl
    matter={matter}
    feedback={uploadFeedback}
    isUploading={isUploading}
    onFileChange={onFileChange}
    onOpenDocuments={() => onNavigate("documents", matter.id)}
  />
)}
```

In `DocumentsView`, render a heading `Запрошено` plus full requests, then a heading
`Другие документы`, the existing `DocumentRegister` with
`documents={matter.documents.filter((document) => document.requestId === null)}`, and the
existing generic upload panel. Extend `DocumentRegister` with an optional `emptyText` prop and
pass `Других документов пока нет.` in this block so the empty state stays accurate. Do not
remove or rename the `documents` cabinet view. Pass `documentFeedback`, `downloadingId` and
`onDownload` into the full request component exactly as in the overview integration.

- [ ] **Step 5: Add scoped responsive styles**

In `document-requests.module.css`, define `.list`, `.card`, `.status`, `.fileList`, `.actions`,
`.primaryButton`, `.secondaryButton`, `.feedback`, `.feedbackError`, `.quietCard`. Use existing
color custom properties, `overflow-wrap: anywhere`, 44px minimum action height, visible
`:focus-visible`, `white-space: pre-wrap` for instructions/review notes, one-column layout at
680px, and `prefers-reduced-motion: reduce`.

In `cabinet.module.css`, adjust only the existing overview/documents grid gaps so the new
component occupies the same aside width and no child can force `min-width` above zero.

- [ ] **Step 6: Run focused UI and regression tests**

```powershell
npm.cmd test -- tests/document-request-ui.test.mjs tests/cabinet.test.mjs tests/mobile-layout.test.mjs tests/accessibility-polish.test.mjs
git diff --check
```

Expected: PASS.

- [ ] **Step 7: Commit the client experience**

```powershell
git add features/document-requests/client-document-requests.jsx features/document-requests/document-requests.module.css features/cabinet/cabinet-client.jsx features/cabinet/cabinet.module.css tests/document-request-ui.test.mjs tests/cabinet.test.mjs
git commit -m "feat: guide clients through document requests"
```

### Task 6: Add the staff request and review experience

**Files:**

- Create: `features/document-requests/staff-document-requests.jsx`
- Modify: `features/staff/staff-client.jsx:1-90,200-453,536-920`
- Modify: `features/staff/staff.module.css:525-700,1745-1995`
- Modify: `tests/document-request-ui.test.mjs`
- Modify: `tests/staff-cabinet.test.mjs`

**Interfaces:**

- Consumes: mapped `matter.documentRequests`, Task 3 actions, existing document download callback.
- Produces: default component `StaffDocumentRequests({ matter, downloadingId, downloadFeedback, onDownload })`.

- [ ] **Step 1: Extend UI tests for staff commands and privacy**

Add to `tests/document-request-ui.test.mjs` after the staff file exists:

```js
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
```

Add to `tests/staff-cabinet.test.mjs`:

```js
assert.match(clientSource, /StaffDocumentRequests/);
assert.match(clientSource, /document_request\.created/);
assert.match(clientSource, /document_request\.accepted/);
assert.match(clientSource, /Другие документы/);
assert.match(clientSource, /requestId === null/);
assert.doesNotMatch(clientSource, /lastReviewNote.*AUDIT_COPY|originalName.*AUDIT_COPY/);
```

- [ ] **Step 2: Run tests and verify the staff red state**

```powershell
npm.cmd test -- tests/document-request-ui.test.mjs tests/staff-cabinet.test.mjs
```

Expected: FAIL because the staff component is missing.

- [ ] **Step 3: Implement the staff component**

Create `staff-document-requests.jsx` as a client component. Import all staff actions from
`document-request-actions.js`, `useRouter`, and the shared CSS module. Use this public shape:

```jsx
export default function StaffDocumentRequests({
  matter,
  downloadingId = null,
  downloadFeedback = { tone: "neutral", text: "" },
  onDownload,
})
```

The component must:

- render an inline `Запросить документы` form with explicit labels, required title
  `maxLength={240}`, instruction `maxLength={2000}`, and optional `type="date"`;
- edit an existing request only when `status === "requested"` and
  `activeDocumentCount === 0`;
- render files through the existing `onDownload` callback, never by a public URL;
- route the existing `documentFeedback` through the component's single live status region so
  a linked-file download error is announced beside that request;
- show `dueOn` as a semantic `<time>` value and the active-file count on every request card;
- show review controls only for `submitted`;
- require a textarea before the changes decision and pass `{ requestId, decision:
  "changes_requested", note }`;
- pass `{ requestId, decision: "accepted", note: null }` for acceptance;
- require an inline `Подтвердить принятие` step before sending the irreversible accepted
  decision;
- allow cancel only for `requested|submitted|changes_requested`;
- make cancellation a two-step inline `Отменить запрос` → `Подтвердить отмену`/`Оставить`
  interaction so a single accidental click cannot close the request;
- keep independent pending state per request, render `role="status" aria-live="polite"`,
  make status/cards programmatically focusable, focus the status on failure, refresh on
  success and return focus to the affected card;
- never display `lastReviewNote` in the audit summary or global queue row.

- [ ] **Step 4: Mount the module in `MatterDetail`**

Import `StaffDocumentRequests` and add it between the existing next-action panel and workflow
form:

```jsx
<StaffDocumentRequests
  matter={matter}
  downloadingId={downloadingId}
  downloadFeedback={documentFeedback}
  onDownload={onDownload}
/>
```

Extend `AUDIT_COPY` with generic labels for created, updated, submitted, changes requested,
accepted, cancelled, and file withdrawn. Descriptions must not interpolate event data.
Update `getMatterTask` so a submitted request returns `Проверить комплект документов`, and
a requested/changes request returns `Ожидаем документы от клиента` before the generic
`nextAction` fallback.

In `MatterDetail`, derive
`const otherDocuments = matter.documents.filter((document) => document.requestId === null)`.
Rename the existing generic section heading to `Другие документы`, use this filtered array
for its count/list, and render `Других документов пока нет.` when empty. Linked documents
remain visible exactly once inside `StaffDocumentRequests`.

- [ ] **Step 5: Integrate staff responsive styles**

Make the shared request card match the staff detail width. In `staff.module.css`, set
`min-width: 0` for the wrapper, preserve the existing 12/13px control typography variables,
and stack actions at 680px without reducing the 44px touch target.

- [ ] **Step 6: Run staff, UI, and notification regressions**

```powershell
npm.cmd test -- tests/document-request-ui.test.mjs tests/staff-cabinet.test.mjs tests/notification-ui.test.mjs tests/accessibility-polish.test.mjs
git diff --check
```

Expected: PASS.

- [ ] **Step 7: Commit the staff experience**

```powershell
git add features/document-requests/staff-document-requests.jsx features/document-requests/document-requests.module.css features/staff/staff-client.jsx features/staff/staff.module.css tests/document-request-ui.test.mjs tests/staff-cabinet.test.mjs
git commit -m "feat: let staff request and review document sets"
```

### Task 7: Add transactional isolation tests and operational documentation

**Files:**

- Create: `supabase/tests/document-requests-smoke.sql`
- Create: `docs/decisions/0006-managed-document-requests.md`
- Modify: `scripts/supabase-rls-smoke.mjs:20-38`
- Modify: `tests/supabase-rls-smoke.test.mjs`
- Modify: `docs/supabase-e2e.md`
- Modify: `docs/cabinet-mvp.md`

**Interfaces:**

- Consumes: Task 2 migration and the current transaction-based SQL test convention.
- Produces: a fifth isolated SQL scenario and read-only live visibility check for `document_requests`.

- [ ] **Step 1: Add failing static smoke assertions**

Append to `tests/supabase-rls-smoke.test.mjs`:

```js
test("document request SQL smoke is transactional and covers role transitions", async () => {
  const source = await readFile(
    new URL("../supabase/tests/document-requests-smoke.sql", import.meta.url),
    "utf8",
  );
  assert.match(source, /^begin;/m);
  assert.match(source, /^rollback;/m);
  assert.doesNotMatch(source, /^commit;/m);
  assert.match(source, /client_a:read-own/);
  assert.match(source, /client_a:read-client_b-denied/);
  assert.match(source, /client_b:register-client_a-denied/);
  assert.match(source, /lawyer:create/);
  assert.match(source, /client_a:submit/);
  assert.match(source, /lawyer:return-with-note/);
  assert.match(source, /admin:accept/);
  assert.match(source, /client_a:direct-write-denied/);
  assert.match(source, /database:documents-ready/);
  assert.match(source, /database:events-generic/);
  assert.match(source, /rollback;[\s\S]*'persistent_rows'/);
  assert.match(source, /document_requests[\s\S]*storage\.objects/);
  assert.doesNotMatch(source, /service_role|@|real client/i);
});
```

Also assert that the read-only `RESOURCES` contains:

```js
{ table: "document_requests", idColumn: "matter_id", select: "matter_id" }
```

- [ ] **Step 2: Run the smoke test contract and verify the red state**

```powershell
npm.cmd test -- tests/supabase-rls-smoke.test.mjs
```

Expected: FAIL because the SQL file/resource is absent.

- [ ] **Step 3: Write the transactional SQL scenario**

Create `supabase/tests/document-requests-smoke.sql` using the same role-switching convention as
`staff-assignment-smoke.sql`. Begin with:

```sql
begin;
set local statement_timeout = '30s';

create temporary table document_request_results (
  category text not null check (category in ('authorization', 'transition', 'isolation')),
  check_name text primary key,
  actual bigint not null,
  expected bigint not null
) on commit drop;

create temporary table document_request_ids (
  label text primary key,
  request_id uuid not null unique
) on commit drop;

grant select, insert on table pg_temp.document_request_results to authenticated, anon;
grant select, insert on table pg_temp.document_request_ids to authenticated, anon;
```

Use these fixed synthetic IDs so post-rollback cleanup can query exact rows:

| Entity | UUID |
| --- | --- |
| client A | `71111111-1111-4111-8111-111111111111` |
| client B | `72222222-2222-4222-8222-222222222222` |
| lawyer | `73333333-3333-4333-8333-333333333333` |
| admin | `74444444-4444-4444-8444-444444444444` |
| organization A | `7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa` |
| matter A | `7a111111-1111-4111-8111-111111111111` |
| matter B | `7b222222-2222-4222-8222-222222222222` |
| document A1 | `7d111111-1111-4111-8111-111111111111` |
| document A2 | `7d222222-2222-4222-8222-222222222222` |

Create temporary `try_*` wrappers with `set search_path = ''` and grant their exact
signatures to `authenticated, anon`:

```sql
pg_temp.try_create_document_request(uuid, text) returns uuid
pg_temp.try_count_document_requests(uuid) returns bigint
pg_temp.try_update_document_request(uuid, text) returns boolean
pg_temp.try_register_document_request_file(uuid, uuid, text) returns boolean
pg_temp.try_submit_document_request(uuid) returns boolean
pg_temp.try_review_document_request(uuid, public.document_request_status, text) returns boolean
pg_temp.try_cancel_document_request(uuid) returns boolean
pg_temp.try_withdraw_document_request_file(uuid, uuid) returns boolean
pg_temp.try_direct_document_request_insert(uuid, uuid) returns boolean
pg_temp.try_direct_linked_document_insert(uuid, uuid, uuid, text) returns boolean
```

The create wrapper returns the RPC `request_id` and returns null on
`insufficient_privilege|raise_exception|invalid_parameter_value`; boolean wrappers return
false for the same expected errors plus `unique_violation` where registration can conflict.
Do not catch any other exception.

As the migration owner, insert four `auth.users` rows with non-real labels such as
`client-a.test`, profiles, one organization, matters A/B, participants (client A and lawyer on
A; client B and lawyer on B), organization memberships for lawyer/admin, and two
`storage.objects` rows. Each object must use bucket `matter-documents`, canonical PDF path,
`owner_id = client A`, and metadata `{"size":1024,"mimetype":"application/pdf"}`.

For every actor block, execute `set local role authenticated|anon`, set
`request.jwt.claim.sub`, write named actual/expected rows, then `reset role`. Use these exact
checks:

**Authorization (12):**

1. `anonymous:read-denied` = 0;
2. `anonymous:create-denied` = 0;
3. `client_a:create-denied` = 0;
4. `lawyer:create` = 2; call the create RPC twice and save both returned IDs in
   `pg_temp.document_request_ids` as `A` and `B`;
5. `client_a:read-own` = 1;
6. `client_a:read-client_b-denied` = 0;
7. `client_b:read-client_a-denied` = 0;
8. `client_b:register-client_a-denied` = 0;
9. `client_a:direct-write-denied` = 0 for a direct `document_requests` insert;
10. `client_a:direct-linked-document-denied` = 0 for a direct `documents` insert with a
    non-null request id;
11. `lawyer:update-before-upload` = 1;
12. `lawyer:update-after-upload-denied` = 0.

**Transitions (8):**

1. `client_a:register-first` = 1;
2. `client_a:register-second` = 1;
3. `client_a:submit` = 1;
4. `lawyer:return-with-note` = 1;
5. `client_a:withdraw-second` = 1;
6. `client_a:resubmit` = 1;
7. `admin:accept` = 1;
8. `lawyer:cancel-second-request` = 1.

**Isolation/invariants (7):**

1. `client_a:submit-empty-denied` = 0 on request B before its cancellation;
2. `lawyer:return-without-note-denied` = 0;
3. `client_a:mutate-submitted-denied` = 0;
4. `client_a:registration-retry-after-submit` = 1 when the exact stable UUID/path/metadata
   registration is replayed after submission; the document row count must remain unchanged;
5. `database:documents-ready` = 1 active ready document after the second was archived;
6. `database:events-generic` = 1 when no request title, instruction, review note or original
   filename occurs in `matter_events.public_text`;
7. `database:terminal-immutable` = 0 for the combined successful-attempt count: try
   update/review/cancel after acceptance and try submit/register/update after cancellation.

Before rollback, aggregate mismatches exactly like the existing smoke tests and raise one
`Document request smoke failed: ...` exception if any row differs. Also assert no request or
file text occurs in `audit_events.action`/`entity_type` and all created audit rows use only the
synthetic organization/matter/entity UUIDs. Fail unless category counts are exactly 12
authorization, 8 transition and 7 isolation rows; this prevents the final JSON counters from
claiming checks that were omitted.

End the transaction, then calculate cleanup from the real tables instead of hard-coding it:

```sql
rollback;

select json_build_object(
  'passed', true,
  'authorization_checks', 12,
  'transition_checks', 8,
  'isolation_checks', 7,
  'persistent_rows',
    (select count(*) from public.document_requests where matter_id in (
      '7a111111-1111-4111-8111-111111111111',
      '7b222222-2222-4222-8222-222222222222'
    ))
    + (select count(*) from public.documents where matter_id in (
      '7a111111-1111-4111-8111-111111111111',
      '7b222222-2222-4222-8222-222222222222'
    ))
    + (select count(*) from public.matter_events where matter_id in (
      '7a111111-1111-4111-8111-111111111111',
      '7b222222-2222-4222-8222-222222222222'
    ))
    + (select count(*) from public.audit_events where matter_id in (
      '7a111111-1111-4111-8111-111111111111',
      '7b222222-2222-4222-8222-222222222222'
    ))
    + (select count(*) from storage.objects where name like '7a111111-1111-4111-8111-111111111111/%')
) as result;
```

Do not use `service_role`, an `@` character, or any real-looking identity in the SQL file.

- [ ] **Step 4: Extend the read-only token smoke**

Add to `RESOURCES` in `scripts/supabase-rls-smoke.mjs`:

```js
{ table: "document_requests", idColumn: "matter_id", select: "matter_id" },
```

Keep the script read-only: do not add inserts, RPC mutations, Storage uploads or secret
logging. The successful resource count becomes `6`.

- [ ] **Step 5: Update operational documentation and ADR**

Create `docs/decisions/0006-managed-document-requests.md` with sections `Контекст`,
`Решение`, `Безопасность`, `Ограничения`, `Rollout`. Record the explicit table/RPC boundary,
nullable legacy documents, soft archive, generic notifications, no antivirus/AI, and the
Production approval gate.

In `docs/supabase-e2e.md`, add `document-requests-smoke.sql` as step 8, shift later numbering,
and list the expected counters from Step 3. In `docs/cabinet-mvp.md`, describe the feature as
implemented in code but not enabled in Production until the isolated checks pass.

- [ ] **Step 6: Run static smoke and documentation regressions**

```powershell
npm.cmd test -- tests/supabase-rls-smoke.test.mjs tests/document-request-migration.test.mjs tests/security-config.test.mjs
git diff --check
```

Expected: PASS.

- [ ] **Step 7: Commit tests and operational docs**

```powershell
git add supabase/tests/document-requests-smoke.sql scripts/supabase-rls-smoke.mjs tests/supabase-rls-smoke.test.mjs docs/decisions/0006-managed-document-requests.md docs/supabase-e2e.md docs/cabinet-mvp.md
git commit -m "test: cover document request isolation"
```

### Task 8: Validate locally and on `dogovoroff-test`, then stop before Production

**Files:**

- Modify after successful evidence: `docs/cabinet-mvp.md`
- Modify after successful evidence: `docs/decisions/0006-managed-document-requests.md`

**Interfaces:**

- Consumes: all previous tasks.
- Produces: a reviewed candidate with recorded test evidence; no Production migration or Production deployment.

- [ ] **Step 1: Review the complete working-tree diff**

Run:

```powershell
git status --short --branch
$reviewBase = git merge-base origin/main HEAD
git diff --stat "$reviewBase..HEAD"
git diff --check "$reviewBase..HEAD"
git diff "$reviewBase..HEAD" -- . ":(exclude)package-lock.json"
```

Verify the range includes the approved spec/plan plus only the implementation files named in
this plan; no secret/token/service-role value appears, no user file or unrelated public-site
code was modified, and no direct client privilege was broadened.

- [ ] **Step 2: Run all local quality gates**

```powershell
npm.cmd test
npm.cmd run build
git diff --check
```

Expected: all Node tests PASS; Next.js production build exits 0 and lists `/cabinet` and
`/staff`; diff check prints nothing.

- [ ] **Step 3: Apply only the new migration to the isolated project**

Present the local test/build evidence and request explicit approval to change RLS/schema in
the isolated project. After approval, verify the selected Supabase project is named
`dogovoroff-test` and is not the Production project. Apply
`supabase/migrations/20260830140000_add_document_requests.sql` with the available Supabase
management integration. Record the returned migration version and stop immediately if the
selected project name/ref does not match the isolated test project.

Do not run this step against Production.

- [ ] **Step 4: Run transactional SQL and verify cleanup**

Execute `supabase/tests/document-requests-smoke.sql` in the isolated project SQL runner.
Expected JSON:

```json
{
  "passed": true,
  "authorization_checks": 12,
  "transition_checks": 8,
  "isolation_checks": 7,
  "persistent_rows": 0
}
```

After the transaction, run read-only counts for the synthetic UUID prefix across
`document_requests`, `documents`, `matter_events`, `audit_events`, and `storage.objects`.
Every count must be zero.

- [ ] **Step 5: Run the temporary-token read-only smoke**

Set the existing `SUPABASE_E2E_*` variables only in the current PowerShell process, pointing
to `dogovoroff-test`, then run:

```powershell
npm.cmd run supabase:smoke
```

Expected: `4 actors, 6 resources, 1 Storage isolation check`. Remove the temporary variables
from the process immediately after the run. Never copy token values into documentation,
Git, chat, logs or command output.

- [ ] **Step 6: Perform local browser accessibility and interaction checks**

Inventory dedicated synthetic accounts in `dogovoroff-test` by UUID only. If client A,
client B, lawyer and admin test accounts are not already available, stop and request approval
before creating temporary Auth users or handling generated credentials. Keep generated
passwords only in the current process, never in Git/chat/logs, and delete any newly created
test users plus their fixtures after the browser run.

Run the production build locally against `dogovoroff-test` and exercise the four synthetic
accounts at desktop width 1440px and mobile widths 390px and 360px:

1. lawyer creates a request;
2. client A sees only matter A, uploads two small synthetic files and submits;
3. client B cannot navigate or request matter A data;
4. lawyer returns with a generic note;
5. client A archives one file, uploads a replacement and resubmits;
6. admin accepts and both files become ready;
7. keyboard focus follows mutations, `aria-live` announces results, long titles wrap;
8. replay the saved registration payload once and verify the same document remains a single
   row without a second Storage upload;
9. console has no uncaught error and network responses expose no private SQL details.

After the run, remove browser fixtures and run read-only counts for their UUIDs. Record zero
remaining rows for any temporary fixture that was created by this step.

- [ ] **Step 7: Request approval before any Preview publication**

Present local/isolated evidence to the user. Because publishing an application build is an
external state change, do not create or update a Vercel Preview until the user explicitly
approves it. If approved, connect only controlled Preview configuration to the isolated
test environment and repeat Step 6 on the Preview URL.

- [ ] **Step 8: Run Supabase advisors and record verified evidence**

Run security/performance advisors on `dogovoroff-test`. Treat an RLS-with-no-policy finding
or exposed `security definer` warning as a release blocker unless it exactly matches the
documented RPC-only boundary and each function has explicit internal authorization.

Update `docs/cabinet-mvp.md` and ADR 0006 with the actual date, commands, counts, migration
version and remaining limitations. Do not write a successful result before it occurs.

- [ ] **Step 9: Commit the verified test record**

If Step 8 added verified evidence to either document, run:

```powershell
git add docs/cabinet-mvp.md docs/decisions/0006-managed-document-requests.md
git commit -m "docs: record document request validation"
git status --short --branch
```

If no documentation line changed, skip the empty commit and run only `git status`. Expected:
clean working tree. Stop and present the evidence. Request a separate explicit
approval before applying the migration to Production, pushing a deployment-triggering
branch, or publishing Production.

## Final Review Checklist

- [ ] The design spec is implemented without an unapproved AI, antivirus, physical delete,
  external notification or legal-policy expansion.
- [ ] Every new table/function is protected by explicit grants, RLS or internal role checks.
- [ ] Direct linked-document insert cannot bypass the 20-file/state boundary.
- [ ] Existing `request_id is null` documents and generic uploads still work.
- [ ] Client A/B isolation is proven in SQL and browser checks.
- [ ] Notifications and audit contain only allowlisted generic copy.
- [ ] Desktop/mobile/accessibility checks have concrete evidence.
- [ ] `dogovoroff-test` is clean after transactional tests.
- [ ] Production remains unchanged pending a new explicit approval.
