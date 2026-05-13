# biocom GA4 sourceFreshness 운영 배포 결과

작성 시각: 2026-05-13 23:34 KST

## 한 줄 결론

운영 `sourceFreshness`가 옛 허들러스 `events_20260506` stale 상태에서 신규 GA4 export `events_20260512` fresh 상태로 전환됐다.

## 배포한 것

- VM Cloud backend 파일 2개 반영
  - `backend/src/sourceFreshness.ts`
  - `backend/src/routes/total.ts`
- remote backup
  - `/home/biocomkr_sns/seo/repo/.deploy-backups/sourcefreshness-new-export-20260513T2328KST`
- backend typecheck/build 실행
- `seo-backend` restart 실행

## pre/post 비교

pre:

- `ga4_bigquery_biocom.status`: `stale`
- table: `hurdlers-naver-pay.analytics_304759974.events_20260506`
- latest event: `2026-05-06T23:59:52+09:00`
- ageHours: 167.5

post:

- `ga4_bigquery_biocom.status`: `fresh`
- table: `project-dadba7dd-0229-4ff6-81c.analytics_304759974.events_20260512`
- latest event: `2026-05-12T23:59:57+09:00`
- ageHours: 23.6
- latest table rows: 49,111
- purchase events: 64
- distinct purchase transaction_id: 64
- archive segment: `events_20240909~events_20260506`, 605 tables
- current segment: `events_20260507~events_20260512`, 6 tables
- boundary: contiguous

## 검증

- remote backend typecheck: PASS
- remote backend build: PASS
- `seo-backend` restart: PASS
- `seo-backend` status: online
- 공개 API `/api/source-freshness`: PASS

## 별도 관찰

운영 `/api/total/monthly-channel-summary`는 pre/post 모두 `scripts/monthly-spine-dry-run.ts`가 VM Cloud backend에 없어 실패한다. 이번 sourceFreshness 전환 실패가 아니라 기존 `/total` 운영 route 배포 범위의 별도 문제다.

## 금지선

- BigQuery write/copy/delete 없음
- 운영DB write/import 없음
- 외부 광고 플랫폼 send/upload 없음
- GTM publish 없음
- Imweb footer/header 변경 없음
- raw identifier 출력 없음
