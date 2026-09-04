import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [stylesSource, cabinetStylesSource] = await Promise.all([
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../features/cabinet/cabinet.module.css", import.meta.url), "utf8"),
]);

function extractCssBlock(source, marker) {
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `Missing CSS block: ${marker}`);

  const blockStart = source.indexOf("{", markerIndex);
  assert.notEqual(blockStart, -1, `Missing opening brace for: ${marker}`);

  let depth = 0;
  for (let index = blockStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(blockStart + 1, index);
  }

  assert.fail(`Missing closing brace for: ${marker}`);
}

test("mobile single-column grids can shrink inside the page shell", () => {
  const mobileStyles = extractCssBlock(stylesSource, "@media (max-width: 740px)");
  const gridStyles = extractCssBlock(mobileStyles, ".estimator__grid");

  assert.match(
    gridStyles,
    /grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    "Single-column mobile grids need a zero minimum track to avoid horizontal overflow",
  );
});

test("precheck controls remain single-column and wrappable at narrow phone widths", () => {
  const phoneStyles = extractCssBlock(stylesSource, "@media (max-width: 560px)");
  const optionStyles = extractCssBlock(phoneStyles, ".precheck__options");
  const actionStyles = extractCssBlock(phoneStyles, ".precheck__actions");
  const contactGridStyles = extractCssBlock(phoneStyles, ".precheck__contact-grid");

  assert.match(optionStyles, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(optionStyles, /min-width:\s*0/);
  assert.match(actionStyles, /flex-wrap:\s*wrap/);
  assert.match(contactGridStyles, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});

test("long legal headings stay within narrow iOS viewports", () => {
  const phoneStyles = extractCssBlock(stylesSource, "@media (max-width: 560px)");
  const headingStyles = extractCssBlock(phoneStyles, ".legal-hero h1");

  assert.match(headingStyles, /font-size:\s*clamp\(40px,\s*12vw,\s*54px\)/);
  assert.match(headingStyles, /overflow-wrap:\s*anywhere/);
  assert.match(headingStyles, /hyphens:\s*auto/);
});

test("cabinet mobile controls remain usable without widening the page", () => {
  const mobileStyles = extractCssBlock(cabinetStylesSource, "@media (max-width: 680px)");
  const navStyles = extractCssBlock(mobileStyles, ".mobileNav");
  const caseTitleStyles = extractCssBlock(mobileStyles, ".caseTitle");

  assert.match(navStyles, /grid-template-columns:\s*repeat\(4,\s*minmax\(84px,\s*1fr\)\)/);
  assert.match(navStyles, /overflow-x:\s*auto/);
  assert.match(mobileStyles, /\.mobileNav \.topNavButton\s*\{[\s\S]*min-height:\s*48px[\s\S]*font-size:\s*12px[\s\S]*white-space:\s*nowrap/);
  assert.match(mobileStyles, /\.main :is\(input, select, textarea\)\s*\{\s*font-size:\s*16px/);
  assert.match(caseTitleStyles, /font-size:\s*clamp\(34px,\s*10vw,\s*50px\)/);
  assert.match(caseTitleStyles, /overflow-wrap:\s*anywhere/);
});
