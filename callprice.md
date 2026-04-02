# 전화 상담사 1인당 가치 산출 계획 0328

기준일: 2026-03-29  
작성 근거:
- `/Users/vibetj/coding/revenue/callprice.md`
- `/Users/vibetj/coding/seo/database0327.md`
- `/Users/vibetj/coding/seo/backend/.env` 기준 운영 DB 실조회
- `/Users/vibetj/coding/revenue/backend`
- `/Users/vibetj/coding/revenue/frontend`
- `https://workspace.biocom.ai.kr/home` 는 개발팀 설명상 위 `revenue` 코드 기반으로 운영 중
- 로컬 `revenue/backend` origin: `git@github.com:BiocomKR/backend.git`
- 로컬 `revenue/frontend` origin: `git@github.com:BiocomKR/frontend.git`

주의:
- 본 문서는 읽기 전용 점검 결과와 분석 설계 문서다.
- 실제 DB 스키마 변경은 하지 않았다.
- `ltr_customer_cohort` 변경, 비용 테이블 추가는 TJ님 승인 이후 진행한다.

## 1. 결론 먼저

**현재 운영 DB만으로도 상담사 1인당 가치 분석의 1차 버전은 가능하다.**  
그리고 중요한 점은, `상담 관련 대시보드/운영 기능`은 이미 `coding/revenue`에 상당 부분 구현돼 있다는 것이다.  
즉 지금 필요한 일은 `상담 대시보드 재개발`이 아니라, 기존 `revenue` 구현 위에 `상담사 준증분 가치/매출배수/인건비 차감 잔여매출 시나리오` 레이어를 추가하는 것이다.

### 1-1. 현재 자료 기준 순증분 가치 계산 가능 여부

결론을 더 정확히 말하면 아래가 맞다.

| 질문 | 현재 가능 여부 | 판단 |
|---|:---:|---|
| 상담사별 상담 건수/완료율/주문 연결 가치 | 가능 | 관측 데이터 기준으로 바로 산출 가능 |
| 상담사별 상담 후 매출/LTR 격차의 1차 추정 | 가능 | 전화번호 join과 미상담 비교군 설계로 준증분 추정 가능 |
| 상담사 상담의 **정확한 순증분 가치** | 불가 | 무작위 대조군, 준실험 설계, 안정적인 미상담 비교군이 없음 |
| 상담사별 **정확한 ROI** | 불가 | 비용 원장 + 순증분 추정 구조가 아직 없음 |

핵심 판정:
- 지금 자료로는 `관측 차이`와 `준증분 추정`까지는 가능하다.
- 하지만 “상담이 없었어도 이 고객이 원래 샀을지”를 분리하는 **인과적 순증분 가치**는 아직 확정할 수 없다.
- 따라서 현재 단계에서 맞는 표현은 `상담사 가치 1차 추정`이지, `상담사 순증분 가치 확정`은 아니다.
- 다만 `상담군 vs 미상담군`의 행동 차이는 이미 분명하다. 전체 `90일 성숙 코호트` 기준으로 상담군은 미상담군 대비 영양제 전환율 `23.2% vs 1.8%`, 추가 검사 서비스 전환율 `4.5% vs 2.0%`, 재구매율 `15.0% vs 1.3%`로 높게 나타난다.
- 장기 구간에서도 해석은 비슷하다. `6개월/1년 LTR`만 보면 차이가 작거나 방향이 섞이지만, `고객당 매출` 기준으로는 상담군이 각각 `6.15배`, `4.39배` 높다.

### 1-2. 이미 구현된 것 vs 추가 개발할 것

`workspace.biocom.ai.kr/home`이 `revenue` 코드 기반이라는 전제를 두면, 아래처럼 다시 보는 것이 맞다.

| 구분 | 상태 | 근거 |
|---|---|---|
| 상담전환률 대시보드 | 이미 구현됨 | `revenue/frontend/apps/portal/app/(pages)/dashboard/retention/page.tsx` |
| 상담 데이터 직접 입력 | 이미 구현됨 | `revenue/frontend/apps/portal/app/(pages)/dashboard/retention/direct-input/*` |
| 상담 데이터 조회/수정 화면 | 이미 구현됨 | `revenue/frontend/apps/portal/app/(pages)/dashboard/retention/data-management/*` |
| 상담 데이터 업로드 | 이미 구현됨 | `revenue/frontend/apps/portal/app/(pages)/dashboard/retention/upload/*` |
| 상담사/기간/분석유형별 재구매율 집계 API | 이미 구현됨 | `revenue/backend/app/api/dashboard.py`, `controllers/dashboard_controller.py` |
| 상담군 vs 미상담군 LTR/CX value | 이미 구현됨 | `revenue/backend/app/api/ltr.py`, `revenue/frontend/apps/portal/app/(pages)/dashboard/ltr/*` |
| 홈 위젯에서 LTR/상담전환률 요약 노출 | 이미 구현됨 | `revenue/frontend/apps/portal/app/(pages)/home/components/MetricWidget.jsx` |
| 상담사별 순증분 가치 | 미구현 | 전체 상담군/미상담군 비교는 있으나 `manager`별 causal/incremental 레이어가 없음 |
| 상담사별 공식 ROI | 미구현 | 비용 원장 부재, 공식 ROI API/화면 부재 |
| 상담사별 개별 LTR 고정 지표 | 미구현 | `ltr_customer_cohort.manager` 없음 |
| 상담사 충원 시 기대 매출 시뮬레이션 | 미구현 | 인력 비용 + 준증분 계수 + 시뮬레이터 없음 |

핵심 정리:
- **이미 있는 것:** 상담 데이터 입력/업로드/조회/수정, 상담전환률 시계열/분석유형 집계, 상담군 vs 미상담군 LTR 비교
- **없는 것:** `상담사별` 순증분 가치, `상담사별` 공식 ROI, 비용 반영 인력 시뮬레이터
- 따라서 `callprice` 관점의 신규 개발은 `상담 대시보드`가 아니라 **기존 대시보드의 마지막 20%**에 가깝다.

| 분석 항목 | 현재 가능 여부 | 근거 | 추가 조치 |
|---|:---:|---|---|
| 상담사별 상담 건수/상태/검사 유형 | 가능 | `tb_consultation_records` 8,305건, manager 13명 | 없음 |
| 상담 연락처의 주문 고객 매칭률 | 가능 | 상담 연락처 6,882명 중 IAMWEB 고객 2,873명 매칭 | 없음 |
| 상담 연락처의 LTR 코호트 매칭률 | 가능 | 상담 연락처 6,882명 중 LTR 코호트 5,055명 매칭 | 없음 |
| 상담 후 영양제/추가검사 구매 비교 | 가능 | `ltr_customer_cohort` + 주문 원장 90일 윈도우 계산 완료 | 분류 규칙 운영 승인 필요 |
| 상담사별 준증분 가치 추정 | 부분 가능 | 상담군 vs 미상담 비교군 설계는 가능 | 비교군 매칭 규칙 명시 필요 |
| 상담사별 개별 LTR | 부분 가능 | 실시간 join 추정은 가능 | 안정 운영용으론 `ltr_customer_cohort.manager` 필요 |
| 상담사별 공식 ROI | 불가 | 비용 원장 없음 | `consultant_cost_monthly` 필요 |

핵심 판단:
- 상담 원장이 충분히 크므로, **상담 후속 CRM과 상담사 가치 분석은 바로 백로그에서 끌어올릴 수 있다.**
- 다만 현재는 `tb_consultation_records`와 주문/LTR을 **전화번호 join**으로 묶는 구조라, 운영 대시보드 수준으로 올리려면 스키마 보강이 필요하다.
- 그리고 이 분석을 보여줄 기본 UI/API 뼈대는 이미 `revenue`에 있으므로, 다음 개발은 새 페이지를 처음부터 만드는 방식보다 기존 탭 확장 방식이 맞다.

## 2. 현재 데이터 현실

### 2-1. 상담 원장

- `tb_consultation_records`: 8,305건
- 기간: `2025-04-07` ~ `2026-03-27`
- 고유 연락처: 6,882
- 고유 고객명: 5,785
- 상담사(manager): 13명
- 분석 유형: 61종

상담사 상위 분포:

| 상담사 | 상담 건수 | 고유 연락처 | IAMWEB 매칭 연락처 |
|---|---:|---:|---:|
| 민정 | 3,446 | 3,128 | 1,541 |
| 경태 | 2,420 | 2,141 | 1,319 |
| 예진 | 1,352 | 1,247 | 148 |
| 선희 | 415 | 390 | 64 |
| 글라 | 331 | 311 | 37 |
| 연정 | 210 | 204 | 19 |

상담 상태 상위:

| 상태 | 건수 |
|---|---:|
| 완료 | 6,939 |
| 부재 | 831 |
| 변경 | 359 |
| `nan` | 58 |
| 시간 변경 | 45 |
| 취소 | 35 |

판단:
- 상담 volume은 충분하다.
- manager별 분포도 의미 있게 나온다.
- 다만 상태값 표준화가 먼저 필요하다.

### 2-2. 주문/LTR 연결 가능성

전화번호 숫자만 남기는 방식으로 조인했을 때:

- 상담 고유 연락처: 6,882
- IAMWEB 고유 고객번호: 51,942
- LTR 코호트 고유 고객번호: 30,546
- 상담 연락처 ∩ IAMWEB 고객번호: 2,873
- 상담 연락처 ∩ LTR 코호트 고객번호: 5,055

즉시 해석:
- 상담 연락처 기준 주문 매칭률: 약 41.7%
- 상담 연락처 기준 LTR 코호트 매칭률: 약 73.5%

판단:
- 상담 이후 주문/재구매 비교를 위한 최소 연결성은 충분하다.
- 특히 LTR 코호트와의 연결률이 높아서, 상담 가치 분석 1차 버전은 지금도 가능하다.
- 다만 매칭 키가 전화번호 기반이므로, 운영 지표로 고정하려면 `customer_key` 체계로 승격해야 한다.

### 2-3. 상품 카테고리

상담 원장의 검사 유형 상위:

| 분석 유형 | 건수 |
|---|---:|
| 알러지 | 3,608 |
| 중금속 | 1,769 |
| 음식물 | 1,069 |
| 유기산 | 758 |
| 알러지,유기산 | 376 |
| 장내 | 186 |
| 호르몬 | 119 |

판단:
- 상담 이후 구매를 분석할 때 최소한 `검사권 / 영양제 / 기타` 분류가 필요하다.
- 검사 유형도 이미 충분히 쌓여 있어 `상담사 × 분석유형 × 구매전환` 비교가 가능하다.

## 3. 지금 바로 가능한 질문

### Q1. 상담사별 월 상담 건수와 완료율은 어떤가?

가능하다.

- 소스: `tb_consultation_records`
- 기준: `manager`, `consultation_status`, `insertdate`
- 산출:
  - 월 상담 건수
  - 완료율
  - 부재율
  - 변경율
  - 검사 유형 믹스

### Q2. 상담 받은 고객이 실제 주문 고객으로 이어지는가?

가능하다.

- 소스:
  - 상담: `tb_consultation_records.customer_contact`
  - 주문: `tb_iamweb_users.customer_number`
- 방식:
  - 전화번호 정규화 후 join
- 산출:
  - 상담 고객 주문 매칭률
  - 상담 완료 후 첫 주문 전환율
  - 상담사별 주문 매칭률

### Q3. 상담 받은 고객이 영양제/추가검사를 더 많이 사는가?

가능하다.

- 현재는 `ltr_customer_cohort`를 기준 모집단으로 쓰고, 기준일 이후 `90일` 주문 윈도우를 붙여 계산했다.
- 분류는 초기 버전 기준으로 아래 3분류를 사용했다.
  - 검사 서비스
  - 영양제
  - 기타
- 실측 결과는 아래와 같다.
  - 영양제 전환율: 상담군 `23.2%`, 미상담군 `1.8%`
  - 추가 검사 서비스 전환율: 상담군 `4.5%`, 미상담군 `2.0%`
  - 전체 재구매율: 상담군 `15.0%`, 미상담군 `1.3%`
  - 6개월 LTR: 상담군 `43만 5,677원`, 미상담군 `44만 8,792원`
  - 1년 LTR: 상담군 `49만 4,545원`, 미상담군 `48만 851원`
  - 다만 `고객당 매출`로 보면 상담군이 6개월 `12만 9,622원 vs 2만 1,062원`, 1년 `18만 1,333원 vs 4만 1,272원`으로 더 높다.

### Q4. 어떤 상담사가 가장 가치가 높은가?

1차 추정은 가능하고, 안정 운영은 아직 불완전하다.

- 가능:
  - 상담사별 상담 건수
  - 상담사별 주문 매칭률
  - 상담사별 구매 전환율
  - 상담사별 상담 후 매출 합계
- 불완전:
  - 상담사별 개별 LTR을 코호트에 영속적으로 저장하지 않음
  - 동일 고객의 다회 상담/상담사 변경 처리 규칙이 필요함
  - 현재 `revenue` 대시보드의 `CX value`는 전체 상담군/미상담군 차이이지, 상담사별 값이 아님

### Q5. 상담사를 1명 더 뽑으면 매출이 얼마나 느는가?

현재는 추정만 가능하다.

- 필요한 값:
  - 평균 상담사 월 상담 완료 건수
  - 상담 완료 고객의 90일 성숙 고객 수
  - 상담 고객당 매출 - 미상담 고객당 매출
  - 상담사 1인당 월 비용
- 마지막 항목이 아직 없어서 **정확한 ROI는 불가**하다.
- 추가로, 지금은 무작위 대조군이 없어서 **정확한 순증분 매출도 확정할 수 없다.**
- 따라서 현재는 `준증분 매출`, `매출배수`, `인건비 차감 후 잔여매출`까지만 쓰는 것이 맞다.

## 4. 현재 불가능하거나 위험한 분석

### 4-1. 상담사별 개별 LTR의 안정 운영

지금도 실시간 join으로 추정치는 만들 수 있다.  
하지만 아래 이유로 운영 지표로 고정하기는 위험하다.

- `ltr_customer_cohort`에 `manager`가 없다.
- 최초 상담사 기준인지, 최종 상담사 기준인지 룰이 없다.
- 전화번호 정규화 join이 항상 완전하지 않다.
- 기존 `LTR` 대시보드는 전체 상담군/미상담군 비교를 잘 보여주지만, 그 상태만으로는 상담사별 기여도로 drill-down 되지 않는다.

