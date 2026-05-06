# Attribution Ontology Lite

작성 시각: 2026-05-06 12:05 KST
Status: active draft
Owner: total / attribution
Supersedes: none
Next document: [[attribution-ontology-schema-contract-20260506]]
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
    - total/!total.md
    - gdn/!gdnplan.md
    - gdn/google-click-id-preservation-plan-20260505.md
    - gdn/confirmed-purchase-no-send-pipeline-contract-20260505.md
    - gdn/paid-click-intent-gtm-preview-approval-20260506.md
    - naver/npay-rail-source-gap-20260506.md
    - GA4/product-engagement-summary-contract-20260505.md
    - data/!bigquery.md
  lane: Green
  allowed_actions:
    - read-only terminology audit
    - ontology-lite 문서 작성
    - JSON/TypeScript schema 초안 작성
    - 문서 index 연결
  forbidden_actions:
    - GTM Preview/Production publish
    - Google Ads conversion action 생성/변경
    - conversion upload
    - GA4/Meta/Google Ads/TikTok/Naver 전송
    - 운영 DB write
    - backend 운영 deploy
  source_window_freshness_confidence:
    source: "repo documents + backend route contract + no-send dry-run outputs"
    window: "2026-05-06 KST 문서 정리 기준"
    freshness: "문서/코드 정적 조사. 숫자는 각 근거 문서의 source freshness를 따른다"
    site: "biocom first, multi-site expandable"
    confidence: 0.9
