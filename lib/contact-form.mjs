const FIELD_LIMITS = Object.freeze({
  name: 80,
  phone: 32,
  service: 120,
  message: 2000,
  website: 200,
  submissionId: 100,
});

function cleanText(value, maxLength, preserveLines = false) {
  const text = String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);

  return preserveLines ? text.replace(/\r\n?/g, "\n") : text.replace(/\s+/g, " ");
}

export function normalizeContactPayload(payload = {}) {
  const source = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};

  return {
    name: cleanText(source.name, FIELD_LIMITS.name),
    phone: cleanText(source.phone, FIELD_LIMITS.phone),
    service: cleanText(source.service, FIELD_LIMITS.service),
    message: cleanText(source.message, FIELD_LIMITS.message, true),
    website: cleanText(source.website, FIELD_LIMITS.website),
    submissionId: cleanText(source.submissionId, FIELD_LIMITS.submissionId),
    agree: source.agree === true,
  };
}

export function validateContactPayload(payload) {
  const lead = normalizeContactPayload(payload);
  const phoneDigits = lead.phone.replace(/\D/g, "");
  const errors = {
    name: lead.name.length < 2,
    phone: phoneDigits.length !== 11 || !phoneDigits.startsWith("7"),
    service: lead.service.length < 2,
    message: lead.message.length > FIELD_LIMITS.message,
    agree: !lead.agree,
    submissionId: !/^[A-Za-z0-9-]{8,100}$/.test(lead.submissionId),
  };

  return {
    ok: !Object.values(errors).some(Boolean),
    bot: lead.website.length > 0,
    errors,
    lead,
  };
}
