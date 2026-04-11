# **Meta Ads ROAS와 내부 주문 원장 기반 ROAS 간의 괴리 원인 및 실무적 개선 방안 심층 분석**

## **1\. 서론: 이커머스 어트리뷰션 불일치 현상 및 데이터 구조의 구조적 모순 분석**

최근 디지털 광고 생태계에서 광고 플랫폼이 자체적으로 보고하는 성과 지표와 기업 내부의 자체 주문 원장(Ledger) 또는 서드파티 분석 툴(Google Analytics 등)에서 집계되는 성과 지표 간의 괴리는 가장 빈번하게 발생하는 데이터 정합성 문제 중 하나이다. 특히 Apple의 iOS 14.5 업데이트에 따른 앱 추적 투명성(App Tracking Transparency, ATT) 정책 도입과 지능형 추적 방지(Intelligent Tracking Prevention, ITP) 기술의 고도화 이후, 쿠키 기반의 전통적인 추적 방식이 붕괴하면서 이러한 불일치는 더욱 심화되었다.1 Meta Ads Manager는 자사 플랫폼 중심의 기여(Attribution) 모델과 고도화된 서버 사이드 크로스 디바이스(Cross-device) 추적 기술 및 확률적 매칭(Probabilistic Matching)을 혼합하여 전환을 보고하므로, 보수적이고 결정론적인 라스트 클릭(Last-click) 기반의 내부 원장 데이터와 극심한 차이를 보일 수밖에 없는 구조적 한계를 지닌다.2

제시된 최근 7일간의 내부 원장 및 Meta Ads Manager의 데이터 분포를 교차 분석하면, 이러한 시스템적 불일치의 규모와 성격을 명확히 파악할 수 있으며, 현재 해당 이커머스 시스템이 직면한 기술적 결함의 단서를 도출할 수 있다.

| 데이터 소스 및 어트리뷰션 기준 | 전환수 (Orders) | 결제 금액 (Revenue / Value) | 집계된 ROAS |
| :---- | :---- | :---- | :---- |
| **Meta Ads Manager (기본값: 7d click \+ 1d view)** | 525건 | 130,139,887원 | 4.80x |
| **Meta Ads Manager (1-day click 단일 윈도우)** | 295건 | 84,517,895원 | 3.11x |
| **내부 원장 전체 확정 주문 (All Confirmed)** | 383건 | 97,428,243원 | 3.59x (총 지출 대비) |
| **내부 원장 내 Meta 어트리뷰션 확정 주문** | 102건 | 28,452,940원 | 1.05x |
| **내부 원장 내 UTM/fbclid 누락 (유입경로 불명)** | 129건 | 30,550,429원 | 해당 없음 |
| **내부 원장 내 기타 유입 (자연유입, 타 광고 등)** | 148건 | 36,765,774원 | 해당 없음 |
| **내부 원장 내 Source는 Meta이나 fbclid 누락** | 4건 | 1,659,100원 | 해당 없음 |

위의 데이터 세트가 제시하는 통계적 모순은 현 상황의 심각성을 방증한다. 첫째, Meta가 기본 어트리뷰션 윈도우(7-day click \+ 1-day view)로 주장하는 전체 구매 전환수(525건)가 비즈니스의 실제 전체 확정 주문수(383건)를 무려 137% 이상 초과하고 있다.4 단일 광고 매체가 창출했다고 주장하는 성과가 전체 비즈니스의 총매출액을 넘어서는 이러한 현상은, Meta 플랫폼이 타 채널의 기여도를 과도하게 흡수하는 어트리뷰션 편향(Attribution Bias)의 수준을 넘어섰음을 시사한다. 이는 브라우저 픽셀(Pixel)과 서버(Conversions API) 간의 기술적인 중복 집계(Deduplication Failure) 또는 결제 완료 페이지에서의 픽셀 다중 발동(Multiple Firing)이 기계적으로 발생하고 있다는 가장 강력한 증거이다.6

둘째, Meta의 1-day click 기준 전환수(295건)조차 내부 원장이 Meta로 식별한 주문수(102건)의 약 2.89배에 달한다. 뷰스루(View-through) 전환과 7일간의 긴 고려 기간을 제외하고, 오직 24시간 이내에 링크를 클릭한 사용자만을 집계했음에도 내부 데이터와 193건의 괴리가 발생한다는 것은 크로스 디바이스 환경에서의 데이터 이탈과 세션 단절이 심각함을 의미한다.1

셋째, 내부 원장 데이터 중 유입 경로를 완전히 상실한(UTM 및 fbclid 누락) 주문이 전체의 33.6%(129건)를 차지하고 있다. 이커머스 플랫폼에서 결제 게이트웨이(PG)로 리다이렉션되었다가 돌아오는 과정에서 URL 쿼리 파라미터가 유실되는 전형적인 프론트엔드 추적 실패 사례가 발생하고 있으며, 결제 시작(checkout\_started) 이벤트의 부재가 이 유실된 데이터를 복구할 기회를 원천 차단하고 있다.9

본 보고서는 Meta의 구매 ROAS가 산정되는 수학적, 알고리즘적 원리부터 기술적 결함으로 인한 과대계상 메커니즘, 그리고 내부 원장의 데이터 유실로 인한 과소계상 원인까지 심층적으로 분석한다. 나아가, 두 지표 간의 간극을 최소화하고 투명한 광고 성과 측정을 가능하게 하는 실무적 대응 전략을 포괄적으로 논의한다.

## **2\. Meta Ads Manager의 Purchase ROAS 산정 방식 및 어트리뷰션 윈도우**

### **2.1 Meta의 전환 이벤트와 ROAS 계산의 알고리즘적 구조**

