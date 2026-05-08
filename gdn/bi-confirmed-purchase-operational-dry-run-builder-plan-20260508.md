# ConfirmedPurchasePrep 운영 PG 기반 새 dry-run input builder 설계

작성 시각: 2026-05-08 13:35 KST
대상: ConfirmedPurchasePrep agent input 갱신 (5/5 dry-run → canary window 측정 가능)
문서 성격: Green Lane 설계 (코드 작성 전). 본 sprint 범위에서 builder 구현 안 함.
관련 정본: [[../data/!channelfunnel]], [[google-ads-confirmed-purchase-execution-approval-20260505]], [[path-c-member-code-attribution-design-20260508]]
관련 데이터: [[../data/path-c-member-code-dry-run-20260508]], [[../data/npay-actual-confirmed-paid-click-join-dry-run-20260508]]
Status: 설계 단계. 4 Phase 분리.
Do not use for: 광고 conversion upload, send, deploy 우선

## 5줄 결론

1. **현재 ConfirmedPurchasePrep input 은 5/5 dry-run JSON 고정**. canary window (5/7 23:01~ 5/8 23:01 KST) 결제 측정에 적용 안 됨 → builder 가 없으면 Path C/B effect 영원히 측정 불가.
2. **builder 핵심 = 운영 PG `tb_iamweb_users` + `tb_playauto_orders` read-only join 으로 canary 결제완료 row 매일 재생성**. 1일 cadence. 운영 DB write 없음, 로컬 JSON 파일만 산출.
3. **Path C 매개를 위해 input 에 member_code 필드 추가** + paid_click_intent_ledger 조회 fallback chain (Path A → Path C 순서) + audit trail 카운터.
4. **본 agent 자율 영역**: Phase 0 (설계, 본 문서) + Phase 1 (builder 코드 작성) + Phase 2 (로컬 dry-run). 운영 cron schedule 등록은 별 Yellow.
5. ConfirmedPurchasePrep PASS 임계: with_click_id ≥ 50 + `paid_click_intent_member_code_match` source 5건 이상 + 기존 dry-run 결과(5/5 fixture 17건)와 schema 일관 + Auditor verdict PASS.

## 1. 무엇을 (What)

### 새 builder 산출 대상

| 산출 | 위치 | format |
|---|---|---|
| `data/confirmed-purchase-prep-input-canary-20260508.json` | 매일 갱신 | dry-run input row array (UTF-8 JSON) |
| `data/confirmed-purchase-prep-input-canary-{date}.json` | 매일 갱신 | 일자별 archive |
| `data/confirmed-purchase-prep-builder-audit-{date}.json` | 매일 갱신 | row count / source 분포 / freshness audit |

### 입력 row schema 확장

기존 schema:
```json
{
  "order_no": "string",
  "member_code": "m{date}{hex} | gu{date}{hex} | empty",
  "order_time_kst": "ISO 8601",
  "pay_type": "card | npay | etc | virtual | free",
  "pg_type": "tosspayments | nicepay | npay",
  "imweb_status": "order_paid | delivered | order_complete",
  "value": "number (KRW)",
  "currency": "KRW",
  "ga_session_id": "string | null",
  "client_id": "string | null",
  "click_id_type": "gclid | gbraid | wbraid | null",
  "click_id_value": "string | null",
  "attribution_source": "ga4_bigquery_chain | paid_click_intent_member_code_match | none"
}
```

신규 필드 (Path C 매개):
- `attribution_source`: `paid_click_intent_member_code_match` 우선, `ga4_bigquery_chain` fallback, 둘 다 없으면 `none`
- `attribution_chain_window_hours`: paid_click_intent.received_at vs imweb_orders.payment_at 시간차

## 2. 왜 (Why)

### 현재 input 한계 (1줄)

```text
data/confirmed-purchase-prep-input-20260505.json (5/5 dry-run, 17건 fixture)
→ canary window (5/7~) 결제 측정에 적용 불가
→ Path C effect 측정 영원히 불가
```

### builder 효과

