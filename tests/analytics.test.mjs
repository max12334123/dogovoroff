import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [layoutSource, packageSource, privacySource, legalSource] = await Promise.all([
  readFile(new URL("../app/layout.js", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../app/privacy/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/legal.js", import.meta.url), "utf8"),
]);

test("Vercel Web Analytics is installed once at the application root", () => {
  const packageJson = JSON.parse(packageSource);

  assert.match(packageJson.dependencies["@vercel/analytics"], /^\^?2\./);
  assert.match(layoutSource, /import \{ Analytics \} from "@vercel\/analytics\/next"/);
  assert.equal(layoutSource.match(/<Analytics \/>/g)?.length, 1);
});

test("Vercel Speed Insights is installed once at the application root", () => {
  const packageJson = JSON.parse(packageSource);

  assert.match(packageJson.dependencies["@vercel/speed-insights"] ?? "", /^\^?2\./);
  assert.match(layoutSource, /import \{ SpeedInsights \} from "@vercel\/speed-insights\/next"/);
  assert.equal(layoutSource.match(/<SpeedInsights \/>/g)?.length, 1);
});

test("privacy policy transparently describes analytics without marketing tracking", () => {
  assert.match(privacySource, /Vercel Web Analytics/);
  assert.match(privacySource, /Vercel Speed Insights/);
  assert.match(privacySource, /Core Web Vitals/);
  assert.match(privacySource, /агрегированн/);
  assert.match(privacySource, /без рекламных идентификаторов/);
  assert.match(privacySource, /сторонних cookies/);
  assert.doesNotMatch(privacySource, /jsDelivr/);
  assert.doesNotMatch(privacySource, /сайт не использует[^.]*аналитик/i);
  assert.match(legalSource, /policyVersion: "1\.5"/);
  assert.match(legalSource, /effectiveDate: "24 августа 2026 года"/);
});
