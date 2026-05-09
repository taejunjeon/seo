# Path B no-send HMAC 제한 배포 smoke 결과

작성 시각: 2026-05-09 00:06 KST
작업 시작: 2026-05-08 23:58 KST
대상: `https://att.ainativeos.net/api/attribution/order-bridge/identity-hmac/no-send`
Mode: Mode A limited deploy / no-send / no-operational-write / no-platform-send
Lane: Yellow approved execution

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
    - vm/!vm.md
  lane: Yellow approved limited deploy
  allowed_actions:
    - deploy path-limited no-send endpoint
    - inject ORDER_BRIDGE_IDENTITY_HASH_SECRET
    - PM2 1회 restart
    - synthetic smoke
  forbidden_actions:
    - operational schema migration
    - GTM Production publish
    - Imweb production save
    - 1h hash-only canary operational storage
    - raw email/phone/member_code/order storage or logging
    - Google Ads/GA4/Meta/TikTok/Naver send
    - Google Ads conversion upload
    - existing GTM tag pause/delete
  source_window_freshness_confidence:
    source: "VM limited deploy + synthetic curl smoke + PM2 log grep"
    window: "2026-05-09 00:02-00:04 KST"
    freshness: "2026-05-09 00:06 KST"
    confidence: 0.93
```

## 10초 결론

Path B Preview용 HTTPS no-send 수신점 제한 배포는 PASS다.
브라우저가 호출할 endpoint는 열렸고, synthetic smoke에서 200, oversized 413, CORS PASS, raw echo 0, raw logging 0, platform send 0을 확인했다.

이 배포는 주문 저장이나 광고 플랫폼 전송이 아니다. raw email/phone/order는 HMAC 생성을 위한 transient input으로만 들어가고, response/log/storage에는 남기지 않는 구조다.

## 무엇을 했나

- `backend/dist/routes/attribution.js`를 VM에 제한 배포했다.
- `backend/dist/orderBridgeIdentityHmac.js`를 VM에 신규 배포했다.
- `ORDER_BRIDGE_IDENTITY_HASH_SECRET` 존재 여부를 확인하고 없으면 생성했다.
- `seo-backend` PM2를 1회 restart했다.
- synthetic payload로 post-deploy smoke를 실행했다.

## 결과

- 배포 전 `/health`: 200.
- 배포 전 no-send endpoint: 404.
- 배포 후 `/health`: 200.
- 배포 후 no-send endpoint positive request: 200.
- oversized payload: 413 `payload_too_large`.
- CORS preflight: 204, `access-control-allow-origin: https://biocom.kr`.
- response raw echo: 0.
- PM2 out/error log raw match: 0.
- `would_store`: false.
- `would_send`: false.
- `no_platform_send_verified`: true.
- `platform_send_count`: 0.

상세 JSON: `data/path-b-no-send-hmac-limited-deploy-smoke-20260508.json`

## 검증한 hash present 필드

- `email_hash_present`: true.
- `phone_hash_present`: true.
- `order_no_hash_present`: true.
- `client_session_present`: true.
- `click_id_hash_present`: true.

## rollback

백업 위치:

`/home/biocomkr_sns/seo/deploy-backups/20260509-0002_path_b_identity_hmac_no_send`

필요 시 아래 파일을 되돌리면 된다.

- `dist/routes/attribution.js`
- `dist/orderBridgeIdentityHmac.js`

## 하지 않은 것

- 운영DB write를 하지 않았다.
- operational schema migration을 하지 않았다.
- GTM Production publish를 하지 않았다.
- Imweb production save를 하지 않았다.
- 1h hash-only canary 운영 저장을 하지 않았다.
- Google Ads/GA4/Meta/TikTok/Naver 전송을 하지 않았다.
- Google Ads conversion upload를 하지 않았다.
- 기존 GTM tag pause/delete를 하지 않았다.

## 다음 판단

이제 서버 쪽 병목은 닫혔다. 다음 병목은 GTM Preview UI에서 실제 결제완료 화면이 email/phone/order/session/click 후보를 no-send endpoint로 보낼 수 있는지 확인하는 것이다.

Auditor verdict: PASS
Confidence: 93%
