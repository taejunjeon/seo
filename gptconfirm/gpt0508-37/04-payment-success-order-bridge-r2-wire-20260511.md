# R2 wire — payment-success → order_bridge_ledger 자동 기록 (gpt0508-37 작업4)

작성 시각: 2026-05-11 01:18:00 KST
실행 상태: code patch + typecheck PASS + fixture **6/6 PASS** (466ms)
자신감: 92%

## 한 줄 결론

`/api/attribution/payment-success` 핸들러가 결제완료 신호를 받을 때마다 자동으로 hash-only `order_bridge_ledger` row를 누적하는 R2 wire를 구현·검증 완료했소. **imweb footer/GTM 변경 0**, **raw email/phone/order 저장 0**, **send/upload 0** 모두 fixture로 invariant 보장. 운영 영향은 deploy 후에만 발생하므로 본 sprint는 코드 patch까지.

## 1. 무엇을 / 왜 / 어떻게

| 항목 | 값 |
|---|---|
| 무엇을 | `recordPaymentSuccessOrderBridgeLedger` helper를 `backend/src/routes/attribution.ts`에 export로 추가하고, payment-success 핸들러 안 `appendLedgerEntry` 직후 호출 |
| 왜 | gpt0508-36 정정 verdict가 `PATH_B_ENDPOINT_NOT_CALLED_BY_CHECKOUT_FLOW`였던 본질을 backend-only로 닫아, GTM/footer 미변경 + 운영 traffic 즉시 영향 0 |
| 어떻게 | 기존 `buildOrderBridgeIdentityHmacMaterial` + `recordOrderBridgeLedger`를 재사용. raw input은 transient로만 사용하고 hash-only 결과만 ledger에 저장 |
| 어디에서 | `backend/src/routes/attribution.ts:3211` 직후 helper 호출, helper 정의는 `findMarketingIntentPiiKey` 직전 |

## 2. 코드 변경

| 파일 | 변경 | LOC |
|---|---|---|
| `backend/src/routes/attribution.ts` | helper 추가 + payment-success 핸들러에서 호출 + 응답에 `orderBridgeR2` 필드 추가 | +130 |
| `backend/tests/payment-success-order-bridge-r2-wire.test.ts` | 신규 fixture (6 테스트) | +218 |

helper signature:
```ts
export const recordPaymentSuccessOrderBridgeLedger = (
  body: Record<string, unknown>,
  ledgerEntry: AttributionLedgerEntry,
): PaymentSuccessOrderBridgeR2Result => { ... }
```

응답 추가 필드 `orderBridgeR2`:
```ts
{
  attempted: boolean,
  write_flag_on: boolean,
  stored: boolean,
  deduped: boolean,
  rejected_reason: string | null,  // 'missing_order_key' | 'hash_secret_missing' | 'write_flag_disabled' | 'platform_send_flag_enabled' | 'raw_body_logging_enabled' | ledger reject reason
  status: string | null,            // 'session_only_quarantine' | 'identity_only_quarantine' | 'click_missing_hold' | 'full_bridge' | 'do_not_send'
  preview_hash_present: { email_hash, phone_hash, order_no_hash, click_id_hash, client_session },
  raw_echo_verified: true,
  send_candidate: false,
  actual_send_candidate: false,
  upload_candidate: false,
}
```

## 3. fixture 6 결과

| # | 시나리오 | 결과 |
|---|---|---|
| 1 | write_flag=true + order + click + session → ledger row +1 | PASS |
| 2 | identity 부재 시 session_only_quarantine 분류로도 row 누적 | PASS |
| 3 | write_flag=false → 저장 안 함 (`write_flag_disabled`) | PASS |
| 4 | order_no 부재 → `missing_order_key` 거부 | PASS |
| 5 | 응답/저장 row에서 raw email/phone/order 절대 echo 안 됨 (JSON.stringify 패턴 검사) | PASS |
| 6 | 5분 내 중복 payment-success → dedupe count 증가, row 1건 유지 | PASS |

총: **6/6 PASS, 466ms**.

## 4. invariant 검증 (fixture 안에서 직접 확인)

| invariant | 검증 |
|---|---|
| `send_candidate` / `actual_send_candidate` / `upload_candidate` | false / false / false (응답 객체에 직접 박힘) |
| `ORDER_BRIDGE_PLATFORM_SEND_ENABLED=true` 시 reject | `platform_send_flag_enabled` 반환 |
| `ORDER_BRIDGE_RAW_BODY_LOGGING=true` 시 reject | `raw_body_logging_enabled` 반환 |
| `ORDER_BRIDGE_WRITE_ENABLED=false` 시 reject | `write_flag_disabled` 반환 |
| `ORDER_BRIDGE_WRITE_MAX_ROWS=200` | `recordOrderBridgeLedger` 안에서 enforce |
| `ORDER_BRIDGE_WRITE_CANARY_UNTIL` | `recordOrderBridgeLedger` 안에서 enforce |
| raw email/phone/order in response | fixture 5에서 `JSON.stringify(result).includes(raw)` 0 검증 |
| raw 저장 in stored row | order_bridge_ledger 컬럼 자체가 hash-only |

## 5. 동작 시나리오 (deploy 후 expected)

| 입력 | 분류 | 결과 |
|---|---|---|
| order_no + gclid + session, email/phone 없음 (현 footer payload) | `session_only_quarantine` | row +1, budget 미사용 |
| order_no + email/phone + session + click (보강 후) | `full_bridge` | row +1, budget 후보 가능 (upload는 별도 Red) |
| order_no 없음 | reject | `missing_order_key` |
| write_flag=false | reject | `write_flag_disabled` |
| canary_until 지남 | reject | `canary_window_closed` |
| 5분 내 같은 dedupe key | dedupe | row 1 유지, `duplicate_dedupe_count++` |

## 6. live effect 예상 (deploy 후 30분~1h 윈도우)

| 신호 | 변화 |
|---|---|
| ledger `row_count` | payment-success 호출 1건당 +1 (status=session_only_quarantine 분포 큼) |
| `raw_stored_count` | 0 (변화 없음) |
| `platform_send_count` | 0 |
| `duplicate_dedupe_count` | 5분 내 중복 결제 신호 만큼 증가 |

## 7. 검증

| 항목 | 결과 |
|---|---|
| backend typecheck | PASS (`npx tsc --noEmit`) |
| backend fixture | **PASS 6/6** (`npx tsx --test tests/payment-success-order-bridge-r2-wire.test.ts`) |
| raw email/phone/order/payment/member_code 패턴 scan | PASS (0 hit) |
| 운영DB write | 0 (변경 없음) |
| 외부 전송 | 0 |

## 8. 다음 액션

### Claude Code가 할 일

1. (본 sprint 작업 5) deploy approval packet 작성 — 본 wire를 운영에 반영하는 절차 + canary 검증 + rollback
2. (다음 sprint) identity 보강 — payment-success 핸들러에서 운영DB read-only로 `tb_iamweb_users` 조회해 customer_email/customer_number를 hash material에 transient 추가 → status 승급 (session_only_quarantine → full_bridge)
3. (다음 sprint) cross_reference_evidence ledger_lookup wire — 누적 ledger row를 same-order match input으로 사용

### TJ님이 할 일

본 작업 자체에 추가 액션 없음. deploy 결정은 작업 5 packet 본 후.

## 9. Verdict

`PASS_PATCH_TYPECHECK_FIXTURE_DEPLOY_PENDING_TJ_YELLOW`

산출 JSON: `data/payment-success-order-bridge-r2-wire-20260511.json`
