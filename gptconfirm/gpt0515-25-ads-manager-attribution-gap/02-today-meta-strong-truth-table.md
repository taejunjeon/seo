# Today Meta strong truth table

## Scope

- Site: biocom
- Pixel: `1283400029487161`
- Window: 2026-05-15 KST
- VM Cloud SQLite UTC window: 2026-05-14T15:00:00Z to 2026-05-15T15:00:00Z
- Query time: 2026-05-16 00:13 KST
- Source: VM Cloud `attribution_ledger` + VM Cloud `meta-capi-sends.jsonl`
- Output policy: safe_ref only, no raw order/payment/member/click id

## Summary

- Confirmed purchase: 62건 / 17,754,197원
- Meta strong evidence confirmed: 24건 / 9,157,467원
- Meta strong CAPI success: 22건 / 8,689,467원
- Meta strong CAPI missing: 2건 / 468,000원
- Ads attributed row-level status: not available from Ads API; Ads raw aggregate purchase key for the date is 0.

## Why CAPI 58 does not mean 58 Meta-attributed purchases

CAPI success means “Meta received the event.” It does not mean “Meta attributed the purchase to a Meta ad.”

Among 58 CAPI success rows:

- Strong Meta evidence success: 22건
- Non-Meta or unproven Meta success: 36건
- Non-Meta or unproven share: 62.1%

So internal Meta ROAS should not use all 58 CAPI rows as Meta ad revenue.

## Evidence distribution

- `fbclid_direct+metadata_fbc+utm_source_meta`: 12
- `metadata_fbc`: 3
- `fbp_only_weak`: 37
- `fbclid_direct+metadata_fbc+utm_source_meta+utm_medium_meta+utm_campaign_meta+utm_content_meta`: 4
- `utm_source_meta`: 1
- `fbclid_direct+metadata_fbc`: 2
- `metadata_fbc+utm_source_meta`: 2
- `none`: 1

`fbp_only_weak` is not counted as strong Meta evidence. It is useful for matching quality but not enough to call the order a Meta ad order internally.

## Truth table

| safe_ref | amount_krw | evidence_type | CAPI sent | events_received | Ads attributed |
|---|---:|---|---|---:|---|
| safe_08b46aee7195 | 234,000 | fbclid_direct+metadata_fbc+utm_source_meta | yes | 1 | not_observed_in_ads_raw_purchase_keys |
| safe_278e07e6766d | 234,000 | metadata_fbc | yes | 1 | not_observed_in_ads_raw_purchase_keys |
| safe_916686106332 | 484,500 | fbclid_direct+metadata_fbc+utm_source_meta | yes | 1 | not_observed_in_ads_raw_purchase_keys |
| safe_21d84ed7da07 | 484,500 | fbclid_direct+metadata_fbc+utm_source_meta+utm_medium_meta+utm_campaign_meta+utm_content_meta | yes | 1 | not_observed_in_ads_raw_purchase_keys |
| safe_53418b173fe8 | 234,000 | utm_source_meta | no | 0 | not_observed_in_ads_raw_purchase_keys |
| safe_30d7515bd652 | 712,500 | metadata_fbc | yes | 1 | not_observed_in_ads_raw_purchase_keys |
| safe_7c213192172b | 245,000 | fbclid_direct+metadata_fbc+utm_source_meta+utm_medium_meta+utm_campaign_meta+utm_content_meta | yes | 1 | not_observed_in_ads_raw_purchase_keys |
| safe_8288117588bf | 245,000 | fbclid_direct+metadata_fbc+utm_source_meta+utm_medium_meta+utm_campaign_meta+utm_content_meta | yes | 1 | not_observed_in_ads_raw_purchase_keys |
| safe_b0a669d8eaa9 | 234,000 | fbclid_direct+metadata_fbc+utm_source_meta | yes | 1 | not_observed_in_ads_raw_purchase_keys |
| safe_ffa9b8650da0 | 446,400 | metadata_fbc | yes | 1 | not_observed_in_ads_raw_purchase_keys |
| safe_eb2fa924d232 | 446,400 | fbclid_direct+metadata_fbc+utm_source_meta | yes | 1 | not_observed_in_ads_raw_purchase_keys |
| safe_644e0d0f5d8c | 245,000 | fbclid_direct+metadata_fbc+utm_source_meta | yes | 1 | not_observed_in_ads_raw_purchase_keys |
| safe_14bbd9e68a32 | 245,000 | fbclid_direct+metadata_fbc+utm_source_meta | yes | 1 | not_observed_in_ads_raw_purchase_keys |
| safe_8c7797c6e426 | 234,000 | fbclid_direct+metadata_fbc+utm_source_meta | no | 0 | not_observed_in_ads_raw_purchase_keys |
| safe_a4b6c29596be | 234,000 | fbclid_direct+metadata_fbc+utm_source_meta | yes | 1 | not_observed_in_ads_raw_purchase_keys |
| safe_5e9429b55d0a | 675,000 | fbclid_direct+metadata_fbc+utm_source_meta | yes | 1 | not_observed_in_ads_raw_purchase_keys |
| safe_aef68a8f4324 | 1,134,000 | fbclid_direct+metadata_fbc | yes | 1 | not_observed_in_ads_raw_purchase_keys |
| safe_b446d594b1f1 | 245,000 | metadata_fbc+utm_source_meta | yes | 1 | not_observed_in_ads_raw_purchase_keys |
| safe_883f3116da55 | 58,167 | fbclid_direct+metadata_fbc+utm_source_meta+utm_medium_meta+utm_campaign_meta+utm_content_meta | yes | 1 | not_observed_in_ads_raw_purchase_keys |
| safe_6ece95f253d5 | 459,000 | metadata_fbc+utm_source_meta | yes | 1 | not_observed_in_ads_raw_purchase_keys |
| safe_7f5cfa752bb5 | 234,000 | fbclid_direct+metadata_fbc | yes | 1 | not_observed_in_ads_raw_purchase_keys |
| safe_3c146314afb0 | 485,000 | fbclid_direct+metadata_fbc+utm_source_meta | yes | 1 | not_observed_in_ads_raw_purchase_keys |
| safe_a18bed901a3a | 234,000 | fbclid_direct+metadata_fbc+utm_source_meta | yes | 1 | not_observed_in_ads_raw_purchase_keys |
| safe_9237ce9e0738 | 675,000 | fbclid_direct+metadata_fbc+utm_source_meta | yes | 1 | not_observed_in_ads_raw_purchase_keys |

## Interpretation

The internal signal path is healthy enough to send confirmed purchases to Meta, but Ads Manager has not yet reported same-day purchase attribution for 2026-05-15.

If Ads Manager remains 0 after the next 12-24h check, the issue should be escalated from lag to Ads attribution connection investigation.
