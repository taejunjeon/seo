너는 Biocom AI SEO/AEO/GEO 대시보드의 시니어 백엔드 엔지니어다(Express + TS).

목표: “AI 유입(AI 서비스 referral 유입)”을 GA4 Data API로 안정적으로 집계해서 프론트가 쓰게 만든다.
중요: 이 지표는 Google 검색의 AI Overview 유입을 분리 측정하는 게 아니라, ChatGPT/Perplexity/Gemini/Claude 등 AI 서비스에서 직접 넘어온 referral 중심이다. UI에 명확히 표기할 수 있도록 metadata도 내려줘.

[1] 신규 엔드포인트 추가
GET /api/ga4/ai-traffic?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&limit=20

Response(JSON) 예시:
{
  "range": { "startDate": "...", "endDate": "..." },
  "definition": "AI tool referral traffic based on sessionSource allowlist",
  "totals": {
    "sessions": number,
    "activeUsers": number,
    "totalUsers": number,
    "ecommercePurchases": number,
    "grossPurchaseRevenue": number
  },
  "bySource": [
    { "sessionSource": string, "sessionSourceMedium": string, "sessions": number, "activeUsers": number, "ecommercePurchases": number, "grossPurchaseRevenue": number }
  ],
  "byLandingPage": [
    { "landingPagePlusQueryString": string, "sessions": number, "activeUsers": number, "ecommercePurchases": number, "grossPurchaseRevenue": number }
  ],
  "debug": { "matchedPatterns": [...], "notes": [...] }
}

[2] GA4 쿼리 구현 포인트
- dimensions: sessionSource, sessionSourceMedium, landingPagePlusQueryString
- metrics: sessions, activeUsers, totalUsers, ecommercePurchases, grossPurchaseRevenue
- dimensionFilter: sessionSource에 대해 OR 그룹으로 CONTAINS 매칭
  패턴 후보(allowlist로 관리): 
    chatgpt.com, chat.openai.com, openai, perplexity.ai, claude.ai, gemini.google.com, bard.google.com, copilot.microsoft.com, bing.com
- (가능하면) sessionMedium=referral 또는 sessionDefaultChannelGroup=Referral 같은 보조 필터를 함께 적용해서 노이즈를 줄이되,
  실제 데이터(최근 30일 top sessionSource) 확인 후 결정.

[3] 룰 튜닝을 위한 디버그 엔드포인트(강력 추천)
GET /api/ga4/top-sources?startDate=...&endDate=...&limit=200
- 필터 없이 sessionSource 상위 목록을 내려줘서, “실제 값”을 보고 allowlist를 튜닝하게 해줘.

[4] “AI 유입이 만든 주제/키워드” 근사치(옵션)
- byLandingPage TOP N을 뽑고,
- GSC API를 page 필터로 걸어서 해당 페이지의 top queries(예: 3개)만 붙여주는 API를 별도로 제공:
  GET /api/ai-traffic/topics?startDate=...&endDate=...&topPages=10&topQueries=3
- 응답: landingPage -> aiSessions -> gscTopQueries[]

[5] 캐시/비용
- 내부 운영이라도 API 남발 방지를 위해 30분-6시간 TTL 캐시(메모리든 supabase든) 권장.

[6] 최소 보안/안전(내부툴이라도)
- crawl/subpages 등 “서버가 URL을 직접 fetch”하는 엔드포인트는 allowlist 도메인(biocom.kr 등)만 허용.
- 외부 링크 redirect/canonical 따라가는 로직도 최대 hop/timeout 제한.

완료 기준(DoD):
- /api/ga4/ai-traffic가 실데이터를 반환(0이어도 구조는 정상)
- /api/ga4/top-sources로 실제 sessionSource 값을 확인 가능
- 프론트가 KPI + 표(소스/랜딩) 렌더링 가능