**판정: 지금 상태 그대로는 `No-Go`입니다.**
개발AI가 만든 방향은 좋습니다. 하지만 **publish는 아직 하면 안 됩니다.** 이유는 하나가 치명적입니다.

**[251] setup tag 안에서 `dataLayer.push()`로 값을 넣는 방식은, [154]가 같은 이벤트에서 바로 그 값을 읽는다는 보장이 약합니다.** Google Tag Manager 공식 문서도 setup tag에서 dataLayer 값을 바꾸려면 `dataLayer.push()`가 아니라 `google_tag_manager[{{Container ID}}].dataLayer.set()`을 쓰라고 설명합니다. `push()`는 다음 이벤트에서야 인식될 수 있기 때문입니다. ([Google 도움말][1])

즉, 지금 설계의 핵심 가정인
**“[251]이 dataLayer.push → 바로 뒤 [154]가 그 값을 읽음”**
이 부분이 공식 동작 기준으로 안전하지 않습니다.

---

## 쉽게 말하면

이번 설계는 이런 흐름입니다.

1. [251] 직원이 장바구니에 상품/금액/주문번호를 담는다.
2. 바로 뒤 [154] 직원이 그 장바구니를 들고 구매 이벤트를 만든다.
3. [143] 직원이 최종 GA4 purchase를 보낸다.

문제는 [251] 직원이 장바구니를 **창고 접수대에 맡기는 방식**이 `dataLayer.push()`라는 점입니다.
그런데 GTM은 “방금 접수대에 맡긴 물건은 지금 계산대 직원이 바로 못 볼 수 있다”고 말합니다.

공식적으로는 setup tag에서 바로 다음 태그가 읽어야 하는 값은 접수대에 맡기는 게 아니라, **현재 계산대 시스템에 직접 꽂아 넣어야 합니다.**
그게 `google_tag_manager['GTM-W2Z6PHN'].dataLayer.set(...)`입니다. ([Google 도움말][1])

---

# 제 피드백

## 좋은 점

### 1. 방향 자체는 맞습니다

`hurdlers_ga4.transaction_id/value/items/shipping`을 [143]이 읽기 전에 준비하겠다는 방향은 맞습니다. 지금 문서에서도 HURDLERS 쪽 값이 빈 이유는 “읽는 태그는 있는데 실제 값을 push하는 태그가 없다”는 점으로 정리되어 있습니다. 

**의견: 방향 찬성**
**자신감: 90%**

---

### 2. 자체 트리거 없이 setupTag로만 실행하게 한 건 좋습니다

[251]에 `firingTriggerId: []`를 둬서 혼자 아무 때나 실행되지 않게 한 건 안전한 설계입니다. 태그 시퀀싱으로 [154] 직전에만 실행되게 한 점도 좋은 방향입니다. GTM 공식 도움말도 setup tag는 primary tag가 실행되기 전에 실행되는 구조라고 설명합니다.  ([Google 도움말][1])

**의견: 구조 찬성**
**자신감: 92%**

---

### 3. 금지사항을 지킨 것도 좋습니다

`gtag('event','purchase')`, `event:'purchase'`, `event:'hurdlers_purchase'`, `event:'conversion'` 재push가 없다는 점은 중요합니다. 구매 이벤트를 한 번 더 쏘지 않고, 데이터 준비만 하려는 설계니까요. 

**의견: 안전장치 좋음**
**자신감: 94%**

---

## 문제점

## 1. `dataLayer.push()` 방식은 publish No-Go 사유입니다

문서에는 [251]이 이렇게 한다고 되어 있습니다.

```js
window.dataLayer.push({
  hurdlers_ga4: {
    transaction_id,
    value,
    items,
    shipping,
    currency
  }
});
```

그런데 setup tag에서 바로 다음 태그가 그 값을 읽어야 하는 경우에는 이 방식이 안전하지 않습니다. Google 공식 문서가 딱 이 상황을 경고합니다. setup tag에서 값을 바꿀 때는 `google_tag_manager[{{Container ID}}].dataLayer.set()`을 써야 하고, `push()`는 다음 이벤트에서야 인식될 수 있다고 설명합니다. ([Google 도움말][1])

**의견: 현재 코드 그대로 publish 반대**
**자신감: 96%**

---

## 2. 가상계좌 guard가 아직 불확실합니다

문서에 따르면 [251]의 guard는 이렇습니다.

