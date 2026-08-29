import { randomUUID } from "node:crypto";
import { PRACTICES, PLANS } from "../../content.js";
import { LEGAL } from "../../legal.js";
import {
  consumeRateLimit,
  getHashedClientKey,
  hasTrustedBrowserOrigin,
  jsonResponse,
  readJsonBody,
} from "../../../lib/api-security.mjs";
import { validateContactPayload } from "../../../lib/contact-form.mjs";
import { persistContactIntake } from "../../../lib/contact-intake.mjs";
import {
  createContactRecord,
  deliverContactIntegrations,
} from "../../../lib/contact-integrations.mjs";
import {
  buildConfirmedExcerpt,
  buildFallbackCard,
  mergeTrustedCard,
  normalizePrecheckPayload,
} from "../../../features/precheck/domain.mjs";
import { requestCloudflarePrecheck } from "../../../features/precheck/provider.mjs";
import { practiceIdFromService } from "../../../features/precheck/config.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 50;

const MAX_BODY_BYTES = 8_192;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1_000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const RATE_LIMIT_MAX_CLIENTS = 5_000;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ALLOWED_SERVICES = new Set([
  ...PRACTICES.map((practice) => practice.service),
  ...PLANS.map((plan) => plan.service),
  "Частный вопрос",
  "Другое / не знаю",
]);

const rateLimitStore = globalThis.__dogovoroffContactRateLimit ?? new Map();
globalThis.__dogovoroffContactRateLimit = rateLimitStore;

export function isAllowedService(service) {
  return ALLOWED_SERVICES.has(service);
}

export async function POST(request) {
  if (!hasTrustedBrowserOrigin(request)) {
    return jsonResponse({ success: false, error: "Недопустимый источник запроса." }, 403);
  }

  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
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

  const parsedBody = await readJsonBody(request, MAX_BODY_BYTES);
  if (!parsedBody.ok) {
    const error = parsedBody.status === 413
      ? "Обращение превышает допустимый размер."
      : "Некорректный формат обращения.";
    return jsonResponse({ success: false, error }, parsedBody.status);
  }
  const rawPayload = parsedBody.value;
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
    return jsonResponse({ success: false, error: "Проверьте заполненные поля." }, 400);
  }
  const payload = rawPayload;

  const suppliedSubmissionId = typeof payload.submissionId === "string"
    ? payload.submissionId.trim()
    : "";
  const submissionId = UUID_V4_PATTERN.test(suppliedSubmissionId)
    ? suppliedSubmissionId.toLowerCase()
    : randomUUID();
  if (payload.precheck !== undefined && payload.precheck !== null) {
    return jsonResponse({ success: false, error: "Проверьте данные предварительного разбора." }, 400);
  }
  const validation = validateContactPayload({ ...payload, submissionId });
  if (!validation.ok || validation.bot || !isAllowedService(validation.lead.service)) {
    return jsonResponse({ success: false, error: "Проверьте заполненные поля." }, 400);
  }

  const submittedAt = new Date().toISOString();
  let { lead } = validation;

  if (Object.prototype.hasOwnProperty.call(payload, "precheckInput")) {
    const rawPrecheckInput = payload.precheckInput;
    const normalizedInput = normalizePrecheckPayload(
      rawPrecheckInput && typeof rawPrecheckInput === "object" && !Array.isArray(rawPrecheckInput)
        ? { ...rawPrecheckInput, description: lead.message }
        : rawPrecheckInput,
    );
    const expectedPracticeId = practiceIdFromService(lead.service);
    if (!normalizedInput.ok || normalizedInput.value.practiceId !== expectedPracticeId) {
      return jsonResponse({ success: false, error: "Проверьте ответы предварительного разбора." }, 400);
    }

    const fallback = buildFallbackCard(normalizedInput.value);
    let card = fallback;
    let mode = "fallback";
    let providerDiagnostic = null;
    const workerUrl = process.env.AI_PRECHECK_WORKER_URL || "";
    const oidcToken = request.headers.get("x-vercel-oidc-token")
      || process.env.VERCEL_OIDC_TOKEN
      || "";
    const canUseAi = normalizedInput.value.aiConsent
      && process.env.AI_PRECHECK_ENABLED === "true"
      && Boolean(workerUrl)
      && Boolean(oidcToken);

    if (canUseAi) {
      const providerResult = await requestCloudflarePrecheck({
        workerUrl,
        oidcToken,
        input: normalizedInput.value,
        timeoutMs: 12_000,
        onDiagnostic: (diagnostic) => {
          providerDiagnostic = diagnostic;
        },
      });
      if (providerResult) {
        card = mergeTrustedCard(fallback, providerResult);
        mode = "ai";
      } else {
        console.warn("AI precheck provider fallback.", {
          reason: providerDiagnostic?.reason || "unknown",
          status: providerDiagnostic?.status ?? null,
        });
      }
    }

    const excerpt = buildConfirmedExcerpt(card);
    if (!excerpt) {
      return jsonResponse({ success: false, error: "Не удалось сформировать предварительный разбор." }, 502);
    }
    lead = {
      ...lead,
      precheck: {
        version: "1",
        mode,
        practiceId: normalizedInput.value.practiceId,
        excerpt,
      },
    };
  }

  const record = createContactRecord({
    submissionId,
    submittedAt,
    lead,
    consentDocument: `${LEGAL.siteUrl}/personal-data-consent`,
    consentVersion: `${LEGAL.policyVersion} от ${LEGAL.effectiveDate}`,
  });

  const intakeResult = await persistContactIntake(record);
  if (intakeResult.enabled && !intakeResult.ok) {
    console.warn("Contact inbox persistence failed.", {
      submissionId,
      status: intakeResult.status,
      reason: intakeResult.reason,
    });
  }

  const deliveryResults = await deliverContactIntegrations(record).catch(() => ({
    googleSheets: { attempted: false, ok: false, status: null, reason: "unexpected_error" },
    telegram: { attempted: false, ok: false, status: null, reason: "unexpected_error" },
    email: { attempted: false, ok: false, status: null, reason: "unexpected_error" },
    unexpected: { attempted: true, ok: false, status: null, reason: "unexpected_error" },
  }));
  const attemptedDeliveries = Object.entries(deliveryResults)
    .filter(([, result]) => result.attempted);
  const failedDeliveries = Object.fromEntries(
    attemptedDeliveries
      .filter(([, result]) => !result.ok)
      .map(([channel, result]) => [channel, {
        status: result.status ?? null,
        reason: result.reason || "unknown",
      }]),
  );

  if (Object.keys(failedDeliveries).length > 0) {
    console.warn("Contact integrations failed.", {
      submissionId,
      failures: failedDeliveries,
    });
  }

  if (intakeResult.ok || attemptedDeliveries.some(([, result]) => result.ok)) {
    return jsonResponse({ success: true, mode: lead.precheck?.mode || "none" }, 200);
  }

  if (attemptedDeliveries.length === 0) {
    return jsonResponse({ success: false, error: "Автоматическая отправка временно недоступна." }, 503);
  }

  const status = attemptedDeliveries.some(([, result]) => result.status === 429) ? 429 : 502;
  return jsonResponse(
    { success: false, error: status === 429 ? "Слишком много попыток. Повторите позже." : "Сервис доставки временно недоступен." },
    status,
  );
}
