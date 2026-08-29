"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../../lib/supabase/server";
import {
  getAssignmentErrorMessage,
  validateMatterAssignment,
} from "./staff-assignment-domain.mjs";
import {
  getWorkflowErrorMessage,
  validateMatterWorkflow,
} from "./staff-workflow-domain.mjs";
import {
  getMatterDetailsErrorMessage,
  validateMatterDetails,
} from "./staff-matter-details-domain.mjs";

const SESSION_ERROR = "Сессия истекла. Войдите повторно.";

function actionError(message) {
  return { ok: false, message };
}

export async function createMatterAssignment(input) {
  const validation = validateMatterAssignment(input);
  if (!validation.valid) {
    return actionError(validation.error);
  }

  try {
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;

    if (claimsError || !userId) {
      return actionError(SESSION_ERROR);
    }

    const assignment = validation.value;
    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("organization_id", assignment.organizationId)
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (membershipError || !membership) {
      return actionError("У вас нет прав для назначения дел в этой организации.");
    }

    const { data, error } = await supabase
      .rpc("create_matter_for_client_email", {
        target_organization_id: assignment.organizationId,
        target_client_email: assignment.clientEmail,
        new_reference: assignment.reference,
        new_title: assignment.title,
        new_summary: assignment.summary,
        target_lawyer_id: assignment.lawyerId,
        initial_stage_title: assignment.stageTitle,
        initial_stage_detail: assignment.stageDetail,
        new_next_action_title: assignment.nextActionTitle,
        new_next_action_description: assignment.nextActionDescription,
      })
      .single();

    if (error || !data?.matter_id) {
      console.error("Staff matter assignment failed", {
        code: error?.code,
        status: error?.status,
      });
      return actionError(getAssignmentErrorMessage(error));
    }

    revalidatePath("/staff");
    revalidatePath("/cabinet");

    return {
      ok: true,
      message: `Дело создано и назначено: ${data.client_display_name || "клиент"}.`,
      matterId: data.matter_id,
    };
  } catch (error) {
    console.error("Staff matter assignment crashed", {
      code: error?.code,
      status: error?.status,
    });
    return actionError("Не удалось создать дело. Попробуйте ещё раз.");
  }
}

export async function updateMatterWorkflow(input) {
  const validation = validateMatterWorkflow(input);
  if (!validation.valid) {
    return actionError(validation.error);
  }

  try {
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;

    if (claimsError || !userId) {
      return actionError(SESSION_ERROR);
    }

    const workflow = validation.value;
    const { data, error } = await supabase
      .rpc("update_matter_workflow", {
        target_matter_id: workflow.matterId,
        new_status: workflow.status,
        target_stage_id: workflow.stageId,
        new_next_action_title: workflow.nextActionTitle,
        new_next_action_description: workflow.nextActionDescription,
        new_next_action_due_at: workflow.nextActionDueAt,
        update_assignment: workflow.assignmentTouched,
        target_lawyer_id: workflow.assignedLawyerId,
      })
      .single();

    if (error || !data?.matter_id) {
      console.error("Staff matter workflow update failed", {
        code: error?.code,
        status: error?.status,
      });
      return actionError(getWorkflowErrorMessage(error));
    }

    revalidatePath("/staff");
    revalidatePath("/cabinet");

    return {
      ok: true,
      matterId: data.matter_id,
      message: "Дело обновлено.",
    };
  } catch (error) {
    console.error("Staff matter workflow update crashed", {
      code: error?.code,
      status: error?.status,
    });
    return actionError("Не удалось обновить дело. Попробуйте ещё раз.");
  }
}

export async function updateMatterDetails(input) {
  const validation = validateMatterDetails(input);
  if (!validation.valid) {
    return actionError(validation.error);
  }

  try {
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;

    if (claimsError || !userId) {
      return actionError(SESSION_ERROR);
    }

    const details = validation.value;
    const { data, error } = await supabase
      .rpc("update_matter_details", {
        target_matter_id: details.matterId,
        new_reference: details.reference,
        new_title: details.title,
        new_summary: details.summary,
        new_response_due_at: details.responseDueAt,
      })
      .single();

    if (error || !data?.matter_id) {
      console.error("Staff matter details update failed", {
        code: error?.code,
        status: error?.status,
      });
      return actionError(getMatterDetailsErrorMessage(error));
    }

    revalidatePath("/staff");
    revalidatePath("/cabinet");

    return {
      ok: true,
      matterId: data.matter_id,
      message: "Реквизиты дела обновлены.",
    };
  } catch (error) {
    console.error("Staff matter details update crashed", {
      code: error?.code,
      status: error?.status,
    });
    return actionError("Не удалось обновить реквизиты дела. Попробуйте ещё раз.");
  }
}
