# P1-S1A Receiver Playbook

기준일: 2026-03-29

## 10초 결론

이 문서의 목적은 `실제 고객 사이트 연결 전에도 receiver를 바로 검증할 수 있게 만드는 것`이다.  
지금은 live row가 `0건`이라 원인을 확정할 수 없지만, 이 문서와 스크립트를 쓰면 연결 직후 `수신`, `기록`, `시간대 비교`까지 바로 본다.  
다음 행동은 개발팀이 실제 checkout / payment success 진입점에 아래 payload를 붙이는 것이다.

## 왜 지금 필요한가

`P1-S1A`는 장치는 거의 다 준비됐지만 실제 사이트 호출이 없다.  
그래서 지금 필요한 것은 새 기능이 아니라 `연결되자마자 바로 검증하는 절차`다.

## 1. 표준 payload

### checkout-context

무엇을 보내는가:

- checkout을 시작한 순간의 문맥
- 고객 키
- landing, referrer, utm, ga_session_id

샘플 payload:

```json
{
  "checkoutId": "checkout-20260329-001",
  "customerKey": "ck_phone_01012345678",
  "landing": "/products/alpha-ampoule",
  "referrer": "https://www.google.com/",
  "gaSessionId": "1743222001",
  "utmSource": "google",
  "utmMedium": "cpc",
  "utmCampaign": "brand_search",
  "utmTerm": "바이오컴 앰플",
  "utmContent": "adgroup_a",
  "gclid": "test-gclid-001",
  "metadata": {
    "pageName": "checkout",
    "cartValue": 129000
  }
}
```

### payment-success

무엇을 보내는가:

- 결제가 끝난 순간의 키
- `orderId`, `paymentKey`, `approvedAt`
- checkout 문맥과 유입 문맥

샘플 payload:

```json
{
  "orderId": "BIO20260329001",
  "paymentKey": "pay_20260329_demo_001",
  "approvedAt": "2026-03-29T10:03:12+09:00",
  "checkoutId": "checkout-20260329-001",
  "customerKey": "ck_phone_01012345678",
  "landing": "/products/alpha-ampoule",
  "referrer": "https://biocom.kr/checkout",
  "gaSessionId": "1743222001",
  "utmSource": "google",
  "utmMedium": "cpc",
  "utmCampaign": "brand_search",
  "utmTerm": "바이오컴 앰플",
  "utmContent": "adgroup_a",
  "gclid": "test-gclid-001",
  "metadata": {
    "pageName": "order_success",
    "pgName": "tosspayments",
    "totalAmount": 129000
  }
}
```

## 2. curl 예시

### checkout-context 호출

```bash
curl -X POST http://localhost:7020/api/attribution/checkout-context \
  -H 'Content-Type: application/json' \
  -d '{
    "checkoutId": "checkout-20260329-001",
    "customerKey": "ck_phone_01012345678",
    "landing": "/products/alpha-ampoule",
    "referrer": "https://www.google.com/",
    "gaSessionId": "1743222001",
    "utmSource": "google",
    "utmMedium": "cpc",
    "utmCampaign": "brand_search",
    "gclid": "test-gclid-001"
  }'
```

### payment-success 호출

```bash
curl -X POST http://localhost:7020/api/attribution/payment-success \
  -H 'Content-Type: application/json' \
  -d '{
    "orderId": "BIO20260329001",
    "paymentKey": "pay_20260329_demo_001",
    "approvedAt": "2026-03-29T10:03:12+09:00",
    "checkoutId": "checkout-20260329-001",
    "customerKey": "ck_phone_01012345678",
    "landing": "/products/alpha-ampoule",
    "referrer": "https://biocom.kr/checkout",
    "gaSessionId": "1743222001",
    "utmSource": "google",
    "utmMedium": "cpc",
    "utmCampaign": "brand_search",
    "gclid": "test-gclid-001"
  }'
```

## 3. smoke check 스크립트

실행 목적:

- receiver가 실제로 row를 남기는지 바로 확인
- ledger delta가 `2` 이상인지 확인
- 시간대 비교 초안이 응답하는지 확인

실행:

```bash
cd /Users/vibetj/coding/seo/backend
npx tsx scripts/attribution-smoke-check.ts
```

실제 토스 승인 키로 보고 싶을 때:

```bash
cd /Users/vibetj/coding/seo/backend
npx tsx scripts/attribution-smoke-check.ts \
  --date 2026-03-29 \
  --orderId BIO20260329001 \
  --paymentKey real_payment_key_here \
  --customerKey ck_phone_01012345678
```

주의:

- 더미 `orderId`, `paymentKey`를 쓰면 receiver smoke는 통과해도 toss join은 보통 `unmatched`가 나온다.
- join coverage까지 보려면 실제 토스 승인 키가 필요하다.

## 4. 운영 검증 체크리스트

### 연결 직후 1차 확인

1. `checkout-context`가 `201`을 돌려주는지 확인
2. `payment-success`가 `201`을 돌려주는지 확인
3. `GET /api/attribution/ledger`에서 `totalEntries`가 늘었는지 확인
4. 최근 row에 `checkoutId`, `orderId`, `paymentKey`가 보이는지 확인

### 하루치 확인

1. `GET /api/attribution/hourly-compare?date=YYYY-MM-DD` 호출
2. 토스 승인 있는 시간대에 `paymentSuccessEntries = 0`인 시간이 많은지 확인
3. `checkoutEntries`는 있는데 `paymentSuccessEntries`가 비는 시간대가 많은지 확인

### 조인 확인

1. `GET /api/attribution/toss-join?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&limit=100`
2. `matchedByPaymentKey`, `matchedByOrderId`를 같이 확인
3. `paymentSuccessEntriesWithPaymentKey`, `paymentSuccessEntriesWithOrderId`가 모두 충분한지 확인
4. `joinCoverageRate`와 `ledgerCoverageRate`를 함께 본다

## 5. 해석 기준

바로 확정해도 되는 것:

- receiver 호출이 실제로 들어오는지
- `paymentKey`와 `orderId`가 payload에 실리는지
- 시간대별로 토스 승인과 receiver row가 얼마나 벌어지는지

아직 확정하면 안 되는 것:

- `(not set) = PG 직결`
- `receiver row가 0이니 곧바로 PG 문제`

이유:

- 아직 GA4 DebugView와 실제 브라우저 결제 흐름 검증이 남아 있다.
- receiver가 붙어도 source/session 귀속이 끊길 수 있다.

## 6. 이번 턴 추가된 보조 도구

- `GET /api/attribution/hourly-compare`
- `backend/scripts/attribution-smoke-check.ts`
- toss join summary의 `matchedByPaymentKey`, `matchedByOrderId`, `ledgerCoverageRate`
