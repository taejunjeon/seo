# InitiateCheckout Browser Event ID Audit

작성 시각: 2026-05-22 12:47 KST
기준일: 2026-05-22
문서 성격: Meta InitiateCheckout 브라우저 이벤트 ID와 서버 CAPI 중복 제거 가능성 점검

## 10초 요약

방금 테스트에서 확인된 `InitiateCheckout` 이벤트 ID는 Biocom Imweb Footer Block4가 만든 브라우저 fallback 이벤트 ID다.
이 ID는 raw 주문/회원 식별자를 포함하지 않는 safe event ID 형태다.

그러나 현재 구조에서는 이 ID가 브라우저의 `sessionStorage`와 Meta Pixel beacon에만 남고, VM Cloud가 자동으로 읽어 서버 CAPI에 재사용하지는 않는다.
따라서 지금 VM Cloud가 별도 `InitiateCheckout` CAPI를 보내면 브라우저 이벤트와 같은 이벤트로 중복 제거된다고 보장할 수 없다.

## 확인한 것

### 1. 브라우저 이벤트는 Block4 fallback에서 발생했다

확인된 이벤트 ID 패턴:

```text
biocom.block4.InitiateCheckout.<safe_hash>
```

의미:

- `biocom`: 사이트
- `block4`: Imweb Footer Block4 fallback 코드
- `InitiateCheckout`: Meta 표준 이벤트명
- `<safe_hash>`: 주문/회원 원문이 아닌 브라우저 코드가 만든 안전한 해시성 ID

### 2. Block4는 같은 브라우저 세션 안에서 중복을 막는다

Block4 v0.5는 `InitiateCheckout`을 보낼 때 아래 정보를 브라우저 `sessionStorage`에 저장한다.

- 보낸 이벤트명
- safe event ID
- 발화 시각
- 코드 버전

이 덕분에 같은 브라우저 세션에서 같은 결제 시작 이벤트를 반복 발화하지 않는다.

### 3. VM Cloud 서버 CAPI endpoint는 event ID를 받을 준비가 되어 있다

VM Cloud의 `/api/meta/capi/track`는 `eventId`를 필수로 받는다.
이 구조 자체는 브라우저와 서버가 같은 `eventId`를 쓰는 중복 제거에 맞다.

다만 현재 Block4가 만든 event ID가 VM Cloud로 자동 전달되는 연결은 없다.

## 판단

### 지금 `InitiateCheckout` CAPI를 바로 켜면 안 되는 이유

브라우저는 이미 `InitiateCheckout`을 보낸다.
여기에 VM Cloud가 같은 행동을 다른 `event_id`로 한 번 더 보내면 Meta가 서로 다른 이벤트로 볼 수 있다.

즉, 실제 결제 시작 1건이 아래처럼 보일 위험이 있다.

```text
브라우저 InitiateCheckout 1건
+ 서버 CAPI InitiateCheckout 1건
= Meta 관점에서 2건처럼 보일 수 있음
```

이 문제는 Purchase보다 덜 치명적이지만, 결제 시작률과 캠페인 퍼널 진단을 부풀릴 수 있다.

## 권장 방향

### P0. 지금은 브라우저 InitiateCheckout 유지

현재 브라우저 `InitiateCheckout`은 실제로 발화되고 있다.
따라서 서버 CAPI를 바로 추가하는 것보다, value/currency와 event ID 품질을 안정화하는 것이 우선이다.

### P1. 서버 CAPI가 필요하면 같은 event ID를 쓰는 경로로만 진행

선택지는 두 가지다.

1. Phase 9 mirror 경로
   브라우저가 만든 event ID를 그대로 VM Cloud `/api/meta/capi/track`에 보내는 방식이다.
   중복 제거 측면에서는 가장 직접적이지만 Imweb 코드 설정 변경이 필요하다.

2. Block4 event ID bridge
   Block4가 만든 event ID를 VM Cloud 원장에 no-send evidence로 저장한 뒤, 서버 CAPI preview가 같은 ID를 재사용하게 만든다.
   이 역시 Imweb footer 변경이 필요하다.

### P2. VM Cloud backend-only InitiateCheckout CAPI는 보류

Imweb 코드를 전혀 바꾸지 않고 VM Cloud만으로 같은 browser event ID를 재사용하기는 어렵다.
현재 event ID의 safe hash는 브라우저의 checkout ID와 날짜 bucket을 기반으로 만들어지며, VM Cloud의 결제 시작 후보 row만으로 동일 값을 안정적으로 재현할 수 없다.

## 결론

`InitiateCheckout`은 이미 브라우저에서 살아 있다.
따라서 지금 가장 안전한 선택은 서버 CAPI 운영 전송을 보류하고, 브라우저 이벤트 ID를 VM Cloud가 재사용할 수 있는 bridge를 먼저 설계하는 것이다.

## Source / Window / Freshness / Confidence

- source: Imweb Footer Block4 v0.5 candidate, VM Cloud backend `/api/meta/capi/track` local source audit, TJ님 실제 Meta Pixel Helper evidence
- window: 2026-05-22 테스트 세션 기준
- freshness: 2026-05-22 12:47 KST
- confidence: 0.92

## 금지선

- Meta 운영 `InitiateCheckout` CAPI 전송: 실행하지 않음
- VM Cloud deploy/restart: 실행하지 않음
- GTM publish: 실행하지 않음
- Imweb header/footer 변경: 실행하지 않음
- raw order/member/payment identifier 출력: 하지 않음
