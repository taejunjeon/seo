# reportbiocom — 바이오컴 매출액/광고비 비중 리포트

작성 시각: 2026-05-23 12:45 KST
기준일: 2026-05-23
문서 성격: 바이오컴 Slack 주간/월간 리포트 후속 계획
상위 문서: [[!report]]
최신 source map: [[reportbiocom-source-map-20260523]]
공통 다음 임팩트 계획: [[report-v0.1-readiness-and-next-impact-plan-20260523]]
광고비 source gap 계획: [[report-ad-spend-source-gap-plan-20260523]]

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
- Naver: Naver Search Ad API 또는 `naver_ads_daily`, paid/organic 분류 패치 운영 반영 필요.
- TikTok: TikTok Business API 또는 local cache, freshness 경고 필요.

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

1. 운영DB 결제완료 기준 바이오컴 매출 분모를 산출한다.
   의존성: 운영DB read-only 접근.
   방법: `tb_iamweb_users PAYMENT_COMPLETE` 기준으로 주간·월간 매출과 NPay actual을 분리한다.
   승인 필요 여부: NO for read-only.
   추천 점수/자신감: 88%.

2. 바이오컴 광고비 분자를 산출한다.
   의존성: Google/Meta/Naver/TikTok API 또는 cache read-only 접근.
   방법: 플랫폼별 spend를 KST 주간·월간 window로 맞춘다.
   승인 필요 여부: NO for read-only, platform send/upload는 금지.
   추천 점수/자신감: 84%.

3. 바이오컴 no-send preview를 만든다.
   의존성: 1번과 2번 결과.
   방법: 더클린커피 v0.1 문구를 복사하되, Google Ads 플랫폼 ROAS와 내부 confirmed ROAS를 분리한다.
   승인 필요 여부: preview는 NO, 실제 Slack send는 YES.
   추천 점수/자신감: 82%.
