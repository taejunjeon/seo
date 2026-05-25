# 더클린커피 GTM/GA4 태그·이벤트 인벤토리

작성 시각: 2026-05-24 16:40 KST
기준일: 2026-05-24
문서 성격: 더클린커피 GTM live tag + GA4 BigQuery event inventory

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  lane: Green audit + Red-approved GTM publish already executed
  allowed_actions:
    - gtm_api_read_only
    - ga4_bigquery_read_only_aggregate
    - documentation_update
    - tj_approved_gtm_submit_create_version_publish_for_begin_checkout_rename
  forbidden_actions:
    - unapproved_gtm_submit_create_version_publish
    - ga4_measurement_protocol_send
    - platform_send_or_upload
    - operating_db_write
    - vm_cloud_deploy
source_window_freshness_confidence:
  gtm_source: GTM API live container version
  ga4_source: project-dadba7dd-0229-4ff6-81c.analytics_326949178.events_*
  window: 2026-04-07~2026-05-16
  freshness: latest daily table events_20260516
  site: thecleancoffee
  confidence: high for configured live tags, high for GA4 event existence, medium for runtime trigger cause until Preview
```

## 10초 요약

- 이 문서는 더클린커피의 **GTM에 게시된 태그**와 **GA4 BigQuery에 실제 적재된 이벤트**를 한 문서에 분리해 정리한다.
- GTM 태그 이름은 관리용 라벨이고, GA4에 실제로 남는 값은 `event_name`이다.
- 2026-05-18 05:37 KST에 TJ님 승인 범위로 `begin_checkout` GA4 전송 태그 이름만 `AGENTSOS`로 바꿔 GTM version 21을 게시했다.
- 2026-05-24 16:38 KST에 TJ님 승인 범위로 일반 주문서 `/shop_payment/` 전용 Meta browser `InitiateCheckout` 태그를 추가해 GTM version 22를 게시했다.
- 2026-05-24 16:46 KST에 같은 태그에 정기구독 checkout 중복 방지 guard를 추가해 GTM version 23을 게시했다.
- 2026-05-25 06:02 KST에 실제 주문서 smoke의 `missing_value` 차단을 반영해 같은 태그에 주문금액 렌더링 재시도 guard를 추가하고 GTM version 24를 게시했다.
- 2026-05-25 06:12 KST 실제 일반 주문서 재-smoke에서 Meta Pixel Helper `InitiateCheckout` 활성, value `33900`, currency `KRW`, value_status `present`, console `sent`를 확인했다.
- GA4 이벤트는 현재 BigQuery에 적재된 전체 export 기간(`2026-04-07~2026-05-16`)을 read-only로 집계했다. 2026-05-18 Preview/Publish 결과는 아직 BigQuery daily export에 들어오지 않았다.
- 이 문서 작성 과정에서 GA4/Meta/Google/TikTok/Naver 전송, 운영DB write, VM Cloud deploy는 하지 않았다.

## Source / Window / Freshness

| 항목 | 값 |
| --- | --- |
| site | thecleancoffee (thecleancoffee.com) |
| GTM container | GTM-5M33GC4 / live version 24 (Coffee Meta InitiateCheckout shop_payment value retry guard - 20260524T210252Z) |
| GA4 measurement ID | G-JLSBXX7300 |
| GA4 BigQuery source | project-dadba7dd-0229-4ff6-81c.analytics_326949178.events_* |
| GA4 export window | 2026-04-07~2026-05-16 (40 daily tables) |
| GA4 latest table | events_20260516 |
| confidence | GTM live 설정 high / GA4 적재 high / 실제 런타임 원인 medium |

### 2026-05-24 13:18 KST GTM API read-only 재확인

GTM API read-only로 `GTM-5M33GC4`의 live version을 다시 조회했다.

확인 결과:

- container path: `accounts/4703003246/containers/91608400`
- live version: `21` / `AGENTSOS GA4 begin_checkout rename - 2026-05-18`
- live 구성 수: tags 33 / triggers 24 / variables 13
- Default Workspace 상태: workspaceChange 0 / mergeConflict 0
- Meta/Facebook/fbq 전용 GTM 태그: 0건
- `add_payment_info` GTM 태그: 0건
- `begin_checkout` 체인:
  - tag 51 `AGENTSOS - [begin_checkout] 주문서작성`: 주문서 DOM에서 `begin_checkout` dataLayer event를 만드는 Custom HTML
  - tag 35 `AGENTSOS - [GA4 이벤트전송] begin_checkout`: 위 custom event를 GA4 `begin_checkout`으로 전송

판단:

- 결제 진입 Meta `InitiateCheckout` no-send Preview를 위해 기존 GTM 태그를 수정할 필요는 없다.
- 기존 tag 35/51은 GA4 `begin_checkout` 정본 체인이므로 유지한다.
- 새 Preview 후보는 기존 `begin_checkout` 트리거를 재사용하지 말고, `/shop_payment/` DOM Ready + 완료 URL 제외 조건의 별도 Custom HTML no-send 태그로 분리한다.

### 2026-05-24 16:38~2026-05-25 06:03 KST GTM Production publish — Meta InitiateCheckout shop_payment

TJ님 승인에 따라 일반 주문서 `/shop_payment/` 전용 Meta browser `InitiateCheckout` 운영 태그를 게시했다.

게시 결과:

- 이전 live version: `21` / `AGENTSOS GA4 begin_checkout rename - 2026-05-18`
- 1차 live version: `22` / `Coffee Meta InitiateCheckout shop_payment - 20260524T073809Z`
- subscription guard live version: `23` / `Coffee Meta InitiateCheckout shop_payment subscription guard - 20260524T074633Z`
- 최종 live version: `24` / `Coffee Meta InitiateCheckout shop_payment value retry guard - 20260524T210252Z`
- 1차 workspace: `codex_coffee_meta_initiatecheckout_shop_payment_prod_20260524T073809Z` / id `31`
- guard 보강 workspace: `codex_coffee_meta_initiatecheckout_shop_payment_prod_20260524T074633Z` / id `32`
- value retry workspace: `codex_coffee_meta_initiatecheckout_shop_payment_prod_20260524T210252Z` / id `33`
- workspace after publish: 삭제됨 / Default Workspace만 남음
- tag: id `99` / `AGENTSOS - [Meta Browser] InitiateCheckout - shop_payment`
- trigger: id `98` / `AGENTSOS - [DOM Ready] shop_payment order only`
- quick preview compiler error: `false`
- post-publish read-only: target tag 1건 / target trigger 1건
- live 구성 수: tags 34 / triggers 25 / variables 13
- 최종 tag guard: `subscription_checkout_excluded` + `waiting_value` 포함
- v24 browser smoke: PASS (`InitiateCheckout.f4c64d08`, value `33900`, value selector `#oms-shop-payment text:total_order_price`)

