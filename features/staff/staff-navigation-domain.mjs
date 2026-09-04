const PRIMARY = ["today", "inbox", "matters", "clients", "more"];
const MORE = ["documents", "messages", "audit", "trash"];
const LIST_VIEWS = new Set(["today", "inbox", "matters", "clients", ...MORE]);
export const STAFF_MATTER_TABS = Object.freeze(["overview", "documents", "messages", "management"]);
const TAB_SET = new Set(STAFF_MATTER_TABS);

export function getStaffNavigation({ intakeEnabled = false, canViewAudit = false, canManageTrash = false } = {}) {
  return {
    primary: PRIMARY.filter((view) => view !== "inbox" || intakeEnabled),
    more: MORE.filter((view) => (
      (view !== "audit" || canViewAudit) && (view !== "trash" || canManageTrash)
    )),
  };
}

export function parseStaffLocation(search, matters = [], capabilities = {}) {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search || "");
  const view = params.get("view");
  const matterId = matters.some((matter) => matter?.id === params.get("matter")) ? params.get("matter") : null;
  const navigation = getStaffNavigation(capabilities);
  const allowedViews = new Set([...navigation.primary, ...navigation.more]);
  if (view === "matter" && matterId) {
    const tab = TAB_SET.has(params.get("tab")) ? params.get("tab") : "overview";
    const from = allowedViews.has(params.get("from")) && params.get("from") !== "more" ? params.get("from") : "today";
    return { view: "matter", matterId, tab, from };
  }
  return {
    view: allowedViews.has(view) && view !== "more" ? view : "today",
    matterId: null,
    tab: "overview",
    from: "today",
  };
}

export function buildStaffHref({ view = "today", matterId = null, tab = "overview", from = "today" } = {}) {
  const params = new URLSearchParams();
  const safeView = view === "matter" || LIST_VIEWS.has(view) ? view : "today";
  if (safeView !== "today") params.set("view", safeView);
  if (safeView === "matter" && matterId) {
    params.set("matter", matterId);
    if (TAB_SET.has(tab) && tab !== "overview") params.set("tab", tab);
    if (LIST_VIEWS.has(from)) params.set("from", from);
  }
  const query = params.toString();
  return query ? `/staff?${query}` : "/staff";
}
