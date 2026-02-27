## 10초 요약

지금 백엔드 계획(Phase 1-3)은 **“0점(0/20)의 원인을 빠르게 분해해서, 측정-진단-히스토리까지 가는”** 흐름이라 방향은 맞습니다 ✅
다만 **한국/한국어(hl=ko, gl=kr)에서 Google AI Overview(AIO) 자체가 잘 안 잡힐 수 있는 구조적 리스크**와, **출처 추출을 ‘모델 텍스트’가 아니라 ‘API가 주는 출처 메타데이터’로 고정해야 하는 문제**는 더 앞 단계에서 해결해야 합니다. ([SerpApi][1])

---

## 전체 평가: “좋은 설계”인데, 점수(20점) 설계가 아직 ‘제품 지표’로는 위험함

### 👍 좋은 점 (왜 잘 짰나)

1. **“0점”을 ‘측정 실패 / 분모 0 / 인용 0’으로 나눠보는 접근**이 맞아요.
   → 의사결정에서 제일 중요한 건 “진짜 0”과 “측정이 안 돼서 0”을 분리하는 겁니다.

2. **디버그 API를 먼저 강화(Phase 1)**하는 건 정석입니다.
   → UI가 미완성이라도, 백엔드에서 원인이 보이면 프론트는 ‘표시’만 하면 됩니다.

3. **비용/쿼터 가드(상한, refresh 제한, 동시성 제한)**를 초반부터 넣는 건 매우 현실적입니다.
   → Serp/API 계열은 “좋아 보이는데 갑자기 돈/쿼터 폭발”이 흔합니다.

4. **표본(키워드 샘플) 전략을 Phase 2에서 손보는 것도 합리적**
   → 처음엔 “일단 돌아가게” 만들고, 그 다음 “통계적으로 의미 있게” 바꾸는 순서가 맞아요.

5. **히스토리(Phase 3)를 별도 승인 단계로 분리한 것도 합리적**
   → DB 스키마는 한번 바꾸면 되돌리기 어렵고, 보안/운영 이슈가 따라오니까요.

---

## ⚠️ 치명 리스크 3가지 (이건 “0점이 계속 뜨는 구조”를 만들 수 있음)

아래 3개는 “계획이 나쁘다”가 아니라, **이대로면 지표가 계속 0으로 고착될 수 있는 구조**라 우선순위를 올려야 합니다.

### 리스크 1) “AI Overview 분모” 자체가 한국에서 0이 되기 쉬움

* 무슨 일인지: SerpApi 문서에 따르면 **AI Overview 블록이 ‘영어 검색(hl=en)’에서만 보인다고 명시**돼 있어요. ([SerpApi][1])
* 왜 문제인지: 지금 점수는 `AI Overview가 뜬 표본`이 분모인데, 분모가 0이면 **아무리 다른 곳에서 인용돼도 0점**이 됩니다.
* 결과 영향: “인용이 안 되는 것”과 “AIO가 안 뜨는 시장/언어인 것”이 구분 안 돼서, 팀이 엉뚱한 액션(스키마/콘텐츠만 계속 고치기)을 하게 됩니다.

✅ **권장 수정(Phase 1로 당김):**

* 점수 항목을 **2개로 쪼개세요**

  * (A) “AIO 노출률(분모)”
  * (B) “AIO 인용률(분자/분모)”
* 그리고 **AEO 점수 20점은 ‘AIO만’이 아니라 ‘프로바이더 합산’ 정책**으로 빨리 바꿔야 합니다(Phase 3가 아니라 Phase 1-2).

---

### 리스크 2) OpenAI/Perplexity 출처는 “모델 텍스트”가 아니라 “API 메타데이터”로 받아야 함

* 무슨 일인지:

  * OpenAI 웹서치는 **`annotations(url_citation)`과 `sources` 필드로 URL이 제공**됩니다. ([OpenAI Developer Documentation][2])
  * Perplexity Sonar는 **URL/출처가 `search_results` 필드로 자동 제공되며, “프롬프트로 URL 달라고 하지 말라”**고 명시합니다. ([Perplexity][3])
