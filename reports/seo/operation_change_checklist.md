# SEO 운영 반영 체크리스트

작성 시각: 2026-04-27 23:04 KST
기준일: 2026-04-27
Source: 공개 URL 감사 산출물 전체
Freshness: 2026-04-27 23:04 KST
Confidence: 76%

## 10초 요약

이 문서는 운영 적용 순서다. 아직 승인 전이므로 실제 아임웹, GTM, Search Console, Naver Search Advisor에는 아무것도 게시하지 않는다.

## 운영 전 확인

| 순서 | 담당 | 작업 | 산출물 | 완료 기준 |
|---|---|---|---|---|
| 1 | TJ | 승인안 B 답변 | 대표 URL 정책 승인 | `YES` 또는 수정사항 |
| 2 | TJ | 승인안 C 답변 | 상품 텍스트 초안 승인 | `YES` 또는 제외 상품 |
| 3 | Codex | 대표 URL 최종표 작성 | 운영 요청서 | canonical, sitemap, noindex가 한 표에 있음 |
| 4 | Codex | JSON-LD 최종본 작성 | 삽입 스니펫 | 대표 URL과 JSON-LD url 일치 |
| 5 | Claude Code | 상품 상세 텍스트 UI 시안 | PC/모바일 시안 | 숨김 텍스트 없음 |
| 6 | TJ | 아임웹 또는 GTM 게시 승인 | 운영 반영 결정 | 게시 범위와 rollback 확인 |

## 운영 반영 순서

1. robots.txt의 Markdown sitemap 줄을 일반 URL 형식으로 고친다.
2. 리뷰/검색/로그인 계열 URL은 sitemap 제외와 noindex 가능 여부를 확인한다.
3. 상품/검사권 대표 URL 정책을 확정한다.
4. Product/Article/Organization/BreadcrumbList JSON-LD를 시범 페이지에 넣는다.
5. 상품 4개 텍스트 블록을 PC/모바일에서 보이게 넣는다.
6. Search Console과 Naver Search Advisor에서 sitemap과 핵심 URL을 다시 제출한다.
7. 7일 단위로 GSC 클릭, 노출, CTR, 순위, 색인 오류를 비교한다.

## 롤백 기준

- 상품 상세 전환율이 의미 있게 하락하면 텍스트 블록 노출 위치를 되돌린다.
- 구조화 데이터 테스트에서 오류가 나오면 JSON-LD만 제거한다.
- Search Console에서 색인 제외가 늘면 noindex 대상 URL을 다시 확인한다.
