# biocom GA4 sourceFreshness 운영 반영 승인안

작성 시각: 2026-05-13 23:26 KST

## 무엇을 승인하는가

운영 backend가 biocom GA4 freshness를 옛 허들러스 원본이 아니라 신규 GA4 export + historical backfill 조합으로 보도록 반영한다.

운영 반영 대상 파일:

- `backend/src/sourceFreshness.ts`
- `backend/src/routes/total.ts`
- `frontend/src/app/total/page.tsx`

frontend 파일은 source 코드 `ga4_bigquery_biocom`을 사람용 문구 `GA4 BigQuery 원본`으로 보여주기 위한 보조 변경이다.

## 왜 필요한가

로컬 검증에서는 `ga4_bigquery_biocom`이 이미 fresh다. 하지만 운영 backend/frontend에 배포하지 않으면 운영 화면은 계속 과거 경고 또는 코드명 표시를 유지할 수 있다.

## 기대 결과

- `/api/source-freshness`의 `ga4_bigquery_biocom.status = fresh`
- current table: `project-dadba7dd-0229-4ff6-81c.analytics_304759974.events_20260512` 이상
- archive segment: `events_20240909~events_20260506`
- current segment: `events_20260507~events_20260512` 이상
- `/total`의 GA4 BigQuery 원본은 연결 끊김 경고에서 빠진다.
- GA4 purchase revenue는 예산 판단 매출에 더하지 않는다.

## 승인 범위

허용:

- VM Cloud backend file copy
- backend typecheck/build
- `seo-backend` restart
- frontend build/deploy가 현재 운영 방식에 포함되어 있으면 `/total` label patch 반영
- pre/post snapshot curl
- rollback 준비

금지:

- BigQuery write/copy/delete
- 운영DB write/import
- Google Ads/GA4/Meta/TikTok/Naver send/upload
- Google Data Manager ingest
- GTM publish
- Imweb footer/header 변경
- raw identifier 출력

## pre-snapshot

```bash
curl -sS -m 90 'https://att.ainativeos.net/api/source-freshness' \
  | jq '.results[] | select(.source=="ga4_bigquery_biocom")'

curl -sS -m 120 'https://att.ainativeos.net/api/total/monthly-channel-summary?site=biocom&month=2026-05&mode=dry_run' \
  | jq '.source_freshness[] | select(.source=="ga4_bigquery_biocom" or .source=="ga4_bigquery_raw")'
```

## deploy 개요

1. remote backup 생성
2. 위 3개 파일 반영
3. backend typecheck/build
4. `seo-backend` restart
5. post-snapshot curl

## post-snapshot 성공 기준

- summary/source freshness API 200
- `ga4_bigquery_biocom.status=fresh`
- `fallback_reason=null` 또는 fresh 상태에서 경고 미노출
- archive/current segment가 응답에 포함
- `/total` monthly summary의 warning count가 GA4 때문에 증가하지 않음
- no send/upload/write

## rollback 조건

- summary API 5xx
- sourceFreshness API 5xx
- GA4가 actual 매출 정본처럼 합산됨
- archive/current segment가 모두 사라짐
- raw identifier 노출
- 외부 send/upload/write 발생

## rollback 방식

remote backup에서 위 파일 3개를 되돌리고 backend build/restart 후 pre-snapshot과 같은 curl을 재실행한다.
