# 더클린커피 GA4 Robust Guard Read-only 리포트

작성 시각: 2026-05-01 10:17 KST
site: `thecleancoffee`
phase: `read_only`
Primary source: GA4 BigQuery `project-dadba7dd-0229-4ff6-81c.analytics_326949178`
Freshness: `events_20260423`~`events_20260429`
Confidence: 90%

## 목적

더클린커피 주문번호 또는 NPay `channel_order_no`가 GA4 raw export에 이미 존재하는지 확인한다.

이 스크립트는 `already_in_ga4` guard 용도다. GA4 Measurement Protocol, Meta, TikTok, Google Ads로 어떤 전송도 하지 않는다.

## 추가 스크립트

```bash
cd backend
npm exec tsx scripts/coffee-ga4-robust-guard.ts -- \
  --startSuffix=20260423 \
  --endSuffix=20260429 \
  --ids=ORDER_NO,CHANNEL_ORDER_NO \
  --markdown
```

검색 범위:

- `ecommerce.transaction_id`
- `event_params.transaction_id`
- `event_params` 전체 value string/int/double/float

## Smoke Test

### Actual order id absent test

테스트 ID:

- `202604268287926`
- `2026042699576540`

결과:

| id | guard_status | events | purchase_events |
|---|---|---:|---:|
| `202604268287926` | `robust_absent` | 0 | 0 |
| `2026042699576540` | `robust_absent` | 0 | 0 |

### GA4 synthetic transaction id present test

테스트 ID:

- `NPAY - 202603127 - 1777286395026`

결과:

| id | guard_status | events | purchase_events | first_seen |
|---|---|---:|---:|---|
| `NPAY - 202603127 - 1777286395026` | `present` | 1 | 1 | 2026-04-27 19:39:55 |

해석:

1. 더클린커피 과거 GA4 NPay형 purchase는 Imweb `order_no`나 NPay `channel_order_no`를 직접 쓰지 않는 것으로 보인다.
2. GA4 synthetic transaction_id 기준 present 조회와 실제 주문번호 기준 absent 조회가 모두 동작한다.
3. 향후 복구/전송 검토 시 `order_number + channel_order_no` 둘 다 `robust_absent`인지 확인하는 guard로 쓸 수 있다.

## Auditor Verdict

```text
Auditor verdict: PASS
Phase: coffee_ga4_robust_guard_read_only
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
BigQuery read-only only: YES
Actual network send observed: NO
```

## 금지 유지

- DB write 금지
- GA4/Meta/TikTok/Google Ads 전송 금지
- GTM publish 금지
- 운영 endpoint 배포 금지
