harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - data/!data_inventory.md
    - capivm/!capiplan.md
  required_context_docs:
    - capivm/!capiplan.md
  lane: Green
  allowed_actions:
    - read_only_live_api_audit
    - vm_log_read_only_audit
    - local_report_package
    - no_send_candidate_recompute
  forbidden_actions:
    - meta_send_or_backfill
    - vm_deploy_or_restart
    - production_db_write
    - gtm_publish
    - raw_identifier_output
  source_window_freshness_confidence:
    site: biocom
    primary_window: rolling_24h
    cross_check_window: kst_today_and_7d
    source: att.ainativeos.net live APIs + VM Cloud pm2 logs
    freshness: 2026-05-20 18:24 KST latest ledger row observed
    confidence: high_for_counts_medium_for_root_cause

# Meta CAPI P0 Current Audit

## 이번에 가능해진 것

Meta CAPI P0는 **대부분 정상 동작** 중이지만, 바이오컴 rolling 24h 기준으로 **결제완료인데 Meta CAPI 전송 로그가 없는 current missing 2건 / 691,400원**이 남아 있음을 확인했다. 두 건은 no-send guard, 중복 event_id, sync limit 문제로는 설명되지 않는다.

즉 현재 P0의 다음 병목은 “Meta로 보내도 되는 후보를 자동 전송 루프가 왜 실제 send log로 남기지 못했는지”를 safe_ref 단위로 진단하는 것이다.

## 핵심 숫자

| 범위 | 결제완료 | Meta CAPI 성공 | 누락 큐 | 해석 |
|---|---:|---:|---:|---|
| 바이오컴 rolling 24h | 49건 / 12,222,606원 | 47건 | 2건 / 691,400원 | 현재 P0 잔여 이슈 |
| 바이오컴 최근 7일 | 366건 / 107,713,690원 | 350건 | 16건 / 4,045,885원 | 14건은 legacy 보관, 2건은 current |
| 더클린커피 rolling 24h | 18건 / 1,018,788원 | 18건 | 0건 | 정상 |
| 더클린커피 최근 7일 | 181건 / 11,821,413원 | 183건 | 0건 | window/order timing 차이는 별도 caveat |

## 현재 missing 2건

| safe_ref | 금액 | 후보 재계산 | dedupe | no-send guard | 해석 |
|---|---:|---|---|---|---|
| safe_99b305804e | 446,400원 | eligible | not seen | clear | 자동 전송 루프에서 빠진 이유 추가 진단 필요 |
| safe_aaf855fa9f | 245,000원 | eligible | not seen | clear | 자동 전송 루프에서 빠진 이유 추가 진단 필요 |

두 건 모두 결제완료 신호, 값, 결제 키 presence, 주문 키 presence가 있고 sync limit 100 안에 들어온다. 따라서 “후보 자체가 막혔다”기보다 “자동 전송 루프의 내부 단계가 로그로 충분히 보이지 않는다”가 현재 가장 좁혀진 원인이다.

## 로컬 진단 스크립트

`backend/scripts/meta-capi-current-missing-diagnostic-20260520.ts`를 추가했다.

실행 결과:

- ledger rows: 865.
- confirmed payment_success: 49.
- eligible candidates: 49.
- successful CAPI logs checked: 350.
- already sent by order event key: 47.
- eligible but no order-event success log: 2.
- unsent safe_refs: `safe_aaf855fa9f`, `safe_99b305804e`.
- external send/write: 0.

## 하지 않은 것

- Meta 운영 Purchase send/backfill 0건.
- VM Cloud 배포/restart 0회.
- 운영DB write/import 0회.
- GTM publish 0회.
- raw order/payment/member/click/email/phone id 출력 0.

## 판단

P0는 “전체 복구”가 아니라 “잔여 current missing 2건 원인 추적” 단계다. 지금 바로 backfill을 보내기보다, safe_ref-only 자동 전송 진단 루프를 먼저 붙여야 한다. 그래야 ROAS 오염 없이 `build_input_failed`, `provider_status_block`, `already_sent_mismatch`, `auto_sync_visibility_gap` 중 어디인지 닫을 수 있다.

## 다음 액션

1. `metaCapi` sync diagnostic을 로컬에 추가한다.
   - 목적: current missing 2건이 자동 전송 루프에서 왜 send log로 남지 않았는지 safe_ref 단위로 설명한다.
   - 조건: no-send, duplicate, build input, provider status, send eligibility를 모두 safe_ref/present-absent로만 출력한다.
   - 외부 전송: 0.
   - 현재 상태: 1차 로컬 스크립트는 완료. 다음은 provider/Toss read-only status까지 선택적으로 붙이는 2차 진단이다.

2. diagnostic 결과가 `sync bug`면 후보 gate/logging patch를 만든다.
   - 목적: 자동 전송 루프가 같은 missing을 반복하지 않게 한다.
   - 배포: VM Cloud backend 변경은 Yellow Lane.

3. diagnostic 결과가 “보내도 되는 후보인데 실제 미전송”으로 닫히면 단건 backfill 승인안을 별도로 만든다.
   - 목적: 이미 빠진 2건을 복구한다.
   - 조건: Red 승인 전 send 금지.
