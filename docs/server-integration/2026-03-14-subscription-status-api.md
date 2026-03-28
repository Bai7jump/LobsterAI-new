# Subscription Status API Integration Guide

**Date:** 2026-03-14
**Affects:** LobsterAI Electron client (JWT auth)

## Change Summary

The server now enforces subscription-aware quota checking. Two key changes affect the Electron client:

1. `GET /api/subscription` — new endpoint returning the user's plan and remaining credits.
2. `GET /api/user/quota` — updated response with subscription fields.
3. New error codes returned by `POST /api/proxy/chat/completions` when quota is exhausted or the model is not accessible on the user's plan.

All Electron endpoints use JWT Bearer auth (`Authorization: Bearer <accessToken>`).

---

## Response Envelope

```json
{ "code": 0, "message": "success", "data": { ... } }
```

On error:

```json
{ "code": <errorCode>, "message": "<description>", "data": null }
```

---

## Endpoints

### 1. `GET /api/subscription` — Subscription Status (JWT Bearer)

Returns current plan and credits balance.

**Headers:**

```
Authorization: Bearer <accessToken>
```

**Response `data` — free user:**

```json
{
  "planName": "免费",
  "planId": null,
  "subscriptionStatus": "free",
  "freeCreditsTotal": 300,
  "freeCreditsUsed": 47,
  "freeCreditsRemaining": 253
}
```

**Response `data` — paid subscriber:**

```json
{
  "planName": "Pro",
  "planId": 2,
  "subscriptionStatus": "active",
  "currentPeriodStart": "2026-03-01",
  "currentPeriodEnd": "2026-04-01",
  "autoRenew": false,
  "monthlyCreditsLimit": 10000,
  "monthlyCreditsUsed": 1234,
  "monthlyCreditsRemaining": 8766
}
```

`subscriptionStatus` values: `"free"`, `"active"`, `"canceled"`, `"expired"`, `"suspended"`

---

### 2. `GET /api/user/quota` — Updated Quota (JWT Bearer)

Existing endpoint, now returns subscription-aware fields.

**Headers:**

```
Authorization: Bearer <accessToken>
```

**Free user response `data`:**

```json
{
  "planName": "免费",
  "subscriptionStatus": "free",
  "freeCreditsTotal": 300,
  "freeCreditsUsed": 47,
  "freeCreditsRemaining": 253,
  "dailyCreditsUsed": 12
}
```

**Paid subscriber response `data`:**

```json
{
  "planName": "Pro",
  "subscriptionStatus": "active",
  "monthlyCreditsLimit": 10000,
  "monthlyCreditsUsed": 1234,
  "monthlyCreditsRemaining": 8766
}
```

Note: paid users do not have daily limits; `dailyCreditsUsed` only appears for free users.

---

## New Error Codes from Proxy Endpoint

`POST /api/proxy/chat/completions` may now return these errors (previously only `QUOTA_EXCEEDED` with code `40200`):

| code | constant | message | when |
|------|---------|---------|------|
| 40201 | FREE_QUOTA_EXCEEDED | 免费额度已用完，请升级套餐 | Free user has consumed all 300 lifetime free credits |
| 40202 | MONTHLY_QUOTA_EXCEEDED | 本月积分已用完 | Paid user exhausted this month's credit allocation |
| 40301 | MODEL_ACCESS_DENIED | 当前套餐不支持该模型，请升级套餐 | User's plan does not include access to the requested model |

These errors are returned as HTTP-level errors (non-200), not as SSE events. The proxy responds with the standard error envelope before streaming begins.

### Handling in the Electron client

- **40201 / 40202**: Show "额度已用完" notice with a link to the upgrade page (portal subscription URL).
- **40301**: Show "当前套餐不支持该模型" notice and suggest downgrading to a supported model or upgrading.

### Legacy error code

The old `QUOTA_EXCEEDED (40200)` is kept for backward compatibility but is no longer the primary quota error. Clients should handle all three codes (40200, 40201, 40202) as "quota exhausted" scenarios.

---

## Full Error Code Reference (subscription-related)

| code | constant | message |
|------|---------|---------|
| 40200 | QUOTA_EXCEEDED | 今日免费额度已用完 (legacy) |
| 40201 | FREE_QUOTA_EXCEEDED | 免费额度已用完，请升级套餐 |
| 40202 | MONTHLY_QUOTA_EXCEEDED | 本月积分已用完 |
| 40301 | MODEL_ACCESS_DENIED | 当前套餐不支持该模型，请升级套餐 |

---

## Frontend Action Items

1. **Credits display in UI:** Call `GET /api/subscription` on app startup and after each session to display remaining credits. Branch on `subscriptionStatus == "free"` vs. paid since response shape differs.
2. **Error handling in chat:** Add handlers for error codes `40201`, `40202`, and `40301` in the proxy response handler. These were previously not returned.
3. **Upgrade prompt:** When `40201` or `40202` is received, show a toast/dialog prompting the user to open the web portal to upgrade. The portal URL is where users manage subscriptions.
4. **Model selection:** When `40301` is received, prompt user to select a different model or upgrade plan.
5. **Token refresh:** No changes to JWT token exchange/refresh flow. Auth endpoint behavior is unchanged.

---

## Auth Requirements

All endpoints use JWT Bearer token:

```
Authorization: Bearer <accessToken>
```

Access tokens expire after 2 hours. Use the existing `POST /api/auth/refresh` flow with `refreshToken` to renew.

---

## Notes & Caveats

- Subscription management (purchasing, canceling) is done through the web portal, not the Electron client directly.
- The credit model has changed: free users have a **lifetime** cap of 300 credits (not per-day). Paid users have a **monthly** cap reset each calendar month.
- The `currentPeriodEnd` date indicates when the current subscription period expires. After expiry, the server downgrades the user to free tier behavior.
- `autoRenew: false` means the user has canceled auto-renewal but is still active until `currentPeriodEnd`.
