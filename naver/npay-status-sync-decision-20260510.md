# NPay Status Sync Decision

harness_preflight:
  common_harness_read: true
  project_harness_read: true
  required_context_docs:
    - AGENTS.md
    - naver/!npay.md
    - naver/!npayroas.md
    - gdn/vm-cloud-imweb-sync-status-review-20260510.md
  lane: Yellow
  allowed_actions:
    - documentation
    - read_only_analysis
    - one_off_vm_cloud_sqlite_backup
    - one_off_status_sync_biocom
    - one_off_status_sync_thecleancoffee
  forbidden_actions:
    - status_sync_cron
    - recurring_vm_cloud_write
    - platform_send
    - Google_Ads_conversion_upload
  source_window_freshness_confidence: "2026-05-10 15:12 KST / VM Cloud SQLite + Imweb status sync one-off / confidence 0.91"

작성: 2026-05-10 15:27 KST

## 결정

2026-05-10 KST에 VM Cloud `sync-order-statuses`를 biocom과 thecleancoffee에 1회 실행했다.

반복 cron/auto sync는 아직 켜지 않는다. 15분/5분 주기 변경은 별도 승인 패킷으로 분리한다.

## 이유

ConfirmedPurchasePrep guard는 운영DB `PAYMENT_COMPLETE` 또는 관리자-confirmed source 기준으로 해결할 수 있다. status sync는 결제완료 판단의 primary가 아니라 Imweb lifecycle 보조값이다.

NPay 결제완료 직후에는 Imweb lifecycle status가 `STANDBY`일 수 있다. 따라서 status sync가 되더라도 `STANDBY`를 미결제로 차단하면 같은 문제가 반복된다.

## full order sync와 status sync의 관계

이번 status sync는 과거 blank `imweb_status`를 채우는 1회 보강이었다.

하지만 새 주문과 상태 변경은 계속 생기므로 이후에도 incremental sync는 필요하다. 즉 “한 번 채웠으니 영구히 안 해도 된다”가 아니라, historical backfill은 1회이고 ongoing freshness는 별도 recent-window sync로 관리해야 한다.

## 실행 결과

VM Cloud SQLite 백업 후 실행했다.

최종 summary:

| site | total_rows | unique_order_no | status_filled | latest_synced_at UTC | latest_status_sync_at UTC |
|---|---:|---:|---:|---|---|
| biocom | 10,712 | 10,712 | 7,755 | 2026-05-10 06:09:23 | 2026-05-10 06:11:55 |
| thecleancoffee | 3,071 | 3,071 | 2,093 | 2026-05-10 06:10:09 | 2026-05-10 06:12:47 |

KST:

- biocom status sync latest: 2026-05-10 15:11:55 KST
- thecleancoffee status sync latest: 2026-05-10 15:12:47 KST

status sync는 이번 범위에서 두 사이트 모두 완료로 본다.

## full order sync 완료 여부

full order sync endpoint는 biocom/thecleancoffee 모두 재시도했지만, current API total 기준으로는 부분 완료로 본다.

```text
biocom: synced 6,363 / totalCount 7,763
thecleancoffee: synced 900 / totalCount 2,093
```

SQLite에는 historical row가 이미 누적되어 있어 총 row 수는 current API total보다 많다. 그러므로 “VM Cloud에 주문 원장이 없다”는 상태는 아니다. 다만 “현재 Imweb API 목록을 끝까지 100% 재수집했다”는 말은 하지 않는다.

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

## 5분 주기 변경 판단

- Codex 추천: 진행 비추천.
- 추천 이유: Imweb API rate-limit/partial sync 정황이 있고, status sync는 결제완료 primary가 아니라 lifecycle 보조값이다. 지금은 15분 주문 sync 유지 + status sync background job 설계가 먼저다.
- 추천 방향에 대한 자신감: 88%.

## 후순위로 남기는 작업

반복 자동화는 아래를 먼저 검토한다.

1. status sync endpoint runbook.
2. row_count 영향과 rollback.
3. `imweb_status_synced_at` freshness 모니터링.
4. cron 대신 app background job으로 넣을지 여부.
5. 30분 또는 15분 시작 후 5분 전환 여부.
6. lifecycle status를 confirmed guard가 아니라 보조 설명값으로 쓰는 UI/report 반영.

상세 검토: [[../gdn/vm-cloud-imweb-sync-status-review-20260510]].
