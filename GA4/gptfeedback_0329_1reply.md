# GPT 피드백 대응 개발 결과 (2026-03-29)

> **원본 피드백**: `GA4/gptfeedback_0329_1.md`
> **작업자**: Claude Code
> **작업일**: 2026-03-29

---

## 요청 내용 요약

GPT 피드백 문서는 현재 대시보드에 대해 6가지 핵심 개선과 3가지 질문(Q1-Q3)을 제안했다:

### 피드백 핵심 6가지
1. **맨 위를 "돈" 중심으로 바꿔라** — 매출/구매수/전환율/객단가/세션당매출/리포트조회당매출
2. **페이지 표를 "페이지 그룹"으로 묶어라** — content_group 기반 분류
3. **이탈률 해석 주의** — Landing page 기준으로 따로 볼 것
4. **AI/SEO 카드를 매출순 정렬** — 세션순 대신 매출/세션으로
5. **데이터 품질 경고 박스를 만들어라** — 중복 URL, (not set), 파라미터 분산, purchase/checkout 비정상, page_view 누락
6. **"다음 행동"이 안 보인다** — 각 카드에 액션 추천

### 질문 Q1-Q3
- Q1: 최근 30일 view_item → add_to_cart → begin_checkout → add_payment_info → purchase 디바이스별 수치
- Q2: /report, /reportPC, /shop_view, /shop_payment 세션 리플레이
- Q3: Search Console 상위 검색어 20개 + AI referrer별 landing page export

---

## 개발 완료 내역

### 1. Backend: GA4 전자상거래 퍼널 디바이스별 API

**파일**: `backend/src/ga4.ts` (함수 `queryGA4EcommerceFunnelByDevice`)
**라우트**: `GET /api/ga4/ecommerce-funnel-by-device`

- **기능**: GA4 Data API를 호출하여 `view_item → add_to_cart → begin_checkout → add_payment_info → purchase` 5단계 전자상거래 퍼널을 **디바이스별(mobile/desktop/tablet)** 로 집계
- **응답 구조**:
  ```json
  {
    "_meta": { "type": "live", ... },
    "range": { "startDate": "...", "endDate": "..." },
    "devices": [
      {
        "device": "mobile",
        "steps": [
          { "name": "상품 조회", "event": "view_item", "count": 1234, "conversionRate": 100 },
          { "name": "장바구니", "event": "add_to_cart", "count": 456, "conversionRate": 37.0 },
          ...
        ],
        "overallConversion": 2.1,
        "biggestDropoff": { "from": "상품 조회", "to": "장바구니", "dropRate": 63.0 }
      },
      { "device": "desktop", ... },
      { "device": "tablet", ... }
    ],
    "allDevices": { "steps": [...], "overallConversion": ..., "biggestDropoff": {...} },
    "debug": { "notes": [...] }
  }
  ```
- **파라미터**: `startDate`, `endDate` (기본 최근 30일)
- **GA4 미설정 시**: 200 + 빈 구조 반환 (프론트 안정성 확보)

---

### 2. Backend: 매출 중심 KPI API

**파일**: `backend/src/ga4.ts` (함수 `queryGA4RevenueKpi`)
**라우트**: `GET /api/ga4/revenue-kpi`

- **반환 지표 6개**:
  | 지표 | 필드 | 설명 |
  |------|------|------|
  | 매출 | `totalRevenue` | grossPurchaseRevenue 합계 |
  | 구매 수 | `totalPurchases` | ecommercePurchases 합계 |
  | 구매 전환율 | `purchaseConversionRate` | purchases / sessions × 100 |
  | 객단가 | `averageOrderValue` | revenue / purchases |
  | 세션당 매출 | `revenuePerSession` | revenue / sessions |
  | 리포트 조회당 매출 | `revenuePerReportView` | revenue / (pagePath ^/report 조회수) |

- **리포트 조회수**: `pagePath FULL_REGEXP ^/report`로 `screenPageViews` 집계
- **파라미터**: `startDate`, `endDate`

---

