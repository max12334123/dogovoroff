import { createClient } from "@supabase/supabase-js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_E2E_CLIENT_A_TOKEN",
  "SUPABASE_E2E_CLIENT_B_TOKEN",
  "SUPABASE_E2E_LAWYER_TOKEN",
  "SUPABASE_E2E_ADMIN_TOKEN",
  "SUPABASE_E2E_MATTER_A_ID",
  "SUPABASE_E2E_MATTER_B_ID",
  "SUPABASE_E2E_LAWYER_MATTER_IDS",
  "SUPABASE_E2E_ADMIN_MATTER_IDS",
];

const ACTOR_ENV = {
  clientA: "SUPABASE_E2E_CLIENT_A_TOKEN",
  clientB: "SUPABASE_E2E_CLIENT_B_TOKEN",
  lawyer: "SUPABASE_E2E_LAWYER_TOKEN",
  admin: "SUPABASE_E2E_ADMIN_TOKEN",
};

const RESOURCES = [
  { table: "matters", idColumn: "id", select: "id" },
  { table: "matter_stages", idColumn: "matter_id", select: "matter_id" },
  { table: "matter_events", idColumn: "matter_id", select: "matter_id" },
  { table: "documents", idColumn: "matter_id", select: "matter_id" },
  { table: "messages", idColumn: "matter_id", select: "matter_id" },
];

function readEnv(env, name) {
  return typeof env?.[name] === "string" ? env[name].trim() : "";
}

export function parseIdList(value) {
  if (typeof value !== "string") {
    return [];
  }

  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function getRlsSmokeConfig(env = process.env) {
  if (readEnv(env, "SUPABASE_E2E_ENABLED").toLowerCase() !== "true") {
    return { enabled: false };
  }

  const missing = REQUIRED_ENV.filter((name) => !readEnv(env, name));
  if (!isHttpsUrl(readEnv(env, "NEXT_PUBLIC_SUPABASE_URL"))) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL (https URL required)");
  }

  if (missing.length) {
    return { enabled: true, missing: [...new Set(missing)] };
  }

  return {
    enabled: true,
    url: readEnv(env, "NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey: readEnv(env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    actors: Object.fromEntries(
      Object.entries(ACTOR_ENV).map(([actor, variable]) => [actor, readEnv(env, variable)]),
    ),
    matterAId: readEnv(env, "SUPABASE_E2E_MATTER_A_ID"),
    matterBId: readEnv(env, "SUPABASE_E2E_MATTER_B_ID"),
    lawyerMatterIds: parseIdList(readEnv(env, "SUPABASE_E2E_LAWYER_MATTER_IDS")),
    adminMatterIds: parseIdList(readEnv(env, "SUPABASE_E2E_ADMIN_MATTER_IDS")),
  };
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

export function assertVisibleIds(actor, resource, actualIds, expectedIds) {
  const actual = sortedUnique(actualIds);
  const expected = sortedUnique(expectedIds);

  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new Error(`RLS smoke check failed for ${actor} ${resource}`);
  }

  return true;
}

function createReadClient(url, publishableKey, accessToken = "") {
  const global = accessToken
    ? { headers: { Authorization: `Bearer ${accessToken}` } }
    : undefined;

  return createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global,
  });
}

function throwQueryError(actor, resource, error) {
  throw new Error(`RLS smoke query failed for ${actor} ${resource}: ${error?.code ?? "unknown"}`);
}

async function readRows(client, actor, resource, matterIds) {
  const { data, error } = await client
    .from(resource.table)
    .select(resource.select)
    .in(resource.idColumn, matterIds);

  if (error) {
    throwQueryError(actor, resource.table, error);
  }

  return data ?? [];
}

async function readMemberships(client, actor) {
  const { data, error } = await client
    .from("organization_members")
    .select("organization_id,role");

  if (error) {
    throwQueryError(actor, "organization_members", error);
  }

  return data ?? [];
}

