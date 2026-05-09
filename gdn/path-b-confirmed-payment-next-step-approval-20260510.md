# Path B confirmed payment next-step approval

작성 시각: 2026-05-10 01:37 KST
Status: HOLD_APPROVAL_PACKET

## 한 줄 결론

실제 광고 클릭에서 주문완료 화면까지의 Path B no-send bridge는 PASS다. 하지만 이번 주문은 가상계좌 입금 전이므로 실제 결제완료 구매가 아니다. confirmed purchase까지 검증하려면 별도 paid confirmation test 승인 또는 입금/취소 상태 확인이 필요하다.

## 지금 확인된 것

- 실제 Google 광고 클릭에서 시작했다.
- 바이오컴 주문완료 화면까지 같은 브라우저로 도달했다.
- Path B no-send 응답에서 order/email/session/click hash가 모두 present였다.
- Path B platform send는 0이었다.
- VM Cloud write flag는 OFF였다.
- raw 저장은 0이었다.

## 아직 확인되지 않은 것

- 가상계좌 입금 완료 후 주문 상태 변화.
- PG/Imweb 기준 실제 결제완료 row와 Path B row 연결.
- Google Ads confirmed_purchase upload 후보 품질.

## 선택지

### A. 여기서 멈추고 unpaid test order로 제외

- 추천/자신감: 88%
- 무엇을 하는가: 이번 가상계좌 주문은 입금하지 않고 test_order로 제외한다.
- 왜 하는가: Path B click bridge는 이미 확인됐고, 추가 결제 비용/운영 영향을 피한다.
- 성공 기준: test_order가 upload/ROAS 후보에 포함되지 않는다.
- 승인 필요 여부: NO, 입금하지 않고 제외 기록만 유지하면 된다.

### B. 별도 confirmed payment test 1건

- 추천/자신감: 64%
- 무엇을 하는가: 실제 결제완료까지 1건을 만든다. 카드 결제 또는 가상계좌 입금 중 하나를 선택한다.
- 왜 하는가: Google Ads confirmed_purchase까지 가기 전 실제 결제완료 상태의 bridge를 확인한다.
- 성공 기준: 결제완료 상태가 확인되고, Path B no-send bridge와 test_order exclusion guard가 동시에 PASS한다.
- 승인 필요 여부: YES, 실제 결제/비용/취소 또는 환불 영향이 있다.

## B를 승인할 때의 금지선

- Google Ads conversion upload 금지.
- GA4/Meta/Google Ads/TikTok/Naver 신규 전송 금지.
- send_candidate=true 금지.
- raw email/phone/member_code/order/payment 저장 또는 logging 금지.
- NPay click/count를 purchase로 승격 금지.

## test_order exclusion

confirmed payment test를 하더라도 아래는 유지한다.

- test_order=true
- exclude_from_upload=true
- exclude_from_budget_roas=true
- send_candidate=false
- actual_send_candidate=false
- block_reason=controlled_real_paid_click_payment_test

## 추천

지금은 A를 추천한다. Path B의 가장 큰 병목이었던 실제 광고 click bridge는 PASS했으므로, 추가 결제 테스트는 Google Ads upload 직전 별도 승인 단계로 남기는 편이 더 안전하다.
