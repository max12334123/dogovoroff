import { PRECHECK_PRACTICE_IDS } from "../features/precheck/config.mjs";

const FIELD_LIMITS = Object.freeze({
  name: 80,
  phone: 32,
  service: 120,
  message: 2000,
  website: 200,
  submissionId: 100,
  precheckExcerpt: 1200,
});

const PRECHECK_KEYS = new Set(["version", "mode", "practiceId", "excerpt"]);
const SUBMISSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function cleanText(value, maxLength, preserveLines = false) {
  const text = String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);

  return preserveLines ? text.replace(/\r\n?/g, "\n") : text.replace(/\s+/g, " ");
}

function normalizePrecheckAttachment(value) {
  if (value === undefined || value === null) {
    return { provided: false, valid: true, value: null };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { provided: true, valid: false, value: null };
  }

  const keys = Object.keys(value);
  const exactShape = keys.length === PRECHECK_KEYS.size
    && keys.every((key) => PRECHECK_KEYS.has(key));
  const rawExcerpt = typeof value.excerpt === "string"
    ? value.excerpt
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .replace(/\r\n?/g, "\n")
      .trim()
    : "";
  const valid = exactShape
    && value.version === "1"
    && (value.mode === "ai" || value.mode === "fallback")
    && PRECHECK_PRACTICE_IDS.includes(value.practiceId)
    && rawExcerpt.length > 0
    && rawExcerpt.length <= FIELD_LIMITS.precheckExcerpt;

  return {
    provided: true,
    valid,
    value: valid
      ? {
        version: "1",
        mode: value.mode,
        practiceId: value.practiceId,
        excerpt: rawExcerpt,
      }
      : null,
  };
}

export function normalizeContactPayload(payload = {}) {
  const source = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const precheck = normalizePrecheckAttachment(source.precheck);

  return {
    name: cleanText(source.name, FIELD_LIMITS.name),
    phone: cleanText(source.phone, FIELD_LIMITS.phone),
    service: cleanText(source.service, FIELD_LIMITS.service),
    message: cleanText(source.message, FIELD_LIMITS.message, true),
    website: cleanText(source.website, FIELD_LIMITS.website),
    submissionId: cleanText(source.submissionId, FIELD_LIMITS.submissionId),
    agree: source.agree === true,
    precheck: precheck.value,
  };
}

export function validateContactPayload(payload) {
  const source = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const precheck = normalizePrecheckAttachment(source.precheck);
  const lead = normalizeContactPayload(payload);
  const phoneDigits = lead.phone.replace(/\D/g, "");
  const errors = {
    name: lead.name.length < 2,
    phone: phoneDigits.length !== 11 || !phoneDigits.startsWith("7"),
    service: lead.service.length < 2,
    message: lead.message.length > FIELD_LIMITS.message,
    agree: !lead.agree,
    submissionId: !SUBMISSION_ID_PATTERN.test(lead.submissionId),
    precheck: precheck.provided && !precheck.valid,
  };

  return {
    ok: !Object.values(errors).some(Boolean),
    bot: lead.website.length > 0,
    errors,
    lead,
  };
}
