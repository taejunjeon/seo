# 바이오컴 상품 4개 SEO/AEO 최종 실행 패키지

작성 시각: 2026-04-29 00:28 KST  
기준일: 2026-04-29  
Source: `reports/seo/product_text_block_matrix.csv`, `reports/seo/jsonld_insertion_snippets.md`, 공개 상품 페이지 읽기 전용 확인  
Freshness: 2026-04-29 00:28 KST  
Confidence: 82%

## 10초 요약

이 패키지는 상품/검사권 4개에 `사람에게 보이는 본문 텍스트`, `JSON-LD`, `GSC canonical 확인`을 묶어 운영 반영 직전까지 갈 수 있게 만든 실행안이다. JSON-LD는 구글에 넣는 것이 아니라 아임웹 페이지 HTML에 넣고, 구글은 그 페이지를 다시 읽어 해석한다. 실제 아임웹 게시, 사용자 코드 게시, Search Console 제출은 운영 영향이 있으므로 TJ님 최종 확인 뒤 진행한다.

## 결론

추천 순서는 아래다.

1. 아임웹 상품 상세 본문에 보이는 텍스트 블록을 추가한다.
2. 같은 페이지에 해당 상품의 JSON-LD를 삽입한다.
3. Google Rich Results Test로 JSON-LD 인식 여부를 확인한다.
4. Google Search Console에서 URL 검사와 색인 요청을 한다.
5. `reports/seo/gsc_canonical_check_matrix.md`에 Google 선택 canonical을 기록한다.

## JSON-LD 삽입 위치

| 구분 | 역할 | 이번 작업 |
|---|---|---|
| 아임웹 | JSON-LD 코드를 실제 페이지 HTML에 넣는 장소 | 상품별 페이지 또는 사용자 코드 영역에 삽입 |
| Google | 아임웹 페이지를 크롤링해서 JSON-LD를 읽는 검색엔진 | 직접 코드를 넣는 곳이 아님 |
| Google Rich Results Test | 삽입된 JSON-LD가 문법상 읽히는지 확인하는 검사 도구 | 게시 전후 검증 |
| Google Search Console | 구글이 해당 URL을 다시 읽도록 요청하고 canonical을 확인하는 도구 | URL 검사, 색인 요청, canonical 기록 |

## 삽입 방법

### 1순위: 아임웹 페이지별 코드 삽입

- 위치: 아임웹 관리자에서 해당 상품 페이지의 `<head>` 또는 페이지별 사용자 코드 삽입이 가능하면 그 위치를 사용한다.
- 장점: 해당 상품 페이지에만 JSON-LD가 들어가므로 가장 명확하다.
- 주의: 아임웹 메뉴가 보이지 않으면 상담원에게 "페이지별 head 또는 body 사용자 코드 삽입 가능 여부"를 문의한다.

### 2순위: 아임웹 공통 Header Code + URL 조건

- 위치: 아임웹 공통 Header Code에 넣되, `location.pathname`과 `idx` 조건으로 해당 상품 URL에서만 JSON-LD가 생성되게 한다.
- 장점: 페이지별 삽입이 없어도 적용 가능하다.
- 주의: 공통 코드라서 조건문이 틀리면 다른 상품에 잘못 들어갈 수 있다.

### 3순위: GTM 사용자 정의 HTML

- 위치: Google Tag Manager 사용자 정의 HTML 태그.
- 장점: 게시와 롤백이 빠르다.
- 주의: 가격, 재고처럼 바뀌는 값은 GTM 삽입보다 아임웹 직접 삽입이 더 안정적이다. 테스트 또는 임시 적용으로 본다.

## 운영 반영 전 확인

| 확인 항목 | 기준 | 상태 |
|---|---|---|
| 상품명 | 실제 화면 상품명과 JSON-LD `name`이 일치 | 게시 전 확인 |
| 가격 | 실제 화면 판매가와 JSON-LD `price`가 일치 | 게시 전 확인 |
| 이미지 | 실제 대표 이미지와 JSON-LD `image`가 일치 | 게시 전 확인 |
| FAQ | 화면에 보이는 질문/답변만 FAQPage에 사용 | 게시 전 확인 |
| canonical | GSC URL 검사에서 Google 선택 canonical 기록 | 게시 후 확인 |

