# JSON-LD 삽입 스니펫

작성 시각: 2026-04-27 23:04 KST
기준일: 2026-04-27
Source: `reports/seo/jsonld_samples/*`
Freshness: 2026-04-27 23:04 KST
Confidence: 74%

## 10초 요약

아래 스니펫은 운영 게시 전 검증용 초안이다. 실제 아임웹/사용자 코드/GTM에 게시하기 전에는 대표 URL 정책, 화면 노출 값, 가격/재고/후기 일치 여부를 다시 확인해야 한다.

## 삽입 원칙

1. 페이지별로 해당 페이지에 맞는 JSON-LD만 넣는다.
2. BreadcrumbList의 URL은 `reports/seo/url_policy_recommendations.md`의 대표 URL 정책과 일치시킨다.
3. 가격과 재고가 자동 갱신되지 않으면 운영자가 관리 가능한 방식으로만 넣는다.
4. Review와 AggregateRating은 화면에 실제 평점/후기 수가 보일 때만 넣는다.

## 종합 대사기능 분석 Product

Source: `jsonld_samples/product_organicacid.json`

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "종합 대사기능 분석",
  "description": "내 몸의 대사 상태는 어떨까? 종합 대사기능 분석은 소변 유기산 검사를 통해 탄수화물, 지방 대사 효율과 에너지 생성 과정을 정밀하게 측정합니다. 느린 대사나 영양 불균형의 원인을 파악하고, 데이터 기반의 맞춤형 건강 관리 솔루션을 확인해보세요.",
  "brand": {
    "@type": "Brand",
    "name": "Biocom"
  },
  "url": "https://biocom.kr/organicacid_store/?idx=259",
  "image": [
    "https://cdn.imweb.me/thumbnail/20260421/dae2c15bb7074.png"
  ],
  "offers": {
    "@type": "Offer",
    "url": "https://biocom.kr/organicacid_store/?idx=259",
    "priceCurrency": "KRW",
    "price": "298000",
    "availability": "https://schema.org/InStock"
  }
}
</script>
```

## 바이오밸런스 Product

Source: `jsonld_samples/product_biobalance.json`

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "바이오밸런스 90정 (1개월분)",
  "description": "지친 몸에 활력을 채우는 올인원 멀티 미네랄, 바이오 밸런스입니다. 건조효모 아연, 마그네슘, 셀레늄, 비타민D, 크롬, 망간, 몰리브덴 등 필수 영양소를 체계적으로 배합해 기초 대사와 면역력을 높여줍니다. 온 가족 피로 회복을 위한 스마트한 밸런스 케어를 시작하세요.",
  "brand": {
    "@type": "Brand",
    "name": "Biocom"
  },
  "url": "https://biocom.kr/HealthFood/?idx=97",
  "image": [
    "https://cdn.imweb.me/thumbnail/20251201/0d5d5421f678f.jpg"
  ],
  "offers": {
    "@type": "Offer",
    "url": "https://biocom.kr/HealthFood/?idx=97",
    "priceCurrency": "KRW",
    "price": "39000",
    "availability": "https://schema.org/InStock"
  }
}
</script>
```

## 건강정보 글 Article

Source: `jsonld_samples/article_health_goal.json`

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "새해 신년 건강 목표를 설정하는 방법",
  "description": "새해 건강 목표를 설정하는 방법을 현실적인 목표, 생활 루틴, 측정 가능한 기준으로 나누어 설명하는 바이오컴 건강 전문가 칼럼입니다.",
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://biocom.kr/healthinfo/?bmode=view&idx=5764202"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Biocom",
    "url": "https://biocom.kr/"
  },
  "image": [
    "https://cdn.imweb.me/thumbnail/20210121/16db3df349ee7.jpg"
  ]
}
</script>
```

## 바이오컴 Organization

Source: `jsonld_samples/organization_biocom.json`

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Biocom",
  "url": "https://biocom.kr/",
  "logo": "https://cdn.imweb.me/upload/S20190715619285c855898/1b85236645e9b.png",
  "sameAs": []
}
</script>
```

## BreadcrumbList 예시

Source: `jsonld_samples/breadcrumb_examples.json`

```html
<script type="application/ld+json">
{
  "product": {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "홈",
        "item": "https://biocom.kr/"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "상품",
        "item": "https://biocom.kr/HealthFood/"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": "바이오밸런스",
        "item": "https://biocom.kr/HealthFood/?idx=97"
      }
    ]
  },
  "article": {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "홈",
        "item": "https://biocom.kr/"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "건강정보",
        "item": "https://biocom.kr/healthinfo"
      }
    ]
  }
}
</script>
```
