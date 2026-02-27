# Claude Code 프론트엔드 프롬프트 (v3 FINAL)
## Biocom AI Agent Dashboard - Frontend

작성일: 2026-02-26 (v3 — 최종 확정)
대상: Claude Code (프론트엔드 전용)
코드 경로: `/Users/vibetj/coding/seo/frontend/src/`
핵심 파일: `app/page.tsx` (4,371줄), `app/page.module.css`, `components/` 하위

---

## 확정된 기술 환경 (Codex B0 검증 완료)

| 항목 | 확정값 | 비고 |
|------|--------|------|
| Next.js | 16.1.6 | package.json 확인 |
| React | 19.2.3 | package.json 확인 |
| 스타일 시스템 | **CSS Module** (page.module.css) | Tailwind 미설치, 설치하지 않음 |
| 차트 라이브러리 | **Recharts** (F1 첫 단계에서 설치) | 현재 미설치, `npm install recharts` 실행 필요 |
| TypeScript | 5.9.3 | strict 모드 |
| Tailwind | 미설치 | 설치하지 않음. CSS Module로 통일 |
| shadcn/ui | 미설치 | 설치하지 않음 |

## 확정된 백엔드 API (Codex B1-B6 완료)

| API | 상태 | F 프롬프트 연관 |
|-----|------|----------------|
| `GET /api/ai/insights` | `_meta.source(cache/live)` + `expiresAt` + `ttl` 포함 | F4 |
| `POST /api/ai/insights/refresh` | 신규 | F4 |
| `GET /api/keywords/intent?weight=clicks/impressions/count` | 확장 완료 | F5 |
| `GET /api/trends?metric=&period=&compare=` | 신규 | F1 |
| `GET /api/comparison?dimension=&period=&sortBy=` | 신규 | F1, F6 |
| `GET /api/ga4/funnel?type=test/supplement&period=` | 확장 완료 | 향후 |
| `GET /api/ga4/top-sources` | `matched` + `label` 필드 추가 | F2 |
| `GET /api/ga4/ai-traffic` | 기존 유지 | F2 |

## 확정된 캐시/메타 구조

모든 API 응답에 `_meta` 필드가 포함될 수 있음:
```json
{
  "_meta": {
    "source": "cache" | "live",
    "generatedAt": "ISO-8601",
    "expiresAt": "ISO-8601",
    "ttl": 21600
  }
}
```

## Mock 데이터 주의사항

Codex B0 확인: 프론트에 칼럼/키워드/CWV/행동 탭 mock 데이터가 다수 잔존.
각 프롬프트에서 해당 탭 작업 시 반드시 데이터 소스(mock vs API)를 먼저 확인하고,
mock이면 TODO 주석을 남기되 UI 작업은 진행한다 (API 연동은 별도 작업).

---

## 공통 규칙 (모든 프롬프트에 적용)

1. **스타일**: CSS Module만 사용. `page.module.css`에 클래스 추가. Tailwind 유틸리티 클래스 사용 금지.
2. **차트**: Recharts 사용 (F1에서 설치). `import { AreaChart, ... } from 'recharts'`
3. **빌드**: 매 프롬프트 완료 후 `npm run build` 에러 0 확인.
4. **TypeScript**: `any` 타입 금지. 모든 API 응답에 interface 정의.
5. **4-state 패턴**: loading / ready / error / empty. Stage 0에서 확립된 패턴 유지.
6. **컴포넌트 분리**: page.tsx가 4,371줄. 새 기능은 `components/` 하위에 별도 파일로 분리.
7. **기존 패턴 준수**: 새 라이브러리 설치 금지 (Recharts 제외). 기존 className, API 호출 패턴 따름.
8. **색상**: 기존 컬러 시스템 유지. 배경 #F8FAFB, 카드 #FFFFFF, border #E5E7EB. 기존 CSS 변수가 있으면 그것 사용.

---

## F1: 차트/KPI 카드 개선 + Recharts 설치 (P0)

