# 네이버 API 필요성 및 현재 blocker 정리

작성 시각: 2026-05-07 22:51 KST
기준일: 2026-05-07
상태: active status memo
Owner: naver / npay / attribution
관련 문서: [[!npayroas|네이버페이 ROAS 정합성 회복 계획]], [[npay-api-application-guide-20260507|네이버페이 API 발급 가이드]], [[npay-api-mcp-review-20260501|네이버페이 API와 MCP 검토]], [[../data/!coffeedata|더클린커피 데이터 정합성 현재 정본]]
Do not use for: 네이버 운영 API 호출 승인, credential 발급 승인, 주문 발주/발송/취소/반품 처리, GA4/Meta/Google Ads/TikTok/Naver 실제 전송 승인

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
    - harness/npay-recovery/APPROVAL_GATES.md
    - harness/npay-recovery/AUDITOR_CHECKLIST.md
    - data/!coffeedata.md
    - naver/!npayroas.md
    - naver/npay-api-application-guide-20260507.md
  lane: Green documentation + local env presence check
  allowed_actions:
    - 기존 정본 문서 읽기
    - 공식 GitHub 문서 확인
    - backend/.env credential presence 확인
    - blocker와 다음 액션 문서화
  forbidden_actions:
    - 네이버 production API 호출
    - 주문관리/정산 write성 API 호출
    - credential 원문 문서화
    - 운영 DB/ledger write
    - GA4/Meta/Google Ads/TikTok/Naver 실제 전송
    - GTM publish 또는 backend deploy
  source_window_freshness_confidence:
    source: "data/!coffeedata.md, naver/!npayroas.md, naver/npay-api-application-guide-20260507.md, backend/.env presence check, 네이버페이 주문형 가맹점 API GitHub README"
    window: "2026-04-23~2026-05-07 KST 문서 기준 + 2026-05-07 22:51 KST 로컬 env presence"
    freshness: "공식 GitHub README 2026-05-07 조회, 로컬 env 2026-05-07 22:51 KST 확인"
    confidence: 0.9
