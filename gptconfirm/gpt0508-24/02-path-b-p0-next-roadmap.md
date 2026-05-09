# Path B 내일 P0 로드맵

작성 시각: 2026-05-10 01:52 KST
Status: NEXT_P0_GREEN_ROADMAP

## 한 줄 결론

Path B는 실제 Google 광고 클릭에서 주문완료 화면까지 no-send bridge가 PASS했다. 내일 P0는 추가 결제가 아니라 `confirmed 상태 guard`와 `upload 후보 차단`을 builder/dry-run에 연결하는 것이다.

## 오늘 종료 상태

- 실제 Google 광고 클릭 기반 bridge: PASS
- order hash: PASS
- email identity hash: PASS
- client/session: PASS
- click hash: PASS
- 가상계좌 입금: 하지 않음
- confirmed paid purchase: NO
- Google Ads upload: 0
- `send_candidate`: false
- Path B platform send: 0
- VM Cloud write flag: OFF

## 내일 P0

### P0-1. unpaid/confirmed status guard를 builder에 연결

- 무엇: `payment_status != confirmed`, `payment_method=vbank`, `paid_at missing` 조합을 upload 후보에서 명시 차단한다.
- 왜: 주문완료 화면 evidence와 실제 결제완료 매출을 섞지 않기 위해서다.
- 산출물: builder block reason 설계/패치, fixture.
- 성공 기준: unpaid vbank evidence는 upload 후보 0으로 유지된다.

### P0-2. Path B evidence를 ConfirmedPurchasePrep no-send input에 반영

- 무엇: Path B real click evidence를 no-send reliability input으로만 반영한다.
- 왜: bridge 품질 판단에는 쓰되 confirmed purchase 후보로 오해하지 않게 하기 위해서다.
- 산출물: reliability v2 input 또는 ConfirmedPurchasePrep dry-run 보조 input.
- 성공 기준: confidence에는 남고 `send_candidate=false`다.

### P0-3. 실제 결제완료 테스트 필요성 재평가

- 무엇: 카드 결제 또는 가상계좌 입금 테스트가 정말 필요한지 결정한다.
- 왜: 비용/정산/취소 영향이 있으므로 upload 직전까지 미뤄도 된다.
- 추천: 오늘은 진행하지 않는다.
- 성공 기준: test_order exclusion guard가 먼저 닫힌다.

### P0-4. Google Ads upload HOLD 유지

- 무엇: upload candidate를 계속 0으로 유지한다.
- 왜: 실제 결제완료 후보와 중복/차단/guard가 닫히기 전에는 전송하면 안 된다.
- 성공 기준: `Google Ads upload candidate=0`, `send_candidate=false`, `actual_send_candidate=false`.

### P0-5. Google ROAS gap decomposition에 Path B 결과 반영

- 무엇: Google Ads 플랫폼 주장값과 내부 confirmed ROAS 차이를 설명할 때 Path B bridge PASS를 별도 근거로 넣는다.
- 왜: click bridge는 해결되고 있지만 결제완료 후보 전송은 아직 HOLD라는 상태를 명확히 하기 위해서다.
- 성공 기준: 플랫폼 값과 내부 confirmed 값이 계속 분리된다.

## 금지선

- 실제 가상계좌 입금.
- 카드 결제 confirmed payment test.
- Google Ads confirmed_purchase upload.
- `send_candidate=true`.
- `actual_send_candidate=true`.
- GA4/Meta/Google Ads/TikTok/Naver 신규 전송.
- raw email/phone/member_code/order/payment 저장 또는 logging.
- NPay click/count를 purchase로 승격.
