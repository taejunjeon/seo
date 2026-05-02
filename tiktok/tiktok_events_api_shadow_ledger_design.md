# TikTok Events API Shadow Candidate Ledger Design

작성 시각: 2026-05-03 01:07 KST
Sprint name: TikTok Events API Shadow Candidate Ledger Design
Lane: Green Lane, 설계/문서 only
상태: 설계 완료. 2026-05-03 01:30 KST 기준 로컬 구현/테스트 완료. VM 배포, VM DB write, Events API send는 미실행.

## 10초 요약

이 설계는 TikTok Events API를 실제로 보내기 전에, “이 주문은 서버 이벤트로 보낼 수 있었는가”를 내부 원장에만 기록하는 장부를 만든다.

핵심 결론은 새 데이터를 기존 `attribution_ledger`에 섞지 않고, TJ 관리 Attribution VM SQLite에 `tiktok_events_api_shadow_candidates` 별도 테이블을 두는 것이다. 이 테이블은 `send_candidate=false`가 기본이며, TikTok으로 아무것도 보내지 않는다.

다음 행동은 Yellow Lane 승인 후 TJ 관리 Attribution VM에 shadow table을 배포해 최대 50건만 smoke write 하는 것이다.

## 1. 문서 목적

이 문서는 TikTok Events API production send 전 단계의 내부 검증 장부를 설계한다.

목적은 세 가지다.

1. TikTok Events API를 보내기 전에 중복 제거 준비가 됐는지 주문별로 본다.
2. pending 가상계좌, 취소, TikTok 근거 없음 같은 금지 케이스를 자동으로 막는다.
3. `/ads/tiktok`의 strict confirmed와 플랫폼 주장값 차이를 나중에 더 설명할 수 있게 만든다.

## 2. Lane 판정

| 작업 | Lane | 이번 문서에서 실행 여부 | 이유 |
|---|---|---|---|
| 설계 문서 작성 | Green | 실행 | no-send, no-write, no-deploy |
| 로컬 구현/테스트 | Green | 완료 | no-send, no-deploy, temp DB 테스트만 사용 |
| 로컬 개발 DB dry-run write | Green/Yellow 경계 | 미실행 | 로컬 DB라도 백업/dry-run/apply 절차 필요 |
| TJ 관리 Attribution VM table 생성 | Yellow | 미실행 | VM SQLite write/schema 영향 |
| TJ 관리 Attribution VM shadow row insert | Yellow | 미실행 | live 보조 원장 write |
| TikTok Test Events 호출 | Yellow | 미실행 | 외부 TikTok endpoint 호출 |
| TikTok production Events API send | Red | 금지 | 광고 전환값 영향 |

## 3. DB 위치

| 이름 | 위치 | 이번 설계에서의 역할 |
|---|---|---|
| 운영DB | 개발팀 관리 PostgreSQL `dashboard.public.tb_iamweb_users` | read-only 교차검산 후보. write 금지 |
| TJ 관리 Attribution VM | `att.ainativeos.net` 내부 SQLite `CRM_LOCAL_DB_PATH` | 최종 shadow candidate 저장 위치 |
| 로컬 개발 DB | `/Users/vibetj/coding/seo/backend/data/crm.sqlite3` | 구현/테스트용. 운영 데이터로 보지 않음 |

중요:
- “원장”이라고 말할 때 이 문서의 원장은 TJ 관리 Attribution VM SQLite의 보조 원장이다.
- 개발팀 관리 운영DB PostgreSQL은 주문 상태 검산 source이지, 이 작업의 저장 대상이 아니다.

## 4. 왜 별도 테이블인가

기존 `attribution_ledger`를 확장하지 않는 이유:

- `attribution_ledger`는 `marketing_intent`, `checkout_started`, `payment_success`, `form_submit` 중심의 공통 장부다.
- 여기에 `tiktok_events_api_shadow`를 새 touchpoint로 넣으면 firstTouch나 strict confirmed 집계가 오염될 수 있다.
- shadow candidate는 “광고 플랫폼으로 보낼 수 있었는지”를 검토하는 후보 장부이지, 사용자 행동 touchpoint가 아니다.
- 별도 테이블이면 `send_candidate=false`, `block_reason`, `dedup_ready` 같은 Events API 전용 필드를 명확히 둘 수 있다.

