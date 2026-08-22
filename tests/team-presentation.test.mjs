import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const [contentSource, pageSource, stylesSource] = await Promise.all([
  readFile(new URL("../app/content.js", import.meta.url), "utf8"),
  readFile(new URL("../app/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
]);

test("team profiles remain anonymous while preserving roles and verified experience", () => {
  for (const requiredCopy of [
    "Юридический отдел",
    "Основатель · Начальник юридического отдела",
    "Более 7 лет",
    "Тендерный отдел",
    "Сооснователь · Начальник тендерного отдела",
    "Более 5 лет",
    "Высшее юридическое",
    "Нижневартовск",
  ]) {
    assert.match(contentSource, new RegExp(requiredCopy));
  }

  assert.match(contentSource, /помощником судьи/);
  assert.match(contentSource, /тендерами, закупками и договорами/);
  assert.doesNotMatch(contentSource, /Бадрудин|Анастасия/);
  assert.doesNotMatch(pageSource, /member\.name/);
  assert.doesNotMatch(contentSource, /team-badrudin-dark\.webp/);
  assert.doesNotMatch(contentSource, /team-anastasia-dark\.webp/);
});

test("team profiles remain semantic and do not render portraits", () => {
  assert.match(pageSource, /<Reveal as="article" className="team-profile"/);
  assert.match(pageSource, /className="team-profile__topline"/);
  assert.doesNotMatch(pageSource, /member\.image/);
  assert.doesNotMatch(pageSource, /member\.imageAlt/);
  assert.match(stylesSource, /\.team-profile__topline/);
  assert.doesNotMatch(stylesSource, /\.team-profile__media/);
});

test("retired leadership portraits are absent from public assets", async () => {
  for (const filename of [
    "team-badrudin.webp",
    "team-badrudin-dark.webp",
    "team-anastasia.webp",
    "team-anastasia-dark.webp",
  ]) {
    await assert.rejects(
      access(new URL(`../public/media/${filename}`, import.meta.url)),
      (error) => error?.code === "ENOENT",
    );
  }
});

test("primary calls to action lead directly to the form without covering the hero action", () => {
  assert.match(pageSource, /href="#lead-form" className="action--light"/);
  assert.match(pageSource, /id="lead-form"/);
  assert.match(pageSource, /querySelector\("#lead-form"\)/);
  assert.match(pageSource, /!formVisible && !heroActionVisible/);
  assert.match(stylesSource, /\.request__form-wrap \{[\s\S]*?scroll-margin-top: 84px/);
});
