import assert from "node:assert/strict";
import test from "node:test";

import { buildTotalCorrectionLines } from "../src/routes/total";

test("/total correction lines keep coffee actual separate from biocom budget ROAS", () => {
  const contract = buildTotalCorrectionLines(
    {
      biocom_site_summary_30d: {
        source: "operational_db.tb_iamweb_users PAYMENT_COMPLETE",
        status: "included",
        count: 166,
        amount_krw: 29642500,
      },
      coffee_site_summary_30d: {
        source: "imweb_v2_vm_cloud_imweb_orders",
        db_location: "VM Cloud SQLite /home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3",
        table: "imweb_orders",
        status: "included_with_warning",
        count: 318,
        amount_krw: 15503000,
        status_blank_count: 26,
        status_blank_amount_krw: 1663600,
        warnings: [
          "ga4_guard_not_actual_source",
          "status_blank_rows_included_with_warning",
          "status_sync_stale_over_6h",
        ],
        blank_root_cause: "source_freshness_gap_status_sync_lag",
      },
    },
    "2026-05-13T01:37:23.000Z",
  );

  assert.equal(contract.contract_version, "total-correction-lines-v0.1");
  assert.equal(contract.budget_roas_policy.cross_site_lines_auto_added, false);
  assert.equal(contract.items.length, 2);

  const biocom = contract.items.find((item) => item.site === "biocom");
  const coffee = contract.items.find((item) => item.site === "thecleancoffee");
  assert.ok(biocom);
  assert.ok(coffee);

  assert.equal(biocom.included_in_budget_roas, true);
  assert.equal(biocom.db_location, "운영DB PostgreSQL dashboard.public.tb_iamweb_users");
  assert.equal(coffee.included_in_budget_roas, false);
  assert.equal(
    coffee.use_for_budget_roas,
    "provisional_internal_actual_reference_only_until_campaign_site_mapping",
  );
  assert.equal(coffee.status_blank_count, 26);
  assert.equal(coffee.status_blank_amount_krw, 1663600);
  assert.ok(coffee.warnings.includes("status_blank_rows_included_with_warning"));
  assert.ok(coffee.notes.some((note) => note.includes("GA4")));
});
