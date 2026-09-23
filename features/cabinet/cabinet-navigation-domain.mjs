export const CLIENT_VIEW_IDS = Object.freeze(["overview", "matters", "documents", "messages"]);
const CLIENT_VIEW_SET = new Set(CLIENT_VIEW_IDS);
export const CABINET_HISTORY_INDEX_KEY = "__dogovoroffCabinetIndex";

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

export function getCanonicalCabinetLocation(search, matters = []) {
  const location = parseCabinetLocation(search, matters);
  return { ...location, href: buildCabinetHref(location) };
}

export function buildCabinetHistoryState(state, index) {
  const currentState = state && typeof state === "object" && !Array.isArray(state) ? state : {};
  return { ...currentState, [CABINET_HISTORY_INDEX_KEY]: index };
}

export function getCabinetHistoryIndex(state) {
  const index = state?.[CABINET_HISTORY_INDEX_KEY];
  return Number.isInteger(index) ? index : null;
}

function isSameCabinetLocation(left, right) {
  return left?.view === right?.view && left?.matterId === right?.matterId;
}

export function getHistoryNavigationDecision({
  current,
  requested,
  hasDraft = false,
  currentIndex = null,
  requestedIndex = null,
} = {}) {
  if (!hasDraft || isSameCabinetLocation(current, requested)) {
    return { kind: "apply" };
  }

  const indexedHistory = Number.isInteger(currentIndex)
    && Number.isInteger(requestedIndex)
    && currentIndex !== requestedIndex;
  const pending = {
    kind: indexedHistory ? "history" : "history_replace",
    view: requested.view,
    matterId: requested.matterId,
    sourceIndex: currentIndex,
    targetIndex: requestedIndex,
  };

  return indexedHistory
    ? { kind: "restore_then_prompt", returnDelta: currentIndex - requestedIndex, pending }
    : { kind: "replace_then_prompt", pending };
}

export function resolvePendingHistoryNavigation(pending, outcome) {
  if (!pending || outcome !== "discard") {
    return { kind: "stay" };
  }

  const location = { view: pending.view, matterId: pending.matterId };
  if (
    pending.kind === "history"
    && Number.isInteger(pending.sourceIndex)
    && Number.isInteger(pending.targetIndex)
  ) {
    return {
      kind: "go",
      delta: pending.targetIndex - pending.sourceIndex,
      location,
    };
  }

  return { kind: "replace", location };
}

export function registerBeforeUnloadGuard(target) {
  const handleBeforeUnload = (event) => {
    event.preventDefault();
    event.returnValue = "";
    return "";
  };

  target.addEventListener("beforeunload", handleBeforeUnload);
  return () => target.removeEventListener("beforeunload", handleBeforeUnload);
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
