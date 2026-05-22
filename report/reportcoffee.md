# reportcoffee — 더클린커피 매출액/광고비 비중 리포트

작성 시각: 2026-05-22 14:08 KST
기준일: 2026-05-22
문서 성격: 더클린커피 Slack 주간/월간 리포트 실행 계획
상위 문서: [[!report]]

## 10초 요약

더클린커피는 자사몰, 스마트스토어, 쿠팡을 한 줄로 합치면 안 된다.

자사몰은 Imweb/PG/NPay 데이터 출처(source: 숫자가 나온 원천)가 섞이고, 스마트스토어는 운영DB `tb_playauto_orders shop_name='스마트스토어'`가 더클린커피 상품명 기준으로 더 안전하다. `tb_naver_orders`는 금액은 나오지만 TOP 상품명이 바이오컴 제품이라 더클린커피 primary로 쓰지 않는다. 쿠팡은 현재 coffee 전용 금액 source가 아직 불충분하다. 광고비는 Meta가 먼저 붙고, Naver/Google/TikTok은 캠페인과 사이트를 연결하는 표(mapping: 어떤 광고 캠페인을 어느 브랜드에 붙일지 정하는 표) 또는 API 캐시(화면이 빠르게 읽도록 저장한 내부 테이블)가 필요하다.

최신 dry-run: [[reportcoffee-dry-run-20260521]]
자사몰 dedupe rule: [[reportcoffee-selfmall-dedupe-rule-20260522]]
쿠팡 source readiness: [[reportcoffee-coupang-source-readiness-20260522]]
주간 집계 스크립트: [[reportcoffee-weekly-aggregate-scripts-20260522]]
NPay VM Cloud weekly actual: [[reportcoffee-vm-cloud-npay-weekly-actual-20260522]]
OKR/action plan: [[reportcoffee-okr-action-plan-20260522]]
Slack no-send preview: [[reportcoffee-slack-preview-20260522]]
Naver Ads IP/cache check: [[reportcoffee-naver-ads-ip-cache-check-20260522]]
Naver Ads campaign allowlist dry-run: [[reportcoffee-naver-ads-campaign-allowlist-dry-run-20260522]]
제품별 매출 설계: [[reportcoffee-product-sales-design-20260522]]
스마트스토어 TOP 상품 dry-run: [[reportcoffee-smartstore-product-sales-20260522]]

## 채널별 매출 source 판단

### 1. 자사몰

현재 확인:

- NPay actual 30d: 304건 / 15,538,800원.
- source: VM Cloud `imweb_orders(site='thecleancoffee', pay_type='npay')`.
- status: `included_with_warning`.
- status blank: 4건 / 141,600원. 미결제 단정이 아니라 freshness warning이다.
- Toss `store=coffee`: last_7d 9,611,622원, last_30d 31,444,064원.
- NPay weekly actual: 2026-05-15 - 2026-05-21 KST 기준 72건 / 3,693,400원. VM Cloud SQLite read-only 기준이다.

판단:

- NPay는 현재 live summary API로 30d actual을 가져올 수 있다.
- Toss/카드/가상계좌는 운영DB `tb_sales_toss`를 금액 source로 쓴다.
- `siteConfirmedRevenue`는 광고/유입 ledger 진단값으로 두고 자사몰 매출 합계에는 더하지 않는다.
- 월간 자사몰은 `Toss 31,444,064원 + NPay actual 15,538,800원 = 46,982,864원`을 included with warning으로 둔다.
- 주간 자사몰은 `Toss 9,611,622원 + NPay actual 3,693,400원 = 13,305,022원`을 included with warning으로 둘 수 있다. NPay status blank 4건 / 141,600원은 미결제가 아니라 freshness warning이다.

다음 dry-run:

1. VM Cloud `imweb_orders`에서 NPay 외 결제수단까지 week/month 집계 가능 여부 확인.
2. `tb_sales_toss store=coffee`와 Imweb 결제수단별 매출을 중복 없이 합산하는 rule 설계.
3. source가 겹치면 주문번호/PG key 단위 dedupe rule을 만든다.

### 2. 스마트스토어

현재 확인:

- 운영DB `tb_playauto_orders shop_name='스마트스토어'`: last_7d 2,297,220원, last_30d 8,844,270원.
- 운영DB `tb_naver_orders`: 금액은 나오지만 TOP 상품명이 바이오컴 제품이므로 더클린커피 primary 후보에서 제외.
- 2026-05-22 fresh dry-run: weekly 2,563,520원, month-to-date 6,731,430원, rolling 30d 9,110,570원. 상세는 [[reportcoffee-smartstore-product-sales-20260522]].

