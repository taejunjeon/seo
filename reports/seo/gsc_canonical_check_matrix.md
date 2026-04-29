# GSC URL 검사 canonical 매트릭스

작성 시각: 2026-04-29 00:28 KST  
최근 업데이트: 2026-04-29 KST (Search Console URL Inspection API 10건 자동 확인 반영)
기준일: 2026-04-29  
Source: `reports/seo/imweb_canonical_targets.csv`, `reports/seo/url_inventory.csv`, 아임웹 canonical 수동 변경 불가 답변  
Freshness: 2026-04-29 KST
Confidence: 90%

## 10초 요약

아임웹에서는 canonical과 301 redirect를 직접 제어하기 어렵다. 따라서 Google Search Console의 URL 검사에서 Google이 실제로 선택한 canonical을 기록해야 한다. 2026-04-29 기준 URL Inspection API로 10개 URL을 확인했고, 홈 `/index`는 Google이 홈으로 통합한다. 반면 검사권 2개는 공식 스토어 URL이 아니라 `/shop_view/?idx=...` 쪽을 Google 선택 canonical로 보고 있다. 특히 음식물 과민증 공식 URL은 `NOINDEX` 태그로 제외 상태라 우선 확인이 필요하다.

## 기록 방법

1. 내부 대시보드 `/seo#p0-confirm`에서 URL Inspection API 자동 결과를 확인한다.
2. `확인 필요` 또는 `위험` 행만 Google Search Console 화면에서 같은 URL을 직접 열어 캡처한다.
3. `사용자가 선언한 표준 URL`과 `Google이 선택한 표준 URL`이 다르면 내부 링크, sitemap, 아임웹 상담 항목으로 남긴다.
4. 운영 반영 후 7일, 14일, 28일에 같은 URL을 다시 확인한다.

## 검사표

| 순서 | 검사 대상 | URL | 기대값 | 왜 필요한가 | 자신감 | 현재 기록 |
|---:|---|---|---|---|---:|---|
| 1 | 홈 대표 URL | `https://biocom.kr/` | Google 선택 canonical도 홈 | 브랜드 신호 기준 URL | 88% | 정상 · 선언/Google 모두 `https://biocom.kr/` · 색인 PASS |
| 2 | 홈 `/index` 별칭 | `https://biocom.kr/index` | 홈으로 모이는지 확인 | 301 직접 제어 불가 보완 | 82% | 정상 · 선언 `https://biocom.kr/index`, Google `https://biocom.kr/` · 중복 페이지로 홈 선택 |
| 3 | 종합 대사기능 분석 공식 URL | `https://biocom.kr/organicacid_store/?idx=259` | 공식 URL 또는 Google 선택 URL 기록 | `/shop_view` 변형 존재 | 78% | 확인 필요 · 선언/Google 모두 `https://biocom.kr/shop_view/?idx=259` · 공식 URL은 대체 페이지 |
| 4 | 종합 대사기능 분석 shop_view 변형 | `https://biocom.kr/shop_view/?idx=259` | 공식 URL과 같은 상품으로 처리되는지 확인 | 자동 생성 URL 영향 확인 | 76% | 확인 필요 · 선언/Google 모두 `https://biocom.kr/shop_view/?idx=259` · 색인 PASS |
| 5 | 음식물 과민증 공식 URL | `https://biocom.kr/igg_store/?idx=85` | 공식 URL 또는 Google 선택 URL 기록 | 검사권 핵심 페이지 | 78% | 위험 · `NOINDEX` 태그로 제외 · 선언/Google 모두 `https://biocom.kr/shop_view/?idx=85` |
| 6 | 음식물 과민증 shop_view 변형 | `https://biocom.kr/shop_view/?idx=85` | 공식 URL과 같은 상품으로 처리되는지 확인 | 자동 canonical 한계 확인 | 76% | 확인 필요 · 선언/Google 모두 `https://biocom.kr/shop_view/?idx=85` · 색인 PASS |
| 7 | 바이오밸런스 공식 URL | `https://biocom.kr/HealthFood/?idx=97` | 같은 URL 선택 | 영양제 대표 시범 상품 | 84% | 정상 · 선언/Google 모두 `https://biocom.kr/HealthFood/?idx=97` · 색인 PASS |
| 8 | 바이오밸런스 shop_view 변형 | `https://biocom.kr/shop_view/?idx=97` | HealthFood URL로 모이는지 확인 | 변형 URL 노출 분산 확인 | 78% | 정상 · 선언/Google 모두 `https://biocom.kr/HealthFood/?idx=97` · 변형이 대표 URL로 모임 |
| 9 | 뉴로마스터 공식 URL | `https://biocom.kr/HealthFood/?idx=198` | 같은 URL 선택 | 신규 Product JSON-LD 기준 URL | 82% | 정상 · 선언/Google 모두 `https://biocom.kr/HealthFood/?idx=198` · 색인 PASS |
| 10 | 건강정보 칼럼 시범 URL | `https://biocom.kr/healthinfo/?bmode=view&idx=5764202` | 칼럼 URL의 canonical 기록 | Article/AEO 확장 기준 URL | 80% | 정상 · 선언/Google 모두 해당 칼럼 URL · 색인 PASS |

## 판정 기준

| 결과 | 판단 | 다음 행동 |
|---|---|---|
| 핵심 상품 4개 모두 의도한 URL 또는 같은 상품군 URL로 선택 | 정상 | JSON-LD와 본문 텍스트 반영 진행 |
| 핵심 상품 1~2개에서 다른 URL 선택 | 주의 | 내부 링크와 sitemap 노출 상태를 재확인 |
| 핵심 상품 3개 이상에서 다른 URL 선택 | 위험 | 아임웹 한계가 검색 성과에 영향을 줄 수 있으므로 자체 랜딩 또는 플랫폼 전환 우선순위 상승 |

## 음식물 과민증 공식 URL noindex 상세

### 현재 확인값

| URL | 공개 HTML robots meta | 공개 HTML canonical | GSC 상태 | 판단 |
|---|---|---|---|---|
| `https://biocom.kr/igg_store/?idx=85` | `<meta name='robots' content='noindex, nofollow' />` | `https://biocom.kr/shop_view/?idx=85` | `NOINDEX` 태그로 제외 | 우선 확인 필요 |
| `https://biocom.kr/shop_view/?idx=85` | 없음 | `https://biocom.kr/shop_view/?idx=85` | 색인 PASS | 현재 Google 기준 대표 URL |

### 원인 후보

1. 가장 가능성이 높은 원인: `/igg_store` 메뉴 또는 페이지의 SEO 설정에서 `검색엔진 색인 차단(noindex)`이 켜져 있음. 같은 상품의 `/shop_view`에는 noindex가 없기 때문에 상품 전체 설정보다는 메뉴/페이지 설정 가능성이 높다.
2. 중간 가능성: 상품 idx=85의 진열/판매/숨김 상태가 일부 URL에 다르게 반영됨. 다만 `/shop_view/?idx=85`가 색인 PASS라서 1순위 원인으로 보기는 어렵다.
3. 낮은 가능성: Header Code, Body Code, GTM 같은 사용자 코드가 `igg_store` 또는 `idx=85` 조건으로 robots meta를 삽입함.

### 운영 판단

상품 자체를 검색에서 숨길 의도가 아니라면 `/igg_store/?idx=85`의 noindex를 해제하거나, Google이 이미 선택한 `/shop_view/?idx=85`를 음식물 과민증의 기준 URL로 인정해야 한다. 어느 쪽이든 JSON-LD의 `url`, 내부 링크, Search Console 제출 URL을 같은 주소로 맞춰야 한다.
