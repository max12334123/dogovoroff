# Client Cabinet Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перестроить клиентский кабинет вокруг одного ближайшего действия, сохранив дела, документы, сообщения, уведомления, AI-разбор и действующую Supabase-защиту.

**Architecture:** Сетевые операции и серверный контракт остаются в существующих модулях. Новые чистые функции определяют безопасное URL-состояние и главное действие, а крупный `cabinet-client.jsx` постепенно разделяется на навигацию, обзор и общие элементы дела. Query-параметры отражают только выбранный раздел и UUID/идентификатор уже загруженного дела; доступ продолжает ограничивать RLS.

**Tech Stack:** Next.js 15.5.21, React 19.1.5, JavaScript ESM, CSS Modules, Supabase SSR/JS, Node.js test runner.

**Spec:** `docs/superpowers/specs/2026-09-01-cabinet-ux-simplification-design.md`

## Global Constraints

- Сохранить текущие маршруты `/cabinet`, `/staff` и публичную кнопку «AI-разбор».
- Не добавлять production-зависимости.
- Не менять фирменные активы, палитру, базовые шрифты и художественное направление.
- На видимой области показывать не более одного основного действия.
- Минимальная активная область элемента — `44px`; мобильный текст полей — не меньше `16px`.
- Не хранить сообщения, имена файлов или черновики в `localStorage`/`sessionStorage`.
- Не ослаблять server actions, RLS или приватный Storage.
- Уважать `prefers-reduced-motion: reduce`.
- Не публиковать Preview или Production без отдельного разрешения.

---

## File Structure

- Create: `features/cabinet/cabinet-navigation-domain.mjs` — allowlist URL-состояния и выбор главного действия.
- Create: `features/cabinet/cabinet-navigation.jsx` — шапка, desktop/mobile-навигация и профиль.
- Create: `features/cabinet/cabinet-matter-components.jsx` — селектор дела, этапы, скачивание и базовая карточка действия.
- Create: `features/cabinet/cabinet-overview.jsx` — action-first главная клиента.
- Modify: `features/cabinet/cabinet-client.jsx` — состояние, операции загрузки/скачивания/сообщений и композиция экранов.
- Modify: `features/cabinet/cabinet-data.mjs` — утверждённые названия разделов.
- Modify: `features/cabinet/cabinet.module.css` — единая типографика, иерархия и мобильное поведение.
- Modify: `app/cabinet/loading.jsx`, `app/cabinet/error.jsx` — согласованные loading/error surfaces.
- Modify: `tests/cabinet.test.mjs` — структурные и регрессионные проверки интерфейса.
- Create: `tests/cabinet-navigation.test.mjs` — доменные проверки URL и главного действия.
- Modify: `docs/cabinet-mvp.md` — новое устройство клиентского кабинета после проверки.

### Task 1: URL state and primary-action domain

**Files:**
- Create: `features/cabinet/cabinet-navigation-domain.mjs`
- Create: `tests/cabinet-navigation.test.mjs`

**Interfaces:**
- Consumes: matter objects produced by `loadCabinetData()` and optional unread-message flag.
- Produces: `parseCabinetLocation(search, matters)`, `buildCabinetHref({ view, matterId })`, `getClientPrimaryAction(matter, options)` and `CLIENT_VIEW_IDS`.

- [ ] **Step 1: Write the failing domain tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCabinetHref,
  getClientPrimaryAction,
  parseCabinetLocation,
} from "../features/cabinet/cabinet-navigation-domain.mjs";

const matters = [
  { id: "matter-a", nextAction: { title: "Подписать акт", description: "Проверьте данные." }, documentRequests: [] },
  { id: "matter-b", nextAction: null, documentRequests: [] },
];

test("cabinet location accepts only a loaded matter and known view", () => {
  assert.deepEqual(parseCabinetLocation("?view=documents&matter=matter-b", matters), {
    view: "documents",
    matterId: "matter-b",
  });
  assert.deepEqual(parseCabinetLocation("?view=admin&matter=foreign", matters), {
    view: "overview",
    matterId: "matter-a",
  });
});

test("cabinet href contains no client text", () => {
  assert.equal(buildCabinetHref({ view: "messages", matterId: "matter-a" }), "/cabinet?view=messages&matter=matter-a");
  assert.equal(buildCabinetHref({ view: "overview", matterId: null }), "/cabinet");
});

