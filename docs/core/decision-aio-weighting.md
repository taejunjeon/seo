결론부터 말하면, **KR 운영용 “AEO 점수(20점)” 산식에는 Google AIO(AI Overviews)를 당장은 빼는 게 맞습니다.** 대신 **“참고용(벤치마크/모니터링)”으로는 반드시 계속 측정**하는 걸 추천해요. 🙂
지금 상태에서 AIO를 산식에 넣으면 **품질이 아니라 “측정 환경/키워드 운”**에 점수가 흔들릴 확률이 높습니다.

아래에 **넣는 경우 vs 빼는 경우 장단점**, 그리고 **ChatGPT:Perplexity 가중치(8:2 / 9:1)**에 대한 제 추천, 그리고 **report0221-back3 문서 피드백**까지 정리해볼게요.

---

## 1) Google AIO를 산식에 “넣을 때” 장단점

### 👍 장점

* **구글 방향성과 정렬**
  AI Overviews는 구글 검색 결과에 직접 노출되기 때문에(사용자 규모/영향력), “장기적으로”는 가장 큰 전장입니다. 구글도 AI Overviews가 “유용할 때” 노출된다고 명시하고 있어요. ([구글 도움말][1])
* **콘텐츠 품질 개선을 강하게 유도**
  “출처로 뽑히려면” 결국 요약이 명확하고, 근거가 있고, 구조가 좋고(FAQ, 문서 구조), 신뢰 신호(작성자/기관/근거 링크)가 있어야 해서 **품질 개선 드라이버**가 됩니다.
* **경쟁사 벤치마크가 직관적**
  AIO references 목록을 보면 “구글이 지금 누구를 인용하는지”가 보여서, **우리가 어떤 포맷/근거/구조로 맞춰야 하는지** 빠르게 감이 옵니다.

### 👎 단점 (이게 지금은 더 큼)

* **KR(hl=ko/gl=kr)에서 ‘측정 툴’이 안정적이지 않을 수 있음**
  구글은 AI Overviews가 한국어를 포함한 여러 언어에서 제공된다고 안내합니다. ([구글 도움말][1])
  그런데 SerpAPI 문서에는 “현재 AI Overview 블록이 영어(hl=en)에서만 보인다”는 설명이 남아 있어요. ([SerpApi][2])
  게다가 SerpAPI 로드맵에도 **“AI Overview 한국어 지원 요청” 이슈가 열려 있습니다.** ([GitHub][3])
  → 이 조합이면, **실제로 구글에 AIO가 떠도 SerpAPI가 못 잡거나(eligible=0), 반대로 특정 케이스만 잡는** 식으로 KPI가 깨질 수 있어요.
* **표본 키워드 구성에 점수가 과하게 종속됨**
  AIO는 “모든 검색어에 항상 뜨는” 게 아니라, 구글 시스템이 도움 된다고 판단할 때 뜹니다. ([구글 도움말][1])
  그래서 샘플 키워드가 상업/브랜드 위주면 **AIO 노출(분모)이 0에 수렴**할 수 있고, 그 순간 점수는 “품질”이 아니라 “노출 여부”로 0이 됩니다.
* **운영 비용/쿼터 압박 + 변동성**
  특히 AIO는 추가 요청이 필요한 케이스가 있고, page_token이 **1분 안에 만료**된다고 문서에 명시돼 있어요. ([SerpApi][4])
  → 운영 환경에서 “재시도/캐시/동시성”을 잘못 잡으면 비용이 튀고, 반대로 너무 보수적으로 잡으면 측정 누락이 늘어납니다.

---

## 2) Google AIO를 산식에서 “뺄 때” 장단점

### 👍 장점

* **운영 지표가 ‘안 흔들림’**
  지금 팀이 원하는 건 “이번 주에 뭘 고치면 좋아지나”인데, 측정 불안정이 들어오면 매주 점수가 출렁이고 신뢰가 깨집니다.
* **비용 절감 + 속도 개선**
  /api/aeo/score가 매번 SerpAPI까지 부르면 비용/쿼터/대기시간이 늘어요. “기본은 OpenAI/Perplexity로, 필요 시 fallback”은 운영적으로 현실적입니다.
