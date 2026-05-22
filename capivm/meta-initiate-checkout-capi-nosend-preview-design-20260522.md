harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
  required_context_docs:
    - capivm/!capiplan.md
    - capivm/meta-initiate-checkout-narrowing-dry-run-20260522.md
  lane: Green
  allowed_actions:
    - local_backend_contract_patch
    - frontend_wording_patch
    - no_send_preview_design
    - read_only_audit
  forbidden_actions:
    - meta_capi_send
    - vm_cloud_deploy_restart
    - gtm_publish
    - imweb_header_footer_save
    - operational_db_write
    - raw_identifier_output
  source_window_freshness_confidence:
    source: VM Cloud funnel-health contract + local code
    window: design 기준 2026-05-22
    freshness: local patch
    confidence: high

# InitiateCheckout CAPI no-send preview 설계

## 이번에 바꾼 말의 기준

`결제 시작`이라는 한 단어를 더 이상 한 숫자로 쓰지 않는다. 실제 운영에서는 아래 3개가 서로 다르기 때문이다.

1. **결제 페이지 도달**
   우리 VM Cloud가 주문서나 결제 화면에 도착한 흔적을 본 것이다. 내부 진단값이다. 사용자가 결제 화면을 열었다는 뜻이지, Meta가 `InitiateCheckout`을 받았다는 뜻은 아니다.

2. **Meta InitiateCheckout 수신**
   Meta 픽셀 또는 브라우저 이벤트 forward 경로에서 `InitiateCheckout` 이름의 이벤트가 들어온 것이다. Meta Events Manager 숫자와 가장 가까운 비교 대상이다.

3. **Meta CAPI 후보**
   서버에서 Meta로 보낼 수 있을지 검토하는 좁은 후보이다. `Meta 광고 단서가 강한 결제 시작 흐름`만 남기고, pagehide/exit, 완료 URL, fbp-only 같은 넓은 진단 row는 제외한다. 현재는 **no-send preview**라서 실제 Meta 전송은 0이다.

## Meta 표준 이벤트와 비표준 이벤트

| 이벤트 | Meta 표준 여부 | 현재 의미 | 이번 preview 판단 |
| --- | --- | --- | --- |
| `AddToCart` | 표준 | 장바구니 담기 또는 장바구니 페이지 진입 보조 신호 | 후보 가능. 단 Purchase ROAS에는 절대 합산하지 않음 |
| `InitiateCheckout` | 표준 | 결제 시작 또는 주문서 도달 | 이번 설계의 핵심 후보. VM 넓은 row를 그대로 쓰지 않고 좁힌 후보만 preview |
| `AddPaymentInfo` | 표준 | 결제수단 선택 또는 결제 정보 입력 | source gap이 커서 별도 보강 후 후보화 |
| `CompleteRegistration` | 표준 | 회원가입 완료 | biocom VM Cloud route가 아직 닫히지 않아 후보 보류 |
| `Scroll50` | 비표준 custom event | 50% 스크롤 | health/wellness 정책과 custom event 효용 검토 전 보류 |
| `VirtualAccountIssued` | 비표준 custom event | 가상계좌 발급/미입금 주문 생성 | Purchase가 아니며, 별도 즉시 발화 설계 대상 |
| `Purchase` | 표준 | 실제 결제완료 | 이미 Server CAPI 중심으로 운영. 중간 전환 preview와 섞지 않음 |

## no-send preview가 하는 일

`scripts/meta-intermediate-capi-phase2-sprint5-preview.sh`는 VM Cloud funnel-health 응답을 읽어 중간 전환 후보를 JSON으로 만든다.

이번부터 `InitiateCheckout` 후보는 아래 필드만 사용한다.

```text
checkout_signal_split.meta_capi_initiate_checkout_candidate.count
```

이 필드가 없으면 이전 API 호환을 위해 browser `InitiateCheckout` count만 fallback으로 본다. 넓은 `payment_started` 전체값을 더 이상 후보 수로 보지 않는다.

## 후보 제외 규칙

`InitiateCheckout CAPI 후보`에서 제외하는 row:

- `pagehide`, `exit`, `hidden`처럼 페이지를 떠날 때 생긴 row
- `shop_payment_complete`, `payment_complete`, `payment_success` 같은 완료 URL row
- Meta 광고 단서가 약한 row
- fbp만 있고 fbc/fbclid/Meta UTM이 없는 row
- raw order/payment/member/click id가 필요한 row

## 성공 기준

- 프론트에서 `결제 페이지 도달`, `Meta InitiateCheckout 수신`, `Meta CAPI 후보`가 따로 보인다.
- no-send preview JSON에서 `InitiateCheckout.available_count`는 좁힌 후보 수만 쓴다.
- Meta CAPI 실제 전송 0.
- 운영DB write 0.
- GTM publish 0.
- raw identifier 출력 0.

## 다음 승인 전제

실제 CAPI 전송을 검토하려면 먼저 아래가 필요하다.

1. Test Events smoke 1건 이하로 server `InitiateCheckout` 수신 확인.
2. Purchase count/value/ROAS 변화 0 확인.
3. 이벤트별 OFF rollback 가능.
4. health/wellness data restriction 때문에 product/content_name 같은 민감 표현 제외.
5. `AddPaymentInfo`와 `VirtualAccountIssued`와 의미가 겹치지 않는지 확인.
