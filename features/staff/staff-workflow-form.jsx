import styles from "./staff.module.css";

const MATTER_STATUS_OPTIONS = [
  { value: "active", label: "Активное дело" },
  { value: "paused", label: "Приостановлено" },
  { value: "completed", label: "Завершено" },
  { value: "archived", label: "В архиве" },
];

export default function StaffWorkflowForm({
  assignmentStaff,
  canAssign = false,
  draft,
  feedback,
  isSubmitting,
  isDirty = true,
  matter,
  onAssignmentChange,
  onChange,
  onClose,
  onSubmit,
}) {
  return (
    <section className={styles.workflowSection} aria-labelledby="staff-workflow-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Управление</p>
          <h3 id="staff-workflow-title">Изменить этап и следующий шаг</h3>
        </div>
        <span>Команда</span>
      </div>
      <form className={styles.workflowForm} onSubmit={onSubmit}>
        <label>
          <span>Статус дела</span>
          <select value={draft.status} onChange={(event) => onChange("status", event.target.value)} disabled={isSubmitting}>
            {MATTER_STATUS_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>
          <span>Текущий этап</span>
          <select value={draft.stageId} onChange={(event) => onChange("stageId", event.target.value)} disabled={isSubmitting}>
            <option value="">Не менять этап</option>
            {matter.stages.map((stage) => <option value={stage.id} key={stage.id}>{stage.title}</option>)}
          </select>
        </label>
        <label>
          <span>Следующий шаг клиента</span>
          <input value={draft.nextActionTitle} maxLength={240} placeholder="Например, загрузить договор" disabled={isSubmitting} onChange={(event) => onChange("nextActionTitle", event.target.value)} />
        </label>
        <label>
          <span>Описание шага</span>
          <textarea value={draft.nextActionDescription} maxLength={2000} rows={3} placeholder="Что нужно сделать клиенту" disabled={isSubmitting} onChange={(event) => onChange("nextActionDescription", event.target.value)} />
        </label>
        <label>
          <span>Срок следующего шага</span>
          <input type="date" value={draft.nextActionDueAt} disabled={isSubmitting} onChange={(event) => onChange("nextActionDueAt", event.target.value)} />
        </label>
        {canAssign ? (
          <label>
            <span>Ответственный сотрудник</span>
            <select value={draft.assignmentTouched ? (draft.assignedLawyerId || "__none__") : "__keep__"} disabled={isSubmitting} onChange={(event) => onAssignmentChange(event.target.value)}>
              <option value="__keep__">Оставить текущее назначение</option>
              <option value="__none__">Снять персональное назначение</option>
              {assignmentStaff.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}
            </select>
            <small>Изменение доступно только администраторам организации.</small>
          </label>
        ) : null}
        <div className={styles.detailActions}>
          <button className={styles.textButton} type="button" onClick={onClose} disabled={isSubmitting}>Отмена</button>
          <button className={styles.primaryButton} type="submit" disabled={isSubmitting || !isDirty}>{isSubmitting ? "Сохраняем…" : "Сохранить изменения"}</button>
        </div>
        <p className={`${styles.feedback}${feedback.tone === "error" ? ` ${styles.feedbackError}` : ""}`} role="status" aria-live="polite">{feedback.text}</p>
      </form>
    </section>
  );
}
