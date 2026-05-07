# CampaignMappingAgent 실행 결과

작성 시각: 2026-05-07 21:22:46 KST
상태: pass
Owner: agent / aios
Harness reference: harness/common/AUTONOMY_POLICY.md + harness/common/REPORTING_TEMPLATE.md
Do not use for: 운영 배포, 운영 DB write, 플랫폼 전송, GTM publish

## 10초 결론

Green Lane agent 실행이 통과했다. 이 결과는 read-only/no-send/no-write 관측 결과이며, 운영 숫자 변경 승인이 아니다.

## 공통 결과

| field | value |
| --- | --- |
| agent | CampaignMappingAgent |
| run_id | campaign-mapping-agent-202605072122 |
| mode | dry_run |
| window | 20260507 |
| freshness | latest available read-only |
| confidence | 0.88 |
| would_operational_write | false |
| writes_local_artifacts | true |
| would_platform_send | false |
| would_deploy | false |
| blocked_reasons |  |

## Child Runs

| name | status | exit | command |
| --- | --- | --- | --- |
| meta-split-required-dry-run | pass | 0 | cd backend && npx tsx scripts/meta-split-required-dry-run.ts "--workbook=/Users/vibetj/Downloads/campaign-mapping-manual-check-template-20260505 (1).csv" --json-output=/Users/vibetj/coding/seo/data/meta-split-required-dry-run-20260507.json --markdown-output=/Users/vibetj/coding/seo/meta/campaign-mapping-split-required-dry-run-20260507.md |

## 산출물

| kind | path |
| --- | --- |
| detail_json | /Users/vibetj/coding/seo/data/meta-split-required-dry-run-20260507.json |
| detail_markdown | /Users/vibetj/coding/seo/meta/campaign-mapping-split-required-dry-run-20260507.md |
| agent_json | /Users/vibetj/coding/seo/data/campaign-mapping-agent-202605072122.json |
| agent_markdown | /Users/vibetj/coding/seo/agent/campaign-mapping-agent-202605072122.md |

## Summary

```json
{
  "manual_rows": 10,
  "bucket_counts": {
    "split_required_order_level_needed": 6,
    "precision_loss_review": 2,
    "mapped_manual": 1,
    "excluded_from_meta_roas": 1
  },
  "decision_counts": {
    "분리": 7,
    "확정": 2,
    "제외": 1
  },
  "block_reason_counts": {
    "read_only_phase": 10,
    "split_required": 6,
    "order_level_campaign_evidence_required": 6,
    "audit_missing_or_stale": 3,
    "campaign_id_precision_loss_possible": 2,
    "manual_confirmed": 1,
    "excluded_by_growth_manual": 1,
    "not_meta_campaign_roas": 1
  },
  "split_required_revenue": 10396950,
  "growth_team_questions": [
    "split_required 6건은 주문별 campaign/adset/ad id 또는 URL Parameters export가 있어야 나눌 수 있습니다. 우선 매출 큰 alias meta_biocom_sosohantoon01_igg(3,933,000원), meta_biocom_proteinstory_igg(2,787,750원), meta_biocom_iggspring(2,206,200원)의 주문별 광고 id export를 받을 수 있나요?",
    "precision_loss_review 2건은 campaign id가 000으로 손상됐을 수 있습니다. fbclid only (/sosohantoon01, /kangman03, /shop_view/?idx=503), meta_biocom_iggacidset_2026의 Ads Manager 원본 campaign id를 텍스트로 다시 받을 수 있나요?",
    "split_required는 회신 전까지 Meta 캠페인 ROAS에 강제 배정하지 않는 기준에 동의하나요?"
  ]
}
```

## 다음 할 일

- split_required_order_level_needed는 주문별 campaign/adset/ad id evidence 확보 전까지 Meta ROAS에 강제 배정하지 않는다.
- precision_loss_review는 Ads Manager 원본 id로 재확인한다.
- 그로스파트 추가 확인이 필요하면 otherpart/!otherpart.md에 질문을 1~3개로 축약한다.
