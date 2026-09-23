# Matter Trash Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить администраторскую корзину дел с 30-дневным восстановлением и контролируемым окончательным удалением связанных строк и приватных файлов.

**Architecture:** Мягкое удаление хранится в отдельных nullable-полях `matters`, а обычные RLS helpers исключают такие дела из клиентских и рабочих запросов. Узкие `SECURITY DEFINER` RPC повторно проверяют организацию и роль для перемещения, восстановления и двухфазного purge. Окончательное удаление оркестрируется отдельным server action: пользовательская сессия авторизует точные пути, server-only Supabase client удаляет только эти объекты Storage, затем RPC удаляет строки.

**Tech Stack:** PostgreSQL/Supabase RLS and RPC, Next.js 15.5.21 server actions, `@supabase/supabase-js` 2.112.4, React 19.1.5, Node.js test runner, pgTAP/transactional SQL smoke tests.

**Spec:** `docs/superpowers/specs/2026-09-01-cabinet-ux-simplification-design.md`

## Global Constraints

- Архив и корзина остаются разными состояниями.
- Только администратор организации может перемещать, восстанавливать и окончательно удалять дело.
- Восстановление доступно 30 дней; окончательное удаление не запускается автоматически.
- Браузерные роли не получают общий `delete` на таблицы или Storage.
- Storage обрабатывается до удаления строк; частичный сбой остаётся повторяемым.
- В логи не попадают email, сообщения, исходные имена файлов, ключи или содержимое дела.
- Production RLS/миграция и новый секрет требуют отдельного подтверждения непосредственно перед применением.
- Сначала использовать бесплатный изолированный проект `dogovoroff-test`; Production не изменять во время smoke-тестов.
- После каждого интеграционного теста удалять синтетические строки, пользователей и Storage-объекты и подтверждать нулевые counts.
- Не публиковать Preview или Production без отдельного разрешения.

---

## File Structure

- Create: `features/staff/matter-trash-domain.mjs` — валидация UUID/reference, сроки и безопасные сообщения ошибок.
- Create: `features/staff/matter-trash-actions.js` — server actions мягкого удаления, восстановления и purge.
- Create: `features/staff/staff-matter-trash-dialog.jsx` — подтверждения корзины, восстановления и purge.
- Create: `features/staff/staff-matter-trash-list.jsx` — admin-only список корзины.
- Create: `lib/supabase/admin.js` — server-only клиент только для точного Storage removal.
- Create: `supabase/migrations/20260901090000_add_matter_trash.sql` — поля, индексы, RLS helpers and admin RPC.
- Create: `supabase/tests/matter-trash-smoke.sql` — транзакционные роли, сроки, изоляция и rollback.
- Create: `tests/matter-trash-domain.test.mjs` — чистая доменная логика.
- Create: `tests/matter-trash-migration.test.mjs` — статический security contract миграции.
- Create: `tests/matter-trash-actions.test.mjs` — server-only orchestration contract.
- Modify: `features/staff/staff-server.js` — загрузка admin-only корзины.
- Modify: `app/staff/page.jsx` — передача admin-only read model в клиентскую панель.
- Modify: `features/staff/staff-client.jsx` — данные и действия корзины.
- Modify: `features/staff/staff-matter-workspace.jsx` — опасная зона управления.
- Modify: `features/staff/staff-domain.mjs` — normal/trash filtering.
- Modify: `features/cabinet/cabinet-server.js` — явный defensive filter для мягко удалённых дел.
- Modify: `features/staff/staff.module.css` — danger/restore states without changing brand.
- Modify: `tests/staff-cabinet.test.mjs`, `tests/cabinet-server.test.mjs`, `tests/supabase-rls-permissions.test.mjs`.
- Modify: `docs/cabinet-mvp.md`, `docs/cabinet-supabase-architecture.md`, `docs/supabase-e2e.md`.

### Task 1: Trash domain and confirmation rules

**Files:**
- Create: `features/staff/matter-trash-domain.mjs`
- Create: `tests/matter-trash-domain.test.mjs`

**Interfaces:**
- Consumes: form payloads `{ matterId, confirmationReference }`, ISO timestamps and safe provider errors.
- Produces: `validateMatterTrash`, `validateMatterRestore`, `validateMatterPurge`, `getTrashDaysRemaining`, `getMatterTrashErrorMessage`.

