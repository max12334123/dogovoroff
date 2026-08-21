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

export async function readTextBodyWithLimit(request, maxBytes) {
  const reader = request.body?.getReader();
  if (!reader) return { ok: true, text: "" };

  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        await reader.cancel();
        return { ok: false, text: "" };
      }

      text += decoder.decode(value, { stream: true });
    }

    text += decoder.decode();
    return { ok: true, text };
  } finally {
    reader.releaseLock();
  }
}

export function consumeRateLimit(store, key, now = Date.now(), options = {}) {
  const windowMs = options.windowMs ?? 10 * 60 * 1000;
  const maxRequests = options.maxRequests ?? 5;
  const maxEntries = options.maxEntries ?? 1000;
  let current = store.get(key);

  if (!current && store.size >= maxEntries) {
    for (const [storedKey, entry] of store) {
      if (entry.resetAt <= now) store.delete(storedKey);
    }

    if (store.size >= maxEntries) {
      const oldestKey = store.keys().next().value;
      if (oldestKey !== undefined) store.delete(oldestKey);
    }

    current = store.get(key);
  }

  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, retryAfter: 0 };
  }

  if (current.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true, remaining: maxRequests - current.count, retryAfter: 0 };
}
