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
