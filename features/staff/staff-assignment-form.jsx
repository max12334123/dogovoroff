"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createMatterAssignment, createMatterFromIntakeRequest } from "./staff-actions";
import { validateMatterAssignment } from "./staff-assignment-domain.mjs";
import { getIntakeAssignmentDefaults } from "./staff-intake-domain.mjs";
import styles from "./staff.module.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createReference() {
  const now = new Date();
  const stamp = now.getTime().toString(36).slice(-6).toUpperCase();
  return `ДО-${now.getFullYear()}-${stamp}`;
}

function roleLabel(role) {
  return role === "admin" ? "Администратор" : "Юрист";
}

function validateFirstStep(form) {
  if (!form.organizationId) {
    return "Выберите организацию.";
  }

  const email = form.clientEmail.trim();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return "Укажите корректный email клиента.";
  }

  const title = form.title.trim();
  if (!title || title.length > 240) {
    return "Название дела должно содержать от 1 до 240 символов.";
  }

  return "";
}

export default function StaffAssignmentForm({ organizations, intakeRequest = null, onCreated, onClose }) {
  const intakeDefaults = getIntakeAssignmentDefaults(intakeRequest);
  const firstOrganizationId = organizations.some((organization) => organization.id === intakeDefaults.organizationId)
    ? intakeDefaults.organizationId
    : organizations[0]?.id ?? "";
  const dialogRef = useRef(null);
  const emailRef = useRef(null);
  const stageRef = useRef(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(() => ({
    organizationId: firstOrganizationId,
    clientEmail: "",
    reference: createReference(),
    title: intakeRequest ? intakeDefaults.title : "",
    summary: intakeRequest ? intakeDefaults.summary : "",
    lawyerId: "",
    stageTitle: intakeDefaults.stageTitle,
    stageDetail: intakeDefaults.stageDetail,
    nextActionTitle: intakeDefaults.nextActionTitle,
    nextActionDescription: intakeDefaults.nextActionDescription,
  }));
  const [feedback, setFeedback] = useState({ tone: "neutral", text: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeOrganization = useMemo(
    () => organizations.find((organization) => organization.id === form.organizationId) ?? organizations[0],
    [form.organizationId, organizations],
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    emailRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (step === 2) {
      stageRef.current?.focus();
    }
  }, [step]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (feedback.text) {
      setFeedback({ tone: "neutral", text: "" });
    }
  };

  const updateOrganization = (organizationId) => {
    setForm((current) => ({ ...current, organizationId, lawyerId: "" }));
    setFeedback({ tone: "neutral", text: "" });
  };

  const handleContinue = (event) => {
    event.preventDefault();
    const error = validateFirstStep(form);
    if (error) {
      setFeedback({ tone: "error", text: error });
      return;
    }

    setFeedback({ tone: "neutral", text: "" });
    setStep(2);
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
      const result = intakeRequest
        ? await createMatterFromIntakeRequest({
          ...validation.value,
          intakeRequestId: intakeRequest.id,
        })
        : await createMatterAssignment(validation.value);
      if (!result.ok) {
        setFeedback({ tone: "error", text: result.message });
        return;
      }

      onCreated?.(result.matterId, result.message);
      onClose?.();
    } catch {
      setFeedback({ tone: "error", text: "Не удалось создать дело. Попробуйте ещё раз." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDialogKeyDown = (event) => {
    if (event.key === "Escape" && !isSubmitting) {
      event.preventDefault();
      onClose?.();
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = dialogRef.current?.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [href]',
    );
    if (!focusable?.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className={styles.drawerBackdrop}>
      <section
        className={styles.assignmentDrawer}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="staff-assignment-title"
        onKeyDown={handleDialogKeyDown}
      >
        <header className={styles.drawerHeader}>
          <div>
            <p className={styles.eyebrow}>{intakeRequest ? "Входящая заявка" : "Новое дело"}</p>
            <h2 id="staff-assignment-title">{intakeRequest ? "Принять и создать дело" : "Создать и назначить"}</h2>
          </div>
          <button className={styles.drawerClose} type="button" onClick={onClose} disabled={isSubmitting}>
            Закрыть
          </button>
        </header>

        <div className={styles.stepIndicator} aria-label={`Шаг ${step} из 2`}>
          <span className={step >= 1 ? styles.stepActive : ""}>1 · Клиент и дело</span>
          <span className={step >= 2 ? styles.stepActive : ""}>2 · Статус и шаг</span>
        </div>

        <form className={styles.assignmentForm} onSubmit={step === 1 ? handleContinue : handleSubmit}>
          {organizations.length > 1 && !intakeRequest ? (
            <label className={styles.drawerField}>
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
          ) : (
            <p className={styles.organizationContext}>
              <span>Организация</span>
              <strong>{activeOrganization?.name || "ДоговорОфф"}</strong>
            </p>
          )}

          {intakeRequest ? (
            <p className={styles.intakeContext}>
              <span>Заявка от клиента</span>
              <strong>{intakeRequest.name}</strong>
              <small>{intakeRequest.phone} · {intakeRequest.service}</small>
            </p>
          ) : null}

          {step === 1 ? (
            <div className={styles.drawerFields}>
              <label className={styles.drawerField}>
                <span>Email клиента</span>
                <input
                  ref={emailRef}
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
                <small>Клиент должен заранее подтвердить вход по этому email.</small>
              </label>

              <label className={styles.drawerField}>
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

              <label className={styles.drawerField}>
                <span>Ответственный</span>
                <select
                  value={form.lawyerId}
                  disabled={isSubmitting}
                  onChange={(event) => updateField("lawyerId", event.target.value)}
                >
                  <option value="">Команда без персонального назначения</option>
                  {(activeOrganization?.staff ?? []).map((member) => (
                    <option value={member.id} key={member.id}>
                      {member.name} · {roleLabel(member.role)}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.drawerField}>
                <span>Номер дела</span>
                <input value={form.reference} readOnly aria-readonly="true" />
                <small>Номер сформирован автоматически.</small>
              </label>
            </div>
          ) : (
            <div className={styles.drawerFields}>
              <label className={styles.drawerField}>
                <span>Текущий этап</span>
                <input
                  ref={stageRef}
                  value={form.stageTitle}
                  maxLength={200}
                  disabled={isSubmitting}
                  onChange={(event) => updateField("stageTitle", event.target.value)}
                  required
                />
              </label>

              <label className={styles.drawerField}>
                <span>Следующий шаг клиента</span>
                <input
                  value={form.nextActionTitle}
                  maxLength={240}
                  placeholder="Например, загрузить договор"
                  disabled={isSubmitting}
                  onChange={(event) => updateField("nextActionTitle", event.target.value)}
                />
                <small>Оставьте пустым, если сейчас действие требуется только от команды.</small>
              </label>

              <details className={styles.optionalDetails}>
                <summary>Дополнительные сведения</summary>
                <div>
                  <label className={styles.drawerField}>
                    <span>Краткое описание</span>
                    <textarea
                      value={form.summary}
                      maxLength={5000}
                      rows={4}
                      placeholder="Что входит в задачу и какой результат ожидается"
                      disabled={isSubmitting}
                      onChange={(event) => updateField("summary", event.target.value)}
                    />
                  </label>

                  <label className={styles.drawerField}>
                    <span>Комментарий к этапу</span>
                    <textarea
                      value={form.stageDetail}
                      maxLength={1000}
                      rows={3}
                      placeholder="Что делает команда"
                      disabled={isSubmitting}
                      onChange={(event) => updateField("stageDetail", event.target.value)}
                    />
                  </label>

                  <label className={styles.drawerField}>
                    <span>Подсказка клиенту</span>
                    <textarea
                      value={form.nextActionDescription}
                      maxLength={2000}
                      rows={3}
                      placeholder="Какие файлы или сведения нужны"
                      disabled={isSubmitting}
                      onChange={(event) => updateField("nextActionDescription", event.target.value)}
                    />
                  </label>
                </div>
              </details>

              <p className={styles.clientVisibilityNote}>
                После создания клиент увидит понятный статус дела и следующий шаг — без внутренних рабочих заметок.
              </p>
            </div>
          )}

          <p
            className={`${styles.assignmentFeedback}${feedback.tone === "error" ? ` ${styles.assignmentFeedbackError}` : ""}`}
            role="status"
            aria-live="polite"
          >
            {feedback.text}
          </p>

          <footer className={styles.drawerFooter}>
            {step === 1 ? (
              <>
                <button className={styles.secondaryButton} type="button" onClick={onClose} disabled={isSubmitting}>
                  Отмена
                </button>
                <button className={styles.primaryButton} type="submit">Продолжить</button>
              </>
            ) : (
              <>
                <button className={styles.secondaryButton} type="button" onClick={() => setStep(1)} disabled={isSubmitting}>
                  Назад
                </button>
                <button className={styles.primaryButton} type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Создаём дело…" : "Создать дело"}
                </button>
              </>
            )}
          </footer>
        </form>
      </section>
    </div>
  );
}