### 배경
Tab 0 오버뷰의 차트와 KPI 카드의 시각적 완성도를 높인다. 신규 백엔드 API(`/api/trends`, `/api/comparison`)를 활용하여 실데이터 기반 시각화를 구현한다.

### 작업 대상
- `frontend/package.json` — Recharts 설치
- `frontend/src/app/page.tsx` — Tab 0 영역
- `frontend/src/app/page.module.css` — 스타일 추가
- `frontend/src/components/dashboard/KpiCard.tsx` — 존재하면 수정, 없으면 신규 생성

### 요구사항

**Step 0: Recharts 설치**
```bash
cd frontend
npm install recharts
```
설치 후 `npm run build`로 호환성 확인. React 19와 호환 문제가 있으면 `npm install recharts --legacy-peer-deps`로 재시도.

**Step 1: 데이터 소스 확인**
- Tab 0의 KPI 데이터(Clicks, Impressions, CTR, Avg Position)가 어디서 오는지 확인
- mock이면: TODO 주석 표시. 가능하면 `/api/gsc/overview` 등 기존 API 연결
- 실데이터면: 그대로 사용
- **신규**: `/api/trends?metric=clicks&period=30d`로 "전기간 대비 변화" 데이터 가져오기

**Step 2: KPI 카드 4개 통일**

컴포넌트: `components/dashboard/KpiCard.tsx`

```
┌─────────────────────────┐
│ 📊 Clicks         +12% │  라벨 + 변화율 배지
│ 747                     │  메인 숫자
│ ▂▃▅▆▇▅▃▄▅▆▇█▆▅▃       │  Sparkline (Recharts AreaChart, 높이 40px)
│ vs 이전 기간: 680       │  비교 수치
└─────────────────────────┘
```

Props interface:
```typescript
interface KpiCardProps {
  label: string;
  value: number;
  previousValue?: number;
  changePercent?: number;
  sparklineData?: { date: string; value: number }[];
  format?: 'number' | 'percent' | 'position';
  invertDirection?: boolean; // position용: 감소 = 녹색
}
```

스타일 (page.module.css에 추가):
```css
.kpiCard {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06);
}
.kpiBadgeUp { background: #D1FAE5; color: #065F46; }
.kpiBadgeDown { background: #FEE2E2; color: #991B1B; }
.kpiBadgeNeutral { background: #F3F4F6; color: #6B7280; }
```

변화율 배지: 양수 `#10B981` 배경 계열, 음수 `#EF4444` 배경 계열, 0 `#6B7280`
Position은 `invertDirection: true` → 감소 = 녹색

Sparkline: Recharts `<AreaChart>` 높이 40px, 축/그리드 숨김, fill 그라디언트(상단 opacity 0.3 하단 0)

**Step 3: 메인 트렌드 차트 개선**

데이터: `/api/trends?metric=clicks&period=30d&compare=previous`

Recharts `<AreaChart>`:
- 높이 280px
- fill 그라디언트: `<linearGradient>` (상단 opacity 0.3 하단 0)
- CustomTooltip 구현:
  ```css
  .chartTooltip {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(8px);
    border: 1px solid #E5E7EB;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    padding: 12px 16px;
  }
  ```
- X축: 30일이면 7일 간격 라벨. `<XAxis tick interval={6} />`
- Y축 그리드: `stroke: #E5E7EB`, `strokeDasharray: "3 3"`
- 두 시리즈(current vs previous)일 때: current = 실선, previous = 점선 + 낮은 opacity

**Step 4: 차트 상단 컨트롤 바**

기간 선택 Pill 버튼: `7일` | `30일` | `90일`
메트릭 토글: `클릭` | `노출` | `CTR` | `순위`

```css
.pillGroup { display: flex; gap: 4px; }
.pill {
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid #E5E7EB;
  background: #FFFFFF;
  color: #4B5563;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.pillActive {
  background: #1F2937;
  color: #FFFFFF;
  border-color: #1F2937;
}
```

선택 변경 시 `/api/trends` 재호출 (메트릭, 기간 파라미터 변경)

### 변경하지 않을 것
- AEO/GEO 원형 게이지
- AI Insights 패널
- 네비게이션 바

