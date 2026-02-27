# 작업 대상
backend/src/ga4.ts (또는 AI traffic 관련 allowlist가 정의된 파일)

# 현재 상태
AI_REFERRAL_SOURCE_PATTERNS_ALLOWLIST 배열이 CONTAINS 기반 문자열 필터를 사용 중.
bing.com이 AI allowlist에 포함되어 일반 검색 트래픽과 혼재됨.

# 변경 요구사항

## 1. allowlist 필터를 FULL_REGEXP 도메인 앵커링으로 전환
GA4 Data API의 StringFilter에서 matchType을 FULL_REGEXP로 변경하고,
각 패턴을 도메인 앵커링 정규식으로 변경해라.

예시 패턴:
- chatgpt.com → "(^|\\.)chatgpt\\.com$"
- chat.openai.com → "(^|\\.)chat\\.openai\\.com$"  
- perplexity.ai → "(^|\\.)perplexity\\.ai$"
- claude.ai → "(^|\\.)claude\\.ai$"
- gemini.google.com → "(^|\\.)gemini\\.google\\.com$"
- bard.google.com → "(^|\\.)bard\\.google\\.com$"
- copilot.microsoft.com → "(^|\\.)copilot\\.microsoft\\.com$"

## 2. 신규 AI 소스 추가
- you.com
- komo.ai
- phind.com
- meta.ai
- search.brave.com (Brave AI Search)

## 3. bing.com 처리 — 제거가 아닌 분리 라벨링
bing.com을 AI allowlist에서 제거하되, 별도의 카테고리로 분리해라.

타입 구조 예시:
type TrafficCategory = "ai_referral" | "search_legacy" | "organic";

bing.com → "search_legacy" 라벨
copilot.microsoft.com → "ai_referral" 라벨

API 응답에서 bySource 데이터에 category 필드를 추가하여
프론트에서 필터링/라벨링이 가능하도록 해라.

## 4. 검증
변경 후 /api/ga4/top-sources를 호출해서
- "mychatgpt" 같은 거짓양성이 필터링되는지
- www.chatgpt.com은 포함되는지
- bing.com이 ai_referral이 아닌 search_legacy로 분류되는지
확인하는 테스트 코드를 작성해라.

# 주의사항
- EXACT 매칭을 사용하지 마라. www 서브도메인 변형을 놓친다.
- CONTAINS도 사용하지 마라. 거짓양성 문제가 있다.
- 반드시 FULL_REGEXP를 사용해라.