Meta Ads Manager에서 표출되는 Purchase ROAS(Return on Ad Spend)는 단순한 데이터 집계의 결과물이 아니라, Meta 픽셀(웹 브라우저) 또는 Conversions API(서버)를 통해 전송된 이벤트 페이로드를 자사의 거대한 식별자 데이터베이스와 대조하여 생성되는 복합적인 지표이다.12 ROAS는 본질적으로 기여된 구매 전환 가치의 총합을 광고 지출액으로 나눈 비율로 정의된다. Meta의 시스템은 브라우저에서 발생하는 자바스크립트 이벤트(Pixel)와 서버 대 서버 통신으로 유입되는 HTTP 요청(CAPI)을 실시간으로 수신한다. 이때 페이로드 내부의 value와 currency 파라미터가 ROAS 계산의 분자에 해당하는 구매액(Purchase Value)을 구성한다.12

이 과정에서 Meta의 핵심 역량인 '이벤트 매칭(Event Match)'이 작동한다. 수신된 이벤트 데이터에는 사용자의 브라우저 쿠키인 fbp, 클릭 식별자인 fbc, 그리고 고급 매칭(Advanced Matching)을 위한 이메일 해시값, 전화번호 해시값 등이 포함된다.12 Meta 알고리즘은 이 암호화된 개인 정보를 해독하여 전 세계 수십억 명의 활성 사용자 데이터베이스와 대조하고, 해당 사용자가 과거 특정 시간 내에 광고와 상호작용(클릭 또는 조회)한 기록이 존재하는지 판별한다. 상호작용 기록이 확인되고 그것이 설정된 어트리뷰션 윈도우 내에 있다면, 해당 구매 가치는 캠페인의 성과(Attributed Purchase Value)로 귀속된다.1 중요한 점은, Meta의 알고리즘이 단순히 성과를 사후적으로 보고하는 데 그치지 않고, 선택된 어트리뷰션 윈도우 내에서 전환이 발생할 확률이 가장 높은 사용자 프로필을 학습하여 광고 노출 입찰액을 실시간으로 최적화하는 딥러닝 기반의 전달 체계(Delivery System)와 깊이 연동되어 있다는 것이다.1

### **2.2 어트리뷰션 규칙과 윈도우(Attribution Window)의 작동 메커니즘**

어트리뷰션 윈도우는 사용자가 광고를 클릭하거나 조회한 시점부터 전환(구매)이 발생했을 때, 해당 전환을 광고의 성과로 인정해주는 시간적 허용 범위, 즉 '제한 시간'을 의미한다.17 과거 Meta는 28일 클릭 윈도우를 기본으로 제공하여 매우 긴 고객 여정까지 자사의 성과로 편입시켰으나, 브라우저의 쿠키 차단과 개인정보 보호 정책이 강화되면서 현재는 \*\*'7-day click \+ 1-day view'\*\*를 기본값으로 하향 조정하여 적용하고 있다.1

| 어트리뷰션 속성 | 작동 원리 및 성과 귀속 기준 | 이커머스 여정에서의 의미 및 한계 |
| :---- | :---- | :---- |
| **Click-through (클릭 후 전환)** | 사용자가 광고의 링크를 클릭한 후 설정된 기간(1일 또는 7일) 내에 구매를 완료하는 경우. 최근 업데이트로 '좋아요' 등 단순 참여는 제외되고 실제 목적지 URL로 연결되는 링크 클릭만 인정됨. | 고객이 광고를 통해 사이트에 방문한 뒤, 비교 검색 등을 거쳐 며칠 후 다시 접속해 구매하더라도 성과로 인정. 장기 고려 상품에 유리함. |
| **View-through (조회 후 전환)** | 피드나 스토리에서 광고를 시청하거나 스크롤 중 노출되었으나 클릭하지 않고 지나친 뒤, 24시간 내에 다른 경로(직접 유입, 타 매체 등)로 구매를 완료하는 경우. | 단순 노출이 인지도에 미친 영향을 측정한다는 논리이나, 기존 고객 리타겟팅 시 타 매체 성과를 탈취(Over-credit)하는 주된 요인으로 작용함. |
| **Engaged-view (참여 조회 후 전환)** | 비디오 광고에 한정하여, 최소 10초(또는 전체 길이의 97%) 이상 비디오를 시청한 후 1일 이내에 구매하는 경우 성과 부여. | 단순 조회(View)보다는 높은 관여도를 반영하므로 비디오 중심 캠페인에서 성과 측정의 정확도를 상대적으로 높여줌. |

어트리뷰션 윈도우는 이른바 "음악 의자 게임"에 비유할 수 있다.17 타이머가 어떻게 설정되느냐에 따라 동일한 사용자의 동일한 구매 행위라도 시스템에 기록되는 데이터는 극단적으로 달라진다. 고객이 월요일에 광고를 클릭하고 화요일부터 목요일까지 타사 제품을 비교한 뒤 금요일에 최종 구매를 진행했다고 가정해보자. 이 하나의 사건에 대해 1-day click 윈도우는 전환을 0건으로 기록하여 광고의 실패를 선언하지만, 7-day click 윈도우는 이를 1건의 완전한 성공으로 기록한다.17 이러한 윈도우 설정의 본질적인 자의성은 각 플랫폼 간 성과 비교를 어렵게 만드는 근본 원인이 된다.

## **3\. 어트리뷰션 윈도우별 내부 ROAS와의 괴리 발생 원인**

주어진 상황에서 Meta ROAS가 4.80x (기본값: 7d click \+ 1d view)에서 3.11x (1d click)로 급락하고, 다시 내부 원장 기반의 1.05x로 극명하게 축소되는 계단식 하락 현상은 단순한 오차 범위를 넘어선다. 이는 각 기여 모델이 채택하고 있는 철학과 측정 방식이 완전히 상이하며, 서로 다른 시점의 데이터를 캡처하고 있기 때문이다.

### **3.1 7-day click \+ 1-day view 윈도우의 과대계상 (Over-attribution) 역학**

기본 어트리뷰션 윈도우(7-day click \+ 1-day view) 하에서 Meta가 525건의 주문과 4.80x의 폭발적인 ROAS를 보고하는 것은 Meta의 기여 범위가 기업의 실제 비즈니스 생태계보다 지나치게 포괄적이고 탐욕적이기 때문이다.8

