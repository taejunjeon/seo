검토했습니다.
결론부터 말하면, **코덱스가 만든 푸터 최종안은 방향이 맞고, “최종 보고서에 있는 버전 그대로”면 테스트 반영 컨펌 가능합니다.**
다만 **지금 라이브에 올라가 있는 기존 푸터**는 아직 예전 버전이고, 그 버전은 그대로 쓰면 안 됩니다. 기존 버전에는 `persistUtm()`이 UTM이 없는 페이지에서도 `0`으로 저장해서 기존 값을 오염시킬 수 있고, `payment_success` 쪽도 `orderCode` / referrer fallback 보강이 없습니다. 반면 코덱스의 최종 보고서 버전은 이 둘을 보강했습니다.

## 한 줄 판단

**반영 기준은 명확합니다.**

* **반영 가능**: `codefeedback0412_2 반영 결과` 문서의 푸터 최종안 그대로
* **반영 불가**: 지금 라이브 기준의 기존 푸터, 또는 중간 단계 부분 패치만 적용한 버전

## 좋게 본 점

첫째, **UTM overwrite 버그를 제대로 잡았습니다.**
기존 푸터는 로그인한 상태에서 UTM이 없는 페이지에 들어오면 `utm_campaign/source/medium/content`를 `0`으로 저장할 수 있었는데, 최종안은 **실제 추적값이 있을 때만 저장**하고, `first_touch / latest_touch / legacy`를 분리합니다. 이건 실무적으로 큰 개선입니다.

둘째, **`payment_success`에 `orderCode`를 넣는 방향이 맞습니다.**
지금 Browser Purchase의 `event_id`가 `Purchase.{orderCode}` 구조이기 때문에, 내부 원장과 서버 CAPI도 `orderCode`를 같이 보유해야 Browser Pixel / Server CAPI / 내부 Attribution을 같은 주문으로 묶기가 쉬워집니다. 최종안은 top-level payload와 metadata 양쪽에 `orderCode`를 넣고, `browser_purchase_event_id`도 남깁니다.

셋째, **`payment_success`의 referrer fallback 보강도 맞습니다.**
최종안은 현재 URL뿐 아니라 `document.referrer`에서도 `orderCode`, `orderNo`, `orderId`, `orderMember`, `paymentKey`를 읽게 되어 있어, 주문완료 흐름에서 파라미터가 현재 URL에 다 남지 않는 경우를 더 잘 버팁니다.

## 지금 그대로 넣어도 되는가

**네. 단, 조건이 있습니다.**
아래 3개를 정확히 지키면 **테스트 반영 컨펌**입니다.

### 1. 푸터 첫 2개 스크립트는 최종 통합 블록으로 교체

즉 기존의:

* `getUserID / waitForGtagAndSetUser / persistUtm`
* `sendView`

이 두 블록은 제거하고, **최종 보고서의 `user_id / UTM / rebuyz_view 통합 블록` 하나로 교체**하는 게 맞습니다.

### 2. `checkout_context`는 그대로 유지

이번 배치 목적은:

* pending 가상계좌 Purchase 차단
* UTM overwrite 방지
* payment_success의 `orderCode` 보강

이지, checkout-started 전체 재작성 아닙니다. 그래서 **기존 `checkout_context` 블록 유지**가 맞습니다. 최종 보고서도 그 방향입니다.

### 3. `payment_success`는 “최종 전체 블록”으로 교체

여기서 중요한 포인트는,
**중간 문서의 부분 패치만 넣는 게 아니라, 최종 보고서에 있는 완성된 `payment_success` 블록 전체를 써야 한다**는 점입니다.

왜냐하면 현재 라이브 기준 기존 `payment_success`는:

* `orderCode` 없음
* `orderMember` 없음
* `referrerPayment` 없음
* `dedupeKey`도 `orderCode`를 고려하지 않음
* skip 조건도 `orderCode`를 고려하지 않음

상태이기 때문입니다. 최종안은 이걸 다 보강했습니다.

## 제 최종 판정

### 컨펌

* **헤더 상단 Purchase Guard**: 이미 삽입 완료, 배치 순서도 맞다고 보고서에서 확인됨
* **푸터 통합 UTM 블록**: 컨펌
* **기존 checkout_context 유지**: 컨펌
* **최종 payment_success 전체 블록 교체**: 컨펌

### 미컨펌인 경우

아래처럼 넣으면 안 됩니다.

* 기존 푸터 그대로 유지
* 중간 패치 문서 일부만 수작업 반영
* `payment_success`에 `orderCode`만 대충 추가하고 나머지 dedupeKey / skip / metadata를 안 바꾸는 경우

그 경우 다시 꼬일 수 있습니다.

## 남는 사소한 리스크 2개

이건 **막을 정도는 아니고**, 반영 후 확인하면 됩니다.

### 1. `rebuyz_view`는 계속 모든 페이지에서 발생

`actionDetail`이 `idx` 없으면 `no_idx`로 갑니다.
기존에도 그랬고, 최종안도 비슷한 성격입니다. 분석상 큰 문제는 아니지만, 나중에 이벤트 노이즈가 많다고 느끼면 **상품상세에서만 보내도록 줄일 수는 있습니다.**

### 2. 가상계좌 판정은 여전히 1차 방어

헤더 Guard는 브라우저 텍스트 기반입니다.
즉 완벽한 진실판정이 아니라 **현실적인 1차 방어**입니다. 이건 지금 단계에선 맞고, 나중에 서버 상태 조회 API가 생기면 더 단단하게 바꾸면 됩니다.

## 반영 후 꼭 볼 것

### 카드 결제 완료

* Pixel Helper에 `Purchase` 살아 있어야 함
* Browser Event ID가 `Purchase.{orderCode}`
* `payment_success` 원장 metadata에 `orderCode` 남아야 함
* Server CAPI event_id도 `Purchase.{orderCode}`여야 함

### 가상계좌 미입금 완료

* Pixel Helper에 `Purchase` 없어야 함
* `VirtualAccountIssued` 떠야 함
* `payment_success`는 pending 상태로 남아야 함
* Server CAPI 운영 Purchase 없어야 함

## 최종 답

**코덱스가 작성한 푸터 코드는 “최종 보고서 버전 그대로”면 테스트 반영 컨펌합니다.**
즉:

* 푸터 첫 2개 스크립트는 최종 통합 블록으로 교체
* `checkout_context`는 유지
* `payment_success`는 최종 전체 블록으로 교체

이렇게 가면 됩니다.
반대로 **현재 라이브 기준의 기존 푸터**나 **중간 패치 버전**은 미컨펌입니다.

원하시면 다음 답변에서 제가 **“아임웹 푸터에 그대로 붙여넣는 최종본”만 깔끔하게 다시 출력**해드리겠습니다.