운영 태그 조건:

- path가 `/shop_payment` 또는 `/shop_payment/`일 때만 실행한다.
- query 또는 checkout context에 `order_code`, `order_no`, `checkoutId` 중 하나가 있어야 한다.
- 주문 요약의 `총 주문금액` 등에서 value를 읽지 못하면 최대 8초까지 재시도하고, 그래도 실패하면 전송하지 않는다.
- sessionStorage dedupe로 같은 eventID는 1회만 전송한다.
- eventID는 raw order code가 아니라 hash 형식이다.
- `/subscription/`, 정기구독 checkout, `/shop_payment_complete`, `/shop_order_done`에는 발화하지 않는다.

하지 않은 것:

- Meta `Purchase` 전송 없음.
- Meta CAPI enable/send 없음.
- GA4 Measurement Protocol send 없음.
- Google Ads/Naver/TikTok 전송 없음.
- 운영DB 또는 VM Cloud SQLite write 없음.

## GTM Live 태그 전체 목록

| tagId | 상태 | type | 태그 이름 | 보내는 곳/이벤트 | 측정/플랫폼 ID | 발화 트리거 | 차단 트리거 | 메모 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | active | googtag | GA4 구성 태그 | Google tag config | G-JLSBXX7300 | trigger 2147479553 | - | 기본 Google/GA4/Ads 태그 |
| 7 | active | gaawe | GA4 page_view_long 이벤트 | GA4 event: page_view_long | G-JLSBXX7300 | 긴 조회 시간(page_view_long) | - | value=Y, currency=Y |
| 8 | active | gaawe | GA4 모든 링크 클릭 | GA4 event: click | G-JLSBXX7300 | 모든 링크 클릭 | - | GA4 event 전송 |
| 12 | active | ua | UA - Event -Scroll | Universal Analytics legacy event | UA | 이벤트 - 스크롤 | - | GA4 정본 아님 |
| 13 | active | gaawe | GA4-이벤트-스크롤 | GA4 event: scroll | G-JLSBXX7300 | 이벤트 - 스크롤 | - | GA4 event 전송 |
| 14 | active | ua | UA - PageView | Universal Analytics legacy event | UA | trigger 2147479553 | - | GA4 정본 아님 |
| 19 | active | ua | UA-이벤트-1초회원가입 | Universal Analytics legacy event | UA | 이벤트-클릭-1초회원가입 | - | GA4 정본 아님 |
| 20 | active | gaawe | GA4-이벤트-1초회원가입 | GA4 event: 1초회원가입 | G-JLSBXX7300 | 이벤트-클릭-1초회원가입 | - | GA4 event 전송 |
| 22 | active | ua | UA-이벤트-카톡채널 버튼 클릭 | Universal Analytics legacy event | UA | 이벤트-클릭-카톡채널 | - | GA4 정본 아님 |
| 23 | active | gaawe | GA4-이벤트-카톡채널 | GA4 event: kakaochannel_click | G-JLSBXX7300 | 이벤트-클릭-카톡채널 | - | GA4 event 전송 |
| 24 | active | gclidw | Google Ads - 전환 링커 | Conversion Linker | Google Ads click id 보존 | trigger 2147479553 | - | 클릭 ID 보존용 |
| 25 | active | sp | Google Ads - 리마케팅 | Google Ads remarketing | AW-10965703590 | trigger 2147479553 | - | 리마케팅 |
| 26 | active | awct | Google Ads - 전환추적 - 1초 회원가입 | Google Ads conversion | AW-10965703590 | 이벤트-클릭-1초회원가입 | - | conversion label 있음 |
| 27 | active | awct | Google Ads 전환 추적-카톡채널 추가 클릭 | Google Ads conversion | AW-10965703590 | 이벤트-클릭-카톡채널 | - | conversion label 있음 |
| 35 | active | gaawe | AGENTSOS - [GA4 이벤트전송] begin_checkout | GA4 event: begin_checkout | G-JLSBXX7300 | HURDLE - [맞춤 이벤트] 주문서작성 | - | currency=Y, items=Y |
| 39 | active | html | HURDLERS - [데이터레이어] 네이버페이구매 (장바구니) | Custom HTML | 브라우저 실행 스크립트 | HURDLE - [링크클릭] 네이버페이 구매 (장바구니) | - | NPay intent/dataLayer 후보. 실제 결제완료 아님 |
| 40 | active | html | HURDLERS - [데이터레이어] 초기화 | Custom HTML | 브라우저 실행 스크립트 | - | - | dataLayer push 후보 |
| 44 | active | gaawe | HURDLERS - [이벤트전송] 장바구니 담기 | GA4 event: add_to_cart | G-JLSBXX7300 | HURDLE - [맞춤 이벤트] 장바구니 담기 | - | currency=Y, items=Y |
| 49 | active | gaawe | HURDLES - [이벤트전송] 구매 | GA4 event: purchase | G-JLSBXX7300 | HURDLE - [맞춤 이벤트] 구매 | - | transaction_id=Y, value=Y, currency=Y, items=Y, shipping=Y |
| 51 | active | html | AGENTSOS - [begin_checkout] 주문서작성 | Custom HTML | 브라우저 실행 스크립트 | HURDLE - [DOM 사용 가능] 주문서작성 | - | dataLayer push 후보 |
| 54 | active | gaawe | HURDLERS - [이벤트전송] 상세페이지 조회 | GA4 event: view_item | G-JLSBXX7300 | HURDLE - [맞춤 이벤트] 상세페이지 조회 | - | currency=Y, items=Y |
| 56 | active | html | HURDLERS - [데이터레이어] 네이버페이구매 (제품상세) | Custom HTML | 브라우저 실행 스크립트 | HURDLE - [링크클릭] 네이버페이구매(제품상세) | - | NPay intent/dataLayer 후보. 실제 결제완료 아님 |
| 59 | active | html | HURDLERS - [데이터레이어] 장바구니 담기 | Custom HTML | 브라우저 실행 스크립트 | HURDLE - [클릭] 장바구니 담기 | - | dataLayer push 후보 |
| 62 | active | html | HURDLERS - [데이터레이어] 상세페이지 조회 | Custom HTML | 브라우저 실행 스크립트 | HURDLE - [DOM 사용 가능] 상세페이지 조회 | - | dataLayer push 후보 |
| 65 | active | cvt_91608400_63 | scroll25 | cvt_91608400_63 | - | scroll25 | - | custom/template/기타 태그 |
| 66 | active | cvt_91608400_63 | 채널톡_구매 전환 | cvt_91608400_63 | - | HURDLE - [맞춤 이벤트] 구매 | - | custom/template/기타 태그 |
| 69 | active | cvt_91608400_63 | 채널톡_초대코드 복사하기 | cvt_91608400_63 | - | 채널톡_초대코드 복사하기 | - | custom/template/기타 태그 |
| 72 | active | gaawe | GA4_정기구독 신청 완료 | GA4 event: subscription_completed | G-JLSBXX7300 | 정기구독 신청완료 | - | GA4 event 전송 |
| 73 | active | gaawe | GA4_정기구독 해지 완료 | GA4 event: cancel_subscription | G-JLSBXX7300 | 정기구독 해지 완료 클릭 | - | GA4 event 전송 |
| 74 | active | googtag | Google 태그 AW-10965703590 | Google tag config | AW-10965703590 | trigger 2147479573 | - | 기본 Google/GA4/Ads 태그 |
| 76 | active | cvt_MQDKZ | Microsoft Clarity - Official | cvt_MQDKZ | - | trigger 2147479553 | - | custom/template/기타 태그 |
| 85 | active | html | Coffee NPay Intent Dispatcher v2.1 | Custom HTML | 브라우저 실행 스크립트 | A-4 Coffee NPay Intent Dispatcher Trigger (All Pages) | - | NPay intent/dataLayer 후보. 실제 결제완료 아님 |
| 87 | active | html | Coffee NPay Intent Snippet Installer v1 | Custom HTML | 브라우저 실행 스크립트 | A-4 Coffee Snippet Installer Trigger (Window Loaded) | - | NPay intent/dataLayer 후보. 실제 결제완료 아님 |
| 99 | active | html | AGENTSOS - [Meta Browser] InitiateCheckout - shop_payment | Meta browser event: InitiateCheckout | Meta Pixel 1186437633687388 | AGENTSOS - [DOM Ready] shop_payment order only | - | 일반 주문서 `/shop_payment/` 전용. `/subscription/`/완료 페이지 제외. value 최대 8초 재시도. Meta CAPI/Purchase 아님 |

