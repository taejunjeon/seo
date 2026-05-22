# 더클린커피 Meta SubscribedButtonClick 자동 감지 감사

작성 시각: 2026-05-22 12:01 KST
기준일: 2026-05-22
문서 성격: 더클린커피 Meta 자동 감지 이벤트 오탐 후보 감사 메모
Lane: Green read-only observation / no-send / no-write

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/RULES.md
  required_context_docs:
    - project/coffee-imweb-live-smoke-result-20260522.md
    - project/coffee-meta-middle-funnel-browser-fallback-nosend-snippet-20260522.md
  lane: Green
  allowed_actions:
    - pixel_helper_read_only_observation
    - auto_detect_event_classification
    - no_send_design_note
  forbidden_actions:
    - Meta Events Manager setting change
    - Meta browser event send/change
    - Meta CAPI enable
    - Imweb save/publish
    - GTM Production publish
    - production DB or VM Cloud SQLite write
source_window_freshness_confidence:
    source: TJ님 Chrome Pixel Helper screenshots + manual click observation + live HTML read-only + Meta fbevents.js read-only
    window: 2026-05-22 11:58-12:01 KST
    freshness: same-session live observation
    confidence: 0.93
```

## 10초 요약

`SubscribedButtonClick`은 현재 정기구독 신청 버튼만 의미하는 신호로 보기 어렵다.

TJ님 관측상 일반 상품상세의 필수 옵션 드롭다운을 누를 때마다 `SubscribedButtonClick`이 1건씩 생긴다. 정기구독 상품은 `/subscription` 및 `/subscription/?idx=74`에 따로 있고, 그 페이지의 `정기구독 신청` 버튼은 옵션 선택 드롭다운과 다른 행동이다.

따라서 현재 `SubscribedButtonClick`은 Meta 자동 감지 이벤트 오탐/노이즈 후보로 분류한다. TJ님 승인에 따라 보고서, ROAS, funnel, 구독 신청 판단에서 제외한다.

구독 intent는 `SubscribedButtonClick` 대신 `/subscription`의 실제 정기구독 신청 버튼 조건만 별도 no-send preview로 분리한다. 설계와 fixture 결과는 `project/coffee-subscribe-intent-nosend-design-20260522.md`에 남겼다.

## Source 판정

현재 판정은 `Meta Pixel 내부 자동 감지`다.

근거는 네 가지다.

1. Coffee 라이브 HTML에서 `SubscribedButtonClick`, `fbq('track', 'Subscribed...')`, `trackCustom('Subscribed...')`, `autoConfig` 직접 설정 문자열이 잡히지 않았다.
2. 라이브 HTML의 명시 Meta base code는 `fbq('init', '1186437633687388', ..., {'agent':'plimweb'})`와 `fbq('track', 'PageView')`다.
3. 우리 footer Phase9 wrapper는 `ViewContent`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo` 기존 `fbq('track')` 호출에 eventID를 보강하는 구조다. `SubscribedButtonClick`을 생성하는 코드가 없다.
4. Meta가 로드하는 `https://connect.facebook.net/en_US/fbevents.js` 안에는 `SubscribedButtonClick`, `button_click_optimize_experiment_v2`, `signalsFBEventsExtractButtonFeatures` 등 버튼 자동 감지 관련 문자열이 존재한다.

보조 근거도 있다. TJ님이 설치한 `fbq` audit wrapper에는 상품상세 CTA 클릭 시 `InitiateCheckout` 1건만 잡혔다. Pixel Helper에는 별도로 `SubscribedButtonClick`이 보인다. 이 차이는 `SubscribedButtonClick`이 외부 페이지 코드의 노출된 `window.fbq('track')` 호출이 아니라, Meta Pixel 내부에서 자동으로 만든 이벤트라는 해석과 맞다.

따라서 `GTM에서 온 이벤트` 또는 `우리가 새로 설정한 이벤트`로 보지 않는다.

## 관측

### 일반 상품상세

- 페이지: `/thecleancoffee/?idx=75`
- UI 행동: `방탄커피 (필수)` 옵션 드롭다운 클릭
- Pixel Helper: `SubscribedButtonClick`이 클릭 1회당 1건씩 추가 관측됨
- 해석: 정기구독 신청이 아니라 상품 옵션 선택 행동이다.

