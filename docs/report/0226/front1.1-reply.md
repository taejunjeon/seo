# feedback0226front1.1reply — AI Traffic API 연동 + AEO/GEO 펼치기 수정 결과

작성일: 2026-02-26
작성: 헤파이스토스(코딩 에이전트)
요청 문서: `feedback0226front1.1.md`

---

## 0) 결론 요약

- `feedback0226front1.1.md`의 모든 요구사항을 반영 완료
- **AEO/GEO 펼치기 연동**: `isAeoOpen` + `isGeoOpen` → `scoreDetailOpen` 단일 state로 통합
- **AI Traffic API 연동**: 더미 데이터 → 실제 `/api/ga4/ai-traffic` + `/api/ga4/ai-traffic/user-type` 호출
- 빌드 에러 없음, JS 에러 0개, Playwright 전체 통과

---

## 1) 선행 수정: AEO/GEO Score 상세 펼치기 연동

### 변경 파일: `frontend/src/app/page.tsx`

**before:**
```typescript
const [isAeoOpen, setIsAeoOpen] = useState(false);   // line 764
const [isGeoOpen, setIsGeoOpen] = useState(false);    // line 765
// ...
{ result: aeoScore, isOpen: isAeoOpen, toggle: () => setIsAeoOpen((v) => !v) },
{ result: geoScore, isOpen: isGeoOpen, toggle: () => setIsGeoOpen((v) => !v) },
```

**after:**
```typescript
const [scoreDetailOpen, setScoreDetailOpen] = useState(false);
// ...
{ result: aeoScore, isOpen: scoreDetailOpen, toggle: () => setScoreDetailOpen((v) => !v) },
{ result: geoScore, isOpen: scoreDetailOpen, toggle: () => setScoreDetailOpen((v) => !v) },
```

### 동작 확인 (Playwright)

| 테스트 | 결과 |
|--------|------|
| AEO 버튼 클릭 → AEO, GEO 둘 다 펼쳐짐 | ✅ YES (열린 수: 2) |
| 다시 클릭 → 둘 다 닫힘 | ✅ YES (열린 수: 0) |

---

## 2) AI Traffic API 연동

### 2-1. 타입 추가 (`types.ts`)

신규 타입:

```typescript
/** API _meta 공통 (notice 필드 추가) */
type AiTrafficMeta = {
  type: "live" | "fallback";
  propertyId?: string;
  queriedAt: string;
  period: { startDate: string; endDate: string };
  notice?: string;   // ← 추가
};

/** /api/ga4/ai-traffic/user-type 응답 */
type AiTrafficUserTypeReport = {
  _meta: AiTrafficMeta;
  period: { startDate: string; endDate: string };
  summary: {
    new: AiTrafficUserTypeSummaryRow;
    returning: AiTrafficUserTypeSummaryRow;
  };
  bySourceAndType: AiTrafficUserTypeBySource[];
};
```

### 2-2. `AiTrafficDashboard.tsx` — API 연동

**주요 변경:**

| 항목 | before | after |
|------|--------|-------|
| 데이터 소스 | `DUMMY_AI_TRAFFIC` 고정 | 실제 API `fetch()` |
| loading | `false` 고정 | `useState(true)` → API 완료 시 false |
| 기간 선택 | `// TODO: API 호출` | `handlePreset()` → `loadData()` |
| _meta 뱃지 | 단순 더미/실시간 | `"live"` → 초록 "실시간 데이터" / `"fallback"` → 주황 "GA4 미연결" |
| _meta.notice | 미표시 | 뱃지 옆에 주황색 텍스트 표시 |
| 에러 상태 | 없음 | "데이터를 불러올 수 없습니다" + 재시도 버튼 |
| 빈 데이터 | "AI referral 유입 0" | "해당 기간에 AI 유입 데이터가 없습니다" |

**API 호출 구조:**
```typescript
const loadData = useCallback(async (startDate: string, endDate: string) => {
  const [trafficRes, userTypeRes] = await Promise.all([
    fetch(`${API_BASE}/api/ga4/ai-traffic?startDate=${startDate}&endDate=${endDate}`),
    fetch(`${API_BASE}/api/ga4/ai-traffic/user-type?startDate=${startDate}&endDate=${endDate}`),
  ]);
  // ...
}, []);
```

- 기간 변경 시 두 API 동시 호출 (`Promise.all`)
- 날짜 형식: YYYY-MM-DD (user-type API 요구사항 충족)
- `NEXT_PUBLIC_API_BASE_URL` 환경변수 사용

### 2-3. 수치 포맷팅

기존 `AiTrafficKpi.tsx`의 `pct()`, `dur()`, `fmt()` 함수를 그대로 사용:

| 지표 | API 값 예시 | 표시 형식 | 확인 |
|------|-----------|----------|------|
| bounceRate | 0.0837 | "8.4%" | ✅ |
| engagementRate | 0.9163 | "91.6%" | ✅ |
| averageSessionDuration | 1007.5 | "16분 48초" | ✅ |
| grossPurchaseRevenue | 32980 | "₩32,980" | ✅ |

### 2-4. _meta 뱃지

| `_meta.type` | 뱃지 | 스타일 |
|-------------|------|--------|
| `"live"` | ● 실시간 데이터 | 초록 (rgba(16,185,129,0.1)) |
| `"fallback"` | ● GA4 미연결 | 주황 (rgba(245,158,11,0.1)) |
| (로딩 중) | ● 로딩... | 보라 (rgba(99,102,241,0.1)) |

`_meta.notice`가 있으면 뱃지 옆에 주황색 텍스트로 표시.

### 2-5. 소스 테이블 — 카테고리 뱃지 + 필터

**`AiTrafficBySourceTable.tsx` 변경:**

