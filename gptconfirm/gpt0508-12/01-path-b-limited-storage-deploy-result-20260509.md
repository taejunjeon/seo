# Path B limited storage deploy result

작성 시각: 2026-05-09 17:28 KST
Status: PASS_WITH_CONTROLLED_ONE_OFF_ROUTE_SMOKE

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
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
    - harness/npay-recovery/APPROVAL_GATES.md
    - harness/npay-recovery/AUDITOR_CHECKLIST.md
    - gptconfirm/gpt0508-11/01-path-b-limited-storage-deploy-final-packet-20260509.md
  lane: Yellow approved limited deploy execution
  allowed_actions:
    - VM Cloud limited deploy
    - schema bootstrap
    - PM2 restart 1x
    - flag OFF smoke
    - controlled write smoke 1 row
    - result packaging
  forbidden_actions:
    - 1h storage canary main run
    - GTM Production publish
    - Imweb production save
    - platform send
    - conversion upload
    - raw email/phone/member_code/order/payment storage or logging
  source_window_freshness_confidence:
    source: "VM Cloud deploy/smoke output + local fixture tests"
    window: "2026-05-09 17:18-17:28 KST"
    freshness: "2026-05-09 17:28 KST"
    confidence: 0.9
```

## 한 줄 결론

VM Cloud limited storage deploy와 schema bootstrap은 PASS다. controlled write는 hash-only row 1건 저장, duplicate dedupe, raw 0, platform 0을 확인했다.

## 배포 결과

배포한 파일:

- `dist/orderBridgeIdentityHmac.js`
- `dist/orderBridgeLedger.js`
- `dist/routes/attribution.js`

Backup:

- `/home/biocomkr_sns/seo/deploy-backups/20260509-1719_path_b_limited_storage`

Deployed hash:

- `dist/orderBridgeIdentityHmac.js`: `0e489632e84b47f1d7f5daae50e331606a06f829540cfb3c7f9f3b30b3fb82b1`
- `dist/orderBridgeLedger.js`: `d3a153b86dd0546bf522752652d4bb9a75662493a8843a85abb4906007b4f4a1`
- `dist/routes/attribution.js`: `0797c4f22e59c56af573d8c56996358e3ab07eefcfc91befc3a5d34bc300001e`

PM2:

- status: online.
- restart count after deploy: 3826.
- approved restart used: 1.
- unexpected restart after smoke: 0.

## Schema bootstrap

`GET /api/attribution/order-bridge/ledger/summary` 호출로 `order_bridge_ledger`가 생성됐다.

- table before summary: false.
- summary status: 200.
- table after summary: true.
- initial row_count: 0.

## Env flags after deploy

```text
ORDER_BRIDGE_WRITE_ENABLED=false
ORDER_BRIDGE_WRITE_CANARY_UNTIL=
ORDER_BRIDGE_WRITE_MAX_ROWS=200
ORDER_BRIDGE_PLATFORM_SEND_ENABLED=false
ORDER_BRIDGE_RAW_BODY_LOGGING=false
ORDER_BRIDGE_RETENTION_DAYS=90
```

서비스는 현재 flag OFF다.

## Controlled write caveat

승인 범위의 PM2 restart는 1회였다. 실제 PM2 service에서 endpoint flag ON write를 하려면 `.env`를 true로 바꾼 뒤 추가 restart가 필요하다.

그래서 이번 controlled write는 PM2 service를 계속 flag OFF로 유지하고, VM Cloud에 배포된 dist route를 one-off local process로 띄워 `ORDER_BRIDGE_WRITE_ENABLED=true`를 주입해 실행했다.

의미:

- 배포된 route/module/schema/write path는 검증됐다.
- PM2 service의 live endpoint는 계속 write OFF다.
- 1h canary 본 실행은 아직 하지 않았다.

## 최종 row summary

- row_count: 1.
- unique_order_no_hash: 1.
- unique_email_hash: 1.
- unique_phone_hash: 1.
- unique_click_id_hash: 1.
- raw_stored_count: 0.
- platform_send_count: 0.
- duplicate_dedupe_count: 1.
- service write flag: false.

## 금지선 준수

하지 않았다:

- GTM Production publish.
- Imweb production save.
- 1h storage canary main run.
- real paid-click actual order test.
- Google Ads/GA4/Meta/TikTok/Naver send.
- Google Ads conversion upload.
- raw email/phone/member_code/order/payment storage or logging.
- existing GTM tag pause/delete.