```

## 10초 결론

이 프로젝트에서는 **광고 클릭, 결제 시도, 실제 결제완료, 플랫폼 주장값, 내부 확정매출**을 반드시 다른 개념으로 다룬다.
`NPay click/count/payment start`는 구매가 아니고, `NPay actual confirmed order`는 실제 매출이다.
Google Ads, Meta, GA4, TikTok이 주장하는 전환값은 `platform_reference`이고, 예산 판단용 내부 매출은 `internal_confirmed_revenue`다.

정식 RDF/OWL은 아직 도입하지 않는다.
지금은 `ontology-lite`, 즉 개념 사전, 상태 모델, 관계 규칙, JSON/TypeScript 스키마로 고정한다.

## 문서 목적

이 문서는 biocom 월별 채널 매출 정합성, Google Ads ROAS 정정, NPay confirmed purchase 복구, Meta/GA4/CAPI 전송 guard, `/total` 및 `/ads` 대시보드에서 사용하는 핵심 개념을 표준화한다.

목표는 다섯 가지다.

- `NPay click`, `NPay count`, `NPay actual confirmed order`, `purchase`, `confirmed_purchase`, `platform_reference`, `internal_confirmed`를 혼동하지 않게 한다.
- 광고 플랫폼이 주장하는 전환값과 내부 결제완료 원장 매출을 분리한다.
- Google, Meta, TikTok, Naver, GA4, NPay, Imweb, Toss, Attribution VM에서 들어오는 증거를 같은 구조로 해석한다.
- Codex, Claude Code, 운영자, 개발자, 특허 검토자가 같은 단어를 같은 뜻으로 쓰게 한다.
- 추후 특허 명세서와 claim 작성 시 사용할 개념 구조를 제공한다.

## 관련 schema contract

API와 TypeScript field 기준은 [[attribution-ontology-schema-contract-20260506]]을 따른다.
이 문서는 개념 정본이고, schema contract는 `PaidClickIntent`, `ConfirmedPurchaseCandidate`, `GuardDecision`를 실제 backend route와 `/total`, `/ads/google` field로 연결한다.
현재 backend route와 canonical field의 정렬 계획은 [[backend-attribution-field-alignment-plan-20260506]]에 둔다.

## 핵심 원칙

### Principle 1. Event is not Revenue

이벤트는 매출이 아니다.

매출이 아닌 예:

- `ViewContent`
- `AddToCart`
- `InitiateCheckout`
- `AddPaymentInfo`
- `NPayClick`
- `NPayCount`
- `ExternalPaymentIntent`
- `ProductEngagementSummary`

매출로 인정되는 것은 내부 결제완료 원장에 존재하는 `PaymentCompleteOrder`다.

### Principle 2. External Payment Intent is not Purchase

NPay 버튼 클릭, NPay count, NPay 결제 시작은 구매가 아니다.

```text
NPayClick != Purchase
NPayCount != Purchase
NPayPaymentStart != Purchase
ExternalPaymentIntent != Purchase
```

NPay 실제 결제완료 주문은 구매다.

```text
NPayActualConfirmedOrder -> PaymentCompleteOrder
PaymentCompleteOrder -> ConfirmedPurchaseCandidate 가능
```

### Principle 3. Platform Conversion Claim is not Internal Confirmed Revenue

Google Ads, Meta, GA4, TikTok이 주장하는 conversion value는 내부 confirmed revenue가 아니다.

```text
PlatformConversionClaim != InternalConfirmedRevenue
```

`/total`과 `/ads`에서는 아래를 분리한다.

```text
internal_confirmed_revenue
internal_confirmed_roas
platform_reference_value
platform_reference_roas
```

### Principle 4. Confirmed Purchase Candidate must come from PaymentCompleteOrder

`ConfirmedPurchaseCandidate`는 반드시 실제 결제완료 주문에서 파생되어야 한다.

포함 가능:

- 홈페이지 결제완료 주문
- NPay 실제 결제완료 주문
- 구독 결제완료 주문
- 가상계좌 입금확정 주문

제외:

- NPay click only
- NPay count only
- payment start only
- AddPaymentInfo only
- platform conversion claim only
- GA4 purchase without internal order match

### Principle 5. Quarantine before Guess

증거가 부족한 주문은 억지로 캠페인이나 사이트에 배정하지 않는다.

대표 quarantine:

- `unknown_quarantine`
- `site_unknown`
- `source_unavailable_before_publish`
- `source_stale`
- `ambiguous_evidence`

`source_unavailable_before_publish`는 `unmatched`가 아니다.
수집기가 없던 기간이라 매칭할 수 없는 상태다.

### Principle 6. No-send before Send

실제 GA4, Meta, Google Ads, TikTok, Naver로 전송하기 전에는 항상 no-send preview가 먼저다.

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

## 핵심 클래스

### Site

브랜드 또는 쇼핑몰 단위다.

예시:

- `biocom`
- `thecleancoffee`
- `aibio`
- `unknown`

규칙:

- `site=null`이면 source로 보강한다.
- `source=iw_bi`이면 `site=biocom`.
- `source=iw_th`이면 `site=thecleancoffee`.
- 보강 실패 시 `site_unknown`으로 quarantine하고 외부 전송하지 않는다.

권장 필드명:

- `site`
- `site_source`
- `site_confidence`

### AdClick

광고 클릭 자체다.

주요 필드:

- `platform`
- `campaign_id`
- `adset_id`
- `ad_id`
- `click_time`
- `landing_url`
- `referrer`

포함 예:

- Google Ads 클릭
- Meta Ads 클릭
- TikTok Ads 클릭
- Naver Ads 클릭

포함하지 않는 예:

- 결제완료 주문
- 플랫폼 전환값
- NPay 결제수단

### ClickIdentifier

광고 클릭과 이후 행동을 이어주는 식별키다.

예시:

- `gclid`
- `gbraid`
- `wbraid`
- `fbclid`
- `_fbc`
- `_fbp`
- `ttclid`
- `NaPm`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_term`
- `utm_content`

규칙:

- `ClickIdentifier`는 구매가 아니다.
- `ClickIdentifier`는 구매와 광고 클릭을 연결하는 evidence다.
- `TEST_`, `DEBUG_`, `PREVIEW_` prefix는 live candidate에서 reject한다.

### PaidClickIntent

랜딩 시점 또는 checkout/NPay intent 시점에 저장한 paid 유입 증거다.

주요 필드:

