# revenue Toss sync 수동 실행 자료 준비 여부

작성일: 2026-04-11 KST

## 결론

현재 이 자료는 **완전 준비 불가**다.

이유는 단순하다. 필요한 4개 값 중 `tb_sales_toss.max(approved_at)`의 현재값은 read-only로 확인 가능하지만, `성공/실패`, `몇 건 읽었는지`, `몇 건 upsert됐는지`, `실행 후 max(approved_at)`은 revenue 쪽 Toss sync를 실제 실행해야만 나온다.

그리고 `POST /api/scheduler/sales/toss-sync?month=2026-04`는 운영 Postgres의 `tb_sales_toss`에 upsert를 수행하는 생산자 sync다. 즉 read-only 확인이 아니라 운영 DB 변경 작업이다. 현재 원칙상 우리가 임의로 실행하면 안 된다.

## “운영 Postgres upsert”의 정확한 의미

이 말은 “로컬 서버에서 호출할 수 없다”는 뜻이 아니다.

정확히는 아래 의미다.

```text
revenue 백엔드를 로컬에서 띄워도,
revenue의 DATABASE_URL이 클라우드 운영 Postgres를 가리키면,
POST /api/scheduler/sales/toss-sync?month=2026-04 실행 결과는 로컬 파일이 아니라 클라우드 운영 DB의 tb_sales_toss에 반영된다.
```

즉 “로컬에서 실행”과 “로컬 DB에 저장”은 다르다.

- 서버 프로세스 위치: 로컬일 수 있다.
- DB 연결 대상: `DATABASE_URL`이 가리키는 곳이다.
- 현재 revenue 코드의 `sync_toss_sales -> upsert_toss`는 `tb_sales_toss`에 insert/update한다.
- `tb_sales_toss`는 SQLite 로컬 테이블이 아니라 revenue 운영 Postgres 테이블이다.

따라서 `tb_sales_toss` 자체를 최신화하려면 결국 클라우드 Postgres를 수정해야 한다.

## 로컬 서버에 코드로 Toss 값을 넣을 수 있는가

가능하다. 단, 그 대상은 `tb_sales_toss`가 아니라 SEO 로컬 SQLite의 별도 테이블이다.

현재 SEO 로컬 SQLite에는 아래 테이블이 있다.

```text
backend/data/crm.sqlite3
- toss_transactions
- toss_settlements
```

그리고 SEO 백엔드에는 이미 로컬 SQLite로 Toss 데이터를 받는 경로가 있다.

```text
POST /api/toss/sync?store=biocom&mode=incremental
POST /api/toss/sync?store=biocom&mode=backfill&startDate=2026-04-01&endDate=2026-04-11
```

이 경로는 Toss 거래/정산 데이터를 로컬 SQLite의 `toss_transactions`, `toss_settlements`에 저장한다. 클라우드 운영 Postgres `tb_sales_toss`를 수정하지 않는다.

하지만 현재 Attribution 상태 승격 로직은 기본적으로 아래 순서다.

1. 운영 Postgres `tb_sales_toss`를 read-only로 조회한다.
2. 매칭이 없으면 이번에 추가한 Toss 직접 API fallback으로 `paymentKey` 또는 PG `orderId`를 조회한다.
3. 확인되면 SEO 로컬 Attribution 원장을 `confirmed`로 승격한다.

즉 로컬 SQLite에 Toss 값을 넣는 것은 가능하지만, 그것이 곧바로 `tb_sales_toss` 최신화와 같은 의미는 아니다. `tb_sales_toss` 기반 보고서나 revenue 대시보드까지 최신화하려면 운영 Postgres sync가 필요하다.

## 현재 추천 판단

목표가 “SEO Attribution/CAPI를 막히지 않게 하는 것”이면 클라우드 `tb_sales_toss` 수정 없이도 가능하다.

- 이미 SEO에 Toss 직접 API fallback을 붙였다.
- 로컬 Attribution 원장에는 direct fallback 기반 confirmed 승격이 가능하다.
- 추가로 필요하면 SEO 로컬 SQLite의 `toss_transactions`/`toss_settlements`를 더 적극적으로 활용하도록 로직을 확장할 수 있다.

목표가 “revenue의 정본 `tb_sales_toss` 자체를 최신화하는 것”이면 클라우드 운영 Postgres upsert가 필요하다.

- 이 경우 권한 있는 운영자가 revenue 환경에서 `POST /api/scheduler/sales/toss-sync?month=2026-04`를 실행해야 한다.
- 실행 전후 `tb_sales_toss.max(approved_at)`과 `inserted/updated/total_txns/total_details/total_rows`를 기록해야 한다.

## 현재 제공 가능한 값

운영 Postgres read-only 확인 결과:

```text
tb_sales_toss total: 7,501
tb_sales_toss max(approved_at): 2026-04-10 04:44:52 KST
tb_sales_toss max(synced_at raw DB value): 2026-04-09 21:00:10.31918

approved_at = 2026-04-10 rows: 8
approved_at = 2026-04-10 max: 2026-04-10 04:44:52
approved_at = 2026-04-11 rows: 0
approved_at = 2026-04-11 max: null
```

