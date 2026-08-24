var EXPECTED_RECORD_KEYS = [
  "version",
  "submissionId",
  "submittedAt",
  "status",
  "name",
  "phone",
  "service",
  "message",
  "formMode",
  "precheckMode",
  "precheckPractice",
  "precheckExcerpt",
  "consent",
  "consentTimestamp",
  "consentDocument",
  "consentVersion",
  "source",
  "notes",
];

var REPLAY_WINDOW_MS = 15 * 60 * 1000;
var SHEET_TIME_ZONE = "Asia/Yekaterinburg";

function doPost(event) {
  var lock = LockService.getScriptLock();

  try {
    if (!lock.tryLock(5000)) return jsonResponse_({ ok: false });

    var properties = PropertiesService.getScriptProperties();
    var spreadsheetId = properties.getProperty("SPREADSHEET_ID") || "";
    var sheetName = properties.getProperty("SHEET_NAME") || "";
    var secret = properties.getProperty("WEBHOOK_SECRET") || "";
    if (!spreadsheetId || !sheetName || secret.length < 32) {
      return jsonResponse_({ ok: false });
    }

    var payload = JSON.parse(event && event.postData ? event.postData.contents : "{}");
    var record = payload.record;
    if (!isValidRecord_(record) || !isValidSignature_(record, payload.signature, secret)) {
      return jsonResponse_({ ok: false });
    }

    var submittedAt = new Date(record.submittedAt);
    if (Math.abs(Date.now() - submittedAt.getTime()) > REPLAY_WINDOW_MS) {
      return jsonResponse_({ ok: false });
    }

    var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
    if (!sheet) return jsonResponse_({ ok: false });
    if (hasSubmission_(sheet, record.submissionId)) {
      return jsonResponse_({ ok: true, duplicate: true });
    }

    var row = recordToRow_(record);
    if (sheet.getLastRow() >= 2 && String(sheet.getRange(2, 1).getDisplayValue()).trim() === "ШАБЛОН") {
      sheet.getRange(2, 1, 1, row.length).setValues([row]);
    } else {
      sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
    }

    return jsonResponse_({ ok: true });
  } catch (error) {
    return jsonResponse_({ ok: false });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function isValidRecord_(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return false;

  var keys = Object.keys(record);
  if (keys.length !== EXPECTED_RECORD_KEYS.length) return false;
  for (var index = 0; index < EXPECTED_RECORD_KEYS.length; index += 1) {
    if (keys[index] !== EXPECTED_RECORD_KEYS[index]) return false;
  }

  if (record.version !== "1") return false;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(record.submissionId)) return false;
  if (!isFinite(new Date(record.submittedAt).getTime())) return false;
  if (record.status !== "Новая" || record.consent !== "Да" || record.source !== "Сайт ДоговорОфф") {
    return false;
  }

  var limits = {
    name: 80,
    phone: 32,
    service: 120,
    message: 2000,
    formMode: 40,
    precheckMode: 40,
    precheckPractice: 120,
    precheckExcerpt: 1200,
    consentTimestamp: 40,
    consentDocument: 300,
    consentVersion: 120,
    notes: 500,
  };
  var fields = Object.keys(limits);
  for (var fieldIndex = 0; fieldIndex < fields.length; fieldIndex += 1) {
    var field = fields[fieldIndex];
    if (typeof record[field] !== "string" || record[field].length > limits[field]) return false;
  }

  return true;
}

function isValidSignature_(record, signature, secret) {
  if (!/^[a-f0-9]{64}$/.test(String(signature || ""))) return false;
  var bytes = Utilities.computeHmacSha256Signature(JSON.stringify(record), secret);
  var expected = bytes.map(function (value) {
    return (value & 255).toString(16).padStart(2, "0");
  }).join("");
  return constantTimeEqual_(expected, signature);
}

function constantTimeEqual_(left, right) {
  if (left.length !== right.length) return false;
  var difference = 0;
  for (var index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function hasSubmission_(sheet, submissionId) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  return sheet
    .getRange(2, 1, lastRow - 1, 1)
    .createTextFinder(submissionId)
    .matchEntireCell(true)
    .findNext() !== null;
}

function recordToRow_(record) {
  return [
    safeCell_(record.submissionId),
    formatTimestamp_(record.submittedAt),
    safeCell_(record.status),
    safeCell_(record.name),
    safeCell_(record.phone),
    safeCell_(record.service),
    safeCell_(record.message),
    safeCell_(record.formMode),
    safeCell_(record.precheckMode),
    safeCell_(record.precheckPractice),
    safeCell_(record.precheckExcerpt),
    safeCell_(record.consent),
    formatTimestamp_(record.consentTimestamp),
    safeCell_(record.consentDocument),
    safeCell_(record.consentVersion),
    safeCell_(record.source),
    safeCell_(record.notes),
  ];
}

function formatTimestamp_(value) {
  return Utilities.formatDate(new Date(value), SHEET_TIME_ZONE, "dd.MM.yyyy HH:mm:ss");
}

function safeCell_(value) {
  var text = String(value == null ? "" : value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function jsonResponse_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
