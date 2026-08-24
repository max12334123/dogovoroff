import assert from "node:assert/strict";
import test from "node:test";
import { requestCloudflarePrecheck } from "../features/precheck/provider.mjs";

const NORMALIZED_INPUT = {
  version: "1",
  practiceId: "contracts",
  answers: {
    applicantType: "organization",
    stage: "documents",
    goal: "Написать на test@example.com или +7 912 345-67-89",
    deadline: "2026-09-10",
    contractTask: "review",
    signed: "no",
    mainRisk: "liability",
  },
  description: "Паспорт 4510 123456 не должен уйти модели.",
  aiConsent: true,
};
const PROVIDER_CARD = {
  summary: "Требуется проверить условия договора до подписания.",
  missingInformation: ["Срок поставки"],
  suggestedDocuments: ["Проект договора"],
  lawyerQuestions: ["Согласованы ли существенные условия?"],
  nextStep: "Передать актуальный проект юристу.",
};

test("provider adapter forwards only minimized masked data and validates the response", async () => {
  let call;
  let calls = 0;
  const result = await requestCloudflarePrecheck({
    workerUrl: "https://dogovoroff-precheck-ai.example.workers.dev",
    oidcToken: "test-oidc",
    input: NORMALIZED_INPUT,
    fetchImpl: async (url, options) => {
      calls += 1;
      call = { url, options, body: JSON.parse(options.body) };
      return Response.json({ success: true, result: PROVIDER_CARD });
    },
  });

  assert.equal(calls, 1);
  assert.equal(call.url, "https://dogovoroff-precheck-ai.example.workers.dev/v1/precheck");
  assert.equal(call.options.headers.Authorization, "Bearer test-oidc");
  assert.equal(call.options.headers["Content-Type"], "application/json");
  assert.deepEqual(Object.keys(call.body).sort(), [
    "answers",
    "description",
    "practiceId",
    "practiceLabel",
    "version",
  ]);
  assert.equal("aiConsent" in call.body, false);
  assert.equal("deadline" in call.body.answers, false);
  assert.doesNotMatch(JSON.stringify(call.body), /test@example\.com|912 345|4510 123456/);
  assert.match(call.body.answers.goal, /\[email скрыт\].*\[телефон скрыт\]/);
  assert.match(call.body.description, /\[номер скрыт\]/);
  assert.deepEqual(result, PROVIDER_CARD);
});

test("provider adapter does not retry unavailable or invalid responses", async () => {
  const cases = [
    () => new Response("", { status: 401 }),
    () => new Response("", { status: 402 }),
    () => new Response("", { status: 429 }),
    () => new Response("", { status: 500 }),
    () => new Response("not-json", { status: 200, headers: { "content-type": "application/json" } }),
    () => Response.json({ success: true }),
    () => Response.json({ success: true, result: { ...PROVIDER_CARD, verdict: "win" } }),
  ];

  for (const createResponse of cases) {
    let calls = 0;
    const result = await requestCloudflarePrecheck({
      workerUrl: "https://worker.example",
      oidcToken: "token",
      input: NORMALIZED_INPUT,
      fetchImpl: async () => {
        calls += 1;
        return createResponse();
      },
    });
    assert.equal(result, null);
    assert.equal(calls, 1);
  }
});

test("provider adapter aborts a slow request and returns null", async () => {
  let calls = 0;
  const result = await requestCloudflarePrecheck({
    workerUrl: "https://worker.example",
    oidcToken: "token",
    input: NORMALIZED_INPUT,
    timeoutMs: 5,
    fetchImpl: async (_url, { signal }) => {
      calls += 1;
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    },
  });

  assert.equal(result, null);
  assert.equal(calls, 1);
});

test("provider adapter refuses an insecure URL or missing token without fetching", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; };

  assert.equal(await requestCloudflarePrecheck({
    workerUrl: "http://worker.example",
    oidcToken: "token",
    input: NORMALIZED_INPUT,
    fetchImpl,
  }), null);
  assert.equal(await requestCloudflarePrecheck({
    workerUrl: "https://worker.example",
    oidcToken: "",
    input: NORMALIZED_INPUT,
    fetchImpl,
  }), null);
  assert.equal(calls, 0);
});
