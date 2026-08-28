const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FALLBACK_ERROR = "Не удалось создать дело. Попробуйте ещё раз.";

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function invalid(error) {
  return { valid: false, error };
}

export function validateMatterAssignment(input) {
  if (!input || typeof input !== "object") {
    return invalid("Заполните данные нового дела.");
  }

  const organizationId = cleanText(input.organizationId);
  const clientEmail = cleanText(input.clientEmail).toLowerCase();
  const reference = cleanText(input.reference);
  const title = cleanText(input.title);
  const summary = cleanText(input.summary);
  const lawyerId = cleanText(input.lawyerId) || null;
  const stageTitle = cleanText(input.stageTitle);
  const stageDetail = cleanText(input.stageDetail);
  const nextActionTitle = cleanText(input.nextActionTitle) || null;
  const nextActionDescription = cleanText(input.nextActionDescription) || null;

  if (!UUID_PATTERN.test(organizationId)) {
    return invalid("Выберите организацию.");
  }

  if (clientEmail.length > 254 || !EMAIL_PATTERN.test(clientEmail)) {
    return invalid("Укажите корректный email клиента.");
  }

  if (reference.length < 1 || reference.length > 80) {
    return invalid("Номер дела должен содержать от 1 до 80 символов.");
  }

  if (title.length < 1 || title.length > 240) {
    return invalid("Название дела должно содержать от 1 до 240 символов.");
  }

  if (summary.length > 5000) {
    return invalid("Описание дела не должно превышать 5000 символов.");
  }

  if (lawyerId && !UUID_PATTERN.test(lawyerId)) {
    return invalid("Выберите ответственного сотрудника повторно.");
  }

  if (stageTitle.length < 1 || stageTitle.length > 200) {
    return invalid("Название первого этапа должно содержать от 1 до 200 символов.");
  }

  if (stageDetail.length > 1000) {
    return invalid("Описание этапа не должно превышать 1000 символов.");
  }

  if (nextActionTitle && nextActionTitle.length > 240) {
    return invalid("Следующий шаг не должен превышать 240 символов.");
  }

  if (nextActionDescription && nextActionDescription.length > 2000) {
    return invalid("Описание следующего шага не должно превышать 2000 символов.");
  }

  if (!nextActionTitle && nextActionDescription) {
    return invalid("Добавьте название следующего шага или удалите его описание.");
  }

  return {
    valid: true,
    value: {
      organizationId,
      clientEmail,
      reference,
      title,
      summary,
      lawyerId,
      stageTitle,
      stageDetail,
      nextActionTitle,
      nextActionDescription,
    },
  };
}

export function getAssignmentErrorMessage(error) {
  if (error?.code === "23505") {
    return "Дело с таким номером уже существует.";
  }

  const knownMessages = {
    client_not_found: "Клиент с таким подтверждённым email не найден.",
    lawyer_not_available: "Выбранный сотрудник недоступен для этой организации.",
    client_conflicts_with_lawyer: "Клиента и ответственного сотрудника нельзя назначить одним аккаунтом.",
    organization_not_available: "Организация недоступна для управления.",
  };

  return knownMessages[error?.message] ?? FALLBACK_ERROR;
}
