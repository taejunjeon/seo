harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
    - harness/npay-recovery/APPROVAL_GATES.md
  required_context_docs:
    - project/!google-npay-bridge-core-mission-okr-20260530.md
    - project/google-npay-bridge-gtm-production-publish-approval-20260528.md
    - project/google-npay-bridge-write-smoke-and-7d-breakdown-20260528.md
    - project/google-npay-button-bridge-gtm-patch-and-bi-confirmed-plan-20260528.md
    - data/!data_inventory.md
  lane: Green for this approval document. Yellow for later VM Cloud additive schema/backend deploy/GTM Preview smoke. Red for GTM Production publish, Google Ads send, auto dispatcher permanent ON, production DB write, and actual payment test.
  allowed_actions:
    - approval packet writing
    - code-ready design
    - local fixture/test planning
    - no-write/no-send dry-run planning
  forbidden_actions:
    - GTM production publish
    - Google Ads conversion upload
    - VM Cloud deploy/write without explicit approval
    - production DB write/import
    - actual NPay payment test
  source_window_freshness_confidence:
    source: VM Cloud NPay intent rematch live API snapshot + local backend/GTM source code review
    window: 2026-05-28 00:00 ~ 2026-05-30 00:00 KST for latest NPay rematch
    freshness: latest observed snapshot at 2026-05-30 12:57 KST, code review at 2026-05-30 16:00 KST
    confidence: high for bottleneck and code hook points, medium-high for v1.2 expected lift because it still needs Preview smoke

# Google/NPay Bridge v1.2 승인안 - 2026-05-30

작성 시각: 2026-05-30 16:00 KST
기준일: 2026-05-30
문서 성격: 코드 직전 승인안 / Yellow Lane sprint packet / no-send 설계
연결 정본: [Google/NPay Bridge Core Mission OKR](/Users/vibetj/coding/seo/project/!google-npay-bridge-core-mission-okr-20260530.md)

## 10초 요약

NPay 버튼 클릭과 Google click id 저장은 이미 잘 되고 있다. 최신 48시간 기준 Google 흔적 NPay 버튼 클릭 164건 중 163건에 Google click id가 남았다. 지금 막힌 것은 버튼 클릭 후 네이버 외부 결제창을 지난 실제 결제완료 주문을 원래 버튼 클릭 row와 안정적으로 다시 붙이지 못하는 문제다.

v1.2는 이 문제를 풀기 위해 NPay 버튼 클릭 순간부터 결제창 진입, 주문 생성, 실제 결제완료 주문까지 이어지는 연결키를 추가한다. 단, 원문 주문번호와 click id는 화면/API/문서/로그에 남기지 않고 서버에서 즉시 hash/HMAC 처리하는 것을 필수 조건으로 둔다.

## 현재 문제를 사람 말로 풀면

현재 시스템은 “누가 NPay 버튼을 눌렀는가”는 꽤 잘 본다. 하지만 사용자가 네이버 로그인/결제창으로 넘어간 뒤 실제 결제가 끝나면, 자사몰 쪽에는 “결제완료 주문”만 다시 남는다.

문제는 이때 “이 주문이 아까 그 버튼 클릭에서 시작된 주문이 맞다”를 확정할 열쇠가 부족하다는 것이다.

최신 48시간 숫자는 아래와 같다.

- NPay 버튼 클릭: 221건.
- Google 흔적 NPay 버튼 클릭: 164건.
- Google 흔적 클릭 중 Google click id 보존: 163건, 99.4%.
- 실제 NPay 결제완료: 15건.
- A급 자동 연결: 3건.
- 결제완료는 맞지만 어떤 버튼 클릭에서 시작됐는지 애매한 주문: 12건.
- 결제창까지 갔지만 결제완료 주문이 붙지 않은 후보: 108건.

