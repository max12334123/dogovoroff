import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CABINET_CASES,
  CABINET_VIEWS,
  MAX_CLIENT_FILE_SIZE,
  getMatterById,
  validateClientUpload,
} from "../features/cabinet/cabinet-data.mjs";
import {
  AI_PRECHECK_HREF,
  LEAD_FORM_HREF,
  getRequestModeFromSearch,
} from "../lib/public-navigation.mjs";

const [componentSource, pageSource, cssSource, homeSource] = await Promise.all([
  readFile(new URL("../features/cabinet/cabinet-client.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/cabinet/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../features/cabinet/cabinet.module.css", import.meta.url), "utf8"),
  readFile(new URL("../app/page.jsx", import.meta.url), "utf8"),
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

test("prototype upload validation rejects unsafe or oversized files", () => {
  assert.deepEqual(validateClientUpload(), { valid: false, error: "Выберите файл." });
  assert.equal(validateClientUpload({ name: "archive.exe", size: 100 }).valid, false);
  assert.equal(validateClientUpload({ name: "empty.pdf", size: 0 }).valid, false);
  assert.equal(validateClientUpload({ name: "large.pdf", size: MAX_CLIENT_FILE_SIZE + 1 }).valid, false);
  assert.equal(validateClientUpload({ name: "contract.PDF", size: 1024 }).valid, true);
  assert.equal(validateClientUpload({ name: "scan.jpeg", size: 2048 }).valid, true);
});

test("cabinet UI is client-facing, accessible, and local-only in the prototype", () => {
  assert.match(componentSource, /aria-label="Навигация личного кабинета"/);
  assert.match(componentSource, /aria-live="polite"/);
  assert.match(componentSource, /type="file"/);
  assert.match(componentSource, /В прототипе файл не покидает устройство/);
  assert.match(componentSource, /Черновик хранится только до закрытия этой страницы и не отправляется/);
  assert.doesNotMatch(componentSource, /localStorage|sessionStorage|fetch\(|dangerouslySetInnerHTML/);
  assert.doesNotMatch(componentSource, /Вопросы юриста|рабочая сводка|внутренняя инструкция/i);
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
  assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(cssSource, /overflow-wrap:\s*anywhere/);
});
