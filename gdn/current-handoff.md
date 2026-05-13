# Current Handoff

작성 시각: 2026-05-13 21:05 KST

## 현재 목표

Coffee Imweb status sync 4회/일 + actual status monitor hourly cron이 등록됐다. 이제 48~72시간 동안 API 429, 실행 시간, summary mismatch, blank trend를 관측하고 hourly status sync 승격 여부를 판단한다.

## 완료한 것

- Coffee status sync + monitor cron 승인안 작성: `gdn/coffee-status-monitor-cron-approval-20260513.md`.
- Coffee cron JSON 작성: `data/project/coffee-status-monitor-cron-approval-20260513.json`.
- 실행 결과 문서 작성: `gdn/coffee-status-sync-cron-activation-20260513.md`, `data/project/coffee-status-sync-cron-activation-20260513.json`.
- 등록 cron: VM Cloud `biocomkr_sns` crontab, 더클린커피 Imweb status sync KST 03:10/09:10/15:10/21:10. VM Cloud 서버 UTC 기준으로는 `10 0,6,12,18 * * *`.
- 등록 monitor: read-only monitor 매시간 40분.
- 핵심 판단: 하루 1회 monitor는 status blank를 관측만 하고 줄이지 못한다. status blank를 줄이려면 VM Cloud SQLite `imweb_orders.imweb_status`/`imweb_status_synced_at` 보강 sync가 필요하다.
- one-shot 결과: status blank 32건 / 1,983,600원 -> 2건 / 68,700원, status sync lag 29.63h -> 0.01h.
- TikTok campaign_id exact UTM rule 작성: `gdn/tiktok-campaign-id-exact-utm-rule-20260513.md`.
- TikTok rule JSON 작성: `data/project/tiktok-campaign-id-exact-utm-rule-20260513.json`.
- Sprint 문서 갱신: `project/sprint1.md`, `project/sprint3.md`.

## 다음 명령

1. `node -e "const fs=require('fs'); for (const f of ['data/project/coffee-status-monitor-cron-approval-20260513.json','data/project/coffee-status-sync-cron-activation-20260513.json','data/project/tiktok-campaign-id-exact-utm-rule-20260513.json','data/current-state.json','gptconfirm/gpt0508-57/manifest.json']) JSON.parse(fs.readFileSync(f,'utf8')); console.log('json parse PASS')"`
2. `python3 scripts/validate_wiki_links.py project/sprint1.md project/sprint3.md gdn/coffee-status-monitor-cron-approval-20260513.md gdn/coffee-status-sync-cron-activation-20260513.md gdn/tiktok-campaign-id-exact-utm-rule-20260513.md gptconfirm/gpt0508-57/00-result-report.md`
3. `python3 scripts/harness-preflight-check.py --strict`
4. `git diff --check`

## 절대 건드리면 안 되는 것

- 등록 범위 밖의 Cron 변경, VM Cloud crontab 추가 변경, hourly status sync 승격.
- TikTok Ads Manager URL 실제 변경, TikTok 광고 ON/OFF, TikTok Ads API write.
- Google Ads/GA4/Meta/TikTok/Naver 전환 전송, upload, conversion action 변경.
- 운영DB write/import, VM Cloud SQLite schema migration. 등록된 coffee status sync 범위 밖의 VM Cloud SQLite write 금지.
- GTM publish, Imweb footer/header 변경.
- secret/raw email/phone/member_code/order/payment/click_id 출력.
