# Content Compliance Check

Full procedure for running a compliance check in any of the three response modes.

## Prerequisites

- Valid API key (validated via `GET /whoami`)
- **Completed onboarding** — the tenant must have default jurisdictions, platforms,
  and accountType set. Requests from a tenant that hasn't onboarded return 403
  (`Tenant not onboarded. Complete setup at https://developers.zebratruth.ai...`).
  See [tenant-onboarding-and-scoping.md](tenant-onboarding-and-scoping.md).
- Content to check (text, optionally images)
- Target jurisdictions and platforms — must be a subset of the tenant's subscription

## Procedure

### Step 1: Check Credits

```
GET https://api.zebratruth.ai/v1/usage
Authorization: Bearer {api_key}
```

Verify `creditsRemaining` is sufficient:
- Fast mode text check: ~12 credits
- Full mode text check: ~47 credits
- Image check: ~5 credits per image (additional)

If insufficient, inform the user and suggest upgrading at the `upgradeUrl` in the response.

### Step 2: Choose Mode and Response Mode

**Execution mode:**
- `fast` — All agents run in parallel. Cheaper, faster. Good for quick checks.
- `full` — 4-phase pipeline with content enrichment between phases. Thorough. Use for final pre-publish checks.

**Response mode:**
- `sync` — Block until complete. Best for fast mode or simple integrations.
- `stream` — SSE events per agent. Best for full mode with real-time UI updates.
- `async` — Return immediately, deliver result via webhook. Best for batch processing.

### Step 3: Submit the Check

Two request formats are supported.

**JSON** — canonical format, full feature set (streaming, webhooks, image URLs):

```
POST https://api.zebratruth.ai/v1/compliance/check
Authorization: Bearer {api_key}
Content-Type: application/json
Idempotency-Key: {generate-a-uuid-here}

{
  "jurisdictions": ["us", "eu"],
  "platforms": ["youtube", "instagram"],
  "content": {
    "text": "The full ad script or content text goes here.",
    "imageUrls": ["https://example.com/ad-image.jpg"]
  },
  "mode": "fast",
  "responseMode": "sync",
  "externalId": "my-project-123"
}
```

**Multipart** — for uploading image binaries directly (use when the user doesn't
have a public URL for the image). Sync-only; `responseMode`, `webhookUrl`, and
`callbackId` are ignored on this path.

```bash
curl -X POST https://api.zebratruth.ai/v1/compliance/check \
  -H "Authorization: Bearer $ZEBRATRUTH_API_KEY" \
  -H "Idempotency-Key: $(uuidgen)" \
  -F "text=The full ad script or content text goes here." \
  -F "image=@./ad.png" \
  -F "jurisdictions=us" -F "jurisdictions=eu" \
  -F "platforms=youtube" -F "platforms=instagram" \
  -F "mode=fast"
```

Multipart rules:
- Flat fields — repeat `jurisdictions`, `platforms`, and `image` once per value
  (NOT comma-separated, NOT JSON arrays)
- Up to 2 `image` parts
- Total request body capped at 4.5 MB by the platform

**Cache bypass with images.** The response cache is keyed on text only. Requests
that include any `image` parts (multipart) or a non-empty `imageUrls` array (JSON)
skip the cache and are always billed. This avoids serving the wrong image-rights
result from a prior request with different images.

### Step 4: Handle the Response

**Sync mode** — the full report is in the response body.

**Stream mode** — see [streaming-integration.md](streaming-integration.md)

**Async mode** — see [async-webhook-execution.md](async-webhook-execution.md)

### Step 5: Interpret Results

1. Check `decision`: PUBLISH, HOLD, or BLOCK
2. If HOLD or BLOCK, review `checks[]` for detailed findings
3. Use `annotations[]` to map issues to content locations
4. Present `recommendation` fields as actionable fixes

### Step 6: Iterate (if needed)

If the decision is HOLD or BLOCK:
1. Fix the flagged content based on recommendations
2. Re-submit with the updated content (use a NEW `Idempotency-Key`)
3. Repeat until the decision is PUBLISH

## Latency & Timeouts

Sync compliance checks typically complete in **15–120 seconds**. Variables that affect latency:
- Mode: `fast` runs agents in parallel (shorter); `full` is a 4-phase pipeline (longer)
- Number of jurisdictions + platforms (more scope = larger prompts per agent)
- Content length
- Cache hits — identical requests return in ≤1s at 0 credits

**Set client timeouts to at least 150 seconds (2.5 minutes).** Below 2 minutes and you'll
occasionally cut healthy requests on longer runs.

If your workflow can't block for 90+ seconds (UI thread, batch pipeline), use
`responseMode: "async"` — the API returns a `jobId` immediately and delivers results via
webhook. See [async-webhook-execution.md](async-webhook-execution.md).

## Error Handling

- **400 Bad Request**: Check that `jurisdictions` and `platforms` contain valid IDs.
- **402 Payment Required**: Credits exhausted. Response includes `creditsRemaining` and `upgradeUrl`.
- **403 Forbidden — tenant scope**: Request asks for a jurisdiction or platform
  outside the tenant's subscription, or the tenant record is missing/incomplete.
  The `error` field carries the exact runtime message. Four shapes:
  - `"Tenant not onboarded. Complete setup at https://developers.zebratruth.ai before using the API."`
  - `"Tenant configuration incomplete. Set default jurisdictions and platforms in your dev portal."`
  - `"Requested jurisdictions [india, china] are not in your subscription. Allowed: [us, eu]."`
  - `"Requested platforms [tiktok] are not in your subscription. Allowed: [youtube, instagram]."`

  Remediation: narrow the request, or update defaults at
  `https://developers.zebratruth.ai/dashboard/settings`. See
  [tenant-onboarding-and-scoping.md](tenant-onboarding-and-scoping.md).
- **429 Too Many Requests**: Rate limited. Wait for `Retry-After` seconds.

## Example: Full Flow

```bash
# 1. Check credits
curl https://api.zebratruth.ai/v1/usage \
  -H "Authorization: Bearer $ZEBRATRUTH_API_KEY"

# 2. Run check
curl -X POST https://api.zebratruth.ai/v1/compliance/check \
  -H "Authorization: Bearer $ZEBRATRUTH_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "jurisdictions": ["us"],
    "platforms": ["youtube"],
    "content": { "text": "Try our amazing guaranteed weight loss pills!" },
    "mode": "fast",
    "responseMode": "sync"
  }'
```