* 왜 문제인지: 지금 문서의 “URL 유효성 검사(2xx/3xx)”는 **모델이 URL을 ‘지어낼 수 있다’는 불신**에서 나온 듯한데, 정석은 그게 아니라
  → **애초에 URL은 메타데이터로 받는 구조**로 바꾸는 겁니다.
* 결과 영향: 텍스트 파싱 중심이면 포맷 바뀔 때마다 깨지고(특히 ChatGPT/Perplexity는 응답 형식이 자주 바뀜), “인용 0” 오탐이 계속 납니다.

✅ **권장 수정(Phase 1-2):**

* OpenAI: `annotations`를 “인용”, `sources`를 “참고(전체)”로 분리 집계 ([OpenAI Developer Documentation][2])
* Perplexity: `search_results` 기반으로 인용 집계(스트리밍이면 마지막 chunk에서만 들어오는 점 고려) ([Perplexity][3])
* 즉, “URL 검사”는 보조(선택)이고, **핵심은 ‘출처 필드 고정’**입니다.

---

### 리스크 3) SerpApi AIO는 “추가 호출(page_token)” 케이스를 놓치면 분모/분자 둘 다 과소집계

* 무슨 일인지: SerpApi는 AIO가 지연 로딩되는 경우 **초기 응답에 `page_token`이 오고, 추가 요청으로 AIO를 가져와야 한다**고 설명합니다. ([SerpApi][4])
* 왜 문제인지: 이 케이스를 처리 안 하면 “AIO 없음”으로 떨어져 분모가 줄고, 인용도 0으로 더 잘 뜹니다.
* 결과 영향: “AIO가 원래 없는 키워드”로 잘못 판단 → 점수가 계속 왜곡

✅ **권장:** 백엔드에서 **AIO 판정 로직이 `page_token` follow-up까지 커버하는지**를 Phase 1에서 테스트 케이스로 박아두세요. ([SerpApi][4])

---

## Phase별 계획 평가 + “왜 그렇게 세웠는지” 추정

### Phase 1 — 안정화/관측(1-2일): ✅ 매우 타당

**왜 이렇게 세웠을까(추정)**

* 지금 문제는 “0점이 진짜 0인지, 측정 실패인지”가 불명확함
* 그래서 먼저 **디버그 API + 실패 사유 노출 + 비용 가드**로 “원인 분해”를 하려는 것
* 특히 Serp/OpenAI/Perplexity는 쿼터/에러/포맷 변경이 잦아서, **관측 없으면 운영이 불가능**하다는 걸 이미 겪었을 가능성이 큽니다.

**내가 추가로 넣고 싶은 Phase 1 산출물(핵심)**

* `/api/ai/citation` 응답에 무조건 포함:

  * `provider_status`: ok | rate_limited | invalid_key | timeout | parse_error
  * `eligible`: true/false (분모에 넣을지 말지)
  * `exposure`: (예: AIO present 여부)
  * `cited`: biocom.kr 매칭 여부
* 그리고 UI용으로는 “0점” 대신 **3가지 중 무엇인지 바로 보여주기**

  * “측정 실패” / “노출 0” / “인용 0”

---

### Phase 2 — 측정 신뢰도 개선(2-4일): ✅ 타당, 다만 일부는 더 당겨야 함

**왜 이렇게 세웠을까(추정)**

* 지금은 샘플 5개라 변동성이 너무 커서(특히 AIO는 뜰 때/안 뜰 때가 큼)
* “제품 지표”로 쓰려면 **표본 설계**가 필수라서 Phase 2로 뒀을 것
* OpenAI/Perplexity는 응답 포맷이 바뀌거나, 추출 로직이 조금만 흔들려도 “인용 0”이 나와서, 파서를 보강하려는 목적

**내 코멘트(현실적 수정)**

* “표본 키워드 선택 개선”은 Phase 2가 맞는데,

  * **AIO가 한국에서 분모 0 가능성**이 있어서, 이건 “표본”만으로 해결 안 됩니다. (언어/시장 이슈) ([SerpApi][1])
* “ChatGPT(Search) 출처 추출 품질 개선”은 **‘URL 검증’보다 ‘annotations/sources 사용’으로 구조를 바꾸는 게 더 핵심**입니다. ([OpenAI Developer Documentation][2])
* Perplexity는 “URL은 search_results로 준다”가 문서에 박혀 있으니, 그쪽으로 고정하세요. ([Perplexity][3])

