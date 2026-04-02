# P1-S1A 운영 고정 + 바이오컴 확장 준비 — 결과보고서

작성일: 2026-04-02

## 10초 요약

attribution 필드 정본 정의, 더클린커피 운영 체크리스트, 바이오컴 확장 준비안, 고정 endpoint 전환안을 정리했다. 실제 고객 주문 1건(channel_talk 유입, ₩34,825)이 이미 잡히고 있다.

---

## 1. Attribution 필드 정본 정의

### 1-1. 결제 식별자 필드

| 필드 | 의미 | Source of Truth | 예시 | 비고 |
|------|------|----------------|------|------|
| **orderId** (ledger 최상위) | 주문번호. Toss 조인·운영 DB 매칭의 **기본 키** | URL param `order_no` → referrer `orderNo` → referrer `orderId` 순으로 fallback | `202604027886466` | 아임웹 주문번호. `-P1` 없는 원본 |
| **referrerPayment.orderId** | PG사에 전달된 orderId. `-P1` 결제 시퀀스 포함 | referrer URL query param `orderId` | `202604027886466-P1` | Toss API `GET /v1/payments/orders/{orderId}` 조회 시 이 값 사용 |
| **referrerPayment.orderNo** | 아임웹 내부 주문번호 | referrer URL query param `orderNo` | `202604027886466` | ledger `orderId`와 동일값. 중복 저장은 의도적 (referrer 원본 보존) |
| **paymentKey** (ledger 최상위) | Toss 결제 고유 키. Toss API 조회의 **기본 키** | referrer URL query param `paymentKey` (payload에 없을 때 fallback) | `iw_th20260402000930zgCq6` | `iw_th` = 더클린커피 MID 접두어 |
| **referrerPayment.paymentKey** | 위와 동일값. referrer 원본 보존용 | referrer URL query param | (동일) | ledger 최상위 `paymentKey`와 항상 같음 |
| **referrerPayment.paymentCode** | 아임웹 내부 결제 코드 | referrer URL query param `paymentCode` | `pa2026040110e9bbc998095` | 아임웹 관리자에서 결제 상세 조회 시 사용 |
| **referrerPayment.orderCode** | 아임웹 내부 주문 코드 | referrer URL query param `orderCode` | `o202604015c820722145eb` | 아임웹 관리자에서 주문 상세 조회 시 사용 |
| **referrerPayment.amount** | 결제 금액 (원) | referrer URL query param `amount` | `21300` | 문자열. 숫자 변환 시 `parseInt` 필요 |

### 1-2. Fallback 규칙 (코드 기준)

```
orderId 결정 순서:
  1. payload.orderId (푸터 코드에서 URL param order_no 추출)
  2. referrer URL의 orderNo
  3. referrer URL의 orderId (이건 -P1 포함 버전)

paymentKey 결정 순서:
  1. payload.paymentKey (현재 푸터 코드에서는 빈 값)
  2. referrer URL의 paymentKey
```

### 1-3. 귀속(Attribution) 필드

| 필드 | 의미 | Source of Truth | 예시 |
|------|------|----------------|------|
| **source** | 사이트 식별자 | 푸터 코드에 하드코딩 | `thecleancoffee_imweb`, `biocom_imweb` |
| **utmSource** | 유입 채널 | 아임웹 세션 `__bs_imweb_session.utmSource` | `test`, `channel_talk`, `google` |
| **utmMedium** | 유입 매체 | 아임웹 세션 `__bs_imweb_session.utmMedium` | `cpc`, `campaign`, `organic` |
| **utmCampaign** | 캠페인명 | 아임웹 세션 `__bs_imweb_session.utmCampaign` | `p1s1a_verify` |
| **gclid** | Google Ads 클릭 ID | `__bs_imweb_session.utmLandingUrl`에서 파싱 | `test_gclid_001` |
| **fbclid** | Meta Ads 클릭 ID | `__bs_imweb_session.utmLandingUrl`에서 파싱 | (없으면 빈 값) |
| **landing** | 최초 진입 URL | 아임웹 세션 `__bs_imweb_session.utmLandingUrl` | `https://thecleancoffee.com/?gclid=...` |
| **originalReferrer** | 외부 유입 출처 | 아임웹 세션 `__bs_imweb_session.initialReferrer` | `@direct`, `https://google.com` |
| **referrer** | 결제완료 직전 페이지 (PG 리다이렉트 URL) | `document.referrer` | `https://thecleancoffee.com/backpg/payment/oms/...` |
| **clientObservedAt** | 브라우저 시각 | 푸터 코드 `new Date().toISOString()` | `2026-04-02T00:09:40.482Z` |

