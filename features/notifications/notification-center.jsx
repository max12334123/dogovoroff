"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { markAllNotificationsRead } from "./notification-actions";
import styles from "./notification-center.module.css";

function isUnread(notification, optimisticReadAt) {
  if (!notification.unread) {
    return false;
  }

  return !optimisticReadAt || Date.parse(notification.createdAt) > optimisticReadAt;
}

export default function NotificationCenter({ notifications = [], onOpen, open, onOpenChange }) {
  const router = useRouter();
  const detailsRef = useRef(null);
  const [optimisticReadAt, setOptimisticReadAt] = useState(null);
  const [isMarking, setIsMarking] = useState(false);
  const [feedback, setFeedback] = useState("");
  const unreadCount = notifications.filter((notification) => isUnread(notification, optimisticReadAt)).length;
  const isControlled = typeof open === "boolean";

  const closeCenter = () => {
    if (isControlled) {
      onOpenChange?.(false);
      return;
    }

    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  };

  const markRead = async () => {
    if (!unreadCount || isMarking) {
      return true;
    }

    setIsMarking(true);
    setFeedback("");

    try {
      const result = await markAllNotificationsRead();
      if (!result.ok) {
        setFeedback(result.message);
        return false;
      }

      setOptimisticReadAt(Date.parse(result.readAt));
      router.refresh();
      return true;
    } catch {
      setFeedback("Не удалось обновить уведомления. Попробуйте ещё раз.");
      return false;
    } finally {
      setIsMarking(false);
    }
  };

  const openNotification = (notification) => {
    closeCenter();
    onOpen?.(notification);
    if (isUnread(notification, optimisticReadAt)) {
      void markRead();
    }
  };

  return (
    <details
      className={styles.center}
      ref={detailsRef}
      {...(isControlled ? { open } : {})}
      onToggle={(event) => onOpenChange?.(event.currentTarget.open)}
    >
      <summary aria-label={`Уведомления${unreadCount ? `, непрочитанных: ${unreadCount}` : ""}`}>
        <span>Уведомления</span>
        {unreadCount ? <strong aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</strong> : null}
      </summary>
      <div className={styles.panel}>
        <div className={styles.heading}>
          <div>
            <span>Личный кабинет</span>
            <h2>Уведомления</h2>
          </div>
          {unreadCount ? (
            <button type="button" disabled={isMarking} onClick={() => void markRead()}>
              {isMarking ? "Сохраняем…" : "Прочитать все"}
            </button>
          ) : null}
        </div>

        {notifications.length ? (
          <ol className={styles.list}>
            {notifications.map((notification) => {
              const unread = isUnread(notification, optimisticReadAt);
              return (
                <li className={unread ? styles.unread : ""} key={notification.id}>
                  <button type="button" onClick={() => openNotification(notification)}>
                    <span className={styles.marker} aria-hidden="true" />
                    <span className={styles.copy}>
                      <strong>{notification.title}</strong>
                      <small>{notification.description}</small>
                    </span>
                    <time dateTime={notification.createdAt}>{notification.dateLabel}</time>
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className={styles.empty}>Здесь появятся сообщения о новых действиях в кабинете.</p>
        )}

        <p className={styles.privacy}>Без названий дел, имён файлов и текста сообщений.</p>
        <p className={styles.feedback} role="status" aria-live="polite">{feedback}</p>
      </div>
    </details>
  );
}
