import { createHmac } from "node:crypto";
import { PRECHECK_PRACTICES } from "../features/precheck/config.mjs";

const TELEGRAM_API_BASE = "https://api.telegram.org";
const RESEND_EMAIL_ENDPOINT = "https://api.resend.com/emails";
const TELEGRAM_MESSAGE_LIMIT = 4_096;
const TELEGRAM_CHUNK_LIMIT = 3_500;
const INTEGRATION_TIMEOUT_MS = 8_000;
const MAX_INTEGRATION_RESPONSE_BYTES = 16_384;
const TELEGRAM_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1_000;
const TELEGRAM_IDEMPOTENCY_MAX_ENTRIES = 10_000;
const RECORD_VERSION = "1";

const PRACTICE_LABELS = new Map(
  PRECHECK_PRACTICES.map(({ id, label }) => [id, label]),
);
const telegramDeliveryCache = globalThis.__dogovoroffTelegramDeliveryCache ?? new Map();
globalThis.__dogovoroffTelegramDeliveryCache = telegramDeliveryCache;

function cleanRecordText(value, fallback = "Не указано") {
  const text = String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .trim();

  return text || fallback;
}

function isGoogleAppsScriptWebhook(value) {
  try {
    const url = new URL(String(value ?? "").trim());
    return url.protocol === "https:"
      && url.hostname === "script.google.com"
      && /^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}

function isGoogleSheetsUrl(value) {
  try {
    const url = new URL(String(value ?? "").trim());
    return url.protocol === "https:"
      && url.hostname === "docs.google.com"
      && /^\/spreadsheets\/d\/[^/]+(?:\/|$)/.test(url.pathname)
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}

function isTelegramToken(value) {
  return /^\d{6,12}:[A-Za-z0-9_-]{35,}$/.test(String(value ?? "").trim());
}

function isTelegramChatId(value) {
  return /^-?\d{5,20}$/.test(String(value ?? "").trim());
}

function isEmailAddress(value) {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u.test(String(value ?? "").trim());
}

function isEmailSender(value) {
  const sender = String(value ?? "").trim();
  const namedAddress = sender.match(/^[^<>\r\n]{1,80}<([^<>]+)>$/u);
  return sender.length <= 200 && isEmailAddress(namedAddress ? namedAddress[1] : sender);
}

function parseEmailRecipients(value) {
  const recipients = String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return recipients.length > 0 && recipients.length <= 5 && recipients.every(isEmailAddress)
    ? recipients
    : [];
}

function resultNotConfigured() {
  return { attempted: false, ok: false, status: null, reason: "not_configured" };
}

function resultFailed(status, reason) {
  return { attempted: true, ok: false, status, reason };
}

function splitTelegramText(text) {
  const chunks = [];
  let remaining = text;

  while (remaining.length > TELEGRAM_CHUNK_LIMIT) {
    let splitAt = remaining.lastIndexOf("\n", TELEGRAM_CHUNK_LIMIT);
    if (splitAt < TELEGRAM_CHUNK_LIMIT / 2) {
      splitAt = TELEGRAM_CHUNK_LIMIT;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).replace(/^\n/, "");
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

function formatTelegramTimestamp(value) {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return cleanRecordText(value);
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Yekaterinburg",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

async function readJsonResponse(response) {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_INTEGRATION_RESPONSE_BYTES) return {};

  const reader = response.body?.getReader();
  if (!reader) return response.json().catch(() => ({}));

  const chunks = [];
  let receivedBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    receivedBytes += value.byteLength;
    if (receivedBytes > MAX_INTEGRATION_RESPONSE_BYTES) {
      await reader.cancel("Integration response limit exceeded").catch(() => {});
      return {};
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return {};
  }
}

export function createContactRecord({
  submissionId,
  submittedAt,
  consentDocument,
  consentVersion,
  lead,
}) {
  const precheck = lead?.precheck ?? null;
  const practiceLabel = precheck
    ? PRACTICE_LABELS.get(precheck.practiceId) || "Не определена"
    : "Не проводился";

  return {
    version: RECORD_VERSION,
    submissionId: cleanRecordText(submissionId),
    submittedAt: cleanRecordText(submittedAt),
    status: "Новая",
    name: cleanRecordText(lead?.name),
    phone: cleanRecordText(lead?.phone),
    service: cleanRecordText(lead?.service),
    message: cleanRecordText(lead?.message),
    formMode: precheck ? "Предварительный разбор" : "Быстрая заявка",
    precheckMode: precheck
      ? (precheck.mode === "ai" ? "AI" : "Автоматический")
      : "Не проводился",
    precheckPractice: practiceLabel,
    precheckExcerpt: precheck
      ? cleanRecordText(precheck.excerpt)
      : "Не проводился",
    consent: "Да",
    consentTimestamp: cleanRecordText(submittedAt),
    consentDocument: cleanRecordText(consentDocument),
    consentVersion: cleanRecordText(consentVersion),
    source: "Сайт ДоговорОфф",
    notes: "",
  };
}

export function formatTelegramMessages(record, googleSheetsUrl = "") {
  const sheetLine = isGoogleSheetsUrl(googleSheetsUrl)
    ? `\nGoogle Sheets: ${googleSheetsUrl}`
    : "";
  const text = [
    "НОВАЯ ЗАЯВКА · ДОГОВОРОФФ",
    "",
    `ID заявки: ${record.submissionId}`,
    `Дата: ${formatTelegramTimestamp(record.submittedAt)}`,
    `Статус: ${record.status}`,
    "",
    "КОНТАКТ",
    `Имя: ${record.name}`,
    `Телефон: ${record.phone}`,
    "",
    "ЗАПРОС",
    `Направление: ${record.service}`,
    `Тип формы: ${record.formMode}`,
    `Сообщение:\n${record.message}`,
    "",
    "ПРЕДВАРИТЕЛЬНЫЙ РАЗБОР",
    `Режим: ${record.precheckMode}`,
    `Практика: ${record.precheckPractice}`,
    `Результат:\n${record.precheckExcerpt}`,
    "",
    "СОГЛАСИЕ",
    `Получено: ${record.consent}`,
    `Дата согласия: ${formatTelegramTimestamp(record.consentTimestamp)}`,
    `Документ: ${record.consentDocument}`,
    `Версия: ${record.consentVersion}`,
    "",
    `Источник: ${record.source}${sheetLine}`,
  ].join("\n");

  const chunks = splitTelegramText(text);
  if (chunks.some((chunk) => chunk.length > TELEGRAM_MESSAGE_LIMIT)) {
    throw new Error("Telegram message exceeds the API limit.");
  }
  return chunks;
}

export function signGoogleSheetsRecord(record, secret) {
  return createHmac("sha256", String(secret)).update(JSON.stringify(record)).digest("hex");
}

async function sendToGoogleSheets(record, { env, fetchImpl }) {
  const url = String(env.GOOGLE_SHEETS_WEBHOOK_URL ?? "").trim();
  const secret = String(env.GOOGLE_SHEETS_WEBHOOK_SECRET ?? "").trim();
  if (!isGoogleAppsScriptWebhook(url) || secret.length < 32) {
    return resultNotConfigured();
  }

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        record,
        signature: signGoogleSheetsRecord(record, secret),
      }),
      redirect: "follow",
      signal: AbortSignal.timeout(INTEGRATION_TIMEOUT_MS),
    });
    const result = await readJsonResponse(response);
    if (!response.ok) return resultFailed(response.status, "http_error");
    if (result.ok !== true) return resultFailed(response.status, "invalid_response");
    return {
      attempted: true,
      ok: true,
      status: response.status,
      reason: "delivered",
      duplicate: result.duplicate === true,
    };
  } catch {
    return resultFailed(null, "network_error");
  }
}

