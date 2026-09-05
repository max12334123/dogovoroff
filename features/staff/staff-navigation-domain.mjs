const PRIMARY = ["today", "inbox", "matters", "clients", "more"];
const MORE = ["documents", "messages", "audit", "trash"];
const LIST_VIEWS = new Set(["today", "inbox", "matters", "clients", ...MORE]);
export const STAFF_MATTER_TABS = Object.freeze(["overview", "documents", "messages", "management"]);
const TAB_SET = new Set(STAFF_MATTER_TABS);
const SAFE_MATTER_ID = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|matter-[a-z0-9]+(?:-[a-z0-9]+)*)$/i;

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
  let safeView = view === "matter" || LIST_VIEWS.has(view) ? view : "today";
  if (safeView === "matter" && !(typeof matterId === "string" && SAFE_MATTER_ID.test(matterId))) {
    safeView = "today";
  }
  if (safeView !== "today") params.set("view", safeView);
  if (safeView === "matter" && typeof matterId === "string" && SAFE_MATTER_ID.test(matterId)) {
    params.set("matter", matterId);
    if (TAB_SET.has(tab) && tab !== "overview") params.set("tab", tab);
    if (LIST_VIEWS.has(from)) params.set("from", from);
  }
  const query = params.toString();
  return query ? `/staff?${query}` : "/staff";
}

export function getStaffMatterLocation(current, matterId, tab = "overview", matters = [], capabilities = {}) {
  return parseStaffLocation(buildStaffHref({
    view: "matter",
    matterId,
    tab,
    from: current.view === "matter" ? current.from : current.view,
  }).split("?")[1], matters, capabilities);
}
