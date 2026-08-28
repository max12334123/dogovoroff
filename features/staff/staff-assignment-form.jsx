"use client";

import { useMemo, useState } from "react";
import { createMatterAssignment } from "./staff-actions";
import { validateMatterAssignment } from "./staff-assignment-domain.mjs";
import styles from "./staff.module.css";

const DEFAULT_FORM = {
  organizationId: "",
  clientEmail: "",
  reference: "",
  title: "",
  summary: "",
  lawyerId: "",
  stageTitle: "Первичная проверка",
  stageDetail: "",
  nextActionTitle: "",
  nextActionDescription: "",
};

function roleLabel(role) {
  return role === "admin" ? "Администратор" : "Юрист";
}

export default function StaffAssignmentForm({ organizations, onCreated }) {
  const firstOrganizationId = organizations[0]?.id ?? "";
  const [form, setForm] = useState(() => ({
    ...DEFAULT_FORM,
    organizationId: firstOrganizationId,
  }));
  const [feedback, setFeedback] = useState({ tone: "neutral", text: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeOrganization = useMemo(
    () => organizations.find((organization) => organization.id === form.organizationId) ?? organizations[0],
    [form.organizationId, organizations],
  );

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (feedback.text) {
      setFeedback({ tone: "neutral", text: "" });
    }
  };

  const updateOrganization = (organizationId) => {
    setForm((current) => ({
      ...current,
      organizationId,
      lawyerId: "",
    }));
    setFeedback({ tone: "neutral", text: "" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    const validation = validateMatterAssignment(form);
    if (!validation.valid) {
      setFeedback({ tone: "error", text: validation.error });
      return;
    }

    setIsSubmitting(true);
    setFeedback({ tone: "neutral", text: "Создаём дело и проверяем назначение…" });

    try {
      const result = await createMatterAssignment(validation.value);
      if (!result.ok) {
        setFeedback({ tone: "error", text: result.message });
        return;
      }

      setForm((current) => ({
        ...DEFAULT_FORM,
        organizationId: current.organizationId,
      }));
      setFeedback({ tone: "success", text: result.message });
      onCreated?.(result.matterId);
    } catch {
      setFeedback({ tone: "error", text: "Не удалось создать дело. Попробуйте ещё раз." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className={styles.assignmentPanel} aria-labelledby="staff-assignment-title">
      <div className={styles.assignmentIntro}>
        <p className={styles.eyebrow}>Управление доступом</p>
        <h2 id="staff-assignment-title">Назначить дело клиенту</h2>
        <p>
          Клиент должен предварительно войти по подтверждённому email. После создания дело сразу появится в его личном кабинете.
        </p>
      </div>

      <form className={styles.assignmentForm} onSubmit={handleSubmit}>
        <div className={styles.assignmentFields}>
          <label>
            <span>Организация</span>
            <select
              value={form.organizationId}
              disabled={isSubmitting}
              onChange={(event) => updateOrganization(event.target.value)}
              required
            >
              {organizations.map((organization) => (
                <option value={organization.id} key={organization.id}>{organization.name}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Email клиента</span>
            <input
              type="email"
              value={form.clientEmail}
              autoComplete="off"
              inputMode="email"
              maxLength={254}
              placeholder="client@example.ru"
              disabled={isSubmitting}
              onChange={(event) => updateField("clientEmail", event.target.value)}
              required
            />
          </label>

          <label>
            <span>Номер дела</span>
            <input
              value={form.reference}
              maxLength={80}
              placeholder="ДО-2026-001"
              disabled={isSubmitting}
              onChange={(event) => updateField("reference", event.target.value)}
              required
            />
          </label>

          <label>
            <span>Ответственный</span>
            <select
              value={form.lawyerId}
              disabled={isSubmitting}
              onChange={(event) => updateField("lawyerId", event.target.value)}
            >
              <option value="">Без ответственного</option>
              {(activeOrganization?.staff ?? []).map((member) => (
                <option value={member.id} key={member.id}>
                  {member.name} · {roleLabel(member.role)}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.assignmentWideField}>
            <span>Название дела</span>
            <input
              value={form.title}
              maxLength={240}
              placeholder="Например, проверка договора поставки"
              disabled={isSubmitting}
              onChange={(event) => updateField("title", event.target.value)}
              required
            />
          </label>

          <label className={styles.assignmentWideField}>
            <span>Краткое описание</span>
            <textarea
              value={form.summary}
              maxLength={5000}
              rows={3}
              placeholder="Что входит в задачу и какой результат ожидается"
              disabled={isSubmitting}
              onChange={(event) => updateField("summary", event.target.value)}
            />
          </label>

          <label>
            <span>Первый этап</span>
            <input
              value={form.stageTitle}
              maxLength={200}
              disabled={isSubmitting}
              onChange={(event) => updateField("stageTitle", event.target.value)}
              required
            />
          </label>

          <label>
            <span>Описание этапа</span>
            <input
              value={form.stageDetail}
              maxLength={1000}
              placeholder="Что делает команда"
              disabled={isSubmitting}
              onChange={(event) => updateField("stageDetail", event.target.value)}
            />
          </label>

          <label>
            <span>Следующий шаг клиента</span>
            <input
              value={form.nextActionTitle}
              maxLength={240}
              placeholder="Например, загрузить договор"
              disabled={isSubmitting}
              onChange={(event) => updateField("nextActionTitle", event.target.value)}
            />
          </label>

          <label>
            <span>Подсказка клиенту</span>
            <input
              value={form.nextActionDescription}
              maxLength={2000}
              placeholder="Какие файлы или сведения нужны"
              disabled={isSubmitting}
              onChange={(event) => updateField("nextActionDescription", event.target.value)}
            />
          </label>
        </div>

        <div className={styles.assignmentFooter}>
          <p
            className={`${styles.assignmentFeedback}${feedback.tone === "error" ? ` ${styles.assignmentFeedbackError}` : ""}`}
            role="status"
            aria-live="polite"
          >
            {feedback.text}
          </p>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Создаём дело…" : "Создать и назначить дело"}
          </button>
        </div>
      </form>
    </section>
  );
}
