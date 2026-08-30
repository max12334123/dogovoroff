"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../../lib/supabase/server";

const NOTIFICATION_ERROR = "Не удалось обновить уведомления. Попробуйте ещё раз.";

export async function markAllNotificationsRead() {
  try {
    const supabase = await createClient();
    const { data, error: claimsError } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;

    if (claimsError || !userId) {
      return { ok: false, message: "Сессия истекла. Войдите повторно." };
    }

    const readAt = new Date().toISOString();
    const { data: profile, error } = await supabase
      .from("profiles")
      .update({ notifications_read_at: readAt })
      .eq("id", userId)
      .select("id")
      .maybeSingle();

    if (error || !profile) {
      console.error("Notification read marker update failed", {
        code: error?.code,
        status: error?.status,
      });
      return { ok: false, message: NOTIFICATION_ERROR };
    }

    revalidatePath("/cabinet");
    revalidatePath("/staff");
    return { ok: true, readAt };
  } catch (error) {
    console.error("Notification read marker update crashed", {
      code: error?.code,
      status: error?.status,
    });
    return { ok: false, message: NOTIFICATION_ERROR };
  }
}
