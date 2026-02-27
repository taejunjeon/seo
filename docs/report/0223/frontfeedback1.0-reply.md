# report0223-frontfeedback1-result1.0 — 프론트엔드 "AI 유입" UI 구현 결과

작성일: 2026-02-23
작성: 헤파이스토스(코딩 에이전트)
대상 저장소: `/Users/vibetj/coding/seo`

---

## 0) 결론 요약

- `report0223-frontfeedback1.0.md`의 핵심 목표("AI 유입을 오버뷰 + 사용자 행동 탭에서 의사결정용으로 보여준다")를 **프론트엔드에 구현 완료**했습니다.
- 기존 백엔드 API(`/api/ga4/ai-traffic`, `/api/ai-traffic/topics`)를 활용하여 **실데이터 연동**됩니다.
- 빌드 및 타입 체크 모두 통과했습니다.

---

## 1) 피드백 항목별 반영 결과

### [1] 오버뷰(요약 카드) 추가 ✅

- **위치**: Tab 0 (오버뷰) > KPI 카드 4개 아래
- **구성**: AI 유입 요약 카드 1개
  - AI 유입 세션 / AI 활성 사용자 / AI 구매 / AI 매출
  - 상위 소스 3개 표시 (예: `chatgpt.com (167)`, `gemini.google.com (13)`, `perplexity.ai (2)`)
- **주석**: "AI 유입 = ChatGPT, Perplexity, Gemini, Claude 등 AI 서비스에서 직접 넘어온 유입. Google 검색의 AI Overview 유입은 여기 포함되지 않을 수 있음."
- **LiveBadge/LoadingBadge/NoDataBadge**: 데이터 상태에 따라 동적 표시
- **GA4 totals가 0인 경우**: bySource 합산값을 fallback으로 사용 (실제 데이터에서 이 케이스가 발생했으므로 처리)

### [2] 사용자 행동 탭에 "AI 유입" 섹션 추가 ✅

- **위치**: Tab 5 (사용자 행동) > 기존 "페이지별 사용자 행동" 테이블 아래, 퍼널 위
- **기간 선택**: 기존 사용자 행동 탭의 기간 선택 UI(7일/30일/90일/커스텀) 패턴 재사용
- **KPI 요약**: 4개 지표 (세션/활성 사용자/구매/매출) 카드 형태
- **테이블 2개**:
  - **(A) 소스별**: sessionSourceMedium / 세션 / 사용자 / 구매 / 매출
  - **(B) 랜딩페이지별**: landingPagePlusQueryString / 세션 / 사용자 / 구매 / [진단 →]
- **랜딩페이지 row 클릭 → 페이지 진단(Tab 6)으로 이동**:
  - "진단 →" 버튼 클릭 시 `setDiagUrl(fullUrl)` + `setActiveTab(6)` 실행
  - 상대 경로(`/report`)는 자동으로 `https://biocom.kr/report`로 변환
- **AI 유입 정의**: 섹션 상단에 정의 + 측정 대상 패턴 목록 표시

### [3] "AI 유입 주제(근사)" UI ✅ (옵션)

- **위치**: 랜딩페이지 테이블에서 row 클릭 시 하단에 펼침
- **내용**: "이 페이지의 GSC 상위 검색 주제 (근사치)"
  - "GSC 쿼리 조회" 버튼 클릭 → `/api/ai-traffic/topics` 호출
  - 쿼리 + 클릭수 + 노출수 표시
- **표기**: "AI 유입이 많이 landing된 페이지의 검색 주제(근사)" — 프롬프트가 아님을 명시

### [4] UX ✅

- **로딩 상태**: Skeleton UI (shimmer 애니메이션) 구현
  - 오버뷰 카드: 4개 skeleton 블록
  - 사용자 행동 탭: 2개 테이블 skeleton 블록
- **0 데이터**: 빈 화면 대신 안내 표시
  - 아이콘 + "최근 기간에 AI referral 유입이 0으로 측정됨"
  - AI 유입 정의 + 측정 기준 설명 포함
- **라이브 상태 표시**: LiveBadge / LoadingBadge / NoDataBadge 기존 패턴 활용

---

## 2) 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `frontend/src/app/page.tsx` | AI Traffic 타입 정의, 상태 변수 11개, loadAiTraffic 함수, 초기 로드 연결, 오버뷰 AI 유입 카드, 사용자 행동 AI 유입 섹션(소스별/랜딩페이지별 테이블), aiTrafficComputedTotals fallback 로직 |
| `frontend/src/app/page.module.css` | AI Traffic 관련 CSS 클래스 ~50개 (overkill 없이 기존 디자인 시스템과 일관된 글래스모피즘 스타일) |

---

## 3) 기술 구현 상세

### 3-1. 타입 정의 (page.tsx)

