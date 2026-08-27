import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getCaptchaConfig, getCaptchaToken, getCaptchaCspOrigins } from "../features/auth/captcha-domain.mjs";

const [loginActionSource, loginPageSource, widgetSource, nextConfigSource] = await Promise.all([
  readFile(new URL("../app/login/actions.js", import.meta.url), "utf8"),
  readFile(new URL("../app/login/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../features/auth/captcha-widget.jsx", import.meta.url), "utf8"),
  readFile(new URL("../next.config.mjs", import.meta.url), "utf8"),
]);

test("captcha stays disabled until it has an explicit provider and public site key", () => {
  assert.deepEqual(
    getCaptchaConfig({
      AUTH_CAPTCHA_ENABLED: "false",
      AUTH_CAPTCHA_PROVIDER: "turnstile",
      NEXT_PUBLIC_AUTH_CAPTCHA_SITE_KEY: "site-key",
    }),
    { enabled: false, provider: "", siteKey: "" },
  );
});

test("captcha config accepts only supported providers with a bounded site key", () => {
  assert.deepEqual(
    getCaptchaConfig({
      AUTH_CAPTCHA_ENABLED: "true",
      AUTH_CAPTCHA_PROVIDER: " Turnstile ",
      NEXT_PUBLIC_AUTH_CAPTCHA_SITE_KEY: " site-key ",
    }),
    { enabled: true, provider: "turnstile", siteKey: "site-key" },
  );

  assert.deepEqual(
    getCaptchaConfig({
      AUTH_CAPTCHA_ENABLED: "true",
      AUTH_CAPTCHA_PROVIDER: "unknown",
      NEXT_PUBLIC_AUTH_CAPTCHA_SITE_KEY: "site-key",
    }),
    { enabled: false, provider: "", siteKey: "" },
  );

  assert.deepEqual(
    getCaptchaConfig({
      AUTH_CAPTCHA_ENABLED: "true",
      AUTH_CAPTCHA_PROVIDER: "hcaptcha",
      NEXT_PUBLIC_AUTH_CAPTCHA_SITE_KEY: "x".repeat(257),
    }),
    { enabled: false, provider: "", siteKey: "" },
  );
});

test("captcha tokens are bounded and control characters are rejected", () => {
  assert.equal(getCaptchaToken("  token-value  "), "token-value");
  assert.equal(getCaptchaToken("token\nvalue"), "");
  assert.equal(getCaptchaToken("x".repeat(4097)), "");
  assert.equal(getCaptchaToken(null), "");
});

test("captcha CSP origins are provider-specific and contain no secret", () => {
  assert.deepEqual(
    getCaptchaCspOrigins({ enabled: true, provider: "turnstile", siteKey: "site-key" }),
    {
      script: ["https://challenges.cloudflare.com"],
      connect: ["https://challenges.cloudflare.com"],
      frame: ["https://challenges.cloudflare.com"],
    },
  );
  assert.deepEqual(
    getCaptchaCspOrigins({ enabled: true, provider: "hcaptcha", siteKey: "site-key" }),
    {
      script: ["https://js.hcaptcha.com", "https://newassets.hcaptcha.com"],
      connect: ["https://hcaptcha.com", "https://*.hcaptcha.com"],
      frame: ["https://hcaptcha.com", "https://*.hcaptcha.com"],
    },
  );
  assert.deepEqual(getCaptchaCspOrigins({ enabled: false, provider: "", siteKey: "" }), {
    script: [],
    connect: [],
    frame: [],
  });
});

test("login sends CAPTCHA only when enabled and renders the public widget contract", () => {
  assert.match(loginActionSource, /getCaptchaConfig/);
  assert.match(loginActionSource, /getCaptchaToken/);
  assert.match(loginActionSource, /captchaToken/);
  assert.match(loginPageSource, /CaptchaWidget/);
  assert.match(widgetSource, /turnstile|hcaptcha/);
  assert.match(widgetSource, /next\/script/);
  assert.doesNotMatch(widgetSource, /AUTH_CAPTCHA_SECRET|SUPABASE_SERVICE_ROLE|service_role/);
  assert.match(nextConfigSource, /getCaptchaCspOrigins/);
  assert.doesNotMatch(loginActionSource, /SUPABASE_SERVICE_ROLE|service_role/);
});
