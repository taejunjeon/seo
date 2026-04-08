# biocom GTM-W7VXS4D8 오류 정리 보고서

작성 시각: 2026-04-09 01:13 KST

## 1. 한 줄 결론
이번 오류는 **바이오컴 결제 적재 시스템 자체가 망가진 문제는 아니고**, `GTM-W7VXS4D8` 안의 **구(舊) Custom HTML 태그 1개가 `null.includes(...)`를 치는 버그**로 보는 것이 맞소.

즉 지금 당장 가장 현실적인 정리는 다음 2단계요.

1. **W2 정본(`GTM-W2Z6PHN`)과 우리 attribution footer는 그대로 유지**
2. `W7(GTM-W7VXS4D8)` 안의 **문제 태그만 null-safe로 고치거나, payment page에서만 막기**

## 2. 이번에 내가 실제로 확인한 것
이번 턴에는 말로 추정만 한 것이 아니라, **라이브 공개 GTM 컨테이너 파일을 직접 내려받아 내부 resource를 파싱**했소.

내가 한 일:
- `https://www.googletagmanager.com/gtm.js?id=GTM-W7VXS4D8` 다운로드
- GTM resource(`macros`, `tags`, `rules`, `predicates`) 파싱
- `Custom HTML`, `Custom JavaScript` 안의 위험 코드 확인

확인 결과 핵심 증거는 이것이오.

### 문제 태그
- 컨테이너: `GTM-W7VXS4D8`
- 태그 타입: `Custom HTML`
- GTM 내부 태그 번호: `tag_id: 44`
- 발화 시점: `gtm.load`

### 실제 문제 코드
아래 로직이 현재 공개 컨테이너 안에 들어 있소.

```js
(function(){
  try {
    var b = sessionStorage.getItem("__bs_imweb_session"), a;
    b && (a = JSON.parse(b));
    var c = a.utmSource,
        d = a.utmMedium,
        e = a.utmCampaign,
        f = a.utmContent,
        g = a.utmTerm,
        h = a.memberCode;

    c.includes("RETOUS_") && (...)
  } catch (k) {
    console.log(k)
  }
})();
```

왜 문제냐면:
- `a`가 없을 수 있소. 즉 `sessionStorage`에 `__bs_imweb_session`이 없거나 JSON 파싱이 안 되면 `a`는 비어 있소.
- 그 상태에서 `a.utmSource`를 읽거나, `c.includes("RETOUS_")`를 실행하면 에러가 나오.
- 여기서 `includes`는 영어 메서드인데, **문자열 안에 특정 글자가 들어 있는지 검사하는 함수**요.
  - 예: `"abc".includes("a") === true`
- 그런데 `c`가 `null` 또는 `undefined`면, **문자열이 아니기 때문에 `includes`를 쓸 수 없소.**
- 그래서 브라우저 콘솔에 `Cannot read properties of null (reading 'includes')` 같은 오류가 뜨오.

## 3. 중요한 점: 이 태그는 단순 잡음이 아니오
처음에는 “이 태그 그냥 꺼도 되겠다”라고 보기 쉬운데, 실제 구조는 조금 더 복잡하오.

이번에 확인한 구조:
- `tag_id: 44` = 구 `Custom HTML`
  - `gtm.load` 때 실행됨
  - 조건이 맞으면 `dataLayer.push({ event: 'c_retous_crm_open', ... })`
- `tag_id: 52` = newer GA4 이벤트 태그
  - 이벤트 이름: `retous_crm_open_new`
  - 이 태그는 `event = c_retous_crm_open`일 때 발화됨

즉 `tag_id: 44`는 **오류를 내는 태그**이면서 동시에,
`c_retous_crm_open` 이벤트를 만들어 주는 **이벤트 생산자(producer)** 역할도 하고 있소.

이 말은 곧:
- 외주 CRM 회사가 아직 이 이벤트를 실제로 쓰고 있다면,
- `tag_id: 44`를 무조건 꺼버리면
- 오류는 사라질 수 있지만, `retous_crm_open_new` 같은 후속 이벤트도 안 갈 수 있소.

그래서 **현재 외주사가 아직 작업 중이라면, 1순위는 “완전 삭제”가 아니라 null-safe patch**요.

## 4. 지금 내가 판단한 가장 가능성 높은 원인
현재 공개 컨테이너를 파싱해서 본 결과,
**실제 custom code 중 `.includes(`를 직접 치는 핵심 구문은 `tag_id: 44`가 사실상 가장 유력**하오.

정리하면:
- `W7` 내부에서 `utmSource`를 sessionStorage에서 바로 읽음
- null 방어 없이 `includes("RETOUS_")` 사용
- 이 태그는 `gtm.load`에서 바로 실행됨
- 따라서 결제완료 페이지처럼 세션 값이 비거나, 예상과 다른 상태일 때 오류가 발생할 수 있소.
- 이번에 공개 컨테이너의 `Custom HTML + Custom JavaScript` 코드를 전부 훑어본 결과, **직접 `includes(`를 치는 핵심 custom code는 이 `tag_id: 44`가 사실상 유일한 유력 후보**였소.

