#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Fix 2026-04-14~15 biocom footer source pollution.
 *
 * 사건: 2026-04-14 22:00 ~ 2026-04-15 20:17 KST (2026-04-14T12:59:35Z ~ 2026-04-15T11:16:52Z UTC)
 * 구간에 biocom footer 가 coffee 라벨 템플릿으로 교체되어, biocom.kr 에서 발생한
 * checkout_started / payment_success 이벤트가 source='thecleancoffee_imweb' 로 기록됨.
 *
 * landing / referrer 컬럼에 'https://biocom.kr' 가 박혀 있으므로 재분류 가능.
 *
 * 사용법:
 *   node fix-attribution-source-pollution.cjs <sqlite-path> dry     (카운트만)
 *   node fix-attribution-source-pollution.cjs <sqlite-path> apply   (실제 UPDATE)
 */

const path = require("node:path");
const fs = require("node:fs");

const dbPathArg = process.argv[2];
const mode = process.argv[3] || "dry";

if (!dbPathArg) {
  console.error("usage: node fix-attribution-source-pollution.cjs <db-path> <dry|apply>");
  process.exit(1);
}
if (!["dry", "apply"].includes(mode)) {
  console.error("mode must be 'dry' or 'apply'");
  process.exit(1);
}
if (!fs.existsSync(dbPathArg)) {
  console.error("db not found:", dbPathArg);
  process.exit(1);
}

// Load better-sqlite3 from backend's node_modules regardless of cwd
const backendRoot = path.resolve(__dirname, "..");
const BetterSqlite3 = require(path.join(backendRoot, "node_modules", "better-sqlite3"));

const POLLUTION_START_UTC = "2026-04-14T12:59:35.000Z"; // exclusive — last clean biocom_imweb entry
const POLLUTION_END_UTC = "2026-04-15T11:16:52.999Z"; // inclusive — last polluted entry observed

const db = new BetterSqlite3(dbPathArg, { fileMustExist: true });

const SELECT_SQL = `
  SELECT COUNT(*) AS cnt,
         MIN(logged_at) AS min_at,
         MAX(logged_at) AS max_at,
         SUM(CASE WHEN touchpoint='checkout_started' THEN 1 ELSE 0 END) AS cnt_checkout,
         SUM(CASE WHEN touchpoint='payment_success' THEN 1 ELSE 0 END) AS cnt_payment
  FROM attribution_ledger
  WHERE (source = 'thecleancoffee_imweb'
      OR json_extract(metadata_json, '$.source') = 'thecleancoffee_imweb')
    AND (landing LIKE 'https://biocom.kr%'
      OR landing LIKE 'https://www.biocom.kr%'
      OR referrer LIKE 'https://biocom.kr%'
      OR referrer LIKE 'https://www.biocom.kr%')
    AND logged_at > ?
    AND logged_at <= ?
`;

const SELECT_REV_SQL = `
  SELECT payment_status,
         COUNT(*) AS cnt,
         COALESCE(SUM(json_extract(metadata_json, '$.totalAmount')), 0) AS amount_sum
  FROM attribution_ledger
  WHERE source = 'thecleancoffee_imweb'
    AND touchpoint = 'payment_success'
    AND (landing LIKE 'https://biocom.kr%'
      OR landing LIKE 'https://www.biocom.kr%'
      OR referrer LIKE 'https://biocom.kr%'
      OR referrer LIKE 'https://www.biocom.kr%')
    AND logged_at > ?
    AND logged_at <= ?
  GROUP BY payment_status
`;

// NOTE: backend attribution routes read source from metadata_json.source (see
// attribution.ts filterLedgerEntries / buildLedgerSummary), so we MUST update
// both the top-level source column AND the JSON field so every downstream
// reader sees the corrected value. The metadata.source originated from the
// footer's polluted payload — we overwrite it with the clean value but keep
// the metadata.snippetVersion literal intact for audit.
const UPDATE_SQL = `
  UPDATE attribution_ledger
  SET source = 'biocom_imweb',
      metadata_json = json_set(metadata_json, '$.source', 'biocom_imweb')
  WHERE (source = 'thecleancoffee_imweb'
      OR json_extract(metadata_json, '$.source') = 'thecleancoffee_imweb')
    AND (landing LIKE 'https://biocom.kr%'
      OR landing LIKE 'https://www.biocom.kr%'
      OR referrer LIKE 'https://biocom.kr%'
      OR referrer LIKE 'https://www.biocom.kr%')
    AND logged_at > ?
    AND logged_at <= ?
`;