| 측면 | builder 없음 | builder 있음 |
|---|---|---|
| canary window 결제 측정 | 영원히 fixture | 매일 갱신 |
| Path C effect 측정 | 불가 | 가능 (`paid_click_intent_member_code_match` 카운트) |
| Path A vs Path C uplift 정량 | 추정 | 실측 |
| ConfirmedPurchasePrep PASS 판정 | 5/5 fixture 17건 기반 | canary window 실측 기반 |
| TJ 승인 근거 | 약함 (예전 fixture) | 강함 (실시간 데이터) |

### 운영 PG read-only 가 적합한 이유

| 검토 | 운영 PG (tb_iamweb_users, tb_playauto_orders) | 운영 sqlite (imweb_orders) |
|---|---|---|
| 데이터 깊이 | 9.7만 회원 + 12.1만 주문 | 최근 3.5개월만 |
| 정합성 | 진실의 원천 (TJ 정의) | 시간 윈도 누락 |
| pay_type / pg_type 정확 | 정확 | 일부 누락 |
| 환불 처리 | cancellation_reason 컬럼 명확 | imweb_status 기반 추정 |
| read-only 정책 | TJ 영구 정책 | 동일 |
| **권장도** | **primary** | secondary cross-check |

## 3. 어떻게 (How) — 4 Phase

### Phase 0 — 설계 (본 문서, 완료)

설계만. 코드 변경 없음.

### Phase 1 — builder 코드 작성 (본 agent 자율, Green)

**`backend/scripts/confirmed-purchase-prep-input-builder.ts`** 신규:

