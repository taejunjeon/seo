import OpenAI from "openai";
import { env } from "./env";

export const isOpenAISearchConfigured = () => !!env.OPENAI_API_KEY;

let _client: OpenAI | null = null;

const getClient = () => {
  if (_client) return _client;
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
  _client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return _client;
};

export type OpenAiUrlCitation = { title: string; url: string };

const extractUrlCitations = (resp: unknown): OpenAiUrlCitation[] => {
  const r = resp as { output?: unknown[] } | null;
  const output = Array.isArray(r?.output) ? r!.output : [];
  const citations: OpenAiUrlCitation[] = [];

  for (const o of output) {
    const item = o as { type?: string; content?: unknown[] } | null;
    if (item?.type !== "message") continue;
    const content = Array.isArray(item.content) ? item.content : [];

    for (const c of content) {
      const part = c as { type?: string; annotations?: unknown[] } | null;
      if (part?.type !== "output_text") continue;
      const annotations = Array.isArray(part.annotations) ? part.annotations : [];

      for (const a of annotations) {
        const ann = a as { type?: string; title?: unknown; url?: unknown } | null;
        if (ann?.type !== "url_citation") continue;
        if (typeof ann.url !== "string" || !ann.url.startsWith("http")) continue;
        citations.push({
          title: typeof ann.title === "string" ? ann.title : "",
          url: ann.url,
        });
      }
    }
  }

  const uniq = new Map<string, OpenAiUrlCitation>();
  for (const c of citations) {
    const key = c.url;
    if (!uniq.has(key)) uniq.set(key, c);
  }

  return [...uniq.values()];
};

export const fetchOpenAISearchUrls = async (params: {
  query: string;
}): Promise<{ citations: OpenAiUrlCitation[] }> => {
  const client = getClient();

  const prompt = [
    `검색어: "${params.query}"`,
    "",
    "웹 검색을 수행하고, 답변을 매우 짧게 작성하되 반드시 출처를 인용하세요.",
    "규칙: 한국/한국어 관점의 정보를 우선합니다. 출처 인용은 자동으로 수집됩니다.",
  ].join("\n");

  const resp = await client.responses.create({
    model: env.OPENAI_SEARCH_MODEL,
    input: prompt,
    tools: [{ type: "web_search_preview" }],
    max_output_tokens: 400,
  });

  const citations = extractUrlCitations(resp);
  return { citations };
};
