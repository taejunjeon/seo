# Google Ads confirmed purchase 운영 source no-send dry-run

작성 시각: 2026-05-05 23:28 KST
대상: biocom Google Ads account `2149990943`, Google tag `AW-304339096`
문서 성격: Green Lane 운영 source dry-run 결과 및 confirmed_purchase 파이프라인 설계

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
  lane: Green
  allowed_actions:
    - 운영 DB read-only 조회
    - Attribution VM SQLite snapshot read-only 조회
    - GA4 BigQuery read-only guard
    - no-send dry-run 산출
    - 문서/승인안 작성
  forbidden_actions:
    - Google Ads conversion action 생성/변경
    - Google Ads conversion upload
    - Google Data Manager ingest
    - GA4 Measurement Protocol 전송
    - Meta CAPI 전송
    - 운영 DB write/import/update
    - backend deploy
    - GTM publish
  source_window_freshness_confidence:
    source: "운영 PostgreSQL dashboard.public.tb_iamweb_users + TJ 관리 Attribution VM SQLite snapshot + hurdlers-naver-pay.analytics_304759974 GA4 BigQuery"
    output:
      - data/bi-confirmed-purchase-operational-dry-run-20260505.json
      - data/bi-confirmed-purchase-operational-dry-run-20260505.md
      - naver/npay-ga4-recovery-sample-payload-approval-20260505.md
    window: "2026-04-27~2026-05-05"
    site: "biocom"
    freshness: "운영 DB read-only + VM snapshot 2026-05-05 + GA4 BigQuery 조회"
    confidence: 0.86