### 3. Backend: 데이터 품질 진단 API

**파일**: `backend/src/ga4.ts` (함수 `queryGA4DataQuality`)
**라우트**: `GET /api/ga4/data-quality`

- **진단 항목 5가지**:
  | 항목 | ID | 심각도 | 기준 |
  |------|----|--------|------|
  | 중복 URL(trailing slash 등) | `duplicate_urls` | warning | 1그룹 이상 |
  | (not set) 랜딩 비율 | `not_set_landing` | warning/error | >5%=warning, >15%=error |
  | 쿼리 파라미터 분산 | `query_param_dispersion` | warning | >10% |
  | purchase > begin_checkout 비정상 | `checkout_anomaly`/`checkout_missing` | error/warning | 구매 > 결제시작 |
  | page_view 부족 | `page_view_missing` | warning | 세션당 PV < 1 |

- **종합 점수**: 100점 만점, error당 -20, warning당 -10, info당 -5
- **응답에 stats 객체 포함**: 세부 수치를 프론트에서 직접 활용 가능

---

### 4. Backend: 페이지 그룹(content_group) 분류 유틸리티

**파일**: `backend/src/utils/pageGroup.ts`
**라우트**: `GET /api/ga4/page-groups`

- **9개 그룹 분류**:
  | 그룹 | 라벨 | 매칭 패턴 예시 |
  |------|------|--------------|
  | `home` | 홈 | `/` |
  | `store_category` | 스토어/카테고리 | `/shop`, `/HealthFood`, `/_store` |
  | `product_detail` | 상품 상세 | `/shop_view`, `/product_view` |
  | `report` | 리포트/결과 | `/report`, `/reportPC` |
  | `member` | 회원 | `/login`, `/mypage`, `/signup` |
  | `checkout` | 결제 | `/shop_payment`, `/cart`, `/checkout` |
  | `seo_article` | SEO 콘텐츠 | `/blog`, `/health`, `/guide` |
  | `ai_landing` | AI 랜딩 | `/ai-landing`, `/chatgpt` |
  | `partner_lp` | 제휴/파트너 | `/partner`, `/lp`, `/promotion` |

- **집계 기능**: `aggregateByPageGroup()` — 그룹별 세션/사용자/매출/구매/이탈률/상위페이지 집계
- GA4 engagement 데이터와 결합하여 "어느 덩어리가 돈을 버는가" 파악 가능

---

### 5. Frontend: 매출 핵심 KPI 카드 섹션

**파일**: `frontend/src/components/dashboard/RevenueKpiSection.tsx` + `.module.css`
**위치**: OverviewTab 최상단 (AEO/GEO 점수 아래, 추세 차트 위)

- 6개 매출 KPI를 반응형 그리드로 표시
- 자체 `fetch`로 `/api/ga4/revenue-kpi` 호출
- 로딩/에러 상태 처리
- 글래스모피즘 카드 디자인 (기존 대시보드 스타일 일관)

---

### 6. Frontend: 데이터 품질 경고 박스

**파일**: `frontend/src/components/dashboard/DataQualityAlert.tsx` + `.module.css`
**위치**: OverviewTab, 매출 KPI 아래, 추세 차트 위

- 접기/펼치기 아코디언 UI
- 종합 점수 + 이슈 수 표시 (헤더)
- 각 이슈를 severity별 색상 배지로 표시 (ERROR=빨강, WARN=주황, INFO=파랑)
- GA4 미설정 또는 이슈 0건이면 숨김 처리
- 비필수 컴포넌트 — API 실패 시 조용히 숨김

---

## 검증 결과

| 검증 항목 | 결과 |
|----------|------|
| Backend TypeScript 타입 체크 | **통과** |
| Frontend TypeScript 타입 체크 | **통과** |
| Frontend lint | **통과** (기존 경고 16개, 새 코드에서 에러 없음) |
| 실제 UI 동작 | **미검증** — 서버 실행 후 확인 필요 |
| 실제 GA4 데이터 | **미검증** — GA4 credential 설정 후 확인 필요 |

