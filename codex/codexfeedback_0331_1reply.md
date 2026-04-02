# codexfeedback_0331_1 reply

기준일: 2026-03-31

## 이번 턴 한 줄 결론

리드 마그넷을 로드맵에 넣는 방향은 맞다고 판단했고, 문서만 바꾼 것이 아니라 `Phase 0 ontology/agent-readiness 계약`과 `Phase 1 lead ledger`를 실제 코드로 반영했다.

## 이번 턴의 목표

1. `lead_id`, `lead_magnet_id`, `problem_cluster`, `consent_status`를 기존 CRM 설계 안으로 편입한다.
2. 리드 마그넷을 별도 도구가 아니라 `Phase 1 실험 원장` 위에 올릴 수 있는 최소 ledger를 만든다.
3. 로드맵을 `Phase 0 -> Phase 1 -> Phase 2.5` 순서로 다시 정리한다.

## 실제로 바뀐 것

### 1. Phase 0 blueprint 확장

`revenue/backend`의 `GET /api/crm/phase0-blueprint` 응답이 아래 항목을 포함하도록 확장했다.

- `lead_ontology`
- `phase1_lead_ledger`
- `lead_magnet_mvp`
- `content_claim_registry`
- `agent_readiness`

핵심 원칙은 아래처럼 고정했다.

- `lead_id != customer_key`
- 리드 마그넷은 `기존 experiment/ledger` 위에 얹는다
- 에이전트는 `single read-only -> draft -> limited execution -> multi-agent` 순서로 간다

### 2. Phase 1 lead ledger 구현

`seo/backend` 로컬 SQLite에 아래 테이블을 추가했다.

- `crm_lead_profile`
- `crm_lead_event_log`
- `crm_consent_log`

같이 들어간 것:

- 실험 객체 확장 `funnel_stage`, `asset_id`, `lead_magnet_id`
- 리드 API
  - `GET /api/crm-local/leads/overview`
  - `GET /api/crm-local/leads`
  - `POST /api/crm-local/leads`
  - `POST /api/crm-local/leads/events`
  - `POST /api/crm-local/leads/consents`

### 3. roadmap 업데이트

`roadmap0327.md`에 아래를 반영했다.

- `P0-S3` lead/콘텐츠/정책 온톨로지 + agent-readiness 계약
- `P1-S1B` lead profile/event/consent ledger
- 새 `Phase 2.5` 프리-구매 리드 마그넷 MVP
- 1호 자산 권장안 `3분 피로 원인 자가진단`

## 실측 결과

- `pytest -q test_crm_phase0.py` 결과 `7 passed`
- `npm --prefix /Users/vibetj/coding/seo/backend run typecheck` 통과
- `node --import tsx --test tests/crm-local-lead.test.ts tests/crm-phase1.test.ts` 결과 `3 passed`
- `GET http://localhost:7020/api/crm-local/leads/overview` 결과 `200`
  - `total_leads 0`
  - `identified_leads 0`
  - `contactable_leads 0`
- `GET http://localhost:7020/api/crm-local/stats` 결과 `200`
  - `experiments 2`
  - `assignments 9`
  - `conversions 7`
  - `leads 0`
  - `lead_events 0`
  - `consents 0`

## 무엇이 증명됐는가

- `lead_id`를 `customer_key`와 분리한 채로도 기존 CRM 설계 안에서 관리할 수 있다.
- pre-purchase 실험 메타데이터를 기존 `crm_experiments`에 얹을 수 있다.
- `lead profile -> lead event -> consent -> overview` 흐름이 로컬 SQLite에서 닫힌다.
- 리드 마그넷을 roadmap의 독립 Phase로 올려도 기존 P1/P3/P5/P7 구조와 충돌하지 않는다.

## 아직 증명되지 않은 것

- 실제 리드 마그넷 랜딩/퀴즈 UI는 아직 없다.
- 실제 운영 유입이 `crm_lead_profile`로 들어오지 않아 live row는 아직 `0건`이다.
- 리드 마그넷의 상담 예약률, 첫 구매율, 90일 가치 측정은 아직 시작 전이다.
- `(not set)` receiver 연결 문제는 별도 blocker로 계속 남아 있다.

## 이 결과가 프로젝트에 주는 도움

- acquisition와 CRM이 끊기지 않고 같은 장부 위에서 이어진다.
- 리드 마그넷을 다운로드 수가 아니라 `상담 예약 -> 첫 구매 -> 90일 가치`로 평가할 준비가 된다.
- AI를 뒤늦게 붙이는 대신, 지금부터 `ontology + registry + run log` 기준으로 안전하게 키울 수 있다.

## 다음 행동

1. `P2.5-S2`로 `3분 피로 원인 자가진단` 랜딩/결과 UI를 만든다.
2. 실제 유입 이벤트를 `crm_lead_event_log`로 보내기 시작한다.
3. `claim review`, `contact policy`, `quiet hours`를 hard gate로 묶는다.
4. 첫 에이전트는 `Data QA Agent` 읽기 전용으로 시작한다.
