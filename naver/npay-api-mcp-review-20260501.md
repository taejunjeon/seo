# 네이버페이 API와 MCP 검토

작성 시각: 2026-05-01 01:36 KST
대상: 바이오컴/더클린커피 NPay 주문형, 결제형 API, MCP
Primary source: 네이버페이 개발자센터, `npay-mall-order-api/merchant-order-api` GitHub, 로컬 `backend/.env` 키 이름 확인
Cross-check: 네이버페이 개발 API read-only 결제내역 조회 1회, 기존 `naverapi.md`, `data/!coffeedata.md`
Freshness: 외부 문서 2026-05-01 KST 조회, 로컬 샌드박스 API 2026-05-01 01:30 KST 조회
Confidence: 88%

## 10초 요약

결론은 **MCP가 더 낫다기보다, MCP와 주문 API는 역할이 다르다**다.

MCP는 네이버페이 문서를 AI가 잘 찾게 해주는 개발 보조 도구다. 실제 주문을 조회하거나 결제완료를 확정하는 운영 원장은 아니다. 우리가 지금 필요한 `네이버페이 버튼 클릭자`와 `실제 결제완료자` 분리는 MCP가 아니라 주문/결제 원장 API 또는 아임웹/운영 DB/엑셀 원장으로 닫아야 한다.

`backend/.env` 256~260행의 더클린커피 키는 샌드박스 결제형 API 키로 확인된다. 개발 API `list/history` read-only 호출은 `Success`였지만, sandbox 데이터는 0건이었다. 이 결과는 키가 개발 결제 API 계열에는 맞는다는 뜻이지, 아임웹 주문형 운영 주문 조회 권한이 있다는 뜻은 아니다.

## 현재 결론

| 질문 | 결론 | 자신감 | 이유 |
|---|---|---:|---|
| MCP가 주문 원장 대체재인가 | NO | 96% | MCP 제공 도구는 문서 조회/검색 중심이다 |
| MCP를 쓰는 것이 개발에는 도움이 되나 | YES | 90% | 결제 API 문서를 빠르게 찾고 샘플을 확인하는 데 유용하다 |
| 지금 필요한 것은 어느 API인가 | 주문형 가맹점 API 또는 운영 주문 원장 | 86% | 실제 NPay 주문 조회/정산/취소/반품은 주문관리 API 성격이다 |
| 더클린커피 sandbox 키는 유효한가 | 개발 결제 API에서는 YES | 84% | `list/history`가 HTTP 200, `Success`로 응답했다 |
| 이 키로 운영 NPay 주문형 주문을 조회할 수 있나 | 아직 NO | 80% | 키 주석이 sandbox 전용이고, 주문형 운영 API 권한은 별도 검수/운영 앱이 필요하다 |
| 아임웹/호스팅사 사용 가맹점이면 주문관리 API가 바로 열리나 | 낮음 | 82% | 네이버 주문형 GitHub에는 제휴 호스팅사 입점 주문형 가맹점의 주문관리/정산 API 연동 제한 문구가 있다 |

## API 계열 구분

| 계열 | 공식 위치 | 인증 방식 | 무엇을 할 수 있나 | 우리 문제 해결력 |
|---|---|---|---|---|
| 결제형 Payment API | 네이버페이 개발자센터 `docs.pay.naver.com` | `X-Naver-Client-Id`, `X-Naver-Client-Secret`, `X-NaverPay-Chain-Id` | 결제예약, 결제승인, 결제내역 조회, 취소, 정산 조회 | 직접 결제형을 구현할 때 유용. 아임웹 주문형 주문 원장 조회에는 불확실 |
| 주문형 가맹점 API | `npay-mall-order-api/merchant-order-api` GitHub | OAuth 2.0 bearer token, 전자서명 | 주문 조회, 상품 주문 상세, 발주/발송, 취소/반품/교환, 정산 조회 | 실제 NPay 주문형 원장 확인에 가장 직접적 |
| 네이버 커머스API | `api.commerce.naver.com/external` | OAuth2 client credentials | 스마트스토어 주문/상품/정산 조회 | 스마트스토어 원장에는 유용. 아임웹 NPay 주문형과는 별도 확인 필요 |
| MCP | `@naverpay/payments-mcp` | MCP stdio local server | 문서 검색, 문서 조회 | 개발 보조. 운영 주문 조회/결제완료 확정에는 직접 사용 불가 |

## 확인한 사실

### 1. GitHub 주문형 가맹점 API

`npay-mall-order-api/merchant-order-api`는 네이버페이 주문형 가맹점 API 연동 개발을 위한 기술지원 GitHub 공간이다.

문서에서 확인한 범위:

| 항목 | 확인 내용 |
|---|---|
| 버튼 스크립트 | sandbox `https://test-pay.naver.com/assets/button/latest/npay.button.js`, production `https://npay-order.pstatic.net/assets/button/latest/npay.button.js` |
| 주문등록 API | 네이버페이 구매하기 버튼과 주문서를 연동 |
| 주문관리 API | NPay 주문 정보를 조회/처리 |
| 정산 API | 정산 정보를 조회 |
| sandbox 문서 | `https://sandbox-api.pay.naver.com/npay/partner` |
| production 문서 | `https://api.pay.naver.com/npay/partner` |
| 주문 상세 조회 | `/v1/pay-order/mall/product-orders/query` |
| 변경 주문 조회 | `/v1/pay-order/mall/product-orders/last-changed-statuses` |
| 정산 조회 | `/v1/pay-settle-mall/settle/daily`, `/settle/case` 등 |

중요 제한:

네이버 GitHub README에는 **제휴 호스팅사를 통해 입점한 주문형 가맹점과 예약 가맹점은 주문관리/정산 API 연동이 불가**하다는 취지의 문구가 있다. TJ님 화면의 `호스팅사 사용중인 가맹점의 API 연동 신청은 기술지원 문의 채널을 참고` 알림도 같은 방향으로 해석된다.

해석:

아임웹을 쓰는 바이오컴/더클린커피는 네이버페이 주문형 버튼을 사용하더라도, 네이버 주문형 API를 바로 열 수 없을 가능성이 높다. 이 경우 네이버 기술지원에 `아임웹 호스팅사 사용 가맹점이 주문관리/정산 API를 별도 연동할 수 있는지`를 먼저 확인해야 한다.

### 2. 네이버페이 개발자센터 결제형 API

네이버페이 개발자센터 결제 API는 API key header 방식이다.

필수 header:

```text
X-Naver-Client-Id
X-Naver-Client-Secret
X-NaverPay-Chain-Id
```

URL 계열:

| 환경 | 결제 API 도메인 |
|---|---|
| 개발 | `dev-pay.paygate.naver.com` |
| 운영 | `pay.paygate.naver.com` |

결제내역 조회 API:

```text
POST https://dev-pay.paygate.naver.com/naverpay-partner/naverpay/payments/v2.2/list/history
```

로컬 확인:

| 항목 | 결과 |
|---|---|
| 키 위치 | `backend/.env` 256~260행 |
| 키 성격 | 더클린커피 샌드박스 가맹점, 개발환경 호출용 |
| 호출 API | 개발 결제 API `list/history` |
| 조회 window | 2026-04-30 00:00:00 ~ 2026-04-30 23:59:59 |
| HTTP status | 200 |
| code | `Success` |
| totalCount | 0 |
| 해석 | 개발 결제 API 자격 증명은 유효해 보이나, sandbox 결제 데이터는 없음 |

주의:

이 키는 주석상 운영환경 호출이 불가하다. 운영 주문형 주문 조회, 운영 결제내역 조회, 더클린커피 실제 NPay order truth 확인에는 바로 쓸 수 없다.

### 3. MCP

네이버페이 MCP는 `@naverpay/payments-mcp` 패키지로 제공된다.

확인한 패키지 정보:

| 항목 | 값 |
|---|---|
| npm package | `@naverpay/payments-mcp` |
| version | `1.1.0` |
| repository | `NaverPayDev/agent-payments-integration`, `packages/payments-mcp` |
| license | Apache-2.0 |
| binary | `npay-payments-mcp` |

제공 도구:

| 도구 | 역할 |
|---|---|
| `get_document` | 네이버페이 문서 조회 |
| `search_documents` | 네이버페이 문서 키워드 검색 |

판단:

MCP는 API 문서 탐색에는 좋다. 하지만 운영 주문을 직접 조회하거나, 이미 결제된 주문을 GA4/Meta/TikTok에 보낼 후보로 확정하는 기능은 아니다. 따라서 `MCP를 붙이면 NPay 주문 원장이 해결된다`고 보면 안 된다.

## 우리 상황에 대한 판단

### 바이오컴

바이오컴은 이미 아임웹/운영 Postgres `tb_iamweb_users`에서 NPay confirmed order를 확인할 수 있다. 현재 문제는 NPay 주문형을 유지하면서 GA4/광고 전환 누락을 복구하는 것이다.

따라서 우선순위는 유지한다.

1. NPay intent 장부
2. 운영 주문 confirmed 원장
3. BigQuery already_in_ga4 guard
4. 제한된 GA4 MP 테스트
5. 7일 후보정

네이버 주문형 API가 열리면 좋지만, 필수 전제는 아니다.

### 더클린커피

더클린커피는 BigQuery 접근은 좋지만, 실제 NPay 주문 원장이 아직 약하다.

현재 `npay_coffee_*` 샌드박스 키는 개발 결제 API에 맞다. 그러나 최근 7일 GA4 `NPAY - ...` 58건이 실제 주문인지 확인하려면 운영 주문형/정산 원장이 필요하다.

가능한 정본 순서:

| 우선순위 | Source | 판단 |
|---:|---|---|
| 1 | 아임웹/운영 주문 원장 또는 NPay 주문/정산 엑셀 | 현실적인 1순위 |
| 2 | 네이버 주문형 가맹점 API production 권한 | 열리면 가장 좋음. 호스팅사 제한 확인 필요 |
| 3 | 결제형 Payment API production 결제내역 | 직접 결제형을 쓰는 경우 유효. 아임웹 주문형에는 불확실 |
| 4 | MCP | 문서 탐색 보조. 원장 아님 |