```typescript
type AiTrafficTotals = {
  sessions: number; activeUsers: number; totalUsers: number;
  ecommercePurchases: number; grossPurchaseRevenue: number;
};
type AiTrafficBySourceRow = {
  sessionSource: string; sessionSourceMedium: string;
  sessions: number; activeUsers: number;
  ecommercePurchases: number; grossPurchaseRevenue: number;
};
type AiTrafficByLandingPageRow = {
  landingPagePlusQueryString: string;
  sessions: number; activeUsers: number;
  ecommercePurchases: number; grossPurchaseRevenue: number;
};
type AiTrafficReport = {
  range: { startDate: string; endDate: string };
  definition: string;
  totals: AiTrafficTotals;
  bySource: AiTrafficBySourceRow[];
  byLandingPage: AiTrafficByLandingPageRow[];
  debug: { matchedPatterns: string[]; notes: string[] };
};
```

### 3-2. 상태 변수 (11개)

- `aiTrafficData`: API 응답 전체
- `aiTrafficLoading`: 로딩 상태
- `aiTrafficDateRange`: 표시용 날짜 범위
- `aiTrafficRangePreset`: 기간 프리셋 (7d/30d/90d/custom)
- `aiTrafficDatePickerOpen`: 커스텀 날짜 선택 UI 열림 여부
- `aiTrafficStartInput` / `aiTrafficEndInput`: 커스텀 날짜 입력
- `aiTrafficExpandedLanding`: 랜딩페이지 펼침 상태
- `aiTrafficTopics`: GSC 쿼리 캐시 (페이지별)
- `aiTrafficTopicsLoading`: GSC 쿼리 로딩 상태

### 3-3. 데이터 로드 (loadAiTraffic)

- `useCallback` 기반, `AbortSignal` 지원
- `/api/ga4/ai-traffic` 호출, 기간 파라미터 동적 구성
- 초기 로드: `useEffect`에서 `loadAiTraffic({ days: 30, signal })` 호출

### 3-4. totals fallback 로직

```typescript
const aiTrafficComputedTotals = useMemo(() => {
  if (!aiTrafficData) return { sessions: 0, activeUsers: 0, ... };
  const t = aiTrafficData.totals;
  if (t.sessions > 0) return t;
  // totals가 0이면 bySource에서 합산
  return aiTrafficData.bySource.reduce(...)
}, [aiTrafficData]);
```

- GA4 Data API에서 dimensions 없이 totals 요청 시 0이 반환되는 경우가 있어, bySource 합산을 fallback으로 사용

---

## 4) 검증

- `npx tsc --noEmit` ✅ 통과 (타입 에러 0)
- `npm --prefix frontend run build` ✅ 통과
- 프론트엔드 서버 실행 중 (포트 7010) ✅
- 백엔드 서버 실행 중 (포트 7020) ✅
- `/api/ga4/ai-traffic` API 실데이터 확인 완료:
  - chatgpt.com: 167+19 세션
  - gemini.google.com: 13 세션
  - perplexity.ai: 2 세션
  - 총 매출: ₩32,980 (chatgpt.com 유입)

---

## 5) DoD(완료 기준) 체크

| DoD 항목 | 상태 |
|----------|------|
| 오버뷰에서 AI 유입 KPI가 한눈에 보임 | ✅ |
| 사용자 행동 탭에서 소스/랜딩 2개 테이블이 보임 | ✅ |
| 랜딩 클릭 → 페이지 진단으로 자연스럽게 이어짐 | ✅ |
| "AI 유입 정의"를 사용자 혼동 없이 명확히 보여줌 | ✅ |
| 로딩 0.5초 이상 시 skeleton | ✅ |
| 0 데이터 시 빈 화면 금지 + 안내 | ✅ |

---

## 6) 접속/테스트 방법

1. **프론트엔드**: http://localhost:7010
2. **백엔드 API**: http://localhost:7020
3. **오버뷰 탭**: 대시보드 첫 화면(Tab 0) → KPI 카드 아래 "AI 유입 (Referral)" 카드 확인
4. **사용자 행동 탭**: Tab 5 "사용자 행동" → 스크롤하면 "AI 유입 트래픽" 섹션
5. **기간 변경**: 7일/30일/90일 버튼 또는 📅 커스텀 기간 선택
6. **랜딩페이지 → 진단**: 랜딩페이지 테이블에서 "진단 →" 버튼 클릭 → Tab 6으로 이동 + URL 자동 입력
7. **GSC 쿼리 보기**: 랜딩페이지 row 클릭 → 펼침 → "GSC 쿼리 조회" 클릭

---

## 7) 다음 개발 계획

1. **실 브라우저 테스트** — Playwright 스크립트로 콘솔 에러/네트워크 에러 자동 검증
2. **데이터 새로고침 UX** — "캐시된 결과일 수 있음(업데이트 시간 표시)" 문구 추가
3. **allowlist 튜닝** — 운영 데이터 기반으로 AI 유입 소스 패턴 최적화
4. **보안** — URL fetch SSRF 가드 설계/반영 (report0222feedback-1result.md에서 이관)