```

## 10초 결론

네이버 API는 `NPay 버튼 클릭`을 구매로 세기 위해 필요한 것이 아니다.

필요한 이유는 `실제 NPay 결제완료 주문`과 `NPay 주문번호/정산 상태`를 공식 원장으로 한 번 더 확인하기 위해서다. 특히 더클린커피는 과거 GA4 `NPAY - ...` synthetic transaction_id 한계 때문에 자동 복구 전송은 닫혔고, 앞으로는 NPay actual order를 공식 주문/정산 원장으로 cross-check할 수 있으면 정합성 신뢰가 올라간다.

현재 막힌 지점은 두 가지다. 첫째, `backend/.env` 276~277행에 운영 가맹점 ID와 체인 ID는 들어왔지만, 네이버페이 주문형 주문관리 API가 요구하는 sandbox/production 애플리케이션 ID와 시크릿, OAuth 토큰 발급 성공 증거가 아직 없다. 둘째, 네이버 공식 주문형 GitHub README에는 제휴 호스팅사를 통해 입점한 주문형 가맹점은 주문관리/정산 API 연동이 불가하다고 안내되어 있어, 아임웹 기반 사이트는 기술지원 확인이 먼저 필요하다.

## 왜 필요한가

### 1. NPay 클릭과 실제 결제완료를 분리하기 위해

`NPay click`은 결제 시작 또는 결제 의도다. 구매가 아니다.

`NPay actual confirmed order`는 실제 결제완료 주문이다. 광고 ROAS 정합성에서는 이 값만 내부 confirmed 매출 후보가 된다.

현재 [[!npayroas]]는 바이오컴에서 NPay intent와 운영 주문 원장을 붙이는 흐름을 갖고 있다. 하지만 NPay 외부 주문형은 Imweb 주문번호와 NPay `channel_order_no`가 다를 수 있다. 네이버 주문관리 API가 열리면 이 두 키의 관계와 주문 상태를 공식 원장으로 확인할 수 있다.

### 2. 더클린커피 과거 synthetic gap을 공식 원장으로 보강하기 위해

[[../data/!coffeedata]] 기준 더클린커피 과거 window에서는 아래 숫자가 이미 정리됐다.

| 항목 | 값 | 해석 |
|---|---:|---|
| 최근 7일 Imweb NPay actual order | 60건 / 2,462,300원 | Imweb API read-only 기준 실제 NPay 주문 |
| GA4 NPay형 purchase | 58건 / 2,359,300원 | synthetic transaction_id 기반 GA4 purchase |
| NPay actual vs GA4 NPay형 차이 | 2건 / 103,000원 | 과거분 자동 복구 금지 |
| unassigned actual 중 `needs_naver_api_crosscheck` | 1건 | 네이버 API가 있으면 추가 확인 가능 |
| Naver API 직접 효용 | 6/47, 약 13% | 과거 전체 문제의 본체는 아니고 보강 수단 |

따라서 네이버 API는 Coffee Phase2 종결 blocker가 아니다. 과거분은 이미 `자동 복구 전송 금지 + future intent/A-6 이관`으로 닫혔다. 네이버 API는 앞으로 공식 주문/정산 원장 cross-check 품질을 높이는 선택 보강이다.

### 3. 플랫폼 전환 전송 전에 중복과 오매칭을 줄이기 위해

GA4/Meta/Google Ads/TikTok에 구매 전환을 보내려면 아래가 분리되어야 한다.

| 단계 | 의미 | 네이버 API가 도와줄 수 있는 부분 |
|---|---|---|
| 클릭 | NPay 버튼 클릭 또는 결제 시작 | 직접 구매 증거 아님 |
| 결제 시작 | 네이버페이 주문 흐름 진입 | 직접 구매 증거 아님 |
| 결제 완료 | NPay actual confirmed order | 주문관리 API로 공식 상태 cross-check 가능 |
| 구매 확정/취소 반영 | 취소/반품/정산 반영 | 주문관리/정산 API로 net revenue rule 보강 가능 |

중요: 네이버 API 결과만으로 바로 GA4/Meta/Google Ads/TikTok purchase를 보내면 안 된다. 전송은 별도 Red Lane 승인 대상이다.

## 현재 어디에서 막혔나

### Blocker 1. 운영 가맹점 ID/체인 ID만으로는 주문형 주문관리 API를 호출할 수 없다

2026-05-07 22:51 KST 로컬 확인 결과 `backend/.env`에는 아래 운영 값이 존재한다. 원문 값은 문서화하지 않는다.

| 위치 | 변수 | 상태 | 해석 |
|---|---|---|---|
| `backend/.env:276` | `NAVER_API_OPERATION_SHOP_ID` | present | 운영 가맹점 또는 store 식별자로 보임 |
| `backend/.env:277` | `NAVER_API_OPERATION_CHAIN_ID` | present | 운영 chain id로 보임 |

이 두 값은 중요하지만 충분하지 않다.

네이버페이 주문형 주문관리/정산 API는 공식 README 기준 OAuth 2.0 bearer token을 쓴다. 토큰 발급에는 애플리케이션 ID/시크릿과 전자서명 생성이 필요하고, API 호출은 `Authorization: Bearer {access_token}` 헤더로 한다.

현재 확인된 `.env`에는 `NAVER_API_OPERATION_CLIENT_ID`, `NAVER_API_OPERATION_CLIENT_SECRET`, 주문형 sandbox/production application secret 같은 이름의 운영 주문형 credential이 없다. 따라서 지금은 token probe를 만들 수는 있어도 성공 호출까지는 갈 수 없다.

### Blocker 2. 아임웹/제휴 호스팅사 입점 제한 확인이 필요하다

네이버페이 주문형 가맹점 API 공식 GitHub README는 sandbox 애플리케이션 발급 안내 직후에 제휴 호스팅사를 통해 입점한 주문형 가맹점과 예약 가맹점은 주문관리/정산 API 연동이 불가하다고 안내한다.

바이오컴과 더클린커피는 아임웹 기반이다. 그러므로 네이버페이센터 `API 관리`에서 앱을 바로 만들 수 있더라도, 주문관리/정산 API 권한이 열리는지 먼저 기술지원 확인이 필요하다.

문의 경로:

- GitHub Q&A: https://github.com/npay-mall-order-api/merchant-order-api/discussions/categories/q-a
- 기술지원 메일: `dl_techsupport@navercorp.com`
- 네이버페이센터: https://admin.pay.naver.com

### Blocker 3. 기존 로컬 스크립트는 주문형 Mall API가 아니라 커머스API 계열을 보고 있다

`backend/scripts/reconcile-coffee-ga4-naverpay.py`는 `https://api.commerce.naver.com/external`을 base URL로 쓰고, `BIOCOM_STORE_APP_ID` / `BIOCOM_STORE_APP_SECRET`로 토큰을 발급하는 구조다.