```

## 10초 결론

운영 source 기준으로 `Google Ads에 실제 결제완료 주문만 구매로 알려주는 통로`의 no-send dry-run을 확장했다.
2026-04-27~2026-05-05 결제완료 주문 619건을 읽었고, 홈페이지 결제완료 583건과 NPay 실제 결제완료 36건을 모두 포함했다.
NPay 클릭, NPay count, NPay payment start만 있는 신호는 구매 후보에 넣지 않았다.

현재 결과로는 실제 Google Ads 전송 후보가 없다.
이유는 모든 row가 no-send phase이고, 대부분 `gclid/gbraid/wbraid`가 없거나 GA4에 이미 존재하거나 NPay intent가 ambiguous이기 때문이다.
따라서 지금 우선순위는 8건 복구가 아니라, 앞으로 결제완료 시점에 confirmed purchase payload를 안정적으로 만드는 파이프라인이다.

## 실행 결과

source: `data/bi-confirmed-purchase-operational-dry-run-20260505.json`
script: `backend/scripts/bi-confirmed-purchase-operational-dry-run.ts`
mode: read-only / no-send / no-write

| 항목 | 값 | 해석 |
|---|---:|---|
| 운영 결제완료 주문 | 619건 | 운영 PostgreSQL `tb_iamweb_users` 기준 |
| 결제완료 금액 합계 | 145,599,773원 | 취소/환불 차단 전 dry-run 합계 |
| 홈페이지 결제완료 | 583건 | NPay가 아닌 자사몰 결제완료 |
| NPay 실제 결제완료 | 36건 | NPay 클릭이 아니라 운영 주문 원장의 결제완료 주문 |
| GA4 present | 476건 | GA4 raw에 이미 주문번호 또는 channel_order_no가 있음 |
| GA4 robust_absent | 143건 | GA4 raw에서 주문번호와 channel_order_no 모두 미발견 |
| Google click id 있음 | 5건 | `gclid/gbraid/wbraid` 중 하나가 있음 |
| 승인 후에도 보낼 수 있을 가능성이 있는 row | 0건 | 아직 `read_only_phase`, `approval_required` 외 block_reason이 남음 |
| 실제 전송 후보 | 0건 | 모든 row `send_candidate=false` |

## block_reason 해석

| block_reason | 건수 | 사람 말 설명 |
|---|---:|---|
| `read_only_phase` | 619 | 지금은 계산만 하는 단계 |
| `approval_required` | 619 | 실제 전송은 TJ님 명시 승인 전 금지 |
| `missing_google_click_id` | 614 | Google Ads upload에 필요한 `gclid/gbraid/wbraid`가 없음 |
| `already_in_ga4` | 476 | GA4에는 이미 주문이 있어 GA4 복구 전송 후보에서 제외 |
| `missing_attribution_vm_evidence` | 125 | VM payment_success나 NPay intent 증거가 붙지 않음 |
| `npay_intent_ambiguous` | 10 | NPay 주문과 클릭 intent가 모호함 |
| `npay_intent_not_a_grade_strong` | 10 | strong match지만 A급 조건은 아님 |
| `npay_intent_purchase_without_intent` | 6 | NPay 실제 결제완료는 있으나 클릭 intent가 없음 |
| `order_has_return_reason` | 4 | 운영 주문에 반품/return reason이 있어 순매출 보정 전 제외 필요 |

## 8건 샘플 처리

8건은 GA4 누락 복구 파이프라인 검증 샘플로만 본다.
실제 전송은 승인하지 않는다.
payload 승인안은 [[../naver/npay-ga4-recovery-sample-payload-approval-20260505]]에 분리했다.

중요한 분리:

- 72시간 초과 7건: GA4 MP로 원래 세션/날짜 복구가 불확실하므로 실제 전송 후보에서 별도 분리.
- 72시간 이내 1건: 이론상 시간 조건은 낫지만 실제 전송 승인이 없으므로 `send_candidate=false`.

## confirmed_purchase 파이프라인 설계

### 1. 수집 기준

`confirmed_purchase`는 결제수단과 무관하게 실제 결제완료 주문만 포함한다.

포함:

- 홈페이지 구매하기 결제완료
- NPay 실제 결제완료 주문

제외:

- NPay 버튼 클릭
- NPay count
- NPay payment start
- `add_payment_info`만 있는 row
- 취소/환불/반품 처리된 row
- 주문번호나 결제시각이 없는 row

### 2. 필수 조인

| 단계 | source | 목적 |
|---|---|---|
| 주문 정본 | 운영 PostgreSQL `tb_iamweb_users` | 실제 결제완료, 결제수단, 금액, 취소/환불 여부 확인 |
| 유입 증거 | TJ 관리 Attribution VM `attribution_ledger`, `npay_intent_log` | client_id, ga_session_id, click id, UTM, landing/referrer 보존 |
| 중복 guard | GA4 BigQuery `analytics_304759974` | 이미 GA4에 있는 주문 재전송 방지 |
| Google upload 가능성 | `gclid`, `gbraid`, `wbraid` | Google Ads offline conversion 또는 Data Manager 매칭 가능성 판단 |

### 3. no-send payload 기본값

```json
{
  "send_candidate": false,
  "block_reasons": ["read_only_phase", "approval_required"],
  "would_be_eligible_after_approval": false
}
```

승인 전에는 어떤 플랫폼에도 보내지 않는다.
Google Ads conversion action 생성, 기존 `구매완료` Primary 변경, Google Ads upload는 모두 Red Lane이다.

### 4. 실시간/준실시간 구조

1. 운영 주문 sync 또는 polling이 결제완료 주문을 감지한다.
2. 주문이 NPay면 NPay intent log와 먼저 맞춘다.
3. 주문이 홈페이지 결제면 Attribution VM payment_success와 맞춘다.
4. `gclid/gbraid/wbraid`, `client_id`, `ga_session_id`, `transaction_id`, `value`, `paid_at`을 no-send payload로 만든다.
5. GA4 BigQuery 또는 local send log로 중복을 막는다.
6. 승인된 플랫폼만 제한적으로 전송한다.
7. 전송 후 send log를 남기고 다음 dry-run에서 같은 주문을 차단한다.

## 현재 판단

Google Ads용 confirmed purchase는 지금 당장 upload할 수 있는 상태가 아니다.
가장 큰 병목은 Google click id 보존률이다.
운영 주문 619건 중 `gclid/gbraid/wbraid`가 붙은 row는 5건뿐이다.

따라서 다음 Green Lane 개발은 `랜딩/체크아웃 시점 Google click id 보존 설계`와 `confirmed purchase no-send payload API/dispatcher contract`다.

## Auditor verdict

Auditor verdict: PASS_WITH_NOTES
Project: Google Ads confirmed purchase / NPay recovery
Phase: 운영 source no-send dry-run
Lane: Green
Mode: read-only / dry-run / no-send

No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES

Notes:
- NPay 실제 결제완료 주문은 포함했다.
- NPay 클릭/count/payment start만 있는 신호는 구매 후보에서 제외했다.
- 실제 전송 후보는 0건이다.
- 8건 샘플은 복구 목표가 아니라 파이프라인 검증용이다.
