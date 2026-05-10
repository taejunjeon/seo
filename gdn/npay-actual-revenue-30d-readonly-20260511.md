# NPay 결제완료 30일 매출 read-only 측정 (gpt0508-35 후속)

작성 시각: 2026-05-10 23:25:00 KST
실행 상태: **read-only PASS, 운영DB write 0**
자신감: 94% (운영 PG 직접 측정 + cancel/return 이중 필터)

## 한 줄 결론

NPay 결제완료 30일 매출은 **209건 / ₩3,763만 8,900** 이오. 이 풀이 통째로 ConfirmedPurchasePrep 분자에서 빠져 있었고, 합치면 internal ROAS가 0.27 → **약 1.86** (6.9배)로 회복돼 platform vs internal ROAS gap의 약 17%가 자동으로 해소되오.

## 1. 무엇을 / 왜 / 어떻게

| 항목 | 값 |
|---|---|
| 무엇을 | NAVERPAY_ORDER + PAYMENT_COMPLETE + cancellation_reason/return_reason 빈값 + final_order_amount > 0 의 30일 매출 분포 측정 |
| 왜 | 직전 sprint에서 건수만(210건) 확인됨. wire 전 internal ROAS가 얼마나 올라갈지 정량 추정에 필요. |
| 어떻게 | psql read-only `SELECT … WHERE payment_method='NAVERPAY_ORDER' AND payment_status='PAYMENT_COMPLETE' AND ord_date >= NOW() - INTERVAL '30 days'` |
| 어디에서 | 운영 PG `dashboard.public.tb_iamweb_users` (read-only) |

## 2. 결과 (사람이 이해하는 단위)

| 윈도우 | 건수 | 총액 | 평균 | 중앙값 | 상위10% | 최소 | 최대 |
|---|---|---|---|---|---|---|---|
| **30d** | **209** | **₩3,763만 8,900** | ₩18만 90 | ₩10만 9,200 | ₩49만 6,000 | ₩1만 1,900 | ₩97만 8,000 |
| 14d | 103 | ₩2,232만 7,000 | — | — | — | — | — |
| 7d | 56 | ₩1,069만 5,700 | — | — | — | — | — |

## 3. 데이터 품질 체크

| 검사 | 값 |
|---|---|
| PAYMENT_COMPLETE 30d 전체 (amount 필터 전) | 210건 |
| amount NULL 또는 0 | 1건 |
| amount 음수 | 0건 |
| amount 양수 | 209건 |
| PAYMENT_COMPLETE 안에 cancellation/return reason 보유 | 0건 (이중 검증 통과) |

→ 209건 / ₩3,763만 8,900 가 confirmed actual NPay 매출로 안전하게 인정 가능.

## 4. internal ROAS 영향 추정 (last_30d)

| 항목 | 현재 (gpt0508-33) | NPay 합류 후 (추정) | Δ |
|---|---|---|---|
| confirmed orders | 25 | 234 | +209 |
| confirmed revenue | ₩649만 | **₩4,413만** | +₩3,763만 |
| platform cost (변경 없음) | ₩2,366만 | ₩2,366만 | 0 |
| internal confirmed ROAS | 0.27 | **1.86** | **+1.59 (약 7배)** |
| platform ROAS (변경 없음) | 9.58 | 9.58 | 0 |
| ROAS gap | -9.31 | **-7.72** | gap 약 17% 축소 |

주의: 기존 25건 중 NPay 중복이 0이라고 가정. `npay_actual_count=0`이라는 직전 산출물 근거를 따른 가정이고, 실제 wire 후 dedupe 결과 약간 작아질 수 있소.

## 5. 핵심 정정 (사람이 이해하게)

- 이번 측정 결과는 **"실제 결제완료 매출 풀에 NPay 209건 ₩3,763만을 합류시킨다"**는 뜻이고, **"Google Ads 입찰 학습에 NPay 209건을 같이 보낸다"는 뜻이 아니오.**
- Google Ads upload는 여전히 별도 Red 승인 + exact click evidence(gclid/gbraid/wbraid + click_view exact 또는 Path B/paid_click_intent same-order exact)가 필요하오. 이번 측정만으로 upload 후보가 늘지 않소.
- platform ROAS 9.58 → 9.58 그대로. 진짜 정렬은 Google Ads 옵션 3(BI confirmed_purchase 신규 + 구매완료 Secondary 강등 + 7일 병행)이 같이 가야 풀리오.

## 6. 검증

| 검증 | 결과 | 명령 |
|---|---|---|
| 운영 PG read-only query | PASS | psql `SELECT …` 5개 |
| 운영DB write | 0 | SELECT only |
| raw email/phone/order/payment 저장 | 0 | 집계만 |
| platform send | 0 | 변경 없음 |

## 7. 다음 액션 (이 측정 직후)

### Codex가 할 일

1. **2순위: ConfirmedPurchasePrep builder에 NPay actual source wire**
   - 추천: 진행 추천
   - 자신감: 90%
   - Lane: Green code (backend route 변경, no platform send, no operational DB write)
   - 무엇을: ConfirmedPurchasePrep input pipeline에 운영 PG `tb_iamweb_users` read-only query 결과(NAVERPAY_ORDER + PAYMENT_COMPLETE + cancellation/return 빈값 + amount>0)를 actual confirmed로 라벨링
   - 왜: `npay_actual_count=0` 누락 해소, internal ROAS 0.27 → 1.86 회복
   - 어디에서: backend builder script + fixture
   - 성공 기준: 다음 input 갱신 시 `npay_actual_count`가 약 209로 증가, send_candidate=false 유지
   - 의존성: 본 측정 산출물 (방금 끝남)

2. **3순위: channel_order_no 기반 매칭 rail**
   - 추천: 진행 추천
   - 자신감: 86%
   - Lane: Green design + Yellow schema canary
   - 무엇을: `order_section_item_no` (channel_order_no) 100% 정합률 활용해 npay_intent_log/order_bridge_ledger와 hash-join할 schema/코드 stub
   - 의존성: 2순위 wire 후 진입 가능

3. **4순위: NPay 209건 중 Google Ads exact evidence 비율 측정**
   - 추천: 진행 추천
   - 자신감: 88%
   - Lane: Green read-only
   - 무엇을: NPay 209건 안에서 gclid/gbraid/wbraid + click_view exact 또는 Path B same-order exact 보유 row만 budget-usable 후보로 라벨
   - 왜: NPay 결제완료 ≠ Google Ads 기여 — 분리해야 upload 오염 방지
   - 의존성: 본 측정 + 직전 join-candidates JSON

## 8. Verdict

`READONLY_PASS_NPAY_30D_REVENUE_3763MAN_8900_BENCHMARK_FOR_WIRE`

산출 JSON: `data/npay-actual-revenue-30d-readonly-20260511.json`
