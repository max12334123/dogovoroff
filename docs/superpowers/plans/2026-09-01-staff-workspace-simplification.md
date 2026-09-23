# Staff Workspace Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Превратить `/staff` из перегруженной двухколоночной панели в понятный task-first рабочий стол и отдельную сфокусированную карточку дела без потери существующих операций.

**Architecture:** Чистый доменный модуль валидирует навигацию, вкладки и обратный переход. `staff-client.jsx` остаётся владельцем сетевых состояний, но представление разделяется на навигацию, списки и рабочую карточку. Существующие server actions, RPC, RLS, документные запросы и приватное скачивание переиспользуются без расширения прав.

**Tech Stack:** Next.js 15.5.21, React 19.1.5, JavaScript ESM, CSS Modules, Supabase SSR/JS, Node.js test runner.

**Spec:** `docs/superpowers/specs/2026-09-01-cabinet-ux-simplification-design.md`

## Global Constraints

- Сохранить фирменную холодную визуальную систему и существующие активы.
- Не добавлять production-зависимости.
- Сохранить все текущие разрешённые действия юриста и администратора.
- Никогда не использовать видимость кнопки как замену server action/RPC/RLS-проверке.
- Не выводить email, исходные имена файлов или тексты сообщений в техническом журнале.
- На одном экране показывать список либо полную карточку дела, но не обе поверхности одновременно.
- На видимой области показывать не более одного основного действия.
- Минимальная активная область — `44px`; мобильные поля — минимум `16px`.
- Не менять Production и не публиковать сборку без отдельного разрешения.

---

## File Structure

- Create: `features/staff/staff-navigation-domain.mjs` — allowlist URL-состояния и группировка навигации.
- Create: `features/staff/staff-navigation.jsx` — desktop/mobile-навигация и раздел `Ещё`.
- Create: `features/staff/staff-task-list.jsx` — очереди экрана «Сегодня».
- Create: `features/staff/staff-matter-workspace.jsx` — сфокусированная карточка и вкладки дела.
- Create: `features/staff/staff-workflow-form.jsx` — компактное изменение этапа и следующего шага.
- Modify: `features/staff/staff-client.jsx` — состояние, безопасные операции и маршрутизация поверх новых компонентов.
- Modify: `features/staff/staff-domain.mjs` — фильтры очередей и навигации.
- Modify: `features/staff/staff.module.css` — единые действия, one-surface layout и мобильный режим.
- Modify: `app/staff/loading.jsx`, `app/staff/error.jsx` — согласованные loading/error surfaces.
- Modify: `tests/staff-cabinet.test.mjs` — регрессионные и структурные проверки.
- Create: `tests/staff-navigation.test.mjs` — URL, вкладки и права на разделы.
- Modify: `tests/mobile-layout.test.mjs` and `tests/accessibility-polish.test.mjs` — мобильные и доступные состояния.
- Modify: `docs/cabinet-mvp.md` — подтверждённое устройство рабочей панели.

### Task 1: Staff navigation domain

**Files:**
- Create: `features/staff/staff-navigation-domain.mjs`
- Create: `tests/staff-navigation.test.mjs`
- Modify: `features/staff/staff-domain.mjs:1-112`

**Interfaces:**
- Consumes: loaded matters and capability flags `{ intakeEnabled, canViewAudit, canManageTrash }`.
- Produces: `parseStaffLocation`, `buildStaffHref`, `getStaffNavigation`, `STAFF_MATTER_TABS`.

- [ ] **Step 1: Write failing navigation tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStaffHref,
  getStaffNavigation,
  parseStaffLocation,
} from "../features/staff/staff-navigation-domain.mjs";

const matters = [{ id: "matter-a" }, { id: "matter-b" }];

test("staff navigation groups daily and rare work", () => {
  assert.deepEqual(
    getStaffNavigation({ intakeEnabled: true, canViewAudit: true, canManageTrash: true }),
    {
      primary: ["today", "inbox", "matters", "clients", "more"],
      more: ["documents", "messages", "audit", "trash"],
    },
  );
  assert.deepEqual(
    getStaffNavigation({ intakeEnabled: false, canViewAudit: false, canManageTrash: false }),
    { primary: ["today", "matters", "clients", "more"], more: ["documents", "messages"] },
  );
});

