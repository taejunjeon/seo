"use client";

import { useEffect, useState } from "react";

import type {
  CallpriceAnalysisTypesResponse,
  CallpriceDataResult,
  CallpriceManagersResponse,
  CallpriceOptionsResponse,
  CallpriceOptionsResult,
  CallpriceOverviewResponse,
  CallpriceParams,
  CallpriceScenarioResponse,
} from "@/types/callprice";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";

/* ── 헬퍼: JSON fetch with abort + 에러 핸들링 ── */
async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API 오류 (${res.status}): ${body || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/* ── 쿼리스트링 빌더 (빈 값 제외) ── */
function buildQueryString(params: Record<string, string | number | undefined | null>): string {
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string | number] =>
      entry[1] !== undefined && entry[1] !== null && entry[1] !== "",
  );
  if (entries.length === 0) return "";
  return "?" + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
}

/* ═══════════════════════════════════════
   useCallpriceData
   4개 주요 엔드포인트(overview, managers, analysis-types, scenario)를
   병렬로 호출하고 결과를 반환한다.
   ═══════════════════════════════════════ */
export function useCallpriceData(params: CallpriceParams): CallpriceDataResult {
  const [options, setOptions] = useState<CallpriceOptionsResponse | null>(null);
  const [overview, setOverview] = useState<CallpriceOverviewResponse | null>(null);
  const [managers, setManagers] = useState<CallpriceManagersResponse | null>(null);
  const [analysisTypes, setAnalysisTypes] = useState<CallpriceAnalysisTypesResponse | null>(null);
  const [scenario, setScenario] = useState<CallpriceScenarioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    startDate,
    endDate,
    maturityDays = 90,
    baselineScope = "global_non_consultation",
    manager,
    analysisType,
    monthlyCost = 4_000_000,
    headcount = 1,
  } = params;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const commonParams: Record<string, string | number | undefined> = {
          startDate,
          endDate,
          maturityDays,
          baselineScope,
          manager,
        };

        const [optionsRes, overviewRes, managersRes, analysisTypesRes, scenarioRes] =
          await Promise.all([
            fetchJson<CallpriceOptionsResponse>(
              `${API_BASE}/api/callprice/options`,
              signal,
            ),
            fetchJson<CallpriceOverviewResponse>(
              `${API_BASE}/api/callprice/overview${buildQueryString({
                ...commonParams,
                analysisType,
              })}`,
              signal,
            ),
            fetchJson<CallpriceManagersResponse>(
              `${API_BASE}/api/callprice/managers${buildQueryString({
                ...commonParams,
                analysisType,
              })}`,
              signal,
            ),
            fetchJson<CallpriceAnalysisTypesResponse>(
              `${API_BASE}/api/callprice/analysis-types${buildQueryString(commonParams)}`,
              signal,
            ),
            fetchJson<CallpriceScenarioResponse>(
              `${API_BASE}/api/callprice/scenario${buildQueryString({
                ...commonParams,
                analysisType,
                monthlyCost,
                headcount,
              })}`,
              signal,
            ),
          ]);

        setOptions(optionsRes);
        setOverview(overviewRes);
        setManagers(managersRes);
        setAnalysisTypes(analysisTypesRes);
        setScenario(scenarioRes);
      } catch (err) {
        if (signal.aborted) return;
        setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => controller.abort();
  }, [startDate, endDate, maturityDays, baselineScope, manager, analysisType, monthlyCost, headcount]);

  return { options, overview, managers, analysisTypes, scenario, loading, error };
}

/* ═══════════════════════════════════════
   useCallpriceOptions
   옵션 엔드포인트만 마운트 시 1회 호출한다.
   ═══════════════════════════════════════ */
export function useCallpriceOptions(): CallpriceOptionsResult {
  const [options, setOptions] = useState<CallpriceOptionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetchJson<CallpriceOptionsResponse>(
          `${API_BASE}/api/callprice/options`,
          signal,
        );
        setOptions(res);
      } catch (err) {
        if (signal.aborted) return;
        setError(err instanceof Error ? err.message : "옵션을 불러오지 못했습니다.");
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => controller.abort();
  }, []);

  return { options, loading, error };
}
