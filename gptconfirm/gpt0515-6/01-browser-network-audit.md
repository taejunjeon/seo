# Browser Pixel Network Audit

작성 시각: 2026-05-15 03:01 KST

```yaml
harness_preflight:
  lane: Green read-only audit
  source_window_freshness_confidence:
    source: "TJ님 Chrome Network evidence + biocom.kr live HTML + Meta UI screenshot context"
    window: "2026-05-15 02:00-03:01 KST"
    freshness: "2026-05-15 03:01 KST"
    site: "biocom"
    confidence: 0.88
  forbidden_actions:
    - Meta 운영 Purchase send
    - browser Purchase fire without test-only guarantee
    - Imweb code save
    - GTM publish
    - raw identifier output
```

## 결론

브라우저 Pixel 자체는 죽지 않았다. TJ님 브라우저 Network에서 `facebook.com/tr` PageView 요청이 Pixel `1283400029487161`로 나갔고 HTTP 200을 받았다. 따라서 Meta Test Events 화면에 PageView가 바로 안 보이는 현상은 우선 `Test Events UI blind` 또는 세션 매칭 문제로 본다.

## 이벤트별 판정

| 이벤트 | Network 기준 | Meta UI/코드 기준 | 판정 |
|---|---:|---:|---|
| PageView | 확인됨, HTTP 200 | Pixel base code 존재 | firing 확인 |
| ViewContent | TJ님 row-level Network 캡처 미확인 | Meta UI 일 집계 활성, live code wrapper 대상 | 추가 캡처 필요 |
| AddToCart | TJ님 row-level Network 캡처 미확인 | Meta UI 일 집계 활성, live code wrapper 대상 | 추가 캡처 필요 |
| InitiateCheckout | TJ님 row-level Network 캡처 미확인 | Meta UI 일 집계 활성, live code wrapper 대상 | 추가 캡처 필요 |
| AddPaymentInfo | row-level 근거 부족 | live code wrapper 대상이지만 Meta UI에서 강한 근거 부족 | firing 불충분 |
| Purchase | 미입금/결제진행에서는 발화 금지 | v4.4.2가 직접 Purchase를 쏘지 않음 | guard 방향 정상 |

## Network와 Meta UI를 분리해서 보는 이유

Meta Test Events는 브라우저 세션, referrer, test page open 방식, 이벤트 처리 지연 때문에 실제 Network firing과 다르게 보일 수 있다. 반대로 Chrome Network의 `facebook.com/tr` 200 응답은 브라우저가 Meta endpoint에 실제로 요청을 보냈다는 직접 증거다.

이번 증거에서 중요한 점은 `dl=https://biocom.kr`, `ev=PageView`, Pixel `1283400029487161`, status 200이다. 이 조합은 최소한 PageView browser Pixel이 동작한다는 뜻이다.

## live HTML 확인

- Pixel ID: `1283400029487161`
- `fbq('track','PageView')` 존재.
- Funnel CAPI wrapper는 ViewContent/AddToCart/InitiateCheckout/AddPaymentInfo를 관찰 대상으로 둔다.
- `enableServerCapi=false`: 브라우저 Pixel을 끄는 설정이 아니라, 해당 wrapper의 server mirror만 끄는 설정이다.
- Footer v4.4.2는 `/shop_payment/`에서 `payment_page_seen`만 보내고 Meta Purchase를 직접 발화하지 않는다.

## TJ님 브라우저에서 추가 확인할 것

1. 상품 상세 페이지에서 Network filter를 `facebook.com/tr`로 두고 `ev=ViewContent`가 나오는지 본다.
2. 장바구니 담기 버튼을 누른 뒤 `ev=AddToCart`가 나오는지 본다.
3. 결제 시작 또는 주문서 진입 후 `ev=InitiateCheckout`가 나오는지 본다.
4. 결제수단 선택 후 `ev=AddPaymentInfo`가 나오는지 본다.
5. 미입금/결제진행 테스트에서는 `ev=Purchase`가 나오면 안 된다.

이 확인은 Codex가 계정 브라우저 세션을 대신 볼 수 없어 TJ님 브라우저가 primary source다. Codex headless Playwright는 Meta browser event가 안정적으로 관찰되지 않아 이번 판단 source로 쓰지 않았다.
