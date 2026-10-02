import assert from "node:assert/strict";
import test from "node:test";
import { readFile, stat } from "node:fs/promises";
import { chapterIndex, chapterPosition, chapterProgress, chapterScrollTop } from "../lib/homepage-motion.mjs";

test("scroll chapters clamp out-of-range progress and select every chapter", () => {
  assert.deepEqual([0, .2, .4, .6, .8].map(p => chapterIndex(p, 5)), [0, 1, 2, 3, 4]);
  assert.equal(chapterIndex(-1, 5), 0);
  assert.equal(chapterIndex(2, 5), 4);
  assert.equal(chapterIndex(Number.NaN, 5), 0);
  assert.equal(chapterIndex(.8, 1), 0);
});

test("chapter navigation maps back to the same scroll scene", () => {
  for (let index = 0; index < 5; index++) {
    const y = chapterScrollTop(1200, 4200, 1000, index, 5);
    assert.equal(chapterIndex((y - 1200) / 3200, 5), index);
  }
  assert.equal(chapterScrollTop(50, 400, 1000, 4, 5), 50);
  assert.equal(chapterScrollTop(50, 2000, 1000, 99, 5), 850);
  assert.equal(chapterScrollTop(50, 2000, 1000, -2, 5), 50);
});

test("mode changes recompute chapter progress from the new layout", () => {
  for (const count of [4, 5]) {
    for (let index = 0; index < count; index++) {
      const top = chapterScrollTop(1400, 4300, 1024, index, count);
      assert.equal(chapterIndex(chapterProgress(1400, 4300, 1024, top), count), index);
    }
  }
  assert.equal(chapterProgress(1000, 4000, 1000, 200), 0);
  assert.equal(chapterProgress(1000, 4000, 1000, 5000), 1);
  assert.equal(chapterProgress(1000, 600, 1000, 2000), 0);
  assert.equal(chapterProgress(1000, 1000, 1000, 2000), 0);
});

test("motion scenes are progressive enhancement and do not add a second scroll owner", async () => {
  const source = await readFile(new URL("../app/homepage-story.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /new Lenis|addEventListener\("wheel"/);
  assert.match(source, /prefers-reduced-motion: no-preference/);
  assert.match(source, /data-mode=\{chapters.cinematic \? "cinematic" : "document"\}/);
  assert.match(source, /inert=\{chapters.cinematic/);
  assert.match(source, /video.pause\(\)/);
  assert.match(source, /navigator.connection\?\.saveData/);
  assert.match(source, /preload="none"/);
});

test("document layout removes stale cinematic transforms before measuring chapter position", async () => {
  const css = await readFile(new URL("../app/homepage-story.css", import.meta.url), "utf8");
  assert.match(css, /\[data-mode="document"\] \.atlas-track,\s*\.home-shell \[data-mode="document"\] \.journey-track \{ transform: none !important; \}/);
});

test("real cinematic and Blender media have bounded download costs", async () => {
  for (const [file, budget] of [["legal-atlas.glb", 1200000], ["legal-atlas-poster.webp", 200000], ["higgsfield-northern-film.mp4", 4000000]]) {
    const media = await stat(new URL(`../public/media/${file}`, import.meta.url));
    assert.ok(media.size > 10000 && media.size < budget, file);
  }
});

test("reading holds and final chapter have full scroll intervals", () => {
  assert.equal(chapterPosition(.1, 5), 0);
  assert.equal(chapterPosition(.3, 5), 1);
  assert.equal(chapterPosition(.9, 5), 4);
  assert.ok(chapterPosition(.16, 5) > 0 && chapterPosition(.16, 5) < 1);
  assert.equal(chapterPosition(1, 5), 4);
});
