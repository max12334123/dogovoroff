import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const readOptional = (path) => readFile(new URL(path, import.meta.url), "utf8").catch(() => "");
const statOptional = (path) => stat(new URL(path, import.meta.url)).catch(() => null);

const [pageSource, motionSource, stylesSource] = await Promise.all([
  readOptional("../app/page.jsx"),
  readOptional("../app/northern-motion.jsx"),
  readOptional("../app/globals.css"),
]);

test("hero uses an accessible northern video with resilient fallbacks", () => {
  assert.match(pageSource, /import NorthernMotion from "\.\/northern-motion"/);
  assert.match(pageSource, /<NorthernMotion\s*\/>/);
  assert.doesNotMatch(pageSource, /IceMotion|hero__messenger/);

  assert.match(motionSource, /<video/);
  assert.match(motionSource, /autoPlay/);
  assert.match(motionSource, /muted/);
  assert.match(motionSource, /loop/);
  assert.match(motionSource, /playsInline/);
  assert.match(motionSource, /preload="metadata"/);
  assert.match(motionSource, /useReducedMotion/);
  assert.match(motionSource, /northern-ice-poster\.webp/);
  assert.match(motionSource, /northern-ice-loop\.webm/);
  assert.match(motionSource, /northern-ice-loop\.mp4/);

  assert.match(stylesSource, /\.hero__north-video/);
  assert.match(stylesSource, /\.hero__north-poster/);
});

test("northern media files exist and stay within the hero performance budget", async () => {
  const [poster, webm, mp4] = await Promise.all([
    statOptional("../public/media/northern-ice-poster.webp"),
    statOptional("../public/media/northern-ice-loop.webm"),
    statOptional("../public/media/northern-ice-loop.mp4"),
  ]);

  assert.ok(poster?.size > 20_000 && poster.size < 750_000, "poster must be optimized");
  assert.ok(webm?.size > 150_000 && webm.size < 6_000_000, "WebM must be optimized");
  assert.ok(mp4?.size > 150_000 && mp4.size < 7_000_000, "MP4 must be optimized");
});

test("Telegram is available only in the final contact section", () => {
  const telegramReferences = pageSource.match(/CONFIG\.telegram/g) ?? [];

  assert.equal(telegramReferences.length, 1);
  assert.match(pageSource, /request__messengers[^\n]+CONFIG\.telegram/);
  assert.doesNotMatch(pageSource, /mobile-action-bar[^\n]+CONFIG\.telegram/);
});
