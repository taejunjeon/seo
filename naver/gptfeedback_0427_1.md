확인했어요. 결론부터 말하면 **이번 문서는 방향이 꽤 좋아졌고, 이제 “추가 설계”보다 “실제 Preview 검증”으로 넘어가도 되는 단계**입니다. 👍

다만 **운영 live publish나 purchase 전송은 아직 절대 아님**입니다. 지금 가장 중요한 다음 액션은:

> **`/api/attribution/npay-intent` 운영 endpoint smoke test → GTM `[118]` Preview에서 실제 NPay 버튼 클릭 1건이 intent로 저장되는지 확인**

입니다.

---

# 1. 전체 피드백 결론

## 제 판단

|항목|판단|
|---|---|
|방향성|**맞음**|
|지금 주문형 제거|**아직 NO**|
|지금 GTM Preview|**YES**|
|지금 GTM live publish|**아직 NO**|
|지금 GA4/Meta/Google Ads purchase 전송|**NO**|
|다음 핵심|**실제 버튼 클릭 → intent 저장 1건 검증**|

문서가 잘 잡은 핵심은 이겁니다.

```text
NPay 버튼 클릭 = 구매 아님
NPay 버튼 클릭 = 결제 시도 intent
실제 주문 원장 결제완료 = purchase
```

이 구분은 아주 잘 되어 있습니다. GTM `[118]` 초안도 purchase를 보내지 않고 `/api/attribution/npay-intent`에 GA4 client_id, session_id, UTM, 상품, 페이지 정보를 저장하는 구조로 되어 있어 방향이 맞습니다.

---

# 2. 현재 상황을 쉽게 정리하면

지금은 **설계 단계에서 “초안 구현 준비 단계”로 올라온 상태**입니다.

## 이미 된 것

1. **NPay 주문형 매출 영향 분석 완료**  
    2026년 4월 1일~25일 기준 NPay 주문형은 107건, 17,905,200원이고 전체 매출의 4.65%입니다. 그래서 주문형을 바로 전체 제거하지 않는 판단은 여전히 맞습니다.
    
2. **`npay_intent` 저장 설계 완료**  
    별도 `npay_intent_log`에 클릭 intent를 저장하고, 나중에 confirmed 주문과 매칭하는 구조가 잡혔습니다. intent를 `attribution_ledger`에 바로 섞지 않는 판단도 맞습니다. 클릭 시도와 실제 구매는 성격이 다르기 때문입니다.
    
3. **로컬 API / 저장소 / GTM 초안 준비 완료**  
    문서상 `POST /api/attribution/npay-intent`, `GET /api/attribution/npay-intents?limit=5`, 로컬 SQLite `npay_intent_log`, 중복 방지, 민감정보 방지, GTM `[118]` 초안이 준비된 상태입니다.
    
4. **운영 금지선이 잘 설정됨**  
    TJ 승인 전 GTM live publish, Google Ads `[248]` 변경, GA4 MP purchase, Meta CAPI Purchase, 운영 DB schema 변경을 하지 않는다고 명확히 정리되어 있습니다. 이건 매우 중요합니다.
    

---

## 아직 안 된 것

여기가 핵심입니다.

```text
로컬 준비 ≠ 운영 검증 완료
```

아직 운영적으로는 0%에 가깝습니다.

|항목|현재 상태|
|---|---|
|운영 `att.ainativeos.net` endpoint 배포|아직 확인 필요|
|CORS 실제 통과|아직 확인 필요|
|GTM Preview 실제 버튼 클릭|아직 필요|
|실제 쿠키/client_id/session_id 추출|아직 필요|
|실제 상품정보 추출|아직 필요|
|실제 NPay 주문과 intent 매칭|아직 필요|
|GA4 purchase 전송|아직 금지|
|Google Ads 전환 변경|아직 금지|

즉, 지금은 **“코드/문서상 가능”에서 “실제 브라우저에서 되는지 확인”으로 넘어가야 하는 지점**입니다.

