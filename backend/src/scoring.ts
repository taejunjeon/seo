import type { SchemaInfo, ContentStructure } from "./crawl";

/* ═══════════════════════════════════════
   AEO / GEO 점수 산출 엔진
   ═══════════════════════════════════════ */

export type ScoreBreakdown = {
  name: string;
  label: string;
  score: number;
  maxScore: number;
  status: "measured" | "estimated" | "unavailable";
  detail: string;
};

export type AeoGeoResult = {
  type: "AEO" | "GEO";
  totalScore: number;
  maxPossible: number;
  normalizedScore: number;   // 0~100
  breakdown: ScoreBreakdown[];
  measuredAt: string;
};

/* ── AEO Score 산출 ── */
export const calculateAeoScore = (data: {
  totalKeywords: number;
  qaKeywords: number;
  opportunityKeywords: number;
  keywordsInTop3: number;
  keywordsInTop10: number;
  schema: SchemaInfo | null;
  content: ContentStructure | null;
  performanceScore: number | null;
  aiCitation: {
    sampled: number;
    aiOverviewPresent: number;
    citedQueries: number;
    citedReferences: number;
    citationRateAmongAiOverview: number;
    siteHost: string;
    measuredAt: string;
    samples: { query: string; cited: boolean }[];
  } | null;
  aiTraffic: {
    startDate: string;
    endDate: string;
    aiSessions: number;
    totalSessions: number;
    sources: { source: string; sessions: number }[];
  } | null;
}): AeoGeoResult => {
  const breakdown: ScoreBreakdown[] = [];

  // 1. Q&A 키워드 커버리지 (20점)
  const qaRatio = data.totalKeywords > 0 ? data.qaKeywords / data.totalKeywords : 0;
  const qaScore = Math.min(20, Math.round(qaRatio * 100));
  breakdown.push({
    name: "qaKeywords",
    label: "Q&A 키워드 커버리지",
    score: qaScore,
    maxScore: 20,
    status: "measured",
    detail: `${data.qaKeywords}/${data.totalKeywords} 키워드가 Q&A 유형 (${(qaRatio * 100).toFixed(1)}%)`,
  });

  // 2. 구조화 데이터 (20점)
  if (data.schema) {
    let schemaScore = 0;
    const details: string[] = [];
    if (data.schema.hasFAQ) { schemaScore += 7; details.push("FAQPage ✅"); }
    else { details.push("FAQPage ❌"); }
    if (data.schema.hasArticle) { schemaScore += 5; details.push("Article ✅"); }
    else { details.push("Article ❌"); }
    if (data.schema.hasAuthor) { schemaScore += 4; details.push("저자 정보 ✅"); }
    else { details.push("저자 정보 ❌"); }
    if (data.schema.hasHowTo) { schemaScore += 2; details.push("HowTo ✅"); }
    if (data.schema.hasMedical) { schemaScore += 2; details.push("Medical ✅"); }
    breakdown.push({
      name: "schema",
      label: "구조화 데이터 (Schema)",
      score: Math.min(20, schemaScore),
      maxScore: 20,
      status: "measured",
      detail: details.join(" · "),
    });
  } else {
    breakdown.push({
      name: "schema",
      label: "구조화 데이터 (Schema)",
      score: 0,
      maxScore: 20,
      status: "unavailable",
      detail: "페이지 크롤링 대기 — 측정 버튼을 눌러주세요",
    });
  }

  // 3. Featured Snippet / 검색 가시성 (15점)
  const top3Ratio = data.totalKeywords > 0 ? data.keywordsInTop3 / data.totalKeywords : 0;
  const visibilityScore = Math.min(15, Math.round(top3Ratio * 50));
  breakdown.push({
    name: "visibility",
    label: "검색 상위 노출 (TOP 3)",
    score: visibilityScore,
    maxScore: 15,
    status: "measured",
    detail: `${data.keywordsInTop3}/${data.totalKeywords} 키워드가 TOP 3 (${(top3Ratio * 100).toFixed(1)}%)`,
  });

  // 4. 콘텐츠 구조 품질 (15점)
  if (data.content) {
    let contentScore = 0;
    const details: string[] = [];
    if (data.content.h2Count >= 3) { contentScore += 4; details.push(`H2 ${data.content.h2Count}개 ✅`); }
    else { details.push(`H2 ${data.content.h2Count}개 (3개 이상 권장)`); }
    if (data.content.h3Count >= 2) { contentScore += 3; details.push(`H3 ${data.content.h3Count}개 ✅`); }
    if (data.content.listCount >= 2) { contentScore += 3; details.push(`목록 ${data.content.listCount}개 ✅`); }
    else { details.push(`목록 ${data.content.listCount}개 (2개 이상 권장)`); }
    if (data.content.tableCount >= 1) { contentScore += 2; details.push(`표 ${data.content.tableCount}개 ✅`); }
    if (data.content.blockquoteCount >= 1) { contentScore += 2; details.push(`인용 ${data.content.blockquoteCount}개 ✅`); }
    if (data.content.hasMetaDescription && data.content.metaDescLength >= 50) { contentScore += 1; details.push("메타 디스크립션 ✅"); }
    breakdown.push({
      name: "contentStructure",
      label: "콘텐츠 구조 품질",
      score: Math.min(15, contentScore),
      maxScore: 15,
      status: "measured",
      detail: details.join(" · "),
    });
  } else {
    breakdown.push({
      name: "contentStructure",
      label: "콘텐츠 구조 품질",
      score: 0,
      maxScore: 15,
      status: "unavailable",
      detail: "페이지 크롤링 대기 — 측정 버튼을 눌러주세요",
    });
  }

  // 5. AI 인용 빈도 (20점) — 유료 API 필요
  if (data.aiCitation) {
    const citedRate = data.aiCitation.citationRateAmongAiOverview; // 0~1
    // 10% 이상이면 20점(만점)으로 보는 보수적 스케일
    const score = Math.min(20, Math.round(citedRate * 200));
    const citedExamples = data.aiCitation.samples
      .filter((s) => s.cited)
      .slice(0, 3)
      .map((s) => s.query)
      .join(" / ");

    breakdown.push({
      name: "aiCitation",
      label: "AI 답변 인용 빈도",
      score,
      maxScore: 20,
      status: "measured",
      detail: [
        `표본 ${data.aiCitation.sampled}개 키워드`,
        `AI Overview ${data.aiCitation.aiOverviewPresent}개`,
        `${data.aiCitation.siteHost} 인용 ${data.aiCitation.citedQueries}개 (${(citedRate * 100).toFixed(1)}%)`,
        `인용 링크 ${data.aiCitation.citedReferences}개`,
        citedExamples ? `예시: ${citedExamples}` : "예시: —",
        `측정: ${new Date(data.aiCitation.measuredAt).toLocaleString("ko-KR")}`,
      ].join(" · "),
    });
  } else {
    breakdown.push({
      name: "aiCitation",
      label: "AI 답변 인용 빈도",
      score: 0,
      maxScore: 20,
      status: "unavailable",
      detail: "SerpAPI/Perplexity 설정 필요 (SERP_API_KEY / PERPLEXITY_API_KEY)",
    });
  }

  // 6. AI 유입 트래픽 (10점) — GA4 기반(휴리스틱)
  if (data.aiTraffic) {
    const { aiSessions, totalSessions, sources, startDate, endDate } = data.aiTraffic;
    const ratio = totalSessions > 0 ? aiSessions / totalSessions : 0;

    const ratioScore =
      ratio >= 0.02 ? 10 :
      ratio >= 0.01 ? 8 :
      ratio >= 0.005 ? 6 :
      ratio >= 0.001 ? 4 :
      ratio >= 0.0002 ? 2 : 0;

    const absoluteScore =
      aiSessions >= 500 ? 10 :
      aiSessions >= 200 ? 8 :
      aiSessions >= 50 ? 6 :
      aiSessions >= 10 ? 4 :
      aiSessions >= 1 ? 2 : 0;

    const score = Math.min(10, Math.max(ratioScore, absoluteScore));
    const topSources = sources
      .slice()
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 3)
      .map((s) => `${s.source} ${s.sessions}`)
      .join(", ");

    breakdown.push({
      name: "aiTraffic",
      label: "AI 유입 트래픽",
      score,
      maxScore: 10,
      status: "measured",
      detail: [
        `AI 추천 유입 세션 ${aiSessions} (전체 대비 ${(ratio * 100).toFixed(2)}%)`,
        `상위 소스: ${topSources || "—"}`,
        `기간: ${startDate}~${endDate}`,
        "기준: sessionSource 필터(chatgpt/openai/perplexity/claude/gemini 등)",
      ].join(" · "),
    });
  } else {
    breakdown.push({
      name: "aiTraffic",
      label: "AI 유입 트래픽",
      score: 0,
      maxScore: 10,
      status: "unavailable",
      detail: "GA4 API 미설정 또는 조회 실패",
    });
  }

  const totalScore = breakdown.reduce((s, b) => s + b.score, 0);
  const maxPossible = breakdown.filter((b) => b.status !== "unavailable").reduce((s, b) => s + b.maxScore, 0);

  return {
    type: "AEO",
    totalScore,
    maxPossible: maxPossible || 1,
    normalizedScore: maxPossible > 0 ? Math.round((totalScore / maxPossible) * 100) : 0,
    breakdown,
    measuredAt: new Date().toISOString(),
  };
};

