"use client";

import { useEffect, useRef } from "react";
import styles from "./staff.module.css";

export function useDraftRegistration(registry, key, dirty, busy, discard) {
  useEffect(() => {
    registry?.set(key, { dirty, busy, discard });
    return () => registry?.delete(key);
  }, [registry, key, dirty, busy, discard]);
}

export function useDialogFocus(ref, onClose, returnFocusRef) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    const previous = returnFocusRef?.current ?? document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const targets = () => [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [href], [tabindex="0"]')].filter((node) => node.getClientRects().length);
    (targets()[0] ?? dialog).focus();
    const keydown = (event) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current?.(); }
      if (event.key !== "Tab") return;
      const nodes = targets();
      if (!nodes.length) { event.preventDefault(); dialog.focus(); return; }
      if (event.shiftKey && (document.activeElement === nodes[0] || !nodes.includes(document.activeElement))) {
        event.preventDefault(); nodes.at(-1).focus();
      } else if (!event.shiftKey && (document.activeElement === nodes.at(-1) || !nodes.includes(document.activeElement))) {
        event.preventDefault(); nodes[0].focus();
      }
    };
    const focusin = (event) => { if (!dialog.contains(event.target)) (targets()[0] ?? dialog).focus(); };
    dialog.addEventListener("keydown", keydown);
    document.addEventListener("focusin", focusin);
    return () => {
      document.body.style.overflow = overflow;
      dialog.removeEventListener("keydown", keydown);
      document.removeEventListener("focusin", focusin);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [ref]);
}

export function StaffDialog({ title, id, onClose, children, confirmation, returnFocusRef }) {
  const ref = useRef(null);
  useDialogFocus(ref, onClose, returnFocusRef);
  return <div className={styles.drawerBackdrop}><section ref={ref} tabIndex={-1} className={styles.assignmentDrawer} role="dialog" aria-modal="true" aria-labelledby={id}>
    <header className={styles.drawerHeader}><h2 id={id}>{title}</h2><button className={styles.drawerClose} type="button" onClick={onClose}>Закрыть</button></header>
    {confirmation || children}
  </section></div>;
}

export function DraftConfirmation({ onContinue, onDiscard }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return <section className={styles.draftConfirmation} aria-label="Несохранённые изменения">
    <h3>Есть несохранённые изменения</h3><p>Остаться в форме или продолжить без сохранения?</p>
    <button ref={ref} className={styles.primaryButton} type="button" onClick={onContinue}>Продолжить редактирование</button>
    <button className={styles.secondaryButton} type="button" onClick={onDiscard}>Не сохранять</button>
  </section>;
}
