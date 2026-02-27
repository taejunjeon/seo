# feedback0226back1.1 작업 결과 (2026-02-26)

TJ님, `feedback0226back1.1.md` 기준으로 Step 2+3(참여도 지표 확장 + ChatGPT UTM 보완 식별 + 신규/재방문 분석 API + 데이터 검증 + 테스트/에러핸들링)까지 반영했습니다.

---

## 1) 변경된 파일 / 변경 요약

### `backend/src/ga4.ts`
- **AI traffic 참여도 지표 확장(파트 A)**  
  - `/api/ga4/ai-traffic`에서 사용하는 `queryGA4AiTrafficDetailed()` 리포트의 metrics를 확장:
    - 기존: `sessions`, `activeUsers`, `ecommercePurchases`, `grossPurchaseRevenue`
    - 추가: `totalUsers`, `newUsers`, `engagedSessions`, `bounceRate`, `engagementRate`, `averageSessionDuration`, `screenPageViews`
  - **주의사항 준수**
    - `bounceRate`, `engagementRate`는 **0~1 fraction 그대로 반환** (x100 변환 없음)
    - `averageSessionDuration`는 **초(seconds)**

- **GA4 metrics 10개 제한 대응(파트 A 구현 중 발견사항)**  
  - GA4 Data API는 요청당 metrics가 **최대 10개 제한** → 11개 메트릭 요청 시 `INVALID_ARGUMENT` 발생
  - 해결: **2개 요청(main/commerce)으로 분리** 후 dimension key 기준으로 merge
    - main(9): `sessions, activeUsers, totalUsers, newUsers, engagedSessions, bounceRate, engagementRate, averageSessionDuration, screenPageViews`
    - commerce(3): `sessions, ecommercePurchases, grossPurchaseRevenue`

- **ChatGPT UTM 기반 보완 식별(파트 B)**  
  - `sessionManualSource`(utm_source) FULL_REGEXP로 아래 패턴 매칭:
    - `(^|.*\.)chatgpt\.com$`
    - `^chatgpt$`
  - **보충(supplement) 방식 적용 (중복 방지)**  
    - UTM 쿼리는 `NOT(sessionSource allowlist)`를 추가하여 **이미 referrer(sessionSource)로 잡힌 세션을 제외**
  - 응답에 `identification.method: "referrer" | "utm" | "both"` 포함

- **AI 신규/재방문 분석 쿼리 추가(파트 C)**  
  - `queryGA4AiTrafficUserType()` 신규 추가
  - `newVsReturning` + `sessionSource` 기반 breakdown + ChatGPT UTM supplement까지 반영
  - `category: TrafficCategory` 포함(이미 Step1에서 만든 `categorizeTrafficSource()` 재사용)
  - 실데이터에서 `newVsReturning`이 `"new"|"returning"` 외에 `"(not set)"`이 반환되는 케이스가 있어,
    - **응답 summary/bySourceAndType는 스펙대로 new/returning만 유지**
    - 대신 `debug.notes`에 **(not set) 행 존재**를 기록(누락 위험 안내)

- **totals 파싱 안정화(구현 중 발견 이슈)**  
  - GA4 Data API가 `metricAggregations` 미요청 시 `totals`가 비어있는 케이스가 있어,
  - no-dimension totals 요청은 `rows[0]` 우선으로 파싱 + `totals[0]` fallback을 추가.

### `backend/src/dateRange.ts` (신규)
- `startDate/endDate` **YYYY-MM-DD 검증** + **startDate <= endDate 검증** 유틸 추가(테스트 가능하도록 분리)

### `backend/src/server.ts`
- **신규 API 추가(파트 C)**: `GET /api/ga4/ai-traffic/user-type`
  - 기본 기간: `startDate=30일 전`, `endDate=오늘`
  - 날짜 검증: 잘못된 형식 / startDate > endDate → 400
  - GA4 미설정 → 200 + **0값 구조** 반환(프론트 안정 렌더 목적)
  - GA4 quota 초과/인증 실패 → 429/401 매핑(파트 E)

### 테스트 추가/수정(파트 F)
- `backend/tests/ga4-ai-traffic-step2-3.test.ts` (신규)
  - 확장 metrics 포함 여부
  - bounceRate fraction(0~1) 보장
  - user-type 응답에서 summary.new/returning 존재
  - bySourceAndType row에 category 존재
  - 날짜 파라미터 검증
- `backend/tests/ga4-traffic-category.test.ts` (수정)
  - env 고정 문제 방지 위해 static import 제거 → dynamic import로 변경

---

## 2) 새로 추가된 API 엔드포인트

- `GET /api/ga4/ai-traffic/user-type`
  - Query:
    - `startDate` (옵션, 기본 30일 전, YYYY-MM-DD)
    - `endDate` (옵션, 기본 오늘, YYYY-MM-DD)
    - `limit` (옵션, 기본 200, 1~500)

