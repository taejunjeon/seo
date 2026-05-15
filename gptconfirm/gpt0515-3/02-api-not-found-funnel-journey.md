# 02. API Not Found Funnel Journey

작성 시각: 2026-05-15 01:16 KST

## 결론

API not found 48건은 현재 기준 `payment_page_artifact_only`다. 48/48건 모두 Meta send 후보가 아니다.

이 row들은 결제완료 주문이 아니라, `/shop_payment/` 결제 진행 페이지에서 footer v4.3이 VM Cloud `payment_success` endpoint로 보낸 후보다.

## Source / Window / Freshness

- source: VM Cloud SQLite `attribution_ledger`, VM Cloud SQLite `npay_intent_log`, gpt0515-2 Imweb/운영DB fallback evidence.
- window: 2026-05-14 13:00 KST 이후 중심, `logged_at >= 2026-05-14T04:00:00Z`.
- freshness: 2026-05-15 01:16 KST.
- site: biocom.
- confidence: 0.88.

## 공통 funnel journey

1. 사용자가 `biocom.kr/shop_payment/` 결제 진행 페이지에 들어간다.
2. footer v4.3이 URL의 order key presence를 읽는다.
3. footer v4.3이 VM Cloud `/api/attribution/payment-success`로 전송한다.
4. VM Cloud는 `touchpoint=payment_success`, `payment_status=pending`으로 저장한다.
5. 운영DB `PAYMENT_COMPLETE` 또는 Imweb API confirmed status가 닫히면 confirmed 후보가 된다.
6. 정본이 닫히지 않으면 API not found 또는 pending artifact로 남는다.

## current aggregate

- current pending rows: 69.
- `snippetVersion=2026-05-14-biocom-payment-success-click-id-v4-3`: 69/69.
- request path `/api/attribution/payment-success`: 69/69.
- URL pattern `/shop_payment/`: 69/69.
- fbp present: 69/69.
- fbc present: 27/69.
- fbclid present: 22/69.
- GA4 join key present: 13/69.
- payment_key/value/transaction_id/order_member present: 0/69.
- NPay intent same-window rows: 48.
- NPay intent join to current pending by client/session/fbp/fbc: 0.

## row-level safe_ref classification

safe_ref는 raw order id를 쓰지 않는 보고용 참조다. 실제 raw key는 secure debug evidence 안에서만 사용했다.

| safe_ref | origin | URL class | GTM origin | FBE/browser origin | NPay actual | GA4 row join | final class | Meta send |
|---|---|---|---|---|---|---|---|---|
| API-NF-001 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-002 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-003 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-004 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-005 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-006 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-007 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-008 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-009 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-010 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-011 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-012 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-013 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-014 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-015 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-016 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-017 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-018 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-019 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-020 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-021 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-022 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-023 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-024 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-025 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-026 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-027 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-028 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-029 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-030 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-031 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-032 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-033 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-034 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-035 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-036 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-037 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-038 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-039 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-040 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-041 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-042 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-043 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-044 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-045 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-046 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-047 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |
| API-NF-048 | footer_v4_3 | shop_payment | no | no | no | limited | A. payment_page_artifact_only | no-send |

## A-I classification count

- A. payment_page_artifact_only: 48.
- B. checkout_started_no_payment: 0 separately confirmed. A bucket already means checkout/payment page reached but no payment confirmation.
- C. payment_method_selected_unpaid: 0 confirmed. selected payment method is not captured yet.
- D. virtual_account_issued_unpaid: 0 confirmed. virtual account issue flag is not captured yet.
- E. card_payment_attempt_failed_or_unknown: 0 confirmed. payment attempt result is not captured yet.
- F. npay_clicked_no_actual: 0 in this 48 set by available join. VM Cloud NPay intent same-window exists, but pending join is 0.
- G. actual_order_but_key_mapping_error: 0 confirmed.
- H. actual_order_confirmed: 0.
- I. unknown_need_admin_ui: 0 within this 48 after current artifact classification. Latest growth beyond 48 can still need admin UI if source changes.

## GA4 / scroll / dwell status

Current VM Cloud row does not store scroll depth or dwell time.

GA4 join is partially possible because current 69 pending rows have GA4 keys in 13 rows only. That means row-level GA4 journey can be enriched for a minority of rows, not all rows.

What can be checked with GA4 when keys exist:

- page_view
- view_item
- add_to_cart
- begin_checkout
- add_payment_info
- purchase
- engagement_time_msec
- scroll event or custom scroll90

What is missing:

- GA4 does not prove actual order payment by itself.
- GA4 purchase revenue is not actual purchase source.
- Rows without GA4 join keys cannot get row-level dwell/scroll from GA4.

## NPay journey status

VM Cloud NPay intent same-window rows exist, but they did not join to current pending rows.

- NPay intent rows after cutoff: 48.
- Current pending join by client/session/fbp/fbc: 0.
- NPay actual connection: 0.

Therefore these API not found rows are not NPay actual purchase candidates.

## no-send decision

API not found 48건은 Meta send 후보 0이다.

Reason:

- completion URL 없음.
- payment_key 없음.
- transaction_id 없음.
- value 없음.
- 운영DB PAYMENT_COMPLETE match 없음.
- Imweb confirmed status 없음.
- NPay actual match 없음.
- footer v4.3 `/shop_payment/` artifact pattern.
