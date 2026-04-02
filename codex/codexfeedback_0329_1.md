너는 Revenue CRM/실험 로드맵 0327 최신본(2026-03-29 #5)을 기준으로 작업하는 Codex다.

이번 턴의 목표는 범위를 넓히지 말고 아래 2가지만 끝내는 것이다.

[우선순위]
1. P4-S1 read-only 재구매 코호트 API를 실사용 가능한 수준으로 닫기
2. P1-S1 승인 패키지를 운영 반영 가능한 형태로 정리하기

중요:
- 최신 로드맵의 방향을 따른다.
- 실험 원장, Meta, Kakao, Braze, 알리고 확장은 이번 턴의 구현 범위가 아니다.
- production DB schema를 바로 바꾸지 말고, read-only 구현 + approval package까지로 제한한다.
- 기존 API/화면을 깨는 리팩터링 금지.
- 한 번에 여러 Sprint를 조금씩 하지 말고, 이번 턴은 P4-S1과 P1-S1 준비에만 집중한다.

[소스 오브 트루스]
- 최신 메인 로드맵: Revenue CRM/실험 로드맵 0327 (2026-03-29 #5)
- 특히 반영해야 할 원칙:
  - holdout required
  - ITT 우선 분석
  - Meta는 첫 실험의 차단 게이트가 아님
  - 재구매 코호트는 Phase 4 전용이 아니라 Phase 0.5-1 병행 입력값
  - source of truth는 내부 DB/원장

[작업 1: P4-S1 read-only 코호트 API]
목표:
- 내부 주문 데이터만으로 첫 구매 월 코호트 기준 M+0, M+1, M+2, M+3 재구매율/주문수/환불 반영 순매출을 조회하는 API를 만든다.
- gross profit은 이번 턴 범위에서 제외 가능하다.
- 북극성 임시 대체값은 Repeat Net Revenue 90D 관점으로 설명 가능해야 한다.

구현 요구:
- 기존 revenue backend 구조를 따른다.
- 가능하면 기존 `/api/crm/repeat-purchase-cohorts`를 점검/보강하고, 없다면 새로 구현한다.
- 필터는 최소 아래를 고려:
  - start_month
  - end_month
  - max_offset
  - first_purchase_channel (가능하면)
  - first_product/category (가능하면)
  - discount_used 여부 (가능하면)
- 응답에는 cohort key를 남겨서 추후 P7-S3 실험 라벨을 얹을 수 있게 설계한다.
- read-only 접근만 사용한다.
- materialized view는 성능이 실제로 부족할 때만 검토하고, 이번 턴 기본값은 SQL/API 프로토타입이다.

검증 요구:
- 기존 `/api/sales/summary` 등과 월별 총합이 크게 어긋나지 않는지 reconciliation 메모를 남긴다.
- 왜 숫자가 완전히 같지 않을 수 있는지 설명한다
  (gross vs net, cohort 관점 vs 정산 관점, 환불 반영 시점 차이 등).
- 테스트를 추가한다.
- 최소 1개 샘플 month range에 대한 curl 또는 예시 응답을 남긴다.

[작업 2: P1-S1 승인 패키지]
목표:
- 운영 DB 승인 요청에 바로 붙일 수 있는 최소 패키지를 만든다.
- 이번 턴에는 실제 migration 적용보다, “정확한 최소 범위 정의 + 검증 가능한 패키지”가 핵심이다.

최소 범위:
1. crm_experiments
2. crm_assignment_log
3. crm_message_log
4. crm_conversion_log

반드시 포함할 것:
- 각 테이블 목적
- grain
- 핵심 컬럼
- 인덱스 초안
- holdout/control/treatment 표현 방식
- assignment first 원칙
- ITT 기준 1차 판정 원칙
- purchase/refund late arrival 고려
- occurred_at vs ingested_at 분리 여부
- 샘플 실험 1건 기준으로 어떻게 집계가 닫히는지 예시 SQL 또는 pseudocode

배정 규칙:
- deterministic assignment
- holdout_ratio 저장
- assignment_version 저장
- 재현 가능성 확보
- 발송 성공 여부와 배정을 분리

실험 variant 용어 규칙:
- experiment_control = 무메시지 대조군
- treatment_a / treatment_b = 발송군
- global_holdout은 장기 상시 제외군으로 별도 개념만 열어둔다

[산출물]
반드시 아래 산출물을 남겨라.
1. 수정/추가한 파일 목록
2. 구현 내용 요약
3. 테스트 결과
4. 코호트 API 샘플 응답
5. P1-S1 approval package 초안
6. 아직 안 닫힌 리스크 3개
7. 다음 턴 추천 1개만 제안

[금지]
- Meta API 구현 시작 금지
- Kakao/알리고 발송 구현 시작 금지
- ChannelTalk 대규모 확장 금지
- 프론트 전체 리팩터링 금지
- 승인 없는 운영 DB migration 적용 금지

[완료 기준]
- read-only 코호트 API가 실제 숫자를 반환한다
- 기존 매출 숫자와의 reconciliation 메모가 있다
- P1-S1 승인 패키지가 실제 결재/승인 문서로 넘길 수 있을 정도로 정리된다
- 테스트/샘플 응답/남은 리스크가 문서화된다