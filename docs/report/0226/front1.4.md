# [Claude Code] Tab 0 하드코딩 Fallback 데이터 제거

## 목적
Tab 0에 가짜 샘플 데이터를 표시하지 않도록 한다.
API 실패 시 가짜 데이터 대신 명시적 상태 메시지를 보여준다.

## 제거 대상

### 1. AI_INSIGHTS 상수 (page.tsx:231 부근)
현재: API 실패 시 이 샘플 데이터를 화면에 표시
```typescript
const AI_INSIGHTS = [
  { priority: "urgent", text: "건강기능식품 순위 5→12위 하락..." },
  { priority: "opportunity", text: "FAQ 스키마 추가 시 CTR 15% 향상..." },
  ...
];
```

변경:
- AI_INSIGHTS 상수를 **빈 배열**로 변경하거나 완전히 제거해라.
- aiInsights state의 초기값을 빈 배열로 설정.
- API 호출 성공 시에만 인사이트를 표시.
- API 실패/미설정 시 아래 UI를 표시:

```
┌─────────────────────────────────────────────────┐
│ 🤖 AI 에이전트 활동 상태                         │
│                                                 │
│ ⚠️ AI 분석이 아직 실행되지 않았습니다.            │
│                                                 │
│ AI 분석을 실행하려면 OpenAI API 키 설정 후        │
│ [다시 분석] 버튼을 클릭하세요.                    │
│                                                 │
│                    [다시 분석]                    │
└─────────────────────────────────────────────────┘
```

- "다시 분석" 버튼은 기존 loadAiInsights 함수를 호출
- API 호출 중에는 스켈레톤 로딩 표시
- API 에러 시: "AI 분석 중 오류가 발생했습니다. [다시 시도]"

### 2. INTENT_CATEGORIES 상수 (page.tsx:239 부근)
현재: intentData가 없으면 이 샘플 비율(45/30/15/10)을 표시
```typescript
const INTENT_CATEGORIES = [
  { label: "정보성", value: 45 },
  { label: "상업성", value: 30 },
  ...
];
```

변경:
- INTENT_CATEGORIES 상수를 **빈 배열**로 변경하거나 완전히 제거해라.
- intentData state의 초기값을 null로 설정.
- API 호출 성공 시에만 인텐트 차트를 표시.
- API 실패/미설정 시 아래 UI를 표시:

```
┌─────────────────────────────────────────────────┐
│ 📊 키워드 인텐트 분석                            │
│                                                 │
│ ⚠️ 키워드 인텐트 데이터를 불러올 수 없습니다.     │
│                                                 │
│ GSC(Google Search Console) 연동 상태를           │
│ 확인해주세요.                                    │
│                                                 │
│                   [새로고침]                     │
└─────────────────────────────────────────────────┘
```

- "새로고침" 버튼 클릭 시 `/api/keywords/intent` 재호출
- API 호출 중에는 스켈레톤 로딩 표시

## 유지 대상 (건드리지 않음)

### aiOptimizationTasks (체크리스트 9개 항목)
이건 Fallback이 아니라 "어떤 항목을 체크할지"의 정의이고,
done 판정은 실 데이터 기반이므로 유지한다.

## 상태 관리 패턴

각 섹션에 3가지 상태를 명확히 구분해라:

```typescript
type SectionState = "loading" | "ready" | "error" | "empty";

// AI 인사이트
const [insightsState, setInsightsState] = useState<SectionState>("loading");
// "loading": 스켈레톤
// "ready": 인사이트 카드 표시
// "error": "AI 분석이 아직 실행되지 않았습니다" + 다시 분석 버튼
// "empty": API 성공했지만 결과가 빈 배열

// 키워드 인텐트
const [intentState, setIntentState] = useState<SectionState>("loading");
// 동일 패턴
```

## 스타일

에러/빈 상태 UI는 기존 글래스모피즘 카드 안에 표시.
아이콘 + 메시지 + 액션 버튼의 세로 중앙 정렬.
기존 대시보드 디자인과 일관성 유지.

## 완료 확인
- [ ] AI_INSIGHTS 하드코딩 샘플이 더 이상 화면에 표시되지 않는지
- [ ] INTENT_CATEGORIES 하드코딩 샘플이 더 이상 화면에 표시되지 않는지
- [ ] API 성공 시 실 데이터가 정상 표시되는지
- [ ] API 실패 시 명시적 에러 메시지가 표시되는지
- [ ] "다시 분석" / "새로고침" 버튼이 동작하는지
- [ ] 스켈레톤 로딩이 표시되는지
- [ ] 체크리스트(aiOptimizationTasks)는 변경되지 않았는지
- [ ] 빌드 에러 없는지