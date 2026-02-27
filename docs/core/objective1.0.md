# BiocomAI SEO Intelligence Dashboard — Objective 1.0

- 작성일: 2026-02-25
- 대상/범위: `biocom.kr/healthinfo` (건강칼럼 섹션)
- 기준 문서: `biocom_seo_dashboard_prd.docx` (v1.0, 문서 표기 작성일: 2025-02-11)
- 기준 코드: 이 저장소의 `frontend/` + `backend/` 구현 상태(로컬 실행 기준)

---

## 1) 프로젝트 목적 (Project Objective)

### 1.1 한 줄 정의
`biocom.kr/healthinfo`의 **SEO 성과(GSC) + 기술 품질(PageSpeed/CWV) + 사용자 행동(GA4)**을 한 화면에서 통합 모니터링하고, **AEO/GEO(생성형/답변형 검색) 시대의 AI 인용·AI 유입**까지 포함해 **“개선 우선순위 + 실행 과제”**를 빠르게 만들기 위한 내부 SEO 인텔리전스 대시보드.

### 1.2 왜 필요한가(문제 정의)
- 검색 성과(GSC), 성능(CWV), 행동(GA4)이 서로 분리되어 있어 “원인→액션” 연결이 느리고, 매번 수동 리포팅이 반복됨.
- 건강칼럼(의료/헬스, YMYL) 특성상 **신뢰 신호(E‑E‑A‑T)**, 구조화 데이터, 성능 이슈가 성과에 미치는 영향이 큼.
- AI 검색(예: ChatGPT Search, Perplexity 등)에서 **출처로 인용되는가**가 향후 유입에 영향을 주므로, 기존 SEO 지표만으로는 부족함.

### 1.3 핵심 목표(기대 효과)
- (O1) **자동 추적**: GSC/PSI/GA4 데이터를 주기적으로 수집·저장해 “전주/전월 비교”를 자동화.
- (O2) **우선순위화**: 페이지/키워드를 점수화해 “무엇부터 고칠지”를 바로 제시.
- (O3) **기술 SEO 가시화**: CWV/성능 문제를 URL 단위로 빠르게 확인하고 개선 방향을 제시.
- (O4) **AEO/GEO 관리**: 구조화/콘텐츠 구조/AI 인용/AI 유입을 묶어서 “AI 검색 대응력”을 측정.
- (O5) **의사결정 시간 단축**: 수동 모니터링 시간을 줄이고(주 2시간 → 10분 수준 목표), 실행 가능한 인사이트를 제공.

---

## 2) 프로젝트 구조 (Repository / System Structure)

### 2.1 리포지토리 구성(폴더 중심)
- `frontend/`: Next.js(App Router) 기반 대시보드 UI (기본 포트 7010)
- `backend/`: Express(TypeScript) 기반 API 서버 (기본 포트 7020)
- `backend/supabase/schema.sql`: Supabase(Postgres) 스키마(PRD 기반 3개 핵심 테이블)
- 루트 `package.json`: 프론트/백 실행 보조 스크립트(`dev:*`, `build:*`, `lint:*`)
- 루트 문서들: `phase1*.md`, `0212result1.0.md`, `front*.md`, `report*.md`, `newfunc*.md` 등(요구사항/피드백/결정 로그)

### 2.2 실행 구조(런타임 관점)
- 프론트(Next.js): 사용자 입력/탭 UI, 백엔드 API 호출, 일부 리포트는 Next API Route로 로컬 문서 제공
- 백엔드(Express): 외부 API(GSC/PSI/GA4/AI Provider) 호출, 점수 산출, 일부 데이터(Supabase/로컬 JSON) 저장

### 2.3 백엔드 주요 모듈(기능 단위)
- 데이터 소스
  - GSC: `backend/src/gsc.ts`
  - PageSpeed: `backend/src/pagespeed.ts`
  - GA4: `backend/src/ga4.ts`
  - Supabase: `backend/src/supabase.ts`, 스키마: `backend/supabase/schema.sql`
- 분석/진단
  - 크롤/페이지 구조 분석: `backend/src/crawl.ts`
  - AEO/GEO 점수 엔진: `backend/src/scoring.ts`
  - 키워드 인텐트 분류(규칙+GPT): `backend/src/intent.ts`
- AI/모니터링
  - AI 인사이트/채팅: `backend/src/ai.ts`
  - AI 인용도 측정: `backend/src/aiCitation.ts`, `backend/src/aiCitationMulti.ts`
  - Provider 커넥터: `backend/src/serpapi.ts`, `backend/src/perplexity.ts`, `backend/src/openaiSearch.ts`
- 통합 API: `backend/src/server.ts` (CORS, env 검증, 엔드포인트 집합)

