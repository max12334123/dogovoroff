import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [componentSource, pageSource, cssSource] = await Promise.all([
  readFile(new URL("../features/precheck/precheck-section.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
]);

test("guided intake exposes two accessible steps and one final action", () => {
  assert.match(componentSource, /TOTAL_STEPS\s*=\s*2/);
  assert.match(componentSource, /\/ 02/);
  assert.match(componentSource, /aria-live="polite"/);
  assert.match(componentSource, /tabIndex=\{-1\}/);
  assert.match(componentSource, /<fieldset/);
  assert.match(componentSource, /<legend/);
  assert.match(componentSource, /Расскажите о ситуации/);
  assert.match(componentSource, /Как с вами связаться/);
  assert.match(componentSource, /Получить разбор и отправить заявку/);
  assert.doesNotMatch(componentSource, /Добавить к заявке|Сформировать карту/);
});

test("AI consent is optional, unselected, and links to both transparency documents", () => {
  assert.match(componentSource, /checked=\{aiConsent\}/);
  assert.match(componentSource, /Согласен на передачу очищенного описания в Cloudflare Workers AI/);
  assert.match(componentSource, /href="\/ai-processing-consent"/);
  assert.match(componentSource, /href="\/privacy"/);
  assert.match(componentSource, /Без ФИО, телефонов и реквизитов документов/);
  assert.doesNotMatch(componentSource, /localStorage|sessionStorage|dangerouslySetInnerHTML/);
});

test("precheck submits the generated card and contacts through one application boundary", () => {
  assert.match(componentSource, /onSubmitLead/);
  assert.match(componentSource, /await onSubmitLead\(/);
  assert.match(pageSource, /onSubmitLead=\{submitPrecheckLead\}/);
  assert.match(pageSource, /submitPrecheckLead[\s\S]{0,1800}deliverLead\(lead\)/);
  assert.doesNotMatch(componentSource, /onUseSummary/);
  assert.doesNotMatch(pageSource, /precheckAttachment|onUseSummary/);
});

test("quick form remains default while estimator and header can start the precheck flow", () => {
  assert.match(pageSource, /useState\("quick"\)/);
  assert.match(pageSource, /Быстрая заявка/);
  assert.match(pageSource, /Предварительный разбор/);
  assert.match(pageSource, /Получить точную оценку[\s\S]{0,200}startPrecheck|startPrecheck[\s\S]{0,200}Получить точную оценку/);
  assert.match(pageSource, /site-header__ai[\s\S]{0,500}onClick=\{startAiPrecheck\}[\s\S]{0,300}AI-разбор/);
  assert.match(pageSource, /mobile-nav__ai[\s\S]{0,300}onClick=\{startAiPrecheck\}[\s\S]{0,300}AI-разбор/);
  assert.match(pageSource, /Обсудить задачу[\s\S]{0,250}chooseService|chooseService[\s\S]{0,250}Обсудить задачу/);
  assert.match(pageSource, /Обсудить формат[\s\S]{0,250}chooseService|chooseService[\s\S]{0,250}Обсудить формат/);
  assert.match(pageSource, /form\.service \? practiceIdFromService\(form\.service\) : ""/);
});

test("header AI action follows the navigation style responsively", () => {
  assert.match(cssSource, /\.site-header__ai\s*\{[\s\S]{0,800}min-height:\s*40px/);
  assert.match(cssSource, /\.site-header__ai\s*\{[\s\S]{0,800}color:\s*#d4d4d1/);
  assert.match(cssSource, /\.site-header__ai\s*\{[\s\S]{0,800}background:\s*transparent/);
  assert.match(cssSource, /\.site-header__ai::after[\s\S]{0,500}height:\s*1px[\s\S]{0,300}background:\s*var\(--ice\)[\s\S]{0,300}transform:\s*scaleX\(0\)/);
  assert.match(cssSource, /\.site-header__ai:hover\s*\{[\s\S]{0,200}color:\s*var\(--white\)/);
  assert.match(cssSource, /@media \(max-width:\s*740px\)[\s\S]*?\.site-header__ai[\s\S]{0,500}min-height:\s*36px/);
  assert.match(cssSource, /@media \(max-width:\s*560px\)[\s\S]*?\.site-header__ai-full[\s\S]{0,200}display:\s*none/);
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
