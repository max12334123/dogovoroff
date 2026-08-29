import assert from "node:assert/strict";
import test from "node:test";

let subject = {};
try {
  subject = await import("../lib/contact-intake.mjs");
} catch {
  subject = {};
}

const RECORD = {
  submissionId: "9ce4b8e1-2fa7-4e9f-8cc8-40e1df18e631",
  submittedAt: "2026-08-29T08:00:00.000Z",
  name: "Анна",
  phone: "+7 (912) 345-67-89",
  service: "Арбитраж и суды",
  message: "Нужна первичная консультация",
  formMode: "Быстрая заявка",
  precheckMode: "Не проводился",
  precheckPractice: "Не проводился",
  precheckExcerpt: "Не проводился",
  consentTimestamp: "2026-08-29T08:00:00.000Z",
  consentDocument: "https://dogovoroff.vercel.app/personal-data-consent",
  consentVersion: "3 от 29.08.2026",
  source: "Сайт ДоговорОфф",
};

const ENV = {
  CONTACT_INBOX_ENABLED: "true",
  NEXT_PUBLIC_SUPABASE_URL: "https://example-project.supabase.co",
  SUPABASE_SECRET_KEY: `sb_secret_${"a".repeat(32)}`,
  CONTACT_ORGANIZATION_ID: "11111111-1111-4111-8111-111111111111",
};

test("contact inbox persistence is opt-in and performs no network call while disabled", async () => {
  assert.equal(typeof subject.persistContactIntake, "function", "contact inbox persistence is not implemented");
  let calls = 0;

  const result = await subject.persistContactIntake(RECORD, {
    env: { ...ENV, CONTACT_INBOX_ENABLED: "false" },
    fetchImpl: async () => {
      calls += 1;
      throw new Error("must not be called");
    },
  });

  assert.deepEqual(result, {
    enabled: false,
    attempted: false,
    ok: false,
    created: false,
    status: null,
    reason: "disabled",
  });
  assert.equal(calls, 0);
});

test("contact inbox persistence sends one bounded RPC payload and recognizes a new record", async () => {
  assert.equal(typeof subject.persistContactIntake, "function", "contact inbox persistence is not implemented");
  let request;

  const result = await subject.persistContactIntake(RECORD, {
    env: ENV,
    fetchImpl: async (url, options) => {
      request = { url: String(url), options, body: JSON.parse(options.body) };
      return Response.json([{
        request_id: "22222222-2222-4222-8222-222222222222",
        created: true,
      }]);
    },
  });

  assert.equal(request.url, "https://example-project.supabase.co/rest/v1/rpc/store_intake_request");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.apikey, ENV.SUPABASE_SECRET_KEY);
  assert.equal(request.options.headers.Authorization, `Bearer ${ENV.SUPABASE_SECRET_KEY}`);
  assert.deepEqual(request.body, {
    target_organization_id: ENV.CONTACT_ORGANIZATION_ID,
    new_submission_id: RECORD.submissionId,
    new_submitted_at: RECORD.submittedAt,
    new_name: RECORD.name,
    new_phone: RECORD.phone,
    new_service: RECORD.service,
    new_message: RECORD.message,
    new_form_mode: RECORD.formMode,
    new_precheck_mode: RECORD.precheckMode,
    new_precheck_practice: RECORD.precheckPractice,
    new_precheck_excerpt: RECORD.precheckExcerpt,
    new_consent_timestamp: RECORD.consentTimestamp,
    new_consent_document: RECORD.consentDocument,
    new_consent_version: RECORD.consentVersion,
    new_source: RECORD.source,
  });
  assert.deepEqual(result, {
    enabled: true,
    attempted: true,
    ok: true,
    created: true,
    status: 200,
    reason: "stored",
    requestId: "22222222-2222-4222-8222-222222222222",
  });
});

test("contact inbox persistence fails closed when enabled configuration or RPC response is invalid", async () => {
  assert.equal(typeof subject.persistContactIntake, "function", "contact inbox persistence is not implemented");
  let calls = 0;
  const notConfigured = await subject.persistContactIntake(RECORD, {
    env: { ...ENV, SUPABASE_SECRET_KEY: "" },
    fetchImpl: async () => {
      calls += 1;
      return Response.json([]);
    },
  });
  assert.equal(notConfigured.ok, false);
  assert.equal(notConfigured.reason, "not_configured");
  assert.equal(calls, 0);

  const invalidResponse = await subject.persistContactIntake(RECORD, {
    env: ENV,
    fetchImpl: async () => Response.json([]),
  });
  assert.equal(invalidResponse.ok, false);
  assert.equal(invalidResponse.reason, "invalid_response");
});
