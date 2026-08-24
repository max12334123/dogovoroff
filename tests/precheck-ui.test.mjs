import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [componentSource, pageSource, cssSource] = await Promise.all([
  readFile(new URL("../features/precheck/precheck-section.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
]);

test("guided intake exposes five accessible steps and a live status", () => {
  assert.match(componentSource, /01\s*\/\s*05|padStart\(2, "0"\)/);
  assert.match(componentSource, /05\s*\/\s*05|TOTAL_STEPS\s*=\s*5/);
  assert.match(componentSource, /aria-live="polite"/);
  assert.match(componentSource, /tabIndex=\{-1\}/);
  assert.match(componentSource, /<fieldset/);
  assert.match(componentSource, /<legend/);
  assert.match(componentSource, /Карта сформирована в базовом режиме/);
});

test("AI consent is optional, unselected, and links to both transparency documents", () => {
  assert.match(componentSource, /checked=\{state\.aiConsent\}/);
  assert.match(componentSource, /Согласен на передачу очищенного описания в Cloudflare Workers AI/);
  assert.match(componentSource, /href="\/ai-processing-consent"/);
  assert.match(componentSource, /href="\/privacy"/);
  assert.match(componentSource, /Не указывайте ФИО, телефоны, адреса, реквизиты документов, банковские данные и сведения третьих лиц/);
  assert.doesNotMatch(componentSource, /localStorage|sessionStorage|dangerouslySetInnerHTML/);
});

test("quick form remains default and only estimator starts the precheck flow", () => {
  assert.match(pageSource, /useState\("quick"\)/);
  assert.match(pageSource, /Быстрая заявка/);
  assert.match(pageSource, /Предварительный разбор/);
  assert.match(pageSource, /Получить точную оценку[\s\S]{0,200}startPrecheck|startPrecheck[\s\S]{0,200}Получить точную оценку/);
  assert.match(pageSource, /Обсудить задачу[\s\S]{0,250}chooseService|chooseService[\s\S]{0,250}Обсудить задачу/);
  assert.match(pageSource, /Обсудить формат[\s\S]{0,250}chooseService|chooseService[\s\S]{0,250}Обсудить формат/);
});

test("precheck styles are scoped and include mobile overflow protection", () => {
  for (const selector of [
    ".request-mode",
    ".precheck",
    ".precheck__progress",
    ".precheck__options",
    ".precheck-card",
    ".precheck-card__list",
  ]) assert.match(cssSource, new RegExp(selector.replace(".", "\\.")));

  assert.match(cssSource, /@media \(max-width: 560px\)[\s\S]*?\.precheck__options[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(cssSource, /\.precheck[\s\S]*?min-width:\s*0/);
  assert.match(cssSource, /\.precheck[\s\S]*?overflow-wrap:\s*anywhere/);
  assert.match(cssSource, /padding-bottom:[^;]*env\(safe-area-inset-bottom\)/);
  assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.precheck__step/);
});
