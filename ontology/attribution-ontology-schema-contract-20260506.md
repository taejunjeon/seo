# Attribution Ontology Schema Contract

작성 시각: 2026-05-06 12:45 KST
Status: active draft
Owner: total / attribution
Supersedes: none
Next document: [[backend-attribution-field-alignment-plan-20260506]]
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
    - ontology/term-conflict-audit-20260506.md
    - gdn/confirmed-purchase-no-send-pipeline-contract-20260505.md
    - gdn/paid-click-intent-gtm-preview-approval-20260506.md
    - total/total-api-contract-20260504.md
  lane: Green
  allowed_actions:
    - schema contract 작성
    - 현재 backend route와 canonical field 비교
    - 향후 field alignment 계획 제안
  forbidden_actions:
    - GTM Preview/Production publish
    - Google Ads conversion action 생성/변경
    - conversion upload
    - GA4/Meta/Google Ads/TikTok/Naver 전송
    - 운영 DB write
    - backend 운영 deploy
  source_window_freshness_confidence:
    source: "backend/src/routes/attribution.ts + ontology/!ontology.md + GDN/NPay no-send 계약"
    window: "2026-05-06 KST"
    freshness: "코드/문서 정적 조사. 운영 숫자는 포함하지 않음"
    confidence: 0.9
```

## 10초 결론

이 문서는 [[!ontology]]의 개념을 API와 TypeScript에서 쓸 수 있는 schema contract로 바꾼다.
핵심은 `PaidClickIntent`와 `ConfirmedPurchaseCandidate`를 분리하는 것이다.
`PaidClickIntent`는 랜딩/결제시작 전 광고 클릭 증거이고, `ConfirmedPurchaseCandidate`는 내부 결제완료 주문에서만 나온다.

현재 로컬 backend에는 두 no-send route가 이미 분리돼 있다.

```text
POST /api/attribution/paid-click-intent/no-send
POST /api/attribution/confirmed-purchase/no-send
```

이 계약은 실제 전송을 열지 않는다.
앞으로 route, dry-run script, `/total`, `/ads/google`이 같은 필드명을 쓰도록 기준을 고정한다.

## 설계 원칙

### 1. Wire format은 snake_case

HTTP JSON, data export, dashboard API response는 `snake_case`를 쓴다.
프론트엔드 내부 TypeScript type 이름은 `PascalCase`를 쓰되, JSON 필드는 바꾸지 않는다.

예:

```ts
export interface ConfirmedPurchaseCandidate {
  order_number: string | null;
  channel_order_no: string | null;
}
```

현재 no-send route v1 응답에는 기존 backend 관례 때문에 `dryRun`, `wouldStore`, `wouldSend`, `noSendVerified` 같은 camelCase guard field가 섞여 있다.
이 문서의 원칙은 v2 canonical target이다.
v1은 호환성을 위해 즉시 breaking change하지 않고, [[backend-attribution-field-alignment-plan-20260506]]에서 snake_case alias 추가와 canonical field 전환 순서를 정한다.

### 2. Preview와 live candidate는 같은 schema를 쓰되 guard가 다르다

no-send preview에서도 live 전송 후보와 같은 필드를 만든다.
다만 아래 guard가 항상 붙어 실제 저장과 전송을 막는다.

```json
{
  "dryRun": true,
  "wouldStore": false,
  "wouldSend": false,
  "noSendVerified": true,
  "noWriteVerified": true,
  "noPlatformSendVerified": true
}
```

### 3. Paid click과 confirmed purchase는 endpoint를 섞지 않는다

`paid-click-intent/no-send`는 click id 보존 Preview만 받는다.
주문번호, 결제금액, 결제완료 시각이 들어오면 reject한다.

`confirmed-purchase/no-send`는 실제 결제완료 주문만 받는다.
NPay click/count/payment start는 reject한다.

## 공통 타입

```ts
export type Site = "biocom" | "thecleancoffee" | "aibio" | "unknown";

