# NPay Intent Matching Dry-Run

harness_preflight:
  common_harness_read: true
  project_harness_read: true
  required_context_docs:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - naver/!npayroas.md
  lane: Green
  allowed_actions:
    - read_only_vm_cloud_query
    - documentation
  forbidden_actions:
    - vm_cloud_write
    - platform_send
    - conversion_upload
    - send_candidate_true
  source_window_freshness_confidence: "2026-05-10 KST / VM Cloud SQLite read-only / confidence 0.86"

작성: 2026-05-10 KST

## 결론

VM Cloud `npay_intent_log`에는 최근 NPay 주문 근처의 intent 후보가 존재한다. 하지만 24h window에는 후보가 많고, 단순 time-window-only matching은 ambiguous가 크므로 Google Ads/GA4 upload 후보로 쓰면 안 된다.

Source: `data/npay-intent-matching-dry-run-20260510.json`

| order_no | channel_order_no | amount | 24h 후보 수 | 금액+click 후보 수 | dry-run verdict |
|---|---|---:|---:|---:|---|
| `202605109700078` | `2026051018534650` | 117000 | 50 | 0 | ambiguous_or_missing |
| `202605104467942` | `2026051018446030` | 39000 | 50 | 8 | candidate_present, but ambiguous |
| `202605101857504` | `2026051018061950` | 531000 | 50 | 0 | ambiguous_or_missing |
| `202605080592304` | `2026050865473610` | 59800 | 50 | multiple | candidate_present, but ambiguous |

## 해석

- `channel_order_no -> order_no` 매핑은 가능하다.
- `npay_intent_log`에는 click id가 있는 후보가 존재한다.
- 그러나 같은 시간창에 후보가 많아 `last eligible click`/session/client/order identity rule 없이는 자동 attribution으로 쓰지 않는다.
- `send_candidate=false`, `actual_send_candidate=false`, platform send 0을 유지한다.

## 다음 Green

ConfirmedPurchasePrep 쪽은 NPay confirmed source guard를 먼저 닫고, NPay intent matching은 별도 reliability rule에서 `exact session`, `same client`, `amount/product`, `last eligible click`, `ambiguous` 분리를 적용한다.