## GA4 표준 퍼널 이벤트 빠른 상태

| event_name | events | sessions | latest_event_at_kst | 판단 |
| --- | --- | --- | --- | --- |
| page_view | 43476 | 10274 | 2026-05-16 23:57:40 | 적재 확인 |
| view_item | 3438 | 1603 | 2026-05-16 23:25:51 | 적재 확인 |
| add_to_cart | 1603 | 770 | 2026-05-16 21:44:34 | 적재 확인 |
| view_cart | 0 | 0 | - | 현재 export 기간 미적재 |
| begin_checkout | 0 | 0 | - | 현재 export 기간 미적재 |
| add_payment_info | 0 | 0 | - | 현재 export 기간 미적재 |
| purchase | 1370 | 1168 | 2026-05-16 23:22:45 | 적재 확인 |
| scroll | 55504 | 6687 | 2026-05-16 23:57:07 | 적재 확인 |
| page_view_long | 1787 | 1524 | 2026-05-16 22:49:57 | 적재 확인 |

## GA4 BigQuery event_name 전체 목록

| event_name | events | users | sessions | cart_page_events | checkout_or_payment_page_events | product_page_events | latest_event_at_kst |
| --- | --- | --- | --- | --- | --- | --- | --- |
| scroll | 55504 | 4767 | 6687 | 5402 | 7605 | 55504 | 2026-05-16 23:57:07 |
| click | 53022 | 3719 | 5205 | 3650 | 1947 | 53022 | 2026-05-16 23:56:34 |
| page_view | 43476 | 7181 | 10274 | 3048 | 3748 | 43476 | 2026-05-16 23:57:40 |
| user_engagement | 22583 | 4231 | 5895 | 2040 | 1658 | 22583 | 2026-05-16 23:57:38 |
| session_start | 10878 | 7171 | 10815 | 92 | 439 | 10878 | 2026-05-16 23:55:03 |
| first_visit | 6101 | 6086 | 6089 | 12 | 201 | 6101 | 2026-05-16 23:48:07 |
| view_item | 3438 | 1267 | 1603 | 0 | 0 | 3438 | 2026-05-16 23:25:51 |
| form_start | 2135 | 1069 | 1265 | 124 | 1301 | 2135 | 2026-05-16 23:28:53 |
| form_submit | 1842 | 914 | 1023 | 528 | 15 | 1842 | 2026-05-16 23:30:18 |
| page_view_long | 1787 | 1031 | 1524 | 43 | 105 | 1787 | 2026-05-16 22:49:57 |
| add_to_cart | 1603 | 669 | 770 | 0 | 0 | 1603 | 2026-05-16 21:44:34 |
| purchase | 1370 | 1063 | 1168 | 229 | 753 | 1370 | 2026-05-16 23:22:45 |
| 1초회원가입 | 107 | 92 | 92 | 0 | 0 | 107 | 2026-05-16 16:33:53 |
| kakaochannel_click | 79 | 77 | 78 | 0 | 77 | 79 | 2026-05-16 23:06:56 |
| view_search_results | 51 | 30 | 33 | 0 | 0 | 51 | 2026-05-14 12:57:47 |
| refund | 45 | 45 | 45 | 0 | 0 | 0 | 2026-04-24 23:08:29 |