export type CurrencyCode = "KRW";

export type IsoDateTimeString = string;

export type PlatformPresenceStatus =
  | "present"
  | "robust_absent"
  | "unknown"
  | "not_checked";

export type SourceFreshness =
  | "fresh"
  | "warn"
  | "stale"
  | "unavailable"
  | "source_unavailable_before_publish";

export type EvidenceConfidence = "A" | "B" | "C" | "D";

export type PrimaryChannel =
  | "paid_meta"
  | "paid_tiktok"
  | "paid_google"
  | "paid_naver"
  | "owned_crm"
  | "organic_search"
  | "direct"
  | "unknown_quarantine";

export interface ClickIdentifiers {
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  fbclid?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  ttclid?: string | null;
  napm?: string | null;
}

export interface UtmFields {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  term?: string | null;
  content?: string | null;
}
```

## GuardDecision

`GuardDecision`은 전송 가능 여부와 차단 이유를 설명하는 공통 schema다.
운영자가 “왜 0건인가”를 이해할 수 있게 수량과 이유를 분리한다.

```ts
export type GuardStatus = "passed" | "blocked" | "warn" | "unknown";

export type BlockReason =
  | "read_only_phase"
  | "approval_required"
  | "missing_google_click_id"
  | "test_click_id_rejected_for_live"
  | "site_unknown"
  | "site_not_allowed"
  | "source_stale"
  | "source_unavailable_before_publish"
  | "missing_order_identity"
  | "payment_method_not_allowed"
  | "signal_stage_must_be_payment_complete"
  | "blocked_signal_stage_npay_click"
  | "blocked_signal_stage_npay_count"
  | "blocked_signal_stage_npay_payment_start"
  | "invalid_paid_at"
  | "invalid_captured_at"
  | "invalid_value"
  | "currency_not_allowed"
  | "test_order"
  | "manual_order"
  | "canceled_order"
  | "refunded_order"
  | "already_in_ga4"
  | "already_in_meta"
  | "already_in_google_ads"
  | "outside_backdate_window"
  | "pii_detected"
  | "secret_detected"
  | "invalid_value_field"
  | "ambiguous_evidence";

export interface GuardDecision {
  guard_status: GuardStatus;
  send_candidate: boolean;
  actual_send_candidate: boolean;
  block_reasons: BlockReason[];
  warnings: string[];
  no_send_verified: boolean;
  no_write_verified: boolean;
  no_deploy_verified: boolean;
  no_publish_verified: boolean;
  no_platform_send_verified: boolean;
  checked_at: IsoDateTimeString;
  source: string;
  confidence: number;
}
```

### 현재 route와 canonical block reason 차이

현재 로컬 route는 일부 block reason을 아래처럼 쓴다.
다음 backend alignment 때 canonical 이름으로 맞추거나 compatibility alias를 둔다.

| 현재 route | canonical | 처리 |
|---|---|---|
| `order_canceled` | `canceled_order` | should align |
| `order_refunded` | `refunded_order` | should align |
| `pii_or_secret_detected` | `pii_detected` 또는 `secret_detected` | response reason alias 유지 가능 |
| `pii_secret_or_purchase_field_detected` | `pii_detected`, `secret_detected`, `invalid_value_field` | paid click intent reject reason 분리 권장 |

## PaidClickIntent no-send request

목적은 Google click id 같은 paid 유입 증거를 랜딩 시점에 저장할 수 있는지 확인하는 것이다.
구매 후보가 아니며 결제금액을 받지 않는다.

```ts
export type PaidClickCaptureStage =
  | "landing"
  | "page_view"
  | "cart"
  | "add_to_cart"
  | "checkout_start"
  | "payment_start"
  | "npay_intent";

export interface PaidClickIntentNoSendRequest {
  site?: Site;
  event_name?: "PaidClickIntent" | string;
  capture_stage?: PaidClickCaptureStage;
  captured_at?: IsoDateTimeString;
  event_id?: string;
  storage_key?: string;

  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  fbclid?: string | null;
  ttclid?: string | null;

  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;

