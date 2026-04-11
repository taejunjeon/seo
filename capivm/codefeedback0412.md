
* **기존 코드**: 헤더 상단의 네이버 스크립트, 여러 verification meta, GTM, Beusable, TikTok 보완 코드, 바디의 GTM noscript/keepgrow
* **변경 코드**:

  1. 헤더 상단에 **Meta Pixel Purchase Guard** 추가


## 한 줄 총평

**방향은 맞습니다.**
특히 지금 문제였던 **가상계좌 pending 주문의 브라우저 Purchase 오염**을 헤더 상단에서 가로채고, 별도로 **checkout_started / payment_success 원장 수집**을 푸터에서 보내는 구조는 전략적으로 맞습니다.

다만, **지금 그대로 넣으면 안 되는 치명적인 문제 2개**가 있고, **고쳐두면 좋은 문제 3개**가 있습니다.

---

## 가장 먼저 고쳐야 할 2개

### 1. `persistUtm()`가 기존 UTM을 망가뜨릴 가능성이 큽니다

지금 코드에서는 `userID`가 있으면 매 페이지마다 아래처럼 저장합니다.

* `utm_campaign || '0'`
* `utm_source || '0'`
* `utm_medium || '0'`
* `utm_content || '0'`

즉, **UTM이 없는 페이지에 들어왔을 때도 `0`으로 덮어씁니다.**
이건 심각합니다. 첫 유입 UTM이 이미 저장돼 있어도, 로그인 뒤 일반 페이지 하나만 열면 **진짜 UTM이 `0`으로 오염**될 수 있습니다. 이건 현재 구조에서 가장 큰 버그입니다.

### 제가 권하는 수정 원칙

* **UTM이 하나라도 실제로 있을 때만 저장**
* `0` 같은 placeholder는 저장하지 않음
* 가능하면 **first-touch와 latest-touch를 분리**
* 최소한 지금은 **기존 값을 빈 값으로 덮어쓰지 않음**

지금 코드의 의도는 “첫 방문 UTM 저장”인데, 실제 동작은 “로그인 후 현재 페이지의 빈 UTM으로 덮어쓰기”에 가깝습니다.

---

### 2. `payment-success` payload에 `order_code`가 빠져 있습니다

지금 브라우저 Pixel `Purchase`의 `event_id`는 이미
**`Purchase.{orderCode}`** 규칙으로 가고 있습니다.
그리고 Purchase Guard도 `order_code`를 중요하게 씁니다.

그런데 `payment-success` 전송 payload에는

* `orderId`
* `paymentKey`
* `checkoutId`
  는 있어도
* **`orderCode`가 없습니다**.

이건 아쉽습니다.
서버에서 다른 경로로 복원 가능하더라도, **브라우저에서 이미 URL에 있는 `order_code`를 바로 실어 보내는 게 맞습니다.**

### 왜 중요하냐

지금 dedup 핵심이 `Purchase.{orderCode}`인데,
payment_success 원장에도 `order_code`가 들어가야 **브라우저 Purchase / 서버 CAPI / 내부 원장**을 같은 키로 묶기가 쉬워집니다.

### 바로 넣는 게 좋은 값

* `orderCode`
* 가능하면 `order_member`도 같이
* metadata에도 중복 저장 가능

---

## 좋게 본 점

### 1. Purchase Guard를 헤더 상단에 두려는 점

이건 맞습니다.
이 스니펫은 Meta Pixel보다 먼저 실행돼야 의미가 있고, 문서에도 그 점이 명시돼 있습니다. 기존 코드 구조상 GTM이 헤더에 있으므로, **정말 GTM보다 위**에 두는 게 맞습니다.

### 2. Guard가 브라우저 Purchase만 건드리고 서버 CAPI는 안 건드리는 점

이 분리가 좋습니다.
지금 문제는 브라우저 pending `Purchase` 오염이었기 때문에, **브라우저만 가드**하고 **서버 confirmed CAPI는 그대로 두는 구조**가 맞습니다.

### 3. `checkout_started`와 `payment_success`를 별도 endpoint로 보내는 점

이건 방향이 좋습니다.
퍼널과 원장을 나눠서 보고, checkout-context를 sessionStorage로 이어붙이는 구조도 합리적입니다.

### 4. `keepalive: true`와 dedupe marker를 넣은 점

브라우저 종료 직전 전송 안정성을 조금이라도 높이려는 의도가 좋습니다.
`sessionStorage` dedupe marker도 현실적인 방어입니다.

---

## 고쳐두면 좋은 3개

### 3. Purchase Guard의 가상계좌 판별은 아직 브라우저 텍스트 의존이 강합니다

지금 Guard는 주문완료 페이지의 텍스트를 보고

* `가상계좌`
* `무통장`
* `계좌번호`
* `입금기한`
* `입금자`
* `입금대기`
  같은 키워드로 pending 여부를 추정합니다.

이건 지금 단계에서는 현실적인 해법이지만, **오탐/누락 가능성**이 있습니다.

예를 들어:

* 카드 결제 완료 페이지에 FAQ나 안내 문구로 “무통장” 텍스트가 섞이면 오탐 가능
* 반대로 아임웹 문구가 바뀌면 누락 가능

### 제 의견

* **1차는 지금 방식으로 가도 됨**
* 다만 **2차는 서버 상태 조회 API**로 가는 게 맞음

문서에도 이미 그 한계를 인정하고 있습니다. 그 판단은 맞습니다.

---

### 4. `waitForGtagAndSetUser()`는 무한 폴링이라 상한을 두는 게 좋습니다

현재는 `gtag`가 안 뜨면 100ms마다 계속 재시도합니다.

치명적 버그는 아니지만,

* GTM/GA가 차단된 환경
* 광고차단기
* 스크립트 로드 실패
  에서는 계속 돕니다.

### 권장

* 5초 또는 10초까지만 재시도
* 이후 중단
* 필요하면 debug 모드에서만 console 출력

---

### 5. `getUserID()`와 콘솔 로그가 중복되고 많습니다

`getUserID()`가 두 군데 중복 정의돼 있고, `console.log` / `console.warn`도 운영 환경에서는 꽤 많이 남습니다.

이건 기능 문제는 아니지만,

* 유지보수성
* 운영 콘솔 노이즈
* 디버깅 피로도
  측면에서 정리하는 게 좋습니다.

### 권장

* `getUserID()` 공통 함수 1개로 통합
* `debug` 플래그 있을 때만 로그 출력

---

## 기존 코드와의 충돌 가능성

### 1. GTM보다 위에 넣지 않으면 Guard가 무력화될 수 있습니다

기존 코드에서 GTM이 헤더에 이미 있습니다.
만약 Meta Pixel이 GTM 내부에서 먼저 발화하면, Purchase Guard가 뒤늦게 실행되어도 이미 늦습니다.

즉 배치 순서는 반드시:

1. **Purchase Guard**
2. GTM
3. 기타 Meta 관련 스크립트

여야 합니다.

---

### 2. 기존 헤더는 중복/누적이 많아서 이번 수정과 같이 손대는 순간 리스크가 커집니다

기존 헤더에는

* 네이버 wcs 스크립트 2회
* verification meta 여러 개
* facebook-domain-verification 2개
* TikTok 보완 코드
  가 뒤섞여 있습니다.

이건 이번 변경과 직접 충돌하진 않지만,
**지금 배포에서는 “정합성에 필요한 최소 변경만” 하는 게 맞습니다.**
즉 이번에는 정리 욕심내지 말고:

* Guard 추가
* 푸터 변경 추가
  까지만 하고, 나머지 청소는 다음 배치가 안전합니다.

---

## 이 코드의 전략적 판단

제가 보기엔 지금 변경안의 전략은 맞습니다.

### 맞는 이유

* Meta Browser `Purchase` 오염 문제를 직접 겨냥함
* Checkout Started / Payment Success를 별도로 원장화함
* 서버 CAPI 정합성과 병행 가능함

### 다만 아직 완성은 아님

지금 상태를 실전 배포 가능 수준으로 만들려면 최소한 아래 3개는 반영해야 합니다.

1. **UTM overwrite 버그 수정**
2. **payment_success에 `order_code` 추가**
3. **Guard를 진짜 GTM/Meta보다 먼저 배치**

---

## 상품명 API 관련 의견

지금 이 변경안 안에서는 **상품명 API는 아직 안 들어가 있습니다.**
그리고 그게 맞습니다. 지금 1순위는 아닙니다.

### 제 의견

상품명은 브라우저에서 실시간으로 긁지 말고,
**서버에서 주문 상세 기준으로 스냅샷 저장**하는 게 맞습니다.

이유:

* 브라우저 DOM 상품명은 언제든 깨질 수 있음
* 상품명이 수정되면 과거 주문과 달라질 수 있음
* CAPI 전송 시점마다 외부 API를 다시 때리면 불안정

즉,

* 지금은 `content_ids`, `order_code`, `orderId` 정합성 먼저
* 상품명은 다음 단계에서 서버 스냅샷 저장

순서가 맞습니다.

---

## 제 최종 의견

**비교 검토 가능했고, 방향은 맞습니다.**
하지만 지금 그대로 넣으면 안 되고, 아래 두 개는 반드시 먼저 고쳐야 합니다.

### 필수 수정

* `persistUtm()`이 빈 UTM으로 기존 값을 덮어쓰는 문제
* `payment-success` payload에 `order_code` 누락

### 배포 전 확인

* Purchase Guard가 **GTM보다 먼저** 실행되는지
* 카드 결제 완료에서 `Purchase` 유지되는지
* 가상계좌 미입금 완료에서 `Purchase`가 사라지고 `VirtualAccountIssued`만 뜨는지

검토한 새 코드:

원하시면 다음 답변에서 제가 바로
**“수정해야 할 줄단위 포인트”** 형태로,
어디를 어떻게 바꿔야 하는지 코드 수준으로 짧게 정리해드리겠습니다.
