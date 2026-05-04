# biocom GTM 컨테이너 품질 경고 진단

작성 시각: 2026-05-05 20:35 KST
대상: biocom.kr GTM 컨테이너 `GTM-W2Z6PHN`
문서 성격: GTM UI의 컨테이너 품질 경고, 충돌, 태그 누락, Google tag gateway 추천에 대한 read-only 진단
관련 문서: [[GA4/gtm]], [[GA4/gtm-engagement-internal-analysis-design-20260504]], [[GA4/gtm-tag-coverage-ignore-candidates-20260505]], [[GA4/gtm-aw308433248-upde-pause-approval-20260505]], [[GA4/gtm-aw308433248-upde-pause-result-20260505]], [[naver/npay-intent-live-publish-approval-20260427]], [[capivm/googleadstictok]], [[docurule]]
Lane: Green documentation and read-only diagnosis
Mode: No-send / No-write / No-deploy / No-publish / No-platform-send

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
  required_context_docs:
    - GA4/gtm.md
    - GA4/gtm-engagement-internal-analysis-design-20260504.md
    - naver/npay-intent-live-publish-approval-20260427.md
    - capivm/googleadstictok.md
  lane: Green
  allowed_actions:
    - GTM API read-only status check
    - public page source check
    - official Google docs review
    - documentation
  forbidden_actions:
    - GTM workspace save
    - GTM conflict resolve
    - GTM Preview execution
    - GTM Production publish
    - Google tag gateway setup
    - Imweb header/footer edit
    - external platform conversion send
  source_window_freshness_confidence:
    gtm_api:
      source: Google Tag Manager API v2
      window: live version 140, Default Workspace 147
      freshness: fresh as of 2026-05-05 20:35 KST
      confidence: 0.93
    public_html_probe:
      source: public biocom.kr page source fetch
      window: 2026-05-05 20:35 KST
      freshness: point-in-time
      confidence: 0.86
    google_docs:
      source: official Google help/developer docs
      window: docs opened 2026-05-05 KST
      freshness: current official docs
      confidence: 0.90
