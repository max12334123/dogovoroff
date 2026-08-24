import { PRECHECK_PRACTICES } from "./config.mjs";
import {
  maskSensitiveText,
  normalizePrecheckPayload,
  validateProviderResult,
} from "./domain.mjs";

const MAX_RESPONSE_BYTES = 24_576;
const DEFAULT_TIMEOUT_MS = 25_000;

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
    version: "1",
    practiceId: practice.id,
    practiceLabel: practice.label,
    answers: Object.fromEntries(
      Object.entries(normalized.value.answers).map(([key, value]) => [key, maskSensitiveText(value)]),
    ),
    description: maskSensitiveText(normalized.value.description),
  };
}

async function readProviderJson(response) {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_RESPONSE_BYTES) return null;
  const raw = await response.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_RESPONSE_BYTES) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function requestCloudflarePrecheck({
  workerUrl,
  oidcToken,
  input,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const endpoint = workerEndpoint(workerUrl);
  const minimized = buildMinimizedInput(input);
  if (!endpoint
    || typeof oidcToken !== "string"
    || !oidcToken
    || oidcToken.length > 16_384
    || typeof fetchImpl !== "function"
    || !minimized) {
    return null;
  }

  const boundedTimeout = Number.isFinite(timeoutMs)
    ? Math.min(30_000, Math.max(1, timeoutMs))
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
    if (!response?.ok) return null;

    const body = await readProviderJson(response);
    if (!body || body.success !== true) return null;
    const validated = validateProviderResult(body.result);
    return validated.ok ? validated.value : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