따라서 v1.2의 목적은 “버튼 클릭을 더 많이 세기”가 아니다. 이미 버튼 클릭은 많이 세고 있다. 목적은 실제 결제완료 주문 15건 중 3건만 확정되는 문제를 줄이는 것이다.

## 승인 범위

### TJ님이 승인하면 진행 가능한 Yellow 범위

아래는 승인 후 코드 구현과 제한 smoke까지 진행 가능한 범위다.

1. VM Cloud `npay_intent_log`에 additive column 추가.
2. NPay intent receiver가 v1.2 필드를 받도록 backend route 보강.
3. `raw_payload` 저장 전에 원문 주문번호, 원문 bridge id, 원문 click id 계열 필드를 제거하는 scrubber 보강.
4. GTM Preview workspace에서만 v1.2 태그 구성.
5. 버튼 클릭 smoke 1~3회.
6. 실제 Google Ads 전송 없이 no-send 후보표만 생성.
7. 로컬/VM Cloud report API에 v1.2 fill-rate와 match-rate 표시.

### 이 승인안에 포함하지 않는 Red 범위

아래는 이 문서 승인만으로 실행하면 안 된다.

1. GTM Production publish.
2. Google Ads 전환 전송.
3. 자동 전송 dispatcher 상시 ON.
4. 운영DB write/import.
5. 실제 결제 테스트.
6. raw 주문번호, raw click id, 회원/전화/email 원문을 API나 문서에 출력.

## 코드 직전 구현 범위

### 1. GTM/브라우저 태그 v1.2

대상 파일:

- [biocom-npay-bridge-gtm-v1-1-preview.js](/Users/vibetj/coding/seo/imweb/biocom-npay-bridge-gtm-v1-1-preview.js)

권장 구현은 v1.1 파일을 직접 덮어쓰기보다 새 파일로 분리한다.

- 신규 후보 파일: `/Users/vibetj/coding/seo/imweb/biocom-npay-bridge-gtm-v1-2-preview.js`
- version/source 예시:
  - `VERSION = '2026-05-30-biocom-npay-bridge-gtm-v1-2-preview'`
  - `SOURCE = 'gtm_npay_bridge_v1_2'`

v1.2에서 추가할 값:

1. `npay_checkout_bridge_id`
   - NPay 버튼 클릭 순간 생성하는 내부 연결키.
   - 원문은 브라우저 메모리/sessionStorage에 짧게만 유지한다.
   - 서버에는 원문을 보내더라도 서버에서 즉시 HMAC 처리하고 원문 저장 금지.

2. `cart_snapshot`
   - 상품 idx.
   - 상품명.
   - 옵션명.
   - 수량.
   - 상품가.
   - 화면에서 보이는 배송비/할인/총액 후보.
   - 목표는 “버튼 클릭 당시 금액”과 “실제 주문금액” 차이를 배송비/쿠폰/수량/장바구니로 설명하는 것이다.

3. `checkout_stage`
   - `button_clicked`: NPay 버튼 클릭 확정.
   - `bridge_opened`: NPay bridge URL 관측.
   - `login_gate_possible`: 네이버 로그인 화면으로 넘어간 정황.
   - `checkout_opened_possible`: 네이버 결제서 URL 관측.
   - `order_init_observed`: 아임웹/NPay 주문 생성 응답 관측.

4. `imweb_order_code`
   - `/shop/oms/OMS_add_order.cm` 또는 `/shop/add_order.cm` 응답에서 `order_code`가 보이면 전송 후보로 삼는다.
   - 매우 중요: 서버에서 즉시 HMAC 처리하고 원문 저장/로그/API 반환 금지.
   - v1.1은 `imweb_order_code_present`만 저장한다. v1.2는 “원문을 저장하지 않는 hash 연결”까지 닫아야 한다.

5. `source_snapshot`
   - Google/Meta/Naver/direct 여부.
   - `gclid`, `gbraid`, `wbraid` 존재 여부.
   - 원문 click id는 이미 저장 체계가 있으므로, 보고서에는 존재 여부만 내보낸다.

