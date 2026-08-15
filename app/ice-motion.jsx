"use client";

import Image from "next/image";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { getIceMotion } from "../lib/ice-motion.mjs";

const SPRING = { stiffness: 95, damping: 22, mass: 0.85 };

export default function IceMotion() {
  const reduceMotion = useReducedMotion();
  const rotateXTarget = useMotionValue(0);
  const rotateYTarget = useMotionValue(0);
  const xTarget = useMotionValue(0);
  const yTarget = useMotionValue(0);
  const scaleTarget = useMotionValue(1);
  const lightXTarget = useMotionValue(0);
  const lightYTarget = useMotionValue(0);

  const rotateX = useSpring(rotateXTarget, SPRING);
  const rotateY = useSpring(rotateYTarget, SPRING);
  const x = useSpring(xTarget, SPRING);
  const y = useSpring(yTarget, SPRING);
  const scale = useSpring(scaleTarget, SPRING);
  const lightX = useSpring(lightXTarget, { ...SPRING, stiffness: 70, damping: 20 });
  const lightY = useSpring(lightYTarget, { ...SPRING, stiffness: 70, damping: 20 });

  const reset = () => {
    rotateXTarget.set(0);
    rotateYTarget.set(0);
    xTarget.set(0);
    yTarget.set(0);
    scaleTarget.set(1);
    lightXTarget.set(0);
    lightYTarget.set(0);
  };

  const move = (event) => {
    if (reduceMotion || event.pointerType !== "mouse") return;
    const next = getIceMotion(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
    rotateXTarget.set(next.rotateX);
    rotateYTarget.set(next.rotateY);
    xTarget.set(next.x);
    yTarget.set(next.y);
    lightXTarget.set(next.lightX);
    lightYTarget.set(next.lightY);
  };

  const enter = (event) => {
    if (reduceMotion || event.pointerType !== "mouse") return;
    scaleTarget.set(1.012);
  };

  return (
    <motion.div
      className="hero__art-stage"
      onPointerEnter={enter}
      onPointerMove={move}
      onPointerLeave={reset}
      style={{ rotateX, rotateY, x, y, scale, transformPerspective: 1200 }}
    >
      <Image
        src="/media/ice-monolith.png"
        alt="Прозрачный ледяной монолит — символ северной точности"
        fill
        priority
        sizes="(max-width: 860px) 100vw, 44vw"
        className="hero__image"
      />
      <motion.span className="hero__refraction-follower" aria-hidden="true" style={{ x: lightX, y: lightY }}>
        <span className="hero__refraction-breathe">
          <Image
            src="/media/ice-refraction-frame.png"
            alt=""
            fill
            priority
            sizes="(max-width: 860px) 100vw, 44vw"
            className="hero__refraction-image"
          />
        </span>
      </motion.span>
    </motion.div>
  );
}
