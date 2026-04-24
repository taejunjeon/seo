# AIBIO × seo/crm.sqlite3 통합 Sync 설계 (C)

작성일: 2026-04-24
목적: AIBIO Supabase DB의 주요 테이블을 기존 seo 프로젝트 로컬 DB(`backend/data/crm.sqlite3`)로 주기적 동기화 → 바이오컴 × 커피 × AIBIO 3채널 통합 분석·타겟팅을 단일 쿼리로 수행 가능하게 함.

---

## 1. 설계 원칙

1. **읽기 전용 복제** — Supabase가 진실의 원천(SoT). 로컬 SQLite는 분석용 읽기 복제본.
2. **phone 키 통일** — `customers.phone`의 하이픈·공백 제거해 `imweb_orders.orderer_call`과 조인 가능하도록 정규화.
3. **작은 테이블부터 일괄(full refresh), 큰 테이블은 증분(incremental)** — `payments`, `product_usage`가 증분 대상.
4. **Supabase REST API 사용** — 별도 PostgreSQL 터널 불필요, service_role key로 직접 호출.
5. **로컬 CRM 자산과 충돌 없는 별도 네임스페이스** — 테이블명에 `aibio_` prefix (이미 `imweb_members`, `imweb_orders` 등과 동일 패턴).

---

## 2. 동기화 대상 · 우선순위

| 우선 | AIBIO 테이블 | 로컬 테이블명 | 건수 | 증분 기준 | 목적 |
|---|---|---|---|---|---|
| **P0** | `customers` | `aibio_customers` | 1,074 | `updated_at` | phone 기반 크로스조인 키 |
| **P0** | `payments` | `aibio_payments` | 1,018 | `updated_at` / `payment_id` | 고객별 누적 구매액 |
| **P1** | `packages` | `aibio_packages` | 43 | full (소량) | 특전 원가 파악 |
| **P1** | `products` | `aibio_products` | 42 | full (소량) | 상품 카탈로그 |
| **P1** | `product_usage` | `aibio_product_usage` | 11,092 | `usage_date` 추정 | 세션 빈도 → 리텐션 |
| **P2** | `reservations` | `aibio_reservations` | 356 | `updated_at` | 예약 리드타임 |
| **P2** | `marketing_leads` | `aibio_marketing_leads` | 465 | `updated_at` | 리드→전환 퍼널 |
| **P2** | `payment_details` | `aibio_payment_details` | 14 | full (소량) | 구매 유형 |
| **P3** | `package_products` / `room_products` | 상동 | 88 / 18 | full | 메뉴 구조 |

P0·P1만 우선 구현, P2·P3은 필요 시 추가. **총 필수 데이터량 ≒ 14,000 rows** → 초기 full sync 10~30초 예상.

---

## 3. 로컬 스키마 (제안)

### 3.1 `aibio_customers`

```sql
CREATE TABLE IF NOT EXISTS aibio_customers (
  customer_id         INTEGER PRIMARY KEY,
  name                TEXT NOT NULL,
  phone               TEXT,
  phone_normalized    TEXT,            -- 하이픈·공백 제거본 (조인 키)
  first_visit_date    TEXT,
  last_visit_date     TEXT,
  total_visits        INTEGER,
  total_revenue       INTEGER,          -- 원본 (현재는 0) — 참고용
  customer_status     TEXT,             -- active | lead
  membership_level    TEXT,             -- 현재 전원 'basic'
  gender              TEXT,
  birth_year          INTEGER,
  region              TEXT,
  referral_source     TEXT,
  is_registered       INTEGER,          -- bool
  deleted             INTEGER,
  created_at          TEXT,
  updated_at          TEXT,
  synced_at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_aibio_cust_phone ON aibio_customers(phone_normalized);
CREATE INDEX IF NOT EXISTS idx_aibio_cust_status ON aibio_customers(customer_status);
```

### 3.2 `aibio_payments`

```sql
CREATE TABLE IF NOT EXISTS aibio_payments (
  payment_id          INTEGER PRIMARY KEY,
  customer_id         INTEGER,
  payment_date        TEXT NOT NULL,
  amount              INTEGER NOT NULL,  -- 음수는 환불
  payment_method      TEXT,
  approval_number     TEXT,
  card_holder_name    TEXT,
  payment_number      TEXT,
  notes               TEXT,
  is_refund           INTEGER GENERATED ALWAYS AS (CASE WHEN amount < 0 THEN 1 ELSE 0 END) STORED,
  created_at          TEXT,
  updated_at          TEXT,
  synced_at           TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES aibio_customers(customer_id)
);
CREATE INDEX IF NOT EXISTS idx_aibio_pay_cust ON aibio_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_aibio_pay_date ON aibio_payments(payment_date);
```

### 3.3 나머지 P1 (간략)

