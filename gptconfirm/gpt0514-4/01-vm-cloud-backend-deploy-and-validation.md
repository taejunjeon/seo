# VM Cloud backend 배포와 검증

작성 시각: 2026-05-14 03:00 KST

## 목적

`/total`이 네이버 후보를 제한 item slice가 아니라 VM Cloud 전체 aggregate 기준으로 읽게 만드는 것이 목적이다. 이 값은 내부 confirmed 매출 정본이 아니라 채널 evidence다. 예산 ROAS에는 자동 포함하지 않는다.

## 배포 범위

VM Cloud backend에 아래 파일을 반영했다.

- `backend/src/routes/attribution.ts`
- `backend/src/routes/total.ts`
- `backend/src/sourceFreshness.ts`
- `backend/src/naverAdsLocalDb.ts`
- `backend/scripts/monthly-spine-dry-run.ts`
- `backend/scripts/monthly-evidence-join-dry-run.ts`

`backend/src/naverAdsLocalDb.ts`는 `/total` read-only 호출이 VM Cloud SQLite에 `naver_ads_daily` 테이블을 자동 생성하지 않도록 보강했다. 수집/upsert 경로만 명시적으로 bootstrap하도록 분리했다.

## Backup

remote backup:

```text
/home/biocomkr_sns/seo/repo/.deploy-backups/gpt0514-4-20260513T173652Z
```

백업된 파일:

- `backend/src/routes/attribution.ts`
- `backend/src/routes/total.ts`
- `backend/src/sourceFreshness.ts`

배포 전 remote에 없던 파일:

- `backend/scripts/monthly-spine-dry-run.ts`
- `backend/scripts/monthly-evidence-join-dry-run.ts`
- `backend/src/naverAdsLocalDb.ts`

## 검증 결과

source: VM Cloud backend `att.ainativeos.net`
window: biocom 2026-05 KST month
freshness: 2026-05-14 02:59 KST post-snapshot
confidence: 0.92

API post-snapshot:

```json
{
  "health_ok": true,
  "aggregate_ok": true,
  "total_ok": true,
  "aggregate_summary": {
    "rowsTotal": 23882,
    "naverAny": 690,
    "byClass": {
      "paid_naver": 352,
      "naver_brandsearch": 326,
      "organic_naver_candidate": 0,
      "naver_referrer_or_utm_only": 12
    }
  },
  "flags": {
    "aggregateOnly": true,
    "rawIdentifierOutput": false,
    "budgetRoasIncluded": false
  }
}
```

검증 명령:

```bash
npm run typecheck
npm run build
curl 'https://att.ainativeos.net/health'
curl 'https://att.ainativeos.net/api/attribution/ledger/naver-evidence-aggregate?...'
curl 'https://att.ainativeos.net/api/total/monthly-channel-summary?site=biocom&month=2026-05'
```

## 144 vs 216 vs 690 해석

이전 144건은 제한된 item slice 또는 특정 referrer slice였다. gpt0514-2의 216건은 VM Cloud payment_success 중심 네이버 후보였다. 이번 690건은 checkout_started까지 포함한 2026년 5월 VM Cloud 전체 aggregate다.

따라서 현재 `/total`이 써야 할 기준은 690건 전체 aggregate다. 단, 이 690건은 매출 정본이 아니라 채널 evidence이므로 budget ROAS에는 자동 포함하지 않는다.

## 운영 프론트 상태

`https://biocom.ainativeos.net/total`은 2026-05-14 02:52 KST 기준 404다. backend API는 운영 반영됐지만 public frontend route는 별도 배포가 필요하다.

## No-Send / No-Write

- 운영DB write: 0.
- VM Cloud schema migration: 0.
- external platform send/upload: 0.
- GTM publish: 0.
- Imweb footer/header change: 0.
