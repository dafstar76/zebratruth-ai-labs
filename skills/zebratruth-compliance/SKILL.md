---
skill: zebratruth-compliance
version: "1.0.0"
description: "AI-powered compliance checking for advertising content — jurisdiction laws, platform policies, rights clearance, and scoring"
homepage: https://developers.zebratruth.ai
api_base: https://api.zebratruth.ai/v1
auth: bearer_token
auth_header: "Authorization: Bearer {api_key}"
auth_validation: GET /whoami
agents: dynamic
capabilities:
  - content-compliance-check
  - image-rights-clearance
  - restricted-categories
  - multipart-image-upload
  - tenant-scoping
  - streaming-progressive-results
  - async-webhook-execution
  - individual-agent-invocation
  - annotation-mapping
  - cost-aware-execution
metadata:
  openclaw:
    requires:
      env: ["ZEBRATRUTH_API_KEY"]
    primaryEnv: "ZEBRATRUTH_API_KEY"
---

# ZebraTruth Compliance Agent

You are integrating with ZebraTruth's AI compliance engine. ZebraTruth checks AI-generated advertising content against jurisdiction laws, platform policies, and rights clearance requirements. Results include **annotations** that map directly to content locations (text spans, video timestamps, image regions).

## Authentication

All requests require: `Authorization: Bearer {api_key}`

The API key starts with `zt_live_` (production) or `zt_test_` (test).

**Step 1:** Check if `ZEBRATRUTH_API_KEY` is set in the environment.

**Step 2:** If not set, instruct the user to set it as an environment variable. They can get a key at https://developers.zebratruth.ai — do NOT accept API keys directly in conversation (they would be logged in chat history).

```
export ZEBRATRUTH_API_KEY=zt_live_your_key_here
```

**Step 3:** Validate the key before proceeding:

```
GET https://api.zebratruth.ai/v1/whoami
Authorization: Bearer {api_key}
```

Response:
```json
{
  "tenantId": "kp_a269d9695f734329a216669410731a21",
  "tier": "free",
  "authType": "apikey",
  "scopes": ["compliance:check", "agents:*", "reports:read", "policies:read"],
  "rateLimit": 10
}
```

Credit balance is NOT on `/whoami` — use `GET /v1/usage` for that. `/whoami`
returns auth/identity only (tenantId, tier, authType, scopes, rateLimit).

If validation fails with 401, ask the user to check their key.

## Onboarding & Tenant Scoping

Every request is scoped to the tenant's subscribed jurisdictions and platforms,
set during onboarding at `https://developers.zebratruth.ai`. Requests outside
that scope return 403 BEFORE any credits are spent.

**Allowed values:**
- Jurisdictions: `us`, `eu`, `uk`, `india`, `china`
- Platforms: `youtube`, `instagram`, `facebook`, `tiktok`, `linkedin`

**Precedence:** if a request supplies `jurisdictions` / `platforms`, each value
must be in the tenant's subscription. If omitted, the tenant's defaults apply.
The engine never silently expands scope beyond what the caller asked for.

**The four 403 shapes — match on `error` field verbatim:**

1. `"Tenant not onboarded. Complete setup at https://developers.zebratruth.ai before using the API."`
   → Direct user to the dev portal onboarding wizard.
2. `"Tenant configuration incomplete. Set default jurisdictions and platforms in your dev portal."`
   → Direct user to `https://developers.zebratruth.ai/dashboard/settings`.
3. `"Requested jurisdictions [india, china] are not in your subscription. Allowed: [us, eu]."`
   → Narrow the request OR direct user to update subscription.
4. `"Requested platforms [tiktok] are not in your subscription. Allowed: [youtube, instagram]."`
   → Same remediation — narrow request or update subscription.

**Test-mode keys (`zt_test_`) still go through scope enforcement.** A test key
tied to a non-onboarded tenant will still 403. Sandbox and production behavior
are deliberately consistent — do not assume test keys skip scope.

See [tenant-onboarding-and-scoping.md](workflows/tenant-onboarding-and-scoping.md)
for the full workflow.

