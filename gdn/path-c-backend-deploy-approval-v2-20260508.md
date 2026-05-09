# Path C backend deploy 승인안 v2

작성 시각: 2026-05-08 17:38 KST
최종 업데이트: 2026-05-08 18:40 KST
대상: VM Cloud `seo-backend` + `paid_click_intent_ledger`
문서 성격: Yellow Lane 승인 판단 패킷. 본 문서 작성은 Green, 실행은 TJ님 승인 전 금지.
관련 문서: [[path-c-member-code-attribution-design-20260508]], [[path-c-attribution-rule-v2-20260508]], [[canary-effect-meaningful-dry-run-20260508]], [[../total/!total-current]]
Status: approval_packet_only / **backend deploy HOLD** — wrapper Preview only는 별도 YES, 본 문서는 deploy 승인 아님
Do not use for: 승인 없는 backend deploy, 운영 schema migration, GTM/Imweb publish, raw member_code 저장, platform send

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/gdn/README.md
    - harness/gdn/RULES.md
    - harness/gdn/VERIFY.md
    - gdn/path-c-member-code-attribution-design-20260508.md
  lane: Yellow approval packet
  allowed_actions_before_approval:
    - approval document writing
    - local code review/design
    - read-only schema/source check
  forbidden_actions_before_approval:
    - backend deploy
    - PM2 restart
    - production schema migration
    - paid_click_intent_ledger write outside existing canary
    - platform send
  source_window_freshness_confidence:
    source: "18.4h canary-effect dry-run + current Path C design"
    window: "2026-05-07 23:01~2026-05-08 17:23 KST"
    freshness: "read-only evidence generated 2026-05-08 17:23 KST"
    confidence: 0.9