test("returned document request outranks the generic next action", () => {
  const action = getClientPrimaryAction({
    ...matters[0],
    clientPrimaryDocumentRequest: {
      status: "changes_requested",
      title: "Документы по договору",
      lastReviewNote: "Добавьте последнюю страницу.",
    },
  });
  assert.deepEqual(action, {
    kind: "document_changes",
    eyebrow: "Требуется от вас",
    title: "Исправьте комплект документов",
    description: "Добавьте последнюю страницу.",
    label: "Открыть запрос",
    targetView: "documents",
  });
});

test("quiet matter has no artificial call to action", () => {
  assert.deepEqual(getClientPrimaryAction(matters[1]), {
    kind: "waiting",
    eyebrow: "Текущий статус",
    title: "Сейчас от вас ничего не требуется",
    description: "Юрист работает с материалами. Мы сообщим, когда потребуется ваше участие.",
    label: null,
    targetView: null,
  });
});

test("completed matter links to its final documents", () => {
  assert.deepEqual(getClientPrimaryAction({ ...matters[1], state: "completed" }), {
    kind: "completed",
    eyebrow: "Дело завершено",
    title: "Итоговые материалы готовы",
    description: "Документы и рекомендации остаются доступны в защищённом кабинете.",
    label: "Открыть документы",
    targetView: "documents",
  });
});
```

- [ ] **Step 2: Run the new test and verify the missing-module failure**

Run: `node --test tests/cabinet-navigation.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `cabinet-navigation-domain.mjs`.

- [ ] **Step 3: Implement the pure domain module**

```js
export const CLIENT_VIEW_IDS = Object.freeze(["overview", "matters", "documents", "messages"]);
const CLIENT_VIEW_SET = new Set(CLIENT_VIEW_IDS);

function firstMatterId(matters) {
  return Array.isArray(matters) ? matters.find((matter) => typeof matter?.id === "string")?.id ?? null : null;
}

export function parseCabinetLocation(search, matters = []) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search || "");
  const requestedView = params.get("view");
  const requestedMatterId = params.get("matter");
  const matterId = matters.some((matter) => matter?.id === requestedMatterId)
    ? requestedMatterId
    : firstMatterId(matters);

  return {
    view: CLIENT_VIEW_SET.has(requestedView) ? requestedView : "overview",
    matterId,
  };
}

export function buildCabinetHref({ view = "overview", matterId = null } = {}) {
  const params = new URLSearchParams();
  if (CLIENT_VIEW_SET.has(view) && view !== "overview") params.set("view", view);
  if (typeof matterId === "string" && matterId) params.set("matter", matterId);
  const query = params.toString();
  return query ? `/cabinet?${query}` : "/cabinet";
}

export function getClientPrimaryAction(matter, { hasUnreadMessage = false } = {}) {
  const request = matter?.clientPrimaryDocumentRequest;
  if (request?.status === "changes_requested") {
    return {
      kind: "document_changes",
      eyebrow: "Требуется от вас",
      title: "Исправьте комплект документов",
      description: request.lastReviewNote || "Юрист оставил пояснение в запросе документов.",
      label: "Открыть запрос",
      targetView: "documents",
    };
  }
  if (request?.status === "requested") {
    return {
      kind: "document_request",
      eyebrow: "Требуется от вас",
      title: request.title || "Загрузите запрошенные документы",
      description: request.instructions || "Откройте запрос и приложите файлы.",
      label: "Добавить документы",
      targetView: "documents",
    };
  }
  if (matter?.nextAction) {
    return {
      kind: "next_action",
      eyebrow: "Ваш следующий шаг",
      title: matter.nextAction.title,
      description: matter.nextAction.description,
      label: "Открыть дело",
      targetView: "matters",
    };
  }
  if (matter?.state === "completed" || matter?.state === "archived") {
    return {
      kind: "completed",
      eyebrow: "Дело завершено",
      title: "Итоговые материалы готовы",
      description: "Документы и рекомендации остаются доступны в защищённом кабинете.",
      label: "Открыть документы",
      targetView: "documents",
    };
  }
  if (hasUnreadMessage) {
    return {
      kind: "message",
      eyebrow: "Новое сообщение",
      title: "Юрист написал по делу",
      description: "Откройте защищённую переписку, чтобы прочитать сообщение.",
      label: "Открыть сообщения",
      targetView: "messages",
    };
  }
  return {
    kind: "waiting",
    eyebrow: "Текущий статус",
    title: "Сейчас от вас ничего не требуется",
    description: "Юрист работает с материалами. Мы сообщим, когда потребуется ваше участие.",
    label: null,
    targetView: null,
  };
}
```

