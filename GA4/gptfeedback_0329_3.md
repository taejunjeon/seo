SEO → 전환 퍼널에서 유입보다 전환 숫자가 많아지는 이유와 확인법

이건 대부분 버그처럼 보이지만, 절반은 측정 정의 문제입니다.
바이오컴 현재 상황에서는 특히 아래 6가지를 먼저 봐야 합니다.

1. 세션과 이벤트를 섞어서 보고 있을 가능성
GA4에서 session은 사용자의 방문 묶음이고, event count는 이벤트가 발생한 총 횟수입니다. key event도 “몇 번 발생했는가”를 셉니다. 그래서 sessions 100, purchase 120 같은 일이 완전히 불가능한 건 아닙니다. 한 세션 안에서 여러 key event가 생길 수 있기 때문입니다. GA4 공식 문서도 session과 key event는 성격이 다르다고 설명합니다.

2. User acquisition과 Traffic acquisition을 섞었을 가능성
GA4는 First user source와 Session source의 범위가 다릅니다. Google도 이 둘의 값을 직접 비교하면 안 된다고 안내합니다. SEO 유입을 볼 때는 보통 Traffic acquisition의 Session source / medium 또는 Session default channel group = Organic Search 기준으로 보는 게 맞습니다.

3. Page path만 보고, query string을 버리고 있을 가능성
이건 바이오컴에서 특히 중요합니다. 실제 상품상세는 /shop_view/?idx=...인데, GA4의 Page path는 query string을 떼어냅니다. 반면 Landing page는 첫 pageview의 page path + query string을 씁니다. 즉 SEO 랜딩을 제품 단위로 보려면 Page path가 아니라 Landing page + query string 또는 Page path + query string을 써야 합니다. 그렇지 않으면 윗단 유입은 뭉개지고, 아랫단 전환은 따로 잡혀서 퍼널이 이상해집니다.

4. cross-domain 또는 PG 리다이렉트 때문에 세션이 끊겼을 가능성
현재 공개 홈 안에서 이미 biocom.kr, www.biocom.kr, biocom.imweb.me가 섞여 있습니다. GA4는 cross-domain 설정이 없으면 서로 다른 루트 도메인 이동 때 새 쿠키와 새 세션을 만들 수 있다고 명시합니다. 지금 문서상 not_set 채널 매출이 1.3억, landing (not set)이 15.9%, real funnel purchase가 끊기는 건 이 문제와 잘 맞습니다. 제 판단으로는 Biocom에서 제일 먼저 확인할 항목이 이겁니다.

5. landing page (not set) 때문에 분모가 줄어들고 있을 가능성
GA4 공식 문서에 따르면 landing page가 (not set)으로 뜨는 대표 원인은 세션에 page_view가 없을 때입니다. 현재 문서상 이 비율이 15.9%면, SEO 랜딩 퍼널의 윗단이 이미 일부 사라지고 있을 수 있습니다.

6. purchase 중복 또는 transaction_id 문제
GA4는 같은 transaction_id를 가진 purchase는 deduplicate합니다. 반대로 transaction_id가 빠지거나 이상하면 purchase 집계가 왜곡될 수 있습니다. 결제 퍼널을 볼 때는 purchase event 수만 보지 말고 실제 주문번호 기준 중복 여부를 같이 봐야 합니다.

그리고 한 가지 더 있습니다.
GA4 Path exploration은 하나 이상의 세션을 가로질러 경로를 계산할 수 있습니다. 그래서 path 화면을 “같은 세션 안의 퍼널”처럼 해석하면 later step이 더 커 보일 수 있습니다. path는 행동 흐름을 보는 용도이고, 전환률 퍼널은 funnel report나 같은 scope의 테이블로 따로 봐야 합니다.

7) 실제 확인 순서

가장 실무적으로는 이 순서가 맞습니다.

1단계 - 같은 범위로 다시 만든다
GA4 Explore에서

Dimension: Session default channel group, Session source / medium, Landing page + query string
Filter: Session default channel group = Organic Search
Metrics: Sessions, Entrances, Ecommerce purchases, Key events, Total revenue

이렇게 먼저 만드세요.
Search Console 클릭을 같이 보려면 Google 공식 문서대로 Landing page + query string 축으로 맞추는 게 안전합니다. Search Console metrics는 호환 가능한 차원이 제한돼 있습니다.

2단계 - /shop_view를 제품 단위로 쪼갠다
Page path가 아니라 Page path + query string 또는 Landing page + query string으로 보세요.
그래야 /shop_view/?idx=264와 /shop_view/?idx=266이 따로 보입니다.

3단계 - live purchase를 1건 직접 태워 본다
DebugView 또는 Realtime으로 실제 구매 1건을 태워서 아래를 확인하세요.

view_item
add_to_cart
begin_checkout
add_payment_info
purchase
결제 전후 source/medium 변화
referral domain 유입 여부
transaction_id 존재 여부

현재 문서의 real funnel이 purchase 0으로 끊기는 걸 보면, 이 테스트는 필수입니다.

4단계 - cross-domain 설정 화면을 점검한다
GA4 Configure your domains에 최소한 아래가 들어가야 합니다.

biocom.kr
www.biocom.kr
biocom.imweb.me
실제 사용하는 PG 완료 도메인

공식 문서상 이 설정이 없으면 세션과 사용자 수가 분리될 수 있습니다.

5단계 - order 기준으로 중복을 본다
가능하면 주문번호 기준으로 transaction_id 유니크 건수를 보고, GA4 purchase 수와 대조하세요.
이걸 안 보면 “전환이 많다”가 실제 매출인지, 이벤트 중복인지 구분이 안 됩니다.