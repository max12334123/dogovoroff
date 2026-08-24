import assert from "node:assert/strict";
import test from "node:test";
import { verifyVercelOidc } from "../cloudflare/precheck-worker/src/vercel-oidc.mjs";

const NOW_SECONDS = 1_777_200_000;
const CONFIG = {
  issuer: "https://oidc.vercel.com/dogovoroff",
  audience: "https://vercel.com/dogovoroff",
  ownerId: "team_Jot747qYaAxFSM5jUSY1lpz1",
  ownerSlug: "dogovoroff",
  projectId: "prj_BhZAA6uclF07BnSa7Hex6TYcMre8",
  projectName: "dogovoroff",
};
const VALID_CLAIMS = {
  iss: CONFIG.issuer,
  aud: CONFIG.audience,
  sub: "owner:dogovoroff:project:dogovoroff:environment:production",
  owner_id: CONFIG.ownerId,
  project_id: CONFIG.projectId,
  environment: "production",
  exp: NOW_SECONDS + 300,
  nbf: NOW_SECONDS - 10,
};

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

async function createSigner(kid = "test-key") {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);

  return {
    jwk: { ...publicJwk, kid, alg: "RS256", use: "sig" },
    async sign(claims = VALID_CLAIMS, header = { alg: "RS256", typ: "JWT", kid }) {
      const encodedHeader = base64url(JSON.stringify(header));
      const encodedPayload = base64url(JSON.stringify(claims));
      const signingInput = `${encodedHeader}.${encodedPayload}`;
      const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        pair.privateKey,
        new TextEncoder().encode(signingInput),
      );
      return `${signingInput}.${Buffer.from(signature).toString("base64url")}`;
    },
  };
}

function dependencies(jwk) {
  let fetchCalls = 0;
  return {
    now: () => NOW_SECONDS * 1_000,
    cache: new Map(),
    fetch: async (url) => {
      fetchCalls += 1;
      assert.equal(url, `${CONFIG.issuer}/.well-known/jwks`);
      return Response.json({ keys: [jwk] });
    },
    getFetchCalls: () => fetchCalls,
  };
}

test("OIDC verifier accepts a valid signed Vercel project token and caches public JWKS", async () => {
  const signer = await createSigner();
  const deps = dependencies(signer.jwk);
  const token = await signer.sign();

  const first = await verifyVercelOidc(token, CONFIG, deps);
  const second = await verifyVercelOidc(token, CONFIG, deps);

  assert.equal(first.project_id, CONFIG.projectId);
  assert.equal(second.environment, "production");
  assert.equal(deps.getFetchCalls(), 1);
});

test("OIDC verifier rejects a bad signature", async () => {
  const trusted = await createSigner("shared-kid");
  const attacker = await createSigner("shared-kid");
  const token = await attacker.sign();

  await assert.rejects(
    verifyVercelOidc(token, CONFIG, dependencies(trusted.jwk)),
    /signature/i,
  );
});

test("OIDC verifier enforces Vercel project claims and token timing", async () => {
  const signer = await createSigner();
  const invalidClaims = [
    { ...VALID_CLAIMS, aud: "https://vercel.com/another-team" },
    { ...VALID_CLAIMS, project_id: "prj_other" },
    {
      ...VALID_CLAIMS,
      environment: "staging",
      sub: "owner:dogovoroff:project:dogovoroff:environment:staging",
    },
    { ...VALID_CLAIMS, exp: NOW_SECONDS - 61 },
    { ...VALID_CLAIMS, nbf: NOW_SECONDS + 61 },
    { ...VALID_CLAIMS, sub: "owner:dogovoroff:project:other:environment:production" },
  ];

  for (const claims of invalidClaims) {
    const token = await signer.sign(claims);
    await assert.rejects(verifyVercelOidc(token, CONFIG, dependencies(signer.jwk)));
  }
});

test("OIDC verifier rejects missing kid and unsupported algorithm before JWKS fetch", async () => {
  const signer = await createSigner();
  for (const header of [
    { alg: "RS256", typ: "JWT" },
    { alg: "none", typ: "JWT", kid: "test-key" },
  ]) {
    const deps = dependencies(signer.jwk);
    const token = await signer.sign(VALID_CLAIMS, header);
    await assert.rejects(verifyVercelOidc(token, CONFIG, deps));
    assert.equal(deps.getFetchCalls(), 0);
  }
});
