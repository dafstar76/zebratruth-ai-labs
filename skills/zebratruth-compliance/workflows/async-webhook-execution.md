# Async Webhook Execution

Submit a compliance check and receive results via webhook callback. Best for batch processing, background pipelines, and full mode checks at scale.

## Step 1: Submit the Check

```
POST https://api.zebratruth.ai/v1/compliance/check
Authorization: Bearer {api_key}
Content-Type: application/json
Idempotency-Key: {uuid}

{
  "jurisdictions": ["us", "eu"],
  "platforms": ["youtube", "instagram"],
  "content": { "text": "..." },
  "mode": "full",
  "responseMode": "async",
  "webhookUrl": "https://your-app.com/webhooks/zebratruth",
  "callbackId": "my-project-456"
}
```

**Response (immediate):**
```json
{
  "jobId": "job_xyz789",
  "status": "queued",
  "estimatedCredits": 47,
  "queuePosition": 1,
  "pollUrl": "/v1/compliance/jobs/job_xyz789"
}
```

Budget is reserved before the job enters the queue. If credits are insufficient, you get 402 immediately.

## Step 2: Poll for Status (optional)

```
GET https://api.zebratruth.ai/v1/compliance/jobs/job_xyz789
Authorization: Bearer {api_key}
```

**Response:**
```json
{
  "jobId": "job_xyz789",
  "status": "running",
  "completedAgents": ["jurisdiction-detection", "advertising-law"],
  "totalAgents": 7
}
```

Status values: `queued` → `pending` → `running` → `completed` | `failed` | `dead`

**Completed response (includes full report inline):**
```json
{
  "jobId": "job_xyz789",
  "status": "completed",
  "completedAgents": ["jurisdiction-detection", "advertising-law", "platform-policy", "metadata-labeling", "rights-clearance-text", "rights-clearance-image", "compliance-score"],
  "totalAgents": 7,
  "result": {
    "score": 85,
    "decision": "PUBLISH",
    "checks": [...],
    "annotations": [...],
    "versionInfo": {...},
    "costBreakdown": {...}
  }
}
```

## Step 3: Receive Webhook

When the check completes, ZebraTruth POSTs to your `webhookUrl`:

```json
{
  "eventId": "evt_abc123",
  "event": "check.completed",
  "jobId": "job_xyz789",
  "callbackId": "my-project-456",
  "timestamp": "2026-04-16T12:00:00Z",
  "version": 1,
  "data": {
    "score": 85,
    "decision": "PUBLISH",
    "checks": [...],
    "annotations": [...],
    "versionInfo": {...},
    "costBreakdown": {...}
  }
}
```

### Webhook Security

- **HMAC Signature**: `X-ZebraTruth-Signature: sha256=<hmac(secret, body)>`
- **Timestamp**: `X-ZebraTruth-Timestamp` — reject if `abs(now - timestamp) > 5 minutes`
- **Dedup**: Use `eventId` to deduplicate (at-least-once delivery)

### Webhook Failure Handling

- 3 retry attempts: 1s, 5s, 25s exponential backoff
- After 3 failures: moved to dead letter queue
- Check failed deliveries: `GET /v1/webhooks/deliveries?status=dead`

## Error Events

If the check fails, webhook delivers:

```json
{
  "event": "check.failed",
  "jobId": "job_xyz789",
  "data": {
    "error": "Agent timeout exceeded",
    "partialResults": {...}
  }
}
```

## Queue Priority

Jobs are processed in priority order by tier:
1. Enterprise (highest)
2. Pro
3. Starter
4. Free (lowest)

Job TTL is 1 hour. If not processed within that time, the job is moved to dead letter and the budget reservation is released.
