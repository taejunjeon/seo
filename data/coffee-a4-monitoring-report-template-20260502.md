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

## 8. 운영 cron (미등록, 추후)

publish 직후부터 cron 등록 권장 (단, 본 commit 시점에 미등록):

```cron
# 매일 KST 09:00 — 5일 default 모니터링
0 9 * * * cd /Users/vibetj/coding/seo/backend && npx tsx scripts/coffee-npay-intent-monitoring-report.ts --output /Users/vibetj/coding/seo/data/coffee-monitoring/$(date +\%Y\%m\%d).yaml >> /tmp/coffee-monitoring.log 2>&1
```

본 cron 등록은 A-4 publish + 5일 default 모니터링 진입 결정 시 별도 sprint.

## 9. 가드

- 본 모니터링은 **read-only**: GET /stats + GET /join-report. write 0.
- 외부 send 0 (GA4/Meta/TikTok/Google Ads).
- backend / GTM 변경 0.
- 결과 yaml 은 로컬 디렉토리 저장. 외부 시스템 push 0.
