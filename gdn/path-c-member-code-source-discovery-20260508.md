# Path C member_code source 재탐색 결과

작성 시각: 2026-05-08 20:06:25 KST
대상: biocom Path C member_code source discovery
Status: hold_no_client_member_code_source_found
Do not use for: GTM Production publish, backend deploy, raw member_code 저장, email/phone/user_id bridge, platform send

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  lane: Green read-only/source discovery
  allowed_actions:
    - GTM API read-only variable/tag definition inspection
    - public page probe with analytics/platform hosts blocked
    - document update
  forbidden_actions:
    - GTM Production publish
    - backend deploy
    - operational DB write
    - raw member_code/email/phone storage
    - GA4/Meta/Google Ads/Naver platform send
  source_window_freshness_confidence:
    source: "GTM Default Workspace read-only + public page storage/global probe + TJ Tag Assistant 200/201/203 evidence"
    window: "2026-05-08 KST"
    freshness: "2026-05-08 20:06:25 KST"
    confidence: 0.88
```

## 한 줄 결론

현재 브라우저/GTM 경로에서 usable `member_code` source는 발견하지 못했다. GTM에는 `memberCode` 후보 변수가 있지만 200/201/203 실제 이벤트에서 empty였고, 공개 페이지 probe에서도 `member_code` 계열 후보는 모두 absent다. 이메일형 `user_id`는 Path C source로 사용 금지다.

## GTM read-only 결과

| 변수 | type | 읽는 위치 | 판정 |
|---|---|---|---|
| `JS - Imweb Data Layer` | jsm | `__bs_imweb` | Imweb device/session object. 공유된 구조 기준 memberCode 없음 |
| `Retous - [변수] memberCode` | v | `hurdlers_ga4.member_code` | 정의는 있으나 TJ Tag Assistant 200/201/203 확인에서 empty/undefined |
| `Retous - [맞춤] utmSource` | jsm | `JS - Imweb Data Layer` | Imweb device/session object. 공유된 구조 기준 memberCode 없음 |
| `Retous - [맞춤] utmMedium` | jsm | `JS - Imweb Data Layer` | Imweb device/session object. 공유된 구조 기준 memberCode 없음 |
| `Retous - [맞춤] utmCampaign` | jsm | `JS - Imweb Data Layer` | Imweb device/session object. 공유된 구조 기준 memberCode 없음 |
| `Retous - [맞춤] utmContent` | jsm | `JS - Imweb Data Layer` | Imweb device/session object. 공유된 구조 기준 memberCode 없음 |
| `Retous - [맞춤] utmTerm` | jsm | `JS - Imweb Data Layer` | Imweb device/session object. 공유된 구조 기준 memberCode 없음 |
| `Retous - [맞춤] memberCode` | jsm | `JS - Imweb Data Layer` | 정의는 있으나 TJ Tag Assistant 200/201/203 확인에서 empty/undefined |
| `RETOUS - [변수] member_code` | v | `member_code` | 정의는 있으나 TJ Tag Assistant 200/201/203 확인에서 empty/undefined |
| `phone_reg` | jsm | - | email/phone/user_id 계열이라 Path C source로 사용 금지 |
| `phone_buy` | jsm | - | email/phone/user_id 계열이라 Path C source로 사용 금지 |
| `email_reg` | jsm | - | email/phone/user_id 계열이라 Path C source로 사용 금지 |
| `UPDE_reg_em_pn` | awec | `email_reg`, `phone_reg` | email/phone/user_id 계열이라 Path C source로 사용 금지 |
| `email_buy` | jsm | - | email/phone/user_id 계열이라 Path C source로 사용 금지 |
| `UPDE_buy_em_pn` | awec | `email_buy`, `phone_buy` | email/phone/user_id 계열이라 Path C source로 사용 금지 |
| `memberCode` | v | `member_code` | 정의는 있으나 TJ Tag Assistant 200/201/203 확인에서 empty/undefined |
| `HURDLERS - [맞춤 JS] user_id` | jsm | `.email-info` | email/phone/user_id 계열이라 Path C source로 사용 금지 |

## 공개 페이지 probe 결과

### https://biocom.kr/shop_view/?idx=198

- loaded: YES
- blocked third-party/platform host count: 10

| source | present | type |
|---|---:|---|
| `dataLayer.member_code` | NO | undefined |
| `dataLayer.hurdlers_ga4.member_code` | NO | undefined |
| `dataLayer.hurdlers_ga4.memberCode` | NO | undefined |
| `localStorage.__bs_imweb.memberCode` | NO | undefined |
| `localStorage.__bs_imweb.member_code` | NO | undefined |
| `sessionStorage.__bs_imweb_session.memberCode` | NO | undefined |
| `sessionStorage.__bs_imweb_session.member_code` | NO | undefined |
| `window.imweb.user.member_code` | NO | undefined |
| `window.imweb.user.memberCode` | NO | undefined |
| `window.IMWEB_MEMBER_CODE` | NO | undefined |
| `window.hurdlers_member_code` | NO | undefined |
| `window.hurdlers_ga4.member_code` | NO | undefined |
| `window.hurdlers_ga4.memberCode` | NO | undefined |
| `window.MEMBER_UID` | NO | string |
| `window.MEMBER_HASH` | NO | string |
| `window.SITE_MEMBER.member_code` | NO | undefined |
| `window.SITE_MEMBER.memberCode` | NO | undefined |
| `window.SITE_MEMBER.member_uid` | NO | undefined |
| `window.SITE_MEMBER.memberUid` | NO | undefined |

Object shapes:
- `localStorage.__bs_imweb`: present / keys=commonSessionId, commonSessionUpdatedAt, customSessionId, customSessionUpdatedAt, deviceId, deviceIdCreatedAt, landingUrl, siteCode, unitCode
- `sessionStorage.__bs_imweb_session`: present / keys=browserSessionId, commonSessionId, commonSessionUpdatedAt, customSessionId, customSessionUpdatedAt, initialReferrer, initialReferrerDomain, platform, referrer, sdkJwt, updatedAt, utmCampaign, utmContent, utmLandingUrl, utmMedium, utmSource, utmTerm, utmUpdatedTime
- `window.hurdlers_ga4`: present / keys=product_code, product_discount, product_id, product_name, product_price
- `window.imweb.user`: absent / keys=-
- `window.SITE_MEMBER`: present / keys=changeCountry, changePassword, checkRequireOption, clearOAuthData, createRecommendCode, disconnectOAuth, editProfile, findSubmit, getSiteMemberCustomData, goodbye, init, initFindId, initJoinForm, isDialogOpen, itemFileUpload, joinSubmit, joinSubmitByAgree, joinSubmitByJoinPattern, kakaoSyncJoin, nachocodeNativeSocialLogin, openAgreeSocialJoin, openAppAction, openCOMBINATIONAUTHTYPESWindow, openChangePassword, openDRMOKWindow, openDreamSecurityV2ForAdult, openDreamSecurityV2ForFindId, openDreamSecurityV2Window, openFindPassword, openGoodbye, openGuestLogin, openINICISWindow, openInactive, openJoin, openJoinPatternChoice, openJoinTypeChoice, openJoinWithoutTerms, openLogin, openLoginOrModifyDialogByLoginStatus, openMOBILIANSWindow, openMOBILIANSWindow2, openSocialJoin, sendJoinMailAuth, setSyncJoinInterLock, showJoinForm, showMemberProfile, step, unauthMemberModal, updateFindIdStatus
- `window.IMWEB_LOCALSTORAGE`: present / keys=clear, get, init, remove, set
- `window.IMWEB_SESSIONSTORAGE`: present / keys=clear, get, init, remove, set

### https://biocom.kr/HealthFood/?idx=386

- loaded: YES
- blocked third-party/platform host count: 10

| source | present | type |
|---|---:|---|
| `dataLayer.member_code` | NO | undefined |
| `dataLayer.hurdlers_ga4.member_code` | NO | undefined |
| `dataLayer.hurdlers_ga4.memberCode` | NO | undefined |
| `localStorage.__bs_imweb.memberCode` | NO | undefined |
| `localStorage.__bs_imweb.member_code` | NO | undefined |
| `sessionStorage.__bs_imweb_session.memberCode` | NO | undefined |
| `sessionStorage.__bs_imweb_session.member_code` | NO | undefined |
| `window.imweb.user.member_code` | NO | undefined |
| `window.imweb.user.memberCode` | NO | undefined |
| `window.IMWEB_MEMBER_CODE` | NO | undefined |
| `window.hurdlers_member_code` | NO | undefined |
| `window.hurdlers_ga4.member_code` | NO | undefined |
| `window.hurdlers_ga4.memberCode` | NO | undefined |
| `window.MEMBER_UID` | NO | string |
| `window.MEMBER_HASH` | NO | string |
| `window.SITE_MEMBER.member_code` | NO | undefined |
| `window.SITE_MEMBER.memberCode` | NO | undefined |
| `window.SITE_MEMBER.member_uid` | NO | undefined |
| `window.SITE_MEMBER.memberUid` | NO | undefined |

Object shapes:
- `localStorage.__bs_imweb`: present / keys=commonSessionId, commonSessionUpdatedAt, customSessionId, customSessionUpdatedAt, deviceId, deviceIdCreatedAt, landingUrl, siteCode, unitCode
- `sessionStorage.__bs_imweb_session`: present / keys=browserSessionId, commonSessionId, commonSessionUpdatedAt, customSessionId, customSessionUpdatedAt, initialReferrer, initialReferrerDomain, platform, referrer, sdkJwt, updatedAt, utmCampaign, utmContent, utmLandingUrl, utmMedium, utmSource, utmTerm, utmUpdatedTime
- `window.hurdlers_ga4`: present / keys=product_code, product_discount, product_id, product_name, product_price
- `window.imweb.user`: absent / keys=-
- `window.SITE_MEMBER`: present / keys=changeCountry, changePassword, checkRequireOption, clearOAuthData, createRecommendCode, disconnectOAuth, editProfile, findSubmit, getSiteMemberCustomData, goodbye, init, initFindId, initJoinForm, isDialogOpen, itemFileUpload, joinSubmit, joinSubmitByAgree, joinSubmitByJoinPattern, kakaoSyncJoin, nachocodeNativeSocialLogin, openAgreeSocialJoin, openAppAction, openCOMBINATIONAUTHTYPESWindow, openChangePassword, openDRMOKWindow, openDreamSecurityV2ForAdult, openDreamSecurityV2ForFindId, openDreamSecurityV2Window, openFindPassword, openGoodbye, openGuestLogin, openINICISWindow, openInactive, openJoin, openJoinPatternChoice, openJoinTypeChoice, openJoinWithoutTerms, openLogin, openLoginOrModifyDialogByLoginStatus, openMOBILIANSWindow, openMOBILIANSWindow2, openSocialJoin, sendJoinMailAuth, setSyncJoinInterLock, showJoinForm, showMemberProfile, step, unauthMemberModal, updateFindIdStatus
- `window.IMWEB_LOCALSTORAGE`: present / keys=clear, get, init, remove, set
- `window.IMWEB_SESSIONSTORAGE`: present / keys=clear, get, init, remove, set

## 판단

- `localStorage.__bs_imweb` / `sessionStorage.__bs_imweb_session`는 device/session/UTM 용도로는 쓸 수 있지만, 현재 관측된 구조에서는 memberCode가 없다.
- `Retous - [맞춤] memberCode`는 `localStorage.__bs_imweb.memberCode`를 읽지만, 실제 이벤트에서 empty였다.
- `memberCode` / `RETOUS - [변수] member_code`는 `dataLayer.member_code`를 읽지만, 실제 이벤트에서 empty였다.
- `window.MEMBER_UID` / `window.MEMBER_HASH` key는 공개 페이지에 존재하지만 empty string이다. `window.SITE_MEMBER`는 member data가 아니라 회원 UI method object로 관측됐다.
- `HURDLERS - [맞춤 JS] user_id`는 이메일형 값이라 사용 금지다.

## 다음 액션

1. client-side wrapper Production publish는 HOLD한다.
2. Path C를 계속하려면 Imweb body/checkout template에서 raw를 저장하지 않고 server HMAC만 남기는 controlled TEST 설계를 별도 승인안으로 분리한다.
3. 빠른 우회로는 Path B, 즉 주문/결제완료 서버 원장 기반 bridge를 설계하는 것이다. 이 경우 click-time member_code가 아니라 order sync 이후 deterministic bridge를 쓴다.
4. 대체 client identifier를 보려면 TJ님 로그인 세션에서 `window.MEMBER_UID` / `window.MEMBER_HASH`가 non-empty인지 raw 값 없이 present/type만 추가 확인한다.
5. 이메일/전화 기반 bridge는 별도 개인정보/PII 승인 전까지 쓰지 않는다.
