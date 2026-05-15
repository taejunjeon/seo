# 04. Frontend Contract Live

## Live Fields Now Available

The live API now returns:

- `metric_contract`
- `meta_capi_breakdown.capi_site_filter.site`
- `meta_capi_breakdown.capi_site_filter.pixel_ids`
- `meta_capi_breakdown.capi_site_filter.all_sites_mode`
- `capi_attribution_join.breakdown[].bucket=strong_meta_ad_evidence`
- `capi_attribution_join.breakdown[].bucket=non_meta_or_unproven_meta`
- `capi_attribution_join.breakdown[].bucket=no_ledger_match`

## Claude Frontend Can Proceed

Claude Code can now implement the frontend against live API, not just mock/local contract.

Recommended UI:

1. Site tab
   - Biocom
   - TheCleanCoffee
   - All sites

2. CAPI health card
   - Show `pixel_id`
   - Show `last_1h`, `today`, `last_7d`
   - Distinguish `attempted`, `success`, `failed`

3. Meta evidence quality card
   - strong Meta evidence
   - non-Meta or unproven Meta
   - caveat: fbp alone is not Meta ad attribution

4. Missing queue card
   - live API queue count
   - strict triage note
   - backfill_ready vs legacy_missing_payment_key

5. Ads Manager lag card
   - today purchase/value/ROAS
   - last_7d purchase/value/ROAS
   - `same_day_lag_possible=true` when today purchase is 0 while CAPI is active

## Today Attribution Monitor

Meta Ads Insights:

```json
{
  "today": {
    "purchase": 0,
    "purchase_value_krw": 0,
    "spend_krw": 2501482,
    "same_day_lag_possible": true
  },
  "last_7d": {
    "purchase": 219,
    "purchase_value_krw": 58123707,
    "spend_krw": 28956769
  }
}
```

If today remains 0 after 12-24h, escalate from same-day lag to Ads attribution connection issue.
