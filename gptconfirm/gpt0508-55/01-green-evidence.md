# Green Evidence

작성 시각: 2026-05-13 19:12 KST

## Sprint 1 — Coffee Actual Monitor

- source: VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3` `imweb_orders`.
- window: rolling last_30d, checked 2026-05-13 18:48:54 KST.
- actual: 315건 / 15,477,100원.
- status blank: 32건 / 1,983,600원.
- max order time: `2026-05-13T08:25:11.000Z`.
- max order sync: `2026-05-13 09:35:27`.
- max status sync: `2026-05-12 04:11:07`.
- lag: 29.63h.
- output: `data/project/coffee-actual-status-monitor-latest-20260513.json`.

## Sprint 2 — ROAS Gap Refresh

- source: VM Cloud Google Ads dashboard API read-only.
- last_7d:
  - Google Ads 주장 ROAS: 10.5868.
  - 내부 current ROAS: 0.4059.
  - biocom NPay actual 반영 내부 ROAS: 3.5998.
  - 남은 gap: 6.9870p.
- last_30d:
  - Google Ads 주장 ROAS: 10.2789.
  - 내부 current ROAS: 0.2924.
  - biocom NPay actual 반영 내부 ROAS: 2.0792.
  - 남은 gap: 8.1997p.
- coffee policy: `reference_only_until_campaign_site_spend_mapping_exists`.
- outputs:
  - `data/project/google-ads-dashboard-last7d-latest-20260513.json`
  - `data/project/google-ads-dashboard-last30d-latest-20260513.json`
  - `data/project/google-ads-option3-red-packet-refresh-20260513.json`
  - `data/project/google-ads-campaign-site-mapping-readiness-20260513.json`

## Sprint 3 — Channel Funnel And TikTok Join

- GA4 source: BigQuery `project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill.events_*` + `project-dadba7dd-0229-4ff6-81c.analytics_304759974.events_*`.
- latest 7d window: 2026-05-06~2026-05-12, sessions 59,481, paid_tiktok sessions 10,575, GA4 purchase events 398, coverage PASS.
- latest 14d window: 2026-04-29~2026-05-12, sessions 116,852, paid_tiktok sessions 28,806, GA4 purchase events 853, coverage PASS.
- latest 30d window: 2026-04-13~2026-05-12, sessions 347,663, paid_tiktok sessions 152,673, GA4 purchase events 3,478, coverage PASS.
- TikTok source: local `data/ads_csv/tiktok/processed/20260507_20260512_daily_campaign.csv`.
- TikTok export window: 2026-05-07~2026-05-12.
- TikTok Ads spend/click: 140,850원 / 5,754 clicks.
- TikTok platform purchase: 0원.
- GA4 paid_tiktok in same window: 5,581 sessions, scroll90 1.59%, avg engagement 0.61s, GA4 purchase 1건 / 225,300원.
- verdict: `paid_tiktok_quality_risk_persists_with_join_gap`.
- outputs:
  - `data/project/channel-funnel-7_14_30d-latest-20260513.json`
  - `data/project/channel-funnel-quality-tiktok-export-window-20260513.json`
  - `data/project/tiktok-spend-quality-join-20260513.json`

## Invariants

- platform send/upload: 0.
- Google Ads conversion action mutate: 0.
- TikTok campaign/budget mutate: 0.
- 운영DB write/import: 0.
- VM Cloud SQLite write/schema migration: 0.
- GTM publish: 0.
- Imweb footer/header change: 0.
- raw email/phone/member_code/order/payment/click_id output: 0.
