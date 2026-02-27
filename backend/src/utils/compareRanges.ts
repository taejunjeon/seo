import { shiftIsoDateByDays, shiftIsoDateByMonths, shiftIsoDateByYears } from "./isoDate";

export type ComparisonCompare = "previous" | "yoy" | "mom";

export type DateRange = { startDate: string; endDate: string };

export const computeComparisonRanges = (params: {
  currentEnd: string;
  periodDays: number;
  compare: ComparisonCompare;
}): { current: DateRange; previous: DateRange } => {
  const periodDays = Math.max(1, Math.floor(params.periodDays));
  const currentEnd = params.currentEnd;
  const currentStart = shiftIsoDateByDays(currentEnd, -(periodDays - 1));

  const compare = params.compare;
  const previousStart =
    compare === "previous"
      ? shiftIsoDateByDays(currentStart, -periodDays)
      : compare === "yoy"
        ? shiftIsoDateByYears(currentStart, -1)
        : shiftIsoDateByMonths(currentStart, -1);

  const previousEnd = shiftIsoDateByDays(previousStart, periodDays - 1);

  return {
    current: { startDate: currentStart, endDate: currentEnd },
    previous: { startDate: previousStart, endDate: previousEnd },
  };
};

