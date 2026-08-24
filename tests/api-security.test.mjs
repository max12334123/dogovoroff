import assert from "node:assert/strict";
import test from "node:test";
import {
  consumeRateLimit,
  getHashedClientKey,
  hasTrustedBrowserOrigin,
  jsonResponse,
  readJsonBody,
} from "../lib/api-security.mjs";

test("API guard accepts a forwarded same origin and rejects a foreign origin", () => {
  const accepted = new Request("http://localhost:4173/api/precheck", {
    headers: {
      origin: "http://127.0.0.1:4173",
      "x-forwarded-host": "127.0.0.1:4173",
      "x-forwarded-proto": "http",
      "sec-fetch-site": "same-origin",
    },
  });
  const rejected = new Request("https://dogovoroff.vercel.app/api/precheck", {
    headers: { origin: "https://example.com" },
  });

  assert.equal(hasTrustedBrowserOrigin(accepted), true);
  assert.equal(hasTrustedBrowserOrigin(rejected), false);
});

test("API guard rejects missing origin and cross-site browser requests", () => {
  const missing = new Request("https://dogovoroff.vercel.app/api/precheck");
  const crossSite = new Request("https://dogovoroff.vercel.app/api/precheck", {
    headers: {
      origin: "https://dogovoroff.vercel.app",
      "sec-fetch-site": "cross-site",
    },
  });

  assert.equal(hasTrustedBrowserOrigin(missing), false);
  assert.equal(hasTrustedBrowserOrigin(crossSite), false);
});

test("JSON body reader parses valid input and rejects malformed or oversized input", async () => {
  const valid = new Request("https://example.test/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ answer: "ok" }),
  });
  const malformed = new Request("https://example.test/api", {
    method: "POST",
    body: "{",
  });
  const oversized = new Request("https://example.test/api", {
    method: "POST",
    body: JSON.stringify({ text: "я".repeat(20) }),
  });

  assert.deepEqual(await readJsonBody(valid, 1_000), { ok: true, value: { answer: "ok" } });
  assert.deepEqual(await readJsonBody(malformed, 1_000), {
    ok: false,
    status: 400,
    error: "Некорректный формат запроса.",
  });
  assert.deepEqual(await readJsonBody(oversized, 16), {
    ok: false,
    status: 413,
    error: "Запрос превышает допустимый размер.",
  });
});

test("rate limiter returns deterministic retry timing and caps stored clients", () => {
  const store = new Map();
  const options = { windowMs: 60_000, maxRequests: 2, maxClients: 2 };

  assert.equal(consumeRateLimit(store, "client", options, 1_000).allowed, true);
  assert.equal(consumeRateLimit(store, "client", options, 1_001).allowed, true);
  assert.deepEqual(consumeRateLimit(store, "client", options, 1_002), {
    allowed: false,
    retryAfter: 60,
  });

  consumeRateLimit(store, "second", options, 1_003);
  consumeRateLimit(store, "third", options, 1_004);
  assert.equal(store.size, 2);
  assert.equal(store.has("client"), false);
});

test("client keys are stable hashes and response helper disables caching", async () => {
  const first = getHashedClientKey(new Request("https://example.test", {
    headers: { "x-forwarded-for": "203.0.113.10, 198.51.100.2" },
  }));
  const second = getHashedClientKey(new Request("https://example.test", {
    headers: { "x-vercel-forwarded-for": "203.0.113.10" },
  }));
  const response = jsonResponse({ ok: true }, 202);

  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(response.status, 202);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.deepEqual(await response.json(), { ok: true });
});
