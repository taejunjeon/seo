# AEO/GEO Score 실데이터 전환 — 기능 기획서

> **작성일**: 2026-02-13
> **목적**: 오버뷰의 AEO Score(78), GEO Score(65) Mock을 실측 데이터로 전환하기 위한 개발 계획
> **대상 사이트**: biocom.kr (건강기능식품 / YMYL 카테고리)

---

## 1. 현재 상태

### Mock 데이터 (하드코딩)
```typescript
const SCORES = [
  { label: "AEO Score", score: 78, delta: 3.2 },   // 고정값
  { label: "GEO Score", score: 65, delta: 5.1 },    // 고정값
];
```

### 이미 가용한 실데이터
| 데이터 소스 | 상태 | AEO/GEO 활용 가능 항목 |
|------------|------|----------------------|
| GSC API | ✅ 연동 완료 | Q&A 키워드 9개 자동 감지, 기회 키워드 1개, 키워드별 CTR/순위 |
| PageSpeed API | ✅ 연동 완료 | 기술 성능 점수 (SEO 92점, Performance 34점) |
| GA4 API | ⚠️ GCP 활성화 필요 | 체류시간, 이탈률, 전환율 (코드는 준비됨) |

### 현재 감지되는 biocom.kr 키워드 분석 (최근 7일)
- **Q&A 키워드 9개**: "테아닌 효능", "sibo 증상", "리포좀 비타민c 차이", "l-테아닌 부작용", "sibo 치료", "글리신 효능" 등
- **기회 키워드 1개**: "멜라토닌" (노출 3,213회, CTR 0.19% — 높은 노출 대비 클릭 극히 저조)
- **총 키워드**: 50개 추적 중

---

## 2. AEO Score란? (Answer Engine Optimization)

AI 답변 엔진(ChatGPT, Perplexity, Claude 등)이 **우리 콘텐츠를 답변 소스로 인용**하는 정도를 측정하는 점수.

### 2.1 AEO Score 구성 요소 (100점 만점)

| 구성 요소 | 가중치 | 측정 방법 | 현재 가능 여부 |
|-----------|--------|----------|--------------|
| **Q&A 키워드 커버리지** | 20점 | Q&A 키워드 수 / 전체 키워드 수 × 비례 | ✅ 즉시 가능 (GSC Q&A 자동분류) |
| **구조화 데이터 (Schema)** | 20점 | FAQPage, HowTo, Speakable 스키마 존재 여부 | 🔧 개발 필요 (페이지 크롤링) |
| **Featured Snippet 획득율** | 15점 | GSC searchAppearance로 Featured Snippet 추적 | 🔧 개발 필요 (GSC API 확장) |
| **콘텐츠 구조 품질** | 15점 | H2-H3 계층, 목록/테이블 사용, 인용 포함 여부 | 🔧 개발 필요 (페이지 크롤링) |
| **AI 인용 빈도** | 20점 | ChatGPT/Perplexity에서 biocom.kr 인용 비율 | 💰 유료 API 필요 |
| **AI 유입 트래픽** | 10점 | GA4에서 AI 플랫폼 referral 추적 | ⚠️ GA4 활성화 필요 |

### 2.2 각 구성 요소 상세

#### A. Q&A 키워드 커버리지 (20점) — ✅ 즉시 구현 가능
```
점수 = (Q&A 키워드 수 / 전체 키워드 수) × 20
현재: (9 / 50) × 20 = 3.6점
```
- 이미 백엔드에 Q&A 자동분류 패턴 25개 구현됨
- "효능", "증상", "부작용", "치료", "차이" 등 패턴 매칭 중

#### B. 구조화 데이터 (20점) — 🔧 크롤링 개발 필요
biocom.kr 페이지를 크롤링하여 다음 Schema 마크업 존재 여부를 확인:
- `FAQPage` — FAQ 섹션이 있는지 (AI 답변 소스 채택 가능성 3.2배 증가)
- `HowTo` — 방법 설명이 구조화되어 있는지
- `Article` + `author` — E-E-A-T 저자 정보가 있는지
- `MedicalWebPage` — YMYL 의료 콘텐츠 마크업

