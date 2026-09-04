"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AI_PRECHECK_HREF, LEAD_FORM_HREF } from "../../lib/public-navigation.mjs";
import { createUuidV4 } from "../../lib/submission-id.mjs";
import { registerMatterDocument, sendMatterMessage } from "./cabinet-actions";
import {
  CaseHeader,
  DocumentRegister,
  MatterSwitch,
  Timeline,
  UnsavedMessageDialog,
  UploadControl,
} from "./cabinet-matter-components";
import CabinetNavigation from "./cabinet-navigation";
import CabinetOverview from "./cabinet-overview";
import { EMPTY_CABINET_STEPS, getMatterById } from "./cabinet-data.mjs";
import { buildCabinetHref, parseCabinetLocation } from "./cabinet-navigation-domain.mjs";
import {
  buildDocumentStoragePath,
  DOCUMENT_BUCKET,
  validateDocumentUpload,
  validateMatterMessage,
} from "./cabinet-write-domain.mjs";
import ClientDocumentRequests from "../document-requests/client-document-requests";
import styles from "./cabinet.module.css";

function MattersView({ matters, matter, onNavigate }) {
  return (
    <>
      <CaseHeader matter={matter} sectionTitle="Мои дела" onBack={() => onNavigate("overview", matter.id)} />
      {matters.length > 1 ? (
        <MatterSwitch
          compact
          matters={matters}
          activeMatterId={matter.id}
          onSelect={(id) => onNavigate("matters", id)}
        />
      ) : null}
      <div className={styles.detailsGrid}>
        <section className={styles.detailsMain} aria-labelledby="matter-details-title">
          <p className={styles.eyebrow}>{matter.reference}</p>
          <h2 className={styles.userTitle} id="matter-details-title">{matter.title}</h2>
          <p className={styles.matterSummary}>{matter.summary}</p>
          <div className={styles.sectionLabel}>Этапы</div>
          <Timeline matter={matter} condensed />
        </section>
        <section className={styles.updatesPanel} aria-labelledby="updates-title">
          <p className={styles.eyebrow}>Хронология</p>
          <h2 id="updates-title">Последние изменения</h2>
          {matter.updates.length ? <ol className={styles.updatesList}>
            {matter.updates.map((update) => (
              <li key={update.id ?? `${update.date}-${update.time}`}>
                <time>{update.date}<span>{update.time}</span></time>
                <p>{update.text}</p>
              </li>
            ))}
          </ol> : <p className={styles.emptyList}>Изменений по делу пока нет.</p>}
        </section>
      </div>
    </>
  );
}

function DocumentsView({
  matters,
  matter,
  onNavigate,
  uploadFeedback,
  documentFeedback,
  downloadingId,
  isUploading,
  onDownload,
  onFileChange,
}) {
  return (
    <>
      <CaseHeader matter={matter} sectionTitle="Материалы дела" onBack={() => onNavigate("overview", matter.id)} />
      {matters.length > 1 ? (
        <MatterSwitch
          compact
          matters={matters}
          activeMatterId={matter.id}
          onSelect={(id) => onNavigate("documents", id)}
        />
      ) : null}
      <div className={styles.documentsGrid} id="documents">
        <section className={styles.documentsMain} aria-labelledby="requested-documents-title">
          <p className={styles.eyebrow}>{matter.reference}</p>
          <h2 id="requested-documents-title">Запрошено</h2>
          <ClientDocumentRequests
            matterId={matter.id}
            requests={matter.documentRequests}
            downloadingId={downloadingId}
            downloadFeedback={documentFeedback}
            onDownload={onDownload}
          />
          <div className={styles.sectionLabel}>Другие документы</div>
          <DocumentRegister
            documents={matter.documents.filter((document) => document.requestId === null)}
            emptyText="Других документов пока нет."
            feedback={documentFeedback}
            downloadingId={downloadingId}
            onDownload={onDownload}
          />
        </section>
        {matter.nextAction ? (
          <UploadControl
            matter={matter}
            feedback={uploadFeedback}
            isUploading={isUploading}
            onFileChange={onFileChange}
          />
        ) : (
          <section className={styles.quietPanel}>
            <p className={styles.eyebrow}>Статус</p>
            <h2>Комплект документов сформирован.</h2>
            <p>Новых материалов по этому делу сейчас не требуется.</p>
          </section>
        )}
      </div>
    </>
  );
}

