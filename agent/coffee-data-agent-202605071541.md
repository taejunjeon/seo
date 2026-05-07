# CoffeeDataAgent 실행 결과

작성 시각: 2026-05-07 15:41:43 KST
상태: pass
Owner: agent / aios
Do not use for: 운영 배포, 운영 DB write, 플랫폼 전송, GTM publish

## 10초 결론

Green Lane agent 실행이 통과했다. 이 결과는 read-only/no-send/no-write 관측 결과이며, 운영 숫자 변경 승인이 아니다.

## 공통 결과

| field | value |
| --- | --- |
| agent | CoffeeDataAgent |
| run_id | coffee-data-agent-202605071541 |
| mode | read_only |
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
| coffee-npay-intent-monitoring-report | pass | 0 | cd backend && npx tsx scripts/coffee-npay-intent-monitoring-report.ts --endpoint https://att.ainativeos.net --publish-ts "2026-05-02 15:00" --output /Users/vibetj/coding/seo/data/coffee-npay-intent-monitoring-20260507.yaml |
| coffee-a6-ledger-join-dry-run | pass | 0 | cd backend && npx tsx scripts/coffee-a6-ledger-join-dry-run.ts --endpoint https://att.ainativeos.net |

## 산출물

| kind | path |
| --- | --- |
| monitoring_yaml | /Users/vibetj/coding/seo/data/coffee-npay-intent-monitoring-20260507.yaml |
| a6_dry_run_txt | /Users/vibetj/coding/seo/data/coffee-a6-ledger-join-dry-run-20260507.txt |
| agent_json | /Users/vibetj/coding/seo/data/coffee-data-agent-202605071541.json |
| agent_markdown | /Users/vibetj/coding/seo/agent/coffee-data-agent-202605071541.md |

## Summary

```json
{
  "a5_verdict": "closure-ready (auto-evaluated)",
  "a5_stop_required": "false",
  "a5_real_rows": 0,
  "a6_real_rows": 6,
  "a6_join_eligibility_pct": 66.7,
  "a6_send_target_count": 4,
  "notes": {
    "a5_real_rows": "monitoring report M-1_total_rows_excl_test",
    "a6_real_rows": "A-6 send 후보 real row 수",
    "a6_join_eligibility_pct": "confirm_to_pay AND imweb_order_code 존재 비율",
    "a6_send_target_count": "본 시점 A-6 send 후보, 운영 ledger 누적"
  }
}
```

## 다음 할 일

- KST 18:00 cron 산출물 이후 재실행해 A-5 closure를 재판정한다.
- A-5 PASS가 유지되면 A-6 backend no-send 배포 승인안을 작성한다.
- Coffee GA4/Meta 실제 전송은 계속 Red Lane으로 유지한다.
