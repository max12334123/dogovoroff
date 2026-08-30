"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { AI_PRECHECK_HREF, LEAD_FORM_HREF } from "../../lib/public-navigation.mjs";
import { createUuidV4 } from "../../lib/submission-id.mjs";
import { registerMatterDocument, sendMatterMessage } from "./cabinet-actions";
import NotificationCenter from "../notifications/notification-center";
import { CABINET_VIEWS, EMPTY_CABINET_STEPS, getMatterById } from "./cabinet-data.mjs";
import {
  buildDocumentStoragePath,
  DOCUMENT_BUCKET,
  validateDocumentUpload,
  validateMatterMessage,
} from "./cabinet-write-domain.mjs";
import styles from "./cabinet.module.css";

const TOP_NAVIGATION = CABINET_VIEWS.filter((item) => item.id !== "overview");

function Brand() {
  return (
    <a className={styles.brand} href="/" aria-label="ДоговорОфф — вернуться на сайт">
      <span className={styles.brandMark}>
        <Image src="/media/dogovoroff-mark.png" alt="" width={64} height={64} sizes="44px" priority />
      </span>
      <span className={styles.brandName}>ДоговорОфф</span>
      <span className={styles.brandDescriptor}>Личный кабинет</span>
    </a>
  );
}

function ViewButton({ item, activeView, onSelect, compact = false }) {
  const active = item.id === activeView;

  return (
    <button
      className={`${compact ? styles.topNavButton : styles.railButton}${active ? ` ${styles.isActive}` : ""}`}
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={() => onSelect(item.id)}
    >
      {!compact && <span>{item.index}</span>}
      <strong>{item.label}</strong>
    </button>
  );
}

function MatterSwitch({ matters, activeMatterId, onSelect }) {
  return (
    <div className={styles.matterSwitch} aria-label="Выбор дела">
      {matters.map((matter) => {
        const active = matter.id === activeMatterId;
        return (
          <button
            key={matter.id}
            className={`${styles.matterSwitchButton}${active ? ` ${styles.isActive}` : ""}`}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(matter.id)}
          >
            <span>{matter.index}</span>
            <strong>{matter.title}</strong>
            <small>{matter.stateLabel}</small>
          </button>
        );
      })}
    </div>
  );
}

function Timeline({ matter, condensed = false }) {
  if (!matter.stages.length) {
    return <p className={styles.emptyList}>Этапы появятся после принятия дела в работу.</p>;
  }

  return (
    <ol className={`${styles.timeline}${condensed ? ` ${styles.timelineCondensed}` : ""}`}>
      {matter.stages.map((stage, index) => (
        <li key={stage.id ?? `${stage.title}-${index}`} className={styles[`stage_${stage.status}`]}>
          <span className={styles.stageMarker} aria-hidden="true">
            {index + 1}
          </span>
          <div>
            <strong>{stage.title}</strong>
            <small>{stage.detail}</small>
          </div>
        </li>
      ))}
    </ol>
  );
}