### 2. VM Cloud backend receiver

대상 파일:

- [npayIntentLog.ts](/Users/vibetj/coding/seo/backend/src/npayIntentLog.ts)
- [orderBridgeIdentityHmac.ts](/Users/vibetj/coding/seo/backend/src/orderBridgeIdentityHmac.ts)

현재 `npay_intent_log`는 `npay_bridge_url_hash`, `npay_bridge_host`, `npay_bridge_path_hash`, `npay_bridge_observed_at`까지 저장한다. v1.2는 실제 주문과 다시 붙이는 키를 더 넣는다.

추가 column 후보:

```sql
ALTER TABLE npay_intent_log ADD COLUMN npay_checkout_bridge_id_hash TEXT DEFAULT '';
ALTER TABLE npay_intent_log ADD COLUMN imweb_order_code_hash TEXT DEFAULT '';
ALTER TABLE npay_intent_log ADD COLUMN channel_order_no_hash TEXT DEFAULT '';
ALTER TABLE npay_intent_log ADD COLUMN local_session_id_hash TEXT DEFAULT '';
ALTER TABLE npay_intent_log ADD COLUMN cart_fingerprint_hash TEXT DEFAULT '';
ALTER TABLE npay_intent_log ADD COLUMN cart_item_count INTEGER;
ALTER TABLE npay_intent_log ADD COLUMN cart_quantity_total INTEGER;
ALTER TABLE npay_intent_log ADD COLUMN cart_subtotal_krw INTEGER;
ALTER TABLE npay_intent_log ADD COLUMN delivery_price_krw INTEGER;
ALTER TABLE npay_intent_log ADD COLUMN discount_amount_krw INTEGER;
ALTER TABLE npay_intent_log ADD COLUMN expected_payment_amount_krw INTEGER;
ALTER TABLE npay_intent_log ADD COLUMN amount_source TEXT DEFAULT '';
ALTER TABLE npay_intent_log ADD COLUMN checkout_stage TEXT DEFAULT '';
ALTER TABLE npay_intent_log ADD COLUMN bridge_opened_at TEXT DEFAULT '';
ALTER TABLE npay_intent_log ADD COLUMN checkout_opened_at TEXT DEFAULT '';
ALTER TABLE npay_intent_log ADD COLUMN login_gate_observed_at TEXT DEFAULT '';
ALTER TABLE npay_intent_log ADD COLUMN order_init_observed_at TEXT DEFAULT '';
ALTER TABLE npay_intent_log ADD COLUMN bridge_version TEXT DEFAULT '';
ALTER TABLE npay_intent_log ADD COLUMN privacy_hash_version TEXT DEFAULT 'hmac_sha256_identity_v1';
```

추가 index 후보:

```sql
CREATE INDEX IF NOT EXISTS idx_npay_intent_checkout_bridge
  ON npay_intent_log(site, npay_checkout_bridge_id_hash);

CREATE INDEX IF NOT EXISTS idx_npay_intent_imweb_order_hash
  ON npay_intent_log(site, imweb_order_code_hash);

CREATE INDEX IF NOT EXISTS idx_npay_intent_cart_fingerprint
  ON npay_intent_log(site, cart_fingerprint_hash, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_npay_intent_local_session
  ON npay_intent_log(site, local_session_id_hash, captured_at DESC);
```

중요한 보안 조건:

- `ORDER_BRIDGE_IDENTITY_HASH_SECRET` 또는 같은 수준의 HMAC secret이 VM Cloud backend env에 있어야 한다.
- `raw_payload`에 원문 `imweb_order_code`, `npay_checkout_bridge_id`, `channel_order_no`, raw click id가 남으면 안 된다.
- 현재 `recordNpayIntent`는 `sanitizeRawPayload(input, normalizedRaw)`로 raw payload를 저장한다. v1.2 구현 시 `SENSITIVE_RAW_KEYS`와 scrubber를 먼저 확장해야 한다.
- 서버 access log에도 raw query/body가 찍히지 않게 POST body logging을 금지한다.

