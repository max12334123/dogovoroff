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

test("auth callback URL is controlled by server configuration", () => {
  const previous = process.env.SUPABASE_AUTH_REDIRECT_URL;
  const previousVercelUrl = process.env.VERCEL_URL;
  process.env.SUPABASE_AUTH_REDIRECT_URL = "https://preview.example/ignored?token=unsafe";
  assert.equal(getAuthConfirmUrl(), "https://preview.example/auth/confirm");

  process.env.SUPABASE_AUTH_REDIRECT_URL = "";
  process.env.VERCEL_URL = "dogovoroff-git-main-team.vercel.app";
  assert.equal(getAuthConfirmUrl(), "https://dogovoroff-git-main-team.vercel.app/auth/confirm");

  if (previous === undefined) {
    delete process.env.SUPABASE_AUTH_REDIRECT_URL;
  } else {
    process.env.SUPABASE_AUTH_REDIRECT_URL = previous;
  }
  if (previousVercelUrl === undefined) {
    delete process.env.VERCEL_URL;
  } else {
    process.env.VERCEL_URL = previousVercelUrl;
  }
});

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
