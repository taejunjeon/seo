# Biocom Purchase-only drop and backfill reconciliation - 2026-05-14

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
  project_harness_read:
    - gdn/biocom-fbe-browser-server-event-health-20260514.md
    - data/project/biocom-meta-capi-afternoon-10-backfill-result-20260514.json
    - data/project/biocom-pending-amount-product-source-audit-20260514.json
    - data/project/biocom-pending-confirmed-bridge-patch-result-20260514.json
  lane: Green read-only reconciliation + documentation
  allowed_actions:
    - Meta Graph API read-only pixel stats
    - VM Cloud SQLite/log aggregate read
    - 운영DB PostgreSQL read-only aggregate
    - Imweb v2 API fallback dry-run aggregate
    - Telegram completion message if sender/env exists
  forbidden_actions:
    - Meta CAPI additional send/correction
    - Meta/Google/TikTok/Naver upload or mutate
    - campaign/budget/conversion action change
    - 운영DB write/import
    - VM Cloud write/schema migration
    - GTM publish
    - Imweb header/footer change
    - raw order/payment/click/member/email/phone output
  source_window_freshness_confidence:
    source: "Meta Graph Pixel stats + VM Cloud attribution_ledger/log + 운영DB tb_iamweb_users + Imweb v2 dry-run"
    window: "2026-05-14 KST, focus >= 13:00 KST"
    freshness: "2026-05-14 23:50 KST"
    confidence: 0.84
```

## 최종 판정

### Purchase-only drop

판정은 단일 원인보다 `B + A`, 그리고 10건 backfill 표시 문제는 `D`다.

- `B. Browser Purchase 누락`: Meta Graph 기준 2026-05-14 02:00 KST 이후 `Purchase`가 0건이다. 13:00 KST 이후에도 0건이다. 같은 기간 `ViewContent`와 `InitiateCheckout`는 계속 들어왔으므로 base Pixel 전체 장애가 아니라 `Purchase` 전용 문제다.
- `A. confirmed bridge 문제`: VM Cloud `payment_success`는 13:00 KST 이후 confirmed 20건 / pending 62건으로 갈라졌다. bridge가 20건을 confirmed로 만들었지만 no-send marker 때문에 자동 CAPI 후보가 아니었고, 나머지 62건은 아직 결제완료 정본 연결이 안 됐다.
- `C. Server CAPI dispatcher 문제`는 아님: 10건 manual backfill은 10/10 HTTP 200, `events_received=10`, duplicate 0이다.
- `D. Meta UI 표시 지연/필터 문제`: 10건 backfill은 Pixel `1283400029487161`로 accepted됐지만, Meta Graph stats/Events Manager proxy에서는 13:00 KST 이후 `Purchase`가 0건이다. Meta가 받은 응답과 UI 집계가 아직 맞지 않는다.
- `E. event_time/dataset/pixel mismatch`는 낮은 가능성: Pixel ID는 `1283400029487161`로 맞고 test_event_code도 없었다. 10건의 approved/event time은 13~16시 KST, send time은 20시 KST라 날짜 밖으로 밀린 설명도 약하다.

### 2026-05-15 00:01 KST UI 상세 대조

TJ님이 Meta Events Manager `구매` 상세 화면을 추가로 확인했다.

- `이벤트 개요`: Purchase 총 이벤트 5, 통합은 `전환 API`, 최근 수신 22시간 전.
- `샘플 활동`: source `웹`, 통합 `전환 API`, 이벤트 매개변수 5개, URL `https://biocom.kr/`. 맞춤 데이터는 Meta UI에서 `_removed_`로 표시됨.
- `이벤트 소스`: 웹사이트 이벤트가 3건 + 2건으로 보이며 총 5건과 일치.
- `광고 세트`: Purchase 이벤트가 19개 광고 세트에서 최적화 이벤트로 사용 중.

해석:

- UI에서도 Purchase 5건은 browser Pixel이 아니라 `전환 API` 쪽이다.
- 2026-05-14 20:16 KST에 보낸 10건 backfill은 UI 상세/CSV/API 어디에도 Purchase로 추가 표시되지 않았다.
- `샘플 활동`의 `_removed_`는 Meta가 개인정보/리퍼러 값을 마스킹한 표시다. 이것 자체가 데이터 누락이라는 뜻은 아니다.
- 광고 세트 19개가 Purchase 최적화를 쓰므로, Purchase drop은 단순 리포팅 문제가 아니라 Meta 학습 신호에도 영향을 줄 수 있다.

2026-05-15 00:04 KST Meta Graph 재조회도 같은 결론이다.

- 2026-05-14 전체 Purchase: 5건.
- 2026-05-14 13:00 KST 이후 Purchase: 0건.
- rolling 48h에서는 2026-05-13 Purchase가 정상적으로 시간대별로 보이고, 2026-05-14는 00시 3건 + 01시 2건 이후 끊긴다.

## 1. Purchase-only drop 분리

### 2026-05-14 하루 기준

