"use client";

import { track } from "@vercel/analytics";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useReducer, useRef } from "react";
import { PRECHECK_PRACTICES } from "./config.mjs";
import { buildConfirmedExcerpt, normalizePrecheckPayload } from "./domain.mjs";
import {
  buildClientFallback,
  createInitialPrecheckState,
  reducePrecheckState,
} from "./client-state.mjs";

const TOTAL_STEPS = 5;
const COMMON_CONTEXT_IDS = new Set(["applicantType", "stage"]);
const COMMON_DETAIL_IDS = new Set(["goal", "deadline"]);
const STEP_TITLES = [
  "Выберите направление",
  "Определим контекст",
  "Уточним детали",
  "Зафиксируем цель и срок",
  "Получите карту ситуации",
];
const STEP_COPY = [
  "Выберите ближайшее направление. Если сомневаетесь, начните с частного вопроса.",
  "Два коротких ответа помогут выстроить дальнейшие вопросы.",
  "Уточнения зависят только от выбранного направления.",
  "Опишите цель без персональных данных. Дату можно не указывать, если она неизвестна.",
  "Проверьте вводные. AI-обработка необязательна и не влияет на возможность получить базовую карту.",
];

function isUsableCard(value) {
  return Boolean(
    value
    && typeof value === "object"
    && typeof value.version === "string"
    && typeof value.practice === "string"
    && typeof value.summary === "string"
    && value.urgency
    && typeof value.urgency.label === "string"
    && Array.isArray(value.missingInformation)
    && Array.isArray(value.suggestedDocuments)
    && Array.isArray(value.lawyerQuestions)
    && typeof value.nextStep === "string"
    && typeof value.disclaimer === "string"
  );
}

