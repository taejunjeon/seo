# paid_click_intent minimal ledger schema contract

작성 시각: 2026-05-07 01:25 KST
기준일: 2026-05-07
상태: design / no-write
Owner: gdn / paid_click_intent
Depends on: [[paid-click-intent-minimal-ledger-write-approval-20260507]], [[../ontology/!ontology]], [[../total/!total-current]]
Do not use for: 운영 DB/ledger write 승인, Google Ads conversion upload, Google Ads 전환 액션 변경, GA4/Meta/Google Ads/TikTok/Naver 전송

```yaml
harness_preflight:
  lane: Green schema design
  allowed_actions:
    - schema contract 작성
    - migration 초안 작성
    - retention/dedupe/rollback 설계
  forbidden_actions:
    - 운영 DB/ledger write
    - migration apply
    - backend 운영 deploy
    - platform conversion send
  source_window_freshness_confidence:
    source: "no-write receiver route + ontology + Mode B publish result"
    window: "2026-05-06~2026-05-07 KST"
    freshness: "monitoring result pending"
    confidence: 0.84
```

## 10초 결론

이 문서는 `paid_click_intent`를 실제로 저장하기 전의 스키마 계약이다.

현재 no-write receiver는 `would_store=false`라 주문 원장과 연결할 row를 남기지 않는다. 24h/72h 모니터링이 안정적이면 다음 단계에서 최소 저장을 열 수 있는데, 그때 저장할 필드와 금지할 필드를 미리 고정한다.

## 저장 대상의 의미

`paid_click_intent`는 구매가 아니다.

```text
PaidClickIntent != Purchase
PaidClickIntent != ConfirmedPurchaseCandidate
PaidClickIntent -> later evidence for ConfirmedPurchaseCandidate
```

따라서 이 ledger에는 주문번호, 결제금액, 결제완료 시각을 저장하지 않는다. 결제완료 주문과의 연결은 별도 join 단계에서만 수행한다.

## 테이블 초안

실제 적용 전 DB 종류와 migration runner를 다시 확인한다. 아래는 계약용 DDL 초안이다.

```sql
CREATE TABLE paid_click_intent_ledger (
  intent_id TEXT PRIMARY KEY,
  site TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  platform_hint TEXT NOT NULL,
  capture_stage TEXT NOT NULL,
  click_id_type TEXT NOT NULL,
  click_id_value TEXT NOT NULL,
  click_id_hash TEXT NOT NULL,
  utm_source TEXT NOT NULL DEFAULT '',
  utm_medium TEXT NOT NULL DEFAULT '',
  utm_campaign TEXT NOT NULL DEFAULT '',
  utm_term TEXT NOT NULL DEFAULT '',
  utm_content TEXT NOT NULL DEFAULT '',
  landing_path TEXT NOT NULL DEFAULT '',
  allowed_query_json TEXT NOT NULL DEFAULT '{}',
  referrer_host TEXT NOT NULL DEFAULT '',
  client_id TEXT NOT NULL DEFAULT '',
  ga_session_id TEXT NOT NULL DEFAULT '',
  local_session_id TEXT NOT NULL DEFAULT '',
  user_agent_hash TEXT NOT NULL DEFAULT '',
  ip_hash TEXT NOT NULL DEFAULT '',
  dedupe_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  reject_reason TEXT NOT NULL DEFAULT '',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX paid_click_intent_dedupe_idx
ON paid_click_intent_ledger (dedupe_key);

CREATE INDEX paid_click_intent_click_hash_idx
ON paid_click_intent_ledger (click_id_hash);

CREATE INDEX paid_click_intent_session_idx
ON paid_click_intent_ledger (site, ga_session_id, local_session_id);

CREATE INDEX paid_click_intent_expires_idx
ON paid_click_intent_ledger (expires_at);
```

## 필드 계약

