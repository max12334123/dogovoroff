import { loadCabinetData } from "../cabinet/cabinet-server";
import {
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

  return {
    roleLabel: getStaffRoleLabel(memberships),
    organizations: organizations ?? [],
    matters: await loadCabinetData(supabase, userId, { messageParticipantLabel: "Участник дела" }),
  };
}
