# 페이지 진단 개선 메모 (pageanal1.0)

작성일: 2026-02-21

## 1) 프로젝트 구조 요약

- 루트: `package.json`에서 `frontend/`, `backend/`를 각각 실행/빌드하는 형태
  - `npm run dev:frontend` → Next.js(포트 7010)
  - `npm run dev:backend` → Express API(포트 7020)
- 프론트엔드: `frontend/` (Next.js App Router)
  - 대시보드 단일 페이지: `frontend/src/app/page.tsx`
  - 페이지 진단 탭(UI): URL 입력 → 크롤링/스코어 API 호출 → Schema/콘텐츠 구조/감점 항목 렌더
- 백엔드: `backend/` (Express + TypeScript)
  - 서버: `backend/src/server.ts`
  - 크롤링/구조 분석: `backend/src/crawl.ts` (cheerio 기반)
  - AEO/GEO 점수 산출: `backend/src/scoring.ts`
  - 환경변수: `backend/src/env.ts` (GSC/PageSpeed/GA4/SerpAPI/OpenAI 등)

## 2) 페이지 진단(현재 동작) 정리

- FE(`frontend/src/app/page.tsx`)에서 “페이지 진단 시작” 클릭 시:
  - `POST /api/crawl/analyze` → Schema(JSON-LD/microdata) + 콘텐츠 구조(H2/H3/표/목록/메타 등) 분석
  - `GET /api/aeo/score?url=...` / `GET /api/geo/score?url=...` → GSC + (캐시된) PageSpeed + (선택) GA4 + (선택) SerpAPI + 크롤 결과를 종합 점수화
- 캡처 화면에서 보이는 “Schema 마크업 진단 / 콘텐츠 구조 분석 / 감점 요인 및 개선 권장”은
  - 크롤 결과(`crawl.ts`) + 프론트의 감점 규칙(`diagnosisItems` useMemo)로 생성됨

## 3) 캡처 화면 기준(이미지 #1/#2) 관찰 포인트

- 점수 변화(캡처 기준):
  - 이미지 #1: AEO 42 / GEO 57
  - 이미지 #2: AEO 54 / GEO 78
- Schema 섹션:
  - 이미지 #1: FAQPage/Article/HowTo/Author/Medical/Speakable 대부분 “❌ 없음”
  - 이미지 #2: Article + Author/Person은 “✅ 감지됨”, 나머지는 “❌ 없음”
- 해석:
  - 목록 페이지(예: `/healthinfo`) vs 칼럼 상세(예: `bmode=view&idx=...`)는 “기대하는 스키마”가 다르니,
    동일 기준으로 감점하면 오해가 생길 수 있음(목록에서 Article/Author 없다고 ‘문제’로만 표시되는 케이스).

## 4) (참고) 실제 크롤링으로 확인된 값 예시

> 아래 값은 현재 `backend/src/crawl.ts` 로직 그대로 `biocom.kr`을 크롤링한 결과(2026-02-21) 요약이오.

| 구분 | URL | Schema 감지 | 콘텐츠 구조(주요) | 메타 설명 길이 |
|---|---|---|---|---|
| 목록 | `https://biocom.kr/healthinfo` | `FAQ/HowTo/Article/Medical/Person/Speakable` 모두 false(OnlineStore 계열만 감지) | H2=0, H3=0, 목록=27, 이미지=10(alt 8) | 9자(너무 짧음) |
| 상세(샘플) | `https://biocom.kr/healthinfo/?...&bmode=view&idx=5764202...` | `NewsArticle/WebPage/Person/Organization` 감지(Article/Author true) | H2=0, H3=0, 인용=1, 이미지=14(alt 12) | 3590자(너무 김) |

주의:
- 현재 분석은 `body` 전체를 기준으로 카운트하여, 메뉴/푸터/공통 UI가 섞이면서 `wordCount`, `listCount` 등이 과대 계상될 수 있소.

## 5) “분석 대상 페이지(콘텐츠/사이트)” 개선 우선순위

### P0 (즉시 권장)