- [ ] **Step 4: Run the focused and full domain tests**

Run: `node --test tests/cabinet-navigation.test.mjs tests/cabinet.test.mjs tests/document-request-domain.test.mjs`

Expected: all tests PASS.

- [ ] **Step 5: Commit the domain boundary**

```bash
git add features/cabinet/cabinet-navigation-domain.mjs tests/cabinet-navigation.test.mjs
git commit -m "feat: add client cabinet navigation domain"
```

### Task 2: URL-aware navigation shell

**Files:**
- Create: `features/cabinet/cabinet-navigation.jsx`
- Modify: `features/cabinet/cabinet-client.jsx:1-72,484-788`
- Modify: `features/cabinet/cabinet-data.mjs:1-6`
- Modify: `tests/cabinet.test.mjs:20-129`

**Interfaces:**
- Consumes: `CLIENT_VIEW_IDS`, `buildCabinetHref`, `parseCabinetLocation`, current view/matter, notifications and profile props.
- Produces: `CabinetNavigation` and URL-synchronised `selectView(view, matterId, { replace })` behavior.

- [ ] **Step 1: Add failing structural assertions**

Append to `tests/cabinet.test.mjs`:

```js
test("cabinet navigation uses allowlisted URL state and keeps AI in the header", async () => {
  const navigationSource = await readFile(
    new URL("../features/cabinet/cabinet-navigation.jsx", import.meta.url),
    "utf8",
  );
  assert.match(componentSource, /parseCabinetLocation/);
  assert.match(componentSource, /popstate/);
  assert.match(componentSource, /history\.pushState/);
  assert.match(navigationSource, /AI-разбор/);
  assert.match(navigationSource, /Главная/);
  assert.match(navigationSource, /Мои дела/);
  assert.doesNotMatch(navigationSource, /localStorage|sessionStorage/);
});
```

- [ ] **Step 2: Run the assertion and verify it fails**

Run: `node --test tests/cabinet.test.mjs`

Expected: FAIL because `cabinet-navigation.jsx` does not exist.

- [ ] **Step 3: Rename the visible navigation copy**

Change `CABINET_VIEWS` to:

```js
export const CABINET_VIEWS = [
  { id: "overview", index: "01", label: "Главная" },
  { id: "matters", index: "02", label: "Мои дела" },
  { id: "documents", index: "03", label: "Документы" },
  { id: "messages", index: "04", label: "Сообщения" },
];
```

- [ ] **Step 4: Extract `CabinetNavigation` without changing account operations**

Create a client component with this public signature:

```jsx
export default function CabinetNavigation({
  activeView,
  displayName,
  hasMatters,
  headerPanel,
  notifications,
  onHeaderPanelChange,
  onNotificationOpen,
  onSelectView,
  staffHref,
}) {
  return (
    <>
      <header className={styles.header}>
        <Brand />
        <nav className={styles.topNav} aria-label="Разделы личного кабинета">
          {hasMatters ? CABINET_VIEWS.map((item) => (
            <ViewButton key={item.id} item={item} activeView={activeView} onSelect={onSelectView} compact />
          )) : null}
          <a className={styles.aiTopLink} href={AI_PRECHECK_HREF}>AI-разбор</a>
        </nav>
        <NotificationCenter
          notifications={notifications}
          open={headerPanel === "notifications"}
          onOpenChange={(open) => onHeaderPanelChange(open ? "notifications" : null)}
          onOpen={onNotificationOpen}
        />
        <details
          className={styles.profile}
          open={headerPanel === "profile"}
          onToggle={(event) => onHeaderPanelChange(event.currentTarget.open ? "profile" : null)}
        >
          <summary>{displayName}</summary>
          <div>
            <span>Подтверждённый аккаунт</span>
            {staffHref ? <a href={staffHref}>Рабочая панель</a> : null}
            <a href="/">Вернуться на сайт</a>
            <form action="/auth/signout" method="post"><button type="submit">Выйти</button></form>
          </div>
        </details>
      </header>
      {hasMatters ? (
        <nav className={styles.mobileNav} aria-label="Разделы личного кабинета на мобильном устройстве">
          {CABINET_VIEWS.map((item) => (
            <ViewButton key={item.id} item={item} activeView={activeView} onSelect={onSelectView} compact />
          ))}
        </nav>
      ) : null}
    </>
  );
}
```

