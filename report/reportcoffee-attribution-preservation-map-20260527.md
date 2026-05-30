---
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - harness/coffee-data/VERIFY.md
    - harness/coffee-data/AUDITOR_CHECKLIST.md
  required_context_docs:
    - imweb/code_coffee_260527.md
    - imweb/!coderule-thecleancoffee.md
    - frontrule.md
    - docurule.md
  lane: Green
  allowed_actions:
    - read-only code review
    - local frontend report page
    - lint/build/smoke verification
  forbidden_actions:
    - Imweb save/publish
    - GTM publish
    - external platform send
    - production DB write
    - VM Cloud deploy/restart
  source_window_freshness_confidence:
    source: "imweb/code_coffee_260527.md + backend/src/routes/attribution.ts + backend/src/siteLandingChannelClassifier.ts"
    window: "Coffee Imweb code snapshot 2026-05-27, backend local repository current"
    freshness: "same-day code snapshot"
    confidence: 0.87
---

# 더클린커피 유입 보존 지도

작성 시각: 2026-05-27 00:00 KST
기준일: 2026-05-27
문서 성격: 최신 Coffee Imweb 코드 기준 유입 보존 검토와 프론트엔드 보고서 구현 기록

## 10초 요약

더클린커피 자사몰 최신 코드에서는 Google Ads 클릭 ID가 착지, 결제 시작, 결제완료 payload까지 비교적 강하게 보존된다.
네이버 브랜드검색 UTM도 결제완료까지 갈 수 있지만 `NaPm`은 landing URL 안 문자열로만 남아 구조화가 약하다.
Meta는 `fbclid/fbc/fbp`는 남지만 Biocom v4.4.5처럼 결제 전 paid touch snapshot을 payment success에 붙이는 `paidTouchBeforeCheckout`은 아직 없다.
그래서 지금은 전체 footer 교체가 아니라 live smoke와 `NaPm/srsltid/payment_page_seen/paidTouchBeforeCheckout` 부분 보강안을 순서대로 진행하는 것이 맞다.

## 2026-05-27 Biocom 참조 smoke

목적: Coffee에서 원하는 퍼널 보존 기준을 정할 때, 이미 v4.4.x 계열 보강이 들어간 Biocom 흐름을 비교 기준으로 삼는다.

관측 시각: 2026-05-27 10:23 KST 전후
Source/window/freshness/confidence: TJ님 브라우저 콘솔 + VM Cloud `/api/attribution/ledger?source=biocom_imweb` read-only, 최근 45분 window, same-minute freshness, confidence 0.9

결론: Biocom은 주문서 진입만으로도 `checkout_started`와 `payment_page_seen`이 VM Cloud 원장에 들어왔고, 네이버 브랜드검색 UTM이 두 row 모두에 남았다. Meta Pixel Helper에서도 `InitiateCheckout`이 브라우저 이벤트로 발화했고 value/currency가 있었다. 이 패턴은 Coffee가 아직 부족한 `payment_page_seen` 분리의 좋은 기준이다.

확인된 점:

- `last_touch`: `naverbrandsearch_biocom_pc_mainhome` 계열 UTM이 남음.
- VM Cloud 원장: 같은 주문 흐름에서 `checkout_started` 1건, `payment_page_seen` 2건 확인.
- `payment_page_seen` row: `semantic_touchpoint=payment_page_seen`, order/checkout identifier present.
- Meta browser event: `InitiateCheckout`, `value=11900`, `currency=KRW`, `fallback_source=biocom_block4_v0_5`.

주의할 점:

- TJ님이 실행한 Coffee용 콘솔 스크립트는 `__thecleancoffee_click_id_context_v1`을 읽기 때문에 Biocom에서는 `click_context_*`가 빈값처럼 보일 수 있다. Biocom의 click context key는 `__biocom_click_id_context_v1`이다.
- 주문서 진입만으로는 `payment_success`와 Purchase Guard 판단까지 확인되지 않는다. 가상계좌 미입금 주문을 생성하면 `payment_success` pending/unknown 분기까지 검증할 수 있다.

## 2026-05-27 Coffee 네이버 브랜드검색 주문서 smoke

관측 시각: 2026-05-27 10:29 KST 전후
Source/window/freshness/confidence: TJ님 브라우저 콘솔 + VM Cloud `/api/attribution/ledger?source=thecleancoffee_imweb` read-only, 최근 60분 window, same-minute freshness, confidence 0.9

