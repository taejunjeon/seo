# NPay Status Sync Decision

harness_preflight:
  common_harness_read: true
  project_harness_read: true
  required_context_docs:
    - AGENTS.md
    - naver/!npay.md
    - naver/!npayroas.md
  lane: Green
  allowed_actions:
    - documentation
    - read_only_analysis
  forbidden_actions:
    - status_sync_write
    - status_sync_cron
    - vm_cloud_write
    - platform_send
  source_window_freshness_confidence: "2026-05-10 KST / VM Cloud SQLite read-only + Imweb status scan / confidence 0.91"

작성: 2026-05-10 KST

## 결정

VM Cloud `sync-order-statuses`는 지금 필수 작업이 아니라 P2 diagnostic로 둔다.

## 이유

ConfirmedPurchasePrep guard는 운영DB `PAYMENT_COMPLETE` 또는 관리자-confirmed source 기준으로 해결할 수 있다. status sync를 먼저 실행하면 VM Cloud write, rollback, cron/publish 승인 문제가 생겨 속도가 느려진다.

또한 NPay 결제완료 직후에는 Imweb lifecycle status가 `STANDBY`일 수 있다. 따라서 status sync가 되더라도 `STANDBY`를 미결제로 차단하면 같은 문제가 반복된다.

## 현재 기준

```text
Primary confirmed source:
  operating_db.payment_status = PAYMENT_COMPLETE
  OR admin_confirmed = true

Auxiliary source:
  Imweb status filter STANDBY / DELIVERING / COMPLETE / PURCHASE_CONFIRMATION

Do not use as block-only source:
  VM Cloud complete_time blank
  VM Cloud imweb_status blank
```

## 후순위로 남기는 작업

P2 diagnostic에서만 아래를 검토한다.

1. status sync endpoint dry-run/runbook.
2. row_count 영향과 rollback.
3. `imweb_status_synced_at` freshness 모니터링.
4. lifecycle status를 confirmed guard가 아니라 보조 설명값으로 쓰는 UI/report 반영.

