# Leading Indicator Aggregate Endpoint Design

작성 시각: 2026-05-18 13:12 KST
기준일: 2026-05-18
문서 성격: P1 백엔드 endpoint 설계안 / Yellow Lane 승인 전 contract
대상 화면: `/ai-crm/leading-indicators`
대상 사이트: `biocom`, `thecleancoffee`
Lane: Green documentation only
Mode: No-send / No-write / No-publish / No-deploy

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - CLAUDE.md
    - docurule.md
    - frontrule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - data/!data_inventory.md
    - project/!indicatoragent.md
    - project/!indicatoragent-frontend.md
    - project/leading-indicator-p0-dry-run-20260517.md
    - project/coffee-channel-cohort-truth-table-20260517.md
    - project/ga4-vm-row-level-safe-bridge-dry-run-20260517.md
  lane: Green design only
  allowed_actions:
    - endpoint_contract_design
    - frontend_static_implementation_review
    - local_lint_and_smoke
    - approval_packet_draft
  forbidden_actions:
    - Meta_CAPI_send
    - GA4_Measurement_Protocol_send
    - Google_Ads_upload
    - TikTok_Naver_send_or_upload
    - GTM_publish
    - VM_Cloud_deploy_or_restart
    - operating_db_write
    - VM_Cloud_source_ledger_write
    - raw_identifier_output
  source_window_freshness_confidence:
    source: "VM Cloud SQLite confirmed purchase + GA4 BigQuery export + P0 dry-run snapshot"
    window: "recent 7d snapshot checked 2026-05-17 17:44 KST"
    freshness: "design written 2026-05-18 13:12 KST; P1 endpoint will expose live cache freshness"
    confidence: "thecleancoffee high for behavior comparison, biocom medium_low until key capture improves"
