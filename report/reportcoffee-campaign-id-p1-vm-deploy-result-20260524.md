# reportcoffee campaign_id P1 VM Cloud deploy result 20260524

작성 시각: 2026-05-24 12:48 KST
기준일: 2026-05-24
문서 성격: 더클린커피 campaign_id capture P1 backend VM Cloud 배포 결과 / Yellow Lane
담당: Codex
상위 문서: [[reportcoffee-campaign-id-p1-vm-deploy-approval-20260524]], [[reportcoffee-campaign-id-capture-hardening-design-20260524]], [[reportcoffee]]

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - harness/coffee-data/VERIFY.md
    - harness/coffee-data/AUDITOR_CHECKLIST.md
    - report/reportcoffee-campaign-id-p1-vm-deploy-approval-20260524.md
  lane: Yellow approved by TJ님 in chat
  allowed_actions:
    - vm_cloud_backend_file_backup
    - vm_cloud_backend_file_deploy
    - remote_typecheck_build_fixture
    - pm2_restart_once
    - no_send_test_smoke
    - vm_cloud_sqlite_readonly_aggregate
  forbidden_actions:
    - google_ads_campaign_change
    - google_ads_conversion_upload
    - gtm_publish
    - imweb_header_footer_save
    - operating_db_write
    - manual_platform_send
    - raw_identifier_output
  source_window_freshness_confidence:
    source: VM Cloud backend + public no-send endpoint + VM Cloud SQLite read-only
    window: deploy/smoke 2026-05-24 12:37-12:45 KST
    freshness: fresh
    confidence: 0.9 for deploy and receiver smoke; 0.8 for background-send impact classification
