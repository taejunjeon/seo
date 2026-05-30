---
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - imweb/!coderule.md
    - docurule.md
  required_context_docs:
    - imweb/!coderule.md
    - report/reportcoffee-attribution-preservation-map-20260527.md
    - backend/src/routes/attribution.ts
    - backend/src/attribution.ts
  lane: Green
  allowed_actions:
    - VM Cloud read-only ledger query
    - local documentation
    - implementation-owner scenario analysis
  forbidden_actions:
    - Imweb save
    - GTM workspace create/edit/preview/publish
    - VM Cloud deploy/restart
    - VM Cloud write
    - production DB write
    - external platform send
  source_window_freshness_confidence:
    source: "VM Cloud /api/attribution/ledger read-only + local Imweb/GTM docs"
    window: "biocom_imweb live ledger 2026-05-25 15:04 KST ~ 2026-05-27 15:06 KST"
    freshness: "queried 2026-05-27 15:06 KST"
    confidence: 0.9
---

# Biocom / Coffee Funnel Owner Scenario

작성 시각: 2026-05-27 15:06 KST
기준일: 2026-05-27
문서 성격: Biocom live read-only inventory와 Biocom/Coffee 추적 구현 위치 결정 메모

## 10초 요약

Biocom은 현재 아임웹 코드가 결제 단계 수집의 중심이고, VM Cloud 원장에도 최근 live `payment_page_seen`, `checkout_started`, `payment_success`가 계속 들어오고 있다.
따라서 Biocom에 Coffee식 GTM `payment_page_seen` 태그를 새로 만들 필요는 낮다.
Coffee는 TJ님 선호와 기존 작업 흐름상 GTM Preview로 먼저 검증해도 된다.
다만 장기 기준은 "도구 통일"이 아니라 "이벤트 계약 통일"이어야 한다. 두 사이트 모두 같은 touchpoint 이름, 같은 필드 의미, 같은 no-send/write/publish 승인선을 쓰면 구현 위치가 달라도 헷갈림을 줄일 수 있다.

## Live Read-Only Inventory

조회 대상: VM Cloud `/api/attribution/ledger`
필터: `source=biocom_imweb`, `captureMode=live`
원칙: raw order id, raw payment key, raw click id, phone, email 출력 0건

### 공개 HTML marker

조회 시각: 2026-05-27 15:08 KST
대상: `https://biocom.kr` 공개 HTML read-only
confidence: 0.9

확인된 marker:

- GTM loader: `GTM-W2Z6PHN`
- header click id bootstrap: `2026-05-21-biocom-click-id-bootstrap-v1-1`
- payment decision guard: `2026-05-21-server-payment-decision-guard-v3-1-3`
- virtual account guard event: `VirtualAccountIssued`
- payment split: `2026-05-26-biocom-payment-split-v4-4-5`
- page seen version: `2026-05-21-biocom-payment-page-seen-v4-4-3`
- payment success version: `2026-05-26-biocom-payment-success-v4-4-5`
- paid touch schema: `2026-05-26.paid-touch-before-checkout.v1.flat-touch-fallback`
- funnel CAPI wrapper marker: `2026-05-21-biocom-funnel-capi-v4-4-4`
- value enrichment marker: `biocom_phase9_v444`
- browser fallback marker: `biocom-block4-v0.5`

해석: 공개 HTML도 Biocom v4.4.5 계열 코드가 live에 있는 것으로 보인다. GTM UI 내부 tag list나 workspace version은 이번 Green 조회 범위에서 직접 변경/확인하지 않았다.

### 최근 2시간

조회 시각: 2026-05-27 15:05 KST
window: 2026-05-27 13:05:30 KST ~ 2026-05-27 15:05:30 KST
freshness: latest row 2026-05-27 15:05:21 KST
confidence: 0.92

- total live entries: 114
- `payment_page_seen`: 78
- `checkout_started`: 28
- `payment_success`: 8
- payment success status: confirmed 5 / pending 2 / canceled 1
- confirmed revenue in this read-only summary: 1,540,600 KRW
- pending revenue in this read-only summary: 245,000 KRW
- `paidTouchBeforeCheckout` present: 1
- `paidTouchBeforeCheckout.grade=A`: 1
- observed snippet versions:
  - `2026-05-26-biocom-payment-success-v4-4-5`: 8
  - `2026-05-21-biocom-payment-page-seen-v4-4-3`: 78
  - `2026-05-21-biocom-checkout-started-click-id-v4-3`: 28

