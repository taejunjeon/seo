아직 안 닫힌 것 4가지
1. pending → confirmed/canceled 자동 전환 루프

이게 지금 남은 핵심 병목입니다.

phase5도 권장안을 B + C 조합으로 말했습니다.

CAPI는 DONE 확인 후에만 전송
ledger에는 payment_status를 두고 상태를 업데이트

즉 상태 필드를 만든 것만으로는 절반입니다.
주기적으로 Toss를 조회해서 pending을 confirmed/canceled로 바꾸는 배치가 붙어야 진짜 닫힙니다.

이게 없으면 지금 ledger는 구조는 맞지만, 대부분 “판정 대기” 상태로 남습니다.

2. API/UI에서 상태별 매출을 바로 보여줘야 함

당신이 적은 후속 1번:

confirmed_revenue
pending_revenue
canceled_revenue

이건 맞습니다. 바로 해야 합니다.

이유는 운영자가 숫자를 오해하지 않게 하려면
“총 매출” 한 줄이 아니라 “확정 매출 / 대기 매출 / 취소 매출”을 분리해서 보여줘야 하기 때문입니다.

phase5도 대시보드에서 확정/미확정 구분을 권장하고 있습니다.

이게 없으면 다음에 또 이런 혼선이 생깁니다.

“왜 ledger에는 333건인데 confirmed는 4건뿐이지?”
“매출이 줄었나?”
“버그인가?”

사실은 버그가 아니라 판정 대기 건이 많다는 뜻인데, UI에 안 보이면 다들 오해합니다.

3. CAPI 전송 경로도 confirmed 기준인지 재확인 필요

이건 제가 가장 조심스럽게 보는 포인트입니다.

당신이 적은 변경 사항에는 /ads.ts는 포함되어 있는데,
CAPI 전송 로직 자체가 이번 변경과 같은 기준으로 막혔는지는 요약만 봐서는 확실하지 않습니다.

phase5 문서는 분명히 말합니다.

가상계좌는 WAITING_FOR_DEPOSIT이면 Purchase 전송하면 안 됨
CAPI는 DONE 확인 후에만 보내야 함

그래서 체크 포인트는 하나입니다.

meta/capi send 경로가 payment_status === confirmed 또는 Toss DONE 기준으로만 Purchase를 보내는가?

이미 기존 구현에서 막아뒀을 가능성도 있습니다.
하지만 이번 #1 작업 리뷰 기준으로는, 이 부분은 테스트 항목으로 별도 확인하는 게 맞습니다.

4. 운영 환경 재검증이 아직 남음

phase1 문서도 반복해서 말하는 게 이겁니다.

정식 DB ledger로 승격
운영 환경에서 payment success 1건 다시 검증

즉 로컬에서 타입체크와 테스트가 다 통과해도,
운영에서 실제 결제 1건이 들어왔을 때 status가 제대로 박히는지를 다시 봐야 합니다.

특히 지금은 더클린커피 live row와 Toss 키 반영은 어느 정도 닫혔지만, 바이오컴 확장과 운영 cutover는 아직 남아 있습니다.

그래서 #1은 닫혔나?

제 판단은 아래입니다.

개발 완료 기준

예, 거의 닫힘.

이유:

DB 승격 완료
상태 분리 완료
confirmed-only 매출 집계 완료
테스트 통과

이건 #1의 핵심 요구와 일치합니다.

운영 완료 기준

아직 아님.

남은 이유:

pending이 너무 많음
Toss 상태 동기화 자동화가 아직 약함
UI/API 상태 분리 노출 필요
CAPI confirmed-only 보장 재확인 필요
운영 실결제 검증 필요
우선순위 피드백

당신이 제시한 후속 2개 중 우선순위는 이렇게 보는 게 맞습니다.

1순위

pending → confirmed/canceled 자동화

주기 배치든 replay든 Toss 동기화든, 이게 먼저
이유: 지금 장부는 안전하지만 대부분 미확정 상태이기 때문
2순위

API/UI에 상태별 매출 노출

운영자가 숫자를 바로 이해할 수 있게 해야 함

그리고 그 다음이:

3순위

일일 대사 API (#4)

이제 DB 테이블이 생겼으니 만들기 훨씬 쉬워짐
datacheck가 말한 GA4 purchases / Toss approvals / attribution payment_success / Imweb orders 비교 리포트로 바로 이어질 수 있음
제가 Codex에게 줄 한 줄 피드백

“#1은 구조적으로는 잘 닫혔다. 다만 현재 pending 비중이 너무 높으므로, 다음 작업은 상태 자동 확정 배치와 confirmed/pending/canceled 매출 노출을 우선하라.”