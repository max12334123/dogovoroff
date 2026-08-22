import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PRACTICE_PAGES } from "../app/practices/practice-data.js";

const [homeSource, indexSource, detailSource, sitemapSource] = await Promise.all([
  readFile(new URL("../app/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/practices/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/practices/[slug]/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/sitemap.js", import.meta.url), "utf8"),
]);

test("every published practice has a complete standalone page definition", () => {
  assert.equal(PRACTICE_PAGES.length, 5);
  assert.equal(new Set(PRACTICE_PAGES.map(({ slug }) => slug)).size, 5);

  for (const practice of PRACTICE_PAGES) {
    assert.match(practice.slug, /^[a-z0-9-]+$/);
    assert.ok(practice.seoTitle.length >= 20);
    assert.ok(practice.seoDescription.length >= 70);
    assert.equal(practice.situations.length, 4);
    assert.equal(practice.stages.length, 4);
    assert.equal(practice.outcomes.length, 4);
  }
});

test("practice routes are discoverable from the home page, directory, and sitemap", () => {
  assert.match(homeSource, /href={`\/practices\/\$\{practice\.slug\}`}/);
  assert.match(homeSource, /href="\/practices"/);
  assert.match(indexSource, /PRACTICE_PAGES\.map/);
  assert.match(detailSource, /generateStaticParams/);
  assert.match(detailSource, /generateMetadata/);
  assert.match(detailSource, /BreadcrumbList/);
  assert.match(sitemapSource, /PRACTICE_PAGES\.map/);
});

test("standalone practice copy does not restore FAS or procurement-dispute services", () => {
  const publishedCopy = JSON.stringify(PRACTICE_PAGES);
  assert.doesNotMatch(publishedCopy, /\bФАС\b/i);
  assert.doesNotMatch(publishedCopy, /жалоб[^.]{0,80}закуп/i);
  assert.doesNotMatch(publishedCopy, /спор[^.]{0,80}закуп/i);
});

test("practice calls to action preselect only a known service", () => {
  assert.match(detailSource, /encodeURIComponent\(practice\.service\)/);
  assert.match(homeSource, /item\.slug === requestedService \|\| item\.service === requestedService/);
});
