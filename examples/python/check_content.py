"""
ZebraTruth Compliance Check — Python example
Usage: ZEBRATRUTH_API_KEY=zt_live_... python check_content.py
"""

import os
import uuid
import json
import requests

API_KEY = os.environ.get("ZEBRATRUTH_API_KEY")
if not API_KEY:
    raise SystemExit("Set ZEBRATRUTH_API_KEY environment variable")

API_BASE = "https://api.zebratruth.com/v1"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}


def main():
    # Step 1: Validate key
    print("=== Validating API key ===")
    whoami = requests.get(f"{API_BASE}/whoami", headers=HEADERS).json()
    print(json.dumps(whoami, indent=2))

    # Step 2: Check credits
    print("\n=== Checking credits ===")
    usage = requests.get(f"{API_BASE}/usage", headers=HEADERS).json()
    print(f"Credits remaining: {usage['creditsRemaining']}/{usage['creditsTotal']}")

    # Step 3: Run compliance check
    print("\n=== Running compliance check ===")
    result = requests.post(
        f"{API_BASE}/compliance/check",
        headers={**HEADERS, "Idempotency-Key": str(uuid.uuid4())},
        json={
            "jurisdictions": ["us", "eu"],
            "platforms": ["youtube", "instagram"],
            "content": {
                "text": (
                    "Try our amazing new product! Guaranteed to make you lose "
                    "10 pounds in just 3 days. Celebrity-endorsed by top influencers."
                ),
            },
            "mode": "fast",
            "responseMode": "sync",
        },
    ).json()

    # Step 4: Display results
    print(f"\nScore: {result['score']}/100")
    print(f"Decision: {result['decision']}")
    print(f"Credits used: {result.get('costBreakdown', {}).get('totalCredits', 'N/A')}")

    annotations = result.get("annotations", [])
    if annotations:
        print(f"\n=== Annotations ({len(annotations)}) ===")
        for ann in annotations:
            print(f"  [{ann['severity'].upper()}] {ann['message']}")
            if ann.get("suggestion"):
                print(f"    Fix: {ann['suggestion']}")
            loc = ann.get("textLocation")
            if loc:
                print(f"    Location: \"{loc['matchedText']}\" (chars {loc['start']}-{loc['end']})")

    checks = result.get("checks", [])
    if checks:
        print(f"\n=== Checks ({len(checks)}) ===")
        for check in checks:
            icon = {"pass": "✓", "block": "✗"}.get(check["status"], "!")
            print(f"  {icon} [{check['agentId']}] {check['message']}")


if __name__ == "__main__":
    main()
