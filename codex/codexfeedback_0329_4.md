너는 Revenue CRM/실험 로드맵 0327 최신본(2026-03-29 #9) 기준으로 작업하는 Codex다.

이번 턴 목표는 범위를 넓히지 말고 아래 3가지만 진행하는 것이다.

[이번 턴 목표]

1. P1-S1A live 연결 대기 상태에서, 연결 즉시 검증 가능한 보조 도구를 만든다.
2. P1-S1 shadow run을 한 번 더 돌리되, 반복 실행 속도와 재현성을 개선한다.
3. P3-S1의 `memberId = customer_key` 계약을 실무 문서/응답 shape 수준으로 더 닫는다.

[중요 원칙]

* Meta, Kakao, Aligo 실발송, 새 Phase 확장 금지
* 운영 DB migration 적용 금지
* production 코드 대규모 리팩터링 금지
* 이번 턴은 “개발팀 handoff 전까지 우리가 직접 닫을 수 있는 범위”만 한다
* 결과보고서는 `docurule.md` 톤을 따른다
* 어려운 기술 설명보다, 무엇을 왜 했는지 먼저 쓴다

[작업 1: P1-S1A 보조 도구]
현재 상태:

* receiver는 이미 있음

  * `POST /api/attribution/checkout-context`
  * `POST /api/attribution/payment-success`
  * `GET /api/attribution/ledger`
  * `GET /api/attribution/toss-join`
* 하지만 실제 고객 사이트 호출이 없어 live row가 0건이다

이번 턴 할 일:

* checkout/payment-success 호출용 샘플 payload 문서 작성
* curl 예시 2개 작성
* receiver 호출 후 바로 확인하는 smoke 체크 스크립트 작성
* `paymentKey / orderId` 기준 매칭률 점검 스크립트 또는 리포트 보강
* 가능하면 hour-level 비교 리포트 초안 추가
* `P1-S1A` 운영 검증 절차를 1페이지 체크리스트로 정리

산출물:

* 샘플 payload
* curl 예시
* smoke check script
* ops/debug checklist
* 수정 파일 목록

[작업 2: P1-S1 shadow run 개선]
현재 상태:

* shadow run은 닫혔지만 source fetch가 느리고, message log 0건 상태 validation 위주다

이번 턴 할 일:

* 반복 실행 속도 개선

  * date pushdown 또는 seed source table 방향 검토
* destructive test 전 DB 확인 절차 문서화
* shadow run 래퍼/스크립트 정리
* 가능하면 message log를 수동 import 가능한 최소 포맷 추가
* shadow run 결과를 “실제 uplift 아님 / plumbing 검증”으로 명확히 설명

산출물:

* 개선된 실행 절차
* 실행 시간 전/후 비교
* 수동 message log 최소 포맷
* shadow run 보고서 1개

[작업 3: P3-S1 계약 마감]
현재 상태:

* `CHANNELTALK_MEMBER_HASH_SECRET`는 없어도 v1 가능
* 지금은 `memberId = customer_key`를 먼저 닫는 것이 우선

이번 턴 할 일:

* `memberId = customer_key` 규칙을 문서와 응답 shape로 고정
* boot/updateUser/track 공통 사용자 식별 필드 표 작성
* page name 규칙 표 작성
* event naming rule 표 작성
* `/crm` 기준 최소 campaign 운영 응답 shape 문서화
* `channeltalk_users.lastSeenAt` stale 비교용 검증 쿼리 초안 작성

산출물:

* identity/event contract 문서
* page/event naming 표
* campaign minimal response shape
* stale check query 초안

[금지]

* P5 Meta 구현 시작 금지
* P6 Kakao 구현 시작 금지
* Aligo 실발송 구현 시작 금지
* 운영 DB 테이블 생성 시도 금지
* Claude Code 영역의 프론트 전체 리팩터링 금지

[최종 보고 형식]
반드시 아래 순서로 보고한다.

1. 이번 턴 목적
2. 실제로 한 일
3. 왜 이게 지금 필요한지
4. 산출물 목록
5. 검증 결과
6. 아직 안 닫힌 리스크 3개
7. 다음 턴 추천 1개

[완료 기준]

* 개발팀이 receiver 연결하면 바로 검증 가능한 상태가 된다
* shadow run 반복 절차가 더 빨라지고 덜 헷갈린다
* `memberId = customer_key` 계약이 사람이 읽어도 모호하지 않다
* 보고서는 고등학생도 이해할 수 있는 수준으로 쓴다
