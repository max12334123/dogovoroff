import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const contentSource = await readFile(new URL("../app/content.js", import.meta.url), "utf8");
const pageSource = await readFile(new URL("../app/page.jsx", import.meta.url), "utf8");

test("published contact surfaces do not contain the placeholder phone", () => {
  const source = `${contentSource}\n${pageSource}`;

  assert.doesNotMatch(source, /\+7 \(3466\) 000-00-00/);
  assert.doesNotMatch(source, /tel:\+73466000000/);
});

test("published contact surfaces keep direct contact fallbacks", () => {
  assert.match(contentSource, /dogovor\.off@mail\.ru/);
  assert.match(contentSource, /https:\/\/t\.me\/dogovoroff/);
  assert.match(contentSource, /https:\/\/max\.ru\/u\//);
});