* URL path가 `shop_payment_complete`인지 확인
* `order_no` 있는지 확인
* `rk`가 있으면 `S`인지 확인
* `window.__seo_allow_purchase !== false`인지 확인
* sessionStorage로 중복 방지

문제는 문서 자체도 말하듯이, **가상계좌 미입금 URL에도 `rk=S`가 있으면 이 guard는 통과합니다.** 

이건 중요합니다.
가상계좌 미입금 주문에서 [251]이 value/items를 잘 채워버리면, 아직 돈 안 낸 주문이 더 완성도 높은 purchase처럼 기록될 수 있습니다.

**의견: 가상계좌 시나리오 C Preview 전 publish 금지**
**자신감: 94%**

---

## 3. `value`는 채워질 수 있지만 `items`는 여전히 안 채워질 수 있습니다

[251]의 items 추출 우선순위는:

1. 기존 `hurdlers_ga4.items`
2. `ecommerce.items`

입니다.

그런데 문서상 지금 문제는 애초에 `hurdlers_ga4`를 실제로 채우는 태그가 없다는 점입니다. `ecommerce.items`도 결제완료 시점에 실제로 들어오는지 아직 확인되지 않았습니다. 

즉 [251]을 publish해도, `transaction_id`와 `value`는 개선될 가능성이 있지만, **items는 여전히 빈 배열일 수 있습니다.** 이건 실패는 아니지만 기대치를 낮춰야 합니다.

**의견: items 복구는 Preview로 확인 필요**
**자신감: 82%**

---

# Go / No-Go 판정

## 현재 draft 그대로 publish?

**No-Go**
자신감: **96%**

이유:

1. setup tag에서 `dataLayer.push()`를 사용함
2. 공식 문서 기준으로 같은 이벤트에서 다음 태그가 바로 읽는 값은 `dataLayer.set()`을 써야 함
3. 가상계좌 guard가 아직 검증되지 않음

---

## 수정 후 Preview까지?

**Go**
자신감: **93%**

조건:

1. [251]의 값 주입 방식을 `dataLayer.push()` 중심에서 `google_tag_manager['GTM-W2Z6PHN'].dataLayer.set()` 중심으로 수정
2. 카드 결제, 네이버페이, 가상계좌 미입금 Preview 통과
3. 가상계좌 미입금에서 [251]이 실행되지 않거나, 최소한 value/items를 강화하지 않는 것 확인

---

## 수정 후 운영 publish?

**조건부 Go**
자신감: **84%**

조건:

* A 카드 결제 성공
* B 네이버페이 성공
* C 가상계좌 미입금 차단 성공
* Q1/Q2/Q3 기준 v136 baseline 확보
* publish 후 rollback 가능 상태

---

# 제가 추천하는 수정 방향

## 핵심 수정 1. `dataLayer.set()`로 바꾸기

[251] 안에서 이렇게 바꾸는 게 좋습니다.

```js
var gtm = window.google_tag_manager && window.google_tag_manager['GTM-W2Z6PHN'];

if (gtm && gtm.dataLayer && typeof gtm.dataLayer.set === 'function') {
  gtm.dataLayer.set('hurdlers_ga4', {
    transaction_id: String(orderNo),
    value: value,
    items: items,
    shipping: 0,
    currency: 'KRW'
  });

  gtm.dataLayer.set('_seo_hurdlers_ga4_prep', {
    order_no: String(orderNo),
    rk: rk || null,
    value: value,
    value_source: valueSource,
    items_count: items.length,
    items_source: itemsSource,
    ts: new Date().toISOString(),
    note: 'prep only via google_tag_manager.dataLayer.set'
  });
}
```

그리고 디버그 목적의 `window.dataLayer.push()`는 해도 되지만, 그 값을 [154]가 바로 읽는 핵심 경로로 믿으면 안 됩니다.

---

## 핵심 수정 2. `rk` guard를 더 엄격하게 검토

현재 로직은 `rk`가 없으면 통과합니다.

```js
if (rk && rk !== 'S') return;
```

Preview 결과에 따라 아래 중 하나로 바꿔야 합니다.

### 카드/정상 결제완료 URL에 항상 `rk=S`가 있다면

```js
if (rk !== 'S') return;
```

이게 더 안전합니다.

### 정상 결제에도 `rk`가 없는 경우가 있다면

