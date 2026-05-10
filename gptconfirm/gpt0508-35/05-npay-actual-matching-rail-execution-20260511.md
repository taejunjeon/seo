# NPay actual matching rail 실행 결과 (gpt0508-35)

작성 시각: 2026-05-10 23:05:00 KST
실행 상태: **Stage 3 (운영 PG read-only) PASS, Stage 2 (schema canary) HOLD — Path B canary 의존**
자신감: 91% (PG 쿼리 결과 명확)

## 5줄 결론 (사람이 이해하는 언어로)

1. NPay 결제 흐름 5단계 중 **3단계인 운영 DB 읽기**를 실제로 돌려봤소. 30일 동안 NPay로 들어온 주문은 237건, 그중 실제 결제완료(PAYMENT_COMPLETE)는 **210건**이오.
2. 환불 17건과 미입금 취소 8건은 빼야 하지만, 결제완료 210건 모두 channel_order_no(`order_section_item_no`)가 채워져 있어 다른 시스템과 연결할 키가 100% 살아 있소.
3. 즉 지금 ConfirmedPurchasePrep의 `npay_actual_count = 0` 은 운영DB의 **NPay 결제완료 210건을 통째로 누락**하고 있다는 뜻이오.
4. 다만 schema 변경(`npay_intent_log`에 `channel_order_no_hash` 등 3컬럼 추가)은 본 sprint 작업1(Path B canary)이 PASS한 뒤에만 진행하는 조건부 승인이라, 이번엔 HOLD요.
5. Path B canary가 PASS하면 다음 sprint에서 Stage 2 schema 추가 + 매칭 코드 wire를 묶어 진행하면 NPay actual 210건이 자연스럽게 internal ROAS 분자로 합류할 수 있소.

## 1. 무엇을 / 왜 / 어떻게

| 항목 | 값 |
|---|---|
| 무엇을 | 운영 PG `tb_iamweb_users` read-only로 NPay 30d 결제완료 분포 측정 |
| 왜 | NPay no-return 문제로 가맹점이 channel_order_no를 못 받는 케이스가 있다고 알려졌으나, 운영 PG 기준 정합률을 직접 확인해서 schema 추가 전 검증 |
| 어떻게 | psql `SELECT … FROM public.tb_iamweb_users WHERE ord_time >= NOW() - INTERVAL '30 days'` (write 없음) |
| 어디에서 | 운영 PG (`postgresql://...@34.47.95.104:5432/dashboard`) — DATABASE_URL backend/.env |

## 2. Stage 3 결과 (운영 PG 30d)

### 2.1 결제수단 전체 분포 (30d)
| payment_method | 건수 |
|---|---|
| CARD | 1,803 |
| SUBSCRIPTION | 473 |
| NAVERPAY_ORDER | **237** |
| VIRTUAL | 234 |
| FREE | 93 |

### 2.2 NPay (NAVERPAY_ORDER) 30d payment_status 분포
| payment_status | 건수 | 의미 |
|---|---|---|
| **PAYMENT_COMPLETE** | **210** | 실제 결제완료 — actual confirmed 후보 |
| REFUND_COMPLETE | 17 | 환불 완료 — confirmed에서 제외 |
| CANCELLED_BEFORE_DEPOSIT | 8 | 미입금 취소 |
| PAYMENT_PREPARATION | 2 | 결제 준비 단계, 미확정 |

### 2.3 키 정합성
- channel_order_no(=`order_section_item_no`) 정합률: 237/237 = **100%**
- payment_complete_time 채워짐: 227/237 = 96%

## 3. 핵심 발견

**현재 ConfirmedPurchasePrep `npay_actual_count` = 0** (gpt0508-33 산출물 기준)이오.
운영 PG에는 30일 동안 NPay 결제완료가 **210건** 있소. 즉 지금 systemd는 운영 actual confirmed NPay를 통째로 누락하고 있다는 뜻이오.

이걸 보강하면:
- internal ROAS 분자에 NPay actual 매출이 합류 → ROAS gap이 자연스럽게 줄어든다
- platform ROAS와 internal ROAS의 비교 신뢰도가 올라간다

## 4. Stage 2 (schema canary) 보류 사유

본 작업의 조건부 승인 문구는:
> Stage 2 npay_intent_log 3컬럼 추가 canary는 Path B canary PASS 후에만 진행

본 sprint 작업1(Path B 1h canary)이 VM admin 권한 부재로 미실행 → Stage 2 진입 게이트 미통과 → 본 sprint에서 schema 변경 0.

## 5. Stage 2 준비 완료 사항 (Path B PASS 시 즉시 실행 가능)

| 항목 | 값 |
|---|---|
| 추가 컬럼 | `channel_order_no_hash`, `order_no_hash`, `payment_complete_at` |
| 형식 | hash-only (raw 저장 차단) |
| max_rows | 50 |
| canary 기간 | 1h |
| rollback | `ALTER TABLE npay_intent_log DROP COLUMN IF EXISTS channel_order_no_hash; ...` (3 DROP) |

## 6. 검증

| 검증 | 결과 | 명령 |
|---|---|---|
| PG read-only query | PASS | psql 5회 (스키마 + 분포 + 정합률) |
| 운영DB write | 0 | SELECT only |
| raw email/phone/order/payment 저장 | 0 | aggregate 카운트만, raw row 미저장 |
| platform send | 0 | 변경 없음 |

## 7. 다음 할일

### TJ님이 할 일
1. Path B canary 1h를 VM에서 실행 (작업1 결과 문서 5절 절차).
   - Path B PASS 시 → Codex가 Stage 2 schema canary 자동 진행 가능 단계로 넘어감.
   - 추천: 진행 추천
   - 자신감: 88%
   - Lane: Yellow

### Codex가 할 일
1. Path B canary PASS 받으면 Stage 2 schema 추가 1h canary 자동 진행.
   - 의존성: 작업1 PASS
   - 추천: 진행 추천
   - 자신감: 90%
   - 성공 기준: schema 추가 후 row 누적 시작, raw 저장 0, rollback DROP COLUMN 1회로 회복 가능

2. 다음 sprint(gpt0508-36)에서 ConfirmedPurchasePrep builder가 `payment_status='PAYMENT_COMPLETE'` AND `payment_method='NAVERPAY_ORDER'`인 운영 row를 actual confirmed로 라벨링하도록 wire.
   - 의존성: Stage 2 PASS
   - 추천: 진행 추천
   - 자신감: 86%
   - 성공 기준: ConfirmedPurchasePrep `npay_actual_count` 0 → 약 210 (30d window)으로 증가

## 8. 금지 (변함 없음)

- NPay click/count/add_payment_info를 actual purchase로 승격 ❌
- VM Cloud complete_time 공백만으로 NPay 미결제 판정 ❌
- 운영 PG write ❌
- raw 저장 또는 logging ❌

## 9. Verdict

`STAGE_3_GREEN_PASS_NPAY_ACTUAL_210_30D_STAGE_2_HOLD_ON_PATH_B`

산출 JSON: `data/npay-actual-matching-rail-execution-20260511.json`
