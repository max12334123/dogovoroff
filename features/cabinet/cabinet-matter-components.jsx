import styles from "./cabinet.module.css";

export function CaseHeader({ matter, sectionTitle, onBack }) {
  return (
    <header className={styles.caseHeader}>
      <button className={styles.backAction} type="button" onClick={onBack}>
        Назад на главную
      </button>
      <p className={styles.eyebrow}>{matter.reference}</p>
      <h1 className={`${styles.caseTitle} ${styles.userTitle}`}>{matter.title}</h1>
      <span className={styles.statusText}>{matter.stateLabel}</span>
      <p className={styles.caseSection}>{sectionTitle}</p>
    </header>
  );
}

export function MatterSwitch({ matters, activeMatterId, onSelect, compact = false }) {
  return (
    <div
      className={`${styles.matterSwitch}${compact ? ` ${styles.matterSwitchCompact}` : ""}`}
      aria-label="Выбор дела"
    >
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
            <strong className={styles.userTitle}>{matter.title}</strong>
            <small>{matter.stateLabel}</small>
          </button>
        );
      })}
    </div>
  );
}

export function Timeline({ matter, condensed = false }) {
  const visibleStages = condensed
    ? [matter.stages[matter.currentStage]].filter(Boolean)
    : matter.stages;

  if (!visibleStages.length) {
    return <p className={styles.emptyList}>Этапы появятся после принятия дела в работу.</p>;
  }

  return (
    <ol className={`${styles.timeline}${condensed ? ` ${styles.timelineCondensed}` : ""}`}>
      {visibleStages.map((stage, index) => (
        <li key={stage.id ?? `${stage.title}-${index}`} className={styles[`stage_${stage.status}`]}>
          <span className={styles.stageMarker} aria-hidden="true">
            {(condensed ? matter.currentStage : index) + 1}
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

export function UploadControl({ matter, feedback, isUploading, onFileChange, onOpenDocuments }) {
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
      <h2 className={styles.userTitle} id="next-action-title">{matter.nextAction.title}</h2>
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

export function DocumentRegister({
  documents,
  compact = false,
  emptyText = "Документы по этому делу пока не добавлены.",
  feedback,
  downloadingId,
  onDownload,
}) {
  if (!documents.length) {
    return <p className={styles.emptyList}>{emptyText}</p>;
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
            <strong className={styles.userTitle}>{document.name}</strong>
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

export function UnsavedMessageDialog({ open, onContinue, onDiscard }) {
  if (!open) {
    return null;
  }

  return (
    <div className={styles.dialogBackdrop}>
      <section
        className={styles.confirmationDialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-message-title"
        aria-describedby="unsaved-message-description"
      >
        <p className={styles.eyebrow}>Черновик сообщения</p>
        <h2 id="unsaved-message-title">Несохранённое сообщение</h2>
        <p id="unsaved-message-description">
          Если перейти в другой раздел или дело, текст сообщения будет удалён.
        </p>
        <div className={styles.dialogActions}>
          <button className={styles.dialogPrimary} type="button" autoFocus onClick={onContinue}>
            Продолжить писать
          </button>
          <button className={styles.dialogSecondary} type="button" onClick={onDiscard}>
            Не сохранять
          </button>
        </div>
      </section>
    </div>
  );
}
