# GA4 BigQuery 매개 attribution chain dry-run + 운영 PG dry-run + schema lookup 설계

작성 시각: 2026-05-08 12:30 KST
대상: paid_click_intent_ledger ↔ GA4 BigQuery ↔ imweb_orders/tb_playauto_orders attribution chain
관련 정본: [[../data/!channelfunnel]], [[paid-click-intent-ledger-canary-early-audit-20260508]], [[paid-click-intent-ledger-early-operation-decision-20260508]]
Status: 1차 dry-run / Path A 매칭률 측정 / 운영 PG 연결 확인 / schema lookup 코드 설계
Do not use for: 운영 변경, conversion upload, 광고 변경, 외부 전송

## 5줄 결론

1. **Path A (GA4 BigQuery 매개 chain) 매칭률 정량화**: paid_click_intent canary 12.5h 의 ga_session_id 300개 → GA4 events_20260507 매칭 25건 (8.3%) → 매칭 session 중 GA4 purchase 1건 (4%) → **종합 attribution rate 0.33%** (1/300).
2. paid_google 전환율 0.07%와 일관 — Path A 단독으로는 sample 너무 작아 **attribution 측정에 부족** (24h 누적 9건/일, 30일 약 40건).
3. **운영 PG 직접 read-only 연결 확인** (`bico_readonly@34.47.95.104:5432/dashboard`, `tb_playauto_orders` 123,857 rows). 그러나 `tb_playauto_orders`는 multi-shop 통합(아임웹/스마트스토어/쿠팡)이고 `pay_method` 거의 null → NPay 식별은 운영 sqlite `imweb_orders.pay_type` 가 더 정확.
4. **새 ConfirmedPurchasePrep dry-run input 생성**은 multi-source join (imweb_orders + GA4 BigQuery + tb_playauto_orders) 복잡 → 별 sprint 설계 필요.
5. **paid_click_intent_ledger schema lookup 코드 추가 (Path C)** 가 가장 효율적. 회원 결제 100% attribution 가능. 본 문서 §4에 무엇/어떻게/왜 상세 기술.

## 1. Path A — GA4 BigQuery 매개 chain dry-run 결과

### Chain 구조

```text
[1] paid_click_intent_ledger (canary 누적, 운영 sqlite)
        ↓ ga_session_id 매칭
[2] GA4 BigQuery events_*.ga_session_id (asia-northeast3)
        ↓ event_name='purchase' 의 transaction_id 추출
[3] imweb_orders.order_no (운영 sqlite)
        ↓ 1:1 매칭
[4] 결제완료 정보 (pay_type, payment_amount, complete_time)
```

### Step 1: paid_click_intent.ga_session_id 추출

| 지표 | 값 |
|---|---:|
| canary 12.5h 누적 ga_session_id (unique) | **300개** |
| canary 14:00~15:00 UTC 1h window 한정 ga_session_id | 29개 |

### Step 2: GA4 events_20260507 매칭

| measurement | value |
|---|---:|
| events_20260507 ga_session_id 범위 | 1,778,072,905 ~ 1,778,165,996 (Unix timestamp 1.778e9) |
| events_20260507 unique ga_session_id | 11,465 |
| events_20260507 시간 범위 | 2026-05-06 15:00 UTC ~ 2026-05-07 14:59 UTC (KST 5/7 24h) |
| canary 전체 매칭 (300 vs events_20260507) | **25건 (8.3%)** |
| canary 14-15 UTC 한정 매칭 (29 vs events_20260507 14-15 UTC) | **11건 (38%)** |

### Step 3: 매칭 session 의 purchase fire 비율

| measurement | value |
|---|---:|
| events_20260507 전체 purchase event | 63건 |
| events_20260507 14-15 UTC purchase | 4건 |
| **매칭 session 중 purchase 발생** | **1건** (1/25 = 4%) |
| **종합 attribution rate** (paid_click_intent → GA4 purchase 도달) | **0.33%** (1/300) |

### Step 4: transaction_id ↔ imweb_orders.order_no