### 1-4. orderId vs referrerPayment.orderId 차이

| | orderId (최상위) | referrerPayment.orderId |
|---|---|---|
| 값 | `202604027886466` | `202604027886466-P1` |
| 용도 | 운영 DB `tb_iamweb_users.order_number` 매칭 | Toss API `GET /v1/payments/orders/{orderId}` 조회 |
| 규칙 | `-P1` 제거된 순수 주문번호 | PG 결제 시퀀스 포함 |

**Toss 크로스 검증 시** `referrerPayment.orderId` (`-P1` 포함)를 사용해야 한다.

---

## 2. 더클린커피 운영 체크리스트

### 2-1. 현재 삽입 코드

| 위치 | 코드 | 버전 | 역할 | 필수 여부 |
|------|------|------|------|-----------|
| **아임웹 헤더 상단** | V1 Landing/UTM 캡처 | V1 | localStorage에 `_p1s1a_first_touch` / `_p1s1a_last_touch` 저장 | 선택 (아임웹 자체 세션이 UTM을 추적하므로) |
| **아임웹 푸터** | V0.2 Payment Success | V0.2 | 결제완료 시 attribution 데이터 전송 | **필수** |

### 2-2. 푸터 V0.2 핵심 설정값

| 항목 | 현재 값 | 변경 시 영향 |
|------|---------|-------------|
| 감지 조건 | `shop_payment_complete` OR `shop_order_done` | 이 URL 패턴이 아니면 코드 미실행 |
| endpoint URL | `https://vendors-wait-candles-dominant.trycloudflare.com/api/attribution/payment-success` | Cloudflare Tunnel 재시작 시 변경됨 → 아임웹 푸터 코드도 변경 필요 |
| source | `thecleancoffee_imweb` | 사이트별 고유값. 변경 금지 |
| UTM 소스 1순위 | `__bs_imweb_session` (sessionStorage) | 아임웹 자체 추적. 우리가 제어 불가 |
| UTM 소스 2순위 | `_p1s1a_last_touch` (localStorage) | V1 헤더 코드 의존. 없어도 1순위로 동작 |

### 2-3. 조회 방법

| 목적 | API | 예시 |
|------|-----|------|
| 커피 live row 전체 | `GET /api/attribution/ledger?source=thecleancoffee_imweb&captureMode=live` | 현재 3건 |
| 전체 원장 요약 | `GET /api/attribution/ledger` | live/replay/smoke 전체 |
| 특정 주문 크로스 검증 | `GET /api/toss/payments/orders/{orderId}-P1` | 커피 Toss Secret Key 필요 |

### 2-4. 장애 대응

| 증상 | 원인 | 해결 |
|------|------|------|
| live row가 안 들어옴 | Cloudflare Tunnel 다운 | `cloudflared tunnel --url http://localhost:7020` 재시작 → 새 URL로 푸터 코드 업데이트 |
| UTM이 빈 값 | 시크릿 모드에서 아임웹 세션 미생성 (정상 고객은 문제 없음) | 시크릿이 아닌 일반 브라우저에서는 정상 동작 |
| orderId가 빈 값 | URL에 `order_no` param이 없는 경우 | 결제완료 URL 패턴 변경 여부 확인 |
| 백엔드 서버 다운 | Express 서버 중단 | `cd backend && npm run dev` 재시작 |

---

## 3. 바이오컴 확장 준비안

### 3-1. 확인 절차

바이오컴(biocom.kr)에 푸터 코드를 삽입하기 전에 아래를 확인해야 한다.

**TJ님이 직접 확인할 것:**

1. **바이오컴에서 테스트 주문 1건** (가장 저렴한 상품, 가상계좌)
2. **결제완료 직후 브라우저 URL 바에 표시된 URL 전체를 복사**
   - 커피는 `shop_payment_complete`였음
   - 바이오컴도 `shop_payment_complete`인지, 다른 패턴인지 확인
