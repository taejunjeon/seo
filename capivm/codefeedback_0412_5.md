지금 상태는 **부분 성공, 아직 미통과**로 보는 게 맞습니다.

핵심만 정리하면:

* **토스 PG 페이지에서 픽셀 안 뜨는 건 정상**입니다.
* **자사몰 `shop_payment_complete` 페이지에서 guard는 설치됐고**, `custom event sent` 로그까지 떴습니다.
* 그런데 **Pixel Helper에서 `Purchase`도 안 보이고, `VirtualAccountIssued`나 `PurchaseDecisionUnknown`도 명확히 안 보입니다.**
* 즉, **가드가 개입은 했는데 최종 브라우저 이벤트가 Meta에서 어떻게 처리됐는지 불명확**합니다.

그래서 지금은 새 버전 계속 꽂는 것보다, **이번 주문 1건에서 정확히 어떤 branch가 탔는지와 Meta 전송 방식이 무엇이었는지**를 먼저 밝혀야 합니다.
서버 decision guard의 의도 자체는 맞고, 문서상으로도 endpoint 안정성/CORS가 전제조건이었습니다.

아래 내용을 코덱스에 그대로 전달하면 됩니다.

현재 `server-payment-decision-guard-v3` 테스트 결과를 공유합니다. 새 코드 추가보다 먼저, 이번 주문 1건의 실제 분기와 전송 결과를 정확히 밝혀주세요.

테스트 케이스:

* 결제수단: 가상계좌
* 완료 URL:
  `https://biocom.kr/shop_payment_complete?order_code=o2026041299496e654e8c1&payment_code=pa20260412050bbe102fbea&order_no=202604125352055&rk=S`

브라우저 관찰:

* Toss PG 페이지에서는 Meta Pixel 없음: 이건 정상으로 봅니다.
* 자사몰 완료 페이지에서는 콘솔에 아래가 보였습니다.

  * `[biocom-server-payment-decision-guard] installed 2026-04-12-server-payment-decision-guard-v3`
  * `[biocom-server-payment-decision-guard] custom event sent Object`
* Pixel Helper에서는 최종적으로 `Purchase`도 안 보이고, `VirtualAccountIssued` 또는 `PurchaseDecisionUnknown`도 명확히 안 보입니다.
* 즉, guard는 개입한 것 같은데 최종 브라우저 이벤트가 Meta에서 어떻게 처리됐는지 불명확합니다.

요청사항:

1. 이번 주문 `order_no=202604125352055`, `order_code=o2026041299496e654e8c1`, `payment_code=pa20260412050bbe102fbea`에 대해 서버 `payment-decision` endpoint가 실제로 어떤 응답을 줬는지 확인해주세요.

   * `status`
   * `browserAction`
   * `reason`
   * Toss status/channel
     를 정확히 알려주세요.

2. v3 브라우저 코드에서 이번 케이스가 아래 중 어느 branch를 탔는지 명확히 로그로 남기게 해주세요.

   * `allow_purchase`
   * `block_purchase_virtual_account`
   * `block_purchase`
   * `hold_or_block_purchase`

3. `custom event sent Object` 로그에 eventName / eventId / method를 명시적으로 출력하게 바꿔주세요.

   * 예:

     * `eventName: VirtualAccountIssued`
     * `eventId: VirtualAccountIssued.o2026041299496e654e8c1`
     * `method: fbq | image_fallback`
       현재는 Object만 보여서 판단이 어렵습니다.

4. 이번 주문 완료 페이지에서 실제 네트워크 요청을 확인해주세요.
   확인 대상:

   * `https://www.facebook.com/tr/`
   * 쿼리스트링의 `ev=...`
   * `eid=...`
   * `cd[order_code]`, `cd[order_no]`, `cd[payment_code]`
     즉, 실제로 Meta로 나간 이벤트명이 `VirtualAccountIssued`인지 `PurchaseDecisionUnknown`인지 확인이 필요합니다.

5. Pixel Helper에 안 보이는 이유가 `image_fallback` 때문인지 확인해주세요.

   * 만약 fallback으로만 전송돼서 Pixel Helper에 안 보인다면, 그게 허용 가능한지 판단해야 합니다.
   * 허용 불가라면 `raw fbq` 준비 이후 `trackCustom`이 확실히 타도록 retry/dispatch 방식을 조정해주세요.

6. 이번 케이스는 새 버전(v4, v5 등)으로 더 가기 전에 root cause를 먼저 밝혀주세요.
   지금은 “브라우저 이벤트가 무엇으로 나갔는지”가 핵심이고, 추정 기반으로 새 guard를 더 올리는 단계는 아닌 것 같습니다.

원하는 산출물:

* 이번 주문 1건에 대한 서버 decision 응답
* 브라우저 branch 결과
* Meta 전송 이벤트명 / eventId / 전송 방식(fbq or image_fallback)
* 왜 Pixel Helper에 안 보였는지에 대한 결론
* 그 다음 수정안 1개만 제안

지금 제 의견은 **새 코드 더 넣기 전에 원인부터 확정**이 맞습니다.
특히 이번 건은 “가드가 아예 안 돈 것”이 아니라 **돌긴 돌았는데 최종 이벤트 관측이 안 되는 케이스**라서, 튜닝보다 진단이 우선입니다.
