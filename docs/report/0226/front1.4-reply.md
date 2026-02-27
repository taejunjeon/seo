# feedback0226front1.4reply — Tab 0 하드코딩 Fallback 데이터 제거 결과

작성일: 2026-02-26
작성: 헤파이스토스(코딩 에이전트)
요청 문서: `feedback0226front1.4.md`

---

## 0) 결론 요약

- `feedback0226front1.4.md`의 모든 요구사항을 반영 완료
- **AI_INSIGHTS** 하드코딩 상수 제거 → API 성공 시에만 표시
- **INTENT_CATEGORIES** 하드코딩 상수 제거 → API 성공 시에만 표시
- 각 섹션에 4상태 패턴 적용: `loading` / `ready` / `error` / `empty`
- **aiOptimizationTasks** (체크리스트 9개) — 변경 없음
- 빌드 에러 없음, JS 에러 0개

---

## 1) AI_INSIGHTS 상수 제거

### before
```typescript
const AI_INSIGHTS: AiInsight[] = [
  { priority: "urgent", tag: "키워드", text: "\"건강기능식품\" 순위 5→12위 하락..." },
  { priority: "opportunity", tag: "스키마", text: "FAQ 스키마 추가 시 CTR 15% 향상..." },
  { priority: "trend", tag: "기기", text: "모바일 검색 비율 68%, 전월대비 12% 증가" },
  { priority: "recommend", tag: "콘텐츠", text: "\"프로바이오틱스 효능\" 콘텐츠 보강..." },
];
// 사용: (aiInsights ?? AI_INSIGHTS).map(...)
```

### after
```typescript
/* AI_INSIGHTS 하드코딩 상수 제거됨 — API 성공 시에만 표시 */
// 사용: (aiInsights ?? []).map(...)
```

### 상태별 UI

| 상태 | 조건 | 표시 |
|------|------|------|
| **loading** | API 호출 중 | 스켈레톤 shimmer 3줄 |
| **ready** | API 성공 + 인사이트 1개 이상 | 인사이트 카드 목록 (실 데이터) |
| **error** | API 실패 / 미설정 | "AI 분석이 아직 실행되지 않았습니다" + "다시 분석" 버튼 |
| **empty** | API 성공 + 결과 빈 배열 | "AI 분석 결과가 비어 있습니다" + "다시 분석" 버튼 |

### "다시 분석" 버튼
- `/api/ai/insights` 재호출
- 호출 중에는 disabled + 스켈레톤 표시
- 에러 시 다시 error 상태로 복귀

---

## 2) INTENT_CATEGORIES 상수 제거

### before
```typescript
const INTENT_CATEGORIES = [
  { label: "정보성", type: "informational", percent: 45, ... },
  { label: "상업성", type: "commercial", percent: 30, ... },
  { label: "탐색성", type: "navigational", percent: 15, ... },
  { label: "브랜드", type: "brand", percent: 10, ... },
];
// 사용: (intentData?.categories ?? INTENT_CATEGORIES).map(...)
```

### after
```typescript
/* INTENT_CATEGORIES 하드코딩 상수 제거됨 — API 성공 시에만 표시 */
// 사용: (intentData?.categories ?? []).map(...)  (ready 상태에서만)
```

### 상태별 UI

| 상태 | 조건 | 표시 |
|------|------|------|
| **loading** | API 호출 중 | 스켈레톤 shimmer 3줄 |
| **ready** | API 성공 + 카테고리 1개 이상 | 인텐트 바 차트 + 상세 (실 데이터) |
| **error** | API 실패 | "키워드 인텐트 데이터를 불러올 수 없습니다" + "새로고침" 버튼 |
| **empty** | API 성공 + 빈 결과 | 동일 에러 메시지 + "새로고침" 버튼 |

### "새로고침" 버튼
- `/api/keywords/intent` 재호출
- 호출 중에는 loading 상태로 전환
- 성공 시 인텐트 차트 표시, 실패 시 error 복귀

---

## 3) 상태 관리 패턴

