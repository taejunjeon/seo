# Next Actions And Approval

작성 시각: 2026-05-15 03:01 KST

## Codex가 할 일

### 1. VM Cloud backend guard 배포 승인안

- 추천 점수/자신감: 92%.
- 의존성: 로컬 patch와 test는 완료. TJ님 Yellow 승인 후 실행 가능.
- 무엇을 하는가: VM Cloud backend에 `payment_page_seen` endpoint, checkout-context 확장, payment-success downgrade guard, value guard를 배포한다.
- 왜 하는가: Footer v4.4.2는 오염을 줄였지만, VM Cloud backend가 정식 touchpoint/guard를 가져야 같은 문제가 반복되지 않는다.
- 어떻게 하는가: pre-snapshot → remote backup → backend build/typecheck → seo-backend restart → post-snapshot 순서로 진행한다.
- 성공 기준: `/api/attribution/payment-page-seen` 201, `/shop_payment/` payment-success payload 202 downgrade, `/total`/기존 attribution API 200, Meta send 0.
- 실패 시 해석: API 5xx 또는 payment_success 오염이 보이면 rollback 후 route guard를 재점검한다.
- 승인 필요 여부: VM Cloud backend deploy/restart는 Yellow 승인 필요.

### 2. Browser non-purchase event row-level 캡처 정리

- 추천 점수/자신감: 78%.
- 의존성: TJ님 브라우저 Network 캡처 필요. Codex headless는 보조 source로만 사용.
- 무엇을 하는가: ViewContent/AddToCart/InitiateCheckout/AddPaymentInfo 각각 `facebook.com/tr` 요청이 실제로 나가는지 이벤트별로 확인한다.
- 왜 하는가: Meta UI에 보이는 집계와 브라우저 Network firing을 분리해야 Pixel 장애인지 UI 표시 문제인지 닫을 수 있다.
- 어떻게 하는가: Chrome DevTools Network filter `facebook.com/tr`에서 Query String Parameter `ev=`를 확인한다.
- 성공 기준: Purchase 없이 non-purchase events가 기대 동작별로 200을 받는다.
- 실패 시 해석: 특정 이벤트만 안 보이면 아임웹 FBE/native trigger 문제 또는 해당 행동을 실행하지 않은 문제로 분리한다.
- 승인 필요 여부: 없음. 단 Purchase test-only는 별도 승인 필요.

### 3. Browser Purchase test-only 설계 유지

- 추천 점수/자신감: 70%.
- 의존성: test_event_code와 운영 count delta 0 보장 필요.
- 무엇을 하는가: 운영 Purchase count를 늘리지 않는 browser/server dedup 테스트 경로를 유지한다.
- 왜 하는가: 서버 test-only Purchase는 통과했지만 browser Purchase와 server CAPI dedup은 아직 완전히 닫히지 않았다.
- 성공 기준: test-only browser Purchase 1건 이하, server test 1건 이하, 동일 event_id, 운영 Purchase count delta 0.
- 실패 시 해석: test-only 보장이 안 되면 실행하지 않고 설계만 보완한다.
- 승인 필요 여부: Browser Purchase test 실행은 별도 승인 필요.

## TJ님이 할 일

### 1. VM Cloud backend guard 배포 승인 여부 결정

- 추천 점수/자신감: 92%.
- 의존성: 없음. 로컬 검증 완료.
- 무엇을 승인하는가: VM Cloud backend에 결제 진행 페이지를 구매완료로 보지 않는 서버 guard를 배포하는 것.
- 왜 필요한가: Imweb footer가 다시 잘못 들어가거나 다른 경로가 `/payment-success`를 호출해도 서버가 막아야 한다.
- 어디에서 무엇이 바뀌는가: `att.ainativeos.net` VM Cloud backend route와 Meta CAPI 후보 필터.
- 성공 기준: 배포 후 결제 진행 페이지는 `payment_page_seen`, 진짜 완료 URL만 `payment_success`.
- 실패 시 다음 확인점: API 5xx, 기존 summary/attribution route regression, downgrade 조건 과잉 적용.
- Codex가 대신 못 하는 이유: deploy/restart는 Yellow Lane이라 TJ님 승인 전 실행 금지.

### 2. Meta Events Manager에서 non-purchase 이벤트 캡처

- 추천 점수/자신감: 78%.
- 의존성: TJ님 브라우저/Meta 계정 세션 필요.
- 무엇을 확인하는가: 상품 조회, 장바구니, 결제 시작, 결제수단 선택 시 `ev=ViewContent`, `ev=AddToCart`, `ev=InitiateCheckout`, `ev=AddPaymentInfo`가 나가는지.
- 왜 필요한가: PageView는 확인됐지만 나머지는 Meta UI 집계와 코드상 가능성만 있고 row-level Network 근거가 부족하다.
- 어떻게 하는가: DevTools Network filter `facebook.com/tr`를 켜고 각 행동을 한 뒤 요청 Query String의 `ev=`를 확인한다.
- 성공 기준: 각 이벤트가 status 200이고 Pixel `1283400029487161`이다. 미입금/결제진행에서는 `ev=Purchase`가 없어야 한다.
- 실패 시 다음 확인점: 해당 이벤트를 발생시키는 실제 UI 행동, 아임웹 FBE 설정, 브라우저 차단 확장, Meta Test Events 세션 연결.
- Codex가 대신 못 하는 이유: 실제 Meta 계정 세션과 TJ님 브라우저에서 열리는 Imweb/FBE event context가 필요하다.

## 금지선

- Meta 운영 Purchase send 금지.
- Imweb footer 추가 저장 금지.
- GTM publish 금지.
- 운영DB write/import 금지.
- VM Cloud deploy/restart는 승인 전 금지.
- raw order/payment/click/member/email/phone 값은 문서/채팅/Telegram/git에 출력 금지.
