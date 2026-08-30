import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import StaffClient from "../../features/staff/staff-client";
import { loadStaffData } from "../../features/staff/staff-server";
import { buildNotificationFeed } from "../../features/notifications/notification-domain.mjs";
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

const STAFF_DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Yekaterinburg",
});

function capitalize(value) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : "";
}

export default async function StaffPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    redirect("/login?next=/staff");
  }

  const [{ data: profile }, staffData] = await Promise.all([
    supabase.from("profiles").select("display_name,notifications_read_at").eq("id", userId).maybeSingle(),
    loadStaffData(supabase, userId),
  ]);

  if (!staffData) {
    redirect("/cabinet");
  }

  const staffName = profile?.display_name || "Команда ДоговорОфф";
  const notifications = buildNotificationFeed(staffData.matters, profile?.notifications_read_at);

  return (
    <div className={styles.pageShell}>
      <a className={styles.skipLink} href="#staff-main">Перейти к рабочей области</a>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="ДоговорОфф — вернуться на сайт">
          <span className={styles.brandMark}>
            <Image src="/media/dogovoroff-mark.png" alt="" width={64} height={64} sizes="44px" priority />
          </span>
          <span className={styles.brandName}>ДоговорОфф</span>
          <span className={styles.brandDescriptor}>Рабочая панель</span>
        </Link>

        <div className={styles.accountSummary}>
          <span>{staffName}</span>
          <strong>{staffData.roleLabel}</strong>
        </div>

        <nav className={styles.headerNav} aria-label="Навигация аккаунта">
          <Link href="/cabinet">Личный кабинет</Link>
          <form action="/auth/signout" method="post">
            <button type="submit">Выйти</button>
          </form>
        </nav>
      </header>

      <main className={styles.main} id="staff-main">
        <StaffClient
          initialMatters={staffData.matters}
          initialNotifications={notifications}
          initialIntakeRequests={staffData.intakeRequests}
          intakeEnabled={staffData.intakeEnabled}
          initialAuditEvents={staffData.auditEvents}
          canViewAudit={staffData.canViewAudit}
          organizations={staffData.organizations}
          assignmentOrganizations={staffData.assignmentOrganizations}
          todayLabel={capitalize(STAFF_DATE_FORMATTER.format(new Date()))}
        />
      </main>
    </div>
  );
}