function UploadControl({ matter, feedback, isUploading, onFileChange, onOpenDocuments }) {
  if (!matter.nextAction && (matter.state === "completed" || matter.state === "archived")) {
    return (
      <section className={`${styles.actionPanel} ${styles.actionPanelComplete}`} aria-labelledby="completed-action-title">
        <p className={styles.eyebrow}>Дело завершено</p>
        <h2 id="completed-action-title">Все материалы готовы.</h2>
        <p>Итоговые документы и рекомендации доступны в кабинете.</p>
        <button className={styles.actionButton} type="button" onClick={onOpenDocuments}>Открыть документы</button>
      </section>
    );
  }

  if (!matter.nextAction) {
    return (
      <section className={`${styles.actionPanel} ${styles.actionPanelComplete}`} aria-labelledby="pending-action-title">
        <p className={styles.eyebrow}>Следующий шаг</p>
        <h2 id="pending-action-title">Уточняется юристом.</h2>
        <p>Когда потребуется документ или ответ, информация появится здесь и в сообщениях.</p>
      </section>
    );
  }

  return (
    <section className={styles.actionPanel} aria-labelledby="next-action-title">
      <p className={styles.eyebrow}>Ваш следующий шаг</p>
      <h2 id="next-action-title">{matter.nextAction.title}</h2>
      <p className={styles.actionDeadline}>{matter.nextAction.deadline}</p>
      <p className={styles.actionDescription}>{matter.nextAction.description}</p>
      <label className={styles.actionButton} aria-disabled={isUploading}>
        <span>{isUploading ? "Загрузка…" : "Загрузить документ"}</span>
        <input
          className={styles.visuallyHidden}
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          aria-describedby="upload-note upload-feedback"
          disabled={isUploading}
          onChange={onFileChange}
        />
      </label>
      <p id="upload-note" className={styles.privacyNote}>Файл будет сохранён в приватном хранилище и доступен только участникам дела.</p>
      <p
        id="upload-feedback"
        className={`${styles.uploadFeedback} ${feedback.tone === "error" ? styles.uploadFeedbackError : ""}`}
        role="status"
        aria-live="polite"
      >
        {feedback.text}
      </p>
    </section>
  );
}

function DocumentRegister({ documents, compact = false, feedback, downloadingId, onDownload }) {
  if (!documents.length) {
    return <p className={styles.emptyList}>Документы по этому делу пока не добавлены.</p>;
  }

  return (
    <div className={`${styles.documentRegister}${compact ? ` ${styles.documentRegisterCompact}` : ""}`}>
      <div className={styles.documentHeader} aria-hidden="true">
        <span>Документ</span>
        <span>Статус</span>
        <span>Обновлён</span>
      </div>
      {documents.map((document) => (
        <div className={styles.documentRow} key={document.id}>
          <button
            className={styles.documentDownload}
            type="button"
            disabled={downloadingId === document.id}
            aria-label={`Скачать ${document.name}`}
            onClick={() => onDownload(document)}
          >
            <strong>{document.name}</strong>
            <small>{downloadingId === document.id ? "Загрузка…" : "Скачать"}</small>
          </button>
          <span>{document.status}</span>
          <time dateTime={document.updatedAt || undefined}>{document.updated}</time>
        </div>
      ))}
      {feedback?.text && (
        <p
          className={`${styles.documentFeedback}${feedback.tone === "error" ? ` ${styles.uploadFeedbackError}` : ""}`}
          role="status"
          aria-live="polite"
        >
          {feedback.text}
        </p>
      )}
    </div>
  );
}

