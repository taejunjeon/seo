# Phase 2.5 — 프리-구매 리드 마그넷 MVP

> **최종 업데이트**: 2026-04-03
> **담당**: Codex (백엔드/설계) + Claude Code (프론트/UXUI)

## 왜 필요한가

주문/상담 이후 CRM만으로는 acquisition와 CRM이 끊긴다. 익명 방문자를 식별 가능한 리드 자산으로 바꾸는 앞단이 따로 필요하다.

### 사용자 베네핏

- **대표(TJ)**: 광고/SEO/콘텐츠 유입을 그냥 흘려보내지 않고, 상담 후보와 첫 구매 후보로 전환되는 구조를 수치로 본다
- **운영팀**: 리드 마그넷 결과를 바로 상담 우선순위와 후속 메시지 흐름에 연결할 수 있다
- **마케터**: 다운로드 수가 아니라 `상담 예약률`, `첫 구매율`, `90일 순매출`로 리드 자산을 평가한다

---

## 스프린트별 완성도

| Sprint | 목표 | 담당 | 완료 |
|--------|------|------|------|
| P2.5-S1 | 리드 마그넷 ledger · 퀴즈 결과 저장 · consent/claim gate | Codex (백엔드/설계) | 10% |
| P2.5-S2 | 진단형 리드 마그넷 랜딩/결과 화면 | Claude Code (프론트/UXUI) | 0% |
| P2.5-S3 | 1호 자산 `3분 피로 원인 자가진단` 운영 실험 | Codex (설계) + Claude Code (프론트) | 0% |

> **이번 턴 판단**: 리드 마그넷은 PDF보다 `진단형 퀴즈`로 가는 것이 맞다. 이유는 `problem_cluster`, `urgency_score`, `analysis_type_hint`를 구조화된 데이터로 바로 남길 수 있기 때문이다.

---

## 상세 내용

### 기간

2026-04-14 ~ 2026-04-18

### 목표

- 익명 방문자를 `lead_id` 기준으로 식별 가능한 리드 자산으로 전환
- 리드 마그넷 결과를 `problem_cluster`, `urgency_score`, `analysis_type_hint` 형태의 구조화 데이터로 남김
- 상담 예약, 첫 구매, 90일 가치까지 같은 계보로 추적

### 왜 별도 phase로 빼는가

- 지금 로드맵은 주문/상담 이후가 강하고, 앞단 acquisition → lead 구간이 비어 있다
- 이걸 별도 phase로 빼지 않으면 뒤로 밀릴 가능성이 높다
- PDF보다 진단형 퀴즈가 남기는 데이터 품질이 훨씬 높다

---

### P2.5-S1: 리드 마그넷 ledger · 퀴즈 결과 저장 · consent/claim gate

**담당**: Codex (백엔드/설계)

현재 결정:
- 1호 자산은 `3분 피로 원인 자가진단`
- 결과는 `3~4개 problem_cluster`로 단순 분류
- 다운로드 수가 아니라 `상담 예약률`, `첫 구매율`, `90일 순매출`로 평가

선행 조건:
- `P0-S3` ontology 고정 ✅
- `P1-S1B` lead ledger 실데이터 적재 시작
- contact policy / quiet hours / suppression rule 확정

---

### P2.5-S2: 진단형 리드 마그넷 랜딩/결과 화면

**담당**: Claude Code (프론트/UXUI)

필요한 화면:
- 질문 시작 화면
- 결과 요약 화면
- 연락처 입력 후 상세 해석 화면
- 상담 연결 CTA

중요한 원칙:
- free PDF가 아니라 데이터 수집기처럼 설계
- 결과 화면에서 claim review가 끝난 문구만 노출

---

### P2.5-S3: 1호 자산 `3분 피로 원인 자가진단` 운영 실험

**담당**: Codex (설계) + Claude Code (프론트)

측정 지표:
- lead capture rate
- consultation booking rate
- first purchase rate
- repeat net revenue 90d

Phase 7과의 관계:
- 구조는 지금 넣지만, 대규모 인과 실험은 checkout abandon / 상담 후속 측정이 더 안정화된 뒤에 확대한다

---

## 완료 기준

- [ ] 리드 마그넷 1호 자산 랜딩/결과 화면 동작
- [ ] 퀴즈 결과가 `problem_cluster`, `urgency_score`로 구조화 저장
- [ ] consent/claim gate 동작
- [ ] 상담 예약률, 첫 구매율 추적 가능
