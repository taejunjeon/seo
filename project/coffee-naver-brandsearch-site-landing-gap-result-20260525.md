# 더클린커피 네이버 브랜드검색 site_landing gap 조사 결과

작성 시각: 2026-05-25 06:41 KST  
최근 업데이트: 2026-05-25 06:57 KST — 브랜드검색을 `paid_search` 합류가 아니라 `naver_brandsearch` 별도 라인으로 재정리  
기준일: 2026-05-25  
문서 성격: read-only gap 조사 + 로컬 patch 후보 재정리  
Site: thecleancoffee

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
  project_harness_read:
    - harness/coffee-data/RULES.md
  required_context_docs:
    - data/!data_inventory.md
    - project/!traffic-attribution-current-state-guide-20260521.md
    - project/coffee-naver-brandsearch-vbank-smoke-result-20260525.md
  lane: Green
  allowed_actions:
    - VM_Cloud_public_API_read_only
    - local_code_patch_candidate
    - local_test
    - documentation
  forbidden_actions:
    - VM_Cloud_deploy_or_restart
    - operational_DB_write
    - GTM_publish
    - Imweb_code_edit
    - GA4_Meta_Google_Naver_platform_send
    - raw_identifier_output
  source_window_freshness_confidence:
    source:
      primary: VM Cloud public attribution APIs
      code_source: backend/src/siteLandingChannelClassifier.ts
      browser_cross_check: TJ님 Chrome console observation
    window: 2026-05-25 06:15-06:30 KST
    freshness: same-turn public API check
    confidence: high for root cause, medium for row-level site_landing existence because SSH read-only was blocked
```

## 10초 요약

네이버 브랜드검색 evidence는 주문 단계 원장에는 남았다. 문제는 `site_landing_ledger` 요약에서 브랜드검색으로 보이지 않고 `self_internal`로 섞이는 분류 gap이었다.

원인은 `site_landing_ledger` fan-out이 checkout/payment payload의 top-level UTM을 받더라도, 기존 채널 분류기가 `utm_source=naver_brand_search`, `utm_medium=naver_brand_search`를 paid marker로 인정하지 않았기 때문이다. 결제 페이지 referrer는 자사 도메인이므로, Naver UTM이 있어도 기존 로직은 `self_internal`로 낮췄다.

로컬 patch 후보는 처음에 일반 `paid_search` 합류였지만, TJ님 판단을 반영해 `naver_brandsearch` 별도 라인으로 재정리했다. 브랜드검색은 광고 상품 evidence로 보되, 일반 유료검색/파워링크와 섞지 않는다. 운영 VM Cloud 반영은 아직 하지 않았다.

## 실제 관측

### 1. 주문 단계 원장에는 Naver evidence가 있다

VM Cloud `attribution_ledger` public API에서 같은 window를 조회했다.

```text
source=thecleancoffee_imweb
window=2026-05-25 06:15-06:30 KST
```

결과:

- total entries: 3건
- 이번 smoke와 매칭되는 `checkout_started`: 1건
- 이번 smoke와 매칭되는 `payment_success`: 1건
- 두 row 모두 top-level `utmSource=naver_brand_search`, `utmMedium=naver_brand_search`
- 두 row 모두 metadata에도 `naver_brand_search` evidence 있음
- payment status: pending
- confirmed revenue: 0원

판정: 주문 단계 유입 보존은 PASS.

### 2. Naver aggregate는 브랜드검색으로 분류한다

`/api/attribution/ledger/naver-evidence-aggregate` 결과:

- rowsTotal: 3건
- naverAny: 2건
- `naver_brandsearch`: 2건
- `paid_naver`: 0건
- `organic_naver_candidate`: 0건

판정: attribution ledger 기준 Naver evidence 분류는 PASS.

### 3. site_landing summary는 분류가 다르게 보인다

`/api/attribution/site-landing/summary?site=thecleancoffee&windowHours=1` 결과는 Naver source를 별도로 보여주지 않았다.

24시간 summary에는 Naver 계열 campaign이 top10에 보였지만, 이번 smoke처럼 campaign이 빈 브랜드검색 row는 `utm_campaign_top10`에서 빠질 수 있다. 더 중요한 문제는 분류기다.

로컬 classifier 재현:

```text
input:
  referrerHost: thecleancoffee.com
  utm_source: naver_brand_search
  utm_medium: naver_brand_search
  site: thecleancoffee

기존 결과:
  channel: self_internal
  source_breakdown: thecleancoffee.com
  reason: self_domain_referrer
