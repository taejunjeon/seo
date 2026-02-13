import OpenAI from "openai";
import { env } from "./env";

/* ═══════════════════════════════════════
   OpenAI 클라이언트 (싱글턴)
   ═══════════════════════════════════════ */
let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    if (!env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    _client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return _client;
}

export function isOpenAIConfigured(): boolean {
  return !!env.OPENAI_API_KEY;
}

/* ═══════════════════════════════════════
   AI 인사이트 생성
   ═══════════════════════════════════════ */
export type AiInsight = {
  priority: "urgent" | "opportunity" | "trend" | "recommend";
  tag: string;
  text: string;
};

const INSIGHTS_SYSTEM_PROMPT = `당신은 BiocomAI SEO 인텔리전스 시스템입니다.
주어진 SEO 데이터(KPI, 키워드, 페이지 성과, Core Web Vitals)를 분석하여 실행 가능한 인사이트를 생성합니다.

반드시 아래 JSON 배열 형식으로만 응답하세요 (마크다운, 설명 없이 순수 JSON만):
[
  {"priority": "urgent|opportunity|trend|recommend", "tag": "카테고리(2~3자)", "text": "구체적인 인사이트 (50자 이내)"}
]

priority 기준:
- urgent: 즉시 조치 필요 (순위 급락, 에러, 성능 악화)
- opportunity: 개선 기회 (CTR 향상, 스키마 추가 등)
- trend: 주목할 트렌드 (모바일 증가, 키워드 변화 등)
- recommend: 일반 개선 권장사항

정확히 4개의 인사이트를 생성하세요. 각각 다른 priority를 사용하세요.
한국어로 작성하세요.`;

export async function generateInsights(seoData: Record<string, unknown>): Promise<AiInsight[]> {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: env.OPENAI_MODEL,
    messages: [
      { role: "system", content: INSIGHTS_SYSTEM_PROMPT },
      { role: "user", content: `다음 SEO 데이터를 분석하고 인사이트를 생성하세요:\n\n${JSON.stringify(seoData, null, 2)}` },
    ],
    // GPT-5 mini는 temperature 기본값(1)만 지원
    max_completion_tokens: 2000,
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "[]";

  // JSON 파싱 (코드블록 마크다운 제거)
  const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item: unknown): item is AiInsight =>
        typeof item === "object" &&
        item !== null &&
        "priority" in item &&
        "tag" in item &&
        "text" in item,
    );
  } catch {
    console.error("AI insights JSON parse error:", cleaned);
    return [];
  }
}

/* ═══════════════════════════════════════
   AI 채팅
   ═══════════════════════════════════════ */
export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const CHAT_SYSTEM_PROMPT = `당신은 BiocomAI SEO 어시스턴트입니다.
biocom.kr (바이오컴) 웹사이트의 SEO, AEO(AI Engine Optimization), GEO(Generative Engine Optimization) 전략을 도와줍니다.

전문 분야:
- 검색엔진 최적화 (SEO): 키워드 전략, 콘텐츠 최적화, 기술 SEO
- AI 엔진 최적화 (AEO): AI 답변 소스 채택률 향상, FAQ/HowTo 스키마
- 생성형 엔진 최적화 (GEO): AI Overview 노출, E-E-A-T 강화
- Core Web Vitals: LCP, FCP, CLS, INP, TTFB 개선
- 구조화 데이터: Schema.org 마크업 (FAQPage, Article, Person, Speakable 등)

답변 규칙:
- 한국어로 답변
- 반드시 300자 이내로 간결하게 답변 (핵심만)
- 건강기능식품/의료 분야의 SEO 특성을 고려
- 과장된 효과 주장은 피하고 데이터 기반으로 답변
- 긴 목록 대신 핵심 3개 이내로 제한`;

export async function chat(
  messages: ChatMessage[],
  seoContext?: Record<string, unknown>,
): Promise<string> {
  const client = getClient();

  const systemContent = seoContext
    ? `${CHAT_SYSTEM_PROMPT}\n\n현재 사이트 SEO 데이터 요약:\n${JSON.stringify(seoContext, null, 2)}`
    : CHAT_SYSTEM_PROMPT;

  const response = await client.chat.completions.create({
    model: env.OPENAI_MODEL,
    messages: [
      { role: "system", content: systemContent },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ],
    // GPT-5 mini는 temperature 기본값(1)만 지원
    max_completion_tokens: 4096,
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content && response.choices[0]?.finish_reason === "length") {
    return "응답이 너무 길어 중단되었습니다. 질문을 좀 더 구체적으로 해주시면 더 나은 답변을 드릴 수 있습니다.";
  }
  return content ?? "죄송합니다, 응답을 생성할 수 없습니다.";
}
