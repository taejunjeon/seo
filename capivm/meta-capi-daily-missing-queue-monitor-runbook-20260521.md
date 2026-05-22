# Meta CAPI confirmed Purchase 누락 큐 일일 감시 runbook

작성 시각: 2026-05-21 22:10 KST
최신 업데이트: 2026-05-22 12:48 KST
Lane: Green/Yellow monitoring cron / Red platform send 없음
상태: VM Cloud cron KST 10:00 보정 완료, 정상 OK 보고 always 전환 완료, 로컬 Mac cron 제거 완료, 전날 Meta ROAS 포함 PASS

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - capivm/!capiplan.md
    - capivm/meta-capi-phase1-sprint1-postcheck-runbook-20260517.md
  lane: Green local monitoring script
  allowed_actions:
    - VM Cloud read-only API check
    - local/VM JSON summary write
    - Slack webhook setup guide
    - Slack daily OK/report send when webhook env is explicitly provided
  forbidden_actions:
    - Meta CAPI operational send
    - Google Ads / GA4 / TikTok / Naver send
    - 운영DB write/import
    - GTM publish
    - VM Cloud backend deploy/restart
    - raw identifier output
  source_window_freshness_confidence:
    source: "VM Cloud /health + funnel-health aggregate + Meta CAPI send log aggregate"
    window: "1d default, site=biocom, pixel=1283400029487161"
    freshness: "실행 시점 API fresh 기준"
    confidence: 0.9