결론: Coffee도 네이버 브랜드검색 유입은 주문서 진입 시점의 VM Cloud `checkout_started` row까지 보존됐다. 브라우저 콘솔의 `checkout_context`는 UTM이 비어 보였지만, 이는 sessionStorage snapshot이 마케팅 필드를 저장하지 않는 형태일 수 있고, 실제 서버 수신 row에는 `utm_source=naver_brand_search`, `utm_medium=naver_brand_search`, landing `NaPm` evidence가 남았다. 따라서 "주문서 진입에서 유입이 완전히 사라진다"는 상태는 아니다.

확인된 점:

- `last_touch`: `naver_brand_search` UTM과 `NaPm` 포함 landing evidence가 남음.
- Coffee click context: local/session 모두 `naver_brand_search` UTM과 `NaPm` 포함 landing evidence가 남음.
- VM Cloud 원장: 같은 주문 흐름에서 `checkout_started` 1건 확인.
- VM Cloud row: `utm_source=naver_brand_search`, `utm_medium=naver_brand_search`, landing `NaPm` evidence present.
- Meta Pixel Helper: 주문서 화면에서 `InitiateCheckout`이 활성으로 관측됨.

남은 gap:

- Coffee는 Biocom과 달리 주문서 진입을 `payment_page_seen`으로 별도 저장하지 않는다. 최근 60분 Coffee row도 `checkout_started`와 `payment_success`만 있고 `payment_page_seen`은 없었다.
- `NaPm`은 구조화 필드가 아니라 landing URL evidence로 남는다.
- 결제완료 전까지는 `payment_success`와 Purchase Guard 판단을 확인할 수 없다. 가상계좌 미입금 주문 생성 후 pending/unknown 분기를 따로 봐야 한다.

## 2026-05-27 Coffee 네이버 브랜드검색 가상계좌 미입금 smoke

관측 시각: 2026-05-27 10:38 KST 전후
Source/window/freshness/confidence: TJ님 브라우저 콘솔 + VM Cloud `/api/attribution/ledger?source=thecleancoffee_imweb` read-only, 최근 90분 window, same-minute freshness, confidence 0.92

결론: Coffee 네이버 브랜드검색 유입은 가상계좌 미입금 결제완료 화면의 VM Cloud `payment_success` row까지 보존됐다. 브라우저의 `payment_success_context` snapshot은 UTM이 비어 보였지만, 서버 수신 row에는 `utm_source=naver_brand_search`, `utm_medium=naver_brand_search`, landing `NaPm` evidence가 남았다. Purchase Guard는 confirmed 구매로 통과시키지 않고 `PurchaseDecisionUnknown`으로 분리했다.

확인된 점:

- VM Cloud 원장: 같은 주문 흐름에서 `checkout_started` 1건과 `payment_success` 1건 확인.
- `payment_success` row: `utm_source=naver_brand_search`, `utm_medium=naver_brand_search`, landing `NaPm` evidence present.
- Meta Pixel Helper: `InitiateCheckout`, `AddPaymentInfo`, `PurchaseDecisionUnknown` 관측.
- Purchase Guard: `status=unknown`, `browserAction=hold_or_block_purchase`, `matchedBy` empty.
- 결론: 미입금 가상계좌는 Purchase로 세지 않고 unknown/pending 계열로 격리되는 방향이 정상이다.

남은 gap:

- Coffee는 여전히 `payment_page_seen` touchpoint가 없다. 주문서 진입 단계를 `checkout_started`에서 분리하려면 별도 no-send 후보가 필요하다.
- `NaPm`은 구조화 필드가 아니라 landing URL evidence다. 네이버 분류 confidence를 올리려면 구조화 저장 보강이 필요하다.
- 실제 입금 완료 후 `confirmed/allow_purchase` 승격은 이번 smoke 범위가 아니다.

## 2026-05-27 후보 작성 결과

후보 문서: [[imweb/code_coffee_payment_page_seen_napm_structured_candidate_260527]]
승인안 문서: [[imweb/coffee-payment-page-seen-debug-snapshot-approval-20260527]]

작성한 후보:

1. `payment_page_seen` no-send preview block
   - `/shop_payment/`에서만 동작한다.
   - `enableNetworkSend=false` 기본값으로 VM Cloud write도 하지 않는다.
   - `window.__THECLEANCOFFEE_PAYMENT_PAGE_SEEN_PREVIEW_LAST__`와 `dataLayer` preview만 남긴다.
   - Meta/GA4/Google/Naver/TikTok 전송은 없다.

