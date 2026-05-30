# Naver 브랜드검색 수동 비용 cache write 승인안

작성 시각: 2026-05-25 21:35 KST
기준일: 2026-05-25
문서 성격: VM Cloud SQLite 수동 브랜드검색 비용 daily cache 생성/upsert 승인안
상위 문서: [[naver-brandsearch-manual-cost-source-policy-20260525]]
실행 결과: [[naver-brandsearch-manual-cost-cache-write-result-20260525]]

> 2026-05-25 22:00 KST 업데이트: TJ님 승인 후 실행 완료. 결과는 [[naver-brandsearch-manual-cost-cache-write-result-20260525]]에 둔다.

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
    - project/naver-brandsearch-manual-cost-source-policy-20260525.md
    - data/project/naver-brandsearch-manual-contracts-20260525.json
    - data/project/naver-brandsearch-manual-cost-preview-20260525.json
  lane: Yellow
  allowed_after_approval:
    - VM Cloud SQLite backup
    - create naver_brandsearch_manual_cost_daily table if missing
    - upsert manual daily cost rows generated from approved JSON only
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
    - raw_identifier_output
  source_window_freshness_confidence:
    source: TJ-confirmed manual brandsearch contract JSON + local no-write preview
    window: 2026-05-11..2026-07-20 KST preview, future periods only by explicit renewal assumption
    freshness: generated 2026-05-25 21:25 KST
    confidence: high for first confirmed contract periods, medium for renewal projection
```

## 10초 요약

승인 후 할 일은 VM Cloud에 브랜드검색 수동 비용 일별 cache를 만드는 것이다.

이 cache는 광고 계정이나 전환값을 바꾸지 않는다. Slack/ROAS 보고서가 `Naver 브랜드검색 비용`을 0원으로 빠뜨리지 않도록, TJ님이 확인한 계약 금액을 일별로 나눈 내부 비용표를 만드는 작업이다.

바이오컴 브랜드검색 총액은 Bizmoney API에서 2,420,000원으로 cross-check 됐다. 다만 Bizmoney는 차감일 기준이라 주간/월간 리포트에 바로 넣지 않는다. 리포트 반영은 이 수동 기간 배분 cache write가 승인된 뒤 진행한다.

## 승인 요청 범위

승인 후 Codex가 실행할 작업:

1. VM Cloud SQLite 백업.
2. `naver_brandsearch_manual_cost_daily` 테이블 생성.
3. `data/project/naver-brandsearch-manual-cost-preview-20260525.json`의 `daily_rows`만 upsert.
4. post-check에서 site/device/window별 row 수와 금액 합계 확인.
5. 결과 문서 작성.

대상 DB:

```text
VM Cloud SQLite /home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3
```

대상 preview:

```text
data/project/naver-brandsearch-manual-cost-preview-20260525.json
```

대상 범위:

```text
2026-05-11..2026-07-20 KST
daily rows 262
total 6,724,673원
```

## apply schema

```sql
CREATE TABLE IF NOT EXISTS naver_brandsearch_manual_cost_daily (
  site TEXT NOT NULL,
  date TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'naver_brandsearch',
  device TEXT NOT NULL,
  cost_krw INTEGER NOT NULL,
  contract_amount_krw INTEGER NOT NULL,
  contract_period_start TEXT NOT NULL,
  contract_period_end TEXT NOT NULL,
  contract_period_days INTEGER NOT NULL,
  cycle_index INTEGER NOT NULL DEFAULT 0,
  source_type TEXT NOT NULL,
  contract_possible_searches INTEGER,
  source_file TEXT NOT NULL,
  cached_at TEXT NOT NULL,
  PRIMARY KEY (
    site,
    date,
    channel,
    device,
    contract_period_start,
    contract_period_end,
    source_type
  )
);

CREATE INDEX IF NOT EXISTS idx_nbs_manual_cost_site_date
ON naver_brandsearch_manual_cost_daily(site, date DESC);
```

## post-check 기준

전체:

```text
rows=262
total_cost_krw=6724673
```

site/device:

```text
biocom/mobile rows=60 cost=1760000
biocom/pc rows=60 cost=1320000
thecleancoffee/mobile rows=71 cost=2082673
thecleancoffee/pc rows=71 cost=1562000
```

confirmed first contract:

```text
thecleancoffee 2026-05-11..2026-06-09 total=1540000
biocom mobile 2026-05-22..2026-07-20 total=1760000
biocom pc 2026-05-22..2026-06-20 total=660000
```

## 하지 않을 것

- 운영DB write 안 함.
- Naver Ads 계정/캠페인/예산/소재 변경 안 함.
- Naver Ads 전환 upload 안 함.
- GA4/Meta/TikTok/Google/Naver 전송 안 함.
- `naver_ads_daily` overwrite 안 함.
- backend deploy/restart 안 함.
- raw 주문/결제/고객/클릭 식별자 출력 안 함.

## stop criteria

아래 중 하나라도 발생하면 중단한다.

- DB 백업 실패.
- preview JSON parse 실패.
- preview 전체 row 수가 262가 아님.
- preview 전체 금액이 6,724,673원이 아님.
- site/device별 합계가 post-check 기준과 다름.
- apply 후 중복 primary key 충돌이 의도와 다르게 발생.
- DB lock 또는 WAL checkpoint 실패.
- raw 식별자 출력이 필요한 상황 발생.

## rollback

문제 발생 시 백업 파일로 되돌린다. SQLite 파일 교체가 필요하면 backend stop/start가 필요할 수 있다.

## 승인 문구

아래처럼 승인하면 실행할 수 있다.

```text
Naver 브랜드검색 수동 비용 cache write 승인. VM Cloud SQLite에 2026-05-11..2026-07-20 daily rows 262건을 preview 기준으로 적재해.
```

## Auditor verdict

```text
Auditor verdict: APPROVAL_PACKET_READY
Lane after approval: Yellow
No platform send: YES
No operating DB write: YES
No Naver Ads state change: YES
```
