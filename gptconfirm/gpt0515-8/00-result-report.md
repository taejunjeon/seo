# gpt0515-8 Emergency Meta Purchase Restore Result

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read: []
  required_context_docs:
    - gptconfirm/gpt0515-7/01-backend-guard-deploy-packet.md
  lane: Yellow
  allowed_actions:
    - VM Cloud backend guard/value guard deploy
    - VM Cloud backend restart
    - 운영DB read-only payment decision check
    - VM Cloud SQLite aggregate-only smoke
  forbidden_actions:
    - Meta 운영 Purchase send
    - Pixel direct insert
    - Purchase browser fail-open
    - GTM publish
    - 운영DB write/import
    - VM Cloud schema migration
    - campaign/budget change
    - raw identifier report/chat/telegram/git output
  source_window_freshness_confidence:
    source: "VM Cloud backend + 운영DB PostgreSQL dashboard.public.tb_iamweb_users read-only + VM Cloud SQLite attribution_ledger aggregate"
    window: "deploy window 2026-05-15 03:29-03:43 KST"
    freshness: "live smoke immediately after restart"
    confidence: "high for endpoint guard and payment-decision behavior; medium for Meta UI reflection because Events Manager display can lag"
```

## 사람이 이해하는 결론

오늘 밤 구매 이벤트 복구에서 가장 위험했던 부분을 먼저 막았다. 결제 진행 페이지(`/shop_payment/`)는 더 이상 결제완료로 저장되지 않고, 진짜 결제완료로 확인되는 주문만 브라우저 Purchase를 통과시킬 수 있게 VM Cloud backend를 배포했다.

이제 Header Purchase Guard가 `payment-decision`을 물어봤을 때, 운영DB `dashboard.public.tb_iamweb_users`에서 `PAYMENT_COMPLETE + 양수 금액 + 취소/환불 없음`으로 닫히면 `allow_purchase`가 나온다. 반대로 무통장/가상계좌처럼 결제완료가 아닌 row는 `block_purchase_virtual_account`로 내려가며 Purchase로 올라가지 않는다.

## 완료한 것

- VM Cloud backend 파일 배포/restart 완료.
- `payment_page_seen` endpoint 추가/확인.
- `/api/attribution/payment-success`가 `/shop_payment/` payload를 받으면 `payment_page_seen`으로 downgrade하도록 확인.
- `payment-decision`에 운영DB 결제완료 direct match를 추가.
- value guard/no-send guard 유지 확인.
- 실제 운영DB 결제완료 후보 1건 read-only dry-run에서 `allow_purchase` 확인.
- 실제 운영DB 미입금/가상계좌 계열 후보 1건 read-only dry-run에서 `block_purchase_virtual_account` 확인.

## 실제 숫자와 smoke

- `/health`: 200 OK.
- `POST /api/attribution/payment-page-seen`: 201, receiver `payment_page_seen`.
- `POST /api/attribution/checkout-context` with `metadata.semantic_touchpoint=payment_page_seen`: 201, receiver `payment_page_seen`.
- `POST /api/attribution/payment-success` with `/shop_payment/`: 202 downgrade, receiver `payment_page_seen`.
- completion URL `payment_success`: 201, receiver `payment_success`, default pending.
- VM Cloud SQLite `attribution_ledger` last 10m aggregate:
  - `payment_page_seen_recent`: 6
  - `/shop_payment/ payment_success_recent`: 0
  - `page_seen_non_purchase_recent`: 6
- 운영DB 결제완료 dry-run:
  - `decision_status=confirmed`
  - `browser_action=allow_purchase`
  - `matched_by=operational_db_order_number`
- 운영DB 미입금/가상계좌 dry-run:
  - `decision_status=pending`
  - `browser_action=block_purchase_virtual_account`
  - `matched_by=operational_db_order_number`
- Meta CAPI send log last 15m:
  - operational send 0
  - manual send 0
  - test event 0

## 변경 파일

- `backend/src/attribution.ts`
- `backend/src/attributionLedgerDb.ts`
- `backend/src/metaCapi.ts`
- `backend/src/routes/attribution.ts`
- `backend/src/siteLandingFanout.ts`
- `backend/tests/attribution.test.ts`

## 검증 결과

- 로컬 `npm --prefix backend run typecheck`: PASS.
- 로컬 `node --test --import tsx tests/attribution.test.ts`: PASS, 43/43.
- VM Cloud `npm run typecheck`: PASS.
- VM Cloud `npm run build`: PASS.
- VM Cloud `TZ=Asia/Seoul node --test --import tsx tests/attribution.test.ts`: PASS, 43/43.
- VM Cloud `seo-backend`: restarted and online.

## Rollback

Primary backup:

```bash
/home/biocomkr_sns/seo/repo/.deploy-backups/gpt0515-8-20260515T033052KST
```

Hotfix backup:

```bash
/home/biocomkr_sns/seo/repo/.deploy-backups/gpt0515-8-pending-hotfix-20260515T033841KST
```

Rollback command shape:

```bash
sudo -n -u biocomkr_sns bash -lc '
set -euo pipefail
export PATH=/home/biocomkr_sns/seo/node/bin:/usr/local/bin:/usr/bin:/bin:$PATH
cd /home/biocomkr_sns/seo/repo
BACKUP=/home/biocomkr_sns/seo/repo/.deploy-backups/gpt0515-8-20260515T033052KST
cp "$BACKUP/backend/src/attribution.ts" backend/src/attribution.ts
cp "$BACKUP/backend/src/attributionLedgerDb.ts" backend/src/attributionLedgerDb.ts
cp "$BACKUP/backend/src/metaCapi.ts" backend/src/metaCapi.ts
cp "$BACKUP/backend/src/routes/attribution.ts" backend/src/routes/attribution.ts
cp "$BACKUP/backend/src/siteLandingFanout.ts" backend/src/siteLandingFanout.ts
cp "$BACKUP/backend/tests/attribution.test.ts" backend/tests/attribution.test.ts
cd backend
npm run build
pm2 restart seo-backend --update-env
'
```

## 하지 않은 것

- Meta 운영 Purchase 수동/대량 backfill send: 0.
- Pixel 전체 직접 삽입: 0.
- Purchase browser fail-open: 0.
- GTM publish: 0.
- 운영DB write/import: 0.
- VM Cloud schema migration: 0.
- campaign/budget 변경: 0.
- raw identifier report/chat/telegram/git 출력: 0.

## 남은 리스크

- Meta Events Manager UI는 20분 이상 지연될 수 있으므로, 실제 화면의 Purchase count 반영은 별도 관찰이 필요하다.
- Browser Purchase가 실제 완료 URL에서 뜨려면 아임웹 완료 URL 패턴이 allowlist와 맞아야 한다. 이번 smoke는 backend와 decision 계층 검증이다.
- 현재 CAPI auto-sync는 켜져 있지만 value guard/no-send guard가 있어 이번 배포 smoke row는 Meta send 후보가 아니다.

## 다음 행동

1. TJ님은 실제 결제완료 테스트 없이, 다음 실제 고객 결제완료가 발생한 뒤 Meta Events Manager에서 Purchase 최신 수신 시간이 갱신되는지 확인한다. 성공 기준은 Purchase가 browser 또는 server에 새로 표시되고, 미입금/가상계좌 주문에서 Purchase가 늘지 않는 것이다.
2. Codex는 30-60분 뒤 VM Cloud read-only로 `payment-decision` 결과 분포와 Meta CAPI send log를 다시 확인한다. 성공 기준은 `allow_purchase`가 실제 결제완료에만 나오고, `payment_page_seen`이 Purchase 후보 0을 유지하는 것이다.
3. 만약 실제 결제완료 후에도 Purchase가 계속 0이면, 좁은 fail-open이 아니라 먼저 completion URL 패턴과 Header Guard 호출 payload를 read-only로 확인한다.

## Telegram

5줄 요약 발송 대상. raw identifier 없음.
