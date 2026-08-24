import assert from "node:assert/strict";
import test from "node:test";
import { maxDuration, POST } from "../app/api/precheck/route.js";

const VALID_PAYLOAD = {
  version: "1",
  practiceId: "contracts",
  answers: {
    applicantType: "organization",
    stage: "documents",
    goal: "Проверить условия до подписания",
    deadline: "2026-09-10",
    contractTask: "review",
    signed: "no",
    mainRisk: "liability",
  },
  description: "Нужно проверить проект договора.",
  aiConsent: true,
};
const PROVIDER_CARD = {
  summary: "Требуется проверить условия договора до подписания.",
  missingInformation: ["Срок поставки"],
  suggestedDocuments: ["Проект договора"],
  lawyerQuestions: ["Согласованы ли существенные условия?"],
  nextStep: "Передать актуальный проект юристу.",
};

test("precheck route reserves enough time for bounded Workers AI latency", () => {
  assert.equal(maxDuration, 30);
});

function makeRequest(payload, {
  ip = "198.51.100.10",
  origin = "https://dogovoroff.vercel.app",
  contentType = "application/json",
  oidcToken = "runtime-oidc-token",
} = {}) {
  const headers = {
    Origin: origin,
    "Content-Type": contentType,
    "X-Forwarded-For": ip,
  };
  if (oidcToken) headers["X-Vercel-OIDC-Token"] = oidcToken;
  return new Request("https://dogovoroff.vercel.app/api/precheck", {
    method: "POST",
    headers,
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

async function withEnvironment(values, callback) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("precheck endpoint enforces origin, type, size, schema, and rate limit", async (context) => {
  const provider = context.mock.method(globalThis, "fetch", async () => {
    throw new Error("provider must not be called");
  });

  assert.equal((await POST(makeRequest(VALID_PAYLOAD, {
    ip: "198.51.100.11",
    origin: "https://example.com",
  }))).status, 403);
  assert.equal((await POST(makeRequest(VALID_PAYLOAD, {
    ip: "198.51.100.12",
    contentType: "text/plain",
  }))).status, 415);
  assert.equal((await POST(makeRequest({
    ...VALID_PAYLOAD,
    description: "x".repeat(9_000),
  }, { ip: "198.51.100.13" }))).status, 413);
  assert.equal((await POST(makeRequest("{", { ip: "198.51.100.14" }))).status, 400);
  assert.equal((await POST(makeRequest({
    ...VALID_PAYLOAD,
    practiceId: "unknown",
  }, { ip: "198.51.100.15" }))).status, 400);

  const statuses = [];
  for (let attempt = 0; attempt < 4; attempt += 1) {
    statuses.push((await POST(makeRequest(
      { ...VALID_PAYLOAD, aiConsent: false },
      { ip: "198.51.100.16" },
    ))).status);
  }
  assert.deepEqual(statuses, [200, 200, 200, 429]);
  assert.equal(provider.mock.callCount(), 0);
});

test("precheck endpoint never calls AI without consent, feature flag, URL, or OIDC token", async (context) => {
  const provider = context.mock.method(globalThis, "fetch", async () => {
    throw new Error("provider must not be called");
  });
  const cases = [
    { payload: { ...VALID_PAYLOAD, aiConsent: false }, enabled: "true", url: "https://worker.example", token: "token" },
    { payload: VALID_PAYLOAD, enabled: "false", url: "https://worker.example", token: "token" },
    { payload: VALID_PAYLOAD, enabled: "true", url: undefined, token: "token" },
    { payload: VALID_PAYLOAD, enabled: "true", url: "https://worker.example", token: "" },
  ];

  await withEnvironment({
    AI_PRECHECK_ENABLED: "false",
    AI_PRECHECK_WORKER_URL: undefined,
    VERCEL_OIDC_TOKEN: undefined,
  }, async () => {
    for (const [index, item] of cases.entries()) {
      process.env.AI_PRECHECK_ENABLED = item.enabled;
      if (item.url === undefined) delete process.env.AI_PRECHECK_WORKER_URL;
      else process.env.AI_PRECHECK_WORKER_URL = item.url;
      const response = await POST(makeRequest(item.payload, {
        ip: `198.51.101.${index + 1}`,
        oidcToken: item.token,
      }));
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.mode, "fallback");
      assert.equal(body.meta.consentVersion, "1.0");
    }
  });
  assert.equal(provider.mock.callCount(), 0);
});

test("precheck endpoint merges one valid provider result with trusted fields", async (context) => {
  let call;
  context.mock.method(globalThis, "fetch", async (url, options) => {
    call = { url, options };
    return Response.json({ success: true, result: PROVIDER_CARD });
  });

  await withEnvironment({
    AI_PRECHECK_ENABLED: "true",
    AI_PRECHECK_WORKER_URL: "https://worker.example",
    VERCEL_OIDC_TOKEN: undefined,
  }, async () => {
    const response = await POST(makeRequest(VALID_PAYLOAD, { ip: "198.51.102.1" }));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.mode, "ai");
    assert.equal(body.result.summary, PROVIDER_CARD.summary);
    assert.equal(body.result.practice, "Договоры, претензии и переговоры");
    assert.equal(body.result.urgency.level, "medium");
    assert.match(body.result.disclaimer, /не юридическое заключение/i);
    assert.equal(call.url, "https://worker.example/v1/precheck");
    assert.equal(call.options.headers.Authorization, "Bearer runtime-oidc-token");
  });
});

test("precheck endpoint returns an indistinguishable fallback for every provider failure", async (context) => {
  const responses = [
    new Response("", { status: 401 }),
    new Response("", { status: 402 }),
    new Response("", { status: 429 }),
    new Response("", { status: 500 }),
    new Response("not-json", { status: 200 }),
    Response.json({ success: true, result: { ...PROVIDER_CARD, verdict: "win" } }),
  ];
  let index = 0;
  context.mock.method(globalThis, "fetch", async () => responses[index++]);

  await withEnvironment({
    AI_PRECHECK_ENABLED: "true",
    AI_PRECHECK_WORKER_URL: "https://worker.example",
    VERCEL_OIDC_TOKEN: undefined,
  }, async () => {
    for (let attempt = 0; attempt < responses.length; attempt += 1) {
      const response = await POST(makeRequest(VALID_PAYLOAD, { ip: `198.51.103.${attempt + 1}` }));
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.mode, "fallback");
      assert.equal("providerError" in body, false);
      assert.equal("fallbackReason" in body, false);
    }
  });
  assert.equal(index, responses.length);
});
