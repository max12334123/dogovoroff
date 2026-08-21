import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [pageSource, configSource, envExampleSource, privacySource, consentSource] = await Promise.all([
  readFile(new URL("../app/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../next.config.mjs", import.meta.url), "utf8"),
  readFile(new URL("../.env.example", import.meta.url), "utf8"),
  readFile(new URL("../app/privacy/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/personal-data-consent/page.jsx", import.meta.url), "utf8"),
]);

test("contact form uses the documented Web3Forms browser endpoint", () => {
  assert.match(pageSource, /https:\/\/api\.web3forms\.com\/submit/);
  assert.match(pageSource, /NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY/);
  assert.match(pageSource, /Content-Type":\s*"application\/json"/);
  assert.match(pageSource, /botcheck/);
  assert.doesNotMatch(pageSource, /fetch\("\/api\/contact"/);
});

test("Web3Forms configuration stays out of source control and is CSP-allowed", () => {
  const keyLine = envExampleSource.split(/\r?\n/).find((line) => line.startsWith("NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY="));

  assert.equal(keyLine, "NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY=");
  assert.doesNotMatch(envExampleSource, /RESEND_API_KEY|CONTACT_FROM_EMAIL|CONTACT_TO_EMAIL/);
  assert.match(configSource, /connect-src 'self' https:\/\/api\.web3forms\.com/);
});

test("legal disclosures describe the active form processor", () => {
  const legalCopy = `${privacySource}\n${consentSource}`;

  assert.match(legalCopy, /Web3Forms/);
  assert.match(legalCopy, /Web3Creative/);
  assert.doesNotMatch(legalCopy, /Resend/);
  assert.doesNotMatch(legalCopy, /серверн\S*\s+(?:функц|достав)/iu);
});
