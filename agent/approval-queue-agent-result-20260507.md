# ApprovalQueueAgent 결과

작성 시각: 2026-05-07 20:36:32 KST

## 요약

| metric | value |
| --- | --- |
| scanned_files | 11 |
| open | 0 |
| future | 5 |
| closed | 6 |
| unknown | 0 |

## Open approvals

| file | title |
| --- | --- |

## Future Red approvals

| file | title | why_future_red | resume_condition |
| --- | --- | --- | --- |
| gdn/google-ads-confirmed-purchase-execution-approval-20260505.md | Google Ads 실제 결제완료 주문만 구매로 알려주는 새 전환 통로 실행 승인안 | Google Ads/플랫폼 전환값 또는 학습 신호에 영향 | click id 보존률과 no-send 후보 품질이 충분할 때 |
| gdn/google-ads-purchase-primary-change-approval-20260505.md | Google Ads `구매완료` Primary 변경 승인안 | Google Ads Primary 전환 설정 변경 | 새 BI confirmed_purchase 병렬 관측 후 |
| gdn/paid-click-intent-gtm-production-publish-approval-20260506.md | paid_click_intent v1 GTM Production publish 승인안 | GTM Production publish가 포함되어 Red Lane | receiver TEST POST/negative smoke PASS 후 |
| gdn/paid-click-intent-minimal-ledger-write-approval-20260507.md | minimal paid_click_intent ledger write 승인안 초안 | 운영 ledger write가 포함될 수 있어 Red Lane | 24h/72h paid_click_intent monitoring PASS 후 |
| gdn/paid-click-intent-production-receiver-deploy-approval-20260506.md | paid_click_intent production receiver 배포 승인안 | 운영 backend deploy가 포함되어 Red Lane | route diff/negative smoke/rollback 조건 확정 후 |
