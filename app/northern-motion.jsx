"use client";

import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import styles from "./northern-motion.module.css";

const POSTER = "/media/northern-chrome-hero.webp";

function canEnhance() {
  if (typeof window === "undefined") return false;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return !connection?.saveData && (navigator.deviceMemory || 8) > 4 && window.innerWidth > 850;
}

export default function NorthernMotion() {
  const artworkRef = useRef(null);
  const pointerRef = useRef({ x: 0.68, y: 0.48, targetX: 0.68, targetY: 0.48 });
  const [ChromeCanvas, setChromeCanvas] = useState(null);
  const [inView, setInView] = useState(false);
  const [enhancementAllowed, setEnhancementAllowed] = useState(false);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: artworkRef, offset: ["start start", "end start"] });
  const parallaxY = useTransform(scrollYProgress, [0, 1], ["0%", "8%"]);

  useEffect(() => {
    const reducedMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    const widthMedia = window.matchMedia("(min-width: 851px)");
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const update = () => setEnhancementAllowed(!reducedMedia.matches && widthMedia.matches && canEnhance());
    update();
    reducedMedia.addEventListener("change", update);
    widthMedia.addEventListener("change", update);
    connection?.addEventListener?.("change", update);
    return () => {
      reducedMedia.removeEventListener("change", update);
      widthMedia.removeEventListener("change", update);
      connection?.removeEventListener?.("change", update);
    };
  }, []);

  useEffect(() => {
    if (reduceMotion || !enhancementAllowed || !artworkRef.current) return undefined;

    const target = artworkRef.current;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.02 });
    observer.observe(target);

    let live = true;

    const load = () => {
      import("./chrome-hero-canvas").then(({ default: Canvas }) => {
        if (live) setChromeCanvas(() => Canvas);
      }).catch(() => {});
    };
    const idleId = "requestIdleCallback" in window
      ? window.requestIdleCallback(load, { timeout: 1300 })
      : window.setTimeout(load, 280);

    return () => {
      live = false;
      observer.disconnect();
      if ("cancelIdleCallback" in window) window.cancelIdleCallback(idleId);
      else window.clearTimeout(idleId);
    };
  }, [enhancementAllowed, reduceMotion]);

  useEffect(() => {
    if (reduceMotion || !enhancementAllowed) return undefined;
    // The live text layer covers the artwork. Listen on their shared section so
    // refraction follows the pointer without making the headline unselectable.
    const surface = artworkRef.current?.closest(".hero");
    if (!surface) return undefined;
    const move = (event) => {
      const box = artworkRef.current?.getBoundingClientRect();
      if (!box?.width || !box.height) return;
      pointerRef.current.targetX = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
      pointerRef.current.targetY = Math.min(1, Math.max(0, 1 - (event.clientY - box.top) / box.height));
    };
    const reset = () => {
      pointerRef.current.targetX = 0.68;
      pointerRef.current.targetY = 0.48;
    };
    surface.addEventListener("pointermove", move, { passive: true });
    surface.addEventListener("pointerleave", reset, { passive: true });
    return () => {
      surface.removeEventListener("pointermove", move);
      surface.removeEventListener("pointerleave", reset);
    };
  }, [enhancementAllowed, reduceMotion]);

  return (
    <motion.div
      ref={artworkRef}
      className={`hero__north ${styles.root}`}
      aria-hidden="true"
      style={reduceMotion ? undefined : { y: parallaxY }}
    >
      <Image
        className={`hero__north-poster ${styles.poster}`}
        src={POSTER}
        alt=""
        fill
        priority
        sizes="100vw"
      />
      {enhancementAllowed && ChromeCanvas ? <ChromeCanvas active={inView} pointerRef={pointerRef} /> : null}
      <span className={styles.grain} />
    </motion.div>
  );
}
