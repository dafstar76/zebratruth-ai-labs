# Image Rights Clearance

Check images for celebrity faces, logos, watermarks, trademarks, and C2PA metadata.

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
2. **Celebrity detection** — Known public figures (AWS Rekognition)
3. **Logo / watermark detection** — Brand logos, stock photo watermarks (Google Cloud Vision)
4. **Deterministic risk aggregation** — Combines all detections into compliance checks

## Check Statuses (critical for interpretation)

Not every detection is a hard block. Map detection → status as follows:

| Detection | Status | Severity | Meaning |
|-----------|--------|----------|---------|
| Stock-agency watermark (Shutterstock, Getty, etc.) | `block` | `critical` | Hard fail — unlicensed stock imagery |
| Celebrity face | `flag` | `high` | Review: the person may be licensed / consented |
| Brand logo | `flag` | `medium` | Review: could be fair use, comparative advertising, or authorized |
| C2PA credentials missing | `flag` | `medium` | Review: required by some jurisdictions/platforms but not universally |
| AI-generation markers present (non-C2PA) | `flag` | `low` | Review: AI detected but C2PA credentials preferred |
| C2PA credentials present | `pass` | `info` | Verified, with generator and assertion details |

Treat `flag` as "human review needed," NOT "reject outright." Surface the
`recommendation` field to the reviewer as the next step.

## Per-Jurisdiction Citations

Citations on returned checks are composed from the laws applicable to the
jurisdictions the request asked for. The same detection carries different
citations depending on the jurisdiction set.

**Celebrity detection citation examples:**

| Request jurisdictions | `citation` field on the check |
|-----------------------|--------------------------------|
| `["us"]` | `Cal. Civil Code § 3344; NY Civil Rights Law §§ 50-51; Tennessee ELVIS Act` |
| `["eu"]` | `EU member-state image/personality rights (German Allgemeines Persönlichkeitsrecht, French droit à l'image)` |
| `["uk"]` | `UK passing off (common law); Trade Marks Act 1994` |
| `["us", "eu", "uk"]` | All three joined with `; ` |

The same pattern applies to brand logos (trademark law — Lanham Act / EU Trademark
Regulation / UK Trade Marks Act etc.), stock watermarks (copyright law — 17 USC
§106 / CDPA 1988 / EU DSM Directive etc.), and the regulatory notes attached to
the "No C2PA credentials" check (EU AI Act Art. 50, California SB 942, China Deep
Synthesis Provisions, MeitY Advisory 2024, etc. — only those relevant to the
jurisdictions and platforms in the request).

## Response

```json
{
  "checks": [
    {
      "agentId": "rights-clearance-image",
      "checkName": "Celebrity Detected: Taylor Swift",
      "status": "flag",
      "severity": "high",
      "message": "Image contains a recognizable likeness of Taylor Swift (confidence: 94%). Right-of-publicity laws apply in the requested jurisdictions: us, eu.",
      "recommendation": "Obtain a written talent release/license for commercial use of this person's likeness, or remove/replace the image.",
      "citation": "Cal. Civil Code § 3344; NY Civil Rights Law §§ 50-51; Tennessee ELVIS Act; EU member-state image/personality rights (German Allgemeines Persönlichkeitsrecht, French droit à l'image)"
    }
  ],
  "annotations": [
    {
      "type": "image-region",
      "agentId": "rights-clearance-image",
      "severity": "high",
      "message": "Image contains a recognizable likeness of Taylor Swift",
      "imageLocation": {
        "imageUrl": "https://example.com/ad-image.jpg",
        "boundingBox": { "x": 120, "y": 45, "width": 200, "height": 250 }
      }
    }
  ]
}
```

## Cost

~5 credits per image (Rekognition + Cloud Vision API calls).

## Error Handling

Same 403 scope-enforcement behavior as `/compliance/check` — see
[tenant-onboarding-and-scoping.md](tenant-onboarding-and-scoping.md) for the four
possible 403 messages.

## Notes

- JSON path: images must be publicly accessible URLs
- Multipart path: upload binaries directly, 1–2 per request, 4.5 MB total body
- Maximum 2 images per request on both paths (hard cap)
- Requests are scoped to the tenant's subscribed jurisdictions and platforms
- Results include `image-region` annotations with bounding boxes for detected elements
