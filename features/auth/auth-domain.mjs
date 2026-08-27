const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidEmail(value) {
  const email = normalizeEmail(value);
  return email.length <= 254 && SIMPLE_EMAIL_PATTERN.test(email);
}

export function getSafeNextPath(value, fallback = "/cabinet") {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "https://dogovoroff.local");
    if (parsed.origin !== "https://dogovoroff.local") {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function getAuthConfirmUrl() {
  const vercelOrigin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}`
    : "";
  // Authentication emails must return to the stable public origin. VERCEL_URL
  // identifies one deployment and is only a fallback for environments without
  // an explicitly configured canonical site URL.
  const configured =
    process.env.SUPABASE_AUTH_REDIRECT_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    vercelOrigin;
  if (!configured) {
    throw new Error("Не задан URL возврата после авторизации.");
  }

  const url = new URL(configured);
  if (!new Set(["http:", "https:"]).has(url.protocol)) {
    throw new Error("URL возврата после авторизации должен использовать HTTP или HTTPS.");
  }

  url.pathname = "/auth/confirm";
  url.search = "";
  url.hash = "";
  return url.toString();
}
