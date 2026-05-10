# VM Cloud Imweb Sync / Status Sync Review

harness_preflight:
  common_harness_read: true
  project_harness_read: true
  required_context_docs:
    - AGENTS.md
    - CLAUDE.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
    - naver/!npay.md
    - naver/!npayroas.md
  lane: Yellow
  allowed_actions:
    - vm_cloud_read_only_inspection
    - vm_cloud_sqlite_backup
    - one_off_imweb_order_sync_retry
    - one_off_imweb_status_sync
    - documentation
  forbidden_actions:
    - 운영DB_write
    - GTM_Production_publish
    - platform_conversion_send
    - Google_Ads_conversion_upload
    - cron_or_auto_sync_enable_without_separate_approval
  source_window_freshness_confidence: "2026-05-10 15:12 KST / VM Cloud health + SQLite + one-off sync retries / confidence 0.91"

작성: 2026-05-10 15:24 KST

## 5줄 요약

1. VM Cloud의 Imweb 주문 목록 자동 sync는 켜져 있고 15분 주기다: `/health` 기준 `IMWEB_AUTO_SYNC_INTERVAL_MS=900000`, `maxPage=30`.
2. Imweb lifecycle status sync는 주문 목록 sync와 별도다. 현재 코드에는 `/api/crm-local/imweb/sync-order-statuses` 수동 endpoint만 있고, cron/auto job은 없다.
3. 2026-05-10에 VM Cloud SQLite 백업 후 biocom/thecleancoffee status sync를 1회 실행했다. status sync는 두 사이트 모두 완료로 본다.
4. full order sync도 두 사이트 모두 재시도했지만 `synced < totalCount`라서 “현재 Imweb API 전체 목록을 100% 재수집 완료”로 단정하지 않는다. 기존 SQLite row가 current API total보다 많으므로 운영 판단에는 충분하지만, sync 엔진 진단은 별도 P1이다.
5. 15분을 바로 5분으로 줄이는 것은 비추천한다. status sync 자동화는 separate background job으로 만들고 30분 또는 15분부터 관찰한 뒤 5분을 검토한다.

## 결론

**full order sync와 status sync의 성격은 다르다.**

- 과거 blank `imweb_status`를 채우는 status sync는 이번처럼 1회 backfill 성격이 맞다.
- 하지만 새 주문과 배송/구매확정/취소 상태 변화는 계속 생기므로, 이후에는 incremental 또는 recent-window sync가 필요하다.
- 지금 VM Cloud에 이미 있는 1만 건 이상 historical row는 지우거나 다시 만들 필요가 없다.
- 다만 오늘 실행한 full order sync endpoint는 biocom/thecleancoffee 모두 `synced < totalCount`였으므로, “전체 API 목록 재수집 100% 완료”가 아니라 “기존 SQLite 원장 + status sync 보강 완료, current API 재수집은 부분/재시도 필요”로 기록한다.

## 확인한 현재 설정

### VM Cloud `/health`

```json
{
  "backgroundJobs": {
    "enabled": true,
    "attributionStatusSync": { "enabled": true, "intervalMs": 900000, "limit": 100 },
    "capiAutoSync": { "enabled": true, "intervalMs": 1800000, "limit": 100 },
    "imwebAutoSync": { "enabled": true, "intervalMs": 900000, "maxPage": 30 },
    "tossAutoSync": { "enabled": true, "intervalMs": 900000, "windowHours": 6 }
  }
}
```

해석:

- `imwebAutoSync` = Imweb 주문 목록 sync. 현재 15분.
- `attributionStatusSync` = Attribution 원장의 결제 상태 승격 sync. Imweb `imweb_status` sync가 아니다.
- `tossAutoSync` = Toss 거래/정산 sync. 현재 15분.
- Imweb status sync = 현재 auto/cron 없음.

### cron

VM Cloud `biocomkr_sns` crontab에는 PM2 resurrect와 coffee monitoring만 있었다.

```text
@reboot ... pm2 resurrect
0 9 * * * /home/biocomkr_sns/seo/coffee-monitoring/run.sh ...
```

`sync-order-statuses` cron은 없었다.

## 2026-05-10 실행 결과

### 백업

```text
/home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3.before-full-order-status-sync-20260510T053918Z.bak
```

로컬 검증 snapshot:

```text
/tmp/seo-vm-cloud-crm-20260510.sqlite3
/tmp/seo-vm-cloud-crm-20260510-post-sync.sqlite3
```

둘 다 `PRAGMA integrity_check` PASS.

### 최종 SQLite 요약

| site | total_rows | unique_order_no | status_filled | latest_synced_at UTC | latest_status_sync_at UTC |
|---|---:|---:|---:|---|---|
| biocom | 10,712 | 10,712 | 7,755 | 2026-05-10 06:09:23 | 2026-05-10 06:11:55 |
| thecleancoffee | 3,071 | 3,071 | 2,093 | 2026-05-10 06:10:09 | 2026-05-10 06:12:47 |

KST 기준:

- biocom latest order sync: 2026-05-10 15:09:23 KST
- biocom latest status sync: 2026-05-10 15:11:55 KST
- thecleancoffee latest order sync: 2026-05-10 15:10:09 KST
- thecleancoffee latest status sync: 2026-05-10 15:12:47 KST

