"use client";

import { track } from "@vercel/analytics";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { maskPhone, validateLead } from "../../lib/form-utils.mjs";
import { createSubmissionId } from "../../lib/submission-id.mjs";
import { PRECHECK_PRACTICES, PRECHECK_PRACTICE_IDS } from "./config.mjs";
import { normalizePrecheckPayload } from "./domain.mjs";

const TOTAL_STEPS = 2;
const MIN_DESCRIPTION_LENGTH = 10;
const STEP_TITLES = ["Расскажите о ситуации", "Как с вами связаться"];
const STEP_COPY = [
  "Выберите направление и опишите задачу своими словами. Этого достаточно для предварительной карты.",
  "Оставьте только имя и телефон — разбор сформируется и сразу уйдёт юристу вместе с заявкой.",
];

export default function PrecheckSection({
  initialPracticeId = "",
  onSubmitLead,
  onChooseQuickForm,
}) {
  const [step, setStep] = useState(0);
  const [practiceId, setPracticeId] = useState(
    PRECHECK_PRACTICE_IDS.includes(initialPracticeId) ? initialPracticeId : "",
  );
  const [description, setDescription] = useState("");
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [agree, setAgree] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("editing");
  const [result, setResult] = useState(null);
  const [leadSent, setLeadSent] = useState(false);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [mailHref, setMailHref] = useState("");
  const headingRef = useRef(null);
  const firstPracticeRef = useRef(null);
  const descriptionRef = useRef(null);
  const deadlineRef = useRef(null);
  const nameRef = useRef(null);
  const phoneRef = useRef(null);
  const agreeRef = useRef(null);
  const startedRef = useRef(false);
  const submittingRef = useRef(false);
  const submissionIdRef = useRef("");
  const reduceMotion = useReducedMotion();
  const practice = useMemo(
    () => PRECHECK_PRACTICES.find(({ id }) => id === practiceId) || null,
    [practiceId],
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    try { track("precheck_started"); } catch {}
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => headingRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [step, status]);

  const clearError = (field) => {
    submissionIdRef.current = "";
    setErrors((current) => ({ ...current, [field]: false }));
    setError("");
    setAnnouncement("");
  };

  const selectPractice = (nextPracticeId) => {
    setPracticeId(nextPracticeId);
    clearError("practiceId");
    try { track("precheck_practice_selected"); } catch {}
  };

  const compactPayload = () => ({
    version: "2",
    practiceId,
    answers: { deadline: hasDeadline ? deadline : "" },
    description,
    aiConsent,
  });

  const continueToContacts = () => {
    const nextErrors = {
      practiceId: !practice,
      description: description.trim().length < MIN_DESCRIPTION_LENGTH,
      deadline: hasDeadline && !deadline,
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      setError("Заполните отмеченные поля, чтобы продолжить.");
      const firstInvalid = [
        ["practiceId", firstPracticeRef],
        ["description", descriptionRef],
        ["deadline", deadlineRef],
      ].find(([field]) => nextErrors[field]);
      window.requestAnimationFrame(() => firstInvalid?.[1].current?.focus());
      return;
    }

    setError("");
    setErrors({});
    setStep(1);
  };

  const submit = async () => {
    if (submittingRef.current) return;
    const nextErrors = validateLead({ name, phone, service: practice?.service || "", agree });
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      setError("Проверьте имя, телефон и согласие на обработку данных.");
      const firstInvalid = [
        ["name", nameRef],
        ["phone", phoneRef],
        ["agree", agreeRef],
      ].find(([field]) => nextErrors[field]);
      window.requestAnimationFrame(() => firstInvalid?.[1].current?.focus());
      return;
    }

    const payload = compactPayload();
    if (!normalizePrecheckPayload(payload).ok) {
      setError("Вернитесь к описанию и проверьте обязательные поля.");
      return;
    }

    submittingRef.current = true;
    setStatus("submitting");
    setError("");
    setAnnouncement("Отправляем обращение юристу…");
    let delivery = {
      success: false,
      error: "Автоматическая отправка пока недоступна. Отправьте подготовленное письмо.",
      mailHref: "",
    };

    if (typeof onSubmitLead === "function") {
      try {
        submissionIdRef.current ||= createSubmissionId();
        delivery = await onSubmitLead({
          name,
          phone,
          website,
          agree,
          description,
          submissionId: submissionIdRef.current,
          precheckInput: payload,
        });
      } catch {}
    }

    setResult({ practice: practice.label });
    setLeadSent(delivery?.success === true);
    setMailHref(typeof delivery?.mailHref === "string" ? delivery.mailHref : "");
    setError(delivery?.success === true ? "" : (delivery?.error || "Не удалось отправить обращение."));
    setAnnouncement(delivery?.success === true ? "Обращение отправлено." : "Обращение подготовлено.");
    setStatus("result");
    submittingRef.current = false;
    try { track("precheck_completed"); } catch {}
    if (delivery?.mode !== "ai") {
      try { track("precheck_fallback"); } catch {}
    }
  };

  const reset = () => {
    setStep(0);
    setPracticeId("");
    setDescription("");
    setHasDeadline(false);
    setDeadline("");
    setName("");
    setPhone("");
    setWebsite("");
    setAgree(false);
    setAiConsent(false);
    setErrors({});
    setStatus("editing");
    setResult(null);
    setLeadSent(false);
    setError("");
    setAnnouncement("");
    setMailHref("");
    submittingRef.current = false;
    submissionIdRef.current = "";
  };

  const renderSituation = () => (
    <div className="precheck__questions">
      <fieldset className="precheck__question precheck__question--practice">
        <legend>Направление ситуации <span aria-hidden="true">*</span></legend>
        <div className="precheck__options precheck__options--practice">
          {PRECHECK_PRACTICES.map((item, index) => (
            <label key={item.id} className={practiceId === item.id ? "is-selected" : ""}>
              <input
                ref={index === 0 ? firstPracticeRef : undefined}
                type="radio"
                name="precheck-practice"
                value={item.id}
                checked={practiceId === item.id}
                onChange={() => selectPractice(item.id)}
                aria-invalid={Boolean(errors.practiceId)}
                required
              />
              <span><em>{String(index + 1).padStart(2, "0")}</em>{item.label}</span>
            </label>
          ))}
        </div>
        {errors.practiceId ? <span className="field__error" role="alert">Выберите направление</span> : null}
      </fieldset>

      <div className="precheck__field precheck__field--situation">
        <label htmlFor="precheck-description">Что произошло и какой результат вам нужен? <span aria-hidden="true">*</span></label>
        <textarea
          ref={descriptionRef}
          id="precheck-description"
          value={description}
          onChange={(event) => {
            setDescription(event.target.value.slice(0, 1_200));
            clearError("description");
          }}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? "precheck-description-error precheck-description-hint" : "precheck-description-hint"}
          aria-required="true"
          required
          rows={5}
          maxLength={1_200}
          placeholder="Например: получили претензию по договору, нужно подготовить ответ до пятницы"
        />
        <div className="precheck__field-meta">
          <small id="precheck-description-hint">Без ФИО, телефонов и реквизитов документов</small>
          <small>{description.length} / 1200</small>
        </div>
        {errors.description ? <span id="precheck-description-error" className="field__error" role="alert">Добавьте хотя бы 10 символов</span> : null}
      </div>

      <div className="precheck__deadline">
        <label className="precheck__deadline-toggle">
          <input
            type="checkbox"
            checked={hasDeadline}
            onChange={(event) => {
              setHasDeadline(event.target.checked);
              if (!event.target.checked) setDeadline("");
              clearError("deadline");
            }}
          />
          <span><strong>Есть срочный срок</strong><small>Например, заседание, ответ на претензию или подача документов</small></span>
        </label>
        <AnimatePresence initial={false}>
          {hasDeadline ? (
            <motion.div
              className="precheck__field precheck__deadline-field"
              initial={reduceMotion ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
            >
              <label htmlFor="precheck-deadline">Ближайшая дата <span aria-hidden="true">*</span></label>
              <input
                ref={deadlineRef}
                id="precheck-deadline"
                type="date"
                value={deadline}
                onChange={(event) => {
                  setDeadline(event.target.value);
                  clearError("deadline");
                }}
                aria-invalid={Boolean(errors.deadline)}
                aria-required="true"
                required
              />
              {errors.deadline ? <span className="field__error" role="alert">Укажите дату или отключите срочный срок</span> : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );

  const renderContacts = () => (
    <div className="precheck__contact-step">
      <div className="precheck__selection-summary">
        <span>Направление</span>
        <strong>{practice?.label}</strong>
      </div>
      <fieldset className="precheck__contact-fields">
        <legend>Контактные данные</legend>
        <div className="precheck__contact-grid">
          <div className="precheck__field">
            <label htmlFor="precheck-name">Ваше имя <span aria-hidden="true">*</span></label>
            <input
              ref={nameRef}
              id="precheck-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value.slice(0, 80));
                clearError("name");
              }}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "precheck-name-error" : undefined}
              aria-required="true"
              required
              autoComplete="name"
              placeholder="Как к вам обращаться"
              maxLength={80}
            />
            {errors.name ? <span id="precheck-name-error" className="field__error" role="alert">Укажите имя</span> : null}
          </div>
          <div className="precheck__field">
            <label htmlFor="precheck-phone">Телефон <span aria-hidden="true">*</span></label>
            <input
              ref={phoneRef}
              id="precheck-phone"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value ? maskPhone(event.target.value) : "");
                clearError("phone");
              }}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? "precheck-phone-error" : undefined}
              aria-required="true"
              required
              autoComplete="tel"
              inputMode="tel"
              placeholder="+7 (___) ___-__-__"
              maxLength={32}
            />
            {errors.phone ? <span id="precheck-phone-error" className="field__error" role="alert">Введите номер полностью</span> : null}
          </div>
        </div>
      </fieldset>

      <div className="lead-form__honeypot" aria-hidden="true">
        <label htmlFor="precheck-website">Ваш сайт</label>
        <input id="precheck-website" value={website} onChange={(event) => setWebsite(event.target.value)} autoComplete="off" tabIndex={-1} maxLength={200} />
      </div>

      <p className="precheck__privacy-note">
        Текст ситуации и контакты поступят компании вместе с заявкой. Порядок обработки описан в{" "}
        <a href="/privacy" target="_blank" rel="noreferrer">Политике обработки данных</a>.
      </p>
      <div className={`consent${errors.agree ? " consent--error" : ""}`}>
        <input
          ref={agreeRef}
          id="precheck-personal-consent"
          type="checkbox"
          checked={agree}
          onChange={(event) => {
            setAgree(event.target.checked);
            clearError("agree");
          }}
          aria-invalid={Boolean(errors.agree)}
          aria-describedby={errors.agree ? "precheck-consent-error" : undefined}
          aria-required="true"
          required
        />
        <span>
          <label htmlFor="precheck-personal-consent">Даю отдельное согласие на обработку персональных данных</label>
          {" "}(<a href="/personal-data-consent" target="_blank" rel="noreferrer">текст согласия</a>).
        </span>
      </div>
      {errors.agree ? <span id="precheck-consent-error" className="field__error field__error--consent" role="alert">Нужно согласие на обработку данных</span> : null}

      <label className="consent precheck__consent">
        <input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} />
        <span>
          Согласен на передачу очищенного описания в Cloudflare Workers AI для предварительной систематизации
          ({" "}<a href="/ai-processing-consent" target="_blank" rel="noreferrer">условия</a>).
        </span>
      </label>
      <p className="precheck__optional">Необязательно. Без отметки карта сформируется в базовом режиме.</p>
    </div>
  );

  const renderResult = () => (
    <article className="precheck-card">
      <div className="precheck-card__topline">
        <span>{leadSent ? "Заявка отправлена" : "Отправка не завершена"}</span>
        <strong>Предварительный разбор</strong>
      </div>
      <div className={`precheck-card__delivery${leadSent ? " is-success" : " is-error"}`}>
        <strong>{leadSent ? "Обращение уже у юриста" : "Автоматическая отправка не завершена"}</strong>
        <p>{leadSent
          ? "Описание ситуации и рабочая сводка переданы юристу. Мы свяжемся с вами по указанному номеру в рабочее время."
          : error}</p>
        {!leadSent && mailHref ? <a href={mailHref}>Отправить подготовленное письмо</a> : null}
      </div>
      <div className="precheck-card__client-summary">
        <span>Направление обращения</span>
        <h3>{result.practice}</h3>
        <p>{leadSent
          ? "Дополнительных действий сейчас не требуется. Юрист проверит вводные и при необходимости уточнит детали лично."
          : "Предварительная систематизация завершена. Проверьте контакты или отправьте подготовленное письмо."}</p>
      </div>
      <p className="precheck-card__disclaimer">Предварительная систематизация помогает юристу быстрее ознакомиться с задачей и не является юридическим заключением.</p>
      <div className="precheck__actions precheck__actions--result">
        {!leadSent ? <button type="button" className="action action--light" onClick={() => { setStatus("editing"); setStep(1); }}><span>Проверить контакты</span></button> : null}
        <button type="button" className="text-link" onClick={reset}>Отправить ещё одно обращение</button>
      </div>
    </article>
  );

  const title = status === "result" ? (leadSent ? "Заявка отправлена" : "Заявка подготовлена") : STEP_TITLES[step];
  const copy = status === "result"
    ? (leadSent ? "Вам больше ничего делать не нужно — юрист свяжется с вами в рабочее время." : "Проверьте контакты или отправьте подготовленное письмо.")
    : STEP_COPY[step];

  return (
    <section className="precheck" aria-labelledby="precheck-heading" aria-busy={status === "submitting"}>
      <div className="precheck__progress" aria-hidden="true">
        <span>{status === "result" ? "Готово" : `${String(step + 1).padStart(2, "0")} / 02`}</span>
        <i style={{ width: `${status === "result" ? 100 : ((step + 1) / TOTAL_STEPS) * 100}%` }} />
      </div>
      <div className="precheck__intro">
        <p className="eyebrow">Предварительный разбор · около 1 минуты</p>
        <h3 id="precheck-heading" ref={headingRef} tabIndex={-1}>{title}</h3>
        <p>{copy}</p>
      </div>
      <p className={`precheck__status${error ? " is-error" : ""}`} role="status" aria-live="polite">
        {status === "result" ? "" : (error || announcement)}
      </p>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          className="precheck__step"
          key={status === "result" ? "result" : `step-${step}`}
          initial={reduceMotion ? false : { opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, x: -12 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          {status === "result" && result ? renderResult() : step === 0 ? renderSituation() : renderContacts()}
        </motion.div>
      </AnimatePresence>
      {status !== "result" ? (
        <div className="precheck__actions">
          {step > 0
            ? <button type="button" className="text-link" onClick={() => { setStep(0); setError(""); setErrors({}); }} disabled={status === "submitting"}>Назад</button>
            : <button type="button" className="text-link" onClick={onChooseQuickForm}>Перейти к быстрой заявке</button>}
          {step === 0
            ? <button type="button" className="action action--dark" onClick={continueToContacts}><span>Продолжить</span></button>
            : <button type="button" className="action action--dark precheck__submit" onClick={submit} disabled={status === "submitting"}><span>{status === "submitting" ? "Формируем и отправляем…" : "Получить разбор и отправить заявку"}</span></button>}
        </div>
      ) : null}
    </section>
  );
}
