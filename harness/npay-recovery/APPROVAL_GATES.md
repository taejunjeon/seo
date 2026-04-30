# NPay Recovery Approval Gates

작성 시각: 2026-05-01 00:20 KST  
상태: v0 기준판  
목적: TJ님 승인 전 금지되는 작업과 승인 문서 형식을 고정한다  
관련 문서: [[harness/npay-recovery/README|NPay Recovery Harness]], [[harness/npay-recovery/TASK|Task Spec]], [[harness/npay-recovery/RULES|Rules]], [[harness/npay-recovery/VERIFY|Verify]]

## 10초 요약

승인 게이트의 원칙은 단순하다.

읽기와 dry-run은 Codex가 진행할 수 있다. 운영 DB write, GTM publish, GA4/Meta/TikTok/Google Ads 전송, 운영 endpoint 배포는 TJ님이 특정 범위를 YES로 승인하기 전에는 금지다.

## 승인 레벨

| Level | 작업 | 승인 필요 | 기본값 |
|---|---|---|---|
| L0 | 문서 읽기, 로컬 문서 작성 | NO | 허용 |
| L1 | read-only DB/BigQuery/API 조회 | NO | 허용 |
| L2 | dry-run 후보 계산, payload preview | NO | 허용 |
| L3 | 승인안 작성 | NO | 허용 |
| L4 | local DB write/import apply | YES | 금지 |
| L5 | GTM publish, 운영 endpoint 배포 | YES | 금지 |
| L6 | GA4 MP 제한 전송 | YES | 금지 |
| L7 | Meta CAPI, TikTok Events API, Google Ads 전송 | YES | 금지 |
| L8 | 자동 dispatcher 운영 전환 | YES | 금지 |

## TJ 승인 전 절대 금지

| 금지 작업 | 이유 |
|---|---|
| 운영 DB `INSERT/UPDATE/DELETE` | 원장 오염 |
| `match_status` 업데이트 | dry-run이 실제 상태로 오인될 수 있음 |
| GA4 MP purchase 전송 | 중복/오매칭 전환은 되돌리기 어려움 |
| Meta CAPI Purchase 전송 | 광고 최적화 오염 |
| TikTok Events API CompletePayment 전송 | TikTok ROAS 오염 |
| Google Ads conversion upload | 입찰 학습 오염 |
| GTM live publish | 추적 스크립트 운영 변경 |
| NPay dispatcher endpoint 운영 배포 | 자동 전송 경로 생성 |
| ambiguous/B급/manual_test_order 전송 | false positive 위험 |
| `already_in_ga4=unknown/present` 전송 | 중복 또는 미확인 리스크 |

## 승인 요청 문서 형식

승인 요청은 TJ님이 YES/NO로 답할 수 있게 쓴다.

필수 항목:

| 항목 | 내용 |
|---|---|
| 추천안 | `YES: ... 진행` 또는 `NO: ... 보류` |
| 승인 범위 | site, order_number, channel_order_no, platform, event_name |
| 왜 필요한가 | 이 전송/변경이 해결하는 문제 |
| 왜 지금인가 | 72시간/24시간 제한, window, freshness |
| 대상 후보 | 후보 전체와 추천 1-2건 |
| 제외 후보 | B급, ambiguous, manual_test_order, present/unknown |
| payload preview | transaction_id, value, currency, client_id, ga_session_id |
| guard result | `robust_absent` 근거 |
| 위험 | 중복, 오매칭, attribution 지연, rollback 한계 |
| 검증 방법 | 전송 후 BigQuery query, log, event_id |
| rollback 한계 | 보낸 event는 쉽게 삭제 불가 |
| 자신감 | %와 낮춘 이유 |
| 요청 문구 | `YES` 또는 `NO`로 답하면 되는 형태 |

## Approval Scope

승인은 범위가 좁아야 한다.

좋은 승인:

```text
YES: biocom order_number=202604302383065 1건만 GA4 MP purchase 제한 테스트 진행.
Meta/TikTok/Google Ads 전송은 금지.
자동 dispatcher 운영 전환 금지.
```