## 상품별 실행안

### 1. 종합 대사기능 분석

- URL: `https://biocom.kr/organicacid_store/?idx=259`
- 유형: 검사권
- 판매가 후보: `298000` KRW
- 대표 이미지 후보: `https://cdn.imweb.me/thumbnail/20260421/dae2c15bb7074.png`
- 자신감: 86%

#### 보이는 본문 텍스트

```md
# 종합 대사기능 분석

## 이런 분께 필요합니다
피로가 오래가거나 체중 조절이 잘 되지 않고, 식단과 영양제를 바꿔도 몸의 반응이 애매한 분께 맞습니다. 소변 유기산 검사를 통해 에너지 생성, 탄수화물과 지방 대사, 장내 환경, 영양 균형 신호를 함께 확인합니다.

## 무엇을 확인하나요
대사 과정에서 남는 유기산 지표를 바탕으로 에너지 대사, 지방 대사, 탄수화물 대사, 장내균 불균형, 산화 스트레스, 영양 보조 필요성을 봅니다.

## 검사 후 무엇이 달라지나요
검사 결과를 바탕으로 식사, 생활 습관, 영양 보충 방향을 개인별로 정리할 수 있습니다. 단순 증상 추측이 아니라 현재 몸의 대사 흐름을 기준으로 관리 우선순위를 세우는 것이 목적입니다.

## 자주 묻는 질문
Q. 검사는 병원 방문 없이 가능한가요?
A. 상품 페이지에 안내된 검사 키트와 진행 방식 기준으로 확인해야 합니다. 운영 반영 전 최신 안내 문구와 일치 여부를 다시 확인해야 합니다.
```

#### JSON-LD

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Product",
      "name": "종합 대사기능 분석",
      "description": "소변 유기산 검사를 통해 에너지 생성, 탄수화물과 지방 대사, 장내 환경, 영양 균형 신호를 함께 확인하는 검사권입니다.",
      "brand": { "@type": "Brand", "name": "Biocom" },
      "url": "https://biocom.kr/organicacid_store/?idx=259",
      "image": ["https://cdn.imweb.me/thumbnail/20260421/dae2c15bb7074.png"],
      "offers": {
        "@type": "Offer",
        "url": "https://biocom.kr/organicacid_store/?idx=259",
        "priceCurrency": "KRW",
        "price": "298000",
        "availability": "https://schema.org/InStock"
      }
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "홈", "item": "https://biocom.kr/" },
        { "@type": "ListItem", "position": 2, "name": "검사 서비스", "item": "https://biocom.kr/service" },
        { "@type": "ListItem", "position": 3, "name": "종합 대사기능 분석", "item": "https://biocom.kr/organicacid_store/?idx=259" }
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "검사는 병원 방문 없이 가능한가요?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "상품 페이지에 안내된 검사 키트와 진행 방식 기준으로 확인해야 합니다. 운영 반영 전 최신 안내 문구와 일치 여부를 다시 확인해야 합니다."
          }
        }
      ]
    }
  ]
}
</script>
```

### 2. 음식물 과민증 분석

- URL: `https://biocom.kr/igg_store/?idx=85`
- 유형: 검사권
- 판매가 후보: `260000` KRW
- 대표 이미지 후보: `https://cdn.imweb.me/thumbnail/20260325/d22aee086b583.png`
- 자신감: 78%

#### 보이는 본문 텍스트

```md
# 음식물 과민증 분석

## 이런 분께 필요합니다
평소 자주 먹는 음식인데도 식후 더부룩함, 컨디션 저하, 반복되는 불편감이 있는 분께 필요합니다. 음식물 과민 반응 가능성을 확인해 식단 조정의 기준을 만드는 것이 목적입니다.

## 무엇을 확인하나요
검사 항목과 판정 기준은 운영 페이지의 최신 안내를 기준으로 맞춰야 합니다. SEO 본문에는 특정 질병 진단처럼 보이는 표현을 피하고, 개인별 식단 관리 참고 자료라는 목적을 분명히 둡니다.

## 검사 후 무엇이 달라지나요
자주 먹는 음식 중 조절 후보를 찾고, 무작정 제한식으로 가기 전에 우선순위를 정할 수 있습니다. 결과 해석은 전문가 상담 또는 공식 안내 기준과 함께 보는 것이 안전합니다.

## 자주 묻는 질문
Q. 알레르기 검사와 같은 검사인가요?
A. 알레르기 진단과 동일하게 표현하면 안 됩니다. 운영 반영 전 바이오컴의 공식 검사 설명과 의료 표현 기준을 확인해야 합니다.
```

