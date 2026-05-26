# Image Rights Clearance

Check images for restricted-category content, brand logos, stock-agency watermarks, content safety signals, AI-generation provenance (C2PA / IPTC metadata), and known-person likeness.

## Prerequisites

- Valid API key
- Tenant onboarded with at least one jurisdiction and platform (see
  [tenant-onboarding-and-scoping.md](tenant-onboarding-and-scoping.md))

## Endpoint

Two request formats are supported.

**JSON** — reference publicly-hosted images by URL:

```
POST https://api.zebratruth.ai/v1/compliance/check-image
Authorization: Bearer {api_key}
Content-Type: application/json
Idempotency-Key: {uuid}

{
  "imageUrls": ["https://example.com/ad-image.jpg"],
  "jurisdictions": ["us"],
  "platforms": ["instagram"]
}
```

**Multipart** — upload image binaries directly (use when the user doesn't have a
public URL):

```bash
curl -X POST https://api.zebratruth.ai/v1/compliance/check-image \
  -H "Authorization: Bearer $ZEBRATRUTH_API_KEY" \
  -H "Idempotency-Key: $(uuidgen)" \
  -F "image=@./ad-1.png" -F "image=@./ad-2.png" \
  -F "jurisdictions=us" -F "jurisdictions=eu" \
  -F "platforms=instagram"
```

Multipart rules:
- Flat fields — repeat `jurisdictions`, `platforms`, and `image` once per value
- At least 1 and at most 2 `image` parts per request
- Total request body capped at 4.5 MB by the platform

## What It Checks

1. **C2PA / IPTC metadata** — Content Credentials, provenance, AI generation markers
2. **Restricted-category content** — Six advertising-restricted categories detected from image content: alcohol & spirits, weapons & firearms, tobacco & smoking, gambling, pharmaceuticals, and financial products (incl. crypto / forex / investments). See [restricted-categories.md](restricted-categories.md) for the full catalog, match labels, and citation matrices.
3. **Content safety (ZebraSafety)** — adult / violence / racy / medical likelihood signals. Tiered: high-confidence detections produce `block` checks; medium-confidence produce `flag` checks for review. Medical content is informational only (never auto-blocks).
4. **Brand logo detection** — Recognized trademarks → `flag` for review
5. **Stock-agency watermark detection** — Shutterstock, Getty, Adobe Stock, etc. → `block`
6. **Known-person / celebrity likeness** — Right-of-publicity flag for recognizable public figures. *Surfaces when the celebrity-detection provider is enabled in the deployment; not active in the default ZebraTruth-managed configuration today.*
7. **Deterministic risk aggregation** — Combines all detections into compliance checks with status / severity / recommendation

## Check Statuses (critical for interpretation)

Not every detection is a hard block. Map detection → status as follows:

| Detection | Status | Severity | Meaning |
|-----------|--------|----------|---------|
| Stock-agency watermark (Shutterstock, Getty, etc.) | `block` | `critical` | Hard fail — unlicensed stock imagery |
| Restricted category — high severity (alcohol, weapons, tobacco, gambling) | `block` | `high` | Hard-restricted advertising in most jurisdictions |
| Restricted category — medium severity (pharmaceutical, financial-products) | `flag` | `medium` | Regulated — substantiation & disclosure required |
| Content safety — adult/violence/racy at `(high confidence)` | `block` | `high` | Platform-policy violation in most ad networks |
| Content safety — adult/violence/racy at `(medium confidence)` | `flag` | `medium` | Review: may be intentional & permitted in context |
| Content safety — medical content | `pass` | `info` | Informational only — pharmaceutical-rule reminder |
| Known-person face *(when enabled)* | `flag` | `high` | Review: may be licensed / consented |
| Brand logo | `flag` | `high` | Review: could be fair use, comparative ads, authorized |
| C2PA credentials missing | `flag` | `medium` | Required by some jurisdictions/platforms but not universally |
| AI-generation markers present (non-C2PA) | `pass` | `info` | AI documented in metadata |
| C2PA credentials present | `pass` | `info` | Verified, with generator and assertion details |
| No AI-generation markers found | `flag` | `high` | Origin cannot be verified from metadata |

Treat `flag` as "human review needed," NOT "reject outright." Surface the
`recommendation` field to the reviewer as the next step.

## Per-Jurisdiction Citations

Citations on returned checks are composed from the laws applicable to the
jurisdictions the request asked for, plus platform-policy references from the
requested platforms. The same detection carries different citations depending
on the request scope.

**Restricted-category example — alcohol detection across different scopes:**

