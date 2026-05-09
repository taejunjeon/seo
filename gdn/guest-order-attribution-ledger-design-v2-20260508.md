# 비회원 주문 bridge 원장 설계 v2

작성 시각: 2026-05-08 20:38 KST
대상: biocom Path B order_bridge_ledger
Status: schema_design_v2__migration_preview_only
Do not use for: operational schema migration, raw PII storage, platform send

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
    - gdn/guest-order-attribution-ledger-design-20260508.md
    - gdn/path-b-email-phone-hash-bridge-approval-20260508.md
  lane: Green schema design; Yellow/Red approval required before migration
  allowed_actions:
    - local markdown schema design
    - migration preview writing
    - no-send/no-write planning
  forbidden_actions:
    - operational schema migration
    - backend deploy
    - raw email/phone/member_code storage
    - raw order/payment/value storage
    - platform send
  source_window_freshness_confidence:
    source: "existing Path B design + GTM read-only inventory + local backend code"
    window: "2026-05-08 KST"
    freshness: "2026-05-08 20:38 KST"
    confidence: 0.84
```

## 10초 결론

비회원 주문은 `member_code`가 없으므로 Path C만으로는 연결할 수 없다. Path B 원장은 주문번호 해시, 세션, 클릭 ID 해시, 이메일/전화 해시를 함께 저장하는 별도 장부로 가야 한다.

v2 설계의 핵심은 raw 값을 빼는 것이다. `email_hash`와 `phone_hash`는 저장할 수 있지만, raw email/phone/order/payment/value 필드는 만들지 않는다.

## v2에서 바뀐 점

- `email_hash` 추가.
- `phone_hash` 추가.
- `identity_hash_version` 추가.
- `identity_source` 추가.
- `member_code_hash`는 nullable/empty로 유지한다.
- dedupe 기준에 order/session/click/identity hash를 함께 반영한다.

## 저장 가능한 필드

```sql
CREATE TABLE IF NOT EXISTS order_bridge_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site TEXT NOT NULL,
  received_at TEXT NOT NULL,
  capture_stage TEXT NOT NULL,
  pay_type TEXT NOT NULL DEFAULT '',
  pg_type TEXT NOT NULL DEFAULT '',

  order_no_hash TEXT NOT NULL DEFAULT '',
  client_id TEXT NOT NULL DEFAULT '',
  ga_session_id TEXT NOT NULL DEFAULT '',
  local_session_id_hash TEXT NOT NULL DEFAULT '',
  click_id_hash TEXT NOT NULL DEFAULT '',

  member_code_hash TEXT NOT NULL DEFAULT '',
  email_hash TEXT NOT NULL DEFAULT '',
  phone_hash TEXT NOT NULL DEFAULT '',
  identity_hash_version TEXT NOT NULL DEFAULT 'hmac_sha256_identity_v1',
  identity_source TEXT NOT NULL DEFAULT 'none'
    CHECK (identity_source IN ('email', 'phone', 'both', 'none')),

  source_page TEXT NOT NULL DEFAULT '',
  debug_mode INTEGER NOT NULL DEFAULT 0,
  preview_mode INTEGER NOT NULL DEFAULT 0,
  would_store INTEGER NOT NULL DEFAULT 0,
  would_send INTEGER NOT NULL DEFAULT 0,
  no_platform_send_verified INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  raw_payload_stored INTEGER NOT NULL DEFAULT 0
);
```

## 금지 필드

아래 컬럼은 만들지 않는다.

```text
email
phone
member_code
order_number
order_no
payment_key
payment_id
buyer_name
address
value
currency
raw_payload
request_body
```

## index preview

```sql
CREATE INDEX IF NOT EXISTS idx_order_bridge_site_order_no_hash
  ON order_bridge_ledger(site, order_no_hash);

CREATE INDEX IF NOT EXISTS idx_order_bridge_site_email_hash
  ON order_bridge_ledger(site, email_hash);

CREATE INDEX IF NOT EXISTS idx_order_bridge_site_phone_hash
  ON order_bridge_ledger(site, phone_hash);

CREATE INDEX IF NOT EXISTS idx_order_bridge_site_click_id_hash
  ON order_bridge_ledger(site, click_id_hash);

CREATE INDEX IF NOT EXISTS idx_order_bridge_site_received_at
  ON order_bridge_ledger(site, received_at);

CREATE UNIQUE INDEX IF NOT EXISTS uq_order_bridge_dedupe_key
  ON order_bridge_ledger(site, dedupe_key);
```

## dedupe_key v2

dedupe key는 같은 주문/세션/클릭/identity 후보가 반복 저장되는 것을 막기 위한 키다.

```text
dedupe_key = sha256(
  site + '|' +
  capture_stage + '|' +
  order_no_hash + '|' +
  client_id + '|' +
  ga_session_id + '|' +
  local_session_id_hash + '|' +
  click_id_hash + '|' +
  member_code_hash + '|' +
  email_hash + '|' +
  phone_hash + '|' +
  received_at_5m_bucket
)
```

`received_at_5m_bucket`은 버튼 중복 클릭과 페이지 재시도를 줄이기 위한 보조 기준이다. 실제 결제완료 주문 단위 dedupe는 `order_no_hash`가 있으면 더 강하게 적용한다.

## migration preview only

기존 v1 원장이 이미 있다고 가정하면 보강 migration preview는 아래와 같다. 실제 실행은 금지다.

```sql
ALTER TABLE order_bridge_ledger ADD COLUMN email_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE order_bridge_ledger ADD COLUMN phone_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE order_bridge_ledger ADD COLUMN identity_hash_version TEXT NOT NULL DEFAULT 'hmac_sha256_identity_v1';
ALTER TABLE order_bridge_ledger ADD COLUMN identity_source TEXT NOT NULL DEFAULT 'none';

CREATE INDEX IF NOT EXISTS idx_order_bridge_site_email_hash
  ON order_bridge_ledger(site, email_hash);

CREATE INDEX IF NOT EXISTS idx_order_bridge_site_phone_hash
  ON order_bridge_ledger(site, phone_hash);
```

## rollback preview

SQLite는 컬럼 drop이 안전하지 않은 환경이 있을 수 있다. rollback은 우선 flag off로 한다.

1. `ORDER_BRIDGE_WRITE_ENABLED=false`.
2. receiver는 계속 no-send만 반환한다.
3. 새 index가 문제를 일으키면 승인 후 index drop.
4. 컬럼 제거는 별도 backup -> recreate table -> copy 검증 순서로만 한다.

## 운영 판단 기준

이 schema는 저장소 문서 설계다. 실제 VM Cloud SQLite 또는 backend DB에 적용하지 않았다.

운영 반영 전에는 반드시 backup, dry-run migration, flag off smoke, flag on smoke, raw stored scan, platform send 0 검증이 필요하다.