#### JSON-LD

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Product",
      "name": "음식물 과민증 분석",
      "description": "자주 먹는 음식 중 식단 조정 후보를 확인하고 개인별 식단 관리 참고 자료로 활용하는 검사권입니다.",
      "brand": { "@type": "Brand", "name": "Biocom" },
      "url": "https://biocom.kr/igg_store/?idx=85",
      "image": ["https://cdn.imweb.me/thumbnail/20260325/d22aee086b583.png"],
      "offers": {
        "@type": "Offer",
        "url": "https://biocom.kr/igg_store/?idx=85",
        "priceCurrency": "KRW",
        "price": "260000",
        "availability": "https://schema.org/InStock"
      }
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "홈", "item": "https://biocom.kr/" },
        { "@type": "ListItem", "position": 2, "name": "검사 서비스", "item": "https://biocom.kr/service" },
        { "@type": "ListItem", "position": 3, "name": "음식물 과민증 분석", "item": "https://biocom.kr/igg_store/?idx=85" }
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "알레르기 검사와 같은 검사인가요?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "알레르기 진단과 동일하게 표현하면 안 됩니다. 운영 반영 전 바이오컴의 공식 검사 설명과 의료 표현 기준을 확인해야 합니다."
          }
        }
      ]
    }
  ]
}
</script>
```

### 3. 바이오밸런스

- URL: `https://biocom.kr/HealthFood/?idx=97`
- 유형: 영양제
- 판매가 후보: `39000` KRW
- 대표 이미지 후보: `https://cdn.imweb.me/thumbnail/20251201/0d5d5421f678f.jpg`
- 자신감: 86%

#### 보이는 본문 텍스트

```md
# 바이오밸런스 90정

## 이런 분께 필요합니다
일상 피로가 잦고 식사만으로 미네랄과 비타민D 섭취가 부족하다고 느끼는 분께 맞습니다. 마그네슘, 아연, 셀레늄, 비타민D 등 주요 영양소를 한 번에 관리하려는 사람에게 적합합니다.

## 주요 성분
상품 페이지에 노출된 기준으로 마그네슘, 아연, 셀레늄, 비타민D, 크롬, 망간, 몰리브덴 등 기초 대사와 영양 균형에 필요한 성분을 강조합니다.

## 어떻게 먹나요
섭취 방법은 제품 라벨과 공식 상세 안내를 기준으로 표기해야 합니다. SEO 본문에는 효능을 과장하지 않고, 균형 잡힌 식사와 함께 보조적으로 관리하는 제품임을 분명히 합니다.

## 자주 묻는 질문
Q. 온 가족이 함께 먹을 수 있나요?
A. 연령, 건강 상태, 복용 중인 약에 따라 다를 수 있으므로 공식 섭취 안내와 전문가 상담 기준을 함께 안내해야 합니다.
```

