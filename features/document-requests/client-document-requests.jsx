"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createUuidV4 } from "../../lib/submission-id.mjs";
import { registerMatterDocument } from "../cabinet/cabinet-actions";
import {
  DOCUMENT_BUCKET,
  buildDocumentStoragePath,
  validateDocumentUpload,
} from "../cabinet/cabinet-write-domain.mjs";
import {
  submitDocumentRequest,
  withdrawDocumentRequestFile,
} from "./document-request-actions";
import styles from "./document-requests.module.css";

const FILE_ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png";
const DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function getErrorMessage(result, fallback) {
  return result?.message || fallback;
}

function isActiveFile(document) {
  return document.statusValue !== "archived";
}

function getContextualStatus(request) {
  if (request.status === "submitted") return "Комплект находится на проверке";
  if (request.status === "accepted") return "Комплект принят";
  if (request.status === "cancelled") return "Запрос отменён";
  return "Требуется от вас";
}

export default function ClientDocumentRequests({
  matterId,
  requests = [],
  mode = "full",
  downloadingId = null,
  downloadFeedback = { tone: "neutral", text: "" },
  onDownload,
}) {
  const router = useRouter();
  const statusRef = useRef(null);
  const cardRefs = useRef(new Map());
  const [busyKey, setBusyKey] = useState("");
  const [feedback, setFeedback] = useState({ tone: "neutral", text: "" });
  const [pendingRegistrations, setPendingRegistrations] = useState({});
  const [withdrawal, setWithdrawal] = useState(null);

  const activeRequests = requests.filter((request) => request.status !== "cancelled");
  const cancelledRequests = requests.filter((request) => request.status === "cancelled");
  const visibleRequests = mode === "overview" ? requests.slice(0, 1) : activeRequests;
  const visibleFeedback = feedback.text ? feedback : downloadFeedback;

  const focusFeedback = () => {
    statusRef.current?.focus({ preventScroll: true });
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
    window.requestAnimationFrame(focusFeedback);
  };

  const savePendingRegistration = (registration) => {
    setPendingRegistrations((current) => ({
      ...current,
      [registration.id]: registration,
    }));
  };

  const clearPendingRegistration = (registrationId) => {
    setPendingRegistrations((current) => {
      const next = { ...current };
      delete next[registrationId];
      return next;
    });
  };

  const registerUploadedDocument = async (registration) => {
    try {
      const result = await registerMatterDocument(registration);
      if (!result?.ok) {
        savePendingRegistration(registration);
        failMutation(getErrorMessage(result, "Не удалось зарегистрировать документ. Повторите регистрацию."));
        return false;
      }

      clearPendingRegistration(registration.id);
      completeMutation(registration.requestId, result.message);
      return true;
    } catch {
      savePendingRegistration(registration);
      failMutation("Не удалось зарегистрировать документ. Повторите регистрацию.");
      return false;
    }
  };

  const handleFileChange = async (request, event) => {
    const input = event.currentTarget;
    const [file] = Array.from(input.files ?? []);
    const validation = validateDocumentUpload(file);
    if (!validation.valid) {
      failMutation(validation.error);
      input.value = "";
      return;
    }

    const documentId = createUuidV4(window.crypto);
    if (!documentId) {
      failMutation("Не удалось подготовить документ. Обновите страницу и попробуйте ещё раз.");
      input.value = "";
      return;
    }

    const registration = {
      id: documentId,
      matterId,
      requestId: request.id,
      storagePath: buildDocumentStoragePath({
        matterId,
        documentId,
        extension: validation.extension,
      }),
      originalName: validation.originalName,
      mimeType: validation.mimeType,
      sizeBytes: validation.sizeBytes,
    };

    setBusyKey(request.id);
    setFeedback({ tone: "neutral", text: "Загружаем документ в защищённое хранилище…" });
    try {
      const { createClient } = await import("../../lib/supabase/browser");
      const supabase = createClient();
      const { error } = await supabase.storage.from(DOCUMENT_BUCKET).upload(registration.storagePath, file, {
        cacheControl: "3600",
        contentType: validation.mimeType,
        upsert: false,
      });
      if (error) {
        failMutation("Не удалось загрузить документ. Попробуйте ещё раз.");
        return;
      }

      await registerUploadedDocument(registration);
    } catch {
      failMutation("Не удалось загрузить документ. Попробуйте ещё раз.");
    } finally {
      setBusyKey("");
      input.value = "";
    }
  };

  const handleRetryRegistration = async (registration) => {
    setBusyKey(registration.requestId);
    setFeedback({ tone: "neutral", text: "Повторно регистрируем документ…" });
    try {
      await registerUploadedDocument(registration);
    } finally {
      setBusyKey("");
    }
  };

  const handleSubmit = async (request) => {
    setBusyKey(request.id);
    setFeedback({ tone: "neutral", text: "Отправляем комплект на проверку…" });
    try {
      const result = await submitDocumentRequest({ requestId: request.id });
      if (!result?.ok) {
        failMutation(getErrorMessage(result, "Не удалось отправить комплект. Попробуйте ещё раз."));
        return;
      }
      completeMutation(request.id, result.message);
    } catch {
      failMutation("Не удалось отправить комплект. Попробуйте ещё раз.");
    } finally {
      setBusyKey("");
    }
  };

  const handleWithdraw = async (request, document) => {
    setBusyKey(request.id);
    setFeedback({ tone: "neutral", text: "Отзываем файл из комплекта…" });
    try {
      const result = await withdrawDocumentRequestFile({ requestId: request.id, documentId: document.id });
      if (!result?.ok) {
        failMutation(getErrorMessage(result, "Не удалось отозвать файл. Попробуйте ещё раз."));
        return;
      }
      setWithdrawal(null);
      completeMutation(request.id, result.message);
    } catch {
      failMutation("Не удалось отозвать файл. Попробуйте ещё раз.");
    } finally {
      setBusyKey("");
    }
  };

  const handleDownload = (document) => {
    setFeedback({ tone: "neutral", text: "" });
    onDownload?.(document);
  };

  const renderRequest = (request, quiet = false) => {
    const activeDocuments = request.documents.filter(isActiveFile);
    const canAct = request.status === "requested" || request.status === "changes_requested";
    const busy = busyKey === request.id;
    const pendingRequestRegistrations = Object.values(pendingRegistrations)
      .filter((registration) => registration.requestId === request.id);
    const reviewNote = request.status === "changes_requested"
      || (request.status === "submitted" && request.lastReviewNote)
      ? request.lastReviewNote
      : "";

    return (
      <article
        className={`${styles.card}${quiet ? ` ${styles.quietCard}` : ""}`}
        key={request.id}
        ref={(node) => {
          if (node) cardRefs.current.set(request.id, node);
          else cardRefs.current.delete(request.id);
        }}
        tabIndex={-1}
      >
        <div className={styles.cardHeader}>
          <div>
            <p className={styles.status}>{getContextualStatus(request)}</p>
            <h2>{request.title}</h2>
          </div>
          {request.dueOn && <time dateTime={request.dueOn}>{DATE_FORMATTER.format(new Date(`${request.dueOn}T12:00:00`))}</time>}
        </div>
        {request.instructions && <p className={styles.instructions}>{request.instructions}</p>}
        {reviewNote && <p className={styles.reviewNote}>{reviewNote}</p>}
        <p className={styles.fileCount}>Активных файлов: {activeDocuments.length}</p>
        {activeDocuments.length > 0 && (
          <ul className={styles.fileList} aria-label={`Файлы для запроса «${request.title}»`}>
            {activeDocuments.map((document) => {
              const isWithdrawing = withdrawal?.requestId === request.id && withdrawal.documentId === document.id;
              return (
                <li key={document.id}>
                  <button
                    className={styles.fileButton}
                    type="button"
                    disabled={downloadingId === document.id}
                    onClick={() => handleDownload(document)}
                  >
                    <span>{document.name}</span>
                    <small>{downloadingId === document.id ? "Загрузка…" : "Скачать"}</small>
                  </button>
                  {canAct && (
                    isWithdrawing ? (
                      <span className={styles.confirmation}>
                        <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => handleWithdraw(request, document)}>Подтвердить отзыв</button>
                        <button className={styles.textButton} type="button" disabled={busy} onClick={() => setWithdrawal(null)}>Оставить файл</button>
                      </span>
                    ) : (
                      <button className={styles.textButton} type="button" disabled={busy} onClick={() => setWithdrawal({ requestId: request.id, documentId: document.id })}>Отозвать файл</button>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {canAct && (
          <div className={styles.actions}>
            {activeDocuments.length < 20 ? (
              <label className={styles.secondaryButton} aria-disabled={busy}>
                <span>{busy ? "Обрабатываем…" : "Добавить файл"}</span>
                <input
                  className={styles.visuallyHidden}
                  type="file"
                  accept={FILE_ACCEPT}
                  disabled={busy}
                  onChange={(event) => handleFileChange(request, event)}
                />
              </label>
            ) : <p className={styles.limitNote}>Не более 20 файлов</p>}
            {pendingRequestRegistrations.map((registration) => (
              <button
                className={styles.secondaryButton}
                key={registration.id}
                type="button"
                disabled={busy}
                onClick={() => handleRetryRegistration(registration)}
              >
                Повторить регистрацию: {registration.originalName}
              </button>
            ))}
            <button className={styles.primaryButton} type="button" disabled={busy || activeDocuments.length === 0} onClick={() => handleSubmit(request)}>Отправить комплект на проверку</button>
          </div>
        )}
      </article>
    );
  };

  return (
    <section className={styles.list} aria-label={mode === "overview" ? "Запрос документов" : "Запрошенные документы"}>
      <p
        ref={statusRef}
        className={`${styles.feedback}${visibleFeedback.tone === "error" ? ` ${styles.feedbackError}` : ""}`}
        role="status"
        aria-live="polite"
        tabIndex={-1}
      >
        {visibleFeedback.text}
      </p>
      {visibleRequests.map((request) => renderRequest(request))}
      {mode === "full" && cancelledRequests.length > 0 && (
        <details className={styles.cancelledList}>
          <summary>Отменённые запросы</summary>
          {cancelledRequests.map((request) => renderRequest(request, true))}
        </details>
      )}
    </section>
  );
}
