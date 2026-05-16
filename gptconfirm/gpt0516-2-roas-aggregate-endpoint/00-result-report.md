harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
  required_context_docs:
    - data/!data_inventory.md
    - gdn/attribution-data-source-decision-guide-20260511.md
  lane: Green local code patch + Yellow deploy approval required before VM Cloud apply
  allowed_actions:
    - local backend aggregate endpoint patch
    - typecheck
    - documentation
  forbidden_actions:
    - VM Cloud deploy/restart without explicit approval
    - Meta/Google/GA4/TikTok/Naver send/upload
    - 운영DB write/import
    - GTM publish
    - raw identifier output
  source_window_freshness_confidence:
    source: local code contract only
    window: today/yesterday/last_7d batch request
    freshness: implementation-time
    confidence: B

# ROAS aggregate endpoint 보강 결과

## 이번에 가능해진 것

프론트가 `today`, `yesterday`, `last_7d` ROAS를 각각 따로 요청하지 않고 `/api/ads/roas-summary` 한 번으로 가져올 수 있게 백엔드 contract를 만들었다.

이 endpoint는 raw ledger item을 응답으로 내보내지 않는다. 내부에서 ledger는 한 번만 읽고, 화면에는 기간별 요약값만 반환한다.

## 적용한 코드

- `backend/src/routes/ads.ts`
  - `GET /api/ads/roas-summary` 신규 추가
  - `account_id`와 `presets=today,yesterday,last_7d`를 받아 기간별 결과를 `results[preset]`로 반환
  - 여러 기간의 union range로 ledger를 1회만 load
  - Meta Ads Insights는 기간별 spend가 필요하므로 preset별 조회 유지
  - `metric_contract`에 source/unit/window/site/account/caveat 명시

## 왜 필요한가

기존 프론트는 `/api/ads/roas-summary`가 없으면 `/api/ads/roas`를 3번 호출한다. 그 결과 같은 ledger를 여러 번 읽고, VM Cloud backend hammer가 커질 수 있다.

이번 patch는 Option B precompute와 충돌하지 않는다. Option B는 funnel-health 캐시이고, 이번 patch는 ROAS 화면의 batch aggregate contract다.

## VM Cloud 배포 결과

2026-05-16 KST에 VM Cloud backend `backend/src/routes/ads.ts` 한 파일만 배포했다.

- pre-snapshot: `/api/ads/roas-summary` 404
- backup: `/home/biocomkr_sns/seo/repo/backend/_roas-summary-deploy-backup-20260516-gpt0516-2/ads.ts.before`
- remote typecheck: PASS
- remote build: PASS
- `seo-backend` restart: PASS, pid `766366`, restart count `4154`
- post-snapshot: `/api/ads/roas-summary` 200
- Option B `funnel-health` cache: 계속 200, `source=in_memory_precompute`

post-snapshot 핵심:

```json
{
  "ok": true,
  "ledger_source": "operational_vm",
  "row_count": 2856,
  "order_count": 579,
  "batch": {
    "mode": "aggregate_summary",
    "ledger_fetch_count": 1,
    "meta_insights_fetch_count": 3,
    "raw_ledger_items_returned": 0
  }
}
```

응답 시간은 약 12.9초였다. 이는 기존 3회 ROAS 호출을 1회 aggregate 호출로 줄인 효과는 있지만, 아직 ROAS 자체를 precompute/cache 하지 않았기 때문이다. ROAS 카드까지 500ms 이하로 만들려면 다음 단계에서 Meta spend/ROAS summary precompute가 필요하다.

## 하지 않은 것

- 추가 VM Cloud 파일 배포는 하지 않았다. 이번 배포 범위는 `backend/src/routes/ads.ts` 한 파일이다.
- Meta CAPI send/backfill은 하지 않았다.
- 운영DB write/import는 하지 않았다.
- 프론트 코드는 변경하지 않았다. 프론트는 이미 `roas-summary`를 먼저 호출하도록 되어 있었다.

## 검증 결과

- local `backend npm run typecheck`: PASS
- VM Cloud `npm run typecheck`: PASS
- VM Cloud `npm run build`: PASS
- live `/api/ads/roas-summary`: PASS
- live `/api/attribution/funnel-health?site=biocom&window=7d`: PASS, cache hit 269ms

## 배포 후 기대값

- 프론트 `/ai-crm/conversion-funnel`의 ROAS 카드가 `/api/ads/roas-summary`를 사용한다.
- today/yesterday/last_7d 조회에서 ledger fetch가 3회에서 1회로 줄어든다.
- 응답에는 `batch.ledger_fetch_count=1`, `batch.raw_ledger_items_returned=0`, `metric_contract`가 포함된다.

## 남은 리스크

- Meta Ads Insights는 기간별 spend를 맞추기 위해 preset별 호출이 필요하다. 이 부분은 Meta API rate limit이 심하면 별도 캐시가 필요하다.
- ledger 내부 load는 여전히 raw ledger를 읽는다. 다만 프론트가 여러 번 직접 읽는 것을 줄이는 것이 이번 patch의 목적이다.
- ROAS spend 쪽은 여전히 Meta API 실시간 호출이다. hammer 방지는 되었지만, ROAS 카드 속도 개선은 별도 precompute가 필요하다.

## 확인하면 좋은 문서

1. `01-contract.md` — Claude Code 프론트/백엔드가 맞춰야 하는 응답 구조.
2. `02-deploy-check.md` — VM Cloud 배포 전후 확인 명령.

## 다음 할 일

### Codex가 할 일

1. ROAS summary precompute/cache를 별도 sprint로 설계한다.
   - 왜: 이번 endpoint는 3회 호출을 1회로 줄였지만 Meta API 실시간 조회 때문에 응답이 12초대다.
   - 어떻게: `account_id × presets` 결과를 5분 단위로 precompute하고 `/api/ads/roas-summary`가 cache를 먼저 반환하게 한다.
   - 성공 기준: `/api/ads/roas-summary` cache hit 500ms 이하, `batch.source=in_memory_precompute` 또는 동등 cache meta 표시.
   - 실패 시: 현재 live endpoint는 그대로 유지하고 fallback 없이 실시간 1회 aggregate만 사용한다.
   - 의존성: 없음. Green 설계 후 Yellow 배포 가능.
   - 승인 필요 여부: 설계는 Green, VM Cloud 배포는 Yellow.
   - 추천 점수/자신감: 88%.

### TJ님이 할 일

1. `https://biocom.ainativeos.net/ai-crm/conversion-funnel`을 새로고침해서 ROAS 카드가 fallback 없이 뜨는지 확인한다.
   - 왜: live backend는 200이지만 브라우저에서 프론트가 기존 fallback 3회 호출을 안 하는지 확인해야 한다.
   - 어떻게: DevTools Network에서 `roas-summary`가 200인지 보고, `/api/ads/roas?date_preset=today/yesterday/last_7d` 3회 fallback이 없어야 한다.
   - 성공 기준: `roas-summary` 1회 호출, ROAS 카드 표시, funnel-health 녹색 cache 배너 유지.
   - 실패 시: 콘솔/Network 에러를 캡처하면 Codex가 contract mismatch를 바로 수정한다.
   - Codex가 대신 못 하는 이유: 현재 브라우저 세션과 로그인/Cloudflare 상태는 TJ님 화면 기준 확인이 가장 빠르다.
   - 추천 점수/자신감: 90%.
