## 10초 요약

**이 회의의 핵심은 “바이오컴 SEO를 다시 처음부터 정리하자”입니다.** 특히 URL 구조, 캐노니컬, 사이트맵, robots.txt, 상품 상세페이지의 통이미지 문제, 구조화 데이터, 로딩 속도를 한 번에 진단해야 합니다.

제가 `biocom.kr`을 외부에서 확인해보니, 회의에서 나온 우려가 실제로 보입니다. 상품은 `/HealthFood/?idx=97`, 검사권은 `/organicacid_store/?idx=259`, 칼럼은 `/healthinfo/?bmode=view&idx=...` 형태로 잡히고, 검색 결과에는 `/index/?bmode=view&idx=...` 같은 잡음 URL도 보입니다. 이건 **SEO 성과 분석과 중복 URL 관리에 불리한 구조**입니다. ([biocom.kr](https://biocom.kr/organicacid "종합 대사기능 검사 서비스 (유기산 대사 검사)"))

---

## 핵심 요약

### 1. 지금 가장 큰 문제는 “검색엔진이 페이지를 사람처럼 이해하기 어렵다”는 점입니다

상품 상세페이지 상단에는 제품명, 가격, 후기 수, 핵심 설명이 텍스트로 일부 잡힙니다. 예를 들어 종합 대사기능 분석 페이지는 상품명, 78개 구매평, 가격, 핵심 설명이 텍스트로 노출됩니다. ([biocom.kr](https://biocom.kr/organicacid "종합 대사기능 검사 서비스 (유기산 대사 검사)"))  
바이오밸런스도 상품명, 465개 구매평, 가격, 주요 성분 설명이 텍스트로 보입니다. ([biocom.kr](https://biocom.kr/HealthFood/?idx=97 "바이오밸런스 피로회복 영양제 마그네슘 아연 셀레늄 비타민D 바이오미네랄 활성산소"))

그런데 상세 설명 본문은 충분한 HTML 텍스트 구조로 잡히지 않는 것으로 보입니다. 종합 대사기능 분석 페이지는 상세정보 영역 이후 이미지가 나오고, 이후에는 주로 안내문·반품·교환 정보가 잡힙니다. ([biocom.kr](https://biocom.kr/organicacid "종합 대사기능 검사 서비스 (유기산 대사 검사)"))  
즉, 검색엔진 입장에서는 “이 제품이 왜 좋은지”보다 “가격·후기·반품 안내”를 더 쉽게 읽는 상태일 수 있습니다.

**판단:**  
지금 상태는 완전 실패는 아닙니다. 하지만 80점짜리 SEO 구조는 아닙니다. “검색엔진에 색인된다”와 “검색엔진·AI가 핵심 가치를 정확히 이해한다”는 다릅니다.

---

### 2. URL 구조가 지저분하고, 중복 페이지 위험이 큽니다

현재 외부에서 확인되는 URL 예시는 아래와 같습니다.

|유형|확인된 URL 형태|문제|
|---|---|---|
|상품|`/HealthFood/?idx=97`|상품명이 URL에 없음|
|검사권|`/organicacid_store/?idx=259`|idx 기반이라 의미가 약함|
|칼럼|`/healthinfo/?bmode=view&idx=5764202`|칼럼 제목이 URL에 없음|
|잡음 URL|`/index/?bmode=view&idx=...`|메인과 비슷한 내용이 다른 URL로 잡힘|

Google은 같은 내용이 여러 URL로 보이면 대표 URL을 하나 고르는데, 이 과정에서 우리가 원하는 URL이 선택되지 않을 수 있습니다. 또한 중복 URL은 검색 성과 추적도 어렵게 만듭니다. ([Google for Developers](https://developers.google.com/search/docs/crawling-indexing/canonicalization?utm_source=chatgpt.com "What is URL Canonicalization | Google Search Central  |  Documentation  |  Google for Developers"))

**판단:**  
회의에서 나온 “캐노니컬 필요” 의견은 맞습니다. 다만 캐노니컬만 넣는다고 끝나는 게 아니라, 내부 링크·사이트맵·리다이렉트·검색 노출 정책까지 같이 맞춰야 합니다.

---

### 3. robots.txt는 존재하지만, sitemap.xml은 추가 확인이 필요합니다

`robots.txt`는 외부에서 확인됩니다. 내용상 전체 크롤링은 허용하고, 회원가입·로그인·장바구니·일부 모드 URL은 차단하며, `https://biocom.kr/sitemap.xml`을 사이트맵으로 지정하고 있습니다. ([biocom.kr](https://biocom.kr/robots.txt "biocom.kr"))

다만 제가 직접 `sitemap.xml`을 열었을 때는 웹 도구 기준으로 정상 내용을 확인하지 못했습니다. 이건 실제 서버 문제일 수도 있고, 제 접근 도구의 한계일 수도 있어서 Codex가 `curl -I`, `curl -L`, Search Console 제출 상태로 확정해야 합니다.

Google과 Naver 모두 사이트맵을 통해 검색엔진이 중요한 URL을 더 잘 찾도록 도울 수 있다고 설명합니다. 단, 사이트맵은 색인을 보장하는 장치가 아니라 “중요 URL 목록을 알려주는 힌트”입니다. ([Google for Developers](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap?utm_source=chatgpt.com "Build and Submit a Sitemap | Google Search Central  |  Documentation  |  Google for Developers"))

---

### 4. 구조화 데이터는 거의 없거나 확인이 안 됩니다

회의에서 말한 Product 구조화 데이터 방향은 맞습니다. Google은 Product 구조화 데이터를 넣으면 가격, 재고, 리뷰, 평점 같은 정보가 검색 결과에 더 풍성하게 나올 수 있다고 설명합니다. ([Google for Developers](https://developers.google.com/search/docs/appearance/structured-data/product-snippet?utm_source=chatgpt.com "How To Add Product Snippet Structured Data | Google Search Central  |  Documentation  |  Google for Developers"))

제가 확인한 범위에서는 종합 대사기능 분석 페이지에서 `application/ld+json`, `Product`, `schema` 문자열이 잡히지 않았습니다. ([biocom.kr](https://biocom.kr/organicacid "종합 대사기능 검사 서비스 (유기산 대사 검사)"))  
다만 이건 외부 텍스트 fetch 기준이라, 실제 렌더링된 DOM까지 Codex가 한 번 더 확인해야 합니다.

**판단:**  
우선순위 높습니다. 특히 바이오컴은 상품·검사권·칼럼·후기·회사정보가 명확하므로 아래 구조화 데이터를 넣을 여지가 큽니다.

|페이지 유형|넣을 구조화 데이터|
|---|---|
|상품/검사권|Product, Offer, AggregateRating, Review|
|칼럼|Article 또는 BlogPosting|
|회사소개|Organization, LocalBusiness|
|전체 사이트|WebSite, BreadcrumbList|
|FAQ 섹션|FAQPage, 단 실제 화면에 보이는 질문답변만|

Google은 JSON-LD를 구조화 데이터 방식으로 권장하고, 자바스크립트로 삽입된 JSON-LD도 처리할 수 있다고 설명합니다. 다만 가격·재고처럼 자주 바뀌는 정보는 동적 삽입이 덜 안정적일 수 있어 테스트가 필요합니다. ([Google for Developers](https://developers.google.com/search/docs/guides/intro-structured-data?utm_source=chatgpt.com "Intro to How Structured Data Markup Works | Google Search Central  |  Documentation  |  Google for Developers"))

---

### 5. “숨김 텍스트” 방식은 하면 안 됩니다

회의 중에 “PC에 텍스트를 숨겨놓는 방식” 이야기가 있었는데, 이건 위험합니다. Google은 검색엔진 조작 목적의 숨김 텍스트를 스팸성 행위로 봅니다. 예시는 흰 배경에 흰 글씨, 이미지 뒤에 텍스트 숨기기, 화면 밖으로 텍스트 보내기, 글자 크기나 투명도 0 처리 등입니다. ([Google for Developers](https://developers.google.com/search/docs/advanced/guidelines/auto-gen-content?hl=en&rd=1&visit_id=637653906577977418-3400681958&utm_source=chatgpt.com "Spam Policies for Google Web Search | Google Search Central  |  Documentation  |  Google for Developers"))

**권장 방향:**  
숨기지 말고, 사람에게도 보이는 형태로 넣어야 합니다.  
모바일은 전환율 때문에 이미지형 상세페이지를 유지하더라도, PC 또는 공통 영역에 “잘 디자인된 텍스트 블록”을 넣는 방식이 안전합니다.

---

## 제 판단: 우선순위

### P0. 현황 진단부터 해야 합니다

지금은 “뭘 고칠지”보다 “어디가 얼마나 망가졌는지”가 먼저입니다.

Codex가 먼저 뽑아야 할 것은 4개입니다.

1. 현재 색인 가능 URL 목록
    
2. 중복 URL·잡음 URL 목록
    
3. 상품/검사권/칼럼별 메타태그·캐노니컬·구조화 데이터 현황
    
4. 상세페이지 본문이 실제 HTML 텍스트인지, 이미지인지, alt만 있는지
    

---

### P1. 바로 고칠 수 있는 것

- 각 핵심 페이지 title, description, OG 태그 정리
    
- robots.txt와 sitemap.xml 정상 여부 확인
    
- Search Console / Naver Search Advisor에 제출된 사이트맵 확인
    
- 내부 링크가 대표 URL만 가리키도록 정리
    
- `/index/?bmode=view&idx=...` 같은 잡음 URL이 왜 노출되는지 확인
    
- 상품/검사권 5개에 Product JSON-LD 테스트 삽입
    
- 칼럼 10개에 Article JSON-LD 테스트 삽입
    

---

### P2. 전환율과 SEO를 같이 올리는 작업

상품 상세페이지를 “통이미지 vs 텍스트”로 싸울 필요는 없습니다.

제가 보기엔 정답은 이겁니다.

**모바일은 현재 전환율 좋은 디자인을 최대한 유지하되, PC와 공통 본문에는 검색엔진과 AI가 읽을 수 있는 텍스트형 상세 구조를 넣습니다.**

예시 구조:

```text
H1: 종합 대사기능 분석
H2: 이런 분께 필요합니다
H2: 무엇을 분석하나요?
H2: 검사로 확인할 수 있는 6가지 대사 상태
H2: 결과지는 어떻게 제공되나요?
H2: 상담은 어떻게 진행되나요?
H2: 자주 묻는 질문
```

이렇게 하면 검색엔진이 “이 페이지는 유기산 검사, 대사기능, 체중조절, 피로, 장건강, 맞춤 상담과 관련된 상품 페이지”라고 훨씬 잘 이해합니다.

---

# Codex에게 조사시킬 프롬프트

아래 그대로 붙여넣으면 됩니다.

```text
너는 바이오컴 SEO/AEO 기술 진단 담당이다. 
목표는 biocom.kr의 현재 SEO 상태를 “수정 없이 읽기 전용”으로 진단하고, 실행 가능한 개선안과 근거 파일을 만드는 것이다.

중요:
- 라이브 사이트를 수정하지 마라.
- 아임웹 관리자에 접근하거나 설정을 바꾸지 마라.
- 공개 접근 가능한 URL만 크롤링하라.
- 과도한 요청을 보내지 마라. 요청 간 0.5초 이상 간격을 둬라.
- 추정과 확인된 사실을 반드시 구분하라.
- 최종 보고서는 비개발자도 이해할 수 있는 쉬운 한국어로 작성하라.

배경:
최근 SEO 회의에서 아래 이슈가 나왔다.
1. 아임웹 기반 페이지들이 query parameter URL을 많이 사용한다.
   예: /HealthFood/?idx=97, /organicacid_store/?idx=259, /healthinfo/?bmode=view&idx=...
2. 제품/칼럼/후기/이벤트 URL이 섞이면서 Google Search Console, GA4에서 콘텐츠 단위 분석이 어려울 수 있다.
3. 상품 상세페이지가 통이미지 위주라 검색엔진과 AI가 핵심 내용을 충분히 이해하지 못할 수 있다.
4. 상품 페이지에 Product 구조화 데이터, 리뷰, 가격, 재고, BreadcrumbList 등이 필요할 수 있다.
5. robots.txt, sitemap.xml, canonical, noindex, meta title/description, OG 태그 상태를 재점검해야 한다.
6. 숨김 텍스트 방식은 쓰지 말고, 사용자에게도 보이는 텍스트 구조로 개선하는 방향이 안전하다.
7. SEO 점검과 함께 로딩 속도, 이미지 용량, 불필요한 스크립트/폰트도 같이 봐야 한다.

조사 대상:
- https://biocom.kr/
- https://biocom.kr/service
- https://biocom.kr/organicacid_store/?idx=259
- https://biocom.kr/HealthFood/?idx=97
- https://biocom.kr/healthinfo
- https://biocom.kr/healthinfo/?bmode=view&idx=5764202
- Google 검색에서 site:biocom.kr 로 확인되는 /index/?bmode=view&idx=... 유형 URL들
- robots.txt와 sitemap.xml

해야 할 일:

1. URL 인벤토리 생성
- 공개 사이트에서 내부 링크를 수집한다.
- 최소 300개 URL까지 수집한다.
- URL을 아래 유형으로 분류한다.
  - home
  - category
  - product
  - lab/test service
  - article/column
  - review/board
  - cart/login/member
  - noisy parameter URL
  - unknown
- 결과를 reports/seo/url_inventory.csv 로 저장한다.
- 컬럼:
  url, normalized_url, path, query, type, source_page, anchor_text, status_code, final_url, is_parameter_url, suspected_duplicate_group

2. robots.txt / sitemap.xml 점검
- curl -I -L 로 status code, content-type, final URL을 확인한다.
- robots.txt 내용을 저장한다.
- sitemap.xml이 정상 응답하는지 확인한다.
- sitemap 안의 URL 수, URL 유형, parameter URL 비중을 계산한다.
- sitemap에 들어가면 안 되는 URL이 있는지 확인한다.
  예: login, cart, join, q 파라미터, board review 잡음 URL
- 결과를 reports/seo/robots_sitemap_audit.md 로 작성한다.

3. 페이지별 SEO 태그 점검
아래 페이지들을 대상으로 raw HTML과 rendered DOM 둘 다 확인한다.
- homepage
- service page
- organicacid product page
- HealthFood product page
- healthinfo list page
- healthinfo article page

각 페이지에서 아래를 추출한다.
- title
- meta description
- canonical
- robots meta
- og:title
- og:description
- og:image
- h1 개수와 내용
- h2/h3 구조
- 이미지 개수
- alt 없는 이미지 개수
- alt가 너무 긴 이미지 개수
- JSON-LD 존재 여부
- Product / Article / Organization / BreadcrumbList / FAQPage 구조화 데이터 존재 여부
- price/review/availability가 JSON-LD에 있는지 여부

결과를 reports/seo/page_seo_audit.csv 와 reports/seo/page_seo_audit.md 로 저장한다.

4. 중복 URL / canonical 리스크 진단
- 같은 본문이 여러 URL로 노출되는지 확인한다.
- 특히 아래 패턴을 집중 확인한다.
  - /index/?bmode=view&idx=...
  - /?q=...
  - ?bmode=view
  - ?idx=
  - interlock=shop_review
  - t=board
- 각 URL의 canonical이 자기 자신인지, 대표 URL인지, 없는지 확인한다.
- 내부 링크가 canonical URL이 아닌 parameter URL로 연결되는지 확인한다.
- 결과를 reports/seo/canonical_duplicate_risk.md 로 작성한다.
- 중복 의심 그룹을 reports/seo/duplicate_url_groups.csv 로 저장한다.

5. 상품 상세페이지 “텍스트 vs 이미지” 진단
- organicacid_store/?idx=259
- HealthFood/?idx=97
위 2개를 우선 분석한다.
- 상세페이지 본문 중 실제 HTML 텍스트로 읽히는 영역과 이미지/alt에만 있는 영역을 구분한다.
- 검색엔진이 읽을 수 있는 핵심 문장 수를 세라.
- H1/H2/H3 구조가 제대로 되어 있는지 확인한다.
- 의미 없는 ####, 빈 heading, 이미지 맵, 과도하게 긴 alt, HTML 코드가 alt에 들어간 경우를 찾아라.
- 결과를 reports/seo/product_detail_content_audit.md 로 작성한다.

6. 구조화 데이터 삽입 가능성 검토
- 아임웹에서 직접 수정 가능한 방식과 GTM/사용자 코드로 삽입 가능한 방식을 구분한다.
- Google 공식 문서 기준으로 Product, Offer, AggregateRating, Review, BreadcrumbList, Article, Organization, WebSite JSON-LD 샘플을 만든다.
- 단, 실제 페이지에 보이는 정보만 구조화 데이터에 넣어라.
- 가격/후기 수/상품명/이미지 URL은 페이지에서 추출한 실제 값으로 샘플을 만든다.
- 결과를 reports/seo/jsonld_recommendations.md 로 작성한다.
- 샘플 파일은 reports/seo/jsonld_samples/ 아래에 저장한다.
  - product_organicacid.json
  - product_biobalance.json
  - article_health_goal.json
  - organization_biocom.json
  - breadcrumb_examples.json

7. 로딩 속도와 리소스 점검
- Lighthouse 또는 Playwright/Chrome DevTools Protocol을 사용할 수 있으면 모바일 기준으로 측정한다.
- 불가능하면 최소한 HTML, JS, CSS, 이미지 리소스 수와 용량을 수집한다.
- 큰 이미지, webp 사용 여부, lazy loading 여부, 폰트 파일 수, 외부 스크립트 수를 확인한다.
- 결과를 reports/seo/performance_resource_audit.md 로 작성한다.

8. 최종 보고서 작성
reports/seo/seo_audit_summary.md 를 작성한다.
형식:
- 10초 요약
- 현재 점수: 100점 만점 기준
- 가장 큰 문제 5개
- 오늘 바로 할 일
- 이번 주 할 일
- 다음 배치에서 할 일
- 개발팀이 해야 할 일
- 콘텐츠/디자인팀이 해야 할 일
- 대표/마케팅팀이 결정해야 할 일
- 리스크
- 추천 우선순위

점수는 아래 기준으로 나눠라.
- URL/Canonical: 20점
- Indexing/Sitemap/Robots: 15점
- On-page SEO: 20점
- Structured Data: 15점
- Content Readability for Search/AI: 15점
- Performance: 15점

9. 추가 산출물
- reports/seo/action_plan.csv
컬럼:
priority, task, owner, expected_impact, difficulty, risk, evidence_file, recommended_deadline

- reports/seo/dev_team_request.md
개발팀에게 전달할 2줄 요약과 상세 요청사항 작성

- reports/seo/content_team_request.md
콘텐츠/디자인팀에게 전달할 요청사항 작성

최종 답변에는 아래만 요약해라.
1. 가장 심각한 문제 3개
2. 바로 고칠 수 있는 것 5개
3. 산출물 파일 목록
4. 아직 확인 못 한 것
```

---

## 제 최종 의견

이번 작업은 **“SEO 미세 개선”이 아니라 “검색엔진과 AI가 바이오컴을 이해하는 구조를 다시 만드는 작업”**으로 봐야 합니다. 🔧

가장 먼저 할 일은 상품상세를 갈아엎는 게 아닙니다.  
먼저 **현재 URL·색인·캐노니컬·사이트맵·구조화 데이터 상태를 숫자로 뽑고**, 그 다음 검사권 2개와 영양제 2개만 시범 개선하는 게 맞습니다.

Q1. Codex에게는 먼저 “읽기 전용 SEO 진단”만 시킬까요, 아니면 JSON-LD 샘플 생성까지 한 번에 시킬까요?  
Q2. 우선 개선 대상은 `종합 대사기능 분석`, `음식물 과민증 분석`, `바이오밸런스`, `뉴로마스터` 4개로 잡아도 될까요?  
Q3. 이번 SEO의 1차 목표를 “구글 검색 유입 증가”로 볼까요, 아니면 “네이버/AI 검색 노출까지 포함한 AEO 구조 개선”으로 볼까요?