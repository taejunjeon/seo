# 더클린커피 SEO 문안 초안 — 방탄커피 허브 + 원두 상품

작성 시각: 2026-05-13 14:48 KST  
작성자: Codex  
상태: 초안 작성 완료, Imweb 게시 안 함

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
  required_context_docs:
    - docurule.md
    - gdn/coffee-gsc-seo-keyword-top100-report-20260513.md
    - data/coffee-gsc-seo-keyword-top100-20260513.json
  lane: Green
  allowed_actions:
    - Search Console read-only query
    - public page read-only crawl
    - local draft document creation
    - validation
  forbidden_actions:
    - Imweb publish
    - Imweb footer/header change
    - 운영DB write
    - VM Cloud SQLite write
    - GA4/Google Ads/Meta/TikTok/Naver send or upload
    - GTM publish
    - production deploy
  source_window_freshness_confidence:
    search_console_source: Google Search Console Search Analytics API
    search_console_window: 2025-05-13..2026-05-10
    public_page_source: https://thecleancoffee.com public HTML
    checked_at: 2026-05-13 14:48 KST
    confidence: high for draft direction; publish requires Imweb page owner check
```

## 10초 요약

이번 문서는 더클린커피 홈페이지에 바로 붙일 수 있는 SEO 문안 초안이다. 아직 게시하지 않았다.

가장 먼저 손볼 곳은 `방탄커피` 페이지다. Search Console 기준 `방탄커피`는 23,457노출 / CTR 0.84% / 평균 4.54위라, 순위는 이미 괜찮지만 클릭 문구가 약하다.

상품 쪽은 `케냐 원두`, `과테말라 SHB`는 현재 상품과 검색어가 잘 맞는다. 반면 `예가체프/아리차`는 과거 Search Console URL과 현재 공개 상품 URL이 엇갈려, 게시 전에 실제 판매 상품과 canonical을 먼저 맞춰야 한다.

## 현재 근거

| 구분 | 현재 페이지 | 확인한 현재 title / 상태 | Search Console 근거 |
|---|---|---|---|
| 방탄커피 허브 | `https://thecleancoffee.com/bulletproofcoffee` | `방탄커피 만들기 레시피` | `방탄커피` 196클릭 / 23,457노출 / CTR 0.84% / 평균 4.54위 |
| 방탄커피 상품 | `https://thecleancoffee.com/thecleancoffee/?idx=75` | `더클린 방탄커피 곰팡이독소 ZERO...` | 리뷰/상품 CTA 연결 후보 |
| 예가체프/아리차 | 과거 GSC: `thecleancoffee_store/?idx=1`, 현재 후보: `shop_view/62` | `shop_view/62`는 예가체프/아리차 title 보유, canonical은 `/subscription/?idx=62` | 예가체프/아리차 묶음 58클릭 / 7,205노출 |
| 케냐 원두 | `https://thecleancoffee.com/thecleancoffee/?idx=8` | `케냐 원두 캉고초 AA 스페셜티...` | 11클릭 / 2,198노출 |
| 과테말라 SHB | `https://thecleancoffee.com/thecleancoffee/?idx=30` | `과테말라 쿠에비스타 SHB...` | main 후보 2클릭 / 77노출, 과거/중복 URL 주의 |

주의할 점은 두 가지다.

1. `예가체프/아리차` 검색 수요를 현재 `에티오피아 구지 사키소` 상품에 억지로 넣으면 안 된다. 상품이 실제 예가체프/아리차가 아닐 경우 검색어와 상품이 어긋난다.
2. 건강·다이어트 표현은 과장하면 안 된다. `효능`, `대사`, `감량` 같은 표현은 정보 설명 수준으로 두고, 치료·감량 보장처럼 보이는 문장은 피한다.

## 방탄커피 허브 페이지 초안

### 적용 후보 페이지

- 현재 URL: `https://thecleancoffee.com/bulletproofcoffee`
- 현재 title: `방탄커피 만들기 레시피`
- 현재 description: `방탄커피 와 데이브아스프리 스토리, 완전무결 방탄커피 효능 과 방탄커피 만들기 레시피, 키토제닉 핸드픽 원두`
- 판단: 페이지 주제는 맞지만 title과 description이 짧고 어색하다. 특히 `방탄커피` 단독 검색의 CTR이 낮으므로, 검색 결과에서 바로 누르고 싶게 만드는 문장으로 바꾸는 것이 목표다.

### 추천 title 후보

1. `방탄커피 레시피와 만드는법 | 더클린커피`
2. `방탄커피란? 재료·레시피·만드는법 | 더클린커피`
3. `방탄커피 만들기: 원두·버터·오일 레시피 | 더클린`