권장 조치:
- 승인 후 `ltr_customer_cohort.manager` 추가
- 코호트 sync 시 최초 상담사 또는 기준 상담사 저장

### 4-2. 상담사별 공식 ROI

현재는 비용 테이블과 공헌이익 기준이 없어서 불가하다.

권장 조치:
- 승인 후 `consultant_cost_monthly` 테이블 추가
- 최소 입력값:
  - `manager`
  - `year_month`
  - `salary`
  - `insurance_and_benefits`
  - `avg_consultation_minutes`

## 5. 계산 프레임

### 5-1. 1차 추정용

현재 자료로 바로 가능한 것은 아래처럼 **관측 차이 기반 준증분 추정**이다.

```text
상담사 A의 준증분 매출 추정
= 상담사 A 90일 성숙 고객 수
  × (상담사 A 90일 고객당 매출 - 비교군 90일 고객당 매출)
```

이 식은 지금 바로 만들 수 있다.  
다만 아래 한계가 있다.

- `90일 고객당 매출`이 이미 `성숙 고객 수`를 분모로 둔 값이므로, 여기에 `전환율`을 다시 곱하면 이중 반영 위험이 있다.
- 따라서 `90일 전환율`은 설명용/진단용 지표로 따로 보고, 준증분 매출 산식에는 별도로 곱하지 않는다.
- `미상담 고객`이 상담 고객과 동질 비교군이 아닐 수 있다.
- 상담 유입 자체가 구매 의도가 높은 고객을 더 많이 포함할 수 있다.
- 따라서 이 값은 **순증분 확정치가 아니라 준증분 추정치**로 봐야 한다.
- `평균 매출`도 LTR이 아니라 단기 매출에 가까워서 정확도가 낮다.

### 5-2. 안정 운영용

정확한 순증분 가치에 더 가까운 버전은 아래다.

```text
상담사 A의 인과적 순증분 매출
= 상담사 A 성숙 고객 수
  × (매칭된 상담군 고객당 매출 - 매칭된 비교군 고객당 매출)

공식 ROI
= 인과적 순증분 공헌이익 / 총투입비용
```

이 버전은 아래가 있어야 한다.

- 최소한의 비교군 설계
  - 무작위 대조군 또는 준실험 매칭 규칙
  - 예: 동일 유입원/분석유형/신규-재구매 여부/기간 매칭
- `ltr_customer_cohort.manager`
- 비용 원장
- 공헌이익 기준
- 상태 표준화

즉, 현재 자료만으로는 `관측 차이 추정`까지는 가능하지만,  
**상담사의 정확한 순증분 가치 계산은 아직 준비가 덜 됐다**고 보는 것이 맞다.

## 6. `revenue` 기준 설계 초안

### 6-1. 구현 위치와 책임

이번 설계의 전제는 아래다.

- **지금 실제 구현 위치는 `coding/seo` 로 잡는 것이 맞다.**
- 이유는 TJ님이 현재 `BiocomKR/backend`, `BiocomKR/frontend` 원본 코드를 직접 건드리지 않으려 하기 때문이다.
- `coding/revenue` 는 **참조 코드베이스**로 사용한다.
- 즉, `revenue` 는 기존 운영 로직/화면/계산 방식을 읽어오는 기준선이고, 이번 `callprice` 실험 구현은 `seo` 에서 진행한다.
- 정식 운영 반영이 필요해지는 시점에만 `revenue` 또는 개발팀 원본 repo로 이관 여부를 결정한다.

권장 배치:

- Current Backend Router: `seo/backend/src/routes/callprice.ts`
- Current Backend Service: `seo/backend/src/callprice.ts`
- Current Frontend Screen: `seo/frontend/src/app/` 내부 신규 internal page 또는 기존 dashboard 확장
- Current Frontend Hook: `seo/frontend/src/.../useCallpriceData.ts`
- Reference Backend Router: `revenue/backend/app/api/dashboard.py`, `revenue/backend/app/api/ltr.py`
- Reference Frontend Screen: `revenue/frontend/apps/portal/app/(pages)/dashboard/retention/`, `.../dashboard/ltr/`

판단:
- **지금 구현 위치**는 `seo` 가 맞다.
- 이유:
  - 이미 `seo` 는 독립 백엔드/프론트(`7020`/`7010`)가 떠 있고, TJ님이 직접 통제 가능하다.
  - 개발팀 원본 repo를 건드리지 않고도 DB read-only 기반 검증이 가능하다.
  - `callprice`는 아직 `준증분 추정` 단계라 실험/반복이 필요하다.
- **참조 기준**은 `revenue` 가 맞다.
- 이유:
  - 실제 운영 포털 `workspace.biocom.ai.kr` 가 그 코드 기반으로 돌아가고 있다.
  - 기존 상담/LTR API 및 화면이 이미 있으므로 숫자 비교 기준선이 된다.
- 따라서 구조는 `seo에 구현, revenue를 참조, 운영 확정 후 이관 여부 결정` 이다.

### 6-2. V1 설계 목표

V1의 목표는 아래 4개다.

1. 상담사별 `완료 상담`, `주문 매칭`, `전환`, `90일 매출`, `준증분 추정`을 한 화면에서 본다.
2. 기존 `revenue` 의 `상담전환률`/`LTR` 로직을 참조하고, `seo` 에서 `callprice` 전용 API로 구현한다.
3. 스키마 변경 없이 read-only 쿼리로 먼저 출시한다.
4. `공식 ROI` 대신 `준증분 추정`과 `시나리오용 비용 입력`을 분리한다.

### 6-3. V1 핵심 지표 정의

V1에서는 지표 이름을 아래처럼 고정하는 것이 맞다.

| 지표 | 정의 | 비고 |
|---|---|---|
| 완료 상담 수 | 기간 내 `consultation_status='완료'` 건수 | 상담사별 기본 모집단 |
| 고유 완료 고객 수 | 완료 상담 고객의 distinct 연락처 수 | 다회 상담 중복 제거 |
| 주문 매칭 고객 수 | 완료 상담 후 주문 이력이 존재하는 고유 고객 수 | 전화번호 정규화 join |
| 90일 성숙 고객 수 | 최초 완료 상담일 기준 90일이 지난 고유 고객 수 | 최근 상담 편향 방지 |
| 90일 전환 고객 수 | 성숙 고객 중 상담 후 90일 내 구매 고객 수 | V1 핵심 전환 분모 |
| 90일 전환율 | `90일 전환 고객 수 / 90일 성숙 고객 수` | 상담사 비교용 |
| 90일 고객당 매출 | 상담 후 90일 내 순매출 / 90일 성숙 고객 수 | 상담사별 고객 기준 매출 비교용 |
| 비교군 고객당 매출 | 미상담 고객의 90일 고객당 매출 | 전역 또는 분석유형 기준 |
| 준증분 가치/고객 | `상담사 90일 고객당 매출 - 비교군 고객당 매출` | signed value 유지 |
| 준증분 매출 추정 | `준증분 가치/고객 × 90일 성숙 고객 수` | 공식 순증분 아님 |
| 상담 1건당 가치 | `준증분 매출 추정 / 완료 상담 수` | 인력 효율 비교용 |

설계 메모:
- V1에서는 `LTR`보다 `90일 고객당 매출`을 기본값으로 쓰는 것이 안전하다.
- 이유는 `manager` 단위에서 최근 상담사의 성과를 비교하려면 동일한 성숙 기간이 필요하기 때문이다.
- `LTR`는 Phase 2에서 `ltr_customer_cohort.manager`가 생긴 뒤 공식 지표로 승격한다.
- `90일 전환율`은 설명용 지표로 별도 노출하되, `90일 고객당 매출`을 쓰는 산식에는 다시 곱하지 않는다.

### 6-4. 비교군 규칙

V1 비교군은 아래 두 단계로 설계한다.

1. 기본값: `global_non_consultation`
   - 기존 `LTR` API가 이미 계산하는 전체 미상담군 기준
   - 구현이 가장 빠르고, 운영자도 이해하기 쉽다
2. 옵션: `analysis_type_non_consultation`
   - 검사 유형 매핑이 안정되면 분석유형별 미상담 벤치마크 추가
   - 예: 알러지 상담 고객은 알러지 검사 미상담 고객과 비교

V1 화면/응답에서 반드시 함께 보여줄 설명:

- `준증분 추정치는 미상담 비교군 대비 관측 차이이며 인과적 확정치가 아님`
- `최근 90일 성숙 고객만 사용하여 상담사별 최근 성과를 비교함`

### 6-5. 상담사 귀속 규칙

V1에서는 아래 귀속 규칙을 쓴다.

- 기준 고객 단위: `정규화된 customer_contact`
- 기준 상담: 기간 내 `완료` 상태 상담
- 기본 귀속 상담사: `고객의 최초 완료 상담을 수행한 상담사`
- 보조 지표: `완료 상담 건수`는 raw consultation row 기준으로 유지

이 규칙을 쓰는 이유:

- 같은 고객이 여러 번 상담해도 `고객당 가치` 계산 분모가 안정된다.
- `상담사별 가치`를 계산할 때 다회 상담 중복 매출 귀속을 줄일 수 있다.
- Phase 2에서 `최초 상담사`, `최종 상담사`, `가중 분배` 중 무엇이 맞는지 다시 결정할 수 있다.

### 6-6. V1 Backend API 초안

V1에서는 기존 `revenue/backend` 스타일에 맞춰 아래 응답 envelope를 공통으로 쓴다.

```json
{
  "status": "success",
  "data": {},
  "meta": {},
  "notes": []
}
```

공통 validation:

- `start_date`, `end_date` 는 `YYYY-MM-DD`
- `start_date <= end_date`
- `maturity_days` 는 `30 | 60 | 90 | 180` 중 하나로 제한
- `baseline_scope` 는 `global_non_consultation | analysis_type_non_consultation`
- 잘못된 값은 `400`
- 서버 계산 오류는 `500`

공통 notes 규칙:

- `준증분 추정치는 미상담 비교군 대비 관측 차이`
- `공식 ROI 아님`
- `고객당 매출 산식에 전환율을 다시 곱하지 않음`
- `최근 상담 중 maturity 미도달 고객은 제외`

#### 권장 라우터 구조

- `GET /api/callprice/options`
- `GET /api/callprice/overview`
- `GET /api/callprice/managers`
- `GET /api/callprice/analysis-types`
- `GET /api/callprice/scenario`

#### `GET /api/callprice/overview`

목적:
- 필터 기준 전체 요약 KPI 카드 제공

Query:
- `start_date`
- `end_date`
- `analysis_type` optional
- `manager` optional
- `maturity_days` default `90`
- `baseline_scope` default `global_non_consultation`

Response 요약:

```json
{
  "summary": {
    "completed_consultations": 0,
    "unique_completed_customers": 0,
    "matched_order_customers": 0,
    "matured_customers": 0,
    "converted_customers": 0,
    "conversion_rate": 0.0,
    "avg_revenue_per_customer": 0,
    "baseline_avg_revenue_per_customer": 0,
    "estimated_incremental_value_per_customer": 0,
    "estimated_incremental_revenue": 0,
    "estimated_value_per_consultation": 0
  },
  "filters": {},
  "notes": []
}
```

추가 규약:

- `summary.completed_consultations` 는 raw row 기준
- `summary.unique_completed_customers` 는 정규화 전화번호 distinct 기준
- `summary.matched_order_customers` 는 상담 후 1회 이상 정상 주문한 고객 수
- `summary.matured_customers` 는 `first_completed_consult_date <= current_date - maturity_days`
- `summary.avg_revenue_per_customer` 는 `matured_customers` 분모
- `summary.baseline_avg_revenue_per_customer` 는 동일 maturity window의 미상담군 기준

`meta` 예시:

```json
{
  "maturity_days": 90,
  "baseline_scope": "global_non_consultation",
  "comparison_unit": "revenue_per_customer_90d",
  "manager_applied": null,
  "analysis_type_applied": null
}
```

#### `GET /api/callprice/managers`

목적:
- 상담사 랭킹 테이블

Query:
- `start_date`
- `end_date`
- `analysis_type` optional
- `sort_by` default `estimated_incremental_revenue`
- `sort_order` default `desc`
- `maturity_days`
- `baseline_scope`

Response row 예시:

```json
{
  "manager": "경태",
  "completed_consultations": 0,
  "unique_completed_customers": 0,
  "matched_order_customers": 0,
  "matured_customers": 0,
  "converted_customers": 0,
  "conversion_rate": 0.0,
  "avg_revenue_per_customer": 0,
  "baseline_avg_revenue_per_customer": 0,
  "estimated_incremental_value_per_customer": 0,
  "estimated_incremental_revenue": 0,
  "estimated_value_per_consultation": 0,
  "sample_warning": false
}
```

추가 필드:

```json
{
  "sample_size_grade": "stable",
  "sample_warning_reason": null,
  "share_of_total_completed_consultations": 0.0,
  "share_of_total_estimated_incremental_revenue": 0.0
}
```

샘플 경고 규칙 초안:

- `matured_customers < 30` 이면 `sample_warning=true`
- `converted_customers < 5` 이면 `sample_warning=true`
- 둘 다 만족하지 않으면 `sample_size_grade='stable'`
- 한 조건만 미달이면 `sample_size_grade='watch'`
- 둘 다 미달이면 `sample_size_grade='small'`

정렬 허용값:

- `completed_consultations`
- `matured_customers`
- `conversion_rate`
- `avg_revenue_per_customer`
- `estimated_incremental_value_per_customer`
- `estimated_incremental_revenue`
- `estimated_value_per_consultation`

#### `GET /api/callprice/analysis-types`

목적:
- 특정 기간에서 `상담사 × 분석유형` drill-down

Query:
- `start_date`
- `end_date`
- `manager` optional
- `maturity_days`
- `baseline_scope`

Response:
- `analysis_type`별 동일 KPI row 배열

권장 응답 row:

```json
{
  "analysis_type": "알러지",
  "completed_consultations": 0,
  "unique_completed_customers": 0,
  "matured_customers": 0,
  "converted_customers": 0,
  "conversion_rate": 0.0,
  "avg_revenue_per_customer": 0,
  "baseline_avg_revenue_per_customer": 0,
  "estimated_incremental_value_per_customer": 0,
  "estimated_incremental_revenue": 0,
  "sample_warning": false
}
```

주의:

- `analysis_type` 가 복수 문자열이면 V1에서는 `,` split 후 trim하여 폭발시킨다.
- 한 상담 row가 `알러지,유기산` 이면 두 유형 집계에 모두 포함된다.
- 이로 인해 `analysis_type` 총합은 전체 raw count와 다를 수 있으므로 `notes`에 표시한다.

#### `GET /api/callprice/options`

목적:
- 프론트 필터 select 박스 초기값 제공

Response 예시:

```json
{
  "status": "success",
  "data": {
    "manager_options": ["전체", "경태", "민정"],
    "analysis_type_options": ["전체", "알러지", "유기산"],
    "baseline_scope_options": [
      {"value": "global_non_consultation", "label": "전체 미상담 비교군"},
      {"value": "analysis_type_non_consultation", "label": "분석유형별 미상담 비교군"}
    ],
    "maturity_day_options": [30, 60, 90, 180]
  }
}
```

#### `GET /api/callprice/scenario`

목적:
- 비용 테이블 없이도 가정 입력 기반 인력 시뮬레이션 제공

Query:
- `manager` optional
- `monthly_cost`
- `headcount`
- `start_date`
- `end_date`
- `maturity_days`

Response:
- `estimated_incremental_revenue`
- `incremental_revenue_multiple`
- `break_even_cost`

권장 응답:

```json
{
  "status": "success",
  "data": {
    "headcount": 2,
    "monthly_cost": 4500000,
    "estimated_incremental_revenue": 0,
    "estimated_incremental_profit": 0,
    "incremental_revenue_multiple": 0.0,
    "break_even_cost": 0,
    "break_even_headcount": 0.0
  },
  "notes": [
    "시나리오 계산이며 공식 ROI가 아님",
    "estimated_incremental_profit 필드는 Phase 1 문서 해석상 인건비 차감 후 잔여매출에 가까움"
  ]
}
```

주의:
- 이 endpoint는 `공식 ROI`가 아니라 `시나리오 계산기`다.
- 비용 테이블이 생기기 전까지는 저장하지 않고 계산만 한다.
- 상품 원가, 물류, 환불, 광고비, 공헌이익률이 없으므로 회계적 의미의 `이익`으로 해석하면 안 된다.

### 6-6-1. Endpoint별 구현 우선순위

1. `GET /api/callprice/options`
2. `GET /api/callprice/overview`
3. `GET /api/callprice/managers`
4. `GET /api/callprice/analysis-types`
5. `GET /api/callprice/scenario`

이 순서가 맞는 이유:

- 프론트는 `options + overview + managers` 만으로도 첫 화면이 완성된다.
- `analysis-types` 는 drill-down이라 2차 연결 가능하다.
- `scenario` 는 read-only 계산기라 맨 마지막이어도 된다.

### 6-7. SQL/계산 로직 초안

V1 SQL은 아래 순서로 설계하는 것이 맞다.

1. `completed_consults`
   - `tb_consultation_records`
   - `consultation_status='완료'`
   - 전화번호 정규화
   - 기간 필터 적용
2. `manager_customer_base`
   - 고객별 최초 완료 상담일, 최초 상담사 추출
3. `post_consult_orders_90d`
   - `tb_iamweb_users`와 join
   - `order_date >= first_completed_consult_date`
   - `order_date < first_completed_consult_date + maturity_days`
4. `manager_metrics`
   - 상담사별 고유 고객 수, 전환 고객 수, 90일 매출 계산
5. `baseline_metrics`
   - 기존 `ltr_customer_cohort` 또는 검사 고객 기준 미상담군 90일 평균 매출 계산
6. `final_manager_scores`
   - 상담사별 준증분 가치/고객, 준증분 매출 추정 계산

V1 주의점:

- 취소/환불 제외 규칙을 `tb_iamweb_users.payment_status` 또는 취소/반품 사유 기준으로 명확히 고정해야 한다.
- `analysis_type`가 복수값인 경우 `,` split 후 폭발시킬지, 원문 문자열 기준으로 둘지 먼저 결정해야 한다.
- 샘플 수가 적은 상담사는 `sample_warning=true` 로 경고를 붙인다.

### 6-7-1. 전화번호 정규화 규칙

정규화 함수 초안:

```text
normalize_phone(x)
= 숫자 외 문자 제거
= 앞자리 국가코드 82가 있으면 0으로 치환
= 최종적으로 10~11자리만 허용
```

예시:

- `010-1234-5678` -> `01012345678`
- `82 10 1234 5678` -> `01012345678`
- 빈값/비정상값 -> `NULL`

원칙:

- 상담, IAMWEB, LTR, 고객 리포트 전부 같은 정규화 함수를 쓴다.
- 정규화 실패 row는 `invalid_phone` 디버그 카운트로 분리한다.

### 6-7-2. 정상 주문 판정 규칙

V1에서는 아래 순서로 보수적으로 판정한다.

1. `cancellation_reason` 이 `NULL`, `''`, `'nan'` 이어야 함
2. `return_reason` 이 `NULL`, `''`, `'nan'` 이어야 함
3. `final_order_amount > 0`

판단:

- 기존 대시보드와 수치 괴리를 줄이려면 이 규칙을 `callprice` 응답 `notes` 에도 적어야 한다.
- `payment_status` 는 현재 모델에 없으므로 V1 핵심 규칙으로 쓰지 않는다.

### 6-7-3. 90일 매출 산식

고객 단위 산식:

```text
customer_revenue_90d
= SUM(final_order_amount)
  where order_date >= first_completed_consult_date
    and order_date < first_completed_consult_date + interval '90 day'
    and valid_order = true
```

상담사 단위 산식:

```text
avg_revenue_per_customer
= SUM(customer_revenue_90d) / matured_customers
```

전환 고객 판정:

```text
converted_customer
= customer_revenue_90d > 0
```

### 6-7-4. 비교군 산식

`global_non_consultation`:

```text
baseline_avg_revenue_per_customer
= 미상담 고객군의 90일 고객당 매출
```

권장 구현:

- 기존 `ltr_customer_cohort` 의 `cohort_type='non_consultation'` 고객을 사용
- `base_date` 기준 동일 90일 window로 매출 계산
- 분모는 maturity 달성 고객만 사용

`analysis_type_non_consultation`:

- V1 API signature에는 넣되, 실제 구현은 fallback 가능하도록 설계한다
- 분석유형별 비교군을 안정적으로 만들 수 없으면 `meta.baseline_scope_resolved='global_non_consultation'` 로 응답한다

### 6-7-5. 상담사 귀속 edge case

V1 edge case 처리:

- 동일 고객의 동일 날짜 다중 완료 상담:
  - 시간값이 있으면 가장 이른 시간
  - 시간값이 없으면 최소 `id`
- 동일 고객의 상담사 변경:
  - 최초 완료 상담사에 귀속
- 상담 후 주문이 상담 기간 밖에서 발생:
  - 상담일 이후 `maturity_days` 안이면 포함
- 최근 상담으로 maturity 미도달:
  - `completed_consultations` 에는 포함
  - `matured_customers` 및 value 계산에서는 제외

### 6-7-6. 디버그 카운트

운영 검증용으로 아래 `debug_counts` 를 `meta`에 같이 주는 것이 좋다.

```json
{
  "invalid_phone_consult_rows": 0,
  "invalid_phone_order_rows": 0,
  "excluded_recent_customers": 0,
  "excluded_cancelled_orders": 0,
  "baseline_scope_resolved": "global_non_consultation"
}
```

### 6-8. Frontend 배치 초안

권장 배치:

- 경로 유지: `/dashboard/retention`
- 기존 탭에 새 탭 추가: `상담사 가치`

탭 내부 구성:

1. 상단 KPI 카드
   - 준증분 매출 추정
   - 상담 1건당 가치
   - 90일 전환율
   - 90일 고객당 매출
2. 필터 바
   - 기간
   - 상담사
   - 분석유형
   - 비교군 범위
   - 성숙 기간
3. 상담사 랭킹 테이블
   - 완료 상담 수
   - 성숙 고객 수
   - 전환율
   - 준증분 가치/고객
   - 준증분 매출 추정
4. 분석유형 drill-down
   - 선택한 상담사 기준 유형별 성과
5. 시나리오 패널
   - 월 비용 입력
   - 1명/2명/3명 충원 가정

화면 원칙:

- 기존 `SummaryCards` + `ReportTable` 패턴을 재사용한다.
- `LTR` 설명은 그대로 링크하거나 툴팁으로 재사용한다.
- `공식 ROI`와 `시나리오`를 같은 숫자로 보이게 하면 안 된다.

### 6-8-1. 프론트 타입 초안

기존 `retention` 타입과 별도로 아래 타입을 추가하는 편이 맞다.

```ts
export interface CallpriceOverviewSummary {
  completed_consultations: number
  unique_completed_customers: number
  matched_order_customers: number
  matured_customers: number
  converted_customers: number
  conversion_rate: number
  avg_revenue_per_customer: number
  baseline_avg_revenue_per_customer: number
  estimated_incremental_value_per_customer: number
  estimated_incremental_revenue: number
  estimated_value_per_consultation: number
}

export interface CallpriceManagerRow extends CallpriceOverviewSummary {
  manager: string
  sample_warning: boolean
  sample_size_grade: 'stable' | 'watch' | 'small'
  sample_warning_reason: string | null
  share_of_total_completed_consultations: number
  share_of_total_estimated_incremental_revenue: number
}

export interface CallpriceAnalysisRow extends CallpriceOverviewSummary {
  analysis_type: string
  sample_warning: boolean
}
```

### 6-8-2. 프론트 컴포넌트 분해 초안

- `CallpriceTab.tsx`
- `CallpriceSummaryCards.tsx`
- `CallpriceFilters.tsx`
- `CallpriceManagerTable.tsx`
- `CallpriceAnalysisTable.tsx`
- `CallpriceScenarioPanel.tsx`
- `CallpriceMethodNotice.tsx`

권장 순서:

1. `CallpriceSummaryCards`
2. `CallpriceManagerTable`
3. `CallpriceMethodNotice`
4. `CallpriceAnalysisTable`
5. `CallpriceScenarioPanel`

### 6-8-3. UX 경고 문구 초안

페이지 상단 고정 안내:

```text
본 화면의 준증분/ROI 관련 수치는 미상담 비교군 대비 관측 차이 기반 추정치입니다.
인과적으로 확정된 순증분 가치가 아니며, 공식 평가 지표는 별도 승인 이후 확정합니다.
```

row 경고:

- `sample_size_grade='watch'` -> `표본 주의`
- `sample_size_grade='small'` -> `표본 부족`

### 6-8-4. 릴리즈 순서

Frontend release order:

1. 숨김 플래그 없이 내부 관리자만 보이는 새 탭 추가
2. `overview + managers` 연결
3. `analysis-types` 연결
4. `scenario` 연결
5. 엑셀 다운로드 추가

### 6-8-5. 엑셀 다운로드 시트 설계

시트 구성:

- `요약`
- `상담사 랭킹`
- `분석유형`
- `시나리오`

시트 헤더는 기존 `ExcelDownload` 패턴과 맞춘다.

### 6-8-6. 테스트 기준

Backend:

- 전화번호 정규화 단위 테스트
- 주문 제외 규칙 단위 테스트
- `overview` 응답 shape 테스트
- `managers` 정렬/경고 플래그 테스트
- `analysis-types` 중복 제거 및 split 테스트
- `scenario` break-even 계산 테스트

Frontend:

- 기본 필터 렌더링
- managers 표 정렬/배지 렌더링
- warning badge 렌더링
- scenario 입력 변경 시 수치 반영

운영 검증:

- `callprice` 총 완료 상담 수가 기존 `상담전환률` 기준 기간 합계와 크게 어긋나지 않는지 비교
- 전체 상담군/미상담군 차이가 기존 `LTR` 화면의 설명 방향과 일치하는지 비교

### 6-9. 비범위 항목

V1에서 하지 않을 것:

- 새로운 독립 대시보드 라우트 신설
- `seo/backend`를 운영 API로 승격
- `ltr_customer_cohort` 스키마 변경
- 비용 테이블 영속 저장
- 인과 추론 모델링
- 자동 인력 추천 모델

## 7. 구현 권장 순서

### Phase 1. 기존 `revenue` 구현 재사용 기준으로 바로 할 것

Codex Backend:
- `seo/backend`에 구현하되, `revenue/backend`의 기존 상담/LTR API를 기준선으로 삼고 중복 로직을 최소화한다
- `tb_consultation_records` 상태 표준화 규칙 작성
- 전화번호 정규화 join 기반 `상담사별 가치` read-only SQL/API 추가
- 상담사별 월 건수/완료율/주문 매칭률/준증분 추정 API 작성
- 상담 후 영양제/검사권 구매 비교 쿼리 작성
- `seo/backend` 에 `callprice` 전용 endpoint로 넣고, 기존 `revenue` 수치와 비교 검증한다
- 개발팀 원본 repo를 건드리지 않는 것이 현재 우선순위다

Codex UX/UI Spec:
- `seo/frontend` 화면 구조를 잡되, 기존 `revenue/frontend` 탭 구조를 최대한 닮게 설계한다
- 상태 표준화 라벨 정의
- `상담전환률` 탭 확장인지 `LTR` 탭 확장인지 acceptance criteria 정의

Claude Code Frontend:
- `seo/frontend` 내부에서 새 페이지를 만들더라도 기존 `retention`/`ltr` UX 패턴을 재사용한다
- 상담사 가치 카드, 상담사별 분포표, 분석유형별 drill-down, 비용 입력 전 placeholder UI 추가

### Phase 2. 승인 후 스키마 변경

승인 필요:
- `ltr_customer_cohort.manager` 추가
- `consultant_cost_monthly` 추가

Codex Backend:
- 코호트 sync 로직 수정
- 상담사별 LTR API 추가
- 상담사별 ROI API 추가
- 상담사 충원 시 기대 매출/ROI 시뮬레이션 API 추가

Codex UX/UI Spec:
- 상담사별 LTR/ROI/충원 시뮬레이션 화면 acceptance criteria 정의

Claude Code Frontend:
- 현재는 `seo/frontend` 에 구현하고, 운영 승인 이후 `revenue` 이관 여부를 재판단

## 8. 최종 판단

지금 기준으로는 아래가 맞다.

