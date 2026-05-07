# Google Ads ROAS 운영 VM 원장 조회 복구 backend 배포 승인안

작성 시각: 2026-05-07 18:23 KST
요청 유형: Yellow Lane backend 운영 deploy 승인 문서
대상: `att.ainativeos.net` backend `seo-backend`
기술명: Google Ads dashboard operational VM ledger source recovery
관련 문서: [[../total/!total-current]], [[../vm/!vm]], [[!gdnplan]], [[paid-click-intent-gtm-production-publish-result-20260506]], [[google-ads-vm-ledger-source-recovery-backend-deploy-result-20260507]]
Status: executed (승인 완료 / 2026-05-07 18:33 KST deploy 완료)
현재 상태: 승인 완료. backend/src/routes/googleAds.ts 1파일만 운영 VM에 반영, PM2 재시작, /health 200 확인. Google Ads developer token 미설정으로 dashboard 500은 별도 issue로 분리됨.
Do not use for: Google Ads conversion upload, Google Ads mutate, GTM publish, 운영 DB/ledger write, paid_click_intent ledger write, 광고 예산/캠페인 변경

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
    - gdn/paid-click-intent-gtm-production-publish-result-20260506.md
  lane: Yellow for execution / Green approval draft only
  allowed_actions_now:
    - approval document
    - local diff review
    - read-only smoke
    - no-send/no-write audit
  allowed_actions_after_approval:
    - backup current VM backend source
    - deploy backend Google Ads dashboard read-only source recovery patch
    - build/typecheck if required by existing backend deploy flow
    - restart existing seo-backend PM2 process
    - run post-deploy read-only health/status/dashboard smoke
    - rollback if Hard Fail occurs
  forbidden_actions_until_explicit_separate_approval:
    - Google Ads conversion upload
    - Google Ads API mutate
    - Google Ads conversion action create/update
    - GA4/Meta/TikTok/Naver/Google Ads platform send
    - GTM Production publish
    - production DB write/import
    - TJ Attribution VM ledger write
    - paid_click_intent ledger write
    - env/secret change
    - background dispatcher enable
    - ad budget or campaign setting change
  source_window_freshness_confidence:
    google_ads_api:
      source: "Google Ads API v22 customers/2149990943 via local /api/google-ads/dashboard"
      window: "2026-04-07~2026-05-06 KST"
      freshness: "2026-05-07 18:12 KST read-only 조회"
      confidence: 0.92
    internal_ledger:
      source: "TJ 관리 Attribution VM att.ainativeos.net SQLite /home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3#attribution_ledger"
      window: "2026-04-07~2026-05-06 KST"
      freshness: "latestWindowLoggedAt 2026-05-06T14:59:06.844Z"
      confidence: 0.90
```

## 10초 결론

이 승인은 Google Ads 대시보드가 내부 매출을 볼 때 **로컬 노트북의 오래된 원장 fallback**이 아니라 **운영 VM 원장 같은 기간 값**을 읽도록 backend 조회 코드를 운영에 반영할지 결정하는 문서다.

2026-05-07 18:12 KST 로컬 API 검증에서는 같은 window에서 Google Ads ROAS=광고 플랫폼이 주장하는 값 `8.72x`, 내부 confirmed ROAS=실제 결제완료 주문 원장 기준값 `0.28x`가 분리됐다.

운영 VM에 이 코드를 배포하면 TJ님과 팀이 `https://att.ainativeos.net/api/google-ads/dashboard?date_preset=last_30d`를 볼 때도 같은 기준으로 예산 판단용 내부 ROAS를 확인할 수 있다.

이 승인은 조회 복구만 허용한다. Google Ads에 실제 전환을 보내거나, paid_click_intent를 원장에 저장하거나, GTM을 게시하는 승인이 아니다.

## TJ님이 승인하면 실제로 바뀌는 것

TJ님이 승인하면 Codex가 운영 VM에서 아래 화면/API가 쓰는 backend 코드를 교체한다.

```text
https://att.ainativeos.net/api/google-ads/dashboard?date_preset=last_30d
```

바뀌는 설정 이름:

```text
Google Ads dashboard 내부 원장 조회 경로
local_attribution_ledger fallback 우선 -> operational_vm_ledger same-window 우선
```

바뀌면 생기는 효과:

