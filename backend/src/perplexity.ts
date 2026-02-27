import { env } from "./env";
import { CircuitBreaker } from "./utils/circuitBreaker";

export const isPerplexityConfigured = () => !!env.PERPLEXITY_API_KEY;

const perplexityBreaker = new CircuitBreaker({
  service: "perplexity",
  failureThreshold: 5,
  cooldownMs: 30_000,
});

export type PerplexitySearchResult = {
  title: string;
  url: string;
  snippet?: string;
  source?: string;
};

type PerplexityChatCompletionResponse = {
  choices?: { message?: { content?: string } }[];
  citations?: unknown;
  search_results?: unknown;
  error?: unknown;
};

const extractSearchResults = (payload: PerplexityChatCompletionResponse | null): PerplexitySearchResult[] => {
  const raw = (payload as { search_results?: unknown } | null)?.search_results;
  if (!Array.isArray(raw)) return [];

  const results: PerplexitySearchResult[] = [];
  for (const r of raw) {
    const item = r as { title?: unknown; url?: unknown; snippet?: unknown; source?: unknown } | null;
    if (!item) continue;
    if (typeof item.url !== "string" || !item.url.startsWith("http")) continue;
    results.push({
      title: typeof item.title === "string" ? item.title : "",
      url: item.url,
      snippet: typeof item.snippet === "string" ? item.snippet : undefined,
      source: typeof item.source === "string" ? item.source : undefined,
    });
  }

  // Fallback: 일부 응답은 citations만 올 수 있어, title 없는 상태로 유지합니다.
  if (results.length > 0) return results;

  const citations = (payload as { citations?: unknown } | null)?.citations;
  if (!Array.isArray(citations)) return [];
  return citations
    .filter((c): c is string => typeof c === "string" && c.startsWith("http"))
    .map((url) => ({ title: "", url, source: "web" }));
};

export const fetchPerplexityCitations = async (params: {
  query: string;
}): Promise<{ content: string; citations: PerplexitySearchResult[] }> => {
  if (!env.PERPLEXITY_API_KEY) {
    throw new Error("PERPLEXITY_API_KEY is not configured");
  }

  return perplexityBreaker.exec(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: env.PERPLEXITY_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a search assistant. Answer in Korean and include citations to sources. Prefer authoritative Korean medical/health sources when possible.",
          },
          { role: "user", content: params.query },
        ],
        temperature: 0.2,
        max_tokens: 600,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    const payload = (await res.json().catch(() => null)) as PerplexityChatCompletionResponse | null;

    if (!res.ok) {
      const errorText =
        typeof (payload as { error?: unknown } | null)?.error === "string"
          ? (payload as { error?: string }).error
          : null;
      throw new Error(errorText ? `Perplexity error: ${errorText}` : `Perplexity request failed (${res.status})`);
    }

    const content = payload?.choices?.[0]?.message?.content ?? "";
    const citations = extractSearchResults(payload);
    return { content, citations };
  });
};
