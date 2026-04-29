# 바이오컴 SEO/AEO 실행 플랜

작성 시각: 2026-04-27 18:54 KST
최근 업데이트: 2026-04-29 KST (아임웹 자동 JSON-LD 재확인 + GSC URL Inspection API 10건 자동 확인 + `/seo` 반영)
기준일: 2026-04-29
연결 문서: [[seofeedback0427|seo/seofeedback0427.md]], [[seofeedback0427reply|seo/seofeedback0427reply.md]], [[!frontmenu|seo/!frontmenu.md]], [[docurule|docurule.md]]
스크린샷: [seo/screnshot/](./screnshot/) (10개 섹션) · [seo/screnshot/url-cleanup/](./screnshot/url-cleanup/) (B 작업 요청서 화면 9개 섹션)
Primary source: 로컬 저장소 구조, 공개 URL 읽기 전용 진단 결과, GSC 라이브 데이터, `seofeedback0427.md`
Freshness: 2026-04-29 KST 공개 HTML 구조화 데이터 재확인, 최종 실행 패키지, GSC URL Inspection API 10건, 로컬·VM `/seo` 프론트 반영 기준
Confidence: 92%

## 10초 요약

이 플랜의 목표는 바이오컴 SEO를 작은 태그 수정이 아니라 `검색엔진과 AI가 상품, 검사권, 칼럼을 정확히 이해하는 구조`로 다시 정리하는 것이다. 2026-04-29 공개 HTML 재확인 결과 상품 Product/Offer JSON-LD는 아임웹 쇼핑 SEO 자동 설정으로 이미 생성되고 있다. 따라서 상품 4개 실행 패키지는 `Product JSON-LD 신규 중복 삽입`이 아니라 `보이는 본문 텍스트 + 기존 자동 Product 값 검증 + Breadcrumb/FAQ 보강 + GSC canonical 추적`으로 조정한다. 홈 `/index`는 Google이 홈으로 잘 합치지만, 검사권 2개는 `/shop_view/?idx=...` 쪽을 표준으로 보고 있으며 음식물 과민증 공식 URL은 `NOINDEX` 제외 상태다.

## 고등학생 비유

이 플랜은 도서관 책 정리와 같다. 책 내용이 좋아도 제목표, 분류표, 목차, 책 위치가 엉키면 사람이든 검색엔진이든 좋은 책을 찾기 어렵다.

## Phase-Sprint 요약표

| Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|
| Phase1 | [[#Phase1-Sprint1]] | URL 인벤토리 | Codex | 100% / 0% | [[#Phase1-Sprint1\|이동]] |
| Phase1 | [[#Phase1-Sprint2]] | robots와 sitemap 진단 | Codex | 100% / 0% | [[#Phase1-Sprint2\|이동]] |
| Phase1 | [[#Phase1-Sprint3]] | SEO 태그와 canonical 진단 | Codex | 100% / 0% | [[#Phase1-Sprint3\|이동]] |
| Phase1 | [[#Phase1-Sprint4]] | 본문 텍스트와 구조화 데이터 현황 | Codex | 100% / 0% | [[#Phase1-Sprint4\|이동]] |
| Phase1 | [[#Phase1-Sprint5]] | 속도와 리소스 진단 | Codex | 90% / 0% | [[#Phase1-Sprint5\|이동]] |
| Phase2 | [[#Phase2-Sprint6]] | 대표 URL 정책 | TJ + Codex | 82% / 20% | [[#Phase2-Sprint6\|이동]] |
| Phase2 | [[#Phase2-Sprint7]] | JSON-LD 샘플 | Codex + Claude Code | 95% / 0% | [[#Phase2-Sprint7\|이동]] |
| Phase3 | [[#Phase3-Sprint8]] | 상품 상세 텍스트 시범개선 | TJ + Claude Code + Codex | 85% / 0% | [[#Phase3-Sprint8\|이동]] |
| Phase3 | [[#Phase3-Sprint9]] | 칼럼과 FAQ AEO 구조 | Claude Code + Codex | 20% / 0% | [[#Phase3-Sprint9\|이동]] |
| Phase4 | [[#Phase4-Sprint10]] | 제출과 모니터링 | TJ + Codex | 30% / 20% | [[#Phase4-Sprint10\|이동]] |
| Phase4 | [[#Phase4-Sprint11]] | 내부 모니터링 화면(/seo) | Claude Code + Codex | 90% / 0% | [[#Phase4-Sprint11\|이동]] |

## 문서 목적

이 문서는 바이오컴 SEO/AEO 작업을 누가, 어떤 순서로, 어떤 산출물과 검증 기준으로 진행할지 정리한다.

## 지표 체계

- 회사 북극성: 검색과 AI 답변에서 들어온 방문이 실제 상담, 검사권 구매, 영양제 구매로 이어지는가.
- 팀 핵심 지표: GSC 클릭, 노출, CTR, 평균 순위, 색인 가능 대표 URL 수, 중복 URL 비율, Product/Article 구조화 데이터 유효 페이지 수.
- 진단 지표: canonical 일치율, sitemap 정상 URL 비율, HTML 본문 핵심 문장 수, alt 누락 이미지 수, 모바일 PageSpeed 점수, LCP, CLS.
- source 기준: 공개 URL과 sitemap이 primary, GSC와 Search Console 제출 상태가 cross-check, GA4와 아임웹 매출 데이터가 fallback이다.

## 핵심 원칙

1. 먼저 읽기 전용으로 숫자를 뽑는다.
2. 숨김 텍스트는 쓰지 않는다. 사람에게도 보이는 텍스트 구조만 쓴다.
3. canonical, 내부 링크, sitemap, noindex 정책은 한 세트로 맞춘다.
4. 상품 상세 전체를 한 번에 바꾸지 않는다. 검사권 2개와 영양제 2개만 시범 개선한다.
5. 운영 변경은 아임웹 관리자, GTM 게시, Search Console 제출처럼 영향이 있는 항목마다 TJ 승인 뒤 진행한다.

## 현재 확인된 프로젝트 구조

| 영역 | 확인된 구조 | SEO 작업에 주는 의미 |
|---|---|---|
| 루트 | `frontend`, `backend`, `data`, `docs`, `seo`, `scripts` | 문서, 진단 코드, 데이터 산출물을 같은 저장소에서 관리할 수 있다. |
| 프론트 | Next.js 16, React 19, 기본 포트 7010 | SEO 대시보드와 진단 화면 확장이 가능하다. |
| 백엔드 | Express 5, TypeScript, 기본 포트 7020 | 공개 URL 크롤, GSC, GA4, PageSpeed API를 서버에서 묶을 수 있다. |
| 기존 SEO 부품 | `gsc`, `pagespeed`, `crawl`, `diagnosis` 라우트 | 완전 신규 개발보다 기존 부품 보강이 빠르다. |
| 현재 crawler | `backend/scripts/seo-readonly-audit.mjs` | canonical, sitemap, duplicate, raw/rendered, 리소스 관측까지 읽기 전용으로 처리한다. |

## 다음 가장 파급력 있는 할 일

결론: 지금 가장 큰 한 방은 아임웹 탈출 착수가 아니라 `시범 상품/검사권 4개 SEO/AEO 운영 반영 패키지`다. 2026-04-29 재확인 결과 상품 Product/Offer JSON-LD는 아임웹 자동 생성이 있으므로, 이유는 “JSON-LD가 전혀 없음”이 아니라 `상품 상세가 이미지 의존이라 검색엔진과 AI가 읽을 보이는 본문이 부족하고, 자동 Product 값과 보강 코드의 충돌 관리가 필요함`이다. 이 작업은 canonical 수동 변경 불가 문제와 별개로 바로 성과를 만들 수 있고, 나중에 자체 구축을 하더라도 그대로 옮길 수 있는 자산이다.

| 순서 | 우선순위 | 할 일 | 왜 파급력이 큰가 | 산출물 | TJ 결정 |
|---:|---|---|---|---|---|
| 1 | P0 | 완료: 상품/검사권 4개에 보이는 본문 텍스트, 기존 Product 값 검증, FAQ/Breadcrumb 보강안을 묶어 운영 반영 패키지로 만든다 | 아임웹 자동 Product JSON-LD는 확인됐지만 상품 상세가 통이미지 의존이라 검색엔진과 AI가 읽을 보이는 본문이 부족하다. | `reports/seo/seo_aeo_execution_package.md` | 다음은 아임웹 삽입 전 확인 |
| 2 | P0 | 완료: GSC URL 검사 10개 canonical 매트릭스를 자동 확인한다 | 아임웹에서 canonical을 직접 못 바꾸므로 Google이 실제로 어떤 URL을 대표로 고르는지 봐야 한다. | `reports/seo/gsc_canonical_check_matrix.md`, `/seo#p0-confirm` | 검사권 2개 `/shop_view` 표준화와 IGG 공식 URL `NOINDEX` 확인 필요 |
| 3 | P1 | Search Console/Naver에 robots 반영 후 sitemap과 핵심 URL 재제출 기록을 남긴다 | robots.txt는 공개 적용됐지만 검색엔진이 언제 다시 읽는지 추적해야 한다. | 제출 시각, 제출 계정, 오류 여부, 7/14/28일 추적표 | 운영 계정 접근 필요 |
| 4 | P1 | 아임웹 탈출 판단 기준을 숫자로 고정한다 | canonical 불편만으로 자체 구축하면 범위가 너무 커진다. 제약이 누적될 때만 우선순위를 올려야 한다. | 자체 구축 판단 게이트: canonical 불일치 수, URL 노출 분산률, JSON-LD/본문/속도 제약 | 4주 뒤 GSC 기준 재판단 |

이번 주 실행 추천 1번과 2번은 문서 패키지까지 완료됐다. 다음은 실제 아임웹 삽입 준비, Rich Results Test, Search Console URL 검사다.

## 2026-04-29 진행 기록 (아임웹 자동 JSON-LD 재확인)

### 결론

`/seo`의 “JSON-LD 없음” 표기는 2026-04-27 최초 감사 CSV 기준이 남아 있던 것으로 확인했다. 2026-04-29 공개 HTML을 다시 읽은 결과, 아임웹 쇼핑 SEO 자동 설정으로 상품 Product/Offer JSON-LD가 이미 생성되고 있다. TJ님이 공유한 Google Rich Results Test의 Product 스니펫 결과와 일치한다.

### 확인된 사실

| 항목 | 확인값 | source | 기준 시각 | confidence |
|---|---|---|---|---|
| 종합 대사기능 분석 | `application/ld+json` 4개, Product/Offer/AggregateRating/Review 확인 | 공개 HTML 읽기 전용 확인 + TJ님 공유 Rich Results Test | 2026-04-29 | 94% |
| 음식물 과민증 분석 | Product/Offer/AggregateRating/Review 확인. 공식 URL은 `noindex, nofollow` 유지 | 공개 HTML 읽기 전용 확인 | 2026-04-29 | 94% |
| 바이오밸런스 | `application/ld+json` 5개, Product/Offer/AggregateRating/Review 확인 | 공개 HTML 읽기 전용 확인 | 2026-04-29 | 94% |
| 뉴로마스터 | Product/Offer/AggregateRating/Review 확인 | 공개 HTML 읽기 전용 확인 | 2026-04-29 | 94% |
| 건강정보 글 | NewsArticle/WebPage JSON-LD 확인 | 공개 HTML 읽기 전용 확인 | 2026-04-29 | 92% |

### 판단

- 현재 문제는 “상품 구조화 데이터가 아예 없음”이 아니다.
- Product/Offer JSON-LD를 추가로 넣으면 중복 Product가 생기거나 가격, URL, 리뷰 수가 서로 달라지는 위험이 있다.
- 상품 4개 P0 패키지는 `보이는 본문 텍스트 추가`, `기존 Product 값 검증`, `FAQPage/BreadcrumbList 보강`, `GSC canonical 기록` 순서로 조정한다.
- `/seo` 프론트의 JSON-LD 표와 P0 안내 문구도 “아임웹 자동 스키마 확인, 중복 삽입 주의” 기준으로 업데이트했다.

## 2026-04-29 진행 기록 (GSC URL Inspection API)

### 결론

Search Console 화면을 사람이 10번 눌러보는 대신, 백엔드에서 URL Inspection API를 호출해 같은 성격의 결과를 자동으로 읽을 수 있음을 확인했다. `/seo#p0-confirm`에는 자동 확인 결과를 붙이고, `/seo#canonical-check`의 홈 URL 260개 긴 목록은 상위 URL만 먼저 보이도록 접었다.

### 확인된 사실

| 항목 | 확인값 | source | 기준 시각 | confidence |
|---|---|---|---|---|
| 홈 `/` | 사용자 선언 canonical과 Google 선택 canonical 모두 `https://biocom.kr/` | GSC URL Inspection API | 2026-04-29 | 95% |
| 홈 `/index` | 사용자 선언은 `/index`, Google 선택은 `https://biocom.kr/` | GSC URL Inspection API | 2026-04-29 | 95% |
| 종합 대사기능 공식 URL | Google 선택 canonical이 `https://biocom.kr/shop_view/?idx=259` | GSC URL Inspection API | 2026-04-29 | 90% |
| 음식물 과민증 공식 URL | `NOINDEX` 태그로 제외, Google 선택 canonical이 `https://biocom.kr/shop_view/?idx=85` | GSC URL Inspection API + 공개 HTML | 2026-04-29 | 95% |
| 바이오밸런스와 뉴로마스터 | 공식 `HealthFood/?idx=` URL이 Google 선택 canonical | GSC URL Inspection API | 2026-04-29 | 95% |
| 건강정보 칼럼 시범 URL | 자기 자신이 Google 선택 canonical | GSC URL Inspection API | 2026-04-29 | 95% |

### 판단

- 홈 260개 노출 URL은 Search Analytics 분포가 긴 것이고, Google 선택 canonical 관점에서는 `/index`가 홈으로 합쳐져 큰 문제는 아니다.
- 검사권 2개는 공식 스토어 URL이 아니라 `/shop_view`가 대표로 잡혀 있어 JSON-LD `url`, 내부 링크, 아임웹 상담 항목을 같은 기준으로 다시 봐야 한다.
- 음식물 과민증 공식 URL의 `NOINDEX`는 상품 4개 SEO/AEO 반영 전 우선 확인해야 할 운영 리스크다. 공개 HTML 기준 `/igg_store/?idx=85`에는 `<meta name='robots' content='noindex, nofollow' />`가 있고, `/shop_view/?idx=85`에는 noindex가 없다. 따라서 상품 전체 비공개보다는 `/igg_store` 메뉴/페이지 SEO 설정 가능성이 높다.

## 2026-04-28 진행 기록 (robots/canonical 실제 확인)

### 결론

robots.txt는 공개 사이트 기준으로 정상 적용됐다. `Sitemap: https://biocom.kr/sitemap.xml`은 Markdown 링크나 중복 없이 한 줄만 남아 있다. 반면 아임웹은 canonical tag 수동 변경과 특정 URL 301 redirect를 지원하지 않는 것으로 확인됐다. 이 제약은 중기 리스크지만, 현재 우선순위는 자체 구축 착수가 아니라 상품 4개 SEO/AEO 패키지와 GSC canonical 추적이다.

### 확인된 사실

| 항목 | 확인값 | source | 기준 시각 | confidence |
|---|---|---|---|---|
| 공개 robots.txt sitemap 줄 | `Sitemap: https://biocom.kr/sitemap.xml` 한 줄 | `https://biocom.kr/robots.txt` 읽기 전용 확인 | 2026-04-28 17:42 KST | 95% |
| Markdown 링크 형식 sitemap | 없음 | 같은 공개 robots.txt 확인 | 2026-04-28 17:42 KST | 95% |
| trailing period | 없음 | 같은 공개 robots.txt 확인 | 2026-04-28 17:42 KST | 95% |
| sitemap 응답 | HTTP 200 | `https://biocom.kr/sitemap.xml` 읽기 전용 확인 | 2026-04-28 17:42 KST | 95% |
| canonical 수동 변경 | 아임웹 AI 답변 기준 지원하지 않음 | TJ님이 전달한 아임웹 AI 상담 답변 | 2026-04-28 | 80% |
| 301 redirect 직접 지정 | 아임웹 AI 답변 기준 지원하지 않음 | TJ님이 전달한 아임웹 AI 상담 답변 | 2026-04-28 | 80% |
| 상품 URL `idx` | 상품 생성 순서 자동 부여, 임의 변경 불가 | TJ님이 전달한 아임웹 답변 | 2026-04-28 | 85% |
| 메뉴 URL | 디자인 모드에서 변경 가능 | TJ님이 전달한 아임웹 답변 | 2026-04-28 | 85% |

### 판단

- canonical 수동 변경이 안 되는 것은 불편하지만, 자동 canonical이 들어가고 robots/sitemap이 정상이라면 즉시 치명상은 아니다.
- 자체 구축 우선순위는 `canonical 불일치가 핵심 페이지 3개 이상에서 반복`, `같은 상품 노출이 여러 URL로 크게 분산`, `JSON-LD와 본문 텍스트 삽입이 계속 막힘`이 확인될 때 올린다.
- 지금은 `/seo/url-cleanup`에 “아임웹 직접 설정 불가, 공개 HTML과 GSC로 확인” 흐름을 반영했고, 다음 작업은 GSC URL 검사 매트릭스다.

## 2026-04-27 진행 기록

### 확인된 숫자

| 항목 | 값 | source | 기준 시각 | confidence |
|---|---:|---|---|---|
| SEO 감사 점수 | 54/100 | `reports/seo/seo_audit_summary.md` | 2026-04-27 21:17 KST | 78% |
| 수집 URL | 300개 | `reports/seo/url_inventory.csv` | 2026-04-27 21:17 KST | 86% |
| parameter URL | 53개 / 300개 | `reports/seo/canonical_duplicate_risk.md` | 2026-04-27 21:17 KST | 76% |
| sitemap URL | 239개 | `reports/seo/robots_sitemap_audit.md` | 2026-04-27 21:17 KST | 86% |
| sitemap 안 parameter URL | 0개 | `reports/seo/robots_sitemap_audit.md` | 2026-04-27 21:17 KST | 86% |
| 핵심 페이지 JSON-LD | 0개 / 6페이지 | `reports/seo/page_seo_audit.md` | 2026-04-27 21:17 KST | 82% |
| alt 없는 이미지 | 199개 / 핵심 6페이지 | `reports/seo/page_seo_audit.md` | 2026-04-27 21:17 KST | 82% |
| 중복 의심 그룹 | 4개 | `reports/seo/duplicate_url_groups.csv` | 2026-04-27 21:17 KST | 76% |

### 생성된 산출물

- 읽기 전용 감사 스크립트: `backend/scripts/seo-readonly-audit.mjs`
- 후속 정책 패키지 스크립트: `backend/scripts/seo-followup-pack.mjs`
- 감사 요약: `reports/seo/seo_audit_summary.md`
- URL 정책 추천서: `reports/seo/url_policy_recommendations.md`
- URL 정책 매트릭스: `reports/seo/url_policy_matrix.csv`
- JSON-LD 검증 매트릭스: `reports/seo/jsonld_validation_matrix.md`
- JSON-LD 삽입 스니펫: `reports/seo/jsonld_insertion_snippets.md`
- 상품 텍스트 블록 초안: `reports/seo/product_text_block_drafts.md`
- 상품 텍스트 매트릭스: `reports/seo/product_text_block_matrix.csv`
- 상품 4개 SEO/AEO 최종 실행 패키지: `reports/seo/seo_aeo_execution_package.md`
- GSC canonical 검사 매트릭스: `reports/seo/gsc_canonical_check_matrix.md`
- 운영 반영 체크리스트: `reports/seo/operation_change_checklist.md`

### 2026-04-28 진행 (B 작업 요청서 「화면」 분리 — `/seo/url-cleanup`)

#### 왜 화면으로 분리했나

- TJ 피드백: "마크다운/CSV로 컨펌 진행하니 직관적이지 않음"
- `/seo` 메인 페이지에 다 합치면 정보량이 너무 많아짐 (이미 10개 섹션)

#### 새 페이지 구성 (9개 섹션 + 사이드바 + 진행률)

| # | 섹션 | 무엇을 보여주나 |
|---|---|---|
| 0 | 작업 개요 | 무엇을 하는가 + 사전 확인 4건 체크박스 |
| 1 | URL 종류별 처리 기준표 | workorder.md §1의 12행 표 |
| 2-1 | 검색결과 숨김 처리 (noindex) | 11건 카드. 우선순위 뱃지 + 이유/아임웹 작업/검증/리스크 |
| 2-2 | 대표 URL 통일 (canonical) | 8건 카드. 대표 URL + 흡수할 변형 + 검증 |
| 2-3 | robots.txt | 현재(빨강) vs 수정 후(초록) side-by-side + 「전체 복사」 버튼 |
| 2-4 | sitemap 정리·모니터링 | 7건 표. 체크박스 |
| 3 | 1주일 점검 | GSC·시크릿모드·상품검색 4건 체크리스트 |
| 5 | 롤백 기준 | 즉시(0~24h) 5건 + 1주(7d) 4건 + 2주 검증(14d) 4건 |
| 6 | 보고 양식 | TJ 회신용 템플릿 + 「전체 복사」 |

#### 핵심 UX

- **localStorage 기반 진행률**: 사이드바 상단에 "X / Y 완료" + 게이지 바. 새로고침 후에도 체크 유지. 리셋 버튼 1개
- **사이드바 scroll-spy**: 9개 섹션 클릭 또는 스크롤로 자동 활성화 + URL hash 동기화
- **체크 가능한 모든 항목**: noindex/canonical 카드 11+8건, robots 적용/검증 2건, sitemap 7건, 사전확인 4건, 1주일 점검 4건 = **총 36개 체크포인트**
- **GlobalNav 유지**: 상단에 「오버뷰 ··· SEO 분석」 메인 nav 그대로. 사이드바의 "← /seo 대시보드" 링크로 메인 복귀

#### `/seo` 메인 페이지에서의 진입 동선

- 본문 최상단 결정 박스: 「📋 B 작업 요청서 화면 열기」 진한 갈색 버튼 추가
- 승인 현황 섹션 B 카드: 「📋 작업 요청서 화면 열기 (체크리스트 + robots.txt 적용본 + 롤백 표)」 노란 그라데이션 CTA 버튼 추가

#### 신규 파일

- `frontend/src/app/seo/url-cleanup/page.tsx` (메인 페이지, ~440줄)
- `frontend/src/app/seo/url-cleanup/url-cleanup.module.css` (전용 스타일)
- `frontend/src/app/seo/api/url-cleanup/route.ts` (6개 imweb_*.md/csv를 합쳐 JSON 응답)
- `backend/scripts/seo-url-cleanup-screenshots.mjs` (Playwright 자동 캡처)
- `seo/screnshot/url-cleanup/` (00_full_page + 01~09 섹션)

### 2026-04-28 진행 (✅ 승인안 B 완료 — 아임웹 URL 정리 작업 요청서)

#### 승인 결정

- **TJ 회신**: "승인안 B 운영팀이 그대로 작업할 수 있는 URL 정리 요청서 만들기 진행해" (2026-04-28)
- **범위**: 정책안 A 전체 (제외 조건 없음)
- **운영 영향**: 0 (요청서·CSV·MD 산출물만 생성. 실제 아임웹 반영은 별도 승인)

#### 생성된 산출물 (6종)

| 파일 | 용도 | 행수 |
|---|---|---|
| `reports/seo/imweb_url_cleanup_workorder.md` | 운영팀이 한 줄씩 보고 작업 가능한 정본 (절차·검증·롤백 통합) | ~7섹션 |
| `reports/seo/imweb_canonical_targets.csv` | 대표 URL 통일 대상 9건 (P0/P1) | 9 |
| `reports/seo/imweb_noindex_targets.csv` | 검색결과 숨김 대상 11건 (P0/P1) | 11 |
| `reports/seo/imweb_sitemap_excludes.csv` | sitemap 정리·모니터링 대상 6건 | 6 |
| `reports/seo/imweb_robots_txt_revision.md` | robots.txt 수정안 (Markdown 링크 → 일반 URL + 잡음 차단 6 규칙) | — |
| `reports/seo/imweb_rollback_criteria.md` | 즉시/1주일/2주 롤백 신호 + 부분 롤백 매핑 | — |

#### 화면 반영

- `/seo` 승인 현황 카드 B: status "✅ 2026-04-28 완료" + 산출물 6개 그린 체크 리스트
- 본문 최상단 결정 박스: 당시 기준 "오늘 TJ님 결정 1개 (B는 완료)" 헤더, 상품 텍스트 검토 카드 중심으로 표시

#### 당시 다음 단계 (2026-04-28 23:43에 승인안 D로 갱신)

1. 운영팀에 요청서 6종 전달 (Slack / 이메일 / 별도 채팅)
2. 운영팀이 작업 진행 — `imweb_url_cleanup_workorder.md`의 §2 체크리스트 따라
3. 작업 완료 1주일 후: §3 1주일 점검 (GSC 색인·트래픽·핵심 페이지 상태)
4. 작업 완료 2주일 후: 같은 키워드 검색 결과에서 우리 페이지가 1개 URL로 모이는지 확인
5. 추가 라운드: 효과 측정 baseline (`/seo > 성과 기준선`) 비교 -> 승인안 D 결정 (상품 4개 SEO/AEO 패키지)

### 2026-04-28 진행 (UX 2차 고도화 + GSC P0 작업 진수)

#### 표현 수정 (B 승인안 명확화)

- **이전**: 「대표 URL 정책 발행 → 아임웹·robots·sitemap 반영」 (운영 반영처럼 읽힘)
- **변경**: 「운영팀이 그대로 작업할 수 있는 URL 정리 요청서 만들기」 (요청서 「초안」을 만드는 단계임을 명확화). 답변 코드도 "YES: URL 정리 요청서 만들기 (운영 반영은 별도 승인)"으로 수정.
- **C 승인안도 동일하게**: 「상품 4개 텍스트 초안을 콘텐츠팀에 검토 의뢰」 (의뢰만 함, 운영 반영은 별도). 답변: "YES: 상품 4개 텍스트 초안 검토 의뢰 (운영 반영은 별도 승인)"

#### 신규 컴포넌트 (UX 2차)

- `TopDecisionBox.tsx` — `/seo` 최상단 sticky 박스. B/C 결정만 노란 강조로 띄우고 답변 한 클릭 복사 + 「YES/NO 하면 무엇이 생기는지」 펼침
- `BaselineSection.tsx` — GSC 7/28/90일 baseline KPI 3장 + 검색어/페이지 TOP5 비교 (P0)
- `CanonicalDistributionCard.tsx` — 시범 6개 묶음 (상품 4 + 홈 + 칼럼 1)에 대해 같은 상품이 여러 URL로 흩어졌는지 GSC 28일 노출 분포로 자동 분석. 「판정」 카드 (B 승인 권장 / 검토 필요 / 정리됨) 노출 (P0)
- `AeoExplainerSection.tsx` — AEO 확장이 무엇·왜·파급력. 질문형 검색 패턴 6종 표 + 3단계 작업 흐름 (각 단계가 운영 영향 0인지 있는지 명시)
- `ImpactBadge.tsx` — 「읽기 전용 / 사이트 변경 없음」 vs 「제안서 생성 / 팀 협의 없이 바로 가능」 vs 「운영 반영 필요 / TJ 승인 필요」 vs 「실시간 데이터」 4종 배지
- `PlainTerm.tsx` — 쉬운말 + 괄호에 전문용어 + 한 줄 설명 패턴

#### 섹션별 개선

- 모든 섹션 헤더에 ImpactBadge 1개 부착 → 사용자가 「이 카드가 운영을 바꾸는 카드인지 분석 카드인지」 한 눈에 판단
- 「URL 정책」 → 「URL 종류별 처리 기준표 (URL 정책)」 형식으로 헤더 변경
- 「JSON-LD」 → 「검색엔진 설명서 코드 (JSON-LD · 구조화 데이터)」
- 「상품 텍스트」 → 「상품 텍스트 초안 (콘텐츠팀 의뢰용)」
- URL 인벤토리: 기본은 「⚠️ 문제 있는 URL만 (parameter · 잡음 유형 · 200 아닌 응답 · redirect 후보)」 표시, 「전체 URL 보기」 토글로 분석가 모드
- 승인안 카드: 「✅ YES 하면 생성되는 것」 (실제 산출물 5개), 「⚠️ NO 하면 발생하는 일」 (구체적 영향 3~4개) 리스트로 재구성. 「다음 단계」 항목 추가로 YES 후 흐름 안내
- 용어 통일: canonical→대표 URL · noindex→검색결과에서 숨김 · sitemap→검색엔진에 제출할 URL 목록 · JSON-LD→검색엔진 설명서 코드 · GSC→구글 검색 성과 · Rich Results→검색결과 부가 표시

#### 사이드 nav 재정렬 (10개 섹션)

종합 점수 → 지금 검색 성과 → 성과 기준선 → 대표 URL 검증 → URL 처리 기준표 → 검색엔진 설명서 → 상품 텍스트 초안 → AEO 확장 → 운영 체크리스트 → 승인 현황. TopDecisionBox는 sidebar에는 없고 본문 최상단 고정.

### 2026-04-28 진행 (Codex 검수 + GSC KPI 보정)

#### 결론

Claude Code가 만든 `/seo` 프론트는 우리 기준으로 계속 진행 가능하다. 2026-04-28 09:30 KST 기준 빌드, SEO 경로 타깃 lint, 5개 내부 API, 실제 브라우저 렌더링을 통과했다. 운영 사이트·아임웹·GTM·Search Console 변경은 0이다.

#### 확인된 것

| 항목 | 결과 | source | 기준 시각 | confidence |
|---|---|---|---|---|
| `/seo` 페이지 | 200 OK | `curl -I http://localhost:7010/seo` | 2026-04-28 09:30 KST | 95% |
| SEO 내부 API 5종 | 모두 200 JSON | `/seo/api/{audit,url-policy,jsonld,product-text,checklist}` | 2026-04-28 09:30 KST | 95% |
| 프론트 빌드 | 통과 | `npm --prefix frontend run build` | 2026-04-28 09:30 KST | 95% |
| SEO 경로 lint | 통과 | `npm --prefix frontend run lint -- src/app/seo src/components/seo` | 2026-04-28 09:30 KST | 95% |
| 브라우저 검증 | `/seo` 200, GSC live 값 렌더링, console error 0개 | Playwright headless | 2026-04-28 09:30 KST | 92% |
| 노출수 sparkline | 백엔드 응답에 `sparklines.impressions` 7개 포함, 화면 렌더링 정상 | `/api/gsc/kpi` + Playwright | 2026-04-28 09:30 KST | 92% |
| repo-wide lint | 실패 | `npm --prefix frontend run lint` | 2026-04-28 09:26 KST | 75% |

repo-wide lint 실패는 `/seo` 신규 경로가 아니라 기존 화면들의 lint 위반 때문이다. 확인된 예시는 `acquisition-analysis`, `coffee`, `crm`, `tracking-integrity`, `ai-report` 계열이다.

#### 개발 보정

- 수정 파일: `backend/src/routes/gsc.ts`
- 무엇을 고쳤는가: `/api/gsc/kpi`의 현재 7일 구간이 실제로는 8일로 잡히던 문제를 7일로 맞췄다.
- 왜 필요한가: `/seo > 지금 검색 성과` 카드가 "7일"이라고 설명하면서 8일 데이터를 보여주면 기준선 비교가 틀어진다.
- 추가 보정: 평균 순위 변화값을 프론트 기대값과 맞췄다. 이제 `delta.position`은 `현재 평균순위 - 이전 평균순위`다. 값이 양수면 순위가 나빠진 것이고, 값이 음수면 좋아진 것이다.
- 추가 보정: 노출수 카드의 작은 선 그래프가 CTR 배열을 대신 쓰던 문제를 고쳤다. 이제 `/api/gsc/kpi`가 `sparklines.impressions`를 내려주고, `/seo` 노출수 카드는 그 배열을 그린다.
- 검증: `npm --prefix backend run typecheck`, `npm --prefix backend run build`, `npm --prefix frontend run build`, SEO 경로 타깃 lint가 통과했다. 7010/7020 로컬 서버를 새 빌드로 재시작한 뒤 브라우저 검증도 통과했다.

#### 보정 후 라이브 KPI

| 지표 | 값 | source | 기준 시각 | confidence |
|---|---:|---|---|---|
| 현재 클릭 | 416 | `curl http://localhost:7020/api/gsc/kpi` | 2026-04-28 09:30 KST | 90% |
| 현재 노출 | 9,546 | 같은 API | 2026-04-28 09:30 KST | 90% |
| 현재 CTR | 4.36% | 같은 API | 2026-04-28 09:30 KST | 90% |
| 현재 평균 순위 | 6.20위 | 같은 API | 2026-04-28 09:30 KST | 90% |
| 현재 기간 | 7일 | 같은 API | 2026-04-28 09:30 KST | 95% |
| 비교 기간 | 7일 | 같은 API | 2026-04-28 09:30 KST | 95% |
| 평균 순위 변화 | +0.8계단 | 같은 API | 2026-04-28 09:30 KST | 90% |
| 노출수 sparkline | 7개 | 같은 API | 2026-04-28 09:30 KST | 92% |

해석: 평균 순위 변화 `+0.8`은 좋아진 값이 아니라 나빠진 값이다. 숫자가 커질수록 검색 결과에서 더 뒤로 밀린다는 뜻이기 때문이다.

#### 서버 상태

- 프론트: `http://localhost:7010/seo` 기존 `next-server` 유지.
- 백엔드: `http://localhost:7020` 새 빌드로 재시작 완료.
- 운영 영향: 0. 로컬 개발 서버와 내부 대시보드만 확인했다.

### 2026-04-28 진행 (GSC 도메인 속성 권한 + UX 1차 고도화)

#### GSC P0 작업 진수 결과 (2차 라운드)

| 작업 | 상태 | 위치 | 비고 |
|---|---|---|---|
| baseline 7/28/90일 | 완료 | `BaselineSection.tsx` | sc-domain:biocom.kr 기준. 검색어/페이지 TOP5 비교 토글 |
| canonical 정책 검증 | 완료 (시범 6개) | `CanonicalDistributionCard.tsx` | 매처가 시범 패턴이라 일부 상품은 매칭률 낮음. 다음 라운드에서 reports/seo/url_inventory.csv 자동 매핑으로 확장 |
| URL별 GSC 성과 통합 | 완료 (canonical 카드 안에서) | 같은 카드 | 변형 URL별 노출/클릭/CTR/share % 표시 |
| AEO 질문형 query 자동 추출 | 설명만 (Phase3-Sprint9) | `AeoExplainerSection.tsx` | TJ가 「AEO 진행해」 회신하면 Codex가 GSC에서 자동 추출 |
| 시범 4개 상품 시계열 | 다음 라운드 | — | baseline 카드에 페이지 필터 옵션 추가 예정 |

API 한계 안내: 모든 카드에 「GSC API는 모든 행을 반환하지 않고 상위 데이터 위주」 경고 명시.

#### GSC API 연동 상태 변경

- **변경**: 서비스 계정 `seo-656@seo-aeo-487113.iam.gserviceaccount.com`이 이전에는 `https://biocom.kr/`(URL-prefix 속성)에만 추가되어 있었음. 2026-04-28에 TJ가 `sc-domain:biocom.kr`(도메인 속성)에도 「전체」 권한으로 추가.
- **검증 결과**: `/api/gsc/sites` 응답에 두 속성 모두 `siteFullUser`로 등장. 도메인 속성 기준 라이브 쿼리 5종(KPI/trends/keywords/query·query/query·page) 전부 200 OK.
- **현재 데이터 (sc-domain:biocom.kr 기준 7일)**: 클릭 416 · 노출 10,994 · CTR 3.78% · 평균순위 5.87. 상위 키워드 「바이오컴」 121클릭(CTR 68.36%, pos 1).

#### GSC API 권한 추가로 가능해진 작업 (Phase4-Sprint11/12 보강)

| 가능해진 작업 | 사용 데이터 | 적용 위치 |
|---|---|---|
| **(이미 완료) /seo 라이브 KPI 카드** | `/api/gsc/kpi` 7일 합계 + 일별 sparkline 4종 | `LiveGscSection.tsx` |
| **운영 반영 전후 비교 baseline** | 7일/28일/90일 클릭·노출·CTR·순위 시계열 | Phase4-Sprint10 baseline 산출물 |
| **JSON-LD 시범 페이지 우선순위 결정** | URL별 노출/클릭 (page 차원) | 노출 많은데 CTR 낮은 페이지부터 JSON-LD 시범 적용 |
| **상품 텍스트 시범 4개 검증 KPI** | 시범 페이지(`/organicacid_store/?idx=259`, `/HealthFood/?idx=97`, `/igg_store/?idx=85`, `/HealthFood/?idx=198`)별 GSC 시계열 | 텍스트 블록 추가 후 7/14/28일 비교 |
| **질문형 query → FAQ 후보 도출** | query 차원, 「무엇/어떻게/효능/차이/추천」 패턴 매칭 | Phase3-Sprint9 (칼럼·FAQ AEO 구조) |
| **canonical 정책 검증** | URL별 노출 분산 확인 → 같은 상품인데 여러 URL이 노출되면 정책 시급 신호 | Phase2-Sprint6 보강 |
| **opportunity keywords 자동 추출** | 노출 100+ & CTR 5% 미만 키워드 | 메인 대시보드 `/#keyword` 탭에서 이미 자동 분석 중. 향후 `/seo`에도 합류 가능 |
| **Naver Search Advisor 보완** | (별개 작업) 네이버는 GSC와 별도 API. 후속 라운드에서 검토 |  |

#### `/seo` UX 고도화 (Claude Code 작업)

- **인라인 설명 도입**: 모든 섹션에 「이 섹션은 무엇을 위한 것인가요」 안내 + 핵심 용어에 클릭 가능한 Glossary 팝오버(canonical, sitemap, noindex, parameter URL, JSON-LD, status, 최종 URL, GSC, Rich Results Test 등 9종)
- **종합 점수 6항목 각각에 「이게 뭐예요 / 왜 이 점수예요 / 어떻게 올려요」 3줄 설명 추가**
- **가장 큰 문제 5개 각각에 「왜 / 영향 / 해결」 상세 설명 추가**
- **승인안 카드 보강**: 「이게 뭐예요 / 지금 상태 / 왜 결정이 필요해요 / YES 하면 / NO 하면 / 답변 코드」 6개 블록으로 재구성
- **운영 반영 7단계 각 단계마다 「이 단계가 무엇을 바꾸는지」 1줄 설명**
- **별도 승인 표에 「실제로 무엇을 하는가 (어떻게)」 컬럼 추가** (예: Search Console/Naver 제출 = (1) 좌측 메뉴 Sitemaps에서 sitemap 제출 (2) URL 검사 도구로 핵심 6개 색인 요청 (3) Naver Search Advisor 동일 절차)
- **JSON-LD 5개 스니펫 각각에 「이게 뭐예요 / 왜 넣어요 / 어디에 넣어요」 펼침 설명 추가**
- **URL 인벤토리 status 컬럼 한국어화**: 200 → 「200 정상」, 301 → 「301 영구이동」, 404 → 「404 없음」 등
- **컴포넌트 신설**: `WhyCallout.tsx`, `Glossary.tsx`, `LiveGscSection.tsx`
- **스크린샷 정본화**: `seo/screnshot/` 7개 (`backend/scripts/seo-page-screenshots.mjs`로 재생성 가능)

### 2026-04-28 진행 (Claude Code · 프론트 진수)

- 신규 라우트: `frontend/src/app/seo/page.tsx` (포트 7010 기준 `http://localhost:7010/seo`)
- 좌측 sticky 사이드바 + scroll-spy + URL hash 동기화 (`#overview`, `#url-policy`, `#jsonld`, `#product-text`, `#checklist`, `#approvals`)
- 6개 섹션 모두 `reports/seo/*` 정적 산출물에서 직접 읽음 — 운영 사이트·아임웹·GTM 변경 0
- 신규 컴포넌트: `frontend/src/components/seo/{SeoShell,SeoHeader,OverviewSection,UrlPolicySection,JsonLdSection,ProductTextSection,ChecklistSection,ApprovalsSection,CopyButton}.tsx`
- CSV/MD 파서 + 타입: `frontend/src/components/seo/seo.utils.ts`, `seo.types.ts`
- API: `frontend/src/app/seo/api/{audit,url-policy,jsonld,product-text,checklist}/route.ts` (모두 nodejs runtime, no-store)
- 핵심 UX: 점수 게이지 + 4개 KPI 헤더, URL 인벤토리 검색·필터·복사, JSON-LD 스니펫 한 클릭 복사, 상품 4개 모바일 미리보기, 운영 게이트의 `TJ 응답 대기` 펄스 뱃지
- 기획 문서: `seo/!frontmenu.md`

### 현재 판단

사실: 핵심 6개 페이지의 canonical은 존재한다.
사실: 핵심 6개 페이지의 JSON-LD는 0개다.
사실: robots.txt에는 sitemap 지시문이 2개 있고, 그중 1개는 Markdown 링크 형식이다.
현재 판단: sitemap 자체보다 내부 링크와 최종 URL의 parameter 혼선이 더 큰 문제다.
유력 가설: Product/Article/BreadcrumbList JSON-LD와 보이는 텍스트 블록을 먼저 넣으면 구조화 데이터 점수와 AI 이해도는 빠르게 올라갈 수 있다.

## Phase별 계획

### Phase 1
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 읽기 전용 SEO 현황 진단

- 목표: 운영 사이트를 바꾸지 않고 현재 문제를 숫자로 확인한다.
- 왜 지금 해야 하는가: 지금은 URL, sitemap, canonical, 본문 구조 문제가 얼마나 큰지 확정되지 않았다.
- 산출물: URL 장부, sitemap 진단서, 페이지 SEO 점검표, 본문 텍스트 진단서, 속도 진단서.
- 완료 기준: 대상 URL과 핵심 페이지 6개가 모두 측정되고, 각 숫자에 source와 기준 시각이 붙는다.
- 다음 Phase에 주는 가치: 대표 URL 정책과 구조화 데이터 삽입 범위를 감이 아니라 숫자로 결정할 수 있다.

#### Phase1-Sprint1
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: URL 인벤토리
**상태**: 100% / 0%

- 무엇을 하는가: 공개 사이트에서 내부 링크와 sitemap URL을 모아 대표 URL, parameter URL, 잡음 URL을 분류한다.
- 왜 필요한가: 같은 내용이 여러 URL로 보이면 검색엔진과 성과 분석이 모두 흐려진다.
- 산출물: URL 장부, 중복 의심 그룹 초안.
- 우리 프로젝트에 주는 도움: GSC와 GA4에서 어떤 URL을 기준으로 봐야 하는지 정할 수 있다.

##### 역할 구분

- TJ: 해당 없음
- Codex: 공개 URL 수집, 분류 규칙 작성, CSV/MD 산출물 생성
- Claude Code: 해당 없음

##### 실행 단계

1. [Codex] 내부 URL을 수집한다 — 완료. 무엇: `https://biocom.kr/`에서 시작해 동일 도메인 URL 300개를 모았다. 왜: 실제 색인 후보를 한 표로 봐야 하기 때문이다. 어떻게: `backend/scripts/seo-readonly-audit.mjs`를 사용했다. 산출물: `reports/seo/url_inventory.csv`. 검증: `url`, `normalized_url`, `type`, `status_code`, `final_url`, `is_parameter_url` 컬럼이 채워졌다.
2. [Codex] URL을 유형별로 분류한다 — 완료. 무엇: home, category, product, lab/test service, article, review, cart/login/member, noisy parameter URL로 나눴다. 왜: sitemap과 canonical 정책을 페이지 유형별로 다르게 잡기 위해서다. 어떻게: path, query, anchor text, source page를 기준으로 분류했다. 산출물: `reports/seo/canonical_duplicate_risk.md`. 검증: parameter URL 53개, noisy parameter URL 25개가 기록됐다. 의존성: 선행필수, 1번 URL 수집 결과를 사용했다.

#### Phase1-Sprint2
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: robots와 sitemap 진단
**상태**: 100% / 0%

- 무엇을 하는가: robots.txt와 sitemap.xml 응답, URL 수, parameter URL 비중, 제외해야 할 URL 포함 여부를 확인한다.
- 왜 필요한가: 검색엔진에 알려주는 URL 목록이 엉키면 좋은 페이지보다 잡음 URL이 먼저 발견될 수 있다.
- 산출물: robots/sitemap 진단서.
- 우리 프로젝트에 주는 도움: Search Console과 Naver Search Advisor 제출 전 정리할 URL을 확정한다.

##### 역할 구분

- TJ: Search Console/Naver 제출 상태 확인이 필요하면 화면 제공
- Codex: 공개 robots.txt, sitemap.xml, HTTP 응답 확인
- Claude Code: 해당 없음

##### 실행 단계

1. [Codex] robots.txt와 sitemap.xml을 확인한다 — 완료. 무엇: status code, content-type, final URL, sitemap 내용이다. 왜: robots가 sitemap을 가리켜도 실제 응답이 깨질 수 있기 때문이다. 어떻게: 공개 응답과 XML 파서를 사용했다. 산출물: `reports/seo/robots_sitemap_audit.md`. 검증: robots 200, sitemap 200, sitemap URL 239개, parameter URL 0개가 기록됐다.
2. [Codex] sitemap에 들어가면 안 되는 URL을 찾는다 — 완료. 무엇: login, cart, join, board 잡음, 검색 파라미터 URL이다. 왜: 검색엔진이 중요하지 않은 페이지를 따라가지 않게 하기 위해서다. 어떻게: URL 인벤토리와 sitemap URL을 대조했다. 산출물: `reports/seo/robots_sitemap_audit.md`. 검증: sitemap 제외 후보 0개로 기록됐다. 의존성: 부분병렬, Phase1-Sprint1 결과를 사용했다.
3. [TJ] 제출 상태를 확인한다 — 무엇: Search Console과 Naver Search Advisor의 sitemap 제출 URL, 마지막 처리일, 오류 여부다. 왜: 로그인과 2FA가 필요할 수 있기 때문이다. 어떻게: 관리자 화면에서 제출 상태를 확인한다. 산출물: 제출 상태 메모. 검증: 제출 URL과 오류 여부가 기록된다. 의존성: 부분병렬, 공개 응답 진단은 먼저 진행 가능하다.

#### Phase1-Sprint3
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: SEO 태그와 canonical 진단
**상태**: 100% / 0%

- 무엇을 하는가: 핵심 페이지의 title, description, canonical, robots meta, OG, heading, 중복 URL 위험을 확인한다.
- 왜 필요한가: 검색엔진이 어떤 제목과 대표 URL을 믿어야 하는지 명확해야 한다.
- 산출물: 페이지 SEO 점검표, canonical 중복 위험 보고서.
- 우리 프로젝트에 주는 도움: 아임웹에서 무엇을 수정해야 할지 구체적인 요청서로 만들 수 있다.

##### 역할 구분

- TJ: 아임웹 관리자에서 수정 가능 범위 확인이 필요할 때 승인 또는 화면 제공
- Codex: 공개 페이지 raw HTML과 rendered DOM 점검
- Claude Code: 화면 반영안이 필요할 때 참여

##### 실행 단계

1. [Codex] 핵심 페이지 6개를 측정한다 — 완료. 무엇: homepage, service, organicacid product, HealthFood product, healthinfo list, healthinfo article이다. 왜: 페이지 유형별 문제가 다르기 때문이다. 어떻게: raw HTML과 Playwright 렌더링 DOM을 비교했다. 산출물: `reports/seo/page_seo_audit.csv`, `reports/seo/page_seo_audit.md`. 검증: 각 페이지에 title, description, canonical, robots meta, OG, h1/h2/h3 결과가 있다.
2. [Codex] 중복 URL과 canonical 위험을 묶는다 — 완료. 무엇: `/index`, `?q=`, `?idx=`, `interlock=shop_review`, `t=board` 유형이다. 왜: 대표 URL이 흔들리면 순위와 리포트가 흔들린다. 어떻게: URL 패턴, 본문 해시, title, canonical, final URL을 비교했다. 산출물: `reports/seo/canonical_duplicate_risk.md`, `reports/seo/duplicate_url_groups.csv`. 검증: 중복 의심 그룹 4개가 기록됐다. 의존성: 부분병렬, URL 인벤토리를 사용했다.

#### Phase1-Sprint4
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 본문 텍스트와 구조화 데이터 현황
**상태**: 100% / 0%

- 무엇을 하는가: 상품 상세 본문이 실제 HTML 텍스트인지, 이미지인지, alt에만 있는지 구분한다.
- 왜 필요한가: 검색엔진과 AI가 제품의 핵심 가치를 읽어야 검색과 답변 노출이 좋아진다.
- 산출물: 상품 상세 본문 진단서, 구조화 데이터 현황표.
- 우리 프로젝트에 주는 도움: 상세페이지를 전부 갈아엎지 않고도 어떤 텍스트 블록만 추가할지 정할 수 있다.

##### 역할 구분

- TJ: 상품 우선순위와 실제 노출 정보 승인
- Codex: 텍스트/이미지/alt/JSON-LD 측정
- Claude Code: 텍스트 블록 시안이 필요할 때 참여

##### 실행 단계

1. [Codex] 상품 상세 2개를 먼저 분석한다 — 완료. 무엇: `organicacid_store/?idx=259`, `HealthFood/?idx=97` 본문 구조다. 왜: 검사권과 영양제 유형을 각각 대표하기 때문이다. 어떻게: raw HTML, rendered DOM, 이미지 alt, heading을 비교했다. 산출물: `reports/seo/product_detail_content_audit.md`. 검증: 두 상품 모두 이미지 의존 위험 `높음`으로 기록됐다.
2. [Codex] 구조화 데이터 존재 여부를 확인한다 — 완료. 무엇: Product, Offer, AggregateRating, Review, Article, Organization, WebSite, BreadcrumbList, FAQPage다. 왜: 검색 결과와 AI 이해를 돕는 기본 신호이기 때문이다. 어떻게: JSON-LD script와 microdata를 모두 탐색했고 2026-04-29 공개 HTML을 재확인했다. 산출물: `reports/seo/page_seo_audit.md`, `reports/seo/jsonld_validation_matrix.md`. 검증: 최초 감사에는 JSON-LD 0개로 기록됐으나, 현재는 아임웹 자동 Product/Offer/Review JSON-LD가 확인되어 중복 삽입 금지로 판단을 수정했다. 의존성: 병렬가능, 공개 HTML 기준으로 완료했다.

#### Phase1-Sprint5
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 속도와 리소스 진단
**상태**: 90% / 0%

- 무엇을 하는가: 모바일 기준 PageSpeed, 이미지 용량, JS/CSS/폰트, 외부 스크립트 수를 확인한다.
- 왜 필요한가: 상품 상세가 통이미지 위주면 검색 이해뿐 아니라 로딩 속도도 나빠질 수 있다.
- 산출물: 속도와 리소스 진단서.
- 우리 프로젝트에 주는 도움: SEO 개선과 전환율 개선을 같은 우선순위표에서 판단할 수 있다.

##### 역할 구분

- TJ: PageSpeed API 키나 외부 계정 확인이 막힐 때 지원
- Codex: PageSpeed API 또는 Playwright 기반 측정
- Claude Code: 이미지/프론트 최적화 반영안이 필요할 때 참여

##### 실행 단계

1. [Codex] 모바일 PageSpeed를 측정한다 — 부분 완료. 무엇: 핵심 URL의 performance, seo, accessibility, LCP, FCP, CLS, INP, TTFB다. 왜: 느린 페이지는 검색과 전환을 같이 깎는다. 어떻게: 이번 턴에서는 PageSpeed API가 아니라 Playwright 리소스 관측을 사용했다. 산출물: `reports/seo/performance_resource_audit.md`. 검증: URL별 request count와 큰 리소스가 기록됐다.
2. [Codex] 리소스 용량을 확인한다 — 완료. 무엇: HTML, JS, CSS, 이미지, 폰트, 외부 스크립트 수와 큰 파일 목록이다. 왜: PageSpeed 점수만으로는 무엇을 줄여야 하는지 알기 어렵다. 어떻게: Playwright 네트워크 로그를 수집했다. 산출물: `reports/seo/performance_resource_audit.md`. 검증: 홈페이지 366요청, 종합 대사기능 327요청, 바이오밸런스 327요청으로 기록됐다. 의존성: 병렬가능, 공개 URL만 사용했다.

### Phase 2
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 대표 URL과 구조화 데이터 설계

- 목표: 진단 숫자를 기준으로 검색엔진에 보여줄 대표 URL과 JSON-LD 삽입 방식을 정한다.
- 왜 지금 해야 하는가: 본문 개선 전에 대표 URL과 구조화 데이터 기준을 잡아야 중복 작업을 줄일 수 있다.
- 산출물: 대표 URL 정책서, JSON-LD 샘플, 개발팀 요청서.
- 완료 기준: 상품/검사권/칼럼별 대표 URL, canonical, sitemap 포함 기준, JSON-LD 샘플이 정해진다.
- 다음 Phase에 주는 가치: 콘텐츠팀과 개발팀이 같은 구조로 시범 개선할 수 있다.

#### Phase2-Sprint6
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 대표 URL 정책
**상태**: 82% / 20%

- 무엇을 하는가: 상품, 검사권, 칼럼, 게시판, 리뷰, 장바구니/로그인 URL의 검색 노출 정책을 정한다.
- 왜 필요한가: canonical만 넣고 내부 링크와 sitemap이 다르면 검색엔진이 다른 URL을 고를 수 있다.
- 산출물: 대표 URL 정책서, 아임웹 수정 요청서.
- 우리 프로젝트에 주는 도움: GSC 페이지 리포트를 대표 URL 기준으로 읽을 수 있다.

##### 역할 구분

- TJ: 아임웹에서 가능한 noindex/robots/사용자 코드 운영 반영 승인, Search Console URL 검사 확인
- Codex: 정책 초안과 요청서 작성
- Claude Code: 내부 링크 또는 화면 수정안이 필요할 때 참여

##### 실행 단계

1. [Codex] 대표 URL 추천표를 만든다 — 완료. 무엇: URL 유형별 canonical, sitemap 포함, noindex, redirect 여부다. 왜: 운영 반영 전에 정책이 명확해야 한다. 어떻게: Phase1 산출물을 기준으로 분류했다. 산출물: `reports/seo/url_policy_recommendations.md`, `reports/seo/url_policy_matrix.csv`. 검증: 각 정책에 evidence file과 confidence가 붙었다.
2. [TJ] 운영 반영 가능 항목에 답한다 — 무엇: noindex, robots, 사용자 코드, sitemap 제출 후보 승인이다. 왜: 검색 노출과 기존 공유 URL에 영향을 줄 수 있기 때문이다. 어떻게: 추천안 A를 보고 `YES` 또는 수정사항으로 답한다. 산출물: 승인 결과. 검증: 아임웹에서 직접 바꿀 수 있는 항목만 운영 요청서에 남는다. 의존성: 선행필수, 운영 변경은 승인 뒤 진행한다.
3. [Codex] 아임웹 canonical 제약을 반영한다 — 완료. 무엇: canonical 수동 변경과 301 redirect가 지원되지 않는다는 답변을 정책에 반영했다. 왜: 직접 바꿀 수 없는 항목을 운영팀 작업으로 남기면 혼선이 생기기 때문이다. 산출물: `/seo/url-cleanup`, `reports/seo/imweb_canonical_targets.csv`, `reports/seo/imweb_url_cleanup_workorder.md` 갱신. 검증: 공개 HTML과 GSC URL 검사로 추적하는 방식으로 바꿨다.
4. [TJ + Codex] GSC URL 검사 10개 매트릭스를 만든다 — 다음. 무엇: Google이 실제로 선택한 대표 URL을 홈, `/index`, 상품, `/shop_view` 변형에서 확인한다. 왜: 아임웹 자동 canonical이 실제 검색 선택과 일치하는지 봐야 하기 때문이다. 산출물: URL별 사용자 선언 canonical, Google 선택 canonical, 색인 상태, 다음 조치.

#### Phase2-Sprint7
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: JSON-LD 샘플
**상태**: 90% / 0%

- 무엇을 하는가: 상품, 검사권, 칼럼, 조직, breadcrumb 구조화 데이터 샘플을 만든다.
- 왜 필요한가: 검색엔진에 가격, 후기, 상품명, 글 제목, 조직 정보를 명확히 알려야 한다.
- 산출물: JSON-LD 샘플 파일과 삽입 방식 비교표.
- 우리 프로젝트에 주는 도움: 아임웹 직접 삽입과 GTM/사용자 코드 삽입 중 어떤 방식이 안전한지 판단할 수 있다.

##### 역할 구분

- TJ: 실제 화면에 보이는 상품 정보와 삽입 방식 승인
- Codex: JSON-LD 샘플 생성과 유효성 기준 정리
- Claude Code: 아임웹/사용자 코드 삽입 시안 또는 프론트 화면 샘플 작성

##### 실행 단계

1. [Codex] 실제 페이지 값으로 샘플을 만든다 — 완료. 무엇: 상품명, 가격, 이미지 URL, breadcrumb, article 제목이다. 왜: 구조화 데이터는 화면에 보이는 정보와 맞아야 하기 때문이다. 어떻게: Phase1 측정값에서 추출했다. 산출물: `reports/seo/jsonld_samples/*`. 검증: JSON 샘플 5개가 파싱 통과했다.
2. [Codex] 삽입 방식을 비교한다 — 완료. 무엇: 아임웹 직접 수정, GTM/사용자 코드, 서버 렌더링 가능성이다. 왜: 가격과 후기처럼 바뀌는 정보는 삽입 방식에 따라 위험이 다르다. 어떻게: 변경 난이도, 데이터 신뢰, 테스트 가능성을 표로 비교했다. 산출물: `reports/seo/jsonld_recommendations.md`, `reports/seo/jsonld_validation_matrix.md`. 검증: 추천안, 위험, 롤백 전제, 운영 전 검증 기준이 있다. 의존성: 병렬가능, 운영 삽입은 아직 하지 않는다.

### Phase 3
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 콘텐츠 구조 시범개선

- 목표: 전환율을 해치지 않으면서 검색엔진과 AI가 읽을 수 있는 본문 구조를 추가한다.
- 왜 지금 해야 하는가: 진단과 설계가 끝나면 실제 검색 이해를 높이는 콘텐츠가 필요하다.
- 산출물: 상품 상세 텍스트 블록, 칼럼/FAQ 구조, 콘텐츠팀 요청서.
- 완료 기준: 우선 상품 4개와 칼럼 10개에 적용할 텍스트 구조가 승인된다.
- 다음 Phase에 주는 가치: 검색 제출과 모니터링에서 개선 전후 비교가 가능해진다.

#### Phase3-Sprint8
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 상품 상세 텍스트 시범개선
**상태**: 60% / 0%

- 무엇을 하는가: 검사권 2개와 영양제 2개에 사용자에게 보이는 텍스트형 상세 구조를 추가한다.
- 왜 필요한가: 통이미지 본문만으로는 검색엔진과 AI가 제품의 장점과 대상 고객을 충분히 읽기 어렵다.
- 산출물: 상품 상세 텍스트 블록 초안, 콘텐츠/디자인팀 요청서.
- 우리 프로젝트에 주는 도움: 검색 이해와 전환율을 같이 보는 시범 개선을 만들 수 있다.

##### 역할 구분

- TJ: 우선 상품 4개와 문구 방향 승인
- Codex: SEO 구조와 keyword/source 근거 정리
- Claude Code: PC/모바일 상세 블록 시안 작성

##### 실행 단계

1. [Codex] 상품 4개 구조 초안을 만든다 — 완료. 무엇: `종합 대사기능 분석`, `음식물 과민증 분석`, `바이오밸런스`, `뉴로마스터`의 H1/H2/H3 구조다. 왜: 검사권과 영양제 유형을 같이 검증하기 위해서다. 어떻게: Phase1 본문 진단과 URL 인벤토리를 대조했다. 산출물: `reports/seo/product_text_block_drafts.md`, `reports/seo/product_text_block_matrix.csv`. 검증: 각 상품에 대상 고객, 분석/성분, 기대 도움, FAQ가 있다.
2. [TJ] 우선 상품과 문구 방향을 승인한다 — 무엇: 상품 4개와 `숨김 없는 텍스트 블록` 방향이다. 왜: 상세페이지 전환율과 브랜드 표현에 영향을 주기 때문이다. 어떻게: 추천안 A에 `YES` 또는 수정사항으로 답한다. 산출물: 승인 결과. 검증: 승인된 상품과 문구 톤이 기록된다. 의존성: 선행필수, 운영 적용은 승인 뒤 가능하다.
3. [Claude Code] 상세 블록 시안을 만든다 — 무엇: 모바일 전환율을 해치지 않는 PC/공통 텍스트 블록이다. 왜: 검색엔진용이 아니라 사용자에게도 보여야 안전하다. 어떻게: 기존 상세 이미지 아래 또는 설명 영역에 들어갈 구조를 만든다. 산출물: 콘텐츠/디자인팀 요청서 또는 화면 시안. 검증: 텍스트가 숨김 처리되지 않고, 주요 heading이 보인다. 의존성: 부분병렬, 구조 초안은 먼저 만들 수 있다.

#### Phase3-Sprint9
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 칼럼과 FAQ AEO 구조
**상태**: 20% / 0%

- 무엇을 하는가: 칼럼 10개에 Article 구조와 실제 화면에 보이는 FAQ 후보를 정리한다.
- 왜 필요한가: AI 검색은 질문형 문장과 명확한 답변 구조를 잘 읽는다.
- 산출물: 칼럼 Article JSON-LD 후보, FAQ 콘텐츠 후보, 콘텐츠팀 요청서.
- 우리 프로젝트에 주는 도움: 단순 검색 유입뿐 아니라 AI 답변 인용 가능성을 높인다.

##### 역할 구분

- TJ: 의료/건강 표현 수위와 FAQ 공개 여부 승인
- Codex: GSC 질문형 query와 Article/FAQ 구조 기준 정리
- Claude Code: 칼럼 템플릿과 FAQ 화면 구조 작성

##### 실행 단계

1. [Codex] 질문형 query와 칼럼 URL을 묶는다 — 무엇: GSC query 중 무엇, 어떻게, 증상, 효과, 부작용, 차이, 추천 유형이다. 왜: FAQ와 칼럼 구조를 실제 검색어에 맞추기 위해서다. 어떻게: `backend/src/routes/gsc.ts`의 query 조회를 사용한다. 산출물: 칼럼별 질문 후보표. 검증: query, page, impressions, clicks, position이 있다.
2. [Claude Code] 칼럼 구조 초안을 만든다 — 무엇: Article heading, 요약, 핵심 답변, FAQ 화면 구조다. 왜: AI가 짧은 답변과 근거 문단을 같이 읽게 하기 위해서다. 어떻게: 기존 칼럼 템플릿에 맞춰 보이는 문단을 제안한다. 산출물: 콘텐츠팀 요청서. 검증: FAQPage는 실제 화면에 보이는 질문답변만 대상으로 한다. 의존성: 부분병렬, query 후보가 있으면 정확도가 높다.
3. [TJ] 건강 표현 수위를 승인한다 — 무엇: 효능, 검사, 치료, 질병 관련 표현의 사용 범위다. 왜: 건강 콘텐츠는 과장 표현 리스크가 크기 때문이다. 어떻게: 콘텐츠팀 요청서의 문구 예시를 보고 답한다. 산출물: 승인 또는 수정 지시. 검증: 금지 표현과 허용 표현이 기록된다. 의존성: 선행필수, 운영 게시 전 필요하다.

### Phase 4
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 검색 제출과 모니터링

- 목표: 반영한 URL과 구조를 Google, Naver, 내부 대시보드에서 추적한다.
- 왜 지금 해야 하는가: 개선 후 검색엔진이 언제 무엇을 다시 읽었는지 확인해야 한다.
- 산출물: 제출 체크리스트, 모니터링 대시보드 항목, 주간 점검 표.
- 완료 기준: 대표 URL 제출 상태, GSC 변화, 구조화 데이터 유효성, PageSpeed 변화가 주간 단위로 보인다.
- 다음 Phase에 주는 가치: 검색 유입 증가와 매출/상담 연결을 장기적으로 비교할 수 있다.

#### Phase4-Sprint10
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 제출과 모니터링
**상태**: 30% / 20%

- 무엇을 하는가: sitemap 제출, URL 검사, 구조화 데이터 테스트, 주간 GSC/PageSpeed 추적을 묶는다.
- 왜 필요한가: 운영에 반영해도 검색엔진이 읽지 않으면 효과가 늦거나 확인되지 않는다.
- 산출물: 제출 체크리스트, 주간 SEO 모니터링 표, 대시보드 연결 요청서.
- 우리 프로젝트에 주는 도움: SEO 작업이 실제 검색 노출과 전환에 어떤 변화를 만들었는지 볼 수 있다.

##### 역할 구분

- TJ: Search Console/Naver Search Advisor 로그인과 제출 승인
- Codex: 제출 체크리스트, GSC/PageSpeed 주간 측정, 대시보드 API 보강
- Claude Code: 대시보드 화면 보강이 필요할 때 참여

##### 실행 단계

1. [Codex] 제출 체크리스트를 만든다 — 완료. 무엇: 제출할 대표 URL, sitemap, 구조화 데이터 테스트 URL, 제외 URL이다. 왜: 제출 전에 잘못된 URL을 다시 밀어 넣는 것을 막기 위해서다. 어떻게: Phase2 정책과 Phase3 적용 결과를 대조했다. 산출물: `reports/seo/operation_change_checklist.md`. 검증: 운영 전 확인, 운영 반영 순서, rollback 기준이 있다.
2. [TJ] 검색 도구에서 제출한다 — 무엇: Google Search Console과 Naver Search Advisor의 sitemap 제출과 핵심 URL 검사 요청이다. 왜: 로그인과 2FA가 필요한 운영 계정 작업이기 때문이다. 어떻게: 체크리스트 순서대로 제출한다. 산출물: 제출 완료 기록. 검증: 제출 시각, 계정 화면 상태, 오류 여부가 기록된다. 의존성: 선행필수, 운영 계정 접근 필요.
3. [Codex] 주간 모니터링을 붙인다 — 무엇: GSC 클릭/노출/CTR/순위, 색인 오류, PageSpeed, 구조화 데이터 유효성이다. 왜: 개선 효과와 부작용을 빨리 발견하기 위해서다. 어떻게: 기존 GSC/PageSpeed 라우트와 대시보드 탭을 보강한다. 산출물: 주간 SEO 모니터링 표 또는 화면. 검증: 기준 시각, window, site, freshness, confidence가 함께 기록된다. 의존성: 부분병렬, 제출 전에도 baseline은 만들 수 있다.

#### Phase4-Sprint11
[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 내부 모니터링 화면 `/seo`
**상태**: 90% / 0%

- 무엇을 하는가: `reports/seo/*` 산출물을 한 화면에서 검토·복사·승인할 수 있는 내부 대시보드를 만든다.
- 왜 필요한가: 정적 MD/CSV로는 승인 게이트와 KPI를 한 눈에 보기 어렵고, 내부 의사결정 속도가 느려진다.
- 산출물: `frontend/src/app/seo/page.tsx`, `frontend/src/components/seo/*`, `frontend/src/app/seo/api/*` 5개 라우트.
- 우리 프로젝트에 주는 도움: 승인안 B/C 답변을 화면에서 바로 복사하고, JSON-LD 스니펫과 텍스트 블록을 콘텐츠팀·운영팀에 그대로 전달할 수 있다.

##### 역할 구분

- TJ: `/seo` 화면에서 승인안 B/C 답변, 운영 반영 체크리스트 점검
- Codex: 후속 reports 산출물 갱신 (사이드바·헤더·표가 이를 그대로 반영)
- Claude Code: 화면 컴포넌트와 API 라우트 구현·유지

##### 실행 단계

1. [Claude Code] `/seo` 라우트와 6개 섹션 컴포넌트 구현 — 완료. 무엇: 좌측 사이드바, 점수 헤더, Overview, URL 정책, JSON-LD, 상품 텍스트, 운영 체크리스트, 승인 현황. 왜: 정적 문서로는 한 눈에 볼 수 없기 때문이다. 어떻게: Next.js 16 App Router + Node.js runtime API 라우트 5개로 reports/seo/* 파싱. 산출물: `frontend/src/app/seo/page.tsx`, `frontend/src/components/seo/*`, `frontend/src/app/seo/api/*`. 검증: `npx tsc --noEmit` 통과, `npx eslint src/app/seo src/components/seo --max-warnings 0` 통과, `npx next build` 성공(routes 등록).
2. [TJ] dev 서버 재기동 후 `http://localhost:7010/seo` 진입 — 무엇: 6개 섹션 검토, 승인안 B/C에 답변. 왜: 화면 작동을 직접 보고 답변 흐름을 확정하기 위해서다. 어떻게: 기존 `next-server` 종료 후 `npm run dev -- --port 7010` 재시작 (현재 포트 7010에는 prod next-server 16530이 실행 중이라 새 라우트가 보이지 않음). 산출물: 승인 답변. 의존성: 선행필수.
3. [Claude Code] 후속 보강 (선택) — 무엇: GSC 라이브 데이터 합류, 감사 다시 돌리기 버튼, 구조화 데이터 유효성 자동 호출 연결. 왜: 정적 산출물 외 라이브 지표까지 한 화면에서 보기 위해서다. 어떻게: Phase4-Sprint10의 GSC/PageSpeed 라우트와 결합. 산출물: 추가 섹션 또는 KPI. 의존성: 부분병렬, baseline 화면이 안정화된 뒤 진행.

## 승인 필요 항목

### 승인안 A

추천안 A: 먼저 Phase1-Sprint1부터 Phase2-Sprint7까지 진행한다. 즉, 공개 URL 읽기 전용 진단과 JSON-LD 샘플 생성까지 승인하고, 아임웹 운영 반영은 아직 하지 않는다.

상태: Codex가 공개 URL 기준으로 이미 진행 완료. 운영 반영은 아직 하지 않았다.

제 추천: YES 유지
추천 자신감: 86%
이유: 공개 URL 진단, URL 정책 추천서, JSON-LD 샘플, 상품 텍스트 초안까지 운영 변경 없이 만들어졌다. 이제 승인 없이 더 밀 수 있는 범위는 제한적이고, 다음은 아임웹/검색도구 운영 판단이 필요하다.
부족 데이터: Search Console sitemap 제출 상태, GSC URL 검사에서 Google이 선택한 canonical, 아임웹 noindex/사용자 코드 삽입 가능 범위
답변 형식: `YES: 대표 URL 정책안 A로 운영 요청서 작성` 또는 `NO: 상품 URL은 기존 /HealthFood/?idx= 형태 유지`
YES 이후 Codex 작업: 운영 반영 체크리스트와 JSON-LD 삽입 코드 블록을 최종본으로 정리한다.

### 승인안 B ✅ 2026-04-28 완료

추천안 B: `reports/seo/url_policy_recommendations.md`의 정책안 A를 기준으로 운영 요청서를 만든다. 상품/검사권은 canonical 목적지와 JSON-LD url을 일치시키고, 리뷰/검색/로그인 계열은 sitemap 제외와 noindex 후보로 둔다.

**TJ 회신**: "승인안 B 운영팀이 그대로 작업할 수 있는 URL 정리 요청서 만들기 진행해" (2026-04-28)
**범위**: 정책안 A 전체 (제외 조건 없음)
**산출물**: `reports/seo/imweb_*.md/csv` 6종 (위 「2026-04-28 진행 (✅ 승인안 B 완료)」 섹션 참고)
**운영 영향**: 0 (요청서·CSV·MD 생성만. 실제 아임웹 반영은 별도 승인 필요)
**다음 단계**: robots.txt는 공개 적용 확인 완료. canonical/301은 아임웹에서 직접 제어가 어려우므로 GSC URL 검사로 추적한다. noindex, 사용자 코드, 상품 텍스트, JSON-LD는 별도 승인 뒤 진행한다.

추천 자신감: 78%

### 승인안 C

추천안 C: `reports/seo/product_text_block_drafts.md`의 상품 4개 텍스트 블록 초안을 콘텐츠팀 검토로 넘긴다.

제 추천: YES
추천 자신감: 72%
이유: 숨김 텍스트 없이 사용자에게 보이는 구조라 SEO 리스크가 낮다. 다만 건강·검사 표현은 운영 반영 전 최신 상품 상세와 표시 가능 문구를 맞춰야 한다.
부족 데이터: 각 상품의 최신 성분표, 검사 진행 방식, 표시 가능 효능 문구
답변 형식: `YES` 또는 `NO: 뉴로마스터는 제외`

### 승인안 D

추천안 D: 상품/검사권 4개에 `보이는 본문 텍스트 + Product/Breadcrumb/FAQ JSON-LD + GSC canonical 추적`을 묶은 SEO/AEO 운영 반영 패키지를 만든다.

상태: 2026-04-29 00:28 KST 문서 패키지 생성 완료. 실제 아임웹 게시와 Search Console 제출은 아직 하지 않았다.
제 추천: 완성 패키지 확인 후 아임웹 삽입 준비 진행
추천 자신감: 82%
이유: 아임웹 canonical 직접 제어보다 이 작업의 파급력이 크다. 상품 Product/Offer JSON-LD는 아임웹 자동 생성이 확인됐지만, 상품 상세가 이미지 의존이라 검색엔진과 AI가 읽을 수 있는 보이는 정보가 부족하다. 이 패키지는 아임웹을 유지해도 쓸 수 있고, 나중에 자체 구축으로 가도 그대로 이전할 수 있다.
생성 산출물: `reports/seo/seo_aeo_execution_package.md`, `reports/seo/gsc_canonical_check_matrix.md`
부족 데이터: 실제 아임웹 삽입 가능 메뉴, Search Console URL 검사 결과, 운영 게시 직전 가격/재고 최종 확인
다음 답변 형식: `YES: 완성 패키지 확인 완료, 아임웹 삽입 준비 진행` 또는 `NO: 완성 패키지 수정 필요`

### 운영 반영 전 별도 승인

| 승인 항목 | 왜 TJ 승인이 필요한가 | Codex 사전 시도 |
|---|---|---|
| 아임웹 noindex/사용자 코드/상품 상세 수정 | 검색 노출과 기존 공유 URL에 영향 | 공개 URL 진단과 정책 초안 작성 |
| GSC URL 검사 canonical 확인 | 운영 계정과 URL 검사 화면 접근 필요 | 검사할 URL 매트릭스 초안 작성 |
| GTM 또는 사용자 코드 게시 | 운영 사이트 스크립트가 바뀜 | JSON-LD 샘플과 테스트 코드 작성 |
| Search Console/Naver 제출 | 2FA 로그인과 운영 계정 필요 | 제출 URL 체크리스트 작성 |
| 상품 상세 텍스트 반영 | 브랜드 문구와 전환율에 영향 | 텍스트 구조 초안 작성 |
| 건강/검사 표현 확정 | 법무/브랜드 리스크 | 질문형 query와 문구 후보 정리 |

## 현재 병목

- 공개 URL 기준 숫자는 확보됐다.
- 아임웹에서 canonical 수동 변경과 301 redirect는 직접 제어하기 어렵다. 이 항목은 운영 작업이 아니라 GSC URL 검사로 추적한다.
- 상품 4개 SEO/AEO 최종 실행 패키지는 생성됐다.
- 아임웹 관리자에서 noindex, 사용자 코드 삽입, 상품 상세 텍스트 반영을 어디까지 제어할 수 있는지는 운영 화면에서 추가 확인이 필요하다.
- Search Console과 Naver Search Advisor 제출 상태는 로그인 확인이 필요하다.
- PageSpeed API 점수는 아직 측정하지 않았고, 이번 턴은 Playwright 리소스 관측으로 대체했다.

## 다음 액션

- 지금 당장: 완성 패키지를 확인한다. 추천 답변은 `YES: 완성 패키지 확인 완료, 아임웹 삽입 준비 진행`이다.
- 이번 주: 아임웹 삽입 가능 메뉴 확인, Rich Results Test 사전 검증, Search Console URL 검사 10개 기록을 진행한다.
- 승인 후: 사용자 코드 또는 상품 상세 텍스트를 운영에 반영한다. 7/14/28일 단위로 GSC KPI와 Google 선택 canonical을 비교한다.

## 개발 부록

| 산출물 이름 | 파일 경로 후보 | 설명 |
|---|---|---|
| URL 장부 | `reports/seo/url_inventory.csv` | 내부 URL, 정규화 URL, 유형, 상태 코드, 중복 그룹 |
| robots/sitemap 진단서 | `reports/seo/robots_sitemap_audit.md` | sitemap 응답, URL 수, 제외 후보 |
| 페이지 SEO 점검표 | `reports/seo/page_seo_audit.csv` | title, description, canonical, robots meta, OG, heading, JSON-LD |
| 페이지 SEO 보고서 | `reports/seo/page_seo_audit.md` | 비개발자용 요약 |
| canonical 위험 보고서 | `reports/seo/canonical_duplicate_risk.md` | 중복 URL과 대표 URL 추천 |
| 중복 그룹 장부 | `reports/seo/duplicate_url_groups.csv` | 중복 의심 그룹별 URL |
| 상품 본문 진단서 | `reports/seo/product_detail_content_audit.md` | 텍스트/이미지/alt 의존 영역 |
| JSON-LD 추천서 | `reports/seo/jsonld_recommendations.md` | 삽입 방식과 위험 |
| JSON-LD 샘플 | `reports/seo/jsonld_samples/` | Product, Article, Organization, Breadcrumb 샘플 |
| 속도 진단서 | `reports/seo/performance_resource_audit.md` | PageSpeed와 큰 리소스 목록 |
| 최종 요약 | `reports/seo/seo_audit_summary.md` | 점수, 문제 5개, 오늘/이번 주/다음 배치 할 일 |
| 실행 표 | `reports/seo/action_plan.csv` | priority, owner, impact, difficulty, evidence |
| 개발팀 요청서 | `reports/seo/dev_team_request.md` | 아임웹/코드 수정 요청 |
| 콘텐츠팀 요청서 | `reports/seo/content_team_request.md` | 상품 상세와 칼럼 문구 요청 |
| 대표 URL 정책 추천서 | `reports/seo/url_policy_recommendations.md` | canonical, sitemap, noindex 운영 정책 초안 |
| 대표 URL 정책 매트릭스 | `reports/seo/url_policy_matrix.csv` | 유형별 대표 URL 후보와 confidence |
| JSON-LD 검증 매트릭스 | `reports/seo/jsonld_validation_matrix.md` | 페이지별 권장 schema와 막힌 점 |
| 상품 텍스트 블록 초안 | `reports/seo/product_text_block_drafts.md` | 상품 4개 H2/H3/FAQ 초안 |
| 상품 텍스트 매트릭스 | `reports/seo/product_text_block_matrix.csv` | 상품 4개 검색 의도와 문구 구조 |
| JSON-LD 삽입 스니펫 | `reports/seo/jsonld_insertion_snippets.md` | 아임웹/GTM 게시 전 검증용 `<script>` 초안 |
| 상품 4개 SEO/AEO 최종 실행 패키지 | `reports/seo/seo_aeo_execution_package.md` | 본문 텍스트, JSON-LD, 삽입 방법, 롤백 기준 |
| GSC canonical 검사 매트릭스 | `reports/seo/gsc_canonical_check_matrix.md` | Search Console URL 검사 10개 기록표 |
| 운영 반영 체크리스트 | `reports/seo/operation_change_checklist.md` | 승인 전 확인, 운영 반영 순서, rollback 기준 |
| 읽기 전용 감사 스크립트 | `backend/scripts/seo-readonly-audit.mjs` | 공개 URL 감사 자동 생성 |
| 후속 패키지 스크립트 | `backend/scripts/seo-followup-pack.mjs` | URL 정책과 상품 텍스트 초안 생성 |
| 내부 SEO 대시보드 | `frontend/src/app/seo/page.tsx` (+ `components/seo/*`, `app/seo/api/*`) | reports/seo/* 산출물 + GSC 라이브 KPI를 한 화면에서 확인·복사·승인 |
| 프론트 메뉴 계획 | `seo/!frontmenu.md` | `/seo` 정보 구조·라우트·API·검증 체크리스트 |
| 라이브 GSC KPI 카드 | `frontend/src/components/seo/LiveGscSection.tsx` | 클릭/노출/CTR/평균순위 4종 + 7일 sparkline |
| 인라인 설명 부품 | `frontend/src/components/seo/{WhyCallout,Glossary}.tsx` | 섹션 안내문 + 용어 정의 팝오버 |
| /seo 스크린샷 자동화 | `backend/scripts/seo-page-screenshots.mjs` | Playwright로 7개 섹션 + full page 캡처 → `seo/screnshot/` 저장 |

## 점수 기준

| 항목 | 배점 | 측정 기준 |
|---|---:|---|
| URL/Canonical | 20점 | 대표 URL 일치, 중복 URL 위험, 내부 링크 정리 |
| Indexing/Sitemap/Robots | 15점 | sitemap 정상 응답, 색인 제외 URL, 제출 상태 |
| On-page SEO | 20점 | title, description, heading, OG, robots meta |
| Structured Data | 15점 | Product, Article, Organization, BreadcrumbList, FAQPage |
| Content Readability for Search/AI | 15점 | HTML 본문 핵심 문장, 통이미지 의존도, FAQ 구조 |
| Performance | 15점 | 모바일 PageSpeed, LCP, CLS, 이미지/스크립트 용량 |