따라서 설계 기준은 아래다.

```text
attribution_ledger = 실제 유입/결제/폼 touchpoint 장부
tiktok_pixel_events = 브라우저 TikTok Pixel Guard 관측 로그
tiktok_events_api_shadow_candidates = TikTok Events API 전송 후보 검토 장부
```

## 5. 입력 데이터

### 5.1 Primary source

TJ 관리 Attribution VM SQLite:

| 테이블 | 용도 | 읽는 값 |
|---|---|---|
| `tiktok_pixel_events` | 브라우저 Pixel/Guard 관측 | `event_name`, `event_id`, `action`, `order_code`, `order_no`, `payment_code`, `decision_status`, `decision_branch`, `value`, `currency` |
| `attribution_ledger` | 결제/유입 근거 | `payment_success`, `marketing_intent`, `ttclid`, UTM, `metadata_json.firstTouch`, `payment_status` |

### 5.2 Cross-check source

운영DB PostgreSQL `dashboard.public.tb_iamweb_users`:

- read-only로만 사용한다.
- 주문 상태가 `PAYMENT_OVERDUE`, canceled, refunded인지 교차 확인할 때만 쓴다.
- shadow table에는 운영DB row 전체를 복사하지 않는다. 상태 요약과 source만 남긴다.

### 5.3 Not source

아래는 이 shadow 후보 원장의 primary source가 아니다.

- TikTok Ads Manager 플랫폼 구매값: order-level event_id export가 없으므로 후보 생성 기준으로 쓰지 않는다.
- GA4 purchase: cross-check에는 쓸 수 있지만, TikTok Events API 후보를 만들 primary 근거로 쓰지 않는다.
- `marketing_intent` 단독 row: 클릭 intent일 뿐 purchase event가 아니므로 server purchase 후보가 아니다.

## 6. 후보 생성 범위

v1 범위는 `Purchase`만이다.

| 이벤트 | v1 후보 생성 | 이유 |
|---|---|---|
| `Purchase` | YES | confirmed 결제와 직접 연결되는 유일한 하단 퍼널 이벤트 |
| `InitiateCheckout` | NO | browser event_id capture가 아직 부족 |
| `AddPaymentInfo` | NO | 현재 발화 확인 없음 |
| `PlaceAnOrder` | NO, block audit만 | soft-deprecated이고 pending Guard의 낮춤 이벤트 |
| `marketing_intent` | NO | TikTok 이벤트가 아니라 내부 클릭 흔적 |

## 7. 후보 판단 규칙

### 7.1 Eligible Shadow Candidate

아래를 모두 만족하면 `eligible_for_future_send=true`로 기록한다.

1. site가 `biocom`이다.
2. event name이 `Purchase`다.
3. order_code가 있다.
4. 결제 상태가 `confirmed`다.
5. TikTok evidence가 있다.
6. server event_id 후보가 `Purchase_{order_code}`로 만들어진다.
7. browser final event_id가 관측 또는 계산 가능하다.
8. raw PII가 payload preview에 없다.
9. production send kill switch가 off다.

그래도 `send_candidate=false`로 저장한다.

이유:
- shadow mode는 “보낼 수 있었는지”만 보는 장부다.
- 실제 TikTok send는 Red Lane 승인 전까지 금지다.

### 7.2 Block Candidate

아래 중 하나라도 해당하면 `eligible_for_future_send=false`다.

| 조건 | block_reason |
|---|---|
| 결제 상태가 confirmed 아님 | `not_confirmed` |
| pending 가상계좌 | `pending_virtual_account` |
| 자동취소/기한초과/취소 | `canceled_or_overdue` |
| TikTok evidence 없음 | `no_tiktok_evidence` |
| order_code 없음 | `missing_order_code` |
| browser final event_id 계산 불가 | `missing_browser_event_id` |
| server event name과 browser event name 불일치 | `event_name_mismatch` |
| pixel code 불일치 | `pixel_code_mismatch` |
| raw PII 감지 | `pii_detected` |
| 중복 후보 | `duplicate_shadow_candidate` |
| Test Events code가 production env에 존재 | `test_event_code_present_in_production_env` |

## 8. Canonical Event ID

브라우저 관측과 서버 후보를 분리한다.

