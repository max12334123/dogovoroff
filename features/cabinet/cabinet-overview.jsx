import { getClientPrimaryAction } from "./cabinet-navigation-domain.mjs";
import { DocumentRegister, MatterSwitch, Timeline } from "./cabinet-matter-components";
import styles from "./cabinet.module.css";

export default function CabinetOverview({
  matters,
  matter,
  hasUnreadMessage,
  documentFeedback,
  downloadingId,
  onDownload,
  onNavigate,
}) {
  const action = getClientPrimaryAction(matter, { hasUnreadMessage });

  return (
    <>
      <header className={styles.pageIntro}>
        <p className={styles.eyebrow}>Кабинет клиента</p>
        <h1>Добрый день</h1>
        <p className={styles.editorial}>Что происходит по делу и требуется ли ваше участие.</p>
      </header>

      {matters.length > 1 ? (
        <MatterSwitch
          matters={matters}
          activeMatterId={matter.id}
          onSelect={(id) => onNavigate("overview", id)}
        />
      ) : null}

      <section className={styles.primaryActionPanel} aria-labelledby="client-primary-action-title">
        <p className={styles.eyebrow}>{action.eyebrow}</p>
        <h2 id="client-primary-action-title">{action.title}</h2>
        <p>{action.description}</p>
        {action.label ? (
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => onNavigate(action.targetView, matter.id)}
          >
            {action.label}
          </button>
        ) : null}
      </section>

      <section className={styles.currentStagePanel} aria-labelledby="client-current-stage-title">
        <p className={styles.eyebrow}>Текущий этап</p>
        <h2 id="client-current-stage-title">
          {matter.stages[matter.currentStage]?.title || "Этап уточняется"}
        </h2>
        <Timeline matter={matter} condensed />
      </section>

      <section className={styles.summaryPanel} aria-labelledby="client-latest-message-title">
        <p className={styles.eyebrow}>Последнее сообщение</p>
        <h2 id="client-latest-message-title">
          {matter.messages[0]?.sender || "Сообщений пока нет"}
        </h2>
        {matter.messages[0] ? <p>{matter.messages[0].text}</p> : null}
        <button
          className={styles.textAction}
          type="button"
          onClick={() => onNavigate("messages", matter.id)}
        >
          Все сообщения
        </button>
      </section>

      <section className={styles.summaryPanel} aria-labelledby="client-latest-documents-title">
        <p className={styles.eyebrow}>Последние документы</p>
        <h2 className={styles.visuallyHidden} id="client-latest-documents-title">
          Последние документы по делу
        </h2>
        <DocumentRegister
          documents={matter.documents.slice(0, 3)}
          compact
          feedback={documentFeedback}
          downloadingId={downloadingId}
          onDownload={onDownload}
        />
        <button
          className={styles.textAction}
          type="button"
          onClick={() => onNavigate("documents", matter.id)}
        >
          Все документы
        </button>
      </section>
    </>
  );
}
