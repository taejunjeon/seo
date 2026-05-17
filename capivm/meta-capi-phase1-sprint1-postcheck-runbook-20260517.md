# Meta CAPI Phase1-Sprint1 Post-check Runbook

작성 시각: 2026-05-17 12:27 KST
기준일: 2026-05-17
문서 목적: VM Cloud에 Meta CAPI 후보 guard를 반영한 뒤, 실제 결제완료만 Purchase 후보로 남는지 반복 확인하는 실행 절차를 고정한다.
문서 성격: Green runbook + read-only script 안내. `ALLOW_LIVE_SMOKE=1`은 승인된 VM Cloud 배포 직후 Yellow post-check 안에서만 사용한다.

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - capivm/!capiplan.md
    - data/!data_inventory.md
  required_context_docs:
    - capivm/!capiplan.md
  lane: "Green by default; optional Yellow only when ALLOW_LIVE_SMOKE=1 after approved VM Cloud deploy"
  allowed_actions:
    - "VM Cloud API read-only smoke"
    - "Meta CAPI send log aggregate read"
    - "local JSON evidence write under data/project"
    - "optional diagnostic insert <=2 rows only inside approved Yellow post-check"
  forbidden_actions:
    - "Meta 운영 Purchase 추가 send/backfill"
    - "Google Ads/GA4/TikTok/Naver send or upload"
    - "운영DB write/import"
    - "GTM publish"
    - "raw order/payment/click/member/email/phone output"
  source_window_freshness_confidence:
    source: "VM Cloud /health + funnel-health aggregate + Meta CAPI send log aggregate"
    window: "default 7d, override by META_CAPI_POSTCHECK_WINDOW"
    freshness: "script execution time + API cache metadata"
    confidence: "high for API contract, medium for business queue until current window monitor is clean"
