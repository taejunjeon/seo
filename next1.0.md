# 다음 작업 계획 v1.0

> 작성일: 2026-02-26
> 업데이트: 2026-02-27 (Sprint 4 완료 + npm audit 취약점 조치 + Sprint 5 API 구현)
> 기준: roadmap0226.md + 백엔드 33개 API 감사 + 프론트엔드 8탭 감사 결과 종합

---

## 로드맵 Phase 매핑 (이 문서 기준)

- **Sprint 2~3**: roadmap0226.md의 **Phase 2 / Phase 2.5** 잔여 처리(실데이터/UX)
- **Sprint 4**: **Phase 3-A + 운영 준비도**(Rate limit/Logging/Cron/Circuit breaker/캐시)
- **Sprint 5**: **Phase 3-B / Phase 3-C**(신규 API + AI 유입 고도화)

## 현재 상태 한눈에 보기

| 영역 | 상태 | 핵심 수치 |
|------|------|-----------|
| 백엔드 API | ✅ 라우터 분리 완료 | server.ts **118줄** (2,901→96% 감소, 6개 라우터 + 2개 유틸) |
| 프론트엔드 UI | ✅ Sprint 3 완료 | page.tsx **1,762줄** (4,279→58.8% 감소), DataTable 통합 + AEO 바 + 소스 색상 + KPI 통일 |
| 실데이터 연동 | ✅ Mock 제거 완료 | 전 탭 API 응답 기반. 데이터 없으면 empty state 표시 |
| 프로덕션 준비 | ✅ Sprint 4 완료 | Rate limiting + pino 로깅 + Cron 워크플로 + Circuit Breaker + (옵션) Redis 캐시 완료. **모니터링은 잔여** |

---

## 작업 목록

### Sprint 1: 코드 건강성 (구조 정리)

> **목적**: 4,000줄 파일 2개를 유지보수 가능한 구조로 분리

|    #    | 작업                                               |     담당      | 예상 규모 |             상태              | 비고                                         |
| :-----: | ------------------------------------------------ | :---------: | :---: | :-------------------------: | ------------------------------------------ |
| **1.1** | **page.tsx 탭별 컴포넌트 분리**                          | Claude Code |   대   |        ✅ Phase C 완료         | 4,279줄 → **1,801줄** (2,478줄 감소, **57.9%**) |
|         | **[완료] Phase A: 공통 추출**                          |             |       |              ✅              | 타입/상수/유틸/배지 분리                             |
|         | - `types/page.ts` (236줄)                         |             |       |              ✅              | 27개 타입 정의 분리                               |
|         | - `constants/pageData.ts` (117줄)                 |             |       |              ✅              | Mock 상수 19개 + 설정 값 분리                      |
|         | - `utils/pageUtils.ts` (170줄)                    |             |       |              ✅              | 유틸리티 함수 11개 분리                             |
|         | - `components/common/Badges.tsx` (86줄)           |             |       |              ✅              | ScoreGauge, cwvStatus 등 7개 공통 UI 분리        |
|         | **[완료] Phase B: 정적 탭 컴포넌트 추출 (2/8)**             |             |       |              ✅              |                                            |
|         | - `components/tabs/PageSpeedReportTab.tsx` (87줄) |             |       |              ✅              | Tab 3                                      |
|         | - `components/tabs/SolutionIntroTab.tsx` (239줄)  |             |       |              ✅              | Tab 7                                      |
|         | **[완료] Phase C: 상태 탭 컴포넌트 추출 (6/6)**             |             |       |              ✅              | Props 패턴으로 상태/콜백 전달                        |
|         | - `OverviewTab.tsx` (473줄)                       |             |       |              ✅              | Tab 0: ~35 props, onRefresh/onRetry 콜백 추상화 |
|         | - `ColumnAnalysisTab.tsx` (325줄)                 |             |       |              ✅              | Tab 1: 정렬/필터/날짜 상태 포함                      |
|         | - `KeywordAnalysisTab.tsx` (285줄)                |             |       |              ✅              | Tab 2: 기회 키워드 모달 포함                        |
|         | - `CoreWebVitalsTab.tsx` (268줄)                  |             |       |              ✅              | Tab 4: CWV 전략 전환 + 상세 메트릭                  |
|         | - `UserBehaviorTab.tsx` (276줄)                   |             |       |              ✅              | Tab 5: GA4 행동 + AI 트래픽 + 퍼널                |
|         | - `DiagnosisTab.tsx` (327줄)                      |             |       |              ✅              | Tab 6: URL 진단 + AEO/GEO + 크롤 분석            |
|         | **[미완] Phase D: 상태 관리 정리**                       |             |       |              ⏳              |                                            |
|         | - `hooks/usePageState.ts` — 40+ useState 정리      |             |       |              ⏳              | Phase C 완료, 다음 단계로 진행 가능                   |
| **1.2** | **server.ts 라우터 분리**                             |    Codex    |   대   |        ✅ 완료 (Codex)         | 2,901줄 → **118줄** (96% 감소) · `codexreport1.0_0226.md` 참조 |
|         | - `routes/gsc.ts` — GSC 관련 9개 엔드포인트              |             |       |              ✅              |                                            |
|         | - `routes/ga4.ts` — GA4 관련 6개 엔드포인트              |             |       |              ✅              |                                            |
|         | - `routes/pagespeed.ts` — PageSpeed 3개 + export |             |       |              ✅              |                                            |
|         | - `routes/ai.ts` — AI 인사이트/채팅/인텐트 6개             |             |       |              ✅              |                                            |
|         | - `routes/diagnosis.ts` — 진단 관련 6개               |             |       |              ✅              |                                            |
|         | - `routes/crawl.ts` — 크롤링 2개 + export            |             |       |              ✅              |                                            |
|         | - `middleware/errorHandler.ts` — 공통 에러 처리        |             |       |              ✅              |                                            |
|         | - `utils/dateUtils.ts`, `utils/ga4Meta.ts`       |             |       |              ✅              | 공용 유틸 분리                                   |

