# 네이버 커머스API 정리

작성 시각: 2026-04-20 01:02 KST
최종 업데이트: 2026-04-20 01:41 KST
기준 문서: 네이버 커머스API `2.76.0 (2026-04-15)`

## 10초 요약

네이버 커머스API는 스마트스토어의 주문, 상품, 정산, 판매자 정보를 서버에서 조회하거나 처리하기 위한 공식 HTTP API다.

현재 `backend/.env`에는 `BIOCOM_STORE_APP_ID`, `BIOCOM_STORE_APP_SECRET`이 등록되어 있다.
이 값으로 OAuth 토큰 발급용 전자서명을 만들 수 있다.

2026-04-20 스모크 테스트 결과, 현재 등록된 값만으로 `SELF` 토큰 발급과 주문 변경/상세 조회가 모두 200으로 열렸다.
하지만 현재 토큰이 볼 수 있는 채널은 `바이오컴 스토어` 1개뿐이다.
더클린커피 GA4 `NPAY - ...` 65건을 네이버 주문 원장과 닫으려면 더클린커피 통합매니저 권한 또는 더클린커피용 커머스API 앱 자격 증명이 필요하다.

## 문서 목적

이 문서는 네이버 커머스API를 우리 SEO 프로젝트에서 어떻게 써야 하는지 정리한다.
특히 GA4의 `NPAY - ...` transaction_id 주문을 네이버 원장과 대사하기 위한 출발점이다.

## 현재 로컬 설정

`backend/.env` 212~214행에 네이버 커머스API 센터 값이 등록되어 있다.

```text
# 네이버 커머스API 센터
BIOCOM_STORE_APP_ID=***MASKED***
BIOCOM_STORE_APP_SECRET=***MASKED***
```

주의:
- 실제 값은 문서에 적지 않는다.
- Git 커밋 대상에 `.env`를 포함하지 않는다.
- 로그에도 `APP_SECRET`, 전자서명, access token을 찍지 않는다.

## API의 성격

커머스API는 스마트스토어의 주요 기능과 콘텐츠를 HTTP API로 호출하기 위한 공식 API다.
사용하려면 커머스API센터에 가입하고 애플리케이션을 등록해 권한을 얻어야 한다.

우리 프로젝트 관점에서 중요한 API 영역은 아래다.

| 영역 | 용도 | 우리 프로젝트에서의 의미 |
|---|---|---|
| 인증 | access token 발급 | 모든 API 호출의 선행 조건 |
| 주문 | 상품 주문 조회, 변경 주문 조회, 주문 상세 조회 | GA4 `NPAY - ...` 주문과 네이버 주문 원장 대사 |
| 정산 | 부가세/정산 내역 조회 | Naver Pay gross/net 및 수수료 대사 후보 |
| 상품 | 상품/옵션/카탈로그 조회 및 수정 | 당장은 후순위. 상품 매핑이 필요할 때 사용 |
| 판매자정보 | 판매자/채널 정보 조회 | account UID, 채널 번호, 스토어 식별 확인 |

## 기본 호출 규칙

기본 운영 호스트는 아래다.

```text
https://api.commerce.naver.com/external
```

기본 형식:
- RESTful API를 지향한다.
- 파일 업로드/다운로드 예외를 제외하면 기본 메시지 형식은 JSON이다.
- 요청과 응답은 UTF-8 기준이다.
- 날짜/시간은 ISO 8601 형식을 쓰고, 오프셋은 KST `UTC+09:00` 기준이다.
- 요청 날짜 데이터도 KST 기준으로 처리된다.

응답에서 반드시 저장해야 할 헤더:

| 헤더 | 의미 | 저장 이유 |
|---|---|---|
| `GNCP-GW-Trace-ID` | 요청별 고유 Trace ID | 장애/문의 때 원인 추적에 필요 |
| `GNCP-GW-HttpClient-ResponseTime` | 커머스API 요청 처리 시간 ms | 느린 API, 재시도 원인 분석 |
| `GNCP-GW-RateLimit-Remaining` | 남은 초당 요청 수 | 호출 제한 회피 |
| `GNCP-GW-Quota-Remaining` | 남은 quota | 장기 동기화 안정성 확인 |

