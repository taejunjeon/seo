## 결론부터 정리하면

네이버페이 버튼 작업의 핵심은 **“버튼 클릭을 구매로 집계하지 말고, 결제 의도(intent)를 먼저 저장한 뒤 실제 결제 완료 주문과 매칭해서 구매 전환을 서버에서 복구하는 것”**입니다.

현재 가장 큰 문제는 네이버페이 결제 후 고객이 biocom 결제완료 페이지로 돌아오지 않기 때문에, 기존 footer 기반 GA4/Meta 구매 태그가 실행될 기회가 없다는 점입니다. 그래서 GA4 purchase, 광고 attribution, ROAS 분석이 누락되거나 왜곡됩니다. 업로드된 검토 문서에서도 이 부분을 **“단 하나의 핵심 제약”**으로 짚고 있습니다.

---

## 네이버페이 버튼 관련해서 할 작업

|작업|무엇을 할지|왜 필요한지|어떻게 도움되는지|
|---|---|---|---|
|**1. 네이버페이 버튼 클릭 시점에 intent 저장**|GTM 기존 네이버페이 버튼 태그 `[118]` 또는 footer에 `sendBeacon()`을 추가해 `cid`, `session_id`, 상품 정보, URL, UTM 등을 `/api/attribution/npay-intent`로 전송|네이버페이는 결제완료 페이지로 복귀하지 않아 기존 footer가 GA4 식별값을 저장하지 못함|실제 결제 완료 전이라도 “이 사용자가 네이버페이 결제를 시작했다”는 브라우저 식별값을 확보할 수 있음|
|**2. 서버에 `npay_intent_log` 저장소 추가**|버튼 클릭 시 받은 `client_id`, `ga_session_id`, `product_idx`, `member_code`, timestamp 등을 저장|결제 완료 주문이 나중에 Toss/아임웹 sync로 들어오므로, 미리 저장한 intent와 주문을 매칭해야 함|네이버페이 구매를 GA4 세션/UTM과 다시 연결할 수 있음|
|**3. Toss/아임웹 주문 sync와 intent 매칭**|신규 NPay 주문이 감지되면 최근 intent row와 `member_code`, 시간, 상품 정보 등으로 매칭|네이버페이 직접 webhook을 받기 어렵기 때문에 현재 인프라에서는 폴링 기반 매칭이 현실적|결제완료 페이지 미도달 상황에서도 실제 주문 기준으로 purchase 이벤트 생성 가능|
|**4. GA4 Measurement Protocol로 purchase 전송**|매칭된 intent의 실제 `client_id`와 `session_id`를 사용해 서버에서 GA4 `purchase` 이벤트 전송|단순 서버 합성 ID를 쓰면 Direct로 잡혀 attribution이 소실됨|GA4에서 네이버페이 구매가 실제 유입 소스/세션과 연결될 가능성이 높아짐|
|**5. Meta CAPI Purchase도 같이 확장**|GA4와 같은 주문/intent 매칭 결과를 Meta CAPI Purchase로도 전송|Meta browser pixel도 결제완료 페이지 미도달 시 발사되지 않음|Meta 광고 성과/ROAS 누락도 함께 줄일 수 있음|
|**6. Google Ads NPay 구매 전환 태그 `[248]` 정리**|현재 버튼 클릭 시점에 “구매 전환”으로 잡히는 태그를 중단하거나 역할 변경|버튼 클릭은 결제 완료가 아니므로 구매 전환으로 잡으면 과대 집계됨|클릭 수와 실제 구매 수를 분리해 Google Ads 전환 품질 개선|

---

## 가장 중요한 판단: 버튼 클릭은 “구매”가 아니라 “결제 시도”로 봐야 함

현재 검토 문서상 Google Ads `[248]` 태그는 네이버페이 버튼 클릭 시점에 구매 전환처럼 발사되는 구조로 보입니다. 이건 데이터적으로 위험합니다. 클릭한 사람이 실제 결제까지 완료했는지 알 수 없기 때문입니다.

따라서 네이버페이 버튼 클릭 이벤트는 이렇게 다루는 게 맞습니다.

**기존 방식**

> 네이버페이 버튼 클릭 = 구매 전환

**권장 방식**

> 네이버페이 버튼 클릭 = 결제 intent 저장  
> 실제 NPay 주문 확인 = purchase 전환 전송

이렇게 바꾸면 “구매 의향”과 “실제 매출”이 분리돼서 GA4, Meta, Google Ads 데이터가 훨씬 정확해집니다 📊

---

## 우선순위는 이렇게 가는 게 좋습니다

### 1순위: Option A 확인 — return URL 수정 가능 여부

먼저 아임웹 관리자와 네이버페이 파트너센터에서 **네이버페이 결제 후 biocom 결제완료 페이지로 복귀시키는 return URL 설정이 가능한지** 확인해야 합니다.