Move `Brand`, `ViewButton`, header markup and mobile navigation from `cabinet-client.jsx`
into the new file. Remove the duplicate desktop rail: the desktop top navigation remains the
single primary navigation surface. Keep the existing `Image`, accessible labels and server
sign-out form verbatim. Do not move upload, download or message state.

- [ ] **Step 5: Synchronise navigation with browser history**

Inside `CabinetClient`, initialise from loaded data and add:

```jsx
useEffect(() => {
  const applyLocation = () => {
    const next = parseCabinetLocation(window.location.search, matters);
    setActiveView(next.view);
    setActiveMatterId(next.matterId);
  };
  applyLocation();
  window.addEventListener("popstate", applyLocation);
  return () => window.removeEventListener("popstate", applyLocation);
}, [matters]);

const selectView = (view, matterId = activeMatterId, { replace = false } = {}) => {
  const next = parseCabinetLocation(
    buildCabinetHref({ view, matterId }).split("?")[1] || "",
    matters,
  );
  window.history[replace ? "replaceState" : "pushState"](
    null,
    "",
    buildCabinetHref(next),
  );
  setActiveView(next.view);
  setActiveMatterId(next.matterId);
  setHeaderPanel(null);
  window.requestAnimationFrame(() => mainRef.current?.focus({ preventScroll: true }));
};
```

Retain the existing resets for message/document feedback when `matterId` changes. Route
notification clicks through the same function.

- [ ] **Step 6: Run navigation and cabinet tests**

Run: `node --test tests/cabinet-navigation.test.mjs tests/cabinet.test.mjs tests/notification-ui.test.mjs`

Expected: all tests PASS.

- [ ] **Step 7: Commit the navigation shell**

```bash
git add features/cabinet/cabinet-navigation.jsx features/cabinet/cabinet-client.jsx features/cabinet/cabinet-data.mjs tests/cabinet.test.mjs
git commit -m "refactor: simplify client cabinet navigation"
```

### Task 3: Action-first overview

**Files:**
- Create: `features/cabinet/cabinet-matter-components.jsx`
- Create: `features/cabinet/cabinet-overview.jsx`
- Modify: `features/cabinet/cabinet-client.jsx:20-477,684-788`
- Modify: `tests/cabinet.test.mjs`

**Interfaces:**
- Consumes: `getClientPrimaryAction(matter, { hasUnreadMessage })`, matter data, existing upload/download handlers.
- Produces: `CabinetOverview` plus shared `MatterSwitch`, `Timeline`, `DocumentRegister` and `UploadControl` exports.

- [ ] **Step 1: Add a failing source contract for the new overview**

```js
test("client overview leads with one primary action and quiet waiting copy", async () => {
  const source = await readFile(
    new URL("../features/cabinet/cabinet-overview.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /getClientPrimaryAction/);
  assert.match(source, /Что происходит по делу/);
  assert.match(source, /Сейчас от вас ничего не требуется/);
  assert.equal((source.match(/styles\.primaryButton/g) ?? []).length, 1);
});
```

- [ ] **Step 2: Run the cabinet test and verify the missing-file failure**

Run: `node --test tests/cabinet.test.mjs`

Expected: FAIL because `cabinet-overview.jsx` does not exist.

- [ ] **Step 3: Extract shared matter presentation components**

Move `MatterSwitch`, `Timeline`, `UploadControl` and `DocumentRegister` to
`cabinet-matter-components.jsx`. Preserve their existing prop names and accessible markup;
export each named component. Replace local definitions with imports before changing layout.

- [ ] **Step 4: Build the overview around the computed action**

Use this component contract and top-level structure:

