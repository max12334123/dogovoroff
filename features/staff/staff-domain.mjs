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
