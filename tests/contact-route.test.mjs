import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../app/api/contact/route.js";

const VALID_PAYLOAD = {
  name: "  Анна  ",
  phone: "+7 (912) 345-67-89",
  service: "Арбитраж и суды",
  message: "Нужна первичная консультация",
  website: "",
  agree: true,
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

function withProviderKey(callback) {
  const previous = process.env.WEB3FORMS_ACCESS_KEY;
  process.env.WEB3FORMS_ACCESS_KEY = "test-provider-key";

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      if (previous === undefined) delete process.env.WEB3FORMS_ACCESS_KEY;
      else process.env.WEB3FORMS_ACCESS_KEY = previous;
    });
}

function withEnvironment(values, callback) {
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );
  for (const [key, value] of Object.entries(values)) {
    process.env[key] = value;
  }

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
}

test("contact endpoint rejects cross-origin and malformed requests before delivery", async (context) => {
  const provider = context.mock.method(globalThis, "fetch", async () => {
    throw new Error("provider must not be called");
  });

  const crossOrigin = await POST(makeRequest(VALID_PAYLOAD, { origin: "https://example.com" }));
  assert.equal(crossOrigin.status, 403);

  const invalidService = await POST(makeRequest({ ...VALID_PAYLOAD, service: "Поддельная услуга" }, { ip: "203.0.113.11" }));
  assert.equal(invalidService.status, 400);

  const bot = await POST(makeRequest({ ...VALID_PAYLOAD, website: "bot.example" }, { ip: "203.0.113.12" }));
  assert.equal(bot.status, 400);

  const proxiedBot = await POST(makeRequest(
    { ...VALID_PAYLOAD, website: "bot.example" },
    {
      ip: "203.0.113.13",
      origin: "http://127.0.0.1:4173",
      requestOrigin: "http://localhost:4173",
      forwardedHost: "127.0.0.1:4173",
    },
  ));
  assert.equal(proxiedBot.status, 400);
  assert.equal(provider.mock.callCount(), 0);
});

