# feedback0226front1.3reply — Tab 0 AI 유입 카드 개선 결과

작성일: 2026-02-26
작성: 헤파이스토스(코딩 에이전트)
요청 문서: `feedback0226front1.3.md`

---

## 0) 결론 요약

- 요구사항 2건 모두 반영 완료
- **변경 1**: "→ 상세 분석" 링크를 헤더 우측("최근 30일" 옆)으로 이동, 하단 링크 제거
- **변경 2**: 전기간(이전 30일) 비교 API 호출 + 변화량 표시 구현 (비동기 2차 호출로 Tab 0 로딩 속도 미영향)
- 빌드 에러 없음, JS 에러 0개, Playwright 13항목 전체 통과

---

## 1) 변경 1: "→ 상세 분석" 링크 위치 개선

### before
```
┌────────────────────────────────────────────┐
│ AI AI 유입 (Referral) ● 실시간  최근 30일   │
│ ┌─────────┐ ┌────────────┐                 │
│ │   215   │ │    25      │                 │
│ │ AI세션  │ │ AI활성사용자│                 │
│ └─────────┘ └────────────┘                 │
│ 상위 소스: chatgpt.com ...                  │
│ AI 유입 = ChatGPT, Perplexity ...           │
│ [ 자세히 보기 → ]    ← 하단에 위치           │
└────────────────────────────────────────────┘
```

### after
```
┌────────────────────────────────────────────┐
│ AI AI 유입 (Referral) ● 실시간              │
│                        최근 30일  [→ 상세 분석] │  ← 헤더 우측
│ ┌─────────┐ ┌────────────┐                 │
│ │   215   │ │    25      │                 │
│ │ AI세션  │ │ AI활성사용자│                 │
│ └─────────┘ └────────────┘                 │
│ 상위 소스: chatgpt.com ...                  │
│ AI 유입 = ChatGPT, Perplexity ...           │
└────────────────────────────────────────────┘
```

### CSS 변경
- `.summaryHeaderRight`: `display: flex; align-items: center; gap: 10px;` — "최근 30일" + "→ 상세 분석" 가로 배치
- `.summaryDetailLink`: `margin-top: 12px` 제거, `padding` 축소 (헤더에 맞게 컴팩트하게)

---

## 2) 변경 2: 전기간 대비 변화량 표시

### 구현 방식 — 비동기 2차 호출

Tab 0 로딩 속도를 보호하기 위해 2단계 로딩 방식 적용:

1. **Phase 1 (즉시)**: 최근 30일 API 호출 → `setLoading(false)` → KPI 숫자 즉시 표시
2. **Phase 2 (백그라운드)**: 이전 30일 API 호출 → 완료 시 변화량이 KPI 옆에 나타남

```typescript
// Phase 1 완료 후 setLoading(false) 호출
// Phase 2는 그 이후 비동기 실행 (UI 차단 없음)
const prevRes = await fetch(`${API_BASE}/api/ga4/ai-traffic?${prevQs}`, { signal, cache: "no-store" });
if (prevRes.ok) {
  const prevJson = await prevRes.json();
  setPrevData(prevJson);  // → 변화량 UI 업데이트
}
```

### 변화량 계산

```typescript
function calcChange(curr: number, prev: number): number | null {
  if (prev === 0) return curr > 0 ? 100 : null;
  return ((curr - prev) / prev) * 100;
}
```

### 표시 형식

| 변화 | 표시 | 색상 |
|------|------|------|
| 증가 | +12% ▲ | 초록 (#10b981) |
| 감소 | -5% ▼ | 빨강 (#ef4444) |
| 이전 데이터 없음 | (표시 안 함) | - |
| 이전 0 → 현재 양수 | +100% ▲ | 초록 |

### 성능 영향
- Phase 1(현재 30일)은 기존과 동일 — **Tab 0 초기 로딩 속도 변화 없음**
- Phase 2(이전 30일)은 Phase 1 완료 후 백그라운드 호출 — UI 차단 없음
- 이전 기간 호출 실패 시 변화량만 생략, 에러 무시

---

## 3) 변경된 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `frontend/src/components/ai-traffic/AiTrafficSummaryCard.tsx` | 링크 위치 이동, prevData state + 2차 API 호출, ChangeIndicator 컴포넌트 |
| `frontend/src/components/ai-traffic/AiTraffic.module.css` | summaryHeaderRight, changeUp, changeDown 스타일 추가, summaryDetailLink margin 조정 |

---

## 4) 검증 결과

### 빌드
```
✓ Compiled successfully in 1002.2ms
✓ Generating static pages (4/4) in 171.7ms
```

### Playwright

| 항목 | 결과 |
|------|------|
| Tab 0 로드 | ✅ YES |
| AI 유입 (Referral) 타이틀 | ✅ YES |
| 헤더 "→ 상세 분석" 링크 | ✅ YES |
| 하단 "자세히 보기" 제거됨 | ✅ YES |
| 최근 30일 + 상세 분석 공존 | ✅ YES |
| 뱃지 표시 (실시간) | ✅ YES |
| AI 유입 세션 | ✅ YES |
| AI 활성 사용자 | ✅ YES |
| 변화량 표시 (▲/▼) | ✅ YES |
| 상위 소스 | ✅ YES |
| 상세 분석 클릭 → Tab 5 이동 | ✅ YES |
| 기존 KPI (총 클릭수) 존재 | ✅ YES |
| AEO/GEO 점수 카드 존재 | ✅ YES |
| **JS 에러** | **0개** ✅ |
| **콘솔 에러** | **0개** ✅ |

### 서버
- 프론트엔드: http://localhost:7010 ✅
- 백엔드: http://localhost:7020 ✅

---

## 5) 완료 체크리스트

- [x] "→ 상세 분석" 링크가 헤더 우측에 있는지
- [x] 클릭 시 Tab 5로 이동하는지
- [x] 기존 카드 레이아웃에 영향 없는지
- [x] 전기간 대비 변화량 표시 (비동기, Tab 0 로딩 미영향)
