# paid_click_intent canary 24h capture health audit

작성 시각: 2026-05-08 17:38 KST
최종 업데이트: 2026-05-08 18:40 KST
대상: VM Cloud `crm.sqlite3#paid_click_intent_ledger`
canary 시작: 2026-05-07 23:01 KST
24h 도달 예정: 2026-05-08 23:01 KST
문서 성격: Green Lane read-only audit packet. 24h 전 작성이므로 현재 상태는 `pending_time_gate`.
관련 문서: [[canary-effect-meaningful-dry-run-20260508]], [[paid-click-intent-ledger-canary-early-audit-20260508]], [[../total/!total-current]], [[../data/!channelfunnel]]
Status: pending_time_gate
Do not use for: confirmed_purchase uplift 판정, Google Ads/GA4/Meta/TikTok/Naver 전송, conversion upload, conversion action 변경, 운영 deploy, GTM/Imweb publish

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
    - total/!total-current.md
    - data/!channelfunnel.md
  lane: Green
  allowed_actions:
    - Attribution VM SQLite read-only SELECT
    - PM2/cloudflared log read-only check
    - local JSON/Markdown artifact write
    - no-send capture health audit
  forbidden_actions:
    - backend deploy or PM2 restart
    - production DB write/schema migration
    - GTM/Imweb publish
    - platform send
    - Google Ads conversion action/change/upload
  source_window_freshness_confidence:
    source: "live paid_click_intent_ledger + canary-effect-meaningful-dry-run 18.4h baseline"
    window: "2026-05-07 23:01~2026-05-08 23:01 KST planned"
    freshness: "18.4h baseline generated 2026-05-08 17:23 KST; 24h rerun not reached at document creation"
    confidence: 0.93
```

## 한 줄 결론

24h 재실행의 목적은 **구매 매칭 개선 효과가 아니라 수집기가 잘 작동하는지 보는 건강검진**이다. 현재 주문과 클릭을 1:1로 이어주는 결정적 연결키가 없으므로 24h가 되어도 주문별 uplift는 자동 측정되지 않고, `member_code_hash` 또는 동등한 bridge 전까지 HOLD다.

## 용어 번역

| 내부 용어 | 사람 말 |
|---|---|
| capture health | 수집기가 잘 작동하는지 보는 건강검진 |
| effect/uplift | 구매 매칭 개선 효과 |
| deterministic bridge | 주문과 클릭을 1:1로 이어주는 결정적 연결키 |
| Path C | `member_code_hash`로 주문과 광고 클릭을 직접 연결하는 경로 |

## 이 문서가 말하는 것 / 말하지 않는 것

말하는 것:

- 광고 click id가 ledger에 계속 쌓이는지.
- `landing`, `checkout_start`, `npay_intent` 단계가 모두 들어오는지.
- debug/test/preview row, PII/value/order/payment row, platform send가 0인지.
- 5xx와 PM2 restart가 canary 안정성을 해치지 않는지.

말하지 않는 것:

- Google Ads ROAS gap이 줄었는지.
- 구매 매칭이 늘었는지.
- NPay actual confirmed attribution이 좋아졌는지.
- confirmed_purchase upload 후보가 충분한지.

## 1. 현재 18.4h baseline

출처: [[canary-effect-meaningful-dry-run-20260508]]

| metric | value |
|---|---:|
| window | 2026-05-07 23:01~2026-05-08 17:23 KST |
| elapsed_hours | 18.4 |
| ledger_rows | 709 |
| unique_click_id_hash | 428 |
| unique_client_id | 318 |
| unique_ga_session_id | 407 |
| landing | 461 |
| checkout_start | 135 |
| npay_intent | 113 |
| click_id_type.gclid | 707 |
| click_id_type.wbraid | 2 |
| status.received | 709 |
| debug/test/preview query key rows | 0 |
| send_candidate | 0 |

## 2. 24h audit에서 볼 것

| 영역 | 지표 | PASS 기준 | HOLD/FAIL 기준 |
|---|---|---|---|
| Row growth | `ledger_rows` | 18.4h 대비 자연 증가, stage drift 없음 | row 정체가 길거나 비정상 폭증 |
| Click id coverage | `unique_click_id_hash` | unique row 증가와 큰 괴리 없음 | duplicate 폭증 또는 click id empty 증가 |
| Session evidence | `unique_client_id`, `unique_ga_session_id` | landing/checkout/NPay 모두 보존 | 특정 stage에서 session id 급감 |
| Stage coverage | `landing`, `checkout_start`, `npay_intent` | 3 stage 모두 존재 | checkout_start 또는 npay_intent 0/급감 |
| Guard | debug/test/preview row | 0 | 1 이상이면 원인 확인 |
| Platform send | no platform send | 0건 | 1건 이상이면 FAIL |
| Backend health | paid-click-intent 5xx | 0 또는 < 1% | >= 1% 또는 burst 재발 |
| Process health | PM2 restart | 추가 restart 0 | restart 증가 시 HOLD/FAIL |
| Privacy guard | PII/value/order/payment 저장 | 0 | 1 이상이면 FAIL |

## 3. 24h 재실행 명령

24h 도달 후에만 실행한다. 2026-05-08 23:01 KST 전에는 이 명령의 결과를 24h audit으로 쓰지 않는다.

```bash
npx tsx backend/scripts/canary-effect-meaningful-dry-run.ts \
  --start=2026-05-07T23:01:00+09:00 \
  --end=2026-05-08T23:01:00+09:00 \
  --output=data/canary-capture-health-24h-20260508.json \
  --markdown-output=gdn/canary-capture-health-24h-20260508.generated.md
