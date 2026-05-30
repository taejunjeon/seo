# Meta CAPI auto-sync 재개 결과

작성 시각: 2026-05-25 11:36 KST  
기준일: 2026-05-25  
문서 성격: 승인 후 VM Cloud 운영 설정 복구 결과  
Site: biocom, thecleancoffee

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/yellow-lane-deploy-packet-template-20260523.md
  required_context_docs:
    - project/coffee-naver-brandsearch-vm-deploy-result-20260525.md
    - project/coffee-naver-brandsearch-vm-deploy-hold-result-20260525.md
  lane: Red_approved_platform_send_resume
  allowed_actions:
    - VM_Cloud_env_backup
    - CAPI_AUTO_SYNC_ENABLED_restore
    - seo_backend_restart
    - health_check
    - CAPI_auto_sync_log_check
  forbidden_actions:
    - manual_CAPI_send
    - VM_Cloud_SQLite_manual_write
    - operational_DB_write
    - GTM_publish
    - Imweb_code_edit
    - raw_identifier_output
  source_window_freshness_confidence:
    source:
      health: https://att.ainativeos.net/health
      logs: VM Cloud pm2 backend logs + Meta CAPI send log aggregate
    window: 2026-05-25 11:22-11:35 KST
    freshness: same-turn
    confidence: 0.93
```

## 10초 요약

Meta CAPI auto-sync를 다시 켰다. 배포 중 임시로 꺼둔 `CAPI_AUTO_SYNC_ENABLED`를 `1`로 복구하고 `seo-backend`를 재시작했다.

재시작 후 health에서 `capiAutoSync.enabled=true`를 확인했다. 60초 이후 auto-sync가 정상 활성화됐고, 이번 재개 후 첫 tick에서 1건 전송, 99건 skip, 실패 0건으로 기록됐다.

## 실행한 것

### 1. env 백업

VM Cloud 백업 경로:

```text
/home/biocomkr_sns/seo/repo/.deploy-backups/capi-auto-sync-reenable-20260525T1022KST
```

백업 대상:

- `backend/.env`

### 2. CAPI auto-sync 재개

`backend/.env`에 중복 선언된 두 줄을 모두 복구했다.

```text
CAPI_AUTO_SYNC_ENABLED=1
```

### 3. backend restart

```text
pm2 restart seo-backend --update-env
pm2 save
```

## 확인 결과

### health

```text
status=ok
capiAutoSync.enabled=true
capiAutoSync.intervalMs=1800000
capiAutoSync.limit=100
```

### auto-sync 로그

```text
CAPI auto-sync 활성화 — 30분 주기
CAPI auto-sync 1건 전송, 99건 skip, 실패 0
```

### 최근 2시간 aggregate

```text
auto_sync rows: 5
success: 5
failed: 0
```

## 하지 않은 것

- 수동 CAPI send: 0건
- VM Cloud SQLite 수동 write: 0건
- 운영DB write: 0건
- GTM publish: 0건
- Imweb code edit: 0건
- raw identifier output: 0건

## 현재 판정

`CAPI_AUTO_SYNC_REENABLED`

브랜드검색 classifier 배포 때 임시로 꺼둔 Meta CAPI 자동 전송을 다시 운영 상태로 돌렸다. 이번 재개 이후 첫 자동 동기화는 실패 없이 완료됐다.

