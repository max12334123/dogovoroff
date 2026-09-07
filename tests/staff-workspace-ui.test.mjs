import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createDraftRegistry, createStaffHistory, getWorkspaceTabs, getTabAfterKey } from "../features/staff/staff-workspace-ui-domain.mjs";

test("tabs filter management and wrap arrow, Home and End navigation", () => {
  assert.deepEqual(getWorkspaceTabs(false), ["overview", "documents", "messages"]);
  assert.equal(getWorkspaceTabs(true).at(-1), "management");
  const tabs = getWorkspaceTabs(false);
  assert.equal(getTabAfterKey(tabs, "overview", "ArrowLeft"), "messages");
  assert.equal(getTabAfterKey(tabs, "messages", "ArrowRight"), "overview");
  assert.equal(getTabAfterKey(tabs, "documents", "Home"), "overview");
  assert.equal(getTabAfterKey(tabs, "documents", "End"), "messages");
  assert.equal(getTabAfterKey(tabs, "documents", "Tab"), null);
});

test("dirty registry retains drafts until explicit discard and blocks in-flight work", () => {
  const registry = createDraftRegistry();
  let discarded = 0;
  registry.set("message", { dirty: true, busy: false, discard: () => discarded++ });
  assert.equal(registry.dirty(), true);
  assert.equal(discarded, 0);
  registry.set("document", { dirty: false, busy: true });
  assert.equal(registry.busy(), true);
  registry.delete("document");
  registry.discard();
  assert.equal(discarded, 1);
  assert.equal(registry.dirty(), false);
});

test("history Back and Forward restore before confirmation and preserve framework state", () => {
  const state = { __NA: true, tree: ["staff"] };
  const moves = [];
  const win = { location: { href: "/staff" }, history: {
    state,
    replaceState(next) { this.state = next; },
    go(delta) { moves.push(delta); },
  } };
  const history = createStaffHistory(win);
  history.mark();
  const first = win.history.state;
  history.pushed();
  const second = win.history.state;
  assert.equal(second.__NA, true);
  assert.equal(second.tree, state.tree);
  let confirm;
  const blocked = (action) => { confirm = action; };
  assert.equal(history.pop({ state: first }, true, blocked), true);
  assert.deepEqual(moves, [1]);
  assert.equal(history.pop({ state: second }, true, blocked), true);
  assert.equal(typeof confirm, "function");
  confirm();
  assert.deepEqual(moves, [1, -1]);
  assert.equal(history.pop({ state: first }, false, blocked), false);
  assert.equal(history.pop({ state: second }, true, blocked), true);
  assert.deepEqual(moves, [1, -1, -1]);
});

test("dialog focus enters, traps both directions, ignores hidden fields and returns to opener", async () => {
  const source = await readFile(new URL("../features/staff/staff-workspace-ui.jsx", import.meta.url), "utf8");
  const functionSource = source.slice(source.indexOf("export function useDialogFocus"), source.indexOf("export function StaffDialog")).replace("export ", "");
  let cleanup;
  const handlers = new Map();
  const doc = { body: { style: { overflow: "auto" } }, activeElement: null,
    addEventListener(name, handler) { handlers.set(name, handler); },
    removeEventListener(name) { handlers.delete(name); },
  };
  const node = (visible = true) => ({ isConnected: true, getClientRects: () => visible ? [{}] : [], focus() { doc.activeElement = this; } });
  const opener = node();
  const first = node();
  const hidden = node(false);
  const last = node();
  const dialog = { querySelectorAll: () => [first, hidden, last], contains: (target) => [first, hidden, last].includes(target),
    addEventListener(name, handler) { handlers.set(name, handler); },
    removeEventListener(name) { handlers.delete(name); },
  };
  let closed = 0;
  const hook = new Function("useEffect", "useRef", "document", `${functionSource}; return useDialogFocus;`)(
    (effect) => { cleanup = effect(); }, (current) => ({ current }), doc,
  );
  hook({ current: dialog }, () => { closed++; }, { current: opener });
  assert.equal(doc.activeElement, first);
  assert.equal(doc.body.style.overflow, "hidden");
  handlers.get("keydown")({ key: "Tab", shiftKey: true, preventDefault() {} });
  assert.equal(doc.activeElement, last);
  handlers.get("keydown")({ key: "Tab", shiftKey: false, preventDefault() {} });
  assert.equal(doc.activeElement, first);
  handlers.get("focusin")({ target: opener });
  assert.equal(doc.activeElement, first);
  handlers.get("keydown")({ key: "Escape", preventDefault() {} });
  assert.equal(closed, 1);
  cleanup();
  assert.equal(doc.activeElement, opener);
  assert.equal(doc.body.style.overflow, "auto");
  assert.equal(handlers.size, 0);
});
