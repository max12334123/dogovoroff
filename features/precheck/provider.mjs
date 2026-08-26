import { PRECHECK_PRACTICES } from "./config.mjs";
import {
  normalizePrecheckPayload,
  validateProviderResult,
} from "./domain.mjs";

const MAX_RESPONSE_BYTES = 24_576;
const DEFAULT_TIMEOUT_MS = 45_000;

function workerEndpoint(workerUrl) {
  if (typeof workerUrl !== "string" || !workerUrl.trim()) return null;
  try {
    const url = new URL(workerUrl);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return new URL("/v1/precheck", url).toString();
  } catch {
    return null;
  }
}

function buildMinimizedInput(input) {
  const normalized = normalizePrecheckPayload(input);
  if (!normalized.ok) return null;
  const practice = PRECHECK_PRACTICES.find(({ id }) => id === normalized.value.practiceId);
  if (!practice) return null;

  return {
    version: normalized.value.version,
    practiceId: practice.id,
    practiceLabel: practice.label,
    answers: Object.fromEntries(
      Object.entries(normalized.value.answers)
        .filter(([key, value]) => practice.questions.some((question) => (
          question.id === key
          && (question.type === "radio" || question.type === "select")
          && question.options.some(([optionId]) => optionId === value)
        ))),
    ),
    description: [
      "Свободный текст обращения не передан модели.",
      normalized.value.description.length < 200
        ? "Объём описания: краткий."
        : normalized.value.description.length < 700
          ? "Объём описания: средний."
          : "Объём описания: подробный.",
      normalized.value.answers.deadline
        ? "Клиент указал наличие срока."
        : "Конкретный срок не указан.",
    ].join(" "),
  };
}

async function readProviderJson(response) {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_RESPONSE_BYTES) {
    return { ok: false, reason: "response_too_large" };
  }

  const reader = response.body?.getReader();
  const chunks = [];
  let receivedBytes = 0;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel("Provider response limit exceeded").catch(() => {});
        return { ok: false, reason: "response_too_large" };
      }
      chunks.push(value);
    }
  }

  const bytes = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return {
      ok: true,
      value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}

function reportDiagnostic(callback, diagnostic) {
  if (typeof callback !== "function") return;
  try { callback(diagnostic); } catch {}
}

export async function requestCloudflarePrecheck({
  workerUrl,
  oidcToken,
  input,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  onDiagnostic,
}) {
  const endpoint = workerEndpoint(workerUrl);
  const minimized = buildMinimizedInput(input);
  if (!endpoint
    || typeof oidcToken !== "string"
    || !oidcToken
    || oidcToken.length > 16_384
    || typeof fetchImpl !== "function"
    || !minimized) {
    reportDiagnostic(onDiagnostic, { ok: false, reason: "invalid_configuration", status: null });
    return null;
  }

  const boundedTimeout = Number.isFinite(timeoutMs)
    ? Math.min(50_000, Math.max(1, timeoutMs))
    : DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("provider timeout")), boundedTimeout);
  timer.unref?.();

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${oidcToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(minimized),
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response?.ok) {
      reportDiagnostic(onDiagnostic, {
        ok: false,
        reason: "http_error",
        status: Number.isInteger(response?.status) ? response.status : null,
      });
      return null;
    }

    const parsed = await readProviderJson(response);
    if (!parsed.ok) {
      reportDiagnostic(onDiagnostic, { ok: false, reason: parsed.reason, status: response.status });
      return null;
    }
    if (parsed.value?.success !== true) {
      reportDiagnostic(onDiagnostic, { ok: false, reason: "invalid_payload", status: response.status });
      return null;
    }
    const validated = validateProviderResult(parsed.value.result);
    if (!validated.ok) {
      reportDiagnostic(onDiagnostic, { ok: false, reason: "invalid_result", status: response.status });
      return null;
    }
    reportDiagnostic(onDiagnostic, { ok: true, reason: "success", status: response.status });
    return validated.value;
  } catch {
    reportDiagnostic(onDiagnostic, {
      ok: false,
      reason: controller.signal.aborted ? "timeout" : "network_error",
      status: null,
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}