```

판정: `row 없음`으로 단정하면 안 된다. 현재 근거상 핵심 원인은 `summary 분류 gap`이다.

## 원인

`site_landing_ledger`는 독립 첫 랜딩 비콘이 아니라 checkout/payment 수신점의 fan-out으로도 채워진다.

관련 코드:

- `backend/src/siteLandingFanout.ts`
- `backend/src/siteLandingChannelClassifier.ts`
- `backend/src/routes/attribution.ts`

fan-out은 checkout/payment payload의 top-level `utmSource`, `utmMedium`, `landing`, `referrer`를 넘긴다. 그런데 기존 classifier는 아래 순서로 판단한다.

1. click id가 있으면 paid
2. `utm_medium=cpc/cpm/paid/ads/sem/...`이면 paid
3. organic UTM이면 organic
4. referrer가 자사 도메인이면 `self_internal`

`naver_brand_search`는 2번 paid medium 목록에 없었다. 그래서 결제 페이지에서 자사 referrer가 있으면 4번으로 떨어졌다.

## 로컬 patch 후보

수정 파일:

- `backend/src/siteLandingChannelClassifier.ts`
- `backend/src/siteLandingLedger.ts`
- `backend/tests/site-landing-channel-classifier.test.ts`
- `backend/tests/site-landing-multi-site.test.ts`

초기 후보:

- `naver_brand_search`
- `naverbrandsearch`
- `naver_brandsearch`
- `naverad`
- `powerlink`
- `naver` + `brandsearch/brand_search`

위 marker가 UTM source/medium/campaign 중 하나에 있으면 자사 referrer보다 먼저 `paid_search`로 분류하는 안이었다.

재정리한 최종 후보:

- `naver_brand_search`, `naverbrandsearch`, `naver_brandsearch`, `brandsearch`, `brand_search`는 `naver_brandsearch`로 분리한다.
- `powerlink`, `power-link`, 브랜드검색 marker가 없는 `naverad`는 기존 `paid_search`로 둔다.
- `paid_hint_count` 같은 paid 전체 힌트에는 `naver_brandsearch`를 포함하되, `channel_distribution`에서는 별도 라인으로 보이게 한다.

이유:

- 브랜드검색은 광고 상품으로 집행될 수 있지만, 이미 브랜드를 알고 검색한 수요를 많이 포함한다.
- 예산 판단에서는 일반 유료검색과 섞으면 증분성을 과대평가할 수 있다.
- 따라서 `광고 상품 evidence`와 `증분성 높은 유료검색`을 구분해야 한다.

로컬 재현 결과:

```text
Naver brand search UTM + self referrer:
  before: self_internal
  after: naver_brandsearch

Naver ad brandsearch campaign marker:
  after: naver_brandsearch

Naver powerlink marker:
  after: paid_search
```

## 검증

실행:

```bash
cd /Users/vibetj/coding/seo/backend
npx tsx --test tests/site-landing-channel-classifier.test.ts tests/site-landing-multi-site.test.ts
npm run typecheck
```

결과:

- site landing classifier + multi-site test: 32/32 PASS
- backend typecheck: PASS

## 하지 않은 것

- VM Cloud deploy/restart: 0건
- 운영DB write: 0건
- GTM publish: 0건
- Imweb code edit: 0건
- GA4/Meta/Google Ads/TikTok/Naver send: 0건
- raw order/payment/member/email/phone/click identifier output: 0건

## 남은 blocker

VM Cloud SSH direct SQLite read-only는 현재 `publickey`로 막혔다. 따라서 row-level `site_landing_ledger` 직접 SQL 확인은 접근 blocker다.

다만 public API와 코드 재현만으로도 이번 문제의 실무 원인은 충분히 좁혀졌다.

## 다음 할일

### Auto Green

1. 로컬 patch를 기존 변경 묶음과 충돌 없이 선별 커밋 대상으로 분류한다.
   - 이유: 운영 반영 전에도 classifier test가 회귀 방지 역할을 한다. 브랜드검색은 일반 `paid_search`가 아니라 `naver_brandsearch`로 남아야 한다.
   - 성공 기준: patch diff가 `siteLandingChannelClassifier`와 test로만 제한된다.
   - 승인 필요: NO.

### Approval Needed

1. VM Cloud에 classifier patch를 배포한다.
   - 이유: `/api/attribution/site-landing/summary`와 관련 화면에서 Naver 브랜드검색이 `self_internal`로 묻히지 않게 한다.
   - 바뀌는 효과: 이후 들어오는 Naver brandsearch UTM row가 `naver_brandsearch` 별도 라인으로 분류된다.
   - 안 바꾸면 남는 문제: 주문 단계 원장에는 Naver evidence가 있어도 site landing summary에서는 자사 내부 유입처럼 보일 수 있다.
   - 승인 필요: YES, VM Cloud deploy/restart.