### 최근 48시간

조회 시각: 2026-05-27 15:04 KST
window: 2026-05-25 15:04:23 KST ~ 2026-05-27 15:04:23 KST
freshness: latest row 2026-05-27 15:03:48 KST
confidence: 0.9

- total live entries: 1,552
- `payment_page_seen`: 1,025
- `checkout_started`: 368
- `payment_success`: 155
- payment success status: confirmed 142 / pending 10 / canceled 3
- confirmed revenue in this read-only summary: 39,689,488 KRW
- pending revenue in this read-only summary: 468,000 KRW
- canceled revenue in this read-only summary: 734,000 KRW
- `paidTouchBeforeCheckout` present in returned sample: 15
- `paidTouchBeforeCheckout.grade=A` in returned sample: 15

해석: Biocom의 아임웹 기반 결제 단계 수집은 live stale 상태가 아니다. `payment_page_seen`이 이미 대량으로 들어오기 때문에 같은 역할의 GTM 태그를 추가하면 중복 위험이 더 크다.

## 현재 소유자 지도

### Biocom

- 광고 클릭/UTM 1차 보존: 아임웹 헤더 상단
- 구매/가상계좌 판단 guard: 아임웹 헤더 상단 + VM Cloud payment decision
- `checkout_started`: 아임웹 푸터 Block 2
- `payment_page_seen`: 아임웹 푸터 Block 3
- `payment_success`: 아임웹 푸터 Block 3
- Meta `InitiateCheckout`/`AddPaymentInfo` browser fallback: 아임웹 푸터 Block 4
- Meta paid touch snapshot: GTM 저장 태그 또는 기존 touch storage가 보조 근거, 아임웹 푸터 v4.4.5가 payment success payload에 병합
- GTM container: `GTM-W2Z6PHN`

판단: Biocom은 이미 아임웹이 durable collection의 주인이다. 여기서 durable collection은 실제 운영 브라우저에서 VM Cloud 보조 원장으로 들어가는 지속 수집 경로를 뜻한다.

### The Clean Coffee

- 현재 확인된 강점: GTM 기반 Meta `InitiateCheckout` 운영 태그가 주문서 화면에서 값 포함 발화됨.
- 현재 gap: Biocom처럼 `payment_page_seen`을 별도 touchpoint로 저장하지 않는다.
- 현재 후보: `payment_page_seen + debug snapshot` no-send GTM Preview 후보와 `NaPm/srsltid` 구조화 후보.
- 아임웹 코드: `checkout_started`와 `payment_success` 중심. `payment_page_seen` 전용 durable write는 아직 없음.

판단: Coffee는 GTM Preview로 `payment_page_seen`을 먼저 검증하는 것이 자연스럽다. 다만 실제 VM Cloud write 단계로 갈 때는 `source`와 `owner_surface`를 분리해 혼동을 막아야 한다.

## 시나리오 비교

### 시나리오 A. Biocom은 아임웹 유지, Coffee는 GTM Preview 우선

추천: 가장 현실적이다.

무엇을 하는가: Biocom은 현재 아임웹 코드를 유지하고, Coffee만 GTM Preview로 `payment_page_seen` no-send를 검증한다.

좋은 점:

- Biocom의 이미 안정화된 live 경로를 흔들지 않는다.
- Coffee는 TJ님이 선호하는 GTM에서 빠르게 Preview와 rollback을 반복할 수 있다.
- Production publish 전에는 no-send/no-write로 막을 수 있다.

나쁜 점:

- 사이트별 구현 위치가 달라진다.
- 문서와 보고서가 없으면 "왜 여기는 아임웹, 저기는 GTM인가"가 헷갈린다.

헷갈림 방지 조건:

- 이벤트별 owner matrix를 유지한다.
- 모든 payload에 `site`, `source`, `owner_surface`, `snippetVersion`을 넣는다.
- Coffee GTM no-send 단계에서는 `source=thecleancoffee_gtm_preview`처럼 운영 원장과 분리한다.

판정: 단기 추천.

### 시나리오 B. 두 사이트 모두 GTM으로 통일

추천: 지금은 비추천이다.

무엇을 하는가: Biocom의 `payment_page_seen`, `payment_success`, Meta fallback까지 GTM으로 옮기거나 중복 구현한다.

좋은 점:

- UI에서 버전 관리와 Preview를 보기 쉽다.
- TJ님 선호와 맞다.

