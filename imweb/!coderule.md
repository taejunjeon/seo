# Biocom Imweb Custom Code Rule

작성 시각: 2026-05-21 21:24 KST
기준일: 2026-05-21
문서 성격: Biocom 아임웹 헤더/바디/푸터 코드 설계 의도와 수정 규칙

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
  project_context_docs:
    - docurule.md
    - project/imweb-header-top-full-v313-virtual-account-issued-20260521.md
    - project/imweb-footer-full-v445-block4-value-retry-20260521.md
    - project/virtual-account-issued-v313-live-smoke-result-20260521.md
  lane: Green
  allowed_actions:
    - local_documentation
    - code_design_inventory
    - regression_prevention_rule
  forbidden_actions:
    - imweb_save
    - gtm_publish
    - meta_capi_enable
    - google_ads_conversion_send
    - production_db_write
    - vm_cloud_deploy
  source_window_freshness_confidence:
    source: local generated Imweb header/footer docs + TJ님 live smoke observations
    window: 2026-05-21 current Biocom Imweb custom code state
    freshness: 2026-05-21 21:24 KST
    confidence: 0.9
```

## 10초 요약

Biocom 아임웹 코드는 광고 클릭 보존, 결제 시작 추적, 미입금 가상계좌 분리, 실제 구매 보호를 한 화면 코드 안에서 처리한다.

가장 중요한 원칙은 두 가지다.

1. 가상계좌 주문생성/미입금은 매출이 아니다. `Purchase`가 아니라 `VirtualAccountIssued`로만 보내며 `value=0`을 유지한다.
2. `InitiateCheckout`은 실제 구매가 아니라 결제 시작이다. 그래도 Meta 중간 퍼널 품질을 위해 `value/currency`는 반드시 포함해야 한다.

최근 회귀는 푸터 업데이트 중 Block4 fallback이 금액을 너무 빨리 읽어 `InitiateCheckout value`가 빠진 것이었다. 현재 기준은 Block4 v0.5에서 전송 직전 금액을 다시 읽고, 없으면 짧게 재시도한다.

## 현재 입력칸 구조

아임웹에는 네 개 입력칸이 있다.

1. `헤더 코드 상단`: 가장 먼저 실행되어야 하는 보호 코드. 광고 클릭 ID 저장과 구매/가상계좌 판단 guard가 들어간다.
2. `헤더 코드`: 기본 픽셀, TikTok guard, GTM loader, 사이트 인증, 기타 보조 스크립트가 들어간다.
3. `바디 코드`: Keepgrow와 GTM noscript가 들어간다.
4. `푸터 코드`: UTM/click id 보존 후속 처리, checkout/payment 수집, Meta middle funnel 보강이 들어간다.

이 순서는 의미가 있다. 특히 `헤더 코드 상단`은 푸터보다 먼저 click id와 payment guard를 잡기 위해 맨 위에 있어야 한다.

## 현재 기준 문서

- 헤더 코드 상단 전체본: `project/imweb-header-top-full-v313-virtual-account-issued-20260521.md`
- 푸터 코드 전체본: `project/imweb-footer-full-v445-block4-value-retry-20260521.md`
- 가상계좌 v3.1.3 smoke 결과: `project/virtual-account-issued-v313-live-smoke-result-20260521.md`

이 문서는 실제 전체 코드를 다시 붙이는 문서가 아니다. 다음 수정자가 왜 현재 코드가 이렇게 나뉘어 있는지, 무엇을 바꾸면 안 되는지 보는 운영 규칙 문서다.

## 헤더 코드 상단

### 역할

헤더 코드 상단은 가장 먼저 실행되어야 한다.

첫 번째 역할은 Google/Meta/TikTok 광고 클릭 식별자와 UTM을 보존하는 것이다.

- Google click id: `gclid`, `gbraid`, `wbraid`
- Meta click id: `fbclid`
- TikTok click id: `ttclid`
- UTM: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`

두 번째 역할은 결제완료 계열 화면에서 브라우저가 `Purchase`를 보내기 전에 VM Cloud 결제 판단을 확인하는 것이다.

### 현재 주요 marker

- `2026-05-21-biocom-click-id-bootstrap-v1-1`
- `2026-05-21-server-payment-decision-guard-v3-1-3`
- `VirtualAccountIssued`
- `header_guard_v313`

### 저장하는 주요 key

- `__biocom_click_id_context_v1`
- `__biocom_click_ids`
- `_p1s1a_first_touch`
- `_p1s1a_last_touch`
- `_p1s1a_session_touch`
- `__biocom_payment_decision_guard_v313__:*`

