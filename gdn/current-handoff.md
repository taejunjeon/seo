# Current Handoff

작성 시각: 2026-05-13 13:02 KST

## 현재 목표

gpt0508-50: 더클린커피 actual status monitor를 전용 read-only script로 만들고, `/total`을 대표가 30초 안에 판단하는 decision layer 화면으로 고도화한다. Cron 등록과 운영 배포는 승인안까지만 작성한다.

## 완료한 것

- 전용 monitor script 추가: `backend/scripts/coffee-actual-status-monitor.ts`.
- 최신 monitor 실행: VM Cloud SQLite `imweb_orders` 기준 thecleancoffee actual 317건 / 15,547,500원, status blank 28건 / 1,848,000원, status sync lag 23.76h.
- status blank 원인 확인: VM Cloud SQLite `imweb_orders.imweb_status` blank row 28건 모두 `imweb_status_synced_at` marker 없음. 운영DB/로컬DB blank가 아니라 VM Cloud status sync lag.
- `/total` UX 개선: 상단 4개 판단 카드, 채널별 운영 액션 라벨, source/warning diagnostics 기본 접힘, local API 기본값 7020.
- `/total` smoke PASS: `http://localhost:7010/total` → backend `http://localhost:7020` API 200, 콘솔/요청 실패 0.
- ROAS recompute readiness script 추가: `backend/scripts/roas-gap-recompute-readiness.ts`.

## 다음 명령

1. `python3 scripts/validate_wiki_links.py gptconfirm/gpt0508-50/*.md gdn/current-handoff.md`
2. `python3 scripts/harness-preflight-check.py --strict`
3. `git diff --check && npm run typecheck` in `backend`, `npx tsc --noEmit` in `frontend`
4. scoped raw identifier scan on `data/project/coffee-actual-status-monitor-script-20260513.json`, `data/project/roas-gap-recompute-readiness-20260513.json`, `data/project/total-ux-decision-layer-smoke-20260513.json`, `gptconfirm/gpt0508-50/*.md`

## 절대 건드리면 안 되는 것

- 운영DB write/import, VM Cloud schema migration, cron 등록/변경, 운영 frontend/backend deploy/restart.
- GA4/Meta/TikTok/Google Ads/Naver send/upload, conversion action 변경, campaign budget 변경.
- GTM publish, Imweb footer/header 변경.
- secret/raw email/phone/member_code/order/payment/click_id 출력.
- GA4 revenue를 actual NPay 매출로 사용하거나 NPay click/count/add_payment_info를 구매완료로 승격.
