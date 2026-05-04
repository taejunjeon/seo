# Meta 표준 퍼널 CAPI Test Events Smoke 준비안

작성 시각: 2026-05-05 01:55 KST
대상: biocom Meta Pixel/Dataset `1283400029487161`
문서 성격: Test Events smoke 계획. 실제 전송은 별도 승인 전까지 하지 않는다.
관련 문서: [[capivm/!capiplan]], [[capivm/capi]], [[capivm/capi4reply]], [[data/!datacheckplan]], [[GA4/gtm-engagement-internal-analysis-design-20260504]], [[docurule]]
Lane: Green documentation only
Mode: No-send / No-write / No-deploy / No-platform-send

```yaml
harness_preflight:
  source_window_freshness_confidence:
    capi_plan:
      source: "capivm/!capiplan.md"
      confidence: 0.88
    env_test_code:
      source: "user reported backend .env line 161 contains Meta Test Events code"
      confidence: 0.80
    implementation_state:
      source: "existing capivm docs and local scripts"
      confidence: 0.84
  allowed_actions:
    - payload design
    - smoke checklist
    - approval gate documentation
  forbidden_actions:
    - Meta Test Events actual send
    - Imweb footer/header edit
    - GTM Preview
    - GTM Production publish
    - backend deploy
    - live CAPI operation send
```

## 10초 결론