* **프론트(UI) 해석이 쉬워짐**
  지금 UI에서 중요한 건 “0점 원인을 즉시 분해”하는 건데, AIO가 들어오면 ‘노출 0’이 잦아져서 사용자가 “왜 이렇게 맨날 0이야?”가 됩니다.

### 👎 단점

* **구글 특화 신호가 KPI에서 빠짐**
  “구글에서 인용되는가”를 KPI로 직접 못 밀게 됩니다. (단, 이건 **‘참고용 지표’로 트랙킹**하면 해결돼요.)

---

## 3) 내 추천: “산식 제외 + 참고용으로는 반드시 유지” ✅

저는 report0221-back3 방향(=KR 운영 점수에서 Google AIO 제외)을 **지금 단계에선 옳다**고 봅니다.

다만 “품질을 높이는데 도움이 되면 넣자”는 TJ님 감각도 맞아요. 그래서 **아예 버리는 게 아니라 ‘역할 분리’**가 핵심입니다.

### 추천 운영 구조 (가장 실용적)

* **운영 KPI(점수)**: ChatGPT(Search) + Perplexity만으로 계산
* **Google AIO는 별도 카드(참고/벤치마크)**로 표시

  * “노출(eligible)”과 “인용(cited)”을 분리해서 보여주기
  * 점수에는 안 넣되, “경쟁 출처 TOP”은 반드시 보여주기 (콘텐츠 팀 액션으로 바로 연결됨)

이렇게 하면:

* KPI는 안정적이고
* 품질 개선(구글 기준 벤치마크)은 계속 할 수 있어요.

---

## 4) “그럼 ChatGPT vs Perplexity 가중치 8:2 / 9:1” 평가

### 팩트(근거)

* OpenAI web search는 **인용 URL이 annotations(url_citation) 메타데이터로 제공**되므로, “텍스트 파싱”보다 안정적입니다. ([OpenAI Developer Documentation][5])
  (back3에서 “메타 기반 추출”로 전환한 건 방향이 맞아요.)

### 내 판단(추론)

* **8:2가 더 안전한 출발점**이라고 봅니다.
  이유: Perplexity는 “출처 나열”이 제품 특성상 강하고, 헬스/정보탐색 유저에서 영향이 무시할 수 없어요. 9:1로 너무 눌러버리면 “Perplexity에서의 개선”이 KPI에 거의 반영이 안 돼서, 개선 우선순위가 뒤로 밀립니다.
* 다만 “우리 KPI 목적”이 **리드/구매 전환**에 더 강하게 연결되는 채널이 ChatGPT라고 내부 확신이 있으면, **9:1도 가능**합니다. 대신 그 경우에도 **프로바이더별 원지표는 반드시 같이 보여줘야** 합니다. (점수는 9:1이어도, 디버그/실행은 각자 봐야 함)

### 가중치 추천안 (현실적 1안)

* 운영 점수: **ChatGPT 0.8, Perplexity 0.2**
* 보조 지표: Google AIO(참고용) 별도 트랙

### 더 좋은 2안(조금만 더 하면 KPI가 똑똑해짐)

* “AIO 포함/미포함” 자체를 싸우지 말고, **가용한 provider만 재정규화**하세요.

예시 로직(설명용):

* provider별 `eligible >= 3` 같은 최소 기준을 넘는 것만 “활성 provider”로 보고
* 최종 점수는
  `sum(w_p * citationRate_p) / sum(w_p for active providers)`
  이렇게 하면 **AIO가 KR에서 eligible=0이라도 점수를 0으로 끌어내리지 않습니다.**

---

## 5) report0221-back3 문서 피드백 (좋은 점 + 보완점)

### ✅ 좋은 점 (그대로 밀어도 됨)

1. **KR 운영 점수에서 AIO 제외**: KPI 안정성 측면에서 맞는 판단입니다.
   특히 SerpAPI 쪽 “영어 중심” 문구/이슈가 있는 상황이라 더더욱요. ([SerpApi][2])
2. **SerpAPI 비용 최적화(기본 미호출, 실패 시 fallback)**: 운영에서 매우 중요합니다.
3. **Strict vs Broad 매칭 분리**:

   * Strict = KPI 안정성
   * Broad = 디버그(“사실상 우리 링크인데 리다이렉트/캐노니컬 때문에 놓치는지” 파악)
     이 구조는 진짜 좋아요.

