type IsoDateParts = {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
};

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad2 = (n: number) => String(n).padStart(2, "0");

export const parseIsoDate = (dateStr: string): IsoDateParts => {
  const m = ISO_DATE_RE.exec(dateStr);
  if (!m) {
    throw new Error(`Invalid ISO date (expected YYYY-MM-DD): ${dateStr}`);
  }

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);

  return { year, month, day };
};

export const formatIsoDate = (parts: IsoDateParts): string =>
  `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;

export const daysInMonth = (year: number, month: number): number => {
  // month: 1-12, day 0 = last day of previous month in JS Date
  const d = new Date(Date.UTC(year, month, 0));
  return d.getUTCDate();
};

export const shiftIsoDateByDays = (dateStr: string, deltaDays: number): string => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid ISO date: ${dateStr}`);
  }
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
};

export const shiftIsoDateByMonths = (dateStr: string, deltaMonths: number): string => {
  const { year, month, day } = parseIsoDate(dateStr);
  const monthIndex0 = month - 1; // 0-11

  const totalMonths = year * 12 + monthIndex0 + deltaMonths;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonthIndex0 = ((totalMonths % 12) + 12) % 12;
  const targetMonth = targetMonthIndex0 + 1;

  const maxDay = daysInMonth(targetYear, targetMonth);
  const targetDay = Math.min(day, maxDay);

  return formatIsoDate({ year: targetYear, month: targetMonth, day: targetDay });
};

export const shiftIsoDateByYears = (dateStr: string, deltaYears: number): string => {
  const { year, month, day } = parseIsoDate(dateStr);
  const targetYear = year + deltaYears;
  const maxDay = daysInMonth(targetYear, month);
  const targetDay = Math.min(day, maxDay);
  return formatIsoDate({ year: targetYear, month, day: targetDay });
};

export const diffIsoDatesInDays = (startDate: string, endDate: string): number => {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error(`Invalid ISO dates: ${startDate}, ${endDate}`);
  }
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
};

