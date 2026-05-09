# Path C — paid_click_intent_ledger.member_code_hash 매개 attribution 설계

작성 시각: 2026-05-08 13:10 KST
최종 업데이트: 2026-05-08 17:38 KST
대상: paid_click_intent canary 회원 결제 attribution chain
문서 성격: Green Lane 설계 (구현 전). schema/wrapper 변경은 별 Yellow 승인.
관련 정본: [[../data/!channelfunnel]], [[ga4-path-a-attribution-limit-20260508]], [[paid-click-intent-minimal-ledger-schema-contract-20260507]]
관련 데이터: [[../data/path-c-member-code-dry-run-20260508]], [[canary-effect-meaningful-dry-run-20260508]]
Status: 설계 단계. **Yellow 승인 HOLD — v2 승인안 보강 전 운영 deploy / wrapper publish 금지**.
Do not use for: schema migration 운영 적용, 클라이언트 wrapper 운영 변경, 광고 변경

## 5줄 결론

1. **Path C = member_code_hash 매개 chain**: imweb_orders.member_code를 server secret으로 HMAC 처리한 값 ↔ paid_click_intent_ledger.member_code_hash join. 단, **60~80%는 실측 uplift가 아니라 bridge가 채워졌을 때의 가설/upper-bound**이며 live uplift는 현재 HOLD다.
2. **현재 운영 paid_click_intent_ledger schema 에 member_code_hash 컬럼 미존재** → schema 확장 필요 (Yellow 승인 영역). 본 sprint 는 설계만.
3. **NPay actual confirmed order attribution은 이론상 가능** — Path A 는 NPay GA4 fire 누락으로 0건 제외되지만, Path C 실측은 `member_code_hash`가 ledger에 쌓인 뒤에만 가능하다.
4. **member_code를 단독 비식별값으로 단정하지 않는다.** 이름/전화번호 같은 직접 PII는 아니지만 내부 주문·회원 테이블과 결합하면 회원 식별이 가능한 pseudonymous identifier로 취급한다. v2 기본안은 `member_code_hash = HMAC-SHA256(member_code, server_secret)`이며 raw member_code 운영 저장과 raw logging은 금지한다.
5. Phase 1 로컬 설계/코드 검토는 Green이지만, Phase 2 backend deploy와 Phase 3 client wrapper는 Yellow 승인 HOLD다. 승인안 v2에는 deploy mode A/B/C, hash 저장, Preview 증거, last eligible paid click 기준, rollback을 포함해야 한다.

## 1. 무엇을 (What)

### 핵심 변경 3개 + 클라이언트 1개

| 영역 | 파일 | 변경 |
|---|---|---|
| Backend schema | `backend/src/paidClickIntentLog.ts` | v2 기본안은 `member_code_hash TEXT NOT NULL DEFAULT ''` + `idx_pci_member_hash` index. raw `member_code` 컬럼 운영 저장은 금지 또는 별도 승인 후보로 분리 |
| Backend lookup | `backend/src/paidClickIntentLog.ts` | `lookupByMemberCodeHash(memberCodeHash, site, sinceDays)` 또는 transient raw → server HMAC 후 lookup. raw member_code 반환/로그 금지 |
| Backend route | `backend/src/routes/attribution.ts` | `/api/attribution/paid-click-intent/no-send` 핸들러는 `member_code`를 raw 저장하지 않는다. server-side HMAC 처리 또는 client-side hash Preview 중 하나를 승인안 v2에서 확정 |
| Backend agent | `backend/scripts/google-ads-confirmed-purchase-candidate-prep.ts` | 각 결제완료 row의 member_code를 동일 HMAC으로 변환한 뒤 `lookupByMemberCodeHash(...)` 호출. paid_at 이전 가장 최근 paid click을 primary로 선택하고 이전 click은 assist로 남김 |
| Client wrapper | imweb body or GTM Custom HTML tag | Production publish 전 Preview only. `window.imweb?.user?.member_code` 존재 여부와 로그인/비로그인/상품/checkout/NPay intent별 동작을 먼저 증거화 |

## 2. 왜 (Why)

### 데이터 evidence