**필요 개발**:
- 백엔드에 `/api/crawl/schema` 엔드포인트 추가
- cheerio 또는 puppeteer로 HTML 파싱
- JSON-LD / microdata 추출

#### C. Featured Snippet 획득율 (15점) — 🔧 GSC API 확장
GSC API의 `searchAppearance` 차원을 활용하여 Featured Snippet 획득 키워드를 추적.

**필요 개발**:
```typescript
// server.ts에 추가
const result = await queryGscSearchAnalytics({
  dimensions: ["query", "searchAppearance"],
  // searchAppearance 값: RICH_RESULT, FAQ_RICH_RESULT 등
});
```

#### D. 콘텐츠 구조 품질 (15점) — 🔧 크롤링 개발 필요
페이지 HTML을 분석하여:
- H2/H3 헤딩 계층 구조가 올바른지
- 목록(`<ul>`, `<ol>`)이 충분히 사용되는지
- 표(`<table>`)로 비교 정보가 제공되는지
- 인용(`<blockquote>` 또는 출처 표기)이 있는지

#### E. AI 인용 빈도 (20점) — 💰 유료 API 필요
ChatGPT, Perplexity 등에 건강 관련 프롬프트를 보내고, 응답에서 biocom.kr이 인용되는지 확인.

**방법 옵션**:
| 방법 | 월 비용 | 정확도 |
|------|---------|--------|
| SerpAPI (Google AI Overview 추출) | ~$50 | 높음 |
| Perplexity Search API | 무료~$50 | 높음 (Perplexity만) |
| ChatGPT API로 직접 쿼리 | ~$20 | 중간 (ChatGPT 인용율 16%) |
| Profound/Otterly 상용 플랫폼 | $200~500 | 매우 높음 |

#### F. AI 유입 트래픽 (10점) — ⚠️ GA4 활성화 후 가능
GA4에서 AI 플랫폼 referral을 추적:
```
chatgpt.com, chat.openai.com, perplexity.ai, claude.ai, gemini.google.com
```
**주의**: AI 트래픽의 30~40%는 referral 헤더가 없어 "Direct"로 잡힘.

---

## 3. GEO Score란? (Generative Engine Optimization)

구글 AI Overview, Bing Copilot 등 **생성형 검색 결과에서 우리 콘텐츠가 노출**되는 정도를 측정하는 점수.

### 3.1 GEO Score 구성 요소 (100점 만점)

| 구성 요소 | 가중치 | 측정 방법 | 현재 가능 여부 |
|-----------|--------|----------|--------------|
| **AI Overview 노출율** | 25점 | 우리 키워드 중 AI Overview가 뜨고, 우리가 인용되는 비율 | 💰 유료 SERP API 필요 |
| **검색 순위 기반 점수** | 20점 | TOP 3 키워드 비율 (AI Overview는 상위 결과 우선 인용) | ✅ 즉시 가능 (GSC) |
| **Schema 마크업 커버리지** | 20점 | FAQPage, Article, Speakable 등 | 🔧 크롤링 필요 |
| **콘텐츠 신뢰도 신호** | 15점 | 출처 인용, 통계 수치 포함, 전문가 인용 포함 여부 | 🔧 크롤링 필요 |
| **기술 성능 (CWV)** | 10점 | PageSpeed Performance + CWV 통과율 | ✅ 즉시 가능 |
| **CTR 트렌드** | 10점 | CTR 변화율 (AI Overview 영향 프록시) | ✅ 즉시 가능 (GSC) |

### 3.2 각 구성 요소 상세

#### A. AI Overview 노출율 (25점) — 💰 유료 SERP API 필요
구글 검색 결과에서 AI Overview가 표시될 때, 우리 사이트가 출처로 인용되는 비율.

**현실**: 구글은 GSC API에서 AI Overview 데이터를 **별도로 제공하지 않음** (2026년 2월 현재).
Google의 John Mueller가 공식적으로 GSC에 AI Overview 필터가 없다고 확인.

