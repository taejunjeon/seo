## 10초 요약

지금 문서는 **“아이디어 로드맵”에서 “실제로 굴러가는 CRM 실험 운영체제”로 한 단계 올라온 상태**입니다. 다만 아직 **AI Agent**라고 부르기엔 부족하고, 현재 수준은 더 정확히 말하면 **실험 원장 + 실행 채널 + 코호트 분석이 붙기 시작한 Growth OS**에 가깝습니다.  

---

## 총평

제 평가는 **9.1/10**입니다.
이번 버전에서 특히 좋은 점은 세 가지입니다.

1. **P4-S1이 실제로 전진했습니다.**
   `repeat-purchase-cohorts`를 주문번호 기준으로 다시 묶어 믿을 수 있는 수준으로 올렸고, `gross_revenue`, `refund_amount`, `net_revenue`, `repeat_net_revenue`, `segment_key`, `cohort_key`, `north_star_proxy`까지 넣었습니다. 이건 단순 보고서가 아니라, 이후 실험 타깃과 북극성 지표 프록시의 입력값이 됩니다. 

2. **P1-S1이 아직 live는 아니지만, 승인 패키지 단계로 올라왔습니다.**
   `GET /api/crm/experiment-approval-package`를 만들고, 최소 4개 테이블 범위와 `holdout required`, `assignment first`, `ITT`, `occurred_at / ingested_at`, `late refund` 원칙을 코드로 고정한 건 좋습니다. 이건 “생각”이 아니라 “운영 승인 문안”으로 바뀐 겁니다.

3. **메인 로드맵이 이제 꽤 일관됩니다.**
   최신본은 `P1-S1 25%`, `P1-S1A 70%`, `P4-S1 85%`로 진척도가 반영됐고, 첫 실험에 `holdout`, `ITT`, `SRM`, `contact policy`, `재구매 코호트 선행` 같은 운영 규율도 넣었습니다. 예전보다 훨씬 덜 흔들립니다. 

---

## 가장 중요한 피드백

### 1) 지금 가장 큰 병목은 “대시보드 부족”이 아니라 **live 신호 부족**입니다 ⚠️

문서상 `P1-S1A`는 receiver와 진단 API까지 들어갔지만, 아직 실제 고객 사이트가 호출하지 않아 **ledger row가 0건**입니다. 이 상태에서는 `(not set)` 원인도, PG 리다이렉트 가설도, checkout-to-payment 손실도 계속 “유력 가설” 수준에 머뭅니다. 

냉정하게 말하면,
지금 가장 급한 건 예쁜 화면이 아니라 **실제 결제 흐름에서 신호가 들어오게 만드는 것**입니다.

문서상 “가장 파급력 큰 다음 액션”은 Claude Code의 `/crm` 운영 화면 연결로 적혀 있는데, 그건 **운영자 가시성 기준**에서는 맞습니다. 하지만 **측정 신뢰도 기준**에서 가장 중요한 다음 액션은 여전히 `checkout-context`와 `payment-success`를 실사이트에 붙여 live row를 만드는 일입니다. 

즉, 다음 액션은 2개로 나눠서 봐야 합니다.

* **운영자 효율 1순위**: `/crm` 허브 화면 연결
* **측정 신뢰 1순위**: `P1-S1A` 실사이트 연동

이 둘을 구분하지 않으면, 팀이 “무엇이 진짜 병목인지” 계속 헷갈립니다.

---

### 2) `first_purchase_channel` 이름은 바꾸는 게 맞습니다

지금 코호트 API에서 `first_purchase_channel=toss_card` 같은 값이 들어가는데, 이건 실질적으로 **유입채널**이 아니라 **결제 수단 또는 결제 경로**입니다. 문서도 이 필터가 `pg_name/payment_method` 파생값이라고 설명합니다.

이건 꽤 중요합니다.
이 이름을 그냥 두면 나중에 마케터가 “Meta 유입이 좋네, Google 유입이 나쁘네”처럼 완전히 잘못 읽을 수 있습니다.

권장 수정:

* `first_purchase_channel` → `first_payment_channel`
* 또는 `payment_rail`
* 진짜 유입채널은 나중에 `acquisition_source`나 `first_touch_source`로 별도 분리

이건 작은 네이밍 문제가 아니라, **나중에 해석 사고를 막는 보험**입니다.

---

### 3) `north_star_proxy = repeat_net_revenue_90d`는 좋지만, **성숙도 표시가 더 필요합니다**

