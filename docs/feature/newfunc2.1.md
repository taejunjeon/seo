# newfunc2.1 — AI 유입 트래픽 고도화 기능 분석

작성일: 2026-02-25
작성: 헤파이스토스(코딩 에이전트)
대상 저장소: `/Users/vibetj/coding/seo`

---

## 0) 핵심 질문에 대한 답변

### "어떤 주제나 키워드를 검색해서 들어온건지 알 수 있는가?"

**결론: GA4만으로는 직접 알 수 없다. 하지만 간접 추정 + 외부 도구 조합으로 근사 가능.**

| 방법 | 정확도 | 비용 | 구현 난이도 | 현재 상태 |
|------|--------|------|------------|----------|
| ① GA4 랜딩페이지 + GSC 쿼리 매핑 (근사치) | 40~60% | 무료 | 낮음 | ✅ 이미 구현 (`/api/ai-traffic/topics`) |
| ② ChatGPT utm_source 파라미터 분석 | 30% | 무료 | 낮음 | ❌ 미구현 |
| ③ 랜딩페이지 콘텐츠 기반 토픽 추출 | 50~70% | API 비용 | 중간 | ❌ 미구현 |
| ④ LLM 프롬프트 모니터링 도구 연동 (Peec.ai 등) | 80~90% | 월 $100~300 | 높음 | ❌ 미구현 |
| ⑤ 자체 AI Citation 모니터링 확장 | 70~80% | API 비용 | 높음 | 부분 구현 (AI Citation 섹션) |
| ⑥ 커스텀 GA4 이벤트 (사이트 내 AI 유입 태깅) | 90%+ | 무료 | 중간 | ❌ 미구현 |

### 왜 GA4만으로 안 되는가?

AI 플랫폼(ChatGPT, Perplexity 등)에서 사용자가 **어떤 프롬프트/질문을 입력했는지**는 GA4에 전달되지 않음.
GA4가 받을 수 있는 정보는 오직:
- `sessionSource` = "chatgpt.com" (어디서 왔는지)
- `sessionMedium` = "referral" (어떻게 왔는지)
- `landingPagePlusQueryString` = "/shop_view/?idx=97" (어느 페이지에 도착했는지)

→ **"무엇을 물어봤는지"(프롬프트)는 전달 안 됨**

---

## 1) 현재 구현 상태 점검

### 1-1. 이미 구현된 기능

| 기능 | API | 설명 |
|------|-----|------|
| AI 소스별 트래픽 | `/api/ga4/ai-traffic` | ChatGPT, Perplexity, Gemini 등 소스별 세션/유저/매출 |
| 랜딩페이지별 AI 유입 | `/api/ga4/ai-traffic` | AI 유입이 몰리는 페이지 식별 |
| GSC 쿼리 근사치 매핑 | `/api/ai-traffic/topics` | AI 유입 랜딩 → GSC 검색어 매핑 (근사치) |
| 전체 소스 목록 (디버그) | `/api/ga4/top-sources` | allowlist 튜닝용 |
| Tab 0 요약 카드 | 프론트 | 최근 30일 KPI + 상위 소스 |
| Tab 5 상세 섹션 | 프론트 | 기간 선택 + KPI + 소스/랜딩 테이블 |

### 1-2. 현재 한계

1. **allowlist 정확성**: `CONTAINS` 기반 필터 → 거짓 양성 가능 (예: "mychatgpt.fake.com")
2. **키워드/프롬프트 미추적**: 사용자가 AI에 뭘 물어봤는지 모름
3. **참여도 지표 부재**: 이탈률, 체류시간, 참여 세션 등 미수집
4. **신규/재방문 구분 없음**: AI 유입이 새 고객인지 기존 고객인지 모름
5. **시계열 트렌드 없음**: 일별/주별 AI 유입 변화 추이 미제공
6. **AI 도구 카테고리 미분류**: ChatGPT(챗봇) vs Perplexity(검색) 구분 없음

---

## 2) 고도화 기능 목록

### Tier 1: 즉시 구현 가능 (백엔드 수정만, 낮은 난이도)

#### 2-1. GA4 참여도 지표 추가

**현재**: sessions, activeUsers, ecommercePurchases, grossPurchaseRevenue
**추가 가능**:

```typescript
// ga4.ts queryGA4AiTrafficDetailed()에 metrics 추가
metrics: [
  "sessions",
  "activeUsers",
  "totalUsers",
  "newUsers",              // 🆕 신규 사용자 수
  "engagedSessions",       // 🆕 참여 세션 (10초+ 또는 2페이지+)
  "bounceRate",            // 🆕 이탈률
  "averageSessionDuration",// 🆕 평균 세션 시간
  "screenPageViews",       // 🆕 페이지뷰 수
  "ecommercePurchases",
  "grossPurchaseRevenue",
]
```

**가치**: AI 유입 트래픽의 "질"을 측정 가능
- "ChatGPT에서 179세션 왔는데, 이탈률이 80%인가 20%인가?"
- "AI 유입 사용자가 평균 3.5페이지를 보는가, 1페이지만 보고 나가는가?"

**구현 난이도**: ⭐ (metrics 배열에 추가만 하면 됨)

---

#### 2-2. 신규 vs 재방문 사용자 분석

```typescript
// 추가 dimension 쿼리
dimensions: ["newVsReturning"]  // "new" 또는 "returning"
metrics: ["sessions", "activeUsers", "engagedSessions"]
```

**가치**: AI 유입이 **신규 고객 확보** 채널인지, **기존 고객 재유입** 채널인지 판별
- 마케팅 ROI 판단에 핵심

**구현 난이도**: ⭐ (새 쿼리 1개 추가)

---

#### 2-3. allowlist 정확성 강화

```typescript
// 현재 (부정확)
stringFilter: { matchType: "CONTAINS", value: "chatgpt" }
// → "mychatgpt-clone.com"도 매칭됨

// 개선안
stringFilter: { matchType: "EXACT", value: "chatgpt.com" }
// 또는
stringFilter: { matchType: "BEGINS_WITH", value: "chatgpt.com" }
```

**추가할 AI 소스**:
- `you.com` (You.com AI)
- `komo.ai` (Komo AI Search)
- `phind.com` (Phind — 개발자용 AI 검색)
- `meta.ai` (Meta AI)
- `search.brave.com` (Brave Search AI)

**구현 난이도**: ⭐ (상수 배열 수정)

---

#### 2-4. Bing.com 분리 처리

현재 allowlist에 `bing.com`이 포함되어 있으나, Bing은 일반 검색엔진이오.
Bing의 AI 기능(Copilot)은 `copilot.microsoft.com`으로 별도 추적해야 하오.

```typescript
// 제거 또는 분리
const AI_REFERRAL_SOURCE_PATTERNS_ALLOWLIST = [
  "chatgpt.com",
  "chat.openai.com",
  "openai",
  "perplexity.ai",
  "claude.ai",
  "gemini.google.com",
  "bard.google.com",
  "copilot.microsoft.com",
  // "bing.com" ← 제거 (일반 검색엔진)
];
```

**구현 난이도**: ⭐

---

### Tier 2: 중간 난이도 (새 API 또는 로직 추가)

#### 2-5. 일별 시계열 트렌드 API

**현재**: 기간 합산만 제공 (총 179세션)
**개선**: 일별 추이 제공 (2/1: 8세션, 2/2: 12세션, ...)

```typescript
// 새 API: GET /api/ga4/ai-traffic/trend
// 또는 기존 API에 breakdown=daily 파라미터 추가

dimensions: ["date", "sessionSource"]
metrics: ["sessions", "activeUsers"]
orderBy: [{ dimension: "date", desc: false }]
```

**프론트 UI**: 라인 차트로 AI 유입 추이 시각화

```
AI 유입 트렌드 (최근 30일)
     ┌──────────────────────────────────┐
  20 │          ╱╲    ╱╲               │
  15 │    ╱╲  ╱    ╲╱    ╲   ╱╲       │
  10 │  ╱    ╲╱              ╲╱  ╲    │
   5 │╱                            ╲  │
   0 │──────────────────────────────── │
     └──────────────────────────────────┘
      2/1  2/5  2/10  2/15  2/20  2/25

      ── ChatGPT  ── Perplexity  ── Gemini
```

