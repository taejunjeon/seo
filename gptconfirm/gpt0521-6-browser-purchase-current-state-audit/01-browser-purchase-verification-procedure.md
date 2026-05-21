# Browser Purchase Verification Procedure

## 정의

Browser Purchase는 사용자의 브라우저가 Meta Pixel로 직접 보내는 구매 이벤트다.

기술적으로는 보통 아래 둘 중 하나로 보인다.

- `fbq('track', 'Purchase', ..., { eventID: '...' })`
- 브라우저 Network의 `https://www.facebook.com/tr/?...&ev=Purchase...` 요청

Server CAPI Purchase는 서버가 Meta Conversions API로 보내는 구매 이벤트다. CAPI 필드명은 `event_id`이고, Browser Pixel 쪽 옵션명은 `eventID`다. Network query에서는 `eid`로 보일 수 있다.

## Meta Events Manager에서 확인하는 방법

1. Meta Events Manager를 연다.
2. 데이터 소스에서 사이트별 Pixel을 선택한다.
   - Biocom: `1283400029487161`
   - TheCleanCoffee: `1186437633687388`
3. `이벤트 테스트` 또는 `Test Events` 탭을 연다.
4. 테스트할 웹사이트 URL을 입력해 새 브라우저 창을 연다.
5. test-only 완료 페이지 또는 TJ님이 의도한 테스트 주문 1건만 진행한다.
6. 이벤트 목록에서 `Purchase`를 찾는다.
7. `Purchase`를 펼쳐 다음을 확인한다.
   - received from Browser 여부
   - received from Server 여부
   - event ID 또는 dedup 관련 표시
   - URL이 완료 페이지인지
   - value/currency 표시 여부

판정:

- Browser Purchase가 보이면: 브라우저 구매 신호는 존재한다.
- Server만 보이면: 현재 구매 신호는 CAPI만 보낸 것으로 판단한다.
- Browser와 Server가 둘 다 보이면: eventID가 같은지 확인해야 한다.
- Browser와 Server eventID가 다르면: 같은 주문이 중복 집계될 수 있어 운영 혼합은 보류한다.

## Chrome Network에서 확인하는 방법

1. Chrome DevTools를 연다.
2. `Network` 탭을 선택한다.
3. `Preserve log`를 켠다.
4. 필터에 `facebook.com/tr` 또는 `/tr/?`를 입력한다.
5. test-only 완료 페이지 1건을 연다.
6. 요청 목록에서 `ev=Purchase`가 들어간 요청을 찾는다.
7. 해당 요청의 Query String Parameters에서 아래를 확인한다.
   - `id`: Pixel ID
   - `ev`: `Purchase`
   - `eid`, `eventID`, `event_id`: Browser eventID 후보
   - `fbp`, `fbc`: 브라우저/클릭 매칭 단서
   - `value`, `currency` 또는 `cd[...]` 안의 값

판정:

- `ev=Purchase` 요청이 없으면 해당 샘플에서는 Browser Purchase가 발화되지 않은 것이다.
- `ev=Purchase`는 있는데 eventID 후보가 없으면 Server CAPI와 안정적으로 dedup할 수 없다.
- eventID 후보가 있으면 원문을 보고서에 쓰지 말고 secure evidence 내부에서만 CAPI event_id와 exact match를 비교한다.

## Network sample 설계

- 샘플 수: 1건.
- 방식: test-only 완료 페이지 또는 TJ님이 이미 진행하기로 한 결제완료 테스트 1건.
- 금지: 미입금/가상계좌/unknown 구매를 Purchase로 발화.
- 금지: GTM publish, Footer/Header 저장, Pixel 전체 재삽입.
- 성공 기준: Browser `ev=Purchase` 존재 여부와 eventID 후보 위치를 확인한다.
