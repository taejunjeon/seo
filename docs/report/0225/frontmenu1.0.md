# report0225-frontmenu1.0 — 현재 메뉴 구조 및 AI 유입 UI 연결 분석

작성일: 2026-02-25
작성: 헤파이스토스(코딩 에이전트)
대상 저장소: `/Users/vibetj/coding/seo`
참조 문서: `report0222feedback-1result.md`

---

## 1) 현재 솔루션 메뉴 구조

### 네비게이션 탭 정의

**파일**: `frontend/src/app/page.tsx` (367번 줄)

```typescript
const NAV_TABS = ["오버뷰", "칼럼 분석", "키워드 분석", "PageSpeed 보고서", "Core Web Vitals", "사용자 행동", "페이지 진단", "솔루션 소개"];
```

| 탭 Index | 탭 이름 | 주요 기능 | 데이터 소스 |
|----------|---------|----------|------------|
| **0** | 오버뷰 | AEO/GEO 점수, AI Insights, 클릭/노출 추이, KPI 그리드, AI Traffic 오버뷰, AI Citation | GSC + GA4 + AI Citation API |
| **1** | 칼럼 분석 | 칼럼별 성과(Clicks, Impressions, CTR, Position, AEO Score), 상품/기타 페이지 성과 | GSC |
| **2** | 키워드 분석 | 키워드 순위 추적, Intent 분석(정보/상업/탐색/브랜드), 기회 키워드, 질답 마크업 감지 | GSC + Scoring |
| **3** | PageSpeed 보고서 | Google PageSpeed Insights 점수, 성능 메트릭(LCP, FCP, CLS, INP, TTFB) | PageSpeed API |
| **4** | Core Web Vitals | 페이지 속도 진단(Mobile/Desktop), CWV 점수 시각화, PageSpeed 테스트 | PageSpeed API |
| **5** | 사용자 행동 | GA4 페이지별 행동(Sessions, Users, Avg Time, Bounce Rate), AI Traffic 분석, SEO→전환 퍼널 | GA4 |
| **6** | 페이지 진단 | URL 입력→Schema 마크업 분석, 콘텐츠 구조 분석, 감점 요인, 하위 페이지 목록, 진단 히스토리 | Crawl + Scoring |
| **7** | 솔루션 소개 | 히어로 섹션, 데이터 소스 설명, 점수 체계 가이드(AEO/GEO 산식), 로드맵 | 정적 콘텐츠 |

---

## 2) 네비게이션 UI 구조

