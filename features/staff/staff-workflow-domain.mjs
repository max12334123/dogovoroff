import { isUuid } from "../cabinet/cabinet-write-domain.mjs";

const MATTER_STATUSES = new Set(["active", "paused", "completed", "archived"]);
const MAX_NEXT_ACTION_TITLE_LENGTH = 240;
const MAX_NEXT_ACTION_DESCRIPTION_LENGTH = 2000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function invalid(error) {
  return { valid: false, error };
}

function cleanText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function validateMatterWorkflow(input) {
  if (!input || typeof input !== "object" || !isUuid(input.matterId)) {
    return invalid("Некорректное дело.");
  }

  const status = cleanText(input.status).toLowerCase();
  if (!MATTER_STATUSES.has(status)) {
    return invalid("Выберите корректный статус дела.");
  }

  const stageId = input.stageId === undefined || input.stageId === null || input.stageId === ""
    ? null
    : input.stageId;
  if (stageId !== null && !isUuid(stageId)) {
    return invalid("Некорректный этап дела.");
  }

  const nextActionTitle = cleanText(input.nextActionTitle) || null;
  const nextActionDescription = cleanText(input.nextActionDescription) || null;
  if (nextActionTitle && nextActionTitle.length > MAX_NEXT_ACTION_TITLE_LENGTH) {
    return invalid(`Следующий шаг не должен превышать ${MAX_NEXT_ACTION_TITLE_LENGTH} символов.`);
  }
  if (nextActionDescription && nextActionDescription.length > MAX_NEXT_ACTION_DESCRIPTION_LENGTH) {
    return invalid(`Описание следующего шага не должно превышать ${MAX_NEXT_ACTION_DESCRIPTION_LENGTH} символов.`);
  }
  if (!nextActionTitle && nextActionDescription) {
    return invalid("Добавьте название следующего шага или очистите его описание.");
  }

  const nextActionDueAt = cleanText(input.nextActionDueAt);
  if (nextActionDueAt && !DATE_PATTERN.test(nextActionDueAt)) {
    return invalid("Укажите срок в формате даты.");
  }

  const assignmentTouched = input.assignmentTouched === true;
  const assignedLawyerId = input.assignedLawyerId === undefined
    || input.assignedLawyerId === null
    || input.assignedLawyerId === ""
    ? null
    : input.assignedLawyerId;
  if (assignmentTouched && assignedLawyerId !== null && !isUuid(assignedLawyerId)) {
    return invalid("Некорректный ответственный сотрудник.");
  }

  return {
    valid: true,
    value: {
      matterId: input.matterId,
      status,
      stageId,
      nextActionTitle: status === "completed" || status === "archived" ? null : nextActionTitle,
      nextActionDescription: status === "completed" || status === "archived" ? null : nextActionDescription,
      nextActionDueAt: status === "completed" || status === "archived" || !nextActionTitle ? null : (nextActionDueAt || null),
      assignmentTouched,
      assignedLawyerId: assignmentTouched ? assignedLawyerId : null,
    },
    error: "",
  };
}

export function getWorkflowErrorMessage(error) {
  const knownMessages = {
    authorization_required: "Сессия истекла. Войдите повторно.",
    organization_not_available: "У вас нет прав изменять это дело.",
    matter_not_found: "Дело не найдено или уже недоступно.",
    stage_not_available: "Выбранный этап не относится к этому делу.",
    stage_required_for_active: "Для активного дела нужен хотя бы один этап.",
    lawyer_not_available: "Выбранный сотрудник больше не доступен для назначения.",
    client_conflicts_with_lawyer: "Клиента нельзя назначить ответственным сотрудником.",
    assignment_requires_admin: "Назначать ответственного может только администратор организации.",
    invalid_workflow_input: "Проверьте статус, этап и следующий шаг.",
  };

  if (knownMessages[error?.message]) {
    return knownMessages[error.message];
  }

  if (error?.code === "42501") {
    return knownMessages.organization_not_available;
  }

  return "Не удалось обновить дело. Попробуйте ещё раз.";
}
