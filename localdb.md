# 로컬 DB (SQLite) 아키텍처

작성일: 2026-04-01  
최종 갱신: 2026-04-02

## 1. 왜 로컬 DB를 쓰는가

운영 DB는 **읽기만** 한다. 실험 데이터, Toss API 캐시, 아임웹 회원/주문 원장 일부는 **로컬 SQLite에 저장**한다.

| 원칙 | 설명 |
|------|------|
| 운영 DB 무변경 | `bico_readonly` 계정으로 읽기만. 운영 테이블 생성/수정 없음 |
| 실험 독립성 | CRM 실험, 배정, 발송, 전환 기록은 로컬에서 관리 |
| API 캐싱 | Toss / 아임웹 데이터를 로컬에 적재해 반복 호출을 줄임 |
| 추후 이관 가능 | 검증 완료 후 Supabase 또는 운영 DB로 이관 가능 |

## 2. 파일 위치

```text
backend/data/crm.sqlite3
```

- `.gitignore` 포함
- 서버 시작 시 자동 생성 및 마이그레이션 성격의 `CREATE TABLE IF NOT EXISTS` 실행
- WAL 모드 + foreign keys ON

## 3. 현재 테이블 구조

### CRM 실험 원장

| 테이블 | 용도 | 핵심 컬럼 |
|--------|------|----------|
| `crm_experiments` | 실험 정의 | `experiment_key`, `name`, `channel`, `status`, `variant_weights`, `conversion_window_days` |
| `crm_assignment_log` | 고객 배정 | `experiment_key`, `customer_key`, `variant_key`, `assigned_at` |
| `crm_conversion_log` | 전환 기록 | `experiment_key`, `customer_key`, `order_id`, `revenue_amount`, `refund_amount` |
| `crm_message_log` | 발송 기록 | `experiment_key`, `customer_key`, `channel`, `template_code`, `sent_at` |

### CRM 리드

| 테이블 | 용도 | 핵심 컬럼 |
|--------|------|----------|
| `crm_lead_profile` | 리드 프로필 | `lead_id`, `customer_key`, `lead_source`, `intent_stage`, `consent_status` |
| `crm_lead_event_log` | 리드 이벤트 | `lead_id`, `event_name`, `funnel_stage`, `occurred_at` |
| `crm_consent_log` | 수신 동의 | `lead_id`, `consent_type`, `consent_status` |

### 외부 API 캐시

| 테이블 | 용도 | 핵심 컬럼 |
|--------|------|----------|
| `toss_transactions` | Toss 거래 캐시 | `transaction_key`, `payment_key`, `order_id`, `method`, `status`, `transaction_at`, `amount` |
| `toss_settlements` | Toss 정산 캐시 | `payment_key`, `order_id`, `amount`, `fee`, `pay_out_amount`, `sold_date`, `paid_out_date` |
| `imweb_members` | 아임웹 회원 캐시 | `member_code`, `name`, `callnum`, `email`, `site`, `join_time`, `last_login_time` |
| `imweb_orders` | 아임웹 주문 캐시 | `order_key`, `site`, `order_no`, `member_code`, `orderer_call`, `pay_type`, `payment_amount`, `order_time`, `raw_json` |

## 4. 현재 적재 현황

기준 파일: `backend/data/crm.sqlite3`

| 영역 | 건수 |
|------|------|
| 실험 정의 | `3` |
| 실험 배정 | `509` |
| 실험 전환 | `264` |
| 발송 기록 | `0` |
| 리드 프로필 | `0` |
| 리드 이벤트 | `0` |
| 수신 동의 | `0` |
| 아임웹 회원 | `83,017` |
| 아임웹 주문 | `1,150` |
| Toss 거래 | `33,603` |
| Toss 정산 | `1,567` |

## 5. 데이터 흐름

```text
운영 DB (PostgreSQL, read-only)
  ├─ tb_iamweb_users → 주문/쿠폰/CRM 분석
  ├─ tb_playauto_orders → 커피 고객/상품 분석
  ├─ tb_sales_toss → 운영 매출 검산
  ├─ tb_consultation_records → 상담 원장
  └─ ltr_customer_cohort → LTR 코호트

외부 API
  ├─ Toss Payments API → toss_transactions, toss_settlements
  ├─ Imweb API → imweb_members, imweb_orders
  └─ 알리고 API → crm_message_log

로컬 SQLite (crm.sqlite3)
  ├─ CRM 실험 원장
  ├─ CRM 리드 원장
  ├─ Toss 캐시
  └─ Imweb 회원/주문 캐시
```

## 6. 현재 구현된 적재 API

