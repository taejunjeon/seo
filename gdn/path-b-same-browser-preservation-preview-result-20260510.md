# Path B same-browser preservation Preview result

작성 시각: 2026-05-10 00:56 KST

## 한 줄 결론

상품상세에서 TEST gclid storage 생성은 PASS했다. 주문완료 URL은 headless 자동화 세션에서 홈페이지로 redirect되어 Path B receiver가 호출되지 않았으므로, click bridge 최종 판정은 HOLD다.

## 실행 정보

- run id: `20260509T155435Z`
- workspace id: `167`
- tag id: `301`
- trigger id: `300`
- result JSON: `data/path-b-same-browser-preservation-preview-result-20260510.json`
- raw detailed JSON: `data/path-b-gtm-preview-controlled-traffic-result-20260509T155435Z.json`

## 확인된 것

- 상품상세 storage key present: PASS
- 상품상세 click id present: PASS
- 상품상세 `gclid` present: PASS
- 상품상세 local session present: PASS
- raw stored delta: PASS, `0`
- platform send delta: PASS, `0`
- GTM submit/create_version/publish: PASS, `0`

## HOLD인 것

- 주문완료 page remained on `shop_payment_complete`: HOLD
- Path B tag installed on order-complete page: HOLD
- receiver reached: HOLD
- `click_id_hash_present`: HOLD
- `order_no_hash_present`: HOLD
- `client_session_present`: HOLD

## 원인 축소

상품상세 단계 storage는 만들어졌으므로 `paid_click_intent_capture_missing`은 현재 주원인이 아니다.

자동화 결과의 page state는 `href=https://biocom.kr/`였다. 이는 headless 브라우저가 TJ님 로그인/주문 세션을 갖고 있지 않아 주문완료 URL에서 홈페이지로 redirect됐을 가능성이 높다. 따라서 다음 확인점은 Path B extraction 코드가 아니라 로그인된 실제 브라우저에서 같은 흐름을 다시 보는 것이다.

## HOLD Reducer follow-up

- storage key mismatch audit: 완료. primary key는 `bi_paid_click_intent_v1`로 일치한다.
- product-stage capture audit: 완료. TEST gclid storage 생성 PASS.
- order-complete access audit: HOLD. headless 브라우저가 주문완료 URL을 유지하지 못했다.
- next Green/Yellow-lite: TJ님 로그인 Tag Assistant 세션에서 workspace 167 Preview를 열고 같은 flow를 수동 실행한다.

## 다음 판단

same-browser preservation은 아직 PASS가 아니다. 하지만 병목은 `click id capture`가 아니라 `주문완료 페이지 접근 세션/redirect`로 좁혀졌다. 실제 로그인 브라우저에서 같은 flow를 한 번 더 보면 click bridge 원인 분류를 닫을 수 있다.

