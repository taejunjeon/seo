# payment-decision query log redaction 제한 배포 승인안

작성 시각: 2026-05-09 01:40 KST
대상: VM Cloud `seo-backend`
요청 유형: Yellow limited deploy approval
상태: approval_ready
Mode: log redaction only / no DB write / no platform send

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
  lane: Yellow deploy approval draft
  allowed_actions:
    - local redaction code review
    - deploy approval document writing
    - post-deploy smoke plan writing
  forbidden_actions:
    - deploy without approval
    - DB write
    - schema migration
    - GTM Production publish
    - platform send
    - conversion upload
  source_window_freshness_confidence:
    source: "VM PM2 read-only grep after real browser Preview"
    window: "2026-05-09 01:34-01:40 KST"
    freshness: "2026-05-09 01:40 KST"
    confidence: 0.88
```

## 10초 결론

Path B no-send endpoint는 raw echo/logging 0으로 PASS다.
하지만 기존 `/api/attribution/payment-decision` GET 로그가 order/payment query를 PM2 log에 남기는 문제가 2건 관측됐다.
이건 AGENT_OS Preview tag 문제가 아니라 기존 backend request logging redaction 문제다.

## 무엇을 바꾸나

운영 backend의 HTTP logger에서 아래 query/url 값을 마스킹한다.

- `orderCode`
- `order_code`
- `orderNo`
- `order_no`
- `orderId`
- `order_id`
- `paymentCode`
- `payment_code`
- `paymentKey`
- `payment_key`
- `amount`
- `email`
- `phone`

목표는 request body를 저장하지 않는 것이 아니라, 이미 들어오는 GET query가 PM2 log에 raw로 찍히지 않게 하는 것이다.

## 왜 필요한가

이번 actual Preview에서 no-send endpoint raw pattern count는 0이었다.
다만 PM2 전체 최근 로그에서 기존 `payment-decision` endpoint가 주문/결제 query를 남긴 것이 확인됐다.

이 상태로 두면 Path B를 안전하게 만들어도 같은 주문완료 화면에서 기존 endpoint가 raw order/payment 값을 계속 로그에 남길 수 있다.

## 승인 범위

승인하면 가능한 작업:

1. `backend/src/bootstrap/configureMiddleware.ts`의 pino-http logging redaction 보강.
2. build/typecheck.
3. VM에 해당 dist 파일 제한 배포.
4. PM2 restart 1회.
5. synthetic `/api/attribution/payment-decision` smoke.
6. PM2 log raw pattern count 0 확인.

## 금지 범위

승인해도 금지:

- DB write.
- schema migration.
- GTM Production publish.
- Imweb production save.
- platform send.
- Google Ads conversion upload.
- Path B storage canary.

## 성공 기준

- `/health`: 200.
- `/api/attribution/payment-decision?...` smoke: 200 또는 기존 정상 응답.
- PM2 log에서 query/url raw pattern count: 0.
- no-send HMAC endpoint 기존 smoke 유지.
- platform send 0.
- DB write 0.

## Hard Fail

- raw order/payment/email/phone이 PM2 log에 계속 보임.
- logger가 요청 전체를 누락해 운영 디버깅이 불가능해짐.
- `/health` 실패.
- payment-decision 응답 실패율 증가.
- platform send 발생.

## 승인 문구

```text
YES: payment-decision query log redaction 제한 배포를 승인합니다.
범위: backend HTTP logger redaction 보강, VM dist 제한 배포, PM2 restart 1회, post-deploy smoke.
금지: DB write, schema migration, GTM publish, platform send, conversion upload, Path B storage canary.
성공 기준: payment-decision raw query가 PM2 log에 남지 않고 /health 및 기존 endpoint smoke가 PASS.
```

Auditor verdict: NEEDS_HUMAN_APPROVAL_FOR_DEPLOY
