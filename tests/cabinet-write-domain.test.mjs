import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDocumentStoragePath,
  getDocumentStorageLocation,
  validateDocumentRegistration,
  validateStoredDocumentObject,
  validateDocumentUpload,
  validateMatterMessage,
} from "../features/cabinet/cabinet-write-domain.mjs";

const MATTER_ID = "11111111-1111-4111-8111-111111111111";
const DOCUMENT_ID = "22222222-2222-4222-8222-222222222222";

test("document upload accepts a matching supported extension and MIME type", () => {
  assert.deepEqual(
    validateDocumentUpload({
      name: "  Договор поставки.PDF  ",
      size: 2048,
      type: "application/pdf",
    }),
    {
      valid: true,
      extension: "pdf",
      mimeType: "application/pdf",
      originalName: "Договор поставки.PDF",
      sizeBytes: 2048,
      error: "",
    },
  );
});

test("document upload rejects an extension and MIME mismatch", () => {
  const result = validateDocumentUpload({
    name: "договор.pdf",
    size: 2048,
    type: "image/png",
  });

  assert.equal(result.valid, false);
  assert.match(result.error, /MIME|тип/i);
});

test("document upload rejects empty, oversized, and path-like names", () => {
  assert.equal(
    validateDocumentUpload({ name: "empty.pdf", size: 0, type: "application/pdf" }).valid,
    false,
  );
  assert.equal(
    validateDocumentUpload({ name: "large.pdf", size: 10 * 1024 * 1024 + 1, type: "application/pdf" }).valid,
    false,
  );
  assert.equal(
    validateDocumentUpload({ name: "../secret.pdf", size: 100, type: "application/pdf" }).valid,
    false,
  );
});

test("storage paths use only stable IDs and a canonical filename", () => {
  assert.equal(
    buildDocumentStoragePath({ matterId: MATTER_ID, documentId: DOCUMENT_ID, extension: "PDF" }),
    `${MATTER_ID}/${DOCUMENT_ID}/document.pdf`,
  );
  assert.throws(
    () => buildDocumentStoragePath({ matterId: "not-a-uuid", documentId: DOCUMENT_ID, extension: "pdf" }),
    /дела/i,
  );
});

test("document metadata must exactly match the generated storage path", () => {
  const valid = validateDocumentRegistration({
    id: DOCUMENT_ID,
    matterId: MATTER_ID,
    storagePath: `${MATTER_ID}/${DOCUMENT_ID}/document.docx`,
    originalName: "Договор.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sizeBytes: 4096,
  });
  const tampered = validateDocumentRegistration({
    ...valid.value,
    storagePath: `${MATTER_ID}/another-folder/document.docx`,
  });

  assert.equal(valid.valid, true);
  assert.equal(tampered.valid, false);
});

test("document registration accepts only an optional UUID request link", () => {
  const linked = validateDocumentRegistration({
    id: DOCUMENT_ID,
    matterId: MATTER_ID,
    requestId: "44444444-4444-4444-8444-444444444444",
    storagePath: `${MATTER_ID}/${DOCUMENT_ID}/document.pdf`,
    originalName: "Договор.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1024,
  });

  assert.equal(linked.valid, true);
  assert.equal(linked.value.requestId, "44444444-4444-4444-8444-444444444444");
  assert.equal(validateDocumentRegistration({ ...linked.value, requestId: "bad" }).valid, false);
  assert.equal(validateDocumentRegistration({ ...linked.value, requestId: "" }).value.requestId, null);
});

test("stored object metadata must match the validated registration", () => {
  const registration = validateDocumentRegistration({
    id: DOCUMENT_ID,
    matterId: MATTER_ID,
    storagePath: `${MATTER_ID}/${DOCUMENT_ID}/document.pdf`,
    originalName: "Договор.pdf",
    mimeType: "application/pdf",
    sizeBytes: 4096,
  }).value;

  assert.deepEqual(getDocumentStorageLocation(registration.storagePath), {
    folder: `${MATTER_ID}/${DOCUMENT_ID}`,
    name: "document.pdf",
  });
  assert.equal(
    validateStoredDocumentObject(registration, {
      name: "document.pdf",
      metadata: { size: 4096, mimetype: "application/pdf" },
    }).valid,
    true,
  );
  assert.equal(
    validateStoredDocumentObject(registration, {
      name: "document.pdf",
      metadata: { size: 1, mimetype: "application/pdf" },
    }).valid,
    false,
  );
  assert.equal(
    validateStoredDocumentObject(registration, {
      name: "document.png",
      metadata: { size: 4096, mimetype: "image/png" },
    }).valid,
    false,
  );
});

test("matter messages are trimmed and bound to a UUID matter", () => {
  assert.deepEqual(validateMatterMessage({ matterId: MATTER_ID, body: "  Нужна консультация.  " }), {
    valid: true,
    value: { matterId: MATTER_ID, body: "Нужна консультация." },
    error: "",
  });
  assert.equal(validateMatterMessage({ matterId: "wrong", body: "Текст" }).valid, false);
  assert.equal(validateMatterMessage({ matterId: MATTER_ID, body: "   " }).valid, false);
  assert.equal(validateMatterMessage({ matterId: MATTER_ID, body: "а".repeat(2001) }).valid, false);
});

test("matter messages preserve an optional stable UUID for safe retries", () => {
  const result = validateMatterMessage({
    id: DOCUMENT_ID,
    matterId: MATTER_ID,
    body: "Повторно отправляю вопрос.",
  });

  assert.deepEqual(result, {
    valid: true,
    value: {
      id: DOCUMENT_ID,
      matterId: MATTER_ID,
      body: "Повторно отправляю вопрос.",
    },
    error: "",
  });
  assert.equal(validateMatterMessage({ id: "not-a-uuid", matterId: MATTER_ID, body: "Текст" }).valid, false);
});
