import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const [contentSource, pageSource, stylesSource, storySource, storyStyles] = await Promise.all([
  readFile(new URL("../app/content.js", import.meta.url), "utf8"),
  readFile(new URL("../app/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../app/homepage-story.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/homepage-story.css", import.meta.url), "utf8"),
]);

function extractCssBlock(source, marker) {
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `Missing CSS block: ${marker}`);

  const blockStart = source.indexOf("{", markerIndex);
  assert.notEqual(blockStart, -1, `Missing opening brace for: ${marker}`);

  let depth = 0;
  for (let index = blockStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(blockStart + 1, index);
  }

  assert.fail(`Missing closing brace for: ${marker}`);
}

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
  assert.match(storySource, /<motion\.article[\s\S]{0,100}className="team-editorial__profile"/);
  assert.match(storySource, /className="team-editorial__experience"/);
  assert.doesNotMatch(storySource, /member\.image/);
  assert.doesNotMatch(storySource, /member\.imageAlt/);
  assert.match(storyStyles, /\.team-editorial__experience/);
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

test("mobile editorial team headings stay readable without fixed card widths", () => {
  const mobileStyles = extractCssBlock(storyStyles, "@media (max-width: 600px)");
  const headingStyles = extractCssBlock(mobileStyles, ".team-editorial__profile h3");
  assert.match(headingStyles, /font-size:\s*27px/);
  assert.match(mobileStyles, /grid-template-columns:\s*1fr/);
});