2. `NaPm/srsltid` 구조화 helper
   - 저장: `napm_present`, `napm_tr`, `napm_ct`, `napm_nacn`, `napm_ci_present`, `napm_hk_present`, `srsltid_present`, `srsltid_source`, `n_media`, `n_query_present`.
   - 저장하지 않음: raw `NaPm`, raw `ci`, raw `hk`, raw `srsltid`, raw search query.
   - 목적: 네이버 브랜드검색/쇼핑검색/organic evidence를 URL 문자열 검색보다 안정적으로 분류한다.

로컬 fixture:

- `backend/scripts/coffee-naver-structured-attribution-fixture.mjs`
- 검증 범위: 네이버 브랜드검색 `NaPm`, Google `srsltid`, 네이버 쇼핑성 `n_media/n_query`, Google Ads synthetic URL.

## 2026-05-27 Coffee Google Ads 클릭 ID smoke

관측 시각: 2026-05-27 11:01 KST 전후
Source/window/freshness/confidence: TJ님 브라우저 완료 URL + VM Cloud `/api/attribution/ledger?source=thecleancoffee_imweb` read-only, 최근 90분 window, same-minute freshness, confidence 0.93

결론: Coffee Google Ads synthetic smoke는 `checkout_started`와 `payment_success`까지 click evidence 보존이 확인됐다. 같은 주문 흐름의 VM Cloud row 2건 모두 `utm_source=google`, `utm_medium=cpc`, `utm_campaign=coffee_google_smoke_0527`, `gclid`, `gbraid`, `gad_source=1`, `gad_campaignid=14629255429`를 보존했다.

확인된 점:

- `checkout_started`: Google UTM, `gclid`, `gbraid`, `gad_campaignid=14629255429` present.
- `payment_success`: Google UTM, `gclid`, `gbraid`, `gad_campaignid=14629255429` present.
- 브라우저 콘솔 cross-check: `last_touch`, `coffee_click_context_local`, `coffee_click_context_session` 모두 `utm_source=google`, `utm_medium=cpc`, `utm_campaign=coffee_google_smoke_0527`, `has_gclid=true`, `has_gbraid=true`로 확인.
- `wbraid`: synthetic URL에 없었으므로 absent.
- `NaPm`: Google smoke이므로 absent.
- 미입금 가상계좌 주문이므로 예산 판단용 confirmed purchase 검증은 아니다.

주의할 점:

- 이 smoke는 synthetic click id 저장/복원 검증이다. Google Ads offline conversion upload 가능한 실제 click id 검증이 아니다.
- VM Cloud row에는 `has_gclid`/`has_gbraid` metadata key가 있으나, 일부 high-level helper 필드인 `has_google_click_id`는 false처럼 보일 수 있다. 예산 판단 로직은 raw field present와 metadata boolean을 함께 봐야 한다.
- 브라우저 콘솔에서 `checkout_context`와 `payment_success_context`는 비어 보였다. 이는 서버 수신 실패가 아니라, sessionStorage snapshot이 Coffee click context를 다시 병합하지 않는 표시 gap으로 분리한다.

## Phase-Sprint 요약표 — 실제 개발 순서 기준