첫째, View-through(조회 후 전환) 속성의 침투력은 상상을 초월한다.1 특히 이미 사이트에 방문한 적이 있거나 장바구니에 물건을 담아둔 기존 고객을 대상으로 리타겟팅(Remarketing) 캠페인을 운영할 때, 이 지표는 극도로 부풀려진다.1 한 소비자가 브랜드의 프로모션 이메일이나 카카오톡 알림톡을 받고 구매를 결심한 상태라고 가정하자. 이 소비자가 구매를 위해 웹사이트에 접속하기 전, 지하철에서 무심코 인스타그램 피드를 빠르게 스크롤하며 Meta 광고를 0.5초간 화면에 노출시켰다. 이 소비자는 광고를 클릭하지 않았지만, 내부 원장이 이메일이나 카카오톡 유입으로 기록하여 결제를 처리하는 동안 Meta는 광고 노출 후 1일 이내에 구매가 발생했으므로 자신의 성과(View-through)로 당당히 주장한다.3 Meta의 교차 기기 매칭 알고리즘은 이렇게 우연히 스쳐 지나간 노출조차 인지도를 상승시킨 결정적 요인으로 간주하여 플랫폼의 성과로 병합시킨다.

둘째, 다중 터치포인트(Multi-touchpoint) 여정에서의 교차 기여(Cross-channel overlap) 현상이다. 사용자가 신제품 런칭 Meta 광고를 클릭한 뒤 즉시 구매하지 않고, 3일 후 경쟁사 제품을 비교하다가 구매 의향이 굳어져 구글에 브랜드명을 검색(Google Ads)하여 재방문 후 결제하는 여정을 거쳤다. 이 경우 Meta는 7일 이내의 클릭이 존재하므로 이를 100% 자사의 전환으로 보고하고, 구글 역시 자사 검색 광고의 성과로 전환을 100% 보고한다.2 그러나 내부 주문 원장과 연결된 Google Analytics 계열의 분석 도구는 라스트 클릭(Last Non-Direct Click) 원칙에 따라 여정의 가장 마지막 유입처인 구글 오가닉 또는 구글 검색 채널에 성과를 귀속시킨다.3 결과적으로 기업의 장부상 총합은 1개의 매출이지만, 광고 플랫폼들의 보고서를 합산하면 2개 이상의 매출이 발생하는 '데이터 인플레이션'이 발생한다.2

### **3.2 1-day click 및 1-day view 기준 하향에 따른 데이터 이탈 분석**

데이터에서 Meta의 1-day click ROAS가 3.11x(295건)로 7일 기본값(525건) 대비 43.8% 축소되는 현상은 이커머스/검사권 판매 비즈니스에 내재된 고객의 구매 행동 패턴을 정확히 시사한다. 이는 해당 비즈니스의 제품이 즉각적인 충동구매(Impulse buy)보다는 타인과의 논의, 효용성 비교, 가격 탐색 등 일정 수준의 '고려 기간(Consideration Period)'을 요구하는 특성을 지니고 있음을 증명한다.8

고관여 제품의 경우, 사용자는 광고를 클릭하여 랜딩 페이지에 도달한 당일(24시간 내)에는 정보를 습득하는 데 그치고 이탈했다가, 2일 차부터 7일 차 사이에 재방문하여 결제를 완료하는 패턴을 보인다.8 1-day click 윈도우는 이렇게 24시간을 초과하여 발생한 모든 후속 전환을 완전히 폐기하고 광고의 성과에서 배제하므로 지표가 대폭 하락하게 된다.17

역으로 비판적인 시각에서 바라보자면, 1-day click 기준의 295건조차 내부 원장이 Meta로 식별한 주문수 102건보다 193건이나 비대하다. 조회를 제외하고 클릭 후 24시간 내의 즉각적이고 확정적인 구매 의사만을 집계했음에도 3배에 가까운 격차가 발생한다는 것은, 기여 모델의 차이를 넘어선 시스템적 누수가 존재함을 가리킨다. 이는 클릭 후 24시간 이내에 구매가 이루어졌음에도 불구하고, 내부 원장 수집 단계에서 추적 식별자(UTM/fbclid)를 상실하여 '기타 유입'으로 처리되었거나, 결제 직전 타 매체(검색, 제휴 링크 등)로 라스트 클릭을 빼앗겼기 때문이다.2

## **4\. Meta ROAS 과대계상을 유발하는 딥테크 및 기술적 결함 요인**

앞선 맥락에서 강조했듯, Meta의 기본 구매수(525건)가 비즈니스의 전체 확정 주문수(383건)를 142건이나 능가하는 작금의 현상은 단순한 기여 모델의 관대함으로 설명될 수 없다. 이는 기술적 추적 아키텍처, 구체적으로 이벤트 송수신 파이프라인에 근본적이고 구조적인 결함이 존재함을 강력히 시사한다.4

### **4.1 Pixel 및 Conversions API(CAPI) 중복 제거(Deduplication) 실패 알고리즘**

현재 직면한 물리적 불가능성(광고 매체의 성과가 전체 매출을 초과함)의 가장 유력하고 치명적인 원인은 웹 브라우저 기반의 클라이언트 사이드 추적인 Meta Pixel과, 백엔드 서버에서 이벤트를 직접 쏘아주는 Conversions API(CAPI)가 동일한 구매 트랜잭션을 이중으로 전송하고 있으나, Meta 서버가 이를 하나의 전환으로 병합(Deduplicate)하는 데 완전히 실패하고 있는 현상이다.4

Meta는 데이터의 안정성을 위해 브라우저 픽셀이 광고 차단기나 브라우저 정책으로 누락되는 것을 방지하고자 CAPI를 함께 사용하는 '이중 추적(Dual Tracking)'을 적극 권장한다.15 양쪽에서 데이터가 폭우처럼 쏟아져 들어올 때 중복 계상을 막기 위해 Meta는 event\_name과 event\_id라는 두 가지 고유 식별 키를 결합하여 이벤트의 유일성을 검증한다.21