/* ── GEO Score 산출 ── */
export const calculateGeoScore = (data: {
  totalKeywords: number;
  keywordsInTop3: number;
  keywordsInTop10: number;
  performanceScore: number | null;
  seoScore: number | null;
  ctrCurrent: number;
  ctrPrevious: number;
  schema: SchemaInfo | null;
  content: ContentStructure | null;
  aiCitation: {
    sampled: number;
    aiOverviewPresent: number;
    citedQueries: number;
    citedReferences: number;
    citationRateAmongAiOverview: number;
    siteHost: string;
    measuredAt: string;
    samples: { query: string; cited: boolean }[];
  } | null;
}): AeoGeoResult => {
  const breakdown: ScoreBreakdown[] = [];

  // 1. AI Overview 노출율 (25점) — SerpAPI 기반 측정
  if (data.aiCitation) {
    const presentRate = data.aiCitation.sampled > 0
      ? data.aiCitation.aiOverviewPresent / data.aiCitation.sampled
      : 0;
    // AI Overview가 표본 키워드의 30% 이상에서 노출되면 만점(25)
    const overviewScore = Math.min(25, Math.round(presentRate * (25 / 0.3)));
    const citedExamples = data.aiCitation.samples
      .filter((s) => s.cited)
      .slice(0, 3)
      .map((s) => s.query)
      .join(" / ");

    breakdown.push({
      name: "aiOverview",
      label: "AI Overview 노출",
      score: overviewScore,
      maxScore: 25,
      status: "measured",
      detail: [
        `표본 ${data.aiCitation.sampled}개 키워드 중 AI Overview ${data.aiCitation.aiOverviewPresent}개 (${(presentRate * 100).toFixed(1)}%)`,
        `${data.aiCitation.siteHost} 인용 ${data.aiCitation.citedQueries}개 (인용률 ${(data.aiCitation.citationRateAmongAiOverview * 100).toFixed(1)}%)`,
        citedExamples ? `인용 예시: ${citedExamples}` : "",
        `측정: ${new Date(data.aiCitation.measuredAt).toLocaleString("ko-KR")}`,
      ].filter(Boolean).join(" · "),
    });
  } else {
    breakdown.push({
      name: "aiOverview",
      label: "AI Overview 노출",
      score: 0,
      maxScore: 25,
      status: "unavailable",
      detail: "유료 SERP API 필요 (SerpAPI/DataForSEO) — SERP_API_KEY 설정 후 측정",
    });
  }

  // 2. 검색 순위 기반 (20점)
  const top3Ratio = data.totalKeywords > 0 ? data.keywordsInTop3 / data.totalKeywords : 0;
  const top10Ratio = data.totalKeywords > 0 ? data.keywordsInTop10 / data.totalKeywords : 0;
  const rankScore = Math.min(20, Math.round(top3Ratio * 40 + top10Ratio * 10));
  breakdown.push({
    name: "searchRank",
    label: "검색 순위 (TOP 3/10)",
    score: rankScore,
    maxScore: 20,
    status: "measured",
    detail: `TOP 3: ${data.keywordsInTop3}개, TOP 10: ${data.keywordsInTop10}개 / 전체 ${data.totalKeywords}개`,
  });

  // 3. Schema 마크업 (20점)
  if (data.schema) {
    let schemaScore = 0;
    const details: string[] = [];
    if (data.schema.hasFAQ) { schemaScore += 8; details.push("FAQPage ✅ (AI Overview 채택 3.2배 증가)"); }
    else { details.push("FAQPage ❌"); }
    if (data.schema.hasArticle) { schemaScore += 5; details.push("Article ✅"); }
    if (data.schema.hasAuthor) { schemaScore += 4; details.push("저자 (E-E-A-T) ✅"); }
    if (data.schema.hasSpeakable) { schemaScore += 3; details.push("Speakable ✅"); }
    breakdown.push({
      name: "schemaGeo",
      label: "구조화 데이터 (GEO)",
      score: Math.min(20, schemaScore),
      maxScore: 20,
      status: "measured",
      detail: details.join(" · "),
    });
  } else {
    breakdown.push({
      name: "schemaGeo",
      label: "구조화 데이터 (GEO)",
      score: 0,
      maxScore: 20,
      status: "unavailable",
      detail: "페이지 크롤링 대기",
    });
  }

  // 4. 콘텐츠 신뢰도 (15점)
  if (data.content) {
    let trustScore = 0;
    const details: string[] = [];
    if (data.content.blockquoteCount >= 1) { trustScore += 5; details.push("인용 블록 ✅"); }
    else { details.push("인용 블록 없음"); }
    if (data.content.tableCount >= 1) { trustScore += 4; details.push("데이터 표 ✅"); }
    if (data.content.listCount >= 3) { trustScore += 3; details.push("체계적 목록 ✅"); }
    if (data.content.wordCount >= 1000) { trustScore += 3; details.push(`충분한 분량 (${data.content.wordCount}단어) ✅`); }
    else { details.push(`${data.content.wordCount}단어 (1000+ 권장)`); }
    breakdown.push({
      name: "contentTrust",
      label: "콘텐츠 신뢰도",
      score: Math.min(15, trustScore),
      maxScore: 15,
      status: "measured",
      detail: details.join(" · "),
    });
  } else {
    breakdown.push({
      name: "contentTrust",
      label: "콘텐츠 신뢰도",
      score: 0,
      maxScore: 15,
      status: "unavailable",
      detail: "페이지 크롤링 대기",
    });
  }

  // 5. 기술 성능 CWV (10점)
  if (data.performanceScore !== null) {
    const techScore = Math.min(10, Math.round(data.performanceScore / 10));
    breakdown.push({
      name: "cwv",
      label: "기술 성능 (PageSpeed)",
      score: techScore,
      maxScore: 10,
      status: "measured",
      detail: `Performance ${data.performanceScore}점 → ${techScore}/10`,
    });
  } else {
    breakdown.push({
      name: "cwv",
      label: "기술 성능 (PageSpeed)",
      score: 0,
      maxScore: 10,
      status: "unavailable",
      detail: "PageSpeed 측정 필요",
    });
  }

  // 6. CTR 트렌드 (10점)
  const ctrDelta = data.ctrCurrent - data.ctrPrevious;
  const ctrScore = Math.min(10, Math.max(0, Math.round(5 + ctrDelta * 10)));
  breakdown.push({
    name: "ctrTrend",
    label: "CTR 변화 추이",
    score: ctrScore,
    maxScore: 10,
    status: "measured",
    detail: `현재 CTR ${(data.ctrCurrent * 100).toFixed(2)}% (변동 ${ctrDelta >= 0 ? "+" : ""}${(ctrDelta * 100).toFixed(2)}%p)`,
  });

  const totalScore = breakdown.reduce((s, b) => s + b.score, 0);
  const maxPossible = breakdown.filter((b) => b.status !== "unavailable").reduce((s, b) => s + b.maxScore, 0);

  return {
    type: "GEO",
    totalScore,
    maxPossible: maxPossible || 1,
    normalizedScore: maxPossible > 0 ? Math.round((totalScore / maxPossible) * 100) : 0,
    breakdown,
    measuredAt: new Date().toISOString(),
  };
};
