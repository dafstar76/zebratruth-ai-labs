# Image Rights Clearance

Check images for celebrity faces, logos, watermarks, trademarks, and C2PA metadata.

## Endpoint

```
POST https://api.zebratruth.com/v1/compliance/check-image
Authorization: Bearer {api_key}
Content-Type: application/json
Idempotency-Key: {uuid}

{
  "imageUrls": ["https://example.com/ad-image.jpg"],
  "jurisdictions": ["us"],
  "platforms": ["instagram"]
}
```

## What It Checks

1. **C2PA / IPTC metadata** — Content Credentials, provenance, AI generation markers
2. **Celebrity detection** — Known public figures (AWS Rekognition)
3. **Logo / watermark detection** — Brand logos, stock photo watermarks (Google Cloud Vision)
4. **Deterministic risk aggregation** — Combines all detections into compliance checks

## Response

```json
{
  "checks": [
    {
      "agentId": "rights-clearance-image",
      "checkName": "celebrity-detected",
      "status": "flag",
      "severity": "high",
      "message": "Possible public figure detected in image",
      "recommendation": "Obtain likeness rights or replace the image"
    }
  ],
  "annotations": [
    {
      "type": "image-region",
      "agentId": "rights-clearance-image",
      "severity": "high",
      "message": "Possible public figure detected",
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

## Notes

- Images must be publicly accessible URLs
- Maximum 2 images per request (hard cap)
- Results include `image-region` annotations with bounding boxes for detected elements
