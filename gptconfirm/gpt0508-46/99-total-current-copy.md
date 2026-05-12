# Total Current Copy

## gpt0508-46 기준 현재 상태

NPay summary 문제는 `sync-order-statuses`만의 문제가 아니라, summary API가 `complete_time`을 actual purchase처럼 쓰던 구조 문제로 확정했습니다.

현재 로컬 patch는 다음 상태입니다.

- `complete_time` 기준 NPay 매출: legacy diagnostic.
- 운영DB `PAYMENT_COMPLETE` 기준 NPay 매출: actual confirmed primary.
- complete_time 공백 NPay row: bridge_pending.
- imweb_status/raw_json orderStatus: lifecycle diagnostic.
- NPay click/count/add_payment_info: 구매완료 승격 금지.

## Track

- Track A: 100% -> 100% (+0%)
- Track B: 96% -> 97% (+1%)
- Track C: 99% -> 100% (+1%)
- Track D: 93% -> 96% (+3%)
- Track E: 45% -> 45% (+0%)
- Track F: 99.6% -> 99.8% (+0.2%)
- Track G: 98% -> 99% (+1%)

## 남은 승인

VM Cloud 배포/restart는 `gdn/option-c-summary-api-deploy-approval-20260512.md` 승인 후 진행합니다.
