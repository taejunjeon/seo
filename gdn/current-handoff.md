# Current Handoff

작성 시각: 2026-05-13 19:15 KST

## 현재 목표

Coffee actual status monitor cron 승인안과 TikTok campaign_id exact UTM rule 설계를 문서화한다. 실제 cron 등록과 광고 URL 변경은 승인 전 실행하지 않는다.

## 완료한 것

- Coffee cron 승인안 작성: `gdn/coffee-status-monitor-cron-approval-20260513.md`.
- Coffee cron JSON 작성: `data/project/coffee-status-monitor-cron-approval-20260513.json`.
- 제안 cron: VM Cloud `biocomkr_sns` crontab, 매일 09:20 KST, VM Cloud SQLite `imweb_orders` read-only + summary API cross-check.
- TikTok campaign_id exact UTM rule 작성: `gdn/tiktok-campaign-id-exact-utm-rule-20260513.md`.
- TikTok rule JSON 작성: `data/project/tiktok-campaign-id-exact-utm-rule-20260513.json`.
- Sprint 문서 갱신: `project/sprint1.md`, `project/sprint3.md`.

## 다음 명령

1. `node -e "const fs=require('fs'); for (const f of ['data/project/coffee-status-monitor-cron-approval-20260513.json','data/project/tiktok-campaign-id-exact-utm-rule-20260513.json','data/current-state.json','gptconfirm/gpt0508-56/manifest.json']) JSON.parse(fs.readFileSync(f,'utf8')); console.log('json parse PASS')"`
2. `python3 scripts/validate_wiki_links.py project/sprint1.md project/sprint3.md gdn/coffee-status-monitor-cron-approval-20260513.md gdn/tiktok-campaign-id-exact-utm-rule-20260513.md gptconfirm/gpt0508-56/00-result-report.md`
3. `python3 scripts/harness-preflight-check.py --strict`
4. `git diff --check`

## 절대 건드리면 안 되는 것

- Cron 실제 등록, VM Cloud crontab 변경.
- TikTok Ads Manager URL 실제 변경, TikTok 광고 ON/OFF, TikTok Ads API write.
- Google Ads/GA4/Meta/TikTok/Naver 전환 전송, upload, conversion action 변경.
- 운영DB write/import, VM Cloud SQLite write/schema migration.
- GTM publish, Imweb footer/header 변경.
- secret/raw email/phone/member_code/order/payment/click_id 출력.