test("staff location rejects foreign matters and unknown tabs", () => {
  assert.deepEqual(parseStaffLocation("?view=matter&matter=matter-b&tab=documents&from=today", matters), {
    view: "matter",
    matterId: "matter-b",
    tab: "documents",
    from: "today",
  });
  assert.deepEqual(parseStaffLocation("?view=matter&matter=foreign&tab=delete&from=audit", matters), {
    view: "today",
    matterId: null,
    tab: "overview",
    from: "today",
  });
});

test("staff href carries identifiers but no client text", () => {
  assert.equal(
    buildStaffHref({ view: "matter", matterId: "matter-a", tab: "messages", from: "inbox" }),
    "/staff?view=matter&matter=matter-a&tab=messages&from=inbox",
  );
});
```

- [ ] **Step 2: Run the focused test and verify the missing-module failure**

Run: `node --test tests/staff-navigation.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the allowlisted navigation module**

```js
const PRIMARY = ["today", "inbox", "matters", "clients", "more"];
const MORE = ["documents", "messages", "audit", "trash"];
const LIST_VIEWS = new Set(["today", "inbox", "matters", "clients", ...MORE]);
export const STAFF_MATTER_TABS = Object.freeze(["overview", "documents", "messages", "management"]);
const TAB_SET = new Set(STAFF_MATTER_TABS);

export function getStaffNavigation({ intakeEnabled = false, canViewAudit = false, canManageTrash = false } = {}) {
  return {
    primary: PRIMARY.filter((view) => view !== "inbox" || intakeEnabled),
    more: MORE.filter((view) => (
      (view !== "audit" || canViewAudit) && (view !== "trash" || canManageTrash)
    )),
  };
}

export function parseStaffLocation(search, matters = [], capabilities = {}) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search || "");
  const view = params.get("view");
  const matterId = matters.some((matter) => matter?.id === params.get("matter")) ? params.get("matter") : null;
  const navigation = getStaffNavigation(capabilities);
  const allowedViews = new Set([...navigation.primary, ...navigation.more]);
  if (view === "matter" && matterId) {
    const tab = TAB_SET.has(params.get("tab")) ? params.get("tab") : "overview";
    const from = allowedViews.has(params.get("from")) && params.get("from") !== "more" ? params.get("from") : "today";
    return { view: "matter", matterId, tab, from };
  }
  return {
    view: allowedViews.has(view) && view !== "more" ? view : "today",
    matterId: null,
    tab: "overview",
    from: "today",
  };
}

export function buildStaffHref({ view = "today", matterId = null, tab = "overview", from = "today" } = {}) {
  const params = new URLSearchParams();
  const safeView = view === "matter" || LIST_VIEWS.has(view) ? view : "today";
  if (safeView !== "today") params.set("view", safeView);
  if (safeView === "matter" && matterId) {
    params.set("matter", matterId);
    if (TAB_SET.has(tab) && tab !== "overview") params.set("tab", tab);
    if (LIST_VIEWS.has(from)) params.set("from", from);
  }
  const query = params.toString();
  return query ? `/staff?${query}` : "/staff";
}
```

- [ ] **Step 4: Keep queue filtering pure and exclude future trashed records defensively**

At the start of `getStaffMatterQueue` add:

```js
if (!matter || matter.trashedAt) return "trash";
```

Then calculate queue matching exactly as:

```js
const matterQueue = getStaffMatterQueue(matter);
const matchesQueue = queue === "all" ? matterQueue !== "trash" : matterQueue === queue;
```

The dedicated trash view will use a separate server result in the later deletion plan.

- [ ] **Step 5: Run domain tests**

Run: `node --test tests/staff-navigation.test.mjs tests/staff-cabinet.test.mjs`

Expected: all tests PASS.

- [ ] **Step 6: Commit the navigation domain**

```bash
git add features/staff/staff-navigation-domain.mjs features/staff/staff-domain.mjs tests/staff-navigation.test.mjs tests/staff-cabinet.test.mjs
git commit -m "feat: add staff workspace navigation domain"
```

### Task 2: Extract navigation and focused workspace without behavior changes

**Files:**
- Create: `features/staff/staff-navigation.jsx`
- Create: `features/staff/staff-matter-workspace.jsx`
- Create: `features/staff/staff-workflow-form.jsx`
- Modify: `features/staff/staff-client.jsx:20-443,557-1062`
- Modify: `tests/staff-cabinet.test.mjs`

**Interfaces:**
- Consumes: existing matter objects, assignment directory, document request component and handler callbacks.
- Produces: `StaffNavigation`, `StaffMatterWorkspace`, `StaffWorkflowForm` with no new network authority.

- [ ] **Step 1: Add failing extraction assertions**

