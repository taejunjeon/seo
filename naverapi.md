# 네이버 커머스API 정리

작성 시각: 2026-04-20 01:02 KST
최종 업데이트: 2026-05-13 13:42 KST
기준 문서: 네이버 커머스API `2.77.0 (2026-04-29)`

## 2026-05-13 추가 점검 결론

TJ님이 `backend/.env` 225~227행에 네이버 커머스API 센터 값을 추가한 상태다. 원문 secret은 문서화하지 않는다.

```text
backend/.env:225 #네이버 커머스API 센터
backend/.env:226 BIOCOM_STORE_APP_ID=***MASKED***
backend/.env:227 BIOCOM_STORE_APP_SECRET=***MASKED***
```

네이버 커머스API 센터에서 서버 IP 허용이 필요하면, 현재 VM Cloud backend의 outbound IP는 `34.64.104.94`로 등록한다. 2026-05-13 13:49 KST에 VM에서 `https://api.ipify.org`를 read-only로 호출해 동일 값을 확인했다. `att.ainativeos.net` DNS는 Cloudflare proxy IP를 반환하므로 네이버 API센터 허용 IP로 쓰지 않는다.

이번 점검에서 공식 문서 기준을 `2.77.0 (2026-04-29)`로 올렸다. 네이버 공식 문서상 커머스API는 인증, 통계, 주문, 정산, 상품, 판매자정보 영역을 제공한다. 우리 프로젝트에서 당장 중요한 것은 `주문 조회`, `정산 조회`, `마케팅/검색 통계`다. 단, 통계 API 일부는 `[브랜드스토어 전용]`이고 API데이터솔루션 구독이 필요할 수 있다.

VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3`를 read-only로 확인한 결과, 현재 네이버 커머스API 전용 테이블은 없다. 관련 이름으로 잡히는 것은 `npay_intent_log`, `coffee_npay_intent_log`처럼 NPay intent 장부뿐이다. 이 테이블들은 버튼 클릭/결제 의도 원장이지 네이버 커머스 주문/정산 원장이 아니다.

따라서 결론은 아래다.

1. **토큰 발급 smoke만 할 거면 새 테이블은 필요 없다.** 1회성 read-only probe는 파일 출력 또는 메모리 처리로 충분하다.
2. **VM Cloud에서 정기 sync를 하려면 신규 테이블이 필요하다.** 최소 `sync_runs`, `sync_state`, `product_order_snapshots` 3개가 필요하다.
3. **정산까지 닫으려면 `settlement_daily` 또는 `settlement_case` 테이블이 추가로 필요하다.**
4. **마케팅/검색 통계를 쓰려면 별도 `bizdata_*` 테이블이 필요하다.** 다만 브랜드스토어 전용/솔루션 구독 제약 때문에 먼저 권한 smoke가 필요하다.
5. VM Cloud schema 변경은 Yellow 승인 대상이다. 이번 문서 갱신에서는 테이블을 만들지 않았다.

## VM Cloud 테이블 추가 검토

### 현재 VM Cloud 상태

확인 시각: 2026-05-13 13:36 KST
source: VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3`
방법: SSH + sqlite schema read-only
confidence: 0.94

현재 전체 table 수는 50개다. 네이버 커머스API 전용 테이블은 없다. 이름상 관련 테이블은 아래뿐이다.

| 테이블 | 위치 | 성격 | 커머스API 주문/정산 source로 사용 가능 여부 |
|---|---|---|---|
| `npay_intent_log` | VM Cloud SQLite | NPay 클릭/결제 의도 원장 | NO. purchase actual 아님 |
| `coffee_npay_intent_log` | VM Cloud SQLite | 더클린커피 NPay intent 원장 | NO. purchase actual 아님 |
| `toss_settlements` | VM Cloud SQLite | Toss 정산 원장 | NO. 네이버 정산 아님 |
| `coupang_settlements_api` | VM Cloud SQLite | Coupang 정산 원장 | NO. 네이버 정산 아님 |

### 최소 권장 신규 테이블

운영 반영 전까지는 만들지 않는다. 아래는 승인안 작성용 설계다.

#### 1. `naver_commerce_sync_runs`

