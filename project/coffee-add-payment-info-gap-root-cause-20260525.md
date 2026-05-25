# 더클린커피 add_payment_info 공백 원인 분해

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - docs/agent-harness/growth-data-harness-v0.md
  required_context_docs:
    - GA4/gtm-thecleancoffee.md
    - project/coffee-meta-checkout-event-gap-gtm-preview-plan-20260522.md
    - project/coffee-meta-initiatecheckout-production-approval-20260524.md
  lane: Green read-only + Yellow approved deploy observation
  allowed_actions:
    - GA4/VM Cloud read-only audit
    - local/backend/frontend smoke
    - documentation
  forbidden_actions:
    - Meta CAPI send
    - GTM publish
    - 운영DB write/import
    - Imweb header/footer change
    - raw identifier output
  source_window_freshness_confidence:
    source: "GA4 BigQuery safe bridge snapshot + GTM inventory docs + live leadingIndicators API"
    window: "latest 7d snapshot checked at 2026-05-24 11:50 KST"
    freshness: "2026-05-25 deploy smoke"
    confidence: "high"
```

## 결론

더클린커피 `add_payment_info` 공백은 화면 표시 문제가 아니라 **수집 이벤트 자체가 아직 설계·발화되지 않은 상태**로 판단한다.

쉽게 말하면, 고객이 결제 페이지에 들어온 것은 `begin_checkout`으로 잡히지만, 그 이후 **결제수단을 선택했다**는 신호를 GA4나 VM Cloud가 아직 별도 이벤트로 받지 못하고 있다.

## 확인한 것

- live `leadingIndicators` API는 GA4 행동 snapshot을 정상 반환한다.
- 더클린커피 Meta 7일 기준 `ga4_behavior_snapshot.status=available`.
- 더클린커피 Meta buyer/non-buyer 모두 `add_payment_info_rate_pct=0`.
- 바이오컴 Meta 7일 기준은 buyer 2.4%, non-buyer 2.9%로 0이 아니다.
- `GA4/gtm-thecleancoffee.md` 기준 더클린커피 GTM에는 `add_payment_info` 태그가 0건이다.
- 기존 설계 문서도 `AddPaymentInfo`는 결제수단 선택 조건이 안정적으로 잡힐 때까지 보류한다고 기록한다.

## 원인 분류

### 1. 데이터 없음이 아니다

더클린커피 GA4 행동 snapshot은 붙었다. `view_item`, `add_to_cart`, `begin_checkout`, 체류시간, 스크롤 같은 행동 데이터는 분석 가능한 상태다.

따라서 "GA4 전체가 안 붙는다"거나 "VM API가 행동값을 못 보여준다"는 문제가 아니다.

### 2. export 지연 가능성은 낮다

동일 snapshot에서 다른 이벤트들은 보이고, `add_payment_info`만 0이다. 최근 7일 전체가 0이면 단순 지연보다 미수집 가능성이 높다.

### 3. 트리거/태그 미구현 가능성이 가장 높다

더클린커피 GTM inventory에 `add_payment_info` 태그가 없다. `/shop_payment/` 진입은 `begin_checkout`으로 보는 것이 맞고, `add_payment_info`는 결제수단 선택 또는 결제 버튼 직전처럼 더 좁은 행동 조건이 필요하다.

### 4. Meta CAPI로 바로 보내면 안 되는 이유

`add_payment_info`는 Meta 표준 이벤트지만, 결제 페이지 진입만으로 보내면 `InitiateCheckout`과 의미가 겹친다. 고객이 카드, NPay, 가상계좌 등 결제수단 선택을 실제로 했다는 evidence가 있을 때 보내야 선행지표로 의미가 있다.

## 권장 설계

1. `payment_method_selected`
   - 사람이 이해하는 의미: 결제수단을 실제로 고른 순간.
   - 기술 이벤트 후보: GA4 `add_payment_info`, Meta `AddPaymentInfo`.
   - 조건: 결제수단 radio/select/change 또는 명확한 결제 버튼 직전 상태.

2. `npay_intent`
   - 사람이 이해하는 의미: NPay로 결제하려는 의도.
   - 기술 이벤트 후보: custom event 또는 Meta `AddPaymentInfo` 후보.
   - 조건: NPay 버튼 클릭 또는 NPay 결제수단 선택.

3. `virtual_account_selected`
   - 사람이 이해하는 의미: 가상계좌/무통장 결제를 선택한 순간.
   - 기술 이벤트 후보: GA4 custom event, Meta custom event.
   - 조건: 실제 결제완료가 아니므로 Purchase로 보내지 않는다.

## 다음 판단 기준

- `add_payment_info`를 살리려면 GTM Preview에서 결제수단 선택 DOM/dataLayer 신호를 먼저 확인한다.
- 확인 전에는 CAPI send를 하지 않고 no-send preview만 만든다.
- `/shop_payment/` 진입만으로는 계속 `begin_checkout`으로 유지한다.

## 운영 영향

- 이번 문서는 read-only 분석이다.
- Meta/GA4/TikTok/Naver/Google Ads 외부 전송 0.
- GTM publish 0.
- 운영DB write/import 0.
- raw identifier output 0.