```js
test("staff workspace is split into focused modules", async () => {
  const [navigation, workspace, workflow] = await Promise.all([
    readFile(new URL("../features/staff/staff-navigation.jsx", import.meta.url), "utf8"),
    readFile(new URL("../features/staff/staff-matter-workspace.jsx", import.meta.url), "utf8"),
    readFile(new URL("../features/staff/staff-workflow-form.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(navigation, /Сегодня/);
  assert.match(navigation, /Ещё/);
  assert.match(workspace, /StaffDocumentRequests/);
  assert.match(workspace, /Написать клиенту/);
  assert.match(workflow, /updateMatterWorkflow|onSubmit/);
  assert.doesNotMatch(navigation + workspace + workflow, /service_role|SUPABASE_SERVICE/);
});
```

- [ ] **Step 2: Run the test and verify missing-file failures**

Run: `node --test tests/staff-cabinet.test.mjs`

Expected: FAIL because the three modules do not exist.

- [ ] **Step 3: Extract navigation markup**

Create `StaffNavigation` with this exact signature:

```jsx
export default function StaffNavigation({
  activeView,
  counts,
  items,
  moreItems,
  onSelect,
}) {
  return (
    <aside className={styles.rail} aria-label="Разделы рабочей панели">
      <nav>
        {items.filter((item) => item.id !== "more").map((item) => (
          <button
            className={`${styles.railButton}${activeView === item.id ? ` ${styles.isActive}` : ""}`}
            type="button"
            key={item.id}
            aria-current={activeView === item.id ? "page" : undefined}
            onClick={() => onSelect(item.id)}
          >
            <span>{item.label}</span>
            {counts[item.id] > 0 ? <small>{counts[item.id]}</small> : null}
          </button>
        ))}
        <details className={styles.moreNavigation} open={activeView === "more" || moreItems.some((item) => item.id === activeView)}>
          <summary>Ещё</summary>
          <div>{moreItems.map((item) => <button type="button" key={item.id} onClick={() => onSelect(item.id)}>{item.label}</button>)}</div>
        </details>
      </nav>
      <a className={styles.railCabinetLink} href="/cabinet">Личный кабинет</a>
    </aside>
  );
}
```

- [ ] **Step 4: Extract the workflow form**

Move the existing status, stage, next-action, deadline and assignment fields unchanged into
`StaffWorkflowForm`. Its props are:

```jsx
export default function StaffWorkflowForm({
  assignmentStaff,
  draft,
  feedback,
  isSubmitting,
  matter,
  onAssignmentChange,
  onChange,
  onClose,
  onSubmit,
})
```

Render it as `role="dialog"`, `aria-modal="true"`, with visible title «Изменить этап и
следующий шаг», explicit «Отмена» and «Сохранить изменения» actions. Move no validation into
the component.

- [ ] **Step 5: Extract the current matter detail**

Move `MatterStages`, `MessageHistory` and the current `MatterDetail` markup to
`staff-matter-workspace.jsx`. Replace the inline workflow form with `StaffWorkflowForm`, but
initially preserve the same open state and handlers supplied by `staff-client.jsx`.

- [ ] **Step 6: Run the complete staff unit set**

Run: `node --test tests/staff-cabinet.test.mjs tests/staff-workflow.test.mjs tests/staff-matter-details.test.mjs tests/document-request-ui.test.mjs`

Expected: all tests PASS before layout behavior changes.

- [ ] **Step 7: Commit the behavior-preserving split**

```bash
git add features/staff/staff-navigation.jsx features/staff/staff-matter-workspace.jsx features/staff/staff-workflow-form.jsx features/staff/staff-client.jsx tests/staff-cabinet.test.mjs
git commit -m "refactor: split staff workspace components"
```

### Task 3: Task-first dashboard and one-surface navigation

**Files:**
- Create: `features/staff/staff-task-list.jsx`
- Modify: `features/staff/staff-client.jsx:557-1062`
- Modify: `features/staff/staff-navigation.jsx`
- Modify: `features/staff/staff.module.css:245-535,1788-2159`
- Modify: `tests/staff-cabinet.test.mjs`

**Interfaces:**
- Consumes: `parseStaffLocation`, `buildStaffHref`, action/waiting/paused matter groups.
- Produces: list-only sections and a full-width workspace selected through `view=matter`.

- [ ] **Step 1: Add a failing one-surface assertion**

