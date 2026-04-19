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
  "tenantId": "tenant_abc",
  "tier": "starter",
  "creditsRemaining": 1420,
  "creditsTotal": 1665,
  "rateLimitPerMinute": 60
}
```

If validation fails with 401, ask the user to check their key.

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
    "agentVersions": { "advertising-law": "1.1.0", "jurisdiction-detection": "1.2.0" },
    "modelVersions": { "perplexity/sonar-pro": "sonar-pro-2026", "claude-opus-4-6": "claude-opus-4-6" }
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
| [content-compliance-check.md](workflows/content-compliance-check.md) | Full compliance check with all 3 response modes |
| [image-rights-clearance.md](workflows/image-rights-clearance.md) | Check images for rights, celebrities, logos |
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
| 401 | Invalid or expired API key | Ask user to check their key |
| 402 | Insufficient credits | Show `creditsRemaining` and `upgradeUrl` from response. Suggest upgrading. |
| 429 | Rate limited | Wait for `Retry-After` header seconds, then retry |
| 400 | Invalid request | Check the error message for missing/invalid fields |
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
4. When displaying results, use `annotations` for UI highlighting, `checks` for detailed findings.
5. The `versionInfo` in responses helps explain why results may differ over time — rules are updated regularly.
6. Cached responses return instantly at 0 credits — check the `cached` field in responses.
7. Use `GET /logs?externalId=...` to debug integration issues.
8. Register webhooks via `POST /webhooks` for async result delivery.