- [ ] **Step 1: Write failing domain tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  getMatterTrashErrorMessage,
  getTrashDaysRemaining,
  validateMatterPurge,
  validateMatterRestore,
  validateMatterTrash,
} from "../features/staff/matter-trash-domain.mjs";

const MATTER_ID = "a1111111-1111-4111-8111-111111111111";

test("trash and restore accept only canonical UUIDs", () => {
  assert.deepEqual(validateMatterTrash({ matterId: MATTER_ID }).value, { matterId: MATTER_ID });
  assert.deepEqual(validateMatterRestore({ matterId: MATTER_ID }).value, { matterId: MATTER_ID });
  assert.equal(validateMatterTrash({ matterId: "bad" }).valid, false);
});

test("permanent purge requires a bounded reference confirmation", () => {
  assert.deepEqual(validateMatterPurge({ matterId: MATTER_ID, confirmationReference: "  DO-42 " }).value, {
    matterId: MATTER_ID,
    confirmationReference: "DO-42",
  });
  assert.equal(validateMatterPurge({ matterId: MATTER_ID, confirmationReference: "" }).valid, false);
  assert.equal(validateMatterPurge({ matterId: MATTER_ID, confirmationReference: "x".repeat(81) }).valid, false);
});

test("remaining days never become negative", () => {
  assert.equal(getTrashDaysRemaining("2026-10-01T00:00:00.000Z", new Date("2026-09-01T00:00:00.000Z")), 30);
  assert.equal(getTrashDaysRemaining("2026-08-01T00:00:00.000Z", new Date("2026-09-01T00:00:00.000Z")), 0);
});

test("provider errors map to non-sensitive Russian copy", () => {
  assert.equal(getMatterTrashErrorMessage({ message: "trash_requires_admin" }), "Управлять корзиной может только администратор организации.");
  assert.equal(getMatterTrashErrorMessage({ message: "purge_too_early" }), "Срок восстановления ещё не закончился.");
  assert.equal(getMatterTrashErrorMessage({ message: "private provider detail" }), "Не удалось выполнить действие. Попробуйте ещё раз.");
});
```

- [ ] **Step 2: Run the focused test and verify the missing-module failure**

Run: `node --test tests/matter-trash-domain.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the pure validators and date function**

```js
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function invalid(error) {
  return { valid: false, value: null, error };
}

function matterOnly(input) {
  const matterId = typeof input?.matterId === "string" ? input.matterId.trim() : "";
  return UUID_V4.test(matterId)
    ? { valid: true, value: { matterId }, error: "" }
    : invalid("Не удалось определить дело.");
}

export const validateMatterTrash = matterOnly;
export const validateMatterRestore = matterOnly;

export function validateMatterPurge(input) {
  const matter = matterOnly(input);
  if (!matter.valid) return matter;
  const confirmationReference = typeof input?.confirmationReference === "string"
    ? input.confirmationReference.trim()
    : "";
  if (!confirmationReference || confirmationReference.length > 80 || /[\u0000-\u001f\u007f]/.test(confirmationReference)) {
    return invalid("Введите точный номер дела.");
  }
  return { valid: true, value: { ...matter.value, confirmationReference }, error: "" };
}

export function getTrashDaysRemaining(purgeEligibleAt, now = new Date()) {
  const target = new Date(purgeEligibleAt);
  if (Number.isNaN(target.getTime()) || Number.isNaN(now.getTime())) return 0;
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86_400_000));
}

export function getMatterTrashErrorMessage(error) {
  const messages = {
    trash_requires_admin: "Управлять корзиной может только администратор организации.",
    matter_not_found: "Дело не найдено или недоступно.",
    matter_not_trashed: "Дело не находится в корзине.",
    purge_too_early: "Срок восстановления ещё не закончился.",
    confirmation_mismatch: "Номер дела не совпадает.",
  };
  return messages[error?.message] || "Не удалось выполнить действие. Попробуйте ещё раз.";
}
```

- [ ] **Step 4: Run tests and commit**

Run: `node --test tests/matter-trash-domain.test.mjs`

