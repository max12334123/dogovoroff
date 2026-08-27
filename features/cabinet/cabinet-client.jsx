"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { AI_PRECHECK_HREF, LEAD_FORM_HREF } from "../../lib/public-navigation.mjs";
import { CABINET_VIEWS, getMatterById, validateClientUpload } from "./cabinet-data.mjs";
import styles from "./cabinet.module.css";

const TOP_NAVIGATION = CABINET_VIEWS.filter((item) => item.id !== "overview");

function Brand() {
  return (
    <a className={styles.brand} href="/" aria-label="ДоговорОфф — вернуться на сайт">
      <span className={styles.brandMark}>
        <Image src="/media/dogovoroff-mark.png" alt="" width={64} height={64} sizes="44px" priority />
      </span>
      <span className={styles.brandName}>ДоговорОфф</span>
      <span className={styles.brandDescriptor}>Личный кабинет</span>
    </a>
  );
}

function ViewButton({ item, activeView, onSelect, compact = false }) {
  const active = item.id === activeView;

  return (
    <button
      className={`${compact ? styles.topNavButton : styles.railButton}${active ? ` ${styles.isActive}` : ""}`}
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={() => onSelect(item.id)}
    >
      {!compact && <span>{item.index}</span>}
      <strong>{item.label}</strong>
    </button>
  );
}

function MatterSwitch({ matters, activeMatterId, onSelect }) {
  return (
    <div className={styles.matterSwitch} aria-label="Выбор дела">
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
            <strong>{matter.title}</strong>
            <small>{matter.stateLabel}</small>
          </button>
        );
      })}
    </div>
  );
}

