import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCabinetHref,
  getClientPrimaryAction,
  parseCabinetLocation,
} from "../features/cabinet/cabinet-navigation-domain.mjs";

const matters = [
  { id: "matter-a", nextAction: { title: "Подписать акт", description: "Проверьте данные." }, documentRequests: [] },
  { id: "matter-b", nextAction: null, documentRequests: [] },
];

test("cabinet location accepts only a loaded matter and known view", () => {
  assert.deepEqual(parseCabinetLocation("?view=documents&matter=matter-b", matters), { view: "documents", matterId: "matter-b" });
  assert.deepEqual(parseCabinetLocation("?view=admin&matter=foreign", matters), { view: "overview", matterId: "matter-a" });
});

test("cabinet href contains no client text", () => {
  assert.equal(buildCabinetHref({ view: "messages", matterId: "matter-a" }), "/cabinet?view=messages&matter=matter-a");
  assert.equal(buildCabinetHref({ view: "overview", matterId: null }), "/cabinet");
});

test("returned document request outranks the generic next action", () => {
  const action = getClientPrimaryAction({ ...matters[0], clientPrimaryDocumentRequest: { status: "changes_requested", title: "Документы по договору", lastReviewNote: "Добавьте последнюю страницу." } });
  assert.deepEqual(action, { kind: "document_changes", eyebrow: "Требуется от вас", title: "Исправьте комплект документов", description: "Добавьте последнюю страницу.", label: "Открыть запрос", targetView: "documents" });
});

test("quiet matter has no artificial call to action", () => {
  assert.deepEqual(getClientPrimaryAction(matters[1]), { kind: "waiting", eyebrow: "Текущий статус", title: "Сейчас от вас ничего не требуется", description: "Юрист работает с материалами. Мы сообщим, когда потребуется ваше участие.", label: null, targetView: null });
});

test("unread message becomes the fallback client action", () => {
  assert.deepEqual(
    getClientPrimaryAction(matters[1], { hasUnreadMessage: true }),
    {
      kind: "message",
      eyebrow: "Новое сообщение",
      title: "Юрист написал по делу",
      description: "Откройте защищённую переписку, чтобы прочитать сообщение.",
      label: "Открыть сообщения",
      targetView: "messages",
    },
  );
});

test("document request continues to outrank an unread message", () => {
  assert.deepEqual(
    getClientPrimaryAction({
      ...matters[0],
      clientPrimaryDocumentRequest: {
        status: "requested",
        title: "Документы по договору",
        instructions: "Добавьте подписанный экземпляр.",
      },
    }, { hasUnreadMessage: true }),
    {
      kind: "document_request",
      eyebrow: "Требуется от вас",
      title: "Документы по договору",
      description: "Добавьте подписанный экземпляр.",
      label: "Добавить документы",
      targetView: "documents",
    },
  );
});

test("completed matter links to its final documents", () => {
  assert.deepEqual(getClientPrimaryAction({ ...matters[1], state: "completed" }), { kind: "completed", eyebrow: "Дело завершено", title: "Итоговые материалы готовы", description: "Документы и рекомендации остаются доступны в защищённом кабинете.", label: "Открыть документы", targetView: "documents" });
});
