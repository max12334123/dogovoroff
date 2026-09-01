import {
  getDocumentRequestErrorMessage,
  validateCancelDocumentRequest,
  validateCreateDocumentRequest,
  validateReviewDocumentRequest,
  validateSubmitDocumentRequest,
  validateUpdateDocumentRequest,
  validateWithdrawDocumentRequestFile,
} from "./document-request-domain.mjs";

const SESSION_ERROR = "Сессия истекла. Войдите повторно.";

function actionError(message) {
  return { ok: false, message };
}

function providerDetails(error) {
  return {
    code: error?.code,
    status: error?.status,
  };
}

function successData(data) {
  return {
    requestId: data.request_id,
    status: data.request_status,
    updatedAt: data.request_updated_at,
    ...(data.document_id ? {
      documentId: data.document_id,
      documentStatus: data.document_status,
    } : {}),
  };
}

export function createProtectedViewRefresher(revalidate) {
  return function refreshProtectedViews() {
    revalidate("/cabinet");
    revalidate("/staff");
  };
}

export function createDocumentRequestActionHandlers({
  getAuthenticatedClient,
  refreshProtectedViews,
  reportError,
}) {
  function createHandler({ validate, rpcName, buildArgs, getSuccessMessage }) {
    return async function runDocumentRequestAction(input) {
      const validation = validate(input);
      if (!validation.valid) {
        return actionError(validation.error);
      }

      try {
        const { supabase, userId } = await getAuthenticatedClient();
        if (!supabase || !userId) {
          return actionError(SESSION_ERROR);
        }

        const { data, error } = await supabase
          .rpc(rpcName, buildArgs(validation.value))
          .single();
        if (error || !data?.request_id) {
          reportError(providerDetails(error));
          return actionError(getDocumentRequestErrorMessage(error));
        }

        refreshProtectedViews();
        return {
          ok: true,
          message: getSuccessMessage(validation.value),
          data: successData(data),
        };
      } catch (error) {
        reportError(providerDetails(error));
        return actionError(getDocumentRequestErrorMessage(error));
      }
    };
  }

  return {
    createDocumentRequest: createHandler({
      validate: validateCreateDocumentRequest,
      rpcName: "create_document_request",
      buildArgs: (value) => ({
        target_matter_id: value.matterId,
        new_title: value.title,
        new_instructions: value.instructions,
        new_due_on: value.dueOn,
      }),
      getSuccessMessage: () => "Запрос документов создан.",
    }),
    updateDocumentRequest: createHandler({
      validate: validateUpdateDocumentRequest,
      rpcName: "update_document_request",
      buildArgs: (value) => ({
        target_request_id: value.requestId,
        new_title: value.title,
        new_instructions: value.instructions,
        new_due_on: value.dueOn,
      }),
      getSuccessMessage: () => "Запрос документов обновлён.",
    }),
    submitDocumentRequest: createHandler({
      validate: validateSubmitDocumentRequest,
      rpcName: "submit_document_request",
      buildArgs: (value) => ({ target_request_id: value.requestId }),
      getSuccessMessage: () => "Комплект отправлен на проверку.",
    }),
    reviewDocumentRequest: createHandler({
      validate: validateReviewDocumentRequest,
      rpcName: "review_document_request",
      buildArgs: (value) => ({
        target_request_id: value.requestId,
        new_decision: value.decision,
        new_note: value.note,
      }),
      getSuccessMessage: (value) => value.decision === "accepted"
        ? "Комплект принят."
        : "Комплект возвращён на исправление.",
    }),
    cancelDocumentRequest: createHandler({
      validate: validateCancelDocumentRequest,
      rpcName: "cancel_document_request",
      buildArgs: (value) => ({ target_request_id: value.requestId }),
      getSuccessMessage: () => "Запрос документов отменён.",
    }),
    withdrawDocumentRequestFile: createHandler({
      validate: validateWithdrawDocumentRequestFile,
      rpcName: "withdraw_document_request_file",
      buildArgs: (value) => ({
        target_request_id: value.requestId,
        target_document_id: value.documentId,
      }),
      getSuccessMessage: () => "Файл отозван из комплекта.",
    }),
  };
}