function Timeline({ matter, condensed = false }) {
  if (!matter.stages.length) {
    return <p className={styles.emptyList}>Этапы появятся после принятия дела в работу.</p>;
  }

  return (
    <ol className={`${styles.timeline}${condensed ? ` ${styles.timelineCondensed}` : ""}`}>
      {matter.stages.map((stage, index) => (
        <li key={stage.title} className={styles[`stage_${stage.status}`]}>
          <span className={styles.stageMarker} aria-hidden="true">
            {index + 1}
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

function UploadControl({ matter, feedback, onFileChange, onOpenDocuments }) {
  if (!matter.nextAction && matter.state === "archived") {
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
      <h2 id="next-action-title">{matter.nextAction.title}</h2>
      <p className={styles.actionDeadline}>{matter.nextAction.deadline}</p>
      <p className={styles.actionDescription}>{matter.nextAction.description}</p>
      <label className={styles.actionButton}>
        <span>Загрузить документ</span>
        <input
          className={styles.visuallyHidden}
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          aria-describedby="upload-note upload-feedback"
          onChange={onFileChange}
        />
      </label>
      <p id="upload-note" className={styles.privacyNote}>В прототипе файл не покидает устройство.</p>
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

function DocumentRegister({ documents, compact = false }) {
  if (!documents.length) {
    return <p className={styles.emptyList}>Документы по этому делу пока не добавлены.</p>;
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
          <strong>{document.name}</strong>
          <span>{document.status}</span>
          <time dateTime={document.updated.split(".").reverse().join("-")}>{document.updated}</time>
        </div>
      ))}
    </div>
  );
}

function OverviewView({ matters, matter, uploadFeedback, onFileChange, onNavigate }) {
  return (
    <>
      <div className={styles.pageIntro}>
        <p className={styles.eyebrow}>Кабинет клиента</p>
        <h1>Добрый день</h1>
        <p className={styles.editorial}>Вот что происходит по вашему делу</p>
      </div>

      <MatterSwitch matters={matters} activeMatterId={matter.id} onSelect={(id) => onNavigate("overview", id)} />

      <div className={styles.overviewGrid}>
        <section className={styles.matterPanel} aria-labelledby="active-matter-title">
          <div className={styles.matterHeading}>
            <div>
              <p className={styles.eyebrow}>{matter.reference}</p>
              <h2 id="active-matter-title">{matter.title}</h2>
            </div>
            <p className={styles.matterState}>{matter.stateLabel}</p>
          </div>
          <p className={styles.matterSummary}>{matter.summary}</p>
          <div className={styles.sectionLabel}>Ход дела</div>
          <Timeline matter={matter} />
          <a className={styles.aiLink} href={AI_PRECHECK_HREF}>Новый AI-разбор</a>
        </section>

        <div className={styles.overviewAside}>
          <UploadControl
            matter={matter}
            feedback={uploadFeedback}
            onFileChange={onFileChange}
            onOpenDocuments={() => onNavigate("documents", matter.id)}
          />

          <section className={styles.summaryPanel} aria-labelledby="last-message-title">
            <div className={styles.summaryHeading}>
              <p className={styles.eyebrow}>Последнее сообщение</p>
              <button type="button" onClick={() => onNavigate("messages", matter.id)}>Все сообщения</button>
            </div>
            {matter.messages[0] ? (
              <>
                <h2 id="last-message-title">{matter.messages[0].sender}</h2>
                <time>{matter.messages[0].date}</time>
                <p>{matter.messages[0].text}</p>
              </>
            ) : (
              <p className={styles.emptyList} id="last-message-title">Сообщений по делу пока нет.</p>
            )}
          </section>

          <section className={styles.summaryPanel} aria-labelledby="last-documents-title">
            <div className={styles.summaryHeading}>
              <p className={styles.eyebrow}>Последние документы</p>
              <button type="button" onClick={() => onNavigate("documents", matter.id)}>Все документы</button>
            </div>
            <h2 className={styles.visuallyHidden} id="last-documents-title">Последние документы по делу</h2>
            <DocumentRegister documents={matter.documents.slice(0, 3)} compact />
          </section>
        </div>
      </div>
    </>
  );
}

function MattersView({ matters, matter, onMatterSelect }) {
  return (
    <>
      <div className={styles.viewHeading}>
        <div>
          <p className={styles.eyebrow}>Дела</p>
          <h1>История работы</h1>
        </div>
        <p>Статусы и события изложены понятным для клиента языком.</p>
      </div>
      <MatterSwitch matters={matters} activeMatterId={matter.id} onSelect={onMatterSelect} />
      <div className={styles.detailsGrid}>
        <section className={styles.detailsMain} aria-labelledby="matter-details-title">
          <p className={styles.eyebrow}>{matter.reference}</p>
          <h2 id="matter-details-title">{matter.title}</h2>
          <p className={styles.matterSummary}>{matter.summary}</p>
          <div className={styles.sectionLabel}>Этапы</div>
          <Timeline matter={matter} condensed />
        </section>
        <section className={styles.updatesPanel} aria-labelledby="updates-title">
          <p className={styles.eyebrow}>Хронология</p>
          <h2 id="updates-title">Последние изменения</h2>
          {matter.updates.length ? <ol className={styles.updatesList}>
            {matter.updates.map((update) => (
              <li key={update.id ?? `${update.date}-${update.time}`}>
                <time>{update.date}<span>{update.time}</span></time>
                <p>{update.text}</p>
              </li>
            ))}
          </ol> : <p className={styles.emptyList}>Изменений по делу пока нет.</p>}
        </section>
      </div>
    </>
  );
}

function DocumentsView({ matters, matter, onMatterSelect, uploadFeedback, onFileChange }) {
  return (
    <>
      <div className={styles.viewHeading}>
        <div>
          <p className={styles.eyebrow}>Документы</p>
          <h1>Материалы дела</h1>
        </div>
        <p>Здесь будут храниться только файлы, относящиеся к выбранному делу.</p>
      </div>
      <MatterSwitch matters={matters} activeMatterId={matter.id} onSelect={onMatterSelect} />
      <div className={styles.documentsGrid} id="documents">
        <section className={styles.documentsMain} aria-labelledby="document-register-title">
          <p className={styles.eyebrow}>{matter.reference}</p>
          <h2 id="document-register-title">Реестр документов</h2>
          <DocumentRegister documents={matter.documents} />
        </section>
        {matter.nextAction ? (
          <UploadControl matter={matter} feedback={uploadFeedback} onFileChange={onFileChange} />
        ) : (
          <section className={styles.quietPanel}>
            <p className={styles.eyebrow}>Статус</p>
            <h2>Комплект документов сформирован.</h2>
            <p>Новых материалов по этому делу сейчас не требуется.</p>
          </section>
        )}
      </div>
    </>
  );
}

function MessagesView({ matters, matter, onMatterSelect, draft, onDraftChange, draftStatus, onSaveDraft }) {
  return (
    <>
      <div className={styles.viewHeading}>
        <div>
          <p className={styles.eyebrow}>Сообщения</p>
          <h1>Связь по делу</h1>
        </div>
        <p>Обсуждение отделено от документов и привязано к конкретному делу.</p>
      </div>
      <MatterSwitch matters={matters} activeMatterId={matter.id} onSelect={onMatterSelect} />
      <div className={styles.messagesGrid}>
        <section className={styles.messageHistory} aria-labelledby="message-history-title">
          <p className={styles.eyebrow}>{matter.reference}</p>
          <h2 id="message-history-title">История сообщений</h2>
          {matter.messages.length ? <ol>
            {matter.messages.map((message) => (
              <li key={message.id}>
                <div><strong>{message.sender}</strong><time>{message.date}</time></div>
                <p>{message.text}</p>
              </li>
            ))}
          </ol> : <p className={styles.emptyList}>Сообщений по этому делу пока нет.</p>}
        </section>
        <form className={styles.messageComposer} onSubmit={onSaveDraft}>
          <p className={styles.eyebrow}>Новое сообщение</p>
          <h2>Задать вопрос по делу</h2>
          <label htmlFor="cabinet-message">Сообщение</label>
          <textarea
            id="cabinet-message"
            value={draft}
            rows={7}
            maxLength={2000}
            placeholder="Кратко сформулируйте вопрос"
            onChange={(event) => onDraftChange(event.target.value)}
          />
          <button className={styles.darkButton} type="submit">Сохранить черновик</button>
          <p className={styles.privacyNote}>Черновик хранится только до закрытия этой страницы и не отправляется.</p>
          <p className={styles.uploadFeedback} role="status" aria-live="polite">{draftStatus}</p>
        </form>
      </div>
    </>
  );
}

function EmptyCabinet() {
  return (
    <section className={styles.emptyCabinet} aria-labelledby="empty-cabinet-title">
      <p className={styles.eyebrow}>Аккаунт подтверждён</p>
      <h1 id="empty-cabinet-title">Ваш кабинет готов.</h1>
      <p className={styles.emptyCabinetLead}>
        Здесь появятся дела, документы и сообщения после того, как юрист примет обращение в работу.
      </p>
      <div className={styles.emptyCabinetActions}>
        <a className={styles.darkButton} href={AI_PRECHECK_HREF}>Пройти AI-разбор</a>
        <a className={styles.quietLink} href={LEAD_FORM_HREF}>Оставить заявку</a>
      </div>
      <div className={styles.emptyCabinetNote}>
        <span>Что дальше</span>
        <p>Отправьте обращение удобным способом. После проверки мы свяжем принятое дело с этим аккаунтом.</p>
      </div>
    </section>
  );
}

export default function CabinetClient({ initialMatters = [], displayName = "Клиент" }) {
  const matters = initialMatters;
  const hasMatters = matters.length > 0;
  const [activeView, setActiveView] = useState("overview");
  const [activeMatterId, setActiveMatterId] = useState(matters[0]?.id ?? null);
  const [uploadFeedback, setUploadFeedback] = useState({ tone: "neutral", text: "PDF, DOC, DOCX, JPG или PNG — до 10 МБ." });
  const [draft, setDraft] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const mainRef = useRef(null);
  const matter = useMemo(() => getMatterById(activeMatterId, matters), [activeMatterId, matters]);

  const selectView = (view, matterId = activeMatterId) => {
    setActiveMatterId(matterId);
    setActiveView(view);
    window.requestAnimationFrame(() => mainRef.current?.focus());
  };

  const handleFileChange = (event) => {
    const [file] = Array.from(event.target.files ?? []);
    const validation = validateClientUpload(file);

    if (!validation.valid) {
      setUploadFeedback({ tone: "error", text: validation.error });
      event.target.value = "";
      return;
    }

    setUploadFeedback({
      tone: "success",
      text: `«${file.name}» проверен. Отправка станет доступна после подключения защищённого хранилища.`,
    });
    event.target.value = "";
  };

  const saveDraft = (event) => {
    event.preventDefault();
    const normalizedDraft = draft.trim();
    if (!normalizedDraft) {
      setDraftStatus("Введите текст сообщения.");
      return;
    }

    setDraft(normalizedDraft);
    setDraftStatus("Черновик сохранён в текущем окне. Он не был отправлен.");
  };

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#cabinet-main">Перейти к содержанию</a>
      <header className={styles.header}>
        <Brand />
        <nav className={styles.topNav} aria-label="Разделы личного кабинета">
          {hasMatters && TOP_NAVIGATION.map((item) => (
            <ViewButton key={item.id} item={item} activeView={activeView} onSelect={selectView} compact />
          ))}
          <a className={styles.aiTopLink} href={AI_PRECHECK_HREF}>AI-разбор</a>
        </nav>
        <details className={styles.profile}>
          <summary>{displayName}</summary>
          <div>
            <span>Подтверждённый аккаунт</span>
            <a href="/">Вернуться на сайт</a>
            <form action="/auth/signout" method="post">
              <button type="submit">Выйти</button>
            </form>
          </div>
        </details>
      </header>

      {hasMatters && <nav className={styles.mobileNav} aria-label="Разделы личного кабинета на мобильном устройстве">
        {CABINET_VIEWS.map((item) => (
          <ViewButton key={item.id} item={item} activeView={activeView} onSelect={selectView} compact />
        ))}
      </nav>}

      <div className={styles.layout}>
        <aside className={styles.rail}>
          <p className={styles.railTitle}>Кабинет</p>
          {hasMatters ? <nav aria-label="Навигация личного кабинета">
            {CABINET_VIEWS.map((item) => (
              <ViewButton key={item.id} item={item} activeView={activeView} onSelect={selectView} />
            ))}
          </nav> : <p className={styles.railEmpty}>Дела появятся после принятия обращения.</p>}
          <div className={styles.railFooter}>
            <span>Защищённый доступ</span>
            <a href="/privacy">Конфиденциальность</a>
          </div>
        </aside>

        <main id="cabinet-main" className={styles.main} ref={mainRef} tabIndex={-1}>
          {!matter && <EmptyCabinet />}
          {matter && activeView === "overview" && (
            <OverviewView
              matters={matters}
              matter={matter}
              uploadFeedback={uploadFeedback}
              onFileChange={handleFileChange}
              onNavigate={selectView}
            />
          )}
          {matter && activeView === "matters" && <MattersView matters={matters} matter={matter} onMatterSelect={setActiveMatterId} />}
          {matter && activeView === "documents" && (
            <DocumentsView
              matters={matters}
              matter={matter}
              onMatterSelect={setActiveMatterId}
              uploadFeedback={uploadFeedback}
              onFileChange={handleFileChange}
            />
          )}
          {matter && activeView === "messages" && (
            <MessagesView
              matters={matters}
              matter={matter}
              onMatterSelect={setActiveMatterId}
              draft={draft}
              onDraftChange={setDraft}
              draftStatus={draftStatus}
              onSaveDraft={saveDraft}
            />
          )}
        </main>
      </div>
    </div>
  );
}
