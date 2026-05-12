---
harness_preflight:
  common_harness_read: true
  project_harness_read: true
  required_context_docs:
    - CLAUDE.md
    - AGENTS.md
    - harness/common/REPORTING_TEMPLATE.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - docurule.md
    - data/!data_inventory.md
    - gdn/attribution-data-source-decision-guide-20260511.md
  lane: Green
  allowed_actions: [local_code_patch, fixture_test, read_only_query, document_update, gptconfirm_packaging, commit_push]
  forbidden_actions: [vm_deploy_restart, operational_db_write, platform_send_upload, gtm_publish]
  source_window_freshness_confidence: "last_30d / 2026-05-12 21:24-21:27 KST / confidence 90%"
---

# gpt0508-46 Result Report

NPay 매출 요약이 오래돼 보인 이유는 sync 미실행만이 아니라, 화면이 `complete_time`만 보고 있었기 때문입니다. 이번 sprint에서는 `complete_time`을 보정하지 않고, 실제 결제완료 기준을 운영DB `PAYMENT_COMPLETE`로 분리하는 로컬 패치와 검증을 완료했습니다.

## 한 줄 결론

summary API는 이제 기존 complete_time 기준값과 실제 결제완료 기준값을 동시에 설명할 준비가 됐습니다. 배포는 승인 전 실행하지 않았고, 승인안만 만들었습니다.

## 완료한 것

- 옵션 A 결과 보정: status sync는 `imweb_status`만 채우며, summary API가 보던 `complete_time` 문제와 직접 맞물리지 않는다고 정리했습니다.
- 옵션 C source audit: actual primary는 운영DB `tb_iamweb_users PAYMENT_COMPLETE`, bridge는 `imweb_orders.order_code/order_no`, `complete_time/imweb_status`는 진단용으로 고정했습니다.
- backend 로컬 패치:
  - `derived.npay_revenue_30d` 유지.
  - `derived.npay_revenue_30d_complete_time_legacy` 추가.
  - `derived.npay_revenue_30d_actual_confirmed` 추가.
  - `derived.npay_revenue_30d_bridge_pending` 추가.
  - freshness/source disagreement/forbidden proxy 필드 추가.
- fixture/test 추가: NPay PAYMENT_COMPLETE + complete_time blank 포함, complete_time-only 제외, imweb_status-only 제외, lifecycle status 제외, raw PII 패턴 없음 확인.
- dry-run 재계산:
  - biocom actual confirmed: 163건 / ₩29,500,200 / max payment complete 2026-05-12T07:10:27.000Z.
  - biocom legacy complete_time live: 128건 / ₩25,664,000 / max order_time 2026-05-11T00:47:22.000Z.
  - biocom bridge pending: 59건 / ₩7,841,600 / max order_time 2026-05-12T07:09:55.000Z.
  - thecleancoffee actual confirmed: 운영DB site 격리 미검증으로 bridge_pending.
  - thecleancoffee bridge pending: 75건 / ₩5,067,700 / max order_time 2026-05-12T12:08:16.000Z.
- 데이터 위치 인벤토리 업데이트: `complete_time` actual primary 금지, `imweb_status` 진단용, 운영DB actual primary, VM Cloud freshness 필수 원칙 추가.
- deploy approval packet 작성: VM 배포/restart 명령은 문서화만 했고 실행하지 않았습니다.

## 하지 않은 것

- VM Cloud 배포/restart: 하지 않음. 별도 승인 필요.
- 운영DB write: 0.
- Google Ads/GA4/Meta/TikTok/Naver 전송 또는 upload: 0.
- GTM Production publish: 0.
- cron 등록: 0.
- NPay click/count/add_payment_info 구매완료 승격: 0.

## 검증 결과

- `npm run typecheck`: PASS.
- `npx tsx --test tests/site-landing-npay-actual-source.test.ts tests/site-landing-summary-api.test.ts tests/npay-actual-confirmed-pg-reader.test.ts`: 12/12 PASS.
- JSON parse: PASS.
- validate_wiki_links: PASS.
- harness-preflight-check --strict: PASS.
- git diff --check: PASS.
- raw email/phone/order/payment/member_code pattern scan: PASS.

## Track 진척률

| Track | 이전 | 현재 | 증감 |
|---|---:|---:|---:|
| A Order Truth / Payment Bridge | 100% | 100% | +0% |
| B Imweb Source Capture | 96% | 97% | +1% |
| C Imweb Attribution Builder | 99% | 100% | +1% |
| D Dashboard Decision View | 93% | 96% | +3% |
| E Platform Exact Attribution | 45% | 45% | +0% |
| F QA / Guard / Data Guide | 99.6% | 99.8% | +0.2% |
| G Site Landing Ledger | 98% | 99% | +1% |

## Telegram

사용자 skip 유지 조건에 따라 텔레그램 완료 메시지는 발송하지 않았습니다.
