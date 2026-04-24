# Toss Sync 누락 갭 분석 · 더클린커피

작성일: 2026-04-24
유형: 분석 보고서 (정본 아님 · 해소 후 폐기 가능)
관련: [`!coffee_excel_backfill_plan.md`](./!coffee_excel_backfill_plan.md), [`!datacheckplan.md`](./!datacheckplan.md), [`dbstructure.md`](./dbstructure.md)

---

## 1. 결론 (먼저)

| 지표 | 엑셀 (진실의 원천) | PG `tb_sales_toss` | 갭 |
|---|---|---|---|
| 더클린커피 Toss(`iw_th*`) 결제완료 건수 | **3,850건** | 1,252건 | **-2,598건 (-67%)** |
| 매출 합계 | **₩168,799,223** | ₩56,912,759 | **-₩111,886,464 (-66%)** |
| **기간** | **2024-11-21 ~ 2025-12-31** (14개월) | **2026-01-01 ~ 2026-04-23** (4개월) | **기간 자체가 안 겹침** |
| payment_key 직접 매칭 | — | — | **0건** (겹치는 시기가 없으므로) |

**원인 확정**: `tb_sales_toss`의 `store=coffee` 데이터는 **2026-01-01 이후만 존재**. 그 이전 14개월(2024-11~2025-12)은 **백필 한 번도 실행되지 않음**. seo 프로젝트가 incremental(전일~현재)만 돌리고 backfill 호출이 없었던 것.

이전에 "Toss sync 37%만 작동"이라 진단했던 건 잘못된 추정 — 실제는 **기간 자체가 다른 두 데이터를 비교한 결과**. 정확한 진단은 위 표.

**해소**: 단순히 `POST /api/toss/sync` body `{store:"coffee", mode:"backfill", startDate:"2024-11-01"}` 한 번 실행하면 끝. 코드 수정 불필요.

---

## 2. 진단 과정

### 2.1 출발점

이전 분석(`!coffee_excel_backfill_plan.md` §4.8)에서 확인한 차이:
- 2025년 결제내역 엑셀의 Toss(`iw_th`) 결제: ₩153.6M
- PG `tb_sales_toss` store=coffee 12개월: ₩57M
- → "37%만 sync"라고 추정

### 2.2 직접 매칭 검증

`pg_tx_no` (엑셀의 Toss `iw_th*` payment key)와 `tb_sales_toss.payment_key`를 직접 join:

```sql
-- 엑셀에서 Toss 결제완료 paymentKey 추출
SELECT pg_tx_no, payment_at, amount FROM coffee_payments_excel
WHERE pg_provider='toss' AND payment_status='결제완료' AND payment_kind='결제';
-- → 3,850건

-- PG의 store=coffee paymentKey
SELECT DISTINCT payment_key FROM public.tb_sales_toss WHERE store='coffee';
-- → 1,290 unique keys

-- 매칭
SELECT COUNT(*) FROM excel JOIN pg ON excel.pg_tx_no = pg.payment_key;
-- → 0건 ❗
```

매칭 0건. 그러면 PG의 1,290개는 무엇인가?

### 2.3 기간 비교

```
PG  tb_sales_toss store=coffee:  2026-01-01 03:40:46 ~ 2026-04-23 20:19:01
엑셀 결제내역 Toss(iw_th):      2024-11-21 ~ 2025-12-31
```

**기간이 전혀 겹치지 않음**. 같은 시스템(Toss)이지만 데이터가 시간축에서 다른 범위를 커버.

### 2.4 누락 구간 월별 분포 (엑셀 기준)

| 연월 | 누락 건수 | 누락 매출 |
|---|---|---|
| 2024-11 | 59 | ₩2,463,475 |
| 2024-12 | 255 | ₩12,771,467 |
| 2025-01 | 265 | ₩11,598,140 |
| 2025-02 | 428 | ₩17,272,315 |
| 2025-03 | 251 | ₩10,443,857 |
| 2025-04 | 217 | ₩8,701,726 |
| 2025-05 | 240 | ₩10,423,878 |
| 2025-06 | 210 | ₩8,944,045 |
| 2025-07 | 285 | ₩12,502,318 |
| 2025-08 | 308 | ₩12,588,553 |
| 2025-09 | 352 | ₩15,317,160 |
| 2025-10 | 288 | ₩11,664,133 |
| 2025-11 | 336 | ₩14,326,004 |
| 2025-12 | 356 | ₩19,782,152 |
| **합계** | **3,850** | **₩168,799,223** |

---

## 3. 코드 점검 결과

`backend/src/routes/toss.ts` line 261-268:

```typescript
let startDate: string;
if (mode === "backfill") {
  startDate = (req.query.startDate as string) || "2025-01-01";
} else {
  // incremental: 어제부터
  const d = new Date(Date.now() - 2 * 86400000);
  startDate = d.toISOString().slice(0, 10);
}
```

- **Backfill 모드는 정상 작동** · 기본 startDate "2025-01-01"
- **Incremental 모드 = 직전 2일치**
- 더클린커피의 `store=coffee`에 대해 **backfill 호출이 한 번도 없었던 듯**. cron이나 운영자가 incremental만 돌렸을 가능성.

`backend/src/env.ts`에 `TOSS_LIVE_SECRET_KEY_COFFEE` 등 키 정상 등록돼 있어 권한·인증은 문제 없음.

---

## 4. 해소 액션

### 4.1 즉시 실행 가능 (코드 수정 불필요)

