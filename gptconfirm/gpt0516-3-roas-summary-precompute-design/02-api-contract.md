# ROAS summary cache API contract

작성 시각: 2026-05-16 14:25 KST

## 요청

```http
GET /api/ads/roas-summary?account_id=act_3138805896402376&presets=today,yesterday,last_7d
```

강제 새로고침:

```http
GET /api/ads/roas-summary?account_id=act_3138805896402376&presets=today,yesterday,last_7d&force=true
```

## 응답 추가 필드

```json
{
  "ok": true,
  "cache": {
    "cached": true,
    "cached_at_kst": "2026-05-16 14:30",
    "next_refresh_at_kst": "2026-05-16 14:35",
    "generation_ms": 12890,
    "staleness_ms": 45678,
    "source": "in_memory_precompute",
    "stale": false,
    "force_cooldown_remaining_ms": 0
  },
  "batch": {
    "mode": "aggregate_summary",
    "source": "in_memory_precompute",
    "ledger_fetch_count": 1,
    "meta_insights_fetch_count": 3,
    "raw_ledger_items_returned": 0
  },
  "results": {
    "today": {
      "summary": {
        "spend": 0,
        "attributedRevenue": 0,
        "roas": null,
        "orders": 0
      }
    }
  }
}
```

## cache.source 값

- `in_memory_precompute`: 백그라운드 사전 계산 결과.
- `live_force_refresh`: 사용자가 강제 새로고침을 눌러 실시간 계산.
- `live_cache_miss`: 캐시가 없어 실시간 계산.
- `stale_fallback`: Meta API 실패 등으로 최근 stale cache를 반환.

## 프론트 표시 문구

추천 문구:

```text
ROAS 데이터 기준 2026-05-16 14:30 KST · 다음 갱신 14:35 KST · 백그라운드 사전 집계
```

강제 새로고침:

```text
실시간 계산 응답 · 계산 시간 12.9초 · 다음 강제 새로고침은 5분 후 가능
```

stale fallback:

```text
Meta API가 늦어 최근 캐시를 표시 중 · 데이터 기준 2026-05-16 14:20 KST
```

## 사람이 헷갈리지 않게 붙일 설명

이 ROAS는 `내부 ATT ROAS`다.

- `광고 플랫폼 ROAS`: Meta Ads Manager가 광고에 귀속했다고 주장하는 값.
- `내부 ATT ROAS`: VM Cloud 원장에 남은 실제 결제완료/광고 evidence 기준으로 계산한 값.

화면에는 둘을 같은 숫자로 섞지 않는다.
