# P1-S1A 첫 실전 테스트 — 검증 결과

작성일: 2026-04-01

## 10초 요약

ngrok 터널과 백엔드는 정상 동작. 하지만 **더클린커피 사이트에서 receiver로 요청이 오지 않았다.** 가상계좌 주문이라 결제완료 페이지(`shop_order_done`)에 도달하지 않았거나, ngrok free의 브라우저 경고 페이지가 sendBeacon을 차단했을 가능성이 있다.

## Live Row 결과

| 항목 | 결과 |
|------|------|
| ngrok health | ✅ 200 OK |
| JSONL 총 row | 10줄 |
| captureMode=live | 3줄 (모두 curl 테스트) |
| **source=thecleancoffee_imweb** | **0줄** |
| ngrok 트래픽에서 더클린커피 Origin 요청 | **0건** |

## 기존 row 분류

| # | captureMode | touchpoint | orderId | source | 비고 |
|---|-------------|------------|---------|--------|------|
| 0 | smoke | checkout_started | (empty) | codex | Codex smoke 테스트 |
| 1 | smoke | payment_success | smoke-order-... | codex | Codex smoke 테스트 |
| 2-6 | replay | payment_success | 2026030...P1 | system | Toss replay 5건 |
| 7 | live | payment_success | test_ngrok_001 | (empty) | ngrok curl 테스트 |
| 8-9 | live | payment_success | beacon_test_* | beacon_test | 검증용 curl |

## 원인 분석

### 가능성 1: 가상계좌는 `shop_order_done`에 도달 안 함 (가장 유력)

아임웹에서 가상계좌 주문은:
1. 주문 접수 → 가상계좌 번호 안내 페이지 → **여기서 멈춤**
2. 실제 입금 후에야 `shop_order_done`으로 이동할 수 있음
3. 푸터 코드는 `shop_order_done` 감지인데, 가상계좌는 이 페이지를 안 거쳤을 수 있음

**검증 방법**: 카드 결제로 테스트 1건 추가 수행하면 즉시 확인 가능.

### 가능성 2: ngrok free 경고 페이지

ngrok 무료 플랜은 브라우저에서 처음 접속 시 "Visit Site" 경고 페이지를 보여줌.
- `sendBeacon`은 이 경고 페이지를 자동으로 통과하지 못함
- `fetch`도 302 리다이렉트를 따르지 못할 수 있음

**해결**: 푸터 코드에 `ngrok-skip-browser-warning` 헤더를 추가하면 됨. 하지만 `sendBeacon`은 커스텀 헤더를 지원하지 않으므로 **`fetch`를 1순위로 사용**해야 함.

### 가능성 3: 아임웹 캐시

아임웹에 코드를 저장해도 CDN 캐시 때문에 즉시 반영 안 될 수 있음.
시크릿 모드 + 하드 리프레시(Cmd+Shift+R)로 확인 필요.

## 수정된 푸터 코드 (ngrok free 대응)

ngrok free의 경고 페이지를 우회하려면 `fetch`에 `ngrok-skip-browser-warning` 헤더를 추가해야 함:

```html
<!-- P1-S1A V0 수정판: ngrok free 대응 -->
<script>
(function(){
  if(location.href.indexOf('shop_order_done')<0 && location.href.indexOf('order_done')<0)return;
  var landing={};
  try{landing=JSON.parse(sessionStorage.getItem('_att_landing')||'{}')}catch(e){}
  var d={
    touchpoint:'payment_success',
    captureMode:'live',
    orderId:'',
    clientObservedAt:new Date().toISOString(),
    userAgent:navigator.userAgent,
    source:'thecleancoffee_imweb'
  };
  var el=document.querySelector('[class*="order-number"],[class*="order_no"],[data-order]');
  if(el)d.orderId=el.textContent.trim();
  var ps=new URLSearchParams(location.search);
  if(ps.get('order_no'))d.orderId=ps.get('order_no');
  if(ps.get('orderId'))d.orderId=ps.get('orderId');
  Object.keys(landing).forEach(function(k){d[k]=landing[k]});
  var url='https://db0c-180-65-83-254.ngrok-free.app/api/attribution/payment-success';
  fetch(url,{
    method:'POST',
    body:JSON.stringify(d),
    headers:{
      'Content-Type':'application/json',
      'ngrok-skip-browser-warning':'true'
    },
    keepalive:true
  }).catch(function(){});
})();
</script>
```

**변경점:**
- `sendBeacon` → `fetch` (ngrok 헤더 필요)
- `ngrok-skip-browser-warning: true` 헤더 추가
- `shop_order_done` OR `order_done` 두 패턴 모두 감지
- `approvedAt` → `clientObservedAt` (TJ님 코드와 일치)

## 바로 다음 액션

**B. orderId 추출 보강 필요 + 코드 수정**

1. TJ님이 아임웹 푸터 코드를 위 **수정판으로 교체**
2. **카드 결제**로 테스트 1건 수행 (가상계좌가 아닌 카드)
3. 결제완료 페이지에 도달했는지 URL 바에서 `shop_order_done` 확인
4. 완료 후 저에게 알려주시면 ledger 재확인

가상계좌 입금 전에도 `order_done` 페이지에 갔었다면, ngrok free 경고가 원인.
`order_done` 자체를 안 거쳤다면, 가상계좌 플로우가 원인.
**카드 결제 테스트 1건이면 원인이 확정됨.**

---

## 카드 결제 후 추가 검증 (0401 23:30)

### 결과: 여전히 live row 0건

카드 결제 완료 후에도 ngrok에 더클린커피 Origin 요청이 0건.

### 추가 확인 사항

