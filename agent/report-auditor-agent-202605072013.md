# ReportAuditorAgent 실행 결과

작성 시각: 2026-05-07 20:13:36 KST
상태: warn
Owner: agent / aios
Harness reference: harness/common/AUTONOMY_POLICY.md + harness/common/REPORTING_TEMPLATE.md
Do not use for: 운영 배포, 운영 DB write, 플랫폼 전송, GTM publish

## 10초 결론

agent 실행에 실패 또는 block이 있다. 아래 child run과 blocked reason을 기준으로 다음 조치를 분리해야 한다.

## 공통 결과

| field | value |
| --- | --- |
| agent | ReportAuditorAgent |
| run_id | report-auditor-agent-202605072013 |
| mode | report_audit |
| window | 20260507 |
| freshness | latest available read-only |
| confidence | 0.87 |
| would_operational_write | false |
| writes_local_artifacts | true |
| would_platform_send | false |
| would_deploy | false |
| blocked_reasons | language_or_endpoint_drift_candidates |

## Child Runs

| name | status | exit | command |
| --- | --- | --- | --- |
| validate_wiki_links | pass | 0 | python3 scripts/validate_wiki_links.py "agent/!aiosagentplan.md" "total/!total-current.md" "GA4/gtm.md" "gdn/!gdnplan.md" "gdn/google-ads-vm-ledger-source-recovery-backend-deploy-result-20260507.md" |
| harness-preflight-check | pass | 0 | python3 scripts/harness-preflight-check.py --strict |
| git-diff-check | pass | 0 | git diff --check |
| stale-endpoint-scan | pass | 0 | rg -n "paid-click-intent/no-send\|paid_click_intent/no-send\|confirmed-purchase/no-send\|confirmed_purchase/no-send\|conversion upload\|googleAds:mutate\|GTM Production publish\|operating DB write\|운영 DB write" "agent/!aiosagentplan.md" "total/!total-current.md" "GA4/gtm.md" "gdn/!gdnplan.md" "gdn/google-ads-vm-ledger-source-recovery-backend-deploy-result-20260507.md" \|\| true |

## 산출물

| kind | path |
| --- | --- |
| agent_json | /Users/vibetj/coding/seo/data/report-auditor-agent-202605072013.json |
| agent_markdown | /Users/vibetj/coding/seo/agent/report-auditor-agent-202605072013.md |

## Summary

```json
{
  "audited_targets": [
    "agent/!aiosagentplan.md",
    "total/!total-current.md",
    "GA4/gtm.md",
    "gdn/!gdnplan.md",
    "gdn/google-ads-vm-ledger-source-recovery-backend-deploy-result-20260507.md"
  ],
  "wiki_link_status": "pass",
  "harness_status": "pass",
  "diff_check_status": "pass",
  "stale_endpoint_line_count": 22,
  "drift_candidate_count": 6,
  "drift_candidates": [
    "gdn/google-ads-vm-ledger-source-recovery-backend-deploy-result-20260507.md:32:    - Google Ads conversion upload",
    "gdn/google-ads-vm-ledger-source-recovery-backend-deploy-result-20260507.md:97:| publish 이후 `paid_click_intent/no-send` access log lines | 1,582 |",
    "gdn/!gdnplan.md:55:Codex는 Green Lane인 API 재조회, gap 분해, 승인안 작성까지 자율 진행할 수 있고, Google Ads 전환 액션 변경과 conversion upload는 Red Lane으로 멈춘다.",
    "total/!total-current.md:36:    - conversion upload",
    "total/!total-current.md:171:- conversion upload.",
    "total/!total-current.md:210:| conversion upload | Google Ads 전환값이 바뀌는 Red Lane | no-send 후보, 중복 guard, click id fill-rate, rollback 문서 PASS |"
  ]
}
```

## 다음 할 일

- warn이면 drift_candidates를 사람이 읽는 문서에서 용어/endpoint 혼동인지 확인한다.
- failed이면 validate_wiki_links, harness-preflight, diff check 중 실패한 명령을 먼저 수정한다.
- ReportAuditorAgent는 운영 write/send/publish/deploy를 하지 않는다.
