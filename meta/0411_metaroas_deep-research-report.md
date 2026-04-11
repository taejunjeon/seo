# Meta Ads Manager의 purchase ROAS가 내부 주문 원장 ROAS보다 높게 나오는 원인 분석

## 핵심 결론과 우선순위

### 10초 요약
지금 격차는 “Meta는 **구매 이벤트(Purchase)** 를 기준으로 **7일 클릭 + 1일 조회(뷰)** 같은 넓은 창에서 광고 공헌을 잡는 반면, 내부 원장은 **결제완료(confirmed)** 와 **UTM·fbclid 기반 규칙**에 의존해 **신호가 많이 빠지는 구조**라서 생긴 문제일 가능성이 큽니다. 특히 **Meta 구매 수(525)가 내부 confirmed 주문 수(383)보다 많다**는 점은, 단순 attribution 차이만으로 설명이 안 되고 **중복 전송/중복 발생(또는 내부 confirmed 정의 차이)** 를 강하게 의심해야 합니다. citeturn9view2turn9view1turn15view0turn23search2

### 원인 3가지
- **Attribution 창(7일 클릭 + 1일 조회) 차이**
  - 무슨 일인지: Meta는 클릭 후 며칠 뒤 구매, 클릭 없이 “보기만 한” 뒤 구매도 잡습니다. citeturn23search2turn12search6
  - 왜 문제인지: 내부 원장은 결제완료 시점의 UTM·fbclid가 비면 공헌을 못 잡고, 조회 기반 공헌은 구조상 거의 못 잡습니다. citeturn6view0turn23search2
  - 결과 영향: Meta 기본값이 1d_click보다 크게 높아지고(현재도 그렇게 보임), 내부는 Meta 공헌을 과소로 봅니다.

- **Purchase 이벤트와 내부 “confirmed 주문”의 정의 불일치 + 이벤트 중복**
  - 무슨 일인지: Meta의 웹 구매는 픽셀/서버로 들어온 **Purchase 이벤트**를 기반으로 집계되고, 한 주문에 Purchase가 2번 이상 들어오면 그대로 늘어날 수 있습니다. citeturn9view2turn9view1turn15view0
  - 왜 문제인지: 브라우저 이벤트 2번, 서버 이벤트 2번 같은 “같은 채널 내 중복”은 자동으로 줄여주지 않습니다. 픽셀·서버를 같이 쓰는 경우도 event_id가 제대로 맞지 않으면 중복이 남습니다. citeturn9view1turn15view0
  - 결과 영향: Meta 구매 수가 실제 주문 수(confirmed)보다 커지는 현상이 발생합니다(지금 데이터가 이 패턴).

- **식별자(fbp/fbc)·고급 매칭(해시)·세션 끊김으로 내부가 신호를 잃는 문제**
  - 무슨 일인지: Meta는 `_fbc`(클릭 ID)·`_fbp`(브라우저 ID) 같은 쿠키와(또는 해시된 고객 정보)로 “어떤 광고를 본/클릭한 사람인지”를 매칭합니다. citeturn6view0turn17search0
  - 왜 문제인지: 내부는 결제완료 페이지에서만 utm/fbclid를 회수하면, 결제 도중 리다이렉트·도메인 이동·세션 재시작에서 값이 날아갑니다. GA4도 도메인 이동 시 쿠키 ID 전달 설정이 필요하다고 명시합니다. citeturn22search1turn6view0
  - 결과 영향: 내부 “Meta-attributed confirmed”가 실제보다 작게 잡힙니다(표에서도 **UTM/fbclid 빈 주문 129건**이 이미 큰 경고 신호).

### 해결 액션 3단계
- **지금 당장(오늘)**: “Meta 구매 수가 내부 confirmed보다 큰 이유”부터 잡습니다.
  1) 이벤트 관리자에서 최근 2-3일 주문을 샘플링해 **주문 1건당 Purchase 이벤트가 몇 번 들어오는지** 확인
  2) 픽셀·CAPI 동시 사용이면 **event_id가 양쪽에 동일하게 들어가는지** 확인(없거나 다르면 중복 가능성 급상승) citeturn9view1turn15view0
