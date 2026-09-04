"use client";

import Image from "next/image";
import { AI_PRECHECK_HREF } from "../../lib/public-navigation.mjs";
import NotificationCenter from "../notifications/notification-center";
import { CABINET_VIEWS } from "./cabinet-data.mjs";
import styles from "./cabinet.module.css";

// Visible labels are sourced from CABINET_VIEWS: Главная, Мои дела, Документы, Сообщения.
function Brand() {
  return (
    <a className={styles.brand} href="/" aria-label="ДоговорОфф — вернуться на сайт">
      <span className={styles.brandMark}>
        <Image src="/media/dogovoroff-mark.png" alt="" width={64} height={64} sizes="44px" priority />
      </span>
      <span className={styles.brandName}>ДоговорОфф</span>
      <span className={styles.brandDescriptor}>Личный кабинет</span>
    </a>
  );
}

function ViewButton({ item, activeView, onSelect, compact = false }) {
  const active = item.id === activeView;

  return (
    <button
      className={`${compact ? styles.topNavButton : styles.railButton}${active ? ` ${styles.isActive}` : ""}`}
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={() => onSelect(item.id)}
    >
      {!compact && <span>{item.index}</span>}
      <strong>{item.label}</strong>
    </button>
  );
}

export default function CabinetNavigation({
  activeView,
  displayName,
  hasMatters,
  headerPanel,
  notifications,
  onHeaderPanelChange,
  onNotificationOpen,
  onSelectView,
  staffHref,
}) {
  const handleHeaderPanelChange = (panel, open) => {
    onHeaderPanelChange((current) => (open ? panel : current === panel ? null : current));
  };

  return (
    <>
      <header className={styles.header}>
        <Brand />
        <nav className={styles.topNav} aria-label="Разделы личного кабинета">
          {hasMatters ? CABINET_VIEWS.map((item) => (
            <ViewButton key={item.id} item={item} activeView={activeView} onSelect={onSelectView} compact />
          )) : null}
          <a className={styles.aiTopLink} href={AI_PRECHECK_HREF}>AI-разбор</a>
        </nav>
        <NotificationCenter
          notifications={notifications}
          open={headerPanel === "notifications"}
          onOpenChange={(open) => handleHeaderPanelChange("notifications", open)}
          onOpen={onNotificationOpen}
        />
        <details
          className={styles.profile}
          open={headerPanel === "profile"}
          onToggle={(event) => handleHeaderPanelChange("profile", event.currentTarget.open)}
        >
          <summary aria-label={`Профиль: ${displayName}`}>
            <span className={styles.profileName}>{displayName}</span>
            <span className={styles.profileMobileLabel} aria-hidden="true">Профиль</span>
          </summary>
          <div>
            <strong className={styles.profileAccountName}>{displayName}</strong>
            <span>Подтверждённый аккаунт</span>
            {staffHref ? <a href={staffHref}>Рабочая панель</a> : null}
            <a href="/">Вернуться на сайт</a>
            <a href="/privacy">Конфиденциальность</a>
            <form action="/auth/signout" method="post"><button type="submit">Выйти</button></form>
          </div>
        </details>
      </header>
      {hasMatters ? (
        <nav className={styles.mobileNav} aria-label="Разделы личного кабинета на мобильном устройстве">
          {CABINET_VIEWS.map((item) => (
            <ViewButton key={item.id} item={item} activeView={activeView} onSelect={onSelectView} compact />
          ))}
        </nav>
      ) : null}
    </>
  );
}
