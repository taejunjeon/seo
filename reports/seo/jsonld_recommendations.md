# JSON-LD 추천서

작성 시각: 2026-04-27 21:17 KST
기준일: 2026-04-27
Source: 공개 페이지에서 추출한 title, description, og:image, 가격 후보
Freshness: 2026-04-27 21:17 KST
Confidence: 74%

## 10초 요약

JSON-LD 샘플은 운영 삽입용 최종본이 아니라 개발팀 검토용 초안이다. 실제 운영 반영 전에는 화면에 보이는 값과 1:1로 맞는지 다시 확인해야 한다.

## 생성 샘플

- `reports/seo/jsonld_samples/product_organicacid.json`
- `reports/seo/jsonld_samples/product_biobalance.json`
- `reports/seo/jsonld_samples/article_health_goal.json`
- `reports/seo/jsonld_samples/organization_biocom.json`
- `reports/seo/jsonld_samples/breadcrumb_examples.json`

## 삽입 방식 판단

| 방식 | 장점 | 위험 | 추천 |
|---|---|---|---|
| 아임웹 직접 삽입 | 페이지별 값 관리가 명확함 | 관리자 제어 범위 확인 필요 | 1순위 |
| 사용자 코드/GTM 삽입 | 빠르게 테스트 가능 | 가격/후기 같은 동적 값 불일치 위험 | 테스트용 |
| 서버 렌더링 | 가장 안정적 | 아임웹 기반에서는 적용 범위 제한 | 현재 보류 |

## 주의

AggregateRating과 Review는 실제 화면에 평점과 리뷰 값이 보일 때만 넣는다. 보이지 않는 값을 추정해서 넣지 않는다.
