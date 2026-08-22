import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [configSource, pageSource, envExampleSource, healthRouteSource, globalStylesSource] = await Promise.all([
  readFile(new URL("../next.config.mjs", import.meta.url), "utf8"),
  readFile(new URL("../app/page.jsx", import.meta.url), "utf8"),
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

test("contact integration exposes only the provider's publishable form identifier", () => {
  assert.match(pageSource, /NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY/);
  assert.doesNotMatch(pageSource, /RESEND_API_KEY|CONTACT_FROM_EMAIL|CONTACT_TO_EMAIL/);
  assert.equal(
    envExampleSource.split(/\r?\n/).find((line) => line.startsWith("NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY=")),
    "NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY=",
  );
});

test("external font styles are CSP-allowed and pinned to immutable versions", () => {
  assert.match(configSource, /style-src[^\n]+https:\/\/cdn\.jsdelivr\.net/);
  assert.match(globalStylesSource, /@fontsource\/manrope@5\.3\.0/);
  assert.match(globalStylesSource, /@fontsource\/cormorant-garamond@5\.3\.0/);
  assert.doesNotMatch(globalStylesSource, /@latest/);
});

test("health endpoint is non-cacheable and contains no sensitive details", () => {
  assert.match(healthRouteSource, /status: "ok"/);
  assert.match(healthRouteSource, /Cache-Control/);
  assert.doesNotMatch(healthRouteSource, /process\.env/);
});