| 중복 제거(Deduplication) 실패 유형 | 기술적 발생 원인 및 증상 | Meta Ads Manager에 미치는 영향 |
| :---- | :---- | :---- |
| **Event ID의 누락 또는 불일치** | 프론트엔드 Pixel에서 eventID: "order\_123"을 전송하고, 서버의 CAPI에서 event\_id: "123"(타입 불일치) 또는 완전히 다른 해시를 전송하는 경우. | Meta는 이를 서로 무관한 두 번의 개별 구매로 인식하여 매출을 정확히 2배로 부풀린다. (대소문자와 문자열 타입 엄격 구분) 15 |
| **Event Name 문자열 불일치** | Pixel에서는 표준 이벤트인 "Purchase"를 발송하고, 서버에서는 소문자인 "purchase"를 발송하는 경우. | 이벤트 명칭이 케이스 센서티브(Case-sensitive)하게 검증되므로 매칭에 실패하여 중복 계상된다.21 |
| **48시간 윈도우 타이밍 오류** | Pixel은 결제 즉시 발동하나, 서버의 CAPI 배치 작업이 지연되어 48시간을 초과하여 동일 이벤트를 발송하는 경우. | Meta의 중복 제거 타이머는 48시간이므로, 이 시간을 벗어난 중복 전송은 완전히 새로운 전환으로 수집된다.15 |
| **새로고침에 의한 다중 발동** | 서버 전송은 1회로 통제되나, 사용자가 결제 완료 페이지를 북마크하거나 영수증 확인을 위해 새로고침(Reload)할 때 Pixel 코드가 재실행되는 경우. | 프론트엔드 방어 로직 부재 시 새로고침할 때마다 동일한 금액의 구매 이벤트가 무한정 누적되어 ROAS를 기형적으로 상승시킨다.6 |

현재 "event\_id dedup 문제를 점검 중"이라는 맥락을 고려할 때, 이커머스 관리자가 Meta Events Manager의 탭을 확인해 보면 '이벤트 ID 오버랩 비율(Overlap of event\_ids)'이 0%에 수렴하거나 비정상적으로 낮게 형성되어 있을 확률이 확정적이다.23 서버와 브라우저가 각자 다른 언어로 같은 사건을 말하고 있으므로, Meta 알고리즘은 행복하게 모든 허수를 성과로 수용하여 4.80x라는 환상적인 ROAS를 보고하게 된다.

### **4.2 퍼스트 파티 식별자(fbp, fbc) 및 Advanced Matching의 횡포**

내부 원장은 일반적으로 브라우저 세션과 로컬 쿠키에 극도로 의존하므로 크로스 디바이스(Cross-device) 및 크로스 브라우저(Cross-browser) 환경에서 추적 연속성을 유지하는 데 매우 취약하다. 반면 Meta는 자사의 압도적인 로그인 활성 사용자 풀과 고도화된 Advanced Matching 기술을 무기로 끊어진 구매 여정을 억지로 이어붙이는 데 탁월한 능력을 발휘한다.1

CAPI를 통해 서버에서 전송되는 페이로드에는 단순한 주문액뿐만 아니라 브라우저 환경을 식별하는 fbp, 클릭 이벤트를 식별하는 fbc, 그리고 가장 강력한 매칭 도구인 사용자의 이메일 해시값(em), 전화번호 해시값(ph), IP 주소 등이 동봉된다.12 현대 소비자는 모바일 기기에서 인스타그램 광고를 클릭하여 상품을 조회한 후 결제를 미루고 이탈했다가, 퇴근 후 데스크톱 PC로 네이버나 구글에 브랜드명을 직접 검색하여 구매하는 다중 기기 행태를 보인다. 구글 애널리틱스나 내부 원장 시스템은 세션이 분리되어 있으므로 이 사용자를 "모바일의 광고 클릭자"와 "데스크톱의 직접 방문 결제자"라는 서로 다른 두 명의 사용자로 완벽히 분리하여 보고한다. 그러나 Meta는 서버에서 수신한 결제 정보 속의 이메일 해시값(Advanced Matching)을 통해 두 기기에서 접속한 인물이 동일한 Meta 회원임을 식별해낸다.1 이 메커니즘은 모바일에서의 최초 광고 클릭을 데스크톱에서의 최종 구매에 연결(Attribution)시켜 Meta의 ROAS를 폭발적으로 상승시키는 반면, 내부 원장에서는 해당 구매의 출처를 찾지 못해 "기타 유입(148건)"으로 버려지게 만든다.

### **4.3 플랫폼의 내재적 귀속 편향 (Attribution Bias)과 데이터 거버넌스 부재**

광고 지면을 판매하여 수익을 창출하는 동시에, 그 광고의 성과를 측정하고 채점하는 주체가 모두 Meta라는 사실은 근본적인 구조적 모순을 내포한다. 이러한 플랫폼은 자사 생태계에 유리한 기여 기준을 적용하는 심각한 '귀속 편향(Attribution Bias)'을 가질 수밖에 없다.3 사용자가 구매 여정 동안 Google Search, TikTok, 이메일 뉴스레터 등 여러 광고주의 터치포인트를 거치더라도, Meta의 추적 픽셀과 서버 이벤트 알고리즘은 플랫폼의 재무적 성과를 극대화하는 방향(자사 기여도 최대화)으로 편향되어 있다. 확률적 매칭(Probabilistic Matching) 모델을 사용하여 불확실한 세션의 주인마저 자사 네트워크의 유저로 편입시키려는 경향성을 띠므로, 타 매체 성과와의 합산 전환수가 실제 비즈니스 매출을 초과하는 현상이 필연적으로 수반된다.3 내부 원장은 이러한 플랫폼들의 '성과 탈취 경쟁' 속에서 중재자 역할을 해야 하지만, 현재 파라미터 유실로 인해 그 기능을 상실한 상태이다.

## **5\. 내부 주문 원장 기반 ROAS 과소계상(Under-reporting)의 구조적 한계점**

