# Phase 4 진행 보고서 — 재구매 코호트 · 북극성 지표

> **Phase 4**: 재구매 코호트 · 북극성 지표
> **최종 업데이트**: 2026-04-02
> **담당**: Codex (백엔드/설계) + Claude Code (프론트/UXUI)

---

## 스프린트별 완성도

| Sprint | 목표 | 완성도 | 핵심 남은 것 |
|--------|------|--------|-----------|
| **P4-S1** | 코호트 재구매율/순매출 API · 결제채널/상품 분해 | **95%** | 상품 카테고리 필터 연결 (ops DB 매핑 불안정), 마진 데이터 |
| **P4-S2** | 코호트 히트맵/테이블 프론트 · 북극성 지표 카드 | **90%** | 월별 코호트 히트맵(M+N), 실험 라벨 오버레이 |

---

## 10초 요약

회사 북극성 지표 **"환불 반영 90일 재구매 순매출"**이 운영 중이다. `/cohort` 페이지에서 성숙도별 비교(30/60/90/180/365일), 분기별 추이, 분석유형별 가치 비교를 볼 수 있다. 남은 10%는 월별 코호트 히트맵과 실험 라벨 오버레이(P7과 연결).

---

## 회사 북극성 지표

### 정의

**90일 재구매 순이익 (Repeat Gross Profit 90D)**

- 재구매율만 보면 객단가/마진이 빠짐
- 총매출만 보면 acquisition/할인/자기잠식이 섞임
- 90일 재구매 순이익은 "충성고객이 실제로 남기는 가치"를 봄

### 현재 임시 대체지표

**환불 반영 90일 재구매 순매출** (마진 데이터 확보 전까지)

```
North Star = 성숙 고객 수 × 고객당 증분 가치
           = [matured_customers] × ₩[estimated_incremental_value_per_customer]
           = ₩[estimated_incremental_revenue]
```

### 실측 데이터 (2026-03-29 기준)

| 항목 | 값 |
|------|-----|
| 조건 | 2025-11 ~ 2026-01 코호트, 90일 성숙, toss_card |
| 코호트 수 | 3개 |
| 전체 고객 | 2,872명 |
| 성숙 코호트 | 2개 |
| 성숙 고객 | 1,831명 |
| **90일 재구매 순매출** | **₩45,134,699** |

---

## 백엔드 API (P4-S1)

### 구현 완료 API

| 엔드포인트 | 용도 | 상태 |
|-----------|------|------|
| `GET /api/callprice/overview` | 성숙도별(30/60/90/180/365일) 북극성 요약 | ✅ |
| `GET /api/callprice/managers` | 상담사별 코호트 성과 | ✅ |
| `GET /api/callprice/analysis-types` | 분석유형별 코호트 성과 | ✅ |
| `GET /api/callprice/options` | 필터 옵션 (상담사, 분석유형, 범위) | ✅ |
| `GET /api/callprice/scenario` | 채용 시뮬레이션 | ✅ |
| `GET /api/callprice/daytype-comparison` | 평일/주말 비교 | ✅ |
| `GET /api/callprice/supplement-purchase-timing` | 첫 영양제 구매 타이밍 | ✅ |
| `GET /api/callprice/supplement-repeat-pattern` | 영양제 재구매 패턴 | ✅ |
| `GET /api/callprice/subscription-status` | 구독 현황 | ✅ |
| `GET /api/callprice/rampup` | 신규 상담사 온보딩 | ✅ |
| `GET /api/crm/repeat-purchase-cohorts` | 월별 첫구매 코호트 재구매율 (Revenue 백엔드) | ✅ (95%) |

### 핵심 메트릭

| 메트릭 | 설명 |
|--------|------|
| `completed_consultations` | 코호트 내 상담 완료 수 |
| `matured_customers` | 성숙 기간 경과 고객 수 |
| `converted_customers` | 재구매 고객 수 |
| `conversion_rate` | 전환율 (%) |
| `avg_revenue_per_customer` | 상담 고객 평균 매출 |
| `baseline_avg_revenue_per_customer` | 비상담 고객 평균 매출 (비교 기준) |
| `estimated_incremental_value_per_customer` | 상담 효과 (증분) |
| `estimated_incremental_revenue` | **북극성 근사치** — 총 증분 매출 |
| `estimated_value_per_consultation` | 상담 1건당 추정 가치 |

### 필터

