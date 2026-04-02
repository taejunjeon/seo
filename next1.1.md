# 다음 작업 계획 v1.1

> 작성일: 2026-02-27
> 기준: Sprint 1~6 완료 후 잔여 작업 분석
> 선행 문서: `next1.0.md` (Sprint 1~6), `roadmap0226.md` (Phase 0~5 전체 로드맵)

---

## 담당 원칙

| 영역 | 담당 |
|------|------|
| **프론트엔드** (Next.js, 컴포넌트, 훅, CSS) | **Claude Code** |
| **백엔드** (Express, API, DB, 인프라) | **Codex** |
| **콘텐츠/기획 방향** | **TJ님** |

---

## 현재 상태

| 영역 | 상태 | 수치 |
|------|------|------|
| 백엔드 | ✅ 구조/인프라 완료 | server.ts 118줄, 6개 라우터, 34개 API |
| 프론트엔드 | ✅ 8탭 UI 완료 | page.tsx 1,762줄, 14개 컴포넌트 분리 |
| 데이터 | ✅ Mock 전부 제거 | 전 탭 실 API 기반, empty state 처리 |
| 비연동 API | ⚠️ 9개 미연동 | Sprint 5 API 4개 + 기타 5개가 프론트 미연결 |
| 상태 관리 | ⚠️ 비대 | page.tsx에 useState **82개** (목표 ~20개) |
| 운영/배포 | ⬜ 미착수 | 배포 환경, 모니터링, 실제 키/권한 미설정 |

---

## 실행 흐름 총괄 (담당 + 병렬/순차)

