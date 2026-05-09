# 비회원 주문 attribution bridge 원장 설계

작성 시각: 2026-05-08 20:17 KST
대상: biocom guest/member order bridge ledger
Status: schema_design_draft_no_write
Do not use for: operational schema migration, DB write, backend deploy, raw PII/order/payment/value storage, platform send

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
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
    - gdn/path-b-order-confirm-beacon-design-20260508.md
    - gdn/path-c-member-code-source-discovery-20260508.md
  lane: Green schema design draft
  allowed_actions:
    - local schema design
    - no-write runbook/documentation
    - local markdown artifact creation
  forbidden_actions:
    - operational schema migration
    - local/VM/production DB write
    - backend deploy
    - raw email/phone/member_code/order/payment/value storage
    - GA4/Meta/Google Ads/TikTok/Naver send
  source_window_freshness_confidence:
    source: "Path B design + paid_click_intent ledger contract + local attribution/payment-success code inspection"
    window: "2026-05-08 KST"
    freshness: "2026-05-08 20:17 KST"
    confidence: 0.84
```

## 10초 결론

비회원 주문은 `member_code_hash`가 없으므로 Path C로는 못 붙는다.

비회원까지 보려면 `order_no_hash`와 브라우저 세션/클릭 hash를 담는 별도 bridge 원장이 필요하다. 이 원장은 구매 전송용이 아니라 “주문과 클릭을 안전하게 이어볼 수 있는 기록 장부”다. 원문 주문번호, 결제키, 이메일, 전화번호, 금액은 저장하지 않는다.

## 원장 이름 후보

추천 이름:

```text
order_bridge_ledger
```

대안:

```text
order_confirm_beacon_ledger
```

`order_bridge_ledger`를 추천한다. 이유는 browser thanks page beacon뿐 아니라 나중에 server/order API 기반 row도 같은 목적의 bridge로 받을 수 있기 때문이다.

## 설계 원칙

1. 주문 원문을 저장하지 않는다.
2. 결제키 원문을 저장하지 않는다.
3. 이메일/전화/이름/주소를 저장하지 않는다.
4. 금액/value/currency를 저장하지 않는다.
5. `member_code_hash`는 nullable이다. 비회원 row는 비어 있을 수 있다.
6. 보관기간은 90일이다.
7. 외부 플랫폼 전송은 0건이다.
8. confirmed purchase 후보 계산은 별도 dry-run에서만 한다.

## 최소 schema 초안

```sql
CREATE TABLE order_bridge_ledger (
  bridge_id TEXT PRIMARY KEY,
  site TEXT NOT NULL DEFAULT 'biocom',
  capture_stage TEXT NOT NULL,
  source TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  received_at TEXT NOT NULL,

  order_no_hash TEXT NOT NULL DEFAULT '',
  order_code_hash TEXT NOT NULL DEFAULT '',
  payment_key_hash TEXT NOT NULL DEFAULT '',
  hash_version TEXT NOT NULL DEFAULT 'hmac_sha256_v1',

  member_code_hash TEXT NOT NULL DEFAULT '',
  guest_hint INTEGER NOT NULL DEFAULT 0,

  client_id TEXT NOT NULL DEFAULT '',
  ga_session_id TEXT NOT NULL DEFAULT '',
  local_session_id_hash TEXT NOT NULL DEFAULT '',
  click_id_hash TEXT NOT NULL DEFAULT '',
  click_id_type TEXT NOT NULL DEFAULT '',

  pay_type TEXT NOT NULL DEFAULT '',
  pg_type TEXT NOT NULL DEFAULT '',
  landing_path TEXT NOT NULL DEFAULT '',
  allowed_query_json TEXT NOT NULL DEFAULT '{}',
  referrer_host TEXT NOT NULL DEFAULT '',

  raw_payload_guard_status TEXT NOT NULL DEFAULT 'not_stored',
  reject_reason TEXT NOT NULL DEFAULT '',
  dedupe_key TEXT NOT NULL,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'received',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_order_bridge_dedupe
  ON order_bridge_ledger(dedupe_key);

CREATE INDEX idx_order_bridge_order_hash
  ON order_bridge_ledger(site, order_no_hash)
  WHERE order_no_hash != '';

CREATE INDEX idx_order_bridge_session
  ON order_bridge_ledger(site, client_id, ga_session_id);

CREATE INDEX idx_order_bridge_local_session
  ON order_bridge_ledger(site, local_session_id_hash)
  WHERE local_session_id_hash != '';

CREATE INDEX idx_order_bridge_click_hash
  ON order_bridge_ledger(site, click_id_hash)
  WHERE click_id_hash != '';

CREATE INDEX idx_order_bridge_member_hash
  ON order_bridge_ledger(site, member_code_hash)
  WHERE member_code_hash != '';

CREATE INDEX idx_order_bridge_expires
  ON order_bridge_ledger(expires_at);
```

## 필드별 의미

| field | 쉬운 의미 | 저장 기준 |
|---|---|---|
| `order_no_hash` | 주문번호를 가린 주문 키 | 원문 금지, HMAC만 |
| `order_code_hash` | Imweb order_code를 가린 키 | 원문 금지, HMAC만 |
| `payment_key_hash` | 결제키를 가린 키 | 선택. 원문 금지 |
| `member_code_hash` | 회원이면 회원번호 hash | nullable. 비회원은 empty |
| `guest_hint` | 비회원 가능성 표시 | `member_code_hash` empty면 1 후보 |
| `client_id` | GA client id | 기존 attribution과 조인 후보 |
| `ga_session_id` | GA session id | 기존 attribution과 조인 후보 |
| `local_session_id_hash` | 사이트 내부 세션 hash | 원문 세션값 대신 HMAC |
| `click_id_hash` | paid click id hash | paid_click_intent ledger와 연결 후보 |
| `pay_type` | 결제수단 | allowlist |
| `pg_type` | PG/결제 채널 | allowlist |
| `expires_at` | TTL 삭제 기준 | 기본 90일 |

## 매칭 규칙 초안

### Confidence A

아래 중 하나를 만족하면 A 후보로 둔다.

- 같은 `order_no_hash`가 confirmed order dry-run source와 1:1로 맞는다.
- `order_no_hash` + `client_id` + `ga_session_id`가 같은 주문 window에서 유일하다.
- `member_code_hash`가 있고, paid_at 이전 last eligible paid click이 1개다.

### Confidence B

- `client_id` + `ga_session_id`는 맞지만 같은 window에 주문/클릭 후보가 여러 개다.
- `local_session_id_hash`로 붙지만 click 후보가 2개 이상이다.
- NPay return page row는 있으나 confirmed order hash와 cross-check가 아직 없다.

### Confidence C

- `click_id_hash`만 있고 order hash가 없다.
- order hash는 있으나 click/session key가 없다.
- 같은 주문에 후보가 많아 last eligible click만 임시 primary로 둔다.

### Confidence D

- order hash도 없고 session/click key도 약하다.
- 전송 후보가 아니라 원인 분석용이다.

## paid_click_intent와의 연결

`paid_click_intent_ledger`는 광고 클릭이 들어온 시점의 원장이다.

`order_bridge_ledger`는 결제완료 또는 주문 확인 시점의 원장이다.

둘은 아래 순서로 연결한다.

1. `click_id_hash` exact match.
2. 같은 `client_id + ga_session_id`.
3. 같은 `local_session_id_hash`.
4. `member_code_hash`가 있으면 Path C last eligible click 규칙 적용.
5. paid_at 이후 click은 제외.
6. 1d / 7d / 30d lookback을 분리 출력.
7. 후보가 2개 이상이면 `ambiguous=true`.

## TTL 90일 구현

권장:

```text
expires_at = captured_at + 90 days
cleanup job: DELETE FROM order_bridge_ledger WHERE expires_at < now
```

cleanup job은 운영 write이므로 별도 Yellow/Red 기준에서 실행한다. 이 문서는 schema 설계만 한다.

## Hard Fail

아래가 발견되면 설계 또는 Preview를 중단한다.

- raw `order_no`, `order_number`, `order_code`, `payment_key` 저장.
- raw email/phone/name/address 저장.
- value/currency 저장.
- raw request body 저장.
- GA4/Meta/Google Ads/TikTok/Naver 전송.
- GTM Production publish.
- 운영DB/VM schema migration.

## 결론

비회원 attribution bridge의 최소 원장은 `order_bridge_ledger`가 맞다.

단, 이번 단계에서 만든 것은 설계 초안이다. 실제 테이블 생성, 운영 endpoint, GTM publish는 하지 않는다.

## 다음 할일

1. Path B Preview 승인안에서 이 schema를 기준으로 `would_store=false` payload만 검증한다.
2. 실제 schema migration은 backend final diff, rollback, TTL cleanup, raw logging proof가 준비되기 전까지 HOLD한다.
3. NPay no-return 주문은 browser beacon만으로는 부족하므로 server/order API bridge와 함께 검토한다.
