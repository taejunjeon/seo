봤습니다. **코드 자체는 v3로 바뀐 것 맞고, 결과는 “부분 성공”입니다.**
정확히 말하면:

* **가상계좌 pending 판정은 맞게 탔습니다**

  * `decision branch=block_purchase_virtual_account`
  * `status=pending`
  * `reason=toss_direct_api_status`
* **브라우저 `Purchase`는 막힌 쪽으로 보입니다**
* 하지만 **`VirtualAccountIssued`는 실제 네트워크 전송이 아직 확인되지 않았습니다**

  * 콘솔엔 `custom_event_sent ... method=fbq`가 뜨지만
  * Network에는 `VirtualAccountIssued`가 안 보이고
  * `custom_event_network_observed ... found=no matchCount=0`가 찍혔습니다

즉 현재 상태는 한 줄로 정리하면 이겁니다.

> **Purchase 차단은 거의 된 것 같은데, 대체 이벤트 `VirtualAccountIssued`는 실제 전송이 안 됐거나 관측되지 않고 있습니다.**

첨부 코드가 v3인 것도 맞습니다. `snippetVersion: '2026-04-12-server-payment-decision-guard-v3'`와 `custom_event_dispatch_start`, `custom_event_network_observed` 로그가 들어 있습니다. 그리고 작업 보고서도 **`found=no`일 때는 새 guard를 또 만드는 대신, 같은 eventId로 image fallback 1회 보강**이 다음 수정안이라고 정리하고 있습니다.  

## 제 피드백

지금은 **v4/v5로 또 넘어가면 안 됩니다.**
방향은 이미 정리됐고, 남은 문제는 아주 좁습니다.

### 현재 판정

* **로직 분기**: 맞음
* **Purchase 차단**: 거의 성공
* **VirtualAccountIssued 실제 전송**: 미통과

### 그래서 다음 수정은 딱 1개

**`custom_event_network_observed found=no`이면, 같은 eventId로 `image_fallback`을 1회 강제로 보내게 수정**
이게 맞습니다.

왜 이게 맞냐면:

* `VirtualAccountIssued`는 매출 이벤트가 아니라 보조 이벤트라서
* `Purchase` 중복처럼 위험하지 않고
* 지금 핵심은 “Meta에 대체 신호가 실제로 남느냐”이기 때문입니다.

반대로 지금 단계에서 새 버전으로 계속 갈아타면:

* 원인 분리가 안 되고
* 카드 결제 회귀 위험만 다시 커집니다.

## 코덱스에 전달할 프롬프트

최신 v3 테스트 결과 공유합니다. 현재 결론은 “Purchase 차단 분기는 맞지만, VirtualAccountIssued 실제 전송은 아직 미통과”입니다.

관찰값:

* 콘솔:

  * `decision branch=block_purchase_virtual_account status=pending reason=toss_direct_api_status matchedBy=toss_direct_order_id`
  * `custom_event_prepare eventName=VirtualAccountIssued eventId=VirtualAccountIssued.o2026041222e4335a04244`
  * `custom_event_dispatch_start eventName=VirtualAccountIssued eventId=VirtualAccountIssued.o2026041222e4335a04244 methodCandidate=fbq`
  * `custom_event_sent eventName=VirtualAccountIssued eventId=VirtualAccountIssued.o2026041222e4335a04244 method=fbq`
  * `custom_event_network_observed eventName=VirtualAccountIssued eventId=VirtualAccountIssued.o2026041222e4335a04244 found=no matchCount=0`
* Network:

  * `facebook.com/tr` 요청은 보이지만 `ev=VirtualAccountIssued`는 직접 확인되지 않음
  * 표준 이벤트(PageView/ViewContent/InitiateCheckout/AddPaymentInfo)만 보임
* Pixel Helper:

  * `Purchase` 없음
  * `VirtualAccountIssued`도 안 보임

요청:

1. 새 v4/v5로 넘어가지 말고, 현재 v3에서만 수정해 주세요.
2. 수정은 하나만:

   * `custom_event_sent method=fbq` 이후
   * `custom_event_network_observed found=no`이면
   * **같은 eventId**로 `image_fallback`을 **1회만** 추가 전송
   * 로그는 `method=image_fallback_after_observe_no`처럼 명시해 주세요.
3. 중복 방지:

   * 같은 `eventId`로 fallback 1회만 허용
   * 같은 페이지/같은 주문에서 반복 전송 금지
4. 그 다음 재테스트는 2건만:

   * 가상계좌 미입금: `Purchase` 없음 + `VirtualAccountIssued` 네트워크 확인
   * 카드 결제 완료: `Purchase` 유지, 회귀 없음 확인
5. 산출물:

   * 수정된 v3 코드
   * 가상계좌 / 카드 각각 기대 로그
   * Network에서 찾아야 할 `ev`, `eid` 예시

## 제 최종 의견

지금은 꽤 잘 좁혀졌습니다.
**가상계좌 pending을 `Purchase`로 보내지 않는 분기는 맞게 잡혔고, 남은 건 `VirtualAccountIssued`를 확실히 Meta에 남기는 마지막 1단계**입니다.

즉, 지금 상태는 실패가 아니라:

* **1단계 성공**: Purchase 차단
* **2단계 미완료**: 대체 이벤트 확정 전송

입니다.

다음 테스트에서

* `image_fallback_after_observe_no`로라도 `ev=VirtualAccountIssued`가 네트워크에 보이면
  그때는 **가상계좌 브라우저 오염 방지 쪽은 실전 통과**로 봐도 됩니다.
