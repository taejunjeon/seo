# 03. API Not Found Funnel Enrichment

작성 시각: 2026-05-15 01:32 KST

## 결론

API not found 48건의 과거 row는 대부분 더 깊게 복구할 수 없다. 현재 VM Cloud row에 결제수단, NPay click, scroll, dwell, member/guest, payment key, value가 없기 때문이다.

다만 일부는 GA4 join key가 있어 GA4 event journey를 보조로 볼 수 있다. 이 보조 정보는 실제 결제완료 정본이 아니며, no-send 판정은 유지된다.

## 현재 VM Cloud row만으로 알 수 있는 것

- source: `biocom_imweb`.
- touchpoint: `payment_success`로 저장됨.
- 실제 의미: `/shop_payment/` payment page artifact.
- snippet: footer v4.3.
- URL class: `/shop_payment/`.
- order key presence: 있음.
- fbp presence: 있음.
- fbc/fbclid: 일부 있음.
- GA4 join key: current 69건 중 13건 있음.
- payment key/value/transaction/member: 없음.
- same order key repeated: 없음.
- NPay intent join: 0.

## GA4 join으로 알 수 있는 것

GA4 join key가 있는 row만 제한적으로 가능하다.

가능:

- page_view sequence.
- view_item.
- add_to_cart.
- begin_checkout.
- add_payment_info.
- purchase event presence.
- engagement_time_msec.
- scroll 또는 scroll90 custom event.

불가능 또는 금지:

- GA4 purchase revenue를 actual purchase로 사용.
- GA4 event만으로 Meta Purchase send 후보 승격.
- GA4가 없는 row를 row-level로 복구.

## Meta browser event join 가능성

현재 row에는 fbp/fbc/fbclid presence가 일부 있다. 이것은 Meta attribution evidence다.

하지만 이것만으로 FBE/browser Purchase가 발생했다는 뜻은 아니다.

확인 가능한 것:

- Meta Events Manager에서 PageView/ViewContent/AddToCart/InitiateCheckout 수집 여부.
- Pixel ID 일치 여부.
- browser event recent received 여부.

확인 어려운 것:

- Meta UI만으로 특정 safe_ref row와 1:1 order journey 매칭.
- browser Purchase가 실제 결제완료와 동일 event id로 dedup됐는지.

## NPay intent join 가능성

gpt0515-3 기준:

- same-window NPay intent: 48건.
- current pending join by client/session/fbp/fbc: 0건.

따라서 API not found 48건은 현재 기준 NPay clicked actual 후보가 아니다.

## footer v4.4 이후부터 알 수 있는 것

v4.4가 들어가면 아래가 새로 보인다.

- `/shop_payment/`가 결제완료가 아니라 payment page seen인지.
- selected payment method.
- attempted payment method.
- NPay button seen.
- NPay button clicked.
- member/guest presence.
- cart value presence.
- item/product count.
- scroll max percent.
- visible seconds.
- time on page.
- page entry/exit timing.
- click id presence by channel.

## 현재는 알 수 없는 것

- 결제수단 실제 선택 완료 여부.
- 가상계좌가 실제 발급됐는지.
- 카드 결제 시도 실패인지.
- 결제창에서 이탈했는지 외부 PG에서 실패했는지.
- NPay 외부 결제창으로 넘어갔는지.
- row별 정확한 scroll/dwell.
- row별 member/guest 확정.

이 항목들은 v4.4 data contract와 Imweb/운영DB confirmed source가 같이 있어야 닫힌다.

## API not found 48건 최종 판정

- final class: `payment_page_artifact_only`.
- Meta send candidate: 0.
- internal ROAS included: 0.
- required follow-up: footer v4.4 split + backend endpoint/guard + value guard.

## 성공 기준

v4.4 적용 이후 같은 문제가 줄었는지 보는 기준:

- `/shop_payment/`에서 `payment_success` 신규 row 0.
- `/shop_payment/`에서 `payment_page_seen` row 또는 semantic marker 증가.
- 완료 URL에서만 `payment_success` 증가.
- API not found가 결제완료 후보로 쌓이지 않음.
- payment_page_seen row가 Meta Purchase candidate로 들어가지 않음.
