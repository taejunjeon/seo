# 더클린커피 P1-S1A 테스트베드 구현안 — 조사 결과

작성일: 2026-04-01

## 10초 요약

아임웹 더클린커피 사이트의 **헤더/바디/푸터 코드 삽입**으로 `payment-success`와 `checkout-context` receiver를 호출할 수 있다. 결제완료 페이지 URL은 `?mode=shop_order_done`이고, 장바구니는 `?mode=shop_cart`. CORS 허용 목록에 `thecleancoffee.com`을 추가 완료. 다만 결제완료 페이지에서 `orderId/paymentKey`를 JS로 직접 가져오는 것은 아임웹 DOM 구조에 의존하므로 **URL 파라미터 또는 dataLayer 방식**이 안정적이다.

## 현재 가능/불가능

| 항목 | 가능 여부 | 근거 |
|------|----------|------|
| 아임웹 헤더/바디/푸터에 JS 삽입 | ✅ | 이미 GTM/Meta/Beusable 등 삽입되어 동작 중 |
| 결제완료 페이지 존재 | ✅ | `?mode=shop_order_done` (200 OK) |
| 장바구니 페이지 존재 | ✅ | `?mode=shop_cart` (200 OK, Google Ads 전환 코드 이미 있음) |
| 결제완료에서 orderId 직접 접근 | ⚠️ | DOM에 주문번호가 렌더링되면 가능하지만, 아임웹 버전에 따라 다를 수 있음 |
| sessionStorage 유지 | ✅ | 같은 도메인 내 페이지 이동이므로 유지됨 |
| CORS 허용 | ✅ | `thecleancoffee.com`을 백엔드 allowedOrigins에 추가 완료 |
| sendBeacon | ✅ | 모든 모던 브라우저 지원. 페이지 언로드 시에도 전송 가능 |
| 기존 스크립트와 충돌 | ⚠️ | GTM/Meta/Beusable 등과 window 이벤트 충돌 가능성 낮음 (addEventListener 방식이면 안전) |
| dataLayer push | ✅ | GTM `GTM-5M33GC4`가 이미 있고 `dataLayer` 8회 참조됨 |

## 아임웹 삽입 위치별 구현 가능성

| 위치 | 적합한 용도 | 비고 |
|------|-----------|------|
| **헤더 상단** | UTM/landing 저장 스크립트 | 모든 페이지에서 가장 먼저 실행 |
| **헤더** | checkout-context (장바구니 감지) | URL 패턴 감지로 `shop_cart` 진입 시 발동 |
| **바디** | 보조 스크립트, GTM noscript | 이미 GTM/Keepgrow 있음 |
| **푸터** | payment-success (결제완료 감지) | 현재 비어있음 → **여기에 삽입 최적** |
| **결제완료 페이지 전용** | 아임웹에 결제완료 전용 삽입 없음 | 헤더/푸터 코드에서 URL 패턴으로 분기 |

## V0: payment-success만

### 구현

**푸터 코드에 삽입:**

```javascript
<!-- P1-S1A: Payment Success Receiver (V0) -->
<script>
(function() {
  if (!window.location.href.includes('mode=shop_order_done')) return;

  var data = {
    touchpoint: 'payment_success',
    captureMode: 'live',
    orderId: '', // 아래에서 추출 시도
    approvedAt: new Date().toISOString(),
    landing: document.referrer || '',
    userAgent: navigator.userAgent,
    source: 'thecleancoffee_imweb'
  };

  // 주문번호 추출 시도 (아임웹 DOM에서)
  var orderEl = document.querySelector('.order-number, .order_no, [data-order-no]');
  if (orderEl) data.orderId = orderEl.textContent.trim();

  // URL 파라미터에서 주문번호 추출 시도
  var params = new URLSearchParams(window.location.search);
  if (params.get('order_no')) data.orderId = params.get('order_no');
  if (params.get('orderId')) data.orderId = params.get('orderId');

  // 전송
  var endpoint = 'https://YOUR_BACKEND/api/attribution/payment-success';
  if (navigator.sendBeacon) {
    navigator.sendBeacon(endpoint, JSON.stringify(data));
  } else {
    fetch(endpoint, { method: 'POST', body: JSON.stringify(data), headers: {'Content-Type':'application/json'}, keepalive: true });
  }
})();
</script>
```

### 수집 필드
- `touchpoint`: 'payment_success'
- `captureMode`: 'live'
- `orderId`: DOM 또는 URL 파라미터에서 추출
- `approvedAt`: 클라이언트 시각
- `landing`: referrer
- `userAgent`

### 검증
1. 실제 결제 1건 수행
2. `GET /api/attribution/ledger` → live row 1건 확인
3. orderId가 잡히면 Toss API로 크로스 검증

### 실패 시 fallback
- orderId를 못 잡아도 `touchpoint=payment_success` + 시각 정보만으로 live row 적재 가능
- 나중에 Toss 거래 시각과 대조하여 orderId를 역매칭

## V1: landing/utm 저장 + payment-success

### 추가 구현 — 헤더 상단에 삽입:

```javascript
<!-- P1-S1A: Landing/UTM Capture (V1) -->
<script>
(function() {
  // 최초 랜딩에서만 저장 (이미 있으면 덮어쓰지 않음)
  if (sessionStorage.getItem('_p1s1a_captured')) return;

  var params = new URLSearchParams(window.location.search);
  var data = {
    landing: window.location.href,
    referrer: document.referrer || '',
    utm_source: params.get('utm_source') || '',
    utm_medium: params.get('utm_medium') || '',
    utm_campaign: params.get('utm_campaign') || '',
    utm_content: params.get('utm_content') || '',
    gclid: params.get('gclid') || '',
    fbclid: params.get('fbclid') || '',
    ttclid: params.get('ttclid') || '',
    timestamp: new Date().toISOString()
  };

  sessionStorage.setItem('_p1s1a_landing', JSON.stringify(data));
  sessionStorage.setItem('_p1s1a_captured', '1');
})();
</script>
```

### 푸터 payment-success에서 landing 데이터 합치기:

```javascript
// V0 코드에 추가:
var landing = {};
try { landing = JSON.parse(sessionStorage.getItem('_p1s1a_landing') || '{}'); } catch(e) {}
Object.assign(data, landing);
```

## V2: checkout-context + payment-success

### 추가 구현 — 헤더에 삽입:

```javascript
<!-- P1-S1A: Checkout Context (V2) -->
<script>
(function() {
  // 장바구니 페이지 진입 감지
  if (!window.location.href.includes('shop_cart') && !window.location.href.includes('shop_pay')) return;

  var landing = {};
  try { landing = JSON.parse(sessionStorage.getItem('_p1s1a_landing') || '{}'); } catch(e) {}

  var data = {
    touchpoint: 'checkout_started',
    captureMode: 'live',
    landing: landing.landing || '',
    referrer: landing.referrer || '',
    utm_source: landing.utm_source || '',
    gclid: landing.gclid || '',
    fbclid: landing.fbclid || '',
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    source: 'thecleancoffee_imweb'
  };

  var endpoint = 'https://YOUR_BACKEND/api/attribution/checkout-context';
  if (navigator.sendBeacon) {
    navigator.sendBeacon(endpoint, JSON.stringify(data));
  } else {
    fetch(endpoint, { method: 'POST', body: JSON.stringify(data), headers: {'Content-Type':'application/json'}, keepalive: true });
  }
})();
</script>
```

## 위험요소 5개

1. **orderId 추출 불안정**: 아임웹 결제완료 페이지 DOM 구조가 버전 업데이트로 바뀔 수 있음. DOM selector 대신 URL 파라미터 우선 사용.
2. **CORS 차단**: 백엔드가 로컬(7020)이면 HTTPS → HTTP 호출 불가. 백엔드를 HTTPS로 배포하거나 프록시 필요. → 현재는 로컬 테스트용.
3. **sessionStorage 유실**: 브라우저 시크릿 모드, 다른 탭에서 결제 시 유실. V1에서 localStorage도 병행 추천.
4. **결제 수단별 동작 차이**: 카드(즉시 결제완료) vs 가상계좌(입금 후 완료) vs 계좌이체 → 결제완료 페이지 진입 시점이 다름.
5. **기존 GTM 태그와 중복**: GTM에서 이미 `conversion` 이벤트를 발송 중. 우리 스크립트가 추가 이벤트를 보내면 Google Ads 전환이 중복 카운트될 수 있음. → attribution 전용 endpoint로 분리하여 회피.

## 검증 체크리스트

- [ ] 백엔드 CORS에 `thecleancoffee.com` 추가 ✅ (완료)
- [ ] 백엔드를 HTTPS로 접근 가능한 환경 배포 (ngrok 또는 Vercel)
- [ ] V0 코드를 아임웹 푸터에 삽입
- [ ] 테스트 주문 1건 수행 (드립백 10,900원)
- [ ] `GET /api/attribution/ledger` → live row 1건 확인
- [ ] orderId가 잡혔는지 확인
- [ ] orderId가 잡혔으면 Toss API로 결제 상세 검증
- [ ] V1 코드를 아임웹 헤더 상단에 삽입
- [ ] UTM 파라미터가 있는 URL로 방문 후 결제 → UTM 데이터가 receiver에 포함되는지 확인

## 역할 분리

### TJ님이 해야 할 것

1. 아임웹 관리자 > 코드 삽입에서 **푸터 코드**에 V0 스크립트 삽입
2. **헤더 상단 코드**에 V1 UTM 캡처 스크립트 삽입
3. 테스트 주문 1건 수행 (결제완료 페이지까지 도달)
4. 백엔드 HTTPS 접근 가능 여부 확인 (현재 localhost:7020은 외부 접근 불가)

### Claude Code/Codex가 할 것

1. ✅ CORS 허용 목록에 `thecleancoffee.com` 추가 완료
2. V0/V1/V2 코드 최종 확정 (endpoint URL 확정 후)
3. 백엔드 HTTPS 배포 또는 ngrok 터널 설정
4. 테스트 주문 후 ledger 검증
5. orderId 추출 로직 개선 (DOM 구조 확인 후)

## 가장 중요한 선행 조건

현재 백엔드가 `localhost:7020`이라 더클린커피 사이트에서 직접 호출할 수 없다. 아래 중 하나가 먼저 필요:

1. **ngrok으로 임시 터널**: `ngrok http 7020` → HTTPS URL 생성 → 아임웹 코드에 삽입
2. **Vercel/Railway에 백엔드 배포**: attribution endpoint만 분리 배포
3. **seo 백엔드를 workspace.biocom.ai.kr 서버에 배포**: 개발팀 협조 필요

**가장 빠른 것은 ngrok.** 무료 계정으로도 가능.
