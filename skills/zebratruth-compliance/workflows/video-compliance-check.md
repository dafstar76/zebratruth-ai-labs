# Video Compliance Check

Run compliance analysis on video files. **Asynchronous** — upload the video, submit the check, then either poll for status or receive a signed webhook when terminal. Reports carry the same compliance check shape as text/image checks, plus optional frame-level evidence references (`evidenceIds[]` + `timelineLocation`) for findings tied to specific moments in the video.

## Prerequisites

- Valid API key (`compliance:check` scope)
- Tenant onboarded with at least one jurisdiction and platform (see [tenant-onboarding-and-scoping.md](tenant-onboarding-and-scoping.md))
- Video file: **MP4 / WebM / QuickTime**, **3–180 seconds duration**, **≤ 200 MB**
- For webhook delivery: tenant webhook signing secret retrieved via [video webhook secret](#webhook-signing-secret-setup-optional) (one-time setup)

## The 3-Step Async Flow

```
1. POST /v1/compliance/media/upload-url    → SAS URL + blobPath + requestId
2. PUT  <SAS URL>                          → upload bytes directly to blob storage
3. POST /v1/compliance/check-video         → 202 + jobId
4. Poll GET /v1/compliance/check-video/{requestId}  → terminal status + inlined report
   OR receive a signed webhook callback (set webhookUrl in step 3)
```

### Step 1 — Mint an upload URL

```bash
curl -X POST https://api.zebratruth.ai/v1/compliance/media/upload-url \
  -H "Authorization: Bearer $ZEBRATRUTH_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"contentType": "video/mp4"}'
```

Response:
```json
{
  "uploadUrl": "https://zebratruthstorage.blob.core.windows.net/videos/.../source.mp4?...sig=...",
  "blobPath": "videos/kp_abc.../82b68316-.../source.mp4",
  "requestId": "82b68316-ed85-489c-991e-2ff0f2b95f29",
  "requiredTags": {"tenantId": "kp_abc...", "requestId": "82b68316-...", "kind": "video"},
  "uploadInstructions": {
    "method": "PUT",
    "headers": {
      "x-ms-blob-type": "BlockBlob",
      "x-ms-tags": "tenantId=kp_abc...&requestId=82b68316-...&kind=video"
    }
  }
}
```

The SAS URL is **valid for 15 minutes**. The `requestId` is the durable handle for the entire job.

### Step 2 — PUT video bytes directly to blob storage

```bash
curl -X PUT "<uploadUrl from step 1>" \
  -H "x-ms-blob-type: BlockBlob" \
  -H "x-ms-tags: tenantId=...&requestId=...&kind=video" \
  --data-binary @./ad.mp4
```

**Critical:** include the `uploadInstructions.headers` verbatim. Do NOT add your `Authorization` header — the SAS URL is self-authenticating. Expect a `201 Created` response (no body).

### Step 3 — Submit the compliance check

```bash
curl -X POST https://api.zebratruth.ai/v1/compliance/check-video \
  -H "Authorization: Bearer $ZEBRATRUTH_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "requestId": "82b68316-ed85-489c-991e-2ff0f2b95f29",
    "blobPath": "videos/kp_abc.../82b68316-.../source.mp4",
    "jurisdictions": ["us", "eu"],
    "platforms": ["youtube"],
    "mode": "fast"
  }'
```

`requestId` + `blobPath` must be the values returned from step 1. Returns 202 immediately:

```json
{
  "jobId": "82b68316-ed85-489c-991e-2ff0f2b95f29",
  "status": "queued",
  "estimatedCredits": 50,
  "callbackId": "your-correlation-id"
}
```

`jobId` is the same value as the `requestId` — pass it to step 4. Credits are **reserved** but not yet **committed** — see [billing](#billing-semantics).

Add `"webhookUrl": "https://your-app.example.com/cb"` to receive a signed POST when terminal instead of polling. Webhook bodies are HMAC-signed with your tenant webhook secret (see [setup section](#webhook-signing-secret-setup-optional)).

### Step 4 — Poll for status + report

```bash
curl https://api.zebratruth.ai/v1/compliance/check-video/82b68316-... \
  -H "Authorization: Bearer $ZEBRATRUTH_API_KEY"
```

**Polling cadence:** every 2 seconds. Worker pipeline ceiling is 3 minutes — give up after that and check job status manually.

While in flight:
```json
{
  "requestId": "82b68316-...",
  "status": "processing",
  "phase": "transcribeAudio"
}
```

When terminal:
```json
{
  "requestId": "82b68316-...",
  "status": "completed",
  "reportStatus": "complete",
  "billingStatus": "committed",
  "workerCompletedAt": "2026-05-28T17:19:24.083Z",
  "durationMs": 8000,
  "reportBlobPath": "videos/.../report.json",
  "report": {
    "schemaVersion": "video-report.v1",
    "status": "complete",
    "checks": [/* VideoComplianceCheck[] */],
    "analysisDiagnostics": [/* optional */],
    "preprocessing": {/* transcription + frame analysis status */}
  }
}
```

The full `report` payload is inlined — no separate blob fetch needed.

## Status Interpretation

Two status fields with different lifecycles:

### `status` — public 4-state job lifecycle

| `status` | Meaning |
|---|---|
| `queued` | Job accepted, worker hasn't picked it up yet. Keep polling. |
| `processing` | Worker in-flight. `phase` field shows current stage. Keep polling. |
| `completed` | Worker finished. Inspect `reportStatus` for outcome. |
| `failed` | Engine/renderer error or poison-queue. Inspect `error` field. |

### `reportStatus` — terminal analysis outcome (present when `status` is terminal)

| `reportStatus` | Meaning | Billing |
|---|---|---|
| `complete` | Real compliance report produced. | `committed` — credits charged |
| `insufficient_evidence` | Video had no spoken content, no on-screen text, no detected signals. Report persists for audit but is empty. | `released` — no charge |
| `analysis_failed` | Engine/renderer hit a non-retryable error. Forensic report with diagnostic. | `released` — no charge |

### `reportFetchFailed: true`

Blob storage is eventually-consistent. A read immediately after the worker completes can occasionally miss. When this flag is present, the row is terminal but the report blob couldn't be fetched in this call — **retry the same endpoint in 1–2 seconds**.

## The Report Shape

`VideoComplianceCheck` is the same as the public `ComplianceCheck` (text + image) with two optional video-specific fields:

```json
{
  "agentId": "advertising-law",
  "checkName": "Unsubstantiated health claim",
  "status": "block",
  "severity": "high",
  "message": "...",
  "recommendation": "...",
  "citation": "...",
  "primaryCategory": "unsubstantiated-health-claim",
  "categories": ["unsubstantiated-health-claim"],

  // Optional video-only fields — present on findings tied to specific moments
  "evidenceIds": ["audio_003", "frame_007", "ocr_012"],
  "timelineLocation": {
    "startMs": 12400,
    "endMs": 15800,
    "track": "mixed"
  }
}
```

**`evidenceIds[]`** are stable handles into the underlying evidence: `audio_NNN` (transcript segments), `frame_NNN` (sampled frames), `ocr_NNN` (on-screen text detections), `signal_NNN` (visual signals like brand logos).

**`timelineLocation.track`** is `audio`, `video`, or `mixed`. Use it to seek to the offending moment in a video player.

LLM-derived findings about the overall video content may omit both fields. Frame-level deterministic findings (brand logos, restricted-category labels, on-screen text) always include them.

## Analysis Diagnostics

`report.analysisDiagnostics[]` surfaces pipeline conditions that aren't compliance findings but are still meaningful to the consumer:

```json
{
  "code": "evidence_truncated",
  "message": "Visual signal summary dropped (140 signals) — content exceeded 30000 char cap.",
  "severity": "warning"
}
```

Diagnostics never appear in `report.checks[]` — strict separation so pipeline issues don't get rendered as fake compliance violations. Common codes:
- `evidence_truncated` — renderer dropped some evidence to fit size caps
- `video_check_missing_evidence_ids` — Stage C emitted a check without evidence; dropped
- `deterministic_check_evidence_mapping_failed` — aggregator couldn't map a deterministic finding back to evidence
- `analysis_non_retryable_failure` — engine error during analysis (present only when `reportStatus: analysis_failed`)

Always check `report.preprocessing.degraded` and display diagnostics in the UI if true.

## Idempotency

Re-posting the same `requestId` with the **same** `blobPath` + `jurisdictions` + `platforms` + `mode` returns 202 with `idempotent: true` — no double-charge. Inputs are canonicalized (trim + lowercase + sort) so `["US"]` and `["us"]` are the same.

Re-posting the same `requestId` with **different** inputs returns 409:

```json
{
  "error": true,
  "code": "idempotency_conflict",
  "reason": "inputHash",
  "existing": "a1b2...",
  "incoming": "c3d4..."
}
```

`reason` indicates which field differed: `blobPath` (precedence 1), `feature` (precedence 2), or `inputHash` (precedence 3 — different jurisdictions / platforms / mode).

## Webhook Signing Secret Setup (optional)

Required only if you set `webhookUrl` on submission. Tenant-level secret — one secret per tenant, reused for all video webhooks.

```bash
# Retrieve (auto-creates on first call)
curl https://api.zebratruth.ai/v1/compliance/webhooks/video/secret \
  -H "Authorization: Bearer $ZEBRATRUTH_API_KEY"
# → { "secret": "whsec_a1b2...", "justGenerated": true, "createdAt": "..." }
```

Verify each webhook delivery:
```
signature == HMAC_SHA256(secret,
  "POST" + "\n" + url + "\n" + timestamp + "\n" + sha256(body))
```

Read `signature` from the `x-zt-webhook-signature` header, `timestamp` from `x-zt-webhook-timestamp`. The signature is computed once at delivery enqueue and stays stable across all retries — your verifier sees the same value regardless of attempt.

Rotate the secret:
```bash
curl -X POST https://api.zebratruth.ai/v1/compliance/webhooks/video/secret/rotate \
  -H "Authorization: Bearer $ZEBRATRUTH_API_KEY"
```

**In-flight deliveries keep using the old secret** (signed at enqueue). New jobs sign with the new secret. Most receivers accept both old + new during a brief grace window.

## Billing Semantics

- **Reserve at submit** — `estimatedCredits` is held against the tenant budget when 202 is returned. Pricing is **per-second** (typically `ceil(durationSec) × creditsPerSecond`).
- **Commit at terminal `complete`** — credits charged once the report persists with real findings.
- **Release at terminal `insufficient_evidence` or `analysis_failed`** — no charge. Reserved credits return to the budget.
- **Release on poison-queue failure** — if the worker fully gives up after retries, the cost is refunded automatically.

Tenants never pay for failed analyses. See [cost-and-credits.md](cost-and-credits.md) for budget management.

## Common Errors

| Status | `data.code` | Meaning |
|---|---|---|
| 400 | `blob_path_invalid` | `blobPath` doesn't start with `videos/{tenantId}/{requestId}/`. Use the values from step 1 verbatim. |
| 400 | `unsupported_mode` | V1 supports `mode: "fast"` only. |
| 400 | `video_too_short` / `duration_out_of_range` | Duration outside [3, 180] seconds. |
| 400 | `blob_not_found` | Step 2's PUT didn't complete, or the 15-min SAS expired. Restart from step 1. |
| 400 | `blob_ownership_mismatch` | Blob tags don't match the request's tenant/request. Restart from step 1. |
| 402 | (insufficient credits) | Top up the tenant balance — `estimatedCredits` is in the response. |
| 409 | `idempotency_conflict` | Same `requestId` reused with different inputs. Mint a new one. |
| 502 | `probe_unavailable` | Probe service temporarily unavailable. Retry the submission in 5–10 seconds. |
| 503 | `video_analysis_disabled` | Video analysis is currently paused. Retry later or check status page. |

## When to use which response strategy

- **Sync polling** (this workflow) — simplest. Block in your client until terminal. Best for interactive demos / playground / short videos.
- **Webhook callback** — set `webhookUrl` on submission. Best for production agents / long videos / batch processing. Eliminates polling cost.
- **Both** — set `webhookUrl` AND poll. The poll is harmless if the webhook arrives first (status will already be `completed`).

## Related

- [interpreting-reports.md](interpreting-reports.md) — Decoding `severity`, `status`, `score`, and `decision`
- [cost-and-credits.md](cost-and-credits.md) — Budget management
- [debugging.md](debugging.md) — Logs, traces, replay
- [tenant-onboarding-and-scoping.md](tenant-onboarding-and-scoping.md) — Jurisdiction/platform configuration
