According to a document from 2026-03-26, 지금 상태 기준 제 판단은 이렇습니다.  
이 자료는 당신 솔루션에 꽤 중요합니다. 다만 핵심은 **“Braze MCP를 도입하자”**가 아니라 **“증분 실험 설계를 제품에 넣자”**입니다. 현재 스택은 이미 revenue/CX-OPS 쪽에 실매출·주문·LTR·재구매가 있고, seo 쪽에 GA4 기반 AI 유입/퍼널/AI vs Organic 비교가 있으며, 로드맵도 Phase 5를 **미니 Braze → 컨트롤 그룹 → iROAS → Braze 도입 ROI 판단** 순서로 잡아두고 있습니다. 또 당신 문서 자체가 지금 구조에서는 정확한 session-to-order의 user-level attribution이 어렵다고 정리합니다. 그래서 지금 가장 먼저 필요한 것은 AI 인터페이스가 아니라,** 실험 배정·발송·노출·구매를 한 줄로 잇는 원장(log ledger)** 입니다.

세미나 메모의 요점도 같은 방향입니다. **MMP 클릭 중심 측정은 view-through와 자기잠식(cannibalization)을 놓치기 쉽고, 그래서 컨트롤 그룹과 임프레션 관점으로 봐야 한다**는 메시지였습니다. 이건 당신 솔루션의 Retention/CRM 단계에는 분명히 필요한 관점입니다.

## 무엇이 진짜 필요한가

**지금 필수**는 세 가지입니다.  
첫째, **Apple-to-Apple 실험 설계**입니다. 같은 진입 시점, 같은 전환 윈도우, 무작위 분할이 있어야 합니다.  
둘째, **send/impression/open/click/purchase/cancel** 로그를 유저 단위로 남기는 것입니다.  
셋째, **incremental revenue만 분자로 쓰는 사고방식**입니다. 자연전환 매출까지 먹으면 iROAS가 아니라 “착시 ROAS”가 됩니다.