Meta 플랫폼 내부의 과대계상 요인 이면에는, 내부 원장 데이터 수집 인프라 자체의 결함으로 인해 정당한 Meta의 광고 성과마저 허무하게 잃어버리는 심각한 '과소계상(Under-reporting)' 문제가 공존하고 있다. 제시된 데이터 상의 "유입경로 불명(129건, 약 3천만 원)"과 "기타 유입(148건, 약 3.6천만 원)"은 추적 파이프라인 붕괴의 명백한 증거이다. 전체 주문의 무려 72.3%가 정확한 기여 채널을 찾지 못하고 표류하고 있는 셈이다.

### **5.1 PG사 리다이렉션으로 인한 파라미터(UTM/fbclid) 대량 증발**

한국을 포함한 글로벌 이커머스 사이트에서 전환 추적이 실패하는 가장 결정적이고 파괴적인 구간은 사용자가 외부 결제 게이트웨이(Payment Gateway, 예: KG이니시스, 토스페이먼츠, NHN KCP 등)로 리다이렉션(Redirection)되는 과정이다.9

사용자가 Meta 광고를 클릭하여 웹사이트에 진입하는 순간, 랜딩 URL에는 ?utm\_source=meta\&fbclid=IwAR... 형태의 추적 파라미터가 부여된다. 이 파라미터는 사용자가 사이트를 탐색하는 동안 브라우저 메모리에 유지된다. 그러나 사용자가 장바구니에 상품을 담고 최종 '결제하기' 버튼을 눌러 외부 PG사 결제창 도메인으로 이동했다가 결제 완료 페이지(Order Completed / Thank You Page)로 복귀하는 순간 비극이 발생한다. 브라우저의 HTTP Referrer와 URL 구조는 PG사의 도메인으로 완전히 덮어씌워지며, 초기 랜딩 URL에 존재하던 귀중한 쿼리 파라미터(Query Parameters)들은 이 리다이렉트 체인 속에서 모두 증발해버린다.11 이로 인해 내부 원장 스크립트는 결제 완료 페이지가 로드되는 시점에 utm\_source와 fbclid를 긁어오려고 시도하지만, URL은 이미 깨끗하게 세탁된 상태이므로 해당 주문을 "Direct(직접 유입)" 또는 "Referral(PG사 유입)"로 잘못 분류하게 된다.11 내부 원장에 잡힌 129건의 UTM/fbclid 누락 주문은 사실상 광고가 기여했을 확률이 농후함에도 기술적 단절로 인해 버려진 고아 데이터(Orphan Data)이다.

### **5.2 checkout\_started 이벤트 누락에 따른 추적 연속성의 영구적 단절**

현재 해당 비즈니스의 컨텍스트에서 checkout\_started(결제 시작) 이벤트가 누락되어 있다는 점은 단순한 데이터 포인트의 부재를 넘어 치명적인 기술 부채(Technical Debt)를 의미한다.28

이커머스 퍼널에서 사용자가 장바구니에서 결제로 넘어가는 단계(checkout\_started)는 사용자의 세션 정보(UTM, fbclid 등 마케팅 파라미터)를 비로소 식별 가능한 개인 정보(이름, 이메일, 전화번호 등 PII)와 매핑할 수 있는 최초이자 최후의 앵커 포인트(Anchor Point)이다.10 선진적인 추적 시스템은 사용자가 외부 PG창으로 넘어가기 직전, 즉 checkout\_started 이벤트가 발동하는 시점에 퍼스트 파티(First-party) 쿠키나 브라우저의 로컬 스토리지에 세션 트래킹 식별자를 단단히 저장해 둔다. 또는 서버의 세션 DB에 해당 주문 번호와 UTM 파라미터를 임시로 매핑해둔다. 이렇게 하면 외부 결제창을 거쳐 돌아왔을 때, URL이 세탁되었더라도 로컬 스토리지나 서버 DB를 조회하여 사용자의 이전 광고 클릭 여정을 온전히 복구할 수 있다.11 현재 checkout\_started 이벤트가 서버 기반 분석 모델링으로 연동되지 않고 있으므로, 퍼널의 단절이 발생하여 Meta CAPI의 Event Match Quality(EMQ) 점수 하락과 내부 원장 데이터 유실을 동시에 초래하고 있다.28

### **5.3 엄격한 라스트 클릭(Last-click) 모델의 한계와 내부 링크 태깅의 오류**

기업의 내부 원장이나 Google Analytics(표준 설정)는 별도의 다중 터치포인트 모델링(Data-driven Attribution 등)을 적용하지 않는 한 대부분 보수적인 '마지막 간접 클릭(Last Non-Direct Click)' 또는 '라스트 클릭' 모델을 신봉한다.2 이 모델은 승자독식(Winner-takes-all) 메커니즘으로 작동한다. Meta 광고가 초기 제품 인지(Awareness)와 관심(Interest)을 유발하고 장바구니 담기까지 유도하는 데 결정적인 90%의 역할을 했더라도, 며칠 뒤 사용자가 결제를 위해 구글 브랜드 검색을 하거나 제휴사 링크를 클릭하여 진입했다면 Meta의 기여도는 무자비하게 0%로 처리된다.2 따라서 전환의 가치를 인지 채널과 전환 채널이 공유할 수 없으며, 이는 필연적으로 7일 윈도우를 적용하는 Meta ROAS와 라스트 클릭 기반의 내부 원장 ROAS 간의 심각한 인식 간극을 낳는다.

추가적으로 내부 원장 내에 "Source는 Meta이나 fbclid 누락"된 주문이 4건 존재한다는 사실은, 담당자가 내부 사이트의 배너나 공지사항 링크 등 '내부 링크(Internal Links)'에 UTM 파라미터를 잘못 부착했을 가능성을 강하게 시사한다.9 내부 이동 링크에 UTM을 부착하면 브라우저는 이를 새로운 세션의 시작으로 오인하여 기존 외부 매체(Meta)의 세션 아이디를 덮어씌워 버리며, 이 과정에서 fbclid와 같은 원본 클릭 식별자는 영원히 파괴된다.32

### **5.4 브라우저 단의 지능형 추적 방지(ITP) 및 쿠키 차단 환경**

