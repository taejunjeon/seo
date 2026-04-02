import assert from "node:assert/strict";
import test from "node:test";

import {
  categorizeProductName,
  fetchConsultationCandidates,
  fetchConsultationOrderMatch,
  fetchConsultationSummary,
  getDefaultConsultationRange,
  normalizeConsultationStatus,
} from "../src/consultation";

const makeResult = <TRow extends Record<string, unknown>>(rows: TRow[]) =>
  ({
    rows,
    rowCount: rows.length,
    command: "SELECT",
    oid: 0,
    fields: [],
  }) as any;

const createQueuedRunner =
  (...queue: Array<Record<string, unknown>[]>) =>
  async () => {
    const next = queue.shift();
    if (!next) {
      throw new Error("Unexpected query");
    }
    return makeResult(next);
  };

test("consultation: normalizeConsultationStatus groups edge-case raw values", () => {
  assert.equal(normalizeConsultationStatus("완료"), "completed");
  assert.equal(normalizeConsultationStatus("(변경)완료"), "completed");
  assert.equal(normalizeConsultationStatus("부재"), "no_answer");
  assert.equal(normalizeConsultationStatus("시간변경(다시 상담신청 예정)"), "rescheduled");
  assert.equal(normalizeConsultationStatus("취소희망"), "canceled");
  assert.equal(normalizeConsultationStatus("nan"), "unknown");
  assert.equal(normalizeConsultationStatus("재검"), "other");
});

test("consultation: categorizeProductName splits test kit vs supplement", () => {
  assert.equal(categorizeProductName("음식물 과민증 분석"), "test_kit");
  assert.equal(categorizeProductName("뉴로마스터 60정 (1개월분)"), "supplement");
  assert.equal(categorizeProductName("내부 확인용"), "other");
});

test("consultation: default date range keeps inclusive 90-day window", () => {
  assert.deepEqual(getDefaultConsultationRange("2026-03-27"), {
    startDate: "2025-12-28",
    endDate: "2026-03-27",
  });
});

test("consultation: summary response maps aggregates into API shape", async () => {
  const runner = createQueuedRunner(
    [
      {
        consultation_rows: "4302",
        distinct_contacts: "3890",
        distinct_managers: "11",
        distinct_analysis_types: "27",
      },
    ],
    [
      { status_group: "completed", raw_status: "완료", count: "3521" },
      { status_group: "no_answer", raw_status: "부재", count: "441" },
    ],
    [
      { manager: "민정", count: "1540" },
      { manager: "경태", count: "1212" },
    ],
    [
      { analysis_type: "알러지", count: "1803" },
      { analysis_type: "중금속", count: "774" },
    ],
  );

  const summary = await fetchConsultationSummary(
    { startDate: "2025-12-28", endDate: "2026-03-27" },
    runner as any,
  );

  assert.equal(summary.ok, true);
  assert.equal(summary.totals.consultationRows, 4302);
  assert.equal(summary.totals.distinctContacts, 3890);
  assert.equal(summary.statusBreakdown[0]?.statusGroup, "completed");
  assert.equal(summary.managerBreakdown[0]?.manager, "민정");
  assert.equal(summary.analysisTypeBreakdown[1]?.count, 774);
});

test("consultation: order-match computes rates from overlap totals", async () => {
  const runner = createQueuedRunner([
    {
      consult_distinct_contacts: "6882",
      iamweb_distinct_customers: "51942",
      ltr_distinct_customers: "30546",
      consult_to_order_overlap: "2873",
      consult_to_ltr_overlap: "5055",
    },
  ]);

  const orderMatch = await fetchConsultationOrderMatch(
    {
      range: { startDate: "2025-12-28", endDate: "2026-03-27" },
      manager: "민정",
      statusGroup: "completed",
    },
    runner as any,
  );

  assert.equal(orderMatch.totals.consultDistinctContacts, 6882);
  assert.equal(orderMatch.totals.orderMatchRate, 0.417);
  assert.equal(orderMatch.totals.ltrMatchRate, 0.735);
  assert.equal(orderMatch.filters.manager, "민정");
  assert.equal(orderMatch.filters.statusGroup, "completed");
});

test("consultation: candidates use scenario-specific window and response mapping", async () => {
  const runner = createQueuedRunner(
    [
      {
        normalized_phone: "01012345678",
        customer_name: "홍길동",
        customer_contact: "010-1234-5678",
        manager: "민정",
        analysis_type: "알러지",
        consultation_date: "2026-03-20",
        raw_status: "완료",
        status_group: "completed",
      },
    ],
    [],
    [{ normalized_phone: "01012345678" }],
  );

  const candidates = await fetchConsultationCandidates(
    {
      scenario: "completed_followup",
      manager: "민정",
      limit: 10,
      referenceDate: "2026-03-27",
    },
    runner as any,
  );

  assert.equal(candidates.range.startDate, "2026-02-26");
  assert.equal(candidates.range.endDate, "2026-03-27");
  assert.equal(candidates.windowDays, 30);
  assert.equal(candidates.count, 1);
  assert.equal(candidates.items[0]?.normalizedPhone, "01012345678");
  assert.equal(candidates.items[0]?.recommendedAction, "order_conversion_nudge");
  assert.equal(candidates.items[0]?.hasLtr, true);
});
