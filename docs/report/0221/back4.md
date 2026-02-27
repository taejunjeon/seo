# report0221-back4 — “AI 유입” 실측 가능성/메뉴 제안 + 대메뉴 목적 정의

작성일: 2026-02-21  
작성: 헤파이스토스 (코딩 에이전트)  
근거 문서: `report0221-front1.1.md`, `report0221-back3.md`, `aio포함여부및가중치산식.md` + 현재 코드 구조(`backend/`, `frontend/`)

---

## 0) 결론(요약)

1) **“AI를 통해 유입된 사람이 있는지/몇명인지”는 구현 가능**합니다.  
   - GA4 Data API 기준으로 `sessionSource`에 `chatgpt/openai/perplexity/claude/gemini/bard/copilot` 토큰이 포함된 세션을 집계하는 방식이며, **이미 백엔드에 구현되어 AEO 점수 breakdown에 반영 중**입니다.

2) **“키워드(=AI에 사용자가 입력한 프롬프트/검색어)”는 일반적으로 정확한 실측이 불가**합니다.  
   - 대부분 AI 서비스는 사용자의 프롬프트를 외부 사이트로 전달하지 않고, GA4도 “AI 프롬프트 키워드”라는 공식 차원을 제공하지 않습니다.
   - 대신, “AI 유입을 만든 주제/키워드”를 **근사(대체 지표)로 구현**하는 방법은 있습니다(아래 3-2 참고).

3) UI 부착 위치는 **`사용자 행동`(상세) + `오버뷰`(요약 카드)** 조합을 추천합니다.  
   - “유입(traffic)”은 사용자 행동 탭의 맥락에 가장 자연스럽고, 오버뷰에서 KPI로 빠르게 확인할 가치가 큽니다.

---

## 1) 프로젝트 구조(코드 기준)

### 1-1. 루트

- `backend/`: Express + TypeScript API 서버(기본 포트 `7020`)
- `frontend/`: Next.js(App Router) 대시보드(기본 포트 `7010`)
- 루트 `package.json`: `dev:frontend`, `dev:backend`, `build:*`, `lint:frontend`, `typecheck:backend` 등

### 1-2. 백엔드 주요 모듈

