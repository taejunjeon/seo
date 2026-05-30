harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
  required_context_docs:
    - capivm/meta-initiate-checkout-capi-nosend-preview-design-20260522.md
    - capivm/meta-initiate-checkout-exclusion-breakdown-20260522.md
  lane: Green
  allowed_actions:
    - read_only_funnel_health_query
    - no_send_payload_preview
    - local_result_document
  forbidden_actions:
    - meta_capi_send
    - vm_cloud_deploy_restart
    - gtm_publish
    - imweb_header_footer_save
    - operational_db_write
    - raw_identifier_output
  source_window_freshness_confidence:
    source: VM Cloud funnel-health API + local no-send preview script
    window: 1d and 7d
    freshness: 2026-05-22 11:38 KST live force refresh
    confidence: high

# InitiateCheckout CAPI no-send payload preview 결과

## 이번에 가능해진 것

Meta로 실제 전송하지 않고도, 서버 CAPI로 보낼 수 있는 중간 전환 후보가 몇 건인지와 payload에 어떤 필드만 들어가야 하는지 확인했다.

핵심은 `결제 페이지 도달 전체`를 그대로 `InitiateCheckout`으로 보내지 않는 것이다. 결제 화면에 도달한 row 중에서 Meta 광고 단서가 강하고, 페이지 이탈/완료 URL/약한 evidence를 제외한 좁은 후보만 남겼다.

## 결과 요약

source: VM Cloud funnel-health API
checked_at: 2026-05-22 11:36-11:38 KST
send: 0
write: 0
publish: 0
deploy: 0

| site | window | 유입 | 결제 페이지 도달 | InitiateCheckout CAPI 후보 | 후보율 | 실제 결제완료 | Purchase CAPI 성공 | AddToCart 후보 | AddPaymentInfo 후보 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| biocom | 1d | 2,133 | 628 | 61 | 9.71% | 59 | 60 | 7 | 0 |
| biocom | 7d | 12,598 | 4,189 | 376 | 8.98% | 380 | 395 | 52 | 0 |
| thecleancoffee | 1d | 81 | 57 | 16 | 28.07% | 19 | 18 | 0 | 0 |
| thecleancoffee | 7d | 637 | 460 | 88 | 19.13% | 158 | 160 | 1 | 0 |

해석:

- 바이오컴 7일 기준 결제 페이지 도달은 4,189건이지만, 서버 CAPI 후보는 376건만 남았다. 넓은 진단 row를 91% 정도 제외한 것이다.
- 더클린커피 7일 기준 결제 페이지 도달은 460건이고, 서버 CAPI 후보는 88건이다.
- `AddPaymentInfo`는 두 site 모두 0이다. 결제수단 선택 이벤트 source가 아직 닫히지 않았으므로 지금 CAPI 후보로 보내면 안 된다.
- `Purchase CAPI 성공`이 `실제 결제완료`보다 큰 구간은 window/event_time 집계 기준 차이 때문이다. 이 preview는 Purchase 정산이 아니라 중간 전환 후보 확인용이다.

## Meta 표준 이벤트 구분

| 이벤트 | Meta 표준 여부 | 이번 preview 상태 | 판단 |
| --- | --- | --- | --- |
| `AddToCart` | 표준 | 후보 있음 | 보조 전환 후보. Purchase ROAS에는 합산 금지 |
| `InitiateCheckout` | 표준 | 후보 있음 | 가장 먼저 Test Events smoke를 검토할 수 있는 후보 |
| `AddPaymentInfo` | 표준 | 후보 0 | source gap. 결제수단 선택 수집 보강 전 전송 금지 |
| `CompleteRegistration` | 표준 | route 미준비 | 회원가입 완료 route와 dedupe 정책 필요 |
| `Scroll50` | 비표준 custom event | route 미준비 | health/wellness 제한과 custom event 효용 검토 필요 |
| `VirtualAccountIssued` | 비표준 custom event | 별도 설계 | Purchase가 아니라 미입금 주문 생성/가상계좌 발급 신호 |
| `Purchase` | 표준 | 운영 중 | 실제 결제완료 전용. 중간 전환과 섞지 않음 |

## no-send payload 정책

모든 후보 이벤트는 아래 형태로만 preview했다.

```json
{
  "event_name": "InitiateCheckout",
  "action_source": "website",
  "event_time": "runtime_unix_seconds",
  "event_id": "safe_session_event_id_or_hash_only",
  "event_source_url_policy": "path_bucket_only_query_removed",
  "user_data_allowed_presence_only": [
    "fbp",
    "fbc",
    "client_ip_address",
    "client_user_agent"
  ],
  "custom_data_policy": {
    "value": "omitted_until_explicit_approval",
    "currency": "omitted_until_explicit_approval",
    "content_name": "forbidden_health_wellness_sensitive",
    "product_name": "forbidden_health_wellness_sensitive"
  }
}
```

보내면 안 되는 값:

- raw order code
- raw order no
- raw payment key
- raw member code
- raw email
- raw phone
- raw click id
- health/wellness 관련 상품명 또는 콘텐츠명

## 주의할 점

`Meta InitiateCheckout 수신`과 `VM Cloud의 browser event row`는 같은 말이 아니다. Meta Events Manager 화면에는 브라우저 `결제 시작`이 보일 수 있지만, 이번 preview는 VM Cloud funnel-health API에 있는 내부 집계만 읽는다. 따라서 이 문서의 `browser_initiate_checkout_count=0`은 “Meta가 받은 InitiateCheckout이 0”이라는 뜻이 아니라, “VM Cloud 내부 browser event row로 조인된 값이 0”이라는 뜻이다.

## 산출물

- `data/project/meta-intermediate-capi-phase2-sprint5-preview-20260522-initiate-checkout-biocom-1d.json`
- `data/project/meta-intermediate-capi-phase2-sprint5-preview-20260522-initiate-checkout-biocom-7d.json`
- `data/project/meta-intermediate-capi-phase2-sprint5-preview-20260522-initiate-checkout-coffee-1d.json`
- `data/project/meta-intermediate-capi-phase2-sprint5-preview-20260522-initiate-checkout-coffee-7d.json`

## 다음 판단

1. `InitiateCheckout`은 CAPI smoke 후보로 볼 수 있다. 다만 실제 전송은 Meta 계정에 영향을 주므로 Red 승인 전 금지다.
2. `AddPaymentInfo`는 source gap이므로 지금 보내면 안 된다.
3. `AddToCart`는 후보가 있으나 바이오컴 52건, 더클린커피 1건으로 현재 포착률이 낮다. 우선순위는 `InitiateCheckout`보다 낮다.
4. `CompleteRegistration`, `Scroll50`은 route와 정책이 준비되지 않았다. 지금은 설계 대상이다.