---

### Sprint 2: Mock 데이터 제거 + 실데이터 완성 ✅

> **목적**: 프론트엔드의 Mock 폴백을 제거하고 API 응답만으로 동작하도록 전환
> **결과**: 12개 Mock 상수 + 1개 더미 데이터 제거 완료. `pageData.ts` 117줄 → 37줄, `ai-traffic/types.ts` 215줄 → 93줄

| # | 작업 | 담당 | 규모 | 상태 |
|:-:|------|:----:|:----:|:----:|
| **2.1** | **MOCK_COLUMNS 제거** (Tab 1) | Claude Code | 소 | ✅ `columnsData ?? []` + empty state UI |
| **2.2** | **MOCK_KEYWORDS 제거** (Tab 2) | Claude Code | 소 | ✅ `keywordsData ?? []` + empty state UI |
| **2.3** | **MOCK_CWV 제거** (Tab 4) | Claude Code | 소 | ✅ `cwvRealData ?? []` + empty state UI |
| **2.4** | **MOCK_BEHAVIOR 제거** (Tab 5) | Claude Code | 소 | ✅ `behaviorData ?? []` + `funnelData ?? []` + empty state UI |
| **2.5** | **SPARKLINE/TREND_30D/SCORES Mock 제거** | Claude Code | 소 | ✅ `kpiData?.sparklines ?? []`, `trendSource ?? []`, `score ?? 0` |
| **2.6** | **DUMMY_AI_TRAFFIC 제거** | Claude Code | 소 | ✅ `types.ts`에서 120줄 더미 삭제, error 시 null 유지 |
| | **empty state 통일** | Claude Code | | ✅ 데이터 없을 시 "API 연결 후 자동으로 표시됩니다" 안내 |

---

### Sprint 3: UI 잔여 작업 ✅

> **목적**: feedback0226 미해결 이슈 + Phase 2/2.5 잔여 완료
> **결과**: 4개 작업 모두 완료. DataTable 통합으로 Tab 1/2에 정렬·검색·페이지네이션 자동 지원, page.tsx에서 정렬/검색 상태 7개 제거