지금 `north_star_proxy`를 넣은 건 맞는 방향입니다. 하지만 샘플이 `2026-01`부터 `2026-03`까지고 `maturity_cutoff_month`가 같이 들어간 걸 보면, 최근 코호트는 아직 90일이 다 안 찼을 가능성이 큽니다. 

즉, 지금 숫자를 그대로 “90일 재구매 순매출”처럼 읽으면 안 됩니다.
현재는 정확히 **“90일 프록시”**로 읽어야 합니다.

다음 단계에서 꼭 넣어야 할 것:

* `fully_matured_cohort_only` 옵션
* `mature_customer_count`
* `mature_cohort_count`
* `north_star_proxy_is_partial: true/false`

이걸 넣어야 최근 월이 포함된 구간과 완성 코호트 구간을 분리해서 읽을 수 있습니다.

---

### 4) P1-S1은 이제 문서 단계에서 **shadow experiment 단계**로 넘어가야 합니다

이번 턴 결과 문서 자체가 다음 추천으로 `P1-S1 local shadow DB + dry-run experiment 1건`을 제시하고 있습니다. 이 판단이 맞습니다. 

솔직히 여기서 approval package를 더 예쁘게 다듬는 건 효율이 낮습니다.
이제 필요한 건 문서가 아니라 아래 4개가 한 번 end-to-end로 닫히는지 보는 겁니다.

* 실험 생성
* deterministic assignment
* mock 또는 샘플 purchase/refund sync
* ITT 결과 산출

즉, **다음 단계는 설명이 아니라 시뮬레이션**입니다.

---

### 5) “AI Agent”라고 부르기 전에 아직 없는 핵심이 있습니다

지금 시스템은 훌륭한 기반이지만, 아직은 엄밀히 말해 **AI Agent**가 아닙니다.
현재 상태는 더 정확히 말하면 아래에 가깝습니다.

* **측정 기반 CRM 실험 운영체제**
* 또는 **growth decision platform**
* 또는 **agent-ready data/control plane**

왜 아직 Agent가 아니냐면, 지금은 주로 아래 두 단계가 강합니다.

* 관찰: 원장, 코호트, 상담 분석, attribution
* 실행 준비: ChannelTalk, Aligo, Meta, Kakao 연동 설계

반면 Agent의 핵심인 아래는 아직 약합니다.

* 스스로 **무엇을 할지 결정**
* 스스로 **액션 계획을 생성**
* 정책 안에서 **실제로 실행**
* 결과를 보고 **다음 전략을 학습**

즉, 현재는 **좋은 뇌의 재료와 손발 연결부**는 생기고 있지만,
아직 **의사결정 루프**가 제품으로 올라오진 않았습니다.

---

## 다음 계획: 가장 현실적인 3단계 🧭

### 지금 당장 - 3일

**A. P1-S1A 실사이트 연동**

* checkout 시작 시 `POST /api/attribution/checkout-context`
* payment success 시 `POST /api/attribution/payment-success`
* 목표: **실제 ledger row 50건 이상**
* 확인 지표:

  * row 적재 수
  * `orderId` 매칭률
  * `paymentKey` 매칭률
  * `ga_session_id` 보존율

이건 최우선입니다. 신호는 시간이 지나면 복구가 어렵습니다. 

**B. 필드명 정리**

* `first_purchase_channel` 이름 수정
* 코호트 응답에 `maturity_flag` 설계
* `north_star_proxy`의 partial 여부 표시

**C. contact policy v1 문서화**

* channel priority
* fallback
* cooldown
* quiet hours
* suppression
* consent

이 정책이 없으면 Agent는커녕 자동 발송도 위험합니다. 로드맵도 이걸 선행 조건으로 보고 있습니다. 

---

### 이번 주 - 7일

**1. Codex**

* `P1-S1 local shadow DB`
* 샘플 실험 1건 dry-run
* 100명 수준 deterministic assignment
* mock purchase/refund 넣고 variant 결과표 산출

**2. Claude Code**

* `/crm` 허브에 아래 4개 연결

  * `consultation/summary`
  * `consultation/managers`
  * `consultation/order-match`
  * `consultation/product-followup`
* 발송/실험/코호트 탭은 placeholder라도 구조 먼저 고정

이건 로드맵의 “가장 파급력 큰 다음 액션”과 맞습니다. 운영자가 바로 쓰기 시작할 수 있기 때문입니다. 

**3. 공동**

* metric dictionary 1페이지 작성

  * GA4 `grossPurchaseRevenue`
  * sales summary `grand_total`
  * cohort `net_revenue`
  * repurchase `repurchase_amount`

