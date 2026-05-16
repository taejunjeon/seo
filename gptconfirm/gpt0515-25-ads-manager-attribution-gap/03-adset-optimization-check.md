# Campaign/adset optimization check

## Scope

- Account: `act_3138805896402376`
- Date context: 2026-05-15 issue investigation
- Source: Meta campaign health API and Meta adset read-only attempt
- Query time: 2026-05-16 00:16 KST
- Confidence: medium

## API result

Direct adset listing hit Meta rate limit:

- Error code: 17
- Subcode: 2446079
- Meaning: too many API calls for the ad account

This blocks a full direct adset dump in this turn.

## Cross-check via campaign health endpoint

`/api/meta/campaigns/health?account_id=act_3138805896402376` succeeded.

Observed active/major campaign tracking:

- Pixel: `1283400029487161`
- Main tracking type: `pixel_purchase`
- Main custom event type: `PURCHASE`
- Main optimization goal: `VALUE`
- Objective: `OUTCOME_SALES`

Examples from the health endpoint:

- `meta_biocom_influencer_260506`: ACTIVE, `VALUE`, `PURCHASE`, pixel `1283400029487161`
- `meta_biocom_acid_260504`: ACTIVE, `VALUE`, `PURCHASE`, pixel `1283400029487161`
- `meta_biocom_igg_260504`: ACTIVE, `VALUE`, `PURCHASE`, pixel `1283400029487161`
- `공동구매 인플루언서 파트너 광고 모음_3 (260323)`: ACTIVE, `VALUE`, `PURCHASE`, pixel `1283400029487161`
- `[바이오컴] 종합대사기능검사 전환캠페인(11/4~) - 사본`: ACTIVE, `VALUE`, `PURCHASE`, pixel `1283400029487161`

One paused or checkout-focused row exists:

- `meta_biocom_igg_checkout`: PAUSED, `OFFSITE_CONVERSIONS`, custom event type `INITIATED_CHECKOUT`

## Conclusion

Campaign/adset optimization is **not the primary explanation** for 2026-05-15 Ads Manager purchase 0.

The main active sales campaigns appear to optimize toward Purchase/Value on the expected biocom Pixel. The direct adset API rate limit prevents 100% confirmation, so this remains `medium` confidence rather than `high`.

## Follow-up

If 2026-05-15 Ads purchase remains 0 after the next check, rerun direct adset listing after rate limit cool-down and verify:

- adset `optimization_goal`
- `promoted_object.pixel_id`
- `promoted_object.custom_event_type`
- campaign objective/status
- any custom goal that excludes Purchase
