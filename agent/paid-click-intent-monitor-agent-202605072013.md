# PaidClickIntentMonitorAgent 실행 결과

작성 시각: 2026-05-07 20:13:56 KST
상태: pass
Owner: agent / aios
Harness reference: harness/common/AUTONOMY_POLICY.md + harness/common/REPORTING_TEMPLATE.md
Do not use for: 운영 배포, 운영 DB write, 플랫폼 전송, GTM publish

## 10초 결론

Green Lane agent 실행이 통과했다. 이 결과는 read-only/no-send/no-write 관측 결과이며, 운영 숫자 변경 승인이 아니다.

## 공통 결과

| field | value |
| --- | --- |
| agent | PaidClickIntentMonitorAgent |
| run_id | paid-click-intent-monitor-agent-202605072013 |
| mode | monitoring |
| window | pre24h |
| freshness | latest available read-only |
| confidence | 0.9 |
| would_operational_write | false |
| writes_local_artifacts | true |
| would_platform_send | false |
| would_deploy | false |
| blocked_reasons |  |

## Child Runs

| name | status | exit | command |
| --- | --- | --- | --- |
| paid-click-intent-monitoring-collect | pass | 0 | cd backend && npx tsx scripts/paid-click-intent-monitoring-collect.ts --base-url=https://att.ainativeos.net --window=pre24h --json-output=/Users/vibetj/coding/seo/data/paid-click-intent-monitoring-pre24h-20260507.json --markdown-output=/Users/vibetj/coding/seo/gdn/paid-click-intent-post-publish-monitoring-result-pre24h-20260507.md |

## 산출물

| kind | path |
| --- | --- |
| detail_json | /Users/vibetj/coding/seo/data/paid-click-intent-monitoring-pre24h-20260507.json |
| detail_markdown | /Users/vibetj/coding/seo/gdn/paid-click-intent-post-publish-monitoring-result-pre24h-20260507.md |
| agent_json | /Users/vibetj/coding/seo/data/paid-click-intent-monitor-agent-202605072013.json |
| agent_markdown | /Users/vibetj/coding/seo/agent/paid-click-intent-monitor-agent-202605072013.md |

## Summary

```json
{
  "pass": true,
  "smoke_count": 7,
  "failed_count": 0,
  "no_write_violations": 0,
  "no_platform_send_violations": 0,
  "block_reason_counts": {
    "read_only_phase": 7,
    "approval_required": 7,
    "pii_detected": 2,
    "secret_detected": 2,
    "test_click_id_rejected_for_live": 1,
    "missing_google_click_id": 1,
    "invalid_value_field": 1,
    "admin_or_internal_path": 1,
    "payload_too_large": 1
  }
}
```

## 다음 할 일

- 24h/72h scheduled window에서 같은 agent를 재실행한다.
- PASS 유지 시 minimal paid_click_intent ledger write 승인안을 검토한다.
- 실패 시 receiver/CORS/payload validation/GTM/storage 중 막힌 지점을 분리한다.
