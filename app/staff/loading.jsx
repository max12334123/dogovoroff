import styles from "../../features/staff/staff.module.css";

export default function Loading() {
  return (
    <main className={styles.stateShell} aria-busy="true" aria-live="polite">
      <section className={styles.stateCard} aria-labelledby="staff-loading-title">
        <p className={styles.eyebrow}>Рабочая панель</p>
        <h1 id="staff-loading-title">Открываем рабочую область…</h1>
        <p>Проверяем права доступа и загружаем дела команды.</p>
      </section>
    </main>
  );
}