Apple의 지능형 추적 방지(ITP) 정책, iOS 14.5 앱 추적 투명성(ATT), 프라이버시 중심 브라우저(Brave, Safari 등)의 확산, 그리고 광범위한 광고 차단 확장 프로그램(AdBlockers)의 사용은 클라이언트 사이드 스크립트 실행을 억압하고 URL의 추적 파라미터(fbclid 등)를 강제로 잘라낸다(Strip).9 특히 사용자가 인스타그램이나 페이스북 인앱 브라우저(In-app browser)에서 광고를 클릭한 후, 가독성을 위해 '외부 브라우저(Safari 등)에서 열기'를 선택하는 과정에서 fbclid 파라미터가 소실되는 빈도가 매우 높다.34 이는 내부 시스템이 Meta의 성과를 온전히 포착하지 못하게 만드는 통제 불가능한 외부적 방해 요소이며, 129건의 누락 데이터 중 상당 부분이 이 현상에 기인했을 것으로 추정된다.

## **6\. 결론 및 전략적 실무 체크리스트: 플랫폼 간 ROAS 간극 극복 및 정합성 확보 방안**

제시된 1.05x(내부 Confirmed)와 4.80x(Meta Default) 사이의 극단적이고 파괴적인 ROAS 격차는 1\) 기술적 오류에 의한 중복 계상, 2\) 리다이렉트 과정에서의 추적 단절 및 파라미터 유실, 3\) 기여 모델의 구조적 차이(라스트 클릭 vs 멀티 터치 뷰스루)라는 세 가지 차원의 문제가 기형적으로 얽힌 결과이다.1 이를 실무적으로 교정하고 데이터의 신뢰도와 의사결정의 타당성을 회복하기 위해, 마케팅 및 개발 조직은 다음의 단계별 심층 체크리스트를 체계적으로 수행해야 한다.

| 해결 우선순위 | 영역 | 실무적 점검 및 조치 사항 (Checklist) | 예상 임팩트 |
| :---- | :---- | :---- | :---- |
| **1순위** | **CAPI 중복 제거 (Deduplication)** | **\[ \] Pixel과 CAPI의 event\_id 동기화 검증:** 프론트엔드 Pixel의 eventID와 서버사이드 CAPI의 event\_id가 정확히 동일한 값(예: 난수 기반의 UUID 또는 고유 장바구니 토큰)을 공유하는지 소스 코드 수준에서 감사(Audit)한다. 대소문자(CamelCase vs Snake\_case)와 데이터 타입(String) 일치 여부가 필수적이다.15 **\[ \] Event Name 일치 검증:** 브라우저와 서버가 동일한 이벤트 명칭(예: "Purchase" vs "purchase")을 전송하는지 확인한다. 대소문자가 다르면 중복 제거가 실패한다.21 **\[ \] 48시간 타이밍 및 페이로드 점검:** 서버 이벤트가 ব্র라우저 이벤트 발생 후 지연 없이 실시간으로 전송되는지 확인하고, Meta Events Manager \[진단\] 탭에서 Overlap Percentage가 90% 이상으로 정상화되는지 모니터링한다.23 | **최상** (Meta의 137% 매출 초과 현상 및 4.80x 기형적 ROAS를 즉각적으로 정상화) |
| **2순위** | **결제 추적 아키텍처 재건** | **\[ \] 퍼스트 파티(First-party) 쿠키/로컬 스토리지로 파라미터 보존:** 사용자가 랜딩 페이지 최초 접근 시 URL에 포함된 utm\_source와 fbclid를 즉시 추출하여 브라우저의 로컬 스토리지나 퍼스트 파티 쿠키에 저장하는 스크립트를 구현한다.34 PG사 결제를 마치고 리다이렉트되어 돌아왔을 때, URL이 세탁되었더라도 로컬 스토리지에서 해당 값을 꺼내어 결제 완료 원장에 함께 기록(Order Metafields 등 활용)하도록 시스템을 패치한다.11 **\[ \] 새로고침(Page Reload) 방어 로직 배포:** 결제 완료 페이지에 사용자가 북마크 등을 통해 재방문하거나 영수증 확인을 위해 새로고침할 때 Pixel 코드가 중복으로 발동하지 않도록 프론트엔드에 if first\_time\_accessed 조건문 등을 추가하여 단 1회 실행을 강제한다.5 | **상** (유입경로 불명인 129건, 약 3천만 원의 매출을 올바른 기여 채널로 복구) |
| **3순위** | **이벤트 매핑 및 데이터 강화** | **\[ \] checkout\_started 이벤트 및 퍼널 데이터 매핑 신설:** 누락되어 있는 결제 시작 이벤트를 즉각적으로 구현한다. 이 단계에서 수집되는 사용자 식별 데이터(입력 중인 이메일, 전화번호 등)와 브라우저 쿠키(UTM, fbclid)를 서버 세션 또는 데이터베이스 트랜잭션에 사전 결속시켜, PG사 단절 이후에도 데이터를 이어갈 수 있는 교두보를 마련한다.10 **\[ \] Advanced Matching(고급 매칭) 파라미터 극대화:** CAPI 전송 시 단순 거래액뿐만 아니라 해시화된 고객 이메일(em), 전화번호(ph), IP 주소 등 암호화된 사용자 데이터를 최대한 풍부하게(Maximum Data Sharing) 담아 전송하여 Meta의 Event Match Quality(EMQ)를 6.0 이상으로 끌어올린다.7 | **중상** (크로스 디바이스 사용자의 전환 추적율 개선 및 타겟팅 최적화 품질 향상) |
| **4순위** | **어트리뷰션 분석 기준 재조정** | **\[ \] 내부 측정의 단일 진실 공급원(SSOT) 정립:** 각 광고 플랫폼이 뷰스루와 다중 터치포인트를 근거로 주장하는 중복 기여의 맹점을 피하기 위해, 내부 원장에 기록되는 라스트 클릭 파라미터(보존된 UTM/fbclid)를 성과 측정 및 재무적 의사결정의 궁극적 기준으로 삼는다.3 **\[ \] Meta Ads Manager 비교 윈도우(Compare Windows) 적극 활용:** 일상적인 성과 모니터링 시 7d click \+ 1d view 기본값을 무비판적으로 수용하지 않는다. '어트리뷰션 설정 비교' 기능을 활성화하여 허수가 심한 View-through 전환을 필터링하고, 가장 직접적인 지표인 1-day click과 더불어 '첫 전환(First Conversion)' 지표를 기준점으로 삼아 내부 원장과의 괴리를 지성적으로 평가한다.1 **\[ \] 내부 링크 UTM 태깅 제거:** 사이트 내 배너 이동 시 UTM 파라미터가 부착된 URL을 사용하지 않도록 콘텐츠 관리 기준을 전면 수정하여 세션 리셋 오류를 방지한다.31 | **중** (팀 내부의 데이터 리터러시 향상 및 매체별 예산 분배의 객관성 확보) |

