import assert from "node:assert/strict";
import test from "node:test";
import { maskPhone, validateLead } from "../lib/form-utils.mjs";

test("maskPhone normalizes Russian phone numbers", () => {
  assert.equal(maskPhone("8 912 345 67 89"), "+7 (912) 345-67-89");
  assert.equal(maskPhone("9123456789"), "+7 (912) 345-67-89");
  assert.equal(maskPhone(""), "");
});

test("validateLead rejects incomplete consent and contact fields", () => {
  assert.deepEqual(validateLead({ name: "А", phone: "+7 (912) 345-67", service: "", agree: false }), {
    name: true,
    phone: true,
    service: true,
    agree: true,
  });
});

test("validateLead accepts a complete lead", () => {
  assert.deepEqual(validateLead({ name: "Анна", phone: "+7 (912) 345-67-89", service: "Арбитраж", agree: true }), {
    name: false,
    phone: false,
    service: false,
    agree: false,
  });
});