```

## 10초 요약

GTM 화면의 “충돌 발견”은 live 장애가 아니라 Default Workspace 147이 오래된 상태로 남아 있기 때문에 생긴 작업공간 충돌이다.
live version 140에는 NPay intent beacon이 이미 정상 반영되어 있고, 핵심 구매 중복 방지 태그 상태도 유지되어 있다.
따라서 Default Workspace 147은 저장/게시하면 안 된다.

“Google 태그 누락 1개”는 `AW-308433248` 쪽으로 추정한다.
live v140에는 `UPDE_register`와 `UPDE_purchase`가 `Ads ID=308433248`를 쓰지만, 그에 대응하는 `Google 태그 AW-308433248`가 없다.
반면 `AW-304339096` Google 태그와 conversion linker는 있다.
2026-05-05 TJ 확인 기준 `AW-304339096`가 현재 사용하는 바이오컴 Google Ads 계정이고, 더클린커피와 AIBIO도 `AW-308433248`를 쓰지 않는다.
따라서 `AW-308433248` Google 태그를 새로 추가하지 않는다.
정답은 `[200] UPDE_register`, `[204] UPDE_purchase`, variable `[199] Ads ID=308433248` 계열을 비정본/잔존 태그로 보고 정리하는 것이다.

“일부 페이지 태그 누락”은 현재 보이는 샘플 대부분이 admin, login, 404, 내부/비고객 URL이다.
홈, 상품, 장바구니, 결제완료 대표 URL에는 `GTM-W2Z6PHN`, `G-WJFXN5E2Q1`, `AW-304339096`가 확인됐다.
다만 전체 27개 untagged URL CSV를 내려받아 상품/결제/광고 랜딩이 섞였는지 확인해야 한다.

2026-05-05 01:16 KST 기준 `[200]`, `[204]` pause가 live v141로 반영됐다.
상세 결과는 [[GA4/gtm-aw308433248-upde-pause-result-20260505]]에 기록했다.

Google tag gateway는 중기 후보지만 지금 1순위가 아니다.
이 기능은 Google 태그를 자사 도메인/인프라로 로드해 Google 측정 신호를 보강하는 기능이다.
하지만 Meta CAPI, stale workspace, AW-308433248 누락, 태그 적용 범위 문제를 대신 해결하지 않는다.

## Read-only 확인 결과

### live 컨테이너

- container: `accounts/4703003246/containers/13158774`
- public id: `GTM-W2Z6PHN`
- live version: `140`
- version name: `tiktok_marketing_intent_v1_live_20260503`
- live tags: 58개
- live triggers: 84개
- live variables: 60개

핵심 구매 관련 태그 상태:

- `[143] HURDLERS - [이벤트전송] 구매`: active, eventName=`purchase`
- `[48] GA4_구매전환_홈피구매`: paused, eventName=`purchase`
- `[43] GA4_구매전환_Npay`: active, eventName=`add_payment_info`
- `[118] HURDLERS - [데이터레이어] 네이버페이 구매 (제품상세)`: active, NPay intent beacon 있음, `ENVIRONMENT="live"` 있음

해석:

- v138의 중복 purchase 방지 조치는 live v140에서도 유지된다.
- v139의 NPay intent beacon도 live v140에서 유지된다.
- 현재 live 장애 증거는 없다.

### Default Workspace 147 충돌

GTM API `workspaces.getStatus` 결과:

- workspace: `147`
- name: `Default Workspace`
- changeCount: 1
- conflictCount: 1
- changed entity: tag `[118] HURDLERS - [데이터레이어] 네이버페이 구매 (제품상세)`
- workspace tag 118 fingerprint: `1777280570000`
- live tag 118 fingerprint: `1777280990939`
- workspace notes:
  - `2026-04-27 12:56 KST: Codex appended NPay intent beacon ... Preview only; no live publish.`
  - `2026-04-27 13:30 KST: Codex moved beacon helper functions outside try block ... Preview only; no live publish.`

해석:

- UI의 “충돌 해결” 화면은 이 1건 때문에 뜬다.
- 이 workspace는 2026-04-27 NPay intent 작업 당시 publish하지 않은 stale workspace다.
- 당시에도 Default Workspace 147을 publish하면 v138 구매 중복 방지 조치가 rollback될 위험이 있어서, live v138 기준 새 workspace 150을 만들어 tag 118만 publish했다.
- 현재도 같은 원칙이 유효하다. Default Workspace 147을 기준으로 저장/제출/게시하면 안 된다.

권장 처리:

1. Default Workspace 147의 tag 118 JSON과 현재 status를 백업한다.
2. tag 118 변경이 live v140에 이미 반영되어 있으므로, Default Workspace 147 변경은 폐기한다.
3. 이후 새 GTM 작업은 live v140 기준 새 workspace에서 시작한다.

주의:

- 위 처리는 GTM workspace write이므로 Yellow Lane이다.
- Codex가 API로 할 수는 있지만, 실제 workspace 변경은 TJ 승인 후 진행해야 한다.

## Google 태그 누락 진단

GTM live v140에서 확인한 active Google 계열 태그:

- `[38] GA4_픽셀`: `googtag`, `G-WJFXN5E2Q1`, active
- `[97] [new]Google 태그`: `googtag`, `G-8GZ48B1S59`, active
- `[169] Google 태그 AW-304339096`: `googtag`, `AW-304339096`, active
- `[15] AW전환링커`: `gclidw`, active

Google Ads/UPD 계열 이벤트:

- `[17] tmp_바이오컴 장바구니`: `awct`, `conversionId=304339096`
- `[210] 구글애즈 회원가입`: `awct`, `conversionId=304339096`
- `[248] TechSol - [GAds]NPAY구매 51163`: `awct`, `conversionId=304339096`
- `[200] UPDE_register`: `awud`, `conversionId={{Ads ID}}`
- `[204] UPDE_purchase`: `awud`, `conversionId={{Ads ID}}`
- variable `[199] Ads ID`: `308433248`

판단:

- `AW-304339096`에 대해서는 matching Google tag가 있다.
- `AW-308433248`에 대해서는 matching Google tag가 없다.
- Google 공식 Tag Diagnostics 문서의 “Missing Google tags” 정의와 일치한다. 이벤트 태그에 대응하는 Google tag가 없으면 이 경고가 뜰 수 있다.
- 2026-05-05 TJ 확인 기준 `AW-308433248`는 biocom, thecleancoffee, AIBIO 운영 Google Ads 계정이 아니다.

수정 방향 후보:

1. `AW-308433248`가 아직 사용하는 Google Ads 계정이면 `Google 태그 AW-308433248`를 Initialization - All Pages로 추가한다.
2. `AW-308433248`가 과거/대행사/비정본 계정이면 `[200] UPDE_register`, `[204] UPDE_purchase`, variable `[199] Ads ID`를 정리한다.
3. 만약 기능 자체가 현재 `AW-304339096` 운영 계정에 필요하다면 기존 태그를 단순 치환하지 않고, conversion label, trigger, value, transaction_id, user data consent를 새 정본 태그로 재설계한다.
4. 확정 전에는 새 Google tag를 추가하지 않는다. 광고 계정이 잘못된 상태에서 Google tag를 추가하면 비정본 Google Ads 계정에 신호를 더 보낼 수 있다.

추천:

- `AW-308433248` Google tag를 추가하지 않는다.
- `[200] UPDE_register`, `[204] UPDE_purchase`를 pause 후보로 둔다.
- variable `[199] Ads ID`는 즉시 삭제하지 않고, 먼저 사용 태그가 0개가 되는지 확인한 뒤 후속 cleanup으로 둔다.
- `Ads ID`를 `304339096`로 바꾸는 방식은 추천하지 않는다. 이미 `AW-304339096` 계열 conversion tag가 있으므로 중복 또는 의도치 않은 Enhanced Conversion 전송이 생길 수 있다.
- 실제 GTM pause/publish는 별도 승인 후 fresh workspace에서만 진행한다.

### 2026-05-05 UPDE 308433248 read-only 상세

Codex가 GTM API v2 read-only로 live version `140`을 재확인했다.
GTM API는 태그 설정과 active 상태는 보여주지만, 실제 브라우저 런타임에서 몇 번 발화했는지는 제공하지 않는다.
따라서 아래의 “발화”는 runtime count가 아니라 “해당 조건을 만족하면 발화하도록 live에 active로 배포되어 있음”을 뜻한다.
실제 런타임 발화 여부까지 확인하려면 Tag Assistant/GTM Preview가 필요하며, 이는 별도 승인 전에는 실행하지 않는다.

`[200] UPDE_register`:

- type: `awud`
- live 상태: active
- firing trigger: `[198] 가입하기 버튼`
- trigger 조건: `Click Text contains 가입하기` and `Page Path contains /site_join`
- conversionId: `{{Ads ID}}` -> variable `[199] Ads ID=308433248`
- user data variable: `[197] UPDE_reg_em_pn`
- user data field: `phone_number={{phone_reg}}`, `email={{email_reg}}`
- conversion label: 없음
- value/currency: 없음
- transaction_id/orderId: 없음

`[204] UPDE_purchase`:

- type: `awud`
- live 상태: active
- firing trigger: `[203] 결제하기 버튼`
- trigger 조건: `Click Classes contains css-2hoj89` and `Page Path equals /shop_payment/`
- conversionId: `{{Ads ID}}` -> variable `[199] Ads ID=308433248`
- user data variable: `[202] UPDE_buy_em_pn`
- user data field: `phone_number={{phone_buy}}`, `email={{email_buy}}`
- conversion label: 없음
- value/currency: 없음
- transaction_id/orderId: 없음

`[199] Ads ID`:

- type: constant variable
- value: `308433248`
- live v140에서 이 변수를 쓰는 태그: `[200] UPDE_register`, `[204] UPDE_purchase` 2개

현재 `AW-304339096` 운영 계정의 주요 Google Ads 태그:

- `[169] Google 태그 AW-304339096`: `googtag`, Initialization - All Pages, active
- `[15] AW전환링커`: conversion linker, All Pages, active
- `[17] tmp_바이오컴 장바구니`: `awct`, `conversionId=304339096`, `conversionLabel=QuHkCL7utYoDEJixj5EB`, trigger `[16] 장바구니 트리거`
- `[210] 구글애즈 회원가입`: `awct`, `conversionId=304339096`, `conversionLabel=A84hCP3lt4oDEJixj5EB`, trigger `[46] 회원가입 트리거`
- `[248] TechSol - [GAds]NPAY구매 51163`: `awct`, `conversionId=304339096`, `conversionLabel=3yjICOXRmJccEJixj5EB`, `conversionValue`, `orderId`, `currency=KRW` 있음

중복/오염 위험:

- `[200]`을 `304339096`으로 단순 치환하면 `[210] 구글애즈 회원가입`과 목적이 겹칠 수 있다. `[210]`은 `/welcome` 완료 이벤트 기준이고, `[200]`은 `/site_join`의 “가입하기” 클릭 기준이라 완료 전 intent가 운영 전환 또는 user data 신호로 섞일 위험이 있다.
- `[204]`를 `304339096`으로 단순 치환하면 구매 완료가 아니라 `/shop_payment/`의 “결제하기” 버튼 클릭 시점 신호가 운영 Google Ads에 들어갈 수 있다. value, transaction_id, orderId가 없어서 confirmed purchase 정합성에 도움이 되지 않는다.
- 두 태그 모두 conversion label이 없으므로 현재 `AW-304339096`의 구체 전환 액션과 1:1로 매핑된 정본 태그로 볼 수 없다.

정리안:

- 1차 조치: `[200] UPDE_register`, `[204] UPDE_purchase`를 legacy/non-canonical으로 보고 pause한다. 이 조치는 2026-05-05 live v141에서 완료됐다.
- 삭제 후보: pause 후 7~14일 동안 필요한 운영 기능이 없고 `[199]`, `[197]`, `[202]`, `[198]`, `[203]` 참조가 남지 않으면 후속 cleanup에서 삭제 후보로 둔다.
- 재설계 후보: enhanced conversion 또는 user-provided data가 `AW-304339096`에 실제 필요하면 기존 태그를 치환하지 말고, 정본 conversion label, 완료 기준 trigger, value/transaction_id/orderId, consent 기준을 새 태그로 설계한다.
- 금지: `Ads ID=308433248`를 `304339096`로 단순 치환하지 않는다.

### 2026-05-05 pause 실행 결과

- 승인: TJ님 `pause 진행해`
- fresh workspace: `[152] codex_pause_aw308433248_upde_20260504161442`
- published version: `[141] pause_aw308433248_upde_20260505`
- live before: `[140] tiktok_marketing_intent_v1_live_20260503`
- live after: `[141] pause_aw308433248_upde_20260505`
- 변경 entity: `[200] UPDE_register`, `[204] UPDE_purchase`
- Default Workspace 147: 변경 없음
- quick_preview/create_version/publish compiler error: 없음
- 결과 문서: [[GA4/gtm-aw308433248-upde-pause-result-20260505]]

## 태그 적용 범위 경고

GTM UI 스크린샷 기준:

- 포함된 페이지: 669
- 태그되지 않음: 27
- 최근 데이터 없음: 70
- 태그됨: 572

화면에 보인 untagged URL 샘플:

- `biocom.imweb.me/admin/`
- `biocom.imweb.me/backpg/login.cm`
- `biocom.kr/__bo-analytics-marketing-performance/`
- `biocom.kr/1498095193/`
- `biocom.kr/5ive__stars`
- `biocom.kr/에서`
- `biocom.kr/admin/booking/order_cal`
- `biocom.kr/admin/config/domain`
- `biocom.kr/admin/config/localize`
- `biocom.kr/admin/config/membership`
- `biocom.kr/admin/member/kakao_friend/send`
- `biocom.kr/admin/promotion/coupon`

Codex가 public HTML로 직접 확인한 대표 URL:

- `https://biocom.kr/`: GTM 있음, GA4 정본 있음, `AW-304339096` 있음
- `https://biocom.kr/DietMealBox/?idx=423`: GTM 있음, GA4 정본 있음, `AW-304339096` 있음
- `https://biocom.kr/shop_cart`: GTM 있음, GA4 정본 있음, `AW-304339096` 있음
- `https://biocom.kr/shop_payment_complete`: GTM 있음, GA4 정본 있음, `AW-304339096` 있음
- `https://biocom.kr/__bo-analytics-marketing-performance/`: 404, GTM 없음
- `https://biocom.kr/1498095193/`: 404, GTM 없음
- `https://biocom.kr/5ive__stars`: 404, GTM 없음
- `https://biocom.kr/admin/config/domain`: admin page, GTM 없음
- `https://biocom.imweb.me/backpg/login.cm`: login page, GTM 없음