1. 상담사 가치 분석은 **지금 시작 가능**하다.
2. 상담 후속 CRM도 **실험 후보군으로 즉시 올릴 수 있다**.
3. 다만 **상담 대시보드 자체는 이미 상당 부분 구현돼 있으므로**, 설계/UX 기준선은 `revenue` 를 참조하는 것이 맞다.
4. 현재 가능한 것은 `준증분 추정`이지, `정확한 순증분 가치 확정`은 아니다.
5. 운영 KPI로 고정할 상담사별 개별 LTR과 ROI는 **승인 후 스키마 보강이 필요**하다.
6. 다만 **현재 구현 위치 판단**은 `revenue` 가 아니라 `seo` 가 맞다. 이유는 개발팀 원본 repo를 건드리지 않으면서 빠르게 검증할 수 있기 때문이다.
7. 따라서 다음 액션은 `seo/backend 기준 callprice API 1차 구현 완료`, `seo/frontend 화면 추가 또는 확장`, `revenue 수치와 비교 검증`, `비교군/실험 설계 문서화`, `운영 이관 여부 재판단` 순서가 맞다.

## 9. GitHub 원본 코드 취급 원칙과 로컬 가동 가능 여부

### 9-1. 원본 코드 취급 원칙

- `BiocomKR/backend`, `BiocomKR/frontend` 는 개발팀 원본으로 보고 **당장은 직접 수정하지 않는 것**을 기본 원칙으로 둔다.
- 현재 단계에서는 `coding/seo` 에서 설계, 분석, 검증과 `callprice` 1차 실험 구현까지 진행하고, 원본 repo 수정은 뒤로 미룬다.
- 실제 구현 승인 이후에도, 바로 원본 main을 건드리기보다 로컬 브랜치 또는 별도 작업 공간에서 검증 후 반영하는 흐름이 맞다.

### 9-2. `revenue/backend` 로컬 가동 가능 여부

결론:
- **구조상 로컬 가동 가능하다.**
- 근거:
  - `README.md` 존재
  - `.env.example` 존재
  - `requirements.txt` 존재
  - `Dockerfile`, `docker-compose.yml`, `docker-compose.local.yml` 존재
  - 현재 작업 머신에서 `fastapi`, `uvicorn`, `sqlalchemy`, `asyncpg` import 가능 확인

예상 로컬 실행 경로:

```bash
cd /Users/vibetj/coding/revenue/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

또는:

```bash
cd /Users/vibetj/coding/revenue/backend
docker-compose up --build
```

로컬 DB만 따로 올리려면:

```bash
cd /Users/vibetj/coding/revenue/backend
docker-compose -f docker-compose.local.yml up -d
```

필수/중요 env:
- `DATABASE_URL`
- `SECRET_KEY`
- `ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`

선택 또는 기능별 필요 env:
- `IAMWEB_*`
- `SCHEDULER_API_TOKEN`
- `CHANNELTALK_*`
- 기타 스토어/API 연동 키

주의:
- core 대시보드 조회만 보면 DB와 JWT 설정이 핵심이다.
- IAMWEB/쿠팡/플레이오토/채널톡 연동은 일부 기능이나 스케줄러에 추가로 필요하다.

### 9-3. `revenue/frontend` 로컬 가동 가능 여부

결론:
- **구조상 로컬 가동 가능하다.**
- 근거:
  - `package.json`, `pnpm-workspace.yaml`, `turbo.json` 존재
  - `apps/portal/package.json` 존재
  - `apps/portal/README.md` 존재
  - `next.config.mjs` 존재
  - 현재 작업 머신에서 `node`, `npm` 사용 가능 확인
  - 글로벌 `pnpm`은 없지만 `corepack pnpm`은 동작 확인

예상 로컬 실행 경로:

```bash
cd /Users/vibetj/coding/revenue/frontend
corepack pnpm install
corepack pnpm dev:portal
```

포털 기본 접속:
- `http://localhost:3000`

중요 env:
- `NEXT_PUBLIC_API_URL`
- `CORS_ALLOWED_ORIGIN` optional

주의:
- 프론트는 `NEXT_PUBLIC_API_URL` 이 없으면 일부 라우트는 기본값 `http://localhost:8000` 을 사용하지만, 로그인/업로드/유저 정보 등은 env 설정이 사실상 필요하다.
- 즉, 프론트만 단독으로 띄우는 것은 가능해도 정상 기능 확인에는 백엔드 로컬 구동이 같이 필요하다.

### 9-4. 이번 문서 기준 최종 판정

- `revenue` 코드는 **로컬에서 띄울 수 있는 형태**로 정리돼 있다.
- 다만 이번 턴에서는 **실제 `revenue` 서버를 새로 기동해 검증하지는 않았다.**
- 따라서 이 문서의 표현은 `구조상 로컬 가동 가능`까지로 한정한다.
- 원본 GitHub 코드를 당장 수정하지 않으려는 TJ님 방향과도 충돌하지 않는다.

## 10. `seo` 기준 1차 개발 결과

### 10-1. 실제 구현 위치

이번 턴 기준 실제 구현은 `coding/seo` 에 들어갔다.

- Backend Service: `seo/backend/src/callprice.ts`
- Backend Router: `seo/backend/src/routes/callprice.ts`
- Server Registration: `seo/backend/src/server.ts`
- Tests: `seo/backend/tests/callprice.test.ts`
- Frontend Page: `seo/frontend/src/app/callprice/page.tsx`
- Frontend Types: `seo/frontend/src/types/callprice.ts`

판단 이유:

- TJ님이 개발팀 원본 GitHub repo는 당장 수정하지 않으려 한다.
- `seo` 는 이미 `7020` 백엔드와 `7010` 프론트를 별도로 가동 중이라 실험 구현과 검증이 빠르다.
- `revenue` 는 계속 설계/수치/UX 기준선으로 참조하고, 운영 이관은 나중에 결정한다.

### 10-2. 이번 턴에 구현된 API

다음 endpoint를 `seo/backend` 에 실제 구현했다.

- `GET /api/callprice/options`
- `GET /api/callprice/overview`
- `GET /api/callprice/managers`
- `GET /api/callprice/analysis-types`
- `GET /api/callprice/scenario`
- `GET /api/callprice/daytype-comparison`
- `GET /api/callprice/rampup`
- `GET /api/callprice/supplement-purchase-timing`

현재 response envelope:

```json
{
  "status": "success",
  "data": {},
  "meta": {},
  "notes": []
}
```

### 10-3. 구현 범위

이번 1차 구현에서 들어간 계산은 아래다.

- 상담 완료 row는 `tb_consultation_records` 에서 가져온다.
- 고객 단위 anchor는 `기간 내 완료 상담의 최초 상담일`로 잡는다.
- 상담사 귀속은 `기간 내 최초 완료 상담 담당자` 기준이다.
- 정상 주문은 `tb_iamweb_users` 에서 `final_order_amount > 0`, 취소/반품 사유 empty 기준으로 보수적으로 판정한다.
- 상담군 매출은 `anchor date + maturity_days` 윈도우 안의 정상 주문 매출 합계다.
- 미상담 비교군은 `customer_report_info` + `tb_consultation_records` 를 이용해 `전체 기간 기준 완료 상담 이력 없는 검사 고객`으로 만든다.
- `analysis_type_non_consultation` 은 `analysis_type -> report_type` 휴리스틱 매핑을 이용한 1차 버전이다.

현재 휴리스틱 매핑:

- `알러지`, `음식물` -> `음식물 과민증`
- `중금속`, `유기산`, `장내` -> `종합대사기능`
- `호르몬` -> `종합호르몬`, `스트레스노화 호르몬`

즉 이 구현은 **준증분 추정 API의 첫 버전**이며, 아직 인과 추정 모델이나 승인된 운영 KPI 엔진은 아니다.

### 10-4. 실데이터 검증 결과

검증일 기준 reference date는 `2026-03-29` 이다.

`/api/callprice/options`

- `manager_options`: `민정`, `경태`, `예진`, `선희`, `글라`, `연정`, `팀장님`, `동주`, `서동주` 등 반환 확인
- `analysis_type_options`: `알러지`, `중금속`, `유기산`, `음식물`, `장내`, `호르몬` 등 반환 확인

`/api/callprice/overview?start_date=2025-12-01&end_date=2025-12-31&maturity_days=90&baseline_scope=global_non_consultation`

- `completed_consultations`: `336`
- `unique_completed_customers`: `328`
- `matured_customers`: `306`
- `converted_customers`: `92`
- `avg_revenue_per_customer`: `153,425`
- `baseline_avg_revenue_per_customer`: `6,868`
- `estimated_incremental_revenue`: `44,846,537`

`/api/callprice/managers?start_date=2025-12-01&end_date=2025-12-31&maturity_days=90&baseline_scope=global_non_consultation`

- 상위 상담사 예시:
  - `글라`: `estimated_incremental_revenue=17,545,487`
  - `민정`: `estimated_incremental_revenue=15,677,409`
  - `예진`: `estimated_incremental_revenue=9,303,011`
  - `선희`: `estimated_incremental_revenue=2,320,630`

`/api/callprice/overview?start_date=2025-12-01&end_date=2025-12-31&maturity_days=90&baseline_scope=analysis_type_non_consultation&analysis_type=알러지`

- `baseline_avg_revenue_per_customer`: `9,492`
- `estimated_incremental_revenue`: `29,076,125`

`/api/callprice/scenario?start_date=2025-12-01&end_date=2025-12-31&maturity_days=90&baseline_scope=global_non_consultation&monthly_cost=4500000&headcount=2`

- `estimated_incremental_revenue`: `21,699,938`
- `estimated_incremental_profit`: `12,699,938`
- `incremental_revenue_multiple`: `2.411`

주의:

- 현재 API 필드명은 `estimated_incremental_profit` 이지만, Phase 1 문서 해석상 의미는 `인건비 차감 후 잔여매출`에 가깝다.
- 상품 원가, 물류, 환불, 광고비, 공헌이익률이 빠져 있으므로 회계적 의미의 `이익` 또는 `ROI`로 읽으면 안 된다.

### 10-4-1. 상담군 vs 미상담군 전환/재구매 비교

이 비교는 `ltr_customer_cohort`를 모집단으로 쓰고, `base_date <= 2025-12-28` 인 전체 `90일 성숙 코호트`를 대상으로 계산했다.

정의:

- 상담군: `ltr_customer_cohort.cohort_type='consultation'`
- 미상담군: `ltr_customer_cohort.cohort_type='non_consultation'`
- 영양제 전환율: 기준일 이후 `90일` 안에 영양제 주문이 1건 이상 있는 고객 비율
- 검사 서비스 전환율: 기준일 이후 `90일` 안에 추가 검사 서비스 주문이 1건 이상 있는 고객 비율
- 전체 재구매율: 기준일 이후 `90일` 안에 정상 주문이 2건 이상 있는 고객 비율
- 구매자 기준 재구매율: 구매 고객 중 주문 2건 이상 고객 비율
- 평균 주문 수: 구매 고객 1인당 평균 정상 주문 수

실측값:

| 지표 | 상담군 | 미상담군 | 차이 |
|---|---:|---:|---:|
| 성숙 고객 수 | 3,932명 | 21,414명 | - |
| 전체 구매 전환율 | 27.1% | 3.8% | +23.3%p / 7.1배 |
| 영양제 전환율 | 23.2% | 1.8% | +21.4%p / 12.9배 |
| 추가 검사 서비스 전환율 | 4.5% | 2.0% | +2.5%p / 2.3배 |
| 전체 재구매율 | 15.0% | 1.3% | +13.7%p / 11.5배 |
| 구매자 기준 재구매율 | 55.3% | 35.7% | +19.6%p / 1.55배 |
| 구매 고객당 평균 주문 수 | 2.62회 | 2.02회 | +0.60회 / 1.30배 |
| 재구매 고객당 평균 추가 주문 수 | 2.92회 | 2.85회 | +0.07회 / 1.02배 |

해석:

1. 가장 큰 차이는 `재구매를 하게 만드는 진입 확률`이다.
2. 상담군은 미상담군보다 영양제 전환율이 특히 크다. 현재 계산에서는 약 `12.9배` 높다.
3. 추가 검사 서비스 전환도 상담군이 높지만, 영양제만큼 차이가 크지는 않다.
4. 일단 재구매 고객이 된 뒤의 `추가 주문 깊이`는 두 집단 차이가 상대적으로 작다.
5. 즉 상담의 핵심 기여는 `반복 구매 고객을 더 많이 만드는 것`에 가깝고, 이미 반복 구매를 시작한 고객의 주문 깊이를 극단적으로 늘리는 효과는 상대적으로 작다.

주의:

- 이 수치는 `관측 차이`이며 인과적으로 확정된 순증분 값은 아니다.
- 주문 분류 규칙은 현재 `검사 서비스 / 영양제 / 기타` 휴리스틱 기반이다.
- 기준일은 상담군은 `최초 완료 상담일`, 미상담군은 `최초 검사일`을 사용한 코호트다.

### 10-3-1. 상담 후 영양제 첫 구매 시점 분포

이번 턴에서는 `GET /api/callprice/supplement-purchase-timing` 을 추가해, 상담을 받은 고객이 **첫 완료 상담일 이후 언제 처음 영양제를 구매하는지**를 따로 보도록 했다.

기준:

- 범위: `2025-04-01 ~ 2026-03-27`
- 기준일: `2026-03-29`
- 표본: 첫 완료 상담 후 `90일`이 지난 성숙 상담 고객
- 건수 기준: 고객 1명당 `첫 영양제 주문 1건`만 잡는다
- 구간 정의:
  - `상담 당일` = 상담일과 같은 날 첫 구매
  - `3일 이내` = 상담 후 `1~3일`
  - `7일 이내` = 상담 후 `4~7일`
  - `14일 이내` = 상담 후 `8~14일`
  - `30일 이내` = 상담 후 `15~30일`
  - `31일 이후` = 상담 후 `31일 이상`

실측값:

- 성숙 상담 고객: `2,784명`
- 이 중 영양제 구매 고객: `684명`
- 영양제 전환율: `24.6%`

| 구간 | 고객 수 | 영양제 구매 고객 내 비중 | 성숙 상담 고객 전체 대비 비중 |
|---|---:|---:|---:|
| 상담 당일 | 296명 | 43.3% | 10.6% |
| 3일 이내 | 142명 | 20.8% | 5.1% |
| 7일 이내 | 50명 | 7.3% | 1.8% |
| 14일 이내 | 32명 | 4.7% | 1.1% |
| 30일 이내 | 37명 | 5.4% | 1.3% |
| 31일 이후 | 127명 | 18.6% | 4.6% |

