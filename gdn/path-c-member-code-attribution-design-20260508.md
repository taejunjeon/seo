# Path C — paid_click_intent_ledger.member_code 매개 attribution 설계

작성 시각: 2026-05-08 13:10 KST
대상: paid_click_intent canary 회원 결제 attribution chain
문서 성격: Green Lane 설계 (구현 전). schema/wrapper 변경은 별 Yellow 승인.
관련 정본: [[../data/!channelfunnel]], [[ga4-path-a-attribution-limit-20260508]], [[paid-click-intent-minimal-ledger-schema-contract-20260507]]
관련 데이터: [[../data/path-c-member-code-dry-run-20260508]]
Status: 설계 단계. 본 sprint 범위에서 schema 미적용.
Do not use for: schema migration 운영 적용, 클라이언트 wrapper 운영 변경, 광고 변경

## 5줄 결론

1. **Path C = paid_click_intent_ledger.member_code 매개 chain**: imweb_orders.member_code (canary 100% 보유) ↔ paid_click_intent_ledger.member_code 직접 join. **Path A 0.33% → Path C 60~80% 추정 = 16~22배 uplift**.
2. **현재 paid_click_intent_ledger schema 에 member_code 컬럼 미존재** → schema 확장 필요 (Yellow 승인 영역). 본 sprint 는 설계만.
3. **NPay actual confirmed order 도 attribution 가능** — Path A 는 NPay GA4 fire 누락으로 0건 제외, Path C 는 14건 NPay actual confirmed 100% member_code 보유 → 8~11건 attribution 추정.
4. **member_code PII 분류 = NOT PII** (자사 회원 ID, 단독 식별 불가). TTL 90일 + purpose limitation (Google Ads attribution 매개만) + masking 옵션 (SHA-256 hash) 정리.
5. 4 Phase (설계 → 로컬 코드 → 운영 deploy → 클라이언트 wrapper → 측정) 중 Phase 1 까지 본 agent 자율, Phase 2~3 별 Yellow 승인.

## 1. 무엇을 (What)

### 핵심 변경 3개 + 클라이언트 1개

| 영역 | 파일 | 변경 |
|---|---|---|
| Backend schema | `backend/src/paidClickIntentLog.ts` | `paid_click_intent_ledger` 에 `member_code TEXT NOT NULL DEFAULT ''` 컬럼 추가 + `idx_pci_member` index. lazy bootstrap 패턴 (paid_click_intent canary 와 동일) |
| Backend lookup | `backend/src/paidClickIntentLog.ts` | `lookupByMemberCode(memberCode, site, sinceDays)` export 함수 추가 |
| Backend route | `backend/src/routes/attribution.ts` | `/api/attribution/paid-click-intent/no-send` 핸들러에서 `body.member_code` 받음. PII reject set 그대로 (member_code 는 reject 대상 아님) |
| Backend agent | `backend/scripts/google-ads-confirmed-purchase-candidate-prep.ts` | 각 결제완료 row 에 대해 `lookupByMemberCode(candidate.member_code, 'biocom', 30)` 호출 → 매칭된 paid_click_intent_ledger row 의 click_id 사용 |
| Client wrapper | imweb body or GTM Custom HTML tag | `paid_click_intent` payload에 `member_code: window.imweb?.user?.member_code || ''` 추가 |

## 2. 왜 (Why)

### 데이터 evidence

| 측정 | 값 | 출처 |
|---|---:|---|
| canary 12.5h 결제완료 | 191건 | imweb_orders (운영 sqlite) |
| 그 중 member_code 보유 | **191건 (100%)** | 동일 |
| canary 14건 NPay actual confirmed | 100% member_code 보유 | 동일 |
| 현재 paid_click_intent_ledger 컬럼 수 | 29 | direct schema check |
| member_code 컬럼 존재 | **NO** | direct schema check |
| Path A 매칭률 (12.5h) | 0.33% (1/300) | [[ga4-path-a-attribution-limit-20260508]] |
| Path C 추정 매칭률 (member_code 채워졌을 때) | 60~80% | 회원 결제 100% × paid_click_intent member_code fill rate 추정 |

### 효율 비교

| 측면 | Path A (GA4 BigQuery 매개) | Path B (imweb 결제완료 별 collector) | **Path C (member_code 매개)** |
|---|---|---|---|
| 매칭 정확도 | 0.33% (chain 4단계) | 95%+ (직접) | **60~80% (직접)** |
| NPay 결제완료 attribution | 0% (GA4 fire 누락) | 가능 | **가능** |
| 새 코드 작성 범위 | 없음 (BigQuery query만) | imweb body + GTM 변경 + 새 backend route | schema 확장 + lookup 함수 + 클라이언트 1줄 |
| Yellow 승인 범위 | 없음 | imweb publish + Yellow | schema migration + 클라이언트 + Yellow |
| 회원 결제 매칭 | 부분 (cookie 휘발) | 가능 | **100% 이론값 (회원 결제 100% member_code)** |
| 비회원 결제 매칭 | 부분 (cookie 휘발) | 가능 | 불가 (member_code empty) |
| schema 변경 영향 | 없음 | 새 table 가능 | paid_click_intent_ledger 1 컬럼 추가 (lazy bootstrap) |
| 본 agent 자율 | YES (Path A 측정) | NO (외부 인프라) | YES (Phase 1) / NO (Phase 2~3 Yellow) |
| **권장도** | 보조용 (sample 부족) | 장기 ideal | **단기 + 중기 best** |

