# ZebraTruth AI Labs

AI-powered compliance agents that plug into your existing creative workflows. Check advertising content against jurisdiction laws, platform policies, and rights clearance requirements — via API, LLM skill, or direct integration.

## What is ZebraTruth?

ZebraTruth provides compliance intelligence as a service. Your clients keep their video editors, content pipelines, and creative tools. ZebraTruth's agents analyze content and return structured compliance results with **annotations that map directly to your UI** — text spans, video timestamps, image regions.

### Compliance Agents

| Agent | What it checks |
|-------|---------------|
| **Jurisdiction Detection** | Applicable laws (FTC, EU UCPD, UK ASA, etc.) |
| **Advertising Law** | Claim substantiation, endorsement rules, targeting restrictions |
| **Platform Policy** | YouTube, Instagram, Facebook, TikTok, LinkedIn AI disclosure and monetization rules |
| **Rights Clearance (Text)** | Celebrity references, copyrighted characters, trademark usage |
| **Rights Clearance (Image)** | Restricted categories, content safety, brand logos, stock watermarks, C2PA metadata |
| **Video Compliance Check** | Restricted categories, content safety, on-screen text, audio claims, brand logos, watermarks (async pipeline) |
| **Metadata & Labeling** | Content Credentials, machine-readable metadata, visible labels |
| **Scoring** | Deterministic 0-100 score with PUBLISH / HOLD / BLOCK decision |

New agents are added regularly. Use `GET /api/v1/agents` to discover all available agents.

## Quick Start

```bash
# 1. Get your API key at https://developers.zebratruth.ai

# 2. Validate your key
curl https://api.zebratruth.ai/v1/whoami \
  -H "Authorization: Bearer zt_live_your_key_here"

# 3. Run a compliance check
curl -X POST https://api.zebratruth.ai/v1/compliance/check \
  -H "Authorization: Bearer zt_live_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "jurisdictions": ["us", "eu"],
    "platforms": ["youtube", "instagram"],
    "content": { "text": "Try our guaranteed weight loss solution!" },
    "mode": "fast"
  }'
```

**Response:**
```json
{
  "score": 35,
  "decision": "BLOCK",
  "checks": [...],
  "annotations": [
    {
      "type": "text-span",
      "severity": "critical",
      "message": "'Guaranteed weight loss' violates FTC health claim rules",
      "suggestion": "Remove unsubstantiated health claims",
      "textLocation": { "start": 8, "end": 40, "matchedText": "guaranteed weight loss solution" }
    }
  ],
  "versionInfo": { "engineVersion": "1.3.2", "rulesVersion": "2026-04-01" },
  "costBreakdown": { "totalCredits": 12, "agents": [...] }
}
```

## Integration Options

### REST API
Direct HTTP calls from any language or platform. Three response modes:
- **Sync** — block and return full report
- **Stream** — SSE events per agent (progressive results)
- **Async** — webhook callback on completion

[Full API documentation](https://developers.zebratruth.ai/docs)

### LLM Skill (SKILL.md)
Drop [`skills/zebratruth-compliance/SKILL.md`](skills/zebratruth-compliance/SKILL.md) into any LLM agent's context. The agent learns to authenticate, run checks, and interpret results — no SDK needed.

Works with: Claude Code, OpenClaw, any LLM platform supporting markdown injection.

```bash
# Claude Code
claude plugin install zebratruth-compliance@zebratruth-ai-labs

# OpenClaw
openclaw skills install zebratruth-compliance
```

## Repository Structure

```
zebratruth-ai-labs/
├── skills/
│   └── zebratruth-compliance/
│       ├── SKILL.md                          # LLM skill definition
│       └── workflows/
│           ├── content-compliance-check.md   # Full check procedure
│           ├── image-rights-clearance.md     # Image-specific checks
│           ├── streaming-integration.md      # SSE consumption
│           ├── async-webhook-execution.md    # Submit-then-poll
│           ├── individual-agents.md          # Per-agent invocation
│           ├── interpreting-reports.md       # Scores & decisions
│           ├── embedding-annotations.md      # Map to your UI
│           ├── cost-and-credits.md           # Budget management
│           └── debugging.md                  # Logs, traces, replay
├── examples/
│   ├── node/                                 # Node.js examples
│   ├── python/                               # Python examples
│   └── curl/                                 # cURL examples
└── .claude-plugin/
    ├── plugin.json                           # Claude Code plugin manifest
    └── marketplace.json                      # Marketplace registry
```

## Available Jurisdictions

| ID | Jurisdiction | Key Regulations |
|----|-------------|----------------|
| `us` | United States | FTC Act, COPPA, CAN-SPAM, state consumer protection |
| `eu` | European Union | UCPD, AI Act, GDPR, DSA |
| `uk` | United Kingdom | ASA CAP Code, Consumer Rights Act, UK GDPR |
| `india` | India | Consumer Protection Act, ASCI Code, IT Act |
| `china` | China | Advertising Law, Personal Information Protection Law |

## Available Platforms

| ID | Platform | Key Policies |
|----|---------|-------------|
| `youtube` | YouTube | AI disclosure, monetization, Community Guidelines |
| `instagram` | Instagram | Branded content, AI labels, Community Guidelines |
| `facebook` | Facebook | Ad policies, AI disclosure, Community Standards |
| `tiktok` | TikTok | AI-generated content policy, ad requirements |
| `linkedin` | LinkedIn | Professional community policies, ad guidelines |

## Pricing

Credits-based billing. $1 of billed cost = 111 credits.

| Plan | Price | Credits | Rate Limit | Concurrent Load |
|------|-------|---------|-----------|-----------------|
| Free | $0 | 1,000 / 7-day trial | 10/min | 2 units |
| Pro | $750/mo | 83,250/mo | 300/min | 25 units |
| Enterprise | Custom | Custom | Custom | Custom |

[Sign up at developers.zebratruth.ai](https://developers.zebratruth.ai)

## Links

- [Developer Portal](https://developers.zebratruth.ai) — Sign up, API keys, usage dashboard
- [API Documentation](https://developers.zebratruth.ai/docs) — Full endpoint reference
- [Status Page](https://status.zebratruth.ai) — System status and uptime
- [ZebraTruth Studio](https://zebratruthai.vercel.app) — Reference implementation (video editor with compliance)

## License

MIT