- `aibio_packages`: `package_id PK, package_name, total_sessions, valid_months, base_price, grade, is_active, synced_at`
- `aibio_products`: `product_id PK, product_name, price, category, is_active, synced_at`
- `aibio_product_usage`: `usage_id PK, customer_id, product_id, used_at, quantity, ..., synced_at` (실제 컬럼은 스키마 재조회 필요)

---

## 4. 동기화 구현 설계

### 4.1 파일 위치 (seo 프로젝트 규약 반영)

```
backend/src/aibioSync.ts          # 메인 sync 로직 (Supabase REST → SQLite upsert)
backend/src/routes/aibio.ts       # POST /api/aibio/sync-customers, /sync-payments
backend/src/crmLocalDb.ts         # aibio_* 테이블 마이그레이션 + upsert 함수 추가
```

기존 `imweb` 계열 sync(`crmLocalDb.ts`의 `upsertImwebMembers`)와 동일한 패턴 차용.

### 4.2 핵심 sync 함수 (의사코드)

```typescript
// backend/src/aibioSync.ts
import { env } from './env';

const AIBIO_URL = `https://${env.AIBIO_SUPABASE_PROJECT_ID}.supabase.co/rest/v1`;
const HEADERS = {
  apikey: env.AIBIO_SUPABASE_SECRET_KEY,
  Authorization: `Bearer ${env.AIBIO_SUPABASE_SECRET_KEY}`,
};

async function fetchTableAll(table: string, params: Record<string, string> = {}) {
  const all = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const qs = new URLSearchParams({ select: '*', order: 'created_at', limit: String(limit), offset: String(offset), ...params });
    const res = await fetch(`${AIBIO_URL}/${table}?${qs}`, { headers: HEADERS });
    const rows = await res.json();
    all.push(...rows);
    if (rows.length < limit) break;
    offset += limit;
  }
  return all;
}

export async function syncAibioCustomers(mode: 'full' | 'incremental' = 'incremental') {
  const lastSync = mode === 'full' ? null : getLastSyncedAt('aibio_customers');
  const params = lastSync ? { updated_at: `gte.${lastSync}` } : {};
  const rows = await fetchTableAll('customers', params);
  upsertAibioCustomers(rows);
  return { synced: rows.length, mode };
}

export async function syncAibioPayments(mode: 'full' | 'incremental' = 'incremental') {
  const lastSync = mode === 'full' ? null : getLastSyncedAt('aibio_payments');
  const params = lastSync ? { updated_at: `gte.${lastSync}` } : {};
  const rows = await fetchTableAll('payments', params);
  upsertAibioPayments(rows);
  return { synced: rows.length, mode };
}
```

### 4.3 `env.ts` 환경변수 추가 ✅ (구현 완료)

```typescript
// backend/src/env.ts
AIBIO_SUPABASE_PROJECT_ID: z.string().min(1).optional(),       // smyqywkwxfjusvibxrqf
AIBIO_SUPABASE_SECRET_KEY: z.string().min(1).optional(),       // sb_secret_...
AIBIO_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),  // sb_publishable_... (옵션, 클라이언트 코드에서 사용시)
```

- ✅ `.env`의 `AIBIO_SUPABASE_Pubilshable_key` 오타 수정 완료 (`Publishable_key`로 변경).
- `env.ts`의 envSource는 기존 오타 변수명(`AIBIO_SUPABASE_Secret_Keys`, `AIBIO_SUPABASE_Pubilshable_key`)에 대한 fallback 처리도 유지해 기존 코드 호환성 보장.

### 4.4 라우트 엔드포인트

```
POST /api/aibio/sync-customers     body: { mode: 'full'|'incremental' }
POST /api/aibio/sync-payments      body: { mode: 'full'|'incremental' }
POST /api/aibio/sync-all           body: { mode: 'full'|'incremental' }
GET  /api/aibio/stats              → { customers, payments, last_synced, revenue_net }
```

### 4.5 스케줄

- **운영 크론**: 일 1회 새벽 03:00 KST `incremental` sync (updated_at 기준)
- **주간 풀 싱크**: 일요일 04:00 KST `full` (drift 보정 · 약 15,000건, 30초 내)
- 동기화 완료 후 Slack/알림톡으로 diff 리포트 전송 (옵션)

---

## 5. 크로스 조인 View 설계

로컬 SQLite에 `aibio_customers`, `aibio_payments` 저장 후, 기존 `imweb_orders`와 phone 기준 단일 뷰 생성:

```sql
CREATE VIEW IF NOT EXISTS v_unified_customer_revenue AS
WITH aibio_agg AS (
  SELECT
    ac.phone_normalized AS phone,
    SUM(CASE WHEN ap.amount > 0 THEN ap.amount ELSE 0 END) AS aibio_gross,
    SUM(CASE WHEN ap.amount < 0 THEN ap.amount ELSE 0 END) AS aibio_refund,
    SUM(ap.amount) AS aibio_net,
    COUNT(ap.payment_id) AS aibio_payment_count,
    MAX(ap.payment_date) AS aibio_last_payment
  FROM aibio_customers ac
  LEFT JOIN aibio_payments ap ON ap.customer_id = ac.customer_id
  WHERE ac.phone_normalized IS NOT NULL AND ac.phone_normalized != ''
  GROUP BY ac.phone_normalized
),
bio_agg AS (
  SELECT REPLACE(REPLACE(orderer_call,'-',''),' ','') AS phone,
    SUM(payment_amount) AS bio_rev, COUNT(*) AS bio_orders, MAX(order_time) AS bio_last
  FROM imweb_orders WHERE site='biocom' AND orderer_call IS NOT NULL
  GROUP BY phone
),
coff_agg AS (
  SELECT REPLACE(REPLACE(orderer_call,'-',''),' ','') AS phone,
    SUM(payment_amount) AS coff_rev, COUNT(*) AS coff_orders, MAX(order_time) AS coff_last
  FROM imweb_orders WHERE site='thecleancoffee' AND orderer_call IS NOT NULL
  GROUP BY phone
),
phones AS (
  SELECT phone FROM aibio_agg UNION SELECT phone FROM bio_agg UNION SELECT phone FROM coff_agg
)
SELECT
  p.phone,
  COALESCE(a.aibio_net, 0)   AS aibio,
  COALESCE(b.bio_rev, 0)     AS biocom,
  COALESCE(c.coff_rev, 0)    AS coffee,
  COALESCE(a.aibio_net,0) + COALESCE(b.bio_rev,0) + COALESCE(c.coff_rev,0) AS unified_total,
  CASE WHEN a.aibio_net > 0 THEN 1 ELSE 0 END AS has_aibio,
  CASE WHEN b.bio_rev  > 0 THEN 1 ELSE 0 END AS has_biocom,
  CASE WHEN c.coff_rev > 0 THEN 1 ELSE 0 END AS has_coffee,
  MAX(a.aibio_last_payment, b.bio_last, c.coff_last) AS last_activity
