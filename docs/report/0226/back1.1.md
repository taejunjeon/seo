# Step 2+3 통합 — [Codex CLI] GA4 참여도 지표 확장 + UTM 식별 + 신규/재방문 분석 + 데이터 검증

작업일: 2026-02-26
선행 완료: Step 1 (allowlist FULL_REGEXP 전환 + Bing 분리 + 테스트)
작업 대상: backend/src/ga4.ts + backend/src/server.ts

---

## 파트 A: GA4 참여도 지표 확장

### 현재 상태
queryGA4AiTrafficDetailed() (또는 AI traffic 쿼리 함수)의 metrics 배열이
sessions, activeUsers, ecommercePurchases, grossPurchaseRevenue 정도만 포함하고 있다.

### 변경 요구사항

metrics 배열에 아래를 추가해라:

```typescript
metrics: [
  // 기존
  "sessions",
  "activeUsers",
  "ecommercePurchases",
  "grossPurchaseRevenue",
  // 신규 추가
  "totalUsers",
  "newUsers",
  "engagedSessions",
  "bounceRate",
  "engagementRate",
  "averageSessionDuration",
  "screenPageViews",
]
```

### 각 지표 설명 및 주의사항

1. **bounceRate**: GA4 API가 퍼센트가 아닌 **0에서 1 사이 fraction**으로 반환한다.
   - 예: 이탈률 22.1%이면 API는 `0.221`을 반환
   - API 레벨에서 x100 변환하지 마라. 원본 fraction 값을 그대로 반환해라.
   - GA4 공식 정의: (Sessions - EngagedSessions) / Sessions

2. **engagementRate**: bounceRate의 역수 관계. 역시 fraction(0에서 1)으로 반환된다.
   - 예: 참여율 77.9%이면 `0.779`
   - bounceRate와 함께 넣으면 프론트에서 교차 검증이 가능하다.

3. **engagedSessions**: 참여 세션. 정의는 "10초 초과 체류 또는 키 이벤트 발생 또는 2페이지 이상 조회"

4. **averageSessionDuration**: 초(seconds) 단위로 반환된다.
   - 예: 225.3이면 3분 45초

5. **screenPageViews**: 총 페이지뷰 수.

### 응답 타입 업데이트

기존 응답 인터페이스에 새 필드를 추가하고, 각 필드에 JSDoc 주석으로 단위와 변환 규칙을 명시해라:

```typescript
interface AiTrafficTotals {
  sessions: number;
  activeUsers: number;
  totalUsers: number;
  /** 신규 사용자 수 */
  newUsers: number;
  /** 참여 세션 수 (10초+ 또는 키이벤트 또는 2페이지+) */
  engagedSessions: number;
  /** 이탈률 fraction (0-1). 프론트에서 x100하여 % 표시할 것 */
  bounceRate: number;
  /** 참여율 fraction (0-1). 1 - bounceRate와 근사 */
  engagementRate: number;
  /** 평균 세션 시간 (초 단위). 프론트에서 분:초로 변환 */
  averageSessionDuration: number;
  /** 총 페이지뷰 */
  screenPageViews: number;
  ecommercePurchases: number;
  grossPurchaseRevenue: number;
}
```

bySource, byLandingPage 응답에도 동일한 확장 metrics를 포함시켜라.
(모든 GA4 AI traffic 관련 쿼리에 일괄 적용)

---

## 파트 B: sessionManualSource(UTM) 기반 AI 유입 추가 식별

### 배경
ChatGPT는 2025년 6월부터 아웃바운드 링크에 `utm_source=chatgpt.com`을 자동으로 추가한다.
그런데 업계에서 `utm_source=chatgpt` (점 없는 형태)로 관측되는 경우도 있다.

GA4 Data API에는 UTM 값을 직접 조회할 수 있는 dimension이 있다:
- `sessionManualSource` → utm_source 값
- `sessionManualMedium` → utm_medium 값
- `sessionManualCampaignName` → utm_campaign 값

현재는 `sessionSource`(referrer 기반)로만 AI 유입을 식별하고 있다.
referrer가 누락되거나 변형되는 경우 UTM 기반 식별이 보완 역할을 할 수 있다.

### 구현 요구사항

#### 방법 1: 기존 함수 확장 (권장)
기존 queryGA4AiTrafficDetailed() 또는 해당 함수를 확장하여,
sessionSource 기반 결과와 sessionManualSource 기반 결과를 합산한다.

