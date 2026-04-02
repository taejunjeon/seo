# 상담 CRM Read-only API 명세 1.0

기준일: 2026-03-27  
우선순위: P0  
목적: 스키마 변경 없이 상담 원장 데이터를 CRM 실험 후보군과 상담사 가치 분석에 바로 연결한다.

## 1. 왜 이 작업이 지금 가장 파급력이 큰가

현재 상태는 아래와 같다.

- 프론트: ChannelTalk SDK v1 안전 부트 완료
- 백엔드: ChannelTalk Access Key/Secret 검증 완료
- 운영 DB: `tb_consultation_records` 8,305건, 상담 연락처와 LTR 코호트 매칭 5,055건

즉, 외부 계정 추가 발급이나 DB 스키마 변경 없이도 바로 만들 수 있는 가장 큰 레버리지는 `상담 원장 API`다.

이 작업을 먼저 하면 동시에 3가지를 연다.

1. 상담 후속 CRM 실험 후보군 정의
2. 상담사 가치 분석 1차 대시보드
3. 이후 `ltr_customer_cohort.manager` 승인 변경 전의 추정 분석 기반

## 2. 범위

이번 스프린트 범위:

- 읽기 전용 API만 구현
- DB 스키마 변경 없음
- 전화번호 정규화 join 기반
- 상담 상태 표준화는 코드 내부 규칙으로 우선 적용
- 프론트 구현은 포함하지 않음

이번 스프린트 비범위:

- `ltr_customer_cohort.manager` 컬럼 추가
- 비용 테이블 생성
- 자동 발송 활성화
- Meta/Kakao/ChannelTalk outbound 실행

## 3. 데이터 소스

- 상담 원장: `public.tb_consultation_records`
- 주문 원장: `public.tb_iamweb_users`
- LTR 코호트: `public.ltr_customer_cohort`
- 보조 식별: `public.channeltalk_users`

## 4. 공통 규칙

### 4-1. 전화번호 정규화

```text
normalized_phone
= regexp_replace(value, '[^0-9]', '', 'g')
```

빈 문자열은 매칭 대상에서 제외한다.

### 4-2. 상담 상태 표준화

초기 코드 규칙:

- `completed`
  - `완료`, `상담완료`, `(변경)완료`, `완료.`
- `no_answer`
  - `부재`
- `rescheduled`
  - `변경`, `시간 변경`, `시간변경`, `변경/채팅`
- `canceled`
  - `취소`, `보류`, `중복`
- `other`
  - 그 외 문자열
- `unknown`
  - `nan`, `-`, 빈 값, null

### 4-3. 기간 필터

- 기본값:
  - `startDate`: 최근 90일 시작일
  - `endDate`: 오늘
- 기준 컬럼:
  - 상담: `insertdate`
  - 주문: `order_date` 또는 `payment_complete_time` 보조 사용

## 5. 엔드포인트 명세

### 5-1. `GET /api/consultation/summary`

목적:
- 상담 원장 전체 요약
- 상태/담당자/분석유형 분포 반환

쿼리:

- `startDate=YYYY-MM-DD` optional
- `endDate=YYYY-MM-DD` optional

응답 예시:

```json
{
  "ok": true,
  "range": {
    "startDate": "2025-12-28",
    "endDate": "2026-03-27"
  },
  "totals": {
    "consultationRows": 4302,
    "distinctContacts": 3890,
    "distinctManagers": 11,
    "distinctAnalysisTypes": 27
  },
  "statusBreakdown": [
    { "statusGroup": "completed", "rawStatus": "완료", "count": 3521 },
    { "statusGroup": "no_answer", "rawStatus": "부재", "count": 441 }
  ],
  "managerBreakdown": [
    { "manager": "민정", "count": 1540 },
    { "manager": "경태", "count": 1212 }
  ],
  "analysisTypeBreakdown": [
    { "analysisType": "알러지", "count": 1803 },
    { "analysisType": "중금속", "count": 774 }
  ]
}
```

### 5-2. `GET /api/consultation/managers`

목적:
- 상담사별 운영 KPI
- 상담 건수, 완료율, 연락처 수, 주문 매칭률 반환

쿼리:

- `startDate=YYYY-MM-DD` optional
- `endDate=YYYY-MM-DD` optional
- `limit=20` optional

응답 예시:

```json
{
  "ok": true,
  "items": [
    {
      "manager": "민정",
      "consultationRows": 3446,
      "distinctContacts": 3128,
      "completedRows": 2901,
      "completedRate": 0.842,
      "matchedOrderContacts": 1541,
      "orderMatchRate": 0.493
    }
  ]
}
```

### 5-3. `GET /api/consultation/order-match`

목적:
- 상담 연락처가 주문/LTR로 얼마나 이어지는지 확인
- 상담형 실험의 규모와 매칭 신뢰도를 계산

쿼리:

- `startDate=YYYY-MM-DD` optional
- `endDate=YYYY-MM-DD` optional
- `manager` optional
- `statusGroup` optional

응답 예시:

```json
{
  "ok": true,
  "totals": {
    "consultDistinctContacts": 6882,
    "iamwebDistinctCustomers": 51942,
    "ltrDistinctCustomers": 30546,
    "consultToOrderOverlap": 2873,
    "consultToLtrOverlap": 5055,
    "orderMatchRate": 0.417,
    "ltrMatchRate": 0.735
  }
}
```

### 5-4. `GET /api/consultation/product-followup`

목적:
- 상담 후 영양제/검사권/기타 구매 비교
- 상담 후속 CRM 시나리오의 우선순위 판단

쿼리:

- `startDate=YYYY-MM-DD` optional
- `endDate=YYYY-MM-DD` optional
- `manager` optional
- `statusGroup=completed|no_answer|rescheduled|canceled|other|unknown` optional

분류 규칙:

- `test_kit`
  - 검사권/검사/알러지/중금속/유기산/장내/호르몬 관련
- `supplement`
  - 영양제/비타민/프로바이오틱/뉴로마스터/바이오밸런스 등
- `other`
  - 나머지

응답 예시:

```json
{
  "ok": true,
  "items": [
    {
      "statusGroup": "completed",
      "productCategory": "supplement",
      "customerCount": 85,
      "orderCount": 234,
      "totalRevenue": 18720000,
      "avgOrderValue": 80000
    }
  ]
}
```

### 5-5. `GET /api/consultation/candidates`

목적:
- 실제 CRM 발송 후보군을 바로 뽑는 API
- 프론트/운영 화면의 실험 대상 미리보기로 사용

쿼리:

- `scenario=completed_followup|reschedule_recall`
- `manager` optional
- `analysisType` optional
- `limit=100` optional

시나리오 정의:

- `completed_followup`
  - `statusGroup = completed`
  - 최근 N일 내 상담 완료
  - 주문 미전환 또는 영양제 미구매
- `reschedule_recall`
  - `statusGroup IN (no_answer, rescheduled)`
  - 최근 N일 내 후속 필요

응답 예시:

```json
{
  "ok": true,
  "scenario": "completed_followup",
  "count": 100,
  "items": [
    {
      "normalizedPhone": "01012345678",
      "manager": "민정",
      "consultationDate": "2026-03-20",
      "analysisType": "알러지",
      "statusGroup": "completed",
      "hasOrderMatch": false,
      "hasLtrMatch": true
    }
  ]
}
```

## 6. 구현 파일 제안

- `backend/src/routes/consultation.ts`
- `backend/src/utils/consultation.ts`
- 필요 시 `backend/src/server.ts`에 router 추가

## 7. 성능/안전 기준

- 모든 API는 read-only
- 개인정보 원문은 화면용으로 직접 반환하지 않는다
- 기본 응답은 집계 위주
- 후보군 API도 원문 이름/이메일은 제외하고 전화번호 정규화/마스킹 버전 우선
- 90일 기본 조회 기준 2초 내 응답 목표

## 8. 수용 기준

1. DB 스키마 변경 없이 5개 API가 동작한다.
2. `tb_consultation_records` 기준 월별/상태별/상담사별 분포를 API로 재현할 수 있다.
3. 상담 연락처와 IAMWEB/LTR 매칭률을 재현할 수 있다.
4. 상담 후속 CRM 대상자 후보군을 2개 시나리오로 조회할 수 있다.
5. 이후 `ltr_customer_cohort.manager` 추가 시 API 구조를 깨지 않고 확장 가능하다.

## 9. 테스트 계획

- 단위 테스트:
  - 상태 표준화 함수
  - 전화번호 정규화 함수
  - 상품 카테고리 분류 함수
- 통합 테스트:
  - 각 endpoint 200/validation error
  - 기본 range 응답 shape 검증
- 수동 검증:
  - `database0327.md`의 주요 수치와 요약 API 숫자가 대략 일치하는지 확인
