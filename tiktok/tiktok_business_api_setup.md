# TikTok Business API 설정 런북

작성 시각: 2026-04-18 05:35 KST
업데이트: 2026-04-22 00:36 KST

## 목적

이 문서는 TikTok Ads Manager 리포트를 수동 CSV 대신 API로 가져오기 위한 설정 절차다. 목표는 **광고비, 구매값, 플랫폼 ROAS를 read-only로 조회**하는 것이다.

주의할 점이 하나 있다. TikTok에는 비슷하게 보이는 토큰이 두 종류 있다.

- **Business API / Marketing API access token**: Ads Manager 리포트 조회에 필요하다.
- **Events API access token**: 서버에서 TikTok으로 이벤트를 보내는 데 필요하다. 리포트 조회용 토큰이 아니다.

현재 Sprint 2/3에 필요한 것은 첫 번째인 **Business API / Marketing API access token**이다.

## 현재 결론

2026-04-22 기준 TikTok Business API developer app 승인이 완료됐고, OAuth `auth_code`를 Business API access token으로 교환했다. 토큰 값은 문서에 기록하지 않고 `backend/.env`에만 저장했다. `backend/.env`는 Git ignore 대상이다.

현재 로컬에 저장된 값:

- `TIKTOK_BUSINESS_APP_ID`
- `TIKTOK_BUSINESS_APP_SECRET`
- `TIKTOK_BUSINESS_ACCESS_TOKEN`
- `TIKTOK_ADVERTISER_ID=7593201373714595856`
- `TIKTOK_ADVERTISER_IDS=7593201373714595856,7593240809332555793`

광고주 목록:

| advertiser_id | advertiser_name | 판단 |
|---|---|---|
| `7593201373714595856` | `(주)바이오컴_adv` | 대표 계정. 현재 ROAS 검증 기본값 |
| `7593240809332555793` | `바이오컴0109` | 보조 계정 후보. 별도 검증 전에는 기본값으로 쓰지 않음 |

Business API Reporting dry-run 결과:

- endpoint: `GET /open_api/v1.3/report/integrated/get/`
- advertiser: `7593201373714595856`
- 기간: 2026-03-19 ~ 2026-04-17
- dimensions: `campaign_id`, `stat_time_day`
- 반환 행: 147행
- 비용 합계: 28,363,230원
- 구매수: `conversion` 321건, `complete_payment` 321건
- 구매값 복원: `complete_payment * value_per_complete_payment` = 910,630,888원
- 기존 CSV 구매값 910,630,953원 대비 차이: 65원
- 저장 스크립트: `backend/scripts/tiktok-business-report-dry-run.ts`
- 저장 위치: `data/ads_csv/tiktok/api/tiktok_business_api_campaign_daily_20260319_20260417.{json,csv}`

따라서 반복 조회는 API 경로로 가능하다. 운영 DB insert 또는 스키마 변경은 별도 승인 후 진행한다.

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
   - 클릭: `clicks`
   - 구매수: `conversion` 또는 `complete_payment` (`2026-03-19 ~ 2026-04-17` 합계 둘 다 321건)
   - 구매값: 직접 `complete_payment_value` metric은 invalid. `complete_payment * value_per_complete_payment`로 복원한다.
   - ROAS: `complete_payment_roas`는 유효하나 row 단위 소수 2자리 반올림값이다. 구매값 복원에는 `value_per_complete_payment`를 우선한다.

4. 기간 확장
   - 2026-03-19 ~ 2026-04-17 dry-run 성공
   - 이후 필요한 기간은 API로 반복 조회 가능
   - 처음에는 DB insert 없이 JSON/CSV 파일 저장만 수행

5. 프로젝트 적재
   - dry-run 숫자는 기존 CSV와 비용/구매수 기준 일치한다
   - 구매값은 `complete_payment * value_per_complete_payment` 경로로 CSV와 65원 차이까지 맞는다
   - API 응답은 `backend/scripts/tiktok-business-report-dry-run.ts`로 표준 CSV/JSON 저장 가능하다
   - 다음 단계는 기존 `tiktok_ads_daily` 적재 경로와 API source를 연결하는 것이다
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
- `auth_code`는 1회성이다. token 교환 후 재사용하면 `Auth_code is used, please re-authorize.`가 반환된다.
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

API 승인은 완료됐다. 핵심 병목은 API가 아니라 attribution window 확인, source 분류 정밀도, pending fate 검증이다. 과거 기간을 반복 조회하거나 일자별 데이터를 여러 번 뽑는 작업은 이제 API 경로가 CSV보다 낫다.

현재 우선순위:

1. API 응답을 표준 JSON/CSV로 저장하는 read-only 스크립트를 만든다. — 완료
2. API JSON/CSV와 기존 Ads Manager CSV 합계를 자동 비교한다.
3. 비교가 안정되면 기존 `tiktok_ads_daily` 적재 경로에 API source를 추가한다.
4. DB 변경은 TJ 승인 후 진행한다.
5. scheduled export는 API 장애 시 백업 경로로 유지한다.

## API 승인 전 체크리스트

- [x] Ads Manager Custom report에 `Date`, `Campaign ID`, `Campaign name` 차원 추가
- [x] `Cost`, `Purchase count`, `Purchase value`, `CTA/EVTA/VTA purchase`, `CTA/EVTA/VTA ROAS` 지표 추가
- [ ] attribution window 화면 설정값 캡처 또는 수동 기록
- [ ] scheduled export 이메일 수신 설정
- [x] export 파일을 `data/ads_csv/tiktok/raw/`에 원본 보관
- [x] 로컬 dry-run 파서로 `tiktok_ads_daily` 적재 전 숫자 대조
- [x] Business API token 교환
- [x] advertiser list 조회
- [x] Reporting API 2026-03-19 ~ 2026-04-17 dry-run
- [x] Reporting API JSON/CSV 저장 스크립트 생성