---

## Q1-Q3 답변

### Q1. 최근 30일 view_item → add_to_cart → begin_checkout → add_payment_info → purchase 수치 (디바이스별)

**답변**: 이번 개발에서 정확히 이 데이터를 제공하는 API를 구현했다.

```
GET /api/ga4/ecommerce-funnel-by-device?startDate=2026-02-27&endDate=2026-03-28
```

이 API는 GA4 Data API를 통해 5단계 전자상거래 퍼널을 **mobile / desktop / tablet** 별로 집계하여 반환한다.

**주의사항**:
- GA4에 해당 이벤트가 실제로 수집되고 있어야 한다.
- `add_payment_info` 이벤트는 많은 사이트에서 누락되는 경우가 있다. DebugView에서 먼저 확인 권장.
- GA4 Data API는 공식 Funnel 차원이 없어서, 각 eventName별 eventCount를 단계 값으로 사용한다 (세션 기반이 아닌 이벤트 기반). 실제 퍼널 분석은 GA4 Explore > Funnel exploration이 더 정확하지만, API로는 이 방식이 최선이다.

**현재 상태**: GA4_PROPERTY_ID와 GA4_SERVICE_ACCOUNT_KEY가 설정되어 있으면 즉시 조회 가능. 서버 시작 후 해당 엔드포인트를 호출하면 된다.

---

### Q2. /report, /reportPC, /shop_view, /shop_payment 세션 리플레이

**답변**: 현재 시스템에서 세션 리플레이는 제공하지 않는다.

**이유**:
- 세션 리플레이는 Hotjar, Microsoft Clarity, FullStory, Mouseflow 같은 전용 도구가 필요하다.
- GA4 자체에는 세션 리플레이 기능이 없다.
- 현재 대시보드에 Hotjar/Clarity 연동은 없다.

**대안으로 현재 시스템에서 제공 가능한 것**:
1. **PageSpeed Insights 스크린샷**: `backend/scripts/capture-dashboard.ts` — 페이지 렌더링 스냅샷 제공
2. **GA4 engagement 데이터**: `/api/ga4/engagement` — 해당 페이지들의 세션수, 이탈률, 스크롤 깊이, 체류시간 제공
3. **GA4 경로 데이터**: `/api/ga4/page-groups` — 페이지 그룹별 집계 (이번에 추가됨)

**권장 액션**:
- **Microsoft Clarity (무료)** 를 설치하는 것을 추천. 세션 리플레이 + 히트맵을 무료로 제공하며, GA4와 연동도 가능하다.
- 설치 후 `/report`, `/reportPC`, `/shop_view`, `/shop_payment` 페이지에서 세션 리플레이 5-10개를 관찰하면, 어디서 사용자가 이탈하거나 혼란을 느끼는지 직접 확인할 수 있다.

---

### Q3. Search Console 상위 검색어 20개 + AI referrer별 landing page export

**답변**: 현재 시스템에서 **두 가지 모두 제공 가능**하다.

#### Search Console 상위 검색어 20개

기존 GSC API가 이미 구현되어 있다:
```
GET /api/gsc/search-analytics?dimensions=query&rowLimit=20&startDate=2026-02-27&endDate=2026-03-28
```

이 API는 Google Search Console에서 상위 검색어를 clicks 기준 내림차순으로 반환한다.
필드: `query`, `clicks`, `impressions`, `ctr`, `position`

#### AI referrer별 landing page raw export

기존 AI Traffic API가 이미 `byLandingPage` 배열을 반환한다:
```
GET /api/ga4/ai-traffic?startDate=2026-02-27&endDate=2026-03-28&limit=50
```

응답의 `byLandingPage` 배열에 AI referrer 유입별 랜딩 페이지와 세션수/사용자수/구매수/매출이 포함되어 있다.

또한 AI 유입 랜딩 페이지별 GSC 상위 검색어를 매칭한 데이터도 있다:
```
GET /api/ai-traffic/topics?topPages=20&topQueries=5
```