test("contact endpoint normalizes and forwards a bounded lead with server-observed consent", async (context) => {
  let delivered;
  context.mock.method(globalThis, "fetch", async (url, options) => {
    delivered = { url, options, body: JSON.parse(options.body) };
    return Response.json({ success: true });
  });

  await withProviderKey(async () => {
    const response = await POST(makeRequest({
      ...VALID_PAYLOAD,
      precheck: {
        version: "1",
        mode: "fallback",
        practiceId: "litigation",
        excerpt: "Направление: Арбитраж и суды\nСледующий шаг: проверить документы.",
      },
    }, { ip: "203.0.113.20" }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true });
  });

  assert.equal(delivered.url, "https://api.web3forms.com/submit");
  assert.equal(delivered.body.name, "Анна");
  assert.equal(delivered.body.phone, VALID_PAYLOAD.phone);
  assert.equal(delivered.body.service, VALID_PAYLOAD.service);
  assert.match(delivered.body.submission_id, /^[0-9a-f-]{36}$/);
  assert.match(delivered.body.consent_timestamp, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(delivered.body.consent_version, /^1\.6 от 24 августа 2026 года$/);
  assert.equal(delivered.body.precheck_mode, "fallback");
  assert.equal(delivered.body.precheck_practice, "litigation");
  assert.equal(delivered.body.precheck_excerpt, "Направление: Арбитраж и суды\nСледующий шаг: проверить документы.");
  assert.equal("agree" in delivered.body, false);
  for (const forbidden of ["answers", "description", "aiConsent", "providerResult", "oidcToken"]) {
    assert.equal(forbidden in delivered.body, false);
  }
});

test("contact endpoint rejects a forged precheck before delivery", async (context) => {
  const provider = context.mock.method(globalThis, "fetch", async () => {
    throw new Error("provider must not be called");
  });
  const response = await POST(makeRequest({
    ...VALID_PAYLOAD,
    precheck: {
      version: "1",
      mode: "ai",
      practiceId: "contracts",
      excerpt: "x",
      description: "hidden raw intake",
    },
  }, { ip: "203.0.113.21" }));

  assert.equal(response.status, 400);
  assert.equal(provider.mock.callCount(), 0);
});

test("contact endpoint forwards the validated record to optional integrations", async (context) => {
  const calls = [];
  context.mock.method(globalThis, "fetch", async (url, options) => {
    const call = { url: String(url), body: JSON.parse(options.body) };
    calls.push(call);
    if (call.url === "https://api.web3forms.com/submit") {
      return Response.json({ success: true });
    }
    return Response.json({ ok: true });
  });

  await withProviderKey(() => withEnvironment({
    GOOGLE_SHEETS_WEBHOOK_URL: "https://script.google.com/macros/s/example/exec",
    GOOGLE_SHEETS_WEBHOOK_SECRET: "g".repeat(48),
    GOOGLE_SHEETS_URL: "https://docs.google.com/spreadsheets/d/example/edit",
    TELEGRAM_BOT_TOKEN: "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijk",
    TELEGRAM_CHAT_ID: "-1001234567890",
  }, async () => {
    const response = await POST(makeRequest(VALID_PAYLOAD, { ip: "203.0.113.22" }));
    assert.equal(response.status, 200);
  }));

  const emailCall = calls.find(({ url }) => url === "https://api.web3forms.com/submit");
  const sheetCall = calls.find(({ url }) => url.includes("script.google.com/macros/s/"));
  const telegramCall = calls.find(({ url }) => url.includes("api.telegram.org/bot"));
  assert.equal(sheetCall.body.record.submissionId, emailCall.body.submission_id);
  assert.equal(sheetCall.body.record.name, "Анна");
  assert.equal(sheetCall.body.record.phone, VALID_PAYLOAD.phone);
  assert.match(telegramCall.body.text, /Имя: Анна/);
  assert.match(telegramCall.body.text, /Телефон: \+7 \(912\) 345-67-89/);
  assert.equal("parse_mode" in telegramCall.body, false);
});

test("optional integration failures do not turn a delivered application into a client error", async (context) => {
  context.mock.method(console, "warn", () => {});
  context.mock.method(globalThis, "fetch", async (url) => {
    if (String(url) === "https://api.web3forms.com/submit") {
      return Response.json({ success: true });
    }
    return Response.json({ ok: false }, { status: 503 });
  });

  await withProviderKey(() => withEnvironment({
    GOOGLE_SHEETS_WEBHOOK_URL: "https://script.google.com/macros/s/example/exec",
    GOOGLE_SHEETS_WEBHOOK_SECRET: "g".repeat(48),
    TELEGRAM_BOT_TOKEN: "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijk",
    TELEGRAM_CHAT_ID: "-1001234567890",
  }, async () => {
    const response = await POST(makeRequest(VALID_PAYLOAD, { ip: "203.0.113.23" }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true });
  }));

  assert.equal(console.warn.mock.callCount(), 1);
  const warning = console.warn.mock.calls[0].arguments;
  assert.equal(warning[0], "Contact integrations failed.");
  assert.deepEqual(warning[1].channels.sort(), ["googleSheets", "telegram"]);
  assert.deepEqual(Object.keys(warning[1]).sort(), ["channels", "submissionId"]);
});

test("contact endpoint enforces a request-size limit and a per-client burst limit", async (context) => {
  context.mock.method(globalThis, "fetch", async () => Response.json({ success: true }));

  await withProviderKey(async () => {
    const oversized = await POST(makeRequest({ ...VALID_PAYLOAD, message: "x".repeat(9_000) }, { ip: "203.0.113.30" }));
    assert.equal(oversized.status, 413);

    const statuses = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await POST(makeRequest(VALID_PAYLOAD, { ip: "203.0.113.40" }));
      statuses.push(response.status);
    }

    assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429]);
  });
});