```

## 10초 요약

더클린커피 Google 캠페인 번호 보존을 위한 서버 수신점 보강을 VM Cloud에 반영했다. 이제 `site=thecleancoffee`는 `site_not_allowed`로 막히지 않고, `gad_campaignid`는 명시 필드, landing URL, current URL에서 보존된다.

주의할 점도 확인됐다. VM Cloud의 기존 `PAID_CLICK_INTENT_WRITE_ENABLED`는 실제 프로세스에서 ON으로 동작한다. 따라서 앞으로 실제 더클린커피 Google 클릭이 들어오면 최소 원장 row가 저장될 수 있다. 이번 TEST smoke는 저장되지 않았다.

또한 PM2 restart 직후 기존 운영 작업인 CAPI auto-sync가 1건 전송됐다. 이번 paid-click 코드가 직접 보낸 전송은 아니지만, 향후 VM Cloud restart 전에는 기존 background sender 상태를 먼저 확인해야 한다.

## 배포 범위

### 변경 파일

- `backend/src/routes/attribution.ts`
- `backend/src/paidClickIntentLog.ts`
- `backend/scripts/paid-click-intent-coffee-campaignid-fixture.ts`

### 바뀐 동작

1. `site=thecleancoffee` paid-click intent no-send receiver 허용.
2. `gad_campaignid/gad_source` 저장 우선순위 보강.
3. `gad_campaignid`만 있는 payload는 계속 `missing_google_click_id`로 차단.
4. TEST click id는 계속 live ledger 후보에서 차단.

## 원격 백업

백업 경로:

```text
/home/biocomkr_sns/seo/repo/.deploy-backups/coffee-campaignid-p1-20260524T033835KST
```

주의: 경로 문자열은 원격 VM의 date timezone 기준으로 생성됐다. 실제 작업 시각은 2026-05-24 12:38 KST다.

SHA:

```text
attribution before:       68b2f05a55582ab3cad645a3ab64e04eb815f901e46822923e37a40ea1f46061
attribution after:        dc70d2f2e7e520f43a62018d19e7a90b15880c2b2a68e8f7fa4611f648b15c10
paidClickIntent before:   153be23792873c6edcf8987dab4e64c7eda4a8c71d44c3c65a52e6dd1fdea3a1
paidClickIntent after:    e50a2ad6af691f9821659c4379139cafb20f4c3e886de51d28b7c116dfe865c0
```

## 원격 검증

```text
remote npm run typecheck: PASS
remote npm run build: PASS
remote paid-click-intent coffee fixture: 4/4 PASS
pm2 restart seo-backend: PASS
pm2 save: PASS
```

PM2:

```text
restart: 0 -> 1
status: online
pid: 2305
final /health: 200
```

참고:

restart 직후 3초 시점의 첫 `/health`는 아직 포트가 뜨지 않아 curl 000이었다. 이후 2026-05-24 12:42:29 KST 확인에서 `/health` 200으로 회복됐다.

## Post-deploy smoke

### TEST click smoke

목적:

`site=thecleancoffee`가 허용되고, campaign hint가 잡히며, TEST click id는 live write 후보가 되지 않는지 확인했다.

결과:

```text
HTTP status: 200
ok: true
site: thecleancoffee
site_not_allowed: false
test_click_id_rejected_for_live: true
missing_google_click_id: false
gad_campaignid present: true
gad_source present: true
would_store: false
would_send: false
write_flag_on: true
ledger_stored: false
site_landing_fanout: skipped / missing_landing
no_platform_send_verified: true
```

해석:

성공이다. current URL만 넣고 landing URL을 비워서 site_landing fan-out도 intentionally skip됐다. TEST smoke로 VM Cloud SQLite 신규 coffee row는 생기지 않았다.

### campaign_id only smoke

목적:

`gad_campaignid`만 있는 payload가 live 후보가 되지 않는지 확인했다.

결과:

```text
HTTP status: 400
ok: false
site_not_allowed: false
missing_google_click_id: true
gad_campaignid present: true
live_candidate_after_approval: false
would_store: false
would_send: false
ledger_stored: false
no_platform_send_verified: true
```

해석:

성공이다. 캠페인 번호만으로는 구매나 upload 후보가 되지 않는다.

## VM Cloud SQLite read-only aggregate

배포 전:

```text
paid_click_intent_ledger site=thecleancoffee: 0
paid_click_intent_ledger site=biocom: 20759
site_landing_ledger site=thecleancoffee: 1507
```

배포 후:

```text
paid_click_intent_ledger site=thecleancoffee: 0
paid_click_intent_ledger site=biocom: 20760
site_landing_ledger site=thecleancoffee: 1507
```

해석:

coffee TEST smoke는 원장 row를 만들지 않았다. biocom +1은 배포 후 실제 biocom live paid-click request가 들어온 영향으로 보이며, 이번 coffee TEST smoke와는 별도다.

## 기존 background sender 관측

PM2 restart 후 기존 운영 작업이 아래처럼 동작했다.

```text
[CAPI auto-sync] 활성화 - 30분 주기
[CAPI auto-sync] 1건 전송 (건너뜀 99, 실패 0)
```

해석:

이번 paid-click patch에서 직접 Meta CAPI를 호출한 것은 아니다. 다만 VM Cloud backend restart는 기존 자동 전송 작업을 깨울 수 있다. 앞으로 VM Cloud restart 승인안에는 `CAPI/META/TikTok/Google Ads background sender precheck`를 필수로 넣어야 한다.

이번에는 추가 restart나 rollback을 하지 않았다. 이유는 rollback도 PM2 restart를 다시 요구하고, 기존 background sender를 한 번 더 깨울 수 있기 때문이다. 현재 paid-click route와 health는 PASS다.

## 하지 않은 것

- Google Ads campaign setting 변경 0건.
- Google Ads conversion upload 0건.
- GTM Production publish 0건.
- Imweb header/footer/body 저장 0건.
- 운영DB write/import 0건.
- paid-click route에서 GA4/Meta/TikTok/Naver send 0건.
- raw live click id, raw URL, 주문번호, 결제키, email, phone 출력 0건.

## Auditor verdict

PASS_WITH_NOTES.

배포와 paid-click smoke는 통과했다. 단, VM Cloud restart가 기존 CAPI auto-sync 1건 전송을 트리거한 점은 다음 VM 배포 승인안의 hard precheck로 승격해야 한다.

## Rollback

현재는 rollback하지 않는다. 필요할 때 아래를 실행한다.

```bash
ssh taejun@34.64.104.94

