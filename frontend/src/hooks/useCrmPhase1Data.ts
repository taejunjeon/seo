"use client";

import { useCallback, useEffect, useState } from "react";

import type { CrmPhase1OpsResponse, CrmPhase1OpsSnapshot } from "@/types/crmPhase1";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";

const buildQueryString = (params: Record<string, string | undefined>) => {
  const entries = Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1]));
  if (entries.length === 0) return "";
  return `?${entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&")}`;
};

export function useCrmPhase1Data(params?: {
  startDate?: string;
  endDate?: string;
  experimentKey?: string | null;
}) {
  const [data, setData] = useState<CrmPhase1OpsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startDate = params?.startDate;
  const endDate = params?.endDate;
  const experimentKey = params?.experimentKey ?? undefined;

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/api/crm-phase1/ops${buildQueryString({
          startDate,
          endDate,
          experimentKey: experimentKey || undefined,
        })}`,
        signal ? { signal } : undefined,
      );

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(body || `API 오류 (${response.status})`);
      }

      const payload = (await response.json()) as CrmPhase1OpsResponse;
      setData(payload.data);
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : "Phase1 데이터를 불러오지 못했습니다.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [endDate, experimentKey, startDate]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return {
    data,
    loading,
    error,
    reload: () => load(),
  };
}