### 3. 매칭 알고리즘

대상 파일:

- [npayRoasDryRun.ts](/Users/vibetj/coding/seo/backend/src/npayRoasDryRun.ts)

v1.2의 핵심은 점수를 높이는 것이 아니라 “안전한 확정 조건”을 늘리는 것이다.

#### A급으로 올릴 수 있는 조건

아래 중 하나가 있으면 A급 후보로 올릴 수 있다.

1. `imweb_order_code_hash`가 주문 원장의 order code hash와 정확히 일치.
2. `channel_order_no_hash`가 NPay 완료 주문번호 hash와 정확히 일치.
3. `npay_checkout_bridge_id_hash`가 intent와 주문 bridge ledger에서 정확히 일치하고, 주문 생성시각 차이가 5분 이내.
4. `cart_fingerprint_hash`, 최종 결제금액, `order_time`이 모두 맞고 후보가 1건뿐임.

A급이라도 Google Ads 전송 후보가 되려면 아래를 추가로 만족해야 한다.

- 실제 결제완료 주문.
- 취소/환불 아님.
- 결제금액 > 0.
- 테스트 주문 아님.
- Google click id 직접 존재.
- Google Ads `click_view` 또는 validate-only에서 계정 소유 클릭으로 해석 가능.
- 전송 장부에 같은 주문/전환/action 중복 없음.

#### B급으로 남겨야 하는 조건

아래는 내부 분석에는 유용하지만 Google Ads 전송은 금지한다.

- 같은 브라우저/GA session만 맞음.
- 같은 상품명과 시간대만 맞음.
- 후보가 2건 이상이고 score gap이 작음.
- 금액이 아직 배송비/쿠폰/수량/세트상품으로 설명되지 않음.
- Google 유입 정황은 있지만 NPay intent row 자체에 Google click id가 직접 없음.

#### Ambiguous로 남겨야 하는 조건

아래는 결제완료 주문은 맞아도 버튼 클릭 row를 특정하면 위험하다.

- 같은 상품 클릭 후보가 여러 개.
- 후보가 10건 이상 겹침.
- 회원/세션/bridge/order key가 없음.
- 클릭과 order_time 간격이 너무 넓음.
- 상품명만 비슷하고 금액이 불명확함.

## Preview smoke 성공 기준

### v1.2 버튼 클릭 smoke 1~3회 기준

성공으로 보는 조건:

1. `/api/attribution/npay-intent`에 `source=gtm_npay_bridge_v1_2` row가 생김.
2. `npay_checkout_bridge_id_hash`가 채워짐.
3. `cart_fingerprint_hash`가 채워짐.
4. `checkout_stage`가 `button_clicked` 또는 더 깊은 단계로 기록됨.
5. Google 광고 클릭 URL에서 진입한 경우 `gclid/gbraid/wbraid` 중 하나가 정상 click id로 저장됨.
6. TEST/SMOKE/GTM 가짜 click id는 quarantine되고 전송 후보에서 제외됨.
7. raw 주문번호, raw click id, raw bridge id가 API 응답/문서/로그에 노출되지 않음.
8. Google Ads 전송 0건.

### 실제 결제 smoke는 별도 Red 승인

실제 결제완료까지 테스트하면 가장 빠르게 확인할 수 있다. 하지만 실제 결제는 비용과 주문이 발생하므로 이 문서 승인에 포함하지 않는다.

실제 결제 테스트가 필요해지는 조건:

- Preview 버튼 클릭 smoke가 PASS.
- `imweb_order_code_hash` 또는 `npay_checkout_bridge_id_hash`가 정상 저장됨.
- no-send 후보 생성기에서 실제 주문과 연결 가능하다는 dry-run 결과가 나옴.
- TJ님이 별도로 실제 결제 테스트를 승인함.