| 측정 | 값 | 출처 |
|---|---:|---|
| canary 12.5h 결제완료 | 191건 | imweb_orders (운영 sqlite) |
| 그 중 member_code 보유 | **191건 (100%)** | 동일 |
| canary 14건 NPay actual confirmed | 100% member_code 보유 | 동일 |
| 현재 paid_click_intent_ledger 컬럼 수 | 29 | direct schema check |
| member_code_hash 컬럼 존재 | **NO** | direct schema check |
| Path A 매칭률 (12.5h) | 0.33% (1/300) | [[ga4-path-a-attribution-limit-20260508]] |
| Path C 가설 매칭률 (member_code_hash bridge가 채워졌을 때) | 60~80% upper-bound | 실측 아님. 회원 결제 100% × paid_click_intent member_code fill rate 가정 |

### 효율 비교

| 측면 | Path A (GA4 BigQuery 매개) | Path B (imweb 결제완료 별 collector) | **Path C (member_code_hash 매개)** |
|---|---|---|---|
| 매칭 정확도 | 0.33% (chain 4단계) | 95%+ (직접) | **60~80% upper-bound 가설. 실측 전 HOLD** |
| NPay 결제완료 attribution | 0% (GA4 fire 누락) | 가능 | **가능** |
| 새 코드 작성 범위 | 없음 (BigQuery query만) | imweb body + GTM 변경 + 새 backend route | schema 확장 + lookup 함수 + 클라이언트 1줄 |
| Yellow 승인 범위 | 없음 | imweb publish + Yellow | schema migration + 클라이언트 + Yellow |
| 회원 결제 매칭 | 부분 (cookie 휘발) | 가능 | **100% 이론값 (회원 결제 100% member_code)** |
| 비회원 결제 매칭 | 부분 (cookie 휘발) | 가능 | 불가 (member_code empty) |
| schema 변경 영향 | 없음 | 새 table 가능 | paid_click_intent_ledger 1 컬럼 추가 (lazy bootstrap) |
| 본 agent 자율 | YES (Path A 측정) | NO (외부 인프라) | YES (Phase 1) / NO (Phase 2~3 Yellow) |
| **권장도** | 보조용 (sample 부족) | 장기 ideal | **단기 + 중기 best** |

### 핵심 효과 가설 — NPay actual confirmed attribution

```text
canary window NPay actual confirmed: 14건 (member_code 100%)

Path A 매칭: 0건 (GA4 purchase fire 누락 자동 제외)
Path C 매칭 가설: 8~11건 (60~80% × 14)
live uplift       : HOLD (member_code_hash bridge 전)
```

→ Google Ads NPay click 학습 부풀림 9.04배 ([[../data/imweb-orders-npay-readonly-analysis-20260508]]) 의 정합성 회복은 **NPay actual confirmed attribution 측정** 부터 시작해야 한다. 다만 현재 live `paid_click_intent_ledger`에는 `member_code_hash`/`order_number`가 없어 24h가 되어도 uplift가 자동 측정되지 않는다.

## 3. 어떻게 (How) — 5단계 구현 plan

### Phase 0 — 설계 (본 문서, 완료)

본 sprint 에서 진행. schema/wrapper/code 변경 없음.

### Phase 1 — 로컬 코드 작성 (본 agent 자율, Green)

**`backend/src/paidClickIntentLog.ts`** 변경:

```typescript
// 1) ensureTable 함수에 ALTER 자동 추가 (v2 기본안)
const ensureTable = (db: Database.Database) => {
  if (tableReady) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      ... 기존 28개 컬럼 ...
      , member_code_hash TEXT NOT NULL DEFAULT ''  -- 신규, raw member_code 저장 금지
    );
    CREATE INDEX IF NOT EXISTS idx_pci_member_hash ON ${TABLE}(site, member_code_hash) WHERE member_code_hash != '';
    -- 기존 5 indexes 유지
  `);
  // 기존 schema 가 ALTER 필요한 경우 lazy migration
  const cols = db.prepare(`PRAGMA table_info(${TABLE})`).all() as Array<{ name: string }>;
  if (!cols.some(c => c.name === 'member_code_hash')) {
    db.exec(`ALTER TABLE ${TABLE} ADD COLUMN member_code_hash TEXT NOT NULL DEFAULT ''`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_pci_member_hash ON ${TABLE}(site, member_code_hash) WHERE member_code_hash != ''`);
  }
  tableReady = true;
};

// 2) recordPaidClickIntent 함수에 member_code_hash 받기
export const recordPaidClickIntent = (
  preview: PaidClickIntentPreview & { member_code?: string; member_code_hash?: string },
  rawInput: unknown,
  context: PaidClickIntentRequestContext,
): PaidClickIntentRecordResult => {
  // ... 기존 검증 ...
  const memberCodeHash = computeMemberCodeHash(preview.member_code, preview.member_code_hash);
  // INSERT 시 member_code_hash 컬럼만 포함. raw member_code 저장/로그 금지
};

// 3) lookupByMemberCodeHash 함수 export
export const lookupByMemberCodeHash = (
  memberCodeHash: string,
  site: string,
  sinceDays = 30,
): PaidClickIntentRow[] => {
  if (!memberCodeHash) return [];
  const db = getCrmDb();
  ensureTable(db);
  const sinceIso = new Date(Date.now() - sinceDays * 24 * 3600 * 1000).toISOString();
  const rows = db
    .prepare(
      `SELECT * FROM ${TABLE}
       WHERE site = ? AND member_code_hash = ? AND received_at >= ?
       ORDER BY received_at DESC LIMIT 50`,
    )
    .all(site, memberCodeHash, sinceIso) as Record<string, unknown>[];
  return rows.map(dbRowToRow);
};
```

**`backend/src/routes/attribution.ts`** 변경:

```typescript
// /api/attribution/paid-click-intent/no-send 핸들러
const memberCode = textField(body, 'member_code') || textField(body, 'memberCode') || '';
// raw memberCode 는 transient input 으로만 사용하고 저장/로그 금지.
// 승인안 v2 에서 server-side HMAC 또는 client-side hash Preview 방식을 확정한다.
const memberCodeHash = hmacMemberCode(memberCode);

// recordPaidClickIntent 호출 시 member_code_hash 만 저장
const result = recordPaidClickIntent(
  { ...preview, member_code_hash: memberCodeHash },
  body,
  context,
);
```

**`backend/scripts/google-ads-confirmed-purchase-candidate-prep.ts`** 변경:

```typescript
import { lookupByMemberCodeHash } from '../src/paidClickIntentLog';

for (const candidate of candidates) {
  // 기존: GA4 BigQuery 매개 chain 시도
  // 추가: member_code_hash 매개 chain
  if (candidate.member_code) {
    const memberCodeHash = hmacMemberCode(candidate.member_code);
    const pciRows = lookupByMemberCodeHash(memberCodeHash, 'biocom', 30)
      .filter(row => row.receivedAt <= candidate.paid_at);
    if (pciRows.length > 0) {
      // 운영 primary: paid_at 이전 가장 최근 paid click (last eligible paid click)
      const primaryClick = pciRows[0]; // ORDER BY received_at DESC
      candidate.click_id_type = primaryClick.clickIdType;
      candidate.click_id_value = primaryClick.clickIdValue;
      candidate.attribution_source = 'paid_click_intent_member_code_match';
      candidate.assist_click_count = Math.max(0, pciRows.length - 1);
      // 카운터 증가
      withClickId += 1;
      googleClickIdTypeCounters[primaryClick.clickIdType] += 1;
    }
  }
  // member_code_hash 매칭 실패 시 Path A (GA4 BigQuery) 시도 (fallback)
}
```

**검증**:
- 로컬 sqlite test (paid_click_intent fixture row + imweb_orders fixture)
- typecheck PASS
- 기존 canary smoke 7종 그대로 PASS (member_code empty 도 정상 fire)

### Phase 2 — 운영 backend deploy (Yellow 승인)

`errorHandler hardening + PM2 1.5G uplift deploy` 절차와 동일:

```bash
# 1. 운영 dist 백업
ssh -i ~/.ssh/id_ed25519 taejun@34.64.104.94
sudo -u biocomkr_sns cp /home/biocomkr_sns/seo/repo/backend/dist/paidClickIntentLog.js \
  /home/biocomkr_sns/seo/shared/deploy-backups/{TIMESTAMP}_path_c_member_code_pre/

# 2. local build → scp 3 파일
scp dist/paidClickIntentLog.js dist/routes/attribution.js dist/scripts/google-ads-confirmed-purchase-candidate-prep.js \
  taejun@34.64.104.94:/tmp/

# 3. 운영 dist 교체 + sha256 검증

# 4. PM2 restart --update-env

# 5. lazy bootstrap 으로 schema 자동 ALTER (paid_click_intent_ledger.member_code_hash 컬럼 추가)

# 6. post-deploy smoke
curl -X POST -H "Content-Type: application/json" \
  -d '{"site":"biocom","capture_stage":"landing","captured_at":"...","gclid":"AW.test","ga_session_id":"test","client_id":"test","member_code":"m_test_123","landing_url":"..."}' \
  https://att.ainativeos.net/api/attribution/paid-click-intent/no-send

# 7. ledger 직접 read — raw member_code 없이 member_code_hash 컬럼 정상 채워졌는지 확인

# 8. 기존 canary 회귀 없음 확인 (5xx 0, PII reject 정상)
```

**중요**: schema 변경은 ALTER ADD COLUMN with DEFAULT 라 backward compatible. 기존 ledger row 는 member_code='' 로 자동 채워짐. 다음 Phase 3 시점부터 신규 row 만 채워짐.

### Phase 3 — 클라이언트 wrapper 변경 (Yellow 승인)

GTM Preview workspace 또는 imweb body 코드 변경:

```javascript
// imweb body Custom HTML 또는 GTM Custom HTML tag (page_view trigger)
(function() {
  var memberCode = '';
  try {
    // imweb 회원 정보 추출 (자사몰 SDK 또는 sessionStorage)
    memberCode = (window.imweb && window.imweb.user && window.imweb.user.member_code) || 
                 sessionStorage.getItem('imweb_member_code') || 
                 '';
    // format validation
    if (memberCode && !/^(m|gu)[a-z0-9]{0,62}$/i.test(memberCode)) memberCode = '';
  } catch (e) {}
  
  // Preview only: member_code source 존재 여부를 확인한다.
  // Production publish 전에는 raw member_code 저장/로그 금지와 hash 생성 방식을 승인안 v2에서 확정한다.
  var payload = {
    site: 'biocom',
    capture_stage: 'landing', // or checkout_start / npay_intent
    captured_at: new Date().toISOString(),
    gclid: getQueryParam('gclid'),
    ga_session_id: getGaSessionId(),
    client_id: getGaClientId(),
    landing_url: location.href,
    member_code_hash: hashMemberCodeForPreview(memberCode),  // v2 승인 전 placeholder
    // PII 절대 금지 (email/phone/name/address/order_number/payment_key/value/currency)
  };
  
  fetch('/api/attribution/paid-click-intent/no-send', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
    keepalive: true,
  });
})();
```

**검증**:
- GTM Preview에서 Tag Assistant 로 fire 확인
- Backend ledger 에 raw member_code 가 아니라 member_code_hash 만 채워진 row 추가 확인
- 1h canary + 24h monitoring (paid_click_intent canary 절차)

### Phase 4 — attribution 측정 (본 agent 자율, Green)

```bash
npm --prefix backend run agent:confirmed-purchase-prep
```

→ ConfirmedPurchasePrep 결과의 `with_google_click_id` 카운트가 Path C bridge 이후에만 의미 있게 비교된다.

주의: 기존 1,400~1,850건/30일 수치는 실측 기대값이 아니라 가설/upper-bound다. 운영 보고에서는 `member_code_hash` bridge가 채워지고 1d/7d/30d lookback별 `last eligible paid click`이 산출될 때까지 uplift로 쓰지 않는다.

## 4. PII / TTL / Purpose limitation / masking

| 항목 | 정책 |
|---|---|
| **PII 분류** | member_code 는 직접 PII로 단정하지 않지만, 내부 주문·회원 데이터와 결합하면 회원 식별이 가능한 pseudonymous identifier 로 취급 |
| **TTL** | 90일 (기존 paid_click_intent retention 정책과 동일) |
| **Purpose limitation** | Google Ads attribution chain 매개 만. 다른 광고 플랫폼 송출 / 사용자 프로파일링 / 마케팅 자동 발송 금지 |
| **Masking** | 기본은 HMAC-SHA256 hash 저장. raw member_code 운영 저장과 raw logging 금지. server_secret 교체/보관은 별 보안 승인 |
| **PII guard** | 기존 reject set (email/phone/name/address/order_number/payment_key/value/currency) 유지. member_code 는 raw 저장 금지 field 로 별도 audit |
| **Format validation** | `/^(m|gu)[a-z0-9]{0,62}$/i` (imweb member_code 형식). 그 외 형식은 빈 문자열 처리 |
| **Consent basis** | imweb 회원가입 시 일반 이용 약관 + 광고 분석 동의 범위 안에서 사용. 별 사용자 동의 추가 검토는 법무 별 sprint |

## 5. 기대 효과 가설 (실측 전 HOLD)

### Path A vs Path C upper-bound scenario

아래 표는 승인 판단용 sensitivity scenario다. 실측 uplift가 아니다.

| 측정 | Path A only | Path C 60% scenario | Path C 80% scenario | 해석 |
|---|---:|---:|---:|---:|
| canary 12.5h homepage attribution | 1건 | 107건 | 142건 | upper-bound, live HOLD |
| canary 12.5h NPay actual confirmed attribution | 0건 | 8건 | 11건 | upper-bound, live HOLD |
| canary 12.5h 합계 | 1건 | 115건 | 153건 | upper-bound, live HOLD |
| 30일 누적 scenario | 84건 / 17M | 1,400건 / 290M | 1,850건 / 390M | 실측 전 사용 금지 |

2026-05-08 17:23 KST dry-run 기준 live 상태는 다르다. 운영 PG positive 52 orders와 live ledger 709 rows는 확인됐지만, deterministic bridge가 없어 주문 52건 모두 multiple prior click 후보였다. 따라서 live uplift는 `HOLD`다.

### Path C 한계 (의도된 trade-off)

| 한계 | 설명 |
|---|---|
| 비회원 결제 매칭 불가 | canary 12.5h 회원 결제 100% 라 단기 영향 없음. 일반 운영 비회원 비중 별 측정 필요 |
| paid_click_intent fire 안 한 사용자 매칭 불가 | 광고 click 후 cookie 차단 등으로 fire 안 된 사용자는 Path B 별 collector 필요 |
| 광고 click 전 회원가입 사용자만 매칭 | 광고 click 시점 비회원 → 결제 시점 회원 가입은 매칭 안 됨 (paid_click_intent ledger의 member_code 빈 값) |

## 6. 본 agent 한계와 책임 분리

| 작업 | 본 agent 자율? | 사유 |
|---|---|---|
| Phase 0 설계 (본 문서) | YES | Green Lane |
| Phase 1 로컬 코드 작성 | YES | 로컬 sqlite + typecheck. 운영 영향 없음 |
| Phase 2 운영 deploy | NO | 운영 backend 변경 = Yellow 승인 |
| Phase 3 클라이언트 wrapper | NO | imweb 또는 GTM Yellow 승인 |
| Phase 4 attribution 측정 | YES | ConfirmedPurchasePrep 재실행 (read-only) |

## 7. TJ 영역 (Yellow 승인 후보)

| 항목 | 무엇 | 어떻게 | 왜 |
|---|---|---|---|
| Path C Phase 2 deploy 승인 v2 | `member_code_hash` schema + lookupByMemberCodeHash + ConfirmedPurchasePrep last eligible click 변경 운영 backend 반영 | deploy mode A/B/C, backup/rollback, schema impact, smoke 포함 승인안 v2 작성 후 판단 | 운영 attribution chain 받을 준비 |
| Path C Phase 3 Preview 승인 | imweb body 또는 GTM Preview workspace 에서 member_code source 존재 여부와 hash payload 를 Preview 로 확인 | 로그인/비로그인/상품/checkout/NPay intent별 Tag Assistant + receiver no-send 응답 증거 수집 | Production publish 전 가능성 검증 |
| Path C Production publish 승인 | Preview PASS 후 별도 판단 | raw member_code 저장 0, member_code_hash present, PII/order/payment/value 0, rollback tag pause 포함 | 클라이언트 fire 시점 hash 첨부 |

## 8. 한 줄 결론

> Path C 방향은 유효하지만 Yellow 승인은 HOLD다. member_code 는 pseudonymous identifier 로 다루고, v2 기본안은 raw 저장이 아니라 HMAC member_code_hash 저장 + paid_at 이전 last eligible paid click 기준 + wrapper Preview 먼저다.