### 핵심 효과 — NPay actual confirmed attribution

```text
canary window NPay actual confirmed: 14건 (member_code 100%)

Path A 매칭: 0건 (GA4 purchase fire 누락 자동 제외)
Path C 매칭 (예상): 8~11건 (60~80% × 14)
uplift              : ∞ (0 → 8~11)
```

→ Google Ads NPay click 학습 부풀림 9.04배 ([[../data/imweb-orders-npay-readonly-analysis-20260508]]) 의 정합성 회복은 **NPay actual confirmed attribution 측정** 부터 시작해야 한다. Path A 단독으로는 영원히 불가, Path C 만 가능.

## 3. 어떻게 (How) — 5단계 구현 plan

### Phase 0 — 설계 (본 문서, 완료)

본 sprint 에서 진행. schema/wrapper/code 변경 없음.

### Phase 1 — 로컬 코드 작성 (본 agent 자율, Green)

**`backend/src/paidClickIntentLog.ts`** 변경:

```typescript
// 1) ensureTable 함수에 ALTER 자동 추가
const ensureTable = (db: Database.Database) => {
  if (tableReady) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      ... 기존 28개 컬럼 ...
      , member_code TEXT NOT NULL DEFAULT ''  -- 신규
    );
    CREATE INDEX IF NOT EXISTS idx_pci_member ON ${TABLE}(site, member_code) WHERE member_code != '';
    -- 기존 5 indexes 유지
  `);
  // 기존 schema 가 ALTER 필요한 경우 lazy migration
  const cols = db.prepare(`PRAGMA table_info(${TABLE})`).all() as Array<{ name: string }>;
  if (!cols.some(c => c.name === 'member_code')) {
    db.exec(`ALTER TABLE ${TABLE} ADD COLUMN member_code TEXT NOT NULL DEFAULT ''`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_pci_member ON ${TABLE}(site, member_code) WHERE member_code != ''`);
  }
  tableReady = true;
};

// 2) recordPaidClickIntent 함수에 member_code 받기
export const recordPaidClickIntent = (
  preview: PaidClickIntentPreview & { member_code?: string },
  rawInput: unknown,
  context: PaidClickIntentRequestContext,
): PaidClickIntentRecordResult => {
  // ... 기존 검증 ...
  const memberCode = sanitizeMemberCode(preview.member_code || ''); // /^(m|gu)[a-z0-9]{0,62}$/ 형식 검증
  // INSERT 시 member_code 컬럼 포함
};

// 3) lookupByMemberCode 함수 export
export const lookupByMemberCode = (
  memberCode: string,
  site: string,
  sinceDays = 30,
): PaidClickIntentRow[] => {
  if (!memberCode) return [];
  const db = getCrmDb();
  ensureTable(db);
  const sinceIso = new Date(Date.now() - sinceDays * 24 * 3600 * 1000).toISOString();
  const rows = db
    .prepare(
      `SELECT * FROM ${TABLE}
       WHERE site = ? AND member_code = ? AND received_at >= ?
       ORDER BY received_at ASC LIMIT 50`,
    )
    .all(site, memberCode, sinceIso) as Record<string, unknown>[];
  return rows.map(dbRowToRow);
};
```

**`backend/src/routes/attribution.ts`** 변경:

```typescript
// /api/attribution/paid-click-intent/no-send 핸들러
const memberCode = textField(body, 'member_code') || textField(body, 'memberCode') || '';
// 기존 PII reject set은 그대로. member_code 는 reject 대상 아님 (자사 ID, 단독 식별 불가)

// recordPaidClickIntent 호출 시 member_code 포함
const result = recordPaidClickIntent(
  { ...preview, member_code: memberCode },
  body,
  context,
);
```

**`backend/scripts/google-ads-confirmed-purchase-candidate-prep.ts`** 변경:

```typescript
import { lookupByMemberCode } from '../src/paidClickIntentLog';

for (const candidate of candidates) {
  // 기존: GA4 BigQuery 매개 chain 시도
  // 추가: member_code 매개 chain
  if (candidate.member_code) {
    const pciRows = lookupByMemberCode(candidate.member_code, 'biocom', 30);
    if (pciRows.length > 0) {
      // 가장 오래된 click 사용 (first-touch attribution)
      const earliestClick = pciRows[0]; // ORDER BY received_at ASC
      candidate.click_id_type = earliestClick.clickIdType;
      candidate.click_id_value = earliestClick.clickIdValue;
      candidate.attribution_source = 'paid_click_intent_member_code_match';
      // 카운터 증가
      withClickId += 1;
      googleClickIdTypeCounters[earliestClick.clickIdType] += 1;
    }
  }
  // member_code 매칭 실패 시 Path A (GA4 BigQuery) 시도 (fallback)
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

# 5. lazy bootstrap 으로 schema 자동 ALTER (paid_click_intent_ledger.member_code 컬럼 추가)

# 6. post-deploy smoke
curl -X POST -H "Content-Type: application/json" \
  -d '{"site":"biocom","capture_stage":"landing","captured_at":"...","gclid":"AW.test","ga_session_id":"test","client_id":"test","member_code":"m_test_123","landing_url":"..."}' \
  https://att.ainativeos.net/api/attribution/paid-click-intent/no-send

# 7. ledger 직접 read — member_code 컬럼 정상 채워졌는지 확인

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
  
  // 기존 paid_click_intent payload에 member_code 추가
  var payload = {
    site: 'biocom',
    capture_stage: 'landing', // or checkout_start / npay_intent
    captured_at: new Date().toISOString(),
    gclid: getQueryParam('gclid'),
    ga_session_id: getGaSessionId(),
    client_id: getGaClientId(),
    landing_url: location.href,
    member_code: memberCode,  // ← 추가
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
- Backend ledger 에 member_code 채워진 row 추가 확인
- 1h canary + 24h monitoring (paid_click_intent canary 절차)

### Phase 4 — attribution 측정 (본 agent 자율, Green)

```bash
npm --prefix backend run agent:confirmed-purchase-prep
```

→ ConfirmedPurchasePrep 결과의 `with_google_click_id` 카운트가 5건 (Path A only) → ?건 (Path C 추가) 비교.

기대값: Path A 5건 → Path C 추가 약 1,400~1,850건/30일 (회원 결제 60~80% 매칭).

## 4. PII / TTL / Purpose limitation / masking

| 항목 | 정책 |
|---|---|
| **PII 분류** | **NOT PII** — member_code 자체는 자사 회원 ID 이고 단독으로는 개인 식별 불가 (이름/전화/이메일 없음) |
| **TTL** | 90일 (기존 paid_click_intent retention 정책과 동일) |
| **Purpose limitation** | Google Ads attribution chain 매개 만. 다른 광고 플랫폼 송출 / 사용자 프로파일링 / 마케팅 자동 발송 금지 |
| **Masking** | 기본은 raw 저장 (PII 아님이라 raw로도 안전). 결합 PII 우려 시 SHA-256 hash 옵션 활성화 가능 |
| **PII guard** | 기존 reject set (email/phone/name/address/order_number/payment_key/value/currency) 그대로 유지. member_code 는 reject 대상 아님 |
| **Format validation** | `/^(m|gu)[a-z0-9]{0,62}$/i` (imweb member_code 형식). 그 외 형식은 빈 문자열 처리 |
| **Consent basis** | imweb 회원가입 시 일반 이용 약관 + 광고 분석 동의 범위 안에서 사용. 별 사용자 동의 추가 검토는 법무 별 sprint |

## 5. 기대 효과 정량 (canary 12.5h evidence 기반)

### Path A vs Path C uplift

| 측정 | Path A only | Path C (60% 매칭) | Path C (80% 매칭) | uplift |
|---|---:|---:|---:|---:|
| canary 12.5h homepage attribution | 1건 | 107건 | 142건 | **107~142배** |
| canary 12.5h NPay actual confirmed attribution | 0건 | 8건 | 11건 | **∞ (0→11)** |
| canary 12.5h 합계 | 1건 | 115건 | 153건 | **115~153배** |
| 30일 누적 추정 | 84건 / 17M | 1,400건 / 290M | 1,850건 / 390M | **16~22배** |

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
| Path C Phase 2 deploy 승인 | paid_click_intent_ledger.member_code schema migration + lookupByMemberCode 함수 + ConfirmedPurchasePrep loop 변경 운영 backend 반영 | 본 agent SSH로 backup → scp → restart (errorHandler hardening 절차와 동일) | 운영 attribution chain 활성화 |
| Path C Phase 3 client wrapper 승인 | imweb body 또는 GTM Preview workspace 에서 paid_click_intent payload 에 member_code 첨부 | Custom HTML tag 또는 imweb body JS 추가 | 클라이언트 fire 시점 member_code 첨부 |
| (선택) member_code SHA-256 hash 옵션 활성화 | 결합 PII 우려 시 raw → hash 변환 | env flag `PCI_MEMBER_CODE_HASH_ENABLED=true` | 추가 안전성 |

## 8. 한 줄 결론

> Path C = paid_click_intent_ledger.member_code 매개 chain. canary 회원 결제 100% member_code 보유 → 60~80% 매칭 가능. **Path A 0.33% → Path C 추정 16~22배 uplift** + **NPay actual confirmed attribution 가능**. 본 agent Phase 1 자율, Phase 2~3 별 Yellow 승인.
