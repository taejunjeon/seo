# TikTok Business API 설정 런북

작성 시각: 2026-04-18 05:35 KST
업데이트: 2026-04-18 13:33 KST

## 목적

이 문서는 TikTok Ads Manager 리포트를 수동 CSV 대신 API로 가져오기 위한 설정 절차다. 목표는 **광고비, 구매값, 플랫폼 ROAS를 read-only로 조회**하는 것이다.

주의할 점이 하나 있다. TikTok에는 비슷하게 보이는 토큰이 두 종류 있다.

- **Business API / Marketing API access token**: Ads Manager 리포트 조회에 필요하다.
- **Events API access token**: 서버에서 TikTok으로 이벤트를 보내는 데 필요하다. 리포트 조회용 토큰이 아니다.

현재 Sprint 2/3에 필요한 것은 첫 번째인 **Business API / Marketing API access token**이다.

## 현재 결론

Codex 단독으로는 TikTok Ads Manager 데이터를 API로 받을 수 없다. 필요한 값이 로컬에 없다. 또한 2026-04-18 현재 developer app은 Pending 상태이므로 API 승인을 기다리는 동안에도 수동 Custom report + scheduled export 경로로 Phase 1을 계속 진행한다.

필요한 값:

- TikTok Business API app ID
- TikTok Business API app secret
- OAuth authorization code 또는 이미 발급된 access token
- advertiser ID, 즉 TikTok ad account ID
- 리포트 조회 권한이 있는 TikTok 계정 권한

이 값들은 저장소에 커밋하지 않는다. 로컬 `.env.local` 또는 일회성 쉘 환경변수로만 사용한다.

## 공식 근거

- API for Business는 TikTok Ads Manager 기능을 프로그램으로 조회·관리할 수 있고, Marketing API는 데이터를 programmatically query할 수 있다.  
  https://ads.tiktok.com/help/article/marketing-api?lang=en
- 공식 Help Center는 다음 단계로 API for Business Homepage에서 개발자 등록을 안내한다.  
  https://ads.tiktok.com/help/article/marketing-api?lang=en
- Custom report는 Ads Manager에서 dimension/metric/time range를 선택하고 export할 수 있다.  
  https://ads.tiktok.com/help/article/create-manage-reports?redirected=1
- Business Center에서 ad account 접근을 요청하려면 Business Center admin이어야 하며, Analyst 권한은 광고와 성과 데이터를 볼 수 있다.  
  https://ads.tiktok.com/help/article/request-access-to-ad-accounts-in-business-center
- Ad account ID는 Ads Manager의 Account Name > ID 또는 URL에서 확인할 수 있다.  
  https://ads.tiktok.com/help/article/find-your-ad-account-id?lang=en
- TikTok Business API v1.3 공개 Postman 컬렉션 기준 synchronous report endpoint는 `GET /open_api/v1.3/report/integrated/get/`이고 `Access-Token` 헤더를 사용한다.  
  https://www.postman.com/tiktok/tiktok-api-for-business/request/7d5ufux/run-a-synchronous-report
- 같은 Postman 컬렉션 기준 OAuth token 교환은 `POST /open_api/v1.3/oauth2/access_token/`에 `app_id`, `secret`, `auth_code`를 전달한다.  
  https://www.postman.com/tiktok/tiktok-api-for-business/request/36d76ip/tt-user-oauth2-token
- Events API access token은 Events Manager의 Pixel 설정에서 생성하는 별도 토큰이다. Reporting API 토큰과 혼동하면 안 된다.  
  https://ads.tiktok.com/help/article/how-to-get-tiktok-access-token-for-shoplazza

## TJ 준비 작업

1. TikTok Ads Manager에서 ad account ID 확인
   - Ads Manager에서 Account Name 클릭
   - ID 확인
   - URL에 포함된 account/ad account ID도 같이 확인

2. 계정 권한 확인
   - 최소 Analyst 이상 권한 필요
   - API app 생성·승인 작업은 Business Center admin 권한이 필요할 수 있음

3. API for Business 포털 접속
   - https://business-api.tiktok.com/portal
   - 개발자 등록
   - 앱 생성
   - Redirect URI 등록
   - Marketing API / Reporting 조회 권한 신청

4. OAuth 승인
   - 앱의 authorization URL로 TikTok 계정 승인
   - redirect URL로 돌아오는 `auth_code` 확보
   - 이 값은 짧게 만료될 수 있으므로 바로 token 교환 필요

5. Codex에 전달할 값
   - `TIKTOK_BUSINESS_APP_ID`
   - `TIKTOK_BUSINESS_APP_SECRET`
   - `TIKTOK_BUSINESS_AUTH_CODE` 또는 `TIKTOK_BUSINESS_ACCESS_TOKEN`
   - `TIKTOK_ADVERTISER_ID`

전달 방식은 저장소 파일이 아니라 일회성 메모 또는 로컬 환경변수로 한다.

## Codex 작업 순서

1. 토큰 교환 dry-run