추천안은 2번이다. `방탄커피` 단독 검색, `방탄커피 뜻`, `방탄커피 만드는법`, `방탄커피 레시피`를 한 번에 받는다.

### 추천 meta description 후보

1. `방탄커피 뜻부터 재료, 버터·오일 비율, 만드는법까지 한 번에 정리했습니다. 곰팡이독소 테스트 원두로 시작하는 더클린커피 레시피를 확인하세요.`
2. `방탄커피가 무엇인지, 어떤 원두와 오일을 쓰면 좋은지, 집에서 만드는 기본 레시피까지 쉽게 정리했습니다. 더클린커피의 원두 선택 기준도 함께 확인하세요.`
3. `방탄커피 레시피를 처음 시작한다면 원두, 버터, 오일 선택부터 확인하세요. 더클린커피가 깨끗한 원두 기준과 만드는법을 쉽게 안내합니다.`

추천안은 1번이다. CTR이 낮은 `방탄커피` 단독 검색자에게 `뜻`, `재료`, `만드는법`을 모두 보여준다.

### 추천 H1

`방탄커피란? 레시피와 만드는법`

### 상단 첫 문단 초안

```md
방탄커피는 커피에 좋은 지방을 더해 포만감 있는 아침 루틴으로 즐기는 레시피입니다. 처음 시작할 때는 버터와 오일만큼 원두 선택도 중요합니다. 이 페이지에서는 방탄커피의 뜻, 필요한 재료, 기본 만드는법, 원두를 고르는 기준을 한 번에 정리합니다.
```

### 본문 구조 초안

1. `방탄커피란 무엇인가요?`
   - 목적: `방탄커피`, `방탄커피 뜻`, `방탄커피란` 검색 수요 대응.
   - 본문 초안:
     ```md
     방탄커피는 커피에 버터와 오일을 더해 마시는 레시피입니다. 일반 커피보다 포만감이 오래 가는 편이라 아침 루틴이나 간헐적 단식 중 커피를 찾는 사람이 많이 검색합니다. 다만 개인의 건강 상태에 따라 맞지 않을 수 있으므로, 처음에는 적은 양으로 시작하는 것이 좋습니다.
     ```

2. `방탄커피 재료`
   - 목적: `방탄커피 재료`, `방탄커피 기버터`, `방탄커피 버터 양` 대응.
   - 본문 초안:
     ```md
     기본 재료는 커피, 무염 버터 또는 기버터, MCT 오일 또는 코코넛 오일입니다. 원두는 향만 보는 것이 아니라 보관, 로스팅, 결점두 선별, 곰팡이독소 테스트 여부까지 함께 보는 것이 좋습니다.
     ```

3. `방탄커피 기본 레시피`
   - 목적: `방탄커피 레시피`, `방탄커피 만드는법`, `방탄커피 만들기` 대응.
   - 본문 초안:
     ```md
     따뜻한 커피 180~220ml에 버터 5~10g, MCT 오일 또는 코코넛 오일 5~10ml를 넣고 충분히 섞습니다. 처음 마신다면 오일과 버터를 적게 넣어 몸에 맞는지 확인한 뒤 조금씩 조절하세요.
     ```

4. `방탄커피 원두 선택 기준`
   - 목적: 더클린커피 차별점 연결.
   - 본문 초안:
     ```md
     방탄커피는 버터와 오일의 맛이 더해지기 때문에 커피 원두의 쓴맛, 탄맛, 잡미가 더 크게 느껴질 수 있습니다. 더클린커피는 초신선 로스팅, 핸드픽, 곰팡이독소 테스트 기준을 통해 깔끔한 방탄커피 루틴에 맞는 원두를 제안합니다.
     ```

5. `직접 만들기 번거롭다면`
   - 목적: 상품 CTA 연결.
   - 본문 초안:
     ```md
     매번 원두를 내리고 버터와 오일을 계량하는 과정이 번거롭다면 더클린 진짜 방탄커피 제품을 선택할 수 있습니다. 곰팡이독소 ZERO 기준의 유기농 스페셜티 커피에 자연방목 버터와 오일을 더한 간편한 방탄커피입니다.
     ```

### FAQ 초안