## 2026-05-17 Preview 관측 메모

출처: TJ님 GTM Preview / Meta Pixel Helper 스크린샷, read-only 해석.

### 관측된 것

- 상품상세 진입 시 `HURDLERS - [데이터레이어] 상세페이지 조회`와 `HURDLERS - [이벤트전송] 상세페이지 조회`가 Fired로 보인다.
- 같은 화면에서 GA4 `view_item`, 기본 `PageView`, Google Ads 리마케팅/전환 링커, Microsoft Clarity가 Fired로 보인다.
- 쿠폰받기 클릭 후에도 GTM Summary 기준 쿠폰 전용 태그는 보이지 않는다.
- Meta Pixel Helper에는 `SubscribedButtonClick`이 자동 감지 이벤트처럼 보인다. 이는 GTM/GA4 live 태그가 아니라 Meta/FBE 자동 감지로 해석한다.
- 구매하기 클릭 후에도 상품상세 URL(`/shop_view?idx=...`) 상태에서는 `begin_checkout` Fired가 보이지 않는다.

### read-only 대조 결과

- GTM live tag/trigger 이름과 HTML 코드에서 `쿠폰`/`coupon` 전용 태그는 확인되지 않았다.
- 더클린커피 GA4 BigQuery export 기간(`2026-04-07~2026-05-16`)에서 `coupon`, `쿠폰`, `subscribe`, `subscribed`, `lead`, `button` 계열 event_name 검색 결과는 `click`, `kakaochannel_click`뿐이다.
- 따라서 쿠폰받기는 현재 명시적인 GA4/VM/Meta 표준 선행지표로 관리되지 않고, Meta 자동 감지 이벤트에만 부분적으로 보일 가능성이 높다.

