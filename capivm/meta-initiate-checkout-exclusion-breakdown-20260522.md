작성 시각: 2026-05-22 10:48 KST
기준일: 2026-05-22
문서 성격: Meta InitiateCheckout CAPI 후보 제외 사유 분해 / `/goal` 수준 실행 설계

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
  required_context_docs:
    - capivm/!capiplan.md
    - project/middle-conversion-capi-dry-run-design-20260519.md
    - capivm/meta-initiate-checkout-capi-nosend-preview-design-20260522.md
  lane: Green
  allowed_actions:
    - read_only_live_api_check
    - local_backend_frontend_patch
    - no_send_design
    - documentation
    - local_typecheck_or_build
  forbidden_actions:
    - meta_capi_send
    - gtm_publish
    - imweb_header_footer_change
    - operational_db_write
    - vm_cloud_schema_migration
    - raw_identifier_output
  source_window_freshness_confidence:
    source: VM Cloud live funnel-health API + local code
    window: site=biocom/thecleancoffee, last_7d
    freshness: 2026-05-22 10:48 KST
    confidence: medium_high
```

## 10초 요약

Meta InitiateCheckout CAPI 후보는 아직 보내면 안 된다.

이유는 단순하다. VM Cloud가 본 `결제 페이지 도달`은 넓은 진단값이고, 그 안에는 페이지를 떠날 때 생긴 row, Meta 광고 단서가 약한 row, 같은 주문 흐름에서 반복된 row가 섞여 있다.

이번 패치는 `4,221건 → 380건`처럼 보이는 차이를 사람이 이해할 수 있게 순서대로 분해한다.

## 지금 가능해진 것

기존 화면은 “왜 후보가 줄었는가”를 겹치는 원인 목록으로 보여줬다.

이제는 아래처럼 앞 단계에서 제외한 row를 다음 단계에서 다시 세지 않는 순차 분해로 볼 수 있다.

| 순서 | 사람이 보는 이름 | 의미 | 운영 판단 |
|---:|---|---|---|
| 1 | 넓게 잡은 결제 페이지 도달 | 주문서/결제 페이지에 도착한 내부 관측값 | 분모 |
| 2 | 나갈 때 생긴 row 제외 | `pagehide`, `exit`, `hidden` phase | 제외 |
| 3 | 완료 URL 제외 | 결제완료 URL 성격 | InitiateCheckout에서 제외 |
| 4 | Meta 단서 부족 제외 | `fbclid`, `fbc`, Meta UTM/source가 약함 | 보수 제외 |
| 5 | Meta 단서가 강한 후보 row | 전송 후보 전 단계 | 중복 제거 전 |
| 6 | 같은 주문 흐름 중복 제거 | 같은 checkout/order 흐름 반복 row | dedupe |
| 7 | 최종 no-send 후보 | 아직 실제 전송하지 않는 최종 후보 | preview 전용 |

## Live 기준 숫자

### 바이오컴 7일

source: `https://att.ainativeos.net/api/attribution/funnel-health?site=biocom&window=7d`

freshness: 2026-05-22 10:48 KST, live cache miss 응답.

| 항목 | 값 | 해석 |
|---|---:|---|
| 결제 페이지 도달 | 4,221 | VM Cloud가 본 넓은 주문서/결제 페이지 도착 row |
| pagehide/exit 제외 | 1,941 | 결제 시작 신호로 보내면 중복 위험이 큰 row |
| 완료 URL 제외 | 0 | 이번 window에서는 InitiateCheckout 후보에서 빠질 완료 URL row 없음 |
| Meta 단서 부족 제외 | 1,527 | fbp only 또는 Meta 클릭/캠페인 증거가 약한 row |
| Meta 단서 강한 후보 row | 753 | 중복 제거 전 후보 |
| 같은 주문 흐름 중복 제거 | 373 | 같은 주문 흐름 반복 row |
| 최종 no-send 후보 | 380 | 실제 전송 전 preview 후보 |

최종 후보율은 `380 / 4,221 = 9.0%`다.

### 더클린커피 7일

source: `https://att.ainativeos.net/api/attribution/funnel-health?site=thecleancoffee&window=7d`

freshness: 2026-05-22 10:48 KST, live cache miss 응답.