```md
Q. 방탄커피와 버터커피는 같은 말인가요?
A. 비슷하게 쓰이지만, 방탄커피는 커피에 버터와 오일을 함께 넣어 마시는 레시피를 뜻하는 경우가 많습니다. 버터커피는 버터를 넣은 커피를 더 넓게 부르는 표현입니다.

Q. 방탄커피는 언제 마시나요?
A. 많은 사람이 아침 루틴으로 마십니다. 다만 개인의 식습관과 건강 상태에 따라 맞지 않을 수 있으므로 처음에는 적은 양으로 시작하는 것이 좋습니다.

Q. MCT 오일 없이 만들 수 있나요?
A. 만들 수는 있지만 식감과 포만감이 달라집니다. 처음이라면 오일 양을 줄여 시작하고, 몸에 맞는지 확인하는 방식이 안전합니다.

Q. 어떤 원두가 방탄커피에 잘 맞나요?
A. 잡미가 적고 깔끔한 원두가 좋습니다. 특히 방탄커피는 버터와 오일이 들어가기 때문에 탄맛이나 결점두 향이 더 도드라질 수 있습니다.

Q. 더클린커피 원두는 왜 방탄커피에 맞나요?
A. 더클린커피는 초신선 로스팅, 핸드픽, 곰팡이독소 테스트 기준을 강조합니다. 방탄커피처럼 매일 마시는 루틴에는 이런 원두 기준이 중요합니다.

Q. 직접 만들기 번거로울 때는 어떻게 하나요?
A. 더클린 진짜 방탄커피 제품처럼 원두, 버터, 오일 조합을 간편하게 마실 수 있는 제품을 선택할 수 있습니다.
```

### CTA 초안

```md
직접 만들 준비가 됐다면 더클린커피의 초신선 원두를 확인해보세요.
간편하게 시작하고 싶다면 더클린 진짜 방탄커피 제품을 먼저 선택해도 좋습니다.
```

연결 후보:

- `더클린 진짜 방탄커피`: `https://thecleancoffee.com/thecleancoffee/?idx=75`
- `초신선 원두 전체`: `https://thecleancoffee.com/thecleancoffee`
- `구매평`: `https://thecleancoffee.com/Reviews`

## 원두/상품 title meta 초안

### 공통 원칙

현재 일부 상품 meta description은 `곰팡이독소`, `방탄커피 원두`, `핸드픽` 같은 단어를 쉼표로 많이 나열한다. 검색 결과에서 사람이 읽는 문장으로 보이려면 키워드 나열보다 맛, 산미, 원두명, 더클린 기준을 한 문장으로 정리하는 편이 낫다.

게시 전에는 반드시 실제 상품명과 원산지가 맞는지 확인해야 한다. 특히 `예가체프/아리차`는 과거 GSC URL과 현재 공개 상품 URL이 엇갈려 있다.

### 예가체프/아리차 원두

#### URL 판단

- Search Console 과거 주 수신 URL: `https://thecleancoffee.com/thecleancoffee_store/?idx=1`
- 현재 예가체프/아리차 title 확인 URL: `https://thecleancoffee.com/shop_view/62`
- 현재 `shop_view/62` canonical: `https://thecleancoffee.com/subscription/?idx=62`
- 주의: `shop_view/1`은 현재 `에티오피아 구지 사키소` 상품으로 보인다. 예가체프/아리차 문안을 `shop_view/1`에 넣으면 실제 상품과 어긋날 수 있다.

#### 추천 title

`에티오피아 아리차 예가체프 G1 원두 | 더클린커피`

#### 추천 meta description

`꽃향과 밝은 산미가 특징인 에티오피아 아리차 예가체프 G1 스페셜티 원두입니다. 초신선 로스팅, 핸드픽, 곰팡이독소 테스트 기준으로 깔끔하게 즐기세요.`

#### 추천 H1

`에티오피아 아리차 예가체프 G1 원두`

#### 상품 상단 문단 초안

```md
에티오피아 아리차 예가체프 G1은 꽃향과 밝은 산미를 좋아하는 분에게 맞는 스페셜티 원두입니다. 더클린커피는 초신선 로스팅과 핸드픽, 곰팡이독소 테스트 기준으로 더 깔끔한 한 잔을 제안합니다.
```

#### 게시 전 확인

- 이 상품이 현재 판매 중인 `예가체프/아리차` 본상품인지 확인한다.
- canonical이 `/subscription/?idx=62`로 잡히는 이유를 확인한다.
- 정기구독 상품이면 본상품 URL과 구독 URL을 분리해 title/meta를 다르게 둔다.

### 케냐 캉고초 AA 원두

#### URL 판단

- 현재 canonical 후보: `https://thecleancoffee.com/thecleancoffee/?idx=8`
- 현재 title: `케냐 원두 캉고초 AA 스페셜티 곰팡이독소 테스트 더클린커피`
- Search Console 근거: 11클릭 / 2,198노출. `케냐 원두`, `케냐 원두 산미`, `케냐원두`가 핵심이다.

#### 추천 title

`케냐 캉고초 AA 원두 | 산미 좋은 스페셜티 더클린커피`

#### 추천 meta description

