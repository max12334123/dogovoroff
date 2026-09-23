export async function registerDocumentMetadata({ supabase, document }) {
  if (document.requestId) {
    const result = await supabase
      .rpc("register_document_request_file", {
        target_request_id: document.requestId,
        new_document_id: document.id,
        new_storage_path: document.storagePath,
        new_original_name: document.originalName,
        new_mime_type: document.mimeType,
        new_size_bytes: document.sizeBytes,
      })
      .single();
    return { ...result, linked: true };
  }

  const result = await supabase
    .rpc("register_matter_document", {
      target_matter_id: document.matterId,
      new_document_id: document.id,
      new_storage_path: document.storagePath,
      new_original_name: document.originalName,
      new_mime_type: document.mimeType,
      new_size_bytes: document.sizeBytes,
    })
    .single();
  return { ...result, linked: false };
}