function OverviewView({
  matters,
  matter,
  uploadFeedback,
  documentFeedback,
  downloadingId,
  isUploading,
  onDownload,
  onFileChange,
  onNavigate,
}) {
  return (
    <>
      <div className={styles.pageIntro}>
        <p className={styles.eyebrow}>Кабинет клиента</p>
        <h1>Добрый день</h1>
        <p className={styles.editorial}>Вот что происходит по вашему делу</p>
      </div>

      <MatterSwitch matters={matters} activeMatterId={matter.id} onSelect={(id) => onNavigate("overview", id)} />

      <div className={styles.overviewGrid}>
        <section className={styles.matterPanel} aria-labelledby="active-matter-title">
          <div className={styles.matterHeading}>
            <div>
              <p className={styles.eyebrow}>{matter.reference}</p>
              <h2 id="active-matter-title">{matter.title}</h2>
            </div>
            <p className={styles.matterState}>{matter.stateLabel}</p>
          </div>
          <p className={styles.matterSummary}>{matter.summary}</p>
          <div className={styles.sectionLabel}>Ход дела</div>
          <Timeline matter={matter} />
          <a className={styles.aiLink} href={AI_PRECHECK_HREF}>Новый AI-разбор</a>
        </section>

        <div className={styles.overviewAside}>
          <UploadControl
            matter={matter}
            feedback={uploadFeedback}
            isUploading={isUploading}
            onFileChange={onFileChange}
            onOpenDocuments={() => onNavigate("documents", matter.id)}
          />

          <section className={styles.summaryPanel} aria-labelledby="last-message-title">
            <div className={styles.summaryHeading}>
              <p className={styles.eyebrow}>Последнее сообщение</p>
              <button type="button" onClick={() => onNavigate("messages", matter.id)}>Все сообщения</button>
            </div>
            {matter.messages[0] ? (
              <>
                <h2 id="last-message-title">{matter.messages[0].sender}</h2>
                <time>{matter.messages[0].date}</time>
                <p>{matter.messages[0].text}</p>
              </>
            ) : (
              <p className={styles.emptyList} id="last-message-title">Сообщений по делу пока нет.</p>
            )}
          </section>

          <section className={styles.summaryPanel} aria-labelledby="last-documents-title">
            <div className={styles.summaryHeading}>
              <p className={styles.eyebrow}>Последние документы</p>
              <button type="button" onClick={() => onNavigate("documents", matter.id)}>Все документы</button>
            </div>
            <h2 className={styles.visuallyHidden} id="last-documents-title">Последние документы по делу</h2>
            <DocumentRegister
              documents={matter.documents.slice(0, 3)}
              compact
              feedback={documentFeedback}
              downloadingId={downloadingId}
              onDownload={onDownload}
            />
          </section>
        </div>
      </div>
    </>
  );
}