| 필드 | 필수 | 설명 |
|---|---:|---|
| `intent_id` | YES | UUID 또는 deterministic id |
| `site` | YES | 현재는 `biocom`만 |
| `captured_at` | YES | 브라우저 수집 시각 |
| `received_at` | YES | 서버 수신 시각 |
| `platform_hint` | YES | `google_ads` 우선 |
| `capture_stage` | YES | `landing`, `checkout_start`, `npay_intent` 등 |
| `click_id_type` | YES | `gclid`, `gbraid`, `wbraid` 중 하나 |
| `click_id_value` | YES | Google Ads matching용 원문. 접근 제한 |
| `click_id_hash` | YES | 검색/중복용 hash |
| `utm_*` | NO | campaign evidence |
| `landing_path` | NO | query 제거 path |
| `allowed_query_json` | NO | UTM/click id allowlist만 |
| `referrer_host` | NO | full URL 금지 |
| `client_id`, `ga_session_id`, `local_session_id` | NO | session join |
| `user_agent_hash`, `ip_hash` | NO | bot/dedupe 보조. raw 저장 금지 |
| `dedupe_key` | YES | 중복 저장 방지 |
| `status` | YES | `received`, `matched_to_checkout`, `matched_to_payment_complete_candidate`, `expired`, `rejected` |
| `expires_at` | YES | retention enforcement |

## 저장 금지

- raw request body.
- raw full URL query.
- raw referrer URL.
- 이름, 이메일, 전화번호, 주소.
- order_number, channel_order_no, payment_key.
- paid_at, value, currency.
- 카드/계좌/토큰/cookie.
- 건강 상태 또는 질병 추정값.

## dedupe key

```text
paid_click_intent:{site}:{click_id_type}:{click_id_hash}:{ga_session_id || local_session_id}:{landing_path}:{capture_stage}
```

동일 세션에서 같은 click id/path/stage가 반복되면 새 row를 만들지 않는다.

## Retention

| 데이터 | 보관기간 | 처리 |
|---|---:|---|
| `click_id_value` | 90일 | 만료 시 null/empty 또는 암호화 key rotation 기준 폐기 |
| `click_id_hash` | 180일 | 중복/품질 추세 비교 |
| session ids | 90일 | join window 종료 후 삭제/마스킹 |
| aggregate counters | 1년 | 원문 없는 통계 |
| TEST/DEBUG/PREVIEW row | 7일 이하 | live candidate 금지 |

## write flag

운영 적용 시 기본값은 off다.

```text
PAID_CLICK_INTENT_WRITE_ENABLED=false
PAID_CLICK_INTENT_WRITE_SAMPLE_RATE=1
PAID_CLICK_INTENT_RAW_LOGGING_ENABLED=false
```

승인 전에는 flag 이름만 설계하고 env 변경은 하지 않는다.

## write flow

```text
request -> validation guard -> reject forbidden fields -> sanitize URL -> hash click id -> dedupe -> insert minimal row -> response still would_send=false
```

중요:

- write가 켜져도 platform send는 계속 0건이다.
- write response는 `would_send=false`, `no_platform_send_verified=true`를 유지한다.
- `would_store=true`는 실제 write 단계에서만 허용된다. no-write 단계에서는 계속 false다.

## rollback

1. `PAID_CLICK_INTENT_WRITE_ENABLED=false`.
2. 신규 insert 중단.
3. 필요 시 `created_at >= incident_start` row status를 `rejected` 또는 `expired`로 변경.
4. raw payload logging이 발견되면 log retention/삭제 절차를 별도 실행.

## 승인 전 남은 질문

| 질문 | 현재 판단 |
|---|---|
| 운영 DB가 Postgres인지 SQLite인지 | VM 확인 필요 |
| encryption at rest를 DB에 맡길지 app-level encrypt를 쓸지 | 승인 전 결정 |
| click_id 원문 접근 권한자 | 최소화 필요 |
| 90일 후 삭제 job 위치 | backend cron 또는 운영 SQL job |
| no-write monitoring counter가 충분한지 | 24h/72h 결과로 판단 |

## 다음 단계

1. 24h/72h monitoring PASS 확인.
2. 이 schema contract 기준으로 Red 승인안 확정.
3. 승인 시 local/staging write smoke.
4. 운영 deploy는 flag off.
5. flag on은 별도 확인 후 제한 시간만 진행.