1. 메타 디스크립션 정리(70~160자 권장)
   - 너무 짧거나(예: 9자) 너무 긴(예: 3590자) 케이스가 모두 관측됨
   - 상세 페이지는 “요약 1~2문장 + 핵심 키워드 + 차별 포인트” 형태로 강제
2. H2/H3 구조 도입
   - 현재 진단/실측에서 H2/H3가 0으로 잡히는 페이지가 존재 → 문서 구조가 검색엔진/AI에게 불리
   - 권장 패턴: H2(정의/효능/부작용/복용법/FAQ) + H3(세부 질문)
3. FAQ 섹션 추가 + `FAQPage` 스키마 적용(해당하는 칼럼부터)
   - AEO/GEO 점수에 직접 반영되고(현재 로직 기준), AI 답변 후보로 선택될 확률을 올림

### P1 (중요)

1. 의료/건강 맥락 스키마(페이지 성격에 맞게) 보강
   - `MedicalWebPage`, `HealthTopicContent` 등(실제 적용 가능 여부는 CMS/임웹 제약 확인 필요)
2. 이미지 alt 누락 보완
   - 이미지가 존재할 때 alt 누락이 관측됨(예: 2/10, 2/14)
3. 근거/출처 표기 강화
   - 연구/가이드 인용을 본문에 명시(가능하면 `blockquote` + 출처 링크)

### P2 (옵션/선택 적용)

1. `HowTo` 스키마
   - “~하는 법/복용 순서/체크리스트”처럼 단계형 콘텐츠에만 적용(무리한 전면 적용은 비추)
2. `Speakable` 스키마
   - 실제 음성 검색/Assistant 활용 계획이 있을 때만 우선순위 부여

## 6) “페이지 진단 메뉴(도구)” 자체 개선안

### 6-1. 진단 정확도 개선

1. 본문 영역(Article/Main)만 분석하도록 스코프 축소
   - 현재 `body` 전체 카운트 → 내비/푸터로 인해 `wordCount`, `listCount`가 왜곡될 수 있음
   - 우선순위: `article`, `main`, 혹은 임웹 콘텐츠 컨테이너 셀렉터를 탐지해서 그 영역만 분석
2. 페이지 타입별 기대치 분리(목록 vs 상세)
   - 목록: `ItemList`/`CollectionPage`/`BreadcrumbList` 중심
   - 상세: `Article/NewsArticle` + `Person(author)` 중심
   - 현재는 목록에서도 `Article/Author` 미탐지를 “urgent”로 올려 UX 오해 가능
3. 메타 설명 “상한(160자)”도 상태에 반영
   - 현재 UI는 길이가 길어도 ‘좋음’으로 표시될 수 있음(진단 리스트와 불일치)
4. 이미지 0개인 페이지의 “alt 있음” 지표는 N/A 처리
   - 현재 로직에서는 이미지가 0개여도 alt 지표가 빨간색이 될 여지가 있음
5. JS 렌더링 페이지 대응(필요 시)
   - 크롤 결과가 비정상(본문 0, 스키마 0 등)일 때 Playwright 렌더링 fallback 고려

### 6-2. 화면/UX 개선

1. 단위 표기 수정
   - “메타 설명 길이”는 `개`가 아니라 `자`(문자 수)로 표기
2. “측정 불가(unavailable)” 항목 가이드 강화
   - SerpAPI/GA4/PageSpeed 미설정이면 점수/항목이 0으로 보이는데,
     “설정 미완료”와 “성능/품질이 낮음”을 분리해서 보여주면 오해 감소
3. 리포트 내보내기/비교
   - 진단 결과를 MD/JSON으로 export
   - 같은 URL의 이전 실행 대비 diff(스키마/구조/점수 변화) 제공
4. URL 템플릿/샘플 버튼
   - “목록 진단” / “상세 진단(샘플 idx 자동 선택)” 버튼을 제공하면 사용 흐름이 매끄러움

## 7) 개선 작업 위치(코드 레퍼런스)

- FE 진단 UI/표시: `frontend/src/app/page.tsx`
- 감점 항목 생성(룰): `frontend/src/app/page.tsx`의 `diagnosisItems` useMemo
- 크롤/분석: `backend/src/crawl.ts`
- 점수 산출/브레이크다운: `backend/src/scoring.ts`

