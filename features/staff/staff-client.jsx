"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createUuidV4 } from "../../lib/submission-id.mjs";
import { DOCUMENT_BUCKET } from "../cabinet/cabinet-write-domain.mjs";
import { sendMatterMessage } from "../cabinet/cabinet-actions";
import { validateMatterMessage } from "../cabinet/cabinet-write-domain.mjs";
import NotificationCenter from "../notifications/notification-center";
import StaffAssignmentForm from "./staff-assignment-form";
import StaffIntakePanel from "./staff-intake-panel";
import StaffMatterWorkspace from "./staff-matter-workspace";
import StaffMatterDetailsForm from "./staff-matter-details-form";
import StaffNavigation from "./staff-navigation";
import StaffTaskList from "./staff-task-list";
import { buildStaffHref, getStaffMatterLocation, parseStaffLocation } from "./staff-navigation-domain.mjs";
import { filterStaffAuditEvents, filterStaffMatters, filterStaffNavigation, getStaffMatterQueue } from "./staff-domain.mjs";
import { updateMatterWorkflow } from "./staff-actions";
import { validateMatterWorkflow } from "./staff-workflow-domain.mjs";
import styles from "./staff.module.css";

const NAVIGATION = [
  { id: "today", label: "Сегодня" },
  { id: "inbox", label: "Входящие" },
  { id: "matters", label: "Все дела" },
  { id: "clients", label: "Клиенты" },
  { id: "documents", label: "Документы" },
  { id: "messages", label: "Сообщения" },
  { id: "audit", label: "Журнал" },
];

const VIEW_COPY = {
  today: { title: "Сегодня в работе", eyebrow: "Рабочий день" },
  inbox: { title: "Входящие заявки", eyebrow: "Новые обращения" },
  matters: { title: "Все дела", eyebrow: "Реестр команды" },
  clients: { title: "Клиенты", eyebrow: "Доступ по делам" },
  documents: { title: "Документы", eyebrow: "Материалы по делам" },
  messages: { title: "Сообщения", eyebrow: "Связь с клиентами" },
  audit: { title: "Журнал действий", eyebrow: "Контроль организации" },
  matter: { title: "Карточка дела", eyebrow: "Работа по делу" },
};

const REGISTER_FILTERS = [
  { id: "all", label: "Все" },
  { id: "action", label: "Требуют действия" },
  { id: "waiting", label: "Ожидают клиента" },
  { id: "paused", label: "Приостановлены" },
  { id: "archive", label: "Архив" },
];

const AUDIT_DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Yekaterinburg",
});

const AUDIT_COPY = Object.freeze({
  "matter.created": { label: "Создано дело", description: "Новое дело добавлено в рабочий реестр." },
  "matter.updated": { label: "Обновлено дело", description: "Изменения рабочего статуса сохранены." },
  "document.created": { label: "Добавлен документ", description: "В дело добавлен новый документ." },
  "document_request.created": { label: "Создан запрос документов", description: "В деле создан запрос документов." },
  "document_request.updated": { label: "Обновлён запрос документов", description: "Параметры запроса документов сохранены." },
  "document_request.submitted": { label: "Получен комплект документов", description: "Комплект документов передан на проверку." },
  "document_request.changes_requested": { label: "Комплект возвращён", description: "Комплект документов возвращён на исправление." },
  "document_request.accepted": { label: "Комплект принят", description: "Комплект документов принят по делу." },
  "document_request.cancelled": { label: "Запрос документов отменён", description: "Запрос документов отменён по делу." },
  "document_request.file_withdrawn": { label: "Файл отозван", description: "Файл отозван из комплекта документов." },
  "message.created": { label: "Отправлено сообщение", description: "В истории дела зарегистрировано сообщение." },
  "intake.updated": { label: "Обновлена заявка", description: "Статус входящего обращения сохранён." },
  "intake.converted": { label: "Заявка принята", description: "Входящее обращение превращено в дело." },
});

function getDateInputValue(value) {
  return typeof value === "string" && value.length >= 10 ? value.slice(0, 10) : "";
}

