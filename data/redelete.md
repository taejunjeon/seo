# biocom 리인벤팅 CRM 태그 제거 계획

작성 시각: 2026-04-11 KST

## 한 줄 결론

리인벤팅 CRM 협업을 종료하기로 했으므로, 이제 `GTM-W7VXS4D8`는 수정 요청 대상이 아니라 **제거 대상**으로 본다.

단, 아래 2개는 절대 같이 지우면 안 된다.

- 메인 구매 추적 GTM: `GTM-W2Z6PHN`
- 전태준 대표님이 구축한 자체 솔루션으로 결제 성공 정보를 보내는 사이트 스크립트

즉 목표는 **외주 CRM 보조 컨테이너 `GTM-W7VXS4D8`만 제거하고, 메인 구매 추적과 자체 Attribution 수집은 그대로 유지**하는 것이다.

## 삭제 후 검증 결과

검증 시각: 2026-04-11 12:23 KST 전후

현재 확인 결과는 **삭제 성공**으로 본다.

확인한 것:

- `https://biocom.kr/` live HTML에서 `GTM-W7VXS4D8` 문자열이 사라졌다.
- `https://biocom.kr/` live HTML에서 `GTM-W2Z6PHN`는 남아 있다.
- `https://biocom.kr/` live HTML에서 자체 솔루션 endpoint `checkout-context`, `payment-success`는 남아 있다.
- Headless Chrome으로 홈 페이지를 열었을 때 네트워크 로그에는 `gtm.js?id=GTM-W2Z6PHN`만 잡혔다.
- Headless Chrome 콘솔 로그에서 기존 대표 오류 `Cannot read properties of null (reading 'includes')`는 잡히지 않았다.
- 비로그인 상태의 결제완료 URL은 `/login?...back_url=...`로 redirect되지만, redirect된 로그인 페이지에서도 `GTM-W7VXS4D8`는 잡히지 않았고 `GTM-W2Z6PHN`와 자체 솔루션 스크립트는 남아 있었다.

확인 명령:

```bash
curl -L -sS 'https://biocom.kr/' -o /tmp/biocom-home-after-redelete.html
rg 'GTM-W7VXS4D8|GTM-W2Z6PHN|att\.ainativeos|checkout-context|payment-success' /tmp/biocom-home-after-redelete.html
```

확인된 live HTML match:

```text
GTM-W2Z6PHN
att.ainativeos.net/api/attribution/checkout-context
att.ainativeos.net/api/attribution/payment-success
```

찾히지 않은 것:

```text
GTM-W7VXS4D8
Cannot read properties of null (reading 'includes')
RETOUS_
retous
```

주의:

- 실제 로그인 세션이 필요한 결제완료 원본 페이지는 headless 비로그인 환경에서 직접 열 수 없었다.
- 다만 W7은 사이트 공통 코드에서 제거된 상태로 보이므로, 로그인된 결제완료 페이지에서도 같은 공통 헤더/바디 기준이면 기존 W7 `includes` 오류는 사라졌을 가능성이 높다.
- 최종 확정은 실제 브라우저 로그인 세션 또는 새 테스트 주문 결제완료 페이지에서 DevTools Console을 한 번 더 확인하면 된다.

## 삭제 전 확인된 배치 상태

삭제 전 라이브 홈 HTML을 `curl https://biocom.kr/`로 확인했을 때의 배치 상태다.

### 1. 헤더 코드 영역

삭제 전에는 `<head>` 안에 GTM 컨테이너 2개가 함께 들어 있었다.

```html
<!-- Google Tag Manager - Reinventing CRM -->
... GTM-W7VXS4D8 ...
<!-- End Google Tag Manager -->

<!-- Google Tag Manager - Biocom Canonical -->
... GTM-W2Z6PHN ...
<!-- End Google Tag Manager -->
```

해석:

- `GTM-W7VXS4D8`는 리인벤팅 CRM 보조 컨테이너다.
- `GTM-W2Z6PHN`는 바이오컴 메인 구매 추적/정본 GTM이다.
- 제거 대상은 **W7 블록 전체**다.
- 유지 대상은 **W2 블록 전체**다.

### 2. 바디 코드 영역

삭제 전에는 `<body>` 시작부에도 noscript iframe이 2개 있었다.

```html
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-W2Z6PHN" ...></iframe></noscript>

<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-W7VXS4D8" ...></iframe></noscript>
```

해석:

- 제거 대상은 **W7 noscript iframe**이다.
- 유지 대상은 **W2 noscript iframe**이다.

### 3. 푸터 코드 영역

현재 푸터에는 전태준 대표님이 구축한 자체 솔루션 연동 스크립트가 들어 있다.

주요 endpoint:

- `https://att.ainativeos.net/api/attribution/checkout-context`
- `https://att.ainativeos.net/api/attribution/payment-success`

주요 역할:

- `checkout_started` 수집
- `payment_success` 수집
- `checkoutId`로 결제 시작과 결제완료 연결
- `ga_session_id`, `client_id`, `user_pseudo_id`, `fbclid`, `fbc`, `fbp` 수집

해석:

- 이 푸터 코드는 리인벤팅 CRM 코드가 아니다.
- `GTM-W7VXS4D8` 제거와 무관하게 반드시 유지해야 한다.
- 최근 테스트 주문에서 이 푸터 코드가 정상 적재된 것을 이미 확인했다.

## 왜 제거해야 하나

기존 `data/gtmerror.md`, `data/gtmerrorreply.md` 기준으로 `GTM-W7VXS4D8` 안의 Custom HTML 태그가 결제완료 페이지에서 오류를 낸다.

대표 오류:

```text
Cannot read properties of null (reading 'includes')
```

기존에 좁혀진 원인:

- 컨테이너: `GTM-W7VXS4D8`
- 태그 후보: `tag_id 44`
- 태그 유형: Custom HTML
- 발화 시점: `gtm.load`
- 문제 코드 성격: `sessionStorage` 값이 비어 있는데 `c.includes("RETOUS_")`를 호출

예전에는 리인벤팅 CRM이 계속 필요할 가능성이 있었으므로 `null-safe patch` 또는 payment page 제외가 우선이었다. 이제 협업 종료가 확정됐으므로, 문제 태그를 살리는 것보다 **W7 컨테이너 자체를 제거하는 것이 더 단순하고 안전하다**.

## 제거 대상과 유지 대상

| 구분 | 항목 | 조치 |
|---|---|---|
| 리인벤팅 CRM GTM head script | `GTM-W7VXS4D8` | 제거 |
| 리인벤팅 CRM GTM body noscript | `GTM-W7VXS4D8` iframe | 제거 |
| 바이오컴 정본 GTM head script | `GTM-W2Z6PHN` | 유지 |
| 바이오컴 정본 GTM body noscript | `GTM-W2Z6PHN` iframe | 유지 |
| 자체 솔루션 checkout 수집 | `att.ainativeos.net/api/attribution/checkout-context` | 유지 |
| 자체 솔루션 결제완료 수집 | `att.ainativeos.net/api/attribution/payment-success` | 유지 |
| Meta Pixel | `fbq('init', '1283400029487161')` | 이번 작업에서는 유지 |
| Google Ads tag | `AW-304339096` | 이번 작업에서는 유지 |
| Naver WCS | `wcslog.js` 계열 | 이번 작업에서는 유지 |

## 실행 계획

### 0단계. 변경 전 백업

아임웹 관리자에서 아래 영역을 그대로 복사해 백업한다.

- 헤더 코드 상단
- 헤더 코드
- 바디 코드
- 푸터 코드

백업 파일명 제안:

- `footer/header_top_backup_YYYYMMDD.md`
- `footer/header_backup_YYYYMMDD.md`
- `footer/body_backup_YYYYMMDD.md`
- `footer/footer_backup_YYYYMMDD.md`

목적:

- 실수로 W2나 자체 솔루션 스크립트를 지웠을 때 즉시 되돌리기 위함이다.
- 변경 전후 어떤 코드가 제거됐는지 내부 기록으로 남기기 위함이다.

### 1단계. 아임웹 코드 영역에서 W7 위치 찾기

아임웹 관리자 코드 입력 영역에서 아래 문자열을 검색한다.

```text
GTM-W7VXS4D8
```

찾아야 하는 위치:

- 헤더 코드 또는 헤더 코드 상단의 `Google Tag Manager - Reinventing CRM` 스크립트
- 바디 코드의 `GTM-W7VXS4D8` noscript iframe

주의:

- `GTM-W2Z6PHN`는 검색되어도 지우지 않는다.
- `att.ainativeos.net`가 검색되어도 지우지 않는다.

### 2단계. 헤더에서 W7 script 제거

제거할 블록:

```html
<!-- Google Tag Manager - Reinventing CRM -->
<script>
(function(w,d,s,l,i){
  w[l]=w[l]||[];
  w[l].push({'gtm.start': new Date().getTime(), event:'gtm.js'});
  var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),
      dl=l!='dataLayer' ? '&l='+l : '';
  j.async=true;
  j.src='https://www.googletagmanager.com/gtm.js?id=' + i + dl;
  f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-W7VXS4D8');
</script>
<!-- End Google Tag Manager -->
```

남겨야 하는 블록:

```html
<!-- Google Tag Manager - Biocom Canonical -->
... GTM-W2Z6PHN ...
<!-- End Google Tag Manager -->
```

### 3단계. 바디에서 W7 noscript 제거

제거할 블록:

```html
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-W7VXS4D8"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
```

남겨야 하는 블록:

```html
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-W2Z6PHN"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
```

### 4단계. 푸터는 건드리지 않기

현재 푸터의 자체 솔루션 스크립트는 유지한다.

특히 아래 문자열이 포함된 코드는 제거하지 않는다.

