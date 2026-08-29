import { loadCabinetData } from "../cabinet/cabinet-server";
import {
  getAdminOrganizationIds,
  getStaffOrganizationIds,
  getStaffRoleLabel,
  hasStaffAccess,
} from "./staff-domain.mjs";

export async function loadStaffData(supabase, userId) {
  if (typeof userId !== "string" || !userId) {
    return null;
  }

  const { data: memberships, error: membershipsError } = await supabase
    .from("organization_members")
    .select("organization_id,role")
    .eq("user_id", userId);

  if (membershipsError) {
    throw new Error(`Staff membership query failed: ${membershipsError.code ?? "unknown"}`);
  }

  if (!hasStaffAccess(memberships)) {
    return null;
  }

  const organizationIds = getStaffOrganizationIds(memberships);
  const { data: organizations, error: organizationsError } = await supabase
    .from("organizations")
    .select("id,name")
    .in("id", organizationIds);

  if (organizationsError) {
    throw new Error(`Staff organization query failed: ${organizationsError.code ?? "unknown"}`);
  }

  const adminOrganizationIds = new Set(getAdminOrganizationIds(memberships));
  const assignmentOrganizationsPromise = Promise.all(
    (organizations ?? [])
      .filter((organization) => adminOrganizationIds.has(organization.id))
      .map(async (organization) => {
        const { data: staff, error: staffError } = await supabase
          .rpc("list_assignable_staff", { target_organization_id: organization.id });

        if (staffError) {
          throw new Error(`Staff assignment directory query failed: ${staffError.code ?? "unknown"}`);
        }

        return {
          id: organization.id,
          name: organization.name,
          staff: (staff ?? []).map((member) => ({
            id: member.user_id,
            name: member.display_name,
            role: member.member_role,
          })),
        };
      }),
  );
  const mattersPromise = loadCabinetData(supabase, userId, {
    includeOrganizationId: true,
    messageParticipantLabel: "Участник дела",
  });
  const auditEventsPromise = adminOrganizationIds.size === 0
    ? Promise.resolve([])
    : (async () => {
      const auditQuery = supabase
        .from("audit_events")
        .select("id,matter_id,action,entity_type,created_at")
        .in("organization_id", [...adminOrganizationIds]);
      const orderedQuery = auditQuery.order("created_at", { ascending: false });
      const result = typeof orderedQuery?.limit === "function"
        ? await orderedQuery.limit(80)
        : await orderedQuery;

      if (result.error) {
        throw new Error(`Staff audit query failed: ${result.error.code ?? "unknown"}`);
      }

      return (result.data ?? []).map((event) => ({
        id: event.id,
        matterId: event.matter_id,
        action: event.action,
        entityType: event.entity_type,
        createdAt: event.created_at,
      }));
    })();
  const [assignmentOrganizations, matters, auditEvents] = await Promise.all([
    assignmentOrganizationsPromise,
    mattersPromise,
    auditEventsPromise,
  ]);

  return {
    roleLabel: getStaffRoleLabel(memberships),
    organizations: organizations ?? [],
    assignmentOrganizations,
    matters,
    auditEvents,
    canViewAudit: adminOrganizationIds.size > 0,
  };
}
