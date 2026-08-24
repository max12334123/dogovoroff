"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import Lenis from "lenis";
import { useEffect, useState } from "react";

function PremiumCursor() {
  const [enabled, setEnabled] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [pressed, setPressed] = useState(false);
  const pointerX = useMotionValue(-100);
  const pointerY = useMotionValue(-100);
  const orbitX = useSpring(pointerX, { stiffness: 420, damping: 34, mass: 0.5 });
  const orbitY = useSpring(pointerY, { stiffness: 420, damping: 34, mass: 0.5 });

  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!finePointer || reducedMotion) return undefined;

    setEnabled(true);
    document.documentElement.classList.add("has-premium-cursor");
    const move = (event) => {
      pointerX.set(event.clientX);
      pointerY.set(event.clientY);
      setInteractive(Boolean(event.target.closest("a, button, input, select, textarea, label")));
    };
    const down = () => setPressed(true);
    const up = () => setPressed(false);
    window.addEventListener("mousemove", move, { passive: true });
    window.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    return () => {
      document.documentElement.classList.remove("has-premium-cursor");
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
    };
  }, [pointerX, pointerY]);

  if (!enabled) return null;
  return (
    <>
      <motion.span className="cursor-core" aria-hidden="true" style={{ x: pointerX, y: pointerY }} />
      <motion.span className={`cursor-orbit${interactive ? " is-interactive" : ""}${pressed ? " is-pressed" : ""}`} aria-hidden="true" style={{ x: orbitX, y: orbitY }} />
    </>
  );
}

export default function Effects() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lenis = reduceMotion
      ? null
      : new Lenis({ duration: 1.08, easing: (value) => Math.min(1, 1.001 - 2 ** (-10 * value)), smoothWheel: true });
    let frame;
    const animate = (time) => {
      if (!lenis) return;
      lenis.raf(time);
      frame = requestAnimationFrame(animate);
    };
    const followAnchor = (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (!link) return;
      const id = link.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;

      const isSkipLink = link.matches(".skip-link");
      if (!isSkipLink && reduceMotion) return;

      event.preventDefault();
      if (window.location.hash !== id) window.history.pushState(null, "", id);
      if (isSkipLink) {
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: "start" });
        return;
      }

      lenis?.scrollTo(target, { offset: -82 });
    };
    if (lenis) frame = requestAnimationFrame(animate);
    document.addEventListener("click", followAnchor);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener("click", followAnchor);
      lenis?.destroy();
    };
  }, []);

  return <PremiumCursor />;
}
