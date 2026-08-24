import { PRECHECK_PRACTICES } from "./config.mjs";

const INPUT_KEYS = new Set(["version", "practiceId", "answers", "description", "aiConsent"]);
const PROVIDER_KEYS = [
  "summary",
  "missingInformation",
  "suggestedDocuments",
  "lawyerQuestions",
  "nextStep",
];
const MAX_DESCRIPTION_LENGTH = 1_200;
const MIN_COMPACT_DESCRIPTION_LENGTH = 10;
const COMPACT_ANSWER_KEYS = new Set(["deadline"]);
const MAX_SUMMARY_LENGTH = 600;
const MAX_ITEM_LENGTH = 300;
const MAX_LIST_ITEMS = 5;
const DISCLAIMER = "Предварительная автоматизированная систематизация, не юридическое заключение.";
const PROVIDER_SAFETY_PATTERNS = Object.freeze([
  /шанс(?:ы|ов)?\s+(?:на\s+)?(?:побед|выигрыш)|вероятност\w*\s+(?:побед|успех|выигрыш)|гарантир(?:уем|ую|ует|ованн)|точно\s+(?:побед|выигра)/iu,
  /(?:стоимость|цена)\s+(?:юридическ\w+\s+)?услуг|\d[\d\s]*(?:₽|руб(?:\.|ля|лей)?)/iu,
  /(?:статья|ст\.)\s*\d|(?:ГК|АПК|ГПК|КоАП|ЖК|ТК)\s*РФ|дело\s*№/iu,
  /(?:^|[^\p{L}])ФАС(?:[^\p{L}]|$)|антимонопольн|жалоб\w*[^.]{0,40}закуп|обжалован\w*[^.]{0,40}закуп/iu,
  /\d/u,
]);

function isPlainRecord(value) {
  return Boolean(
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null),
  );
}

function cleanText(value) {
  return value.replace(/\r\n?/g, "\n").replace(/\0/g, "").trim();
}

function isValidDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

function fail(error) {
  return { ok: false, error };
}

export function normalizePrecheckPayload(payload) {
  if (!isPlainRecord(payload)) return fail("Некорректные данные предварительного разбора.");
  if (Object.keys(payload).some((key) => !INPUT_KEYS.has(key))) {
    return fail("Запрос содержит неизвестные поля.");
  }
  if ((payload.version !== "1" && payload.version !== "2") || typeof payload.practiceId !== "string") {
    return fail("Неподдерживаемая версия или направление.");
  }

  const practice = PRECHECK_PRACTICES.find(({ id }) => id === payload.practiceId);
  if (!practice || !isPlainRecord(payload.answers) || typeof payload.aiConsent !== "boolean") {
    return fail("Некорректные данные предварительного разбора.");
  }
  if (typeof payload.description !== "string") {
    return fail("Описание должно быть текстом.");
  }

  const description = cleanText(payload.description);
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return fail("Описание превышает допустимую длину.");
  }

  if (payload.version === "2") {
    if (description.length < MIN_COMPACT_DESCRIPTION_LENGTH) {
      return fail("Опишите ситуацию чуть подробнее.");
    }
    if (Object.keys(payload.answers).some((key) => !COMPACT_ANSWER_KEYS.has(key))) {
      return fail("Ответы содержат неизвестное поле.");
    }

    const rawDeadline = payload.answers.deadline ?? "";
    if (typeof rawDeadline !== "string") return fail("Некорректное поле: deadline.");
    const deadline = cleanText(rawDeadline);
    if (deadline && !isValidDateOnly(deadline)) return fail("Некорректная дата: deadline.");

    return {
      ok: true,
      value: {
        version: "2",
        practiceId: practice.id,
        answers: { deadline },
        description,
        aiConsent: payload.aiConsent,
      },
    };
  }

  const questions = new Map(practice.questions.map((question) => [question.id, question]));
  if (Object.keys(payload.answers).some((key) => !questions.has(key))) {
    return fail("Ответы содержат неизвестное поле.");
  }

  const answers = {};
  for (const question of practice.questions) {
    const hasAnswer = Object.prototype.hasOwnProperty.call(payload.answers, question.id);
    if (!hasAnswer) return fail(`Не заполнено поле: ${question.id}.`);

    const rawValue = payload.answers[question.id];
    if (typeof rawValue !== "string") return fail(`Некорректное поле: ${question.id}.`);
    const value = cleanText(rawValue);

    if (question.type === "radio" || question.type === "select") {
      const allowedValues = new Set(question.options.map(([id]) => id));
      if (!allowedValues.has(value)) return fail(`Недопустимое значение: ${question.id}.`);
    } else if (question.type === "date") {
      if (value && !isValidDateOnly(value)) return fail(`Некорректная дата: ${question.id}.`);
      if (!value && question.required !== false) return fail(`Не заполнено поле: ${question.id}.`);
    } else if (question.type === "textarea") {
      if (!value && question.required !== false) return fail(`Не заполнено поле: ${question.id}.`);
      if (value.length > question.maxLength) return fail(`Поле слишком длинное: ${question.id}.`);
    } else {
      return fail(`Неподдерживаемый тип поля: ${question.id}.`);
    }

    answers[question.id] = value;
  }

  return {
    ok: true,
    value: {
      version: "1",
      practiceId: practice.id,
      answers,
      description,
      aiConsent: payload.aiConsent,
    },
  };
}

