# 더클린커피 체류시간·스크롤 공백 원인 분해

작성 시각: 2026-05-24 11:45 KST
site: thecleancoffee
작업 성격: Green Lane read-only 원인 분해

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
  required_context_docs:
    - project/page-long-threshold-fit-dry-run-20260520.md
    - project/ga4-vm-row-level-safe-bridge-dry-run-20260518.md
    - project/ga4-vm-row-level-safe-bridge-dry-run-20260518-3d.md
    - project/coffee-scroll-event-collection-plan-20260520.md
    - project/coffee-ga4-existing-tag-event-audit-20260517.md
  lane: Green
  allowed_actions:
    - read-only API refresh
    - local backend code inspection
    - local document update
  forbidden_actions:
    - platform_send
    - vm_cloud_write
    - operating_db_write
    - gtm_publish
    - deploy_restart
  source_window_freshness_confidence:
    source: VM Cloud leading-indicators live API + local backend code + prior GA4 BigQuery dry-run reports
    window: current live 7d meta + historical 3d/7d
    freshness: live API 2026-05-24 11:35 KST; historical docs 2026-05-17~2026-05-20
    confidence: high for source mismatch; medium for current latest GA4 behavior values until BigQuery rerun
```

## 이번에 가능해진 것

현재 더클린커피 선행지표 화면에서 체류시간과 스크롤이 비는 이유를 `데이터 없음`으로 단정하지 않고, 아래 3개로 분해했다.

1. 과거 GA4 BigQuery 기준 체류시간 분석은 있었다.
2. 현재 live leading-indicators API는 GA4 BigQuery 체류시간/스크롤을 아직 row-level로 붙이지 않는다.
3. 현재 API는 VM Cloud ledger row 안의 behavior metadata만 읽는데, 더클린커피 ledger에는 해당 필드가 거의 없어서 공백으로 보인다.

## 10초 요약

더클린커피 체류시간 분석은 과거에 있었다. 다만 과거 분석은 GA4 BigQuery와 VM Cloud safe session을 붙인 dry-run 결과였고, 지금 live API는 VM Cloud ledger metadata만 보고 있다. 즉 현재 공백은 “더클린커피 사용자가 체류하지 않았다”가 아니라 “live API가 GA4 행동 데이터를 아직 붙이지 않는다”가 1차 원인이다.

## 현재 live API 관측

조회:

```text
GET /api/attribution/leading-indicators
site=thecleancoffee
window=7d
channel=meta
dimension=buyer_vs_leaver
force=true
```

기준:

```text
source: VM Cloud leading-indicators live API
freshness: 2026-05-24 11:35:11 KST
window: 최근 7일
channel: meta
confidence: medium
```

핵심 값:

```text
safe_sessions: 128
ga4_joined_sessions: 127
confirmed_buyer_sessions: 44
checkout_non_buyer_sessions: 81
ga4_purchase_conflict_sessions: 0
pending_payment_success_sessions: 3
```

체류시간·스크롤:

```text
confirmed_buyer p50_dwell_seconds: null
confirmed_buyer dwell_known_sessions: 0
confirmed_buyer scroll_known_sessions: 0
confirmed_buyer scroll_unknown_sessions: 44

