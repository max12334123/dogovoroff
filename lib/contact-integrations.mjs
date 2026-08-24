import { createHmac } from "node:crypto";
import { PRECHECK_PRACTICES } from "../features/precheck/config.mjs";

const TELEGRAM_API_BASE = "https://api.telegram.org";
const TELEGRAM_MESSAGE_LIMIT = 4_096;
const TELEGRAM_CHUNK_LIMIT = 3_500;
const INTEGRATION_TIMEOUT_MS = 8_000;
const RECORD_VERSION = "1";

const PRACTICE_LABELS = new Map(
  PRECHECK_PRACTICES.map(({ id, label }) => [id, label]),
);

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
  return response.json().catch(() => ({}));
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
    return { attempted: false, ok: false };
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
    return { attempted: true, ok: response.ok && result.ok === true };
  } catch {
    return { attempted: true, ok: false };
  }
}

async function sendToTelegram(record, { env, fetchImpl }) {
  const token = String(env.TELEGRAM_BOT_TOKEN ?? "").trim();
  const chatId = String(env.TELEGRAM_CHAT_ID ?? "").trim();
  const sheetUrl = String(env.GOOGLE_SHEETS_URL ?? "").trim();
  if (!isTelegramToken(token) || !isTelegramChatId(chatId)) {
    return { attempted: false, ok: false };
  }

  const messages = formatTelegramMessages(record, sheetUrl);
  let allSucceeded = true;

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
      if (!response.ok || result.ok !== true) allSucceeded = false;
    } catch {
      allSucceeded = false;
    }
  }

  return { attempted: true, ok: allSucceeded };
}

export async function deliverContactIntegrations(
  record,
  { env = process.env, fetchImpl = globalThis.fetch } = {},
) {
  const [googleSheets, telegram] = await Promise.all([
    sendToGoogleSheets(record, { env, fetchImpl }),
    sendToTelegram(record, { env, fetchImpl }),
  ]);

  return { googleSheets, telegram };
}