### 순서
1. `npm install recharts` + 빌드 확인
2. KpiCard 컴포넌트 생성/수정
3. 메인 차트 AreaChart 전환 + CustomTooltip
4. 컨트롤 바 (기간/메트릭) 추가
5. `/api/trends` 연동
6. `npm run build` 에러 0

---

## F2: AI 유입 카드 개선 (P0)

### 선행 조건
- F1 완료 (KpiCard 컴포넌트 사용)

### 작업 대상
- `frontend/src/app/page.tsx` — Tab 0 AI Traffic 영역, Tab 5 사용자 행동 영역
- `frontend/src/components/dashboard/AiTrafficCard.tsx` — 신규
- `frontend/src/components/dashboard/AiTrafficDetail.tsx` — 신규

### 요구사항

**1. Tab 0 — AI 유입 요약 카드**

API: `GET /api/ga4/ai-traffic`

```
┌──────────────────────────────────────────┐
│ 🤖 AI 유입 현황 (최근 30일)              │
│                                          │
│  세션: 127   사용자: 89   매출: ₩320,000  │
│                                          │
│  상위 소스                                │
│  ● ChatGPT   45 (35.4%)                  │
│  ● Perplexity 32 (25.2%)                 │
│  ● Gemini     28 (22.0%)                 │
│                                          │
│  전체 트래픽 대비 AI 비율: 2.3%           │
└──────────────────────────────────────────┘
```

소스별 색상 (CSS 변수로 정의):
```css
.sourceChip--chatgpt { --dot-color: #10A37F; }
.sourceChip--perplexity { --dot-color: #5A67D8; }
.sourceChip--gemini { --dot-color: #4285F4; }
.sourceChip--copilot { --dot-color: #00BCF2; }
.sourceChip--claude { --dot-color: #D4A574; }
.sourceChip--other { --dot-color: #9CA3AF; }
```

B6에서 추가된 `label` 필드를 활용하여 소스명 매핑.
4-state 패턴: loading(Skeleton) / ready / error(retry 버튼) / empty("AI 유입 데이터 미수집")

**2. Tab 5 — AI Traffic 상세 섹션**

컴포넌트: `components/dashboard/AiTrafficDetail.tsx`

구성:
- KPI 카드 3개: AI 세션 / AI 사용자 / AI 매출 (F1의 KpiCard 재사용)
- 소스별 테이블 (bySource): source, sessions, users, revenue
- 랜딩페이지별 테이블 (byLandingPage): path, sessions, users
- 기간 선택: Tab 5 기존 기간 선택 UI 재사용 (있으면). 없으면 F1의 Pill 컴포넌트 재사용

**3. `/api/ga4/top-sources` matched/label 활용**
- B6에서 `matched: true/false`, `label: "ChatGPT"` 등이 추가됨
- 디버그/관리 목적: Tab 5 하단에 "AI 소스 매칭 현황" 접기 섹션 (선택)

**4. API 호출 패턴**
- 기존 코드의 fetch 패턴을 그대로 따름
- Tab 0 마운트 시 자동 호출
- Tab 5 전환 시 호출

### 순서
1. API 응답 interface 정의
2. AiTrafficCard 컴포넌트 (Tab 0 요약)
3. AiTrafficDetail 컴포넌트 (Tab 5 상세)
4. 4-state 처리
5. `npm run build` 에러 0

---

## F3: 체크리스트 진행률 바 + P0/P1/P2 배지 (P0)

### 선행 조건
- F1 완료

### 작업 대상
- `frontend/src/app/page.tsx` — Tab 0 체크리스트 영역
- `frontend/src/components/dashboard/OptimizationChecklist.tsx` — 신규

### 요구사항

**1. 기존 aiOptimizationTasks 구조 먼저 파악**
- page.tsx에서 `aiOptimizationTasks` 또는 유사한 체크리스트 배열을 찾는다
- 기존 구조를 깨지 않고 `priority` 필드만 추가