### 설계 의도

광고 클릭 ID는 랜딩 URL에 있을 때 가장 안전하다. 결제 페이지나 완료 페이지에서는 URL에서 사라질 수 있다. 그래서 헤더 최상단에서 먼저 잡아 localStorage와 cookie에 남긴다.

결제 판단 guard는 Meta `Purchase`를 막기 위한 마지막 안전장치다. 아임웹/픽셀/native 스크립트가 구매 이벤트를 보내려 해도, 서버 결제 판단이 `confirmed`일 때만 `Purchase`가 나가야 한다.

가상계좌 미입금은 `pending` 상태다. 이 경우 구매가 아니라 `VirtualAccountIssued` custom event로만 보낸다.

### 의도적으로 유지해야 할 점

- `VirtualAccountIssued`의 `value=0`, `currency=KRW`는 의도다. 미입금 주문을 매출로 오인하지 않기 위한 값이다.
- 새로고침해도 `VirtualAccountIssued`가 중복 증가하면 안 된다.
- pending/virtual account 상태에서 `Purchase`가 1건이라도 발화하면 실패다.
- confirmed 결제에서만 `Purchase`가 허용되어야 한다.

### 수정 시 주의점

- 이 코드는 `헤더 코드 상단`에 있어야 한다. 일반 `헤더 코드`나 푸터로 내리면 너무 늦다.
- click id merge 규칙에서 빈 값이 기존 click id를 지우면 안 된다.
- `gbraid`와 `wbraid`는 Google click evidence다. 둘을 stale 값으로 섞지 않도록 최신 URL, checkout context, payment success context의 출처를 구분해야 한다.
- `payment-decision` endpoint 장애 시 무조건 구매를 열어주는 식의 변경은 위험하다. fail-open/fail-closed 정책을 바꿀 때는 별도 승인과 smoke가 필요하다.
- `VirtualAccountIssued`를 `Purchase`, `Lead`, `CompleteRegistration` 같은 표준 구매성 이벤트로 바꾸면 안 된다.

## 헤더 코드

### 포함된 기능

현재 일반 헤더 코드는 다음 역할을 한다.

- Direct Meta Pixel Base: Meta Pixel 기본 PageView만 초기화한다.
- TikTok Purchase Guard: TikTok `Purchase` 계열 이벤트가 미입금 주문을 구매로 세지 않도록 guard한다.
- Google Tag Manager canonical loader: `GTM-W2Z6PHN` 컨테이너를 로드한다.
- Google site verification: Search Console 인증용 meta tag다.
- Beusable RUM: 사용자 행동/성능 보조 분석 스크립트다.
- TikTok Catalog 보완 코드: 상품 상세 페이지에서 TikTok `ViewContent` 보강을 수행한다.

### 설계 의도

헤더 코드는 사이트 전체 공통 도구를 붙이는 자리다. 단, 구매 판단의 최종 권한은 헤더 코드 상단의 payment decision guard와 VM Cloud 원장에 있다.

Direct Meta Pixel Base는 PageView만 보낸다. `Purchase`는 여기서 보내면 안 된다.

TikTok Purchase Guard는 Meta guard와 같은 목적이다. 미입금 주문을 구매로 보내지 않되, 확인된 실제 결제는 잃지 않는 쪽으로 설계되어 있다.

### 수정 시 주의점

- Meta Pixel base를 두 번 초기화하지 않는다. Imweb native/FBE 픽셀과 direct base가 동시에 살아 있으면 PageView 중복이 생길 수 있다.
- Direct Meta Pixel Base에서 `Purchase`를 추가하면 안 된다.
- GTM container id는 `GTM-W2Z6PHN` 하나만 유지한다.
- GTM loader를 푸터나 바디로 옮기지 않는다. noscript iframe만 바디에 둔다.
- TikTok Purchase Guard의 unknown 처리 정책을 바꿀 때는 실제 결제 누락 위험과 미입금 구매 오인 위험을 같이 본다.
- 사이트 인증 meta tag는 tracking 로직과 무관하므로 불필요하게 수정하지 않는다.

## 바디 코드

### 포함된 기능

바디 코드는 두 가지다.

- Keepgrow script
- Google Tag Manager noscript iframe

### 설계 의도

Keepgrow는 외부 서비스 초기화 코드다. GTM noscript는 JavaScript가 꺼진 환경에서 GTM이 최소한 동작하도록 하는 보조 코드다.

### 수정 시 주의점

