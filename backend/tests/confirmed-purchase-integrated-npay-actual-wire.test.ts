import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const writeJson = (filePath: string, data: unknown) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

test("integrated builder: NPay actual snapshot wires npay_actual_confirmed_pg_count + corrected ROAS", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-npay-wire-"));
  const operationalPath = path.join(tmp, "operational.json");
  const vmPrepPath = path.join(tmp, "vm-prep.json");
  const pathBPath = path.join(tmp, "path-b.json");
  const npaySnapshotPath = path.join(tmp, "npay-snapshot.json");
  const outputPath = path.join(tmp, "integrated-output.json");

  writeJson(operationalPath, {
    ok: true,
    generated_at_kst: "2026-05-10 23:00:00 KST",
    candidates: [
      {
        site: "biocom",
        order_number: "FIX-HOME-1",
        channel_order_no: "",
        payment_method: "homepage",
        payment_status: "confirmed",
        conversion_time: "2026-05-09T10:00:00.000Z",
        value: 200000,
        currency: "KRW",
        send_candidate: false,
        block_reasons: ["read_only_phase", "approval_required"],
        include_reason: "homepage_confirmed_order",
        vm_evidence: { matched: false },
      },
      {
        site: "biocom",
        order_number: "FIX-NPAY-1",
        channel_order_no: "ch-1",
        payment_method: "npay",
        payment_status: "confirmed",
        conversion_time: "2026-05-09T11:00:00.000Z",
        value: 100000,
        currency: "KRW",
        send_candidate: false,
        block_reasons: ["read_only_phase", "approval_required"],
        include_reason: "npay_confirmed_order",
        vm_evidence: { matched: false },
      },
    ],
  });

  writeJson(vmPrepPath, { ok: true, generated_at_kst: "2026-05-10 23:00:00 KST", candidates: [] });
  writeJson(pathBPath, {
    schema_version: "fixture",
    flow: { order_no: "" },
    path_b_identity_first_canary_result: {},
    path_b_controlled_traffic_result: {},
    verdict: "fixture",
  });
  writeJson(npaySnapshotPath, {
    ok: true,
    schema_version: "npay_actual_confirmed_pg_snapshot_v1",
    snapshot: { rows: 209, total_amount_krw: 37638900 },
  });

  execFileSync(
    "npx",
    [
      "tsx",
      path.resolve("scripts/confirmed-purchase-integrated-input-builder.ts"),
      `--operational-input=${operationalPath}`,
      `--vm-prep-input=${vmPrepPath}`,
      `--path-b-evidence=${pathBPath}`,
      `--npay-actual-source-input=${npaySnapshotPath}`,
      "--platform-cost-krw=23666491.84",
      `--output=${outputPath}`,
    ],
    { stdio: "ignore" },
  );

  const payload = JSON.parse(fs.readFileSync(outputPath, "utf8")) as {
    summary: Record<string, unknown>;
  };
  const s = payload.summary;

  assert.equal(s.integrated_candidate_count, 2);
  assert.equal(s.homepage_confirmed_count, 1);
  assert.equal(s.npay_actual_confirmed_count, 1);
  assert.equal(s.npay_actual_confirmed_pg_count, 209);
  assert.equal(s.npay_actual_confirmed_pg_revenue_krw, 37638900);
  // current = 200000 + 100000 = 300000 (candidate 합)
  assert.equal(s.internal_confirmed_revenue_current_krw, 300000);
  // corrected = homepage 200000 + pg snapshot 37,638,900 = 37,838,900
  assert.equal(s.internal_confirmed_revenue_with_npay_actual_pg_krw, 37838900);
  assert.equal(s.npay_actual_wire_status, "wired_from_pg_snapshot");
  assert.equal(s.send_candidate, 0);
  assert.equal(s.actual_send_candidate, 0);
  assert.equal(s.upload_candidate, 0);

  fs.rmSync(tmp, { recursive: true, force: true });
});

test("integrated builder: missing snapshot input keeps current revenue and wire status missing", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cpb-npay-no-wire-"));
  const operationalPath = path.join(tmp, "operational.json");
  const vmPrepPath = path.join(tmp, "vm-prep.json");
  const pathBPath = path.join(tmp, "path-b.json");
  const outputPath = path.join(tmp, "integrated-output.json");

  writeJson(operationalPath, {
    ok: true,
    generated_at_kst: "2026-05-10 23:00:00 KST",
    candidates: [
      {
        site: "biocom",
        order_number: "FIX-HOME-2",
        channel_order_no: "",
        payment_method: "homepage",
        payment_status: "confirmed",
        conversion_time: "2026-05-09T10:00:00.000Z",
        value: 500000,
        currency: "KRW",
        send_candidate: false,
        block_reasons: ["read_only_phase", "approval_required"],
        include_reason: "homepage_confirmed_order",
        vm_evidence: { matched: false },
      },
    ],
  });
  writeJson(vmPrepPath, { ok: true, generated_at_kst: "2026-05-10 23:00:00 KST", candidates: [] });
  writeJson(pathBPath, { schema_version: "fixture", flow: { order_no: "" }, verdict: "fixture" });

  execFileSync(
    "npx",
    [
      "tsx",
      path.resolve("scripts/confirmed-purchase-integrated-input-builder.ts"),
      `--operational-input=${operationalPath}`,
      `--vm-prep-input=${vmPrepPath}`,
      `--path-b-evidence=${pathBPath}`,
      "--platform-cost-krw=1000000",
      `--output=${outputPath}`,
    ],
    { stdio: "ignore" },
  );

  const payload = JSON.parse(fs.readFileSync(outputPath, "utf8")) as {
    summary: Record<string, unknown>;
  };
  const s = payload.summary;

  assert.equal(s.npay_actual_confirmed_pg_count, 0);
  assert.equal(s.npay_actual_confirmed_pg_revenue_krw, 0);
  assert.equal(s.internal_confirmed_revenue_current_krw, 500000);
  assert.equal(s.internal_confirmed_revenue_with_npay_actual_pg_krw, 500000);
  assert.equal(s.npay_actual_wire_status, "missing_snapshot_input");
  assert.equal(s.internal_roas_current, s.internal_roas_with_npay_actual_pg);

  fs.rmSync(tmp, { recursive: true, force: true });
});
