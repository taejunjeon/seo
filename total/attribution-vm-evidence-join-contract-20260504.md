# Attribution VM evidence join 계약

작성 시각: 2026-05-04 18:27 KST
기준 기간: 2026-04-01 00:00:00 ~ 2026-04-30 23:59:59 KST
대상: biocom
문서 성격: Green Lane read-only 계약 문서. 운영 DB write, API 배포, GTM 게시, CAPI/GA4/광고 플랫폼 전환 송출은 하지 않았다.

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
    - total/monthly-spine-dry-run-contract-20260504.md
    - meta/meta-marketing-intent-gtm-plan-20260504.md
    - naver/!npayroas.md
  lane: Green
  allowed_actions:
    - 운영 DB SELECT
    - Attribution VM read-only API 조회
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
    source: "운영 Postgres spine dry-run, Attribution VM /api/attribution/ledger read-only, 기존 Meta/NPay 정본 문서"
    window: "2026-04-01~2026-04-30 KST, queried around 2026-05-04 18:26 KST"
    freshness: "운영 Toss/Imweb fresh. Attribution VM fresh. 2026년 4월 VM window에는 payment_success/checkout_started가 있고 marketing_intent는 5월 이후 중심."
    confidence: 0.89
```

## 10초 결론

월별 채널 매출은 `확정된 돈`에 `유입 증거`를 붙여서 만든다.

2026년 4월 biocom 기준 월별 매출 정본은 `confirmed net revenue`로 고정한다. 단, 정본에 바로 넣는 것은 A/B confidence rail만이다.

| rail | 2026년 4월 금액 | 처리 |
|---|---:|---|
| A/B confirmed net revenue | 499,829,436원 | 월별 채널 배정 대상 |
| C review revenue | 70,000원 | 최종 close 전 확인 대상 |
| D/quarantine revenue | 26,481원 | 정본 제외, 사유 확인 |
| Toss-only month boundary | 69,900원 | 귀속월 확인 전 보류 |
| C까지 포함한 1차 후보 | 499,899,436원 | 참고값. 예산 판단 정본 아님 |

Attribution VM evidence join은 이 A/B confirmed 주문에 `primary_channel`, `assist_channels`, `channel_evidence`, `evidence_confidence`, `unknown_reason`, `assignment_version`, `source_freshness`를 붙이는 작업이다.

플랫폼 conversion value만 있는 주문은 내부 primary channel로 배정하지 않는다. `platform_reference`로만 남긴다.

## 고등학생 비유

주문·결제 spine은 실제 결제 영수증 묶음이다. Attribution VM evidence join은 각 영수증 옆에 “이 손님은 어떤 길로 왔는가”라는 표식을 붙이는 일이다.

광고 플랫폼이 “내 광고 덕분”이라고 말해도, 영수증과 연결되는 증거가 없으면 그 매출을 광고 채널에 넣지 않는다.

## 관련 문서

| 문서 | 역할 |
|---|---|
| [[!total|월별 유입 채널 매출 정합성 계획]] | 전체 로드맵 정본 |
| [[monthly-spine-dry-run-contract-20260504|2026년 4월 주문·결제 spine 계약]] | 돈 기준 주문 목록 |
| [[join-key-matrix-20260504|주문·결제 조인 키 매트릭스]] | 주문/결제 키 우선순위 |
| [[source-inventory-20260504|월별 채널 매출 source 목록]] | source별 최신성 |
| [[../meta/meta-marketing-intent-gtm-plan-20260504|Meta marketing_intent 계획]] | Meta first-touch 보강 기준 |
| [[../naver/!npayroas|NPay ROAS 정합성 문서]] | NPay intent와 purchase 분리 기준 |

## 2026년 4월 VM evidence source 상태

Attribution VM read-only API:

```text
GET https://att.ainativeos.net/api/attribution/ledger
  ?source=biocom_imweb
  &startAt=2026-03-31T15:00:00.000Z
  &endAt=2026-04-30T15:00:00.000Z