## Quick Start: Run a Compliance Check

```
POST https://api.zebratruth.ai/v1/compliance/check
Authorization: Bearer {api_key}
Content-Type: application/json
Idempotency-Key: {generate-uuid}

{
  "jurisdictions": ["us", "eu"],
  "platforms": ["youtube", "instagram"],
  "content": {
    "text": "Your ad script or content here"
  },
  "mode": "fast",
  "responseMode": "sync"
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `jurisdictions` | string[] | Which laws to check against: `us`, `eu`, `uk`, `india`, `china` |
| `platforms` | string[] | Which platform policies: `youtube`, `instagram`, `facebook`, `tiktok`, `linkedin` |
| `content.text` | string | The content to check |
| `mode` | string | `"fast"` (parallel, cheaper) or `"full"` (4-phase pipeline, thorough) |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `content.imageUrls` | string[] | Image URLs to check for rights clearance (runs image agents alongside text agents). For image-only checks, use the dedicated `POST /v1/compliance/check-image` endpoint instead. |
| `responseMode` | string | `"sync"` (default), `"stream"` (SSE), or `"async"` (webhook) |
| `webhookUrl` | string | Required for async mode — where to POST results |
| `callbackId` | string | Your correlation ID, echoed back in response |
| `externalId` | string | Your own reference ID, queryable in logs |

### Multipart Upload (image binaries)

When the user has an image file locally and can't host it at a public URL, use
`multipart/form-data` instead of JSON. Works on both `/v1/compliance/check`
(text + image) and `/v1/compliance/check-image` (image-only). Sync-only —
streaming and webhook modes are JSON-path only.

```bash
curl -X POST https://api.zebratruth.ai/v1/compliance/check \
  -H "Authorization: Bearer $ZEBRATRUTH_API_KEY" \
  -H "Idempotency-Key: $(uuidgen)" \
  -F "text=Ariana Grande wears the new Nike sneakers..." \
  -F "image=@./ad.png" \
  -F "jurisdictions=us" -F "jurisdictions=eu" \
  -F "platforms=youtube" \
  -F "mode=fast"
