import "dotenv/config";
import path from "path";
import Database from "better-sqlite3";

import { queryPg } from "../src/postgres";

/*
 * 1월 1-7일 주문 헤더 복구 조사 (read-only 드라이런).
 * 공동구매내역.md "주문 헤더 누락 원인" 섹션 대응.
 *
 * 목적:
 * 1. 로컬 `imweb_order_items`에서 2026-01-01 ~ 2026-01-07 `site` 미확정 주문번호 리스트 확보
 * 2. 운영 `public.tb_iamweb_users`의 실제 컬럼 스키마 확인(컬럼명/타입)
 * 3. 716개 주문번호 중 운영 DB 매칭률/금액 프로파일 확인
 * 4. Toss 정산 원장 매칭 교차 검증
 *
 * 실제 로컬 `imweb_orders` INSERT는 하지 않는다. 결과만 콘솔에 출력.
 * 백필 실행은 TJ 승인 후 `backend/scripts/backfill-iamweb-january-header.ts`를 별도로 작성하는 것으로 한다.
 */

const MISSING_FROM_ISO = "2026-01-01";
const MISSING_TO_ISO = "2026-01-07";

const main = async () => {
  // 1. 로컬 SQLite에서 `site`-미확정 1월 1-7일 주문번호 추출
  const dbPath = path.resolve(__dirname, "..", "data", "crm.sqlite3");
  const db = new Database(dbPath, { readonly: true });
  try {
    const orderNos = db
      .prepare(
        `SELECT DISTINCT order_no
         FROM imweb_order_items
         WHERE (site IS NULL OR site='' OR site='biocom')
           AND ord_time >= ?
           AND ord_time < datetime(?, '+1 day')
           AND order_no NOT IN (SELECT order_no FROM imweb_orders WHERE site='biocom')`,
      )
      .all(MISSING_FROM_ISO, MISSING_TO_ISO) as Array<{ order_no: string }>;
    console.log(`## local missing order_no count (${MISSING_FROM_ISO} ~ ${MISSING_TO_ISO}):`, orderNos.length);
    console.log("  sample 10:", orderNos.slice(0, 10).map((r) => r.order_no));

    const orderNoList = orderNos.map((r) => r.order_no);

    // 2. 운영 DB 스키마 확인
    const schemaRes = await queryPg<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_schema='public' AND table_name='tb_iamweb_users'
       ORDER BY ordinal_position`,
    );
    console.log("\n## public.tb_iamweb_users columns (total", schemaRes.rowCount, "):");
    for (const r of schemaRes.rows) {
      console.log(`  ${r.column_name} (${r.data_type})`);
    }

    // 3. 주문번호 매칭 후보 컬럼 추정 — 보통 order_no / order_number / shop_order_no
    const candidateCols = schemaRes.rows
      .map((r) => r.column_name)
      .filter((c) => /order.*no|order.*number|shop.*order/i.test(c));
    console.log("\n## candidate order_no columns:", candidateCols);

    if (candidateCols.length === 0) {
      console.log("  WARN: order_no column not found. Manual inspection needed.");
      return;
    }

    // 4. 각 후보 컬럼별 매칭률 측정
    for (const col of candidateCols) {
      const q = `SELECT COUNT(*)::text AS matched
                 FROM public.tb_iamweb_users
                 WHERE ${col}::text = ANY($1::text[])`;
      try {
        const res = await queryPg<{ matched: string }>(q, [orderNoList]);
        console.log(`  ${col}: matched=${res.rows[0]?.matched ?? 0} / ${orderNoList.length}`);
      } catch (e) {
        console.log(`  ${col}: query error ${(e as Error).message}`);
      }
    }

    // 5. Toss 정산 원장 교차 매칭(로컬)
    // Toss order_id는 `{imweb_order_no}-P1` 형식이라 prefix 매칭한다.
    const likePatterns = orderNoList.map((n) => `${n}-%`);
    const tossMatched = db
      .prepare(
        `SELECT COUNT(DISTINCT substr(order_id, 1, instr(order_id,'-') - 1)) AS n
         FROM toss_transactions
         WHERE substr(order_id, 1, instr(order_id,'-') - 1) IN (${orderNoList
           .map(() => "?")
           .join(",")})
         AND status = 'DONE'`,
      )
      .get(...orderNoList) as { n: number };
    console.log(`\n## Toss transactions matched (DONE, prefix): ${tossMatched.n} / ${orderNoList.length}`);

    const tossSumRow = db
      .prepare(
        `SELECT COALESCE(SUM(amount),0) AS gross, COUNT(DISTINCT order_id) AS txn_rows
         FROM toss_transactions
         WHERE substr(order_id, 1, instr(order_id,'-') - 1) IN (${orderNoList
           .map(() => "?")
           .join(",")})
         AND status = 'DONE'`,
      )
      .get(...orderNoList) as { gross: number; txn_rows: number };
    console.log(`  Toss gross (sum amount, DONE only): ${tossSumRow.gross?.toLocaleString?.() ?? tossSumRow.gross}`);
    console.log(`  Toss txn rows (DONE): ${tossSumRow.txn_rows}`);

    // status 미제한 — 가상계좌 WAITING 포함 전체
    const tossAny = db
      .prepare(
        `SELECT COUNT(DISTINCT substr(order_id, 1, instr(order_id,'-') - 1)) AS n,
                COALESCE(SUM(amount),0) AS gross
         FROM toss_transactions
         WHERE substr(order_id, 1, instr(order_id,'-') - 1) IN (${orderNoList
           .map(() => "?")
           .join(",")})`,
      )
      .get(...orderNoList) as { n: number; gross: number };
    console.log(
      `  Toss matched (all status): ${tossAny.n} / ${orderNoList.length}, gross ${tossAny.gross?.toLocaleString?.() ?? tossAny.gross}`,
    );
    void likePatterns;
  } finally {
    db.close();
  }
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
