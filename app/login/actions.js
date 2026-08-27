"use server";

import { redirect } from "next/navigation";
import { getAuthConfirmUrl, getSafeNextPath, isValidEmail, normalizeEmail } from "../../features/auth/auth-domain.mjs";
import { createClient } from "../../lib/supabase/server";

export async function requestLoginLink(formData) {
  const email = normalizeEmail(formData.get("email"));
  const next = getSafeNextPath(formData.get("next"));
  const nextParam = encodeURIComponent(next);

  if (!isValidEmail(email)) {
    redirect(`/login?error=invalid-email&next=${nextParam}`);
  }

  const redirectUrl = new URL(getAuthConfirmUrl());
  redirectUrl.searchParams.set("next", next);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectUrl.toString(),
      shouldCreateUser: true,
    },
  });

  if (error) {
    console.error("Supabase authentication request failed", {
      code: error.code,
      status: error.status,
    });
    redirect(`/login?error=send-failed&next=${nextParam}`);
  }

  redirect(`/login?sent=1&next=${nextParam}`);
}