## 48시간 운영 관측 성공 기준

v1.2 Production publish 이후 48시간을 본다면 성공 기준은 아래다. 이 단계는 Red Lane publish 승인 이후에만 해당한다.

1. v1.2 NPay intent 중 `npay_checkout_bridge_id_hash` 채움률 95% 이상.
2. bridge URL/hash 채움률 75% 이상.
3. 실제 NPay 결제완료 strong match 비율 70% 이상.
4. ambiguous completed 주문이 15건 중 12건 수준에서 5건 이하로 감소.
5. Google 흔적 결제완료 주문 중 전송 후보와 보류 후보가 자동 분리됨.
6. Google Ads 전송 후보는 no-send preview로만 생성되고, 승인 전 실제 전송 0건.
7. raw 식별자 노출 0건.

## 즉시 중단 기준

아래 중 하나라도 발생하면 v1.2 작업을 멈춘다.

1. 자사몰 NPay 버튼 클릭이나 결제창 이동이 깨짐.
2. API 4xx/5xx가 5% 이상 발생.
3. raw 주문번호, raw click id, member/email/phone이 API 응답/로그/문서에 노출됨.
4. 테스트 click id가 정상 click id로 저장됨.
5. Google Ads send가 Preview/Smoke 중 발생.
6. 기존 v1.1보다 Google click id 보존률이 떨어짐.
7. duplicate intent가 비정상적으로 증가함.
8. match-rate가 개선되지 않고 ambiguous만 늘어남.

## 구현 순서

### Step 1. 로컬 fixture 구현

무엇을 하는가: v1.2 payload fixture를 만들고 receiver가 raw 식별자를 저장하지 않는지 먼저 테스트한다.
왜 하는가: 원문 주문번호를 잠깐 다룰 수 있으므로 raw leak 방어를 코드 첫 줄에서 확인해야 한다.
성공 기준: fixture에서 hash presence는 true, raw output은 false, platform send는 0.
Lane: Green.

### Step 2. backend additive schema와 receiver 보강

무엇을 하는가: `npay_intent_log`에 새 hash/amount/stage 컬럼을 추가하고 `recordNpayIntent`가 v1.2 필드를 받게 한다.
왜 하는가: 버튼 클릭과 실제 주문 사이의 결정적 연결키를 저장해야 한다.
성공 기준: local test와 API smoke에서 v1.2 row가 저장되고 raw payload에 원문 식별자가 없다.
Lane: Yellow, VM Cloud deploy는 TJ님 승인 필요.

### Step 3. GTM Preview v1.2 태그 구성

무엇을 하는가: fresh workspace에서 v1.2 태그를 Preview 전용으로 만든다.
왜 하는가: 운영 게시 전에 버튼 클릭 순간 새 필드가 실제로 잡히는지 확인해야 한다.
성공 기준: live version unchanged, submit/publish 0, Preview row 저장 PASS.
Lane: Yellow, Preview workspace 승인 필요.

### Step 4. 매칭 dry-run 보강

무엇을 하는가: `imweb_order_code_hash`, `npay_checkout_bridge_id_hash`, `cart_fingerprint_hash`를 A/B/ambiguous 판정에 반영한다.
왜 하는가: 같은 상품/시간대만으로 붙이는 위험을 줄이고, 확정 가능한 주문을 늘리기 위해서다.
성공 기준: 최신 48시간 재조회에서 A급 증가, ambiguous 감소, no-send 후보표 분리.
Lane: Green for local dry-run, Yellow for VM Cloud route deploy.

### Step 5. report 표시

