import assert from "node:assert/strict";
import test from "node:test";
import {
  buildConfirmedExcerpt,
  buildFallbackCard,
  calculateUrgency,
  maskSensitiveText,
  mergeTrustedCard,
  normalizePrecheckPayload,
  validateProviderResult,
} from "../features/precheck/domain.mjs";

const validPayload = {
  version: "1",
  practiceId: "contracts",
  answers: {
    applicantType: "organization",
    stage: "documents",
    goal: "Проверить условия до подписания",
    deadline: "2026-09-10",
    contractTask: "review",
    signed: "no",
    mainRisk: "liability",
  },
  description: "Нужно проверить проект договора поставки.",
  aiConsent: true,
};

const compactPayload = {
  version: "2",
  practiceId: "contracts",
  answers: { deadline: "2026-09-10" },
  description: "Нужно проверить проект договора поставки до подписания.",
  aiConsent: false,
};

test("payload normalization accepts only configured keys and values", () => {
  const result = normalizePrecheckPayload(validPayload);

  assert.equal(result.ok, true);
  assert.deepEqual(result.value, validPayload);

  for (const payload of [
    { ...validPayload, practiceId: "fas" },
    { ...validPayload, unknown: true },
    { ...validPayload, answers: { ...validPayload.answers, injected: "yes" } },
    { ...validPayload, answers: { ...validPayload.answers, contractTask: "hack" } },
    { ...validPayload, description: "x".repeat(1_201) },
    { ...validPayload, aiConsent: "yes" },
  ]) {
    assert.equal(normalizePrecheckPayload(payload).ok, false);
  }
});

test("normalization trims text and rejects malformed dates", () => {
  const normalized = normalizePrecheckPayload({
    ...validPayload,
    answers: {
      ...validPayload.answers,
      goal: "  Проверить риски\r\n  до подписания  ",
      deadline: "",
    },
    description: "  Короткое описание\r\nбез контактов.  ",
  });

  assert.equal(normalized.ok, true);
  assert.equal(normalized.value.answers.goal, "Проверить риски\n  до подписания");
  assert.equal(normalized.value.answers.deadline, "");
  assert.equal(normalized.value.description, "Короткое описание\nбез контактов.");

  assert.equal(normalizePrecheckPayload({
    ...validPayload,
    answers: { ...validPayload.answers, deadline: "2026-02-30" },
  }).ok, false);
});

test("compact payload needs only a meaningful situation and optional deadline", () => {
  const normalized = normalizePrecheckPayload({
    ...compactPayload,
    description: "  Нужно проверить договор\r\nдо подписания.  ",
  });

  assert.equal(normalized.ok, true);
  assert.deepEqual(normalized.value, {
    ...compactPayload,
    description: "Нужно проверить договор\nдо подписания.",
  });

  for (const payload of [
    { ...compactPayload, description: "Коротко" },
    { ...compactPayload, answers: { deadline: "2026-02-30" } },
    { ...compactPayload, answers: { deadline: "", injected: "yes" } },
  ]) {
    assert.equal(normalizePrecheckPayload(payload).ok, false);
  }
});

test("urgency uses Yekaterinburg calendar dates and exact boundaries", () => {
  const now = new Date("2026-08-24T06:00:00.000Z");

  assert.equal(calculateUrgency("2026-08-23", now).level, "high");
  assert.equal(calculateUrgency("2026-08-31", now).level, "high");
  assert.equal(calculateUrgency("2026-09-01", now).level, "medium");
  assert.equal(calculateUrgency("2026-09-23", now).level, "medium");
  assert.equal(calculateUrgency("2026-09-24", now).level, "normal");
  assert.equal(calculateUrgency("", now).level, "unknown");
  assert.equal(calculateUrgency("2026-02-30", now).level, "unknown");
});

test("masking removes obvious contact and document identifiers", () => {
  const masked = maskSensitiveText(
    "Иван: test@example.com, +7 912 345-67-89, паспорт 4510 123456, ИНН 860312345678, СНИЛС 123-456-789 00",
  );

  assert.doesNotMatch(masked, /test@example\.com|912 345|4510 123456|860312345678|123-456-789/);
  assert.match(masked, /\[email скрыт\]/);
  assert.match(masked, /\[телефон скрыт\]/);
  assert.match(masked, /\[номер скрыт\]/);
});

test("fallback card keeps trusted fields deterministic", () => {
  const normalized = normalizePrecheckPayload(validPayload).value;
  const card = buildFallbackCard(normalized, new Date("2026-08-24T06:00:00.000Z"));

  assert.equal(card.version, "1");
  assert.equal(card.practice, "Договоры, претензии и переговоры");
  assert.equal(card.urgency.level, "medium");
  assert.match(card.summary, /провер/iu);
  assert.ok(card.missingInformation.length <= 5);
  assert.ok(card.suggestedDocuments.length <= 5);
  assert.ok(card.lawyerQuestions.length <= 5);
  assert.match(card.disclaimer, /не юридическое заключение/i);
});

test("compact fallback uses the submitted situation without inventing intake answers", () => {
  const normalized = normalizePrecheckPayload(compactPayload).value;
  const card = buildFallbackCard(normalized, new Date("2026-08-24T06:00:00.000Z"));

  assert.match(card.summary, /проект договора поставки/iu);
  assert.equal(card.urgency.level, "medium");
  assert.doesNotMatch(JSON.stringify(card), /applicantType|stage|contractTask/);
});

test("provider result is strict, bounded, and plain text", () => {
  const valid = {
    summary: "Нужно проверить договор до подписания.",
    missingInformation: ["Срок поставки"],
    suggestedDocuments: ["Проект договора"],
    lawyerQuestions: ["Согласованы ли существенные условия?"],
    nextStep: "Передать проект на проверку юристу.",
  };

  assert.deepEqual(validateProviderResult(valid), { ok: true, value: valid });

  for (const value of [
    { ...valid, verdict: "win" },
    { ...valid, missingInformation: Array(6).fill("x") },
    { ...valid, summary: "x".repeat(601) },
    { ...valid, nextStep: "<strong>Отправить</strong>" },
    { ...valid, lawyerQuestions: [""] },
  ]) {
    assert.equal(validateProviderResult(value).ok, false);
  }
});

test("provider enrichment cannot replace trusted card fields", () => {
  const fallback = buildFallbackCard(
    normalizePrecheckPayload(validPayload).value,
    new Date("2026-08-24T06:00:00.000Z"),
  );
  const provider = {
    summary: "Условия требуют предметной проверки.",
    missingInformation: ["Редакция приложения"],
    suggestedDocuments: ["Проект договора"],
    lawyerQuestions: ["Какие условия уже согласованы?"],
    nextStep: "Передать актуальную редакцию юристу.",
  };
  const merged = mergeTrustedCard(fallback, provider);

  assert.deepEqual(merged, { ...fallback, ...provider });
  assert.equal(merged.version, fallback.version);
  assert.equal(merged.practice, fallback.practice);
  assert.deepEqual(merged.urgency, fallback.urgency);
  assert.equal(merged.disclaimer, fallback.disclaimer);
});

test("confirmed excerpt is bounded and contains no hidden intake answers", () => {
  const card = buildFallbackCard(
    normalizePrecheckPayload(validPayload).value,
    new Date("2026-08-24T06:00:00.000Z"),
  );
  const excerpt = buildConfirmedExcerpt(card);

  assert.ok(excerpt.length <= 1_200);
  assert.match(excerpt, /Направление:/);
  assert.match(excerpt, /Следующий шаг:/);
  assert.doesNotMatch(excerpt, /applicantType|contractTask|aiConsent/);
});