**2. 진행률 요약 바**
```
┌──────────────────────────────────────────┐
│ ✅ AEO 최적화 체크리스트     3/9 완료     │
│ ████████░░░░░░░░░░░░░░░░░░  33%          │
│ P0: 1/3  P1: 1/3  P2: 1/3               │
└──────────────────────────────────────────┘
```

```css
.progressBar { height: 8px; border-radius: 4px; background: #E5E7EB; overflow: hidden; }
.progressFill { height: 100%; background: #10B981; transition: width 0.5s ease; }
```

**3. 우선순위 배지**
```css
.badgeP0 { background: #FEE2E2; color: #991B1B; border: 1px solid #FECACA; }
.badgeP1 { background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; }
.badgeP2 { background: #DBEAFE; color: #1E40AF; border: 1px solid #BFDBFE; }
.badge { font-size: 11px; padding: 2px 8px; border-radius: 9999px; font-weight: 500; }
```

분류:
- P0: Schema Markup, E-E-A-T 기본 요소, Meta Description
- P1: 내부 링크 구조, 이미지 Alt 태그, 페이지 속도
- P2: Open Graph, Sitemap, Canonical URL

**4. 체크박스 토글**
- localStorage로 완료 상태 저장
- 완료 항목: `opacity: 0.6` + `text-decoration: line-through`
- 설명 텍스트 접기/펼치기 (chevron 아이콘)

**5. 필터 Pill**: `전체` | `P0` | `P1` | `P2` (F1의 Pill 스타일 재사용)

### 순서
1. 기존 체크리스트 구조 파악
2. OptimizationChecklist 컴포넌트 생성
3. 진행률 바 + 배지 구현
4. 체크박스/토글/필터 구현
5. `npm run build` 에러 0

---

## F4: AI Insights 캐시 배지 + UX 개선 (P1)

### 배경
B1 완료로 `_meta` 필드가 API 응답에 포함됨. 캐시 상태 표시, 카테고리별 시각 구분, 실행 가능성 태그를 추가한다.

### 작업 대상
- `frontend/src/app/page.tsx` — Tab 0 AI Insights 패널
- `frontend/src/components/dashboard/InsightCard.tsx` — 신규 (선택)

### 요구사항

**1. `_meta` 파싱 + 데이터 소스 배지**
- `_meta.source === "live"`: `🟢 실시간 분석`
- `_meta.source === "cache"`: `💾 캐시됨 (N시간 전)`
- generatedAt 기준 상대 시간: "방금", "N분 전", "N시간 전"
- `_meta` 필드 없으면: 배지 미표시 (하위호환)

```css
.metaBadgeLive { background: #D1FAE5; color: #065F46; }
.metaBadgeCache { background: #F1F5F9; color: #475569; }
.metaBadge { font-size: 12px; padding: 3px 10px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; }
```

**2. 새로고침 버튼**
- 배지 옆 🔄 아이콘. 클릭 시 `POST /api/ai/insights/refresh`
- 로딩: CSS animation rotate
```css
.refreshBtn { cursor: pointer; transition: opacity 0.15s; }
.refreshBtn:hover { opacity: 0.7; }
@keyframes spin { to { transform: rotate(360deg); } }
.refreshSpinning { animation: spin 1s linear infinite; }
```

**3. 카테고리별 시각 구분**
```css
.insightUrgent { border-left: 4px solid #EF4444; background: #FEF2F2; }
.insightOpportunity { border-left: 4px solid #F59E0B; background: #FFFBEB; }
.insightTrend { border-left: 4px solid #3B82F6; background: #EFF6FF; }
.insightRecommend { border-left: 4px solid #10B981; background: #ECFDF5; }
```

**4. Actionable 태그 자동 분류**
텍스트 키워드 기반:
- "추가", "변경", "수정", "적용", "설치", "개선" → `실행 가능`
- "추이", "모니터링", "관찰", "확인", "지켜보" → `모니터링`

```css
.tagActionable { background: #D1FAE5; color: #065F46; }
.tagMonitor { background: #F1F5F9; color: #475569; }
```

**5. 분석 시각**: 패널 하단 "마지막 분석: YYYY-MM-DD HH:mm" (`_meta.generatedAt` 사용)