sudo -n -u biocomkr_sns bash -lc '
set -euo pipefail
export PATH=/home/biocomkr_sns/seo/node/bin:/usr/local/bin:/usr/bin:/bin:$PATH
cd /home/biocomkr_sns/seo/repo
BACKUP_DIR=".deploy-backups/coffee-campaignid-p1-20260524T033835KST"
cp "$BACKUP_DIR/backend/src/routes/attribution.ts.before" backend/src/routes/attribution.ts
cp "$BACKUP_DIR/backend/src/paidClickIntentLog.ts.before" backend/src/paidClickIntentLog.ts
cd backend
npm run build
pm2 restart seo-backend --update-env
pm2 save
curl -sS http://localhost:7020/health
'
```

주의:

rollback도 PM2 restart를 동반하므로, 실행 전 기존 background sender 상태를 확인해야 한다.

## 다음 할일

### Codex가 할 일

1. 24시간 뒤 더클린커피 paid-click row가 생겼는지 read-only 확인한다.
   - 무엇을: VM Cloud SQLite `paid_click_intent_ledger site=thecleancoffee`와 `site_landing_ledger` campaign hint 보존률을 집계한다.
   - 왜: 배포 자체가 아니라 실제 Google 유입에서 campaign_id 보존률이 개선됐는지 확인해야 한다.
   - 어떻게: raw click id 출력 없이 count/coverage만 조회한다.
   - 성공 기준: real Google click row가 생기고, `gad_campaignid` coverage가 0보다 커진다.
   - 실패 시 다음 확인점: 광고비 0원/Google 클릭 없음, Imweb browser storage 미반영, Google Ads URL suffix 미부착, receiver CORS.
   - 의존성: 실제 Google 광고 클릭 또는 테스트 트래픽.
   - 승인 필요 여부: NO, read-only.
   - 추천 점수/자신감: 91%.

2. 다음 VM deploy 승인안 템플릿에 background sender precheck를 추가한다.
   - 무엇을: `CAPI auto-sync`, scheduled send, Google/TikTok/Meta background sender ON/OFF 확인을 배포 전 체크로 넣는다.
   - 왜: 이번 restart에서 기존 CAPI auto-sync 1건 전송이 관측됐기 때문이다.
   - 어떻게: `pm2 env`, `.env`, boot log grep, recent send log count를 배포 전/후에 비교한다.
   - 성공 기준: 다음 restart 때 기존 sender가 깨울 전송 가능성을 사전에 판단한다.
   - 실패 시 다음 확인점: env flag 위치, pm2 saved env, background job bootstrap 조건.
   - 의존성: 없음.
   - 승인 필요 여부: 문서 보강은 NO, sender OFF 변경은 별도 승인.
   - 추천 점수/자신감: 95%.

### TJ님이 할 일

1. 지금 당장 할 일은 없다.
   - 무엇을: 배포 결과만 확인한다.
   - 왜: paid-click route는 정상이고 추가 운영 변경은 필요 없다.
   - 어떻게: 이 문서의 smoke 결과와 background sender 관측만 보면 된다.
   - 성공 기준: 더클린커피 Google 클릭 row가 실제로 쌓이는지 다음 read-only 확인으로 넘어간다.
   - 실패 시 다음 확인점: background CAPI 자동 전송이 불편하면 별도 OFF/스케줄 조정 승인안을 만든다.
   - Codex가 대신 못 하는 이유: sender OFF는 운영 전송 정책 변경이라 별도 승인선이다.
   - 의존성: 없음.
   - 승인 필요 여부: 없음.
   - 추천 점수/자신감: 90%.