```jsx
export default function CabinetOverview({
  matters,
  matter,
  hasUnreadMessage,
  documentFeedback,
  downloadingId,
  onDownload,
  onNavigate,
}) {
  const action = getClientPrimaryAction(matter, { hasUnreadMessage });
  return (
    <>
      <header className={styles.pageIntro}>
        <p className={styles.eyebrow}>Кабинет клиента</p>
        <h1>Добрый день</h1>
        <p>Что происходит по делу и требуется ли ваше участие.</p>
      </header>
      {matters.length > 1 ? (
        <MatterSwitch matters={matters} activeMatterId={matter.id} onSelect={(id) => onNavigate("overview", id)} />
      ) : null}
      <section className={styles.primaryActionPanel} aria-labelledby="client-primary-action-title">
        <p className={styles.eyebrow}>{action.eyebrow}</p>
        <h2 id="client-primary-action-title">{action.title}</h2>
        <p>{action.description}</p>
        {action.label ? (
          <button className={styles.primaryButton} type="button" onClick={() => onNavigate(action.targetView, matter.id)}>
            {action.label}
          </button>
        ) : null}
      </section>
      <section className={styles.currentStagePanel} aria-labelledby="client-current-stage-title">
        <p className={styles.eyebrow}>Текущий этап</p>
        <h2 id="client-current-stage-title">{matter.stages[matter.currentStage]?.title || "Этап уточняется"}</h2>
        <Timeline matter={matter} condensed />
      </section>
      <section className={styles.summaryPanel} aria-labelledby="client-latest-message-title">
        <p className={styles.eyebrow}>Последнее сообщение</p>
        <h2 id="client-latest-message-title">{matter.messages[0]?.sender || "Сообщений пока нет"}</h2>
        {matter.messages[0] ? <p>{matter.messages[0].text}</p> : null}
        <button className={styles.textAction} type="button" onClick={() => onNavigate("messages", matter.id)}>Все сообщения</button>
      </section>
      <section className={styles.summaryPanel} aria-labelledby="client-latest-documents-title">
        <p className={styles.eyebrow}>Последние документы</p>
        <h2 className={styles.visuallyHidden} id="client-latest-documents-title">Последние документы по делу</h2>
        <DocumentRegister documents={matter.documents.slice(0, 3)} compact feedback={documentFeedback} downloadingId={downloadingId} onDownload={onDownload} />
        <button className={styles.textAction} type="button" onClick={() => onNavigate("documents", matter.id)}>Все документы</button>
      </section>
    </>
  );
}
```

The remaining three summary blocks must contain only one current stage, one latest message
and three latest documents. Their links are secondary text actions.

- [ ] **Step 5: Wire unread-message state without exposing message text**

Compute the flag in `CabinetClient`:

```js
const hasUnreadMessage = initialNotifications.some((notification) => (
  notification.matterId === matter?.id && notification.type === "message.created"
));
```

Pass only the boolean to `CabinetOverview`; do not place notification contents in the action
domain or URL.

- [ ] **Step 6: Run the focused test set**

Run: `node --test tests/cabinet-navigation.test.mjs tests/cabinet.test.mjs tests/notification-domain.test.mjs tests/document-request-ui.test.mjs`

Expected: all tests PASS.

- [ ] **Step 7: Commit the action-first overview**

```bash
git add features/cabinet/cabinet-matter-components.jsx features/cabinet/cabinet-overview.jsx features/cabinet/cabinet-client.jsx tests/cabinet.test.mjs
git commit -m "feat: make client cabinet action first"
```

### Task 4: Focused case, document and message views

**Files:**
- Modify: `features/cabinet/cabinet-client.jsx:289-447,684-788`
- Modify: `features/cabinet/cabinet-matter-components.jsx`
- Modify: `features/cabinet/cabinet.module.css`
- Modify: `tests/cabinet.test.mjs`

**Interfaces:**
- Consumes: current matter and existing document/message handlers.
- Produces: consistent case header, compact matter selector and focused `Обзор`, `Документы`, `Сообщения` surfaces.

- [ ] **Step 1: Add regression assertions for focused views**

