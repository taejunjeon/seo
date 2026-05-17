# 바이오컴 GTM/GA4 태그·이벤트 인벤토리

작성 시각: 2026-05-17 20:20 KST
기준일: 2026-05-17
문서 성격: 바이오컴 GTM live tag + GA4 BigQuery event inventory

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  lane: Green
  allowed_actions:
    - gtm_api_read_only
    - ga4_bigquery_read_only_aggregate
    - documentation_update
  forbidden_actions:
    - gtm_submit_create_version_publish
    - ga4_measurement_protocol_send
    - platform_send_or_upload
    - operating_db_write
    - vm_cloud_deploy
source_window_freshness_confidence:
  gtm_source: GTM API live container version
  ga4_source: project-dadba7dd-0229-4ff6-81c.analytics_304759974.events_*
  window: 2026-05-07~2026-05-16
  freshness: latest daily table events_20260516
  site: biocom
  confidence: high for configured live tags, high for GA4 event existence, medium for runtime trigger cause until Preview
```

## 10초 요약

- 이 문서는 바이오컴의 **GTM에 게시된 태그**와 **GA4 BigQuery에 실제 적재된 이벤트**를 한 문서에 분리해 정리한다.
- GTM 태그 이름은 관리용 라벨이고, GA4에 실제로 남는 값은 `event_name`이다.
- GA4 이벤트는 현재 BigQuery에 적재된 전체 export 기간(`2026-05-07~2026-05-16`)을 read-only로 집계했다.
- 이 문서 작성 과정에서 GTM Publish, GA4/Meta/Google/TikTok/Naver 전송, 운영DB write는 하지 않았다.

## Source / Window / Freshness

| 항목 | 값 |
| --- | --- |
| site | biocom (biocom.kr) |
| GTM container | GTM-W2Z6PHN / live version 143 (AGENT_OS Path B identity-first canary 20260509T121717Z) |
| GA4 measurement ID | G-WJFXN5E2Q1 |
| GA4 BigQuery source | project-dadba7dd-0229-4ff6-81c.analytics_304759974.events_* |
| GA4 export window | 2026-05-07~2026-05-16 (10 daily tables) |
| GA4 latest table | events_20260516 |
| confidence | GTM live 설정 high / GA4 적재 high / 실제 런타임 원인 medium |

## GTM Live 태그 전체 목록

| tagId | 상태 | type | 태그 이름 | 보내는 곳/이벤트 | 측정/플랫폼 ID | 발화 트리거 | 차단 트리거 | 메모 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | active | html | HOTJAR | Custom HTML | 브라우저 실행 스크립트 | trigger 2147479553 | - | Custom HTML |
| 15 | active | gclidw | AW전환링커 | Conversion Linker | Google Ads click id 보존 | trigger 2147479553 | - | 클릭 ID 보존용 |
| 17 | active | awct | tmp_바이오컴 장바구니 | Google Ads conversion | AW-304339096 | 장바구니 트리거 | - | conversion label 있음 |
| 21 | active | gaawe | tmp_ga4 page_view_long 이벤트 | GA4 event: page_view_long | G-WJFXN5E2Q1 | 긴 조회 시간(page_view_long) | - | value=Y, currency=Y |
| 23 | paused | gaawe | tmp_ga4모든 링크 클릭 | GA4 event: click | G-WJFXN5E2Q1 | 모든 링크 클릭 | - | GA4 event 전송 |
| 26 | active | html | tmp_구글 Ads 동적 리마케팅 잠재고객 | Custom HTML | 브라우저 실행 스크립트 | 제품 상세 페이지 조회 | - | Custom HTML |
| 38 | active | googtag | GA4_픽셀 | Google tag config | G-WJFXN5E2Q1 | trigger 2147479553 | - | 기본 Google/GA4/Ads 태그 |
| 43 | active | gaawe | GA4_구매전환_Npay | GA4 event: add_payment_info | G-WJFXN5E2Q1 | purchase_npay_mo 트리거, purchase_npay_pc 트리거 | - | transaction_id=Y, value=Y, currency=Y, pay_method=Y |
| 48 | paused | gaawe | GA4_구매전환_홈피구매 | GA4 event: purchase | G-WJFXN5E2Q1 | purchase_homepage_트리거 | Exception - vbank blocked (all events) | transaction_id=Y, value=Y, currency=Y, pay_method=Y |
| 49 | active | gaawe | GA4_회원가입 | GA4 event: sign_up | G-WJFXN5E2Q1 | 회원가입 트리거 | - | value=Y, currency=Y |
| 51 | active | gaawe | GA4 장바구니 담기 | GA4 event: add_to_cart | G-WJFXN5E2Q1 | add_to_cart 트리거 | - | value=Y, currency=Y |
| 53 | paused | html | 구조화된 데이터_Q&A | Custom HTML | 브라우저 실행 스크립트 | Q&A 페이지 조회 | - | Custom HTML |
| 55 | active | cvt_13158774_54 | 채널톡_구매전환 | cvt_13158774_54 | - | purchase_homepage_트리거, purchase_npay_mo 트리거, purchase_npay_pc 트리거 | - | custom/template/기타 태그 |
| 57 | active | gaawe | GA4_상담 접수 완료 | GA4 event: conseling_complete | G-WJFXN5E2Q1 | 상담 접수 완료 | - | GA4 event 전송 |
| 63 | active | gaawe | GA4_리뷰 등록 완료 | GA4 event: review_submit | G-WJFXN5E2Q1 | 리뷰 완료 | - | GA4 event 전송 |
| 65 | active | gaawe | GA4_영양제 결제하기(3밸런스+썬파이버) | GA4 event: supplements_payment | G-WJFXN5E2Q1 | 바이오밸런스_결제하기, 썬파이버_결제하기, 클린밸런스_결제하기, 풍성밸런스_결제하기, 바이오밸런스_네이버페이 구매하기, 썬파이버_네이버페이 구매하기, 클린밸런스_네이버페이 구매하기, 풍성밸런스_네이버페이 구매하기 | - | GA4 event 전송 |
| 70 | active | gaawe | G4_주문완료_요소공개 | GA4 event: test | G-WJFXN5E2Q1 | 주문완료_요소공개 | - | GA4 event 전송 |
| 79 | active | gaawe | GA4_상담신청완료 | GA4 event: consult_complete | G-WJFXN5E2Q1 | 상담 신청 접수 완료 | - | GA4 event 전송 |
| 83 | active | gaawe | GA4_3검사 결제하기 | GA4 event: 3test_payment | G-WJFXN5E2Q1 | 영양중금속검사_결제하기, 음식물과민증검사_결제하기, 장내세균검사 결제하기, 음식물알러지검사_네이버페이 결제하기, 장내세균검사_네이버페이 결제하기, 영양 중금속 검사_네이버페이 결제하기 | - | GA4 event 전송 |
| 92 | active | cvt_13158774_54 | 채널톡_영양제 결제하기(3검사+썬파이버) | cvt_13158774_54 | - | 바이오밸런스_네이버페이 구매하기, 썬파이버_결제하기, 클린밸런스_결제하기, 클린밸런스_네이버페이 구매하기, 풍성밸런스_결제하기, 풍성밸런스_네이버페이 구매하기, 바이오밸런스_결제하기, 썬파이버_네이버페이 구매하기 | - | custom/template/기타 태그 |
| 93 | active | cvt_13158774_54 | 채널톡_검사권 구매하기 | cvt_13158774_54 | - | 영양 중금속 검사_네이버페이 결제하기, 영양중금속검사_결제하기, 음식물과민증검사_결제하기, 음식물알러지검사_네이버페이 결제하기, 장내세균검사 결제하기, 장내세균검사_네이버페이 결제하기 | - | custom/template/기타 태그 |
| 94 | active | cvt_13158774_54 | 채널톡_상담신청완료 | cvt_13158774_54 | - | 상담 신청 접수 완료 | - | custom/template/기타 태그 |
| 96 | active | cvt_13158774_54 | 채널톡_초대코드 복사 | cvt_13158774_54 | - | 채널톡_초대코드 복사 | - | custom/template/기타 태그 |
| 97 | active | googtag | [new]Google 태그 | Google tag config | G-8GZ48B1S59 | trigger 2147479573 | - | 기본 Google/GA4/Ads 태그 |
| 98 | paused | gaawe | GA4_구매전환_Npay 2 | GA4 event: purchase | G-8GZ48B1S59 | purchase_npay_mo 트리거, purchase_npay_pc 트리거 | - | value=Y, currency=Y, pay_method=Y |
| 99 | paused | googtag | GA4_픽셀 2 | Google tag config | G-8GZ48B1S59 | trigger 2147479553 | - | 기본 Google/GA4/Ads 태그 |
| 100 | active | gaawe | G4_주문완료_요소공개2 | GA4 event: test | G-8GZ48B1S59 | 주문완료_요소공개 | - | GA4 event 전송 |
| 101 | paused | gaawe | GA4 장바구니 담기2 | GA4 event: add_to_cart | G-8GZ48B1S59 | add_to_cart 트리거 | - | value=Y, currency=Y |
| 103 | active | gaawe | GA4_정기구독 신청 완료 | GA4 event: subscription_completed | G-8GZ48B1S59 | 정기구독 신청완료 | - | GA4 event 전송 |
| 105 | active | gaawe | GA4_정기구독 해지 클릭 | GA4 event: cancel_subscription | G-8GZ48B1S59 | 정기구독 해지 완료 클릭 | - | GA4 event 전송 |
| 110 | active | html | HURDLERS - [데이터레이어] 초기화 | Custom HTML | 브라우저 실행 스크립트 | - | - | dataLayer push 후보 |
| 114 | active | html | HURDLERS - [데이터레이어] 네이버페이 구매 (장바구니) | Custom HTML | 브라우저 실행 스크립트 | HURDLERS - [링크 클릭] 네이버페이 구매 (장바구니) | - | NPay intent/dataLayer 후보. 실제 결제완료 아님 |
| 118 | active | html | HURDLERS - [데이터레이어] 네이버페이 구매 (제품상세) | Custom HTML | 브라우저 실행 스크립트 | HURDLERS - [링크 클릭] 네이버페이 구매 (제품상세) | - | NPay intent/dataLayer 후보. 실제 결제완료 아님 |
| 128 | active | gaawe | HURDLERS - [이벤트전송] 네이버페이 구매 | GA4 event: add_payment_info | {{HURDLERS - GA4 아이디}} | HURDLERS - [맞춤 이벤트] 네이버페이 구매 | - | transaction_id=Y, value=Y, currency=Y, items=Y, shipping=Y |
| 133 | active | html | HURDLERS - [데이터레이어] 상세페이지 조회 | Custom HTML | 브라우저 실행 스크립트 | HURDLERS - [DOM 사용 가능] 상세페이지 조회 | - | dataLayer push 후보 |
| 143 | active | gaawe | HURDLERS - [이벤트전송] 구매 | GA4 event: purchase | {{HURDLERS - GA4 아이디}} | HURDLERS - [맞춤 이벤트] 구매 | Exception - vbank blocked (all events) | transaction_id=Y, value=Y, currency=Y, items=Y, pay_method=Y, shipping=Y |
| 145 | active | html | HURDLERS - [데이터레이어] 장바구니 보기 | Custom HTML | 브라우저 실행 스크립트 | HURDLERS - [DOM 사용가능] 장바구니 보기 | - | dataLayer push 후보 |
| 146 | active | html | HURDLERS - [맞춤 HTML] 허들러스 플러그인 | Custom HTML | 브라우저 실행 스크립트 | trigger 2147479553 | - | Custom HTML |
| 147 | active | gaawe | HURDLERS - [이벤트전송] 장바구니 보기 | GA4 event: view_cart | {{HURDLERS - GA4 아이디}} | HURDLERS - [맞춤 이벤트] 장바구니 보기 | - | value=Y, currency=Y, items=Y |
| 152 | active | html | HURDLERS - [데이터레이어] 주문서작성 | Custom HTML | 브라우저 실행 스크립트 | HURDLERS - [DOM 사용 가능] 주문서작성 | - | dataLayer push 후보 |
| 154 | active | html | HURDLERS - [데이터레이어] 구매 | Custom HTML | 브라우저 실행 스크립트 | HURDLERS - [맞춤 이벤트] hurdlers_purchase | Exception - vbank blocked (all events) | dataLayer push 후보 |
| 156 | active | html | HURDLERS - [데이터레이어] 장바구니 담기 | Custom HTML | 브라우저 실행 스크립트 | HURDLERS - [클릭] 장바구니 담기 | - | dataLayer push 후보 |
| 157 | active | gaawe | HURDLERS - [이벤트전송] 상세페이지 조회 | GA4 event: view_item | {{HURDLERS - GA4 아이디}} | HURDLERS - [맞춤 이벤트] 상세페이지 조회 | - | value=Y, currency=Y, items=Y |
| 158 | active | gaawe | HURDLERS - [이벤트전송] 주문서작성 | GA4 event: begin_checkout | {{HURDLERS - GA4 아이디}} | HURDLERS - [맞춤 이벤트] 주문서작성 | - | value=Y, currency=Y, items=Y |
| 160 | active | gaawe | HURDLERS - [이벤트전송] 장바구니 담기 | GA4 event: add_to_cart | {{HURDLERS - GA4 아이디}} | HURDLERS - [맞춤 이벤트] 장바구니 담기 | - | value=Y, currency=Y, items=Y |
| 162 | active | gaawe | HURDLERS - [이벤트전송] 회원가입 완료 | GA4 event: sign_up | {{HURDLERS - GA4 아이디}} | HURDLERS- [맞춤 이벤트] 회원가입 완료 | - | method=Y |
| 165 | active | html | HURDLERS - [데이터레이어] 회원가입 버튼 클릭 | Custom HTML | 브라우저 실행 스크립트 | HURDLERS - [링크 클릭] 회원가입 버튼 클릭, HURDLERS - [링크 클릭] 회원가입 버튼 클릭(일반) | - | dataLayer push 후보 |
| 167 | active | html | HURDLERS - [데이터레이어] 회원가입 완료 | Custom HTML | 브라우저 실행 스크립트 | HURDLERS- [DOM 사용가능] 회원가입 완료 | - | dataLayer push 후보 |
| 169 | active | googtag | Google 태그 AW-304339096 | Google tag config | AW-304339096 | trigger 2147479573 | - | 기본 Google/GA4/Ads 태그 |
| 171 | active | gaawe | User_id | GA4 event: user_id | G-WJFXN5E2Q1 | trigger 2147479553 | - | GA4 event 전송 |
| 179 | active | gaawe | ga4 장바구니 이벤트 | GA4 event: add_to_cart_view_custom | G-WJFXN5E2Q1 | GA4 이벤트 전송 트리거 - Cart View | - | GA4 event 전송 |
| 200 | paused | awud | UPDE_register | awud | - | 가입하기 버튼 | - | custom/template/기타 태그 |
| 204 | paused | awud | UPDE_purchase | awud | - | 결제하기 버튼 | - | custom/template/기타 태그 |
| 210 | active | awct | 구글애즈 회원가입 | Google Ads conversion | AW-304339096 | 회원가입 트리거 | - | conversion label 있음 |
| 245 | active | cvt_MQDKZ | Microsoft Clarity - Official | cvt_MQDKZ | - | trigger 2147479553 | - | custom/template/기타 태그 |
| 248 | active | awct | TechSol - [GAds]NPAY구매 51163 | Google Ads conversion | AW-304339096 | TechSol - NPAY구매 61620 | - | conversion label 있음 |
| 251 | active | html | biocom - [데이터 준비] hurdlers_ga4 purchase 값 주입 (Claude) | Custom HTML | 브라우저 실행 스크립트 | - | - | Custom HTML |
| 259 | active | html | SEO - TikTok Marketing Intent - v1 | Custom HTML | 브라우저 실행 스크립트 | SEO - TikTok Intent - ttclid, SEO - TikTok Intent - UTM, SEO - TikTok Intent - Referrer | - | Custom HTML |
| 279 | active | html | codex_paid_click_intent_v1_receiver_no_send | Custom HTML | 브라우저 실행 스크립트 | codex_paid_click_intent_v1_all_pages_guarded | - | Custom HTML |
| 299 | active | html | AGENT_OS_path_b_identity_first_hmac_write_canary_20260509T121717Z | Custom HTML | 브라우저 실행 스크립트 | AGENT_OS_path_b_order_complete_only_canary_20260509T121717Z | - | Custom HTML |

## GA4 표준 퍼널 이벤트 빠른 상태

| event_name | events | sessions | latest_event_at_kst | 판단 |
| --- | --- | --- | --- | --- |
| page_view | 129944 | 82207 | 2026-05-16 23:59:59 | 적재 확인 |
| view_item | 21226 | 17837 | 2026-05-16 23:59:00 | 적재 확인 |
| add_to_cart | 1117 | 860 | 2026-05-16 23:32:57 | 적재 확인 |
| view_cart | 37 | 20 | 2026-05-16 20:57:26 | 적재 확인 |
| begin_checkout | 1507 | 1039 | 2026-05-16 23:38:48 | 적재 확인 |
| add_payment_info | 1172 | 639 | 2026-05-16 22:43:46 | 적재 확인 |
| purchase | 609 | 571 | 2026-05-16 23:34:28 | 적재 확인 |
| scroll | 14346 | 10340 | 2026-05-16 23:57:15 | 적재 확인 |
| page_view_long | 8129 | 7544 | 2026-05-16 23:58:26 | 적재 확인 |

## GA4 BigQuery event_name 전체 목록

| event_name | events | users | sessions | cart_page_events | checkout_or_payment_page_events | product_page_events | latest_event_at_kst |
| --- | --- | --- | --- | --- | --- | --- | --- |
| page_view | 129944 | 69593 | 82207 | 1569 | 2894 | 14892 | 2026-05-16 23:59:59 |
| user_id | 115643 | 57823 | 69275 | 1614 | 2877 | 14013 | 2026-05-16 23:59:50 |
| session_start | 84336 | 69305 | 83905 | 84 | 291 | 9637 | 2026-05-16 23:59:59 |
| first_visit | 58772 | 58640 | 58658 | 14 | 118 | 6175 | 2026-05-16 23:59:57 |
| user_engagement | 54198 | 14332 | 17766 | 1679 | 1722 | 7206 | 2026-05-16 23:59:53 |
| view_item | 21226 | 15087 | 17837 | 0 | 24 | 2538 | 2026-05-16 23:59:00 |
| scroll | 14346 | 8869 | 10340 | 186 | 751 | 1205 | 2026-05-16 23:57:15 |
| page_view_long | 8129 | 6625 | 7544 | 47 | 173 | 1089 | 2026-05-16 23:58:26 |
| view_search_results | 2129 | 395 | 518 | 0 | 0 | 0 | 2026-05-16 23:53:25 |
| 결제페이지_진입 | 1818 | 1048 | 1238 | 0 | 1818 | 0 | 2026-05-16 23:39:12 |
| begin_checkout | 1507 | 911 | 1039 | 0 | 1502 | 4 | 2026-05-16 23:38:48 |
| add_payment_info | 1172 | 413 | 639 | 58 | 1 | 224 | 2026-05-16 22:43:46 |
| add_to_cart | 1117 | 616 | 860 | 0 | 4 | 275 | 2026-05-16 23:32:57 |
| sign_up | 628 | 626 | 626 | 0 | 0 | 0 | 2026-05-16 23:52:23 |
| purchase | 609 | 546 | 571 | 0 | 609 | 0 | 2026-05-16 23:34:28 |
| 결제완료 | 127 | 110 | 120 | 0 | 127 | 0 | 2026-05-16 21:40:38 |
| view_cart | 37 | 20 | 20 | 37 | 0 | 0 | 2026-05-16 20:57:26 |
| video_progress | 18 | 4 | 4 | 0 | 0 | 0 | 2026-05-16 19:12:04 |
| 3test_payment | 12 | 8 | 9 | 0 | 12 | 0 | 2026-05-16 15:01:44 |
| review_submit | 9 | 9 | 9 | 0 | 0 | 0 | 2026-05-15 18:53:05 |
| video_start | 7 | 5 | 5 | 0 | 0 | 0 | 2026-05-16 19:10:23 |
| video_complete | 4 | 4 | 4 | 0 | 0 | 0 | 2026-05-16 19:12:32 |
| supplements_payment | 2 | 2 | 2 | 0 | 0 | 1 | 2026-05-11 14:12:28 |



## Preview 전용 체크리스트

Preview는 “수정”이 아니라 **실제 브라우저에서 어떤 태그가 발화되는지 보는 검사 모드**다. 아래 항목은 Publish 없이 확인한다.

### 바이오컴 Preview에서 확인할 흐름

1. 홈/상품 상세 진입
   - 무엇을 본다: `PageView`, `view_item`, `page_view_long` 후보.
   - 성공 기준: Tag Assistant에서 해당 GA4 태그가 Fired로 보이고, Network에는 GA4 collect만 뜬다.
   - 실패 시: Google tag config와 HURDLERS 상세페이지 dataLayer 태그 발화 순서를 확인한다.

2. 장바구니 담기
   - 무엇을 본다: `add_to_cart`, `view_cart`.
   - 성공 기준: HURDLERS 장바구니 dataLayer 태그와 GA4 이벤트 전송 태그가 같은 이벤트 체인에서 Fired.
   - 실패 시: 클릭 셀렉터 또는 장바구니 페이지 URL 트리거가 실제 DOM과 맞는지 확인한다.

3. 결제 시작/결제수단 선택
   - 무엇을 본다: `begin_checkout`, `add_payment_info`.
   - 성공 기준: 결제 페이지 진입과 결제수단 선택이 purchase가 아니라 중간 이벤트로만 보인다.
   - 실패 시: NPay 클릭/카드 선택/가상계좌 선택이 서로 다른 이벤트로 분리되는지 확인한다.

4. 구매완료
   - 무엇을 본다: `purchase`는 실제 결제완료 검증이 있을 때만 확인한다.
   - 성공 기준: 테스트 없는 운영 구매 강제 발화 0, 중복 purchase 0.
   - 실패 시: Header Guard/Server CAPI 쪽과 분리해 본다.

## 해석 원칙

1. GTM 태그가 있어도 GA4 BigQuery에 0이면, 이름 문제가 아니라 실제 화면에서 트리거가 안 탔거나 dataLayer 조건이 안 맞았을 수 있다.
2. GA4 이벤트가 있어도 실제 주문 정본은 아니다. 구매 매출 판단은 VM Cloud/운영DB/Imweb/Toss 등 결제완료 원장과 분리한다.
3. NPay 클릭/장바구니/결제수단 선택은 구매완료가 아니라 선행지표다.
4. Preview 결과가 필요하면 GTM Preview only로 확인하고, Submit/Create version/Publish는 별도 승인 전 금지한다.