### 2.4 프론트엔드 핵심 UI(탭 단위)
- 오버뷰: KPI, 트렌드, (AEO/GEO) 점수, AI 인사이트, 공유/캡처 흐름
- 칼럼 분석: URL 단위 성과/스코어, 개선 우선순위 판단
- 키워드 분석: Q&A 태깅, 기회 키워드, intent 분포
- PageSpeed 보고서: 내부 문서 기반 리포트 뷰(현재 `lcpfcp1.0.md` 파일 로드)
- Core Web Vitals: PageSpeed 측정/히스토리, CWV 지표/게이지
- 사용자 행동: GA4 기반 참여/이탈/전환 퍼널, AI referral(휴리스틱) 트래픽
- 페이지 진단: URL 단위 크롤링(Schema/구조) + AEO/GEO + AI 인용도 + 히스토리
- 솔루션 소개: 제품/팀 공유용 설명(기능 및 로드맵 요약)

---

## 3) 기능별 목적 (Functional Objectives)

> “기능”은 구현(What)이고, “기능별 목적”은 왜(Why)와 성공 조건(Definition of Done)을 뜻합니다.

| 기능 영역 | 기능별 목적 | 현재 구현(코드 기준) | 비고(성공 조건/DoD) |
|---|---|---|---|
| GSC 연동(검색 성과) | 클릭/노출/CTR/순위를 **페이지/키워드 관점**으로 관측하고 비교 가능한 형태로 만든다 | `/api/gsc/*` (sites/query/kpi/trends/keywords/columns) + `/api/cron/gsc/daily`(DB upsert) | 서비스계정 권한 + `GSC_SERVICE_ACCOUNT_KEY` 연결 시 실데이터 확인 |
| PageSpeed/CWV(기술 SEO) | 성능 점수와 CWV를 URL 단위로 측정하고 “개선 대상”을 드러낸다 | `/api/pagespeed/run`, `/api/pagespeed/results`, `/api/pagespeed/batch` + Supabase 저장(옵션) | 주간 측정 자동화(크론) + 주요 URL 리스트 운영 룰 필요 |
| GA4(행동/전환) | “검색→클릭 이후” 사용자 행동(체류/이탈/전환)을 연결해 콘텐츠 품질을 판단한다 | `/api/ga4/engagement`, `/api/ga4/funnel`, `/api/ga4/top-sources`, `/api/ga4/ai-traffic`, `/api/ai-traffic/topics` | GA4 Data API 활성화 + 속성/권한 설정 필요(미설정 시 UI는 mock fallback) |
| 칼럼 스코어카드 | 페이지별 개선 우선순위를 “점수+근거”로 제시한다 | `/api/gsc/columns`에서 검색/기술/체류/AEO 요소 결합 스코어 산출 | DB 기반 장기 트렌드(전주 대비 등)까지 연결 시 완성 |
| 키워드 분석(Q&A/기회) | Q&A형 키워드와 CTR 개선 기회를 자동 탐지해 콘텐츠 기획에 연결한다 | `/api/gsc/keywords`에서 Q&A 패턴 태깅, opportunity 키워드(노출↑ CTR↓) 탐지 | intent 분류와 결합해 “정보성/상업성” 전략 제시 |
| 키워드 인텐트 | 키워드 의도를 분류해 “콘텐츠 형식/CTA”를 맞춘다 | `/api/keywords/intent` (규칙 기반 + OpenAI 보완 옵션) | 운영 시 비용/일관성을 고려한 “rule/hybrid” 정책 고정 필요 |
| AEO/GEO 점수 | AI 검색 시대에 필요한 신호(구조화/구조/인용/AI유입)를 측정해 개선 방향을 만든다 | `/api/aeo/score`, `/api/geo/score` + `backend/src/scoring.ts` breakdown | 외부 Provider 키 설정 시 “인용(0점 원인)” 분해가 가능 |
| AI 인용 모니터링 | ChatGPT/Perplexity 등에서 **출처로 인용되는지**를 측정하고 경쟁 출처를 비교한다 | `/api/ai/citation` (멀티 프로바이더) + 프론트 `AiCitationSection` | KR 운영 점수 산식에서는 Google AIO를 “참고용”으로 분리(가중치: ChatGPT 0.8, Perplexity 0.2) |
| AI 인사이트/챗 | 수치 해석을 자동화하고, 팀이 바로 실행할 조언을 얻는다 | `/api/ai/insights`, `/api/ai/chat` (OpenAI) | 운영 정책(모델/비용/로그/PII)을 확정해야 운영 가능 |
| 페이지 진단(크롤) | 특정 URL의 Schema/구조/AI 신호를 빠르게 진단해 “수정 체크리스트”로 연결한다 | `/api/crawl/analyze`, `/api/crawl/subpages` + 진단 히스토리(`/api/diagnosis/*`, 로컬 JSON 저장) | 히스토리 저장은 현재 로컬 파일 기반 → 배포/다중 사용자 고려 시 DB로 이전 필요 |
| 운영/보안 | 키/권한/크론을 안전하게 관리하고, 외부 호출 비용을 통제한다 | `backend/src/env.ts`(Zod), CORS allowlist, `CRON_SECRET` 가드, `/health`(연동 상태 표시) | 배포 시 rate limit, 에러 모니터링, 시크릿 관리(Vercel/Supabase) 필요 |

