# Biocom AI Agent Dashboard — 로드맵 & 진행률

> 최종 업데이트: 2026-02-27
> 검증 기준: 로컬 코드 `/Users/vibetj/coding/seo/` + 워킹트리 변경 포함
> 기술 스택 (실제 repo 기준): **Next.js 16.1.6** + TypeScript 5.9.3 + CSS Modules + Recharts
> ※ Notion 원본 문서의 "Next.js 14 + Tailwind + shadcn/ui"는 초기 기획 스택이며, 실제 구현은 상이함

---

## 프로젝트 목적

본 프로젝트는 Biocom 웹 솔루션의 검색 최적화 및 AI 시대 대응을 위한 **3개 AI Agent 대시보드**를 구축하는 것을 목표로 함.

### 1. AEO AI Agent (Answer Engine Optimization)
- AI가 현재 AEO/GEO 품질을 체크하고, 개선 방법을 제시
- AI로 유입되는 세션이 얼마나 있는지 확인하고, 고도화 방법에 대해서도 제시
- ChatGPT, Perplexity, Gemini 등 AI 검색 엔진에서의 인용/노출 최적화

### 2. SEO AI Agent (Search Engine Optimization)
- 현재 SEO 품질을 체크하고, 개선 방법에 대해 제시
- GSC(Google Search Console) 데이터 기반 키워드/칼럼 분석
- PageSpeed, Core Web Vitals 모니터링 및 최적화 가이드

### 3. 퍼널 AI Agent (Funnel Analytics)
- GA4와 연동하여 고객 여정 및 퍼널을 분석하고, 데이터 인사이트를 제시
- 검사/영양제 분리 퍼널, AI 유입 전환 분석
- 행동 흐름 시각화 및 이탈 포인트 식별

---

## 전체 진행률 요약

| Phase | 이름 | Notion 원본 | repo 기준 (갱신) | 상태 |
|-------|------|:-----------:|:----------------:|------|
| Phase 0 | 기획 및 PRD | 100% | 100% | ✅ 완료 |
| Phase 1 | MVP 기반 구축 | 100% | 95% | ✅ 거의 완료 |
| Phase 2 | Tab 0 UI 품질 개선 | 20% | **90%** | 🔄 거의 완료 |
| Phase 2.5 | UI/UX 디자인 세련화 | 60% | **85%** | 🔄 진행 중 |
| Phase 3 | 백엔드 고도화 | 0% | **70%** | 🔄 진행 중 |
| Phase 4 | AEO 콘텐츠 전략 실행 | 0% | 0% | ⬜ 미착수 |
| Phase 5 | 리텐션 및 그로스 루프 | 0% | 0% | ⬜ 미착수 |

**전체 프로젝트 진행률: 약 45~50%** (코드 구현도 기준 55~65%)

> **참고**: 진행률은 2축으로 해석 가능
> - **코드 구현도**: 기능이 코드로 존재하고 로컬에서 동작 가능한가 → 55~65%
> - **운영 준비도**: 키/권한/배포/크론/모니터링까지 갖춰 운영 가능한가 → 35~40%

---

## Phase 0: 기획 및 PRD (100% ✅)

- ✅ PRD 문서 작성 완료 (biocom_seo_dashboard_prd.docx)
- ✅ 기술 스택 확정 (실제: Next.js 16 + TS + CSS Modules + Recharts)
- ✅ 데이터 소스 연동 결정 (GSC, PageSpeed, GA4, AI Citation)
- ✅ AEO 매거진 기획 문서 (Notion) 작성 완료
- ✅ 외부 도구 도입 검토 완료 (Airbridge 불필요, Braze Phase 5, Amplitude 추후)
- ✅ 3개 AI Agent 기술 피드백 분석 완료

---

## Phase 1: MVP 기반 구축 (95% ✅)

### 백엔드 ✅ 완료
- ✅ GSC API 연동 및 데이터 수집 파이프라인
- ✅ PageSpeed API 연동
- ✅ GA4 메트릭 확장 (세션, 이벤트, 전환율)
- ✅ UTM 추적 (utm_source=chatgpt 중심 구현, perplexity/gemini 보완 필요)
- ✅ 사용자 유형 분석 (AI vs Organic vs Direct)
- ✅ 데이터 소스 태깅 (`_meta` live/cache)
- ✅ AI Provider 호출 (SerpAPI, OpenAI, Perplexity)

### 프론트엔드 ✅ 대부분 완료
- ✅ 8개 탭 구조 대시보드 UI 구현
- ✅ 오버뷰 KPI 카드, 차트, 칼럼 분석 테이블
- ✅ AEO/GEO 원형 게이지 (카운트업 애니메이션)
- ✅ 페이지 진단 도구 (pageanal1.0) 구현
- ⚠️ page.tsx 4371줄 — 컴포넌트 분리 진행 중 (일부 완료)
- ⚠️ 프론트에 mock 데이터가 일부 잔존 (칼럼/키워드/CWV/행동 등)

---

## Phase 2: Tab 0 UI 품질 개선 (90% 🔄)

