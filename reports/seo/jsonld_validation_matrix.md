# JSON-LD 검증 매트릭스

작성 시각: 2026-04-27 23:04 KST
재확인: 2026-04-29 KST 공개 HTML 읽기 전용 확인
기준일: 2026-04-29
Source: `reports/seo/page_seo_audit.csv`, 공개 HTML 재확인, Google Rich Results Test 공유 결과, `reports/seo/jsonld_samples/*`
Freshness: 2026-04-29 KST
Confidence: 92%

## 10초 요약

2026-04-27 최초 감사 CSV에는 핵심 페이지 JSON-LD가 0개로 기록됐지만, 2026-04-29 공개 HTML 재확인 결과 아임웹 자동 JSON-LD가 이미 확인된다. 특히 `종합 대사기능 분석` 상품은 Product, Offer, AggregateRating, Review가 Rich Results Test에 잡힌다. 따라서 현재 작업은 “Product JSON-LD를 0에서 신규 삽입”이 아니라 “아임웹 자동 스키마와 실제 화면 값이 맞는지 확인하고, 중복 충돌이 적은 BreadcrumbList/FAQPage/ItemList/WebSite를 보강할지 판단”하는 방향으로 조정한다.

## 페이지별 권장 schema

| 페이지 | URL | 현재 JSON-LD | 권장 작업 | 현재 상태 | 자신감 |
| --- | --- | --- | --- | --- | --- |
| 홈페이지 | https://biocom.kr/ | 21 | 기존 OnlineStore 유지, WebSite 보강 검토 | 공개 HTML 기준 아임웹 자동 OnlineStore/ImageObject JSON-LD 확인. WebSite SearchAction은 보강 후보. | 92% |
| 서비스 | https://biocom.kr/service | 14 | 기존 OnlineStore 유지, WebPage/BreadcrumbList 보강 검토 | 공개 HTML 기준 아임웹 자동 공통 JSON-LD 확인. 서비스 페이지 전용 WebPage/BreadcrumbList는 보강 후보. | 92% |
| 종합 대사기능 분석 상품 | https://biocom.kr/organicacid_store/?idx=259 | 4 | 기존 Product/Offer/AggregateRating/Review 유지, BreadcrumbList/FAQPage 보강 검토 | 공개 HTML 기준 아임웹 자동 Product JSON-LD 확인. 신규 Product 중복 삽입 금지. canonical은 `/shop_view/?idx=259`. | 94% |
| 바이오밸런스 상품 | https://biocom.kr/HealthFood/?idx=97 | 5 | 기존 Product/Offer/AggregateRating/Review 유지, BreadcrumbList/FAQPage 보강 검토 | 공개 HTML 기준 아임웹 자동 Product JSON-LD 확인. 신규 Product 중복 삽입보다 값 일치 확인 우선. | 94% |
| 건강정보 목록 | https://biocom.kr/healthinfo | 3 | 기존 공통 JSON-LD 유지 및 ItemList/CollectionPage 보강 검토 | 공개 HTML 기준 공통 JSON-LD 확인. 목록 자체를 설명하는 ItemList는 보강 후보. | 90% |
| 건강정보 글 | https://biocom.kr/healthinfo/?bmode=view&idx=5764202 | 4 | 기존 NewsArticle/WebPage 유지, BreadcrumbList 보강 검토 | 공개 HTML 기준 NewsArticle/WebPage JSON-LD 확인. 작성자/이미지/요약 값 일치 확인 우선. | 92% |

## 운영 반영 전 체크

1. 기존 아임웹 자동 JSON-LD의 상품명, 가격, 이미지, 후기 수가 실제 화면과 일치하는지 확인한다.
2. Product/Offer가 이미 있는 상품 페이지에는 같은 Product/Offer JSON-LD를 중복 삽입하지 않는다.
3. FAQPage는 실제 화면에 보이는 질문/답변만 넣는다.
4. BreadcrumbList의 URL은 Google 선택 canonical과 대표 URL 정책을 먼저 맞춘다.
5. 보강 코드는 게시 전후 Google Rich Results Test 또는 Schema Markup Validator로 재검증한다.
