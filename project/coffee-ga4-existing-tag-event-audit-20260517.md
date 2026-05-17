# 더클린커피 GA4 기존 태그 이벤트 적재 확인

작성 시각: 2026-05-17 18:26 KST
Lane: Green read-only
대상: thecleancoffee

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - harness/coffee-data/VERIFY.md
  lane: Green
  allowed_actions:
    - ga4_bigquery_read_only_aggregate
    - documentation_update
  forbidden_actions:
    - gtm_publish
    - ga4_measurement_protocol_send
    - platform_send_or_upload
    - operating_db_write
    - raw_identifier_report_output
source_window_freshness_confidence:
    source: project-dadba7dd-0229-4ff6-81c.analytics_326949178 daily export + GTM API read-only
    window: GA4 2026-05-10~2026-05-16, GTM read 2026-05-17 18:37 KST
    freshness: latest GA4 daily table events_20260516, GTM Default Workspace read-only
    confidence: high for event-name existence, high for current GTM configured eventName, medium for runtime firing until Preview
```

## 10초 요약

- `page_view_long`과 `add_to_cart`는 최근 7일 GA4 BigQuery에 실제로 들어와 있다.
- `view_cart`, `begin_checkout`, `add_payment_info`는 같은 기간 GA4 BigQuery 기준 0이다.
- `purchase`는 들어와 있다. 따라서 문제는 구매 이벤트 부재가 아니라 구매 전 중간 이벤트 이름/매핑 gap이다.
- 더클린커피 GTM API read-only 기준, HURDLERS 이벤트 전송 태그는 이미 표준 GA4 이벤트명으로 매핑된 것이 있다.
- 다만 HURDLERS 태그 이름 자체는 GA4 BigQuery에 저장되지 않는다. Preview가 필요한 이유는 `설정상 매핑`이 아니라 실제 사이트에서 트리거가 발화되는지를 확인하기 위해서다.

## Target Event Summary

| event_name | events | sessions | cart_page_events | payment_page_events | product_page_events |
| --- | --- | --- | --- | --- | --- |
| page_view_long | 746 | 680 | 11 | 52 | 379 |
| add_to_cart | 393 | 205 | 0 | 0 | 74 |
| view_cart | 0 | 0 | 0 | 0 | 0 |
| begin_checkout | 0 | 0 | 0 | 0 | 0 |
| add_payment_info | 0 | 0 | 0 | 0 | 0 |
| purchase | 514 | 432 | 74 | 352 | 28 |

## HURDLERS / NPay / Cart 후보 event_name 검색

| event_name | events | sessions | cart_page_events | payment_page_events |
| --- | --- | --- | --- | --- |
| add_to_cart | 393 | 205 | 0 | 0 |

## GTM API read-only 매핑 확인

source: GTM API read-only, account `바이오컴(최종)`, container `thecleancoffee.com`, publicId `GTM-5M33GC4`, workspace `Default Workspace`, read at 2026-05-17 18:37 KST.

| GTM tag name | GA4 event_name / dataLayer event | measurement_id | trigger | 판단 |
| --- | --- | --- | --- | --- |
| GA4 page_view_long 이벤트 | page_view_long | G-JLSBXX7300 | 긴 조회 시간(page_view_long) | 실제 GA4 BigQuery 적재 확인됨 |
| HURDLERS - [이벤트전송] 장바구니 담기 | add_to_cart | G-JLSBXX7300 | HURDLE - [맞춤 이벤트] 장바구니 담기 | 실제 GA4 BigQuery 적재 확인됨 |
| HURDLERS - [데이터레이어] 장바구니 담기 | add_to_cart | 해당 없음, dataLayer push | HURDLE - [클릭] 장바구니 담기 | 이벤트 전송 태그의 선행 dataLayer |
| HURDLES - [이벤트전송] 주문서작성 | begin_checkout | G-JLSBXX7300 | HURDLE - [맞춤 이벤트] 주문서작성 | 설정은 존재하지만 최근 7일 GA4 BigQuery 적재 0 |
| HURDLERS - [데이터레이어] 주문서작성 | begin_checkout | 해당 없음, dataLayer push | HURDLE - [DOM 사용 가능] 주문서작성 | 설정은 존재하지만 런타임 발화 검증 필요 |
| HURDLERS - [데이터레이어] 네이버페이구매 (장바구니) | ga4_purchase | 해당 없음, dataLayer push | HURDLE - [링크클릭] 네이버페이 구매 (장바구니) | 실제 결제완료가 아니라 NPay intent/구매 의도 evidence로만 취급 |
| HURDLES - [이벤트전송] 구매 | purchase | G-JLSBXX7300 | HURDLE - [맞춤 이벤트] 구매 | purchase는 GA4 적재 확인됨 |
| HURDLERS - [이벤트전송] 상세페이지 조회 | view_item | G-JLSBXX7300 | HURDLE - [맞춤 이벤트] 상세페이지 조회 | view_item 적재 확인됨 |

주의: GTM의 `태그 이름`은 관리자가 보는 라벨이고 GA4 BigQuery에는 남지 않는다. GA4에 남는 것은 `event_name`이다. 따라서 HURDLERS라는 이름을 표준 이벤트명으로 바꾸는 것보다, `eventName` 값과 실제 발화 여부를 확인하는 것이 우선이다.

## 관련 parameter key 검색

값 원문은 출력하지 않고, key와 집계만 남긴다.

| event_name | param_key | rows | sessions |
| --- | --- | --- | --- |
| scroll | page_location | 5188 | 837 |
| scroll | page_referrer | 4060 | 775 |
| click | page_referrer | 3217 | 673 |
| page_view | page_location | 2987 | 1021 |
| page_view | page_referrer | 2824 | 923 |
| click | page_location | 2706 | 699 |
| user_engagement | page_location | 1348 | 572 |
| user_engagement | page_referrer | 1086 | 501 |
| form_start | page_location | 739 | 502 |
| form_start | form_destination | 738 | 503 |
| form_submit | form_destination | 630 | 381 |
| page_view | source | 577 | 370 |
| click | link_url | 550 | 288 |
| click | link_classes | 550 | 288 |
| session_start | page_referrer | 475 | 473 |
| page_view | medium | 454 | 278 |
| session_start | page_location | 448 | 445 |
| purchase | page_location | 426 | 382 |
| purchase | page_referrer | 377 | 355 |
| session_start | source | 363 | 362 |
| form_submit | page_referrer | 316 | 184 |
| form_start | page_referrer | 310 | 222 |
| form_submit | page_location | 266 | 170 |
| session_start | medium | 265 | 265 |
| first_visit | page_referrer | 235 | 234 |
| first_visit | page_location | 212 | 211 |
| first_visit | source | 210 | 209 |
| view_item | page_referrer | 163 | 104 |
| purchase | transaction_id | 162 | 131 |
| first_visit | medium | 141 | 141 |
| click | link_id | 137 | 79 |
| page_view | campaign | 116 | 71 |
| page_view | content | 116 | 71 |
| click | source | 109 | 62 |
| click | medium | 104 | 58 |
| page_view_long | page_referrer | 90 | 87 |
| page_view_long | page_location | 76 | 75 |
| session_start | content | 61 | 61 |
| session_start | campaign | 61 | 61 |
| add_to_cart | page_referrer | 50 | 35 |

## 판단

- 기존 `page_view_long` 태그는 실제 적재가 확인되어 선행지표로 쓸 수 있다. 단 `value=100`은 매출이 아니다.
- 기존 장바구니 계열은 `add_to_cart`로는 실제 적재가 확인된다.
- GTM 설정상 `begin_checkout` 태그도 존재하지만 최근 7일 GA4 BigQuery 적재는 0이다. 따라서 이름 문제가 아니라 트리거/DOM/dataLayer 런타임 발화 문제일 가능성이 높다.
- 표준 `view_cart`와 `add_payment_info`는 현재 더클린커피 GTM 설정에서 명확한 GA4 이벤트 전송 태그로 보이지 않는다. NPay 장바구니 태그의 `ga4_purchase` dataLayer는 실제 결제완료가 아니므로 `add_payment_info` 또는 intent evidence로 재설계해야 한다.
- 따라서 GTM Preview는 진행 가치가 있다. 단 Preview only이며 Submit/Create version/Publish는 금지한다. Preview 목표는 “태그가 있는가”가 아니라 “실제 장바구니/주문서/NPay 클릭에서 dataLayer와 GA4 전송 태그가 발화되는가”다.

## 금지선

- GA4 Measurement Protocol send 0
- Meta CAPI send 0
- Google Ads upload 0
- GTM publish 0
- 운영DB write 0
- raw identifier output 0
