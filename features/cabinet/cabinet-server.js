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

export async function loadCabinetData(supabase, userId) {
  const { data: matters, error: mattersError } = await supabase
    .from("matters")
    .select([
      "id",
      "reference",
      "title",
      "summary",
      "status",
      "response_due_at",
      "next_action_title",
      "next_action_description",
      "next_action_due_at",
      "updated_at",
    ].join(","))
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
      .select("id,matter_id,public_text,created_at")
      .in("matter_id", matterIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("documents")
      .select("id,matter_id,original_name,status,updated_at")
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
    const stages = (stagesByMatter.get(matter.id) ?? []).map((stage) => ({
      id: stage.id,
      title: stage.title,
      detail: stage.detail || (stage.status === "current" ? "В работе" : ""),
      status: stage.status,
    }));
    const currentStage = Math.max(0, stages.findIndex((stage) => stage.status === "current"));

    return {
      id: matter.id,
      index: String(index + 1).padStart(2, "0"),
      title: matter.title,
      reference: matter.reference,
      state: matter.status === "completed" || matter.status === "archived" ? "archived" : "active",
      stateLabel: MATTER_STATE_LABELS[matter.status] ?? "Дело",
      currentStage,
      responseBy: matter.response_due_at ? formatDeadline(matter.response_due_at) : "срок уточняется",
      summary: matter.summary || "Информация по делу готовится.",
      stages,
      nextAction: matter.next_action_title
        ? {
            title: matter.next_action_title,
            description: matter.next_action_description || "Подробности доступны в сообщениях по делу.",
            deadline: formatDeadline(matter.next_action_due_at),
          }
        : null,
      updates: (eventsByMatter.get(matter.id) ?? []).map((event) => {
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
      documents: (documentsByMatter.get(matter.id) ?? []).map((document) => ({
        id: document.id,
        name: document.original_name,
        status: DOCUMENT_STATUS_LABELS[document.status] ?? "Получен",
        updated: DATE_FORMATTER.format(new Date(document.updated_at)),
      })),
      messages: (messagesByMatter.get(matter.id) ?? []).map((message) => ({
        id: message.id,
        sender: message.author_id === userId ? "Вы" : "Команда ДоговорОфф",
        date: DATE_TIME_FORMATTER.format(new Date(message.created_at)),
        text: message.body,
      })),
    };
  });
}