`밝은 산미와 깔끔한 과일향을 좋아한다면 케냐 캉고초 AA 스페셜티 원두를 추천합니다. 초신선 로스팅, 워시드 공법, 핸드픽 기준으로 더 깨끗하게 즐기세요.`

#### 추천 H1

`케냐 캉고초 AA 스페셜티 원두`

#### 상품 상단 문단 초안

```md
케냐 캉고초 AA는 밝은 산미와 깔끔한 과일향이 살아 있는 스페셜티 원두입니다. 아이스커피나 핸드드립에서 산뜻한 커피를 좋아하는 분에게 잘 맞습니다. 더클린커피는 초신선 로스팅과 핸드픽 기준으로 잡미를 줄인 케냐 원두를 제안합니다.
```

### 과테말라 SHB 원두

#### URL 판단

- 현재 canonical 후보: `https://thecleancoffee.com/thecleancoffee/?idx=30`
- 현재 title: `과테말라 쿠에비스타 SHB 곰팡이독소 테스트 원두 독소프리 원두 더클린 커피`
- Search Console 근거: `과테말라 shb`, `과테말라 원두`, `과테말라 산미` 계열.
- 주의: 과거 GSC에는 `shop_view/?idx=63`, `thecleancoffee_store/?idx=12`에도 과테말라 검색어가 잡혔다. 현재 공개 페이지 기준 상품 매칭을 다시 확인해야 한다.

#### 추천 title

`과테말라 SHB 원두 | 달콤한 산미 스페셜티 더클린커피`

#### 추천 meta description

`달콤함과 산미의 균형이 좋은 과테말라 SHB 스페셜티 원두입니다. 워시드 공법, 초신선 로스팅, 핸드픽 기준으로 깔끔한 데일리 커피를 즐겨보세요.`

#### 추천 H1

`과테말라 SHB 스페셜티 원두`

#### 상품 상단 문단 초안

```md
과테말라 SHB 스페셜티는 달콤함과 산미의 균형이 좋아 데일리 커피로 마시기 좋은 원두입니다. 더클린커피는 워시드 공법, 초신선 로스팅, 핸드픽 기준으로 더 깔끔한 과테말라 원두를 제안합니다.
```

### 초신선 원두 전체 페이지

#### URL 판단

- 현재 URL: `https://thecleancoffee.com/thecleancoffee`
- 현재 title: `초신선 원두, 더클린 커피`
- Search Console 근거: `커피 원두 추천`, `원두 추천`, `커피원두 추천` 계열은 노출은 있으나 클릭이 아직 없다.

#### 추천 title

`초신선 원두 추천 | 곰팡이독소 테스트 더클린커피`

#### 추천 meta description

`더클린커피는 초신선 로스팅, 핸드픽, 곰팡이독소 테스트 기준으로 스페셜티 원두를 제안합니다. 산미, 고소함, 디카페인, 방탄커피용 원두까지 한 번에 비교하세요.`

#### 상단 안내 문단 초안

```md
더클린커피의 초신선 원두는 산미, 고소함, 디카페인, 방탄커피용 원두처럼 취향과 목적에 따라 고를 수 있습니다. 모든 원두는 로스팅 후 신선도, 핸드픽, 곰팡이독소 테스트 기준을 함께 확인해 더 깨끗한 커피 경험을 목표로 합니다.
```

## 게시 전 체크리스트

1. Imweb에서 각 페이지의 실제 수정 위치를 확인한다.
   - title/meta 수정 위치.
   - 본문 상단 텍스트 수정 위치.
   - FAQ 블록 추가 가능 여부.

2. URL/canonical을 확인한다.
   - `bulletproofcoffee`는 canonical이 정상이다.
   - 예가체프/아리차는 현재 `shop_view/62`의 canonical이 `/subscription/?idx=62`라 본상품과 구독상품 구분이 필요하다.
   - 과테말라도 과거 Search Console URL과 현재 상품 URL이 일부 엇갈린다.

3. 게시 후 Search Console 기준으로 28일 비교한다.
   - `방탄커피`: CTR 0.84% -> 1.5% 이상.
   - `예가체프/아리차` 묶음: CTR 0.8% 이상.
   - `케냐 원두` 묶음: CTR 1.2% 이상.
   - 평균순위가 2계단 이상 하락하면 title 과최적화 또는 검색의도 불일치로 보고 원복/수정한다.

## 하지 않은 것

- Imweb 게시 안 함.
- Imweb footer/header 변경 안 함.
- 운영DB write 안 함.
- VM Cloud SQLite write 안 함.
- GA4/Google Ads/Meta/TikTok/Naver send/upload 안 함.
- GTM publish 안 함.
- 운영 배포 안 함.
