# Path B 1h hash-only storage canary result

작성 시각: 2026-05-09 10:35 KST
Status: BLOCKED_NOT_EXECUTED

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
    - gdn/path-b-storage-canary-runbook-20260509.md
  lane: Yellow approved precheck; execution blocked
  allowed_actions:
    - VM read-only precheck
    - synthetic no-send smoke
    - local code implementation
    - fixture tests
    - reporting
  forbidden_actions:
    - unsafe storage canary execution
    - operational schema migration
    - backend deploy without final deploy approval
    - platform send
    - raw logging
  source_window_freshness_confidence:
    source: "VM read-only checks and local fixture tests"
    window: "2026-05-09 10:18-10:35 KST"
    freshness: "2026-05-09 10:35 KST"
    confidence: 0.9
```

## 한 줄 결론

Path B 저장 canary는 승인됐지만, 운영에 저장 경로가 없어 **실행하지 않았다.** no-send endpoint는 정상이고, 로컬 hash-only 저장 구현과 fixture는 PASS했다.

## 무엇을 확인했나

VM Cloud에서 아래를 read-only로 확인했다.

- PM2 app `seo-backend` online.
- `/health` HTTP 200.
- `ORDER_BRIDGE_IDENTITY_HASH_SECRET` present.
- `ORDER_BRIDGE_WRITE_*` env missing.
- `order_bridge_ledger` table missing.
- deployed route has `/api/attribution/order-bridge/identity-hmac/no-send`.
- deployed route does not have order bridge write path.
- no-send synthetic smoke HTTP 200.
- oversized payload HTTP 413.
- raw echo 0.
- PM2 email-like raw log count 0 -> 0.
- platform send 0.

## 왜 실행하지 않았나

저장 canary는 `ORDER_BRIDGE_WRITE_ENABLED=true`가 실제 row 저장으로 연결될 때만 의미가 있다. 현재 운영에는 그 연결이 없다.

지금 강제로 `.env`에 flag만 추가해도 저장 row는 생기지 않는다. 반대로 테이블/코드를 즉석에서 배포하면 backend deploy와 schema bootstrap이 되므로 별도 승인 범위를 넘어선다.

따라서 안전한 판정은 `BLOCKED_NOT_EXECUTED`다.

## 로컬 보강 결과

로컬 구현 초안:

- `backend/src/orderBridgeLedger.ts`
- `backend/src/orderBridgeIdentityHmac.ts`
- `backend/src/routes/attribution.ts`
- `backend/tests/order-bridge-identity-hmac.test.ts`

Fixture result:

- email/phone normalize PASS.
- HMAC preview PASS.
- route no-send PASS.
- oversized 413 PASS.
- write flag ON local canary row PASS.
- duplicate dedupe PASS.
- raw echo 0 PASS.
- raw stored 0 PASS.
- platform send 0 PASS.

## 현재 채점

- no-send Preview 기준: 100% PASS.
- 로컬 저장 구현 기준: PASS.
- 운영 저장 canary 기준: BLOCKED.
- 전체 Path B bridge 기준: 약 97% 유지.
- 운영 100%까지 남은 핵심: 제한 deploy + schema bootstrap + 1h 저장 row 수집.

## 금지선 준수

하지 않았다:

- GTM Production publish.
- Imweb production save.
- backend operational deploy.
- operational schema migration.
- raw email/phone/member_code/order/payment 저장.
- raw email/phone/member_code/order/payment logging.
- Google Ads/GA4/Meta/TikTok/Naver 전송.
- Google Ads conversion upload.
- 기존 GTM tag pause/delete.

## 다음 판단

다음 승인 후보는 **Path B limited storage deploy**다. 이 승인은 1h canary 자체보다 한 단계 앞의 실행 전제다.

승인 범위에 포함해야 할 것:

- local diff deploy.
- `order_bridge_ledger` table bootstrap.
- `ORDER_BRIDGE_WRITE_ENABLED=false` 기본 deploy.
- smoke.
- 이후 별도 1h window에서 `ORDER_BRIDGE_WRITE_ENABLED=true`.
- PM2 restart 1회 허용 여부.
- GTM Production publish 없이 어떤 traffic source로 row를 만들지 결정.