| 지표 | 값 | source |
|---|---:|---|
| Meta visible Purchase count | 5 | Meta Graph Pixel stats |
| Browser Pixel Purchase 추정 | 0 | UI/Graph상 5건이 server 쪽으로 보였다는 기존 화면과 대조한 추정 |
| Server CAPI Purchase send attempt | 30 | VM Cloud `meta-capi-sends.jsonl` |
| Server CAPI Purchase success | 30 | VM Cloud `meta-capi-sends.jsonl` |
| Meta response `events_received` | 30 | VM Cloud `meta-capi-sends.jsonl` |
| VM Cloud `payment_success` confirmed | 37 / 9,504,244원 | VM Cloud SQLite `attribution_ledger` |
| VM Cloud `payment_success` pending | 69 | VM Cloud SQLite `attribution_ledger` |
| 운영DB `PAYMENT_COMPLETE` | 48 / 9,893,376원 | 운영DB PostgreSQL `tb_iamweb_users` read-only |
| Imweb API confirmed fallback | 1건 / 0원 | Imweb v2 fallback dry-run |

주의: `payment_success` confirmed/pending은 VM Cloud 수신 시각 기준이고, 운영DB `PAYMENT_COMPLETE`는 결제완료 시각 기준이다. 두 숫자는 같은 시간축이 아니다.

### 2026-05-14 13:00 KST 이후

| 지표 | 값 | source |
|---|---:|---|
| Meta visible Purchase count | 0 | Meta Graph Pixel stats |
| Browser Pixel Purchase 추정 | 0 | Meta visible Purchase 0 + VM Cloud server send 10과 불일치 |
| Server CAPI Purchase send attempt | 10 | VM Cloud `meta-capi-sends.jsonl` |
| Server CAPI Purchase success | 10 | VM Cloud `meta-capi-sends.jsonl` |
| Meta response `events_received` | 10 | VM Cloud `meta-capi-sends.jsonl` |
| VM Cloud `payment_success` confirmed | 20 / 4,824,615원 | VM Cloud SQLite `attribution_ledger` |
| VM Cloud `payment_success` pending | 62 | VM Cloud SQLite `attribution_ledger` |
| 운영DB `PAYMENT_COMPLETE` | 21 / 4,474,015원 | 운영DB PostgreSQL `tb_iamweb_users` read-only |
| 운영DB non-NPay `PAYMENT_COMPLETE` | 20 / 4,340,115원 | 운영DB PostgreSQL `tb_iamweb_users` read-only |
| 운영DB NPay `PAYMENT_COMPLETE` | 1 / 133,900원 | 운영DB PostgreSQL `tb_iamweb_users` read-only |
| Imweb API confirmed fallback | 1건 / 0원 | Imweb v2 fallback dry-run |
| Imweb API canceled/refunded fallback | 1건 / 234,000원 | Imweb v2 fallback dry-run |
| Imweb API not found | 60건 | Imweb v2 fallback dry-run |

해석:

- 13:00 이후 실제 결제완료는 운영DB 기준 21건 있었다.
- VM Cloud server CAPI는 10건만 수동 backfill로 보냈고, 자동 dispatcher는 추가 전송하지 않았다.
- Meta visible Purchase는 0건이라, 10건 backfill의 UI 반영은 아직 확인되지 않았다.
- 결제완료가 없는 것이 아니라, browser Purchase와 server auto-send 후보 생성이 모두 비어 있었다.

## 2. 10건 backfill attribution quality

### 품질 분류

| grade | count | Meta sent amount | 운영DB actual amount | 판정 |
|---|---:|---:|---:|---|
| A. Meta strong evidence | 0 | 0원 | 0원 | 없음 |
| B. Meta weak evidence | 0 | 0원 | 0원 | 없음 |
| C. No Meta evidence, valid purchase | 8 | 2,021,330원 | 2,021,330원 | 실제 구매지만 Meta 유입 증거 없음 |
| D. Duplicate/invalid | 2 | 239,800원 | 811,200원 | duplicate 아님, wrong value |
| 합계 | 10 | 2,261,130원 | 2,832,530원 | 전송 성공 10건, 금액 품질 이슈 2건 |

### 세부 해석

- A-grade strong evidence는 0건이다. `fbclid` 또는 `fbc`가 붙은 row가 없고, Meta UTM + session continuity도 없었다.
- 10건 모두 운영DB `PAYMENT_COMPLETE` 실제 구매는 맞다.
- 2건은 운영DB 주문 총액보다 낮은 금액으로 Meta에 전송됐다. 한 건은 다중 line 주문에서 일부 금액만, 한 건은 2-line 주문에서 절반 금액만 잡힌 형태다.
- duplicate event_id는 0이고 Pixel ID도 맞다.

## 3. 10건 취소/보정 검토

### 취소 필요 여부

- 8건 / 2,021,330원: 취소하지 않는다. 실제 구매이고 duplicate/wrong pixel/wrong value가 아니다. 다만 Meta 유입 증거가 없으므로 internal Meta ROAS에는 포함하지 않는다.
- 2건: 실제 구매는 맞지만 wrong value다. 취소라기보다 value correction strategy가 필요하다.

### internal ROAS 반영