최근 날짜별 상태:

| approved_date | rows | max_approved_at |
|---|---:|---|
| 2026-04-10 | 8 | 2026-04-10 04:44:52 |
| 2026-04-09 | 76 | 2026-04-09 23:49:14 |
| 2026-04-08 | 94 | 2026-04-08 23:48:43 |

따라서 현재 상태에서는 외부에서 revenue Toss sync가 실행되어 최신화된 흔적은 아직 확인되지 않는다.

## 아직 제공 불가능한 값

| 필요한 자료 | 현재 제공 가능 여부 | 이유 |
|---|---|---|
| 성공/실패 | 불가 | revenue `toss-sync`를 실제 실행하지 않았음 |
| 몇 건 읽었는지 | 불가 | 실행 응답의 `total_txns`, `total_details`, `total_rows`가 필요 |
| 몇 건 upsert됐는지 | 불가 | 실행 응답의 `inserted`, `updated`가 필요 |
| 실행 전 `tb_sales_toss.max(approved_at)` | 가능 | 현재 read-only 확인값은 `2026-04-10 04:44:52 KST` |
| 실행 후 `tb_sales_toss.max(approved_at)` | 불가 | sync 미실행 |

## revenue 코드 기준으로 실행 결과에 포함되는 필드

확인한 코드:

- `../revenue/backend/app/api/scheduler.py`
- `../revenue/backend/app/tasks/tossApi/batch.py`
- `../revenue/backend/app/services/sales_sync.py`

실행 엔드포인트:

```text
POST /api/scheduler/sales/toss-sync?month=2026-04
```

인증:

```text
x-scheduler-token 헤더 필요
```

성공 시 응답 구조:

```json
{
  "status": "success",
  "job": "toss_sync",
  "month": "2026-04",
  "result": {
    "inserted": 0,
    "updated": 0,
    "total_txns": 0,
    "total_details": 0,
    "total_rows": 0
  }
}
```

필드 의미:

- `total_txns`: Toss 거래목록에서 읽은 총 거래 수
- `total_details`: 중복/제외 상태 필터 후 결제 상세 API로 조회된 건수
- `total_rows`: 해당 월로 변환되어 `tb_sales_toss` upsert 대상이 된 row 수
- `inserted`: 신규 insert 건수
- `updated`: 기존 `payment_key` 충돌로 update된 건수

## 실제 자료를 만들려면 필요한 실행 절차

권한 있는 revenue 운영 환경에서 아래 순서로 실행해야 한다.

1. 실행 전 read-only snapshot 저장

```sql
SELECT
  COUNT(*) AS total,
  MAX(approved_at) AS max_approved_at,
  MAX(synced_at::text) AS max_synced_at
FROM tb_sales_toss;
```

2. revenue Toss sync 1회 실행

```text
POST /api/scheduler/sales/toss-sync?month=2026-04
x-scheduler-token: <운영 스케줄러 토큰>
```

3. 실행 응답 기록

```text
status
job
month
result.inserted
result.updated
result.total_txns
result.total_details
result.total_rows
```

4. 실행 후 read-only snapshot 저장

```sql
SELECT
  COUNT(*) AS total,
  MAX(approved_at) AS max_approved_at,
  MAX(synced_at::text) AS max_synced_at,
  COUNT(*) FILTER (WHERE SUBSTRING(COALESCE(approved_at,''),1,10) = '2026-04-11') AS rows_20260411,
  MAX(approved_at) FILTER (WHERE SUBSTRING(COALESCE(approved_at,''),1,10) = '2026-04-11') AS max_20260411
FROM tb_sales_toss;
```

## 지금 판단

현재 기준으로는 “자료 준비 가능”이라고 말하면 안 된다.

정확한 표현은 아래가 맞다.

```text
현재 실행 전 스냅샷은 준비 가능하다.
하지만 revenue toss-sync 수동 실행 결과 자체는 아직 없다.
운영 DB upsert를 동반하는 작업이므로 권한 있는 운영자가 실행해야 성공/실패, 읽은 건수, upsert 건수, 실행 후 max(approved_at)을 확정할 수 있다.
```

## 다음 액션

1순위는 권한 있는 운영자가 revenue 환경에서 `POST /api/scheduler/sales/toss-sync?month=2026-04`를 1회 실행하고 응답 JSON을 공유하는 것이다.

그 다음 SEO 쪽에서 확인할 값:

```text
tb_sales_toss.max(approved_at)이 2026-04-10 04:44:52 KST 이후로 전진했는가?
2026-04-11 rows가 0보다 커졌는가?
SEO Attribution pending 중 tb_sales_toss 기반 confirmed 승격이 다시 증가하는가?
CAPI auto_sync 로그에서 retry-like 중복이 더 생기는가?
```
