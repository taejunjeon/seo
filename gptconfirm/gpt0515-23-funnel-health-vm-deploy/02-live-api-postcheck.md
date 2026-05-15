# 02. Live API Post-check

## Health

`GET https://att.ainativeos.net/health`

```json
{
  "status": "ok",
  "service": "biocom-seo-backend",
  "capiAutoSync": {
    "enabled": true,
    "intervalMs": 1800000,
    "limit": 100
  }
}
```

## Funnel-health Post Snapshot

### Biocom

```json
{
  "site": "biocom",
  "capi_success": 351,
  "capi_7d": 351,
  "pixel_ids": ["1283400029487161"],
  "all_sites_mode": false,
  "metric_contract": true,
  "metric_pixel": "1283400029487161"
}
```

UTM CAPI distribution:
- meta: 122
- google: 8
- naver: 44
- organic: 103
- utm_present: 74

CAPI attribution join:
- strong_meta_ad_evidence: 149 / 42.5%
- non_meta_or_unproven_meta: 202 / 57.5%
- no_ledger_match: 0

### TheCleanCoffee

```json
{
  "site": "thecleancoffee",
  "capi_success": 311,
  "capi_7d": 311,
  "pixel_ids": ["1186437633687388"],
  "all_sites_mode": false,
  "metric_contract": true,
  "metric_pixel": "1186437633687388"
}
```

CAPI attribution join:
- strong_meta_ad_evidence: 37 / 11.9%
- non_meta_or_unproven_meta: 274 / 88.1%
- no_ledger_match: 0

### All Sites

```json
{
  "site": "all_sites",
  "capi_success": 662,
  "capi_7d": 662,
  "pixel_ids": [],
  "all_sites_mode": true,
  "metric_contract": true,
  "metric_pixel": null
}
```

## Verdict

The live API now separates site/pixel CAPI success correctly.

Before:
- biocom = 662
- thecleancoffee = 662
- all_sites routed as biocom = 662

After:
- biocom = 351
- thecleancoffee = 311
- all_sites = 662
