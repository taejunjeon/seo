# Biocom Meta Purchase test-only smoke approval - 2026-05-15

작성 시각: 2026-05-15 00:10 KST

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
    - docs/report/text-report-template.md
  project_harness_read:
    - gdn/biocom-fbe-browser-server-event-health-20260514.md
    - gdn/biocom-purchase-only-drop-and-backfill-reconciliation-20260514.md
    - data/project/biocom-purchase-only-drop-and-backfill-reconciliation-20260514.json
    - capivm/meta-funnel-capi-test-events-approval-20260510.md
    - capivm/meta-funnel-capi-test-events-runbook-20260510.md
  lane: Yellow controlled smoke approval, Red stop for any non-test Meta Purchase send
  allowed_actions:
    - Meta Events Manager Test Events code based server Purchase test, max 1 event
    - optional browser/server dedup smoke only if browser event is confirmed test-only
    - VM Cloud read-only precheck and postcheck
    - Meta Graph/API read-only before and after smoke
    - result report and guard audit
  forbidden_actions:
    - Meta Purchase send without test_event_code
    - more than 1 server Purchase test event
    - browser Purchase fire if production count impact is not ruled out
    - real order/payment based test purchase
    - Meta campaign/ad set/budget/conversion setting mutate
    - Google Ads/GA4/TikTok/Naver send or upload
    - 운영DB write/import
    - VM Cloud schema migration
    - GTM publish
    - Imweb header/footer save
    - raw order/payment/click/member/email/phone output
  source_window_freshness_confidence:
    source: "Meta Events Manager screenshot/CSV + Meta Graph read-only + VM Cloud meta-capi-sends.jsonl + VM Cloud attribution_ledger + 운영DB dashboard.public.tb_iamweb_users read-only"
    window: "2026-05-14 KST, focus >= 13:00 KST"
    freshness: "2026-05-15 00:10 KST"
    confidence: 0.86
```

## 10초 요약

목적은 실제 구매 수를 늘리는 것이 아니라, Meta가 `Purchase` 테스트 이벤트를 받는 경로와 `event_id` 중복 제거 기준을 확인하는 것이다.

2026-05-14 기준 바이오컴 Pixel `1283400029487161`은 `PageView`, `ViewContent`, `AddToCart`, `InitiateCheckout`는 받고 있지만, `Purchase`는 02:00 KST 이후 끊겼다. 서버 CAPI는 10건 backfill을 `events_received=10`으로 받아냈지만 Meta UI의 운영 Purchase에는 아직 보이지 않았다. 따라서 전체 Pixel을 직접 삽입하지 말고, Test Events에서 Purchase만 1건 이하로 확인한다.

## 무엇을 승인하는가

TJ님이 Meta Events Manager에서 `test_event_code`를 발급하면, Codex가 아래 범위 안에서만 smoke를 실행한다.

1. 기본 실행: 서버 CAPI `Purchase` 테스트 이벤트 1건 이하를 Meta Test Events로 전송한다.
2. 조건부 실행: 브라우저 `Purchase`가 운영 집계에 영향을 주지 않는 test-only 방식임이 확인될 때만, 같은 `eventID/event_id`로 browser/server dedup smoke를 1회 이하 실행한다.
3. 브라우저 test-only 보장이 안 되면 browser Purchase는 실행하지 않고 `SERVER_ONLY_TEST_PASS` 또는 `BROWSER_TEST_BLOCKED`로 보고한다.

## 왜 필요한가

지금 문제는 Meta 전체 연결 장애가 아니다. 구매 전 이벤트는 들어오지만 `Purchase`만 끊겼다.

이 smoke는 세 가지를 분리한다.

1. Meta Test Events가 서버 CAPI `Purchase`를 즉시 보여주는지.
2. 운영 집계에 잡히지 않는 테스트 전송 경로가 맞는지.
3. browser/server를 같은 `event_id`로 묶을 수 있는지.

이 확인 없이 아임웹 footer에 직접 Pixel `Purchase`를 추가하면, 기존 FBE/browser Pixel과 중복되어 Meta 구매 수가 2배로 잡힐 수 있다.

## 현재 근거

- 외부 API: Meta Events Manager/Graph 기준 2026-05-14 `Purchase`는 총 5건이고, 13:00 KST 이후 0건이다.
- 외부 API: Meta UI CSV 기준 2026-05-14 00시 3건, 01시 2건이고 browser received count는 0이다.
- VM Cloud: `meta-capi-sends.jsonl` 기준 2026-05-14 서버 CAPI `Purchase`는 30건 성공했고, 13:00 KST 이후 수동 backfill 10건도 `events_received=10`이다.
- VM Cloud: `attribution_ledger` 기준 13:00 KST 이후 `payment_success` confirmed 20건, pending 62건이다.
- 운영DB: `dashboard.public.tb_iamweb_users` read-only 기준 13:00 KST 이후 `PAYMENT_COMPLETE`는 21건이다.
- 판정: server dispatcher 장애보다는 browser Purchase 누락 + confirmed bridge/gate 문제 + Meta UI 표시/필터 불일치가 유력하다.

## 허용 범위

- Pixel/Dataset: `1283400029487161`만 사용한다.
- 이벤트 이름: `Purchase`만 사용한다.
- 전송 방식: `test_event_code`가 포함된 Meta Test Events 전송만 허용한다.
- 최대 전송량: 서버 CAPI test Purchase 1건 이하.
- browser/server dedup: test-only가 보장될 때만 browser 1건 + server 1건 이하.
- `value`: 실제 주문 금액이 아니라 테스트 값만 사용한다. 권장값은 `1 KRW`다.
- `event_id`: 테스트 전용 안정 키를 사용한다. 예: `biocom_purchase_test_only_20260515_<short_nonce>`.
- `event_source_url`: 실제 주문 완료 URL이 아니라 테스트 식별 URL을 사용한다. 예: `https://biocom.kr/__meta-test-only-purchase-smoke`.
- user_data: `_fbp`, `_fbc`, user agent, client IP처럼 기존 dispatcher가 이미 쓰는 최소 매칭 정보만 허용한다.
- 결과 문서와 JSON summary 작성.

