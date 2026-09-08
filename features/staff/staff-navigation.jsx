import styles from "./staff.module.css";

export default function StaffNavigation({
  activeView,
  counts,
  items,
  moreItems,
  onSelect,
}) {
  return (
    <aside className={styles.rail} aria-label="Разделы рабочей панели">
      <nav aria-label="Сегодня и другие разделы">
        {items.filter((item) => item.id !== "more").map((item) => (
          <button
            className={`${styles.railButton}${activeView === item.id ? ` ${styles.isActive}` : ""}`}
            type="button"
            key={item.id}
            aria-current={activeView === item.id ? "page" : undefined}
            onClick={() => onSelect(item.id)}
          >
            <span>{item.label}</span>
            {counts[item.id] > 0 ? <small>{counts[item.id]}</small> : null}
          </button>
        ))}
        <details className={styles.moreNavigation} open={activeView === "more" || moreItems.some((item) => item.id === activeView)} aria-label="Ещё разделы">
          <summary>Ещё</summary>
          <div className={styles.moreNavigationMenu}>
            {moreItems.map((item) => (
              <button
                className={`${styles.railButton}${activeView === item.id ? ` ${styles.isActive}` : ""}`}
                type="button"
                key={item.id}
                aria-current={activeView === item.id ? "page" : undefined}
                onClick={() => onSelect(item.id)}
              >
                <span>{item.label}</span>
                {counts[item.id] > 0 ? <small>{counts[item.id]}</small> : null}
              </button>
            ))}
          </div>
        </details>
      </nav>
      <a className={styles.railCabinetLink} href="/cabinet">Личный кабинет</a>
    </aside>
  );
}