### Stage 0 — Fallback 데이터 제거 ✅ 완료
- ✅ AI_INSIGHTS, INTENT_CATEGORIES 하드코딩 상수 제거
- ✅ 4-state 패턴 적용 (loading/ready/error/empty)
- ✅ 빌드 에러 0, JS 에러 0, Playwright 검증 통과
- ⚠️ 미결: AI Insights API 응답 20-30초 → 캐싱 레이어로 개선 (Phase 3-A에서 구현됨)

### Stage 1 — UI 컴포넌트 개선 3건 ✅ 완료 (2026-02-26)
- ✅ ① 차트/KPI 개선: `TrendChart.tsx` (Recharts AreaChart, 기간/메트릭 Pill, 자체 fetch)
- ✅ ② AI 유입 카드: 이전 Step 1.2~1.3에서 `AiTrafficSummaryCard.tsx` + `AiTrafficDashboard.tsx` 구현 완료
- ✅ ③ 체크리스트: `OptimizationChecklist.tsx` (진행률 바, P0/P1/P2 배지, localStorage, 필터 Pill)

### Stage 2 — 데이터 품질 개선 2건 ✅ 완료 (2026-02-26)
- ✅ ④ AI Insights: `_meta` 파싱, 실시간/캐시 배지, 카테고리 색상, Actionable 태그, 새로고침
- ✅ ⑤ 키워드 인텐트: `IntentChart.tsx` (Recharts PieChart 도넛, 가중치 토글, Top 키워드 Accordion)

### 잔여 (P2)
- ⬜ F2 소스별 CSS 변수 색상 (ChatGPT/Perplexity 등 개별 색상)
- ⬜ F5 topKeywords 클릭/순위 데이터 보강 (API 응답 필드 확장 필요)

---

## Phase 2.5: UI/UX 디자인 세련화 (85% 🔄)

