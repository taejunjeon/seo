# BigQuery union internal confirmed match readiness (gpt0508-33)

작성 시각: 2026-05-10 21:45:30 KST
Lane: Green read-only / 로컬 산출물

## 5줄 결론

1. archive+daily union의 7/14/30d coverage는 PASS 유지(이벤트 row 38만 / 75만 / 229만).
2. paid_google session은 last_30d 기준 29,418건이지만 internal confirmed 매칭은 31건뿐이라 attribution evidence 보유 비율이 낮다.
3. 매칭 가능한 row는 paid_google 안의 `gclid+click_view` 31건뿐, 나머지는 `조인 필요(imweb 주문에 gclid 저장 안 됨)` 또는 `불가 사유(scope 밖, GA4 purchase 미확정, NPay click 미승격)`로 분류된다.
4. GA4 purchase event(3,715)는 actual purchase로 확정하지 않고, NPay click(2,000)은 purchase로 승격하지 않는다.
5. upload_candidate_count 0 유지. 다음 Green 액션은 funnel-capi v3 / Path B 영역에서 imweb 주문 → click_id 보존 흐름이 누적될 때 동일 readiness 표를 다시 만드는 것이다.

## 1. coverage 상태 (직전 union 결과 유지)

| window | 요청 일수 | 가용 suffix 수 | event row | coverage |
|---|---|---|---|---|
| last_7d | 7 | 7 | 381,559 | PASS |
| last_14d | 14 | 14 | 754,213 | PASS |
| last_30d | 30 | 30 | 2,289,596 | PASS |

archive_backfill suffix ≤ 20260506, daily_export suffix ≥ 20260507 union 규칙 그대로 유지.

## 2. session breakdown by campaign_hint

| window | sessions | paid_google | paid_meta | paid_tiktok | organic_search | npay_click | ga4_purchase |
|---|---|---|---|---|---|---|---|
| last_7d | 65,993 | 5,696 | 28,683 | 20,937 | 4,278 | 499 | 430 |
| last_14d | 125,942 | 12,300 | 52,500 | 41,352 | 8,031 | 1,157 | 874 |
| last_30d | 391,430 | 29,418 | 122,532 | 199,375 | 17,344 | 2,000 | 3,715 |

## 3. internal confirmed 앵커

| 항목 | 값 |
|---|---|
| confirmed_orders 30d | 2,152 |
| campaign_id matched | 31 |
| campaign_id missing | 2,121 |
| matched revenue | ₩761만 |
| match method (matched 31) | order-level gclid + Google Ads click_view exact |

## 4. campaign_hint 별 internal match readiness

| hint | 30d session | join_status | internal match | budget 사용 | blocker |
|---|---|---|---|---|---|
| paid_google (matched 부분) | 29,418 | 조인 가능 | 31 | OK | (n/a) |
| paid_google (나머지) | 29,418 | 조인 필요 | 0 | 금지 | imweb 주문 테이블에 gclid/gbraid/wbraid 저장 미적용 |
| paid_meta | 122,532 | 불가 사유 | n/a | 금지 | Google Ads 대상 아님. Meta CAPI ledger 트랙(D/KR6)에서 처리 |
| paid_tiktok | 199,375 | 불가 사유 | n/a | 금지 | Google Ads 대상 아님 |
| organic_search | 17,344 | 불가 사유 | n/a | 금지 | not_paid_traffic |
| npay_click | 2,000 | 불가 사유 | n/a | 금지 | NPay click/count/add_payment_info를 purchase로 승격 금지 |
| ga4_purchase_events | 3,715 | 불가 사유 | n/a | 금지 | GA4 purchase는 actual purchase로 확정하지 않음 |

## 5. 결과 요약

| 항목 | 값 |
|---|---|
| windows PASS | last_7d, last_14d, last_30d |
| paid_google에 attributable internal match | 31 |
| paid_google에 더 필요한 internal match | 2,121 (imweb click_id 저장 누적 필요) |
| upload_candidate_count | 0 |
| send_candidate / actual_send_candidate | false / false |
| ga4_purchase 를 actual purchase 로 승격 | false |
| npay_click 을 purchase 로 승격 | false |

## 6. 금지 재확인

- read-only / no-send / no-deploy.
- GA4 purchase event를 actual purchase로 확정하지 않음.
- NPay click/count/add_payment_info를 purchase로 승격하지 않음.
- time-window-only attribution을 예산 판단에 사용하지 않음.
- send_candidate=false, actual_send_candidate=false, upload_candidate_count=0.

## 7. Verdict

`PASS_FOR_COVERAGE_HOLD_FOR_INTERNAL_MATCH_EXTENSION`

산출 JSON: `data/campaign-funnel-quality-union-internal-match-readiness-20260511.json`