- **이번 주**: 내부 원장 attribution 신호를 “결제완료 한 번”이 아니라 “유입 시점부터” 잡도록 구조를 바꿉니다.
  - 랜딩 시점에 fbclid → `_fbc` 생성/보관, `_fbp`도 보관, UTM은 첫 유입/마지막 유입을 모두 서버에 저장(주문과 조인). citeturn6view0
  - 결제 플로우가 다른 도메인으로 이동하면 GA4/내부도 **도메인 간 식별자 유지**가 필요합니다. citeturn22search1
- **다음 배치**: “같은 기준으로 비교 가능한 리포트”를 만듭니다.
  - Meta는 1d_click(그리고 가능하면 7d_click)로 고정한 비교 뷰를 만들고, 내부도 같은 룰(예: 클릭 후 1일·7일)로 재집계해서 사후 검증 루프를 만듭니다. citeturn23search2turn12search6

## Meta purchase ROAS가 계산되는 방식

Meta에서 “purchase ROAS”는 한 줄로 요약하면 **(광고에 귀속된 구매 금액) / (광고비)** 입니다. Meta 도움말에서도 “구매 전환 가치”를 “지출 금액”으로 나눈 값으로 ROAS를 정의합니다. citeturn0search35

문제는 여기서 “광고에 귀속된 구매 금액”을 무엇으로 보느냐인데, API 관점에서 두 가지를 꼭 구분해야 합니다.

- **purchase_roas**: “구매로부터의 ROAS”인데, **연결된 비즈니스 도구들에서 들어온 정보**를 바탕으로 광고에 귀속됩니다. (웹사이트만이 아니라 연결된 도구 범위가 더 넓을 수 있습니다.) citeturn9view2
- **website_purchase_roas**: “웹사이트 구매 ROAS”로, **웹사이트에서 픽셀로 기록된 전환 가치**를 기반으로 광고에 귀속됩니다. citeturn9view2

즉, 지금 여러분이 보고 있는 값이 **purchase_roas인지 website_purchase_roas인지**만 달라도, 내부 원장(웹 주문 원장)과의 괴리가 커질 수 있습니다. citeturn9view2

또 하나의 핵심은 “구매 이벤트(Purchase)”의 정의입니다. Meta 픽셀 문서에서 Purchase는 **구매/결제 흐름이 완료되고 확인(감사) 페이지에 도달**했을 때 트리거되는 표준 이벤트로 설명되고, 이 이벤트에는 **currency와 value가 필수**입니다. citeturn15view0
내부 원장이 “confirmed(확정)”를 결제 직후가 아니라 검증/확정 후로 잡는 구조라면, Meta의 Purchase 이벤트 기반 집계와 **타이밍·포함 범위가 달라질 수밖에 없습니다**(취소·환불·중복 결제 시나리오 포함). citeturn15view0

마지막으로 attribution window(전환을 “언제까지 광고 덕분”으로 볼지)는 **광고세트(ad set) 수준에서 선택되는 설정**이었고, Meta는 API에서도 “광고세트 수준 attribution 설정(attribution_setting)”과 “통합된 attribution 설정(use_unified_attribution_setting)”을 중심으로 동작하도록 바꿔 왔습니다. 또한 API에서 액션 attribution window를 명시하지 않으면 기본값으로 **7d_click + 1d_view**를 사용한다고 공식 개발자 공지에 명시돼 있습니다. citeturn12search6
(여러분이 말한 “대부분 7일 클릭 + 1일 조회”는 이 기본값과 정합성이 높습니다.)

## Attribution window별로 내부 ROAS와 엇갈리는 이유

여기서는 “왜 7일 클릭 + 1일 조회가 내부보다 크게 나오고, 1d_click만 보면 줄어드는지”를 구조적으로 설명합니다. (아래의 수치 예시는 사용자가 제공한 최근 7일 데이터 기준입니다.)

