# reportcoffee campaign_id P1 VM Cloud deploy approval 20260524

작성 시각: 2026-05-24 12:31 KST
기준일: 2026-05-24
문서 성격: 더클린커피 campaign_id capture P1 backend VM Cloud 배포 승인안 / Yellow Lane
담당: Codex
상위 문서: [[reportcoffee-campaign-id-capture-hardening-design-20260524]], [[reportcoffee-google-click-campaign-bridge-preview-20260523]], [[reportcoffee]]

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
    - harness/yellow-lane-deploy-packet-template-20260523.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - harness/coffee-data/VERIFY.md
    - harness/coffee-data/AUDITOR_CHECKLIST.md
    - report/reportcoffee-campaign-id-capture-hardening-design-20260524.md
  lane: Yellow approval packet only
  allowed_actions:
    - approval_packet_documentation
    - local_patch_summary
    - local_fixture_result_summary
    - deploy_runbook_draft
    - rollback_plan_draft
  forbidden_actions:
    - vm_cloud_deploy_or_restart_without_tj_approval
    - vm_cloud_sqlite_write_without_tj_approval
    - operating_db_write
    - gtm_publish
    - imweb_header_footer_save
    - google_ads_campaign_change
    - google_ads_conversion_upload
    - platform_send
    - raw_identifier_output
  source_window_freshness_confidence:
    source: local backend patch + local fixtures + current campaign_id hardening design
    window: local validation 2026-05-24 KST
    freshness: fresh local code validation; VM Cloud live flag state must be checked immediately before deploy
    confidence: 0.9 for patch behavior, 0.82 for deploy readiness before VM pre-snapshot
```

## 10초 요약

이 문서는 더클린커피 Google 클릭 캠페인 번호 보존을 위해 서버 수신점을 운영 VM Cloud에 반영할지 승인받는 문서다.

바꾸는 내용은 좁다. 더클린커피도 유료 광고 클릭 신호를 받을 수 있게 하고, `gad_campaignid`와 `gad_source`를 명시 필드, landing URL, current URL 순서로 보존한다.

주의할 점은 하나다. VM Cloud의 기존 `PAID_CLICK_INTENT_WRITE_ENABLED`가 켜져 있으면, 배포 후 실제 더클린커피 Google 클릭 row가 VM Cloud SQLite `paid_click_intent_ledger`에 최소 필드로 저장될 수 있다. 이것이 이번 P1의 의도지만, 승인 전에는 실행하지 않는다.

## 사람 말 요약

### 무엇을 바꾸는가

더클린커피 고객이 Google 광고를 타고 들어왔을 때, 서버가 그 클릭 흔적과 캠페인 번호를 내부 진단용 장부에 남길 수 있게 한다.

기술 이름은 `paid-click-intent receiver`다. 쉬운 말로는 `유료 광고 클릭 신호 수신점`이다.

### 왜 바꾸는가

현재 더클린커피에는 Google 클릭 ID가 최근 7일 3건 보였지만, 캠페인 번호는 0건이다. 그래서 광고를 다시 켜도 어느 캠페인의 클릭인지 내부 ROAS와 연결하기 어렵다.

### 바뀌면 TJ님이 체감하는 효과

Google 광고를 다시 시작했을 때 “클릭은 잡혔는데 캠페인이 비어 있음” 상태를 줄일 수 있다. 이후 더클린커피 Google Ads 비용과 실제 결제완료 매출을 같은 window로 대조할 근거가 생긴다.

### 안 바꾸면 남는 문제

더클린커피 유료 클릭 의도 장부가 계속 0건에 가깝게 남는다. 그러면 Google Ads URL suffix를 붙여도 서버가 더클린커피 row를 안정적으로 측정하지 못한다.

## 로컬 패치 상태

이번 문서 작성 전 로컬에서 아래 패치를 준비했다. VM Cloud에는 아직 반영하지 않았다.

### 변경 파일

- `backend/src/routes/attribution.ts`
- `backend/src/paidClickIntentLog.ts`
- `backend/scripts/paid-click-intent-coffee-campaignid-fixture.ts`

### 동작 변경

1. `site=thecleancoffee`가 `site_not_allowed`로 막히지 않는다.
2. `gad_campaignid` 저장 우선순위가 아래 순서로 넓어진다.

```text
explicit body field
-> landing URL query
-> current URL query
```

3. `gad_campaignid`만 있어도 구매나 upload 후보가 되지는 않는다.
4. 실제 Google 클릭 ID 판단은 계속 `gclid`, `gbraid`, `wbraid`만 쓴다.
5. raw click id, raw URL, 주문번호, 결제정보, email, phone은 응답이나 문서에 출력하지 않는다.

### 로컬 검증

```text
npx tsx backend/scripts/paid-click-intent-coffee-campaignid-fixture.ts
결과: 4/4 PASS