### 2-1. 상단 네비게이션 바 (글래스모피즘)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 🧠 Biocom AI Agent    [오버뷰][칼럼 분석][키워드 분석]...    ● 연결 상태  │
│    AEO/GEO Intelligence                                     📷 캡처     │
└──────────────────────────────────────────────────────────────────────────┘
```

- **위치**: sticky top (z-index: 100)
- **스타일**: 글래스모피즘 (반투명 배경 + backdrop blur)
- **구조**: 브랜드 좌측 | 탭 버튼 중앙 | 상태/캡처 우측

### 2-2. 라우팅 방식

- **SPA (Single Page Application)** 구조
- 모든 탭이 `/` 경로에서 `activeTab` state로 관리 (React useState)
- URL 라우팅 없음 — 탭 전환은 state 변경으로 처리

---

## 3) 각 탭 내부 섹션 상세

### Tab 0: 오버뷰

| 섹션 | 설명 |
|------|------|
| AEO/GEO 점수 카드 | KpiCard 컴포넌트로 점수 표시 |
| AI Insights 패널 | 우선순위별 인사이트 (urgent, opportunity, trend, recommend) |
| 클릭/노출 추이 | 30일 트렌드 차트 |
| KPI 그리드 | Clicks, Impressions, CTR, Avg Position |
| **AI Traffic 오버뷰** | GA4 기반 AI 유입 요약 (이미 일부 구현) |
| 키워드/칼럼 분석 프리뷰 | 간략 요약 테이블 |
| AI Citation 섹션 | AI 인용도 분석 (AiCitationSection 컴포넌트) |

### Tab 5: 사용자 행동

| 섹션 | 설명 |
|------|------|
| GA4 페이지별 행동 분석 | Sessions, Users, Avg Time, Bounce Rate |
| **AI Traffic 분석** | Source/Medium별, Landing Page별 분석 (이미 일부 구현) |
| SEO→전환 퍼널 | 퍼널 시각화 |

---

## 4) AI 유입 UI 연결 분석

### 4-1. `report0222feedback-1result.md`의 다음 개발 계획

> **"프론트(Tab 5 사용자 행동 / Tab 0 오버뷰)에 AI 유입 UI 연결"**
>
> - Tab 5: 기간 선택 UI 재사용 → `/api/ga4/ai-traffic` 호출 → KPI(세션/유저/매출) + bySource/byLandingPage 테이블
> - Tab 0: 요약 카드 1개(최근 30일 AI 세션/유저 + 상위 1~3 소스)

### 4-2. 연결 대상 메뉴 분석

| 연결 위치 | 탭 | 이유 | 구현 방향 |
|-----------|-----|------|----------|
| **Tab 5 (사용자 행동)** — 메인 | 사용자 행동 | GA4 기반 행동 데이터와 같은 맥락. 기간 선택 UI가 이미 존재하여 재사용 가능 | `/api/ga4/ai-traffic` 호출 → KPI 카드(AI 세션, AI 유저, AI 매출) + bySource 테이블 + byLandingPage 테이블 |
| **Tab 0 (오버뷰)** — 요약 | 오버뷰 | 대시보드 첫 화면에서 AI 유입 현황 한눈에 파악 | 요약 카드 1개: 최근 30일 AI 세션/유저 수 + 상위 1~3 소스 표시 |

### 4-3. 사용할 백엔드 API (이미 구현 완료)

| API | 용도 | 연결 탭 |
|-----|------|---------|
| `GET /api/ga4/ai-traffic` | AI 서비스 referral 트래픽 집계 (totals, bySource, byLandingPage) | Tab 5 (상세) + Tab 0 (요약) |
| `GET /api/ga4/top-sources` | 전체 sessionSource 상위 목록 (allowlist 튜닝용) | Tab 5 (디버그/관리) |
| `GET /api/ai-traffic/topics` | AI 유입 랜딩 + GSC top queries 근사치 매핑 | Tab 5 (옵션: 키워드/토픽 표시) |

### 4-4. 현재 구현 상태 점검 필요

Tab 0과 Tab 5에 AI Traffic 관련 UI가 **일부 이미 존재**하는 것으로 보이나, `report0222feedback-1result.md`에서 "프론트 실제 UI 반영은 이번 범위에서 미포함"이라 명시한 만큼, 현재 UI가 새 API(`/api/ga4/ai-traffic`)와 실제 연동되어 있는지 코드 레벨에서 확인이 필요함.

---

## 5) 컴포넌트 구조

### 5-1. 기존 재사용 가능 컴포넌트

| 컴포넌트 | 경로 | 용도 |
|---------|------|------|
| `KpiCard` | `components/dashboard/KpiCard.tsx` | KPI 메트릭 카드 (점수, 변화량, Sparkline) — Tab 0 요약 카드에 재사용 가능 |
| `AiCitationSection` | `components/diagnosis/AiCitationSection.tsx` | AI 인용도 분석 — 별도 기능이나 AI 유입과 함께 표시 가능 |

### 5-2. 신규 필요 컴포넌트 (예상)

| 컴포넌트 | 위치 제안 | 용도 |
|---------|----------|------|
| `AiTrafficKpi` | `components/dashboard/` 또는 Tab 5 인라인 | AI 세션/유저/매출 KPI 카드 |
| `AiTrafficBySourceTable` | Tab 5 인라인 | bySource 테이블 (sessionSource, sessions, users, revenue) |
| `AiTrafficByLandingTable` | Tab 5 인라인 | byLandingPage 테이블 (path, sessions, users) |
| `AiTrafficSummaryCard` | Tab 0 인라인 | 오버뷰 요약 카드 (30일 AI 세션 + 상위 소스) |

---

## 6) 핵심 파일 경로

| 파일 | 설명 | 수정 필요 |
|------|------|----------|
| `frontend/src/app/page.tsx` | 메인 대시보드 (4,682줄, 모든 탭 로직) | ✅ Tab 0, Tab 5에 AI 유입 UI 추가 |
| `frontend/src/app/page.module.css` | 전체 스타일 | ✅ AI 유입 관련 스타일 추가 |
| `frontend/src/components/dashboard/KpiCard.tsx` | KPI 카드 | 재사용 (수정 불필요) |
| `backend/src/ga4.ts` | GA4 API 함수 | 이미 구현 완료 |
| `backend/src/server.ts` | API 라우트 | 이미 구현 완료 |

---

## 7) 결론

**AI 유입 UI 연결 대상 메뉴:**

1. **Tab 5 (사용자 행동)** — 메인 상세 뷰
   - AI Traffic KPI 카드 + bySource 테이블 + byLandingPage 테이블
   - 기간 선택 UI 재사용

2. **Tab 0 (오버뷰)** — 요약 카드
   - 최근 30일 AI 세션/유저 + 상위 소스 요약

백엔드 API는 이미 3개 모두 구현 완료(`/api/ga4/ai-traffic`, `/api/ga4/top-sources`, `/api/ai-traffic/topics`)되어 있으므로, **프론트엔드 UI 연동만 남은 상태**이오.

---

## 8) AI 유입 UI 연결 결과 (2026-02-25 실행)

### 8-1. 결론: 프론트엔드 UI 연동은 이미 완료 상태

코드 분석 결과, `report0222feedback-1result.md`에서 "다음 개발 계획"으로 잡았던 **AI 유입 UI 연결이 이미 구현되어 있었음**을 확인함.
다만 미커밋 상태(git modified)로 남아 있어, 문서(report)에는 "미반영"으로 기록되어 있었음.

### 8-2. Tab 0 (오버뷰) — AI 유입 요약 카드 ✅ 구현 완료

**위치**: `page.tsx` 2551~2598번 줄

| 구현 항목 | 상태 | 상세 |
|-----------|------|------|
| AI 유입 (Referral) 카드 | ✅ | `<section className={styles.aiTrafficOverview}>` |
| KPI 4종 (세션, 활성 사용자, 구매, 매출) | ✅ | `aiTrafficComputedTotals` 기반 렌더링 |
| 상위 소스 1~3 표시 | ✅ | `bySource.slice(0, 3)` |
| 로딩/스켈레톤 상태 | ✅ | `aiTrafficLoading` 분기 |
| LiveBadge / NoDataBadge | ✅ | `aiTrafficHasData` 기반 |
| 설명 노트 | ✅ | AI 유입 = ChatGPT, Perplexity, Gemini, Claude 등 |

### 8-3. Tab 5 (사용자 행동) — AI 유입 트래픽 상세 ✅ 구현 완료

**위치**: `page.tsx` 3713~3980번 줄

| 구현 항목 | 상태 | 상세 |
|-----------|------|------|
| AI 유입 트래픽 섹션 | ✅ | `<section className={styles.aiTrafficSection}>` |
| 기간 선택 UI (7일/30일/90일/커스텀) | ✅ | `aiTrafficRangePreset` + 날짜 입력 |
| KPI 4종 (세션, 활성 사용자, 구매, 매출) | ✅ | bySource 합산 fallback 포함 |
| 소스별 AI 유입 테이블 | ✅ | Source, 세션, 사용자, 구매, 매출 컬럼 |
| 랜딩페이지별 AI 유입 테이블 | ✅ | 랜딩페이지, 세션, 사용자, 구매 + 진단 연결 |
| 랜딩페이지 → 페이지 진단 연결 | ✅ | `진단 →` 버튼 → Tab 6으로 이동 + URL 자동 입력 |
| GSC 상위 검색 주제 (근사치) 확장 | ✅ | `/api/ai-traffic/topics` 연동, 클릭 시 조회 |
| 데이터 없음 Empty State | ✅ | 설명 텍스트 포함 |
| debug.matchedPatterns 표시 | ✅ | 측정 대상 AI 소스 목록 표시 |

### 8-4. 데이터 로딩 연결

| 항목 | 상태 | 상세 |
|------|------|------|
| `loadAiTraffic` 함수 | ✅ | `page.tsx` 1093~1127번 줄, `/api/ga4/ai-traffic` fetch |
| 초기 로드 (30일) | ✅ | `page.tsx` 1384~1385번 줄, mount 시 자동 호출 |
| 캐시 우회 (`refresh=1`) | ✅ | API 파라미터 지원 |
| totals 0 시 bySource 합산 fallback | ✅ | `aiTrafficComputedTotals` useMemo |
| 타입 정의 | ✅ | `AiTrafficTotals`, `AiTrafficBySourceRow`, `AiTrafficByLandingPageRow`, `AiTrafficReport` |

### 8-5. CSS 스타일

- **TSX에서 사용하는 CSS 클래스 30개** — 전부 `page.module.css`에 정의 완료
- 누락 클래스: **없음**
- 미사용 클래스 1개: `.aiTrafficSectionHeader` (dead CSS, 기능에 영향 없음)

### 8-6. 코드 수정 (이번 세션)

1. **React key prop 경고 수정**
   - `page.tsx` 3873번 줄: `<>` → `<Fragment key={row.landingPagePlusQueryString}>` 변경
   - `Fragment` import 추가
   - 수정 전: `[error] Each child in a list should have a unique "key" prop.`
   - 수정 후: JS 에러 0개

### 8-7. Playwright 검증 결과

#### 검증 1차 (수정 전)

| 항목 | Tab 0 | Tab 5 |
|------|-------|-------|
| AI 유입 카드 | ✅ YES | - |
| AI 유입 세션 KPI | ✅ YES | - |
| 상위 소스 표시 | ✅ YES | - |
| AI 유입 트래픽 섹션 | - | ✅ YES |
| 소스별 테이블 | - | ✅ YES |
| 랜딩페이지 테이블 | - | ✅ YES |
| chatgpt.com 데이터 | - | ✅ YES |
| JS 에러 | 1개 (key prop 경고) | |

#### 검증 2차 (수정 후)

| 항목 | 결과 |
|------|------|
| Tab 0 AI 유입 카드 | ✅ YES |
| Tab 0 AI 유입 세션 KPI | ✅ YES |
| Tab 0 상위 소스 | ✅ YES |
| Tab 5 AI 유입 트래픽 | ✅ YES |
| Tab 5 소스별 테이블 | ✅ YES |
| Tab 5 랜딩페이지 테이블 | ✅ YES |
| Tab 5 chatgpt.com 데이터 | ✅ YES |
| **JS 에러** | **0개** ✅ |
| **네트워크 에러** | **0개** ✅ |
| **Page errors** | **0개** ✅ |

### 8-8. 백엔드 API 실제 데이터 확인

#### `/api/ga4/ai-traffic` (최근 30일)

| 소스 | 세션 | 활성 사용자 | 구매 | 매출 |
|------|------|------------|------|------|
| chatgpt.com / referral | 179 | 10 | 1 | ₩32,980 |
| gemini.google.com / referral | 17 | 4 | 0 | - |
| chatgpt.com / (not set) | 14 | 8 | 0 | - |
| perplexity.ai / referral | 3 | 3 | 0 | - |

**총 AI 유입**: 213 세션, 25 사용자, 1 구매, ₩32,980 매출

#### `/api/ga4/top-sources` (최근 30일, 상위 10개)

1. tiktok_biocom_acidcam_acid (45,533)
2. tiktok_biocom_mineralcam_mineral (44,504)
3. meta_biocom_happycreel_hormon (33,355)
4. google (27,671)
5. (direct) (18,684)
- AI 소스(chatgpt.com, gemini, perplexity 등)는 전체 대비 소수이나 고품질 유입

#### `/api/ai-traffic/topics` (상위 3 랜딩)

| 랜딩페이지 | AI 세션 | GSC 매칭 쿼리 |
|-----------|---------|--------------|
| /report | 40 | (없음) |
| (not set) | 25 | (없음) |
| / | 25 | (없음) |

### 8-9. 서버 상태

- **프론트엔드**: http://localhost:7010 ✅ 정상 실행
- **백엔드 API**: http://localhost:7020 ✅ 정상 실행
- **AI 유입 기능 페이지**:
  - Tab 0 (오버뷰): http://localhost:7010 접속 시 첫 화면
  - Tab 5 (사용자 행동): 상단 네비 "사용자 행동" 클릭

---

## 9) 최종 요약

| 항목 | 결과 |
|------|------|
| Tab 0 AI 유입 요약 카드 | ✅ 구현 완료 + API 연동 확인 |
| Tab 5 AI 유입 상세 섹션 | ✅ 구현 완료 + API 연동 확인 |
| 백엔드 API 3종 | ✅ 모두 정상 동작, 실제 데이터 반환 |
| CSS 스타일 | ✅ 30개 클래스 전부 정의 완료 |
| React key 경고 | ✅ Fragment key 수정 완료 (JS 에러 0개) |
| Playwright 콘솔 검증 | ✅ JS 에러 0, 네트워크 에러 0, Page error 0 |

`report0222feedback-1result.md`에서 계획한 "프론트에 AI 유입 UI 연결"은 **이미 완전 구현**되어 있었으며, 이번 세션에서는 **React key 경고 1건을 수정**하고 **실제 동작을 검증**하여 정상 작동을 확인함.