- `site`
- `capture_stage`
- `gclid`
- `gbraid`
- `wbraid`
- `fbclid`
- `ttclid`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `landing_url`
- `referrer`
- `client_id`
- `ga_session_id`
- `captured_at`

규칙:

- `PaidClickIntent`는 purchase가 아니다.
- `PaidClickIntent`는 checkout/payment complete에 연결될 때 attribution evidence가 된다.
- 결제금액, 주문번호, 결제완료 시각을 받지 않는다.
- 로컬 preview endpoint는 `POST /api/attribution/paid-click-intent/no-send`다.

금지 해석:

- `paid_click_intent가 있다`를 `구매했다`로 해석하지 않는다.

### ProductEngagementSummary

상품 상세 페이지에서 사용자가 얼마나 진지하게 상품을 봤는지 나타내는 내부 분석용 요약 이벤트다.

주요 필드:

- `product_idx`
- `visible_seconds`
- `max_scroll_percent`
- `page_location`
- `client_id`
- `ga_session_id`
- `captured_at`
- `debug_mode`

파생 지표:

```text
is_engaged_view = visible_seconds >= 45 && max_scroll_percent >= 50
is_deep_view = visible_seconds >= 90 && max_scroll_percent >= 75
bounce_like = visible_seconds < 10 && max_scroll_percent < 25
```

규칙:

- `ProductEngagementSummary`는 purchase가 아니다.
- Meta/Google Ads 운영 전환으로 바로 보내지 않는다.
- 내부 분석용으로만 시작한다.

### CheckoutIntent

일반 결제 시작이다.

예시:

- `cart_to_checkout`
- `checkout_started`
- `begin_checkout`

규칙:

- `CheckoutIntent`는 purchase가 아니다.
- `checkout_started`만으로 confirmed purchase 후보가 될 수 없다.

### ExternalPaymentIntent

NPay 같은 외부 결제수단으로 진입한 의도 이벤트다.

예시:

- `NPayClick`
- `NPayPaymentStart`
- `NPayCount`
- `ExternalWalletIntent`

규칙:

- `ExternalPaymentIntent`는 purchase가 아니다.
- 실제 외부 결제완료 주문과 매칭될 때 evidence가 된다.

### PaymentCompleteOrder

실제 결제완료 주문이다.

source 예:

- Imweb operational order
- Toss approved payment
- NPay confirmed order
- subscription confirmed order
- virtual account paid-confirmed order

주요 필드:

- `order_number`
- `channel_order_no`
- `payment_key`
- `payment_method`
- `paid_at`
- `amount`
- `currency`
- `site`
- `status`
- `is_canceled`
- `is_refunded`
- `is_test`
- `is_manual`

규칙:

- `PaymentCompleteOrder`만 revenue source가 될 수 있다.
- 취소, 환불, 테스트, 수동 주문은 guard를 통과해야 한다.

### InternalConfirmedRevenue

내부 원장 기준 실제 확정 매출이다.

공식:

```text
InternalConfirmedRevenue = confirmed payment amount - canceled/refunded amount
```

규칙:

- `InternalConfirmedRevenue`는 예산 판단용 내부 ROAS의 분자다.
- `PlatformConversionClaim`과 합산하지 않는다.

### PlatformConversionClaim

광고/분석 플랫폼이 주장하는 전환이다.

예시:

- Google Ads Conv. value
- Google Ads All conv. value
- Meta purchase value
- GA4 purchase revenue
- TikTok platform value
- Naver Ads conversion value

규칙:

- `PlatformConversionClaim`은 `platform_reference`다.
- 내부 confirmed revenue가 아니다.
- 내부 매출에 합산하지 않는다.

### ConfirmedPurchaseCandidate

실제 결제완료 주문에서 파생된 광고 플랫폼 전송 후보다.

필수 조건:

- `PaymentCompleteOrder` 존재
- not canceled
- not refunded
- not test
- not manual unless explicitly approved
- site known
- source freshness acceptable
- platform dedupe guard passed
- approval status valid

Google Ads 추가 조건:

- `gclid` 또는 `gbraid` 또는 `wbraid` 존재
- `conversion_time` 존재
- `value/currency` 존재
- `order_id` 존재

GA4 추가 조건:

- `transaction_id` 존재
- `client_id` 또는 required identifier 존재
- 72시간 backdate 여부 검토

Meta 추가 조건:

- `event_id` 존재
- `event_source_url` 또는 user_data evidence 존재
- dedupe key 존재

### GuardDecision

전송 가능 여부를 판단하는 결과다.

주요 필드:

- `guard_name`
- `guard_status`
- `block_reason`
- `confidence`
- `checked_at`
- `source`

상태:

- `passed`
- `blocked`
- `warn`
- `unknown`

### PlatformPresenceStatus

플랫폼 이벤트 원장에 이미 존재하는지 확인한 상태다.

| 상태 | 의미 |
|---|---|
| `present` | 플랫폼 이벤트 원장에 이미 purchase가 있음 |
| `robust_absent` | 주문번호와 외부 채널 주문번호 등 복수 키로 조회했지만 purchase가 없음 |
| `unknown` | 조회 권한, source, 기간 문제로 확인 불가 |
| `not_checked` | 아직 guard를 실행하지 않음 |

중요:

- `robust_absent`는 주문이 없다는 뜻이 아니다.
- 실제 주문은 있지만 플랫폼 purchase 이벤트가 안 보인다는 뜻이다.

### SourceFreshness

source가 최신인지 나타내는 상태다.

| 상태 | 의미 |
|---|---|
| `fresh` | 운영 판단에 사용 가능 |
| `warn` | 사용 가능하지만 lag 또는 일부 누락 가능 |
| `stale` | 최신 판단 금지 |
| `unavailable` | 접근 불가 |
| `source_unavailable_before_publish` | 해당 기간에는 수집기가 존재하지 않았음 |

### ChannelEvidence

주문을 특정 유입 채널에 배정하기 위한 증거다.

예시:

- `gclid`
- `gbraid`
- `wbraid`
- `fbclid`
- `ttclid`
- `NaPm`
- `utm_campaign`
- `utm_source`
- `utm_medium`
- `referrer`
- `ga_session_id`
- `client_id`
- `paid_click_intent`
- `external_payment_intent`
- `platform claim`

confidence:

- A: 직접 click id + confirmed order 연결
- B: UTM/campaign/session/time/amount 조합
- C: 약한 referrer 또는 session evidence
- D: platform claim only

규칙:

- D 단독으로 primary channel 배정 금지.
- platform claim only는 `platform_reference`로만 유지.

### ChannelAssignment

주문 매출을 어느 채널에 귀속할지 결정한 결과다.

primary channel 후보:

- `paid_meta`
- `paid_tiktok`
- `paid_google`
- `paid_naver`
- `owned_crm`
- `organic_search`
- `direct`
- `unknown_quarantine`

규칙:

- `primary_channel`은 한 주문에 하나만 둔다.
- `assist_channel`은 여러 개 가능하지만 내부 confirmed revenue 합산에는 중복 반영하지 않는다.
- `payment_method=npay`는 `paid_naver`를 의미하지 않는다.

2026년 4월 NPay intent publish 이전 주문:

```text
primary_channel = unknown_quarantine
payment_method = npay
unknown_reason = source_unavailable_before_publish
```

또는 별도 분석 bucket:

```text
npay_payment_unattributed
```

금지 표현:

```text
paid_naver_unattributed
```

## 관계 모델

```text
AdClick hasIdentifier ClickIdentifier
PaidClickIntent derivedFrom AdClick
PaidClickIntent stores ClickIdentifier
CheckoutIntent carries ClickIdentifier
ExternalPaymentIntent carries ClickIdentifier
PaymentCompleteOrder mayMatch ExternalPaymentIntent
PaymentCompleteOrder mayMatch PaidClickIntent
PaymentCompleteOrder produces InternalConfirmedRevenue
PaymentCompleteOrder mayBecome ConfirmedPurchaseCandidate
ConfirmedPurchaseCandidate checkedBy GuardDecision
ConfirmedPurchaseCandidate hasPlatformPresence PlatformPresenceStatus
PlatformConversionClaim comparedWith InternalConfirmedRevenue
ChannelAssignment supportedBy ChannelEvidence
UnknownOrder quarantinedBecause GuardDecision
```