```text
checkout-context
payment-success
att.ainativeos.net
2026-04-11-checkout-started-v1
2026-04-11-payment-success-checkout-linked-v1
```

이 코드는 리인벤팅 CRM 코드가 아니라, 내부 ROAS/Attribution 원장을 만들기 위한 핵심 수집 코드다.

### 5단계. 게시 후 live HTML 검증

게시 후 아래를 확인한다.

성공 기준:

- `https://biocom.kr/` HTML에서 `GTM-W7VXS4D8`가 더 이상 보이지 않는다.
- `https://biocom.kr/` HTML에서 `GTM-W2Z6PHN`는 계속 보인다.
- `att.ainativeos.net/api/attribution/checkout-context`가 계속 보인다.
- `att.ainativeos.net/api/attribution/payment-success`가 계속 보인다.

로컬 확인 명령:

```bash
curl -L -sS 'https://biocom.kr/' -o /tmp/biocom-home-after.html
rg 'GTM-W7VXS4D8|GTM-W2Z6PHN|att.ainativeos|checkout-context|payment-success' /tmp/biocom-home-after.html
```

주의:

- 결제완료 URL은 비로그인 `curl`에서 로그인 페이지로 redirect될 수 있다.
- 결제완료 페이지 검증은 로그인된 브라우저 또는 실제 테스트 주문 플로우에서 확인하는 것이 맞다.

### 6단계. 브라우저 검증

Chrome DevTools에서 확인한다.

Network 탭:

- 없어야 함: `gtm.js?id=GTM-W7VXS4D8`
- 있어야 함: `gtm.js?id=GTM-W2Z6PHN`
- 있어야 함: `checkout-context`
- 있어야 함: `payment-success`

Console 탭:

- 없어야 함: `Cannot read properties of null (reading 'includes')`
- 없어야 함: `GTM-W7VXS4D8` 관련 오류

테스트 주문:

- 가상계좌 주문 1건 생성
- 결제완료 페이지 도달
- 자체 솔루션 원장에 `payment_success` row 생성 확인
- 주문서 진입 시 `checkout_started` row 생성 확인
- 가능하면 `checkout_id`가 두 row에 같이 들어오는지 확인

### 7단계. 24시간 모니터링

제거 직후 24시간 동안 아래를 본다.

- `payment_success` 적재 건수 급감 여부
- `checkout_started` 적재 건수 유지 여부
- `payment_success` all-three coverage 유지 여부
- Meta Pixel / CAPI purchase 전송량 급변 여부
- GA4 purchase 또는 W2 쪽 purchase 이벤트 급감 여부

성공 기준:

- W7 오류는 사라진다.
- W2와 자체 솔루션 수집은 유지된다.
- Attribution ledger의 `payment_success`와 `checkout_started`가 계속 들어온다.

## 롤백 계획

협업 종료가 확정됐으므로 원칙적으로 W7은 되살리지 않는다.

다만 제거 직후 예상 밖으로 메인 구매 추적이 깨졌다면, 원인은 보통 W7 제거가 아니라 W2/푸터 코드를 같이 건드린 실수일 가능성이 높다. 이 경우 롤백 순서는 다음이다.

1. 백업한 헤더/바디/푸터 코드와 현재 코드를 비교한다.
2. `GTM-W2Z6PHN`가 살아 있는지 확인한다.
3. `att.ainativeos.net` 자체 솔루션 코드가 살아 있는지 확인한다.
4. W2나 자체 솔루션 코드가 지워졌다면 해당 부분만 복구한다.
5. W7은 내부적으로 반드시 필요하다는 새 증거가 나오기 전까지 복구하지 않는다.

## 리스크

- 리인벤팅 CRM 리포트, retous 계열 CRM open 이벤트, 외주사 측 자동화는 중단될 수 있다.
- 이 중단은 협업 종료에 따른 의도된 영향이다.
- 만약 W7 안에서 GA4 또는 광고 이벤트를 중복으로 보내고 있었다면, 제거 후 일부 외부 플랫폼 숫자가 줄 수 있다.
- 이 감소는 오히려 중복/legacy 태그 제거 효과일 수 있으므로, 메인 판단은 W2 + 자체 솔루션 Attribution 기준으로 봐야 한다.

## 개발팀에 전달할 요청 문장

리인벤팅 CRM 협업 종료로 `GTM-W7VXS4D8`는 더 이상 유지하지 않기로 했습니다. 아임웹 코드 영역에서 `GTM-W7VXS4D8` head script와 body noscript iframe을 제거해 주세요.

단, `GTM-W2Z6PHN`와 `att.ainativeos.net`로 전송되는 자체 솔루션 스크립트는 절대 삭제하지 말아 주세요. 제거 후에는 홈/결제완료 페이지에서 `GTM-W7VXS4D8` 네트워크 호출이 사라졌는지, `GTM-W2Z6PHN`, `checkout-context`, `payment-success`는 계속 호출되는지 확인해 주세요.
