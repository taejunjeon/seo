# Callprice 프론트 UXUI 구현 — 완료 보고

작업일: 2026-03-28
작업자: Claude Code

---

## 1. 읽은 파일과 현재 제약 요약

### 읽은 파일
1. `roadmap0327.md` — Revenue CRM 로드맵, ChannelTalk v1 실행 레이어 우선 전략
2. `callprice.md` — 상담사 가치 산출 계획, V1 지표 정의, 비교군 규칙, 상담사 귀속 규칙
3. `callaction.md` — 상담 대기 손실 리드 추정 액션 플랜, 필요 로그 필드 정의
4. `api.md` — ChannelTalk/기타 API 상태
5. `backend/src/routes/callprice.ts` — 5개 API 엔드포인트 (options, overview, managers, analysis-types, scenario)
6. `backend/src/callprice.ts` — 코호트 산출 로직, SQL 쿼리, 타입 정의
7. `frontend/src/app/layout.tsx` — Root Layout
8. `frontend/src/app/page.tsx` — 기존 메인 대시보드 (탭 기반 SPA)
9. `frontend/src/components/common/ChannelTalkProvider.tsx` — ChannelTalk SDK 부트

### 핵심 제약
- **기존 `/` 메인 페이지 변경 불가** → 별도 `/callprice` 라우트로 구현
- **`revenue` 코드 수정 불가** → 참조만, 실제 구현은 `seo/frontend`
- **`callprice`는 실데이터 연결 가능** → API 5개 모두 정상 응답 확인
- **`wait-loss`는 placeholder** → 로그 부족으로 최종 KPI 불가, "데이터 준비 중" UX
- **공식 ROI 금지** → `준증분 매출`, `매출배수`, `인건비 차감 후 잔여매출` 용어 통일
- **`estimated_incremental_profit`** → 화면상 `인건비 차감 후 잔여매출`로 표현

### 실제 API 응답 확인 결과

| API | 응답 | 주요 수치 |
|---|---|---|
| `GET /api/callprice/options` | 200 | 상담사 10명, 분석유형 13종 |
| `GET /api/callprice/overview?maturity_days=90&start_date=2025-04-01&end_date=2026-03-27` | 200 | 준증분 매출 2.24억, 전환율 26.1%, 상담 1건 가치 56,690원 |
| `GET /api/callprice/managers?maturity_days=90&...` | 200 | 민정 36.2%(점유), 예진 30.5%, 경태 12.2% |
| `GET /api/callprice/analysis-types?maturity_days=90&...` | 200 | 유기산 상담 1건 가치 167,971원(최고), 알러지 40,477원 |
| `GET /api/callprice/scenario?monthly_cost=4000000&headcount=1&...` | 200 | 매출배수 0.78x, 잔여매출 -90만원 |

---

## 2. 구현 구조

### Route / Component / Hook 구조

```
frontend/src/
├── app/
│   └── callprice/
│       ├── page.tsx          ← 메인 대시보드 컴포넌트 (신규)
│       └── page.module.css   ← CSS Module (신규)
├── types/
│   └── callprice.ts          ← API 응답 타입 정의 (신규)
└── hooks/
    └── useCallpriceData.ts   ← 데이터 fetch 훅 (신규)
```

### 설계 결정
- **별도 라우트** `/callprice`: 기존 메인 페이지 침범 없음
- **타입 분리**: `types/callprice.ts`에 모든 API 타입 정의 (CohortSummary, Envelope, 각 엔드포인트별 Response)
- **훅 분리**: `hooks/useCallpriceData.ts`에 `useCallpriceData` + `useCallpriceOptions` 두 개 훅
- **CSS Module**: 기존 globals.css 디자인 토큰 재사용, 글래스모피즘 헤더, 반응형(모바일/태블릿)
- **API 직접 호출**: `NEXT_PUBLIC_API_BASE_URL` 기반, `AbortController` cleanup

---

## 3. 생성/수정 파일 상세