```

## 10초 요약

P0 화면은 TJ님 맥북 repo 안의 정적 dry-run JSON을 import해서 보여준다.
P1은 그 정적 파일 자리에 **VM Cloud 백엔드가 미리 계산한 안전한 집계 API**를 끼우는 작업이다.

이 endpoint는 주문/세션 원문을 내려주지 않는다.
백엔드가 구매자와 비결제자 cohort를 미리 group by 하고, 프론트는 이미 집계된 숫자만 받는다.

## P1 설계안을 따로 닫는 이유

1. 백엔드 endpoint 추가와 VM Cloud restart는 Yellow Lane이다.
2. 승인 전에 URL, query, 응답 schema, 캐시, 금지선을 한 장으로 고정해야 한다.
3. Claude Code가 만든 P0 화면은 이미 `dry-run.ts` shape에 맞춰져 있으므로, P1 contract가 P0와 호환되어야 화면 전환이 안전하다.

## 사용자 관점에서 이 API가 주는 베네핏

대표가 알고 싶은 것은 "매출이 얼마였나"가 아니라 "구매 직전에 반복되는 행동이 무엇인가"다.
이 API는 아래 질문에 답한다.

- Meta 유입 구매자는 비결제자보다 얼마나 오래 봤는가?
- YouTube 유입은 체류시간은 긴데 결제 시작이 약한가?
- 장바구니 신호가 진짜 구매 예고 신호인가, 아니면 이탈자도 많이 하는 행동인가?
- 더클린커피와 바이오컴을 같은 기준으로 비교해도 되는가?
- 이 숫자는 실제 결제완료 기준인가, GA4 purchase 같은 참고 이벤트인가?

## Endpoint

```http
GET /api/attribution/leading-indicators
```

### Query

| query | allowed values | 기본값 | 설명 |
|---|---|---|---|
| `site` | `biocom`, `thecleancoffee` | `biocom` | 분석할 사이트. site별 source와 Pixel/GA4가 섞이면 안 된다. |
| `window` | `1d`, `7d`, `14d`, `30d` | `7d` | 행동과 결제완료를 묶어 볼 기간. P1 기본 화면은 `7d`를 권장한다. |
| `channel` | `meta`, `youtube`, `naver_paid_or_brand`, `organic`, `direct_or_unknown`, `all` | `meta` | 유입 채널. `all`은 전체 비교용이며 광고 예산 판단에는 보수적으로 쓴다. |
| `dimension` | `buyer_vs_leaver`, `channel`, `landing_bucket`, `campaign`, `product` | `buyer_vs_leaver` | 어떤 기준으로 cohort를 나눌지 정한다. |
| `freshness` | `cached`, `force` | `cached` | 기본은 precompute cache. `force`는 관리자/진단용이며 cooldown이 필요하다. |

예시:

```http
GET /api/attribution/leading-indicators?site=thecleancoffee&window=7d&channel=meta&dimension=buyer_vs_leaver
```

## Response Contract

응답은 raw row가 아니라 cohort 집계다.
프론트는 이 contract만 읽으면 P0 정적 JSON과 같은 화면을 live cache로 바꿀 수 있다.

```jsonc
{
  "site": "thecleancoffee",
  "window": "7d",
  "channel": "meta",
  "dimension": "buyer_vs_leaver",
  "mode": "aggregate_only",
  "source": {
    "primary": "VM Cloud SQLite confirmed purchase",
    "cross_check": "GA4 BigQuery export",
    "purchase_truth": "VM Cloud confirmed purchase; 운영DB PAYMENT_COMPLETE cross-check when available",
    "behavior_truth": "GA4 BigQuery engagement and ecommerce events",
    "freshness_kst": "2026-05-18 13:10",
    "source_window": "2026-05-11~2026-05-17 KST",
    "confidence": "high",
    "confidence_reason": "GA4 joined sessions 91%+ and VM Cloud confirmed purchase cohort available"
  },
  "safety": {
    "raw_identifier_output": false,
    "pixel_or_platform_send": 0,
    "operating_db_write": 0,
    "vm_cloud_source_ledger_write": 0,
    "gtm_publish": 0,
    "budget_decision_allowed": false,
    "aggregate_only": true
  },
  "headline": {
    "decision": "Meta 유입은 장바구니보다 체류시간과 결제 페이지 도달을 먼저 봅니다.",
    "buyer_dwell_delta_seconds": 47.9,
    "buyer_rate_pct": 55.22,
    "confidence": "high"
  },
  "cohort": {
    "safe_sessions": 67,
    "ga4_joined_sessions": 61,
    "ga4_join_rate_pct": 91.04,
    "confirmed_purchase_sessions": 37,
    "checkout_non_buyer_sessions": 28,
    "ga4_purchase_conflict_sessions": 2,
    "pending_payment_success_sessions": 1,
    "ga4_purchase_conflict_rate_pct": 6.67,
    "confirmed_revenue_krw": 2329544,
    "note": "non_buyer는 GA4 purchase 충돌과 pending payment_success가 없는 순수 비결제자입니다."
  },
  "comparison": {
    "confirmed_buyer": {
      "sessions": 37,
      "p50_dwell_seconds": 210.76,
      "scroll50_rate_pct": 100,
      "scroll90_rate_pct": 100,
      "view_item_rate_pct": 0,
      "add_to_cart_rate_pct": 17.14,
      "cart_or_view_cart_rate_pct": 17.14,
      "begin_checkout_rate_pct": 0,
      "add_payment_info_rate_pct": 0,
      "complete_registration_rate_pct": null
    },
    "checkout_non_buyer": {
      "sessions": 28,
      "p50_dwell_seconds": 162.88,
      "scroll50_rate_pct": 100,
      "scroll90_rate_pct": 100,
      "view_item_rate_pct": 0,
      "add_to_cart_rate_pct": 23.08,
      "cart_or_view_cart_rate_pct": 23.08,
      "begin_checkout_rate_pct": 0,
      "add_payment_info_rate_pct": 0,
      "complete_registration_rate_pct": null
    },
    "ga4_purchase_conflict": {
      "sessions": 2,
      "p50_dwell_seconds": 188.42,
      "scroll50_rate_pct": 100,
      "scroll90_rate_pct": 50,
      "view_item_rate_pct": 100,
      "cart_or_view_cart_rate_pct": 0,
      "begin_checkout_rate_pct": 100,
      "add_payment_info_rate_pct": 0,
      "complete_registration_rate_pct": null,
      "interpretation": "GA4 purchase는 보이지만 VM confirmed purchase가 없는 보류 cohort입니다. 순수 비결제자 평균에 섞지 않습니다."
    },
    "pending_payment_success": {
      "sessions": 1,
      "p50_dwell_seconds": null,
      "scroll50_rate_pct": null,
      "scroll90_rate_pct": null,
      "view_item_rate_pct": null,
      "cart_or_view_cart_rate_pct": null,
      "begin_checkout_rate_pct": null,
      "add_payment_info_rate_pct": null,
      "complete_registration_rate_pct": null,
      "interpretation": "VM에는 payment_success 흔적이 있으나 confirmed로 닫히지 않은 보류 cohort입니다. 실제 미결제인지 sync/bridge 지연인지 별도 확인합니다."
    }
  },
  "indicators": [
    {
      "id": "dwell_180s",
      "label": "3분 이상 체류",
      "status": "candidate",
      "why": "Meta 결제자가 비결제자보다 더 오래 머뭅니다.",
      "action": "랜딩/소재별 3분 이상 체류 비율을 비교합니다.",
      "score": 82,
      "confidence": "medium_high"
    },
    {
      "id": "cart_signal",
      "label": "장바구니 신호",
      "status": "caution",
      "why": "비결제자 쪽도 높게 잡혀 단독 KPI로 쓰기 어렵습니다.",
      "action": "결제 페이지 도달과 함께 봅니다.",
      "score": 48,
      "confidence": "medium"
    }
  ],
  "segments": [
    {
      "dimension": "landing_bucket",
      "bucket": "product_detail",
      "sessions": 52,
      "buyer_rate_pct": 53.8,
      "p50_dwell_seconds": 204.1,
      "confidence": "medium_high"
    }
  ],
  "action_queue": [
    {
      "priority": "P1",
      "owner": "Codex",
      "action": "더클린커피 begin_checkout/add_payment_info 적재 재확인",
      "why": "현재 P0 snapshot에서는 coffee begin_checkout/add_payment_info가 0이라 구매 전 하단 퍼널 신호가 비어 있습니다.",
      "approval_required": false
    }
  ],
  "caveats": [
    "GA4 purchase event is cross-check only and is not revenue truth.",
    "begin_checkout and add_payment_info require rerun after AGENTSOS tag export.",
    "biocom row-level join is weaker than coffee, so buyer_vs_leaver should show caution until key capture improves."
  ],
  "cache": {
    "cached": true,
    "source": "in_memory_precompute",
    "cached_at_kst": "2026-05-18 13:10",
    "next_refresh_at_kst": "2026-05-18 13:40",
    "generation_ms": 410,
    "staleness_ms": 120000
  }
}
```

프론트 표기는 반드시 4개 cohort를 구분한다.

- `confirmed_buyer`: VM Cloud confirmed purchase 로 닫힌 실제 결제완료 세션이다.
- `checkout_non_buyer`: VM confirmed purchase 도 GA4 purchase 도 pending payment_success 도 없는 순수 비결제 세션이다.
- `ga4_purchase_conflict`: GA4 purchase 는 보이지만 VM confirmed purchase 로 닫히지 않은 세션이다. 이 값은 매출 정본이 아니라 `source/window/session mismatch` 또는 `confirmed bridge 누락`을 점검하라는 보류 bucket 이다.
- `pending_payment_success`: VM에는 payment_success 흔적이 있으나 confirmed로 닫히지 않은 세션이다. 이 값은 실제 미결제일 수도 있고 결제 source sync/bridge 지연일 수도 있으므로 순수 비결제자 평균에 섞지 않는다.

호환성 때문에 `comparison.buyer`/`comparison.non_buyer` alias 를 잠시 둘 수 있지만, 신규 프론트는 `confirmed_buyer`/`checkout_non_buyer`/`ga4_purchase_conflict`/`pending_payment_success` 를 우선 사용한다.

## Response에 절대 넣지 않는 값

아래 값은 백엔드 내부 join에만 사용하고, API 응답·문서·Telegram·git에는 출력하지 않는다.

- 주문/결제/회원 원문 ID: `order_id`, `order_no`, `order_code`, `payment_id`, `payment_key`, `member_id`
- 광고 클릭 원문 ID: `click_id`, `gclid`, `gbraid`, `wbraid`, `fbclid`, `ttclid`, `NaPm`, `nclid`
- GA4 row key: `user_pseudo_id`, `client_id`, `ga_session_id`
- 내부 safe join key: `safe_session_hash`, `safe_order_hash`, `safe_ref`
- 결제건별 amount row, click row, session row

대신 아래처럼 집계만 반환한다.

- `safe_sessions`
- `ga4_joined_sessions`
- `confirmed_purchase_sessions`
- `confirmed_revenue_krw`
- rate, median, percentile, confidence

## Source of Truth

| 질문 | primary | cross-check | 주의 |
|---|---|---|---|
| 실제 구매 여부 | VM Cloud `confirmed purchase` | 운영DB `PAYMENT_COMPLETE`, Imweb/Toss direct when needed | GA4 purchase는 매출 정본이 아니다. |
| 구매 전 행동 | GA4 BigQuery export | VM Cloud attribution/landing ledger | GA4 event는 behavior source다. |
| 광고 유입 evidence | VM Cloud UTM/referrer/click evidence | GA4 traffic source | 플랫폼 주장 매출과 합산 금지 |
| 예산 판단 | confirmed purchase + spend + 충분한 evidence | Ads Manager/GA4는 참고 | P1 endpoint 기본은 예산 자동판단 금지 |

## Backend Pseudo-code

목표는 row를 프론트로 내려주지 않고, 백엔드에서 cohort 계산을 끝내는 것이다.

```sql
-- 1. VM Cloud에서 site/window/channel 기준 safe cohort 후보를 만든다.
WITH vm_sessions AS (
  SELECT
    site,
    channel_bucket,
    landing_bucket,
    campaign_bucket,
    product_bucket,
    safe_session_hash,
    MAX(CASE WHEN payment_status = 'confirmed' THEN 1 ELSE 0 END) AS is_buyer,
    SUM(CASE WHEN payment_status = 'confirmed' THEN confirmed_amount_krw ELSE 0 END) AS revenue_krw
  FROM vm_cloud_safe_attribution_view
  WHERE site = :site
    AND observed_at_kst BETWEEN :start_kst AND :end_kst
    AND channel_bucket = :channel_or_all
  GROUP BY 1,2,3,4,5,6
),

