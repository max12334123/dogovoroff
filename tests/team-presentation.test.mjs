import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const [contentSource, pageSource, stylesSource] = await Promise.all([
  readFile(new URL("../app/content.js", import.meta.url), "utf8"),
  readFile(new URL("../app/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
]);

test("team profiles use the supplied names, roles, and verified experience", () => {
  for (const requiredCopy of [
    "Бадрудин",
    "Основатель · Начальник юридического отдела",
    "Более 7 лет",
    "Анастасия",
    "Сооснователь · Начальник тендерного отдела",
    "Более 5 лет",
    "Высшее юридическое",
    "Нижневартовск",
  ]) {
    assert.match(contentSource, new RegExp(requiredCopy));
  }

  assert.match(contentSource, /помощником судьи/);
  assert.match(contentSource, /тендерами, закупками и договорами/);
  assert.match(contentSource, /team-badrudin-dark\.webp/);
  assert.match(contentSource, /team-anastasia-dark\.webp/);
});

test("team portraits are semantic, responsive, and optimized", async () => {
  assert.match(pageSource, /<Reveal as="article" className="team-profile"/);
  assert.match(pageSource, /alt=\{member\.imageAlt\}/);
  assert.match(pageSource, /sizes="\(max-width: 740px\) 100vw, 50vw"/);
  assert.match(stylesSource, /\.team-profile__media/);

  const portraits = await Promise.all([
    stat(new URL("../public/media/team-badrudin-dark.webp", import.meta.url)),
    stat(new URL("../public/media/team-anastasia-dark.webp", import.meta.url)),
  ]);

  for (const portrait of portraits) {
    assert.ok(portrait.size > 20_000 && portrait.size < 350_000, "team portrait must stay optimized");
  }
});

test("primary calls to action lead directly to the form without covering the hero action", () => {
  assert.match(pageSource, /href="#lead-form" className="action--light"/);
  assert.match(pageSource, /id="lead-form"/);
  assert.match(pageSource, /querySelector\("#lead-form"\)/);
  assert.match(pageSource, /!formVisible && !heroActionVisible/);
  assert.match(stylesSource, /\.request__form-wrap \{[\s\S]*?scroll-margin-top: 84px/);
});