이게 가능하면 가장 깔끔합니다. 고객이 다시 결제완료 페이지로 돌아오므로 기존 GA4, Meta Pixel, TikTok Pixel, Google Ads 태그가 정상 실행될 수 있습니다. 문서에서도 Option A가 성공하면 서버사이드 Option B보다 우선이라고 정리되어 있습니다.

### 2순위: 네이버페이 버튼 intent beacon 선행

Option A를 확인하는 동안에도 **네이버페이 버튼 클릭 시점의 cid/session_id 저장 작업은 먼저 준비하는 게 좋습니다.**

이 작업은 Option A가 실패했을 때 바로 서버사이드 복구로 넘어가기 위한 보험입니다. 또한 나중에 Google Ads `[248]` 오탐 문제를 고칠 때도 버튼 클릭 데이터가 필요합니다.

### 3순위: Option B — 서버사이드 purchase dispatcher 구현

Option A가 안 되면 서버에서 다음 흐름을 구현합니다.

```text
네이버페이 버튼 클릭
→ cid / session_id / 상품 / UTM 저장
→ 네이버페이 결제 완료
→ Toss 또는 아임웹 주문 sync로 실제 주문 감지
→ intent와 주문 매칭
→ GA4 Measurement Protocol purchase 전송
→ Meta CAPI Purchase 전송
→ dispatch log로 중복 방지
```

문서 기준으로는 기존 `refundDispatcher.ts`, `GA4_MP_API_SECRET_BIOCOM`, `attribution_ledger`, Toss/아임웹 sync 패턴을 상당 부분 재사용할 수 있어 **3~4일 작업**으로 판단되어 있습니다.

---

## 이 작업을 하면 좋아지는 점

첫째, **네이버페이 구매 누락을 줄일 수 있습니다.**  
현재는 네이버페이 결제 후 결제완료 페이지로 돌아오지 않으면 GA4 purchase가 빠질 수 있습니다. 버튼 intent와 서버사이드 purchase 전송을 붙이면 실제 주문 기준으로 purchase를 복구할 수 있습니다.

둘째, **UTM/광고 attribution 보존 가능성이 올라갑니다.**  
버튼 클릭 시점에 GA4 `client_id`와 `session_id`를 저장하면, 나중에 서버에서 purchase를 보낼 때 원래 세션에 붙일 수 있습니다. 단, GA4 세션 매칭은 시간 지연에 민감하므로 NPay 결제 완료 및 sync가 30분 안쪽으로 처리되는 것이 중요합니다.

셋째, **ROAS 분석이 더 정확해집니다.**  
광고 클릭 → 네이버페이 구매가 현재는 Direct로 빠지거나 아예 누락될 수 있는데, 이 작업을 하면 광고 채널별 매출 기여도를 더 정확히 볼 수 있습니다.

넷째, **버튼 클릭 구매 오탐을 제거할 수 있습니다.**  
Google Ads `[248]`처럼 버튼 클릭을 구매로 잡는 구조를 정리하면, 실제 구매 전환과 단순 클릭이 분리됩니다. 이건 전환 품질 측면에서 꽤 중요합니다.

다섯째, **Meta CAPI까지 같이 복구할 수 있습니다.**  
GA4만이 아니라 Meta CAPI Purchase도 같은 매칭 로직으로 보낼 수 있으므로, Meta 광고 최적화에도 도움이 됩니다.

---

## 추천 실행안

제가 추천하는 실행 순서는 이렇습니다.

1. **이번 주 안에 Option A 확인**  
    아임웹 관리자와 네이버페이 파트너센터에서 return URL 설정 가능 여부 확인.
    
2. **동시에 GTM `[118]` 네이버페이 버튼 태그에 intent beacon 초안 추가**  
    바로 publish하지 말고 Preview에서 `/api/attribution/npay-intent` 호출 여부부터 확인.
    
3. **`/api/attribution/npay-intent` endpoint와 `npay_intent_log` 준비**  
    버튼 클릭 시점의 `cid`, `session_id`, 상품, URL, UTM, timestamp 저장.
    
4. **Option A 실패 시 서버사이드 dispatcher 진행**  
    Toss/아임웹 주문 sync 결과와 intent를 매칭해 GA4 MP purchase + Meta CAPI Purchase 전송.
    
5. **Google Ads `[248]` 정리**  
    네이버페이 버튼 클릭 구매 전환은 제거하거나 “NPay 클릭” 이벤트로 낮추고, 실제 구매는 서버사이드 또는 return page 기반으로 전환.
    

---

## 한 줄 요약

**네이버페이 버튼은 더 이상 “구매 전환 발사 버튼”이 아니라, “구매 전환을 복구하기 위한 식별값 저장 버튼”으로 바꿔야 합니다.**  
이렇게 하면 NPay 구매 누락, Direct attribution, Google Ads 클릭 오탐을 동시에 줄이고 GA4/Meta ROAS 분석 정확도를 크게 높일 수 있습니다.