### 판단

쿠폰받기는 구매 전 의도가 강한 선행지표라 별도 관리 가치가 있다. 다만 purchase나 add_payment_info로 올리면 안 되고, 다음 중 하나로 분리해야 한다.

1. GA4: `coupon_download` 또는 `select_promotion` 후보.
2. VM Cloud: `coupon_received` 또는 `coupon_click` 선행지표 후보.
3. Meta: 바로 Purchase가 아니라 `Lead` 또는 custom event 후보. 실제 광고 학습에 넣을지는 별도 Red/Yellow 승인 후 결정.

### 결제하기 버튼 gap 해석

현재 더클린커피 GTM의 `begin_checkout`은 상품상세의 구매하기 버튼 클릭이 아니라 `/shop_payment/` 주문서 화면 DOM Ready에서 dataLayer를 만드는 구조다. 상품상세에서 구매하기 버튼만 눌렀는데 주문서 URL로 이동하지 않거나 옵션/팝업 단계에서 멈추면 `begin_checkout`이 Fired되지 않는 것이 정상일 수 있다.

## 2026-05-18 Preview 업데이트 — AGENTSOS begin_checkout

출처: TJ님 GTM Preview 캡처/데이터 영역 공유, read-only 해석.

확인된 것:

- 신규 Custom HTML 태그 `AGENTSOS - [begin_checkout] 주문서작성`이 주문서 화면에서 1회 Fired 되었다.
- 좌측 이벤트 목록에 `begin_checkout`이 생성됐다.
- dataLayer에는 `agentsos_ga4`, `hurdlers_ga4`, `ecommerce`가 함께 들어갔다.
- `agentsos_ga4.value`는 33900, `currency`는 KRW, `items[0].item_id`는 75, `quantity`는 1로 확인됐다.
- 기존 `HURDLES - [이벤트전송] 주문서작성` GA4 이벤트 태그도 1회 Fired 되었다.

판정:

- 더클린커피 `begin_checkout`은 Preview 기준 복구됐다.
- 기존 GA4 이벤트 전송 태그가 아직 `HURDLES` 이름이므로, 운영 관리상 `[AGENTSOS] - [이벤트전송] 주문서작성`으로 이름 정리가 필요하다.
- 기존 태그/변수가 `hurdlers_ga4`를 읽는 동안은 호환 필드를 유지한다.
- GA4 BigQuery 적재는 다음 일별 export 이후 확인한다.
- 주문/결제/회원 raw identifier는 문서에 남기지 않는다.

