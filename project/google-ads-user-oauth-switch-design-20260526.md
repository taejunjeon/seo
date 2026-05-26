작성 시각: 2026-05-26 22:59 KST
최근 업데이트: 2026-05-26 23:47 KST
기준일: 2026-05-26
문서 성격: Google Ads 실제 결제완료 전환 업로드 인증 전환 설계/구현 메모

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/gdn/README.md
  required_context_docs:
    - project/google-ads-fast-track-primary-result-20260526.md
    - project/google-ads-limited-confirmed-purchase-send-approval-draft-20260526.md
    - project/google-ads-duplicate-send-ledger-design-20260526.md
  lane: Green implementation, Yellow deploy completed, Red limited platform send approved/completed
  allowed_actions:
    - local code change
    - local dry-run
    - typecheck
    - build
    - OAuth refresh-token generator script creation
    - VM Cloud backend deploy after TJ님 approval
    - Google Ads validate-only upload check
    - Google Ads limited conversion upload max 2 after TJ님 approval
  forbidden_actions:
    - Google Ads conversion upload without explicit max-2 approval
    - VM Cloud deploy without approval
    - production DB write
    - raw OAuth secret/report exposure
  source_window_freshness_confidence:
    source: local backend code + VM Cloud backend status API + Google Ads validate-only response
    window: 2026-05-26 KST
    freshness: same-day
    confidence: high
```

## 10초 요약

Google Ads에 실제 결제완료 주문만 구매로 알려주는 통로는 후보 장부까지 준비됐지만, 기존 서비스계정 인증은 전환 업로드 권한에서 막혔다.
이번 변경은 Google Ads 권한을 가진 사람 계정의 OAuth refresh token으로 API를 호출할 수 있게 준비하는 작업이다.
현재까지 로컬 구현, VM Cloud 배포, typecheck, build, no-send validate-only 검증, Google Ads 제한 전송 2건이 통과했다.
Google Ads 실제 전환 전송은 승인 범위 안의 2건만 수행했다.

## 무엇이 가능해졌나

- 서버가 기존 서비스계정 방식과 사용자 OAuth 방식을 선택할 수 있다.
- TJ님이 만든 OAuth Client ID/Secret은 `.env`의 기존 오타 포함 변수명도 그대로 읽는다.
- 로컬 스크립트로 Google 로그인 URL을 만들고, 승인 후 refresh token을 `backend/.env`에 저장할 수 있다.
- `/api/google-ads/status`와 dashboard 응답에 현재 인증 방식이 `service_account`인지 `user_oauth`인지 표시할 수 있다.

## 왜 중요한가

Google Ads가 입찰 학습에 쓰는 핵심 구매 신호를 실제 결제완료 주문으로 바꾸려면, `BI confirmed_purchase_offline` 전환 액션에 실제 구매 전환을 업로드해야 한다.
기존 서비스계정은 Google Ads 읽기에는 성공했지만, 업로드 검증에서 `ACTION_NOT_PERMITTED`로 막혔다.
따라서 업로드 권한을 가진 사람 계정 OAuth로 바꾸는 것이 다음 병목이다.

## 구현 위치

- `backend/src/env.ts`
  - `GOOGLE_ADS_AUTH_MODE`
  - `GOOGLE_ADS_OAUTH_CLIENT_ID`
  - `GOOGLE_ADS_OAUTH_CLIENT_SECRET`
  - `GOOGLE_ADS_OAUTH_REFRESH_TOKEN`
  - legacy alias: `GOOGLE_CONSOLE_Oauth_Clinet_ID`, `GOOGLE_CONSOLE_Oauth_Secret_KEY`
- `backend/src/routes/googleAds.ts`
  - `createGoogleAdsContext()`를 서비스계정 / 사용자 OAuth 분기로 변경
  - status/dashboard 응답에 인증 방식 표시
- `backend/scripts/google-ads-generate-user-refresh-token.ts`
  - 로컬 OAuth 승인 URL 생성
  - callback 수신
  - refresh token을 `.env`에 저장하는 옵션 제공

## 검증 결과

- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm exec -- tsx scripts/google-ads-generate-user-refresh-token.ts --dry-run --port=18080`: PASS
- refresh token 발급: PASS (`backend/.env` 저장, 원문 token 미출력)
- user OAuth Google Ads read-only 접근: PASS (`customers:listAccessibleCustomers` 200, 접근 가능 고객 6개)
- user OAuth target customer read-only 접근: PASS (`customer_id=2149990943`, customer name `바이오컴`, status `ENABLED`)
- `python3 scripts/harness-preflight-check.py --strict`: PASS
- VM Cloud backup: PASS (`/home/biocomkr_sns/seo/repo/.deploy-backups/google-ads-user-oauth-20260526T1424KST`)
- VM Cloud `npm run typecheck`: PASS
- VM Cloud `npm run build`: PASS
- VM Cloud backend restart: PASS (`pm2 restart seo-backend --update-env`, process online)
- VM Cloud status API: PASS (`auth.mode=user_oauth`, customer name `바이오컴`, status `ENABLED`)
- VM Cloud pm2 status: PASS (`seo-backend` online, uptime 9m at 2026-05-26 23:38 KST)
- Google Ads no-send validate-only: PASS (`validate_only=1`, responseStatus 200, attempted 2, validated 2, externalSendCount 0)
- Google Ads limited upload: PASS (`responseStatus 200`, attempted 2, resultCount 2, partialFailure false, externalSendCount 2)
- duplicate guard after send: PASS (`readyCandidates 0`, candidate blockers `already_sent`)
- Google Ads API primary status after TJ님 change: PASS (`BI confirmed_purchase_offline.primaryForGoal=true`)
- Google Ads API secondary status after TJ님 change: PASS (`NPay 버튼 클릭/결제진입(보조).primaryForGoal=false`)

