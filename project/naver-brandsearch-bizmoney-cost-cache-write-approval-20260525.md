# Naver 브랜드검색 Bizmoney 비용 cache write 승인안

작성 시각: 2026-05-25 17:18 KST
기준일: 2026-05-25
문서 성격: VM Cloud SQLite 브랜드검색 비용 cache 생성/upsert 승인안

> 2026-05-25 21:36 KST 업데이트: TJ님이 더클린커피와 바이오컴 브랜드검색 계약 금액을 수동으로 확정했다. 브랜드검색 API 조회는 당분간 재확인 대상으로 두고, 보고서 primary 비용 원천은 [[naver-brandsearch-manual-cost-source-policy-20260525]]로 이동한다. 이 Bizmoney 승인안은 API/Bizmoney 원천을 다시 primary 후보로 올릴 때까지 parked 상태다. 현재 실행 승인안은 [[naver-brandsearch-manual-cost-cache-write-approval-20260525]]다.

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docurule.md
    - data/!data_inventory.md
  required_context_docs:
    - project/biocom-naver-brandsearch-cost-source-gap-20260525.md
    - project/naver-brandsearch-backfill-bizmoney-preview-result-20260525.md
  lane: Yellow
  allowed_after_approval:
    - VM Cloud SQLite backup
    - create naver_bizmoney_cost_daily table if missing
    - upsert biocom brandsearch Bizmoney cost aggregate rows only
    - post-check read-only validation
    - rollback by backup restore if needed
  forbidden_even_after_approval:
    - operating DB write
    - Naver Ads setting change
    - Naver Ads conversion send/upload
    - GA4/Meta/TikTok/Google platform send
    - GTM publish
    - backend deploy/restart unless rollback requires process restart
    - naver_ads_daily overwrite
    - thecleancoffee cost write before account scope is confirmed
  source_window_freshness_confidence:
    source: Naver Search Ad API /billing/bizmoney/histories/exhaust preview JSON + VM Cloud SQLite
    window: 2026-04-21..2026-05-24 KST
    freshness: preview generated 2026-05-25 KST
    confidence: 0.90 for connected biocom Naver Ads account, 0.55 for unconfigured coffee account
```

## 10초 요약

브랜드검색 광고비는 기존 `naver_ads_daily`에 들어오지 않는다. `/stats.salesAmt`가 브랜드검색 비용을 0으로 내려주기 때문이다.

승인 후 할 일은 VM Cloud SQLite에 별도 비용 cache 테이블을 만들고, 연결된 biocom Naver Ads 계정에서 확인된 브랜드검색 Bizmoney 비용만 적재하는 것이다. 광고 계정 설정, 전환 전송, 주문 원장은 건드리지 않는다.

이번 승인안은 biocom 브랜드검색 비용 2,420,000원만 대상으로 한다. 더클린커피 브랜드검색 88만원 모바일 + 66만원 PC는 현재 연결 계정과 불일치하므로 이 승인안에 포함하지 않는다.

## 왜 필요한가

현재 Naver 광고비 화면/summary는 `naver_ads_daily.sales_amt_krw`를 광고비로 읽는다. 이 값은 파워링크, 쇼핑검색, 파워컨텐츠에는 대체로 맞지만, 브랜드검색은 비용이 0원으로 들어온다.

그 결과:

- 브랜드검색 클릭/전환값은 있는데 비용이 0원처럼 보인다.
- 내부 ROAS에서 브랜드검색 비용이 빠진다.
- 브랜드검색 광고상품을 별도 라인으로 판단할 수 없다.

## 승인 요청 범위

승인 후 Codex가 실행할 작업:

1. VM Cloud SQLite 파일 백업.
2. `naver_bizmoney_cost_daily` 테이블 생성.
3. preview와 같은 window에서 브랜드검색 비용을 재확인.
4. `site='biocom'`, `campaign_tp=4`, `product_code='NCC'` row만 upsert.
5. post-check에서 총액 2,420,000원, raw rows 2건 확인.

DB:

```text
VM Cloud SQLite /home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3
```

대상 source:

```text
Naver Search Ad API /billing/bizmoney/histories/exhaust
```

대상 window:

```text
2026-04-21..2026-05-24 KST
```

대상 금액:

```text
campaignTp=4 / product=NCC / date=2026-05-21 / cost=2,420,000원 / raw rows=2
```

## 하지 않을 것

- 운영DB write 안 함.
- `naver_ads_daily` overwrite 안 함.
- 더클린커피 비용 write 안 함.
- Naver Ads 광고 설정 변경 안 함.
- Naver Ads 전환 upload 안 함.
- GA4/Meta/TikTok/Google/Naver 전송 안 함.
- backend deploy/restart 안 함.

## 실행 전 백업

```bash
BACKUP_DIR=/home/biocomkr_sns/seo/repo/.deploy-backups/naver-bizmoney-cost-cache-$(date +%Y%m%dT%H%MKST)
DB=/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3

mkdir -p "$BACKUP_DIR"
sqlite3 "$DB" 'PRAGMA wal_checkpoint(TRUNCATE);'
cp -a "$DB" "$BACKUP_DIR/crm.sqlite3.before-naver-bizmoney-cost-cache.bak"
cp -a "$DB-wal" "$BACKUP_DIR/crm.sqlite3-wal.before-naver-bizmoney-cost-cache.bak" 2>/dev/null || true
cp -a "$DB-shm" "$BACKUP_DIR/crm.sqlite3-shm.before-naver-bizmoney-cost-cache.bak" 2>/dev/null || true
```

성공 기준:

- backup file exists.
- backup size > 0.

## apply SQL

이 SQL은 preview 결과가 다시 2,420,000원 / raw rows 2건으로 확인된 뒤 실행한다.

```sql
BEGIN IMMEDIATE;

