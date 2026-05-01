# 더클린커피 엑셀 Import Dry-run 리포트

작성 시각: 2026-05-01 10:17 KST
site: `thecleancoffee`
phase: `dry_run_read_only`
Primary source: `data/coffee/coffee_orders_2025.xlsx`, `data/coffee/coffee_payments_2025.xlsx`
Freshness: 2025년 아임웹 주문/결제 엑셀 snapshot
Confidence: 91%

## 목적

2025 더클린커피 주문/결제 엑셀을 실제 DB에 쓰지 않고 읽어서 import 가능성, 주문-결제 join 품질, 결제수단/LTV 분석 가능성을 확인한다.

이번 작업은 dry-run이다. local SQLite import apply도 하지 않았다.

## 추가 스크립트

```bash
cd backend
npm exec tsx scripts/coffee-excel-import-dry-run.ts -- \
  --orders=../data/coffee/coffee_orders_2025.xlsx \
  --payments=../data/coffee/coffee_payments_2025.xlsx \
  --markdown
```

## Summary

| 항목 | 값 |
|---|---:|
| 주문 엑셀 행 | 16,454 |
| 고유 주문번호 | 11,018 |
| 주문번호 단위 최종주문금액 합계 | 410,538,055원 |
| 결제 엑셀 행 | 11,341 |
| 결제 엑셀 고유 주문번호 | 11,018 |
| 주문-결제 join | 11,018 / 11,018 |
| 주문 without 결제 | 0 |
| 결제 without 주문 | 0 |
| 금액 mismatch 주문 | 397 |
| 고유 정규화 phone | 4,089 |

## Channel Summary

| channel | orders | amount |
|---|---:|---:|
| 더클린 커피 (the clean coffee) | 7,599 | 278,490,755원 |
| 네이버페이-주문형 | 3,419 | 132,047,300원 |

## Payment Method Summary

| method | orders | amount |
|---|---:|---:|
| 카드 | 3,426 | 146,283,472원 |
| 네이버페이-주문형 결제 | 3,419 | 127,009,800원 |
| 정기결제 | 3,640 | 105,109,990원 |
| 무통장입금 | 245 | 10,335,737원 |
| 가상계좌 | 112 | 4,623,562원 |
| 실시간계좌이체 | 69 | 2,657,247원 |
| 무료결제 | 107 | 0원 |

## LTV Aggregate

자사몰 `거래종료` 주문 기준이다. PII raw sample은 출력하지 않았다.

| metric | value |
|---|---:|
| customers | 2,604 |
| repeat2Plus | 995 |
| repeat3Plus | 675 |
| repeat6Plus | 363 |
| revenue100kPlus | 674 |
| revenue300kPlus | 220 |
| revenue500kPlus | 85 |
| revenue1mPlus | 13 |
| maxCustomerRevenue | 4,422,365원 |
| totalRevenue | 278,189,557원 |

## 해석

1. 2025 주문 엑셀과 결제 엑셀은 주문번호 기준 100% join된다.
2. 더클린커피의 NPay/카드/정기결제/무통장/가상계좌 분리가 가능하다.
3. 397건 금액 mismatch는 취소/환불/부분환불/무료결제/정기결제 흐름으로 추가 분해해야 한다.
4. 엑셀은 LTV/재구매 분석에는 매우 강하지만, 실제 import apply는 별도 승인과 백업 후 진행해야 한다.

## 다음 단계

| 작업 | 왜 | 어떻게 |
|---|---|---|
| mismatch 397건 분해 | 결제액과 주문금액 차이를 오판하면 LTV/매출이 틀어진다 | 결제상태, 결제구분, 환불금액, 주문상태 기준으로 reason 부여 |
| 2024/2025 통합 dry-run | 24개월 LTV가 더 정확하다 | 동일 스크립트에 `--orders`, `--payments`를 바꿔 연도별 실행 |
| local import 승인안 | 실제 SQLite import는 write 작업이다 | 백업, dry-run 결과, apply 명령, 검증 쿼리를 별도 문서로 승인 |

## Auditor Verdict

```text
Auditor verdict: PASS
Phase: coffee_excel_import_dry_run
No DB write: YES
No import apply: YES
No PII sample output: YES
No deploy: YES
```
