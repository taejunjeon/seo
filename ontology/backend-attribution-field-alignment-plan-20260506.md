# Backend Attribution Field Alignment Plan

작성 시각: 2026-05-06 13:15 KST
Status: active draft
Owner: backend / attribution / ontology
Supersedes: none
Next document: backend-attribution-field-alignment-result-YYYYMMDD.md
Do not use for: 실제 플랫폼 전송 승인, Google Ads action 변경 승인, GTM publish 승인, 운영 DB write 승인

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
    - ontology/!ontology.md
    - ontology/attribution-ontology-schema-contract-20260506.md
    - gdn/paid-click-intent-gtm-preview-approval-20260506.md
    - gdn/confirmed-purchase-no-send-pipeline-contract-20260505.md
  lane: Green
  allowed_actions:
    - backend route field read-only audit
    - field mismatch 목록 작성
    - additive alignment 계획 작성
  forbidden_actions:
    - GTM Preview/Production publish
    - Google Ads conversion action 생성/변경
    - conversion upload
    - GA4/Meta/Google Ads/TikTok/Naver 전송
    - 운영 DB write
    - backend 운영 deploy
  source_window_freshness_confidence:
    source: "backend/src/routes/attribution.ts 정적 조사"
    window: "2026-05-06 KST"
    freshness: "코드 정적 조사. 운영 source 숫자 없음"
    confidence: 0.9
