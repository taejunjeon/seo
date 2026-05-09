# Path C wrapper Preview 결과

작성 시각: 2026-05-08 19:33:30 KST
최종 업데이트: 2026-05-08 20:06:25 KST
대상: GTM Preview only / Path C member_code_hash availability
Status: hold_no_client_member_code_source_found
Do not use for: GTM Production publish, Imweb production body save, backend deploy, platform send

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - gdn/path-c-member-code-wrapper-preview-approval-20260508.md
    - total/!total-current.md
  lane: Yellow Preview execution
  allowed_actions:
    - GTM fresh workspace create/delete for Preview
    - Preview-only Custom HTML tag
    - TEST click id no-send receiver smoke
  forbidden_actions:
    - GTM Production publish
    - Imweb production body/footer save
    - raw member_code network payload
    - backend deploy
    - platform send
  source_window_freshness_confidence:
    source: "GTM quick_preview + Playwright + no-send receiver https://att.ainativeos.net/api/attribution/paid-click-intent/no-send + TJ Tag Assistant screenshots/text + GTM API read-only variable definitions + source discovery"
    window: "2026-05-08 19:04:39~20:06:25 KST"
    freshness: "automated Preview executed 2026-05-08 19:04:39 KST; manual login/NPay click evidence received 2026-05-08 19:21~19:33 KST; GTM variable read-only checked 2026-05-08 19:23:58 KST; source discovery checked 2026-05-08 20:06:25 KST"
    confidence: 0.90
