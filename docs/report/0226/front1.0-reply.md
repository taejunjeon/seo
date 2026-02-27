# feedback0226front1.0reply — AI Traffic 컴포넌트 분리 결과

작성일: 2026-02-26
작성: 헤파이스토스(코딩 에이전트)
요청 문서: `feedback0226front1.0.md`

---

## 0) 결론 요약

- `feedback0226front1.0.md`의 모든 요구사항을 반영 완료
- 7개 파일 + CSS 모듈 1개 + index 1개 = **총 9개 파일 생성**
- page.tsx Tab 5에서 기존 AI Traffic 인라인 코드(약 270줄) → `<AiTrafficDashboard />` 1줄로 교체
- 다른 탭(0~4, 6, 7) 코드 변경 없음
- 더미 데이터로 렌더링 확인 완료 (API 연동 전)
- 빌드 에러 없음, JS 에러 0개

---

## 1) 생성된 파일 목록

```
frontend/src/components/ai-traffic/
├── types.ts                     # 타입 정의 + 더미 데이터
├── AiTraffic.module.css          # 전용 CSS 모듈 (글래스모피즘 스타일 유지)
├── AiTrafficDashboard.tsx        # Tab 5 AI Traffic 컨테이너
├── AiTrafficKpi.tsx              # KPI 카드 그리드 (6개 지표)
├── AiTrafficBySourceTable.tsx    # 소스별 테이블
├── AiTrafficByLandingTable.tsx   # 랜딩페이지별 테이블
├── AiTrafficUserType.tsx         # 신규 vs 재방문 사용자
├── AiTrafficSummaryCard.tsx      # Tab 0용 요약 카드 (비워둠)
└── index.ts                      # 내보내기
```

---

## 2) 각 파일 상세

### 2-1. `types.ts`

실제 백엔드 `/api/ga4/ai-traffic` API를 호출하여 응답 구조를 확인한 뒤 타입 정의:

```typescript
type AiTrafficMetrics = {
  sessions: number;
  activeUsers: number;
  totalUsers: number;
  newUsers: number;
  engagedSessions: number;
  bounceRate: number;            // 0–1 fraction
  engagementRate: number;        // 0–1 fraction
  averageSessionDuration: number; // 초
  screenPageViews: number;
  ecommercePurchases: number;
  grossPurchaseRevenue: number;
};

type AiTrafficReport = {
  _meta: { type: "live" | "fallback"; queriedAt: string; period: {...} };
  range: { startDate: string; endDate: string };
  totals: AiTrafficTotals;
  bySource: AiTrafficBySourceRow[];     // + sessionSource, category
  byLandingPage: AiTrafficByLandingPageRow[]; // + landingPagePlusQueryString
  debug: { matchedPatterns: string[]; notes: string[] };
};
```

**피드백 요구사항 대응:**

| 요구 필드 | 타입 반영 | API 실제 반환 |
|-----------|----------|--------------|
| totals.sessions | ✅ | ✅ |
| totals.activeUsers | ✅ | ✅ |
| totals.newUsers | ✅ | ✅ |
| totals.engagedSessions | ✅ | ✅ |
| totals.bounceRate (0-1) | ✅ | ✅ (0.084) |
| totals.engagementRate (0-1) | ✅ | ✅ (0.916) |
| totals.averageSessionDuration (초) | ✅ | ✅ (1007.5) |
| totals.screenPageViews | ✅ | ✅ |
| totals.ecommercePurchases | ✅ | ✅ |
| totals.grossPurchaseRevenue | ✅ | ✅ |
| bySource[].category | ✅ (`"ai_referral"` 등) | ✅ |
| _meta.type | ✅ (`"live"` / `"fallback"`) | ✅ |
| _meta.queriedAt | ✅ | ✅ |
| _meta.period | ✅ | ✅ |

더미 데이터 `DUMMY_AI_TRAFFIC`도 실제 API 응답 값을 기반으로 작성.

---

### 2-2. `AiTrafficDashboard.tsx` (컨테이너)

**레이아웃 순서 (위→아래):**

1. 헤더 + 기간 선택 (7일 / 30일 / 90일 / 📅 커스텀)
2. 정의 설명 (AI 유입 = ChatGPT, Perplexity, ... + matchedPatterns)
3. **KPI 카드 그리드** → `<AiTrafficKpi />`
4. **신규 vs 재방문** → `<AiTrafficUserType />`
5. **소스별 + 랜딩페이지별 테이블** → `<AiTrafficBySourceTable />` + `<AiTrafficByLandingTable />`

**Props:**

```typescript
type Props = {
  onDiagnose?: (url: string) => void; // 페이지 진단 탭 이동 콜백
};
```

