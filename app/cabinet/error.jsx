"use client";

import Link from "next/link";
import styles from "../../features/cabinet/cabinet.module.css";

export default function CabinetError({ reset }) {
  return (
    <main className={styles.stateShell} role="alert">
      <section className={styles.stateCard} aria-labelledby="cabinet-error-title">
        <p className={styles.eyebrow}>Личный кабинет</p>
        <h1 id="cabinet-error-title">Не удалось открыть кабинет</h1>
        <p>Данные временно недоступны. Повторите попытку или вернитесь на страницу входа.</p>
        <div className={styles.stateActions}>
          <button type="button" onClick={() => reset()}>Повторить</button>
          <Link href="/login?next=/cabinet">Войти снова</Link>
        </div>
      </section>
    </main>
  );
}