Expected: all tests PASS.

```bash
git add features/staff/matter-trash-domain.mjs tests/matter-trash-domain.test.mjs
git commit -m "feat: add matter trash domain"
```

### Task 2: Soft-trash schema, RLS helpers and admin RPC

**Files:**
- Create: `supabase/migrations/20260901090000_add_matter_trash.sql`
- Create: `tests/matter-trash-migration.test.mjs`
- Create: `supabase/tests/matter-trash-smoke.sql`
- Modify: `tests/supabase-rls-permissions.test.mjs`

**Interfaces:**
- Consumes: `private.is_org_admin`, existing matter tables and authenticated session.
- Produces: `trash_matter`, `restore_matter`, `list_trashed_matters`, `prepare_matter_purge`, `mark_matter_purge_failed`, `finalize_matter_purge`.

- [ ] **Step 1: Stop for explicit authorization-policy approval**

Before editing this migration, obtain explicit user confirmation to change RLS helper behavior
and add admin-only `SECURITY DEFINER` functions. Design approval alone does not apply anything
to Production.

- [ ] **Step 2: Write the failing migration security test**

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../supabase/migrations/20260901090000_add_matter_trash.sql", import.meta.url),
  "utf8",
);

test("matter trash migration is admin-only and keeps browser delete revoked", () => {
  assert.match(source, /add column trashed_at timestamptz/);
  assert.match(source, /add column purge_eligible_at timestamptz/);
  assert.match(source, /create or replace function public\.trash_matter/);
  assert.match(source, /create or replace function public\.restore_matter/);
  assert.match(source, /create or replace function public\.list_trashed_matters/);
  assert.match(source, /create or replace function public\.prepare_matter_purge/);
  assert.match(source, /create or replace function public\.finalize_matter_purge/);
  assert.match(source, /private\.is_org_admin/);
  assert.match(source, /security definer/g);
  assert.match(source, /set search_path = ''/g);
  assert.match(source, /revoke all on function public\.trash_matter/);
  assert.doesNotMatch(source, /grant delete on (table )?public\.matters to authenticated/i);
  assert.doesNotMatch(source, /grant delete on (table )?storage\.objects to authenticated/i);
});
```

- [ ] **Step 3: Run the test and verify the missing migration failure**

Run: `node --test tests/matter-trash-migration.test.mjs`

Expected: FAIL with `ENOENT`.

- [ ] **Step 4: Add constrained trash columns and index**

Start the migration with:

```sql
alter table public.matters
  add column trashed_at timestamptz,
  add column trashed_by uuid references auth.users (id) on delete set null,
  add column pre_trash_status public.matter_status,
  add column purge_eligible_at timestamptz,
  add column purge_state text,
  add constraint matters_trash_state_consistent check (
    (trashed_at is null and pre_trash_status is null and purge_eligible_at is null and purge_state is null)
    or
    (trashed_at is not null and pre_trash_status is not null and purge_eligible_at is not null
      and purge_eligible_at >= trashed_at + interval '30 days'
      and (purge_state is null or purge_state in ('pending', 'failed')))
  );

create index matters_trash_organization_eligible_idx
  on public.matters (organization_id, purge_eligible_at, trashed_at desc)
  where trashed_at is not null;
```

Remove the broad direct-update grant because every current matter write already uses a
protected RPC:

```sql
revoke update on table public.matters from authenticated;
```

Keep `grant select on table public.matters to authenticated`. Add a static test proving that
no browser module calls `.from("matters").update(...)` before committing this privilege
narrowing.

- [ ] **Step 5: Make ordinary RLS helpers ignore the trash**

Replace `private.can_access_matter`, `private.can_manage_matter`,
`private.can_access_matter_text` and the client branch of `private.can_access_organization`
so every matter lookup includes:

```sql
and m.trashed_at is null
```

Admin trash RPC must not call these helpers; it locks the row and checks
`private.is_org_admin(target_organization_id)` directly.

- [ ] **Step 6: Implement idempotent soft-trash and restore RPCs**

The core transitions are:

```sql
update public.matters
set trashed_at = clock_timestamp(),
    trashed_by = actor_id,
    pre_trash_status = status,
    purge_eligible_at = clock_timestamp() + interval '30 days',
    purge_state = null
