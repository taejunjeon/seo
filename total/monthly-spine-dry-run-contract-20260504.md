# 2026년 4월 biocom 주문·결제 spine dry-run 계약

작성 시각: 2026-05-04 18:05 KST
기준 기간: 2026-04-01 00:00:00 ~ 2026-04-30 23:59:59 KST
대상: biocom
문서 성격: Green Lane read-only 계약 문서. 운영 DB write, API 배포, 광고 플랫폼 전송은 하지 않았다.

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - CLAUDE.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
    - docurule.md
  project_harness_read:
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
    - harness/npay-recovery/APPROVAL_GATES.md
    - harness/gdn/README.md
    - harness/gdn/RULES.md
    - harness/gdn/VERIFY.md
  required_context_docs:
    - total/!total.md
    - total/source-inventory-20260504.md
    - total/join-key-matrix-20260504.md
  lane: Green
  allowed_actions:
    - 운영 DB SELECT
    - 외부 API read-only 조회 설계
    - 로컬 파일/코드 열람
    - 문서 작성
    - dry-run 계약 설계
  forbidden_actions:
    - 운영 DB write/import/update
    - GTM 운영 게시
    - 광고 플랫폼 전환 송출
    - CAPI dispatcher 실행
    - backend 운영 반영
    - Imweb header/footer 수정
  source_window_freshness_confidence:
    source: "운영 Postgres public.tb_iamweb_users, public.tb_sales_toss read-only SELECT, total/source-inventory-20260504.md"
    window: "2026-04-01~2026-04-30 KST, queried around 2026-05-04 18:00 KST"
    freshness: "운영 Toss/Imweb fresh. 로컬 SQLite mirror stale. 이 문서 숫자는 API 구현 전 read-only sanity check."
    confidence: 0.9
