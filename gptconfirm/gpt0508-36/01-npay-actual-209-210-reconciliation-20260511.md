# NPay actual 209 vs 210 reconciliation (gpt0508-36)

작성 시각: 2026-05-10 23:45:00 KST
실행 상태: read-only PASS / 운영DB write 0 / raw PII 0
자신감: 96%

## 한 줄 결론

210건 → 209건 차이 1건은 **30일 rolling window의 boundary가 50분 이동하면서 가장 오래된 row 1개가 30일 밖으로 떨어진 것**이오. 추가로 그 row는 amount NULL/0 edge라 양수 amount 필터에서도 동일하게 빠지오. 두 root cause는 같은 1건일 가능성이 매우 높소. raw order_no/email/phone/member_code는 노출하지 않았소.

## 1. 측정 시점별 카운트

| 시각 (KST) | 윈도우 필터 | PAYMENT_COMPLETE 카운트 | amount > 0 카운트 | amount NULL/0 |
|---|---|---|---|---|
| 22:55:00 | rolling 30d | **210** | 209 | 1 |
| 23:43:30 | rolling 30d | **209** | 209 | 0 |
| 23:43:30 | KST 2026-04-11 00:00 고정 boundary | — | **207** | — |

rolling boundary 실측 (운영 PG `NOW()`):
- 22:55 KST → boundary `2026-04-10 22:55 KST`
- 23:43 KST → boundary `2026-04-10 23:43 KST`

## 2. 사유별 분류 (현재 209건 풀에서)

| 사유 | 건수 |
|---|---|
| source_raw_payment_complete_30d | 209 |
| excluded_cancel | 0 |
| excluded_return | 0 |
| excluded_amount_null | 0 |
| excluded_amount_zero | 0 |
| excluded_amount_negative | 0 |
| excluded_order_number_missing | 0 |
| excluded_channel_order_no_missing | 0 |
| applied_filter_pass_through | 209 |

PAYMENT_COMPLETE 풀 안에서 환불/취소/null amount 등으로 빠지는 row는 0이오. 즉 차이 1건은 풀 자체에 들어왔다 빠진 것이지 필터 정의 문제가 아니오.

## 3. 권장 보고 metric

다음 sprint부터 builder/dashboard/문서에는 두 metric을 병기하시오.

- `rolling_30d` — query 시각 같이 노출. 운영 추세 추적용.
- `fixed_kst_boundary_30d` — `2026-04-11 00:00 KST ~ 측정 시각` 같은 고정 boundary. cohort 비교용.

이번 reconciliation에서 fixed boundary 207건이 최신 baseline.

## 4. 후속 산출물에 적용된 baseline

- 작업 2 builder integration: `rolling_30d=209건`을 primary, `fixed_kst_boundary=207건`을 baseline으로 병기
- 작업 4 dashboard 응답: 동일하게 두 값을 같이 노출

## 5. Verdict

`RECONCILED_WINDOW_BOUNDARY_SLIDE_DIFF_1_WITHIN_TOLERANCE`

산출 JSON: `data/npay-actual-209-210-reconciliation-20260511.json`
