# biocom BigQuery Link Cutover Post-check - 2026-05-07

작성 시각: 2026-05-07 16:08 KST
관련 JSON: `data/biocom-bigquery-link-cutover-postcheck-20260507.json`
작업 성격: Green Lane, GA4 Link 생성 후 read-only 확인

## 10초 요약

TJ님 화면 기준으로 biocom GA4 BigQuery Link는 `project-dadba7dd-0229-4ff6-81c`에 생성됐다.
다만 Codex read-only 확인 시점인 2026-05-07 16:07 KST에는 신규 export dataset `project-dadba7dd-0229-4ff6-81c.analytics_304759974`가 아직 BigQuery에서 404로 조회됐다.
이 상태는 링크 생성 직후 daily export dataset/table이 아직 물리화되지 않은 대기 상태로 판단한다.
따라서 sourceFreshness는 아직 전환하지 않고, 신규 daily table이 실제 생성될 때까지 허들러스 live source를 기준으로 유지한다.

## 현재 접근 상태

| 항목 | 값 |
|---|---|
| GA4 Link UI 결과 | 링크 생성됨 |
| 신규 project | `project-dadba7dd-0229-4ff6-81c` |
| 신규 project name | `My First Project` |
| 기대 신규 dataset | `project-dadba7dd-0229-4ff6-81c.analytics_304759974` |
| 기대 location | `asia-northeast3` |
| Codex credential | `seo-656@seo-aeo-487113.iam.gserviceaccount.com` |
| Codex dataset 확인 | 404, 아직 없음 |
| 판단 | Link created, export dataset pending |

## Read-only 확인 결과

2026-05-07 16:07 KST에 `datasets.get`으로 신규 export dataset을 조회했다.

```json
{
  "projectId": "project-dadba7dd-0229-4ff6-81c",
  "datasetId": "analytics_304759974",
  "exists": false,
  "code": 404,
  "message": "Not found: Dataset project-dadba7dd-0229-4ff6-81c:analytics_304759974"
}
```

이 결과만으로 cutover 실패라고 보지 않는다.
GA4 BigQuery Link 생성 직후에는 export dataset과 첫 daily table이 바로 보이지 않을 수 있으며, 실제 판정은 첫 `events_YYYYMMDD` daily table 생성 여부로 한다.

## Freshness 상태

`npx tsx scripts/check-source-freshness.ts --json` 확인 시각: 2026-05-07 16:03 KST

| source | status | table | rows | purchase | distinct transaction_id | max event time KST |
|---|---|---|---:|---:|---:|---|
| `ga4_bigquery_biocom` | `fresh` | `hurdlers-naver-pay.analytics_304759974.events_20260506` | 70,294 | 79 | 79 | 2026-05-06 23:59:52 |
| `ga4_bigquery_thecleancoffee` | `fresh` | `project-dadba7dd-0229-4ff6-81c.analytics_326949178.events_20260506` | 3,924 | 26 | 26 | 2026-05-06 23:59:13 |

중요: `ga4_bigquery_biocom`은 아직 허들러스 source를 본다.
이번 확인에서 sourceFreshness를 신규 dataset이나 backfill archive로 전환하지 않았다.

## Backfill Archive 상태

2026-05-07 16:03 KST에 read-only `delta-plan`을 재확인했다.

| 항목 | source | target | 결과 |
|---|---:|---:|---|
| window | `events_20240909` - `events_20260506` | `events_20240909` - `events_20260506` | 일치 |
| table count | 605 | 605 | 일치 |
| rows | 24,495,738 | 24,495,738 | 일치 |
| size_bytes | 37,928,684,719 | 37,928,684,719 | 일치 |
| missing target tables | 0 | - | 없음 |
| row mismatches | 0 | - | 없음 |
| latest purchase | 79 | 79 | 일치 |
| latest distinct transaction_id | 79 | 79 | 일치 |

archive `project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill`은 현재까지의 과거 보존본으로 닫혀 있다.
하지만 이 dataset은 live freshness source가 아니다.

## 현재 판단

Link 생성 UI는 성공으로 본다.
BigQuery 신규 export dataset은 아직 생성 대기 상태다.
따라서 다음 게이트는 신규 `analytics_304759974` dataset 생성, location `asia-northeast3`, 첫 daily table 생성, 최소 3일 연속 daily table 정상 생성 확인이다.

2026-05-07 cutover 당일 raw BigQuery data는 일부 공백 또는 불완전 구간이 생길 수 있다.
이는 기존 Link 삭제 후 신규 Link 생성이 필요한 단절형 전환의 구조적 리스크다.

## 금지선

- sourceFreshness 전환 금지.
- backfill archive를 live source로 사용 금지.
- `analytics_304759974_hurdlers_backfill`에 GA4 Link 연결 금지.
- BigQuery table copy/delete 금지.
- GA4 Link 추가 삭제/재생성 금지.
- deploy 금지.
- 운영DB write 금지.
- GA4/Meta/TikTok/Google Ads 전송 금지.

## 다음 확인

1. 30-60분 후 `project-dadba7dd-0229-4ff6-81c.analytics_304759974` dataset 존재 여부와 location을 재확인한다.
2. 2026-05-08에 첫 daily table 생성 여부를 확인한다. 예상 후보는 link 생성 시점에 따라 `events_20260507` 또는 그 이후 table이다.
3. 첫 daily table이 생기면 rows, purchase, distinct transaction_id, max event time KST를 기록한다.
4. daily table이 3일 연속 정상 생성된 뒤에만 sourceFreshness 전환 patch를 검토한다.
5. 24-48시간이 지나도 dataset/table이 없으면 GA4 Admin Link 상태, project 선택, location, billing/API 상태를 재확인한다.