#### JSON-LD

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Product",
      "name": "바이오밸런스 90정",
      "description": "마그네슘, 아연, 셀레늄, 비타민D 등 주요 영양소를 한 번에 관리하려는 사람을 위한 영양제입니다.",
      "brand": { "@type": "Brand", "name": "Biocom" },
      "url": "https://biocom.kr/HealthFood/?idx=97",
      "image": ["https://cdn.imweb.me/thumbnail/20251201/0d5d5421f678f.jpg"],
      "offers": {
        "@type": "Offer",
        "url": "https://biocom.kr/HealthFood/?idx=97",
        "priceCurrency": "KRW",
        "price": "39000",
        "availability": "https://schema.org/InStock"
      }
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "홈", "item": "https://biocom.kr/" },
        { "@type": "ListItem", "position": 2, "name": "건강식품", "item": "https://biocom.kr/HealthFood/" },
        { "@type": "ListItem", "position": 3, "name": "바이오밸런스", "item": "https://biocom.kr/HealthFood/?idx=97" }
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "온 가족이 함께 먹을 수 있나요?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "연령, 건강 상태, 복용 중인 약에 따라 다를 수 있으므로 공식 섭취 안내와 전문가 상담 기준을 함께 안내해야 합니다."
          }
        }
      ]
    }
  ]
}
</script>
```

### 4. 뉴로마스터

- URL: `https://biocom.kr/HealthFood/?idx=198`
- 유형: 영양제
- 판매가 후보: `35000` KRW
- 대표 이미지 후보: `https://cdn.imweb.me/thumbnail/20251201/1cda35410374d.jpg`
- 자신감: 76%

#### 보이는 본문 텍스트

```md
# 뉴로마스터 60정

## 이런 분께 필요합니다
업무나 학습 중 집중 유지가 어렵고, 두뇌 건강과 신경 영양 관리를 함께 보고 싶은 분께 맞습니다. 제품 상세의 실제 성분과 표시 문구를 기준으로 안전하게 설명해야 합니다.

## 무엇을 관리하나요
두뇌 건강, 신경 기능, 에너지 관리와 관련된 영양 성분을 제품 표시 기준으로 정리합니다. 질병 치료나 기억력 개선을 단정하는 표현은 쓰지 않습니다.

## 누가 먼저 보면 좋나요
수험생, 집중 업무가 많은 직장인, 생활 리듬이 불규칙한 사람처럼 컨디션 관리가 필요한 고객에게 제품의 역할을 설명합니다. 운영 반영 전 상세 성분표와 금지 표현을 확인해야 합니다.

## 자주 묻는 질문
Q. 집중력 개선 제품이라고 말해도 되나요?
A. 단정 표현은 피해야 합니다. 건강기능식품 표시 기준과 실제 제품 인증 문구를 확인한 뒤 허용된 범위에서만 표현합니다.
```

#### JSON-LD

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Product",
      "name": "뉴로마스터 60정",
      "description": "두뇌 건강과 신경 영양 관리를 함께 보고 싶은 사람을 위한 영양제입니다. 제품 상세의 실제 성분과 표시 문구를 기준으로 안전하게 설명해야 합니다.",
      "brand": { "@type": "Brand", "name": "Biocom" },
      "url": "https://biocom.kr/HealthFood/?idx=198",
      "image": ["https://cdn.imweb.me/thumbnail/20251201/1cda35410374d.jpg"],
      "offers": {
        "@type": "Offer",
        "url": "https://biocom.kr/HealthFood/?idx=198",
        "priceCurrency": "KRW",
        "price": "35000",
        "availability": "https://schema.org/InStock"
      }
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "홈", "item": "https://biocom.kr/" },
        { "@type": "ListItem", "position": 2, "name": "건강식품", "item": "https://biocom.kr/HealthFood/" },
        { "@type": "ListItem", "position": 3, "name": "뉴로마스터", "item": "https://biocom.kr/HealthFood/?idx=198" }
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "집중력 개선 제품이라고 말해도 되나요?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "단정 표현은 피해야 합니다. 건강기능식품 표시 기준과 실제 제품 인증 문구를 확인한 뒤 허용된 범위에서만 표현합니다."
          }
        }
      ]
    }
  ]
}
</script>
```

## 롤백 기준

아래 중 하나라도 발생하면 JSON-LD와 본문 텍스트 반영을 멈추고 직전 상태로 되돌린다.

- Google Rich Results Test에서 Product 또는 FAQPage 오류가 발생한다.
- 실제 화면 가격과 JSON-LD 가격이 다르다.
- FAQ가 화면에는 없는데 JSON-LD에만 들어가 있다.
- Search Console URL 검사에서 핵심 상품이 `색인 생성 불가`로 바뀐다.
- 상품 상세 전환율 또는 구매 버튼 클릭에 눈에 띄는 이상이 생긴다.