### 🔧 보완하면 더 좋아지는 점 (우선순위 높은 순)

1. **Broad 매칭은 보안 가드(SSRF 방지) 꼭 넣기**
   broad는 redirect/canonical 따라가면서 외부 URL을 fetch하게 되는데, 엔드포인트가 외부에서 호출 가능하면 보안 이슈가 됩니다.
   최소한:

   * http/https만 허용
   * 리다이렉트 최대 횟수 제한
   * 타임아웃 강제
   * 사설 IP/로컬 네트워크 차단
     이건 “나중” 아니고 지금 넣는 게 안전합니다.
2. **Google AIO를 “완전 제외”가 아니라 ‘벤치마크 모드’로 명확히 살리기**
   지금 문서에도 “참고 표시”가 나오는데, 운영자가 쓰려면 버튼/파라미터가 있어야 합니다.
   예:

   * `/api/ai/citation?provider=google_ai_overview&bench=1&hl=en&gl=us` 같은 별도 모드
   * 또는 SerpAPI가 제공하는 **Google AI Mode API**를 KR에서 쓰는 옵션도 검토(제품 변화 대응). ([SerpApi][4])
3. **점수 정책 1장 문서 고정(진짜 중요)**
   지금처럼 “산식 provider”와 “참고 provider”가 나뉘면, UI/회의에서 꼭 헷갈립니다.
   한 장에:

   * 운영 점수 산식
   * 참고 지표(구글)
   * “0점 분해 규칙”
     이 3개를 못 박아야 팀이 안 흔들려요.

---

## 6) 내가 추천하는 최종 결정 (TJ님 의사결정용)

* **AEO 운영 점수(20점)**: ChatGPT(Search) + Perplexity로만 계산 (가중치 8:2 추천)
* **Google AIO**:

  * “참고용 카드 + 경쟁 출처 TOP + 노출/인용 분리”로 유지
  * KR 측정이 흔들리면 “벤치마크 모드(예: hl=en/gl=us)”로 별도 운영
* **중장기**: 실제로 KR에서 Google AIO/AI Mode가 의미 있게 트래픽/전환에 영향을 주는 게 확인되면, 그때 산식 편입(또는 10% 이하의 작은 비중으로 시작)

---

## Q1–Q3 (결정해야 백엔드/프론트가 안 흔들림)

Q1. **AEO 점수는 “주간 운영 KPI”인가요, 아니면 “품질 벤치마크(장기)”인가요?**

* 운영 KPI면 AIO는 산식 제외가 유리, 벤치마크면 AIO 포함을 더 고민해볼 가치가 있어요.

Q2. **“Google 쪽 AI 지표”는 AI Overviews(AIO)만 볼까요, 아니면 AI Mode까지 포함할까요?**

* 구글 도움말에도 AI Overviews에서 AI Mode로 이어지는 흐름이 언급됩니다. ([구글 도움말][1])
  어떤 걸 “구글 AI 검색” 대표 지표로 볼지 정해야 해요.

Q3. **호출 예산(월 쿼터/비용) 상한을 어떻게 둘까요?**

* 예: “사내에서 하루 10번까지 진단 버튼 허용”, “크론은 하루 1회”, “sampleSize는 기본 5, 관리자만 20” 같은 운영 룰을 먼저 정해야 백엔드 설계가 깔끔해집니다.

원하시면 Q1–Q3에 대한 TJ님 답을 기준으로, **점수 정책 1장(산식/표기/운영룰)**을 제가 바로 “팀 공유용 문서 형태”로 깔끔하게 써드릴게요. 😊

[1]: https://support.google.com/websearch/answer/14901683?co=GENIE.Platform%3DDesktop&hl=en "Find information in faster & easier ways with AI Overviews in Google Search - Computer - Google Search Help"
[2]: https://serpapi.com/ai-overview "Google AI Overview Results API - SerpApi"
[3]: https://github.com/serpapi/public-roadmap/issues/2809 "[Google AI Overview API] Support Korean language for AI Overview · Issue #2809 · serpapi/public-roadmap · GitHub"
[4]: https://serpapi.com/google-ai-overview-api "Google AI Overview API - SerpApi"
[5]: https://developers.openai.com/api/docs/guides/tools-web-search/ "Web search | OpenAI API"