### 3-1. `frontend/src/types/callprice.ts` (신규 — 157줄)

API 응답 타입:
- `CallpriceEnvelope<TData, TMeta>` — 공통 래퍼 (status, data, meta, notes)
- `CohortSummary` — 코호트 지표 11개 필드 (completed_consultations, unique_completed_customers, matched_order_customers, matured_customers, converted_customers, conversion_rate, avg_revenue_per_customer, baseline_avg_revenue_per_customer, estimated_incremental_value_per_customer, estimated_incremental_revenue, estimated_value_per_consultation)
- `CallpriceOptionsResponse` — 옵션 API 응답
- `CallpriceOverviewResponse` — 오버뷰 API 응답
- `CallpriceManagersResponse` — 상담사별 API 응답 (+ sample_warning, share 필드)
- `CallpriceAnalysisTypesResponse` — 분석유형별 API 응답
- `CallpriceScenarioResponse` — 시나리오 API 응답
- `CallpriceParams` / `CallpriceDataResult` / `CallpriceOptionsResult` — 훅 입출력 타입

### 3-2. `frontend/src/hooks/useCallpriceData.ts` (신규 — 178줄)

두 개의 훅:
1. **`useCallpriceData(params)`**: overview + managers + analysis-types + scenario + options를 `Promise.all`로 병렬 호출. params 변경 시 자동 재호출. `AbortController` cleanup.
2. **`useCallpriceOptions()`**: options 엔드포인트만 마운트 시 1회 호출.

### 3-3. `frontend/src/app/callprice/page.tsx` (신규 — 약 400줄)

화면 구성 (상단→하단 순서):

| 섹션 | 내용 |
|---|---|
| **Header** | 글래스모피즘 sticky 헤더, "← 대시보드로 돌아가기" 링크, "상담사 가치 분석" 제목 |
| **Controls Bar** | 시작일/종료일, 성숙 기간(30/60/90/180일), 비교군, 상담사, 분석유형 선택 |
| **Hero Summary** | 3칸 카드: 준증분 매출 추정, 상담 1건당 가치, N일 전환율 |
| **해석 블록** | "상담의 핵심 효과는 구매 진입률 상승에 더 가깝다" + 매출배수 |
| **시나리오 시뮬레이션** | 월 인건비/충원 인원 입력 → 월 준증분 매출, 매출배수, 인건비 차감 후 잔여매출, 손익분기 인건비 |
| **상담사별 성과** | 테이블: 상담사, 완료 상담, 성숙 고객, 전환율, 고객당 매출, 준증분/고객, 준증분 매출, 상담 1건 가치, 매출 점유, 샘플 등급 |
| **분석유형별 비교** | 테이블: 분석유형, 완료 상담, 성숙 고객, 전환율, 고객당 매출, 비교군 매출, 준증분/고객, 준증분 매출, 상담 1건 가치, 샘플 등급 |
| **코호트 비교** | 6칸 카드: 상담군/미상담군 고객당 매출, 매출배수, 준증분 가치/고객, 전환율, 주문 매칭 |
| **Wait-Loss Placeholder** | 점선 테두리 섹션: "데이터 준비 중", 필요 로그 필드 5개 명시, 추후 추정 예정 안내 |
| **API 주석** | 백엔드 `notes` 배열 (준증분 추정 면책, read-only 면책, maturity 미도달 제외 안내) |

주요 구현 포인트:
- 모든 숫자는 한국식 표기 (`fmtKRW`: 억/만 단위, `fmtKRWFull`: 천 단위 콤마, `fmtPct`, `fmtMultiple`)
- 시나리오 섹션에 "공식 ROI로 사용하지 말고" 경고 문구 포함
- `estimated_incremental_profit` → 화면상 "인건비 차감 후 잔여매출"
- `incremental_revenue_multiple` → "매출배수"
- 양수/음수에 따른 컬러 분기 (green/red)
- 로딩/에러 상태 분리
- 에러 시 "재시도" 버튼

