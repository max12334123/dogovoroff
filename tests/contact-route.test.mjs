import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../app/api/contact/route.js";

const SUBMISSION_ID = "9ce4b8e1-2fa7-4e9f-8cc8-40e1df18e631";
const VALID_PAYLOAD = {
  name: "  Анна  ",
  phone: "+7 (912) 345-67-89",
  service: "Арбитраж и суды",
  message: "Нужна первичная консультация",
  website: "",
  submissionId: SUBMISSION_ID,
  agree: true,
};
const DELIVERY_ENV_DEFAULTS = {
  GOOGLE_SHEETS_WEBHOOK_URL: "",
  GOOGLE_SHEETS_WEBHOOK_SECRET: "",
  GOOGLE_SHEETS_URL: "",
  TELEGRAM_BOT_TOKEN: "",
  TELEGRAM_CHAT_ID: "",
  RESEND_API_KEY: "",
  CONTACT_EMAIL_FROM: "",
  CONTACT_EMAIL_TO: "",
  CONTACT_INBOX_ENABLED: "false",
  NEXT_PUBLIC_SUPABASE_URL: "",
  SUPABASE_SECRET_KEY: "",
  CONTACT_ORGANIZATION_ID: "",
  AI_PRECHECK_ENABLED: "false",
  AI_PRECHECK_WORKER_URL: "",
  VERCEL_OIDC_TOKEN: "",
};

