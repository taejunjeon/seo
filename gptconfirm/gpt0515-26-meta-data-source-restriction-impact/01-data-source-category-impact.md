# Data source category impact

작성 시각: 2026-05-16 00:53 KST

## 결론

Meta의 건강/웰빙 데이터 소스 제한은 `Purchase` 같은 하단 퍼널 구매 이벤트가 Ads 최적화/리포팅에 반영되지 않는 현상을 만들 수 있습니다.

다만 현재 바이오컴에서 관측한 “CAPI events_received=1인데 Ads raw purchase 0”을 제한 하나로 확정할 수는 없습니다. 같은 계정에서 최근 7일 Ads purchase가 존재하기 때문에, 2026-05-15 당일 지연도 여전히 강한 후보입니다.

## 공식/접근 가능한 근거 구분

### Meta 공식 페이지

다음 Meta Help Center 문서는 Search Engine Land 기사에서 직접 링크된 공식 문서입니다. 현재 Codex 브라우징 환경에서는 로그인/temporary block 화면으로 열렸습니다.

- About prohibited information: `https://www.facebook.com/business/help/361948878201809?id=188852726110565`
- Understand data sharing restrictions based on data source categories: `https://www.facebook.com/business/help/511197658391698`

공식 문서의 본문을 직접 확인하지 못했으므로, 아래 정책 해석은 “공식 URL 존재 + 공개 인용/요약 + TJ님 UI 증거”를 결합한 중간 신뢰 판단입니다.

### 공개 인용/요약에서 확인한 내용

Search Engine Land는 Meta Business Help Center를 인용해 건강 정보처럼 민감한 정보를 Meta Business Tools로 보내면 안 된다고 설명합니다. 같은 글은 건강/웰빙 제한이 걸리면 tracking, optimization, reporting 제한이 적용될 수 있고, 일부 단계에서는 AddToCart/Purchase 같은 중·하단 퍼널 이벤트 최적화가 막힐 수 있다고 정리합니다.

Meta Conversions API Direct Integration Playbook은 별도 중요한 기준을 줍니다.

- CAPI는 구매 같은 최적화 이벤트를 서버에서 보낼 수 있다.
- `event_id`와 `event_name`은 Browser Pixel과 Server CAPI 중복 제거에 중요하다.
- Events Manager에서 Browser + Server 연결, 이벤트 매칭 품질, 데이터 신선도를 봐야 한다.
- CAPI 2xx 응답이나 `events_received=1`은 “이벤트가 Meta에 수신됐다”는 의미이지, 반드시 Ads Manager 귀속 구매가 됐다는 뜻은 아니다.

## 현재 바이오컴에 적용되는 의미

현재 TJ님 UI 증거:

- `biocom.kr`: 건강 및 웰빙 서비스 제공업체
- `biocom.imweb.me`, 한글 도메인: 건강 및 웰빙 - 기타
- 검토 상태: 검토 대기 중
- Events Manager: 데이터 공유 제한 적용 경고

현재 데이터 증거:

- CAPI Purchase는 성공: 58건 / 16,963,197원
- CAPI failed 0, duplicate 0
- Ads Manager raw purchase-family key 0
- 최근 7일 Ads purchase는 존재

따라서 현재 해석은 이렇습니다.

1. CAPI 수신 자체는 막히지 않았다.
2. 하지만 Meta가 수신한 구매를 광고 최적화/리포팅에 온전히 쓰는지는 제한 대상일 수 있다.
3. 제한 상세에서 `Purchase`나 lower-funnel event 제한이 확인되면 Ads purchase 0과의 관련성이 크게 올라간다.
4. 제한 상세가 Core Setup 수준, 즉 custom parameters/URL/advanced matching 제한 중심이면 구매 0의 직접 원인 가능성은 낮아지고 same-day lag 가능성이 커진다.

## 민감 데이터 최소화 원칙

건강/웰빙 도메인에서는 아래 데이터를 보수적으로 줄여야 합니다.

- 질병명, 검사명, 건강 상태를 암시하는 URL path/query
- 상품명/콘텐츠명이 건강 상태를 직접 추론하게 하는 custom_data
- 이벤트명이 건강 상태나 특정 진단을 암시하는 custom event
- member/order/payment raw id
- 동의/정책 검토 없이 보내는 external_id, email/phone hash 확장

유지할 수 있는 최소 구매 신호 후보:

- event_name=`Purchase`
- event_time
- event_id
- action_source=`website`
- value/currency
- fbp/fbc/fbclid-derived evidence
- client user agent/IP 등 Meta가 요구하는 기술 매칭 신호, 단 개인정보 검토 필요

## Source / window / confidence

- Source: TJ님 Meta UI 캡처/설명, gpt0515-25 VM Cloud/Meta API read-only 결과, 공개 Meta 관련 문서
- Window: 2026-05-15 KST Ads purchase 0 이슈
- Freshness: 2026-05-16 00:53 KST
- Confidence: medium

## 참고 출처

- Search Engine Land, Meta health restriction summary and official Help Center links: https://searchengineland.com/meta-ads-restrictions-health-wellness-campaigns-453094
- Meta official Help Center URL, data source restrictions, browsing blocked in Codex: https://www.facebook.com/business/help/511197658391698
- Meta official Help Center URL, prohibited information, browsing blocked in Codex: https://www.facebook.com/business/help/361948878201809?id=188852726110565
- Meta Conversions API Direct Integration Playbook: https://storage.googleapis.com/lr-tech-docs-resources/PDFs/Conversions-API-Direct-Integration-Playbook_English.pdf
- Open / EverywherePlus secondary category guide: https://www.everywhereplus.com/wp-content/uploads/2025/01/Meta-Categories-Guide-Jan-25.pdf
