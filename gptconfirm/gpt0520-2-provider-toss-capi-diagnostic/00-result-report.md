harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
  required_context_docs:
    - data/!data_inventory.md
    - gptconfirm/gpt0520-1-meta-capi-p0-audit/00-result-report.md
  lane: Green read-only diagnosis + local code patch
  allowed_actions:
    - VM Cloud read-only API calls
    - Toss provider read-only payment status check for safe missing candidates
    - local backend code patch
    - local typecheck
  forbidden_actions:
    - Meta send/backfill
    - VM Cloud deploy/restart
    - operating DB write/import
    - GTM publish
    - raw identifier output
  source_window_freshness_confidence:
    source: VM Cloud attribution ledger + Meta CAPI send log + Toss provider read-only API
    window: rolling 24h, site=biocom, pixel=1283400029487161
    generated_at: 2026-05-20T13:39:57Z
    confidence: high for provider buckets, medium for auto-sync timing interpretation

# Provider/Toss CAPI Missing Diagnostic

## 이번에 가능해진 것

Meta CAPI 누락처럼 보이는 row를 “진짜 보내야 하는 결제완료”와 “이미 취소/환불되어 보내면 안 되는 row”로 분리할 수 있게 됐다.

## 10초 요약

- Rolling 24h 기준 safe missing 후보는 3건으로 보였다.
- Toss read-only 대조 결과, 2건은 취소/환불 bucket 이라 Meta Purchase 전송 대상이 아니다.
- 1건은 Toss DONE/PAID bucket + 금액 일치 + 승인시각 존재라, 다음 CAPI auto-sync 또는 수동 단건 점검 대상이다.
- 로컬 패치로 Toss `PARTIAL_CANCELED/REFUNDED/미완료` 상태를 CAPI 실패가 아니라 정상 no-send skip 으로 분류하게 했다.
- Meta send/backfill, VM deploy/restart, 운영DB write, GTM publish는 하지 않았다.

## 왜 중요한가

기존 “결제완료가 있는데 Meta CAPI 전송 기록이 없음” 카드에는 취소/환불 row가 섞일 수 있었다. 이 상태로 백필하면 ROAS가 오염된다. 이번 진단으로 “보관만, 전송하지 않음”과 “정말 재전송 검토”를 분리할 수 있다.

## 관측 숫자

- provider/Toss checked candidates: 3
- provider status counts:
  - done_or_paid: 1
  - canceled_or_refunded: 2
- raw identifier output: 0
- Meta send/backfill: 0

## 로컬 패치

- `backend/scripts/meta-capi-current-missing-diagnostic-20260520.ts`
  - `CAPI_DIAGNOSTIC_PROVIDER_CHECK=1` 옵션을 추가했다.
  - safe missing 후보만 Toss provider 상태를 read-only로 확인한다.
  - 결과는 safe_ref, status bucket, method bucket, amount_match, approved_at_present만 출력한다.
- `backend/src/metaCapi.ts`
  - Toss status를 정규화했다.
  - `CANCELED`, `PARTIAL_CANCELED`, `REFUNDED`는 취소/환불 no-send skip 으로 분류한다.
  - 그 외 미완료 상태도 failed가 아니라 skip으로 분류한다.

## 판정

`CURRENT_MISSING_SPLIT_BY_PROVIDER_STATUS`

현재 missing은 한 종류가 아니다.

1. 취소/환불이라 보내면 안 되는 row: 2건.
2. Toss 기준 결제완료인데 아직 CAPI log가 없는 최신 row: 1건.

## 하지 않은 것

- Meta 운영 Purchase 전송하지 않음.
- backfill 하지 않음.
- VM Cloud 배포/restart 하지 않음.
- 운영DB write/import 하지 않음.
- raw order/payment/member/click identifier 출력하지 않음.