판단:

- 현재 보이는 샘플만 보면 고객 구매 퍼널 누락이라기보다 admin/404/내부 URL이 Tag Coverage에 잡힌 것으로 보인다.
- Google Tag Coverage 문서도 low traffic, redirect, URL 변형이 false positive가 될 수 있고, 관련 없는 페이지는 ignore할 수 있다고 설명한다.
- 하지만 전체 27개 목록을 봐야 최종 판단할 수 있다.

처리 기준:

- 상품 상세, 장바구니, 주문서, 결제완료, 광고 랜딩이 untagged면 High priority로 수정한다.
- admin, login, 404, 내부 분석 URL, 오타 URL이면 ignore 후보로 둔다.
- `biocom.imweb.me` 서브도메인이 고객에게 노출되는 실제 랜딩이면 도메인 설정을 확인하고, 내부 관리용이면 ignore 후보로 둔다.

### 2026-05-05 Tag Coverage CSV 분류 결과

TJ님이 제공한 CSV:

- `/Users/vibetj/Downloads/tag-coverage-GTM-W2Z6PHN.csv`

CSV 전체 요약:

- 전체 URL row: 737개
- `Tagged`: 573개
- `Not tagged`: 93개
- `No recent data`: 71개
- `Landing page=Yes`: 48개
- `Landing page=Yes` 중 `Not tagged`: 0개