누적 해석:

1. 영양제를 산 고객의 `43.3%`는 상담 당일 바로 산다.
2. 영양제를 산 고객의 `64.1%`는 `3일 안`에 산다.
3. 영양제를 산 고객의 `71.4%`는 `7일 안`에 산다.
4. 영양제를 산 고객의 `81.4%`는 `30일 안`에 산다.
5. 반대로 `31일 이후`까지 늦게 사는 고객은 `18.6%`다.

실무 해석:

1. 상담 후 영양제 구매는 `당일~3일` 구간에 가장 많이 몰려 있다.
2. 따라서 상담사 스크립트, 장바구니 리마인드, 결제 유도 메시지는 `당일`과 `3일 안`이 가장 중요하다.
3. `31일 이후` 고객도 완전히 적지는 않다. 그래서 `즉시 전환`만 볼 게 아니라, 2차 리마인드나 후속 복약 제안도 여전히 의미가 있다.
4. 하지만 우선순위는 분명히 `상담 직후`, 특히 `당일~3일`이다.

### 10-3-2. 영양제 시작 고객의 1년 재구매 패턴

이번 턴에서는 `GET /api/callprice/supplement-repeat-pattern` 을 추가해,
**상담 후 영양제를 처음 구매한 고객이 1년 안에 몇 번 다시 사는지**를 따로 보도록 했다.

중요 정의:

- 대상: 첫 완료 상담 이후 `영양제 첫 구매`가 발생한 고객
- 관찰창: `첫 영양제 구매일` 이후 `365일`
- 포함 조건: 그 365일을 끝까지 볼 수 있는 고객만 재구매 분포에 포함
- `총 구매 횟수`: 첫 구매 1회를 포함한 횟수
- `추가 재구매 횟수`: 첫 구매를 제외하고 다시 산 횟수

기준:

- 범위: `2024-04-01 ~ 2026-03-27`
- 기준일: `2026-03-29`

실측값:

- 완료 상담 고객: `5,895명`
- 이 중 영양제 시작 고객: `1,502명`
- 이 중 1년을 끝까지 관찰할 수 있는 고객: `551명`
- 최근 시작이라 1년 관찰창이 아직 닫히지 않아 제외된 고객: `951명`

핵심 지표:

- 1년 평균 총 영양제 구매 횟수: `4.02회`
- 1년 평균 추가 재구매 횟수: `3.02회`
- 2회 이상 구매 비율: `65.3%`
- 3회 이상 구매 비율: `45.6%`
- 4회 이상 구매 비율: `32.3%`
- 6회 이상 구매 비율: `21.4%`

분포/분위:

- 중간값(p50): `2회`
- 상위 25% 구간(p75): `5회`
- 상위 10% 구간(p90): `10회`

구간 분포:

| 구간 | 고객 수 | 1년 관찰 가능 고객 내 비중 |
|---|---:|---:|
| 첫 구매만 하고 종료 | 191명 | 34.7% |
| 1회 재구매 (총 2회) | 109명 | 19.8% |
| 2회 재구매 (총 3회) | 73명 | 13.2% |
| 3회 이상 재구매 (총 4회+) | 178명 | 32.3% |

해석:

1. 영양제를 한 번 시작한 고객은 평균적으로 `1년 동안 총 4.02회` 구매한다. 즉 첫 구매 이후에도 평균 `3.02회`는 더 산다.
2. `2회 이상 구매 비율 65.3%`라는 것은, 영양제를 시작한 고객의 약 3분의 2가 적어도 한 번은 다시 산다는 뜻이다.
3. 반대로 `첫 구매만 하고 종료`가 `34.7%`다. 즉 첫 전환 자체도 중요하지만, 첫 구매 직후 재구매 전환 설계가 여전히 큰 개선 포인트다.
4. `상위 25%`는 1년 안에 총 `5회`, `상위 10%`는 총 `10회`까지 간다. 장기 복용 고객의 꼬리가 꽤 두껍다는 뜻이다.
5. 따라서 CRM 전략은 `첫 구매 만들기`로 끝나면 안 되고, `첫 구매 후 30일/60일/90일 재복용 리마인드`까지 이어져야 한다.

### 10-3-3. 정기구독 데이터 존재 여부와 전환율

TJ님 질문 기준으로는 이걸 **두 층으로 분리해서** 봐야 한다.

1. `현재 영양제 정기구독을 하고 있는 사람을 정확히 셀 수 있는가`
2. `일반 영양제 구매 고객이 나중에 정기구독으로 얼마나 넘어가는가`

현재 운영 DB 기준 결론:

- `현재 활성 구독자 수`를 정확히 세는 데이터는 **없다**
- 하지만 `정기 상품 주문 이력`, `정기구독 전환율`, `영양제 매출 중 정기구독 비중` 데이터는 **있다**

왜 이렇게 판단하나:

- `tb_iamweb_users`에는 정기 상품 주문 이력은 있다
- `vw_subscription_conversion_ratio`에는 일반 구매 후 정기구독 전환율이 있다
- `vw_supplement_subscription_ratio`에는 영양제 매출 중 정기구독 비중이 있다
- 반면 `현재 활성 여부`를 직접 보여주는 `구독 시작일`, `구독 종료일`, `다음 결제 예정일`, `활성/해지 상태` 같은 고객 상태 테이블/컬럼은 현재 확인되지 않았다
- 스키마에서 `subscription` 관련 base table로 확인된 것은 `tb_notification_subscriptions` 뿐이었고, 이건 고객 정기구독이 아니라 알림 구독 테이블이다

실측값:

- 유효 정기 상품 주문 행: `11,368행`
- 정기 상품을 한 번 이상 산 고객: `1,991명`
- 최신 정기 상품 주문 시각: `2026-03-28 22:30:12`
- 최근 월(`2026-03`) 정기 상품 구매 고객: `264명`

정기구독 전환율:

| 기간 | 일반 구매 고객 수 | 정기구독 전환 고객 수 | 정기구독 전환율 |
|---|---:|---:|---:|
| 6개월 | 1,916명 | 190명 | 9.9% |
| 1년 | 4,617명 | 377명 | 8.2% |
| 2년 | 6,829명 | 556명 | 8.1% |
| 전체 기간 | 11,413명 | 650명 | 5.7% |

영양제 매출 중 정기구독 비중:

| 기간 | 영양제 총매출 | 정기구독 영양제 매출 | 영양제 매출 중 정기구독 비중 |
|---|---:|---:|---:|
| 6개월 | 5억 9,360만 3,309원 | 1억 3,418만 8,193원 | 22.6% |
| 1년 | 13억 7,749만 6,436원 | 2억 6,301만 6,257원 | 19.1% |
| 2년 | 22억 9,364만 6,104원 | 4억 9,213만 4,584원 | 21.5% |
| 전체 기간 | 39억 9,963만 3,040원 | 5억 2,649만 3,232원 | 13.2% |

해석:

1. `현재 활성 정기구독자 수`는 아직 정확히 못 센다. 그래서 프론트에는 **없음**으로 표기하는 것이 맞다.
2. 하지만 `정기 상품 주문 이력`은 최근까지 살아 있고, 주문 최신일도 `2026-03-28`이다. 즉 데이터가 완전히 없는 것은 아니다.
3. `정기구독 전환율 9.9%(6개월)`는 **일반 영양제를 먼저 산 고객 1,916명 중 190명이 이후 정기구독으로 넘어갔다**는 뜻이다.
4. `영양제 매출 중 정기구독 비중 22.6%(6개월)`는 **최근 6개월 영양제 매출의 약 4분의 1이 정기구독 상품에서 나왔다**는 뜻이다.
5. 따라서 지금 당장 필요한 판단은 `활성 구독자 운영 대시보드`가 아니라, `일반 구매 -> 정기구독 전환`과 `정기 매출 비중`을 먼저 관리하는 쪽이다.

### 10-3-4. 상담군 vs 미상담군 정기구독 전환율

이번 턴에서는 `상담을 받은 사람이 정기구독으로 더 잘 넘어가는가`도 따로 비교했다.

중요 정의:

- 분모는 `일반 영양제를 먼저 산 고객`이다
- 그 고객이 `첫 일반 영양제 구매일 이전`에 완료 상담이 있었으면 `상담군`
- 없으면 `미상담군`
- 그 뒤에 정기 상품을 한 번이라도 사면 `정기구독 전환`

즉 이 표는 `상담 고객 전체 중 몇 %가 정기구독으로 갔나`가 아니라,
**`일반 영양제를 한번 시작한 고객 중` 누가 더 정기구독으로 넘어갔는가**를 보는 표다.

실측값:

| 기간 | 상담군 일반 구매 고객 | 상담군 전환 고객 | 상담군 전환율 | 미상담군 일반 구매 고객 | 미상담군 전환 고객 | 미상담군 전환율 | 차이 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 6개월 | 422명 | 45명 | 10.7% | 1,089명 | 35명 | 3.2% | +7.5%p |
| 1년 | 804명 | 60명 | 7.5% | 3,500명 | 106명 | 3.0% | +4.5%p |
| 2년 | 1,180명 | 81명 | 6.9% | 5,679명 | 226명 | 4.0% | +2.9%p |
| 전체 기간 | 1,219명 | 82명 | 6.7% | 10,612명 | 355명 | 3.3% | +3.4%p |

해석:

1. 최근 6개월 기준으로는 상담군의 정기구독 전환율이 `10.7%`, 미상담군이 `3.2%`다. 상담군이 `7.5%p` 높고, 비율로 보면 약 `3.3배`다.
2. 1년 기준으로도 상담군 `7.5%`, 미상담군 `3.0%`로 차이가 유지된다.
3. 기간을 길게 볼수록 차이는 줄지만, `2년`, `전체 기간`에서도 상담군이 계속 더 높다.
4. 따라서 현재 관측으로는 상담이 `첫 영양제 구매`에서 끝나는 것이 아니라, 그 뒤 `정기구독 구조`로 넘어가는 데에도 유의미한 차이를 만드는 쪽으로 보인다.

주의:

- 이 값도 인과 추정이 아니라 관측 차이다.
- 상담 매칭은 `주문 연락처`와 `상담 연락처`를 정규화해 붙였기 때문에, 가족 주문이나 전화번호 불일치가 있으면 일부는 미상담군으로 남을 수 있다.
- 그래도 최근 6개월, 1년, 2년, 전체 기간 모두 같은 방향이므로, 단순 노이즈만으로 보기에는 일관성이 있다.

### 10-4-1-평일/주말 상담 추적 가능 여부

결론부터 말하면, **질문을 무엇으로 정의하느냐에 따라 다르다.**

| 질문 | 현재 가능 여부 | 판단 |
|---|:---:|---|
| 예약된 상담의 `완료 전환율`이 평일과 주말에 다른가 | 가능 | `consultation_date`와 `consultation_status`가 있으므로 바로 계산 가능 |
| `상담 후 90일 구매전환율`이 평일과 주말에 다른가 | 현재는 사실상 불가 | 주말 `최초 완료 상담` 고객의 90일 성숙 표본이 아직 없음 |

현재 바로 가능한 것은 `예약 -> 완료` 전환율 비교다.

실측값:

| 지표 | 평일 상담 | 주말 상담 | 차이 |
|---|---:|---:|---:|
| 전체 상담 건수 | 8,230건 | 88건 | - |
| 완료 건수 | 6,878건 | 72건 | - |
| 완료 전환율 | 83.6% | 81.8% | -1.8%p |
| 부재율 | 10.0% | 12.5% | +2.5%p |
| 변경/시간변경율 | 4.9% | 1.1% | -3.8%p |
| 취소율 | 0.4% | 0.0% | -0.4%p |

해석:

1. `예약 -> 완료` 기준으로는 현재 평일과 주말이 아주 크게 다르다고 보기 어렵다.
2. 다만 주말 표본이 `88건`으로 매우 작아서, 현재 수치는 방향 참고용에 가깝다.
3. 주말 상담은 `2025-10-25`부터 관측되지만, `최초 완료 상담일`이 주말인 고유 고객은 `2026-01-03`부터 나타난다.
4. 따라서 현재 callprice 기준인 `최초 완료 상담일 + 90일 구매전환`으로는 주말 비교 표본이 아직 성숙되지 않았다.
5. 이 비교가 가능해지는 가장 이른 시점은 `2026-04-03` 이후다.

즉시 판단:

- `상담 완료율` 비교는 지금도 추적 가능하다.
- `상담 후 구매전환율`의 평일/주말 비교는 **이론상 가능하지만, 2026-03-29 현재는 아직 아니다.**

### 10-4-1-1. 주말 상담 가치 비교

TJ님 질문처럼 `주말 상담이 더 가치 있는가`를 보려면, 지금은 **두 숫자를 서로 다른 기준으로 나눠서** 봐야 한다.

- `예약 -> 완료 전환율`은 **예약된 상담 전체**를 기준으로 본 숫자다.
- 아래 가치 비교는 **상담을 끝낸 고객이 30일 안에 실제로 얼마나 구매했는지**를 기준으로 본 숫자다.
- 원래는 `90일` 기준으로 보는 것이 더 좋지만, 주말 상담은 시작한 지 오래되지 않아 아직 `90일치 구매 결과`가 충분히 쌓이지 않았다.
- 그래서 현재는 먼저 `30일 기준`으로 비교하고, `90일 비교`는 표본이 더 쌓인 뒤 다시 보는 것이 맞다.
- 아래 실측값은 당시 주말 비교를 잡았던 `2025-04-01 ~ 2026-03-27` 기준이다.

실측값:

| 지표 | 평일 | 주말 | 차이 |
|---|---:|---:|---:|
| 예약 -> 완료 전환율 | 86.1% | 81.7% | -4.4%p |
| 30일 성숙 고객 수 | 3,308명 | 30명 | - |
| 30일 구매 전환율 | 24.2% | 46.7% | +22.5%p / 1.93배 |
| 30일 고객당 매출 | 7만 3,879원 | 9만 6,162원 | +2만 2,283원 / 1.30배 |
| 30일 LTR | 30만 5,871원 | 20만 6,062원 | -9만 9,809원 / 0.67배 |
| 상담 완료 1건당 30일 매출 | 6만 2,858원 | 4만 8,896원 | -1만 3,962원 / 0.78배 |

해석:

1. 현재 표본에서는 `주말 상담`이 `평일 상담`보다 30일 구매 전환율이 높고, `고객당 매출`도 더 높다.
2. 반면 `예약 -> 완료 전환율`은 주말이 더 낮고, `상담 완료 1건당 30일 매출`도 주말이 더 낮다.
3. 여기서 `30일 고객당 매출`은 **손님 한 명당 객단가**에 가깝다. 식당으로 비유하면 `주말 손님 1명이 평일 손님 1명보다 더 비싼 메뉴를 시키는가`를 보는 숫자다.
4. 반면 `상담 완료 1건당 30일 매출`은 **자리 한 칸당 매출**에 가깝다. 같은 식당 비유로 보면 `테이블 한 개를 한 번 돌렸을 때 결국 얼마를 벌었는가`를 보는 숫자다.
5. 그래서 현재 숫자는 `주말 손님 자체는 더 잘 사는 편`이지만, `주말 상담 슬롯 한 칸이 벌어오는 돈`까지 평일보다 높다고 보기는 어렵다는 뜻이다.
6. 쉽게 말해, **주말에 상담까지 온 고객은 평일보다 더 빨리 사고, 돈도 더 쓰는 편**이다. 하지만 **예약된 상담 한 건 전체를 놓고 보면 주말이 더 효율적이라고 말하기는 아직 이르다.**
7. `구매 고객 1인당 LTR`도 주말이 더 낮다. 따라서 주말의 강점은 `더 비싼 고객`이라기보다 `구매 진입이 빠른 고객`일 가능성이 있다.
8. 현재는 주말 기준으로 30일 결과를 끝까지 볼 수 있는 고객이 `30명`뿐이므로, 이 수치는 **초기 방향 확인용**으로 보는 것이 안전하다.
9. 리더십 보고에서는 `주말 상담은 고객 기준 가치가 더 높아 보이지만, 상담 1건 효율까지 더 높다고 단정하기는 이르다` 정도가 가장 안전한 표현이다.

### 10-4-2. 상담군 vs 미상담군 6개월, 1년 LTR 차이

이 비교는 `ltr_customer_cohort` 전체 성숙 코호트를 기준으로, 상담군과 미상담군의 `180일`, `365일` 누적 성과를 비교한 것이다.

중요 정의:

- 여기서 `LTR`은 `해당 기간 내 구매한 고객 1인당 평균 누적 매출`이다.
- `고객당 매출`은 `성숙 고객 전체`를 분모로 둔 값이다.
- 상담 효과를 해석할 때는 두 값을 같이 봐야 한다. `LTR`만 보면 전환 효과가 가려질 수 있다.

실측값:

| 지표 | 상담군 | 미상담군 | 차이 |
|---|---:|---:|---:|
| 6개월 성숙 고객 수 | 3,062명 | 17,089명 | - |
| 6개월 구매 전환율 | 29.8% | 4.7% | +25.1%p / 6.3배 |
| 6개월 LTR | 43만 5,677원 | 44만 8,792원 | -1만 3,115원 / 0.97배 |
| 6개월 고객당 매출 | 12만 9,622원 | 2만 1,062원 | +10만 8,560원 / 6.15배 |
| 1년 성숙 고객 수 | 1,440명 | 5,371명 | - |
| 1년 구매 전환율 | 36.7% | 8.6% | +28.1%p / 4.27배 |
| 1년 LTR | 49만 4,545원 | 48만 851원 | +1만 3,694원 / 1.03배 |
| 1년 고객당 매출 | 18만 1,333원 | 4만 1,272원 | +14만 61원 / 4.39배 |

해석:

1. `구매 고객당 LTR`만 보면 6개월 구간에서는 상담군이 오히려 소폭 낮고, 1년 구간에서는 소폭 높다.
2. 반면 `고객당 매출`은 6개월, 1년 모두 상담군이 훨씬 높다.
3. 즉 상담의 핵심 기여는 `이미 구매한 고객 1명의 장기 매출을 극적으로 키우는 것`보다 `구매하게 되는 고객 수 자체를 크게 늘리는 것`에 더 가깝다.
4. 리더십 보고에서는 `6개월/1년 LTR`만 단독으로 쓰지 말고, 반드시 `구매 전환율`과 `고객당 매출`을 같이 적어야 해석 오류가 줄어든다.

주의:

- 이 값도 `관측 차이`이며 인과 추정이 아니다.
- `LTR` 정의를 `구매 고객당 평균 누적 매출`로 썼기 때문에, `고객당 매출`과 혼용하면 안 된다.

### 10-4-3. 더 정밀한 분해용 데이터 존재 여부

결론부터 말하면, **있다.**  
현재 운영 DB만으로도 아래 3가지는 바로 계산 가능하다.

| 분해 축 | 사용 컬럼/테이블 | 현재 가능 여부 | 해석에 주는 도움 |
|---|---|:---:|---|
| 구매자 매출 분포 `p50/p75/p90` | `tb_iamweb_users.final_order_amount` + 고객별 window 집계 | 가능 | 차이가 상위 꼬리 효과인지, 전체 분포 이동인지 확인 가능 |
| 상품 믹스 | `tb_iamweb_users.product_name` | 가능 | 상담군의 매출 차이가 단순히 고가 상품 비중 때문인지 확인 가능 |
| 첫 구매까지 걸린 일수 | `tb_iamweb_users.payment_complete_time/order_date` - `ltr_customer_cohort.base_date` | 가능 | 상담이 구매를 앞당기는 구조인지 확인 가능 |

다만 아직 부족한 것:

- `유입원`, `캠페인`, `할인정책`, `배정됐지만 미완료된 상담군` 기준 비교군이 아직 약하다.
- 따라서 이 데이터들은 `선택편향 / 상품믹스 / 구매 가속 효과`를 한 단계 더 정확하게 나누는 데는 충분하지만, 인과 추정의 완전한 증거는 아니다.

### 10-4-4. 6개월, 1년 분포/상품믹스/첫 구매일수 실측값

구매자 매출 분포와 첫 구매까지 걸린 일수:

| 지표 | 상담군 | 미상담군 | 차이 해석 |
|---|---:|---:|---|
| 6개월 구매자 매출 p50 | 19만 7,407원 | 25만 1,532원 | 중간 구매자 객단가는 상담군이 더 낮음 |
| 6개월 구매자 매출 p75 | 42만 9,840원 | 48만 3,421원 | 상위 25% 구간도 미상담군이 약간 높음 |
| 6개월 구매자 매출 p90 | 107만 8,480원 | 87만 5,880원 | 상위 10% 꼬리는 상담군이 더 큼 |
| 6개월 첫 구매일수 p50 | 1일 | 16일 | 상담군이 훨씬 빠르게 구매 |
| 6개월 첫 구매일수 p75 | 12일 | 54일 | 중상위 구간도 큰 차이 |
| 6개월 첫 구매일수 p90 | 61일 | 108일 | 늦게 사는 고객도 상담군이 더 빠름 |
| 1년 구매자 매출 p50 | 24만 1,629원 | 25만 1,300원 | 거의 비슷하나 상담군이 약간 낮음 |
| 1년 구매자 매출 p75 | 48만 2,086원 | 48만 1,970원 | 사실상 동일 |
| 1년 구매자 매출 p90 | 116만 5,256원 | 92만 1,120원 | 상위 꼬리는 상담군이 더 큼 |
| 1년 첫 구매일수 p50 | 3일 | 25일 | 상담군 구매 속도가 매우 빠름 |
| 1년 첫 구매일수 p75 | 35일 | 134일 | 상위 구간 차이도 매우 큼 |
| 1년 첫 구매일수 p90 | 186일 | 253일 | 늦게 사는 고객까지 앞당겨짐 |

상품 믹스는 `매출 기준`으로 봤다.

| 기간 | 집단 | 영양제 비중 | 검사 서비스 비중 | 기타 비중 |
|---|---|---:|---:|---:|
| 6개월 | 상담군 | 57.9% | 18.0% | 24.1% |
| 6개월 | 미상담군 | 33.2% | 50.1% | 16.7% |
| 1년 | 상담군 | 56.7% | 26.0% | 17.3% |
| 1년 | 미상담군 | 35.6% | 49.9% | 14.5% |

해석:

1. `구매자 매출 분포`를 보면 상담군이 모든 분위에서 더 높은 구조는 아니다. 6개월 p50/p75는 오히려 미상담군이 높고, 1년 p50/p75는 거의 비슷하다.
2. 반면 `p90`은 6개월, 1년 모두 상담군이 더 높다. 즉 상담군은 상위 꼬리 고객이 더 강한 편이다.
3. `첫 구매까지 걸린 일수`는 상담군이 압도적으로 짧다. 이는 단순 상품믹스 차이만으로 설명하기 어려운 `구매 가속` 신호다.
4. `상품 믹스`도 단순 고가 검사 비중으로 상담군 매출이 높아진 구조와는 다르다. 오히려 미상담군이 검사 서비스 비중이 더 높고, 상담군은 영양제 비중이 훨씬 높다.
5. 따라서 현재 관측 차이는 `고가 검사 상품을 더 팔아서 생긴 차이`라기보다, 상담이 구매 진입을 빠르게 만들고 영양제 후속 구매를 늘리는 구조일 가능성이 더 높다.
6. 다만 여전히 `선택편향`은 남아 있다. 구매 의지가 원래 높은 고객이 상담군에 더 많이 들어왔을 가능성은 `유입원`, `동일 월`, `동일 분석유형`, `배정됐지만 미완료 고객` baseline으로 추가 검증해야 한다.

### 10-4-5. 신규 상담사 초기 랜딩 속도 비교

이번 턴에서는 `GET /api/callprice/rampup` 을 확장해, `월차 3구간`, `2주 단위 6구간`, `5주차/10주차 체크포인트`를 한 번에 보도록 바꿨다.

이번에 확정한 전제:

- `동주`, `서동주`, `팀장님`은 같은 사람으로 보고 `동주`로 합산한다.
- 실제 입사일이 확인된 오래된 상담사는 기본 랜딩 평균에서 제외한다.
- 확인된 실제 입사일:
  - `경태`: `2022-06-21`
  - `동주(=서동주=팀장님)`: `2023-07-24`
  - `민정`: `2023-11-20`
- 위 3명은 DB 관측 시작(`2024-01-02`)보다 먼저 입사했기 때문에, `입사 후 1~10주차` 원본 데이터가 비어 있거나 일부만 남아 있다.
- 따라서 기본 랜딩 평균은 `예진`, `연정`, `글라`, `선희` 4명을 기준으로 본다.

#### 월차 3구간 실측값

| 월차 | 포함 상담사 수 | 완료 상담 | 성숙 고객 | 구매 전환율 | 고객당 매출 | 상담 효과/고객 | 상담 효과 매출 | 상담 1건 가치 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1개월차 | 4명 | 336건 | 278명 | 25.2% | 8만 7,875원 | 7만 7,144원 | 2,145만원 | 6만 3,828원 |
| 2개월차 | 4명 | 489건 | 370명 | 17.8% | 6만 7,910원 | 5만 5,283원 | 2,045만원 | 4만 1,830원 |
| 3개월차 | 3명 | 272건 | 193명 | 26.4% | 22만 8,700원 | 22만 897원 | 4,263만원 | 15만 6,739원 |

해석:

1. 첫 달에도 상담 1건 가치가 `6만 3,828원`으로 이미 나온다.
2. 다만 `2개월차`는 상담 1건 가치가 `4만 1,830원`으로 한 번 주춤한다.
3. `3개월차`는 상담 1건 가치가 `15만 6,739원`까지 올라간다.
4. 즉 평균적으로는 `첫 달부터 기본 성과는 나오지만, 5~8주차에 흔들리고, 9~12주차에 다시 올라오는 구조`에 가깝다.

#### 2주 단위 경향성

| 구간 | 완료 상담 | 성숙 고객 | 구매 전환율 | 고객당 매출 | 상담 효과/고객 | 상담 효과 매출 | 상담 1건 가치 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1~2주차 | 118건 | 118명 | 22.9% | 8만 3,748원 | 7만 1,447원 | 843만원 | 7만 1,447원 |
| 3~4주차 | 170건 | 126명 | 25.4% | 8만 2,590원 | 7만 4,798원 | 942만원 | 5만 5,438원 |
| 5~6주차 | 254건 | 187명 | 18.2% | 7만 3,682원 | 6만 1,205원 | 1,145만원 | 4만 5,060원 |
| 7~8주차 | 230건 | 178명 | 18.0% | 6만 163원 | 4만 8,339원 | 860만원 | 3만 7,410원 |
| 9~10주차 | 140건 | 111명 | 29.7% | 25만 249원 | 24만 1,096원 | 2,676만원 | 19만 1,155원 |
| 11~12주차 | 130건 | 94명 | 22.3% | 17만 7,247원 | 16만 7,628원 | 1,576만원 | 12만 1,208원 |

해석:

1. `1~4주차`는 기본 성과가 이미 나온다.
2. `5~8주차`에는 전환율과 상담 1건 가치가 같이 내려간다.
3. `9~10주차`에 가장 크게 뛴다. 현재 데이터에서는 이 구간이 실질적인 `랜딩 완료` 시점처럼 보인다.
4. `11~12주차`는 `9~10주차`보다는 내려오지만 여전히 `1~8주차`보다 높다.

#### 5주차, 10주차 수습 평가용 30일 기준선

실시간 수습 평가는 `90일`보다 `30일` 기준이 맞다. 이유는 5주차, 10주차 시점에는 90일 결과가 아직 쌓이지 않기 때문이다.

체크포인트 평균:

| 평가 시점 | 완료 상담 | 30일 구매 전환율 | 30일 고객당 매출 | 상담 효과/고객 | 상담 효과 매출 | 상담 1건 가치 |
|---|---:|---:|---:|---:|---:|---:|
| 5주차 | 424건 | 21.3% | 6만 8,084원 | 6만 1,875원 | 2,562만원 | 6만 416원 |
| 10주차 | 912건 | 22.1% | 8만 9,106원 | 8만 2,036원 | 7,244만원 | 7만 9,427원 |

최근 4명 기준 개인별 5주차:

| 상담사 | 완료 상담 | 30일 전환율 | 고객당 매출 | 상담 효과/고객 | 상담 1건 가치 | 해석 |
|---|---:|---:|---:|---:|---:|---|
| 연정 | 117건 | 23.5% | 8만 8,854원 | 8만 956원 | 7만 9,572원 | 5주차 빠른 편 |
| 선희 | 130건 | 23.6% | 8만 3,635원 | 8만 812원 | 7만 8,947원 | 5주차 빠른 편 |
| 예진 | 99건 | 21.4% | 5만 5,861원 | 4만 5,826원 | 4만 5,363원 | 평균권 |
| 글라 | 78건 | 13.5% | 2만 5,306원 | 2만 978원 | 1만 9,903원 | 5주차 느린 편 |