```

## 10초 결론

현재 backend no-send route는 기능상 Preview를 진행할 수 있는 수준이다.
다만 API 응답 필드에는 기존 camelCase와 새 ontology snake_case가 섞여 있다.
따라서 바로 breaking change하지 않고, **snake_case alias를 추가하는 방식**으로 정렬한다.

중요한 결론은 아래다.

- `paid-click-intent/no-send`와 `confirmed-purchase/no-send`는 이미 분리돼 있다.
- GTM Preview 성공 기준은 `paid-click-intent/no-send`를 보는 것이 맞다.
- `confirmed-purchase/no-send`는 실제 결제완료 주문 후보용으로 유지한다.
- camelCase guard field는 v1 호환으로 유지하고, snake_case field를 추가한다.

## 현재 route 상태

| route | 목적 | 현재 판단 |
|---|---|---|
| `POST /api/attribution/paid-click-intent/no-send` | 랜딩/체크아웃 시점 Google click id 보존 Preview | Preview only 진행 가능 |
| `POST /api/attribution/confirmed-purchase/no-send` | 홈페이지/NPay 실제 결제완료 주문의 purchase 후보 Preview | confirmed purchase dispatcher 전 단계로 유지 |

## Field mismatch 목록

| 현재 field/reason | canonical target | 영향 | 권장 처리 |
|---|---|---|---|
| `dryRun` | `dry_run` | guard field naming 혼선 | v1 유지 + snake_case alias 추가 |
| `wouldStore` | `would_store` | 저장 여부 표현 혼선 | v1 유지 + snake_case alias 추가 |
| `wouldSend` | `would_send` | 전송 여부 표현 혼선 | v1 유지 + snake_case alias 추가 |
| `noSendVerified` | `no_send_verified` | no-send 검증 표시 혼선 | v1 유지 + snake_case alias 추가 |
| `noWriteVerified` | `no_write_verified` | no-write 검증 표시 혼선 | v1 유지 + snake_case alias 추가 |
| `noDeployVerified` | `no_deploy_verified` | no-deploy 검증 표시 혼선 | v1 유지 + snake_case alias 추가 |
| `noPublishVerified` | `no_publish_verified` | no-publish 검증 표시 혼선 | v1 유지 + snake_case alias 추가 |
| `noPlatformSendVerified` | `no_platform_send_verified` | 플랫폼 전송 차단 표시 혼선 | v1 유지 + snake_case alias 추가 |
| `click_ids` | `click_identifiers` | ontology 공통 타입과 이름 다름 | v1 유지 + alias 추가 |
| `order_canceled` | `canceled_order` | block reason enum 다름 | compatibility alias 후 canonical 전환 |
| `order_refunded` | `refunded_order` | block reason enum 다름 | compatibility alias 후 canonical 전환 |
| `pii_or_secret_detected` | `pii_detected`, `secret_detected` | error reason이 너무 뭉쳐 있음 | response reason은 유지, `block_reasons`에는 세분화 |
| `pii_secret_or_purchase_field_detected` | `pii_detected`, `secret_detected`, `invalid_value_field` | paid click intent reject 사유가 넓음 | rejected field 기준 세분화 |
| `send_candidate=false`만 있음 | `send_candidate`, `actual_send_candidate` | `0건` 해석이 어려움 | `actual_send_candidate=false` 추가 |

## 정렬 원칙

### 1. Additive first

기존 프론트엔드나 로컬 smoke가 깨지지 않게 기존 camelCase field는 v1에서 유지한다.
동시에 snake_case alias를 추가한다.

예:

```json
{
  "dryRun": true,
  "dry_run": true,
  "wouldStore": false,
  "would_store": false,
  "noSendVerified": true,
  "no_send_verified": true
}
```

### 2. Canonical block reason은 snake_case noun phrase

새 block reason은 ontology schema의 `BlockReason`을 따른다.
기존 reason은 compatibility alias로만 남긴다.

예:

```json
{
  "block_reasons": ["read_only_phase", "approval_required", "canceled_order"],
  "legacy_block_reasons": ["order_canceled"]
}
```

### 3. Route 목적은 바꾸지 않는다

field alignment는 route 의미를 바꾸지 않는다.

- `paid-click-intent/no-send`: 구매 전 click id 보존 Preview
- `confirmed-purchase/no-send`: 실제 결제완료 주문 후보 Preview

## 구현 단계 제안

### Step 1. no-send response guard alias 추가

무엇: 두 no-send route 응답에 snake_case guard field를 추가한다.
왜: schema contract의 wire format 원칙과 현재 route를 맞춘다.
어떻게: 응답 object에 `dry_run`, `would_store`, `would_send`, `no_send_verified`, `no_write_verified`, `no_deploy_verified`, `no_publish_verified`, `no_platform_send_verified`를 추가한다.
성공 기준: 기존 curl smoke와 신규 snake_case assertion이 모두 통과한다.
승인 필요: NO, Green Lane local code.

### Step 2. preview 내부 alias 추가

무엇: `click_ids`와 `click_identifiers`, `send_candidate`와 `actual_send_candidate`를 함께 내려준다.
왜: 대시보드와 ontology contract가 같은 이름을 쓸 수 있게 한다.
어떻게: response preview에 alias field만 추가하고 기존 field는 유지한다.
성공 기준: 기존 문서의 smoke JSON 의미가 유지되고, 신규 schema에서 해석 가능하다.
승인 필요: NO, Green Lane local code.

### Step 3. block reason canonicalization

무엇: `order_canceled`, `order_refunded`를 `canceled_order`, `refunded_order`로 맞춘다.
왜: block reason taxonomy가 문서마다 달라지는 것을 막는다.
어떻게: 우선 `legacy_block_reasons`를 함께 내려준 뒤, 다음 단계에서 기존 field를 제거한다.
성공 기준: 대시보드와 문서가 canonical reason을 사용한다.
승인 필요: NO, 단 프론트엔드가 기존 reason을 hardcode했으면 조율 필요.

### Step 4. docs/result sync

무엇: `gdn/paid-click-intent-gtm-preview-approval-20260506.md`, `gdn/confirmed-purchase-no-send-pipeline-contract-20260505.md`, [[attribution-ontology-schema-contract-20260506]]를 구현 결과에 맞춘다.
왜: route와 문서가 달라지면 Preview 결과 해석이 흔들린다.
성공 기준: wiki link, harness preflight, diff check 통과.
승인 필요: NO.

## Preview only 진행과의 관계

이 field alignment는 GTM Preview의 선행 blocker가 아니다.
현재 `paid-click-intent/no-send`는 `has_google_click_id`, `test_click_id`, `live_candidate_after_approval=false`, `wouldStore=false`, `wouldSend=false`를 이미 내려준다.
따라서 TJ님이 `Preview only YES`를 주면 Preview는 진행 가능하다.

다만 Preview 결과 보고서에는 현재 v1 field와 canonical field를 함께 표시하는 것이 좋다.

## 금지 확인

이 문서는 계획 문서다.
GTM Preview/Publish, Google Ads conversion action 생성/변경, conversion upload, GA4/Meta/Google Ads/TikTok/Naver 전송, 운영 DB write, backend 운영 deploy를 하지 않았다.

## Auditor verdict

Auditor verdict: READY_FOR_ADDITIVE_ALIGNMENT
No-send verified in plan: YES
No-write verified in plan: YES
No-deploy verified in plan: YES
No-publish verified in plan: YES
No-platform-send verified in plan: YES

Recommendation: proceed with additive alias implementation after Preview plan is acknowledged.
Confidence: 87%.