해석:

- 광고 랜딩으로 표시된 URL은 모두 tagged다.
- 고객 퍼널 핵심 URL인 홈, 상품 상세, 장바구니, 결제/결제완료 계열은 CSV와 public fetch 기준 tagged다.
- `Not tagged` 93개 중 66개는 이미 `Ignored=Yes`다.
- 실질 확인 대상은 `Ignored=No`인 27개다.

Codex가 27개를 public fetch로 재확인한 결과:

- 3개는 현재 HTML fetch 기준 GTM/GA4/AW-304339096가 모두 있다. Google Tag Coverage 지연 또는 false positive로 본다.
  - `biocom.kr/arang-self-prai`
  - `biocom.kr/arang-self-text`
  - `www.biocom.kr/site_join_pattern_choice` → `www.biocom.kr/site_join_type_choice?back_url=`로 이동
- 6개는 404다.
  - `biocom.kr/%EC%97%90%EC%84%9C`
  - `biocom.kr/1498095193/`
  - `biocom.kr/5ive__stars`
  - `biocom.kr/employeeshop/`
  - `biocom.kr/yeonddle`
  - `www.biocom.kr/event/`
- 14개는 admin/login/logout/coupon/admin-stat 계열이다.
- 3개는 Imweb backend/system endpoint다.
  - `biocom.kr/backpg/payment/oms/OMS_guest_login.cm`
  - `www.biocom.kr/backpg/payment/oms/OMS_guest_login.cm`
  - `biocom.kr/dialog/join.cm`
