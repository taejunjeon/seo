# NPay Channel Order Mapping Dry-Run

harness_preflight:
  common_harness_read: true
  project_harness_read: true
  required_context_docs:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - naver/!npay.md
  lane: Green
  allowed_actions:
    - read_only_vm_cloud_query
    - documentation
  forbidden_actions:
    - vm_cloud_write
    - operating_db_write
    - platform_send
    - conversion_upload
  source_window_freshness_confidence: "2026-05-10 KST / VM Cloud SQLite read-only / confidence 0.92"

작성: 2026-05-10 KST

## 결론

TJ님이 공유한 NPay channel order 4건은 VM Cloud SQLite `imweb_orders`에서 모두 `channel_order_no -> order_no`로 매핑됐다. 다만 최근 3건은 `complete_time=null`, `imweb_status=''`라서 VM Cloud status blank만으로 미결제 차단하면 안 된다.

Source: `data/npay-channel-order-mapping-dry-run-20260510.json`

| order_no | channel_order_no | amount | complete_time | imweb_status | 해석 |
|---|---|---:|---|---|---|
| `202605109700078` | `2026051018534650` | 117000 | blank | blank | 관리자-confirmed/운영DB primary 확인 필요 |
| `202605104467942` | `2026051018446030` | 39000 | blank | blank | 관리자 화면 `N 결제 완료` 확인됨 |
| `202605101857504` | `2026051018061950` | 531000 | blank | blank | 관리자 화면 `N 결제 완료` 확인됨 |
| `202605080592304` | `2026050865473610` | 59800 | `2026-05-09T05:32:00.000Z` | blank | lifecycle complete_time은 늦게 채워질 수 있음 |

## 사용 방법

이 dry-run은 주문번호 매핑 증거다. 결제완료 여부의 primary source는 운영DB `PAYMENT_COMPLETE` 또는 관리자-confirmed evidence로 둔다.

