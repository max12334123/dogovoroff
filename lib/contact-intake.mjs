const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SECRET_KEY_PATTERN = /^(?:sb_secret_[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/u;
const RPC_TIMEOUT_MS = 8_000;

function disabledResult() {
  return {
    enabled: false,
    attempted: false,
    ok: false,
    created: false,
    status: null,
    reason: "disabled",
  };
}

function failureResult({ attempted, status = null, reason }) {
  return {
    enabled: true,
    attempted,
    ok: false,
    created: false,
    status,
    reason,
  };
}

function getProjectUrl(value) {
  try {
    const url = new URL(String(value ?? "").trim());
    if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co") || url.username || url.password) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function buildRpcPayload(record, organizationId) {
  return {
    target_organization_id: organizationId,
    new_submission_id: record.submissionId,
    new_submitted_at: record.submittedAt,
    new_name: record.name,
    new_phone: record.phone,
    new_service: record.service,
    new_message: record.message,
    new_form_mode: record.formMode,
    new_precheck_mode: record.precheckMode,
    new_precheck_practice: record.precheckPractice,
    new_precheck_excerpt: record.precheckExcerpt,
    new_consent_timestamp: record.consentTimestamp,
    new_consent_document: record.consentDocument,
    new_consent_version: record.consentVersion,
    new_source: record.source,
  };
}

export async function persistContactIntake(
  record,
  { env = process.env, fetchImpl = globalThis.fetch } = {},
) {
  if (env.CONTACT_INBOX_ENABLED !== "true") {
    return disabledResult();
  }

  const projectUrl = getProjectUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  const secretKey = String(env.SUPABASE_SECRET_KEY ?? "").trim();
  const organizationId = String(env.CONTACT_ORGANIZATION_ID ?? "").trim().toLowerCase();
  if (!projectUrl || !SECRET_KEY_PATTERN.test(secretKey) || !UUID_PATTERN.test(organizationId)) {
    return failureResult({ attempted: false, reason: "not_configured" });
  }

  const endpoint = new URL("/rest/v1/rpc/store_intake_request", projectUrl);
  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildRpcPayload(record, organizationId)),
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    });

    if (!response.ok) {
      return failureResult({ attempted: true, status: response.status, reason: "http_error" });
    }

    const body = await response.json().catch(() => null);
    const result = Array.isArray(body) ? body[0] : null;
    if (!UUID_PATTERN.test(result?.request_id) || typeof result?.created !== "boolean") {
      return failureResult({ attempted: true, status: response.status, reason: "invalid_response" });
    }

    return {
      enabled: true,
      attempted: true,
      ok: true,
      created: result.created,
      status: response.status,
      reason: result.created ? "stored" : "duplicate",
      requestId: result.request_id,
    };
  } catch {
    return failureResult({ attempted: true, reason: "network_error" });
  }
}
