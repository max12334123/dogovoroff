const STAFF_ROLES = new Set(["admin", "lawyer"]);

export function hasStaffAccess(memberships) {
  return Array.isArray(memberships) && memberships.some((membership) => STAFF_ROLES.has(membership?.role));
}

export function getStaffRoleLabel(memberships) {
  if (!Array.isArray(memberships)) {
    return "";
  }

  if (memberships.some((membership) => membership?.role === "admin")) {
    return "Администратор";
  }

  if (memberships.some((membership) => membership?.role === "lawyer")) {
    return "Юрист";
  }

  return "";
}

export function getStaffOrganizationIds(memberships) {
  if (!Array.isArray(memberships)) {
    return [];
  }

  return [...new Set(
    memberships
      .filter((membership) => STAFF_ROLES.has(membership?.role) && typeof membership.organization_id === "string")
      .map((membership) => membership.organization_id),
  )];
}

export function getAdminOrganizationIds(memberships) {
  if (!Array.isArray(memberships)) {
    return [];
  }

  return [...new Set(
    memberships
      .filter((membership) => membership?.role === "admin" && typeof membership.organization_id === "string")
      .map((membership) => membership.organization_id),
  )];
}

export function filterStaffNavigation(items, { canViewAudit = false, intakeEnabled = false } = {}) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.filter((item) => {
    if (item?.id === "audit" && !canViewAudit) return false;
    if (item?.id === "inbox" && !intakeEnabled) return false;
    return true;
  });
}

export function getStaffMatterQueue(matter) {
  if (!matter || matter.state === "archived" || matter.state === "completed") {
    return "archive";
  }

  if (matter.state === "paused") {
    return "paused";
  }

  const requests = Array.isArray(matter.documentRequests) ? matter.documentRequests : [];
  if (requests.some((request) => request.status === "submitted")) {
    return "action";
  }
  if (requests.some((request) => request.status === "requested" || request.status === "changes_requested")) {
    return "waiting";
  }

  return matter.nextAction ? "waiting" : "action";
}

export function filterStaffMatters(matters, query = "", queue = "all") {
  if (!Array.isArray(matters)) {
    return [];
  }

  const normalizedQuery = typeof query === "string" ? query.trim().toLocaleLowerCase("ru-RU") : "";

  return matters.filter((matter) => {
    const matchesQueue = queue === "all" || getStaffMatterQueue(matter) === queue;
    if (!matchesQueue) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return [matter?.reference, matter?.title, matter?.summary]
      .filter((value) => typeof value === "string")
      .some((value) => value.toLocaleLowerCase("ru-RU").includes(normalizedQuery));
  });
}

export function filterStaffAuditEvents(events, matters, query = "") {
  if (!Array.isArray(events)) {
    return [];
  }

  const normalizedQuery = typeof query === "string" ? query.trim().toLocaleLowerCase("ru-RU") : "";
  if (!normalizedQuery) {
    return events;
  }

  const matterById = new Map(
    (Array.isArray(matters) ? matters : [])
      .filter((matter) => typeof matter?.id === "string")
      .map((matter) => [matter.id, matter]),
  );

  return events.filter((event) => {
    const matter = matterById.get(event?.matterId);
    return [
      matter?.reference,
      matter?.title,
      matter?.summary,
      event?.action,
      event?.entityType,
    ]
      .filter((value) => typeof value === "string")
      .some((value) => value.toLocaleLowerCase("ru-RU").includes(normalizedQuery));
  });
}