- category별 뱃지 추가:
  - `ai_referral` → 파란색 "AI" 뱃지
  - `search_legacy` → 회색 "검색" 뱃지
  - `organic` → 회색 "기타" 뱃지
- 필터 토글 버튼: "전체" ↔ "AI 유입만" (ai_referral만 표시)

### 2-6. 신규 vs 재방문

**`AiTrafficUserType.tsx` 변경:**

- 새 prop: `userTypeSummary?: { new: ...; returning: ... }`
- user-type API 데이터가 있으면 우선 사용, 없으면 totals에서 추정
- `summary.new.sessions + summary.returning.sessions < totals.sessions` → "일부 미분류 데이터 있음" 안내 표시

### 2-7. 로딩/에러/빈 상태

| 상태 | 표시 |
|------|------|
| 로딩 | 스켈레톤 (shimmer 4개 + 테이블 2개) |
| 에러 (데이터 없음) | ⚠️ 에러 메시지 + "재시도" 버튼 |
| 빈 (sessions=0) | 🤖 "해당 기간에 AI 유입 데이터가 없습니다" |

---

## 3) page.tsx 잔여 AI Traffic 코드

피드백 지시에 따라 **건드리지 않음**:

| 위치 | 내용 | 상태 |
|------|------|------|
| 223~256행 | 구 타입 정의 | 유지 (Tab 0 참조) |
| 712~722행 | state 변수들 | 유지 (Tab 0 참조) |
| 1091~1127행 | loadAiTraffic 함수 | 유지 (Tab 0 참조) |
| 1384~1385행 | 초기 로드 | 유지 (Tab 0 참조) |
| ~2551~2598행 | Tab 0 요약 카드 | 유지 (Step 6 범위) |

→ Step 6에서 Tab 0 요약 카드 교체 시 함께 정리 예정.

---

## 4) 변경된 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `frontend/src/app/page.tsx` | `isAeoOpen`+`isGeoOpen` → `scoreDetailOpen` 통합 |
| `frontend/src/components/ai-traffic/types.ts` | `AiTrafficMeta`, `AiTrafficUserTypeReport`, `AiTrafficUserTypeSummaryRow`, `AiTrafficUserTypeBySource` 추가 |
| `frontend/src/components/ai-traffic/index.ts` | 새 타입 export 추가 |
| `frontend/src/components/ai-traffic/AiTrafficDashboard.tsx` | 더미→API fetch, 기간 선택, _meta 뱃지, 에러 상태 |
| `frontend/src/components/ai-traffic/AiTrafficUserType.tsx` | userTypeSummary prop 추가, 미분류 안내 |
| `frontend/src/components/ai-traffic/AiTrafficBySourceTable.tsx` | 카테고리 뱃지, "전체"/"AI 유입만" 필터 토글 |
| `frontend/src/components/ai-traffic/AiTraffic.module.css` | 카테고리 뱃지, 필터 토글, 미분류 안내, 에러/재시도 스타일 |

---

## 5) 검증 결과

### 5-1. 빌드

```
npm --prefix frontend run build
✓ Compiled successfully in 963.5ms
✓ Generating static pages (4/4) in 161.3ms
```

TypeScript 에러 없음, 빌드 정상 통과.

### 5-2. Playwright 렌더링 검증

| 항목 | 결과 |
|------|------|
| Tab 0 로드 | ✅ YES |
| AEO 클릭→양쪽 펼침 | ✅ YES (열린 수: 2) |
| 닫기→양쪽 닫힘 | ✅ YES (열린 수: 0) |
| Tab 5 - AI 유입 타이틀 | ✅ YES |
| Tab 5 - 뱃지 표시 (실시간) | ✅ YES |
| Tab 5 - 세션 KPI | ✅ YES |
| Tab 5 - 참여율 % 표시 | ✅ YES |
| Tab 5 - 체류시간 분 초 표시 | ✅ YES |
| Tab 5 - 매출 ₩ 표시 | ✅ YES |
| Tab 5 - 신규 vs 재방문 | ✅ YES |
| Tab 5 - 소스별 테이블 | ✅ YES |
| Tab 5 - 랜딩페이지별 테이블 | ✅ YES |
| Tab 5 - chatgpt.com 실데이터 | ✅ YES |
| Tab 5 - 필터 토글 | ✅ YES |
| Tab 5 - 기간 7일 버튼 | ✅ YES |
| Tab 5 - 7일 기간 변경 | ✅ YES |
| Tab 1 - 칼럼 분석 (영향 없음) | ✅ YES |
| **JS 에러** | **0개** ✅ |
| **콘솔 에러** | **0개** ✅ |

### 5-3. 서버 상태

- 프론트엔드: http://localhost:7010 ✅ 정상
- 백엔드 API: http://localhost:7020 ✅ 정상

---

## 6) 완료 체크리스트

- [x] AEO/GEO 펼치기가 연동되는지 (한쪽 누르면 양쪽 열림/닫힘)
- [x] bounceRate가 "%"로 표시되는지
- [x] 체류시간이 "분 초"로 표시되는지
- [x] 매출이 "₩" 붙어서 표시되는지
- [x] _meta.type에 따라 뱃지 표시 (실시간/GA4 미연결/로딩)
- [x] _meta.notice가 있으면 표시
- [x] 기간 변경 시 데이터 갱신 (7일/30일/90일/커스텀)
- [x] 카테고리 배지 표시 (AI/검색/기타)
- [x] 소스 필터 토글 (전체/AI 유입만)
- [x] 신규 vs 재방문 user-type API 연동
- [x] 미분류 데이터 안내
- [x] 에러 상태 + 재시도 버튼
- [x] 빈 데이터 상태 안내
