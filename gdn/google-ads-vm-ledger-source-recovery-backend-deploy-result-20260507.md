# Google Ads ROAS 운영 VM 원장 조회 복구 backend 배포 결과

작성 시각: 2026-05-07 18:47 KST
대상: `att.ainativeos.net` backend `seo-backend`
승인 근거: [[google-ads-vm-ledger-source-recovery-backend-deploy-approval-20260507]]
상태: source deploy 완료 / runtime Google Ads API 검증은 VM developer token 미설정으로 blocked
Do not use for: Google Ads conversion upload, Google Ads mutate, GTM publish, 운영 DB/ledger write, paid_click_intent ledger write

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - vm/!vm.md
    - total/!total-current.md
    - gdn/!gdnplan.md
    - gdn/google-ads-vm-ledger-source-recovery-backend-deploy-approval-20260507.md
  lane: Yellow approved execution
  allowed_actions_executed:
    - backup current VM backend source
    - deploy backend/src/routes/googleAds.ts only
    - run VM typecheck/build
    - restart existing seo-backend PM2 process
    - run health/status/dashboard read-only smoke
    - inspect PM2/access logs read-only
  forbidden_actions_kept:
    - Google Ads conversion upload
    - Google Ads API mutate
    - Google Ads conversion action create/update
    - GA4/Meta/TikTok/Naver/Google Ads platform send
    - GTM Production publish
    - production DB write/import
    - TJ Attribution VM ledger write
    - paid_click_intent ledger write
    - env/secret change
    - ad budget or campaign setting change
  source_window_freshness_confidence:
    google_ads_api:
      source: "VM /api/google-ads/status and /dashboard"
      window: "last_30d requested"
      freshness: "2026-05-07 18:43~18:44 KST smoke"
      confidence: 0.76
    internal_ledger:
      source: "TJ 관리 Attribution VM access/API path"
      window: "same-window source recovery code deployed, runtime blocked before Google Ads query"
      freshness: "source hash deployed 2026-05-07 18:42 KST"
      confidence: 0.82
```

## 10초 결론

운영 VM에 `backend/src/routes/googleAds.ts` 1파일 배포, typecheck, build, PM2 restart는 완료했다.

하지만 운영 API에서 Google Ads ROAS 대시보드는 아직 정상 동작하지 않는다. 원인은 코드가 아니라 VM에 `GOOGLE_ADS_DEVELOPER_TOKEN` 또는 fallback `API_TOKEN_BIOCOM`이 없는 것이다.

Rollback은 실행하지 않았다. 이유는 이 500이 배포 전에도 동일하게 발생했고, rollback해도 Google Ads API는 계속 500이기 때문이다. 대신 배포 전 백업 경로를 남겨 즉시 복구 가능하게 했다.

## 배포 결과

| 항목 | 결과 |
|---|---|
| 백업 경로 | `/home/biocomkr_sns/seo/shared/deploy-backups/20260507-184033_google_ads_vm_ledger_source_recovery` |
| 배포 파일 | `backend/src/routes/googleAds.ts` |
| source hash | `d2ad7fd3a4b590073f0bdb124eda440248233f3773248c149e0ca5fd142aa3ee` |
| 원격 typecheck | PASS |
| 원격 build | PASS |
| PM2 restart | 실행 완료. `seo-backend` online |

## Smoke 결과

| 검증 | 결과 | 해석 |
|---|---|---|
| `GET https://att.ainativeos.net/health` | 200 ok | backend HTTP는 살아 있음 |
| `GET /api/google-ads/status` | 500 | `Google Ads developer token is not configured` |
| `GET /api/google-ads/dashboard?date_preset=last_30d` | 500 | 같은 credential blocker |
| VM `.env` key scan | `GOOGLE_ADS_*`, `API_TOKEN_BIOCOM` 없음 | 값은 읽지 않았고 key 존재 여부만 확인 |
| VM process env key scan | `GOOGLE_ADS_*`, `API_TOKEN_BIOCOM` 없음 | PM2 process에도 없음 |

## paid_click_intent 24h 전 확인 가능 범위

24h가 안 되어도 확인 가능한 것은 있다.

- receiver가 live traffic을 받고 있는지.
- no-write/no-send guard가 유지되는지.
- TEST click id가 live 후보로 풀리지 않는지.
- 외부 전송이나 DB write가 없는지.

이번 확인 결과:

| 항목 | 값 |
|---|---:|
| publish 이후 `paid_click_intent/no-send` access log lines | 1,582 |
| 전체 POST | 868 |
| POST 200 | 819 |
| POST 400 | 39 |
| POST 413 | 8 |
| origin | `https://biocom.kr` |
| TEST smoke | `would_store=false`, `would_send=false`, `no_write_verified=true`, `no_platform_send_verified=true` |

하지만 아직 확인할 수 없는 것도 있다.

- `paid_click_intent`가 실제 주문 원장 fill-rate를 얼마나 개선했는지.
- NPay 실제 결제완료 주문이 Google click id와 얼마나 더 잘 연결되는지.
- confirmed_purchase no-send 후보의 `missing_google_click_id`가 실제로 감소했는지.

이 세 가지는 현재 no-write receiver 단계라 원장 row가 남지 않는다. 24h/72h 모니터링과 minimal ledger write 승인 이후에 판단해야 한다.

## 운영 안정성 메모

`seo-backend`는 배포 전부터 PM2 `max_memory_restart=700M`을 넘어서 30~90초 간격으로 재시작되고 있었다.

PM2 log 근거:

```text
[PM2][WORKER] Process 0 restarted because it exceeds --max-memory-restart value
current_memory=930508800~1407709184
max_memory_limit=734003200
```

이 현상은 이번 Google Ads route patch와 별개로 보인다. 배포 전 `2026-05-07 09:31 UTC`부터 반복됐고, 배포 후에도 이어졌다.

## Auditor verdict

Auditor verdict: PASS_WITH_NOTES

No-send verified: YES
No-write verified: YES
No-publish verified: YES
No-platform-send verified: YES
No-deploy verified: NO, TJ님 승인 범위 안에서 backend deploy 실행

What changed:
- VM `backend/src/routes/googleAds.ts` source and `dist/routes/googleAds.js` build artifact updated.

What did not change:
- 운영 DB와 Attribution VM ledger에는 write하지 않았다.
- Google Ads, GA4, Meta, TikTok, Naver에는 어떤 전환도 보내지 않았다.
- GTM은 건드리지 않았다.
- env/secret은 바꾸지 않았다.

Next:
- Google Ads read-only credential을 VM에 넣을지 별도 승인 판단.
- PM2 memory restart 원인 분해.
- 24h paid_click_intent monitoring 정시 실행.