## 인증 구조

커머스API는 OAuth2 Client Credentials 방식을 쓴다.
API 요청 시에는 access token을 `Authorization` 헤더에 넣는다.

```text
Authorization: Bearer {access_token}
```

토큰 발급 URL:

```text
POST https://api.commerce.naver.com/external/v1/oauth2/token
Content-Type: application/x-www-form-urlencoded
```

토큰 유효 시간:
- 기본 3시간, 즉 10,800초다.
- 같은 리소스에는 하나의 토큰이 발급된다.
- 남은 유효 시간이 30분 이상이면 기존 토큰이 반환된다.
- 남은 유효 시간이 30분 미만이면 새 토큰을 받을 수 있다.
- 새 토큰이 발급되어도 기존 토큰은 만료 전까지 사용할 수 있다.

### 전자서명 생성

토큰 발급 요청에는 `client_secret` 원문을 보내지 않는다.
대신 전자서명 `client_secret_sign`을 만들어 보낸다.

생성 재료:

| 값 | 의미 |
|---|---|
| `client_id` | 애플리케이션 ID. 현재 `BIOCOM_STORE_APP_ID` |
| `client_secret` | 애플리케이션 시크릿. 현재 `BIOCOM_STORE_APP_SECRET` |
| `timestamp` | 밀리초 단위 Unix time |

생성 방식:

1. `client_id`와 `timestamp`를 밑줄로 연결한다.
2. 위 문자열을 `client_secret`을 salt로 하여 bcrypt 해싱한다.
3. 해싱 결과를 Base64 인코딩한다.
4. 그 값을 `client_secret_sign`으로 보낸다.

의사 코드:

```text
password = `${client_id}_${timestamp}`
hashed = bcrypt(password, client_secret)
client_secret_sign = base64(hashed)
```

### 토큰 유형

토큰 유형은 `type` 값으로 갈린다.
이 부분이 가장 중요하다.

| type | 권한 의미 | 우리 프로젝트 판단 |
|---|---|---|
| `SELF` | 솔루션사 시스템 전용 API | 앱 자체 관리/솔루션 API용. 주문 원장 조회에는 부족할 수 있음 |
| `SELLER` | 판매자 스마트스토어 데이터 접근 | 주문, 상품, 판매자 주소록 등 조회/처리에 필요 |

`SELLER` 토큰 발급에는 `account_id`가 필요하다.
공식 가이드에서는 이를 판매자 UID로 설명한다.

토큰 요청 payload 예시:

```text
client_id={APP_ID}
timestamp={MILLISECOND_TIMESTAMP}
client_secret_sign={SIGNATURE}
grant_type=client_credentials
type=SELF
```

판매자 리소스 접근용:

```text
client_id={APP_ID}
timestamp={MILLISECOND_TIMESTAMP}
client_secret_sign={SIGNATURE}
grant_type=client_credentials
type=SELLER
account_id={SELLER_ACCOUNT_UID}
```

현재 확인 필요:
- 2026-04-20 확인 결과, 현재 `BIOCOM_STORE_APP_ID`는 `SELF` 토큰으로 주문 조회 API를 호출할 수 있다.
- 따라서 바이오컴 등록 앱 기준의 주문 조회에는 별도 `account_id` 없이 접근 가능하다.
- `GET /v1/seller/channels` 확인 결과 현재 토큰의 채널 범위는 `바이오컴 스토어` 1개다.
- 더클린커피 Imweb cache의 네이버 주문번호 샘플은 `GET /v1/pay-order/seller/orders/{orderId}/product-order-ids`에서 `400 / 101010 / 처리권한이 없는 주문번호를 요청했습니다`로 막힌다.
- 결론: 현재 바이오컴 앱 ID와 시크릿만으로 더클린커피 주문 원장에 접근하는 우회 경로는 확인되지 않았다.
- 정산 API도 같은 권한으로 열리는지는 아직 별도 확인이 필요하다.

