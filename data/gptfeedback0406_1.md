According to a document from 2026-04-06, 결론부터 말하면 `datacheck0406.md`의 방향은 맞습니다. 로드맵/phase 문서와도 큰 충돌이 없고, 오히려 지금 시점의 병목을 꽤 정확하게 짚었습니다. 특히 “새 툴보다 공통키·동기화 범위·일일 대사”가 먼저라는 결론은 datacheck 본문과, P0의 `customer_key` 규칙, P1의 attribution ledger 운영 반영 과제, P8의 Braze/BigQuery 후순위 판단과 잘 맞습니다.

다만 “이대로 그대로 가면 되느냐”에는 제 답이 **“80%는 맞고, 20%는 바로 손봐야 한다”**예요. 가장 중요한 이유는 현재 문서가 `정합성 문제`, `관측성 문제`, `시점 차이로 생긴 숫자 차이`를 한 문맥에 섞어 써서, 읽는 사람이 실제 결함과 단순 스냅샷 차이를 구분하기 어렵기 때문입니다. 예를 들어 같은 3월 구간의 GA4 `(not set)` 수치가 Phase 1 문서에서는 `845건 / ₩136.6M`, datacheck에서는 `896건 / ₩148.5M`로 다릅니다. 또 attribution도 Phase 1은 coffee live 초기 스냅샷 `live 3 / replay 5 / smoke 3`를 말하는 반면, datacheck는 전체 ledger `306건, live 296`을 말합니다. 이건 버그일 수도 있지만, 더 가능성 큰 해석은 **조회 시점·source filter·전체/부분 집계 기준 차이**입니다. 지금 문서에는 이 구분이 충분히 명시돼 있지 않습니다.

그래서 첫 번째 수정 권장은, 문서 맨 앞에 **“숫자 기준표”**를 넣는 겁니다. `as_of`, `store scope`, `all-source vs filtered`, `event row vs distinct order`, `approval vs DONE vs settlement`, `observed success vs confirmed revenue`를 먼저 선언해 두면 신뢰도가 크게 올라갑니다. datacheck가 스스로 지적한 약점도 결국 `GA4↔실결제`, `Imweb↔전기간 Toss`, `정식 DB ledger 부재`이기 때문에, 이 기준표가 있어야 점수표와 대사 리포트가 같은 언어로 읽힙니다.

두 번째로, `customer spine`을 P2 “다음 단계”로만 두기엔 조금 늦습니다. datacheck는 공통 표준 키를 P0로 두고, spine은 그 다음으로 두었는데, Phase 0을 보면 사실상 `customer_key`와 alias 규칙은 이미 설계돼 있습니다. 그래서 **대규모 backfill은 나중에 하더라도, spine 테이블의 스키마와 merge rule은 이번 주에 먼저 고정**하는 편이 낫습니다. 그래야 P3의 발송 대상, P4의 코호트, P5.5의 ROAS, P7의 holdout 실험이 같은 사람을 같은 사람으로 보게 됩니다.

세 번째로, datacheck 액션 리스트에 **`payment_status`/`confirmed_revenue` 축이 빠져 있는 점**은 꼭 보강해야 합니다. Phase 5 문서를 보면 가상계좌 주문이 입금 전 `WAITING_FOR_DEPOSIT`이거나 취소 `CANCELED` 상태여도 `shop_payment_complete` 때문에 ledger에 적재될 수 있고, 이 경우 매출/ROAS가 과대 계산될 수 있다고 되어 있습니다. 해결책도 이미 문서에 있으니, `Toss DONE 확인 후 확정`, `ledger에 payment_status 추가`, `대시보드에서 pending/confirmed/canceled 분리`를 datacheck의 P0에 넣는 게 맞습니다. 지금 상태에서 ledger DB 승격만 하면, 잘못된 매출을 더 강하게 고정할 수 있습니다.