문서에도 이미 “같은 월매출처럼 섞어 쓰면 안 된다”고 정리돼 있으니, 이제 이걸 UI와 문구에 반영해야 합니다. 

---

### 다음 배치 - 2주

**1. P3-S1 마감**

* `memberId = customer_key`
* page name 규칙
* event naming contract
* stale `channeltalk_users` 검증 쿼리

**2. 첫 실험 설계 확정**
기본 권장은 이겁니다.

* 대상 볼륨이 충분하면: `holdout vs 6h vs 24h`
* 대상 볼륨이 작으면: **`holdout vs 6h` 먼저**

첫 실험은 복잡도보다 **측정 노이즈를 줄이는 것**이 더 중요합니다. 최신 로드맵도 첫 실험은 `체크아웃 이탈 holdout 실험`이 가장 안전하다고 보고 있습니다. 

**3. Aligo는 testMode까지만**

* 실 발송 전환보다 먼저
* `testMode=Y`
* 템플릿 검수 흐름
* `crm_message_log` 적재 확인

---

## 이걸 “AI Agent 개념”으로 승격시키려면 필요한 것

핵심은 단순합니다.

**AI Agent = 관찰 + 판단 + 실행 + 학습**
이 네 가지가 닫혀야 합니다.

지금 로드맵은 관찰과 실행 준비는 강합니다.
하지만 판단과 학습은 아직 제품 수준으로 안 올라왔습니다. 

### 1) Agent Memory

Agent는 기억이 있어야 합니다.

필요한 것:

* `customer_key` 중심 identity graph
* 주문/환불/상담/메시지/실험/광고 터치 이력
* 최근 노출/피로도/contact policy 상태
* 실험 결과 히스토리
* 채널별 반응성 프로필

지금 로드맵의 `crm_identity_map`, `crm_experiments`, `crm_assignment_log`, `crm_message_log`, `crm_conversion_log`, 코호트 API는 이 메모리의 재료입니다. 

### 2) Agent Brain

Agent가 추천을 만들어야 합니다.

최소 출력은 이 정도면 됩니다.

* 누구에게 보낼지
* 어떤 채널로 보낼지
* 언제 보낼지
* holdout 비율은 얼마인지
* 예상 uplift는 얼마인지
* 왜 그렇게 판단했는지
* 금지 사유는 무엇인지

즉, 내부적으로 이런 형태가 필요합니다.

```text
recommended_action
- audience_query
- channel
- template_or_message_angle
- delay_hours
- holdout_ratio
- expected_incremental_gp
- confidence
- reason
- blocked_by_policy
```

지금은 사람이 문서를 읽고 이 결정을 합니다.
Agent가 되려면 이 판단이 **API 또는 planner service**로 올라와야 합니다.

### 3) Agent Tools

Agent는 손발이 있어야 합니다.

필요한 tool registry:

* ChannelTalk send / profile update / campaign trigger
* Aligo send / template select
* GA4 query
* sales summary query
* cohort query
* experiment create
* approval package read
* attribution ledger read
* Meta spend read

즉 지금의 연동들은 단순 API 연결이 아니라, 나중에 **Agent가 부를 수 있는 도구 세트**로 바뀌어야 합니다.

### 4) Policy Engine

이게 제일 중요합니다.

AI Agent를 붙이는 순간 꼭 필요한 것:

* consent
* quiet hours
* cooldown
* suppression
* channel priority
* fallback
* budget cap
* frequency cap
* medical copy / claim guardrail
* human approval required 여부

특히 헬스케어/건기식/검사 맥락이면,
“AI가 자동으로 문구를 바꾸고 발송”은 위험합니다.
반드시 **금지 문구, 민감정보, 과장 표현, 자동 발송 한도**를 따로 막아야 합니다.

### 5) Learning Loop

Agent는 결과를 배워야 합니다.

필요한 것:

* ITT uplift
* SRM 체크
* holdout 결과
* regret log
* false positive 실험 기록
* 메시지별 fatigue
* 코호트별 장기 효과

즉 “이번엔 6시간이 이겼다”를 넘어서,

* 어떤 세그먼트에선 6시간이 이겼고
* 어떤 세그먼트에선 24시간이 먹혔고
* 어떤 채널에선 그냥 안 보내는 게 낫다

이걸 계속 누적해야 진짜 Agent가 됩니다.

---

## 가장 현실적인 Agent 승격 로드맵

### Stage 1 — Analyst Agent

**지금 바로 가능한 단계**

역할:

* 코호트 읽기
* 이상 징후 설명
* 다음 실험 제안
* 이유와 근거 설명