나쁜 점:

- Biocom은 이미 아임웹 푸터 v4.4.x가 live에서 동작 중이다.
- 같은 이벤트가 아임웹과 GTM에서 동시에 나갈 수 있다.
- payment decision guard, 가상계좌 pending 분리, paidTouchBeforeCheckout 병합 타이밍을 다시 검증해야 한다.
- GTM Production publish는 Red Lane이다.

판정: 장기 리팩터 후보일 수는 있지만 지금 실행할 이유는 약하다.

### 시나리오 C. 두 사이트 모두 아임웹 코드로 통일

추천: Coffee에 대해서는 조건부 비추천이다.

무엇을 하는가: Coffee도 Biocom처럼 아임웹 footer에 `payment_page_seen`, `NaPm` 구조화, paid touch snapshot을 직접 붙인다.

좋은 점:

- 두 사이트 모두 같은 표면에서 관리된다.
- 결제 URL과 아임웹 session 접근 타이밍이 일관될 수 있다.

나쁜 점:

- Coffee는 최근 GTM InitiateCheckout 운영 태그가 이미 검증됐다.
- 아임웹 전체 paste는 작은 변경도 사이트 전체 스크립트 위험이 크다.
- TJ님이 코드보다 GTM을 선호한다는 운영 현실과 맞지 않는다.

판정: GTM으로는 값/타이밍을 못 잡는다는 증거가 생기기 전까지는 우선순위가 낮다.

### 시나리오 D. 이벤트 계약만 통일하고 구현 위치는 사이트별 유지

추천: 최종 추천안이다.

무엇을 하는가: 도구를 억지로 통일하지 않고, 두 사이트가 같은 이벤트 의미와 필드를 쓰도록 맞춘다.

필수 계약:

- 결제 페이지 진입: `payment_page_seen`
- 결제 시작 후보: `checkout_started`
- 결제완료 후보: `payment_success`
- 실제 구매 판단: `payment_decision.status=confirmed`만 confirmed purchase 후보
- 미입금 가상계좌: 구매가 아니라 pending/unknown 또는 `VirtualAccountIssued`
- 구현 위치 표시: `metadata.owner_surface = imweb_footer | gtm_preview | gtm_live | header_guard`
- 원장 source 표시:
  - Biocom durable write: `biocom_imweb`
  - Coffee GTM Preview: `thecleancoffee_gtm_preview`
  - Coffee future durable GTM write: `thecleancoffee_gtm` 또는 reader merge 작업 후 확정

판정: 장기 추천. 도구보다 데이터 계약을 통일하는 방식이다.

## 결정 제안

1. Biocom에는 Coffee용 `payment_page_seen` GTM 태그를 만들지 않는다.
2. Biocom은 아임웹 코드가 `payment_page_seen/payment_success`의 주인이라는 상태를 유지한다.
3. Coffee는 GTM Preview로 `payment_page_seen + debug snapshot`을 먼저 검증한다.
4. Coffee가 실제 VM Cloud write로 넘어갈 때는 `source=thecleancoffee_gtm`을 새로 둘지, 기존 `thecleancoffee_imweb` reader에 합칠지 먼저 결정한다.
5. 두 사이트 모두 보고서에서는 `도구 이름`보다 `클릭 -> 결제 페이지 진입 -> 결제완료 후보 -> confirmed 판단` 순서로 설명한다.

## 다음 할일

### Auto Green

1. Coffee GTM Preview용 `payment_page_seen` payload contract를 `source/owner_surface`까지 포함해 보강한다.
   - 의존성: 없음.
   - 성공 기준: no-send payload에 `site`, `source`, `owner_surface`, `snippetVersion`, `value_status`, `order_code_present`, `checkout_id_present`가 모두 남는다.

2. Biocom live inventory monitor를 문서에 연결한다.
   - 의존성: 없음.
   - 성공 기준: 2h/48h read-only summary가 raw 식별자 없이 반복 가능하다.

### Approval Needed

1. Coffee GTM Preview 실행
   - 의존성: fresh GTM workspace, Preview-only 승인.
   - 성공 기준: `/shop_payment/`에서 no-send dataLayer/debug snapshot이 1회 생성되고, Meta/GA4/VM Cloud external send가 0건이다.

2. Coffee GTM durable write 또는 Imweb durable write 선택
   - 의존성: Preview 결과.
   - 성공 기준: 운영 write 전에 source merge와 duplicate guard가 문서화된다.
