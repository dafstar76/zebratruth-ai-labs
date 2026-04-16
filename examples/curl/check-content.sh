#!/bin/bash
# ZebraTruth Compliance Check — cURL example
# Usage: ZEBRATRUTH_API_KEY=zt_live_... ./check-content.sh

API_KEY="${ZEBRATRUTH_API_KEY:?Set ZEBRATRUTH_API_KEY environment variable}"
API_BASE="https://api.zebratruth.ai/v1"

echo "=== Step 1: Validate API key ==="
curl -s "$API_BASE/whoami" \
  -H "Authorization: Bearer $API_KEY" | jq .

echo ""
echo "=== Step 2: Check credits ==="
curl -s "$API_BASE/usage" \
  -H "Authorization: Bearer $API_KEY" | jq .

echo ""
echo "=== Step 3: Run compliance check ==="
curl -s -X POST "$API_BASE/compliance/check" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || python3 -c 'import uuid; print(uuid.uuid4())')" \
  -d '{
    "jurisdictions": ["us", "eu"],
    "platforms": ["youtube", "instagram"],
    "content": {
      "text": "Try our amazing new product! Guaranteed to make you lose 10 pounds in just 3 days. Celebrity-endorsed by top influencers. Results proven by clinical studies."
    },
    "mode": "fast",
    "responseMode": "sync"
  }' | jq .
