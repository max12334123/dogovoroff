import assert from "node:assert/strict";
import test from "node:test";
import { normalizeContactPayload, validateContactPayload } from "../lib/contact-form.mjs";

const validPayload = {
  name: "Анна",
  phone: "+7 (912) 345-67-89",
  service: "Арбитраж и суды",
  message: "Нужна первичная консультация",
  website: "",
  submissionId: "7ed8d4f0-91aa-4f8b-8628-93bed7efc123",
  agree: true,
};

test("contact validation accepts a complete lead", () => {
  const result = validateContactPayload(validPayload);
  assert.equal(result.ok, true);
  assert.equal(result.bot, false);
  assert.equal(result.lead.name, "Анна");
});

test("contact validation rejects invalid fields and detects the honeypot", () => {
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
