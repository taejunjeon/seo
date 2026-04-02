# codexfeedback_0329_1 reply

기준일: 2026-03-29

이번 턴은 범위를 넓히지 않고 아래 2가지만 진행했다.

1. `P4-S1` read-only 재구매 코호트 API를 실사용 가능한 수준으로 보강
2. `P1-S1` 운영 승인 패키지를 read-only endpoint + 승인 문안 형태로 고정

## 1. 수정/추가한 파일 목록

### Revenue backend

- `app/services/crm_cohort_service.py`
- `app/services/crm_approval_service.py`
- `app/api/crm.py`
- `test_crm_phase1_readonly.py`

### SEO 문서

- `/Users/vibetj/coding/seo/roadmap0327.md`
- `/Users/vibetj/coding/seo/codex/codexfeedback_0329_1reply.md`

### 백업

- `app/services/crm_cohort_service.py.bak_20260329_p4s1`
- `app/api/crm.py.bak_20260329_p4s1_p1pkg`
- `/Users/vibetj/coding/seo/roadmap0327.md.bak_20260329_codexfeedback_1`

## 2. 구현 내용 요약

### 작업 1. P4-S1 read-only 코호트 API

기존 `GET /api/crm/repeat-purchase-cohorts`는 있었지만, 내부 계산 단위가 `line item`에 가까워 실사용 기준으로는 위험했다.
이번 턴에는 이를 `order_number` 기준 rollup으로 바꿨다.

핵심 변경:

- `tb_iamweb_users`를 주문번호 기준으로 먼저 dedupe
- `gross_revenue`, `refund_amount`, `net_revenue`, `repeat_net_revenue`를 분리
- `segment_key`, `cohort_key` 추가
- `north_star_proxy = repeat_net_revenue_90d` 추가
- 필터 추가
  - `first_purchase_channel`
  - `first_product`
  - `discount_used`

현재 지원 필터:

- `start_month`
- `end_month`
- `max_offset`
- `first_purchase_channel`
- `first_product`
- `discount_used`

현재 보류:

- `first_category`
  - 운영 DB에서 상품 카테고리 매핑키가 안정적으로 연결되지 않아 이번 턴 범위에서 제외
- `gross profit`
  - 피드백 문서 허용 범위대로 제외

비유하면, 기존 코호트 API는 `주문서 낱장`을 더하는 상태였고, 지금 버전은 `주문번호별로 묶은 송장 단위`로 다시 세는 상태다.
그래서 운영자가 숫자를 믿고 다음 실험 입력값으로 쓸 수 있는 수준으로 한 단계 올라갔다.

### 작업 2. P1-S1 승인 패키지

실제 운영 DB migration은 하지 않았다.
대신 승인 요청에 바로 붙일 수 있는 최소 패키지를 코드로 고정했다.

추가 endpoint:

- `GET /api/crm/experiment-approval-package`

패키지에 포함한 내용:

- 4개 최소 테이블 목적
- 각 테이블 grain
- 핵심 컬럼
- 인덱스 초안
- `holdout/control/treatment` 표현 방식
- `assignment first` 원칙
- `ITT` 1차 판정 원칙
- `purchase/refund late arrival` 정책
- `occurred_at / ingested_at` 분리 이유
- 샘플 실험 1건 기준 pseudocode SQL

운영 DB read-only 확인 결과:

- `crm_experiments`: 없음
- `crm_assignment_log`: 없음
- `crm_message_log`: 없음
- `crm_conversion_log`: 없음

즉, 이번 턴의 P1-S1은 `엔진 구조를 승인 가능한 설계 패키지로 정리`한 단계이고, live 완료는 아직 아니다.

## 3. 테스트 결과

### 자동 테스트

- `python3 -m py_compile ...` 통과
- `pytest -q test_crm_phase1_readonly.py`
  - `4 passed`
- `DATABASE_URL=dummy ... pytest -q test_crm_phase0.py`
  - `4 passed`

메모:

- 기존 `test_crm_phase0.py`는 로컬 env가 없으면 수집 단계에서 실패한다.
- 이번 확인은 더미 env를 넣어 회귀 여부만 봤다.

## 4. 코호트 API 샘플 응답

실데이터 샘플 조건:

- `start_month=2026-01`
- `end_month=2026-03`
- `max_offset=3`
- `first_purchase_channel=toss_card`
- `discount_used=true`

예시 응답 발췌:

```json
{
  "filters": {
    "start_month": "2026-01",
    "end_month": "2026-03",
    "max_offset": 3,
    "first_purchase_channel": "toss_card",
    "first_product": null,
    "discount_used": true,
    "maturity_cutoff_month": "2026-03"
  },
  "segment_key": "cohort_range=2026-01:2026-03|channel=toss_card|product=all|discount=yes",
  "summary": {
    "cohort_count": 3,
    "customer_count": 2689,
    "north_star_proxy": {
      "name": "repeat_net_revenue_90d",
      "value": 21348021
    }
  },
  "average": {
    "M+0": {
      "purchase_rate": 100.0,
      "repeat_rate": 4.6,
      "gross_revenue": 811244421,
      "refund_amount": 46083939,
      "net_revenue": 765160482,
      "repeat_net_revenue": 28100117
    },
    "M+1": {
      "purchase_rate": 5.5,
      "repeat_rate": 5.5,
      "net_revenue": 16006291,
      "repeat_net_revenue": 16006291
    },
    "M+2": {
      "purchase_rate": 4.0,
      "repeat_rate": 4.0,
      "net_revenue": 5341730,
      "repeat_net_revenue": 5341730
    }
  }
}
```

## 5. P1-S1 approval package 초안

### 최소 범위

1. `crm_experiments`
2. `crm_assignment_log`
3. `crm_message_log`
4. `crm_conversion_log`

### 핵심 원칙

- `holdout required`
- `assignment first`
- `deterministic assignment`
- `assignment_version required`
- `primary analysis = ITT`
- `purchase/refund late arrival 허용`
- `occurred_at / ingested_at 분리`
- 발송 성공 여부와 assignment는 분리

### variant 용어 규칙

- `experiment_control = 무메시지 대조군`
- `treatment_a / treatment_b = 발송군`
- `global_holdout = 장기 상시 제외군, 이번 최소 범위에서는 개념만 열어둠`

### 샘플 집계 흐름

1. `crm_assignment_log`에서 실험 대상과 variant를 먼저 고정한다.
2. `crm_message_log`는 발송 시도/성공/실패를 provider 실행 로그로만 저장한다.
3. `crm_conversion_log`는 `purchase`, `refund`를 별도 row로 남긴다.
4. 최종 성과는 `assignment -> conversion_by_customer` left join으로 variant별 `assignment_count`, `purchaser_count`, `purchase_revenue`, `refund_amount`, `net_revenue`를 본다.

### approval-ready 판단

- 장점:
  - 범위가 최소 4개 테이블로 좁혀져 있다
  - holdout/ITT/late refund/시간 분리 원칙이 코드로 고정됐다
  - 운영 DB에서 현재 테이블이 없다는 사실도 같이 확인했다
- 아직 남은 것:
  - 실제 migration DDL 적용
  - 운영 배치/권한 검토
  - live backfill/cutover 절차

## 6. reconciliation 메모

`P4-S1` 숫자가 기존 `sales summary`와 완전히 같을 필요는 없다.
이유를 실제 숫자로 보면 더 명확하다.

### 2026-01 비교

- 내부 주문 rollup net revenue: `729,249,305`
- `sales summary grand_total`: `828,322,954`
- 코호트 API `2026-01 M+0 net_revenue`: `680,716,189`

### 왜 다를 수 있는가

1. 코호트 API는 `tb_iamweb_users`만 쓰는 내부 주문 관점이다.
2. `sales summary`는 토스/나이스/네이버/쿠팡/세금계산서/리커버리랩 등 채널 정산 집계를 합친 값이다.
3. 코호트 `M+0`는 `그 달이 첫 구매월인 고객`만 포함하므로, 월 전체 매출보다 작아지는 것이 정상이다.
4. 환불 반영 시점이 주문 테이블과 정산 테이블에서 다를 수 있다.

즉, 이 API는 `sales summary를 복제하는 API`가 아니라 `첫 구매 코호트 기준 재구매 구조를 읽는 API`로 봐야 한다.

## 7. 아직 안 닫힌 리스크 3개

1. `first_category` 필터는 아직 없다.
   - `tb_iamweb_Products`는 존재하지만 현재 주문 테이블과 안정적으로 매핑되는 키가 확인되지 않았다.

2. `sales summary`와의 월별 reconciliation은 현재 `2026-01` 기준으로만 비교가 쉽다.
   - `tb_sales_toss.sales_month` 기준 데이터가 `2026-01`만 확인돼, 정산 레이어 최신성 점검이 추가로 필요하다.

3. `P1-S1`은 아직 운영 DB에 실제 테이블이 없다.
   - 승인 패키지는 준비됐지만 migration 승인/적용 없이는 live experiment를 열 수 없다.

## 8. 다음 턴 추천

하나만 고르면 다음은 `P1-S1 local shadow DB + dry-run experiment 1건`이 맞다.

이유:

- 승인 패키지는 준비됐고
- live DB는 아직 비어 있으므로
- 운영 반영 전에 로컬 shadow DB에서 `experiment -> assignment -> conversion sync -> ITT result`를 한 번 end-to-end로 닫아두는 것이 가장 리스크를 줄인다.
