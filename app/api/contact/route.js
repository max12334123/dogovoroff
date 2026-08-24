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
import {
  createContactRecord,
  deliverContactIntegrations,
} from "../../../lib/contact-integrations.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WEB3FORMS_ENDPOINT = "https://api.web3forms.com/submit";
const MAX_BODY_BYTES = 8_192;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1_000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const RATE_LIMIT_MAX_CLIENTS = 5_000;
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
  const payload = parsedBody.value;

  const submissionId = randomUUID();
  const validation = validateContactPayload({ ...payload, submissionId });
  if (!validation.ok || validation.bot || !isAllowedService(validation.lead.service)) {
    return jsonResponse({ success: false, error: "Проверьте заполненные поля." }, 400);
  }

  const accessKey = (
    process.env.WEB3FORMS_ACCESS_KEY ||
    process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY ||
    ""
  ).trim();
  if (!accessKey) {
    return jsonResponse({ success: false, error: "Автоматическая отправка временно недоступна." }, 503);
  }

  const submittedAt = new Date().toISOString();
  const { lead } = validation;
  const precheckFields = lead.precheck
    ? {
      precheck_mode: lead.precheck.mode,
      precheck_practice: lead.precheck.practiceId,
      precheck_excerpt: lead.precheck.excerpt,
    }
    : {};

  try {
    const providerResponse = await fetch(WEB3FORMS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: request.headers.get("origin"),
      },
      body: JSON.stringify({
        access_key: accessKey,
        subject: `Новая заявка: ${lead.service}`,
        from_name: "Сайт ДоговорОфф",
        name: lead.name,
        phone: lead.phone,
        service: lead.service,
        message: lead.message || "Не указана",
        botcheck: "",
        submission_id: submissionId,
        consent: "Согласие на обработку персональных данных предоставлено",
        consent_timestamp: submittedAt,
        consent_document: `${LEGAL.siteUrl}/personal-data-consent`,
        consent_version: `${LEGAL.policyVersion} от ${LEGAL.effectiveDate}`,
        ...precheckFields,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const providerResult = await providerResponse.json().catch(() => ({}));

    if (!providerResponse.ok || providerResult.success !== true) {
      const status = providerResponse.status === 429 ? 429 : 502;
      return jsonResponse(
        { success: false, error: status === 429 ? "Слишком много попыток. Повторите позже." : "Сервис доставки временно недоступен." },
        status,
      );
    }

    const record = createContactRecord({
      submissionId,
      submittedAt,
      lead,
      consentDocument: `${LEGAL.siteUrl}/personal-data-consent`,
      consentVersion: `${LEGAL.policyVersion} от ${LEGAL.effectiveDate}`,
    });

    try {
      const integrationResult = await deliverContactIntegrations(record);
      const failedChannels = Object.entries(integrationResult)
        .filter(([, result]) => result.attempted && !result.ok)
        .map(([channel]) => channel);
      if (failedChannels.length > 0) {
        console.warn("Contact integrations failed.", { submissionId, channels: failedChannels });
      }
    } catch {
      console.warn("Contact integrations failed.", { submissionId, channels: ["unexpected"] });
    }

    return jsonResponse({ success: true }, 200);
  } catch {
    return jsonResponse({ success: false, error: "Сервис доставки временно недоступен." }, 502);
  }
}
