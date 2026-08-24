import {
  consumeRateLimit,
  getHashedClientKey,
  hasTrustedBrowserOrigin,
  jsonResponse,
  readJsonBody,
} from "../../../lib/api-security.mjs";
import {
  buildFallbackCard,
  mergeTrustedCard,
  normalizePrecheckPayload,
} from "../../../features/precheck/domain.mjs";
import { requestCloudflarePrecheck } from "../../../features/precheck/provider.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 8_192;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1_000;
const RATE_LIMIT_MAX_REQUESTS = 3;
const RATE_LIMIT_MAX_CLIENTS = 5_000;
const rateLimitStore = globalThis.__dogovoroffPrecheckRateLimit ?? new Map();
globalThis.__dogovoroffPrecheckRateLimit = rateLimitStore;

function createMeta() {
  return {
    processedAt: new Date().toISOString(),
    consentVersion: "1.0",
  };
}

function success(mode, result) {
  return jsonResponse({ success: true, mode, result, meta: createMeta() }, 200);
}

function runtimeOidcToken(request) {
  return request.headers.get("x-vercel-oidc-token")
    || process.env.VERCEL_OIDC_TOKEN
    || "";
}

export async function POST(request) {
  if (!hasTrustedBrowserOrigin(request)) {
    return jsonResponse({ success: false, error: "Недопустимый источник запроса." }, 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return jsonResponse({ success: false, error: "Ожидается JSON-запрос." }, 415);
  }

  const rateLimit = consumeRateLimit(rateLimitStore, getHashedClientKey(request), {
    windowMs: RATE_LIMIT_WINDOW_MS,
    maxRequests: RATE_LIMIT_MAX_REQUESTS,
    maxClients: RATE_LIMIT_MAX_CLIENTS,
  });
  if (!rateLimit.allowed) {
    return jsonResponse(
      { success: false, error: "Слишком много попыток. Повторите позже." },
      429,
      { "Retry-After": String(rateLimit.retryAfter) },
    );
  }

  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) {
    const error = body.status === 413
      ? "Запрос превышает допустимый размер."
      : "Некорректный формат запроса.";
    return jsonResponse({ success: false, error }, body.status);
  }

  const normalized = normalizePrecheckPayload(body.value);
  if (!normalized.ok) {
    return jsonResponse({ success: false, error: "Проверьте ответы предварительного разбора." }, 400);
  }

  const fallback = buildFallbackCard(normalized.value);
  const workerUrl = process.env.AI_PRECHECK_WORKER_URL || "";
  const oidcToken = runtimeOidcToken(request);
  const canUseAi = normalized.value.aiConsent
    && process.env.AI_PRECHECK_ENABLED === "true"
    && Boolean(workerUrl)
    && Boolean(oidcToken);

  if (!canUseAi) return success("fallback", fallback);

  const providerResult = await requestCloudflarePrecheck({
    workerUrl,
    oidcToken,
    input: normalized.value,
  });
  if (!providerResult) return success("fallback", fallback);

  return success("ai", mergeTrustedCard(fallback, providerResult));
}