**현재 상태:**
- 더미 데이터(`DUMMY_AI_TRAFFIC`) 사용
- `loading = false` 고정
- 기간 선택 UI는 동작하나 실제 API 호출은 TODO 상태
- 로딩 스켈레톤 / 빈 데이터 상태 모두 구현

---

### 2-3. `AiTrafficKpi.tsx` (KPI 카드)

기존 4개 → **6개 KPI 카드**로 확장:

| KPI | 메인 값 | 서브 값 |
|-----|---------|---------|
| 세션 | sessions | 참여 세션 수 |
| 활성 사용자 | activeUsers | 신규 사용자 수 |
| 참여율 | engagementRate (%) | 이탈률 (%) |
| 평균 체류 | averageSessionDuration (분:초) | PV 수 |
| 구매 | ecommercePurchases | - |
| 매출 | grossPurchaseRevenue (₩) | - |

포맷 함수:
- `fmt()` — 숫자 한국어 포맷 (1,234)
- `pct()` — 퍼센트 변환 (0.916 → "91.6%")
- `dur()` — 초→분:초 변환 (1007.5 → "16분 48초")

---

### 2-4. `AiTrafficBySourceTable.tsx` (소스별 테이블)

| 컬럼 | 설명 |
|------|------|
| 소스 | sessionSourceMedium (chatgpt.com / referral) |
| 세션 | sessions |
| 사용자 | activeUsers |
| 참여율 | engagementRate (%) — 🆕 기존 대비 추가 |
| 구매 | ecommercePurchases |
| 매출 | grossPurchaseRevenue |

---

### 2-5. `AiTrafficByLandingTable.tsx` (랜딩페이지별 테이블)

| 컬럼 | 설명 |
|------|------|
| 랜딩페이지 | landingPagePlusQueryString (클릭 시 상세 펼침) |
| 세션 | sessions |
| 사용자 | activeUsers |
| 참여율 | engagementRate (%) — 🆕 추가 |
| 구매 | ecommercePurchases |
| (액션) | 진단 → 버튼 (onDiagnose 콜백) |

**펼침 기능:** 행 클릭 시 체류시간/PV/이탈률 상세 표시

---

### 2-6. `AiTrafficUserType.tsx` (신규 vs 재방문) — 🆕 신규 컴포넌트

```
┌──────────────────────────────────────┐
│ 👤 신규 vs 재방문 사용자              │
│ ┌───────────┐  ┌──────────────────┐  │
│ │    16      │  │       9          │  │
│ │ 신규 (64%) │  │ 재방문 (36%)     │  │
│ └───────────┘  └──────────────────┘  │
│ ████████████████░░░░░░░░░░           │
│  (녹색 = 신규)    (보라 = 재방문)     │
└──────────────────────────────────────┘
```

- `newUsers` / `(totalUsers - newUsers)` 비율 계산
- 프로그레스 바 시각화 (녹색 = 신규, 보라 = 재방문)

---

### 2-7. `AiTrafficSummaryCard.tsx` (Tab 0 용 — 비워둠)

피드백 요구대로 비워둔 상태:

```typescript
export default function AiTrafficSummaryCard(_props: AiTrafficSummaryCardProps) {
  // TODO: Tab 0 요약 카드 구현 (API 연동 단계에서)
  return null;
}
```

---

### 2-8. `AiTraffic.module.css`

page.module.css의 `aiTraffic*` 스타일을 분리하여 독립 CSS 모듈로 재구성.

**포함 스타일:**
- 공통: card, section, sectionHeader, sectionTitle, definition
- 기간 선택: periodBtns, periodBtn, datePicker
- KPI: kpiGrid, kpiItem, kpiValue, kpiLabel, kpiSub
- 신규/재방문: userTypeCard, userTypeGrid, userTypeBar 등
- 테이블: table, tableCard, tableTitle, sourceCell, landingCell
- 상태: empty, skeleton, badge (live/fallback/loading)
- 반응형: @media (max-width: 900px) 대응

**기존 디자인 유지:**
- 글래스모피즘: `backdrop-filter: blur`, `rgba` 배경
- 보라 그라디언트: `linear-gradient(135deg, #6366f1, #a855f7)`
- 스켈레톤 shimmer 애니메이션
- 반응형 그리드 (900px 이하 1열)

---

## 3) page.tsx 변경 사항

### 변경된 부분 (Tab 5 내부만)

**before (약 270줄):**
```jsx
{/* ── AI 유입 (AI Referral Traffic) ── */}
<section className={`${styles.card} ${styles.aiTrafficSection}`}>
  {/* ... 인라인 기간선택, KPI, 소스테이블, 랜딩테이블, GSC 토픽 등 270줄 ... */}
</section>
```

