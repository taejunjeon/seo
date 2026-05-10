# NPay actual source wire + 매칭 rail + Google Ads exact evidence audit (gpt0508-35 후속)

작성 시각: 2026-05-10 23:40:00 KST
실행 상태: 1순위 ✅ / 2순위 ✅ helper+fixture / 3순위 ✅ design+rail / 4순위 ✅ audit
자신감: 91% (운영 PG 직접 측정 + helper typecheck/fixture PASS)

## 한 줄 결론

NPay 결제완료 209건 / ₩3,763만(30d)을 internal ROAS 분자에 합류시키면 0.27 → **약 1.86**으로 회복되고, 그중 Google Ads exact evidence를 가진 것은 **9건뿐**(6.3%)이라 Google Ads upload 후보(send/upload)는 본 sprint도 0이 유지되오. 즉 **"NPay actual 매출 = internal ROAS 분자에 합류"**와 **"Google Ads upload 후보"**를 분리하는 코드/문서 라인이 잡혔고, 둘 다 외부 전송 0이오.

## 사람이 이해하는 핵심 두 줄

**규칙1 — 매출 풀 합류와 광고 학습 신호는 완전히 분리한다.** NPay 209건 ₩3,763만은 "실제로 결제완료된 우리 매출"이라 internal confirmed ROAS 분자에 통째로 합치는 게 맞소. 그러나 그 209건 중 어떤 광고 캠페인이 들여보낸 손님인지 증명할 exact evidence(`gclid` + Google Ads click_view exact 매칭)가 있는 건 9건뿐이라, **Google Ads에 "이 209건은 우리 광고 덕"이라고 알려주는 행위(=upload)는 절대 못 한다.** UTM hint는 사람이 의심하는 단서지 학습 신호가 아니다.

**규칙2 — internal ROAS의 회복은 NPay 합류로, platform ROAS의 정렬은 Google Ads UI 변경으로 따로 풀어야 한다.** internal 0.27 → 1.86은 helper가 이미 측정해서 추정값을 박아 두었소(자동 fixture로 검증). platform 9.58은 Google Ads `구매완료(7130249515)` 메인 신호의 NPay 클릭 오염이 본체라 옵션 3(BI confirmed_purchase 신규 + 구매완료 강등)을 따로 가야 풀리오.

## 1순위 ✅ NPay 30일 매출 측정 결과

| 윈도우 | 건수 | 총액 | 평균 | 중앙값 | 상위10% | 최소 | 최대 |
|---|---|---|---|---|---|---|---|
| **30d** | **209** | **₩3,763만 8,900** | ₩18만 90 | ₩10만 9,200 | ₩49만 6,000 | ₩1만 1,900 | ₩97만 8,000 |
| 14d | 103 | ₩2,232만 7,000 | — | — | — | — | — |
| 7d | 56 | ₩1,069만 5,700 | — | — | — | — | — |

조건: `payment_method='NAVERPAY_ORDER'` AND `payment_status='PAYMENT_COMPLETE'` AND `cancellation_reason/return_reason` 빈값 AND `final_order_amount > 0`. PAYMENT_COMPLETE 안에 환불/취소 row 0건으로 이중 검증 통과.

산출 JSON: `data/npay-actual-revenue-30d-readonly-20260511.json`, `data/npay-actual-confirmed-pg-snapshot-30d-20260511.json`

## 2순위 ✅ ConfirmedPurchasePrep wire (helper + script + fixture)

### 코드 변경

| 파일 | 종류 | LOC | 검증 |
|---|---|---|---|
| `backend/src/npayActualConfirmedPgReader.ts` | 신규 helper 모듈 | 196 | typecheck PASS |
| `backend/scripts/npay-actual-confirmed-pg-snapshot.ts` | 신규 stand-alone script | 119 | typecheck PASS, 실행 PASS |
| `backend/tests/npay-actual-confirmed-pg-reader.test.ts` | 신규 fixture 테스트 | 80 | **4/4 PASS, 205ms** |

