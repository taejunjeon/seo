# reportbiocom — 바이오컴 매출액/광고비 비중 리포트

작성 시각: 2026-05-25 22:47 KST
기준일: 2026-05-25
문서 성격: 바이오컴 Slack 주간/월간 리포트 후속 계획
상위 문서: [[!report]]
최신 source map: [[reportbiocom-source-map-20260523]]
공통 다음 임팩트 계획: [[report-v0.1-readiness-and-next-impact-plan-20260523]]
광고비 source gap 계획: [[report-ad-spend-source-gap-plan-20260523]]
Naver 브랜드검색 수동 비용 source: [[naver-brandsearch-manual-cost-source-policy-20260525]]
Naver 브랜드검색 수동 비용 cache 결과: [[naver-brandsearch-manual-cost-cache-write-result-20260525]]
Naver 브랜드검색 ROAS preview: [[naver-brandsearch-roas-preview-result-20260525]]
Naver 브랜드검색 주문 정본 cross-check: [[naver-brandsearch-order-source-crosscheck-result-20260525]]
Naver 브랜드검색 주문 단위 bridge preview: [[naver-brandsearch-order-bridge-preview-result-20260525]]

## 10초 요약

바이오컴은 더클린커피보다 광고 ROAS 정합성 작업이 많이 진행돼 있다.

하지만 Google Ads, Meta, Naver, TikTok 플랫폼 값은 내부 결제완료 매출과 계속 분리해야 한다. 이 문서는 더클린커피 v0.1 구조를 바이오컴에 적용하기 위한 후속 문서이고, 실제 숫자 산출 전 source map은 [[reportbiocom-source-map-20260523]]에 둔다.

## 현재 사용할 source 후보

### 매출

- 자사몰 actual confirmed: 운영DB `tb_iamweb_users PAYMENT_COMPLETE`.
- NPay actual: 운영DB `tb_iamweb_users`의 `NAVERPAY_ORDER + PAYMENT_COMPLETE`.
- VM Cloud `attribution_ledger payment_success confirmed`: 실시간 dashboard 기준 cross-check.
- GA4 purchase: actual 매출 source가 아니라 guard/참고값.

### 광고비

- Google Ads: Google Ads API, campaign_id/site mapping과 click id evidence가 필요하다.
- Meta: Meta Ads Insights API, `/api/ads/site-summary`와 `/api/ads/roas-summary`.
- Naver: 일반 검색 광고는 Naver Search Ad API 또는 `naver_ads_daily`, 브랜드검색은 TJ님 수동 확인 계약 금액을 primary로 사용한다. 바이오컴 브랜드검색은 Bizmoney API가 총액 cross-check source로 승격됐다. 바이오컴 브랜드검색 수동 비용은 모바일 1,760,000원(2026-05-22..2026-07-20, 60일) + PC 660,000원(2026-05-22..2026-06-20, 30일)이다.
- TikTok: TikTok Business API 또는 local cache, freshness 경고 필요.

### 2026-05-25 Naver 브랜드검색 source 확정

바이오컴 브랜드검색은 일반 daily stats만으로 비용을 안정적으로 읽기 어렵지만, Bizmoney API에서는 총액이 조회된다. 따라서 Bizmoney API를 `cross-check source`로 승격하고, 보고서 계산에는 TJ님이 확인한 계약 금액을 기간별로 배분한 수동 비용 cache를 쓴다.