```

| 항목 | 값 | 해석 |
|---|---:|---|
| VM ledger rows | 5,716 | 2026년 4월 KST window |
| `payment_success` | 1,979 | 결제 완료/상태 sync 근거 |
| `checkout_started` | 3,737 | 결제 전 단계 유입 앵커 |
| `marketing_intent` | 0 | 2026년 4월 window에는 없음. 5월 이후 적용 중심 |
| confirmed payment_success | 1,664 | 내부 confirmed evidence 후보 |
| pending payment_success | 196 | 정본 배정 보류 |
| canceled payment_success | 119 | 정본 배정 제외 |
| VM confirmed revenue | 454,855,209원 | VM 자체 confirmed 값. 주문·결제 spine 정본과 다를 수 있음 |
| latest logged_at | 2026-04-30T14:58:43.666Z | 4월 말까지 fresh |

## VM 필드 채움률

이 표는 VM evidence가 어떤 키로 spine과 붙을 수 있는지 보는 기준이다.

| touchpoint | rows | `payment_key` | `order_id` | `orderIdBase` | `checkout_id` | `ga_session_id` | `clientId` | UTM rows | `fbclid/fbc` | `ttclid` | `gclid` |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `payment_success` | 1,979 | 1,785 / 90.2% | 1,979 / 100% | 1,495 / 75.5% | 1,353 / 68.4% | 1,468 / 74.2% | 1,470 / 74.3% | 1,253 / 63.3% | 845 / 42.7% | 49 / 2.5% | 31 / 1.6% |
| `checkout_started` | 3,737 | 0 / 0% | 1,244 / 33.3% | 1,244 / 33.3% | 3,737 / 100% | 3,543 / 94.8% | 3,578 / 95.7% | 2,094 / 56.0% | 1,359 / 36.4% | 38 / 1.0% | 309 / 8.3% |

해석:

| 판단 | 의미 |
|---|---|
| `payment_success.order_id=100%` | 4월 카드/가상계좌 계열은 order base 조인이 강하다 |
| `payment_success.payment_key=90.2%` | Toss 조인의 가장 강한 키가 대체로 살아 있다 |
| `checkout_started.checkout_id=100%` | 결제 전 단계와 payment_success를 이어붙일 수 있는 앵커가 있다 |
| `marketing_intent=0` | 4월 historical 배정은 checkout/payment 중심으로 하고, 5월 이후는 landing intent를 추가한다 |
| VM confirmed revenue 454,855,209원 | 주문·결제 spine A/B 정본 499,829,436원보다 낮으므로 VM만 매출 정본으로 쓰면 안 된다 |

## output field 계약

주문·결제 spine row에 아래 필드를 붙인다.

| 필드 | 의미 |
|---|---|
| `primary_channel` | 최종으로 매출을 귀속할 채널 1개 |
| `assist_channels` | 구매 전 관여했지만 합계에는 중복 반영하지 않는 보조 채널 목록 |
| `channel_evidence` | 어떤 원장 row와 어떤 키로 채널을 판단했는지 |
| `evidence_confidence` | A/B/C/D |
| `evidence_tier` | 사람이 읽는 등급명. 예: `paid_click_payment_key`, `checkout_first_touch`, `session_referrer` |
| `assignment_version` | 배정 규칙 버전. 예: `channel-assignment-v0.1-20260504` |
| `unknown_reason` | 배정 실패 또는 보류 사유 |
| `source_freshness` | Toss/Imweb/VM/GA4 최신성 |
| `platform_reference` | Meta/TikTok/Google이 주장하는 conversion value. 내부 매출에는 합산 금지 |
| `debug_join_keys` | `payment_key`, `order_id_base`, `checkout_id`, `ga_session_id`, `client_id` 매칭 내역 |

## primary channel enum

| channel | 뜻 | 대표 증거 |
|---|---|---|
| `paid_meta` | Meta 광고 유입 | `fbclid`, `_fbc`, `_fbp`, Meta UTM, instagram/facebook referrer |
| `paid_tiktok` | TikTok 광고 유입 | `ttclid`, TikTok UTM, TikTok referrer |
| `paid_google` | Google Ads 유입 | `gclid`, `gbraid`, `wbraid`, Google Ads UTM |
| `paid_naver` | Naver paid 유입 | Naver paid UTM, `NaPm` 유료 캠페인 근거 |
| `npay` | NPay confirmed 주문 | 아임웹 `NAVERPAY_ORDER` confirmed. intent는 보조 |
| `organic_search` | 자연 검색 | 검색 referrer 또는 GA4 organic raw |
| `referral` | 외부 사이트 referral | 외부 referrer |
| `crm` | 카카오/문자/이메일 등 CRM | CRM UTM 또는 내부 campaign |
| `direct` | 직접/북마크/앱 재방문 | paid/organic/referral 증거가 없을 때만 |
| `unknown` | 유입 증거 없음 | 결제는 있으나 source 근거 없음 |
| `quarantine` | 충돌 또는 보류 | 증거 충돌, site 불명, C/D rail |

## evidence confidence 등급

| 등급 | 조건 | 정본 매출 포함 | 예산 판단 사용 |
|---|---|---|---|
| A | A/B spine 주문 + confirmed `payment_success` + `payment_key` 또는 `order_id_base` 직접 조인 + click id/UTM 근거 | YES | YES |
| B | A/B spine 주문 + `checkout_id`, `order_id_base`, `ga_session_id+client_id`로 checkout/firstTouch 조인 + paid/organic/referrer 근거 | YES | YES, 단 주간 샘플 감사 |
| C | 주문은 confirmed이나 유입 근거가 referrer/session/일반 UTM뿐이거나 payment rail 자체가 C급 | 별도 review | 보수적으로 표시 |
| D | 플랫폼 주장값만 있거나 증거 충돌, site 불명, purchase 미확정 | NO | NO |

구체적인 tier:

| tier | confidence | 설명 |
|---|---|---|
| `paid_click_payment_key` | A | 결제키 또는 order base로 붙은 confirmed 주문에 paid click id가 있음 |
| `paid_click_checkout_id` | B | checkout_started firstTouch에 paid click id가 있고 payment_success와 checkout_id로 연결 |
| `paid_utm_order_base` | B | click id는 없지만 표준 paid UTM과 order base가 있음 |
| `organic_referrer_checkout` | B/C | checkout/payment referrer가 검색/외부 유입 |
| `npay_confirmed_intent_matched` | B | NPay confirmed 주문과 NPay intent가 시간/상품/세션으로 붙음 |
| `session_only` | C | ga_session_id/client_id만 있음 |
| `direct_no_paid_evidence` | C | paid/organic/referral이 없고 direct만 있음 |
| `platform_reference_only` | D | 플랫폼 API 값만 있고 내부 evidence 없음 |
| `conflicting_paid_clicks` | D | 같은 주문에 서로 다른 paid 채널 강증거가 충돌 |

## join 순서

| 순서 | 조인 | 사용 키 | 성공 시 |
|---:|---|---|---|
| 1 | spine A/B row를 기준으로 시작 | `order_number`, `payment_key`, `order_id_base` | confirmed revenue 대상 확정 |
| 2 | VM `payment_success` 직접 조인 | `payment_key` exact, `order_id_base`, `metadata.referrerPayment.orderNo` | A 후보 |
| 3 | embedded `metadata.firstTouch` 사용 | `payment_success.metadata.firstTouch` | 기존 firstTouchMatch 결과를 우선 신뢰 |
| 4 | VM `checkout_started` 조인 | `checkout_id`, `order_id_base`, `ga_session_id+client_id`, payment 전 24시간 | B 후보 |
| 5 | VM `marketing_intent` 조인 | `ga_session_id+client_id`, click id, payment 전 7일 | 5월 이후 landing intent 보강 |
| 6 | NPay intent 조인 | NPay confirmed order + `npay_intent_log` 시간/상품/세션 | B/C 후보. purchase 전송 금지 |
| 7 | GA4 raw 조인 | `transaction_id`, `ga_session_id`, `user_pseudo_id` | biocom 권한 전까지 보류 |
| 8 | 플랫폼 API reference 연결 | campaign/ad id, platform spend/value | `platform_reference`만 |

## channel conflict rule

| 상황 | 처리 |
|---|---|
| paid evidence와 direct가 같이 있음 | paid를 primary, direct는 무시 또는 assist에서 제외 |
| Meta와 Google 강증거가 동시에 있음 | 결제에 가장 가까운 `last paid evidence`를 primary, 더 이른 paid는 assist |
| first-touch paid와 last paid가 다름 | last paid를 primary, first-touch는 `assist_channels`에 보관 |
| paid click id와 UTM이 서로 다른 채널 | click id가 UTM보다 우선. 그래도 충돌하면 `quarantine/conflicting_paid_clicks` |
| 플랫폼 API만 conversion value 주장 | primary 배정 금지, `platform_reference`만 |
| NPay intent만 있음 | purchase 아님. primary 배정 금지 |
| referrer가 direct이고 과거 paid evidence가 있음 | direct가 paid를 덮지 못함 |
| 내부 링크 UTM이 있음 | 외부 source를 덮지 못함. `internal_utm_ignored`로 기록 |

## NPay 규칙

NPay는 일반 카드결제와 다르게 구매자가 biocom 완료 페이지로 돌아오지 않을 수 있다.

| 규칙 | 처리 |
|---|---|
| 아임웹 `NAVERPAY_ORDER` + `PAYMENT_COMPLETE` | revenue spine에는 포함 |
| `npay_intent_log`만 있음 | purchase 아님 |
| confirmed NPay 주문 + intent time/product/session match | `npay_confirmed_intent_matched` B 후보 |
| confirmed NPay 주문 + intent 없음 | `npay_confirmed_without_intent` C 후보 |
| intent와 주문이 애매함 | `npay_intent_ambiguous` quarantine |
| GA4/Meta/Google 전송 | 이 계약 범위 밖. 별도 승인 전 금지 |

## 합계 검증

월별 close에서 반드시 아래 식이 맞아야 한다.

```text
sum(primary_channel.net_revenue where confidence in A/B)
= confirmed_net_revenue_ab
= 499,829,436원 for 2026-04 biocom sanity window
```

검증 규칙:

| 검증 | 성공 기준 |
|---|---|
| primary channel 합계 | A/B confirmed net revenue와 정확히 일치 |
| assist channel | 합계에 중복 반영하지 않음 |
| C review | primary summary와 별도 표시 |
| D/quarantine | 매출 정본 제외 |
| platform reference | 내부 revenue에 합산 금지 |
| source freshness | Toss/Imweb/VM queried_at과 latest timestamp 표시 |

## coverage metrics

evidence join dry-run은 아래 지표를 반드시 출력한다.

| 지표 | 의미 |
|---|---|
| `orders_total_ab` | A/B confirmed spine 주문 수 |
| `revenue_total_ab` | A/B confirmed net revenue |
| `assigned_orders` | primary channel이 정해진 주문 수 |
| `assigned_revenue` | primary channel이 정해진 매출 |
| `unknown_orders` | source 근거가 없는 주문 수 |
| `unknown_revenue` | source 근거가 없는 매출 |
| `quarantine_orders` | 충돌/보류 주문 수 |
| `quarantine_revenue` | 충돌/보류 매출 |
| `paid_meta_a_b_revenue` | Meta A/B confirmed 매출 |
| `paid_tiktok_a_b_revenue` | TikTok A/B confirmed 매출 |
| `paid_google_a_b_revenue` | Google A/B confirmed 매출 |
| `platform_gap_by_channel` | 플랫폼 주장값과 내부 confirmed 차이 |

## 2026년 4월 특이 케이스

아래 3개는 최종 close 전 별도 확인 대상이다.

| case | order/payment key | 금액 | 처리 |
|---|---|---:|---|
| `toss_only_month_boundary` | `202603313902950-P1`, `iw_bi20260331160340r3vM2` | 69,900원 | 귀속월 확인 전 보류 |
| `imweb_virtual_without_toss` | `202604132186385` | 70,000원 | C review. Toss API lookup 필요 |
| `subscription_partial_refund_rule_missing` | `202604159974553` | 26,481원 | D/quarantine. 정기결제 부분환불 규칙 필요 |

## dry-run 구현 계약

이 계약의 첫 read-only 실행물은 아래 script로 만든다.

| 항목 | 값 |
|---|---|
| script | `backend/scripts/monthly-evidence-join-dry-run.ts` |
| 입력 | `--site=biocom --month=2026-04 --json` |
| 선행 입력 | `backend/scripts/monthly-spine-dry-run.ts --json` |
| VM source | `GET /api/attribution/ledger?source=biocom_imweb&startAt=...&endAt=...` |
| write/send/deploy | 없음 |
| 출력 | channel summary, coverage metrics, unknown/quarantine reasons, `platformReference` skeleton |

## 2026년 4월 v0.1 dry-run 결과

실행 명령:

```bash
cd backend && npm exec -- tsx scripts/monthly-evidence-join-dry-run.ts --site=biocom --month=2026-04 --json
```

핵심 결과:

| 항목 | 값 | 해석 |
|---|---:|---|
| A/B 주문 수 | 2,216건 | channel 배정 대상 |
| A/B confirmed net revenue | 499,829,436원 | 월별 채널 합계 기준 |
| channel 배정 주문 | 926건 | v0.1에서 paid/NPay/organic 근거가 붙은 주문 |
| channel 배정 매출 | 253,791,664원 | v0.1 classified revenue |
| unknown 주문 | 1,290건 | 증거 보강 필요 |
| unknown 매출 | 246,037,772원 | 예산 판단 전 분해 필요 |
| primary 합계 검증 | true | channel 합계가 A/B confirmed net과 일치 |

v0.1 channel summary:

| primary_channel | 주문 수 | 매출 | confidence 분포 |
|---|---:|---:|---|
| `unknown` | 1,290 | 246,037,772원 | C 246,037,772원 |
| `paid_meta` | 745 | 217,806,758원 | A 216,678,658원 / B 1,128,100원 |
| `npay` | 139 | 24,525,000원 | B 24,525,000원 |
| `paid_google` | 22 | 6,549,510원 | A 6,549,510원 |
| `paid_naver` | 16 | 4,167,015원 | A 4,167,015원 |
| `organic_search` | 4 | 743,381원 | C 743,381원 |

unknown reason:

| unknown_reason | 주문 수 | 매출 | 다음 확인 |
|---|---:|---:|---|
| `missing_channel_evidence` | 791 | 198,552,700원 | click id/UTM/referrer가 비어 있는 주문 분해 |
| `vm_payment_success_missing` | 144 | 32,758,162원 | VM payment_success 누락 또는 키 미조인 확인 |
| `subscription_without_acquisition_evidence` | 355 | 14,726,910원 | 정기결제 최초 유입 근거 별도 연결 |

주의:

v0.1은 channel 합계 검증용이다. `paid_meta`와 `unknown`을 예산 판단용 최종 매출로 바로 쓰지 않는다.

다음 v0.2에서는 direct key, checkout key, click id, UTM, referrer, NPay intent matched 여부를 나눠 confidence를 더 보수적으로 표시한다.

## 2026년 4월 v0.2 dry-run 결과

실행 명령:

```bash
cd backend && npm exec -- tsx scripts/monthly-evidence-join-dry-run.ts --site=biocom --month=2026-04 --json
```

핵심 결과:

| 항목 | 값 | 해석 |
|---|---:|---|
| contract version | `monthly-evidence-join-dry-run-v0.2` | paid evidence tier와 NPay source 상태 반영 |
| A/B 주문 수 | 2,216건 | channel 배정 대상 |
| A/B confirmed net revenue | 499,829,436원 | 월별 채널 합계 기준 |
| channel 배정 주문 | 1,198건 | paid/NPay evidence가 붙은 주문 |
| channel 배정 매출 | 327,906,361원 | v0.2 classified revenue |
| unknown 주문 | 1,018건 | 증거 보강 필요 |
| unknown 매출 | 171,923,075원 | 예산 판단 전 분해 필요 |
| primary 합계 검증 | true | channel 합계가 A/B confirmed net과 일치 |

v0.2 channel summary:

| primary_channel | 주문 수 | 매출 | confidence 분포 |
|---|---:|---:|---|
| `paid_meta` | 727 | 213,362,158원 | A 211,597,155원 / B 1,765,003원 |
| `unknown` | 1,018 | 171,923,075원 | C 171,923,075원 |
| `paid_naver` | 305 | 83,054,093원 | A 82,809,093원 / B 245,000원 |
| `npay` | 139 | 24,525,000원 | C 24,525,000원 |
| `paid_google` | 27 | 6,965,110원 | A 6,720,110원 / B 245,000원 |

v0.2 evidence tier summary:

| evidence_tier | 주문 수 | 매출 |
|---|---:|---:|
| `paid_meta_order_click_id` | 721 | 211,597,155원 |
| `no_paid_or_referrer_evidence` | 519 | 124,438,003원 |
| `paid_naver_order_click_id` | 304 | 82,809,093원 |
| `no_vm_payment_success` | 144 | 32,758,162원 |
| `npay_confirmed_intent_source_unavailable` | 139 | 24,525,000원 |
| `subscription_without_acquisition_evidence` | 355 | 14,726,910원 |
| `paid_google_order_click_id` | 26 | 6,720,110원 |

unknown reason:

| unknown_reason | 주문 수 | 매출 | 다음 확인 |
|---|---:|---:|---|
| `missing_channel_evidence` | 519 | 124,438,003원 | click id/UTM/referrer가 비어 있는 주문 분해 |
| `vm_payment_success_missing` | 144 | 32,758,162원 | VM payment_success 누락 또는 키 미조인 확인 |
| `subscription_without_acquisition_evidence` | 355 | 14,726,910원 | 정기결제 최초 유입 근거 별도 연결 |

NPay intent matching:

| 항목 | 값 | 해석 |
|---|---:|---|
| local `npay_intent_log` live intent | 0건 | 로컬 개발 DB는 운영 NPay intent source가 아니다 |
| confirmed NPay order | 139건 / 24,525,000원 | 주문·결제 spine에는 포함 |
| `strong_match` | 0건 | source unavailable이라 확정하면 안 됨 |
| `ambiguous` | 0건 | source unavailable이라 확정하면 안 됨 |
| `purchase_without_intent` | 139건 | 로컬 source 기준 값. 운영 판단에 그대로 쓰지 않음 |
| evidence tier | `npay_confirmed_intent_source_unavailable` | false unmatched를 막기 위한 보류 상태 |

운영 NPay intent source 접근 결과:

| 확인 | 결과 | 해석 |
|---|---|---|
| 로컬 SQLite | `backend/data/crm.sqlite3#npay_intent_log` 0건 | 최신 NPay intent source 아님 |
| 운영 HTTP 조회 | `GET https://att.ainativeos.net/api/attribution/npay-intents?site=biocom&limit=1` → 403 | token 없이는 read-only 조회 불가 |
| SSH 조회 | `ssh biocomkr_sns@att.ainativeos.net` → no route to host | 현재 로컬에서 VM SQLite 직접 접근 불가 |