function MattersView({ matters, matter, onMatterSelect }) {
  return (
    <>
      <div className={styles.viewHeading}>
        <div>
          <p className={styles.eyebrow}>Дела</p>
          <h1>История работы</h1>
        </div>
        <p>Следите за этапами и последними изменениями по выбранному делу.</p>
      </div>
      <MatterSwitch matters={matters} activeMatterId={matter.id} onSelect={onMatterSelect} />
      <div className={styles.detailsGrid}>
        <section className={styles.detailsMain} aria-labelledby="matter-details-title">
          <p className={styles.eyebrow}>{matter.reference}</p>
          <h2 id="matter-details-title">{matter.title}</h2>
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
  onMatterSelect,
  uploadFeedback,
  documentFeedback,
  downloadingId,
  isUploading,
  onDownload,
  onFileChange,
}) {
  return (
    <>
      <div className={styles.viewHeading}>
        <div>
          <p className={styles.eyebrow}>Документы</p>
          <h1>Материалы дела</h1>
        </div>
        <p>Здесь собраны файлы по выбранному делу.</p>
      </div>
      <MatterSwitch matters={matters} activeMatterId={matter.id} onSelect={onMatterSelect} />
      <div className={styles.documentsGrid} id="documents">
        <section className={styles.documentsMain} aria-labelledby="document-register-title">
          <p className={styles.eyebrow}>{matter.reference}</p>
          <h2 id="document-register-title">Реестр документов</h2>
          <DocumentRegister
            documents={matter.documents}
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
  onMatterSelect,
  draft,
  onDraftChange,
  feedback,
  isSending,
  onSendMessage,
}) {
  return (
    <>
      <div className={styles.viewHeading}>
        <div>
          <p className={styles.eyebrow}>Сообщения</p>
          <h1>Связь по делу</h1>
        </div>
        <p>Все сообщения относятся к выбранному делу.</p>
      </div>
      <MatterSwitch matters={matters} activeMatterId={matter.id} onSelect={onMatterSelect} />
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
  const mainRef = useRef(null);
  const messageIdRef = useRef(null);
  const matter = useMemo(() => getMatterById(activeMatterId, matters), [activeMatterId, matters]);

  const selectView = (view, matterId = activeMatterId) => {
    if (matterId !== activeMatterId) {
      setDraft("");
      messageIdRef.current = null;
      setMessageFeedback({ tone: "neutral", text: "" });
      setDocumentFeedback({ tone: "neutral", text: "" });
    }
    setActiveMatterId(matterId);
    setActiveView(view);
    setHeaderPanel(null);
    window.requestAnimationFrame(() => {
      mainRef.current?.focus({ preventScroll: true });
      mainRef.current?.scrollIntoView({ block: "start" });
    });
  };

  const selectMatter = (matterId) => {
    selectView(activeView, matterId);
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
      <header className={styles.header}>
        <Brand />
        <nav className={styles.topNav} aria-label="Разделы личного кабинета">
          {hasMatters && TOP_NAVIGATION.map((item) => (
            <ViewButton key={item.id} item={item} activeView={activeView} onSelect={selectView} compact />
          ))}
          <a className={styles.aiTopLink} href={AI_PRECHECK_HREF}>AI-разбор</a>
        </nav>
        <NotificationCenter
          notifications={initialNotifications}
          open={headerPanel === "notifications"}
          onOpenChange={(isOpen) => {
            setHeaderPanel((current) => (isOpen ? "notifications" : current === "notifications" ? null : current));
          }}
          onOpen={(notification) => selectView(notification.targetView, notification.matterId)}
        />
        <details
          className={styles.profile}
          open={headerPanel === "profile"}
          onToggle={(event) => {
            const isOpen = event.currentTarget.open;
            setHeaderPanel((current) => (isOpen ? "profile" : current === "profile" ? null : current));
          }}
        >
          <summary>{displayName}</summary>
          <div>
            <span>Подтверждённый аккаунт</span>
            {staffHref && <a href={staffHref}>Рабочая панель</a>}
            <a href="/">Вернуться на сайт</a>
            <form action="/auth/signout" method="post">
              <button type="submit">Выйти</button>
            </form>
          </div>
        </details>
      </header>

      {hasMatters && <nav className={styles.mobileNav} aria-label="Разделы личного кабинета на мобильном устройстве">
        {CABINET_VIEWS.map((item) => (
          <ViewButton key={item.id} item={item} activeView={activeView} onSelect={selectView} compact />
        ))}
      </nav>}

      <div className={styles.layout}>
        <aside className={styles.rail}>
          <p className={styles.railTitle}>Кабинет</p>
          {hasMatters ? <nav aria-label="Навигация личного кабинета">
            {CABINET_VIEWS.map((item) => (
              <ViewButton key={item.id} item={item} activeView={activeView} onSelect={selectView} />
            ))}
          </nav> : <p className={styles.railEmpty}>Дела появятся после принятия обращения.</p>}
          <div className={styles.railFooter}>
            <span>Защищённый доступ</span>
            <a href="/privacy">Конфиденциальность</a>
          </div>
        </aside>

        <main id="cabinet-main" className={styles.main} ref={mainRef} tabIndex={-1}>
          {!matter && <EmptyCabinet />}
          {matter && activeView === "overview" && (
            <OverviewView
              matters={matters}
              matter={matter}
              uploadFeedback={uploadFeedback}
              documentFeedback={documentFeedback}
              downloadingId={downloadingId}
              isUploading={isUploading}
              onDownload={handleDocumentDownload}
              onFileChange={handleFileChange}
              onNavigate={selectView}
            />
          )}
          {matter && activeView === "matters" && <MattersView matters={matters} matter={matter} onMatterSelect={selectMatter} />}
          {matter && activeView === "documents" && (
            <DocumentsView
              matters={matters}
              matter={matter}
              onMatterSelect={selectMatter}
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
              onMatterSelect={selectMatter}
              draft={draft}
              onDraftChange={handleDraftChange}
              feedback={messageFeedback}
              isSending={isSending}
              onSendMessage={handleSendMessage}
            />
          )}
        </main>
      </div>
    </div>
  );
}