- 내부 actual 매출: 10건 모두 운영DB 결제완료 실제 구매로 포함 가능.
- 내부 Meta ROAS: 10건 모두 Meta 귀속 매출로 포함하지 않는다.
- Meta pending attribution: 8건은 "actual purchase / no Meta evidence", 2건은 "actual purchase / CAPI value mismatch"로 둔다.

### correction strategy

실제 correction send는 금지한다.

가능한 전략은 별도 승인 전까지 문서화만 한다.

1. 2건은 Meta ROAS 내부 계산에서 제외한다.
2. event_id 재전송으로 value가 수정되는지 Meta 정책/API 근거를 확인한다.
3. same event_id retry가 dedup으로 무시될 수 있으므로, 임의 delta event나 새 Purchase event는 보내지 않는다.
4. future bridge는 운영DB order total을 source of truth로 쓰고, VM Cloud line/item amount를 Purchase value로 쓰지 않게 guard를 추가한다.

## 4. Meta Pixel 직접 삽입 여부

판정: `B. TEST_ONLY_PIXEL_PURCHASE_NEEDED`

단, "전체 Pixel 직접 삽입"은 하지 않는다.

이유:

- FBE/browser Pixel은 `ViewContent`, `AddToCart`, `InitiateCheckout`를 받고 있다. base Pixel 자체는 죽지 않았다.
- 문제는 `Purchase`만 02:00 KST 이후 보이지 않는 것이다.
- 전체 Pixel을 직접 삽입하면 PageView/ViewContent/AddToCart/InitiateCheckout 중복 위험이 크다.
- Purchase 보완이 필요해도, Test Events/Preview에서 `eventID` dedup과 Purchase Guard 동작을 먼저 확인해야 한다.

운영 적용 후보는 다음 순서다.

1. Meta Test Events에서 controlled Purchase 1건 이하 smoke.
2. Browser `Purchase`와 server `Purchase`의 eventID가 같은지 확인.
3. pending/무통장/미입금에서는 Purchase가 계속 차단되는지 확인.
4. PASS일 때만 controlled Purchase 보완 승인안을 만든다.

## 5. Telegram 종료 알림

상태: `scripts/send-telegram-message.sh`와 env가 있어 실제 전송 완료.

전송 메시지:

```text
판정: Purchase drop은 Browser Purchase 누락 + confirmed bridge/gate 문제, dispatcher 장애 아님.
10건 backfill은 accepted 10/10이나 Meta UI visible Purchase와 아직 불일치.
Pixel 전체 직접 삽입은 금지, Purchase만 Test Events로 확인 필요.
10건 취소는 안 함; 2건 value mismatch는 correction 전략만 문서화.
다음: Purchase test-only smoke + bridge value guard 보강.
```

## 6. 다음 행동

### Codex가 할 일

1. bridge value guard 보강안을 작성한다.
   - 무엇: future Meta Purchase value가 운영DB order total과 다르면 send 후보에서 제외한다.
   - 왜: 이번 10건 중 2건 value mismatch가 있었기 때문이다.
   - 어떻게: no-send dry-run/test 우선. 실제 send 없음.
   - 성공 기준: 다중 line 주문도 운영DB 총액과 일치할 때만 후보.
   - 승인 필요 여부: 코드 patch/test는 Green, VM Cloud deploy는 Yellow, Meta send는 Red.
   - 의존성: 없음.
   - 추천 점수/자신감: 95%.

2. Purchase Test Events smoke 승인안을 만든다.
   - 무엇: browser Purchase와 server Purchase가 같은 eventID로 dedup되는지 test_event_code 공간에서만 확인한다.
   - 왜: 전체 Pixel 직접 삽입 없이 Purchase 전용 문제를 확인하기 위해서다.
   - 어떻게: Meta Events Manager Test Events code가 있을 때만 1건 이하 controlled smoke.
   - 성공 기준: 운영 카운트 증가 0, Test Events 탭에서 browser/server eventID 일치.
   - 승인 필요 여부: 실행은 TJ님 승인 필요.
   - 의존성: TJ님 test_event_code 필요.
   - 추천 점수/자신감: 90%.

### TJ님이 할 일

1. Meta Events Manager에서 20:16 KST 이후 server Purchase가 뒤늦게 보이는지 확인한다.
   - 무엇: Pixel `1283400029487161` Purchase 이벤트의 source/server 필터와 시간 필터 확인.
   - 왜: CAPI accepted 10건과 Meta UI visible 0건 불일치를 D/E 중 어디로 볼지 확정하기 위해서다.
   - 어디서: Events Manager -> Pixel `1283400029487161` -> Purchase -> 이벤트 개요/데이터 소스 -> 2026-05-14.
   - 성공 기준: 20:16 KST 전송분 또는 13~16시 event_time bucket에서 10건이 보임.
   - 실패 시 확인점: dataset/pixel 필터, browser/server 필터, event_time 기준 표시 여부.
   - Codex가 대신 못 하는 이유: Meta UI 로그인/2FA와 실제 화면 접근이 필요하다.
   - 승인 필요 여부: 없음.
   - 의존성: 없음.
   - 추천 점수/자신감: 82%.