function makeRequest(payload, {
  ip = "203.0.113.10",
  origin = "https://dogovoroff.vercel.app",
  requestOrigin = "https://dogovoroff.vercel.app",
  forwardedHost,
} = {}) {
  const headers = {
    "Content-Type": "application/json",
    Origin: origin,
    "X-Forwarded-For": ip,
  };
  if (forwardedHost) {
    headers["X-Forwarded-Host"] = forwardedHost;
    headers["X-Forwarded-Proto"] = origin.startsWith("https:") ? "https" : "http";
  }

  return new Request(`${requestOrigin}/api/contact`, {
    method: "POST",
    headers,
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

async function withEnvironment(values, callback) {
  const nextValues = { ...DELIVERY_ENV_DEFAULTS, ...values };
  const previous = Object.fromEntries(
    Object.keys(nextValues).map((key) => [key, process.env[key]]),
  );
  for (const [key, value] of Object.entries(nextValues)) process.env[key] = value;

  try {
    return await callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const sheetsEnvironment = {
  GOOGLE_SHEETS_WEBHOOK_URL: "https://script.google.com/macros/s/example/exec",
  GOOGLE_SHEETS_WEBHOOK_SECRET: "g".repeat(48),
};

test("contact endpoint rejects cross-origin and malformed requests before delivery", async (context) => {
  const provider = context.mock.method(globalThis, "fetch", async () => {
    throw new Error("provider must not be called");
  });

  await withEnvironment({}, async () => {
    assert.equal((await POST(makeRequest(VALID_PAYLOAD, { origin: "https://example.com" }))).status, 403);
    assert.equal((await POST(makeRequest(
      { ...VALID_PAYLOAD, service: "Поддельная услуга" },
      { ip: "203.0.113.11" },
    ))).status, 400);
    assert.equal((await POST(makeRequest(
      { ...VALID_PAYLOAD, website: "bot.example" },
      { ip: "203.0.113.12" },
    ))).status, 400);
    assert.equal((await POST(makeRequest(
      { ...VALID_PAYLOAD, website: "bot.example" },
      {
        ip: "203.0.113.13",
        origin: "http://127.0.0.1:4173",
        requestOrigin: "http://localhost:4173",
        forwardedHost: "127.0.0.1:4173",
      },
    ))).status, 400);
  });

  assert.equal(provider.mock.callCount(), 0);
});

test("contact endpoint preserves a client UUID and forwards one bounded record", async (context) => {
  let delivered;
  context.mock.method(globalThis, "fetch", async (url, options) => {
    delivered = { url: String(url), body: JSON.parse(options.body) };
    return Response.json({ ok: true });
  });

  await withEnvironment(sheetsEnvironment, async () => {
    const response = await POST(makeRequest({
      ...VALID_PAYLOAD,
      precheckInput: {
        version: "2",
        aiConsent: false,
        answers: { deadline: "" },
        practiceId: "litigation",
        description: VALID_PAYLOAD.message,
      },
    }, { ip: "203.0.113.20" }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, mode: "fallback" });
  });

  assert.equal(delivered.url, sheetsEnvironment.GOOGLE_SHEETS_WEBHOOK_URL);
  assert.equal(delivered.body.record.submissionId, SUBMISSION_ID);
  assert.equal(delivered.body.record.name, "Анна");
  assert.equal(delivered.body.record.phone, VALID_PAYLOAD.phone);
  assert.match(delivered.body.record.submittedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(delivered.body.record.precheckMode, "Автоматический");
  assert.match(delivered.body.record.precheckExcerpt, /Следующий шаг/);
  for (const forbidden of ["answers", "description", "aiConsent", "providerResult", "oidcToken"]) {
    assert.equal(forbidden in delivered.body.record, false);
  }
});

test("contact endpoint generates a UUID for a legacy client without one", async (context) => {
  let record;
  context.mock.method(globalThis, "fetch", async (_url, options) => {
    record = JSON.parse(options.body).record;
    return Response.json({ ok: true });
  });

  await withEnvironment(sheetsEnvironment, async () => {
    const { submissionId: _removed, ...legacyPayload } = VALID_PAYLOAD;
    const response = await POST(makeRequest(legacyPayload, { ip: "203.0.113.21" }));
    assert.equal(response.status, 200);
  });

  assert.match(record.submissionId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test("contact endpoint builds the private AI excerpt on the server", async (context) => {
  let providerRequest;
  let record;
  context.mock.method(globalThis, "fetch", async (url, options) => {
    if (String(url).includes("worker.example")) {
      providerRequest = JSON.parse(options.body);
      return Response.json({
        success: true,
        result: {
          summary: "Нужно проверить условия договора.",
          missingInformation: ["Срок исполнения"],
          suggestedDocuments: ["Проект договора"],
          lawyerQuestions: ["Есть ли подписанная версия?"],
          nextStep: "Передать проект юристу.",
        },
      });
    }
    record = JSON.parse(options.body).record;
    return Response.json({ ok: true });
  });

  await withEnvironment({
    ...sheetsEnvironment,
    AI_PRECHECK_ENABLED: "true",
    AI_PRECHECK_WORKER_URL: "https://worker.example",
    VERCEL_OIDC_TOKEN: "server-oidc-token",
  }, async () => {
    const response = await POST(makeRequest({
      ...VALID_PAYLOAD,
      service: "Договоры и претензии",
      message: "Нужно проверить договор поставки перед подписанием.",
      precheckInput: {
        version: "2",
        practiceId: "contracts",
        answers: { deadline: "" },
        description: "Нужно проверить договор поставки перед подписанием.",
        aiConsent: true,
      },
    }, { ip: "203.0.113.27" }));
    assert.deepEqual(await response.json(), { success: true, mode: "ai" });
  });

  assert.equal(providerRequest.description, "Свободный текст обращения не передан модели. Объём описания: краткий. Конкретный срок не указан.");
  assert.equal("name" in providerRequest, false);
  assert.equal("phone" in providerRequest, false);
  assert.match(record.precheckExcerpt, /Нужно проверить условия договора/);
  assert.equal(record.precheckMode, "AI");
});

test("contact endpoint rejects a forged precheck before delivery", async (context) => {
  const provider = context.mock.method(globalThis, "fetch", async () => {
    throw new Error("provider must not be called");
  });
  await withEnvironment(sheetsEnvironment, async () => {
    const response = await POST(makeRequest({
      ...VALID_PAYLOAD,
      precheckInput: {
        version: "2",
        aiConsent: false,
        answers: { deadline: "" },
        practiceId: "contracts",
        description: VALID_PAYLOAD.message,
      },
    }, { ip: "203.0.113.22" }));
    assert.equal(response.status, 400);
  });
  assert.equal(provider.mock.callCount(), 0);
});

test("contact endpoint rejects legacy client-generated precheck cards", async (context) => {
  const provider = context.mock.method(globalThis, "fetch", async () => {
    throw new Error("delivery must not be called");
  });
  await withEnvironment(sheetsEnvironment, async () => {
    const response = await POST(makeRequest({
      ...VALID_PAYLOAD,
      precheck: {
        version: "1",
        mode: "ai",
        practiceId: "litigation",
        excerpt: "ГАРАНТИЯ ПОБЕДЫ И ИНДИВИДУАЛЬНЫЙ ПРОГНОЗ",
      },
    }, { ip: "203.0.113.223" }));
    assert.equal(response.status, 400);
  });
  assert.equal(provider.mock.callCount(), 0);
});

test("contact endpoint rejects null JSON before reading submission fields", async () => {
  const response = await POST(makeRequest(null, { ip: "203.0.113.221" }));
  assert.equal(response.status, 400);
});

test("partial integration failures are logged without lead contents", async (context) => {
  context.mock.method(console, "warn", () => {});
  context.mock.method(globalThis, "fetch", async (url) => {
    if (String(url).includes("script.google.com/macros/s/")) return Response.json({ ok: true });
    return Response.json({ ok: false }, { status: 503 });
  });

  await withEnvironment({
    ...sheetsEnvironment,
    TELEGRAM_BOT_TOKEN: "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijk",
    TELEGRAM_CHAT_ID: "-1001234567890",
    RESEND_API_KEY: "re_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456",
    CONTACT_EMAIL_FROM: "ДоговорОфф <leads@example.com>",
    CONTACT_EMAIL_TO: "lawyer@example.com",
  }, async () => {
    const response = await POST(makeRequest(VALID_PAYLOAD, { ip: "203.0.113.23" }));
    assert.equal(response.status, 200);
  });

  assert.equal(console.warn.mock.callCount(), 1);
  const [message, details] = console.warn.mock.calls[0].arguments;
  assert.equal(message, "Contact integrations failed.");
  assert.equal(details.submissionId, SUBMISSION_ID);
  assert.deepEqual(details.failures, {
    telegram: { status: 503, reason: "http_error" },
    email: { status: 503, reason: "http_error" },
  });
  assert.doesNotMatch(JSON.stringify(details), /Анна|912|консультац/iu);
});

test("Resend delivery uses the client UUID as an email idempotency key", async (context) => {
  let call;
  context.mock.method(globalThis, "fetch", async (url, options) => {
    call = { url: String(url), options, body: JSON.parse(options.body) };
    return Response.json({ id: "email-id" });
  });

  await withEnvironment({
    RESEND_API_KEY: "re_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456",
    CONTACT_EMAIL_FROM: "ДоговорОфф <leads@example.com>",
    CONTACT_EMAIL_TO: "lawyer@example.com",
  }, async () => {
    const response = await POST(makeRequest(VALID_PAYLOAD, { ip: "203.0.113.24" }));
    assert.equal(response.status, 200);
  });

  assert.equal(call.url, "https://api.resend.com/emails");
  assert.equal(call.options.headers["Idempotency-Key"], `contact/${SUBMISSION_ID}`);
  assert.match(call.body.text, /Имя: Анна/);
  assert.doesNotMatch(call.url, /web3forms/iu);
});

test("a repeated client UUID is deduplicated before Telegram and email", async (context) => {
  let sheetCalls = 0;
  let telegramCalls = 0;
  context.mock.method(globalThis, "fetch", async (url) => {
    if (String(url).includes("script.google.com/macros/s/")) {
      sheetCalls += 1;
      return Response.json({ ok: true, duplicate: sheetCalls > 1 });
    }
    if (String(url).includes("api.telegram.org/")) telegramCalls += 1;
    return Response.json({ ok: true });
  });

  await withEnvironment({
    ...sheetsEnvironment,
    TELEGRAM_BOT_TOKEN: "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijk",
    TELEGRAM_CHAT_ID: "-1001234567890",
  }, async () => {
    assert.equal((await POST(makeRequest(VALID_PAYLOAD, { ip: "203.0.113.25" }))).status, 200);
    assert.equal((await POST(makeRequest(VALID_PAYLOAD, { ip: "203.0.113.25" }))).status, 200);
  });

  assert.equal(sheetCalls, 2);
  assert.equal(telegramCalls, 1);
});

test("contact endpoint reports unavailable delivery when no channel is configured", async (context) => {
  const provider = context.mock.method(globalThis, "fetch", async () => {
    throw new Error("provider must not be called");
  });
  await withEnvironment({}, async () => {
    const response = await POST(makeRequest(VALID_PAYLOAD, { ip: "203.0.113.26" }));
    assert.equal(response.status, 503);
  });
  assert.equal(provider.mock.callCount(), 0);
});

test("a stored inbox request succeeds even when notification channels are not configured", async (context) => {
  let call;
  context.mock.method(globalThis, "fetch", async (url, options) => {
    call = { url: String(url), body: JSON.parse(options.body) };
    return Response.json([{
      request_id: "22222222-2222-4222-8222-222222222222",
      created: true,
    }]);
  });

  await withEnvironment({
    CONTACT_INBOX_ENABLED: "true",
    NEXT_PUBLIC_SUPABASE_URL: "https://example-project.supabase.co",
    SUPABASE_SECRET_KEY: `sb_secret_${"a".repeat(32)}`,
    CONTACT_ORGANIZATION_ID: "11111111-1111-4111-8111-111111111111",
  }, async () => {
    const response = await POST(makeRequest(VALID_PAYLOAD, { ip: "203.0.113.28" }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, mode: "none" });
  });

  assert.equal(call.url, "https://example-project.supabase.co/rest/v1/rpc/store_intake_request");
  assert.equal(call.body.new_submission_id, SUBMISSION_ID);
});

test("an unavailable inbox falls back to configured notification channels", async (context) => {
  const calls = [];
  context.mock.method(console, "warn", () => {});
  context.mock.method(globalThis, "fetch", async (url) => {
    calls.push(String(url));
    if (String(url).includes("supabase.co")) {
      return Response.json({ message: "unavailable" }, { status: 503 });
    }
    return Response.json({ ok: true });
  });

  await withEnvironment({
    ...sheetsEnvironment,
    CONTACT_INBOX_ENABLED: "true",
    NEXT_PUBLIC_SUPABASE_URL: "https://example-project.supabase.co",
    SUPABASE_SECRET_KEY: `sb_secret_${"a".repeat(32)}`,
    CONTACT_ORGANIZATION_ID: "11111111-1111-4111-8111-111111111111",
  }, async () => {
    const response = await POST(makeRequest(VALID_PAYLOAD, { ip: "203.0.113.29" }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, mode: "none" });
  });

  assert.deepEqual(calls, [
    "https://example-project.supabase.co/rest/v1/rpc/store_intake_request",
    sheetsEnvironment.GOOGLE_SHEETS_WEBHOOK_URL,
  ]);
  assert.equal(console.warn.mock.callCount(), 1);
  const [message, details] = console.warn.mock.calls[0].arguments;
  assert.equal(message, "Contact inbox persistence failed.");
  assert.deepEqual(Object.keys(details).sort(), ["reason", "status", "submissionId"]);
});

test("contact endpoint enforces a request-size limit and a per-client burst limit", async (context) => {
  context.mock.method(globalThis, "fetch", async () => Response.json({ ok: true }));

  await withEnvironment(sheetsEnvironment, async () => {
    const oversized = await POST(makeRequest(
      { ...VALID_PAYLOAD, message: "x".repeat(9_000) },
      { ip: "203.0.113.30" },
    ));
    assert.equal(oversized.status, 413);

    const statuses = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await POST(makeRequest(VALID_PAYLOAD, { ip: "203.0.113.40" }));
      statuses.push(response.status);
    }
    assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429]);
  });
});