목적: 어떤 API를 언제 호출했고, 네이버 gateway trace/rate/quota가 어땠는지 남긴다.

권장 필드:

```sql
CREATE TABLE naver_commerce_sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site TEXT NOT NULL,
  account_scope TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  window_from TEXT,
  window_to TEXT,
  status TEXT NOT NULL,
  http_status INTEGER,
  trace_id TEXT,
  rate_limit_remaining INTEGER,
  quota_remaining INTEGER,
  row_count INTEGER DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  no_send INTEGER NOT NULL DEFAULT 1,
  no_write_external INTEGER NOT NULL DEFAULT 1
);
```

주의: `trace_id`는 저장 가능하지만 access token, client secret, signature는 절대 저장하지 않는다.

#### 2. `naver_commerce_sync_state`

목적: 변경 상품 주문 조회의 pagination/cursor를 보존한다. 공식 문서상 `lastChangedFrom`, `moreSequence`를 이어서 써야 할 수 있다.

권장 필드:

```sql
CREATE TABLE naver_commerce_sync_state (
  site TEXT NOT NULL,
  account_scope TEXT NOT NULL,
  resource TEXT NOT NULL,
  cursor_from TEXT,
  cursor_to TEXT,
  more_from TEXT,
  more_sequence TEXT,
  last_success_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (site, account_scope, resource)
);
```

#### 3. `naver_commerce_product_order_snapshots`

목적: 네이버 상품 주문 상태와 결제 금액을 내부 confirmed 원장 cross-check에 쓴다.

권장 필드:

```sql
CREATE TABLE naver_commerce_product_order_snapshots (
  site TEXT NOT NULL,
  account_scope TEXT NOT NULL,
  order_id TEXT NOT NULL,
  product_order_id TEXT NOT NULL,
  product_order_status TEXT,
  claim_status TEXT,
  order_date TEXT,
  payment_date TEXT,
  changed_at TEXT,
  total_payment_amount INTEGER,
  delivery_fee_amount INTEGER,
  product_amount INTEGER,
  quantity INTEGER,
  raw_status_json TEXT,
  synced_at TEXT NOT NULL,
  PRIMARY KEY (site, account_scope, product_order_id)
);
```

주의:
- `order_id`, `product_order_id`는 join key라 DB 내부에는 필요할 수 있다.
- 그러나 보고서/채팅/로그에는 raw order id를 출력하지 않는다.
- 구매자 이름, 연락처, 주소, 이메일은 저장하지 않는다.
- 네이버 상세 응답 전체 `raw_json`을 그대로 저장하면 PII 위험이 크다. 저장한다면 redaction 후 `raw_status_json` 수준으로 제한한다.

#### 4. `naver_commerce_settlement_daily`

목적: 네이버 gross/net, 수수료, 정산일 기준을 닫는다.

권장 필드:

```sql
CREATE TABLE naver_commerce_settlement_daily (
  site TEXT NOT NULL,
  account_scope TEXT NOT NULL,
  settle_date TEXT NOT NULL,
  gross_amount INTEGER,
  commission_amount INTEGER,
  settlement_amount INTEGER,
  order_count INTEGER,
  source_endpoint TEXT NOT NULL,
  synced_at TEXT NOT NULL,
  PRIMARY KEY (site, account_scope, settle_date, source_endpoint)
);
```

#### 5. 선택: `naver_commerce_bizdata_channel_daily`

목적: 네이버 커머스 통계의 마케팅 채널/검색어 성과를 `/total`의 Naver platform reference 후보로 붙인다.

전제:
- 공식 문서상 API데이터솔루션 일부는 `[브랜드스토어 전용]`이다.
- 솔루션 구독이 없거나 브랜드스토어가 아니면 응답이 제한될 수 있다.

권장 필드:

```sql
CREATE TABLE naver_commerce_bizdata_channel_daily (
  site TEXT NOT NULL,
  channel_no TEXT NOT NULL,
  stat_date TEXT NOT NULL,
  report_type TEXT NOT NULL,
  channel_name TEXT,
  visits INTEGER,
  payments INTEGER,
  payment_amount INTEGER,
  raw_metric_json TEXT,
  synced_at TEXT NOT NULL,
  PRIMARY KEY (site, channel_no, stat_date, report_type, channel_name)
);
```