따라서 NPay 139건은 이번 v0.2에서 `matched/unmatched`로 확정하지 않는다. 운영 token 또는 VM SQLite snapshot을 받은 뒤 같은 script를 재실행한다.

paid_naver 샘플 감사:

```bash
curl -sS 'https://att.ainativeos.net/api/attribution/ledger?source=biocom_imweb&startAt=2026-03-31T15:00:00.000Z&endAt=2026-04-30T15:00:00.000Z&limit=10000'
```

| 항목 | 값 | 해석 |
|---|---:|---|
| VM confirmed `payment_success` | 1,664건 | VM evidence source 기준 |
| `NaPm` 포함 VM confirmed row | 323건 | Naver paid 후보 evidence |
| `NaPm` 포함 관측 금액 | 89,603,396원 | VM row metadata 기준 참고값 |
| v0.2 A/B spine `paid_naver` | 305건 / 83,054,093원 | 월별 A/B confirmed net에 실제 반영된 후보 |
| 샘플 확인 | 12건 | landing 또는 firstTouch referrer에 `NaPm` 확인 |

판단:

`NaPm`은 v0.2에서 Naver paid 후보 evidence로 유지한다. 다만 최종 예산 판단 전에는 Naver Ads spend/platform reference와 같은 월 window로 붙여야 한다. `paid_naver`는 이번 프로젝트에서 새로 크게 열린 채널이므로 `/total` 화면에서는 `신규 발견 후보` 표시를 붙인다.