3. **URL에 포함된 파라미터 확인**
   - `order_code=...` 있는지
   - `order_no=...` 있는지
   - `payment_code=...` 있는지
4. **개발자 도구 > Application > Session Storage에서 `__bs_imweb_session` 존재 확인**

### 3-2. 바이오컴용 푸터 코드 초안

아래는 **결제완료 URL이 `shop_payment_complete`인 경우**의 초안. URL 패턴이 다르면 감지 조건만 수정하면 된다.

```html
<!-- P1-S1A V0.2: 바이오컴 Attribution -->
<script>
(function(){
  if(location.href.indexOf('shop_payment_complete')<0 && location.href.indexOf('shop_order_done')<0)return;
  var iws={};
  try{iws=JSON.parse(sessionStorage.getItem('__bs_imweb_session')||'{}')}catch(e){}
  var lt={};
  try{lt=JSON.parse(localStorage.getItem('_p1s1a_last_touch')||'{}')}catch(e){}
  var d={
    touchpoint:'payment_success',
    captureMode:'live',
    orderId:'',
    clientObservedAt:new Date().toISOString(),
    userAgent:navigator.userAgent,
    source:'biocom_imweb',
    referrer:document.referrer||'',
    landing:iws.utmLandingUrl||lt.landing||'',
    originalReferrer:iws.initialReferrer||lt.referrer||'',
    utm_source:iws.utmSource||lt.utm_source||'',
    utm_medium:iws.utmMedium||lt.utm_medium||'',
    utm_campaign:iws.utmCampaign||lt.utm_campaign||'',
    utm_content:iws.utmContent||lt.utm_content||'',
    utm_term:iws.utmTerm||lt.utm_term||'',
    gclid:lt.gclid||'',
    fbclid:lt.fbclid||'',
    ttclid:lt.ttclid||''
  };
  if(iws.utmLandingUrl){
    try{var lp=new URLSearchParams(new URL(iws.utmLandingUrl).search);
      if(lp.get('gclid'))d.gclid=lp.get('gclid');
      if(lp.get('fbclid'))d.fbclid=lp.get('fbclid');
    }catch(e){}
  }
  var el=document.querySelector('[class*="order-number"],[class*="order_no"],[data-order]');
  if(el)d.orderId=el.textContent.trim();
  var ps=new URLSearchParams(location.search);
  if(ps.get('order_no'))d.orderId=ps.get('order_no');
  if(ps.get('orderId'))d.orderId=ps.get('orderId');
  var url='ENDPOINT_URL/api/attribution/payment-success';
  fetch(url,{method:'POST',body:JSON.stringify(d),headers:{'Content-Type':'application/json'},keepalive:true}).catch(function(){});
})();
</script>
```

**커피 코드와의 차이점: `source: 'biocom_imweb'` 1곳만 다르다.** endpoint URL도 동일.

### 3-3. 백엔드 준비 상태

| 항목 | 상태 | 비고 |
|------|------|------|
| CORS `biocom.kr` | ✅ 이미 허용 | `server.ts`에 `https://biocom.kr`, `https://www.biocom.kr` 등록됨 |
| receiver endpoint | ✅ 동일 | `/api/attribution/payment-success` |
| referrer 파싱 | ✅ 동일 로직 | 아임웹 referrer URL 구조가 같다면 자동 작동 |
| source 필터 | ✅ 준비됨 | `?source=biocom_imweb&captureMode=live` |
| Toss 크로스 검증 | ✅ 바이오컴 Key 확보됨 | MID `iw_biocomo8tx`, Secret Key 이미 `.env`에 있음 |

**바이오컴은 Toss Secret Key가 이미 있으므로, 커피와 달리 크로스 검증이 즉시 가능하다.**

### 3-4. source 분리 구조

```
/api/attribution/ledger                              → 전체 (커피+바이오컴+기타)
/api/attribution/ledger?source=thecleancoffee_imweb   → 커피만
/api/attribution/ledger?source=biocom_imweb           → 바이오컴만
/api/attribution/ledger?captureMode=live              → live만
```

---

## 4. 고정 Endpoint 전환안

### 4-1. 현재 상태

| 항목 | 값 |
|------|-----|
| 방식 | Cloudflare Quick Tunnel (`cloudflared tunnel --url http://localhost:7020`) |
| URL | `https://vendors-wait-candles-dominant.trycloudflare.com` |
| 경고 페이지 | 없음 ✅ |
| 비용 | 무료 |
| URL 고정 | ❌ **재시작 시 변경됨** |

