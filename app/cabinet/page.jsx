import CabinetClient from "../../features/cabinet/cabinet-client";
import { loadCabinetData } from "../../features/cabinet/cabinet-server";
import { createClient } from "../../lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Личный кабинет",
  description: "Защищённый личный кабинет клиента ДоговорОфф.",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default async function CabinetPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    redirect("/login?next=/cabinet");
  }

  const [{ data: profile }, matters] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    loadCabinetData(supabase, userId),
  ]);

  return <CabinetClient initialMatters={matters} displayName={profile?.display_name || "Клиент"} />;
}
