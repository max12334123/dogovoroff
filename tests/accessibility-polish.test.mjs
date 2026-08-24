import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [pageSource, cssSource, effectsSource, legalDocumentSource] = await Promise.all([
  readFile(new URL("../app/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../app/effects.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/legal-document.jsx", import.meta.url), "utf8"),
]);

test("required lead fields expose their requirement before validation", () => {
  for (const id of ["lead-name", "lead-phone", "lead-service", "lead-consent"]) {
    assert.match(
      pageSource,
      new RegExp(`id="${id}"[\\s\\S]{0,700}aria-required="true" required`),
    );
  }
});

test("small utility copy receives the readability scale", () => {
  assert.match(cssSource, /\.field label,\s*\.field__error\s*{\s*font-size: 12px;/s);
  assert.match(cssSource, /\.site-footer__bottom,\s*\.legal-footer\s*{\s*font-size: 10\.5px;/s);
  assert.match(cssSource, /\.action,\s*\.mobile-action-bar a\s*{\s*font-size: 11px;/s);
});

test("skip links preserve native focus movement while animated anchors update history", () => {
  assert.match(pageSource, /<main id="main" tabIndex=\{-1\}>/);
  assert.match(legalDocumentSource, /<main id="legal-content" tabIndex=\{-1\}>/);
  assert.match(effectsSource, /link\.matches\("\.skip-link"\)/);
  assert.match(effectsSource, /target\.focus\(\{ preventScroll: true \}\)/);
  assert.match(effectsSource, /window\.history\.pushState\(null, "", id\)/);
});

test("lead form is inert before hydration and announces successful delivery", () => {
  assert.match(pageSource, /disabled=\{!hydrated \|\| submitState === "sending"\}/);
  assert.match(pageSource, /className="lead-success"[\s\S]{0,400}role="status"[\s\S]{0,200}aria-live="polite"/);
  assert.match(pageSource, /successRef\.current\?\.focus\(\)/);
});
