"use client";

import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:7020";

export type LocalExperiment = {
  experiment_key: string;
  name: string;
  description: string | null;
  channel: string;
  status: string;
  hypothesis: string | null;
  assignment_version: number;
  variant_weights: Record<string, number>;
  variant_aliases?: Record<string, string>;
  conversion_window_days: number;
  start_at: string | null;
  end_at: string | null;
  created_at: string;
  updated_at: string;
  // meta fields (?meta=true)
  assignmentCount?: number;
  conversionCount?: number;
  messageCount?: number;
  lastSyncAt?: string | null;
};

export type LocalVariantSummary = {
  variant_key: string;
  assignment_count: number;
  purchaser_count: number;
  purchase_count: number;
  revenue_amount: number;
  refund_amount: number;
  net_revenue: number;
  purchase_rate: number;
};

export type LocalAssignment = {
  id: number;
  experiment_key: string;
  customer_key: string;
  variant_key: string;
  assignment_version: number;
  assignment_bucket: number | null;
  source_segment: string | null;
  assigned_at: string;
};

export type CrmLocalData = {
  experiments: LocalExperiment[];
  selectedExperiment: LocalExperiment | null;
  results: LocalVariantSummary[];
  assignments: { total: number; items: LocalAssignment[] };
  stats: { experiments: number; assignments: number; conversions: number; messages: number };
};

export function useCrmLocalData(selectedKey?: string | null) {
  const [data, setData] = useState<CrmLocalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const fetchJson = async <T,>(path: string): Promise<T> => {
        const res = await fetch(`${API_BASE}${path}`, signal ? { signal } : undefined);
        if (!res.ok) throw new Error(`API 오류 (${res.status})`);
        return res.json() as Promise<T>;
      };

      const [expRes, statsRes] = await Promise.all([
        fetchJson<{ ok: boolean; experiments: LocalExperiment[] }>("/api/crm-local/experiments?meta=true"),
        fetchJson<{ ok: boolean; experiments: number; assignments: number; conversions: number; messages: number }>("/api/crm-local/stats"),
      ]);

      const experiments = expRes.experiments ?? [];
      const expKey = selectedKey?.trim() || experiments[0]?.experiment_key || null;

      let selectedExperiment: LocalExperiment | null = null;
      let results: LocalVariantSummary[] = [];
      let assignments = { total: 0, items: [] as LocalAssignment[] };

      if (expKey) {
        const [resultRes, assignRes] = await Promise.all([
          fetchJson<{ ok: boolean; experiment: LocalExperiment; variant_summary: LocalVariantSummary[] }>(
            `/api/crm-local/experiments/${encodeURIComponent(expKey)}/results`,
          ),
          fetchJson<{ ok: boolean; total: number; items: LocalAssignment[] }>(
            `/api/crm-local/experiments/${encodeURIComponent(expKey)}/assignments?limit=20`,
          ),
        ]);
        selectedExperiment = resultRes.experiment;
        results = resultRes.variant_summary ?? [];
        assignments = { total: assignRes.total, items: assignRes.items ?? [] };
      }

      setData({
        experiments,
        selectedExperiment,
        results,
        assignments,
        stats: { experiments: statsRes.experiments, assignments: statsRes.assignments, conversions: statsRes.conversions, messages: statsRes.messages },
      });
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : "CRM 로컬 데이터를 불러오지 못했습니다.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [selectedKey]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return { data, loading, error, reload: () => load() };
}