```
# 쿼리 전략 (2개 쿼리 병렬 실행 후 합산)

쿼리 1 (기존): sessionSource 기반
  dimension filter: sessionSource FULL_REGEXP 매칭 (Step 1에서 구현한 allowlist)
  → 이미 구현됨

쿼리 2 (신규): sessionManualSource 기반
  dimension: sessionManualSource
  filter: sessionManualSource FULL_REGEXP로
    - "(^|.*\\.)chatgpt\\.com$" 또는 "^chatgpt$" (점 없는 변형)
  metrics: 쿼리 1과 동일

결과 합산:
  - 두 쿼리 결과를 합치되, 동일 세션이 중복 카운팅되지 않도록 주의
  - 실무적으로 GA4에서 같은 세션이 두 쿼리 모두에 잡힐 수 있음
  - 완벽한 중복 제거는 GA4 API 한계로 불가능하므로,
    합산이 아닌 "보충(supplement)" 방식을 사용해라:
    → sessionSource 기반 결과를 주력(primary)으로 하고,
    → sessionManualSource 기반 결과에서 sessionSource가 AI allowlist에 이미 매칭된 건 제외
    → 나머지(sessionSource로는 못 잡았지만 UTM으로 잡힌 건)만 추가
```

#### 방법 2: 별도 API로 분리 (대안)
합산 로직이 복잡하면, 별도 API로 제공해도 된다:
`GET /api/ga4/ai-traffic/utm-identified`
→ UTM 기반으로만 식별된 AI 유입 (sessionSource 기반과 별개)

어느 방식이든, 구현 후 응답에 다음을 명시해라:
```typescript
{
  identification: {
    method: "referrer" | "utm" | "both",
    // "referrer": sessionSource 기반으로 식별됨
    // "utm": sessionManualSource 기반으로 식별됨  
    // "both": 양쪽 모두에서 식별됨
  }
}
```

#### 중요: 다른 AI 엔진의 UTM 정책
현재 utm_source 자동 태깅을 하는 것은 ChatGPT뿐이다.
Perplexity, Claude, Gemini 등은 UTM 자동 태깅을 하지 않으므로,
이들은 여전히 sessionSource(referrer) 기반이 유일한 식별 수단이다.
UTM 필터에 ChatGPT 관련 값만 넣어라. 다른 AI 소스를 UTM 필터에 넣으면
실제로는 사용자가 수동으로 UTM을 붙인 경우만 잡히므로 혼동된다.

---

## 파트 C: 신규 vs 재방문 사용자 분석 API

### 새 API 엔드포인트
`GET /api/ga4/ai-traffic/user-type`

### 파라미터
- `startDate` (선택, 기본: 30일 전, 형식: YYYY-MM-DD)
- `endDate` (선택, 기본: 오늘, 형식: YYYY-MM-DD)

### GA4 쿼리 구성
```
dimensions: ["newVsReturning", "sessionSource"]
metrics: [
  "sessions",
  "activeUsers",
  "engagedSessions",
  "bounceRate",
  "engagementRate",
  "averageSessionDuration",
  "ecommercePurchases",
  "grossPurchaseRevenue"
]
filter: sessionSource → Step 1의 AI allowlist FULL_REGEXP 적용
```

`newVsReturning` dimension의 반환값은 정확히 문자열 `"new"` 또는 `"returning"`이다.

### 응답 구조

```typescript
interface AiTrafficUserTypeResponse {
  period: {
    startDate: string; // "2026-01-27"
    endDate: string;   // "2026-02-26"
  };
  summary: {
    new: {
      sessions: number;
      activeUsers: number;
      engagedSessions: number;
      /** fraction (0-1) */
      bounceRate: number;
      /** fraction (0-1) */
      engagementRate: number;
      /** 초 단위 */
      averageSessionDuration: number;
      ecommercePurchases: number;
      grossPurchaseRevenue: number;
    };
    returning: {
      // new와 동일 구조
    };
  };
  /** 소스별 + 유형별 상세 */
  bySourceAndType: Array<{
    source: string;
    userType: "new" | "returning";
    sessions: number;
    activeUsers: number;
    engagedSessions: number;
    bounceRate: number;
    engagementRate: number;
    averageSessionDuration: number;
    ecommercePurchases: number;
    grossPurchaseRevenue: number;
    /** Step 1에서 추가한 트래픽 카테고리 */
    category: "ai_referral" | "search_legacy" | "organic";
  }>;
}
```

### 비즈니스 맥락
이 API는 "AI 유입이 신규 고객 확보 채널인지, 기존 고객 재유입 채널인지"를 판별하기 위한 것이다.
- new 비율이 높으면: AI가 새로운 고객을 데려오는 채널 → 투자 가치 높음
- returning 비율이 높으면: 기존 고객이 AI를 통해 재방문 → 리텐션 채널

---

## 파트 D: 데이터 검증 (실 데이터 vs mock 데이터 확인)

### 배경
기획서에 아래 비교 데이터가 있는데, 이것이 실제 biocom.kr GA4 데이터인지 
업계 벤치마크/가상 데이터인지 확인이 필요하다:

```
유기검색 세션: 27,671    | AI 유입 세션: 213
유기검색 신규: 12,340    | AI 유입 신규: 180
유기검색 이탈률: 45.2%   | AI 유입 이탈률: 22.1%
유기검색 체류: 1분 23초  | AI 유입 체류: 3분 45초
유기검색 전환율: 1.76%   | AI 유입 전환율: 15.9%
유기검색 매출: 2.1M원    | AI 유입 매출: 33K원
```

### 검증 요구사항

