# ROAS summary cache implementation

작성 시각: 2026-05-16 KST

## 변경 파일

- `backend/src/routes/ads.ts`
- `backend/src/bootstrap/startBackgroundJobs.ts`

부수 정리:

- `backend/src/routes/ads.ts`에 있던 예전 수동 테스트 주문 키는 raw 문자열 대신 SHA-256 short hash 비교로 바꿨다.

## API 동작

요청:

```http
GET /api/ads/roas-summary?account_id=act_3138805896402376&presets=today,yesterday,last_7d
```

cache hit 응답 추가 필드:

```json
{
  "cache": {
    "cached": true,
    "cached_at_kst": "2026-05-16 15:00",
    "next_refresh_at_kst": "2026-05-16 15:05",
    "generation_ms": 12000,
    "staleness_ms": 30000,
    "source": "in_memory_precompute",
    "stale": false,
    "force_cooldown_remaining_ms": 0,
    "refresh_in_flight": false
  },
  "batch": {
    "mode": "aggregate_summary",
    "source": "in_memory_precompute",
    "cache_hit": true,
    "request_ledger_fetch_count": 0,
    "generated_ledger_fetch_count": 1,
    "raw_ledger_items_returned": 0
  }
}
```

## cache source 값

- `in_memory_precompute`: worker가 미리 계산한 cache를 읽음.
- `live_cache_miss`: cache가 없어 현재 요청에서 live 계산.
- `live_force_refresh`: `force=true`로 live 계산.
- `force_cooldown_cache`: 강제 새로고침 cooldown 때문에 cache 반환.
- `refresh_in_flight_cache`: 같은 key refresh가 이미 진행 중이라 cache 반환.
- `stale_fallback`: live 계산 실패 시 30분 이하 stale cache 반환.

## 환경변수

```text
ROAS_SUMMARY_CACHE_FRESH_MS=600000
ROAS_SUMMARY_STALE_MAX_AGE_MS=1800000
ROAS_SUMMARY_FORCE_COOLDOWN_MS=300000
ROAS_SUMMARY_PRECOMPUTE_ENABLED=1
ROAS_SUMMARY_PRECOMPUTE_INTERVAL_MS=300000
ROAS_SUMMARY_PRECOMPUTE_START_DELAY_MS=90000
ROAS_SUMMARY_PRECOMPUTE_TIMEOUT_MS=80000
ROAS_SUMMARY_PRECOMPUTE_TARGETS=act_3138805896402376,act_654671961007474
```

## source rule

이 endpoint는 광고 플랫폼이 주장하는 ROAS가 아니라 내부 ATT ROAS를 반환한다.

- 매출 source: VM Cloud attribution ledger 우선, 필요 시 local fallback.
- 광고비 source: Meta Ads Insights API.
- budget 판단 전에는 Ads Manager ROAS와 내부 ATT ROAS를 분리해서 표시해야 한다.

## guard

- raw ledger item 반환 0.
- raw order/payment/member/click id 응답 0.
- raw 수동 테스트 주문 키 코드 노출 0.
- external send/upload 0.
- 운영DB write/import 0.
- worker overlap 시 skip.
- key별 live refresh 중복 방지.
