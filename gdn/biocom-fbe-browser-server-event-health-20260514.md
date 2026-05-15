# Biocom FBE browser/server event health - 2026-05-14

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
  project_harness_read:
    - capivm/!capiplan.md
    - capivm/meta-funnel-capi-readiness-20260508.md
  required_context_docs:
    - capivm/biocom_imwebcode_최신.md
  lane: Green read-only validation
  allowed_actions:
    - Meta Graph API read-only pixel stats
    - VM Cloud meta-capi-sends.jsonl aggregate read
    - live biocom.kr HTML read-only check
    - documentation
  forbidden_actions:
    - Meta CAPI send/upload/mutate
    - campaign/budget/conversion action change
    - GTM publish
    - Imweb header/footer change
    - operational DB write/import
    - raw order/payment/click/member/email/phone output
  source_window_freshness_confidence:
    source: "Meta Graph pixel stats + VM Cloud meta-capi-sends.jsonl + live biocom.kr HTML"
    window: "2026-05-14 KST, plus 7-day cross-check"
    freshness: "2026-05-14 23:24 KST read-only"
    confidence: 0.86
```

## 판정

FBE/browser Pixel은 현재도 이벤트를 받고 있다. `ViewContent`, `AddToCart`, `InitiateCheckout`는 Meta Graph stats에서 확인됐다.

다만 `AddPaymentInfo`는 최근 7일에는 182건 있었지만, 2026-05-14 00:00~23:24 KST 기준으로는 0건이다. 결제정보 단계 이벤트가 오늘 실제로 안 뜬 것인지, 아임웹 FBE/화면 조건상 특정 결제 흐름에서만 뜨는지 추가 브라우저 테스트가 필요하다.

VM Cloud 서버 CAPI는 오늘 기준 `Purchase`만 송출됐다. `ViewContent`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo` 서버 mirror는 live 설정상 `enableServerCapi=false`라 운영 송출 중이 아니다.

## 확인 방법

- Meta Graph API read-only: Pixel `1283400029487161` stats 조회.
- VM Cloud: `/home/biocomkr_sns/seo/shared/backend-logs/meta-capi-sends.jsonl` aggregate read.
- Live HTML: `https://biocom.kr` footer config 확인.

원시 order id, payment key, click id, email, phone, member code는 출력하지 않았다.

## Meta browser/FBE stats

Meta Graph `/{pixel_id}/stats?aggregation=event` 기준이다. 이 값은 Meta가 받은 Pixel/FBE 이벤트 집계이며, 주문 정본이나 내부 매출 정본이 아니다.

### 2026-05-14 00:00~23:24 KST

| event | count | latest hourly bucket |
|---|---:|---|
| PageView | 11,085 | 2026-05-14 22:00 KST |
| ViewContent | 5,623 | 2026-05-14 22:00 KST |
| AddToCart | 23 | 2026-05-14 03:00 KST |
| InitiateCheckout | 45 | 2026-05-14 22:00 KST |
| AddPaymentInfo | 0 | 없음 |
| Purchase | 5 | 2026-05-14 01:00 KST |

해석:

- `ViewContent`는 현재 정상 수집으로 본다.
- `InitiateCheckout`도 현재 정상 수집으로 본다.
- `AddToCart`는 오늘 03시 이후 집계가 없어 볼륨은 낮지만, 이벤트 자체는 오늘 수집됐다.
- `AddPaymentInfo`는 오늘 0건이라 현재 정상 수집이라고 확정하지 않는다.
- `Purchase`는 오늘 Meta stats상 5건만 보인다. VM Cloud CAPI send 로그와 시간축이 다르므로 Events Manager 반영 지연 또는 event_time 기준 집계 차이를 감안해야 한다.

### 2026-05-07 00:00~2026-05-14 23:24 KST

| event | count | latest hourly bucket |
|---|---:|---|
| PageView | 97,554 | 2026-05-14 22:00 KST |
| ViewContent | 50,033 | 2026-05-14 22:00 KST |
| AddToCart | 1,451 | 2026-05-14 03:00 KST |
| InitiateCheckout | 2,893 | 2026-05-14 22:00 KST |
| AddPaymentInfo | 182 | 2026-05-13 23:00 KST |
| Purchase | 885 | 2026-05-14 01:00 KST |

해석:

- `AddPaymentInfo`는 과거에는 FBE/browser Pixel에 잡혔다.
- 오늘 0건은 "항상 미구현"이 아니라 "오늘 현재 결제정보 단계에서 발화하지 않았거나 집계가 지연/조건부"로 본다.

## Browser vs server source

Meta Graph `aggregation=event_source` 기준:

- 2026-05-14 00:00~23:24 KST: BROWSER 16,506 / SERVER 60
- 2026-05-07 00:00~2026-05-14 23:24 KST: BROWSER 147,617 / SERVER 3,934

이 API 응답은 event_source와 event_name의 cross-tab을 주지 않았다. 따라서 어떤 event가 browser/server 각각 몇 건인지는 VM Cloud 로그와 함께 해석했다.

## VM Cloud server CAPI evidence

VM Cloud `meta-capi-sends.jsonl`에서 Pixel `1283400029487161`만 aggregate했다.

### 전체 로그

- total: 2,713
- success: 2,713
- failure: 0
- event_name:
  - Purchase: 2,712
  - ViewContent: 1
- funnel server event total: 1 (`ViewContent` test_event 1건)