**after (4줄):**
```jsx
{/* ── AI 유입 (AI Referral Traffic) — 분리된 컴포넌트 ── */}
<AiTrafficDashboard
  onDiagnose={(url) => { setDiagUrl(url); setActiveTab(6); }}
/>
```

### 추가된 import

```typescript
import { AiTrafficDashboard } from "@/components/ai-traffic";
```

### 변경하지 않은 부분

- Tab 0 (오버뷰): AI 유입 요약 카드 — **변경 없음** ✅
- Tab 1 (칼럼 분석) — **변경 없음** ✅
- Tab 2 (키워드 분석) — **변경 없음** ✅
- Tab 3 (PageSpeed 보고서) — **변경 없음** ✅
- Tab 4 (Core Web Vitals) — **변경 없음** ✅
- Tab 5 (사용자 행동): GA4 행동 분석, 전환 퍼널 — **변경 없음** ✅
- Tab 6 (페이지 진단) — **변경 없음** ✅
- Tab 7 (솔루션 소개) — **변경 없음** ✅

---

## 4) 검증 결과

### 4-1. 빌드

```
npm --prefix frontend run build
✓ Compiled successfully in 957.0ms
✓ Generating static pages (4/4) in 159.8ms
```

TypeScript 에러 없음, 빌드 정상 통과.

### 4-2. Playwright 렌더링 검증

| 항목 | 결과 |
|------|------|
| Tab 0 - AI 유입 요약 카드 (변경 없음) | ✅ YES |
| Tab 5 - AI 유입 트래픽 타이틀 | ✅ YES |
| Tab 5 - 더미 배지 표시 | ✅ YES |
| Tab 5 - KPI 세션 | ✅ YES |
| Tab 5 - 신규 vs 재방문 사용자 | ✅ YES |
| Tab 5 - 소스별 AI 유입 테이블 | ✅ YES |
| Tab 5 - 랜딩페이지별 AI 유입 테이블 | ✅ YES |
| Tab 5 - 더미 chatgpt.com 데이터 | ✅ YES |
| Tab 5 - 기간 선택 7일 버튼 | ✅ YES |
| Tab 1 - 칼럼 분석 (다른 탭 영향 없음) | ✅ YES |
| **JS 에러** | **0개** ✅ |
| **Page errors** | **0개** ✅ |

### 4-3. 서버 상태

- 프론트엔드: http://localhost:7010 ✅ 정상
- 백엔드 API: http://localhost:7020 ✅ 정상

---

## 5) 완료 체크리스트

- [x] 새 컴포넌트 파일들이 생성되었는지 (9개 파일)
- [x] page.tsx에서 Tab 5가 AiTrafficDashboard를 렌더링하는지
- [x] 다른 탭에 영향 없는지 (Playwright 검증)
- [x] 빌드 에러 없는지 (TypeScript + Next.js 빌드 통과)

---

## 6) 다음 단계 (API 연동 시)

이번 단계에서는 더미 데이터로 구조만 잡았소. API 연동 시 수정할 부분:

1. **AiTrafficDashboard.tsx**: `DUMMY_AI_TRAFFIC` → 실제 `fetch()` + `useState` + `useCallback`
2. **기간 선택**: `// TODO: API 호출` → `loadAiTraffic({ days: ... })` 구현
3. **AiTrafficSummaryCard.tsx**: Tab 0 요약 카드 로직 구현
4. **page.tsx**: Tab 5의 기존 AI Traffic state 변수들 정리 (이제 컴포넌트 내부로 이동)
   - `aiTrafficData`, `aiTrafficLoading`, `aiTrafficDateRange` 등은 page.tsx에 아직 남아 있음
   - Tab 0 요약 카드가 여전히 이 state를 참조하므로, API 연동 단계에서 정리 필요

---

## 7) 참고: page.tsx에 남아 있는 AI Traffic 관련 코드

Tab 0 요약 카드와 초기 데이터 로딩이 아직 page.tsx에 있음:

| 위치 | 내용 | 이유 |
|------|------|------|
| 223~256행 | AI Traffic 구 타입 정의 | Tab 0 요약 카드가 참조 |
| 712~722행 | AI Traffic state 변수들 | Tab 0 요약 카드가 참조 |
| 1091~1127행 | `loadAiTraffic` 함수 | 초기 로드 + Tab 0 참조 |
| 1384~1385행 | 초기 로드 호출 | mount 시 30일 데이터 |
| 1972~1988행 | `aiTrafficComputedTotals` | Tab 0 요약 카드 |
| 2551~2598행 | Tab 0 AI 유입 요약 카드 | **이번 범위 외 (건드리지 않음)** |

→ 이들은 다음 단계에서 `AiTrafficSummaryCard` 구현과 함께 정리 예정.