function QuestionField({ question, value, onChange }) {
  const required = question.required !== false;
  const fieldId = `precheck-${question.id}`;

  if (question.type === "radio") {
    return (
      <fieldset className="precheck__question">
        <legend>{question.label}{required ? <span aria-hidden="true"> *</span> : null}</legend>
        <div className="precheck__options">
          {question.options.map(([optionId, label]) => (
            <label key={optionId} className={value === optionId ? "is-selected" : ""}>
              <input
                type="radio"
                name={fieldId}
                value={optionId}
                checked={value === optionId}
                onChange={(event) => onChange(event.target.value)}
                required={required}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (question.type === "select") {
    return (
      <div className="precheck__field">
        <label htmlFor={fieldId}>{question.label}{required ? <span aria-hidden="true"> *</span> : null}</label>
        <select id={fieldId} value={value} onChange={(event) => onChange(event.target.value)} required={required}>
          <option value="">Выберите вариант</option>
          {question.options.map(([optionId, label]) => <option key={optionId} value={optionId}>{label}</option>)}
        </select>
      </div>
    );
  }

  if (question.type === "date") {
    return (
      <div className="precheck__field">
        <label htmlFor={fieldId}>{question.label}</label>
        <input id={fieldId} type="date" value={value} onChange={(event) => onChange(event.target.value)} />
        <small>Оставьте пустым, если дата неизвестна.</small>
      </div>
    );
  }

  return (
    <div className="precheck__field">
      <label htmlFor={fieldId}>{question.label}{required ? <span aria-hidden="true"> *</span> : null}</label>
      <textarea
        id={fieldId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        rows={3}
        maxLength={question.maxLength}
      />
      <small>{value.length} / {question.maxLength}</small>
    </div>
  );
}

function ResultList({ title, items }) {
  if (!items.length) return null;
  return (
    <div className="precheck-card__list">
      <h4>{title}</h4>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </div>
  );
}

export default function PrecheckSection({
  initialPracticeId = "",
  onUseSummary,
  onChooseQuickForm,
}) {
  const [state, dispatch] = useReducer(
    reducePrecheckState,
    initialPracticeId,
    createInitialPrecheckState,
  );
  const headingRef = useRef(null);
  const startedRef = useRef(false);
  const reduceMotion = useReducedMotion();
  const practice = useMemo(
    () => PRECHECK_PRACTICES.find(({ id }) => id === state.practiceId) || null,
    [state.practiceId],
  );
  const contextQuestions = practice?.questions.filter(({ id }) => COMMON_CONTEXT_IDS.has(id)) || [];
  const detailQuestions = practice?.questions.filter(({ id }) => COMMON_DETAIL_IDS.has(id)) || [];
  const practiceQuestions = practice?.questions.filter(({ id }) => (
    !COMMON_CONTEXT_IDS.has(id) && !COMMON_DETAIL_IDS.has(id)
  )) || [];

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    try { track("precheck_started"); } catch {}
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => headingRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [state.step, state.status]);

  const answer = (key, value) => dispatch({ type: "answer", key, value });
  const questionsForStep = state.step === 1
    ? contextQuestions
    : state.step === 2
      ? practiceQuestions
      : state.step === 3
        ? detailQuestions
        : [];

  const stepIsComplete = () => {
    if (state.step === 0) return Boolean(practice);
    if (state.step >= 1 && state.step <= 3) {
      return questionsForStep.every((question) => (
        question.required === false || Boolean(state.answers[question.id]?.trim())
      ));
    }
    return true;
  };

  const goNext = () => {
    if (!stepIsComplete()) {
      dispatch({ type: "error", message: "Ответьте на отмеченные вопросы, чтобы продолжить." });
      return;
    }
    dispatch({ type: "next" });
  };

  const selectPractice = (practiceId) => {
    dispatch({ type: "practice", value: practiceId });
    try { track("precheck_practice_selected"); } catch {}
  };

  const payload = () => ({
    version: "1",
    practiceId: state.practiceId,
    answers: state.answers,
    description: state.description,
    aiConsent: state.aiConsent,
  });

  const generate = async () => {
    const currentPayload = payload();
    if (!normalizePrecheckPayload(currentPayload).ok) {
      dispatch({ type: "error", message: "Проверьте обязательные ответы перед формированием карты." });
      return;
    }

    dispatch({ type: "generating" });
    let mode = "fallback";
    let result = null;
    try {
      const response = await fetch("/api/precheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(currentPayload),
      });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.success === true && isUsableCard(body.result)) {
        mode = body.mode === "ai" ? "ai" : "fallback";
        result = body.result;
      }
    } catch {}

    if (!result) result = buildClientFallback(currentPayload);
    if (!result) {
      dispatch({ type: "error", message: "Не удалось сформировать карту. Вернитесь к ответам и попробуйте снова." });
      return;
    }

    dispatch({ type: "result", mode, result });
    try { track("precheck_completed"); } catch {}
    if (mode === "fallback") {
      try { track("precheck_fallback"); } catch {}
    }
  };

  const useSummary = () => {
    const excerpt = buildConfirmedExcerpt(state.result);
    if (!excerpt || typeof onUseSummary !== "function") return;
    onUseSummary({
      version: "1",
      mode: state.mode,
      practiceId: state.practiceId,
      excerpt,
    });
  };

  const stepContent = () => {
    if (state.step === 0) {
      return (
        <fieldset className="precheck__question precheck__question--practice">
          <legend>Направление ситуации</legend>
          <div className="precheck__options precheck__options--practice">
            {PRECHECK_PRACTICES.map((item, index) => (
              <label key={item.id} className={state.practiceId === item.id ? "is-selected" : ""}>
                <input
                  type="radio"
                  name="precheck-practice"
                  value={item.id}
                  checked={state.practiceId === item.id}
                  onChange={() => selectPractice(item.id)}
                  required
                />
                <span><em>{String(index + 1).padStart(2, "0")}</em>{item.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      );
    }

    if (state.step >= 1 && state.step <= 3) {
      return (
        <div className="precheck__questions">
          {questionsForStep.map((question) => (
            <QuestionField
              key={question.id}
              question={question}
              value={state.answers[question.id] || ""}
              onChange={(value) => answer(question.id, value)}
            />
          ))}
          {state.step === 3 ? (
            <div className="precheck__field">
              <label htmlFor="precheck-description">Короткое описание — необязательно</label>
              <textarea
                id="precheck-description"
                value={state.description}
                onChange={(event) => dispatch({ type: "description", value: event.target.value })}
                rows={5}
                maxLength={1_200}
                placeholder="Только факты, необходимые для первичного понимания ситуации"
              />
              <small>{state.description.length} / 1200</small>
            </div>
          ) : null}
        </div>
      );
    }

    if (state.status === "result" && state.result) {
      return (
        <article className="precheck-card">
          <div className="precheck-card__topline">
            <span>Карта ситуации</span>
            <strong>{state.mode === "ai" ? "AI + правила" : "Базовый режим"}</strong>
          </div>
          {state.mode === "fallback" ? <p className="precheck-card__mode-note">Карта сформирована в базовом режиме</p> : null}
          <p className="precheck-card__practice">{state.result.practice}</p>
          <h3>{state.result.summary}</h3>
          <div className={`precheck-card__urgency precheck-card__urgency--${state.result.urgency.level}`}>
            <span>{state.result.urgency.label}</span>
            <p>{state.result.urgency.reason}</p>
          </div>
          <div className="precheck-card__grid">
            <ResultList title="Что уточнить" items={state.result.missingInformation} />
            <ResultList title="Что подготовить" items={state.result.suggestedDocuments} />
            <ResultList title="Вопросы юриста" items={state.result.lawyerQuestions} />
          </div>
          <div className="precheck-card__next"><span>Следующий шаг</span><p>{state.result.nextStep}</p></div>
          <p className="precheck-card__disclaimer">{state.result.disclaimer}</p>
          <div className="precheck__actions precheck__actions--result">
            <button type="button" className="action action--light" onClick={useSummary}><span>Добавить к заявке</span></button>
            <button type="button" className="text-link" onClick={() => dispatch({ type: "reset" })}>Начать заново</button>
          </div>
        </article>
      );
    }

    return (
      <div className="precheck__review">
        <dl>
          <div><dt>Направление</dt><dd>{practice?.label}</dd></div>
          <div><dt>Ответов</dt><dd>{Object.values(state.answers).filter(Boolean).length}</dd></div>
          <div><dt>Описание</dt><dd>{state.description ? "Добавлено" : "Не добавлено"}</dd></div>
        </dl>
        <p className="precheck__privacy-note">
          Не указывайте ФИО, телефоны, адреса, реквизиты документов, банковские данные и сведения третьих лиц.
          Подробнее — в <a href="/privacy" target="_blank" rel="noreferrer">Политике обработки данных</a>.
        </p>
        <label className="consent precheck__consent">
          <input
            type="checkbox"
            checked={state.aiConsent}
            onChange={(event) => dispatch({ type: "consent", value: event.target.checked })}
          />
          <span>
            Согласен на передачу очищенного описания в Cloudflare Workers AI для предварительной систематизации
            ({" "}<a href="/ai-processing-consent" target="_blank" rel="noreferrer">условия</a>).
          </span>
        </label>
        <p className="precheck__optional">Без отметки карта будет сформирована локально по тем же понятным правилам.</p>
        <button
          type="button"
          className="action action--dark precheck__generate"
          onClick={generate}
          disabled={state.status === "generating"}
        >
          <span>{state.status === "generating" ? "Формируем…" : "Сформировать карту"}</span>
        </button>
      </div>
    );
  };

  return (
    <section className="precheck" aria-labelledby="precheck-heading" aria-busy={state.status === "generating"}>
      <div className="precheck__progress" aria-hidden="true">
        <span>{String(state.step + 1).padStart(2, "0")} / 05</span>
        <i style={{ width: `${((state.step + 1) / TOTAL_STEPS) * 100}%` }} />
      </div>
      <div className="precheck__intro">
        <p className="eyebrow">Предварительный разбор · около 2 минут</p>
        <h3 id="precheck-heading" ref={headingRef} tabIndex={-1}>{STEP_TITLES[state.step]}</h3>
        <p>{STEP_COPY[state.step]}</p>
      </div>
      <p className="precheck__status" role="status" aria-live="polite">
        {state.error || state.announcement}
      </p>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          className="precheck__step"
          key={`${state.step}-${state.status === "result" ? "result" : "questions"}`}
          initial={reduceMotion ? false : { opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, x: -12 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          {stepContent()}
        </motion.div>
      </AnimatePresence>
      {state.status !== "result" ? (
        <div className="precheck__actions">
          {state.step > 0 ? <button type="button" className="text-link" onClick={() => dispatch({ type: "back" })} disabled={state.status === "generating"}>Назад</button> : <button type="button" className="text-link" onClick={onChooseQuickForm}>Перейти к быстрой заявке</button>}
          {state.step < TOTAL_STEPS - 1 ? <button type="button" className="action action--dark" onClick={goNext}><span>Продолжить</span></button> : null}
        </div>
      ) : null}
    </section>
  );
}