| 파라미터 | 설명 | 예시 |
|---------|------|------|
| `maturity_days` | 성숙 기간 | 30, 60, **90** (기본), 180, 365 |
| `start_date` | 시작일 | 2025-11-01 |
| `end_date` | 종료일 | 2026-01-31 |
| `start_month` / `end_month` | 코호트 월 범위 | 2025-11, 2026-01 |
| `first_payment_channel` | 첫 결제 채널 | toss_card |
| `discount_used` | 할인 사용 여부 | true/false |

---

## 프론트엔드 (`/cohort` 페이지) (P4-S2)

**파일**: `frontend/src/app/cohort/page.tsx` (433줄)

### 구현 완료 UI

| 컴포넌트 | 설명 | 상태 |
|---------|------|------|
| **북극성 카드** | 환불 반영 90일 재구매 순매출 대형 숫자 | ✅ |
| **실행 지표 그리드** (4 KPI) | 팀 OMTM, 식별 매칭률, 90일 전환율, 매출 배수 | ✅ |
| **성숙도 비교 테이블** | 30/60/90/180/365일 × 9컬럼, 90일 하이라이트 | ✅ |
| **분기별 추이 차트** | 증분 매출 바차트 + 전환율/상담가치 듀얼축 라인 | ✅ |
| **분석유형별 비교** | 수평 바차트 + 상세 테이블 (표본 크기 등급) | ✅ |
| **해석 가이드** | 성숙 기간, 전환 동태, 관찰 한계 설명 | ✅ |

### 미구현

| 컴포넌트 | 우선순위 | 의존 |
|---------|---------|------|
| **월별 코호트 히트맵** (M+0, M+1, M+2...) | MEDIUM | P4-S1 route 등록 |
| **실험 라벨 오버레이** (treatment/control) | LOW | P7-S3 연결 |

---

## 데이터 흐름

```
운영 DB (tb_consultation_records, tb_iamweb_users)
  → callprice API (SQL 집계)
  → /api/callprice/overview?maturity_days=90
  → /cohort 페이지 (React)
  → 북극성 카드 + 차트 + 테이블
```

---

## 해석 주의사항

1. **성숙 기간이 길수록 성숙 고객이 적다** — 최근 코호트가 아직 도달하지 않았기 때문
2. **전환율과 매출은 성숙 기간이 길수록 보통 올라간다** — 구매 기회가 더 많으므로
3. **이 숫자는 관찰 추정치이지 인과 증명이 아니다** — 인과 검증은 Phase 7 증분 실험에서
4. **마진 데이터가 없어서 순이익이 아닌 순매출로 대체** — 마진 확보 시 진짜 북극성으로 전환

---

## 다른 Phase와의 관계

| Phase | Phase 4와의 관계 |
|-------|-----------------|
| **P1-S1A** (결제 귀속) | 코호트 재구매를 결제 원장과 조인하면 UTM별 코호트 성과 분석 가능 |
| **P2** (상담 가치) | callprice API가 Phase 4의 백엔드 기반. 상담사별 코호트 = P2의 확장 |
| **P3** (실행 채널) | 알림톡/채널톡 발송 후 재구매 코호트 변화를 추적하면 CRM 효과 측정 |
| **P7** (증분 실험) | 코호트에 실험 라벨(treatment/control)을 얹으면 인과적 증분 판정 가능 |

---

## 남은 작업

### 단기 (P4 마감)

| # | 작업 | 담당 | 우선순위 |
|---|------|------|---------|
| 1 | 월별 코호트 히트맵 프론트 구현 | Claude Code | MEDIUM |
| 2 | P4-S1 코호트 전용 API route 등록 (Codex) → 프론트 연결 | Codex → Claude Code | MEDIUM |

### 중기 (P7 연결)

| # | 작업 | 담당 | 의존 |
|---|------|------|------|
| 3 | 코호트에 실험 라벨(treatment/control/campaign_id) 얹기 | Codex (P7-S3) | P7 실험 시작 |
| 4 | 실험별 코호트 비교 차트 | Claude Code | #3 |

### 장기 (마진 확보 후)

| # | 작업 | 의존 |
|---|------|------|
| 5 | 순매출 → **순이익**(Gross Profit)으로 북극성 전환 | 원가/마진 데이터 확보 |
| 6 | 상품 카테고리별 코호트 분해 | ops DB 카테고리 매핑 안정화 |

---

## 파일 위치

| 파일 | 용도 |
|------|------|
| `backend/src/routes/callprice.ts` | callprice API 10개 엔드포인트 |
| `frontend/src/app/cohort/page.tsx` | /cohort 페이지 (433줄) |
| `frontend/src/types/callprice.ts` | API 응답 타입 정의 |
| `frontend/src/app/callprice/page.tsx` | /callprice 상담사 가치 분석 대시보드 (P2) |