```

## 목적

매일 한 번 `실제 결제완료인데 Meta CAPI 성공 기록이 없는 주문`이 생겼는지 확인한다.

이 항목은 광고 플랫폼이 구매를 못 받아 학습 신호가 빠지는 문제이므로 Critical이다. 단, 5/14~5/15 과거 backlog는 ROAS 오염 방지를 위해 backfill하지 않기로 결정했으므로, 이 monitor의 기본 목적은 **현재 window 신규 누락 감시**다.

2026-05-21 23:10 KST부터는 같은 Slack 알림 안에 **전날 Meta ROAS**도 같이 넣는다.

- 내부 귀속 ROAS: VM Cloud/내부 원장 기준으로 Meta 유입 결제완료 매출을 광고비로 나눈 값.
- Meta Ads Manager ROAS: Meta 광고관리자가 주장하는 구매 매출을 광고비로 나눈 값.
- 두 값은 일부러 분리한다. 내부 귀속 ROAS는 운영 판단용이고, Meta Ads Manager ROAS는 플랫폼 보고값 확인용이다.

## 실행 스크립트

```bash
/Users/vibetj/coding/seo/scripts/meta-capi-daily-missing-queue-monitor.sh
```

기본값:

- site: `biocom`
- pixel: `1283400029487161`
- window: `1d`
- mode: `always` (운영값, 정상 OK 보고 포함)
- confirmed-but-no-CAPI grace: 30분
- live smoke: OFF
- 외부 전송: 0
- 운영DB write: 0
- raw id 출력: 0

## 오늘 실행 결과

2026-05-21 22:05 KST 기준:

- confirmed-but-no-CAPI: 0건 / 0원
- 최근 1일 CAPI success: 46건
- 최근 1일 CAPI failure: 0건
- duplicate event_id: 0
- Slack 알림: webhook 미설정 + severity ok라 전송 skip

결과 파일:

- `/Users/vibetj/coding/seo/data/project/meta-capi-daily-missing-queue-monitor-daily-20260521-220504.json`
- `/Users/vibetj/coding/seo/data/project/meta-capi-phase1-sprint1-postcheck-daily-20260521-220504.json`

## Slack webhook 연결 후 테스트 결과

2026-05-21 22:26 KST 기준:

- Slack webhook test: PASS, Slack HTTP 200
- confirmed-but-no-CAPI: 1건 / 245,000원
- 최근 1일 CAPI success: 46건
- 최근 1일 CAPI failure: 0건
- duplicate event_id: 0
- severity: critical
- 실제 Meta/Google/GA4/TikTok/Naver 전송: 0
- 운영DB write: 0
- GTM publish: 0
- raw identifier output: 0

결과 파일:

- `/Users/vibetj/coding/seo/data/project/meta-capi-daily-missing-queue-monitor-daily-20260521-222618.json`
- `/Users/vibetj/coding/seo/data/project/meta-capi-phase1-sprint1-postcheck-daily-20260521-222618.json`

해석:

- Slack 연결은 정상이다.
- 이번 실행에서는 1일 window 안에 `결제완료는 있는데 Meta CAPI 성공 기록이 없는 후보`가 1건 잡혔다.
- 이 monitor는 후보를 알려주는 장치이고, 자동 backfill/send는 하지 않는다.

2026-05-21 22:37 KST live action queue read-only 재확인:

- confirmed-but-no-CAPI: 1건
- 최신 후보 safe_ref: `safe_214facdeea`
- latest amount bucket: 234,000원
- missing_policy: `current_missing_watch`
- source bucket: Meta evidence 있음
- 해석: 과거 보관 backlog가 아니라 현재 window에서 분류해야 할 후보로 보인다. 자동 전송하지 말고 CAPI sync 사유를 먼저 분류한다.

2026-05-21 22:45 KST grace rule 적용 후 alert-only 재실행:

- confirmed-but-no-CAPI: 1건 / 234,000원
- 가장 오래된 후보 age: 9.5분
- grace: 30분
- severity: ok
- Slack 발송: skip
- 해석: 결제 직후 CAPI sync가 따라올 수 있는 정상 대기 구간이므로, 아직 Critical로 알리지 않는다.

결과 파일:

- `/Users/vibetj/coding/seo/data/project/meta-capi-daily-missing-queue-monitor-daily-20260521-224518.json`
- `/Users/vibetj/coding/seo/data/project/meta-capi-phase1-sprint1-postcheck-daily-20260521-224518.json`

2026-05-21 23:06 KST VM Cloud smoke 실행:

- 실행 위치: VM Cloud `/home/biocomkr_sns/seo/repo`
- confirmed-but-no-CAPI: 0건 / 0원
- 최근 1일 CAPI success: 48건
- 최근 1일 CAPI failure: 0건
- duplicate event_id: 0
- severity: ok
- Slack 발송: skip (`alert_only` + 정상 상태)
- 어제 내부 귀속 ROAS: 1.64x
- 어제 Meta Ads Manager ROAS: 1.46x
- 어제 광고비: 3,613,405원
- 어제 내부 귀속 매출: 5,914,374원 / 18건
- 어제 Meta Ads Manager 구매 매출: 5,275,454원
- ROAS cache: `in_memory_precompute`, stale=false

VM 결과 파일:

- `/home/biocomkr_sns/seo/repo/data/project/monitoring/meta-capi-daily-missing-queue-monitor-vm-cron-smoke-20260521230627.json`
- `/home/biocomkr_sns/seo/repo/data/project/monitoring/meta-capi-phase1-sprint1-postcheck-vm-cron-smoke-20260521230627.json`

2026-05-22 12:48 KST VM Cloud timezone 보정:

- 원인: VM Cloud 시스템 timezone이 UTC라서 `0 10 * * *`는 KST 10:00이 아니라 KST 19:00 실행이었다.
- 조치: 운영 crontab을 `0 1 * * *`로 변경했다. 이는 UTC 01:00, KST 10:00이다.
- 알림 모드: TJ님 결정에 따라 `META_CAPI_DAILY_MONITOR_NOTIFY_MODE='always'`로 변경했다.
- 백업:
  - crontab: `/home/biocomkr_sns/seo/monitoring/crontab-backup-before-meta-capi-kst-20260522-124746.txt`
  - env: `/home/biocomkr_sns/seo/repo/.local/meta-capi-daily-monitor.env.bak-before-kst-20260522-124746`
- no-send smoke: webhook URL을 빈 값으로 덮어쓴 수동 실행 PASS.
  - severity: ok
  - should_notify: true
  - notify_mode: always
  - confirmed-but-no-CAPI: 0건 / 0원
  - CAPI 1d success: 62건
  - CAPI 1d failure: 0건
  - platform send/write: 0

## Slack Bot 설정 방법

가장 단순하고 안전한 방법은 Slack Incoming Webhook이다. 이 방식은 Slack 앱 하나를 만들고, 특정 채널로 메시지를 보낼 수 있는 webhook URL을 발급받는 방식이다.

1. Slack API 페이지에서 새 앱을 만든다.
   - 화면: `api.slack.com/apps` 또는 Slack App 관리 화면
   - 방식: `From scratch`
   - 앱 이름 예시: `Biocom CAPI Monitor`
   - 워크스페이스: 알림을 받을 워크스페이스

2. 앱 설정에서 Incoming Webhooks를 켠다.
   - 메뉴: `Incoming Webhooks`
   - `Activate Incoming Webhooks`: On

3. 알림 채널을 선택해 webhook URL을 발급한다.
   - 버튼: `Add New Webhook to Workspace`
   - 채널 예시: `#capi-alert` 또는 TJ님 전용 비공개 채널
   - 발급된 URL은 `https://hooks.slack.com/services/...` 형태다.

4. URL은 코드에 커밋하지 않고 실행 환경 변수로만 넣는다.

```bash
export META_CAPI_DAILY_MONITOR_SLACK_WEBHOOK_URL='https://hooks.slack.com/services/REDACTED'
```

5. 알림 모드를 선택한다.

문제 있을 때만 알림:

```bash
export META_CAPI_DAILY_MONITOR_NOTIFY_MODE=alert_only
```

매일 정상 요약도 알림:

```bash
export META_CAPI_DAILY_MONITOR_NOTIFY_MODE=always
```

현재 운영값은 TJ님 결정에 따라 `always`다. 매일 오전 정상 OK 보고와 전날 Meta ROAS를 받는다. Slack 소음이 커지면 `alert_only`로 되돌릴 수 있다.

6. 수동 테스트를 한다.

