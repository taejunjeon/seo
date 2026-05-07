# ApprovalQueueAgent 실행 결과

작성 시각: 2026-05-07 20:13:56 KST
상태: warn
Owner: agent / aios
Harness reference: harness/common/AUTONOMY_POLICY.md + harness/common/REPORTING_TEMPLATE.md
Do not use for: 운영 배포, 운영 DB write, 플랫폼 전송, GTM publish

## 10초 결론

agent 실행에 실패 또는 block이 있다. 아래 child run과 blocked reason을 기준으로 다음 조치를 분리해야 한다.

## 공통 결과

| field | value |
| --- | --- |
| agent | ApprovalQueueAgent |
| run_id | approval-queue-agent-202605072013 |
| mode | approval_index |
| window | 20260507 |
| freshness | latest available read-only |
| confidence | 0.84 |
| would_operational_write | false |
| writes_local_artifacts | true |
| would_platform_send | false |
| would_deploy | false |
| blocked_reasons | open_approval_exists |

## Child Runs

| name | status | exit | command |
| --- | --- | --- | --- |

## 산출물

| kind | path |
| --- | --- |
| approval_index_json | /Users/vibetj/coding/seo/data/approval-queue-agent-20260507.json |
| approval_index_markdown | /Users/vibetj/coding/seo/agent/approval-queue-agent-result-20260507.md |
| agent_json | /Users/vibetj/coding/seo/data/approval-queue-agent-202605072013.json |
| agent_markdown | /Users/vibetj/coding/seo/agent/approval-queue-agent-202605072013.md |

## Summary

```json
{
  "scanned_files": 11,
  "status_counts": {
    "closed": 3,
    "future": 5,
    "open": 1,
    "unknown": 2
  },
  "open_approvals": [
    {
      "file": "gdn/google-ads-vm-ledger-source-recovery-backend-deploy-approval-20260507.md",
      "status": "open",
      "title": "Google Ads ROAS 운영 VM 원장 조회 복구 backend 배포 승인안",
      "reason": "",
      "resume_condition": ""
    }
  ],
  "future_approvals": [
    {
      "file": "gdn/google-ads-confirmed-purchase-execution-approval-20260505.md",
      "status": "future",
      "title": "Google Ads 실제 결제완료 주문만 구매로 알려주는 새 전환 통로 실행 승인안",
      "reason": "Google Ads/플랫폼 전환값 또는 학습 신호에 영향",
      "resume_condition": "click id 보존률과 no-send 후보 품질이 충분할 때"
    },
    {
      "file": "gdn/google-ads-purchase-primary-change-approval-20260505.md",
      "status": "future",
      "title": "Google Ads `구매완료` Primary 변경 승인안",
      "reason": "Google Ads Primary 전환 설정 변경",
      "resume_condition": "새 BI confirmed_purchase 병렬 관측 후"
    },
    {
      "file": "gdn/paid-click-intent-gtm-production-publish-approval-20260506.md",
      "status": "future",
      "title": "paid_click_intent v1 GTM Production publish 승인안",
      "reason": "GTM Production publish가 포함되어 Red Lane",
      "resume_condition": "receiver TEST POST/negative smoke PASS 후"
    },
    {
      "file": "gdn/paid-click-intent-minimal-ledger-write-approval-20260507.md",
      "status": "future",
      "title": "minimal paid_click_intent ledger write 승인안 초안",
      "reason": "운영 ledger write가 포함될 수 있어 Red Lane",
      "resume_condition": "24h/72h paid_click_intent monitoring PASS 후"
    },
    {
      "file": "gdn/paid-click-intent-production-receiver-deploy-approval-20260506.md",
      "status": "future",
      "title": "paid_click_intent production receiver 배포 승인안",
      "reason": "운영 backend deploy가 포함되어 Red Lane",
      "resume_condition": "route diff/negative smoke/rollback 조건 확정 후"
    }
  ],
  "future_red_table": [
    {
      "file": "gdn/google-ads-confirmed-purchase-execution-approval-20260505.md",
      "title": "Google Ads 실제 결제완료 주문만 구매로 알려주는 새 전환 통로 실행 승인안",
      "reason": "Google Ads/플랫폼 전환값 또는 학습 신호에 영향",
      "resume_condition": "click id 보존률과 no-send 후보 품질이 충분할 때"
    },
    {
      "file": "gdn/google-ads-purchase-primary-change-approval-20260505.md",
      "title": "Google Ads `구매완료` Primary 변경 승인안",
      "reason": "Google Ads Primary 전환 설정 변경",
      "resume_condition": "새 BI confirmed_purchase 병렬 관측 후"
    },
    {
      "file": "gdn/paid-click-intent-gtm-production-publish-approval-20260506.md",
      "title": "paid_click_intent v1 GTM Production publish 승인안",
      "reason": "GTM Production publish가 포함되어 Red Lane",
      "resume_condition": "receiver TEST POST/negative smoke PASS 후"
    },
    {
      "file": "gdn/paid-click-intent-minimal-ledger-write-approval-20260507.md",
      "title": "minimal paid_click_intent ledger write 승인안 초안",
      "reason": "운영 ledger write가 포함될 수 있어 Red Lane",
      "resume_condition": "24h/72h paid_click_intent monitoring PASS 후"
    },
    {
      "file": "gdn/paid-click-intent-production-receiver-deploy-approval-20260506.md",
      "title": "paid_click_intent production receiver 배포 승인안",
      "reason": "운영 backend deploy가 포함되어 Red Lane",
      "resume_condition": "route diff/negative smoke/rollback 조건 확정 후"
    }
  ]
}
```

## 다음 할 일

- open approval이 생기면 confirm/!confirm.md를 갱신한다.
- future Red approval은 실제 실행하지 않고 승인 문서만 유지한다.
- approval parser가 false positive를 내면 status keyword를 보정한다.