  client_id?: string | null;
  ga_session_id?: string | null;
  local_session_id?: string | null;

  landing_url?: string | null;
  current_url?: string | null;
  referrer?: string | null;
}
```

### PaidClickIntent 금지 필드

아래 필드는 `paid-click-intent/no-send`에 들어오면 reject한다.

- `order_number`
- `channel_order_no`
- `payment_key`
- `value`
- `currency`
- `paid_at`
- 이름, 전화번호, 이메일, 주소
- 카드번호, 계좌번호
- raw cookie
- access token
- 건강 상태나 질병 추정값

## PaidClickIntent no-send response

```ts
export interface PaidClickIntentPreview {
  site: Site;
  event_name: string;
  capture_stage: PaidClickCaptureStage;
  event_id: string;
  storage_key: string;
  captured_at: IsoDateTimeString;
  dedupe_key: string;
  has_google_click_id: boolean;
  test_click_id: boolean;
  live_candidate_after_approval: boolean;
  would_store: false;
  would_send: false;
  block_reasons: BlockReason[];
  click_ids: Pick<ClickIdentifiers, "gclid" | "gbraid" | "wbraid" | "fbclid" | "ttclid">;
  utm: UtmFields;
  client_id?: string | null;
  ga_session_id?: string | null;
  local_session_id?: string | null;
  sanitized_landing_url?: string;
  sanitized_current_url?: string;
  sanitized_referrer?: string;
}

export interface PaidClickIntentNoSendResponse {
  ok: boolean;
  dryRun: true;
  receiver: "paid_click_intent_no_send";
  wouldStore: false;
  wouldSend: false;
  noSendVerified: true;
  noWriteVerified: true;
  noDeployVerified: true;
  noPublishVerified: true;
  noPlatformSendVerified: true;
  preview: PaidClickIntentPreview;
  source: {
    mode: "no_write_no_send_preview";
    receivedAt: IsoDateTimeString;
  };
  warnings: string[];
}
```

## ConfirmedPurchase no-send request

목적은 실제 결제완료 주문만 purchase 후보가 될 수 있는지 검증하는 것이다.
NPay click/count/payment start만 있는 row는 여기에 들어오면 안 된다.

```ts
export type ConfirmedPurchasePaymentMethod =
  | "homepage"
  | "npay"
  | "subscription"
  | "virtual_account";

export type ConfirmedPurchaseSignalStage =
  | "payment_complete"
  | "confirmed_order";

export interface ConfirmedPurchaseNoSendRequest {
  site?: Site;
  order_number?: string | null;
  channel_order_no?: string | null;
  payment_key?: string | null;
  payment_method: ConfirmedPurchasePaymentMethod;
  signal_stage: ConfirmedPurchaseSignalStage;
  paid_at: IsoDateTimeString;
  value: number;
  currency: CurrencyCode;

  client_id?: string | null;
  ga_session_id?: string | null;

  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  fbclid?: string | null;
  ttclid?: string | null;

  event_id?: string | null;
  page_location?: string | null;
  page_referrer?: string | null;

