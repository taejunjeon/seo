# reportcoffee ADVoost Shopping API source plan 20260525

작성 시각: 2026-05-25 10:45 KST
담당: Codex
문서 성격: 더클린커피 `[ADVoost] 쇼핑` 광고비를 API로 가져오는 방법 조사

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - report/reportcoffee-naver-ads-ui-api-reconciliation-20260525.md
    - report/reportcoffee-naver-ads-customer-2424664-readonly-20260525.md
  lane: Green
  allowed_actions:
    - official Naver API documentation review
    - local env key presence check with redaction
    - API source design
    - local Markdown/JSON report output
  forbidden_actions:
    - Naver Ads state change
    - Naver Ads cache write
    - Slack send
    - production deploy
    - platform conversion send
    - sensitive credential value output
  source_window_freshness_confidence:
    source: "Naver Performance DA API official docs + local env variable-name check + TJ Naver Ads UI screenshot evidence"
    window: "2026-05-18 - 2026-05-24 KST target reconciliation window"
    freshness: "2026-05-25 10:45 KST"
    confidence: "high for API family and endpoint path, medium for ADVoost objective=SHOPPING until live token confirms campaign row, low for immediate call readiness because OAuth/Performance DA access token is not present locally"
```

## 사람 말 요약

`[ADVoost] 쇼핑`은 네이버 검색광고 API가 아니라 네이버 성과형 디스플레이 광고 API로 읽어야 한다.

기존 더클린커피 키(`NAVER_COFFEE_ACEESS`, `NAVER_COFFEE_SECREY_KEY`, `NAVER_COFFEE_CUSTOMER_ID`)는 검색광고 API용이다. 이 키로는 화면에 보이는 숫자형 캠페인 `1261102`의 디스플레이 광고비를 가져오는 구조가 아니다.

API로 자동화하려면 성과형 디스플레이 광고 API 권한을 받은 네이버 로그인 OAuth 토큰, 광고계정 번호, 필요 시 관리계정 번호가 필요하다. 이 준비가 되면 `[ADVoost] 쇼핑`은 캠페인 목록에서 이름 또는 `campaignNo=1261102`로 찾고, 성과 조회 API의 `sales` 값을 광고비로 집계하면 된다.

## 공식 문서 기준

참조한 공식 문서:

- Naver Performance DA API 시작하기: https://naver-ad-api.github.io/developers/en/docs/intro
- 성과형 디스플레이 API 호출 방법: https://naver-ad-api.github.io/openapi-guide/docs/prepare/api-call-with-access-token
- 성과형 디스플레이 요청 규칙: https://naver-ad-api.github.io/openapi-guide/docs/basic-concept/basic-request
- 성과형 디스플레이 광고 API: https://naver-ad-api.github.io/developers/en/api/ad
- 성과형 디스플레이 성과 API: https://naver-ad-api.github.io/developers/en/api/performance
- 성과형 디스플레이 FAQ: https://naver-ad-api.github.io/openapi-guide/docs/faq

문서에서 확인한 핵심:

- 성과형 디스플레이 API는 beta이며 공식 파트너만 접근 권한 요청과 권한 부여가 가능하다.
- 네이버 개발자 센터 애플리케이션 등록과 네이버 로그인 OAuth가 필요하다.
- API 호출은 `Authorization: Bearer {액세스 토큰}` 형태다.
- 관리계정 하위 광고계정을 읽는 경우 `AccessManagerAccountNo` 헤더가 필요할 수 있다.
- 성과 API는 과거 데이터 기준 최대 31일 기간을 한 번에 조회한다.
- 성과 응답의 `sales`가 광고비, `impCount`가 노출수, `clickCount`가 클릭수, `convCount`가 전환수, `convSales`가 전환매출이다.

## 필요한 값

API 자동화에 필요한 값:

1. `adAccountNo`
   - 뜻: 성과형 디스플레이 광고 계정 번호다.
   - 주의: 검색광고 customer id `2424664`와 같은 값이라고 단정하면 안 된다.

2. `AccessManagerAccountNo`
   - 뜻: 관리계정 아래 광고계정을 읽을 때 필요한 관리계정 번호다.
   - 없을 수도 있지만, 권한 에러가 나면 이 헤더부터 확인한다.

3. OAuth access token
   - 뜻: 네이버 로그인으로 발급받는 성과형 디스플레이 API 호출 토큰이다.
   - 기존 검색광고 라이선스/비밀키와 다른 인증 방식이다.

4. `campaignNo`
   - 화면에서 보이는 `[ADVoost] 쇼핑`의 숫자 캠페인 ID 후보는 `1261102`다.
   - 성과형 디스플레이 API의 캠페인 번호도 이 값일 가능성이 높지만, live list API로 확인해야 한다.

## 호출 순서

### 1. 성과형 디스플레이 광고계정 찾기

```bash
curl -X GET 'https://openapi.naver.com/v1/ad-api/1.0/adAccounts?page=0&size=100' \
  -H 'Authorization: Bearer {PERFORMANCE_DA_ACCESS_TOKEN}'
```

목적:

- 더클린커피 성과형 디스플레이 광고계정 번호를 찾는다.
- 계정이 관리계정 아래 있으면 다음 단계에서 관리계정 번호도 같이 확인한다.

### 2. 관리계정이 필요한지 확인

```bash
curl -X GET 'https://openapi.naver.com/v1/ad-api/1.0/managerAccounts?page=0&size=100' \
  -H 'Authorization: Bearer {PERFORMANCE_DA_ACCESS_TOKEN}'