function yekaterinburgDateParts(now) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Yekaterinburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return [Number(values.year), Number(values.month), Number(values.day)];
}

function formatDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function calculateUrgency(deadline, now = new Date()) {
  if (typeof deadline !== "string" || !isValidDateOnly(deadline)) {
    return {
      level: "unknown",
      label: "Срок не указан",
      reason: "Дата или крайний срок не указаны.",
    };
  }

  const [year, month, day] = deadline.split("-").map(Number);
  const [currentYear, currentMonth, currentDay] = yekaterinburgDateParts(now);
  const targetOrdinal = Date.UTC(year, month - 1, day);
  const currentOrdinal = Date.UTC(currentYear, currentMonth - 1, currentDay);
  const days = Math.round((targetOrdinal - currentOrdinal) / 86_400_000);
  const formatted = formatDate(deadline);

  if (days <= 7) {
    return {
      level: "high",
      label: "Требует оперативного внимания",
      reason: days < 0 ? `Указанная дата ${formatted} уже прошла.` : `Указана дата ${formatted}.`,
    };
  }
  if (days <= 30) {
    return {
      level: "medium",
      label: "Стоит запланировать",
      reason: `Указана дата ${formatted}.`,
    };
  }
  return {
    level: "normal",
    label: "Срок позволяет планировать",
    reason: `Указана дата ${formatted}.`,
  };
}