```js
test("staff lists open a separate matter workspace", async () => {
  const taskList = await readFile(new URL("../features/staff/staff-task-list.jsx", import.meta.url), "utf8");
  assert.match(taskList, /Требуют вашего действия/);
  assert.match(taskList, /Ожидают клиента/);
  assert.match(clientSource, /buildStaffHref/);
  assert.doesNotMatch(clientSource, /dashboardGrid[\s\S]*showDetail\(\)/);
  assert.doesNotMatch(clientSource, /registryGrid[\s\S]*showDetail\(\)/);
});
```

- [ ] **Step 2: Run the test and verify the old split-layout failure**

Run: `node --test tests/staff-cabinet.test.mjs`

Expected: FAIL while `showDetail()` is rendered alongside lists.

- [ ] **Step 3: Implement the task-list contract**

```jsx
export default function StaffTaskList({ action, waiting, paused, onOpenMatter }) {
  const groups = [
    { id: "action", title: "Требуют вашего действия", matters: action },
    { id: "waiting", title: "Ожидают клиента", matters: waiting },
    { id: "paused", title: "Приостановлены", matters: paused },
  ];
  return (
    <div className={styles.taskGroups}>
      {groups.filter((group) => group.matters.length).map((group) => (
        <section key={group.id} aria-labelledby={`staff-${group.id}-title`}>
          <h2 id={`staff-${group.id}-title`}>{group.title} <span>· {group.matters.length}</span></h2>
          <ol>{group.matters.map((matter) => (
            <li key={matter.id}>
              <button type="button" onClick={() => onOpenMatter(matter.id)}>
                <strong>{getMatterTask(matter)}</strong>
                <span>{matter.reference} · {matter.title}</span>
                <small>{matter.responseBy}</small>
              </button>
            </li>
          ))}</ol>
        </section>
      ))}
    </div>
  );
}
```

Export `getMatterTask` from a pure domain module or move it to `staff-domain.mjs` so this
component has no hidden dependency on `staff-client.jsx`.

- [ ] **Step 4: Add history-aware open and back actions**

In `StaffClient`, add a `popstate` listener mirroring Task 1's allowlist parser. Opening a
matter pushes:

```js
const openMatter = (matterId, tab = "overview") => {
  const href = buildStaffHref({ view: "matter", matterId, tab, from: activeView });
  window.history.pushState(null, "", href);
  setLocation(parseStaffLocation(href.split("?")[1] || "", initialMatters));
};

const closeMatter = () => {
  const href = buildStaffHref({ view: location.from });
  window.history.pushState(null, "", href);
  setLocation(parseStaffLocation(href.split("?")[1] || "", initialMatters));
};
```

Normal list views render no `StaffMatterWorkspace`. `view === "matter"` renders only the
workspace plus global shell/navigation.

- [ ] **Step 5: Remove split grids from desktop and mobile CSS**

Replace `.dashboardGrid` and `.registryGrid` two-column templates with a single content
column. The workspace receives `max-width` appropriate for readable forms but remains full
width inside the content area.

- [ ] **Step 6: Run staff navigation tests**

Run: `node --test tests/staff-navigation.test.mjs tests/staff-cabinet.test.mjs tests/notification-ui.test.mjs`

Expected: all tests PASS.

- [ ] **Step 7: Commit the task-first dashboard**

```bash
git add features/staff/staff-task-list.jsx features/staff/staff-client.jsx features/staff/staff-navigation.jsx features/staff/staff.module.css tests/staff-cabinet.test.mjs
git commit -m "feat: make staff dashboard task first"
```

### Task 4: Matter workspace tabs and contextual actions

**Files:**
- Modify: `features/staff/staff-matter-workspace.jsx`
- Modify: `features/staff/staff-client.jsx`
- Modify: `features/staff/staff.module.css`
- Modify: `tests/staff-cabinet.test.mjs`

**Interfaces:**
- Consumes: `location.tab`, existing workflow/document/message/detail handlers and role flags.
- Produces: tabs `overview`, `documents`, `messages`, `management` and one active panel at a time.

- [ ] **Step 1: Add failing tab and progressive-disclosure assertions**

```js
test("matter workspace exposes focused tabs and one administrative panel", async () => {
  const workspace = await readFile(new URL("../features/staff/staff-matter-workspace.jsx", import.meta.url), "utf8");
  assert.match(workspace, /Обзор/);
  assert.match(workspace, /Документы/);
  assert.match(workspace, /Сообщения/);
  assert.match(workspace, /Управление/);
  assert.match(workspace, /activePanel/);
  assert.doesNotMatch(workspace, /<StaffWorkflowForm[\s\S]*<StaffDocumentRequests[\s\S]*<form className=\{styles\.composer\}/);
});
```