| 기능 | API | 상태 |
|------|-----|------|
| 실험 생성 | `POST /api/crm-local/experiments` | 구현 완료 |
| 고객 배정 | `POST /api/crm-local/experiments/:key/assignments` | 구현 완료 |
| 전환 동기화 | `POST /api/crm-local/experiments/:key/sync-conversions` | 구현 완료 |
| 발송 기록 | `POST /api/crm-local/messages` | 구현 완료 |
| 아임웹 회원 동기화 | `POST /api/crm-local/imweb/sync-members` | 구현 완료 |
| 아임웹 주문 동기화 | `POST /api/crm-local/imweb/sync-orders` | 2026-04-02 추가 |
| 아임웹 주문 통계 | `GET /api/crm-local/imweb/order-stats` | 2026-04-02 추가 |

## 7. 0401 Toss 적재 결과

### 거래 / 정산

- 거래: `33,603건`
- 정산: `1,567건`
- 로컬 DB health에도 반영됨

### 활용

| 분석 | 효과 |
|------|------|
| 커피 매출 추이 | 운영 DB보다 긴 기간의 payment 기반 추적 가능 |
| PlayAuto 교차 검산 | 주문번호 / 결제금액 기준 확인 가능 |
| PG 수수료 분석 | 정산 단위 추이 확인 가능 |

## 8. 0402 더클린커피 아임웹 주문 적재 결과

### 실행

실행 API:

```bash
curl -X POST 'http://localhost:7020/api/crm-local/imweb/sync-orders' \
  -H 'Content-Type: application/json' \
  --data '{"site":"thecleancoffee","maxPage":120}'
```

실행 결과:

- 응답 기준 `totalCount`: `2050`
- 이번 sync에서 읽어온 row 수: `1150`
- 로컬 SQLite 고유 주문 수: `1150`

### 현재 로컬 주문 원장 상태

`site='thecleancoffee'` 기준:

| 항목 | 값 |
|------|----|
| 주문 수 | `1,150건` |
| 회원코드가 있는 주문 | `1,014건` |
| 전화번호 기준 고유 고객 | `865명` |
| 결제금액 합계 | `50,010,084원` |
| 최초 주문 시각 | `2025-12-30T07:02:37.000Z` |
| 마지막 주문 시각 | `2026-04-02T05:51:00.000Z` |
| 마지막 sync 시각 | `2026-04-02 06:10:27` |

결제수단 분포:

| 결제수단 | 주문 수 | 결제금액 합계 |
|----------|--------:|-------------:|
| `card` | `574` | `26,499,970원` |
| `npay` | `511` | `20,814,500원` |
| `cash` | `42` | `1,739,832원` |
| `virtual` | `13` | `644,951원` |
| `iche` | `9` | `310,831원` |
| `free` | `1` | `0원` |

### 중요한 한계

아임웹 `shop/orders` 페이지네이션이 정상적이지 않다.

- API는 `data_count=2050`이라고 응답함
- 그런데 `offset`을 순차 증가시키면 중간중간 빈 페이지가 섞여 나옴
- 실제로는 `offset=2`, `4`, `6`뿐 아니라 일부 다른 페이지도 비는 현상이 확인됨
- 그래서 현재 `1150건`은 **정본 전체 주문 원장**이 아니라 **현재 API에서 안정적으로 회수된 부분 집합**이다

즉, **로컬 적재 자체는 성공**했지만, **아임웹 주문 API의 비정상 pagination 때문에 전량 적재는 아직 미완료**다.

### 0402 추가 재시도 결론

`최종 완료`를 목표로 한 번 더 확인한 결과는 아래와 같다.

1. **공식 최신 주문 API 존재 확인**
   - 아임웹 공식 swagger 기준 최신 주문 목록 endpoint는 `https://openapi.imweb.me/orders`
   - 이 endpoint는 `page`, `limit`, `startWtime`, `endWtime`, `paymentStatus` 등을 지원한다

2. **하지만 현재 커피 key/secret로는 최신 endpoint 접근 불가**
   - 현재 `.env`에 있는 커피용 key/secret으로 `v2/auth` 토큰 발급은 가능
   - 그러나 그 토큰으로 `https://openapi.imweb.me/orders?page=1&limit=25` 호출 시
     - `401`
     - `30105`
     - `인증 정보가 유효하지 않습니다`
   - 즉 현재 자격증명은 **레거시 `api.imweb.me/v2/shop/orders`에는 유효하지만**, 공식 최신 `openapi.imweb.me/orders`에는 유효하지 않다

3. **Codex 자동화 endpoint 추가**
   - `GET /api/crm-local/imweb/pagination-anomalies`
   - 이 endpoint는 declared count, fetched unique orders, empty page, coverage rate를 자동으로 계산한다

