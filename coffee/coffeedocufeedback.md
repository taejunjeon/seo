2026-04-04 기준으로 보면, **정합성은 충분히 더 올릴 수 있습니다.**
지금 가장 큰 문제는 “데이터가 없어서”라기보다 **같은 말을 다른 정의로 쓰는 것**, 그리고 **현재 상태와 과거 메모가 한 문서에 같이 들어 있는 것**이에요. `coffeedata.md`는 2026-04-04 운영 스냅샷에 가깝고, `coffee.md`는 0401/0402/0404 메모가 누적된 조사 로그 성격이 강합니다.  

제가 봤을 때 먼저 손봐야 하는 건 5가지예요.

1. **문서 기준일/상태를 분리해야 합니다.**
   같은 `coffee.md` 안에 예전 상태와 최신 상태가 같이 살아 있습니다. 예를 들어 예전 구간에는 `GA4 권한 없음`, `커피 site_code 별도 확인 필요`가 남아 있는데, 뒤쪽 0404 업데이트와 `coffeedata.md`에서는 `GA4 해결`, 로컬 sync 1,150건, live payment_success 20건, site 코드 `thecleancoffee`가 이미 반영돼 있어요. 또 `imwebreport.md`는 2026-04-01 검증 시점에 “푸터 코드 없음”으로 적혀 있는데, `coffeedata.md`는 2026-04-04 시점에 푸터 코드를 통한 payment_success 수집을 설명합니다. 틀렸다기보다 **날짜별 상태 변화가 한 덩어리로 섞인 것**이라, 읽는 사람이 쉽게 헷갈립니다.   

2. **숫자가 서로 충돌하는 구간이 있습니다. 이건 바로 재계산해야 합니다.**
   `coffee.md` 안에서 Toss+PlayAuto 크로스 조인 결과가 한 곳에서는 **고객당 평균 LTR 98,112원**으로 나오고, 다른 곳에서는 같은 517명 매칭/재구매율 20.9% 맥락에서 **평균 LTR 58,383원**으로 적혀 있어요. 둘 중 하나는 분모·기간이 다르거나, 숫자가 잘못 붙은 겁니다. 또 PlayAuto 전체 요약에서는 **재구매 고객 1,528명**인데, “첫 구매→2회차 구매까지 걸린 일수” 구간에서는 **재구매 고객 수 2,735명**으로 나옵니다. 이건 현재 라벨 기준으로는 같이 성립하기 어렵습니다. 최소한 `고객 수`인지, `재구매 이벤트 수`인지, `bundle 기준`인지 다시 명시해야 해요. 

3. **같은 이름의 KPI가 서로 다른 뜻으로 쓰이고 있습니다.**
   지금 문서에는 `재구매율 21.7%`(PlayAuto, 2025 전체, 전화번호·bundle 기준), `재구매율 9.4%`(로컬 Imweb, 최근 4개월, 회원/주문 기준 근사치), `재방문 매출 비중 48.3%`(GA4, 2025, 쿠키/세션 기반)가 같이 있습니다. 셋 다 의미는 있지만 **같은 레벨의 “재구매율”이 아니에요.** 그래서 앞으로는 그냥 “재구매율”이라고 쓰지 말고, 예를 들어 `repeat_customer_rate_playauto_2025`, `repeat_member_rate_imweb_recent`, `returning_revenue_share_ga4_2025`처럼 이름에 소스/기간/단위를 같이 넣는 게 좋습니다.  

4. **키 정의가 모호합니다. 특히 `site code`가 위험해요.**
   문서상 `site 코드 thecleancoffee`, `IMWEB_SITE_CODE 별도 확인 필요`, `S20190715619285c855898` 같은 값이 모두 등장합니다. 이건 아마 각각 **내부 slug**, **커피용 환경변수**, **바이오컴 Imweb 공식 site code**일 가능성이 큰데, 지금은 모두 “site code”라고 불려서 헷갈립니다. 여기서는 컬럼/변수 이름을 아예 갈라야 합니다. 예를 들면 `site_slug=thecleancoffee`, `imweb_site_code=S...`, `brand_key=coffee`처럼요. 이거 안 나누면 나중에 sync나 join에서 실수 납니다.  

