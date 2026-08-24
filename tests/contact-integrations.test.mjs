import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createContactRecord,
  deliverContactIntegrations,
  formatTelegramMessages,
  signGoogleSheetsRecord,
} from "../lib/contact-integrations.mjs";

const BASE_RECORD_INPUT = {
  submissionId: "39e87a18-1314-45e8-a719-4ee42c380013",
  submittedAt: "2026-08-24T10:15:00.000Z",
  consentDocument: "https://dogovoroff.vercel.app/personal-data-consent",
  consentVersion: "1.6 от 24 августа 2026 года",
  lead: {
    name: "Анна",
    phone: "+7 (912) 345-67-89",
    service: "Арбитраж и суды",
    message: "Нужна консультация по судебному спору.",
    precheck: {
      mode: "ai",
      practiceId: "litigation",
      excerpt: "Направление: Арбитраж и суды\nСледующий шаг: проверить документы.",
    },
  },
};

test("contact record preserves every approved lead field in a fixed schema", () => {
  const record = createContactRecord(BASE_RECORD_INPUT);

  assert.deepEqual(Object.keys(record), [
    "version",
    "submissionId",
    "submittedAt",
    "status",
    "name",
    "phone",
    "service",
    "message",
    "formMode",
    "precheckMode",
    "precheckPractice",
    "precheckExcerpt",
    "consent",
    "consentTimestamp",
    "consentDocument",
    "consentVersion",
    "source",
    "notes",
  ]);
  assert.equal(record.formMode, "Предварительный разбор");
  assert.equal(record.precheckMode, "AI");
  assert.equal(record.precheckPractice, "Арбитраж и суды");
  assert.equal(record.precheckExcerpt, BASE_RECORD_INPUT.lead.precheck.excerpt);
  assert.equal(record.consent, "Да");
  assert.equal(record.status, "Новая");
});

test("quick applications receive explicit non-precheck values", () => {
  const record = createContactRecord({
    ...BASE_RECORD_INPUT,
    lead: { ...BASE_RECORD_INPUT.lead, message: "", precheck: null },
  });

  assert.equal(record.message, "Не указано");
  assert.equal(record.formMode, "Быстрая заявка");
  assert.equal(record.precheckMode, "Не проводился");
  assert.equal(record.precheckPractice, "Не проводился");
  assert.equal(record.precheckExcerpt, "Не проводился");
});

test("Telegram formatter keeps all sections ordered and below the Bot API limit", () => {
  const record = createContactRecord({
    ...BASE_RECORD_INPUT,
    lead: {
      ...BASE_RECORD_INPUT.lead,
      message: `Начало сообщения ${"я".repeat(1_950)} конец сообщения`,
      precheck: {
        ...BASE_RECORD_INPUT.lead.precheck,
        excerpt: `Начало разбора ${"ю".repeat(1_150)} конец разбора`,
      },
    },
  });
  const messages = formatTelegramMessages(
    record,
    "https://docs.google.com/spreadsheets/d/example/edit",
  );

  assert.ok(messages.length >= 2);
  assert.ok(messages.every((message) => message.length <= 4_096));
  const fullText = messages.join("\n");
  for (const label of [
    "НОВАЯ ЗАЯВКА · ДОГОВОРОФФ",
    "ID заявки:",
    "Имя:",
    "Телефон:",
    "Направление:",
    "Сообщение:",
    "Результат:",
    "Дата согласия:",
    "Версия:",
    "Google Sheets:",
  ]) {
    assert.match(fullText, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(fullText, /Начало сообщения/);
  assert.match(fullText, /конец сообщения/);
  assert.match(fullText, /Начало разбора/);
  assert.match(fullText, /конец разбора/);
  assert.match(fullText, /Дата: 24 авг\. 2026 г\., 15:15/);
});

test("Google Sheets signatures are deterministic and record-bound", () => {
  const record = createContactRecord(BASE_RECORD_INPUT);
  const secret = "s".repeat(48);
  const signature = signGoogleSheetsRecord(record, secret);

  assert.match(signature, /^[a-f0-9]{64}$/);
  assert.equal(signature, signGoogleSheetsRecord(record, secret));
  assert.notEqual(signature, signGoogleSheetsRecord({ ...record, status: "В работе" }, secret));
});

test("configured integrations send one signed Sheet payload and structured Telegram messages", async () => {
  const record = createContactRecord(BASE_RECORD_INPUT);
  const calls = [];
  const env = {
    GOOGLE_SHEETS_WEBHOOK_URL: "https://script.google.com/macros/s/example/exec",
    GOOGLE_SHEETS_WEBHOOK_SECRET: "g".repeat(48),
    GOOGLE_SHEETS_URL: "https://docs.google.com/spreadsheets/d/example/edit",
    TELEGRAM_BOT_TOKEN: "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijk",
    TELEGRAM_CHAT_ID: "-1001234567890",
  };
  const fetchImpl = async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    if (String(url).startsWith("https://api.telegram.org/")) {
      return Response.json({ ok: true });
    }
    return Response.json({ ok: true });
  };

  const result = await deliverContactIntegrations(record, { env, fetchImpl });

  assert.deepEqual(result, {
    googleSheets: { attempted: true, ok: true },
    telegram: { attempted: true, ok: true },
  });
  const sheetCall = calls.find(({ url }) => url === env.GOOGLE_SHEETS_WEBHOOK_URL);
  assert.deepEqual(sheetCall.body.record, record);
  assert.match(sheetCall.body.signature, /^[a-f0-9]{64}$/);

  const telegramCalls = calls.filter(({ url }) => String(url).startsWith("https://api.telegram.org/"));
  assert.equal(telegramCalls.length, formatTelegramMessages(record, env.GOOGLE_SHEETS_URL).length);
  assert.ok(telegramCalls.every(({ body }) => body.chat_id === env.TELEGRAM_CHAT_ID));
  assert.ok(telegramCalls.every(({ body }) => !("parse_mode" in body)));
  assert.deepEqual(telegramCalls.at(-1).body.reply_markup, {
    inline_keyboard: [[{ text: "Открыть таблицу", url: env.GOOGLE_SHEETS_URL }]],
  });
});

test("missing or unsafe integration configuration never triggers an outbound request", async () => {
  const record = createContactRecord(BASE_RECORD_INPUT);
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return Response.json({ ok: true });
  };

  const result = await deliverContactIntegrations(record, {
    fetchImpl,
    env: {
      GOOGLE_SHEETS_WEBHOOK_URL: "https://example.com/collect",
      GOOGLE_SHEETS_WEBHOOK_SECRET: "short",
      TELEGRAM_BOT_TOKEN: "invalid",
      TELEGRAM_CHAT_ID: "public-chat",
    },
  });

  assert.equal(calls, 0);
  assert.deepEqual(result, {
    googleSheets: { attempted: false, ok: false },
    telegram: { attempted: false, ok: false },
  });
});

test("integration secrets are documented as blank server-only variables", async () => {
  const envSource = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  for (const name of [
    "GOOGLE_SHEETS_WEBHOOK_URL",
    "GOOGLE_SHEETS_WEBHOOK_SECRET",
    "GOOGLE_SHEETS_URL",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHAT_ID",
  ]) {
    assert.match(envSource, new RegExp(`^${name}=$`, "m"));
    assert.doesNotMatch(envSource, new RegExp(`NEXT_PUBLIC_${name}`));
  }
});
