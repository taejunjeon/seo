# newfunc1.8 — GA4(AI 유입) 반영 + SerpAPI/Perplexity 활성화 가이드

TJ님 요청사항: **AEO Score 하단의 "AI 유입 트래픽 — GA4 API 활성화 필요" 문구가 실제 GA4 연동 상태를 반영하도록 확인/개선**하고, **유료 API(SerpAPI/Perplexity) 활성화 방법 + 역할**을 정리합니다.

---

## 1) 결론 (현 상태 확인)

- 이 프로젝트의 백엔드는 **GA4 연동이 이미 설정되어 있고 동작**합니다.
  - 확인 1) `GET /health` 응답에서 `apis.ga4: true`
  - 확인 2) `GET /api/ga4/engagement`가 실제 `rows`를 반환
- 다만 AEO 점수 산출(`backend/src/scoring.ts`)에서는 **AI 유입 트래픽 항목이 "unavailable"로 하드코딩**돼 있어서,
  UI에서 "GA4 API 활성화 필요"로 보였습니다.

이번 작업으로 **AEO Score의 "AI 유입 트래픽"을 GA4 실데이터 기반으로 측정/점수화**하도록 변경했습니다.

---

## 2) 구현 반영 내용 (이번 변경)

### 2.1 어떤 데이터로 "AI 유입 트래픽"을 계산하나?

GA4 Data API의 `sessions`를 사용하고, `sessionSource`(유입 소스) 기준으로 **AI 서비스 도메인/키워드가 포함된 세션**을 AI 유입으로 간주합니다.

- 필터 토큰(contains):
  - `chatgpt`, `openai`, `perplexity`, `claude`, `anthropic`, `gemini`, `bard`, `copilot`
- 결과:
  - `aiSessions`: AI 소스 유입 세션 합계
  - `totalSessions`: 전체 세션 합계
  - `sources`: AI 소스별 세션(Top N) 목록
  - `period`: 최근 30일(어제까지) 기준

중요: **GA4에 "AI 유입"이라는 공식 차원은 없습니다.** 따라서 이 값은 referrer/source 기반 휴리스틱(추정)입니다.

### 2.2 AEO Score Breakdown에 어떻게 표시되나?

`AEO Score > AI 유입 트래픽` 항목이 다음처럼 표시됩니다.

- 상태: `measured`
- 디테일 예시:
  - `AI 추천 유입 세션 315 (전체 대비 0.11%) · 상위 소스: chatgpt.com 265, gemini.google.com 38, perplexity 9 · 기간: 2026-01-14~2026-02-12 · 기준: sessionSource 필터(...)`

### 2.3 변경된 파일

- `backend/src/ga4.ts`
  - `queryGA4AiTraffic()` 추가
- `backend/src/scoring.ts`
  - `calculateAeoScore()` 입력에 `aiTraffic` 추가
  - Breakdown의 `aiTraffic` 항목을 GA4 결과 기반으로 `measured` 처리
- `backend/src/server.ts`
  - `/api/aeo/score`에서 `queryGA4AiTraffic()` 호출 후 점수 계산에 전달

---

## 3) GA4가 "활성화" 되었는지 로컬에서 확인하는 방법

### 3.1 백엔드 헬스 체크

```bash
curl -sS http://localhost:7020/health
```

여기서 `apis.ga4`가 `true`면 **최소한 환경 변수/설정은 잡힌 상태**입니다.

### 3.2 GA4 Engagement API가 실제로 동작하는지 확인

```bash
curl -sS "http://localhost:7020/api/ga4/engagement?startDate=30daysAgo&endDate=yesterday&limit=5"
```

`rows`가 비어 있지 않으면 GA4 Data API 호출이 실제로 성공한 것입니다.

### 3.3 AEO Score의 AI 유입 트래픽 반영 확인

```bash
curl -sS "http://localhost:7020/api/aeo/score?url=https%3A%2F%2Fbiocom.kr%2F" | jq '.breakdown[] | select(.name=="aiTraffic")'
```

`status: "measured"`로 나오면 UI에서도 더 이상 "GA4 API 활성화 필요"가 뜨지 않습니다.

---

## 4) (만약 GA4가 비활성/오류라면) 활성화 방법

프로젝트가 "GA4 활성화 필요" 상태가 되는 케이스는 보통 아래 중 하나입니다.

1) `GA4_PROPERTY_ID`가 없거나 잘못됨
2) 서비스 계정 키(JSON)가 없거나 파싱 실패
3) GA4 속성(프로퍼티)에 서비스 계정 권한이 없음
4) GCP에서 Google Analytics Data API 비활성

### 4.1 GA4 Data API 활성화 (GCP)