- GTM noscript는 header GTM loader와 같은 container id인 `GTM-W2Z6PHN`이어야 한다.
- noscript를 여러 개 넣으면 관리가 어려워지고 중복 판단이 어려워진다.
- Keepgrow script는 attribution 핵심 경로가 아니므로, ROAS/전환 문제를 고친다는 이유로 먼저 건드리지 않는다.

## 푸터 코드

### 현재 주요 marker

- `2026-05-21-biocom-footer-block1-click-id-v4-2`
- `2026-05-21-biocom-checkout-started-click-id-v4-3`
- `2026-05-21-biocom-payment-split-v4-4-3`
- `2026-05-21-biocom-funnel-capi-v4-4-4`
- `2026-05-21-biocom-meta-funnel-fallback-block4-v0-5`
- `biocom_phase9_v444`
- `biocom_block4_v0_5`

### Block 1

Block 1은 UTM과 click id 보존을 담당한다.

헤더 상단 bootstrap이 먼저 잡은 `__biocom_click_id_context_v1` 값을 읽고, 기존 `_p1s1a_*` touch storage와 호환되게 만든다.

중요한 원칙은 하나다. 새 URL에 click id가 없다고 기존 click id를 빈 값으로 덮어쓰면 안 된다.

### Block 2

Block 2는 `/shop_payment/` 진입 시 checkout context를 VM Cloud에 보낸다.

이 단계는 `checkout_started=결제 시작 후보`다. 실제 구매가 아니다.

주요 목적은 결제 페이지로 넘어가기 전에 click id, UTM, GA client id, checkout id를 묶어두는 것이다.

### Block 3

Block 3은 `/shop_payment/`와 완료 URL을 분리한다.

- `/shop_payment/`: `payment_page_seen`
- `/shop_payment_complete` 등 완료 URL: `payment_success`

여기서도 `payment_success`는 브라우저에서 Meta `Purchase`를 직접 보내는 뜻이 아니다. VM Cloud evidence에 결제 완료 후보를 남기는 역할이다.

### Phase 9

Phase 9는 기존 `fbq('track', ...)` 호출을 감싸는 wrapper다.

대상 이벤트는 다음 네 가지다.

- `ViewContent`
- `AddToCart`
- `InitiateCheckout`
- `AddPaymentInfo`

`Purchase`는 제외한다. `Purchase`는 payment decision guard가 단독으로 관리해야 한다.

현재 `enableServerCapi=false`다. 즉 Phase 9는 서버 CAPI 운영 전송을 켜지 않는다.

v4.4.4부터 native fbq 경로의 `InitiateCheckout`에 value/currency가 없으면 payload를 보강한다.

### Block 4

Block 4는 Meta browser funnel image-beacon fallback이다.

fbq wrapper chain이 실제 `facebook.com/tr` 요청을 만들지 못할 때만 보조로 보낸다.

허용 이벤트는 다음 세 가지다.

- `AddToCart`
- `InitiateCheckout`
- `AddPaymentInfo`

금지 이벤트는 다음 세 가지다.

- `PageView`
- `ViewContent`
- `Purchase`

v0.5부터 `InitiateCheckout`과 `AddPaymentInfo`는 전송 직전에 주문서 금액을 다시 읽는다. 금액이 없으면 `600ms`, `1400ms`, `2600ms`, `4000ms` 재시도 후 보낸다.

### 최근 회귀와 교훈

과거 푸터 버전에서는 `InitiateCheckout value`가 보였지만, 업데이트 과정에서 Block4 v0.4가 payload를 너무 일찍 만드는 구조가 되어 값이 빠졌다.

증상은 다음과 같았다.

- Pixel Helper에는 `InitiateCheckout`이 보인다.
- `currency=KRW`는 보인다.
- `value`가 없다.
- URL 호출에는 `cd[value]`가 없다.
- `fallback_source=biocom_block4_v0_4`가 보인다.

이 경우 Pixel Helper 표시 문제가 아니다. 실제 Meta pixel request에 value가 빠진 것이다.

현재 해결 기준은 `fallback_source=biocom_block4_v0_5`와 `cd[value]` 존재다.

## 절대 지켜야 할 불변조건

### 구매/매출 기준

- 실제 구매 매출 판단은 VM Cloud payment-decision과 결제 원장 기준이다.
- 미입금 가상계좌는 구매가 아니다.
- 미입금 가상계좌에서 `Purchase`가 나가면 실패다.
- `VirtualAccountIssued`는 미입금 주문 생성 신호다. 매출값을 넣지 않는다.
- `InitiateCheckout`은 결제 시작이다. 실제 매출로 쓰지 않는다.

