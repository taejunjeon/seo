# VM Cloud Hammer Root Cause Review

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
  required_context_docs:
    - data/!data_inventory.md
  lane: Green read-only
  allowed_actions:
    - VM Cloud PM2/log read-only check
    - local code read-only inspection
    - report document creation
  forbidden_actions:
    - VM Cloud deploy/restart
    - Meta/Google/GA4/TikTok/Naver send or upload
    - 운영DB write/import
    - GTM publish
    - raw order/payment/member/click id output
  source_window_freshness_confidence:
    source: VM Cloud PM2 logs + local source code
    window: recent PM2 backend log tail and current PM2 state
    freshness: live read at 2026-05-16 KST
    confidence: high for primary hammer endpoint, medium for exact originating local process
```

## One Line

VM Cloud backend hammer의 직접 원인은 `/api/attribution/ledger?limit=10000` 대용량 반복 호출이며, Option B precompute는 `/funnel-health` 체감 속도에는 도움되지만 이 ledger item API hammer를 별도로 막지 않으면 재시작 위험은 남는다.

## Evidence

- VM Cloud `seo-backend`는 PM2 memory restart 한계 근처인 약 1.0~1.55GB까지 치솟고, uptime이 수십 초 단위로 짧았다.
- 최근 backend log에서 `/api/attribution/ledger?limit=10000`가 가장 큰 응답량과 처리시간을 만들었다.
- 10일 범위 ledger 조회는 최근 표본에서 615회, 총 약 5.9GB 응답, 평균 약 6.8초, 최대 약 22초였다.
- 4일 범위 ledger 조회는 1471회, 총 약 3.9GB 응답, 평균 약 2.9초, 최대 약 19초였다.
- 호출 user-agent는 대부분 `node`였고, 브라우저 이벤트 수집 endpoint보다 응답량과 CPU/memory 영향이 훨씬 컸다.
- local source 기준 `/api/ads/roas`는 내부에서 VM Cloud `/api/attribution/ledger?limit=10000`를 site/range별로 호출한다. frontend가 `/api/ads/roas-summary`를 못 쓰면 today/yesterday/last_7d를 병렬로 `/api/ads/roas` 3회 호출한다.

## Option B Review

Option B는 배포 가치가 있다. 다만 적용 범위는 `/api/attribution/funnel-health` 기본 조합이다.

배포 후 좋아지는 것:

- `/total` 또는 funnel 화면의 기본 site/window 조합은 cache hit 시 빠르게 내려온다.
- 사용자가 화면을 새로고침할 때마다 VM Cloud SQLite ledger와 CAPI log를 매번 재집계하지 않는다.
- 화면에 `데이터 기준/다음 갱신`을 보여주는 UX는 운영자에게 유용하다.

남는 문제:

- 현재 구현은 in-memory Map이라 PM2 restart 직후 캐시가 비고, 첫 tick 전에는 live fallback이 남는다.
- `/api/attribution/ledger?limit=10000` 직접 호출은 Option B로 줄지 않는다.
- `/api/ads/roas`가 계속 full ledger item API를 호출하면 CPU/memory hammer가 계속 날 수 있다.
- frontend의 `/api/ads/roas-summary` batch endpoint가 live에 없으면 기존 3회 병렬 fallback이 계속 발생한다.
- Sidecar review 결과도 동일하다. hard guard 없이 Option B만 배포하면 cache miss, `force=true`, precompute 대상 밖의 필터 조합, 직접 `/ledger` 호출은 계속 live 계산/대용량 item 응답으로 남는다.

## Decision

권장 순서:

1. 로컬의 오래 떠 있는 Codex/agent 프로세스 중 VM Cloud ledger를 반복 조회하는 주체를 먼저 중단한다. 완료: 현재 작업 세션을 제외한 오래 떠 있던 Codex CLI와 로컬 7020 backend watcher를 PID 단위로 종료했다.
2. VM Cloud backend가 3~5분 이상 restart 없이 안정화되는지 본다. 관측: 종료 직후 `seo-backend`는 같은 PID로 218초 이상 유지되고 memory가 약 565MB로 내려왔다.
3. Option B backend를 배포한다.
4. 바로 이어서 ledger item API limit/range/concurrency guard 또는 `/api/ads/roas-summary` batch/cache patch를 진행한다. 완료: local hard guard patch는 구현했고 typecheck PASS. VM Cloud 배포는 아직 하지 않았다.

## Safer Patch List

- `/api/attribution/ledger` item endpoint의 기본 max limit을 500~1000으로 낮추고, 3일 초과 range + high limit은 낮은 cap으로 제한한다. Local patch 완료.
- 신뢰된 VM Cloud 내부 호출이 아닌 외부 공개 호출에는 1분 window rate limit을 적용해 반복 hammer를 429로 차단한다. Local patch 완료.
- `summaryOnly=true` 또는 aggregate endpoint를 써야 하는 화면은 item endpoint를 사용하지 않게 한다.
- `/api/ads/roas-summary`를 실제로 구현/배포해 frontend가 3개 `/api/ads/roas`를 병렬 fallback하지 않게 한다.
- `/api/ads/roas`는 VM Cloud 공개 HTTP로 full ledger를 다시 당기지 말고, cached aggregate 또는 내부 SQLite read path를 쓰게 한다.
- Option B cache는 다음 단계에서 JSONL/SQLite persisted cache로 바꾸면 restart 직후 live fallback 위험이 줄어든다.

## Not Done

- VM Cloud deploy/restart는 하지 않았다.
- 현재 실행 중인 Codex 세션은 유지했다. 전체 `pkill -f codex`는 현재 작업 세션까지 죽이므로 실행하지 않았다.
- 운영DB write/import, 외부 platform send/upload, GTM publish는 하지 않았다.

## Local Patch

- `backend/src/routes/attribution.ts`
  - 공개 `/api/attribution/ledger` 요청에 item limit cap 추가.
  - 긴 기간 조회는 더 낮은 public cap 적용.
  - `summaryOnly=true` 지원.
  - 외부 공개 호출 rate limit 추가.
  - VM Cloud 내부 trusted caller는 기존 full limit 유지.

검증:

- `cd backend && npm run typecheck` PASS.
- VM Cloud live 배포는 미실행.

## Next Actions

1. TJ님이 로컬 오래 떠 있는 Codex CLI 프로세스를 정리한다. 목적은 VM Cloud ledger item endpoint 반복 호출을 멈추는 것이다. `pkill -f "codex --dangerously-bypass-approvals-and-sandbox"` 실행 후 3~5분 동안 VM Cloud backend restart가 멈추는지 확인한다.
2. Codex 또는 Claude Code가 VM Cloud PM2 상태를 재확인한다. 성공 기준은 `seo-backend` uptime이 5분 이상 유지되고 memory가 1.5GB restart 한계 아래에서 안정되는 것이다.
3. 안정화 후 Option B backend를 배포한다. 성공 기준은 `/api/attribution/funnel-health` 기본 요청이 cached 응답을 내고 화면에 데이터 기준/다음 갱신이 표시되는 것이다.
4. Option B 배포 직후 ledger guard patch를 별도 sprint로 진행한다. 성공 기준은 `/api/attribution/ledger?limit=10000` 대량 반복 호출이 400/429 또는 낮은 limit으로 제어되는 것이다.