-- 2. GA4 BigQuery export에서 같은 safe session 단위 행동을 만든다.
ga4_behavior AS (
  SELECT
    site,
    safe_session_hash,
    MAX(engagement_time_seconds) AS dwell_seconds,
    MAX(CASE WHEN scroll_percent >= 50 THEN 1 ELSE 0 END) AS scroll50,
    MAX(CASE WHEN scroll_percent >= 90 THEN 1 ELSE 0 END) AS scroll90,
    MAX(CASE WHEN event_name IN ('view_item') THEN 1 ELSE 0 END) AS view_item,
    MAX(CASE WHEN event_name IN ('add_to_cart', 'view_cart') THEN 1 ELSE 0 END) AS cart_signal,
    MAX(CASE WHEN event_name = 'begin_checkout' THEN 1 ELSE 0 END) AS begin_checkout,
    MAX(CASE WHEN event_name = 'add_payment_info' THEN 1 ELSE 0 END) AS add_payment_info,
    MAX(CASE WHEN event_name = 'complete_registration' THEN 1 ELSE 0 END) AS complete_registration,
    MAX(CASE WHEN event_name = 'purchase' THEN 1 ELSE 0 END) AS ga4_purchase
  FROM ga4_safe_session_export
  WHERE site = :site
    AND event_date BETWEEN :start_date AND :end_date
  GROUP BY 1,2
),