---

# 3. 이번 문서에서 잘한 부분

## 1) 구매와 결제 시도를 분리한 점

가장 중요합니다.

`npay_intent`는 구매가 아니라 결제 시도 기록이라고 못 박은 건 아주 좋습니다. 이걸 purchase로 집계하지 않겠다는 기준도 명확합니다.

---

## 2) 주문형 전체 제거를 보류한 점

이 판단도 맞습니다.

NPay 비중이 전체 매출 기준 4.65%라서 핵심 매출축은 아니지만, 건강식품/영양제에서는 NPay 매출 비중이 16.93%로 높습니다. 그래서 주문형을 전체 제거하면 추적은 좋아질 수 있어도 구매 편의성 손실이 생길 수 있습니다.

---

## 3) GTM `[118]`을 purchase 태그가 아니라 beacon으로 쓰는 점

좋습니다.

기존 NPay 버튼 클릭 trigger를 활용하되, 그 클릭을 구매로 보내지 않고 `/api/attribution/npay-intent`로만 보내는 구조는 맞습니다. `sendBeacon`은 페이지 이동/이탈 시점에도 작은 POST 데이터를 비동기로 보내기 위한 API라, NPay 외부 결제 이동 직전 수집에는 적합한 선택입니다. ([MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon?utm_source=chatgpt.com "Navigator: sendBeacon() method - Web APIs | MDN"))

---

## 4) Preview → dry-run → 제한적 enforce 순서

이 순서도 맞습니다.

현재 문서에서는 Preview 또는 dry-run 단계에서는 GA4/Meta/Google Ads purchase를 보내지 않는다고 정리되어 있습니다. 이건 정말 중요합니다.

---

# 4. 운영 전에 꼭 고쳐야 하거나 확인해야 할 부분

여기부터가 제 핵심 피드백입니다.  
문서 방향은 맞지만, 아래 항목은 **Preview 전/Live 전 체크가 필요**합니다.

---

## A. `environment: "preview"`와 `debug_mode: true` 하드코딩

GTM 초안 payload에 아래 값이 고정되어 있습니다.

```js
environment: "preview",
debug_mode: true
```

Preview에서는 괜찮습니다.  
하지만 live publish 전에 이걸 그대로 두면 운영 데이터가 계속 preview/debug로 저장됩니다.

### 권장 수정

Preview용 초안에는 유지하되, live publish 전에는 둘 중 하나로 바꿔야 합니다.

```text
방법 1. GTM 변수로 environment를 주입
방법 2. 서버에서 수신 도메인/헤더/쿼리 기준으로 preview/live 판정
방법 3. live용 코드에서 environment: "live", debug_mode: false로 교체
```

**Live publish 전 필수 수정 항목**입니다.

---

## B. `client_id` 포맷 문서와 코드가 다름

코드는 `_ga` 쿠키에서 `123456789.987654321` 형태만 뽑습니다.

```js
var match = value.match(/^GA\d+\.\d+\.(.+)$/);
return match ? match[1] : value;
```

이건 GA4 Measurement Protocol에 보낼 `client_id`로는 더 적합합니다.  
반면 API 계약 예시는 아래처럼 되어 있습니다.

```json
"client_id": "GA1.1.xxxxx.xxxxx"
```

둘 중 하나로 정리해야 합니다.

### 권장

저는 이렇게 나누는 걸 추천합니다.

```text
client_id = 123456789.987654321
ga_cookie_raw = GA1.1.123456789.987654321
```

