import StaffDocumentRequests from "../document-requests/staff-document-requests";
import StaffWorkflowForm from "./staff-workflow-form";
import { StaffDialog } from "./staff-workspace-ui";
import { getWorkspaceTabs, getTabAfterKey } from "./staff-workspace-ui-domain.mjs";
import { getMatterTask } from "./staff-domain.mjs";
import styles from "./staff.module.css";

const TAB_LABELS = { overview: "Обзор", documents: "Документы", messages: "Сообщения", management: "Управление" };

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
  matter, organizationLabel, assignmentStaff, workflowDraft, workflowFeedback,
  isUpdatingWorkflow, downloadingId, documentFeedback, onWorkflowChange,
  onAssignmentChange, onWorkflowClose, onWorkflowSubmit, onDownload, documentsRef,
  messageInputRef, draft, feedback, isSending, onDraftChange, onSubmit,
  onOpenDocuments, onOpenComposer, canEditDetails, detailsButtonRef, onOpenDetails,
  tab = "overview", onTabChange, activePanel, onOpenPanel, draftRegistry,
  requestTransition, confirmation, panelTriggerRef, workflowDirty,
}) {
  if (!matter) return <section className={styles.detailPanel}><h2>Выберите дело</h2></section>;
  const tabs = getWorkspaceTabs(canEditDetails);
  const selectedTab = tabs.includes(tab) ? tab : "overview";
  const otherDocuments = matter.documents.filter((document) => document.requestId === null);
  const task = getMatterTask(matter);
  const recommended = task === "Проверить комплект документов" || task === "Ожидаем документы от клиента" ? "documents" : "workflow";
  const quickClass = (action) => selectedTab === "overview" && !activePanel && recommended === action ? styles.primaryButton : styles.textButton;
  const tabKeyDown = (event) => {
    const next = getTabAfterKey(tabs, selectedTab, event.key);
    if (!next) return;
    event.preventDefault();
    onTabChange(next, true);
  };
  return <>
    <section className={styles.detailPanel} aria-labelledby="staff-matter-title" hidden={Boolean(activePanel || confirmation)}>
      <header className={styles.detailIntro}><p className={styles.eyebrow}>{matter.reference}</p><h2 id="staff-matter-title">{matter.title}</h2><p>{matter.stateLabel} · {matter.responseBy}</p></header>
      <div className={styles.detailActions}>
        <button className={quickClass("messages")} type="button" onClick={onOpenComposer}>Написать клиенту</button>
        <button className={quickClass("documents")} type="button" onClick={onOpenDocuments}>Запросить документы</button>
        <button className={quickClass("workflow")} type="button" onClick={() => onOpenPanel("workflow")}>Изменить этап</button>
      </div>
      <div className={styles.workspaceTabs} role="tablist" aria-label="Разделы дела">
        {tabs.map((id) => <button id={`staff-tab-${id}`} key={id} type="button" role="tab" aria-selected={selectedTab === id} aria-controls={`staff-panel-${id}`} tabIndex={selectedTab === id ? 0 : -1} onKeyDown={tabKeyDown} onClick={() => onTabChange(id, true)}>{TAB_LABELS[id]}</button>)}
      </div>
      {tabs.map((id) => <section key={id} id={`staff-panel-${id}`} role="tabpanel" aria-labelledby={`staff-tab-${id}`} hidden={selectedTab !== id} tabIndex={0}>
        {selectedTab === id && id === "overview" ? <>
          <section className={styles.nextAction}><p className={styles.eyebrow}>Текущая задача</p><h3>{task}</h3></section>
          <dl className={styles.matterMeta}>
            <div><dt>Статус</dt><dd>{matter.stateLabel}</dd></div><div><dt>Срок ответа</dt><dd>{matter.responseBy}</dd></div>
            <div><dt>Организация</dt><dd>{organizationLabel}</dd></div><div><dt>Ответственный</dt><dd>{matter.assignedLawyerName || "Назначение не указано в данных дела"}</dd></div>
          </dl>
          <section className={styles.detailSection} aria-labelledby="staff-stages-title"><h3 id="staff-stages-title">Этапы дела</h3><MatterStages matter={matter} /></section>
          {matter.nextAction ? <section className={styles.nextAction}><p className={styles.eyebrow}>Ожидаем от клиента</p><h3>{matter.nextAction.title}</h3><p>{matter.nextAction.description}</p>{matter.nextAction.deadline ? <small>{matter.nextAction.deadline}</small> : null}</section> : null}
          <section className={styles.detailSection}><h3>Недавние изменения</h3>{matter.updates?.length ? <ol className={styles.stageList}>{matter.updates.slice(0, 3).map((event, index) => <li key={event.id ?? index}><div><p>{event.text}</p><small>{event.date} · {event.time}</small></div></li>)}</ol> : <p className={styles.muted}>Обновлено: {matter.updated || "Недавно"}</p>}</section>
        </> : null}
        {selectedTab === id && id === "documents" ? <>
          <section className={styles.documentRequestSection} ref={documentsRef} tabIndex={-1} aria-label="Запросы документов"><StaffDocumentRequests key={matter.id} matter={matter} downloadingId={downloadingId} downloadFeedback={documentFeedback} onDownload={onDownload} draftRegistry={draftRegistry} requestTransition={requestTransition} /></section>
          <section className={styles.documentSection} aria-labelledby="staff-documents-title">
            <div className={styles.sectionHeading}><h3 id="staff-documents-title">Другие документы</h3><span>{otherDocuments.length}</span></div>
            {otherDocuments.length ? <ul className={styles.documentList}>{otherDocuments.map((document) => <li key={document.id}><button className={styles.documentDownload} type="button" disabled={downloadingId === document.id} onClick={() => onDownload(document)}><span>{document.name}</span><small>{downloadingId === document.id ? "Загрузка…" : "Скачать"}</small></button><small>{document.status} · {document.updated}</small></li>)}</ul> : <p className={styles.muted}>Других документов пока нет.</p>}
          </section>
        </> : null}
        {selectedTab === id && id === "messages" ? <section className={styles.messages} aria-labelledby="staff-messages-title">
          <h3 id="staff-messages-title">Сообщения по делу</h3><MessageHistory messages={matter.messages} />
          <form className={styles.composer} onSubmit={onSubmit}>
            <label htmlFor="staff-message">Сообщение клиенту</label><textarea id="staff-message" ref={messageInputRef} value={draft} maxLength={2000} rows={5} placeholder="Кратко опишите следующий шаг или ответ" disabled={isSending} onChange={(event) => onDraftChange(event.target.value)} />
            <button className={styles.primaryButton} type="submit" disabled={isSending}>{isSending ? "Отправка…" : "Отправить сообщение"}</button><p className={`${styles.feedback}${feedback.tone === "error" ? ` ${styles.feedbackError}` : ""}`} role="status" aria-live="polite">{feedback.text}</p>
          </form>
        </section> : null}
        {selectedTab === id && id === "management" && canEditDetails ? <section className={styles.managementActions} aria-label="Управление делом">
          {canEditDetails ? <button className={styles.textButton} ref={detailsButtonRef} type="button" onClick={onOpenDetails}>Редактировать реквизиты</button> : null}
          <button className={styles.textButton} type="button" onClick={() => onOpenPanel("assignment")}>Переназначить ответственного</button>
          <button className={styles.textButton} type="button" onClick={() => onOpenPanel("workflow")}>Изменить этап, завершить или архивировать</button>
        </section> : null}
      </section>)}
    </section>
    {activePanel === "workflow" || (activePanel === "assignment" && canEditDetails) ? <StaffDialog title={activePanel === "assignment" ? "Назначение ответственного" : "Этап и статус дела"} id="staff-workflow-dialog-title" onClose={onWorkflowClose} confirmation={confirmation} returnFocusRef={panelTriggerRef}>
      <StaffWorkflowForm assignmentStaff={assignmentStaff} draft={workflowDraft} feedback={workflowFeedback} isSubmitting={isUpdatingWorkflow} isDirty={workflowDirty} matter={matter} canAssign={canEditDetails} onAssignmentChange={onAssignmentChange} onChange={onWorkflowChange} onClose={onWorkflowClose} onSubmit={onWorkflowSubmit} />
    </StaffDialog> : null}
  </>;
}