function MessagesView({
  matters,
  matter,
  onNavigate,
  draft,
  onDraftChange,
  feedback,
  isSending,
  onSendMessage,
}) {
  return (
    <>
      <CaseHeader matter={matter} sectionTitle="Связь по делу" onBack={() => onNavigate("overview", matter.id)} />
      {matters.length > 1 ? (
        <MatterSwitch
          compact
          matters={matters}
          activeMatterId={matter.id}
          onSelect={(id) => onNavigate("messages", id)}
        />
      ) : null}
      <div className={styles.messagesGrid}>
        <section className={styles.messageHistory} aria-labelledby="message-history-title">
          <p className={styles.eyebrow}>{matter.reference}</p>
          <h2 id="message-history-title">История сообщений</h2>
          {matter.messages.length ? <ol>
            {matter.messages.map((message) => (
              <li key={message.id}>
                <div><strong>{message.sender}</strong><time>{message.date}</time></div>
                <p>{message.text}</p>
              </li>
            ))}
          </ol> : <p className={styles.emptyList}>Сообщений по этому делу пока нет.</p>}
        </section>
        <form className={styles.messageComposer} onSubmit={onSendMessage}>
          <p className={styles.eyebrow}>Новое сообщение</p>
          <h2>Задать вопрос по делу</h2>
          <label htmlFor="cabinet-message">Сообщение</label>
          <textarea
            id="cabinet-message"
            value={draft}
            rows={7}
            maxLength={2000}
            placeholder="Кратко сформулируйте вопрос"
            disabled={isSending}
            onChange={(event) => onDraftChange(event.target.value)}
          />
          <button className={styles.darkButton} type="submit" disabled={isSending}>
            {isSending ? "Отправка…" : "Отправить сообщение"}
          </button>
          <p className={styles.privacyNote}>Сообщение сохранится в деле и будет доступно только его участникам.</p>
          <p
            className={`${styles.uploadFeedback}${feedback.tone === "error" ? ` ${styles.uploadFeedbackError}` : ""}`}
            role="status"
            aria-live="polite"
          >
            {feedback.text}
          </p>
        </form>
      </div>
    </>
  );
}

