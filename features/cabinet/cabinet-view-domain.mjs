const ACTIONABLE_DOCUMENT_REQUEST_STATUSES = new Set(["requested", "changes_requested"]);
const TIMELINE_STATUS_LABELS = Object.freeze({
  complete: "Завершён",
  current: "Текущий этап",
  future: "Предстоит",
});

export function getDocumentsSideAction(matter) {
  const managedRequest = matter?.clientPrimaryDocumentRequest;
  if (
    managedRequest?.requiresClientAction === true
    || ACTIONABLE_DOCUMENT_REQUEST_STATUSES.has(managedRequest?.status)
  ) {
    return "managed_request";
  }
  return matter?.nextAction ? "generic_upload" : "quiet";
}

export function getVisibleTimelineStages(matter, { condensed = false } = {}) {
  const stages = Array.isArray(matter?.stages) ? matter.stages : [];
  return condensed ? [stages[matter?.currentStage]].filter(Boolean) : stages;
}

export function getTimelineStagePresentation(stage, { isCurrent = false } = {}) {
  return {
    statusLabel: TIMELINE_STATUS_LABELS[stage?.status] || "Статус уточняется",
    detail: isCurrent && stage?.detail ? stage.detail : null,
  };
}
