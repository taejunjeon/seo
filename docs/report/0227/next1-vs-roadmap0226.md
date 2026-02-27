# `next1.0.md` vs `roadmap0226.md` 정합성 체크 (2026-02-27)

결론부터: `next1.0.md`는 `roadmap0226.md`의 Phase들을 **Sprint(실행 단위)** 로 재구성한 문서입니다.  
현재(2026-02-27) 기준으로 `next1.0.md`에서 진행 중인 핵심 범위는 **Phase 3-B / Phase 3-C (Sprint 5)** 입니다.

---

## 1) 문서 성격 차이

- `roadmap0226.md`
  - “왜/무엇을” 중심의 **상위 로드맵(Phase) + 진행률** 문서
  - 최종 업데이트가 2026-02-26이라, 2026-02-27 작업(Sprint 4/5)이 반영되기 전 상태가 포함됨
- `next1.0.md`
  - “어떻게/누가/언제” 중심의 **실행 계획(Sprint) + 체크리스트** 문서
  - `roadmap0226.md`를 기준으로, 실제 repo 구현 상태를 반영해 Sprint 단위로 재정리한 형태

---

## 2) Sprint ↔ Phase 매핑(요약)

| next1.0.md Sprint | roadmap0226.md Phase | 매핑 이유 |
|---|---|---|
| Sprint 1 (구조 정리) | (직접 Phase 아님) | page/server 분리는 “기능”보다 “코드 건강성” 작업이지만, 이후 Phase 2~3 실행의 선행 조건 |
| Sprint 2 (Mock 제거) | Phase 2 (Stage 0) | Fallback/더미 제거 + 4-state 패턴 등 “데이터 품질/안정성” 범주 |
| Sprint 3 (UI 잔여) | Phase 2 + Phase 2.5 | Tab별 UI 개선 + DataTable 적용 + 디자인 통일 |
| Sprint 4 (프로덕션 준비) | Phase 3-A (+운영 준비도) | Cron 외부 스케줄러, 캐시, 보호/로깅/서킷브레이커 등 배포 전 인프라 성격 |
| Sprint 5 (신규 API) | Phase 3-B / 3-C | Comparison/Intent 가중치(3-B) + AI funnel/topics/AIvsOrganic(3-C) |
| Sprint 6 (고급 프론트) | Phase 2.5 확장 + Phase 3 결과 UI 연동 | 비교 오버레이/반응형/토큰 문서화 등 UX 완성 |

---

## 3) 진행률/상태 불일치 포인트(핵심)

### Phase 3(백엔드 고도화)

`roadmap0226.md`에는 Phase 3 repo 기준이 **20%**로 기록되어 있지만, 2026-02-27 기준 repo에서는 아래 항목들이 추가로 완료되었습니다.

- 3-A
  - 외부 스케줄러 연동(예: GitHub Actions cron) ✅
  - 캐싱 레이어(옵션 Redis 포함) ✅
  - (잔여) AI 요약 파이프라인 이력 저장(DB 영속화) ⬜
- 3-B
  - Comparison API ✅ (추가: compare=previous/yoy/mom + range 메타)
  - 키워드 인텐트 가중치(서버 사이드) ✅
- 3-C
  - AI 유입 전용 전환 퍼널 ✅
  - 랜딩페이지 토픽 추출(LLM/휴리스틱) ✅
  - AI vs Organic 비교 리포트 ✅
  - (잔여) 커스텀 GA4 이벤트(GTM/사이트 태깅) ⬜

즉, **Phase 3의 “코드 구현도”는 roadmap0226.md의 20% 표기보다 더 높은 상태**로 보는 것이 타당합니다(단, 운영 준비도는 모니터링/키/배포 여부에 따라 별도로 낮을 수 있음).

### Phase 2.5(UI/UX 세련화)

`roadmap0226.md`의 Phase 2.5 미완료 목록 중 일부(예: KPI 카드 통일, Tab1/Tab2 DataTable 적용)는 `next1.0.md` 기준으로 이미 완료로 정리되어 있습니다.  
→ roadmap 문서의 해당 섹션은 최신 구현 상태로 갱신 필요합니다.

---

## 4) `next1.0.md`는 Phase 몇을 “하고 있나?”

정리 기준을 2개로 나눠 기록합니다.

1) **현재 진행(오늘 기준)**
- `next1.0.md`에서 “Sprint 5”를 수행 중 → **Phase 3-B / Phase 3-C**

2) **문서 전체 범위**
- `next1.0.md`는 Sprint 1~6을 포함하므로, 결과적으로 **Phase 2 ~ Phase 3**(그리고 Phase 2.5 포함)까지를 커버하는 실행 계획 문서입니다.

