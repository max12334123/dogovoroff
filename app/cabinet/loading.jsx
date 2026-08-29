import styles from "../../features/cabinet/cabinet.module.css";

export default function Loading() {
  return (
    <main className={styles.stateShell} aria-busy="true" aria-live="polite">
      <section className={styles.stateCard} aria-labelledby="cabinet-loading-title">
        <p className={styles.eyebrow}>Личный кабинет</p>
        <h1 id="cabinet-loading-title">Открываем кабинет…</h1>
        <p>Проверяем защищённую сессию и загружаем дела.</p>
      </section>
    </main>
  );
}
