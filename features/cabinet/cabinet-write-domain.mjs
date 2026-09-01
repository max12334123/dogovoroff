export const DOCUMENT_BUCKET = "matter-documents";
export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_MATTER_MESSAGE_LENGTH = 2000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UNSAFE_FILENAME_PATTERN = /[\\/\u0000-\u001f\u007f]/;
const UNSAFE_MESSAGE_CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

const DOCUMENT_TYPES = Object.freeze({
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
});

function invalid(error) {
  return { valid: false, error };
}

export function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function getExtension(name) {
  const separatorIndex = name.lastIndexOf(".");
  return separatorIndex > 0 ? name.slice(separatorIndex + 1).toLowerCase() : "";
}

function normalizeOriginalName(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ");
}

export function validateDocumentUpload(file) {
  if (!file || typeof file !== "object") {
    return invalid("Выберите файл.");
  }

  const originalName = normalizeOriginalName(file.name);
  if (!originalName || originalName.length > 255 || UNSAFE_FILENAME_PATTERN.test(originalName)) {
    return invalid("Имя файла содержит недопустимые символы.");
  }

  const extension = getExtension(originalName);
  const expectedMimeType = DOCUMENT_TYPES[extension];
  if (!expectedMimeType) {
    return invalid("Поддерживаются PDF, DOC, DOCX, JPG и PNG.");
  }

  const mimeType = typeof file.type === "string" ? file.type.trim().toLowerCase() : "";
  if (!mimeType || mimeType !== expectedMimeType) {
    return invalid("Расширение и MIME-тип файла не совпадают.");
  }

  if (!Number.isSafeInteger(file.size) || file.size <= 0) {
    return invalid("Файл пуст или повреждён.");
  }

  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return invalid("Размер файла не должен превышать 10 МБ.");
  }

  return {
    valid: true,
    extension,
    mimeType: expectedMimeType,
    originalName,
    sizeBytes: file.size,
    error: "",
  };
}

export function buildDocumentStoragePath({ matterId, documentId, extension }) {
  if (!isUuid(matterId)) {
    throw new Error("Некорректный идентификатор дела.");
  }

  if (!isUuid(documentId)) {
    throw new Error("Некорректный идентификатор документа.");
  }

  const normalizedExtension = typeof extension === "string" ? extension.toLowerCase() : "";
  if (!DOCUMENT_TYPES[normalizedExtension]) {
    throw new Error("Некорректный формат документа.");
  }

  return `${matterId}/${documentId}/document.${normalizedExtension}`;
}

export function getDocumentStorageLocation(storagePath) {
  if (typeof storagePath !== "string") {
    throw new Error("Некорректный путь документа.");
  }

  const segments = storagePath.split("/");
  if (segments.length !== 3 || segments.some((segment) => !segment)) {
    throw new Error("Некорректный путь документа.");
  }

  return {
    folder: `${segments[0]}/${segments[1]}`,
    name: segments[2],
  };
}

export function validateDocumentRegistration(input) {
  if (!input || typeof input !== "object") {
    return invalid("Не удалось зарегистрировать документ.");
  }

  const upload = validateDocumentUpload({
    name: input.originalName,
    size: input.sizeBytes,
    type: input.mimeType,
  });
  if (!upload.valid) {
    return upload;
  }

  let expectedStoragePath;
  try {
    expectedStoragePath = buildDocumentStoragePath({
      matterId: input.matterId,
      documentId: input.id,
      extension: upload.extension,
    });
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "Некорректные данные документа.");
  }

  if (input.storagePath !== expectedStoragePath) {
    return invalid("Путь документа не соответствует выбранному делу.");
  }

  const requestId = input.requestId === undefined || input.requestId === null || input.requestId === ""
    ? null
    : input.requestId;
  if (requestId !== null && !isUuid(requestId)) {
    return invalid("Некорректный запрос документов.");
  }

  return {
    valid: true,
    value: {
      id: input.id,
      matterId: input.matterId,
      requestId,
      storagePath: expectedStoragePath,
      originalName: upload.originalName,
      mimeType: upload.mimeType,
      sizeBytes: upload.sizeBytes,
    },
    error: "",
  };
}

export function validateStoredDocumentObject(document, storedObject) {
  if (!document || !storedObject || typeof storedObject !== "object") {
    return invalid("Загруженный объект не найден.");
  }

  let location;
  try {
    location = getDocumentStorageLocation(document.storagePath);
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "Некорректный путь документа.");
  }

  if (storedObject.name !== location.name) {
    return invalid("Загруженный объект не соответствует документу.");
  }

  const metadata = storedObject.metadata;
  const storedSize = Number(metadata?.size ?? metadata?.contentLength);
  const storedMimeType = typeof metadata?.mimetype === "string"
    ? metadata.mimetype.toLowerCase()
    : typeof metadata?.contentType === "string"
      ? metadata.contentType.toLowerCase()
      : "";

  if (!Number.isSafeInteger(storedSize) || storedSize !== document.sizeBytes) {
    return invalid("Размер загруженного объекта не совпадает с документом.");
  }

  if (storedMimeType !== document.mimeType) {
    return invalid("MIME-тип загруженного объекта не совпадает с документом.");
  }

  return { valid: true, error: "" };
}

export function validateMatterMessage(input) {
  if (!input || typeof input !== "object" || !isUuid(input.matterId)) {
    return invalid("Некорректное дело.");
  }

  if (input.id !== undefined && !isUuid(input.id)) {
    return invalid("Некорректный идентификатор сообщения.");
  }

  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (!body) {
    return invalid("Введите текст сообщения.");
  }

  if (body.length > MAX_MATTER_MESSAGE_LENGTH) {
    return invalid(`Сообщение не должно превышать ${MAX_MATTER_MESSAGE_LENGTH} символов.`);
  }

  if (UNSAFE_MESSAGE_CONTROL_PATTERN.test(body)) {
    return invalid("Сообщение содержит недопустимые символы.");
  }

  const value = {
    matterId: input.matterId,
    body,
  };
  if (input.id !== undefined) {
    value.id = input.id;
  }

  return {
    valid: true,
    value,
    error: "",
  };
}
