import { getMatterTask } from "./staff-domain.mjs";
import styles from "./staff.module.css";

export default function StaffTaskList({ action, waiting, paused, onOpenMatter }) {
  const groups = [
    { id: "action", title: "Требуют вашего действия", matters: action },
    { id: "waiting", title: "Ожидают клиента", matters: waiting },
    { id: "paused", title: "Приостановлены", matters: paused },
  ];
  return (
    <div className={styles.taskGroups}>
      {groups.filter((group) => group.matters.length).map((group) => (
        <section className={styles.queueSection} key={group.id} aria-labelledby={`staff-${group.id}-title`}>
          <h2 id={`staff-${group.id}-title`}>{group.title} <span>· {group.matters.length}</span></h2>
          <ol className={styles.taskList}>
            {group.matters.map((matter) => (
              <li key={matter.id}>
                <button className={styles.taskRow} type="button" onClick={() => onOpenMatter(matter.id)}>
                  <span className={styles.queueMatter}>
                    <strong>{getMatterTask(matter)}</strong>
                    <small>{matter.reference} · {matter.title}</small>
                  </span>
                  <small className={styles.taskDue}>{matter.responseBy}</small>
                </button>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
