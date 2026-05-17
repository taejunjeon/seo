작성 시각: 2026-05-17 13:02 KST
기준일: 2026-05-17
문서 성격: Phase2-Sprint5 중간 전환 CAPI no-send preview runbook

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
  required_context_docs:
    - capivm/!capiplan.md
    - data/!channelfunnel.md
  lane: Green
  allowed_actions:
    - VM Cloud aggregate API read-only check
    - no-send payload preview generation
    - runbook/document update
    - local JSON validation
  forbidden_actions:
    - Meta CAPI operating send
    - Meta Test Events smoke without explicit approval
    - Meta Purchase send/backfill
    - VM Cloud deploy/restart
    - GTM publish
    - Imweb header/footer edit
    - 운영DB write/import
    - raw identifier output
  source_window_freshness_confidence:
    source: VM Cloud funnel-health API
    window: 1d / 7d selectable
    freshness: response cache metadata
    confidence: medium_high for aggregate-ready events, medium for events whose source is not connected
```

## 10초 요약

이 runbook은 구매 전 행동을 Meta에 서버 신호로 보내기 전에, 어떤 이벤트가 안전하게 준비됐는지 미리 보는 장치다.
현재 `AddToCart`와 `InitiateCheckout`은 VM Cloud 집계 기준으로 preview 가능하다.
`AddPaymentInfo`는 source가 아직 약하고, `CompleteRegistration`과 `Scroll50`은 route/source 연결이 먼저 필요하다.
실제 Meta 전송은 하지 않았고, 모든 이벤트는 `send_allowed=false`로 남겼다.

## 무엇을 하는가

장바구니, 결제 시작, 결제수단 선택, 회원가입, 50% 스크롤을 각각 Purchase와 분리한다.
각 이벤트에 대해 아래를 JSON으로 남긴다.

- 현재 VM Cloud에서 몇 건을 볼 수 있는가.
- 서버 전송 route가 지금 지원하는가.
- Meta로 보내도 되는 필드와 금지 필드는 무엇인가.
- Test Events나 staged ON 전에 어떤 조건을 만족해야 하는가.

## 왜 필요한가

Purchase만 Meta에 보내면 구매 표본이 적어 학습 속도가 느릴 수 있다.
반대로 구매 전 행동을 Purchase처럼 보내면 ROAS가 오염된다.
따라서 중간 전환은 `보조 학습 신호`로만 다루고, 실제 매출/예산 판단용 Purchase와 섞이지 않게 해야 한다.

## 어떻게 실행하는가

기본 실행:

```bash
bash scripts/meta-intermediate-capi-phase2-sprint5-preview.sh
```

최근 7일 확인:

```bash
WINDOW=7d bash scripts/meta-intermediate-capi-phase2-sprint5-preview.sh
```

강제 실시간 계산:

```bash
FORCE=1 bash scripts/meta-intermediate-capi-phase2-sprint5-preview.sh
```

출력 파일:

```text
data/project/meta-intermediate-capi-phase2-sprint5-preview-<timestamp>.json
```

## 현재 preview 결과

2026-05-17 13:01 KST 실행 기준:

- `AddToCart`: 5건. VM Cloud `/shop_cart` 장바구니 페이지 진입 기준으로 preview 가능.
- `InitiateCheckout`: 466건. VM Cloud 결제 시작/결제 페이지 진입 기준으로 preview 가능.
- `AddPaymentInfo`: 0건. 결제수단 선택 source가 아직 약하므로 source gap.
- `CompleteRegistration`: 0건. biocom 기준 VM Cloud source와 backend allowlist가 아직 준비되지 않음.
- `Scroll50`: 0건. custom event 정책과 health/wellness 제한 검토가 먼저 필요.

## 이벤트별 전송 게이트

### AddToCart

- 무엇: 장바구니 담기 또는 장바구니 페이지 진입을 서버 보조 신호 후보로 본다.
- 왜: 구매 전 의도가 강한 행동이라 Meta 학습 보조 신호로 가치가 있다.
- 어떻게: VM Cloud `/shop_cart` row 또는 `metadata.eventName=AddToCart` row를 safe event로만 preview한다.
- 성공 기준: Test Events에서 server source 1건 이하 수신, Purchase count/value 변화 0.
- 남은 일: 실제 send는 Red 승인 후 event별 staged ON.

### InitiateCheckout

- 무엇: 결제 시작 또는 결제 페이지 진입을 서버 보조 신호 후보로 본다.
- 왜: 구매 직전 단계라 Purchase보다 표본이 많고 학습 신호로 의미가 있다.
- 어떻게: VM Cloud `checkout_started`와 `payment_page_seen` row를 보되 value는 기본 생략한다.
- 성공 기준: 미입금/가상계좌가 Purchase로 올라가지 않고, 중간 이벤트로만 잡힘.
- 남은 일: Test Events smoke 승인 후 1건 이하로 확인.

### AddPaymentInfo

- 무엇: 결제수단 선택을 별도 보조 신호 후보로 본다.
- 왜: 카드/NPAY/가상계좌 같은 결제 의도 구간을 볼 수 있지만, 결제완료는 아니다.
- 어떻게: 현재는 source gap으로 두고, 실제 결제수단 선택 row가 쌓이는지 먼저 확인한다.
- 성공 기준: `payment_method_selected`가 0이 아닌 실제 source로 잡힘.
- 남은 일: frontend/아임웹/VM Cloud 중 어디서 결제수단 선택을 안정적으로 남길지 결정.

### CompleteRegistration

- 무엇: 회원가입 완료를 보조 신호 후보로 본다.
- 왜: 재방문/구독/CRM 관점에서 장기 가치가 있는 행동이다.
- 어떻게: 현재 biocom 기준 VM Cloud source가 닫히지 않아 route와 source contract가 먼저 필요하다.
- 성공 기준: raw member id 없이 safe registration event를 1건 이하 Test Events에서 확인.
- 남은 일: backend allowlist와 수집 source 설계.

### Scroll50

- 무엇: 50% 이상 스크롤을 관심도 신호로 본다.
- 왜: 구매 전 학습 표본을 넓힐 수 있지만, 민감한 건강 콘텐츠 맥락에서는 주의가 필요하다.
- 어떻게: health/wellness 제한 때문에 URL query, content_name, product_name 없이 custom event 가능 여부를 먼저 검토한다.
- 성공 기준: 민감 custom_data 없이 engagement event로만 수신되고 Purchase/ROAS 변화 0.
- 남은 일: Meta 정책/데이터 제한 검토 후 보류 또는 별도 승인안.

## 금지 필드

아래는 preview와 실제 staged ON 모두에서 보고서/Telegram/대화/git에 출력하지 않는다.

- raw order code / order number
- raw payment key
- raw member code
- email / phone
- raw click id
- health-related content name
- health-related product name

## 승인안

다음 단계는 `Meta Test Events smoke 1건 이하`다.
이 작업은 Meta에 실제 server event를 보내므로 TJ님 명시 승인이 필요하다.
승인 전까지는 이 runbook과 preview JSON만 사용한다.

성공 기준:

- Test Events에 지정 event가 server source로 1건 이하 표시된다.
- Purchase count/value/ROAS 변화 0.
- raw identifier output 0.
- event별 OFF rollback 가능.

실패 조건:

- Purchase count/value가 변한다.
- raw identifier가 payload/report에 들어간다.
- health/wellness 민감 필드가 필요하다.
- event별 OFF가 불가능하다.

## Auditor verdict

Verdict: **PASS_WITH_NOTES**

이 작업은 Green Lane no-send preview다.
VM Cloud aggregate API만 읽었고, Meta 전송, VM Cloud 배포/restart, 운영DB write, GTM publish, Imweb 코드 수정은 하지 않았다.

Notes:

- `AddToCart`와 `InitiateCheckout`은 preview-ready다.
- `AddPaymentInfo`, `CompleteRegistration`, `Scroll50`은 source/route gap이 남았다.
- 실제 Meta Test Events smoke부터는 승인 필요 작업이다.
