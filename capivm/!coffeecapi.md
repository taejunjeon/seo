# 더클린커피 Meta CAPI 계획

작성 시각: 2026-05-22 17:53 KST
상태: Green Lane read-only 현황 점검 완료
목적: 더클린커피 Meta 픽셀/데이터 세트가 여러 개 보이는 상태에서, 실제 CAPI 구매 신호가 어느 픽셀로 가고 있는지 정본을 확정하고 다음 액션을 정리한다.

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
  required_context_docs:
    - coffee/!imwebcoffee_code_latest_0501.md
    - coffee/metacoffee0413.md
    - backend/src/env.ts
    - backend/src/funnelHealth.ts
  lane: Green
  allowed_actions:
    - 로컬 코드/문서 read-only 확인
    - VM Cloud read-only API 조회
    - 문서 생성
  forbidden_actions:
    - Meta CAPI send
    - Meta backfill
    - GTM publish
    - Imweb header/footer save
    - VM Cloud deploy/restart
    - 운영DB write/import
    - raw identifier output
  source_window_freshness_confidence:
    source: VM Cloud funnel-health, VM Cloud CAPI send log, local code/docs, TJ screenshot
    window: thecleancoffee last_7d and last_30d, checked 2026-05-22 KST
    freshness: VM Cloud live read-only; screenshot user-provided 2026-05-22
    confidence: high for active CAPI pixel, medium-high for Meta UI account interpretation