### 7일 클릭 + 1일 조회가 커지는 이유
Meta는 “클릭 기반”과 “조회 기반”을 분리해 정의합니다.
- 클릭 기반: 광고 링크를 클릭한 뒤 **1일 또는 7일** 안에 일어난 이벤트를 귀속 citeturn23search2
- 조회 기반: 클릭 없이 광고를 보기만 한 뒤 **1일** 안에 일어난 이벤트를 귀속 citeturn23search2

이 설정을 쓰면, 사용자가 “오늘 클릭 → 3일 뒤 재방문 후 구매”처럼 **늦게 구매해도** Meta는 귀속을 잡습니다. 내부 원장이 결제완료 시점의 UTM/fbclid만 보고 귀속을 잡는다면, 그 3일 뒤 구매 세션에는 UTM이 없을 가능성이 큽니다(특히 로그인/재방문/즐겨찾기/직접 유입). 그 순간 내부는 “Meta 공헌 없음”으로 떨어질 수 있습니다. 반면 Meta는 `_fbc`/`_fbp` 같은 쿠키 기반 식별로 같은 사람의 나중 구매를 연결할 수 있습니다. citeturn6view0turn23search2

여러분 데이터에서 Meta 기본값(525 purchases)과 Meta 1d_click(295 purchases)의 차이는 **230 purchases**입니다. 이 230은 대체로 “1일을 넘어선 클릭 후 구매”와 “1일 조회 후 구매”에서 발생한 값이라고 해석하는 게 자연스럽습니다(추론). citeturn23search2turn12search6

### 1d_click이 내부보다 여전히 크게 나올 수 있는 이유
1d_click은 분명 더 보수적이지만, 내부 규칙이 “fbclid가 있어야 Meta로 잡는다” 같은 형태라면, 1d_click조차 내부보다 클 수 있습니다. 이유는 간단합니다. Meta는 URL의 fbclid만 보는 게 아니라, `_fbc`(클릭 ID 쿠키), `_fbp`(브라우저 ID 쿠키), 그리고 서버 이벤트의 고객 정보(해시 포함)를 조합해 매칭하기 때문입니다. citeturn6view0turn17search0

현재 내부 원장 분포를 보면 **confirmed 중 utm/fbclid가 비어 있는 주문이 129건(전체 383건 중 약 3분의 1)** 입니다. “실제는 Meta 클릭에서 왔는데 결제완료 시점에 파라미터가 날아갔다” 같은 케이스가 섞여 있을 확률이 높습니다(추론). 이 경우 Meta 1d_click은 여전히 잡히지만 내부는 못 잡습니다. citeturn6view0turn23search2

또 하나의 흔한 원인은 “결제 과정에서 다른 도메인으로 이동”입니다. GA4 문서도 도메인이 바뀌면 쿠키 ID를 URL 파라미터로 전달해 **하나의 사용자/세션으로 유지**해야 한다고 설명합니다. 이런 장치가 없으면 “결제완료 페이지에서만 수집”하는 방식은 세션이 끊기기 쉽고, UTM·fbclid가 비는 주문이 늘어납니다. citeturn22search1

### 1d_view는 내부와 거의 개념이 다르다
1d_view는 “클릭 없이 봤는데 1일 안에 구매”까지 잡습니다. citeturn23search2
내부 원장이 클릭 식별(utm/fbclid)로만 귀속하는 구조라면, 1d_view는 내부와 **애초에 교집합이 작을 수밖에 없습니다**. 그래서 Meta 기본값(7일 클릭 + 1일 조회)이 내부보다 크게 튀는 건, 어느 정도는 “정상적인 정의 차이”입니다.

## ROAS 과대계상을 만드는 추적과 전송 이슈

여기부터는 “정의 차이”를 넘어, **Meta 숫자가 실제보다 커지는** 전형적인 기술 원인들입니다. 지금 상황에서 특히 중요한 건 “Meta 구매 수가 내부 confirmed 수보다 많다”는 점이라, 아래 항목을 우선순위 높게 봐야 합니다.

### 픽셀과 CAPI 중복 전송과 dedup 실패