```

## 한 줄 결론

비로그인 공개 페이지 기준 GTM Preview와 payload safety는 통과했다. 하지만 TJ님 로그인 NPay 클릭의 200/201/203 이벤트와 추가 source 재탐색에서 usable client-side `member_code` source는 발견되지 않았다. 이메일형 `user_id`는 Path C에 사용할 수 없다. 따라서 wrapper Production publish와 backend deploy는 HOLD이고, 다음은 controlled Imweb/body source test 또는 server/order bridge 설계다.

## 이번 Preview가 말하는 것

- GTM fresh workspace의 Preview tag가 실행되는지.
- `TEST_GCLID_PATHC_PREVIEW_20260508`만 사용했는지.
- payload에 raw member_code, PII, order/payment/value가 없는지.
- no-send receiver가 응답하고 `ledger.stored`가 없는지.
- 비로그인 공개 페이지에서 member_code source가 비어 있는지.
- 기존 NPay 구매하기 클릭에서 Google Ads/GA4/ChannelTalk 계열 기존 태그가 발화되는지.
- GTM Default Workspace에 member_code 후보 변수가 정의돼 있는지.
- 현재 후보 경로 밖 공개 페이지 storage/global에도 usable member_code source가 없는지.

## 이번 Preview가 말하지 않는 것

- `PathC_member_code_hash_preview_no_send` 태그가 로그인 세션에서 `member_code_hash`만 담아 no-send receiver로 보냈는지.
- Production publish 후 live traffic에서 hash가 채워지는지.
- 구매 매칭 개선 효과 또는 Google Ads ROAS gap 개선 여부.

## 결과 요약

| 항목 | 값 |
|---|---:|
| cases | 2 |
| payload_count | 6 |
| raw_member_code_payload | NO |
| forbidden_payload_key | NO |
| live_click_id_used | NO |
| receiver_reached_all | YES |
| ledger_stored_any | NO |
| Production publish | 0 |
| Preview workspace cleanup | YES |

추가 확인: 2026-05-08 19:05 KST GTM workspace list read-only 확인 결과, Preview workspace `162`는 남아 있지 않고 Default Workspace `147`만 남았다.

## TJ님 수동 확인 반영

2026-05-08 19:21 KST, TJ님이 Tag Assistant를 켜고 로그인 상태에서 NPay 구매하기 버튼을 클릭했다. 실제 결제는 하지 않았고 NPay 주문/결제 창 도달까지만 확인했다.

- 199번 이후가 NPay 구매하기 클릭 이후 흐름이다.
- `gtm.linkClick` 이벤트에서 기존 `TechSol - [GAds]NPAY구매 51163` Google Ads 전환 추적 태그와 `HURDLERS - [데이터레이어] 네이버페이 구매 (제품상세)` 태그가 발화됐다.
- `h_add_payment_info` 이벤트에서 기존 `HURDLERS - [이벤트전송] 네이버페이 구매` GA4 이벤트 태그가 발화됐다.
- `conversion` 이벤트에서 기존 `GA4_구매전환_Npay`와 `채널톡_구매전환`이 발화됐다.
- 위 태그 발화는 Path C 성공이 아니다. 오히려 현재 문제인 "NPay 클릭/결제시작 단계가 구매 전환처럼 보일 수 있음"을 다시 보여주는 증거다.
- 이번 수동 확인에서 결제완료는 없었다. 따라서 이 흐름을 confirmed purchase uplift나 실제 매출 연결 개선으로 해석하지 않는다.

2026-05-08 19:33 KST, TJ님이 200 `gtm.linkClick`, 201 `h_add_payment_info`, 203 `conversion` 이벤트의 변수 탭 텍스트를 공유했다. raw 이메일형 값은 문서에 저장하지 않는다.

- 200/201/203 모두 `memberCode`, `Retous - [변수] memberCode`, `RETOUS - [변수] member_code`, `Retous - [맞춤] memberCode`가 `undefined` 또는 empty로 확인됐다.
- `JS - Imweb Data Layer` object는 존재했지만 공유된 구조에는 `memberCode`/`member_code` 필드가 없었다. 보인 것은 device/session/site 계열 값이다.
- `HURDLERS - [맞춤 JS] user_id`는 이메일형 값이 확인됐다. Path C source로 사용 금지다.
- `phone_buy`, `email_buy`는 현재 캡처에서 undefined였지만, 값이 생기더라도 Path C source로 사용 금지다.
- 결론: 현재 GTM/Retous/Hurdlers 변수만으로는 usable member_code source가 없다.

## GTM 변수 후보 read-only 확인

2026-05-08 19:23:58 KST, GTM API read-only로 Default Workspace `147` 변수를 확인했다. raw 값은 조회하지 않았고 변수 정의만 확인했다.

| 변수명 | GTM type | 읽는 위치 | Path C 사용 판단 |
|---|---|---|---|
| `memberCode` | Data Layer Variable | `member_code` | 후보 |
| `Retous - [변수] memberCode` | Data Layer Variable | `hurdlers_ga4.member_code` | 후보 |
| `RETOUS - [변수] member_code` | Data Layer Variable | `member_code` | 후보 |
| `Retous - [맞춤] memberCode` | Custom JS | `localStorage.__bs_imweb.memberCode` | 후보 |
| `phone_buy`, `email_buy` | Custom JS | checkout form 값 | Path C 사용 금지 |
| `HURDLERS - [맞춤 JS] user_id` | Custom JS | `.email-info` | Path C 사용 금지 |

판정: 회원 코드 후보 변수 정의는 존재하지만, 로그인 NPay 클릭 200/201/203 이벤트에서는 모두 값이 비어 있었다. 현재 변수 정의만으로는 Path C wrapper를 Production publish할 수 없다.

## Source 재탐색 결과

2026-05-08 20:06 KST, GTM Default Workspace read-only와 공개 페이지 storage/global probe를 실행했다. 결과는 [[path-c-member-code-source-discovery-20260508]]에 저장했다.

- 판정: `hold_no_client_member_code_source_found`.
- 공개 페이지 후보 19개 모두 absent: `dataLayer.member_code`, `dataLayer.hurdlers_ga4.member_code`, `localStorage.__bs_imweb.memberCode`, `sessionStorage.__bs_imweb_session.memberCode`, `window.imweb.user.member_code`, `window.IMWEB_MEMBER_CODE`, `window.hurdlers_member_code`, `window.hurdlers_ga4.member_code`, `window.MEMBER_UID`, `window.MEMBER_HASH`, `window.SITE_MEMBER.member_code` 등.
- `localStorage.__bs_imweb`와 `sessionStorage.__bs_imweb_session`는 존재했지만 device/session/UTM key만 있었다.
- `window.hurdlers_ga4`는 상품 정보 key만 있었고 member code key는 없었다.
- `window.imweb.user`는 공개 페이지 probe에서 absent였다.
- `window.MEMBER_UID`와 `window.MEMBER_HASH` key는 공개 페이지에 있었지만 empty string이었다. 로그인 세션에서 non-empty인지 여부는 별도 확인이 필요하다.
- TJ님 로그인 200/201/203 증거와 합치면, 현재 GTM/Retous/Hurdlers/Imweb browser 경로로는 Path C용 회원코드를 얻지 못한다.

## 케이스별 결과

| case | loaded | source_present | payloads | stages | receiver | ledger_stored |
|---|---:|---:|---:|---|---:|---:|
| anonymous_product_healthfood_386 | YES | NO | 3 | page_view, checkout_start, npay_intent | YES | NO |
| anonymous_product_dietmealbox_423 | YES | NO | 3 | page_view, checkout_start, npay_intent | YES | NO |

## 다음 액션

1. 현재 GTM 변수 기반 wrapper Production publish는 HOLD한다. 200/201/203과 source 재탐색 모두 usable member_code 값이 없기 때문이다.
2. Path C를 계속하려면 Imweb body/checkout template에서 회원코드 source가 가능한지 controlled TEST 승인안을 따로 만든다. raw 저장/로그 없이 server HMAC만 허용한다.
3. 더 빠른 우회는 server/order bridge 설계다. click-time browser source가 아니라 주문/결제완료 서버 원장에서 deterministic bridge를 만든다.
4. 대체 client identifier를 보려면 TJ님 로그인 세션에서 `window.MEMBER_UID` / `window.MEMBER_HASH`가 non-empty인지 raw 값 없이 present/type만 확인한다.
5. 계속 금지: `user_id` 이메일값, `phone_*`, `email_*`를 Path C source로 사용하지 않는다.
