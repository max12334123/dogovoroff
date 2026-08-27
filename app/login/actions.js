"use server";

import { redirect } from "next/navigation";
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

  const redirectUrl = new URL(getAuthConfirmUrl());
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
