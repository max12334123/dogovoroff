const NOTIFICATION_COPY = Object.freeze({
  "matter.created": {
    title: "Открыт доступ к делу",
    description: "В личном кабинете появилось новое дело.",
    targetView: "overview",
  },
  "matter.updated": {
    title: "Информация обновлена",
    description: "В личном кабинете обновилась информация по делу.",
    targetView: "matters",
  },
  "matter.event.created": {
    title: "Новое обновление",
    description: "По делу появилась новая информация.",
    targetView: "matters",
  },
  "document.created": {
    title: "Добавлен документ",
    description: "В личном кабинете появился новый документ.",
    targetView: "documents",
  },
  "message.created": {
    title: "Новое сообщение",
    description: "В личном кабинете появилось новое сообщение.",
    targetView: "messages",
  },
});

const NOTIFICATION_DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Yekaterinburg",
});

export const NOTIFICATION_LIMIT = 20;

export function createSafeNotification({ id, matterId, type, createdAt }) {
  const copy = NOTIFICATION_COPY[type];
  const timestamp = Date.parse(createdAt);

  if (!copy || typeof id !== "string" || !id || typeof matterId !== "string" || !matterId || !Number.isFinite(timestamp)) {
    return null;
  }

  return {
    id: id.startsWith(`${type}:`) ? id : `${type}:${id}`,
    matterId,
    type,
    title: copy.title,
    description: copy.description,
    targetView: copy.targetView,
    createdAt: new Date(timestamp).toISOString(),
    dateLabel: NOTIFICATION_DATE_FORMATTER.format(new Date(timestamp)),
  };
}

export function buildNotificationFeed(matters = [], notificationsReadAt = null, limit = NOTIFICATION_LIMIT) {
  const readTimestamp = Date.parse(notificationsReadAt);
  const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, NOTIFICATION_LIMIT) : NOTIFICATION_LIMIT;

  return matters
    .flatMap((matter) => (Array.isArray(matter?.notifications) ? matter.notifications : []))
    .map((notification) => createSafeNotification(notification))
    .filter(Boolean)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, safeLimit)
    .map((notification) => ({
      ...notification,
      unread: !Number.isFinite(readTimestamp) || Date.parse(notification.createdAt) > readTimestamp,
    }));
}
