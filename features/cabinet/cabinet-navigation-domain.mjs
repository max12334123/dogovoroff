export const CLIENT_VIEW_IDS = Object.freeze(["overview", "matters", "documents", "messages"]);
const CLIENT_VIEW_SET = new Set(CLIENT_VIEW_IDS);

function firstMatterId(matters) {
  return Array.isArray(matters) ? matters.find((matter) => typeof matter?.id === "string")?.id ?? null : null;
}

export function parseCabinetLocation(search, matters = []) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search || "");
  const requestedView = params.get("view");
  const requestedMatterId = params.get("matter");
  const matterId = matters.some((matter) => matter?.id === requestedMatterId) ? requestedMatterId : firstMatterId(matters);
  return { view: CLIENT_VIEW_SET.has(requestedView) ? requestedView : "overview", matterId };
}

export function buildCabinetHref({ view = "overview", matterId = null } = {}) {
  const params = new URLSearchParams();
  if (CLIENT_VIEW_SET.has(view) && view !== "overview") params.set("view", view);
  if (typeof matterId === "string" && matterId) params.set("matter", matterId);
  const query = params.toString();
  return query ? `/cabinet?${query}` : "/cabinet";
}

export function getClientPrimaryAction(matter, { hasUnreadMessage = false } = {}) {
  const request = matter?.clientPrimaryDocumentRequest;
  if (request?.status === "changes_requested") return { kind: "document_changes", eyebrow: "Требуется от вас", title: "Исправьте комплект документов", description: request.lastReviewNote || "Юрист оставил пояснение в запросе документов.", label: "Открыть запрос", targetView: "documents" };
  if (request?.status === "requested") return { kind: "document_request", eyebrow: "Требуется от вас", title: request.title || "Загрузите запрошенные документы", description: request.instructions || "Откройте запрос и приложите файлы.", label: "Добавить документы", targetView: "documents" };
  if (matter?.nextAction) return { kind: "next_action", eyebrow: "Ваш следующий шаг", title: matter.nextAction.title, description: matter.nextAction.description, label: "Открыть дело", targetView: "matters" };
  if (matter?.state === "completed" || matter?.state === "archived") return { kind: "completed", eyebrow: "Дело завершено", title: "Итоговые материалы готовы", description: "Документы и рекомендации остаются доступны в защищённом кабинете.", label: "Открыть документы", targetView: "documents" };
  if (hasUnreadMessage) return { kind: "message", eyebrow: "Новое сообщение", title: "Юрист написал по делу", description: "Откройте защищённую переписку, чтобы прочитать сообщение.", label: "Открыть сообщения", targetView: "messages" };
  return { kind: "waiting", eyebrow: "Текущий статус", title: "Сейчас от вас ничего не требуется", description: "Юрист работает с материалами. Мы сообщим, когда потребуется ваше участие.", label: null, targetView: null };
}