### 완료
- ✅ 컬러 시스템 리팩토링 (민트 그린 → 쿨 그레이 + 깊이감 레이어링)
- ✅ AEO/GEO 원형 게이지 (카운트업 애니메이션)
- ✅ 네비게이션 바 높이 조정 (60px → 72px, 27인치 모니터 최적화)
- ✅ 배경 톤 보정 (순백 → #F8FAFB)
- ✅ 카드 그림자, border 개선
- ✅ 차트 라인 색상 강화 (strokeWidth + 그라디언트 fill)
- ✅ AEO/GEO 상세 독립 Accordion (F8, 2026-02-26)
- ✅ DataTable 공통 컴포넌트 생성 (검색/정렬/페이지네이션)

### 미완료
- ✅ KPI 카드 디자인 통일 (CWV 카드와 일반 KPI 카드 불일치)
- ✅ DataTable을 Tab 1/Tab 2에 실제 적용 (기존 인라인 테이블 교체)
- ⬜ 컬러 의미 체계 CSS 변수 문서화
- ⬜ page.tsx 추가 컴포넌트 분리 (4371줄 → 2000줄 목표)

---

## Phase 3: 백엔드 고도화 (70% 🔄)

### 3-A: 수집 자동화 — 부분 완료
- ✅ `/api/cron/gsc/daily` 크론 엔드포인트 존재
- ✅ AI Insights 캐싱 레이어 구현 (B0-B6, in-memory cache)
- ✅ 일일 자동 데이터 수집 Cron Job 체계화 (외부 스케줄러 연동: GitHub Actions)
- ⬜ AI 요약 파이프라인 이력 저장 (DB 영속화)

### 3-B: 신규 API 개발 — 부분 완료
- ✅ Trend API 기본 구현 (`/api/gsc/trends`)
- ✅ GA4 funnel 확장 (type=test/supplement 분리)
- ✅ AI allowlist config 외부화
- ✅ Comparison API (기간 대비 비교 분석: `/api/comparison?compare=previous|yoy|mom`)
- ✅ 키워드 인텐트 가중치 개선 (개수 → 클릭/노출 가중치 서버 사이드: `/api/keywords/intent?weight=clicks|impressions|count`)

### 3-C: AI 유입 트래픽 고도화 — 부분 완료
- ✅ GA4 allowlist EXACT 매칭 전환 (FULL_REGEXP allowlist 기반)
- ✅ AI 유입 전용 전환 퍼널 (`/api/ga4/ai-funnel`)
- ✅ 랜딩페이지 콘텐츠 토픽 추출 (LLM/휴리스틱: `/api/ai/landing-topics`)
- ✅ AI 유입 vs 유기검색 비교 리포트 (`/api/ga4/ai-vs-organic`)
- ⬜ 커스텀 GA4 이벤트 (GTM AI referrer 감지)

---

## Phase 4: AEO 콘텐츠 전략 실행 (0% ⬜)

### 콘텐츠 기술 최적화
- ⬜ Schema Markup 적용 (FAQ, HowTo, Article)
- ⬜ E-E-A-T 신호 강화 (저자 프로필, 전문가 감수, 참고문헌)
- ⬜ 칼럼 AEO 작성 가이드라인 제작

### 성과 측정 체계
- ⬜ AI 검색엔진 인용 추적 시스템 (ChatGPT, Gemini, Perplexity)
- ⬜ AEO 성과 KPI 정의
- ⬜ 경쟁 분석 (AI 답변 인용 경쟁 콘텐츠 파악)

---

## Phase 5: 리텐션 및 그로스 루프 (0% ⬜)

- ⬜ 카카오 알림톡 API 기반 "미니 Braze" 실험
- ⬜ 이탈 패턴 식별 → 자동 리텐션 메시지 발송
- ⬜ 컨트롤 그룹 설정 + iROAS 측정
- ⬜ Braze 도입 ROI 계산 (증분 확인 후)
- ⬜ Amplitude 도입 검토 (GA4 한계 체감 시)

---

## 즉시 실행 가능한 다음 단계 (우선순위순)

| 순위 | 작업 | 담당 | 비고 |
|:----:|------|------|------|
| P0 | DataTable → Tab 1/Tab 2 적용 | Claude Code | Phase 2.5 잔여 |
| P0 | page.tsx 컴포넌트 분리 (4371줄 → 2000줄) | Claude Code | Phase 2.5 잔여 |
| P1 | Comparison API 개발 | Codex/백엔드 | Phase 3-B |
| P1 | AEO Score 분포 바 (Tab 1) | Claude Code | Phase 2 잔여 |
| P1 | Tab 5 KpiCard 3개 + 소스별 색상 | Claude Code | Phase 2 잔여 |
| P2 | Phase 3-C AI 유입 고도화 전체 | Codex/백엔드 | 1-2일 |
| P2 | 반응형 모바일 최적화 | Claude Code | Phase 2.5 확장 |

---

## 오늘(2026-02-26) 완료된 작업

### v3 FINAL 프론트엔드 개선 (feedback0226front2.0.md)

| 항목 | 내용 | 상태 |
|------|------|:----:|
| F1 | TrendChart (Recharts AreaChart + 기간/메트릭 Pill) | ✅ |
| F2 | AI 유입 카드 (이전 Step에서 완료) | ✅ |
| F3 | OptimizationChecklist (진행률 바 + P0/P1/P2 배지) | ✅ |
| F4 | AI Insights 캐시 배지 + UX 개선 | ✅ |
| F5 | IntentChart (Recharts PieChart 도넛 + 가중치 토글) | ✅ |
| F6 | 칼럼 분석 KPI (miniKpiGrid 이미 존재) | ✅ |
| F7 | DataTable 공통 컴포넌트 생성 | ✅ |
| F8 | AEO/GEO 독립 Accordion 토글 | ✅ |

### 신규 생성 파일

```
frontend/src/components/dashboard/TrendChart.tsx (+css)
frontend/src/components/dashboard/OptimizationChecklist.tsx (+css)
frontend/src/components/dashboard/IntentChart.tsx (+css)
frontend/src/components/common/DataTable.tsx (+css)
```

### 검증

- 빌드: ✅ 에러 0개
- Playwright: ✅ JS 에러 0개, 콘솔 에러 0개
- 서버: Frontend http://localhost:7010 ✅ / Backend http://localhost:7020 ✅

---

## Notion 문서 vs Repo 불일치 사항

| 항목 | Notion 기재 | 실제 Repo |
|------|-------------|-----------|
| FE 프레임워크 | Next.js 14 | Next.js **16.1.6** |
| CSS | Tailwind + shadcn/ui | **CSS Modules** (Tailwind/shadcn 미사용) |
| 차트 | Recharts (계획) | **Recharts** (2026-02-26 설치 완료) |
| page.tsx | 420줄 분리 | **4371줄** (분리 진행 중) |
| Phase 3 | 0% | **~20%** (B0-B6 백엔드 기반 구현됨) |

---

## iROAS (증분 ROAS) 측정 가능 시점

### 선행 조건

| 단계 | 내용 | 의존성 |
|------|------|--------|
| 1단계 | 카카오 알림톡 API 연동 | Phase 5 착수 |
| 2단계 | "미니 Braze" 리텐션 메시지 발송 체계 구축 | 1단계 완료 |
| 3단계 | 컨트롤 그룹 설정 (A/B 테스트 기반) | 2단계 완료 |
| 4단계 | iROAS 측정 시작 | 3단계 완료 + 2-4주 데이터 수집 |

### 예상 타임라인

- Phase 4 (AEO 콘텐츠 전략) 완료 후 Phase 5 착수 가능
- Phase 5 → 카카오 알림톡 연동 (1-2주) → 컨트롤 그룹 설정 (1주) → 데이터 수집 (최소 4주)
- **iROAS 측정 가능 시점: Phase 5 착수 후 약 6-8주 소요**
- Phase 3/4가 현재 진행률 기준으로 완료되어야 Phase 5 착수가 의미 있으므로, 현실적으로 **Phase 3~4 완료 + 6~8주** 후 iROAS 첫 결과 확보 가능
- iROAS 결과를 기반으로 Braze 정식 도입 ROI 계산 → 도입 여부 결정
