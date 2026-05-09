# Path B post-canary scorecard

작성 시각: 2026-05-09 10:35 KST
Status: pre-canary blocked scorecard

## 한 줄 결론

Preview score는 PASS지만, storage canary score는 아직 row가 없어 HOLD다.

## Scorecard

| 항목 | 판정 | 해석 |
|---|---:|---|
| `order_bridge_key_present` | PASS_PREVIEW | 주문 hash 후보는 no-send Preview에서 확인됨 |
| `identity_bridge_key_present` | PASS_REAL_CHECKOUT_PREVIEW | 실제 로그인 주문완료에서 email hash 확인됨 |
| `click_bridge_key_present` | PASS_CONTROLLED_PREVIEW | TEST click id로 click hash 확인됨 |
| `same_browser_preservation` | PASS_CONTROLLED_PREVIEW | 같은 브라우저 controlled flow에서 click 보존 확인됨 |
| `raw_identity_absent` | PASS | response/log/storage raw identity 0 기준 유지 |
| `no_platform_send` | PASS | platform send 0 |
| `would_store_false_before_canary` | PASS | flag OFF/no-send 상태 유지 |
| `storage_row_count_ok` | HOLD_NO_ROWS | canary 미실행으로 row 없음 |
| `raw_stored_count_zero` | PASS_PRECHECK | 운영 저장 미실행, 로컬 fixture raw stored 0 |
| `platform_send_count_zero` | PASS | platform send 0 |
| `fill_rate_sufficient` | HOLD_NO_ROWS | 운영 fill rate 미측정 |
| `dedupe_ok` | PASS_LOCAL_FIXTURE | 로컬 fixture에서 duplicate dedupe PASS |
| `ambiguous_rate_acceptable` | HOLD_NO_ROWS | 운영 row 기반 계산 전 |
| `canary_to_dry_run_ready` | HOLD_DEPLOY_REQUIRED | limited deploy/schema 필요 |
| `production_publish_ready` | HOLD | storage canary 전 publish 금지 |
| `actual_send_ready` | NO | Google Ads/GA4/Meta 전송 금지 |

## 100%까지 남은 것

1. limited storage deploy.
2. `order_bridge_ledger` schema bootstrap.
3. 1h hash-only canary row 수집.
4. canary row 기반 reliability dry-run.
5. Production publish readiness 재판정.
6. real paid-click actual order test 승인 여부 판단.
