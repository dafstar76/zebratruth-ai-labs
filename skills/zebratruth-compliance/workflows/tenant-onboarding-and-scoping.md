# Tenant Onboarding and Scoping

How tenant subscriptions constrain which jurisdictions and platforms a request
can target, and how to handle the four distinct 403 responses that arise from
this scoping.

## The Model

Every compliance request is scoped to the jurisdictions and platforms the tenant
subscribed to during onboarding. Scope enforcement runs at the entry of every
compute-entering endpoint, BEFORE any credits are spent — so scope-denied 403s
are free.

**Allowed jurisdictions:** `us`, `eu`, `uk`, `india`, `china`
**Allowed platforms:** `youtube`, `instagram`, `facebook`, `tiktok`, `linkedin`

Each tenant subscribes to a subset of each during onboarding. The subset forms
their scope; requests must stay inside it.

## Request Behavior

Precedence: **request value wins if present, otherwise tenant default.**

- If a request omits `jurisdictions`, the tenant's defaults apply
- If a request omits `platforms`, the tenant's defaults apply
- If a request supplies either, each value MUST be in the subscribed set

The engine never silently expands a request to include jurisdictions or
platforms the caller didn't explicitly ask for.

```bash
# Use tenant defaults
curl -X POST https://api.zebratruth.ai/v1/compliance/check \
  -H "Authorization: Bearer $ZEBRATRUTH_API_KEY" \
  -d '{ "content": { "text": "..." }, "mode": "fast" }'

# Narrowing — subset of defaults, allowed
-d '{ "jurisdictions": ["us"], "platforms": ["youtube"], "content": { "text": "..." }, "mode": "fast" }'

# Expanding — any value outside subscription returns 403
```

## The Four 403 Responses

The `error` field carries the exact runtime message. Client code can pattern-match
on it.

### 1. Tenant not onboarded

```json
{ "error": "Tenant not onboarded. Complete setup at https://developers.zebratruth.ai before using the API." }
```

API key is valid but no tenant record exists. Direct the user to
`https://developers.zebratruth.ai` to complete the onboarding wizard.

### 2. Tenant configuration incomplete

```json
{ "error": "Tenant configuration incomplete. Set default jurisdictions and platforms in your dev portal." }
```

Tenant record exists but `defaultJurisdictions` or `defaultPlatforms` is empty.
Direct the user to `https://developers.zebratruth.ai/dashboard/settings`.

### 3. Jurisdiction not in subscription

```json
{ "error": "Requested jurisdictions [india, china] are not in your subscription. Allowed: [us, eu]." }
```

Two remediations:
- Narrow the request to drop the denied jurisdictions, OR
- Widen the subscription at `https://developers.zebratruth.ai/dashboard/settings`

### 4. Platform not in subscription

```json
{ "error": "Requested platforms [tiktok] are not in your subscription. Allowed: [youtube, instagram]." }
```

Same two remediations — narrow the request or widen the subscription.

## Endpoints That Enforce Scope

All v1 API-key endpoints enforce scope before compute starts (no credits spent
on scope-denied 403s):

- `POST /v1/compliance/check`
- `POST /v1/compliance/check-image`
- `POST /v1/agents/{agentId}`
- `POST /v1/reports/{reportId}/replay` — enforced against the caller's **current**
  subscription, not the subscription at the time of the original report. If
  access to a jurisdiction was dropped since the original run, replay returns 403.

## Test-Mode Keys

Keys starting with `zt_test_` bypass the credit system but **still go through
scope enforcement**. A test key tied to a tenant with no onboarding data will
still return 403. This keeps sandbox and production behavior consistent — do not
assume test keys skip scope checks.

## Decision Flow for Agents

When a user reports a 403:

1. Read the exact `error` message from the response body.
2. Pattern-match against the four shapes above.
3. Apply the appropriate remediation:
   - Shapes 1 & 2 → direct user to the dev portal (onboarding or settings page)
   - Shape 3 → list denied jurisdictions; offer to narrow the request OR to
     direct the user to update their subscription
   - Shape 4 → same as shape 3, but for platforms

When a user is designing a new integration, always check the tenant's current
subscription first (via `GET /whoami` to identify the tenant, then the portal
UI for specifics) before hardcoding jurisdictions or platforms into a request
template.

## Efficiency Note

Narrowing the jurisdiction list generally reduces:
- Prompt size (less law-map content injected into each agent's context)
- Response size (fewer per-jurisdiction citations on each finding)
- Credit cost (smaller context windows, faster completions)

For short content, narrowing from `["us", "eu"]` to `["us"]` measurably reduces
response size. Encourage users to request only the jurisdictions they actually
publish to.