나쁜 승인:

```text
YES: 괜찮아 보이는 것 다 보내.
```

나쁜 이유:

- order 범위가 없다.
- platform 범위가 없다.
- 전송 수량이 없다.
- 금지선이 없다.

## GA4 MP Limited Test Gate

GA4 MP 제한 테스트 후보는 아래를 모두 만족해야 한다.

1. `strong_grade=A`.
2. `order_label=production_order`.
3. `manual_test_order=false`.
4. `already_in_ga4=robust_absent`.
5. `client_id` 있음.
6. `ga_session_id` 있음.
7. `amount_match_type`이 A급 허용값.
8. `time_gap_minutes <= 2`.
9. `score_gap >= 15`.
10. TJ님이 특정 order_number를 승인.

추가 확인:

`amount_match_type=shipping_reconciled`인 후보는 dry-run A급 분류에 포함될 수 있다. 하지만 실제 limited send 전에는 승인안에 상품 subtotal, 배송비, 최종 결제금액이 모두 표시되어야 한다. TJ님이 이 금액 조정을 승인 범위에 포함하지 않으면 전송하지 않는다.

전송 후:

- 같은 주문은 즉시 `already_in_ga4=present`로 다음 dry-run에서 차단한다.
- BigQuery 수신 확인 전 같은 주문 재전송 금지.

## Meta CAPI Gate

Meta CAPI는 GA4 MP 제한 테스트와 검증이 끝난 뒤 별도 승인한다.

필수 조건:

- `event_id` 중복 방지 키 확정.
- `fbp` 또는 `fbc` presence 확인.
- PII hashing 정책 확인.
- GA4 MP 결과가 오매칭 없이 수신됨.

## TikTok Events API Gate

TikTok은 `ttclid`, `_ttp` 수집 보강 전에는 열지 않는다.

필수 조건:

- `ttclid` 또는 `_ttp` presence report.
- TikTok pixel/event 기존 발화 상태 확인.
- GA4/Meta보다 나중에 제한 테스트.

## Google Ads Gate

Google Ads는 마지막이다.

이유:

- 입찰 학습에 직접 영향을 준다.
- 버튼 클릭 purchase 오탐을 먼저 제거해야 한다.
- GA4/Meta 제한 테스트로 매칭 품질을 확인한 뒤 판단한다.

## GTM Publish Gate

GTM publish는 아래를 확인한 뒤 별도 승인한다.

| 체크 | 기준 |
|---|---|
| Workspace 변경 | 의도한 tag만 updated |
| merge conflict | 0건 |
| diff | ENVIRONMENT/DEBUG_MODE 외 의도치 않은 변경 없음 |
| quick_preview | `compilerError=false` |
| purchase 코드 | `gtag('event','purchase')`, Meta Purchase, Google Ads conversion call 없음 |
| smoke test | 1회 클릭 -> 1 intent, dedupe 정상 |

## 더클린커피 Approval Gate

더클린커피 작업에서 즉시 허용되는 것은 read-only뿐이다.

별도 승인 전 금지:

- coffee NPay intent live publish
- coffee GTM publish
- coffee GA4 MP 전송
- coffee Meta/TikTok/Google Ads 전송
- coffee Excel actual import apply
- coffee Naver Commerce API credential 변경

TJ님 확인 필요:

- 더클린커피 Naver Commerce API 권한.
- 더클린커피 Meta token 갱신.
- 2025 결제내역 엑셀, 2024/2023 주문/결제 엑셀 다운로드.

## 승인 만료 조건

승인은 아래 상황에서 다시 받아야 한다.

1. source 숫자가 바뀌었다.
2. dry-run window가 바뀌었다.
3. 후보 order_number가 바뀌었다.
4. platform이 바뀌었다.
5. 전송 payload 필드가 바뀌었다.
6. BigQuery guard가 `robust_absent`에서 `present/unknown`으로 바뀌었다.
7. 24시간 이상 지연되어 GA4 session attribution 리스크가 달라졌다.