5. **트래킹/태깅 정합성도 손볼 포인트가 있습니다.**
   `imwebreport.md` 기준으로 Beusable이 헤더와 바디에 2번 들어가 있고, Google Ads 장바구니 전환은 `endsWith('shop_cart')` 같은 취약한 URL 조건에 의존하고 있어요. Keepgrow도 같이 들어가 있어서 CRM 도구 역할이 겹칩니다. 구조상 이벤트 중복이나 누락이 생길 여지가 있으니, **GTM / 하드코드 / Keepgrow / 알리고 / 채널톡** 각각이 어떤 이벤트를 담당하는지 한 번 정리하는 게 좋습니다. 

정합성을 올리려면, 저는 이 순서가 제일 효과적이라고 봅니다.

**첫째, `coffeedata.md`를 “현재 기준 문서”로 고정**하고, `coffee.md`는 `research_log`나 `changelog`로 역할을 바꾸세요. 지금처럼 한 파일에 과거/현재/가설/전략이 다 섞여 있으면 계속 숫자 충돌이 납니다.  

**둘째, KPI 사전을 하나 만드세요.**
각 지표마다 아래 7개만 붙이면 정합성이 확 올라갑니다.

* `metric_name`
* `source_of_truth`
* `grain` (customer / order / bundle / session)
* `coverage_start`, `coverage_end`
* `customer_key` 또는 `join_key`
* `exclusions`
* `confidence` (high / medium / low)

예를 들면:

* 매출/취소/수수료: **Toss**
* 고객 식별/동의/주문 원장: **Imweb**
* 상품 구성/출고/전화번호 proxy: **PlayAuto**
* 신규/재방문/세션: **GA4**
* 유입별 결제 성공 로그: **Attribution ledger**
  이렇게 “소스별 주권”을 고정하면 같은 숫자를 가지고 싸울 일이 많이 줄어듭니다. 현재도 문서 안에 이 방향은 이미 보입니다.  

**셋째, `order_bridge` 테이블을 두는 게 좋습니다.**
지금 자료만 봐도 조인 키 후보가 많습니다: Imweb의 `order_no/order_code`, Toss의 `order_id/payment_key`, PlayAuto의 `shop_ord_no/bundle_no`, Attribution의 `orderId/paymentKey`. 이걸 매번 분석할 때마다 ad hoc으로 붙이지 말고,
`bridge_order(order_uid, brand_key, imweb_order_no, toss_order_id, toss_payment_key, playauto_shop_ord_no, attribution_order_id, join_confidence)`
같은 식으로 미리 연결해 두면 재구매/LTR/캠페인 성과를 훨씬 안정적으로 볼 수 있어요. `coffee.md`도 결국 이 방향을 계속 말하고 있습니다. 

**넷째, 일일 정합성 체크를 자동화하세요.**
추천하는 체크는 4개예요.

* Toss `payment_key` unique 위반 수
* Imweb `order_no` unique 위반 수
* 하루 매출 합계: Toss vs Imweb 차이
* 조인 매칭률: Imweb↔Toss, Toss↔PlayAuto, Attribution↔Toss

여기에 “경고 임계치”만 두면, 숫자 어긋나는 걸 문서에서 뒤늦게 발견하지 않고 배치 단계에서 바로 잡을 수 있습니다.


한 줄로 정리하면 이렇습니다 🙂
**지금은 “데이터 수집”보다 “정의·문서·조인키 정리”가 우선입니다.**
제일 먼저 할 일은
`1) coffee.md를 current/changelog로 분리` → `2) LTR 98,112 vs 58,383 / 재구매고객 1,528 vs 2,735 재산출` → `3) site code 명칭 분리` → `4) Beusable·GTM·Ads 태깅 중복 점검`
이 4개예요. 이거만 정리해도 보고서 신뢰도가 확 올라갑니다.