### 2026-05-18 03:53 다른 상품 주문서 예외

추가 Preview에서 다른 상품 주문서 화면은 `AGENTSOS - [begin_checkout] 주문서작성` Custom HTML이 Fired 되었지만 좌측 이벤트 목록에 `begin_checkout`이 생성되지 않았다.

Codex Chrome read-only 확인으로 좁힌 원인:

- 해당 주문서 화면에서도 기존 `.shop_item_*` selector는 0개였다.
- 화면 본문에는 상품명/금액/수량/상품 링크가 있어 text fallback으로는 item 생성이 가능했다.
- AGENTSOS dedupe storage는 없어서 “이미 전송됨” 차단은 아니었다.
- 페이지 실행 문맥에서 전역 `parseInt`가 함수가 아닌 상태로 관측됐다.

결론: 첫 상품에서 Preview PASS였더라도 모든 상품 주문서에서 안정적이라고 보면 안 된다. `AGENTSOS begin_checkout`은 v1.1로 보강해야 한다.

v1.1 요구사항:

- bare `parseInt(...)` 사용 금지, `Number(...)` 기반 파서 사용.
- 상품 단위 safe dedupe key 사용. 같은 세션에서 다른 상품 주문서도 각각 1회 발화할 수 있어야 한다.
- `.shop_item_*` selector 실패 시 text fallback으로 상품명/금액/수량을 읽는다.
- raw 주문/결제/회원 식별자는 dataLayer/sessionStorage key/문서에 남기지 않는다.
- Preview에서 최소 2개 상품 주문서로 재검증한다.

### 2026-05-18 04:31 운영 게시 — AGENTSOS begin_checkout v1.1

TJ님 Preview 재검증 기준으로 서로 다른 상품 2개에서 아래가 확인됐다.

- `AGENTSOS - [begin_checkout] 주문서작성` Custom HTML이 상품별 주문서 화면에서 각각 1회 Fired.
- 좌측 이벤트 목록에 `begin_checkout`이 생성됨.
- 기존 `HURDLES - [이벤트전송] 주문서작성` GA4 이벤트 태그도 각각 1회 Fired.

해석:

- `AGENTSOS - [begin_checkout] 주문서작성`은 dataLayer에 `begin_checkout`을 만드는 태그다.
- `HURDLES - [이벤트전송] 주문서작성`은 그 `begin_checkout`을 GA4로 보내는 태그다.
- 따라서 두 태그가 함께 뜨는 것은 중복 발화가 아니라 정상 체인이다.
- 이름만 `HURDLES`로 남아 있어 헷갈리므로, 다음 정리 때 `[AGENTSOS] - [이벤트전송] 주문서작성`으로 rename 후보다.

GTM Production publish:

- 버전: `20`
- 버전 이름: `AGENTSOS begin_checkout v1.1 - 2026-05-18`
- 게시 시각: 2026-05-18 04:31 KST
- 변경 범위: `AGENTSOS - [begin_checkout] 주문서작성` 1건
- 하지 않은 것: Purchase/CAPI/운영DB/VM Cloud 변경 없음

다음 검증:

- GA4 DebugView 또는 Realtime에서 `begin_checkout` 수신 확인.
- 다음 BigQuery 일별 export 이후 `begin_checkout` 적재 확인.
- 기존 `HURDLES` 이름의 GA4 이벤트 전송 태그는 rename만 검토하고, 삭제하지 않는다.

### GTM “새 컨테이너 버전 사용 가능 / 작업공간 업데이트” 해석

이 문구는 현재 GTM workspace가 최신 live/container 변경을 아직 반영하지 않았다는 뜻이다. `작업공간 업데이트`는 게시가 아니라, 현재 workspace에 최신 변경사항을 병합하는 작업이다.

실무 원칙:

- Preview 확인만 하는 동안은 즉시 publish와 별개다.
- 하지만 태그를 수정하거나 publish 후보를 만들기 전에는 workspace update를 먼저 눌러 최신 상태로 맞추는 것이 안전하다.
- 업데이트 없이 오래된 workspace를 publish하면 다른 사람이 만든 최신 변경을 덮어쓸 위험이 있다.
- 업데이트 후 충돌이 뜨면 publish 금지, 어떤 태그/트리거가 충돌하는지 먼저 백업하고 비교한다.

### 2026-05-18 05:37 운영 게시 — GA4 begin_checkout 전송 태그 rename

