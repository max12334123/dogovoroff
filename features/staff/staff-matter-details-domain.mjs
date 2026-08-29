import { isUuid } from "../cabinet/cabinet-write-domain.mjs";

export const MAX_MATTER_REFERENCE_LENGTH = 80;
export const MAX_MATTER_TITLE_LENGTH = 240;
export const MAX_MATTER_SUMMARY_LENGTH = 5000;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const UNSAFE_SINGLE_LINE_CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;
const UNSAFE_SUMMARY_CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const FALLBACK_ERROR = "Не удалось обновить реквизиты дела. Попробуйте ещё раз.";

function invalid(error) {
  return { valid: false, error };
}

function cleanSingleLine(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function cleanSummary(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidDate(value) {
  const match = DATE_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(`${value}T00:00:00.000Z`);

  return year >= 1
    && month >= 1
    && month <= 12
    && day >= 1
    && date.getUTCFullYear() === year
    && date.getUTCMonth() + 1 === month
    && date.getUTCDate() === day;
}

export function validateMatterDetails(input) {
  if (!input || typeof input !== "object" || !isUuid(input.matterId)) {
    return invalid("Некорректное дело.");
  }

  const reference = cleanSingleLine(input.reference);
  const title = cleanSingleLine(input.title);
  const summary = cleanSummary(input.summary);
  const responseDueAt = cleanSingleLine(input.responseDueAt);

  if (reference.length < 1 || reference.length > MAX_MATTER_REFERENCE_LENGTH) {
    return invalid(`Номер дела должен содержать от 1 до ${MAX_MATTER_REFERENCE_LENGTH} символов.`);
  }

  if (title.length < 1 || title.length > MAX_MATTER_TITLE_LENGTH) {
    return invalid(`Название дела должно содержать от 1 до ${MAX_MATTER_TITLE_LENGTH} символов.`);
  }

  if (UNSAFE_SINGLE_LINE_CONTROL_PATTERN.test(reference) || UNSAFE_SINGLE_LINE_CONTROL_PATTERN.test(title)) {
    return invalid("Номер или название дела содержит недопустимые символы.");
  }

  if (summary.length > MAX_MATTER_SUMMARY_LENGTH) {
    return invalid(`Описание дела не должно превышать ${MAX_MATTER_SUMMARY_LENGTH} символов.`);
  }

  if (UNSAFE_SUMMARY_CONTROL_PATTERN.test(summary)) {
    return invalid("Описание дела содержит недопустимые символы.");
  }

  if (responseDueAt && !isValidDate(responseDueAt)) {
    return invalid("Укажите корректный срок ответа.");
  }

  return {
    valid: true,
    value: {
      matterId: input.matterId,
      reference,
      title,
      summary,
      responseDueAt: responseDueAt || null,
    },
    error: "",
  };
}

export function getMatterDetailsErrorMessage(error) {
  const knownMessages = {
    authorization_required: "Сессия истекла. Войдите повторно.",
    organization_not_available: "У вас нет прав изменять это дело.",
    details_requires_admin: "Редактировать реквизиты может только администратор организации.",
    matter_not_found: "Дело не найдено или уже недоступно.",
    invalid_matter_details: "Проверьте номер, название, описание и срок ответа.",
    reference_conflict: "Такой номер дела уже используется в организации.",
  };

  if (knownMessages[error?.message]) {
    return knownMessages[error.message];
  }

  if (error?.code === "23505") {
    return knownMessages.reference_conflict;
  }

  if (error?.code === "42501") {
    return knownMessages.organization_not_available;
  }

  return FALLBACK_ERROR;
}