- 1개는 Imweb 내부 분석 endpoint다.
  - `biocom.kr/_/bo-analytics-marketing-performance/`

현재 판정:

- 고객 매출 퍼널 태그 누락: 확인되지 않음.
- 광고 랜딩 태그 누락: 확인되지 않음.
- 지금 해야 할 코드/GTM 수정: 없음.
- Tag Coverage 경고는 admin, 404, internal endpoint, already-fixed false positive가 섞인 품질 경고로 본다.
- ignore 후보 상세 목록은 [[GA4/gtm-tag-coverage-ignore-candidates-20260505]]에 분리했다.

권장 조치:

1. `Not tagged` 27개 중 admin/404/internal endpoint는 Google Tag Coverage에서 ignore 후보로 둔다. 실제 UI ignore는 선택이며 TJ님 승인 후 진행한다.
2. `arang-self-prai`, `arang-self-text`, `site_join_pattern_choice`는 Tag Assistant에서 한 번 더 확인한다. 이미 fetch 기준 태그가 있으므로 코드 수정은 하지 않는다.
3. `No recent data` 71개는 광고 랜딩이 아니므로 1차 후순위다. 오래된 URL이면 ignore 후보로 둔다.
4. 외부 도메인 row가 많이 섞여 있다. 도메인 구성에서 biocom 관련 도메인만 남기는 정리도 후속 후보지만, ROAS 정합성 1순위는 아니다.