## 스토어 권한과 매니저 구조

네이버 커머스API는 앱 자격 증명이 가진 판매자/채널 권한 밖의 주문을 열어 주지 않는다.
현재 바이오컴 앱으로 바이오컴 주문은 조회되지만, 더클린커피 주문은 `처리권한 없음`으로 막히는 것이 이 구조와 일치한다.

### 현재 확인된 API 범위

2026-04-20 read-only 확인 결과:

| 항목 | 결과 |
|---|---|
| 토큰 발급 | 200 |
| 판매자 계정 조회 | 200 |
| 판매자 채널 조회 | 200 |
| 현재 토큰의 채널 수 | 1 |
| 현재 토큰의 채널 | 바이오컴 스토어 |
| 더클린커피 주문번호 접근 | `400 / 101010 / 처리권한 없음` |

이 결과 때문에 `BIOCOM_STORE_APP_ID/BIOCOM_STORE_APP_SECRET`를 더클린커피 NPAY 대사에 그대로 쓰면 안 된다.
겉으로는 주문 API가 200으로 열리더라도, 그 원장은 바이오컴 주문 원장이다.

### 주매니저와 통합매니저

네이버 공식 문서 기준으로 `내스토어 애플리케이션` 메뉴는 통합매니저만 접근 가능하다.
주매니저는 초대받아 권한을 가질 수 있지만, 커머스API 앱을 만들 수 있는 메뉴가 제한된다.
커머스API센터의 매니저 초대 기능은 통합매니저 위임 기능이 아니다.

더클린커피 계정이 주매니저라서 API 생성 메뉴가 보이지 않는다면 정상적인 가능성이 높다.
이 경우 API센터에서 해결하는 것이 아니라 스마트스토어센터에서 기존 통합매니저가 통합매니저 권한을 위임해야 한다.

통합매니저 위임 경로:

```text
스마트스토어센터 > 판매자정보 > 매니저 관리 > 통합 매니저 위임
```

운영 절차:

1. 더클린커피의 현재 통합매니저 계정으로 스마트스토어센터에 접속한다.
2. 위 메뉴에서 API 생성에 사용할 커머스ID가 주매니저로 등록되어 있는지 확인한다.
3. 해당 커머스ID로 통합매니저 권한을 위임한다.
4. 위임받은 통합매니저 계정으로 커머스API센터에 접속한다.
5. `내스토어 애플리케이션`에서 더클린커피용 앱을 만든다.
6. 주문 조회 권한을 포함해 앱 ID와 시크릿을 발급한다.
7. 로컬에는 바이오컴 키와 분리해 `COFFEE_STORE_APP_ID`, `COFFEE_STORE_APP_SECRET` 형태로 저장한다.
8. `backend/scripts/reconcile-coffee-ga4-naverpay.py`를 더클린커피 키로 재실행한다.

주의:
- 통합매니저는 사업자번호 기준 1개만 가능하다.
- 위임 대상 ID가 이미 다른 스토어의 통합매니저라면 위임이 제한될 수 있다.
- 기존 통합매니저가 없거나 접근할 수 없으면 네이버 스마트스토어 고객센터/톡톡상담으로 권한 복구 또는 위임을 요청해야 한다.

## 인증 실패와 재시도 원칙

401 응답이 오고 오류 코드가 `GW.AUTHN`이면 토큰 만료 가능성이 높다.
이 경우 새 토큰을 발급받아 1회 재시도한다.

