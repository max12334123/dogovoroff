import StaffDocumentRequests from "../document-requests/staff-document-requests";
import StaffWorkflowForm from "./staff-workflow-form";
import styles from "./staff.module.css";

function getMatterTask(matter) {
  const requests = matter.documentRequests ?? [];
  if (requests.some((request) => request.status === "submitted")) return "Проверить комплект документов";
  if (requests.some((request) => request.status === "requested" || request.status === "changes_requested")) return "Ожидаем документы от клиента";
  if (matter.nextAction) return matter.nextAction.title;
  return matter.stages[matter.currentStage]?.title || "Продолжить работу по делу";
}

function MatterStages({ matter }) {
  if (!matter.stages.length) return <p className={styles.muted}>Этапы по делу ещё не добавлены.</p>;
  return <ol className={styles.stageList}>{matter.stages.map((stage, index) => (
    <li className={styles[`stage_${stage.status}`]} key={stage.id ?? `${stage.title}-${index}`}>
      <span>{String(index + 1).padStart(2, "0")}</span><div><strong>{stage.title}</strong><small>{stage.detail}</small></div>
    </li>
  ))}</ol>;
}

function MessageHistory({ messages }) {
  if (!messages.length) return <p className={styles.muted}>Сообщений по делу пока нет.</p>;
  return <ol className={styles.messageList}>{messages.map((message) => (
    <li key={message.id}><div><strong>{message.sender}</strong><time>{message.date}</time></div><p>{message.text}</p></li>
  ))}</ol>;
}

export default function StaffMatterWorkspace({
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
  onWorkflowClose,
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
  if (!matter) return <aside className={styles.detailPanel} aria-label="Карточка дела"><p className={styles.eyebrow}>Карточка дела</p><h2>Выберите дело</h2><p className={styles.muted}>Здесь появятся этапы, документы и доступные действия.</p></aside>;

  const otherDocuments = matter.documents.filter((document) => document.requestId === null);
  return (
    <aside className={styles.detailPanel} aria-labelledby="staff-matter-title">
      <div className={styles.detailIntro}><p className={styles.eyebrow}>{matter.reference}</p><h2 id="staff-matter-title">{getMatterTask(matter)}</h2><p>{matter.title}</p></div>
      <dl className={styles.matterMeta}>
        <div><dt>Статус</dt><dd>{matter.stateLabel}</dd></div><div><dt>Срок ответа</dt><dd>{matter.responseBy}</dd></div><div><dt>Организация</dt><dd>{organizationLabel}</dd></div><div><dt>Обновлено</dt><dd>{matter.updated || "Недавно"}</dd></div>
      </dl>
      <section className={styles.detailSection} aria-labelledby="staff-stages-title"><p className={styles.eyebrow} id="staff-stages-title">Этапы дела</p><MatterStages matter={matter} /></section>
      {matter.nextAction ? <section className={styles.nextAction} aria-labelledby="staff-next-action-title"><p className={styles.eyebrow}>Ожидаем от клиента</p><h3 id="staff-next-action-title">{matter.nextAction.title}</h3><p>{matter.nextAction.description}</p>{matter.nextAction.deadline ? <small>{matter.nextAction.deadline}</small> : null}</section> : null}
      <section className={styles.documentRequestSection} aria-label="Запросы документов"><StaffDocumentRequests matter={matter} downloadingId={downloadingId} downloadFeedback={documentFeedback} onDownload={onDownload} /></section>
      <StaffWorkflowForm assignmentStaff={assignmentStaff} draft={workflowDraft} feedback={workflowFeedback} isSubmitting={isUpdatingWorkflow} matter={matter} onAssignmentChange={onAssignmentChange} onChange={onWorkflowChange} onClose={onWorkflowClose} onSubmit={onWorkflowSubmit} />
      <div className={styles.detailActions}>
        <button className={styles.primaryButton} type="button" onClick={onOpenDocuments}>Открыть документы</button><button className={styles.textButton} type="button" onClick={onOpenComposer}>Написать клиенту</button><button className={styles.textButton} type="button" onClick={onOpenCard}>Открыть карточку дела</button>
        {canEditDetails ? <button className={styles.textButton} ref={detailsButtonRef} type="button" onClick={onOpenDetails}>Редактировать реквизиты</button> : null}
      </div>
      <section className={styles.documentSection} ref={documentsRef} tabIndex="-1" aria-labelledby="staff-documents-title">
        <div className={styles.sectionHeading}><p className={styles.eyebrow}>Другие документы</p><span>{otherDocuments.length}</span></div><h3 className={styles.visuallyHidden} id="staff-documents-title">Другие документы по делу</h3>
        {otherDocuments.length ? <ul className={styles.documentList}>{otherDocuments.map((document) => <li key={document.id}><button className={styles.documentDownload} type="button" disabled={downloadingId === document.id} onClick={() => onDownload(document)}><span>{document.name}</span><small>{downloadingId === document.id ? "Загрузка…" : "Скачать"}</small></button><small>{document.status} · {document.updated}</small></li>)}</ul> : <p className={styles.muted}>Других документов пока нет.</p>}
      </section>
      {composerOpen ? <section className={styles.messages} aria-labelledby="staff-messages-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>Связь</p><h3 id="staff-messages-title">Сообщения по делу</h3></div><span>{matter.messages.length}</span></div><MessageHistory messages={matter.messages} /><form className={styles.composer} onSubmit={onSubmit}><label htmlFor="staff-message">Сообщение клиенту</label><textarea id="staff-message" ref={messageInputRef} value={draft} maxLength={2000} rows={5} placeholder="Кратко опишите следующий шаг или ответ" disabled={isSending} onChange={(event) => onDraftChange(event.target.value)} /><button className={styles.primaryButton} type="submit" disabled={isSending}>{isSending ? "Отправка…" : "Отправить сообщение"}</button><p className={`${styles.feedback}${feedback.tone === "error" ? ` ${styles.feedbackError}` : ""}`} role="status" aria-live="polite">{feedback.text}</p></form></section> : null}
    </aside>
  );
}
