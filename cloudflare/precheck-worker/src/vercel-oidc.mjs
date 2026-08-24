const JWKS_CACHE_TTL_MS = 5 * 60 * 1_000;
const CLOCK_TOLERANCE_SECONDS = 60;
const ALLOWED_ENVIRONMENTS = new Set(["production", "preview", "development"]);
const sharedJwksCache = new Map();

function decodeBase64url(segment) {
  if (typeof segment !== "string" || !segment || !/^[A-Za-z0-9_-]+$/u.test(segment)) {
    throw new Error("invalid token encoding");
  }
  const padding = "=".repeat((4 - (segment.length % 4)) % 4);
  const base64 = segment.replace(/-/gu, "+").replace(/_/gu, "/") + padding;
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJsonSegment(segment) {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64url(segment)));
  } catch {
    throw new Error("invalid token JSON");
  }
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function assertConfig(config) {
  const requiredKeys = [
    "issuer",
    "audience",
    "ownerId",
    "ownerSlug",
    "projectId",
    "projectName",
  ];
  if (!isRecord(config) || requiredKeys.some((key) => typeof config[key] !== "string" || !config[key])) {
    throw new Error("invalid verifier configuration");
  }
  const issuer = new URL(config.issuer);
  if (issuer.protocol !== "https:") throw new Error("invalid verifier issuer");
}

async function fetchJwks(config, dependencies) {
  const fetchFn = dependencies.fetch || globalThis.fetch;
  const now = dependencies.now ? dependencies.now() : Date.now();
  const cache = dependencies.cache || sharedJwksCache;
  const cached = cache.get(config.issuer);
  if (cached?.expiresAt > now) return cached.keys;

  const response = await fetchFn(`${config.issuer.replace(/\/$/u, "")}/.well-known/jwks`, {
    headers: { accept: "application/json" },
    redirect: "error",
  });
  if (!response?.ok) throw new Error("unable to load JWKS");

  const body = await response.json();
  if (!isRecord(body) || !Array.isArray(body.keys) || body.keys.length > 20) {
    throw new Error("invalid JWKS");
  }
  cache.set(config.issuer, { keys: body.keys, expiresAt: now + JWKS_CACHE_TTL_MS });
  return body.keys;
}

function validateClaims(payload, config, nowMilliseconds) {
  if (!isRecord(payload)) throw new Error("invalid token claims");
  const nowSeconds = Math.floor(nowMilliseconds / 1_000);
  if (!Number.isFinite(payload.exp) || payload.exp < nowSeconds - CLOCK_TOLERANCE_SECONDS) {
    throw new Error("expired token");
  }
  if (payload.nbf !== undefined
    && (!Number.isFinite(payload.nbf) || payload.nbf > nowSeconds + CLOCK_TOLERANCE_SECONDS)) {
    throw new Error("inactive token");
  }
  if (payload.iss !== config.issuer) throw new Error("invalid issuer");

  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(config.audience)) throw new Error("invalid audience");
  if (payload.owner_id !== config.ownerId || payload.project_id !== config.projectId) {
    throw new Error("invalid project");
  }
  if (!ALLOWED_ENVIRONMENTS.has(payload.environment)) throw new Error("invalid environment");

  const expectedSubject = `owner:${config.ownerSlug}:project:${config.projectName}:environment:${payload.environment}`;
  if (payload.sub !== expectedSubject) throw new Error("invalid subject");
}

export async function verifyVercelOidc(token, config, dependencies = {}) {
  assertConfig(config);
  if (typeof token !== "string" || token.length > 16_384) throw new Error("invalid token");

  const segments = token.split(".");
  if (segments.length !== 3) throw new Error("invalid token");
  const [encodedHeader, encodedPayload, encodedSignature] = segments;
  const header = decodeJsonSegment(encodedHeader);
  const payload = decodeJsonSegment(encodedPayload);

  if (!isRecord(header) || header.alg !== "RS256" || typeof header.kid !== "string" || !header.kid) {
    throw new Error("invalid token header");
  }

  const keys = await fetchJwks(config, dependencies);
  const jwk = keys.find((candidate) => (
    isRecord(candidate)
    && candidate.kid === header.kid
    && candidate.kty === "RSA"
    && (!candidate.alg || candidate.alg === "RS256")
    && (!candidate.use || candidate.use === "sig")
  ));
  if (!jwk) throw new Error("signing key not found");

  let publicKey;
  try {
    publicKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
  } catch {
    throw new Error("invalid signing key");
  }

  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    decodeBase64url(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  );
  if (!verified) throw new Error("invalid signature");

  const now = dependencies.now ? dependencies.now() : Date.now();
  validateClaims(payload, config, now);
  return payload;
}