4. **추가 스캔 결과**
   - anomaly 스캔(`limit=25`, `maxPage=130`) 기준:
     - declared total: `2050`
     - fetched unique: `975`
     - coverage: `47.6%`
   - 실제 sync route(`limit=50` 기반) 기준 local SQLite 적재:
     - unique inserted: `1150`
   - 즉 **limit 값에 따라 회수되는 페이지 패턴이 달라지는 이상 현상**까지 확인됐다

### 최종 판단

- **부분 적재는 가능**
- **전량 적재 완료라고 말할 수는 없음**
- **현재 자격증명만으로 공식 최신 주문 API 전환도 불가**

따라서 오늘 기준 결론은:

> 더클린커피 아임웹 주문을 로컬 DB에 적재하는 것은 가능하다.  
> 하지만 **정본 전량 적재 완료**는 아직 불가능하다.

이 상태에서 전량 완료를 닫으려면 아래 셋 중 하나가 필요하다.

1. `openapi.imweb.me/orders`를 읽을 수 있는 **OAuth 앱 자격증명** 또는 적절한 권한
2. 아임웹 관리자 **주문 export 원본**
3. 레거시 `shop/orders` 페이지네이션 이상에 대한 **아임웹 측 확인/수정**

## 9. 현재 판단

### 지금 바로 가능한 것

- 로컬 SQLite에 커피 아임웹 주문 일부를 캐시해 최근 주문 흐름을 보는 것
- 회원 원장 `imweb_members`와 주문 원장 `imweb_orders`를 전화번호/회원코드로 연결하는 것
- Toss / PlayAuto / 아임웹의 교차 검산 기반을 만드는 것
- Codex가 `pagination anomaly`를 자동 감지하고 “정본으로 쓰면 안 되는 상태”를 기계적으로 판정하는 것

### 아직 확정치로 쓰면 안 되는 것

- `imweb_orders`만 기준으로 한 커피 정식 LTR
- `imweb_orders`만 기준으로 한 커피 정식 재구매율
- “현재 커피 주문 전량이 로컬에 들어왔다”는 전제
- 현재 key/secret만으로 공식 최신 `/orders`까지 커버된다는 전제

## 10. 다음 액션

1. 아임웹 주문 API pagination 규칙을 추가 확인한다.
2. `openapi.imweb.me/orders`용 OAuth 자격증명을 확보해 최신 endpoint로 재시도한다.
3. `imweb_orders`와 `toss_transactions`를 `order_no / order_id / payment_amount` 기준으로 교차 검산한다.
4. OAuth가 어렵다면 Imweb 관리자 export를 받아 local SQLite에 병합 적재한다.
5. 전량 적재가 닫히면 `/coffee`의 현재 proxy 수치를 local SQLite 정본 기준으로 교체한다.

## 11. 검증 메모

- `backend/tests/crm-local-imweb-order.test.ts` 추가
- 새 테스트 통과
- `GET /api/crm-local/imweb/order-stats?site=thecleancoffee` 응답 확인
- `POST /api/crm-local/imweb/sync-orders` 실호출 성공
- `GET /api/crm-local/imweb/pagination-anomalies?site=thecleancoffee&maxPage=130` 실호출 성공
- 공식 swagger에서 최신 주문 endpoint `openapi.imweb.me/orders` 확인
- 최신 endpoint는 현재 토큰으로 `401 / 30105` 확인

참고:

- 전체 `npm run typecheck`는 기존 `src/routes/toss.ts`의 선행 타입 오류 때문에 실패함
- 이번 변경분 자체는 새 테스트와 실서버 route 호출로 검증함

## 12. Codex 플러그인 관점 개선안

여기서 말하는 `Codex 플러그인`은 브라우저 확장 의미보다, **Codex가 반복적으로 직접 호출할 수 있는 얇은 자동화 레이어**로 보는 것이 맞다.

즉 목표는 이렇다.

- 사람이 매번 `curl`과 `sqlite3`를 수동으로 치지 않아도 됨
- Codex가 `적재 → 검증 → 이상 탐지 → 문서 업데이트`를 한 번에 반복 수행 가능
- 운영 DB는 계속 read-only로 두고, local SQLite만 안전하게 갱신

### 지금 바로 개선 가치가 큰 항목

