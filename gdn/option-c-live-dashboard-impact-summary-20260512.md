---
harness_preflight:
  lane: Green impact summary
  allowed_actions: [read_only_live_api_summary, document_update]
  forbidden_actions: [operational_db_write, platform_send_upload, gtm_publish, cron_registration]
  source_window_freshness_confidence: "live summary API refresh 2026-05-12 22:11 KST / confidence 94%"
---

# Option C Live Dashboard Impact Summary

이제 화면은 “NPay가 결제됐는가”와 “아임웹 `complete_time`이 채워졌는가”를 같은 값으로 보지 않습니다. 예산 판단은 실제 결제완료 주문 기준을 보고, `complete_time`은 왜 숫자가 달라지는지 설명하는 진단값으로만 남습니다.

## 무엇이 바뀌었나

| site | 예산 판단에 쓸 값 | 참고만 볼 값 | 아직 연결이 필요한 값 |
|---|---:|---:|---:|
| biocom | actual confirmed 163건 / ₩29,500,200 | legacy complete_time 127건 / ₩25,168,000 | bridge pending 61건 / ₩8,108,600 |
| thecleancoffee | 아직 없음, bridge_pending 유지 | legacy complete_time 261건 / ₩11,182,700 | bridge pending 76건 / ₩5,110,600 |

## 화면이 오래돼 보였던 이유

기존 화면은 `complete_time`이 채워진 NPay row만 사실상 결제완료처럼 보았습니다. 그런데 `complete_time`은 NPay 실제 결제완료 primary가 아니라 lifecycle/sync 진단값입니다. 그래서 결제는 끝났지만 `complete_time`이 비어 있는 주문이 화면에서 누락되거나 오래된 값처럼 보였습니다.

## 이번 배포로 가능해진 것

- biocom은 운영DB `PAYMENT_COMPLETE` 기준 actual confirmed NPay 매출을 바로 볼 수 있습니다.
- 기존 `complete_time` 값은 삭제하지 않고 legacy diagnostic으로 남아 차이를 설명할 수 있습니다.
- `complete_time` 공백 NPay row는 미결제가 아니라 bridge pending으로 분리됩니다.
- 더클린커피는 site 격리 전 actual included로 오염되지 않습니다.

## 아직 campaign attribution과 다른 점

이 작업은 “실제 결제완료 NPay 매출이 얼마인가”를 고친 것입니다. “그 NPay 주문이 어느 Google Ads 캠페인에서 왔는가”는 아직 별도 작업입니다. 캠페인 판단에는 Google click id exact evidence, 주문 bridge, upload Red 승인안이 추가로 필요합니다.
