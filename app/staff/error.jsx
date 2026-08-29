"use client";

import Link from "next/link";
import styles from "../../features/staff/staff.module.css";

export default function StaffError({ reset }) {
  return (
    <main className={styles.stateShell} role="alert">
      <section className={styles.stateCard} aria-labelledby="staff-error-title">
        <p className={styles.eyebrow}>Рабочая панель</p>
        <h1 id="staff-error-title">Не удалось загрузить дела</h1>
        <p>Рабочие данные временно недоступны. Повторите попытку или откройте кабинет клиента.</p>
        <div className={styles.stateActions}>
          <button type="button" onClick={() => reset()}>Повторить</button>
          <Link href="/cabinet">Кабинет клиента</Link>
        </div>
      </section>
    </main>
  );
}
