# Current Handoff

작성 시각: 2026-05-13 19:10 KST

## 현재 목표

`project/sprint1.md`, `project/sprint2.md`, `project/sprint3.md`에서 Codex가 Green Lane으로 더 진행 가능한 조사/설계를 반영한다. 운영 변경 없이 coffee monitor, ROAS gap, TikTok funnel/spend-quality evidence를 최신화한다.

## 완료한 것

- Sprint 1: VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3` `imweb_orders` coffee monitor read-only 재실행. coffee actual 315건 / 15,477,100원, status blank 32건 / 1,983,600원, status sync lag 29.63h.
- Sprint 2: VM Cloud Google Ads dashboard API read-only 최신화. last_30d Google Ads 주장 ROAS 10.2789, 내부 current ROAS 0.2924, biocom NPay 반영 내부 ROAS 2.0792, 남은 gap 8.1997p.
- Sprint 2: campaign/site spend mapping 점검. Google Ads last_30d campaign list에 `thecleancoffee` 전용 spend marker가 없어 coffee actual은 budget ROAS가 아니라 reference_only 유지.
- Sprint 3: GA4 BigQuery archive+daily union latest 7/14/30 rerun PASS. TikTok export window 2026-05-07~2026-05-12 spend-quality semantic join dry-run 완료.
- Sprint 3 판정: `paid_tiktok_quality_risk_persists_with_join_gap`. 예산 변경은 HOLD, exact campaign_id UTM rule 설계가 다음 단계.

## 다음 명령

1. `node -e "const fs=require('fs'); for (const f of ['data/project/coffee-actual-status-monitor-latest-20260513.json','data/project/google-ads-option3-red-packet-refresh-20260513.json','data/project/google-ads-campaign-site-mapping-readiness-20260513.json','data/project/channel-funnel-7_14_30d-latest-20260513.json','data/project/channel-funnel-quality-tiktok-export-window-20260513.json','data/project/tiktok-spend-quality-join-20260513.json']) JSON.parse(fs.readFileSync(f,'utf8')); console.log('json parse PASS')"`
2. `python3 scripts/validate_wiki_links.py project/sprint1.md project/sprint2.md project/sprint3.md gdn/current-handoff.md`
3. `python3 scripts/harness-preflight-check.py --strict`
4. `git diff --check`

## 절대 건드리면 안 되는 것

- Google Ads/GA4/Meta/TikTok/Naver 전환 전송, upload, conversion action 변경.
- TikTok 광고 ON/OFF 변경, TikTok Ads API write, TikTok Events API send.
- 운영DB write/import, VM Cloud SQLite write/schema migration.
- GTM publish, Imweb footer/header 변경.
- secret/raw email/phone/member_code/order/payment/click_id 출력.
