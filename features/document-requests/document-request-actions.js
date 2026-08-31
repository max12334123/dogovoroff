"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../../lib/supabase/server";
import {
  createDocumentRequestActionHandlers,
  createProtectedViewRefresher,
} from "./document-request-action-core.mjs";

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  return {
    supabase,
    userId: error ? null : data?.claims?.sub || null,
  };
}

const handlers = createDocumentRequestActionHandlers({
  getAuthenticatedClient,
  refreshProtectedViews: createProtectedViewRefresher(revalidatePath),
  reportError(details) {
    console.error("Document request action failed", details);
  },
});

export async function createDocumentRequest(input) {
  return handlers.createDocumentRequest(input);
}

export async function updateDocumentRequest(input) {
  return handlers.updateDocumentRequest(input);
}

export async function submitDocumentRequest(input) {
  return handlers.submitDocumentRequest(input);
}

export async function reviewDocumentRequest(input) {
  return handlers.reviewDocumentRequest(input);
}

export async function cancelDocumentRequest(input) {
  return handlers.cancelDocumentRequest(input);
}

export async function withdrawDocumentRequestFile(input) {
  return handlers.withdrawDocumentRequestFile(input);
}
