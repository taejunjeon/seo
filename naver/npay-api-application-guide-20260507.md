# 네이버페이 API 발급 가이드

작성 시각: 2026-05-07 13:05 KST
최종 업데이트: 2026-05-07 13:42 KST
상태: active guide
Owner: naver / npay / attribution
Supersedes: none
Next document: [[npay-api-mcp-review-20260501]] 업데이트 또는 네이버 기술지원 답변 기록
Do not use for: 운영 API 호출 승인, credential 발급 승인, 주문 취소/반품/발송 처리 승인, GA4/Meta/Google Ads/TikTok/Naver 전송 승인

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - naver/!npay.md
    - naver/!npayroas.md
    - naver/npay-api-mcp-review-20260501.md
    - data/coffee-npay-historical-matching-closure-20260507.md
  lane: Green documentation + sandbox read-only status check
  allowed_actions:
    - 공식 문서 확인
    - API 계열 구분
    - 발급 절차 정리
    - 문의 문구 작성
    - 결제형 sandbox read-only 결제내역 조회 smoke
  forbidden_actions:
    - 주문형/커머스/운영 production API 호출
    - sandbox write API 호출
    - credential 원문 기록
    - 운영 주문 write
    - 발주/발송/취소/반품 API 호출
    - GA4/Meta/Google Ads/TikTok/Naver 전송
  source_window_freshness_confidence:
    source: "네이버페이 주문형 GitHub README + 네이버 커머스API GitHub README + 기존 로컬 NPay 문서"
    window: "2026-05-07 KST"
    freshness: "official docs checked 2026-05-07"
    confidence: 0.9