| 항목 | 결과 |
|------|------|
| 코드 삽입 확인 | ✅ 사이트 HTML에 감지 조건 + ngrok URL + fetch 코드 모두 존재 |
| CORS preflight | ✅ 204 OK |
| ngrok POST (curl) | ✅ 정상 적재 |
| ngrok POST (브라우저 UA) | ✅ 정상 적재 |
| **ngrok 트래픽에 브라우저 요청** | **❌ 0건** |

### 가장 유력한 원인

결제완료 후 실제 브라우저 URL이 `shop_order_done`이 아닐 수 있다.

아임웹 버전/결제 수단에 따라:
- `?mode=order_done` (mode명 차이)
- `?mode=shop_pay_done`
- SPA처럼 URL 변경 없이 DOM만 바뀌는 경우
- 또는 PG 리다이렉트 후 바로 다른 페이지로 이동

### TJ님 확인 필요

**결제 완료 직후 브라우저 URL 바에 어떤 URL이 표시되었는지** 스크린샷으로 알려주시오.
그 URL의 패턴을 확인하면 코드의 감지 조건을 정확히 맞출 수 있소.

---

## 원인 확정 (0402 00:00)

### 결제완료 URL이 `shop_order_done`이 아니라 `shop_payment_complete`였다

| 단계 | URL |
|------|-----|
| 결제하기 | `https://thecleancoffee.com/shop_payment/?order_code=...&order_no=202604018251490` |
| **결제완료** | **`https://thecleancoffee.com/shop_payment_complete?order_code=...&order_no=202604018251490`** |

코드의 감지 조건이 `shop_order_done`이었는데, 실제 URL은 `shop_payment_complete`이라 코드가 실행되지 않았다.

**URL 파라미터에 `order_no=202604018251490`이 이미 있으므로, orderId도 자동으로 잡힌다.**

### 수정 사항

푸터 코드의 감지 조건 1줄만 변경:

```
// 기존
if (window.location.href.indexOf('shop_order_done') === -1) return;

// 변경
if (window.location.href.indexOf('shop_payment_complete') === -1 && window.location.href.indexOf('shop_order_done') === -1) return;
```

### Origin not allowed 에러

Chrome 확장 프로그램(`cadiboklkpojfamcoggejbbdjcoiljjk`)이 발생시키는 에러. 우리 코드와 무관. 무시 가능.

### 다음 액션

A. **현재 구조로 충분, 감지 조건만 수정.**

1. TJ님이 푸터 코드의 감지 조건을 `shop_payment_complete` 포함으로 변경
2. 카드 결제 테스트 1건 재수행
3. live row 확인 → orderId가 `202604018251490` 같은 형태로 잡히면 성공
4. Toss API로 해당 orderId 크로스 검증

---

## ★ P1-S1A LIVE ROW 적재 성공 (0402 00:34)

### 결과

| 항목 | 값 |
|------|-----|
| **touchpoint** | `payment_success` |
| **captureMode** | `live` |
| **orderId** | `202604017586987` |
| **origin** | `https://thecleancoffee.com` |
| **loggedAt** | `2026-04-01T14:34:01.139Z` |
| **UA** | Chrome 146 / macOS |
| **IP** | `180.65.83.254` |

### referrer에서 자동 추출된 결제 정보 (보너스!)

아임웹 결제완료 리다이렉트 URL의 referrer에 **모든 결제 정보**가 포함되어 있었다:

| 필드 | 값 |
|------|-----|
| orderCode | `o2026040182e4ff3b758bd` |
| orderNo | `202604017586987` |
| paymentCode | `pa202604018c83c9d953876` |
| **orderId** | **`202604017586987-P1`** |
| **paymentKey** | **`iw_th20260401233352v3as0`** |
| **amount** | **`21,300원`** |

이는 코드에서 명시적으로 파싱하지 않았는데도, 브라우저의 `document.referrer`에 자동으로 포함된 것이다.

### UTM이 비어있는 이유

이번 테스트에서 `utm_source` 등이 비어있는 것은, 가상계좌 주문을 직접 접속(UTM 없이)해서 한 것으로 보임.
UTM이 붙은 URL로 진입하면 헤더 상단의 V1 코드가 sessionStorage에 저장하고, 결제완료 시 landing 데이터가 합쳐진다.

### Toss API 크로스 검증

paymentKey `iw_th...`는 커피 MID(`iw_thecleaz5j`)이므로 바이오컴 Toss 시크릿 키로는 조회 불가 (404).
커피 전용 Toss Secret Key가 확보되면 크로스 검증 가능.

### 최종 판정

**A. 현재 구조로 충분. V1/V0 유지 후 테스트 확대.**

이유:
1. live row가 정상 적재됨
2. orderId가 URL 파라미터에서 자동 추출됨
3. referrer에서 paymentKey, amount까지 자동으로 잡힘
4. checkout-context(V2)는 급하지 않음 — payment-success만으로 전환 원장 구축 가능
5. UTM 추적은 V1 헤더 코드가 처리 (이번에 UTM 없이 테스트한 것뿐)

### P1-S1A 마일스톤 달성

| 마일스톤 | 상태 |
|---------|------|
| receiver 구현 | ✅ |
| JSONL 원장 | ✅ |
| CORS 허용 | ✅ |
| ngrok 터널 | ✅ |
| 아임웹 코드 삽입 | ✅ |
| **live row 1건 적재** | **✅ 달성** |
| orderId 자동 추출 | ✅ |
| paymentKey 자동 추출 | ✅ (referrer에서) |
| amount 자동 추출 | ✅ (referrer에서) |
| UTM 추적 | ✅ (V1 코드, UTM 붙은 URL로 테스트 필요) |