```typescript
// AI 인사이트
const [insightsState, setInsightsState] = useState<"loading" | "ready" | "error" | "empty">("loading");

// 키워드 인텐트
const [intentState, setIntentState] = useState<"loading" | "ready" | "error" | "empty">("loading");
```

초기 로드 + 수동 새로고침 모두 동일 패턴:
1. state → "loading"
2. fetch 성공 + 데이터 있음 → "ready"
3. fetch 성공 + 데이터 없음 → "empty"
4. fetch 실패 → "error"

---

## 4) 유지 대상 확인

### aiOptimizationTasks (체크리스트 9개)
- **변경 없음** ✅
- 여전히 실 데이터 기반 done 판정 유지
- Playwright 검증: "AI 최적화 작업" 타이틀 정상 표시

---

## 5) 변경된 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `frontend/src/app/page.tsx` | AI_INSIGHTS/INTENT_CATEGORIES 상수 제거, insightsState/intentState 추가, 섹션별 4상태 분기, 버튼 핸들러에 state 갱신 |
| `frontend/src/app/page.module.css` | sectionPlaceholder* 스타일 추가 (아이콘, 텍스트, 힌트, 버튼, 스켈레톤) |

---

## 6) 검증 결과

### 빌드
```
✓ Compiled successfully in 1132.9ms
✓ Generating static pages (4/4) in 192.5ms
```

### Playwright (7초 후)

| 항목 | 결과 |
|------|------|
| Tab 0 로드 | ✅ YES |
| AI_INSIGHTS 하드코딩 샘플 미표시 | ✅ YES (제거됨) |
| INTENT_CATEGORIES 하드코딩 샘플 미표시 | ✅ YES (제거됨) |
| AI 에이전트 활동 상태 타이틀 | ✅ YES |
| AI 인사이트 상태 (7초) | loading (스켈레톤) — API 호출 진행 중 |
| 키워드 인텐트 상태 (15초) | ✅ ready (실 데이터) |
| AI 최적화 작업 체크리스트 | ✅ YES (변경 없음) |
| AEO/GEO 점수 카드 | ✅ YES |
| AI 유입 (Referral) 카드 | ✅ YES |
| 총 클릭수 KPI | ✅ YES |
| Tab 5 - AI 유입 트래픽 | ✅ YES |
| **JS 에러** | **0개** ✅ |
| **콘솔 에러** | **0개** ✅ |

### Playwright (35초 후 — AI API 응답 완료)

| 항목 | 결과 |
|------|------|
| AI 인사이트 최종 상태 | ✅ ready (실 데이터 표시) |
| 하드코딩이 아닌 실데이터 확인 | ✅ YES (구 "5→12위" 텍스트 없음) |
| 키워드 인텐트 최종 상태 | ✅ ready (실 데이터) |

### 서버
- 프론트엔드: http://localhost:7010 ✅
- 백엔드: http://localhost:7020 ✅
- AI Insights API 응답 시간: ~20-30초 (OpenAI API 호출 포함)

---

## 7) 완료 체크리스트

- [x] AI_INSIGHTS 하드코딩 샘플이 더 이상 화면에 표시되지 않는지
- [x] INTENT_CATEGORIES 하드코딩 샘플이 더 이상 화면에 표시되지 않는지
- [x] API 성공 시 실 데이터가 정상 표시되는지
- [x] API 실패 시 명시적 에러 메시지가 표시되는지
- [x] "다시 분석" / "새로고침" 버튼이 동작하는지
- [x] 스켈레톤 로딩이 표시되는지
- [x] 체크리스트(aiOptimizationTasks)는 변경되지 않았는지
- [x] 빌드 에러 없는지

---

## 8) 미해결 이슈

1. **AI Insights API 응답 시간**: OpenAI API 호출로 ~20-30초 소요. 이 동안 스켈레톤이 표시되므로 UX 문제는 없으나, 캐싱이나 사전 생성으로 개선 가능.
2. **page.module.css 미사용 AI Traffic 스타일**: `aiTrafficOverview*`, `aiTrafficKpiGrid*`, `aiTrafficSkeleton*` 등 이전 Step에서 남겨둔 구 CSS가 여전히 존재. 기능에는 영향 없음.
