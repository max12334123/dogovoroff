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

const [componentSource, pageSource, cssSource, homeSource, actionsSource, serverSource, nextConfigSource] = await Promise.all([
  readFile(new URL("../features/cabinet/cabinet-client.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/cabinet/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../features/cabinet/cabinet.module.css", import.meta.url), "utf8"),
  readFile(new URL("../app/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../features/cabinet/cabinet-actions.js", import.meta.url), "utf8"),
  readFile(new URL("../features/cabinet/cabinet-server.js", import.meta.url), "utf8"),
  readFile(new URL("../next.config.mjs", import.meta.url), "utf8"),
]);

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
  assert.match(componentSource, /aria-label="Навигация личного кабинета"/);
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
  assert.match(componentSource, /scrollIntoView\(\{ block: "start" \}\)/);
  assert.match(cssSource, /scroll-margin-top:\s*116px/);
});

test("cabinet controls use explicit typography roles without a high-specificity font reset", () => {
  assert.match(cssSource, /--cabinet-control-font-size:\s*10\.5px/);
  assert.match(cssSource, /--cabinet-primary-font-size:\s*11px/);
  assert.match(cssSource, /\.shell\s+:where\(button, input, textarea, summary\)/);
  assert.match(cssSource, /\.topNavButton strong\s*\{\s*font:\s*inherit/);
  assert.match(cssSource, /\.summaryHeading button[\s\S]*text-transform:\s*uppercase/);
  assert.doesNotMatch(cssSource, /\.shell button,\s*\n\.shell input/);
});
