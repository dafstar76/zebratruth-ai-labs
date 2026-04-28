# Debugging & Observability

Tools for debugging compliance checks, viewing request logs, inspecting agent traces, and replaying checks.

## Request Logs

Query your API request history:

```
GET https://api.zebratruth.ai/v1/logs?externalId=my-project-123&since=2026-04-01&limit=50
Authorization: Bearer {api_key}
```

**Response:**
```json
[
  {
    "requestId": "req_abc",
    "method": "POST",
    "path": "/v1/compliance/check",
    "statusCode": 200,
    "latencyMs": 8500,
    "creditsUsed": 47,
    "cached": false,
    "externalId": "my-project-123",
    "jobId": "job_xyz",
    "createdAt": "2026-04-15T10:30:00Z"
  }
]
```

Filter by `externalId` to find all requests related to your project.

## Agent Execution Trace

Get detailed per-agent metrics for a job:

```
GET https://api.zebratruth.ai/v1/compliance/jobs/{jobId}/trace
Authorization: Bearer {api_key}
```

**Response:**
```json
[
  {
    "agentId": "ai-laws",
    "agentVersion": "1.3.0",
    "phase": 1,
    "startedAt": "2026-04-15T10:30:00Z",
    "completedAt": "2026-04-15T10:30:03Z",
    "latencyMs": 3200,
    "inputTokens": 500,
    "outputTokens": 800,
    "maxTokensBudget": 1200,
    "credits": 2,
    "cached": false,
    "annotationCount": 0,
    "partial": false
  },
  {
    "agentId": "advertising-law",
    "agentVersion": "1.1.0",
    "phase": 2,
    "latencyMs": 5100,
    "cached": true,
    "credits": 0
  }
]
```

Use this to understand:
- Which agent was slow (`latencyMs`)
- Which agents hit cache (`cached: true`)
- Whether any agent was truncated (`partial: true`)
- Token budget vs actual usage (`maxTokensBudget` vs `outputTokens`)

## Replay a Check

Re-run the exact same check to compare results (e.g., after a rules update):

```
POST https://api.zebratruth.ai/v1/reports/{reportId}/replay
Authorization: Bearer {api_key}
Idempotency-Key: {new-uuid}
```

This creates a new job with the same input. A new budget reservation is created. Compare the two reports to see what changed.

## Common Issues

### Check returns different results than before
Compare `versionInfo` between the two reports. If `rulesVersion` changed, a rule update caused the difference. Check the agent trace to see which agent produced different checks.

### Agent shows `partial: true` in trace
The agent hit its token budget cap. The result is truncated. This usually means the content was very long or complex. Try splitting the content into smaller chunks.

### High latency on specific agents
Check the trace for `cached: false` — uncached research stages (Stage A) take longer on the first call. Subsequent calls with the same jurisdictions/platforms will be faster.

### 429 errors in batch processing
You're hitting the rate limit for your tier. Either:
- Space out requests (check `Retry-After` header)
- Use async mode with queue (automatically rate-managed)
- Upgrade to a higher tier for more capacity
