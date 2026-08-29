const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const OPEN_STATUSES = new Set(["new", "reviewing", "contacted"]);
const COMPLETED_STATUSES = new Set(["matter_created", "closed"]);
const MUTABLE_STATUSES = new Set(["new", "reviewing", "contacted", "closed"]);

export const INTAKE_FILTERS = Object.freeze([
  { id: "open", label: "В работе" },
  { id: "new", label: "Новые" },
  { id: "reviewing", label: "Разбираем" },
  { id: "contacted", label: "Связались" },
  { id: "completed", label: "Завершённые" },
  { id: "all", label: "Все" },
]);

const STATUS_LABELS = Object.freeze({
  new: "Новая",
  reviewing: "Разбираем",
  contacted: "Связались",
  matter_created: "Дело создано",
  closed: "Закрыта без дела",
});

function cleanText(value, limit) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function invalid(error) {
  return { valid: false, error };
}

export function getIntakeStatusLabel(status) {
  return STATUS_LABELS[status] ?? "Неизвестный статус";
}

export function mapIntakeRequestRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .filter((row) => row && typeof row.id === "string" && typeof row.organization_id === "string")
    .map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      submissionId: row.submission_id,
      status: row.status,
      name: row.name,
      phone: row.phone,
      service: row.service,
      message: row.message,
      formMode: row.form_mode,
      precheckMode: row.precheck_mode,
      precheckPractice: row.precheck_practice,
      precheckExcerpt: row.precheck_excerpt,
      submittedAt: row.submitted_at,
      updatedAt: row.updated_at,
      matterId: row.matter_id ?? null,
    }));
}

export function filterStaffIntakeRequests(requests, query = "", filter = "open") {
  if (!Array.isArray(requests)) {
    return [];
  }

  const normalizedQuery = typeof query === "string" ? query.trim().toLocaleLowerCase("ru-RU") : "";
  return requests.filter((request) => {
    const matchesFilter = filter === "all"
      || (filter === "open" && OPEN_STATUSES.has(request?.status))
      || (filter === "completed" && COMPLETED_STATUSES.has(request?.status))
      || request?.status === filter;
    if (!matchesFilter) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return [request?.name, request?.phone, request?.service, request?.message, request?.submissionId]
      .filter((value) => typeof value === "string")
      .some((value) => value.toLocaleLowerCase("ru-RU").includes(normalizedQuery));
  });
}

export function validateIntakeStatusUpdate(input) {
  if (!input || typeof input !== "object") {
    return invalid("Выберите заявку и новый статус.");
  }

  const requestId = cleanText(input.requestId, 100).toLowerCase();
  const status = cleanText(input.status, 40);
  if (!UUID_PATTERN.test(requestId)) {
    return invalid("Заявка недоступна. Обновите страницу.");
  }
  if (!MUTABLE_STATUSES.has(status)) {
    return invalid("Выберите доступный статус заявки.");
  }

  return { valid: true, value: { requestId, status } };
}

export function validateIntakeMatterAssignment(input) {
  const requestId = cleanText(input?.intakeRequestId, 100).toLowerCase();
  if (!UUID_PATTERN.test(requestId)) {
    return invalid("Заявка недоступна. Обновите страницу.");
  }
  return { valid: true, value: { intakeRequestId: requestId } };
}

export function getIntakeAssignmentDefaults(request) {
  const service = cleanText(request?.service, 120) || "Юридическая консультация";
  return {
    organizationId: cleanText(request?.organizationId, 100),
    title: `Обращение: ${service}`.slice(0, 240),
    summary: cleanText(request?.message, 5000),
    stageTitle: "Первичная проверка",
    stageDetail: "",
    nextActionTitle: "",
    nextActionDescription: "",
  };
}

export function getIntakeErrorMessage(error) {
  const knownMessages = {
    intake_request_not_found: "Заявка не найдена или уже недоступна.",
    intake_already_converted: "По этой заявке дело уже создано.",
    intake_request_closed: "Сначала верните заявку в работу.",
    intake_status_invalid: "Этот статус нельзя установить.",
    organization_not_available: "Организация недоступна для управления.",
  };

  return knownMessages[error?.message] ?? "Не удалось обновить заявку. Попробуйте ещё раз.";
}
