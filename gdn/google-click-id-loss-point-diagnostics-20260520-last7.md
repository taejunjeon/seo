작성 시각: 2026-05-20 20:21:06 KST
기준일: 2026-05-20
문서 성격: Google Ads click id 유실 지점 read-only 진단

```yaml
harness_preflight: {
  "common_harness_read": [
    "harness/common/HARNESS_GUIDELINES.md",
    "harness/common/AUTONOMY_POLICY.md",
    "harness/common/REPORTING_TEMPLATE.md"
  ],
  "project_harness_read": [
    "AGENTS.md",
    "docs/agent-harness/growth-data-harness-v0.md",
    "harness/npay-recovery/README.md",
    "gdn/attribution-data-source-decision-guide-20260511.md",
    "data/!data_inventory.md"
  ],
  "lane": "Green",
  "allowed_actions": [
    "read_only_vm_cloud_sqlite",
    "read_only_operational_dry_run_input",
    "local_report_write"
  ],
  "forbidden_actions": [
    "operating_db_write",
    "vm_cloud_write",
    "platform_send_or_upload",
    "gtm_publish",
    "deploy_or_restart"
  ],
  "source_window_freshness_confidence": {
    "source": "운영DB tb_iamweb_users no-send dry-run + VM Cloud SQLite snapshot",
    "window": {
      "start": "2026-05-13",
      "end": "2026-05-19",
      "start_at": "2026-05-13T00:00:00+09:00",
      "end_exclusive_at": "2026-05-20T00:00:00+09:00",
      "timezone_note": "operational order paidAt filter uses KST day boundaries converted to timestamptz. This avoids excluding KST orders that are still previous-day UTC."
    },
    "freshness": "2026-05-20 20:11:44 KST",
    "confidence": "medium_high"
  }
}
```

# Google Ads click id 유실 지점 진단

## 10초 요약

결제완료 주문 475건 중 Google click id가 주문 evidence까지 남은 주문은 9건(1.89%)이다.
다만 전체 주문에는 Meta/Naver/Kakao/직접 유입이 섞여 있어, Google UTM 의심 주문 22건을 따로 봐야 한다. 이 묶음에서 주문 evidence까지 click id가 남은 주문은 9건(40.91%)이다.
따라서 다음 액션은 Google 광고 랜딩 시점 click id가 URL에서 고객 유입 장부와 결제 전 storage로 들어오는지 검증하는 것이다. Google Ads upload는 계속 0건으로 막는다.

## 핵심 숫자

| metric | value |
| --- | --- |
| total_orders | 475 |
| total_revenue_krw | 122874695 |
| vm_order_evidence_orders | 385 |
| vm_order_evidence_rate_pct | 81.05 |
| order_click_id_orders | 9 |
| order_click_id_rate_pct | 1.89 |
| order_evidence_no_click_id_orders | 376 |
| prior_session_evidence_orders | 367 |
| prior_google_click_id_orders | 11 |
| prior_click_lost_before_order_orders | 2 |
| google_like_orders | 22 |
| google_like_order_click_id_orders | 9 |
| google_like_order_click_id_rate_pct | 40.91 |
| google_like_prior_click_id_orders | 11 |
| send_candidate | 0 |

## 유실 지점별

| 유실 지점 | orders | share | revenue | 주문 click id | 과거 click id | 과거 세션 |
| --- | --- | --- | --- | --- | --- | --- |
| 초기 세션은 잡혔지만 Google click id가 없음 | 356 | 74.95% | 107157255 | 0 | 0 | 356 |
| 운영DB 결제완료 주문과 VM Cloud 주문 evidence 조인 없음 | 90 | 18.95% | 9588368 | 0 | 0 | 0 |
| 주문 evidence는 있지만 세션 키가 없음 | 18 | 3.79% | 4404430 | 0 | 0 | 0 |
| 보존 성공: 주문 evidence까지 Google click id가 남음 | 9 | 1.89% | 1574527 | 9 | 9 | 9 |
| 초기 세션에는 click id가 있었지만 주문 evidence에는 없음 | 2 | 0.42% | 150115 | 0 | 2 | 2 |

## 소스 그룹별

| source group | orders | share | revenue | 주문 click id | 과거 click id | 과거 세션 |
| --- | --- | --- | --- | --- | --- | --- |
| crm_or_owned | 153 | 32.21% | 48954536 | 0 | 0 | 146 |
| meta | 129 | 27.16% | 42492290 | 0 | 0 | 120 |
| direct_or_unknown | 90 | 18.95% | 9588368 | 0 | 0 | 0 |
| naver | 43 | 9.05% | 11186152 | 0 | 0 | 42 |
| other | 20 | 4.21% | 5264600 | 0 | 0 | 20 |
| kakao | 18 | 3.79% | 2351307 | 0 | 0 | 18 |
| google_click_id_observed | 11 | 2.32% | 1724642 | 9 | 11 | 11 |
| google_utm_like | 11 | 2.32% | 1312800 | 0 | 0 | 10 |

## Google UTM 의심 주문만 본 유실 지점

| 유실 지점 | orders | share | revenue | 주문 click id | 과거 click id | 과거 세션 |
| --- | --- | --- | --- | --- | --- | --- |
| 초기 세션은 잡혔지만 Google click id가 없음 | 10 | 45.45% | 1263000 | 0 | 0 | 10 |
| 보존 성공: 주문 evidence까지 Google click id가 남음 | 9 | 40.91% | 1574527 | 9 | 9 | 9 |
| 초기 세션에는 click id가 있었지만 주문 evidence에는 없음 | 2 | 9.09% | 150115 | 0 | 2 | 2 |
| 주문 evidence는 있지만 세션 키가 없음 | 1 | 4.55% | 49800 | 0 | 0 | 0 |

## 결제수단별

| 결제수단 | orders | share | revenue | 주문 click id | 과거 click id | 과거 세션 |
| --- | --- | --- | --- | --- | --- | --- |
| homepage | 445 | 93.68% | 116707595 | 6 | 8 | 338 |
| npay | 30 | 6.32% | 6167100 | 3 | 3 | 29 |

## 해석

- 1차 병목: 전체 결제완료 주문에는 Meta/Naver/Kakao/직접 유입도 섞여 있다. 따라서 전체 click id 보존률은 시장 전체 숫자이고, 실제 개선 우선순위는 Google UTM 의심 주문 중 click id가 없는 묶음이다.
- 2차 병목: 운영DB 결제완료 주문이 VM Cloud 주문 evidence와 조인되지 않는 주문도 별도 병목이다. 이 경우 payment_success 또는 NPay intent/order bridge가 주문번호까지 못 가져온 것이다.
- 업로드 판단: send_candidate는 0건으로 유지한다. click id 유실 지점이 닫히기 전 Google Ads conversion upload는 열면 안 된다.

## Source / Window / Freshness

| 항목 | 값 |
| --- | --- |
| source | /tmp/bi-confirmed-purchase-operational-dry-run-20260520-2011-last7.json |
| vm_cloud_sqlite_snapshot | /tmp/vm-cloud-crm-20260520201104.sqlite3 |
| upstream_generated_at_kst | 2026-05-20 20:11:44 KST |
| window | {"start":"2026-05-13","end":"2026-05-19","start_at":"2026-05-13T00:00:00+09:00","end_exclusive_at":"2026-05-20T00:00:00+09:00","timezone_note":"operational order paidAt filter uses KST day boundaries converted to timestamptz. This avoids excluding KST orders that are still previous-day UTC."} |
| lookback_days | 30 |
| confidence | medium_high |

## Guardrails

```text
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES
raw order/payment/member/click id output: 0
```
