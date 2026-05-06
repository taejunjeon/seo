# confirmed_purchase no-send 수신·디스패처 계약

작성 시각: 2026-05-05 23:39 KST
대상: biocom 실제 결제완료 주문 기반 구매 후보 파이프라인
문서 성격: Green Lane contract. 실제 GA4/Meta/Google Ads 전송, 운영 DB write, 운영 deploy는 하지 않는다.
Status: active
Supersedes: 없음
Next document: confirmed_purchase dispatcher Red Lane 승인안
Do not use for: 랜딩 click id Preview, GTM Preview, 실제 GA4/Meta/Google Ads 전송, 운영 DB write, backend 운영 deploy

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/gdn/README.md
    - harness/gdn/RULES.md
    - harness/gdn/VERIFY.md
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/APPROVAL_GATES.md
  required_context_docs:
    - gdn/google-ads-confirmed-purchase-operational-dry-run-20260505.md
    - naver/npay-ga4-recovery-sample-payload-approval-20260505.md
    - gdn/google-click-id-preservation-plan-20260505.md
  lane: Green
  allowed_actions:
    - local no-send route 추가
    - payload preview
    - read-only dry-run
    - 문서 작성
  forbidden_actions:
    - GA4 Measurement Protocol purchase 전송
    - Meta CAPI Purchase 전송
    - Google Ads conversion upload
    - Google Ads conversion action 생성/변경
    - 운영 DB write/import/update
    - backend 운영 deploy
    - GTM Production publish
  source_window_freshness_confidence:
    source: "운영 DB dashboard.public.tb_iamweb_users + Attribution VM snapshot + GA4 BigQuery guard"
    window: "2026-04-27~2026-05-05"
    freshness: "read-only dry-run completed, source freshness rechecked 2026-05-05 23:35 KST"
    site: "biocom"
    confidence: 0.9