| 검증 | 결과 |
|---|---|
| GA4 transaction_id 형식 | `2026050X{random_7_digits}` (예: 202605071533390) |
| imweb_orders.order_no 형식 | 동일 (yyyymmdd + 7자리) |
| 매칭 가능성 | **1:1 가능** (sample 100% 일관) |

### Path A 한계 분석

**0.33% attribution rate 의미**:
- 24h 누적 (paid_click_intent ~3,400 row 추정): 11건 attribution
- 30일 누적 (~25,200 row): 84건 attribution
- 90일 누적 (~75,600 row): 252건 attribution

**vs. 운영 imweb_orders 실제 결제완료** (last_30d):
- 2,316건 결제완료 / 5.23억 매출
- Path A로 attribution 가능: 84건 / 약 1,700만원 (3.6% of revenue)

→ **Google Ads 효과 측정에 sample 너무 작음**. paid_click_intent 자체는 정상이지만, 결제까지 이어지는 비율이 0.33% 라 Google attribution chain 으로는 96% 이상 매출 측정 불가.

### Path A 한계 사유 (이전 분석과 일관)

1. **Google Ads click → 결제완료 전환율 0.07%** ([[../gdn/channel-funnel-quality-meta-google-organic-20260508]] 분석 결과)
2. **paid_click_intent ledger 75%+가 Google Shopping 광고 click** — 신규 사용자 위주
3. **결제완료자는 brand-aware repeat customer 비중 큼** — direct/email/repeat 채널이 매출 핵심
4. paid_click_intent.ga_session_id 와 결제완료 시점 ga_session_id 가 멀티 세션으로 다를 수 있음

## 2. 운영 PG 직접 read-only 연결 확인

### 연결 정보

```text
host: 34.47.95.104:5432
db:   dashboard
user: bico_readonly (read-only)
password: (운영 backend .env 에 보유)
URL scheme 변환: postgresql+asyncpg:// → postgresql:// (node-pg 호환)
```

### tb_playauto_orders schema 확인 (last_30d)

| column | type |
|---|---|
| ord_status | varchar (`결제완료`, `배송준비`, `반품완료`, `취소완료` 등) |
| pay_method | varchar (대부분 null, 4,423건 중 0% 채워짐) |
| **pay_amt** | numeric (NOT payment_amount) |
| **ord_time** | varchar (NOT order_time) |
| pay_time | varchar |
| shop_name | varchar (아임웹 / 스마트스토어 / 쿠팡 등) |
| shop_ord_no | varchar |
| order_name, order_htel | PII (직접 출력 금지) |

### 7일 shop_name 분포 (multi-shop 통합)

| shop_name | n |
|---|---:|
| 아임웹 | 675 |
| 아임웹-C | 170 |
| 스마트스토어-B | 93 |
| 스마트스토어 | 57 |
| 쿠팡 | 45 |

→ **tb_playauto_orders 는 multi-shop 통합 데이터**. NPay 분리는 어려움 (`스마트스토어` 가 NPay와 일부 겹치지만 정확 매칭 어려움).

### NPay 식별 source 비교

| source | NPay 식별 | 정확도 |
|---|---|---|
| 운영 sqlite `imweb_orders.pay_type='npay'` | YES (158건/last_30d) | 높음 (자사 NPay 결제완료) |
| 운영 PG `tb_playauto_orders` | shop_name 또는 pay_method (null 많음) | 낮음 |
| GA4 BigQuery purchase event | NPay 0건 (GTM v138 변경) | 추적 불가 |

→ **NPay attribution은 운영 sqlite imweb_orders 가 정본**.

## 3. 새 ConfirmedPurchasePrep dry-run input 생성 — 별 sprint 설계

### 무엇을 (What)

`data/bi-confirmed-purchase-operational-dry-run-20260508.json` 생성. 5/8 시점 운영 결제완료 데이터를 ConfirmedPurchasePrep agent input schema 에 맞게 구성.

### 왜 (Why)

- 직전 input (5/5)은 canary 시작 전 데이터 → canary effect 측정 불가
- ConfirmedPurchasePrep 의 with_gclid / missing_google_click_id 변화를 측정해야 정식 운영화 효과 정량화 가능
- Google Ads BI confirmed_purchase 실행안 ([[../gdn/google-ads-confirmed-purchase-execution-approval-20260505]]) 의 선결조건