판단:

- 스마트스토어 매출은 운영DB `tb_playauto_orders`를 primary 후보로 둔다.
- `tb_naver_orders`는 source conflict다.
- 네이버 광고비와 스마트스토어 매출은 별개다. 스마트스토어 매출이 있어도 Naver Ads ROAS가 자동으로 계산되는 것은 아니다.

다음 dry-run:

1. PlayAuto 스마트스토어 기준 취소/클레임 제외 rule 확인.
2. `shop_sale_name` 기준 TOP 제품 집계.
3. `tb_naver_orders`는 바이오컴 product source로 분리하고 더클린커피 자동 보고에서는 제외한다.

### 3. 쿠팡

현재 확인:

- `/api/coupang/dashboard`는 열리지만 더클린커피 최신 쿠팡 매출 정본으로 바로 쓰기 어렵다.
- public response의 최신 `tb_coupang_orders_rg`는 BIOCOM vendor `A00668577` 중심이다.
- TEAMKETO/coffee 관련 로컬 `coupang_rg_orders_api`는 max paid time이 2026-04-23이라 현재 주간 리포트에는 stale이다.
- 운영DB `tb_sales_coupang`은 2026-04월까지의 정산/업로드 성격이다.
- TeamKeto ordersheets API 주간 aggregate script가 추가됐다. 2026-05-15 - 2026-05-21 KST smoke 기준 41건 / 1,968,100원, coffee hint 1,044,900원, teamketo hint 923,200원이다.
- TeamKeto ordersheets API rolling 30d aggregate도 추가됐다. 2026-04-22 - 2026-05-21 KST 기준 161건 / 7,264,500원, coffee hint 4,417,800원, teamketo hint 2,846,700원이다.

판단:

- 쿠팡은 `TeamKeto ordersheets API included candidate`로 올릴 수 있다.
- PlayAuto는 최신 상품/수량 source지만 금액이 0원이다.
- TeamKeto 계정에 커피와 팀키토 상품이 같이 있으므로 Slack 보고에서는 coffee/teamketo 제품 분류를 같이 표시한다.

다음 dry-run:

1. TEAMKETO ordersheets aggregate를 주간/월간 Slack no-send preview에 연결한다.
2. `tb_sales_coupang.project` 값 중 더클린커피/미분류/영양제 분류 기준 검증.
3. fresh source가 없으면 Slack 리포트에서 쿠팡은 “월간 정산 기준만 제공”으로 표기.

## 광고비 source 판단

### Meta

현재 확인:

- `/api/ads/site-summary?date_preset=last_7d`.
- 더클린커피 Meta spend: 1,952,104원.
- 내부 confirmed revenue: 2,040,491원.
- 내부 ROAS: 1.05.
- Meta 플랫폼 주장 구매값: 7,191,017원, 플랫폼 주장 ROAS 3.68.

판단:

- Meta 광고비는 바로 주간 리포트 후보로 쓸 수 있다.
- 단, 플랫폼 주장 구매값은 내부 매출에 합산하지 않는다.

### Naver

현재 확인:

- VM Cloud `/api/ads/naver/campaign-summary?site=thecleancoffee`는 HTTP 200, configured=true다.
- 다만 `site=thecleancoffee` cache는 empty라 광고비 row가 없다.
- VM Cloud `/api/ads/naver/campaign-summary?site=biocom`은 cache ready다. 2026-04-21 - 2026-05-20 기준 1,110 rows / spend 7,276,795원.
- VM Cloud Naver API dry-run을 `--site=thecleancoffee` label로 실행하면 37 campaigns / 1,110 rows preview가 성공한다. 즉 IP/API는 된다.
- 기존 cache에서 더클린커피 이름 캠페인 6개는 모두 PAUSED이고 같은 기간 spend는 0원이다.
- 2026-05-22 allowlist dry-run에서 더클린커피 후보 6개 / 후보 광고비 0원 / 후보 클릭 0회 / read failure 0개를 확인했다.

판단:

- Naver Ads IP/API는 등록 또는 허용 상태로 보는 것이 맞다.
- 문제는 더클린커피 광고비 캐시 미적재와 캠페인 필터링이다.
- 광고비 수집 스크립트의 `--site=thecleancoffee`는 네이버 API 필터가 아니라 저장 label이다. 쉽게 말해 “더클린커피 캠페인만 가져와라”가 아니라 “가져온 결과를 더클린커피라고 저장해라”에 가깝다.
- 따라서 더클린커피 Naver spend는 현재 확인된 coffee 캠페인 기준 0원으로 볼 수 있지만, 자동 DB 캐시 저장 전에는 “더클린커피 캠페인 6개만 통과시키는 허용 목록 안전장치”가 필요하다.
- Slack 표현은 `Naver: 0원 확인 후보`가 가능하다. 단, `naver_ads_daily(site='thecleancoffee')` 저장은 안전장치 patch와 별도 승인 전까지 금지한다.

