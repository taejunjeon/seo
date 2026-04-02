# P1-S1A 더클린커피 Live Row 구현 — 실행안 결과

작성일: 2026-04-01

## 10초 요약

코드 준비는 완료. CORS 허용, sendBeacon 파싱, attribution receiver 보강까지 끝남.
**남은 블로커 1개: 외부에서 접근 가능한 HTTPS endpoint.**
ngrok은 authtoken 미설정으로 실패. TJ님이 ngrok 계정 설정하거나, 다른 방법(Vercel/Cloudflare Tunnel)으로 HTTPS URL을 열어야 함.

## Go / No-Go

| 항목 | 상태 |
|------|------|
| 백엔드 코드 준비 | ✅ Go |
| CORS 허용 (thecleancoffee.com) | ✅ Go |
| sendBeacon text/plain 파싱 | ✅ Go |
| attribution receiver (V0/V1) | ✅ Go |
| 아임웹 삽입 포인트 확인 | ✅ Go |
| 결제완료 페이지 URL 확인 | ✅ `?mode=shop_order_done` |
| **HTTPS 외부 endpoint** | **❌ No-Go** — ngrok authtoken 필요 |

**결론: 코드 90% 준비, HTTPS endpoint 확보만 남음.**

## 구현 완료 내역

### 1. CORS 허용 (완료)

`server.ts` allowedOrigins에 추가:
- `https://thecleancoffee.com`
- `https://www.thecleancoffee.com`
- `https://thecleancoffee.imweb.me`
- `https://biocom.kr`
- `https://www.biocom.kr`

### 2. sendBeacon text/plain 파싱 (완료)

- `server.ts`에 `express.text({ type: "text/plain" })` 미들웨어 추가
- `routes/attribution.ts`에 `parseBody()` 함수 추가 — string body를 JSON.parse

### 3. 결제완료 페이지 조사 결과

| 항목 | 결과 |
|------|------|
| URL | `?mode=shop_order_done` (200 OK) |
| dataLayer purchase push | ❌ 없음 (GTM 컨테이너 내부에서만 처리 가능) |
| 전역 JS 변수 (orderData 등) | ❌ 직접 확인 불가 |
| URL 파라미터 (order_no) | ❌ 기본 URL에는 없음 |
| DOM에서 주문번호 | ⚠️ 실제 결제 후 렌더링되는 DOM에 있을 수 있으나, 비로그인 상태에서는 확인 불가 |

**orderId 추출 전략 (우선순위):**
1. URL 파라미터 (`order_no`, `orderId`) — 가장 안정적이지만 아임웹이 넣어주는지 미확인
2. DOM `.order-number` 등 — 실제 결제 후 확인 필요
3. 없으면 orderId 없이 시각 정보만으로 live row 적재 → 나중에 Toss 거래 시각과 역매칭

### 4. 장바구니/결제 감지

- `shop_cart`: Google Ads 전환 코드가 이미 `endsWith('shop_cart')`로 감지 중
- `shop_pay`: HTML에서 `shop_payment` 클래스 확인됨
- **V2 checkout-context는 같은 URL 패턴으로 감지 가능**

## 오늘 바로 넣을 코드 2개

### 코드 1: 헤더 상단 — V1 Landing/UTM 저장

```html
<!-- P1-S1A V1: Landing/UTM Capture -->
<script>
(function(){
  if(sessionStorage.getItem('_att_ok'))return;
  var p=new URLSearchParams(location.search);
  var d={
    landing:location.href,
    referrer:document.referrer||'',
    utm_source:p.get('utm_source')||'',
    utm_medium:p.get('utm_medium')||'',
    utm_campaign:p.get('utm_campaign')||'',
    utm_content:p.get('utm_content')||'',
    gclid:p.get('gclid')||'',
    fbclid:p.get('fbclid')||'',
    ts:new Date().toISOString()
  };
  sessionStorage.setItem('_att_landing',JSON.stringify(d));
  sessionStorage.setItem('_att_ok','1');
})();
</script>
```

**삽입 위치**: 아임웹 관리자 > SEO > 공통 코드 삽입 > **Header Code 상단**

### 코드 2: 푸터 — V0 Payment Success

```html
<!-- P1-S1A V0: Payment Success Receiver -->
<script>
(function(){
  if(location.href.indexOf('shop_order_done')<0)return;
  var landing={};
  try{landing=JSON.parse(sessionStorage.getItem('_att_landing')||'{}')}catch(e){}
  var d={
    touchpoint:'payment_success',
    captureMode:'live',
    orderId:'',
    approvedAt:new Date().toISOString(),
    userAgent:navigator.userAgent,
    source:'thecleancoffee_imweb'
  };
  // orderId 추출 시도
  var el=document.querySelector('[class*="order-number"],[class*="order_no"],[data-order]');
  if(el)d.orderId=el.textContent.trim();
  var ps=new URLSearchParams(location.search);
  if(ps.get('order_no'))d.orderId=ps.get('order_no');
  if(ps.get('orderId'))d.orderId=ps.get('orderId');
  // landing 합치기
  Object.keys(landing).forEach(function(k){d[k]=landing[k]});
  // 전송
  var url='ENDPOINT_URL/api/attribution/payment-success';
  if(navigator.sendBeacon){
    navigator.sendBeacon(url,JSON.stringify(d));
  }else{
    fetch(url,{method:'POST',body:JSON.stringify(d),headers:{'Content-Type':'application/json'},keepalive:true});
  }
})();
</script>
```

**삽입 위치**: 아임웹 관리자 > SEO > 공통 코드 삽입 > **푸터** (현재 비어있음)

### TJ님이 바꿔야 하는 값

```
ENDPOINT_URL → HTTPS 외부 URL (ngrok, Vercel, 또는 배포 서버)
예: https://abc123.ngrok-free.app
```

## HTTPS endpoint 확보 방법 (3가지)

| 방법 | 속도 | 설정 |
|------|------|------|
| **ngrok** (권장) | 5분 | `ngrok config add-authtoken 토큰` → `ngrok http 7020` |
| **Cloudflare Tunnel** | 10분 | cloudflared 설치 → tunnel 생성 |
| **Vercel 배포** | 30분 | attribution endpoint만 serverless로 분리 |

**ngrok이 가장 빠름.** TJ님이 https://dashboard.ngrok.com/signup 에서 무료 계정 만들고:
```bash
ngrok config add-authtoken YOUR_TOKEN
ngrok http 7020
```
하면 `https://xxxx.ngrok-free.app` URL이 나옴. 이것을 코드의 `ENDPOINT_URL`에 넣으면 됨.

## 검증 방법 (5줄)

1. ngrok URL 확인 후 `curl -X POST https://xxxx.ngrok-free.app/api/attribution/payment-success -d '{"test":true}'` → 201 확인
2. 아임웹에 코드 삽입 후 더클린커피 사이트 방문 → 개발자 도구 Console에 에러 없는지 확인
3. 드립백 1건 테스트 결제 수행 → 결제완료 페이지 도달
4. `GET /api/attribution/ledger` → `captureMode: "live"` row 1건 확인
5. orderId가 잡혔으면 `GET /api/toss/payments/orders/{orderId}` → 결제 상세 크로스 검증

## Beusable 중복 삽입 제안

현재 헤더와 바디에 동일 Beusable 스크립트가 2번 있음.
- **헤더 1개만 남기고 바디 것을 제거** 권장
- 이유: 세션 이중 카운트 가능성. 헤더에서 먼저 로드되므로 바디 것은 불필요.
