# report0221-front1.0 — 프론트엔드 개발 계획 (페이지 진단 + AI 인용도 UI)

작성일: 2026-02-21
작성: 헤파이스토스 (코딩 에이전트)
범위: 프론트엔드 페이지 진단 탭(Tab 6) 고도화 + AI 인용도 멀티 프로바이더 시각화
기반: `report0221-1.md`, `report0221-2.md`, `report0221-feedback2.md`, 현재 코드 분석, 스크린샷 2장

---

## 0) 요약

현재 프론트엔드 "페이지 진단" 탭은 **Schema 마크업 + 콘텐츠 구조 + AEO/GEO 점수 브레이크다운**까지 구현되어 있으나,
**백엔드에서 이미 구현 완료된 멀티 프로바이더 AI 인용도(`/api/ai/citation`)가 프론트에 전혀 연결되지 않은 상태**이오.

리포트/피드백에서 도출된 핵심 문제:
1. "AI 답변 인용도 0/20"이 **왜 0인지**(측정 실패 / 노출 0 / 인용 0) 구분이 UI에서 불가능
2. 프로바이더별(Google AIO / ChatGPT Search / Perplexity) **세부 결과**가 보이지 않음
3. 어떤 사이트가 인용되는지(**경쟁 레퍼런스**)를 확인할 수 없음
4. 페이지 진단에서 **PageSpeed 측정이 자동 연동되지 않아** GEO Score의 기술 성능 항목이 항상 0/10

---

## 1) 현재 상태 분석 (As-Is)

### 1-1. 프론트엔드 페이지 진단 탭 (Tab 6) — 구현 완료된 기능

| 섹션 | 구현 상태 | 비고 |
|------|-----------|------|
| URL 입력 + 진단 시작 버튼 | ✅ 완료 | `handleDiagnosisTest()` |
| AEO/GEO 점수 카드 (상단) | ✅ 완료 | 프로그레스 바 + 측정 항목 수 |
| AEO/GEO 브레이크다운 상세 | ✅ 완료 | 점수바 + detail 텍스트 |
| Schema 마크업 진단 (6종 그리드) | ✅ 완료 | FAQPage/Article/HowTo/Author/Medical/Speakable |
| 콘텐츠 구조 분석 (8개 메트릭) | ✅ 완료 | H2/H3/목록/표/인용/이미지/alt/메타 |
| 감점 요인 및 개선 권장 | ✅ 완료 | 우선순위 정렬 (긴급/중요/선택) |

### 1-2. 미구현 / 미연동 영역

| 영역 | 상태 | 백엔드 준비 |
|------|------|-------------|
| AI 인용도 멀티 프로바이더 시각화 | ❌ 미구현 | ✅ `/api/ai/citation` 완성 |
| 0점 원인 분해 UI (verdict 표시) | ❌ 미구현 | ✅ scoring.ts에서 verdict 힌트 제공 |
| 프로바이더별 세부 결과 패널 | ❌ 미구현 | ✅ `AiCitationMultiResult.providers[]` |
| 경쟁 레퍼런스(인용 사이트) 목록 | ❌ 미구현 | ✅ `samples[].references[]` |
| PageSpeed 자동 연동 (진단 시) | ❌ 미연동 | ✅ `/api/pagespeed/run` 존재 |
| CTR 트렌드 진단 URL별 조회 | ❌ 미연동 | ⚠️ GSC 데이터에서 추출 가능 |

### 1-3. 스크린샷 기준 현재 UI 평가

**스크린샷 1** (biocom.kr/healthinfo — 목록 페이지):
- AEO 42점, GEO 57점
- Schema 0/20 (모든 스키마 ❌) — 목록 페이지이므로 정상
- AI 답변 인용도 0/20 → **왜 0인지 안 보임 (핵심 문제)**
- 기술 성능(PageSpeed) 1/10 → 진단 시 PageSpeed 자동 실행 안 됨

**스크린샷 2** (칼럼 상세 페이지):
- AEO 54점, GEO 78점
- Schema 9/20 (Article ✅, Author ✅, Speakable ✅)
- AI 답변 인용도 여전히 0/20 → 원인 불투명
- 메타 설명 길이 3590개 → 비정상 (파싱 이슈 가능성)