```bash
META_CAPI_DAILY_MONITOR_NOTIFY_MODE=always \
/Users/vibetj/coding/seo/scripts/meta-capi-daily-missing-queue-monitor.sh
```

정상 메시지 예시:

```text
✅ Meta CAPI daily monitor OK
site=biocom window=1d pixel=1283400029487161
confirmed-but-no-CAPI=0건 / ₩0
CAPI 1d success=46 failure=0 duplicate_event_id=0
action=현재 누락 큐 없음
checked_at=2026-05-21 22:05:08 KST
```

## 매일 자동 실행 방법

### VM Cloud에서 실행

2026-05-21 23:10 KST 기준 운영 cron은 VM Cloud `biocomkr_sns` 계정에 등록했다.

```cron
# biocom meta capi daily monitor: KST 10:00 (server UTC 01:00), confirmed purchase missing queue + yesterday ROAS
0 1 * * * export PATH=/home/biocomkr_sns/seo/node/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin; cd /home/biocomkr_sns/seo/repo && . /home/biocomkr_sns/seo/repo/.local/meta-capi-daily-monitor.env && /home/biocomkr_sns/seo/repo/scripts/meta-capi-daily-missing-queue-monitor.sh >> /home/biocomkr_sns/seo/monitoring/meta-capi-daily-monitor.cron.log 2>&1
```

VM Cloud 파일:

- 스크립트: `/home/biocomkr_sns/seo/repo/scripts/meta-capi-daily-missing-queue-monitor.sh`
- post-check helper: `/home/biocomkr_sns/seo/repo/scripts/meta-capi-phase1-sprint1-postcheck.sh`
- env: `/home/biocomkr_sns/seo/repo/.local/meta-capi-daily-monitor.env` (`chmod 600`, webhook URL은 문서/커밋 출력 금지)
- 로그: `/home/biocomkr_sns/seo/monitoring/meta-capi-daily-monitor.cron.log`
- 결과 JSON: `/home/biocomkr_sns/seo/repo/data/project/monitoring/`

### 로컬 Mac에서 실행

아래 cron은 매일 오전 10시 KST에 실행한다.

```bash
crontab -e
```

추가:

```cron
SHELL=/bin/zsh
PATH=/Users/vibetj/.nvm/versions/node/v20.19.2/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin
0 10 * * * cd /Users/vibetj/coding/seo && . /Users/vibetj/coding/seo/.local/meta-capi-daily-monitor.env && /Users/vibetj/coding/seo/scripts/meta-capi-daily-missing-queue-monitor.sh >> /Users/vibetj/coding/seo/data/project/meta-capi-daily-monitor.cron.log 2>&1
```

2026-05-21 23:10 KST 기준 로컬 Mac crontab은 제거했다. 같은 monitor가 로컬과 VM에서 동시에 돌면 Slack 중복 알림이 생길 수 있기 때문이다.

로컬 env 파일 `/Users/vibetj/coding/seo/.local/meta-capi-daily-monitor.env`는 유지한다. 수동 smoke나 로컬 개발 검증 때만 사용한다.

## 알림 기준

운영 `always` 모드에서는 정상 OK 상태도 매일 Slack으로 보낸다. `alert_only`로 되돌릴 경우 Slack을 보내는 조건:

- confirmed-but-no-CAPI count > 0 이고 가장 오래된 후보가 30분 이상 지남
- 최근 1일 CAPI failure > 0
- required API check failed
- duplicate event_id 또는 duplicate order/event key가 0보다 큼

`always` 운영값에서는 정상일 때도 JSON 결과와 Slack 메시지를 함께 남긴다.

30분 grace를 두는 이유:

- 결제완료 직후 1~10분 안에는 CAPI sync가 아직 따라오지 않았을 수 있다.
- 이 상태를 바로 Critical로 보내면 정상 지연도 장애처럼 보인다.
- 따라서 `결제완료가 확인된 뒤 30분이 지나도 CAPI 성공 기록이 없을 때`만 실제 누락 후보로 알린다.

## 다음 액션

1. 2026-05-23 오전 10시 KST 첫 자동 OK 보고가 Slack `growth-signal-bot`에 들어오는지 확인한다.
2. confirmed-but-no-CAPI가 0이면 정상 OK 보고와 전날 ROAS가 표시된다.
3. confirmed-but-no-CAPI가 30분 이상 남아 있으면 Slack이 Critical 알림을 보내고, Codex가 해당 후보를 legacy backlog / fresh sync issue / duplicate already sent / no-send guard 중 하나로 분류한다.
4. Slack 메시지에는 전날 내부 귀속 ROAS와 Meta Ads Manager ROAS가 같이 표시된다.

## 주의

- webhook URL은 토큰과 같으므로 Git에 커밋하지 않는다.
- Slack 앱을 제거하면 webhook은 무효화된다.
- 채널을 지우는 것은 알림을 숨기는 조치일 뿐 원인을 제거하는 조치가 아니다.
- 이 monitor는 Meta로 구매를 보내지 않는다. 오직 read-only 상태 점검과 Slack 알림만 한다.