재시도 원칙:
- `401 + GW.AUTHN`: 토큰 재발급 후 1회 재시도
- `429 + GW.RATE_LIMIT`: 짧은 backoff 후 재시도
- `429 + GW.QUOTA_LIMIT`: quota가 돌아올 때까지 중단
- `403 + GW.IP_NOT_ALLOWED`: 허용 IP 설정 문제. 코드 재시도 금지
- `404 + GW.NOT_FOUND`: endpoint 또는 권한 그룹 확인
- `5xx`, `GW.TIMEOUT.*`: 지수 backoff. Trace ID 저장

## 제약 사항

운영 구현에서 반드시 반영해야 하는 제약이다.

| 제약 | 내용 | 구현 기준 |
|---|---|---|
| TLS | TLS 1.2 이상 필요 | Node fetch/axios 기본 TLS 유지 |
| 권한 그룹 | API별 권한 그룹 필요 | 앱 등록 화면에서 주문/정산 권한 확인 |
| Rate limit | 개별 API와 인증 앱 단위 token bucket | 동시 요청 제한, 큐 처리 |
| Quota limit | 판매자 리소스 요청 제한 | 장기 sync는 pagination + checkpoint |
| 운영 스토어 테스트 | 실제 운영 스토어 테스트로 생긴 문제는 네이버 책임 범위 밖 | 읽기 API부터 시작, 쓰기 API 금지 |

## 주문 API에서 먼저 볼 것

Naver Pay 대사 목적이면 주문 API부터 확인한다.

### 1. 변경 상품 주문 내역 조회

```text
GET /v1/pay-order/seller/product-orders/last-changed-statuses
```

용도:
- 특정 기간에 상태가 바뀐 상품 주문을 조회한다.
- 조회 기준은 변경 일시다.
- `lastChangedTo`를 생략하면 `lastChangedFrom`부터 24시간을 조회한다.
- 결과는 변경 일시 오름차순, 같은 시각이면 상품 주문 번호 오름차순이다.
- 한 번에 최대 300개 또는 `limitCount`까지 제공된다.
- 더 있으면 응답의 `more.moreFrom`, `more.moreSequence`를 다음 요청에 넘겨 이어서 받는다.

우리 사용:
- 매일 또는 매시간 증분 동기화의 기본 API로 적합하다.
- 주문 상태 변화, 취소/반품/확정 변화를 추적하는 출발점이다.

### 2. 상품 주문 상세 내역 조회

```text
POST /v1/pay-order/seller/product-orders/query
```

용도:
- 상품 주문 번호를 넣어 상세 내역을 조회한다.
- 요청 가능한 상품 주문 번호는 최대 300개다.

우리 사용:
- 변경 내역 API로 상품 주문 번호를 모은 뒤 상세 내역을 한 번 더 조회한다.
- GA4의 `NPAY - ...` transaction_id와 실제 네이버 주문/상품 주문 번호를 연결할 후보 API다.

### 3. 조건형 상품 주문 상세 내역 조회

```text
GET /v1/pay-order/seller/product-orders
```

용도:
- 조건에 맞는 상품 주문 상세 내역을 조회한다.

우리 사용:
- 특정 날짜 범위 또는 상태 기준으로 Naver Pay 원장 전체를 맞출 때 후보 API다.

### 4. 상품 주문 번호 목록 조회

```text
GET /v1/pay-order/seller/orders/:orderId/product-order-ids
```

용도:
- 주문 ID 하나에 연결된 상품 주문 번호 목록을 조회한다.

우리 사용:
- GA4 `NPAY - ...`에서 주문 ID를 추출할 수 있으면 상세 상품 주문으로 확장하는 데 쓴다.

## 정산 API에서 볼 것

주문 API는 주문과 상태를 잡는 데 좋다.
하지만 최종 매출, 수수료, 정산 금액은 정산 API까지 봐야 닫힌다.

공식 문서상 정산 영역에는 아래 계열이 있다.

| API 영역 | 용도 | 우리 프로젝트 사용 |
|---|---|---|
| 부가세 내역 | 건별/일별 부가세 조회 | 세금계산/부가세 기준 매출 확인 |
| 정산 내역 | 건별/일별 정산 및 수수료 상세 | Naver Pay net revenue 산정 |

