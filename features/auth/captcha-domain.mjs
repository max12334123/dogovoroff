const SUPPORTED_PROVIDERS = new Set(["turnstile", "hcaptcha"]);
const MAX_SITE_KEY_LENGTH = 256;
const MAX_TOKEN_LENGTH = 4096;

function normalizeValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isSafeSiteKey(value) {
  return value.length > 0 && value.length <= MAX_SITE_KEY_LENGTH && !/[\u0000-\u001f\u007f]/.test(value);
}

/**
 * Reads an opt-in CAPTCHA configuration without exposing provider secrets.
 * Supabase Auth still needs to be configured in its dashboard before this
 * flag can be enabled in a deployed environment.
 */
export function getCaptchaConfig(env = process.env) {
  const enabled = normalizeValue(env?.AUTH_CAPTCHA_ENABLED).toLowerCase() === "true";
  const provider = normalizeValue(env?.AUTH_CAPTCHA_PROVIDER).toLowerCase();
  const siteKey = normalizeValue(env?.NEXT_PUBLIC_AUTH_CAPTCHA_SITE_KEY);

  if (!enabled || !SUPPORTED_PROVIDERS.has(provider) || !isSafeSiteKey(siteKey)) {
    return { enabled: false, provider: "", siteKey: "" };
  }

  return { enabled: true, provider, siteKey };
}

export function isSupportedCaptchaProvider(value) {
  return SUPPORTED_PROVIDERS.has(normalizeValue(value).toLowerCase());
}

export function getCaptchaToken(value) {
  const token = normalizeValue(value);
  if (!token || token.length > MAX_TOKEN_LENGTH || /[\u0000-\u001f\u007f]/.test(token)) {
    return "";
  }

  return token;
}

export function getCaptchaCspOrigins(config) {
  const provider = normalizeValue(config?.provider).toLowerCase();
  if (config?.enabled !== true || !SUPPORTED_PROVIDERS.has(provider) || !isSafeSiteKey(normalizeValue(config?.siteKey))) {
    return { script: [], connect: [], frame: [] };
  }

  if (provider === "turnstile") {
    return {
      script: ["https://challenges.cloudflare.com"],
      connect: ["https://challenges.cloudflare.com"],
      frame: ["https://challenges.cloudflare.com"],
    };
  }

  return {
    script: ["https://js.hcaptcha.com", "https://newassets.hcaptcha.com"],
    connect: ["https://hcaptcha.com", "https://*.hcaptcha.com"],
    frame: ["https://hcaptcha.com", "https://*.hcaptcha.com"],
  };
}
