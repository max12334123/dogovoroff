import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PRECHECK_PRACTICES } from "../features/precheck/config.mjs";
import {
  buildFallbackCard,
  mergeTrustedCard,
  normalizePrecheckPayload,
  validateProviderResult,
} from "../features/precheck/domain.mjs";

const NOW = new Date("2026-08-24T06:00:00.000Z");
const UNKNOWN_FACTS = [
  "ООО Альфа",
  "А40-12345/2026",
  "15 сентября 2026 года",
  "500 000 рублей",
];
const [specSource, workerReadmeSource] = await Promise.all([
  readFile(new URL("../docs/superpowers/specs/2026-08-24-ai-precheck-design.md", import.meta.url), "utf8"),
  readFile(new URL("../cloudflare/precheck-worker/README.md", import.meta.url), "utf8"),
]);

function answersFor(practice, variant) {
  return Object.fromEntries(practice.questions.map((question) => {
    if (question.options) {
      return [question.id, question.options[Math.min(variant, question.options.length - 1)][0]];
    }
    if (question.type === "date") {
      return [question.id, variant === 0 ? "" : "2026-10-30"];
    }
    if (question.id === "goal") {
      return [question.id, variant === 0
        ? "Подготовить материалы для первичной проверки"
        : "Понять, какие сведения нужно уточнить перед консультацией"];
    }
    return [question.id, variant === 0
      ? "Есть обезличенные документы по ситуации"
      : "Перечень документов требует уточнения"];
  }));
}

const QUALITY_FIXTURES = PRECHECK_PRACTICES.flatMap((practice) => [0, 1].map((variant) => ({
  id: `${practice.id}-${variant + 1}`,
  payload: {
    version: "1",
    practiceId: practice.id,
    answers: answersFor(practice, variant),
    description: variant === 0
      ? "Нужно систематизировать этапы и подготовиться к разговору с юристом."
      : "Требуется понять, каких сведений не хватает для первичного анализа.",
    aiConsent: true,
  },
})));

function safeProviderResult() {
  return {
    summary: "Ситуация требует предметной проверки исходных сведений.",
    missingInformation: ["Точный срок ближайшего действия", "Последовательность ключевых событий"],
    suggestedDocuments: ["Документ, с которого началась ситуация", "Связанная переписка без лишних персональных данных"],
    lawyerQuestions: ["Какой результат требуется получить?", "Какие действия уже предпринимались?"],
    nextStep: "Передать обезличенные вводные и документы юристу для проверки.",
  };
}

function assertQualityCard(card, unknownFacts = UNKNOWN_FACTS) {
  const serialized = JSON.stringify(card);
  assert.doesNotMatch(serialized, /шанс(?:ы|ов)?\s+(?:на\s+)?(?:побед|выигрыш)|вероятност\w*\s+(?:побед|успех|выигрыш)|гарантир(?:уем|ую|ует|ованн)|точно\s+(?:побед|выигра)/iu);
  assert.doesNotMatch(serialized, /(?:стоимость|цена)\s+(?:юридическ\w+\s+)?услуг|\d[\d\s]*(?:₽|руб(?:\.|ля|лей)?)/iu);
  assert.doesNotMatch(serialized, /(?:статья|ст\.)\s*\d|(?:ГК|АПК|ГПК|КоАП|ЖК|ТК)\s*РФ|дело\s*№/iu);
  assert.doesNotMatch(serialized, /(?:^|[^\p{L}])ФАС(?:[^\p{L}]|$)|антимонопольн|жалоб\w*[^.]{0,40}закуп|обжалован\w*[^.]{0,40}закуп/iu);
  assert.doesNotMatch(serialized, /<[^>]*>/u);
  for (const unknownFact of unknownFacts) assert.doesNotMatch(serialized, new RegExp(unknownFact, "iu"));
  assert.match(card.nextStep, /юрист/iu);
  assert.match(card.disclaimer, /не юридическое заключение/iu);
}

test("quality set contains two anonymized scenarios for every practice", () => {
  assert.equal(QUALITY_FIXTURES.length, 12);
  for (const practice of PRECHECK_PRACTICES) {
    assert.equal(QUALITY_FIXTURES.filter(({ payload }) => payload.practiceId === practice.id).length, 2);
  }
});

test("all deterministic and merged cards satisfy critical quality rules", () => {
  for (const fixture of QUALITY_FIXTURES) {
    const normalized = normalizePrecheckPayload(fixture.payload);
    assert.equal(normalized.ok, true, fixture.id);

    const fallback = buildFallbackCard(normalized.value, NOW);
    assertQualityCard(fallback);

    const provider = safeProviderResult();
    assert.equal(validateProviderResult(provider).ok, true, fixture.id);
    const merged = mergeTrustedCard(fallback, provider);
    assertQualityCard(merged);
    assert.equal(merged.practice, fallback.practice);
    assert.deepEqual(merged.urgency, fallback.urgency);
    assert.equal(merged.version, fallback.version);
    assert.equal(merged.disclaimer, fallback.disclaimer);
  }
});

test("provider validation blocks unsafe claims and responses without human review", () => {
  const valid = safeProviderResult();
  assert.equal(validateProviderResult({
    ...valid,
    suggestedDocuments: ["Акт осмотра фасада"],
  }).ok, true);

  const unsafeResults = [
    { ...valid, summary: "Шансы на победу составляют девяносто процентов." },
    { ...valid, summary: "Мы гарантируем положительный результат." },
    { ...valid, nextStep: "Стоимость юридических услуг составляет 50 000 ₽." },
    { ...valid, summary: "Следует применить статью 309 ГК РФ." },
    { ...valid, summary: "Нужно подать жалобу в ФАС по закупке." },
    { ...valid, summary: "<strong>Можно действовать</strong>." },
    { ...valid, nextStep: "Самостоятельно направить подготовленный документ." },
  ];

  for (const value of unsafeResults) assert.equal(validateProviderResult(value).ok, false);
});

test("quality assertions reject facts absent from anonymized input", () => {
  const normalized = normalizePrecheckPayload(QUALITY_FIXTURES[0].payload).value;
  const fallback = buildFallbackCard(normalized, NOW);
  const withInventedFact = {
    ...fallback,
    summary: "ООО Альфа уже признало долг.",
  };

  assert.throws(() => assertQualityCard(withInventedFact), /regular expression/i);
});

test("operational docs distinguish the runtime OIDC header from local development", () => {
  assert.match(specSource, /x-vercel-oidc-token/);
  assert.match(workerReadmeSource, /x-vercel-oidc-token/);
  assert.match(workerReadmeSource, /local development[^.]*VERCEL_OIDC_TOKEN/is);
  assert.match(specSource, /12 обезличенн[^.]*сценари/iu);
  assert.doesNotMatch(specSource, /маршрут использует автоматически выдаваемый `VERCEL_OIDC_TOKEN`/i);
});
