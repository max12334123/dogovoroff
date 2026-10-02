"use client";

import * as THREE from "three";
import { useEffect, useRef } from "react";
import styles from "./northern-motion.module.css";

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D uTexture;
  uniform vec2 uPointer;
  uniform vec2 uResolution;
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    vec2 offset = uv - uPointer;
    offset.x *= uResolution.x / uResolution.y;
    float distanceToPointer = length(offset);
    float ripple = exp(-distanceToPointer * 7.4) * sin(distanceToPointer * 42.0 - uTime * 2.1);
    vec2 current = vec2(sin(uv.y * 9.0 + uTime * 0.38), cos(uv.x * 8.0 - uTime * 0.31)) * 0.0027;
    vec2 refraction = current + normalize(offset + 0.0001) * ripple * 0.007;
    vec3 chrome = texture2D(uTexture, uv + refraction).rgb;
    float luminance = dot(chrome, vec3(0.2126, 0.7152, 0.0722));
    float band = sin((uv.x * 0.83 + uv.y * 1.17) * 16.0 - uTime * 0.57 + sin(uv.y * 14.0 + uTime * 0.22));
    float lightFlow = smoothstep(0.50, 0.96, band) * smoothstep(0.13, 0.79, luminance);
    float pointerGlow = exp(-distanceToPointer * 4.5) * 0.32;
    vec3 reflected = mix(chrome, vec3(0.56, 0.84, 1.0), lightFlow * 0.68 + pointerGlow * 0.22);
    float alpha = 0.075 + lightFlow * 0.18 + pointerGlow * 0.10 + abs(ripple) * 0.06;
    gl_FragColor = vec4(reflected, alpha);
  }
`;

export default function ChromeHeroCanvas({ active, pointerRef }) {
  const canvasRef = useRef(null);
  const activeRef = useRef(active);
  const syncRef = useRef(() => {});

  useEffect(() => {
    activeRef.current = active;
    syncRef.current();
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let frame = 0;
    let disposed = false;
    let lastFrame = 0;
    let visible = document.visibilityState === "visible";
    let renderer;
    let geometry;
    let material;
    let texture;
    let resizeObserver;

    const stop = () => {
      if (!frame) return;
      cancelAnimationFrame(frame);
      frame = 0;
    };

    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      const scene = new THREE.Scene();
      const camera = new THREE.Camera();
      geometry = new THREE.PlaneGeometry(2, 2);
      texture = new THREE.TextureLoader().load("/media/northern-chrome-hero.webp");
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTexture: { value: texture },
          uPointer: { value: new THREE.Vector2(pointerRef.current.x, pointerRef.current.y) },
          uResolution: { value: new THREE.Vector2(1, 1) },
          uTime: { value: 0 },
        },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
      });
      scene.add(new THREE.Mesh(geometry, material));

      const resize = () => {
        const box = canvas.getBoundingClientRect();
        if (!box.width || !box.height) return;
        renderer.setSize(box.width, box.height, false);
        material.uniforms.uResolution.value.set(box.width, box.height);
      };
      resize();
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);

      const startedAt = performance.now();
      const canRun = () => !disposed && activeRef.current && visible;
      const render = (now) => {
        frame = 0;
        if (!canRun()) return;
        if (now - lastFrame >= 22) {
          lastFrame = now;
          const pointer = pointerRef.current;
          pointer.x += (pointer.targetX - pointer.x) * 0.055;
          pointer.y += (pointer.targetY - pointer.y) * 0.055;
          material.uniforms.uPointer.value.set(pointer.x, pointer.y);
          material.uniforms.uTime.value = (now - startedAt) * 0.001;
          renderer.render(scene, camera);
        }
        frame = requestAnimationFrame(render);
      };
      const sync = () => {
        if (canRun() && !frame) frame = requestAnimationFrame(render);
        if (!canRun()) stop();
      };
      const onVisibility = () => {
        visible = document.visibilityState === "visible";
        sync();
      };
      syncRef.current = sync;
      document.addEventListener("visibilitychange", onVisibility);
      sync();

      return () => {
        disposed = true;
        syncRef.current = () => {};
        stop();
        document.removeEventListener("visibilitychange", onVisibility);
        resizeObserver?.disconnect();
        geometry?.dispose();
        material?.dispose();
        texture?.dispose();
        renderer?.dispose();
      };
    } catch {
      // The poster remains fully usable when WebGL is unavailable or context creation fails.
      stop();
      geometry?.dispose();
      material?.dispose();
      texture?.dispose();
      renderer?.dispose();
      return undefined;
    }
  }, [pointerRef]);

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />;
}
