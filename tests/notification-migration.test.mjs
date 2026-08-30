import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20260830051128_add_notification_read_state.sql", import.meta.url),
  "utf8",
);

test("notification migration stores only a read timestamp on the protected profile", () => {
  assert.match(migration, /alter table public\.profiles/i);
  assert.match(migration, /add column if not exists notifications_read_at timestamptz/i);
  assert.doesNotMatch(migration, /create table public\.notifications/i);
  assert.doesNotMatch(migration, /title|message_body|document_name|original_name/i);
});
