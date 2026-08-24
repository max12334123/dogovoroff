import { createHash, randomUUID } from "node:crypto";
import { PRACTICES, PLANS } from "../../content.js";
import { LEGAL } from "../../legal.js";
import { validateContactPayload } from "../../../lib/contact-form.mjs";

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

function jsonResponse(body, status, headers = {}) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
      ...headers,
    },
  });
}

function getClientKey(request) {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-forwarded-for") ||
    "unknown";
  const address = forwarded.split(",")[0].trim().slice(0, 128);

  return createHash("sha256").update(address).digest("hex");
}

function consumeRateLimit(clientKey, now = Date.now()) {
  for (const [key, bucket] of rateLimitStore) {
    if (bucket.resetAt <= now) rateLimitStore.delete(key);
  }

  while (rateLimitStore.size >= RATE_LIMIT_MAX_CLIENTS) {
    const oldestKey = rateLimitStore.keys().next().value;
    if (!oldestKey) break;
    rateLimitStore.delete(oldestKey);
  }

  const current = rateLimitStore.get(clientKey);
  if (!current) {
    rateLimitStore.set(clientKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfter: 0 };
}

export function isAllowedService(service) {
  return ALLOWED_SERVICES.has(service);
}

function hasTrustedBrowserOrigin(request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const requestUrl = new URL(request.url);
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const forwardedHost = (
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    ""
  ).split(",")[0].trim();
  const acceptedOrigins = new Set([requestUrl.origin]);

  if (forwardedHost) {
    acceptedOrigins.add(`${forwardedProtocol || requestUrl.protocol.slice(0, -1)}://${forwardedHost}`);
  }

  if (!origin || !acceptedOrigins.has(origin)) return false;
  return !fetchSite || fetchSite === "same-origin" || fetchSite === "same-site";
}

export async function POST(request) {
  if (!hasTrustedBrowserOrigin(request)) {
    return jsonResponse({ success: false, error: "Недопустимый источник запроса." }, 403);
  }

  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return jsonResponse({ success: false, error: "Ожидается JSON-запрос." }, 415);
  }

  const rateLimit = consumeRateLimit(getClientKey(request));
  if (!rateLimit.allowed) {
    return jsonResponse(
      { success: false, error: "Слишком много попыток. Повторите позже." },
      429,
      { "Retry-After": String(rateLimit.retryAfter) },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return jsonResponse({ success: false, error: "Обращение превышает допустимый размер." }, 413);
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return jsonResponse({ success: false, error: "Обращение превышает допустимый размер." }, 413);
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ success: false, error: "Некорректный формат обращения." }, 400);
  }

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

    return jsonResponse({ success: true }, 200);
  } catch {
    return jsonResponse({ success: false, error: "Сервис доставки временно недоступен." }, 502);
  }
}
