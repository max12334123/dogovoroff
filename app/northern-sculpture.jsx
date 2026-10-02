"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./northern-sculpture.module.css";

const MODEL_URL = "/media/legal-atlas.glb";
const POSTER_URL = "/media/legal-atlas-poster.webp";

function connection() {
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection;
}

function canEnhance() {
  if (typeof window === "undefined") return false;
  return !connection()?.saveData && (navigator.deviceMemory || 8) > 4 && window.innerWidth > 850;
}

function disposeScene(root) {
  const textures = new Set();
  root?.traverse((object) => {
    object.geometry?.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((material) => {
      Object.values(material).forEach((value) => {
        if (value?.isTexture) textures.add(value);
      });
      material.dispose();
    });
  });
  textures.forEach((texture) => texture.dispose());
}

/** The transparent poster stays visible until WebGL renders its first frame. */
export default function NorthernSculpture({ progress, chapter = 0 }) {
  const hostRef = useRef(null);
  const progressRef = useRef(0);
  const chapterRef = useRef(chapter);
  const pointerRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const activeRef = useRef(false);
  const [motionAllowed, setMotionAllowed] = useState(false);

  useEffect(() => {
    const reducedMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    const widthMedia = window.matchMedia("(min-width: 851px)");
    const network = connection();
    const update = () => setMotionAllowed(!reducedMedia.matches && widthMedia.matches && canEnhance());
    update();
    reducedMedia.addEventListener("change", update);
    widthMedia.addEventListener("change", update);
    network?.addEventListener?.("change", update);
    return () => {
      reducedMedia.removeEventListener("change", update);
      widthMedia.removeEventListener("change", update);
      network?.removeEventListener?.("change", update);
    };
  }, []);

  useEffect(() => {
    chapterRef.current = Math.min(4, Math.max(0, chapter));
  }, [chapter]);

  useEffect(() => {
    if (!progress) {
      progressRef.current = 0;
      return undefined;
    }
    progressRef.current = progress.get();
    return progress.on("change", (latest) => {
      progressRef.current = Math.min(1, Math.max(0, latest));
    });
  }, [progress]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !motionAllowed) return undefined;

    let cancelled = false;
    let starting = false;
    let frame = 0;
    let lastFrame = 0;
    let tabVisible = document.visibilityState === "visible";
    let renderer;
    let environmentTarget;
    let scene;
    let rig;
    let camera;
    let modelSize;
    let resizeObserver;
    let sceneObserver;
    let visibilityHandler;
    let THREE;
    const sheets = [];

    const stop = () => {
      if (!frame) return;
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const disposePartial = () => {
      disposeScene(rig);
      environmentTarget?.dispose();
      renderer?.dispose();
      renderer?.domElement.remove();
      renderer = undefined;
      environmentTarget = undefined;
      rig = undefined;
    };
    const canRun = () => !cancelled && Boolean(renderer && scene && camera) && activeRef.current && tabVisible;
    const pointerSurface = host.closest(".atlas-stage") || host;

    const onPointerMove = (event) => {
      const box = host.getBoundingClientRect();
      if (!box.width || !box.height) return;
      pointerRef.current.targetX = Math.max(-1, Math.min(1, ((event.clientX - box.left) / box.width - 0.5) * 2));
      pointerRef.current.targetY = Math.max(-1, Math.min(1, ((event.clientY - box.top) / box.height - 0.5) * -2));
    };
    const resetPointer = () => {
      pointerRef.current.targetX = 0;
      pointerRef.current.targetY = 0;
    };
    pointerSurface.addEventListener("pointermove", onPointerMove, { passive: true });
    pointerSurface.addEventListener("pointerleave", resetPointer, { passive: true });

    const animate = (time) => {
      frame = 0;
      if (!canRun()) return;
      if (time - lastFrame >= 22) {
        lastFrame = time;
        const elapsed = time * 0.001;
        const pointer = pointerRef.current;
        pointer.x += (pointer.targetX - pointer.x) * 0.045;
        pointer.y += (pointer.targetY - pointer.y) * 0.045;
        const chapterProgress = chapterRef.current / 4;
        const travel = Math.min(1, Math.max(0, chapterProgress * 0.56 + progressRef.current * 0.44));

        rig.rotation.y = 0.35 + Math.sin(elapsed * 0.19) * 0.08 + pointer.x * 0.14;
        rig.rotation.x = Math.PI / 2 + Math.sin(elapsed * 0.15) * 0.025 - pointer.y * 0.055;
        rig.rotation.z = -0.10 + travel * 0.30 + pointer.x * 0.035;
        sheets.forEach(({ mesh, position, rotation }, index) => {
          const direction = index - (sheets.length - 1) * 0.5;
          const lateralSpread = 0.13 + travel * 0.16;
          const depthSpread = 0.05 + travel * 0.12;
          mesh.position.set(
            position.x + direction * lateralSpread,
            position.y + direction * depthSpread,
            position.z + direction * 0.055,
          );
          mesh.rotation.set(
            rotation.x,
            rotation.y + direction * (0.05 + travel * 0.09),
            rotation.z + direction * (0.018 + travel * 0.045),
          );
        });
        renderer.render(scene, camera);
        if (!host.dataset.ready) host.dataset.ready = "true";
      }
      frame = requestAnimationFrame(animate);
    };
    const sync = () => {
      if (canRun() && !frame) frame = requestAnimationFrame(animate);
      if (!canRun()) stop();
    };
    const renderFirstFrame = () => {
      if (!renderer || !scene || !camera || !activeRef.current || !tabVisible) return;
      renderer.render(scene, camera);
      host.dataset.ready = "true";
    };

    const start = async () => {
      if (cancelled || starting || renderer) return;
      starting = true;
      let loadedScene;
      let room;
      try {
        const [threeModule, { GLTFLoader }, { RoomEnvironment }] = await Promise.all([
          import("three"),
          import("three/addons/loaders/GLTFLoader.js"),
          import("three/addons/environments/RoomEnvironment.js"),
        ]);
        THREE = threeModule;
        if (cancelled) return;

        const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
        loadedScene = gltf.scene;
        if (cancelled) return;

        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.85;
        renderer.setClearColor(0x000000, 0);
        renderer.domElement.className = styles.canvas;
        host.appendChild(renderer.domElement);

        scene = new THREE.Scene();
        const pmrem = new THREE.PMREMGenerator(renderer);
        room = new RoomEnvironment();
        environmentTarget = pmrem.fromScene(room, 0.045);
        pmrem.dispose();
        disposeScene(room);
        room = undefined;
        scene.environment = environmentTarget.texture;

        rig = new THREE.Group();
        // Blender XY sheets arrive as horizontal XZ planes in glTF. Stand them up as legal document layers.
        rig.rotation.x = Math.PI / 2;
        rig.add(loadedScene);
        loadedScene = undefined;
        rig.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(rig);
        const center = bounds.getCenter(new THREE.Vector3());
        modelSize = bounds.getSize(new THREE.Vector3());
        rig.position.sub(center);
        scene.add(rig);

        rig.traverse((object) => {
          if (/^Atlas_Sheet_[0-2]$/.test(object.name)) {
            sheets.push({ mesh: object, position: object.position.clone(), rotation: object.rotation.clone() });
          }
          if (!object.isMesh) return;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.filter(Boolean).forEach((material) => {
            // Keep the distinct titanium, silver edges and engraving from Blender.
            material.envMapIntensity = 0.8;
            if ("clearcoat" in material) material.clearcoat = 0.24;
            if ("clearcoatRoughness" in material) material.clearcoatRoughness = 0.2;
            material.needsUpdate = true;
          });
        });
        sheets.sort((left, right) => left.mesh.name.localeCompare(right.mesh.name));

        scene.add(new THREE.HemisphereLight(0x8eabb9, 0x030609, 0.2));
        const key = new THREE.DirectionalLight(0xe9f5ff, 0.95);
        key.position.set(-3, 5, 7);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0x7dbbd9, 1.3);
        rim.position.set(4, 1.5, -4);
        scene.add(rim);
        camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);

        const resize = () => {
          if (!renderer || !camera || !modelSize) return;
          const box = host.getBoundingClientRect();
          if (!box.width || !box.height) return;
          camera.aspect = box.width / box.height;
          const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
          const verticalDistance = modelSize.y / (2 * Math.tan(halfFov));
          const horizontalDistance = modelSize.x / (2 * Math.tan(halfFov) * camera.aspect);
          const distance = Math.max(verticalDistance, horizontalDistance) * 1.3;
          camera.position.set(modelSize.x * 0.06, modelSize.y * 0.02, distance);
          camera.lookAt(0, 0, 0);
          camera.updateProjectionMatrix();
          renderer.setSize(box.width, box.height, false);
          renderFirstFrame();
        };
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(host);
        resize();
        sync();
      } catch {
        disposeScene(loadedScene);
        disposeScene(room);
        disposePartial();
      } finally {
        if (cancelled) disposeScene(loadedScene);
        starting = false;
      }
    };

    visibilityHandler = () => {
      tabVisible = document.visibilityState === "visible";
      sync();
    };
    document.addEventListener("visibilitychange", visibilityHandler);
    sceneObserver = new IntersectionObserver(([entry]) => {
      activeRef.current = entry.isIntersecting;
      if (entry.isIntersecting) void start();
      sync();
    }, { rootMargin: "260px 0px" });
    sceneObserver.observe(host);

    return () => {
      cancelled = true;
      stop();
      pointerSurface.removeEventListener("pointermove", onPointerMove);
      pointerSurface.removeEventListener("pointerleave", resetPointer);
      delete host.dataset.ready;
      sceneObserver?.disconnect();
      resizeObserver?.disconnect();
      document.removeEventListener("visibilitychange", visibilityHandler);
      disposePartial();
    };
  }, [motionAllowed]);

  return (
    <div ref={hostRef} className={`atlas-sculpture ${styles.host}`} aria-hidden="true">
      <img className={styles.poster} src={POSTER_URL} alt="" />
    </div>
  );
}
