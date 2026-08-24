import assert from "node:assert/strict";
import test from "node:test";
import {
  PRECHECK_PRACTICES,
  PRECHECK_PRACTICE_IDS,
  practiceIdFromService,
} from "../features/precheck/config.mjs";

test("configuration contains six stable practices and no procurement-appeal scenarios", () => {
  assert.deepEqual(
    PRECHECK_PRACTICES.map(({ id }) => id),
    ["tenders", "business", "housing", "litigation", "contracts", "private"],
  );
  assert.deepEqual([...PRECHECK_PRACTICE_IDS], [
    "tenders",
    "business",
    "housing",
    "litigation",
    "contracts",
    "private",
  ]);

  const serialized = JSON.stringify(PRECHECK_PRACTICES);
  assert.doesNotMatch(serialized, /ФАС|жалоб.{0,20}закуп|обжалован.{0,20}закуп/i);
});

test("each practice has bounded allowlisted questions and deterministic fallback content", () => {
  for (const practice of PRECHECK_PRACTICES) {
    assert.equal(typeof practice.label, "string");
    assert.equal(typeof practice.service, "string");
    assert.ok(practice.questions.length >= 7);

    const questionIds = new Set();
    for (const question of practice.questions) {
      assert.match(question.id, /^[a-z][A-Za-z0-9]*$/);
      assert.equal(questionIds.has(question.id), false);
      questionIds.add(question.id);
      assert.ok(["select", "radio", "date", "textarea"].includes(question.type));
      if (question.type === "select" || question.type === "radio") {
        assert.ok(question.options.length >= 2);
        for (const option of question.options) {
          assert.equal(option.length, 2);
          assert.match(option[0], /^[a-z][a-z0-9_]*$/);
        }
      }
      if (question.type === "textarea") {
        assert.ok(question.maxLength > 0 && question.maxLength <= 300);
      }
    }

    for (const key of [
      "fallbackMissingInformation",
      "fallbackDocuments",
      "fallbackQuestions",
    ]) {
      assert.ok(practice[key].length >= 1 && practice[key].length <= 5);
    }
    assert.ok(practice.fallbackNextStep.length > 0);
  }
});

test("existing services map to a stable precheck practice", () => {
  assert.equal(practiceIdFromService("Тендеры и госзакупки (44-ФЗ, 223-ФЗ)"), "tenders");
  assert.equal(practiceIdFromService("Юридический аутсорсинг бизнеса"), "business");
  assert.equal(practiceIdFromService("ЖКХ, УК и ТСЖ"), "housing");
  assert.equal(practiceIdFromService("Арбитраж и суды"), "litigation");
  assert.equal(practiceIdFromService("Договоры и претензии"), "contracts");
  assert.equal(practiceIdFromService("Другое / не знаю"), "private");
  assert.equal(practiceIdFromService("Неизвестная услуга"), "private");
});
