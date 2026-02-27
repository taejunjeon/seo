/* ── AI 인용도 멀티 프로바이더 타입 (백엔드 AiCitationMulti 미러) ── */

export type AiCitationProvider = "google_ai_overview" | "chatgpt_search" | "perplexity";

export type AiCitationProviderSampleStatus =
  | "ok"
  | "no_exposure"
  | "timeout"
  | "rate_limited"
  | "invalid_key"
  | "parse_error"
  | "provider_error";

export type AiCitationReference = {
  title: string;
  link: string;
  source?: string;
};

export type AiCitationProviderSample = {
  query: string;
  providerStatus: AiCitationProviderSampleStatus;
  eligible: boolean;
  exposure: boolean;
  cited: boolean;
  referencesCount: number;
  references: AiCitationReference[];
  matchedReferences: AiCitationReference[];
  error?: string;
};

export type AiCitationProviderResult = {
  provider: AiCitationProvider;
  providerStatus: "ok" | "partial" | "error";
  statusCounts: Record<AiCitationProviderSampleStatus, number>;
  eligible: number;
  citedQueries: number;
  citedReferences: number;
  citationRate: number;
  latencyMs: number;
  measuredAt: string;
  samples: AiCitationProviderSample[];
  note?: string;
};

export type AiCitationMultiResult = {
  siteHost: string;
  hl: string;
  gl: string;
  sampled: number;
  eligibleTotal: number;
  citedQueriesTotal: number;
  citedReferencesTotal: number;
  citationRateOverall: number;
  latencyMsTotal: number;
  providers: AiCitationProviderResult[];
  pickedQueries: string[];
  measuredAt: string;
};

export type CitationVerdict = "exposure_zero" | "citation_zero" | "cited";

export type AiCitationApiResponse = {
  verdict: CitationVerdict;
  availability: Record<AiCitationProvider, { configured: boolean }>;
  requested: {
    sampleSize: number;
    providers: string[];
    queriesProvided: number;
    forceRefresh: boolean;
  };
} & AiCitationMultiResult;

/* ── 프로바이더 표시용 메타 ── */
export const PROVIDER_META: Record<AiCitationProvider, { label: string; icon: string; color: string }> = {
  google_ai_overview: { label: "Google AI Overview", icon: "🔍", color: "#4285F4" },
  chatgpt_search: { label: "ChatGPT Search", icon: "🤖", color: "#10A37F" },
  perplexity: { label: "Perplexity", icon: "🧠", color: "#7C3AED" },
};

export const VERDICT_META: Record<CitationVerdict, { label: string; icon: string; colorClass: string; description: string }> = {
  exposure_zero: {
    label: "노출 없음",
    icon: "🟡",
    colorClass: "verdictExposureZero",
    description: "표본 키워드에서 AI 답변 출처가 감지되지 않음 (eligible=0)",
  },
  citation_zero: {
    label: "인용 없음",
    icon: "🟠",
    colorClass: "verdictCitationZero",
    description: "AI 출처에 다른 사이트는 노출되나, 사이트가 인용되지 않음",
  },
  cited: {
    label: "인용 확인",
    icon: "🟢",
    colorClass: "verdictCited",
    description: "AI 답변 출처에 사이트가 인용되고 있음",
  },
};