최근 4명 기준 개인별 10주차:

| 상담사 | 완료 상담 | 30일 전환율 | 고객당 매출 | 상담 효과/고객 | 상담 1건 가치 | 해석 |
|---|---:|---:|---:|---:|---:|---|
| 선희 | 233건 | 29.0% | 10만 8,017원 | 10만 2,475원 | 9만 8,517원 | 10주차 상위 |
| 예진 | 251건 | 22.6% | 9만 3,350원 | 8만 3,244원 | 8만 591원 | 10주차 상위 |
| 글라 | 225건 | 17.4% | 8만 6,553원 | 8만 1,900원 | 7만 9,352원 | 초기 느렸지만 회복 |
| 연정 | 203건 | 18.7% | 6만 5,315원 | 5만 7,579원 | 5만 6,161원 | 10주차 기준 상대 하위 |

#### 수습평가 기준 제안

5주차 1차 수습평가:

| 수준 | 완료 상담 | 30일 구매 전환율 | 상담 1건 가치 | 운영 해석 |
|---|---:|---:|---:|---|
| 최소 | 90건 이상 | 18% 이상 | 3만원 이상 | 계속 교육하며 10주차 재평가 |
| 보통 | 105건 이상 | 22% 이상 | 5만원 이상 | 채용 전환 검토권 |
| 잘함 | 120건 이상 | 24% 이상 | 7만원 이상 | 빠른 랜딩, 핵심 육성 후보 |

10주차 2차 수습평가:

| 수준 | 완료 상담 | 30일 구매 전환율 | 상담 1건 가치 | 운영 해석 |
|---|---:|---:|---:|---|
| 최소 | 200건 이상 | 18% 이상 | 5만원 이상 | 전환 검토 최소선 |
| 보통 | 220건 이상 | 22% 이상 | 7만원 이상 | 무난한 전환권 |
| 잘함 | 240건 이상 | 27% 이상 | 9만원 이상 | 확실한 전환권 |

권장 운영 문구:

- `5주차 최소 미달`이면 바로 탈락 확정보다는 리드 배정/교육/상담 QA를 먼저 확인한다.
- `10주차 최소 미달`이면 채용 전환 보류 또는 비전환 검토가 맞다.
- `10주차 보통`이면 채용 전환 가능 구간으로 본다.
- `10주차 잘함`이면 전환뿐 아니라 핵심 인력 육성 대상으로 본다.

한 줄 결론:

> 현재 데이터에서는 신규 상담사가 첫 달부터 아예 0에 가까운 것은 아니다. 다만 진짜 랜딩이 끝났다고 볼 수 있는 시점은 대체로 `9~10주차`에 가깝고, 수습 평가는 `5주차 30일 기준`과 `10주차 30일 기준`으로 보는 것이 가장 실무적이다.

### 10-5. 해석 시 주의점

현재 구현은 아래 이유로 숫자 해석에 주의가 필요하다.

1. `2026-01-01 ~ 2026-03-27` 범위를 `maturity_days=90` 로 보면 `reference_date=2026-03-29` 기준 성숙 고객이 아직 거의 없어서 `matured_customers=0` 이 나오는 것이 정상이다.
2. `analysis_type_non_consultation` 은 현재 휴리스틱 매핑 기반이므로, 운영 확정 전에는 반드시 참고 지표로만 써야 한다.
3. `scenario` 는 현재 기간 성과를 월 환산한 계산기일 뿐, 공식 인력 계획 모델은 아니다.
4. `share_of_total_estimated_incremental_revenue` 는 음수 기여분을 0으로 두고 양수 기여분만 분모로 계산한다.

### 10-5-1. 장기 매출 비교에서 성숙 고객이 0명인 이유

이 부분은 숫자보다 먼저 `성숙 고객`의 정의를 이해해야 한다.

- 성숙 고객 = `조회 기간 안에 있는 상담 고객` 중에서
- `reference_date - maturity_days` 보다 **이전에 상담을 끝낸 고객**

즉 관찰 기간이 길수록, 더 오래전 상담 고객만 남는다.

현재 `callprice` 기본값은 아래다.

- 조회 기간: `2024-04-01 ~ 2026-03-27`
- 기준일: `2026-03-29`

여기서 컷오프를 계산하면:

- `180일` 컷오프: `2025-09-30`
- `365일` 컷오프: `2025-03-29`

이 뜻은 아래와 같다.

1. `6개월 비교`
   - `2025-09-30` 이전 상담 고객은 성숙 고객에 들어올 수 있다.
   - 현재 조회 시작일이 `2024-04-01` 이므로, 그보다 이전부터 `2025-09-30`까지의 고객이 남는다.
   - 그래서 6개월은 성숙 고객이 `0명`이 아니라 실제로 남는다.
2. `1년 비교`
   - `2025-03-29` 이전 상담 고객만 성숙 고객에 들어올 수 있다.
   - 예전처럼 조회 시작일이 너무 최근이면, 이 컷오프보다 앞선 고객이 범위 안에 없어 `1년 성숙 고객 = 0명` 이 될 수 있다.
   - 지금은 조회 시작일을 `2024-04-01` 로 넓혀 두었기 때문에, 1년 성숙 고객도 실제로 남는다.

한 줄로 말하면:

> 1년치를 보려면 최소 1년 전 상담 고객이 조회 범위 안에 있어야 한다. 조회 시작일이 너무 최근이면 0명이 되고, 지금은 시작일을 넓혀서 0명이 아니게 만든 상태다.

프론트 반영:

- `/callprice` 기본 조회 시작일을 `2025-04-01` 에서 `2024-04-01` 로 앞당겼다.
- 이유는 `reference_date=2026-03-29` 기준 1년 컷오프가 `2025-03-29` 이기 때문이다.
- 시작일을 `2024-04-01` 로 두면 1년 성숙 고객이 실제로 남아서, 장기 비교 카드가 `0명` 상태로 시작하지 않는다.
- 실제 확인값:
  - `start_date=2024-04-01`, `maturity_days=180` -> 성숙 고객 `4,148명`
  - `start_date=2024-04-01`, `maturity_days=365` -> 성숙 고객 `2,317명`

실무적으로는 이렇게 읽으면 된다.

- 최근 3~6개월만 잡아놓고 `1년 비교`를 누르면 `0명`이 나올 수 있다.
- 이것은 버그가 아니라 **분모가 성립하지 않는 상태**다.
- `1년 비교`를 제대로 보려면 조회 시작일을 최소 `reference_date - 365일` 보다 더 과거로 넓혀야 한다.

따라서 장기 매출 비교 카드는 아래 순서로 읽는 것이 안전하다.

1. 먼저 `성숙 고객 수`가 0인지 아닌지 본다.
2. 0이면 숫자 해석을 멈추고 조회 기간을 넓힌다.
3. 성숙 고객 수가 충분할 때만 `전환율`, `고객당 매출`, `LTR`을 본다.

### 10-5-2. `callpricefeedback.md` 반영 결정

이번 피드백을 반영해 문서/지표 해석 기준을 아래처럼 고정한다.

1. 산식 고정:
   - `준증분 매출 = 성숙 고객 수 × (상담군 고객당 매출 - 비교군 고객당 매출)`
   - `전환율`은 설명용 지표로만 쓰고, 고객당 매출 산식에 다시 곱하지 않는다.
2. 비교군 민감도:
   - 운영 기본값은 `global_non_consultation`
   - 분석용 baseline은 `analysis_type_non_consultation`, `배정됐지만 완료되지 않은 고객`, `동일 분석유형 × 동일 월` 순으로 확장 검토한다.
3. 상담사 1명 충원 숫자:
   - 단일 점추정이 아니라 `보수적 하한 / 기준값 / 상위 참고값` 범위로만 제시한다.
   - `2026-01`, `2026-02`가 성숙되면 rolling 3개월 평균으로 교체한다.
   - 신규 상담사는 ramp-up과 리드 공급 상한을 별도 가정으로 둔다.
4. 전화번호 join QA:
   - KPI 고정 전 `matched 50건 / unmatched 50건` 수기 검수를 우선한다.
   - 문서/응답 meta에 `invalid_phone_rate`, `match_rate`, `manual_audit_pass_rate`를 추가하는 방향으로 본다.
5. 귀속 규칙:
   - V1 운영 기본값은 `first-touch`
   - 내부 검증용으로 `last-touch` 또는 `split-credit` 민감도 뷰를 추가 검토한다.
6. 용어 고정:
   - Phase 1 문서에서는 `준증분 매출`, `매출배수`, `인건비 차감 후 잔여매출`을 쓴다.
   - `공식 ROI`, `정확한 이익`은 비용 원장과 공헌이익 기준이 갖춰진 뒤에만 쓴다.

우선순위:

- P0: 산식 고정, 비교군 민감도 3종, 전화번호 join QA
- P1: rolling 3개월 기준선, 신규 상담사 ramp, outlier 확인
- P2: `ltr_customer_cohort.manager`, 비용 원장, 공식 ROI 전환

### 10-5-2. 프론트 없이 `상담사 1명 추가 시 예상 매출 증가`를 적는 방법

결론부터 말하면, **프론트 없이도 현재 백엔드만으로 문서용 추정치를 쓸 수 있다.**

이유:

- 필요한 값이 이미 모두 `seo/backend` 의 `callprice` API에서 계산된다.
- 문서에 적을 숫자는 시각화보다 `기간`, `비교군`, `maturity`, `산식`이 더 중요하다.
- 따라서 지금은 프론트 구현보다 **백엔드 기준선 숫자 확정 + 월별 기록 방식 정의**가 더 파급력이 크다.

현재 권장 기준선:

- 기간: `2025-12-01 ~ 2025-12-31`
- 이유: `reference_date=2026-03-29` 기준 `maturity_days=90` 를 만족하는 마지막 완전 성숙 월이다.
- 비교군: `global_non_consultation`
- 표본: `sample_warning=false` 인 상담사만 기준선 후보로 본다.

실제 stable 상담사 4명의 실측값:

- `글라`: `17,545,487`
- `민정`: `15,677,409`
- `예진`: `9,303,011`
- `선희`: `2,320,630`

이 값을 `31일 월`에서 `30일 월` 기준으로 환산하면:

- `글라`: `16,979,504`
- `민정`: `15,171,686`
- `예진`: `9,002,914`
- `선희`: `2,245,771`

여기서 backend-only 기준선은 아래처럼 잡을 수 있다.

#### 방법 A. `scenario` API를 공식 기준값으로 사용

호출:

```text
GET /api/callprice/scenario
  ?start_date=2025-12-01
  &end_date=2025-12-31
  &maturity_days=90
  &baseline_scope=global_non_consultation
  &monthly_cost=4500000
  &headcount=1
```

현재 응답:

- `estimated_incremental_revenue`: `10,849,969`
- `estimated_incremental_profit`: `6,349,969`
- `incremental_revenue_multiple`: `2.411`

즉 **현재 backend 기본 추정치**는:

- 상담사 `1명 추가 시 월 준증분 매출 약 1,085만원`
- 월 인건비 `450만원` 가정 시 월 인건비 차감 후 잔여매출 `약 635만원`

#### 방법 B. `상담당 가치 × 상담사당 월 처리량`으로 수동 검증

백엔드 수치:

- 2025-12 전체 `estimated_value_per_consultation = 133,472`
- stable 상담사 4명 기준 전체 `completed_consultations = 336`
- 상담사 1인당 30일 환산 월 상담 수:

```text
(336 / 4) × (30 / 31) = 약 81.3건
```

따라서:

```text
월 예상 준증분 매출
= 상담사 1인당 월 상담 수 × 상담 1건당 준증분 가치
= 81.3 × 133,472
= 약 10,849,982
```

즉 방법 A와 사실상 같은 숫자가 나온다.

#### 문서에 적을 권장 표현

현재 문서/리더십 보고에는 아래 표현이 가장 적절하다.

> 2025년 12월 완료 상담의 90일 성숙 데이터를 기준으로 보면, 상담사 1명 추가 시 월 준증분 매출은 약 `1,085만원`으로 추정된다. 다만 이는 `global_non_consultation` 비교군 대비 관측 차이에 근거한 준증분 추정치이며, 리드 수요와 리드 품질이 현재와 유사하게 유지된다는 가정이 필요하다.

#### 함께 적어야 하는 현실 범위

상담사 편차가 커서 단일 값만 적으면 위험하다. 따라서 아래 범위를 같이 적는 것이 맞다.

- 보수적 하한: `약 225만원 / 월`
  - 현재 stable 상담사 최저 실측치 기준
- 기준값: `약 1,085만원 / 월`
  - 현재 backend `scenario(headcount=1)` 기본값
- 참고 중간값: `약 1,209만원 / 월`
  - stable 상담사 4명 월 환산 실적의 median/trimmed mean 근사치
- 상위 참고값: `약 1,698만원 / 월`
  - 현재 stable 상담사 최고 실측치 기준

인건비 `450만원 / 월` 가정 시:

- 보수적 하한 잔여매출: `약 -225만원 / 월`
- 기준 잔여매출: `약 +635만원 / 월`
- 중간값 잔여매출: `약 +759만원 / 월`
- 상위 참고값 잔여매출: `약 +1,248만원 / 월`

#### 이 숫자를 쓸 때 붙여야 하는 전제

1. 신규 상담사에게도 현재와 비슷한 양의 리드가 배정된다는 가정
2. 상담 품질과 리드 품질이 기존 stable 상담사 평균과 크게 다르지 않다는 가정
3. `2025-12`는 현재 기준 마지막 완전 성숙 월이므로, 이후 월이 성숙되면 숫자가 바뀔 수 있음
4. 따라서 이 값은 `채용 검토용 준증분 추정치`이지, 확정 ROI가 아님

#### 지금 프론트보다 더 먼저 할 일

현재 시점에서는 프론트보다 아래가 우선이다.

- 매월 말 또는 월초에 `callprice` backend 값만 다시 계산해 `callprice.md`에 누적 기록
- `1명 추가 기준값`, `보수적 하한`, `중간값` 3개를 같이 적어 의사결정 기준선으로 유지
- `2026-01`, `2026-02`가 maturity를 만족하는 시점이 오면 rolling 3개월 평균으로 기준값을 교체

