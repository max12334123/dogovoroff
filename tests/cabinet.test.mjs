import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CABINET_CASES,
  CABINET_VIEWS,
  EMPTY_CABINET_STEPS,
  getMatterById,
} from "../features/cabinet/cabinet-data.mjs";
import {
  AI_PRECHECK_HREF,
  LEAD_FORM_HREF,
  getRequestModeFromSearch,
} from "../lib/public-navigation.mjs";

const [clientSource, matterComponentsSource, overviewSource, actionDomainSource, navigationSource, pageSource, cssSource, homeSource, actionsSource, serverSource, nextConfigSource] = await Promise.all([
  readFile(new URL("../features/cabinet/cabinet-client.jsx", import.meta.url), "utf8"),
  readFile(new URL("../features/cabinet/cabinet-matter-components.jsx", import.meta.url), "utf8"),
  readFile(new URL("../features/cabinet/cabinet-overview.jsx", import.meta.url), "utf8"),
  readFile(new URL("../features/cabinet/cabinet-navigation-domain.mjs", import.meta.url), "utf8"),
  readFile(new URL("../features/cabinet/cabinet-navigation.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/cabinet/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../features/cabinet/cabinet.module.css", import.meta.url), "utf8"),
  readFile(new URL("../app/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../features/cabinet/cabinet-actions.js", import.meta.url), "utf8"),
  readFile(new URL("../features/cabinet/cabinet-server.js", import.meta.url), "utf8"),
  readFile(new URL("../next.config.mjs", import.meta.url), "utf8"),
]);
const componentSource = [clientSource, matterComponentsSource, overviewSource, actionDomainSource].join("\n");

test("cabinet data keeps the client journey explicit and stable", () => {
  assert.deepEqual(CABINET_VIEWS.map((view) => view.id), ["overview", "matters", "documents", "messages"]);
  assert.equal(CABINET_CASES.length, 2);
  assert.equal(getMatterById("missing").id, CABINET_CASES[0].id);
  assert.equal(getMatterById("missing", []), null);
  assert.ok(CABINET_CASES[0].stages.some((stage) => stage.status === "current"));
  assert.ok(CABINET_CASES[0].nextAction);
  assert.equal(CABINET_CASES[1].nextAction, null);
});

test("empty cabinet guides a newly registered client without storing onboarding state", () => {
  assert.deepEqual(
    EMPTY_CABINET_STEPS.map(({ id, state }) => [id, state]),
    [
      ["account", "complete"],
      ["request", "current"],
      ["matter", "future"],
    ],
  );
  assert.match(componentSource, /aria-label="Первые шаги в личном кабинете"/);
  assert.match(componentSource, /EMPTY_CABINET_STEPS\.map/);
  assert.match(componentSource, /После назначения дела здесь откроются документы и сообщения/);
  assert.doesNotMatch(componentSource, /localStorage|sessionStorage/);
});