```bash
curl --request POST 'https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/' \
  --header 'Content-Type: application/json' \
  --data '{
    "app_id": "'"$TIKTOK_BUSINESS_APP_ID"'",
    "secret": "'"$TIKTOK_BUSINESS_APP_SECRET"'",
    "auth_code": "'"$TIKTOK_BUSINESS_AUTH_CODE"'"
  }'
```

2. 1일 범위 리포트 dry-run

```bash
curl --globoff 'https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/?advertiser_id='"$TIKTOK_ADVERTISER_ID"'&page=1&page_size=10&data_level=AUCTION_CAMPAIGN&report_type=BASIC&dimensions=["campaign_id","stat_time_day"]&metrics=["spend","impressions","clicks"]&start_date=2026-04-17&end_date=2026-04-17' \
  --header 'Access-Token: '"$TIKTOK_BUSINESS_ACCESS_TOKEN"
```

3. metric 이름 확정
   - 비용: `spend`
   - 노출: `impressions`
   - 클릭: `clicks` 또는 목적지 클릭 metric
   - 구매수: TikTok 문서/응답에서 확인
   - 구매값: TikTok 문서/응답에서 확인
   - ROAS: TikTok 문서/응답에서 확인

4. 기간 확장
   - 2026-04-01 ~ 2026-04-18
   - Guard 적용 전 최대 가능 기간
   - 처음에는 DB insert 없이 JSON/CSV 파일 저장만 수행

5. 프로젝트 적재
   - dry-run 숫자가 Ads Manager 화면과 맞을 때만 DB 테이블 생성/insert 검토
   - DB 변경은 TJ 승인 후 진행

## 요청할 리포트 형태

우선순위 1: 캠페인 × 일자. API 승인 전에는 같은 포맷을 Ads Manager Custom report로 export한다.

- dimensions: `campaign_id`, `campaign_name`, `stat_time_day`
- metrics: spend, net cost, impressions, destination clicks, conversions, purchase count, purchase value, CTA purchase, EVTA purchase, VTA purchase, CTA purchase ROAS, EVTA purchase ROAS, VTA purchase ROAS

우선순위 2: 캠페인 기간 합계

- dimensions: `campaign_id`, `campaign_name`
- metrics: spend, impressions, clicks, conversions, purchase count, purchase value, purchase ROAS

우선순위 3: ad group/ad 단위

- 캠페인 단위 gap이 큰 경우에만 내려간다.

## 보안 규칙

- access token, app secret, auth code는 Git에 커밋 금지
- 문서에는 실제 토큰 일부도 기록하지 않음
- API 조회는 read-only 권한만 사용
- 운영 DB insert 전에는 JSON/CSV dry-run만 수행
- Events API 송신 토큰과 Reporting API access token을 분리

## 실패 시 점검

| 증상 | 원인 후보 | 조치 |
|---|---|---|
| `401` 또는 token invalid | auth code 만료, access token 오타 | OAuth 재승인 후 token 재발급 |
| `advertiser_id` 권한 오류 | 앱 또는 사용자에게 해당 ad account 권한 없음 | Business Center에서 Analyst 이상 권한 확인 |
| metric unknown | metric 이름이 UI 표시명과 API명이 다름 | 1일 dry-run으로 응답 가능한 metric부터 확인 |
| 구매값이 계속 0 | 구매값 metric 미선택, Pixel/Events 매핑 문제, attribution 설정 차이 | Ads Manager 화면의 Custom report metric과 API metric 재매핑 |
| 수동 CSV와 API 숫자 차이 | attribution window, timezone, conversion time 기준 차이 | Ads Manager Custom report 설정값을 동일하게 맞춤 |

## 이번 프로젝트 판단

지금은 수동 export가 이미 들어왔으므로 API 설정은 Sprint 2의 필수 선행 조건은 아니다. 핵심 병목은 API가 아니라 metric dictionary, attribution window, source 분류 정밀도, pending fate 검증이다. 다만 과거 기간을 반복 조회하거나 일자별 데이터를 여러 번 뽑아야 하면 API가 낫다.

현재 우선순위:

1. 수동 export를 올바른 컬럼으로 한 번 더 받는다.
2. scheduled export를 켜서 같은 포맷을 반복 수집한다.
3. `tiktok_ads_daily`에 적재한다.
4. 그 파일로 ROAS gap 계산 가능성을 검증한다.
5. 반복 작업이 생기면 API read-only 자동화를 붙인다.

## API 승인 전 체크리스트

- [ ] Ads Manager Custom report에 `Date`, `Campaign ID`, `Campaign name` 차원 추가
- [ ] `Cost`, `Purchase count`, `Purchase value`, `CTA/EVTA/VTA purchase`, `CTA/EVTA/VTA ROAS` 지표 추가
- [ ] attribution window 화면 설정값 캡처 또는 수동 기록
- [ ] scheduled export 이메일 수신 설정
- [ ] export 파일을 `data/ads_csv/tiktok/raw/`에 원본 보관
- [ ] 로컬 dry-run 파서로 `tiktok_ads_daily` 적재 전 숫자 대조