### Helper exports

- `fetchNpayActualConfirmedSnapshot(input)` — 운영 PG read-only NPay actual snapshot
- `estimateInternalRoasLift(snapshot, baseline)` — internal ROAS lift 계산 (NaN 안전)
- `NpayActualConfirmedSnapshot` / `NpayActualRoasContribution` 타입

### 실행 결과 (script 기준)

```
rows=209
total_krw=37,638,900
internal_roas_before=0.2744
internal_roas_after=1.8647
roas_lift=+1.5903 (약 6.8배)
```

### 핵심 invariant

- `send_candidate=false`, `actual_send_candidate=false`, `upload_candidate=false`
- `npay_click_to_actual_purchase=false`
- 운영DB write 0
- raw email/phone/order/payment 저장 0

### Builder integration은 다음 sprint

`confirmed-purchase-integrated-input-builder.ts`의 summary에 `npay_actual_confirmed_pg_count/revenue` 합산은 다음 sprint에 wire. 본 sprint는 helper + script + fixture로 정리.

## 3순위 ✅ channel_order_no 매칭 rail 설계

### 운영 PG identity audit (NPay 209건 / 30d)

| 키 | coverage | 주요 매핑 |
|---|---|---|
| `order_section_item_no` (channel_order_no) | **100%** | npay_intent_log.channel_order_no_hash (NEW) + order_bridge_ledger.channel_order_no_hash |
| `order_number` | 100% | order_no_hash (양쪽) |
| `customer_email` | 100% | email_hash |
| `customer_number` (phone) | 100% | phone_hash |

distinct channel_order_no = 145 (209 row / 145 unique 주문 = 평균 1.44 line per 주문).

### 5단계 rail 진행 상태

| stage | 이름 | 상태 |
|---|---|---|
| 1 | intent capture (현행) | DONE |
| 2 | schema migration (npay_intent_log + order_bridge_ledger 컬럼 추가) | **PENDING_PATH_B_CANARY_PASS** |
| 3 | 운영 PG read-only join helper | **DONE_AT_HELPER_LEVEL** (이번 sprint) |
| 4 | Path B order_bridge_ledger overlay | PENDING_LEDGER_ROW_ACCUMULATION |
| 5 | ConfirmedPurchasePrep label | WIRED_AT_HELPER (이번 sprint) |

산출 JSON: `data/npay-channel-order-no-matching-rail-design-20260511.json`

## 4순위 ✅ Google Ads exact evidence audit

### 결과: NPay 143건(prep candidates 기준) 중 exact evidence 9건만 budget-usable

| 버킷 | 정의 | 건수 | budget 사용 | upload 후보 |
|---|---|---|---|---|
| A | NPay + gclid + click_view exact | **9** | ✅ | 본 sprint 0 (별도 Red 승인 필요) |
| B | NPay + gbraid/wbraid + click_view exact | 0 | (가능 시 budget) | 동상 |
| C | NPay + Path B same-order exact | 0 | (가능 시 budget) | 동상 |
| D | NPay + paid_click_intent same-order exact | 0 | (가능 시 budget) | 동상 |
| E | NPay + click 부재 + UTM only | 27 | ❌ (진단만) | ❌ |
| F | NPay + click 부재 + UTM 없음 | 107 | ❌ | ❌ |

운영 PG 209건과 prep candidates 143건의 차이 66건은 builder가 GA4 `already_in_ga4` / VM evidence missing 등으로 일부 row를 candidates에서 제외하기 때문 — 다음 sprint builder integration 시 정합 비교.

### 사람이 이해하는 결정선

- 209건 전부 **internal ROAS 분자에 합류** ✅
- 9건만 **광고 예산 floor sample**(exact evidence) ✅
- **upload 후보**는 본 sprint에서도 0 — Google Ads에 "이 9건이 광고 덕"이라고 알려주려면 별도 Red 승인 필요
- UTM hint(예: `googleads_shopping_supplements_*` 9건)는 사람이 의심하는 단서지 budget·upload 신호 아님