## 2026년 4월 v0.4 platform_reference value

`backend/scripts/monthly-evidence-join-dry-run.ts`의 contract version을 `monthly-evidence-join-dry-run-v0.4`로 올리고, JSON 출력의 `platformReference`에 read-only platform value를 1차 연결했다.

핵심 규칙:

| 항목 | 값 | 의미 |
|---|---|---|
| `contractVersion` | `platform-reference-v0.2` | 플랫폼 참고값 영역의 계약 버전 |
| `referenceOnly` | `true` | 플랫폼 값은 참고값이다 |
| `noInternalRevenueMerge` | `true` | 플랫폼 conversion value를 내부 confirmed revenue에 더하지 않는다 |
| `joinStatus` | `partial_join` | Meta/TikTok/Google value는 1차 연결됐다. Naver는 아직 source 없음 |

`platformReference.rows`는 Meta, TikTok, Google, Naver 4개 플랫폼을 항상 내려준다.
각 row는 내부 채널 매출과 플랫폼 주장값 자리를 분리한다.

```json
{
  "platform": "meta",
  "internalChannel": "paid_meta",
  "internalConfirmed": {
    "orders": 727,
    "revenue": 213362158,
    "confidenceRevenue": {
      "A": 211597155,
      "B": 1765003
    }
  },
  "platformReference": {
    "status": "joined",
    "spendKrw": 122193692,
    "conversionValueKrw": 489012112,
    "roas": 4
  },
  "allowedUse": "platform_reference_only",
  "forbiddenUse": "do_not_add_to_internal_confirmed_revenue"
}
```

