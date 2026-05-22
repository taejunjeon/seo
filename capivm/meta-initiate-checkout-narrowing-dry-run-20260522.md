작성 시각: 2026-05-22 00:20 KST
기준일: 2026-05-22
문서 성격: Meta InitiateCheckout 후보 좁히기 dry-run 결과보고

```yaml
harness_preflight:
  common_harness_read: true
  project_harness_read: false
  required_context_docs:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
    - docurule.md
  lane: Green
  allowed_actions:
    - read-only VM Cloud SQLite aggregate query
    - read-only funnel-health API query
    - no-send dry-run
    - local markdown/json report
  forbidden_actions:
    - Meta CAPI send
    - GTM publish
    - VM deploy/restart
    - operating DB write
    - raw identifier output
  source_window_freshness_confidence:
    source: VM Cloud SQLite attribution_ledger + funnel-health API + Meta Events Manager screenshot reference
    window: biocom rolling 7d and 2026-05-13~2026-05-19 KST screenshot window
    freshness: 2026-05-22 00:11 KST
    confidence: high for VM aggregate / medium for Meta UI comparison
```

## 10초 요약

이번 dry-run의 결론은 `Meta 숫자에 VM 숫자를 억지로 맞추는 것`이 아니라, VM 후보가 왜 넓게 잡히는지 원인을 분리해야 한다는 것이다.

현재 VM Cloud의 `payment_started` 4,209~4,214건은 Meta의 `InitiateCheckout` 439건과 같은 종류의 숫자가 아니다. VM 숫자는 결제 페이지에 들어오고, 머물고, 나가는 내부 관측 row까지 포함한 넓은 기록이다. Meta CAPI 후보로 좁히려면 `광고 클릭 근거가 있는 결제 시작`, `같은 주문 흐름 1회`, `exit 제외` 기준을 써야 한다.

## 이번에 가능해진 것

- VM Cloud에서 결제 시작 후보가 왜 크게 보이는지 6개 원인으로 분해했다.
- Meta UI의 InitiateCheckout 439건과 직접 비교할 때, VM raw row 3,439건이 아니라 `광고 클릭 근거 + dedupe` 후보 390건을 비교해야 한다는 기준을 만들었다.
- `payment_page_seen`은 내부 퍼널 진단에는 유용하지만, 그대로 Meta CAPI InitiateCheckout 후보로 쓰면 넓다는 점을 확인했다.
- `fbp`만 있는 row는 Meta 광고 클릭 근거로 보기 어렵기 때문에 강한 Meta 증거에서 제외해야 한다는 기준을 정했다.

## 숫자 기준

### 현재 화면의 넓은 결제 시작 값

source: VM Cloud funnel-health API
window: rolling 7d
freshness: 2026-05-22 00:07 KST
confidence: high

| 지표 | 값 | 쉬운 설명 |
|---|---:|---|
| 유입 | 11,959 | VM Cloud에 landing으로 남은 방문 흔적 |
| 장바구니 | 55 | VM Cloud가 장바구니 단계로 분류한 row |
| 결제 시작 | 4,209 | checkout_started + payment_page_seen을 합친 넓은 내부 신호 |
| 결제수단 선택 | 0 | 현재 VM 원장 기준 직접 분리되지 않음 |
| 실제 결제완료 | 379 | 내부 confirmed purchase 기준 |
| Meta CAPI 성공 | 371 | 서버에서 Meta로 Purchase 전송 성공 |
| Browser Purchase | 0 | 브라우저 Purchase는 현재 핵심 경로가 아님 |

### VM raw 후보를 원인별로 좁힌 결과

source: VM Cloud SQLite `attribution_ledger` read-only aggregate
window: latest rolling 7d
freshness: 2026-05-22 00:11 KST
confidence: high