**현재 상태**: GSC_SERVICE_ACCOUNT_KEY와 GA4 설정이 되어 있으면 즉시 조회 가능.

---

## 남은 리스크

1. **GA4 이벤트 수집 미확인**: 실제로 `view_item`, `add_to_cart`, `begin_checkout`, `add_payment_info`, `purchase` 이벤트가 GA4에 정상 수집되고 있는지 DebugView로 확인 필요
2. **페이지 그룹 분류 정합성**: biocom.kr의 실제 URL 구조와 분류 규칙의 정합성을 실제 데이터로 검증 필요. 맞지 않는 패턴이 있으면 `backend/src/utils/pageGroup.ts`의 RULES 배열 수정
3. **세션 리플레이 부재**: 세션 리플레이 없이는 UX 문제의 근본 원인 파악이 어려움. Clarity 설치 권장
4. **실서버 테스트 미완**: 개발은 완료했으나, 실제 서버에서 GA4 데이터와 함께 동작하는 것은 아직 미검증

---

## 다음 할 일

### 즉시 (오늘)
- [ ] 서버 재시작 후 새 API 4개 동작 확인
- [ ] GA4 DebugView에서 ecommerce 이벤트(view_item, add_to_cart, begin_checkout, purchase) 수집 여부 확인
- [ ] `/api/ga4/ecommerce-funnel-by-device`로 Q1 데이터 실제 조회
- [ ] `/api/gsc/search-analytics?dimensions=query&rowLimit=20`으로 Q3 상위 검색어 조회
- [ ] `/api/ga4/ai-traffic?limit=50`으로 Q3 AI landing page 조회
- [ ] 대시보드에서 매출 KPI 카드와 데이터 품질 경고 박스 실제 렌더링 확인

### 이번 주
- [ ] AI/SEO 카드 정렬 기준을 매출/세션으로 변경 (프론트엔드 AiTrafficByLandingTable 수정)
- [ ] 각 카드에 "다음 액션" 추천 텍스트 추가 (피드백 6번 항목)
- [ ] 페이지 그룹 집계를 프론트엔드 탭 또는 섹션으로 시각화
- [ ] Microsoft Clarity 설치 → 세션 리플레이 Q2 답변 보완
- [ ] URL 통합 규칙 확정 (trailing slash 등) → GA4/GTM 측 수정

### 다음 배치
- [ ] `content_group` GTM 변수로 GA4에 직접 전송 (서버사이드가 아닌 수집 단계에서 분류)
- [ ] report 기반 개인화 추천 모듈 기획 및 구현
- [ ] AI/SEO 질문군별 답변형 LP 템플릿 제작
- [ ] Landing page x source/medium x device x revenue/session 전용 리포트 뷰 구축
- [ ] 상품 기준(item_name, item_category) 전자상거래 매출 리포트 구현

---

## 변경 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `backend/src/ga4.ts` | `queryGA4EcommerceFunnelByDevice`, `queryGA4RevenueKpi`, `queryGA4DataQuality` 3개 함수 추가 |
| `backend/src/routes/ga4.ts` | 4개 API 엔드포인트 추가: `/ecommerce-funnel-by-device`, `/revenue-kpi`, `/data-quality`, `/page-groups` |
| `backend/src/utils/pageGroup.ts` | 페이지 그룹 분류 유틸리티 **신규 생성** |
| `frontend/src/components/dashboard/RevenueKpiSection.tsx` | 매출 KPI 카드 섹션 **신규 생성** |
| `frontend/src/components/dashboard/RevenueKpiSection.module.css` | 스타일 **신규 생성** |
| `frontend/src/components/dashboard/DataQualityAlert.tsx` | 데이터 품질 경고 박스 **신규 생성** |
| `frontend/src/components/dashboard/DataQualityAlert.module.css` | 스타일 **신규 생성** |
| `frontend/src/components/tabs/OverviewTab.tsx` | RevenueKpiSection, DataQualityAlert import 및 배치 |
| `GA4/gptfeedback_0329_1reply.md` | 이 문서 **신규 생성** |