`window.__seo_allow_purchase` 또는 payment-decision 결과를 반드시 보조 guard로 써야 합니다.

---

## 핵심 수정 3. `value > 0` 조건 추가 검토

가상계좌 미입금에 value가 들어가면 위험합니다.
[251]은 데이터 준비 태그이므로, 최소한 아래 조건을 고려할 수 있습니다.

```js
if (!value || value <= 0) return;
```

다만 value가 늦게 채워지는 정상 결제가 있을 수 있으니, 이건 Preview 결과를 보고 결정해야 합니다.

---

# 다음 파급력 있는 할 일

## 1순위. [251]을 `dataLayer.set()` 방식으로 수정

이게 제일 중요합니다.
지금 문서의 “setupTag로 값 준비” 아이디어가 진짜로 성립하려면 이 수정이 필요합니다. ([Google 도움말][1])

**파급력: 매우 큼**
**자신감: 96%**

---

## 2순위. 가상계좌 미입금 Preview C 시나리오 확정

현재 진짜 큰 리스크는 가상계좌입니다.
가상계좌 주문생성 URL에서 `rk`가 무엇인지, `window.__seo_allow_purchase`가 false인지 확인해야 합니다. 

**파급력: 매우 큼**
**자신감: 94%**

---

## 3순위. 24-48시간 v136 baseline 확인

이미 v136은 live입니다. 지금 바로 다음 publish를 하면 어떤 수정이 효과를 냈는지 분리가 어려워집니다.

봐야 할 것:

* transaction_id `(not set)` 비율
* value=0 비율
* 같은 transaction_id 중복 purchase
* 가상계좌 pending purchase

**파급력: 큼**
**자신감: 90%**

---

## 4순위. [43] Npay 의미 확인

[43]이 Npay 버튼 클릭인지 실제 구매완료인지 확정해야 합니다.
버튼 클릭이면 purchase로 두면 안 되고, 구매완료라면 transaction_id fallback이 필요합니다. 

**파급력: 중-큼**
**자신감: 84%**

---

## 5순위. [48]과 [143]의 GA4 dedup 실제 확인

[48]과 [143]이 같은 transaction_id로 들어오면 GA4 dedup이 어느 정도 작동할 수 있습니다. 하지만 실제 BigQuery에서 purchase count, revenue, items가 어떻게 남는지는 확인해야 합니다.

**파급력: 중간**
**자신감: 82%**

---

# 개발AI에게 지금 줄 지시문

아래 그대로 주시면 됩니다.

```text
[251] GTM prep tag는 방향은 좋지만 현재 dataLayer.push 방식은 setupTag에서 같은 이벤트의 [154]가 즉시 읽는 값으로 보장되지 않는다.

Google 공식 Tag Sequencing 문서 기준으로 setup tag에서 다음 primary tag가 바로 읽어야 하는 값은 google_tag_manager['GTM-W2Z6PHN'].dataLayer.set()으로 주입해야 한다.

따라서 [251] HTML을 아래 원칙으로 수정하라.

1. 핵심 값 주입은 window.dataLayer.push가 아니라 google_tag_manager['GTM-W2Z6PHN'].dataLayer.set('hurdlers_ga4', {...}) 사용
2. event 키 push 금지 유지
3. gtag purchase 직접 발사 금지 유지
4. 디버그 push는 선택사항이지만 [154]가 읽는 핵심 경로로 쓰지 말 것
5. 가상계좌 미입금 시나리오에서 prep이 실행되지 않도록 rk / __seo_allow_purchase guard를 Preview에서 검증할 수 있게 로그를 남길 것
6. publish 금지. workspace draft만 수정
7. 수정 후 Preview 체크리스트 A/B/C를 다시 수행할 것
```

---

# 최종 한 줄

**아이디어는 좋고 draft까지는 Go입니다. 하지만 현재 코드 그대로 운영 publish는 No-Go입니다.**
가장 큰 이유는 `dataLayer.push()`입니다. setup tag에서 바로 다음 태그가 읽어야 하는 값은 공식 문서 기준으로 `google_tag_manager['GTM-W2Z6PHN'].dataLayer.set()`로 넣어야 합니다. 이 부분만 고치고, 가상계좌 guard Preview를 통과하면 그때 publish를 검토하는 게 맞습니다.

[1]: https://support.google.com/tagmanager/answer/6238868?hl=en&utm_source=chatgpt.com "Tag sequencing - Tag Manager Help"