where id = target_matter_id
  and trashed_at is null;
```

and:

```sql
update public.matters
set status = coalesce(pre_trash_status, 'archived'::public.matter_status),
    trashed_at = null,
    trashed_by = null,
    pre_trash_status = null,
    purge_eligible_at = null,
    purge_state = null
where id = target_matter_id
  and trashed_at is not null;
```

Each function must lock with `for update`, validate `auth.uid()`, call
`private.is_org_admin(organization_id)`, write safe audit actions `matter.trashed` or
`matter.restored`, revoke all default execution and grant only to `authenticated`.
If the matter is already trashed, `trash_matter` returns the stored timestamps without
overwriting `pre_trash_status`. `restore_matter` rejects `purge_state in ('pending', 'failed')`
because Storage may already be partially removed.

- [ ] **Step 7: Implement list and two-phase purge RPCs**

`list_trashed_matters(target_organization_id)` returns only:

```sql
matter_id, reference, title, pre_trash_status, trashed_at, purge_eligible_at, purge_state
```

`prepare_matter_purge(target_matter_id, confirmation_reference)` checks admin, exact reference,
`purge_eligible_at <= clock_timestamp()` and returns `array_agg(documents.storage_path)` after
setting `purge_state = 'pending'`.

`mark_matter_purge_failed(target_matter_id)` changes only `pending` to `failed` after the same
admin check.

`finalize_matter_purge(target_matter_id)` rechecks admin, eligibility and `pending`, then:

```sql
delete from public.intake_requests where matter_id = target_matter_id;
insert into public.audit_events (organization_id, matter_id, actor_id, action, entity_type, entity_id)
values (target_organization_id, null, actor_id, 'matter.purged', 'matter', null);
delete from public.matters where id = target_matter_id;
```

The migration test must assert the exact foreign-key behavior before relying on deletion:
`matter_participants`, `matter_stages`, `matter_events`, `document_requests`, `documents` and
`messages` use `on delete cascade`; `audit_events.matter_id` uses `on delete set null`; and
`intake_requests.matter_id` uses `on delete restrict`, which is why the linked intake row is
deleted explicitly first.

- [ ] **Step 8: Add transactional SQL smoke cases**

`supabase/tests/matter-trash-smoke.sql` must run in `begin ... rollback` and assert:

1. client cannot call `trash_matter`;
2. lawyer cannot call it;
3. admin of another organization cannot call it;
4. correct admin can trash once and retry idempotently;
5. client, lawyer and normal staff loaders no longer select the matter;
6. list RPC returns it only to the correct admin;
7. restore returns the previous status and access;
8. purge before 30 days fails;
9. wrong reference fails;
10. finalize cascades linked synthetic records only after prepare;
11. rollback leaves persistent row counts unchanged.

- [ ] **Step 9: Run static tests only; do not apply the migration yet**

Run: `node --test tests/matter-trash-migration.test.mjs tests/supabase-rls-permissions.test.mjs`

Expected: all tests PASS.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 10: Commit the unapplied migration and tests**

```bash
git add supabase/migrations/20260901090000_add_matter_trash.sql supabase/tests/matter-trash-smoke.sql tests/matter-trash-migration.test.mjs tests/supabase-rls-permissions.test.mjs
git commit -m "feat: add protected matter trash migration"
```

### Task 3: Trash read model, actions and interface

**Files:**
- Create: `features/staff/staff-matter-trash-dialog.jsx`
- Create: `features/staff/staff-matter-trash-list.jsx`
- Modify: `features/staff/staff-server.js:1-124`
- Modify: `app/staff/page.jsx:24-75`
- Modify: `features/staff/staff-client.jsx`
- Modify: `features/staff/staff-matter-workspace.jsx`
- Modify: `features/staff/staff-domain.mjs`
- Modify: `features/cabinet/cabinet-server.js:48-104`
- Modify: `features/staff/staff-actions.js`
- Modify: `features/staff/staff.module.css`
- Modify: `tests/staff-cabinet.test.mjs`
- Modify: `tests/cabinet-server.test.mjs`

**Interfaces:**
- Consumes: `list_trashed_matters`, `trash_matter`, `restore_matter` and the approved management tab.
- Produces: `trashMatterAction`, `restoreMatterAction`, `StaffMatterTrashList`, `StaffMatterTrashDialog`.

- [ ] **Step 1: Add failing server and UI assertions**

```js
test("staff loads and renders trash only for administrators", () => {
  assert.match(serverSource, /list_trashed_matters/);
  assert.match(pageSource, /initialTrashMatters/);
  assert.match(clientSource, /StaffMatterTrashList/);
  assert.match(clientSource, /Переместить в корзину/);
  assert.match(actionsSource, /trash_matter/);
  assert.match(actionsSource, /restore_matter/);
  assert.doesNotMatch(clientSource, /service_role|SUPABASE_SERVICE/);
});
```

- [ ] **Step 2: Run the focused UI/server tests and verify failure**

Run: `node --test tests/staff-cabinet.test.mjs tests/cabinet-server.test.mjs`

Expected: FAIL on missing trash contracts.

- [ ] **Step 3: Load trash rows separately from ordinary matters**

For every admin organization in `loadStaffData`, call:

```js
supabase.rpc("list_trashed_matters", { target_organization_id: organization.id })
```

Map only returned safe fields. Return `trashMatters` and `canManageTrash: adminOrganizationIds.size > 0`.
Do not merge trash rows into `matters`; this prevents accidental display in normal queues and
notifications. Add `.is("trashed_at", null)` to the normal matter query in
`loadCabinetData` as a defensive filter even though RLS already excludes them.

- [ ] **Step 4: Add soft-trash server actions**

In the existing user-session action module:

```js
export async function trashMatterAction(input) {
  const validation = validateMatterTrash(input);
  if (!validation.valid) return actionError(validation.error);
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return actionError(SESSION_ERROR);
  const { data, error } = await supabase.rpc("trash_matter", {
    target_matter_id: validation.value.matterId,
  }).single();
  if (error || !data?.matter_id) return actionError(getMatterTrashErrorMessage(error));
  revalidatePath("/staff");
  revalidatePath("/cabinet");
  return { ok: true, matterId: data.matter_id, message: "Дело перемещено в корзину на 30 дней." };
}
```

Implement `restoreMatterAction` with the same session boundary and the `restore_matter` RPC. Log only error code/status:

```js
export async function restoreMatterAction(input) {
  const validation = validateMatterRestore(input);
  if (!validation.valid) return actionError(validation.error);
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return actionError(SESSION_ERROR);
  const { data, error } = await supabase.rpc("restore_matter", {
    target_matter_id: validation.value.matterId,
  }).single();
  if (error || !data?.matter_id) return actionError(getMatterTrashErrorMessage(error));
  revalidatePath("/staff");
  revalidatePath("/cabinet");
  return { ok: true, matterId: data.matter_id, message: "Дело восстановлено. Проверьте следующий шаг и сроки." };
}
```

- [ ] **Step 5: Build the danger-zone confirmation**

`StaffMatterTrashDialog` receives `{ mode, matter, onClose, onComplete }`. For `trash`, render
the reference, title, loss-of-access explanation, «Отмена» and «Переместить в корзину».
For `restore`, render the remaining days and «Восстановить дело». Both use `role="dialog"`,
`aria-modal="true"`, focus containment and focus restoration.

- [ ] **Step 6: Build the trash list**

Each row displays reference, title, trash date, days remaining and purge state. Before expiry
the main action is «Восстановить». After expiry, it remains possible to restore until purge
actually starts, while «Удалить окончательно» is a separate danger action.

- [ ] **Step 7: Wire the management tab and navigation**

Only when `canManageTrash` is true:

- show `Ещё → Корзина`;
- show `Управление → Переместить в корзину` in an active matter;
- close the matter workspace and return to the source list after success;
- never show these controls to a lawyer.

- [ ] **Step 8: Run UI and server tests**

Run: `node --test tests/matter-trash-domain.test.mjs tests/staff-cabinet.test.mjs tests/cabinet-server.test.mjs tests/staff-workflow.test.mjs`

Expected: all tests PASS.

- [ ] **Step 9: Commit soft-trash UI**

```bash
git add features/staff/staff-matter-trash-dialog.jsx features/staff/staff-matter-trash-list.jsx features/staff/staff-server.js features/staff/staff-client.jsx features/staff/staff-matter-workspace.jsx features/staff/staff-domain.mjs features/cabinet/cabinet-server.js features/staff/staff-actions.js features/staff/staff.module.css tests/staff-cabinet.test.mjs tests/cabinet-server.test.mjs
git commit -m "feat: add admin matter trash interface"
```

### Task 4: Server-only permanent purge orchestration

**Files:**
- Create: `lib/supabase/admin.js`
- Create: `features/staff/matter-trash-actions.js`
- Create: `tests/matter-trash-actions.test.mjs`
- Modify: `features/staff/staff-matter-trash-dialog.jsx`
- Modify: `tests/api-security.test.mjs`

**Interfaces:**
- Consumes: existing `NEXT_PUBLIC_SUPABASE_URL`, new server-only `SUPABASE_SERVICE_ROLE_KEY`, user-session purge RPC and exact storage paths.
- Produces: `createAdminStorageClient()` and `purgeMatterAction(input)`.

- [ ] **Step 1: Stop for secret-handling approval**

Obtain explicit approval before introducing or configuring `SUPABASE_SERVICE_ROLE_KEY`.
Never request the value in chat if the user can enter it directly into Vercel/Supabase tooling.
Use only the isolated test-project secret until Production rollout is separately approved.

- [ ] **Step 2: Write failing server-boundary tests**

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [adminSource, actionSource, clientSource] = await Promise.all([
  readFile(new URL("../lib/supabase/admin.js", import.meta.url), "utf8"),
  readFile(new URL("../features/staff/matter-trash-actions.js", import.meta.url), "utf8"),
  readFile(new URL("../features/staff/staff-matter-trash-dialog.jsx", import.meta.url), "utf8"),
]);

test("service key remains in a server-only storage boundary", () => {
  assert.match(adminSource, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(adminSource, /persistSession:\s*false/);
  assert.match(actionSource, /^"use server";/);
  assert.match(actionSource, /prepare_matter_purge/);
  assert.match(actionSource, /\.remove\(storagePaths\)/);
  assert.match(actionSource, /finalize_matter_purge/);
  assert.match(actionSource, /mark_matter_purge_failed/);
  assert.doesNotMatch(clientSource, /SUPABASE_SERVICE_ROLE_KEY|service_role/);
  assert.doesNotMatch(actionSource, /console\.(log|error)\([^)]*(storagePaths|confirmationReference)/);
});
```

