# Meta UTM/source 미매핑 bucket audit

작성 시각: 2026-05-19 20:53 KST
기준일: 2026-05-19
문서 성격: Meta UTM/source 미매핑 원인 분리 감사 보고서
대상 site: `biocom`, `thecleancoffee`
Lane: Green read-only audit / No-send / No-write / No-deploy / No-publish

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - capivm/!capiplan.md
    - data/!data_inventory.md
  lane: Green read-only audit
  allowed_actions:
    - VM Cloud live API read-only 조회
    - local source code read-only 확인
    - 문서 작성
    - wiki link validation
    - harness preflight check
  forbidden_actions:
    - Meta CAPI 운영 Purchase 추가 전송
    - GA4 Measurement Protocol 전송
    - Google Ads conversion upload
    - TikTok/Naver send/upload
    - GTM Production publish
    - Imweb header/footer 저장
    - VM Cloud backend deploy/restart
    - 운영DB write/import
    - raw order/payment/click/member/email/phone 출력
  source_window_freshness_confidence:
    source: "VM Cloud /api/attribution/funnel-health live API + backend/src/funnelHealth.ts read-only"
    window: "최근 24시간, 최근 7일"
    freshness: "API 조회 2026-05-19 20:48~20:50 KST, latest_logged_at 2026-05-19 20:46 KST"
    confidence: 0.86
