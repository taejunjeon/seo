# Metric Data Contract

## 공통 필드

프론트가 각 숫자를 표시할 때 아래 메타 정보를 함께 받아야 한다.

```json
{
  "source": "VM Cloud attribution_ledger | Meta CAPI send log | Meta Ads Insights API | Browser pixel observation",
  "unit": "event row | unique order | send attempt / event_id | ad-attributed purchase",
  "window": "today | yesterday | last_24h | last_7d",
  "site": "biocom | thecleancoffee | all_sites",
  "pixel_id": "1283400029487161 | 1186437633687388 | null",
  "last_updated_at": "KST timestamp",
  "caveat": "human-readable limitation"
}
```

## 프론트 필드

### `meta_roas_internal`

의미: 내부 confirmed 매출 기준 ROAS. 광고 플랫폼 주장이 아니라 VM Cloud confirmed purchase와 ad spend를 맞춘 내부 판단값이다.

필수 하위 필드:
- `confirmed_purchase_count`
- `confirmed_purchase_value_krw`
- `ad_spend_krw`
- `roas`
- `budget_roas_included`
- `source`
- `unit`
- `window`
- `site`
- `pixel_id`
- `caveat`

### `meta_roas_ads_manager`

의미: Meta Ads Manager가 주장하는 구매/매출/ROAS. 내부 매출과 합산하지 않고 비교값으로 둔다.

필수 하위 필드:
- `ads_purchase_count`
- `ads_purchase_value_krw`
- `ads_spend_krw`
- `ads_roas`
- `attribution_window`
- `same_day_lag_possible`
- `source`
- `caveat`

### `capi_health`

의미: 서버가 Meta에 Purchase를 보내는 통로가 살아 있는지.

필수 하위 필드:
- `last_success_at_kst`
- `last_1h.attempted/success/events_received/failed`
- `today.attempted/success/events_received/failed`
- `last_7d.attempted/success/events_received/failed`
- `pixel_id`
- `site`
- `all_sites_mode`
- `no_send_reasons`

### `browser_purchase_health`

의미: 브라우저 픽셀 Purchase가 보이는지. 현재는 Server CAPI가 살아 있으면 보조 리스크로 본다.

필수 하위 필드:
- `browser_purchase_count`
- `available`
- `not_available_reason`
- `risk_level`
- `caveat`

### `missing_queue`

의미: 실제 결제완료는 확인됐지만 CAPI send log와 아직 안 붙은 후보.

필수 하위 필드:
- `confirmed_eligible_unsent_count`
- `confirmed_eligible_unsent_amount_krw`
- `oldest_age_minutes`
- `classification`
- `backfill_ready`
- `legacy_missing_payment_key`
- `no_send_guard`
- `duplicate_or_already_sent`
- `needs_toss_or_imweb_confirm`

### `action_queue`

의미: 사람이 지금 어디를 봐야 하는지.

필수 하위 필드:
- `priority`
- `title`
- `detail`
- `next_action`
- `count`
- `amount_krw`
- `explanation_ko`

### `metric_caveats`

의미: 숫자 해석 주의사항.

필수 caveat:
- CAPI success는 Meta가 event를 받은 숫자이지 Meta 광고 기여 확정값이 아니다.
- Ads Manager ROAS는 플랫폼 귀속값이다.
- 내부 confirmed ROAS는 실제 결제완료 원장 기준이다.
- Browser Purchase 0은 Server CAPI가 정상일 때 보조 리스크다.
- fbp만으로 Meta 광고 유입이라고 판단하지 않는다.