```
╔═══════════════════════════════════════════════════════════════════╗
║  WAVE 1 — 병렬 실행 가능                                          ║
║                                                                   ║
║  Claude Code          ║  Codex                                    ║
║  ─────────────────    ║  ───────────────────                      ║
║  Sprint 7             ║  Sprint 9                                 ║
║  상태 관리 정리        ║  Phase 3 잔여 마무리                       ║
║  (프론트)             ║  (백엔드)                                  ║
╠═══════════════════════╩═══════════════════════════════════════════╣
║                           │                                       ║
║                           ▼                                       ║
║  WAVE 2 — 병렬 실행 가능 (Sprint 7 완료 후)                        ║
║                                                                   ║
║  Claude Code          ║  Codex                                    ║
║  ─────────────────    ║  ───────────────────                      ║
║  Sprint 8             ║  Sprint 10.3~10.5                         ║
║  API 프론트 연동       ║  백엔드 배포/인증/모니터링                   ║
║  (프론트)             ║  (백엔드)                                  ║
║  +Sprint 10.2         ║                                           ║
║  Vercel 배포           ║                                           ║
╠═══════════════════════╩═══════════════════════════════════════════╣
║                           │                                       ║
║                           ▼                                       ║
║  WAVE 3 — TJ님 방향 결정 후                                       ║
║                                                                   ║
║  Claude Code          ║  Codex               ║  TJ님              ║
║  ─────────────────    ║  ─────────────────   ║  ─────────         ║
║  Sprint 11            ║  Sprint 11           ║  Sprint 11         ║
║  인용추적 UI          ║  Schema/인용 백엔드   ║  E-E-A-T/가이드     ║
║  (프론트)             ║  (백엔드)            ║  (콘텐츠 기획)       ║
╠═══════════════════════╩══════════════════════╩════════════════════╣
║                           │                                       ║
║                           ▼                                       ║
║  WAVE 4 — Phase 4 효과 확인 후                                    ║
║                                                                   ║
║  Claude Code + Codex 협업                                         ║
║  Sprint 12: 리텐션 & 그로스 루프                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

---

## 남은 작업 전체 목록

### Sprint 7: page.tsx 상태 관리 정리 — 🎨 Claude Code 단독

> **로드맵 위치**: Phase 1 프론트엔드 잔여 (Phase 2.5 ⬜ 항목)
> **실행**: WAVE 1 — Sprint 9와 **⏸ 병렬 가능**
> **왜 해야 하나**: page.tsx에 useState가 82개 몰려 있소. 탭 컴포넌트는 분리됐지만 상태는 여전히 page.tsx 한 곳에서 선언 → props 드릴링 30~40개씩 전달. 새 기능 추가, 버그 수정, 유지보수 모두 이 병목에 걸리오. 커스텀 훅으로 추출하면 page.tsx를 ~800줄로 줄이고, 각 탭이 자기 상태를 독립 관리할 수 있소.

| # | 작업 | 담당 | 규모 | 비고 |
|:-:|------|:----:|:----:|------|
| **7.1** | **useKeywordState 훅** — 키워드 탭 상태 11개 추출 | Claude Code | 중 | keywordsData, dateRange, loading, error, opportunityKeyword 등 |
| **7.2** | **useColumnState 훅** — 칼럼 분석 탭 상태 6+5개 추출 | Claude Code | 중 | columnsData, colRangePreset, colDatePicker, colLoading 등 |
| **7.3** | **useBehaviorState 훅** — 사용자 행동 탭 상태 8개 추출 | Claude Code | 중 | behaviorData, funnelData, dateRange, loading 등 |
| **7.4** | **useDiagnosisState 훅** — 진단 탭 상태 16개 추출 | Claude Code | 대 | 가장 큰 클러스터. diagUrl, crawl, aeo/geo, citation, history 등 |
| **7.5** | **useCwvState 훅** — CWV 탭 상태 4+3개 추출 | Claude Code | 소 | cwvRealData, cwvLoading, pageSpeedHistory 등 |
| **7.6** | **useOverviewState 훅** — 개요 탭 상태 정리 | Claude Code | 중 | kpi, trend, aeo/geo, insights, chat 등 |

**예상 결과**: page.tsx 1,762줄 → ~800줄, useState 82개 → ~15개 (탭 전환, 글로벌 상태만 잔류)

---

### Sprint 8: Sprint 5 신규 API 프론트 연동 — 🎨 Claude Code 단독

> **로드맵 위치**: Phase 3-B/3-C → 프론트엔드 연동 (roadmap에서 P1 우선순위)
> **실행**: WAVE 2 — ⛔ **Sprint 7 완료 후 착수** (훅 구조 위에서 작업해야 코드 품질 유지)
> **왜 해야 하나**: Codex가 Sprint 5에서 만든 API 4개가 백엔드에만 존재하고 UI에 표시되지 않소. 데이터는 이미 수집 가능한데 사용자가 볼 수 없는 상태이오. 대시보드의 가치는 데이터를 "보여주는 것"인데, 핵심 분석 API 4개가 잠자고 있소.

| # | 작업 | 담당 | 규모 | 미연동 API | 연동 위치 |
|:-:|------|:----:|:----:|-----------|----------|
| **8.1** | **기간 비교 API 연동** | Claude Code | 중 | `/api/comparison` | Tab 0 오버뷰 — KPI 카드에 전기 대비 변화율 표시 |
| **8.2** | **AI 전환 퍼널 연동** | Claude Code | 중 | `/api/ga4/ai-funnel` | Tab 5 사용자 행동 — AI 유입 전용 퍼널 차트 추가 |
| **8.3** | **랜딩페이지 토픽 연동** | Claude Code | 중 | `/api/ai/landing-topics` | Tab 5 AI 트래픽 — 토픽별 유입 분포 표시 |
| **8.4** | **AI vs 유기검색 비교 연동** | Claude Code | 중 | `/api/ga4/ai-vs-organic` | Tab 5 또는 Tab 0 — 비교 테이블/차트 |

**기타 미연동 API** (우선순위 낮음, 필요시 연동):

| API | 용도 | 담당 | 비고 |
|-----|------|:----:|------|
| `/api/dashboard/overview` | 대시보드 통합 요약 | Claude Code | Tab 0 KPI와 중복 가능 — 확인 필요 |
| `/api/ga4/top-sources` | 상위 트래픽 소스 | Claude Code | Tab 5에 추가 가능 |
| `/api/gsc/sites` | GSC 사이트 목록 | Claude Code | 설정 UI에 사용 가능 |
| `/api/pagespeed/batch` | 다중 URL 일괄 검사 | Claude Code | Tab 3/4에 활용 가능 |
| `/api/serpapi/account` | SerpAPI 잔여 크레딧 | Claude Code | 관리 화면에 표시 가능 |

---

### Sprint 9: Phase 3 잔여 마무리 — 🔧 Codex 메인 (+Claude Code 일부)

> **로드맵 위치**: Phase 3-A, 3-C 잔여 2건
> **실행**: WAVE 1 — Sprint 7과 **⏸ 병렬 가능** (백엔드 ↔ 프론트 독립)
> **왜 해야 하나**: Phase 3이 현재 90%인데 100%를 만들어야 Phase 4로 넘어갈 수 있소. AI 요약 DB 영속화는 서버 재시작 시 인사이트 데이터 유실 방지, GTM 이벤트는 GA4 AI 트래픽 정확도 향상에 필요하오.

| # | 작업 | 담당 | 규모 | 로드맵 | 비고 |
|:-:|------|:----:|:----:|--------|------|
| **9.1** | **AI 요약 파이프라인 이력 DB 저장** | Codex | 중 | Phase 3-A | 현재 in-memory → PostgreSQL/SQLite 영속화. 서버 재시작해도 인사이트 유지 |
| **9.2** | **GTM 커스텀 이벤트 (AI referrer 감지)** | Codex | 중 | Phase 3-C | GA4에서 AI 유입을 정밀하게 식별하기 위한 GTM 태그 설정 |
| **9.3** | **topKeywords 클릭/순위 데이터 보강** | Codex(API) + Claude Code(UI) | 소 | Phase 2 잔여 (F5) | Codex가 API 필드 확장 → Claude Code가 IntentChart에 표시 |

---

### Sprint 10: 배포 및 운영 준비 — 🎨+🔧 프론트/백 분리 병렬

> **로드맵 위치**: Phase 3-A 운영 인프라 확장
> **실행**: WAVE 2 — Sprint 8과 **⏸ 병렬 가능** (10.2는 Claude Code, 10.3~10.5는 Codex)
> **왜 해야 하나**: 현재 localhost에서만 동작하오. 실제 사용자(TJ님 팀)가 접속하려면 배포 환경이 필요하고, API 키/인증/도메인/HTTPS 설정이 선행되어야 하오. 운영 준비도가 현재 55~60%인 이유가 이것이오.

| # | 작업 | 담당 | 규모 | 비고 |
|:-:|------|:----:|:----:|------|
| **10.1** | **환경변수/시크릿 정리** | Codex | 소 | GSC/GA4/SerpAPI/OpenAI 키 프로덕션용 분리, .env.production 생성 |
| **10.2** | **프론트엔드 Vercel 배포** | Claude Code | 중 | Next.js → Vercel 배포, 환경변수 설정, 도메인 연결 |
| **10.3** | **백엔드 배포 환경 구성** | Codex | 대 | Express 서버 배포 (Railway/Render/EC2 등), HTTPS, CORS 설정 |
| **10.4** | **모니터링 & 알림** | Codex | 중 | 에러율, 응답시간 대시보드. Sentry 또는 간단 헬스체크 |
| **10.5** | **GSC/GA4 인증 플로우** | Codex | 대 | OAuth 토큰 갱신 자동화, 서비스 계정 설정 |

---

### Sprint 11+: Phase 4 — AEO 콘텐츠 전략 — 🎨+🔧+TJ님 3자 협업

> **로드맵 위치**: Phase 4 (0% 미착수)
> **실행**: WAVE 3 — ⛔ **Sprint 8~10 완료 후 + TJ님 방향 결정 후 착수**
> **왜 해야 하나**: 지금까지 만든 대시보드는 "현황 파악" 도구이오. Phase 4부터가 실제 "개선 실행"이오. Schema Markup, E-E-A-T 강화, AEO 작성 가이드는 검색 순위와 AI 인용률을 직접 올리는 작업이오. 대시보드로 측정 → Phase 4에서 개선 → 대시보드로 효과 확인하는 순환 구조가 완성되오.

| # | 작업 | 담당 | 규모 | 비고 |
|:-:|------|:----:|:----:|------|
| **11.1** | **Schema Markup 적용** (FAQ, HowTo, Article) | Codex | 중 | 구조화 데이터 생성 API + 삽입 로직 |
| **11.2** | **E-E-A-T 신호 강화** | TJ님 | 중 | 저자 프로필, 전문가 감수, 참고문헌 — 콘텐츠 기획 영역 |
| **11.3** | **칼럼 AEO 작성 가이드라인 제작** | TJ님 | 중 | 콘텐츠 팀용 가이드 — AI에 잘 인용되는 글쓰기 패턴 |
| **11.4** | **AI 검색엔진 인용 추적 시스템** | Codex(크롤링) + Claude Code(UI) | 대 | Codex: ChatGPT/Gemini/Perplexity 인용 감지 API, Claude Code: 대시보드 UI |
| **11.5** | **AEO 성과 KPI 정의** | TJ님 | 소 | 인용률, AI 유입 전환율 등 측정 지표 확정 |
| **11.6** | **경쟁 분석** | Codex | 중 | AI 답변에서 경쟁사 인용 현황 파악 백엔드 |

---

### Sprint 12+: Phase 5 — 리텐션 & 그로스 루프 — 🔧 Codex 메인

> **로드맵 위치**: Phase 5 (0% 미착수)
> **실행**: WAVE 4 — ⛔ **Phase 4 효과 확인 후 착수**
> **왜 해야 하나**: Phase 4에서 트래픽을 늘렸으면, Phase 5에서 그 트래픽을 "재방문"으로 전환해야 하오. 카카오 알림톡 기반 리텐션 실험 → iROAS 측정 → Braze 도입 판단이 이 단계의 목표이오.

| # | 작업 | 담당 | 규모 | 비고 |
|:-:|------|:----:|:----:|------|
| **12.1** | **카카오 알림톡 API 연동** | Codex | 대 | "미니 Braze" 리텐션 실험의 기반 |
| **12.2** | **이탈 패턴 식별 → 자동 메시지** | Codex | 대 | GA4 이탈 데이터 기반 트리거 설정 |
| **12.3** | **컨트롤 그룹 + iROAS 측정** | Codex | 대 | A/B 테스트 → 증분 ROAS 계산 |
| **12.4** | **Braze/Amplitude 도입 검토** | TJ님 | 소 | iROAS 결과 기반 의사결정 |

---

## 담당별 작업량 요약

| 담당 | Sprint | 작업 수 | 주요 영역 |
|------|--------|:-------:|-----------|
| **Claude Code** | 7, 8, 10.2, 9.3(UI), 11.4(UI) | **15건** | 훅 추출, API 연동 UI, Vercel 배포, 인용추적 UI |
| **Codex** | 9, 10.1/3/4/5, 11.1/4(BE)/6, 12.1~3 | **14건** | DB 영속화, GTM, 배포, Schema, 인용추적 BE, 그로스 |
| **TJ님** | 11.2/3/5, 12.4 | **4건** | E-E-A-T, AEO 가이드, KPI 정의, Braze 의사결정 |

---

## 우선순위 + 병렬/순차 총정리

| 순위 | Sprint | 담당 | 핵심 이유 | 로드맵 | 실행 조건 |
|:----:|--------|:----:|-----------|:------:|-----------|
| **P0** | **7. 상태 관리 정리** | Claude Code | 82개 useState 병목 해소 | Phase 1/2.5 | ⏸ **즉시 착수** — Sprint 9와 병렬 |
| **P0** | **9. Phase 3 마무리** | Codex | DB 영속화 + GTM 정확도 | Phase 3 | ⏸ **즉시 착수** — Sprint 7과 병렬 |
| **P1** | **8. API 연동** | Claude Code | 잠자는 API 4개 깨우기 | Phase 3→UI | ⛔ Sprint 7 완료 후 — Sprint 10과 병렬 |
| **P1** | **10. 배포 준비** | 분리 병렬 | localhost 탈출 | Phase 3-A | ⛔ Sprint 7 완료 후 — Sprint 8과 병렬 |
| **P2** | **11. AEO 전략** | 3자 협업 | 측정→실행 전환 | Phase 4 | ⛔ Sprint 8~10 완료 + TJ님 결정 |
| **P3** | **12. 그로스 루프** | Codex 메인 | 리텐션 실험 | Phase 5 | ⛔ Phase 4 효과 확인 후 |

---

## 권장 착수 순서 (시간순)

```
WAVE 1 ─── 즉시 병렬 착수 ────────────────────────────────
│
├─ Claude Code: Sprint 7 (상태 관리 정리)        ⏸ 병렬
├─ Codex:       Sprint 9 (Phase 3 마무리)        ⏸ 병렬
│
WAVE 2 ─── Sprint 7 완료 후 병렬 착수 ────────────────────
│
├─ Claude Code: Sprint 8 (API 연동) + 10.2 (Vercel 배포)   ⏸ 병렬
├─ Codex:       Sprint 10.1/3/4/5 (백엔드 배포/모니터링)    ⏸ 병렬
│
WAVE 3 ─── TJ님 방향 결정 후 ──────────────────────────────
│
├─ Claude Code: Sprint 11.4 UI (인용추적 대시보드)
├─ Codex:       Sprint 11.1/4 BE/6 (Schema, 인용추적, 경쟁분석)
├─ TJ님:        Sprint 11.2/3/5 (E-E-A-T, 가이드, KPI)
│
WAVE 4 ─── Phase 4 효과 확인 후 ───────────────────────────
│
└─ Codex + Claude Code: Sprint 12 (리텐션 & 그로스)
```

---

## 로드맵 진행률 (Sprint 6 완료 후)

| Phase | 현재 | Sprint 7~10 후 예상 |
|-------|:----:|:---:|
| Phase 0 기획 | 100% | 100% |
| Phase 1 MVP | 95% → **100%** (Sprint 7 완료 시) | 100% |
| Phase 2 UI 품질 | 98% | **100%** |
| Phase 2.5 디자인 | 95% → **100%** (Sprint 7+문서화 완료 시) | 100% |
| Phase 3 백엔드 | 90% | **100%** (Sprint 9 완료 시) |
| Phase 4 AEO 전략 | 0% | 0% (Sprint 11에서 착수) |
| Phase 5 그로스 | 0% | 0% (Sprint 12에서 착수) |
| **전체** | **60~65%** | **80~85%** |