-- 3. 내부 join key는 여기서만 쓰고 버린다.
joined AS (
  SELECT
    v.site,
    v.channel_bucket,
    v.landing_bucket,
    v.campaign_bucket,
    v.product_bucket,
    CASE
      WHEN v.is_buyer = 1 THEN 'confirmed_buyer'
      WHEN g.ga4_purchase = 1 THEN 'ga4_purchase_conflict'
      WHEN v.payment_success_pending_or_unknown = 1 THEN 'pending_payment_success'
      ELSE 'checkout_non_buyer'
    END AS cohort,
    v.revenue_krw,
    g.dwell_seconds,
    g.scroll50,
    g.scroll90,
    g.view_item,
    g.cart_signal,
    g.begin_checkout,
    g.add_payment_info,
    g.complete_registration,
    g.ga4_purchase
  FROM vm_sessions v
  LEFT JOIN ga4_behavior g
    ON v.site = g.site
   AND v.safe_session_hash = g.safe_session_hash
)

-- 4. 프론트에는 group by 결과만 반환한다.
SELECT
  site,
  :window AS window,
  :channel AS channel,
  :dimension AS dimension,
  cohort,
  COUNT(*) AS sessions,
  SUM(revenue_krw) AS revenue_krw,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dwell_seconds) AS p50_dwell_seconds,
  AVG(scroll50) * 100 AS scroll50_rate_pct,
  AVG(scroll90) * 100 AS scroll90_rate_pct,
  AVG(view_item) * 100 AS view_item_rate_pct,
  AVG(cart_signal) * 100 AS cart_or_view_cart_rate_pct,
  AVG(begin_checkout) * 100 AS begin_checkout_rate_pct,
  AVG(add_payment_info) * 100 AS add_payment_info_rate_pct,
  AVG(complete_registration) * 100 AS complete_registration_rate_pct