| 값 | 예시 | 의미 |
|---|---|---|
| `raw_order_code` | `o20260502c0c1ce5d28e95` | 아임웹 order_code |
| `guard_raw_event_id` | `o20260502c0c1ce5d28e95` | Guard가 intercept 시점에 본 raw eventId |
| `browser_event_id_observed` | `Purchase_o20260502c0c1ce5d28e95` | Pixel Helper 최종값 또는 계산값 |
| `server_event_id_candidate` | `Purchase_o20260502c0c1ce5d28e95` | 서버가 나중에 보내야 dedup 가능한 후보값 |

생성 규칙:

```ts
const buildServerEventIdCandidate = (eventName: string, orderCode: string) =>
  `${eventName}_${orderCode}`;
```

금지:

```text
event_name=Purchase
event_id=o20260502c0c1ce5d28e95
```

위 값은 VM raw event_id로는 맞지만 TikTok dedup 최종 event_id로는 부족하다.

## 9. Schema Design

저장 테이블:

```text
TJ 관리 Attribution VM SQLite CRM_LOCAL_DB_PATH#tiktok_events_api_shadow_candidates
```

DDL 초안:

```sql
CREATE TABLE IF NOT EXISTS tiktok_events_api_shadow_candidates (
  candidate_id TEXT PRIMARY KEY,
  site TEXT NOT NULL DEFAULT 'biocom',
  source_system TEXT NOT NULL DEFAULT 'tj_attribution_vm',
  candidate_version TEXT NOT NULL DEFAULT '2026-05-03.shadow.v1',
  evaluation_mode TEXT NOT NULL DEFAULT 'shadow_only',
  send_candidate INTEGER NOT NULL DEFAULT 0,
  eligible_for_future_send INTEGER NOT NULL DEFAULT 0,
  platform_send_status TEXT NOT NULL DEFAULT 'not_sent',

  event_name TEXT NOT NULL DEFAULT '',
  browser_event_name TEXT NOT NULL DEFAULT '',
  pixel_code TEXT NOT NULL DEFAULT '',
  raw_order_code TEXT NOT NULL DEFAULT '',
  guard_raw_event_id TEXT NOT NULL DEFAULT '',
  browser_event_id_observed TEXT NOT NULL DEFAULT '',
  browser_event_id_source TEXT NOT NULL DEFAULT '',
  server_event_id_candidate TEXT NOT NULL DEFAULT '',
  dedup_ready INTEGER NOT NULL DEFAULT 0,
  dedup_block_reason TEXT NOT NULL DEFAULT '',

  order_code TEXT NOT NULL DEFAULT '',
  order_no TEXT NOT NULL DEFAULT '',
  order_id TEXT NOT NULL DEFAULT '',
  payment_code TEXT NOT NULL DEFAULT '',
  payment_key_present INTEGER NOT NULL DEFAULT 0,
  value REAL,
  currency TEXT NOT NULL DEFAULT 'KRW',

  payment_status TEXT NOT NULL DEFAULT '',
  payment_status_source TEXT NOT NULL DEFAULT '',
  payment_decision_branch TEXT NOT NULL DEFAULT '',
  payment_decision_reason TEXT NOT NULL DEFAULT '',
  payment_decision_matched_by TEXT NOT NULL DEFAULT '',

  tiktok_evidence_present INTEGER NOT NULL DEFAULT 0,
  tiktok_evidence_type TEXT NOT NULL DEFAULT '',
  has_ttclid INTEGER NOT NULL DEFAULT 0,
  utm_source TEXT NOT NULL DEFAULT '',
  utm_medium TEXT NOT NULL DEFAULT '',
  utm_campaign TEXT NOT NULL DEFAULT '',
  utm_content TEXT NOT NULL DEFAULT '',
  referrer_host TEXT NOT NULL DEFAULT '',

  pii_in_payload INTEGER NOT NULL DEFAULT 0,
  block_reasons_json TEXT NOT NULL DEFAULT '[]',
  payload_preview_json TEXT NOT NULL DEFAULT '{}',
  source_refs_json TEXT NOT NULL DEFAULT '{}',
  metadata_json TEXT NOT NULL DEFAULT '{}',

  first_observed_at TEXT NOT NULL DEFAULT '',
  last_evaluated_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tiktok_events_api_shadow_candidate
  ON tiktok_events_api_shadow_candidates(site, event_name, server_event_id_candidate);

CREATE INDEX IF NOT EXISTS idx_tiktok_events_api_shadow_order_code
  ON tiktok_events_api_shadow_candidates(order_code);

CREATE INDEX IF NOT EXISTS idx_tiktok_events_api_shadow_order_no
  ON tiktok_events_api_shadow_candidates(order_no);

CREATE INDEX IF NOT EXISTS idx_tiktok_events_api_shadow_eligible
  ON tiktok_events_api_shadow_candidates(eligible_for_future_send);

CREATE INDEX IF NOT EXISTS idx_tiktok_events_api_shadow_evaluated_at
  ON tiktok_events_api_shadow_candidates(last_evaluated_at DESC);
```

