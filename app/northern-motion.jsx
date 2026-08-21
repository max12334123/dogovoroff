"use client";

import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const POSTER = "/media/northern-ice-poster.webp";

export default function NorthernMotion() {
  const reduceMotion = useReducedMotion();
  const videoRef = useRef(null);
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const shouldPlay = !reduceMotion && !videoFailed;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldPlay) return undefined;

    const playback = video.play();
    playback?.catch(() => setVideoFailed(true));

    return () => video.pause();
  }, [shouldPlay]);

  return (
    <div className="hero__north" aria-hidden="true">
      <Image
        className="hero__north-poster"
        src={POSTER}
        alt=""
        fill
        priority
        sizes="(max-width: 760px) 100vw, (max-width: 1100px) 42vw, 38vw"
      />
      {shouldPlay && (
        <video
          ref={videoRef}
          className={`hero__north-video${videoReady ? " hero__north-video--ready" : ""}`}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={POSTER}
          tabIndex={-1}
          onCanPlay={() => setVideoReady(true)}
          onError={() => setVideoFailed(true)}
        >
          <source src="/media/northern-ice-loop.webm" type="video/webm" />
          <source src="/media/northern-ice-loop.mp4" type="video/mp4" />
        </video>
      )}
    </div>
  );
}