| 단계 | row | 주문 흐름 1회 기준 | 의미 |
|---|---:|---:|---|
| raw payment_started | 4,214 | 885 | 현재 넓은 후보. 같은 흐름이 여러 줄 들어간다. |
| exit row 제외 | 2,271 | 817 | 결제 페이지를 떠나는 row를 뺀 값이다. |
| checkout_started만 | 1,375 | 792 | checkout_started touchpoint만 본 값이다. |
| payment_page_seen enter만 | 916 | 803 | 결제 페이지 진입만 본 값이다. |
| checkout_started 또는 enter | 2,291 | 817 | 가장 기본적인 내부 결제 시작 후보이다. |
| 주문 키 있는 것만 | 1,657 | 817 | 주문 흐름으로 묶을 수 있는 후보이다. |
| /shop_payment/ 근거 있는 것만 | 1,847 | 817 | 실제 결제 페이지 근거가 있는 후보이다. |
| 주문 흐름당 1회 | 817 | 817 | 내부 결제 시작 후보를 1회로 정리한 값이다. |
| VM에 잡힌 browser InitiateCheckout | 0 | 0 | VM metadata에는 실제 browser eventName이 저장되지 않았다. |

## Meta UI 기간과 비교

Meta Events Manager screenshot 기준 기간: 2026-05-13~2026-05-19 KST
Meta UI reference confidence: medium

| 항목 | Meta UI | VM raw | VM 좁힌 후보 |
|---|---:|---:|---:|
| InitiateCheckout | 439 | 3,439 row | 390 strong Meta 주문 흐름 |
| AddToCart | 299 | 별도 단계 | 이번 dry-run 범위 밖 |
| Purchase | 128 | 별도 단계 | 이번 dry-run 범위 밖 |
| AddPaymentInfo | 26 | 별도 단계 | 이번 dry-run 범위 밖 |

여기서 중요한 점은 `390`을 Meta `439`에 맞추겠다는 뜻이 아니다. `390`은 아래 조건을 적용했을 때 나온 후보이다.

1. Meta 광고 클릭 근거가 있다.
2. 결제 시작 또는 결제 페이지 진입 신호다.
3. `/shop_payment/` 계열 결제 페이지 근거가 있다.
4. 같은 주문 흐름은 1번만 센다.
5. 결제 페이지를 떠나는 exit row는 후보에서 뺀다.

따라서 앞으로 비교해야 할 값은 `VM raw 3,439`가 아니라 `원인별로 좁힌 VM 후보 390`이다.

## 왜 차이가 났는가

### 1. 세는 단위가 다르다

VM Cloud의 raw row는 `기록 장부의 한 줄`이다. 한 사람이 결제 페이지에 들어오고, 머물고, 나가면 여러 줄이 생길 수 있다.

Meta UI의 InitiateCheckout은 Meta가 받은 이벤트 수다. 같은 주문 흐름을 내부에서 여러 줄로 보는 VM raw row와 바로 비교하면 안 된다.

### 2. 같은 흐름이 반복 저장된다

rolling 7d에서 같은 safe key가 2줄 이상 있는 흐름이 1,286개였다. 3줄 이상인 흐름도 617개였다.

즉 raw 4,214건은 “4,214명이 결제를 시작했다”가 아니라 “결제 관련 흔적이 4,214줄 남았다”에 가깝다.

### 3. exit row가 후보를 부풀린다

rolling 7d 기준 exit row는 1,939건이다. screenshot window에서도 exit row가 1,458건이다.

exit는 결제 시작이 아니라 결제 페이지에서 이탈하거나 숨겨지는 시점의 진단 row다. Meta CAPI InitiateCheckout 후보에서는 제외하는 것이 맞다.

### 4. payment_page_seen은 좋은 내부 신호지만 넓다

`payment_page_seen`은 결제 페이지에 도달했다는 내부 진단에는 좋다. 하지만 Meta 표준 이벤트인 InitiateCheckout으로 보내려면 너무 넓을 수 있다.

따라서 화면에서는 `결제 페이지 도달`로 보여주고, CAPI 후보에서는 `enter + 주문 흐름 dedupe + Meta 광고 근거`를 요구해야 한다.

### 5. VM 원장에는 browser InitiateCheckout eventName이 없다

VM metadata에서 `eventName=InitiateCheckout`으로 직접 잡힌 row는 0건이었다.

즉 Meta UI에는 InitiateCheckout이 보이지만, VM Cloud 원장 안에서는 “이 row가 실제 브라우저 InitiateCheckout 발화였다”를 직접 구분하지 못한다. 이건 향후 data contract 보강 대상이다.