우선순위:
1. 주문 API로 GA4 `NPAY - ...` 주문 ID와 네이버 원장 주문을 연결한다.
2. 주문 결제 금액과 상태가 맞으면 1차 대사는 닫힌다.
3. 이후 정산 API로 수수료와 실제 net을 붙인다.

## 우리 프로젝트 적용 계획

### 1단계: 토큰 스모크 테스트

목표:
- `BIOCOM_STORE_APP_ID`, `BIOCOM_STORE_APP_SECRET`로 전자서명을 만들 수 있는지 확인한다.
- `SELF` 토큰 발급이 되는지 확인한다.
- 필요하면 `SELLER` 토큰 발급에 필요한 `account_id`를 확보한다.

성공 기준:
- `POST /v1/oauth2/token`이 200을 반환한다.
- access token 유효 시간이 확인된다.
- 실패 시 `traceId`와 오류 코드를 저장한다.

상태:
- 2026-04-20 완료.
- `POST /v1/oauth2/token`, `type=SELF` 호출 결과 200.
- `expires_in=10799` 수준의 Bearer 토큰 발급 확인.
- access token과 전자서명은 출력/저장하지 않았다.

### 2단계: 읽기 전용 주문 조회

목표:
- 최근 24시간 또는 특정 날짜의 변경 상품 주문 내역을 읽는다.
- 쓰기 API는 호출하지 않는다.
- 발주 확인, 발송 처리, 취소 승인 같은 상태 변경 API는 사용하지 않는다.

성공 기준:
- 상품 주문 번호 목록을 받을 수 있다.
- 상세 조회에서 주문일, 결제일, 주문 상태, 결제 금액, 취소/반품 상태를 확인한다.

상태:
- 2026-04-20 완료.
- `GET /v1/pay-order/seller/product-orders/last-changed-statuses` 호출 결과 200.
- `POST /v1/pay-order/seller/product-orders/query` 호출 결과 200.
- 샘플 5건에서 `orderId`, `productOrderId`, `productOrderStatus`, `paymentDate`, `productName`, `totalPaymentAmount`, `deliveryFeeAmount` 확인.
- 응답에 수취인/연락처가 포함될 수 있으므로 로그와 문서에는 비식별 필드만 남긴다.

확인된 샘플 상태:

| 구분 | 값 |
|---|---:|
| 토큰 발급 | 200 |
| 주문 변경 조회 | 200 |
| 상품 주문 상세 조회 | 200 |
| 조회 기간 | 2026-04-19 00:00~2026-04-20 00:00 KST |
| 변경 조회 샘플 수 | 5 |
| 상세 조회 샘플 수 | 5 |
| 확인된 상태 예시 | `PAYED`, `PURCHASE_DECIDED` |
| 확인된 금액 필드 | `totalPaymentAmount`, `deliveryFeeAmount` |

### 3단계: GA4 Naver Pay 대사

목표:
- GA4 BigQuery `transaction_id`가 `NPAY - ...`인 주문을 네이버 주문 원장과 연결한다.
- 2026-04-12~2026-04-17 기준 GA4에는 Naver Pay 65건, gross 2,630,700원이 있다.
- 이 65건이 네이버 커머스API 주문 원장과 맞는지 본다.

현재 상태:
- GA4 NPAY 분모는 확정됐다.
- 현재 바이오컴 API 키로는 네이버 주문 API가 열리지만, 조회 원장은 바이오컴 스토어다.
- 더클린커피 주문번호 샘플은 처리권한 없음으로 막힌다.
- 따라서 이 단계는 더클린커피 통합매니저/API 앱 권한 확보 전까지 blocked다.

성공 기준:
- GA4 Naver Pay transaction 65건 중 몇 건이 네이버 주문으로 매칭되는지 계산한다.
- matched gross, canceled, returned, net 후보를 분리한다.
- Toss 대사와 같은 형식으로 `GA4 gross`, `Naver confirmed gross`, `Naver net`을 표준화한다.

