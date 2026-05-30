harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
  required_context_docs:
    - data/project/ga4-vm-row-level-safe-bridge-dry-run-20260524.json
    - data/project/coffee-channel-cohort-truth-table-20260524.json
    - project/page-long-threshold-fit-dry-run-20260524.md
    - project/biocom-meta-only-buyer-leaver-truth-table-20260524.md
  lane: Green
  allowed_actions:
    - read-only BigQuery dry-run
    - local frontend/documentation patch
    - local typecheck
  forbidden_actions:
    - VM Cloud deploy/restart
    - external platform send/upload
    - GTM publish
    - operating DB write/import
    - raw identifier output
  source_window_freshness_confidence:
    source: VM Cloud SQLite safe hash + GA4 BigQuery export + live leading-indicators API read-only
    window: rolling latest 7d
    freshness: 2026-05-24 11:50-11:53 KST
    confidence: medium_high for dry-run safe bridge; medium for live API behavior until GA4 join attached

# GA4 행동 데이터를 leading-indicators live API에 붙이는 설계

## 이번에 가능해진 것

GA4 행동 데이터와 VM Cloud 결제 원장을 safe session 기준으로 다시 붙였다. 이제 “구매자가 더 오래 봤나?”, “비결제자가 어디서 멈췄나?”를 바이오컴과 더클린커피 모두 최근 7일 기준으로 볼 수 있다.

단, 현재 live API가 화면에 주는 체류시간은 아직 GA4 BigQuery 행동값이 아니다. 그래서 live API 화면에서 바이오컴 체류시간이 짧아 보이고, 더클린커피 체류시간이 비어 보인다. 이번 설계의 핵심은 이 차이를 API 응답에 명시하고, GA4 행동 snapshot을 별도로 붙이는 것이다.

## 최신 7일 핵심 수치

source: VM Cloud SQLite safe session hash + GA4 BigQuery export
window: rolling latest 7d
freshness: 2026-05-24 11:50 KST
confidence: medium_high

### 바이오컴

| cohort | safe session | GA4 join | 중앙 체류시간 | 90% 스크롤 | 긴 조회 | 장바구니 | 결제 시작 | 결제수단 선택 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 결제자 | 371 | 356 | 206.57초 | 91.85% | 22.47% | 14.89% | 99.16% | 4.21% |
| 결제 시작 후 멈춤 | 721 | 689 | 88.57초 | 69.67% | 19.74% | 8.85% | 44.56% | 2.61% |

바이오컴 Meta-only만 보면 결제자 중앙 체류시간은 193.87초, 비결제자는 124.27초다. live API에서 48초/30초로 보인 값은 같은 GA4 행동값이 아니라 VM 원장의 페이지 관측값이다. 따라서 “사용자가 갑자기 덜 읽는다”가 아니라 “측정 source가 다르다”로 봐야 한다.

### 더클린커피

| cohort | safe session | GA4 join | 중앙 체류시간 | 90% 스크롤 | 긴 조회 | 장바구니 | 결제 시작 | 결제수단 선택 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 결제자 | 127 | 126 | 209.61초 | 100.00% | 9.52% | 28.57% | 81.75% | 0.00% |
| 결제 시작 후 멈춤 | 195 | 188 | 176.93초 | 90.96% | 15.96% | 19.68% | 57.98% | 0.00% |

더클린커피 Meta-only는 결제자 188.81초, 비결제자 225.43초다. 비결제자가 더 오래 머무는 구간이 있어 체류시간만 선행지표로 쓰면 안 된다. 랜딩 bucket, 장바구니, 결제 시작, GA4 purchase conflict를 같이 봐야 한다.

## 왜 live API 숫자가 다르게 보였나

## 두 값의 의미

### GA4 행동값

GA4 행동값은 “방문자가 페이지에서 실제로 한 행동”을 재는 값이다. 예를 들어 페이지에 머문 시간, 90% 스크롤, 상품 상세 조회, 장바구니, 결제 시작 같은 행동 이벤트를 GA4 BigQuery에서 가져온다. 이번 dry-run은 이 GA4 행동값을 VM Cloud의 주문/세션 safe key와 맞춰서 “결제자와 비결제자가 실제로 어떻게 다르게 행동했는가”를 본 것이다.

사용 목적:

