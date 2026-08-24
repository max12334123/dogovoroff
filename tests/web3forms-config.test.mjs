import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [pageSource, routeSource, configSource, envExampleSource, privacySource, consentSource] = await Promise.all([
  readFile(new URL("../app/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/contact/route.js", import.meta.url), "utf8"),
  readFile(new URL("../next.config.mjs", import.meta.url), "utf8"),
  readFile(new URL("../.env.example", import.meta.url), "utf8"),
  readFile(new URL("../app/privacy/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/personal-data-consent/page.jsx", import.meta.url), "utf8"),
]);

test("contact form uses the application-owned delivery boundary", () => {
  assert.match(pageSource, /fetch\("\/api\/contact"/);
  assert.match(pageSource, /Content-Type":\s*"application\/json"/);
  assert.doesNotMatch(pageSource, /api\.web3forms\.com|WEB3FORMS_ACCESS_KEY/);

  assert.match(routeSource, /https:\/\/api\.web3forms\.com\/submit/);
  assert.match(routeSource, /WEB3FORMS_ACCESS_KEY/);
  assert.match(routeSource, /validateContactPayload/);
  assert.match(routeSource, /isAllowedService/);
  assert.match(routeSource, /consent_timestamp/);
});

test("Web3Forms configuration stays server-side and native GET fallback is disabled", () => {
  const keyLine = envExampleSource.split(/\r?\n/).find((line) => line.startsWith("WEB3FORMS_ACCESS_KEY="));

  assert.equal(keyLine, "WEB3FORMS_ACCESS_KEY=");
  assert.doesNotMatch(envExampleSource, /NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY/);
  assert.doesNotMatch(envExampleSource, /RESEND_API_KEY|CONTACT_FROM_EMAIL|CONTACT_TO_EMAIL/);
  assert.match(configSource, /connect-src 'self'/);
  assert.doesNotMatch(configSource, /connect-src[^\n]*api\.web3forms\.com/);
  assert.match(configSource, /form-action 'none'/);
  assert.doesNotMatch(pageSource, /name="(?:website|name|phone|service|message)"/);
});

test("legal disclosures describe the active form processor", () => {
  const legalCopy = `${privacySource}\n${consentSource}`;

  assert.match(legalCopy, /Web3Forms/);
  assert.match(legalCopy, /Web3Creative/);
  assert.match(legalCopy, /серверн\S* обработчик/iu);
  assert.doesNotMatch(legalCopy, /Resend/);
});
