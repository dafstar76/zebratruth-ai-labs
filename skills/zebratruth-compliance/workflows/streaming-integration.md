# Streaming Integration (SSE)

Consume progressive compliance results via Server-Sent Events. Each agent fires events as it completes, so clients can show early warnings immediately.

## Endpoint

```
POST https://api.zebratruth.ai/v1/compliance/check
Authorization: Bearer {api_key}
Content-Type: application/json
Idempotency-Key: {uuid}

{
  "jurisdictions": ["us", "eu"],
  "platforms": ["youtube"],
  "content": { "text": "..." },
  "mode": "full",
  "responseMode": "stream"
}
```

## SSE Event Stream

The response is `Content-Type: text/event-stream`. Events arrive as agents complete:

```
event: agent.started
data: {"agentId": "jurisdiction-detection", "phase": 1}

event: agent.completed
data: {"agentId": "jurisdiction-detection", "checks": [...], "annotations": [...]}

event: agent.started
data: {"agentId": "advertising-law", "phase": 2}

event: agent.started
data: {"agentId": "platform-policy", "phase": 2}

event: agent.completed
data: {"agentId": "advertising-law", "checks": [...], "annotations": [...]}

event: agent.completed
data: {"agentId": "platform-policy", "checks": [...], "annotations": [...]}

event: score
data: {"score": 72, "decision": "HOLD"}

event: complete
data: {"reportId": "rpt_abc", "versionInfo": {...}, "costBreakdown": {...}}
```

## Reconnecting After Disconnect

If the SSE connection drops, resume from the last completed agent:

```
GET https://api.zebratruth.ai/v1/compliance/jobs/{jobId}/stream?resumeFrom=advertising-law
Authorization: Bearer {api_key}
```

The `jobId` is returned in the initial response headers as `X-Job-Id`.

Partial results are persisted server-side. The stream resumes from the next uncompleted agent.

## Client Implementation Notes

1. Parse each `event:` + `data:` pair as a discrete event
2. On `agent.completed` — update UI with partial checks and annotations
3. On `score` — show the compliance score immediately
4. On `complete` — fetch the full report if needed via `GET /reports/{reportId}`
5. On disconnect — reconnect using `resumeFrom` with the last completed agentId

## When to Use Streaming

- Full mode checks (4 phases, takes 20-60 seconds)
- When the client wants to show progressive status: "Checking jurisdiction... Checking ad law... 2 issues found so far..."
- When the client wants to display annotations as they arrive

For fast mode (under 10 seconds), sync mode is usually sufficient.
