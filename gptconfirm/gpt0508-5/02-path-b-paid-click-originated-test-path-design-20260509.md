# Path B paid-click-originated 테스트 경로 설계

작성 시각: 2026-05-09 01:01 KST
대상: biocom Path B 주문-클릭 연결 테스트
상태: design_ready
Lane: Green design
Mode: no-send / no-write / no-platform-send / no-publish

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
    - harness/npay-recovery/APPROVAL_GATES.md
    - harness/npay-recovery/AUDITOR_CHECKLIST.md
  lane: Green test design
  allowed_actions:
    - test path design
    - no-send Preview criteria
    - read-only VM ledger interpretation
    - approval boundary definition
  forbidden_actions:
    - real ad click generation without approval
    - Google Ads campaign/ad/budget change
    - GTM Production publish
    - Imweb production save
    - operational DB write
    - operational order_bridge storage canary
    - Google Ads/GA4/Meta/TikTok/Naver send
    - actual paid conversion upload
  source_window_freshness_confidence:
    source: "actual vbank Preview payload + VM paid_click_intent_ledger read-only join"
    window: "2026-05-09 00:35-01:01 KST"
    freshness: "2026-05-09 01:01 KST"
    confidence: 0.9
```

## 10초 결론

이번 가상계좌 주문은 paid click에서 시작한 세션이 아니었다.
그래서 `click_id_hash_present=false`였고, VM `paid_click_intent_ledger`에서도 같은 client/session 후보가 0건이었다.

다음 테스트는 결제수단을 바꾸는 것이 아니라, 먼저 "광고 클릭 흔적이 주문완료 화면까지 살아오는 경로"를 확인해야 한다.

## 현재 확인된 사실

실제 가상계좌 미입금 Preview:

- `order_no_hash_present=true`
- `client_session_present=true`
- `click_id_hash_present=false`
- `email_hash_present=false`
- `phone_hash_present=false`
- `would_store=false`
- `would_send=false`
- `platform_send_count=0`

VM live paid_click_intent read-only:

- total rows: 1,044.
- unique click hash: 633.
- unique client id: 449.
- unique GA session id: 586.
- 이번 Preview 주문 client/session 후보 match: 0.

해석:

- Path B no-send receiver와 주문완료 firing은 정상이다.
- 이번 테스트 주문은 광고 클릭 원장과 연결되지 않는다.
- 카드/NPay 결제를 추가로 해도 paid-click-origin이 아니면 같은 문제가 반복될 수 있다.

## 테스트 목표

1. 주문완료 화면에서 `click_id_hash_present=true`가 가능한지 확인한다.
2. paid_click_intent 원장에 먼저 잡힌 session이 주문완료 화면의 client/session과 이어지는지 확인한다.
3. 실제 결제 완료 전송이나 Google Ads upload 없이, bridge 품질만 본다.

## 단계별 테스트 경로

### Stage 0 - 완료된 기준선

가상계좌 미입금 주문 생성 테스트.

결과:

- order/session hash present.
- click/email/phone hash absent.
- VM paid_click_intent join 0.

판정:

- baseline으로 보관.
- 추가 결제수단 테스트 전에 source 보강 필요.

### Stage 1 - Synthetic click id Preview

목표:

주문완료 화면에서 click id를 읽으면 `click_id_hash_present=true`가 되는지 확인한다.

방법:

- GTM Preview only.
- 주문완료 URL 또는 synthetic page에 `gclid=TEST_GCLID_PATHB_PREVIEW_...`를 붙인다.
- Path B no-send endpoint만 호출한다.
- live paid_click_intent ledger write는 기대하지 않는다.

성공 기준:

- `click_id_hash_present=true`
- `order_no_hash_present=true`
- `client_session_present=true`
- `would_store=false`
- `would_send=false`
- platform send 0.

한계:

- 실제 광고 클릭 원장과 row-level match를 증명하지는 않는다.
- tag 기능 확인용이다.

Lane:

- Green/Yellow Preview 범위.
- Production publish 없음.

### Stage 2 - Same-browser click preservation Preview

목표:

상품상세에서 click id가 들어온 뒤 checkout/order complete까지 보존되는지 확인한다.

방법:

1. GTM Preview workspace를 유지한다.
2. 상품상세 URL에 `gclid=TEST_GCLID_PATHB_FLOW_YYYYMMDD`를 붙여 진입한다.
3. 상품상세에서 paid_click_intent no-send tag가 어떤 storage key에 click id를 남기는지 확인한다.
4. 주문완료 Preview tag가 같은 click id를 읽는지 확인한다.
5. 실제 platform send는 하지 않는다.

성공 기준:

- 상품상세 단계: click id capture 확인.
- 주문완료 단계: `click_id_hash_present=true`.
- raw click id response/log/storage 금지 기준 충족.
- `would_store=false`, `would_send=false`.

주의:

- TEST click id는 운영 paid_click_intent ledger에 live row로 저장하지 않는 것이 원칙이다.
- live ledger row-level reliability는 이 단계에서 판단하지 않는다.

Lane:

- GTM Preview only는 이미 승인된 Yellow 범위 안.
- 실제 결제는 별도 승인 필요.

### Stage 3 - Real paid-click-originated controlled test

목표:

진짜 paid_click_intent ledger에 잡힌 광고 클릭 세션이 주문완료까지 이어지는지 확인한다.

주의:

이 단계는 Green이 아니다.
실제 광고 클릭, 실제 결제, 실제 주문이 섞일 수 있으므로 별도 승인 없이는 진행하지 않는다.

허용 가능 조건 후보:

- 테스트 목적과 비용 상한이 명시됨.
- 결제수단, 환불/취소 절차, 주문 라벨이 명시됨.
- max test order count: 1건.
- no platform conversion send.
- Google Ads conversion upload 금지.
- GTM Production publish 금지.
- 기존 purchase 태그 guard 영향 기록.

성공 기준:

- paid_click_intent ledger에 동일 client/session 또는 click id 후보가 존재.
- 주문완료 Path B result에 `order_no_hash_present=true`.
- 가능하면 `click_id_hash_present=true`.
- ambiguous 후보가 1개 이하.
- `send_candidate=false`.

Lane:

- 실제 광고 클릭이나 실제 결제 테스트가 들어가면 Yellow/Red 승인 필요.
- Google Ads conversion upload는 계속 Red 금지.

## 권장 순서

1. 먼저 HURDLERS email-like `user_id` HMAC-only Preview를 승인 검토한다.
2. 그 다음 Synthetic click id Preview로 `click_id_hash_present=true` 동작을 확인한다.
3. 그 다음 Same-browser preservation Preview를 한다.
4. 마지막으로 real paid-click-originated controlled test를 별도 승인 후보로 올린다.

이유:

- 현재 문제는 결제수단이 아니라 bridge source 부족이다.
- 카드/NPay 결제만 추가하면 같은 `click_id_hash_present=false`가 반복될 가능성이 높다.
- identity hash와 click preservation을 먼저 닫아야 실제 결제 테스트 비용을 줄일 수 있다.

## 금지선

계속 금지:

- Google Ads campaign/ad/budget 변경.
- 실제 Google Ads conversion upload.
- GA4/Meta/TikTok/Naver send.
- GTM Production publish.
- Imweb production save.
- 운영 저장 canary.
- raw email/phone/order/member_code 저장.
- 기존 GTM tag pause/delete.

## 다음 산출물 후보

- `gdn/path-b-hurdlers-user-id-hmac-source-approval-20260509.md`
- `gdn/path-b-click-id-preservation-preview-plan-20260509.md`
- `gdn/path-b-real-paid-click-controlled-test-approval-20260509.md`

Auditor verdict: DESIGN_READY_PAID_CLICK_ORIGINATED_TEST_PATH
Confidence: 90%