## 이벤트 분류표

| 이벤트/신호 | 구매인가 | 매출 포함 | 광고 플랫폼 전송 가능성 | 비고 |
|---|---:|---:|---|---|
| `ViewContent` | No | No | Test/standard 가능 | purchase 아님 |
| `AddToCart` | No | No | Test/standard 가능 | purchase 아님 |
| `InitiateCheckout` | No | No | Test/standard 가능 | purchase 아님 |
| `AddPaymentInfo` | No | No | Test/standard 가능 | purchase 아님 |
| `NPayClick` | No | No | purchase 금지 | intent evidence |
| `NPayCount` | No | No | purchase 금지 | Google Ads 오염 원인 |
| `NPayPaymentStart` | No | No | purchase 금지 | intent evidence |
| `ProductEngagementSummary` | No | No | 운영 purchase 금지 | 내부 분석용 |
| `HomepagePaymentComplete` | Yes | Yes | confirmed purchase 가능 | guard 필요 |
| `NPayActualConfirmedOrder` | Yes | Yes | confirmed purchase 가능 | click/count와 구분 |
| `GA4Purchase` | Maybe | No 단독 | platform_reference | 내부 order match 필요 |
| `GoogleAdsConversionValue` | Maybe | No 단독 | platform_reference | 내부 매출 아님 |
| `MetaPurchaseClaim` | Maybe | No 단독 | platform_reference | 내부 매출 아님 |

## Block Reason Taxonomy

| block_reason | 쉬운 뜻 | 기본 처리 |
|---|---|---|
| `missing_google_click_id` | Google Ads 매칭에 필요한 `gclid/gbraid/wbraid`가 없음 | Google Ads 전송 차단 |
| `already_in_ga4` | GA4에 이미 purchase가 있음 | GA4 복구 차단 |
| `already_in_meta` | Meta에 이미 purchase가 있음 | Meta 중복 차단 |
| `already_in_google_ads` | Google Ads에 이미 같은 order가 있음 | Google 중복 차단 |
| `source_stale` | 원장이 오래되어 최신 판단 금지 | 재조회 필요 |
| `source_unavailable_before_publish` | 해당 기간엔 수집기가 없었음 | unmatched로 부르지 않음 |
| `site_unknown` | site 확정 실패 | 외부 전송 금지 |
| `test_order` | 테스트 주문 | 운영 전송 금지 |
| `manual_order` | 수동 주문 | 명시 승인 없으면 차단 |
| `canceled_order` | 취소 주문 | 매출 후보 제외 |
| `refunded_order` | 환불 주문 | 순매출 보정 또는 차단 |
| `approval_required` | Red/Yellow 승인 전 | 보류 |
| `read_only_phase` | no-send 단계 | 전송 0건 유지 |
| `outside_backdate_window` | 플랫폼 backdate window 밖 | 별도 검토 |
| `pii_detected` | 개인정보나 secret 감지 | payload reject |
| `invalid_value_field` | 금액/통화 값 이상 | payload reject |
| `ambiguous_evidence` | 증거 충돌 | quarantine |
| `test_click_id_rejected_for_live` | TEST/DEBUG/PREVIEW click id | live 후보 차단 |

## Channel Assignment Taxonomy