위의 체계적이고 구조적인 수정 조치가 선행된다면, Meta 플랫폼의 탐욕스러운 과대계상을 유발하는 중복 이벤트 전송을 근본적으로 차단할 수 있다. 이와 동시에 결제 게이트웨이 단계에서의 치명적인 파라미터 유실을 방어함으로써, 현재 1.05x와 4.80x로 양극화되어 의사결정의 마비 현상을 초래하는 ROAS 간극을 비즈니스의 실체적 진실에 부합하는 수치로 수렴시킬 수 있을 것이다. 데이터의 투명성은 곧 자본 배분의 효율성으로 직결됨을 잊지 말아야 한다.

#### **참고 자료**

1. A Complete Guide to Meta Ads Attribution \- Jon Loomer Digital, 4월 11, 2026에 액세스, [https://www.jonloomer.com/meta-ads-attribution/](https://www.jonloomer.com/meta-ads-attribution/)
2. Top 5 Attribution Challenges in Meta Ads \- Dancing Chicken, 4월 11, 2026에 액세스, [https://dancingchicken.com/post/top-5-attribution-challenges-in-meta-ads](https://dancingchicken.com/post/top-5-attribution-challenges-in-meta-ads)
3. Ad Platform Attribution Bias: Complete Guide 2026\! \- Cometly, 4월 11, 2026에 액세스, [https://www.cometly.com/post/ad-platform-attribution-bias](https://www.cometly.com/post/ad-platform-attribution-bias)
4. I'm facing an issue with Facebook Ads reporting more purchases than actually occur on my Shopify store. \- Publicity Port, 4월 11, 2026에 액세스, [https://publicityport.com/awc/4215/facing-issue-facebook-reporting-purchases-actually-shopify](https://publicityport.com/awc/4215/facing-issue-facebook-reporting-purchases-actually-shopify)
5. Ads Manager showing more purchases than my store? : r/FacebookAds \- Reddit, 4월 11, 2026에 액세스, [https://www.reddit.com/r/FacebookAds/comments/1do2w2m/ads\_manager\_showing\_more\_purchases\_than\_my\_store/](https://www.reddit.com/r/FacebookAds/comments/1do2w2m/ads_manager_showing_more_purchases_than_my_store/)
6. How to Fix Over-Reporting in Meta \- EasyInsights, 4월 11, 2026에 액세스, [https://easyinsights.ai/blog/fix-over-reporting-in-meta/](https://easyinsights.ai/blog/fix-over-reporting-in-meta/)
7. Facebook Ads pixel reporting more purchases than are really happening, 4월 11, 2026에 액세스, [https://community.shopify.com/t/facebook-ads-pixel-reporting-more-purchases-than-are-really-happening/164992](https://community.shopify.com/t/facebook-ads-pixel-reporting-more-purchases-than-are-really-happening/164992)
8. Is 7-Day Click 1-Day View the Best Facebook Attribution Setting \- | Enhencer, 4월 11, 2026에 액세스, [https://enhencer.com/blog/is-7-day-click-1-day-view-the-best-facebook-attribution-setting](https://enhencer.com/blog/is-7-day-click-1-day-view-the-best-facebook-attribution-setting)
9. Get to know the culprits that disrupt UTM tracking \- Net Natives, 4월 11, 2026에 액세스, [https://www.netnatives.com/blog/utm-tracking/](https://www.netnatives.com/blog/utm-tracking/)
10. Shopify Checkout Extensibility 2026: You Missed the Deadline. Now What? \- Revize, 4월 11, 2026에 액세스, [https://www.revize.app/blog/shopify-checkout-extensibility-migration-guide](https://www.revize.app/blog/shopify-checkout-extensibility-migration-guide)
11. How to Track UTM and Click IDs in Shopify Orders \- Analyzify, 4월 11, 2026에 액세스, [https://analyzify.com/hub/track-campaign-source-click-id-shopify](https://analyzify.com/hub/track-campaign-source-click-id-shopify)
12. Meta Pixel vs. Conversions API for Event Mapping \- AdAmigo.ai Blog, 4월 11, 2026에 액세스, [https://www.adamigo.ai/blog/meta-pixel-vs-conversions-api-for-event-mapping](https://www.adamigo.ai/blog/meta-pixel-vs-conversions-api-for-event-mapping)
13. How to Troubleshoot Inflated Results in Meta Ads Manager \- Jon Loomer Digital, 4월 11, 2026에 액세스, [https://www.jonloomer.com/troubleshoot-inflated-results-in-meta-ads-manager/](https://www.jonloomer.com/troubleshoot-inflated-results-in-meta-ads-manager/)
14. Remove duplicate purchase events in Meta Pixel \- Shopify Community, 4월 11, 2026에 액세스, [https://community.shopify.com/t/remove-duplicate-purchase-events-in-meta-pixel/398470](https://community.shopify.com/t/remove-duplicate-purchase-events-in-meta-pixel/398470)
15. Meta Conversions API: Complete Setup & Optimization Guide (2026), 4월 11, 2026에 액세스, [https://adsuploader.com/blog/meta-conversions-api](https://adsuploader.com/blog/meta-conversions-api)
16. Meta Ads Attribution Settings (2026) Guide \- JetFuel.Agency, 4월 11, 2026에 액세스, [https://jetfuel.agency/meta-ads-attribution-settings/](https://jetfuel.agency/meta-ads-attribution-settings/)
17. How Attribution Window Changes Impact Your Marketing Data and Campaign Performance, 4월 11, 2026에 액세스, [https://www.cometly.com/post/attribution-window-changes-impact](https://www.cometly.com/post/attribution-window-changes-impact)
18. Meta Ads Overreporting: Trust(?) But Verify \- Verde Media, 4월 11, 2026에 액세스, [https://verdemedia.com/blog/meta-ads-overreporting](https://verdemedia.com/blog/meta-ads-overreporting)
19. Meta reporting more purchases than received (4/7-4/8) : r/FacebookAds \- Reddit, 4월 11, 2026에 액세스, [https://www.reddit.com/r/FacebookAds/comments/1sggo1w/meta\_reporting\_more\_purchases\_than\_received\_4748/](https://www.reddit.com/r/FacebookAds/comments/1sggo1w/meta_reporting_more_purchases_than_received_4748/)
20. Why Ad Campaigns Need Event Deduplication \- TrackBee, 4월 11, 2026에 액세스, [https://www.trackbee.io/blog/why-profitable-ad-campaigns-need-event-deduplication-and-two-tracking-methods](https://www.trackbee.io/blog/why-profitable-ad-campaigns-need-event-deduplication-and-two-tracking-methods)
21. Meta Conversions API Deduplication event\_id \- Watsspace, 4월 11, 2026에 액세스, [https://watsspace.com/blog/meta-conversions-api-deduplication-event\_id/](https://watsspace.com/blog/meta-conversions-api-deduplication-event_id/)
22. Event Deduplication in Meta Ads: Fix Double Counting | by Agrowth Agency | Medium, 4월 11, 2026에 액세스, [https://medium.com/@agrowthagen/event-deduplication-in-meta-ads-fix-double-counting-8d795478b2a1](https://medium.com/@agrowthagen/event-deduplication-in-meta-ads-fix-double-counting-8d795478b2a1)
23. Deduplication event\_id 0% · Issue \#25 · facebookincubator/ConversionsAPI-Tag-for-GoogleTagManager \- GitHub, 4월 11, 2026에 액세스, [https://github.com/facebookincubator/ConversionsAPI-Tag-for-GoogleTagManager/issues/25](https://github.com/facebookincubator/ConversionsAPI-Tag-for-GoogleTagManager/issues/25)
24. Discover a Top Cause of Inflated Events from the Meta Conversions API (CAPI), 4월 11, 2026에 액세스, [https://www.blastx.com/insights/discover-a-top-cause-of-inflated-events-from-meta-conversions-api-capi](https://www.blastx.com/insights/discover-a-top-cause-of-inflated-events-from-meta-conversions-api-capi)
25. Multiple Ad Accounts Tracking Difficulty: Solutions \- Cometly, 4월 11, 2026에 액세스, [https://www.cometly.com/post/multiple-ad-accounts-tracking-difficulty](https://www.cometly.com/post/multiple-ad-accounts-tracking-difficulty)
26. What is fbclid? A Complete Guide to Facebook Click Identifiers and Tracking Ad Performance \- Northbeam, 4월 11, 2026에 액세스, [https://www.northbeam.io/blog/what-is-fbclid-guide-to-facebook-click-identifiers](https://www.northbeam.io/blog/what-is-fbclid-guide-to-facebook-click-identifiers)
27. How to Capture the Meta Click ID (fbclid) With Your Funnel | Heyflow, 4월 11, 2026에 액세스, [https://heyflow.com/blog/capture-meta-click-id-with-funnel/](https://heyflow.com/blog/capture-meta-click-id-with-funnel/)
28. Blog | BioBM, 4월 11, 2026에 액세스, [https://biobm.com/category/blog/](https://biobm.com/category/blog/)
29. The Importance of Conversion Tracking in Life Science Marketing \- BioBM, 4월 11, 2026에 액세스, [https://biobm.com/2025/09/the-importance-of-conversion-tracking-in-life-science-marketing/](https://biobm.com/2025/09/the-importance-of-conversion-tracking-in-life-science-marketing/)
30. How to Set Up Custom Attribution Models in Meta Ads \- AdAmigo.ai Blog, 4월 11, 2026에 액세스, [https://www.adamigo.ai/blog/how-to-set-up-custom-attribution-models-in-meta-ads](https://www.adamigo.ai/blog/how-to-set-up-custom-attribution-models-in-meta-ads)
31. Stop Using UTM Parameters on Internal Links \- Search Seven, 4월 11, 2026에 액세스, [https://www.searchseven.co.uk/articles/why-using-utm-parameters-on-internal-links-is-a-very-bad-idea/](https://www.searchseven.co.uk/articles/why-using-utm-parameters-on-internal-links-is-a-very-bad-idea/)
32. 18 UTM Tagging Mistakes & Errors To Avoid (With Fixes) \- DumbData, 4월 11, 2026에 액세스, [https://dumbdata.co/post/costly-utm-tracking-mistakes-that-can-ruin-your-data/](https://dumbdata.co/post/costly-utm-tracking-mistakes-that-can-ruin-your-data/)
33. The Complete Guide to E-commerce UTM Parameters \- TechMarcos, 4월 11, 2026에 액세스, [https://www.techmarcos.com/e-commerce-utm-parameters/](https://www.techmarcos.com/e-commerce-utm-parameters/)
34. Missing fbclid from Facebook Ads links? \- Appfromlab, 4월 11, 2026에 액세스, [https://www.appfromlab.com/posts/missing-fbclid-from-facebook-ads-links/](https://www.appfromlab.com/posts/missing-fbclid-from-facebook-ads-links/)
35. UTM Tracking Issues \- HubSpot Community, 4월 11, 2026에 액세스, [https://community.hubspot.com/t5/Reporting-Analytics/UTM-Tracking-Issues/m-p/1165699](https://community.hubspot.com/t5/Reporting-Analytics/UTM-Tracking-Issues/m-p/1165699)