### 6. fbp만으로 Meta 광고 유입이라고 보면 너무 넓어진다

screenshot window에서 `strong Meta evidence`만 쓰면 좁힌 후보는 390개다. 그런데 fbp까지 Meta evidence로 넣으면 829개까지 늘어난다.

fbp는 브라우저 식별자라 “Meta 광고 클릭으로 들어왔다”는 강한 근거가 아니다. 광고 유입 후보에는 fbclid, fbc, Meta/Facebook/Instagram UTM처럼 더 강한 근거를 우선해야 한다.

## 권장 기준

### A. 내부 퍼널 화면용 지표

표시 이름: `결제 페이지 도달`

규칙:

- checkout_started 또는 payment_page_seen enter를 본다.
- 같은 주문/결제 흐름은 1회로 묶는다.
- exit row는 별도 진단으로 분리한다.

이 지표는 운영자가 “어디서 이탈하는지” 보는 데 쓴다. Meta로 바로 보내는 후보가 아니다.

### B. Meta CAPI InitiateCheckout dry-run 후보

표시 이름: `Meta 광고 근거가 있는 결제 시작 후보`

규칙:

- fbclid/fbc/Meta UTM 등 strong Meta evidence가 있다.
- checkout_started 또는 payment_page_seen enter다.
- `/shop_payment/` 결제 페이지 근거가 있다.
- 주문 흐름이 식별된다.
- 같은 주문 흐름은 1회만 센다.
- payment_page_seen exit는 제외한다.
- fbp만 있는 row는 제외한다.

screenshot window 기준 이 조건의 결과는 390 unique order-flow다. Meta UI InitiateCheckout 439와 같은 규모지만, 이 값은 Meta와 맞추기 위한 숫자가 아니라 `원인 분해 후 안전하게 좁힌 후보`다.

### C. 아직 보내면 안 되는 것

아래는 아직 Meta CAPI InitiateCheckout으로 보내면 안 된다.

- payment_page_seen exit
- fbp만 있는 row
- 주문 흐름 식별이 안 되는 row
- completion URL row
- 같은 주문 흐름의 중복 row

## 다음 액션 제안

### 1. 화면 용어를 분리한다

`결제 시작` 하나로 묶지 말고 아래처럼 분리한다.

- `결제 페이지 도달`: VM 내부 진단 지표
- `Meta InitiateCheckout 수신`: Meta가 실제 받은 이벤트
- `Meta CAPI 후보`: 서버 전송을 검토할 좁힌 후보

왜: 지금처럼 하나의 “결제 시작” 숫자에 모든 source를 섞으면, 4,209와 439가 충돌하는 것처럼 보인다.

### 2. VM 원장에 browser eventName 저장 여부를 보강한다

현재 VM ledger에는 `metadata.eventName=InitiateCheckout`이 0이다.

왜: Meta UI에 InitiateCheckout이 보일 때, VM의 어떤 row와 연결되는지 직접 확인할 수 없다.

어떻게: Block 4 또는 backend 수신 payload에 browser event name, event_id, fallback/native 여부를 safe metadata로 저장한다. 단, 이 작업은 코드 변경과 배포가 필요하므로 별도 승인 범위로 분리한다.

### 3. CAPI 전송은 바로 하지 않는다

이번 dry-run은 후보를 좁히는 작업이다. Meta CAPI InitiateCheckout 전송은 아직 하지 않았다.

전송 전 필요한 조건:

- Test Events smoke
- event_id dedupe 설계
- Purchase나 AddPaymentInfo에 영향 없음 확인
- 24시간 no-send preview
- TJ님 승인

## 하지 않은 것

- Meta CAPI send 0
- GTM publish 0
- VM Cloud deploy/restart 0
- 운영DB write 0
- raw identifier output 0

## 확인하면 좋은 산출물

- `data/project/meta-initiate-checkout-narrowing-dry-run-20260522.json`
  - 왜 봐야 하는지: 이번 보고서의 숫자를 재현 가능한 JSON으로 남긴 파일이다.
