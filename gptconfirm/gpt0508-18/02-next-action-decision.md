# Path B next action decision

작성 시각: 2026-05-10 00:11 KST

## 결론

다음은 identity-only canary 연장이 아니라 `TEST click id same-browser preservation`입니다. 이유는 order/email/session 저장은 이미 PASS했고, 남은 병목은 click source가 실제 사용자 흐름에서 주문완료까지 보존되는지이기 때문입니다.

## 분기 판정

### A. paid_click_intent와 session join 가능

현재 결과: NO.

다음 액션:

- 현재 row 2건을 Google Ads 후보로 쓰지 않습니다.
- post-join reliability는 exact session match가 생길 때 다시 실행합니다.

### B. storage key mismatch

현재 결과: NOT PROVEN.

다음 액션:

- Path B tag와 paid_click_intent tag의 `bi_paid_click_intent_v1` key는 유지합니다.
- tag patch는 storage key rename이 아니라 preservation 확인 중심으로 설계합니다.

### C. checkout/order_complete에서 storage 유실

현재 결과: UNVERIFIED.

다음 액션:

- same-browser preservation Preview를 진행합니다.
- 상품상세 TEST gclid 진입부터 주문완료까지 같은 browser에서 확인합니다.

### D. 실제 paid-click-originated controlled order test

현재 결과: HOLD.

다음 액션:

- TEST click preservation이 PASS한 뒤 별도 승인안으로 올립니다.
- 실제 광고 클릭과 실제 결제는 비용/플랫폼 영향 때문에 지금 진행하지 않습니다.

### E. 후보 과다/ambiguous

현재 결과: YES for time-window-only.

다음 액션:

- time-window-only matching은 금지합니다.
- confidence A/B에는 exact click/session evidence가 있어야 합니다.

## 권장 순서

1. Green: same-browser preservation runbook 작성.
2. Green 또는 Yellow-lite: GTM Preview/no-send controlled flow 실행.
3. HOLD: 실제 광고 클릭/실제 결제 test 승인안.
4. HOLD: Google Ads confirmed_purchase upload.

## 성공 기준

same-browser preservation이 성공하려면 다음이 모두 필요합니다.

- 상품상세 단계에서 TEST click id capture 확인.
- `bi_paid_click_intent_v1` storage 생성 확인.
- checkout/order complete까지 같은 browser storage 유지.
- 주문완료 Path B response에서 `click_id_hash_present=true`.
- `would_send=false`.
- `platform_send_count=0`.
- raw email/phone/member_code/order/payment 저장 0.

## 실패 시 해석

- 상품상세에서 storage가 없으면 paid_click_intent capture 문제입니다.
- checkout에서 storage가 사라지면 browser/context preservation 문제입니다.
- 주문완료에서 storage는 있는데 response가 false면 Path B extraction 문제입니다.
- platform request가 생기면 즉시 중단하고 tag scope 문제로 분류합니다.

## 현재 금지선

- GTM Production publish 금지.
- 실제 광고 클릭/실제 결제 테스트 금지.
- Google Ads/GA4/Meta/TikTok/Naver 전송 금지.
- Google Ads conversion upload 금지.
- `send_candidate=true` 금지.
