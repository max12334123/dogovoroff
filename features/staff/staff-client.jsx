"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createUuidV4 } from "../../lib/submission-id.mjs";
import { DOCUMENT_BUCKET } from "../cabinet/cabinet-write-domain.mjs";
import { sendMatterMessage } from "../cabinet/cabinet-actions";
import { getMatterById } from "../cabinet/cabinet-data.mjs";
import { validateMatterMessage } from "../cabinet/cabinet-write-domain.mjs";
import StaffAssignmentForm from "./staff-assignment-form";
import StaffIntakePanel from "./staff-intake-panel";
import StaffMatterDetailsForm from "./staff-matter-details-form";
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
};

const REGISTER_FILTERS = [
  { id: "all", label: "Все" },
  { id: "action", label: "Требуют действия" },
  { id: "waiting", label: "Ожидают клиента" },
  { id: "paused", label: "Приостановлены" },
  { id: "archive", label: "Архив" },
];

const MATTER_STATUS_OPTIONS = [
  { value: "active", label: "Активное дело" },
  { value: "paused", label: "Приостановлено" },
  { value: "completed", label: "Завершено" },
  { value: "archived", label: "В архиве" },
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

function getMatterTask(matter) {
  if (matter.nextAction) {
    return matter.nextAction.title;
  }

  return matter.stages[matter.currentStage]?.title || "Продолжить работу по делу";
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

function QueueSection({ title, matters, activeMatterId, onSelect, queueId = "action", waiting = false }) {
  if (!matters.length) return null;

  return (
    <section className={styles.queueSection} aria-labelledby={`queue-${queueId}`}>
      <h2 id={`queue-${queueId}`}>
        {title} <span>· {matters.length}</span>
      </h2>
      <div className={styles.queueList}>
        {matters.map((matter, index) => {
          const active = matter.id === activeMatterId;
          return (
            <button
              className={`${styles.queueRow}${active ? ` ${styles.isActive}` : ""}`}
              key={matter.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(matter.id)}
            >
              <span className={styles.queueIndex}>{String(index + 1).padStart(2, "0")}</span>
              <span className={styles.queueMatter}>
                <strong>{matter.title}</strong>
                <small>{matter.reference}</small>
              </span>
              <span className={styles.queueTask}>{getMatterTask(matter)}</span>
              <span className={styles.queueDue}>{waiting ? matter.nextAction?.deadline || matter.responseBy : matter.responseBy}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MatterStages({ matter }) {
  if (!matter.stages.length) {
    return <p className={styles.muted}>Этапы по делу ещё не добавлены.</p>;
  }

  return (
    <ol className={styles.stageList}>
      {matter.stages.map((stage, index) => (
        <li className={styles[`stage_${stage.status}`]} key={stage.id ?? `${stage.title}-${index}`}>
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
            <strong>{message.sender}</strong>
            <time>{message.date}</time>
          </div>
          <p>{message.text}</p>
        </li>
      ))}
    </ol>
  );
}

function MatterDetail({
  matter,
  organizationLabel,
  assignmentStaff,
  workflowDraft,
  workflowFeedback,
  isUpdatingWorkflow,
  downloadingId,
  documentFeedback,
  onWorkflowChange,
  onAssignmentChange,
  onWorkflowSubmit,
  onDownload,
  documentsRef,
  messageInputRef,
  composerOpen,
  draft,
  feedback,
  isSending,
  onDraftChange,
  onSubmit,
  onOpenDocuments,
  onOpenComposer,
  onOpenCard,
  canEditDetails,
  detailsButtonRef,
  onOpenDetails,
}) {
  if (!matter) {
    return (
      <aside className={styles.detailPanel} aria-label="Карточка дела">
        <p className={styles.eyebrow}>Карточка дела</p>
        <h2>Выберите дело</h2>
        <p className={styles.muted}>Здесь появятся этапы, документы и доступные действия.</p>
      </aside>
    );
  }

  return (
    <aside className={styles.detailPanel} aria-labelledby="staff-matter-title">
      <div className={styles.detailIntro}>
        <p className={styles.eyebrow}>{matter.reference}</p>
        <h2 id="staff-matter-title">{getMatterTask(matter)}</h2>
        <p>{matter.title}</p>
      </div>

      <dl className={styles.matterMeta}>
        <div><dt>Статус</dt><dd>{matter.stateLabel}</dd></div>
        <div><dt>Срок ответа</dt><dd>{matter.responseBy}</dd></div>
        <div><dt>Организация</dt><dd>{organizationLabel}</dd></div>
        <div><dt>Обновлено</dt><dd>{matter.updated || "Недавно"}</dd></div>
      </dl>

      <section className={styles.detailSection} aria-labelledby="staff-stages-title">
        <p className={styles.eyebrow} id="staff-stages-title">Этапы дела</p>
        <MatterStages matter={matter} />
      </section>

      {matter.nextAction ? (
        <section className={styles.nextAction} aria-labelledby="staff-next-action-title">
          <p className={styles.eyebrow}>Ожидаем от клиента</p>
          <h3 id="staff-next-action-title">{matter.nextAction.title}</h3>
          <p>{matter.nextAction.description}</p>
          {matter.nextAction.deadline ? <small>{matter.nextAction.deadline}</small> : null}
        </section>
      ) : null}

      <section className={styles.workflowSection} aria-labelledby="staff-workflow-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Управление</p>
            <h3 id="staff-workflow-title">Рабочий статус</h3>
          </div>
          <span>Команда</span>
        </div>
        <form className={styles.workflowForm} onSubmit={onWorkflowSubmit}>
          <label>
            <span>Статус дела</span>
            <select value={workflowDraft.status} onChange={(event) => onWorkflowChange("status", event.target.value)} disabled={isUpdatingWorkflow}>
              {MATTER_STATUS_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            <span>Текущий этап</span>
            <select value={workflowDraft.stageId} onChange={(event) => onWorkflowChange("stageId", event.target.value)} disabled={isUpdatingWorkflow}>
              <option value="">Не менять этап</option>
              {matter.stages.map((stage) => <option value={stage.id} key={stage.id}>{stage.title}</option>)}
            </select>
          </label>
          <label>
            <span>Следующий шаг клиента</span>
            <input
              value={workflowDraft.nextActionTitle}
              maxLength={240}
              placeholder="Например, загрузить договор"
              disabled={isUpdatingWorkflow}
              onChange={(event) => onWorkflowChange("nextActionTitle", event.target.value)}
            />
          </label>
          <label>
            <span>Описание шага</span>
            <textarea
              value={workflowDraft.nextActionDescription}
              maxLength={2000}
              rows={3}
              placeholder="Что нужно сделать клиенту"
              disabled={isUpdatingWorkflow}
              onChange={(event) => onWorkflowChange("nextActionDescription", event.target.value)}
            />
          </label>
          <label>
            <span>Срок следующего шага</span>
            <input
              type="date"
              value={workflowDraft.nextActionDueAt}
              disabled={isUpdatingWorkflow}
              onChange={(event) => onWorkflowChange("nextActionDueAt", event.target.value)}
            />
          </label>
          {assignmentStaff.length ? (
            <label>
              <span>Ответственный сотрудник</span>
              <select
                value={workflowDraft.assignmentTouched ? (workflowDraft.assignedLawyerId || "__none__") : "__keep__"}
                disabled={isUpdatingWorkflow}
                onChange={(event) => onAssignmentChange(event.target.value)}
              >
                <option value="__keep__">Оставить текущее назначение</option>
                <option value="__none__">Снять персональное назначение</option>
                {assignmentStaff.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}
              </select>
              <small>Изменение доступно только администраторам организации.</small>
            </label>
          ) : null}
          <button className={styles.primaryButton} type="submit" disabled={isUpdatingWorkflow}>
            {isUpdatingWorkflow ? "Сохраняем…" : "Сохранить рабочий статус"}
          </button>
          <p className={`${styles.feedback}${workflowFeedback.tone === "error" ? ` ${styles.feedbackError}` : ""}`} role="status" aria-live="polite">
            {workflowFeedback.text}
          </p>
        </form>
      </section>

      <div className={styles.detailActions}>
        <button className={styles.primaryButton} type="button" onClick={onOpenDocuments}>Открыть документы</button>
        <button className={styles.textButton} type="button" onClick={onOpenComposer}>Написать клиенту</button>
        <button className={styles.textButton} type="button" onClick={onOpenCard}>Открыть карточку дела</button>
        {canEditDetails ? (
          <button className={styles.textButton} ref={detailsButtonRef} type="button" onClick={onOpenDetails}>
            Редактировать реквизиты
          </button>
        ) : null}
      </div>

      <section className={styles.documentSection} ref={documentsRef} tabIndex="-1" aria-labelledby="staff-documents-title">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>Документы</p>
          <span>{matter.documents.length}</span>
        </div>
        <h3 className={styles.visuallyHidden} id="staff-documents-title">Документы по делу</h3>
        {matter.documents.length ? (
          <ul className={styles.documentList}>
            {matter.documents.map((document) => (
              <li key={document.id}>
                <button
                  className={styles.documentDownload}
                  type="button"
                  disabled={downloadingId === document.id}
                  onClick={() => onDownload(document)}
                >
                  <span>{document.name}</span>
                  <small>{downloadingId === document.id ? "Загрузка…" : "Скачать"}</small>
                </button>
                <small>{document.status} · {document.updated}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>Документы по делу ещё не загружены.</p>
        )}
        {documentFeedback.text ? (
          <p className={`${styles.feedback}${documentFeedback.tone === "error" ? ` ${styles.feedbackError}` : ""}`} role="status" aria-live="polite">
            {documentFeedback.text}
          </p>
        ) : null}
      </section>

      {composerOpen ? (
        <section className={styles.messages} aria-labelledby="staff-messages-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Связь</p>
              <h3 id="staff-messages-title">Сообщения по делу</h3>
            </div>
            <span>{matter.messages.length}</span>
          </div>
          <MessageHistory messages={matter.messages} />
          <form className={styles.composer} onSubmit={onSubmit}>
            <label htmlFor="staff-message">Сообщение клиенту</label>
            <textarea
              id="staff-message"
              ref={messageInputRef}
              value={draft}
              maxLength={2000}
              rows={5}
              placeholder="Кратко опишите следующий шаг или ответ"
              disabled={isSending}
              onChange={(event) => onDraftChange(event.target.value)}
            />
            <button className={styles.primaryButton} type="submit" disabled={isSending}>
              {isSending ? "Отправка…" : "Отправить сообщение"}
            </button>
            <p className={`${styles.feedback}${feedback.tone === "error" ? ` ${styles.feedbackError}` : ""}`} role="status" aria-live="polite">
              {feedback.text}
            </p>
          </form>
        </section>
      ) : null}
    </aside>
  );
}

function RegisterList({ matters, activeMatterId, onSelect }) {
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
            className={`${styles.registerRow}${matter.id === activeMatterId ? ` ${styles.isActive}` : ""}`}
            type="button"
            key={matter.id}
            aria-pressed={matter.id === activeMatterId}
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

function CollectionList({ type, matters, activeMatterId, onSelect }) {
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
          <button className={matter.id === activeMatterId ? styles.isActive : ""} type="button" key={matter.id} onClick={() => onSelect(matter.id)}>
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
        <button className={matter.id === activeMatterId ? styles.isActive : ""} type="button" key={matter.id} onClick={() => onSelect(matter.id)}>
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
  const [activeView, setActiveView] = useState("today");
  const [activeMatterId, setActiveMatterId] = useState(
    initialMatters.find((item) => item.state === "active")?.id ?? initialMatters[0]?.id ?? null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [registerFilter, setRegisterFilter] = useState("all");
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assignmentIntakeRequest, setAssignmentIntakeRequest] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState({ tone: "neutral", text: "" });
  const [workflowFeedback, setWorkflowFeedback] = useState({ tone: "neutral", text: "" });
  const [workflowDraft, setWorkflowDraft] = useState(() => getWorkflowDraft(initialMatters[0]));
  const [isUpdatingWorkflow, setIsUpdatingWorkflow] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [documentFeedback, setDocumentFeedback] = useState({ tone: "neutral", text: "" });
  const [toast, setToast] = useState("");
  const [isSending, setIsSending] = useState(false);

  const resolvedMatterId = initialMatters.some((item) => item.id === activeMatterId)
    ? activeMatterId
    : initialMatters[0]?.id ?? null;
  const matter = useMemo(() => getMatterById(resolvedMatterId, initialMatters), [resolvedMatterId, initialMatters]);
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

  const selectView = (viewId) => {
    setActiveView(viewId);
    if (viewId === "today" && getStaffMatterQueue(matter) === "archive") {
      setActiveMatterId(initialMatters.find((item) => getStaffMatterQueue(item) !== "archive")?.id ?? null);
    }
  };

  const selectMatter = (matterId) => {
    setActiveMatterId(matterId);
    setDraft("");
    setComposerOpen(false);
    setDetailsOpen(false);
    messageIdRef.current = null;
    setFeedback({ tone: "neutral", text: "" });
  };

  const selectCollectionMatter = (matterId) => {
    selectMatter(matterId);
    if (activeView === "messages") {
      setComposerOpen(true);
      requestAnimationFrame(() => messageInputRef.current?.focus());
    }
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
    documentsRef.current?.scrollIntoView({ behavior: getPreferredScrollBehavior(), block: "start" });
    documentsRef.current?.focus({ preventScroll: true });
  };

  const openComposer = () => {
    setComposerOpen(true);
    requestAnimationFrame(() => messageInputRef.current?.focus());
  };

  const openMatterCard = () => {
    setActiveView("matters");
    window.scrollTo({ top: 0, behavior: getPreferredScrollBehavior() });
  };

  const openIntakeAssignment = (request) => {
    setAssignmentIntakeRequest(request);
    setAssignmentOpen(true);
  };

  const openConvertedMatter = (matterId) => {
    setActiveMatterId(matterId);
    setActiveView("matters");
    window.scrollTo({ top: 0, behavior: getPreferredScrollBehavior() });
  };

  const showDetail = () => (
    <MatterDetail
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
  );

  return (
    <div className={styles.workspace}>
      <aside className={styles.rail} aria-label="Разделы рабочей панели">
        <nav>
          {navigation.map((item) => {
            const active = activeView === item.id;
            return (
              <button
                className={`${styles.railButton}${active ? ` ${styles.isActive}` : ""}`}
                type="button"
                key={item.id}
                aria-current={active ? "page" : undefined}
                onClick={() => selectView(item.id)}
              >
                <span>{item.label}</span>
                {navCounts[item.id] !== null ? <small>{navCounts[item.id]}</small> : null}
              </button>
            );
          })}
        </nav>
        <a className={styles.railCabinetLink} href="/cabinet">Личный кабинет</a>
      </aside>

      <section className={styles.content}>
        <header className={styles.contentHeader}>
          <div>
            <p className={styles.eyebrow}>{viewCopy.eyebrow}</p>
            <h1>{viewCopy.title}</h1>
            <p className={styles.todayLabel}>
              {activeView === "today"
                ? todayLabel
                : activeView === "inbox"
                  ? `${initialIntakeRequests.length} заявок в журнале`
                  : `${searchedMatters.length} дел в текущей выборке`}
            </p>
          </div>
          <div className={styles.headerTools}>
            <label className={styles.searchField}>
              <span className={styles.visuallyHidden}>{activeView === "inbox" ? "Поиск по заявкам" : "Поиск по делам"}</span>
              <input
                type="search"
                value={searchQuery}
                placeholder={activeView === "inbox" ? "Поиск по имени, телефону или запросу" : "Поиск по делу или номеру"}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>
            {assignmentOrganizations.length ? (
              <button
                className={styles.newMatterButton}
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

        {activeView === "today" ? (
          <div className={styles.dashboardGrid}>
            <div className={styles.queuePanel}>
              {actionMatters.length || waitingMatters.length || pausedMatters.length ? (
                <>
                  <QueueSection queueId="action" title="Требуют вашего действия" matters={actionMatters} activeMatterId={resolvedMatterId} onSelect={selectMatter} />
                  <QueueSection queueId="waiting" title="Ожидают клиента" matters={waitingMatters} activeMatterId={resolvedMatterId} onSelect={selectMatter} waiting />
                  <QueueSection queueId="paused" title="Приостановлены" matters={pausedMatters} activeMatterId={resolvedMatterId} onSelect={selectMatter} />
                </>
              ) : (
                <EmptyState title="На сегодня задач нет" text={searchQuery ? "По вашему запросу активные дела не найдены." : "Новые задачи появятся здесь автоматически."} />
              )}
            </div>
            {showDetail()}
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
              <RegisterList matters={registerMatters} activeMatterId={resolvedMatterId} onSelect={selectMatter} />
              {showDetail()}
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
                activeMatterId={resolvedMatterId}
                onSelect={selectCollectionMatter}
              />
            </div>
            {showDetail()}
          </div>
        ) : null}

        {activeView === "audit" ? (
          <div className={styles.registryGrid}>
            <AuditList events={auditEvents} matters={initialMatters} />
            {showDetail()}
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
            setActiveMatterId(matterId);
            setActiveView("today");
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