| primary_channel | 정의 | 필요 증거 | 금지 해석 |
|---|---|---|---|
| `paid_meta` | Meta 광고 유입 매출 | `fbclid`, `_fbc`, Meta UTM/campaign evidence | 상품군만 보고 Meta 배정 금지 |
| `paid_tiktok` | TikTok 광고 유입 매출 | `ttclid`, TikTok UTM/campaign evidence | TikTok platform claim only로 배정 금지 |
| `paid_google` | Google Ads 유입 매출 | `gclid/gbraid/wbraid`, Google UTM/campaign evidence | Google Ads Conv. value만으로 배정 금지 |
| `paid_naver` | Naver Ads 유입 매출 | Naver paid UTM, `NaPm`, Naver Ads evidence | `payment_method=npay`만으로 배정 금지 |
| `owned_crm` | 카카오/문자/이메일/CRM 유입 | CRM UTM, 메시지 링크 | direct와 혼동 금지 |
| `organic_search` | 자연 검색 유입 | 검색엔진 referrer, paid click id 없음 | paid UTM 있으면 organic 금지 |
| `direct` | 직접 방문 또는 출처 상실 | 유입 증거 없음 | unknown을 무조건 direct로 배정 금지 |
| `unknown_quarantine` | 배정 보류 | 증거 부족/충돌/stale | 매출이 없다는 뜻 아님 |

## JSON/TypeScript Schema 초안

### PaidClickIntent

```ts
export interface PaidClickIntent {
  intent_id: string;
  site: "biocom" | "thecleancoffee" | "aibio" | "unknown";
  captured_at: string;
  capture_stage: "landing" | "page_view" | "cart" | "add_to_cart" | "checkout_start" | "payment_start" | "npay_intent";
  platform_hint: "google_ads" | "meta_ads" | "tiktok_ads" | "naver_ads" | "unknown";
  click_identifiers: {
    gclid?: string | null;
    gbraid?: string | null;
    wbraid?: string | null;
    fbclid?: string | null;
    ttclid?: string | null;
    napm?: string | null;
  };
  utm: {
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    term?: string | null;
    content?: string | null;
  };
  page: {
    landing_url: string;
    referrer?: string | null;
  };
  session: {
    client_id?: string | null;
    ga_session_id?: string | null;
    local_session_id?: string | null;
  };
  guard: {
    is_test_click_id: boolean;
    pii_detected: boolean;
    would_store: false;
    would_send: false;
    no_send_verified: true;
  };
}
```

### ConfirmedPurchaseCandidate

```ts
export interface ConfirmedPurchaseCandidate {
  candidate_id: string;
  site: "biocom" | "thecleancoffee" | "aibio" | "unknown";
  order_number?: string | null;
  channel_order_no?: string | null;
  payment_key?: string | null;
  payment_method: "homepage" | "npay" | "toss" | "subscription" | "virtual_account" | "unknown";
  paid_at: string;
  value: number;
  currency: "KRW";
  is_canceled: boolean;
  is_refunded: boolean;
  is_test: boolean;
  is_manual: boolean;
  click_identifiers: {
    gclid?: string | null;
    gbraid?: string | null;
    wbraid?: string | null;
    fbclid?: string | null;
    ttclid?: string | null;
    napm?: string | null;
  };
  session: {
    client_id?: string | null;
    ga_session_id?: string | null;
    landing_url?: string | null;
    referrer?: string | null;
  };
  evidence: {
    paid_click_intent_id?: string | null;
    checkout_intent_id?: string | null;
    external_payment_intent_id?: string | null;
    evidence_confidence: "A" | "B" | "C" | "D";
    evidence_notes?: string;
  };
  platform_presence: {
    ga4: PlatformPresenceStatus;
    meta: PlatformPresenceStatus;
    google_ads: PlatformPresenceStatus;
  };
  source_freshness: Record<string, SourceFreshness>;
  guard: GuardDecision;
}

export type PlatformPresenceStatus = "present" | "robust_absent" | "unknown" | "not_checked";
export type SourceFreshness = "fresh" | "warn" | "stale" | "unavailable" | "source_unavailable_before_publish";
```

### GuardDecision

```ts
export interface GuardDecision {
  send_candidate: boolean;
  guard_status: "passed" | "blocked" | "warn" | "unknown";
  block_reasons: string[];
  no_send_verified: boolean;
  no_write_verified: boolean;
  no_platform_send_verified: boolean;
  checked_at: string;
  source: string;
  confidence: number;
}
```

