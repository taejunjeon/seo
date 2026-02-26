export type IsoDateRangeOk = {
  ok: true;
  startDate: string;
  endDate: string;
};

export type IsoDateRangeError = {
  ok: false;
  error: string;
  details: string;
};

export const isIsoDateString = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export const resolveIsoDateRange = (params: {
  startDateParam?: string;
  endDateParam?: string;
  defaultStartDate: string;
  defaultEndDate: string;
}): IsoDateRangeOk | IsoDateRangeError => {
  const { startDateParam, endDateParam, defaultStartDate, defaultEndDate } = params;
  const startDate = startDateParam ?? defaultStartDate;
  const endDate = endDateParam ?? defaultEndDate;

  if ((startDateParam && !isIsoDateString(startDateParam)) || (endDateParam && !isIsoDateString(endDateParam))) {
    return {
      ok: false,
      error: "잘못된 기간 파라미터입니다.",
      details: "startDate/endDate must be YYYY-MM-DD",
    };
  }

  if (startDate > endDate) {
    return {
      ok: false,
      error: "잘못된 기간 파라미터입니다.",
      details: "startDate must be before or equal to endDate",
    };
  }

  return { ok: true, startDate, endDate };
};

