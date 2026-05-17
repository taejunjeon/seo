# CompleteRegistration / Scroll50 Route Design

작성 시각: 2026-05-17 14:38 KST
대상: 바이오컴 중간 전환 CAPI 후보
문서 성격: 설계 / no-send route proposal
Lane: Green documentation and read-only audit

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - capivm/!capiplan.md
    - GA4/gtm.md
    - gtmaudit/gtm-audit-2026-05-16.json
  lane: Green design
  allowed_actions:
    - GTM export read-only inspection
    - VM Cloud route design
    - no-send data contract design
    - approval packet drafting
  forbidden_actions:
    - GTM Production publish
    - Meta CAPI 운영 send
    - VM Cloud deploy/restart
    - 운영DB write/import
    - raw identifier report output
  source_window_freshness_confidence:
    source: "GTM export audit + GA4/gtm.md + local backend CAPI route inspection"
    window: "biocom GTM current exported workspace, 2026-05-16 audit file"
    freshness: "GTM export dated 2026-05-16, local inspection 2026-05-17 14:38 KST"
    confidence: 0.84
```

## 한 줄 결론

바이오컴에는 **회원가입 신호와 50% 스크롤 트리거의 일부 재료가 이미 있다**.
하지만 둘 다 VM Cloud 중간 전환 원장이나 Meta CAPI server source로 바로 연결되어 있지는 않다.

## 현재 GTM 상태

### CompleteRegistration

바이오컴 GTM에는 회원가입 관련 태그와 트리거가 있다.

확인된 유형:

- Google Ads 회원가입 태그
- GA4 `sign_up` 태그
- HURDLERS 회원가입 완료 dataLayer 태그
- 회원가입 완료 custom event trigger

해석:

- 회원가입 이벤트는 이미 프론트/GA4/광고 태그 쪽 source가 있다.
- 다만 `CompleteRegistration`이라는 이름으로 VM Cloud에 저장하거나 Meta CAPI server source로 보내는 route는 아직 없다.
- 따라서 바로 Meta CAPI로 보내기보다, VM Cloud no-send 저장부터 해야 한다.

### Scroll50

바이오컴 GTM에는 scrollDepth trigger가 있다.

확인된 조건:

- threshold: 10, 25, 50, 75, 90%
- unit: percent
- start timing: window load

하지만 최신 GTM export 기준으로 바이오컴에서는 이 trigger를 실제 전송 tag가 쓰는 근거가 없다.
반대로 더클린커피 쪽은 scroll tag가 존재한다.

해석:

- 바이오컴은 50% 스크롤을 만들 재료는 있다.
- 그러나 현재는 VM Cloud나 Meta CAPI에 보낼 tag가 붙어 있지 않다.
- `Scroll50`은 Meta 표준 구매 이벤트가 아니므로 custom engagement 신호로 다뤄야 한다.

## GTM으로 만들 수 있나

가능하다. 다만 방법을 구분해야 한다.

### 하면 안 되는 방식

브라우저 GTM에서 Meta CAPI를 직접 호출하는 방식은 권장하지 않는다.

이유:

- Meta CAPI는 서버 전송 통로다.
- 액세스 토큰을 브라우저에 노출하면 안 된다.
- 운영 GTM publish는 Red Lane이다.
- 직접 `/api/meta/capi/track` 같은 send route를 호출하면 실제 Meta 전송이 될 수 있다.

### 권장 방식

GTM은 **VM Cloud no-send receiver**만 호출한다.

권장 흐름:

```text
GTM trigger
-> VM Cloud intermediate-event receiver
-> VM Cloud ledger 저장
-> payload preview
-> Test Events smoke
-> event별 staged CAPI ON 승인
-> Meta CAPI send
```

이렇게 하면 회원가입/스크롤 같은 보조 신호가 Purchase나 ROAS 매출에 섞이지 않는다.

## VM Cloud route 설계

추천 endpoint:

```text
POST /api/attribution/intermediate-event
```

대상 event:

- `CompleteRegistration`
- `Scroll50`
- `AddPaymentInfo`
- `AddToCart`
- `InitiateCheckout`

공통 저장 원칙:

- `purchase_candidate=false`
- `included_in_purchase_roas=false`
- `event_source=browser_or_gtm`
- `meta_send_status=no_send_default`
- raw order/payment/member/click identifier 저장 금지 또는 secure debug only
- URL query 제거
- 건강/웰빙 민감 콘텐츠명 최소화

### CompleteRegistration payload

필수:

- `event_name=CompleteRegistration`
- `site=biocom`
- `event_id`
- `page_path`
- `referrer_host`
- `timestamp`
- `member_present=true/false`
- `registration_source=gtm_or_imweb`
- `purchase_candidate=false`

선택:

- session safe key
- campaign evidence presence flag
- Meta browser cookie presence flag

금지:

- 원문 회원 ID
- 이메일/전화번호
- 원문 광고 클릭 식별자

### Scroll50 payload

필수:

- `event_name=Scroll50`
- `site=biocom`
- `event_id`
- `page_path`
- `scroll_percent=50`
- `timestamp`
- `purchase_candidate=false`

선택:

- page category bucket
- landing source bucket
- session safe key
- visible seconds bucket

금지:

- 상세 건강 검사명/질병명/민감 콘텐츠명
- 원문 URL query
- 원문 개인 식별자

## 왜 이렇게 해야 하나

회원가입과 50% 스크롤은 구매는 아니지만, Meta 학습에는 도움이 될 수 있다.

다만 바이오컴은 건강/웰빙 카테고리 제한 가능성이 있다.
따라서 event_name, URL, custom_data가 민감 정보로 보이지 않도록 최소화해야 한다.

또한 중간 전환 신호를 Purchase와 섞으면 ROAS가 과대평가된다.
그래서 VM Cloud에서 `purchase_candidate=false`를 먼저 고정한 뒤, Meta CAPI 전송은 별도 승인을 받아야 한다.

## 개발 계획

### Sprint A. no-send 저장 경로

- 무엇: VM Cloud에 중간 전환 저장 endpoint를 추가한다.
- 왜: GTM에서 바로 Meta로 보내면 운영 전송이 되어 위험하다.
- 어떻게: `intermediate-event` endpoint가 event를 저장만 하고 Meta send는 하지 않는다.
- 성공 기준: CompleteRegistration/Scroll50 row가 VM Cloud에 보이지만 Meta send count는 0.
- 승인: VM Cloud deploy는 Yellow.

### Sprint B. GTM Preview 설계

- 무엇: GTM에서 회원가입 완료와 50% 스크롤 trigger가 endpoint를 호출할 수 있는지 preview로 확인한다.
- 왜: Production publish 전에 trigger 조건과 payload를 확인해야 한다.
- 어떻게: 별도 workspace, preview only, publish 0.
- 성공 기준: preview에서 VM Cloud no-send endpoint 호출 shape만 확인.
- 승인: GTM workspace 작업은 Yellow, publish는 Red.

### Sprint C. Test Events smoke

- 무엇: Meta Test Events에서 server source 수신을 1건 이하로 확인한다.
- 왜: VM Cloud 저장만으로는 Meta가 받을 수 있는지 알 수 없다.
- 어떻게: `test_event_code`를 사용하고 운영 event count delta 0을 확인한다.
- 성공 기준: Meta Test Events 수신 PASS, 운영 Purchase/ROAS 변화 0.
- 승인: Red.

### Sprint D. staged ON

- 무엇: CompleteRegistration 또는 Scroll50 중 하나만 소량 운영 전송한다.
- 왜: 실질 ROAS 개선 효과를 보려면 controlled rollout이 필요하다.
- 어떻게: event별 ON/OFF flag, rollback flag, 3~7일 전후 비교.
- 성공 기준: CPA 또는 Ads attributed purchase 품질 개선, Purchase 오염 0.
- 승인: Red.

## 현재 판단

추천 순서:

1. AddPaymentInfo와 함께 VM Cloud no-send 중간 이벤트 저장 route를 먼저 만든다.
2. CompleteRegistration은 source가 이미 있어 첫 후보로 적합하다.
3. Scroll50은 너무 넓은 신호라 바로 Meta CAPI로 보내지 말고 내부 관찰부터 시작한다.
4. GTM Production publish는 마지막까지 보류한다.

추천 점수:

- CompleteRegistration no-send route: 88%
- Scroll50 no-send route: 72%
- CompleteRegistration Meta Test Events smoke: 66%
- Scroll50 운영 CAPI ON: 35%