node scripts/coffee-click-id-structured-storage-fixture.mjs
결과: 9/9 PASS

cd backend && npm run typecheck
결과: PASS
```

## 승인 대상

아래 1개만 승인 대상이다.

> 더클린커피 campaign_id capture P1 backend patch를 VM Cloud `seo-backend`에 배포하고, 제한 smoke 후 결과를 보고한다.

## 승인하면 허용되는 작업

1. VM Cloud 현재 상태 pre-snapshot.
2. 원격 파일 backup.
3. `backend/src/routes/attribution.ts`, `backend/src/paidClickIntentLog.ts` 반영.
4. 필요하면 fixture script도 원격에 복사.
5. VM Cloud backend typecheck/build.
6. `seo-backend` PM2 restart 1회.
7. `/health`와 paid-click-intent TEST no-send smoke.
8. VM Cloud SQLite aggregate read-only로 row 증가 여부 확인.
9. 문제 발생 시 즉시 rollback.

## 승인해도 금지되는 작업

- Google Ads conversion upload.
- Google Ads 전환 액션 생성/변경.
- Google Ads 캠페인 URL suffix/tracking template 변경.
- GA4, Meta, TikTok, Naver 실제 전송.
- GTM Production publish.
- Imweb header/footer/body 저장.
- 운영DB write/import/schema 변경.
- raw click ID, raw URL, 주문번호, 결제키, email, phone 출력.

## 사전 스냅샷

배포 직전에 아래를 확인한다.

```bash
ssh taejun@34.64.104.94

sudo -n -u biocomkr_sns bash -lc '
export PATH=/home/biocomkr_sns/seo/node/bin:/usr/local/bin:/usr/bin:/bin:$PATH
cd /home/biocomkr_sns/seo/repo
date
git rev-parse --short HEAD
pm2 describe seo-backend | sed -n "1,80p"
curl -sS http://localhost:7020/health
grep -E "^(PAID_CLICK_INTENT_WRITE_ENABLED|PAID_CLICK_INTENT_WRITE_SAMPLE_RATE)=" backend/.env || true
'
```

해석:

- `PAID_CLICK_INTENT_WRITE_ENABLED=true`이면 배포 후 실제 더클린커피 live Google click row가 VM Cloud SQLite에 저장될 수 있다.
- 이것이 싫으면 배포 전 site별 write gate를 추가하는 별도 patch가 필요하다.

## 백업 경로

예상 경로:

```text
/home/biocomkr_sns/seo/repo/.deploy-backups/coffee-campaignid-p1-20260524T<HHMM>KST
```

백업 대상:

```text
backend/src/routes/attribution.ts
backend/src/paidClickIntentLog.ts
```

## 적용 순서

아래 명령은 승인 후 실행한다. 지금은 실행하지 않는다.

```bash
# local -> VM Cloud temp upload
scp backend/src/routes/attribution.ts \
  backend/src/paidClickIntentLog.ts \
  backend/scripts/paid-click-intent-coffee-campaignid-fixture.ts \
  taejun@34.64.104.94:/tmp/coffee-campaignid-p1/

# VM Cloud apply/build/restart
ssh taejun@34.64.104.94

sudo -n -u biocomkr_sns bash -lc '
set -euo pipefail
export PATH=/home/biocomkr_sns/seo/node/bin:/usr/local/bin:/usr/bin:/bin:$PATH
cd /home/biocomkr_sns/seo/repo