## 5. 이번 턴에서 내가 실제로 시행한 조치
### 내가 직접 한 조치
- 라이브 공개 컨테이너를 내려받아 내부 구조를 파싱했소.
- 문제 태그 후보를 **추정이 아니라 `tag_id: 44`까지 특정**했소.
- newer replacement 성격의 태그(`tag_id: 52`)가 별도로 존재한다는 것도 확인했소.
- 즉 “무엇을 어디서 왜 고쳐야 하는지”를 이제 GTM 작업자에게 구체적으로 전달할 수 있는 상태로 만들었소.

### 내가 이번 턴에서 직접 못 한 조치
- **실제 GTM 컨테이너 publish**
- **GTM UI 안에서 태그 pause / trigger exception / 코드 수정**

이건 이유가 명확하오.
- GTM 컨테이너는 외부 서비스 안에 있소.
- 지금 이 저장소나 로컬 서버에서 GTM UI를 직접 수정할 권한/연결이 없소.
- 즉 **코드 저장소 안에서 고칠 수 있는 문제가 아니고, GTM 관리자 화면에서 손봐야 하는 문제**요.

## 6. 내가 할 일 / TJ님 또는 직원이 할 일

## 6-1. 내가 할 수 있는 일
1. **문제 태그를 정확히 특정해 주는 것**
- 현재 가장 유력한 문제 태그는 `GTM-W7VXS4D8 > tag_id 44 > Custom HTML`
- 이 태그 안에 `c.includes("RETOUS_")`가 있소.

2. **수정 코드를 사람이 바로 붙일 수 있게 준비해 주는 것**
- 아래에 최소 수정안과 안전 우회안을 적어 두었소.

3. **수정 후 검증 체크리스트를 제공하는 것**
- 어떤 페이지에서
- 무엇을 보고
- 어떤 결과가 나오면 성공인지
정리해 둘 수 있소.

## 6-2. TJ님 또는 직원 / 외주사가 해야 하는 일
이 부분은 **반드시 GTM 관리자 화면에서** 해야 하오.

1. `GTM-W7VXS4D8` 컨테이너 열기
2. `tag_id 44` 또는 아래 문자열로 검색
   - `c_retous_crm_open`
   - `RETOUS_`
   - `sessionStorage.getItem("__bs_imweb_session")`
3. 해당 태그가 정말 `Custom HTML`인지 확인
4. 아래 두 선택지 중 하나 실행
   - A안: **null-safe patch**
   - B안: **payment_complete 페이지에서만 예외 처리**
5. Publish
6. 결제완료 페이지와 일반 CRM 유입 페이지 둘 다 재검증

## 7. 가장 권장하는 수정안
### A안. 가장 권장: null-safe patch
외주사가 아직 CRM 추적을 쓸 가능성이 있으면 이 안이 가장 좋소.

현재 위험 코드:

```js
var b = sessionStorage.getItem("__bs_imweb_session"), a;
b && (a = JSON.parse(b));
var c = a.utmSource;
...
c.includes("RETOUS_")
```

권장 수정 코드:

```js
(function () {
  try {
    var raw = sessionStorage.getItem("__bs_imweb_session");
    var session = raw ? JSON.parse(raw) : null;

    var utmSource = session && typeof session.utmSource === "string"
      ? session.utmSource
      : "";
    var utmMedium = session && typeof session.utmMedium === "string"
      ? session.utmMedium
      : "";
    var utmCampaign = session && typeof session.utmCampaign === "string"
      ? session.utmCampaign
      : "";
    var utmContent = session && typeof session.utmContent === "string"
      ? session.utmContent
      : "";
    var utmTerm = session && typeof session.utmTerm === "string"
      ? session.utmTerm
      : "";
    var memberCode = session && typeof session.memberCode === "string"
      ? session.memberCode
      : "";

    if (!utmSource.includes("RETOUS_")) return;

    var payload = {
      event: "c_retous_crm_open",
      event_category: "Ecommerce",
      event_action: "c_retous_crm_open",
      event_label: "CRM 메시지 오픈",
      ecommerce: { items: [] },
      retous_utm_source: utmSource,
      retous_utm_medium: utmMedium,
      retous_utm_campaign: utmCampaign,
      retous_utm_content: utmContent,
      retous_utm_term: utmTerm,
      retous_member_code: memberCode,
    };

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
  } catch (error) {
    console.log(error);
  }
})();
```

왜 이 코드가 더 안전하냐면:
- sessionStorage가 비어 있어도 괜찮소.
- `utmSource`가 비어 있으면 빈 문자열(`""`)로 바꿔서 처리하오.
- 빈 문자열에도 `includes()`는 안전하게 쓸 수 있소.
- 즉 같은 기능은 유지하면서 에러만 없애오.

## 8. 차선책
### B안. payment page에서만 임시 차단
만약 외주사가 지금 당장 코드를 못 고친다면,
**결제완료 페이지(`shop_payment_complete`, `shop_order_done`)에서만 이 태그를 막는 예외 trigger**를 넣는 것도 가능하오.