### 4-2. 전환 옵션 비교

| 방법 | 비용 | URL 고정 | 설정 난이도 | 안정성 |
|------|------|----------|------------|--------|
| **Cloudflare Named Tunnel** | 무료 | ✅ (서브도메인) | 중 | ★★★ |
| ngrok 유료 | $8/월 | ✅ (커스텀 도메인) | 하 | ★★★ |
| Vercel Serverless | 무료 | ✅ (vercel.app) | 상 | ★★★★ |
| VPS 직접 배포 | $5~/월 | ✅ | 상 | ★★★★★ |

### 4-3. 권장: Cloudflare Named Tunnel (무료 + 고정)

**전제 조건**: thecleancoffee.com 또는 biocom.kr의 DNS가 Cloudflare에서 관리되어야 한다.

**⚠️ 주의**: 기존 라이브 사이트의 DNS를 Cloudflare로 옮기면 **일시적 다운타임 위험**이 있다. 별도 도메인(예: `att.biocom.kr` 서브도메인)만 Cloudflare DNS로 위임하거나, 새 도메인을 Cloudflare에 등록하는 것이 안전하다.

**절차 (도메인이 Cloudflare에 있는 경우):**

```bash
# 1. 터널 생성 (1회)
cloudflared tunnel create seo-attribution

# 2. 설정 파일 작성
cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: seo-attribution
credentials-file: ~/.cloudflared/<tunnel-id>.json
ingress:
  - hostname: att.yourdomain.com
    service: http://localhost:7020
  - service: http_status:404
EOF

# 3. DNS 레코드 추가 (1회)
cloudflared tunnel route dns seo-attribution att.yourdomain.com

# 4. 터널 실행
cloudflared tunnel run seo-attribution
```

결과: `https://att.yourdomain.com` → 고정 URL, 재시작해도 변경 없음.

### 4-4. 당장은 Quick Tunnel 유지를 권장

이유:
1. 아직 테스트 단계이므로 URL이 가끔 바뀌어도 큰 문제 없다
2. 바이오컴 확장 테스트까지 Quick Tunnel로 진행
3. **실제 운영(실 고객 결제가 꾸준히 들어올 때)** Named Tunnel로 전환
4. Named Tunnel 전환 시 푸터 코드의 URL 1줄만 변경하면 됨

---

## 5. 보너스: 실제 고객 주문 포착

live row 3건 중 1건이 **테스트가 아닌 실제 고객 주문**이다:

| 항목 | 값 |
|------|-----|
| orderId | `202604024192225` |
| amount | ₩34,825 |
| utmSource | `channel_talk` |
| utmMedium | `campaign` |
| paymentKey | `iw_th20260402002147A2tI0` |

**채널톡 캠페인을 통해 유입된 고객이 ₩34,825를 결제했고, 그 전환이 attribution 원장에 자동 기록되었다.**

이것은 P1-S1A의 실전 가치를 증명한다:
- 채널톡 캠페인의 실제 매출 기여를 숫자로 추적할 수 있다
- UTM source/medium로 유입 채널별 전환을 분리할 수 있다
- paymentKey로 Toss 크로스 검증이 가능하다 (커피 Secret Key 확보 후)

---

## 바꾼 파일

없음. 이번 작업은 코드 변경 없이 문서 정리만 수행했다.

## 검증 결과

- live row 3건 필드 구조 분석 완료
- CORS biocom.kr 허용 확인 (`server.ts` line 75-76)
- 바이오컴 Toss Secret Key `.env` 존재 확인

## 남은 리스크

1. Cloudflare Quick Tunnel URL이 재시작 시 변경됨 → 푸터 코드도 매번 수정 필요
2. 커피 Toss Secret Key 미확보 → 커피 live row의 paymentKey 크로스 검증 불가
3. 바이오컴 결제완료 URL 패턴 미확인 → TJ님 테스트 주문 후 확인 필요

## 바로 다음 액션 1개

**바이오컴에서 가장 저렴한 상품으로 테스트 주문 1건 → 결제완료 URL을 알려주시오.** URL 패턴이 확인되면 바이오컴 푸터 코드를 바로 삽입할 수 있다.