2026년 4월 biocom route 검증 요약:

| platform | status | spend | conversion value | ROAS | freshness |
|---|---|---:|---:|---:|---|
| Meta | `joined` | 122,193,692원 | 489,012,112원 | 4.00 | `fresh` |
| TikTok | `joined` | 25,267,682원 | 598,161,397원 | 23.67 | `local_cache` |
| Google | `joined` | 26,835,011원 | 187,242,635원 | 6.98 | `fresh` |
| Naver | `unavailable` | - | - | - | `blocked` |

이 변경의 목적은 `/total` 또는 리포트 화면에서 `내부 확정 매출`과 `플랫폼 주장값`을 같은 카드에 보여주되, 합계는 절대 섞지 않게 하는 것이다.
TikTok local cache는 2026-03-19~2026-05-03까지 확인했고, `/total`에서는 `local_cache` 경고를 붙인다.
Naver Ads source는 다음 단계로 남긴다.

TikTok freshness 확인:

| 항목 | 값 |
|---|---:|
| table | `tiktok_ads_daily` |
| imported rows | 346 |
| usable rows | 224 |
| min date | 2026-03-19 |
| max date | 2026-05-03 |
| warning | 한국어 export의 중복 구매 헤더를 구매값으로 추정 |

## Codex가 다음에 바로 할 일