export function maskSensitiveText(text) {
  if (typeof text !== "string") return "";

  return cleanText(text)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[email скрыт]")
    .replace(/(паспорт(?:а)?(?:\s*(?:серия|номер|№))?\s*)\d{4}[\s-]?\d{6}/giu, "$1[номер скрыт]")
    .replace(/(СНИЛС(?:\s*(?:номер|№))?\s*[:№-]?\s*)\d{3}[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{2}/giu, "$1[номер скрыт]")
    .replace(/(ИНН(?:\s*(?:номер|№))?\s*[:№-]?\s*)\d(?:[\s-]?\d){9,11}/giu, "$1[номер скрыт]")
    .replace(/(ОГРН(?:ИП)?|КПП|сч[её]т|карта)(?:\s*(?:номер|№))?\s*[:№-]?\s*\d(?:[\s-]?\d){8,19}/giu, "$1 [номер скрыт]")
    .replace(/(?:\+?7|8)[\s().-]*\d{3}[\s().-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}/gu, "[телефон скрыт]")
    .replace(/\d[\d\s-]{8,}\d/gu, (candidate) => (
      candidate.replace(/\D/gu, "").length >= 10 ? "[номер скрыт]" : candidate
    ));
}

function closestDeadline(practice, answers) {
  return practice.questions
    .filter(({ type }) => type === "date")
    .map(({ id }) => answers[id])
    .filter(isValidDateOnly)
    .sort()[0] || "";
}

function boundedList(items) {
  return items.slice(0, MAX_LIST_ITEMS).map((item) => item.slice(0, MAX_ITEM_LENGTH));
}

export function buildFallbackCard(input, now = new Date()) {
  const practice = PRECHECK_PRACTICES.find(({ id }) => id === input?.practiceId)
    || PRECHECK_PRACTICES.find(({ id }) => id === "private");
  const goal = typeof input?.answers?.goal === "string" ? cleanText(input.answers.goal) : "";
  const compactDescription = input?.version === "2" && typeof input?.description === "string"
    ? maskSensitiveText(input.description)
    : "";
  const situation = goal || compactDescription;
  const situationSnippet = situation.length > 280
    ? `${situation.slice(0, 277).trimEnd()}…`
    : situation;
  const summary = situationSnippet
    ? `Предварительно зафиксирована задача: ${situationSnippet}`
    : `Предварительно определено направление: ${practice.label}.`;

  return {
    version: "1",
    practice: practice.label,
    summary: summary.slice(0, MAX_SUMMARY_LENGTH),
    urgency: calculateUrgency(closestDeadline(practice, input?.answers || {}), now),
    missingInformation: boundedList(practice.fallbackMissingInformation),
    suggestedDocuments: boundedList(practice.fallbackDocuments),
    lawyerQuestions: boundedList(practice.fallbackQuestions),
    nextStep: practice.fallbackNextStep.slice(0, MAX_ITEM_LENGTH),
    disclaimer: DISCLAIMER,
  };
}

function validatePlainString(value, maxLength) {
  if (typeof value !== "string") return null;
  const cleaned = cleanText(value);
  if (!cleaned || cleaned.length > maxLength || /<[^>]*>/u.test(cleaned)) return null;
  return cleaned;
}

function validateStringList(value) {
  if (!Array.isArray(value) || value.length > MAX_LIST_ITEMS) return null;
  const normalized = value.map((item) => validatePlainString(item, MAX_ITEM_LENGTH));
  return normalized.every(Boolean) ? normalized : null;
}

export function validateProviderResult(value) {
  if (!isPlainRecord(value)) return fail("Некорректный ответ провайдера.");
  const keys = Object.keys(value);
  if (keys.length !== PROVIDER_KEYS.length || keys.some((key) => !PROVIDER_KEYS.includes(key))) {
    return fail("Ответ провайдера содержит неизвестные поля.");
  }

  const summary = validatePlainString(value.summary, MAX_SUMMARY_LENGTH);
  const missingInformation = validateStringList(value.missingInformation);
  const suggestedDocuments = validateStringList(value.suggestedDocuments);
  const lawyerQuestions = validateStringList(value.lawyerQuestions);
  const nextStep = validatePlainString(value.nextStep, MAX_ITEM_LENGTH);

  if (!summary || !missingInformation || !suggestedDocuments || !lawyerQuestions || !nextStep) {
    return fail("Ответ провайдера не прошёл проверку.");
  }

  const generatedText = [
    summary,
    ...missingInformation,
    ...suggestedDocuments,
    ...lawyerQuestions,
    nextStep,
  ].join("\n");
  if (PROVIDER_SAFETY_PATTERNS.some((pattern) => pattern.test(generatedText))) {
    return fail("Ответ провайдера не прошёл проверку.");
  }
  if (!/юрист\p{L}*/iu.test(nextStep)) {
    return fail("Ответ провайдера не прошёл проверку.");
  }

  return {
    ok: true,
    value: { summary, missingInformation, suggestedDocuments, lawyerQuestions, nextStep },
  };
}

export function mergeTrustedCard(fallback, providerResult) {
  const validated = validateProviderResult(providerResult);
  if (!isPlainRecord(fallback) || !validated.ok) return fallback;

  return {
    ...fallback,
    ...validated.value,
    version: fallback.version,
    practice: fallback.practice,
    urgency: fallback.urgency,
    disclaimer: fallback.disclaimer,
  };
}

export function buildConfirmedExcerpt(result) {
  if (!isPlainRecord(result)) return "";
  const sections = [
    `Направление: ${result.practice || "Не определено"}`,
    `Ситуация: ${result.summary || "Требуется первичный разбор"}`,
    result.urgency?.label ? `Срочность: ${result.urgency.label}` : "",
    Array.isArray(result.suggestedDocuments) && result.suggestedDocuments.length
      ? `Документы: ${result.suggestedDocuments.join("; ")}`
      : "",
    result.nextStep ? `Следующий шаг: ${result.nextStep}` : "",
  ].filter(Boolean);

  return cleanText(sections.join("\n")).slice(0, 1_200);
}
