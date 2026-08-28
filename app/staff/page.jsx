import Link from "next/link";
import { redirect } from "next/navigation";
import StaffClient from "../../features/staff/staff-client";
import { loadStaffData } from "../../features/staff/staff-server";
import { createClient } from "../../lib/supabase/server";
import styles from "../../features/staff/staff.module.css";

export const metadata = {
  title: "Рабочая панель",
  description: "Защищённая рабочая панель команды ДоговорОфф.",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default async function StaffPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    redirect("/login?next=/staff");
  }

  const [{ data: profile }, staffData] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    loadStaffData(supabase, userId),
  ]);

  if (!staffData) {
    redirect("/cabinet");
  }

  return (
    <div className={styles.pageShell}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Рабочая панель</p>
          <h1>Дела команды</h1>
          <p className={styles.headerMeta}>
            {staffData.roleLabel} · {profile?.display_name || "Команда ДоговорОфф"}
          </p>
        </div>
        <nav className={styles.headerNav} aria-label="Навигация рабочей панели">
          <Link href="/cabinet">Личный кабинет</Link>
          <form action="/auth/signout" method="post">
            <button type="submit">Выйти</button>
          </form>
        </nav>
      </header>
      <main className={styles.main}>
        <StaffClient
          initialMatters={staffData.matters}
          organizations={staffData.organizations}
          assignmentOrganizations={staffData.assignmentOrganizations}
          roleLabel={staffData.roleLabel}
        />
      </main>
    </div>
  );
}
