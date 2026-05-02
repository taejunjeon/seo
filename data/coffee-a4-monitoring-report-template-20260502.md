# A-4 publish 후 일일 모니터링 리포트 템플릿 (2026-05-02)

상위 sprint: [[!coffeedata#다음 할일]] 항목 19 모니터링 자동화 초안. 본격 운영 진입은 [[coffee-a4-publish-decision-and-dispatcher-v21-20260502]] 의 §10 (5일 default) 시작 시.

본 문서는 **read-only 보고서 템플릿** + 자동화 script ([[backend/scripts/coffee-npay-intent-monitoring-report.ts]]) 의 출력 스키마 정의. 본 commit 시점에 cron 등록 안 됨.

## 0. 운영 모드

| 모드 | 트리거 | 빈도 |
|---|---|---|
| Pre-publish (현재) | TJ 명시 실행 | ad-hoc, dispatcher v2.1 Preview 재검증 시점 |
| Post-publish 5-day default | A-4 publish 직후 | 매일 1회 (KST 09:00 권장) |
| Post-publish 7-day fallback | 5일째 미충족 시 | 매일 1회 (추가 2일) |
| Stop investigation | F-1/F-2/F-8/F-13/F-14 위반 | 즉시 |

## 1. 리포트 헤더

```yaml
report_id: coffee-npay-intent-monitoring-{YYYYMMDD-HHMM}
captured_at_kst: 2026-MM-DD HH:MM
publish_ts_kst: <A-4 publish 시점, 미publish 면 null>
days_since_publish: <integer 또는 "pre-publish">
mode: pre-publish | day1 | day2 | day3 | day4 | day5 | day6 | day7 | stop
backend_endpoint: https://att.ainativeos.net
test_row_filter:
  intent_uuid_not_like: smoke_%
  source_version_exclude: a3v2_codex_sim, a3v21_codex_sim, test_*
  is_simulation: 0
```

## 2. 핵심 메트릭 (12개)

| # | 메트릭 | 산출 | 임계 (publish day 5+) |
|---|---|---|---|
| M-1 | total_rows (test 제외) | stats.total_rows - test row count | 일별 증분 5~50건 (정상 범위) |
| M-2 | rows_with_imweb_order_code | stats.rows_with_imweb_order_code (test 제외) | M-1 의 **≥95%** |
| M-3 | imweb_order_code coverage rate | M-2 / M-1 * 100% | **≥95%** |
| M-4 | enforce_inserted | reject_counters.enforce_inserted | M-1 와 가까움 |
| M-5 | enforce_deduped | reject_counters.enforce_deduped | **M-4 의 ≤5%** (v2.1 race 보강) |
| M-6 | invalid_origin | reject_counters.invalid_origin | **0** |
| M-7 | rate_limited | reject_counters.rate_limited | **0** |
| M-8 | preview_only_violation | reject_counters.preview_only_violation | **0** |
| M-9 | is_simulation_blocked | reject_counters.is_simulation_blocked | **0** |
| M-10 | pii_rejected | reject_counters.pii_rejected | **0** |
| M-11 | endpoint_5xx | (manual / pm2 logs grep) | **0** |
| M-12 | rows_with_ga4_synthetic_transaction_id | stats.rows_with_ga4_synthetic_transaction_id | observability only — 임계 없음 |

## 3. join 메트릭 (5개)

`/api/attribution/coffee-npay-intent-join-report` 의 결과 기반.

| # | 메트릭 | 의미 | 임계 |
|---|---|---|---|
| J-1 | joined_confirmed_order | ledger row 중 imweb_orders.order_code 와 join 되는 row 수 | M-2 의 **≥80%** (24h 이내 결제 완료) |
| J-2 | pending_order_sync | imweb_order_code 는 있지만 imweb_orders 에 아직 동기화 안 됨 | <10% (운영 imweb sync 의 lag) |
| J-3 | no_order_after_24h | 24h 경과해도 imweb_orders 에 매칭 0 | **<5%** (NPay 결제 포기 / cancel) |
| J-4 | duplicated_intent | 같은 imweb_order_code 에 ledger row >1 | <2% |
| J-5 | invalid_payload_post_join | join 후 payload 스키마 불일치 | **0** |

## 4. dispatcher 측 메트릭 (3개, manual or sessionStorage 기반)

이는 backend 가 직접 측정 불가. dispatcher state 캡처 (`__coffee_intent_pending` + `__coffee_intent_sent`) 또는 GTM Tag Assistant 통계 사용.

| # | 메트릭 | 산출 | 임계 |
|---|---|---|---|
| D-1 | dispatcher_install_rate | Tag Assistant 의 fired count / page view | observability only |
| D-2 | dispatcher_fetch_failed | sessionStorage `__coffee_intent_pending` 에 last_reason="fetch_failed" 잔존 + sent_entries 의 permanent_4xx_* | 24h cumulative <1% of total |
| D-3 | retry_success | sent_entries 에서 status=ok_* 인데 pending 의 attempts > 1 였던 비율 | observability only |

## 4.5. user_agent_class split — mobile / pc / unknown 7 지표

A-4 publish 후 mobile vs PC 의 capture rate / dispatcher 동작 차이 추적용. sprint 19.5 (H-1) 의 mobile playwright 검증으로 main path 동일 확인됐으나 운영 traffic 의 실측 split 는 publish 후 자연 측정.

bucket 분류:
- `mobile`: user_agent_class IN ('mobile', 'tablet') — snippet 의 `detectUaClass()` 결과
- `pc`: user_agent_class IN ('pc', 'desktop')
- `unknown`: 그 외 또는 NULL (legacy row 등)

| # | 지표 (각 bucket 별) | 산출 | 임계 |
|---|---|---|---|
| UA-1 | `intent_count` | bucket 의 row 수 (test 제외) | observability — 합계가 M-1 와 같음 |
| UA-2 | `confirm_to_pay_count` | bucket 의 `intent_phase=confirm_to_pay` row 수 | mobile/pc 별 비율 추적 |
| UA-3 | `imweb_order_code_capture_pct` | bucket 의 imweb_order_code IS NOT NULL 비율 | 각 bucket 모두 **≥95%** |
| UA-4 | `payment_button_type_null_in_confirm` | bucket 의 `intent_phase=confirm_to_pay AND payment_button_type IS NULL` 건수 | 각 bucket 모두 **0** |
| UA-5 | `invalid_payload_rate_pct` | reject_counters 가 process scope 라 bucket 분리 0 — manual fill (`pm2 logs grep` 또는 별도 logging) | bucket 별 분리 < 1% |
| UA-6 | `joined_confirmed_order_pct` | join-report 의 bucket 별 (별도 sprint 보강 필요) | 각 bucket 모두 **≥80%** |
| UA-7 | `no_order_after_24h_pct` | join-report 의 bucket 별 (동일) | 각 bucket 모두 **<5%** |

**판정 규칙**:
- mobile bucket 의 UA-3 / UA-4 / UA-6 / UA-7 가 PC 와 **>10%p 차이** 면 → mobile 의 capture path 회귀 의심 → dispatcher v2.x design 재검토 (별도 sprint)
- mobile bucket intent_count 가 0 (PC only traffic) 이면 mobile dispatcher install 누락 또는 mobile traffic 부재 → GTM Tag Assistant 통계 cross-check
- unknown bucket 비율 > 10% 면 snippet 의 `detectUaClass()` 정확도 재검토

automated: M-3, UA-3, UA-4 의 ledger 기반 — monitoring script 자동.
manual: UA-5 / UA-6 / UA-7 — pm2 logs / join-report 별도 sprint 필요.

## 5. stop 조건 (14개)

[[coffee-a4-publish-decision-and-dispatcher-v21-20260502#11-7일-fallback-조건]] 의 F-1~F-14 그대로.

| # | 조건 | 임계 (위반 시 stop) |
|---|---|---|
| F-1 | imweb_order_code coverage | <80% |
| F-2 | enforce_deduped ratio | >20% |
| F-3 | endpoint 5xx ratio | >1% |
| F-4 | rate_limited 누적 | >100건/일 |
| F-5 | invalid_origin | >0 |
| F-6 | preview_only_violation | >0 |
| F-7 | is_simulation_blocked | >0 |
| F-8 | pii_rejected | >0 |
| F-9 | pm2 restart 카운터 | >20/일 |
| F-10 | site funnel-capi 충돌 | sessionStorage `funnelCapi::*` 파괴 |
| F-11 | site error rate | >5% |
| F-12 | NPay 결제 완료율 회귀 | -1%p 초과 |
| F-13 | GA4/Meta/TikTok/Google Ads 의도치 송출 | >0 |
| F-14 | TJ 직접 stop | 즉시 |

## 6. 일일 리포트 출력 형식 (예시)

```yaml
report_id: coffee-npay-intent-monitoring-20260507-0900
captured_at_kst: 2026-05-07 09:00
publish_ts_kst: 2026-05-02 15:00
days_since_publish: 5
mode: day5
backend_endpoint: https://att.ainativeos.net

# Section 2: 핵심 메트릭
M-1_total_rows_excl_test: 187
M-2_rows_with_imweb_order_code: 182
M-3_imweb_order_code_coverage_pct: 97.3
M-4_enforce_inserted: 187
M-5_enforce_deduped: 4
M-5_enforce_deduped_ratio_pct: 2.1
M-6_invalid_origin: 0
M-7_rate_limited: 0
M-8_preview_only_violation: 0
M-9_is_simulation_blocked: 0
M-10_pii_rejected: 0
M-11_endpoint_5xx: 0
M-12_rows_with_ga4_synthetic_transaction_id: 14

# Section 3: join 메트릭
J-1_joined_confirmed_order_pct: 84.6
J-2_pending_order_sync_pct: 7.1
J-3_no_order_after_24h_pct: 8.2
J-4_duplicated_intent_pct: 0.5
J-5_invalid_payload_post_join: 0

# Section 4: dispatcher (manual)
D-1_dispatcher_install_rate: n/a (Tag Assistant manual)
D-2_dispatcher_fetch_failed_pct: 0.3
D-3_retry_success_count: 2

# Section 5: stop 조건
F-violations: 0
stop_required: false

# 판정
gate_status:
  EG-1_imweb_order_code_coverage_ge_95: PASS
  EG-2_total_rows_5_to_50: pass-but-high
  EG-3_enforce_deduped_ratio_le_5: PASS
  EG-4_payment_button_type_null_in_confirm: PASS (0)
  EG-5_invalid_origin_zero: PASS
  EG-5_rate_limited_zero: PASS
  EG-5_preview_only_violation_zero: PASS
  EG-5_is_simulation_blocked_zero: PASS
  EG-6_pii_rejected_zero: PASS
  EG-7_endpoint_5xx_zero: PASS
  EG-8_dispatcher_fetch_failed_lt_1: PASS
  EG-9_pm2_restart_lt_5: PASS
verdict: closure-ready (조기 게이트 9 모두 PASS)

next_action: A-5 source-of-truth 인정 + A-6 (GA4/Meta CAPI 보강 전송) 별도 승인 게이트 진입
```

## 7. 자동화 script

[[backend/scripts/coffee-npay-intent-monitoring-report.ts]] — read-only fetch + 위 형식 yaml 출력.

```bash
cd /Users/vibetj/coding/seo/backend
npx tsx scripts/coffee-npay-intent-monitoring-report.ts \
  --endpoint https://att.ainativeos.net \
  --publish-ts "2026-05-02 15:00" \
  --output /tmp/coffee-npay-monitoring-$(date +%Y%m%d-%H%M).yaml
```

미구현 영역 (manual fill):
- M-11 endpoint_5xx — `pm2 logs seo-backend --lines 1000 | grep ' 5'` 필요
- D-1 dispatcher_install_rate — GTM Tag Assistant 화면
- D-2 dispatcher_fetch_failed — chrome devtools sessionStorage 또는 별도 logging endpoint
- D-3 retry_success — 동일

## 8. 운영 cron — 등록됨 (2026-05-02 KST, sprint 21 진입 시점)

VM `biocomkr_sns` 의 crontab 에 등록 완료:

```cron
@reboot /bin/bash -lc 'source /home/biocomkr_sns/seo/env.sh && /home/biocomkr_sns/seo/node/bin/pm2 resurrect'

# A-4 publish (sprint 20) 후 5일 default monitoring — 매일 KST 09:00
0 9 * * * /home/biocomkr_sns/seo/coffee-monitoring/run.sh >> /home/biocomkr_sns/seo/coffee-monitoring/cron.log 2>&1
```

`/home/biocomkr_sns/seo/coffee-monitoring/run.sh` 본문:

```sh
#!/bin/bash
# A-4 publish 후 5일 default monitoring (sprint 20) — 매일 KST 09:00 cron
set -euo pipefail
export PATH=/home/biocomkr_sns/seo/node/bin:$PATH
cd /home/biocomkr_sns/seo/repo/backend
DAY=$(date +%Y%m%d)
exec /home/biocomkr_sns/seo/node/bin/npx tsx scripts/coffee-npay-intent-monitoring-report.ts \
  --endpoint https://att.ainativeos.net \
  --publish-ts "2026-05-02 16:00" \
  --output "/home/biocomkr_sns/seo/coffee-monitoring/${DAY}.yaml"
```

출력: `/home/biocomkr_sns/seo/coffee-monitoring/{YYYYMMDD}.yaml` (매일 갱신).
로그: `/home/biocomkr_sns/seo/coffee-monitoring/cron.log`.

첫 manual 실행 검증 PASS (2026-05-02 16:50 KST):
- exit 0
- yaml 2842 bytes
- verdict `closure-ready (auto-evaluated)`
- EG-3 enforce_deduped_ratio_le_5 / EG-4 payment_button_type / EG-5/6 origin/rate_limit/preview_only/is_simulation/pii — 모두 PASS
- EG-1 imweb_order_code_coverage_ge_95 = `n/a (no real rows)` — admin token 없는 read-only 라 ledger items 0 (운영 traffic 들어오면 채워짐)

다음 cron 발화: 매일 KST 09:00. 5일 default = 2026-05-03 ~ 2026-05-07.

## 9. 가드

- 본 모니터링은 **read-only**: GET /stats + GET /join-report. write 0.
- 외부 send 0 (GA4/Meta/TikTok/Google Ads).
- backend / GTM 변경 0.
- 결과 yaml 은 로컬 디렉토리 저장. 외부 시스템 push 0.