```js
test("client views avoid duplicate full registries and preserve protected actions", () => {
  assert.match(componentSource, /Мои дела/);
  assert.match(componentSource, /Материалы дела/);
  assert.match(componentSource, /Связь по делу/);
  assert.match(componentSource, /ClientDocumentRequests/);
  assert.match(componentSource, /sendMatterMessage/);
  assert.match(componentSource, /Несохранённое сообщение/);
  assert.doesNotMatch(componentSource, /overviewGrid/);
});
```

- [ ] **Step 2: Run the regression and observe the old-grid failure**

Run: `node --test tests/cabinet.test.mjs`

Expected: FAIL while the old overview grid remains.

- [ ] **Step 3: Apply the focused-view composition**

For each non-home view, render in this order:

```jsx
<header className={styles.caseHeader}>
  <button className={styles.backAction} type="button" onClick={() => onNavigate("overview", matter.id)}>
    Назад на главную
  </button>
  <p className={styles.eyebrow}>{matter.reference}</p>
  <h1>{matter.title}</h1>
  <span className={styles.statusText}>{matter.stateLabel}</span>
</header>
```

Show `MatterSwitch` only when `matters.length > 1`. Keep `ClientDocumentRequests`, ordinary
documents, file upload, authorised download and idempotent message submission unchanged.
Remove duplicated overview-only upload controls after the new primary action routes to the
correct document section.

- [ ] **Step 4: Preserve focus and long-content behavior**

After every view change, focus `#cabinet-main` without forced smooth scrolling. Apply
`overflow-wrap: anywhere` only to user-supplied titles and filenames, not all controls.

When the message draft is non-empty, route navigation through a confirmation dialog titled
«Несохранённое сообщение» with actions «Продолжить писать» and «Не сохранять». Store the
pending `{ view, matterId }` only in component state; confirming discard clears the draft and
continues through the same allowlisted `selectView` function.

```js
const [pendingNavigation, setPendingNavigation] = useState(null);
const requestNavigation = (view, matterId = activeMatterId) => {
  if (activeView === "messages" && draft.trim()) {
    setPendingNavigation({ view, matterId });
    return;
  }
  selectView(view, matterId);
};
const discardDraftAndContinue = () => {
  const next = pendingNavigation;
  setPendingNavigation(null);
  setDraft("");
  if (next) selectView(next.view, next.matterId);
};
```

- [ ] **Step 5: Run protected-operation tests**

Run: `node --test tests/cabinet.test.mjs tests/cabinet-write-domain.test.mjs tests/cabinet-server.test.mjs tests/document-request-actions.test.mjs tests/document-request-ui.test.mjs`

Expected: all tests PASS; no test indicates a public URL or service credential.

- [ ] **Step 6: Commit the focused views**

```bash
git add features/cabinet/cabinet-client.jsx features/cabinet/cabinet-matter-components.jsx features/cabinet/cabinet.module.css tests/cabinet.test.mjs
git commit -m "refactor: focus client case views"
```

### Task 5: Unified controls, mobile layout and accessibility

**Files:**
- Modify: `features/cabinet/cabinet.module.css:1-1641`
- Modify: `app/cabinet/loading.jsx`
- Modify: `app/cabinet/error.jsx`
- Modify: `features/cabinet/cabinet-navigation.jsx`
- Modify: `features/cabinet/cabinet-overview.jsx`
- Modify: `tests/cabinet.test.mjs`
- Modify: `tests/mobile-layout.test.mjs`
- Modify: `tests/accessibility-polish.test.mjs`

**Interfaces:**
- Consumes: existing CSS module class names and the current visual system.
- Produces: `primaryButton`, `secondaryButton`, `textAction`, `dangerButton`, predictable mobile navigation and reduced-motion behavior.

- [ ] **Step 1: Replace obsolete typography assertions with the approved scale**

```js
test("cabinet controls use one readable hierarchy", () => {
  assert.match(cssSource, /--cabinet-body-size:\s*16px/);
  assert.match(cssSource, /--cabinet-control-size:\s*14px/);
  assert.match(cssSource, /min-height:\s*44px/);
  assert.match(cssSource, /\.primaryButton/);
  assert.match(cssSource, /\.secondaryButton/);
  assert.match(cssSource, /\.textAction/);
  assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)/);
});
```

- [ ] **Step 2: Run tests and verify they fail on the old 9.5–13px control scale**