**가치**: AI 유입의 성장/하락 트렌드, 특정 이벤트와의 상관관계 파악
**구현 난이도**: ⭐⭐

---

#### 2-6. AI 유입 전용 전환 퍼널

현재 "SEO → 전환 퍼널"은 유기 검색 기준이오. AI 유입 전용 퍼널을 만들 수 있소.

```
AI 유입 전환 퍼널
┌─────────────────────────────────────────┐
│ AI 유입 세션 (213)                      │ 100%
│ ┌─────────────────────────────────────┐ │
│ │ 참여 세션 (142)                     │ │ 66.7%
│ │ ┌───────────────────────────────┐   │ │
│ │ │ 상품 조회 (38)                │   │ │ 17.8%
│ │ │ ┌───────────────────────┐     │   │ │
│ │ │ │ 장바구니 (5)           │     │   │ │ 2.3%
│ │ │ │ ┌─────────────────┐   │     │   │ │
│ │ │ │ │ 구매 (1)         │   │     │   │ │ 0.5%
│ │ │ │ └─────────────────┘   │     │   │ │
│ │ │ └───────────────────────┘     │   │ │
│ │ └───────────────────────────────┘   │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**GA4 metrics 활용**:
```typescript
metrics: [
  "sessions",
  "engagedSessions",
  "itemsViewed",
  "itemsAddedToCart",
  "itemsCheckedOut",
  "ecommercePurchases",
]
```

**가치**: AI 유입의 전환 효율 측정 — 어디서 이탈하는지 파악
**구현 난이도**: ⭐⭐

---

#### 2-7. UTM 파라미터 파싱 (ChatGPT 자동 태깅 활용)

2025년 6월부터 ChatGPT는 링크에 `utm_source=chatgpt.com`을 자동 추가함.
이를 파싱하면 ChatGPT 유입을 더 정확히 추적 가능.

```typescript
// GA4의 landingPagePlusQueryString에서 utm_source 파싱
// 예: "/shop_view/?idx=97&utm_source=chatgpt.com"

const parseUtmFromLanding = (landing: string): Record<string, string> => {
  try {
    const url = new URL(landing, "https://dummy.com");
    return {
      utm_source: url.searchParams.get("utm_source") ?? "",
      utm_medium: url.searchParams.get("utm_medium") ?? "",
      utm_campaign: url.searchParams.get("utm_campaign") ?? "",
    };
  } catch { return {}; }
};
```

**가치**: `sessionSource`로 안 잡히는 ChatGPT 유입도 UTM으로 추가 포착
**구현 난이도**: ⭐⭐

---

#### 2-8. AI 도구 카테고리 분류

```typescript
type AiToolCategory = "chatbot" | "ai_search" | "coding_ai" | "ai_overview";

const AI_TOOL_CATALOG = {
  "chatgpt.com":           { name: "ChatGPT",    category: "chatbot",    icon: "🤖" },
  "chat.openai.com":       { name: "ChatGPT",    category: "chatbot",    icon: "🤖" },
  "perplexity.ai":         { name: "Perplexity",  category: "ai_search",  icon: "🔍" },
  "claude.ai":             { name: "Claude",      category: "chatbot",    icon: "🧠" },
  "gemini.google.com":     { name: "Gemini",      category: "chatbot",    icon: "✨" },
  "copilot.microsoft.com": { name: "Copilot",     category: "chatbot",    icon: "🪟" },
  "phind.com":             { name: "Phind",       category: "coding_ai",  icon: "💻" },
  "you.com":               { name: "You.com",     category: "ai_search",  icon: "🔎" },
  "meta.ai":               { name: "Meta AI",     category: "chatbot",    icon: "Ⓜ" },
} as const;
```

**가치**: "챗봇 유입 vs AI 검색 유입" 비교 → 마케팅 전략 차별화
**구현 난이도**: ⭐⭐

---

#### 2-9. 디바이스/국가별 AI 유입 분석

```typescript
// 디바이스별
dimensions: ["deviceCategory", "sessionSource"]
// → "mobile에서 ChatGPT 유입이 60%"