무엇을 하는가: 로컬 보고서에 v1.2 key fill-rate, 결제 단계별 이탈, A/B/ambiguous 사유를 표시한다.
왜 하는가: 버튼 클릭이 많은데 왜 결제완료와 안 붙는지 사람이 바로 봐야 한다.
성공 기준: `/ads/google-roas-report` 또는 분리된 NPay bridge report에서 단계별 숫자와 사유가 보임.
Lane: Green for local frontend, Yellow for production deploy.

## 코드 수정 후보 파일

1. [biocom-npay-bridge-gtm-v1-1-preview.js](/Users/vibetj/coding/seo/imweb/biocom-npay-bridge-gtm-v1-1-preview.js)
   - v1.2 preview 파일로 복제.
   - checkout bridge id, cart snapshot, order init observed 값을 추가.

2. [npayIntentLog.ts](/Users/vibetj/coding/seo/backend/src/npayIntentLog.ts)
   - v1.2 field aliases 추가.
   - additive column 추가.
   - raw payload scrubber 확장.
   - HMAC/hash 저장.

3. [orderBridgeIdentityHmac.ts](/Users/vibetj/coding/seo/backend/src/orderBridgeIdentityHmac.ts)
   - 기존 HMAC 유틸 재사용.
   - 필요하면 NPay bridge 전용 hash material builder 추가.

4. [npayRoasDryRun.ts](/Users/vibetj/coding/seo/backend/src/npayRoasDryRun.ts)
   - A/B/ambiguous 판정에 v1.2 연결키 반영.
   - v1.2 fill-rate와 unresolved reason breakdown 추가.

5. `backend/src/routes/attribution.ts`
   - `/api/attribution/npay-intent` 요청/응답이 raw 식별자를 echo하지 않는지 확인.

6. frontend report files
   - v1.2 key fill-rate, 단계별 퍼널, 미연결 사유를 표시.
   - 실제 Google Ads 전송 후보와 내부 bridge 후보는 계속 분리 표시.

## 보안/개인정보 기준

v1.2는 “일단 원문을 다 저장하고 나중에 암호화” 방식으로 가지 않는다.

허용:

- 서버가 request body 안의 주문번호를 받아 즉시 HMAC 처리.
- HMAC/hash 결과만 저장.
- API/report에는 raw가 아니라 presence, hash prefix, count, status만 표시.

금지:

- raw order code 저장.
- raw channel order no 저장.
- raw checkout bridge id 저장.
- raw click id를 public report에 표시.
- `raw_payload`에 원문 식별자 보관.
- debug log에 raw body 출력.
- Telegram/문서/대화에 raw 주문번호나 raw click id 출력.

특히 `raw_payload` scrubber 확장은 v1.2의 선행 작업이다. 이걸 하지 않고 `imweb_order_code`를 받으면 원문이 SQLite에 남을 수 있다.

## 승인 문구

TJ님이 다음 문구로 승인하면 Yellow 범위만 진행한다.

> NPay bridge v1.2 Yellow 승인. VM Cloud additive schema/backend receiver 배포와 GTM Preview smoke까지 허용. GTM Production publish, Google Ads send, 실제 결제 테스트, 운영DB write는 제외.

이 승인으로 되는 것:

- 코드 구현.
- VM Cloud backend 제한 배포.
- GTM Preview workspace smoke.
- no-send 후보표 생성.
- report 표시.

이 승인으로 안 되는 것:

- 운영 GTM 게시.
- Google Ads 전송.
- 실제 결제 테스트.
- 운영DB 쓰기.

## 코드 착수 전 체크리스트

- [ ] `SENSITIVE_RAW_KEYS`에 `imweb_order_code`, `order_code`, `channel_order_no`, `npay_checkout_bridge_id`, `checkout_bridge_id` 계열 추가.
- [ ] `raw_payload`에 원문 식별자가 남지 않는 fixture 추가.
- [ ] HMAC secret 없을 때 fail-closed 처리.
- [ ] TEST/SMOKE/GTM click id quarantine 유지.
- [ ] v1.1 source와 v1.2 source가 보고서에서 분리되도록 처리.
- [ ] duplicate intent merge가 v1.2 필드를 누락하지 않도록 보강.
- [ ] A급 기준과 Google Ads 전송 기준을 분리.
- [ ] no-send preview에서 platform send count 0 확인.
- [ ] Preview smoke 전 GTM fresh workspace, live version unchanged 확인.
- [ ] VM Cloud deploy 전 rollback 명령과 health check 준비.

