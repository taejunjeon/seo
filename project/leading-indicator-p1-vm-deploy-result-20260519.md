# Leading Indicator P1 VM Cloud Deploy Result

작성 시각: 2026-05-19 01:03 KST
대상: 구매 전 선행지표 분석 에이전트 P1 live aggregate endpoint
결과: PASS_WITH_NOTES

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - CLAUDE.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - project/leading-indicator-p1-live-endpoint-vm-approval-20260518.md
    - project/leading-indicator-aggregate-endpoint-design-20260518.md
  lane: Yellow
  allowed_actions:
    - VM Cloud backend target file backup
    - deploy backend/src/leadingIndicators.ts
    - deploy backend/src/routes/attribution.ts
    - deploy backend/src/bootstrap/startBackgroundJobs.ts
    - backend typecheck/build
    - seo-backend restart
    - read-only API smoke/post-check
  forbidden_actions:
    - Meta CAPI send/backfill
    - GA4 Measurement Protocol send
    - Google Ads/TikTok/Naver/Meta mutate
    - GTM submit/create_version/publish
    - Imweb header/footer save
    - operating DB write/import
    - VM Cloud schema migration/source ledger write
    - raw identifier output
  source_window_freshness_confidence:
    source: VM Cloud SQLite attribution_ledger aggregate
    window: leading-indicators API 7d smoke
    freshness: 2026-05-19 00:57 KST post-check
    confidence: high for deploy, medium for behavioral interpretation
```

## 무엇이 가능해졌나

VM Cloud backend에 `GET /api/attribution/leading-indicators`가 배포됐다.

이제 프론트엔드는 정적 dry-run JSON 대신 VM Cloud live aggregate endpoint를 읽을 수 있다. 응답은 raw 주문/결제/회원/click/session id 없이 집계값만 내려준다.

## 배포 범위

반영한 파일은 3개다.

- `backend/src/leadingIndicators.ts`
- `backend/src/routes/attribution.ts`
- `backend/src/bootstrap/startBackgroundJobs.ts`

백업 경로:

```text
/home/biocomkr_sns/seo/repo/backend/_leading-indicators-p1-backup-20260519-005251
```

## 검증 결과

### VM Cloud build

```text
npm run typecheck PASS
npm run build PASS
```

### Backend restart

```text
seo-backend online
restart count: 4268
health: /health 200
```

### Local VM Cloud API smoke

아래 3개 요청이 200으로 응답했다.

```text
/api/attribution/leading-indicators?site=biocom&window=7d&channel=meta&dimension=buyer_vs_leaver
/api/attribution/leading-indicators?site=thecleancoffee&window=7d&channel=meta&dimension=buyer_vs_leaver
/api/attribution/leading-indicators?site=thecleancoffee&window=7d&channel=all&dimension=channel
```

공통 확인:

```text
schema_version=leading-indicators-v1
cohort.confirmed_buyer_sessions present
cohort.checkout_non_buyer_sessions present
cohort.ga4_purchase_conflict_sessions present
cohort.pending_payment_success_sessions present
comparison.pending_payment_success present
safety.raw_identifier_output=false
safety.external_platform_send=0
safety.operating_db_write=0
safety.vm_cloud_write=0
safety.gtm_publish=0
safety.aggregate_only=true
raw identifier key scan hit 0
```

### Public API smoke

`https://att.ainativeos.net` 기준으로도 200 응답을 확인했다.

```text
biocom meta 7d: 200, elapsed 2775ms
thecleancoffee meta 7d: 200, elapsed 1806ms
```

## 남은 주의점

현재 `LEADING_INDICATORS_PRECOMPUTE_ENABLED`가 켜져 있지 않다.

따라서 응답 source는 `live_cache_miss`이고, cache hit 기준 500ms 목표는 아직 달성 상태가 아니다. 다만 live fallback 기준은 10초 이하이며, 이번 post-check에서는 1.8~2.8초로 통과했다.

precompute worker를 상시 켜려면 별도 env flag ON 판단이 필요하다. 현재 배포는 endpoint와 worker registration까지이며, 외부 전송이나 DB write는 발생하지 않았다.

## Auditor Verdict

PASS_WITH_NOTES

이유:

- 승인된 backend 파일 3개만 배포했다.
- build/typecheck와 API smoke가 통과했다.
- 4 cohort contract가 live API에 반영됐다.
- raw identifier output, 외부 전송, 운영DB write, GTM publish는 0이다.
- 단, precompute cache는 아직 OFF라 frontend fetch 전환 전에 cache ON 여부를 별도 판단해야 한다.