```typescript
import { Pool } from 'pg';
import { lookupByMemberCode } from '../src/paidClickIntentLog';
import * as fs from 'fs';

interface ConfirmedPurchaseRow {
  order_no: string;
  member_code: string;
  order_time_kst: string;
  pay_type: string;
  pg_type: string;
  imweb_status: string;
  value: number;
  currency: string;
  ga_session_id: string | null;
  client_id: string | null;
  click_id_type: 'gclid' | 'gbraid' | 'wbraid' | null;
  click_id_value: string | null;
  attribution_source: 
    | 'paid_click_intent_member_code_match'
    | 'ga4_bigquery_chain'
    | 'none';
  attribution_chain_window_hours: number | null;
}

const buildCanaryWindowInput = async (windowFromKst: string, windowToKst: string) => {
  const pgUrl = (process.env.DATABASE_URL || '').replace(
    'postgresql+asyncpg://', 'postgresql://'
  );
  const pool = new Pool({ connectionString: pgUrl });
  
  // 1) 운영 PG 에서 canary window 결제완료 row 추출 (read-only)
  const sql = `
    SELECT 
      o.order_no, o.member_code, o.payment_at AS order_time_kst,
      o.pay_type, o.pg_type, o.imweb_status, o.amount AS value,
      o.cancellation_reason, o.return_reason
    FROM tb_playauto_orders o
    WHERE o.payment_at >= $1::timestamptz AND o.payment_at < $2::timestamptz
      AND o.imweb_status IN ('order_paid', 'delivered', 'order_complete')
      AND COALESCE(o.cancellation_reason, '') = ''
      AND COALESCE(o.return_reason, '') = ''
      AND o.shop = 'imweb'  -- 자사몰 한정
    ORDER BY o.payment_at ASC
  `;
  const result = await pool.query(sql, [windowFromKst, windowToKst]);
  await pool.end();
  
  // 2) 각 row에 paid_click_intent_ledger 매개 attribution chain 시도
  const rows: ConfirmedPurchaseRow[] = result.rows.map((r) => {
    let attribution_source: ConfirmedPurchaseRow['attribution_source'] = 'none';
    let click_id_type: ConfirmedPurchaseRow['click_id_type'] = null;
    let click_id_value: string | null = null;
    let attribution_chain_window_hours: number | null = null;
    
    // Path C: member_code 매개 (Path C 적용 후만 가능)
    if (r.member_code) {
      const pciRows = lookupByMemberCode(r.member_code, 'biocom', 30);
      if (pciRows.length > 0) {
        const earliest = pciRows[0]; // first-touch
        click_id_type = earliest.clickIdType;
        click_id_value = earliest.clickIdValue;
        attribution_source = 'paid_click_intent_member_code_match';
        attribution_chain_window_hours = 
          (Date.parse(r.order_time_kst) - Date.parse(earliest.receivedAt)) / 3600000;
      }
    }
    
    // Path A: ga_session_id 매개 (별 chain). 본 builder 에서는 미구현 (별 sprint)
    
    return {
      order_no: r.order_no,
      member_code: r.member_code || '',
      order_time_kst: r.order_time_kst,
      pay_type: r.pay_type,
      pg_type: r.pg_type,
      imweb_status: r.imweb_status,
      value: Number(r.value),
      currency: 'KRW',
      ga_session_id: null, // 별 chain
      client_id: null,
      click_id_type,
      click_id_value,
      attribution_source,
      attribution_chain_window_hours,
    };
  });
  
  // 3) audit trail 카운터
  const audit = {
    generated_at_kst: new Date().toISOString(),
    window_from: windowFromKst,
    window_to: windowToKst,
    total_rows: rows.length,
    with_member_code: rows.filter(r => r.member_code).length,
    attribution_source_breakdown: {
      paid_click_intent_member_code_match: rows.filter(r => r.attribution_source === 'paid_click_intent_member_code_match').length,
      ga4_bigquery_chain: rows.filter(r => r.attribution_source === 'ga4_bigquery_chain').length,
      none: rows.filter(r => r.attribution_source === 'none').length,
    },
    pay_type_breakdown: {
      card: rows.filter(r => r.pay_type === 'card').length,
      npay: rows.filter(r => r.pay_type === 'npay').length,
      etc: rows.filter(r => r.pay_type === 'etc').length,
      virtual: rows.filter(r => r.pay_type === 'virtual').length,
      free: rows.filter(r => r.pay_type === 'free').length,
    },
    click_id_type_breakdown: {
      gclid: rows.filter(r => r.click_id_type === 'gclid').length,
      gbraid: rows.filter(r => r.click_id_type === 'gbraid').length,
      wbraid: rows.filter(r => r.click_id_type === 'wbraid').length,
      null: rows.filter(r => r.click_id_type === null).length,
    },
  };
  
  // 4) 파일 저장
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  fs.writeFileSync(
    `data/confirmed-purchase-prep-input-canary-${dateStr}.json`,
    JSON.stringify(rows, null, 2),
  );
  fs.writeFileSync(
    `data/confirmed-purchase-prep-input-canary-latest.json`,
    JSON.stringify(rows, null, 2),
  );
  fs.writeFileSync(
    `data/confirmed-purchase-prep-builder-audit-${dateStr}.json`,
    JSON.stringify(audit, null, 2),
  );
  
  console.log(`[builder] ${rows.length} rows ${audit.attribution_source_breakdown.paid_click_intent_member_code_match} attributed`);
};

const main = async () => {
  const args = process.argv.slice(2);
  const fromIdx = args.indexOf('--from');
  const toIdx = args.indexOf('--to');
  const windowFromKst = fromIdx >= 0 ? args[fromIdx + 1] : '2026-05-07T23:01:00+09:00';
  const windowToKst = toIdx >= 0 ? args[toIdx + 1] : '2026-05-08T23:01:00+09:00';
  await buildCanaryWindowInput(windowFromKst, windowToKst);
};
main().catch(e => { console.error(e); process.exit(1); });
```

**검증**:
- typecheck PASS
- 로컬 dry-run: `npm --prefix backend run script:confirmed-purchase-prep-input-builder -- --from 2026-05-07T23:01:00+09:00 --to 2026-05-08T23:01:00+09:00`
- 산출 JSON row count vs imweb_orders direct read 비교 (5% 이내)
- pay_type 분포 cross-check

### Phase 2 — 로컬 dry-run (본 agent 자율, Green)

```bash
cd /Users/vibetj/coding/seo
npm --prefix backend run script:confirmed-purchase-prep-input-builder -- \
  --from 2026-05-07T23:01:00+09:00 --to 2026-05-08T23:01:00+09:00

# audit 결과 확인
cat data/confirmed-purchase-prep-builder-audit-20260508.json

# ConfirmedPurchasePrep agent 재실행
npm --prefix backend run agent:confirmed-purchase-prep -- \
  --input data/confirmed-purchase-prep-input-canary-latest.json
```

