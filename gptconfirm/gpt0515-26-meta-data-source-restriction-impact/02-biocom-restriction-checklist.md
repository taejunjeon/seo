# Biocom restriction checklist

작성 시각: 2026-05-16 00:53 KST

## 목적

이 체크리스트의 목적은 “건강/웰빙 제한 때문에 Purchase가 Ads Manager에 0으로 보이는지”를 Meta UI에서 직접 확인하는 것입니다.

Codex가 API로 볼 수 있는 것은 CAPI 전송 성공과 Ads action raw key입니다. 하지만 제한 상세는 Meta Events Manager UI 안의 경고/카테고리 관리 화면에 더 정확히 나옵니다.

## TJ님 확인 화면

1. Meta Events Manager로 이동합니다.
2. 데이터 세트에서 `바이오컴_TEMP` 또는 Pixel `1283400029487161`을 선택합니다.
3. `개요`, `설정`, `진단`, `이벤트 테스트` 탭을 차례로 봅니다.
4. `데이터 공유 제한 적용됨`, `카테고리 관리`, `상세 정보 보기`, `검토 요청` 버튼이 있는지 확인합니다.
5. 도메인별로 아래를 봅니다.
   - `biocom.kr`
   - `biocom.imweb.me`
   - 한글 도메인 / punycode 도메인

## 캡처/확인할 항목

### 1. 제한되는 이벤트

확인할 것:

- `Purchase` 제한 여부
- `AddPaymentInfo` 제한 여부
- `InitiateCheckout` 제한 여부
- `AddToCart` 제한 여부
- `ViewContent` / `PageView`만 허용되는지

해석:

- Purchase가 명시적으로 제한되면 Ads Manager purchase 0과 직접 연결 가능성이 큽니다.
- PageView/ViewContent는 보이고 Purchase만 제한이면 lower-funnel 제한 가능성이 큽니다.

### 2. 제한되는 데이터 필드

확인할 것:

- URL path/query 제한
- custom_data 제한
- event_source_url 제한
- advanced matching 제한
- external_id/user_data 제한
- product/catalog field 제한

해석:

- URL/custom_data 제한이면 데이터 최소화 패치가 우선입니다.
- user_data/external_id 제한이면 매칭 품질 저하가 생길 수 있습니다.

### 3. 검토 요청 가능 여부

확인할 것:

- `검토 요청` 버튼
- `데이터 사용 선언` 또는 유사한 compliance form
- 카테고리 변경 가능 여부
- 검토 상태가 `검토 대기 중`, `거절`, `승인`, `부분 제한` 중 무엇인지

해석:

- 검토 요청이 가능하면 먼저 데이터 최소화 후 요청하는 것이 안전합니다.
- 카테고리 변경은 근거 없이 시도하지 않습니다. 건강기능/검사/웰빙 서비스가 명확하면 무리한 변경은 리스크입니다.

### 4. 도메인 정리 필요 여부

확인할 것:

- `biocom.kr` 외 도메인이 실제 광고 랜딩/결제에 쓰이는지
- `biocom.imweb.me`가 과거/테스트 도메인인지
- 한글 도메인이 현재 트래픽을 받는지
- 도메인별 제한 정도가 다른지

해석:

- 안 쓰는 도메인이 제한 원인으로 묶여 있으면 정리 후보입니다.
- 현재 결제 도메인인 `biocom.kr` 제한이 핵심이면 도메인 정리만으로는 해결되지 않습니다.

## 캡처 후 Codex가 할 수 있는 일

- 제한 문구를 이벤트/필드/도메인 단위로 분류합니다.
- VM Cloud CAPI payload에서 제거할 데이터 후보를 만듭니다.
- Meta review 요청 전 “보내는 데이터가 건강 상태를 직접 암시하지 않는다”는 정리 문안을 작성합니다.
- Ads Manager 2026-05-15 구매 0 원인을 지연/제한/매핑 문제로 재점수화합니다.

## 지금 확인 우선순위

1. Purchase 제한 여부
2. URL/custom_data 제한 여부
3. 검토 요청 버튼 여부
4. `biocom.kr`과 보조 도메인의 제한 차이
5. advanced matching/user_data 제한 여부

## Source / window / confidence

- Source: TJ님 Meta Events Manager UI
- Window: 2026-05-15 KST Purchase attribution issue
- Freshness: TJ님이 확인하는 시각 기준
- Confidence: UI 확인 전 medium, UI 상세 확인 후 high 가능
