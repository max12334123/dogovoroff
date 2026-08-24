import assert from "node:assert/strict";
import test from "node:test";
import { createWorker } from "../cloudflare/precheck-worker/src/index.mjs";

const TEST_ENV = {
  VERCEL_ISSUER: "https://oidc.vercel.com/dogovoroff",
  VERCEL_AUDIENCE: "https://vercel.com/dogovoroff",
  VERCEL_OWNER_ID: "team_Jot747qYaAxFSM5jUSY1lpz1",
  VERCEL_OWNER_SLUG: "dogovoroff",
  VERCEL_PROJECT_ID: "prj_BhZAA6uclF07BnSa7Hex6TYcMre8",
  VERCEL_PROJECT_NAME: "dogovoroff",
  AI_MODEL: "@cf/zai-org/glm-4.7-flash",
};
const PROVIDER_CARD = {
  summary: "Требуется проверить условия договора до подписания.",
  missingInformation: ["Срок поставки"],
  suggestedDocuments: ["Проект договора"],
  lawyerQuestions: ["Согласованы ли существенные условия?"],
  nextStep: "Передать актуальный проект юристу.",
};
const MINIMIZED_INPUT = {
  version: "1",
  practiceId: "contracts",
  practiceLabel: "Договоры, претензии и переговоры",
  answers: {
    applicantType: "organization",
    stage: "documents",
    goal: "Проверить риски",
    deadline: "2026-09-10",
    contractTask: "review",
    signed: "no",
    mainRisk: "liability",
  },
  description: "Проверить проект без персональных данных.",
};

function makeRequest(body = MINIMIZED_INPUT, headers = {}) {
  return new Request("https://worker.test/v1/precheck", {
    method: "POST",
    headers: {
      authorization: "Bearer signed-vercel-token",
      "content-type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

test("worker exposes a minimal health response without invoking AI", async () => {
  let aiCalls = 0;
  const worker = createWorker({ verifyOidc: async () => ({ environment: "production" }) });
  const response = await worker.fetch(new Request("https://worker.test/health"), {
    ...TEST_ENV,
    AI: { run: async () => { aiCalls += 1; } },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(aiCalls, 0);
});

test("worker rejects an invalid Vercel token before input validation or AI", async () => {
  let aiCalls = 0;
  const worker = createWorker({ verifyOidc: async () => { throw new Error("invalid token"); } });
  const response = await worker.fetch(makeRequest("not-json", { "content-type": "text/plain" }), {
    ...TEST_ENV,
    AI: { run: async () => { aiCalls += 1; } },
  });

  assert.equal(response.status, 401);
  assert.equal(aiCalls, 0);
  assert.deepEqual(await response.json(), { success: false, error: "Unauthorized" });
});

test("worker rejects unknown minimized fields without invoking AI", async () => {
  let aiCalls = 0;
  const worker = createWorker({ verifyOidc: async () => ({ environment: "preview" }) });
  const response = await worker.fetch(makeRequest({ ...MINIMIZED_INPUT, phone: "+7 900 000-00-00" }), {
    ...TEST_ENV,
    AI: { run: async () => { aiCalls += 1; } },
  });

  assert.equal(response.status, 400);
  assert.equal(aiCalls, 0);
});

test("worker forces exactly one build_precheck_card function call", async () => {
  let aiCalls = 0;
  let captured;
  const worker = createWorker({ verifyOidc: async () => ({ environment: "development" }) });
  const env = {
    ...TEST_ENV,
    AI: {
      run: async (model, input) => {
        aiCalls += 1;
        captured = { model, input };
        return {
          tool_calls: [{
            name: "build_precheck_card",
            arguments: PROVIDER_CARD,
          }],
        };
      },
    },
  };

  const response = await worker.fetch(makeRequest(), env);

  assert.equal(response.status, 200);
  assert.equal(aiCalls, 1);
  assert.equal(captured.model, "@cf/zai-org/glm-4.7-flash");
  assert.equal(captured.input.tool_choice.function.name, "build_precheck_card");
  assert.equal(captured.input.tools.length, 1);
  assert.equal(captured.input.tools[0].function.name, "build_precheck_card");
  assert.equal(captured.input.tools[0].type, "function");
  assert.equal(captured.input.temperature, 0);
  assert.equal(captured.input.max_completion_tokens, 700);
  assert.equal(captured.input.store, false);
  assert.equal(captured.input.parallel_tool_calls, false);
  assert.deepEqual(await response.json(), { success: true, result: PROVIDER_CARD });
});

test("worker returns a generic upstream error for malformed model output", async () => {
  const worker = createWorker({ verifyOidc: async () => ({ environment: "production" }) });
  const response = await worker.fetch(makeRequest(), {
    ...TEST_ENV,
    AI: { run: async () => ({ response: "Unstructured answer" }) },
  });

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { success: false, error: "AI service unavailable" });
});