## Google tag gateway 검토

공식 문서 기준 Google tag gateway for advertisers는 Google tag 또는 GTM container를 자사 도메인/자사 인프라로 배포하는 기능이다.
표준 설정에서는 페이지가 Google 도메인에서 태그를 요청하지만, gateway를 쓰면 웹사이트의 first-party domain으로 태그를 로드하고 일부 measurement request도 first-party domain을 통해 보낸다.

공식 문서가 요구하는 전제:

- 기존 Google tag 또는 GTM container가 있어야 한다.
- CDN, load balancer, web server처럼 외부 endpoint로 forwarding할 수 있는 인프라가 있어야 한다.
- Google tag settings, Google Cloud 또는 CDN 관리자 권한이 필요하다.
- GTM container publish 권한이 필요할 수 있다.

장점:

- Google Analytics/Google Ads 측정 신호 회복에 도움이 될 수 있다.
- Google Ads bidding, campaign optimization, ROAS 판단에 들어가는 Google 측 conversion measurement 품질을 보강할 수 있다.
- CDN/Cloudflare/GCLB 기반이면 setup path가 있다.

한계:

- Meta CAPI에는 직접 도움이 되지 않는다.
- TikTok Events API에도 직접 도움이 되지 않는다.
- `AW-308433248` Google tag 누락을 대신 해결하지 않는다.
- Default Workspace 147 충돌을 해결하지 않는다.
- 아임웹 admin/404 페이지가 Tag Coverage에 잡힌 문제를 해결하지 않는다.
- 월별 내부 channel revenue 분류, BigQuery raw join, ProductEngagementSummary 내부 장부를 대신 만들지 않는다.

우선순위:

1. Default Workspace 147 충돌을 정리한다.
2. `AW-308433248` UPDE 잔존 태그 pause 승인안을 만든다.
3. Tag Coverage 27개 URL 전체를 내려받아 고객 퍼널 URL이 있는지 분류한다.
4. 표준 funnel CAPI Test Events와 내부 engagement ledger Preview를 분리해서 준비한다.
5. Google tag gateway는 Google 계열 측정 품질 개선 후보로 별도 POC를 잡는다.

현재 추천:

- 지금 바로 Google tag gateway를 설정하지 않는다.
- 우선순위는 Medium-Low다.
- Google Ads/GA4 신호 회복에는 도움될 수 있으므로 버리지는 않는다.
- 다만 현재 tracking 정합성 blocker를 닫은 뒤, Cloudflare/GCLB/아임웹 CDN 가능성을 확인하고 진행한다.

## 공식 문서 근거

- Google Ads Help, Google tag gateway for advertisers:
  - https://support.google.com/google-ads/answer/16816376
  - 자사 도메인으로 Google tag 또는 GTM container를 배포하고, Google Cloud Load Balancer와 권한이 필요하다고 설명한다.