이 안의 장점:
- 결제 페이지 콘솔 오류를 빨리 줄일 수 있소.
- 우리 정본 purchase 흐름(`W2 + attribution footer`)을 더 깔끔하게 유지할 수 있소.

이 안의 단점:
- 근본 원인은 여전히 남아 있소.
- 다른 페이지에서도 같은 조건이 나오면 다시 터질 수 있소.
- CRM open 이벤트가 payment page에서는 빠질 수 있소.

즉 이건 **응급처치**요. 근본 해결은 A안이오.

## 9. “끄는 것”은 언제 가능하냐
`tag_id: 44`를 완전히 끄는 것은 아래 조건 중 하나일 때만 권장하오.

1. 외주 CRM 회사가 이 이벤트를 더 이상 안 쓴다고 확인됨
2. `tag_id: 52`를 포함한 후속 측정 로직도 불필요하다고 합의됨
3. 또는 W7 컨테이너 전체를 점진 제거하기로 내부 합의가 끝남

지금 단계에서는 CRM 회사가 아직 작업 중이라고 하셨으니,
**완전 제거보다 먼저 null-safe patch를 권장**하오.

## 10. 정본과 support 컨테이너를 쉽게 설명하면
영어 용어가 헷갈릴 수 있어 쉽게 풀어 적겠소.

- **Canonical container / 정본 컨테이너**
  - 최종적으로 믿고 보는 메인 측정 컨테이너요.
  - 바이오컴에서는 `GTM-W2Z6PHN` 쪽이 이 역할이오.

- **Support container / 보조 컨테이너**
  - 외주사, CRM, 보조 추적, 임시 태그가 붙는 보조용이오.
  - 바이오컴에서는 `GTM-W7VXS4D8`가 이 성격이오.

- **Custom HTML**
  - GTM 안에서 직접 자바스크립트를 써서 실행하는 태그요.
  - 유연하지만, null 체크가 빠지면 지금처럼 에러가 나기 쉽소.

- **Trigger**
  - “언제 이 태그를 실행할지”를 정하는 조건이오.
  - 예: `gtm.load`, 클릭, 특정 페이지 진입 등.

- **gtm.load**
  - 페이지 로딩이 거의 끝났을 때 GTM이 발생시키는 내부 이벤트요.
  - 이 시점에는 태그가 자동 실행될 수 있소.

- **dataLayer**
  - GTM에 이벤트를 넘기는 공용 배열이오.
  - 예: `dataLayer.push({ event: 'purchase' })`

- **null-safe**
  - 값이 비어 있어도 에러가 나지 않게 방어하는 코딩 방식이오.
  - 예: `var x = value || "";`

## 11. 수정 후 확인해야 할 것
수정 후에는 아래 4개를 같이 보아야 하오.

1. **결제완료 페이지 콘솔 에러가 사라졌는지**
- 특히 `Cannot read properties of null (reading 'includes')`가 없어져야 하오.

2. **W2 purchase 정본은 그대로 살아 있는지**
- `GTM-W2Z6PHN` 쪽 purchase 흐름이 깨지면 안 되오.

3. **우리 attribution footer 적재는 계속 되는지**
- `/api/attribution/payment-success` 저장이 계속 정상이어야 하오.

4. **CRM 쪽 필요한 데이터가 계속 들어가는지**
- 외주사가 이 이벤트를 아직 쓰면, 그쪽 수신 로그도 확인해야 하오.

## 12. 내 권장 우선순위
현재 상황에서 가장 현실적인 우선순위는 이거요.

1. **외주사/직원에게 `tag_id 44`와 코드 조각을 정확히 전달**
2. **먼저 null-safe patch 적용**
3. **payment_complete 테스트 1회**
4. 그래도 CRM 가치가 낮고 오류만 많으면,
   그다음에 `payment page 차단` 또는 `W7 점진 제거` 논의

## 13. 이번 턴의 최종 판단
- 결제 적재 메인 시스템이 깨진 것은 아니오.
- `W7` 안의 **구 CRM-open Custom HTML 태그가 가장 유력한 오류 원인**이오.
- 외주사가 아직 작업 중이라면, **삭제보다 먼저 null-safe patch**가 맞소.
- 만약 내부적으로 “이 이벤트 의미 없다”가 확인되면, 그때는 **payment page 차단 또는 태그 제거**로 가면 되오.

## 14. TJ님이 내일 바로 물어보면 좋은 질문
외주사나 직원에게는 아래처럼 물으면 되오.

1. `GTM-W7VXS4D8` 안 `tag_id 44` 또는 `c_retous_crm_open` 태그 아직 실제로 쓰고 있나?
2. 이 태그가 지금도 CRM 보고서/자동화에 꼭 필요한가?
3. 필요하다면 왜 null-safe 처리 없이 배포됐나?
4. 이번 수정 후 아래 3개 증거를 줄 수 있나?
   - GTM Preview fired tags 화면
   - 콘솔 에러 없는 화면
   - CRM/GA4 수신 로그