```

목적:

- 직접 광고계정 멤버가 아니고 관리계정으로 접근하는 구조인지 확인한다.
- 관리계정이 필요하면 이후 요청마다 `AccessManagerAccountNo: {MANAGER_ACCOUNT_NO}`를 붙인다.

### 3. `[ADVoost] 쇼핑` 캠페인 찾기

```bash
curl -X GET 'https://openapi.naver.com/v1/ad-api/1.0/adAccounts/{AD_ACCOUNT_NO}/campaigns?objectives=SHOPPING&page=0&size=100' \
  -H 'Authorization: Bearer {PERFORMANCE_DA_ACCESS_TOKEN}' \
  -H 'AccessManagerAccountNo: {MANAGER_ACCOUNT_NO}'
```

목적:

- 캠페인 목록에서 이름이 `[ADVoost] 쇼핑`인 row를 찾는다.
- 화면의 숫자 ID `1261102`가 API의 `campaignNo`와 같은지 확인한다.

판단 기준:

- `name` 또는 캠페인명 필드가 `[ADVoost] 쇼핑`
- `campaignNo`가 `1261102` 또는 화면 ID와 매칭
- `objective`가 `SHOPPING` 후보

### 4. 캠페인 단위 과거 성과 조회

가장 먼저 시도할 방식:

```bash
curl -X GET 'https://openapi.naver.com/v1/ad-api/1.0/adAccounts/{AD_ACCOUNT_NO}/performance/past/campaigns?startDate=2026-05-18&endDate=2026-05-24&timeUnit=daily&limit=1000' \
  -H 'Authorization: Bearer {PERFORMANCE_DA_ACCESS_TOKEN}' \
  -H 'AccessManagerAccountNo: {MANAGER_ACCOUNT_NO}'
```

목적:

- 광고계정 안의 캠페인별 일자 성과를 가져온다.
- 응답에서 `campaignNo=1261102`만 필터한다.

필드 해석:

- `sales`: 광고비
- `impCount`: 노출수
- `clickCount`: 클릭수
- `convCount`: 전환수
- `convSales`: 네이버가 주장하는 전환매출
- `updatedAt`: 성과 갱신 시각

기대 검증값:

- 2026-05-18 - 2026-05-24 합산 `sales`가 화면의 `[ADVoost] 쇼핑` 총비용 `350,097원`과 근접해야 한다.
- 합산 `clickCount`가 `194`와 근접해야 한다.
- 합산 `impCount`가 `25,303`과 근접해야 한다.

### 5. 특정 캠페인의 하위 단위 성과 조회

캠페인 전체 API row가 없거나 더 자세한 분해가 필요하면 하위 광고그룹 또는 소재 단위로 조회한다.

```bash
curl -X GET 'https://openapi.naver.com/v1/ad-api/1.0/adAccounts/{AD_ACCOUNT_NO}/performance/past/campaigns/{CAMPAIGN_NO}/adSets?startDate=2026-05-18&endDate=2026-05-24&timeUnit=daily&limit=1000' \
  -H 'Authorization: Bearer {PERFORMANCE_DA_ACCESS_TOKEN}' \
  -H 'AccessManagerAccountNo: {MANAGER_ACCOUNT_NO}'
```

목적:

- `[ADVoost] 쇼핑` 캠페인을 광고그룹 단위로 쪼개서 본다.
- 모든 row의 `sales`를 합산해 캠페인 총비용을 복원한다.

## 현재 로컬 준비도

현재 로컬 `.env`에서 확인된 것은 검색광고 API용 값이다.

- `NAVER_COFFEE_ACEESS`
- `NAVER_COFFEE_SECREY_KEY`
- `NAVER_COFFEE_CUSTOMER_ID`

성과형 디스플레이 API용으로 필요한 아래 값은 현재 확인되지 않았다.

- `NAVER_PERFORMANCE_DA_ACCESS_TOKEN`
- `NAVER_PERFORMANCE_DA_REFRESH_TOKEN`
- `NAVER_PERFORMANCE_DA_AD_ACCOUNT_NO`
- `NAVER_PERFORMANCE_DA_MANAGER_ACCOUNT_NO`
- `NAVER_PERFORMANCE_DA_CLIENT_ID`
- `NAVER_PERFORMANCE_DA_CLIENT_SECRET`

따라서 지금 상태의 blocker는 IP가 아니라 인증 종류와 권한이다.

## 구현 설계

수집기는 두 source를 분리해야 한다.

1. 검색광고 source
   - 기존 `api.searchad.naver.com` 기반 검색광고 API
   - 더클린커피 검색/브랜드/쇼핑검색 캠페인
   - 예: `00.브랜드키워드`, `더클린커피 자사몰 브검`

2. 성과형 디스플레이 source
   - `openapi.naver.com/v1/ad-api/1.0` 기반 Performance DA API
   - `[ADVoost] 쇼핑`, `[카탈로그]`
   - 주간/월간 광고비에서 반드시 합산 필요

보고서 합산 규칙:

```text
naver_total_spend =
  search_ads_spend
  + performance_da_advoost_spend
  + performance_da_catalog_spend_if_active
```

이번 화면 기준 2026-05-18 - 2026-05-24:

```text
440원 + 350,097원 = 350,537원
```

## 우선순위

1. 성과형 디스플레이 API 권한과 OAuth 토큰 확보
   - 없으면 API 자동화 불가.

2. `campaignNo=1261102` live 확인
   - 화면 ID와 API ID가 같은지 확인해야 안전하다.

3. 주간 window API 합산 검증
   - 목표: `sales=350,097원`, `clickCount=194`, `impCount=25,303` 근접.

4. 월간/전월 window 확장
   - 목표: 더클린커피 월간 매출 대비 네이버 광고비 비중 계산 가능.

## Auditor verdict

```text
Auditor verdict: PASS_WITH_NOTES
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
Naver Ads state change: 0
Sensitive credential value output: 0
Remaining blocker: performance_da_oauth_and_ad_account_access_required
```