### 테이블 추가 추천 순서

1. Green: token/order read-only probe 설계. 테이블 생성 없음.
2. Yellow 승인: `naver_commerce_sync_runs`, `naver_commerce_sync_state`, `naver_commerce_product_order_snapshots` 생성.
3. Green: 주문 변경 조회 dry-run → snapshot insert dry-run → row count/amount/status 검증.
4. Yellow 승인: 정산 API까지 연동할 때 `naver_commerce_settlement_daily` 추가.
5. Green/조건부: 통계 API 권한이 확인되면 `naver_commerce_bizdata_channel_daily` 추가.

## 10초 요약

네이버 커머스API는 스마트스토어의 주문, 상품, 정산, 판매자 정보를 서버에서 조회하거나 처리하기 위한 공식 HTTP API다.

현재 `backend/.env`에는 `BIOCOM_STORE_APP_ID`, `BIOCOM_STORE_APP_SECRET`이 등록되어 있다.
이 값으로 OAuth 토큰 발급용 전자서명을 만들 수 있다.

2026-04-20 스모크 테스트 결과, 당시 등록된 바이오컴 키로 `SELF` 토큰 발급과 주문 변경/상세 조회가 모두 200으로 열렸다.
하지만 당시 토큰이 볼 수 있는 채널은 `바이오컴 스토어` 1개뿐이었다.
2026-05-13 현재는 `backend/.env` 225~227행의 키 존재와 공식 문서/VM Cloud schema만 확인했다. 토큰 발급과 주문 조회는 이번 점검에서 재실행하지 않았다.
더클린커피 GA4 `NPAY - ...` 65건을 네이버 주문 원장과 닫으려면 더클린커피 통합매니저 권한 또는 더클린커피용 커머스API 앱 자격 증명이 필요하다.

## 문서 목적

이 문서는 네이버 커머스API를 우리 SEO 프로젝트에서 어떻게 써야 하는지 정리한다.
특히 GA4의 `NPAY - ...` transaction_id 주문을 네이버 원장과 대사하기 위한 출발점이다.

## 현재 로컬 설정

`backend/.env` 225~227행에 네이버 커머스API 센터 값이 등록되어 있다.

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

2026-04-20 read-only 스모크 기준으로 바이오컴 앱 ID와 시크릿은 정상 동작했다.
`SELF` 토큰으로 바이오컴 주문 변경/상세 조회가 가능하다는 것도 당시 확인했다.
2026-05-13 점검에서는 secret 출력 방지를 위해 토큰 발급을 재시도하지 않았다.

다만 당시 앱 ID와 시크릿의 채널 범위는 바이오컴 스토어 1개였다.
바이오컴 API로 더클린커피 스토어 주문 원장에 접근하는 방법은 현재 API 응답과 공식 권한 구조 기준으로 없다.

2026-05-08 네이버페이 운영팀(이민영) 공식 답변으로 더클린커피(`np_cnexi899940`)는 호스팅사 `아임웹`을 통해 가입된 `네이버페이 주문형서비스` 가맹점이며, 호스팅사 제휴 가맹점은 자체 네이버페이 API 연동/라이센스 발급이 구조적으로 불가하다는 것이 확정됐다.

따라서 더클린커피 NPAY 원장 대사는 네이버 커머스API 경로 자체를 포기하고, 정본 경로(NPay intent dispatcher v2.1 → A-5 monitoring → A-6 ledger join → backend no-send dry-run)에서 Imweb actual order + GTM intent log 기반 deterministic 매칭으로만 닫는다. 자세한 임팩트 평가는 §"2026-05-08 더클린커피 호스팅사 입점 공식 답변과 임팩트 평가" 참고.

## 2026-05-08 더클린커피 호스팅사 입점 공식 답변과 임팩트 평가

### 네이버페이 운영팀 공식 답변 원문