---

## 4) 로드맵(목적 대비) + 구현도(%)

### 4.1 구현도 산정 규칙(이 문서에서의 정의)
- **코드 구현도**: 기능이 코드로 구현되어 있고, 최소한 로컬에서 실행 가능한 정도
- **운영 준비도**: 외부 키/권한/배포/자동화까지 갖춰 “지속 운영” 가능한 정도
- 아래 %는 저장소의 코드/문서 상태를 기반으로 한 **추정치**이며, 실제 운영 연결 여부에 따라 달라질 수 있음.

### 4.2 PRD 로드맵 기준(Phase) 진행 현황 (2026-02-25 기준)

| Phase | 목표(요약) | 코드 구현도 | 운영 준비도 | 근거(현재 상태) |
|---|---|---:|---:|---|
| Phase 1-1 | 인프라 + GSC 연동 | 100% | 70% | 프론트/백 분리 구동 + GSC API 엔드포인트 구축. 운영 배포는 미정 |
| Phase 1-2 | PageSpeed + DB + 실데이터 연결 | 85% | 45% | PSI 측정/저장(옵션) 구현. Supabase 스키마 파일 존재. “주간 크론”은 미구현 |
| Phase 2-1 | GA4 + 키워드/칼럼 분석 | 90% | 50% | GA4 엔드포인트/프론트 연결 구현. 다만 GA4 API 활성화/권한/지속 저장은 환경 의존 |
| Phase 2-2 | AI 모니터링 + 완성 | 70% | 25% | AI 인용/인텐트/인사이트/챗/진단 기능 구현. 알림/배포/운영가드(비용/로그)는 미완 |

### 4.3 목적 달성을 위한 “현재 기준” 실행 로드맵(갭 클로징)

> 아래는 “현재 구현된 코드”를 바탕으로 **목표(O1~O5)를 운영 수준으로 끌어올리기 위한 다음 단계**입니다.

| 단계 | 목적과의 연결 | 해야 할 일(핵심) | 현재 진행 | 구현도(추정) |
|---|---|---|---|---:|
| R1. 운영형 데이터 저장 확정 | O1, O2 | Supabase 실제 프로젝트 생성 → `schema.sql` 적용 → RLS/권한 정책 확정 | 부분 구현 | 55% |
| R2. 수집 자동화(크론) 완성 | O1 | `/api/cron/pagespeed/weekly`, `/api/cron/ga4/daily` 추가 + Vercel Cron(또는 대체) 연결 + `CRON_SECRET` 적용 | 미구현 | 20% |
| R3. 실데이터 100% 대시보드 | O2, O3 | 오버뷰/스코어카드에서 mock fallback 구간을 “DB 기반 실데이터”로 대체 | 일부 연결 | 60% |
| R4. AEO/GEO 진단 품질 고도화 | O4 | AI 인용 측정의 비용/동시성/캐시 정책 고정, URL 매칭(broad) 안전장치(SSRF 등) 점검 | 일부 구현 | 65% |
| R5. 알림/운영 루프 구축 | O1, O5 | 급락/악화 감지(순위/CTR/CWV) → Slack/이메일 알림 + 담당자 액션 로그 | 미구현 | 0% |
| R6. 배포/운영 안정화 | 전부 | 배포 구조 결정(프론트+백), 시크릿 관리, rate limit, 에러 모니터링(Sentry 등), 운영 가이드 | 미구현 | 10% |

---

## 5) 현재 상태에서의 “목적 대비 리스크/갭” 요약

- 데이터는 “조회(실시간)” 중심이 강함 → 목적(O1)의 “누적/비교 자동화”를 위해 DB+크론이 핵심 병목.
- AI/외부 Provider 연동은 코드가 있어도 **비용/정책/로그/보안**이 확정되지 않으면 운영에서 멈출 수 있음.
- 배포/운영(환경변수, Cron, 모니터링) 결정이 없으면, 기능 구현이 늘어도 팀 사용성이 떨어질 가능성이 큼.

---

## 6) 참고: 이 저장소에서 “현재 핵심 진입점”

- 프론트 UI: `frontend/src/app/page.tsx`
- 백엔드 API: `backend/src/server.ts`
- 환경변수 정의: `backend/src/env.ts`, `backend/.env.example`
- DB 스키마: `backend/supabase/schema.sql`
- 대시보드 캡처(자동 스크린샷): `backend/scripts/capture-dashboard.ts`

