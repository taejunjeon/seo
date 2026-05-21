# 중간 전환 CAPI 확장 전 dry-run 설계

작성 시각: 2026-05-19 21:57 KST
기준일: 2026-05-19
문서 성격: no-send dry-run 설계 / CAPI 중간 전환 확장 전 검증 계획
대상 사이트: 바이오컴, 더클린커피
Lane: Green design only

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - frontrule.md
    - project/frontreport.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  lane: Green design only
  allowed_actions:
    - read_only_event_inventory
    - no_send_payload_preview
    - aggregate_dry_run_design
    - frontend_report_design
  forbidden_actions:
    - Meta_CAPI_send
    - GA4_Measurement_Protocol_send
    - Google_Ads_upload
    - TikTok_Naver_send_or_upload
    - GTM_publish
    - VM_Cloud_deploy_or_restart
    - operating_db_write
    - raw_identifier_output
  source_window_freshness_confidence:
    source: "GA4 BigQuery export + VM Cloud attribution_ledger/site_landing_ledger + GTM inventory docs"
    window: "설계 기준, 실행 시 last_7d와 today를 분리"
    freshness: "2026-05-19 21:57 KST"
    confidence: "medium_high for design, live counts require dry-run execution"
```

## 10초 요약

중간 전환은 구매 전에 보이는 행동 신호입니다.

예를 들어 장바구니, 결제 시작, 결제수단 선택, 50% 스크롤, 긴 체류 같은 행동입니다.

이번 설계의 목표는 이 신호들을 바로 Meta로 보내는 것이 아닙니다. 먼저 **실제 전송 없이 계산만 해보는 dry-run**으로 “어떤 이벤트가 이미 잡히는지, 어떤 이벤트가 빠지는지, 보냈을 때 중복이나 오염 위험이 없는지”를 확인합니다.

## 왜 지금 필요한가

Purchase(구매완료)만 보면 이미 결과가 난 뒤입니다.

광고 소재나 랜딩 페이지를 빠르게 고치려면 “구매 직전에 반복되는 행동”을 찾아야 합니다. 중간 전환 CAPI는 그 행동을 Meta에 알려 학습 신호를 늘리는 후보입니다.

단, 잘못 보내면 오히려 광고 학습이 흐려집니다. 그래서 먼저 no-send dry-run으로 안전성을 확인합니다.

## 대상 이벤트

| 쉬운 이름 | 기술 이벤트명 후보 | 왜 보는가 | 바로 CAPI 전송 가능성 |
|---|---|---|---|
| 상품 상세 조회 | `ViewContent`, `view_item` | 광고 유입자가 상품을 실제로 봤는지 확인 | 낮음. 이미 브라우저/GA4에 많아 중복 위험이 있음 |
| 장바구니 | `AddToCart`, `view_cart`, `cart_page_seen` | 구매 의도 상승 신호 | 중간. 클릭과 페이지 진입 기준을 분리해야 함 |
| 결제 시작 | `InitiateCheckout`, `begin_checkout` | 구매 직전 핵심 신호 | 높음. 구매 전 가장 강한 선행 신호 |
| 결제수단 선택 | `AddPaymentInfo`, `add_payment_info` | 결제 의지가 더 강해지는 지점 | 높음. 결제수단 감지가 안정적이어야 함 |
| 회원가입 | `CompleteRegistration`, `sign_up` | 향후 구매 가능성이 생긴 신규 고객 | 중간. 가입 완료 기준이 명확해야 함 |
| 50% 스크롤 | `Scroll50`, `scroll_50` | 콘텐츠를 충분히 본 사람 | 낮음~중간. Meta 표준 이벤트는 아니므로 커스텀으로 검토 |
| 긴 조회 | `page_view_long`, `dwell_180s` | 관심도가 높은 방문 | 낮음~중간. 구매 예측용 내부 지표로 먼저 사용 |
| 쿠폰 받기 | `Lead`, `coupon_receive` | 할인 의향과 구매 의도 | 중간. 쿠폰 발급/사용을 분리해야 함 |

## 사이트별 분리 원칙

바이오컴과 더클린커피는 절대 합산값으로 먼저 판단하지 않습니다.

- 바이오컴 Pixel: `1283400029487161`
- 더클린커피 Pixel: `1186437633687388`
- 바이오컴 GA4와 더클린커피 GA4는 별도 측정 ID로 관리
- CAPI 후보도 site별로 분리
- all-sites 합산은 운영 요약용만 허용

## Dry-run 단계

### 1단계. 이벤트 재고 조사

무엇:

- GA4 BigQuery와 VM Cloud에서 이벤트가 실제로 적재되는지 확인합니다.

왜:

- 없는 이벤트를 CAPI로 보낼 수는 없습니다.

어떻게:

- 최근 7일 기준으로 `event_name`, `site`, `source_system`, `count`, `last_seen_at`을 집계합니다.
- 원본 주문/결제/회원/클릭 ID는 출력하지 않습니다.

성공 기준:

- 사이트별로 “이미 잡힘 / 일부 잡힘 / 안 잡힘”이 나뉩니다.

### 2단계. 같은 사람/같은 흐름으로 붙는지 확인

무엇:

- GA4 행동 이벤트와 VM Cloud 결제 흐름이 같은 세션 또는 같은 safe key로 이어지는지 봅니다.

왜:

- 이벤트 수만 많아도 구매 흐름과 연결되지 않으면 선행지표로 쓰기 어렵습니다.

어떻게:

- raw key 대신 safe session/hash aggregate를 사용합니다.
- join rate(서로 이어지는 비율)를 사이트별로 계산합니다.

성공 기준:

- 각 이벤트가 구매자 cohort와 비결제자 cohort에서 어떤 차이를 보이는지 나옵니다.

### 3단계. CAPI 후보 규칙 만들기

무엇:

- 어떤 이벤트를 Meta CAPI 후보로 볼지 규칙을 만듭니다.

왜:

- 모든 이벤트를 보내면 학습 신호가 많아지는 게 아니라 잡음이 늘 수 있습니다.

기본 규칙:

- Purchase는 이 dry-run 범위에서 제외합니다.
- 결제완료와 혼동될 수 있는 이벤트는 no-send입니다.
- 같은 session/event_id 중복은 후보에서 제외합니다.
- 건강 관련 민감 상품명/콘텐츠명은 payload에서 제거하거나 최소화합니다.
- `event_source_url` query는 필요한 경우 제거합니다.

성공 기준:

- 이벤트별 `candidate`, `blocked`, `needs_gtm_fix`, `internal_only` 상태가 붙습니다.

### 4단계. no-send payload preview

무엇:

- 실제 Meta로 보내지 않고 payload 모양만 만듭니다.

왜:

- 보내기 전에 개인정보, 중복, 민감 정보, value 오염을 확인해야 합니다.

필수 필드:

- `event_name`
- `event_time`
- `event_id`
- `site`
- `pixel_id`
- `action_source`
- `user_data_present_rate`
- `custom_data_safe_fields`
- `blocked_reason`

금지 필드:

- raw order id
- raw payment key
- raw member id
- raw click id
- email/phone
- 건강 관련 상세 상품명 또는 민감한 페이지 query

### 5단계. 프론트엔드 보고서 반영

무엇:

- CAPI 보고서에 중간 전환 dry-run 상태를 사람이 이해하는 카드로 추가합니다.

왜:

- TJ님이 “지금 보내도 되는지 / 먼저 고쳐야 하는지”를 화면에서 바로 봐야 합니다.

화면 표시 예:

- `결제 시작: dry-run 우선 후보`
- `결제수단 선택: 감지 gap 확인 필요`
- `스크롤 50%: 내부 선행지표로 먼저 사용`
- `쿠폰 받기: 발급과 사용을 분리한 뒤 후보화`

## Dry-run 결과 테이블 계약

```jsonc
{
  "site": "thecleancoffee",
  "window": "7d",
  "mode": "no_send_dry_run",
  "safety": {
    "meta_capi_send": 0,
    "ga4_mp_send": 0,
    "gtm_publish": 0,
    "operating_db_write": 0,
    "raw_identifier_output": false
  },
  "events": [
    {
      "label": "결제 시작",
      "event_name": "begin_checkout",
      "ga4_count": 120,
      "vm_count": 118,
      "join_rate_pct": 91.2,
      "candidate_status": "candidate_after_dedupe",
      "why": "구매 직전 선행 신호이고 결제완료와 분리 가능",
      "blocked_reason": null,
      "confidence": "high"
    }
  ]
}
```

## Red/Yellow/Green 경계

Green:

- 문서 작성
- read-only 집계
- no-send payload preview
- 로컬 API/프론트 코드 작성

Yellow:

- VM Cloud backend 배포/restart
- precompute cache ON
- 운영 화면 배포

Red:

- Meta CAPI 실제 중간 이벤트 send
- GA4 Measurement Protocol send
- GTM Production publish
- 운영DB write/import
- 광고 캠페인/예산/최적화 이벤트 변경

## 바로 다음 할 일

### 1. 이벤트 재고 dry-run 실행

무엇:

- 바이오컴과 더클린커피의 최근 7일 중간 전환 이벤트 존재 여부를 집계합니다.

왜:

- 이미 잡히는 이벤트와 빠지는 이벤트를 나눠야 CAPI 후보를 안전하게 고를 수 있습니다.

어떻게:

- GA4 BigQuery와 VM Cloud를 read-only로 조회합니다.
- 결과는 site별 aggregate만 남깁니다.

성공 기준:

- 이벤트별 `이미 잡힘 / 일부 잡힘 / 안 잡힘` 표가 나온다.

승인 필요:

- 없음. Green read-only입니다.

추천 점수/자신감:

- 94%.

### 2. CAPI 후보 no-send preview 작성

무엇:

- 실제 전송 없이 Meta CAPI payload 후보를 만듭니다.

왜:

- 보내기 전에 중복, 민감 정보, 구매 오염 가능성을 잡아야 합니다.

어떻게:

- event_id dedupe, safe custom_data, blocked_reason을 붙입니다.

성공 기준:

- 이벤트별 candidate/blocked 이유가 설명됩니다.

승인 필요:

- 없음. 실제 send는 별도 Red 승인 전 금지입니다.

추천 점수/자신감:

- 90%.

### 3. 운영 화면에 dry-run 상태 카드 추가

무엇:

- CAPI 개발 보고서에 중간 전환 확장 전 상태를 표시합니다.

왜:

- TJ님이 “지금 보낼 수 있는 이벤트”와 “먼저 고칠 이벤트”를 한눈에 봐야 합니다.

어떻게:

- 프론트엔드에는 count 대신 현재 설계 상태와 다음 액션을 먼저 표시합니다.

성공 기준:

- 화면에서 dry-run 후보와 금지선을 구분할 수 있습니다.

승인 필요:

- 로컬 구현은 Green, 운영 배포는 Yellow입니다.

추천 점수/자신감:

- 88%.
