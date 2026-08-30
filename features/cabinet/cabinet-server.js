import { createSafeNotification } from "../notifications/notification-domain.mjs";

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Yekaterinburg",
});

const DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Yekaterinburg",
});

const DEADLINE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  timeZone: "Asia/Yekaterinburg",
});

const MATTER_STATE_LABELS = {
  active: "Активное дело",
  paused: "Приостановлено",
  completed: "Завершено",
  archived: "В архиве",
};

const DOCUMENT_STATUS_LABELS = {
  received: "Получен",
  reviewing: "На проверке",
  ready: "Готов",
  archived: "В архиве",
};

function groupByMatter(rows) {
  return rows.reduce((groups, row) => {
    const group = groups.get(row.matter_id) ?? [];
    group.push(row);
    groups.set(row.matter_id, group);
    return groups;
  }, new Map());
}

function formatDeadline(value, prefix = "до") {
  return value ? `${prefix} ${DEADLINE_FORMATTER.format(new Date(value))}` : "";
}

export async function loadCabinetData(supabase, userId, options = {}) {
  const messageParticipantLabel = options.messageParticipantLabel ?? "Команда ДоговорОфф";
  const matterFields = [
    "id",
    ...(options.includeOrganizationId ? ["organization_id"] : []),
    "reference",
    "title",
    "summary",
    "status",
    "response_due_at",
    "next_action_title",
    "next_action_description",
    "next_action_due_at",
    "created_by",
    "created_at",
    "updated_at",
  ];
  const { data: matters, error: mattersError } = await supabase
    .from("matters")
    .select(matterFields.join(","))
    .order("updated_at", { ascending: false });

  if (mattersError) {
    throw new Error(`Cabinet matters query failed: ${mattersError.code ?? "unknown"}`);
  }

  if (!matters?.length) {
    return [];
  }

  const matterIds = matters.map((matter) => matter.id);
  const [stagesResult, eventsResult, documentsResult, messagesResult] = await Promise.all([
    supabase
      .from("matter_stages")
      .select("id,matter_id,position,title,detail,status,completed_at")
      .in("matter_id", matterIds)
      .order("position", { ascending: true }),
    supabase
      .from("matter_events")
      .select("id,matter_id,event_type,public_text,actor_id,created_at")
      .in("matter_id", matterIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("documents")
      .select("id,matter_id,storage_path,original_name,mime_type,size_bytes,status,uploaded_by,created_at,updated_at")
      .in("matter_id", matterIds)
      .order("updated_at", { ascending: false }),
    supabase
      .from("messages")
      .select("id,matter_id,author_id,body,created_at")
      .in("matter_id", matterIds)
      .order("created_at", { ascending: false }),
  ]);

  const failedResult = [stagesResult, eventsResult, documentsResult, messagesResult].find((result) => result.error);
  if (failedResult?.error) {
    throw new Error(`Cabinet detail query failed: ${failedResult.error.code ?? "unknown"}`);
  }

  const stagesByMatter = groupByMatter(stagesResult.data ?? []);
  const eventsByMatter = groupByMatter(eventsResult.data ?? []);
  const documentsByMatter = groupByMatter(documentsResult.data ?? []);
  const messagesByMatter = groupByMatter(messagesResult.data ?? []);

  return matters.map((matter, index) => {
    const matterEvents = eventsByMatter.get(matter.id) ?? [];
    const matterDocuments = documentsByMatter.get(matter.id) ?? [];
    const matterMessages = messagesByMatter.get(matter.id) ?? [];
    const stages = (stagesByMatter.get(matter.id) ?? []).map((stage) => ({
      id: stage.id,
      title: stage.title,
      detail: stage.detail || (stage.status === "current" ? "В работе" : ""),
      status: stage.status,
    }));
    const currentStageIndex = stages.findIndex((stage) => stage.status === "current");
    const notifications = [
      matter.created_by !== userId
        ? createSafeNotification({
            id: matter.id,
            matterId: matter.id,
            type: "matter.created",
            createdAt: matter.created_at,
          })
        : null,
      matter.updated_at !== matter.created_at
        ? createSafeNotification({
            id: `${matter.id}:${matter.updated_at}`,
            matterId: matter.id,
            type: "matter.updated",
            createdAt: matter.updated_at,
          })
        : null,
      ...matterEvents.map((event) => (event.actor_id !== userId
        ? createSafeNotification({
            id: event.id,
            matterId: matter.id,
            type: "matter.event.created",
            createdAt: event.created_at,
          })
        : null)),
      ...matterDocuments.map((document) => (document.uploaded_by !== userId
        ? createSafeNotification({
            id: document.id,
            matterId: matter.id,
            type: "document.created",
            createdAt: document.created_at,
          })
        : null)),
      ...matterMessages.map((message) => (message.author_id !== userId
        ? createSafeNotification({
            id: message.id,
            matterId: matter.id,
            type: "message.created",
            createdAt: message.created_at,
          })
        : null)),
    ].filter(Boolean);

    return {
      id: matter.id,
      ...(options.includeOrganizationId
        ? {
            organizationId: matter.organization_id,
            responseDueAt: matter.response_due_at || null,
            detailsSummary: matter.summary || "",
          }
        : {}),
      index: String(index + 1).padStart(2, "0"),
      title: matter.title,
      reference: matter.reference,
      state: matter.status,
      stateLabel: MATTER_STATE_LABELS[matter.status] ?? "Дело",
      updated: DATE_TIME_FORMATTER.format(new Date(matter.updated_at)),
      currentStage: currentStageIndex >= 0 ? currentStageIndex : null,
      responseBy: matter.response_due_at ? formatDeadline(matter.response_due_at) : "срок уточняется",
      summary: matter.summary || "Информация по делу готовится.",
      stages,
      notifications,
      nextAction: matter.next_action_title
        ? {
            title: matter.next_action_title,
            description: matter.next_action_description || "Подробности доступны в сообщениях по делу.",
            deadline: formatDeadline(matter.next_action_due_at),
            dueAt: matter.next_action_due_at || null,
          }
        : null,
      updates: matterEvents.map((event) => {
        const formatted = DATE_TIME_FORMATTER.formatToParts(new Date(event.created_at));
        const day = formatted.find((part) => part.type === "day")?.value;
        const month = formatted.find((part) => part.type === "month")?.value;
        const hour = formatted.find((part) => part.type === "hour")?.value;
        const minute = formatted.find((part) => part.type === "minute")?.value;
        return {
          id: event.id,
          date: `${day} ${month}`,
          time: `${hour}:${minute}`,
          text: event.public_text,
        };
      }),
      documents: matterDocuments.map((document) => ({
        id: document.id,
        name: document.original_name,
        storagePath: document.storage_path,
        mimeType: document.mime_type,
        sizeBytes: document.size_bytes,
        status: DOCUMENT_STATUS_LABELS[document.status] ?? "Получен",
        updatedAt: document.updated_at,
        updated: DATE_FORMATTER.format(new Date(document.updated_at)),
      })),
      messages: matterMessages.map((message) => ({
        id: message.id,
        sender: message.author_id === userId ? "Вы" : messageParticipantLabel,
        date: DATE_TIME_FORMATTER.format(new Date(message.created_at)),
        text: message.body,
      })),
    };
  });
}