이 스크립트는 네이버 커머스API 또는 seller 계열 probe로 볼 수 있다. 하지만 공식 주문형 가맹점 API README가 안내하는 주문관리 endpoint는 아래처럼 `mall` path다.

```text
GET  /v1/pay-order/mall/product-orders/last-changed-statuses
POST /v1/pay-order/mall/product-orders/query
GET  /v1/pay-order/mall/orders/{orderId}/product-order-ids
GET  /v1/pay-order/mall/product-orders
```

따라서 기존 스크립트를 그대로 `네이버페이 주문형 주문관리 API 연동 완료`라고 보면 안 된다. 주문형 API 권한이 확보되면 별도 read-only probe를 만들거나, 기존 스크립트의 provider를 분리해야 한다.

## 공식 연동 프로세스 요약

출처: 네이버페이 주문형 가맹점 API 공식 GitHub README

공식 URL:

- https://github.com/npay-mall-order-api/merchant-order-api
- https://raw.githubusercontent.com/npay-mall-order-api/merchant-order-api/main/README.md

### Step 0. Sandbox 환경 애플리케이션 발급

네이버페이센터의 `API 관리` 메뉴에서 sandbox 애플리케이션을 발급한다.

다만 아임웹 같은 제휴 호스팅사 기반 주문형 가맹점은 주문관리/정산 API 연동 가능 여부를 먼저 확인해야 한다.

### Step 1. Sandbox 환경에서 API 연동

OAuth 토큰을 발급한다. 주문형 API는 `client_secret`을 직접 보내는 방식이 아니라 전자서명(signature)을 만들어 token request body에 넣는 방식이다.

토큰을 받은 뒤 조회성 API를 `Authorization: Bearer {access_token}`으로 호출한다.

우리에게 필요한 read-only smoke는 아래다.

| 목적 | Method | Path | 호출 여부 |
|---|---|---|---|
| 변경 상품 주문 내역 조회 | GET | `/v1/pay-order/mall/product-orders/last-changed-statuses` | 아직 미실행 |
| 상품 주문 상세 내역 조회 | POST | `/v1/pay-order/mall/product-orders/query` | 아직 미실행 |
| 상품 주문 번호 목록 조회 | GET | `/v1/pay-order/mall/orders/{orderId}/product-order-ids` | 아직 미실행 |
| 조건형 상품 주문 상세 조회 | GET | `/v1/pay-order/mall/product-orders` | 아직 미실행 |
| 일별 정산 내역 조회 | GET | `/v1/pay-settle-mall/settle/daily` | 아직 미실행 |
| 건별 정산 내역 조회 | GET | `/v1/pay-settle-mall/settle/case` | 아직 미실행 |

### Step 2. Sandbox 검수 요청

Sandbox 연동 개발이 끝난 뒤 GitHub Discussions의 `Inspection Request` 카테고리 또는 기술지원 경로로 검수를 요청한다.

공개 Discussion에 올리면 안 되는 것:

- client secret
- access token
- 전자서명 원문
- 구매자 이름, 전화번호, 주소, 이메일
- sample 주문 원문 payload
- 내부 `.env` 캡처

### Step 3. Production 애플리케이션 발급

Sandbox 검수 완료 후 production 애플리케이션 발급을 요청한다. 공식 README 기준 필요한 정보는 가맹점 ID, 개발 담당자 이메일, API 호출 IP다.

### Step 4. Production 적용

Production host는 아래다.

```text
https://api.pay.naver.com/npay/partner
```

우리 기준 첫 적용은 주문 처리 write가 아니라 read-only 주문 조회와 정산 조회 smoke다.

## 현재 권장 판단