### click id 기준

- `gclid`, `gbraid`, `wbraid`는 비어 있는 값으로 덮어쓰지 않는다.
- URL에 새 click id가 있으면 새 값을 우선한다.
- payment success 단계에서 stale click id를 복원하지 않도록 source를 기록한다.
- raw click id는 문서/대화/보고서에 노출하지 않는다.

### Naver 유입 기준

- `NaPm`은 Naver 검색/서비스 유입 evidence이지, 그 자체만으로 결제나 paid spend 증거가 아니다.
- 현재 Imweb 헤더 상단 click-id bootstrap은 `NaPm`을 Google click id처럼 localStorage 1차 key로 저장하지 않는다.
- 대신 VM Cloud `site_landing_ledger`가 `landing_url`과 `referrer_full_url` 원문을 보관하고, 백엔드가 `NaPm`, `nclid`, `n_*`, Naver referrer로 네이버 유입을 분류한다.
- 네이버 검색 결과에서 광고 표시가 없는 브랜드/홈페이지 결과는 우선 `organic_naver_candidate` 또는 브랜드 검색 후보로 보고, paid 판단은 `nclid`, paid UTM, brandsearch marker, 광고 표시 캡처를 함께 본다.
- Naver 유입 테스트는 바로 결제완료로 가지 말고 `네이버 결과 클릭 → 상품/구매하기 → /shop_payment/` 순서로 checkout context가 남는지 먼저 확인한다.

#### 2026-05-21 샘플 기준 구분

- 네이버 파워링크 확정 paid search:
  - `utm_source=naver`
  - `utm_medium=cpc` 또는 VM fan-out 후 `powerlink`
  - `n_media`, `n_query`, `n_rank`, `n_ad_group`, `n_ad`, `n_campaign_type`, `n_ad_group_type`, `n_match`
  - `NaPm` 내부 `tr=sa`
- 네이버 일반 검색/브랜드 검색 후보:
  - 광고 표시가 없는 검색 결과 캡처
  - `search.naver.com` 또는 `m.search.naver.com` referrer
  - `NaPm`만 있고 paid UTM 또는 `n_*` 광고 파라미터 없음
- 네이버 쇼핑검색 후보:
  - `shop_view` 등 상품 URL
  - `NaPm` 내부 `tr=slsl` 같은 shopping/list 계열 marker
  - paid UTM 또는 `n_ad` 계열이 없으면 파워링크와 분리해서 본다.

### Meta Pixel 기준

- `Purchase`는 browser fallback에서 절대 보내지 않는다.
- `InitiateCheckout`에는 `value`와 `currency=KRW`가 있어야 한다.
- `VirtualAccountIssued`는 custom event다. 구매 최적화용 이벤트가 아니다.
- fallback으로 보내는 이벤트는 중복 방지가 있어야 한다.
- `enableServerCapi=true`는 운영 전송 활성화이므로 별도 승인 전 금지다.

### GTM 기준

- `GTM-W2Z6PHN` 하나를 canonical로 유지한다.
- Default Workspace에서 수정하지 않는다.
- Preview와 Production publish는 Lane이 다르다. Production publish는 Red Lane이다.
- GTM에서 paid click intent를 수정할 때도 Imweb click id storage와 충돌하지 않아야 한다.

## 수정 절차

Imweb 코드를 고칠 때는 아래 순서를 따른다.

1. 현재 아임웹 입력칸 전체를 백업한다.
2. 새 후보 문서를 먼저 만든다. 예: `project/imweb-footer-full-vXXX-...md`
3. 변경 이유를 한 문장으로 쓴다. 예: `Block4 fallback의 InitiateCheckout value 누락 방지`
4. JavaScript syntax parse를 실행한다.
5. 가능한 경우 로컬 fixture를 만든다.
6. `python3 scripts/validate_wiki_links.py <문서>`를 실행한다.
7. `python3 scripts/harness-preflight-check.py --strict`를 실행한다.
8. 아임웹 저장은 TJ님 승인 후 진행한다.
9. 적용 후 Pixel Helper 또는 Network에서 marker와 event payload를 확인한다.
10. 결과 문서에 성공/실패와 남은 리스크를 기록한다.

## 최소 smoke 체크리스트

### 광고 클릭 저장

- 랜딩 URL에 `gclid` 또는 `gbraid`가 있다.
- 상품상세에서 storage에 click id presence가 남는다.
- `/shop_payment/` 진입 후 click id presence가 유지된다.
- VM Cloud 원장 집계에서 Google click id row가 증가한다.