// 국가별
dimensions: ["country", "sessionSource"]
// → "한국에서 ChatGPT 유입 85%, 미국에서 15%"
```

**가치**: AI 유입의 사용자 프로파일 파악
**구현 난이도**: ⭐⭐

---

### Tier 3: 높은 가치 + 높은 난이도

#### 2-10. 랜딩페이지 콘텐츠 기반 토픽 자동 추출

현재 `/api/ai-traffic/topics`는 GSC 쿼리로 "근사치"를 제공하지만, 정확도가 낮소.

**개선 방안**: AI 유입이 많은 랜딩페이지의 **콘텐츠를 크롤링 → LLM으로 토픽 추출**

```typescript
// 프로세스
// 1. AI 유입 TOP 랜딩페이지 목록 (GA4)
// 2. 각 페이지 크롤링 (이미 crawl.ts 존재)
// 3. LLM에 "이 페이지에 AI 유저가 무엇을 찾으러 왔을지 추론" 요청

// API: GET /api/ai-traffic/inferred-topics
{
  pages: [
    {
      landing: "/shop_view/?idx=97",
      aiSessions: 10,
      inferredTopics: [
        "IgG 식품알러지 검사 키트 구매",
        "IgG 알러지 가격 비교",
        "식품과민 검사 방법"
      ],
      confidence: "medium",
      reasoning: "이 페이지는 IgG 식품알러지 검사 키트 상품 페이지로, AI 사용자들이 '식품알러지 검사'나 'IgG 검사' 관련 질문 후 유입되었을 가능성이 높음"
    }
  ]
}
```

**가치**: "AI 사용자가 무엇을 찾으러 왔는지" 최선의 추론 제공
**구현 난이도**: ⭐⭐⭐ (크롤 + LLM 연동, 비용 발생)

---

#### 2-11. AI 인용 모니터링 확장 (프롬프트 추적)

현재 `aiCitationMulti.ts`가 있으므로, 이를 확장하여:

```typescript
// 현재: "바이오컴이 AI 답변에 인용되는가?"
// 확장: "어떤 질문을 했을 때 바이오컴이 인용되는가?"

// 주기적으로 (1일 1회) 다음을 모니터링:
const MONITORING_PROMPTS = [
  "식품알러지 검사 추천",
  "IgG 검사 어디서",
  "유기산 검사 비용",
  "호르몬 검사 종류",
  "바이오컴 후기",
  // ... 핵심 키워드 30~50개
];

// 각 프롬프트에 대해 ChatGPT/Perplexity에 질문 → 바이오컴 언급 여부 확인
// → "이 키워드로 질문하면 바이오컴이 추천됨" 데이터 축적
```

**가치**: "어떤 질문을 해야 우리 사이트가 추천되는지" 직접 확인 가능
**구현 난이도**: ⭐⭐⭐ (API 비용 + 크롤링 빈도 관리)

---

#### 2-12. LLM 프롬프트 모니터링 외부 도구 연동

**전문 도구 시장이 형성되어 있음:**

| 도구 | 월 비용 | 주요 기능 |
|------|---------|----------|
| [Peec.ai](https://peec.ai/) | ~€89/월 | AI 엔진별 브랜드 가시성, 프롬프트 분석, 인용 추적 |
| [Scrunch.ai](https://scrunch.ai/) | ~$300/월 | LLM 브랜드 멘션, 센티먼트, 경쟁사 비교 |
| [AiClicks.io](https://aiclicks.io/) | 미정 | LLM SEO 분석, AEO 추적 |
| [Rankshift.ai](https://www.rankshift.ai/) | 미정 | AI 검색 순위 추적 |

**연동 방안**: 이들 도구의 API가 제공되면, 대시보드에 통합 가능

```typescript
// 예시: Peec.ai API 연동 (가정)
// GET /api/ai-monitoring/prompts
{
  monitoredPrompts: [
    {
      prompt: "식품알러지 검사 추천",
      engines: {
        chatgpt: { mentioned: true, rank: 2, sentiment: "positive" },
        perplexity: { mentioned: true, rank: 1, sentiment: "positive" },
        gemini: { mentioned: false }
      },
      lastChecked: "2026-02-25T10:00:00Z"
    }
  ]
}
```

**가치**: 프로 레벨의 AI 가시성 추적 — "어떤 프롬프트에서 우리 브랜드가 나오는가"
**구현 난이도**: ⭐⭐⭐⭐ (외부 도구 비용 + API 연동)

---

#### 2-13. 커스텀 GA4 이벤트 (사이트 측 태깅)

가장 정확하지만 사이트 코드 수정이 필요한 방법:

```javascript
// biocom.kr 사이트의 GTM/GA4 태그에 추가
// referrer가 AI 도구인 경우 커스텀 이벤트 발생