- [ ] **Step 2: Run the test and verify the old always-open composition fails**

Run: `node --test tests/staff-cabinet.test.mjs`

Expected: FAIL on missing tabs/`activePanel`.

- [ ] **Step 3: Add the workspace header and tablist**

Render:

```jsx
<header className={styles.workspaceHeader}>
  <button className={styles.backAction} type="button" onClick={onBack}>Назад</button>
  <p className={styles.eyebrow}>{matter.reference}</p>
  <h1>{matter.title}</h1>
  <div className={styles.matterHeadlineMeta}>
    <span>{matter.stateLabel}</span><span>{matter.responseBy}</span>
  </div>
</header>
<div className={styles.workspaceTabs} role="tablist" aria-label="Разделы дела">
  {tabs.map((item) => (
    <button role="tab" aria-selected={tab === item.id} type="button" key={item.id} onClick={() => onTabChange(item.id)}>
      {item.label}
    </button>
  ))}
</div>
```

Hide `management` for non-admins by not including it in `tabs`; retain all server checks.

- [ ] **Step 4: Place each existing operation in its approved tab**

- `overview`: next action, stages, deadline, responsible employee and recent public events.
- `documents`: `StaffDocumentRequests`, ordinary documents and authorised download.
- `messages`: message history and existing idempotent composer.
- `management`: open buttons for metadata editor, workflow editor, assignment and archive.

The three quick actions in the header call `onTabChange("messages")`,
`onTabChange("documents")` and `setActivePanel("workflow")`. Use a single string state:

```js
const ACTIVE_PANELS = new Set(["workflow", "details", "assignment"]);
const [activePanel, setActivePanel] = useState(null);
const openPanel = (panel) => setActivePanel(ACTIVE_PANELS.has(panel) ? panel : null);
```

Opening one panel replaces the previous value. Successful save sets it back to `null` and
refreshes the existing server data.
Only the action selected by `getMatterTask(matter)` receives primary-button styling; the
other two quick actions use secondary or text styling, so the visual hierarchy still has one
recommended action.

- [ ] **Step 5: Keep unsaved forms explicit**

Each extracted dialog compares its current draft with its initial values. If changed, its
close button opens the existing confirmation pattern with «Продолжить редактирование» and
«Не сохранять». Do not persist the draft outside component memory.

- [ ] **Step 6: Run staff operation tests**

Run: `node --test tests/staff-cabinet.test.mjs tests/staff-workflow.test.mjs tests/staff-matter-details.test.mjs tests/document-request-actions.test.mjs tests/document-request-ui.test.mjs`

Expected: all tests PASS.

- [ ] **Step 7: Commit the focused workspace**

```bash
git add features/staff/staff-matter-workspace.jsx features/staff/staff-client.jsx features/staff/staff.module.css tests/staff-cabinet.test.mjs
git commit -m "feat: add focused staff matter workspace"
```

### Task 5: `Ещё`, control hierarchy and mobile behavior

**Files:**
- Modify: `features/staff/staff-navigation.jsx`
- Modify: `features/staff/staff-client.jsx`
- Modify: `features/staff/staff.module.css:1-2160`
- Modify: `app/staff/loading.jsx`
- Modify: `app/staff/error.jsx`
- Modify: `tests/staff-cabinet.test.mjs`
- Modify: `tests/mobile-layout.test.mjs`
- Modify: `tests/accessibility-polish.test.mjs`

**Interfaces:**
- Consumes: audit/intake capability flags, existing list components and current brand tokens.
- Produces: consistent `primaryButton`, `secondaryButton`, `textAction`, `dangerButton`, readable mobile controls and `Ещё` views.

- [ ] **Step 1: Add failing hierarchy assertions**

```js
test("staff controls use one approved hierarchy", () => {
  assert.match(cssSource, /--staff-body-size:\s*16px/);
  assert.match(cssSource, /--staff-control-size:\s*14px/);
  assert.match(cssSource, /--staff-control-height:\s*44px/);
  assert.match(cssSource, /\.primaryButton/);
  assert.match(cssSource, /\.secondaryButton/);
  assert.match(cssSource, /\.textAction/);
  assert.match(cssSource, /\.dangerButton/);
});
```

- [ ] **Step 2: Run tests and verify the old typography fails**

Run: `node --test tests/staff-cabinet.test.mjs tests/mobile-layout.test.mjs tests/accessibility-polish.test.mjs`

