작성 시각: 2026-05-25 15:21 KST
기준일: 2026-05-25
문서 성격: VM Cloud 고객 유입 장부 과거 오분류 backfill apply 승인안

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - data/!data_inventory.md
  required_context_docs:
    - project/biocom-naver-brandsearch-iphone-smoke-cost-join-backfill-dry-run-20260525.md
    - project/biocom-naver-brandsearch-cost-source-gap-20260525.md
  lane: Yellow
  allowed_after_approval:
    - VM Cloud SQLite file backup
    - site_landing_ledger scoped UPDATE
    - post-check read-only validation
    - rollback by backup restore if needed
  forbidden_even_after_approval:
    - operating DB write
    - Naver Ads setting change
    - platform send/upload
    - GTM publish
    - backend deploy/restart unless rollback requires process restart
  source_window_freshness_confidence:
    source: VM Cloud SQLite /home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3
    window: 2026-05-11..2026-05-25 KST
    freshness: dry-run checked 2026-05-25 KST
    confidence: 0.91
```

## 10초 요약

이 승인안은 과거 고객 유입 장부에서 네이버 브랜드검색 UTM marker가 있는데도 `self_internal`, `organic_search`, `paid_search` 등으로 잘못 분류된 row를 `naver_brandsearch`로 보정하는 작업이다. 실제 주문/결제 원장은 건드리지 않고, 광고 플랫폼에도 아무것도 보내지 않는다.

승인 후 바뀌는 것은 VM Cloud SQLite `site_landing_ledger.channel_classified`와 `source_breakdown` 일부다. dry-run 기준 대상은 biocom 350 rows다.

## 왜 필요한가

브랜드검색 비용 join을 하려면 내부 유입도 같은 기준이어야 한다.

지금은 2026-05-25 배포 전 row 중 일부가 아래처럼 남아 있다.

- 네이버 브랜드검색 UTM marker는 있음.
- 하지만 referrer가 자기 도메인이라 `self_internal`로 분류됨.
- 또는 Naver referrer라 `organic_search`로 분류됨.
- 또는 이전 Google click id가 남아 있어 `paid_search/google.com`으로 분류됨.

이 상태에서는 브랜드검색 광고비는 있는데 내부 유입/주문은 다른 채널로 흩어진다. 그러면 브랜드검색 ROAS가 과소/과대 계산된다.

## 승인 요청

TJ님이 승인하면 Codex가 실행할 작업:

1. VM Cloud SQLite 파일 백업.
2. dry-run과 동일 조건으로 350 rows UPDATE.
3. post-check에서 같은 조건 잔여 0 확인.
4. 채널 분포 변경 전/후 요약 보고.

## 대상

DB:

```text
VM Cloud SQLite /home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3
```

테이블:

```text
site_landing_ledger
```

조건:

- `site='biocom'`
- `landed_at >= 2026-05-10T15:00:00.000Z` (KST 2026-05-11 00:00 이후)
- UTM/source breakdown 중 하나에 Naver 브랜드검색 marker 존재
- 현재 `channel_classified <> 'naver_brandsearch'`

dry-run count:

| current channel | source breakdown | click id type | rows |
|---|---|---|---:|
| self_internal | biocom.kr | none | 259 |
| organic_search | m.search.naver.com | none | 47 |
| organic_search | search.naver.com | none | 21 |
| direct | empty | none | 12 |
| paid_search | google.com | gclid hash | 5 |
| organic_search | orders.pay.naver.com | none | 3 |
| organic_search | pay.naver.com | none | 1 |
| organic_search | shopping.naver.com | none | 1 |
| referral | accounts.kakao.com | none | 1 |

합계: 350 rows.

이미 정상 분류된 marker row: 15 rows.

## 실행 전 백업

```bash
BACKUP_DIR=/home/biocomkr_sns/seo/repo/.deploy-backups/biocom-naver-brandsearch-backfill-$(date +%Y%m%dT%H%MKST)
DB=/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3

