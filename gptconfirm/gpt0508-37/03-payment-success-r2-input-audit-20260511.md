# payment-success R2 input audit (gpt0508-37 작업3)

작성 시각: 2026-05-11 01:08:00 KST
Lane: Green read-only audit
자신감: 91%

## 한 줄 결론

verdict: **`R2_READY_SESSION_ONLY`** — payment-success body 에 `order_no + client_id + ga_session_id + gclid` 가 다 있어 ledger row 누적은 가능하지만, **raw email/phone 이 없어 `session_only_quarantine` 분류로만 들어가고 budget floor 후보로 자동 승격되지는 않소**. 본 sprint R2 wire를 진행해 row 누적은 시작하고, full_bridge 승급은 다음 sprint에서 운영DB read-only로 customer_email/customer_number를 보강하는 작은 후속 patch로 풀면 깔끔하오.

## 1. 핸들러 위치

| 항목 | 값 |
|---|---|
| 엔드포인트 | `POST /api/attribution/payment-success` |
| 파일 | `backend/src/routes/attribution.ts:3180` |
| body 정규화 | `buildLedgerEntry → enrichPaymentSuccessFirstTouch` |
| dedupe | 5분 내 같은 `orderId` 호출은 skip |

## 2. `buildOrderBridgeIdentityHmacMaterial` 이 기대하는 input

| 카테고리 | 키 |
|---|---|
| 기본 | `site`, `capture_stage` |
| identity (raw, transient) | `email` / `ordererEmail` / `email_buy` / `buyerEmail`, `phone` / `ordererCall` / `phone_buy` / `buyerPhone` |
| order | `order_no` / `orderNo` / `order_number` / `orderNumber` |
| session | `client_id`, `ga_session_id`, `local_session_id` |
| click | `click_id` / `gclid` / `gbraid` / `wbraid` / `ttclid` / `nclick_id` |
| pay | `pay_type`, `pg_type` |

## 3. footer payment-success payload 실측 (`footer/biocomimwebcode.md` line 1955~)

| 필드 | 상태 | 비고 |
|---|---|---|
| `orderId` (== order_no) | ✅ PRESENT | URL/referrer/imwebSession/DOM 다중 fallback |
| `orderCode` | ✅ PRESENT | |
| `paymentKey` | ✅ PRESENT | |
| `client_id` | ✅ PRESENT | gtag/cookie fallback |
| `ga_session_id` | ✅ PRESENT | gtag/cookie fallback |
| `user_pseudo_id` | ✅ PRESENT | |
| `gclid` | ✅ PRESENT | tracking.gclid |
| `gbraid` / `wbraid` | ❌ ABSENT | footer 에 키 없음 |
| `ttclid`, `fbclid`, `fbc`, `fbp` | ✅ PRESENT | |
| `email` raw | ❌ ABSENT | payload 에 customer email 키 없음 |
| `phone` raw | ❌ ABSENT | payload 에 customer phone 키 없음 |
| `local_session_id` | ❌ ABSENT | `__seo_funnel_session` storage 키는 있으나 payload 직접 미적재 |

## 4. `classifyOrderBridgeLedgerStatus` 시뮬레이션

`hasOrder=true`, `hasIdentity=false` (email/phone hash 둘 다 빈 문자열), `hasSession=true` (clientId/gaSessionId), `hasClick=true (gclid 있을 때) / false (없을 때)`.

| 시나리오 | 분류 | budget_usable |
|---|---|---|
| order + click + session + ❌identity | **`session_only_quarantine`** | false |
| order + ❌click + session + ❌identity | **`session_only_quarantine`** | false |
| order + click + session + identity | full_bridge | true (별도 budget 후보) |
| ❌order | `do_not_send` | false |

**현재 footer payload는 모두 `session_only_quarantine` 으로만 분류**됨 — ledger row는 정상 누적되지만 budget floor에 자동 승격되지 않음.

## 5. R2_READY 등급 정의

| 등급 | 의미 |
|---|---|
| `R2_READY` | order + (email∣phone) + session + click 모두 있음. full_bridge. budget 후보 가능 (upload 별도 Red). |
| `R2_READY_IDENTITY_ONLY` | order + identity 있고 session/click 일부 부재. identity_only_quarantine. |
| **`R2_READY_SESSION_ONLY`** (이번 sprint) | order + session 있고 identity 부재. session_only_quarantine. row 누적 OK, budget 미사용. |
| `R2_BLOCKED_MISSING_ORDER_KEY` | order_no 부재 → ledger 거부 |
| `R2_BLOCKED_MISSING_CLICK_AND_IDENTITY` | click + identity 모두 부재 → 분류 무의미 |

## 6. 본 sprint R2 wire 진행 판단

진행 권장 — 이유:

- ledger row 누적이 시작되는 게 R2의 1차 목표. session_only_quarantine 도 row 자체는 쌓임.
- ledger row가 쌓이면 다음 sprint cross_reference_evidence의 ledger_lookup wire에서 same-order 매칭 후보로 사용 가능.
- budget floor 자동 승격은 본 sprint 정책상 어차피 막혀 있음(`upload_candidate_count==0` invariant).
- raw email/phone이 payload에 없는 게 오히려 “raw 저장 0” invariant 유지에 안전한 면도 있음.

## 7. 다음 sprint identity 보강 제안 (작은 patch)

- payment-success 핸들러에서 운영DB read-only로 `tb_iamweb_users WHERE order_number = orderId LIMIT 1` 조회 → `customer_email` / `customer_number`를 buildOrderBridgeIdentityHmacMaterial input에 transient 추가 (raw 저장 0).
- 효과: status가 `session_only_quarantine` → `full_bridge` 또는 `identity_only_quarantine`로 승급.
- Lane: Green code (read-only PG query 추가, ~40 LOC + fixture).
- 의존성: 본 sprint R2 wire 완료 + 운영DB sync lag 감안 (lag 9시간이면 최근 주문은 매칭 실패 가능).

## 8. fallback (R2 session-only로도 부족하다고 판단될 때)

GTM Custom HTML payload 에 hashed email/phone 추가 — Preview까지는 Yellow, Publish는 Red. 본 sprint에는 진입하지 않고 별도 sprint approval packet으로 분리.

## 9. 다음 액션

### Claude Code가 할 일
1. (본 sprint 작업 4) R2 wire 코드 + 6 fixture 작성 — `R2_READY_SESSION_ONLY` 범위에서 진행
2. (다음 sprint) identity 보강 patch — 운영DB read-only로 email/phone 보충

### TJ님이 할 일
- 본 audit에 추가 액션 없음. R2 deploy 결정은 작업 5 deploy approval packet 본 후.

## 10. Verdict

`R2_READY_SESSION_ONLY_PROCEED_WITH_WIRE`

산출 JSON: `data/payment-success-r2-input-audit-20260511.json`
