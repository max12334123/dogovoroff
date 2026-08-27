export const CABINET_VIEWS = [
  { id: "overview", index: "01", label: "Обзор" },
  { id: "matters", index: "02", label: "Дела" },
  { id: "documents", index: "03", label: "Документы" },
  { id: "messages", index: "04", label: "Сообщения" },
];

export const CABINET_CASES = [
  {
    id: "supply-agreement",
    index: "01",
    title: "Договор поставки",
    reference: "Дело № 26-081",
    state: "active",
    stateLabel: "Активное дело",
    currentStage: 2,
    responseBy: "до 28 августа",
    summary:
      "Проверяем договор и приложения, чтобы определить риски и подготовить понятную позицию по следующим действиям.",
    stages: [
      { title: "Запрос получен", detail: "20 августа 2026", status: "complete" },
      { title: "Документы приняты", detail: "22 августа 2026", status: "complete" },
      { title: "Анализ документов", detail: "В работе", status: "current" },
      { title: "Правовая оценка", detail: "Ожидает начала", status: "future" },
      { title: "Ответ и рекомендации", detail: "Ожидает начала", status: "future" },
    ],
    nextAction: {
      title: "Загрузить приложение к договору",
      description: "Оно поможет проверить спецификацию, сроки и условия поставки.",
      deadline: "до 28 августа",
    },
    updates: [
      { date: "26 августа", time: "10:40", text: "Юрист приступил к анализу документов." },
      { date: "22 августа", time: "16:15", text: "Документы приняты и добавлены к делу." },
      { date: "20 августа", time: "11:30", text: "Обращение принято в работу." },
    ],
    documents: [
      { id: "doc-1", name: "Договор поставки № 12-26.pdf", status: "Получен", updated: "22.08.2026" },
      { id: "doc-2", name: "Спецификация к договору.pdf", status: "Получен", updated: "22.08.2026" },
      { id: "doc-3", name: "Переписка с контрагентом.pdf", status: "На проверке", updated: "26.08.2026" },
    ],
    messages: [
      {
        id: "message-1",
        sender: "Команда ДоговорОфф",
        date: "26 августа, 10:40",
        text: "Начали анализ документов. Если потребуются дополнительные сведения, напишем здесь.",
      },
      {
        id: "message-2",
        sender: "Вы",
        date: "22 августа, 16:15",
        text: "Направил договор и переписку с контрагентом.",
      },
    ],
  },
  {
    id: "counterparty-claim",
    index: "02",
    title: "Претензия контрагенту",
    reference: "Дело № 26-044",
    state: "archived",
    stateLabel: "Завершено",
    currentStage: 4,
    responseBy: "завершено 14 июля",
    summary: "Претензия подготовлена и передана клиенту вместе с рекомендациями по дальнейшим действиям.",
    stages: [
      { title: "Запрос получен", detail: "3 июля 2026", status: "complete" },
      { title: "Документы приняты", detail: "4 июля 2026", status: "complete" },
      { title: "Анализ документов", detail: "8 июля 2026", status: "complete" },
      { title: "Подготовка претензии", detail: "12 июля 2026", status: "complete" },
      { title: "Ответ и рекомендации", detail: "14 июля 2026", status: "complete" },
    ],
    nextAction: null,
    updates: [
      { date: "14 июля", time: "15:20", text: "Итоговые документы и рекомендации переданы клиенту." },
      { date: "12 июля", time: "12:10", text: "Подготовлена претензия контрагенту." },
      { date: "8 июля", time: "17:45", text: "Завершён анализ документов." },
    ],
    documents: [
      { id: "doc-4", name: "Претензия контрагенту.pdf", status: "Готов", updated: "14.07.2026" },
      { id: "doc-5", name: "Рекомендации по отправке.pdf", status: "Готов", updated: "14.07.2026" },
    ],
    messages: [
      {
        id: "message-3",
        sender: "Команда ДоговорОфф",
        date: "14 июля, 15:20",
        text: "Дело завершено. Итоговые документы доступны в разделе «Документы».",
      },
    ],
  },
];

export const MAX_CLIENT_FILE_SIZE = 10 * 1024 * 1024;

const ACCEPTED_EXTENSIONS = new Set(["pdf", "doc", "docx", "jpg", "jpeg", "png"]);

export function validateClientUpload(file) {
  if (!file || typeof file.name !== "string") {
    return { valid: false, error: "Выберите файл." };
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !ACCEPTED_EXTENSIONS.has(extension)) {
    return { valid: false, error: "Поддерживаются PDF, DOC, DOCX, JPG и PNG." };
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { valid: false, error: "Файл пуст или повреждён." };
  }

  if (file.size > MAX_CLIENT_FILE_SIZE) {
    return { valid: false, error: "Размер файла не должен превышать 10 МБ." };
  }

  return { valid: true, error: "" };
}

export function getMatterById(id, matters = CABINET_CASES) {
  return matters.find((matter) => matter.id === id) ?? matters[0] ?? null;
}