console.log("=== Attribution source pollution fix ===");
console.log("db:", dbPathArg);
console.log("mode:", mode);
console.log("window (UTC):", POLLUTION_START_UTC, "~", POLLUTION_END_UTC);

const preview = db.prepare(SELECT_SQL).get(POLLUTION_START_UTC, POLLUTION_END_UTC);
console.log("\nSELECT preview:");
console.log("  matched count:", preview.cnt);
console.log("  min logged_at:", preview.min_at);
console.log("  max logged_at:", preview.max_at);
console.log("  checkout_started:", preview.cnt_checkout);
console.log("  payment_success:", preview.cnt_payment);

const revRows = db.prepare(SELECT_REV_SQL).all(POLLUTION_START_UTC, POLLUTION_END_UTC);
console.log("\npayment_success by status:");
for (const r of revRows) {
  console.log(`  ${r.payment_status || "(null)"}: count=${r.cnt}, amount_sum=${r.amount_sum}`);
}

// Control sample — look at 5 rows to sanity check
const SAMPLE_SQL = `
  SELECT logged_at, touchpoint, payment_status,
         substr(landing, 1, 80) AS landing,
         json_extract(metadata_json, '$.snippetVersion') AS sv
  FROM attribution_ledger
  WHERE source = 'thecleancoffee_imweb'
    AND (landing LIKE 'https://biocom.kr%'
      OR landing LIKE 'https://www.biocom.kr%'
      OR referrer LIKE 'https://biocom.kr%'
      OR referrer LIKE 'https://www.biocom.kr%')
    AND logged_at > ?
    AND logged_at <= ?
  ORDER BY logged_at ASC
  LIMIT 5
`;
console.log("\nfirst 5 sample rows (earliest):");
for (const r of db.prepare(SAMPLE_SQL).all(POLLUTION_START_UTC, POLLUTION_END_UTC)) {
  console.log(`  ${r.logged_at} | ${r.touchpoint} | ${r.payment_status || "-"} | sv=${r.sv} | ${r.landing}`);
}

// Counter-query — how many rows would REMAIN as thecleancoffee_imweb (real coffee) after UPDATE
const REMAIN_SQL = `
  SELECT COUNT(*) AS cnt
  FROM attribution_ledger
  WHERE source = 'thecleancoffee_imweb'
    AND NOT (landing LIKE 'https://biocom.kr%'
      OR landing LIKE 'https://www.biocom.kr%'
      OR referrer LIKE 'https://biocom.kr%'
      OR referrer LIKE 'https://www.biocom.kr%')
    AND logged_at > ?
    AND logged_at <= ?
`;
const remain = db.prepare(REMAIN_SQL).get(POLLUTION_START_UTC, POLLUTION_END_UTC);
console.log(`\nwould remain as thecleancoffee_imweb within window: ${remain.cnt} (legit coffee events during pollution window)`);

if (mode === "dry") {
  console.log("\n[dry-run] no changes written. To apply, re-run with 'apply' argument.");
  db.close();
  process.exit(0);
}

// Transaction
console.log("\n[apply] starting transaction...");
const txn = db.transaction(() => {
  const result = db
    .prepare(UPDATE_SQL)
    .run(POLLUTION_START_UTC, POLLUTION_END_UTC);
  return result;
});

try {
  const result = txn();
  console.log("[apply] UPDATE result:", result);
  console.log("[apply] committed.");

  // Verify
  const after = db.prepare(SELECT_SQL).get(POLLUTION_START_UTC, POLLUTION_END_UTC);
  console.log("\npost-update SELECT (should be 0):");
  console.log("  matched count:", after.cnt);

  const coffeeLeft = db.prepare(
    `SELECT COUNT(*) AS cnt FROM attribution_ledger WHERE source='thecleancoffee_imweb'`,
  ).get();
  const biocomNow = db.prepare(
    `SELECT COUNT(*) AS cnt FROM attribution_ledger WHERE source='biocom_imweb'`,
  ).get();
  console.log(`\nafter: thecleancoffee_imweb total=${coffeeLeft.cnt}, biocom_imweb total=${biocomNow.cnt}`);
} catch (err) {
  console.error("[apply] transaction failed:", err);
  db.close();
  process.exit(1);
}

db.close();
console.log("\ndone.");
