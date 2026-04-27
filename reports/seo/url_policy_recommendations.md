# 대표 URL 정책 추천서

작성 시각: 2026-04-27 23:04 KST
기준일: 2026-04-27
Source: `reports/seo/url_inventory.csv`, `reports/seo/page_seo_audit.csv`
Freshness: 2026-04-27 23:04 KST
Confidence: 78%

## 10초 요약

대표 URL 정책은 운영 반영 전 승인용 초안이다. 현재 sitemap은 parameter URL을 포함하지 않지만, 내부 링크와 최종 URL에는 `?idx=`, `?q=`, 리뷰 board URL이 섞여 있다. 우선 canonical, sitemap, 내부 링크, noindex를 같은 표로 확정해야 한다.

## 추천 정책표

| 유형 | 대표 URL 후보 | canonical 정책 | sitemap | noindex | 다음 작업 | 자신감 |
| --- | --- | --- | --- | --- | --- | --- |
| home | https://biocom.kr/ | 홈은 https://biocom.kr/ 하나로 고정 | 포함 | 색인 허용 | index, mode 파라미터 URL은 canonical을 홈으로 보내고 sitemap 제외 | 86% |
| service/category | https://biocom.kr/service | 서비스 소개 대표 URL 유지 | 포함 | 색인 허용 | title/description 보강, h1 추가 필요 | 78% |
| lab/test service | https://biocom.kr/organicacid_store/?idx=259 | 현재 canonical인 /shop_view/?idx=259 또는 최종 상품 URL 중 하나로 통일 | 대표 URL만 포함 | 색인 허용 | 내부 링크, sitemap, canonical 목적지를 같은 URL로 맞춤 | 74% |
| lab/test service | https://biocom.kr/igg_store/?idx=85 | 음식물 과민증 분석 대표 URL 1개로 통일 | 대표 URL만 포함 | 색인 허용 | canonical 목적지 확인 후 내부 구매 링크 정리 | 72% |
| product | https://biocom.kr/HealthFood/?idx=97 | 상품 상세 대표 URL 1개로 통일 | 대표 URL만 포함 | 색인 허용 | Product JSON-LD와 canonical 목적지 URL 일치 | 80% |
| product | https://biocom.kr/HealthFood/?idx=198 | 상품 상세 대표 URL 유지 | 대표 URL만 포함 | 색인 허용 | Product JSON-LD 시범 대상에 포함 | 76% |
| article/column | https://biocom.kr/healthinfo/?bmode=view&idx=5764202 | 글 상세는 idx별 canonical 유지 | 상위 칼럼과 주요 글만 포함 | 색인 허용 | Article JSON-LD와 h1/description 길이 정리 | 78% |
| review/board | 상품 상세 페이지 | 개별 리뷰 URL은 상품 상세나 리뷰 목록으로 정리 | 제외 | noindex 권장 | 검색 결과에 리뷰 잡음 URL이 뜨는지 GSC로 확인 | 70% |
| cart/login/member | 색인 대상 아님 | 필요 없음 | 제외 | noindex 권장 | robots 차단과 meta robots 병행 가능 여부 확인 | 84% |
| search/filter | 색인 대상 아님 | 상위 목록이나 홈으로 통일 | 제외 | noindex 권장 | 내부 페이지네이션과 검색 결과 링크가 sitemap에 들어가지 않도록 유지 | 82% |

## 바로 고칠 수 있는 것

1. robots.txt의 sitemap 지시문 중 Markdown 링크 형식 줄을 일반 URL 한 줄로 바꾼다.
2. `?q=...`, `interlock=shop_review`, `t=board` URL은 sitemap 제외와 noindex 후보로 둔다.
3. 상품 URL은 Product JSON-LD의 `url`과 canonical 목적지가 같아야 한다.
4. `/organicacid`, `/organicacid_store`, `/organicacid_store/?idx=259`, `/shop_view/?idx=259` 중 운영 대표 URL 1개를 정한다.

## 승인 요청

추천안 A: 상품/검사권은 현재 canonical이 가리키는 목적지를 기준으로 대표 URL을 맞추고, 리뷰/검색/로그인 계열은 noindex와 sitemap 제외로 정리한다.

제 추천: YES  
추천 자신감: 78%  
부족 데이터: Search Console 색인 URL 목록, 아임웹 관리자 canonical 제어 범위  
답변 형식: `YES` 또는 `NO: 상품 URL은 기존 /HealthFood/?idx= 형태 유지`