const AI_REFERRERS = ['chatgpt.com', 'perplexity.ai', 'claude.ai', 'gemini.google.com'];

if (AI_REFERRERS.some(r => document.referrer.includes(r))) {
  gtag('event', 'ai_referral_landing', {
    ai_source: new URL(document.referrer).hostname,
    landing_page: window.location.pathname,
    landing_query: window.location.search,
    // UTM 파라미터도 캡처
    utm_source: new URLSearchParams(window.location.search).get('utm_source'),
  });
}
```

**가치**: GA4에서 `ai_referral_landing` 이벤트로 정밀 추적 가능
**구현 난이도**: ⭐⭐⭐ (biocom.kr 사이트 코드 또는 GTM 수정 필요)

---

### Tier 4: 장기 비전

#### 2-14. AI 유입 vs 유기 검색 비교 리포트

```
┌────────────────────────────────────────────────────┐
│  채널 비교 (최근 30일)                              │
│                                                    │
│  지표          유기검색      AI 유입      차이      │
│  ──────────────────────────────────────────────     │
│  세션          27,671       213         -          │
│  신규 사용자    12,340       180         -          │
│  이탈률        45.2%        22.1%       AI 우수     │
│  평균 체류      1분 23초     3분 45초    AI 우수     │
│  페이지/세션    2.1          4.3         AI 우수     │
│  전환율        1.76%        15.9%       AI 월등     │
│  매출          ₩2.1M        ₩33K        -          │
│  ──────────────────────────────────────────────     │
│  결론: AI 유입은 양은 적지만 전환 품질이 매우 높음    │
└────────────────────────────────────────────────────┘
```

**가치**: 채널별 ROI 비교 → AI 최적화(AEO) 투자 근거 마련
**구현 난이도**: ⭐⭐ (데이터는 이미 있음, UI 추가만 필요)

---

#### 2-15. AI 유입 코호트 분석

```typescript
// 질문: "AI에서 처음 유입된 사용자가 30일 후에도 재방문하는가?"
// GA4 코호트 리포트 활용

