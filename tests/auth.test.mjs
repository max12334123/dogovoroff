import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getAuthConfirmUrl,
  getSafeNextPath,
  isValidEmail,
  normalizeEmail,
} from "../features/auth/auth-domain.mjs";

const [loginActionSource, confirmRouteSource, middlewareSource, cabinetPageSource] = await Promise.all([
  readFile(new URL("../app/login/actions.js", import.meta.url), "utf8"),
  readFile(new URL("../app/auth/confirm/route.js", import.meta.url), "utf8"),
  readFile(new URL("../lib/supabase/middleware.js", import.meta.url), "utf8"),
  readFile(new URL("../app/cabinet/page.jsx", import.meta.url), "utf8"),
]);

test("email registration input is normalized and bounded", () => {
  assert.equal(normalizeEmail("  Client@Example.RU "), "client@example.ru");
  assert.equal(isValidEmail("client@example.ru"), true);
  assert.equal(isValidEmail("missing-domain@"), false);
  assert.equal(isValidEmail(`${"a".repeat(250)}@x.ru`), false);
});

test("post-auth redirects stay inside the application", () => {
  assert.equal(getSafeNextPath("/cabinet?view=messages"), "/cabinet?view=messages");
  assert.equal(getSafeNextPath("//attacker.example/path"), "/cabinet");
  assert.equal(getSafeNextPath("https://attacker.example"), "/cabinet");
  assert.equal(getSafeNextPath(null), "/cabinet");
});

test("auth callback URL is controlled by stable server configuration", (t) => {
  const previousRedirectUrl = process.env.SUPABASE_AUTH_REDIRECT_URL;
  const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const previousVercelUrl = process.env.VERCEL_URL;

  t.after(() => {
    restoreEnvironmentVariable("SUPABASE_AUTH_REDIRECT_URL", previousRedirectUrl);
    restoreEnvironmentVariable("NEXT_PUBLIC_SITE_URL", previousSiteUrl);
    restoreEnvironmentVariable("VERCEL_URL", previousVercelUrl);
  });

  process.env.SUPABASE_AUTH_REDIRECT_URL = "https://preview.example/ignored?token=unsafe";
  process.env.NEXT_PUBLIC_SITE_URL = "https://dogovoroff.vercel.app";
  process.env.VERCEL_URL = "dogovoroff-git-main-team.vercel.app";
  assert.equal(getAuthConfirmUrl(), "https://preview.example/auth/confirm");

  process.env.SUPABASE_AUTH_REDIRECT_URL = "";
  assert.equal(getAuthConfirmUrl(), "https://dogovoroff.vercel.app/auth/confirm");

  process.env.NEXT_PUBLIC_SITE_URL = "";
  assert.equal(getAuthConfirmUrl(), "https://dogovoroff-git-main-team.vercel.app/auth/confirm");
});

function restoreEnvironmentVariable(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

test("open registration creates users without exposing account existence", () => {
  assert.match(loginActionSource, /signInWithOtp/);
  assert.match(loginActionSource, /shouldCreateUser:\s*true/);
  assert.doesNotMatch(loginActionSource, /console\.(log|error)\([^)]*email/);
  assert.match(confirmRouteSource, /exchangeCodeForSession|verifyOtp/);
  assert.match(confirmRouteSource, /getSafeNextPath/);
});

test("cabinet authentication uses verified claims and database-backed data", () => {
  assert.match(middlewareSource, /auth\.getClaims\(\)/);
  assert.doesNotMatch(middlewareSource, /auth\.getSession\(\)/);
  assert.match(cabinetPageSource, /auth\.getClaims\(\)/);
  assert.match(cabinetPageSource, /loadCabinetData/);
});
