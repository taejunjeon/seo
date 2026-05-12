---
harness_preflight:
  common_harness_read: true
  project_harness_read: true
  required_context_docs:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
    - data/!data_inventory.md
    - data/dbstructure.md
    - gdn/attribution-data-source-decision-guide-20260511.md
    - total/!total-current.md
  lane: Green
  allowed_actions: [document_audit, local_document_patch, read_only_live_api_check]
  forbidden_actions: [operational_db_write, platform_send_upload, gtm_publish, cron_registration]
  source_window_freshness_confidence: "last_30d + live summary API / 2026-05-12 22:24 KST / confidence 93%"
---

# Option C Source Guide Consistency Audit

Option C 이후 source 혼동은 대부분 닫혔습니다. 남은 충돌은 “운영DB `PAYMENT_COMPLETE`를 모든 사이트 NPay actual primary로 읽을 수 있는가”였고, 이번 audit에서 site scope를 보강했습니다.

## 판정

`PASS_WITH_NOTES`

## 확인한 규칙

| 규칙 | 판정 | 메모 |
|---|---|---|
| 실제 결제완료 primary | PASS_WITH_SITE_SCOPE | biocom만 운영DB `tb_iamweb_users PAYMENT_COMPLETE` included |
| `complete_time` | PASS | legacy diagnostic only |
| `imweb_status/raw_json.orderStatus` | PASS | lifecycle diagnostic only |
| bridge pending | PASS | 공백 row를 미결제로 보지 않음 |
| NPay click/count/add_payment_info | PASS | 구매완료 승격 금지 |
| coffee included 금지 | PASS_AFTER_PATCH | source guide와 total current에 명시 보강 |

## 수정한 문서

- `gdn/attribution-data-source-decision-guide-20260511.md`: 2026-05-12 Option C site-scope note 추가.
- `total/!total-current.md`: gpt0508-47 live state, live 숫자, rollback backup 위치 추가.

## 확인한 코드

- `backend/src/siteLandingLedger.ts`: legacy/actual/bridge_pending 필드 분리.
- `backend/src/npayActualConfirmedPgReader.ts`: biocom만 actual included, coffee는 bridge_pending.
- `backend/src/routes/attribution.ts`: summary API가 actual confirmed aggregate를 주입.

## 남은 주의

더클린커피는 VM Cloud/Imweb v2 기준으로 주문번호가 충분히 있으나, 운영DB `tb_iamweb_users`에는 0/337 매칭입니다. 따라서 다음 sprint에서 coffee를 actual included로 올리려면 별도 site-isolated actual source가 먼저 필요합니다.

산출 JSON: `data/option-c-source-guide-consistency-audit-20260512.json`
