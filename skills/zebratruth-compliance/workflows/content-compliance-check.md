# Content Compliance Check

Full procedure for running a compliance check in any of the three response modes.

## Prerequisites

- Valid API key (validated via `GET /whoami`)
- Content to check (text, optionally images)
- Known target jurisdictions and platforms

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

## Error Handling

- **402 Payment Required**: Credits exhausted. Response includes `creditsRemaining` and `upgradeUrl`.
- **429 Too Many Requests**: Rate limited. Wait for `Retry-After` seconds.
- **400 Bad Request**: Check that `jurisdictions` and `platforms` contain valid IDs.

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