### 4단계: `/ads` 또는 데이터 진단 화면 연결

목표:
- Toss, PlayAuto, GA4 BigQuery에 이어 Naver Commerce API 최신성도 source freshness에 추가한다.

표시 후보:
- 마지막 주문 변경 조회 시각
- 마지막 네이버 주문 결제일
- 마지막 정산 데이터 기준일
- API rate limit remaining
- 최근 오류 trace id

## 보안 기준

반드시 지킬 것:
- `.env`의 앱 시크릿은 문서와 로그에 남기지 않는다.
- access token은 메모리 또는 서버 캐시에만 둔다.
- 토큰 캐시 키는 `type + account_id` 기준으로 분리한다.
- `GNCP-GW-Trace-ID`는 저장해도 되지만 access token과 signature는 저장하지 않는다.
- 쓰기 API는 별도 승인 전까지 구현하지 않는다.

쓰기 API 예:
- 발주 확인
- 발송 처리
- 교환/반품/취소 처리
- 상품 등록/수정/삭제

현재 단계에서는 모두 금지한다.

## 현재 결론

네이버 커머스API는 더클린커피/바이오컴의 Naver Pay 원장 대사를 닫는 데 필요한 공식 경로다.

현재 앱 ID와 시크릿은 정상 동작한다.
`SELF` 토큰으로 바이오컴 주문 변경/상세 조회가 가능하다는 것도 확인했다.

다만 현재 앱 ID와 시크릿의 채널 범위는 바이오컴 스토어 1개다.
바이오컴 API로 더클린커피 스토어 주문 원장에 접근하는 방법은 현재 API 응답과 공식 권한 구조 기준으로 없다.

바로 할 일은 더클린커피 통합매니저 권한을 확보하고, 더클린커피용 `내스토어 애플리케이션`을 만드는 것이다.
그 다음 GA4 `NPAY - ...` 65건을 네이버 주문 원장과 붙이면, Toss 대사에서 남은 큰 차이를 설명할 수 있다.

## 공식 문서 출처

- 커머스API 소개: https://apicenter.commerce.naver.com/docs/introduction
- RESTful API: https://apicenter.commerce.naver.com/docs/restful-api
- 인증: https://apicenter.commerce.naver.com/docs/auth
- OAuth 2.0 / 토큰 발급: https://apicenter.commerce.naver.com/docs/commerce-api/current/o-auth-2-0
- 제약 사항: https://apicenter.commerce.naver.com/docs/restriction
- 문제 해결: https://apicenter.commerce.naver.com/docs/trouble-shooting
- 주문 API 목록: https://apicenter.commerce.naver.com/docs/commerce-api/current/%EA%B5%90%ED%99%98
- 매니저 초대 기능 안내: https://apicenter.commerce.naver.com/docs/solution-doc/6000/%EB%A7%A4%EB%8B%88%EC%A0%80%EC%B4%88%EB%8C%80-%EA%B8%B0%EB%8A%A5-%EC%95%88%EB%82%B4
- 기본 연동 요소 가이드: https://apicenter.commerce.naver.com/docs/solution-doc/3000/%EA%B8%B0%EB%B3%B8-%EC%97%B0%EB%8F%99-%EC%9A%94%EC%86%8C-%EA%B0%80%EC%9D%B4%EB%93%9C
- 판매자 커머스 아이디 인증: https://apicenter.commerce.naver.com/docs/solution-doc/3000/%ED%8C%90%EB%A7%A4%EC%9E%90-%EC%BB%A4%EB%A8%B8%EC%8A%A4-%EC%95%84%EC%9D%B4%EB%94%94-%EC%9D%B8%EC%A6%9D
- 스마트스토어 통합매니저 위임 FAQ: https://help.sell.smartstore.naver.com/faq/content.help?faqId=12468