---

## 3) 파트 D — 실데이터 검증 결과(최근 30일)

실행 기준(요청서 그대로):
- **쿼리 A(AI 유입)**: `sessionSource`가 AI allowlist FULL_REGEXP 매칭
- **쿼리 B(유기 검색)**: `sessionDefaultChannelGroup = "Organic Search"`
- 기간: **2026-01-27 ~ 2026-02-26**
- 전환율(계산): `ecommercePurchases / sessions`

```
=== biocom.kr 실제 데이터 vs 기획서 수치 비교 ===
기간: 2026-01-27 ~ 2026-02-26
유기 검색 필터: sessionDefaultChannelGroup=Organic Search

지표 | 기획서(AI) | 실제(AI) | 기획서(유기) | 실제(유기) | 일치여부
---|---:|---:|---:|---:|:---:
세션 | 213 | 215 | 27,671 | 18,611 | 부분(AI O, 유기 X)
신규 사용자 | 180 | 16 | 12,340 | 11,802 | 부분(유기 O, AI X)
이탈률(fraction) | 0.221 | 0.0837 | 0.452 | 0.0182 | X
평균 체류(초) | 225 | 1007.5048 | 83 | 243.803 | X
전환율(계산) | 0.159 | 0.0047 | 0.0176 | 0.0117 | X
매출 | 33,000 | 32,980.0 | 2,100,000 | 63,056,637.0 | 부분(AI O, 유기 X)
```

추가 실측(참고):
- AI: `totalUsers=25`, `screenPageViews=506`, `ecommercePurchases=1`, `grossPurchaseRevenue≈32,980`
- Organic: `totalUsers=14,276`, `screenPageViews=39,873`, `ecommercePurchases=218`, `grossPurchaseRevenue≈63,056,637`

판정(요청서 3지선다 기준):
- **결론: 근사치**  
  - AI **세션/매출은 매우 근접**하지만, AI 신규/이탈률/체류/전환 및 유기 매출 등은 **큰 폭으로 불일치**합니다.  
  - 따라서 기획서 수치는 “완전한 실데이터 그대로”라기보다는, **일부 실데이터 기반 + 기간/지표정의/필터 차이(또는 가공/벤치마크)가 섞인 근사치**로 판단합니다.

---

## 4) curl 호출 예시(구조 확인용)

### AI 트래픽(상세)
```bash
curl \"http://localhost:7020/api/ga4/ai-traffic?startDate=2026-01-27&endDate=2026-02-26&limit=20\"
```
- 응답 핵심 필드:
  - `totals.sessions`, `totals.totalUsers`, `totals.newUsers`, `totals.engagedSessions`
  - `totals.bounceRate`(0~1), `totals.engagementRate`(0~1), `totals.averageSessionDuration`(sec)
  - `totals.screenPageViews`, `totals.ecommercePurchases`, `totals.grossPurchaseRevenue`
  - `identification.method` (referrer/utm/both)
  - `bySource[]`, `byLandingPage[]`에도 동일 메트릭 확장 반영

### AI 유입 신규/재방문
```bash
curl \"http://localhost:7020/api/ga4/ai-traffic/user-type?startDate=2026-01-27&endDate=2026-02-26\"
```
- 응답 핵심 필드:
  - `summary.new`, `summary.returning`
  - `bySourceAndType[]` 각 row에 `category` 포함
  - `debug.notes`에 (not set) 등 예외 케이스 기록 가능

에러 케이스:
```bash
# 날짜 형식 오류
curl \"http://localhost:7020/api/ga4/ai-traffic/user-type?startDate=2026/01/01&endDate=2026-02-26\"
# startDate > endDate
curl \"http://localhost:7020/api/ga4/ai-traffic/user-type?startDate=2026-02-26&endDate=2026-01-27\"
```

---

## 5) 테스트 실행 결과

```bash
npm --prefix backend run typecheck
cd backend && node --import tsx --test tests/*.test.ts
```
- 결과: **pass 4 / fail 0**

---

## 6) 구현 중 발견된 이슈/판단 포인트

1) **GA4 Data API metrics 10개 제한**  
   - AI 트래픽 리포트는 11개 이상 필요 → main/commerce 2회 호출 후 merge로 해결

2) **GA4 runReport의 totals 비어있음 이슈**  
   - no-dimension totals 집계에서 `totals`가 비어있는 응답 케이스 확인  
   - `rows[0]` 우선 파싱(+ `totals[0]` fallback)으로 안정화

3) **newVsReturning이 "(not set)"으로 반환되는 실데이터 존재**  
   - 스펙은 new/returning만 가정하지만, 실제로는 `(not set)` 행이 나와 purchase/revenue가 그쪽으로 잡히는 케이스 확인  
   - 응답 스펙은 유지하면서 `debug.notes`로 누락 위험을 남김