TJ님 승인에 따라 기존 GA4 전송 태그 이름을 운영자가 이해하기 쉬운 이름으로 바꿔 게시했다.

- 기존 이름: `HURDLES - [이벤트전송] 주문서작성`
- 새 이름: `AGENTSOS - [GA4 이벤트전송] begin_checkout`
- GTM container: `GTM-5M33GC4`
- 게시 버전: `21`
- 게시 시각: 2026-05-18 05:37 KST
- 변경 범위: 태그 이름 정리 1건
- 유지한 것: event name `begin_checkout`, trigger, dataLayer/ecommerce contract
- 하지 않은 것: GA4 Measurement Protocol 전송, Meta CAPI 전송, Google Ads 전송, 운영DB write, VM Cloud deploy

해석:

- `AGENTSOS - [begin_checkout] 주문서작성`은 주문서 화면에서 `dataLayer.push({ event: "begin_checkout" ... })`를 만드는 태그다.
- `AGENTSOS - [GA4 이벤트전송] begin_checkout`은 그 dataLayer event를 GA4로 보내는 태그다.
- 두 태그가 함께 보이는 것이 정상 체인이다. 하나가 dataLayer를 만들고, 다른 하나가 GA4로 전송한다.

### 2026-05-18 05:45 GA4 BigQuery export 재확인

BigQuery daily export 기준으로 최근 7일(`2026-05-10~2026-05-17`)을 read-only 조회했다.

중요한 제한:

- 최신 daily export table은 `events_20260516`이다.
- 최신 이벤트 시각은 2026-05-16 23:57:40 KST다.
- 따라서 2026-05-18 새벽 GTM Preview/Publish로 만든 `begin_checkout` 결과는 아직 BigQuery에서 확인할 수 없다.

확인 결과:

| 확인 항목 | 최근 7일 BigQuery 결과 | 판단 |
|---|---:|---|
| `add_payment_info` | 0 events | 아직 적재 없음. 결제수단 선택 이벤트 설계/태그 필요 |
| 쿠폰 전용 이벤트 | dedicated event 0 | 전용 이벤트 없음. `click`/`page_view`의 쿠폰 문맥 aggregate만 있음 |
| 쿠폰 문맥 `click` | 854 events / 192 sessions | 쿠폰 관련 가능성이 있는 참고값. 쿠폰받기 전용 클릭으로 확정 불가 |
| 회원가입 `1초회원가입` | 43 events / 38 sessions | 적재 확인 |
| `page_view_long` | 745 events / 679 sessions | 적재 확인 |
| 명시적 `scroll50` | 0 events | 현재는 `scroll` 또는 `page_view_long`으로만 봐야 함 |
| `begin_checkout` | 0 events | 2026-05-18 게시분은 export 대기. 2026-05-16까지는 미적재 |

운영 판단:

- `begin_checkout`은 GTM Preview에서 복구됐고 version 21로 게시됐다. BigQuery 확인은 다음 daily export 이후 가능하다.
- 쿠폰은 현재 “쿠폰받기 전용 이벤트”가 아니다. 선행지표로 쓰려면 `coupon_download` 또는 `select_promotion` 같은 별도 이벤트가 필요하다.
- `add_payment_info`는 아직 없다. 결제수단 선택/NPay 선택을 매출 전 선행지표로 쓰려면 별도 태그 또는 VM Cloud 수집이 필요하다.

### 2026-05-24 11:39 실제 UI 확인 — 정기구독 신청 begin_checkout

TJ님이 Tag Assistant에서 실제 더클린커피 정기구독 상품 흐름을 확인했다.

테스트 흐름:

1. `/subscription/?idx=74` 상품상세에서 메뉴 드롭다운 2개를 선택했다.
2. `정기구독 신청` 버튼을 누르기 전에는 `begin_checkout`이 없었다.
3. `정기구독 신청` 버튼 클릭 후 event timeline 23번에 `begin_checkout`이 생겼다.

확인된 dataLayer payload:

```js
{
  event: "begin_checkout",
  event_source: "agentsos",
  agentsos_event_version: "2026-05-18-agentsos-begin-checkout-v1-1",
  ecommerce: {
    currency: "KRW",
    value: 18900,
    items: [
      {
        item_name: "[더클린 정기구독] 파푸아뉴기니 마라와카 AA 유기농 블루마운틴",
        item_id: "74",
        price: "18900",
        quantity: 1,
        item_brand: "thecleancoffee"
      }
    ]
  }
}
```

해석:

- `AGENTSOS - [begin_checkout] 주문서작성`이 구독 신청 클릭 후 `begin_checkout` dataLayer event를 만든다.
- `AGENTSOS - [GA4 이벤트전송] begin_checkout`이 같은 event를 GA4로 보내는 체인이다.
- 정기구독 신청 클릭은 이미 표준 `begin_checkout`으로 잡히며, 상품/금액도 정상이다.
- 별도 구독 intent click listener를 운영 publish하면 같은 순간을 한 번 더 잡는 중복 layer가 될 수 있다.
- 구독 checkout 분석은 우선 `begin_checkout` + `item_id=74` + 상품명 + `/subscription` path를 사용한다.
- 다음 gap은 `add_payment_info` 또는 NPay/카드 결제수단 선택 intent다.


## Preview 전용 체크리스트

Preview는 “수정”이 아니라 **실제 브라우저에서 어떤 태그가 발화되는지 보는 검사 모드**다. 아래 항목은 Publish 없이 확인한다.

### 더클린커피 Preview에서 확인할 흐름

1. 상품 상세 진입
   - 무엇을 본다: `view_item`, `page_view_long`.
   - 성공 기준: HURDLERS 상세페이지 조회 태그와 GA4 이벤트 전송 태그가 Fired.
   - 실패 시: HURDLERS 플러그인 초기화 태그와 상세페이지 DOM 조건을 확인한다.

2. 장바구니 담기
   - 무엇을 본다: `add_to_cart`.
   - 성공 기준: `HURDLERS - [데이터레이어] 장바구니 담기`가 먼저 Fired되고, 이어서 GA4 `add_to_cart`가 Fired.
   - 실패 시: 장바구니 클릭 트리거가 실제 버튼과 맞는지 확인한다.

3. 쿠폰받기
   - 무엇을 본다: 쿠폰 전용 GTM/GA4 태그가 현재 있는지.
   - 성공 기준: 현재는 태그 없음으로 기록한다. Meta Pixel Helper의 `SubscribedButtonClick`은 자동 감지 참고값으로만 본다.
   - 실패 시: 쿠폰을 선행지표로 쓸지 결정한 뒤 `coupon_download` 또는 `coupon_click` 후보로 별도 설계한다.

4. 장바구니 페이지 진입
   - 무엇을 본다: `view_cart`가 현재 있는지.
   - 성공 기준: 있으면 Fired, 없으면 “태그 없음/설계 필요”로 기록한다.
   - 실패 시: 새 태그를 바로 만들지 말고 기존 HURDLERS 장바구니 태그와 중복 위험을 먼저 문서화한다.

5. 주문서 작성/결제 시작
   - 무엇을 본다: `begin_checkout`.
   - 성공 기준: GTM 설정상 존재하는 `AGENTSOS - [GA4 이벤트전송] begin_checkout`이 실제 주문서 화면 또는 정기구독 신청 버튼 클릭 후 Fired.
   - 2026-05-24 확인: 정기구독 상품 `/subscription/?idx=74`에서 옵션 2개 선택 후 `정기구독 신청` 클릭 시 `begin_checkout` Fired, value `18900`, item_id `74`.
   - 실패 시: 현재 BigQuery export 기간 0과 일치하므로 DOM/트리거 조건 문제로 분류한다.

6. 결제수단 선택/NPay 클릭
   - 무엇을 본다: `add_payment_info` 또는 NPay intent.
   - 성공 기준: NPay 클릭이 `purchase`가 아니라 결제수단/의도 이벤트로 분리된다.
   - 실패 시: 현재 `ga4_purchase` dataLayer는 실제 결제완료로 쓰지 않고 재설계 후보로 둔다.

7. 구매완료
   - 무엇을 본다: `purchase`는 실제 완료 URL에서만 발화되는지.
   - 성공 기준: 장바구니/NPay 클릭/주문서 진입에서는 purchase가 Fired되지 않는다.
   - 실패 시: 즉시 publish 금지, 원인만 기록한다.

## 해석 원칙

1. GTM 태그가 있어도 GA4 BigQuery에 0이면, 이름 문제가 아니라 실제 화면에서 트리거가 안 탔거나 dataLayer 조건이 안 맞았을 수 있다.
2. GA4 이벤트가 있어도 실제 주문 정본은 아니다. 구매 매출 판단은 VM Cloud/운영DB/Imweb/Toss 등 결제완료 원장과 분리한다.
3. NPay 클릭/장바구니/결제수단 선택은 구매완료가 아니라 선행지표다.
4. Preview 결과가 필요하면 GTM Preview only로 확인하고, Submit/Create version/Publish는 별도 승인 전 금지한다.
