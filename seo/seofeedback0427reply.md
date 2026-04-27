# 바이오컴 SEO 피드백 검토 결과보고서

작성 시각: 2026-04-27 18:54 KST  
기준일: 2026-04-27  
검토 대상: [[seofeedback0427|seo/seofeedback0427.md]]  
연결 문서: [[!seoplan|seo/!seoplan.md]]  
Primary source: `seo/seofeedback0427.md`, `docurule.md`, 로컬 저장소 구조 검색 결과  
Data source: 로컬 파일 시스템, `package.json`, `frontend/package.json`, `backend/package.json`, `backend/src/routes/*`, `backend/src/crawl.ts`, `backend/src/pagespeed.ts`, `backend/src/gsc.ts`  
Freshness: 2026-04-27 18:54 KST 로컬 확인 기준  
Confidence: 82%  

## 10초 요약

이번 턴의 목적은 `seofeedback0427.md`의 SEO 진단 제안을 실제 저장소 구조와 맞춰 실행 가능한 문서로 바꾸는 것이다. 현재 저장소에는 GSC, GA4, PageSpeed, 크롤, AEO/GEO 진단 부품이 이미 있어 읽기 전용 SEO 진단을 바로 시작할 수 있다. 아직 안 닫힌 병목은 라이브 사이트를 실제로 크롤링한 숫자와 아임웹 관리자 설정 확인이다. 다음 액션은 `seo/!seoplan.md` 순서대로 공개 URL 진단을 먼저 돌리고, 운영 반영은 별도 승인 뒤 진행하는 것이다.

## 고등학생 비유

이번 작업은 시험을 보기 전에 교실 배치도와 채점표를 먼저 확인한 일이다. 아직 시험을 채점한 것은 아니지만, 어떤 문제를 어떤 순서로 풀어야 하는지는 정리됐다.

## Phase-Sprint 요약표

| Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|
| Phase1 | [[#Phase1-Sprint1]] | 프로젝트 구조 파악 | Codex | 100% / 0% | [[#Phase1-Sprint1\|이동]] |
| Phase1 | [[#Phase1-Sprint2]] | SEO 피드백 판정 | Codex | 100% / 0% | [[#Phase1-Sprint2\|이동]] |
| Phase1 | [[#Phase1-Sprint3]] | 실행 플랜 문서화 | Codex | 100% / 0% | [[#Phase1-Sprint3\|이동]] |
| Phase1 | [[#Phase1-Sprint4]] | 라이브 읽기 전용 진단 | Codex | 0% / 0% | [[#Phase1-Sprint4\|이동]] |

## 문서 목적

이 문서는 `seofeedback0427.md`의 제안 중 무엇을 바로 실행할 수 있고, 무엇은 승인이나 추가 확인이 필요한지 정리한다.

## 이번 턴의 목표

1. 로컬 프로젝트 구조를 확인한다.
2. 피드백 문서의 핵심 제안을 실행 단위로 나눈다.
3. `docurule.md` 규칙에 맞춘 SEO 플랜을 만든다.

## 실제로 바뀐 것

- `seo/seofeedback0427reply.md`를 새로 작성했다.
- `seo/!seoplan.md`에 SEO/AEO 실행 플랜을 새로 작성했다.
- 운영 사이트, 운영 DB, 아임웹 설정은 수정하지 않았다.

## 실측 결과

| 항목 | 값 | 기준 |
|---|---:|---|
| 검토한 피드백 문서 | 333줄 | `seo/seofeedback0427.md` |
| 검토한 문서 규칙 | 1,125줄 | `docurule.md` |
| 최상위 주요 폴더 | 39개 | `.git` 제외, 2026-04-27 18:54 KST |
| 프론트 페이지 라우트 | 20개 | `frontend/src/app/**/page.tsx` |
| 백엔드 라우트 파일 | 25개 | `backend/src/routes/*.ts` |
| 백엔드 보조 스크립트 | 77개 | `backend/scripts/*` |

## 무엇이 증명됐는가

사실: 이 저장소는 Next.js 프론트엔드와 Express TypeScript 백엔드로 구성돼 있다. 프론트는 `7010`, 백엔드는 `7020`을 기본 포트로 쓴다.

사실: 백엔드에는 이미 `GSC`, `GA4`, `PageSpeed`, `crawl`, `diagnosis`, `AI citation` 계열 라우트가 등록돼 있다.

현재 판단: `seofeedback0427.md`가 제안한 읽기 전용 SEO 진단은 새 프로젝트를 만들지 않고 기존 백엔드 부품을 확장하는 방식이 가장 빠르다.

유력 가설: 기존 `backend/src/crawl.ts`는 기본적인 JSON-LD, heading, 이미지, 본문 단어 수를 보지만, 피드백 문서가 요구한 raw HTML과 rendered DOM 비교, canonical, sitemap, 중복 URL 그룹, 상세 이미지 본문 판정까지는 아직 부족하다.

## 아직 증명되지 않은 것

- `biocom.kr`의 현재 sitemap.xml 응답 상태는 이번 턴에서 새로 측정하지 않았다.
- `/index/?bmode=view&idx=...` 유형 잡음 URL이 실제로 몇 개 색인됐는지는 이번 턴에서 확정하지 않았다.
- Product, Article, BreadcrumbList 구조화 데이터가 렌더링된 DOM에 존재하는지는 이번 턴에서 확정하지 않았다.
- 아임웹 관리자에서 canonical, noindex, 리다이렉트, 사용자 코드 삽입을 어디까지 직접 제어할 수 있는지는 이번 턴에서 확인하지 않았다.

## 이 결과가 프로젝트에 주는 도움

이제 SEO 작업을 감으로 시작하지 않아도 된다. 먼저 URL, 캐노니컬, 사이트맵, 본문 텍스트, 구조화 데이터, 속도 숫자를 뽑고, 그 다음 상품 4개만 시범 개선하는 순서가 잡혔다. 이렇게 하면 전환율 좋은 상세페이지를 바로 갈아엎지 않고도 검색엔진과 AI가 읽을 수 있는 구조를 만들 수 있다.

## 제 판단

`seofeedback0427.md`의 방향은 맞다. 특히 아래 5개는 우선순위가 높다.

| 항목 | 판단 | 이유 |
|---|---|---|
| URL·canonical 진단 | 동의 | query parameter URL과 잡음 URL은 색인 분석을 흐린다. |
| sitemap.xml 확인 | 동의 | robots.txt가 sitemap을 가리켜도 실제 응답과 제출 상태를 확인해야 한다. |
| 통이미지 본문 진단 | 동의 | 검색엔진과 AI가 제품 가치를 읽는지 확인해야 한다. |
| Product/Article JSON-LD | 동의 | 상품, 검사권, 칼럼 구조가 명확해서 효과 대비 난이도가 낮다. |
| 숨김 텍스트 금지 | 강하게 동의 | 검색 조작으로 보일 수 있어 사용자에게도 보이는 텍스트 블록이 안전하다. |

## 추천 답변

### Q1. 읽기 전용 진단만 할지, JSON-LD 샘플까지 할지

추천안 A: 읽기 전용 진단과 JSON-LD 샘플 생성을 한 번에 한다. 운영 반영은 하지 않는다.

제 추천: YES  
추천 자신감: 84%  
이유: 공개 URL에서 상품명, 가격, 후기 수, 이미지, breadcrumb 후보를 추출해 샘플을 만드는 것은 운영 변경이 아니다. 개발팀과 콘텐츠팀이 바로 판단할 수 있는 산출물이 생긴다.  
답변 형식: `YES` 또는 `NO: 읽기 전용 진단만 먼저`  
YES 이후 Codex 작업: `seo/!seoplan.md`의 Phase1-Sprint1부터 Phase2-Sprint6까지 진행한다.

### Q2. 우선 개선 대상 4개

추천안 A: `종합 대사기능 분석`, `음식물 과민증 분석`, `바이오밸런스`, `뉴로마스터` 4개로 시작한다.

제 추천: YES  
추천 자신감: 76%  
부족 데이터: 최근 90일 GSC landing page별 클릭, GA4 product page 전환율, 아임웹 상품별 매출 순위  
이유: 검사권 2개와 영양제 2개를 섞으면 상품 유형별 SEO 문제를 같이 볼 수 있다.  
답변 형식: `YES` 또는 `NO: 대상 상품 수정`

### Q3. 1차 목표

추천안 A: 1차 목표는 구글 검색 유입 증가로 두되, 설계 기준은 네이버와 AI 검색까지 포함한 AEO 구조로 잡는다.

제 추천: YES  
추천 자신감: 81%  
이유: Google Search Console 수치가 가장 빨리 검증 가능하다. 하지만 본문 구조, FAQ, JSON-LD, 조직 정보는 네이버와 AI 답변 노출에도 같이 쓰인다.  
답변 형식: `YES` 또는 `NO: 구글만 우선`

## 다음 액션

- 지금 당장: `seo/!seoplan.md` 기준으로 공개 URL 읽기 전용 진단을 시작한다.
- 이번 주: URL 인벤토리, robots/sitemap, canonical, 구조화 데이터, 본문 텍스트, 속도 보고서를 만든다.
- 승인 후: 아임웹 관리자 설정, GTM/사용자 코드 게시, 상품 상세 텍스트 블록 삽입, Search Console/Naver 제출을 진행한다.

## Sprint 상세

## Phase1-Sprint1
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 프로젝트 구조 파악  
**상태**: 100% / 0%

### 역할 구분

- TJ: 해당 없음
- Codex: 로컬 구조, package, route, 기존 SEO 관련 모듈 확인
- Claude Code: 해당 없음

### 무엇을 했는가

프론트엔드, 백엔드, 데이터, 문서 폴더 구조를 확인했다. SEO/AEO 진단에 바로 쓸 수 있는 기존 부품은 `backend/src/routes/gsc.ts`, `backend/src/routes/pagespeed.ts`, `backend/src/routes/crawl.ts`, `backend/src/routes/diagnosis.ts`, `backend/src/crawl.ts`, `backend/src/pagespeed.ts`, `backend/src/gsc.ts`다.

### 실측 결과

프론트는 Next.js 16.1.6, React 19.2.3 기반이다. 백엔드는 Express 5.2.1, TypeScript, Cheerio, Google APIs, Playwright, PageSpeed API를 사용한다.

## Phase1-Sprint2
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: SEO 피드백 판정  
**상태**: 100% / 0%

### 역할 구분

- TJ: 승인 질문에 YES/NO 답변
- Codex: 피드백의 실행 가능성 판정과 우선순위 정리
- Claude Code: 상품 상세 텍스트 블록과 화면 반영안이 필요할 때 참여

### 무엇을 했는가

피드백의 핵심을 URL/canonical, sitemap/robots, on-page SEO, 구조화 데이터, 본문 텍스트, 속도 6개 축으로 재정리했다.

### 실측 결과

현재 문서 기준 가장 먼저 해야 할 일은 운영 변경이 아니라 공개 URL 진단이다. 이 단계는 아임웹 관리자 접근 없이 진행 가능하다.

## Phase1-Sprint3
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 실행 플랜 문서화  
**상태**: 100% / 0%

### 역할 구분

- TJ: 승인 필요 항목 검토
- Codex: `seo/!seoplan.md` 작성
- Claude Code: 운영 화면이나 콘텐츠 블록 시안이 필요할 때 참여

### 무엇을 했는가

`docurule.md` 규칙에 맞춰 SEO/AEO 작업을 Phase와 Sprint로 나눴다. 각 Sprint는 무엇을 확인하고, 왜 필요한지, 산출물과 검증 기준이 무엇인지 포함한다.

### 실측 결과

생성 파일은 `seo/seofeedback0427reply.md`, `seo/!seoplan.md` 2개다.

## Phase1-Sprint4
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 라이브 읽기 전용 진단  
**상태**: 0% / 0%

### 역할 구분

- TJ: 2FA가 필요한 Search Console, Naver Search Advisor, 아임웹 관리자 화면 확인이 필요할 때 승인 또는 화면 제공
- Codex: 공개 URL 크롤링, CSV/MD 보고서 생성, 현재 수치 기록
- Claude Code: 보고서 화면화 또는 아임웹 상세 블록 시안이 필요할 때 참여

### 실행 단계

1. [Codex] 공개 URL 인벤토리를 만든다 — 무엇: `biocom.kr` 내부 링크와 sitemap URL을 최대 300개까지 수집한다. 왜: 대표 URL, 중복 URL, 잡음 URL을 숫자로 분리하기 위해서다. 어떻게: 기존 `backend/src/crawl.ts`를 확장하거나 별도 읽기 전용 스크립트를 만든다. 산출물: URL 인벤토리 CSV와 요약 보고서. 검증: URL별 status, final URL, type, parameter 여부가 기록된다.
2. [Codex] 페이지별 SEO 태그를 확인한다 — 무엇: title, description, canonical, robots meta, OG, h1/h2/h3, 이미지 alt, JSON-LD를 raw HTML과 렌더링 DOM에서 비교한다. 왜: 검색엔진이 실제로 읽는 정보를 확인하기 위해서다. 어떻게: Cheerio와 Playwright를 함께 쓴다. 산출물: 페이지 SEO 점검 CSV/MD. 검증: 대상 6개 페이지가 모두 측정된다. 의존성: 병렬가능, 공개 URL만 사용한다.
3. [TJ] 관리자 제출 상태를 확인한다 — 무엇: Search Console과 Naver Search Advisor의 sitemap 제출 상태를 확인한다. 왜: 공개 URL만으로는 제출 상태를 확정할 수 없기 때문이다. 어떻게: 로그인 화면에서 제출 URL과 최근 처리 상태를 확인한다. 산출물: 제출 상태 메모 또는 캡처. 검증: sitemap URL, 마지막 제출일, 오류 여부가 기록된다. 의존성: 부분병렬, 공개 진단은 먼저 진행 가능하다.

## 개발 부록

| 영역 | 확인 위치 | 현재 판단 |
|---|---|---|
| 프론트 앱 | `frontend/src/app/page.tsx` | GSC, 키워드, CWV, 진단 탭이 이미 있다. |
| 프론트 라우트 | `frontend/src/app/**/page.tsx` | 20개 페이지 라우트가 있다. |
| 백엔드 앱 | `backend/src/app.ts` | Express 앱에서 health와 route 등록을 담당한다. |
| 백엔드 route 등록 | `backend/src/bootstrap/registerRoutes.ts` | GSC, GA4, PageSpeed, crawl, diagnosis 라우트가 연결돼 있다. |
| 공개 크롤 | `backend/src/crawl.ts` | 기본 구조 분석은 가능하지만 canonical/중복/렌더링 비교는 보강 필요하다. |
| GSC 조회 | `backend/src/gsc.ts` | Search Console read-only 조회 부품이 있다. |
| 속도 측정 | `backend/src/pagespeed.ts` | PageSpeed API 기반 모바일/데스크톱 측정이 가능하다. |
| 검증 스크립트 | `scripts/validate_wiki_links.py` | Obsidian 내부 링크 검증에 사용한다. |
