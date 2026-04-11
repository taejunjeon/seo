아래 그대로 Codex에게 붙여넣으면 됩니다.

```text
목표:
biocom CAPI dedup 수정(post-fix)이 실제로 먹혔는지 확인하라.
핵심 질문은 1개다.
“2026-04-10 post-fix 이후 운영 auto_sync 로그에서 같은 주문+Purchase가 서로 다른 event_id로 다시 보내지고 있는가?”

중요:
이번 작업은 “수정했다”를 확인하는 게 아니라 “수정 효과가 실제 운영 로그에 반영됐는지”를 확인하는 작업이다.
post-fix 이후 운영 로그가 아직 없으면 성공이라고 쓰지 말고, “아직 판정 불가”라고 명확히 써라.
추정으로 완료 처리 금지.

확인 범위:
1. 최근 운영 CAPI 로그
2. post-fix 이후만 분리
3. duplicate-risk가 3그룹에서 0 또는 거의 0으로 내려갔는지 확인
4. payment_success 식별자 품질도 같이 확인
5. 필요하면 biocom Imweb 주문 캐시와 Toss 결제 1:1 대조로 보조 검증

반드시 실행할 API/검증:
1.
GET /api/meta/capi/log?limit=500&scope=recent_operational&since=2026-04-10T00:00:00.000Z&include_dedup_candidates=1&dedup_candidate_limit=10

2.
GET /api/meta/capi/log?limit=500&scope=recent_operational&since_days=7&include_dedup_candidates=1&dedup_candidate_limit=10

3.
GET /api/attribution/caller-coverage

4.
GET /api/crm-local/imweb/order-stats?site=biocom

5. 필요시
GET /api/crm-local/imweb/toss-reconcile?site=biocom&lookbackDays=90&limit=5

검증 포인트:
A. post-fix 이후 CAPI dedup
- total
- success
- operational/manual/test
- duplicateEventIds
- duplicateOrderEventGroups
- retryLikeGroups
- retryLikeRows
- multiEventIdGroups
- multiEventIdRows
- dedupCandidateDetails

B. 가장 중요한 판정
- post-fix 이후 multiEventIdGroups가 0인지
- 남아 있다면 몇 그룹인지
- 남아 있는 각 그룹이
  - 같은 orderId인지
  - 같은 paymentKey인지
  - approvedAt은 같은지
  - loggedAt만 다른지
  - sendPath가 auto_sync인지
  를 표로 정리

C. event_id 생성 규칙 효과
- 같은 paymentKey + Purchase 조합이 post-fix 이후 동일 event_id로 안정화됐는지
- 여전히 event_id가 갈라지면 이유가 무엇인지
- skip guard가 실제로 duplicate_order_event_success로 막고 있는지

D. payment_success 품질
- payment_success total
- withGaSessionId
- withClientId
- withUserPseudoId
- withAllThree
- allThreeRate
- 이전 수치 대비 개선/정체/악화 판정

E. 보조 검증
- post-fix 이후 dedup 후보 주문이 있으면 Imweb 캐시와 Toss 기준으로 실제 결제 1건인지 확인
- 실제 복수 결제가 아닌데 CAPI만 여러 번 갔다면 위험으로 분류

완료 기준:
다음 3개가 동시에 충족될 때만 “실질 해결”이라고 써라.
1. post-fix 이후 운영 로그가 실제로 존재
2. multiEventIdGroups가 0 또는 사실상 무시 가능한 수준
3. 남은 후보가 있더라도 정상 재시도/테스트/수동 호출이 아니라는 근거가 정리됨

출력 형식:
반드시 아래 형식으로만 써라.

1. 10초 요약
- 2문장
- 해결 / 미해결 / 판정불가 중 하나를 먼저 명시

2. 핵심 숫자 8개
- post-fix total
- post-fix success
- post-fix multiEventIdGroups
- post-fix multiEventIdRows
- post-fix retryLikeGroups
- post-fix retryLikeRows
- caller coverage allThreeRate
- 최신 비교 기준값(수정 전 대비)

3. 결론
- 해결 / 부분 해결 / 미해결 / 판정불가 중 하나
- 왜 그렇게 판단하는지 3줄 이내

4. 남아 있는 위험
- 최대 3개
- 각 항목은 “무슨 문제인지 → 왜 위험한지 → 다음 액션” 순서

5. 증빙
- 실제 호출한 API와 응답 핵심값
- dedupCandidateDetails가 남으면 orderId 단위로 요약
- raw 전체 복붙 금지, 핵심만 정리

6. 최종 제안
- 지금 바로 운영 반영할지
- 하루 더 로그를 기다릴지
- GTM/payment page 품질 작업으로 넘어갈지
- 셋 중 하나를 명확히 추천

금지:
- post-fix 로그가 0건인데 해결이라고 쓰지 말 것
- “아마”, “추정상”만으로 완료 처리하지 말 것
- 긴 로그 원문 복붙 금지
- 사람이 읽기 어렵게 개발자 로그체로만 쓰지 말 것

추가 요청:
가능하면 결과를
data/metaroas_postfix_check_YYYYMMDD.md
형식의 문서 초안으로 함께 제시하라.
```

짧게 보완하면, Codex가 또 기술 로그처럼 길게 쓰는 걸 막기 위해 맨 아래에 이 한 줄을 붙이면 좋습니다.

```text
결과보고서는 대표가 1분 안에 읽고 판단할 수 있게 쉬운 한국어로 써라. “무엇이 해결됐는지 / 아직 안 됐는지 / 다음에 뭘 해야 하는지”를 먼저 써라.
```

payment_success 식별자 유입률 계속 올리기

현재 all-three coverage는 18.46%입니다.
이건 예전보다 조금 좋아졌지만 여전히 낮습니다. 문서도 client_id 있으면 user_pseudo_id fallback을 넣고 _fbc, _fbp`까지 보내도록 보강했지만, 실제 효과는 운영 데이터가 더 쌓여야 본다고 적혀 있습니다.

즉,

ga_session_id
client_id
user_pseudo_id
_fbc
_fbp

이 5개가 더 안정적으로 들어오게 만드는 게 맞습니다.

지금 다음에 해야 할 일

우선순위를 딱 3개로 줄이면 이겁니다.

1) post-fix 이후 CAPI dedup 재확인

이게 1순위입니다.

문서에 이미 post-fix 확인용 쿼리가 있습니다.
다음 auto_sync 이후 이걸 다시 보면 됩니다.

/api/meta/capi/log?limit=500&scope=recent_operational&since=2026-04-10T00:00:00.000Z&include_dedup_candidates=1&dedup_candidate_limit=10

여기서 봐야 할 값은:

multiEventIdGroups
multiEventIdRows

기대값은:

3 → 0
또는 아주 낮은 수준

이게 내려가면, 지금 가장 큰 dedup 리스크는 사실상 많이 닫힙니다.