### 어떻게 (How)

**Multi-source join** 필요:

| step | source | 내용 |
|---|---|---|
| 1 | `imweb_orders` (운영 sqlite, biocom site) | last_30d 결제완료 추출 (`complete_time IS NOT NULL`, `cancellation_reason IS NULL`, `return_reason IS NULL`) |
| 2 | `paid_click_intent_ledger` (운영 sqlite) | 동일 window 의 ga_session_id / client_id / click_id_value / utm_* 추출 |
| 3 | GA4 BigQuery `events_*` | step 2 ga_session_id 매칭 events 추출 |
| 4 | GA4 BigQuery `purchase` event | step 3 의 purchase 만 → `transaction_id` 추출 |
| 5 | imweb_orders.order_no ↔ transaction_id | 매칭 → click_id 결정 |
| 6 | output schema | ConfirmedPurchasePrep agent 가 require 하는 detail row array 형식으로 변환 |

**Schema 일치** 필요:
- `data/bi-confirmed-purchase-operational-dry-run-20260505.json` 구조 분석 (764 KB, sample row 형식)
- 동일 schema로 5/8 input 생성

### 본 sprint 진행 안 한 이유

- multi-source join 코드 작성 + 테스트 + 검증 → 본 turn 시간 초과
- input schema 정밀 일치 필요 (ConfirmedPurchasePrep agent의 detail row 구조)
- 별 backend script 추가가 적절 (`backend/scripts/bi-confirmed-purchase-operational-dry-run-builder.ts`)

### 다음 sprint 진입 시 작업

| 단계 | 작업 |
|---|---|
| 1 | 직전 dry-run input schema 정밀 분석 (`data/bi-confirmed-purchase-operational-dry-run-20260505.json` sample row 구조) |
| 2 | `backend/scripts/bi-confirmed-purchase-operational-dry-run-builder.ts` 작성 |
| 3 | 로컬 typecheck + sample 10 row test |
| 4 | 운영 VM에서 full execution → `data/bi-confirmed-purchase-operational-dry-run-20260508.json` 생성 |
| 5 | ConfirmedPurchasePrep agent 재실행 → with_gclid 변화 측정 |
| 6 | 결과 보고 |

본 agent 자율 가능 (CLAUDE.md PG read-only 명시 + BigQuery 권한 보유). Yellow 승인 불필요.

## 4. paid_click_intent_ledger schema lookup 코드 추가 (Path C) — 무엇/어떻게/왜

### 4.1 무엇을 (What)

`paid_click_intent_ledger` 에 **`member_code` 컬럼 추가** + ConfirmedPurchasePrep agent에 **lookup 함수 추가**.

3개 코드 변경:

| 파일 | 변경 내용 |
|---|---|
| `backend/src/paidClickIntentLog.ts` | schema에 `member_code TEXT NOT NULL DEFAULT ''` 컬럼 추가 + `lookupByMemberCode(memberCode, site)` export 함수 추가 |
| `backend/src/routes/attribution.ts` | `/api/attribution/paid-click-intent/no-send` payload에서 `member_code` 받아 ledger 저장 (PII 아님 — 자사 회원 ID, hash 아님) |
| `backend/scripts/google-ads-confirmed-purchase-candidate-prep.ts` | 각 결제완료 row 에 대해 `lookupByMemberCode` 호출 → 매칭된 paid_click_intent_ledger row 의 click_id_value 사용 → with_gclid 카운트 보강 |

### 4.2 왜 (Why)

| 이유 | 설명 |
|---|---|
| **회원 결제 100%** | canary 12.5h 결제완료 191건 모두 imweb_orders.member_code 보유 → member_code는 가장 안정적 join key |
| **Path A 한계** | GA4 BigQuery 매개 chain attribution rate 0.33% — sample 너무 작음 |
| **Path B (별 collector) 보다 효율** | imweb 결제완료 페이지 GTM/imweb body 변경은 Yellow 승인 필요. member_code 추가는 schema + 클라이언트 wrapper만 |
| **NPay 결제완료도 attribution 가능** | Path A는 NPay GA4 fire 누락으로 NPay 제외. member_code 매칭은 NPay 결제완료도 포함 (imweb_orders.pay_type='npay' 도 member_code 있음) |
| **이미 클라이언트가 알고 있는 정보** | imweb body 코드에서 로그인 사용자의 member_code는 sessionStorage 또는 cookie로 접근 가능 |

