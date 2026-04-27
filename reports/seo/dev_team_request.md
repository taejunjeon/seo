# 개발팀 요청서

작성 시각: 2026-04-27 21:17 KST
기준일: 2026-04-27

## 2줄 요약

바이오컴 SEO의 1차 개발 요청은 canonical, sitemap, JSON-LD, 내부 링크를 대표 URL 기준으로 맞추는 것이다. 운영 반영 전에는 아래 evidence 파일과 URL 정책표를 확인해야 한다.

## 요청사항

1. `reports/seo/canonical_duplicate_risk.md`의 중복 의심 그룹을 보고 대표 URL을 확정한다.
2. `reports/seo/robots_sitemap_audit.md`의 sitemap 제외 후보를 확인한다.
3. Product/Article/Breadcrumb JSON-LD 삽입 가능 위치를 확인한다.
4. 운영 반영 전 rollback 방법을 정한다.

## 근거 파일

- `reports/seo/url_inventory.csv`
- `reports/seo/page_seo_audit.csv`
- `reports/seo/duplicate_url_groups.csv`
- `reports/seo/jsonld_recommendations.md`
