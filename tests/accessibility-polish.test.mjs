import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [pageSource, cssSource] = await Promise.all([
  readFile(new URL("../app/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
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