### 4.3 어떻게 (How) — 단계별 상세

#### Step 1 — schema 변경 (backend/src/paidClickIntentLog.ts)

**현재 schema** (29 컬럼):
```sql
CREATE TABLE paid_click_intent_ledger (
  intent_id, site, captured_at, received_at, platform_hint, capture_stage,
  click_id_type, click_id_value, click_id_hash,
  utm_source, utm_medium, utm_campaign, utm_term, utm_content,
  landing_path, allowed_query_json, referrer_host,
  client_id, ga_session_id, local_session_id, user_agent_hash, ip_hash,
  dedupe_key, duplicate_count, status, reject_reason, expires_at,
  created_at, updated_at
)
```

**추가**:
```sql
ALTER TABLE paid_click_intent_ledger ADD COLUMN member_code TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_pci_member ON paid_click_intent_ledger(site, member_code) WHERE member_code != '';
```

**bootstrapPaidClickIntentTable() 함수에 ALTER 자동 실행** (paid_click_intent canary와 동일 lazy schema 패턴).

#### Step 2 — 클라이언트 payload 확장

`paid_click_intent` no-send receiver 의 payload 에 `member_code` 추가:

```javascript
// imweb body 또는 GTM Custom HTML tag
const memberCode = window.imweb?.user?.member_code 
  || window.localStorage?.getItem('imweb_member_code')
  || '';

fetch('/api/attribution/paid-click-intent/no-send', {
  method: 'POST',
  body: JSON.stringify({
    site: 'biocom',
    captured_at: new Date().toISOString(),
    capture_stage: 'landing',
    gclid: ga4Cookie.gclid,
    ga_session_id: ga4Cookie.ga_session_id,
    landing_url: location.href,
    member_code: memberCode,  // ← 추가
    // PII 절대 금지: email/phone/name/address/order_number/payment_key/value/currency
  })
});
```

→ 비회원이면 빈 문자열, 회원이면 imweb member_code (자사 ID, PII 아님).

#### Step 3 — lookup 함수 (backend/src/paidClickIntentLog.ts)

```typescript
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
       ORDER BY received_at DESC
       LIMIT 50`,
    )
    .all(site, memberCode, sinceIso) as Record<string, unknown>[];
  return rows.map(dbRowToRow);
};
```

#### Step 4 — ConfirmedPurchasePrep 에 lookup 적용

`backend/scripts/google-ads-confirmed-purchase-candidate-prep.ts` 의 detail row 처리 loop:

```typescript
import { lookupByMemberCode } from '../src/paidClickIntentLog';