dimensions: ["cohort", "cohortNthDay"]
metrics: ["cohortActiveUsers", "cohortTotalUsers"]
// cohort 정의: firstSessionSource CONTAINS AI source
```

**가치**: AI 유입 사용자의 장기 가치(LTV) 측정
**구현 난이도**: ⭐⭐⭐⭐ (GA4 코호트 API 복잡성)

---

## 3) 키워드/주제 추적 — 방법론 비교

### 3-1. 현재 방법: GSC 쿼리 근사치 (이미 구현)

```
AI 유입 랜딩페이지 (GA4) → GSC 검색어 (Google 검색) → 근사 매핑
```

**한계**: GSC 검색어는 "Google 검색"에서 온 것이지, "AI 챗봇"에서 온 것이 아님.
단순히 "이 페이지에 유입되는 검색어가 뭔가"를 보여줄 뿐.

### 3-2. 개선 방법 A: 콘텐츠 기반 토픽 추론

```
AI 유입 랜딩페이지 → 페이지 크롤링 → LLM 토픽 추출
```

- 페이지의 H1/H2, 메타 설명, 본문에서 핵심 주제 추출
- "이 페이지에 AI 유입이 있다면, 사용자가 물어봤을 법한 질문" 추론

### 3-3. 개선 방법 B: 역방향 프롬프트 모니터링

```
키워드 목록 → AI 챗봇에 질문 → 우리 사이트 인용 확인 → 매핑
```

- 이미 `aiCitationMulti.ts`에 기반이 있음
- 모니터링 키워드 풀을 확장하면 "어떤 질문에서 우리가 추천되는가" 파악 가능

### 3-4. 이상적인 방법 C: ChatGPT UTM + Referrer 정보

```
ChatGPT가 utm_source=chatgpt.com 파라미터를 붙여서 보내줌
→ 랜딩 URL의 쿼리스트링에서 파싱 가능
```

**2025년 6월부터 ChatGPT가 자동으로 UTM 파라미터를 추가**하기 시작함.
이를 파싱하면 ChatGPT 유입을 더 정확히 식별 가능.

단, **프롬프트 자체는 UTM에 포함되지 않으므로** 키워드 추적은 여전히 간접적.

---

## 4) 구현 우선순위 제안

### Phase 1: 즉시 적용 (1~2일)

| # | 기능 | 가치 | 난이도 |
|---|------|------|--------|
| 1 | GA4 참여도 지표 추가 (bounceRate, engagedSessions, newUsers 등) | 높음 | ⭐ |
| 2 | allowlist EXACT 매칭 + 신규 AI 소스 추가 | 높음 | ⭐ |
| 3 | bing.com 분리 처리 | 중간 | ⭐ |

### Phase 2: 단기 개선 (3~5일)

| # | 기능 | 가치 | 난이도 |
|---|------|------|--------|
| 4 | 일별 시계열 트렌드 차트 | 높음 | ⭐⭐ |
| 5 | AI 유입 vs 유기검색 비교 리포트 | 높음 | ⭐⭐ |
| 6 | AI 도구 카테고리 분류 | 중간 | ⭐⭐ |
| 7 | UTM 파라미터 파싱 | 중간 | ⭐⭐ |

### Phase 3: 중기 고도화 (1~2주)

| # | 기능 | 가치 | 난이도 |
|---|------|------|--------|
| 8 | AI 유입 전용 전환 퍼널 | 높음 | ⭐⭐ |
| 9 | 랜딩페이지 콘텐츠 기반 토픽 추출 (LLM) | 높음 | ⭐⭐⭐ |
| 10 | AI 인용 모니터링 프롬프트 확장 | 높음 | ⭐⭐⭐ |

### Phase 4: 장기 비전

| # | 기능 | 가치 | 난이도 |
|---|------|------|--------|
| 11 | 커스텀 GA4 이벤트 (사이트 태깅) | 매우 높음 | ⭐⭐⭐ |
| 12 | LLM 모니터링 도구 연동 (Peec.ai 등) | 매우 높음 | ⭐⭐⭐⭐ |
| 13 | AI 유입 코호트 분석 | 높음 | ⭐⭐⭐⭐ |

---

## 5) 참고 자료

- [GA4 AI/LLM Traffic Tracking Guide](https://www.getpassionfruit.com/blog/track-ai-llm-chatbot-traffic-separately-in-ga4-(step-by-step-guide))
- [How to Track AI Traffic in GA4 (2026)](https://savvy.co.il/en/blog/wordpress-seo/track-ai-traffic-google-analytics-4/)
- [Track AI Referral Traffic from ChatGPT & Perplexity](https://aperitifagency.com.au/blog/how-to-track-ai-referral-traffic-in-ga4/)
- [ChatGPT UTM Parameters Explained](https://www.lawrencehitches.com/utm-source-chatgpt-explained/)
- [Tracking AI Traffic: What's Possible and What's Not](https://www.backbone.media/insights/tracking-ai-traffic-in-ga4-whats-possible-and-whats-not)
- [How to Track, Measure, and Boost AI Referral Traffic (Semrush)](https://www.semrush.com/blog/ai-referral-traffic/)
- [Peec.ai — AI Search Analytics](https://peec.ai/)
- [Best LLM SEO Analysis Tools 2026](https://aiclicks.io/blog/best-llm-seo-analysis-tools)
- [Best AEO Tracking Tools 2026](https://aiclicks.io/blog/best-aeo-tracking-tools)

---

## 6) 업계 트렌드 참고

- AI referral 트래픽은 전체의 약 1% 수준이나 **전년 대비 50배 성장** 중
- ChatGPT가 AI referral의 78~87% 차지, Perplexity가 약 15%
- **ChatGPT 유입의 전환율은 15.9%** — Google 유기검색(1.76%) 대비 약 9배
- 2025년 6월부터 ChatGPT가 링크에 `utm_source=chatgpt.com` 자동 태깅
- AI 플랫폼들이 referrer 정보를 점점 더 잘 전달하는 추세
