import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const TEST_DB_PATH = path.join(os.tmpdir(), `crm-local-lead-${process.pid}.sqlite3`);
process.env.CRM_LOCAL_DB_PATH = TEST_DB_PATH;

let crmLocal: typeof import("../src/crmLocalDb");

function resetDb() {
  crmLocal.resetCrmDbForTests();
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
}

test.before(async () => {
  crmLocal = await import("../src/crmLocalDb");
});

test.beforeEach(() => {
  resetDb();
});

test.after(() => {
  resetDb();
  delete process.env.CRM_LOCAL_DB_PATH;
});

test("crmLocal lead ledger: stores pre-purchase experiment metadata", () => {
  const experiment = crmLocal.createExperiment({
    experiment_key: "lead-magnet-fatigue-v1",
    name: "피로 자가진단 리드 마그넷",
    funnel_stage: "pre_purchase",
    asset_id: "fatigue_self_check_v1",
    lead_magnet_id: "fatigue_self_check_v1",
    conversion_window_days: 14,
  });

  assert.equal(experiment.funnel_stage, "pre_purchase");
  assert.equal(experiment.asset_id, "fatigue_self_check_v1");
  assert.equal(experiment.lead_magnet_id, "fatigue_self_check_v1");
});

test("crmLocal lead ledger: profile, event, consent, overview are linked", () => {
  const profile = crmLocal.upsertLeadProfile({
    lead_id: "lead_001",
    lead_magnet_id: "fatigue_self_check_v1",
    lead_source: "meta_quiz_lp",
    problem_cluster: "fatigue",
    intent_stage: "consultation_ready",
    consent_status: "opt_in",
    funnel_stage: "pre_purchase",
  });

  const event = crmLocal.recordLeadEvent({
    lead_id: "lead_001",
    event_name: "consultation_booked",
    lead_magnet_id: "fatigue_self_check_v1",
    problem_cluster: "fatigue",
    intent_stage: "consultation_ready",
  });

  crmLocal.recordLeadEvent({
    lead_id: "lead_001",
    event_name: "first_purchase",
    lead_magnet_id: "fatigue_self_check_v1",
  });

  crmLocal.recordConsent({
    lead_id: "lead_001",
    consent_status: "opt_in",
    source_channel: "quiz_form",
  });

  const overview = crmLocal.getLeadOverview();
  const stored = crmLocal.getLeadProfile("lead_001");
  const list = crmLocal.listLeadProfiles(10, 0);
  const stats = crmLocal.getDbStats();

  assert.equal(profile.lead_source, "meta_quiz_lp");
  assert.equal(event.funnel_stage, "consultation");
  assert.equal(stored?.funnel_stage, "post_purchase");
  assert.equal(stored?.consent_status, "opt_in");
  assert.equal(overview.total_leads, 1);
  assert.equal(overview.contactable_leads, 1);
  assert.equal(overview.consultation_ready_leads, 1);
  assert.equal(overview.purchased_leads, 1);
  assert.equal(overview.event_counts.find((item) => item.event_name === "consultation_booked")?.row_count, 1);
  assert.equal(overview.event_counts.find((item) => item.event_name === "first_purchase")?.row_count, 1);
  assert.equal(overview.top_problem_clusters[0]?.problem_cluster, "fatigue");
  assert.equal(list.total, 1);
  assert.equal(stats.leads, 1);
  assert.equal(stats.lead_events, 2);
  assert.equal(stats.consents, 1);
});