### 10-6. 이번 턴 기준 미구현 / 남은 일

아직 남아 있는 것은 아래다.

- backend-only 기준선의 월별 재산출 자동화 또는 운영 기록 루틴 정리
- `revenue` 기존 상담/LTR 화면과 수치 비교 검증
- `analysis_type -> report_type` 승인용 매핑표 확정
- 상담사별 공식 ROI를 위한 비용 테이블 설계
- `global_non_consultation` 외 baseline 민감도 2종 추가
- 전화번호 join QA와 수기 샘플 검수
- 필요 시 `ltr_customer_cohort.manager` 같은 운영 스키마 보강 검토

즉 지금 단계에서 가장 파급력 있는 다음 작업은 **프론트 구현보다, backend-only 기준으로 `상담사 1명 추가 시 월 준증분 매출` 기준선을 월별로 재계산하고 누적 기록하는 것**이다.

### 10-7. 검증 로그

이번 턴에서 확인한 검증은 아래와 같다.

- `cd /Users/vibetj/coding/seo/backend && npm run typecheck` 통과
- `cd /Users/vibetj/coding/seo/backend && npx tsx --test tests/*.test.ts` `24/24` 통과
- 로컬 런타임 `http://localhost:7020/api/callprice/*` 실제 응답 확인
- 기존 서버 상태:
  - `http://localhost:7010` 응답 정상
  - `http://localhost:7020/health` 응답 정상

### 10-8. 검사 유형별 미상담 매출 표기 정정

질문:

> 왜 `검사 유형별 상담 효과 비교` 표에서는 미상담 매출이 전부 `11,229원`으로 같게 보였는가?

답:

- 그 숫자는 **오류라기보다 계산 기준의 차이**였다.
- 기존 화면은 상단 비교군 기본값이 `전체 미상담 비교군`이어서,
  검사 유형 표에서도 모든 행이 같은 `전체 미상담 고객 평균`을 기준선으로 썼다.
- 그래서 알러지든 유기산이든 중금속이든, `미상담 매출` 열이 모두 `11,229원`으로 같게 보였다.

즉 예전 표는 이렇게 읽어야 했다.

- 상담 고객 매출: 검사 유형별로 다름
- 미상담 매출: 전 검사 유형 공통으로 `전체 미상담 고객 평균`

이 방식은 전체 평균과의 차이를 빠르게 보는 데는 쓸 수 있지만,
`검사 유형 자체가 원래 다른 매출 구조를 갖는 문제`를 충분히 반영하지 못한다.

#### 지금은 검사 유형별로 쪼개서 볼 수 있는가?

결론:

- **대부분 가능하다.**
- 근거 원천은 `public.customer_report_info.report_type` 이다.
- 현재 운영 DB 기준으로 미상담 고객의 검사 결과 유형은 아래 4개 축으로 구분돼 있다.
  - `음식물 과민증`
  - `종합대사기능`
  - `종합호르몬`
  - `스트레스노화 호르몬`

따라서 상담 기록의 `analysis_type` 을 이 `report_type` 들에 매핑하면,
검사 유형별 미상담 고객당 매출을 따로 계산할 수 있다.

#### 현재 매핑 기준

- `알러지`, `음식물` -> `음식물 과민증`
- `유기산`, `중금속`, `장내`, `대사`, `중금속 미네랄검사` -> `종합대사기능`
- `중금속 미네랄검사` 는 화면 표에서 별도 행으로 두지 않고 `중금속`에 통합
- `호르몬` -> `종합호르몬` + `스트레스노화 호르몬`
- `스트레스 노화`, `스트레스노화 분석` 은 화면 표에서 별도 행으로 두지 않고 `호르몬`에 통합
- `펫` 은 비교 표에서 제외

#### 현재 실측값

기준:

- 조회 기간: `2025-04-01 ~ 2026-03-27`
- 관찰 기간: `90일`
- 비교군: `analysis_type_non_consultation`

현재 프론트 비교 표는 아래 5개 축으로 정리한다.

- `알러지`: `14,528원`
- `유기산`: `44,496원`
- `중금속`: `49,923원`
- `호르몬`: `43,483원`
- `장내`: `46,648원`

정리 원칙은 아래와 같다.

- `중금속 미네랄검사` 는 별도 행을 없애고 `중금속`으로 흡수
- `스트레스 노화`, `스트레스노화 분석` 은 별도 행을 없애고 `호르몬`으로 흡수
- `펫` 은 미상담 비교군 매핑이 약하고 표본도 작아 비교 표에서 제외

#### 프론트 반영 원칙

`/Users/vibetj/coding/seo/frontend/src/app/callprice/page.tsx` 의
`검사 유형별 상담 효과 비교` 표는 이제 상단 비교군 선택과 별개로,
**항상 `검사 유형별 미상담 비교군` 기준**으로 읽히도록 수정했다.

이유:

- 이 표의 목적은 `검사 종류마다 상담 효과가 얼마나 다른지`를 보는 것
- 이 목적에는 `전체 평균`보다 `같은 검사 유형 미상담 고객 평균`이 더 적절함

따라서 앞으로 이 표를 읽을 때 `미상담 매출`은 이렇게 이해하면 된다.

> 이 숫자는 “같은 검사 유형인데 상담을 받지 않은 고객”의 고객당 매출이다.

#### 이번 턴 추가 검증

- `cd /Users/vibetj/coding/seo/backend && npm run typecheck` 통과
- `cd /Users/vibetj/coding/seo/backend && npx tsx --test tests/*.test.ts` `27/27` 통과
- `cd /Users/vibetj/coding/seo/frontend && npm run build` 통과
- `http://localhost:7020/api/callprice/analysis-types?start_date=2025-04-01&end_date=2026-03-27&maturity_days=90&baseline_scope=analysis_type_non_consultation` 실응답 확인
- `http://localhost:7010/callprice` 응답 `200`
- `http://localhost:7020/health` 응답 `200`

### 10-9. 아임웹 할인 쿠폰 추적 데이터 보강 계획

질문:

> 추후에는 `정기구독 쿠폰`, `상담 후 영양제 구매 쿠폰`까지 같이 추적해 데이터 해석력을 높일 수 있는가?

답:

- **그렇게 하는 것이 맞다.**
- 지금 `callprice` 해석에서 가장 큰 남은 혼선 중 하나는, `상담 효과`와 `쿠폰 효과`가 뒤섞여 있을 수 있다는 점이다.
- 예를 들어 상담 후 구매 전환이 높게 보이더라도, 실제로는 상담 자체보다 `상담 직후 발급한 할인 쿠폰`이 결제 버튼을 누르게 만든 것일 수 있다.
- 반대로 쿠폰 없이도 살 고객에게 쿠폰이 들어갔다면, 매출은 같고 할인비용만 추가로 들어간 것일 수 있다.
- 따라서 이후에는 `상담 -> 쿠폰 발급 -> 쿠폰 사용 -> 첫 영양제 구매 -> 정기구독 전환` 흐름을 같은 축에서 추적해야 한다.

#### 현재 `revenue/backend` 에 이미 있는 것

아임웹 할인 금액 자체는 이미 일부 들어오고 있다.

- `/Users/vibetj/coding/revenue/backend/app/models/models.py`
  - `tb_iamweb_users` 모델에 아래 컬럼이 있다.
  - `grade_discount`
  - `coupon_discount`
  - `point_used`
  - `promotion_discount`
- `/Users/vibetj/coding/revenue/backend/app/tasks/iamWebApi/order_sync.py`
  - 아임웹 주문 동기화에서 아래 값을 실제로 읽고 있다.
  - `gradeDiscount`
  - `itemCouponDiscount`
  - `itemPointAmount`
  - `itemPromotionDiscount`
- `/Users/vibetj/coding/revenue/backend/app/test/iam_web_api.py`
  - 아임웹 `https://api.imweb.me/v2/shop/coupons` 조회 코드가 있다.
- `/Users/vibetj/coding/revenue/backend/iamWeb_csv/shopOrder_df.csv`
  - 원천 샘플에는 `payment.coupon`, `use_issue_coupon_codes` 값이 보인다.

즉 현재 기준으로는:

- **주문에 얼마가 할인되었는지**는 어느 정도 추적 가능하다.
- 하지만 **어떤 쿠폰이 쓰였는지**, **그 쿠폰이 어떤 목적이었는지**까지는 운영 지표로 바로 보기 어렵다.

#### 현재 `revenue/backend` 에 아직 부족한 것

현재 확인한 `revenue` 코드 기준으로는 아래가 부족하다.

- `order_sync.py` 는 할인 금액은 저장하지만, `use_issue_coupon_codes` 자체를 `tb_iamweb_users`에 저장하지 않는다.
- 따라서 주문 한 건이 `정기구독 쿠폰` 때문인지, `상담 후 영양제 구매 쿠폰` 때문인지, `기타 프로모션 쿠폰` 때문인지를 현재 테이블만으로는 구분하기 어렵다.
- 쿠폰 이름, 쿠폰 캠페인명, 발급일, 사용일, 만료일, 발급 채널, 쿠폰 목적 태그가 운영 테이블에 정규화돼 있지 않다.

정리하면 지금 있는 값은 아래 수준이다.

- `얼마 할인됐는가`: 있음
- `무슨 이유로 할인됐는가`: 부족
- `어떤 쿠폰이었는가`: 부족
- `상담 후 발급 쿠폰이었는가`: 부족
- `정기구독 전환용 쿠폰이었는가`: 부족

#### 현재 `revenue/frontend` 에 있는가

현재 `revenue/frontend/apps/portal` 과 `revenue/frontend/packages`를 검색한 결과,
`coupon`, `쿠폰`, `discount` 기준으로 **쿠폰 전용 화면/표시 로직은 확인되지 않았다.**

즉 현재 포털 상태는 아래처럼 보는 것이 맞다.

- `revenue/backend`: 할인 금액 데이터 일부 있음
- `revenue/frontend`: 쿠폰 분석 UI 없음

따라서 향후 `쿠폰 기반 CRM 성과`를 운영 화면으로 보려면,
백엔드 추적 컬럼과 프론트 표시 둘 다 추가 설계가 필요하다.

#### 추후 계획에 넣어야 하는 이유

`callprice` 관점에서 쿠폰 추적은 선택이 아니라, 해석 정확도를 높이는 보강 작업이다.

쿠폰 추적이 붙으면 아래 질문에 답할 수 있다.

1. 상담 후 영양제 구매 전환이 높은 이유가 `상담 자체`인지, `상담 후 쿠폰`인지
2. 정기구독 전환율이 높은 이유가 `제품 만족`인지, `정기구독 유도 쿠폰`인지
3. 쿠폰이 없었어도 샀을 고객에게 과도하게 쿠폰을 쓰고 있는지
4. 어느 상담사/어느 시점의 쿠폰이 실제로 먹히는지
5. 쿠폰 비용을 감안해도 `잔여매출`이 남는지

#### 추천하는 쿠폰 추적 범위

우선순위는 아래 두 종류다.

1. `정기구독 쿠폰`
   - 일반 영양제 구매 고객을 정기구독으로 넘기기 위한 쿠폰
2. `상담 후 영양제 구매 쿠폰`
   - 상담 완료 직후 첫 영양제 구매를 밀어주는 쿠폰

이 두 개만 먼저 정확히 잡아도, 현재 가장 궁금한 `상담 효과 vs 프로모션 효과` 분리가 많이 가능해진다.

#### 추천 데이터 구조

향후 적재 또는 중간 분석 테이블에서 최소한 아래 필드를 남기는 것이 좋다.

- `coupon_code`
- `issue_coupon_code`
- `coupon_name`
- `coupon_purpose`
  - 예: `subscription_coupon`, `post_consult_supplement_coupon`
- `coupon_discount_amount`
- `promotion_discount_amount`
- `point_used_amount`
- `issued_at`
- `redeemed_at`
- `expired_at`
- `order_number`
- `customer_number`
- `customer_key`
- `manager`
- `analysis_type`
- `consultation_completed_at`
- `days_from_consultation_to_coupon_issue`
- `days_from_consultation_to_coupon_redeem`

핵심은 할인 금액만 보는 것이 아니라, **쿠폰의 정체와 발급 맥락**을 같이 남기는 것이다.

#### 추천 KPI

쿠폰 추적이 붙으면 아래 KPI를 월 단위로 볼 수 있다.

- 쿠폰 발급 수
- 쿠폰 사용 수
- 쿠폰 사용률
- 상담 후 `D+0`, `D+3`, `D+7`, `D+14`, `D+30` 사용률
- 쿠폰 사용 고객의 영양제 첫 구매 전환율
- 쿠폰 사용 고객의 정기구독 전환율
- 쿠폰 1건당 할인비용
- 쿠폰 사용 고객 1명당 추가 매출
- 쿠폰 사용 고객 1명당 정기구독 전환 증가분
- 상담사별 쿠폰 효과 차이

#### 실무적으로 가장 먼저 할 일

지금 가장 현실적인 순서는 아래다.

1. `정기구독 쿠폰`, `상담 후 영양제 구매 쿠폰`의 실제 운영 코드/이름을 고정한다.
2. 아임웹 주문 원천에서 `use_issue_coupon_codes` 와 쿠폰 마스터를 같이 수집한다.
3. 쿠폰 코드를 내부 목적 태그와 매핑한다.
4. `tb_iamweb_users` 또는 별도 분석 테이블에서 `주문 ↔ 쿠폰 ↔ 상담` 연결 테이블을 만든다.
5. 그 다음에야 `상담 효과`와 `쿠폰 효과`를 나눠 보는 화면/리포트를 만든다.

#### 현재 문서 기준 최종 판단

- **추후 계획에 반드시 포함할 항목이다.**
- 현재 `revenue/backend` 에는 할인 금액 데이터가 이미 있으므로 출발점은 있다.
- 그러나 현재 `revenue/frontend` 에는 쿠폰 분석 UI가 없고,
  `revenue/backend` 도 쿠폰 목적/코드/발급 맥락까지는 운영 지표로 바로 쓰기 부족하다.
- 따라서 다음 단계는 `쿠폰 금액 존재 여부 확인`이 아니라,
  **`정기구독 쿠폰`과 `상담 후 영양제 구매 쿠폰`을 목적별로 구분해 추적하는 데이터 보강 계획을 세우는 것**이다.