- 모바일: 1,760,000원, 2026-05-22..2026-07-20, 60일, 계약 가능 검색수 8,000.
- PC: 660,000원, 2026-05-22..2026-06-20, 30일, 계약 가능 검색수 8,000.
- 다음 기간은 새 계약 정보가 오기 전까지 같은 가격/기간으로 갱신된다고 가정한다.
- Bizmoney API preview에서 확인된 브랜드검색 총액 2,420,000원은 수동 계약 총액과 일치하므로 cross-check source로 쓴다.
- 수동 기간 배분 cache는 2026-05-25 22:00 KST에 VM Cloud SQLite에 적재됐다. 실제 주간/월간 리포트 반영은 이 cache를 읽는 no-send reader를 붙인 뒤 진행한다. 차감일 기준 Bizmoney row를 그대로 주간 비용에 넣지 않는다.
- 2026-05-25 22:10 KST no-send reader 기준, 2026-05-22..2026-05-25 바이오컴 브랜드검색 비용은 205,336원, VM Cloud 결제완료 marker 금액은 4,786,416원, 참고 ROAS는 23.31이다. 이것은 운영DB 주문 정본 기반 최종 내부 confirmed ROAS가 아니라 marker 기준 preview다.
- 2026-05-25 22:46 KST 운영DB read-only cross-check 기준, 같은 기간 운영DB 결제완료 주문 정본은 199건 / 47,306,484원이다. 브랜드검색 marker 금액은 주문 정본 총액 안에 들어가므로 sanity check는 통과했지만, 주문 정본 총액은 브랜드검색 exact 매출이 아니라 같은-window 전체 매출이다.
- 2026-05-25 23:10 KST 주문 단위 bridge preview 기준, 브랜드검색 marker 18건 / 4,786,416원 중 운영DB 주문 정본과 exact로 붙은 것은 13건 / 3,364,432원이다. exact bridge ROAS는 16.39이고, marker ROAS 23.31은 unresolved 5건을 포함하는 참고값이다.
- unresolved 5건은 ambiguous 2건, no_bridge 3건이다. 예산 판단 전 read-only 원인 분해가 필요하다.
- 상세 원칙은 [[naver-brandsearch-manual-cost-source-policy-20260525]]에 둔다.

## 리포트 원칙

1. Google Ads ROAS는 플랫폼이 주장하는 값이다. 내부 confirmed ROAS와 한 줄에 섞지 않는다.
2. NPay click/count/add_payment_info는 구매완료가 아니다.
3. VirtualAccountIssued는 미입금 가상계좌 발급이다. Purchase가 아니다.
4. 광고비 비중은 광고비 ÷ 내부 confirmed 매출로 계산한다.
5. upload/send/publish 없이 read-only 리포트만 만든다.

## 더클린커피 이후 적용 순서

1. 더클린커피 `reportcoffee`에서 Slack 메시지 형식을 v0.1로 확정한다.
2. 바이오컴 source map을 기준으로 매출 분모와 광고비 분자를 분리한다.
3. Google Ads/Meta/Naver/TikTok별 spend source freshness를 붙인다.
4. 내부 confirmed 매출과 플랫폼 주장 매출의 gap을 함께 표시한다.
5. 첫 no-send preview를 만든다.

## 첫 리포트 성공 기준

- 주간/월간 매출과 광고비가 같은 KST window다.
- 광고비 비중이 전체와 플랫폼별로 분리된다.
- Google Ads upload, GA4/Meta/TikTok/Naver 전송, 운영DB write는 0건이다.
- raw 식별자 출력 0건이다.

## 다음 할일

1. 브랜드검색 unresolved bridge 5건을 분해한다.
   의존성: 주문 단위 bridge preview 완료.
   방법: raw 식별자 출력 없이 hash/count/amount bucket 기준으로 ambiguous 2건과 no_bridge 3건을 source mapping gap, sync lag, duplicate 후보로 나눈다.
   승인 필요 여부: NO for read-only.
   추천 점수/자신감: 88%.

2. 바이오컴 광고비 분자를 산출한다.
   의존성: Google/Meta/Naver/TikTok API 또는 cache read-only 접근. Naver 브랜드검색 비용 reader는 1차 완료.
   방법: 플랫폼별 spend를 KST 주간·월간 window로 맞춘다. Naver 브랜드검색은 `naver_brandsearch_manual_cost_daily`를 읽고, 파워링크/쇼핑검색과 분리한다.
   승인 필요 여부: NO for read-only, platform send/upload는 금지.
   추천 점수/자신감: 84%.

3. 바이오컴 no-send preview를 만든다.
   의존성: 1번과 2번 결과.
   방법: 더클린커피 v0.1 문구를 복사하되, Google Ads 플랫폼 ROAS와 내부 confirmed ROAS를 분리한다.
   승인 필요 여부: preview는 NO, 실제 Slack send는 YES.
   추천 점수/자신감: 82%.