대상 이벤트는 `ViewContent`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo` 네 가지다.
이번 문서는 실제 전송이 아니라, Meta Test Events에서 무엇을 확인할지 payload와 체크리스트를 고정하는 작업이다.

성공 기준은 Browser 이벤트와 Server CAPI 이벤트가 같은 `event_id`로 Meta Test Events 탭에 보이고, dedup/diagnostics 문제가 없는 것이다.
실제 Test Events code를 넣고 서버 이벤트를 보내는 순간부터는 외부 플랫폼 전송이므로 TJ님 별도 승인 없이는 실행하지 않는다.

## 쉬운 설명

브라우저 Pixel과 서버 CAPI가 같은 행동을 각각 한 번씩 말하면 Meta는 둘을 하나로 합쳐야 한다.
그때 같은 행동임을 알려주는 번호가 `event_id`다.
이번 smoke는 "번호가 같은지"와 "Meta가 중복으로 오해하지 않는지"를 보는 테스트다.

## 범위

### 포함

- `ViewContent`: 상품 상세 조회
- `AddToCart`: 장바구니 담기
- `InitiateCheckout`: 주문서/결제 흐름 시작
- `AddPaymentInfo`: 결제정보 단계 진입
- Meta Test Events 탭에서 Browser/Server event_id 매칭 확인
- payload 필드와 실패 기준 문서화

### 제외

- `Purchase` 운영 변경
- Refund 전송
- 체류시간/스크롤 custom event 전송
- 운영 CAPI ON
- GTM Production publish
- 아임웹 footer live 교체

## Smoke payload 기준

공통 payload는 아래 필드를 가져야 한다.

```json
{
  "event_name": "ViewContent",
  "event_time": 1777913700,
  "event_id": "biocom:ViewContent:session_or_order:product:nonce",
  "action_source": "website",
  "event_source_url": "https://biocom.kr/DietMealBox/?idx=423",
  "test_event_code": "TEST...",
  "user_data": {
    "client_ip_address": "server_detected",
    "client_user_agent": "browser_user_agent",
    "fbp": "fb.1....",
    "fbc": "fb.1...."
  },
  "custom_data": {
    "content_ids": ["423"],
    "content_type": "product",
    "contents": [{"id": "423", "quantity": 1}],
    "currency": "KRW",
    "value": 0
  }
}
```

필드 원칙:

- `test_event_code`는 smoke에서 필수다.
- `event_id`는 Browser Pixel과 Server CAPI가 같아야 한다.
- `event_source_url`은 실제 테스트 페이지 URL이어야 한다.
- `_fbp`, `_fbc`가 있으면 user_data에 넣는다.
- 이메일, 전화번호, external_id는 해시 처리 규칙이 확정된 경우에만 넣는다.
- 건강 상태를 직접 추정하는 민감 custom_data는 넣지 않는다.
- `Purchase`가 아닌 이벤트의 `value`는 최적화 신호로 오해되지 않도록 보수적으로 둔다.

## 이벤트별 확인 포인트

### ViewContent

- 상품 상세 URL 3~5개에서 발화한다.
- `content_ids`가 실제 상품 `idx` 또는 상품 ID와 맞아야 한다.
- Meta Test Events에서 Browser와 Server가 같은 `event_id`로 보인다.

### AddToCart

- 장바구니 담기 버튼 클릭에서 발화한다.
- `contents[].id`, quantity가 비어 있으면 실패로 본다.
- 같은 클릭에서 Browser/Server가 중복으로 두 번 이상 잡히면 실패로 본다.

### InitiateCheckout

- 주문서 또는 결제 흐름 시작 시점에서 발화한다.
- PG/NPay 리다이렉션 전 URL을 남겨야 한다.
- `fbclid`, `_fbc`, UTM이 결제 단계에서 유실되는지 확인한다.

### AddPaymentInfo

- 결제수단 선택 또는 결제정보 입력 단계에서 발화한다.
- 과거 증상처럼 wrapper 설치 전 aimweb이 먼저 발화하면 event_id가 빠질 수 있다.
- Console에서 `window.fbq.__FUNNEL_CAPI_V3_WRAPPED__ === true`인지 먼저 확인한다.

## 성공 기준

- Test Events 탭에서 네 이벤트가 각각 Browser와 Server로 보인다.
- 같은 사용자 행동의 Browser/Server `event_id`가 같다.
- Diagnostics에 duplicate, missing event_id, invalid custom_data 경고가 없다.
- `Purchase`가 의도치 않게 발화하지 않는다.
- 운영 이벤트 카운트나 광고 최적화 신호에 섞이지 않는다.
- backend 로그가 있다면 `send_path=test_event` 또는 동등한 test-only 표시가 남는다.

## 실패 기준

- Server 이벤트만 보이고 Browser가 없다.
- Browser 이벤트만 보이고 Server가 없다.
- `event_id`가 서로 다르다.
- `test_event_code` 없이 외부 전송된다.
- `Purchase`가 테스트 중 예상치 않게 발화한다.
- `AddPaymentInfo`가 wrapper 설치 전 먼저 발화한다.
- Event Match Quality가 지나치게 낮고 `_fbp`, `_fbc`, user agent가 누락된다.

## 승인 게이트

아래 작업은 이 문서 작성 범위 밖이다.
실행하려면 TJ님이 별도로 `YES`를 줘야 한다.

- Meta Test Events code를 실제 실행 환경에 연결
- test-only 서버 CAPI 전송
- 아임웹 footer/stage 적용
- GTM Preview 실행
- GTM workspace 저장
- GTM Production publish
- backend receiver 배포
- 운영 CAPI ON

## 하지 않은 일

- Meta로 이벤트를 보내지 않았다.
- 아임웹 footer를 만들거나 적용하지 않았다.
- GTM Preview/Publish를 하지 않았다.
- backend deploy를 하지 않았다.

## 다음 할일

1. Codex: Test Events 실행 승인안을 별도 문서로 만든다. 왜: 실제 외부 플랫폼 전송 전에는 체크리스트와 롤백 기준이 필요하다. 어떻게: 테스트 URL 3~5개, 사용할 footer/stage 파일명, 백업/원복, 금지선, 캡처 항목을 적는다. 성공 기준: TJ님이 그대로 따라 할 수 있다. 컨펌 필요: NO, 실행은 YES.
2. TJ: Test Events smoke 실행 여부를 승인한다. 왜: Meta 외부 플랫폼으로 이벤트가 실제 전송되기 때문이다. 어떻게: 승인 문구에 `test_event_code 필수`, `운영 ON 금지`, `테스트 후 원복`을 포함한다. 성공 기준: Test Events 탭 캡처가 남고 운영 이벤트 오염이 없다. 컨펌 필요: YES.
3. Codex: 승인 후 결과를 `capivm/!capiplan`에 반영한다. 왜: Purchase 중심에서 표준 퍼널까지 어디까지 닫혔는지 정본을 갱신해야 한다. 어떻게: 이벤트별 pass/fail, event_id, diagnostics, EMQ를 기록한다. 성공 기준: 운영 ON 여부를 판단할 수 있다. 컨펌 필요: 결과 기록은 NO.