FROM joined
GROUP BY site, cohort;
```

구현에서는 SQLite와 BigQuery를 한 SQL로 합치지 않을 수 있다.
중요한 것은 내부 join 후 **API 응답 전 단계에서 row key를 버리고 aggregate만 남기는 것**이다.

## Precompute / Cache

P1 endpoint는 매 요청마다 무거운 SQL과 BigQuery join을 돌리면 안 된다.
`funnel-health`와 같은 precompute 패턴을 쓴다.

### 권장 주기

| window | 권장 갱신 | 이유 |
|---|---:|---|
| `1d` / yesterday | 4시간 | 당일·전일 운영 판단용. GA4 export lag를 감안한다. |
| `7d` | 30분 | 기본 화면. 자주 보지만 급변하지 않는다. |
| `14d` | 60분 | 추세 확인용. |
| `30d` | 120분 | 장기 추세. |

### 캐시 위치

1차: VM Cloud backend in-memory precompute cache

2차 후보: JSONL/SQLite cache table

주의: 2차 후보가 VM Cloud SQLite에 새 table/write를 만들면 Yellow 승인 범위에 포함해야 한다.
P1 첫 구현은 source ledger를 오염시키지 않는 in-memory cache부터 권장한다.

### 성능 기준

- cached response: 500ms 이하
- force refresh: 5초 이하 권장, 10초 초과 시 실패로 표시
- 동시에 같은 조합 요청이 들어오면 single-flight로 합친다
- frontend auto-refresh 금지, 수동 새로고침 버튼은 cooldown 5분

## P0 정적 JSON과 P1 Contract Diff

| 항목 | P0 현재 | P1 전환 |
|---|---|---|
| 데이터 위치 | `frontend/src/app/ai-crm/leading-indicators/dry-run.ts` | `GET /api/attribution/leading-indicators` |
| 갱신 | 코드 배포 전까지 고정 | VM Cloud precompute cache |
| 표시 문구 | `샘플 / 최근 dry-run 기준` | `CACHED / 데이터 기준 ...` |
| site | biocom / coffee 정적 | query `site` |
| channel | meta/youtube/naver/direct/all 일부 | query `channel`, `organic` 추가 |
| dimension | buyer_vs_leaver/channel | landing_bucket/campaign/product 확장 |
| raw row | 없음 | 없음 유지 |
| 위험 | 숫자가 stale | cache freshness를 화면에 표시 |

P1에서 프론트 변경은 아래 한 줄 방향이다.

```text
dry-run.ts import -> fetch('/api/attribution/leading-indicators?...')
```

실패 시에는 P0 static sample을 fallback으로 보이게 한다.

## Frontend Integration Requirements

프론트는 응답의 `safety.raw_identifier_output=false`와 `safety.aggregate_only=true`가 아니면 숫자를 숨긴다.

필수 UI:

1. 데이터 기준 시각
2. source / window / site / channel / confidence
3. 구매자 vs 비결제자 비교
4. 지표 후보와 액션
5. caveat와 action_queue
6. P0 fallback 여부 표시

기본 문구:

```text
이 숫자는 주문 원문이 아니라 이미 묶인 cohort 집계입니다. 광고 플랫폼 주장값이 아니라 VM Cloud 결제완료와 GA4 행동 데이터를 맞춰 본 내부 분석입니다.
```

## Approval Packet for P1 Backend

### 승인 이름

```text
[승인] Leading Indicator aggregate endpoint P1 VM Cloud 구현/배포 준비
```

### 승인 범위

- `GET /api/attribution/leading-indicators` 추가
- VM Cloud 내부 read-only 집계 로직 추가
- in-memory precompute worker 추가
- frontend fetch 전환용 contract 응답 추가
- local typecheck/build/API smoke
- 승인 후 VM Cloud backend deploy/restart

### 금지

- Meta CAPI/GA4/Google Ads/TikTok/Naver send/upload
- GTM publish
- 운영DB write/import
- VM Cloud source ledger write
- raw identifier response/log/report output
- 예산 자동 판단 또는 광고 budget change

### 성공 기준

- `site=thecleancoffee&window=7d&channel=meta&dimension=buyer_vs_leaver` API 200
- cached response 500ms 이하
- response에 raw id pattern 0
- `source/window/freshness/confidence/safety/cache` 필드 존재
- P0 정적 더클린커피 Meta 숫자와 같은 window에서 큰 차이 없이 재현
- biocom은 confidence/caveat로 key bridge 한계 표시
- frontend는 P0 fallback 없이 API 응답으로 렌더 가능

### 실패 조건

- API가 row-level key를 노출
- site가 섞임
- GA4 purchase revenue를 실제 매출 정본으로 사용
- cached response가 2초 이상 반복
- VM Cloud backend restart 후 `/api/health` 실패

### Rollback

- endpoint route 제거 또는 feature flag off
- precompute worker off
- frontend는 P0 static sample fallback 유지

## Claude Code 구현 검토 결과

현재 구현은 P0로 적절하다.

확인한 점:

- `/ai-crm/leading-indicators` route가 존재한다.
- 공통 상단 메뉴 `GlobalNav`를 사용한다.
- `dry-run.ts` 정적 snapshot을 읽는다.
- 화면에 `샘플 / 최근 dry-run 기준`을 표시한다.
- 더클린커피 Meta cohort 대표값을 보여준다.

아직 없는 점:

- 백엔드 fetch 없음.
- API cache 상태 표시 없음.
- P1 safety invariant 검증 없음.
- `organic` channel option은 P1 contract에는 포함하지만 P0 UI option에는 아직 없다.

따라서 지금 화면은 "샘플 리포트"로는 OK이고, 운영용 매일 갱신 화면으로 쓰려면 이 문서의 P1 endpoint가 필요하다.

## 다음 구현 순서

1. Codex가 P1 backend route와 precompute worker를 로컬 구현한다.
2. 로컬 API smoke로 P0 static snapshot과 숫자 diff를 본다.
3. TJ님이 Yellow 승인하면 VM Cloud backend에 배포한다.
4. Claude Code가 프론트를 static import에서 API fetch로 바꾼다.
5. 첫 48시간 동안 cache freshness와 response time을 모니터링한다.