1. Google Cloud Console에서 프로젝트 선택
2. `Google Analytics Data API` 활성화
3. 결제 계정이 필요할 수 있으나(사용량/정책에 따라), 일반적인 리포트 호출은 무료 구간에서도 동작하는 편입니다.

### 4.2 서비스 계정 생성 + 키 발급

1. GCP IAM에서 Service Account 생성
2. 키 생성(JSON)
3. 이 JSON 내용이 백엔드가 GA4 Data API를 호출할 때 사용하는 자격 증명입니다.

### 4.3 GA4 속성에 서비스 계정 권한 부여

GA4 Admin(관리)에서:

1. `Property Access Management(속성 액세스 관리)`
2. 서비스 계정 이메일 추가
3. 최소 권한: `Viewer(뷰어)` 이상

### 4.4 백엔드 환경 변수 설정

`backend/.env`에 아래가 필요합니다.

```bash
GA4_PROPERTY_ID=123456789
GA4_SERVICE_ACCOUNT_KEY='{"type":"service_account", ... }'
```

권장:
- JSON은 **그대로 JSON.parse 가능해야** 합니다(따옴표/이스케이프 포함)
- `private_key` 내부 줄바꿈은 `\\n` 형태로 유지

대안(선호할 수 있음):
- `GOOGLE_APPLICATION_CREDENTIALS=/abs/path/to/service-account.json`
  - 파일 경로 기반(키를 env에 직접 넣지 않아서 운영에 더 안전)

---

## 5) 유료 API: SerpAPI / Perplexity 활성화 + 역할

현재 점수 모델에서 유료 API가 필요한 항목:

- AEO: **AI 답변 인용 빈도(20점)** — 현재 `unavailable`
- GEO: **AI Overview 노출(25점)** — 현재 `unavailable`

이 둘은 GSC/GA4/PageSpeed만으로는 "AI 답변/AI Overview에서 실제로 우리 URL이 인용되는지"를 직접 측정하기 어렵기 때문에, SERP/LLM 기반 외부 API가 필요합니다.

### 5.1 SerpAPI (역할 / 활성화)

역할:
- Google 검색 결과를 API로 받아오고,
- (옵션) **AI Overview(요약/인용 영역)**을 파싱해서
  - AI Overview 노출 여부
  - AI Overview 인용 URL/도메인
  - 인용 텍스트(가능한 범위)
  를 추출하는 데 사용합니다.

활성화 절차(개요):
1. SerpAPI 가입
2. API Key 발급
3. 백엔드 env에 키 추가(예: `SERP_API_KEY=...`)
4. 키워드 리스트(Top queries)를 대상으로 주기적으로 호출하여 인용/노출을 저장/집계

프로젝트에서 키 정상 여부 확인(키 노출 없이):
```bash
curl -sS http://localhost:7020/api/serpapi/account
```

주의:
- 비용은 호출량 기반(플랜별 상이)
- 키워드 수 x 지역/기기/언어 변형만큼 호출이 늘어날 수 있어, **샘플링/우선순위 큐**가 필요합니다.

### 5.2 Perplexity API (역할 / 활성화)

역할:
- 특정 질의(query)에 대해 Perplexity가 생성한 답변을 받아오고,
- 응답의 citations(출처)에서 **biocom.kr(또는 특정 페이지 URL)이 포함되는지**를 검사해
  - "AI 답변 인용 빈도"를 계량화하는 용도로 사용합니다.

활성화 절차(개요):
1. Perplexity 개발자 콘솔에서 API Key 발급
2. (향후 구현 시) 백엔드 env에 키 추가(예: `PERPLEXITY_API_KEY=...`)
3. Top 키워드/질문을 기준으로 주기적으로 API 호출
4. 응답의 citations에서 도메인 매칭 → 인용 카운트/비율 저장

주의:
- Perplexity는 LLM 답변이라 **프롬프트/모델/시점에 따라 변동**이 큽니다.
- 반복 측정 시 동일 키워드에 대해 N회 측정 후 중앙값/평균 같은 안정화 로직이 필요합니다.

---

## 6) 다음 구현(선택) 제안: 유료 API 연결 시 점수 항목을 "measured"로 전환

유료 API 연결이 되면 아래처럼 점수 항목을 실측 가능하게 만들 수 있습니다.

- AEO `aiCitation`:
  - (Perplexity/SerpAPI 기반) 키워드 N개에 대해 우리 도메인 인용 비율을 계산 → 0~20점 매핑
- GEO `aiOverview`:
  - (SerpAPI 기반) AI Overview 노출/인용 비율 → 0~25점 매핑

저장 방식은 2가지가 있습니다.
- (간단) 메모리 캐시 + 최근 N건만 노출
- (권장) Supabase 테이블에 일/주 단위 집계 저장 (단, DB 스키마 변경은 사전 승인 필요)