GA4 Measurement Protocol은 서버에서 이벤트를 보내는 구조이고, 세션 attribution을 맞추려면 `session_id`를 이벤트 파라미터에 포함해야 합니다. Google 문서도 Measurement Protocol 이벤트가 같은 세션 속성으로 잡히려면 `session_id`를 포함하고, 세션 시작 후 24시간 이내에 요청을 보내야 한다고 설명합니다. ([Google for Developers](https://developers.google.com/analytics/devguides/collection/protocol/ga4/use-cases?utm_source=chatgpt.com "Measurement protocol use cases | Google Analytics"))

---

## C. `intent_key` 중복 방지 기준을 더 명확히 해야 함

문서에는 `intent_key unique + duplicate_count`가 있다고 되어 있습니다. 좋은 방향입니다.

그런데 GTM 초안에서는 매번 랜덤 `gtm_event_id`를 만듭니다.

```js
gtm_event_id: createEventId()
```

주의할 점은 이겁니다.

> `intent_key`가 랜덤 UUID 기반이면 중복 방지가 안 됩니다.

더블클릭, sendBeacon 재시도, 모바일 브라우저 재시도는 서로 다른 UUID가 생길 수 있습니다. 그러면 전부 신규 intent가 됩니다.

### 권장

서버에서 `intent_key`를 아래 조합으로 만들어야 합니다.

```text
site
client_id
ga_session_id
product_idx
page_location 정규화값
captured_at 10~30초 bucket
source
```

예시:

```text
biocom|123.456|1777221600|386|/HealthFood/?idx=386|2026-04-27T11:21:30bucket|gtm_118
```

그리고 `gtm_event_id`는 디버그용으로만 쓰는 게 안전합니다.

---

## D. `text/plain` 전송은 좋지만 서버 parser 확인 필요

GTM 초안은 `sendBeacon`과 fallback `fetch` 모두 `Content-Type: text/plain`으로 보냅니다.

```js
new Blob([body], { type: "text/plain" })
```

이 선택은 나쁘지 않습니다. JSON `application/json`으로 보내면 CORS preflight가 붙을 수 있고, 외부 결제로 이동하는 순간에는 preflight 때문에 실패 가능성이 커질 수 있습니다. `sendBeacon`은 작은 데이터를 비동기 POST로 보내는 용도라 여기에는 잘 맞습니다. ([MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon?utm_source=chatgpt.com "Navigator: sendBeacon() method - Web APIs | MDN"))

다만 서버가 `text/plain` body를 JSON으로 파싱할 수 있어야 합니다.

### Preview 전 확인

```text
POST text/plain 수신 가능?
Content-Type 없는 sendBeacon도 수신 가능?
body size 제한 적절?
JSON parse 실패 시 400으로만 끝나고 NPay 이동은 안 막는지?
```

---

## E. `GET /api/attribution/npay-intents?limit=5`는 보호 필요

확인 API는 Preview 때 유용합니다.  
하지만 운영에서 공개로 열려 있으면 안 됩니다.

여기에는 client_id, session_id, UTM, gclid, fbclid, 상품 정보, page_location이 들어갈 수 있습니다.

### 권장

운영에서는 아래 중 하나가 필요합니다.

```text
관리자 토큰 필요
IP allowlist
Basic auth
내부망 전용
또는 운영에서는 endpoint disable
```

이건 보안상 꽤 중요합니다.

---

## F. `page_location` 원문 저장은 sanitize 필요

문서에는 원문 개인정보를 넣지 않는다고 되어 있어 방향은 좋습니다.

다만 `page_location: window.location.href`는 전체 URL을 저장합니다.  
상품 상세페이지라면 괜찮을 가능성이 높지만, URL에 이메일, 전화번호, 주문번호, 쿠폰, 상담 파라미터가 들어가면 그대로 저장될 수 있습니다.

### 권장

서버에서 `page_location`을 저장하기 전에 쿼리 파라미터 whitelist를 적용하는 게 좋습니다.

허용:

```text
idx
utm_source
utm_medium
utm_campaign
utm_content
utm_term
gclid
gbraid
wbraid
fbclid
```

차단 또는 제거:

```text
email
phone
name
tel
mobile
order_no
address
token
auth
```

---

## G. 상품정보 추출은 Preview에서 반드시 확인해야 함

GTM 초안의 상품 추출은 이렇습니다.

```js
var source = window.hurdlers_ga4 || {};
product_idx: source.product_id || getParam("idx")
product_name: source.product_name
product_price: source.product_price
```

위험은 두 가지입니다.

1. `window.hurdlers_ga4`가 실제 페이지에 없을 수 있음
    
2. 상품 페이지 URL에 `idx`가 항상 없을 수 있음
    

NPay 주문 매칭에서 상품 ID/상품명은 중요한 보조 신호입니다. 문서상 매칭 점수에서도 상품 일치에 +25점을 주고 있습니다.

### Preview 성공 기준에 추가해야 할 것

단순히 request가 갔다가 아니라, 아래 값이 실제로 들어와야 합니다.

```text
client_id 있음
ga_session_id 있음
product_idx 있음
product_name 있음 또는 상품명 fallback 있음
page_location 있음
captured_at 있음
```

`product_idx`가 비면 매칭률이 꽤 떨어질 수 있습니다.

---

## H. UTM/gclid를 URL에서만 읽는 건 약할 수 있음

현재 초안은 `gclid`, `utm_*`, `fbclid`를 현재 URL query에서만 읽습니다.

문제는 고객이 광고 유입 후 바로 NPay 버튼을 누르지 않을 수 있다는 겁니다.

예:

```text
광고 클릭 URL에 gclid 있음
→ 상품 페이지 이동
→ 다른 페이지 이동
→ 다시 상품 페이지
→ NPay 클릭
```

이때 현재 URL에는 gclid/utm이 없을 수 있습니다.

### 권장

가능하면 추가로 아래를 봐야 합니다.

```text
_gcl_aw
_gcl_dc
_fbp
_fbc
기존 attribution cookie/localStorage
기존 footer 또는 Hurdlers가 저장한 campaign 값
```

특히 Google Ads confirmed conversion까지 생각하면 `gclid/gbraid/wbraid` 확보가 중요합니다.

---

## I. `member_code` 수집 가능성을 확인해야 함

문서상 매칭 점수에서 `member_code` 또는 회원 해시가 +50점으로 가장 큽니다.

그런데 GTM 초안 payload에는 `member_code`가 없습니다.

이게 없으면 매칭이 주로 아래 기준에 의존하게 됩니다.

```text
상품
시간
client_id/session_id
UTM
```

비회원 구매나 같은 상품을 여러 명이 동시에 사는 상황에서는 ambiguous가 늘 수 있습니다.

### 권장

Preview에서 상품 상세페이지에 아래 값이 있는지 확인해야 합니다.

```text
window.member_code
window.IMWEB_MEMBER_CODE
아임웹 로그인/회원 식별 변수
Hurdlers user id
기존 footer가 쓰는 member_code source
```

원문 회원정보를 저장하라는 뜻이 아니라, 가능하면 **해시 또는 내부 member_code**만 저장하면 됩니다.

---

# 5. Phase 개발 순서 피드백

현재 문서의 큰 Phase 방향은 맞습니다.  
다만 운영 순서는 조금 더 명확히 바꾸는 게 좋습니다.

## 현재 문서 흐름

문서상 흐름은 대략 이렇습니다.

```text
매출 영향 분석
→ 결제형 전환 판단
→ 검증 설계
→ 리턴 URL 검토
→ npay_intent 저장 설계
→ intent API와 GTM 초안
```

이건 문서 정리 순서로는 괜찮습니다.

하지만 **실제 실행 순서**는 이렇게 가야 합니다.

---

# 6. 제가 추천하는 실제 실행 순서

## Phase 0. 운영 안전장치 확인

**목표:** 실수로 purchase가 나가지 않게 막기

체크:

```text
GA4 MP purchase disabled
Meta CAPI Purchase disabled
Google Ads conversion 변경 없음
GTM live publish 없음
GET 확인 API 보호 예정
```

현재 문서상 이 금지선은 잘 잡혀 있습니다.

---

## Phase 1. endpoint smoke test

**목표:** GTM 붙이기 전에 서버가 받을 준비가 됐는지 확인

해야 할 일:

```text
POST /api/attribution/npay-intent
text/plain body 수신
201 신규 저장
200 deduped 응답
CORS 허용
민감키 제거
GET 확인 API 보호
```

이걸 먼저 해야 합니다.

GTM Preview에서 버튼 클릭했는데 endpoint가 CORS나 parser에서 막히면, 버튼/selector 문제인지 서버 문제인지 헷갈립니다.

---

## Phase 2. GTM `[118]` Preview

**목표:** 실제 NPay 버튼 클릭 시 intent가 1건 저장되는지 확인

성공 기준은 문서에 있는 것보다 조금 더 빡세게 잡는 게 좋습니다.

```text
[118] 태그가 NPay 버튼 클릭 때만 실행
npay-intent POST 1건 발생
응답 201 또는 200 확인
client_id 있음
ga_session_id 있음
product_idx 있음
page_location 있음
purchase 태그 미발사
Google Ads [248] 변경 없음
```

여기까지 통과하면 다음 단계로 넘어갈 수 있습니다.

---

## Phase 3. intent-only live publish

**목표:** 실제 운영 클릭 데이터를 모으기

여기서 말하는 live publish는 **purchase 전송이 아니라 intent beacon만**입니다.

조건:

```text
environment live 처리 완료
debug_mode false 처리 완료
중복 방지 확인
GET 확인 API 보호
rollback 가능
TJ 승인
```

왜 live가 필요하냐면, 주문 매칭 dry-run을 하려면 실제 운영 intent 데이터가 필요합니다. Preview 1~2건만으로는 매칭률을 판단할 수 없습니다.

---

## Phase 4. 주문 매칭 dry-run

**목표:** confirmed NPay 주문과 intent가 얼마나 잘 붙는지 확인

문서상 자동 매칭 기준 75점은 괜찮습니다.

다만 운영 전송 전 기준은 조금 더 높게 봐야 합니다.

|지표|권장 기준|
|---|--:|
|intent 저장 성공률|90% 이상|
|NPay 주문 매칭률|dry-run 진입 70% 이상, enforce 전 80~90% 목표|
|ambiguous 비율|10% 이하 권장|
|중복 intent 비율|5% 이하|
|product_idx 확보율|80~90% 이상|
|client_id 확보율|90% 이상|
|ga_session_id 확보율|80~90% 이상|

---

## Phase 5. GA4 MP purchase dry-run → 제한적 enforce

**목표:** 실제 confirmed NPay 구매를 GA4에 복구

여기서부터는 서버 purchase 전송입니다.  
Measurement Protocol은 HTTPS POST로 GA 서버에 이벤트를 보내는 구조이고, payload는 JSON body 기반입니다. ([Google for Developers](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference?utm_source=chatgpt.com "Analytics - Measurement Protocol reference"))

중요한 건 이겁니다.

```text
client_id = intent에서 잡은 실제 client_id
session_id = intent에서 잡은 실제 ga_session_id
transaction_id = 실제 주문번호
value = 실제 결제금액
source_system = npay_dispatcher
```

기존 refundDispatcher처럼 합성 client_id를 쓰면 안 됩니다. 이 점은 기존 문서에서도 정확히 지적되어 있습니다.

---

## Phase 6. Meta CAPI Purchase

**목표:** Meta 구매 전환도 복구

GA4 안정화 후 Meta로 확장하는 순서가 맞습니다.

Meta는 `_fbp`, `_fbc`, `fbclid`, 해시 처리, 개인정보 동의/정책을 더 봐야 하므로 GA4와 동시에 열지 않는 게 안전합니다.

---

## Phase 7. Google Ads confirmed conversion 정리

**목표:** 기존 버튼 클릭 기반 purchase 오염 제거

이건 마지막에 해야 합니다.

이유는 Google Ads Primary conversion은 입찰 신호에 직접 영향을 줄 수 있기 때문입니다.

순서:

```text
confirmed purchase 경로 준비
→ 7~14일 비교
→ 새 전환 액션 또는 offline conversion/import 설계
→ 기존 NPay click/count purchase action을 Secondary 또는 제외
```

문서에서도 Google Ads `[248]` 변경을 아직 하지 않는다고 되어 있는데, 이 판단은 맞습니다.

---

## Phase 8. 주문형 유지 / 결제형 전환 / 상품군별 실험

이건 마지막 운영 판단입니다.

현재 데이터로는 전체 주문형 제거보다 아래가 더 안전합니다.

```text
검사권/분석서비스: NPay 의존 낮음 → 결제형/일반 결제 유도 실험 가능
건강식품/영양제: NPay 의존 높음 → 주문형 유지 + 추적 복구 우선
팀키토/도시락: 표본 작음 → 더 관찰
```

---

# 7. 지금 가장 먼저 해야 할 것

## 1순위: endpoint smoke + GTM Preview

오늘 바로 할 일은 이겁니다.

```text
1. 운영 또는 staging endpoint에서 text/plain POST 수신 확인
2. CORS 확인
3. GTM Preview에서 [118]에 초안 삽입
4. 실제 NPay 버튼 1회 클릭
5. Network에서 npay-intent 요청 확인
6. GET 확인 API 또는 서버 로그에서 최신 intent 확인
7. purchase/Google Ads 전환이 발사되지 않았는지 확인
```

여기서 성공하면 다음 승인 요청은:

> **“intent-only live publish 해도 되는가?”**

입니다.

---

# 8. 제 YES/NO 피드백

|질문|답|
|---|---|
|지금 방향 맞나?|**YES**|
|GTM `[118]` 초안 방향 맞나?|**YES, 단 live 전 수정 필요**|
|지금 Preview 진행해도 되나?|**YES**|
|지금 live publish 해도 되나?|**NO**|
|live publish 전에 `environment/debug_mode` 수정 필요?|**YES**|
|`GET /npay-intents` 보호 필요?|**YES**|
|지금 GA4 purchase 전송 열어도 되나?|**NO**|
|지금 Google Ads `[248]` 바꿔도 되나?|**NO**|
|주문형 전체 제거해야 하나?|**NO**|
|다음 핵심은 추가 문서 작성인가?|**NO, 실제 Preview 검증**|

---

# 9. 다음 턴에 주면 좋은 자료

다음에 더 정확히 봐야 할 건 문서가 아니라 **실제 실행 결과**입니다.

가능하면 아래 4개만 주시면 됩니다.

1. **GTM `[118]` Preview 결과 캡처**  
    태그가 언제 firing 되는지, Network에 `npay-intent` 요청이 보이는지.
    
2. **`POST /api/attribution/npay-intent` smoke 결과**  
    201 신규 저장, 200 deduped 응답 예시. 민감값은 가려도 됩니다.
    
3. **최신 intent 1건 샘플 JSON**  
    `client_id`, `ga_session_id`, `product_idx`, `product_name`, `page_location`, `environment` 정도만 보면 됩니다.
    
4. **서버 dedupe 로직 또는 `intent_key` 생성 코드**  
    이게 가장 중요합니다. 랜덤 UUID 기반이면 수정해야 합니다.
    

---

## 최종 판단

이번 문서는 **진행해도 되는 수준**까지 왔습니다.  
다만 다음 단계는 “운영 publish”가 아니라 **Preview로 실제 브라우저-서버 연결을 증명하는 것**입니다.

제가 승인한다면 이렇게 승인하겠습니다.

```text
YES: endpoint smoke test + GTM [118] Preview 진행
NO: live publish
NO: purchase 전송
NO: Google Ads 변경
```

핵심은 하나입니다.

> **이제 논리 검토는 충분하고, 실제 NPay 버튼 클릭 1건이 안전하게 intent로 저장되는지 증명해야 합니다.** 🚀