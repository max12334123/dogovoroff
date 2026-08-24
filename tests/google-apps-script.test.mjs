import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(
  new URL("../integrations/google-apps-script/Code.gs", import.meta.url),
  "utf8",
);
const context = vm.createContext({
  Date,
  JSON,
  Object,
  Array,
  String,
  RegExp,
  isFinite,
  Utilities: {
    formatDate: () => "24.08.2026 15:15:00",
  },
});
vm.runInContext(source, context);

test("Apps Script neutralizes spreadsheet formulas without altering ordinary text", () => {
  for (const value of ["=IMPORTXML()", "+123", "-42", "@formula"]) {
    assert.equal(context.safeCell_(value), `'${value}`);
  }
  assert.equal(context.safeCell_("Обычный текст"), "Обычный текст");
});

test("Apps Script accepts only the expected bounded record shape", () => {
  const record = {
    version: "1",
    submissionId: "39e87a18-1314-45e8-a719-4ee42c380013",
    submittedAt: "2026-08-24T10:15:00.000Z",
    status: "Новая",
    name: "Анна",
    phone: "+7 (912) 345-67-89",
    service: "Арбитраж и суды",
    message: "Нужна консультация",
    formMode: "Быстрая заявка",
    precheckMode: "Не проводился",
    precheckPractice: "Не проводился",
    precheckExcerpt: "Не проводился",
    consent: "Да",
    consentTimestamp: "2026-08-24T10:15:00.000Z",
    consentDocument: "https://dogovoroff.vercel.app/personal-data-consent",
    consentVersion: "1.6 от 24 августа 2026 года",
    source: "Сайт ДоговорОфф",
    notes: "",
  };

  assert.equal(context.isValidRecord_(record), true);
  assert.equal(context.isValidRecord_({ ...record, message: "x".repeat(2_001) }), false);
  assert.equal(context.isValidRecord_({ ...record, unexpected: "value" }), false);
  assert.equal(context.isValidRecord_({ ...record, status: "Подменена" }), false);
});

test("Apps Script writes all 17 spreadsheet columns in the configured order", () => {
  const row = context.recordToRow_({
    submissionId: "39e87a18-1314-45e8-a719-4ee42c380013",
    submittedAt: "2026-08-24T10:15:00.000Z",
    status: "Новая",
    name: "=IMPORTXML()",
    phone: "+7 (912) 345-67-89",
    service: "Арбитраж и суды",
    message: "Нужна консультация",
    formMode: "Быстрая заявка",
    precheckMode: "Не проводился",
    precheckPractice: "Не проводился",
    precheckExcerpt: "Не проводился",
    consent: "Да",
    consentTimestamp: "2026-08-24T10:15:00.000Z",
    consentDocument: "https://dogovoroff.vercel.app/personal-data-consent",
    consentVersion: "1.6 от 24 августа 2026 года",
    source: "Сайт ДоговорОфф",
    notes: "",
  });

  assert.equal(row.length, 17);
  assert.equal(row[0], "39e87a18-1314-45e8-a719-4ee42c380013");
  assert.equal(row[1], "24.08.2026 15:15:00");
  assert.equal(row[3], "'=IMPORTXML()");
  assert.equal(row[16], "");
});
