"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../../lib/supabase/server";
import {
  DOCUMENT_BUCKET,
  getDocumentStorageLocation,
  validateDocumentRegistration,
  validateMatterMessage,
  validateStoredDocumentObject,
} from "./cabinet-write-domain.mjs";

const WRITE_ERROR_MESSAGE = "Не удалось сохранить данные. Попробуйте ещё раз.";

function actionError(message) {
  return { ok: false, message };
}

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || !userId) {
    return { supabase, userId: null };
  }

  return { supabase, userId };
}

export async function registerMatterDocument(input) {
  const validation = validateDocumentRegistration(input);
  if (!validation.valid) {
    return actionError(validation.error);
  }

  try {
    const { supabase, userId } = await getAuthenticatedClient();
    if (!userId) {
      return actionError("Сессия истекла. Войдите в кабинет повторно.");
    }

    const document = validation.value;
    const location = getDocumentStorageLocation(document.storagePath);
    const { data: storedObjects, error: storageError } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .list(location.folder, {
        limit: 2,
        search: location.name,
      });
    const storedObject = storedObjects?.find((object) => object.name === location.name);
    const storedValidation = validateStoredDocumentObject(document, storedObject);

    if (storageError || !storedValidation.valid) {
      console.error("Cabinet document storage verification failed", {
        statusCode: storageError?.statusCode,
      });
      return actionError(WRITE_ERROR_MESSAGE);
    }

    const { error } = await supabase.from("documents").insert({
      id: document.id,
      matter_id: document.matterId,
      storage_path: document.storagePath,
      original_name: document.originalName,
      mime_type: document.mimeType,
      size_bytes: document.sizeBytes,
      uploaded_by: userId,
    });

    if (error) {
      console.error("Cabinet document registration failed", {
        code: error.code,
        status: error.status,
      });
      return actionError(WRITE_ERROR_MESSAGE);
    }

    revalidatePath("/cabinet");
    return { ok: true, message: "Документ загружен и добавлен к делу." };
  } catch (error) {
    console.error("Cabinet document registration crashed", {
      code: error?.code,
      status: error?.status,
    });
    return actionError(WRITE_ERROR_MESSAGE);
  }
}

export async function sendMatterMessage(input) {
  const validation = validateMatterMessage(input);
  if (!validation.valid) {
    return actionError(validation.error);
  }

  try {
    const { supabase, userId } = await getAuthenticatedClient();
    if (!userId) {
      return actionError("Сессия истекла. Войдите в кабинет повторно.");
    }

    const message = validation.value;
    const messagePayload = {
      ...(message.id ? { id: message.id } : {}),
      matter_id: message.matterId,
      author_id: userId,
      body: message.body,
    };
    const { error } = await supabase.from("messages").insert(messagePayload);

    if (error?.code === "23505" && message.id) {
      const { data: existingMessage, error: existingMessageError } = await supabase
        .from("messages")
        .select("id,matter_id,author_id,body")
        .eq("id", message.id)
        .maybeSingle();

      if (!existingMessageError
        && existingMessage
        && existingMessage.matter_id === message.matterId
        && existingMessage.author_id === userId
        && existingMessage.body === message.body) {
        revalidatePath("/cabinet");
        return { ok: true, message: "Сообщение отправлено." };
      }
    }

    if (error) {
      console.error("Cabinet message send failed", {
        code: error.code,
        status: error.status,
      });
      return actionError(WRITE_ERROR_MESSAGE);
    }

    revalidatePath("/cabinet");
    return { ok: true, message: "Сообщение отправлено." };
  } catch (error) {
    console.error("Cabinet message send crashed", {
      code: error?.code,
      status: error?.status,
    });
    return actionError(WRITE_ERROR_MESSAGE);
  }
}
