import { PRECHECK_PRACTICES, PRECHECK_PRACTICE_IDS } from "./config.mjs";
import { buildFallbackCard, normalizePrecheckPayload } from "./domain.mjs";

function createAnswers(practiceId) {
  const practice = PRECHECK_PRACTICES.find(({ id }) => id === practiceId);
  return practice
    ? Object.fromEntries(practice.questions.map(({ id }) => [id, ""]))
    : {};
}

export function createInitialPrecheckState(initialPracticeId = "") {
  const practiceId = PRECHECK_PRACTICE_IDS.includes(initialPracticeId) ? initialPracticeId : "";
  return {
    step: 0,
    practiceId,
    answers: createAnswers(practiceId),
    description: "",
    aiConsent: false,
    status: "editing",
    mode: null,
    result: null,
    error: "",
    announcement: "",
  };
}

export function reducePrecheckState(state, event) {
  switch (event?.type) {
    case "practice": {
      const practiceId = PRECHECK_PRACTICE_IDS.includes(event.value) ? event.value : "";
      return {
        ...createInitialPrecheckState(practiceId),
        step: state.step,
      };
    }
    case "answer":
      if (!Object.prototype.hasOwnProperty.call(state.answers, event.key)) return state;
      return {
        ...state,
        answers: { ...state.answers, [event.key]: String(event.value ?? "") },
        status: "editing",
        error: "",
        announcement: "",
      };
    case "description":
      return {
        ...state,
        description: String(event.value ?? "").slice(0, 1_200),
        status: "editing",
        error: "",
        announcement: "",
      };
    case "consent":
      return { ...state, aiConsent: event.value === true, error: "" };
    case "next":
      return { ...state, step: Math.min(4, state.step + 1), error: "", announcement: "" };
    case "back":
      return {
        ...state,
        step: Math.max(0, state.step - 1),
        status: "editing",
        error: "",
        announcement: "",
      };
    case "generating":
      return { ...state, status: "generating", error: "", announcement: "Формируем карту ситуации…" };
    case "result":
      return {
        ...state,
        status: "result",
        mode: event.mode === "ai" ? "ai" : "fallback",
        result: event.result,
        error: "",
        announcement: event.mode === "ai"
          ? "Карта ситуации сформирована"
          : "Карта сформирована в базовом режиме",
      };
    case "error":
      return {
        ...state,
        status: "error",
        error: String(event.message || "Проверьте ответы."),
        announcement: "",
      };
    case "reset":
      return createInitialPrecheckState(event.practiceId || "");
    default:
      return state;
  }
}

export function buildClientFallback(payload, now = new Date()) {
  const normalized = normalizePrecheckPayload(payload);
  if (!normalized.ok) return null;
  const practice = PRECHECK_PRACTICES.find(({ id }) => id === normalized.value.practiceId);
  const nonInterpretiveAnswers = { ...normalized.value.answers };

  for (const question of practice.questions) {
    if (question.type === "textarea") nonInterpretiveAnswers[question.id] = "";
  }

  return buildFallbackCard({
    ...normalized.value,
    answers: nonInterpretiveAnswers,
    description: "",
  }, now);
}