FROM phones p
LEFT JOIN aibio_agg a ON a.phone = p.phone
LEFT JOIN bio_agg   b ON b.phone = p.phone
LEFT JOIN coff_agg  c ON c.phone = p.phone;
```

이 뷰 하나로:
- 통합 등급 책정 (`unified_total` 기준 5밴드)
- 크로스 구매 대상 발굴 (`has_aibio + has_biocom + has_coffee`)
- 타겟 알림톡 세그먼트 추출

---

## 6. 구현 단계 (Phase)

| Phase | 내용 | 예상 공수 |
|---|---|---|
| **P-C0** | `.env` 변수명 정리 + `env.ts` zod 스키마 추가 | 10분 |
| **P-C1** | `crmLocalDb.ts`에 `aibio_customers`, `aibio_payments` 테이블 migration + upsert 함수 | 1시간 |
| **P-C2** | `aibioSync.ts` 작성 (full/incremental) + `/api/aibio/sync-*` 라우트 | 2시간 |
| **P-C3** | 초기 full sync 실행 → 1,074 + 1,018 건 로드 | 1분 |
| **P-C4** | `v_unified_customer_revenue` 뷰 생성 + 검증 쿼리 | 30분 |
| **P-C5** | `packages`, `products`, `product_usage` P1 테이블 추가 | 1시간 |
| **P-C6** | 일일 크론 설정 (기존 `crmLocal` sync 패턴 재사용) | 30분 |
| **P-C7** | `/coffeevip` 페이지가 로컬 뷰 기준으로 실시간 통합 분포 표시하도록 연결 | 1시간 |

**총 예상 공수 ≒ 6~7시간** (1일 스프린트)

---

## 7. 검증 체크리스트

- [ ] 초기 full sync 후 `aibio_customers` 건수 = 1,074 일치 확인
- [ ] `aibio_payments` 건수 = 1,018 · SUM(amount) = ₩387,880,010 (net) 일치
- [ ] `v_unified_customer_revenue`의 `has_aibio+has_biocom+has_coffee=2` 행 = 28명 (현재 크로스 매트릭스와 일치)
- [ ] incremental sync → 신규/수정된 행만 upsert 되는지 (last sync 이후 Supabase에서 1건 수동 수정 후 재확인)
- [ ] phone 정규화: 하이픈 있는 번호가 양쪽에서 동일하게 저장되는지

---

## 8. 리스크 · 주의

| 항목 | 내용 | 완화 |
|---|---|---|
| **Supabase RLS 우회** | service_role 키는 RLS 정책 무시 · 실수로 쓰기 요청 시 원장 손상 가능 | sync 코드는 **read-only**. `POST`/`PATCH`/`DELETE` 호출 금지 lint 규칙 추가 |
| **시간축 불일치** | AIBIO 3.5년 vs 바이오컴/커피 3.5개월 | 통합 등급은 "직전 12개월" 필터 적용 후 계산 |
| **phone 중복/누락** | AIBIO 1,074명 중 phone 없는 고객 존재 가능 | `phone_normalized IS NULL` 레코드는 통합 뷰에서 제외 · 별도 표기 |
| **환불 로직 차이** | AIBIO는 음수 amount, 바이오컴 imweb_orders는 별도 status? | 각 채널별 net 계산 로직 명시적으로 분리 |
| **Supabase API rate limit** | 무료 플랜은 분당 제한 존재 | sync는 야간 1회 · 버스트 방지 |

---

## 9. 다음 액션

1. `.env` 변수명 오타 수정 (`Pubilshable` → `PUBLISHABLE`)
2. `aibio-backend` 레포 clone 권한 획득 후 Prisma schema 확인 (정확한 컬럼·FK)
3. P-C1 ~ P-C4 구현 (반나절)
4. 초기 데이터 로드 · 통합 뷰 검증
5. `/coffeevip` 페이지의 "통합 분포" 차트를 로컬 뷰 기반 실시간 API로 전환

---

## 10. 구현 진척 (2026-04-24 기록)

| Phase | 상태 | 비고 |
|---|---|---|
| P-C0 · env 확장 | ✅ 완료 | `backend/src/env.ts`에 `AIBIO_SUPABASE_PROJECT_ID` / `AIBIO_SUPABASE_SECRET_KEY` / `AIBIO_SUPABASE_PUBLISHABLE_KEY` 추가 · 기존 오타 변수에 대한 fallback도 유지 |
| P-C1 · 테이블 migration | ✅ 완료 | `backend/src/crmLocalDb.ts` 431행 부근에 `aibio_customers`, `aibio_payments` 스키마 + 인덱스 추가 |
| P-C2 · sync 모듈 + 라우트 | ✅ 완료 | `backend/src/aibioSync.ts` 신규 · `backend/src/routes/aibio.ts` 신규 · `bootstrap/registerRoutes.ts`에 연결 |
| P-C3 · 초기 full sync | ✅ 완료 | `POST /api/aibio/sync-all` body `{"mode":"full"}` → **1.6초에 customers 1,074 + payments 1,018 적재**. net revenue ₩387,880,010 검증 일치 |
| P-C4 · 통합 뷰 | 부분 | 로컬 SQLite는 AIBIO 데이터만 있음. 3채널 통합은 PG(`tb_iamweb_users`·`tb_playauto_orders`) + 로컬 SQLite(`aibio_payments`) 조합으로만 가능 → `backend/scripts/unified-tier-calc.cjs`로 집계, 결과 `/tmp/unified_tier_result.json` |
| P-C5 · 기타 P1 테이블 | 미구현 | `packages`, `products`, `product_usage`는 후속 작업 |
| P-C6 · 크론 | 미구현 | 현재 수동 호출. 야간 cron 등록은 후속 |
| P-C7 · 프론트 연결 | 미구현 | `/coffeevip` 차트는 아직 정적 데이터. `/api/aibio/tier-distribution` 연결 대기 |

### 10.1 새 엔드포인트

- `GET  /api/aibio/stats` — 적재 건수·net 매출·마지막 동기화 시각
- `POST /api/aibio/sync-customers` · `/sync-payments` · `/sync-all` — body `{mode: "full"|"incremental"}`
- `GET  /api/aibio/tier-distribution` — 로컬 aibio_payments 기준 직전 12개월 티어 분포

### 10.2 통합 등급 실측 결과 (직전 12개월 · 2025-04-25 ~ 2026-04-24)

`backend/scripts/unified-tier-calc.cjs` 실행 결과:

| 티어 (기존 설계) | 기준 | 실측 인원 | 3채널 / 2채널 / 1채널 |
|---|---|---|---|
| PRIME | ₩50M+ | 0 | — |
| PLATINUM | ₩15M+ | 0 | — |
| GOLD | ₩5M+ | 23 | 0 / 2 / 21 |
| SILVER | ₩2M+ | 200 | 1 / 10 / 189 |
| INITIATE | ₩500K+ | 2,444 | 0 / 7 / 2,437 |

채널 조합: 바이오컴 only 23,116 / 커피 only 637 / AIBIO only 138 / 바이오컴+커피 23 / 바이오컴+AIBIO 14 / 커피+AIBIO 0 / **3채널 1명**.

최고 통합 구매자: ₩13,116,200 (바이오컴 단독).
→ 이전 3.5개월 임시 데이터 기반 "₩2.6억" 수치는 **과대표기**였음이 확정. `coffee/coffeevip.md` §3.2에 금액대 재조정 반영 완료.