```

**Rules:** flat fields only — repeat `jurisdictions`, `platforms`, and `image`
once per value (not comma-separated, not JSON arrays). Up to 2 `image` parts.
Total body capped at 4.5 MB.

**Cache bypass:** requests with any `image` parts (multipart) or a non-empty
`imageUrls` array (JSON) skip the response cache and are always billed, because
the cache is keyed on text only.

### Response

```json
{
  "score": 72,
  "decision": "HOLD",
  "checks": [
    {
      "agentId": "advertising-law",
      "checkName": "unsubstantiated-claim",
      "status": "flag",
      "severity": "high",
      "message": "'Guaranteed results' may violate FTC endorsement guides",
      "recommendation": "Remove or substantiate the guarantee claim",
      "citation": "16 CFR Part 255"
    }
  ],
  "annotations": [
    {
      "type": "text-span",
      "agentId": "advertising-law",
      "severity": "high",
      "message": "'Guaranteed results' may violate FTC endorsement guides",
      "suggestion": "Consider 'may help' instead of 'guaranteed'",
      "textLocation": {
        "start": 120,
        "end": 138,
        "matchedText": "guaranteed results"
      }
    }
  ],
  "versionInfo": {
    "engineVersion": "1.0.0",
    "rulesVersion": "2026-04-17",
    "agentVersions": { "advertising-law": "1.1.0", "ai-laws": "1.3.0" },
    "stackVersion": "2026.04-a7f3"
  },
  "cached": false,
  "creditsCharged": 12,
  "costBreakdown": {
    "totalCredits": 12,
    "agents": [...]
  }
}
```

## Interpreting Results

| Score | Decision | Meaning |
|-------|----------|---------|
| 80-100 | `PUBLISH` | Content is compliant. Safe to publish. |
| 60-79 | `HOLD` | Issues found. Review the `checks` and `annotations` arrays. Fix flagged items. |
| 0-59 | `BLOCK` | Significant or critical violations. Must fix before publishing. |

### Severity Levels

- **critical** — Legal liability risk. Must fix.
- **high** — Likely violation. Should fix before publishing.
- **medium** — Potential issue. Review recommended.
- **low** — Minor concern. Optional fix.
- **info** — Informational only.

### Check Statuses in Image Responses

`rights-clearance-image` does NOT map all detections to `block`. Use these
defaults when presenting results:

- **`block`** — only stock-agency watermarks (Shutterstock, Getty, iStock, etc.) — unlicensed stock imagery is a hard fail
- **`flag`** — celebrity faces, brand logos, missing C2PA credentials — review required, may be licensed/consented/fair-use
- **`pass`** — verified C2PA credentials present

Treat `flag` as "human review needed," not "reject."

## Jurisdiction-Aware Citations

Citations on returned checks are composed from the laws relevant to the
jurisdictions the request asked for — not a fixed legal framework. A celebrity
detection with `jurisdictions: ["us"]` cites California/NY publicity law; the
same detection with `jurisdictions: ["eu", "uk"]` cites European personality
rights and UK passing off. Trademark, copyright, and C2PA regulatory notes
(EU AI Act Art. 50, California SB 942, China Deep Synthesis Provisions, etc.)
are similarly scoped.

Practical implication: when surfacing the `citation` field to a user, mention
which jurisdictions the citations cover (the request's jurisdiction set). When
a user narrows their jurisdiction list, the citation content shrinks
proportionally — this is intended.

## Using Annotations

Annotations map compliance issues to specific locations in the content. Use them to highlight issues in the user's UI:

- **`text-span`** — Character offsets in text content. Use `start` and `end` to highlight the flagged text.
- **`timeline`** — Millisecond ranges in video. Use `startMs` and `endMs` to mark the flagged segment.
- **`image-region`** — Bounding box in an image. Use `boundingBox` to highlight the flagged area.
- **`global`** — Applies to the entire content (e.g., "Missing AI disclosure label").

## Discover Available Agents

Agents are added regularly. Always discover dynamically:

```
GET https://api.zebratruth.ai/v1/agents
```

Returns the list of available agents with their IDs, descriptions, and capabilities.

## Caching

Identical checks (same content + jurisdictions + platforms + mode) return cached results at **zero credits**. Cached responses include:

```json
{
  "cached": true,
  "originalCost": 47,
  "creditsCharged": 0,
  ...full report...
}
```

Cache is automatically invalidated when compliance rules are updated (`rulesVersion` changes).

## Cost Awareness

Before running expensive checks:

```
GET https://api.zebratruth.ai/v1/usage
```

Returns current credit balance and usage. Full mode costs ~4x fast mode. If credits are low, prefer fast mode or suggest the user upgrade.

Each response includes `costBreakdown` showing per-agent credit usage.

## Versioning

Check the current engine and rules versions:

```
GET https://api.zebratruth.ai/v1/version
```

Every compliance response includes `versionInfo` with `engineVersion`, `rulesVersion`, per-agent versions, and model IDs. Use this to explain why results may differ over time.

## Webhook Management

Register webhooks to receive async compliance results:

```
POST https://api.zebratruth.ai/v1/webhooks
{ "url": "https://your-app.com/webhooks/zebratruth", "events": ["check.completed", "check.failed"] }
```

Returns a `secret` (shown once) for verifying `X-ZebraTruth-Signature` HMAC headers.

Other webhook endpoints:
- `GET /v1/webhooks` — list registered webhooks
- `DELETE /v1/webhooks/{webhookId}` — remove a webhook
- `GET /v1/webhooks/deliveries` — view delivery log (filter by `?status=dead` for failures)

## Request Logs

Query your API request history:

```
GET https://api.zebratruth.ai/v1/logs?externalId=my-project&since=2026-04-01&limit=50
```

Returns requestId, method, path, statusCode, latencyMs, creditsUsed, cached flag.

## Replay

Re-run a previous check to compare results after a rules update:

```
POST https://api.zebratruth.ai/v1/reports/{reportId}/replay
```

Creates a new result from the same input. Compare `versionInfo` to see what changed.

## Available Workflows

For detailed step-by-step procedures, read any of these workflow documents:

| Workflow | When to use |
|----------|-------------|
| [tenant-onboarding-and-scoping.md](workflows/tenant-onboarding-and-scoping.md) | Onboarding model, 4 × 403 shapes and remediation |
| [content-compliance-check.md](workflows/content-compliance-check.md) | Full compliance check (JSON + multipart) with all 3 response modes |
| [image-rights-clearance.md](workflows/image-rights-clearance.md) | Check images for restricted categories, content safety, logos, watermarks, C2PA (JSON + multipart) |
| [restricted-categories.md](workflows/restricted-categories.md) | Six advertising-restricted categories (alcohol, weapons, tobacco, gambling, pharma, financial) with match labels and citation matrix |
| [streaming-integration.md](workflows/streaming-integration.md) | Consume SSE stream for progressive results |
| [async-webhook-execution.md](workflows/async-webhook-execution.md) | Submit-then-poll with webhook callbacks |
| [individual-agents.md](workflows/individual-agents.md) | Invoke a single agent directly |
| [interpreting-reports.md](workflows/interpreting-reports.md) | Deep guide to scores, decisions, annotations |
| [embedding-annotations.md](workflows/embedding-annotations.md) | Map annotations to UI elements |
| [cost-and-credits.md](workflows/cost-and-credits.md) | Budget management and cost optimization |
| [debugging.md](workflows/debugging.md) | Logs, traces, and replay |

## Error Handling

| Status | Meaning | Action |
|--------|---------|--------|
| 400 | Invalid request | Check the error message for missing/invalid fields |
| 401 | Invalid or expired API key | Ask user to check their key |
| 402 | Insufficient credits | Show `creditsRemaining` and `upgradeUrl` from response. Suggest upgrading. |
| 403 | Tenant scope denied | Read the `error` field for the exact message. Four shapes — see Onboarding & Tenant Scoping section above for each shape and its remediation. |
| 429 | Rate limited | Wait for `Retry-After` header seconds, then retry |
| 503 | Service paused (maintenance) | Wait and retry later |

## Complete API Surface

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/whoami` | GET | Validate key, tenant info |
| `/v1/usage` | GET | Credit balance |
| `/v1/version` | GET | Engine/rules/agent versions |
| `/v1/agents` | GET | Discover available agents |
| `/v1/agents/{agentId}` | POST | Invoke single agent |
| `/v1/compliance/check` | POST | Run compliance check (sync/stream/async) |
| `/v1/compliance/check-image` | POST | Image rights clearance |
| `/v1/compliance/jobs/{jobId}` | GET | Poll async job status |
| `/v1/policies/sources` | GET | Available compliance sources |
| `/v1/policies/status` | GET | Tenant's activated sources |
| `/v1/reports/{reportId}` | GET | Retrieve stored report |
| `/v1/reports/{reportId}/replay` | POST | Re-run same check |
| `/v1/logs` | GET | Request log history |
| `/v1/webhooks` | GET | List registered webhooks |
| `/v1/webhooks` | POST | Register webhook |
| `/v1/webhooks/{webhookId}` | DELETE | Remove webhook |
| `/v1/webhooks/deliveries` | GET | Webhook delivery log |

## Important Rules

1. Always include `Idempotency-Key` header on POST requests to prevent duplicate charges.
2. Always check `GET /usage` before running multiple checks in a batch.
3. Prefer `fast` mode unless the user specifically needs thorough analysis.
4. Sync `/compliance/check` calls typically take 15–120s. Set client timeouts to at least **150 seconds (2.5 min)**. For workflows that can't block that long, use `responseMode: "async"` with a webhook.
5. When displaying results, use `annotations` for UI highlighting, `checks` for detailed findings.
6. The `versionInfo` in responses helps explain why results may differ over time — rules are updated regularly.
7. Cached responses return instantly at 0 credits — check the `cached` field in responses.
8. Use `GET /logs?externalId=...` to debug integration issues.
9. Register webhooks via `POST /webhooks` for async result delivery.