**필요 외부 API**:
- **SerpAPI** ($50/월~): `ai_overview` 데이터 + `references` 배열 제공
- **DataForSEO** ($50/월~): `ai_overview_element` + 인용 URL 제공

#### B. 검색 순위 기반 점수 (20점) — ✅ 즉시 구현 가능
AI Overview는 상위 검색 결과를 우선 인용하므로, 순위 자체가 GEO의 프록시.
```
TOP 3 키워드 비율 = (순위 3 이하 키워드 수 / 전체) × 20
현재: 약 6/50 = 2.4점 (추정)
```

#### C~D. Schema + 콘텐츠 신뢰도 — AEO Score의 B, D항과 동일 (크롤링 필요)

#### E. 기술 성능 (10점) — ✅ 즉시 구현 가능
```
CWV 점수 = PageSpeed Performance / 10
현재: 34 / 10 = 3.4점
```

#### F. CTR 트렌드 (10점) — ✅ 즉시 구현 가능
AI Overview가 많아지면 CTR이 하락하는 경향. CTR 변화를 추적하여 AI 영향을 간접 측정.

---

## 4. 개발 로드맵 — 단계별 구현

### Phase A: 무료 데이터만으로 부분 점수 산출 (즉시 개발 가능)

**비용: $0 | 개발: 1-2일 | AEO ~40점/100 계산 가능, GEO ~40점/100 계산 가능**

| 작업 | 데이터 소스 | 구현 내용 |
|------|-----------|----------|
| Q&A 키워드 비율 → AEO 20점 | GSC keywords API | 이미 존재. 비율 계산만 추가 |
| 검색 순위 기반 → GEO 20점 | GSC keywords API | TOP 3/TOP 10 키워드 비율 계산 |
| CWV 기술 점수 → GEO 10점 | PageSpeed API | Performance 점수 변환 |
| CTR 트렌드 → GEO 10점 | GSC KPI API | 전주 대비 CTR 변화율 |

**결과**: AEO/GEO 점수를 부분적으로 실데이터화 (나머지는 "측정 불가" 표시)

### Phase B: 페이지 크롤링으로 콘텐츠 분석 추가 (개발 필요)

**비용: $0 (cheerio npm) | 개발: 2-3일 | AEO ~75점/100 계산 가능, GEO ~60점/100 계산 가능**

| 작업 | 구현 내용 |
|------|----------|
| Schema 마크업 감지 | 백엔드에 `/api/crawl/schema` — cheerio로 JSON-LD 파싱 |
| 콘텐츠 구조 분석 | H2/H3 계층, 목록/테이블 수, 인용 블록 감지 |
| Featured Snippet 추적 | GSC searchAppearance 차원 활용 |

**필요 npm**: `cheerio` (HTML 파서, 가벼움)

**백엔드 엔드포인트 추가**:
```
POST /api/crawl/analyze   — URL의 Schema + 콘텐츠 구조 분석
GET  /api/aeo/score       — AEO 종합 점수 계산
GET  /api/geo/score       — GEO 종합 점수 계산
```

### Phase C: GA4 연동으로 AI 유입 추적 (TJ님 액션 필요)

**비용: $0 | 선결 조건: GCP에서 GA4 Data API 활성화 | AEO ~85점/100 계산 가능**

| 작업 | 구현 내용 |
|------|----------|
| AI referral 트래픽 추적 | GA4에서 `chatgpt.com`, `perplexity.ai` 등 소스 필터링 |
| 체류시간/이탈률 | 콘텐츠 품질 간접 지표 |

### Phase D: 유료 SERP API로 AI 인용 직접 측정 (선택)

**비용: $50~200/월 | AEO/GEO 100점 모두 측정 가능**

| 옵션 | 비용 | 제공 데이터 |
|------|------|-----------|
| **SerpAPI** | $50/월 (5,000 검색) | Google AI Overview 인용 URL + 텍스트 |
| **DataForSEO** | $50/월 (종량제) | AI Overview + ChatGPT 스크래핑 |
| **Perplexity API** | 무료~$50/월 | Perplexity 인용 확인 |
| **ChatGPT API** | ~$20/월 | 직접 프롬프트 테스트 |