checkout_non_buyer p50_dwell_seconds: null
checkout_non_buyer dwell_known_sessions: 0
checkout_non_buyer scroll_known_sessions: 0
checkout_non_buyer scroll_unknown_sessions: 81
```

하지만 다른 신호는 일부 살아 있다.

```text
confirmed_buyer review_reach_sessions: 10 / 44
checkout_non_buyer review_reach_sessions: 7 / 81
confirmed_buyer begin_checkout_rate_pct: 100
checkout_non_buyer begin_checkout_rate_pct: 77.8
```

해석:

```text
체류시간/스크롤만 비고, 결제 시작/리뷰 도달 같은 VM ledger 기반 신호는 일부 보인다.
따라서 전체 데이터 공백이 아니라 behavior source 연결 공백이다.
```

## 과거 더클린커피 체류시간 분석은 있었나

있었다.

### 2026-05-20 page-long threshold dry-run

문서: `project/page-long-threshold-fit-dry-run-20260520.md`

더클린커피 Meta 유입:

```text
VM sessions: 76
GA4 연결률: 88.16%
구매자 p50 체류: 241.78초
비결제자 p50 체류: 148.4초
구매자 p75 체류: 374.88초
비결제자 p75 체류: 262.33초
7분 이상 체류율: 구매자 16.67%, 비결제자 16.13%
권장 기준: 3분
```

더클린커피 YouTube 유입:

```text
VM sessions: 102
GA4 연결률: 95.1%
구매자 p50 체류: 265.94초
비결제자 p50 체류: 143.56초
구매자 p75 체류: 465.94초
비결제자 p75 체류: 280.41초
7분 이상 체류율: 구매자 26.67%, 비결제자 13.51%
권장 기준: 3분
```

### 2026-05-18 GA4-VM row-level safe bridge dry-run

문서: `project/ga4-vm-row-level-safe-bridge-dry-run-20260518.md`

더클린커피 결제완료:

```text
VM safe sessions: 348
GA4 joined: 329
GA4 join rate: 94.54%
p50 체류: 253.81초
p75 체류: 429.57초
scroll90: 99.7%
add_to_cart: 23.1%
```

더클린커피 결제 시작 후 멈춤:

```text
VM safe sessions: 388
GA4 joined: 361
GA4 join rate: 93.04%
p50 체류: 157.15초
p75 체류: 282.32초
scroll90: 89.47%
add_to_cart: 14.96%
```

## 왜 지금 live API에서는 공백인가

로컬 backend 코드 기준으로 보면, 현재 `backend/src/leadingIndicators.ts`는 체류시간과 스크롤을 GA4 BigQuery에서 직접 가져오지 않는다.

현재 읽는 필드:

```text
visible_seconds
visibleSeconds
time_on_page_ms
timeOnPageMs
engagement_time_msec
scroll_max_percent
max_scroll_percent
scrollPercent
scroll_percent
```

이 필드들은 VM Cloud `attribution_ledger` row의 metadata 안에 있어야 한다.

문제:

```text
더클린커피 ledger row에는 위 behavior metadata가 거의 없다.
그래서 dwell_known_sessions=0, scroll_known_sessions=0으로 닫힌다.
```

즉 공백의 1차 원인은 아래다.

```text
source가 다름:
과거 분석 source = GA4 BigQuery + VM safe bridge dry-run
현재 live API source = VM Cloud attribution_ledger metadata
```

## 스크롤 90%는 별도 주의가 필요하다

과거 scroll90이 높게 나온 것도 그대로 믿으면 안 된다. `project/coffee-scroll-event-collection-plan-20260520.md`에서 이미 다음 문제가 확인됐다.

```text
최근 7일 GA4 sessions: 3,904
scroll event sessions: 2,205
percent_scrolled included sessions: 0
raw percent_scrolled >=90: 0.0%
scroll event를 90%로 간주하면: 56.5%
page_view_long: 14.0%
review reach: 26.5%
```

해석:

```text
GA4 기본 scroll 이벤트는 보통 90% 도달 때 찍히지만, 현재 더클린커피 BigQuery에는 percent_scrolled 값이 없다.
그래서 scroll event 자체를 scroll90으로 볼 수는 있어도, 정확한 50/75/90% 단계 분석에는 약하다.
```

따라서 scroll90은 현재 선행지표 후보로는 보조 신호다. 더 좋은 기준은 `page_view_long`, 리뷰 영역 도달, 체류시간 p50/p75, 결제 시작 도달을 같이 보는 것이다.

## 원인 분해표

| 구분 | 현재 상태 | 판단 |
|---|---|---|
| 데이터 없음 | 아님 | 과거 GA4 BigQuery에는 체류시간/page_view_long 분석이 있었다. |
| source가 다름 | 맞음 | 과거는 GA4 BigQuery, 현재 live API는 VM ledger metadata 중심이다. |
| sync 지연 | 낮음 | 7일 window 전체가 null이라 단순 지연보다는 source gap에 가깝다. |
| 필터 불일치 | 일부 가능 | 현재 live는 `channel=meta`; 과거 문서는 meta/youtube/confirmed/dropped_checkout 등 기준이 다르다. |
| 권한 부족 | 현재 확인 불가 | 이번 턴에는 BigQuery CLI 직접 재조회는 하지 못했다. |
| 기술 실패 | 일부 | live API가 GA4 behavior bridge를 붙이지 않는 구현상 공백이다. |

## 필요한 수정 방향

### 1. leadingIndicators API에 GA4 behavior bridge를 붙인다

무엇을:

```text
VM Cloud safe session cohort에 GA4 BigQuery 행동 지표를 붙인다.
```

어떻게:

```text
site + safe session bridge 기준으로 GA4 dwell/page_view_long/review reach/scroll event를 aggregate-only로 precompute한다.
frontend에는 row-level key 없이 cohort별 비율만 내려준다.
```

왜:

```text
지금처럼 VM ledger metadata만 보면 더클린커피 체류시간/스크롤은 계속 공백으로 보인다.
과거 dry-run에서 이미 가능했던 분석을 live API로 승격해야 한다.
```

### 2. scroll90은 명칭을 조심해서 표시한다

추천 표기:

```text
90% 스크롤 추정
```

또는:

```text
GA4 scroll event 기준 깊은 스크롤
```

금지 표기:

```text
정확한 90% 도달률
```

이유:

```text
percent_scrolled가 비어 있으면 정확히 90%인지 검증할 수 없다.
```

### 3. 더클린커피 GTM 수집 보강

우선순위:

```text
scroll50
scroll75
scroll90
page_view_long_180s
page_view_long_300s
page_view_long_420s
review_section_seen
```

단, GTM publish는 Red Lane이므로 승인 전 실행 금지.

## 프론트엔드에 보여줄 문구

현재 문구:

```text
체류시간 데이터 없음
스크롤 데이터 없음
```

권장 문구:

```text
현재 화면은 VM Cloud 원장에 직접 저장된 행동값만 보고 있어요.
더클린커피는 GA4에는 체류시간과 오래 읽은 방문 신호가 있지만, 아직 이 화면의 live API와 연결되지 않아 공백으로 보입니다.
```

스크롤 안내:

```text
현재 더클린커피의 스크롤 신호는 “정확한 90% 도달”이 아니라 GA4 scroll 이벤트 기반 추정값입니다.
정확도를 높이려면 GTM에서 50/75/90% 스크롤 이벤트를 따로 보내야 합니다.
```

## 결론

더클린커피 체류시간 분석은 과거에 있었고, 꽤 강한 구매자/비결제자 차이도 있었다. 지금 live API에서 공백인 이유는 데이터가 사라진 것이 아니라, GA4 BigQuery 행동 지표를 live API가 아직 붙이지 않기 때문이다. 다음 개발은 `GA4 behavior bridge precompute`가 맞다.
