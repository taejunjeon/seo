# Current Handoff

작성 시각: 2026-05-13 02:28 KST

## 현재 목표

gpt0508-49 이후: 더클린커피 NPay actual source VM Cloud backend 배포는 PASS다. 지금 목표는 로컬 대시보드 품질을 보고 가능한 수준으로 고도화하고, ROAS gap recompute와 sprint1/2/3 문서를 docurule 기준으로 최신화한 뒤 검증·커밋·푸시하는 것이다.

## 완료한 것

- VM Cloud backend 승인 배포 완료: backup `/home/biocomkr_sns/seo/repo/.deploy-backups/gpt0508-49-20260513T005354KST`, typecheck/build/restart/post-snapshot PASS.
- live summary PASS: thecleancoffee source `imweb_v2_vm_cloud_imweb_orders`, status `included_with_warning`; biocom source 운영DB PostgreSQL `dashboard.public.tb_iamweb_users PAYMENT_COMPLETE`, status `included`.
- latest read-only coffee actual: VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3` `imweb_orders` 기준 311건 / 14,970,600원, status blank 16건 / 1,012,700원.
- status blank 원인: VM Cloud SQLite `imweb_orders.imweb_status`가 비어 있고 `imweb_status_synced_at` marker가 없는 status sync lag/source freshness gap이다. 운영DB 결제 상태 blank가 아니고 미결제 단정 근거도 아니다.
- 로컬 frontend/backend 재기동: `http://localhost:7010/ads/site-landing` 200, `http://localhost:7020/health` 200.
- `/ads/site-landing` 화면 고도화: live/local API toggle, site/window selector, actual/legacy/bridge/status blank/warning cards, status blank 설명, raw identifier 미노출.
- ROAS recompute 최신화: last_7d Google Ads 10.52 vs 내부 current 0.41 vs biocom NPay 보정 3.18 vs coffee 참고 overlay 4.85; last_30d Google Ads 10.27 vs 내부 current 0.29 vs biocom NPay 보정 2.07 vs coffee 참고 overlay 2.75.
- `project/sprint1.md`, `project/sprint2.md`, `project/sprint3.md`를 docurule 기준으로 갱신했다.

## 다음 명령

1. `npx tsc --noEmit`와 `npx eslint src/app/ads/site-landing/page.tsx`를 `frontend/`에서 실행한다.
2. Playwright smoke로 `http://localhost:7010/ads/site-landing` console error/API 200/screenshot을 재확인한다.
3. `python3 scripts/validate_wiki_links.py project/sprint1.md project/sprint2.md project/sprint3.md gdn/roas-gap-recompute-after-coffee-actual-20260513.md gdn/current-handoff.md`를 실행한다.
4. JSON parse, `python3 scripts/harness-preflight-check.py --strict`, `git diff --check`, raw pattern scan을 실행한다.
5. scoped add/commit/push. TikTok API export 3파일은 Sprint 3 근거로 포함할지 최종 판단한다.

## 절대 건드리면 안 되는 것

- 운영DB write/import, VM Cloud schema migration, cron 변경, GTM publish, Imweb footer/header 변경.
- GA4/Meta/TikTok/Google Ads/Naver send/upload, conversion action 변경, campaign budget 변경.
- secret/raw email/phone/member_code/order/payment/click_id 출력.
- GA4 revenue를 actual NPay 매출로 사용하거나 NPay click/count/add_payment_info를 구매완료로 승격.
