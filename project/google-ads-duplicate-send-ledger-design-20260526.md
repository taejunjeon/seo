작성 시각: 2026-05-26 21:53 KST
기준일: 2026-05-26
문서 성격: Google Ads 실제 구매 전환 중복 전송 방지 장부 no-write 설계

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - data/!data_inventory.md
  required_context_docs:
    - project/google-ads-private-payload-preview-vm-deploy-result-20260526.md
    - project/google-ads-confirmed-only-nosend-builder-20260526.md
  lane: Green
  allowed_actions:
    - no-write ledger design
    - no-send payload review
    - readiness criteria definition
  forbidden_actions:
    - Google Ads conversion upload
    - VM Cloud SQLite write
    - operational DB write
    - Google Ads primary/secondary setting mutation
    - raw order id or raw click id exposure
  source_window_freshness_confidence:
    source: VM Cloud private preview API + duplicate-ledger dry-run API smoke + VM Cloud localhost order diagnostics aggregate
    window: last_7d
    freshness: 2026-05-26 21:53 KST VM Cloud no-write API smoke + aggregate bottleneck refresh
    confidence: high for duplicate dry-run, medium-high for future write design until schema/write approval
```

## 10초 요약

Google Ads에 실제 결제완료 주문을 보내려면, 먼저 “같은 주문을 두 번 보내지 않는 장부”가 필요하다.

현재 private preview는 최근 7일 실제 구매 후보 2건을 찾았고, duplicate-ledger dry-run도 2건 모두 통과했다. 추가로 장부 write smoke plan API와 후보 확대 API를 VM Cloud에 배포해 live no-write smoke까지 통과했다. 아직 실제 장부 write와 Google Ads 전송은 열지 않는다.

이 문서는 실제 write 없이 장부 구조와 성공 기준을 코드 직전 단계까지 정의한다. Google Ads 전송과 장부 write는 Red/Yellow 승인 전까지 0건이다.

write smoke final 실행안은 [[#write-smoke-final-실행안-2026-05-26-21-53]]에 고정했다.

## 왜 필요한가

Google Ads에 실제 구매를 보내는 목적은 자동입찰이 “버튼 클릭”이 아니라 “돈을 낸 고객”을 학습하게 만드는 것이다.

그런데 같은 주문을 두 번 보내면 Google Ads가 매출을 두 번 배운다. 취소/환불을 추적하지 못하면 환불된 주문도 좋은 구매로 남는다.

그래서 실제 전송 전에 아래 세 가지가 필요하다.

1. 같은 주문을 같은 전환 액션에 한 번만 보내는 장부
2. 전송 전 payload와 전송 후 결과를 비교할 수 있는 safe ref
3. 취소/환불이 생겼을 때 다시 찾을 수 있는 연결 key

## 장부가 막아야 할 실수

1. 같은 주문을 재시도하다가 2번 전송
2. 같은 주문을 다른 worker가 동시에 전송
3. gclid와 gbraid가 같이 있을 때 식별자를 바꿔 중복 전송
4. Google Ads 응답 실패인지 성공인지 모르는 상태에서 무작정 재전송
5. 취소/환불 주문을 나중에 추적하지 못함

## 장부 row 설계

초기에는 VM Cloud SQLite에 별도 테이블을 두는 것이 가장 단순하다. 운영DB는 건드리지 않는다.

예상 테이블 이름:

```sql
google_ads_confirmed_purchase_upload_ledger
```

필드 초안:

- `id`: 내부 row id
- `safe_ref`: 원문 주문번호를 직접 노출하지 않는 안전 참조값
- `site`: `biocom`
- `conversion_action_id`: Google Ads 전환 액션 id
- `conversion_action_name`: 예: `BI confirmed_purchase_offline`
- `click_id_type`: `gclid`, `gbraid`, `wbraid` 중 하나
- `click_id_digest`: 원문 click id 해시. 원문 저장 금지
- `order_digest`: 원문 주문번호 해시. 원문 저장 금지
- `conversion_time_kst`: 실제 결제완료 시각
- `conversion_value_krw`: 실제 결제금액
- `currency_code`: `KRW`
- `payload_hash`: Google Ads 전송 payload의 canonical hash
- `dedupe_key`: 중복 방지 key
- `status`: `preview`, `ready`, `sent`, `failed`, `blocked`, `reversed`
- `block_reason`: 전송하지 않은 이유
- `sent_at`: 실제 Google Ads 전송 시각
- `google_ads_response_code`: Google Ads 응답 code
- `google_ads_request_id`: Google Ads 응답 request id
- `created_at`, `updated_at`

## 코드 직전 DDL 초안

아래 SQL은 바로 적용하지 않는다. 실제 적용은 별도 승인 후 VM Cloud SQLite에만 한다.

```sql
CREATE TABLE IF NOT EXISTS google_ads_confirmed_purchase_upload_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site TEXT NOT NULL,
  safe_ref TEXT NOT NULL,
  conversion_action_id TEXT NOT NULL,
  conversion_action_name TEXT NOT NULL,
  click_id_type TEXT NOT NULL,
  click_id_digest TEXT NOT NULL,
  order_digest TEXT NOT NULL,
  conversion_time_kst TEXT NOT NULL,
  conversion_value_krw INTEGER NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'KRW',
  payload_hash TEXT NOT NULL,
  dedupe_key_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  block_reason TEXT NOT NULL DEFAULT '',
  google_ads_request_id TEXT NOT NULL DEFAULT '',
  google_ads_response_code TEXT NOT NULL DEFAULT '',
  google_ads_response_hash TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT,
  last_error TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gads_confirmed_purchase_dedupe