> 안녕하세요. 네이버페이 이민영입니다.
>
> 문의주신 더클린커피(ID:np_cnexi899940) 가맹점은 현재 '아임웹' 호스팅사를 통해 가입되어 네이버페이 주문형서비스 연동 중이신것 으로 확인됩니다.
>
> 아임웹과 같이 네이버페이와 제휴된 호스팅사를 이용하여 서비스 오픈될 경우 자체적인 네이버페이 API 연동 및 라이센스 발급이 불가합니다.
> 호스팅사 어드민에서 제공하는 네이버페이 주문 조회/처리 기능을 이용해주시거나 네이버페이센터 통해서만 조회/처리가 가능한 점 참고 부탁드립니다.
> (네이버페이 API 는 '독립몰' 형태로 입점된 '정상거래' 상태의 가맹점에 한해 연동 가능합니다.)

### 답변 해석

- 더클린커피는 아임웹 호스팅사 제휴 가맹점이므로 네이버페이 API 자체 연동이 **구조적으로 불가**하다.
- 통합매니저 권한 위임으로도 풀리지 않는다. 권한 문제가 아니라 가입 형태 문제다.
- 우회 경로는 두 가지뿐: (1) 아임웹 어드민이 제공하는 네이버페이 주문 조회/처리 화면, (2) 네이버페이센터 web UI 수동 조회.
- 둘 다 사람이 화면을 보고 처리하는 경로지 server-to-server 자동 대사 경로가 아니다.
- API 자체 연동을 열려면 **아임웹 호스팅을 떠나 독립몰로 신규 입점**해야 한다.

### 핵심 임팩트 평가 결론 (5줄)

1. **자사몰 독립몰 신축은 불필요하다**. 네이버페이 API 직접 효용이 과거 데이터 기준 6/47 ≈ 13% 수준이라 비용 대비 효익이 안 맞는다.
2. 이번 답변으로 [[data/!coffeedata.md]] `Parked / Later`의 `Naver API production 연동` 항목은 **영구 Parked로 확정**한다. 재개 조건 자체가 사라진다.
3. 더클린커피 NPay 매출은 정본 경로(NPay intent dispatcher v2.1 + Imweb actual order + GTM intent)로 **이미 deterministic 매칭이 가능**하다. 네이버 API는 보조였지 본 경로가 아니다.
4. [[total/!total-current.md]] 현재 P0(`paid_click_intent Mode B`)와 P1(`minimal paid_click_intent ledger write`)은 네이버 API 의존도 0이라 **영향 없음**.
5. [[data/!datacheckplan.md]] biocom NPay 매출 비중 30/60/90일 4.66~5.10%, 더클린커피도 유사 수준 추정. 단독으로 Meta/Google ROAS gap을 설명하지 못하는 보조 지표다.

### 임팩트 평가 상세

#### 1. 더클린커피 자사몰 독립몰 신축 ROI 평가

| 항목 | 값/판단 |
|---|---|
| 네이버 API 직접 효용 추정 | 6/47 ≈ 13% (과거 synthetic gap dry-run 기준) |
| 더클린커피 GA4 NPay vs Imweb actual 차이 | 2건 / 103,000원 (최근 7일, 약 4% 갭) |
| GA4 NPay형 purchase 절대값 | 58건 / 2,359,300원 (최근 7일) |
| Imweb NPay actual order 절대값 | 60건 / 2,462,300원 (최근 7일) |
| 독립몰 신축 비용 추정 | 도메인/PG 재계약 + 회원 마이그레이션 + GA4/GTM/Meta Pixel/CAPI 재구축 + NPay 재발급 + SEO 백링크 손실 |
| 정당화 임계 | 매출 갭이 30%+ 수준이어야 검토 가치. 현재 갭은 4% 수준 |
| 결론 | **신축하지 않는다**. 비용/리스크 막대 vs 기대 효익 미미 |

#### 2. 정본 경로(네이버 API 없이) 진행 가능성

[[data/!coffeedata.md]] Phase3-Sprint3 (NPay intent 미래키 수집) 정본 경로:

```text
랜딩 fbclid/UTM/intent → NPay 클릭 intent log (GTM v2.1) →
imweb_order_code capture → A-5 monitoring →
A-6 ledger join (real_with_imweb_order_code_and_confirm_to_pay) →
backend no-send dry-run → (Red 승인 후) GA4 MP enforce
```

이 경로는 네이버 API를 한 번도 호출하지 않는다. Imweb API + GTM intent log + VM Cloud SQLite만 쓴다.