**기대 결과** (Path C 적용 *전*):
- total_rows ≈ 191 ~ 350 (canary 24h 기준)
- attribution_source_breakdown.paid_click_intent_member_code_match = **0** (paid_click_intent_ledger.member_code 컬럼 미존재)
- attribution_source_breakdown.none ≈ 191
- pay_type_breakdown.npay ≈ 14~30

**Path C 적용 *후* 기대 결과**:
- attribution_source_breakdown.paid_click_intent_member_code_match ≈ 115~150 (60~80% 매칭)
- attribution_source_breakdown.none ≈ 41~76

### Phase 3 — cron schedule 등록 (Yellow 승인)

운영 cron 또는 backend agent scheduler 에 등록:

| 시점 | 작업 |
|---|---|
| 매일 KST 02:00 | 전날 24h 결제완료 input 갱신 |
| 매일 KST 02:30 | ConfirmedPurchasePrep 재실행 |
| 매일 KST 02:45 | Auditor verdict 산출 |
| 매일 KST 03:00 | 결과 정본 link 자동 update (별 sprint) |

### Phase 4 — Auditor 통합 (별 sprint)

ReportAuditor agent 가 builder audit JSON 을 읽고 다음 verdict 산출:

| verdict | 조건 |
|---|---|
| PASS | total_rows ≥ 50 + paid_click_intent_member_code_match ≥ 5 + freshness < 6h + 기존 schema 일관 |
| FAIL | row drop > 50% (전일 대비) 또는 attribution_source 분포 비정상 |
| WARN | freshness > 6h 또는 paid_click_intent_member_code_match < 5 |

## 4. 운영 안전 보장

| 안전 | 보장 방법 |
|---|---|
| 운영 PG write 없음 | builder 는 `SELECT` 만, `INSERT/UPDATE/DELETE` 영구 금지 |
| 운영 PG connection limit | `pool.end()` 명시 호출. 1회 query/run |
| PII 저장 없음 | input JSON에 phone/email/name 필드 없음 (order_no/member_code 만) |
| audit trail 보존 | builder-audit JSON 매일 archive. 누락 시 alert |
| Path C 미적용 시 graceful | `lookupByMemberCode` 가 빈 array 반환 (paid_click_intent_ledger.member_code 컬럼 없으면) |

## 5. ConfirmedPurchasePrep PASS 임계 (Auditor verdict)

| 임계 | 값 | 비고 |
|---|---:|---|
| total_rows | ≥ 50 | canary window 24h 기준 |
| paid_click_intent_member_code_match | ≥ 5 | Path C 적용 후 매칭 검증 |
| freshness | < 6h | 매일 02:00 cron 기준 |
| schema 일관 | == 5/5 fixture schema | column drift 검출 |
| pay_type 분포 정상 | npay > 0 | NPay attribution chain 검증 |
| Auditor verdict | PASS | 정본 link 자동 update 조건 |

## 6. 본 agent 한계와 책임 분리

| 작업 | 본 agent 자율? | 사유 |
|---|---|---|
| Phase 0 설계 (본 문서) | YES | Green |
| Phase 1 builder 코드 작성 | YES | 로컬 |
| Phase 2 로컬 dry-run | YES | read-only |
| Phase 3 cron schedule 등록 | NO | 운영 scheduler 변경 = Yellow |
| Phase 4 Auditor 통합 | NO | 별 sprint 설계 |

## 7. TJ 영역 (Yellow 승인 후보)

| 항목 | 무엇 | 어떻게 | 왜 |
|---|---|---|---|
| Phase 3 cron schedule | 운영 cron 또는 backend agent scheduler 등록 | systemd timer 또는 backend agent runner 스케줄 | 매일 자동 input 갱신 |
| Phase 4 Auditor 통합 | ReportAuditor agent 에 builder audit JSON 통합 | 별 sprint | PASS 판정 자동화 |
| 운영 PG read-only credential | DATABASE_URL_READONLY 별도 env | `bico_readonly@...` 분리 | 안전성 |

## 8. 한 줄 결론

> ConfirmedPurchasePrep input 이 5/5 fixture 라 canary effect 측정 불가. 본 builder 는 운영 PG read-only로 매일 canary window input 갱신 + Path C 매개 attribution chain 자동 시도 + audit trail 산출. **Phase 1~2 본 agent 자율, Phase 3 (cron 등록) 부터 별 Yellow 승인**.
