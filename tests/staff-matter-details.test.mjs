import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getMatterDetailsErrorMessage,
  validateMatterDetails,
} from "../features/staff/staff-matter-details-domain.mjs";

const MATTER_ID = "a1111111-1111-4111-8111-111111111111";

test("matter details validation normalizes editable metadata", () => {
  const result = validateMatterDetails({
    matterId: MATTER_ID,
    reference: "  DO-2026-01  ",
    title: "  Проверка   договора  ",
    summary: "  Первая строка\nВторая строка  ",
    responseDueAt: "2026-09-03",
  });

  assert.deepEqual(result, {
    valid: true,
    value: {
      matterId: MATTER_ID,
      reference: "DO-2026-01",
      title: "Проверка договора",
      summary: "Первая строка\nВторая строка",
      responseDueAt: "2026-09-03",
    },
    error: "",
  });
});

test("matter details validation accepts an empty response date and rejects unsafe values", () => {
  const emptyDate = validateMatterDetails({
    matterId: MATTER_ID,
    reference: "DO-1",
    title: "Дело",
    summary: "Описание",
    responseDueAt: "",
  });
  assert.equal(emptyDate.valid, true);
  assert.equal(emptyDate.value.responseDueAt, null);

  assert.equal(validateMatterDetails({ matterId: MATTER_ID, reference: "", title: "Дело" }).valid, false);
  assert.equal(validateMatterDetails({ matterId: MATTER_ID, reference: "DO-1", title: "Дело", responseDueAt: "2026-02-31" }).valid, false);
  assert.equal(validateMatterDetails({
    matterId: MATTER_ID,
    reference: "DO-1",
    title: "Дело",
    summary: "Безопасное описание\u0001",
  }).valid, false);
  assert.equal(validateMatterDetails({
    matterId: MATTER_ID,
    reference: "DO-1\u0001",
    title: "Дело",
  }).valid, false);
  assert.match(validateMatterDetails({
    matterId: MATTER_ID,
    reference: "DO-1",
    title: "x".repeat(241),
  }).error, /240/);
});

test("matter details errors stay user-facing and do not expose provider details", () => {
  assert.equal(getMatterDetailsErrorMessage({ message: "details_requires_admin" }), "Редактировать реквизиты может только администратор организации.");
  assert.equal(getMatterDetailsErrorMessage({ message: "reference_conflict" }), "Такой номер дела уже используется в организации.");
  assert.equal(getMatterDetailsErrorMessage({ code: "23505", message: "private constraint detail" }), "Такой номер дела уже используется в организации.");
  assert.equal(getMatterDetailsErrorMessage({ code: "42501", message: "private provider detail" }), "У вас нет прав изменять это дело.");
  assert.equal(getMatterDetailsErrorMessage({ message: "unexpected provider detail" }), "Не удалось обновить реквизиты дела. Попробуйте ещё раз.");
});

test("matter details RPC is admin-only, narrow, and does not expose a delete path", async () => {
  const source = await readFile(
    new URL("../supabase/migrations/20260829090000_add_matter_details_management.sql", import.meta.url),
    "utf8",
  );

  assert.match(source, /prevent_non_admin_matter_details_change/);
  assert.match(source, /create trigger matters_details_admin_only/);
  assert.match(source, /create or replace function public\.update_matter_details/);
  assert.match(source, /security definer/);
  assert.match(source, /set search_path = ''/);
  assert.match(source, /private\.is_org_admin\(target_organization_id\)/);
  assert.match(source, /reference_conflict/);
  assert.match(source, /invalid_matter_details/);
  assert.match(source, /reference = normalized_reference/);
  assert.match(source, /title = normalized_title/);
  assert.match(source, /summary = normalized_summary/);
  assert.match(source, /response_due_at = new_response_due_at/);
  assert.match(source, /grant execute on function public\.update_matter_details/);
  assert.doesNotMatch(source, /delete\s+from\s+public\.matters/i);
  assert.doesNotMatch(source, /service_role/i);
});