```

PM2/5xx/read-only 보조 확인:

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes taejun@34.64.104.94 \
  "sudo -n -u biocomkr_sns bash -lc 'export PATH=/home/biocomkr_sns/seo/node/bin:$PATH; pm2 jlist'"
```

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes -o BatchMode=yes taejun@34.64.104.94 \
  "sudo -n -u biocomkr_sns bash -lc 'sqlite3 -json /home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3 \"SELECT COUNT(*) AS rows, MIN(received_at) AS min_received_at, MAX(received_at) AS max_received_at FROM paid_click_intent_ledger WHERE site=''biocom'' AND received_at >= ''2026-05-07T14:01:00.000Z'' AND received_at < ''2026-05-08T14:01:00.000Z'';\"'"
```

## 4. 판정 규칙

### PASS

- 24h window가 정확히 닫혔다.
- ledger/stage/session/click id가 자연 증가했다.
- debug/test/preview row 0.
- PII/value/order/payment 저장 0.
- no platform send 0.
- paid-click-intent 5xx < 1%.
- PM2 추가 restart 0 또는 원인이 deploy/운영 restart로 명확하다.

### HOLD

- capture health는 정상이나 PM2/5xx/source freshness 중 하나가 불명확하다.
- stage 분포가 급변했지만 원인을 아직 확인하지 못했다.
- deterministic bridge가 없어 confirmed_purchase uplift는 계속 HOLD다.

### FAIL

- platform send가 1건 이상 발생.
- PII/value/order/payment 저장 확인.
- paid-click-intent 5xx가 1% 이상 또는 반복 burst.
- PM2 restart가 canary 안정성을 해칠 만큼 증가.

## 5. 반드시 분리할 것

| 판단 | 24h audit에서 가능? | 이유 |
|---|---|---|
| receiver/capture health | YES | ledger row와 backend health로 판단 가능 |
| checkout/NPay intent capture 존재 | YES | stage 분포로 판단 가능 |
| confirmed purchase uplift | NO | 주문과 ledger 사이 deterministic bridge 없음 |
| Google Ads 학습 개선 | NO | platform send/upload 없음 |
| Path C member_code uplift | NO | `member_code_hash` 저장 전 |

## 6. 다음 액션

1. 2026-05-08 23:01 KST 이후 본 문서의 명령을 실행한다.
2. `gdn/canary-capture-health-24h-20260508.generated.md`의 capture health 숫자를 이 문서 또는 후속 결과 문서에 반영한다.
3. PASS여도 confirmed_purchase uplift는 쓰지 않는다. uplift는 Path C v2 deterministic bridge 이후 재측정한다.
