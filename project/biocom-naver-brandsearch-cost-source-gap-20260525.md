작성 시각: 2026-05-25 15:18 KST
기준일: 2026-05-25
문서 성격: 네이버 브랜드검색 비용 원천 gap 조사 결과

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - data/!data_inventory.md
  required_context_docs:
    - project/biocom-naver-brandsearch-iphone-smoke-cost-join-backfill-dry-run-20260525.md
  lane: Green
  allowed_actions:
    - local code inspection
    - VM Cloud SQLite read-only query
    - Naver Search Ad API read-only probe
    - official documentation review
    - documentation
  forbidden_actions:
    - Naver Ads setting change
    - VM Cloud SQLite write
    - operating DB write
    - platform send/upload
    - deploy/restart
  source_window_freshness_confidence:
    source: VM Cloud SQLite naver_ads_daily + Naver Search Ad API read-only + Naver Search AD API official docs
    window: 2026-04-21..2026-05-24 KST, focused 2026-05-22..2026-05-24 KST
    freshness: VM cache latest date 2026-05-24, API probed 2026-05-25 KST
    confidence: 0.90
```

## 10초 요약

브랜드검색 비용은 0원이 아니다. 현재 우리가 쓰는 `naver_ads_daily.sales_amt_krw` 적재 경로가 네이버 `/stats`의 `salesAmt`만 읽고 있어서 `BRAND_SEARCH` 비용을 놓치고 있다.

네이버 공식 공지에는 브랜드검색 광고비가 Bizmoney `getCost` 계열에 `productCode=BRAND_SEARCH`로 추가됐다고 되어 있다. 현재 VM read-only probe에서는 `/stats`가 브랜드검색 클릭/전환값은 주지만 비용은 0으로 내려오고, Bizmoney 차감 내역에는 `campaignTp=4` 비용 2,420,000원이 별도 확인됐다.

## 왜 0원으로 보였나

현재 코드 흐름:

1. `backend/src/naverAdsClient.ts`
   - `/stats`를 호출한다.
   - fields는 `impCnt`, `clkCnt`, `cpc`, `salesAmt`, `convAmt`, `ccnt`, `crto`다.

2. `backend/scripts/naver-ads-collect-7d-20260513.ts`
   - `daily.salesAmt`를 `salesAmtKrw`로 저장한다.

3. `backend/src/naverAdsLocalDb.ts`
   - `sales_amt_krw`를 광고비 합계로 읽는다.

문제:

- `BRAND_SEARCH` 캠페인은 `/stats`에서 `impCnt`, `clkCnt`, `convAmt`, `ccnt`는 내려오지만 `cpc=0`, `salesAmt=0`이다.
- 따라서 `naver_ads_daily`에는 브랜드검색 클릭과 네이버 주장 전환값은 있지만 비용은 0으로 저장된다.

## 직접 확인한 값

### 1. 브랜드검색 `/stats` read-only probe

source: Naver Search Ad API `/stats`

site: biocom

active campaign: `BRAND_SEARCH / 브랜드검색01_바이오컴`

| date | impressions | clicks | cpc | salesAmt | Naver claimed conversion value | Naver claimed conversions |
|---|---:|---:|---:|---:|---:|---:|
| 2026-05-22 | 161 | 89 | 0 | 0 | 1,677,939 | 23 |
| 2026-05-23 | 108 | 73 | 0 | 0 | 1,532,367 | 12 |
| 2026-05-24 | 111 | 69 | 0 | 0 | 2,264,681 | 23 |

### 2. VM Cloud cache 확인

source: VM Cloud SQLite `naver_ads_daily`

동일 날짜에서 cache도 API와 동일하게 `sales_amt_krw=0`, `cpc_krw=0`이다.

### 3. Bizmoney 차감 내역 read-only probe

source: Naver Search Ad API `/billing/bizmoney/histories/exhaust`

window: 2026-04-21..2026-05-24 KST

| campaignTp | product | amount |
|---:|---|---:|
| 1 | NCC | 6,986,711 |
| 2 | NCC | 940,431 |
| 3 | NCC | 293,458 |
| 4 | NCC | 2,420,000 |

비교:

- campaignTp 1/2/3 금액은 `naver_ads_daily`의 WEB_SITE/SHOPPING/POWER_CONTENTS 비용과 거의 일치한다.
- campaignTp 4가 브랜드검색 비용 후보이며, 현재 `naver_ads_daily`에는 빠져 있다.

## 공식 문서 근거

- Naver Search AD API 공식 notice: `Bizmoney > getCost`에 브랜드검색 광고비 항목이 추가됐고, `productCode=BRAND_SEARCH`로 제공된다고 안내한다. 또한 VAT 포함금액이며 상품형별 데이터는 제공되지 않는다고 설명한다.
- 현재 공개 billing swagger asset에는 `BillingStatActivityApi`와 `BizmoneyCost` 정의가 있고, `campaignTp=4`는 Brand search AD로 설명된다. `BizmoneyCost.productCode` enum에도 `BRAND_SEARCH`가 있다.

주의:

- 공식 notice는 `getCost`를 말하지만 현재 직접 추정 path `/billing/bizmoney/cost` probe는 404였다.
- 현재 안정적으로 응답받은 endpoint는 `/billing/bizmoney/histories/exhaust`다.
- `/histories/exhaust`는 차감 이벤트 기준이라, 브랜드검색 기간 인식 광고비를 일별로 균등 배분한 값인지, 특정 차감일에 몰린 cash event인지 구분이 필요하다.

## 결론

브랜드검색 비용 gap 원인은 데이터 없음이 아니라 source mismatch다.

- 현재 source: `/stats.salesAmt` -> 브랜드검색 비용 0
- 필요한 source: Bizmoney 비용/차감 계열 -> 브랜드검색 비용 존재

## 보강 설계

### 권장 구조

새 테이블을 별도로 둔다.

```sql
CREATE TABLE IF NOT EXISTS naver_bizmoney_cost_daily (
  site TEXT NOT NULL DEFAULT 'biocom',
  date TEXT NOT NULL,
  source_operation TEXT NOT NULL,
  campaign_tp INTEGER NOT NULL,
  product_code TEXT NOT NULL DEFAULT '',
  device TEXT NOT NULL DEFAULT '',
  network_type TEXT NOT NULL DEFAULT '',
  cost_krw INTEGER NOT NULL DEFAULT 0,
  raw_rows_count INTEGER NOT NULL DEFAULT 0,
  cached_at TEXT NOT NULL,
  PRIMARY KEY (site, date, source_operation, campaign_tp, product_code, device, network_type)
);
```

이유:

- `naver_ads_daily`는 campaign-level `/stats` cache다.
- Bizmoney 비용은 product/campaign type-level 비용이다.
- 같은 테이블에 섞으면 campaign별 비용처럼 오해될 수 있다.

### summary 계산 방식

1. `WEB_SITE`, `SHOPPING`, `POWER_CONTENTS`
   - 기존 `naver_ads_daily.sales_amt_krw` 유지.

2. `BRAND_SEARCH`
   - `naver_ads_daily.sales_amt_krw`가 0이면 `naver_bizmoney_cost_daily.campaign_tp=4`를 사용한다.
   - 둘 다 값이 있으면 중복 계산하지 않고 `source_precedence=bizmoney_brand_cost`를 명시한다.

3. 브랜드검색 내부 ROAS
   - 비용: Bizmoney brand cost.
   - 내부 매출: 운영DB/VM Cloud 주문 정본에서 `naver_brandsearch`로 보정된 유입/주문만.
   - 플랫폼 주장 매출: `naver_ads_daily.conv_amt_krw`.
   - 두 매출은 합산 금지.

### 구현 순서

1. Green
   - Bizmoney 비용 collector dry-run script 작성.
   - 2026-04-21..2026-05-24 기간 preview.
   - `campaignTp=4` 일자/금액 집계와 기존 stats 비용 비교.

2. Yellow
   - 승인 후 VM Cloud SQLite에 `naver_bizmoney_cost_daily` table 생성/upsert.
   - summary API에서 브랜드검색 비용 fallback 연결.

3. Green
   - `/ads/naver` 또는 ROAS 문서에서 `Naver Ads claimed ROAS`와 `internal confirmed ROAS`를 분리 표시.

## 하지 않은 것

- VM Cloud SQLite write 0건.
- 새 table 생성 0건.
- Naver Ads setting change 0건.
- Naver Ads conversion upload/send 0건.
- backend deploy/restart 0건.

## 다음 할일

1. `naver-bizmoney-cost-preview` Green script 작성
   - 목적: `/histories/exhaust` 비용을 날짜/campaignTp/product 단위로 정리한다.
   - 성공 기준: campaignTp 4 비용이 2,420,000원으로 재현되고, 기존 WEB_SITE/SHOPPING/POWER_CONTENTS 비용과 차이가 1% 이내인지 검증된다.

2. VM Cloud 비용 cache write 승인안 작성
   - 목적: 브랜드검색 비용을 summary에서 읽을 수 있게 한다.
   - 성공 기준: 테이블 DDL, upsert SQL, rollback SQL, post-check SQL이 준비된다.
