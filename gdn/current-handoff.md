# Current Handoff

작성 시각: 2026-05-13 10:47 KST

## 현재 목표

gpt0508-49 후속 Green: 더클린커피 status blank 24h monitor 상태 확인을 닫고, `/total` correction line contract가 coffee actual을 biocom 예산 ROAS에 자동 합산하지 않도록 backend/frontend/docs에 고정한다.

## 완료한 것

- 24h monitor 확인: dedicated coffee actual `imweb_status` monitor는 자동 실행 중이 아님. 기존 VM Cloud cron은 `coffee-npay-intent-monitoring-report.ts`라 목적이 다르다.
- 수동 read-only monitor 완료: 더클린커피 VM Cloud SQLite `imweb_orders` actual 318건 / 15,503,000원, status blank 26건 / 1,663,600원, 원인은 status sync lag.
- `/total` contract 완료: `correction_lines` v0.1 추가, biocom line은 운영DB PostgreSQL `dashboard.public.tb_iamweb_users`, coffee line은 VM Cloud SQLite `imweb_orders`, coffee `included_in_budget_roas=false`.
- 검증 완료: backend typecheck PASS, targeted test PASS, frontend typecheck PASS, `/total` API 200, Playwright smoke PASS, harness preflight PASS.

## 다음 명령

1. `python3 scripts/validate_wiki_links.py project/sprint1.md project/sprint2.md project/sprint3.md gdn/coffee-actual-24h-monitor-20260513.md total/total-api-contract-20260504.md gdn/current-handoff.md`
2. `jq empty data/current-state.json data/project/coffee-actual-24h-monitor-20260513.json data/project/total-correction-line-contract-20260513.json gptconfirm/gpt0508-49/manifest.json`
3. `git diff --check` 후 raw identifier scan은 기존 sprint 명령 템플릿의 email/phone/click/payment/member 패턴으로 scoped changed files에만 실행한다.

## 절대 건드리면 안 되는 것

- 운영DB write/import, VM Cloud schema migration, cron 등록/변경, GTM publish, Imweb footer/header 변경.
- GA4/Meta/TikTok/Google Ads/Naver send/upload, conversion action 변경, campaign budget 변경.
- secret/raw email/phone/member_code/order/payment/click_id 출력.
- GA4 revenue를 actual NPay 매출로 사용하거나 NPay click/count/add_payment_info를 구매완료로 승격.
