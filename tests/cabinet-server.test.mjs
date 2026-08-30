import assert from "node:assert/strict";
import test from "node:test";

import { loadCabinetData } from "../features/cabinet/cabinet-server.js";

const CLIENT_ID = "11111111-1111-4111-8111-111111111111";
const LAWYER_ID = "33333333-3333-4333-8333-333333333333";
const MATTER_ID = "a1111111-1111-4111-8111-111111111111";
const ORGANIZATION_ID = "b1111111-1111-4111-8111-111111111111";

function createSupabaseFixture(overrides = {}) {
  const requestedMatterIds = new Map();
  const responses = {
    matters: {
      data: [{
        id: MATTER_ID,
        organization_id: ORGANIZATION_ID,
        reference: "TEST-01",
        title: "Проверка договора",
        summary: "Безопасное тестовое описание.",
        status: "active",
        response_due_at: "2026-09-01T10:00:00.000Z",
        next_action_title: "Загрузить приложение",
        next_action_description: "Добавьте недостающий файл.",
        next_action_due_at: "2026-09-02T10:00:00.000Z",
        created_by: LAWYER_ID,
        created_at: "2026-08-26T10:00:00.000Z",
        updated_at: "2026-08-27T10:00:00.000Z",
      }],
      error: null,
    },
    matter_stages: {
      data: [{
        id: "a1111111-aaaa-4111-8111-111111111111",
        matter_id: MATTER_ID,
        position: 1,
        title: "Документы приняты",
        detail: "В работе",
        status: "current",
        completed_at: null,
      }],
      error: null,
    },
    matter_events: {
      data: [{
        id: "a1111111-aaaa-4111-9111-111111111111",
        matter_id: MATTER_ID,
        event_type: "matter.updated",
        public_text: "Материалы переданы юристу.",
        actor_id: LAWYER_ID,
        created_at: "2026-08-27T10:00:00.000Z",
      }],
      error: null,
    },
    documents: {
      data: [{
        id: "a1111111-aaaa-4111-a111-111111111111",
        matter_id: MATTER_ID,
        storage_path: `${MATTER_ID}/a1111111-aaaa-4111-a111-111111111111/document.pdf`,
        original_name: "Договор.pdf",
        mime_type: "application/pdf",
        size_bytes: 2048,
        status: "received",
        uploaded_by: LAWYER_ID,
        created_at: "2026-08-27T09:30:00.000Z",
        updated_at: "2026-08-27T10:00:00.000Z",
      }],
      error: null,
    },
    messages: {
      data: [
        {
          id: "a1111111-aaaa-4111-b111-111111111111",
          matter_id: MATTER_ID,
          author_id: CLIENT_ID,
          body: "Сообщение клиента.",
          created_at: "2026-08-27T10:00:00.000Z",
        },
        {
          id: "a1111111-aaaa-4111-b222-222222222222",
          matter_id: MATTER_ID,
          author_id: LAWYER_ID,
          body: "Ответ команды.",
          created_at: "2026-08-27T09:00:00.000Z",
        },
      ],
      error: null,
    },
    ...overrides,
  };

  return {
    requestedMatterIds,
    from(table) {
      const builder = {
        select() {
          return builder;
        },
        in(_column, values) {
          requestedMatterIds.set(table, [...values]);
          return builder;
        },
        order() {
          return Promise.resolve(responses[table] ?? { data: [], error: null });
        },
      };
      return builder;
    },
  };
}

test("cabinet loader maps one RLS-filtered matter with documents and messages", async () => {
  const supabase = createSupabaseFixture();
  const matters = await loadCabinetData(supabase, CLIENT_ID);

  assert.equal(matters.length, 1);
  assert.equal(matters[0].id, MATTER_ID);
  assert.equal("organizationId" in matters[0], false);
  assert.equal("responseDueAt" in matters[0], false);
  assert.equal("detailsSummary" in matters[0], false);
  assert.equal(matters[0].stages[0].status, "current");
  assert.equal(matters[0].documents[0].name, "Договор.pdf");
  assert.equal(matters[0].documents[0].storagePath.endsWith("/document.pdf"), true);
  assert.equal(matters[0].documents[0].updatedAt, "2026-08-27T10:00:00.000Z");
  assert.deepEqual(matters[0].messages.map(({ sender }) => sender), ["Вы", "Команда ДоговорОфф"]);
  assert.equal(matters[0].nextAction.title, "Загрузить приложение");
  assert.match(matters[0].updated, /27 августа/);
  assert.deepEqual(
    matters[0].notifications.map(({ type }) => type),
    ["matter.created", "matter.updated", "matter.event.created", "document.created", "message.created"],
  );
  assert.doesNotMatch(JSON.stringify(matters[0].notifications), /Договор\.pdf|Сообщение клиента|Ответ команды/);

  for (const table of ["matter_stages", "matter_events", "documents", "messages"]) {
    assert.deepEqual(supabase.requestedMatterIds.get(table), [MATTER_ID]);
  }
});

test("cabinet loader exposes the organization id only for the explicit staff view", async () => {
  const supabase = createSupabaseFixture();
  const matters = await loadCabinetData(supabase, LAWYER_ID, {
    includeOrganizationId: true,
    messageParticipantLabel: "Участник дела",
  });

  assert.equal(matters[0].organizationId, ORGANIZATION_ID);
  assert.equal(matters[0].responseDueAt, "2026-09-01T10:00:00.000Z");
  assert.equal(matters[0].detailsSummary, "Безопасное тестовое описание.");
});

test("cabinet loader stops on an RLS query error without exposing provider details", async () => {
  const supabase = createSupabaseFixture({
    documents: { data: null, error: { code: "42501", message: "private provider detail" } },
  });

  await assert.rejects(
    loadCabinetData(supabase, CLIENT_ID),
    (error) => error.message === "Cabinet detail query failed: 42501"
      && !error.message.includes("private provider detail"),
  );
});
