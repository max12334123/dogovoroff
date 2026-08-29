"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  filterStaffIntakeRequests,
  getIntakeStatusLabel,
  INTAKE_FILTERS,
} from "./staff-intake-domain.mjs";
import { updateIntakeRequestStatus } from "./staff-actions";
import styles from "./staff.module.css";

const DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Yekaterinburg",
});

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Недавно" : DATE_FORMATTER.format(date);
}

function getPhoneHref(value) {
  const normalized = String(value ?? "").replace(/[^+\d]/g, "");
  return normalized ? `tel:${normalized}` : undefined;
}

function IntakeEmpty({ searched }) {
  return (
    <section className={styles.intakeEmpty}>
      <p className={styles.eyebrow}>Входящие</p>
      <h2>{searched ? "Заявки не найдены" : "В этой очереди пока пусто"}</h2>
      <p>{searched ? "Измените поиск или фильтр." : "Новые обращения с сайта появятся здесь автоматически."}</p>
    </section>
  );
}

export default function StaffIntakePanel({
  requests = [],
  searchQuery = "",
  assignmentOrganizations = [],
  onCreateMatter,
  onOpenMatter,
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("open");
  const [selectedId, setSelectedId] = useState(
    requests.find((request) => request.status === "new")?.id ?? requests[0]?.id ?? null,
  );
  const [updating, setUpdating] = useState(false);
  const [feedback, setFeedback] = useState({ tone: "neutral", text: "" });
  const visibleRequests = useMemo(
    () => filterStaffIntakeRequests(requests, searchQuery, filter),
    [filter, requests, searchQuery],
  );
  const resolvedId = visibleRequests.some((request) => request.id === selectedId)
    ? selectedId
    : visibleRequests[0]?.id ?? null;
  const request = visibleRequests.find((item) => item.id === resolvedId) ?? null;
  const adminOrganizationIds = useMemo(
    () => new Set(assignmentOrganizations.map((organization) => organization.id)),
    [assignmentOrganizations],
  );
  const canCreateMatter = request
    && request.status !== "matter_created"
    && request.status !== "closed"
    && adminOrganizationIds.has(request.organizationId);

  const changeStatus = async (status) => {
    if (!request || updating) return;
    setUpdating(true);
    setFeedback({ tone: "neutral", text: "Сохраняем статус…" });
    try {
      const result = await updateIntakeRequestStatus({ requestId: request.id, status });
      if (!result.ok) {
        setFeedback({ tone: "error", text: result.message });
        return;
      }
      setFeedback({ tone: "success", text: result.message });
      router.refresh();
    } catch {
      setFeedback({ tone: "error", text: "Не удалось обновить заявку. Попробуйте ещё раз." });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <>
      <div className={styles.intakeFilters} aria-label="Фильтр входящих заявок">
        {INTAKE_FILTERS.map((item) => (
          <button
            className={filter === item.id ? styles.isActive : ""}
            type="button"
            key={item.id}
            aria-pressed={filter === item.id}
            onClick={() => {
              setFilter(item.id);
              setFeedback({ tone: "neutral", text: "" });
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={styles.intakeGrid}>
        <section className={styles.intakeList} aria-label="Список входящих заявок">
          {visibleRequests.length ? visibleRequests.map((item) => (
            <button
              className={`${styles.intakeRow}${item.id === resolvedId ? ` ${styles.isActive}` : ""}`}
              type="button"
              key={item.id}
              aria-pressed={item.id === resolvedId}
              onClick={() => {
                setSelectedId(item.id);
                setFeedback({ tone: "neutral", text: "" });
              }}
            >
              <span className={`${styles.intakeStatus} ${styles[`intakeStatus_${item.status}`]}`}>
                {getIntakeStatusLabel(item.status)}
              </span>
              <span className={styles.intakeRowMain}>
                <strong>{item.service}</strong>
                <small>{item.name} · {item.phone}</small>
              </span>
              <time dateTime={item.submittedAt}>{formatDate(item.submittedAt)}</time>
            </button>
          )) : <IntakeEmpty searched={Boolean(searchQuery)} />}
        </section>

        <aside className={styles.intakeDetail} aria-labelledby="staff-intake-title">
          {request ? (
            <>
              <header className={styles.intakeDetailHeader}>
                <div>
                  <p className={styles.eyebrow}>{request.organizationName || "ДоговорОфф"}</p>
                  <h2 id="staff-intake-title">{request.service}</h2>
                  <p>Получена {formatDate(request.submittedAt)}</p>
                </div>
                <span className={`${styles.intakeStatus} ${styles[`intakeStatus_${request.status}`]}`}>
                  {getIntakeStatusLabel(request.status)}
                </span>
              </header>

              <dl className={styles.intakeContact}>
                <div><dt>Имя</dt><dd>{request.name}</dd></div>
                <div>
                  <dt>Телефон</dt>
                  <dd><a href={getPhoneHref(request.phone)}>{request.phone}</a></dd>
                </div>
                <div><dt>Форма</dt><dd>{request.formMode}</dd></div>
              </dl>

              <section className={styles.intakeText} aria-labelledby="staff-intake-message-title">
                <p className={styles.eyebrow}>Сообщение клиента</p>
                <h3 id="staff-intake-message-title">Описание ситуации</h3>
                <p>{request.message || "Клиент не добавил описание."}</p>
              </section>

              {request.precheckMode && request.precheckMode !== "Не проводился" ? (
                <section className={styles.intakeText} aria-labelledby="staff-intake-precheck-title">
                  <p className={styles.eyebrow}>Черновик для команды · {request.precheckMode}</p>
                  <h3 id="staff-intake-precheck-title">Предварительный разбор</h3>
                  <p>{request.precheckExcerpt}</p>
                </section>
              ) : null}

              <div className={styles.intakeActions}>
                {request.status === "new" ? (
                  <button type="button" disabled={updating} onClick={() => changeStatus("reviewing")}>Взять в работу</button>
                ) : null}
                {request.status === "reviewing" ? (
                  <button type="button" disabled={updating} onClick={() => changeStatus("contacted")}>Связались с клиентом</button>
                ) : null}
                {request.status === "closed" ? (
                  <button type="button" disabled={updating} onClick={() => changeStatus("reviewing")}>Вернуть в работу</button>
                ) : null}
                {canCreateMatter ? (
                  <button className={styles.intakePrimaryAction} type="button" onClick={() => onCreateMatter?.(request)}>
                    Принять и создать дело
                  </button>
                ) : null}
                {request.status !== "matter_created" && request.status !== "closed" ? (
                  <button className={styles.intakeQuietAction} type="button" disabled={updating} onClick={() => changeStatus("closed")}>
                    Закрыть без дела
                  </button>
                ) : null}
                {request.status === "matter_created" && request.matterId ? (
                  <button className={styles.intakePrimaryAction} type="button" onClick={() => onOpenMatter?.(request.matterId)}>
                    Открыть созданное дело
                  </button>
                ) : null}
              </div>

              {!adminOrganizationIds.has(request.organizationId) && request.status !== "matter_created" ? (
                <p className={styles.intakePermissionNote}>Создать дело из заявки может администратор организации.</p>
              ) : null}
              <p
                className={`${styles.intakeFeedback}${feedback.tone === "error" ? ` ${styles.intakeFeedbackError}` : ""}`}
                role="status"
                aria-live="polite"
              >
                {feedback.text}
              </p>
            </>
          ) : (
            <IntakeEmpty searched={Boolean(searchQuery)} />
          )}
        </aside>
      </div>
    </>
  );
}