## 금지 범위

- `test_event_code` 없는 Meta CAPI `Purchase` 전송.
- 실제 주문번호, 결제키, click id, member id, 이메일, 전화번호를 payload나 문서에 출력.
- 실제 결제 테스트.
- 운영DB write/import.
- VM Cloud schema migration.
- GTM Production publish.
- Imweb header/footer 변경 또는 저장.
- Meta campaign/ad set/budget/conversion action 변경.
- Google Ads/GA4/TikTok/Naver send/upload.
- 10건 backfill correction send.
- 브라우저 `Purchase`를 test-only 보장 없이 운영 사이트에서 직접 발화.

## 실행 순서

### 1. TJ님 준비

1. Meta Events Manager를 연다.
2. Pixel/Dataset `1283400029487161`을 선택한다.
3. `이벤트 테스트` 탭으로 이동한다.
4. `test_event_code`를 발급한다.
5. 코드는 문서에 저장하지 않는다. 실행 세션에서만 일시적으로 사용한다.

### 2. Codex precheck

1. Meta Graph/API read-only로 현재 운영 `Purchase` count를 저장한다.
2. VM Cloud `meta-capi-sends.jsonl` read-only로 마지막 send 시각과 중복 event_id 여부를 확인한다.
3. VM Cloud backend route가 test code를 production send와 분리할 수 있는지 payload preview를 확인한다.
4. raw identifier가 payload preview와 결과 문서에 나오지 않는지 확인한다.

### 3. 기본 smoke

1. `test_event_code`가 있는 서버 CAPI `Purchase` test event 1건만 보낸다.
2. Meta Events Manager `이벤트 테스트` 탭에 server `Purchase`가 보이는지 확인한다.
3. 운영 `Purchase` count가 증가하지 않는지 Meta Graph/API read-only로 확인한다.
4. VM Cloud send log에는 test marker가 남는지 확인한다.

### 4. 조건부 dedup smoke

브라우저 `Purchase`는 아래 조건이 모두 맞을 때만 실행한다.

