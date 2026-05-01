# 더클린커피 2024 엑셀 결제 Mismatch 분해

생성 시각: 2026-05-01 17:12:50 KST
site: `thecleancoffee`
mode: `read_only`
Primary source: `data/coffee/coffee_orders_2024.xlsx`, `data/coffee/coffee_payments_2024.xlsx`
Confidence: 95% (엑셀 row level)

## Auditor Verdict

```text
Auditor verdict: PASS_WITH_NOTES
Phase: coffee_excel_payment_mismatch
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No DB import apply: YES
No PII sample output: YES
```

## 10초 요약

2024 엑셀 1,987건 중 mismatch 는 82건이다. 이 mismatch 는 정합성 오류가 아니라 **결제 후 환불** 이거나 **결제대기/취소** 상태의 `결제` row 가 `결제완료` 가 아니라서 paidSum 에 잡히지 않는 것이다.

따라서 mismatch 는 "엑셀이 틀렸다" 가 아니라 "엑셀의 결제 row 상태가 결제완료가 아니다" 로 해석한다. LTV 분석 시 결제완료 + 부분환불 보정 후 사용한다.

## 총합

| metric | value |
| --- | --- |
| orders (year unique) | 1,987 |
| mismatch orders | 82 |
| mismatch finalAmount sum | 2,849,495원 |
| mismatch paid sum (결제완료+결제만) | 0원 |
| mismatch delta | 2,849,495원 |

## Reason Distribution

| reason | count | finalAmount sum | paid sum | refund sum |
| --- | --- | --- | --- | --- |
| paid_then_fully_refunded | 56 | 1,865,938원 | 0원 | -1,865,938원 |
| payment_deadline_exceeded | 18 | 606,232원 | 0원 | 0원 |
| input_pre_cancel | 8 | 377,325원 | 0원 | 0원 |

## Order Status of Mismatch

| order_status | count |
| --- | --- |
| 거래종료 | 64 |
| 거래개시 | 18 |

## Channel Distribution of Mismatch

| channel | count |
| --- | --- |
| 더클린 커피 (the clean coffee) | 58 |
| 네이버페이-주문형 | 24 |

## 해석

1. `paid_then_fully_refunded` 는 같은 주문에 `결제` row 와 `환불` row 가 모두 있다. paidSum 은 0이지만 paymentSum + refundSum = 0 으로 정합. NPay 전체환불 케이스가 다수다.
2. `payment_deadline_exceeded` / `input_pre_cancel` / `payment_pending` 은 `결제` row 가 `결제완료` 가 아닌 status 라서 paidSum 이 0이다. 실제 매출/LTV 산정에서 제외해야 한다.
3. mismatch 는 엑셀이 틀렸다는 의미가 아니라 "결제완료가 아닌 row 만 존재한다" 는 의미다. LTV dry-run 의 `ltvRevenue` 는 paid > 0 인 행만 사용하므로 이 mismatch 는 LTV 에 포함되지 않는다.
4. 외부 송출, local DB write, GTM/Meta/TikTok/GA4 호출 0건이다.

## Reason 별 샘플

### paid_then_fully_refunded (56건)

| order_no | finalAmount | order_status | channel | paidSum | paymentSum | refundSum | payment_status_summary |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 202412307530832 | 20,900원 | 거래개시 | 네이버페이-주문형 | 0원 | 20,900원 | -20,900원 | 전체환불 |
| 202412286701705 | 20,900원 | 거래개시 | 네이버페이-주문형 | 0원 | 20,900원 | -20,900원 | 전체환불 |
| 202412278149355 | 30,300원 | 거래종료 | 더클린 커피 (the clean coffee) | 0원 | 30,300원 | -30,300원 | 전체환불 |

### payment_deadline_exceeded (18건)

| order_no | finalAmount | order_status | channel | paidSum | paymentSum | refundSum | payment_status_summary |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 202412296566289 | 41,420원 | 거래종료 | 더클린 커피 (the clean coffee) | 0원 | 41,420원 | 0원 | 결제기한초과 |
| 202412262152720 | 37,400원 | 거래종료 | 더클린 커피 (the clean coffee) | 0원 | 37,400원 | 0원 | 결제기한초과 |
| 202412160653293 | 33,900원 | 거래종료 | 더클린 커피 (the clean coffee) | 0원 | 33,900원 | 0원 | 결제기한초과 |

### input_pre_cancel (8건)

| order_no | finalAmount | order_status | channel | paidSum | paymentSum | refundSum | payment_status_summary |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 202412263405678 | 26,774원 | 거래종료 | 더클린 커피 (the clean coffee) | 0원 | 26,774원 | 0원 | 입금전 취소 |
| 202412231156244 | 62,800원 | 거래종료 | 더클린 커피 (the clean coffee) | 0원 | 62,800원 | 0원 | 입금전 취소 |
| 202412198865709 | 33,900원 | 거래종료 | 네이버페이-주문형 | 0원 | 33,900원 | 0원 | 입금전 취소 |

## Reason 정의

| reason | 정의 |
| --- | --- |
| paid_then_fully_refunded | `결제` row + `환불` row 동시 존재, paymentSum + refundSum = 0 |
| paid_then_partial_refund | `결제` + `환불` 동시 존재, finalAmount = paymentSum + refundSum |
| payment_pending | `결제` row 가 `결제완료` 가 아닌 다른 status (`결제대기` 등) |
| payment_deadline_exceeded | `결제` row status 가 `결제기한초과` |
| input_pre_cancel | `결제` row status 가 `입금전 취소` |
| free_only | `결제` row 없이 `무료결제` row 만 존재 |
| no_payment_rows | payments 엑셀에 해당 주문이 없음 |
| other | 위 분류 외 |

## Guardrails

- Read-only. orders/payments xlsx 만 읽고 외부 시스템 호출 0건.
- payments xlsx 의 phone/이메일/주문자명 등 PII 컬럼은 사용하지 않는다.
- 본 리포트의 mismatch 는 LTV/매출 정합성 결론을 바꾸는 신호가 아니라 분류 라벨이다.
