# ConfirmedPurchasePrepAgent 실행 결과

작성 시각: 2026-05-07 20:13:36 KST
상태: pass
Owner: agent / aios
Harness reference: harness/common/AUTONOMY_POLICY.md + harness/common/REPORTING_TEMPLATE.md
Do not use for: 운영 배포, 운영 DB write, 플랫폼 전송, GTM publish

## 10초 결론

Green Lane agent 실행이 통과했다. 이 결과는 read-only/no-send/no-write 관측 결과이며, 운영 숫자 변경 승인이 아니다.

## 공통 결과

| field | value |
| --- | --- |
| agent | ConfirmedPurchasePrepAgent |
| run_id | confirmed-purchase-prep-agent-202605072013 |
| mode | no_send_candidate_prep |
| window | 20260507 |
| freshness | latest available read-only |
| confidence | 0.86 |
| would_operational_write | false |
| writes_local_artifacts | true |
| would_platform_send | false |
| would_deploy | false |
| blocked_reasons |  |

## Child Runs

| name | status | exit | command |
| --- | --- | --- | --- |
| google-ads-confirmed-purchase-candidate-prep | pass | 0 | cd backend && npx tsx scripts/google-ads-confirmed-purchase-candidate-prep.ts --input=/Users/vibetj/coding/seo/data/bi-confirmed-purchase-operational-dry-run-20260505.json --json-output=/Users/vibetj/coding/seo/data/google-ads-confirmed-purchase-candidate-prep-20260507.json --markdown-output=/Users/vibetj/coding/seo/gdn/google-ads-confirmed-purchase-candidate-prep-20260507.md |

## 산출물

| kind | path |
| --- | --- |
| detail_json | /Users/vibetj/coding/seo/data/google-ads-confirmed-purchase-candidate-prep-20260507.json |
| detail_markdown | /Users/vibetj/coding/seo/gdn/google-ads-confirmed-purchase-candidate-prep-20260507.md |
| agent_json | /Users/vibetj/coding/seo/data/confirmed-purchase-prep-agent-202605072013.json |
| agent_markdown | /Users/vibetj/coding/seo/agent/confirmed-purchase-prep-agent-202605072013.md |

## Summary

```json
{
  "payment_complete_candidates": 623,
  "payment_method_counts": {
    "homepage": 586,
    "npay": 37
  },
  "include_reason_counts": {
    "homepage_confirmed_order": 586,
    "npay_confirmed_order": 37
  },
  "ga4_presence_counts": {
    "present": 476,
    "robust_absent": 147
  },
  "google_click_id_type_counts": {
    "missing": 618,
    "gclid": 5
  },
  "with_google_click_id": 5,
  "after_approval_structurally_eligible": 0,
  "send_candidate": 0,
  "block_reason_counts": {
    "read_only_phase": 623,
    "approval_required": 623,
    "google_ads_conversion_action_not_created": 623,
    "conversion_upload_not_approved": 623,
    "missing_google_click_id": 618,
    "already_in_ga4": 476,
    "missing_attribution_vm_evidence": 129,
    "npay_intent_ambiguous": 10,
    "npay_intent_not_a_grade_strong": 10,
    "npay_intent_purchase_without_intent": 6,
    "order_has_return_reason": 4,
    "canceled_order": 4
  }
}
```

## 다음 할 일

- 24h/72h paid_click_intent monitoring PASS 이후 이 prep을 재실행해 missing_google_click_id 변화만 본다.
- Google Ads conversion action 생성/변경과 conversion upload는 별도 Red 승인 전 금지한다.
- no-send 후보의 block_reason을 confirmed_purchase 실행 승인안의 선행 근거로만 사용한다.