## 추천안

추천안 A: **MCP는 개발 보조로만 쓰고, 주문 원장은 기존 read-only 대조와 네이버 기술지원 문의로 닫는다.**

자신감: 90%

이유:

1. MCP는 문서 검색 도구라 운영 주문 조회를 해결하지 않는다.
2. 네이버 주문형 가맹점 API가 실제 주문 원장에는 가장 직접적이다.
3. 하지만 아임웹/호스팅사 사용 가맹점 제한이 있어 바로 접근 가능하다고 볼 수 없다.
4. 더클린커피 샌드박스 결제형 키는 개발 API에서는 유효하지만, 운영 주문형 NPay truth와는 별도다.

## 다음 할일

| 순서 | 담당 | 할 일 | 왜 하는가 | 어떻게 하는가 | 컨펌 필요 |
|---:|---|---|---|---|---|
| 1 | TJ | 네이버 기술지원에 주문형 API 가능 여부를 문의한다 | 아임웹/호스팅사 가맹점이 주문관리/정산 API를 쓸 수 있는지 확정해야 한다 | GitHub Discussions 또는 `dl_techsupport@navercorp.com`에 문의. 가맹점 ID, 호스팅사 사용 여부, 필요한 API 범위를 비공개 채널로 전달 | YES |
| 2 | Codex | 더클린커피 `NPAY - ...` 58건의 transaction_id 구조를 추가 분해한다 | API 권한이 늦어져도 BigQuery에서 어떤 ID를 원장과 붙일지 알아야 한다 | GA4 transaction_id, event_time, item_id, page_location, value를 패턴별 집계 | NO, read-only |
| 3 | Codex | 샌드박스 결제 API probe를 문서화된 스크립트로 만든다 | 수동 one-off 호출보다 반복 검증이 안전하다 | secret 출력 없이 status/code/count만 출력하는 `probe` 스크립트 초안 작성 | NO, sandbox read-only |
| 4 | TJ | 운영 결제형 API 키 발급 가능성을 확인한다 | 운영 `pay.paygate.naver.com` 조회는 sandbox 키로 불가 | 네이버페이센터/기술지원에서 production 앱 발급 조건 확인 | YES |
| 5 | Codex | MCP 사용은 별도 개발 편의 작업으로 분리한다 | 운영 데이터 접근과 혼동하면 안 된다 | 필요 시 `.vscode/mcp.json` 예시만 만들고, secret은 넣지 않는다 | 부분 YES, 도구 설정 |

## 네이버에 물어볼 문구 초안

```text
안녕하세요.

당사는 아임웹을 통해 네이버페이 주문형 버튼을 사용 중인 가맹점입니다.
GA4/광고 전환 정합성 및 주문/정산 대사를 위해 주문관리/정산 API 연동 가능 여부를 확인하고 싶습니다.

확인 요청:
1. 아임웹 등 호스팅사를 통해 입점한 주문형 가맹점도 주문관리 API와 정산 API를 별도 연동할 수 있나요?
2. 가능하다면 sandbox/production 애플리케이션 발급 절차와 검수 절차는 무엇인가요?
3. 불가능하다면 아임웹을 통한 주문형 주문 원장 조회/정산 대사를 위한 공식 대체 경로가 있나요?
4. 현재 보유한 결제형 샌드박스 client id/chain id와 주문형 가맹점 API는 별도 자격 증명인가요?

필요 API:
- 변경 상품 주문 내역 조회
- 상품 주문 상세 내역 조회
- 주문별 상품 주문 번호 목록 조회
- 일별/건별 정산 내역 조회

비공개 채널에서 가맹점 ID와 담당자 정보를 전달드리겠습니다.
```

## 금지선

아래는 아직 하지 않는다.

- 샌드박스 키로 운영 API 호출
- 운영 결제 API 호출
- 주문관리 API write성 기능 호출
- 취소/반품/발송 처리 API 호출
- GTM publish
- GA4/Meta/TikTok/Google Ads 전송
- `.env` 값 문서화 또는 커밋

## Source Links

- 네이버페이 주문형 GitHub: https://github.com/npay-mall-order-api/merchant-order-api
- 네이버페이 주문형 Wiki: https://github.com/npay-mall-order-api/merchant-order-api/wiki
- 네이버페이 개발자센터 MCP: https://docs.pay.naver.com/en/docs/ai-solutions/mcp/
- 네이버페이 개발자센터 인증: https://docs.pay.naver.com/en/docs/common/authentication/
- 네이버페이 개발자센터 API URL 형식: https://docs.pay.naver.com/en/docs/common/url-format/
- 네이버페이 결제내역 조회: https://docs.pay.naver.com/docs/onetime-payment/additional/payments_history.md
- NaverPayDev MCP repo: https://github.com/NaverPayDev/agent-payments-integration