```

## 한 줄 결론

Path C backend deploy는 **받을 준비를 만드는 Yellow 작업**이다. 지금 바로 승인하지 않는다. 실제 구매 매칭 개선 효과는 client wrapper가 `member_code_hash`를 채우고 24h+ 신규 row가 쌓인 뒤에만 가능하다.

## 0. 지금 HOLD인 이유

운영자가 승인 전에 추가로 봐야 할 자료가 남아 있다.

| 부족 자료 | 왜 필요한가 | 성공 기준 |
|---|---|---|
| 최종 code diff | 현재 로컬 code 계열에는 raw `member_code` 저장 경로가 섞여 있어 그대로 deploy하면 안 됨 | 저장 컬럼/응답/로그가 `member_code_hash` only |
| secret 생성/주입 절차 | HMAC secret 없이는 운영 hash가 재현 불가 | `PATH_C_MEMBER_CODE_HASH_SECRET` 생성 위치와 주입자가 명확 |
| TTL/cleanup 구현 | 90일 정책만 있고 삭제/만료 실행이 불명확하면 보관기간 통제가 안 됨 | `expires_at` 컬럼 + cleanup job/script 또는 기존 TTL sweep 연결 |
| raw logging proof | raw `member_code`가 request/error log에 남으면 안 됨 | request body logging 없음, error log masking smoke PASS |
| migration rollback | SQLite column drop이 단순하지 않음 | flag off + code rollback + incident cleanup 기준 명시 |
| smoke script | 사람이 수동으로 놓칠 수 있음 | flag OFF/ON smoke 명령이 스크립트화 |

## 1. TJ님이 실제로 승인하는 것

승인 화면/행동: 이 문서에 대해 채팅으로 `YES: Path C backend deploy v2 승인`이라고 명시한다.

바뀌는 운영 설정/코드:

- `paid_click_intent_ledger`에 `member_code_hash` 컬럼과 index를 추가한다.
- backend receiver가 raw `member_code`를 저장하지 않고 server secret으로 HMAC 처리한 `member_code_hash`만 저장할 수 있게 한다.
- `PATH_C_LOOKUP_ENABLED` flag로 lookup 동작을 끄고 켤 수 있게 한다.
- ConfirmedPurchasePrep no-send 후보 생성에서 `member_code_hash` lookup을 사용할 준비를 한다.

바꾸면 생기는 효과:

- 현재 없는 deterministic bridge를 만들 준비가 된다.
- client wrapper가 값을 보내기 시작하면 주문의 `member_code_hash`와 ledger의 `member_code_hash`를 같은 기준으로 조인할 수 있다.

안 바꾸면 남는 문제:

- 24h가 지나도 confirmed_purchase uplift는 계속 HOLD다.
- live ledger는 capture health 자료로만 쓸 수 있고 주문별 attribution에는 쓸 수 없다.

## 2. 승인 전제

| 항목 | 기준 |
|---|---|
| raw member_code 저장 | 금지 |
| raw member_code logging | 금지 |
| 저장값 | `member_code_hash` only |
| hash 방식 | `HMAC-SHA256(member_code, server_secret)` |
| secret 위치 | 운영 `.env` 또는 secret manager equivalent. git 저장 금지 |
| TTL | 90일. `expires_at` 유지 + cleanup 실행 방식 확정 필요 |
| 목적 제한 | attribution / confirmed_purchase no-send 후보 생성 |
| platform send | 0건 유지 |
| Google Ads/GA4/Meta send | 0건 유지 |

## 3. Deploy mode

### Mode A — backend deploy with flag OFF

권장 1단계.

- schema와 코드만 배포한다.
- `PATH_C_LOOKUP_ENABLED=false`
- receiver는 기존 click intent 저장을 유지하되, `member_code_hash`가 비어 있어도 정상.
- ConfirmedPurchasePrep는 Path C lookup을 실행하지 않는다.

성공 기준:

- `/health` 200.
- 기존 paid_click_intent smoke PASS.
- `member_code_hash` 컬럼 존재.
- 신규/기존 row 모두 raw member_code 없음.
- platform send 0.

### Mode B — backend deploy + lookup flag ON

권장 2단계. Mode A smoke 이후만.

- `PATH_C_LOOKUP_ENABLED=true`
- ConfirmedPurchasePrep no-send에서 `member_code_hash` lookup 가능.
- client wrapper가 아직 없으면 match는 0이어야 정상.

성공 기준:

- Path C match 0이어도 오류 없음.
- `missing_member_code_hash` / `empty_ledger_member_hash` 카운터가 설명 가능.
- send_candidate 0.

### Mode C — backend deploy + client wrapper Preview 연계

Production publish가 아니라 Preview와 연계한다.

- backend는 받을 준비 완료.
- GTM/Imweb은 Preview only.
- wrapper Preview에서 `member_code_hash` present 확인.

성공 기준:

- Preview 요청만 별도 식별 가능.
- raw member_code 저장 0.
- PII/value/order/payment 저장 0.

## 4. Schema migration

목표 schema:

```sql
ALTER TABLE paid_click_intent_ledger
  ADD COLUMN member_code_hash TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_pci_member_hash
  ON paid_click_intent_ledger(site, member_code_hash)
  WHERE member_code_hash != '';
