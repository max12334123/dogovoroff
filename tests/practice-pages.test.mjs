import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { PRACTICES } from "../app/content.js";

const homeSource = readFileSync(new URL("../app/page.jsx", import.meta.url), "utf8");
const sitemapSource = readFileSync(new URL("../app/sitemap.js", import.meta.url), "utf8");
const globalsSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const routeFiles = [
  "../app/practices/page.jsx",
  "../app/practices/[slug]/page.jsx",
  "../app/practices/practice-chrome.jsx",
  "../app/practices/practice-data.js",
].map((path) => fileURLToPath(new URL(path, import.meta.url)));

test("practice information lives only in the original home-page section", () => {
  for (const routeFile of routeFiles) assert.equal(existsSync(routeFile), false);

  assert.doesNotMatch(homeSource, /href=[^\n>]*\/practices/);
  assert.doesNotMatch(sitemapSource, /\/practices/);
  assert.doesNotMatch(globalsSource, /\.practice-(?:page|header|index-hero|index-list|directory|footer|mobile-cta)/);
});

test("the original practice navigation and accordion are preserved", () => {
  assert.match(homeSource, /PRACTICES\.slice\(0, 4\)\.map\(\(practice\) => \(\s*<a key=\{practice\.number\} href="#practices">/s);
  assert.match(homeSource, /<a href="#practices">Практики<\/a>/);
  assert.doesNotMatch(homeSource, /practice-row__(?:actions|detail-link)|practice-directory-link|openPracticeFromHash/);
});

test("all original practice information remains unchanged", () => {
  assert.equal(PRACTICES.length, 5);
  assert.deepEqual(PRACTICES.map(({ number }) => number), ["01", "02", "03", "04", "05"]);
  assert.ok(PRACTICES.every((practice) => practice.details.length === 4));
  assert.ok(PRACTICES.every((practice) => !("slug" in practice)));

  const publishedCopy = JSON.stringify(PRACTICES);
  assert.doesNotMatch(publishedCopy, /\bФАС\b/i);
  assert.doesNotMatch(publishedCopy, /жалоб[^.]{0,80}закуп/i);
  assert.doesNotMatch(publishedCopy, /спор[^.]{0,80}закуп/i);
});