entity["company","Meta","social media company"] 개발자 문서는 “픽셀과 전환 API를 함께 쓰는 중복 설정”에서 dedup(중복 제거)을 하려면 **event_id를 브라우저 픽셀과 서버 이벤트에 모두 넣는 방식**을 권장합니다. 또한 dedup은 **event_name과 fbp 및/또는 external_id 조합**을 비교해 수행하며, 서버 이벤트와 브라우저 이벤트의 내용 차이가 크지 않으면 “먼저 도착한 이벤트”가 선호된다고 설명합니다. citeturn9view1

중요한 함정이 2개 있습니다.

- **48시간 룰**: 브라우저 이벤트를 최근 48시간 안에 받지 못한 상태에서 나중에 들어오면 서버 이벤트는 삭제되지 않을 수 있습니다. citeturn9view1
- **같은 채널 내 중복은 안 줄여줌**:
  - 브라우저 이벤트를 같은 내용으로 연속 2번 보내면 한 쪽을 삭제하지 않습니다.
  - 서버 이벤트를 같은 내용으로 연속 2번 보내도 한 쪽을 삭제하지 않습니다. citeturn9view1

즉, “픽셀 1번 + 서버 1번”만으로 끝나지 않고,
- 결제완료/감사 페이지가 새로고침 되며 픽셀 Purchase가 2번 나가거나(추론),
- 서버가 네트워크 오류로 재시도하면서 Purchase를 중복 전송하거나(추론),
- event_id가 매번 새로 만들어져서 dedup이 매칭을 못 하거나(추론),
이런 조합이 나오면 Meta 구매 수가 실제보다 커질 수 있습니다. 이건 현재 “525 purchases vs 383 confirmed” 같은 패턴과 매우 잘 맞습니다. citeturn9view1

### event_id를 픽셀에 넣지 않거나, 픽셀·서버가 서로 다른 event_id를 쓰는 문제

Meta 픽셀 표준 이벤트 문서에서도, 픽셀과 전환 API를 같이 구현할 때는 `fbq('track')`의 네 번째 인자로 **eventID를 포함하라고 권장**합니다. citeturn15view0
이게 안 되면 “브라우저 1번 + 서버 1번”이 그대로 2번으로 집계될 가능성이 커집니다. citeturn9view1turn15view0

### 구매 금액(value) 정의가 내부 매출과 다를 수 있음

Purchase 이벤트는 `currency`와 `value`가 필수이고, Meta는 이 값(전환 가치)을 모아 ROAS를 계산합니다. citeturn15view0turn0search35
내부 원장 매출이 “확정 매출(할인/쿠폰 반영 후, 일부 비용 제외)”인데, Purchase value가 “정가/배송비/세금 포함” 등으로 들어가면 Meta purchase value가 내부보다 커질 수 있습니다(추론). 지금은 1.34배 정도로 과격하진 않지만, **중복 이벤트 + value 정의 차이**가 같이 있으면 충분히 커질 수 있습니다. citeturn15view0turn9view1

### fbp/fbc와 고객 정보(고급 매칭)가 “귀속을 더 잘 잡게” 만드는 효과

전환 API의 고객 정보 매개변수 문서에 따르면:
- `fbc`(클릭 ID)는 도메인 아래 `_fbc` 쿠키에 저장되며, `fbclid` 쿼리 파라미터에서 생성할 수 있습니다. citeturn6view0
- `fbp`(브라우저 ID)는 `_fbp` 쿠키에 저장됩니다. citeturn6view0
- 웹 이벤트를 서버로 보낼 때 `client_ip_address`, `client_user_agent` 같은 값은 이벤트 매칭 개선과 캠페인 전송 개선에 도움이 된다고 명시돼 있습니다. citeturn6view0

그리고 Dataset Quality API 문서는 EMQ(이벤트 매칭 품질)가 “서버에서 보낸 고객 정보가 Meta 계정과 이벤트 인스턴스를 매칭하는 데 얼마나 효과적인지”를 나타내는 점수(10점 만점)라고 설명합니다. citeturn17search0turn17search1