- Google Ads ROAS=광고 플랫폼 주장값과 내부 confirmed ROAS=실제 결제완료 원장값이 같은 기간으로 분리된다.
- 운영 화면/API에서도 내부 원장 freshness가 `2026-05-06T14:59:06.844Z` 또는 그 이후 값으로 나온다.
- 예산 판단에서 플랫폼 `Conv. value` 오염값과 내부 confirmed 매출을 섞어 보지 않게 된다.

안 바꾸면 남는 문제:

- 운영 API가 다시 로컬 개발 DB fallback 또는 오래된 원장 기준을 보여줄 수 있다.
- last_30d 내부 ROAS가 실제 운영 VM 원장보다 낮거나 stale하게 보일 수 있다.
- `paid_click_intent -> minimal ledger write -> confirmed_purchase no-send` 순서 판단이 흐려진다.

## 지금 확인된 숫자

source: Google Ads API v22 `customers/2149990943` + TJ 관리 Attribution VM 원장
window: `2026-04-07~2026-05-06 KST`
freshness: Google Ads API `2026-05-07 18:12 KST`, 내부 원장 `latestWindowLoggedAt 2026-05-06T14:59:06.844Z`
site: `biocom`
confidence: `0.90`

| 항목 | 값 | 예산 판단에서 쓰임 |
|---|---:|---|
| Google Ads 광고비 | 25,016,556원 | 비용 기준 |
| Google Ads `Conv. value` | 218,196,428원 | 참고만 봄. 플랫폼 주장값 |
| Google Ads ROAS | 8.72x | 참고만 봄. 예산 판단 primary 금지 |
| Primary NPay label value | 218,196,382원 | 오염 근거 |
| 내부 confirmed revenue | 7,063,020원 | 예산 판단 핵심 후보 |
| 내부 confirmed ROAS | 0.28x | 예산 판단 핵심 후보 |
| Google evidence payment_success | 29건 | Google click/UTM 증거가 있는 결제완료 후보 |
| confirmed orders | 27건 | 실제 결제완료 주문 |

해석:

- `NPay 클릭을 구매완료로 세는 것`이 문제다.
- `NPay 실제 결제완료 매출`은 내부 confirmed revenue에 포함해야 한다.
- 이번 backend 배포는 이 구분을 운영 API에서도 보이게 하는 조회 복구다.

## 배포 범위

포함:

- `backend/src/routes/googleAds.ts`의 Google Ads dashboard 내부 원장 조회 로직.
- `GET /api/google-ads/dashboard?date_preset=last_30d` read-only 응답.
- `GET /api/google-ads/status` read-only smoke.
- `GET /health` smoke.
- VM 기존 backend process `seo-backend` 재시작.

구체 코드 범위:

- 운영 VM 원장 API `/api/attribution/ledger`를 10일 단위로 나눠 조회한다.
- 각 chunk는 먼저 `limit=1` summary로 총 row 수를 본다.
- row 수가 limit을 넘으면 하루 단위로 다시 나눠 truncation을 줄인다.
- VM 원장 응답 실패 시에는 warning과 함께 기존 local fallback을 유지한다.
- 원장 응답이 잘리면 내부 ROAS가 낮게 보일 수 있다는 warning을 표시한다.

제외:

- `POST /api/attribution/paid-click-intent/no-send` 변경.
- paid_click_intent ledger 저장.
- confirmed_purchase dispatcher.
- Google Ads conversion upload.
- Google Ads conversion action create/update.
- GA4/Meta/TikTok/Naver 전송.
- GTM workspace, preview, submit, publish.
- DB migration.
- env/secret 변경.
- 광고 예산, 캠페인, 입찰 설정 변경.

## 실행 순서

승인 후 Codex가 아래 순서로 진행한다.

1. 운영 VM 접속 경로 확인.

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94
```

2. 운영 backend 상태 확인.

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94 \
  'sudo -n -u biocomkr_sns bash -lc '\''export PATH=/home/biocomkr_sns/seo/node/bin:$PATH; cd /home/biocomkr_sns/seo/repo/backend && pm2 describe seo-backend --no-color | sed -n "1,35p"'\'''
```

3. 현재 운영 backend source를 백업한다.