**나중에 유용한 것**은 Braze Currents→Amplitude, 글로벌 홀드아웃, Braze MCP입니다. Braze 공식 문서상 Currents는 Braze 이벤트를 Amplitude로 내보내 deeper analytics를 하게 해주고, MCP는 Braze 데이터와 도구를 Claude/Cursor 같은 AI 클라이언트에서 자연어로 다루게 해주는 계층입니다. 즉 둘 다 강력하지만, 둘 다 **기초 계측과 실험 원장 다음 단계**입니다. ([Braze](https://www.braze.com/docs/partners/data_and_analytics/customer_data_platform/amplitude/amplitude_for_currents/ "https://www.braze.com/docs/partners/data_and_analytics/customer_data_platform/amplitude/amplitude_for_currents/"))

**지금 당장 없어도 되는 것**은 “1938%” 같은 숫자 자체입니다. 그 숫자는 원칙을 보여주는 예시이지, 당신 솔루션의 목표치가 아닙니다. iROAS는 객단가, 실제 순증분 CVR, 메시지 단가, 할인비용, 환불, 전환 윈도우에 따라 크게 흔들립니다.

## GA4로 먼저 할지, Braze MCP를 바로 할지

제 추천은 아주 명확합니다.  
**GA4 먼저**, 정확히는 **GA4 + 자체 실험 로그 + 미니 Braze/카카오 발송 파이프라인**으로 시작하세요.  
그리고 **Braze는 제품 자체를 나중에 판단**하세요.  
**Braze MCP는 그보다 더 나중**입니다. 🙂

이유는 간단합니다. **GA4와 Braze MCP는 같은 레이어가 아닙니다.**  
GA4는 이벤트, 유입, 오디언스, key event, acquisition을 보는 **측정 계층**이고, Google의 Measurement Protocol로 서버사이드/오프라인 이벤트도 보강할 수 있습니다. 반면 Braze는 Canvas, conversion event, Experiment Paths, Global Control Group, Webhooks 같은 **오케스트레이션·실험 계층**입니다. MCP는 그 Braze를 AI가 다루기 쉽게 만드는 **운영 인터페이스**일 뿐이고, Braze 공식 문서상 아직 beta입니다. ([구글 도움말](https://support.google.com/analytics/answer/12799087?hl=en "https://support.google.com/analytics/answer/12799087?hl=en"))

당신 현재 문서와도 이 순서가 맞습니다. 이미 Phase 5가 “미니 Braze 실험 → 컨트롤 그룹 → iROAS → Braze ROI 계산”으로 설계돼 있고, Amplitude도 “GA4 한계 체감 시” 검토로 잡혀 있습니다. 지금 여기서 Braze MCP를 먼저 붙이면, **문제의 핵심인 증분 측정**이 아니라 **운영 편의성**부터 사는 셈이 됩니다.

다만 예외는 있습니다.  
이미 내부적으로 “우리는 곧 다채널 CRM을 많이 돌릴 것”, “마케터가 엔지니어 도움 없이 Canvas/실험을 운영해야 한다”, “빈도제어, journey, holdout, webhook orchestration이 바로 필요하다”가 확실하면 **Braze 제품 자체**를 빨리 가는 건 합리적입니다. 그래도 그 경우도 **Braze MCP가 먼저**는 아닙니다. 먼저 Braze 제품 fit을 확인해야 합니다. Braze는 Canvas와 Experiment Paths로 지연·카피·채널 조합 실험을 지원하고, Global Control Group으로 상시 holdout도 운영할 수 있습니다. ([Braze](https://www.braze.com/docs/user_guide/engagement_tools/canvas/canvas_components/experiment_step/ "https://www.braze.com/docs/user_guide/engagement_tools/canvas/canvas_components/experiment_step/"))

또 하나. 카카오/알림톡 중심이면 채널 fit을 반드시 확인해야 합니다. 제가 본 Braze 공식 문서에서는 Webhooks가 **Braze가 직접 지원하지 않는 채널로 메시지를 보내는 용도**까지 명시돼 있습니다. 그래서 한국형 AlimTalk 중심 구조라면, 처음부터 “Braze native 채널”보다는 **Braze + webhook/provider** 구조를 가정하는 편이 더 안전합니다. ([Braze](https://www.braze.com/docs/user_guide/message_building_by_channel/webhooks/ "https://www.braze.com/docs/user_guide/message_building_by_channel/webhooks/"))

## iROAS가 정확히 뭔가

정의는 아주 단순합니다.

```text
iROAS = Incremental Revenue / Marketing Cost
```

여기서 중요한 건 **Incremental Revenue**입니다.  
즉, “실험군이 대조군보다 추가로 만들어낸 매출”만 분자에 들어갑니다.

실무식으로 쓰면 보통 이렇게 봅니다.

```text
Incremental Revenue
= (실험군 1인당 매출 - 대조군 1인당 매출) × 실험 대상 인원
```

혹은 마진 기준으로 더 보수적으로 보려면 revenue 대신 **incremental gross profit**을 넣는 게 더 좋습니다. 할인·쿠폰·배송비 보조가 크면 revenue보다 profit이 더 정직합니다.

이게 왜 중요하냐면, 세미나 자료가 지적한 문제 때문입니다.  
클릭 기반 MMP/어트리뷰션은 “누가 마지막 클릭을 가져갔나”를 보지만, iROAS는 “메시지를 안 보냈어도 샀을 사람을 빼고, 진짜 추가 구매가 생겼나”를 봅니다. 그래서 **view-through를 놓치지 않고**, 동시에 **자기잠식도 걸러낼 수 있습니다.**

### 1938% 슬라이드의 뜻

그 슬라이드는 “마법”이 아니라 **저렴한 메시지 단가 × 작은 순증분 lift × 높은 객단가**의 조합을 보여주려는 예시로 보입니다.

화면상 보이는 값만 보면

- 발송 단가 약 20원
    
- 객단가 약 53,000원
    
- 결과 1,938%
    

이라서 바로는 계산이 안 맞아 보입니다.  
역산해보면, 그 사이에 **순증분 전환율 term**이 하나 숨어 있어야 맞습니다. 이 결과가 나오려면 필요한 절대 uplift는 약 **0.73%p**입니다. 즉 개념적으로는:

```text
(53,000원 × 0.73%) / 20원 ≈ 1,938%
```

정도가 됩니다. 그래서 CRM 메시지는 발송비가 워낙 작아서, **아주 작은 절대 전환 uplift만 있어도 iROAS가 크게 튈 수 있다**는 뜻입니다. 하지만 이 수치는 어디까지나 예시이고, 실제 값은 audience quality와 cannibalization에 따라 크게 달라집니다.

### 6시간 vs 1일 슬라이드의 뜻

이건 “무조건 1일이 낫다”가 아니라, **총량(totality)과 효율(efficiency)의 trade-off를 실험으로 보자**는 뜻입니다.  
그리고 당신 메모에 있던 “캔버스가 엔트리 되자마자 타이머가 돌기 시작했다”는 해석은 맞습니다. Braze Experiment Paths 문서도 **전환 윈도우는 downstream 메시지 발송 시점이 아니라 Experiment step 진입 시점부터 시작**하고, 중간의 Delay가 있으면 그 시간이 conversion window를 먹는다고 설명합니다. 그래서 6h vs 24h를 공정하게 비교하려면 **같은 entry point**와 **같은 tracking logic**가 꼭 필요합니다. ([Braze](https://www.braze.com/docs/user_guide/engagement_tools/canvas/canvas_components/experiment_step/ "https://www.braze.com/docs/user_guide/engagement_tools/canvas/canvas_components/experiment_step/"))

## 그러면 지금 당신 솔루션에서 어떻게 가는 게 맞나

가장 현실적인 순서는 이겁니다.

1. **실험 원장 테이블부터 만든다.**  
    `experiment_id, user_id, variant(control/treatment), assigned_at, send_at, impression_at, click_at, purchase_at, purchase_amount, refund_amount, channel_cost` 정도면 시작할 수 있습니다. 지금 revenue 쪽에 실매출과 주문 데이터가 있으니 이 레이어를 붙이는 게 제일 중요합니다.
    
2. **한 개 시나리오만 먼저 증분 실험한다.**  
    예를 들면 “상품조회 후 미구매”나 “체크아웃 이탈”입니다. 모수가 작으면 글로벌 1~5% 홀드아웃보다 **campaign-level 50:50**이 더 낫습니다. Braze 가이드도 global control은 보통 최소 1,000명 이상, 대체로 전체의 10% 이내를 권장하므로, 작은 audience에서 1~5%는 너무 작을 수 있습니다. ([Braze](https://www.braze.com/docs/user_guide/engagement_tools/testing/global_control_group/ "https://www.braze.com/docs/user_guide/engagement_tools/testing/global_control_group/"))
    
3. **GA4에는 실험 이벤트를 보강 수집만 한다.**  
    `experiment_assigned`, `crm_message_sent`, `crm_message_impression`, `crm_purchase` 같은 이벤트를 Measurement Protocol로 넣으면 GA4 보고서에서도 흐름을 볼 수 있습니다. 다만 Google 문서도 Measurement Protocol은 자동 수집을 **보강**하는 용도라고 설명합니다. 즉, **iROAS의 정답 테이블은 GA4가 아니라 DB/warehouse SQL**에 있어야 합니다. ([Google for Developers](https://developers.google.com/analytics/devguides/collection/protocol/ga4 "https://developers.google.com/analytics/devguides/collection/protocol/ga4"))
    
4. **2~3개 use case에서 증분이 반복적으로 나오면 그때 Braze를 판단한다.**  
    그 시점부터는 Braze의 Canvas, Experiment Paths, Global Control Group, Webhooks, 그리고 필요하면 Currents→Amplitude가 큰 가치가 있습니다. 하지만 그 전에는 Braze MCP보다 **실험 설계와 데이터 정합성**이 훨씬 중요합니다. ([Braze](https://www.braze.com/docs/partners/data_and_analytics/customer_data_platform/amplitude/amplitude_for_currents/ "https://www.braze.com/docs/partners/data_and_analytics/customer_data_platform/amplitude/amplitude_for_currents/"))
    

한 줄로 정리하면,  
**지금 필요한 건 Braze MCP가 아니라 “GA4를 보조 계측기로 쓰면서, 자체 실험 로그와 실제 주문 데이터를 연결해 iROAS를 계산하는 구조”입니다.**  
Braze는 그 다음에 붙일 **오케스트레이션 엔진**이고, MCP는 그 Braze를 더 편하게 운용하게 해주는 **운영 레이어**입니다.

다음 단계는 **체크아웃 이탈 1개 시나리오의 실험 이벤트 스키마를 먼저 고정하는 것**입니다.