| 우선순위 | 개선안 | 이유 |
|----------|--------|------|
| P0 | `sync status` endpoint 추가 | 마지막 성공 시각, 마지막 에러, 마지막 적재 건수를 Codex가 즉시 읽을 수 있어야 함 |
| P0 | `dry-run diff` endpoint 추가 | 실제 INSERT 전에 “이번에 새로 들어올 주문 수 / 갱신될 주문 수”를 먼저 확인 가능해야 함 |
| P0 | `pagination anomaly report` 추가 | 아임웹처럼 중간 페이지가 비는 문제를 Codex가 자동 감지하고 문서화할 수 있어야 함 |
| P1 | `reconciliation` endpoint 추가 | `imweb_orders` vs `toss_transactions` 차이를 order_no/payment_amount 기준으로 바로 볼 수 있어야 함 |
| P1 | `site preset job` 추가 | `thecleancoffee`, `biocom`, `aibio`를 사람 입력 없이 한 번에 sync 가능해야 함 |
| P2 | `markdown report generator` 추가 | 적재 후 핵심 수치를 `localdb.md`, `coffee.md`에 붙일 초안을 자동 생성 가능해야 함 |

### 왜 이 방식이 유리한가

현재도 Codex는 다음 단계까지는 할 수 있다.

- route 호출
- SQLite 검증
- 이상 패턴 확인
- 문서 갱신

하지만 아직은 `적재 상태를 사람이 눈으로 확인`해야 하는 구간이 남아 있다.

예를 들어 지금 커피 주문 적재도:

1. sync 호출
2. stats 호출
3. SQLite 직접 조회
4. pagination 이상 여부 확인
5. 문서 반영

을 수동으로 이어 붙였다.

이걸 플러그인형 레이어로 바꾸면, Codex는 아래처럼 더 안정적으로 반복할 수 있다.

1. `POST /api/crm-local/imweb/sync-orders?dryRun=1`
2. `GET /api/crm-local/imweb/sync-health`
3. `GET /api/crm-local/imweb/pagination-anomalies`
4. `GET /api/crm-local/imweb/reconciliation`
5. 결과를 Markdown 요약으로 자동 출력

### 이번 로컬 DB 작업에 특히 필요한 Codex 자동화

#### A. Pagination 감시기

이번에 실제로 확인한 병목은 아임웹 `shop/orders`의 비정상 페이지네이션이다.

- `data_count=2050`
- 실제 적재는 `1150`
- 중간 페이지가 빈 채로 응답

이 문제는 사람이 매번 샘플 페이지를 직접 찍어보지 않으면 놓치기 쉽다.

그래서 Codex용으로는 다음 응답이 필요하다.

```json
{
  "site": "thecleancoffee",
  "declaredTotalCount": 2050,
  "fetchedUniqueOrders": 1150,
  "emptyPages": [2, 4, 6, 7, 9, 11],
  "nonEmptyPages": [1, 3, 5, 8, 10, 13],
  "coverageRate": 0.561,
  "status": "anomaly_detected"
}
```

이게 있으면 Codex가 `정본 전량 적재 실패`를 자동으로 판단하고 문서에도 같은 문구를 일관되게 남길 수 있다.

#### B. 적재 전/후 diff

지금은 sync를 돌린 뒤에야 얼마나 들어왔는지 안다.

Codex가 더 잘 일하려면 sync 전에 이런 정보가 필요하다.

- 새 주문 예상 수
- 기존 주문 갱신 예상 수
- 중복 비율
- 이번 실행에서 스캔할 페이지 수

이 기능이 있으면 불필요한 재적재를 줄이고, `이번 실행이 실익이 있는지`를 먼저 판단할 수 있다.

#### C. 교차 검산 플러그인

로컬 DB의 진짜 가치는 `한 원천만 믿지 않는 것`에 있다.

따라서 Codex 플러그인 레벨에서 최소한 아래 비교는 자동화하는 것이 좋다.

- `imweb_orders.order_no` vs `toss_transactions.order_id`
- `payment_amount` 차이
- 주문은 있는데 결제가 없는 건
- 결제는 있는데 주문이 없는 건
- 최근 7일 mismatch 비율

이게 있어야 `커피 LTR`, `재구매율`, `VIP 진입율`을 proxy에서 정본 쪽으로 옮길 때 신뢰도가 올라간다.

### 지금 단계에서의 현실적인 결론

`가능하다.`

다만 지금 당장 필요한 건 거대한 새 시스템이 아니라, **기존 로컬 API 위에 Codex가 읽기 쉬운 상태/이상/차이 요약 endpoint를 3~4개 더 얹는 것**이다.

즉 우선순위는:

1. `sync-health`
2. `dry-run diff`
3. `pagination-anomalies`
4. `reconciliation`

순이 맞다.

### 현재 판단

- Codex 플러그인 방식으로 **분명히 개선 가능**
- 특히 local SQLite 적재/검증 업무는 Codex 자동화와 궁합이 좋음
- 이번 케이스에서 가장 큰 즉시 효과는 `pagination anomaly 자동 감지`
- 운영 DB를 건드리지 않고도 충분히 실익 있는 자동화를 먼저 만들 수 있음