**참고**: Perplexity는 응답의 97%에서 출처를 인용 (평균 21.87개 소스), ChatGPT는 16%만 인용.

---

## 5. Phase A 즉시 구현 설계 (무료)

### 5.1 AEO Score 산출 공식

```typescript
// 현재 즉시 계산 가능한 항목만으로 부분 점수 산출
const calculateAeoScore = (data: {
  qaKeywordRatio: number;      // Q&A 키워드 / 전체 키워드
  avgPosition: number;          // 평균 순위
  topKeywordsInTop3: number;    // TOP 3 키워드 비율
}) => {
  // Q&A 커버리지 (20점)
  const qaScore = Math.min(20, Math.round(data.qaKeywordRatio * 100));

  // 검색 가시성 (순위 프록시, 20점 — 원래 Featured Snippet이지만 프록시로 대체)
  const visibilityScore = Math.min(20, Math.round(data.topKeywordsInTop3 * 20));

  // 나머지 항목 (Schema, 콘텐츠 구조, AI 인용, AI 유입)은 Phase B-D에서 추가
  const measuredScore = qaScore + visibilityScore;
  const measuredMax = 40; // 현재 측정 가능한 최대 점수

  return {
    score: measuredScore,
    maxPossible: measuredMax,
    normalized: Math.round((measuredScore / measuredMax) * 100), // 0~100으로 정규화
    breakdown: { qaScore, visibilityScore },
    unmeasured: ["Schema 마크업", "콘텐츠 구조", "AI 인용", "AI 유입 트래픽"],
  };
};
```

### 5.2 GEO Score 산출 공식

```typescript
const calculateGeoScore = (data: {
  topKeywordsInTop3: number;    // TOP 3 키워드 비율
  performanceScore: number;     // PageSpeed Performance (0~100)
  ctrDelta: number;             // CTR 변화율 (%)
}) => {
  // 검색 순위 기반 (20점)
  const rankScore = Math.min(20, Math.round(data.topKeywordsInTop3 * 20));

  // 기술 성능 (10점)
  const techScore = Math.min(10, Math.round(data.performanceScore / 10));

  // CTR 트렌드 (10점)
  const ctrScore = Math.min(10, Math.max(0, Math.round(5 + data.ctrDelta)));

  const measuredScore = rankScore + techScore + ctrScore;
  const measuredMax = 40;

  return {
    score: measuredScore,
    maxPossible: measuredMax,
    normalized: Math.round((measuredScore / measuredMax) * 100),
    breakdown: { rankScore, techScore, ctrScore },
    unmeasured: ["AI Overview 노출", "Schema 마크업", "콘텐츠 신뢰도"],
  };
};
```

### 5.3 프론트엔드 표시 방법

현재 Mock 78/100, 65/100 대신:
```
AEO Score: 23/40 (57점/100 환산)
  ✅ Q&A 키워드 커버리지: 4/20
  ✅ 검색 가시성: 19/20
  ⬜ Schema 마크업: 측정 대기 (Phase B)
  ⬜ 콘텐츠 구조: 측정 대기 (Phase B)
  ⬜ AI 인용: 측정 대기 (Phase D)
  ⬜ AI 유입: 측정 대기 (Phase C)
```

---

## 6. 미해결 이슈 및 제약사항

### 6.1 구글 GSC의 AI Overview 데이터 미제공 (Critical)
- 구글은 GSC API에서 AI Overview를 **별도 필터로 제공하지 않음**
- "web" 검색 타입에 AI Overview 클릭/노출이 통합되어 있어 분리 불가
- 이는 Google의 John Mueller가 공식 확인한 사항
- **영향**: GEO Score의 "AI Overview 노출율" (25점)을 무료로 측정할 방법 없음
- **대안**: SerpAPI/DataForSEO 유료 API 사용 ($50/월~)