BACKUP_DIR=".deploy-backups/coffee-campaignid-p1-$(date +%Y%m%dT%H%M%SKST)"
mkdir -p "$BACKUP_DIR/backend/src/routes" "$BACKUP_DIR/backend/src"
cp backend/src/routes/attribution.ts "$BACKUP_DIR/backend/src/routes/attribution.ts.before"
cp backend/src/paidClickIntentLog.ts "$BACKUP_DIR/backend/src/paidClickIntentLog.ts.before"

cp /tmp/coffee-campaignid-p1/attribution.ts backend/src/routes/attribution.ts
cp /tmp/coffee-campaignid-p1/paidClickIntentLog.ts backend/src/paidClickIntentLog.ts
cp /tmp/coffee-campaignid-p1/paid-click-intent-coffee-campaignid-fixture.ts backend/scripts/paid-click-intent-coffee-campaignid-fixture.ts

cd backend
npm run typecheck
npm run build
npx tsx scripts/paid-click-intent-coffee-campaignid-fixture.ts
pm2 restart seo-backend --update-env
pm2 save
curl -sS http://localhost:7020/health
'
```

## Post-deploy smoke

실제 live click id처럼 보이는 값을 쓰지 않는다. `TEST_` prefix를 사용해 VM Cloud SQLite write를 피한다.

```bash
curl -sS https://att.ainativeos.net/api/attribution/paid-click-intent/no-send \
  -H 'Content-Type: application/json' \
  --data '{
    "site":"thecleancoffee",
    "capture_stage":"landing",
    "captured_at":"2026-05-24T03:00:00.000Z",
    "gclid":"TEST_COFFEE_GCLID_20260524",
    "current_url":"https://thecleancoffee.com/?gad_campaignid=14629255429&gad_source=1",
    "ga_session_id":"test_session",
    "local_session_id":"test_local"
  }'
```

성공 기준:

- HTTP 200.
- `site_not_allowed`가 없다.
- `test_click_id_rejected_for_live`는 있어도 된다.
- `gad_campaignid`가 preview에 보인다.
- `would_send=false`, `no_platform_send_verified=true`.
- VM Cloud SQLite write row 증가 0건 또는 TEST row 저장 0건.

## 성공 기준

### API 기준

- `/health` 200.
- paid-click-intent TEST smoke 200.
- `site=thecleancoffee`에서 `site_not_allowed` 제거.

### 숫자 기준

- 배포 직후 TEST smoke로 live row insert 0건.
- 실제 운영 트래픽에서는 `gclid/gbraid/wbraid`가 있을 때만 live 후보.
- `gad_campaignid`만 있는 row는 `missing_google_click_id`로 차단.

### 외부 영향 기준

- Google Ads upload 0건.
- GA4/Meta/TikTok/Naver send 0건.
- GTM publish 0건.
- Imweb 저장 0건.
- 운영DB write 0건.

## Hard Fail

아래 중 하나라도 발생하면 rollback한다.

- `/health` 실패 또는 주요 API 5xx 지속.
- `site_not_allowed`가 여전히 남는다.
- `gad_campaignid`만 있는 payload가 live candidate로 바뀐다.
- raw click id, raw URL, 주문번호, 결제키, email, phone이 문서/로그/응답에 노출된다.
- Google Ads/GA4/Meta/TikTok/Naver 전송이 관측된다.
- `seo-backend` restart loop 또는 PM2 상태 abnormal.

## Rollback

```bash
ssh taejun@34.64.104.94

sudo -n -u biocomkr_sns bash -lc '
set -euo pipefail
export PATH=/home/biocomkr_sns/seo/node/bin:/usr/local/bin:/usr/bin:/bin:$PATH
cd /home/biocomkr_sns/seo/repo

BACKUP_DIR="<실제 backup 경로>"
cp "$BACKUP_DIR/backend/src/routes/attribution.ts.before" backend/src/routes/attribution.ts
cp "$BACKUP_DIR/backend/src/paidClickIntentLog.ts.before" backend/src/paidClickIntentLog.ts
cd backend
npm run build
pm2 restart seo-backend --update-env
pm2 save
curl -sS http://localhost:7020/health
'
```

## 승인 문구

TJ님이 승인할 때는 아래처럼 좁게 승인하면 된다.

```text
승인합니다: 더클린커피 campaign_id capture P1 backend VM Cloud 배포.

