export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";

export const fmtDate = (value: string | null | undefined) => {
  if (!value) return "-";
  return value.length >= 10 ? value.slice(0, 10) : value;
};

export const fmtDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  return value.replace("T", " ").slice(0, 16);
};

export const fmtNum = (value: number | null | undefined) => (value ?? 0).toLocaleString("ko-KR");
export const fmtKRW = (value: number | null | undefined) => `₩${fmtNum(Math.round(value ?? 0))}`;
export const fmtPct = (value: number | null | undefined) => `${(value ?? 0).toFixed(1)}%`;
export const fmtRatio = (value: number | null | undefined) =>
  `${(((value ?? 0) as number) * 100).toFixed(1)}%`;