### 6.2 AI 인용 추적의 불안정성
- ChatGPT는 응답의 **16%**에서만 출처를 인용 → biocom.kr 인용 확률 매우 낮음
- Perplexity는 **97%** 인용하지만, 한국어 건강 콘텐츠의 인용 패턴은 미지수
- AI 응답은 비결정적 (같은 질문에 다른 답변) → 점수가 측정 시마다 변동

### 6.3 GA4 API 미활성화 (TJ님 액션 필요)
- GA4 Data API가 GCP에서 활성화되지 않아 AI referral 트래픽 측정 불가
- **해결**: https://console.developers.google.com/apis/api/analyticsdata.googleapis.com/overview?project=196387225505 에서 활성화

### 6.4 Schema 마크업 크롤링 시 주의사항
- biocom.kr이 서버사이드 렌더링인지 클라이언트사이드인지에 따라 크롤링 방법이 달라짐
- CSR인 경우 cheerio로는 부족하고 Puppeteer/Playwright 필요 (서버 리소스 소모 큼)
- YMYL 콘텐츠는 Schema 요구사항이 더 엄격함

### 6.5 AEO/GEO 업계 표준 부재
- 2026년 현재 AEO/GEO 점수의 **업계 표준 산출 방법이 없음**
- 각 벤더(Conductor, Profound, Otterly)가 자체 기준 사용
- 우리의 점수 산출 방식은 자체 설계이므로, 외부 비교가 어려움
- **대안**: 산출 근거를 투명하게 공개하고, 주간 변동 추이로 활용

### 6.6 biocom.kr 모바일 성능 문제 (GEO Score 영향)
- PageSpeed 모바일 Performance 34점 → GEO 기술 점수가 3.4/10으로 낮음
- LCP 37.5초, FCP 13.3초로 구글 기준 "Poor" → AI Overview 선택 가능성 하락
- **영향**: 기술 점수가 GEO Score를 끌어내리는 주요 요인

---

## 7. 비용 요약

| 단계 | 월 비용 | AEO 측정 범위 | GEO 측정 범위 | 개발 기간 |
|------|---------|-------------|-------------|----------|
| Phase A (무료 API) | $0 | 40/100 (2개 항목) | 40/100 (3개 항목) | 1-2일 |
| Phase B (크롤링) | $0 | 75/100 (4개 항목) | 60/100 (4개 항목) | 2-3일 |
| Phase C (GA4) | $0 | 85/100 (5개 항목) | 60/100 | TJ님 액션 |
| Phase D (유료 API) | $50-200 | 100/100 (전체) | 100/100 (전체) | 2-3일 |

### 권장 순서
1. **Phase A 즉시 진행** → 무료로 부분 점수 산출 시작
2. **Phase C GA4 활성화** → TJ님 액션 필요 (5분 소요)
3. **Phase B 크롤링 개발** → Schema + 콘텐츠 분석
4. **Phase D는 선택** → 비용 대비 효과 판단 후 결정

---

## 8. 참고 자료

- [Conductor 2026 AEO/GEO 벤치마크 보고서](https://www.conductor.com/academy/aeo-geo-benchmarks-report/) — 13,770개 도메인, 1억건 AI 인용 분석
- [Princeton GEO 연구 논문 (arXiv:2311.09735)](https://arxiv.org/pdf/2311.09735) — GEO 학술 기반 정의
- [SerpAPI AI Overview API](https://serpapi.com/ai-overview) — Google AI Overview 추출
- [DataForSEO SERP API](https://dataforseo.com/pricing/serp) — AI Overview + ChatGPT 모니터링
- [GetCito (오픈소스 AEO/GEO 도구)](https://github.com/ai-search-guru/getcito-worlds-first-open-source-aio-aeo-or-geo-tool)
- [Google AI Features 공식 문서](https://developers.google.com/search/docs/appearance/ai-features)

---

*본 문서는 Claude Code (헤파이스토스) AI Agent가 웹 리서치 기반으로 작성하였소.*