- Meta Test Events UI가 브라우저 이벤트를 test-only로 분리해 보여준다.
- 운영 이벤트 집계 증가가 없다는 것을 사전/사후로 확인할 수 있다.
- same event key를 browser `eventID`와 server `event_id`에 넣을 수 있다.
- 실제 주문/결제 페이지가 아니라 테스트 식별 경로 또는 통제된 테스트 코드에서만 실행한다.

조건이 하나라도 불명확하면 browser smoke는 보류한다.

## 성공 기준

### SERVER_ONLY_TEST_PASS

- 서버 CAPI test `Purchase` 1건 이하만 전송.
- Meta Test Events 탭에서 server `Purchase` 수신 확인.
- Meta 운영 `Purchase` count 증가 0.
- raw identifier output 0.
- Pixel ID `1283400029487161` 일치.
- VM Cloud/운영DB write 0.

### BROWSER_SERVER_DEDUP_TEST_PASS

- browser `Purchase` 1건 이하와 server `Purchase` 1건 이하가 같은 `eventID/event_id`로 Test Events에 보인다.
- Meta Test Events에서 중복 제거 또는 동일 event id 관계가 확인된다.
- Meta 운영 `Purchase` count 증가 0.
- raw identifier output 0.
- 실제 주문/결제 없음.

### BROWSER_TEST_BLOCKED

- 서버 test는 가능하지만 브라우저 `Purchase`를 test-only로 보장할 수 없다.
- 이 경우 전체 Pixel 직접 삽입은 계속 금지하고, 별도 browser Purchase preview 승인안을 작성한다.

## Hard Fail

아래 중 하나라도 발생하면 즉시 중단한다.

- `test_event_code` 없이 Meta `Purchase`가 전송될 위험.
- 운영 `Purchase` count가 증가.
- 서버 test event가 1건을 초과.
- Pixel/Dataset이 `1283400029487161`가 아님.
- raw order/payment/click/member/email/phone이 payload/log/report에 노출.
- Meta API 4xx/5xx가 재시도 루프를 유발.
- 브라우저 test-only 보장이 없음에도 browser `Purchase` 발화가 필요해짐.
- GTM publish, Imweb 저장, 운영DB write, campaign mutate 필요.

## Rollback / cleanup

- Test Events `test_event_code`는 실행 후 폐기한다.
- VM Cloud에는 영구 env flag를 켜지 않는다.
- Meta 운영 설정은 바꾸지 않는다.
- 실패 시 추가 전송 없이 결과 문서에 `FAIL_STOPPED`로 남긴다.
- 운영 count가 증가하면 원인 분류를 먼저 수행하고, correction/cancel send는 별도 Red 승인 전 금지한다.

## 산출물

- `capivm/biocom-purchase-test-only-smoke-result-20260515.md`
- `data/project/biocom-purchase-test-only-smoke-result-20260515.json`
- 필요 시 `capivm/biocom-browser-purchase-controlled-preview-approval-20260515.md`

## 승인 문구

```text
YES: Biocom Meta Purchase test-only smoke를 승인합니다.

범위:
- Pixel/Dataset 1283400029487161
- Meta Events Manager test_event_code 필수
- 서버 CAPI Purchase test event 1건 이하
- browser/server dedup smoke는 browser Purchase가 test-only로 보장될 때만 1회 이하
- 실제 주문/결제 없음
- 운영 Purchase count 증가 0 확인

금지:
- test_event_code 없는 Meta Purchase send
- 브라우저 Purchase를 test-only 보장 없이 운영 사이트에서 직접 발화
- Meta campaign/ad set/budget/conversion action 변경
- Google Ads/GA4/TikTok/Naver send/upload
- 운영DB write/import
- VM Cloud schema migration
- GTM publish
- Imweb header/footer 저장
- raw order/payment/click/member/email/phone 출력

실패 시:
- 즉시 중단하고 추가 전송 없이 결과 문서만 작성한다.
```

## Auditor verdict

`APPROVAL_PACKET_READY`

- 이 문서는 승인안 작성만 수행했다.
- Meta Test Events, CAPI, 운영 Purchase 전송은 실행하지 않았다.
- 운영DB write, VM Cloud write/schema migration, GTM publish, Imweb 변경은 0이다.