async function sendToTelegram(record, { env, fetchImpl }) {
  const token = String(env.TELEGRAM_BOT_TOKEN ?? "").trim();
  const chatId = String(env.TELEGRAM_CHAT_ID ?? "").trim();
  const sheetUrl = String(env.GOOGLE_SHEETS_URL ?? "").trim();
  if (!isTelegramToken(token) || !isTelegramChatId(chatId)) {
    return resultNotConfigured();
  }

  const messages = formatTelegramMessages(record, sheetUrl);
  let allSucceeded = true;
  let failureStatus = null;
  let failureReason = "http_error";

  for (const [index, text] of messages.entries()) {
    const isLast = index === messages.length - 1;
    const body = { chat_id: chatId, text };
    if (isLast && isGoogleSheetsUrl(sheetUrl)) {
      body.reply_markup = {
        inline_keyboard: [[{ text: "Открыть таблицу", url: sheetUrl }]],
      };
    }

    try {
      const response = await fetchImpl(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(INTEGRATION_TIMEOUT_MS),
      });
      const result = await readJsonResponse(response);
      if (!response.ok || result.ok !== true) {
        allSucceeded = false;
        failureStatus ??= response.status;
        failureReason = response.ok ? "invalid_response" : "http_error";
      }
    } catch {
      allSucceeded = false;
      failureReason = "network_error";
    }
  }

  return allSucceeded
    ? { attempted: true, ok: true, status: 200, reason: "delivered" }
    : resultFailed(failureStatus, failureReason);
}

