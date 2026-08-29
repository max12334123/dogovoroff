"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  getAuthConfirmUrl,
  getAuthRequestErrorCode,
  getSafeNextPath,
  isValidEmail,
  normalizeEmail,
} from "../../features/auth/auth-domain.mjs";
import { getCaptchaConfig, getCaptchaToken } from "../../features/auth/captcha-domain.mjs";
import { createClient } from "../../lib/supabase/server";

export async function requestLoginLink(formData) {
  const email = normalizeEmail(formData.get("email"));
  const next = getSafeNextPath(formData.get("next"));
  const nextParam = encodeURIComponent(next);

  if (!isValidEmail(email)) {
    redirect(`/login?error=invalid-email&next=${nextParam}`);
  }

  const captchaConfig = getCaptchaConfig();
  const captchaToken = getCaptchaToken(formData.get("captchaToken"));
  if (captchaConfig.enabled && !captchaToken) {
    redirect(`/login?error=captcha-required&next=${nextParam}`);
  }

  const requestHeaders = await headers();
  const forwardedProto = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  const host = requestHeaders.get("host")?.trim() || "";
  const requestOrigin = /^https?$/.test(forwardedProto) && /^(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/.test(host)
    ? `${forwardedProto}://${host}`
    : "";
  const redirectUrl = new URL(getAuthConfirmUrl({ requestOrigin }));
  redirectUrl.searchParams.set("next", next);

  const authOptions = {
    emailRedirectTo: redirectUrl.toString(),
    shouldCreateUser: true,
  };
  if (captchaConfig.enabled) {
    authOptions.captchaToken = captchaToken;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: authOptions,
  });

  if (error) {
    console.error("Supabase authentication request failed", {
      code: error.code,
      status: error.status,
    });
    redirect(`/login?error=${getAuthRequestErrorCode(error)}&next=${nextParam}`);
  }

  redirect(`/login?sent=1&next=${nextParam}`);
}