test("cabinet UI is client-facing, accessible, and connected to private matter operations", () => {
  assert.match(navigationSource, /aria-label="Разделы личного кабинета"/);
  assert.match(componentSource, /aria-live="polite"/);
  assert.match(componentSource, /type="file"/);
  assert.match(componentSource, /Приватном хранилище|приватном хранилище/);
  assert.match(componentSource, /Отправить сообщение/);
  assert.match(componentSource, /messageIdRef/);
  assert.match(componentSource, /createUuidV4/);
  assert.match(componentSource, /\.upload\(storagePath, file/);
  assert.match(componentSource, /\.download\(document\.storagePath\)/);
  assert.match(actionsSource, /getClaims\(\)/);
  assert.match(actionsSource, /from\("messages"\)\.insert/);
  assert.match(actionsSource, /23505/);
  assert.match(actionsSource, /message\.id/);
  assert.match(actionsSource, /\.list\(location\.folder/);
  assert.match(actionsSource, /validateStoredDocumentObject/);
  assert.match(serverSource, /storage_path/);
  assert.match(nextConfigSource, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.doesNotMatch(componentSource, /localStorage|sessionStorage|fetch\(|dangerouslySetInnerHTML/);
  assert.doesNotMatch(actionsSource, /service_role|SUPABASE_SERVICE/);
  assert.doesNotMatch(componentSource, /Вопросы юриста|рабочая сводка|внутренняя инструкция/i);
});

test("cabinet keeps completed matters read-only and uses stable semantic identifiers", () => {
  assert.match(componentSource, /matter\.state === "completed" \|\| matter\.state === "archived"/);
  assert.match(componentSource, /key=\{stage\.id \?\? `\$\{stage\.title\}-\$\{index\}`\}/);
  assert.match(componentSource, /dateTime=\{document\.updatedAt \|\| undefined\}/);
  assert.match(serverSource, /updatedAt: document\.updated_at/);
});

test("cabinet keeps requested files distinct from ordinary documents", () => {
  assert.match(componentSource, /ClientDocumentRequests/);
  assert.match(componentSource, /clientPrimaryDocumentRequest/);
  assert.match(componentSource, /document\.requestId === null/);
  assert.match(componentSource, /Других документов пока нет\./);
});

test("client views avoid duplicate full registries and preserve protected actions", () => {
  assert.match(componentSource, /Мои дела/);
  assert.match(componentSource, /Материалы дела/);
  assert.match(componentSource, /Связь по делу/);
  assert.match(componentSource, /ClientDocumentRequests/);
  assert.match(componentSource, /sendMatterMessage/);
  assert.match(componentSource, /Несохранённое сообщение/);
  assert.match(clientSource, /<h2 className=\{styles\.userTitle\} id="matter-details-title">\{matter\.title\}<\/h2>/);
  assert.doesNotMatch(componentSource, /overviewGrid/);
});

test("client navigation protects a non-empty message draft before changing view or matter", () => {
  assert.match(clientSource, /const \[pendingNavigation, setPendingNavigation\] = useState\(null\)/);
  assert.match(clientSource, /const requestNavigation = \(view, matterId = activeMatterId\) =>/);
  assert.match(clientSource, /if \(view === activeView && matterId === activeMatterId\) \{\s*return;\s*\}/);
  assert.match(clientSource, /activeView === "messages" && draft\.trim\(\)/);
  assert.match(clientSource, /setPendingNavigation\(\{ view, matterId \}\)/);
  assert.match(clientSource, /const discardDraftAndContinue = \(\) =>/);
  assert.match(clientSource, /setDraft\(""\)[\s\S]*selectView\(next\.view, next\.matterId\)/);
  assert.match(clientSource, /<UnsavedMessageDialog/);
  assert.match(clientSource, /onNavigate=\{requestNavigation\}/);
  assert.match(clientSource, /onSelectView=\{requestNavigation\}/);
  assert.match(clientSource, /focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(clientSource, /scrollIntoView/);
});

test("history navigation focuses the main landmark and clears a stale pending destination", () => {
  assert.match(clientSource, /const scheduleMainFocus = \(\) =>/);
  assert.match(clientSource, /setPendingNavigation\(null\)[\s\S]*setActiveMatterId\(next\.matterId\)/);
  assert.match(clientSource, /window\.addEventListener\("popstate", handlePopState\)/);
  assert.match(clientSource, /applyCabinetLocation\(next\);\s*scheduleMainFocus\(\);/);
  assert.equal((clientSource.match(/scheduleMainFocus\(\);/g) ?? []).length, 2);
});

test("private cabinet route is excluded from search and linked from the public navigation", () => {
  assert.match(pageSource, /index:\s*false/);
  assert.match(pageSource, /follow:\s*false/);
  assert.match(pageSource, /noarchive:\s*true/);
  assert.match(homeSource, /href="\/cabinet">Кабинет/);
  assert.match(homeSource, /href="\/cabinet">Личный кабинет/);
});

test("cabinet actions use working public lead-form deep links", () => {
  assert.equal(AI_PRECHECK_HREF, "/?mode=precheck#lead-form");
  assert.equal(LEAD_FORM_HREF, "/#lead-form");
  assert.equal(getRequestModeFromSearch("?mode=precheck"), "precheck");
  assert.equal(getRequestModeFromSearch("?mode=unknown"), "quick");
  assert.equal(getRequestModeFromSearch(""), "quick");
  assert.doesNotMatch(componentSource, /\/ai-precheck|#contact/);
  assert.match(componentSource, /href=\{AI_PRECHECK_HREF\}/);
  assert.match(componentSource, /href=\{LEAD_FORM_HREF\}/);
  assert.match(homeSource, /getRequestModeFromSearch\(window\.location\.search\)/);
  assert.match(homeSource, /window\.location\.hash === "#lead-form"/);
  assert.match(homeSource, /window\.setTimeout\(scrollToLeadForm/);
});

test("cabinet layout includes mobile and reduced-motion protection", () => {
  assert.match(cssSource, /@media \(max-width: 940px\)/);
  assert.match(cssSource, /@media \(max-width: 680px\)/);
  assert.match(cssSource, /@media \(max-width: 420px\)/);
  assert.match(cssSource, /@media \(max-width: 360px\)/);
  assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(cssSource, /overflow-wrap:\s*anywhere/);
  assert.match(componentSource, /focus\(\{ preventScroll: true \}\)/);
  assert.match(cssSource, /scroll-margin-top:\s*116px/);
});

test("cabinet controls use one readable hierarchy", () => {
  assert.match(cssSource, /--cabinet-body-size:\s*16px/);
  assert.match(cssSource, /--cabinet-control-size:\s*14px/);
  assert.match(cssSource, /--cabinet-control-height:\s*44px/);
  assert.match(cssSource, /min-height:\s*44px/);
  assert.match(cssSource, /\.primaryButton/);
  assert.match(cssSource, /\.secondaryButton/);
  assert.match(cssSource, /\.textAction/);
  assert.match(cssSource, /\.dangerButton/);
  assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(cssSource, /\.shell\s+:where\(button, input, textarea, summary\)/);
  assert.match(cssSource, /\.topNavButton strong\s*\{\s*font:\s*inherit/);
  assert.doesNotMatch(cssSource, /\.shell button,\s*\n\.shell input/);
});

test("shared cabinet controls do not carry overview layout into error actions", () => {
  const primaryButtonBlock = cssSource.match(/\.primaryButton\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.doesNotMatch(primaryButtonBlock, /(?:width|margin-top)\s*:/);
  assert.match(
    cssSource,
    /\.primaryActionPanel \.primaryButton\s*\{[^}]*width:\s*min\(100%, 360px\)[^}]*margin-top:\s*34px/,
  );
});

test("reduced motion also covers cabinet error controls", () => {
  assert.match(
    cssSource,
    /\.stateShell \*,\s*\.stateShell \*::before,\s*\.stateShell \*::after\s*\{[\s\S]*transition-duration:\s*0\.01ms[\s\S]*animation-duration:\s*0\.01ms/,
  );
});

test("cabinet navigation uses allowlisted URL state and keeps AI in the header", () => {
  assert.match(componentSource, /parseCabinetLocation/);
  assert.match(componentSource, /popstate/);
  assert.match(componentSource, /history\.pushState/);
  assert.match(navigationSource, /AI-разбор/);
  assert.match(navigationSource, /Главная/);
  assert.match(navigationSource, /Мои дела/);
  assert.doesNotMatch(navigationSource, /localStorage|sessionStorage/);
});

test("cabinet location transitions clear matter-scoped feedback through selection and history paths", () => {
  assert.match(componentSource, /const activeMatterIdRef = useRef\(/);
  assert.match(componentSource, /const applyCabinetLocation = \(next\) =>/);
  assert.equal((componentSource.match(/applyCabinetLocation\(next\);/g) ?? []).length, 3);
  assert.match(componentSource, /setDraft\(""\)[\s\S]*setDocumentFeedback\(\{ tone: "neutral", text: "" \}\)/);
});

test("client overview leads with one primary action and quiet waiting copy", async () => {
  const source = await readFile(
    new URL("../features/cabinet/cabinet-overview.jsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /getClientPrimaryAction/);
  assert.match(source, /Что происходит по делу/);
  assert.match(actionDomainSource, /Сейчас от вас ничего не требуется/);
  assert.match(source, /<h2 id="client-primary-action-title">\{action\.title\}<\/h2>/);
  assert.equal((source.match(/styles\.primaryButton/g) ?? []).length, 1);
});

test("cabinet upload keeps a selected valid file after a network failure", () => {
  assert.match(
    clientSource,
    /if \(!registration\.ok\) \{[\s\S]*return;[\s\S]*setUploadFeedback\(\{ tone: "success", text: registration\.message \}\);[\s\S]*input\.value = "";/,
  );
  assert.doesNotMatch(
    clientSource,
    /finally \{\s*setIsUploading\(false\);\s*input\.value = "";\s*\}/,
  );
});

test("client overview promotes only actually unread message notifications", () => {
  assert.match(
    clientSource,
    /notification\.type === "message\.created" && notification\.unread === true/,
  );
});

test("condensed timeline renders only the current matter stage", () => {
  assert.match(
    matterComponentsSource,
    /const visibleStages = condensed\s*\? \[matter\.stages\[matter\.currentStage\]\]\.filter\(Boolean\)\s*:\s*matter\.stages/,
  );
  assert.match(matterComponentsSource, /visibleStages\.map\(\(stage, index\) =>/);
});

test("single condensed stage uses the available timeline width", () => {
  assert.match(
    cssSource,
    /\.timelineCondensed\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/,
  );
});