- Google for Developers, Google tag gateway setup guide:
  - https://developers.google.com/tag-platform/tag-manager/gateway/setup-guide
  - first-party infrastructure, CDN/load balancer/web server 전제가 있다고 설명한다.
- Google Tag Manager release notes:
  - https://support.google.com/tagmanager/answer/4620708
  - `Missing Google tags`, `Missing gtag config command`, `Your tag data may be restricted` 진단 항목이 추가됐다고 설명한다.
- Google Analytics Help, Tag Diagnostics:
  - https://support.google.com/analytics/answer/14681508
  - `Missing Google tags`는 GTM event tags에 matching Google tags가 없을 때 뜰 수 있다고 설명한다.
- Google Analytics Help, Tag Coverage:
  - https://support.google.com/analytics/answer/12270036
  - Tag Coverage status와 false positive/ignore 기준을 설명한다.

## 다음 할일

### Codex가 할 일

1. Google Tag Diagnostics 24시간 후 재확인
- 추천/자신감: 90%
- Lane: Green read-only
- 무엇을 하는가: `[200]`, `[204]` pause 이후 `Missing Google tags` 경고가 줄었는지 확인한다.
- 왜 하는가: `AW-308433248` 잔존 태그가 경고 원인이었는지 운영 화면에서 확인해야 한다.
- 어떻게 하는가: GTM/Google tag UI 또는 가능한 read-only 조회로 경고 상태를 기록한다.
- 성공 기준: 경고 해소 또는 남은 경고 원인 분리.
- 승인 필요: NO.

2. Tag Coverage ignore 후보 정리안 작성
- 추천/자신감: 86%
- Lane: Green
- 무엇을 하는가: 이미 분류한 admin/404/internal URL을 ignore 후보로 묶고, `arang-self-*`, `site_join_pattern_choice`만 재확인 대상으로 남긴다.
- 왜 하는가: Tag Coverage 숫자를 낮추기보다 고객 퍼널 누락 여부를 명확히 하는 것이 중요하다.
- 어떻게 하는가: CSV 분류 결과와 public fetch 결과를 바탕으로 ignore/확인/수정 필요로 나눈다.
- 성공 기준: 고객 퍼널 누락 0개 판정과 ignore 후보 목록 확정.
- 승인 필요: NO.

3. Google tag gateway POC 조건 정리
- 추천/자신감: 72%
- Lane: Green planning
- 무엇을 하는가: Cloudflare/GCLB/아임웹 환경에서 Google tag gateway를 쓸 수 있는지 전제 조건을 정리한다.
- 왜 하는가: Google 계열 측정 품질 개선에는 도움될 수 있지만 현재 1순위 blocker는 아니므로 무작정 설정하면 안 된다.
- 어떻게 하는가: 공식 문서 기준으로 필요 권한, DNS/CDN 조건, 예상 효과, 리스크를 분리한다.
- 성공 기준: 진행/보류 판단 가능한 체크리스트 완성.
- 승인 필요: 실제 gateway 설정 전 YES.

### TJ님이 할 일

1. UI 전용 경고가 남으면 캡처 제공
- 추천/자신감: 72%
- Lane: Green monitoring
- 무엇을 하는가: Google Tag Diagnostics나 Tag Assistant처럼 API로 직접 읽기 어려운 화면 경고가 계속 남으면 캡처를 제공한다.
- 왜 하는가: Google Ads 비용/전환/전환액은 Codex가 API로 볼 수 있지만, UI 전용 진단 문구는 화면 확인이 더 빠를 수 있다.
- 어떻게 하는가: Google tag/Tag Assistant 화면에서 `Missing Google tags`, `Tag coverage`, runtime firing 관련 경고가 남아 있으면 캡처한다.
- 성공 기준: 남은 경고 문구와 대상 tag/customer가 식별된다.
- Codex가 대신 못 하는 이유: 일부 UI는 로그인/2FA/브라우저 확장 화면이 필요할 수 있다. 단, Google Ads API 지표 모니터링은 Codex가 대신 가능하다.
- 승인 필요: NO.