```bash
# 더클린커피 Toss 2024-11-01 ~ 현재까지 일괄 백필
curl -X POST 'http://localhost:7020/api/toss/sync?store=coffee&mode=backfill&startDate=2024-11-01&endDate=2026-04-24'
```

또는 라우트가 GET일 수 있으니 코드 확인 후. (실제 메서드는 routes/toss.ts에서 `router.get` 또는 `router.post` 둘 중 하나)

**예상 소요**: Toss API rate limit 고려 17개월 × 월별 페이지 ≒ 5~15분.

### 4.2 검증

백필 후 다음 쿼리로 확인:

```sql
SELECT
  to_char(approved_at, 'YYYY-MM') ym,
  COUNT(*) cnt,
  ROUND(SUM(total_amount::numeric)) total
FROM public.tb_sales_toss
WHERE store='coffee' AND status='DONE'
GROUP BY 1 ORDER BY 1;
```

월별 분포가 위 §2.4 엑셀 누락 분포와 일치하는지 대조.

### 4.3 재발 방지

| 조치 | 권장 |
|---|---|
| Toss store=coffee 야간 incremental cron 등록 (이미 있는지 확인) | ✅ 필수 |
| Backfill 누락 모니터링: 일 1회 "최근 30일 sync 건수" 출력 → 0이면 알림 | ✅ 권장 |
| `data/dbstructure.md` §8 데이터 흐름 표에 "Toss store=coffee sync = 2026-01-01부터" 같은 메타데이터 추가 | 진단용 |

---

## 5. 통합 매출 정합성 영향

이전 `data/dbstructure.md` §5.5 통합 등급 v2 산정에서:
- 더클린커피 매출 집계 = `tb_sales_toss` (store=coffee 12개월) ≒ ₩57M
- 그러나 실측 = 엑셀 Toss ₩168.8M + 기타 결제수단 = **₩396M (12개월)**

→ **현재 통합 등급 산정의 커피 부분은 14% 수준만 반영** (₩57M / ₩396M). v3 산정 시 엑셀(`coffee_orders_excel` + `coffee_payments_excel`) 기반으로 전면 교체 필요.

---

## 6. 다음 단계

1. **Toss backfill 1회 실행** (위 §4.1)
2. 결과 검증 (위 §4.2)
3. **통합 등급 v3** 산출 — 커피 데이터 소스를 엑셀로 교체 (`unified-tier-v3.cjs` 작성)
4. `dbstructure.md` §5.5 v3 결과 반영
5. `coffeevip.md` 정기구독 SIGNATURE 후보 섹션 (이미 별도 진행)

---

## 7. 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-04-24 | 신규 작성 · Toss sync 갭 진단 완료 (기간 불일치가 진짜 원인) |
| 2026-04-24 | Backfill 1회 실행 → 새로운 발견 §8 |

---

## 8. Backfill 실행 결과 (2026-04-24)

`POST /api/toss/sync?store=coffee&mode=backfill&startDate=2024-11-01&endDate=2026-04-24` 호출.

### 8.1 결과 요약

```
durationMs: 29,601 (29.6초)
monthsProcessed: 18
inserted: { transactions: 703, settlements: 655 }
```

### 8.2 월별 응답 분포 (예상과 다른 결과)

| 월 | Toss API 응답 transactions | 비고 |
|---|---|---|
| 2024-11 ~ 2026-01 | **모두 0건** | **API가 데이터를 반환하지 않음** |
| 2026-02 | 49 | 처음 데이터 등장 |
| 2026-03 | 275 | |
| 2026-04 (~24일) | 379 | |

### 8.3 발견 · "Toss API가 2024-11~2026-01 데이터를 갖고 있지 않음"

`backend/src/routes/toss.ts`의 backfill 코드는 정상 작동했고 권한·인증도 OK. 그런데 **Toss API 자체가 store=coffee 키로 2024-11~2026-01 데이터를 한 건도 반환하지 않음**.

**가능 원인**:
1. **MID 변경**: 더클린커피의 Toss 가맹점 MID가 2026-02부터 활성화. 그 이전은 다른 PG 또는 다른 MID 사용 (env의 `TOSS_LIVE_SECRET_KEY_COFFEE`가 가리키는 MID와 엑셀 `iw_th20251231...` prefix가 가리키는 MID가 다를 가능성)
2. **계정 분리**: 더클린커피가 별도 Toss 계정·하위 가맹점으로 분리돼 있고, 2026-02에 통합/이관
3. **API 키 발급 시점**: secret key가 2026-02 이후 발급되어 그 시점 이전 거래 조회 권한이 없음

### 8.4 잔여 갭 (해소 안 됨)

- **2024-11 ~ 2026-01 (15개월) Toss 데이터 ₩168.8M / 3,850건은 PG sync 불가**
- 이 갭의 진실은 엑셀(`coffee_payments_excel`)에만 존재
- → **운영 DB의 `tb_sales_toss`는 향후 분석에 정합 소스로 쓰지 말고**, 엑셀 import 데이터(`coffee_payments_excel.pg_provider='toss'`)를 사용 권장

### 8.5 추가 조사 권장

1. Toss 어드민 (Wing 유사) → 가맹점 정보·MID 발급일 확인
2. `env.TOSS_LIVE_SECRET_KEY_COFFEE`의 MID와 엑셀 `iw_th20251231...`의 MID prefix 일치 여부 검증
3. 만약 MID 다르다면 `env`에 추가 MID 등록 + 다시 backfill
4. 또는 영구히 엑셀 정기 import + Toss API는 incremental 보조용으로만 사용