## Auditor Verdict

판정: PASS_WITH_NOTES.

근거:

- 이번 문서는 승인안 작성과 코드 직전 설계만 수행했다.
- 외부 플랫폼 전송, VM Cloud write/deploy, GTM publish, 운영DB write, 실제 결제 테스트는 하지 않았다.
- v1.2의 핵심 리스크는 raw 식별자 저장이다. 따라서 구현 첫 단계는 기능 추가가 아니라 raw payload scrubber와 HMAC fixture여야 한다.

남은 주의:

- v1.2가 match-rate를 올리는지는 Preview smoke와 48시간 운영 관측 전까지 확정할 수 없다.
- 실제 결제완료 주문과 버튼 클릭이 붙더라도 Google Ads 전송 후보는 더 좁은 기준을 통과해야 한다.
- 240,000원 미반영 row처럼 Google Ads가 click id를 계정 클릭으로 인정하지 않는 케이스는 v1.2만으로 해결되지 않는다.

## 승인 후 실행 기록

실행 시각: 2026-05-30 16:49 KST

실행 범위:

- VM Cloud backend `npay_intent_log` v1.2 additive schema/receiver 배포.
- v1.2 receiver preview/test smoke 2건.
- Google Ads 전송 없음.
- GTM Production publish 없음.
- 실제 결제 테스트 없음.
- 운영DB write/import 없음.

배포 파일:

- `backend/src/npayIntentLog.ts`
- `backend/src/npayRoasDryRun.ts`

검증:

- 로컬 `npm run typecheck`: 통과.
- 로컬 `npx tsx --test tests/npay-intent-v12.test.ts tests/npay-roas-dry-run.test.ts`: 7개 통과.
- 로컬 `python3 scripts/harness-preflight-check.py --strict`: 통과.
- 로컬 `git diff --check`: 통과.
- VM Cloud remote `npm run build`: 통과.
- VM Cloud PM2 `seo-backend`: online.
- `https://att.ainativeos.net/health`: `status=ok`.

운영 smoke 결과:

- 첫 receiver smoke는 기존 테이블에 새 컬럼을 추가하는 과정이 포함되어 20초 timeout이 났지만 row는 저장됐다.
- 그 과정에서 기존 테이블 migration 순서 문제가 발견되어 `npayIntentLog.ts`에서 새 컬럼 인덱스를 `ensureColumn` 이후에 만들도록 수정했다.
- 수정 후 두 번째 receiver smoke는 HTTP 201 정상 응답.
- VM Cloud SQLite 확인 결과 v1.2 컬럼 8개 모두 존재.
- 최신 v1.2 smoke row 2건 모두 `npay_checkout_bridge_id_hash`, `imweb_order_code_hash`, `channel_order_no_hash`, `local_session_id_hash`, `cart_fingerprint_hash`가 64자리 hash로 저장됨.
- TEST click id는 `gclid/gbraid/wbraid` 컬럼에 저장되지 않음.
- `raw_payload`에는 TEST click id, raw bridge id, raw order prefix가 남지 않음.

해석:

- v1.2 backend 수집 준비는 완료.
- 아직 GTM Production에 v1.2 태그가 게시된 것은 아니므로 실제 운영 유저의 버튼 클릭 품질 개선은 시작 전이다.
- 다음 단계는 GTM Preview에서 실제 브라우저 버튼 클릭 1건을 확인하고, Production publish 승인 전 v1.2 fill-rate/원문 scrub을 한 번 더 검증하는 것이다.