### 순서
1. `_meta` interface 정의
2. 배지 + 새로고침 구현
3. 카테고리 스타일 적용
4. Actionable 태그 구현
5. `npm run build` 에러 0

---

## F5: 키워드 인텐트 UI 개선 (P1)

### 배경
B2 완료로 `?weight=clicks/impressions/count` 가중치 옵션이 API에 추가됨. 도넛 차트와 인텐트별 상세를 개선한다.

### 작업 대상
- `frontend/src/app/page.tsx` — Tab 0 키워드 인텐트 영역
- `frontend/src/components/dashboard/IntentChart.tsx` — 신규

### 요구사항

**1. 가중치 모드 토글**
- Pill 버튼: `클릭 가중` | `노출 가중` | `개수 기준` (F1의 Pill 스타일 재사용)
- 변경 시 `GET /api/keywords/intent?weight=clicks|impressions|count` 재호출

**2. 도넛 차트 (Recharts PieChart)**
- `<PieChart>` + `<Pie innerRadius="60%" outerRadius="80%">`
- 중앙 텍스트: 총 키워드 수 (Recharts customized label)
- 호버 Tooltip: 카테고리명, 클릭수, 키워드수, 비율

색상:
```css
.intentInfo { color: #3B82F6; }     /* 정보형 */
.intentCommercial { color: #F59E0B; } /* 상업형 */
.intentNav { color: #10B981; }       /* 탐색형 */
.intentBrand { color: #8B5CF6; }     /* 브랜드 */
```

**3. 카테고리 클릭 시 Top 키워드 Accordion**
- 각 카테고리 행 클릭 → `topKeywords` 5개 펼침
- 키워드명 + 클릭수 + 순위
- `max-height` transition + `overflow: hidden`

**4. 새로고침**: 🔄 아이콘 (F4와 동일 패턴)

### 순서
1. IntentChart 컴포넌트 생성
2. PieChart 구현 + 중앙 텍스트
3. 가중치 토글 연동
4. Accordion 구현
5. `npm run build` 에러 0

---

## F6: 칼럼 분석 상단 KPI 카드 추가 (P1)

### 배경
Tab 1 진입 시 바로 테이블이 보인다. 상단에 KPI 요약이 있으면 현황 파악이 빠르다. `/api/comparison?dimension=page`를 활용하여 전기간 대비 변화도 표시 가능.

### 작업 대상
- `frontend/src/app/page.tsx` — Tab 1 상단

### 요구사항

**1. 데이터 소스 확인**
- Tab 1 칼럼 데이터가 API인지 mock인지 확인
- mock이면: 현재 mock 데이터에서 집계. TODO 주석 표시

**2. KPI 카드 4개** (F1의 KpiCard 재사용)
- 총 칼럼 수 / 총 클릭수 / 평균 CTR / 평균 순위
- 가능하면 `/api/comparison` 데이터로 변화율 표시

**3. AEO Score 분포 바**
```
우수 (80+): 12개 | 양호 (60-79): 20개 | 개선필요 (60 미만): 15개
██████████████████░░░░░░░░░░░░░░░░░░░░░░█████████████████
```

```css
.scoreDistBar { display: flex; height: 12px; border-radius: 6px; overflow: hidden; }
.scoreGood { background: #10B981; }
.scoreOk { background: #F59E0B; }
.scoreNeed { background: #EF4444; }
```

### 순서
1. Tab 1 데이터 소스 확인
2. KpiCard 4개 배치
3. AEO Score 분포 바
4. `npm run build` 에러 0

---

## F7: 테이블 UX 개선 (P1)

### 작업 대상
- `frontend/src/app/page.tsx` — Tab 1 (칼럼), Tab 2 (키워드) 테이블
- `frontend/src/components/common/DataTable.tsx` — 신규 (재사용 가능한 테이블)

### 요구사항

**1. 기존 테이블 파악 후 확장**
- HTML `<table>`인지, div 기반인지 확인
- 기존 구조를 유지하면서 기능 추가

