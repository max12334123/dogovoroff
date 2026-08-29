import { NextResponse } from "next/server";
import {
  getAuthConfirmationErrorCode,
  getSafeNextPath,
} from "../../../features/auth/auth-domain.mjs";
import { createClient } from "../../../lib/supabase/server";

const EMAIL_OTP_TYPES = new Set(["email", "signup", "invite", "magiclink", "recovery", "email_change"]);

export async function GET(request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const code = url.searchParams.get("code");
  const next = getSafeNextPath(url.searchParams.get("next"));
  const supabase = await createClient();

  let authError = null;
  if (tokenHash && type && EMAIL_OTP_TYPES.has(type)) {
    ({ error: authError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else if (code) {
    ({ error: authError } = await supabase.auth.exchangeCodeForSession(code));
  } else {
    authError = new Error("Missing authentication code");
  }

  const cleanUrl = request.nextUrl.clone();
  cleanUrl.search = "";

  if (authError) {
    console.error("Supabase auth confirmation failed", {
      code: authError.code,
      status: authError.status,
    });
    cleanUrl.pathname = "/login";
    cleanUrl.searchParams.set("error", getAuthConfirmationErrorCode(authError));
    cleanUrl.searchParams.set("next", next);
    return NextResponse.redirect(cleanUrl);
  }

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) {
    cleanUrl.pathname = "/login";
    cleanUrl.searchParams.set("error", "confirm-failed");
    return NextResponse.redirect(cleanUrl);
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: userId, display_name: "Клиент" }, { onConflict: "id", ignoreDuplicates: true });

  if (profileError) {
    console.error("Supabase profile bootstrap failed", {
      code: profileError.code,
    });
    await supabase.auth.signOut();
    cleanUrl.pathname = "/login";
    cleanUrl.searchParams.set("error", "confirm-failed");
    return NextResponse.redirect(cleanUrl);
  }

  const nextUrl = new URL(next, cleanUrl.origin);
  cleanUrl.pathname = nextUrl.pathname;
  cleanUrl.search = nextUrl.search;
  cleanUrl.hash = nextUrl.hash;
  return NextResponse.redirect(cleanUrl);
}
