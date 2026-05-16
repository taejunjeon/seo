# `/api/ads/roas-summary` contract

## 목적

프론트가 여러 기간 ROAS를 한 번에 요청하게 한다. 응답은 aggregate summary만 포함하고 raw ledger items는 포함하지 않는다.

## 요청

```http
GET /api/ads/roas-summary?account_id=act_3138805896402376&presets=today,yesterday,last_7d
```

## 응답 핵심

```json
{
  "ok": true,
  "account_id": "act_3138805896402376",
  "presets": ["today", "yesterday", "last_7d"],
  "valid_presets": ["today", "yesterday", "last_7d"],
  "union_range": {
    "startDate": "2026-05-09",
    "endDate": "2026-05-16"
  },
  "batch": {
    "mode": "aggregate_summary",
    "ledger_fetch_count": 1,
    "raw_ledger_items_returned": 0,
    "fallback_prevented": true
  },
  "metric_contract": {
    "source": {
      "revenue": "VM Cloud attribution ledger",
      "spend": "Meta Ads Insights API"
    },
    "unit": {
      "revenue": "unique confirmed/pending ledger order matched to Meta evidence",
      "spend": "KRW campaign spend",
      "roas": "attributedRevenue / spend"
    },
    "caveat": "Ads Manager가 주장하는 platform ROAS가 아니라 내부 attribution ledger 기준 ATT ROAS다."
  },
  "results": {
    "today": {
      "ok": true,
      "summary": {
        "spend": 0,
        "attributedRevenue": 0,
        "roas": null,
        "orders": 0
      }
    }
  },
  "errors": {}
}
```

## 화면 표시 원칙

- 이 값은 `내부 ATT ROAS`다.
- `Ads Manager ROAS`와 섞어 쓰면 안 된다.
- `batch.raw_ledger_items_returned=0`이면 화면이 raw order list를 받지 않았다는 뜻이다.
- `errors[preset]`가 있어도 다른 기간 결과는 표시할 수 있다.