| Request scope | `citation` on `Restricted Category: Alcohol & spirits` |
|---|---|
| `jurisdictions: ["us"]`, `platforms: []` | `27 U.S.C. § 213 (Federal Alcohol Administration Act); FTC alcohol self-regulation guides; state alcohol-board rules` |
| `jurisdictions: ["us", "uk"]`, `platforms: ["facebook", "tiktok"]` | All US+UK + `Meta Advertising Standards — Alcohol; TikTok Advertising Policies — Alcohol` |
| `jurisdictions: ["china"]`, `platforms: ["youtube"]` | `China Advertising Law Art. 23 (alcohol); SAMR enforcement; Google Ads Policies — Alcohol` |

The same pattern applies to all check types — brand logos cite trademark law, stock watermarks cite copyright law, content-safety checks cite jurisdiction-specific decency/broadcasting/advertising codes plus platform policies.

## Response

Real production response for a wine-bottle image with `jurisdictions: ["us", "uk"]`, `platforms: ["facebook", "tiktok"]`:

```json
{
  "checks": [
    {
      "id": "chk_87bdd543",
      "agentId": "rights-clearance-image",
      "checkName": "Restricted Category: Alcohol & spirits",
      "status": "block",
      "severity": "high",
      "message": "Image depicts Alcohol & spirits (detected label: liquor, 94% confidence). Restricted advertising category — alcohol marketing requires age-gating, jurisdictional licensing, and specific disclaimer language.",
      "recommendation": "Block publication or obtain explicit clearance for alcohol & spirits advertising under the cited regulations and platform policies.",
      "citation": "27 U.S.C. § 213 (Federal Alcohol Administration Act); FTC alcohol self-regulation guides; state alcohol-board rules (e.g. California ABC, NY SLA); UK CAP Code Section 18 (Alcohol); ASA enforcement; Meta Advertising Standards — Alcohol; TikTok Advertising Policies — Alcohol"
    },
    {
      "id": "chk_ae6642b7",
      "agentId": "rights-clearance-image",
      "checkName": "No C2PA Content Credentials",
      "status": "flag",
      "severity": "medium",
      "message": "Image does not contain C2PA content credentials. California SB 942 requires machine-readable AI provenance; TikTok uses C2PA for auto-detection of synthetic media; Meta auto-labels AI content via C2PA/IPTC metadata.",
      "recommendation": "Embed C2PA content credentials before publication. Use Content Authenticity Initiative tools or Adobe Content Credentials.",
      "citation": "California SB 942; TikTok Community Guidelines — Synthetic Media; Meta Transparency Center — Approach to AI-Generated Content"
    }
  ],
  "checksById": { "chk_87bdd543": { /* same */ } },
  "indexes": {
    "byStatus": { "block": ["chk_87bdd543"], "flag": ["chk_ae6642b7"] },
    "bySeverity": { "high": ["chk_87bdd543"], "medium": ["chk_ae6642b7"] }
  },
  "annotations": [],
  "decision": "BLOCK",
  "score": 35,
  "cached": false,
  "creditsCharged": 35,
  "costBreakdown": {
    "totalCredits": 35,
    "agents": [
      { "agent": "rights-clearance-image", "creditsUsed": 35, "latencyMs": 714 }
    ]
  }
}
```

Critical response fields for an LLM agent to interpret:

- `decision` — `PUBLISH` (clean) / `HOLD` (review) / `BLOCK` (do not publish). Drive your UI / action from this.
- `score` — 0-100; higher is better. Below 50 typically means `BLOCK`.
- `checks` — array of compliance findings. Surface `message` + `recommendation` to the user.
- `creditsCharged` — actual cost of this request.

The content-safety check names follow the format `"{Category} Content Detected (high confidence)"` or `"({medium confidence})"` — NOT vendor-enum strings.

## Cost

35 credits per image. Multi-image requests scale linearly (`35 × imageCount`). Tenant rate `$1 = 111 credits`, so one image ≈ $0.32.

## Error Handling

Same 403 scope-enforcement behavior as `/compliance/check` — see
[tenant-onboarding-and-scoping.md](tenant-onboarding-and-scoping.md) for the four
possible 403 messages.

## Notes

- JSON path: images must be publicly accessible URLs
- Multipart path: upload binaries directly, 1–2 per request, 4.5 MB total body
- Maximum 2 images per request on both paths (hard cap)
- Requests are scoped to the tenant's subscribed jurisdictions and platforms
- Results include `image-region` annotations with bounding boxes when the underlying detection produces one
- The restricted-categories list is admin-tunable in real time — see [restricted-categories.md](restricted-categories.md) for the full catalog
