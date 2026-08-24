import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stylesSource = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

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

  assert.match(optionStyles, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(optionStyles, /min-width:\s*0/);
  assert.match(actionStyles, /flex-wrap:\s*wrap/);
});

test("long legal headings stay within narrow iOS viewports", () => {
  const phoneStyles = extractCssBlock(stylesSource, "@media (max-width: 560px)");
  const headingStyles = extractCssBlock(phoneStyles, ".legal-hero h1");

  assert.match(headingStyles, /font-size:\s*clamp\(40px,\s*12vw,\s*54px\)/);
  assert.match(headingStyles, /overflow-wrap:\s*anywhere/);
  assert.match(headingStyles, /hyphens:\s*auto/);
});
