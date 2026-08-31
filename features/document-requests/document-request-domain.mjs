import { isUuid } from "../cabinet/cabinet-write-domain.mjs";

export const DOCUMENT_REQUEST_STATUS = Object.freeze({
  REQUESTED: "requested",
  SUBMITTED: "submitted",
  CHANGES_REQUESTED: "changes_requested",
  ACCEPTED: "accepted",
  CANCELLED: "cancelled",
});

export const MAX_DOCUMENT_REQUEST_FILES = 20;
export const MAX_DOCUMENT_REQUEST_TITLE_LENGTH = 240;
export const MAX_DOCUMENT_REQUEST_TEXT_LENGTH = 2000;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const STATUS_LABELS = Object.freeze({
  requested: "Ожидаем документы",
  submitted: "Получено, на проверке",
  changes_requested: "Нужно исправить",
  accepted: "Принято",
  cancelled: "Отменено",
});

export function canTransitionDocumentRequest({
  from,
  to,
  activeFileCount = 0,
  reviewNote = "",
} = {}) {
  if (to === DOCUMENT_REQUEST_STATUS.CANCELLED) {
    return [
      DOCUMENT_REQUEST_STATUS.REQUESTED,
      DOCUMENT_REQUEST_STATUS.SUBMITTED,
      DOCUMENT_REQUEST_STATUS.CHANGES_REQUESTED,
    ].includes(from);
  }

  if (to === DOCUMENT_REQUEST_STATUS.SUBMITTED) {
    return [DOCUMENT_REQUEST_STATUS.REQUESTED, DOCUMENT_REQUEST_STATUS.CHANGES_REQUESTED].includes(from)
      && Number.isInteger(activeFileCount)
      && activeFileCount >= 1
      && activeFileCount <= MAX_DOCUMENT_REQUEST_FILES;
  }

  if (from === DOCUMENT_REQUEST_STATUS.SUBMITTED && to === DOCUMENT_REQUEST_STATUS.ACCEPTED) {
    return true;
  }

  if (from === DOCUMENT_REQUEST_STATUS.SUBMITTED && to === DOCUMENT_REQUEST_STATUS.CHANGES_REQUESTED) {
    return typeof reviewNote === "string"
      && reviewNote.trim().length > 0
      && reviewNote.trim().length <= MAX_DOCUMENT_REQUEST_TEXT_LENGTH;
  }

  return false;
}

function invalid(error) {
  return { valid: false, error };
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanDate(value) {
  const dueOn = cleanText(value);
  if (!dueOn) return null;
  if (!DATE_PATTERN.test(dueOn)) return false;

  const [year, month, day] = dueOn.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    return false;
  }

  return dueOn;
}

function validateDraft(input, requireRequestId) {
  if (!input || typeof input !== "object" || !isUuid(input.matterId)) {
    return invalid("Некорректное дело.");
  }
  if (requireRequestId && !isUuid(input.requestId)) {
    return invalid("Некорректный запрос документов.");
  }

  const title = cleanText(input.title);
  const instructions = cleanText(input.instructions) || null;
  const dueOn = cleanDate(input.dueOn);
  if (!title || title.length > MAX_DOCUMENT_REQUEST_TITLE_LENGTH) {
    return invalid("Название запроса должно содержать от 1 до 240 символов.");
  }
  if (instructions && instructions.length > MAX_DOCUMENT_REQUEST_TEXT_LENGTH) {
    return invalid("Инструкция не должна превышать 2000 символов.");
  }
  if (dueOn === false) {
    return invalid("Укажите корректную дату.");
  }

  return {
    valid: true,
    value: {
      ...(requireRequestId ? { requestId: input.requestId } : {}),
      matterId: input.matterId,
      title,
      instructions,
      dueOn,
    },
    error: "",
  };
}

export function validateCreateDocumentRequest(input) {
  return validateDraft(input, false);
}

export function validateUpdateDocumentRequest(input) {
  return validateDraft(input, true);
}