### 결제 시작

- `/shop_payment/` 진입 시 `InitiateCheckout`이 보인다.
- `value > 0`이다.
- `currency=KRW`다.
- Block4 fallback이면 `fallback_source=biocom_block4_v0_5`가 보인다.

### 가상계좌 미입금 완료

- 완료 URL에서 `VirtualAccountIssued`가 1회 보인다.
- `Purchase`는 0회다.
- 새로고침해도 `VirtualAccountIssued`가 중복 증가하지 않는다.
- VM Cloud payment-decision은 pending 또는 block_purchase_virtual_account 계열이다.

### 실제 결제완료

- 실제 confirmed 결제만 `Purchase` 허용 후보가 된다.
- 가상계좌 pending과 confirmed를 같은 이벤트로 합치지 않는다.
- NPay/카드/가상계좌를 설명할 때 클릭, 결제 시작, 주문 생성, 결제 완료를 분리한다.

## 문제별 진단 기준

### Pixel Helper에 값이 안 보인다

먼저 `URL 호출됨`을 본다.

- `cd[value]`가 있으면 Pixel Helper 표시 문제일 수 있다.
- `cd[value]`가 없으면 실제 요청에 값이 빠진 것이다.
- `fallback_source=biocom_block4_v0_4`면 구버전 fallback이다.
- `fallback_source=biocom_block4_v0_5`인데 값이 없으면 DOM 금액 파싱 문제다.

### 가상계좌 완료에서 Purchase가 보인다

즉시 실패로 본다.

확인 순서:

1. Header Guard marker가 v3.1.3인지 확인한다.
2. `payment-decision` 응답이 pending인지 confirmed인지 확인한다.
3. 같은 완료 URL에서 중복 방지 key가 작동하는지 확인한다.
4. 다른 Meta Pixel 또는 Imweb native Purchase가 별도로 살아 있는지 확인한다.

### Google click id가 주문까지 안 남는다

확인 순서:

1. 랜딩 URL에 `gclid`, `gbraid`, `wbraid`, `gad_campaignid`가 실제로 있었는지 확인한다.
2. 헤더 상단 bootstrap marker가 있는지 확인한다.
3. `_p1s1a_last_touch`와 `__biocom_click_id_context_v1`에서 빈 값 덮어쓰기가 없는지 확인한다.
4. `/shop_payment/`의 checkout context payload에 click id presence가 있는지 확인한다.
5. 완료 URL의 payment success context에서 stale 복원이 아닌지 확인한다.

### Naver 유입이 주문 경로까지 남는지 본다

확인 순서:

1. 네이버 검색 결과가 광고인지 자연/브랜드 결과인지 캡처로 구분한다.
2. 랜딩 URL에 `NaPm`, `nclid`, `n_*`, Naver UTM 중 무엇이 있는지 확인한다.
3. 바로 결제완료로 가지 않고 구매하기 버튼을 눌러 `/shop_payment/` URL과 시각을 남긴다.
4. VM Cloud `site_landing_ledger`에서 같은 시간대 Naver row 증가와 checkout/payment fan-out을 read-only로 확인한다.
5. paid ROAS에 넣을지 여부는 `NaPm` 단독이 아니라 광고 표시, paid marker, 주문 연결 evidence가 모두 맞을 때만 판단한다.

## 역할 구분

TJ님이 직접 해야 하는 일:

- 아임웹 운영 입력칸 저장
- Meta Pixel Helper 확장 화면 확인
- Google 광고 실제 클릭 테스트
- 실제 결제 또는 가상계좌 주문 생성 테스트

Codex가 할 수 있는 일:

- 후보 코드 문서 생성
- 구문 검증
- 로컬 fixture
- VM Cloud read-only 확인
- 원인 분석 문서화
- 적용 후 캡처/URL 기반 판정

## Auditor verdict

PASS_WITH_NOTES.

현재 Imweb 코드는 단순 픽셀 삽입이 아니라, 광고 클릭 보존과 구매 판정 보호를 같이 수행하는 운영 추적 계층이다. 따라서 다음 수정은 작은 문구 수정처럼 보여도 결제/광고 최적화에 영향을 줄 수 있다.

앞으로는 헤더 상단, 헤더, 바디, 푸터를 따로 수정하더라도 이 문서의 불변조건을 먼저 확인한다. 특히 `Purchase`, `VirtualAccountIssued`, `InitiateCheckout value`, Google click id 보존은 매번 smoke 기준으로 확인해야 한다.
