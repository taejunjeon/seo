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
      "start": "2026-04-20",
      "end": "2026-05-19",
      "start_at": "2026-04-20T00:00:00+09:00",
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

결제완료 주문 2,260건 중 Google click id가 주문 evidence까지 남은 주문은 39건(1.73%)이다.
다만 전체 주문에는 Meta/Naver/Kakao/직접 유입이 섞여 있어, Google UTM 의심 주문 88건을 따로 봐야 한다. 이 묶음에서 주문 evidence까지 click id가 남은 주문은 39건(44.32%)이다.
따라서 다음 액션은 Google 광고 랜딩 시점 click id가 URL에서 고객 유입 장부와 결제 전 storage로 들어오는지 검증하는 것이다. Google Ads upload는 계속 0건으로 막는다.

## 핵심 숫자

| metric | value |
| --- | --- |
| total_orders | 2260 |
| total_revenue_krw | 523997922 |
| vm_order_evidence_orders | 1788 |
| vm_order_evidence_rate_pct | 79.12 |
| order_click_id_orders | 39 |
| order_click_id_rate_pct | 1.73 |
| order_evidence_no_click_id_orders | 1749 |
| prior_session_evidence_orders | 1726 |
| prior_google_click_id_orders | 43 |
| prior_click_lost_before_order_orders | 4 |
| google_like_orders | 88 |
| google_like_order_click_id_orders | 39 |
| google_like_order_click_id_rate_pct | 44.32 |
| google_like_prior_click_id_orders | 43 |
| send_candidate | 0 |

## 유실 지점별

| 유실 지점 | orders | share | revenue | 주문 click id | 과거 click id | 과거 세션 |
| --- | --- | --- | --- | --- | --- | --- |
| 초기 세션은 잡혔지만 Google click id가 없음 | 1683 | 74.47% | 464069188 | 0 | 0 | 1683 |
| 운영DB 결제완료 주문과 VM Cloud 주문 evidence 조인 없음 | 472 | 20.88% | 35976643 | 0 | 0 | 0 |
| 주문 evidence는 있지만 세션 키가 없음 | 48 | 2.12% | 11909485 | 0 | 0 | 0 |
| 보존 성공: 주문 evidence까지 Google click id가 남음 | 39 | 1.73% | 8285927 | 39 | 39 | 39 |
| 주문 evidence는 있지만 같은 세션의 이전 유입/체크아웃이 없음 | 14 | 0.62% | 3326564 | 0 | 0 | 0 |
| 초기 세션에는 click id가 있었지만 주문 evidence에는 없음 | 4 | 0.18% | 430115 | 0 | 4 | 4 |

## 소스 그룹별

| source group | orders | share | revenue | 주문 click id | 과거 click id | 과거 세션 |
| --- | --- | --- | --- | --- | --- | --- |
| crm_or_owned | 673 | 29.78% | 188204263 | 0 | 0 | 647 |
| meta | 611 | 27.04% | 187581010 | 0 | 0 | 585 |
| direct_or_unknown | 472 | 20.88% | 35976643 | 0 | 0 | 0 |
| naver | 279 | 12.35% | 75495167 | 0 | 0 | 273 |
| kakao | 74 | 3.27% | 7656666 | 0 | 0 | 73 |
| other | 63 | 2.79% | 15911600 | 0 | 0 | 63 |
| google_utm_like | 45 | 1.99% | 4456531 | 0 | 0 | 42 |
| google_click_id_observed | 43 | 1.9% | 8716042 | 39 | 43 | 43 |

## Google UTM 의심 주문만 본 유실 지점

| 유실 지점 | orders | share | revenue | 주문 click id | 과거 click id | 과거 세션 |
| --- | --- | --- | --- | --- | --- | --- |
| 초기 세션은 잡혔지만 Google click id가 없음 | 42 | 47.73% | 4296931 | 0 | 0 | 42 |
| 보존 성공: 주문 evidence까지 Google click id가 남음 | 39 | 44.32% | 8285927 | 39 | 39 | 39 |
| 초기 세션에는 click id가 있었지만 주문 evidence에는 없음 | 4 | 4.55% | 430115 | 0 | 4 | 4 |
| 주문 evidence는 있지만 세션 키가 없음 | 2 | 2.27% | 109800 | 0 | 0 | 0 |
| 주문 evidence는 있지만 같은 세션의 이전 유입/체크아웃이 없음 | 1 | 1.14% | 49800 | 0 | 0 | 0 |

## 결제수단별

| 결제수단 | orders | share | revenue | 주문 click id | 과거 click id | 과거 세션 |
| --- | --- | --- | --- | --- | --- | --- |
| homepage | 2089 | 92.43% | 491952022 | 21 | 24 | 1601 |
| npay | 171 | 7.57% | 32045900 | 18 | 19 | 125 |

## 해석

- 1차 병목: 전체 결제완료 주문에는 Meta/Naver/Kakao/직접 유입도 섞여 있다. 따라서 전체 click id 보존률은 시장 전체 숫자이고, 실제 개선 우선순위는 Google UTM 의심 주문 중 click id가 없는 묶음이다.
- 2차 병목: 운영DB 결제완료 주문이 VM Cloud 주문 evidence와 조인되지 않는 주문도 별도 병목이다. 이 경우 payment_success 또는 NPay intent/order bridge가 주문번호까지 못 가져온 것이다.
- 업로드 판단: send_candidate는 0건으로 유지한다. click id 유실 지점이 닫히기 전 Google Ads conversion upload는 열면 안 된다.

## Source / Window / Freshness

| 항목 | 값 |
| --- | --- |
| source | /tmp/bi-confirmed-purchase-operational-dry-run-20260520-2011-last30.json |
| vm_cloud_sqlite_snapshot | /tmp/vm-cloud-crm-20260520201104.sqlite3 |
| upstream_generated_at_kst | 2026-05-20 20:11:44 KST |
| window | {"start":"2026-04-20","end":"2026-05-19","start_at":"2026-04-20T00:00:00+09:00","end_exclusive_at":"2026-05-20T00:00:00+09:00","timezone_note":"operational order paidAt filter uses KST day boundaries converted to timestamptz. This avoids excluding KST orders that are still previous-day UTC."} |
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