```bash
/home/biocomkr_sns/seo/shared/deploy-backups/YYYYMMDD_google_ads_vm_ledger_source_recovery/
```

4. 로컬 변경 파일 중 `backend/src/routes/googleAds.ts`만 운영 repo에 반영한다.

5. 기존 backend deploy flow에 맞춰 typecheck/build를 실행한다.

```bash
cd /home/biocomkr_sns/seo/repo/backend
npm run typecheck
npm run build
```

6. 기존 env 그대로 `seo-backend`만 재시작한다.

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes taejun@34.64.104.94 \
  'sudo -n -u biocomkr_sns bash -lc '\''export PATH=/home/biocomkr_sns/seo/node/bin:$PATH; cd /home/biocomkr_sns/seo/repo/backend && pm2 restart seo-backend --update-env && pm2 save'\'''
```

7. post-deploy smoke를 read-only로 실행한다.

```bash
curl -fsS https://att.ainativeos.net/health
curl -fsS https://att.ainativeos.net/api/google-ads/status
curl -fsS 'https://att.ainativeos.net/api/google-ads/dashboard?date_preset=last_30d'
```

## 허용 범위

승인하면 해도 되는 일:

- 운영 VM backend source 백업.
- `backend/src/routes/googleAds.ts` 1파일의 Google Ads dashboard read-only 조회 복구 반영.
- backend typecheck/build.
- PM2 `seo-backend` restart.
- `health/status/dashboard` read-only smoke.
- Hard Fail 발생 시 즉시 rollback.

## 금지 범위

승인해도 하면 안 되는 일:

- 운영 DB write/import.
- TJ 관리 Attribution VM ledger write.
- paid_click_intent ledger write.
- Google Ads conversion upload.
- Google Ads API mutate.
- Google Ads conversion action create/update.
- GA4/Meta/TikTok/Naver/Google Ads 전송.
- GTM Preview, Submit, Production publish.
- env/secret 변경.
- background sender/job 활성화.
- 광고 예산/캠페인/입찰 변경.
- unrelated backend 파일 변경.

## Hard Fail

아래 중 하나라도 발생하면 즉시 중단하고 rollback한다.

- `/health`가 실패한다.
- `/api/google-ads/status`가 5xx 또는 인증 오류로 실패한다.
- `/api/google-ads/dashboard?date_preset=last_30d`가 5xx로 실패한다.
- dashboard 응답의 내부 원장 source가 `operational_vm_ledger`가 아니라 `local_attribution_ledger`로 남는다.
- dashboard 응답 시간이 반복적으로 120초를 넘는다.
- `would_send=true`, conversion upload, mutate, platform send 경로가 실행될 징후가 있다.
- 운영 DB나 Attribution VM ledger에 insert/update/delete가 발생한다.
- env/secret 변경이 필요해진다.
- `seo-backend` PM2 restart가 실패하고 이전 process도 복구되지 않는다.

## Success Criteria

성공으로 볼 기준:

- `GET https://att.ainativeos.net/health`가 ok.
- `GET https://att.ainativeos.net/api/google-ads/status`가 ok이고 customerId `2149990943` 확인.
- `GET https://att.ainativeos.net/api/google-ads/dashboard?date_preset=last_30d`가 ok.
- dashboard 내부 응답에서 `internal.dataSource=operational_vm_ledger`.
- dashboard 내부 응답에서 `internal.summary.internalConfirmedRoas=0.28` 또는 더 최신 same-window 기준값.
- dashboard 내부 응답에서 `internal.latestLoggedAt=2026-05-06T14:59:06.844Z` 또는 더 최신 값.
- No-send / No-write / No-publish / No-platform-send가 유지된다.
- Google Ads 플랫폼 ROAS와 내부 confirmed ROAS가 같은 window로 분리 표시된다.

## Rollback

문제 발생 시 아래 순서로 되돌린다.

1. 배포 전 백업한 `backend/src/routes/googleAds.ts` 또는 backend source backup을 복원한다.
2. 기존 env 그대로 build 후 PM2를 재시작한다.
3. `/health`를 먼저 확인한다.
4. `/api/google-ads/status`를 확인한다.
5. `/api/google-ads/dashboard?date_preset=last_30d`가 최소한 이전 동작 또는 안전한 fallback으로 돌아왔는지 확인한다.

