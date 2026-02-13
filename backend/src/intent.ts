import { env } from "./env";
import { isOpenAIConfigured } from "./ai";
import OpenAI from "openai";

/* ═══════════════════════════════════════
   키워드 인텐트 분류 엔진
   규칙 기반 1차 분류 + GPT 보완(선택)
   ═══════════════════════════════════════ */

export type IntentType = "informational" | "commercial" | "navigational" | "brand";

export type KeywordIntent = {
  query: string;
  intent: IntentType;
  confidence: "high" | "medium" | "low";
};

export type IntentSummary = {
  categories: {
    label: string;
    type: IntentType;
    percent: number;
    count: number;
    colorClass: string;
  }[];
  keywords: KeywordIntent[];
  totalKeywords: number;
  method: "rule" | "hybrid";
};

/* ── 규칙 기반 분류 패턴 ── */

const BRAND_PATTERNS = [
  /^바이오컴$/i,
  /^biocom$/i,
  /^biocom\.kr$/i,
];

const BRAND_PREFIX_PATTERNS = [
  /^바이오컴\s+/i,
  /^biocom\s+/i,
];

const NAVIGATIONAL_SUFFIXES = [
  "홈페이지", "사이트", "로그인", "회원가입", "고객센터",
  "채용", "위치", "주소", "전화번호", "영업시간",
];

const COMMERCIAL_PATTERNS = [
  /비용/, /가격/, /얼마/, /후기/, /리뷰/, /추천/, /비교/,
  /구매/, /구입/, /할인/, /쿠폰/, /무료/, /체험/,
  /예약/, /신청/, /접수/, /상담/,
  /best/i, /review/i, /price/i, /buy/i, /cheap/i, /coupon/i,
  /vs\s/i, /versus/i, /compared/i,
];

const INFORMATIONAL_PATTERNS = [
  /효능/, /효과/, /증상/, /원인/, /방법/, /차이/, /부작용/,
  /뭐/, /무엇/, /어떻게/, /왜/, /언제/, /어디/,
  /종류/, /의미/, /정의/, /설명/, /특징/, /장단점/,
  /먹는\s*법/, /복용법/, /사용법/, /섭취/, /함량/,
  /검사\s*방법/, /진단/, /치료/,
  /what/i, /how/i, /why/i, /when/i, /where/i,
  /meaning/i, /definition/i, /guide/i, /tutorial/i,
];

function classifyByRules(query: string): KeywordIntent {
  const q = query.trim().toLowerCase();

  // 1. 브랜드 단독
  for (const pattern of BRAND_PATTERNS) {
    if (pattern.test(q)) {
      return { query, intent: "brand", confidence: "high" };
    }
  }

  // 2. 브랜드 + 탐색
  for (const prefix of BRAND_PREFIX_PATTERNS) {
    if (prefix.test(q)) {
      // 브랜드 + navigational suffix
      for (const suffix of NAVIGATIONAL_SUFFIXES) {
        if (q.includes(suffix)) {
          return { query, intent: "navigational", confidence: "high" };
        }
      }
      // 브랜드 + 상업성 패턴
      for (const pattern of COMMERCIAL_PATTERNS) {
        if (pattern.test(q)) {
          return { query, intent: "commercial", confidence: "high" };
        }
      }
      // 브랜드 + 기타 → navigational (특정 서비스 찾는 것)
      return { query, intent: "navigational", confidence: "medium" };
    }
  }

  // 3. 상업성 체크 (비용, 가격, 후기 등)
  for (const pattern of COMMERCIAL_PATTERNS) {
    if (pattern.test(q)) {
      return { query, intent: "commercial", confidence: "high" };
    }
  }

  // 4. 정보성 체크 (효능, 증상, 방법 등)
  for (const pattern of INFORMATIONAL_PATTERNS) {
    if (pattern.test(q)) {
      return { query, intent: "informational", confidence: "high" };
    }
  }

  // 5. "검사" 관련 키워드 → 상업성 (서비스 탐색)
  if (/검사/.test(q)) {
    return { query, intent: "commercial", confidence: "medium" };
  }

  // 6. 기본: 정보성 (대부분의 건강 키워드는 정보 탐색)
  return { query, intent: "informational", confidence: "low" };
}

