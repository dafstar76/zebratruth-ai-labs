/**
 * ZebraTruth Compliance Check — Node.js example
 * Usage: ZEBRATRUTH_API_KEY=zt_live_... node check-content.mjs
 */

const API_KEY = process.env.ZEBRATRUTH_API_KEY;
if (!API_KEY) {
  console.error("Set ZEBRATRUTH_API_KEY environment variable");
  process.exit(1);
}

const API_BASE = "https://api.zebratruth.ai/v1";

async function main() {
  // Step 1: Validate key
  console.log("=== Validating API key ===");
  const whoami = await fetch(`${API_BASE}/whoami`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  }).then((r) => r.json());
  console.log(whoami);

  // Step 2: Check credits
  console.log("\n=== Checking credits ===");
  const usage = await fetch(`${API_BASE}/usage`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  }).then((r) => r.json());
  console.log(`Credits remaining: ${usage.creditsRemaining}/${usage.creditsTotal}`);

  // Step 3: Run compliance check
  console.log("\n=== Running compliance check ===");
  const result = await fetch(`${API_BASE}/compliance/check`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      jurisdictions: ["us", "eu"],
      platforms: ["youtube", "instagram"],
      content: {
        text: "Try our amazing new product! Guaranteed to make you lose 10 pounds in just 3 days. Celebrity-endorsed by top influencers.",
      },
      mode: "fast",
      responseMode: "sync",
    }),
  }).then((r) => r.json());

  // Step 4: Display results
  console.log(`\nScore: ${result.score}/100`);
  console.log(`Decision: ${result.decision}`);
  console.log(`Credits used: ${result.costBreakdown?.totalCredits}`);

  if (result.annotations?.length) {
    console.log(`\n=== Annotations (${result.annotations.length}) ===`);
    for (const ann of result.annotations) {
      console.log(`  [${ann.severity.toUpperCase()}] ${ann.message}`);
      if (ann.suggestion) console.log(`    Fix: ${ann.suggestion}`);
      if (ann.textLocation) {
        console.log(
          `    Location: "${ann.textLocation.matchedText}" (chars ${ann.textLocation.start}-${ann.textLocation.end})`
        );
      }
    }
  }

  if (result.checks?.length) {
    console.log(`\n=== Checks (${result.checks.length}) ===`);
    for (const check of result.checks) {
      const icon = check.status === "pass" ? "✓" : check.status === "block" ? "✗" : "!";
      console.log(`  ${icon} [${check.agentId}] ${check.message}`);
    }
  }
}

main().catch(console.error);