- 광고 유입자가 상세페이지를 충분히 읽었는지 판단
- 구매자와 비결제자의 행동 차이 비교
- 선행지표 후보 발굴
- 랜딩/콘텐츠 개선 우선순위 판단

### VM 원장 metadata 값

VM 원장 metadata 값은 “우리 서버가 전환 단계마다 받은 스냅샷”이다. VM Cloud attribution ledger에는 landing, payment_page_seen, payment_success 같은 전환 row가 쌓인다. 그 row에 함께 들어온 visible_seconds, scroll 값은 전환 payload가 들어온 순간의 보조 정보다. GA4처럼 방문자가 페이지를 보는 전체 시간 동안 계속 누적한 행동 로그가 아니다.

사용 목적:

- 결제 시작/결제완료/CAPI 전송 상태 확인
- Purchase 누락 큐 감시
- 실시간 운영 알림
- 전환 단계별 원장 정합성 점검

따라서 같은 “체류시간”처럼 보여도 두 값은 쓰임새가 다르다. 행동 분석과 콘텐츠 판단에는 GA4 행동값을 우선 쓰고, 결제완료/전송 감시에는 VM 원장 metadata와 CAPI 로그를 우선 쓴다.

### 원인 1. 행동 데이터 source가 다르다

현재 live API는 VM Cloud 원장에 남은 페이지 관측값을 우선 사용한다. 반면 이번 dry-run은 GA4 BigQuery의 `engagement_time`을 safe session으로 붙였다.

사람 말로 풀면:

- live API 값: 우리 서버 원장에 남은 짧은 현장 메모
- GA4 dry-run 값: Google Analytics가 계산한 페이지 체류 행동 로그

둘은 같은 뜻이 아니다. live API에는 `behavior_source`를 반드시 넣어야 한다.

### 원인 1-1. VM 원장값은 방문 전체를 대표하지 않을 수 있다

VM 원장값은 이벤트가 들어온 순간의 payload다. 사용자가 페이지를 3분 보고 나중에 다른 이벤트가 발생하지 않으면, 그 3분이 VM 원장에 완전히 반영되지 않을 수 있다. 반대로 GA4는 사용자가 페이지를 보는 동안 engagement 이벤트를 계속 쌓아 BigQuery에 내보낸다. 그래서 GA4 행동값이 더 길게 잡히는 것이 자연스럽다.

### 원인 1-2. 비교 모집단이 다르다

GA4 dry-run은 “VM safe session과 GA4 session이 붙은 세션”을 기준으로 비교한다. live API는 아직 VM 원장 row 중심이다. 즉 GA4 dry-run은 사람/세션 단위 분석에 가깝고, live API는 전환 row 단위 운영 상태 확인에 가깝다. 이 차이 때문에 같은 기간이라도 중앙 체류시간이 달라질 수 있다.

### 원인 2. 더클린커피는 live API에 GA4 행동 join이 아직 없다

더클린커피는 dry-run에서는 GA4 join rate가 높다. 그러나 live API 응답에는 아직 GA4 행동 snapshot이 붙지 않는다. 그래서 화면에서 체류시간이 비어 보였다.

### 원인 3. 90% 스크롤은 사이트별 수집 방식 차이가 크다

바이오컴은 90% 스크롤이 구매자/비결제자 차이를 어느 정도 보여준다. 더클린커피는 scroll 이벤트는 보이지만 50%인지 90%인지 구분하는 값이 약해 포화처럼 보일 수 있다. 따라서 더클린커피는 page_view_long, 리뷰 영역 도달, 결제 시작을 함께 봐야 한다.

## live API 응답 계약

endpoint 후보:

```text
GET /api/attribution/leading-indicators
  ?site=biocom|thecleancoffee
  &window=1d|7d|14d|30d
  &channel=meta|youtube|google_paid|naver_paid_or_brand|direct_or_unknown|all
  &dimension=buyer_vs_leaver|channel|landing_bucket|campaign
```

추가해야 할 필드:

```jsonc
{
  "behavior_source": "ga4_bigquery_safe_bridge",
  "behavior_freshness_kst": "2026-05-24 11:50",
  "behavior_confidence": "medium_high",
  "ga4_behavior_snapshot": {
    "confirmed_buyer": {
      "ga4_joined_sessions": 356,
      "p50_engagement_seconds": 206.57,
      "p75_engagement_seconds": 372.87,
      "scroll90_rate_pct": 91.85,
      "page_view_long_rate_pct": 22.47,
      "view_item_rate_pct": 52.81,
      "add_to_cart_rate_pct": 14.89,
      "begin_checkout_rate_pct": 99.16,
      "add_payment_info_rate_pct": 4.21,
      "ga4_purchase_rate_pct": 99.44
    },
    "checkout_non_buyer": {
      "ga4_joined_sessions": 689,
      "p50_engagement_seconds": 88.57,
      "p75_engagement_seconds": 214.39,
      "scroll90_rate_pct": 69.67,
      "page_view_long_rate_pct": 19.74,
      "view_item_rate_pct": 30.33,
      "add_to_cart_rate_pct": 8.85,
      "begin_checkout_rate_pct": 44.56,
      "add_payment_info_rate_pct": 2.61,
      "ga4_purchase_rate_pct": 3.05
    }
  },
  "live_vm_behavior_snapshot": {
    "source": "vm_ledger_metadata",
    "p50_visible_seconds": 48
  },
  "behavior_delta_explanation": "live API의 VM 원장 체류시간과 GA4 BigQuery engagement_time은 source가 다르므로 같은 숫자로 비교하지 않는다."
}
```

## precompute 방식

요청이 들어올 때마다 BigQuery를 직접 치면 느리고 불안정하다. funnel-health와 ROAS summary처럼 미리 계산한 cache를 읽는 구조가 맞다.

권장 주기:

- `today`: 4시간마다 precompute
- `yesterday`, `7d`, `14d`, `30d`: 하루 1회 또는 6시간 1회
- 강제 새로고침: 운영자 버튼으로만, cooldown 5분 이상

캐시 키:

```text
leading_indicators_behavior:{site}:{window}:{channel}:{dimension}
```

응답 목표:

- cache hit: 500ms 이하
- force refresh: 10초 이하
- BigQuery 실패 시: 기존 cache 유지 + `behavior_stale=true`

## 개발 순서

1. 백엔드에 `ga4BehaviorPrecompute` 모듈을 만든다.
   - 무엇: safe session hash 기준으로 GA4 engagement, scroll, page_view_long, view_item, cart, begin_checkout, add_payment_info를 집계한다.
   - 왜: live API에서 매번 BigQuery를 때리지 않고 빠르게 보여주기 위해서다.

2. `/api/attribution/leading-indicators` 응답에 `ga4_behavior_snapshot`을 붙인다.
   - 무엇: 기존 cohort 응답에 GA4 행동값을 별도 블록으로 추가한다.
   - 왜: 기존 프론트 호환을 유지하면서 행동값 source를 명확히 하기 위해서다.

3. 프론트는 `behavior_source`를 보고 문구를 바꾼다.
   - 무엇: GA4 행동값이면 “GA4 기준”, VM 원장값이면 “VM 원장 기준”으로 표시한다.
   - 왜: 바이오컴처럼 48초와 193초가 동시에 존재할 때 오해를 막기 위해서다.

4. 더클린커피 add_payment_info 공백을 별도 gap으로 보여준다.
   - 무엇: begin_checkout은 보이지만 add_payment_info는 0%인 상태를 분리 표시한다.
   - 왜: 결제수단 선택 이벤트가 실제로 없는지, GTM/아임웹 이벤트가 빠지는지 다음 작업을 명확히 하기 위해서다.

## 운영 금지선

이 설계는 read-only 행동 분석이다. 아래 작업은 포함하지 않는다.

- Meta CAPI 전송
- GA4 Measurement Protocol 전송
- Google Ads upload
- GTM Production publish
- 운영 DB write/import
- raw order/payment/member/click id 출력
- VM Cloud deploy/restart

## 다음 판단

GA4 행동 데이터를 live API에 붙이는 것은 진행 가치가 높다. 바이오컴은 “짧아진 체류시간” 오해를 풀 수 있고, 더클린커피는 현재 비어 있는 행동 지표를 화면에 채울 수 있다. 다만 이 작업은 VM Cloud backend 배포가 필요하므로, 로컬 구현 후 Yellow Lane 배포 패킷으로 진행하는 것이 맞다.