## 아직 안 된 것

- `BI confirmed_purchase_offline`을 Google Ads Primary 전환으로 승격하는 것은 아직 하지 않았다.
- Google Ads UI에서 전환 수치가 실제 표시되는 것은 플랫폼 처리 지연 때문에 아직 화면 확인 전이다.
- Google Ads UI의 `데이터 소스에 연결하여 전환 추적 시작` 경고는 아직 남아 있다. 이 액션은 웹 태그가 아니라 `UPLOAD_CLICKS` API 전송용이므로, 수신 처리/진단 반영 지연 여부를 먼저 본다.

## VM Cloud 배포 결과

- 배포 승인: TJ님 승인 완료 (`VM Cloud backend 배포 승인한다.`)
- 배포 대상: `/home/biocomkr_sns/seo/repo/backend`
- 적용 파일:
  - `backend/src/env.ts`
  - `backend/src/routes/googleAds.ts`
  - `backend/scripts/google-ads-generate-user-refresh-token.ts`
  - `backend/.env`의 Google Ads OAuth 관련 값
- 운영 영향:
  - Google Ads API 인증 방식이 `user_oauth`로 전환됐다.
  - 백엔드가 Google Ads target customer `2149990943`을 사람 계정 OAuth로 읽을 수 있다.
  - 실제 Google Ads 전환 업로드는 실행하지 않았다.

## No-Send Validate-Only 결과

검증 시각: 2026-05-26 23:33 KST

- endpoint: `POST /api/google-ads/confirmed-purchase/limited-upload`
- mode: `google_ads_limited_upload_validate_only`
- validateOnly: `true`
- conversion action: `BI confirmed_purchase_offline`
- conversionActionId: `7609289411`
- sourceCandidates: 2
- readyCandidates: 2
- attemptedConversions: 2
- validatedConversions: 2
- externalSendCount: 0
- VM Cloud ledger write: 0
- raw order id exposed: false
- raw click id exposed: false
- Google Ads responseStatus: 200
- partialFailure: false

해석:

- Google Ads가 실제 결제완료 전용 전환 후보 2건의 payload 형식을 받을 수 있다고 응답했다.
- `validate_only=1`이므로 Google Ads 구매 수치, 전환값, 학습 신호는 아직 변하지 않았다.
- 실제 전송은 여전히 Red Lane이며 TJ님 명시 승인이 필요하다.

## 제한 전송 결과

전송 시각: 2026-05-26 23:35 KST

- endpoint: `POST /api/google-ads/confirmed-purchase/limited-upload`
- mode: `google_ads_limited_upload`
- conversion action: `BI confirmed_purchase_offline`
- conversionActionId: `7609289411`
- sourceCandidates: 2
- readyCandidates: 2
- attemptedConversions: 2
- externalSendCount: 2
- Google Ads resultCount: 2
- partialFailure: false
- VM Cloud upload ledger sent rows: 2
- raw order id exposed: false
- raw click id exposed: false

중복 방지 재확인:

- 전송 직후 같은 endpoint를 `validate_only=1`로 재조회했다.
- 결과는 `readyCandidates=0`이었다.
- 두 후보 모두 `ledgerStatus=sent`, `blockReasons=["ledger_status_not_ready:sent","already_sent"]`로 막혔다.

해석:

- 실제 결제완료 전용 Google Ads 전환 통로가 작동했다.
- 같은 후보가 다시 전송되지 않는 장부 방어도 작동했다.
- 다음 병목은 Google Ads UI에서 `BI confirmed_purchase_offline` 전환이 수신되는지 확인하고, Primary 전환 승격을 언제 할지 결정하는 것이다.

## Primary 변경 후 화면 경고 판단

확인 시각: 2026-05-26 23:46 KST

- `BI confirmed_purchase_offline`
  - status: `ENABLED`
  - type: `UPLOAD_CLICKS`
  - category: `PURCHASE`
  - primaryForGoal: `true`
  - sendTo: `[]`
  - snippetTypes: `[]`
- `NPay 버튼 클릭/결제진입(보조)`
  - status: `ENABLED`
  - type: `WEBPAGE`
  - category: `PURCHASE`
  - primaryForGoal: `false`
  - sendTo: `AW-304339096/r0vuCKvy-8caEJixj5EB`

해석:

- 실제 구매 전용 액션은 웹사이트에 붙이는 태그가 아니라 서버에서 Google Ads API로 올리는 `UPLOAD_CLICKS` 액션이다.
- 따라서 `sendTo`와 `snippetTypes`가 비어 있는 것은 정상이다.
- UI의 데이터 소스 연결 경고는 웹 태그 관점의 안내이거나, 방금 업로드한 전환 2건이 아직 진단에 반영되지 않은 상태로 본다.
- 기여 분석 모델은 지금 바꾸지 않는다. `데이터 기반`은 전환이 잡힌 뒤 어떤 광고 접점에 기여를 나눌지 정하는 설정이고, 데이터 소스 연결 문제를 해결하는 스위치가 아니다.
- 공식 문서 기준으로 가져온 전환은 업로드 요청 날짜가 아니라 원래 광고 클릭 날짜 기준 보고서에 반영되고, 마지막 클릭도 최대 3시간, 다른 기여 모델은 그 이상 걸릴 수 있다.

## 다음 할일

### Auto Green

1. Codex가 Google Ads UI/API에서 `BI confirmed_purchase_offline` 수신 상태를 재조회한다.
2. Codex가 다음 ready 후보가 생기는지 no-send 후보율을 계속 확장한다.

### Approval Needed

1. TJ님이 Google Ads 화면에서 `BI confirmed_purchase_offline` 수신 여부를 확인한다.
2. 수신 확인 후 TJ님이 `BI confirmed_purchase_offline`을 Primary 전환으로 올릴지 결정한다.
3. Codex는 같은 시각 API 수신 상태와 기존 NPay 버튼 신호 분리 상태를 대조한다.

### Blocked/Parked

1. 추가 Google Ads 전환 전송은 Red Lane이다.
2. 이번 2건 외 추가 전송은 새 후보 검토표와 TJ님 명시 승인 전까지 전송하지 않는다.