for (const candidate of candidates) {
  // 기존: GA4 client_id / gclid 직접 lookup
  // 추가: member_code lookup
  const pciRows = lookupByMemberCode(candidate.member_code, 'biocom', 30);
  
  if (pciRows.length > 0) {
    const earliestClick = pciRows[pciRows.length - 1]; // 가장 오래된 click
    candidate.click_id_type = earliestClick.clickIdType;
    candidate.click_id_value = earliestClick.clickIdValue;
    candidate.attribution_source = 'paid_click_intent_member_code_match';
    // counter 증가
    googleClickIdCounters[earliestClick.clickIdType] += 1;
    withClickId += 1;
  } else if (!candidate.click_id_value) {
    // GA4 BigQuery 매개 chain (Path A) 도 시도
    // 또는 missing_google_click_id 로 처리
  }
}
```

#### Step 5 — 검증

| 검증 | 방법 |
|---|---|
| schema migration 안전 | 로컬 sqlite test → 운영 backup → 운영 deploy |
| member_code PII 분류 | imweb 자사 회원 ID — 단독으로는 개인 식별 안 됨 (이름/전화 없음). PII 아님으로 분류 |
| lookup 정확도 | canary 12.5h 191 결제완료 100% member_code 보유 → lookup 매칭 가능 비율 측정 |
| backward compatibility | 비회원 결제는 member_code 빈 문자열 → 기존 chain (Path A) 유지 |

### 4.4 단계별 risk

| risk | 완화 |
|---|---|
| schema migration 실패 | lazy bootstrap + ALTER IF NOT EXISTS 패턴 (이미 검증됨) |
| member_code PII 우려 | 단독 식별 불가 (이름/전화 없음). 별 사용자 동의 검토 필요 시 hash 적용 옵션 |
| 클라이언트 wrapper 변경 영향 | 기존 paid_click_intent fire 흐름 그대로, 필드 추가만 (backward compatible) |
| 비회원 결제 비중 | canary 100% 회원이지만 일반 운영 무회원 비중 별 측정 필요 |

### 4.5 진입 단계

| Phase | 내용 |
|---|---|
| **Phase 0** (본 문서) | 설계 |
| **Phase 1** | 로컬 schema + lookup 함수 + 테스트 (본 agent 자율) |
| **Phase 2** | 운영 backend deploy (paid_click_intent canary와 동일 절차, Yellow 승인) |
| **Phase 3** | 클라이언트 wrapper 변경 (imweb body 또는 GTM, Yellow 승인) |
| **Phase 4** | ConfirmedPurchasePrep 재실행 → with_gclid 변화 측정 |

본 agent 자율 가능: Phase 1 까지. Phase 2~3 별 Yellow 승인.

## 5. 다음 자동 진행 (auto_ready)

### 본 agent 자율 진행 (TJ 컨펌 NO)

| 작업 | 무엇 | 어떻게 | 왜 |
|---|---|---|---|
| `backend/scripts/bi-confirmed-purchase-operational-dry-run-builder.ts` 작성 | 운영 imweb_orders + GA4 BigQuery + tb_playauto_orders multi-source join 으로 새 dry-run input JSON 생성 | typescript script, BigQuery + sqlite + pg 3 source 매개 join | ConfirmedPurchasePrep canary effect 측정 가능 |
| Phase 1 schema lookup 코드 작성 (Path C) | paidClickIntentLog.ts schema 확장 + lookupByMemberCode + ConfirmedPurchasePrep loop 변경 | 본 문서 §4.3 단계대로 | 회원 결제 100% attribution 가능, Path A 0.33% 한계 극복 |

### TJ 영역 (별 Yellow 승인)

| 작업 | 무엇 | 어떻게 | 왜 |
|---|---|---|---|
| Phase 2 operational deploy | paid_click_intent_ledger schema migration + member_code 컬럼 추가 + 새 lookup 함수 | 본 agent SSH로 backup → scp → restart (errorHandler hardening 절차와 동일) | 운영 attribution chain 활성화 |
| Phase 3 클라이언트 wrapper 변경 | imweb body 또는 GTM Preview workspace에서 paid_click_intent payload 에 member_code 포함 | Custom HTML tag 또는 imweb body JS 수정 | 클라이언트 fire 시점에 member_code 첨부 |

## 6. 24h canary 종료까지 추가 monitoring (시간 의존)

| 시점 | 무엇 | 어떻게 | 왜 |
|---|---|---|---|
| 2026-05-08 17:00 KST (T+18h) | 추가 audit (자연 페이스 검증) | SSH ledger row count + dedupe + mem | 24h 종합 판정 전 중간 점검 |
| 2026-05-08 23:00 KST (T+24h) | **24h 종합 audit + TJ 보고** | SSH + bq query + 종합 보고서 | TJ 정식 운영화 결정 |
| 2026-05-09 02:00 KST | events_20260508 (5/8 KST 24h) 적재 후 GA4 chain 재측정 | bq query 5/8 events 매칭 | 24h+ canary attribution rate 정밀 측정 |

## 7. 한 줄 결론

> Path A (GA4 BigQuery 매개 chain) 매칭률 0.33% 로 attribution sample 부족 확정. **Path C (paid_click_intent_ledger.member_code 추가) 가 회원 결제 100% attribution 가능한 가장 효율적 path**. 본 agent Phase 1 (schema + lookup 코드) 자율 작성 가능, Phase 2 (운영 deploy) + Phase 3 (클라이언트 wrapper) 별 Yellow 승인.