mkdir -p "$BACKUP_DIR"
sqlite3 "$DB" 'PRAGMA wal_checkpoint(TRUNCATE);'
cp -a "$DB" "$BACKUP_DIR/crm.sqlite3.before-naver-brandsearch-backfill.bak"
cp -a "$DB-wal" "$BACKUP_DIR/crm.sqlite3-wal.before-naver-brandsearch-backfill.bak" 2>/dev/null || true
cp -a "$DB-shm" "$BACKUP_DIR/crm.sqlite3-shm.before-naver-brandsearch-backfill.bak" 2>/dev/null || true
```

성공 기준:

- backup file exists.
- DB file size가 0이 아님.

## apply SQL

```sql
BEGIN IMMEDIATE;

UPDATE site_landing_ledger
SET
  channel_classified = 'naver_brandsearch',
  source_breakdown = CASE
    WHEN lower(coalesce(utm_source, '')) LIKE '%naverbrandsearch%'
      OR lower(coalesce(utm_source, '')) LIKE '%naver_brand_search%'
      OR lower(coalesce(utm_source, '')) LIKE '%naver_brandsearch%'
      THEN lower(utm_source)
    WHEN lower(coalesce(utm_medium, '')) LIKE '%naverbrandsearch%'
      OR lower(coalesce(utm_medium, '')) LIKE '%naver_brand_search%'
      OR lower(coalesce(utm_medium, '')) LIKE '%naver_brandsearch%'
      THEN lower(utm_medium)
    WHEN lower(coalesce(utm_campaign, '')) LIKE '%naverbrandsearch%'
      OR lower(coalesce(utm_campaign, '')) LIKE '%naver_brand_search%'
      OR lower(coalesce(utm_campaign, '')) LIKE '%naver_brandsearch%'
      THEN lower(utm_campaign)
    WHEN lower(coalesce(utm_content, '')) LIKE '%naverbrandsearch%'
      OR lower(coalesce(utm_content, '')) LIKE '%naver_brand_search%'
      OR lower(coalesce(utm_content, '')) LIKE '%naver_brandsearch%'
      THEN lower(utm_content)
    WHEN lower(coalesce(source_breakdown, '')) LIKE '%naverbrandsearch%'
      OR lower(coalesce(source_breakdown, '')) LIKE '%naver_brand_search%'
      OR lower(coalesce(source_breakdown, '')) LIKE '%naver_brandsearch%'
      THEN lower(source_breakdown)
    ELSE 'naver_brandsearch'
  END,
  updated_at = datetime('now')
WHERE site = 'biocom'
  AND landed_at >= '2026-05-10T15:00:00.000Z'
  AND channel_classified <> 'naver_brandsearch'
  AND (
    lower(coalesce(utm_source, '')) LIKE '%naverbrandsearch%'
    OR lower(coalesce(utm_medium, '')) LIKE '%naverbrandsearch%'
    OR lower(coalesce(utm_campaign, '')) LIKE '%naverbrandsearch%'
    OR lower(coalesce(utm_content, '')) LIKE '%naverbrandsearch%'
    OR lower(coalesce(source_breakdown, '')) LIKE '%naverbrandsearch%'
    OR lower(coalesce(utm_source, '')) LIKE '%naver_brand_search%'
    OR lower(coalesce(utm_medium, '')) LIKE '%naver_brand_search%'
    OR lower(coalesce(utm_campaign, '')) LIKE '%naver_brand_search%'
    OR lower(coalesce(utm_content, '')) LIKE '%naver_brand_search%'
    OR lower(coalesce(source_breakdown, '')) LIKE '%naver_brand_search%'
    OR lower(coalesce(utm_source, '')) LIKE '%naver_brandsearch%'
    OR lower(coalesce(utm_medium, '')) LIKE '%naver_brandsearch%'
    OR lower(coalesce(utm_campaign, '')) LIKE '%naver_brandsearch%'
    OR lower(coalesce(utm_content, '')) LIKE '%naver_brandsearch%'
    OR lower(coalesce(source_breakdown, '')) LIKE '%naver_brandsearch%'
  );