## 예시 케이스

### Case A. Google Ads -> NPay 클릭 -> NPay 실제 결제완료 -> GA4 없음

판정:

- `InternalConfirmedRevenue` 포함
- `ConfirmedPurchaseCandidate` 가능
- Google Ads 후보 가능, 단 `gclid/gbraid/wbraid` 필요
- GA4 복구 후보 가능, 단 72시간/중복 guard 필요

### Case B. Google Ads -> NPay 클릭만 있음 -> 결제완료 없음

판정:

- purchase 아님
- confirmed_purchase 후보 아님
- Google Ads purchase 전송 금지
- `ExternalPaymentIntent` evidence로만 보관

### Case C. NPay actual confirmed order 있음, GA4 present

판정:

- `InternalConfirmedRevenue` 포함
- GA4 전송 금지
- 중복 방지

### Case D. NPay actual confirmed order 있음, intent publish 이전

판정:

- `InternalConfirmedRevenue` 포함
- `payment_method=npay`
- `primary_channel=unknown_quarantine`
- `unknown_reason=source_unavailable_before_publish`
- unmatched로 부르지 않음
- paid_naver로 강제 배정 금지

## Canonical Term Mapping

| 혼동 표현 | Canonical term | 설명 |
|---|---|---|
| NPay 구매 클릭 | `NPayClick` 또는 `ExternalPaymentIntent` | 클릭은 구매가 아님 |
| NPay 구매완료 label | `NPayCount` 또는 platform-specific count label | 실제 결제완료와 구분 |
| NPay actual order | `NPayActualConfirmedOrder` | 운영 주문 원장에서 확인된 실제 주문 |
| Google ROAS | `platform_reference_roas` | Google Ads가 주장하는 참고값 |
| 자체 ROAS | `internal_confirmed_roas` | 실제 결제완료 원장 기준 ROAS |
| GA4에 없음 | `robust_absent` 또는 `not_checked` | 조회 강도에 따라 분리 |
| 매칭 실패 | `unmatched` 또는 `source_unavailable_before_publish` | 수집기 부재는 unmatched가 아님 |
| NPay 미귀속 | `npay_payment_unattributed` | Naver Ads 유입이라는 뜻 아님 |
| send_candidate=0 | `actual_send_candidate=0 due to read_only/approval` | 결제완료 후보 없음이 아님 |

## 용어 충돌 발견 요약

상세 감사는 [[term-conflict-audit-20260506]]에 둔다.

must:

- `paid_naver_unattributed`는 금지한다. `npay_payment_unattributed` 또는 `unknown_quarantine + payment_method=npay`로 쓴다.
- `robust_absent`는 주문 없음이 아니라 플랫폼 purchase 이벤트 없음이다.
- `send_candidate=0`은 결제완료 후보 없음이 아니라 no-send/read-only/approval 차단일 수 있다.

should:

- `Google Ads ROAS`는 항상 `platform_reference_roas`로 풀어 쓴다.
- `내부 ROAS`는 항상 `internal_confirmed_roas`로 풀어 쓴다.
- `NPay 구매`는 클릭인지, 결제 시작인지, 실제 결제완료인지 명시한다.

nice:

- 프론트엔드 UI에는 “플랫폼 주장값”과 “내부 확정매출” 라벨을 반복 노출한다.

## 다음 할일

1. 이 ontology를 기준으로 `/total` API contract의 enum과 frontend label을 점검한다.
2. `backend/src/routes/attribution.ts`의 no-send route 응답 타입을 이 문서의 TypeScript interface와 맞춘다.
3. 특허 문서에서는 RDF/OWL 대신 이 ontology-lite의 클래스와 관계 모델을 개념 정의로 활용한다.

## Auditor verdict

Auditor verdict: PASS_WITH_NOTES
Project: monthly channel attribution / Google Ads confirmed purchase / NPay recovery
Phase: ontology-lite standardization
Lane: Green
Mode: document-only

No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES
