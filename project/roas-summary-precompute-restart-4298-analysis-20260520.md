작성 시각: 2026-05-21 00:03 KST
기준일: 2026-05-20
문서 성격: ROAS summary precompute 재시작 원인분석

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read: n/a
  required_context_docs:
    - AGENTS.md
    - CLAUDE.md
    - docs/agent-harness/growth-data-harness-v0.md
  lane: Yellow
  allowed_actions:
    - VM Cloud read-only log inspection
    - approved backend/frontend deploy
    - post-deploy smoke
    - heartbeat automation 기준선 갱신
  forbidden_actions:
    - ROAS_SUMMARY_PRECOMPUTE_ENABLED=0 자동 전환
    - Google Ads conversion upload
    - 운영DB write
    - GTM Production publish
  source_window_freshness_confidence:
    source: VM Cloud pm2/auth/kernel logs + public API smoke
    window: 2026-05-20 22:47~2026-05-21 00:03 KST
    freshness: 2026-05-21 00:03 KST
    confidence: 0.96
```

## 10초 요약

ROAS summary precompute restart count 4298 증가는 precompute 장애가 아니었다.
2026-05-20 22:56 KST에 승인된 backend 배포가 `pm2 restart seo-backend --update-env`를 실행하면서 생긴 정상 재시작이었다.
따라서 precompute는 OFF하지 않고 계속 ON으로 유지하는 것이 맞다.

## 확인한 결론

- 4298: 승인된 backend 배포 재시작이다. `metaCapi.ts` 배포와 backend build 직후 `pm2 restart seo-backend --update-env`가 실행됐다.
- OOM이나 crash 근거는 없었다. kernel log에서 같은 시간대 OOM kill 징후를 찾지 못했다.
- 4299: stale monitor가 4298을 실패로 오해해 precompute를 OFF하며 만든 재시작이다.
- 4300: TJ님 지시에 따라 precompute를 다시 ON으로 복구한 재시작이다.
- 4301~4302: Google `gad_campaignid` 보강 배포와 문구 보정 배포에 따른 정상 재시작이다.

## 왜 문제가 되었나

기존 heartbeat monitor 문구가 `기준 restart count 4297 이후 추가 증가 = 실패`로 너무 단순했다.
그 사이 승인된 backend 배포가 있었는데, monitor가 배포 재시작과 장애 재시작을 구분하지 못했다.
그 결과 precompute 자체는 정상인데도 rollback 절차가 실행됐다.

## 조치

1. `ROAS_SUMMARY_PRECOMPUTE_ENABLED=1`로 즉시 복구했다.
2. 기준 restart count를 4302로 갱신했다.
3. heartbeat monitor 지침을 바꿨다. 앞으로 restart count 증가만으로 precompute를 자동 OFF하지 않고, 먼저 원인 분석과 영향 범위를 보고한다.
4. Google `gad_campaignid` 보강 배포도 precompute ON 상태를 유지한 채 진행했다.

## 검증 결과

- VM Cloud backend: online.
- 기준 restart count: 4302.
- backend memory: 약 326MB.
- ROAS summary API: 200, 약 0.27초.
- cache: `in_memory_precompute`, stale=false.
- precompute env: `ROAS_SUMMARY_PRECOMPUTE_ENABLED=1`.
- 최종 tick: 2026-05-21 00:02 KST, `ok=2 failed=0 next=14400s`.

## 남은 확인

남은 즉시 확인은 없다.
다음 확인은 4시간 주기 다음 tick 또는 24시간 monitor 종료 시점이다.
