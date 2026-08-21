import assert from "node:assert/strict";
import test from "node:test";
import {
  consumeRateLimit,
  normalizeContactPayload,
  readTextBodyWithLimit,
  validateContactPayload,
} from "../lib/contact-form.mjs";

const validPayload = {
  name: "Анна",
  phone: "+7 (912) 345-67-89",
  service: "Арбитраж и суды",
  message: "Нужна первичная консультация",
  website: "",
  submissionId: "7ed8d4f0-91aa-4f8b-8628-93bed7efc123",
  agree: true,
};

test("server contact validation accepts a complete lead", () => {
  const result = validateContactPayload(validPayload);
  assert.equal(result.ok, true);
  assert.equal(result.bot, false);
  assert.equal(result.lead.name, "Анна");
});

test("server contact validation rejects invalid fields and detects the honeypot", () => {
  const result = validateContactPayload({ ...validPayload, phone: "123", agree: false, website: "bot.example" });
  assert.equal(result.ok, false);
  assert.equal(result.bot, true);
  assert.equal(result.errors.phone, true);
  assert.equal(result.errors.agree, true);
});

test("contact normalization removes control characters and caps field lengths", () => {
  const normalized = normalizeContactPayload({ ...validPayload, name: "  Ан\u0000на  ", message: "строка 1\r\nстрока 2" });
  assert.equal(normalized.name, "Анна");
  assert.equal(normalized.message, "строка 1\nстрока 2");
});

test("contact validation safely rejects non-object JSON payloads", () => {
  for (const payload of [null, [], "lead", 42, true]) {
    const result = validateContactPayload(payload);
    assert.equal(result.ok, false);
    assert.equal(result.errors.name, true);
  }
});

test("request body reader rejects bytes beyond the server limit while streaming", async () => {
  const accepted = await readTextBodyWithLimit(
    new Request("https://example.com/api/contact", { method: "POST", body: "12345678" }),
    8,
  );
  const rejected = await readTextBodyWithLimit(
    new Request("https://example.com/api/contact", { method: "POST", body: "123456789" }),
    8,
  );

  assert.deepEqual(accepted, { ok: true, text: "12345678" });
  assert.deepEqual(rejected, { ok: false, text: "" });
});

test("rate limit blocks excess requests and resets after the window", () => {
  const store = new Map();
  const options = { maxRequests: 2, windowMs: 1000 };
  assert.equal(consumeRateLimit(store, "client", 0, options).allowed, true);
  assert.equal(consumeRateLimit(store, "client", 10, options).allowed, true);
  assert.equal(consumeRateLimit(store, "client", 20, options).allowed, false);
  assert.equal(consumeRateLimit(store, "client", 1000, options).allowed, true);
});

test("rate limit store stays bounded and removes expired clients first", () => {
  const store = new Map([
    ["expired", { count: 1, resetAt: 10 }],
    ["active", { count: 1, resetAt: 2000 }],
  ]);
  const result = consumeRateLimit(store, "new-client", 1000, {
    maxRequests: 2,
    windowMs: 1000,
    maxEntries: 2,
  });

  assert.equal(result.allowed, true);
  assert.equal(store.has("expired"), false);
  assert.equal(store.has("active"), true);
  assert.equal(store.has("new-client"), true);
  assert.equal(store.size, 2);
});
