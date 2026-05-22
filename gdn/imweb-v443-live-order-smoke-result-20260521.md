# Imweb v4.4.3 live order smoke result - 2026-05-21

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - data/!data_inventory.md
    - gdn/attribution-data-source-decision-guide-20260511.md
  lane: Green
  allowed_actions:
    - read_only_public_ledger_api_check
    - read_only_live_html_marker_check
    - documentation_update
  forbidden_actions:
    - operating_db_write
    - vm_cloud_sqlite_write
    - platform_send_or_upload
    - gtm_publish
    - backend_deploy
  source_window_freshness_confidence:
    source: VM Cloud public attribution ledger API
    window: live order o20260521f6df2c6413140, logged 2026-05-21T11:06:45Z~11:07:04Z
    freshness: checked 2026-05-21 20:12 KST
    confidence: high for attribution ledger result, medium_high overall because direct SQLite file read was permission-blocked
```

## 결론

PASS_WITH_NOTES. TJ님이 2026-05-21 저녁 Google 광고 클릭 후 만든 가상계좌 미입금 주문은 VM Cloud attribution ledger에 정상 적재됐다. v4.4.3의 핵심 목표였던 stale `wbraid` 차단도 통과했다.

## 확인 주문

- 주문번호: `202605211207395`
- order_code: `o20260521f6df2c6413140`
- payment_code: `pa20260521f65615f4a69d6`
- 결제완료 URL: `/shop_payment_complete?order_code=o20260521f6df2c6413140&payment_code=pa20260521f65615f4a69d6&order_no=202605211207395&rk=S`
- 상태: `payment_success`, `paymentStatus=pending`
  - 해석: 가상계좌 주문 생성/미입금이므로 구매 확정 매출이 아니라 pending evidence다.

## 핵심 evidence

| 구분 | 결과 |
|---|---|
| payment_success 수신 | YES |
| request path | `/api/attribution/payment-success` |
| snippet | `2026-05-21-biocom-payment-success-v4-4-3` |
| split snippet | `2026-05-21-biocom-payment-split-v4-4-3` |
| checkout context | `2026-05-21-biocom-checkout-started-click-id-v4-3` |
| click context | `2026-05-21-biocom-click-id-bootstrap-v1-1` |
| Google click id present | YES |
| Google click id type | `gclid` |
| Google click id source | `checkout_context_v4_4_3` |
| guard version | `v4.4.3` |
| gclid | present |
| gbraid | present |
| wbraid | absent, length 0 |
| gad_campaignid | `21808018766` |
| UTM campaign | `googleads_testPM_mineral_url` |
| amount evidence | `109000` from referrer payment context |

Raw `gclid` / `gbraid` 값은 문서에 저장하지 않는다. 원장에는 evidence가 있고, 보고 문서에는 presence와 campaign id만 남긴다.

## 같은 checkoutId 흐름

| logged_at UTC | touchpoint | orderId | google_click_id_source | has_gclid | has_gbraid | has_wbraid |
|---|---|---|---|---:|---:|---:|
| 2026-05-21T11:06:45.792Z | payment_page_seen | 202605211207395 | document_referrer | true | true | false |
| 2026-05-21T11:06:45.837Z | checkout_started | 202605211207395 | document_referrer | true | true | false |
| 2026-05-21T11:06:52.179Z | payment_page_seen | blank in top row | current_url | true | true | false |
| 2026-05-21T11:06:52.183Z | payment_page_seen | blank in top row | current_url | true | true | false |
| 2026-05-21T11:07:04.484Z | payment_success | 202605211207395 | checkout_context_v4_4_3 | true | true | false |

## 해석

- 랜딩 URL을 따로 캡처하지 못해도 이번 주문은 checkout/payment evidence에서 랜딩 URL을 복원했다.
- `imweb_landing_url` 안에 `gad_campaignid=21808018766`, `gclid`, `gbraid`가 남아 있었다.
- v4.4.3은 오래된 storage의 stale `wbraid`를 끌고 오지 않고, 현재 여정의 `gclid+gbraid`만 결제완료 row로 전달했다.
- 이 주문은 가상계좌 미입금이므로 ROAS 분자에 바로 들어가는 confirmed 매출은 아니다. 입금 완료 후 confirmed bridge가 잡히는지 별도 확인해야 한다.

## 제약

- SSH로 VM Cloud SQLite 파일(`/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3`, `/home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3`) 직접 read는 현재 계정 권한으로 막혔다.
- 대신 같은 VM Cloud backend의 `/api/attribution/ledger` public read API로 확인했다.
- 운영DB write, VM Cloud write, GTM publish, 광고 플랫폼 전송은 하지 않았다.

## 다음 확인

1. 같은 주문이 실제 입금 완료되면 confirmed 전환으로 승격되는지 확인한다.
2. Google ROAS 화면에서는 이 주문을 `pending evidence`로만 표시하고, 입금 전에는 내부 confirmed ROAS 분자에서 제외한다.
3. paid_click_intent exact-click 진단은 별도 health로 계속 분리한다. 예산 판단용 정본은 attribution/payment evidence를 우선한다.
