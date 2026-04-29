# GSC URL 검사 canonical 매트릭스

작성 시각: 2026-04-29 00:28 KST  
기준일: 2026-04-29  
Source: `reports/seo/imweb_canonical_targets.csv`, `reports/seo/url_inventory.csv`, 아임웹 canonical 수동 변경 불가 답변  
Freshness: 2026-04-29 00:28 KST  
Confidence: 80%

## 10초 요약

아임웹에서는 canonical과 301 redirect를 직접 제어하기 어렵다. 따라서 Google Search Console의 URL 검사에서 Google이 실제로 선택한 canonical을 기록해야 한다. 아래 10개 URL은 상품 4개 SEO/AEO 패키지 반영 전 기준선으로 먼저 확인한다.

## 기록 방법

1. Google Search Console에 접속한다.
2. 상단 URL 검사 입력창에 아래 URL을 하나씩 넣는다.
3. `사용자가 선언한 표준 URL`과 `Google이 선택한 표준 URL`을 기록한다.
4. 결과 화면 캡처가 가능하면 캡처 파일명을 함께 남긴다.
5. 운영 반영 후 7일, 14일, 28일에 같은 URL을 다시 확인한다.

## 검사표

| 순서 | 검사 대상 | URL | 기대값 | 왜 필요한가 | 자신감 | 현재 기록 |
|---:|---|---|---|---|---:|---|
| 1 | 홈 대표 URL | `https://biocom.kr/` | Google 선택 canonical도 홈 | 브랜드 신호 기준 URL | 88% | 미확인 |
| 2 | 홈 `/index` 별칭 | `https://biocom.kr/index` | 홈으로 모이는지 확인 | 301 직접 제어 불가 보완 | 82% | 미확인 |
| 3 | 종합 대사기능 분석 공식 URL | `https://biocom.kr/organicacid_store/?idx=259` | 공식 URL 또는 Google 선택 URL 기록 | `/shop_view` 변형 존재 | 78% | 미확인 |
| 4 | 종합 대사기능 분석 shop_view 변형 | `https://biocom.kr/shop_view/?idx=259` | 공식 URL과 같은 상품으로 처리되는지 확인 | 자동 생성 URL 영향 확인 | 76% | 미확인 |
| 5 | 음식물 과민증 공식 URL | `https://biocom.kr/igg_store/?idx=85` | 공식 URL 또는 Google 선택 URL 기록 | 검사권 핵심 페이지 | 78% | 미확인 |
| 6 | 음식물 과민증 shop_view 변형 | `https://biocom.kr/shop_view/?idx=85` | 공식 URL과 같은 상품으로 처리되는지 확인 | 자동 canonical 한계 확인 | 76% | 미확인 |
| 7 | 바이오밸런스 공식 URL | `https://biocom.kr/HealthFood/?idx=97` | 같은 URL 선택 | 영양제 대표 시범 상품 | 84% | 미확인 |
| 8 | 바이오밸런스 shop_view 변형 | `https://biocom.kr/shop_view/?idx=97` | HealthFood URL로 모이는지 확인 | 변형 URL 노출 분산 확인 | 78% | 미확인 |
| 9 | 뉴로마스터 공식 URL | `https://biocom.kr/HealthFood/?idx=198` | 같은 URL 선택 | 신규 Product JSON-LD 기준 URL | 82% | 미확인 |
| 10 | 건강정보 칼럼 시범 URL | `https://biocom.kr/healthinfo/?bmode=view&idx=5764202` | 칼럼 URL의 canonical 기록 | Article/AEO 확장 기준 URL | 80% | 미확인 |

## 판정 기준

| 결과 | 판단 | 다음 행동 |
|---|---|---|
| 핵심 상품 4개 모두 의도한 URL 또는 같은 상품군 URL로 선택 | 정상 | JSON-LD와 본문 텍스트 반영 진행 |
| 핵심 상품 1~2개에서 다른 URL 선택 | 주의 | 내부 링크와 sitemap 노출 상태를 재확인 |
| 핵심 상품 3개 이상에서 다른 URL 선택 | 위험 | 아임웹 한계가 검색 성과에 영향을 줄 수 있으므로 자체 랜딩 또는 플랫폼 전환 우선순위 상승 |