Rollback 성공 기준:

- `/health` ok.
- `seo-backend` PM2 online.
- 외부 platform send 0건.
- DB/ledger write 0건.

## paid_click_intent 경과 시간

기준 시각: 2026-05-07 18:23 KST

| 기준점 | 시각 | 현재까지 경과 | 다음 의미 |
|---|---|---:|---|
| receiver-enabled GTM Production publish | 2026-05-07 00:02 KST | 약 18시간 21분 | 24h monitoring까지 약 5시간 39분 남음 |
| live browser smoke | 2026-05-07 00:03 KST | 약 18시간 20분 | live browser 기준 24h까지 약 5시간 40분 남음 |

이 시간은 `paid_click_intent v1`이 운영 고객 흐름에 노출된 시간이다.
아직 24h monitoring 창은 닫히지 않았다.
따라서 minimal paid_click_intent ledger write 승인은 이 문서와 별개로 24h/72h 결과 이후 판단한다.

## 승인 문구

아래 문구로 승인하면 Codex가 이 문서의 허용 범위 안에서 배포, smoke, rollback 필요 시 rollback까지 진행한다.

```text
YES: Google Ads dashboard VM ledger source recovery backend deploy를 승인합니다.

범위:
- att.ainativeos.net backend의 Google Ads dashboard read-only 원장 조회 로직만 운영 반영
- 대상 파일: backend/src/routes/googleAds.ts
- 목적: /api/google-ads/dashboard?date_preset=last_30d 가 local fallback이 아니라 operational_vm_ledger same-window를 쓰게 복구
- 운영 backend source 백업, typecheck/build, seo-backend restart, health/status/dashboard read-only smoke까지 허용

금지:
- 운영 DB/ledger write
- Google Ads conversion upload 또는 mutate
- Google Ads conversion action create/update
- GA4/Meta/TikTok/Naver/Google Ads 전송
- GTM preview/submit/publish
- env/secret 변경
- paid_click_intent ledger write
- 광고 예산/캠페인/입찰 변경
- unrelated backend 변경

성공 기준:
- /health ok
- /api/google-ads/status ok customerId=2149990943
- /api/google-ads/dashboard?date_preset=last_30d ok
- internal.dataSource=operational_vm_ledger
- internal.summary.internalConfirmedRoas=0.28 또는 더 최신 same-window 값
- internal.latestLoggedAt=2026-05-06T14:59:06.844Z 또는 더 최신 same-window 값
- No-send / No-write / No-publish / No-platform-send 유지
```

## 승인 후 다음 액션

TJ님 승인 후 Codex가 바로 진행한다.

1. VM 접속과 current backend 백업.
2. `backend/src/routes/googleAds.ts`만 운영 반영.
3. typecheck/build.
4. `seo-backend` restart.
5. `health/status/dashboard` read-only smoke.
6. 결과 문서 작성.
7. 실패 시 rollback 결과까지 함께 보고.

## Auditor verdict

Auditor verdict: NEEDS_HUMAN_APPROVAL

Project: gdn / Google Ads ROAS
Lane: Yellow for execution / Green approval draft only
Mode: no-send / no-write / no-publish / no-platform-send

No-send verified: YES
No-write verified: YES
No-deploy verified: YES for this document-writing step
No-publish verified: YES
No-platform-send verified: YES

Changed files:
- `gdn/google-ads-vm-ledger-source-recovery-backend-deploy-approval-20260507.md`

What changed:
- 운영 VM backend 배포 승인 범위, 금지 범위, Hard Fail, Success Criteria, Rollback을 문서화했다.

What did not change:
- 운영 VM backend에는 아직 배포하지 않았다.
- 운영 DB와 TJ 관리 Attribution VM 원장에는 write하지 않았다.
- Google Ads, GA4, Meta, TikTok, Naver에는 어떤 전환도 보내지 않았다.
- GTM은 건드리지 않았다.

Source / window / freshness:
- source: Google Ads API v22 `customers/2149990943`, TJ 관리 Attribution VM `attribution_ledger`
- window: `2026-04-07~2026-05-06 KST`
- freshness: Google Ads API `2026-05-07 18:12 KST`, 내부 원장 `latestWindowLoggedAt 2026-05-06T14:59:06.844Z`
- confidence: 0.90
