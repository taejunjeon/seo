# Ads Manager action raw breakdown

## Scope

- Account: `act_3138805896402376`
- Pixel: `1283400029487161`
- Date: `2026-05-15`
- Query time: 2026-05-16 00:16 KST
- Source: Meta Graph API read-only insights
- Action report time: `conversion`
- Levels queried: account, campaign, adset
- Windows queried: unified attribution setting, `1d_click`, `7d_click`, `1d_view`
- Confidence: medium_high

## Finding

Ads Manager raw action response has **no purchase-family action key** for 2026-05-15.

Checked keys include:

- `purchase`
- `offsite_conversion.fb_pixel_purchase`
- `omni_purchase`
- `web_purchase`
- `onsite_conversion.purchase`
- any action key containing `purchase`

Result: all 0 / absent at account, campaign, and adset level.

## Account-level raw snapshot

Unified attribution setting:

- Spend: 3,499,143원
- `purchaseActionKeys`: none
- `purchaseValueKeys`: none
- `purchase_roas` rows: 0
- `website_purchase_roas` rows: 0

Top non-purchase actions:

- `page_engagement`: 32,320
- `post_engagement`: 32,320
- `video_view`: 26,938
- `offsite_conversion.custom.988739515903328`: 6,410
- `link_click`: 5,103
- `landing_page_view`: 3,192
- `view_content` / `offsite_conversion.fb_pixel_view_content`: 1,051

Top non-purchase action values:

- `offsite_conversion.fb_pixel_view_content`: 244,000,503원
- `view_content`: 244,000,503원
- `offsite_conversion.custom.988739515903328`: 240,757,972원
- `initiate_checkout` / related keys: 117,000원

## Attribution-window comparison

Account, campaign, and adset level all show the same purchase result:

- unified attribution setting: purchase key absent
- `1d_click`: purchase key absent
- `7d_click`: purchase key absent
- `1d_view`: purchase key absent

This means the current 0 is **not explained by checking only the wrong purchase action key**.

## What the custom event means

`offsite_conversion.custom.988739515903328` is visible and large, but it should not be treated as confirmed purchase.

Reasons:

- Its count is 6,410, far larger than confirmed orders.
- Its value is close to ViewContent action value scale.
- Meta raw response still has no purchase ROAS rows.
- It is not one of the purchase-family action keys.

Conclusion: the custom event may be a configured custom conversion or funnel event, but it is **not currently usable as Ads Manager Purchase** without UI-level definition verification.

## Last-7d cross-check

`/api/meta/insights?account_id=act_3138805896402376&date_preset=last_7d&level=account` returned:

- purchase: 184
- purchase value: 48,403,247원
- spend: 28,670,944원
- purchase ROAS: 1.688

This proves the account is not completely disconnected from purchase attribution historically. The current issue is concentrated on the 2026-05-15 day-level view.

## Interpretation

Current evidence supports:

- Same-day attribution lag likely.
- Strong CAPI events have not yet become Ads Manager attributed purchases for 2026-05-15.
- Action-key mismatch is not proven because no alternate purchase-family key is present.

Current evidence does not support:

- “Purchase is hidden under another purchase key.”
- “Campaigns are generally optimized to the wrong event.”
- “CAPI failed to reach Meta.”
