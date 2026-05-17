# GTM Preview 전용 체크리스트

작성 시각: 2026-05-17 20:20 KST
기준일: 2026-05-17
문서 성격: GTM Preview-only runbook

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  lane: Yellow for actual Preview, Green for this checklist
  allowed_actions:
    - documentation_update
    - preview_plan
  forbidden_actions:
    - gtm_submit_create_version_publish
    - ga4_measurement_protocol_send
    - platform_send_or_upload
    - operating_db_write
    - vm_cloud_deploy
source_window_freshness_confidence:
  source: GTM API live version + GA4 BigQuery aggregate inventory
  window: Preview checklist only, no runtime firing yet
  freshness: generated 2026-05-17 20:20 KST
  confidence: high for guardrails, medium for runtime causes until Preview evidence
```

## 10초 요약

- Preview는 사이트 코드를 바꾸기 전, 실제 화면에서 어떤 태그가 발화되는지만 보는 검사다.
- 이 문서는 바이오컴과 더클린커피 모두에 적용한다.
- Submit, Create version, Publish는 이 문서 범위 밖이다.
- 성공 기준은 “태그가 있다”가 아니라 “실제 고객 흐름에서 원하는 이벤트가 Fired되고, 원하지 않는 purchase가 Fired되지 않는다”이다.

## 공통 금지선

| 금지 | 이유 |
| --- | --- |
| GTM Submit/Create version/Publish | 운영 tracking 변경 |
| GA4 Measurement Protocol send | GA4 전환값 오염 |
| Meta/Google/TikTok/Naver 전환 전송 | 광고 학습/ROAS 오염 |
| 실제 결제 테스트 | 비용/주문/고객 영향. 별도 Red 승인 필요 |
| 운영DB write/import | 개발팀 관리 원장 오염 |

## Preview 시작 전

1. GTM에서 대상 컨테이너를 정확히 고른다.
   - 바이오컴: `GTM-W2Z6PHN`
   - 더클린커피: `GTM-5M33GC4`
2. Workspace가 live 최신 기준인지 확인한다.
3. Preview 버튼을 누른 뒤 시작 URL을 넣는다.
4. Tag Assistant가 연결되면 왼쪽 이벤트 타임라인을 열어 둔다.
5. Network 탭은 보조 증거로만 본다. 최종 판단은 Tag Assistant Fired/Not Fired와 GA4 DebugView/BigQuery 후속 확인을 같이 본다.

## 바이오컴 체크 흐름

### 바이오컴 Preview에서 확인할 흐름

1. 홈/상품 상세 진입
   - 무엇을 본다: `PageView`, `view_item`, `page_view_long` 후보.
   - 성공 기준: Tag Assistant에서 해당 GA4 태그가 Fired로 보이고, Network에는 GA4 collect만 뜬다.
   - 실패 시: Google tag config와 HURDLERS 상세페이지 dataLayer 태그 발화 순서를 확인한다.

2. 장바구니 담기
   - 무엇을 본다: `add_to_cart`, `view_cart`.
   - 성공 기준: HURDLERS 장바구니 dataLayer 태그와 GA4 이벤트 전송 태그가 같은 이벤트 체인에서 Fired.
   - 실패 시: 클릭 셀렉터 또는 장바구니 페이지 URL 트리거가 실제 DOM과 맞는지 확인한다.

3. 결제 시작/결제수단 선택
   - 무엇을 본다: `begin_checkout`, `add_payment_info`.
   - 성공 기준: 결제 페이지 진입과 결제수단 선택이 purchase가 아니라 중간 이벤트로만 보인다.
   - 실패 시: NPay 클릭/카드 선택/가상계좌 선택이 서로 다른 이벤트로 분리되는지 확인한다.

4. 구매완료
   - 무엇을 본다: `purchase`는 실제 결제완료 검증이 있을 때만 확인한다.
   - 성공 기준: 테스트 없는 운영 구매 강제 발화 0, 중복 purchase 0.
   - 실패 시: Header Guard/Server CAPI 쪽과 분리해 본다.

## 더클린커피 체크 흐름

### 더클린커피 Preview에서 확인할 흐름

1. 상품 상세 진입
   - 무엇을 본다: `view_item`, `page_view_long`.
   - 성공 기준: HURDLERS 상세페이지 조회 태그와 GA4 이벤트 전송 태그가 Fired.
   - 실패 시: HURDLERS 플러그인 초기화 태그와 상세페이지 DOM 조건을 확인한다.

2. 장바구니 담기
   - 무엇을 본다: `add_to_cart`.
   - 성공 기준: `HURDLERS - [데이터레이어] 장바구니 담기`가 먼저 Fired되고, 이어서 GA4 `add_to_cart`가 Fired.
   - 실패 시: 장바구니 클릭 트리거가 실제 버튼과 맞는지 확인한다.

3. 쿠폰받기
   - 무엇을 본다: 쿠폰 전용 GTM/GA4 태그가 현재 있는지.
   - 성공 기준: 현재는 태그 없음으로 기록한다. Meta Pixel Helper의 `SubscribedButtonClick`은 자동 감지 참고값으로만 본다.
   - 실패 시: 쿠폰을 선행지표로 쓸지 결정한 뒤 `coupon_download` 또는 `coupon_click` 후보로 별도 설계한다.

4. 장바구니 페이지 진입
   - 무엇을 본다: `view_cart`가 현재 있는지.
   - 성공 기준: 있으면 Fired, 없으면 “태그 없음/설계 필요”로 기록한다.
   - 실패 시: 새 태그를 바로 만들지 말고 기존 HURDLERS 장바구니 태그와 중복 위험을 먼저 문서화한다.

5. 주문서 작성/결제 시작
   - 무엇을 본다: `begin_checkout`.
   - 성공 기준: GTM 설정상 존재하는 `HURDLES - [이벤트전송] 주문서작성`이 실제 주문서 화면에서 Fired.
   - 실패 시: 현재 BigQuery export 기간 0과 일치하므로 DOM/트리거 조건 문제로 분류한다.

6. 결제수단 선택/NPay 클릭
   - 무엇을 본다: `add_payment_info` 또는 NPay intent.
   - 성공 기준: NPay 클릭이 `purchase`가 아니라 결제수단/의도 이벤트로 분리된다.
   - 실패 시: 현재 `ga4_purchase` dataLayer는 실제 결제완료로 쓰지 않고 재설계 후보로 둔다.

7. 구매완료
   - 무엇을 본다: `purchase`는 실제 완료 URL에서만 발화되는지.
   - 성공 기준: 장바구니/NPay 클릭/주문서 진입에서는 purchase가 Fired되지 않는다.
   - 실패 시: 즉시 publish 금지, 원인만 기록한다.

## 결과 기록 양식

| site | 화면/행동 | 기대 이벤트 | Fired 태그 | Not Fired 태그 | 원하지 않는 purchase | 판정 | 다음 확인 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| biocom | 상품 상세 진입 | view_item |  |  | 0 |  |  |
| biocom | 장바구니 담기 | add_to_cart |  |  | 0 |  |  |
| thecleancoffee | 주문서 작성 | begin_checkout |  |  | 0 |  |  |
| thecleancoffee | NPay 클릭 | add_payment_info 또는 intent |  |  | 0 |  |  |

## 실패 해석

1. 태그가 있는데 Fired가 안 되면 GTM 설정 문제가 아니라 트리거/DOM/dataLayer 조건 문제일 가능성이 높다.
2. GA4 BigQuery에 0이면 Preview에서 한 번 Fired되는지부터 본다.
3. NPay 클릭에서 purchase가 Fired되면 즉시 publish 금지 상태로 원인만 기록한다.
4. purchase가 정상 완료 URL에서만 Fired되면 다음은 결제완료 원장과 중복/금액 guard를 확인한다.
