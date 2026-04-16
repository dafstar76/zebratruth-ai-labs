# Individual Agent Invocation

Call a single compliance agent directly instead of running the full pipeline. Useful for targeted checks or building custom workflows.

## Discover Available Agents

```
GET https://api.zebratruth.ai/v1/agents
Authorization: Bearer {api_key}
```

**Response:**
```json
[
  {
    "id": "jurisdiction-detection",
    "name": "Jurisdiction Detection",
    "description": "Detects applicable laws and regulations",
    "phase": 1,
    "inputType": "text",
    "version": "1.2.0"
  },
  {
    "id": "advertising-law",
    "name": "Advertising Law",
    "description": "Checks FTC, UCPD, and advertising regulations",
    "phase": 2,
    "inputType": "text",
    "version": "1.1.0"
  },
  ...
]
```

Always use this endpoint to discover agents — new agents are added regularly.

## Invoke a Single Agent

```
POST https://api.zebratruth.ai/v1/agents/{agentId}
Authorization: Bearer {api_key}
Content-Type: application/json
Idempotency-Key: {uuid}

{
  "jurisdictions": ["us"],
  "platforms": ["youtube"],
  "content": { "text": "..." }
}
```

**Response:**
```json
{
  "agentId": "advertising-law",
  "checks": [...],
  "annotations": [...],
  "costBreakdown": {
    "totalCredits": 8,
    "agents": [
      { "agent": "advertising-law", "stage": "A", "model": "perplexity/sonar-pro", "credits": 2, "cached": true },
      { "agent": "advertising-law", "stage": "B", "model": "gpt-5.2", "credits": 3 },
      { "agent": "advertising-law", "stage": "C", "model": "claude-opus-4-6", "credits": 3 }
    ]
  }
}
```

## Cost

Single agent invocation costs ~8-12 credits (1 agent × 3 LLM stages). Much cheaper than a full check (~47 credits).

## Use Cases

- **Targeted re-check**: After fixing a flagged issue, re-run just that agent instead of the full pipeline
- **Custom pipelines**: Build your own orchestration logic, calling agents in your preferred order
- **Cost optimization**: Only run the agents relevant to your content type
