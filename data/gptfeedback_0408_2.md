결론부터 말하면, **실행은 잘 됐는데 문서는 아직 덜 닫혔습니다.**
코드는 분명 앞으로 갔습니다. `caller-coverage` 추가, biocom Imweb 주문 5,750건 sync, biocom reconcile 68.09%, Toss settlement 20,388건까지 확대, `/ads`와 `/ads/roas`의 기준 통일, GA4 3개 property direct access 확인까지는 꽤 큰 진전입니다. 그런데 같은 문서 안에 **최신 실행 결과와 예전 설명이 같이 남아 있어서**, 지금 상태로 팀 공용 정본처럼 쓰면 오히려 혼선을 만들 가능성이 큽니다.  

## 10초 요약

지금 핵심은 “무엇을 더 만들까”가 아니라, **문서 정합성부터 맞추고 진짜 blocker 1개를 박아야 하는 단계**입니다.
그 blocker는 여전히 **외부 caller의 GA 식별자 0%**입니다. 이게 안 붙으면 나머지 숫자는 다 좋아져도 마케팅 귀속은 계속 반쪽입니다.  

## 잘한 점

첫째, **이제 계획이 아니라 실행 결과가 생겼습니다.**
예전에는 “해야 한다”가 많았는데, 이번에는 실제로 돌려봤고 숫자가 나왔습니다. 이건 질적으로 다릅니다. 특히 biocom sync와 settlement backfill은 이제 “가능하다”가 아니라 “이미 돌아갔다”는 단계입니다. 

둘째, **GA4 접근성 이슈는 꽤 정리됐습니다.**
coffee direct access blocker가 사라졌고, biocom / coffee / aibio 3개 property 모두 Data API access가 `OK`로 확인됐습니다. 이건 Stage 1을 올려 잡아도 되는 근거입니다.  

셋째, **ROAS 기준 통일은 맞는 수정입니다.**
`/ads`와 `/ads/roas`가 서로 다른 source를 보던 문제를 고친 건 중요합니다. 적어도 앞으로는 한 화면에서 숫자가 충돌하는 황당한 상황은 줄어듭니다. 

넷째, **`caller-coverage`를 만든 건 매우 좋습니다.**
이제 “아직 안 붙은 것 같다”가 아니라, `ga_session_id / client_id / user_pseudo_id`가 실제로 0%라는 걸 바로 볼 수 있습니다. 문제를 감이 아니라 숫자로 보게 만든 겁니다. 

## 원인 3가지

### 1. 문서 안에 최신 결과와 예전 상태가 같이 남아 있음

무슨 일인지: 상단 Stage/A-1 업데이트는 **biocom sync 완료**라고 말하는데, 본문 3-3 Imweb는 아직도 `local imweb_orders는 thecleancoffee 1,937건만`이라고 적고 있습니다. P0 남은 액션과 1주 계획도 `biocom sync 실행`, `settlement backfill 실행`을 아직 해야 할 일처럼 적고 있습니다. 또 연결 강도 표의 `gaSessionId 2/306` 같은 분모도 최신 ledger 수치와 안 맞습니다.
왜 문제인지: 데이터 정합성 문서가 먼저 **문서 정합성**에서 흔들립니다.
결과 영향: 팀이 숫자보다 문서를 먼저 의심하게 됩니다. 이 상태로는 공용 정본으로 돌리기 위험합니다.  

### 2. 진짜 blocker는 아직도 caller 식별자 0%임

무슨 일인지: live `payment_success 452건` 기준 `ga_session_id`, `client_id`, `user_pseudo_id` coverage가 전부 0%입니다. backend와 ledger는 받을 준비가 끝났는데, 실제 checkout / payment_success caller가 안 보내고 있습니다.
왜 문제인지: 이게 안 붙으면 `GA4 ↔ 실제 결제` 연결은 계속 비게 됩니다.
결과 영향: 마케팅 귀속 정합성은 계속 참고용 수준에 머물고, `(not set)` 원인 추적도 진척이 느립니다. Stage 2의 완성도 74%는 약간 후합니다. 실질적으로는 아직 **빨간불 blocker**입니다.  

### 3. reconcile / backfill 숫자에 지연과 범위 경계가 섞여 있음

무슨 일인지: biocom reconcile은 `coverageRate 68.09%`까지 나왔지만, `missingInToss` 상단은 같은 날 최근 주문이 많고, biocom Imweb local history 시작점도 `2026-01-27`입니다. settlement는 20,388건까지 늘었지만 장거리 backfill의 완료 응답과 최종 coverage는 아직 안 닫혔습니다.
왜 문제인지: 지금 숫자에는 **실제 누락**, **PG 반영 지연**, **히스토리 범위 경계**가 섞여 있습니다.
결과 영향: 68.09%를 있는 그대로 “정합성 나쁨”으로 읽거나, settlement 20,388건을 “순매출 기준 닫힘”으로 읽으면 둘 다 틀릴 수 있습니다. 지금 필요한 건 총량이 아니라 **age bucket**과 **완료 신호**입니다.  

