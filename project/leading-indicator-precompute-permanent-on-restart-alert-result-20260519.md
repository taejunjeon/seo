# Leading Indicators Precompute Permanent ON + Restart Alert Result — 2026-05-19

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
  required_context_docs:
    - project/leading-indicator-precompute-cache-on-approval-20260519.md
    - project/leading-indicator-precompute-cache-smoke-result-20260519.md
  lane: red_approved_execution
  allowed_actions:
    - set LEADING_INDICATORS_PRECOMPUTE_ENABLED=1
    - set LEADING_INDICATORS_PRECOMPUTE_INTERVAL_MS=1800000
    - restart seo-backend
    - persist PM2 process list
    - install VM-local restart monitor cron
    - read-only API smoke
  forbidden_actions:
    - Meta send/backfill
    - GA4/Google/TikTok/Naver send/upload
    - 운영DB write/import
    - VM Cloud schema migration
    - GTM publish
    - Imweb header/footer change
    - raw identifier output
  source_window_freshness_confidence:
    source: VM Cloud PM2 env/status/log + leading-indicators API
    window: 2026-05-19 KST post-check
    freshness: live
    confidence: high
```

## 이번에 가능해진 것

`GET /api/attribution/leading-indicators`의 주요 조합을 백엔드가 30분 간격으로 사전 계산하는 모드가 VM Cloud에서 상시 켜졌다. 이제 선행지표 화면이 매번 무거운 실시간 계산을 기다리지 않고, 메모리 precompute cache를 읽을 수 있다.

## 실행 결과

- `seo-backend` PM2 환경에 `LEADING_INDICATORS_PRECOMPUTE_ENABLED=1` 적용.
- `LEADING_INDICATORS_PRECOMPUTE_INTERVAL_MS=1800000` 적용.
- VM Cloud `capivm/ecosystem.config.cjs`에도 같은 값을 반영해 재시작/PM2 resurrect 후에도 유지되게 했다.
- `seo-backend`를 의도적으로 1회 restart하고 `pm2 save` 완료.
- VM-local restart monitor 설치:
  - script: `/home/biocomkr_sns/seo/monitoring/leading-indicators-restart-alert.sh`
  - cron: `*/5 * * * *`
  - log: `/home/biocomkr_sns/seo/monitoring/leading-indicators-restart-alert.log`

## Post-check

### PM2

```text
seo-backend: online
restart count: 4275
LEADING_INDICATORS_PRECOMPUTE_ENABLED: 1
LEADING_INDICATORS_PRECOMPUTE_INTERVAL_MS: 1800000
NODE_ENV: production
PORT: 7020
```

### API

```json
{
  "schema_version": "leading-indicators-v1",
  "cache_source": "in_memory_precompute",
  "cached": true,
  "raw_identifier_output": false,
  "aggregate_only": true,
  "confirmed_buyer_sessions": 184,
  "checkout_non_buyer_sessions": 195,
  "ga4_purchase_conflict_sessions": 0,
  "pending_payment_success_sessions": 31
}
```

### Restart monitor

모니터가 실제 restart count 변화를 감지했다.

```text
2026-05-19 10:38:36 KST
restart changed prev=4274 current=4275
cache_source=in_memory_precompute
cached=true
raw_identifier_output=false
aggregate_only=true
```

이후 재확인 로그:

```text
2026-05-19 10:42:39 KST
OK restarts=4275
enabled=1
interval=1800000
cache_source=in_memory_precompute
cached=true
```

## 하지 않은 것

- Meta CAPI, GA4, Google Ads, TikTok, Naver로 새 이벤트를 보내지 않았다.
- 운영DB write/import는 하지 않았다.
- VM Cloud schema migration은 하지 않았다.
- GTM publish나 Imweb header/footer 수정은 하지 않았다.
- raw order/payment/member/click id는 출력하지 않았다.

## 주의점

VM에 Telegram/Webhook 환경변수는 확인되지 않았다. 따라서 현재 restart alert는 VM 내부 cron/log 기준으로 동작한다. 외부 푸시 알림까지 하려면 `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` 또는 `LEADING_INDICATORS_ALERT_WEBHOOK`을 VM 환경에 주입해야 한다.

## 권한 요청 줄이는 방법

채팅형 Codex는 로컬 CLI의 `--dangerously-bypass-approvals-and-sandbox` 모드를 스스로 켤 수 없다. SSH/네트워크 작업은 승인 또는 승인된 prefix가 필요하다. 대신 이번처럼 VM 안에 제한된 운영 스크립트를 설치해 두고 Codex가 그 스크립트만 실행하게 만들면 승인 요청 수를 줄일 수 있다.

권장 다음 단계:

1. VM에 `/home/biocomkr_sns/seo/ops/codex-safe-ops.sh`를 만들고 허용 작업을 subcommand로 제한한다.
2. Codex는 `codex-safe-ops.sh leading-indicators-status`, `codex-safe-ops.sh leading-indicators-restart-monitor`처럼 고정 명령만 호출한다.
3. 위험 작업은 subcommand 내부에서만 수행하고, 외부 send/write/publish는 별도 승인 없이 실행되지 않게 한다.

## 다음 확인

1. 30분 뒤 cache refresh가 계속 `ok`인지 확인한다.
2. 6-12시간 동안 restart count가 추가 증가하는지 확인한다.
3. 외부 푸시 알림이 필요하면 VM 환경변수 또는 로컬 watcher 중 하나로 연결한다.
