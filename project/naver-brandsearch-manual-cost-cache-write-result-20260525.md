# Naver 브랜드검색 수동 비용 cache write 결과

작성 시각: 2026-05-25 22:00 KST
기준일: 2026-05-25
문서 성격: 승인된 VM Cloud SQLite 수동 브랜드검색 비용 daily cache 적재 결과
상위 문서: [[naver-brandsearch-manual-cost-cache-write-approval-20260525]], [[naver-brandsearch-manual-cost-source-policy-20260525]]

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
    - project/naver-brandsearch-manual-cost-cache-write-approval-20260525.md
    - data/project/naver-brandsearch-manual-cost-preview-20260525.json
  lane: Yellow approved by TJ
  allowed_actions_done:
    - VM Cloud SQLite backup
    - create naver_brandsearch_manual_cost_daily table
    - upsert manual daily cost rows generated from approved JSON only
    - post-check read-only validation
  forbidden_actions_verified:
    - operating DB write: 0
    - Naver Ads setting change: 0
    - Naver Ads conversion send/upload: 0
    - GA4/Meta/TikTok/Google platform send: 0
    - GTM publish: 0
    - backend deploy/restart: 0
    - naver_ads_daily overwrite: 0
    - raw_identifier_output: 0
  source_window_freshness_confidence:
    source: TJ-confirmed manual brandsearch contract JSON + local no-write preview + VM Cloud SQLite post-check
    window: 2026-05-11..2026-07-20 KST
    freshness: applied and verified 2026-05-25 22:00 KST
    confidence: high for first confirmed contract periods, medium for renewal projection
```

## 10초 요약

VM Cloud에 Naver 브랜드검색 수동 비용 일별 cache를 적재했다.

이제 보고서/API가 `Naver 브랜드검색 비용`을 0원으로 놓치지 않고, 기간별로 잘라 읽을 수 있는 내부 비용표가 생겼다. 광고 계정, 전환값, 운영DB, GTM은 건드리지 않았다.

## 실행한 것

대상 DB:

```text
VM Cloud SQLite /home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3
```

대상 table:

```text
naver_brandsearch_manual_cost_daily
```

대상 source:

```text
data/project/naver-brandsearch-manual-cost-preview-20260525.json
```

실행 범위:

```text
2026-05-11..2026-07-20 KST
daily rows 262
total 6,724,673원
```

## 백업

백업 위치:

```text
/home/biocomkr_sns/seo/repo/.deploy-backups/naver-brandsearch-manual-cost-cache-20260525T1251KST
```

백업 파일:

```text
crm.sqlite3.before-naver-brandsearch-manual-cost-cache.bak
```

백업 크기:

```text
384,720,896 bytes
```

## post-check 결과

전체:

| rows | total_cost_krw |
|---:|---:|
| 262 | 6,724,673 |

site/device:

| site | device | rows | cost_krw |
|---|---|---:|---:|
| biocom | mobile | 60 | 1,760,000 |
| biocom | pc | 60 | 1,320,000 |
| thecleancoffee | mobile | 71 | 2,082,673 |
| thecleancoffee | pc | 71 | 1,562,000 |

confirmed first contract:

| check | rows | cost_krw |
|---|---:|---:|
| thecleancoffee 2026-05-11..2026-06-09 | 60 | 1,540,000 |
| biocom mobile 2026-05-22..2026-07-20 | 60 | 1,760,000 |
| biocom pc 2026-05-22..2026-06-20 | 30 | 660,000 |

schema/integrity:

```text
table naver_brandsearch_manual_cost_daily exists
index idx_nbs_manual_cost_site_date exists
PRAGMA integrity_check = ok
```

## sample window read

바이오컴 2026-05-22..2026-05-25 KST:

| device | rows | cost_krw |
|---|---:|---:|
| mobile | 4 | 117,336 |
| pc | 4 | 88,000 |
| total | 8 | 205,336 |

이 값은 리포트 reader가 `date` window로 자르면 같은 방식으로 계산할 수 있다는 smoke다.

## 운영 영향

- VM Cloud SQLite table/create/upsert: 완료.
- backend restart: 0.
- backend deploy: 0.
- 운영DB write: 0.
- Naver Ads 설정 변경: 0.
- Naver Ads 전환 upload: 0.
- GA4/Meta/TikTok/Google/Naver 전송: 0.
- GTM publish: 0.
- `naver_ads_daily` overwrite: 0.

Public read-only API smoke:

```text
GET /api/attribution/site-landing/summary?windowHours=1 -> ok=true
```

PM2:

```text
seo-backend status=online, uptime=3h, restart not performed in this task
```

## 다음 할일

### Auto Green

1. report reader/no-send preview에 cache reader를 연결한다.
   - 무엇: `naver_brandsearch_manual_cost_daily`에서 site/window별 비용을 읽는 read-only helper를 만든다.
   - 왜: cache는 생겼지만 보고서 집계기가 읽어야 실제 리포트에 반영된다.
   - 승인 필요: 로컬 read-only/no-send는 NO.

2. 바이오컴/더클린커피 no-send 리포트에서 Naver 브랜드검색 비용 라인을 분리한다.
   - 무엇: `Naver 브랜드검색`을 일반 검색 광고와 별도 라인으로 표시한다.
   - 왜: 브랜드검색은 비용 구조와 해석이 파워링크와 다르다.
   - 승인 필요: preview는 NO, Slack 실제 발송은 YES.

### Approval Needed

1. VM Cloud API 또는 frontend에 cache reader를 배포한다.
   - 이유: 로컬 helper만으로는 live dashboard가 이 table을 읽지 못한다.
   - 승인 필요: YES, backend deploy/restart 필요 시 Yellow.

## Auditor verdict

```text
Auditor verdict: PASS
Approved Yellow executed: YES
Backup: PASS
Apply: PASS
Post-check: PASS
No platform send: YES
No operating DB write: YES
No backend deploy/restart: YES
Next lane: Green for no-send reader, Yellow for VM Cloud API deploy
```
