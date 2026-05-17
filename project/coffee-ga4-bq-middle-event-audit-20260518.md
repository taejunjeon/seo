# 더클린커피 GA4 중간전환 BigQuery 재확인

작성 시각: 2026-05-18 05:48 KST
기준일: 2026-05-18
문서 성격: 더클린커피 GTM 게시 결과 + GA4 BigQuery 중간전환 적재 확인

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/coffee-data/README.md
  lane: Green audit + Red-approved GTM publish executed
  allowed_actions:
    - gtm_publish_only_after_tj_explicit_approval
    - ga4_bigquery_read_only_aggregate
    - documentation_update
  forbidden_actions:
    - ga4_measurement_protocol_send
    - meta_capi_send
    - google_ads_send_or_upload
    - operating_db_write
    - vm_cloud_deploy
    - raw_identifier_output
source_window_freshness_confidence:
  site: thecleancoffee
  gtm_container: GTM-5M33GC4
  ga4_source: project-dadba7dd-0229-4ff6-81c.analytics_326949178.events_*
  window: 2026-05-10~2026-05-17
  latest_export_table: events_20260516
  latest_event_kst: 2026-05-16 23:57:40
  confidence: high for BigQuery export up to 2026-05-16, medium for 2026-05-18 GTM runtime until next export
```

## 10초 요약

더클린커피 GTM에서 주문서 작성 GA4 전송 태그 이름을 `AGENTSOS - [GA4 이벤트전송] begin_checkout`으로 바꿔 게시했다. 이 변경은 이름 정리이며, `begin_checkout` event name과 trigger/dataLayer 구조는 유지했다.

GA4 BigQuery 기준으로는 최신 daily export가 `2026-05-16`까지라서, 2026-05-18 새벽 Preview와 게시 결과는 아직 BigQuery에 나타날 수 없다. 현재 확인된 것은 `회원가입`과 `page_view_long`은 적재 중이고, `add_payment_info`, 명시적 `scroll50`, 쿠폰 전용 이벤트는 아직 없다는 점이다.

## GTM 게시 결과

- container: `GTM-5M33GC4`
- 게시 버전: `21`
- 게시 시각: 2026-05-18 05:37 KST
- 변경된 태그: `AGENTSOS - [GA4 이벤트전송] begin_checkout`
- 변경 성격: 기존 `HURDLES - [이벤트전송] 주문서작성` 이름을 AGENTSOS 기준으로 rename
- 유지한 것: GA4 event name `begin_checkout`, trigger, dataLayer/ecommerce contract

하지 않은 것:

- GA4 Measurement Protocol 전송 0
- Meta CAPI 전송 0
- Google Ads/Naver/TikTok 전송 0
- 운영DB write 0
- VM Cloud deploy/restart 0
- raw 주문/결제/회원/click id 출력 0

## BigQuery 확인 결과

source: GA4 BigQuery `project-dadba7dd-0229-4ff6-81c.analytics_326949178.events_*`

window: 2026-05-10~2026-05-17

freshness: 최신 export table `events_20260516`, 최신 이벤트 2026-05-16 23:57:40 KST

| 항목 | 최근 7일 결과 | 판단 |
|---|---:|---|
| `begin_checkout` | 0 events | 2026-05-18 게시분은 아직 export 대기. 2026-05-16까지는 미적재 |
| `add_payment_info` | 0 events | 결제수단 선택 이벤트는 아직 없다 |
| 쿠폰 전용 이벤트 | dedicated event 0 | 쿠폰받기 전용 이벤트는 아직 없다 |
| 쿠폰 문맥 `click` | 854 events / 192 sessions | 쿠폰/할인 문맥 가능성이 있는 참고값. 쿠폰받기 클릭으로 확정하면 안 됨 |
| 회원가입 `1초회원가입` | 43 events / 38 sessions | 적재 확인 |
| `page_view_long` | 745 events / 679 sessions | 적재 확인 |
| 명시적 `scroll50` | 0 events | 현재는 `scroll`/`page_view_long`으로만 봐야 함 |

## 해석

### 1. begin_checkout

GTM Preview에서는 주문서 화면에서 `begin_checkout` dataLayer event가 생성되는 것을 확인했다. 또한 이름 정리된 GA4 전송 태그를 운영 version 21로 게시했다.

다만 BigQuery daily export는 하루 이상 늦게 보일 수 있다. 최신 table이 `events_20260516`이므로 2026-05-18 새벽 변경분은 아직 BigQuery로 판정할 수 없다.

### 2. add_payment_info

현재 BigQuery에는 `add_payment_info`가 없다. 결제수단 선택, NPay 선택, 카드/가상계좌 선택 같은 행동을 “구매 직전 선행지표”로 보려면 별도 이벤트 설계가 필요하다.

### 3. 쿠폰

쿠폰 관련 문맥은 있다. 그러나 이것은 페이지/클릭 이벤트 안에서 쿠폰/할인 문맥이 잡힌 aggregate일 뿐이다.

쿠폰받기 버튼을 선행지표로 쓰려면 `coupon_download`, `coupon_click`, 또는 GA4 추천 이벤트에 가까운 `select_promotion` 중 하나를 정해야 한다.

### 4. 회원가입

`1초회원가입` 이벤트는 BigQuery에 적재되고 있다. 다만 표준 GA4 이벤트명은 아니므로 장기적으로는 `sign_up`과 함께 보낼지 검토할 수 있다.

### 5. scroll50 / page_view_long

`page_view_long`은 적재되고 있다. 명시적 `scroll50` 이벤트나 `percent_scrolled >= 50` 형태는 이번 쿼리에서 확인되지 않았다.

따라서 지금은 “오래 머문 사용자”는 `page_view_long`, “스크롤 깊이”는 GTM Preview의 `gtm.scrollDepth`와 GA4 `scroll`을 별도로 보는 구조다.

## 다음 확인 기준

1. 다음 GA4 daily export가 `events_20260518`까지 생성되면 `begin_checkout`을 다시 조회한다.
2. `begin_checkout`이 BigQuery에 들어오면 주문서 진입 선행지표는 1차 완료로 본다.
3. `add_payment_info`와 쿠폰 전용 이벤트는 새 태그 설계가 필요하다. 둘 다 Purchase로 올리면 안 되고 구매 전 행동으로 분리해야 한다.

## 산출물

- JSON evidence: `data/project/coffee-ga4-bq-middle-event-audit-20260518.json`
- 조회 스크립트: `backend/scripts/coffee-ga4-bq-middle-event-audit-20260518.ts`
- GTM 문서 갱신: `GA4/gtm-thecleancoffee.md`