범위:
- backend/src/routes/attribution.ts
- backend/src/paidClickIntentLog.ts
- 선택: backend/scripts/paid-click-intent-coffee-campaignid-fixture.ts
- VM Cloud backup, typecheck/build, seo-backend PM2 restart 1회, TEST no-send smoke, aggregate read-only 확인

허용:
- 더클린커피 paid-click-intent receiver 허용
- gad_campaignid/gad_source 저장 우선순위 보강
- 기존 PAID_CLICK_INTENT_WRITE_ENABLED가 켜져 있으면 live 더클린커피 Google click 최소 row 저장 가능

금지:
- Google Ads upload/conversion action/campaign setting 변경
- GA4/Meta/TikTok/Naver 전송
- GTM publish
- Imweb 저장
- 운영DB write
- raw 식별자 출력

성공 기준:
- health 200
- TEST smoke에서 site_not_allowed 제거
- gad_campaignid-only는 missing_google_click_id로 차단
- 외부 send/upload/publish 0건
- 문제 시 backup으로 즉시 rollback
```

## 현재 판정

Auditor verdict: PASS_WITH_NOTES.

로컬 패치와 fixture는 PASS다. 실제 VM Cloud deploy/restart와 VM Cloud SQLite write 가능성은 Yellow라 TJ님 명시 승인 전 실행하지 않는다.

## 다음 할일

### Codex가 할 일

1. TJ님 승인 전까지 배포는 보류한다.
   - 무엇을: 로컬 patch와 승인 문서를 유지하고, 실제 VM Cloud 반영은 하지 않는다.
   - 왜: VM Cloud restart와 live minimal ledger write 가능성이 있어 Yellow 승인선이다.
   - 어떻게: 승인 문구가 오면 위 적용 순서대로 backup -> typecheck/build -> restart -> smoke -> report까지 실행한다.
   - 성공 기준: 승인 전 운영 영향 0건.
   - 실패 시 다음 확인점: 실수로 배포/전송/write가 발생하지 않았는지 git diff와 실행 로그 확인.
   - 의존성: TJ님 Yellow 승인.
   - 승인 필요 여부: YES, 실제 deploy.
   - 추천 점수/자신감: 88%.

2. 승인 없이 가능한 추가 Green 검증을 유지한다.
   - 무엇을: local fixture, typecheck, wiki link, diff check를 반복한다.
   - 왜: 승인 순간 바로 실행 가능한 상태를 유지하기 위해서다.
   - 어떻게: `npx tsx backend/scripts/paid-click-intent-coffee-campaignid-fixture.ts`, `npm run typecheck`, `python3 scripts/validate_wiki_links.py ...`.
   - 성공 기준: PASS 유지.
   - 실패 시 다음 확인점: type mismatch, stale 문서 링크, unrelated dirty 혼입.
   - 의존성: 없음.
   - 승인 필요 여부: NO.
   - 추천 점수/자신감: 92%.

### TJ님이 할 일

1. 배포를 원하면 승인 문구를 그대로 회신한다.
   - 무엇을: 위 `승인 문구` 블록을 승인한다.
   - 왜: VM Cloud backend restart와 live 최소 원장 저장 가능성은 Codex가 임의로 넘으면 안 되는 선이다.
   - 어떻게: 이 문서의 `승인 문구`를 그대로 보내거나, `YES, 이 범위로 배포`라고 회신한다.
   - 성공 기준: Codex가 backup부터 smoke까지 중간 확인 없이 진행할 수 있다.
   - 실패 시 다음 확인점: live write가 부담되면 `site별 write gate 먼저 추가`로 범위를 바꾼다.
   - Codex가 대신 못 하는 이유: 운영 VM Cloud 배포/restart와 live SQLite write 가능성은 Yellow 승인 작업이다.
   - 의존성: 로컬 patch PASS.
   - 승인 필요 여부: YES.
   - 추천 점수/자신감: 88%.