COMMIT;
```

## post-check SQL

잔여 오분류:

```sql
SELECT COUNT(*) AS remaining_misclassified
FROM site_landing_ledger
WHERE site = 'biocom'
  AND landed_at >= '2026-05-10T15:00:00.000Z'
  AND channel_classified <> 'naver_brandsearch'
  AND (
    lower(coalesce(utm_source, '')) LIKE '%naverbrandsearch%'
    OR lower(coalesce(utm_medium, '')) LIKE '%naverbrandsearch%'
    OR lower(coalesce(utm_campaign, '')) LIKE '%naverbrandsearch%'
    OR lower(coalesce(utm_content, '')) LIKE '%naverbrandsearch%'
    OR lower(coalesce(source_breakdown, '')) LIKE '%naverbrandsearch%'
    OR lower(coalesce(utm_source, '')) LIKE '%naver_brand_search%'
    OR lower(coalesce(utm_medium, '')) LIKE '%naver_brand_search%'
    OR lower(coalesce(utm_campaign, '')) LIKE '%naver_brand_search%'
    OR lower(coalesce(utm_content, '')) LIKE '%naver_brand_search%'
    OR lower(coalesce(source_breakdown, '')) LIKE '%naver_brand_search%'
    OR lower(coalesce(utm_source, '')) LIKE '%naver_brandsearch%'
    OR lower(coalesce(utm_medium, '')) LIKE '%naver_brandsearch%'
    OR lower(coalesce(utm_campaign, '')) LIKE '%naver_brandsearch%'
    OR lower(coalesce(utm_content, '')) LIKE '%naver_brandsearch%'
    OR lower(coalesce(source_breakdown, '')) LIKE '%naver_brandsearch%'
  );
```

성공 기준:

- `remaining_misclassified = 0`
- `channel_classified='naver_brandsearch'` marker rows = 365
- apply row count = 350
- `site='thecleancoffee'` rows 변경 0

## rollback

문제 발생 시:

```bash
pm2 stop seo-backend
cp -a "$BACKUP_DIR/crm.sqlite3.before-naver-brandsearch-backfill.bak" "$DB"
cp -a "$BACKUP_DIR/crm.sqlite3-wal.before-naver-brandsearch-backfill.bak" "$DB-wal" 2>/dev/null || true
cp -a "$BACKUP_DIR/crm.sqlite3-shm.before-naver-brandsearch-backfill.bak" "$DB-shm" 2>/dev/null || true
pm2 start seo-backend
pm2 save
```

rollback은 backend process가 SQLite 파일을 잡고 있을 수 있으므로 stop/start가 필요할 수 있다. apply 자체는 backend restart 없이 가능하다.

## stop criteria

아래 중 하나라도 발생하면 apply를 멈춘다.

- backup 생성 실패.
- dry-run count가 350에서 달라짐.
- apply 후 `remaining_misclassified > 0`.
- apply row count가 350이 아님.
- DB lock 또는 WAL checkpoint 실패.
- post-check 중 raw 식별자 출력이 필요한 상황 발생.

## 하지 않을 것

- 결제/주문 상태 변경 안 함.
- 운영DB 변경 안 함.
- 광고 계정 변경 안 함.
- 외부 플랫폼 전송 안 함.
- raw click/order/member/payment 값 출력 안 함.

## TJ님 승인 문구

```text
승인합니다. VM Cloud SQLite site_landing_ledger에서 biocom 2026-05-11 이후 Naver 브랜드검색 marker 오분류 350 rows를 naver_brandsearch로 backfill apply 하세요. 백업, apply, post-check, rollback 가능 상태 확인까지 진행하세요.
```