function formatAuditDate(value) {
  if (typeof value !== "string" || !value) {
    return "Недавно";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Недавно" : AUDIT_DATE_FORMATTER.format(date);
}

function getAuditCopy(event) {
  return AUDIT_COPY[event?.action] ?? {
    label: "Изменение данных",
    description: "В рабочем журнале зарегистрировано изменение.",
  };
}

function getWorkflowDraft(matter) {
  return {
    matterId: matter?.id ?? "",
    status: matter?.state ?? "active",
    stageId: matter?.stages?.[matter.currentStage ?? -1]?.id ?? "",
    nextActionTitle: matter?.nextAction?.title ?? "",
    nextActionDescription: matter?.nextAction?.description ?? "",
    nextActionDueAt: getDateInputValue(matter?.nextAction?.dueAt),
    assignmentTouched: false,
    assignedLawyerId: null,
  };
}

function getPreferredScrollBehavior() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

function EmptyState({ title, text }) {
  return (
    <section className={styles.emptyPanel}>
      <p className={styles.eyebrow}>Список пуст</p>
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  );
}

function RegisterList({ matters, onSelect }) {
  if (!matters.length) {
    return <EmptyState title="Ничего не найдено" text="Измените запрос или фильтр реестра." />;
  }

  return (
    <section className={styles.registerList} aria-label="Реестр дел команды">
      <div className={styles.registerHead} aria-hidden="true">
        <span>Дело</span><span>Статус</span><span>Обновлено</span>
      </div>
      {matters.map((matter) => {
        const queue = getStaffMatterQueue(matter);
        return (
          <button
            className={styles.registerRow}
            type="button"
            key={matter.id}
            onClick={() => onSelect(matter.id)}
          >
            <span className={styles.registerMatter}>
              <strong>{matter.title}</strong>
              <small>{matter.reference}</small>
            </span>
            <span className={`${styles.registerStatus} ${styles[`status_${queue}`]}`}>{queue === "action" ? "Требует действия" : queue === "waiting" ? "Ожидает клиента" : queue === "paused" ? "Приостановлено" : "Архив"}</span>
            <span>{matter.updated || "Недавно"}</span>
          </button>
        );
      })}
    </section>
  );
}

function CollectionList({ type, matters, onSelect }) {
  if (type === "documents") {
    const rows = matters.flatMap((matter) => matter.documents.map((document) => ({ matter, document })));
    if (!rows.length) return <EmptyState title="Документов пока нет" text="Загруженные материалы появятся здесь и в карточке дела." />;
    return (
      <div className={styles.collectionList}>
        {rows.map(({ matter, document }) => (
          <button type="button" key={document.id} onClick={() => onSelect(matter.id)}>
            <span><strong>{document.name}</strong><small>{matter.title} · {matter.reference}</small></span>
            <span>{document.status}<small>{document.updated}</small></span>
          </button>
        ))}
      </div>
    );
  }

  if (type === "messages") {
    const rows = matters.filter((matter) => matter.messages.length);
    if (!rows.length) return <EmptyState title="Сообщений пока нет" text="Диалоги появятся после первого сообщения по делу." />;
    return (
      <div className={styles.collectionList}>
        {rows.map((matter) => (
          <button type="button" key={matter.id} onClick={() => onSelect(matter.id)}>
            <span><strong>{matter.title}</strong><small>{matter.reference}</small></span>
            <span>{matter.messages.length} сообщ.<small>{matter.messages[0]?.date}</small></span>
          </button>
        ))}
      </div>
    );
  }

  if (!matters.length) return <EmptyState title="Клиентских дел пока нет" text="После назначения дела клиенту оно появится в этом списке." />;
  return (
    <div className={styles.collectionList}>
      {matters.map((matter) => (
        <button type="button" key={matter.id} onClick={() => onSelect(matter.id)}>
          <span><strong>Клиент по делу {matter.reference}</strong><small>{matter.title}</small></span>
          <span>{matter.stateLabel}<small>{matter.responseBy}</small></span>
        </button>
      ))}
    </div>
  );
}

function AuditList({ events, matters }) {
  if (!events.length) {
    return <EmptyState title="Записей пока нет" text="Изменения по делам появятся здесь после первого действия команды." />;
  }

  const matterById = new Map(matters.map((matter) => [matter.id, matter]));

  return (
    <section className={styles.auditPanel} aria-labelledby="staff-audit-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Только для администраторов</p>
          <h2 id="staff-audit-title">Последние действия</h2>
        </div>
        <span>{events.length}</span>
      </div>
      <p className={styles.auditIntro}>Журнал содержит только технические события. Тексты сообщений, содержимое документов и email здесь не отображаются.</p>
      <ol className={styles.auditList}>
        {events.map((event) => {
          const matter = matterById.get(event.matterId);
          const copy = getAuditCopy(event);
          return (
            <li className={styles.auditItem} key={event.id}>
              <time dateTime={event.createdAt || undefined}>{formatAuditDate(event.createdAt)}</time>
              <div>
                <strong>{copy.label}</strong>
                <p>{copy.description}</p>
              </div>
              <small>{matter ? `${matter.reference} · ${matter.title}` : "Дело организации"}</small>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default function StaffClient({
  initialMatters = [],
  initialNotifications = [],
  initialIntakeRequests = [],
  intakeEnabled = false,
  initialAuditEvents = [],
  canViewAudit = false,
  organizations = [],
  assignmentOrganizations = [],
  todayLabel = "",
}) {
  const router = useRouter();
  const newMatterButtonRef = useRef(null);
  const detailsButtonRef = useRef(null);
  const documentsRef = useRef(null);
  const messageInputRef = useRef(null);
  const messageIdRef = useRef(null);
  const mainRef = useRef(null);
  const backButtonRef = useRef(null);
  const [location, setLocation] = useState(() => parseStaffLocation("", initialMatters, { canViewAudit, intakeEnabled }));
  const [pendingCreatedMatter, setPendingCreatedMatter] = useState(null);
  const activeView = location.view;
  const [searchQuery, setSearchQuery] = useState("");
  const [registerFilter, setRegisterFilter] = useState("all");
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assignmentIntakeRequest, setAssignmentIntakeRequest] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const composerOpen = activeView === "matter" && location.tab === "messages";
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState({ tone: "neutral", text: "" });
  const [workflowFeedback, setWorkflowFeedback] = useState({ tone: "neutral", text: "" });
  const [workflowDraft, setWorkflowDraft] = useState(() => getWorkflowDraft(initialMatters[0]));
  const [isUpdatingWorkflow, setIsUpdatingWorkflow] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [documentFeedback, setDocumentFeedback] = useState({ tone: "neutral", text: "" });
  const [toast, setToast] = useState("");
  const [isSending, setIsSending] = useState(false);

  const matter = initialMatters.find((item) => item.id === location.matterId) ?? null;
  const searchedMatters = useMemo(
    () => filterStaffMatters(initialMatters, searchQuery, "all"),
    [initialMatters, searchQuery],
  );
  const registerMatters = useMemo(
    () => filterStaffMatters(initialMatters, searchQuery, registerFilter),
    [initialMatters, searchQuery, registerFilter],
  );
  const auditEvents = useMemo(
    () => filterStaffAuditEvents(initialAuditEvents, initialMatters, searchQuery),
    [initialAuditEvents, initialMatters, searchQuery],
  );
  const actionMatters = searchedMatters.filter((item) => getStaffMatterQueue(item) === "action");
  const waitingMatters = searchedMatters.filter((item) => getStaffMatterQueue(item) === "waiting");
  const pausedMatters = searchedMatters.filter((item) => getStaffMatterQueue(item) === "paused");
  const activeCount = initialMatters.filter((item) => item.state === "active").length;
  const documentCount = initialMatters.reduce((total, item) => total + item.documents.length, 0);
  const messageCount = initialMatters.reduce((total, item) => total + item.messages.length, 0);
  const organizationLabel = organizations.find((organization) => organization.id === matter?.organizationId)?.name
    ?? (organizations.length === 1 ? organizations[0].name : "ДоговорОфф");
  const assignmentStaff = assignmentOrganizations.find((organization) => organization.id === matter?.organizationId)?.staff ?? [];
  const canEditDetails = assignmentOrganizations.some((organization) => organization.id === matter?.organizationId);
  const viewCopy = VIEW_COPY[activeView];
  const navigation = filterStaffNavigation(NAVIGATION, { canViewAudit, intakeEnabled });
  const navigationItems = navigation.filter((item) => ["today", "inbox", "matters", "clients"].includes(item.id));
  const moreNavigationItems = navigation.filter((item) => !["today", "inbox", "matters", "clients"].includes(item.id));
  const openIntakeCount = initialIntakeRequests.filter((request) => (
    request.status === "new" || request.status === "reviewing" || request.status === "contacted"
  )).length;

  const navCounts = {
    today: activeCount,
    inbox: openIntakeCount,
    matters: initialMatters.length,
    clients: null,
    documents: documentCount,
    messages: messageCount,
    audit: initialAuditEvents.length,
  };

  useEffect(() => {
    if (!matter) {
      return;
    }

    setWorkflowDraft(getWorkflowDraft(matter));
    setWorkflowFeedback({ tone: "neutral", text: "" });
    setDocumentFeedback({ tone: "neutral", text: "" });
    setDetailsOpen(false);
  }, [matter]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeoutId = window.setTimeout(() => setToast(""), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    const readLocation = () => {
      const next = parseStaffLocation(window.location.search, initialMatters, { canViewAudit, intakeEnabled });
      window.history.replaceState(window.history.state, "", buildStaffHref(next));
      setLocation(next);
    };
    readLocation();
    const handlePopState = () => {
      setPendingCreatedMatter(null);
      readLocation();
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [initialMatters, canViewAudit, intakeEnabled]);

  useEffect(() => {
    setDraft("");
    messageIdRef.current = null;
    setFeedback({ tone: "neutral", text: "" });
    setDetailsOpen(false);
  }, [location.matterId]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      (location.view === "matter" ? backButtonRef : mainRef).current?.focus({ preventScroll: true });
      const target = location.tab === "documents" ? documentsRef.current
        : location.tab === "messages" ? messageInputRef.current : null;
      if (target) target.scrollIntoView({ behavior: getPreferredScrollBehavior(), block: "start" });
      else window.scrollTo({ top: 0, behavior: getPreferredScrollBehavior() });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.view, location.matterId, location.tab]);

  const navigate = (requested) => {
    setPendingCreatedMatter(null);
    const next = parseStaffLocation(buildStaffHref(requested).split("?")[1], initialMatters, { canViewAudit, intakeEnabled });
    window.history.pushState(window.history.state, "", buildStaffHref(next));
    setLocation(next);
  };

  const selectView = (viewId) => navigate({ view: viewId });
  const openMatter = (matterId, tab = "overview") => navigate(
    getStaffMatterLocation(location, matterId, tab, initialMatters, { canViewAudit, intakeEnabled }),
  );
  const closeMatter = () => navigate({ view: location.from });

  useEffect(() => {
    if (!pendingCreatedMatter || !initialMatters.some((item) => item.id === pendingCreatedMatter.matterId)) return;
    const next = getStaffMatterLocation(pendingCreatedMatter.origin, pendingCreatedMatter.matterId, "overview", initialMatters, { canViewAudit, intakeEnabled });
    window.history.pushState(window.history.state, "", buildStaffHref(next));
    setLocation(next);
    setPendingCreatedMatter(null);
  }, [pendingCreatedMatter, initialMatters, canViewAudit, intakeEnabled]);

  const selectCollectionMatter = (matterId) => {
    openMatter(matterId, activeView === "messages" || activeView === "documents" ? activeView : "overview");
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

  const handleWorkflowChange = (field, value) => {
    setWorkflowDraft((current) => {
      if (field === "status" && (value === "active" || value === "paused") && !current.stageId) {
        return {
          ...current,
          status: value,
          stageId: matter?.stages?.[0]?.id ?? "",
        };
      }

      return { ...current, [field]: value };
    });
    if (workflowFeedback.text) {
      setWorkflowFeedback({ tone: "neutral", text: "" });
    }
  };

  const handleAssignmentChange = (value) => {
    if (value === "__keep__") {
      setWorkflowDraft((current) => ({ ...current, assignmentTouched: false, assignedLawyerId: null }));
      return;
    }

    setWorkflowDraft((current) => ({
      ...current,
      assignmentTouched: true,
      assignedLawyerId: value === "__none__" ? null : value,
    }));
  };

  const handleWorkflowSubmit = async (event) => {
    event.preventDefault();
    if (!matter || isUpdatingWorkflow) {
      return;
    }

    const validation = validateMatterWorkflow({ ...workflowDraft, matterId: matter.id });
    if (!validation.valid) {
      setWorkflowFeedback({ tone: "error", text: validation.error });
      return;
    }

    setIsUpdatingWorkflow(true);
    setWorkflowFeedback({ tone: "neutral", text: "Сохраняем изменения…" });

    try {
      const result = await updateMatterWorkflow(validation.value);
      if (!result.ok) {
        setWorkflowFeedback({ tone: "error", text: result.message });
        return;
      }

      setWorkflowFeedback({ tone: "success", text: result.message });
      router.refresh();
    } catch {
      setWorkflowFeedback({ tone: "error", text: "Не удалось обновить дело. Попробуйте ещё раз." });
    } finally {
      setIsUpdatingWorkflow(false);
    }
  };

  const closeWorkflow = () => {
    setWorkflowDraft(getWorkflowDraft(matter));
    setWorkflowFeedback({ tone: "neutral", text: "" });
  };

  const handleDocumentDownload = async (document) => {
    if (!document?.storagePath || downloadingId) {
      return;
    }

    setDownloadingId(document.id);
    setDocumentFeedback({ tone: "neutral", text: "Подготавливаем документ…" });

    try {
      const { createClient } = await import("../../lib/supabase/browser");
      const supabase = createClient();
      const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).download(document.storagePath);

      if (error || !data) {
        console.error("Staff document download failed", { statusCode: error?.statusCode });
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

  const closeAssignment = () => {
    setAssignmentOpen(false);
    setAssignmentIntakeRequest(null);
    requestAnimationFrame(() => newMatterButtonRef.current?.focus());
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    requestAnimationFrame(() => detailsButtonRef.current?.focus());
  };

  const openDocuments = () => {
    openMatter(matter.id, "documents");
  };

  const openComposer = () => {
    openMatter(matter.id, "messages");
  };

  const openMatterCard = () => {
    openMatter(matter.id);
  };

  const openIntakeAssignment = (request) => {
    setAssignmentIntakeRequest(request);
    setAssignmentOpen(true);
  };

  const openConvertedMatter = (matterId) => {
    openMatter(matterId);
  };

  const openNotification = (notification) => {
    openMatter(notification.matterId, notification.targetView);
  };

  return (
    <div className={styles.workspace}>
      <StaffNavigation
        activeView={activeView === "matter" ? location.from : activeView}
        counts={navCounts}
        items={navigationItems}
        moreItems={moreNavigationItems}
        onSelect={selectView}
      />

      <section className={styles.content} ref={mainRef} tabIndex={-1} aria-label={viewCopy.title}>
        <header className={styles.contentHeader}>
          <div>
            <p className={styles.eyebrow}>{viewCopy.eyebrow}</p>
            <h1>{viewCopy.title}</h1>
            <p className={styles.todayLabel}>
              {activeView === "matter" ? matter?.reference : activeView === "today"
                ? todayLabel
                : activeView === "inbox"
                  ? `${initialIntakeRequests.length} заявок в журнале`
                  : `${searchedMatters.length} дел в текущей выборке`}
            </p>
          </div>
          <div className={styles.headerTools}>
            <NotificationCenter notifications={initialNotifications} onOpen={openNotification} />
            {activeView !== "matter" ? <label className={styles.searchField}>
              <span className={styles.visuallyHidden}>{activeView === "inbox" ? "Поиск по заявкам" : "Поиск по делам"}</span>
              <input
                type="search"
                value={searchQuery}
                placeholder={activeView === "inbox" ? "Поиск по имени, телефону или запросу" : "Поиск по делу или номеру"}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label> : null}
            {assignmentOrganizations.length ? (
              <button
                className={activeView === "matter" ? styles.secondaryButton : styles.newMatterButton}
                ref={newMatterButtonRef}
                type="button"
                onClick={() => {
                  setAssignmentIntakeRequest(null);
                  setAssignmentOpen(true);
                }}
              >
                Новое дело
              </button>
            ) : null}
          </div>
        </header>

        {activeView === "matter" ? (
          <div className={styles.matterWorkspace}>
            <button ref={backButtonRef} className={styles.backButton} type="button" onClick={closeMatter}>Назад</button>
            <StaffMatterWorkspace
              matter={matter}
              organizationLabel={organizationLabel}
              assignmentStaff={assignmentStaff}
              workflowDraft={workflowDraft}
              workflowFeedback={workflowFeedback}
              isUpdatingWorkflow={isUpdatingWorkflow}
              downloadingId={downloadingId}
              documentFeedback={documentFeedback}
              onWorkflowChange={handleWorkflowChange}
              onAssignmentChange={handleAssignmentChange}
              onWorkflowClose={closeWorkflow}
              onWorkflowSubmit={handleWorkflowSubmit}
              onDownload={handleDocumentDownload}
              documentsRef={documentsRef}
              messageInputRef={messageInputRef}
              composerOpen={composerOpen}
              draft={draft}
              feedback={feedback}
              isSending={isSending}
              onDraftChange={handleDraftChange}
              onSubmit={handleSubmit}
              onOpenDocuments={openDocuments}
              onOpenComposer={openComposer}
              onOpenCard={openMatterCard}
              canEditDetails={canEditDetails}
              detailsButtonRef={detailsButtonRef}
              onOpenDetails={() => setDetailsOpen(true)}
            />
          </div>
        ) : null}

        {activeView === "today" ? (
          <div className={styles.dashboardGrid}>
            <div className={styles.queuePanel}>
              {actionMatters.length || waitingMatters.length || pausedMatters.length ? (
                <StaffTaskList action={actionMatters} waiting={waitingMatters} paused={pausedMatters} onOpenMatter={openMatter} />
              ) : (
                <EmptyState title="На сегодня задач нет" text={searchQuery ? "По вашему запросу активные дела не найдены." : "Новые задачи появятся здесь автоматически."} />
              )}
            </div>
          </div>
        ) : null}

        {activeView === "inbox" ? (
          <StaffIntakePanel
            requests={initialIntakeRequests}
            searchQuery={searchQuery}
            assignmentOrganizations={assignmentOrganizations}
            onCreateMatter={openIntakeAssignment}
            onOpenMatter={openConvertedMatter}
          />
        ) : null}

        {activeView === "matters" ? (
          <>
            <div className={styles.filterBar} aria-label="Фильтр реестра">
              {REGISTER_FILTERS.map((filter) => (
                <button
                  className={registerFilter === filter.id ? styles.isActive : ""}
                  type="button"
                  key={filter.id}
                  aria-pressed={registerFilter === filter.id}
                  onClick={() => setRegisterFilter(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className={styles.registryGrid}>
              <RegisterList matters={registerMatters} onSelect={openMatter} />
            </div>
          </>
        ) : null}

        {activeView === "clients" || activeView === "documents" || activeView === "messages" ? (
          <div className={styles.registryGrid}>
            <div>
              {activeView === "clients" ? (
                <p className={styles.collectionIntro}>Клиентские данные доступны только внутри разрешённых дел. Выберите запись, чтобы открыть рабочую карточку.</p>
              ) : null}
              <CollectionList
                type={activeView}
                matters={searchedMatters}
                onSelect={selectCollectionMatter}
              />
            </div>
          </div>
        ) : null}

        {activeView === "audit" ? (
          <div className={styles.registryGrid}>
            <AuditList events={auditEvents} matters={initialMatters} />
          </div>
        ) : null}
      </section>

      {assignmentOpen ? (
        <StaffAssignmentForm
          key={assignmentIntakeRequest?.id ?? "manual-assignment"}
          organizations={assignmentOrganizations}
          intakeRequest={assignmentIntakeRequest}
          onClose={closeAssignment}
          onCreated={(matterId, message) => {
            setPendingCreatedMatter({ matterId, origin: location });
            setToast(message);
            router.refresh();
          }}
        />
      ) : null}

      {detailsOpen && matter && canEditDetails ? (
        <StaffMatterDetailsForm
          key={matter.id}
          matter={matter}
          onClose={closeDetails}
          onSaved={(message) => {
            closeDetails();
            setToast(message);
            router.refresh();
          }}
        />
      ) : null}

      <p className={`${styles.toast}${toast ? ` ${styles.toastVisible}` : ""}`} role="status" aria-live="polite">
        {toast}
      </p>
    </div>
  );
}