이건 “Meta가 과장한다”라기보다, Meta가 **자기 시스템 안에서 귀속을 더 많이 연결할 수 있는 능력**을 가진다는 뜻입니다. 내부 원장이 URL 파라미터만 보고 있으면, Meta가 잡는 만큼 내부가 못 잡는 구조가 됩니다.

## 내부 주문 원장 ROAS가 과소계상되는 대표 원인

여러분 표에서 이미 과소계상의 징후가 매우 강합니다. 내부 confirmed 383건 중 **129건이 utm/fbclid 빈 주문**입니다. 이건 “내부 attribution 엔진이 일을 못 하는 구간”이 3분의 1이라는 뜻입니다.

### 결제완료 페이지에서만 UTM·fbclid를 수집하는 구조적 한계

결제 플로우가 길거나, 중간에 리다이렉트가 있거나, 도메인이 바뀌면 UTM과 click id(예: fbclid)는 쉽게 사라집니다. 이런 상황에서 GA4도 **cross-domain measurement**를 설정해 쿠키 ID를 `_gl` 파라미터로 전달해야 “한 사용자/한 세션”으로 인식된다고 설명합니다. citeturn22search1

즉, 내부 원장이 결제완료 페이지에서 `ga_session_id`, `client_id`를 읽고 있더라도, 결제 과정에서 도메인·세션이 끊기면 “유입 정보가 결제완료에 도달하지 않는” 케이스가 늘 수 있습니다(추론). citeturn22search1

### fbclid가 없으면 내부 규칙에서 빠지는 문제

Meta 문서 기준으로, fbclid와 연결되는 핵심 식별자는 결국 `_fbc`(쿠키)이며 Conversions API에서도 `fbc`를 주요 매개변수로 다룹니다. citeturn6view0
그런데 내부 규칙이 “fbclid가 있어야 Meta”라면,
- 유입 때 fbclid가 있었는데 결제완료 때는 없어졌거나
- 앱 내 브라우저/리다이렉트/캐시 등으로 URL 파라미터가 유실됐거나(추론)
이런 케이스가 깔끔하게 전부 “unknown”으로 떨어집니다.

표의 “`meta...` 또는 `instagram...` source지만 fbclid가 없어 빠진 주문 4건”은 아주 작은 숫자지만, **같은 패턴이 ‘utm/fbclid 빈 주문 129건’ 안에 더 있을 가능성**이 큽니다(추론). citeturn6view0

### 내부가 “confirmed”를 기준으로 잡아서 Meta와 분모가 달라지는 문제

Meta 픽셀문서에서 Purchase는 “구매/결제 흐름 완료 후 확인 페이지 도달”을 기준으로 합니다. citeturn15view0
내부 confirmed는 보통 더 보수적입니다(검증 완료, 취소 제외, 환불 제외 같은 규칙). 그래서:
- Meta의 Purchases > 내부 confirmed orders
가 어느 정도는 정상일 수 있습니다. 다만 지금은 격차가 크고(525 vs 383) 내부 전체 매출보다 Meta purchase value가 크기까지 해서, “정의 차이”만으로는 부족하고 **중복 이벤트**까지 같이 봐야 합니다. citeturn15view0turn9view1

## 차이를 줄이는 실행 체크리스트

아래는 “Meta 숫자를 맞추기”가 아니라 **양쪽을 같은 기준으로 비교 가능하게** 만드는 실무 체크리스트입니다.

### 리포트 기준부터 맞추기
- Meta에서 보고 있는 컬럼이 **purchase_roas**인지 **website_purchase_roas**인지 먼저 확정하세요. 웹 주문 원장과 비교하는데 purchase_roas를 쓰면, 연결된 다른 도구의 구매까지 섞일 수 있습니다. citeturn9view2
- API로 끌어오는 값이면, attribution window를 명시하거나(예: 1d_click) “기본값이 7d_click + 1d_view”임을 전제로 해석해야 합니다. citeturn12search6