```

## 10초 요약

이 runbook은 **배포 후 Meta에 잘못된 구매가 들어가지 않는지 보는 체크리스트**다.
기본 실행은 읽기 전용이다.
스크립트는 VM Cloud backend health, funnel-health contract, site/pixel filter, raw identifier guard, Meta CAPI send log aggregate, confirmed-but-unsent queue를 한 번에 확인한다.
`ALLOW_LIVE_SMOKE=1`을 켜면 `/payment-page-seen`과 `/shop_payment/ downgrade`를 실제 endpoint로 확인하지만, 이 모드는 승인된 배포 post-check에서만 쓴다.

## 성공 기준

1. VM Cloud backend `/health`가 200이다.
2. `/api/attribution/funnel-health?site=biocom&window=7d`가 200이고 `ok=true`다.
3. metric contract에 `source`, `unit`, `window`, `site`, `pixel_id`가 보인다.
4. `site=biocom`은 Pixel `1283400029487161`만 집계한다.
5. raw identifier output, platform send, 운영DB write가 모두 0이다.
6. Meta CAPI send log aggregate를 읽을 수 있다.
7. confirmed-but-unsent queue가 count/amount aggregate로 보인다.
8. Yellow smoke를 켰을 때 `/payment-page-seen`은 201, `/shop_payment/`로 들어온 `/payment-success`는 202 downgrade다.

## 스크립트

파일:

```bash
scripts/meta-capi-phase1-sprint1-postcheck.sh
```

기본 실행:

```bash
scripts/meta-capi-phase1-sprint1-postcheck.sh
```

출력:

```bash
data/project/meta-capi-phase1-sprint1-postcheck-<run_label>.json
```

기본값:

```text
BASE_URL=https://att.ainativeos.net
SITE=biocom
WINDOW=7d
PIXEL_ID=1283400029487161
ALLOW_LIVE_SMOKE=0
```

## 실행 모드

### 1. 기본 read-only 모드

무엇을 하는가:
VM Cloud가 살아 있는지, 바이오컴 Pixel만 보고 있는지, CAPI 성공 로그와 누락 큐가 aggregate로 보이는지 확인한다.

왜 하는가:
배포 전후에 화면 숫자가 흔들려도, 최소한 “source/unit/window/site/pixel 기준이 같은지”를 고정해야 한다.

어떻게 하는가:

```bash
scripts/meta-capi-phase1-sprint1-postcheck.sh
```

성공 기준:
`verdict=PASS` 또는 `verdict=PASS_WITH_NOTES`.
`PASS_WITH_NOTES`는 API contract는 정상이나 confirmed-but-unsent queue 같은 운영 확인 항목이 남았다는 뜻이다.

실패 시 다음 확인점:
`FAIL`이면 output JSON의 `checks`에서 `required=true`이면서 `pass=false`인 항목을 먼저 본다.
health/API 5xx면 VM Cloud backend 상태를 먼저 본다.
site/pixel filter가 틀리면 funnel-health contract를 먼저 본다.

승인 필요 여부:
없음. read-only다.

### 2. 승인된 배포 직후 Yellow smoke 모드

무엇을 하는가:
배포 후 새 endpoint와 downgrade guard가 실제 live backend에서 작동하는지 확인한다.

왜 하는가:
`payment_page_seen` endpoint와 `/shop_payment/ payment-success downgrade`는 API read-only만으로는 실제 receiver 동작을 보장할 수 없다.

어떻게 하는가:

```bash
ALLOW_LIVE_SMOKE=1 scripts/meta-capi-phase1-sprint1-postcheck.sh
```

성공 기준:
`payment_page_seen_smoke`가 201이고 `receiver=payment_page_seen`.
`shop_payment_downgrade_smoke`가 202이고 `downgraded=true`, `receiver=payment_page_seen`.

실패 시 다음 확인점:
201/202가 아니면 route deploy 여부, CORS, endpoint path, `metadata.semantic_touchpoint` 파싱을 확인한다.
downgrade가 되지 않으면 `/shop_payment/` payload가 Purchase 후보로 오염될 수 있으므로 rollback 또는 guard fix를 우선한다.

승인 필요 여부:
Yellow 승인 필요.
이 모드는 VM Cloud ledger에 postcheck diagnostic row를 최대 2개 남긴다.
외부 플랫폼 전송은 하지 않는다.

## 결과 해석

### PASS

필수 contract와 guard가 모두 통과했고, 운영상 즉시 볼 큐도 없다.
다음은 24-48시간 current window 모니터링으로 넘어간다.

### PASS_WITH_NOTES

필수 contract는 통과했지만 confirmed-but-unsent queue, CAPI failure count, duplicate estimate 같은 운영 확인 항목이 남았다.
이 상태에서는 자동 backfill을 하지 않는다.
먼저 current row인지 legacy row인지, `보관만, 전송하지 않음`인지, 실제 재전송 후보인지 분류한다.

### FAIL

필수 contract가 실패했다.
VM Cloud health, funnel-health API, site/pixel filter, raw output guard, CAPI log read 중 하나가 깨진 상태다.
배포 직후 FAIL이면 rollback 판단 대상이다.

## Cron 판단

지금 바로 cron 등록은 하지 않는다.

이유:
Phase1-Sprint1 100% 판단은 배포 직후 1회 post-check와 24-48시간 current queue 모니터링이면 충분하다.
cron으로 이 스크립트를 계속 돌리면 `data/project` 증거 파일이 과하게 쌓이고, 문제 발생 시 경고 채널을 따로 설계해야 한다.

추천:

1. VM Cloud 배포 직후 `ALLOW_LIVE_SMOKE=1`로 1회 실행한다.
2. 다음 24-48시간 동안 read-only 모드로 수동 2-3회 확인한다.
3. 그 뒤에도 current missing queue가 운영 KPI라면 cron을 별도 Yellow 승인안으로 만든다.

cron을 만든다면:

```text
주기: 1시간 또는 4시간
모드: ALLOW_LIVE_SMOKE=0 read-only only
저장: latest JSON + 최근 N개 rotate
알림: FAIL 또는 current critical queue 증가 때만
```

## 하지 않는 것

- Meta 운영 Purchase 추가 send/backfill을 하지 않는다.
- Google Ads, GA4, TikTok, Naver에 전송하지 않는다.
- 운영DB에 write/import하지 않는다.
- GTM publish하지 않는다.
- raw order/payment/click/member/email/phone 값을 출력하지 않는다.
- legacy backlog를 자동 전송하지 않는다.

## 다음 행동

### Auto Green

1. Codex가 기본 read-only 모드로 스크립트를 실행한다.
   - 무엇: VM Cloud API contract와 CAPI send log aggregate를 확인한다.
   - 왜: 배포 전 기준 상태를 알아야 배포 후 차이를 볼 수 있다.
   - 어떻게: `scripts/meta-capi-phase1-sprint1-postcheck.sh`.
   - 성공 기준: `FAIL`이 없고 output JSON이 생성된다.
   - 실패 시 다음 확인점: health/API 5xx, CAPI log endpoint 권한, site/pixel filter.
   - 승인 필요 여부: 없음.
   - 산출물: `data/project/meta-capi-phase1-sprint1-postcheck-<run_label>.json`.
   - 진척률에 미치는 영향: KR1 live post-check 준비 완료 근거.

### Approval Needed

1. VM Cloud 배포 직후 Codex가 Yellow smoke 모드를 1회 실행한다.
   - 무엇: `payment_page_seen` endpoint와 `/shop_payment/ downgrade guard`를 live backend에서 확인한다.
   - 왜: 결제 진행 페이지가 다시 Purchase 후보로 오염되는지 바로 봐야 한다.
   - 어떻게: 승인된 배포 직후 `ALLOW_LIVE_SMOKE=1 scripts/meta-capi-phase1-sprint1-postcheck.sh`.
   - 성공 기준: 201 page_seen, 202 downgrade, external send 0.
   - 실패 시 다음 확인점: route deploy 누락, downgrade guard 누락, rollback 필요성.
   - 승인 필요 여부: Yellow. diagnostic row 최대 2개가 VM Cloud ledger에 남는다.
   - 산출물: post-check JSON과 배포 결과 보고.
   - 진척률에 미치는 영향: KR1 96%에서 100%로 올릴 수 있는 핵심 근거.

### Blocked/Parked

1. Cron 등록은 보류한다.
   - 무엇: 이 post-check script를 주기 실행으로 등록하는 일.
   - 왜: 배포 직후 검증과 상시 모니터링은 목적이 다르다. 현재는 1회 post-check가 먼저다.
   - 어떻게: 필요해지면 별도 runbook에서 `ALLOW_LIVE_SMOKE=0`, rotate, alert 조건을 정의한다.
   - 성공 기준: FAIL 또는 current critical queue 증가 때만 알림.
   - 실패 시 다음 확인점: 과도한 파일 생성, 중복 알림, VM load 증가.
   - 승인 필요 여부: Yellow.
   - 산출물: cron 승인안.
   - 진척률에 미치는 영향: KR2 daily monitor 성숙도에 영향, KR1 100%에는 필수 아님.
