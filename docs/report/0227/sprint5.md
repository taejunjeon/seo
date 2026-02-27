# Sprint 5 구현 결과 (2026-02-27)

목표: `roadmap0226.md`의 **Phase 3-B / 3-C**(신규 API + AI 유입 고도화) 백엔드 기능을 구현하고, 프론트 연동 가능한 형태로 응답을 표준화합니다.

---

## 5.1 Comparison API 고도화 (YoY / MoM)

### 변경 사항

- `GET /api/comparison`
  - 신규 파라미터: `compare=previous|yoy|mom` (기본: `previous`)
  - 응답에 `compare`, `range.current`, `range.previous` 추가
  - 캐시 키에 `compare` 포함(잘못된 캐시 혼용 방지)

### 날짜/기간 계산(테스트 포함)

- 신규 유틸:
  - `backend/src/utils/isoDate.ts` — ISO 날짜 shift(일/월/년) + clamp(월말/윤년)
  - `backend/src/utils/compareRanges.ts` — `compare` 모드별 current/previous 기간 산출(기간 길이 유지)
- 테스트:
  - `backend/tests/iso-date.test.ts`

---

## 5.2 키워드 인텐트 가중치(서버 사이드)

현황: 이미 서버에서 가중치 기반 집계가 가능하도록 구현되어 있었음.

- `GET /api/keywords/intent?weight=clicks|impressions|count` (기본: `clicks`)
- 구현 위치:
  - `backend/src/routes/ai.ts`
  - `backend/src/intent.ts` (`weightedBy`, `totalClicks`, `totalImpressions` 포함)

---

## 5.3 AI 유입 전용 전환 퍼널

### 신규 API

- `GET /api/ga4/ai-funnel`
  - 파라미터:
    - `period=7d|30d|90d|custom` (기본: `30d`)
    - `startDate/endDate` (custom일 때, `YYYY-MM-DD`)
    - `referralOnly=1` (선택)
    - `refresh=1` (캐시 무시)
  - 퍼널 단계(세션 기준):
    1) AI 유입 세션 (`sessions`)
    2) 참여 세션 (`engagedSessions`)
    3) 상품 조회 (`view_item`)
    4) 장바구니 (`add_to_cart`)
    5) 결제 시작 (`begin_checkout`)
    6) 구매 (`purchase`)
  - 추가 정보:
    - `overallConversion`, `biggestDropoff`
    - GA4 미설정/인증 실패 시 **200 + empty meta + 0값 구조**로 반환(프론트 안정 렌더링)
  - 캐시: 30분 (in-memory + Redis 옵션)

---

## 5.4 랜딩페이지 토픽 추출 (LLM)

### 신규 API

- `GET /api/ai/landing-topics`
  - 입력: GA4 AI 유입 상위 랜딩페이지 + (best-effort) GSC 상위 검색어
  - 파라미터:
    - `startDate/endDate` (기본: 최근 30일)
    - `topPages` (기본: 8, 최대 20)
    - `topQueries` (기본: 3, 최대 10)
    - `referralOnly=1` (선택)
    - `method=llm|heuristic` (기본: `llm`, 단 OPENAI 미설정 시 `heuristic` 자동 전환)
    - `refresh=1` (캐시 무시)
  - 출력:
    - `topics[]`, `summary`, `likelyQuestions[]`
  - 캐시: 6시간 (in-memory + Redis 옵션, `_meta.source/expiresAt/ttl` 포함)

---

## 5.5 AI vs Organic 비교 리포트

### 신규 API

- `GET /api/ga4/ai-vs-organic`
  - 파라미터:
    - `period=7d|30d|90d|custom` (기본: `30d`)
    - `startDate/endDate` (custom일 때)
    - `referralOnly=1` (선택)
    - `refresh=1` (캐시 무시)
  - 출력:
    - `ai`, `organic` 각각 동일 지표 + 파생 지표(`pagesPerSession`, `conversionRate`, `purchaseConversionRate`)
    - GA4 미설정/인증 실패 시 **200 + empty meta + 0값 구조**로 반환
  - 캐시: 30분 (in-memory + Redis 옵션)

---

## 변경 파일

- `backend/src/routes/gsc.ts`
- `backend/src/utils/isoDate.ts`
- `backend/src/utils/compareRanges.ts`
- `backend/tests/iso-date.test.ts`
- `backend/src/ga4.ts`
- `backend/src/routes/ga4.ts`
- `backend/src/routes/ai.ts`

---

## 검증

- Backend 타입체크: `cd backend && npm run typecheck` ✅
- Backend 테스트: `cd backend && node --test --import tsx tests/*.test.ts` ✅

---

## 후속 작업(제안)

- 프론트 연동:
  - `/api/comparison?compare=yoy|mom` 변화율 UI 반영
  - `/api/ga4/ai-funnel`, `/api/ga4/ai-vs-organic`, `/api/ai/landing-topics` 탭/카드 추가
- Phase 3-C 잔여:
  - GTM/사이트 태깅 기반 커스텀 이벤트(정밀 AI referrer 감지)

