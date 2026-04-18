네, 그 우려는 **정확한 우려**입니다.  
제 답은 이겁니다.

**딜레이가 있다고 해서 business confirmed 기반 CAPI Purchase가 바로 틀린 건 아닙니다.**  
Meta는 공식적으로 CAPI가 **나중에 일어나는 고객 여정 액션**도 최적화와 측정에 쓸 수 있다고 설명하고, 오프라인 이벤트도 Sales Objective 안에서 최적화에 사용할 수 있다고 안내합니다. 즉, “조금 늦게 들어오는 전환” 자체는 Meta가 못 쓰는 신호가 아닙니다. ([페이스북](https://www.facebook.com/business/help/AboutConversionsAPI?utm_source=chatgpt.com "About Conversions API | Meta Business Help Center"))

하지만 반대도 맞습니다.  
**너무 늦거나, 너무 적거나, 너무 들쭉날쭉하면 학습은 둔해질 수 있습니다.** Meta는 학습 단계에서 성과가 덜 안정적이라고 설명하고, 계정을 단순화해 AI가 더 빨리 학습하도록 하는 것이 좋다고 말합니다. 이건 곧, 신호가 충분히 자주, 충분히 빠르게 들어올수록 안정화가 쉬워진다는 뜻입니다. 이 부분은 공식 문서에 직접 “몇 시간까지 괜찮다”라고 적혀 있지는 않지만, 운영상 그렇게 해석하는 게 맞습니다. ([페이스북](https://www.facebook.com/help/messenger-app/650774041651557?utm_source=chatgpt.com "View campaign, ad set or ad delivery status in Meta Ads Manager | Messenger Help Center"))

쉽게 비유하면 이렇습니다 😊  
Meta는 **시험 문제를 푸는 학생**이고, Purchase 신호는 **정답 채점표**입니다.  
정답표가 1시간 뒤에 오면 학생은 좀 늦게 배우지만 그래도 배웁니다.  
정답표가 5일 뒤에 오고, 어떤 건 1일 뒤, 어떤 건 10일 뒤처럼 들쭉날쭉하면, 학생은 “뭘 잘했는지”를 늦고 흐리게 배우게 됩니다.

그래서 여기서 중요한 질문은  
**“business confirmed가 늦냐 안 늦냐”가 아니라, 실제로 얼마나 늦고 얼마나 흔들리냐”** 입니다.

지금 문서 기준으로는 `paid -> confirmed` 전이가 **Imweb status sync에서 `PURCHASE_CONFIRMATION`이 확인될 때** 일어나도록 잡혀 있습니다. 또 현재 로드맵도 `정본/freshness`를 먼저 고정하고, `pending -> confirmed -> Server CAPI 1회`를 실제로 검증하는 것을 최우선으로 두고 있습니다. 즉, 문서도 이미 “이건 철학 문제가 아니라 실제 지연 시간 측정 문제”라고 보고 있습니다.

반면 현재 실제 코드는 아직 그 분리가 안 되어 있습니다.  
현재 CAPI 후보는 ledger의 `paymentStatus === "confirmed"`를 쓰고 있고, 이 값은 Toss/PG 결제 성공 상태에서 만들어질 수 있습니다. 즉, 지금은 **business confirmed 지연 시간을 따지기 전에, 아예 CAPI가 더 이른 상태를 Purchase로 보내고 있는 구조**입니다.

그래서 제 답은 아주 명확합니다.

## 1) 네, Codex에게 **반드시 조사시켜야 합니다**

이건 물어볼 가치가 아니라 **확인해야 하는 필수 항목**입니다.  
왜냐하면 코드만 보고는 “확정까지 10분인지, 6시간인지, 3일인지”를 알 수 없기 때문입니다.

조사해야 하는 건 딱 4개입니다.

**첫째, 실제 지연 시간 분포**  
`paid_at` 또는 PG 승인 시각 → `business_confirmed_at`까지

- p50
    
- p75
    
- p90
    
- p95
    
- 최대값
    

**둘째, 결제수단별 차이**

- 카드
    
- 가상계좌
    
- 네이버페이
    
- 사이트별 차이도 분리: biocom / coffee / aibio
    

**셋째, 미확정 잔존 비율**

- 24시간 안에 confirmed 되는 비율
    
- 72시간 안에 confirmed 되는 비율
    
- 7일이 지나도 confirmed 안 되는 비율
    
- canceled/refunded로 빠지는 비율
    

**넷째, 변동성**

- 어떤 주문은 10분, 어떤 주문은 4일이면 ML 입장에서는 신호가 흐려집니다
    
- 그래서 평균보다 **분포 폭**이 중요합니다
    

## 2) 제 실무 판단 기준

이건 플랫폼 공식 규칙이 아니라, 제가 운영적으로 추천하는 컷입니다.

**좋은 케이스**

- p50이 1-3시간 안
    
- p90이 24시간 안
    
- 72시간 넘는 건 소수
    

이 경우는  
**business confirmed를 CAPI Purchase 공식 신호로 써도 충분히 검토할 가치가 큽니다.**

**애매한 케이스**

- p50이 12-24시간
    
- p90이 48-72시간
    

이 경우는  
**official purchase는 business confirmed로 두되**,  
Meta 학습 속도 보완용으로 `ViewContent`, `AddToCart`, `InitiateCheckout` 같은 상단 퍼널 신호를 더 강하게 넣는 쪽이 좋습니다. Meta도 CAPI를 later actions와 함께 쓸 수 있다고 설명하고, 현재 로드맵도 Signal Quality 확장에서 상단 퍼널 신호 확장을 병렬 우선순위로 잡고 있습니다. ([페이스북](https://www.facebook.com/business/help/AboutConversionsAPI?utm_source=chatgpt.com "About Conversions API | Meta Business Help Center"))

**나쁜 케이스**

- p50이 1일 이상
    
- p90이 3일 이상
    
- 7일 넘게 미확정인 비중이 큼
    

이 경우는  
**business confirmed를 Meta의 유일한 Purchase 학습 신호로 쓰는 건 위험할 수 있습니다.**  
왜냐하면 신호가 너무 늦고 희박해져서 최적화가 굼떠질 가능성이 커지기 때문입니다. 이때는

- 공식 ROAS는 business confirmed 유지
    
- 하지만 Meta 최적화 이벤트는 더 이른 신호를 별도로 검토  
    같은 2단 구조를 봐야 합니다.
    

## 3) 그럼 지금 방향은 어떻게 잡는 게 맞냐

저는 이렇게 가는 게 가장 현실적이라고 봅니다.

**원칙**

- **대표 성과판단 숫자**는 business confirmed
    
- **Meta 최적화 신호**는 실제 지연 분포를 측정한 뒤 결정
    

즉, 지금 당장 철학적으로 “무조건 business confirmed가 정답”이라고 박는 게 아니라,  
**business confirmed를 1안으로 두고, 실제 지연 분포를 보고 최종 채택**하는 게 맞습니다.

이게 중요한 이유는, 현재 문서 초안이 말하는 `confirmed = PURCHASE_CONFIRMATION`이 정말로

- “결제 직후 운영 확정”인지
    
- “배송/검수 이후 고객 구매확정”인지  
    비즈니스 흐름상 다를 수 있기 때문입니다. 문서만으로는 이 차이를 다 못 봅니다. 실제 데이터가 필요합니다.
    

## 4) 제가 권하는 당장 다음 액션

Codex에게 아래 그대로 던지면 됩니다.

“최근 90일 기준으로 site별/결제수단별 `PG paid -> Imweb PURCHASE_CONFIRMATION` 지연 시간 분포를 구해라.  
p50/p75/p90/p95, 24시간 내 confirmed 비율, 72시간 내 confirmed 비율, 7일 경과 미confirmed 비율, canceled/refunded 전환 비율을 표로 보여라.  
또 `payment_success logged_at -> business_confirmed_at` 기준 분포도 같이 보여라.  
카드 / 가상계좌 / 네이버페이 분리, biocom / thecleancoffee / aibio 분리.  
결과를 바탕으로  
A안: CAPI Purchase = business confirmed  
B안: CAPI Purchase = paid  
C안: official metric은 confirmed, optimization은 faster signal  
중 어떤 안이 맞는지 추천해라.”

## 제 최종 의견

정리하면 이렇습니다.

- **딜레이가 있는 confirmed 신호도 Meta는 쓸 수 있습니다.** later customer journey actions와 offline events도 최적화/측정에 쓸 수 있다고 Meta가 직접 설명합니다. ([페이스북](https://www.facebook.com/business/help/AboutConversionsAPI?utm_source=chatgpt.com "About Conversions API | Meta Business Help Center"))
    
- 하지만 **너무 늦고 너무 드문 신호면 학습은 둔해질 수 있습니다.** Meta도 learning phase의 불안정성과 학습 속도의 중요성을 분명히 말합니다. ([페이스북](https://www.facebook.com/help/messenger-app/650774041651557?utm_source=chatgpt.com "View campaign, ad set or ad delivery status in Meta Ads Manager | Messenger Help Center"))
    
- 그래서 이건 철학으로 결정할 일이 아니라, **실제 지연 분포를 Codex가 뽑아서 결정해야 하는 문제**입니다.
    
- 제 감으로는, 만약 `PURCHASE_CONFIRMATION`이 **몇 시간 - 하루 안쪽**이면 business confirmed CAPI가 꽤 유력하고,  
    **며칠 단위**면 official metric과 optimization signal을 분리하는 쪽이 더 현실적일 가능성이 큽니다.
    

Q1. TJ님 기준에서 `PURCHASE_CONFIRMATION`은 실제로 **결제 직후 운영 확정**에 가깝습니까, 아니면 **배송/검수/고객 구매확정 후행 단계**에 가깝습니까?  
Q2. Codex가 실제 지연 분포를 뽑으면, 그 결과에 따라 **CAPI Purchase 정책을 다시 결정**하는 방식으로 가시겠습니까?  
Q3. 만약 지연이 길게 나오면, **Official ROAS는 confirmed, Meta 최적화는 faster signal 보조** 구조를 허용하시겠습니까?