  is_test?: boolean;
  is_manual?: boolean;
  is_canceled?: boolean;
  is_refunded?: boolean;
}
```

### ConfirmedPurchase 금지/차단 입력

아래는 purchase 후보가 아니다.

- `signal_stage=npay_click`
- `signal_stage=npay_count`
- `signal_stage=npay_payment_start`
- `signal_stage=add_payment_info`
- `payment_method`가 허용 목록 밖인 값
- `value <= 0`
- `currency != KRW`
- `is_test=true`
- `is_manual=true`, 별도 승인 전
- `is_canceled=true`
- `is_refunded=true`
- PII 또는 secret 포함

## ConfirmedPurchase no-send response

```ts
export interface PlatformPayloadPreview {
  ga4: {
    event_name: "purchase";
    transaction_id?: string | null;
    value: number | null;
    currency: CurrencyCode;
    client_id?: string | null;
    ga_session_id?: string | null;
    event_id: string;
    blocked: true;
    block_reason: "ga4_measurement_protocol_not_approved";
  };
  meta: {
    event_name: "Purchase";
    event_id: string;
    value: number | null;
    currency: CurrencyCode;
    event_source_url?: string;
    blocked: true;
    block_reason: "meta_capi_purchase_not_approved";
  };
  google_ads: {
    conversion_name: "BI confirmed_purchase";
    order_id?: string | null;
    conversion_time: IsoDateTimeString;
    conversion_value: number | null;
    currency_code: CurrencyCode;
    gclid?: string | null;
    gbraid?: string | null;
    wbraid?: string | null;
    blocked: true;
    block_reason: "google_ads_conversion_upload_not_approved";
  };
}

export interface ConfirmedPurchasePreview {
  site: Site;
  order_number?: string | null;
  channel_order_no?: string | null;
  include_reason: "homepage_confirmed_order" | "npay_confirmed_order";
  payment_method: ConfirmedPurchasePaymentMethod;
  signal_stage: ConfirmedPurchaseSignalStage;
  value: number | null;
  currency: CurrencyCode;
  paid_at: IsoDateTimeString;
  event_id: string;
  dedupe_key: string;
  client_id?: string | null;
  ga_session_id?: string | null;
  click_ids: Pick<ClickIdentifiers, "gclid" | "gbraid" | "wbraid" | "fbclid" | "ttclid">;
  sanitized_page_location?: string;
  sanitized_page_referrer?: string;
  has_google_click_id: boolean;
  send_candidate: false;
  would_store: false;
  would_send: false;
  block_reasons: BlockReason[];
  platform_payload_preview: PlatformPayloadPreview;
}

export interface ConfirmedPurchaseNoSendResponse {
  ok: boolean;
  dryRun: true;
  receiver: "confirmed_purchase_no_send";
  wouldStore: false;
  wouldSend: false;
  noSendVerified: true;
  noWriteVerified: true;
  noDeployVerified: true;
  noPublishVerified: true;
  noPlatformSendVerified: true;
  preview: ConfirmedPurchasePreview;
  source: {
    mode: "no_write_no_send_preview";
    receivedAt: IsoDateTimeString;
  };
  warnings: string[];
}
```

## Normalized domain schema

API preview response는 수신 검증용이다.
월별 채널 분류와 platform dispatcher 설계에서는 아래 normalized schema를 쓴다.

```ts
export interface PaymentCompleteOrder {
  site: Site;
  order_number?: string | null;
  channel_order_no?: string | null;
  payment_key?: string | null;
  payment_method: ConfirmedPurchasePaymentMethod;
  paid_at: IsoDateTimeString;
  value: number;
  currency: CurrencyCode;
  status: "payment_complete" | "confirmed_order";
  is_canceled: boolean;
  is_refunded: boolean;
  is_test: boolean;
  is_manual: boolean;
  source_freshness: Record<string, SourceFreshness>;
}

export interface ConfirmedPurchaseCandidate {
  candidate_id: string;
  order: PaymentCompleteOrder;
  click_identifiers: ClickIdentifiers;
  session: {
    client_id?: string | null;
    ga_session_id?: string | null;
    local_session_id?: string | null;
    landing_url?: string | null;
    referrer?: string | null;
  };
  evidence: {
    paid_click_intent_id?: string | null;
    checkout_intent_id?: string | null;
    external_payment_intent_id?: string | null;
    channel_evidence: ChannelEvidence[];
    evidence_confidence: EvidenceConfidence;
    evidence_notes?: string;
  };
  platform_presence: {
    ga4: PlatformPresenceStatus;
    meta: PlatformPresenceStatus;
    google_ads: PlatformPresenceStatus;
  };
  guard: GuardDecision;
}