```

## 이번에 가능해진 것

첨부 화면의 데이터 세트는 더클린커피 이름이 붙어 있지만, 현재 더클린커피 CAPI 운영 정본 픽셀로 보기는 어렵다.
현재 코드, VM Cloud 설정, CAPI 전송 로그가 모두 가리키는 더클린커피 운영 CAPI 픽셀은 `1186437633687388`이다.

따라서 지금 더클린커피 CAPI 계획은 `993029601940881`로 새로 보내는 것이 아니라, 먼저 `1186437633687388`을 운영 정본으로 두고 Meta UI에서 왜 다른 커피 데이터 세트가 보이는지 소유권과 연결 상태를 닫는 순서로 진행한다.

## 10초 요약

- 더클린커피 운영 CAPI 픽셀 정본: `1186437633687388`.
- 첨부 화면 선택 데이터 세트: `993029601940881`.
- 첨부 데이터 세트는 최근 화면상 PageView/ViewContent만 적고, VM Cloud CAPI 로그 기준 최근 30일 전송이 0건이다.
- 현재 더클린커피 CAPI Purchase는 살아 있다. 최근 7일 CAPI success 156건, failed 0건, duplicate event_id 0건.
- 당장 할 일은 새 픽셀로 전송하는 것이 아니라, Meta UI 픽셀 정리와 더클린커피 이벤트 매칭 품질/중간 이벤트 계획을 분리하는 것이다.

## 픽셀/데이터 세트 인벤토리

| 구분 | ID | 현재 판정 | 근거 | 다음 처리 |
|---|---:|---|---|---|
| 더클린커피 운영 CAPI 정본 | `1186437633687388` | active_capi_target | 로컬 coffee Imweb 코드, `META_PIXEL_ID_COFFEE`, `SITE_PIXEL_IDS.thecleancoffee`, VM Cloud CAPI log 모두 일치 | 유지. EMQ/누락 큐/중간 이벤트 개선 대상 |
| 첨부 화면의 더클린커피 아임웹 데이터 세트 | `993029601940881` | needs_owner_confirmation_not_current_capi_target | 화면상 PageView 8, ViewContent 4 수준. VM Cloud CAPI 30일 로그 0건 | Meta UI에서 연결된 웹사이트/광고계정/이벤트 소스 확인 |
| 더클린커피 - Meta 픽셀 후보 | `909539626956668` | legacy_or_candidate | 화면 목록에는 있으나 VM Cloud CAPI 30일 로그 0건 | 운영 사용 여부 확인 전 전송 금지 |
| 더클린커피 후보 | `1245769632725202` | legacy_or_candidate | 화면 목록에는 있으나 VM Cloud CAPI 30일 로그 0건 | 운영 사용 여부 확인 전 전송 금지 |
| 더클린커피_TEMP 후보 | `813826183830117` | temp_or_legacy | 화면 목록에는 있으나 VM Cloud CAPI 30일 로그 0건 | 운영 사용 여부 확인 전 전송 금지 |

## 현재 더클린커피 CAPI 상태

기준: VM Cloud read-only, site=`thecleancoffee`, pixel=`1186437633687388`.

### 구매 신호

| 항목 | 최근 7일 |
|---|---:|
| 실제 결제완료 주문 | 145건 |
| 실제 결제완료 금액 | 9,572,565원 |
| Meta CAPI success | 156건 |
| Meta events_received | 156건 |
| Meta CAPI failed | 0건 |
| duplicate event_id 추정 | 0건 |
| confirmed eligible unsent queue | 0건 |
| Browser Purchase | 0건 |

해석:

- 서버 CAPI 구매 신호는 현재 정상이다.
- Browser Purchase는 아직 운영 정본이 아니다. 더클린커피도 바이오컴처럼 서버 CAPI 중심으로 봐야 한다.
- CAPI success가 confirmed purchase보다 큰 것은 window/source/이벤트 시점 차이 가능성이 있어, 동일한 지표로 직접 빼면 안 된다.

### 이벤트 매칭 단서

| 고객/클릭 단서 | 최근 7일 present rate |
|---|---:|
| fbp | 100.0% |
| fbc | 30.3% |
| fbclid | 28.3% |
| gclid | 0.0% |
| gbraid/wbraid | 0.0% |

해석:

- 브라우저 식별 쿠키인 fbp는 잘 들어온다.
- Meta 광고 클릭 단서인 fbc/fbclid는 낮다.
- 더클린커피도 클릭 ID 보존과 UTM/source 정규화가 다음 개선 후보이다.

### 퍼널 단서

| 단계 | 최근 7일 |
|---|---:|
| landing row | 597 |
| payment_started | 434 |
| confirmed_purchase | 145 |
| cart_page_views | 2 |
| payment_method_selected | 0 |
| browser funnel health | unavailable |

해석:

- 결제 시작과 구매 완료는 VM Cloud에서 보인다.
- 장바구니/결제수단 선택/브라우저 중간 이벤트는 아직 안정적인 운영 지표로 쓰기 어렵다.
- 더클린커피 중간전환 CAPI는 바로 ON보다 dry-run과 GTM/GA4 수집 정리부터 하는 편이 안전하다.

## 첨부 화면 판정

첨부 화면의 `더클린커피 아임웹` 데이터 세트 `993029601940881`은 “커피 이름이 붙은 Meta 데이터 세트”는 맞다.
하지만 Codex가 알고 있고, 현재 VM Cloud가 실제 CAPI Purchase를 보내는 더클린커피 운영 픽셀은 아니다.

이 차이가 중요한 이유:

- 잘못된 데이터 세트를 보고 “CAPI가 안 들어온다”고 판단할 수 있다.
- 실제 운영 픽셀은 정상인데, 화면에서 다른 legacy/temp 픽셀을 선택하면 PageView/ViewContent만 보이거나 이벤트가 거의 없어 보일 수 있다.
- 새 전송 대상을 `993029601940881`로 바꾸면 데이터가 분산되고 학습 신호가 끊길 수 있다.

## 최근 7일 광고비와 접근성 점검

점검 시각: 2026-05-22 18:24 KST
점검 방식: Meta Graph read-only. 광고계정의 광고세트 `promoted_object.pixel_id`와 최근 7일 insights spend를 비교했다.
주의: 광고비는 픽셀 자체가 아니라 광고계정/광고세트에서 발생한다. 따라서 “픽셀로 광고가 돈다”는 말은 “광고세트가 해당 픽셀을 최적화/전환 대상으로 쓰며 spend가 있다”는 뜻으로 해석한다.

| 픽셀 | 접근 가능 토큰/계정 | 최근 7일 spend | 최근 7일 노출/클릭 | 광고세트 상태 | 판정 |
|---:|---|---:|---:|---|---|
| `1186437633687388` | `COFFEE_META_TOKEN`, 더클린커피 광고계정 `act_654671961007474` | 1,948,301원 | 52,981 / 1,563 | 20개 중 effective active 6개 | 현재 더클린커피 운영 광고가 돈다 |
| `993029601940881` | `META_ADMANAGER_API_KEY`, 바이오컴 임시 광고계정 `act_3138805896402376` | 0원 | 0 / 0 | 8개 모두 paused 또는 campaign paused | 현재 광고비 지출 없음. legacy/paused 후보 |

접근성 메모:

- `COFFEE_META_TOKEN`은 `1186437633687388` 직접 조회와 더클린커피 광고계정 조회가 가능하다.
- `COFFEE_META_TOKEN`은 `993029601940881` 직접 조회 권한이 없다.
- `META_ADMANAGER_API_KEY`는 `993029601940881` 직접 조회와 바이오컴 임시 광고계정의 legacy 더클린커피 광고세트 조회가 가능하다.
- `META_ADMANAGER_API_KEY`는 `1186437633687388` 직접 조회 권한이 없다.
- `META_ADMANAGER_API_KEY_COFFEE`는 현재 만료 상태다.

해석:

- 두 픽셀이 동시에 더클린커피 광고비를 쓰고 있는 상태는 아니다.
- 실제 예산이 나가는 최근 7일 더클린커피 광고는 `1186437633687388` 기준이다.
- `993029601940881`은 첨부 화면에서 커피 이름으로 보이지만, 현재 spend 0인 바이오컴 임시 계정의 과거/정지 광고세트 쪽 데이터 세트로 봐야 한다.
- 앞으로 더클린커피 CAPI/ROAS/이벤트 매칭 품질 보고는 `1186437633687388`을 기준으로 유지한다.

## OKR

Objective: 더클린커피도 바이오컴처럼 “실제 결제완료만 Meta Purchase로 안정 전송하고, 구매 전 선행 신호는 no-send preview를 거쳐 필요한 것만 확장”한다.

| KR | 현재 상태 | 진척률 | 100% 조건 |
|---|---|---:|---|
| KR1. 운영 CAPI 픽셀 정본 확정 | `1186437633687388` 기준으로 코드/VM/log 일치 확인 | 85% | Meta UI에서 연결 웹사이트/광고계정/데이터 소스 이름까지 확인 |
| KR2. Purchase CAPI 누락 0 유지 | 최근 7일 missing queue 0 | 90% | 일일 Slack 감시에서 failed/missing/duplicate 0 유지 |
| KR3. 이벤트 매칭 품질 개선 후보화 | fbp 100%, fbc 30.3%, fbclid 28.3% 확인 | 55% | 이메일/전화/외부ID 후보 no-send preview와 canary 계획 수립 |
| KR4. 중간전환 신호 정리 | 결제 시작은 보이나 cart/payment method/browser funnel 약함 | 45% | GTM/GA4/VM 단계명이 같은 의미로 정렬되고, CAPI 확장 후보가 no-send preview로 검증 |
| KR5. Meta UI 혼선 제거 | legacy/temp 후보 픽셀 존재 확인 | 40% | 운영 픽셀/legacy 픽셀/사용 중지 픽셀 구분 완료 |

## 액션 플랜

### Phase 1. 픽셀 정본 닫기

무엇을: Meta UI에서 `1186437633687388`이 더클린커피 운영 픽셀인지, `993029601940881`은 어떤 용도인지 확인한다.
왜: 보고 화면을 잘못 선택하면 CAPI가 정상인데도 장애처럼 보인다.
어떻게: Events Manager에서 각 데이터 세트의 연결 웹사이트, 연결 광고계정, 통합, 최근 Purchase 여부를 비교한다.
성공 기준: 운영 보고서와 Meta UI 모두 `1186437633687388`을 더클린커피 운영 CAPI 정본으로 표시한다.

### Phase 2. Purchase CAPI 일일 감시 고정

무엇을: 더클린커피도 바이오컴과 같은 daily monitor에 포함한다.
왜: 누락 큐 0이 유지되는지 매일 자동으로 봐야 한다.
어떻게: Slack daily report에 site=`thecleancoffee`, pixel=`1186437633687388`, failed/missing/duplicate 지표를 추가한다.
성공 기준: 매일 `failed 0`, `missing 0`, `duplicate 0` 또는 문제 발생 시 원인 bucket이 표시된다.

### Phase 3. 이벤트 매칭 품질 후보 감사

무엇을: 더클린커피 Purchase CAPI에 추가할 수 있는 고객 식별자 후보를 no-send preview로 점검한다.
왜: Meta 이벤트 매칭 품질이 낮으면 학습/귀속이 약해질 수 있다.
어떻게: 실제 전송하지 않고, confirmed Purchase에 대해 이메일/전화/외부ID 후보 present rate만 집계한다.
성공 기준: raw identifier 출력 없이 후보율과 위험도가 나온다.

### Phase 4. 중간전환 CAPI 확장 dry-run

무엇을: 결제 시작, 장바구니, 결제수단 선택 같은 구매 전 이벤트를 CAPI로 보낼 가치가 있는지 미리 계산한다.
왜: Browser Pixel이 이미 일부 중간 이벤트를 보내고 있으므로, 서버 CAPI까지 보내면 중복/과발화 위험이 생긴다.
어떻게: no-send payload preview로 후보 수, 중복 가능성, 브라우저 이벤트와 겹침, 구매 예측력을 본다.
성공 기준: 실제 전송 전 “보낼 이벤트 / 보류할 이벤트 / 보내면 위험한 이벤트”가 분리된다.

## 금지 사항

- `993029601940881`로 CAPI 대상을 임의 변경하지 않는다.
- Meta CAPI send/backfill을 실행하지 않는다.
- GTM Production publish를 하지 않는다.
- Imweb header/footer를 저장하지 않는다.
- VM Cloud deploy/restart를 하지 않는다.
- 운영DB write/import를 하지 않는다.
- raw order/payment/member/click/email/phone identifier를 보고서에 출력하지 않는다.

## 현재 결론

더클린커피 CAPI 계획은 새로 시작해야 하는 상태가 아니다.
이미 `1186437633687388`으로 Purchase CAPI가 정상 동작 중이고, 최근 7일 실패/중복/누락 큐가 모두 안정적이다.

다만 Meta UI에 커피 이름의 다른 데이터 세트가 여러 개 보여 운영자가 잘못된 화면을 볼 위험이 있다.
다음 작업은 “새 픽셀 연결”이 아니라 “운영 픽셀 정본 고정 + 이벤트 매칭 품질 후보 감사 + 중간전환 확장 dry-run”이다.