**2. 검색 필터**
```css
.searchInput {
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  padding: 8px 12px 8px 36px; /* 좌측 아이콘 공간 */
  font-size: 14px;
  width: 280px;
  transition: border-color 0.15s;
}
.searchInput:focus { border-color: #3B82F6; outline: none; }
```
debounce 300ms, 클리어(X) 버튼

**3. 칼럼 정렬**
- 헤더 클릭 시 오름/내림 토글
- 기본: 클릭수 내림차순
- 활성 헤더: `font-weight: 700` + ▲/▼ 아이콘

**4. 페이지네이션**
- 페이지당 20/50/100 선택
- `< 이전 | 1 2 3 ... | 다음 >`
- "총 N개 중 X-Y"

```css
.pagination { display: flex; align-items: center; gap: 4px; }
.pageBtn { padding: 6px 10px; border-radius: 6px; border: 1px solid #E5E7EB; }
.pageBtnActive { background: #1F2937; color: #FFFFFF; }
```

**5. 행 호버**: `transition: background-color 0.15s ease;` → `background: #F8FAFC`

**6. DataTable 컴포넌트로 분리하여 Tab 1, Tab 2 모두에 적용**

### 순서
1. DataTable 컴포넌트 생성 (검색+정렬+페이지네이션)
2. Tab 1에 적용
3. Tab 2에 적용
4. `npm run build` 에러 0

---

## F8: AEO/GEO 상세 Accordion (P1)

### 작업 대상
- `frontend/src/app/page.tsx` — Tab 0 AEO/GEO 점수 카드 하위

### 요구사항

**1. 현재 구현 확인**
- AEO/GEO 상세 항목이 현재 어떻게 표시되는지 먼저 확인
- 이미 Accordion이면 스킵

**2. Accordion 구현**
- 기본: 접힘 (점수 게이지만)
- 클릭: 채점 항목별 점수 펼침

```css
.accordion { overflow: hidden; transition: max-height 0.3s ease; }
.accordionClosed { max-height: 0; }
.accordionOpen { max-height: 500px; } /* 충분히 큰 값 */
.chevron { transition: transform 0.2s ease; display: inline-block; }
.chevronOpen { transform: rotate(90deg); }
```

**3. 상세 항목 레이아웃**
```
Schema Markup      72/100  ████████░░
Content Structure   85/100  █████████░
```

미니 프로그레스 바:
```css
.miniProgress { height: 6px; border-radius: 3px; background: #E5E7EB; flex: 1; }
.miniProgressFill { height: 100%; border-radius: 3px; }
.scoreHigh { background: #10B981; }   /* 80+ */
.scoreMid { background: #F59E0B; }    /* 60-79 */
.scoreLow { background: #EF4444; }    /* 60 미만 */
```

**4. AEO, GEO 독립 토글** (하나 펼쳐도 다른 것 안 닫힘)

### 순서
1. 현재 구현 확인
2. Accordion 로직 (useState per section)
3. AEO/GEO 각각 적용
4. `npm run build` 에러 0

---

## 실행 순서

```
F1 (차트/KPI + Recharts 설치) ── P0, 최우선
  │
  ├─→ F2 (AI 유입 카드) ── P0, F1의 KpiCard 재사용
  ├─→ F3 (체크리스트) ── P0, F1의 Pill 스타일 재사용
  │
  ├─→ F4 (인사이트 UX) ── P1, 독립 가능하나 F1 이후 권장
  ├─→ F5 (인텐트 UX) ── P1, Recharts PieChart 사용
  ├─→ F6 (칼럼 KPI) ── P1, KpiCard 재사용
  ├─→ F7 (테이블 UX) ── P1, 독립 실행 가능
  └─→ F8 (Accordion) ── P1, 독립 실행 가능
```

**P0 그룹 (F1 → F2 → F3)**: 순차 실행. F1이 인프라(Recharts, KpiCard, Pill)를 깔고, F2/F3가 재사용.
**P1 그룹 (F4-F8)**: F1 완료 후 순서 무관. 독립 실행 가능.

B1-B6 백엔드가 모두 완료된 상태이므로, 프론트 프롬프트에 백엔드 대기 조건은 없음.