| 질문 | 답 | 자신감 |
|---|---|---:|
| 네이버 API가 필요한가 | YES. 단, purchase 전송용이 아니라 주문/정산 공식 원장 cross-check용 | 90% |
| Coffee Phase2를 다시 열어야 하나 | NO. 과거분 자동 복구 전송 금지 판단은 유지 | 92% |
| 지금 `.env` 276~277행 값으로 바로 주문형 API 조회가 가능한가 | NO. OAuth application credential과 기술지원 가능 여부 확인이 먼저 | 88% |
| production API를 지금 호출해도 되나 | NO. 운영 외부 API 호출은 credential/권한/범위가 확인된 뒤 read-only 승인안으로 분리 | 90% |
| 다음 1순위는 무엇인가 | 아임웹 가맹점의 주문관리/정산 API 사용 가능 여부를 네이버 기술지원에 확인 | 91% |

## TJ님 문의 문구 초안

```text
안녕하세요.

당사는 아임웹을 통해 네이버페이 주문형 버튼을 사용 중인 가맹점입니다.
GA4/광고 ROAS 정합성과 주문/정산 대사를 위해 네이버페이 주문형 주문관리 API 및 정산 API의 read-only 연동 가능 여부를 확인하고 싶습니다.

확인 요청:

1. 아임웹 등 제휴 호스팅사를 통해 입점한 주문형 가맹점도 주문관리 API와 정산 API를 별도 연동할 수 있나요?
2. 가능하다면 sandbox 애플리케이션 발급, 검수, production 애플리케이션 발급 절차는 무엇인가요?
3. 불가능하다면 아임웹 주문형 네이버페이 주문 원장과 정산 대사를 위한 공식 대체 경로가 있나요?
4. 운영 가맹점 ID와 chain id는 보유 중입니다. 주문형 주문관리 API의 OAuth 애플리케이션 ID/시크릿은 별도 발급이 필요한가요?
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

## Codex 다음 작업 후보

| 순서 | 작업 | Lane | 의존성 | 승인 필요 |
|---:|---|---|---|---|
| 1 | secret 미출력 주문형 OAuth token probe 설계 | Green | 주문형 application ID/secret 확보 전에는 설계까지만 가능 | NO |
| 2 | 주문형 Mall API read-only probe 스크립트 초안 | Green | 네이버 기술지원 가능 답변 또는 sandbox credential 필요 | NO, 호출 전까지 |
| 3 | 기존 `reconcile-coffee-ga4-naverpay.py`를 `commerce_api`와 `npay_mall_api` provider로 분리하는 설계 | Green | 독립 진행 가능 | NO |
| 4 | production read-only 적용 승인안 작성 | Yellow/Red 후보 | sandbox 검수 PASS와 production credential 필요 | YES |

## 금지선

- 네이버 production API 호출 금지
- 주문관리/정산 write성 API 호출 금지
- 발주/발송/취소/반품/교환 API 호출 금지
- `.env` 원문값 문서화 또는 커밋 금지
- 네이버 API 결과만으로 GA4/Meta/Google Ads/TikTok purchase 전송 금지
- 운영 DB/ledger write 금지

## Source / Window / Freshness / Confidence

| 항목 | 값 |
|---|---|
| source | `data/!coffeedata.md`, `naver/!npayroas.md`, `naver/npay-api-application-guide-20260507.md`, `backend/.env` presence check, 네이버 공식 GitHub README |
| window | Coffee: 2026-04-23~2026-05-07 KST 문서 기준, Biocom NPay: 2026-04-27~2026-05-05 KST 문서 기준 |
| freshness | env presence 2026-05-07 22:51 KST, 공식 README 2026-05-07 조회 |
| site | biocom / thecleancoffee |
| confidence | 90% |

## Auditor verdict

```text
Auditor verdict: PASS_WITH_NOTES
Project: naver/npay
Lane: Green documentation
Mode: no-send / no-write / no-production-api-call

No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
No-platform-send verified: YES

Notes:
- backend/.env의 운영 가맹점 ID와 chain ID 존재만 확인했고 원문은 기록하지 않았다.
- 네이버 API production 호출은 하지 않았다.
- 현재 blocker는 credential 부족과 아임웹/제휴 호스팅사 주문관리 API 가능 여부 미확인이다.
```