### status sync 결과

biocom:

```text
updatedRows = 7,767
PAY_WAIT = 7
PAY_COMPLETE = 0
STANDBY = 116
DELIVERING = 24
COMPLETE = 649
PURCHASE_CONFIRMATION = 6,189
CANCEL = 706
RETURN = 76
```

thecleancoffee:

```text
updatedRows = 2,095
STANDBY = 47
DELIVERING = 3
COMPLETE = 109
PURCHASE_CONFIRMATION = 1,816
CANCEL = 117
RETURN = 3
```

status sync는 이번 범위에서 두 사이트 모두 완료로 본다.

### full order sync 결과

최종 재시도 결과:

```text
biocom sync-orders:
  ok = true
  synced = 6,363
  totalCount = 7,763
  totalPage = 156

thecleancoffee sync-orders:
  ok = true
  synced = 900
  totalCount = 2,093
  totalPage = 42
```

해석:

- endpoint 자체는 성공했다.
- 하지만 `synced < totalCount`라서 current API list 전체를 100% 순회했다고 말하지 않는다.
- SQLite row total은 current API `totalCount`보다 많다. 이는 과거/취소/상태 변경 row가 누적된 보조 원장이기 때문이다.
- 이번 P0의 NPay 결제완료 판정에는 status sync completion과 운영DB `PAYMENT_COMPLETE` dry-run이 더 중요하다.
- full sync 엔진이 왜 `synced < totalCount`에서 끝나는지는 P1 diagnostic이다. 의심 지점은 API rate-limit, pagination empty page, page cap/early break, Imweb API totalCount 변동이다.

## NPay 결제완료 판단에 미치는 영향

NPay 실제 결제완료 여부는 VM Cloud `complete_time` blank 또는 `imweb_status` blank만으로 판단하지 않는다.

현재 primary 기준:

```text
운영DB payment_status = PAYMENT_COMPLETE
또는 관리자 화면 confirmed evidence
```

VM Cloud status는 보조 lifecycle evidence다.

```text
STANDBY / DELIVERING / COMPLETE / PURCHASE_CONFIRMATION = 결제 후 주문 처리 상태 설명
PAY_WAIT / CANCEL / RETURN = 차단 또는 별도 검토 상태
blank = status sync freshness 문제. 미결제로 단정 금지
```

## 15분 -> 5분 변경 검토

- Codex 추천: 진행 비추천.
- 추천 이유: full sync 재시도 중 rate-limit/partial sync 정황이 있고, 5분은 API 호출량을 3배로 늘린다. 또한 NPay confirmed 판단의 primary는 status sync가 아니라 운영DB `PAYMENT_COMPLETE`라서 5분 변경이 지금 핵심 병목을 바로 풀지 않는다.
- 추천 방향에 대한 자신감: 88%.

### 지금 권장안

1. 기존 Imweb 주문 목록 auto sync는 15분 유지.
2. status sync는 cron이 아니라 app background job으로 별도 설계한다.
3. 기본값은 disabled로 둔다.
4. 처음 켠다면 30분 또는 15분부터 시작한다.
5. singleflight lock, timeout, site allowlist, recent-window/page cap, status distribution summary, health exposure를 넣는다.
6. 24시간 관찰 후 5분 단축 여부를 다시 본다.

권장 env 초안:

```text
IMWEB_STATUS_SYNC_ENABLED=false
IMWEB_STATUS_SYNC_INTERVAL_MS=1800000
IMWEB_STATUS_SYNC_SITE=biocom
IMWEB_STATUS_SYNC_PAGE_LIMIT=100
IMWEB_STATUS_SYNC_RECENT_DAYS=14
```

## cron vs app background job

### cron

장점:

- 빠르게 붙일 수 있다.
- 코드 변경이 적다.

리스크:

- 이전 실행이 길어질 때 overlap 방지가 약하다.
- PM2/env/health payload와 상태가 분리된다.
- 실패/소요시간/row count를 구조화해 남기기 어렵다.

### app background job 추천

권장 guard:

```text
singleflight lock
timeout 180s~300s
site allowlist
recent-window 또는 page cap
row_count/status distribution summary log
latestStatusSyncAt health payload 노출
manual endpoint 유지
default disabled
```

초기 권장값:

```text
30분 주기 -> 24h 관찰 -> 15분 검토 -> 필요 시 5분 검토
```

5분이 필요한 경우:

- NPay lifecycle status를 운영 화면에서 거의 실시간으로 보여줘야 할 때.
- API rate-limit/소요시간/overlap이 24h 관찰에서 안전할 때.

## 다음 판단

- P0: 운영DB `PAYMENT_COMPLETE` 기반 confirmed purchase no-send dry-run을 primary로 사용한다.
- P0: ConfirmedPurchasePrep 재계산에서는 VM Cloud-only NPay actual 0을 실패로 보지 않는다. VM Cloud에는 primary payment status column이 없기 때문이다.
- P1: full sync partial 원인을 별도 diagnostic으로 분리한다.
- P1: status sync background job 승인안을 작성한다.
- HOLD: 5분 변경, cron 추가, status sync 자동 write.