| Priority | Phase/Sprint | 무엇을 하는가 | 왜 하는가 | 어떻게 진행하는가 | 지금 상태 | 현재 진척률 % | 100% 조건 | 다음 단계 / 담당 | 승인 필요 여부 | Source 문서 |
|---:|---|---|---|---|---|---:|---|---|---|---|
| P0 | [[#Phase1-Sprint1]] | 주요 유입이 결제완료까지 남는지 화면으로 볼 수 있게 한다 | 테스트할 때 콘솔과 코드만 보면 판단이 흩어진다 | `/coffee/attribution-preservation` 프론트 보고서에 유입별 보존 경로와 테스트 카드 배치 | 로컬 구현 완료 | 80 | TJ님 smoke 결과를 화면/문서에 계속 반영 | Codex: live smoke 판독 / TJ님: 실제 브라우저 유입 테스트 | NO, Green | `imweb/code_coffee_260527.md` |
| P1 | [[#Phase1-Sprint2]] | Google Ads click id 보존을 실제 브라우저로 확인한다 | Google Ads 내부 confirmed ROAS는 click id가 결제완료까지 남아야 계산 가능하다 | gclid/gbraid/gad_campaignid 테스트 URL → 주문서 → 주문완료 payload 확인 | 설계 완료 | 70 | checkout_started와 payment_success 모두에 click id/campaign hint 존재 | Codex + TJ님 | NO, 실제 결제는 TJ 판단 필요 | `frontend/src/app/coffee/attribution-preservation/page.tsx` |
| P2 | [[#Phase1-Sprint3]] | 네이버/organic 구조화 gap을 좁힌다 | NaPm/srsltid가 URL 문자열에만 남으면 paid/organic 경계가 흐려진다 | `NaPm`, `srsltid`, `n_*` 구조화 저장 보강안 작성 | 후보 필요 | 45 | landing, checkout, payment_success에 구조화 필드가 남음 | Codex | 후보 작성 NO, Imweb 반영 YES | `backend/src/siteLandingChannelClassifier.ts` |
| P3 | [[#Phase1-Sprint4]] | Meta paid touch snapshot을 Coffee 전용으로 붙인다 | Meta campaign/adset/ad 숫자 ID가 결제완료에서 약하다 | Biocom v4.4.5를 복사하지 말고 Coffee payment_success metadata에만 부분 패치 | 후보 필요 | 40 | payment_success metadata에 `paidTouchBeforeCheckout` 존재 | Codex 후보 / TJ 승인 후 Imweb 반영 | 후보 NO, Imweb 반영 YES | `imweb/!coderule-thecleancoffee.md` |

## 다음 할일 — Auto Green / Approval Needed / Blocked-Parked

### Auto Green

1. Google Ads 클릭 ID 보존 smoke 판독
   - 무엇: `gclid/gbraid/gad_campaignid` 테스트 URL에서 주문서와 주문완료 payload를 비교한다.
   - 왜: Google Ads ROAS 예산 판단에는 플랫폼 주장값이 아니라 실제 결제완료 주문과 클릭 ID 연결이 필요하다.
   - 어떻게: TJ님 브라우저 테스트 결과의 localStorage/sessionStorage/payment_success payload를 Codex가 판독한다.
   - 산출물: 보존 PASS/FAIL 표와 다음 patch 필요 여부.
   - 검증: checkout_started와 payment_success 양쪽 필드 존재.
   - 의존성: TJ님 실제 브라우저 유입.

2. 네이버 브랜드검색 smoke 판독
   - 무엇: `utm_source=naver_brand_search` 계열 값이 결제완료까지 남는지 확인한다.
   - 왜: 브랜드검색은 organic 수요와 paid 계약 비용이 섞여 있어 별도 라인으로 추적해야 한다.
   - 어떻게: 네이버 브랜드검색 클릭 후 `last_touch`, `click_context`, `payment_success`를 비교한다.
   - 산출물: 브랜드검색 bridge evidence.
   - 검증: payment_success metadata에 브랜드검색 UTM 존재.
   - 의존성: TJ님 실제 브라우저 유입.

3. `NaPm/srsltid` 구조화 보강안
   - 무엇: URL 안 문자열로만 남는 값을 별도 필드로 저장하는 Coffee 전용 patch 후보를 만든다.
   - 왜: organic/paid 경계와 네이버 쇼핑검색/브랜드검색 분류 신뢰도를 올리기 위해서다.
   - 어떻게: 현재 click context key에 `napm`, `napm_tr`, `srsltid`, `n_media`, `n_query` 후보를 no-send로 추가하는 설계를 작성한다.
   - 산출물: 후보 코드와 fixture.
   - 검증: no-send/no-write grep, fixture PASS.
   - 의존성: 없음.

### Approval Needed

1. Imweb footer 실제 저장
   - 무엇: 검증된 부분 패치를 더클린커피 Imweb footer에 저장한다.
   - 왜: 로컬 후보만으로는 실제 유입 보존이 개선되지 않는다.
   - 어떻게: live backup → 부분 patch 반영 → smoke → rollback plan.
   - 승인 필요: YES. 사이트 전체 사용자에게 영향을 주는 script 변경이다.

### Blocked/Parked

1. Meta CAPI server enable
   - 보류 이유: `enableServerCapi=false`가 현재 안전 기본값이다.
   - 재개 조건: Test Events 탭 전용 testEventCode 승인과 dedupe 검증 계획이 필요하다.

## 상세 Sprint 설명 — 각 Sprint별 무엇/왜/어떻게/% 올리려면

#### Phase1-Sprint1

**이름**: 유입 보존 프론트 보고서

무엇을 하는가: 최신 Coffee Imweb 코드 기준으로 유입별 보존 경로를 프론트엔드 화면에 정리한다.
왜 하는가: TJ님과 실제 테스트를 진행할 때 콘솔 값, VM Cloud 원장, Meta Pixel Helper 결과를 같은 기준으로 해석하기 위해서다.
어떻게 하는가: `/coffee/attribution-preservation`에 KPI, 단계별 보존 지도, 채널별 판정, smoke 카드 3개를 배치한다.
현재 진척률: 80%.
100% 조건: 실제 smoke 결과를 화면 문구에 반영하고 gap별 다음 patch 후보가 확정된다.
역할 구분: Codex가 화면과 판독 기준을 유지하고, TJ님은 실제 외부 유입을 만든다.

#### Phase1-Sprint2

**이름**: Google Ads click id 보존 smoke

무엇을 하는가: Google Ads 테스트 URL에서 click id가 결제완료까지 남는지 확인한다.
왜 하는가: Google Ads 내부 confirmed ROAS는 실제 결제완료 주문과 Google click id가 연결되어야 한다.
어떻게 하는가: 시크릿 창에서 `gclid`, `gbraid`, `gad_campaignid`, `__seo_attribution_debug=1`이 있는 URL로 들어가 주문서와 주문완료 payload를 비교한다.
현재 진척률: 70%.
100% 조건: `checkout_started`, `payment_success`, `payment_decision`에서 같은 click evidence가 확인된다.
역할 구분: TJ님이 브라우저 유입과 주문 흐름을 만들고, Codex가 콘솔/payload 결과를 판독한다.

#### Phase1-Sprint3

**이름**: 네이버/organic 구조화 보강

무엇을 하는가: `NaPm`, `srsltid`, `n_*` 계열 파라미터를 별도 필드로 보존하는 후보를 만든다.
왜 하는가: 지금은 `landing` 문자열 안에만 남아 분류는 가능하지만, 테스트와 보고에서 근거를 바로 보기 어렵다.
어떻게 하는가: `__thecleancoffee_click_id_context_v1`, `checkout_started`, `payment_success`에 구조화 필드를 추가하는 no-send patch를 설계한다.
현재 진척률: 45%.
100% 조건: 네이버 브랜드검색, 네이버 쇼핑검색, Google organic 각각에서 구조화 필드가 남는다.
역할 구분: Codex가 후보와 fixture를 만들고, TJ님은 운영 반영 여부만 승인한다.

#### Phase1-Sprint4

**이름**: Coffee 전용 paid touch snapshot

무엇을 하는가: Meta paid touch snapshot을 `payment_success` metadata에 붙이는 Coffee 전용 부분 패치를 만든다.
왜 하는가: Biocom v4.4.5에서 해결한 문제와 같다. 결제완료 URL에서 Meta 숫자 campaign/adset/ad evidence가 사라질 수 있다.
어떻게 하는가: Biocom footer 전체 복사가 아니라 Coffee의 기존 `source`, GA4 ID, Meta Pixel ID, Purchase Guard 구조를 유지한 채 `paidTouchBeforeCheckout`만 추가한다.
현재 진척률: 40%.
100% 조건: payment_success metadata에 paid touch snapshot이 있고 기존 GTM InitiateCheckout 중복이 없다.
역할 구분: Codex가 후보와 no-send fixture를 만들고, TJ님이 Imweb 실제 반영을 승인한다.

## 검토 결과

### 강한 부분

- Google Ads click id는 `gclid`, `gbraid`, `wbraid` 중 하나를 우선 선택하고 `gad_campaignid`를 campaign hint로 보존한다.
- `checkout_started`와 `payment_success` 모두 top-level과 metadata에 Google click evidence를 넣는다.
- `payment_success`는 URL, referrer, checkout context, click context, last touch, Imweb session을 순서대로 후보로 본다.
- Backend는 `checkout-context`와 `payment-success` 수신 후 attribution ledger와 site_landing fan-out을 수행한다.

### 약한 부분

- `NaPm`과 `srsltid`는 구조화 필드로 저장되지 않는다.
- `payment_page_seen`은 backend에 방어 로직이 있지만 Coffee footer가 의도적으로 별도 단계로 보내지는 않는다.
- Meta `paidTouchBeforeCheckout`이 없다.
- header 상단과 footer Block 1 모두 click-id 저장을 수행하므로 기능은 중복된다. 큰 문제는 아니지만 smoke 시 어느 block이 최종값을 썼는지 헷갈릴 수 있다.

## 금지선

- Imweb 저장 0건.
- GTM publish 0건.
- GA4/Meta/TikTok/Google Ads/Naver 전송 0건.
- 운영DB write 0건.
- VM Cloud deploy/restart 0건.
