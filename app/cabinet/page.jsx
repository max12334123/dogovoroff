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

  const [{ data: profile }, { data: memberships }, matters] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    supabase.from("organization_members").select("role").eq("user_id", userId),
    loadCabinetData(supabase, userId),
  ]);

  const hasStaffRole = memberships?.some((membership) => membership.role === "admin" || membership.role === "lawyer");

  return (
    <CabinetClient
      initialMatters={matters}
      displayName={profile?.display_name || "Клиент"}
      staffHref={hasStaffRole ? "/staff" : null}
    />
  );
}
