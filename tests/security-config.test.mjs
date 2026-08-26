import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [configSource, layoutSource, pageSource, contactRouteSource, envExampleSource, healthRouteSource, globalStylesSource] = await Promise.all([
  readFile(new URL("../next.config.mjs", import.meta.url), "utf8"),
  readFile(new URL("../app/layout.js", import.meta.url), "utf8"),
  readFile(new URL("../app/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/contact/route.js", import.meta.url), "utf8"),
  readFile(new URL("../.env.example", import.meta.url), "utf8"),
  readFile(new URL("../app/api/health/route.js", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
]);

test("production responses include the security header baseline", () => {
  for (const header of [
    "Content-Security-Policy",
    "Referrer-Policy",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Permissions-Policy",
    "Strict-Transport-Security",
  ]) {
    assert.match(configSource, new RegExp(header));
  }
  assert.match(configSource, /frame-ancestors 'none'/);
  assert.match(configSource, /object-src 'none'/);
  assert.match(configSource, /poweredByHeader:\s*false/);
  assert.match(configSource, /isDevelopment \? " 'unsafe-eval'" : ""/);
  assert.doesNotMatch(configSource, /script-src 'self' 'unsafe-inline' 'unsafe-eval'/);
});

test("contact integration keeps all provider secrets outside the client bundle", () => {
  assert.doesNotMatch(pageSource, /WEB3FORMS_ACCESS_KEY|api\.web3forms\.com|RESEND_API_KEY|api\.resend\.com/);
  assert.match(contactRouteSource, /deliverContactIntegrations/);
  assert.doesNotMatch(contactRouteSource, /WEB3FORMS_ACCESS_KEY|api\.web3forms\.com/);
  assert.doesNotMatch(pageSource, /RESEND_API_KEY|CONTACT_FROM_EMAIL|CONTACT_TO_EMAIL/);
  assert.match(envExampleSource, /^RESEND_API_KEY=$/m);
  assert.match(envExampleSource, /^CONTACT_EMAIL_FROM=$/m);
  assert.match(envExampleSource, /^CONTACT_EMAIL_TO=$/m);
  assert.doesNotMatch(envExampleSource, /NEXT_PUBLIC_(?:RESEND|CONTACT_EMAIL)/);
});

test("brand fonts are self-hosted through next/font without an external CDN", () => {
  assert.match(layoutSource, /import \{ Cormorant_Garamond, Manrope \} from "next\/font\/google"/);
  assert.match(layoutSource, /variable: "--font-manrope"/);
  assert.match(layoutSource, /variable: "--font-cormorant"/);
  assert.match(layoutSource, /subsets: \["cyrillic", "latin"\]/);
  assert.match(globalStylesSource, /font-family: var\(--font-manrope\), Arial, sans-serif/);
  assert.match(globalStylesSource, /font-family: var\(--font-cormorant\), Georgia, serif/);
  assert.doesNotMatch(globalStylesSource, /@import|cdn\.jsdelivr\.net|@fontsource/);
  assert.doesNotMatch(configSource, /cdn\.jsdelivr\.net/);
});

test("health endpoint is non-cacheable and contains no sensitive details", () => {
  assert.match(healthRouteSource, /status: "ok"/);
  assert.match(healthRouteSource, /Cache-Control/);
  assert.doesNotMatch(healthRouteSource, /process\.env/);
});
