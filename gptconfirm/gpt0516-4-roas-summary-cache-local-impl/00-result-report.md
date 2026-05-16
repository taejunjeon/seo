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
  lane: Green local implementation; Yellow required for VM Cloud deploy/restart
  allowed_actions:
    - local code patch
    - backend typecheck/build
    - deploy approval packet draft
    - documentation validation
  forbidden_actions:
    - VM Cloud deploy/restart without approval
    - Meta/Google/GA4/TikTok/Naver send/upload
    - 운영DB write/import
    - GTM publish
    - raw identifier output
  source_window_freshness_confidence:
    source: local backend code + gpt0516-2 live ROAS summary smoke + gpt0516-3 design
    window: today/yesterday/last_7d ROAS summary
    freshness: 2026-05-16 KST
    confidence: A-

# ROAS summary cache local implementation result

작성 시각: 2026-05-16 KST

## 한 줄 결론

ROAS 카드가 매번 Meta Ads API를 실시간으로 3번 조회하지 않도록, `/api/ads/roas-summary`에 in-memory cache와 5분 주기 precompute worker를 구현하고 VM Cloud backend에 배포했다.

## 완료한 것

- `backend/src/routes/ads.ts`
  - `roasSummaryCache` in-memory Map 추가.
  - cache key: `account_id + normalized presets + ledger_source`.
  - cache hit이면 raw ledger 없이 summary만 즉시 반환.
  - live 계산 성공 시 cache write.
  - `force=true`는 5분 cooldown과 refresh-in-flight guard 적용.
  - live refresh 실패 시 30분 이하 stale cache fallback.
  - 응답에 `cache.cached_at_kst`, `cache.next_refresh_at_kst`, `cache.source`, `cache.stale`, `force_cooldown_remaining_ms` 포함.
  - 같은 파일에 남아 있던 예전 수동 테스트 주문 키는 raw 문자열 대신 hash 비교로 정리.

- `backend/src/bootstrap/startBackgroundJobs.ts`
  - ROAS summary precompute worker 추가.
  - 기본 5분마다 biocom/더클린커피 Meta account의 `today,yesterday,last_7d` summary를 자기 backend에 self-call.
  - backend restart 후 기본 90초 지연 시작.
  - 이전 tick이 아직 돌면 skip.
  - `ROAS_SUMMARY_PRECOMPUTE_ENABLED=0`으로 비활성 가능.

## 하지 않은 것

- Meta CAPI Purchase send/backfill은 하지 않았다.
- Google/GA4/TikTok/Naver send/upload는 하지 않았다.
- 운영DB write/import는 하지 않았다.
- GTM publish, Imweb header/footer 변경은 하지 않았다.
- 프론트 코드는 수정하지 않았다. 기존 프론트는 이미 `/api/ads/roas-summary`를 우선 호출한다.

## 검증 결과

- `cd backend && npm run typecheck`: PASS.
- `cd backend && npm run build`: PASS.
- VM Cloud backend `npm run typecheck`: PASS.
- VM Cloud backend `npm run build`: PASS.
- VM Cloud `seo-backend` restart: PASS.
- ROAS summary live force refresh: 200, 11.15초, cache write PASS.
- ROAS summary cache hit: VM Cloud localhost 3~11ms, public route biocom 0.27초/0.26초 with one 3.92초 network outlier.
- thecleancoffee ROAS summary cache hit: 0.24초/0.29초 with one 3.94초 network outlier.
- 기존 funnel-health cache regression: 200, 0.34초 public route.
- ROAS summary precompute worker: `ok=2 failed=0`.
- JSON parse: PASS.
- validate wiki links: PASS.
- harness preflight strict: PASS.
- `git diff --check`: PASS.
- raw identifier pattern scan: PASS.
- 배포 승인안 작성: PASS.
- raw ledger item을 반환하는 코드 추가 없음.

## 현재 영향

VM Cloud live에 ROAS summary cache가 반영됐다.

1. precompute worker가 5분마다 summary cache를 갱신한다.
2. 프론트 ROAS 카드는 cache hit로 응답받는다.
3. Meta Ads API 실시간 호출은 worker/force refresh로 제한된다.

## 남은 리스크

- VM Cloud에서 Meta Ads API rate limit이 이미 걸려 있으면 첫 cache fill은 실패할 수 있다. 이 경우 기존 stale cache가 없을 때는 live error가 그대로 나온다.
- `ROAS_SUMMARY_PRECOMPUTE_TARGETS`에 잘못된 account가 들어가면 해당 account tick만 실패한다.
- in-memory cache라 `seo-backend` restart 시 캐시가 사라진다. 첫 tick 전에는 live 계산이 필요하다.
- public route에서 간헐적으로 3~4초 지연이 관측됐다. VM Cloud localhost cache hit는 3~11ms라 backend cache 자체 문제보다는 Cloudflare/network hop 가능성이 높다.

## 확인하면 좋은 문서

1. `03-vm-deploy-result.md` — 실제 VM Cloud 배포와 post-snapshot 결과.
2. `01-implementation.md` — 이번에 실제로 코드에 들어간 cache 동작.
3. `02-yellow-deploy-packet.md` — rollback command.

## 다음 할 일

다음은 프론트 화면에서 ROAS 카드가 cache source를 표시하는지 확인하고, public route 3~4초 outlier가 반복되는지 모니터링하는 것이다.