---

### Phase 3 — 지속 측정/히스토리(승인 필요, 3-7일): ✅ “피드백 루프” 관점에서 가장 가치 큼

**왜 이렇게 세웠을까(추정)**

* TJ님이 말한 “피드백 루프/디지털 트윈” 관점에서는

  * **현재 상태(점수)만 저장하는 게 아니라**
  * “어떤 키워드 표본으로, 어떤 출처가, 어떤 변화로”를 **시간 축으로 남겨야** 의사결정이 됩니다.
* 그래서 DB 적재 + 스케줄링 + 알림까지를 한 묶음으로 둔 것 같아요.

**내가 추가로 권장하는 저장 항목(디지털 트윈으로 가려면)**

* 날짜 / provider / query / **exposure(노출 여부)** / cited 여부
* matchedReferences(최소 5개)
* “그날의 콘텐츠/스키마 변경 배포 ID” (release_id 같은 값)
  → 그래야 “무슨 변경이 인용률을 올렸나”까지 연결됩니다(=decision-trace의 최소 형태).

---

## “지금 당장(오늘) - 이번 주 - 다음 배치” 액션 3단계

### 지금 당장(오늘)

1. AEO 점수의 0/20을 **(측정 실패 / 노출 0 / 인용 0)** 중 어디인지 API에서 한 번에 보이게 수정
2. OpenAI는 `annotations`/`sources`를 쓰는 구조로 고정(텍스트 파싱 최소화) ([OpenAI Developer Documentation][2])
3. Perplexity는 `search_results` 기반으로 출처 집계(스트리밍 마지막 chunk 처리 포함) ([Perplexity][3])

### 이번 주

1. SerpApi AIO에서 **page_token follow-up** 케이스 테스트/보강 ([SerpApi][4])
2. 점수 정책: “AIO만”이 아니라 **provider별 eligible/exposure/cited를 병렬로 보여주는 UI/스코어 설계** 확정
3. 표본 키워드: “정보성” 샘플링 룰(브랜드/네비게이션 제외) 적용

### 다음 배치

1. Supabase에 일 단위 적재 + 주간 변화량 리포트
2. 슬랙 알림(급락/급등)
3. “왜 인용이 안 되나”를 reference 도메인 Top N으로 보여주는 디버그 뷰(벤치마크 자동 생성)

---

## Q1-Q3 (결정이 필요합니다)

**Q1. “한국/한국어에서 Google AI Overview를 반드시 분모로 삼을 건가요?”**
SerpApi 문서 기준으로는 영어 중심이라, ko/kr에서 계속 분모 0이면 점수 체계 자체를 바꿔야 합니다. ([SerpApi][1])

**Q2. “인용(cited)”의 정의를 어디까지로 할까요?**
예: `biocom.kr`만 인정 vs `*.biocom.kr` 인정 vs CDN/리다이렉트/utm 포함 URL도 인정 등.

**Q3. 비용/호출 예산은 하루에 어느 정도까지 허용인가요?**
예: (키워드 표본 20) × (프로바이더 3) × (일 1회) 정도는 괜찮은지, 아니면 주 2-3회만 돌릴지에 따라 캐시/스케줄 설계가 달라집니다.

원하시면, 지금 있는 `/api/ai/citation` 응답 샘플(JSON)을 한 번만 붙여 주세요. 그러면 “지표가 왜 0인지”를 **정확히** (측정 실패인지/노출 0인지/인용 0인지) 바로 판정해서, Phase 1 수정안을 더 구체적으로 써드릴게요.

[1]: https://serpapi.com/ai-overview "Google AI Overview Results API - SerpApi"
[2]: https://developers.openai.com/api/docs/guides/tools-web-search/ "Web search | OpenAI API"
[3]: https://docs.perplexity.ai/docs/sonar/features "Core Features - Perplexity"
[4]: https://serpapi.com/blog/understanding-ai-overview-data-from-serpapi/ "Building a UI for Google AI Overviews using SerpApi: A Practical Guide"
