# Google Ads VM confirmed 우선 후보 생성기 보강 결과 - 2026-05-27

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/npay-recovery/README.md
  required_context_docs:
    - project/google-ads-private-payload-preview-implementation-20260526.md
    - project/google-ads-upload-ledger-write-smoke-final-20260526.md
  lane:
    code_change: Yellow
    api_smoke: Green
    google_ads_send: Red_not_executed
  allowed_actions:
    - VM Cloud backend route deploy within prior approval
    - read-only API smoke
    - no-send payload preview
  forbidden_actions:
    - Google Ads conversion upload
    - operational DB write
    - GTM publish
    - raw click id exposure in report
  source_window_freshness_confidence:
    source: VM Cloud SQLite attribution_ledger + imweb_orders + VM Cloud live API
    window: rolling_24h
    freshness: live API checked 2026-05-27 KST
    confidence: high_for_order_candidate / medium_for_exact_pending_cause
```

## 한 줄 결론

이번 Google 광고 테스트 주문은 VM Cloud의 `payment_success confirmed` 기준으로 실제 결제완료 후보에 잡혔다. Google Ads 전송은 하지 않았고, no-send preview에서만 후보 1건으로 확인했다.

## 기준 주문

- 주문번호: `202605268567938`
- order_code: `o20260526c2be3043f923b`
- 결제완료 URL 관측 시각: 2026-05-26 23:55 KST
- 원문 Google click id: 문서에 기록하지 않음

## 확인 결과

### VM Cloud 결제 판단

`/api/attribution/payment-decision` 결과:

- status: `confirmed`
- browserAction: `allow_purchase`
- matchedBy: `ledger_order_id`
- reason: `fast_ledger_confirmed_positive_exact_match`
- fastPath source: `VM Cloud SQLite attribution_ledger`
- operationalDb: `attempted=false`, `skippedReason=fast_ledger_decision_returned`

해석: 이 주문의 결제완료 판단은 운영DB가 아니라 VM Cloud 보조 원장에서 먼저 확정됐다.

### VM Cloud 원장 row

`attribution_ledger` read-only 결과:

| touchpoint | status | approved_at UTC | logged_at UTC | created_at UTC | Google click id |
|---|---|---:|---:|---:|---|
| payment_page_seen | blank | blank | 2026-05-26T14:53:26.658Z | 2026-05-26 14:53:26 | 있음 |
| checkout_started | blank | blank | 2026-05-26T14:53:26.730Z | 2026-05-26 14:53:26 | 있음 |
| payment_success | confirmed | 2026-05-26T14:55:44.000Z | 2026-05-26T14:55:49.445Z | 2026-05-26 14:55:51 | 있음 |

`imweb_orders` read-only 결과:

- pay_type: `card`
- pg_type: `tosspayments`
- total_price/payment_amount: `35000`
- synced_at: `2026-05-26 15:43:48` UTC

해석: 결제완료 판정에는 `imweb_orders` sync를 기다릴 필요가 없었다. VM Cloud `payment_success confirmed` row가 더 빠른 정본으로 쓰였다.

## no-send 후보 생성기 결과

`/api/google-ads/confirmed-purchase/private-payload-preview?site=biocom&window=rolling_24h&limit=5`

- sourceOrderRows: 99
- exactGclidActualPurchaseRows: 1
- returnedCandidates: 1
- privateRawValueChecksPassed: 1
- uploadCandidateCount: 0
- sendCandidateCount: 0
- rawOrderIdInResponse: false
- rawClickIdInResponse: false
- externalSendCount: 0
- operationalDbWrite: 0
- vmCloudWrite: 0
- googleAdsWrite: 0

후보 내용:

- amountKrw: `35000`
- paymentMethod: `card`
- paymentStatus: `PAYMENT_COMPLETE`
- evidence source: `payment_success_ledger`
- exactClickIdType: `gclid`
- Google click id 있음
- 실제 전송 차단 사유:
  - `google_ads_conversion_upload_not_approved`
  - `google_ads_upload_ledger_not_connected`

## pending으로 보였던 이유

현재 남아 있는 확정 증거만으로는 “정확히 어떤 순간에 pending이 반환됐는지”를 100% 재현할 수 없다. `attribution_ledger`에 status history/updated_at이 없기 때문이다.

다만 현재 근거상 가장 가능성이 높은 원인은 운영DB가 아니라 VM Cloud 원장 반영 타이밍이다.

1. 결제 승인 시각은 `14:55:44Z`.
2. VM Cloud `payment_success confirmed`가 원장에 보인 시각은 `14:55:49Z~14:55:51Z`.
3. payment-decision fast wait는 최대 약 2초만 기다린다.
4. 결제완료 페이지가 row 생성보다 먼저 payment-decision을 호출하면, 그 순간에는 pending/unknown처럼 보일 수 있다.
5. 지금 재조회에서는 fastPath가 1회 시도, wait 0ms로 바로 confirmed를 반환한다.

판정: `pending`은 운영DB 판단이 아니라, VM Cloud `payment_success confirmed` row가 보이기 전의 짧은 동기화/호출 순서 문제였을 가능성이 높다.

## 이번 변경

- Google Ads 실제 구매 후보 생성기가 운영DB row만 보지 않고 VM Cloud `payment_success confirmed` row를 함께 읽도록 보강했다.
- 같은 주문이 운영DB에 늦게 들어오더라도 VM confirmed row가 있으면 실제 구매 후보로 잡힌다.
- VM confirmed 후보의 결제수단 표시가 metadata의 `free`에 끌려가지 않도록, 아임웹 `pay_type/pg_type`을 우선하도록 고쳤다.
- VM confirmed 후보와 아임웹 주문을 붙일 때 빈 문자열 key가 다른 주문의 빈 `channel_order_no`와 매칭될 수 있는 문제를 막았다. 빈 key는 절대 매칭되지 않는 sentinel 값으로 채운다.

## 아직 하지 않은 것

- Google Ads 실제 전환 전송: 하지 않음
- 운영DB write: 하지 않음
- GTM publish: 하지 않음
- VM Cloud 장부 write smoke: 이 문서 범위에서는 새로 실행하지 않음

## 다음 판단

실제 구매 전용 Google Ads 주 전환을 시작하려면 다음 두 가지가 남아 있다.

1. Google Ads upload ledger를 실제 write smoke로 연결해 중복 전송 방지 장부를 확정한다.
2. Google Ads limited upload는 별도 Red 승인 후 최대 1~2건만 시작한다.