| # | 작업 | 담당 | 규모 | 상태 |
|:-:|------|:----:|:----:|:----:|
| **3.1** | **DataTable → Tab 1/Tab 2 적용** | Claude Code | 중 | ✅ Tab 1 칼럼+기타 테이블 + Tab 2 키워드 테이블 모두 DataTable 교체. page.tsx에서 colSort/colSearch/showAll 등 상태 7개 제거 |
| **3.2** | **AEO Score 분포 바** (Tab 1) | Claude Code | 소 | ✅ AEO 컬럼 추가 — 0~15 → 100점 환산 색상 막대 (빨강/노랑/초록) + 수치 표시 |
| **3.3** | **소스별 CSS 색상** (AI Traffic) | Claude Code | 소 | ✅ 9개 AI 소스 브랜드 색상 매핑 — ChatGPT(#10A37F), Perplexity(#5A67D8), Gemini(#4285F4), Claude(#D97706), Copilot(#0EA5E9) 등 |
| **3.4** | **KPI 카드 디자인 통일** | Claude Code | 소 | ✅ 전체 KPI 카드 border-radius 16px / padding 20px 통일 (miniKpi, funnelKpi, cwvDetail, aiTraffic kpi, summaryKpi, userType) |

---

### Sprint 4: 백엔드 프로덕션 준비 ✅

> **목적**: 배포 전 필수 인프라 — Codex 메인 담당

| # | 작업 | 담당 | 규모 | 비고 |
|:-:|------|:----:|:----:|------|
| **4.1** | **Rate Limiting 추가** | Codex | 소 | ✅ 완료 — `express-rate-limit` (GSC: 60/min, AI: 10/min) · `backend/src/server.ts` |
| **4.2** | **Request Logging** | Codex | 소 | ✅ 완료 — `pino` + `pino-http` 요청/응답 로깅(민감 헤더 redact) · `backend/src/server.ts` |
| **4.3** | **Cron 외부 스케줄러 연동** | Codex | 중 | ✅ 완료 — GitHub Actions 스케줄러: `.github/workflows/gsc-daily.yml` (Secrets: `API_BASE_URL`, `CRON_SECRET`) |
| **4.4** | **GA4 Fallback 제거** | Codex | 소 | ✅ 완료 — GA4 미설정/인증 실패 시 `_meta.type: "empty"` + 0값 구조 반환 (`backend/src/routes/ga4.ts`, `frontend/src/components/ai-traffic/types.ts`) |
| **4.5** | **Circuit Breaker** | Codex | 중 | ✅ 완료 — SerpAPI/Perplexity 연속 실패 시 503 fast-fail + `Retry-After` (`backend/src/utils/circuitBreaker.ts`) |
| **4.6** | **Redis 캐시 전환** (선택) | Codex | 중 | ✅ 완료(옵션) — `REDIS_URL` 있으면 Redis, 없으면 in-memory TTL (`backend/src/cache/cache.ts`) |

> 참고: Sprint 4 진행 중 `npm audit` 취약점(backend/frontend)도 `npm audit fix`로 조치 완료 (2026-02-27).

---

### Sprint 5: Phase 3 기능 확장

> **목적**: 로드맵 Phase 3 잔여 — 신규 API 개발

| # | 작업 | 담당 | 규모 | Phase | 상태 |
|:-:|------|:----:|:----:|:-----:|:---:|
| **5.1** | **Comparison API 고도화** | Codex | 중 | 3-B — 기간 대비 비교 (YoY, MoM) + 프론트 변화율 연동 | ✅ |
| **5.2** | **키워드 인텐트 가중치 서버 사이드** | Codex | 중 | 3-B — 개수→클릭/노출 가중치 | ✅ |
| **5.3** | **AI 유입 전용 전환 퍼널** | Codex | 대 | 3-C — GA4 AI referrer → 전환까지 추적 | ✅ |
| **5.4** | **랜딩페이지 토픽 추출** | Codex | 중 | 3-C — LLM 기반 콘텐츠 주제 자동 분류 | ✅ |
| **5.5** | **AI vs 유기검색 비교 리포트** | Codex | 중 | 3-C — 대시보드용 비교 API | ✅ |

> 구현 상세: `docs/report/0227/sprint5.md` 참고

---

### Sprint 6: 고급 프론트엔드

> **목적**: UX 완성도 향상

| # | 작업 | 담당 | 규모 | 비고 |
|:-:|------|:----:|:----:|------|
| **6.1** | **이전 기간 비교 차트** | Claude Code | 중 | TrendChart에 `compare=previous` 오버레이 추가 |
| **6.2** | **반응형 모바일 최적화** | Claude Code | 대 | 현재 27인치 모니터 최적화 — 태블릿/모바일 미대응 |
| **6.3** | **CSS 변수 디자인 토큰 문서화** | Claude Code | 소 | Phase 2.5 잔여 |
| **6.4** | **다크 모드** (선택) | Claude Code | 대 | 현재 라이트 모드 전용 |

---

## 실행 순서 & 의존성

```
Sprint 1 (구조 정리)
  ├── 1.1 page.tsx 분리 (Claude Code)     ─── 독립 실행 가능
  └── 1.2 server.ts 분리 (Codex)          ─── 독립 실행 가능, 1.1과 병렬
         │
Sprint 2 (Mock 제거)
  └── 2.1~2.6 Mock 데이터 제거             ─── 1.1 완료 후 진행 권장 (분리된 컴포넌트에서 작업)
         │
Sprint 3 (UI 잔여)
  └── 3.1~3.4 UI 마무리                   ─── 2.x 완료 후 or 병렬 가능
         │
Sprint 4 (백엔드 준비)                     ─── 1.2 완료 후 진행 권장
  └── 4.1~4.6 프로덕션 인프라
         │
Sprint 5 (기능 확장)                       ─── 4.x 완료 후 or 병렬
  └── 5.1~5.5 신규 API
         │
Sprint 6 (고급 프론트)                      ─── 5.x 완료 후 (API 의존)
  └── 6.1~6.4 UX 완성
```

---

## 담당 분배 요약

| 담당 | 작업 수 | 주요 영역 |
|------|:-------:|-----------|
| **Claude Code** | 18건 | 프론트 컴포넌트 분리, Mock 제거, UI 잔여, 모바일 최적화 |
| **Codex** | 13건 | server.ts 분리, 프로덕션 인프라, 신규 API, 백엔드 고도화 |

---

## 즉시 착수 권장 (오늘/내일)

| 순위 | 작업 | 이유 |
|:----:|------|------|
| **1** | **1.1 page.tsx 분리** | 4,279줄 God Component — 이후 모든 프론트 작업의 선행 조건 |
| **2** | **1.2 server.ts 분리** (Codex) | 2,901줄 모놀리식 — 병렬로 진행 가능 |
| **3** | **2.1~2.6 Mock 제거** | 1.1 직후 진행 — 실데이터 기반 대시보드 완성 |

> **1.1 + 1.2를 병렬로 착수**하면 코드 건강성이 크게 개선되어 이후 Sprint가 훨씬 수월해지오.
