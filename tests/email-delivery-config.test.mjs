import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [pageSource, routeSource, integrationsSource, configSource, envExampleSource] = await Promise.all([
  readFile(new URL("../app/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/contact/route.js", import.meta.url), "utf8"),
  readFile(new URL("../lib/contact-integrations.mjs", import.meta.url), "utf8"),
  readFile(new URL("../next.config.mjs", import.meta.url), "utf8"),
  readFile(new URL("../.env.example", import.meta.url), "utf8"),
]);

test("contact form uses the application-owned delivery boundary", () => {
  assert.match(pageSource, /fetch\("\/api\/contact"/);
  assert.match(pageSource, /Content-Type":\s*"application\/json"/);
  assert.doesNotMatch(pageSource, /api\.resend\.com|RESEND_API_KEY|api\.web3forms\.com/);

  assert.match(routeSource, /deliverContactIntegrations/);
  assert.match(routeSource, /validateContactPayload/);
  assert.match(routeSource, /isAllowedService/);
  assert.doesNotMatch(routeSource, /WEB3FORMS|api\.web3forms\.com/);
});

test("server email delivery is idempotent and configured with server-only variables", () => {
  assert.match(integrationsSource, /https:\/\/api\.resend\.com\/emails/);
  assert.match(integrationsSource, /Idempotency-Key/);
  assert.match(integrationsSource, /contact\/\$\{record\.submissionId\}/);
  assert.doesNotMatch(integrationsSource, /WEB3FORMS|api\.web3forms\.com/);

  for (const name of ["RESEND_API_KEY", "CONTACT_EMAIL_FROM", "CONTACT_EMAIL_TO"]) {
    assert.equal(
      envExampleSource.split(/\r?\n/).find((line) => line.startsWith(`${name}=`)),
      `${name}=`,
    );
    assert.doesNotMatch(envExampleSource, new RegExp(`NEXT_PUBLIC_${name}`));
  }
  assert.doesNotMatch(envExampleSource, /WEB3FORMS_ACCESS_KEY/);
  assert.match(configSource, /connect-src 'self'/);
  assert.match(configSource, /form-action 'self'/);
});