## 10. Candidate ID

`candidate_id`는 아래 값을 SHA-256으로 만든다.

```text
site
event_name
server_event_id_candidate
order_code
order_no
payment_code
candidate_version
```

이유:
- 같은 주문의 같은 TikTok server event 후보가 중복 저장되지 않는다.
- 후보 로직 버전이 바뀌면 새 후보와 비교할 수 있다.

## 11. Payload Preview

`payload_preview_json`은 실제 TikTok으로 보내는 payload가 아니다.

목적:
- 나중에 Test Events only 승인 시 어떤 payload가 만들어질지 미리 본다.
- raw PII가 섞였는지 검사한다.
- dedup event_id가 맞는지 본다.

예시:

```json
{
  "pixel_code": "D5G8FTBC77UAODHQ0KOG",
  "event": "Purchase",
  "event_id": "Purchase_o20260502c0c1ce5d28e95",
  "timestamp_source": "payment_success.logged_at",
  "properties": {
    "currency": "KRW",
    "value": 11900,
    "content_type": "product",
    "order_id": "202605035698347-P1"
  },
  "context_preview": {
    "has_ttp": true,
    "has_ttclid": true,
    "has_user_agent": false,
    "has_ip": false,
    "raw_pii_included": false
  },
  "send_mode": "shadow_only",
  "send_candidate": false
}
```

금지:
- raw email
- raw phone
- name
- address
- order memo
- full IP address
- raw user agent 장기 저장

v1에서는 IP/user agent를 영구 저장하지 않는다. TikTok Test Events 단계에서 필요하면 별도 Yellow 승인으로 일시 사용만 검토한다.

## 12. Source Refs

`source_refs_json`에는 후보 판단에 쓴 row 위치만 남긴다.

예시:

```json
{
  "tiktok_pixel_events": {
    "event_log_id": "sha256...",
    "action": "released_confirmed_purchase",
    "event_id": "o20260502c0c1ce5d28e95"
  },
  "attribution_ledger_payment_success": {
    "entry_id": "sha256...",
    "touchpoint": "payment_success",
    "payment_status": "confirmed"
  },
  "attribution_ledger_marketing_intent": {
    "entry_id": "sha256...",
    "touchpoint": "marketing_intent",
    "match_window_days": 7
  },
  "operating_db_crosscheck": {
    "used": false,
    "table": "dashboard.public.tb_iamweb_users",
    "write": false
  }
}
```

## 13. State Machine

```text
observed
  -> evaluated_blocked
  -> eligible_shadow
  -> test_events_ready
  -> production_ready
```

상태 의미:

| 상태 | 의미 | 자동 승격 여부 |
|---|---|---|
| `observed` | raw source를 봤지만 판단 전 | 가능 |
| `evaluated_blocked` | 금지 사유가 있어 막힘 | 가능 |
| `eligible_shadow` | 보낼 수 있을 것 같지만 아직 내부 장부에만 기록 | 가능 |
| `test_events_ready` | Test Events only 승인 후보 | 자동 승격 금지 |
| `production_ready` | Red Lane 승인 후보 | 자동 승격 금지 |

중요:
- `eligible_shadow`가 되어도 TikTok으로 보내지 않는다.
- `test_events_ready`와 `production_ready`는 문서상 판단일 뿐 자동 실행 상태가 아니다.

## 14. Evaluation Algorithm

v1 알고리즘:

```text
1. tiktok_pixel_events에서 최근 N일 Purchase 관련 row를 읽는다.
2. order_code/order_no/payment_code 기준으로 같은 주문의 최신 action을 묶는다.
3. action이 blocked_pending_purchase 또는 sent_replacement_place_an_order면 block.
4. action이 released_confirmed_purchase면 payment_success와 연결을 시도한다.
5. payment_success가 confirmed가 아니면 block.
6. ttclid, TikTok UTM, TikTok referrer, firstTouch marketing_intent 중 하나가 없으면 block.
7. server_event_id_candidate = Purchase_{order_code} 생성.
8. browser_event_id_observed를 관측값 또는 Imweb wrapper 규칙으로 계산.
9. event name/id/pixel code가 맞으면 dedup_ready=true.
10. payload_preview_json을 만든다.
11. send_candidate=false로 shadow table에 upsert한다.
```

## 15. Read API Design

읽기 API 후보:

```text
GET /api/ads/tiktok/events-api-shadow
```

용도:
- `/ads/tiktok` 화면 또는 내부 점검에서 shadow 후보 수를 본다.

응답 초안:

```json
{
  "site": "biocom",
  "windowDays": 7,
  "storage": "TJ Attribution VM SQLite CRM_LOCAL_DB_PATH#tiktok_events_api_shadow_candidates",
  "summary": {
    "totalCandidates": 42,
    "eligibleForFutureSend": 5,
    "blocked": 37,
    "sendCandidateTrue": 0,
    "platformSent": 0
  },
  "blockReasons": [
    { "reason": "no_tiktok_evidence", "count": 18 },
    { "reason": "pending_virtual_account", "count": 12 },
    { "reason": "canceled_or_overdue", "count": 7 }
  ]
}
```

보안:
- read-only endpoint다.
- payload preview 전체를 기본 응답에 포함하지 않는다.
- 필요 시 order_code 단건 조회만 제공한다.

## 16. Write Path Design

v1은 public receiver를 만들지 않는다.

권장 write 방식:

```text
backend/scripts/tiktok-events-api-shadow-candidates.ts
```

실행 모드:

| 모드 | 설명 | Lane |
|---|---|---|
| `--dry-run` | 후보 계산만 출력, DB write 없음 | Green |
| `--apply --limit 50` | TJ 관리 Attribution VM SQLite에 최대 50건 write | Yellow |
| `--rebuild --window-days 7` | 최근 7일 후보 재계산 | Yellow |

왜 CLI script인가:
- public POST endpoint를 만들면 외부에서 shadow row insert를 유발할 수 있다.
- 초기에는 운영자 통제하에 한 번씩 실행하는 편이 안전하다.
- 나중에 7일 이상 안정화되면 disabled-by-default background job을 검토한다.

## 17. Local Implementation Plan

Green Lane으로 먼저 할 수 있는 일:

1. `backend/src/tiktokEventsApiShadowCandidates.ts` 작성
2. `backend/scripts/tiktok-events-api-shadow-candidates.ts` 작성
3. 로컬 개발 DB 또는 fixture 기반 dry-run 테스트
4. `send_candidate=false` hard assertion 추가
5. `platform_send_status='not_sent'` hard assertion 추가
6. unit test 작성
7. docs 업데이트

로컬 테스트에서 확인할 것:

| 테스트 | 기대 |
|---|---|
| confirmed + TikTok evidence + order_code | eligible shadow 후보 생성 |
| confirmed + no TikTok evidence | `no_tiktok_evidence` block |
| pending virtual account | `pending_virtual_account` block |
| canceled/overdue | `canceled_or_overdue` block |
| raw event_id만 있는 Purchase | server id `Purchase_{order_code}` 계산 |
| PII 포함 payload | `pii_detected` block |
| duplicate event | insert/update 중복 방지 |

2026-05-03 01:30 KST 로컬 구현 상태:

| 항목 | 상태 | 파일 |
|---|---|---|
| shadow candidate builder | 완료 | `backend/src/tiktokEventsApiShadowCandidates.ts` |
| dry-run/apply CLI | 완료 | `backend/scripts/tiktok-events-api-shadow-candidates.ts` |
| fixture/unit test | 완료 | `backend/tests/tiktok-events-api-shadow-candidates.test.ts` |
| local dry-run | 완료, 후보 0건 | `npx tsx scripts/tiktok-events-api-shadow-candidates.ts --window-days 7 --limit 20 --json` |

