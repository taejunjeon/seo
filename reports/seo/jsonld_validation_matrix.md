# JSON-LD 검증 매트릭스

작성 시각: 2026-04-27 23:04 KST
기준일: 2026-04-27
Source: `reports/seo/page_seo_audit.csv`, `reports/seo/jsonld_samples/*`
Freshness: 2026-04-27 23:04 KST
Confidence: 80%

## 10초 요약

핵심 페이지 6개는 현재 JSON-LD가 0개다. Product, Article, Organization, WebSite, BreadcrumbList를 페이지 유형에 맞춰 시범 삽입할 수 있다. 운영 반영 전에는 Google Rich Results Test 또는 Schema Markup Validator로 샘플을 재검증해야 한다.

## 페이지별 권장 schema

| 페이지 | URL | 현재 JSON-LD | 권장 schema | 막힌 점 | 자신감 |
| --- | --- | --- | --- | --- | --- |
| 홈페이지 | https://biocom.kr/ | 0 | Organization, WebSite | 현재 JSON-LD 없음 | 88% |
| 서비스 | https://biocom.kr/service | 0 | WebPage, BreadcrumbList | 현재 JSON-LD 없음 | 88% |
| 종합 대사기능 분석 상품 | https://biocom.kr/organicacid_store/?idx=259 | 0 | Product, Offer, BreadcrumbList | 현재 JSON-LD 없음 | 88% |
| 바이오밸런스 상품 | https://biocom.kr/HealthFood/?idx=97 | 0 | Product, Offer, BreadcrumbList | 현재 JSON-LD 없음 | 88% |
| 건강정보 목록 | https://biocom.kr/healthinfo | 0 | ItemList 또는 CollectionPage | 현재 JSON-LD 없음 | 88% |
| 건강정보 글 | https://biocom.kr/healthinfo/?bmode=view&idx=5764202 | 0 | Article, BreadcrumbList | 현재 JSON-LD 없음 | 88% |

## 운영 반영 전 체크

1. JSON 샘플이 문법상 유효한지 확인한다.
2. 실제 화면에 보이는 값만 JSON-LD에 넣는다.
3. 가격과 후기 수는 자동 갱신이 어렵다면 1차 샘플에서 제외하거나 운영자가 관리 가능한 방식으로 넣는다.
4. BreadcrumbList의 URL은 대표 URL 정책과 일치해야 한다.