네 번째로, `P3 operational live`를 datacheck의 1주 계획에 병렬 과제로 넣는 걸 권합니다. 로드맵상 이번 주 핵심은 `첫 operational live (세그먼트 선택 → 알림톡/SMS 발송 → 전환 추적)`이고, Phase 3도 지금 최우선을 “결제 귀속은 닫혔지만 실행과 행동 데이터가 덜 닫혀 첫 live를 아직 못 한다”로 정의합니다. 즉 지금은 데이터 정합성 안정화만 하는 주가 아니라, **정합성 개선과 live 운영을 같이 굴려야 하는 주**예요. datacheck 문서대로만 가면 팀이 “먼저 데이터부터 완벽하게”로 기울 수 있는데, 그러면 P7 첫 실험 진입도 늦어집니다. Phase 7도 첫 실험은 noise가 가장 적은 `체크아웃 이탈 holdout`이 맞다고 적고 있습니다.

다섯 번째로, ROAS 관련 문구는 한 줄만 더 분명히 해두면 좋습니다. 로드맵상 P5와 P5.5는 이미 완료로 잡혀 있고, `/ads/roas` 대시보드와 iROAS 엔진도 구현돼 있습니다. 그런데 datacheck는 “광고별 ROAS를 믿고 집행하기엔 아직 정합성이 부족하다”고 말합니다. 이 둘은 실제로 모순은 아니지만, 독자 입장에선 충돌처럼 느껴질 수 있습니다. 그래서 `현재 /ads/roas는 매체 운영용 directional dashboard이며, 고객 단위 귀속·budget automation source of truth로 쓰기에는 아직 이르다` 정도로 바꾸면 정리가 됩니다. 그러면 “대시보드는 있음”과 “아직 1원 단위 최적화엔 이르다”가 동시에 성립합니다.

여섯 번째로, 북극성/LTV 관련 표현은 지금처럼 보수적으로 가는 게 맞습니다. Phase 4의 90일 재구매 순매출은 이미 운영 중이지만, 문서 자체가 이 숫자를 **관찰 추정치이지 인과 증명이 아니다**라고 분명히 적고 있습니다. 그래서 datacheck가 “채널별 LTV, 광고별 ROAS, 고객 단위 귀속을 믿고 집행하기엔 아직 부족하다”고 말한 건 Phase 4와도 충돌하지 않습니다. 오히려 적절한 안전장치예요. 다만 북극성 숫자는 “운영용 회사 KPI”, 채널/LTV는 “고객 단위 의사결정 KPI”로 층위를 나눠 적어두면 더 좋습니다.

BigQuery에 대한 판단도 방향은 맞습니다. datacheck가 “있으면 좋지만 지금 첫 일은 아니다”라고 본 건 Phase 8과 일치합니다. 다만 제 의견을 하나 보태면, **프로젝트 우선순위는 뒤로 두되, export toggle 자체는 일찍 켜두는 쪽**이 실무상 더 유리할 수 있습니다. Phase 8 문서상 비용 부담은 초기엔 사실상 거의 없고, 본격 분석 시점은 P7 이후로 보는 게 맞으니까요. 즉 “BigQuery 도입 프로젝트”를 지금 시작하자는 뜻은 아니고, `enabled but not yet central` 정도가 좋습니다.

정리하면, 저는 `datacheck0406.md`를 **폐기할 문서가 아니라, 이번 주 운영 기준 문서로 승격해도 되는 초안**으로 봅니다. 대신 아래 네 가지만 반영하면 훨씬 강해집니다.

1. 숫자마다 `as_of / scope / filter / status`를 명시하기.
2. `customer spine schema`를 이번 주에 먼저 고정하기.
3. ledger DB 승격과 동시에 `payment_status`를 넣어 가상계좌/pending/canceled를 분리하기.
4. 1주 계획에 `P3 first operational live`를 병렬 과제로 추가하기.

제가 한 줄로 다시 쓰면 이 문서의 최종 결론은 이렇게 가면 좋겠습니다 ✨
**“지금은 새 솔루션 도입 시점이 아니라, `공통 키 고정 + status-aware ledger DB 승격 + biocom/coffee 주문 동기화 + 일일 대사`를 먼저 끝내고, 그와 병렬로 `P3 operational live`를 시작해 P7 holdout 실험으로 넘어가는 시점이다.”**

원하시면 다음 답변에서 `datacheck0406.md`를 바로 **수정본 문안 형태로** 다시 써드릴게요.
