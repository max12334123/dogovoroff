# Dogovoroff preliminary-intake Worker

Cloudflare account: `68d68e7951768d781652b953ae0b9345`  
Worker name: `dogovoroff-precheck-ai`  
Health endpoint: `GET /health`  
Protected endpoint: `POST /v1/precheck`

The Worker uses the native Workers AI binding and does not require a permanent API key in Vercel. Its expected public address is `https://dogovoroff-precheck-ai.<account-subdomain>.workers.dev`; the account subdomain is intentionally not created by source changes.

## Authentication boundary

Every inference request must carry `Authorization: Bearer <VERCEL_OIDC_TOKEN>`. The Worker validates the RS256 signature against the issuer JWKS and then checks the exact issuer, audience, owner ID, project ID, project name, owner slug, subject, environment, expiry, and optional not-before time. Only `production`, `preview`, and `development` environments are accepted.

The request is authenticated before its content type, size, or body is read. The Worker never logs the token, intake, prompt, or model response and has no KV, D1, R2, Durable Object, or Vectorize binding.

## Deployment boundary

Source preparation does not publish this Worker. Before deployment, verify the selected model still exists, create a unique `workers.dev` account subdomain, deploy from this directory using the authenticated Cloudflare account, and test the health endpoint. Production activation additionally requires a verified Vercel preview and explicit operator approval.

Rollback is immediate: set `AI_PRECHECK_ENABLED=false` in Vercel so the site uses its deterministic fallback, then disable the Worker route or workers.dev subdomain. No application data needs migration or recovery because this Worker stores none.