- `backend/src/server.ts`: 모든 API 라우팅(예: `/api/aeo/score`, `/api/ga4/engagement`)
- `backend/src/ga4.ts`: GA4 Data API(engagement/funnel/**AI traffic**)
- `backend/src/gsc.ts`: Google Search Console 쿼리(키워드/페이지/트렌드 기반)
- `backend/src/scoring.ts`: AEO/GEO 점수 산식(여기에 **AI 인용도/AI 유입 트래픽** breakdown이 포함)
- `backend/src/aiCitation*.ts`, `backend/src/openaiSearch.ts`, `backend/src/perplexity.ts`, `backend/src/serpapi.ts`: AI 인용도 측정 파이프라인

### 1-3. 프론트엔드 구조

- `frontend/src/app/page.tsx`: 대메뉴(탭) 8개 전체 UI/상태/데이터 로딩이 한 파일에 있음
- `frontend/src/components/diagnosis/*`: 페이지 진단 탭의 AI 인용도 섹션 컴포넌트(`AiCitationSection` 등)

---

## 2) (문서 기반) 현재까지 반영된 AI 관련 기능 요약

### 2-1. `report0221-front1.1.md`에서 확인한 것

- 페이지 진단(Tab 6)에 **빠른/정밀 진단 모드 분리**(정밀: PageSpeed + AI 인용도 포함)
- AI 인용도 UI는 `/api/ai/citation`의 **구조화된 verdict 필드**를 사용(텍스트 파싱 제거)
- **가중치/산식 결정(8:2, eligible>=3 재정규화, Google AIO 점수 산식 제외)**를 프론트 UI 문구/표시에 반영

### 2-2. `report0221-back3.md`에서 확인한 것

- KR 운영 점수에서 Google AIO는 **산식 제외(참고용)**로 정렬
- `/api/aeo/score`가 비용/신뢰도 관점에서 **SerpAPI 기본 미호출(필요 시 fallback)**로 변경
- `/api/ai/citation`에 `matchMode=strict|broad|both` 추가(Strict KPI vs Broad 디버그)

### 2-3. `aio포함여부및가중치산식.md`에서 확인한 것

- “AIO는 산식 제외 + 벤치마크로 유지” 방향성
- ChatGPT:Perplexity 가중치 8:2 권장 + “활성 프로바이더 재정규화” 아이디어
- Broad 매칭은 SSRF 등 **보안 가드 필요** 언급

---

## 3) 요구사항: “AI를 통해 유입되는 사람” 실측/표시 가능성

### 3-1. 유입 있음/없음 + “몇명” (가능, 현재도 일부 구현됨)

- **데이터 소스**: GA4 Data API
- **현 구현 상태**
  - 백엔드: `backend/src/ga4.ts`의 `queryGA4AiTraffic()`이 `sessionSource` CONTAINS 필터로 AI 도메인 세션을 집계
  - 호출 위치: `backend/src/server.ts`의 `GET /api/aeo/score`에서 최근 30일 기준으로 조회
  - 노출 형태: `backend/src/scoring.ts`의 AEO breakdown 항목 `aiTraffic` detail에  
    “AI 추천 유입 세션 N (전체 대비 X%) · 상위 소스 · 기간 · 기준” 형태로 포함

- **“사람(사용자 수)”로 보여주려면**
  - 현재 함수는 `sessions` 기반이므로, “몇명”을 엄밀히 하려면 GA4 metric을 `totalUsers`(또는 `activeUsers`)까지 같이 집계하는 형태로 확장하는 게 적합합니다.
  - 다만 운영 UI에서는 “세션”도 충분히 유용한 1차 지표입니다(반복 유입 포함).

### 3-2. “키워드” (정확한 프롬프트 키워드는 보통 불가, 대체 지표로 구현 추천)

요구사항의 “키워드”가 무엇을 의미하는지에 따라 답이 갈립니다.

#### A) “AI에 사용자가 입력한 프롬프트/검색어”라면 (정확 실측: 대체로 불가)

- GA4 기본 수집만으로는 prompt/search query를 알 수 없습니다.
- referrer URL에 우연히 query 파라미터가 포함되는 케이스가 있어도, 제품/브라우저/정책에 따라 누락이 빈번해 KPI로 쓰기 어렵습니다.

#### B) 대신 “AI 유입을 만든 주제/키워드”를 근사하는 방법(구현 가능)

1) **(추천) AI 유입 랜딩 페이지 TOP + 해당 페이지의 GSC 상위 쿼리 매핑**  
   - GA4: AI source 필터 후 landing page(path)별 sessions/users 집계  
   - GSC: `page` 기준으로 필터한 뒤 `query` 상위 N개 조회  
   - 결과: “AI에서 많이 클릭된 페이지가 어떤 검색 키워드를 먹는 페이지인지”를 보여줘서 콘텐츠 액션으로 연결됨

2) **페이지 진단의 ‘AI 인용도 표본 키워드’를 “AI 인용 키워드”로 노출/확장**  
   - `/api/ai/citation`이 이미 표본 키워드와 cited 여부를 제공  
   - ‘유입 키워드’는 아니지만, AEO 개선에 가장 직접적인 키워드 리스트로 활용 가능

3) (선택) referrer URL/utm 기반으로 “키워드 추출”을 시도  
   - 구현 자체는 가능하지만, 트래킹 정책/개인정보 이슈와 측정 누락이 커서 “KPI”로 쓰기엔 리스크가 큼  
   - 위 1) 방식이 현실적으로 더 안전하고 운영 친화적입니다

---

## 4) 메뉴 부착 위치 추천

### 추천: `사용자 행동` 탭에 “AI 유입” 섹션 추가 + `오버뷰` 탭에 요약 카드

- `사용자 행동`(Tab 5): “유입/세션/전환”의 맥락이 정확히 맞고, 기간 선택 UI(7d/30d/90d/커스텀)가 이미 존재합니다.
- `오버뷰`(Tab 0): 매일 보는 KPI로 “AI 유입 세션/유저, 상위 소스”를 한 줄 요약으로 노출하면 의사결정이 빨라집니다.
- `페이지 진단`(Tab 6)과 연결: “AI 유입 상위 랜딩 페이지 클릭 → 페이지 진단(정밀 진단/AI 인용도)”로 흐름을 만들기 좋습니다.

---

## 5) 현재 대메뉴(탭) 존재 목적 정의(각 2~3줄)

- 오버뷰: AEO/GEO 등 핵심 KPI와 트렌드를 한 화면에서 보고 우선순위를 정합니다. breakdown으로 원인(키워드/구조/성능/AI 인용/AI 유입)을 빠르게 분해해 “이번 주 액션”을 결정합니다.
- 칼럼 분석: 콘텐츠(칼럼) 페이지 단위로 성과를 비교해 리라이트/확장 우선순위를 정합니다. 어떤 글이 노출·클릭·점수 관점에서 투자 대비 효과가 큰지 선별하는 탭입니다.
- 키워드 분석: GSC 쿼리로 “먹는 키워드/기회 키워드/질문형(Q&A) 키워드”를 뽑아 콘텐츠 기획으로 연결합니다. AEO 관점에서 어떤 질문을 답해야 하는지 결정하는 탭입니다.
- PageSpeed 보고서: PageSpeed 결과를 팀이 읽기 쉬운 ‘리포트’ 형태로 저장/공유합니다. 기술 개선 사항을 커뮤니케이션 단위(보고서)로 묶는 탭입니다.
- Core Web Vitals: URL별 LCP/INP/CLS 등 CWV를 직접 측정하고 기록을 누적합니다. 성능을 점수/추세로 관리하는 기술 탭입니다.
- 사용자 행동: GA4 기반으로 페이지별 체류·이탈·스크롤·전환과 퍼널을 분석해 “유입이 실제 행동/전환으로 이어지는지”를 봅니다. SEO/AEO의 비즈니스 임팩트를 검증하는 탭입니다.
- 페이지 진단: 특정 URL을 입력해 Schema/콘텐츠 구조/AEO·GEO/AI 인용도를 묶어서 진단합니다. “어떤 페이지를 어떻게 고칠지”를 실행 가능한 체크리스트로 만드는 탭입니다.
- 솔루션 소개: 대시보드의 기능/로드맵/사용법을 설명합니다. 내부 공유/온보딩용 문서성 탭입니다.

---

## 6) (구현 시) 최소 작업 범위 제안

구현까지는 이번 요청 범위가 아니지만, 작업량을 가늠할 수 있도록 “최소 범위”만 적어둡니다.

- 백엔드: `GET /api/ga4/ai-traffic` 같은 엔드포인트로 `sessions/users/sources/(optional)landingPages` 반환(또는 `/api/aeo/score`의 aiTraffic을 분리)
- 프론트: Tab 5에 “AI 유입” KPI 카드 + 소스별 테이블(기간 선택 UI 재사용)
- 키워드 근사(추천안): “AI 유입 랜딩 페이지 TOP → 해당 페이지의 GSC 상위 쿼리” 조합으로 표/리스트 제공