/* ── GPT 보완 분류 (confidence가 low인 항목만) ── */
async function classifyWithGPT(keywords: string[]): Promise<Map<string, IntentType>> {
  if (!isOpenAIConfigured() || keywords.length === 0) return new Map();

  try {
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY! });

    const response = await client.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: `다음 검색 키워드들의 검색 의도를 분류하세요. biocom.kr은 건강기능식품/건강검사 서비스 회사입니다.

반드시 JSON 객체로만 응답하세요 (마크다운 없이):
{"키워드1": "informational|commercial|navigational|brand", "키워드2": ...}

분류 기준:
- informational: 정보/지식 탐색 (효능, 증상, 방법 등)
- commercial: 구매/서비스 검토 (비용, 후기, 비교, 검사 등)
- navigational: 특정 사이트/페이지 탐색
- brand: 브랜드명 직접 검색`,
        },
        {
          role: "user",
          content: JSON.stringify(keywords),
        },
      ],
      max_completion_tokens: 1000,
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "{}";
    const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as Record<string, string>;
    const result = new Map<string, IntentType>();

    for (const [kw, intent] of Object.entries(parsed)) {
      if (["informational", "commercial", "navigational", "brand"].includes(intent)) {
        result.set(kw, intent as IntentType);
      }
    }
    return result;
  } catch (err) {
    console.error("[Intent GPT] 분류 실패:", err instanceof Error ? err.message : err);
    return new Map();
  }
}

/* ── 메인 분류 함수 ── */
export async function classifyKeywordIntents(
  keywords: { query: string; clicks?: number; impressions?: number }[],
): Promise<IntentSummary> {
  // 1차: 규칙 기반 분류
  const results: KeywordIntent[] = keywords.map((kw) => classifyByRules(kw.query));

  // 2차: confidence가 low인 항목을 GPT로 보완
  const lowConfidence = results.filter((r) => r.confidence === "low");
  let method: "rule" | "hybrid" = "rule";

  if (lowConfidence.length > 0 && isOpenAIConfigured()) {
    const gptResults = await classifyWithGPT(lowConfidence.map((r) => r.query));
    if (gptResults.size > 0) {
      method = "hybrid";
      for (const result of results) {
        const gptIntent = gptResults.get(result.query);
        if (gptIntent && result.confidence === "low") {
          result.intent = gptIntent;
          result.confidence = "medium";
        }
      }
    }
  }

  // 집계
  const counts: Record<IntentType, number> = {
    informational: 0,
    commercial: 0,
    navigational: 0,
    brand: 0,
  };

  for (const r of results) {
    counts[r.intent]++;
  }

  const total = results.length || 1;

  const LABEL_MAP: Record<IntentType, { label: string; colorClass: string }> = {
    informational: { label: "정보성", colorClass: "intentBarInfo" },
    commercial: { label: "상업성", colorClass: "intentBarCommercial" },
    navigational: { label: "탐색성", colorClass: "intentBarNavigation" },
    brand: { label: "브랜드", colorClass: "intentBarBrand" },
  };

  const categories = (Object.keys(counts) as IntentType[]).map((type) => ({
    label: LABEL_MAP[type].label,
    type,
    percent: Math.round((counts[type] / total) * 100),
    count: counts[type],
    colorClass: LABEL_MAP[type].colorClass,
  }));

  // 비율 합 100% 보정
  const sumPercent = categories.reduce((s, c) => s + c.percent, 0);
  if (sumPercent !== 100 && categories.length > 0) {
    const diff = 100 - sumPercent;
    // 가장 큰 카테고리에 차이를 더함
    const maxCat = categories.reduce((a, b) => (a.count > b.count ? a : b));
    maxCat.percent += diff;
  }

  return {
    categories,
    keywords: results,
    totalKeywords: results.length,
    method,
  };
}
