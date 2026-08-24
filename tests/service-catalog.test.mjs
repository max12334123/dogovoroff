import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [contentSource, siteSource, layoutSource, openGraphSource] = await Promise.all([
  readFile(new URL("../app/content.js", import.meta.url), "utf8"),
  readFile(new URL("../app/site.js", import.meta.url), "utf8"),
  readFile(new URL("../app/layout.js", import.meta.url), "utf8"),
  readFile(new URL("../app/opengraph-image.jsx", import.meta.url), "utf8"),
]);
const precheckSource = await readFile(new URL("../features/precheck/config.mjs", import.meta.url), "utf8");

const publishedServiceSource = [contentSource, siteSource, layoutSource, openGraphSource].join("\n");

test("published service copy contains no FAS or procurement-dispute offering", () => {
  assert.doesNotMatch(publishedServiceSource, /ФАС|\bFAS\b/iu);
  assert.doesNotMatch(publishedServiceSource, /спор\S*\s+(?:в|по)\s+закуп/iu);
  assert.doesNotMatch(publishedServiceSource, /жалоб\S*\s+.*закуп|жалоб\S*\s+.*заказчик/iu);
});

test("published service copy and guided intake contain no staffing support offering", () => {
  const serviceAndIntakeSource = `${publishedServiceSource}\n${precheckSource}`;

  assert.doesNotMatch(serviceAndIntakeSource, /кадров/iu);
  assert.doesNotMatch(serviceAndIntakeSource, /трудов(?:ой|ые|ая|ое|ого|ому|ым|ом)/iu);
  assert.doesNotMatch(serviceAndIntakeSource, /\["employees",\s*"Сотрудники"\]/u);
});

test("tender support and every unrelated practice remain published", () => {
  for (const requiredCopy of [
    "Тендеры и государственные закупки",
    "44-ФЗ",
    "223-ФЗ",
    "Юридический аутсорсинг бизнеса",
    "ЖКХ, управляющие компании и ТСЖ",
    "Арбитраж и судебные споры",
    "Договоры, претензии и переговоры",
  ]) {
    assert.match(contentSource, new RegExp(requiredCopy));
  }

  const practicesBlock = contentSource.split("export const PRACTICES = [")[1].split("export const APPROACH")[0];
  const numbers = [...practicesBlock.matchAll(/number:\s*"(\d{2})"/g)].map((match) => match[1]);
  assert.deepEqual(numbers, ["01", "02", "03", "04", "05"]);
  assert.match(contentSource, /\["5",\s*"правовых практик"\]/);
});
