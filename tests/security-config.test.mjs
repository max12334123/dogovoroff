import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [configSource, contactRouteSource, healthRouteSource, globalStylesSource] = await Promise.all([
  readFile(new URL("../next.config.mjs", import.meta.url), "utf8"),
  readFile(new URL("../app/api/contact/route.js", import.meta.url), "utf8"),
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
});

test("contact endpoint validates, rate limits and keeps secrets server-side", () => {
  assert.match(contactRouteSource, /validateContactPayload/);
  assert.match(contactRouteSource, /consumeRateLimit/);
  assert.match(contactRouteSource, /RESEND_API_KEY/);
  assert.doesNotMatch(contactRouteSource, /NEXT_PUBLIC_RESEND/);
  assert.match(contactRouteSource, /honeypot/);
  assert.match(contactRouteSource, /x-forwarded-host/);
  assert.match(contactRouteSource, /readTextBodyWithLimit/);
  assert.match(contactRouteSource, /!origin/);
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