| 순서 | 작업 | 왜 하는가 | 성공 기준 | 승인 필요 | 추천 |
|---:|---|---|---|---|---:|
| 1 | 운영 NPay intent source를 연결해 139건을 재실행한다 | 로컬 source 0건 기준으로 unmatched 결론을 내리면 오판이다 | `sourceAccess=available`, `liveIntentCount>0`, 139건 matched/ambiguous/unmatched 분포가 나온다 | YES, token/snapshot 필요 | 82% |
| 2 | Naver Ads reference source 연결 방법을 결정한다 | paid_naver 내부 후보는 있지만 Naver 플랫폼 value가 아직 없다 | Naver spend/value가 `platformReference`에 들어가거나 unavailable 사유가 더 구체화된다 | 자료/권한 필요 시 YES | 76% |
| 3 | `/total` route 운영 반영 여부를 판단한다 | 로컬 route는 검증됐지만 운영 backend 배포는 별도 승인 영역이다 | 운영 배포 승인 또는 로컬-only 유지 결정이 남는다 | YES, 운영 배포 시 | 80% |

## TJ님이 할 일

운영 NPay intent source 재실행에는 token 또는 VM SQLite snapshot이 필요하다. paid_naver 감사, platform_reference skeleton, `/total` API 계약은 Codex가 read-only로 우선 진행 완료했다.