### Google / TikTok

현재 판단:

- 더클린커피에 해당하는 campaign/site spend mapping이 확인된 캠페인만 포함해야 한다.
- mapping 전에는 플랫폼 광고비를 더클린커피 매출 분모와 바로 나누지 않는다.

## 제품별 매출 계획

상세 설계: [[reportcoffee-product-sales-design-20260522]]

목표는 채널별 총매출 옆에 “어떤 상품이 그 매출을 만들었는지”를 붙이는 것이다. 총매출만 보면 매출 증감 원인이 채널 문제인지, 상품 문제인지 알 수 없기 때문이다.

1. 스마트스토어: 운영DB `tb_playauto_orders shop_name='스마트스토어'` 기준으로 `shop_sale_name`, `shop_opt_name`, `sale_cnt`, `pay_amt`를 집계한다. PlayAuto는 여러 판매 채널 주문을 한 테이블로 모아 둔 운영DB 수집 원천이다.
2. 쿠팡: TeamKeto ordersheets API 기준으로 `top_products`를 쓴다. ordersheets API는 쿠팡 판매자 주문서에서 상품명, 수량, 금액을 읽는 공식 통로다. TeamKeto 계정에는 커피와 팀키토 상품이 섞여 있으므로 coffee 상품만 strict 매출에 붙이고 teamketo 상품은 참고로 분리한다.
3. 자사몰: VM Cloud `imweb_order_items(site='thecleancoffee')`와 `imweb_orders`를 주문 단위로 맞춘다. Imweb order items는 한 주문 안에 들어 있는 상품별 행이다. freshness가 낮거나 금액이 안 맞으면 자사몰 TOP 상품은 `cross-check` 또는 `pending`으로 표시한다.

스마트스토어 TOP 상품 dry-run은 완료됐다. 2026-05-15 - 2026-05-21 KST TOP3는 방탄커피 840ml 10개 464,600원, 콜롬비아 스페셜티 406,710원, 에티오피아 구지 사키소 G1 398,900원이다.

다음 실행 순서는 쿠팡 TOP 상품 Slack preview 연결, 자사몰 상품 라인 freshness 확인이다.

## 주요 매출 유입경로 계획

source:

- VM Cloud `site_landing_ledger`: 방문/랜딩 source.
- VM Cloud `attribution_ledger`: checkout/payment_success source.
- `/api/acquisition/channel-analysis`: broad 분석 API.

주의:

- `Naver 검색/쇼핑` broad label은 paid/organic 정본이 아니다.
- `NaPm` 단독 paid 금지.
- checkout/add_payment_info는 구매완료가 아니다.

## 첫 리포트 성공 기준

- 주간: 최근 완료 주 월요일 - 일요일 KST.
- 월간: 캘린더 월 KST.
- 매출: 자사몰, 스마트스토어, 쿠팡을 분리.
- 광고비: Meta는 포함, Naver/Google/TikTok은 source 준비 상태에 따라 included/pending 표시.
- 광고비 비중: `included 광고비 / included 내부 confirmed 매출`.
- raw 식별자 출력 0건.
- Slack 실제 발송 0건, 먼저 no-send preview.

## 다음 할일

1. 스마트스토어 TOP 상품 aggregate를 만든다.
   결과: Slack 보고에 채널별 매출뿐 아니라 제품별 매출도 붙일 수 있다.
   의존성: 운영DB read-only 접근.
   참고 문서: [[reportcoffee-product-sales-design-20260522]]
   진행 상태: [[reportcoffee-smartstore-product-sales-20260522]] 완료.
   추천 점수/자신감: 92%.

2. Naver Ads blocker를 source pending 카드로 줄인다.
   결과: TJ님이 해야 할 IP/API 액션이 `VM Cloud IP 등록` 하나로 좁혀진다.
   추천 점수/자신감: 82%.

3. Slack 실제 발송 승인안을 만든다.
   결과: TJ님이 채널/주기만 정하면 실제 발송 여부를 YES/NO로 판단할 수 있다.
   의존성: no-send preview 확인.
   추천 점수/자신감: 76%.
