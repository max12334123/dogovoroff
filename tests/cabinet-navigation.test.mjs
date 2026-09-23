import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCabinetHref,
  getCanonicalCabinetLocation,
  getHistoryNavigationDecision,
  getClientPrimaryAction,
  parseCabinetLocation,
  registerBeforeUnloadGuard,
  resolvePendingHistoryNavigation,
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

test("canonical cabinet location removes invalid and extra direct URL state", () => {
  assert.deepEqual(
    getCanonicalCabinetLocation("?view=documents&matter=matter-b&draft=private-text", matters),
    {
      view: "documents",
      matterId: "matter-b",
      href: "/cabinet?view=documents&matter=matter-b",
    },
  );
  assert.deepEqual(
    getCanonicalCabinetLocation("?view=admin&matter=foreign&filename=private.pdf", matters),
    {
      view: "overview",
      matterId: "matter-a",
      href: "/cabinet?matter=matter-a",
    },
  );
});

test("Back and Forward with a draft restore the message entry before prompting", () => {
  const current = { view: "messages", matterId: "matter-a" };

  assert.deepEqual(
    getHistoryNavigationDecision({
      current,
      requested: { view: "documents", matterId: "matter-a" },
      hasDraft: true,
      currentIndex: 2,
      requestedIndex: 1,
    }),
    {
      kind: "restore_then_prompt",
      returnDelta: 1,
      pending: {
        kind: "history",
        view: "documents",
        matterId: "matter-a",
        sourceIndex: 2,
        targetIndex: 1,
      },
    },
  );
  assert.deepEqual(
    getHistoryNavigationDecision({
      current,
      requested: { view: "overview", matterId: "matter-a" },
      hasDraft: true,
      currentIndex: 1,
      requestedIndex: 2,
    }),
    {
      kind: "restore_then_prompt",
      returnDelta: -1,
      pending: {
        kind: "history",
        view: "overview",
        matterId: "matter-a",
        sourceIndex: 1,
        targetIndex: 2,
      },
    },
  );
});

test("Back and Forward draft prompts keep the current view or resume the requested entry", () => {
  for (const { pending, delta } of [
    {
      pending: {
        kind: "history",
        view: "documents",
        matterId: "matter-a",
        sourceIndex: 2,
        targetIndex: 1,
      },
      delta: -1,
    },
    {
      pending: {
        kind: "history",
        view: "overview",
        matterId: "matter-a",
        sourceIndex: 1,
        targetIndex: 2,
      },
      delta: 1,
    },
  ]) {
    assert.deepEqual(resolvePendingHistoryNavigation(pending, "continue"), { kind: "stay" });
    assert.deepEqual(resolvePendingHistoryNavigation(pending, "discard"), {
      kind: "go",
      delta,
      location: { view: pending.view, matterId: pending.matterId },
    });
  }
});

test("beforeunload guard warns only while registered and cleans up its listener", () => {
  let listener = null;
  const target = {
    addEventListener(type, nextListener) {
      assert.equal(type, "beforeunload");
      listener = nextListener;
    },
    removeEventListener(type, nextListener) {
      assert.equal(type, "beforeunload");
      assert.equal(nextListener, listener);
      listener = null;
    },
  };
  const cleanup = registerBeforeUnloadGuard(target);
  const event = {
    defaultPrevented: false,
    returnValue: undefined,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };

  listener(event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(event.returnValue, "");
  cleanup();
  assert.equal(listener, null);
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