검증 결과:

| 검증 | 결과 |
|---|---|
| `npm --prefix backend run typecheck` | 통과 |
| `cd backend && node --import tsx --test tests/tiktok-events-api-shadow-candidates.test.ts` | 5/5 통과 |
| local dry-run | 통과, `writtenRows=0`, `noPlatformSend=true`, `noOperatingDbWrite=true` |

## 18. VM Deployment Plan

Yellow Lane 승인 후만 진행한다.

배포 순서:

1. TJ 관리 Attribution VM 현재 SQLite 백업
2. 관련 코드 배포
3. `--dry-run --window-days 7` 실행
4. dry-run 결과에서 `send_candidate_true=0` 확인
5. `--apply --limit 50`로 최대 50건 shadow row write
6. row count와 block reason 분포 확인
7. `/api/ads/tiktok/events-api-shadow` read-only 조회 확인
8. 결과 문서 작성

## 19. Hard Fail

아래가 하나라도 나오면 즉시 중단한다.

- `send_candidate=true` row 생성
- `platform_send_status`가 `not_sent`가 아님
- TikTok Events API endpoint 호출 발생
- `test_event_code`가 production env에 남아 있음
- 운영DB PostgreSQL write 발생
- pending 가상계좌가 eligible로 분류됨
- TikTok evidence 없는 confirmed order가 eligible로 분류됨
- `event_id=o...`가 server candidate로 저장됨
- raw PII가 payload preview에 저장됨

## 20. Success Criteria

설계 기준 성공:

- shadow table이 기존 `attribution_ledger`를 오염시키지 않는다.
- 모든 row는 `send_candidate=false`다.
- dedup 후보 `Purchase_{order_code}`가 명확히 저장된다.
- pending/canceled/no-evidence가 block reason으로 설명된다.
- TJ 관리 Attribution VM과 운영DB 위치가 문서에서 분리된다.

구현 기준 성공:

- dry-run은 DB write 없이 후보 수와 block reason을 출력한다.
- apply는 최대 limit 안에서만 TJ 관리 Attribution VM SQLite에 쓴다.
- `/ads/tiktok` 화면은 strict confirmed와 shadow eligible을 분리해서 보여준다.
- production Events API send는 계속 0건이다.

## 21. Rollback

shadow table은 TikTok으로 아무것도 보내지 않으므로 rollback은 내부 원장 복구 중심이다.

Rollback 방법:

1. 배포 전 SQLite 백업으로 복구
2. 또는 `DROP TABLE tiktok_events_api_shadow_candidates`
3. 또는 `DELETE FROM tiktok_events_api_shadow_candidates WHERE candidate_version='2026-05-03.shadow.v1'`
4. PM2 restart가 있었다면 이전 backend artifact로 복구

금지:
- rollback 과정에서 운영DB PostgreSQL을 수정하지 않는다.
- TikTok API send로 보정하지 않는다.

## 22. Approval Gate

다음 sprint 승인 이름:

```text
TikTok Events API Shadow Candidate Ledger Local Implementation + VM Dry Run
```

승인 전 Codex가 할 수 있는 것:
- 로컬 코드 구현
- 로컬 fixture 테스트
- dry-run 출력 설계
- 승인 문서 작성

2026-05-03 01:30 KST 기준 위 네 가지는 완료됐다.

승인 필요:
- TJ 관리 Attribution VM 배포
- TJ 관리 Attribution VM SQLite table 생성
- TJ 관리 Attribution VM SQLite shadow row write

계속 금지:
- TikTok Events API production send
- TikTok Test Events send
- GTM publish 변경
- Purchase Guard 변경
- 운영DB PostgreSQL write
- firstTouch strict 승격

## 23. Auditor Verdict

Auditor verdict: PASS_WITH_NOTES

Project: TikTok ROAS 정합성
Phase: Events API feasibility 다음 단계
Lane: Green
Mode: design only

No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES

Notes:
- 설계상 가장 안전한 선택은 별도 shadow table이다.
- production send는 아직 Red Lane이다.
- 다른 에이전트 검증은 production send 승인 전에는 권장하지만, 이번 설계/로컬 구현 단계에서는 필수는 아니다.