- [ ] **Step 3: Run the test and verify missing files**

Run: `node --test tests/matter-trash-actions.test.mjs`

Expected: FAIL with `ENOENT`.

- [ ] **Step 4: Create the minimal server-only Storage client**

```js
import { createClient } from "@supabase/supabase-js";

export function createAdminStorageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Admin storage configuration is unavailable");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

This client is imported only from the `"use server"` trash action and is used only for
`matter-documents.remove(exactPaths)`.

- [ ] **Step 5: Implement the two-phase purge action**

The action must:

1. validate UUID and confirmation reference;
2. authenticate through the normal cookie-bound client;
3. call `prepare_matter_purge` and receive exact paths;
4. call `admin.storage.from(DOCUMENT_BUCKET).remove(storagePaths)` when non-empty;
5. on Storage error call `mark_matter_purge_failed` and return a generic retry message;
6. on success call `finalize_matter_purge`;
7. revalidate `/staff` and `/cabinet`;
8. log only bounded provider code/status.

Use this result contract:

```js
return { ok: true, matterId, message: "Дело и связанные материалы удалены окончательно." };
```

No optimistic success is allowed before `finalize_matter_purge` returns a matching
`matter_id`.

- [ ] **Step 6: Add exact-reference confirmation UI**

The purge dialog displays the reference from the server read model and requires typing it
into an input with `autoComplete="off"`. Submit stays disabled until the trimmed input equals
the displayed reference. The server/RPC still repeats the comparison.

- [ ] **Step 7: Run security and action tests**

Run: `node --test tests/matter-trash-actions.test.mjs tests/api-security.test.mjs tests/staff-cabinet.test.mjs`

Expected: all tests PASS and no client module contains the service-key name.

- [ ] **Step 8: Commit the server-only purge boundary**

```bash
git add lib/supabase/admin.js features/staff/matter-trash-actions.js features/staff/staff-matter-trash-dialog.jsx tests/matter-trash-actions.test.mjs tests/api-security.test.mjs
git commit -m "feat: add server-only matter purge"
```

### Task 5: Isolated Supabase verification and cleanup

**Files:**
- Modify: `docs/supabase-e2e.md`

**Interfaces:**
- Consumes: unapplied migration, `dogovoroff-test`, four synthetic roles and synthetic files.
- Produces: SQL/browser evidence and zero persistent fixtures.

- [ ] **Step 1: Apply only to `dogovoroff-test` after approval**

Apply `20260901090000_add_matter_trash.sql` to project ID `vhzaayqnghtotczcrbim`. Record the
exact migration result. Do not target Production.

- [ ] **Step 2: Run pgTAP and transactional smoke tests**

Run the schema test and `supabase/tests/matter-trash-smoke.sql` against the isolated project.

Expected: every assertion passes; the transaction ends with `ROLLBACK`.

- [ ] **Step 3: Run role-based API verification**

Using synthetic client A, client B, lawyer, admin and second-organization admin tokens,
verify the eleven authorization/transition cases from Task 2. Do not use real customer data.

- [ ] **Step 4: Run Storage failure and retry verification**

Create two synthetic files under the exact synthetic matter UUID. Force one failed removal,
confirm `purge_state = 'failed'`, retry, then confirm both Storage objects and dependent rows
are gone only after finalization.

- [ ] **Step 5: Clean every fixture and prove zero counts**

Delete all synthetic users, rows and Storage objects created outside rolled-back SQL. Query
exact fixture identifiers and confirm:

```text
synthetic_users = 0
synthetic_matters = 0
synthetic_documents = 0
synthetic_storage_objects = 0
temporary_policies = 0
```

- [ ] **Step 6: Run Supabase advisors**

Review security and performance advisors. Treat expected authenticated-callable
`SECURITY DEFINER` functions as findings requiring explicit inspection, not automatic
dismissal. Record any new warning and fix it before rollout.

- [ ] **Step 7: Update the E2E document and commit**

Record commands, assertion totals, cleanup counts and the fact that Production is untouched.

```bash
git add docs/supabase-e2e.md
git commit -m "docs: record matter trash verification"
```

### Task 6: Full verification, Preview and Production gates

**Files:**
- Modify: `docs/cabinet-mvp.md`
- Modify: `docs/cabinet-supabase-architecture.md`

**Interfaces:**
- Consumes: completed client/staff workspace plans, verified test migration and configured test secret.
- Produces: deployment-ready branch without automatically changing Production.

- [ ] **Step 1: Run repository quality gates**

Run: `npm.cmd test`

Expected: all tests PASS.

Run: `npm.cmd run build`

Expected: exit `0`.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 2: Verify Preview with synthetic roles**

After explicit Preview approval, verify:

1. archive remains in the normal history;
2. admin moves a synthetic matter to trash;
3. client and lawyer lose access immediately;
4. admin can restore without data loss;
5. 30-day message and exact-reference purge confirmation are readable on desktop/mobile;
6. lawyer cannot see or call any trash action;
7. forced purge failure remains retryable;
8. completed purge removes exact synthetic files and rows.

- [ ] **Step 3: Update architecture and MVP documentation**

Document fields, RPC names, two-phase Storage behavior, 30-day calculation, role boundaries,
known retention-policy dependency and actual verification results. Do not change public
privacy/consent pages in this task.

- [ ] **Step 4: Commit verified documentation**

```bash
git add docs/cabinet-mvp.md docs/cabinet-supabase-architecture.md
git commit -m "docs: document protected matter trash"
```

- [ ] **Step 5: Stop before Production**

Request separate explicit authorization for all three actions:

1. add `SUPABASE_SERVICE_ROLE_KEY` to the correct Vercel Production environment;
2. apply `20260901090000_add_matter_trash.sql` to Production Supabase;
3. publish the verified application build to Vercel Production.

Do not combine the test-project approval with any Production action.