| 조건 | TJ님 요청 | 이유 | 추천 |
|---|---|---|---:|
| GA4 raw로 `transaction_id`/session source를 주문 단위 분해할 때 | BigQuery Data Viewer 권한 부여 | 현재 biocom GA4 raw permission denied | 88% |
| GTM Production publish가 필요할 때 | 별도 승인 | tracking 운영 영향이 있음 | 62% |

## 변경 기록

| 시각 | 변경 |
|---|---|
| 2026-05-04 18:04 KST | 최초 작성. Attribution VM evidence join 필드, confidence, conflict rule, NPay 규칙, 합계 검증, 다음 dry-run 계약 정리 |
| 2026-05-04 18:12 KST | `backend/scripts/monthly-evidence-join-dry-run.ts` 실행 결과 추가. A/B confirmed net `499,829,436원`, v0.1 channel summary, unknown reason, 다음 v0.2 과제 반영 |
| 2026-05-04 18:27 KST | `monthly-evidence-join-dry-run-v0.2` 결과 추가. paid evidence tier, `NaPm` 기반 paid_naver 후보, NPay source unavailable 보류 상태 반영 |
| 2026-05-04 18:28 KST | paid_naver 샘플 감사 추가. VM confirmed payment_success `NaPm` 포함 row 323건, v0.2 A/B spine paid_naver 305건 / 83,054,093원 확인 |
| 2026-05-04 18:51 KST | `monthly-evidence-join-dry-run-v0.3` platformReference skeleton 추가. 내부 confirmed revenue와 플랫폼 주장값 분리 규칙 고정 |
| 2026-05-04 19:07 KST | `monthly-evidence-join-dry-run-v0.4` platformReference value 연결. Meta/TikTok/Google joined, Naver unavailable. `/api/total/monthly-channel-summary` 로컬 route 검증 완료 |
| 2026-05-04 19:18 KST | TikTok local cache freshness 확인. `tiktok_ads_daily` 2026-03-19~2026-05-03, imported 346행 / usable 224행, local_cache 경고 기준 고정 |