CREATE TABLE IF NOT EXISTS naver_bizmoney_cost_daily (
  site TEXT NOT NULL DEFAULT 'biocom',
  date TEXT NOT NULL,
  source_operation TEXT NOT NULL,
  campaign_tp INTEGER NOT NULL,
  campaign_type_label TEXT NOT NULL DEFAULT '',
  product_code TEXT NOT NULL DEFAULT '',
  cost_krw INTEGER NOT NULL DEFAULT 0,
  raw_rows_count INTEGER NOT NULL DEFAULT 0,
  source_window_start TEXT NOT NULL DEFAULT '',
  source_window_end TEXT NOT NULL DEFAULT '',
  cached_at TEXT NOT NULL,
  PRIMARY KEY (site, date, source_operation, campaign_tp, product_code)
);

CREATE INDEX IF NOT EXISTS idx_nbc_site_date
ON naver_bizmoney_cost_daily(site, date DESC);

INSERT INTO naver_bizmoney_cost_daily (
  site,
  date,
  source_operation,
  campaign_tp,
  campaign_type_label,
  product_code,
  cost_krw,
  raw_rows_count,
  source_window_start,
  source_window_end,
  cached_at
) VALUES (
  'biocom',
  '2026-05-21',
  'billing_bizmoney_exhaust',
  4,
  'BRAND_SEARCH',
  'NCC',
  2420000,
  2,
  '2026-04-21',
  '2026-05-24',
  datetime('now')
)
ON CONFLICT(site, date, source_operation, campaign_tp, product_code)
DO UPDATE SET
  campaign_type_label = excluded.campaign_type_label,
  cost_krw = excluded.cost_krw,
  raw_rows_count = excluded.raw_rows_count,
  source_window_start = excluded.source_window_start,
  source_window_end = excluded.source_window_end,
  cached_at = excluded.cached_at;

COMMIT;
```

## post-check SQL

```sql
SELECT
  COUNT(*) AS rows,
  SUM(cost_krw) AS brandsearch_cost_krw,
  SUM(raw_rows_count) AS raw_rows_count
FROM naver_bizmoney_cost_daily
WHERE site = 'biocom'
  AND source_operation = 'billing_bizmoney_exhaust'
  AND campaign_tp = 4
  AND product_code = 'NCC'
  AND date >= '2026-04-21'
  AND date <= '2026-05-24';
```

성공 기준:

```text
rows=1
brandsearch_cost_krw=2420000
raw_rows_count=2
```

추가 확인:

```sql
SELECT COUNT(*) AS coffee_rows
FROM naver_bizmoney_cost_daily
WHERE site = 'thecleancoffee';
```

성공 기준:

```text
coffee_rows=0
```

## rollback

문제 발생 시 backup으로 되돌린다.

```bash
pm2 stop seo-backend
cp -a "$BACKUP_DIR/crm.sqlite3.before-naver-bizmoney-cost-cache.bak" "$DB"
cp -a "$BACKUP_DIR/crm.sqlite3-wal.before-naver-bizmoney-cost-cache.bak" "$DB-wal" 2>/dev/null || true
cp -a "$BACKUP_DIR/crm.sqlite3-shm.before-naver-bizmoney-cost-cache.bak" "$DB-shm" 2>/dev/null || true
pm2 start seo-backend
pm2 save
```

주의:

- apply 자체는 backend restart 없이 가능하다.
- rollback은 SQLite 파일 교체가 필요할 수 있어 backend stop/start가 들어간다.

## stop criteria

아래 중 하나라도 발생하면 실행을 멈춘다.

- backup 생성 실패.
- preview 재확인에서 브랜드검색 비용이 2,420,000원이 아님.
- preview 재확인에서 raw rows가 2건이 아님.
- apply 후 post-check 금액이 2,420,000원이 아님.
- `site='thecleancoffee'` row가 생김.
- DB lock 또는 WAL checkpoint 실패.
- raw secret/order/payment/click/member 값을 출력해야 하는 상황 발생.

## 이번 승인안에 포함하지 않는 후속 작업

1. summary API fallback 연결
   - 브랜드검색 비용 cache를 화면/API에서 읽게 하려면 backend helper와 summary API가 이 테이블을 읽어야 한다.
   - 이 작업은 코드 변경 + 배포가 필요하므로 별도 승인안으로 분리한다.

2. 비용 기간 배분
   - 현재 row는 차감일 기준이다.
   - ROAS 보고에서 기간 배분을 쓰려면 계약 기간 또는 노출 기간 기준을 정해야 한다.

3. 더클린커피 비용 적재
   - 현재 더클린커피 88만원 모바일 + 66만원 PC는 연결 API 계정과 불일치한다.
   - 전용 Naver Ads credential 또는 UI/account 확인 전에는 적재하지 않는다.

## TJ님 승인 문구

```text
승인합니다. VM Cloud SQLite에 naver_bizmoney_cost_daily 테이블을 만들고, biocom 브랜드검색 Bizmoney 비용 cache를 2026-04-21..2026-05-24 preview 기준으로 upsert하세요. 범위는 site=biocom, campaign_tp=4, product_code=NCC, cost_krw=2,420,000원, raw_rows_count=2로 제한하고, 백업·post-check·rollback 가능 상태 확인까지 진행하세요. 더클린커피 비용 write, Naver Ads 설정 변경, 전환 전송, backend deploy는 하지 마세요.
```

## Auditor verdict

```text
Auditor verdict: APPROVAL_READY
Lane: Yellow
No operating DB write before approval: YES
No Naver Ads state change before approval: YES
No platform send before approval: YES
Expected write scope: VM Cloud SQLite naver_bizmoney_cost_daily only
Remaining decision: TJ approval for VM Cloud SQLite schema/write
```