### 2026-05-14 00:00 KST 이후

- total: 30
- success: 30
- event_name:
  - Purchase: 30
- send_path:
  - auto_sync: 20
  - manual_api: 10

### 2026-05-14 02:00 KST 이후

- total: 25
- success: 25
- event_name:
  - Purchase: 25
- send_path:
  - auto_sync: 15
  - manual_api: 10

해석:

- VM Cloud 서버 CAPI는 현재 `Purchase` 중심으로 정상 송출 중이다.
- `ViewContent`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo` 서버 CAPI 운영 송출은 없다.
- 10건 `manual_api`는 승인된 A-grade Purchase backfill이다.

## Live Imweb footer status

`https://biocom.kr` HTML에서 다음 설정을 확인했다.

```js
window.FUNNEL_CAPI_CONFIG = {
  pixelId: '1283400029487161',
  endpoint: 'https://att.ainativeos.net/api/meta/capi/track',
  enableServerCapi: false,
  testEventCode: '',
  debug: true
};
```

또한 mirror 대상은 아래 4개로 설정되어 있다.

```js
ViewContent: true,
AddToCart: true,
InitiateCheckout: true,
AddPaymentInfo: true
```

해석:

- 아임웹/FBE browser 이벤트에는 eventID를 주입할 수 있는 wrapper가 설치돼 있다.
- 그러나 서버 CAPI mirror는 `enableServerCapi=false`라 VM Cloud `/api/meta/capi/track`으로 운영 송출하지 않는다.
- 따라서 "browser는 잡히는데 server는 안 잡히는" 상태는 현재 설계와 일치한다.

## 이벤트별 상태

| event | browser/FBE | VM Cloud server CAPI | 판정 |
|---|---|---|---|
| ViewContent | 오늘 5,623건 | 오늘 0건 | browser 정상, server mirror off |
| AddToCart | 오늘 23건, 03시 이후 없음 | 오늘 0건 | browser 수집 있음, server mirror off |
| InitiateCheckout | 오늘 45건 | 오늘 0건 | browser 정상, server mirror off |
| AddPaymentInfo | 오늘 0건, 최근 7일 182건 | 오늘 0건 | today gap, server mirror off |
| Purchase | Meta stats 오늘 5건, VM Cloud send 오늘 30건 | 오늘 30건 success | CAPI send 정상, Meta UI/stats 반영은 추가 대조 필요 |

## 결론

1. 아임웹 마케팅채널연동/FBE browser Pixel 자체는 살아 있다.
2. Purchase 외 `ViewContent`, `AddToCart`, `InitiateCheckout`는 현재 Meta 집계에 잡힌다.
3. `AddPaymentInfo`는 최근 7일에는 잡혔지만 오늘은 0건이라 별도 확인 대상이다.
4. Purchase 외 4개 이벤트의 server CAPI mirror는 현재 운영 ON이 아니다. live footer가 `enableServerCapi=false`이고, VM Cloud 서버 로그에도 오늘 0건이다.
5. 운영으로 server mirror를 켜려면 Test Events smoke에서 browser/server eventID dedup을 먼저 확인해야 한다.

## 다음 행동

### Codex가 할 일

1. `AddPaymentInfo` 발화 조건을 Green Lane으로 더 좁힌다.
   - 왜: 최근 7일에는 있었는데 오늘 0건이라 결제 흐름/결제수단/아임웹 FBE 조건 중 어디서 빠지는지 확인해야 한다.
   - 어떻게: live HTML과 기존 캡처/문서 기준으로 결제 페이지별 `ev=AddPaymentInfo` 조건을 정리한다. 실제 주문 또는 Meta 운영 이벤트를 만들지는 않는다.
   - 성공 기준: `AddPaymentInfo`가 어떤 화면/결제 단계에서 떠야 하는지 문서화.
   - 승인 필요 여부: 없음.
   - 추천 점수/자신감: 88%.

2. Meta Test Events smoke 승인안을 갱신한다.
   - 왜: server mirror를 켜기 전에 browser/server dedup을 테스트 이벤트 공간에서 확인해야 한다.
   - 어떻게: `test_event_code`가 있을 때만 `/api/meta/capi/track`으로 ViewContent/AddToCart/InitiateCheckout/AddPaymentInfo 각 1회 이하 전송하는 runbook을 최신화한다.
   - 성공 기준: 운영 카운트 증가 없이 Test Events 탭에서 eventID 일치 확인 가능.
   - 승인 필요 여부: Test Events 코드 발급 및 실행 승인 필요.
   - 추천 점수/자신감: 92%.

### TJ님이 할 일

1. Meta Events Manager UI에서 `AddPaymentInfo` 오늘 0건을 한 번만 대조한다.
   - 왜: Graph API 기준 0건이므로 UI도 같은지 확인하면 FBE 조건 문제인지 API 집계 지연인지 분리된다.
   - 어디서: Meta Events Manager -> Pixel `1283400029487161` -> 이벤트 개요 -> 날짜 `2026-05-14` -> `AddPaymentInfo`.
   - 성공 기준: UI에서도 0건이면 결제 흐름 발화 조건 조사로 진행. UI에는 보이면 Graph stats 집계 지연으로 분류.
   - Codex가 대신 못 하는 이유: Meta UI 로그인/2FA와 실제 화면 캡처 권한이 필요하다.
   - 추천 점수/자신감: 78%.
