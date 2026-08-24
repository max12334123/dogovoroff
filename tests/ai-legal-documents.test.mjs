import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  aiConsentSource,
  privacySource,
  personalConsentSource,
  legalSource,
  legalDocumentSource,
  sitemapSource,
  homeSource,
  precheckRouteSource,
  envExampleSource,
] = await Promise.all([
  readFile(new URL("../app/ai-processing-consent/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/privacy/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/personal-data-consent/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/legal.js", import.meta.url), "utf8"),
  readFile(new URL("../app/legal-document.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/sitemap.js", import.meta.url), "utf8"),
  readFile(new URL("../app/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/precheck/route.js", import.meta.url), "utf8"),
  readFile(new URL("../.env.example", import.meta.url), "utf8"),
]);

test("AI consent describes an optional and limited preliminary processing", () => {
  for (const requiredConcept of [
    /необязательн/i,
    /Cloudflare Workers AI/,
    /@cf\/zai-org\/glm-4\.7-flash/,
    /до формирования карты[^.]*им(?:я|ени)[^.]*телефон/is,
    /не создаёт собственного постоянного хранилища/i,
    /не направляется[^.]*Vercel Web Analytics/is,
    /по заявлению Cloudflare[\s\S]{0,500}не использует[^.]*обуч/i,
    /трансграничн/i,
    /детерминированн[^.]*без AI/is,
    /не является юридически значимым решением/i,
    /отозвать[^.]*письм/is,
    /отдельн[^.]*соглас[^.]*отправ[^.]*обращ/is,
  ]) {
    assert.match(aiConsentSource, requiredConcept);
  }

  assert.match(aiConsentSource, /mailto:\$\{LEGAL\.email\}/);
  assert.match(aiConsentSource, /регулярн[^.]*не гарантирует[^.]*вс(?:е|ех) идентификатор/is);
});

test("privacy policy discloses the complete AI data path and its safeguards", () => {
  assert.match(privacySource, /браузер[^→]*→[^→]*Vercel[^→]*→[^→]*Cloudflare Worker[^→]*→[^<]*Workers AI/is);
  assert.match(privacySource, /содерж(?:ание|имое) предварительного разбора[^.]*не передаётся[^.]*аналитик/is);
  assert.match(privacySource, /без отдельного согласия[^.]*детерминированн/is);
  assert.match(privacySource, /OIDC/i);
  assert.doesNotMatch(privacySource, /данные (?:хранятся|обрабатываются) только (?:в России|на территории Российской Федерации)/i);
});

test("AI processing has independent metadata, discoverability, and consent boundaries", () => {
  assert.match(legalSource, /policyVersion: "1\.6"/);
  assert.match(legalSource, /aiConsentVersion: "1\.0"/);
  assert.match(legalSource, /effectiveDate: "24 августа 2026 года"/);
  assert.match(legalDocumentSource, /documentVersion = LEGAL\.policyVersion/);
  assert.match(aiConsentSource, /documentVersion=\{LEGAL\.aiConsentVersion\}/);
  assert.match(precheckRouteSource, /consentVersion: LEGAL\.aiConsentVersion/);
  assert.match(sitemapSource, /\$\{SITE_URL\}\/ai-processing-consent/);
  assert.match(homeSource, /href="\/ai-processing-consent"/);
  assert.match(personalConsentSource, /отдельного согласия на использование AI/i);
  assert.match(envExampleSource, /AI_PRECHECK_ENABLED=false/);
});
