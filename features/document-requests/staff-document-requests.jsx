"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  cancelDocumentRequest,
  createDocumentRequest,
  reviewDocumentRequest,
  updateDocumentRequest,
} from "./document-request-actions";
import styles from "./document-requests.module.css";

const DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const EMPTY_DRAFT = { title: "", instructions: "", dueOn: "" };

function getErrorMessage(result, fallback) {
  return result?.message || fallback;
}

function isActiveFile(document) {
  return document.statusValue !== "archived";
}

function getRequestDraft(request) {
  return {
    title: request.title,
    instructions: request.instructions || "",
    dueOn: request.dueOn || "",
  };
}

export default function StaffDocumentRequests({
  matter,
  downloadingId = null,
  downloadFeedback = { tone: "neutral", text: "" },
  onDownload,
}) {
  const router = useRouter();
  const statusRef = useRef(null);
  const cardRefs = useRef(new Map());
  const [createDraft, setCreateDraft] = useState(EMPTY_DRAFT);
  const [editDrafts, setEditDrafts] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [reviewNotes, setReviewNotes] = useState({});
  const [acceptingId, setAcceptingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [pendingRequests, setPendingRequests] = useState({});
  const [feedback, setFeedback] = useState({ tone: "neutral", text: "" });

  const requests = matter?.documentRequests ?? [];
  const visibleFeedback = feedback.text ? feedback : downloadFeedback;

  const focusStatus = () => {
    statusRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (downloadFeedback.tone === "error" && downloadFeedback.text) {
      window.requestAnimationFrame(focusStatus);
    }
  }, [downloadFeedback]);

  const setPending = (requestId, pending) => {
    setPendingRequests((current) => ({ ...current, [requestId]: pending }));
  };

  const completeMutation = (requestId, message) => {
    setFeedback({ tone: "success", text: message });
    router.refresh();
    window.requestAnimationFrame(() => {
      cardRefs.current.get(requestId)?.focus({ preventScroll: true });
    });
  };

  const failMutation = (message) => {
    setFeedback({ tone: "error", text: message });
    window.requestAnimationFrame(focusStatus);
  };

  const runMutation = async ({ requestId, message, action, fallback }) => {
    setPending(requestId, true);
    setFeedback({ tone: "neutral", text: message });
    try {
      const result = await action();
      if (!result?.ok) {
        failMutation(getErrorMessage(result, fallback));
        return null;
      }

      return result;
    } catch {
      failMutation(fallback);
      return null;
    } finally {
      setPending(requestId, false);
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    const result = await runMutation({
      requestId: "create",
      message: "Создаём запрос документов…",
      action: () => createDocumentRequest({ matterId: matter.id, ...createDraft }),
      fallback: "Не удалось создать запрос документов. Попробуйте ещё раз.",
    });
    if (result) {
      setCreateDraft(EMPTY_DRAFT);
      completeMutation(result.data?.requestId, result.message);
    }
  };

  const handleUpdate = async (event, request) => {
    event.preventDefault();
    const result = await runMutation({
      requestId: request.id,
      message: "Сохраняем запрос документов…",
      action: () => updateDocumentRequest({
        matterId: matter.id,
        requestId: request.id,
        ...editDrafts[request.id],
      }),
      fallback: "Не удалось обновить запрос документов. Попробуйте ещё раз.",
    });
    if (result) {
      setEditingId(null);
      completeMutation(request.id, result.message);
    }
  };

  const handleReview = async (request, decision) => {
    const note = decision === "changes_requested" ? reviewNotes[request.id] || "" : null;
    const result = await runMutation({
      requestId: request.id,
      message: decision === "accepted" ? "Принимаем комплект…" : "Возвращаем комплект на исправление…",
      action: () => reviewDocumentRequest({ requestId: request.id, decision, note }),
      fallback: "Не удалось обновить запрос документов. Попробуйте ещё раз.",
    });
    if (result) {
      setAcceptingId(null);
      completeMutation(request.id, result.message);
    }
  };

  const handleCancel = async (request) => {
    const result = await runMutation({
      requestId: request.id,
      message: "Отменяем запрос документов…",
      action: () => cancelDocumentRequest({ requestId: request.id }),
      fallback: "Не удалось отменить запрос документов. Попробуйте ещё раз.",
    });
    if (result) {
      setCancellingId(null);
      completeMutation(request.id, result.message);
    }
  };

  const openEdit = (request) => {
    setEditDrafts((current) => ({ ...current, [request.id]: getRequestDraft(request) }));
    setEditingId(request.id);
  };

  const updateDraft = (requestId, field, value) => {
    setEditDrafts((current) => ({
      ...current,
      [requestId]: { ...current[requestId], [field]: value },
    }));
  };

  const renderDraftFields = (draft, onChange, pending, prefix, includeTitleRequired = false) => (
    <>
      <label htmlFor={`${prefix}-title`}>
        <span>Название запроса</span>
        <input
          id={`${prefix}-title`}
          required={includeTitleRequired}
          maxLength={240}
          value={draft.title}
          disabled={pending}
          onChange={(event) => onChange("title", event.target.value)}
        />
      </label>
      <label htmlFor={`${prefix}-instructions`}>
        <span>Инструкции для клиента</span>
        <textarea
          id={`${prefix}-instructions`}
          maxLength={2000}
          rows={3}
          value={draft.instructions}
          disabled={pending}
          onChange={(event) => onChange("instructions", event.target.value)}
        />
      </label>
      <label htmlFor={`${prefix}-due-on`}>
        <span>Срок ответа</span>
        <input
          id={`${prefix}-due-on`}
          type="date"
          value={draft.dueOn}
          disabled={pending}
          onChange={(event) => onChange("dueOn", event.target.value)}
        />
      </label>
    </>
  );

  return (
    <section className={styles.list} aria-labelledby="staff-document-requests-title">
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <p className={styles.status}>Документы от клиента</p>
            <h2 id="staff-document-requests-title">Запросить документы</h2>
          </div>
        </div>
        <form className={styles.actions} onSubmit={handleCreate}>
          {renderDraftFields(
            createDraft,
            (field, value) => setCreateDraft((current) => ({ ...current, [field]: value })),
            Boolean(pendingRequests.create),
            "new-document-request",
            true,
          )}
          <button className={styles.primaryButton} type="submit" disabled={pendingRequests.create}>
            {pendingRequests.create ? "Создаём…" : "Запросить документы"}
          </button>
        </form>
      </div>

      <p
        ref={statusRef}
        className={`${styles.feedback}${visibleFeedback.tone === "error" ? ` ${styles.feedbackError}` : ""}`}
        role="status"
        aria-live="polite"
        tabIndex={-1}
      >
        {visibleFeedback.text}
      </p>

      {requests.map((request) => {
        const documents = request.documents ?? [];
        const activeDocuments = documents.filter(isActiveFile);
        const activeDocumentCount = request.activeDocumentCount ?? activeDocuments.length;
        const canEdit = request.status === "requested" && activeDocumentCount === 0;
        const canCancel = ["requested", "submitted", "changes_requested"].includes(request.status);
        const busy = Boolean(pendingRequests[request.id]);
        const editing = editingId === request.id;
        const changesNote = reviewNotes[request.id] || "";

        return (
          <article
            className={styles.card}
            key={request.id}
            ref={(node) => {
              if (node) cardRefs.current.set(request.id, node);
              else cardRefs.current.delete(request.id);
            }}
            tabIndex={-1}
          >
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.status}>{request.statusLabel || "Запрос документов"}</p>
                <h2>{request.title}</h2>
              </div>
              {request.dueOn ? <time dateTime={request.dueOn}>{DATE_FORMATTER.format(new Date(`${request.dueOn}T12:00:00`))}</time> : null}
            </div>
            {request.instructions ? <p className={styles.instructions}>{request.instructions}</p> : null}
            <p className={styles.fileCount}>Активных файлов: {activeDocumentCount}</p>

            {activeDocuments.length ? (
              <ul className={styles.fileList} aria-label={`Файлы для запроса «${request.title}»`}>
                {activeDocuments.map((document) => (
                  <li key={document.id}>
                    <button
                      className={styles.fileButton}
                      type="button"
                      disabled={downloadingId === document.id}
                      onClick={() => {
                        setFeedback({ tone: "neutral", text: "" });
                        onDownload?.(document);
                      }}
                    >
                      <span>{document.name}</span>
                      <small>{downloadingId === document.id ? "Загрузка…" : "Скачать"}</small>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {canEdit && !editing ? (
              <div className={styles.actions}>
                <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => openEdit(request)}>Изменить запрос</button>
              </div>
            ) : null}

            {canEdit && editing ? (
              <form className={styles.actions} onSubmit={(event) => handleUpdate(event, request)}>
                {renderDraftFields(
                  editDrafts[request.id] || getRequestDraft(request),
                  (field, value) => updateDraft(request.id, field, value),
                  busy,
                  `document-request-${request.id}`,
                  true,
                )}
                <button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? "Сохраняем…" : "Сохранить запрос"}</button>
                <button className={styles.textButton} type="button" disabled={busy} onClick={() => setEditingId(null)}>Не изменять</button>
              </form>
            ) : null}

            {request.status === "submitted" ? (
              <div className={styles.actions}>
                {acceptingId === request.id ? (
                  <span className={styles.confirmation}>
                    <button className={styles.primaryButton} type="button" disabled={busy} onClick={() => handleReview(request, "accepted")}>Подтвердить принятие</button>
                    <button className={styles.textButton} type="button" disabled={busy} onClick={() => setAcceptingId(null)}>Оставить на проверке</button>
                  </span>
                ) : (
                  <button className={styles.primaryButton} type="button" disabled={busy} onClick={() => setAcceptingId(request.id)}>Принять комплект</button>
                )}
                <label>
                  <span>Что нужно исправить</span>
                  <textarea
                    maxLength={2000}
                    rows={3}
                    value={changesNote}
                    disabled={busy}
                    onChange={(event) => setReviewNotes((current) => ({ ...current, [request.id]: event.target.value }))}
                  />
                </label>
                <button className={styles.secondaryButton} type="button" disabled={busy || !changesNote.trim()} onClick={() => handleReview(request, "changes_requested")}>Вернуть на исправление</button>
              </div>
            ) : null}

            {canCancel ? (
              <div className={styles.actions}>
                {cancellingId === request.id ? (
                  <span className={styles.confirmation}>
                    <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => handleCancel(request)}>Подтвердить отмену</button>
                    <button className={styles.textButton} type="button" disabled={busy} onClick={() => setCancellingId(null)}>Оставить</button>
                  </span>
                ) : (
                  <button className={styles.textButton} type="button" disabled={busy} onClick={() => setCancellingId(request.id)}>Отменить запрос</button>
                )}
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