---

## 2) 프론트엔드 개발 계획

### Phase F1 — AI 인용도 시각화 + 0점 원인 표시 (핵심, 2~3일)

> **목표**: "왜 0점인가?"를 진단 탭에서 즉시 확인 가능하게 만들기

#### F1-1. AI 인용도 섹션 신설 (페이지 진단 탭 내)

위치: Schema 마크업 진단과 콘텐츠 구조 분석 사이에 배치

```
┌─────────────────────────────────────────────────────────┐
│  AI 답변 인용도 분석                     3개 프로바이더 │
│─────────────────────────────────────────────────────────│
│                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────│
│  │  Google AI Overview│  │ ChatGPT Search  │  │Perplexity│
│  │  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈ │  │ ┈┈┈┈┈┈┈┈┈┈┈┈┈┈ │  │┈┈┈┈┈┈┈┈ │
│  │  상태: 노출 0     │  │ 상태: 인용 0    │  │상태: 인용│
│  │  eligible: 0/5    │  │ eligible: 5/5   │  │0/5      │
│  │  cited: 0         │  │ cited: 0        │  │cited: 0 │
│  │  ■■□□□            │  │ ■■■■■□□□□□      │  │■■■□□□□  │
│  └──────────────────┘  └──────────────────┘  └──────────│
│                                                         │
│  종합 인용률: 0.0% (0/15 eligible 중 0건 인용)          │
│  판정: 📊 citation_zero — 출처에 노출되나 인용 없음     │
│                                                         │
│  ▼ 표본 키워드별 상세                                    │
│  ┌─────────────────┬──────┬──────┬──────┬──────────────┐│
│  │ 키워드           │Google│ChatGPT│Perp. │ 인용 여부   ││
│  ├─────────────────┼──────┼──────┼──────┼──────────────┤│
│  │ 프로바이오틱스 효능│ AIO ❌│ 출처✅│ 출처✅│ biocom ❌ ││
│  │ 비타민D 결핍 증상 │ AIO ❌│ 출처✅│ 출처✅│ biocom ❌ ││
│  │ ...              │      │      │      │              ││
│  └─────────────────┴──────┴──────┴──────┴──────────────┘│
│                                                         │
│  ▼ 경쟁 출처 (인용되는 사이트 TOP 10)                   │
│  ┌───────────────────────┬──────┬─────────────────────┐ │
│  │ 도메인                 │ 횟수 │ 프로바이더           │ │
│  ├───────────────────────┼──────┼─────────────────────┤ │
│  │ naver.com             │ 8    │ Google, ChatGPT     │ │
│  │ health.chosun.com     │ 5    │ ChatGPT, Perplexity │ │
│  │ ...                   │      │                     │ │
│  └───────────────────────┴──────┴─────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**구현 상세:**

1. **데이터 로딩**: `handleDiagnosisTest()`에서 기존 AEO/GEO 스코어 호출과 병렬로 `/api/ai/citation` 호출 추가
   ```typescript
   // 기존 crawl + aeo/geo와 병렬 실행
   const citationRes = await fetch(`${API_BASE_URL}/api/ai/citation?sampleSize=5`);
   ```

2. **verdict 시각화**: 백엔드 AEO breakdown의 `aiCitation` 항목 detail에서 상태 문구 추출하여 아이콘+컬러로 표시
   - `측정 실패` → 🔴 빨간 배경 + "API 키 확인 필요"
   - `노출/출처 0 (eligible=0)` → 🟡 노란 배경 + "AI Overview 노출 없음"
   - `인용 0` → 🟠 주황 배경 + "출처에 노출되나 인용 없음"
   - `인용됨` → 🟢 초록 배경 + "인용 확인됨"

3. **프로바이더 카드 (3열 그리드)**: 각 프로바이더별로
   - 상태 아이콘 (ok/partial/error)
   - eligible / cited 수치
   - citationRate 프로그레스 바
   - latencyMs 표시

4. **표본 키워드 테이블**: 접기/펼치기(아코디언)
   - 키워드별 각 프로바이더의 exposure/cited 상태
   - biocom.kr 매칭 여부

5. **경쟁 출처 테이블**: 접기/펼치기
   - 모든 프로바이더의 `references[]`에서 도메인 추출 → 빈도 집계 → TOP 10 표시
   - biocom.kr 매칭 레퍼런스는 하이라이트

**필요 타입 추가 (page.tsx 상단):**
```typescript
type AiCitationMultiResult = {
  siteHost: string;
  hl: string;
  gl: string;
  sampled: number;
  eligibleTotal: number;
  citedQueriesTotal: number;
  citedReferencesTotal: number;
  citationRateOverall: number;
  latencyMsTotal: number;
  providers: AiCitationProviderResult[];
  pickedQueries: string[];
  measuredAt: string;
};