| 정본 경로 단계 | 네이버 API 의존? | 현재 진척 |
|---|---|---|
| Phase1 주문·결제 기준선 | NO | 90% / 80% |
| Phase2 GA4/NPay 과거분 guard | NO | 100% / 100% (TJ YES 종결) |
| Phase3 NPay intent 미래키 수집 | NO | 88% / 68% (A-5 monitoring 진행) |
| Phase4 A-6 외부 전송 dry-run | NO | 45% / 0% (A-5 closure 후 진행) |
| Phase5 Coffee ROAS 화면 | NO | 20% / 0% (parked) |

→ **5개 Phase 모두 네이버 API 없이 닫을 수 있다**.

#### 3. 네이버 API가 닫지 못해 잃는 것

| 잃는 것 | 영향 크기 | 대안 |
|---|---|---|
| 더클린커피 GA4 NPAY 65건 (`2026-04-12~17`) 원장 대사 | 작음. GA4 분모 2,630,700원 / 7일 | Imweb API actual order 60건 / 2,462,300원 + intent log capture로 미래분 deterministic 매칭 |
| NPay 정산 net revenue 자동 계산 | 보통. 수수료 자동 산정 못 함 | 네이버페이센터 web UI 또는 아임웹 어드민에서 월 1회 수동 export |
| NPay 환불/취소 server-to-server 즉시 반영 | 작음 | 네이버페이센터/아임웹 어드민 polling. 주문 sync는 imweb API의 `state` 필드로 부분 보강 가능 |
| 과거 GA4 NPay synthetic gap 36건/36건 보강 | 미미 | TJ YES로 자동 복구 전송 금지 종결됨 ([[data/!coffeedata.md]] Phase2) |

#### 4. 바이오컴(biocom)에는 영향 없음

- 바이오컴은 이미 네이버 스마트스토어에 독립몰 형태로 입점되어 있고, `BIOCOM_STORE_APP_ID/SECRET`로 정상 API 동작 확인됨.
- 이번 답변은 더클린커피 한정 이슈다.
- biocom NPay 원장 대사는 기존 정본 경로 그대로 진행한다.

#### 5. 후속 액션

| # | 액션 | 담당 | 우선순위 |
|---:|---|---|---|
| 1 | [[data/!coffeedata.md]] `Parked / Later` 표의 `Naver API production 연동` 항목을 `영구 Parked / 재개 불가`로 갱신하고 본 답변을 근거로 기록 | Codex | 즉시 |
| 2 | [[data/!datacheckplan.md]] 더클린커피 NPAY 65건 대사 항목을 `네이버 API 경로 폐기, intent log + Imweb API 경로로 이관`으로 갱신 | Codex | 즉시 |
| 3 | [[total/!total-current.md]] Coffee NPay 관련 `parked` 항목에서 `Naver API 권한 확보 후 재대사` 문구 제거 | Codex | 즉시 |
| 4 | 아임웹 어드민의 네이버페이 주문 조회/처리 화면에서 export 가능한 항목(주문번호/금액/상태/수수료/정산일)을 1회 read-only로 확인 | TJ | 다음 sprint |
| 5 | (선택) 정산/수수료 월 1회 자동화는 아임웹 어드민 export 기준 CSV → 로컬 SQLite 적재 cron으로 구현 가능. 네이버페이센터 직접 scrape는 ToS 위반 위험으로 금지 | TJ + Codex | parked |

#### 6. 자신감 점수와 미지 영역

- **자신감**: 88%
- **미지 영역**:
  - 아임웹 어드민의 네이버페이 export 화면이 실제로 어떤 필드를 제공하는지 직접 본 적 없음 (TJ 1회 캡처 필요)
  - "주문형서비스" vs "결제형서비스" 호스팅 구분이 향후 네이버페이 정책 변경으로 풀릴 가능성은 낮지만 0이 아님 (현재 정책 기준)
  - 더클린커피를 장기적으로 자사몰로 옮길 경영적 사유(SEO 자체 운영, 아임웹 의존도 축소 등)가 있다면 별도 평가 필요. 본 평가는 "네이버 API 단일 사유로 신축할 가치가 있는가"에만 답함

## 공식 문서 출처