```

## 10초 결론

TJ님이 지금 확인해야 할 API는 **네이버페이 주문형 가맹점 API의 주문관리/정산 API**다.

우리 목적은 `NPay 버튼 클릭`이 아니라 `실제 NPay 결제완료 주문`을 공식 원장으로 cross-check하는 것이다. 그러므로 1순위는 주문형 가맹점 API에서 주문 조회와 정산 조회 권한이 열리는지 확인하는 것이다.

다만 중요한 제한이 있다. 네이버페이 주문형 공식 README는 **제휴 호스팅사를 통해 입점한 주문형 가맹점과 예약 가맹점은 주문관리/정산 API 연동이 불가**하다고 안내한다. 바이오컴/더클린커피는 아임웹 기반이므로, 먼저 네이버 기술지원에 “아임웹 사용 가맹점도 주문관리/정산 API를 별도 발급받을 수 있는지”를 확인해야 한다.

2026-05-07 현재 로컬 판별 테스트 결론은 아래다.

| 질문 | 현재 답 |
|---|---|
| 더클린커피 샌드박스 키가 `.env`에 있나 | YES. `backend/.env`에 `npay_coffee_store_id`, `npay_coffee_clientid`, `npay_coffee_clientsecret`, `npay_coffee_chainid`가 있다. 값은 문서화하지 않는다 |
| 이 키로 API 호출이 되나 | YES. 결제형 개발 API `list/history` read-only 호출은 `200 / Success / totalCount=0` |
| 이것이 주문형 주문관리 API 연동 완료인가 | NO. 이 키는 `X-Naver-Client-Id`, `X-Naver-Client-Secret`, `X-NaverPay-Chain-Id` 헤더를 쓰는 **결제형 개발 API** 계열이다 |
| 주문형 문서/API credential로 보이나 | NO. 주문형 문서 인증용 signature 생성에서 `Invalid salt version`이 발생했다. 주문형 app secret 형식으로 보기 어렵다 |
| 주문형 `mall` API OAuth 토큰 발급이 구현됐나 | 아직 NO. `sandbox-api.pay.naver.com/npay/partner`의 주문형 OAuth token 발급과 주문관리 API 호출 성공 증거는 없다 |
| Sandbox 검수 요청 준비가 됐나 | 아직 NO. 검수 요청은 주문형 OAuth 토큰 발급, 주문관리 조회 API, 정산 조회 API smoke가 끝난 뒤 가능하다 |

## 우리가 필요한 API

| 우선순위 | API | 용도 | 우리 목적 적합도 | 발급 판단 |
|---:|---|---|---|---|
| 1 | 네이버페이 주문형 가맹점 API - 주문관리 API | NPay 주문 조회, 상품 주문 상세 조회 | 매우 높음 | 아임웹/호스팅사 제한 확인 필요 |
| 2 | 네이버페이 주문형 가맹점 API - 정산 API | 정산/수수료/부가세 대사 | 높음 | 주문관리 API와 같이 확인 |
| 3 | 네이버페이 결제형 Payment API | 직접 결제형 구현, 결제 예약/승인/결제내역 조회 | 중간 | 현재 주문형 원장 확인에는 직접 정답이 아닐 수 있음 |
| 4 | 네이버 커머스API | 스마트스토어/커머스 주문·상품·정산 | 낮음~중간 | 스마트스토어 계정이면 유용, 아임웹 주문형과는 별도 |
| 5 | 네이버페이 MCP | 문서 검색·개발 보조 | 낮음 | 운영 주문 원장 API가 아님 |

## API별 쉬운 설명

### 1. 주문형 가맹점 API

주문형은 상품 상세페이지에 네이버페이 구매 버튼이 있는 방식이다. 고객이 우리 사이트 주문서를 거치지 않고 네이버페이 주문 흐름으로 들어간다.

주문형 가맹점 API 안에는 세 갈래가 있다.

| API | 무엇을 하나 | 우리가 쓸 범위 |
|---|---|---|
| 주문등록 API | 네이버페이 구매하기 버튼과 주문서를 직접 연동 | 현재 아임웹 내장 버튼을 쓰므로 1순위 아님 |
| 주문관리 API | NPay 주문 조회/처리 | **read-only 주문 조회만 필요** |
| 정산 API | 정산/수수료/부가세 조회 | read-only 대사에 유용 |

우리에게 필요한 주문관리 API endpoint는 조회성 API다.

| 목적 | Method | Path | 사용 이유 |
|---|---|---|---|
| 변경 상품 주문 내역 조회 | GET | `/v1/pay-order/mall/product-orders/last-changed-statuses` | 최근 변경된 NPay 주문 수집 |
| 상품 주문 상세 내역 조회 | POST | `/v1/pay-order/mall/product-orders/query` | 주문별 상품/금액/상태 상세 확인 |
| 상품 주문 번호 목록 조회 | GET | `/v1/pay-order/mall/orders/{orderId}/product-order-ids` | 주문 ID에서 상품 주문 번호 목록 확인 |
| 조건형 상품 주문 상세 조회 | GET | `/v1/pay-order/mall/product-orders` | 조건 기반 주문 상세 조회 |

정산 API에서 필요한 endpoint는 아래다.

| 목적 | Method | Path | 사용 이유 |
|---|---|---|---|
| 건별 정산 내역 조회 | GET | `/v1/pay-settle-mall/settle/case` | 주문/정산 대사 |
| 일별 정산 내역 조회 | GET | `/v1/pay-settle-mall/settle/daily` | 월별 매출 정산 |
| 수수료 상세 조회 | GET | `/v1/pay-settle-mall/settle/commission-details` | 수수료·net revenue 보정 |

금지할 API도 명확하다. ROAS 정합성 목적에서는 발주 확인, 발송, 발송 지연, 취소 요청, 취소 승인, 반품, 교환 처리 API는 호출하지 않는다.

### 2. 결제형 Payment API

결제형은 일반 PG처럼 우리 사이트 주문서 안에서 결제수단으로 네이버페이를 선택하는 구조다.

이 API는 직접 결제형을 구현하거나 결제형으로 전환할 때 의미가 크다. 기존 로컬 문서 기준 더클린커피 `.env`에는 결제형 sandbox 키가 있고, 개발 결제내역 조회 API는 `Success` 응답을 받은 적이 있다. 그러나 이 키는 **운영 주문형 NPay 주문 원장을 조회하는 키라고 보면 안 된다**.

결제형 API의 일반 인증 헤더는 아래 계열이다.

```text
X-Naver-Client-Id
X-Naver-Client-Secret
X-NaverPay-Chain-Id
```

판단:

```text
직접 결제형 구현 또는 결제형 전환 검토에는 필요.
아임웹 주문형으로 이미 발생한 NPay actual order 확인에는 주문형 가맹점 API가 더 직접적.
```

### 3. 네이버 커머스API

네이버 커머스API는 스마트스토어/커머스 계정의 상품, 주문, 정산 등 운영 API다. 공식 기술지원 GitHub와 API 센터가 따로 있다.

우리 목적이 스마트스토어 주문 대사라면 커머스API가 맞다. 하지만 현재 문제는 아임웹 사이트에 붙은 네이버페이 주문형 버튼과 실제 NPay 결제완료 주문을 맞추는 것이다. 따라서 커머스API가 바로 정답이라고 보면 안 된다.

### 4. MCP

MCP는 네이버페이 API 문서를 AI가 검색하거나 읽기 쉽게 해주는 개발 보조 도구다.

MCP는 운영 주문을 조회하는 API가 아니다. 즉 `MCP를 붙이면 NPay actual order가 해결된다`가 아니다.

## 발급 절차: 주문형 가맹점 API

공식 주문형 가맹점 API 기준 절차는 아래다.

### Step 0. 호스팅사 제한 먼저 확인

바이오컴/더클린커피는 아임웹 기반이므로 가장 먼저 이 질문을 닫아야 한다.

```text
아임웹 같은 제휴 호스팅사를 통해 입점한 주문형 가맹점도 주문관리 API와 정산 API를 별도 연동할 수 있나요?
```

공식 README에는 제휴 호스팅사 통해 입점한 주문형 가맹점은 주문관리/정산 API 연동이 불가하다고 안내되어 있다. 따라서 네이버 기술지원 답변이 필요하다.

문의 경로:

| 경로 | 용도 |
|---|---|
| GitHub Q&A | 공개 질의. 비밀 정보 금지 |
| `dl_techsupport@navercorp.com` | 가맹점 ID, 담당자, IP 등 비공개 정보 전달 가능 |
| 네이버페이센터 `API 관리` | sandbox 애플리케이션 발급 메뉴 |

### Step 1. Sandbox 애플리케이션 발급

공식 안내 기준으로 sandbox 애플리케이션은 네이버페이센터의 `API 관리` 메뉴에서 발급한다.

준비 정보:

| 항목 | 설명 |
|---|---|
| 페이센터ID / 가맹점 ID | 네이버페이센터 > 내정보 > 가입정보변경 > 페이센터ID 경로에서 확인 |
| 개발 담당자 이메일 | 기술지원/검수 회신 받을 이메일 |
| API 호출 IP | 운영 VM 또는 API 호출 서버의 고정 outbound IP |
| 사용 목적 | 주문 조회/정산 조회 read-only 대사 |
| 필요한 API | 주문관리 조회 API, 정산 조회 API |

주의:

```text
client_secret, access token, 구매자 주문정보, 개인정보는 GitHub Q&A에 올리지 않는다.
비공개 정보는 메일 또는 네이버페이센터/기술지원 비공개 경로로만 전달한다.
```

### Step 2. Sandbox OAuth 토큰 발급 구현

주문형 API는 OAuth 2.0 bearer token을 쓴다. 공식 README는 토큰 발급 시 `client_secret`을 직접 전달하지 않고 전자서명(signature)을 생성해 전달한다고 설명한다.

호출 흐름:

```text
1. client id/secret 기반 전자서명 생성
2. OAuth token endpoint 호출
3. access_token 수신
4. API 호출 시 Authorization header 사용
```

Header:

```text
Authorization: Bearer {access_token}
```

Codex가 할 수 있는 일:

- secret을 출력하지 않는 token probe 스크립트 작성
- 조회성 endpoint 1~2개 read-only smoke 설계
- 응답 `code/status/count`만 로그로 남기는 안전한 검증 설계

Codex가 하면 안 되는 일:

- credential 원문 문서화
- write성 주문 처리 API 호출
- 운영 주문 상태 변경

### 현재 구현 상태 점검

2026-05-07 KST 기준으로 로컬과 기존 문서를 점검했다.

| 항목 | 상태 | 근거 | 판단 |
|---|---|---|---|
| 더클린커피 결제형 sandbox credential 존재 | 완료 | `backend/.env`에 `npay_coffee_*` 4개 변수 present | 결제형 개발 API 테스트에는 사용 가능 |
| 더클린커피 결제형 개발 API 호출 | 완료 | 2026-05-07 `dev-pay.paygate.naver.com/.../payments/v2.2/list/history` read-only POST 결과 `200 / Success / totalCount=0` | 결제형 sandbox 키는 유효해 보임 |
| 주문형 OAuth token 발급 구현 | 미완료 | 주문형 API는 OAuth bearer token + 전자서명 방식인데, 현재 검증된 것은 결제형 header 방식 | 검수 요청 전 필수 구현 필요 |
| 주문형 주문관리 API 조회 | 미완료 | `/v1/pay-order/mall/product-orders/last-changed-statuses`, `/query` 호출 성공 증거 없음 | 검수 요청 전 필수 구현 필요 |
| 주문형 정산 API 조회 | 미완료 | `/v1/pay-settle-mall/settle/*` 호출 성공 증거 없음 | 검수 요청 전 필수 또는 최소 smoke 필요 |
| 네이버 커머스API 주문 조회 | 부분 완료 | `BIOCOM_STORE_APP_ID/SECRET` 기반 바이오컴 스토어 주문 조회는 과거 200 확인. 더클린커피 주문은 권한 없음 | 주문형 NPay 검수와는 별개 |
| 현재 재실행성 | 부분 미흡 | `backend/scripts/reconcile-coffee-ga4-naverpay.py`는 현재 셸 Python에 `bcrypt`, `dotenv`, `googleapiclient`가 없어 재실행 실패 | 의존성 정리 필요 |

### 결제형 vs 주문형 판별 테스트

2026-05-07 KST에 현재 `.env` 키를 실제 호출/문서 인증 방식으로 판별했다. secret과 token 원문은 출력하지 않았다.

| 테스트 | 사용 키 | 호출/검증 방식 | 결과 | 해석 |
|---|---|---|---|---|
| 결제형 sandbox 결제내역 조회 | `npay_coffee_store_id`, `npay_coffee_clientid`, `npay_coffee_clientsecret`, `npay_coffee_chainid` | `POST https://dev-pay.paygate.naver.com/{store_id}/naverpay/payments/v2.2/list/history` | `HTTP 200`, `code=Success`, `totalCount=0` | 결제형 Payment API sandbox credential로는 유효 |
| 주문형 sandbox 문서/API 인증 signature 생성 | `npay_coffee_clientid`, `npay_coffee_clientsecret` | 주문형 문서의 `applicationId_timestamp` bcrypt signature 생성 방식 | `Invalid salt version: ft` | 주문형 application secret 형식이 아님. 주문형 API credential로 보기 어렵다 |
| 주문형 sandbox 문서 인증 | `BIOCOM_STORE_APP_ID`, `BIOCOM_STORE_APP_SECRET` | 주문형 문서 인증 endpoint에 signature 전달 | `401 / INVALID_COOKIE / 요청 권한 없음` | 커머스API/스토어 credential은 주문형 sandbox 문서 권한으로 확인되지 않음 |

판정:

```text
현재 더클린커피 `npay_coffee_*` 키는 결제형 Payment API sandbox 키다.
현재 키만으로 주문형 주문관리/정산 API 검수 요청을 하면 안 된다.
주문형 API 검수 요청을 하려면 네이버페이센터 API 관리에서 주문형 sandbox application ID/secret을 별도로 확인해야 한다.
```

해석:

```text
결제형 sandbox API 호출 개발은 일부 되어 있다.
하지만 주문형 가맹점 API의 Sandbox 연동 개발은 아직 완료되지 않았다.
따라서 GitHub Inspection Request에 검수 요청할 단계가 아니다.
```

검수 요청 가능 상태로 만들려면 아래가 필요하다.

| 순서 | 작업 | 성공 기준 |
|---:|---|---|
| 1 | 주문형 sandbox credential 확보 여부 확인 | 네이버페이센터 API 관리에서 주문형 앱 client id/secret 확인 |
| 2 | 주문형 OAuth token probe 작성 | token endpoint 200, token 원문 로그 미노출 |
| 3 | 주문관리 조회 smoke | 최근 변경 상품 주문 조회 또는 빈 결과 정상 응답 |
| 4 | 상품 주문 상세 smoke | sample productOrderId가 있으면 상세 조회 200 |
| 5 | 정산 조회 smoke | 빈 결과라도 정상 응답 |
| 6 | 검수 요청서 작성 | 공개 부적합 정보 제거, 테스트 결과와 API 범위만 기재 |

### Step 3. Sandbox 검수 요청

Sandbox 연동이 완료되면 GitHub Discussions의 검수 요청 또는 기술지원 경로로 검수를 요청한다.

검수 요청 링크:

```text
https://github.com/npay-mall-order-api/merchant-order-api/discussions/categories/inspection-request
```

2026-05-07 확인 결과:

| 항목 | 확인 내용 |
|---|---|
| 카테고리 이름 | `✅ Inspection Request` |
| 용도 | 개발 환경에서 개발이 완료되었을 경우 검수 요청 |
| 접근 | GitHub 로그인 필요. 현재 브라우징 기준 글 작성은 불가 |
| 공개성 | 공개 Discussion이므로 민감정보 금지 |
| 고정 안내 | FAQ, 문의 내용 민감정보 포함 주의 |
| 현재 카테고리 상태 | 공개 목록 기준 matching discussion 없음 |

검수 요청에 넣어도 되는 것:

- 가맹점명 또는 비식별 가맹점 구분
- 사용 API 범위
- sandbox 연동 완료 여부
- token 발급 성공 여부
- 주문관리/정산 조회 API별 HTTP status와 정상 응답 여부
- write API를 호출하지 않았다는 설명
- 오류가 있으면 secret 없는 trace id, error code, 재현 단계

검수 요청에 넣으면 안 되는 것:

- `client_secret`
- access token
- 전자서명 원문
- 구매자 이름, 전화번호, 주소, 이메일
- sample 주문 원문 payload
- 운영 주문번호 전체 목록
- 내부 `.env` 캡처

검수 요청 전 체크:

| 체크 | 기준 |
|---|---|
| OAuth token 발급 | 성공 |
| 주문 조회 API | sample 주문 1건 read 성공 |
| 정산 조회 API | sample 또는 빈 결과라도 정상 응답 |
| write성 API | 호출하지 않음 |
| 로그 | secret/token/개인정보 미노출 |

### Step 4. Production 애플리케이션 발급

공식 README 기준, sandbox 검수가 완료되면 production 애플리케이션 발급을 요청할 수 있다.

메일에 필요한 정보:

```text
가맹점 ID: np_xxxxxx
개발 담당자 이메일:
API 호출 IP:
```

발급 요청은 `dl_techsupport@navercorp.com` 경로가 안내되어 있다.

### Step 5. Production read-only 적용

Production endpoint:

```text
https://api.pay.naver.com/npay/partner
```

처음 열어야 할 것은 조회성 smoke다.

| 순서 | 확인 | 기준 |
|---:|---|---|
| 1 | OAuth token 발급 | 성공, token 원문 로그 금지 |
| 2 | 최근 변경 주문 조회 | 200/정상 응답 |
| 3 | 특정 주문 상세 조회 | sample order 1건 read |
| 4 | 정산 조회 | 빈 결과라도 정상 응답 |
| 5 | Imweb actual order와 대조 | `channel_order_no` 또는 NPay order key 일치 여부 |

## TJ님이 지금 준비할 자료

| 자료 | 왜 필요한가 | 어디서 확인 |
|---|---|---|
| 네이버페이 페이센터ID / 가맹점 ID | API 권한 문의와 production 발급에 필요 | 네이버페이센터 > 내정보 > 가입정보변경 > 페이센터ID |
| 아임웹 사용 여부 | 호스팅사 제한 판단에 필요 | 현재 쇼핑몰 운영 구조 |
| 대상 사이트 | biocom.kr / thecleancoffee.com 구분 | 내부 |
| 개발 담당자 이메일 | 검수/기술지원 회신용 | 내부 |
| API 호출 IP | production 발급 요청에 필요 | 운영 VM outbound IP |
| 원하는 API 범위 | 주문관리 조회, 정산 조회 read-only | 이 문서 |
| sample NPay 주문번호 | read-only smoke에 필요 | Imweb `channel_order_no` 1~3건 |

## 네이버에 보낼 문의 문구

```text
안녕하세요.

당사는 아임웹을 통해 네이버페이 주문형 버튼을 사용 중인 가맹점입니다.
GA4/광고 전환 정합성과 주문/정산 대사를 위해 네이버페이 주문형 주문관리 API 및 정산 API의 read-only 연동 가능 여부를 확인하고 싶습니다.

확인 요청:

1. 아임웹 등 제휴 호스팅사를 통해 입점한 주문형 가맹점도 주문관리 API와 정산 API를 별도 연동할 수 있나요?
2. 가능하다면 sandbox 애플리케이션 발급, 검수, production 애플리케이션 발급 절차는 무엇인가요?
3. 불가능하다면 아임웹 주문형 네이버페이 주문 원장과 정산 대사를 위한 공식 대체 경로가 있나요?
4. 현재 보유한 결제형 sandbox client id / chain id와 주문형 주문관리 API credential은 별도인가요?
5. read-only 주문 조회와 정산 조회만 사용할 경우 필요한 API 호출 IP, 검수 범위, 제출 자료는 무엇인가요?

필요 API:

- 변경 상품 주문 내역 조회
- 상품 주문 상세 내역 조회
- 상품 주문 번호 목록 조회
- 일별/건별 정산 내역 조회
- 수수료 상세 내역 조회

비공개 채널에서 가맹점 ID, 개발 담당자 이메일, API 호출 IP, sample 주문번호를 전달드리겠습니다.

감사합니다.
```

## Codex 추천

추천은 아래 순서다.

1. 주문형 가맹점 API 가능 여부를 네이버 기술지원에 먼저 문의한다.
2. 가능하다는 답변을 받으면 sandbox 애플리케이션을 발급한다.
3. Codex가 secret 미출력 read-only token/order probe를 만든다.
4. sample 주문 1건이 조회되면 Imweb actual order와 비교한다.
5. production은 sandbox 검수 완료 후 별도 승인으로 진행한다.

네이버 API는 Coffee Phase2 종결 blocker가 아니다. Coffee 과거분은 synthetic transaction_id 한계 때문에 자동 복구 전송 없이 닫는 것이 맞고, 네이버 API는 향후 cross-check 품질을 높이는 선택 보강으로 둔다.

## 금지선

- GitHub Q&A에 `client_secret`, access token, sample 주문 원문, 구매자 정보 게시 금지
- production credential을 문서나 커밋에 기록 금지
- 주문관리 API write성 기능 호출 금지
- 발주/발송/취소/반품/교환 API 호출 금지
- 네이버 API 결과만으로 GA4/Meta/Google/TikTok purchase 전송 금지
- 운영 DB/ledger write 금지

## Codex가 다음에 할 수 있는 일

| 순서 | 작업 | 의존성 | 승인 필요 |
|---:|---|---|---|
| 1 | secret 미출력 sandbox token/order probe 설계 | sandbox credential이 실제로 준비되어 있어야 함 | NO, 문서/로컬 probe 설계 |
| 2 | sample NPay order read-only 대조 스크립트 초안 | 주문형 API 권한 필요 | NO, 호출 전까지 |
| 3 | 네이버 기술지원 답변 반영 | TJ님이 답변 공유 필요 | NO |
| 4 | production 발급 승인안 작성 | sandbox 검수 PASS 필요 | YES, credential/운영 API |

## 참고 공식 문서

- 네이버페이 주문형 가맹점 API GitHub: https://github.com/npay-mall-order-api/merchant-order-api
- 네이버페이 주문형 가맹점 API README raw: https://raw.githubusercontent.com/npay-mall-order-api/merchant-order-api/main/README.md
- 네이버 커머스API 기술지원 GitHub: https://github.com/commerce-api-naver/commerce-api
- 네이버 커머스API 센터: https://apicenter.commerce.naver.com/ko/basic/commerce-api
- 네이버페이 개발자센터 공통 인증 문서: https://docs.pay.naver.com/en/docs/common/authentication/
- 네이버페이 개발자센터 URL 형식 문서: https://docs.pay.naver.com/en/docs/common/url-format/
- 네이버페이 결제내역 조회 문서: https://docs.pay.naver.com/docs/onetime-payment/additional/payments_history.md
- 네이버페이 MCP 문서: https://docs.pay.naver.com/en/docs/ai-solutions/mcp/

## Auditor verdict

```text
Auditor verdict: PASS_WITH_NOTES
Project: naver/npay
Lane: Green documentation

No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES

Notes:
- API 발급/credential 변경은 아직 수행하지 않음.
- 현재 1순위는 주문형 가맹점 API 가능 여부 문의.
- 아임웹/호스팅사 제한 가능성이 높으므로 기술지원 답변 필요.
```