아래 두 가지를 수행해라:

#### 검증 1: 실제 데이터 조회
최근 30일 기준으로 아래 두 쿼리를 GA4 API에 실행하고, 실제 값을 출력해라:

```
쿼리 A - AI 유입:
  filter: sessionSource가 AI allowlist FULL_REGEXP 매칭
  metrics: sessions, totalUsers, newUsers, bounceRate, engagementRate,
           averageSessionDuration, screenPageViews,
           ecommercePurchases, grossPurchaseRevenue

쿼리 B - 유기 검색:
  filter: sessionDefaultChannelGroup = "Organic Search"
  (이 dimension이 없으면 sessionMedium = "organic"으로 대체)
  metrics: 동일
```

#### 검증 2: 결과 비교 리포트 출력
조회된 실제 데이터를 아래 형식으로 출력해라:

```
=== biocom.kr 실제 데이터 vs 기획서 수치 비교 ===
기간: [실제 조회 기간]

지표              | 기획서(AI) | 실제(AI) | 기획서(유기) | 실제(유기) | 일치여부
세션              | 213       | ???      | 27,671      | ???       | ???
신규 사용자        | 180       | ???      | 12,340      | ???       | ???
이탈률(fraction)   | 0.221     | ???      | 0.452       | ???       | ???
평균 체류(초)      | 225       | ???      | 83          | ???       | ???
전환율(계산)       | 0.159     | ???      | 0.0176      | ???       | ???
매출(원)           | 33000     | ???      | 2100000     | ???       | ???

결론: [실 데이터 / 근사치 / 완전히 다른 가상 데이터] 중 하나로 판정
```

이 검증 쿼리 실행이 기술적으로 불가능하면 (예: GA4 credential 미설정, property ID 미등록 등),
그 사유를 명시하고, 대신 `/api/ga4/ai-traffic`과 기존 GA4 쿼리를 curl로 호출하여
현재 API가 반환하는 실제 값을 출력해라.

---

## 파트 E: 에러 핸들링

### 모든 새 API 엔드포인트에 아래 에러 핸들링을 추가해라:

1. **GA4 API quota 초과** (HTTP 429 또는 RESOURCE_EXHAUSTED):
   - 응답: `{ error: "GA4 API 할당량 초과. 잠시 후 다시 시도해주세요.", retryAfter: 60 }`
   - HTTP status: 429

2. **GA4 API 인증 실패** (UNAUTHENTICATED):
   - 응답: `{ error: "GA4 인증 실패. 서비스 계정 설정을 확인하세요." }`
   - HTTP status: 401

3. **잘못된 날짜 파라미터**:
   - startDate > endDate인 경우
   - 유효하지 않은 날짜 형식인 경우
   - 응답: `{ error: "잘못된 기간 파라미터입니다.", details: "..." }`
   - HTTP status: 400

4. **데이터 없음** (정상 응답이지만 결과가 빈 경우):
   - 에러가 아닌 정상 응답으로 처리
   - 모든 값이 0인 빈 구조를 반환 (null이나 undefined가 아님)

---

## 파트 F: 테스트

### 기존 테스트 파일 확장 또는 새 테스트 파일 추가

검증 항목:
1. 확장된 metrics가 응답에 포함되는지
2. bounceRate가 0에서 1 사이 fraction인지 (100 이상이면 안 됨)
3. `/api/ga4/ai-traffic/user-type` 응답의 summary.new, summary.returning 존재 여부
4. bySourceAndType의 각 row에 category 필드가 있는지
5. 날짜 파라미터 검증 (잘못된 형식, startDate > endDate)

---

## 완료 후 확인 사항

작업 완료 후 아래를 리포트로 정리해라:

1. 변경된 파일 목록과 각 파일의 변경 요약
2. 새로 추가된 API 엔드포인트 목록
3. **파트 D의 데이터 검증 결과** (실 데이터 vs 기획서 수치 비교표)
4. 각 API의 curl 호출 예시와 실제 응답 (또는 응답 구조)
5. 테스트 실행 결과
6. 구현 중 발견된 이슈나 판단이 필요한 사항

---

## 주의사항 총정리

- bounceRate/engagementRate는 fraction(0-1)으로 반환된다. API 레벨에서 x100 하지 마라.
- averageSessionDuration은 초 단위다.
- sessionManualSource와 sessionSource는 별개 dimension이다.
- UTM 자동 태깅은 현재 ChatGPT만 한다. 다른 AI 엔진은 UTM 필터에 넣지 마라.
- ChatGPT UTM은 "chatgpt.com"과 "chatgpt" 두 변형 모두 매칭해라.
- newVsReturning dimension 값은 "new" 또는 "returning" 문자열이다.
- 데이터 없는 경우 null이 아닌 0으로 채워서 반환해라.
- Step 1에서 추가한 categorizeTrafficSource() 함수를 재사용하여 category 필드를 채워라.
- 두 개 이상의 GA4 쿼리를 실행할 때는 Promise.all로 병렬 처리하여 응답 속도를 최적화해라.