산출 JSON: `data/npay-google-ads-exact-evidence-audit-20260511.json`

## 검증

| 검증 | 결과 | 명령 |
|---|---|---|
| backend typecheck | PASS | `npx tsc --noEmit` |
| backend fixture (npay reader) | PASS 4/4 | `npx tsx --test tests/npay-actual-confirmed-pg-reader.test.ts` |
| 운영 PG read-only query | PASS | psql `SELECT … WHERE payment_method='NAVERPAY_ORDER' …` |
| 운영DB write | 0 | SELECT only |
| raw PII 저장/로그 | 0 | hash-only export, 카운트만 |
| platform send | 0 | 변경 없음 |
| send_candidate / actual_send_candidate / upload_candidate | false / false / 0 | invariant 유지 |

## 진척 임팩트

| 항목 | 이전 | 이번 작업 후 (추정) |
|---|---|---|
| `npay_actual_count` (ConfirmedPurchasePrep) | 0 | helper 기준 약 209 (다음 sprint builder integration 후 노출) |
| internal_confirmed_revenue (30d) | ₩649만 | **₩4,413만** (NPay 합류) |
| internal_confirmed_roas (30d) | 0.27 | **약 1.86** (6.8배) |
| ROAS gap (-9.31) | -9.31 | **-7.72** (17% 축소) |
| upload_candidate_count | 0 | **0 유지** |
| platform actual send | 0 | 0 |

## 다음 할일

### Codex가 할 일

1. **(의존성: 작업1 Path B canary 결과 회수) ConfirmedPurchasePrep integrated builder summary에 NPay actual snapshot 합산**
   - 추천: 진행 추천
   - 자신감: 90%
   - Lane: Green code
   - 무엇을: integrated-input-builder.ts에 `--npay-actual-source-input` flag 추가, snapshot.rows/totalAmountKrw를 summary에 합산
   - 왜: helper로는 측정 끝났지만 실제 builder 출력 summary에 반영돼야 운영자가 dashboard에서 209/₩3,763만을 직접 보게 됨
   - 성공 기준: 다음 dry-run 출력 summary에 `npay_actual_confirmed_pg_count: 209`, `npay_actual_confirmed_pg_revenue_krw: 37638900` 노출
   - 의존성: 운영 backend builder는 이미 정상이므로 추가 의존성 없음

2. **(의존성: 작업1 Path B canary PASS) npay_intent_log schema 1h canary**
   - 추천: 진행 추천
   - 자신감: 86%
   - Lane: Yellow (이미 조건부 승인)
   - 무엇을: `npay_intent_log`에 channel_order_no_hash, order_no_hash, payment_complete_at 3컬럼 추가, max_rows 50, 1h
   - rollback: `DROP COLUMN IF EXISTS …`
   - 성공 기준: row 누적 시작 + raw 저장 0

3. **(독립) Path B canary 백그라운드 회수 결과 (24:04 KST 부근)**
   - 추천: 진행 추천
   - 자신감: 92%
   - 무엇을: VM에서 자동 원복된 결과 회수 + 작업1 결과 문서 갱신
   - 의존성: 시간 경과만 필요

### TJ님이 할 일

본 sprint 작업 1~4 모두 Codex 영역에서 끝났음. 추가 액션 없음. 다만 직전 sprint 인계 항목은 그대로 유지:
1. (인계) Google Ads UI에서 옵션 2(TechSol Off, 자신감 78%) 또는 옵션 3(BI confirmed_purchase 신규 + 구매완료 강등, 자신감 72%) 결정.
2. (인계) Meta Events Manager에서 Test Events 코드 발급 + backend `.env`에 `META_TEST_EVENT_CODE_BIOCOM` 추가.
3. (인계) 7010 화면에서 Data Trust Guard 카드 4개 노출 시각 확인.

## Verdict

`PASS_HELPER_PASS_FIXTURE_PASS_AUDIT_PASS_BUILDER_INTEGRATION_NEXT_SPRINT`