Expected: FAIL on missing tokens.

- [ ] **Step 3: Finish the `Ещё` information architecture**

Map labels exactly:

```js
const MORE_COPY = {
  documents: { title: "Документы", eyebrow: "Материалы по делам" },
  messages: { title: "Сообщения", eyebrow: "Связь с клиентами" },
  audit: { title: "Журнал действий", eyebrow: "Контроль организации" },
  trash: { title: "Корзина", eyebrow: "Удалённые дела" },
};
```

`documents` and `messages` remain cross-matter collections and open the corresponding matter
tab. `audit` remains admin-only. `trash` is rendered only after the deletion plan supplies
`canManageTrash` and data; before that it is absent rather than a dead button.

- [ ] **Step 4: Apply the control tokens**

```css
--staff-body-size: 16px;
--staff-control-size: 14px;
--staff-control-height: 44px;
--staff-motion-fast: 180ms;
--staff-motion-slow: 360ms;
```

Use the same height, font weight and letter spacing for each action role. Only hierarchy,
background and border differ. Remove component-specific font overrides that make adjacent
buttons visually unrelated.

- [ ] **Step 5: Implement the one-surface mobile rules**

At `max-width: 680px`, render the main navigation as a horizontally scrollable strip with at
most five primary items. Keep form inputs at `16px`, tabs fully visible through horizontal
scroll, workspace back action at the top and any sticky primary action above `env(safe-area-inset-bottom)`.

- [ ] **Step 6: Verify focus, text scaling and reduced motion**

All dialogs must return focus to the opening button. Every status must include visible text.
At 200% zoom no page-level horizontal scrollbar may appear. The reduced-motion rule disables
drawer and scroll animations while retaining focus and state changes.

- [ ] **Step 7: Align loading, empty, error and network states**

Update `app/staff/loading.jsx` to match the single-column task/workspace geometry. Keep
`app/staff/error.jsx` as a client error boundary with a visible `reset()` action. Every empty
list must say why it is empty and, when a filter is active, offer «Сбросить фильтр». Existing
network catches must preserve the current form draft, show a safe retry message and avoid
optimistic success.

- [ ] **Step 8: Run full checks and commit**

Run: `npm.cmd test`

Expected: all tests PASS.

Run: `npm.cmd run build`

Expected: exit `0`.

Run: `git diff --check`

Expected: no output.

```bash
git add features/staff/staff-navigation.jsx features/staff/staff-client.jsx features/staff/staff.module.css app/staff/loading.jsx app/staff/error.jsx tests/staff-cabinet.test.mjs tests/mobile-layout.test.mjs tests/accessibility-polish.test.mjs
git commit -m "style: simplify staff workspace controls"
```

### Task 6: Browser verification and documentation

**Files:**
- Modify: `docs/cabinet-mvp.md`

**Interfaces:**
- Consumes: local/Preview build and synthetic lawyer/admin accounts only.
- Produces: verified evidence for daily tasks, all existing operations and mobile/accessibility behavior.

- [ ] **Step 1: Run static gates before opening the browser**

Run: `npm.cmd test`

Expected: all tests PASS.

Run: `npm.cmd run build`

Expected: exit `0`.

- [ ] **Step 2: Verify the administrator journey**

With synthetic data:

1. Open «Сегодня» and confirm there is no persistent right-side case panel.
2. Open a task, change stage, return to «Сегодня» and use browser Back/Forward.
3. Open documents, create a synthetic request, send a synthetic message and edit metadata.
4. Create a synthetic matter through the existing two-step assignment dialog.
5. Open «Ещё → Журнал» and confirm no message body, email or filename is displayed.

- [ ] **Step 3: Verify the lawyer authorization boundary**

Confirm the lawyer can work only with assigned matters and cannot see the management tab,
assignment controls, audit or future trash controls. Attempt protected actions through their
server endpoints and confirm a safe authorization error.

- [ ] **Step 4: Verify mobile and accessibility behavior**

At `390x844`, check navigation, list-to-workspace transition, long titles, tab scrolling,
dialogs, keyboard focus, 200% zoom and reduced motion. Compare screenshots with the current
workspace reference to confirm the brand style is unchanged.

- [ ] **Step 5: Update documentation and commit**

Record observed behavior, commands and known limitations in `docs/cabinet-mvp.md`. Do not
claim Preview or Production deployment unless performed.

Run: `git diff --check`

Expected: no output.

```bash
git add docs/cabinet-mvp.md
git commit -m "docs: record simplified staff workspace"
```
