harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
  required_context_docs:
    - gptconfirm/gpt0520-2-provider-toss-capi-diagnostic/00-result-report.md
    - data/!data_inventory.md
  lane: Yellow deploy approved by TJ님 in chat
  allowed_actions:
    - deploy backend/src/metaCapi.ts only
    - backup remote file before overwrite
    - remote npm build/typecheck
    - restart seo-backend
    - health and read-only post-check
  forbidden_actions:
    - Meta manual send/backfill
    - production DB write/import
    - VM Cloud schema migration
    - GTM publish
    - raw identifier output
  source_window_freshness_confidence:
    source: local patch + VM Cloud live backend
    window: deployment time 2026-05-20 KST
    confidence: high for code deployment, medium for future auto-sync timing

# Meta CAPI Toss Skip VM Deploy

## 승인안

TJ님 승인 문구: “VM 배포 승인안 작성후 배포까지 진행해”

## 배포 목적

Toss provider가 취소/환불 또는 미완료라고 말하는 row를 Meta CAPI 실패나 백필 후보처럼 보지 않게 한다.

이 변경은 구매 신호를 더 많이 보내는 패치가 아니다. 보내면 안 되는 row를 정확히 “전송 금지 skip”으로 분류해 ROAS 오염을 줄이는 패치다.

## 배포 범위

- 대상 파일: `backend/src/metaCapi.ts`
- 변경 내용:
  - Toss status 정규화 helper 추가.
  - `DONE/PAID/APPROVED`만 결제완료로 인정.
  - `CANCELED/PARTIAL_CANCELED/REFUNDED`는 no-send skip.
  - 그 외 미완료 상태는 no-send skip.
- 제외:
  - Meta manual backfill/send 없음.
  - 운영DB write 없음.
  - schema migration 없음.
  - GTM publish 없음.

## 성공 기준

1. 원격 backup 생성.
2. `npm run build` 성공.
3. `seo-backend` restart 성공.
4. `/health` 200.
5. read-only provider diagnostic에서 raw identifier output 0.
6. Meta manual send/backfill 0.

## Rollback

원격 backup 파일을 `backend/src/metaCapi.ts`로 되돌리고 backend build/restart 한다.

## 배포 결과

상태: PASS with follow-up watch

배포 시각: 2026-05-20 23:01 KST

원격 backup:

- `/home/biocomkr_sns/seo/repo/backend/_deploy-backup-20260520-224729-meta-capi-toss-skip/metaCapi.ts.before`

배포 파일:

- `/home/biocomkr_sns/seo/repo/backend/src/metaCapi.ts`

검증:

- 원격 `npm run build`: PASS
- `seo-backend` restart: PASS
- PM2 status: online
- PM2 restart count: 4298
- PM2 pid after restart: 1778117
- `/health`: 200
- `/api/attribution/leading-indicators`: 200, 2.385s
- `/api/attribution/funnel-health`: 200, 3.962s
- CAPI auto-sync post-restart log: sent 2, skipped 98, failed 0
- read-only provider diagnostic raw identifier output: 0
- manual Meta send/backfill: 0
- production DB write/import: 0
- VM Cloud schema migration: 0
- GTM publish: 0

## Post-check 해석

배포 후 backend는 정상 기동했다. 이번 패치의 핵심인 “Toss가 취소/환불 또는 미완료라고 말하는 row를 실패로 쌓지 않고 skip으로 분류”하는 로직은 운영 빌드에 반영됐다.

read-only provider diagnostic 기준으로 현재 24시간 큐에는 unresolved safe row 4건이 남아 있다.

- provider done/paid: 2건
- provider canceled/refunded: 2건

취소/환불 2건은 이번 패치 이후 실패가 아니라 no-send/skip으로 정리되어야 한다. done/paid 2건은 실제 결제완료 후보이므로 다음 CAPI auto-sync 주기 또는 별도 queue audit에서 전송 여부를 다시 확인한다.

주의: 재시작 직후 기존 자동 동기화 작업이 CAPI 2건을 전송했다. 이는 기존 운영 auto-sync가 동작한 것이며, 이번 작업에서 manual backfill/send는 실행하지 않았다.