- 커머스API 최신 문서: https://apicenter.commerce.naver.com/docs/commerce-api/current
- OAuth 2.0 / 토큰 발급: https://apicenter.commerce.naver.com/docs/commerce-api/current/o-auth-2-0
- 인증 토큰 발급 요청: https://apicenter.commerce.naver.com/docs/commerce-api/current/issue-token-commerce-id
- 주문 조회 API 목록: https://apicenter.commerce.naver.com/docs/commerce-api/current/%EC%A3%BC%EB%AC%B8-%EC%A1%B0%ED%9A%8C
- 정산 내역 API 목록: https://apicenter.commerce.naver.com/docs/commerce-api/current/%EC%A0%95%EC%82%B0-%EB%82%B4%EC%97%AD
- API데이터솔루션 마케팅 채널 일별: https://apicenter.commerce.naver.com/docs/commerce-api/current/all-channel-daily-report-using-get-bizdata-stats
- 솔루션 가이드: https://apicenter.commerce.naver.com/docs/solution-doc
- 매니저 초대 기능 안내: https://apicenter.commerce.naver.com/docs/solution-doc/6000/%EB%A7%A4%EB%8B%88%EC%A0%80%EC%B4%88%EB%8C%80-%EA%B8%B0%EB%8A%A5-%EC%95%88%EB%82%B4
- 기본 연동 요소 가이드: https://apicenter.commerce.naver.com/docs/solution-doc/3000/%EA%B8%B0%EB%B3%B8-%EC%97%B0%EB%8F%99-%EC%9A%94%EC%86%8C-%EA%B0%80%EC%9D%B4%EB%93%9C
- 판매자 커머스 아이디 인증: https://apicenter.commerce.naver.com/docs/solution-doc/3000/%ED%8C%90%EB%A7%A4%EC%9E%90-%EC%BB%A4%EB%A8%B8%EC%8A%A4-%EC%95%84%EC%9D%B4%EB%94%94-%EC%9D%B8%EC%A6%9D
- 스마트스토어 통합매니저 위임 FAQ: https://help.sell.smartstore.naver.com/faq/content.help?faqId=12468

---

# 네이버 검색광고 API (Search Ad API) — 별도 시스템

> 2026-05-13 추가 (gpt0508-49). 본 § 은 **네이버 커머스API 와 다른** 별도 시스템입니다. 커머스 = 스마트스토어 주문/정산. 검색광고 = 파워링크 / 브랜드검색 광고 운영. 두 API 의 base URL / 인증 / 권한 / 토큰 / 키 모두 다름.
> 참조 정본: <https://naver.github.io/searchad-apidoc/#/guides>

## 13. 환경 변수 (검색광고)

`.env` (backend/.env) 229~232 행에 등록.

| env 키 | 의미 | HTTP 헤더 위치 |
|---|---|---|
| `BIOCOM_NAVER_ADS_CUSTOMER_ID` | 광고주 고객 ID (정수) | `X-Customer` |
| `BIOCOM_NAVER_ADS_ACESS` | Access License (오타 `ACESS` 그대로) | `X-API-KEY` |
| `BIOCOM_NAVER_ADS_SECRET_KEY` | Secret Key (HMAC 서명용) | (서명 생성에만 사용, 헤더로 직접 보내지 않음) |

> 본 키 3종은 네이버 검색광고 도구 → 도구 메뉴 → API 관리 화면에서 발급. 검색광고 매니저 권한 필요. 커머스API 의 client_id/client_secret 과 별개.

## 14. Base URL + Rate Limit (검색광고)

| 항목 | 값 |
|---|---|
| Base URL | `https://api.searchad.naver.com` |
| Rate Limit (일반) | 호출 간격 0.5초 이상 권장 (분당 약 100건) |
| 동시성 | 같은 customer 에 동시 호출 5건 이하 권장 |
| 응답 형식 | JSON |
| timezone | KST (Asia/Seoul) |

## 15. 인증 — HTTP 헤더 4 종 + HMAC 서명

모든 호출에 아래 4 헤더 필수.

