# Path B reliability v2 업데이트 — 실제 광고 클릭 evidence 반영

작성 시각: 2026-05-10 01:36 KST

## 한 줄 결론

실제 Google 광고 클릭 기반 주문완료 evidence를 reliability v2에 반영했다. Path B는 real ad click preview 기준 `full bridge`가 확인됐지만, 가상계좌 미입금 주문이므로 confirmed paid purchase와 Google Ads upload readiness는 계속 NO다.

## 이번에 추가된 evidence

### A_REAL_AD_CLICK_PREVIEW_UNPAID_ORDER

- 실제 Google 광고 클릭: PASS
- 같은 브라우저 주문완료 화면 도달: PASS
- order hash: PASS
- email identity hash: PASS
- client/session: PASS
- click hash: PASS
- no-send: PASS
- platform send 0: PASS
- raw echo 0: PASS
- 결제완료 구매: NO, 가상계좌 미입금
- upload 후보: 0

## reliability v2 confidence

- A_REAL_AD_CLICK_PREVIEW_UNPAID_ORDER: 1
- A_CONTROLLED: 1
- B_IDENTITY_ONLY_HOLD: 1
- C: 0
- D: 0

## 왜 upload 후보가 아닌가

이번 주문은 주문완료 화면까지 갔지만 가상계좌 입금은 하지 않았다. 따라서 `결제 완료`가 아니라 `결제 대기` 상태로 봐야 한다. Google Ads에 실제 결제완료 구매로 알려주는 후보가 되면 안 된다.

## Scorecard

- order_bridge_key_present: PASS
- identity_bridge_key_present: PASS
- click_bridge_key_present: PASS_REAL_AD_CLICK_PREVIEW
- same_browser_preservation: PASS_REAL_AD_CLICK_PREVIEW
- real_checkout_path_verified: PASS
- confirmed_paid_purchase_ready: NO_UNPAID_VIRTUAL_ACCOUNT
- google_ads_upload_ready: NO
- send_candidate: PASS_FALSE
- actual_send_candidate: PASS_FALSE
- raw_stored_zero: PASS
- platform_send_zero: PASS

## 다음 판단

Path B의 기술 연결은 거의 닫혔다. 이제 남은 판단은 `실제 결제완료까지 1건 더 볼 것인지`와 `test_order를 어떤 기준으로 영구 제외할 것인지`다. 두 판단 모두 Google Ads upload와는 별도다.