| 항목 | 값 | 해석 |
|---|---:|---|
| 결제 페이지 도달 | 456 | VM Cloud가 본 넓은 주문서/결제 페이지 도착 row |
| pagehide/exit 제외 | 0 | exit phase 중복은 현재 주요 원인이 아님 |
| 완료 URL 제외 | 0 | 완료 URL 혼입은 현재 주요 원인이 아님 |
| Meta 단서 부족 제외 | 369 | 대부분 Meta 광고 단서가 약함 |
| Meta 단서 강한 후보 row | 87 | 중복 제거 전 후보 |
| 같은 주문 흐름 중복 제거 | 0 | dedupe 영향 없음 |
| 최종 no-send 후보 | 87 | 실제 전송 전 preview 후보 |

최종 후보율은 `87 / 456 = 19.1%`다.

## 왜 이 분해가 필요한가

`결제 페이지 도달`은 사람이 보기에는 “결제 시작”처럼 보이지만, Meta CAPI로 보내는 `InitiateCheckout`과 같은 말이 아니다.

- `결제 페이지 도달`: 우리 서버 원장에 남은 넓은 화면 도착 기록.
- `Meta InitiateCheckout 수신`: Meta 쪽 픽셀/서버 경로에 들어온 표준 이벤트.
- `Meta CAPI 후보`: 서버에서 Meta로 보낼 수 있을지 검토하는 no-send 후보.

이 세 가지를 섞으면 “많이 보낼수록 좋은 것처럼” 보인다. 실제로는 중복과 과대 집계가 생겨 Meta 학습 품질을 망칠 수 있다.

## `/goal` 수준 설계

현재 repo에서 `/goal` 전용 Next route는 확인되지 않았다. 따라서 여기서 말하는 `/goal` 수준은 “목표 달성 상태와 다음 행동을 한 화면에서 판단할 수 있는 수준”으로 정의한다.

### 목표

중간 전환 CAPI 확장을 안전하게 켠다.

### 성공 조건

- Purchase CAPI에는 영향 0.
- InitiateCheckout 후보는 `결제 페이지 도달` 전체가 아니라 dedupe 후 후보만 사용.
- no-send preview에서 event_id 중복 0.
- Test Events smoke는 운영 count delta 0 조건에서 1건 이하.
- canary ON 전에는 실제 Meta 전송 0.

### 화면에 보여야 할 것

1. **목표 상태**: “아직 전송 금지 / preview 중 / smoke 준비 / canary 가능”.
2. **분모와 후보**: 결제 페이지 도달 몇 건 중 몇 건이 후보인지.
3. **제외 사유**: exit, 완료 URL, Meta 단서 부족, 중복 제거를 순서대로 표시.
4. **다음 행동**: 지금 줄여야 할 구간이 무엇인지 표시.
5. **위험선**: Purchase와 섞이면 안 됨, Meta send는 Red approval 전 금지.

### 운영자가 이해해야 하는 문장

> “결제 페이지에 도착한 모든 사람을 Meta에 InitiateCheckout으로 보내는 것이 아니다. Meta 광고 단서가 있고, 완료 URL이 아니며, 같은 주문 흐름 중복을 제거한 후보만 다음 검증으로 넘긴다.”

## 개발 반영 내역

### Backend

파일: `backend/src/funnelHealth.ts`

추가한 응답:

- `checkout_signal_split.ordered_exclusion_steps`
- `checkout_signal_split.summary`

기존 `root_causes`는 호환용으로 유지한다.

### Frontend

파일:

- `frontend/src/app/ai-crm/conversion-funnel/page.tsx`
- `frontend/src/app/ai-crm/conversion-funnel/page.module.css`

추가한 화면:

- `4,221건 중 380건만 남김` 같은 요약 박스.
- 1~7단계 순서형 제외/후보 카드.
- 각 단계별 다음 조치 문구.

## 다음 판단

### 지금 바로 켜면 안 되는 이유

최종 후보가 보이기 시작했지만 아직 no-send preview다.

실제 CAPI 전송 전에 아래가 더 필요하다.

1. 후보 payload preview.
2. event_id 중복 0 확인.
3. Test Events smoke 1건 이하.
4. Purchase count delta 0.
5. canary rollback switch.

### 먼저 줄일 병목

바이오컴은 exit/pagehide row가 크다. footer phase 분리가 제대로 되고 있으므로, 전송 후보에서는 계속 제외하는 것이 맞다.

더클린커피는 Meta 단서 부족이 크다. Meta UTM/source mapping과 click-id 보존 쪽이 우선이다.

## 하지 않은 것

- Meta CAPI InitiateCheckout 실제 전송 0.
- Meta 운영 Purchase send 0.
- GTM publish 0.
- Imweb header/footer 변경 0.
- 운영DB write 0.
- VM Cloud schema migration 0.
- raw order/payment/member/click id 출력 0.
