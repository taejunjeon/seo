작성 시각: 2026-05-26 17:55 KST
기준일: 2026-05-26
문서 성격: Meta 남은 미매핑 15건 read-only 재분류 + firstPaidTouch 저장 설계 보강

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!data_inventory.md
    - docurule.md
    - project/meta-unmapped-deep-trace-readonly-20260525.md
    - project/meta-placeholder-date-comparison-20260526.md
  lane: Green
  allowed_actions:
    - VM Cloud SQLite read-only query
    - GA4 BigQuery read-only session join
    - local API read-only check
    - sanitized data artifact write
    - design documentation
  forbidden_actions:
    - VM Cloud SQLite write
    - operating DB write
    - Meta ads mutation
    - Meta CAPI or other platform send
    - GTM publish
    - deploy or restart
  source_window_freshness_confidence:
    source: local Meta UTM diagnostics API + VM Cloud SQLite read-only + GA4 BigQuery read-only
    window: 2026-05-19~2026-05-25 KST
    site: biocom
    freshness: 2026-05-26 17:55 KST read-only
    confidence: high for retained 15 count, medium_high for same-session ledger trace, medium for GA4 no-join interpretation
```

## 10초 요약

남은 15건은 더 이상 그로스팀 UTM 확인만으로 크게 줄어드는 성격이 아니다.

15건 모두 결제완료 원장에는 Meta 흔적이 남아 있지만, 캠페인·광고세트·광고를 확정하는 숫자 ID가 없다. VM Cloud 고객 유입 장부와 GA4 BigQuery까지 다시 붙여봤지만 숫자 ID는 복구되지 않았다.

따라서 현재 15건은 자동 매칭 금지가 맞고, 다음 개선은 과거 복구가 아니라 앞으로 결제 페이지 진입 전에 마지막 유료 유입 증거를 별도 저장하는 것이다.

## 실제로 가능해진 판단

### 1. 남은 15건의 성격을 더 좁혔다

Source: 로컬 Meta UTM 진단 API + VM Cloud SQLite read-only

Window: 2026-05-19~2026-05-25 KST

Freshness: API cache 2026-05-26 17:19 KST, VM Cloud read-only 2026-05-26 17:55 KST

Confidence: high

| 구분 | 주문 | 금액 | 이번 판단 |
|---|---:|---:|---|
| 원래 Meta 미매핑처럼 보이던 주문 | 23 | ₩7,371,900 | 비Meta 오분류가 섞여 있었다 |
| 승인된 제외 규칙으로 빠진 주문 | 8 | ₩2,099,700 | IG 프로필 링크, 내부 상단배너, 쿠폰/CRM, Google Ads로 분리 |
| 아직 남은 미매핑 | 15 | ₩5,272,200 | 캠페인 자동 매칭 금지 |

남은 15건은 두 묶음이다.

| 묶음 | 주문 | 금액 | 의미 |
|---|---:|---:|---|
| `fbclid only` | 14 | ₩4,813,200 | Meta 클릭 흔적은 있지만 UTM과 숫자 ID가 없다 |
| Meta 매크로 placeholder | 1 | ₩459,000 | `{{campaign.id}}` 문구가 그대로 남았고 원본 랜딩도 `/shop_payment/`뿐이다 |

### 2. `/iiary02` 회수분과 진짜 잔여분을 분리했다

넓게 보면 placeholder 결제완료 row가 6건 잡힌다.

그중 5건, ₩1,435,000은 원본 랜딩 path가 `/iiary02`라서 기존 bridge 기준으로 campaign-level 회수 대상이다. 이 5건은 남은 15건에 넣으면 안 된다.

실제 남은 placeholder는 1건, ₩459,000이다. 이 건은 원본 path가 `/shop_payment/`뿐이라 campaign-level 매칭도 할 수 없다.

## 원장별 추가 확인 결과

### VM Cloud 원장

Source: VM Cloud SQLite read-only `attribution_ledger`, `site_landing_ledger`, `paid_click_intent_ledger`

Window: 2026-05-19~2026-05-25 KST

Freshness: 2026-05-26 17:55 KST

Confidence: medium_high

| 확인 항목 | 결과 | 해석 |
|---|---:|---|
| 남은 15건 중 `firstTouch`가 붙은 주문 | 15/15 | 현재 firstTouch 장치 자체는 작동한다 |
| `firstTouch` 안에 숫자 Meta ID가 있는 주문 | 0/15 | 캠페인 확정에는 부족하다 |
| 같은 세션의 고객 유입 장부가 있는 주문 | 15/15 | 유입 장부에는 흔적이 있다 |
| 같은 세션의 유료 유입 장부가 있는 주문 | 15/15 | Meta/유료 흔적 자체는 있다 |
| 같은 세션의 숫자 Meta ID가 있는 주문 | 0/15 | A급 매칭으로 올릴 수 없다 |
| 같은 세션의 비결제 페이지 path가 있는 주문 | 12/15 | 일부는 결제 전 이동 흔적이 있지만 숫자 ID가 없다 |
| 유료 클릭 보존 장부와 붙은 주문 | 0/15 | `paid_click_intent_ledger`로는 복구 불가 |
| 자동 매칭 가능한 주문 | 0/15 | 현재 증거로는 모두 quarantine 유지 |

중요한 해석:

현재 `firstTouch`는 “무언가 첫 접점이 있었다”는 기록이다. 하지만 이 15건에서는 그 첫 접점이 캠페인 ID까지 보존하지 못했다. 그래서 이름만 firstTouch라고 해서 캠페인 매칭에 충분한 것은 아니다.

### GA4 BigQuery

Source: GA4 BigQuery read-only

Window: `events_20260519`~`events_20260525`

Freshness: 2026-05-26 17:55 KST

Confidence: medium

| 확인 항목 | 결과 |
|---|---:|
| 안전 세션키 기준 확인 | 15개 |
| GA4 exact session join | 0 |
| `ga_session_id`만으로 본 fallback join | 0 |
| 숫자 campaign/adset/ad ID 복구 | 0 |

GA4 테이블 목록 메타데이터 조회는 권한 부족으로 막혔다. 하지만 실제 events wildcard 쿼리는 실행됐고, 15개 안전 세션키는 GA4에서 붙지 않았다. 따라서 GA4로 남은 15건을 캠페인 매칭하는 것은 현재 불가능하다.

## 현재 결론

### 예산 판단용 결론

남은 15건, ₩5,272,200은 Meta 보조 유입 매출로는 볼 수 있지만 캠페인별 ROAS에 넣으면 안 된다.

캠페인별 예산 판단에는 A급 숫자 ID, B급 고유 alias, 승인된 단일 랜딩 bridge만 사용한다.

### 운영 개선용 결론

문제는 UTM 파일만의 문제가 아니다.

남은 15건은 결제완료 시점에 `/shop_payment/` 흔적과 Meta cookie/fbclid는 남았지만, 그 전에 보였어야 할 campaign/adset/ad 숫자 ID가 결제 row로 이어지지 않았다.

따라서 앞으로 줄일 방법은 `firstPaidTouch` 저장 설계다. 더 정확한 구현 이름은 `paidTouchBeforeCheckout`을 추천한다.

## firstPaidTouch 저장 설계 보강

### 이름 정리

`firstPaidTouch`는 사람이 이해하기 쉬운 이름이다.

하지만 실제로 필요한 것은 “첫 유료 유입”이 아니라 “결제 페이지로 넘어가기 전에 마지막으로 확인된 유료 유입”이다. 그래서 구현 필드명은 `paidTouchBeforeCheckout` 또는 `lastPaidTouchBeforeCheckout`가 더 안전하다.

이 문서에서는 대표 설명용으로 `firstPaidTouch`, 구현명으로 `paidTouchBeforeCheckout`을 쓴다.

### 저장 목표

고객이 광고를 클릭해 들어왔을 때 아래 정보를 결제 전 단계에서 고정 저장한다.

- 광고 출처: `source`, `medium`
- 캠페인 식별자: `utm_campaign`, `meta_campaign_id`
- 광고세트 식별자: `utm_term`, `meta_adset_id`
- 광고 식별자: `utm_content`, `meta_ad_id`
- 보조 식별자: `campaign_alias`, `meta_site_source`, `meta_placement`
- 유입 맥락: landing URL, landing path, referrer host
- 클릭 흔적: click id type, click id hash
- 세션 연결 키: GA session ID, client ID, local session hash
- 판단 등급: A/B/C/D grade, confidence, captured_at

### 덮어쓰기 원칙

1. 빈 UTM, `/shop_payment/`, `/shop_payment_complete/`, 내부 self-referrer만으로는 기존 값을 덮어쓰지 않는다.
2. 숫자 Meta ID가 있는 새 유입은 기존 값보다 우선한다.
3. 고유 `campaign_alias`가 있는 새 유입은 공통 alias보다 우선한다.
4. 단순 `fbclid only`는 저장하되 A/B급으로 승격하지 않는다.
5. `{{campaign.id}}` 같은 placeholder는 저장하되 D급 quarantine으로 둔다.
6. 저장 TTL은 기본 7일, 최대 30일이 적절하다. Meta 7일 클릭 attribution 판단과 맞추기 위해서다.

### 브라우저 저장 설계

고객 페이지에서 paid evidence가 보이면 브라우저에 먼저 저장한다.

권장 저장 위치:

- `localStorage.biocom_paid_touch_before_checkout_v1`
- `sessionStorage.biocom_paid_touch_before_checkout_v1`

저장 대상:

- `/iiary02`, `/jiihyun01`, `/hwajung01`, `/shop_view` 같은 결제 전 페이지
- URL에 `utm_*`, `meta_*`, `campaign_alias`, `fbclid`, `gclid`, `ttclid` 중 하나 이상이 있는 경우
- referrer가 Facebook/Instagram/Google/Naver/TikTok이고 내부 결제 페이지가 아닌 경우

저장 금지:

- `/shop_payment/`
- `/shop_payment_complete/`
- 관리자, 로그인, 장바구니 내부 이동만 있는 경우
- 값이 전부 비어 있거나 self-domain referrer뿐인 경우

### 서버 저장 설계

기존 스키마를 바로 바꾸지 않고 `metadata_json`에 먼저 넣는 것이 안전하다.

권장 위치:

- `checkout-context` payload metadata: `paidTouchBeforeCheckout`
- `payment-success` payload metadata: `paidTouchBeforeCheckout`
- `payment_success.metadata_json.paidTouchBeforeCheckout`
- `payment_success.metadata_json.paidTouchBeforeCheckoutMatch`

서버는 아래 순서로 판단한다.

1. payment-success body에 `paidTouchBeforeCheckout`가 있으면 먼저 검증한다.
2. 값이 유효하면 payment_success metadata에 복사한다.
3. body에 없으면 기존 `firstTouch` 후보, 고객 유입 장부, 유료 클릭 장부를 순서대로 read-only lookup한다.
4. 숫자 ID가 있으면 A급, 고유 alias면 B급, landing path만 있으면 C급, fbclid only/placeholder면 D급으로 저장한다.
5. 보고서에서는 결제 row의 빈 UTM보다 `paidTouchBeforeCheckout`을 우선한다.

### 현재 코드와의 차이

현재 코드에는 이미 `metadata_json.firstTouch`가 있다.

하지만 남은 15건에서 확인했듯이 `firstTouch`는 붙어도 캠페인 숫자 ID가 없으면 캠페인 매칭에 충분하지 않다.

보강해야 할 점은 아래다.

| 현재 | 보강 |
|---|---|
| checkout/payment 흐름 안에서 firstTouch를 붙임 | 결제 페이지 진입 전에 paid evidence를 별도 고정 |
| `firstTouch`가 있어도 숫자 ID 여부를 강하게 구분하지 않음 | `paidTouchBeforeCheckout.grade`를 A/B/C/D로 저장 |
| `/shop_payment/` 단계의 빈 값이 남을 수 있음 | 결제 페이지 값은 기존 paid touch를 덮어쓰지 못하게 함 |
| 고객 유입 장부는 흔적을 갖지만 payment_success와 캠페인 ID 연결이 약함 | payment_success metadata에 paid touch snapshot을 복사 |

## 구현 패치 초안

### 1단계: no-write 로컬 helper

파일 후보:

- `backend/src/attribution.ts`
- `backend/tests/attribution.test.ts`

추가할 helper:

```ts
type PaidTouchBeforeCheckoutSnapshot = {
  schemaVersion: "2026-05-26.paid-touch-before-checkout.v1";
  capturedAt: string;
  source: string;
  medium: string;
  campaign: string;
  term: string;
  content: string;
  metaCampaignId: string;
  metaAdsetId: string;
  metaAdId: string;
  campaignAlias: string;
  landingPath: string;
  referrerHost: string;
  clickIdType: string;
  clickIdHash: string;
  grade: "A" | "B" | "C" | "D";
  confidence: number;
};
```

테스트해야 할 fixture:

1. 숫자 `meta_campaign_id/meta_adset_id/meta_ad_id`가 있으면 A급으로 저장한다.
2. `/shop_payment/` 값은 기존 A급 paid touch를 덮어쓰지 않는다.
3. `campaign_alias=meta_biocom_광고별칭`처럼 공통 alias만 있으면 B급으로 보지 않는다.
4. `{{campaign.id}}` placeholder는 D급으로 저장한다.
5. payment-success metadata에 같은 snapshot이 복사된다.

### 2단계: 아임웹/브라우저 snippet 설계

파일 후보:

- `backend/scripts/render-imweb-attribution-snippet.ts`
- 실제 아임웹 footer/header 적용 문서

브라우저에서 해야 할 일:

1. 현재 URL에서 paid evidence를 읽는다.
2. paid evidence가 있으면 `paidTouchBeforeCheckout`를 localStorage/sessionStorage에 저장한다.
3. checkout-context와 payment-success payload에 이 값을 같이 보낸다.
4. 결제 페이지 URL은 기존 값을 덮어쓰지 않는다.

### 3단계: 보고서 반영

파일 후보:

- `backend/src/routes/ads.ts`
- `frontend/src/app/ads/meta-utm/page.tsx`

보고서 판단 순서:

1. `meta_campaign_id/meta_adset_id/meta_ad_id` 직접값
2. `paidTouchBeforeCheckout` 안의 숫자 ID
3. 기존 `firstTouch` 안의 숫자 ID
4. 고유 `campaign_alias`
5. landing bridge
6. fbclid only 또는 placeholder quarantine

## 성공 기준

1. 다음 신규 Meta 주문에서 payment_success metadata에 `paidTouchBeforeCheckout`가 붙는다.
2. 숫자 Meta ID가 있는 광고 유입은 결제완료 시점에도 A급으로 남는다.
3. `/shop_payment/`가 paid touch를 덮어쓰지 않는다.
4. 남은 미매핑이 `fbclid only`로 떨어지는 비율이 줄어든다.
5. Meta 캠페인별 ROAS에는 A/B/승인된 C급만 들어가고 D급은 계속 격리된다.

## 하지 않은 것

- VM Cloud SQLite write: 0건
- 운영DB write/import: 0건
- Meta 광고 설정 변경: 0건
- Meta CAPI/GA4/Google/TikTok/Naver 전송: 0건
- GTM publish: 0건
- VM Cloud deploy/restart: 0건

## 다음 할일

### Auto Green

1. `paidTouchBeforeCheckout` helper와 fixture를 로컬 no-write로 작성한다.
   - 무엇: 저장 후보를 A/B/C/D로 나누는 순수 함수를 만든다.
   - 왜: 운영 반영 전에 숫자 ID 보존 규칙이 맞는지 검증해야 한다.
   - 성공 기준: 5개 fixture가 통과한다.
   - 의존성: 없음.

2. 아임웹 snippet 보강안을 문서와 코드 초안으로 만든다.
   - 무엇: URL에서 paid evidence를 읽고 결제 payload에 복사하는 브라우저 로직.
   - 왜: 서버가 결제완료 시점만 보면 이미 UTM이 사라져 있기 때문이다.
   - 성공 기준: `/shop_payment/`가 기존 paid touch를 덮어쓰지 않는 fixture PASS.
   - 의존성: 1단계 helper.

### Approval Needed

1. 실제 아임웹 footer/header 또는 GTM에 적용하는 것은 별도 승인 후 진행한다.
   - 이유: 사이트 전체 tracking에 영향을 준다.
   - 성공 기준: 승인된 preview/smoke window에서 신규 결제 테스트 또는 controlled smoke로 metadata가 붙는지 확인한다.

