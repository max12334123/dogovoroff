import { createHash } from "node:crypto";

export function jsonResponse(body, status, headers = {}) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
      ...headers,
    },
  });
}

export function hasTrustedBrowserOrigin(request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const requestUrl = new URL(request.url);
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const forwardedHost = (
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    ""
  ).split(",")[0].trim();
  const acceptedOrigins = new Set([requestUrl.origin]);

  if (forwardedHost) {
    acceptedOrigins.add(
      `${forwardedProtocol || requestUrl.protocol.slice(0, -1)}://${forwardedHost}`,
    );
  }

  if (!origin || !acceptedOrigins.has(origin)) return false;
  return !fetchSite || fetchSite === "same-origin" || fetchSite === "same-site";
}

export function getHashedClientKey(request) {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-forwarded-for") ||
    "unknown";
  const address = forwarded.split(",")[0].trim().slice(0, 128);

  return createHash("sha256").update(address).digest("hex");
}

export async function readJsonBody(request, maxBytes) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > maxBytes) {
    return {
      ok: false,
      status: 413,
      error: "Запрос превышает допустимый размер.",
    };
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > maxBytes) {
    return {
      ok: false,
      status: 413,
      error: "Запрос превышает допустимый размер.",
    };
  }

  try {
    return { ok: true, value: JSON.parse(rawBody) };
  } catch {
    return {
      ok: false,
      status: 400,
      error: "Некорректный формат запроса.",
    };
  }
}

export function consumeRateLimit(store, clientKey, options, now = Date.now()) {
  const { windowMs, maxRequests, maxClients } = options;

  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }

  while (store.size >= maxClients && !store.has(clientKey)) {
    const oldestKey = store.keys().next().value;
    if (!oldestKey) break;
    store.delete(oldestKey);
  }

  const current = store.get(clientKey);
  if (!current) {
    store.set(clientKey, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (current.count >= maxRequests) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfter: 0 };
}