Run: `node --test tests/cabinet.test.mjs tests/mobile-layout.test.mjs tests/accessibility-polish.test.mjs`

Expected: FAIL on missing tokens or classes.

- [ ] **Step 3: Introduce control tokens and shared states**

At `.shell` define:

```css
--cabinet-body-size: 16px;
--cabinet-control-size: 14px;
--cabinet-control-height: 44px;
--cabinet-motion-fast: 180ms;
--cabinet-motion-slow: 360ms;
```

Give all four action roles the same control font, letter spacing and minimum height. Keep the
existing black, white and cold-blue values. Destructive color remains reserved for future
trash UI and is not used in the client cabinet.

- [ ] **Step 4: Make mobile navigation and forms resilient**

At `max-width: 680px`:

```css
.mobileNav { grid-template-columns: repeat(4, minmax(84px, 1fr)); overflow-x: auto; }
.mobileNav button { min-height: 48px; font-size: 12px; white-space: nowrap; }
.main :is(input, select, textarea) { font-size: 16px; }
.caseHeader h1 { font-size: clamp(34px, 10vw, 50px); overflow-wrap: anywhere; }
```

Retain safe-area padding at the bottom and do not horizontally scroll the page itself.

- [ ] **Step 5: Verify keyboard and reduced-motion behavior in code**

Ensure the active view uses `aria-current="page"`, selected matter uses `aria-pressed`, status
text is visible, and the reduced-motion block sets transition/animation duration to near-zero
without removing focus outlines.

- [ ] **Step 6: Align loading, empty, error and offline feedback**

Keep `app/cabinet/loading.jsx` layout dimensions aligned with the new header and action panel.
Keep `app/cabinet/error.jsx` as a client error boundary with a visible «Повторить» button that
calls `reset()`. Network exceptions in upload/download/message handlers must preserve the
current input or selected file state where the browser permits it, show `role="status"`, and
never show a success message before the server result succeeds.

- [ ] **Step 7: Run all static and unit checks**

Run: `npm.cmd test`

Expected: all tests PASS.

Run: `npm.cmd run build`

Expected: Next.js production build exits `0`.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 8: Commit the visual consistency pass**

```bash
git add features/cabinet/cabinet.module.css features/cabinet/cabinet-navigation.jsx features/cabinet/cabinet-overview.jsx app/cabinet/loading.jsx app/cabinet/error.jsx tests/cabinet.test.mjs tests/mobile-layout.test.mjs tests/accessibility-polish.test.mjs
git commit -m "style: unify client cabinet controls"
```

### Task 6: Browser verification and documentation

**Files:**
- Modify: `docs/cabinet-mvp.md`

**Interfaces:**
- Consumes: a local or authorised Preview build with synthetic client data.
- Produces: evidence for desktop/mobile, keyboard, error/empty states and an updated MVP description.

- [ ] **Step 1: Start the verified local build**

Run: `npm.cmd run build`

Expected: exit `0`.

Run: `npm.cmd run start -- -p 4173`

Expected: server listens on port `4173` without runtime errors.

- [ ] **Step 2: Verify the synthetic client journey at desktop width**

Check in the user-selected browser:

1. Login and open `/cabinet`.
2. Confirm only one primary action is visible.
3. Open the action, download/upload only synthetic files, send a synthetic message.
4. Use browser Back/Forward and reload; the selected view and matter remain valid.
5. Confirm no message body, filename or title is present in the URL.

- [ ] **Step 3: Verify mobile and accessibility states**

At `390x844`, check all four navigation items, long matter title, 200% text zoom, keyboard
focus, VoiceOver-compatible labels and reduced motion. Capture matching desktop and mobile
screenshots using the current cabinet as the visual-style reference.

- [ ] **Step 4: Update the MVP document with observed behavior**

Document the action priority, URL navigation, mobile one-surface rule and the exact commands
that passed. Do not mark Preview or Production as deployed unless it was actually published.

- [ ] **Step 5: Final validation and commit**

Run: `npm.cmd test`

Expected: all tests PASS.

Run: `npm.cmd run build`

Expected: exit `0`.

Run: `git diff --check`

Expected: no output.

```bash
git add docs/cabinet-mvp.md
git commit -m "docs: record simplified client cabinet"
```