type AiCitationProviderResult = {
  provider: "google_ai_overview" | "chatgpt_search" | "perplexity";
  providerStatus: "ok" | "partial" | "error";
  eligible: number;
  citedQueries: number;
  citedReferences: number;
  citationRate: number;
  latencyMs: number;
  samples: AiCitationProviderSample[];
};

type AiCitationProviderSample = {
  query: string;
  providerStatus: string;
  eligible: boolean;
  exposure: boolean;
  cited: boolean;
  references: { title: string; link: string; source?: string }[];
  matchedReferences: { title: string; link: string; source?: string }[];
};
```

**필요 state 추가:**
```typescript
const [diagCitation, setDiagCitation] = useState<AiCitationMultiResult | null>(null);
const [diagCitationLoading, setDiagCitationLoading] = useState(false);
```

#### F1-2. AEO 브레이크다운 "AI 답변 인용도" 항목 인터랙션 강화

현재: 점수 바 + detail 텍스트만 표시
변경: 클릭 시 위의 AI 인용도 섹션으로 스크롤 + 하이라이트

#### F1-3. CSS 스타일링

기존 디자인 시스템 유지:
- 프로바이더 카드: `styles.diagSchemaCard`와 동일 패턴 (감지됨/없음 대신 cited/not cited)
- verdict 배지: 기존 `insightBadge` 계열과 통일
- 테이블: 기존 `keywordsTable` 스타일 재활용
- 컬러: `--color-primary`(teal), `--color-accent`(amber), `--color-danger`(red) 활용

---

### Phase F2 — PageSpeed 자동 연동 + 점수 카드 개선 (1~2일)

> **목표**: 진단 시 PageSpeed도 자동 측정하여 GEO Score 기술 성능 항목이 0/10이 아니게 만들기

#### F2-1. 진단 시 PageSpeed 자동 실행

`handleDiagnosisTest()` 확장:
```
1) 크롤 분석 → setDiagCrawlResult
2) PageSpeed 측정 → setCachedResult (병렬)
3) AEO/GEO 점수 조회 (PageSpeed 결과가 서버 캐시에 올라간 후) → setDiagAeoScore / setDiagGeoScore
4) AI 인용도 조회 (병렬) → setDiagCitation
```

순서 핵심: PageSpeed 측정이 **AEO/GEO 점수 조회보다 먼저** 완료되어야 서버가 캐시된 PageSpeed 결과를 점수에 반영함.

```typescript
// 병렬 1: 크롤 + PageSpeed
const [crawlData, _psResult] = await Promise.all([
  fetch(`${API_BASE_URL}/api/crawl/analyze`, { method: "POST", ... }),
  fetch(`${API_BASE_URL}/api/pagespeed/run`, { method: "POST", body: JSON.stringify({ url, strategy: "mobile" }) }),
]);
// 병렬 2: AEO/GEO + Citation (PageSpeed 캐시 완료 후)
const [aeoRes, geoRes, citationRes] = await Promise.all([
  fetch(`${API_BASE_URL}/api/aeo/score${urlParam}`),
  fetch(`${API_BASE_URL}/api/geo/score${urlParam}`),
  fetch(`${API_BASE_URL}/api/ai/citation?sampleSize=5`),
]);
```

#### F2-2. 점수 카드 개선

현재 점수 카드를 오버뷰 탭의 링 차트 스타일과 통일:
- SVG 도넛 차트 (반원형 → 전체 원형)로 교체
- AEO: teal 계열, GEO: amber 계열 유지
- 측정 항목 세그먼트 표시 유지

#### F2-3. 진행 상태 표시 개선

현재: "진단 중... (10~30초)" 단일 메시지
변경: 단계별 프로그레스 표시
```
Step 1/4: 페이지 크롤링 중... ✅
Step 2/4: PageSpeed 측정 중... ⏳
Step 3/4: AEO/GEO 점수 계산 중...
Step 4/4: AI 인용도 분석 중...
```

---

### Phase F3 — UX 개선 + 감점 요인 고도화 (1~2일)

> **목표**: 진단 결과의 실행 가능성(actionability)을 높이기

#### F3-1. 감점 요인에 AI 인용도 관련 항목 추가

현재 `diagnosisItems`는 Schema + 콘텐츠만 생성.
AI 인용도 결과도 감점 요인에 포함:

```typescript
// AI 인용도 기반 감점 요인 추가
if (diagCitation) {
  if (diagCitation.eligibleTotal === 0) {
    items.push({
      category: "AI 인용",
      issue: "AI 답변 노출 0건 (eligible=0)",
      priority: "urgent",
      recommendation: "표본 키워드에서 AI Overview/ChatGPT/Perplexity 출처가 전혀 감지되지 않았습니다. Q&A형 콘텐츠 확대 및 FAQ 스키마 적용을 권장합니다."
    });
  } else if (diagCitation.citedQueriesTotal === 0) {
    items.push({
      category: "AI 인용",
      issue: `AI 출처 노출되나 biocom.kr 인용 0건 (0/${diagCitation.eligibleTotal})`,
      priority: "urgent",
      recommendation: "AI가 참고하는 출처에 다른 사이트가 인용되고 있습니다. Answer-first 요약, 근거 인용, Author 스키마 강화로 인용 확률을 높이세요."
    });
  }
}
```

#### F3-2. 감점 요인 카테고리 확장

현재: "Schema" | "콘텐츠"
변경: "Schema" | "콘텐츠" | "AI 인용" | "기술 성능"

기술 성능 항목 추가 (PageSpeed 연동 시):
- Performance 점수 < 50 → urgent
- LCP > 4000ms → urgent
- CLS > 0.25 → important

#### F3-3. 진단 결과 공유/내보내기

진단 결과를 마크다운 또는 JSON으로 복사/다운로드하는 버튼 추가:
- "결과 복사" 버튼 → 클립보드에 마크다운 요약
- "JSON 내보내기" 버튼 → 전체 raw 데이터 다운로드

#### F3-4. 진단 URL 히스토리 (localStorage)

최근 진단한 URL 5개를 `localStorage`에 저장하고 드롭다운으로 빠르게 재선택:
- `diagUrlHistory: string[]` in localStorage key `seo-diag-history`
- 중복 제거, 최신순 정렬

---

## 3) 구현 우선순위 및 일정

| 순서 | Phase | 핵심 산출물 | 예상 | 의존성 |
|------|-------|-------------|------|--------|
| 1 | **F1** | AI 인용도 섹션 + 0점 verdict + 프로바이더 카드 | 2~3일 | 백엔드 Phase 1 완료 ✅ |
| 2 | **F2** | PageSpeed 자동 연동 + 점수 카드 개선 + 프로그레스 | 1~2일 | F1 완료 |
| 3 | **F3** | 감점 요인 확장 + 내보내기 + URL 히스토리 | 1~2일 | F2 완료 |

**총 예상: 4~7일 (F1이 가장 중요, F1만으로도 핵심 문제 해결)**

---

## 4) 기술 결정 사항

### 4-1. 컴포넌트 분리 여부

현재 `page.tsx`가 2500+ 라인으로 매우 크지만, **이번 작업에서는 기존 패턴(page.tsx 내 섹션 추가)을 유지**하오.
이유: 기존 코드가 모두 page.tsx에 있어 분리 시 diff가 커지고, 기능 추가에 집중하기 위함.
(추후 리팩토링 별도 진행 가능)

### 4-2. API 호출 전략

- AI 인용도(`/api/ai/citation`)는 **진단 버튼 클릭 시에만** 호출 (비용 절감)
- `sampleSize=5`로 고정 (Phase 2에서 표본 개선 후 UI에서 조절 가능하게 확장)
- 6시간 캐시가 백엔드에 있으므로, 프론트에서 추가 캐시 불필요
- `refresh=1`은 개발 환경에서만 허용 (프론트에서 노출하지 않음)

### 4-3. 타입 관리

- 백엔드 `AiCitationMultiResult` 타입을 프론트에 복제 (현재 모노레포가 아니므로)
- 향후 공유 타입 패키지 분리 검토 가능

### 4-4. 스타일링

- 기존 CSS Modules (`page.module.css`) 방식 유지
- 새 클래스: `diagCitation*`, `diagProvider*`, `diagVerdict*` 접두사
- 디자인 토큰(CSS 변수) 활용하여 기존 UI와 통일감 유지

---

## 5) 리스크 및 주의사항

1. **AI 인용도 로딩 시간**: SerpAPI + OpenAI + Perplexity 3개를 동시 호출하면 10~30초 소요 가능
   → 진단 프로그레스 UI로 사용자 대기 경험 개선 필수

2. **SerpAPI 쿼터**: Free Plan 기준 월 100회, 진단마다 표본 5개 소모
   → 캐시 활용 + 사용자에게 "이전 측정 결과 사용" 옵션 제공

3. **page.tsx 파일 크기**: 이미 2500+ 라인인데 추가 시 3000+ 예상
   → F3 이후 컴포넌트 분리 리팩토링 권장

4. **메타 설명 길이 이상값**: 스크린샷2에서 3590자로 표시 → 백엔드 크롤러의 메타 파싱 검증 필요 (프론트 이슈 아님)

---

## 6) 각 Phase를 이렇게 세운 이유

### Phase F1을 최우선으로 둔 이유

report0221-feedback2.md의 핵심 피드백이 **"0/20이 왜 뜨는지 구분해서 보여줘야 한다"**였소.
백엔드는 이미 verdict/providerStatus/eligible/exposure/cited 등 상세 데이터를 내려주고 있는데, 프론트가 이를 전혀 표시하지 않아서 **TJ님이 "AI 인용도 0점"만 보고 원인을 파악할 수 없는 상태**이오.
F1 하나만 완료해도 "측정 실패인지 / 노출이 안 되는 건지 / 인용이 안 되는 건지"를 즉시 판단할 수 있어, **가장 높은 ROI를 가진 작업**이오.

### Phase F2를 F1 다음에 둔 이유

스크린샷에서 GEO Score의 "기술 성능(PageSpeed)" 항목이 0/10 또는 1/10으로 나오는데, 이는 **페이지 진단 시 PageSpeed를 자동 실행하지 않아서** 서버 캐시에 결과가 없는 것이 원인이오.
F2에서 진단 플로우에 PageSpeed를 통합하면 GEO Score가 실제 기술 성능을 반영하게 되오.

### Phase F3를 마지막에 둔 이유

F3의 감점 요인 확장, 내보내기, URL 히스토리는 **"이미 보이는 데이터를 더 잘 활용하게 만드는" UX 개선**이오.
핵심 데이터가 먼저 보여야(F1, F2) 이런 개선이 의미가 있으므로, 마지막 단계에 배치했소.

---

## 7) 변경 대상 파일 목록

| 파일 | 변경 유형 | Phase |
|------|-----------|-------|
| `frontend/src/app/page.tsx` | 타입 추가 + state 추가 + 핸들러 수정 + 섹션 추가 | F1, F2, F3 |
| `frontend/src/app/page.module.css` | 새 CSS 클래스 추가 | F1, F2, F3 |
| (선택) `frontend/src/app/globals.css` | 진단용 CSS 변수 추가 | F1 |

**백엔드 변경 없음** — 이미 필요한 API가 모두 구현되어 있소.