export interface ChannelEvidence {
  evidence_type:
    | "gclid"
    | "gbraid"
    | "wbraid"
    | "fbclid"
    | "ttclid"
    | "napm"
    | "utm"
    | "referrer"
    | "ga_session"
    | "paid_click_intent"
    | "external_payment_intent"
    | "platform_claim";
  platform_hint: "google_ads" | "meta_ads" | "tiktok_ads" | "naver_ads" | "unknown";
  value: string;
  captured_at?: IsoDateTimeString;
  confidence: EvidenceConfidence;
  source: string;
}

export interface ChannelAssignment {
  order_number?: string | null;
  channel_order_no?: string | null;
  primary_channel: PrimaryChannel;
  assist_channels: PrimaryChannel[];
  payment_method: ConfirmedPurchasePaymentMethod;
  assignment_version: string;
  evidence_confidence: EvidenceConfidence;
  unknown_reason?: BlockReason | "npay_payment_unattributed" | null;
  source_freshness: Record<string, SourceFreshness>;
}
```

## URL 정제 규칙

URL은 origin, pathname, allowlisted query만 남긴다.
health/PII/secret 성격 query는 버린다.

허용 query:

- `gclid`
- `gbraid`
- `wbraid`
- `fbclid`
- `ttclid`
- `NaPm`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_term`
- `utm_content`
- `idx`
- `order_code`
- `payment_code`
- `order_no`

`PaidClickIntent`에서는 order 관련 query를 가능하면 저장하지 않는다.
`ConfirmedPurchaseCandidate`에서는 결제완료 식별을 위해 order 관련 query를 허용하되 PII는 금지한다.

## Endpoint 분리 매트릭스

| 신호 | `paid-click-intent/no-send` | `confirmed-purchase/no-send` | 이유 |
|---|---:|---:|---|
| Google landing click id | YES | NO | 구매 전 유입 증거 |
| checkout start에 남은 click id | YES | NO | 구매 전 유입 증거 |
| NPay click intent | YES | NO | purchase 아님 |
| homepage payment complete | NO | YES | 실제 결제완료 |
| NPay actual confirmed order | NO | YES | 실제 결제완료 |
| NPay count | NO | NO | 오염 가능 신호 |
| AddPaymentInfo | NO | NO | 구매 전 단계 |

## 성공 기준

1. API와 대시보드가 `platform_reference`와 `internal_confirmed`를 섞지 않는다.
2. `send_candidate=0`은 항상 eligible count와 block reason breakdown을 함께 보여준다.
3. `NPay click/count/payment start`는 purchase 후보 schema에 들어오지 못한다.
4. `NPayActualConfirmedOrder`는 confirmed purchase 후보에 포함될 수 있다.
5. `TEST_`, `DEBUG_`, `PREVIEW_` click id는 live candidate에서 reject된다.
6. `site_unknown`은 외부 전송 후보가 되지 않는다.

## Backend alignment 제안

지금 당장 코드 변경은 필요 없다.
다음 Green Lane 또는 Yellow Lane에서 아래를 정렬한다.

1. `order_canceled`와 `order_refunded`를 canonical block reason `canceled_order`, `refunded_order`로 맞춘다.
2. no-send response에 `guard` 객체를 추가해 `preview.block_reasons`만 보지 않아도 되게 한다.
3. `PaidClickIntent` response의 `click_ids`를 ontology 공통 타입 `click_identifiers`와 alias 처리한다.
4. `ConfirmedPurchase` response의 `send_candidate=false` 옆에 `actual_send_candidate=false`를 추가한다.
5. `/total` API에 `ontology_version` 또는 `assignment_schema_version`을 넣는다.

## Auditor verdict

Auditor verdict: READY_FOR_FIELD_ALIGNMENT
No-send verified in plan: YES
No-write verified in plan: YES
No-deploy verified in plan: YES
No-publish verified in plan: YES
No-platform-send verified in plan: YES

Recommendation: proceed with backend field alignment as Green Lane only.
Confidence: 88%.