function assertExpectedRole(actor, memberships, role) {
  if (!memberships.some((membership) => membership.role === role)) {
    throw new Error(`RLS smoke role check failed for ${actor}`);
  }
}

function isExpectedAccessDenied(error) {
  return error?.code === "42501" || error?.status === 401 || error?.status === 403;
}

async function assertAnonymousCannotRead(client, matterIds) {
  const { data, error } = await client
    .from("matters")
    .select("id")
    .in("id", matterIds);

  if (error && !isExpectedAccessDenied(error)) {
    throwQueryError("anonymous", "matters", error);
  }

  if (data?.length) {
    throw new Error("RLS smoke check failed for anonymous matters");
  }
}

async function assertStorageFolderHidden(client, actor, matterId) {
  const { data, error } = await client.storage.from("matter-documents").list(matterId, { limit: 1 });

  if (error && !isExpectedAccessDenied(error)) {
    throwQueryError(actor, "matter-documents", error);
  }

  if (data?.length) {
    throw new Error(`RLS smoke check failed for ${actor} matter-documents`);
  }
}

async function checkActor(config, actor, expectedMatterIds, role = "") {
  const client = createReadClient(config.url, config.publishableKey, config.actors[actor]);
  const matterIds = [...new Set([config.matterAId, config.matterBId, ...config.lawyerMatterIds, ...config.adminMatterIds])];

  for (const resource of RESOURCES) {
    const rows = await readRows(client, actor, resource, matterIds);
    assertVisibleIds(
      actor,
      resource.table,
      rows.map((row) => row[resource.idColumn]),
      expectedMatterIds,
    );
  }

  const memberships = await readMemberships(client, actor);
  if (role) {
    assertExpectedRole(actor, memberships, role);
  } else if (memberships.length) {
    throw new Error(`RLS smoke role check failed for ${actor}`);
  }

  return client;
}

export async function runRlsSmoke(env = process.env) {
  const config = getRlsSmokeConfig(env);
  if (!config.enabled) {
    return { skipped: true, reason: "SUPABASE_E2E_ENABLED is not true" };
  }

  if (config.missing) {
    throw new Error(`Supabase RLS smoke is enabled but configuration is incomplete: ${config.missing.join(", ")}`);
  }

  const allMatterIds = [...new Set([
    config.matterAId,
    config.matterBId,
    ...config.lawyerMatterIds,
    ...config.adminMatterIds,
  ])];
  if (config.matterAId === config.matterBId || !config.lawyerMatterIds.length || !config.adminMatterIds.length) {
    throw new Error("Supabase RLS smoke fixture must contain two distinct matters and non-empty staff scopes");
  }

  const clientA = await checkActor(config, "clientA", [config.matterAId]);
  await checkActor(config, "clientB", [config.matterBId]);
  await checkActor(config, "lawyer", config.lawyerMatterIds, "lawyer");
  await checkActor(config, "admin", config.adminMatterIds, "admin");

  await assertStorageFolderHidden(clientA, "clientA", config.matterBId);
  const anonymous = createReadClient(config.url, config.publishableKey);
  await assertAnonymousCannotRead(anonymous, allMatterIds);

  return {
    skipped: false,
    actors: 4,
    resources: RESOURCES.length,
    storageIsolationChecks: 1,
  };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
const modulePath = resolve(fileURLToPath(import.meta.url));

if (invokedPath === modulePath) {
  runRlsSmoke()
    .then((result) => {
      if (result.skipped) {
        console.log(`Supabase RLS smoke skipped: ${result.reason}.`);
        return;
      }

      console.log(`Supabase RLS smoke passed: ${result.actors} actors, ${result.resources} resources, ${result.storageIsolationChecks} Storage isolation check.`);
    })
    .catch((error) => {
      console.error(`Supabase RLS smoke failed: ${error.message}`);
      process.exitCode = 1;
    });
}