ON google_ads_confirmed_purchase_upload_ledger (site, conversion_action_id, dedupe_key_hash);

CREATE INDEX IF NOT EXISTS idx_gads_confirmed_purchase_status
ON google_ads_confirmed_purchase_upload_ledger (status, created_at);

CREATE INDEX IF NOT EXISTS idx_gads_confirmed_purchase_order_digest
ON google_ads_confirmed_purchase_upload_ledger (order_digest);
```

## 코드 직전 함수 설계

실제 구현 시 함수는 세 단계로 나눈다.

1. `buildGoogleAdsConfirmedPurchaseLedgerDraft(candidate)`
   - private preview 후보 1건을 장부 row 초안으로 바꾼다.
   - 원문 주문번호와 원문 click id는 받더라도 row에는 digest만 넣는다.
   - 결과는 `status='preview'` 또는 `status='ready'`로만 만든다.

2. `upsertGoogleAdsConfirmedPurchaseUploadLedgerDraft(draft, { dryRun })`
   - `dryRun=true`면 지금처럼 응답만 만든다.
   - `dryRun=false`는 별도 승인 전까지 막는다.
   - unique index가 같은 dedupe key를 발견하면 새 row를 만들지 않고 `duplicate_blocked`로 반환한다.

3. `markGoogleAdsConfirmedPurchaseUploadResult(dedupeKeyHash, result)`
   - 실제 Google Ads 전송 후에만 쓴다.
   - 성공이면 `sent` 또는 `accepted`, 실패면 `failed`로 바꾼다.
   - Google Ads 응답 원문은 저장하지 않고 response hash와 request id만 저장한다.

## 쓰기 알고리즘

실제 write가 승인되면 아래 순서로만 움직인다.

```text
1. private preview 후보를 다시 만든다.
2. 후보마다 dedupe_key_hash와 payload_hash를 만든다.
3. 장부에 같은 dedupe_key_hash가 이미 있는지 본다.
4. 있으면 전송하지 않고 duplicate_blocked로 끝낸다.
5. 없으면 status=ready row를 먼저 쓴다.
6. Google Ads 전송 승인이 별도로 있으면 send_in_progress로 바꾼다.
7. Google Ads API 응답 후 sent/failed로 바꾼다.
8. 실패한 row는 자동 재전송하지 않는다. 재시도는 별도 승인과 reason이 필요하다.
```

중요한 점은 “Google Ads에 먼저 보내고 나중에 장부에 쓰는 방식”을 쓰지 않는 것이다. 먼저 장부에 ready row가 있어야 중복 전송을 막을 수 있다.

## live dry-run 결과

2026-05-26 21:12 KST 기준 VM Cloud에서 아래를 확인했다.

- private preview source order rows: 458
- actual purchase + exact gclid 후보: 2
- duplicate-ledger dry-run 후보: 2
- unique dedupe keys: 2
- duplicate dedupe keys: 0
- simulated replay rows: 2
- simulated replay blocked: 2
- duplicate ledger dry-run passed: true
- actual ledger ready for write: false
- Google Ads send ready: false
- Google Ads 전송: 0
- 운영DB write: 0
- VM Cloud write: 0
- raw order/click id 응답 노출: false

## write smoke plan API

VM Cloud에 아래 no-write API를 추가했다.

```text
GET /api/google-ads/confirmed-purchase/upload-ledger-write-smoke-plan
```

목적은 실제 SQLite에 쓰기 전에 “어떤 row를 `ready` 상태로 쓸지”를 원문값 없이 확인하는 것이다. 이 API는 테이블 생성이나 insert를 하지 않는다.

live smoke 결과는 아래와 같다.

- planned ready rows: 2
- duplicate rows blocked in plan: 0
- replay rows blocked: 2
- upload ledger prep: 100%
- actual ledger write ready: false
- Google Ads send ready: false
- Google Ads 전송: 0
- VM Cloud write: 0
- raw order/click id 응답 노출: false

## 후보 확대 read-only 결과

2026-05-26 21:41 KST 기준, VM Cloud no-write API로 최근 7일 실제 구매완료 주문을 다시 넓게 분류했다. raw 주문번호와 raw click id는 출력하지 않았다.

- 실제 구매완료 주문: 458건
- 실제 구매완료 매출: 109,080,402원
- 바로 1단계 후보가 될 수 있는 exact gclid 주문: 2건, 270,900원
- 실제 구매 중 전송 후보율: 0.4%
- gbraid/wbraid 단독 후보: 0건
- Google click id가 여러 종류 섞인 보류 후보: 2건
- 내부 bridge는 있으나 Google click id가 없는 후보: 345건
- 내부 bridge도 없는 실제 구매: 109건
- homepage 주문: 436건
- NPay 주문: 22건

해석은 명확하다. 실제 구매 주문 자체는 충분히 있지만, Google Ads에 직접 보낼 수 있는 click id가 붙은 주문은 아직 극히 적다. 그래서 Google Ads 주 전환을 시작하려면 1단계 exact gclid 2건으로 제한 smoke를 하되, 동시에 결제완료 단계의 click id 보존/bridge를 계속 늘려야 한다.

## write-smoke-final-실행안-2026-05-26-21-53

상세 실행안은 별도 문서에 둔다.

- 실행안 문서: [[google-ads-upload-ledger-write-smoke-final-20260526]]
- 다른 창 Codex 인수인계: [[google-ads-primary-conversion-handoff-20260526]]

final 실행안의 핵심은 아래다.

1. 승인 후에도 Google Ads 전송은 0건이다.
2. VM Cloud SQLite에 장부 테이블과 unique index만 만든다.
3. 후보 최대 2건만 `status='ready'`로 쓴다.
4. 같은 후보를 replay하면 2건 모두 duplicate로 막혀야 한다.
5. raw 주문번호와 raw click id는 응답/문서/대화에 출력하지 않는다.
6. 성공하면 실제 구매 전용 Google 주 전환 준비도를 88%에서 92%로 올린다.

## 후보율 0.4% 추가 병목 분해 2026-05-26 21:53

source: VM Cloud localhost order diagnostics aggregate
window: last_7d
freshness: 2026-05-26 21:53 KST
confidence: high for aggregate counts, raw row not exposed

최근 7일 실제 구매완료 458건 중 Google Ads에 바로 보낼 수 있는 주문은 2건이다.

- ready exact gclid: 2건 / 270,900원.
- mixed Google click id: 2건 / 485,000원.
- 내부 bridge는 있으나 Google click id 없음: 345건 / 99,800,828원.
- 내부 bridge도 없음: 109건 / 8,523,674원.
- homepage 실제 구매: 436건 / 106,061,902원.
- NPay 실제 구매: 22건 / 3,018,500원.

가장 큰 병목은 `내부 bridge는 있으나 Google click id 없음` 345건이다. 즉 실제 결제완료 기록과 주문은 붙지만, Google Ads에 보낼 gclid/gbraid/wbraid가 없다.

두 번째 병목은 `내부 bridge도 없음` 109건이다. 이 중 homepage가 87건, NPay가 22건이다. NPay는 외부 결제 완료 후 주문번호 bridge가 더 필요하다.

## 중복 방지 key

중복 방지 key는 아래 재료로 만든다.

```text
site
+ conversion_action_id
+ order_digest
+ click_id_type
+ conversion_time_kst date bucket
+ conversion_value_krw
```

원문 주문번호와 원문 click id는 key 안에 직접 넣지 않는다. 서버 내부에서만 해시를 만들고, 화면/문서에는 safe ref만 보여준다.

## 상태 흐름

```text
private_preview
→ ready_for_limited_send
→ sent
→ accepted_or_failed
→ refund_cancel_followup_needed
```

현재 위치는 `private_preview`다.

## 기존 82%였던 이유

현재 준비도 82%는 아래가 끝났다는 뜻이다.

- 실제 결제완료 주문만 고르는 기준이 있다.
- 원문 주문번호가 서버 내부에 있는지 확인한다.
- 원문 gclid가 서버 내부에 있는지 확인한다.
- 금액, 통화, 결제완료 시각, 취소/환불 guard를 확인한다.
- 응답에 원문값을 내보내지 않는 private preview가 있다.

## 현재 88%로 보는 이유

private preview만 있을 때는 82%였다. live duplicate-ledger dry-run 통과로 86%까지 올랐고, 이제 write smoke plan API와 후보 확대 API가 VM Cloud live no-write smoke를 통과하여 준비도를 88%로 본다.

다만 실제 구매 전용 주 전환을 100%로 보려면 아직 아래가 남아 있다.

- 실제 장부 write 승인과 schema 적용
- 최대 2건 제한 Google Ads 전송 승인
- 전송 후 Google Ads 화면/API 수신 확인
- 실패/중복/취소 발생 시 중단 기준 확인

## 100%까지 남은 것

### 1. 중복 전송 방지 장부 dry-run

- 상태: 완료.
- 확인 결과: 후보 2건이 서로 다른 dedupe key를 갖고, 같은 후보를 두 번 넣으면 모두 중복으로 표시된다.
- Lane: Green 완료.

### 2. 장부 write 승인안

- 해야 하는 일: VM Cloud SQLite에 장부 테이블을 만들거나 기존 테이블에 연결하는 승인안을 만든다.
- 성공 기준: 위 DDL, unique index, ready row 선저장, duplicate block, rollback, max row가 승인문에 들어간다.
- Lane: Yellow 또는 Red 판단 필요. 스키마/영구 write면 Red에 가깝게 본다.

### 3. 제한 전송 승인안

- 해야 하는 일: 후보 2건 이하를 실제 Google Ads에 보낼지 승인 문서를 만든다.
- 성공 기준: 후보, payload, 중복 key, 중단 기준, 전송 후 확인 화면이 모두 적힌다.
- Lane: Red

### 4. 전송 후 검증

- 해야 하는 일: Google Ads에서 전송 수신 여부, 중복 여부, conversion action별 반영 여부를 확인한다.
- 성공 기준: Google Ads에 새 실제 구매 전환이 들어왔고, 기존 NPay 버튼 클릭 전환과 분리되어 보인다.
- Lane: Red 실행 후 Green read-only 확인

### 5. 주 전환 판단

- 해야 하는 일: 실제 구매 전용 신호를 Secondary로 먼저 관찰한 뒤 Primary 전환으로 올릴지 결정한다.
- 성공 기준: 최소 며칠 동안 실제 결제완료 주문만 들어오고, 금액/건수/취소 guard가 맞는다.
- Lane: Red

## 현재 판정

- private preview: 100%
- duplicate-ledger dry-run: 100%
- write smoke plan API: VM Cloud live no-write smoke 통과
- 후보 확대 API: VM Cloud live no-write smoke 통과
- 실제 구매 전용 주 전환 준비도: 88%
- Google Ads 전송 실행 준비: 0%, 승인 전 실행 금지
- 중복 방지 장부: code-ready 설계 완료, write 미실행

## 다음 행동

1. VM Cloud SQLite에 장부 테이블을 만들지 말지 승인한다.
2. 승인되면 schema apply를 1회 실행하고, 후보 2건을 `ready` row로만 쓰는 제한 write smoke를 한다.
3. 그 다음 Google Ads 제한 전송 승인안을 실제 전송 직전 문서로 승격한다.