## 해결 액션 3단계

### 지금 당장(오늘)

1. **문서 stale 문장부터 정리하세요.**
   최소 수정 대상은 4개입니다.

   * 3-3 Imweb 본문
   * P0 “아직 남은 운영 액션” 2번, 3번
   * 1주 계획의 `biocom sync 추가`, `settlement backfill 확대`
   * 연결 강도 표의 낡은 분모/설명
     이 문서가 정리되지 않으면, 다음 논의가 전부 흐려집니다. 

2. **문서 맨 위에 `0408 실행 스냅샷` 박스를 따로 두세요.**
   예를 들면 이렇게요.

   * caller coverage: 0%
   * biocom Imweb orders: 5,750
   * biocom reconcile: 68.09%
   * toss_settlements: 20,388
   * GA4 direct access: 3/3 OK
     이 5줄이면 현재 상태가 바로 보입니다. 

### 이번 주

1. **외부 caller 수정이 1순위입니다.**
   지금은 다른 어떤 작업보다 이게 먼저입니다. `ga_session_id / client_id / user_pseudo_id`가 실제로 들어오기 시작해야 Stage 2가 앞으로 갑니다. 안 그러면 문서만 좋아지고 본질은 그대로입니다.  

2. **biocom reconcile은 raw coverage 대신 age bucket으로 쪼개세요.**
   최소한 아래 4개는 나눠야 합니다.

   * 0-1일
   * 2-7일
   * 8-30일
   * 31일 이상
     이렇게 나눠야 “최근 주문 지연”과 “진짜 누락”을 구분할 수 있습니다. 지금 68.09% 하나로는 판단이 거칠어요. 근거가 되는 문장도 이미 문서에 있습니다. 최근 주문 지연 가능성을 직접 적어놨습니다.  

3. **settlement backfill은 완료 신호를 남겨야 합니다.**
   지금은 적재는 됐는데 “끝났는지”가 없습니다. `run_id`, `started_at`, `finished_at`, `pages_read`, `rows_added`, `done=true/false` 정도는 남겨야 운영 루틴에 넣을 수 있습니다. 지금 상태는 계산은 돌아가도 운영이 믿기 어렵습니다.  

4. **ROAS는 `confirmed only`와 함께 lag 경고를 붙이세요.**
   confirmed-only는 맞는 기준입니다. 다만 pending 금액이 아직 크기 때문에 같은 날 숫자는 낮게 보일 수 있습니다. 그래서 `오늘 수치는 잠정치`라는 문구나, `observed revenue / confirmed revenue` 2줄을 같이 보여주는 게 낫습니다. 그렇지 않으면 운영팀이 “ROAS가 갑자기 떨어졌다”고 오해할 수 있습니다. 

5. **P3 첫 operational live는 더 미루면 안 됩니다.**
   지금은 정합성 보강과 병렬로 실제 1건을 보내야 합니다. 이건 문서 방향과도 맞습니다. 단, 시나리오는 1개로 고정하세요. 여러 개 돌리면 또 흐려집니다. 

### 다음 배치

1. **customer spine은 스키마만이 아니라 merge confidence까지 넣는 게 좋습니다.**
   현재 문서의 `normalized_phone 우선`은 실무적으로 빠르지만, 잘못 합치면 되돌리기 어렵습니다.
   추천은 이겁니다.

   * `person_id`
   * `match_basis`
   * `confidence`
   * `merged_at`
   * `merged_by_rule`
     전화번호 하나만으로 영구 병합하지 말고, “강한 연결”과 “임시 연결”을 구분하세요. 이건 다음 실험과 LTV 계산 품질을 크게 좌우합니다. 

2. **BigQuery legacy는 병렬 확인으로 두되, 이번 주 핵심 엔지니어링 시간을 먹게 두지 마세요.**
   지금 문서도 이걸 blocker로 보지 않는다고 적고 있습니다. 이 판단이 맞습니다. 이번 주 핵심은 caller, reconcile, backfill, P3 live입니다. 

## 제 최종 판단

냉정하게 말하면, **실행은 한 단계 올라갔고, 문서는 아직 한 단계 덜 올라갔습니다.**
그래서 지금 필요한 건 새 아이디어가 아니라 아래 4개입니다.

1. 문서 stale 상태 제거
2. caller 식별자 실제 유입
3. reconcile / backfill을 “총량”이 아니라 “완료/지연/누락”으로 분리
4. P3 첫 operational live 실제 발송

한 줄로 다시 쓰면:

> **지금은 데이터 정합성 작업이 아니라, `문서 정합성 + caller patch + coverage 해석 방식 보정 + 첫 live 실행`으로 넘어가야 하는 시점**입니다.  

Q1. 외부 checkout / payment_success caller 수정 담당자와 적용 위치는 이미 정해졌습니까?
Q2. biocom reconcile을 `0-1일 / 2-7일 / 8-30일 / 31일 이상`으로 쪼개서 다시 볼 수 있습니까?
Q3. P3 첫 operational live는 어떤 세그먼트 1개로 고정할 생각입니까?
