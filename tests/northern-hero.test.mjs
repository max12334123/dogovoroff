import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const readOptional = (path) => readFile(new URL(path, import.meta.url), "utf8").catch(() => "");
const statOptional = (path) => stat(new URL(path, import.meta.url)).catch(() => null);

const [pageSource, motionSource, sculptureSource, stylesSource, storySource] = await Promise.all([
  readOptional("../app/page.jsx"),
  readOptional("../app/northern-motion.jsx"),
  readOptional("../app/northern-sculpture.jsx"),
  readOptional("../app/homepage.css"),
  readOptional("../app/homepage-story.jsx"),
]);

test("hero uses optimized northern artwork with motion-safe parallax", () => {
  assert.match(pageSource, /import NorthernMotion from "\.\/northern-motion"/);
  assert.match(pageSource, /<NorthernMotion\s*\/>/);
  assert.doesNotMatch(pageSource, /IceMotion|hero__messenger/);

  assert.match(motionSource, /<Image/);
  assert.match(motionSource, /northern-chrome-hero\.webp/);
  assert.match(motionSource, /priority/);
  assert.match(motionSource, /sizes="100vw"/);
  assert.match(motionSource, /useReducedMotion/);
  assert.match(motionSource, /useScroll/);
  assert.match(motionSource, /useTransform/);
  assert.match(motionSource, /reduceMotion \? undefined/);

  assert.match(stylesSource, /\.hero__north-poster/);
  assert.match(stylesSource, /\.hero__art::after/);
});

test("northern media stays within the homepage performance budget", async () => {
  const [hero, horizon, sculpture] = await Promise.all([
    statOptional("../public/media/northern-chrome-hero.webp"),
    statOptional("../public/media/northern-horizon.webp"),
    statOptional("../public/media/legal-atlas.glb"),
  ]);

  assert.ok(hero?.size > 20_000 && hero.size < 250_000, "hero must be optimized");
  assert.ok(horizon?.size > 20_000 && horizon.size < 250_000, "horizon must be optimized");
  assert.ok(sculpture?.size > 20_000 && sculpture.size < 1_200_000, "3D model must be optimized");
});

test("3D sculpture is progressive enhancement with static, accessible fallbacks", () => {
  assert.match(storySource, /<NorthernSculpture progress=\{chapters.progress\}/);
  assert.match(sculptureSource, /IntersectionObserver/);
  assert.match(sculptureSource, /import\("three"\)/);
  assert.match(sculptureSource, /prefers-reduced-motion: reduce/);
  assert.match(sculptureSource, /connection(?:\(\))?\?\.saveData/);
  assert.match(sculptureSource, /renderer\?\.dispose\(\)/);
  assert.match(sculptureSource, /legal-atlas-poster\.webp/);
});

test("Telegram is available only in the final contact section", () => {
  const telegramReferences = pageSource.match(/CONFIG\.telegram/g) ?? [];

  assert.equal(telegramReferences.length, 1);
  assert.match(pageSource, /request__messengers[^\n]+CONFIG\.telegram/);
  assert.doesNotMatch(pageSource, /mobile-action-bar[^\n]+CONFIG\.telegram/);
});