async function sendToTelegramOnce(record, context) {
  const chatId = String(context.env.TELEGRAM_CHAT_ID ?? "").trim();
  const key = `${chatId}:${record.submissionId}`;
  const now = Date.now();
  for (const [cacheKey, entry] of telegramDeliveryCache) {
    if (entry.expiresAt <= now) telegramDeliveryCache.delete(cacheKey);
  }
  const existing = telegramDeliveryCache.get(key);
  if (existing) {
    if (existing.promise) return existing.promise;
    return { attempted: false, ok: true, status: null, reason: "duplicate_skipped" };
  }

  while (telegramDeliveryCache.size >= TELEGRAM_IDEMPOTENCY_MAX_ENTRIES) {
    const oldestKey = telegramDeliveryCache.keys().next().value;
    if (!oldestKey) break;
    telegramDeliveryCache.delete(oldestKey);
  }

  const promise = sendToTelegram(record, context);
  telegramDeliveryCache.set(key, { promise, expiresAt: now + TELEGRAM_IDEMPOTENCY_TTL_MS });
  const result = await promise;
  if (result.ok) {
    telegramDeliveryCache.set(key, { result, expiresAt: now + TELEGRAM_IDEMPOTENCY_TTL_MS });
  } else {
    telegramDeliveryCache.delete(key);
  }
  return result;
}

async function sendToEmail(record, { env, fetchImpl }) {
  const apiKey = String(env.RESEND_API_KEY ?? "").trim();
  const from = String(env.CONTACT_EMAIL_FROM ?? "").trim();
  const to = parseEmailRecipients(env.CONTACT_EMAIL_TO);
  if (!/^re_[A-Za-z0-9_]{16,}$/u.test(apiKey) || !isEmailSender(from) || !to.length) {
    return resultNotConfigured();
  }

  try {
    const response = await fetchImpl(RESEND_EMAIL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `contact/${record.submissionId}`,
      },
      body: JSON.stringify({
        from,
        to,
        subject: `Новая заявка · ${record.service}`,
        text: formatTelegramMessages(record).join("\n"),
      }),
      signal: AbortSignal.timeout(INTEGRATION_TIMEOUT_MS),
    });
    if (!response.ok) return resultFailed(response.status, "http_error");
    const result = await readJsonResponse(response);
    return typeof result.id === "string" && result.id
      ? { attempted: true, ok: true, status: response.status, reason: "delivered" }
      : resultFailed(response.status, "invalid_response");
  } catch {
    return resultFailed(null, "network_error");
  }
}

export async function deliverContactIntegrations(
  record,
  { env = process.env, fetchImpl = globalThis.fetch } = {},
) {
  const googleSheets = await sendToGoogleSheets(record, { env, fetchImpl });
  // A duplicate row only proves that Sheets accepted this UUID earlier; it does
  // not prove that Telegram or email succeeded, so downstream channels still
  // receive the retry. Their own idempotency guards decide whether to send.
  const [telegram, email] = await Promise.all([
    sendToTelegramOnce(record, { env, fetchImpl }),
    sendToEmail(record, { env, fetchImpl }),
  ]);

  return { googleSheets, telegram, email };
}
