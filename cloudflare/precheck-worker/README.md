# Dogovoroff preliminary-intake Worker

Cloudflare account: `68d68e7951768d781652b953ae0b9345`  
Worker name: `dogovoroff-precheck-ai`  
Health endpoint: `GET /health`  
Protected endpoint: `POST /v1/precheck`

The Worker uses the native Workers AI binding and does not require a permanent API key in Vercel. Its expected public address is `https://dogovoroff-precheck-ai.<account-subdomain>.workers.dev`; the account subdomain is intentionally not created by source changes.

## Authentication boundary

Every inference request must carry `Authorization: Bearer <Vercel OIDC JWT>`. In a deployed Vercel Function, `/api/precheck` reads the platform-injected `x-vercel-oidc-token` header from its `Request` object and forwards that value. In local development only, Vercel CLI may expose the short-lived token as `VERCEL_OIDC_TOKEN`; it must never be printed, committed, or copied into a permanent environment variable.

The Worker validates the RS256 signature against the issuer JWKS and then checks the exact issuer, audience, owner ID, project ID, project name, owner slug, subject, environment, expiry, and optional not-before time. Only `production`, `preview`, and `development` environments are accepted. See the official [Vercel OIDC runtime reference](https://vercel.com/docs/oidc/reference).

The request is authenticated before its content type, size, or body is read. The Worker never logs the token, intake, prompt, or model response and has no KV, D1, R2, Durable Object, or Vectorize binding.

## Response safety boundary

The Worker requests one structured `build_precheck_card` function call with no external tools. The same-origin Next.js route then treats the entire model response as untrusted: it rejects unknown fields, HTML, digits, automated prices, outcome probabilities or guarantees, legal citations, FAS scenarios, and any next step that does not explicitly require a lawyer's review. Rejection always produces the deterministic fallback card.

The repository contains 12 anonymized quality scenarios, two for every supported practice. They exercise the deterministic fallback, provider validation, trusted-field merge, unknown-fact checks, and human-review wording without calling an external model.

## Deployment boundary

Source preparation does not publish this Worker. Before deployment, verify the selected model still exists, create a unique `workers.dev` account subdomain, deploy from this directory using the authenticated Cloudflare account, and test the health endpoint. Production activation additionally requires a verified Vercel preview and explicit operator approval.

Rollback is immediate: set `AI_PRECHECK_ENABLED=false` in Vercel so the site uses its deterministic fallback, then disable the Worker route or workers.dev subdomain. No application data needs migration or recovery because this Worker stores none.