### 정기구독 상품

- 목록/메뉴: `/subscription`
- 세부 상품: `/subscription/?idx=74`
- UI 행동: `중량`, `분쇄도` 옵션 선택과 `정기구독 신청` 버튼은 서로 다르다.
- 해석: 구독 CTA로 인정할 후보는 `정기구독 신청` 버튼 클릭이지, 옵션 드롭다운 클릭이 아니다.
- 추가 관측: 옵션 드롭다운 선택 시 각각 1건, `정기구독 신청` 버튼 클릭 시 1건이 추가되어 총 3건의 `SubscribedButtonClick`이 보인다. 그 뒤 `InitiateCheckout`이 별도로 발생한다.

## 현재 판정

`SubscribedButtonClick`은 현재 이름만 보면 구독 의도가 있어 보이지만, 실제 관측 기준으로는 옵션 드롭다운에서도 발생한다.

따라서 아래처럼 분리한다.

1. 일반 상품 옵션 드롭다운에서 발생한 `SubscribedButtonClick`: 오탐/노이즈 후보
2. `/subscription` 또는 `/subscription/?idx=*`의 옵션 드롭다운에서 발생한 `SubscribedButtonClick`: 오탐/노이즈 후보
3. `/subscription` 또는 `/subscription/?idx=*`의 `정기구독 신청` 버튼 클릭에서 발생한 `SubscribedButtonClick`: 버튼 클릭 참고값은 될 수 있으나, 옵션 클릭과 같은 이벤트명이라 구독 intent primary로 쓰기 어렵다
4. 자동 감지 이벤트 전체: Meta Events Manager 설정을 바꾸기 전까지 참고값
5. 보고서/ROAS/구독 intent 판정: 제외 승인 완료. primary 또는 secondary 성과 신호로 쓰지 않는다.

## 다음 검증 계획

1. 일반 상품상세에서 옵션 드롭다운 3회 클릭 후 `SubscribedButtonClick` count가 3건 증가하는지 확인한다.
2. 일반 상품상세에서 `구매하기` CTA 클릭 시 `InitiateCheckout` 1건과 `SubscribedButtonClick` 추가 발생 여부를 분리한다.
3. `/subscription/?idx=74`에서 옵션 선택과 `정기구독 신청` 버튼 클릭을 분리해 `SubscribedButtonClick` 발생 조건을 비교한다. 2026-05-22 관측상 옵션 2회 + 신청 버튼 1회 = 총 3건.
4. Meta Events Manager에서 자동 감지 이벤트를 끄거나 규칙을 조정하는 것은 별도 Red/Yellow 승인 전 하지 않는다.

## 운영 판단

현재 상태에서는 `SubscribedButtonClick`을 구독 성과나 결제 전환의 근거로 쓰지 않는다. 이 제외 기준은 TJ님이 승인했다.

구독 의도는 아래 중 1번을 먼저 진행한다.

1. `SubscribeIntentPreview` 같은 내부 no-send preview
2. `/subscription` 경로 + `정기구독 신청` 버튼 클릭 조건의 실제 browser event
3. 서버 수신점 기반 구독 checkout intent

실제 Meta 이벤트 추가 전송은 Red Lane이다.

## 조정 선택지

지금 바로 설정을 바꾸지는 않는다.

가능한 선택지는 세 가지다.

1. 유지: `SubscribedButtonClick`을 참고 제외 이벤트로 두고 아무 설정도 바꾸지 않는다.
2. 내부 no-send 보강: `/subscription/?idx=*`의 실제 `정기구독 신청` 버튼만 `SubscribeIntentPreview`로 관측한다.
3. Meta 자동 감지 off 검토: `fbq('set', 'autoConfig', false, pixelId)` 또는 Events Manager 자동 이벤트 설정 조정 후보. 단, 이건 Meta 자동 수집 전체에 영향을 줄 수 있어 별도 승인안이 필요하다.

선택은 1번 유지 + 2번 no-send 설계다. 2번의 첫 구현 후보는 `scripts/coffee-subscribe-intent-nosend-snippet.js`이며, 로컬 fixture 9/9 PASS다. 3번은 당장 하지 않는다.
