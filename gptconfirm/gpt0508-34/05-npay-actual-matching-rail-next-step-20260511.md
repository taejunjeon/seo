# NPay actual matching rail next-step (gpt0508-34)

작성 시각: 2026-05-10 22:35:00 KST
Lane: 본 산출물은 Green design. stage_2 schema 추가는 Yellow 승인 게이트.
자신감: 84% (tb_playauto_orders NPay channel_order_no 정합률 미지)

## 5줄 결론

1. NPay no-return 문제는 Path B로 억지 해결 말고 `npay_intent_log + 운영 PG payment_complete + Path B order_bridge_ledger` 3축으로 5단계 rail을 구성한다.
2. 현재 npay_intent_log에는 `intentKey + member/phone/email_hash + click_id`만 있고, `channel_order_no_hash / order_no_hash / payment_complete_at`이 없어 actual order와 reverse-link이 끊겨 있다.
3. 운영 PG `tb_playauto_orders`(read-only)에서 NPay payment_complete row를 가져오는 stage_3는 Green이라 즉시 시범 실행 가능.
4. 누락 컬럼 3개 추가는 stage_2 schema migration이라 Yellow 승인이 필요. 1h canary, max 50 rows, raw 저장 0 강제, DROP COLUMN rollback.
5. NPay click/count/add_payment_info를 actual purchase로 승격하는 일은 본 sprint도 절대 금지.

## 1. 현재 상태 audit

| 영역 | 값 |
|---|---|
| Intent log 모듈 | `backend/src/npayIntentLog.ts` |
| Intent log 엔드포인트 | `POST /api/attribution/npay-intent` (`backend/src/routes/attribution.ts:2379`) |
| Intent log 컬럼 | `intentKey`(PK), `matchStatus`, `duplicateCount`, `gclid/gbraid/wbraid/fbclid/ttclid`, `utm_source/medium/campaign`, `member_code_hash`, `phone_hash`, `email_hash` |
| 누락 컬럼 | `channel_order_no_hash`, `order_no_hash`, `payment_complete_at` |
| 운영 source of truth | `tb_playauto_orders + tb_iamweb_users` 운영 PG (read-only) + admin confirmed flag |
| VM dashboard 노출 | internal_confirmed.confirmedOrders 25 (last_30d) — NPay 분리 row 미노출 |
| ConfirmedPurchasePrep `npay_actual_count` | 0 (현재) |
| gpt0508-33 NPay missing 분포 | C 27건(UTM only) + D 107건(no UTM) = 134건 |

## 2. matching rail 5단계

### Stage 1 — intent capture (현재 운영 중, 변경 없음)
NPay 결제 시작 시점에 funnel-capi v3가 hash-only NPay intent row 적재. 이 단계는 이미 작동.

### Stage 2 — actual order link (Yellow 제안)
주문완료 시점에 channel_order_no/order_no를 hash해서 npay_intent_log에 reverse-link 컬럼 추가.

| 추가 컬럼 | 형식 | 비고 |
|---|---|---|
| channel_order_no_hash | TEXT | hash-only |
| order_no_hash | TEXT | hash-only |
| payment_complete_at | TEXT (ISO) | 운영 PG payment_complete_at 시각 |

- Lane: Yellow_proposed
- blast radius: small_local_sqlite_only
- rollback: `DROP COLUMN`

### Stage 3 — 운영 PG join (Green)
read-only query:
```sql
SELECT order_id, channel_order_no, payment_method, payment_complete_at
FROM tb_playauto_orders
WHERE payment_method = 'npay'
  AND payment_complete_at >= NOW() - INTERVAL '30 days';
```
운영 PG write 0. 결과는 stage_2 ledger의 `channel_order_no_hash`와 join.

### Stage 4 — Path B bridge overlay (Green)
Path B `order_bridge_ledger`의 hashed identity material과 stage_3 결과를 cross-reference. click_id_hash가 같은 row를 confirm. budget-usable은 Path B 작업1 canary 승인 후.

### Stage 5 — ConfirmedPurchasePrep label
PAYMENT_COMPLETE + admin confirmed flag만 actual purchase로 라벨링. 기대값: `npay_actual_count` 0 → 약 134건.

**금지 (변함 없음)**
- NPay click/count/add_payment_info를 actual purchase로 승격 ❌
- VM Cloud complete_time 공백만으로 NPay 미결제 판정 ❌

## 3. minimal hashed mapping canary (Yellow 제안)

| 항목 | 값 |
|---|---|
| 목적 | stage_2 schema 추가가 안전한지 1h 짧은 canary로 검증 |
| Lane | Yellow_proposed |
| Scope | biocom only |
| max_rows | 50 |
| 기간 | 1h |
| Rollback | `DROP COLUMN npay_intent_log.channel_order_no_hash, order_no_hash, payment_complete_at` |
| Smoke | pre/post row count diff, raw 저장 0 확인, platform_send_count 0 확인 |

승인 문구:
```
[승인] gpt0508-34 작업5 minimal hashed mapping canary:
npay_intent_log에 channel_order_no_hash / order_no_hash / payment_complete_at 컬럼 추가,
1h canary, max 50 rows, raw 저장 0 유지, rollback DROP COLUMN.
```

## 4. 다음 액션 우선순위

| 액션 | Lane | 즉시 가능 |
|---|---|---|
| Stage 3 read-only PG query 시범 실행 | Green | ✅ 즉시 |
| Stage 2 schema migration | Yellow | 승인 후 |
| Stage 4 Path B bridge overlay | Green | 데이터 누적 후 |
| Stage 5 ConfirmedPurchasePrep label 갱신 | Green (코드 변경 시 Yellow) | stage_2 PASS 후 |

## 5. 추천 옵션과 자신감

- 추천: **Stage 3 Green 우선 실행 → Stage 2 Yellow canary 승인 요청**
- 자신감: **84%**
- 미지: tb_playauto_orders의 NPay `channel_order_no` 정합률, 기존 npay_intent_log 누적량과 actual order 매칭 hit-rate.

## 6. Verdict

`DESIGN_READY_PG_READONLY_GREEN_PLUS_HASHED_CANARY_YELLOW_PROPOSED`

산출 JSON: `data/npay-actual-matching-rail-next-step-20260511.json`
