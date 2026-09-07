export function getWorkspaceTabs(canManage) {
  return ["overview", "documents", "messages", ...(canManage ? ["management"] : [])];
}

export function getTabAfterKey(tabs, active, key) {
  if (key === "Home") return tabs[0];
  if (key === "End") return tabs.at(-1);
  const delta = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0;
  return delta ? tabs[(tabs.indexOf(active) + delta + tabs.length) % tabs.length] : null;
}

export function createDraftRegistry() {
  const entries = new Map();
  return {
    set: (key, value) => entries.set(key, value),
    delete: (key) => entries.delete(key),
    dirty: () => [...entries.values()].some((entry) => entry.dirty),
    busy: () => [...entries.values()].some((entry) => entry.busy),
    discard() {
      for (const entry of entries.values()) entry.discard?.();
      entries.clear();
    },
  };
}

// Only an integer cursor is added to Next's state; drafts never enter history.
// Restore a traversed entry before asking, so cancelling preserves the Forward branch.
export function createStaffHistory(win) {
  const key = "staffWorkspaceIndex";
  let current = win.history.state?.[key] ?? 0;
  let restoring = null;
  let replaying = false;
  const mark = () => win.history.replaceState({ ...win.history.state, [key]: current }, "", win.location.href);
  return {
    mark,
    pushed() { current += 1; mark(); },
    pop(event, blocked, request) {
      if (restoring) {
        const { delta, ask } = restoring;
        restoring = null;
        ask(() => { replaying = true; win.history.go(delta); });
        return true;
      }
      const target = event.state?.[key];
      const delta = Number.isInteger(target) ? target - current : -1;
      if (blocked && !replaying && delta) {
        restoring = { delta, ask: request };
        win.history.go(-delta);
        return true;
      }
      replaying = false;
      current = Number.isInteger(target) ? target : current + delta;
      return false;
    },
  };
}