function validateRequestId(input) {
  return input && typeof input === "object" && isUuid(input.requestId)
    ? { valid: true, value: { requestId: input.requestId }, error: "" }
    : invalid("Некорректный запрос документов.");
}

export const validateSubmitDocumentRequest = validateRequestId;
export const validateCancelDocumentRequest = validateRequestId;

export function validateReviewDocumentRequest(input) {
  const request = validateRequestId(input);
  if (!request.valid) return request;

  const decision = cleanText(input.decision);
  if (![DOCUMENT_REQUEST_STATUS.ACCEPTED, DOCUMENT_REQUEST_STATUS.CHANGES_REQUESTED].includes(decision)) {
    return invalid("Выберите корректное решение.");
  }

  const note = decision === DOCUMENT_REQUEST_STATUS.CHANGES_REQUESTED ? cleanText(input.note) : null;
  if (
    decision === DOCUMENT_REQUEST_STATUS.CHANGES_REQUESTED
    && (!note || note.length > MAX_DOCUMENT_REQUEST_TEXT_LENGTH)
  ) {
    return invalid("Укажите пояснение до 2000 символов.");
  }

  return { valid: true, value: { requestId: input.requestId, decision, note }, error: "" };
}

export function validateWithdrawDocumentRequestFile(input) {
  if (!input || !isUuid(input.requestId) || !isUuid(input.documentId)) {
    return invalid("Некорректный файл запроса.");
  }

  return {
    valid: true,
    value: { requestId: input.requestId, documentId: input.documentId },
    error: "",
  };
}

export function mapDocumentRequest(row, documents = []) {
  const requestDocuments = documents.filter((document) => document.requestId === row.id);
  const activeDocuments = requestDocuments.filter((document) => document.statusValue !== "archived");
  return {
    id: row.id,
    matterId: row.matter_id,
    title: row.title,
    instructions: row.instructions || "",
    dueOn: row.due_on || null,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] || "Запрос документов",
    lastReviewNote: row.last_review_note || "",
    submittedAt: row.submitted_at || null,
    reviewedAt: row.reviewed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    documents: requestDocuments,
    activeDocumentCount: activeDocuments.length,
    requiresClientAction: row.status === DOCUMENT_REQUEST_STATUS.REQUESTED
      || row.status === DOCUMENT_REQUEST_STATUS.CHANGES_REQUESTED,
    awaitingStaff: row.status === DOCUMENT_REQUEST_STATUS.SUBMITTED,
    terminal: row.status === DOCUMENT_REQUEST_STATUS.ACCEPTED
      || row.status === DOCUMENT_REQUEST_STATUS.CANCELLED,
  };
}

export function getClientPrimaryDocumentRequest(requests = []) {
  const priority = { changes_requested: 0, requested: 1 };
  return [...requests]
    .filter((request) => request.requiresClientAction)
    .sort((left, right) => {
      const statusDelta = priority[left.status] - priority[right.status];
      if (statusDelta) return statusDelta;

      const leftDue = left.dueOn || "9999-12-31";
      const rightDue = right.dueOn || "9999-12-31";
      return leftDue.localeCompare(rightDue)
        || String(left.createdAt).localeCompare(String(right.createdAt));
    })[0] || null;
}

export function getDocumentRequestErrorMessage(error) {
  if (error?.code === "42501") {
    return "У вас нет прав выполнить это действие.";
  }

  const messages = {
    request_state_changed: "Запрос уже изменился. Обновите страницу и попробуйте ещё раз.",
    request_file_limit: "К одному запросу можно прикрепить не более 20 файлов.",
    request_file_required: "Добавьте хотя бы один документ.",
    request_review_note_required: "Укажите, что клиенту необходимо исправить.",
    request_not_found: "Запрос документов не найден.",
    request_file_not_found: "Документ запроса не найден.",
    document_registration_conflict: "Файл уже зарегистрирован с другими данными. Обновите страницу и попробуйте ещё раз.",
  };
  return messages[error?.message] || "Не удалось обновить запрос документов. Попробуйте ещё раз.";
}
