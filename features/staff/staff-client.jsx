"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { createUuidV4 } from "../../lib/submission-id.mjs";
import { sendMatterMessage } from "../cabinet/cabinet-actions";
import { getMatterById } from "../cabinet/cabinet-data.mjs";
import { validateMatterMessage } from "../cabinet/cabinet-write-domain.mjs";
import styles from "./staff.module.css";

function MatterList({ matters, activeMatterId, onSelect }) {
  if (!matters.length) {
    return (
      <section className={styles.emptyPanel} aria-labelledby="staff-empty-title">
        <p className={styles.eyebrow}>Доступных дел нет</p>
        <h2 id="staff-empty-title">Рабочая панель готова.</h2>
        <p>Дела появятся здесь после назначения сотруднику или организации.</p>
      </section>
    );
  }

  return (
    <nav className={styles.matterList} aria-label="Доступные дела">
      {matters.map((matter) => (
        <button
          className={`${styles.matterButton}${matter.id === activeMatterId ? ` ${styles.isActive}` : ""}`}
          key={matter.id}
          type="button"
          aria-pressed={matter.id === activeMatterId}
          onClick={() => onSelect(matter.id)}
        >
          <span>{matter.reference}</span>
          <strong>{matter.title}</strong>
          <small>{matter.stateLabel}</small>
        </button>
      ))}
    </nav>
  );
}

function MatterStages({ matter }) {
  if (!matter.stages.length) {
    return <p className={styles.muted}>Этапы по делу ещё не добавлены.</p>;
  }

  return (
    <ol className={styles.stageList}>
      {matter.stages.map((stage, index) => (
        <li className={styles[`stage_${stage.status}`]} key={stage.id ?? stage.title}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <div>
            <strong>{stage.title}</strong>
            <small>{stage.detail}</small>
          </div>
        </li>
      ))}
    </ol>
  );
}

function MessageHistory({ messages }) {
  if (!messages.length) {
    return <p className={styles.muted}>Сообщений по делу пока нет.</p>;
  }

  return (
    <ol className={styles.messageList}>
      {messages.map((message) => (
        <li key={message.id}>
          <div>
            <strong>{message.sender === "Вы" ? "Вы" : "Участник дела"}</strong>
            <time>{message.date}</time>
          </div>
          <p>{message.text}</p>
        </li>
      ))}
    </ol>
  );
}

export default function StaffClient({ initialMatters = [], organizations = [], roleLabel = "" }) {
  const router = useRouter();
  const [activeMatterId, setActiveMatterId] = useState(initialMatters[0]?.id ?? null);
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState({ tone: "neutral", text: "" });
  const [isSending, setIsSending] = useState(false);
  const messageIdRef = useRef(null);
  const matter = useMemo(() => getMatterById(activeMatterId, initialMatters), [activeMatterId, initialMatters]);

  const selectMatter = (matterId) => {
    setActiveMatterId(matterId);
    setDraft("");
    messageIdRef.current = null;
    setFeedback({ tone: "neutral", text: "" });
  };

  const handleDraftChange = (value) => {
    if (messageIdRef.current && value !== draft) {
      messageIdRef.current = null;
    }
    setDraft(value);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!matter || isSending) return;

    const validation = validateMatterMessage({ matterId: matter.id, body: draft });
    if (!validation.valid) {
      setFeedback({ tone: "error", text: validation.error });
      return;
    }

    const messageId = messageIdRef.current ?? createUuidV4(window.crypto);
    if (!messageId) {
      setFeedback({ tone: "error", text: "Не удалось подготовить сообщение. Обновите страницу и попробуйте ещё раз." });
      return;
    }
    messageIdRef.current = messageId;
    setIsSending(true);
    setFeedback({ tone: "neutral", text: "Отправляем сообщение…" });

    try {
      const result = await sendMatterMessage({ ...validation.value, id: messageId });
      if (!result.ok) {
        setFeedback({ tone: "error", text: result.message });
        return;
      }

      setDraft("");
      messageIdRef.current = null;
      setFeedback({ tone: "success", text: result.message });
      router.refresh();
    } catch {
      setFeedback({ tone: "error", text: "Не удалось отправить сообщение. Попробуйте ещё раз." });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={styles.workspace}>
      <div className={styles.workspaceBar}>
        <div>
          <span>Организации</span>
          <strong>{organizations.map((organization) => organization.name).join(" · ") || "ДоговорОфф"}</strong>
        </div>
        <div>
          <span>Роль</span>
          <strong>{roleLabel}</strong>
        </div>
      </div>

      <div className={styles.grid}>
        <aside className={styles.sidebar}>
          <p className={styles.eyebrow}>Рабочий список</p>
          <MatterList matters={initialMatters} activeMatterId={activeMatterId} onSelect={selectMatter} />
        </aside>

        {matter ? (
          <section className={styles.detail} aria-labelledby="staff-matter-title">
            <div className={styles.detailIntro}>
              <p className={styles.eyebrow}>{matter.reference}</p>
              <h2 id="staff-matter-title">{matter.title}</h2>
              <p>{matter.summary}</p>
            </div>

            <div className={styles.detailSection}>
              <p className={styles.eyebrow}>Ход дела</p>
              <MatterStages matter={matter} />
            </div>

            <div className={styles.messages}>
              <div>
                <p className={styles.eyebrow}>Связь</p>
                <h3>История сообщений</h3>
              </div>
              <MessageHistory messages={matter.messages} />
              <form className={styles.composer} onSubmit={handleSubmit}>
                <label htmlFor="staff-message">Сообщение клиенту</label>
                <textarea
                  id="staff-message"
                  value={draft}
                  maxLength={2000}
                  rows={5}
                  placeholder="Кратко опишите следующий шаг или ответ"
                  disabled={isSending}
                  onChange={(event) => handleDraftChange(event.target.value)}
                />
                <button type="submit" disabled={isSending}>
                  {isSending ? "Отправка…" : "Отправить"}
                </button>
                <p className={`${styles.feedback}${feedback.tone === "error" ? ` ${styles.feedbackError}` : ""}`} role="status" aria-live="polite">
                  {feedback.text}
                </p>
              </form>
            </div>
          </section>
        ) : (
          <section className={styles.detail} aria-labelledby="staff-empty-detail-title">
            <p className={styles.eyebrow}>Ожидание назначения</p>
            <h2 id="staff-empty-detail-title">Выберите дело</h2>
            <p className={styles.muted}>Когда у аккаунта появится доступное дело, его материалы и сообщения отобразятся здесь.</p>
          </section>
        )}
      </div>
    </div>
  );
}
