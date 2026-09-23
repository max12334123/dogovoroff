import { loadCabinetData } from "../cabinet/cabinet-server";
import {
  getAdminOrganizationIds,
  getStaffOrganizationIds,
  getStaffRoleLabel,
  hasStaffAccess,
} from "./staff-domain.mjs";
import { mapIntakeRequestRows } from "./staff-intake-domain.mjs";

async function addMatterAssignments(supabase, matters) {
  // Keep calls bounded to the RPC limit; the database independently checks every ID.
  const assignments = new Map();
  for (let offset = 0; offset < matters.length; offset += 100) {
    const matterIds = matters.slice(offset, offset + 100).map((matter) => matter.id);
    const { data, error } = await supabase.rpc("list_staff_matter_assignments", {
      target_matter_ids: matterIds,
    });
    // Support a rolling deployment without confusing an absent reader with no assignment.
    if (error?.code === "PGRST202") break;
    if (error) throw new Error(`Staff matter assignment query failed: ${error.code ?? "unknown"}`);
    const requestedIds = new Set(matterIds);
    for (const row of data ?? []) {
      if (requestedIds.has(row.matter_id)) assignments.set(row.matter_id, row);
    }
  }

  return matters.map((matter) => {
    const assignment = assignments.get(matter.id);
    return {
      ...matter,
      assignmentStatus: assignment ? (assignment.assigned_lawyer_id ? "assigned" : "unassigned") : "unavailable",
      assignedLawyerId: assignment?.assigned_lawyer_id ?? null,
      assignedLawyerName: assignment?.assigned_lawyer_name ?? null,
    };
  });
}

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
  const intakeEnabled = process.env.CONTACT_INBOX_ENABLED === "true";
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
  const intakeRequestsPromise = intakeEnabled
    ? Promise.all(
      (organizations ?? []).map(async (organization) => {
        const { data: requests, error: requestsError } = await supabase
          .rpc("list_intake_requests", { target_organization_id: organization.id });

        if (requestsError) {
          throw new Error(`Staff intake query failed: ${requestsError.code ?? "unknown"}`);
        }

        return mapIntakeRequestRows(requests).map((request) => ({
          ...request,
          organizationName: organization.name,
        }));
      }),
    ).then((groups) => groups.flat())
    : Promise.resolve([]);
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
  const [assignmentOrganizations, intakeRequests, matters, auditEvents] = await Promise.all([
    assignmentOrganizationsPromise,
    intakeRequestsPromise,
    mattersPromise,
    auditEventsPromise,
  ]);

  return {
    roleLabel: getStaffRoleLabel(memberships),
    organizations: organizations ?? [],
    assignmentOrganizations,
    intakeEnabled,
    intakeRequests,
    matters: await addMatterAssignments(supabase, matters),
    auditEvents,
    canViewAudit: adminOrganizationIds.size > 0,
  };
}
