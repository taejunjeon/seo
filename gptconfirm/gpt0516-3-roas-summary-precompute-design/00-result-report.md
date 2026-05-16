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
  lane: Green design only; Yellow required for VM Cloud deploy
  allowed_actions:
    - local code/document read
    - architecture design
    - deploy approval packet draft
    - documentation validation
  forbidden_actions:
    - VM Cloud deploy/restart
    - Meta/Google/GA4/TikTok/Naver send/upload
    - 운영DB write/import
    - GTM publish
    - raw identifier output
  source_window_freshness_confidence:
    source: local code + live smoke observations from gpt0516-2
    window: today/yesterday/last_7d ROAS summary
    freshness: 2026-05-16 KST
    confidence: B

# ROAS summary precompute/cache 설계 결과

작성 시각: 2026-05-16 14:25 KST

## 10초 요약

현재 `/api/ads/roas-summary`는 프론트 요청을 3번에서 1번으로 줄였지만, Meta 광고비 API를 실시간으로 조회하기 때문에 응답이 약 12.9초다.

다음 개선은 ROAS summary도 Option B처럼 5분마다 미리 계산해 두고, 화면 요청은 캐시만 읽게 만드는 것이다. 성공하면 ROAS 카드도 `funnel-health`처럼 500ms 이하로 내려갈 수 있다.

## 성공 기준

- `/api/ads/roas-summary?account_id=...&presets=today,yesterday,last_7d` cache hit 응답 500ms 이하.
- 응답에 `cache.cached=true`, `cache.source=in_memory_precompute`, `cache.cached_at_kst`, `cache.next_refresh_at_kst` 표시.
- live force refresh는 5분 cooldown을 지키고, 동시에 여러 번 실행되지 않는다.
- raw ledger item, raw order/payment/member/click id 응답 0.
- Meta/Google/GA4/TikTok/Naver 전송 0.
- 운영DB write/import 0.
- 기존 `/api/ads/roas` 단건 endpoint regression 0.

## 설계 결론

Phase 1은 큰 리팩토링 없이 진행하는 것이 맞다.

`ads.ts`의 현재 `roas-summary` 계산 결과를 cache Map에 저장하고, `startBackgroundJobs.ts`가 자기 자신에게 로컬 HTTP로 주기 호출해 캐시를 채우는 구조가 가장 빠르고 안전하다.

이 방식은 `funnelHealthPrecompute.ts`처럼 별도 data loader를 깔끔하게 분리하는 것보다 덜 정교하지만, 지금은 incident 이후 안정화가 우선이다. ROAS helper가 `ads.ts` 내부 함수에 많이 묶여 있어 무리하게 서비스 모듈로 분리하면 리팩토링 범위가 커진다.

## 권장 구현 방식

1. `backend/src/routes/ads.ts`
   - module-level `roasSummaryCache` Map 추가.
   - cache key는 `account_id + normalized presets + ledger_source` 조합.
   - `force=true`가 없고 cache hit이면 즉시 반환.
   - cache miss면 현재 live 계산을 수행하고, 성공 시 cache 저장.
   - `force=true`는 live 계산하되 per-key 5분 cooldown 적용.
   - live 계산 실패 시 최근 stale cache가 있으면 stale warning과 함께 반환.

2. `backend/src/bootstrap/startBackgroundJobs.ts`
   - `ROAS_SUMMARY_PRECOMPUTE_ENABLED !== "0"`이면 worker 실행.
   - 5분마다 내부 URL 호출:
     - `http://127.0.0.1:${PORT}/api/ads/roas-summary?account_id=<id>&presets=today,yesterday,last_7d&force=true&cache_write=1&precompute=1`
   - 초기 시작은 backend restart 후 90초 지연.
   - 동시에 실행 중이면 skip.

3. target
   - Phase 1: biocom, thecleancoffee.
   - Phase 1.1: aibio 추가.
   - all_sites는 ROAS account 기준이 아니라 funnel aggregate 성격이므로 이번에는 제외.

4. stale fallback
   - cache fresh 기준: 10분 이하.
   - stale 허용 기준: 30분 이하.
   - Meta API 장애나 rate limit이면 30분 이하 stale cache를 반환하고 `cache.stale=true` 표시.

## 왜 이 방식인가

- 현재 live 병목은 raw ledger item 반환이 아니라 Meta Ads Insights 실시간 조회다.
- 이미 `/api/ads/roas-summary`가 raw item을 반환하지 않는 aggregate contract를 제공한다.
- 프론트가 이미 batch endpoint를 먼저 호출한다.
- 따라서 endpoint를 새로 늘리는 것보다 기존 endpoint에 cache layer를 붙이는 것이 가장 작은 변경이다.

## 하지 않은 것

- 코드 구현은 하지 않았다.
- VM Cloud 배포/restart는 하지 않았다.
- Meta API write/send는 하지 않았다.
- 운영DB write/import는 하지 않았다.
- 프론트 수정은 하지 않았다.

## 다음 단계

다음 작업은 Green local implementation 후 Yellow deploy approval이다.

구현 파일 후보:

- `backend/src/routes/ads.ts`
- `backend/src/bootstrap/startBackgroundJobs.ts`
- 필요 시 `backend/src/roasSummaryPrecompute.ts`

검증 명령:

```bash
cd backend
npm run typecheck
npm run build
curl 'http://localhost:7020/api/ads/roas-summary?account_id=act_3138805896402376&presets=today,yesterday,last_7d'
```

## 확인하면 좋은 문서

1. `01-architecture.md` — 실제 구현 구조.
2. `02-api-contract.md` — 프론트가 읽을 cache 필드.
3. `03-yellow-deploy-packet.md` — VM Cloud 배포 승인안.