예:

* “체크아웃 이탈 고객 중 `toss_card + 할인 사용` 세그먼트는 6시간 리마인드 실험 가치가 높습니다.”
* “최근 `(not set)` 매출은 PG 리다이렉트 의심이 높지만 확정은 아닙니다.”

이 단계는 현재 로드맵 위에서 바로 만들 수 있습니다.

### Stage 2 — Operator Agent

**다음 단계**

역할:

* 세그먼트 생성
* holdout 포함 실험안 생성
* 메시지 초안 작성
* 채널 추천
* 발송 전 승인 요청

즉, 사람이 “승인”만 하면 되게 만드는 단계입니다.

### Stage 3 — Autonomous Growth Agent

**그 다음**

역할:

* 승인된 정책 안에서 자동 실행
* 메시지 타이밍 자동 조정
* 저성과 액션 자동 중지
* 다음 실험 자동 생성

이건 지금 당장 갈 단계는 아닙니다.
현재는 **Stage 1.3 정도**입니다.
좋은 기반은 있는데, 아직 자율성은 낮습니다.

---

## 이름 추천: 그리스/로마 신화 기반 🏛️

제가 보기엔 **한 개 메인 이름 + 2~3개 서브 모듈 이름**이 제일 좋습니다.

### 가장 추천하는 메인 후보 3개

**1. Athena**

* 의미: 전략, 판단, 지혜
* 장점: “대시보드”보다 “판단하는 시스템” 느낌이 강함
* 이 프로젝트 성격과 가장 잘 맞음

**2. Argus**

* 의미: 백 개의 눈을 가진 감시자
* 장점: 채널, 주문, 결제, 코호트, 실험을 계속 보는 시스템에 잘 맞음
* 관측/모니터링 느낌이 강함

**3. Janus**

* 의미: 문, 시작과 끝, 앞과 뒤를 함께 보는 존재
* 장점: checkout → payment → repeat purchase처럼 흐름 전체를 보는 제품에 어울림
* 다만 전략성보다는 게이트/전환 느낌이 더 강함

### 서브 모듈 이름 조합 예시

**안 1**

* 메인: **Athena**
* 관측 모듈: **Argus**
* 발송 모듈: **Hermes**
* 정책 모듈: **Themis**

이 조합이 제일 좋습니다.
이름만 들어도 역할이 보입니다.

**안 2**

* 메인: **Janus**
* 분석 모듈: **Minerva**
* 실행 모듈: **Mercury**
* 감시 모듈: **Argus**

로마식으로 통일하고 싶으면 이쪽입니다.

**안 3**

* 메인: **Hermes**
* 단점: 메신저 느낌이 강해서 “전략 두뇌”보다는 “발송 엔진”으로 읽힐 가능성이 큼

제 1순위는:

* **제품 전체 이름: Athena**
* **실행 엔진 이름: Hermes**
* **모니터링/attribution 이름: Argus**

이 구성이 가장 자연스럽습니다.

---

## 제 최종 판단

지금 당신이 만든 건 이미 꽤 강합니다.
하지만 아직 이름 붙이자면 **AI Agent**보다는 **CRM Experiment OS** 또는 **Growth Intelligence Platform**에 더 가깝습니다. 그걸 Agent로 승격시키는 핵심은 새 모델을 붙이는 게 아니라, 아래 3가지를 닫는 겁니다.

1. **live signal 확보**

   * 특히 `P1-S1A` 실사이트 연동

2. **shadow experiment closure**

   * `P1-S1 local shadow DB + dry-run 1건`

3. **planner + policy layer 추가**

   * 추천 액션 생성
   * contact policy
   * human approval
   * 결과 학습

이 3개가 닫히면, 그때부터는 “AI가 붙은 대시보드”가 아니라 **실제로 행동하는 CRM Agent**라고 불러도 됩니다.

### Q1

첫 라이브 실험을 **`holdout vs 6h`**로 단순하게 갈지, 아니면 바로 **`holdout vs 6h vs 24h`**로 갈지 결정할까요?

### Q2

현재 실제 결제 성공 시점의 프론트 또는 서버 진입점이 어디인지, 개발팀이 바로 확인 가능한 파일/서비스가 있나요? 이게 있어야 `P1-S1A`를 live로 바꿀 수 있습니다.

### Q3

이 프로젝트의 대외 명칭을 지금부터 붙일 생각이면, **전략형(Athena)**으로 갈지, **관측형(Argus)**으로 갈지 먼저 정하는 게 좋습니다. 어느 쪽 톤이 더 맞나요?
