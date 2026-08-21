import { createHmac, randomBytes } from "node:crypto";
import { consumeRateLimit, readTextBodyWithLimit, validateContactPayload } from "../../../lib/contact-form.mjs";
import { LEGAL } from "../../legal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;
const RATE_LIMIT_PEPPER = randomBytes(32);
const rateLimitStore = globalThis.__dogovoroffContactRateLimitStore ?? new Map();

if (!globalThis.__dogovoroffContactRateLimitStore) {
  globalThis.__dogovoroffContactRateLimitStore = rateLimitStore;
}

function json(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      ...init.headers,
    },
  });
}

function log(level, message, request, details = {}) {
  const entry = {
    level,
    message,
    route: "/api/contact",
    requestId: request.headers.get("x-vercel-id") || undefined,
    ...details,
  };
  const method = level === "error" ? console.error : console.info;
  method(JSON.stringify(entry));
}

function getClientKey(request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "unknown";
  return createHmac("sha256", RATE_LIMIT_PEPPER).update(address).digest("hex").slice(0, 24);
}

function hasAllowedOrigin(request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin || (fetchSite && fetchSite !== "same-origin")) return false;

  try {
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const requestHost = forwardedHost || request.headers.get("host") || new URL(request.url).host;
    return new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}

function buildEmailText(lead) {
  return [
    "Новая заявка с сайта ДоговорОфф",
    "",
    `Имя: ${lead.name}`,
    `Телефон: ${lead.phone}`,
    `Направление: ${lead.service}`,
    `Задача: ${lead.message || "Не указана"}`,
    "",
    "Согласие на обработку персональных данных: предоставлено",
    `Документ: ${LEGAL.siteUrl}/personal-data-consent`,
    `Версия: ${LEGAL.policyVersion} от ${LEGAL.effectiveDate}`,
  ].join("\n");
}

async function sendEmail(lead) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.CONTACT_FROM_EMAIL?.trim();
  const to = process.env.CONTACT_TO_EMAIL?.trim() || LEGAL.email;

  if (!apiKey || !from) {
    return { ok: false, code: "EMAIL_NOT_CONFIGURED" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `dogovoroff-contact-${lead.submissionId}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Новая заявка: ${lead.service}`,
        text: buildEmailText(lead),
      }),
      signal: controller.signal,
    });

    return response.ok ? { ok: true } : { ok: false, code: "EMAIL_PROVIDER_ERROR", status: response.status };
  } catch (error) {
    return { ok: false, code: error?.name === "AbortError" ? "EMAIL_TIMEOUT" : "EMAIL_PROVIDER_ERROR" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request) {
  const startedAt = Date.now();
  log("info", "contact_request_started", request);

  if (!hasAllowedOrigin(request)) {
    log("info", "contact_request_rejected", request, { reason: "origin" });
    return json({ ok: false, code: "FORBIDDEN" }, { status: 403 });
  }

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ ok: false, code: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415 });
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return json({ ok: false, code: "PAYLOAD_TOO_LARGE" }, { status: 413 });
  }

  const clientKey = getClientKey(request);
  const rateLimit = consumeRateLimit(rateLimitStore, clientKey);
  if (!rateLimit.allowed) {
    log("info", "contact_request_rejected", request, { reason: "rate_limit" });
    return json(
      { ok: false, code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } },
    );
  }

  let payload;
  try {
    const body = await readTextBodyWithLimit(request, MAX_BODY_BYTES);
    if (!body.ok) {
      return json({ ok: false, code: "PAYLOAD_TOO_LARGE" }, { status: 413 });
    }
    payload = JSON.parse(body.text);
  } catch {
    return json({ ok: false, code: "INVALID_JSON" }, { status: 400 });
  }

  const validation = validateContactPayload(payload);
  if (validation.bot) {
    log("info", "contact_request_filtered", request, { reason: "honeypot", ms: Date.now() - startedAt });
    return json({ ok: true });
  }
  if (!validation.ok) {
    return json({ ok: false, code: "VALIDATION_ERROR", fields: validation.errors }, { status: 400 });
  }

  const delivery = await sendEmail(validation.lead);
  if (!delivery.ok) {
    const missingConfiguration = delivery.code === "EMAIL_NOT_CONFIGURED";
    log(missingConfiguration ? "info" : "error", "contact_delivery_failed", request, {
      code: delivery.code,
      providerStatus: delivery.status,
      ms: Date.now() - startedAt,
    });
    return json(
      { ok: false, code: delivery.code },
      { status: missingConfiguration ? 503 : 502 },
    );
  }

  log("info", "contact_request_completed", request, { ms: Date.now() - startedAt });
  return json({ ok: true });
}