```

## 10초 결론

근본 해결은 8건을 수동 복구하는 것이 아니라 앞으로 발생하는 실제 결제완료 주문만 구매 후보로 만드는 것이다.
이 계약은 `홈페이지 결제완료`와 `NPay 실제 결제완료`만 후보로 받고, `NPay 클릭`, `NPay count`, `결제 시작`, `add_payment_info`만 있는 신호는 purchase에서 제외한다.
현재 구현은 no-send preview까지이며, 외부 플랫폼 전송은 계속 0건이다.

## 현재 로컬 구현

로컬 backend에 아래 preview route를 추가했다.

```text
POST /api/attribution/confirmed-purchase/no-send
```

이 route는 이름 그대로 `no-send`다.
응답에는 GA4, Meta, Google Ads payload preview가 보이지만 실제 전송은 하지 않는다.
DB 저장도 하지 않는다.

중요: 이 route는 실제 결제완료 주문 후보만 받는다.
랜딩 시점 Google click id 보존이나 NPay intent 재주입 확인은 별도 route를 쓴다.

```text
POST /api/attribution/paid-click-intent/no-send
```

둘을 섞지 않는다.
`confirmed_purchase/no-send`는 `payment_complete` 또는 `confirmed_order`만 허용한다.

## 입력 payload

필수 필드:

| 필드 | 뜻 |
|---|---|
| `site` | 현재는 `biocom`만 허용 |
| `order_number` 또는 `channel_order_no` | 내부 주문번호 또는 NPay 채널 주문번호 |
| `payment_method` | `homepage` 또는 `npay` |
| `signal_stage` | `payment_complete` 또는 `confirmed_order`만 허용 |
| `value` | 결제완료 금액, KRW |
| `currency` | `KRW` |
| `paid_at` | 결제완료 시각 |

권장 필드:

| 필드 | 왜 필요한가 |
|---|---|
| `client_id` | GA4 client 연결 |
| `ga_session_id` | GA4 session 연결 |
| `gclid` | Google Ads 클릭 연결 |
| `gbraid` | Google iOS/앱·웹 클릭 연결 |
| `wbraid` | Google web-to-app 클릭 연결 |
| `fbclid` | Meta 보조 연결 |
| `ttclid` | TikTok 보조 연결 |
| `event_id` | 플랫폼 중복 방지 키 |
| `is_test`, `is_manual`, `is_canceled`, `is_refunded` | 차단 판단 |

금지 필드:

- 이름
- 전화번호
- 이메일
- 주소
- 카드번호
- 계좌번호
- raw cookie
- access token
- 건강 상태나 질병 추정값

## 허용되는 구매 후보

| 신호 | purchase 후보 여부 | 이유 |
|---|---|---|
| 홈페이지 결제완료 주문 | YES | 운영 주문 원장에서 실제 결제완료로 확인 가능 |
| NPay 실제 결제완료 주문 | YES | NPay도 실제 매출이면 포함해야 함 |
| NPay 클릭 | NO | 구매 의도일 뿐 결제완료가 아님 |
| NPay count | NO | count label은 구매 학습 신호로 쓰면 위험 |
| NPay 결제 시작 | NO | 결제 완료 전 단계 |
| 일반 결제 시작 | NO | 결제 완료 전 단계 |
| AddPaymentInfo | NO | 결제 정보 입력/시작 단계일 수 있음 |

## 출력 payload

항상 아래 guardrail을 포함한다.

```json
{
  "dryRun": true,
  "wouldStore": false,
  "wouldSend": false,
  "noSendVerified": true,
  "noWriteVerified": true,
  "noDeployVerified": true,
  "noPublishVerified": true,
  "noPlatformSendVerified": true
}
```

정상 preview의 `block_reasons`는 아래처럼 남는다.

```json
["read_only_phase", "approval_required"]
```

`signal_stage=npay_click`처럼 구매가 아닌 신호가 들어오면 아래처럼 차단한다.

```json
[
  "read_only_phase",
  "approval_required",
  "blocked_signal_stage_npay_click",
  "signal_stage_must_be_payment_complete"
]
```

## 디스패처 상태 모델

이 파이프라인의 상태는 아래처럼 분리한다.

1. `received_preview`: no-send route가 payload를 받았지만 저장하지 않음.
2. `blocked`: 필수 필드 누락, click/count 신호, 취소/환불, PII, 중복 후보.
3. `ready_after_approval`: read-only 기준으로는 가능해 보이나 실제 전송 승인이 필요.
4. `sent`: 별도 Red Lane 승인 후에만 가능한 미래 상태.
5. `send_blocked_after_guard`: 승인 후에도 GA4 중복, Google click id 없음, 환불 등으로 차단.

현재 Green Lane에서는 1~3번까지만 다룬다.
4번과 5번은 실제 dispatcher 운영 승인 이후에만 열린다.

## 중복 방지 기준

dedupe key:

```text
confirmed_purchase:{site}:{channel_order_no || order_number}
```

플랫폼별 중복 기준:

| 플랫폼 | 중복 기준 |
|---|---|
| GA4 | `transaction_id` + GA4 BigQuery robust guard |
| Meta | `event_id` + `order_number/channel_order_no` |
| Google Ads | `order_id` + click id + conversion time |

## 운영 source 기준 no-send 결과와 연결

근거 문서: [[google-ads-confirmed-purchase-operational-dry-run-20260505]]

| 항목 | 값 |
|---|---:|
| 운영 결제완료 주문 | 623건 |
| 홈페이지 결제완료 | 586건 |
| NPay 실제 결제완료 | 37건 |
| GA4 이미 존재 | 476건 |
| GA4 robust_absent | 147건 |
| Google click id 있음 | 5건 |
| 현재 send_candidate | 0건 |

이 결과는 실제 전송 후보가 없다는 뜻이 아니다.
지금 단계가 no-send/read-only라 모두 막은 것이다.
다만 Google Ads 연결 관점에서는 `missing_google_click_id`가 가장 큰 실제 병목이다.

## send_candidate=0 차단 사유 분리

최신 dry-run에서는 `send_candidate=0`을 아래처럼 분해한다.

| 사유 | 건수 | 해석 |
|---|---:|---|
| eligible_payment_complete_orders | 623 | 홈페이지 결제완료와 NPay 실제 결제완료 주문 |
| actual_send_candidate | 0 | Green Lane이라 실제 전송 후보는 0으로 고정 |
| blocked_by_read_only_phase | 623 | no-send/read-only 단계 차단 |
| blocked_by_approval_required | 623 | 외부 전송 승인 전 차단 |
| blocked_by_missing_google_click_id | 618 | Google Ads 매칭의 실제 병목 |
| blocked_by_already_in_ga4 | 476 | GA4 복구 후보에서는 제외해야 할 주문 |
| blocked_by_missing_attribution_vm_evidence | 129 | 유입 증거 공백 |

따라서 `send_candidate=0`은 결제완료 주문이 없다는 뜻이 아니라, 승인 차단과 click id 병목을 분리해서 봐야 한다는 뜻이다.

## source freshness

`imweb_operational`은 2026-05-06 09:23 KST 재실행 기준 fresh다.

| 필드 | 값 |
|---|---|
| row_count | 98,470 |
| source_max_payment_complete_at | 2026-05-05T17:55:41.000Z |
| source_lag_hours | 6.5 |
| freshness_status | fresh |

향후 warn/stale이면 모든 dry-run 결과는 provisional로 표시하고 운영 판단 전 최신성을 먼저 복구한다.

## route 운영 샘플 검증

근거 문서: [[../data/confirmed-purchase-no-send-route-sample-20260506]]

운영 결제완료 주문 20건과 NPay click 차단 control 1건을 로컬 route에 넣어 preview를 확인했다.

| 항목 | 값 |
|---|---:|
| 운영 주문 샘플 | 20건 |
| control sample | 1건 |
| no_send_verified | true |
| no_write_verified | true |
| no_platform_send_verified | true |

route block reason은 `read_only_phase`, `approval_required`가 전체에 붙었고, control sample은 `blocked_signal_stage_npay_click`, `signal_stage_must_be_payment_complete`로 차단됐다.

## 로컬 smoke 결과

홈페이지 결제완료 preview:

```text
ok=true
dryRun=true
wouldStore=false
wouldSend=false
receiver=confirmed_purchase_no_send
block_reasons=read_only_phase, approval_required
noPlatformSendVerified=true
```

NPay click 차단 preview:

```text
ok=false
dryRun=true
wouldStore=false
wouldSend=false
block_reasons=read_only_phase, approval_required, blocked_signal_stage_npay_click, signal_stage_must_be_payment_complete
noPlatformSendVerified=true
```

## 다음 구현 순서

1. Google click id 보존을 먼저 개선한다.
2. no-send receiver에 운영 주문 샘플을 더 많이 넣어 필드 누락을 본다.
3. GA4 BigQuery guard와 Google click id guard를 dispatcher contract에 고정한다.
4. 최소 7일 no-send 운영 관찰 후 Red Lane 승인 여부를 판단한다.

## Auditor verdict

Auditor verdict: PASS_WITH_NOTES
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES

Notes:
- 실제 purchase 후보는 `payment_complete` 이후만 허용한다.
- NPay 실제 결제완료 매출은 포함한다.
- NPay 클릭/count/payment start만 있는 row는 purchase에서 제외한다.