```

## 10초 요약

이번 감사의 결론은 **CAPI send log와 VM Cloud 원장이 끊긴 문제는 현재 거의 없다**는 것이다.
`no_ledger_match`는 바이오컴/더클린커피 모두 최근 24시간과 최근 7일에서 0건이다.

진짜 문제는 다른 곳에 있다.
Meta CAPI Purchase는 정상 전송되지만, 그 주문 중 상당수가 `fbclid`, `fbc`, Meta/Facebook/Instagram UTM 같은 강한 Meta 광고 증거를 갖고 있지 않다.
따라서 “Meta 광고 유입 주문”과 “Meta Pixel 쿠키만 있는 다른 유입 주문”을 화면에서 더 명확히 나눠야 한다.

## 사람이 이해할 수 있는 용어 정리

- **CAPI 전송**: 브라우저가 아니라 서버에서 Meta에 구매 이벤트를 보내는 통로다.
- **강한 Meta 광고 증거**: `fbclid`, `fbc`, 또는 Meta/Facebook/Instagram 계열 UTM/source처럼 광고 클릭에서 왔다고 볼 근거다.
- **fbp만 있음**: Meta Pixel 사용자 쿠키는 있다는 뜻이다. 하지만 이것만으로 Meta 광고 유입이라고 단정하면 안 된다.
- **no_ledger_match**: Meta에 보낸 CAPI 로그는 있는데 VM Cloud 원장 주문과 짝이 안 맞는 상태다. 현재 이 문제는 0건이다.
- **utm_present 기타**: UTM은 있는데 Meta/Google/Naver/organic/direct 중 어디인지 분류되지 않은 상태다. 이 bucket은 원인 세분화가 필요하다.

## 감사 결과

### 바이오컴

Source: VM Cloud funnel-health live API
Pixel: `1283400029487161`
Freshness: 2026-05-19 20:48~20:50 KST 조회, latest logged 2026-05-19 20:46 KST
Confidence: medium_high

#### 최근 24시간

- CAPI Purchase 성공: 50건
- 강한 Meta 광고 증거 있음: 23건 / 46.0%
- Meta 유입 증거 없음 또는 약함: 27건 / 54.0%
- UTM 있음: 31건 / 62.0%
- UTM 없음: 19건 / 38.0%
- fbclid 있음: 16건 / 32.0%
- fbc 있음: 22건 / 44.0%
- no_ledger_match: 0건 / 0.0%
- CAPI failed: 0건
- duplicate estimate: 0건

#### 최근 7일

- CAPI Purchase 성공: 367건
- 강한 Meta 광고 증거 있음: 177건 / 48.2%
- Meta 유입 증거 없음 또는 약함: 190건 / 51.8%
- UTM 있음: 261건 / 71.1%
- UTM 없음: 106건 / 28.9%
- fbclid 있음: 137건 / 37.3%
- fbc 있음: 174건 / 47.4%
- no_ledger_match: 0건 / 0.0%
- CAPI failed: 0건
- duplicate estimate: 0건

판정:

바이오컴은 CAPI 자체는 건강하다.
다만 최근 7일 기준 CAPI 성공 주문의 절반 정도만 강한 Meta 광고 증거를 갖고 있다.
광고세트/랜딩별 예산 판단은 이 48.2% 중심으로 봐야 하고, 나머지 51.8%는 `Meta 유입 증거 약함`으로 분리해야 한다.

### 더클린커피

Source: VM Cloud funnel-health live API
Pixel: `1186437633687388`
Freshness: 2026-05-19 20:48~20:50 KST 조회, latest logged 2026-05-19 20:46 KST
Confidence: medium_high

#### 최근 24시간

- CAPI Purchase 성공: 16건
- 강한 Meta 광고 증거 있음: 4건 / 25.0%
- Meta 유입 증거 없음 또는 약함: 12건 / 75.0%
- UTM 있음: 15건 / 93.8%
- UTM 없음: 1건 / 6.3%
- fbclid 있음: 4건 / 25.0%
- fbc 있음: 4건 / 25.0%
- no_ledger_match: 0건 / 0.0%
- CAPI failed: 0건
- duplicate estimate: 0건

#### 최근 7일

- CAPI Purchase 성공: 203건
- 강한 Meta 광고 증거 있음: 38건 / 18.7%
- Meta 유입 증거 없음 또는 약함: 165건 / 81.3%
- UTM 있음: 185건 / 91.1%
- UTM 없음: 18건 / 8.9%
- fbclid 있음: 33건 / 16.3%
- fbc 있음: 38건 / 18.7%
- no_ledger_match: 0건 / 0.0%
- CAPI failed: 0건
- duplicate estimate: 0건

판정:

더클린커피는 UTM 자체는 대부분 있다.
하지만 그 UTM이 Meta 광고 증거로 분류되는 비율이 낮다.
즉 “UTM이 없다”가 아니라 **UTM/source 값이 Meta 광고로 정규화되지 않거나, 실제로 Meta 외 유입이 섞인 상태**로 보는 것이 맞다.

## 현재 bucket 판정

### strong_meta_ad_evidence

뜻:
Meta 광고 유입으로 볼 근거가 강한 주문이다.

현재 기준:

- `fbclid` 있음
- `fbc` 있음
- `utm_source`, `utm_medium`, `utm_campaign`, `metadata.source`에 Meta/Facebook/Instagram 계열 값이 있음

현재 결과:

- 바이오컴 7일: 177건 / 367건, 48.2%
- 더클린커피 7일: 38건 / 203건, 18.7%

운영 판단:

campaign/adset/landing별 예산 판단은 이 bucket을 중심으로 해야 한다.

### weak_or_partial_meta_evidence

뜻:
Meta와 연결될 가능성은 있지만 강한 광고 증거라고 보기 어려운 주문이다.

현재 live API 상태:

이 bucket은 아직 별도 필드로 분리되어 있지 않다.
현재는 대부분 `non_meta_or_unproven_meta` 안에 같이 들어간다.

분리 후보:

- `fbp`만 있음
- UTM은 있으나 Meta/Google/Naver 등 표준 source로 정규화되지 않음
- Instagram/Facebook referrer나 user agent hint는 있으나 `fbclid/fbc`가 없음
- `utm_present 기타`에 들어갔지만 source alias map이 부족한 row

운영 판단:

이 bucket은 예산 판단의 보조 근거다.
Meta 유입으로 확정하지 말고 “후보”로만 표시해야 한다.

### no_ledger_match

뜻:
Meta CAPI send log는 있는데 VM Cloud attribution ledger와 주문 key가 붙지 않는 상태다.

현재 결과:

- 바이오컴 24시간: 0건
- 바이오컴 7일: 0건
- 더클린커피 24시간: 0건
- 더클린커피 7일: 0건

운영 판단:

현재 가장 큰 병목이 아니다.
site/pixel filter와 CAPI log join은 정상으로 본다.

### non_meta_or_unproven_meta

뜻:
Meta 광고 유입이라고 단정할 근거가 없거나 약한 주문이다.

현재 결과:

- 바이오컴 7일: 190건 / 367건, 51.8%
- 더클린커피 7일: 165건 / 203건, 81.3%

운영 판단:

이 bucket은 “Meta가 아닌 주문”이라고 단정하면 안 된다.
정확히는 “Meta 광고로 귀속할 증거가 부족한 CAPI Purchase”다.
예산 판단에서는 제외하거나 낮은 confidence로 표시해야 한다.

## 원인 후보

1. **UTM alias map 부족**
   - `fb`, `ig`, `paid_social`, `meta_ads` 같은 값이 표준 Meta source로 묶이지 않을 수 있다.

2. **checkout/payment 단계에서 click id 보존 약화**
   - 랜딩에는 `fbclid`가 있어도 결제완료 row까지 전달되지 않으면 strong evidence가 줄어든다.

3. **fbp만 남고 fbc/fbclid가 빠짐**
   - fbp는 거의 모든 CAPI에 붙지만, 광고 클릭 증거로는 약하다.

4. **실제 Meta 외 유입이 CAPI에 정상 포함됨**
   - CAPI Purchase는 전체 결제완료를 Meta에 보낼 수 있다.
   - 이 중 일부는 Naver, Google, organic, direct일 수 있다.

5. **더클린커피는 UTM은 많지만 Meta source 정규화가 약함**
   - 최근 7일 UTM present가 91.1%인데 strong Meta evidence는 18.7%다.
   - UTM 값 자체를 group by 해서 source alias map을 보강해야 한다.

## 권장 개발 액션

### P0. 화면 문구 수정

무엇을 하는가:
`non_meta_or_unproven_meta`를 “Meta 유입 증거 없음 또는 약함”으로 표시한다.

왜 하는가:
현재 값은 Meta가 실패했다는 뜻이 아니라, Meta 광고 귀속 증거가 부족하다는 뜻이다.

성공 기준:
대표가 “CAPI는 갔지만 Meta 광고로 볼 수 있는 주문이 몇 건인지”를 즉시 구분한다.

### P1. weak_or_partial_meta_evidence bucket 추가

무엇을 하는가:
현재 `non_meta_or_unproven_meta`에 섞인 fbp-only, 미정규화 UTM, weak referrer hint를 별도 bucket으로 나눈다.

왜 하는가:
Meta 후보와 완전 비Meta 후보를 섞지 않아야 한다.

성공 기준:
`strong_meta_ad_evidence`, `weak_or_partial_meta_evidence`, `non_meta_or_unproven_meta`, `no_ledger_match`가 live API에 별도 count로 나온다.

### P1. source alias map 추가

무엇을 하는가:
site별 UTM source/medium/campaign 값을 aggregate로 group by 해서 Meta/Google/Naver/organic/direct alias map을 보강한다.

왜 하는가:
더클린커피처럼 UTM은 있는데 Meta로 분류되지 않는 주문을 줄여야 한다.

성공 기준:
더클린커피 `utm_present 기타`와 `non_meta_or_unproven_meta`가 줄고, strong/weak bucket이 더 설명 가능해진다.

### P2. click id restore audit

무엇을 하는가:
랜딩에서 잡힌 `fbclid/fbc`가 checkout/payment_success까지 보존되는지 확인한다.

왜 하는가:
광고 클릭 증거가 결제완료 row까지 이어져야 campaign/adset 분석이 가능하다.

성공 기준:
Meta landing -> checkout -> payment_success 사이에서 click id evidence drop 원인이 분리된다.

## 하지 않은 것

- Meta CAPI 운영 Purchase 추가 전송: 0
- GA4 Measurement Protocol 전송: 0
- Google Ads conversion upload: 0
- TikTok/Naver send/upload: 0
- GTM Production publish: 0
- Imweb header/footer 저장: 0
- VM Cloud backend deploy/restart: 0
- 운영DB write/import: 0
- raw order/payment/click/member/email/phone 출력: 0

## 다음 할일

### Codex

1. weak bucket 분리 설계
   - 무엇을 하는가: live API에 `weak_or_partial_meta_evidence`를 별도 bucket으로 추가하는 설계를 만든다.
   - 왜 하는가: 현재 `non_meta_or_unproven_meta`가 너무 넓어서 운영 판단이 흐리다.
   - 어떻게 하는가: `backend/src/funnelHealth.ts`의 `capi_attribution_join` 계산에 fbp-only, weak referrer/source hint, 미정규화 UTM을 분리한다.
   - 성공 기준: 4개 bucket이 별도 count/share로 나온다.
   - 승인 필요: 로컬 설계/코드 NO, VM 배포는 Yellow.
   - 의존성: 없음.
   - 추천 점수/자신감: 91%.

2. UTM alias map dry-run
   - 무엇을 하는가: site별 UTM source/medium/campaign 값을 raw id 없이 aggregate로 묶어 alias 후보를 만든다.
   - 왜 하는가: 더클린커피의 `UTM 있음` 주문이 Meta인지 Naver인지 기타인지 더 잘 나눠야 한다.
   - 어떻게 하는가: VM Cloud/로컬 원장에서 source value만 group by 하고, raw click/order/member id는 출력하지 않는다.
   - 성공 기준: alias map 후보가 `meta`, `google`, `naver`, `organic`, `direct`, `other_paid_or_partner`로 정리된다.
   - 승인 필요: read-only NO.
   - 의존성: VM Cloud read-only 접근 또는 live aggregate endpoint.
   - 추천 점수/자신감: 87%.

### TJ님

1. 지금은 campaign/adset 단위 예산 이동을 보류한다
   - 무엇을 하는가: strong Meta evidence bucket 중심 분석이 준비될 때까지 세부 예산 이동은 미룬다.
   - 왜 하는가: 현재 더클린커피는 Meta strong evidence가 7일 18.7%라 세부 예산 판단에 쓰기 약하다.
   - 어떻게 하는가: `/conversion-funnel`에서는 CAPI 성공/누락과 전체 Meta strong evidence 추세만 본다.
   - 성공 기준: 예산 판단은 `strong_meta_ad_evidence`와 Ads Manager 주장값을 같이 볼 수 있을 때 한다.
   - Codex가 대신 못 하는 이유: 실제 예산 이동은 사업 판단과 광고 계정 운영 권한이 필요하다.
   - 승인 필요: NO, 보류 판단.
   - 추천 점수/자신감: 85%.
