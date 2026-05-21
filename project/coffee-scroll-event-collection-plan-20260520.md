# 더클린커피 scroll/event 수집 보강안 — 2026-05-20

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
    - GA4/gtm-thecleancoffee.md
    - project/scroll90-integrity-dry-run-20260519.md
  lane: Green
  allowed_actions:
    - read-only GA4/VM 분석
    - 문서 설계
    - 로컬 코드 구현
  forbidden_actions:
    - GTM publish
    - Meta/GA4/Google Ads 외부 전송
    - 운영DB write/import
    - VM Cloud schema migration
  source_window_freshness_confidence:
    source: GA4 BigQuery latest 7d dry-run + VM Cloud leadingIndicators API
    window: 2026-05-12..2026-05-18 latest 7d
    freshness: generated 2026-05-19 23:49 KST
    confidence: medium_high for direction, low for coffee scroll90 until percent_scrolled fixed
```

## 이번에 가능해진 것

더클린커피의 `scroll90`은 현재 구매 예측 지표로 바로 쓰면 위험하다는 점을 숫자로 분리했다. GA4에는 `scroll` 이벤트가 들어오지만 `percent_scrolled` 값이 없어서, 단순히 `scroll 이벤트가 있으면 90% 도달`로 보면 실제보다 크게 부풀 수 있다.

## 사람이 이해하는 결론

- `page_view_long` 기준: 현재 문서로 확인된 기준은 **420초 = 7분**이다. 바이오컴/공통 GTM 설계 문서에서 `긴 조회 시간(page_view_long)` 타이머가 `420000ms`로 확인됐다.
- 더클린커피 문서에는 `GA4 page_view_long 이벤트`와 `긴 조회 시간(page_view_long)` 트리거 존재 및 BigQuery 적재가 확인되어 있다. 다만 더클린커피 GTM UI에서 동일하게 420초인지 최종 확인하면 신뢰도가 high로 올라간다.
- 더클린커피 `scroll90`은 지금 상태로는 **측정값이 아니라 추정값**에 가깝다. `percent_scrolled`가 0건이므로, scroll 이벤트 전체를 90% 도달로 해석하면 안 된다.

## 현재 숫자

| 항목 | 더클린커피 최근 7일 |
|---|---:|
| GA4 세션 | 3,904 |
| `scroll` 이벤트 세션 | 2,205 |
| `percent_scrolled` 포함 세션 | 0 |
| raw `percent_scrolled >= 90` | 0.0% |
| scroll 이벤트를 90%로 간주할 때 | 56.5% |
| `page_view_long` | 14.0% |
| 리뷰 URL/이벤트 도달 | 26.5% |
| `begin_checkout` | 1.05% |
| `add_payment_info` | 0.0% |

## 왜 중요한가

`scroll90`이 56.5%처럼 보이면 “사람들이 상세페이지를 끝까지 읽는다”고 착각할 수 있다. 하지만 실제로는 GTM/GA4가 `몇 %까지 내려갔는지`를 넘기지 않았기 때문에, 지금 숫자는 행동 품질이 아니라 태그 설계의 빈칸일 가능성이 크다.

## 보강 설계

### 1. scroll50 / scroll90 명시 이벤트

무엇을 할 것인가: GTM에서 `scroll50`과 `scroll90`을 별도 이벤트로 보낸다.

왜 하는가: `scroll` 하나만으로는 50%인지 90%인지 알 수 없다. 구매 전 선행지표는 “어디까지 읽었는지”가 중요하다.

어떻게 하는가:

- GTM Preview only에서 `gtm.scrollDepth`의 `scrollThreshold`가 50/90으로 나오는지 확인한다.
- GA4 이벤트명은 `scroll_50`, `scroll_90`처럼 명확히 쓴다.
- 이벤트 파라미터에는 `percent_scrolled`, `page_location`, `item_id` presence만 남긴다.
- Meta CAPI 전송은 하지 않는다. 먼저 내부 선행지표로만 쓴다.

성공 기준:

- GA4 BigQuery에서 `scroll_50`, `scroll_90`이 각각 event_name으로 보인다.
- `percent_scrolled`가 50/90으로 들어온다.
- 더클린커피 leadingIndicators 화면에서 scroll90의 raw 기준과 추정 기준 차이가 5%p 이하로 줄어든다.

### 2. page_view_long을 “오래 읽은 방문” 보조지표로 유지

무엇을 할 것인가: `page_view_long`은 그대로 유지하되 매출/ROAS로 해석하지 않는다.

왜 하는가: 7분 이상 머문 사람은 관심도가 높은 방문일 가능성이 있지만, 구매완료가 아니다.

어떻게 하는가:

- `page_view_long_rate_pct`를 leadingIndicators API에 별도 필드로 표시한다.
- 화면 문구는 “오래 읽은 방문”으로 표시한다.
- `value=100`, `currency=KRW`가 있어도 매출로 계산하지 않는다.

성공 기준:

- 프론트에서 `page_view_long`이 scroll90과 별도 카드로 나온다.
- “매출 아님” caveat가 같이 표시된다.

### 3. 리뷰 영역 도달 이벤트

무엇을 할 것인가: 리뷰 URL/리뷰 섹션 도달을 별도 선행지표로 본다.

왜 하는가: 구매자가 리뷰까지 본 뒤 결제하는지 확인하면 랜딩 개선 우선순위를 정할 수 있다.

어떻게 하는가:

- 현재는 URL에 `review`가 있거나 이벤트명에 review가 있는 경우만 계산한다.
- 다음 sprint에서 DOM 섹션 도달 방식으로 `review_section_seen`을 설계한다.

성공 기준:

- 구매자와 비결제자 각각의 `review_reach_rate_pct`가 나온다.
- 리뷰 도달이 구매 차이를 설명하면 랜딩 상단에 리뷰/구매평 요약을 올리는 실험으로 연결한다.

## 구현 상태

- 로컬 backend `leadingIndicators` API에 분모 보강 필드 추가 완료.
- 로컬 frontend `/ai-crm/leading-indicators`에 `scroll90 분모 점검` 섹션 추가 완료.
- 로컬 검증 완료:
  - `backend npm run typecheck` PASS
  - `frontend eslint leading-indicators/page.tsx` PASS
  - `harness-preflight-check --strict` PASS
  - `git diff --check` PASS
  - mock ledger smoke에서 `scroll_known_sessions`, `scroll_unknown_sessions`, `scroll90_known_rate_pct`, `scroll90_all_sessions_rate_pct`, `page_view_long_rate_pct`, `review_reach_rate_pct` 응답 확인
- 로컬 확인 주소: `http://localhost:7010/ai-crm/leading-indicators`
- VM Cloud 배포는 아직 하지 않았다.

## 다음 할 일

1. TJ님: 로컬 화면 `http://localhost:7010/ai-crm/leading-indicators`에서 `scroll90 분모 점검` 섹션을 본다.
2. TJ님: 더클린커피 GTM UI에서 `긴 조회 시간(page_view_long)` 트리거가 420초인지 확인한다. 이 값이 다르면 문서와 화면의 설명을 site별 값으로 분리한다.
3. Codex: TJ님 확인 후 VM Cloud 배포 승인안을 별도로 작성한다. 배포 범위는 backend `leadingIndicators` 응답 필드와 frontend 선행지표 화면이다.
