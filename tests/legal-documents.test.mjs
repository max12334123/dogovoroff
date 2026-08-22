import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [homeSource, legalSource, privacySource, consentSource, sitemapSource] = await Promise.all([
  readFile(new URL("../app/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/legal.js", import.meta.url), "utf8"),
  readFile(new URL("../app/privacy/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/personal-data-consent/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/sitemap.js", import.meta.url), "utf8"),
]);

test("privacy policy covers the core processing disclosures", () => {
  for (const requiredSection of [
    "Цели, субъекты и состав данных",
    "Правовые основания",
    "Действия, способы и сроки обработки",
    "Сервисы, получатели и трансграничная передача",
    "Права субъекта персональных данных",
    "Обращения, уточнение и отзыв согласия",
  ]) {
    assert.match(privacySource, new RegExp(requiredSection));
  }

  assert.match(privacySource, /Vercel Inc\./);
  assert.match(privacySource, /Vercel Speed Insights/);
  assert.doesNotMatch(privacySource, /jsDelivr/);
  assert.match(privacySource, /Отправить обращение/);
  assert.match(privacySource, /Web3Forms/);
  assert.match(privacySource, /Web3Creative/);
  assert.doesNotMatch(privacySource, /Resend/);
});

test("form links to separate policy and consent documents", () => {
  assert.match(homeSource, /href="\/privacy"/);
  assert.match(homeSource, /href="\/personal-data-consent"/);
  assert.match(homeSource, /fetch\("https:\/\/api\.web3forms\.com\/submit"/);
  assert.match(homeSource, /Отправить обращение/);
  assert.doesNotMatch(homeSource, /privacy-modal/);
});

test("legal pages identify the operator without publishing personal names or removed office details", () => {
  assert.match(sitemapSource, /\$\{SITE_URL\}\/privacy/);
  assert.match(sitemapSource, /\$\{SITE_URL\}\/personal-data-consent/);

  assert.match(legalSource, /operatorBrand: "«ДоговорОфф»"/);
  assert.match(legalSource, /самозанятый/);
  assert.match(legalSource, /город Нижневартовск/);
  assert.match(legalSource, /dogovor\.off@mail\.ru/);
  assert.match(legalSource, /operatorDetailsConfirmed: true/);

  const publicLegalSource = `${legalSource}\n${privacySource}\n${consentSource}`;
  assert.doesNotMatch(publicLegalSource, /Алимагомедов|Бадрудин|Нурмагомедович|Анастасия/i);
  assert.doesNotMatch(publicLegalSource, /Ленина\s*6|офис\s*402/i);
  assert.match(consentSource, /не означает подписку на рекламу/);
  assert.match(consentSource, /со дня отправки обращения через форму сайта или самостоятельной отправки письма/);
});
