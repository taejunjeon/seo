# Path B real paid-click actual order test approval

작성 시각: 2026-05-10 01:18 KST
Status: APPROVAL_PACKET_DRAFT

## 한 줄 결론

이 문서는 실제 Google 광고 클릭에서 시작해 실제 주문완료까지 가는 1건 controlled test를 할지 판단하기 위한 승인안이다. TEST gclid로 기술 bridge는 확인됐지만, 실제 Google Ads attribution chain은 실제 광고 클릭에서만 검증할 수 있다.

## TJ님이 실제로 승인하면 하게 되는 행동

1. Google 검색/광고 화면에서 biocom 광고를 실제로 클릭한다.
2. 같은 브라우저에서 상품상세 또는 랜딩 페이지를 유지한다.
3. 최소 금액 또는 TJ님이 선택한 상품으로 주문완료까지 진행한다.
4. 결제 후 즉시 test order로 표시하고 내부 upload/ROAS 판단에서 제외한다.
5. Google Ads/GA4/Meta/TikTok/Naver 신규 전송과 Google Ads conversion upload는 하지 않는다.

## 왜 필요한가

TEST gclid는 브라우저 저장과 Path B extraction이 되는지 보는 기술 테스트다. 실제 Google 광고 클릭은 Google Ads가 발급한 click id, redirect, cookie/session 조건을 포함한다. Google Ads confirmed_purchase 통로를 열지 판단하려면 실제 광고 클릭에서 출발한 주문 1건의 no-send evidence가 필요하다.

## 승인 범위

- site: biocom
- test count: 1건
- click source: 실제 Google 광고 클릭 1회
- order type: TJ님 controlled actual order 1건
- storage: hash-only / no raw
- send_candidate: false
- actual_send_candidate: false
- Google Ads upload: 금지
- platform 신규 전송: 금지

## 테스트 캠페인/광고/랜딩 URL

승인 전 확정 필요:

- Google Ads 계정/캠페인:
- 광고 또는 검색어:
- 예상 랜딩 URL:
- 테스트 상품:
- 예상 결제 금액:
- 결제수단:
- 환불/취소 담당:

권장:

- 기존 캠페인에 영향을 최소화할 수 있는 검색어/광고를 선택한다.
- 테스트 전후 30분 window를 분리해 클릭/주문 원장 조회가 쉽게 만든다.
- 테스트 주문은 주문번호를 별도 보안 문서나 로컬 임시 메모에만 보관하고, repo 문서에는 raw order number를 남기지 않는다.

## 예상 비용

- 광고 클릭 비용: 실제 Google Ads CPC 1회.
- 결제 금액: 테스트 상품 금액 1건.
- 환불/취소: 결제수단별 정책에 따라 처리.

## test_order 식별 규칙

- `test_order=true`
- `exclude_from_upload=true`
- `exclude_from_budget_roas=true`
- `block_reason=controlled_real_paid_click_test`
- `send_candidate=false`
- `actual_send_candidate=false`

## 확인 기준

### paid_click_intent row

- 실제 Google click id hash present.
- capture stage landing 또는 checkout_start present.
- raw click id 저장 없음.
- platform send 0.

### order bridge row

- order_no_hash present.
- email_hash 또는 phone_hash present.
- client/session present.
- click_id_hash present 또는 paid_click_intent exact join 가능.
- row_status: `full_bridge` 또는 별도 controlled test status.
- raw email/phone/order/payment 저장 없음.

### live purchase tag 영향 분리

- 기존 GA4/Google Ads/Channel/Hurdlers purchase tag가 발화할 수 있다.
- 이것은 기존 live site 동작이며 Path B 신규 전송이 아니다.
- test order는 내부 confirmed/upload 후보에서 제외해야 한다.
- 기존 live purchase tag 발화 여부와 Path B row 여부를 별도 표로 기록한다.

## Hard Fail

- raw email/phone/member_code/order/payment가 VM Cloud row나 로그에 남음.
- Google Ads confirmed_purchase upload 발생.
- `send_candidate=true` 발생.
- Path B가 GA4/Meta/Google Ads/TikTok/Naver로 신규 전송.
- test order가 내부 confirmed ROAS 또는 upload 후보에 포함.
- NPay click/count를 purchase로 승격.

## Success Criteria

- 실제 광고 클릭에서 시작한 주문 1건의 no-send evidence 확보.
- order/identity/session/click bridge 상태가 PASS/HOLD로 분류됨.
- test_order guard로 upload/ROAS 제외 확인.
- platform 신규 전송 0.
- raw 저장/logging 0.

## Rollback / cleanup

- VM Cloud write flag OFF 확인.
- GTM Preview workspace cleanup 또는 보존 사유 기록.
- test order refund/cancel 상태 기록.
- 내부 upload 후보/ROAS 후보 제외 상태 확인.
- gptconfirm batch에 결과 보고.

## 아직 승인하면 안 되는 것

- Google Ads confirmed_purchase upload.
- send_candidate=true.
- GTM Production publish.
- 장기 운영 저장 확장.
- 기존 Google Ads conversion action 변경.

## 승인 문구 초안

```text
YES: Path B real paid-click-originated actual order test 1건을 승인합니다.

범위:
- 실제 Google 광고 클릭 1회
- biocom 실제 주문완료 1건
- hash-only/no-send 관측
- test_order로 upload/ROAS 제외

금지:
- Google Ads/GA4/Meta/TikTok/Naver 신규 전송
- Google Ads conversion upload
- send_candidate=true
- raw email/phone/member_code/order/payment 저장 또는 logging
- NPay click/count를 purchase로 승격
```