```

TTL 구현안:

```sql
-- 기존 paid_click_intent_ledger expires_at 컬럼을 계속 사용한다.
-- member_code_hash row도 click_id와 동일하게 captured_at + 90일 만료다.
DELETE FROM paid_click_intent_ledger
WHERE expires_at < datetime('now');
```

운영 승인 전 확정할 것:

- 기존 cleanup job이 `paid_click_intent_ledger.expires_at`를 실제로 sweep하는지 확인한다.
- 없다면 `backend/scripts/paid-click-intent-ledger-cleanup.ts` 같은 cleanup script를 별도 Green 작성 후 Yellow cron 등록으로 분리한다.
- TTL cleanup은 schema deploy와 무기한 운영 write 승인 사이의 필수 blocker다.

영향:

- 기존 row는 `member_code_hash=''`.
- backward compatible.
- SQLite `ALTER ADD COLUMN`이므로 대규모 rewrite는 제한적이지만, 운영 backup 후 실행한다.

금지:

- raw `member_code` 컬럼 추가.
- raw request body 저장.
- order_number/payment_key/value/currency 저장.

## 5. Hash secret 관리

권장안:

```text
PATH_C_MEMBER_CODE_HASH_SECRET=<운영 전용 랜덤 secret>
PATH_C_LOOKUP_ENABLED=false
```

정책:

- secret은 git에 저장하지 않는다.
- backend 서버에서만 HMAC을 수행한다.
- wrapper Preview에서 client-side hash를 테스트하더라도 운영 기본은 server-side HMAC이다.
- secret rotation은 별도 승인안으로 분리한다. rotation 시 기존 90일 row와 호환 문제가 생긴다.

## 6. Backend smoke

### Flag OFF smoke

```text
1. /health 200
2. paid_click_intent positive gclid no-send 200
3. TEST/DEBUG/PREVIEW reject
4. oversized body 413
5. PII/value/order/payment payload reject
6. sqlite schema: member_code_hash column present
7. platform send 0
8. raw member_code grep: sqlite/log/stdout 모두 0
```

### Flag ON smoke

```text
1. PATH_C_LOOKUP_ENABLED=true 적용
2. member_code 포함 TEST 요청도 raw 저장 0
3. member_code_hash만 저장 또는 Preview dry-run 응답
4. lookupByMemberCodeHash empty-safe
5. ConfirmedPurchasePrep no-send 실행
6. send_candidate=0
7. platform send 0
8. error log에 raw request body/member_code 0
```

### Raw logging proof

승인 전 smoke에서 아래를 확인한다.

```text
1. controlled TEST member code를 사용한다.
2. no-send endpoint 응답에 raw member_code가 그대로 나오지 않는다.
3. sqlite에는 member_code_hash만 있고 raw member_code 컬럼/값이 없다.
4. PM2 stdout/stderr, backend error log, cloudflared log tail에 TEST member code 원문이 없다.
5. 실패하면 backend deploy는 즉시 HOLD다.
```

## 7. Rollback

즉시 rollback:

- `PATH_C_LOOKUP_ENABLED=false`
- 필요 시 `PAID_CLICK_INTENT_WRITE_ENABLED=false`
- PM2 restart `--update-env`

코드 rollback:

- deploy backup directory에서 `paidClickIntentLog.js`, `routes/attribution.js`, candidate-prep script 복원.
- PM2 restart.

Schema rollback:

- SQLite는 column drop이 단순하지 않으므로 기본 rollback은 flag off + 코드 rollback이다.
- incident가 raw/PII 저장이면 canary window row를 별도 approved cleanup 절차로 null/expire 처리한다.

## 8. Post-deploy audit

| 시간 | 확인 |
|---|---|
| T+0 | smoke 7종 |
| T+15min | 5xx, PM2 restart, ledger insert |
| T+1h | raw member_code 저장 0, member_code_hash count |
| T+24h | capture health + Path C lookup counters |

## 9. 승인 판단

승인 추천:

- Mode A만 먼저 승인: 추천 90%.
- Mode B는 Mode A smoke PASS 뒤 승인: 추천 78%.
- Mode C는 wrapper Preview 승인안과 묶어서 별도 판단: 추천 70%.

승인 보류 사유:

- raw member_code 저장이 필요하다는 요구가 나오면 HOLD.
- secret 관리 위치가 불명확하면 HOLD.
- rollback 책임자가 불명확하면 HOLD.

## 10. 계속 금지

- 운영 backend deploy: TJ님 승인 전 금지.
- 운영 schema migration: TJ님 승인 전 금지.
- GTM/Imweb Production publish: 본 문서 승인 범위 밖.
- GA4/Meta/Google Ads/TikTok/Naver 전송: 금지.
- Google Ads conversion action 변경/업로드: 금지.
- confirmed_purchase actual send: 금지.
