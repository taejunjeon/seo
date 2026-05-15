# Today Confirmed Purchase And Meta Evidence

작성 시각: 2026-05-15 23:24 KST

## 기준

- site: `biocom`
- Pixel: `1283400029487161`
- window: `2026-05-15 00:00-23:24 KST`
- primary source: VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3`
- table: `attribution_ledger`
- filter: `source='biocom_imweb'`, `touchpoint='payment_success'`, `payment_status='confirmed'`
- raw order/payment/member/click id output: 0

## 실제 결제완료

오늘 VM Cloud에서 confirmed로 닫힌 바이오컴 결제완료는 61건 / 17,494,197원이다.

이 숫자는 운영DB가 아니라 VM Cloud의 실시간 보조 원장 기준이다. 오늘 장애 판단은 운영DB sync 지연 영향을 줄이기 위해 VM Cloud confirmed bridge를 primary로 봤다.

## Meta 강한 증거

Meta 강한 증거는 아래 중 하나가 있는 결제완료다.

- `fbclid` 있음
- `fbc` 있음
- `utm_source/source`에 Meta/Facebook/Instagram 계열 있음

오늘 Meta 강한 증거 결제완료는 24건 / 9,157,467원이다.

보조 breakdown:

- `fbclid` present: 18건
- `fbc` present: 23건
- `fbp` present: 59건
- Meta 계열 UTM/source present: 18건
- evidence completely missing: 0건

## 해석

오늘 실제 결제완료 중 Meta 유입 강한 후보는 주문 기준 39.3%다. 금액 기준으로는 52.3%다.

다만 `fbp`만 있는 구매는 Meta 광고 유입이라고 단정하지 않는다. `fbp`는 Meta Pixel 사용자 식별 쿠키라서, 다른 유입으로 구매한 사람에게도 있을 수 있다.

## Confidence

- confirmed purchase count/amount: high
- Meta strong evidence 분류: medium-high
- Meta 광고 최종 귀속 여부: Ads Manager 귀속 결과가 필요하므로 medium
