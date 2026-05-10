# 다음 sprint helper signature plan (gpt0508-38 그린 follow-up)

작성 시각: 2026-05-11 01:51:00 KST
Lane: Green doc only / 다음 sprint 진입 시 Claude Code가 곧바로 코드 작성 시작 가능하도록 시그니처 고정
자신감: 90%

## 한 줄 결론

본 sprint(gpt0508-38)에서 R2 deploy + canary + paid_order_click_exact 분류기까지 끝났고, 다음 sprint는 “**operationalPaymentCompleteLookup**, **googleAdsClickViewExactLookup**, **cross_reference_evidence wire integration**” 3개 helper만 추가하면 ledger row가 자동으로 budget_usable 후보로 승급되는 구조가 닫히오. 본 문서는 그 3개 helper의 시그니처와 invariant를 미리 박아 두는 plan.

## 1. helper 1 — `operationalPaymentCompleteLookup`

**파일**: `backend/src/operationalPaymentCompleteLookup.ts` (신규)
**LOC 추정**: ~30
**Lane**: Green code

```ts
export type OperationalPaymentCompleteLookupResult =
  | { matched: true; payment_status: "PAYMENT_COMPLETE"; payment_method: string; payment_complete_at_iso: string | null }
  | { matched: true; payment_status: "REFUND_COMPLETE" | "CANCELLED_BEFORE_DEPOSIT" | "PAYMENT_PREPARATION" | "VIRTUAL_ACCOUNT_PENDING" | string; payment_method: string }
  | { matched: false; reason: "not_found" | "sync_lag_pending" | "database_unconfigured" };

export const lookupOperationalPaymentComplete = async (input: {
  /**
   * raw order_no (transient input only — hash 처리 즉시 변환되지 않음.
   * 호출자는 caller scope 안에서 raw 값을 즉시 폐기해야 함.
   * 응답에는 raw 가 절대 들어가지 않는다.)
   */
  orderNo: string;
  site?: "biocom";
}): Promise<OperationalPaymentCompleteLookupResult> => {
  // SELECT payment_status, payment_method, payment_complete_time
  // FROM public.tb_iamweb_users
  // WHERE order_number = $1 AND (cancellation_reason IS NULL OR ...)
  //   AND final_order_amount > 0
  // LIMIT 1
};
```

invariants:
- raw order_no 응답 노출 0
- raw email/phone/payment 응답 노출 0
- 운영DB write 0 (SELECT only)
- `payment_complete_at_iso`는 KST 변환된 ISO 문자열만 포함

---

## 2. helper 2 — `googleAdsClickViewExactLookup`

**파일**: `backend/src/googleAdsClickViewExactLookup.ts` (신규)
**LOC 추정**: ~40
**Lane**: Green code

```ts
export type GoogleAdsClickViewExactResult = {
  matched: boolean;
  click_id_type: "gclid" | "gbraid" | "wbraid" | null;
  campaign_id: string | null;
  campaign_name: string | null;
  click_view_logged_at_iso: string | null;
};

export const lookupGoogleAdsClickViewExact = async (input: {
  /** click_id_hash (HMAC) — raw click_id 입력 금지 */
  clickIdHash: string;
  /** 옵션: raw click_id 가 caller scope 에 있을 때 직접 click_view 조회 — caller 가 즉시 폐기 */
  rawClickIdTransient?: string;
  windowDays?: number; // default 30
}): Promise<GoogleAdsClickViewExactResult> => {
  // 우선 기존 join-candidates 산출 데이터에서 lookup 시도
  // 없으면 Google Ads click_view API 직접 단일 클릭 조회 (read-only)
};
```

invariants:
- raw click_id 응답 노출 0
- click_id_hash 만 받는 경로 우선 (rawClickIdTransient는 보강용)
- Google Ads API write 0 (read-only)
- send_candidate / actual_send_candidate / upload_candidate 영향 0

---

## 3. helper 3 — cross_reference_evidence wire integration

**파일**: `backend/src/routes/attribution.ts`의 `buildConfirmedPurchaseNoSendPreview`
**LOC 추정**: ~40 patch
**Lane**: Green code

핵심 분기:

```ts
const ledgerLookup = await attachLedgerLookup({
  order_no_hash: hashFromMaterial.order_no_hash,
  site,
});

const crossReferenceEvidence = classifyCrossReferenceEvidence({
  click_identifiers: clickIdentifiers,
  payment_method: paymentMethod,
  utm_campaign: utmCampaign,
  path_b_bridge_present: pathBBridgePresent,
  confirmed_paid_purchase: confirmedPaidPurchaseInput,
  ledger_lookup: ledgerLookup,
});
```

`attachLedgerLookup`은 본 sprint 작업 4 산출물의 pseudo-code 그대로:

1. `findOrderBridgeRowsByOrderHash(orderNoHash, site)` → ledger row[]
2. row가 있으면 `lookupOperationalPaymentComplete({ orderNo })` (caller가 raw orderNo 보유)
3. `lookupGoogleAdsClickViewExact({ clickIdHash: row.click_id_hash })`
4. `classifyLedgerRowToBudgetClassification({ ledger_row: row, payment_complete_join, click_view_exact })` → budget_usable 결정
5. `cross_reference_evidence`의 `ledger_lookup` 인자에 매핑

invariants:
- send_candidate / actual_send_candidate / upload_candidate 모두 false 유지
- raw email/phone/order/payment/member_code 응답 노출 0
- Google Ads upload 0

---

## 4. fixture 후속 plan

| fixture | scope |
|---|---|
| `operationalPaymentCompleteLookup PAYMENT_COMPLETE row → matched=true` | new |
| `operationalPaymentCompleteLookup REFUND_COMPLETE → matched=true status=REFUND_COMPLETE` | new |
| `operationalPaymentCompleteLookup not found → matched=false reason=not_found` | new |
| `googleAdsClickViewExactLookup gclid match → campaign_id present` | new |
| `googleAdsClickViewExactLookup no match → matched=false` | new |
| `cross_reference_evidence with ledger row + paid + click → category=A_via_ledger budget_usable=true` | new |
| `cross_reference_evidence with ledger row + unpaid → category G/upload_blocked budget_usable=false` | new |
| `cross_reference_evidence response no raw PII` | new |

총 8 fixture 추정.

## 5. 진입 의존성

- 본 sprint 작업 1 deploy PASS: ✅ 끝남
- 본 sprint 작업 2 canary verdict: 회수 시점에 결정 — PASS / PARTIAL / NO_TRAFFIC 모두 진입 가능 (FAIL만 진입 보류)
- 본 sprint 작업 3 분류기 helper: ✅ ready (7/7 PASS)
- 본 sprint 작업 4 lookup helper(`findOrderBridgeRowsByOrderHash`): ✅ ready

## 6. send/upload invariant 자체 점검 (다음 sprint 진입 직전)

- helper 3개 모두 read-only 또는 write_flag=false 유지 영역
- send_candidate / actual_send_candidate / upload_candidate 응답에 false / 0 항상 포함
- platform_send_count 변화 없음
- raw 저장 0
- Google Ads upload 0
- GTM publish 0

## 7. 운영DB 사전 시뮬레이션 (gpt0508-38 추가 audit, 02:00 KST)

회수 대기 동안 운영DB read-only로 paid_order_click_exact 승급 가능성 사전 측정.

### 7.1 PAYMENT_COMPLETE 30d 분포

| 항목 | 값 |
|---|---|
| 총 PAYMENT_COMPLETE 30d (cancel/return 빈값 + amount > 0) | 2,481건 |
| order_number 보유 | 100% |
| order_section_item_no(channel_order_no) 보유 | 100% |
| customer_email 보유 | 99.4% |
| customer_number(phone) 보유 | 100% |

### 7.2 payment_method 분포 (30d)

| payment_method | 건수 |
|---|---|
| CARD | 1,663 |
| SUBSCRIPTION | 446 |
| NAVERPAY_ORDER | 209 |
| VIRTUAL | 163 |

### 7.3 핵심 발견 — 운영DB에 gclid/utm/click 컬럼이 **없음**

```
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='tb_iamweb_users'
  AND column_name ILIKE '%gclid%' OR ILIKE '%click%' OR ILIKE '%utm%';
→ 0 rows
```

→ 운영DB는 PAYMENT_COMPLETE 상태만 알 수 있고, **광고 클릭 evidence(gclid/gbraid/wbraid)는 보존하지 않는다**. 이게 본 sprint R2 wire의 본질적 가치 — order_bridge_ledger가 hash-only로 click_id를 보존하는 **유일한 source**가 되오.

### 7.4 R2 wire 후 paid_order_click_exact 승급 추정

다음 sprint full wire 후 budget_usable 후보 = `R2 ledger row 중 (1) order_no_hash 매칭 가능 + (2) 운영DB PAYMENT_COMPLETE 매칭 + (3) click_id_hash가 Google Ads click_view exact에 매칭되는 row`. 1h 주간 트래픽 약 80~120건 결제완료 중 footer가 gclid를 정상 보내는 비율(추정 30~70%) × Google Ads click_view 30d 매칭률(추정 80%) ≈ **1h당 20~70건 후보**.

### 7.5 1h 일일 누적 추정 (200건 max_rows 안)

| 윈도우 | 추정 row 누적 |
|---|---|
| 1h 주간 canary | 20~70건 (max 200 한도 내) |
| 24h 운영 (write_flag=true 가정 시) | 200건 한도에 빠르게 도달 — 다음 sprint에서 retention rotation 또는 max_rows 증액 검토 |

본 사전 시뮬레이션은 다음 sprint identity 보강 + ledger_lookup wire 진입 후 실측치와 비교할 baseline.

## 8. Verdict

`PLAN_LOCKED_FOR_NEXT_SPRINT_3_HELPERS_8_FIXTURES_PRE_SIMULATION_DONE`