| 헤더 | 값 |
|---|---|
| `X-Timestamp` | 현재 시각의 unix millisecond (예: `1747123200000`) |
| `X-API-KEY` | `BIOCOM_NAVER_ADS_ACESS` |
| `X-Customer` | `BIOCOM_NAVER_ADS_CUSTOMER_ID` |
| `X-Signature` | `base64(HMAC-SHA256(secret, "{timestamp}.{method}.{uri}"))` |

서명 구성:

- `timestamp`: `X-Timestamp` 와 동일
- `method`: HTTP method 대문자
- `uri`: path only (query 제외) — 예 `/ncc/campaigns`
- `secret`: `BIOCOM_NAVER_ADS_SECRET_KEY`

### 15-1. TypeScript helper 초안

```ts
import { createHmac } from "node:crypto";

export const buildNaverSearchAdHeaders = (
  method: "GET" | "POST" | "PUT" | "DELETE",
  uri: string,
): Record<string, string> => {
  const timestamp = Date.now().toString();
  const accessKey = process.env.BIOCOM_NAVER_ADS_ACESS ?? "";
  const customerId = process.env.BIOCOM_NAVER_ADS_CUSTOMER_ID ?? "";
  const secret = process.env.BIOCOM_NAVER_ADS_SECRET_KEY ?? "";
  if (!accessKey || !customerId || !secret) {
    throw new Error("BIOCOM_NAVER_ADS_* env 미설정");
  }
  const message = `${timestamp}.${method}.${uri}`;
  const signature = createHmac("sha256", secret).update(message).digest("base64");
  return {
    "X-Timestamp": timestamp,
    "X-API-KEY": accessKey,
    "X-Customer": customerId,
    "X-Signature": signature,
    "Content-Type": "application/json; charset=UTF-8",
  };
};
```

## 16. 주요 endpoint (read-only 우선)

| 분류 | URI | 용도 | 우선순위 |
|---|---|---|---|
| 캠페인 list | `GET /ncc/campaigns` | 캠페인 id / 이름 / 채널 / 상태 / 일 예산 | ★★★ |
| 캠페인 상세 | `GET /ncc/campaigns/{id}` | 단건 | ★★ |
| 광고 그룹 list | `GET /ncc/adgroups?nccCampaignId={id}` | 광고 그룹 id / 이름 / 입찰 / 디바이스 | ★★★ |
| 광고 (소재) list | `GET /ncc/ads?nccAdgroupId={id}` | 소재 id / 헤드라인 / 설명 / 상태 | ★★ |
| 키워드 list | `GET /ncc/keywords?nccAdgroupId={id}` | 키워드 / 입찰 / 매치 | ★★ |
| **Stats (일별 성과)** | `GET /stats?ids=...&fields=...&timeRange=...` | 노출 / 클릭 / 광고비 / 전환 | ★★★ |
| **Master Report 생성** | `POST /master-reports` | 비동기 대량 다운로드 등록 | ★★★ |
| Master Report 상태 | `GET /master-reports/{id}` | `BUILT` 되면 downloadUrl | ★★★ |
| BizMoney (광고비 잔액) | `GET /billing/bizmoney` | 잔액 확인 | ★ |

### 16-1. Stats 응답 필드 (read-only 사용)

| 필드 | 의미 |
|---|---|
| `impCnt` | 노출 수 |
| `clkCnt` | 클릭 수 |
| `ctr` | CTR % |
| `cpc` | CPC (원) |
| `salesAmt` | **광고비 (원)** — 광고비 정본 후보 |
| `convAmt` | 광고 플랫폼이 주장하는 매출 (원) — **참고값**, 내부 매출과 합산 금지 |
| `ccnt` | 전환 수 |
| `crto` | 전환율 |

> `convAmt` / `ccnt` 는 네이버가 자기 attribution 기준으로 주장하는 값. `/total` 페이지의 "광고 플랫폼이 주장하는 매출" 카드에만 사용. **운영DB `tb_iamweb_users` 의 결제완료 매출과 절대 합산 금지**.

### 16-2. Master Report (대량 history 다운로드) 3 단계

```
1) POST /master-reports  body: {"reportTp":"CAMPAIGN","fromTime":"2026-04-01T00:00:00Z"}
   → reportId 반환
2) GET /master-reports/{reportId}  polling
   → status=BUILT 되면 downloadUrl 반환
3) GET {downloadUrl}  (presigned, 인증 헤더 불필요)
   → TSV (탭 구분) 파일 다운로드
```

