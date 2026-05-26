# Restricted Categories

The `/v1/compliance/check-image` endpoint detects image content belonging to six advertising-restricted categories and emits a dedicated compliance check for each match. Each check carries jurisdiction-aware regulatory citations and platform-policy references filtered to the request scope.

## When a check fires

Detected image content (objects/scenes) is matched against each category's `matchLabels` (case-insensitive exact-word equality):

- Multiple labels matching the **same category** → **one** check, using the highest-confidence label in the message
- Labels below 50% confidence are ignored (noise filter)
- Exact-word only: `"alcohol"` matches `"Alcohol"` but does NOT match `"non-alcoholic"`

## The six categories

| Category | Severity | Status | Match labels |
|---|---|---|---|
| **Alcohol & spirits** | `high` | `block` | alcohol, wine, beer, whiskey, spirits, champagne, cocktail, vodka, rum, liquor |
| **Weapons & firearms** | `high` | `block` | firearm, weapon, gun, rifle, pistol, ammunition, bullet, knife |
| **Tobacco & smoking products** | `high` | `block` | tobacco, cigarette, cigar, vape, e-cigarette, smoking, smoker |
| **Gambling** | `high` | `block` | casino, gambling, slot machine, poker chip, roulette, lottery, betting |
| **Pharmaceutical & prescription drugs** | `medium` | `flag` | medicine, pill, pharmacy, drug, pharmaceutical, prescription, capsule |
| **Financial products (incl. crypto, forex, investments)** | `medium` | `flag` | bitcoin, cryptocurrency, currency, investment, trading, stock market, forex, banking, loan, crypto, coin |

`high`-severity → hard `block`. `medium`-severity → `flag` (review required; typically allowed with substantiation and disclosure).

## Citation matrix

Citations on emitted checks come from per-jurisdiction maps (US / EU / UK / China / India) plus per-platform maps (Facebook, Instagram, TikTok, YouTube). Only those matching the request scope are included.

See the full citation matrix in [docs.zebratruth.ai/guides/restricted-categories](https://docs.zebratruth.ai/guides/restricted-categories) — the public guide enumerates each category × jurisdiction × platform combination.

## Example response check

Wine-bottle image checked with `jurisdictions: ["us", "uk"]`, `platforms: ["facebook", "tiktok"]`:

```json
{
  "id": "chk_87bdd543",
  "agentId": "rights-clearance-image",
  "checkName": "Restricted Category: Alcohol & spirits",
  "status": "block",
  "severity": "high",
  "message": "Image depicts Alcohol & spirits (detected label: liquor, 94% confidence). Restricted advertising category — alcohol marketing requires age-gating, jurisdictional licensing, and specific disclaimer language.",
  "recommendation": "Block publication or obtain explicit clearance for alcohol & spirits advertising under the cited regulations and platform policies.",
  "citation": "27 U.S.C. § 213 (Federal Alcohol Administration Act); FTC alcohol self-regulation guides; state alcohol-board rules (e.g. California ABC, NY SLA); UK CAP Code Section 18 (Alcohol); ASA enforcement; Meta Advertising Standards — Alcohol; TikTok Advertising Policies — Alcohol"
}
```

Message template interpolation:
- `{{category}}` → categoryName (e.g. "Alcohol & spirits")
- `{{label}}` → matched label, lower-cased (e.g. "liquor")
- `{{confidence}}` → integer 0–100

## Extensibility

The category list, match labels, severity, message template, and citation maps are **admin-tunable in real time** — stored in Azure Storage, edited without a code deploy. Changes propagate within 60 seconds. To request:

- New categories (e.g. supplements, CBD, political content)
- Adjustments to existing match labels
- Per-tenant severity overrides

Contact the account team — these are admin-side edits, not API operations.

## Related workflows

- [image-rights-clearance.md](image-rights-clearance.md) — the parent endpoint
- [interpreting-reports.md](interpreting-reports.md) — `decision`, `score`, `severity` semantics
- [tenant-onboarding-and-scoping.md](tenant-onboarding-and-scoping.md) — how `jurisdictions` and `platforms` filter citations