### 3-4. `frontend/src/app/callprice/page.module.css` (신규 — 약 500줄)

기존 대시보드 디자인 토큰 재사용:
- 글래스모피즘 헤더 (`backdrop-filter: blur(12px)`)
- 카드 (`border-radius: 12px`, `box-shadow`)
- 해석 블록 (좌측 accent 보더)
- Wait-loss placeholder (점선 테두리, 경고 아이콘)
- CSS spinner 애니메이션
- 반응형: `@media (max-width: 768px)` 단일 컬럼, `@media (max-width: 1024px)` 2열 카드

---

## 4. 용어 통일 확인

| 내부 API 필드 | 화면 표시 |
|---|---|
| `estimated_incremental_revenue` | 준증분 매출 추정 |
| `incremental_revenue_multiple` | 매출배수 |
| `estimated_incremental_profit` | 인건비 차감 후 잔여매출 |
| `estimated_incremental_value_per_customer` | 준증분 가치/고객 |
| `estimated_value_per_consultation` | 상담 1건당 가치 |
| `conversion_rate` | N일 전환율 |
| `avg_revenue_per_customer` | 고객당 매출 |
| `baseline_avg_revenue_per_customer` | 비교군 고객당 매출 |

---

## 5. 검증 결과

| 항목 | 결과 |
|---|---|
| `npm run lint` (신규 파일) | ✅ 에러/워닝 0 |
| `npm run build` | ✅ 성공 — `/callprice` 라우트 등록 확인 |
| TypeScript 타입 체크 | ✅ 통과 |
| `/callprice` HTTP 접속 | ✅ 200 OK (0.89초) |
| `/` 기존 메인 페이지 | ✅ 200 OK (0.14초) — 변경 없음 |
| API 연결 (overview) | ✅ 200 OK — 실데이터 응답 |
| API 연결 (managers) | ✅ 200 OK — 상담사 데이터 응답 |
| API 연결 (analysis-types) | ✅ 200 OK |
| API 연결 (scenario) | ✅ 200 OK |
| 모바일 반응형 | ✅ CSS 미디어쿼리 적용 (실제 디바이스 미확인) |
| wait-loss 섹션 | ✅ placeholder로 구현, "데이터 준비 중" 표시 |
| 공식 ROI 오해 방지 | ✅ 모든 시나리오/추정치에 면책 문구 포함 |

---

## 6. 남은 리스크

1. **실제 브라우저 테스트 미수행** — curl 200 확인만 한 상태. 실제 렌더링/데이터 바인딩/스타일은 브라우저에서 확인 필요.
2. **revenue 참조 화면과의 숫자 비교** — revenue 포털의 LTR/상담전환률과 callprice 추정치가 약간 다를 수 있음 (maturity 기준, 비교군 설계 차이).
3. **CSS 디테일** — 기존 대시보드와 100% 동일한 시각 톤앤매너는 실제 화면에서 미세 조정 필요할 수 있음.
4. **wait-loss 로그 부재** — 이 섹션은 로그가 쌓여야만 실제 데이터로 전환 가능.
5. **분석유형 비교군** — `analysis_type_non_consultation` 옵션은 검사 유형 매핑 안정화 후 의미가 커짐.

---

## 7. 다음 액션

### TJ님이 해야 할 것
1. **브라우저에서 `http://localhost:7010/callprice` 접속** → 실제 화면 확인
2. **UX 피드백** → 카드 배치/해석 문구/테이블 컬럼 순서 조정

### Codex가 백엔드에서 해줘야 할 것
- 현재 5개 API 모두 정상 동작하므로 당장 백엔드 추가 작업은 없음.
- 다만 **wait-loss 로그 적재** (`lead_created_at`, `slot_assigned_at`, `connected_at`, `lost_reason`, `reschedule_count`)가 시작되면, 해당 데이터를 제공하는 새 API가 필요할 것임.