function EmptyCabinet() {
  return (
    <section className={styles.emptyCabinet} aria-labelledby="empty-cabinet-title">
      <p className={styles.eyebrow}>Аккаунт подтверждён</p>
      <h1 id="empty-cabinet-title">Начнём без лишних шагов.</h1>
      <p className={styles.emptyCabinetLead}>
        Кабинет уже готов. Теперь передайте ситуацию — остальное организует команда ДоговорОфф.
      </p>
      <ol className={styles.onboardingSteps} aria-label="Первые шаги в личном кабинете">
        {EMPTY_CABINET_STEPS.map((step) => (
          <li
            key={step.id}
            className={styles[`onboardingStep_${step.state}`]}
            aria-current={step.state === "current" ? "step" : undefined}
          >
            <span className={styles.onboardingStepIndex}>{step.index}</span>
            <div>
              <small>{step.statusLabel}</small>
              <strong>{step.title}</strong>
              <p>{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className={styles.emptyCabinetActions}>
        <a className={styles.darkButton} href={LEAD_FORM_HREF}>Оставить заявку</a>
        <a className={styles.quietLink} href={AI_PRECHECK_HREF}>Пройти AI-разбор</a>
      </div>
      <div className={styles.emptyCabinetNote}>
        <span>После заявки</span>
        <p>После назначения дела здесь откроются документы и сообщения. Повторно регистрироваться не потребуется.</p>
      </div>
    </section>
  );
}

export default function CabinetClient({
  initialMatters = [],
  initialNotifications = [],
  displayName = "Клиент",
  staffHref = null,
}) {
  const router = useRouter();
  const matters = initialMatters;
  const hasMatters = matters.length > 0;
  const [activeView, setActiveView] = useState("overview");
  const [activeMatterId, setActiveMatterId] = useState(matters[0]?.id ?? null);
  const [uploadFeedback, setUploadFeedback] = useState({ tone: "neutral", text: "PDF, DOC, DOCX, JPG или PNG — до 10 МБ." });
  const [documentFeedback, setDocumentFeedback] = useState({ tone: "neutral", text: "" });
  const [downloadingId, setDownloadingId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [draft, setDraft] = useState("");
  const [messageFeedback, setMessageFeedback] = useState({ tone: "neutral", text: "" });
  const [isSending, setIsSending] = useState(false);
  const [headerPanel, setHeaderPanel] = useState(null);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const mainRef = useRef(null);
  const messageIdRef = useRef(null);
  const activeMatterIdRef = useRef(activeMatterId);
  const matter = useMemo(() => getMatterById(activeMatterId, matters), [activeMatterId, matters]);
  const hasUnreadMessage = initialNotifications.some((notification) => (
    notification.matterId === matter?.id
      && notification.type === "message.created" && notification.unread === true
  ));

  const applyCabinetLocation = (next) => {
    if (next.matterId !== activeMatterIdRef.current) {
      setDraft("");
      messageIdRef.current = null;
      setMessageFeedback({ tone: "neutral", text: "" });
      setDocumentFeedback({ tone: "neutral", text: "" });
    }
    activeMatterIdRef.current = next.matterId;
    setActiveView(next.view);
    setActiveMatterId(next.matterId);
  };

  useEffect(() => {
    const applyLocation = () => {
      const next = parseCabinetLocation(window.location.search, matters);
      applyCabinetLocation(next);
    };
    applyLocation();
    window.addEventListener("popstate", applyLocation);
    return () => window.removeEventListener("popstate", applyLocation);
  }, [matters]);

  const selectView = (view, matterId = activeMatterId, { replace = false } = {}) => {
    const next = parseCabinetLocation(
      buildCabinetHref({ view, matterId }).split("?")[1] || "",
      matters,
    );
    if (replace) {
      window.history.replaceState(null, "", buildCabinetHref(next));
    } else {
      window.history.pushState(null, "", buildCabinetHref(next));
    }
    applyCabinetLocation(next);
    setHeaderPanel(null);
    window.requestAnimationFrame(() => mainRef.current?.focus({ preventScroll: true }));
  };

  const requestNavigation = (view, matterId = activeMatterId) => {
    if (view === activeView && matterId === activeMatterId) {
      return;
    }
    if (activeView === "messages" && draft.trim()) {
      setPendingNavigation({ view, matterId });
      return;
    }
    selectView(view, matterId);
  };

  const discardDraftAndContinue = () => {
    const next = pendingNavigation;
    setPendingNavigation(null);
    setDraft("");
    messageIdRef.current = null;
    if (next) {
      selectView(next.view, next.matterId);
    }
  };

  const handleFileChange = async (event) => {
    const input = event.currentTarget;
    const [file] = Array.from(input.files ?? []);
    const validation = validateDocumentUpload(file);

    if (!validation.valid) {
      setUploadFeedback({ tone: "error", text: validation.error });
      input.value = "";
      return;
    }

    if (!matter) {
      setUploadFeedback({ tone: "error", text: "Не удалось определить дело для документа." });
      input.value = "";
      return;
    }

    setIsUploading(true);
    setUploadFeedback({ tone: "neutral", text: "Загружаем документ в защищённое хранилище…" });

    try {
      const documentId = createUuidV4(window.crypto);
      if (!documentId) {
        throw new Error("Secure document identifier is unavailable");
      }
      const storagePath = buildDocumentStoragePath({
        matterId: matter.id,
        documentId,
        extension: validation.extension,
      });
      const { createClient } = await import("../../lib/supabase/browser");
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(DOCUMENT_BUCKET)
        .upload(storagePath, file, {
          cacheControl: "3600",
          contentType: validation.mimeType,
          upsert: false,
        });

      if (uploadError) {
        console.error("Cabinet document upload failed", {
          statusCode: uploadError.statusCode,
        });
        setUploadFeedback({ tone: "error", text: "Не удалось загрузить документ. Попробуйте ещё раз." });
        return;
      }

      const registration = await registerMatterDocument({
        id: documentId,
        matterId: matter.id,
        storagePath,
        originalName: validation.originalName,
        mimeType: validation.mimeType,
        sizeBytes: validation.sizeBytes,
      });

      if (!registration.ok) {
        setUploadFeedback({ tone: "error", text: registration.message });
        return;
      }

      setUploadFeedback({ tone: "success", text: registration.message });
      router.refresh();
    } catch {
      setUploadFeedback({ tone: "error", text: "Не удалось загрузить документ. Попробуйте ещё раз." });
    } finally {
      setIsUploading(false);
      input.value = "";
    }
  };

  const handleDocumentDownload = async (document) => {
    if (!document.storagePath || downloadingId) {
      return;
    }

    setDownloadingId(document.id);
    setDocumentFeedback({ tone: "neutral", text: "Подготавливаем документ…" });

    try {
      const { createClient } = await import("../../lib/supabase/browser");
      const supabase = createClient();
      const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).download(document.storagePath);

      if (error || !data) {
        console.error("Cabinet document download failed", {
          statusCode: error?.statusCode,
        });
        setDocumentFeedback({ tone: "error", text: "Не удалось скачать документ. Попробуйте ещё раз." });
        return;
      }

      const objectUrl = URL.createObjectURL(data);
      const anchor = window.document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = document.name;
      anchor.style.display = "none";
      window.document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setDocumentFeedback({ tone: "success", text: "Скачивание началось." });
    } catch {
      setDocumentFeedback({ tone: "error", text: "Не удалось скачать документ. Попробуйте ещё раз." });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!matter || isSending) {
      return;
    }

    const validation = validateMatterMessage({ matterId: matter.id, body: draft });
    if (!validation.valid) {
      setMessageFeedback({ tone: "error", text: validation.error });
      return;
    }

    const messageId = messageIdRef.current ?? createUuidV4(window.crypto);
    if (!messageId) {
      setMessageFeedback({ tone: "error", text: "Не удалось подготовить сообщение. Обновите страницу и попробуйте ещё раз." });
      return;
    }
    messageIdRef.current = messageId;

    setIsSending(true);
    setMessageFeedback({ tone: "neutral", text: "Отправляем сообщение…" });

    try {
      const result = await sendMatterMessage({ ...validation.value, id: messageId });
      if (!result.ok) {
        setMessageFeedback({ tone: "error", text: result.message });
        return;
      }

      setDraft("");
      messageIdRef.current = null;
      setMessageFeedback({ tone: "success", text: result.message });
      router.refresh();
    } catch {
      setMessageFeedback({ tone: "error", text: "Не удалось отправить сообщение. Попробуйте ещё раз." });
    } finally {
      setIsSending(false);
    }
  };

  const handleDraftChange = (value) => {
    if (messageIdRef.current && value !== draft) {
      messageIdRef.current = null;
    }
    setDraft(value);
  };

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#cabinet-main">Перейти к содержанию</a>
      <CabinetNavigation
        activeView={activeView}
        displayName={displayName}
        hasMatters={hasMatters}
        headerPanel={headerPanel}
        notifications={initialNotifications}
        onHeaderPanelChange={setHeaderPanel}
        onNotificationOpen={(notification) => requestNavigation(notification.targetView, notification.matterId)}
        onSelectView={requestNavigation}
        staffHref={staffHref}
      />

      <div className={styles.layout}>
        <main id="cabinet-main" className={styles.main} ref={mainRef} tabIndex={-1}>
          {!matter && <EmptyCabinet />}
          {matter && activeView === "overview" && (
            <CabinetOverview
              matters={matters}
              matter={matter}
              hasUnreadMessage={hasUnreadMessage}
              documentFeedback={documentFeedback}
              downloadingId={downloadingId}
              onDownload={handleDocumentDownload}
              onNavigate={requestNavigation}
            />
          )}
          {matter && activeView === "matters" && <MattersView matters={matters} matter={matter} onNavigate={requestNavigation} />}
          {matter && activeView === "documents" && (
            <DocumentsView
              matters={matters}
              matter={matter}
              onNavigate={requestNavigation}
              uploadFeedback={uploadFeedback}
              documentFeedback={documentFeedback}
              downloadingId={downloadingId}
              isUploading={isUploading}
              onDownload={handleDocumentDownload}
              onFileChange={handleFileChange}
            />
          )}
          {matter && activeView === "messages" && (
            <MessagesView
              matters={matters}
              matter={matter}
              onNavigate={requestNavigation}
              draft={draft}
              onDraftChange={handleDraftChange}
              feedback={messageFeedback}
              isSending={isSending}
              onSendMessage={handleSendMessage}
            />
          )}
        </main>
      </div>
      <UnsavedMessageDialog
        open={pendingNavigation !== null}
        onContinue={() => setPendingNavigation(null)}
        onDiscard={discardDraftAndContinue}
      />
    </div>
  );
}
