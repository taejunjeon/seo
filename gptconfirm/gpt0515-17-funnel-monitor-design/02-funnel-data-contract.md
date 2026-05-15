# 02. Funnel Data Contract

작성 시각: 2026-05-15 KST

## 권장 API

첫 구현은 기존 API에 억지로 붙이지 말고 전용 read-only endpoint로 둔다.

```text
GET /api/attribution/funnel-health
```

Query:

```text
site=biocom
window=1d|7d|14d|30d
granularity=day|week
paymentMethod=all|card|npay|virtual_account|bank_transfer|other
source=all|meta|google|naver|organic|direct|utm_present|utm_missing
```

## 응답 shape 초안

```json
{
  "ok": true,
  "site": "biocom",
  "window": "1d",
  "granularity": "day",
  "checked_at_kst": "2026-05-15 14:30",
  "source_summary": {
    "primary": "VM Cloud attribution_ledger",
    "cross_check": ["Meta CAPI send log", "운영DB PAYMENT_COMPLETE", "Imweb/Toss direct when available"],
    "freshness": "fresh",
    "confidence": "medium_high"
  },
  "status": {
    "label": "주의",
    "main_issue": "Browser Purchase weak while CAPI is alive",
    "next_action": "완료 URL에서 payment-decision 200과 ev=Purchase를 확인"
  },
  "kpis": {
    "vm_order_signals": { "count": 0, "amount_krw": 0, "source": "VM Cloud attribution_ledger" },
    "payment_started": { "count": 0, "source": "payment_page_seen + InitiateCheckout" },
    "confirmed_purchases": { "count": 0, "amount_krw": 0, "source": "VM Cloud confirmed + direct checks" },
    "meta_capi_success": { "count": 0, "events_received": 0, "source": "Meta CAPI send log" },
    "browser_purchase": { "count": 0, "source": "browser pixel network observation" },
    "unmatched": { "count": 0, "amount_krw": 0, "source": "VM Cloud classifier" }
  },
  "funnel": [
    { "step": "landing", "label": "유입", "count": 0, "rate_from_previous": null, "status": "normal" },
    { "step": "add_to_cart", "label": "장바구니", "count": 0, "rate_from_previous": 0, "status": "normal" },
    { "step": "payment_started", "label": "결제 시작", "count": 0, "rate_from_previous": 0, "status": "warning" },
    { "step": "payment_method_selected", "label": "결제수단 선택", "count": 0, "rate_from_previous": 0, "status": "unknown" },
    { "step": "confirmed_purchase", "label": "실제 결제완료", "count": 0, "rate_from_previous": 0, "status": "normal" },
    { "step": "meta_capi_success", "label": "Meta CAPI 성공", "count": 0, "rate_from_previous": 0, "status": "normal" },
    { "step": "browser_purchase", "label": "Browser Purchase", "count": 0, "rate_from_previous": 0, "status": "warning" }
  ],
  "series": [
    {
      "date": "2026-05-15",
      "payment_started": 0,
      "confirmed_purchases": 0,
      "meta_capi_success": 0,
      "browser_purchase": 0,
      "unmatched": 0
    }
  ],
  "utm_breakdown": [
    {
      "channel": "meta",
      "human_label": "Meta 광고",
      "landing_count": 0,
      "payment_started_count": 0,
      "confirmed_purchase_count": 0,
      "meta_capi_success_count": 0,
      "unmatched_count": 0,
      "budget_roas_included": false,
      "next_action": "Meta evidence와 confirmed purchase bridge 확인"
    }
  ],
  "unmatched_reasons": [
    {
      "reason": "payment_decision_timeout_or_canceled",
      "human_label": "결제완료 판단 요청이 브라우저에서 끊김",
      "count": 0,
      "amount_krw": 0,
      "confidence": "high",
      "budget_roas_included": false,
      "next_action": "Header Guard v3.1 적용 후 canceled 재발 여부 확인"
    }
  ],
  "capi_health": {
    "last_success_at_kst": null,
    "last_1h": { "attempted": 0, "success": 0, "events_received": 0, "failed": 0 },
    "today": { "attempted": 0, "success": 0, "events_received": 0, "failed": 0 },
    "last_7d": { "attempted": 0, "success": 0, "events_received": 0, "failed": 0 },
    "no_send_reasons": []
  },
  "guardrails": {
    "raw_identifier_output": 0,
    "platform_send_from_this_endpoint": 0,
    "operational_db_write": 0
  }
}
```

## Source 원칙

### VM Cloud

이 화면의 primary source다.

사용:

- `attribution_ledger`
- `payment_page_seen`
- `checkout_started`
- `payment_success`
- confirmed/pending/no-send status
- Meta CAPI send log

### 운영DB

cross-check로만 사용한다.

이유:

- 운영DB sync가 실시간이 아닐 수 있다.
- 결제 직후 Browser Purchase 판단에는 VM Cloud/Toss/Imweb direct가 더 빠르다.

### Meta UI

표시 지연이 있으므로 참고용이다.

사용:

- Meta Events Manager 화면 대조
- event match quality
- 데이터 신선도

### GA4

유입 퍼널 교차검증 source다. 실제 결제완료 매출 정본으로 쓰지 않는다.

## 상태 판정 규칙

정상:

- 실제 결제완료 대비 Meta CAPI 성공률 95% 이상
- payment-decision canceled 0 또는 매우 낮음
- payment_page_seen이 payment_success로 오염되지 않음

주의:

- 결제완료는 있으나 Browser Purchase가 약함
- 결제 시작은 늘었는데 결제완료가 급감
- UTM 있음 row가 결제완료와 안 붙음
- CAPI success rate 80-95%

긴급:

- 결제완료 있는데 CAPI success 0
- payment_success confirmed가 no-send로 대량 빠짐
- 미입금/가상계좌가 Purchase로 들어감
- raw identifier 노출
- CAPI error 증가