```

## 10초 결론

2026년 4월 biocom 월별 spine은 아래 구조로 만들면 된다.

1. 아임웹 운영 주문을 `order_number` 1행으로 먼저 만든다.
2. Toss 운영 결제를 `payment_key` 1행으로 만든다.
3. Toss `order_id`에서 `-P1`, `_pay1` 같은 suffix를 제거한 `order_id_base`로 아임웹 `order_number`와 붙인다.
4. Toss에 없는 NPay와 정기결제는 아임웹 confirmed 주문을 별도 payment rail로 인정한다.
5. 무료결제, 입금기한초과, 취소전 주문은 revenue 0으로 두고, 애매한 주문은 `quarantine`으로 보낸다.

이 계약은 아직 채널 배정이 아니다. 여기서는 `돈 기준 주문 목록`만 만든다. Meta, TikTok, Google, Organic 분류는 다음 단계에서 Attribution VM과 붙인다.

## 고등학생 비유

이번 문서는 한 달 동안 팔린 영수증 묶음을 먼저 만드는 일이다. 어떤 광고를 보고 왔는지는 아직 보지 않는다. 먼저 “실제로 돈이 들어온 주문이 몇 건이고 얼마인가”를 맞춘 뒤, 그 주문마다 광고 이름표를 붙인다.

## 관련 문서

| 문서 | 역할 |
|---|---|
| [[!total|월별 유입 채널 매출 정합성 계획]] | 전체 로드맵 정본 |
| [[source-inventory-20260504|월별 채널 매출 source 목록]] | source별 역할과 최신성 |
| [[join-key-matrix-20260504|주문·결제 조인 키 매트릭스]] | 키 우선순위와 실패 처리 규칙 |
| [[attribution-vm-evidence-join-contract-20260504|Attribution VM evidence join 계약]] | 이 spine에 채널 증거를 붙이는 규칙 |

## read-only sanity check 결과

아래 숫자는 API 구현 전 운영 Postgres를 SELECT로 확인한 1차 sanity check다. 예산 판단용 최종 숫자가 아니라 dry-run 계약이 맞는지 보는 기준이다.

| 확인 | 결과 | 해석 |
|---|---:|---|
| 아임웹 2026년 4월 KST 주문 수 | 2,584건 | `order_date` KST 기준 `order_number` 단위 |
| 아임웹 주문금액 합계 | 501,819,447원 | `MAX(final_order_amount)` 주문 단위 합계 |
| 아임웹 NPay 결제완료 | 139건 / 24,525,000원 | Toss에 없으므로 아임웹 rail로 별도 인정 필요 |
| Toss biocom 결제 수 | 1,819건 | `store='biocom'`, `approved_at` KST 기준 |
| Toss 승인금액 | 491,100,850원 | Toss `total_amount` 합계 |
| Toss 취소금액 | 30,453,424원 | Toss `cancel_amount` 합계 |
| Toss 잔액 | 460,647,426원 | Toss `balance_amount` 합계 |
| 아임웹과 Toss `order_id_base` 매칭 | 1,818건 | 대부분 카드/가상계좌 결제 |
| Toss만 있고 아임웹 4월 주문에 없는 건 | 1건 / 69,900원 | `order_id_base=202603313902950`, 월 경계 이슈 후보 |

## 1차 net revenue 후보

아래는 계약 검증용 후보값이다. 월별 정본은 `confirmed net revenue`로 고정하되, A/B confidence rail만 바로 포함한다. C/D 또는 quarantine rail은 최종 close 전 별도 확인한다.

| join method | 주문 수 | 아임웹 주문금액 | Toss 승인금액 | Toss 잔액 | net 후보 |
|---|---:|---:|---:|---:|---:|
| `toss_order_id_base` | 1,818 | 462,471,056원 | 491,030,950원 | 460,577,526원 | 460,577,526원 |
| `imweb_npay_confirmed` | 139 | 24,525,000원 | 0원 | 0원 | 24,525,000원 |
| `imweb_subscription_confirmed` | 355 | 14,726,910원 | 0원 | 0원 | 14,726,910원 |
| `imweb_virtual_without_toss` | 1 | 70,000원 | 0원 | 0원 | 70,000원 |
| `quarantine_unmatched_revenue` | 1 | 26,481원 | 0원 | 0원 | 0원 |
| `zero_amount_non_revenue` | 270 | 0원 | 0원 | 0원 | 0원 |
| A/B confirmed net 합계 | 2,312 | 501,722,966원 | 491,030,950원 | 460,577,526원 | 499,829,436원 |
| C review | 1 | 70,000원 | 0원 | 0원 | 70,000원 |
| D/quarantine | 1 | 26,481원 | 0원 | 0원 | 0원 |

주의: `net_candidate` 전체를 그대로 예산 판단에 쓰지 않는다. A/B confirmed net `499,829,436원`은 채널 배정 대상이고, C review `70,000원`, D/quarantine `26,481원`, Toss-only month boundary `69,900원`은 별도 확인 대상이다.

## 아임웹에 있지만 Toss에 없는 주문 분해

| 결제수단 | 결제상태 | 주문 수 | 매출 | 처리 |
|---|---|---:|---:|---|
| `SUBSCRIPTION` | `PAYMENT_COMPLETE` | 355 | 14,726,910원 | confirmed subscription rail |
| `NAVERPAY_ORDER` | `PAYMENT_COMPLETE` | 139 | 24,525,000원 | confirmed NPay rail |
| `VIRTUAL` | `PAYMENT_OVERDUE` | 125 | 0원 | non-revenue |
| `FREE` | `PAYMENT_COMPLETE` | 101 | 0원 | non-revenue |
| `NAVERPAY_ORDER` | `REFUND_COMPLETE` | 16 | 0원 | non-revenue/refund complete |
| `SUBSCRIPTION` | `REFUND_COMPLETE` | 12 | 0원 | non-revenue/refund complete |
| `NAVERPAY_ORDER` | `CANCELLED_BEFORE_DEPOSIT` | 8 | 0원 | non-revenue |
| `VIRTUAL` | `CANCELLED_BEFORE_DEPOSIT` | 8 | 0원 | non-revenue |
| `VIRTUAL` | `PAYMENT_COMPLETE` | 1 | 70,000원 | confirmed but Toss missing, review |
| `SUBSCRIPTION` | `PARTIAL_REFUND_COMPLETE` | 1 | 26,481원 | quarantine until refund rule fixed |

## 시간 기준

| source | 사용할 기준 | 이유 |
|---|---|---|
| 아임웹 주문 | `order_date` KST 우선 | `payment_complete_time`은 UTC ISO로 저장되어 월 경계가 헷갈릴 수 있다 |
| Toss 결제 | `approved_at` KST 기준 | Toss 운영 원장 샘플이 KST 주문번호 날짜와 맞다 |
| NPay | 아임웹 `order_date` KST + `channelOrderNo` 보관 | 외부 결제 return에서 다른 주문번호가 보일 수 있다 |
| Attribution VM | `logged_at`, `approved_at` 모두 보관 | 유입 증거와 결제 증거의 발생 시점을 나눠야 한다 |

계약상 모든 API 응답은 `timezone=Asia/Seoul`, `date_start=2026-04-01`, `date_end=2026-04-30`, `queried_at`을 포함해야 한다.

## dry-run API 계약

권장 endpoint는 아래다. 구현 전 계약이며, 실제 backend 반영은 별도 코드 변경이다.

| 항목 | 값 |
|---|---|
| method | `GET` |
| path | `/api/total/monthly-spine` |
| required query | `site=biocom`, `month=2026-04`, `dry_run=1` |
| optional query | `include_rows=0/1`, `limit`, `offset`, `ledger_source=operational` |
| write 여부 | 없음 |
| 외부 전송 여부 | 없음 |

## 현재 로컬 실행물

| 항목 | 값 |
|---|---|
| script | `backend/scripts/monthly-spine-dry-run.ts` |
| 실행 명령 | `cd backend && npm exec -- tsx scripts/monthly-spine-dry-run.ts --site=biocom --month=2026-04` |
| JSON 실행 | `cd backend && npm exec -- tsx scripts/monthly-spine-dry-run.ts --site=biocom --month=2026-04 --json` |
| write 여부 | 없음 |
| send 여부 | 없음 |
| 운영 배포 여부 | 없음 |
| contract version | `monthly-spine-dry-run-v0.2` |
| 검증 결과 | A/B confirmed net, C review, D/quarantine, month boundary 분리 출력 확인 |

## 응답 필드 계약

| 영역 | 필드 |
|---|---|
| metadata | `site`, `month`, `timezone`, `date_start`, `date_end`, `queried_at`, `contract_version` |
| source freshness | `imweb_source_max_order_date`, `toss_source_max_approved_at`, `attribution_vm_latest_logged_at`, `local_cache_status` |
| summary | `orders_total`, `revenue_gross`, `refund_amount`, `confirmed_net_revenue_ab`, `review_revenue_c`, `quarantine_revenue_d`, `toss_only_month_boundary_revenue`, `zero_amount_orders` |
| join summary | `join_method`, `orders`, `gross_revenue`, `net_revenue`, `confidence` |
| payment rail summary | `toss`, `npay`, `subscription`, `virtual`, `free`, `quarantine` |
| row fields | `order_number`, `channel_order_no`, `payment_key`, `order_id`, `order_id_base`, `payment_method`, `payment_status`, `gross_revenue`, `refund_amount`, `net_revenue`, `join_method`, `join_confidence`, `unknown_reason` |

## join method enum

| enum | 의미 | confidence | net revenue 규칙 |
|---|---|---:|---|
| `toss_payment_key_exact` | `payment_key` exact로 붙음 | A 97% | Toss `balance_amount` |
| `toss_order_id_base` | Toss `order_id_base`와 아임웹 `order_number`가 붙음 | A- 93% | Toss `balance_amount` |
| `imweb_npay_confirmed` | 아임웹 NPay 결제완료 | B+ 88% | 아임웹 `final_order_amount` |
| `imweb_subscription_confirmed` | 아임웹 정기결제 완료 | B+ 86% | 아임웹 `final_order_amount` |
| `imweb_virtual_without_toss` | 아임웹 가상계좌 결제완료이나 Toss 미조인 | C 65% | 임시 포함 또는 quarantine 후보 |
| `zero_amount_non_revenue` | 무료/입금초과/취소전/환불완료 0원 주문 | A 95% | 0원 |
| `quarantine_unmatched_revenue` | 금액이 있으나 규칙이 미확정 | D 40% | 0원 또는 별도 보류 |
| `toss_only_month_boundary` | Toss에는 있으나 같은 월 아임웹 주문에 없음 | C 60% | 월 경계 확인 전 보류 |

## unknown/quarantine reason enum

| enum | 사람이 이해할 말 | 다음 확인점 |
|---|---|---|
| `month_boundary_toss_only` | 결제는 이번 달인데 주문일은 전월/익월일 수 있음 | 아임웹 `order_date`, Toss `approved_at` timezone |
| `imweb_virtual_toss_missing` | 아임웹 가상계좌 완료인데 Toss가 없음 | Toss API payment lookup |
| `subscription_partial_refund_rule_missing` | 정기결제 부분환불 규칙 미정 | 정기결제 net 계산식 |
| `npay_confirmed_without_intent` | NPay confirmed 주문은 있으나 intent 매칭 전 | `npay_intent_log` time/product/session |
| `zero_amount_order` | 매출이 없는 주문 | 예산 판단 제외 |
| `site_unresolved` | site를 확정하지 못함 | payment key/store/landing host |
| `ga4_raw_blocked` | GA4 raw 권한이 없어 세션 원인 분해 불가 | BigQuery Data Viewer 권한 |

## 산출 성공 기준

| 기준 | 성공 |
|---|---|
| 주문 중복 제거 | `order_number` 1개당 spine 1행 |
| 금액 과대 방지 | 아임웹 주문금액은 `MAX(final_order_amount)` 사용 |
| Toss 조인 | 카드/가상계좌 주요 결제가 `order_id_base`로 대부분 붙음 |
| NPay 분리 | NPay는 Toss 미조인 실패가 아니라 별도 rail로 표시 |
| quarantine | 애매한 금액 주문이 별도 reason으로 빠짐 |
| 메타데이터 | source, window, timezone, queried_at, freshness, confidence 포함 |

## 승인 경계

| 작업 | 승인 필요 |
|---|---|
| 이 계약 문서 유지 | NO |
| 운영 DB SELECT로 dry-run 재계산 | NO |
| 로컬 backend에 read-only route/script 추가 | NO, 단 배포는 별도 |
| 운영 backend 배포 | YES |
| NPay/GA4/Meta/Google 전환 전송 | YES |
| 운영 DB write/import/update | YES |

## Codex가 다음에 바로 할 일

| 순서 | 작업 | 왜 하는가 | 성공 기준 | 승인 필요 | 추천 |
|---:|---|---|---|---|---:|
| 1 | 운영 NPay intent source를 연결해 139건 matching을 재실행한다 | 로컬 `npay_intent_log` 0건 기준으로 unmatched 결론을 내리면 오판이다 | `sourceAccess=available`, `liveIntentCount>0`, 139건 matched/ambiguous/unmatched 분포가 나온다 | YES, token/snapshot 필요 | 82% |
| 2 | 플랫폼 API reference value를 월별 window로 붙인다 | skeleton만 있으면 플랫폼 gap 숫자를 아직 계산할 수 없다 | Meta/TikTok/Google/Naver value가 `platformReference`에 source metadata와 함께 남는다 | NO, read-only API만 | 81% |
| 3 | script를 local API route로 승격할지 판단한다 | `/total` 화면에서 호출할 수 있는 데이터 계약이 필요할 수 있다 | route 구현 또는 보류 사유가 남는다 | 로컬 구현 NO, 운영 배포 YES | 82% |

## TJ님이 할 일

운영 NPay intent 재실행에는 token 또는 VM SQLite snapshot이 필요하다. platformReference skeleton과 `/total` API 계약은 Codex가 read-only로 진행 완료했다.

나중에 운영 배포, GA4 raw 권한, 전환 송출이 필요해질 때만 TJ님 승인 또는 계정 작업이 필요하다.

| 조건 | TJ님 요청 | 이유 | 추천 |
|---|---|---|---:|
| 로컬 dry-run을 운영 대시보드에 붙일 때 | backend 배포 승인 | API 노출과 운영 화면 변경이 생기기 때문 | 82% |
| GA4 raw로 `transaction_id`를 분해할 때 | BigQuery Data Viewer 권한 부여 | 현재 biocom GA4 raw permission denied | 88% |

## 변경 기록

| 시각 | 변경 |
|---|---|
| 2026-05-04 18:05 KST | 최초 작성. 2026년 4월 biocom 주문·결제 spine dry-run 계약, read-only sanity check, API/응답 필드/enum 기준 정리 |
| 2026-05-04 18:01 KST | `backend/scripts/monthly-spine-dry-run.ts` 로컬 실행물과 검증 명령 추가. 다음 작업을 Attribution VM evidence join 계약으로 갱신 |
| 2026-05-04 18:04 KST | `confirmed net revenue=YES` 반영. A/B confirmed net `499,829,436원`, C review `70,000원`, D/quarantine `26,481원`, month boundary `69,900원` 분리. [[attribution-vm-evidence-join-contract-20260504]] 연결 |
| 2026-05-04 18:12 KST | `backend/scripts/monthly-evidence-join-dry-run.ts` 검증 완료 반영. 2026년 4월 A/B spine channel 후보 산출 완료 후 다음 작업을 NPay intent 매칭과 channel assignment v0.2로 갱신 |
| 2026-05-04 18:27 KST | `monthly-evidence-join-dry-run-v0.2` 결과 반영. 다음 작업을 paid_naver 샘플 감사와 운영 NPay intent source 연결로 갱신 |
| 2026-05-04 18:28 KST | paid_naver 샘플 감사 완료 반영. 다음 작업을 platform_reference skeleton과 운영 NPay intent source 연결로 갱신 |
| 2026-05-04 18:51 KST | platformReference skeleton과 `/total` API 계약 완료 반영. 다음 작업을 운영 NPay intent source와 플랫폼 API reference value 연결로 갱신 |
