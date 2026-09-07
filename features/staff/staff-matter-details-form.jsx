"use client";

import { useRef, useState } from "react";
import { useDialogFocus, useDraftRegistration } from "./staff-workspace-ui";
import { updateMatterDetails } from "./staff-actions";
import {
  MAX_MATTER_REFERENCE_LENGTH,
  MAX_MATTER_SUMMARY_LENGTH,
  MAX_MATTER_TITLE_LENGTH,
  validateMatterDetails,
} from "./staff-matter-details-domain.mjs";
import styles from "./staff.module.css";

function getDateInputValue(value) {
  return typeof value === "string" && value.length >= 10 ? value.slice(0, 10) : "";
}

function getInitialForm(matter) {
  return {
    matterId: matter?.id ?? "",
    reference: matter?.reference ?? "",
    title: matter?.title ?? "",
    summary: matter?.detailsSummary ?? matter?.summary ?? "",
    responseDueAt: getDateInputValue(matter?.responseDueAt),
  };
}

export default function StaffMatterDetailsForm({ matter, onSaved, onClose, draftRegistry, confirmation, returnFocusRef }) {
  const dialogRef = useRef(null);
  const referenceRef = useRef(null);
  const [form, setForm] = useState(() => getInitialForm(matter));
  const [feedback, setFeedback] = useState({ tone: "neutral", text: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const initialForm = useRef(form).current;
  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  useDialogFocus(dialogRef, () => { if (!isSubmitting) onClose(); }, returnFocusRef);
  useDraftRegistration(draftRegistry, "details", dirty, isSubmitting);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (feedback.text) {
      setFeedback({ tone: "neutral", text: "" });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    const validation = validateMatterDetails(form);
    if (!validation.valid) {
      setFeedback({ tone: "error", text: validation.error });
      return;
    }

    setIsSubmitting(true);
    setFeedback({ tone: "neutral", text: "Сохраняем реквизиты…" });

    try {
      const result = await updateMatterDetails(validation.value);
      if (!result.ok) {
        setFeedback({ tone: "error", text: result.message });
        return;
      }

      onSaved?.(result.message, result.matterId);
    } catch {
      setFeedback({ tone: "error", text: "Не удалось обновить реквизиты дела. Попробуйте ещё раз." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.drawerBackdrop}>
      <section
        className={styles.assignmentDrawer}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="staff-matter-details-title"
        tabIndex={-1}
      >
        <header className={styles.drawerHeader}>
          <div>
            <p className={styles.eyebrow}>Реквизиты дела</p>
            <h2 id="staff-matter-details-title">Редактировать дело</h2>
          </div>
          <button className={styles.drawerClose} type="button" onClick={onClose} disabled={isSubmitting}>
            Закрыть
          </button>
        </header>

        {confirmation}
        <form className={styles.assignmentForm} onSubmit={handleSubmit} hidden={Boolean(confirmation)}>
          <p className={styles.detailsHint}>
            Доступно только администраторам организации. Изменение реквизитов не меняет статус, этапы, документы и сообщения дела.
          </p>

          <div className={styles.drawerFields}>
            <label className={styles.drawerField}>
              <span>Номер дела</span>
              <input
                ref={referenceRef}
                value={form.reference}
                maxLength={MAX_MATTER_REFERENCE_LENGTH}
                autoComplete="off"
                disabled={isSubmitting}
                onChange={(event) => updateField("reference", event.target.value)}
                required
              />
            </label>

            <label className={styles.drawerField}>
              <span>Название дела</span>
              <input
                value={form.title}
                maxLength={MAX_MATTER_TITLE_LENGTH}
                disabled={isSubmitting}
                onChange={(event) => updateField("title", event.target.value)}
                required
              />
            </label>

            <label className={styles.drawerField}>
              <span>Краткое описание</span>
              <textarea
                value={form.summary}
                maxLength={MAX_MATTER_SUMMARY_LENGTH}
                rows={7}
                disabled={isSubmitting}
                onChange={(event) => updateField("summary", event.target.value)}
              />
            </label>

            <label className={styles.drawerField}>
              <span>Срок ответа</span>
              <input
                type="date"
                value={form.responseDueAt}
                disabled={isSubmitting}
                onChange={(event) => updateField("responseDueAt", event.target.value)}
              />
              <small>Оставьте поле пустым, если срок ещё не определён.</small>
            </label>
          </div>

          <p className={`${styles.assignmentFeedback}${feedback.tone === "error" ? ` ${styles.assignmentFeedbackError}` : ""}`} role="status" aria-live="polite">
            {feedback.text}
          </p>

          <footer className={styles.drawerFooter}>
            <button className={styles.secondaryButton} type="button" onClick={onClose} disabled={isSubmitting}>
              Отмена
            </button>
            <button className={styles.primaryButton} type="submit" disabled={isSubmitting || !dirty}>
              {isSubmitting ? "Сохраняем…" : "Сохранить реквизиты"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
