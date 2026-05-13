# Current Handoff

작성 시각: 2026-05-13 18:10 KST

## 현재 목표

TikTok OFF 전후 매출 영향 화면에서 “공동구매 때문에 줄어든 매출”을 광고 채널 매출과 섞지 않고 별도 보정 라인으로 보여준다.

## 완료한 것

- VM Cloud frontend/backend 배포 및 `seo-backend`, `seo-frontend` restart 완료.
- live URL 200 확인: `https://biocom.ainativeos.net/ads/tiktok/off-impact`.
- live API 확인: `https://att.ainativeos.net/api/ads/tiktok/off-impact-audit`.
- 공동구매 보정 source: 운영DB `public.tb_influencer_group_buy_customer` read-only.
- 매출 원장 source: VM Cloud SQLite `attribution_ledger` read-only.
- 핵심값: 전체 일평균 매출 -2,876,049원, 공동구매 일평균 -2,765,951원, 공동구매 설명 비중 96.17%, 공동구매 제외 후 -110,098원.
- 공동구매 상세 API도 운영DB 보조 필드 추가: `/api/ads/coop-order-summary`.
- live browser smoke PASS, raw identifier 노출 없음, no-send/no-write/no-publish PASS.

## 다음 명령

1. `curl -sS -m 30 'https://att.ainativeos.net/api/ads/tiktok/off-impact-audit' | jq '{ok, overall:.overall.deltaRevenuePerDay, coop:.coop_adjustment.deltaIncludedAmountPerDay, share:.coop_adjustment.shareOfObservedDropPct, non_coop:.coop_adjustment.nonCoopDeltaRevenuePerDay, invariants}'`
2. `curl -sS -m 30 'https://att.ainativeos.net/api/ads/coop-order-summary?site=biocom&start_date=2026-05-01&end_date=2026-05-08' | jq '{ok, op:.operational_db_coop}'`
3. `cd backend && npm run typecheck`
4. `cd frontend && npx tsc --noEmit`
5. `git diff --check && python3 scripts/harness-preflight-check.py --strict`

## 절대 건드리면 안 되는 것

- TikTok 광고 ON/OFF 변경, TikTok Ads API write, TikTok Events API send.
- GA4/Meta/Google Ads/Naver 전환 전송, upload, conversion action 변경.
- 운영DB write/import, VM Cloud SQLite write/schema migration.
- GTM publish, Imweb footer/header 변경.
- secret/raw email/phone/member_code/order/payment/click_id 출력.
