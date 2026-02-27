import test from "node:test";
import assert from "node:assert/strict";

test("isoDate: shift by months clamps to last day", async () => {
  const { shiftIsoDateByMonths } = await import("../src/utils/isoDate");

  // Non-leap year: Feb has 28 days
  assert.equal(shiftIsoDateByMonths("2026-03-31", -1), "2026-02-28");
  assert.equal(shiftIsoDateByMonths("2026-01-30", 1), "2026-02-28");

  // Leap year: Feb has 29 days
  assert.equal(shiftIsoDateByMonths("2024-03-31", -1), "2024-02-29");
});

test("isoDate: shift by years clamps Feb 29", async () => {
  const { shiftIsoDateByYears } = await import("../src/utils/isoDate");

  assert.equal(shiftIsoDateByYears("2024-02-29", 1), "2025-02-28");
  assert.equal(shiftIsoDateByYears("2025-02-28", -1), "2024-02-28");
});

test("compareRanges: previous/yoy/mom keep period length", async () => {
  const { computeComparisonRanges } = await import("../src/utils/compareRanges");
  const { diffIsoDatesInDays } = await import("../src/utils/isoDate");

  const currentEnd = "2026-02-26";
  const periodDays = 30;

  for (const compare of ["previous", "yoy", "mom"] as const) {
    const ranges = computeComparisonRanges({ currentEnd, periodDays, compare });
    const curLen = diffIsoDatesInDays(ranges.current.startDate, ranges.current.endDate) + 1;
    const prevLen = diffIsoDatesInDays(ranges.previous.startDate, ranges.previous.endDate) + 1;
    assert.equal(curLen, periodDays);
    assert.equal(prevLen, periodDays);
  }
});

