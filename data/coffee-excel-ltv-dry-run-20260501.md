# 더클린커피 2024/2025 Excel LTV Dry-run

생성 시각: 2026-05-01 16:43:55 KST
site: `thecleancoffee`
mode: `dry_run_read_only`
Primary source: `data/coffee/coffee_orders_2024.xlsx`, `coffee_payments_2024.xlsx`, `coffee_orders_2025.xlsx`, `coffee_payments_2025.xlsx`
Freshness: 2024/2025 아임웹 주문/결제 엑셀 snapshot
Confidence: 90%

## 10초 요약

2024/2025 엑셀은 LTV와 재구매 분석에 쓸 수 있다. 단, 이번 결과는 dry-run이며 local DB import apply가 아니다.

NPay/자사몰 채널을 함께 보면 전체 재구매 규모를 볼 수 있다. 광고 ROAS 복구 전송 판단에는 아직 쓰지 않고, 고객/주문 원장 후보로만 쓴다.

LTV 대상 주문은 `거래종료` 주문 또는 결제완료 금액이 있는 NPay 주문이다. NPay 주문은 엑셀에서 `거래개시`로 남는 경우가 많아 결제 금액을 함께 본다.

## Year Summary

| year | unique_orders | complete_orders | complete_revenue | customers | repeat2+ | npay_orders | npay_revenue | payment_join | amount_mismatch |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2024 | 1987 | 1935 | 70,593,207원 | 1192 | 429 | 589 | 22,953,900원 | 1987/1987 | 82 |
| 2025 | 11018 | 10796 | 406,103,157원 | 4048 | 1540 | 3311 | 127,913,600원 | 11018/11018 | 397 |

## Combined LTV

| metric | value |
| --- | --- |
| ltv eligible orders | 12731 |
| ltv eligible revenue | 476,696,364원 |
| customers | 4536 |
| repeat2Plus | 1747 |
| repeat3Plus | 1114 |
| repeat6Plus | 537 |
| repeat10Plus | 302 |
| revenue100kPlus | 1115 |
| revenue300kPlus | 375 |
| revenue500kPlus | 150 |
| revenue1mPlus | 29 |
| maxCustomerRevenue | 6,291,515원 |
| customers2024 | 1192 |
| customers2025 | 4048 |
| bothYears | 704 |
| retention2024To2025 | 59.06% |
| returningShareOf2025 | 17.39% |

## Customer Buckets

| bucket | customers | orders | revenue |
| --- | --- | --- | --- |
| 1_order | 2789 | 2789 | 101,172,350원 |
| 2_orders | 633 | 1266 | 49,493,365원 |
| 3_to_5_orders | 577 | 2156 | 85,643,058원 |
| 6_to_9_orders | 235 | 1719 | 66,950,946원 |
| 10_plus_orders | 302 | 4801 | 173,436,645원 |
| npay_only | 1666 | 2569 | 92,849,200원 |
| mall_only | 2286 | 6602 | 241,844,766원 |
| both_channel | 584 | 3560 | 142,002,398원 |

## 해석

1. 엑셀은 LTV/재구매 분석의 primary 후보로 충분하다.
2. 주문/결제 join 품질은 연도별로 따로 봐야 한다.
3. 원문 phone/email은 출력하지 않았다. 고객 집계는 정규화 phone 내부 group by만 사용했다.
4. 실제 local DB import apply는 별도 승인, 백업, 검증 쿼리 이후에만 가능하다.

## Auditor Verdict

```text
Auditor verdict: PASS_WITH_NOTES
Phase: coffee_excel_ltv_dry_run
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No import apply: YES
No PII sample output: YES
```