`reportTp` 종류: `CAMPAIGN` / `ADGROUP` / `AD` / `KEYWORD` / `AD_CONVERSION`.

## 17. 본 프로젝트의 활용 시나리오

### 17-1. 단기 (우선순위 ★★★)
- `/total` 페이지의 "광고 플랫폼이 주장하는 매출" 의 **naver 카드 blocked → live** 로 정정.
- 일 1회 cron 으로 `GET /stats` 호출 → 캠페인별 광고비 + 노출 / 클릭 / convAmt 캐시.
- **로컬DB SQLite 신규 테이블 후보**: `naver_ads_daily` (site / campaignId / campaignName / date / impCnt / clkCnt / costKrw / convAmt / ccnt / cached_at).

### 17-2. 중기 (★★)
- 캠페인 id ↔ utm_campaign 매핑 추출.
- **VM Cloud `site_landing_ledger`** 의 `utm_source='naver' AND utm_medium='powerlink'` row 의 `utm_campaign` 과 로컬DB `naver_ads_daily` 의 캠페인명 join → 네이버 광고 ROAS 측정 (단, 광고 클릭 → 결제 매핑 정확도 별도 검증).

### 17-3. 장기 (★)
- 키워드별 ROAS 측정 (`KEYWORD` reportTp + site_landing 의 utm_term 매핑).

## 18. 절대 금지 (정책)

- **광고 게재 상태 변경** (`PUT /ncc/campaigns/{id}` 등) — 명시 승인 전 금지.
- **입찰가 변경** (`PUT /ncc/keywords/{id}`) — 동일.
- **키워드 추가 / 삭제** (`POST/DELETE`) — 동일.
- `BIOCOM_NAVER_ADS_SECRET_KEY` 를 로그 / 응답 / 외부 시스템에 출력 금지.
- `convAmt` (네이버 주장 매출) 를 운영DB `tb_iamweb_users` 의 결제완료 매출과 합산 금지.

## 19. 다음 액션

| Owner | Action | Claude Code 직접 가능 | 못 하면 이유 | 데이터 충분도 | 타이밍 | 영향도 | 위험도 (↓) | 종합 추천 | 추천 |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| Claude Code | `backend/src/naverAdsClient.ts` 신규 — 헤더 4종 helper + `GET /ncc/campaigns` ping | YES — env 3종 이미 있음 | — | 90 | 90 | 85 | 10 | **87** | 진행 |
| Claude Code | 로컬DB SQLite `naver_ads_daily` 테이블 신설 + 일 1회 cron 또는 수동 sync endpoint | YES | — | 85 | 80 | 80 | 15 | **76** | 진행 (helper 후) |
| Claude Code | `/total` 페이지의 Naver 플랫폼 카드 blocked → live 데이터 wire | YES — 위 2 작업 후 | — | 80 | 70 | 80 | 15 | **74** | 진행 (조건부) |
| Claude Code | utm_campaign 매핑 audit (VM Cloud `site_landing_ledger` ↔ 로컬DB `naver_ads_daily`) | YES — read-only | — | 75 | 60 | 75 | 10 | **68** | 보류 (위 3 작업 후) |
| TJ님 | 네이버 검색광고 키워드 / 입찰 변경 작업 (필요 시) | NO — Naver 검색광고 UI | 운영 권한 + 입찰 정책 결정 | 60 | 40 | 40 | 30 | **42** | 보류 |

## 20. 정책 / 보안 (검색광고 invariant)

| invariant | 결과 |
|---|---|
| Secret key 본 문서에 출력 | 0 |
| Secret key 로그 출력 | 0 |
| 광고 게재 상태 변경 | 0 (read-only only) |
| `convAmt` ↔ 내부 매출 합산 | 0 |
| 운영DB write | 0 (네이버 sync 결과는 로컬DB / VM Cloud 만) |

## 21. 검색광고 API 참고 링크

- 정본 가이드: <https://naver.github.io/searchad-apidoc/#/guides>
- API 발급 화면: 검색광고 도구 → 도구 메뉴 → API 관리
- 검색광고 공지: <https://saedu.naver.com/notice>