### Purchase 이벤트 중복을 “주문 단위”로 제거
- 픽셀과 CAPI를 같이 쓰는 경우:
  - 픽셀에도 eventID를 넣고(문서 권장), 서버에도 같은 event_id를 넣어 “한 주문 1개 event_id”로 고정하세요. citeturn15view0turn9view1
- 서버 재시도/중복 호출 방지:
  - “주문ID 기반 멱등키(idempotency key)”처럼, 같은 주문은 같은 event_id로만 보내게 설계해야 합니다(실무 추론). citeturn9view1
- 이벤트 관리자에서 가장 먼저 볼 것:
  - 같은 주문(주문번호/결제ID)을 custom_data로 담고 있다면, 그 값으로 “같은 주문인데 Purchase가 여러 건”인지 바로 찾을 수 있습니다(실무 추론).

### 매칭 품질을 올리되, 내부도 같은 신호를 저장
- 내부 DB에도 결제완료 시점뿐 아니라 **랜딩 시점부터** 다음을 저장하세요.
  - 원본 UTM(첫 유입)과 마지막 UTM(마지막 유입)
  - fbclid 자체 또는 `_fbc` 쿠키값, `_fbp` 쿠키값 citeturn6view0
- 서버 Purchase 전송에는 가능한 한 `client_ip_address`, `client_user_agent`를 포함하세요(문서에서 웹 이벤트에 중요하다고 명시). citeturn6view0
- “고급 매칭(해시된 이메일/전화번호 등)”을 쓴다면, 내부에서도 동일 사용자 키로 주문을 묶어 “나중에 재방문 구매”를 내부 attribution에서 복원할 수 있게 해야 합니다(실무 추론). citeturn17search0turn6view0

### 결제 도메인/리다이렉트가 있으면 도메인 간 사용자 식별부터 복구
- 결제 과정에 도메인 이동이 있으면, GA4는 cross-domain measurement로 쿠키 ID를 유지할 수 있다고 설명합니다. 내부도 같은 원리로 “유입-결제완료 연결”을 유지해야 합니다. citeturn22search1
- 결제완료 페이지에서만 수집하지 말고, **checkout 시작 시점(또는 최소 장바구니 진입 시점)** 에 유입 정보를 서버로 저장해두면, 결제완료에서 파라미터가 사라져도 주문에 붙일 수 있습니다(실무 추론).

### View-through는 “성과 평가용”과 “최적화용”을 분리
- view-through(1d_view)는 정의상 클릭 없이 “봤는데 1일 안에 전환”까지 잡습니다. citeturn23search2
- 따라서 경영 판단(채널 효율)에서는 1d_click 같은 더 보수적 창을 별도로 운영하고, view 포함 값은 “상단 퍼널 영향 포함 지표”로 분리하는 게 안전합니다(실무 추론). citeturn23search2
- “정말 추가 매출이냐”는 실험으로 보는 게 가장 깔끔합니다. Meta도 Conversion Lift 테스트를 통해 광고의 **증분 효과(추가 효과)** 를 측정한다고 안내합니다. citeturn2search16

## Q1–Q3

**Q1.** 지금 비교에 쓰는 Meta 지표가 **purchase_roas**인가요, **website_purchase_roas**인가요? (그리고 픽셀 외에 다른 “연결된 비즈니스 도구”에서 구매 신호가 섞일 가능성은 있나요?) citeturn9view2

**Q2.** 픽셀 Purchase와 CAPI Purchase가 “같은 주문”에 대해 **동일한 event_id**로 들어가나요? 또한 서버/브라우저 각각에서 Purchase가 **한 주문당 1번만** 나가나요? (dedup은 같은 채널 중복은 안 줄여줍니다.) citeturn9view1turn15view0

**Q3.** 결제 흐름에 도메인 이동/리다이렉트가 있나요? 있다면 내부 원장이 랜딩 시점의 UTM·fbclid(또는 `_fbc`/`_fbp`)를 **서버에 저장해 주문과 조인**할 수 있게 되어 있나요? (GA4도 도메인 간 식별자 유지 설정이 필요하다고 명시합니다.) citeturn22search1turn6view0