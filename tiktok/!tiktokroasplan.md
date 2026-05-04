# TikTok ROAS 정합성 프로젝트 로드맵

작성 시각: 2026-05-04 14:09 KST
기준일: 2026-05-04
버전: v3.28-events-api-shadow-rebuilt (이전본: `v3.27-events-api-canary-blocked`)

## 2026-05-04 최신 정정

TikTok Events API production canary 1건은 API 수신 자체는 성공했다. `HTTP 200`, `code=0`, `message=OK`였고 TikTok Diagnostics도 `No active issues`였다.

하지만 이 결과를 production 확대 근거로 쓰면 안 된다. 사후 재검산에서 후보 주문 `202605036519253`은 실제 주문별 기준으로 TikTok evidence가 없었다. VM `attribution_ledger.payment_success`에는 `ttclid=false`, TikTok UTM 없음, `firstTouch.tiktokMatchReasons=[]`, initial referrer `m.search.naver.com`로 남아 있었다.

원인은 shadow 후보 생성 로직이 전체 `marketing_intent` row를 넓게 훑어, 다른 사용자의 TikTok 클릭 흔적을 해당 주문 후보에 섞은 것이다. 로컬 코드는 수정했고 회귀 테스트도 추가했다. 이제 주문에 직접 연결된 payment/checkout/metadata evidence만 인정한다.

2026-05-04 14:09 KST 기준으로 shadow 후보를 새 로직으로 재생성했다. TJ 관리 Attribution VM SQLite에 `candidate_version=2026-05-04.shadow.rebuild.v2` 50건을 shadow-only로 upsert했고, 기존 `2026-05-03.shadow.v1` 17건은 backup table `tiktok_events_api_shadow_candidates_backup_20260504_rebuild_v2`에 보존했다.

새 결과는 더 보수적이다. 최근 7일 전체 source 후보 502건 중 Events API 미래 후보는 1건뿐이다. 501건은 `no_tiktok_evidence` 등으로 차단됐다. 기존 canary 주문 `202605036519253`은 새 row에서 `eligible_for_future_send=0`, `block_reason=no_tiktok_evidence`로 차단됐다.

현재 결론:
- TikTok Events API production 확대는 **중단**한다.
- 기존 VM shadow 후보 17건은 승인 근거로 쓰지 않는다. 앞으로는 `candidate_version=2026-05-04.shadow.rebuild.v2`만 본다.
- 이미 보낸 canary 1건은 되돌릴 수 없지만, raw/hash PII 없이 1회만 전송됐다.
- Diagnostics가 비어 있는 것은 실패 신호가 아니다. Diagnostics는 이벤트 수신 목록이 아니라 문제 목록이다.
- 다음은 production send가 아니라 v2 후보표를 기준으로 `/ads/tiktok` 화면/문서가 옛 v1 숫자를 다시 쓰지 않게 막는 것이다.

진행 추천 자신감:
- 추가 production send: 5%
- v2 shadow 후보 기준으로 화면/문서 source filter 정리: 95%
- 24시간 뒤 TikTok Ads API read-only 중복 증가 확인: 88%

세부 근거:
- Shadow rebuild 결과: [[tiktok_events_api_shadow_rebuild_result_20260504]]
- 새 후보 검토표: [[tiktok_events_api_shadow_candidate_review_20260504]]

## 2026-05-03 최신 결론

TikTok 플랫폼 구매값과 내부 confirmed 0원 gap은 현재도 “플랫폼 귀속 기준과 내부 고신뢰 기준 차이”가 가장 유력하다.

2026-04-24 ~ 2026-05-01 기준으로 TikTok Ads는 구매 27건 / 8,802,300원을 주장한다. 같은 기간 내부 strict TikTok confirmed와 pending은 모두 0원이다. CTA/VTA 분해를 보면 CTA 5건, VTA 15건, 미분류 7건이다. 즉 클릭 기반보다 조회 기반 또는 플랫폼 전용 귀속이 더 크다.

2026-05-03 00:10~00:11 KST 같은 브라우저 카드 결제 테스트는 기능상 통과했다. `marketing_intent`, `checkout_started`, `payment_success`, `tiktok_pixel_events`가 같은 `ttclid=codex_gtm_card_20260503_001` / `gaSessionId=1777733386` 흐름으로 이어졌다. 서버 결제 판정 API도 `confirmed / allow_purchase / confidence=high`로 확인했다.

다만 `payment_success.metadata.firstTouch.touchpoint`는 `marketing_intent`가 아니라 `checkout_started`다. 이유는 `checkout_started`가 주문번호, checkout id, GA session, client id까지 갖고 있어 더 강한 주문 연결 후보이기 때문이다. 이건 실패가 아니라 현재 로직상 더 안전한 매칭이다. 중요한 것은 `checkout_started`와 `payment_success`에 TikTok `ttclid`와 UTM이 보존됐다는 점이다.

추가 확인 결과, `/ads/tiktok` 로컬 API에서는 이 주문이 firstTouch 후보 전용이 아니라 **strict TikTok confirmed 1건 / 11,900원**으로 잡힌다. 이유는 `payment_success` top-level에도 `utmSource=tiktok`, `utmCampaign=codex_gtm_card_test`, `ttclid=codex_gtm_card_20260503_001`가 남았기 때문이다. 결제 직후에는 pending이었지만 2026-05-03 00:23 KST 재조회에서 자동 status sync가 confirmed로 반영됐다.

2026-05-03 00:36 KST에는 TJ님 승인 범위 안에서 GTM Production publish를 완료했다. live version은 `140 / tiktok_marketing_intent_v1_live_20260503`이다. publish 후 테스트 URL은 `POST /api/attribution/marketing-intent` HTTP 201로 저장됐고, 일반 direct URL은 저장 0건이었다. 즉 TikTok 클릭 근거가 있을 때만 TJ 관리 Attribution VM에 `marketing_intent`가 남는다.

`/ads/tiktok` 화면도 보강했다. 기존 화면은 “어제까지만” 선택할 수 있어 2026-05-03 당일 strict confirmed 11,900원을 직접 볼 수 없었다. 그래서 `오늘` quick range와 오늘 날짜 선택을 추가했고, 화면에서 strict confirmed 11,900원, firstTouch 후보 별도, platform-only assisted 문구를 확인했다. 화면 증거는 `tiktok/monitoring/ads_tiktok_gtm_publish_20260503_today.png`다.

주의할 점도 있다. 결제 직후 TJ 관리 Attribution VM 원장의 `payment_success.paymentStatus`는 `pending`이었다. VM health 기준 자동 status sync는 15분 주기다. direct payment-decision API에서는 이미 confirmed였고, `POST /api/attribution/sync-status/toss?dryRun=true` 확인에서도 `previousStatus=pending -> nextStatus=confirmed`, `matchType=direct_payment_key`, `writtenRows=0`으로 나왔다. 이후 자동 sync가 실제 원장에 `confirmed`, `approvedAt=2026-05-02T15:11:24.000Z`로 반영했다.

Codex 판단 자신감은 **92%**다. 다만 과거 플랫폼 구매 27건을 주문번호 단위로 완전 복원할 자신감은 **35%**다. TikTok Ads 리포트에는 각 구매의 `event_id/order_code/order_no`가 없기 때문이다. 앞으로의 개선 가능성은 **87%**다. 신규 `marketing_intent` live 수집을 붙였으므로 TikTok 클릭 후 재방문 구매를 7일 window 안에서 firstTouch 후보로 잡을 수 있다.

## 2026-05-03 다음 할일

| 순서 | 상태 | 담당 | 할 일 | 왜 하는가 | 어떻게 하는가 | 데이터/DB 위치 | 컨펌 필요 | 자신감 |
|---:|---|---|---|---|---|---|---|---:|
| 1 | 완료 | Codex | TJ 관리 Attribution VM에 `/api/attribution/marketing-intent` receiver와 firstTouch 매칭 로직을 배포한다 | TikTok 클릭 후 홈/상품상세로 들어왔다가 며칠 뒤 구매하는 케이스를 firstTouch 후보로 잡기 위해서다 | 백업 후 backend 변경 파일 반영, `node --check`, `/health`, valid/duplicate/reject smoke, SQLite row 확인 완료 | TJ 관리 Attribution VM SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3#attribution_ledger` | NO, 완료 | 92% |
| 2 | 완료 | TJ + Codex | GTM Preview에서 “광고 클릭 흔적 저장”이 실제로 되는지 확인한다 | workspace/tag compile만으로는 실제 biocom.kr 브라우저에서 tag가 fired 되고 VM 원장에 저장되는지 보장할 수 없다 | workspace `151` Preview 실행, Tag Assistant fired 확인, VM 로그에서 POST 201 확인, VM SQLite에서 `ttclid=codex_gtm_20260502`, `touchpoint=marketing_intent` row 확인 완료. 브라우저 Network 필터에는 보이지 않았지만 VM 로그/원장 기준 저장 성공 | GTM Preview + TJ 관리 Attribution VM SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3#attribution_ledger` | NO, 완료 | 90% |
| 3 | 완료 | TJ + Codex | 같은 브라우저 카드 결제 1건으로 TikTok 클릭-결제완료 연결을 확인한다 | TikTok 클릭 intent가 실제 결제완료까지 이어져야 앞으로 platform gap을 설명할 수 있다 | `ttclid=codex_gtm_card_20260503_001` 테스트 URL에서 같은 Chrome 브라우저로 카드 결제 완료. `marketing_intent -> checkout_started -> payment_success -> tiktok_pixel_events` 연결 확인. `/ads/tiktok` 로컬 API 기준 strict confirmed 11,900원 확인 | TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#attribution_ledger`, `CRM_LOCAL_DB_PATH#tiktok_pixel_events`, 로컬 개발 DB `/Users/vibetj/coding/seo/backend/data/crm.sqlite3` | NO, 완료 | 92% |
| 4 | 완료 | Codex | 카드 테스트 주문의 status sync 후 confirmed 승격을 read-only로 확인한다 | 결제 직후 pending이 실제 confirmed로 넘어가는지 봐야 strict ROAS 계산을 믿을 수 있다 | 주문번호 `202605035698347`, 주문코드 `o20260502c0c1ce5d28e95`, 결제키 `iw_bi202605030010599Ht77`로 Attribution VM read-only API 재조회. `paymentStatus=confirmed`, `approvedAt=2026-05-02T15:11:24.000Z` 확인 | TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#attribution_ledger` | NO, 완료 | 93% |
| 5 | 완료 | Codex | GTM Production publish 후 live sanity를 확인한다 | 운영 전체 트래픽에 붙은 뒤에도 테스트 URL만 저장되고 일반 direct URL은 저장되지 않아야 한다 | live version `140` 확인, 테스트 URL HTTP 201, direct URL 저장 0건, ledger row 확인 | GTM Production container + TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#attribution_ledger` | NO, 완료 | 92% |
| 6 | 완료 | Codex | `/ads/tiktok` 화면에서 2026-05-03 strict confirmed 11,900원이 직관적으로 보이는지 확인한다 | API는 통과했지만 화면 문구가 헷갈리면 예산 판단이 또 흔들린다 | `오늘` quick range를 추가하고 `http://localhost:7010/ads/tiktok`에서 2026-05-03 기간의 strict confirmed, firstTouch, platform-only assisted 분리를 확인했다 | 로컬 개발 DB `/Users/vibetj/coding/seo/backend/data/crm.sqlite3`, TJ 관리 Attribution VM | NO, 완료 | 90% |
| 7 | 진행 예정 | Codex | publish 24시간 모니터링 결과를 baseline과 비교한다 | 실제 운영 트래픽에서 direct 방문 오저장, Purchase Guard 이상, unknown release 증가가 없는지 봐야 한다 | 2026-05-04 00:36 KST 전후 `node backend/scripts/tiktok-guard-monitor.cjs --label gtm-publish-24h --windowHours 24 --noNotify --noAppendFetchResult` 실행 후 `tiktok/monitoring/tiktok_guard_monitor_gtm-publish-baseline_2026-05-02T15-37-24-135Z.md`와 비교한다 | TJ 관리 Attribution VM `tiktok_pixel_events`, `attribution_ledger` read-only | NO, Green | 90% |
| 8 | 진행 예정 | Codex | baseline의 `released_unknown_purchase` 2건을 read-only 추적한다 | anomaly는 아니지만 반복되면 Guard가 결제 판정 실패 시 Purchase를 통과시키는 비율이 늘 수 있다 | 주문키 `o20260502a0a035128ba07`, `o202605021bec71044267b`를 event log와 payment decision read-only로 대조한다 | TJ 관리 Attribution VM + 결제 판정 API read-only | NO, Green | 78% |

## 2026-05-02 GTM 검토 결과

`marketing_intent` 수집은 아임웹 헤더/푸터 대신 GTM으로 해결 가능하다.

단, 모든 TikTok 코드를 GTM으로 옮기면 안 된다. TikTok Purchase Guard는 TikTok Pixel `Purchase`보다 먼저 설치되어야 하므로 아임웹 헤더 유지가 맞다. 반면 `marketing_intent`는 사용자가 TikTok 광고 클릭으로 들어온 페이지의 URL/referrer/cookie를 읽어 TJ 관리 Attribution VM endpoint로 보내는 작업이라 GTM Custom HTML tag와 잘 맞는다.

세부 문서:

- GTM 계획/설계 의도: `tiktok/tiktok_gtm_plan.md`
- Receiver 배포 readiness: `tiktok/tiktok_marketing_intent_receiver_readiness.md`
- GTM 우선안: `tiktok/tiktok_marketing_intent_gtm_v1.md`
- 아임웹 footer 후보안: `tiktok/tiktok_marketing_intent_footer_v1.md`
- 승인 판단용 harness report: `tiktok/tiktok_marketing_intent_harness.md`
- VM 배포 승인 요청서: `tiktok/tiktok_marketing_intent_vm_deploy_approval.md`
- VM 배포/Smoke 결과: `tiktok/tiktok_marketing_intent_vm_deploy_result.md`

권장 순서:

1. TJ님 브라우저에서 GTM workspace `151` Preview를 켠다.
2. 테스트 URL `https://biocom.kr/?utm_source=tiktok&utm_medium=paid&utm_campaign=codex_gtm_test&ttclid=codex_gtm_20260502`로 접속한다.
3. Tag Assistant에서 `SEO - TikTok Marketing Intent - v1 (Preview)`가 Fired 목록에 있는지 본다.
4. Chrome 개발자도구 Network에서 `marketing-intent` 요청을 검색하고 201 또는 duplicate 200인지 본다.
5. Codex가 Attribution VM `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3#attribution_ledger`에서 `touchpoint=marketing_intent`, `ttclid=codex_gtm_20260502` row를 확인한다.
6. 이 3개가 모두 통과하면 같은 브라우저 카드 결제 1건은 별도 승인으로 진행한다.

2026-05-02 결과:

| 확인 | 결과 |
|---|---|
| Tag Assistant fired | 통과 |
| Browser Network | DevTools 필터에는 미표시 |
| VM access log | `POST /api/attribution/marketing-intent` 201 확인 |
| VM ledger row | `ttclid=codex_gtm_20260502`, `touchpoint=marketing_intent` 저장 확인 |
| 판단 | GTM Preview smoke 통과 |

2026-05-03 같은 브라우저 카드 결제 결과:

| 확인 | 결과 |
|---|---|
| 테스트 ttclid | `codex_gtm_card_20260503_001` |
| 주문 | `o20260502c0c1ce5d28e95` / `202605035698347` / `pa202605021e7c194894bf2` |
| `marketing_intent` | 저장됨. `utm_source=tiktok`, `utm_campaign=codex_gtm_card_test`, `gaSessionId=1777733386` |
| `checkout_started` | 같은 `ttclid`, 같은 GA session, 주문번호 저장 |
| `payment_success` | 같은 `ttclid`, `utmSource=tiktok`, `metadata.tiktokFirstTouchCandidate=true` |
| `firstTouch.source` | `checkout_started`. 주문 연결 근거가 더 강해서 정상 |
| `/ads/tiktok` 로컬 API | 2026-05-03 기준 strict confirmed 11,900원, `first_touch_attribution.strictOverlapRows=1` |
| TikTok Pixel event log | `purchase_intercepted -> decision_received -> released_confirmed_purchase` |
| 서버 결제 판정 | `confirmed / allow_purchase / confidence=high / matchedBy=toss_direct_payment_key` |
| status sync dry-run | `previousStatus=pending -> nextStatus=confirmed`, `matchType=direct_payment_key`, `writtenRows=0` |
| 자동 status sync | `paymentStatus=confirmed`, `approvedAt=2026-05-02T15:11:24.000Z` 반영 확인 |

2026-05-03 GTM Production publish 결과:

| 확인 | 결과 |
|---|---|
| live version | `140 / tiktok_marketing_intent_v1_live_20260503` |
| live tag | `SEO - TikTok Marketing Intent - v1` |
| 테스트 URL | `ttclid=codex_gtm_live_20260503_001`, `utm_campaign=codex_gtm_live_publish_20260503` |
| Network | HTTP 201 |
| ledger row | `touchpoint=marketing_intent`, `ttclid=codex_gtm_live_20260503_001` |
| direct URL | 저장 0건 |
| `/ads/tiktok` 화면 | `오늘` 기준 strict confirmed 11,900원, firstTouch 후보 별도, platform-only assisted 문구 확인 |
| 24시간 baseline | `WARN`, anomaly 0건, `released_unknown_purchase` warning 2건 |
| 금지 유지 | TikTok Events API, GA4/Meta/Google send, Purchase Guard 변경, strict 승격, top-level overwrite, 운영DB write 모두 없음 |

공식 참고:

- Google Tag Manager Custom HTML Tag: https://support.google.com/tagmanager/answer/6107167
- Google Tag Manager Preview/Debug: https://support.google.com/tagmanager/answer/6107056

## 2026-05-02 TikTok Ads API CTA/VTA 금액 검증

TikTok Business API `report/integrated/get` 캠페인 일자 리포트에서 CTA/VTA 구매 **건수**는 일부 개선 가능하지만, CTA/VTA 구매 **금액** 분해는 현재 확인된 metric으로는 어렵다.

검증 조건:

- API: `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/`
- 기간: 2026-04-28 ~ 2026-05-01
- data_level: `AUCTION_CAMPAIGN`
- dimensions: `campaign_id`, `stat_time_day`
- 데이터 위치: 로컬 개발 DB 입력용 파일 `data/ads_csv/tiktok/api/tiktok_business_api_campaign_daily_20260428_20260501.csv`, processed 파일 `data/ads_csv/tiktok/processed/20260428_20260501_daily_campaign.csv`

확인 결과:

| metric | 결과 | 해석 |
|---|---|---|
| `vta_complete_payment` | 지원됨, 합계 10건 | VTA complete payment count는 `vta_conversion` 대신 직접 쓸 수 있다 |
| `cta_complete_payment` | invalid metric | CTA complete payment count는 현재 `cta_conversion` 또는 `cta_purchase` fallback 필요 |
| `cta_complete_payment_total_value` | invalid metric | CTA 구매금액 분해 불가 |
| `vta_complete_payment_total_value` | invalid metric | VTA 구매금액 분해 불가 |
| `cta_purchase_value` / `vta_purchase_value` | invalid metric | 구매금액 분해 불가 |
| `total_purchase_value` | 지원되지만 합계 0원 | 현재 캠페인 일자 BASIC report의 website complete payment value로 쓰기 어렵다 |
| `complete_payment * value_per_complete_payment` | 합계 3,937,200원 | 현재 플랫폼 구매값 계산의 실사용 기준 |

2026-04-28 ~ 2026-05-01 합계:

| 항목 | 값 |
|---|---:|
| 광고비 | 951,524원 |
| complete_payment | 14건 |
| derived complete payment value | 3,937,200원 |
| CTA count | 3건 |
| VTA complete payment count | 10건 |
| 미분류 | 1건 |

조치:

- `backend/scripts/tiktok-business-report-dry-run.ts`에 `vta_complete_payment` metric을 추가했다.
- processed daily CSV의 VTA count는 이제 `vta_purchase || vta_complete_payment || vta_conversion` 순서로 계산한다.
- CTA/VTA 금액은 계속 0으로 둔다. 금액을 억지로 건수 비례 배분하지 않는다.

판단:

TikTok 플랫폼이 주장하는 금액을 CTA/VTA 금액으로 나누는 것은 아직 불가능에 가깝다. 따라서 `/ads/tiktok`에서는 CTA/VTA를 “건수 신뢰도”로만 보여주고, 금액 ROAS는 platform total과 내부 confirmed를 분리해서 봐야 한다.

## 2026-04-25 최신 상태

## 2026-04-28 최근 7일 gap 재점검

질문: TikTok 플랫폼 구매값 `21건 / 7,367,960원`인데 내부 confirmed/pending이 모두 0원인 것이 정상인가?

결론: **정상이라고 단정할 수는 없지만, 현재 데이터 구조에서는 설명 가능한 상태다.** 지금 숫자는 “TikTok이 돈을 벌었다”가 아니라 “TikTok 플랫폼이 자기 어트리뷰션 기준으로 21건을 주장하지만, 우리 high-confidence 내부 원장에는 TikTok 귀속 결제완료가 아직 0건”이라는 뜻이다.

기준 기간: 2026-04-21 ~ 2026-04-27

| 기준 | 값 | 데이터 위치 |
|---|---:|---|
| TikTok Ads 플랫폼 구매 | 21건 / 7,367,960원 | 로컬 개발 DB `/Users/vibetj/coding/seo/backend/data/crm.sqlite3#tiktok_ads_daily` + TikTok Business API |
| TikTok Ads 비용 | 5,381,601원 | 로컬 개발 DB `#tiktok_ads_daily` |
| 내부 strict TikTok confirmed | 0건 / 0원 | TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#attribution_ledger` |
| 내부 strict TikTok pending | 0건 / 0원 | TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#attribution_ledger` |
| firstTouch TikTok 후보 payment_success | 0건 / 0원 | TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#attribution_ledger.metadata_json.firstTouch` |
| 설명 안 된 gap | 7,367,960원 | 플랫폼 구매값 - 내부 confirmed - 내부 pending |
| TikTok UTM/`ttclid` 결제페이지 진입 후보 | 16건 | TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#attribution_ledger` |
| 위 16건의 개발팀 관리 운영DB 주문 매칭 | 0/16건 | 개발팀 관리 운영DB PostgreSQL `dashboard.public.tb_iamweb_users` |
| v2 TikTok Pixel 이벤트 원장 | 196개 주문키 / 616 row | TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#tiktok_pixel_events` |
| v2 이벤트 중 결제완료라 Purchase 전송 | 154건 | `CRM_LOCAL_DB_PATH#tiktok_pixel_events` |
| v2 이벤트 중 미입금이라 Purchase 차단 | 28건 | `CRM_LOCAL_DB_PATH#tiktok_pixel_events` |

핵심 해석:

- `tiktok_pixel_events`의 “결제완료라 Purchase 전송”은 **TikTok 광고 귀속 확정**이 아니다. 사이트에서 TikTok Pixel `Purchase` 호출이 발생했는데, 서버 결제상태가 confirmed라서 막지 않고 통과시켰다는 뜻이다.
- 예: 2026-04-27 23:57 KST 주문 `202604278349685`, 금액 485,000원은 실제 카드 결제완료가 맞다. 하지만 TJ 관리 Attribution VM 원장 유입은 `meta_biocom_igevsiggblog_igg`, firstTouch도 Meta다. 그래서 TikTok ROAS confirmed에 넣으면 안 된다.
- 최근 7일 TikTok UTM/`ttclid`가 있는 결제페이지 진입 후보 16건은 모두 `payment_success`가 아니라 checkout 단계에 머물렀고, 개발팀 관리 운영DB `tb_iamweb_users`에도 주문번호가 없다. 즉 “가상계좌 미입금 주문”이라기보다 “결제페이지/로그인/임시 주문 단계까지 갔으나 실제 운영 주문으로 성립하지 않은 후보”로 보는 것이 맞다.
- GA4 session-source 기준으로는 TikTok 계열 purchase가 보인다. 같은 기간 GA4 TikTok session-source purchase는 37건 / 14,124,068원이고, 이 중 숫자형 transaction_id 28건 중 23건 / 7,136,068원이 Attribution VM confirmed와 매칭된다. 그러나 이 23건도 Attribution VM 원장에는 TikTok 직접근거가 없고 다른 source로 남아 있다. 따라서 GA4는 medium-confidence 검산이지 high-confidence TikTok ROAS 확정값이 아니다.

해결 가능성:

- 과거 21건을 order-level로 완전히 복원하는 것은 현재 자료만으로는 어렵다. TikTok Ads API 플랫폼 리포트는 집계값 중심이고, 지금 확보한 자료에는 TikTok이 주장한 21건 각각의 `event_id/order_code/order_no`가 없다.
- 앞으로는 해결 가능성이 높다. v2 event log와 firstTouch 보강 이후에는 `order_code/order_no/payment_code/decision/firstTouch`가 남는다. 단, 실제 TikTok UTM/`ttclid`가 있는 유입이 결제완료까지 이어지는 표본이 필요하다.
- 현재 판단 자신감: **88%**. gap이 “정상 매출 누락”이라기보다 “플랫폼 집계와 내부 high-confidence 귀속 기준 차이”라는 판단은 강하다. 다만 GA4 TikTok session-source confirmed 23건의 세부 경로는 추가 검산 가치가 있다.

프론트 문구 정정:

- 기존 `확정 Purchase 허용`은 사람이 “TikTok 광고가 확정 구매를 만들었다”고 오해할 수 있었다.
- `/ads/tiktok` 화면 문구를 `결제완료라 Purchase 전송`으로 바꾼다.
- 테이블 헤더 `최종 action`도 `픽셀 처리 결과`로 바꾼다.
- 설명 문구에 “이 원장은 TikTok 광고 귀속 원장이 아니라 사이트에서 발생한 TikTok Pixel Purchase 호출 처리 기록”이라고 명시한다.

## 다음 할일

1. **TikTok UTM/`ttclid`가 있는 유입으로 firstTouch 검증**
   - 왜 하는가: 가상계좌와 카드 모두 firstTouch 저장은 성공했지만, 두 테스트 모두 direct 유입이라 `tiktokMatchReasons=[]`였다. 즉 “결제 흐름 보존”은 확인됐고, “TikTok 유입값 보존”은 아직 별도 검증이 필요하다.
   - 어떻게 하는가: TikTok 광고 미리보기 또는 테스트 링크에 `utm_source=tiktok`, `utm_medium=paid`, `utm_campaign=test_firsttouch`, 가능하면 `ttclid` 포함 URL로 들어가 결제페이지까지 진행한다. 이후 TJ 관리 Attribution VM `CRM_LOCAL_DB_PATH#attribution_ledger.metadata_json.firstTouch`에서 `utmSource`/`ttclid`와 `tiktokMatchReasons`를 확인한다.
   - 원장/DB 위치: 저장 대상은 **TJ 관리 Attribution VM SQLite** `CRM_LOCAL_DB_PATH#attribution_ledger.metadata_json.firstTouch`다. 운영DB는 **개발팀 관리 PostgreSQL** `dashboard.public.tb_iamweb_users`이며 이번 작업 대상이 아니다.
   - 진행 추천/자신감: **91%**. 코드와 receiver는 카드/가상계좌 양쪽에서 검증됐다. 남은 것은 실제 TikTok 유입 표본 확보다.

2. **`/ads/tiktok`에서 strict와 firstTouch 후보를 분리 관찰**
   - 왜 하는가: strict confirmed는 예산 증액 판단 기준이고, firstTouch 후보는 “TikTok 유입 신호가 checkout에는 있었는가”를 보는 보조 지표다. 둘을 합치면 다른 채널 매출을 TikTok으로 잘못 승격시킬 수 있다.
   - 어떻게 하는가: 화면에서 `Attribution confirmed`와 `firstTouch 후보 confirmed/pending`을 같이 본다. 카드 테스트처럼 저장 직후 `pending`이었다가 status sync 후 `confirmed`로 승격될 수 있으므로, 신규 주문은 즉시값과 15분 후 값을 구분한다. 7일 누적 후 firstTouch 후보 confirmed가 생기면 GA4 TikTok session-source와 주문번호를 대조해 high-confidence 승격 가능성을 판단한다.
   - 원장/DB 위치: 화면 캐시는 **로컬 개발 DB** `/Users/vibetj/coding/seo/backend/data/crm.sqlite3#tiktok_ads_daily`, 내부 주문 후보는 **TJ 관리 Attribution VM SQLite** `CRM_LOCAL_DB_PATH#attribution_ledger`, 주문 상태 검산은 **개발팀 관리 운영DB PostgreSQL** `dashboard.public.tb_iamweb_users`다.
   - 진행 추천/자신감: **90%**. 화면과 API 구조는 준비됐고 신규 카드/가상계좌 표본도 원장에 정상 저장됐다. 정확도는 TikTok 유입 표본 수에 따라 올라간다.

3. **TikTok 예산/소재 판단은 7일 누적 전까지 보수적으로 유지**
   - 왜 하는가: 현재까지 strict TikTok confirmed는 0원이고, 플랫폼 주장 구매와 내부 주문 근거 사이 gap이 크다. firstTouch 보강 전 데이터로 “틱톡이 돈을 벌고 있다”고 단정하면 위험하다.
   - 어떻게 하는가: 신규 데이터가 쌓일 때까지 TikTok은 소액 측정/학습 수준으로 두고, Meta/Google/센터에서 confirmed가 잡히는 소재와 상품군을 우선 찾는다. TikTok은 firstTouch 후보 confirmed가 누적되면 재증액 후보로 본다.
   - 원장/DB 위치: 판단 기준은 **TJ 관리 Attribution VM 원장** strict confirmed + firstTouch 후보, **개발팀 관리 운영DB PostgreSQL** 주문 상태, TikTok Ads API 플랫폼 비용/구매값이다.
   - 진행 추천/자신감: **87%**. guard/firstTouch 관측 체계는 마련됐지만 TikTok 실제 유입 confirmed 표본은 아직 부족하다. 최종 중단/재증액 판단은 7일 누적 후가 더 안전하다.

4. **배포 백업 보관 및 롤백 기준 유지**
   - 왜 하는가: 이번 배포는 정상 완료됐지만, 신규 주문에서 예상치 못한 payload 문제가 나오면 즉시 이전 dist로 돌릴 수 있어야 한다.
   - 어떻게 하는가: 백업 `crm.sqlite3.pre_firsttouch_20260427_firsttouch_120610.bak`와 `backend-firsttouch-dist.prev.tgz`를 유지한다. 이상 발생 시 PM2 중지 없이 이전 dist 3개 파일을 복원하고 `pm2 restart seo-backend --update-env`를 실행한다.
   - 원장/DB 위치: 백업은 **TJ 관리 Attribution VM** `/home/biocomkr_sns/seo/shared/backups/`, `/home/biocomkr_sns/seo/shared/deploy-backups/20260427_firsttouch_120610/`에 있다.
   - 진행 추천/자신감: **100%**. 이미 백업이 있고 rollback path가 짧다.

### 2026-04-27 source-persistence 로컬 구현 결과

로컬 코드 기준 source-persistence 1차 구현을 완료했다. 이 변경은 **개발팀 관리 운영DB PostgreSQL 스키마 변경이 아니다.** 대상은 TJ 관리 Attribution VM backend 코드와 SQLite `CRM_LOCAL_DB_PATH#attribution_ledger.metadata_json`에 저장되는 보조 metadata다.

구현 내용:

- `backend/src/attribution.ts`
  - `checkout_started` 원장에 `metadata.firstTouch` 스냅샷을 저장하는 `enrichCheckoutStartedFirstTouch()` 추가.
  - `payment_success` 저장 직전에 기존 `checkout_started` 중 같은 `checkout_id`, `order_id`, `ga_session_id`, `clientId`, `userPseudoId` 후보를 찾아 `metadata.firstTouch`로 복사하는 `enrichPaymentSuccessFirstTouch()` 추가.
  - `payment_success`의 top-level `utm_source`, `ttclid`는 덮어쓰지 않는다. strict TikTok confirmed를 인위적으로 부풀리지 않기 위해서다.
- `backend/src/routes/attribution.ts`
  - `/api/attribution/checkout-context`와 `/api/attribution/payment-success` receiver에 firstTouch 보강 로직 연결.
- `backend/src/tiktokRoasComparison.ts`
  - 응답에 `first_touch_attribution` 블록 추가.
  - strict TikTok confirmed와 firstTouch 후보 confirmed/pending을 분리 집계.
- `frontend/src/app/ads/tiktok/page.tsx`
  - `/ads/tiktok`에 `firstTouch 후보 confirmed`, `firstTouch 후보 pending` 카드 추가.
  - `Attribution confirmed`는 기존 strict 기준을 유지.
- `backend/tests/attribution.test.ts`
  - checkout firstTouch 스냅샷 보존 테스트 추가.
  - payment_success가 checkout firstTouch를 가져오되 top-level UTM/`ttclid`를 덮어쓰지 않는 테스트 추가.

검증:

| 검증 | 결과 |
|---|---|
| `npm --prefix backend run typecheck` | 통과 |
| `node --import tsx --test tests/attribution.test.ts` in `backend/` | 33/33 통과 |
| `npx eslint src/app/ads/tiktok/page.tsx` in `frontend/` | 통과 |
| `npm --prefix frontend run lint` | 실패. TikTok 페이지가 아니라 기존 다른 페이지들의 lint 오류(`react/no-unescaped-entities`, `set-state-in-effect` 등) 때문 |

중요한 한계:

- 이 구현은 **신규 이벤트부터** 정확도를 올린다. 과거 주문에는 `metadata.firstTouch`가 없으므로 exact event-level attribution은 복원되지 않는다.
- firstTouch 후보는 high-confidence 확정매출이 아니다. 예산 증액에는 strict confirmed를 우선 사용하고, firstTouch 후보는 GA4/주문DB 교차검증으로 승격 여부를 따진다.
- VM 배포 전까지 운영 수집에는 반영되지 않는다.

### 2026-04-27 firstTouch TJ 관리 Attribution VM 배포 결과

배포 완료 시각: 2026-04-27 21:07 KST
배포 대상: TJ 관리 Attribution VM `att.ainativeos.net` backend `seo-backend`
배포 방식: unrelated 로컬 변경을 피하기 위해 firstTouch 관련 backend 파일만 선별 반영

반영 파일:

- `backend/dist/attribution.js`
- `backend/dist/routes/attribution.js`
- `backend/dist/tiktokRoasComparison.js`
- `backend/src/attribution.ts`
- `backend/src/routes/attribution.ts`
- `backend/src/tiktokRoasComparison.ts`
- `backend/tests/attribution.test.ts`

배포 전 백업:

| 백업 | 위치 |
|---|---|
| SQLite | `/home/biocomkr_sns/seo/shared/backups/crm.sqlite3.pre_firsttouch_20260427_firsttouch_120610.bak` |
| dist/source | `/home/biocomkr_sns/seo/shared/deploy-backups/20260427_firsttouch_120610/backend-firsttouch-dist.prev.tgz` |

배포 검증:

| 검증 | 결과 |
|---|---|
| 원격 `node --check` | `dist/attribution.js`, `dist/routes/attribution.js`, `dist/tiktokRoasComparison.js` 통과 |
| PM2 | `seo-backend` online, created at `2026-04-27T12:07:06.840Z` |
| `https://att.ainativeos.net/health` | `status=ok` |
| ROAS API | `first_touch_attribution` 필드 노출 |
| ROAS API firstTouch 후보 | 기존 과거 구간 후보 0행. 배포 후 신규 주문부터 채워지는 구조라 정상 |
| Attribution ledger read | `checkout_started=3022`, `payment_success=1724` |
| TikTok pixel event read | `CRM_LOCAL_DB_PATH#tiktok_pixel_events` 조회 200 |

남은 검증:

- 카드 결제 신규 1건에서 `payment_success.metadata_json.firstTouch` 존재 확인. 2026-04-28 00:20 KST 주문 `202604289758373`으로 완료.
- 가상계좌 신규 1건에서 TikTok `Purchase` 차단, `PlaceAnOrder` 대체, `metadata_json.firstTouch` 후보 확인. 2026-04-27 22:57 KST 주문 `202604275818534`로 완료.
- 7일 누적 후 `/ads/tiktok`의 strict confirmed와 firstTouch 후보 confirmed/pending 분리 관찰.

### 2026-04-27 가상계좌 firstTouch 운영 검증

검증 주문:

| 항목 | 값 |
|---|---|
| 주문번호 | `202604275818534` |
| 주문코드 | `o2026042705c0da395af77` |
| 결제코드 | `pa20260427065cdaabb4f5a` |
| 금액 | 35,000원 |
| URL | `https://biocom.kr/shop_payment_complete?order_code=o2026042705c0da395af77&payment_code=pa20260427065cdaabb4f5a&order_no=202604275818534&rk=S` |

결과:

| 검증 | 결과 |
|---|---|
| TikTok Pixel Helper | `Purchase` 없음, `PlaceAnOrder`만 확인 |
| TJ 관리 Attribution VM `CRM_LOCAL_DB_PATH#tiktok_pixel_events` | `purchase_intercepted`, `decision_received`, `blocked_pending_purchase`, `sent_replacement_place_an_order` 총 4행 |
| payment-decision | `pending / block_purchase_virtual_account / confidence=high / matchedBy=toss_direct_order_id` |
| Toss direct 상태 | `WAITING_FOR_DEPOSIT`, channel `가상계좌` |
| Attribution ledger `checkout_started` | 존재. `metadata_json.firstTouch` 저장됨 |
| Attribution ledger `payment_success` | 존재. `paymentStatus=pending`, `metadata_json.firstTouch` 저장됨 |
| firstTouch 매칭 | `checkout_id`, `order_id`, `order_id_base`, `ga_session_id`, `client_id`, `user_pseudo_id`, score 460 |
| firstTouch TikTok 근거 | 없음. 이번 테스트 유입은 `@direct`라서 `tiktokMatchReasons=[]` |

판정:

- Guard는 정상이다. pending 가상계좌 주문에서 TikTok `Purchase`를 차단하고 `PlaceAnOrder`로 낮췄다.
- firstTouch persistence는 정상이다. 운영 VM의 `payment_success.metadata_json.firstTouch`가 실제 신규 주문에 생성됐다.
- 다만 이번 유입은 TikTok 광고/UTM 유입이 아니라 direct 유입이다. 따라서 “TikTok 유입값 보존” 자체는 다음에 `ttclid` 또는 TikTok UTM이 있는 유입으로 추가 검증해야 한다.

### 2026-04-28 카드 firstTouch 운영 검증

검증 주문:

| 항목 | 값 |
|---|---|
| 주문번호 | `202604289758373` |
| 주문코드 | `o20260427016c28339089c` |
| 결제코드 | `pa20260427fe8ae66a5f5d0` |
| 금액 | 11,900원 |
| URL | `https://biocom.kr/shop_payment_complete?order_code=o20260427016c28339089c&payment_code=pa20260427fe8ae66a5f5d0&order_no=202604289758373&rk=S` |

결과:

| 검증 | 결과 |
|---|---|
| TikTok Pixel Helper | `Purchase` 확인, `event_id=Purchase_o20260427016c28339089c`, value 11,900원 |
| TJ 관리 Attribution VM `CRM_LOCAL_DB_PATH#tiktok_pixel_events` | `purchase_intercepted`, `decision_received`, `released_confirmed_purchase` 총 3행 |
| payment-decision | `confirmed / allow_purchase / confidence=high / matchedBy=toss_direct_order_id` |
| Toss direct 상태 | `DONE`, channel `카드`, approvedAt `2026-04-28T00:20:15+09:00` |
| Attribution ledger `checkout_started` | 존재. `metadata_json.firstTouch` 저장됨 |
| Attribution ledger `payment_success` | 존재. `paymentStatus=confirmed`, `metadata_json.firstTouch` 저장됨 |
| firstTouch 매칭 | `checkout_id`, `order_id`, `order_id_base`, `ga_session_id`, `client_id`, `user_pseudo_id`, score 460 |
| firstTouch TikTok 근거 | 없음. 이번 테스트 유입은 direct라서 `tiktokMatchReasons=[]` |

상태 동기화 메모:

- 카드 결제 직후에는 `payment_success.paymentStatus=pending`으로 보였으나, 이후 TJ 관리 Attribution VM status sync가 같은 주문을 `confirmed`로 승격했다.
- dry-run 기준으로도 해당 주문은 `previousStatus=pending -> nextStatus=confirmed`, `matchType=direct_payment_key` 후보였다.
- 최종 재조회 기준 TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#attribution_ledger.payment_status`는 `confirmed`다.

판정:

- 카드 confirmed 경로는 정상이다. 서버 판정은 `allow_purchase`였고 TikTok `Purchase`가 통과됐다.
- firstTouch persistence는 카드에서도 정상이다. `payment_success.metadata_json.firstTouch`가 실제 운영 VM에 생성됐고, `checkout_started`와 같은 주문/세션/클라이언트 근거로 매칭됐다.
- 다만 이번 카드 주문도 TikTok 광고/UTM 유입이 아니라 direct 유입이다. 따라서 다음 검증은 `ttclid` 또는 TikTok UTM이 있는 유입으로 진행해야 한다.

### 2026-04-27 DB/원장 위치 용어 정정

TJ 정정 기준을 반영한다. 앞으로 이 문서에서 **운영DB**는 개발팀이 관리하는 PostgreSQL `dashboard` DB만 의미한다. 접속 정보는 credentials를 문서에 반복 기록하지 않고, 위치만 **개발팀 관리 PostgreSQL `dashboard` on `34.47.95.104:5432`**로 표기한다.

반대로 `att.ainativeos.net` 서버와 그 안의 SQLite는 운영DB가 아니다. 이 서버는 **TJ 관리 Attribution VM**이다.

| 명칭 | 정확한 위치 | 역할 | 권한/주의 |
|---|---|---|---|
| 개발팀 관리 운영DB | PostgreSQL `dashboard` on `34.47.95.104:5432`, 대표 테이블 `public.tb_iamweb_users` | 아임웹 주문 상태, 결제수단, 취소/만료 상태 정본 | read-only 기준. Codex/TJ가 임의 write하지 않는다 |
| TJ 관리 Attribution VM | `https://att.ainativeos.net`, SQLite `CRM_LOCAL_DB_PATH#attribution_ledger` | 우리 헤더/receiver가 받은 `checkout_started`, `payment_success`, 광고 유입값, 결제 상태 보조 원장 | TJ 관리 서버. 운영DB라고 부르지 않는다 |
| TikTok pixel event log | TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#tiktok_pixel_events` | TikTok Purchase guard가 차단/허용한 event-level 로그 | 광고 귀속 정본이 아니라 픽셀 이벤트 원장 |
| 로컬 개발 DB | 이 노트북 `/Users/vibetj/coding/seo/backend/data/crm.sqlite3` | `/ads/tiktok` 개발/화면 캐시, TikTok Ads API 적재 캐시 | 운영 판단 정본 아님 |
| TikTok Ads 데이터 | TikTok Business API + 로컬 SQLite `backend/data/crm.sqlite3#tiktok_ads_daily` | 플랫폼 주장 비용/구매/CTA/VTA | 내부 확정매출 아님 |
| GA4 데이터 | GA4 Data API | session source, `transaction_id` 기반 교차검증 | medium confidence. 채널 충돌 가능 |

DB 컬럼을 말할 때는 앞으로 반드시 `위치#테이블.컬럼` 형식으로 쓴다.

예:

- 개발팀 관리 운영DB `dashboard.public.tb_iamweb_users.order_no`
- TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#attribution_ledger.utm_source`
- TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#attribution_ledger.metadata_json.clientId`
- 로컬 개발 DB `/Users/vibetj/coding/seo/backend/data/crm.sqlite3#tiktok_ads_daily.spend`

source-persistence 보강의 정확한 의미:

- 1차 대상은 **개발팀 관리 운영DB PostgreSQL 컬럼 추가가 아니다.**
- 1차 대상은 **TJ 관리 Attribution VM의 receiver 로직과 SQLite `CRM_LOCAL_DB_PATH#attribution_ledger.metadata_json`**이다.
- 목표는 TikTok 최초 유입값을 `checkout_started`에서 `payment_success`까지 이어서 보존하는 것이다.

현재 이미 존재하는 TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#attribution_ledger` 컬럼:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_term`
- `utm_content`
- `ttclid`
- `ga_session_id`
- `landing`
- `referrer`
- `metadata_json`

`client_id`는 현재 독립 컬럼이 아니라 `CRM_LOCAL_DB_PATH#attribution_ledger.metadata_json.clientId` 또는 `metadata_json.userPseudoId` 안에 들어간다.

권장 구현 순서:

1. DB 스키마 변경 없이 TJ 관리 Attribution VM receiver에서 `metadata_json.firstTouch`를 보강한다.
2. `payment_success` 생성 시 같은 `checkout_id`, `order_no`, `ga_session_id`, `clientId` 후보로 직전 `checkout_started`의 TikTok UTM/`ttclid`를 찾아 복사한다.
3. `/ads/tiktok`은 strict 기준과 firstTouch 기준을 분리해서 보여준다.
4. 실제로 3~7일간 TikTok 값 보존이 확인된 뒤, 필요할 때만 TJ 관리 Attribution VM SQLite 명시 컬럼 추가를 검토한다. 이 경우에도 개발팀 관리 운영DB PostgreSQL 스키마 변경은 아니다.

### 2026-04-26 내부 confirmed 0원 재해석과 GA4 교차검증

질문은 “TikTok 내부 confirmed가 계속 0원인데, 실제 매출이 없다는 뜻인가?”였다. 결론은 아니다. 현재 0원은 **TJ 관리 Attribution VM 원장의 strict TikTok confirmed** 정의가 0원이라는 뜻이고, GA4 session-source 기준으로는 TikTok 계열 구매가 별도로 보인다.

이번 확인은 `/ads/tiktok` 기본 구간인 2026-04-18 ~ 2026-04-24 기준이다. GA4를 2026-04-25까지 조회해도 현재 반환 행은 2026-04-24까지라, 4/25는 GA4 freshness 때문에 별도 지연 가능성을 둔다.

| 기준 | 값 |
|---|---:|
| 확인 시각 | 2026-04-26 09:26 KST |
| TJ 관리 Attribution VM strict TikTok confirmed | 0건 / 0원 |
| TJ 관리 Attribution VM ledger 전체 payment_success | 461행 |
| TJ 관리 Attribution VM ledger confirmed payment_success | 399행 |
| TJ 관리 Attribution VM ledger TikTok 직접근거 payment_success | 0행 |
| GA4 TikTok session-source purchase | 64회 / 26,684,430원 |
| GA4 숫자형 transaction_id | 47행 |
| GA4 NPay 형식 transaction_id | 9행 |
| GA4 transaction_id 없음 | 8회 / 6,827,000원 |
| GA4 숫자형 transaction_id 중 Attribution VM confirmed 매칭 | 41건 / 11,894,430원 |
| GA4 숫자형 transaction_id 중 Attribution VM canceled 매칭 | 1건 / 39,000원 |
| GA4 숫자형 transaction_id 중 Attribution VM ledger 미조인 | 5건 / 2,502,000원 |
| Attribution VM confirmed 매칭 41건 중 ledger TikTok 직접근거 | 0건 |
| Attribution VM confirmed 매칭 41건 중 다른 채널/무관 UTM 근거 | 41건 |

해석:

- `internal confirmed = 0원`은 “바이오컴 결제완료가 없다”가 아니다. TJ 관리 Attribution VM 원장에는 같은 기간 결제완료가 충분히 들어오고 있다.
- 문제는 TikTok 광고 유입 신호가 `payment_success` receiver에 보존되지 않는 것이다. `ttclid`, TikTok UTM, TikTok landing/referrer가 TJ 관리 Attribution VM ledger에 남지 않으므로 strict TikTok confirmed가 0원으로 계산된다.
- GA4 기준으로는 TikTok session source 구매가 64회 존재한다. 이 중 41건은 TJ 관리 Attribution VM ledger의 confirmed 주문번호와 금액까지 맞는다.
- 그러나 그 41건의 TJ 관리 Attribution VM ledger UTM/landing은 Meta, Naver, CRM, coupon, direct성 경로 등으로 남아 있다. 따라서 GA4 수치 11,894,430원을 TikTok high-confidence confirmed로 바로 승격하면 다른 채널 매출을 빼앗을 위험이 있다.

이번 개발 반영:

- `/ads/tiktok`에 **GA4 주문번호 교차검증** 섹션을 추가했다.
- 백엔드 `GET /api/ads/tiktok/roas-comparison` 응답에 `ga4_cross_check`를 추가했다.
- 데이터 위치는 다음처럼 분리한다.

| 지표 | 위치 | 신뢰 등급 | 사용 방식 |
|---|---|---|---|
| strict TikTok confirmed | TJ 관리 Attribution VM ledger | high | 예산 증액/확정 ROAS의 1차 기준 |
| GA4 TikTok transaction match | GA4 Data API + TJ 관리 Attribution VM ledger join | medium | “TikTok 가능성” 검산, 0원 오해 방지 |
| TikTok Ads purchase/CTA/VTA | TikTok Business API + 로컬 SQLite | platform | 플랫폼 주장값, 내부 주문 확인 전에는 확정 매출 아님 |

운영 판단:

- 내부 confirmed 0원 문제는 **완전히 해결**이 아니라 **정의 분리로 완화**했다.
- 지금부터 화면에서는 strict confirmed 0원과 GA4 중간 신뢰 confirmed 후보 11,894,430원을 같이 본다.
- 예산 증액 판단에는 여전히 strict confirmed를 쓴다. 다만 TikTok을 “실제 주문이 전혀 없는 채널”로 단정하지는 않는다.
- 다음 개발 후보는 `checkout_started` / `payment_success`에서 최초 TikTok UTM, `ttclid`, GA4 session id, client id를 더 오래 보존하는 source-persistence 보강이다. 이게 들어가야 GA4 medium 후보를 high-confidence로 올릴 수 있다.

### 2026-04-26 CTA/VTA 분해 재점검

TJ가 받은 파일 `Downloads/주바이오컴_adv-Campaign Report-2026-03-27 to 2026-04-25.xlsx`는 실제 워크북을 열어보면 `Sheet1!A1 = Campaign name` 한 셀만 들어 있었다. 즉 화면에서는 일별 breakdown이 보이지만 다운로드 export가 데이터 없이 실패한 상태다.

수동 export 대신 TikTok Business API read-only 경로를 사용했다.

| 구분 | 값 |
|---|---:|
| 수집 시각 | 2026-04-26 00:40~00:55 KST |
| 데이터 위치 | 로컬 파일 `data/ads_csv/tiktok/api/`, 로컬 SQLite `backend/data/crm.sqlite3#tiktok_ads_daily` |
| DB 백업 | `backend/data/backups/crm.sqlite3.bak_20260426_tiktok_cta_vta_before_import` |
| API endpoint | `GET /open_api/v1.3/report/integrated/get/` |
| 기간 | 2026-04-18 ~ 2026-04-25 |
| 광고비 | 6,863,342원 |
| TikTok complete_payment | 23건 |
| TikTok 구매값 복원 | 7,756,592원 |
| CTA attribution conversion | 8건 |
| VTA attribution conversion | 7건 |
| EVTA | API metric `evta_conversion`은 invalid. 현재 직접 분해 불가 |
| API 미분류 | 8건 |
| 내부 TikTok confirmed | 0원 |

중요한 해석:

- 기존 2026-04-18 ~ 2026-04-24의 17건은 API 재조회 시 18건 / 4,738,392원으로 바뀌었다. TikTok attribution은 후속 반영이 있으므로 “조회 시각”을 숫자 옆에 남겨야 한다.
- `cta_purchase`, `vta_purchase`, `evta_purchase` metric은 API에서 응답은 되지만 현재 웹 Purchase 분해값으로는 0이 나온다.
- 실제로 쓸 수 있는 분해값은 `cta_conversion`, `vta_conversion`이다. 이 계정/캠페인에서는 `conversion = complete_payment`와 같은 구매 이벤트로 잡히므로, 로컬 `cta_purchase_count`, `vta_purchase_count`는 이 값으로 fallback 매핑했다.
- 구매금액을 CTA/VTA/EVTA별로 직접 분해하는 API metric은 이번 dry-run에서 확인되지 않았다. 따라서 금액 기준 CTA ROAS/VTA ROAS는 아직 0 또는 null로 둔다.
- `/ads/tiktok`에는 CTA/VTA/API 미분류 구매수 배지를 추가했다.

의사결정 영향:

- 2026-04-18 ~ 2026-04-25 기준 TikTok 주장 구매 23건 중 CTA 8건, VTA 7건, API 미분류 8건이다.
- 클릭 기반 구매가 일부 존재하므로 TikTok을 완전히 버릴 근거는 약해졌다.
- 그러나 내부 confirmed는 여전히 0원이라, 소재팀 주력 리소스는 계속 Meta/Google 우선이 맞다. TikTok은 소액 검증과 추적 개선 유지가 적절하다.

결론부터 말하면, 2026-04-23 비용 0원 표시는 실제 무집행이 아니라 **TikTok Ads API 미수집**이었다. 2026-04-25 21:43 KST에 TikTok Business API로 2026-04-23 ~ 2026-04-24를 수집했고, `/ads/tiktok` 로컬 대시보드도 2026-04-24까지 갱신됐다.

이번 작업의 데이터 위치는 아래처럼 나눈다.

| 데이터 | 위치 | 이번 작업에서의 의미 |
|---|---|---|
| TikTok Ads API 원본 | **로컬 파일** `data/ads_csv/tiktok/api/tiktok_business_api_campaign_daily_20260423_20260424.json` | TikTok 플랫폼이 주장하는 비용/구매/구매값 |
| TikTok Ads 대시보드 캐시 | **내 맥북 로컬 SQLite** `backend/data/crm.sqlite3#tiktok_ads_daily` | `/ads/tiktok` 화면용 광고 데이터 캐시 |
| 내부 확정매출 기준 | **TJ 관리 Attribution VM 원장** `https://att.ainativeos.net/api/attribution/ledger` | 실제 TikTok 후보 결제완료 이벤트 기준 |
| 주문 상태 검산 | **개발팀 관리 운영DB PostgreSQL** `public.tb_iamweb_users` | 가상계좌 만료, 취소, 결제완료 상태 정본 |

### 2026-04-25 그로스 리소스 배분 판단

현재 판단은 **Meta/Google에서 먼저 위닝 소재를 찾고, TikTok은 측정 유지 + 소액 검증 채널로 둔다**이다.

추천 자신감은 **82%**다. TikTok을 영구 중단하자는 뜻은 아니다. 내부 그로스팀 체계가 변동 중이고 Meta, Google, 센터/운영 작업을 동시에 해야 하는 상황에서는 “TikTok 소재를 더 깊게 파는 것”보다 “내부 confirmed가 잡히는 채널에서 먼저 메시지와 상품군을 검증한 뒤 TikTok으로 확장”하는 순서가 비용 대비 안전하다.

판단 근거:

| 채널 | 기준 | 최근 확인값 | 해석 |
|---|---|---:|---|
| TikTok | 로컬 TikTok Ads API 캐시 + TJ 관리 Attribution VM 원장 | 광고비 6,190,363원 / TikTok 주장 구매값 4,493,392원 / 내부 confirmed 0원 | 플랫폼 주장은 있으나 내부 결제완료 귀속 증거가 없다 |
| Meta | TJ 관리 Attribution VM `/api/ads/roas`, `last_7d` | 광고비 29,167,748원 / Attribution 매출 42,221,199원 / ROAS 1.45 | 과대 가능성은 별도 검산 대상이지만 내부 주문 귀속이 존재한다 |
| Google | 로컬 `/api/google-ads/dashboard`, `last_7d` | 광고비 6,381,372원 / 내부 confirmed 3,355,210원 / 내부 ROAS 0.53 | 플랫폼 ROAS와 gap은 크지만 confirmed 주문 13건이 존재한다 |
| 센터/운영 | 주문/상담/취소 피드백 | 구매확정, 자동취소, 상담 품질 회수 필요 | 소재 브리프와 광고 원장 보정의 기준점이다 |

실행 원칙:

1. TikTok은 완전 폐기하지 않는다. v2 Guard/event log, CTA/VTA 분해, 7~14일 추가 관찰은 유지한다.
2. TikTok 신규 소재 대량 제작은 보류한다. 내부 confirmed 0원 상태에서 소재팀 주력 리소스를 투입하면 학습 신호가 플랫폼 주장값에 끌려갈 위험이 크다.
3. Meta/Google에서 먼저 결제 confirmed가 붙는 메시지, 후킹, 상품군을 찾는다.
4. Meta/Google에서 통과한 소재를 TikTok 포맷으로 재가공해 확장한다. 재개 조건은 내부 TikTok confirmed 발생, CTA 중심 구매 확인, 또는 동일 메시지의 타 채널 실매출 검증이다.

프론트 반영:

- `/ads/tiktok` 상단에 **그로스 리소스 배분 판단** 섹션을 추가했다.
- 표시 위치: `frontend/src/app/ads/tiktok/page.tsx`
- 내용: 추천 채널 우선순위, 자신감 %, TikTok/Meta/Google/센터 비교, 다음 액션.

2026-04-23 ~ 2026-04-24 TikTok Ads API 수집 결과:

| 기준 | 값 |
|---|---:|
| API row | 10행 |
| 광고비 | 1,350,649원 |
| 노출 | 503,395 |
| 클릭 | 11,804 |
| TikTok 주장 구매 | 5건 |
| TikTok 주장 구매값 | 1,037,160원 |

최근 7일 `2026-04-18 ~ 2026-04-24` 대시보드 기준:

| 기준 | 값 |
|---|---:|
| TikTok 광고비 | 6,190,363원 |
| TikTok 주장 구매 | 17건 |
| TikTok 주장 구매값 | 4,493,392원 |
| TikTok 주장 ROAS | 0.7259 |
| TJ 관리 Attribution VM 원장 confirmed | 0건 / 0원 |

해석:

- TikTok Ads API 수집 파이프라인은 작동한다. 자료 충분성 자신감은 **96%**다.
- 그러나 Ads API 숫자는 플랫폼 주장값이다. 2026-04-18 ~ 2026-04-24 기준 내부 확정매출은 아직 0원으로 보이므로, 예산 증액 판단 자신감은 **62%**다.
- 다음 판단은 “TikTok이 구매를 만들었는가”가 아니라 “TikTok이 주장한 구매가 내부 주문과 event-level로 붙는가”다. 이 판단은 v2 event log 운영 원장과 주문 DB를 함께 봐야 한다.

## 2026-04-25 내부 confirmed 0원 원인 심층 분석

질문은 이것이다.

> TikTok Ads API는 최근 7일 구매 17건 / 구매값 4,493,392원을 주장하는데, 왜 `/ads/tiktok`의 내부 confirmed는 0원인가?

현재 결론은 **주문이 전혀 없어서가 아니라, 내부 Attribution 원장 기준으로 “TikTok 유입 근거가 붙은 결제완료 주문”이 0건이기 때문**이다. 즉 0원은 사이트 전체 매출 0원이 아니다. “우리 내부 보수 기준으로 TikTok 광고가 직접 연결된 confirmed 주문”이 0원이라는 뜻이다.

### 확인한 숫자

기준 기간: `2026-04-18 00:00 KST ~ 2026-04-25 00:00 KST`

| 항목 | 값 | 의미 |
|---|---:|---|
| TJ 관리 Attribution VM 원장 전체 row | 1,474행 | 원장 자체는 비어 있지 않다 |
| `checkout_started` | 1,068행 | 결제 페이지 도달 기록 |
| `payment_success` | 406행 | 주문완료 페이지 도달 기록 |
| `payment_success confirmed` | 349행 | 같은 기간 사이트에는 확정 주문이 있다 |
| TikTok 근거가 있는 전체 row | 21행 | `ttclid` 또는 TikTok UTM/referrer 근거 |
| TikTok 근거 row의 touchpoint | `checkout_started` 21행 | TikTok 유입은 결제 페이지까지는 왔다 |
| TikTok 근거가 있는 `payment_success` | 0행 | 내부 confirmed 0원의 직접 원인 |
| TikTok 근거 checkout 중 orderId 있는 행 | 3행 | 주문번호가 잡힌 checkout은 일부뿐 |
| TikTok 근거 checkout 중 같은 orderId의 payment_success | 0행 | TikTok 유입 checkout이 결제완료로 이어진 증거 없음 |

### 직접 원인 1: `/ads/tiktok` confirmed 계산식은 보수적이다

`/ads/tiktok`의 내부 confirmed는 아래 조건을 모두 만족해야 잡힌다.

1. TJ 관리 Attribution VM 원장 `https://att.ainativeos.net/api/attribution/ledger`에서 가져온다.
2. `touchpoint = payment_success`여야 한다.
3. `paymentStatus = confirmed`여야 한다.
4. `ttclid`, TikTok UTM, TikTok referrer, landing URL의 TikTok 근거 중 하나가 있어야 한다.

최근 7일에는 1~3을 만족하는 주문은 많다. `payment_success confirmed`가 349행이다. 하지만 4번 TikTok 근거가 붙은 confirmed 주문이 0행이라 내부 confirmed가 0원으로 나온다.

이 계산은 일부러 보수적으로 만들었다. TikTok Ads가 주장하는 구매를 그대로 내부 매출로 인정하지 않고, 우리 서버 원장에 남은 유입 근거가 있을 때만 내부 confirmed로 잡는다.

### 직접 원인 2: TikTok 유입 checkout은 있었지만 결제완료로 이어진 증거가 없다

최근 7일 원장에는 TikTok 근거가 있는 `checkout_started`가 21행 있었다. 모두 `ttclid` 또는 TikTok UTM을 가지고 있었다.

하지만 이 21행은 모두 `checkout_started`에 머물렀다. `payment_success`까지 이어진 같은 주문번호가 없다.

세부:

| 구분 | 값 |
|---|---:|
| TikTok 근거 checkout | 21행 |
| 이 중 orderId 있음 | 3행 |
| 같은 orderId의 payment_success 있음 | 0행 |

해석:

- 내부 원장 기준으로는 TikTok 광고 유입자가 결제 페이지까지 온 흔적은 있다.
- 그러나 그 주문들이 실제 결제완료까지 갔다는 내부 증거는 없다.
- 따라서 내부 confirmed를 0원으로 두는 것은 현재 데이터 기준으로 맞다.

### 직접 원인 3: v2 event log의 confirmed는 “TikTok 광고 귀속”이 아니다

2026-04-24 v2 event log에는 실주문 4건이 잡혔다.

| orderNo | value | finalAction | decision | 내부 유입 원장 |
|---|---:|---|---|---|
| 202604246007665 | 11,900원 | `released_confirmed_purchase` | confirmed / allow | TikTok 근거 없음 |
| 202604247459692 | 11,900원 | `blocked_pending_purchase` | pending / block virtual account | TikTok 근거 없음 |
| 202604245822900 | 245,000원 | `released_confirmed_purchase` | confirmed / allow | TikTok 근거 없음 |
| 202604248033486 | 245,000원 | `released_confirmed_purchase` | confirmed / allow | `utm_source=naver`, `utm_medium=powerlink`, TikTok 근거 없음 |

이 표가 중요하다.

v2 event log는 “TikTok Pixel Purchase를 허용했는가 / 막았는가”를 기록한다. 사이트의 TikTok Pixel은 광고 유입 여부와 무관하게 주문완료 페이지에서 동작한다. 그래서 v2 event log의 `released_confirmed_purchase`는 **실제 카드 결제 확인**이지, **TikTok 광고 성과 확정**이 아니다.

4/24에는 TikTok Ads API가 245,000원 구매 1건을 주장했다. 같은 날 v2 event log에는 245,000원 confirmed purchase가 2건 있었다. 그런데 운영 Attribution 원장상 하나는 Naver Powerlink, 하나는 유입 공백이었다. 즉 TikTok Ads가 이 둘 중 하나를 가져갔을 가능성은 있지만, 현재 API export에는 `event_id/order_code`가 없어서 어느 주문인지 exact 매칭할 수 없다.

### 구조적 원인 4: TikTok Ads와 내부 원장의 attribution 정의가 다르다

TikTok Ads Manager는 광고 클릭/조회 후 일정 기간 안의 전환을 자기 성과로 볼 수 있다. TikTok 공식 문서도 CTA, EVTA, VTA 같은 attribution window를 설명한다.

- 공식 문서: `https://ads.tiktok.com/help/article/about-the-attribution-window-on-tiktok-ads-manager?lang=en`
- 공식 문서: `https://ads.tiktok.com/help/article/about-engaged-view-through-attribution`
- 공식 문서: `https://ads.tiktok.com/help/article/attribution-settings-at-the-ad-group-level?lang=en`

반대로 내부 `/ads/tiktok` confirmed는 서버 원장의 직접 근거를 본다. 현재 기준은 `ttclid`나 TikTok UTM/referrer가 `payment_success`까지 남아야 한다.

따라서 아래 상황에서는 TikTok Ads와 내부 confirmed가 갈라진다.

| 상황 | TikTok Ads | 내부 원장 |
|---|---|---|
| 사용자가 TikTok 광고를 본 뒤 나중에 Naver 검색으로 구매 | TikTok이 VTA/EVTA/CTA로 가져갈 수 있음 | Naver 또는 direct로 남을 수 있음 |
| TikTok 클릭 후 장바구니/결제 중간에 URL 파라미터가 사라짐 | TikTok Pixel과 쿠키 기준으로 가져갈 수 있음 | `payment_success`에 `ttclid`가 없으면 TikTok으로 안 잡음 |
| 같은 브라우저에서 TikTok 광고 접촉은 있었지만 마지막 유입이 다른 채널 | TikTok attribution window 안이면 구매로 볼 수 있음 | 현재 내부는 last-touch 성격이 강해 다른 채널로 남음 |
| v2 event log에 Purchase release가 있음 | Pixel 이벤트가 나갔으므로 attribution 후보 | 광고 귀속 증거는 아님 |

### 구현상 원인 5: 현재 payment-success 코드는 first-touch TikTok을 내부 confirmed로 올리지 않는다

운영 삽입 코드에는 `_p1s1a_first_touch`와 `_p1s1a_last_touch`를 모두 저장하는 UTM persistence 블록이 있다. 그런데 `payment-success` payload는 현재 `lastTouch`, 아임웹 session, 현재 URL을 중심으로 유입값을 채운다. `firstTouch`는 `payment_success` source 판정에 직접 쓰지 않는다.

따라서 “처음은 TikTok, 마지막은 Naver/direct”인 주문은 내부 confirmed TikTok으로 잡히지 않는다. 이것은 버그라기보다 현재 대시보드 정의가 **보수적 last-touch/직접근거 기준**이라는 뜻이다.

이 기준은 예산 방어에는 좋다. 다만 TikTok Ads의 click/view attribution과 직접 비교하면 TikTok이 더 크게 보이는 것이 정상이다.

### 가능성이 낮아진 원인

| 원인 후보 | 현재 판정 | 근거 |
|---|---|---|
| TJ 관리 Attribution VM 원장이 죽어서 0원 | 가능성 낮음 | 최근 7일 원장 1,474행, payment_success 406행 확인 |
| Ads API 데이터가 비어서 0/오류 | 해결됨 | 2026-04-24까지 API 수집 완료 |
| Guard가 카드 Purchase를 막고 있음 | 가능성 낮음 | v2 event log에서 카드 confirmed 3건 release 확인 |
| CORS 때문에 v2 event log가 안 쌓임 | 해결됨 | CORS 수정 후 4/24 실주문 4건, 이벤트 13행 저장 |
| 모든 TikTok 유입 주문이 실제 결제완료됨 | 현재 근거 없음 | TikTok checkout 21행 중 matching payment_success 0행 |

### 현재 해석

가장 가능성이 높은 설명은 아래 조합이다.

1. TikTok 광고 유입은 결제 페이지까지 일부 들어왔다.
2. 내부 원장 기준으로 그 TikTok 유입 checkout이 결제완료로 이어진 증거는 없다.
3. 실제 confirmed 주문은 존재하지만, 내부 유입값은 Naver/direct/공백이다.
4. TikTok Ads는 자체 클릭/조회 attribution window로 그중 일부 Purchase pixel을 자기 성과로 가져간다.
5. TikTok Ads API는 캠페인/일자 집계만 제공하고, 현재 export에는 `event_id/order_code`가 없어 어떤 주문을 가져갔는지 확정할 수 없다.

따라서 최근 7일의 정확한 표현은 다음이다.

> TikTok Ads는 17건 / 4,493,392원의 구매를 주장한다. 그러나 TJ 관리 Attribution VM 원장 기준으로 TikTok 직접 근거가 붙은 payment_success confirmed는 0건 / 0원이다. v2 event log는 Purchase 허용/차단은 검증하지만 광고 귀속 증거는 아니므로, TikTok 주장 구매를 내부 확정매출로 인정하기에는 아직 부족하다.

### 다음 확인

1. TikTok Ads Manager에서 CTA/EVTA/VTA custom columns를 켜서 17건이 클릭 기반인지 조회 기반인지 나눈다.
   - 왜 하는가: VTA/EVTA 비중이 크면 내부 last-touch confirmed 0원과 차이가 커지는 것이 자연스럽다.
   - 자신감: **95%**. TikTok 공식 문서상 Ads Manager reporting view에서 attribution type breakdown을 볼 수 있다.

2. 운영 원장에 `first_touch_tiktok_confirmed` 보조 지표를 추가 검토한다.
   - 왜 하는가: 현재 내부 confirmed는 보수적 direct/last-touch 기준이다. first-touch TikTok까지 같이 보면 TikTok의 상단 퍼널 기여 가능성을 별도로 볼 수 있다.
   - 주의: 이 값을 예산 정본으로 쓰면 과대평가될 수 있으므로 `보조 지표`로만 둔다.
   - 자신감: **82%**. 코드상 first-touch 저장은 있으나 payment-success 판정에는 아직 쓰지 않는다.

3. v2 event log 이후 구매는 `order_code/value/event_id` 단위 후보 매칭표를 만든다.
   - 왜 하는가: TikTok Ads API가 일자별 245,000원 구매 1건을 주장하고, v2 event log가 같은 날 245,000원 confirmed 2건을 보이면 후보군까지는 좁힐 수 있다.
   - 한계: TikTok API가 order-level event export를 주지 않으면 최종 1:1 확정은 안 된다.
   - 자신감: **88%**. 후보군 축소는 가능하지만 exact attribution은 플랫폼 export 한계가 있다.

4. 예산 판단은 현재 상태에서 보수적으로 둔다.
   - 왜 하는가: 광고비 6,190,363원에 대해 내부 confirmed 0원이다. TikTok Ads의 4,493,392원은 아직 내부 확정매출로 인정할 수 없다.
   - 자신감: **78%**. 추가로 CTA/EVTA/VTA breakdown을 보면 85% 이상으로 올라갈 수 있다.

## 2026-04-23 official historical conclusion

이번 프로젝트의 구간 기준을 여기서 고정한다.

**과거 구간은 exact event-level attribution 복원을 목표로 하지 않는다.** 기존 v1이 TikTok Pixel 이벤트를 서버 원장에 쓰지 않았고, TikTok Ads API/CSV도 구매별 `event_id/order_code`를 제공하지 않기 때문이다. 따라서 과거는 business-level validation으로만 닫는다.

**미래 구간은 v2 event log 배포 이후부터 정확도 높은 정합성 기준으로 운영한다.** v2 이후에는 `event_id / order_code / order_no / payment_code / decision` 단위로 TikTok Purchase 흐름을 내부 원장에 남긴다. 예산 판단의 정본도 이 시점 이후 7일/14일 데이터를 기준으로 삼는다.

### 과거 데이터 3등급 종료 기준

| 등급 | 정의 | 현재 결론 | 후속 처리 |
|---|---|---|---|
| 1. 확정 취소/미입금 | 내부 Attribution 원장과 개발팀 관리 운영DB에서 미입금 자동취소 또는 취소로 닫힌 주문 | guard 전 TikTok 후보는 Attribution VM 원장 write 후 confirmed 0원, pending 0원, canceled 50건 / 552,263,900원이다. 이 중 48건은 2026-04-23에 `canceled/vbank_expired`로 보정 완료했다 | 종료. 더 파지 않는다 |
| 2. 실제 주문 존재 확인 | GA4/개발팀 관리 운영DB/Attribution 원장에서 실제 주문 존재는 확인되지만 TikTok Ads 구매와 exact 연결은 안 되는 주문 | 2026-04-18 ~ 2026-04-22 GA4 TikTok-ish purchase 중 개발팀 관리 운영DB 매칭 30건이 있었다. 상태는 `PAYMENT_COMPLETE` 28건 / 9,404,586원, `PAYMENT_OVERDUE` 1건 / 39,000원, `REFUND_COMPLETE` 1건 / 1,367,050원이다 | “실제 주문 존재”로만 기록. TikTok Ads 성과로 단정하지 않는다 |
| 3. 연결 불가 잔여분 | TikTok Ads가 구매를 주장하지만 내부 주문과 event-level로 붙일 수 없는 부분 | guard 전 구매 321건 / 구매값 910,630,888원, post-guard 초기 5일 구매 12건 / 구매값 3,456,232원은 order_code 단위 역분해가 불가능하다 | `unknown`으로 닫고 추가 수사 중단 |

### 판단 원칙

제1원칙 질문은 “과거 주문을 더 파면 앞으로 예산 판단이 실질적으로 더 좋아지는가?”다.

현재 답은 **대부분 아니다**. 과거 exact 복원은 구조적으로 불가능하고, 앞으로의 정확도는 v2 이벤트 로그 배포 이후 데이터 품질로 결정된다. 따라서 지금 중요한 일은 과거를 완벽하게 수사하는 것이 아니라, 다음 7일~14일 데이터를 신뢰 가능하게 만드는 것이다.

공식 문장:

> 과거 주문은 exact 매칭 복원을 목표로 하지 않는다. 다만 취소/확정/실주문 존재 여부 수준의 부분 검산까지만 하고, 이후 판단은 v2 이벤트 로그 배포 후 데이터로 한다.

### 2026-04-23 당시 액션

2026-04-25 기준 최신 실행 항목은 [[#다음 할일]]을 따른다. 아래는 2026-04-23 official conclusion을 만들 당시의 실행 계획 기록이다.

1. 과거 구간 official conclusion은 이 섹션으로 고정한다.
2. v2 이벤트 로그를 TJ 관리 Attribution VM에 배포하고, 아임웹 Guard를 v2로 교체한다. 이 작업은 TJ 관리 Attribution VM SQLite 새 테이블/헤더 코드 변경이므로 TJ 승인 후 진행한다.
3. 배포 직후에는 카드/가상계좌 실결제 전에 `POST -> DB insert -> GET readback -> browser CORS -> live source v1 제거/v2 단일 삽입`까지 먼저 확인한다.
4. 7일/14일 동안 TikTok Ads 구매, `tiktok_pixel_events`, TJ 관리 Attribution VM `payment_success`, 개발팀 관리 운영DB PostgreSQL 주문 상태를 같이 본다.
5. 예산 판단은 이 7일/14일 데이터로 재확정한다.

Codex 판단(2026-04-23 당시):

- 과거 구간을 3등급으로 닫는 판단 자신감: **95%**.
- v2 배포 후 7일/14일 관찰을 다음 의사결정 기준으로 삼는 판단 자신감: **92%**.
- 당시 남은 핵심 리스크: 운영 배포 전이므로 `tiktok_pixel_events`는 아직 TJ 관리 Attribution VM에 없었다. v2 배포가 늦어질수록 post-guard 데이터도 계속 exact 연결 불가 상태로 쌓이는 구조였다.

## 2026-04-23 v2 rollout gate 강화

`tiktok/gptfeedback_0423_1.md` 기준으로, 헤더 교체 승인 조건을 더 엄격하게 고정한다.

### 교체 승인 조건

아래 7개가 모두 맞아야 아임웹 Header Code를 v2로 교체한다.

| 체크 | 기준 |
|---|---|
| backend 배포 | TJ 관리 Attribution VM backend 배포 완료 |
| health | `GET /health`가 `status: "ok"` 또는 동등한 정상 응답 |
| event endpoint | `POST /api/attribution/tiktok-pixel-event`가 2xx |
| DB insert | `tiktok_pixel_events`에 실제 row 저장 |
| GET readback | `GET /api/attribution/tiktok-pixel-events?...`에서 방금 row 확인 |
| browser CORS | `biocom.kr` 브라우저에서 cross-origin POST 성공 |
| live source 교체 확인 | live source에서 `2026-04-17...v1`은 0회, `2026-04-23...v2-event-log`는 1회 |

중요: **2xx만으로는 승인하지 않는다.** 실제 write와 readback이 같이 확인돼야 한다.

### 새 smoke script

- 경로: [tiktok-pixel-event-smoke.ts](/Users/vibetj/coding/seo/backend/scripts/tiktok-pixel-event-smoke.ts)
- 목적: `GET /health`, `OPTIONS` preflight, `POST /api/attribution/tiktok-pixel-event`, `GET /api/attribution/tiktok-pixel-events?orderCode=...`, `Access-Control-Allow-Origin`을 한 번에 확인
- 예시 실행:

```bash
cd /Users/vibetj/coding/seo/backend
node --import tsx scripts/tiktok-pixel-event-smoke.ts --baseUrl https://att.ainativeos.net --origin https://biocom.kr
```

이 스크립트는 backend readiness 확인용이다. **실제 브라우저 콘솔 fetch와 live source 문자열 검증은 별도로 해야 한다.**

### 로그 해석 규칙

`tiktok_pixel_events`는 event log 테이블이라서 row 수를 그대로 구매 수로 읽으면 안 된다.

- 카드 1건도 `purchase_intercepted -> decision_received -> released_confirmed_purchase`처럼 3 row가 생길 수 있다.
- 가상계좌 pending 1건도 `purchase_intercepted -> decision_received -> blocked_pending_purchase -> sent_replacement_place_an_order`처럼 4 row가 생길 수 있다.

따라서 구매 수와 최종 상태는 **`eventId/orderCode/orderNo/paymentCode` 기준으로 묶고 마지막 stage를 본다.**

### 첫 1~2일 모니터링 우선순위

- `released_confirmed_purchase`
- `blocked_pending_purchase`
- `sent_replacement_place_an_order`
- `released_unknown_purchase`
- `missing_lookup_keys`
- `request_error`

`released_unknown_purchase`가 많이 나오면 현재 v2는 “정확한 guard”가 아니라 “로그가 달린 fail-open”에 가까운 상태로 해석해야 한다.

## 2026-04-23 기존 삽입 코드/CAPI/원장 공백 재점검

TJ 질문: “원래 TikTok 관련 코드가 헤더/푸터에 들어가 있지 않았나, CAPI가 안 되어 있었나, 내부 원장에 왜 자료가 없는가?”

결론부터 말하면, **TikTok Pixel과 TikTok Purchase Guard는 운영 사이트에 들어가 있었다. 하지만 TikTok Events API/CAPI와 TikTok 이벤트 단위 내부 원장은 아직 운영에 없었다.** 그래서 TikTok Ads Manager나 Pixel Helper에는 구매/대체 이벤트가 보일 수 있지만, 내부 Attribution 원장에는 “TikTok Pixel Purchase가 실제로 언제 허용/차단됐는지”가 주문 단위로 남지 않았다.

현재 운영 사이트 HTML 직접 확인 결과:

| 항목 | 현재 운영 확인 | 의미 |
|---|---|---|
| Meta server payment decision guard | 있음. `[biocom-server-payment-decision-guard]` 코드 확인 | Meta Purchase 차단/허용 판단용 헤더 코드 |
| TikTok Purchase Guard | 있음. `2026-04-17.tiktok-purchase-guard-enforce.v1` 확인 | TikTok `Purchase`를 가로채서 pending 가상계좌는 막고 `PlaceAnOrder`로 대체 |
| TikTok Pixel | 있음. `TIKTOK_PIXEL.init('D5G8FTBC77UAODHQ0KOG')` 확인 | 아임웹 마케팅 탭 자동 주입 TikTok 브라우저 픽셀 |
| Attribution footer | 있음. `/api/attribution/checkout-context`, `/api/attribution/payment-success` 전송 확인 | 결제 페이지 도달/결제완료 페이지 도달을 내부 원장에 기록 |
| Funnel CAPI mirror | 있음. `2026-04-15-biocom-funnel-capi-v3` 확인 | Meta 퍼널 이벤트 mirror 코드 |
| Funnel server CAPI | 꺼짐. `enableServerCapi: false` 확인 | 현재 라이브 로그의 `[funnel-capi]`는 Meta용이며, 서버 전송은 비활성 |
| TikTok Events API/CAPI | 없음 | TikTok 서버 이벤트 전송 경로 없음 |
| TikTok event-level ledger | 운영 없음. `https://att.ainativeos.net/api/attribution/tiktok-pixel-events`는 `not_found` | 새로 개발한 `tiktok_pixel_events`는 아직 TJ 관리 Attribution VM 배포 전 |

혼동 지점:

- 운영 콘솔의 `[funnel-capi]`는 **Meta Pixel/fbq용**이다. TikTok CAPI가 아니다.
- TikTok Pixel은 브라우저에서 직접 TikTok으로 보내는 코드다. 이것만으로는 우리 내부 DB에 TikTok 이벤트 상세가 저장되지 않는다.
- 기존 Attribution 원장은 `checkout_started`와 `payment_success`만 받는다. 즉 “TikTok Pixel Purchase fired” 자체를 수집하지 않았다.
- 기존 내부 TikTok ROAS 판정은 `payment_success` row 안의 `ttclid`, TikTok UTM, TikTok referrer/landing 문자열을 보고 사후 분류했다. 결제완료 시점에 그 값이 사라지거나 다른 채널 값으로 덮이면 TikTok purchase로 잡히지 않는다.

운영 원장 상태 재확인:

- TJ 관리 Attribution VM 원장 `source=biocom_imweb`는 살아 있다. 2026-04-23 13:52 KST 조회 기준 전체 3,549건, `checkout_started` 2,131건, `payment_success` 1,418건이 있다.
- 2026-04-18 ~ 2026-04-22 기간에도 TJ 관리 Attribution VM 원장에는 `payment_success` 251건, `checkout_started` 672건이 있다. 즉 “원장 자체가 비어 있음”이 아니다.
- 같은 기간 TikTok ROAS 비교 로직이 찾은 TikTok `payment_success`는 0건이다. 이유는 원장이 TikTok Pixel 이벤트를 직접 기록하지 않았고, `payment_success` row 안에서도 TikTok 근거가 남지 않았기 때문이다.
- 로컬에는 `POST /api/attribution/tiktok-pixel-event`와 `tiktok_pixel_events` 개발이 끝나 있다. 하지만 TJ 관리 Attribution VM에는 아직 이 route가 배포되지 않았다.

v2 배포 후 과거 주문 복원 가능 범위:

- **완전 복원 불가**: v2 배포 전 TikTok Guard v1은 `purchase_intercepted`, `decision_received`, `blocked_pending_purchase`, `released_confirmed_purchase`를 브라우저 콘솔과 사용자 브라우저 `sessionStorage`에만 남겼다. 서버 영구 원장에 append하지 않았기 때문에, 과거 모든 주문의 TikTok Pixel 이벤트 흐름을 event_id/order_code 단위로 나중에 재생성할 수 없다.
- **부분 검산 가능**: 기존 TJ 관리 Attribution VM 원장의 `payment_success`, `checkout_started`, GA4 `purchase.transactionId`, TikTok Ads 집계 리포트, 개발팀 관리 운영DB PostgreSQL `tb_iamweb_users`, Toss/Imweb 상태를 대조해 “실제 주문/취소/확정 여부”와 “TikTok 근거가 남아 있는 주문 후보”는 확인할 수 있다.
- **정확히 안 되는 것**: TikTok Ads Manager가 주장한 과거 구매 12건 또는 guard 전 구매 321건이 각각 어떤 `order_code`였는지, 그리고 그때 Guard가 `released`했는지 `blocked`했는지는 기존 자료만으로 확정할 수 없다. TikTok 플랫폼 export/API가 이벤트 단위 `event_id`를 주지 않고, 기존 v1도 서버에 이벤트 로그를 쓰지 않았기 때문이다.
- **v2의 역할**: 과거를 복원하는 도구가 아니라, 배포 이후 발생하는 주문부터 TikTok Pixel 이벤트 흐름을 내부 원장에 남기는 방지책이다.

현재 가장 정확한 표현:

> “기존 헤더/푸터 코드는 있었다. 다만 TikTok CAPI와 TikTok 이벤트 단위 내부 로그는 없었다. 그래서 TikTok이 플랫폼에서 구매를 주장해도, 우리 내부 원장은 기존 `payment_success` 귀속 근거로만 TikTok 여부를 판단했고, Pixel Purchase 자체의 event_id/order_code 로그는 남기지 못했다.”

따라서 다음 병목은 새 코드 배포다. TJ 관리 Attribution VM에 `tiktok_pixel_events` 테이블과 endpoint를 배포하고, 아임웹 헤더의 TikTok Guard를 `2026-04-23.tiktok-purchase-guard-enforce.v2-event-log`로 교체해야 앞으로의 TikTok 구매 1건마다 `purchase_intercepted → decision_received → released_confirmed_purchase/block_pending` 흐름이 내부 원장에 남는다.

## 2026-04-23 추가 개발 결과

이번 업데이트의 결론은 두 가지다.

1. **캠페인별 TikTok 주장 ROAS는 현재 볼 수 있다.**
   - 위치: 로컬 프론트 `http://localhost:7010/ads/tiktok`의 **캠페인별 TikTok 주장 ROAS** 표.
   - 데이터 위치: 로컬 SQLite `backend/data/crm.sqlite3`의 `tiktok_ads_daily` 또는 `tiktok_ads_campaign_range`.
   - 의미: TikTok Ads/API가 캠페인에 귀속한 구매값 / 광고비다. 내부 확정매출 ROAS가 아니다.
   - 구현: 기간 합계 export가 없으면 일자별 campaign 테이블을 캠페인 단위로 합산하도록 `backend/src/tiktokRoasComparison.ts`를 보강했다.

2. **정확한 주문 단위 매칭은 앞으로의 이벤트 로그부터 가능하게 개발했다.**
   - 새 수신 endpoint: `POST /api/attribution/tiktok-pixel-event`.
   - 새 테이블: `tiktok_pixel_events`.
   - 데이터 위치: 배포 환경의 `CRM_LOCAL_DB_PATH#tiktok_pixel_events`. 운영 배포 시에는 **TJ 관리 Attribution VM SQLite** `/home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3#tiktok_pixel_events`가 된다. 로컬 개발 중에는 **내 맥북 로컬** `backend/data/crm.sqlite3#tiktok_pixel_events`다.
   - Guard 후보 코드: `tiktok/tiktok_purchase_guard_enforce_v1.js` 버전 `2026-04-23.tiktok-purchase-guard-enforce.v2-event-log`.
   - 수집 내용: `purchase_intercepted`, `decision_received`, `released_confirmed_purchase`, `blocked_pending_purchase`, `sent_replacement_place_an_order`, event_id, order_code, order_no, payment_code, decision status/branch/reason, ttclid, UTM, URL.
   - 한계: TikTok Business API의 캠페인 리포트는 집계 데이터라서 과거 12건 구매를 event_id/order_code 단위로 역분해하지 못한다. 이번 개발은 **앞으로 발생하는 이벤트**를 내부 원장에 남기는 보강이다.

### 현재 캠페인별 TikTok 주장 ROAS

기준: `2026-04-18 ~ 2026-04-22`, TikTok Business API/processed daily campaign 데이터. 이 표는 플랫폼 주장값이며, 같은 기간 TJ 관리 Attribution VM TikTok `payment_success` confirmed는 0건이다.

| 캠페인 | 광고비 | TikTok 구매수 | TikTok 구매값 | TikTok 주장 ROAS |
|---|---:|---:|---:|---:|
| 음과검 스마트+ 캠페인 | 2,398,503원 | 1 | 471,200원 | 0.20 |
| 종합대사기능 분석 스마트+캠페인 | 1,429,055원 | 5 | 921,952원 | 0.65 |
| 건강기능식품 스마트+캠페인 | 511,939원 | 4 | 1,173,580원 | 2.29 |
| 영양중금속분석 스마트+ 캠페인 | 500,217원 | 2 | 889,500원 | 1.78 |
| 호르몬 검사 캠페인 | 0원 | 0 | 0원 | - |

참고 14일 조회(`2026-04-09 ~ 2026-04-22`) 기준 플랫폼 주장 ROAS는 영양중금속분석 2.45, 건강기능식품 2.45, 종합대사 0.89, 음과검 0.66이다. 단, 이 역시 TikTok 주장값이다.

### 결제 페이지 17건 해석

2026-04-18 ~ 2026-04-22 TJ 관리 Attribution VM 원장 read-only 재점검 결과:

- TikTok `checkout_started`: 17건 / 고유 `order_no` 17개 / 고유 `order_code` 17개 / `ttclid` 17건.
- 같은 17개 `order_no`를 개발팀 관리 운영DB PostgreSQL `public.tb_iamweb_users`에서 조회했을 때 매칭 0건.
- 같은 기간 개발팀 관리 운영DB PostgreSQL 자체에는 주문 327건이 있었다. 즉 아임웹 주문 DB 전체 sync가 끊긴 것은 아니다.
- 해석: 이 17건은 “가상계좌 미입금 후 자동취소된 주문 17건”으로 보기 어렵다. 결제 페이지까지 도달했지만 최종 주문 DB에 남는 주문으로 성립하지 않았거나, 아임웹의 임시 order_no가 최종 주문번호와 달라졌을 가능성이 더 크다.
- 남은 가능성: 현재 Attribution 원장은 checkout 단계와 TikTok 플랫폼 구매 이벤트 사이의 event_id/order_code 단위 연결고리가 없다. 그래서 기존 데이터만으로는 TikTok 구매 12건이 이 17건 중 무엇인지 확정할 수 없다.

이번 v2 이벤트 로그의 목적이 바로 이 빈칸을 막는 것이다. 앞으로는 TikTok Purchase Guard가 본 order_code/order_no/payment_code와 서버 decision을 `tiktok_pixel_events`에 남기므로, “결제페이지 도달 → Purchase 허용/차단 → 실제 주문 DB 상태” 흐름을 주문 단위로 볼 수 있다.

### GA4 추가 교차검증

2026-04-23 13:45 KST에 GA4 바이오컴 property `304759974`, TJ 관리 Attribution VM 원장, 개발팀 관리 운영DB PostgreSQL `public.tb_iamweb_users`를 같이 대조했다. 기준 기간은 `2026-04-18 ~ 2026-04-22`다.

결론:

- **“TikTok Attribution 원장 기준 payment_success 0건”은 맞다.**
- 그러나 **“TikTok 관련 실제 주문이 아예 없다”는 표현은 현재 기준으로는 너무 강하다.**
- GA4의 `sessionSource/sessionMedium/sessionCampaignName`에 `tiktok`이 들어간 `purchase` 중 정상 주문번호 transaction_id는 개발팀 관리 운영DB에서 30건 매칭됐다.
- 이 30건의 운영 주문 상태는 `PAYMENT_COMPLETE` 28건 / 9,404,586원, `PAYMENT_OVERDUE` 1건 / 39,000원, `REFUND_COMPLETE` 1건 / 1,367,050원이다.
- 같은 30건 중 TJ 관리 Attribution VM 원장 `payment_success`에는 27건이 있었고, 26건 confirmed / 1건 canceled였다. 누락 3건은 NPay 계열로 보이며 기존 NPay return 누락 이슈와 연결된다.

중요한 해석:

1. GA4 세션 소스 기준 TikTok 구매와 TikTok Ads Manager의 구매 12건은 같은 것이 아니다. GA4는 사이트 세션 귀속이고, TikTok Ads Manager는 TikTok 자체 어트리뷰션 윈도우 귀속이다.
2. GA4 TikTok-ish purchase는 TikTok Ads API 구매 12건보다 훨씬 많고 금액도 크다. 따라서 GA4만으로 “TikTok Ads가 만든 구매”라고 단정하면 안 된다.
3. 운영 Attribution 원장에서는 이 GA4 TikTok-ish 주문 상당수가 Meta/Naver/Google/direct 등 다른 landing/UTM으로 남아 있다. 즉 채널 귀속 기준이 서로 다르다.
4. Attribution 원장 TikTok checkout 17건은 GA4 `purchase.transactionId`와도 0건 매칭, 개발팀 관리 운영DB와도 0건 매칭이었다. 이 17건은 여전히 “결제 페이지 도달 후 최종 주문으로 성립하지 않은 후보”로 보는 것이 맞다.

따라서 현재 문장 추천:

- 부정확: “TikTok으로 인한 실제 주문은 0건이다.”
- 정확: “내부 Attribution 원장 기준 TikTok payment_success는 0건이다. 다만 GA4 세션 소스 기준 TikTok-ish purchase는 개발팀 관리 운영DB에 실제 매칭되는 건이 있으므로, TikTok Ads 구매 12건과 내부 확정주문을 event_id/order_code 단위로 연결하는 v2 이벤트 로그가 필요하다.”

### 이번 개발 검증

- `npm --prefix backend run typecheck` 통과.
- `cd backend && node --import tsx --test tests/attribution.test.ts` 통과, 31개 테스트.
- `npm --prefix backend run build` 통과.
- `npm --prefix frontend run lint -- src/app/ads/tiktok/page.tsx` 통과.
- `node --check tiktok/tiktok_purchase_guard_enforce_v1.js` 통과.
- `buildTikTokRoasComparison('2026-04-18','2026-04-22')` 직접 호출 결과 캠페인별 row 5건과 플랫폼 ROAS가 반환됨을 확인했다.
- 임시 SQLite로 `tiktok_pixel_events` insert/list smoke 확인. `purchase_intercepted` 1건 write/list/summary 정상.
- 로컬 서버 `http://localhost:7020/api/attribution/tiktok-pixel-events?limit=1` 응답 정상. 현재 로컬 이벤트 로그 0건.
- 로컬 서버 `http://localhost:7020/api/ads/tiktok/roas-comparison?start_date=2026-04-18&end_date=2026-04-22` 응답에서 캠페인 row 5건 반환 확인.

운영 반영 전 주의: `tiktok_pixel_events`는 새 DB 테이블이다. TJ 관리 Attribution VM 배포와 아임웹 헤더 코드 교체는 DB 스키마/운영 코드 변경이므로 TJ 승인 후 진행한다.

## 원장 위치 기준

앞으로 이 문서에서 “원장” 또는 “DB”를 말할 때는 반드시 아래처럼 위치를 같이 쓴다.

| 이름 | 위치 | 무엇을 담는가 | 이번 프로젝트에서 쓰는 방식 |
|---|---|---|---|
| TikTok ROAS용 Attribution 원장 | **TJ 관리 Attribution VM** `https://att.ainativeos.net/api/attribution/ledger` | 결제완료 페이지에서 들어온 `payment_success`, 광고 유입값, `ttclid`, 결제 상태, 금액 | `/ads/tiktok`과 `backend/src/tiktokRoasComparison.ts`가 read-only로 조회하는 내부 ROAS 기준 원장 |
| 개발팀 관리 운영DB 아임웹 주문 테이블 `tb_iamweb_users` | **개발팀 관리 운영DB PostgreSQL** `public.tb_iamweb_users` | 아임웹 주문번호, 상품 라인, 결제수단, 주문상태, 취소사유, 금액 | 가상계좌가 24시간 후 `PAYMENT_OVERDUE` 자동취소됐는지 확인하는 정본 |
| 로컬 SQLite `backend/data/crm.sqlite3` | **내 맥북 로컬** | TikTok Ads CSV/API 캐시, 로컬 Imweb/Toss 스냅샷, 개발용 분석 테이블 | Ads CSV/API 적재와 화면 개발용 캐시. 운영 최신 주문 상태 정본으로 쓰지 않음 |
| Toss direct API | **외부 Toss Payments API** | paymentKey/orderId 기준 PG 결제 상태 | 실시간 결제 판정 보조. 가상계좌 만료 후에도 `pending`처럼 보일 수 있어 Imweb overdue 보조 판정이 필요 |

정리하면, **TikTok ROAS용 Attribution 원장은 로컬이 아니라 TJ 관리 Attribution VM 원장이다.** 로컬 서버는 그 원장을 읽어 화면과 분석을 만드는 클라이언트 역할을 한다. 로컬 SQLite는 TikTok Ads 데이터와 개발용 캐시이며, 이번 49건 pending 이슈의 상태 정본은 아니다.

## 다음 할일 상세 기록 (2026-04-25 기준)

1. **[운영 확인] 2026-04-24 가상계좌 테스트 주문의 24시간/48시간 상태를 확인한다.**
   - 왜 하는가: Guard v2는 가상계좌 미입금 주문을 TikTok `Purchase`가 아니라 `PlaceAnOrder`로 보내고 있다. 24시간 후 아임웹 주문이 자동취소되고, 내부 원장도 `canceled/vbank_expired` 또는 동등 상태로 따라오는지 봐야 sync가 끊겼는지 판단할 수 있다.
   - 어떻게 하는가: 테스트 주문번호 `202604247459692`와 `202604248221933`를 개발팀 관리 운영DB, TJ 관리 Attribution VM 원장, v2 `tiktok_pixel_events`에서 각각 조회한다. 2026-04-25 23:33 KST 이후 24시간 체크, 2026-04-26 23:33 KST 이후 48시간 체크를 한다.
   - 원장/DB 위치: 주문 상태 정본은 **개발팀 관리 운영DB PostgreSQL** `public.tb_iamweb_users`, 이벤트 흐름은 **TJ 관리 Attribution VM SQLite** `#tiktok_pixel_events`, 화면 캐시는 **내 맥북 로컬 SQLite** `#tiktok_ads_daily`다.
   - 진행 추천/자신감: **100%**. 확인만 하는 read-only 작업이고, 24시간 자동취소 정책 검증에 직접 필요하다.

2. **[완료 후 관찰] `/ads/tiktok`에서 2026-04-18 ~ 2026-04-24 7일 구간을 본다.**
   - 왜 하는가: 2026-04-23 비용 0원은 미수집 문제였고, API 수집 후 실제 광고비가 들어왔다. 이제 최근 7일 기준으로 TikTok 주장 ROAS와 내부 확정매출 gap을 봐야 한다.
   - 어떻게 하는가: `http://localhost:7010/ads/tiktok`에서 기간을 `2026-04-18 ~ 2026-04-24`로 둔다. 플랫폼 주장값은 TikTok Ads API, 내부 확정매출은 TJ 관리 Attribution VM 원장 기준이다.
   - 원장/DB 위치: 광고 데이터는 **내 맥북 로컬 SQLite** `backend/data/crm.sqlite3#tiktok_ads_daily`다. 내부 확정매출 비교는 **TJ 관리 Attribution VM 원장**을 read-only로 조회한다.
   - 진행 상태: 2026-04-25 21:43 KST API 수집 완료. 7일 합계 광고비 6,190,363원, TikTok 주장 구매 17건 / 4,493,392원, 플랫폼 ROAS 0.7259, 내부 confirmed 0건 / 0원이다.
   - 진행 추천/자신감: **96%**. 데이터 수집은 충분하다. 단, 플랫폼 주장값을 실제 매출로 보면 안 된다.

3. **[다음 수집] 2026-04-25 이후 데이터는 날짜가 닫힌 뒤 다시 API 수집한다.**
   - 왜 하는가: 당일 광고 데이터는 TikTok에서 늦게 확정될 수 있다. 오늘 값까지 바로 넣으면 비용/구매가 흔들릴 수 있다.
   - 어떻게 하는가: 2026-04-26 오전 이후 `--start-date 2026-04-25 --end-date 2026-04-25 --write-processed-daily`로 하루치를 추가 수집한다. 14일 판단은 2026-05-01 이후 같은 방식으로 다시 본다.
   - 원장/DB 위치: 수집 산출물은 **로컬 파일** `data/ads_csv/tiktok/api/`와 `data/ads_csv/tiktok/processed/`, 화면 캐시는 **내 맥북 로컬 SQLite** `#tiktok_ads_daily`다.
   - 진행 추천/자신감: **93%**. API 파이프라인은 작동한다. 남은 변수는 TikTok의 리포트 확정 지연뿐이다.

4. **[예산 판단] 소재 교체/일시중단 판단은 내부 confirmed가 0원인 점을 중심에 둔다.**
   - 왜 하는가: 최근 7일 TikTok은 구매 17건을 주장하지만, TJ 관리 Attribution VM 원장 기준 confirmed는 0건 / 0원이다. 이 상태에서 TikTok 주장 ROAS만 보고 증액하면 판단이 흔들린다.
   - 어떻게 하는가: 24/48시간 가상계좌 체크와 v2 event log를 먼저 본다. 그 뒤에도 내부 confirmed가 계속 0이면, 기존 소재는 보수적으로 중단 또는 축소하고 새 소재 테스트 예산으로 전환하는 판단이 맞다.
   - 원장/DB 위치: 예산 판단의 내부 기준은 **TJ 관리 Attribution VM 원장**과 **개발팀 관리 운영DB PostgreSQL 주문 DB**다. TikTok Ads API는 플랫폼 주장값으로만 쓴다.
   - 진행 추천/자신감: **62%**. 광고비와 플랫폼 데이터는 충분하지만, “실제 돈을 벌고 있는가”는 event-level 연결과 주문 상태 24/48시간 확인이 더 필요하다.

## 이번 1~4 운영 진행 결과

2026-04-23 12:26 KST 기준 Codex가 조건부 승인 범위 안에서 처리한 결과다. **TJ 관리 Attribution VM 원장 write를 완료했다.**

1. 운영 pending write:
   - TJ 승인 범위: TJ 관리 Attribution VM 배포 → dry-run 결과 확인 → 백업/롤백 확인 → 실제 write.
   - write 전 운영 ROAS API 기준 남은 TikTok pending은 49건이 아니라 48건이었다. 1건은 이미 별도 sync로 `canceled`가 된 것으로 보인다.
   - 넓은 전체 write dry-run은 `updatedRows=133`까지 잡혔다. 승인 범위를 넘으므로 중단하고 `orderIds` 제한 필터를 추가했다.
   - 제한 dry-run: `totalCandidates=48`, `matchedRows=48`, `updatedRows=48`, `writtenRows=0`, `imwebOverdueRows=48`, skipped 0.
   - 실제 write: `totalCandidates=48`, `matchedRows=48`, `updatedRows=48`, `writtenRows=48`, skipped 0.
   - post-write 확인: 같은 48개 orderId dry-run 재실행 시 `totalCandidates=0`. 개발팀 관리 운영DB 직접 조회도 48/48 `canceled`, 남은 pending 0.

2. 백업과 롤백:
   - write 직전 DB 백업: `/home/biocomkr_sns/seo/shared/backups/crm.sqlite3.pre_tiktok_48_write_20260423_032231.bak`.
   - 배포 전 DB 백업: `/home/biocomkr_sns/seo/shared/backups/crm.sqlite3.pre_tiktok_overdue_sync_20260423_030921.bak`.
   - 배포 전 dist 백업: `/home/biocomkr_sns/seo/shared/deploy-backups/20260423_030921/backend-dist.prev.tgz`.
   - 운영 health: `https://att.ainativeos.net/health` = `ok`, background jobs enabled.

3. Imweb overdue sync:
   - 구현 파일: `backend/src/routes/attribution.ts`, `backend/tests/attribution.test.ts`.
   - 운영 배포 완료. `orderIds` 필터를 추가해 승인받은 48건만 write할 수 있게 했다.
   - 상태 선택 우선순위도 수정했다. Toss direct가 `pending`이어도 Imweb `PAYMENT_OVERDUE`가 있으면 `canceled/vbank_expired`가 이긴다.
   - 검증: backend typecheck 통과, attribution test 29개 통과, backend build 통과.

4. post-guard API 수집:
   - 원천: TikTok Business API `report/integrated/get`.
   - 저장 위치: 로컬 `data/ads_csv/tiktok/api/tiktok_business_api_campaign_daily_20260418_20260422.json`, `data/ads_csv/tiktok/api/tiktok_business_api_campaign_daily_20260418_20260422.csv`, `data/ads_csv/tiktok/processed/20260418_20260422_daily_campaign.csv`.
   - 수집 결과: 24행, 광고비 4,839,714원, 구매 12건, 구매값 3,456,232원, 플랫폼 ROAS 0.71414.
   - 내부 조인 결과: 같은 기간 TJ 관리 Attribution VM TikTok payment_success는 0건이다. 이는 “확정매출 0” 판단의 1차 근거지만, post-guard 기간이 짧아 며칠 더 누적 관찰이 필요하다.

## 10초 요약

- 이 로드맵의 목표는 TikTok이 보고한 구매값이 실제 확정매출인지 검증하고, 앞으로의 TikTok 예산 판단을 숫자로 할 수 있게 만드는 것이다.
- 결론은 명확하다. 2026-03-19 ~ 2026-04-17 TikTok 플랫폼 ROAS는 32.11이지만, 내부 confirmed 기준 ROAS는 0.00이다.
- API와 데이터 확보는 거의 끝났다. pending 상위 20건은 Codex가 TJ 관리 Attribution VM `payment-decision` endpoint로 read-only 직접 확인했고, 20건 모두 Toss 기준 `pending`이었다.
- 바이오컴 가상계좌 주문은 주문 후 24시간 이내 미입금이면 취소되는 것으로 확인됐다. 따라서 24시간을 넘긴 `WAITING_FOR_DEPOSIT` 주문은 후속 입금 가능성이 아니라 `vbank_expired` 후보로 봐야 한다.
- 2026-04-22 14:16 KST 재확인 결과, TikTok pending 49건은 전부 24시간 초과이며 개발팀 관리 운영DB `tb_iamweb_users` 기준 49건 모두 `VIRTUAL / PAYMENT_OVERDUE / 입금기간 마감으로 인한 자동 취소`였다.
- 중요한 맥락은 “자동취소를 못 받은 것”이라기보다 “아임웹 주문 DB에는 자동취소가 있는데, 당시 TikTok ROAS용 Attribution 원장에는 그 상태를 반영하는 sync가 없었다”는 점이다.
- 2026-04-23 12:24 KST 기준 남아 있던 48건을 TJ 관리 Attribution VM 원장에 `canceled/vbank_expired`로 반영했다. 이후 guard 전 기간 TikTok pending은 0건이다.
- 2026-04-18 ~ 2026-04-22 post-guard API 1차 수집 결과, TikTok은 구매 12건 / 구매값 3,456,232원을 보고하지만 TJ 관리 Attribution VM TikTok payment_success는 0건이다. Guard 이후에도 플랫폼 숫자와 내부 원장 차이를 계속 봐야 한다.

## Phase-Sprint 요약표

| Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|
| Phase0 | [[#Phase0-Sprint1]] | API 데이터 확보와 자동 수집 | Codex | 95% / 80% | [[#Phase0-Sprint1]] |
| Phase1 | [[#Phase1-Sprint2]] | TikTok 구매 이벤트 오염 제거 | TJ + Codex + Claude Code | 100% / 100% | [[#Phase1-Sprint2]] |
| Phase2 | [[#Phase2-Sprint3]] | 플랫폼 ROAS vs 내부 ROAS gap 확정 | TJ + Codex | 96% / 93% | [[#Phase2-Sprint3]] |
| Phase3 | [[#Phase3-Sprint4]] | Post-Guard 기간 재검증 | Codex + TJ | 65% / 40% | [[#Phase3-Sprint4]] |
| Phase4 | [[#Phase4-Sprint5]] | Source Precision 정리 | Codex + TJ | 82% / 65% | [[#Phase4-Sprint5]] |
| Phase5 | [[#Phase5-Sprint6]] | TikTok Events API 도입 여부 결정 | TJ + Codex + Claude Code | 20% / 0% | [[#Phase5-Sprint6]] |

## 고등학생 비유

이 프로젝트는 광고 회사가 보낸 성적표와 실제 통장 입금 내역을 맞춰보는 일이다. TikTok은 "9.1억 팔았다"고 말하지만, 우리 통장 기준으로 확정 입금된 TikTok 매출은 아직 0원이다.

## 문서 목적

이 문서는 TikTok ROAS 숫자가 왜 크게 달랐고, 어디까지 고쳤으며, 다음에 누가 무엇을 해야 하는지 대표와 개발팀이 같은 언어로 이해하도록 정리한다.

## 지표 체계

- 회사 북극성: 바이오컴 실제 확정매출. Toss `DONE` 상태만 확정 매출로 본다.
- 팀 핵심 지표: 채널별 확정매출 기반 ROAS.
- TikTok 플랫폼 ROAS: TikTok Ads Manager가 보고한 구매값 / TikTok 광고비.
- 내부 confirmed ROAS: 내부 Attribution 원장과 결제 상태가 confirmed인 매출 / TikTok 광고비.
- 내부 potential ROAS: 내부 confirmed + pending 매출 / TikTok 광고비.
- ROAS gap: TikTok 플랫폼 구매값 - 내부 confirmed 매출. 보조로 pending 포함 gap도 본다.

## 핵심 숫자

| 기준 | 매출 | 광고비 | ROAS |
|---|---:|---:|---:|
| TikTok 플랫폼 주장 | 910,630,888원 | 28,363,230원 | 32.11 |
| 내부 confirmed 기준 | 0원 | 28,363,230원 | 0.00 |
| 내부 confirmed + pending 현재 기준 | 0원 | 28,363,230원 | 0.00 |
| 내부 canceled 판정 주문 | 552,263,900원 | 28,363,230원 | 매출 제외 |

사실:
- 2026-03-19 ~ 2026-04-17 Business API dry-run은 147행을 반환했다.
- 같은 기간 API 비용 28,363,230원, 구매수 321건은 기존 CSV와 일치한다.
- 구매값은 `complete_payment * value_per_complete_payment`로 910,630,888원까지 복원된다. 기존 CSV 구매값 910,630,953원과 65원 차이다.
- TJ 관리 Attribution VM 원장 기준 TikTok payment_success는 50행이다. 2026-04-23 write 이후 confirmed 0건 / 0원, pending 0건 / 0원, canceled 50건 / 552,263,900원이다.
- pending 상위 20건은 합계 536,729,000원으로 과거 pending 금액의 약 97.4%였다. 2026-04-22 12:53 KST read-only 확인 결과 20건 모두 Toss 직접 API 기준 `pending`이었다.
- 바이오컴 가상계좌 입금기한은 24시간으로 확인됐다. `payment_time/order_time + 24시간`이 지난 미입금 주문은 ROAS상 확정매출이 아니라 `vbank_expired` 후보로 분리한다.
- 2026-04-22 14:16 KST 기준 TikTok pending 49건 중 24시간 미만은 0건이었다. 49건 전부 48시간도 넘겼고, 개발팀 관리 운영DB에서는 전부 `PAYMENT_OVERDUE` 자동취소 상태였다.
- 2026-04-23 12:24 KST 기준 남아 있던 48건은 TJ 관리 Attribution VM 원장에 `canceled/vbank_expired`로 write 완료했다. write 후 guard 전 기간 TikTok pending은 0건이다.

현재 판단:
- TikTok 데이터 수집 자체는 믿을 수 있다.
- 문제는 TikTok이 구매로 본 신호가 실제 확정매출인지다.
- pending 상위 20건과 남아 있던 전체 48건은 현재 확정매출이 아니다. 24시간 입금기한을 넘긴 건은 `vbank_expired`로 원장에 반영했다. 남은 일은 guard 이후 데이터가 같은 방식으로 깨끗해지는지 재검증하는 것이다.

## 핵심 원칙

1. 주문 생성은 구매가 아니다. Toss `DONE`만 확정매출이다.
2. 가상계좌 미입금은 TikTok `Purchase`가 아니라 `PlaceAnOrder`로 낮춘다.
3. 바이오컴 가상계좌는 주문 후 24시간 이내 미입금이면 취소된다. 24시간 경과 미입금은 매출 후보가 아니라 `vbank_expired` 후보로 본다.
4. API는 자동화 수단이다. 숫자 판단 기준을 대신하지 않는다.
5. Events API는 웹 이벤트가 부족하다는 것이 숫자로 확인될 때만 검토한다.
6. pending fate와 source precision을 닫기 전에는 TikTok 플랫폼 ROAS를 예산 증액 근거로 쓰지 않는다.

## Phase별 계획

### Phase 0

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 데이터 확보와 API 자동화

- 목표: TikTok Ads Manager 숫자를 수동 CSV가 아니라 Business API로 반복 조회한다.
- 왜 지금 해야 하는가: 수동 CSV는 사람이 매번 내려받아야 한다. API가 열렸으므로 같은 기준의 일자별 데이터를 반복해서 받을 수 있다.
- 산출물: Business API access token, advertiser ID, API JSON/CSV 저장 스크립트, `tiktok_ads_daily` 적재용 CSV.
- 완료 기준: API 결과가 기존 CSV와 비용, 구매수, 구매값 기준으로 맞고, 로컬 SQLite `tiktok_ads_daily`에 안전하게 들어간다.
- 다음 Phase에 주는 가치: 플랫폼 숫자 수집 문제를 닫고, 실제 gap 원인 분해에 집중할 수 있다.

#### Phase0-Sprint1

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: API 데이터 확보와 자동 수집
**상태**: 우리 기준 95% / 운영 기준 80%

**무엇을 하는가**

TikTok Business API에서 캠페인별 일자 데이터를 가져와 JSON/CSV로 저장한다. 같은 데이터를 기존 `tiktok_ads_daily` 적재 경로가 읽을 수 있는 형태로도 만든다.

**왜 필요한가**

CSV를 수동으로 받으면 날짜 범위와 컬럼이 바뀔 수 있다. API로 고정하면 post-guard 기간과 과거 기간을 같은 규칙으로 비교할 수 있다.

**산출물**

- API 저장 스크립트: `backend/scripts/tiktok-business-report-dry-run.ts`
- API 원본 산출물: `data/ads_csv/tiktok/api/`
- processed CSV: `data/ads_csv/tiktok/processed/20260418_20260421_daily_campaign.csv`
- processed CSV 추가: `data/ads_csv/tiktok/processed/20260423_20260424_daily_campaign.csv`
- 로컬 적재 결과: `tiktok_ads_daily` 적재 경로 준비, 2026-04-18 ~ 2026-04-24 processed CSV 생성

**우리 프로젝트에 주는 도움**

이제 TikTok Ads 숫자를 사람이 내려받지 않아도 된다. 다음에는 "데이터가 있느냐"가 아니라 "그 데이터가 실제 매출과 맞느냐"를 볼 수 있다.

##### 역할 구분

- TJ: 개발팀 관리 운영DB write, TJ 관리 Attribution VM write, 또는 운영 사이트 배포 승인. TikTok Ads Manager 화면의 attribution window 설정 확인.
- Codex: Business API 조회, JSON/CSV 저장, 로컬 SQLite upsert, API 대조 리포트.
- Claude Code: `/ads/tiktok` 화면에서 API source 표시와 문구 정리.

##### 실행 단계

1. [Codex] Business API token 교환과 advertiser list 조회 — `(주)바이오컴_adv` / `7593201373714595856` 확인. 완료.
2. [Codex] 2026-03-19 ~ 2026-04-17 API dry-run — 147행, 비용 28,363,230원, 구매수 321건, 구매값 910,630,888원 확인. 완료.
3. [Codex] API 결과 저장 스크립트 작성 — JSON/CSV 저장과 `--write-processed-daily` 옵션 추가. 완료.
4. [Codex] 2026-04-18 ~ 2026-04-22 post-guard API 수집 — 24행, 비용 4,839,714원, 구매수 12건, 구매값 3,456,232원 확인. 완료.
5. [Codex] processed CSV 생성과 로컬 적재 경로 검증 — `data/ads_csv/tiktok/processed/20260418_20260422_daily_campaign.csv` 생성. 완료.
6. [Codex] API JSON/CSV와 기존 Ads Manager CSV 합계 자동 비교 리포트 추가. 의존성: 병렬가능. 기존 API 산출물과 CSV 파일만 있으면 진행 가능.
7. [TJ] 운영 반영 승인 — 이유: 개발팀 관리 운영DB write 또는 TJ 관리 Attribution VM write/화면 반영은 사업/운영 승인 필요.

### Phase 1

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 구매 이벤트 오염 제거

- 목표: 가상계좌 미입금이 TikTok `Purchase`로 들어가지 않게 한다.
- 왜 지금 해야 하는가: 구매 이벤트가 오염되면 TikTok이 잘못된 신호로 최적화한다.
- 산출물: TikTok Purchase Guard, 결제 판정 API, 운영 검증 로그.
- 완료 기준: 카드 결제는 `Purchase`, 가상계좌 미입금은 `PlaceAnOrder`로 분기된다.
- 다음 Phase에 주는 가치: guard 이후 데이터는 과거보다 깨끗한 기준선이 된다.

#### Phase1-Sprint2

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: TikTok 구매 이벤트 오염 제거
**상태**: 우리 기준 100% / 운영 기준 100%

**무엇을 하는가**

아임웹 결제완료 페이지에서 TikTok `Purchase`를 무조건 보내던 구조를 결제 상태별로 나눴다. 카드 결제 확정은 `Purchase`를 유지하고, 가상계좌 미입금은 `Purchase`를 차단한 뒤 `PlaceAnOrder`로 보낸다.

**왜 필요한가**

입금 전 가상계좌 주문을 구매로 세면 TikTok 플랫폼 ROAS가 실제보다 커진다. 예산 판단과 자동 입찰이 허수 숫자를 보고 움직인다.

**산출물**

- TikTok Browser Purchase Guard: `tiktok/tiktok_purchase_guard_enforce_v1.js`
- 결제 판정 API: `/api/attribution/payment-decision`
- 운영 검증: 가상계좌 1건 `PlaceAnOrder`, 카드 1건 `Purchase`

**우리 프로젝트에 주는 도움**

2026-04-17 이후 TikTok 구매 이벤트는 입금 상태를 반영한다. 과거 오염 규모는 post-guard 데이터와 비교해 역산할 수 있다.

##### 역할 구분

- TJ: 운영 헤더 적용, 실결제 테스트, Pixel Helper 확인.
- Codex: 결제 판정 API와 fail-open 안전장치 설계.
- Claude Code: Guard 스크립트와 아임웹 삽입 코드 정리.

### Phase 2

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 플랫폼 ROAS와 내부 ROAS gap 확정

- 목표: TikTok ROAS 32.11이 실제로 얼마나 과대인지 숫자로 확정한다.
- 왜 지금 해야 하는가: API와 CSV가 맞았으므로 이제 비즈니스 판단을 내려야 한다.
- 산출물: confirmed 기준 gap, pending 포함 gap, pending top 20 audit, gap waterfall.
- 완료 기준: pending 49건의 fate를 분류하고, 플랫폼 구매값 910.6M이 내부 매출로 얼마나 설명되는지 말할 수 있다.
- 다음 Phase에 주는 가치: post-guard 개선 효과와 Events API 필요 여부를 판단할 수 있다.

#### Phase2-Sprint3

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: 플랫폼 ROAS vs 내부 ROAS gap 확정
**상태**: 우리 기준 96% / 운영 기준 93%

**무엇을 하는가**

TikTok 플랫폼 구매값과 내부 확정매출을 같은 기간으로 맞춘다. pending을 모두 인정한 최대 잠재 ROAS와 confirmed만 인정한 보수 ROAS를 분리한다.

**왜 필요한가**

현재 TikTok은 9.1억 구매값을 보고하지만 내부 confirmed는 0원이다. 이 차이가 가상계좌 미입금 때문인지, source 오귀속 때문인지, 실제 입금 지연 때문인지 나눠야 한다.

**산출물**

- `/ads/tiktok` ROAS 비교 화면
- `daily_comparison` 30행
- pending 상위 20건 audit
- ROAS Gap Waterfall 초안

**우리 프로젝트에 주는 도움**

TikTok 예산을 증액, 유지, 축소할지 감이 아니라 숫자로 판단할 수 있다.

##### 역할 구분

- TJ: pending 주문 확인 결과를 운영 판단에 반영. 필요 시 아임웹/Toss 관리자 화면 스크린샷 확보.
- Codex: TJ 관리 Attribution VM 원장 read-only 조회, Toss direct read-only 확인, gap 계산, waterfall 화면, pending fate 데이터 구조.
- Claude Code: 대표 보고용 문구와 waterfall UX 정리.

##### 실행 단계

1. [Codex] TJ 관리 Attribution VM 원장 read-only 조회 — 2026-03-19 ~ 2026-04-17 TikTok payment_success 50행 확인. 완료.
2. [Codex] confirmed/pending/canceled 집계 — write 전 confirmed 0원, pending 551,095,900원, canceled 750,000원 확인. write 후 confirmed 0원, pending 0원, canceled 552,263,900원 확인. 완료.
3. [Codex] `/ads/tiktok`에 ROAS Gap Waterfall 초안 추가 — 플랫폼 구매값, confirmed, pending, 설명 안 된 gap, high/low source 값 표시. 완료.
4. [Codex] pending audit row에 `fate` 필드 추가 — 기본값은 `still_pending`, 수동 확인 후 확정값으로 바꿀 수 있게 준비. 완료.
5. [Codex] pending 상위 20건 직접 확인 가능성 분석 — 상위 20건 모두 `orderId`와 `paymentKey` 보유. TJ 관리 Attribution VM `payment-decision` endpoint가 Toss direct read-only 조회 가능. 완료.
6. [Codex] pending 상위 20건 Toss direct read-only 확인 — 20건 / 536,729,000원 모두 `pending`, `matchedBy=toss_direct_payment_key`, `browserAction=block_purchase_virtual_account`. 완료.
7. [TJ] Attribution VM 원장 write 반영 승인 여부 결정 — 2026-04-23 조건부 승인 완료. 범위는 운영 배포, dry-run 확인, 백업/롤백 확인, 실제 write다.
8. [Codex] 승인 범위 안에서 현재 남아 있던 48건을 `vbank_expired/canceled`로 write — dry-run 48/48 확인 후 실제 write 48건 완료. 2026-04-22에는 49건이었지만 write 직전 1건은 이미 `canceled`가 되어 남은 후보가 48건이었다.
9. [Codex + Claude Code] gap waterfall을 대표 보고용 수치로 고정. 의존성: 부분병렬. guard 전 수치는 고정 가능하고, guard 후 수치는 7일/14일 재수집 후 확정한다.

### Phase 3

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: Post-Guard 기간 재검증

- 목표: 2026-04-17 guard 이후 TikTok 플랫폼 구매값이 실제로 깨끗해졌는지 확인한다.
- 왜 지금 해야 하는가: 과거 대부분은 guard 이전이다. 우리가 고친 효과는 guard 이후를 따로 봐야 한다.
- 산출물: guard 전후 일자별 비교, post-guard ROAS, pending 비율 변화.
- 완료 기준: guard 이후 플랫폼 구매값, internal confirmed/pending, `PlaceAnOrder` 증가 여부를 같은 기간으로 설명한다.
- 다음 Phase에 주는 가치: Events API가 필요한지, 웹 이벤트만으로 충분한지 판단한다.

#### Phase3-Sprint4

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: Post-Guard 기간 재검증
**상태**: 우리 기준 55% / 운영 기준 35%

**무엇을 하는가**

2026-04-18 이후 TikTok API와 TJ 관리 Attribution VM 원장을 같은 날짜로 맞춘다. guard 전과 guard 후를 분리해 platform ROAS와 internal ROAS의 gap이 줄었는지 본다.

**왜 필요한가**

guard가 잘 동작해도 TikTok 플랫폼 숫자가 실제로 정상화됐는지 확인해야 한다. 실제 운영 효과는 post-guard 기간에서만 판단할 수 있다.

**산출물**

- API 산출물: `data/ads_csv/tiktok/api/tiktok_business_api_campaign_daily_20260418_20260421.{json,csv}`
- processed CSV: `data/ads_csv/tiktok/processed/20260418_20260421_daily_campaign.csv`
- `daily_comparison` post-guard 4일 결과

**우리 프로젝트에 주는 도움**

guard 적용이 실제로 TikTok 플랫폼 구매값을 낮추고 pending 오염을 줄였는지 알 수 있다.

##### 역할 구분

- TJ: 2026-04-18 이후 TikTok Events Manager에서 Purchase/PlaceAnOrder 추세 확인. 로그인 필요.
- Codex: API 수집, 로컬 적재, TJ 관리 Attribution VM read-only 조인, 일자별 gap 계산.
- Claude Code: guard 전후 화면 비교 UX와 설명 문구 정리.

##### 실행 단계

1. [Codex] 2026-04-18 ~ 2026-04-22 API 수집 — 24행, 비용 4,839,714원, 구매수 12건, 구매값 3,456,232원 확인. 완료.
2. [Codex] processed CSV 생성 후 로컬 적재 경로 검증 — `20260418_20260422_daily_campaign.csv` 생성. 완료.
3. [Codex] TJ 관리 Attribution VM read-only 조인 — post-guard 5일 기준 confirmed 0원, pending 0원, platform purchase value 3,456,232원 확인. 완료.
4. [Codex] 2026-04-18 ~ 2026-04-24 API 수집. 의존성: 선행필수. 2026-04-24가 지나야 정확한 기간 조회 가능.
5. [Codex] 2026-04-18 ~ 2026-05-01 API 수집. 의존성: 선행필수. 2026-05-01이 지나야 정확한 기간 조회 가능.
6. [TJ] Events Manager에서 post-guard Purchase 감소와 PlaceAnOrder 증가 확인 — 이유: 로그인 필요한 외부 dashboard 확인.
7. [Codex + Claude Code] guard 전후 비교 카드를 `/ads/tiktok`에 고정. 의존성: 부분병렬. 현재 4일 데이터로 초안 가능, 최종 판단은 4번/5번 기간이 필요하다.

### Phase 4

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: Source Precision 정리

- 목표: TikTok 귀속 주문이 진짜 TikTok에서 온 것인지 근거 강도별로 나눈다.
- 왜 지금 해야 하는가: TikTok을 무조건 나쁘게 보거나 무조건 믿는 것은 둘 다 위험하다.
- 산출물: high/medium/low source tier, high-confidence ROAS, broad ROAS, low 제외 후보.
- 완료 기준: official 기준과 broad 기준을 나눠 예산 판단에 쓸 수 있다.
- 다음 Phase에 주는 가치: Events API나 예산 판단이 source 오귀속에 흔들리지 않는다.

#### Phase4-Sprint5

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: Source Precision 정리
**상태**: 우리 기준 75% / 운영 기준 60%

**무엇을 하는가**

TikTok 귀속 근거를 high, medium, low로 나눈다. `ttclid` 직접 근거는 high, UTM 근거는 medium, referrer/metadata만 있는 넓은 기준은 low로 본다.

**왜 필요한가**

같은 TikTok 후보라도 신뢰도가 다르다. high 근거와 low 근거를 섞으면 "TikTok이 전혀 안 된다"와 "귀속 기준이 넓다"를 구분할 수 없다.

**산출물**

- source reason summary
- source precision summary
- `/ads/tiktok` ROAS Gap Waterfall의 high/low 금액
- pending 상위 20건 source tier 표시

**우리 프로젝트에 주는 도움**

예산 판단을 broad 기준과 conservative 기준으로 나눌 수 있다. 진짜 TikTok 클릭 근거가 있는 주문만 따로 볼 수 있다.

##### 역할 구분

- TJ: high pending 주문 중 실제 입금/미입금 상태 확인.
- Codex: source tier 집계, waterfall 수치, pending audit 구조.
- Claude Code: source tier 설명 문구와 표 가독성 개선.

##### 실행 단계

1. [Codex] source reason 코드화 — `ttclid_direct`, `ttclid_url`, `utm_source_tiktok`, `metadata_url_tiktok` 등. 완료.
2. [Codex] source precision summary 추가 — high 49건 / 552,242,000원, medium 0건 / 0원, low 1건 / 21,900원 확인. 완료.
3. [Codex] `/ads/tiktok`에 high/low 금액을 waterfall로 표시. 완료.
4. [TJ] high pending 상위 주문 실제 상태 확인 — 이유: 운영 주문 화면과 결제 관리자 확인 필요.
5. [Codex] high-confidence ROAS와 broad ROAS를 별도 지표로 고정. 의존성: 부분병렬. source tier는 준비됐고 fate 확인 결과가 있으면 official 기준을 닫을 수 있다.
6. [Claude Code] low source 제외 후보 UI 정리. 의존성: 병렬가능. 현재 API 응답만으로 초안 가능.

### Phase 5

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: TikTok Events API 도입 여부 결정

- 목표: 서버에서 TikTok Events API를 보낼지 말지 결정한다.
- 왜 지금 해야 하는가: 지금 바로 붙이면 중복 Purchase와 dedup 실패가 생길 수 있다. 판단은 Phase 2~4가 닫힌 뒤 해야 한다.
- 산출물: Events API 도입 조건표, event_id dedup 규칙, 보류/진행 결정.
- 완료 기준: 웹 이벤트만으로 부족한지 숫자로 확인하고, 서버 이벤트 중복 위험을 제거한다.
- 다음 Phase에 주는 가치: 서버 이벤트를 붙이더라도 오염을 다시 만들지 않는다.

#### Phase5-Sprint6

[[#Phase-Sprint 요약표|▲ 요약표로]]

**이름**: TikTok Events API 도입 여부 결정
**상태**: 우리 기준 20% / 운영 기준 0%

**무엇을 하는가**

TikTok Events API를 붙일 조건을 숫자로 판단한다. 가상계좌 후속 입금 시 서버 `Purchase`가 필요한지, 웹 `Purchase`와 같은 `event_id`로 중복 제거가 가능한지 본다.

**왜 필요한가**

Events API를 성급하게 붙이면 같은 주문을 두 번 구매로 세는 사고가 난다. 지금은 오염 제거와 gap 분해가 먼저다.

**산출물**

- Events API 도입 조건 3개
- 서버/웹 `event_id` dedup 규칙
- 진행 또는 보류 결정 기록

**우리 프로젝트에 주는 도움**

서버 이벤트를 붙여야 할 때도 안전하게 붙일 수 있다. 반대로 필요 없으면 개발 범위를 줄일 수 있다.

##### 역할 구분

- TJ: Events API 토큰 발급 승인과 최종 도입 판단.
- Codex: 서버 이벤트 계약, dedup 로직, 회귀 테스트.
- Claude Code: 웹/서버 이벤트 상태 화면과 운영 문구.

##### 실행 단계

1. [Codex] Phase 2~4 결과 확인 — confirmed 손실, pending fate, source precision을 숫자로 닫는다. 의존성: 선행필수. Events API 판단의 전제다.
2. [Codex] 서버 Purchase가 필요한 주문 유형 정의 — 예: 가상계좌 후속 입금. 의존성: 부분병렬. 초안은 가능하지만 fate 결과가 필요하다.
3. [Codex + Claude Code] 웹/서버 `event_id` dedup 규칙 설계 — `Purchase_{order_code}` 계열과 현재 관측값 비교. 의존성: 병렬가능.
4. [TJ] Events API 토큰 발급 승인 — 이유: 신규 외부 credential 발급과 운영 리스크 승인 필요.
5. [Codex] 서버 Events API 구현은 4번 승인 후 진행. 의존성: 선행필수.

## 승인 필요 항목

- [x] 운영 헤더 TikTok Guard enforce 적용.
- [x] TikTok Business API read-only access token 로컬 저장.
- [x] 로컬 SQLite `tiktok_ads_daily` 기존 스키마에 API 산출물 upsert.
- [x] pending 상위 20건 Toss direct read-only 현재 상태 확인.
- [x] pending 상위 20건 Attribution VM 원장 write 반영 승인.
- [x] pending 49건 전체 fate 확장 확인 및 현재 남은 48건 운영 write.
- [ ] 2026-04-24 이후 post-guard 1차 확장 조회.
- [ ] `/ads/tiktok` 변경 운영 반영 승인.
- [ ] TikTok Events API 토큰 발급. Phase 5 진입 시점에만 판단한다.

## Pending 상위 20건 확인 가능성 분석

결론: Codex가 확인할 수 있다. 2026-04-22에는 read-only 확인까지 했고, 2026-04-23 TJ 조건부 승인 후 현재 남아 있던 48건은 운영 원장에 write까지 완료했다.

2026-04-22 12:53 KST에 TJ 관리 Attribution VM 원장과 TJ 관리 Attribution VM `payment-decision` endpoint를 사용해 pending 상위 20건을 직접 확인했다. 상위 20건은 모두 `orderId`와 `paymentKey`가 있었고, Toss direct read-only 조회에서 20건 모두 `pending`으로 응답했다. 매칭 방식은 전부 `toss_direct_payment_key`였고, 정책상 browser action은 `block_purchase_virtual_account`다.

이번 확인 결과:

| 항목 | 결과 |
|---|---:|
| 확인 대상 | pending 상위 20건 |
| 금액 합계 | 536,729,000원 |
| pending 49건 금액 대비 비중 | 약 97.4% |
| Toss direct `confirmed` | 0건 |
| Toss direct `pending` | 20건 |
| Toss direct `canceled` 또는 `expired` | 0건 |

할 수 있는 것:

- [Codex] TJ 관리 Attribution VM 원장에서 pending 상위 주문을 뽑는다.
- [Codex] paymentKey 기준 Toss direct read-only 조회로 현재 결제 상태를 확인한다.
- [Codex] `/ads/tiktok` 화면과 문서에 현재 상태를 반영한다.

승인 없이 하지 않는 것:

- production Attribution 원장에 status/fate를 추가 write 반영하지 않는다.
- Toss나 아임웹 주문 상태를 변경하지 않는다.
- 운영 배포나 스키마 변경을 하지 않는다.

남은 한계:

- 2026-04-22 확인은 "Toss direct 상태가 아직 pending"이라는 뜻이었다. 바이오컴 가상계좌는 24시간 이내 미입금 시 취소되므로, 주문 후 24시간이 지난 pending은 후속 입금 가능성보다 `vbank_expired`로 봤다.
- 2026-04-23 write 직전에는 49건 중 1건이 이미 `canceled`가 되어 있었고, 남은 48건만 제한 write했다.
- 대표 보고용 official 숫자는 guard 전 기간에 대해 확정 가능하다. guard 후 기간은 7일/14일 단위로 더 쌓아야 한다.

## 현재 병목

1. **post-write 관찰 필요**: TikTok pending 48건 write는 끝났다. 이제 같은 유형의 Imweb `PAYMENT_OVERDUE`가 새로 생겼을 때 15분 주기 status sync가 자동으로 원장에 반영하는지 봐야 한다.
2. **post-guard 기간 부족**: 2026-04-18 ~ 2026-04-22 5일은 수집했지만, 2026-04-24와 2026-05-01 비교는 아직 날짜가 지나지 않았다.
3. **source precision 기준 미확정**: high 기준을 official로 볼지, broad 기준을 보조로 볼지 결정해야 한다.
4. **운영 예산 판단 보류**: guard 전 confirmed ROAS는 0이고 pending도 canceled로 닫혔다. 예산 증액 근거는 약하다. 다만 최종 축소/유지 판단은 guard 후 7일/14일 데이터를 보고 고정한다.

## 다음 액션

- 지금 당장:
  - [Codex] API 산출물과 기존 CSV 합계 비교 리포트 자동화.
  - [Codex] 2026-04-23 write 결과를 `/ads/tiktok`에서 재확인하고, pending 0 / canceled 50 표시가 유지되는지 본다.
  - [Codex] status sync 자동 주기에서 새 Imweb `PAYMENT_OVERDUE`가 들어왔을 때 `canceled/vbank_expired`로 승격되는지 다음 overdue 발생 시 확인한다.
  - [TJ] `/ads/tiktok` 운영 화면이 최신 backend 결과를 제대로 표시하는지 확인한다.
- 이번 주:
  - [Codex] 2026-04-18 ~ 2026-04-24 API 재수집. 날짜가 지난 뒤 실행.
  - [Codex + Claude Code] `/ads/tiktok`에 guard 전후 비교 카드 보강.
  - [TJ] TikTok Ads Manager attribution window 화면 설정 확인.
- 운영 승인 후:
  - [TJ] `/ads/tiktok` 운영 반영 승인.
  - [Codex] API source를 정식 적재 흐름으로 고정.
  - [TJ + Codex] Events API는 Phase 2~4 결과를 보고 진행/보류 결정.

## 이번 로컬 검증

| 항목 | 결과 |
|---|---|
| Business API 인증 | 성공. access token은 `backend/.env`에 저장, 문서에는 미기록 |
| advertiser list | `(주)바이오컴_adv` = `7593201373714595856`, `바이오컴0109` = `7593240809332555793` |
| 2026-03-19 ~ 2026-04-17 API | 147행, 비용 28,363,230원, 구매수 321건, 구매값 복원 910,630,888원 |
| CSV 대비 API 차이 | 비용 0원, 클릭 0, 구매수 0, 노출 -23, 구매값 -65원 |
| 2026-04-18 ~ 2026-04-22 API | 24행, 비용 4,839,714원, 구매수 12건, 구매값 3,456,232원 |
| 로컬 SQLite | `tiktok_ads_daily` 적재 경로 준비, post-guard processed CSV 생성 |
| post-guard daily comparison | 5일, 플랫폼 ROAS 0.71414, Attribution confirmed/pending 0원 |
| source precision | high 49건 / 552,242,000원, medium 0건 / 0원, low 1건 / 21,900원 |
| pending top 20 direct check | 20건 / 536,729,000원, Toss direct `pending` 20건, confirmed 0건 |
| TJ 관리 Attribution VM 제한 dry-run | 48건 후보, 48건 `imweb_overdue_order_id -> canceled`, write 0 |
| TJ 관리 Attribution VM 실제 write | 48건 후보, 48건 write, skipped 0 |
| TJ 관리 Attribution VM post-write 확인 | 같은 48개 orderId dry-run `totalCandidates=0`, ROAS API pending 0 / canceled 50 |
| Backend typecheck | `npm --prefix backend run typecheck` 통과 |
| Frontend typecheck | `npx tsc --noEmit` 통과 |

## 2026-04-23 운영 write 결과

TJ 조건부 승인에 따라 TJ 관리 Attribution VM 원장에 남아 있던 TikTok pending을 제한 write했다.

조건부 승인 범위:

1. TJ 관리 Attribution VM 배포
2. TJ 관리 Attribution VM dry-run 결과 확인
3. 백업/롤백 경로 확인
4. 실제 write

중요한 범위 통제:

- 2026-04-22 재점검 시점에는 pending이 49건이었다.
- 2026-04-23 write 직전 운영 ROAS API에서는 pending이 48건이었다. 1건은 이미 별도 sync로 `canceled`가 된 것으로 보인다.
- 전체 dry-run은 `updatedRows=133`까지 잡혔다. 이대로 쓰면 승인 범위를 넘으므로 중단했다.
- `orderIds` 필터를 추가해 현재 남아 있던 48건만 대상으로 제한했다.

백업과 롤백:

| 항목 | 위치 |
|---|---|
| write 직전 DB 백업 | `/home/biocomkr_sns/seo/shared/backups/crm.sqlite3.pre_tiktok_48_write_20260423_032231.bak` |
| 배포 전 DB 백업 | `/home/biocomkr_sns/seo/shared/backups/crm.sqlite3.pre_tiktok_overdue_sync_20260423_030921.bak` |
| 배포 전 dist 백업 | `/home/biocomkr_sns/seo/shared/deploy-backups/20260423_030921/backend-dist.prev.tgz` |
| TJ 관리 Attribution VM SQLite 위치 | `/home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3` |

검증 결과:

| 단계 | 결과 |
|---|---:|
| 제한 dry-run `totalCandidates` | 48 |
| 제한 dry-run `matchedRows` | 48 |
| 제한 dry-run `updatedRows` | 48 |
| 제한 dry-run `writtenRows` | 0 |
| 실제 write `writtenRows` | 48 |
| post-write 같은 orderIds dry-run `totalCandidates` | 0 |
| 개발팀 관리 운영DB 직접 조회 | 48/48 `canceled`, 남은 `pending` 0 |
| ROAS API guard 전 pending | 0건 / 0원 |
| ROAS API guard 전 canceled | 50건 / 552,263,900원 |

해석:

- 이번 write는 Toss나 아임웹 주문 상태를 바꾼 것이 아니다.
- 이미 개발팀 관리 운영DB 아임웹 주문 테이블에서 `PAYMENT_OVERDUE` 자동취소였던 주문을, TikTok ROAS용 Attribution 원장에 뒤늦게 반영한 것이다.
- 따라서 내부 potential ROAS를 부풀리던 5.51억 pending은 더 이상 “입금될 수 있는 매출 후보”가 아니다.
- guard 전 기간의 내부 confirmed ROAS는 0.00으로 유지된다.

운영 배포 주의사항:

- 첫 배포 때 scp 대상 파일명이 겹쳐 PM2가 잠시 restart loop에 들어갔다.
- 즉시 full `backend/dist`를 다시 업로드해 복구했고, health는 `ok`로 확인했다.
- 이 사고 중에는 production DB write를 하지 않았다. 데이터 write는 health 복구, dry-run, 백업 확인 이후에만 실행했다.

## 2026-04-22 pending sync 재점검

TJ 확인값인 “가상계좌 24시간 미입금 시 취소”를 기준으로 TikTok pending 49건을 다시 점검했다.

먼저 장부 이름을 쉽게 풀면 다음과 같다.

| 장부 | 무엇을 담는가 | 이번 이슈에서 한 역할 |
|---|---|---|
| Attribution 원장 | 우리 코드가 결제완료 페이지에서 받은 `payment_success` 이벤트 기록. 광고 유입, `ttclid`, 결제 상태, 금액을 담는다 | TikTok에서 온 주문 후보 49건을 찾는 출발점 |
| Toss direct/API | PG사가 아는 결제 상태. 카드면 `DONE`, 가상계좌 미입금이면 대개 `WAITING_FOR_DEPOSIT` 계열로 보인다 | 브라우저 `Purchase`를 보낼지 막을지 판단하는 실시간 안전장치 |
| `tb_iamweb_users` | 개발팀 관리 운영DB PostgreSQL에 있는 아임웹 주문/상품 라인 원장. 이름은 users지만 실제로는 주문번호, 상품, 결제수단, 주문상태, 취소사유를 담는 개발팀 관리 운영DB다 | 가상계좌가 24시간 후 자동취소됐는지 확인하는 정본 |

이번 상황을 한 문장으로 말하면 이렇다.

**아임웹 개발팀 관리 운영DB는 이미 “자동취소 완료”를 알고 있었지만, 당시 TikTok ROAS용 Attribution 원장은 그 값을 status/fate로 반영하지 못하고 있었다.**

즉 receiver가 죽어서 주문을 못 받은 문제가 아니다. 결제완료 이벤트는 들어왔고, 개발팀 관리 운영DB도 살아 있다. 문제는 `PAYMENT_OVERDUE` 자동취소 상태를 Attribution 원장에 승격시키는 sync 단계가 아직 없었다는 점이다.

| 항목 | 결과 |
|---|---:|
| TikTok pending rows | 49 |
| pending 금액 | 551,095,900원 |
| 24시간 미만 pending | 0건 / 0원 |
| 24~48시간 pending | 0건 / 0원 |
| 48시간 초과 pending | 49건 / 551,095,900원 |
| pending loggedAt 범위 | 2026-04-02 01:31 KST ~ 2026-04-16 23:02 KST |
| Toss direct decision | 49건 모두 `pending / block_purchase_virtual_account` |
| 개발팀 관리 운영DB `tb_iamweb_users` 매칭 | 49/49 |
| 운영 주문 상태 | 49건 모두 `VIRTUAL / PAYMENT_OVERDUE / 입금기간 마감으로 인한 자동 취소` |

해석:

- TikTok pending 49건은 현재 24시간 미만 대기 주문이 아니다.
- 운영 receiver는 끊기지 않았다. 2026-04-22 14:05 KST 조회 기준 `biocom_imweb` 최신 `payment_success`는 2026-04-22 14:05 KST였다.
- 운영 health도 background job enabled, Attribution status sync enabled, 15분 주기다.
- TJ 관리 Attribution VM의 기존 `/api/attribution/sync-status/toss?dryRun=true&limit=500` 결과는 `updatedRows=42`, `skippedPendingRows=103`, `skippedNoMatchRows=147`이었다. 즉 운영 sync endpoint는 살아 있지만, 당시 운영 배포본은 Toss 중심이라 Imweb `PAYMENT_OVERDUE`를 ledger `canceled/vbank_expired`로 쓰는 단계가 없었다.
- 로컬 코드에는 Imweb overdue 기반 status sync를 추가했다. 2026-04-23에는 이 코드를 TJ 관리 Attribution VM에 배포했고, TJ 관리 Attribution VM dry-run 확인 후 TJ 조건부 승인 범위 안에서 현재 남아 있던 48건을 write 완료했다.

## 개발 부록

### 관련 코드·문서 위치

- `backend/scripts/tiktok-business-report-dry-run.ts` — TikTok Business API read-only report JSON/CSV 저장 스크립트.
- `data/ads_csv/tiktok/api/` — Business API dry-run 산출물.
- `data/ads_csv/tiktok/processed/20260418_20260422_daily_campaign.csv` — 최신 daily 적재 경로용 post-guard API 변환 CSV.
- `backend/src/tiktokRoasComparison.ts` — TikTok Ads 로컬 테이블 upsert, TJ 관리 Attribution VM 원장 조회, source precision 집계, gap 계산.
- `frontend/src/app/ads/tiktok/page.tsx` — TikTok ROAS 화면, ROAS Gap Waterfall, pending audit.
- `tiktok/tiktok_business_api_setup.md` — TikTok Business API 설정 런북.
- `tiktok/tiktok_purchase_guard_enforce_v1.js` — 운영 적용 TikTok Purchase Guard.

### 데이터 소스별 역할·한계

| 데이터 | 역할 | 한계 |
|---|---|---|
| TikTok Business API | 광고비, 구매수, 구매값 복원, 일자별 캠페인 데이터 | 캠페인명 차원을 직접 지원하지 않아 기존 CSV/DB 매핑을 붙인다 |
| TikTok Ads CSV | API 검증 기준과 과거 수동 백업 | 수동 export라 컬럼과 기간 실수가 생길 수 있다 |
| TJ 관리 Attribution VM 원장 | TikTok 후보 주문과 source reason 확인 | 결제완료 페이지 미도달 주문은 누락될 수 있다 |
| Toss/아임웹 주문 | 확정 입금과 주문 상태 판단 | 광고 유입 정보가 직접 들어있지 않다 |
| Pixel Helper/Events Manager | guard 이후 이벤트 수신 확인 | 로그인 화면이라 TJ 확인이 필요하다 |

### Source Precision 기준

| tier | 기준 | 현재 값 |
|---|---|---:|
| high | `ttclid_direct`, `ttclid_url`, `metadata_ttclid_url` | 49건 / 552,242,000원 |
| medium | TikTok UTM 근거만 있음 | 0건 / 0원 |
| low | referrer, landing, metadata URL 텍스트 근거 | 1건 / 21,900원 |

### 버전 기록

- **v3.26-marketing-intent-gtm-live** (2026-05-03 00:44 KST): TJ님 승인 범위 안에서 GTM Production publish 완료. live version `140 / tiktok_marketing_intent_v1_live_20260503`, 테스트 URL HTTP 201, direct URL 저장 0건, TJ 관리 Attribution VM ledger `touchpoint=marketing_intent` 확인. `/ads/tiktok`에 `오늘` quick range를 추가하고 2026-05-03 strict confirmed 11,900원, firstTouch 후보 별도, platform-only assisted 문구를 화면에서 확인했다. TikTok Events API/GA4/Meta/Google send, Purchase Guard 변경, 운영DB write는 하지 않았다.
- **v3.25-marketing-intent-card-test** (2026-05-03 00:24 KST): 같은 브라우저 카드 결제 테스트 통과. `marketing_intent -> checkout_started -> payment_success -> tiktok_pixel_events`가 같은 TikTok ttclid 흐름으로 이어졌고, status sync 후 `/ads/tiktok` strict confirmed 1건 / 11,900원 확인.
- **v3.21-gap-eventlog-wording-clarified** (2026-04-28 08:45 KST): 최근 7일 TikTok Ads 주장 구매 `21건 / 7,367,960원`과 내부 strict confirmed/pending 0원 gap을 재점검. TikTok UTM/`ttclid` checkout 후보 16건은 개발팀 관리 운영DB 주문 매칭 0건, v2 event log의 `released_confirmed_purchase`는 광고 귀속이 아니라 결제상태 confirmed라 Pixel Purchase를 전송했다는 뜻임을 문서화했다. `/ads/tiktok` 문구도 `확정 Purchase 허용`에서 `결제완료라 Purchase 전송`으로 바꾼다.
- **v3.20-card-firsttouch-purchase-verified** (2026-04-28 00:23 KST): 배포 후 카드 주문 `202604289758373` 검증. TikTok Pixel Helper는 `Purchase` 확인, VM `tiktok_pixel_events`에는 confirmed release 3행 기록, `payment-decision`은 `confirmed / allow_purchase / high`, `payment_success.metadata_json.firstTouch` 생성 및 status sync 후 `paymentStatus=confirmed` 확인. 유입은 direct라 TikTok match reason은 없음.
- **v3.19-vbank-firsttouch-verified** (2026-04-27 22:58 KST): 배포 후 가상계좌 주문 `202604275818534` 검증. TikTok Pixel Helper는 `PlaceAnOrder`만 확인, VM `tiktok_pixel_events`에는 pending block/replacement 4행 기록, `payment_success.metadata_json.firstTouch` 생성 확인. 유입은 direct라 TikTok match reason은 없음.
- **v3.18-first-touch-vm-deployed** (2026-04-27 21:08 KST): TJ 관리 Attribution VM backend `seo-backend` 배포 완료. DB/dist 백업 생성, 선별 파일 반영, PM2 restart/save, health/ROAS/ledger/tiktok_pixel_events smoke 통과. 기존 과거 구간 firstTouch 후보 0행은 정상이며 신규 주문부터 검증한다.
- **v3.17-first-touch-persistence-local** (2026-04-27 18:57 KST): 로컬 source-persistence 1차 구현 완료. `checkout_started`/`payment_success` receiver가 `metadata_json.firstTouch`를 보존하도록 하고, `/ads/tiktok`에 strict confirmed와 firstTouch 후보 confirmed/pending을 분리 표시했다. 운영DB PostgreSQL 스키마 변경은 없고, TJ 관리 Attribution VM 배포 전까지 운영 수집에는 미반영이다.
- **v3.16-db-location-terminology** (2026-04-27 00:00 KST): 운영DB, TJ 관리 Attribution VM, 로컬 개발 DB의 위치와 역할을 명시하고 DB 컬럼 언급 시 위치를 함께 쓰도록 정리했다.
- **v3.12-confirmed-zero-deep-dive** (2026-04-25 23:37 KST): 최근 7일 TikTok Ads 주장 구매 17건 / 4,493,392원과 내부 confirmed 0원 차이를 심층 분석. 운영 원장 1,474행 중 payment_success 406행, confirmed 349행은 있으나 TikTok 근거 payment_success는 0행임을 확인. TikTok 근거 checkout 21행은 결제완료로 이어진 증거가 없고, v2 event log의 confirmed는 광고 귀속이 아니라 Pixel Purchase 허용 기록임을 문서화했다.
- **v3.11-ads-api-refresh-0423-0424** (2026-04-25 21:45 KST): TikTok Business API로 2026-04-23 ~ 2026-04-24 캠페인×일자 데이터를 수집. 로컬 `tiktok_ads_daily` 범위가 2026-04-24까지 확장됐고, 최근 7일 합계는 광고비 6,190,363원, TikTok 주장 구매 17건 / 4,493,392원, 내부 confirmed 0건 / 0원으로 기록했다.
- **v3.10-historical-close-future-v2-standard** (2026-04-23 14:48 KST): 과거 구간을 exact event-level attribution 복원 대상에서 제외하고, business-level validation 3등급으로 닫는 official conclusion을 최상단에 고정. 미래 판단 기준은 v2 이벤트 로그 배포 이후 7일/14일 데이터로 전환.
- **v3.9-inserted-code-capi-gap-check** (2026-04-23 13:52 KST): 운영 HTML 직접 확인 기준으로 TikTok Guard v1/TikTok Pixel/Meta funnel CAPI mirror 존재, TikTok Events API와 TikTok event-level ledger 부재를 정리. v2 배포 전 과거 주문 exact 복원 불가와 부분 검산 가능 범위를 명시.
- **v3.8-event-level-logging-campaign-roas** (2026-04-23 13:28 KST): `POST /api/attribution/tiktok-pixel-event`, `tiktok_pixel_events`, Guard v2 event log 후보, 캠페인별 TikTok 주장 ROAS 합산 구현 결과를 문서 최상단에 반영.
- **v3.7-operational-48-write** (2026-04-23 12:26 KST): TJ 조건부 승인 범위에 따라 TJ 관리 Attribution VM 배포, DB/dist 백업, 제한 dry-run, 실제 write, post-write 검증 완료. write 직전 pending은 49건이 아니라 48건이었고, 48/48건을 `canceled/vbank_expired`로 반영했다. 운영 ROAS API 기준 guard 전 TikTok pending은 0건, canceled는 50건 / 552,263,900원이다.
- **v3.6-1to4-local-impl** (2026-04-23 11:57 KST): 최상단 1~4 진행 상태 업데이트. Imweb `PAYMENT_OVERDUE` 보조 sync 로컬 구현·dry-run, `/ads/tiktok` pending fate 요약, 2026-04-18 ~ 2026-04-22 TikTok Business API post-guard 수집 결과 기록. TJ 관리 Attribution VM 원장 write는 아직 미실행으로 명시.
- **v3.5-ledger-location-confidence** (2026-04-23 11:42 KST): 최상단에 원장 위치 기준 추가. TikTok ROAS용 Attribution 원장은 TJ 관리 Attribution VM이고, 로컬 SQLite는 Ads/API 캐시임을 명시. 다음 할일 4개에 Codex 진행 추천/자신감 %, 자료 충분성, 추가 확인 사항을 추가.
- **v3.4-next-actions-context** (2026-04-23 11:38 KST): 최상단에 다음 할일 4개를 추가. `tb_iamweb_users`가 운영 아임웹 주문/상품 라인 원장이라는 설명과, 자동취소 상태가 아임웹 DB에는 있었지만 Attribution 원장 sync에 반영되지 않았다는 맥락을 쉬운 말로 보강.
- **v3.3-pending-sync-recheck** (2026-04-22 14:16 KST): TikTok pending 49건 재점검. 49건 모두 24시간 초과, 개발팀 관리 운영DB `tb_iamweb_users` 기준 `VIRTUAL / PAYMENT_OVERDUE / 입금기간 마감으로 인한 자동 취소` 확인. `/ads/tiktok` pending audit은 24시간 초과 pending을 `expired_unpaid`로 표시하도록 로컬 코드 보정.
- **v3.2-vbank-expiry-24h** (2026-04-22 14:00 KST): 바이오컴 가상계좌 주문은 주문 후 24시간 이내 미입금 시 취소된다는 TJ 확인값을 반영. 24시간 경과 pending은 `vbank_expired` 후보로 분리하는 원칙을 추가.
- **v3.1-pending-top20-direct-check** (2026-04-22 12:53 KST): pending 상위 20건 확인 가능성 분석 추가. Codex가 TJ 관리 Attribution VM `payment-decision` endpoint로 paymentKey 기반 Toss direct read-only 확인 가능함을 검증했고, 상위 20건 / 536,729,000원 모두 현재 `pending`임을 기록.
- **v3.0-phase-roadmap** (2026-04-22 12:18 KST): `gptfeedback_0422_1` 반영. Phase 0~5 로드맵으로 재구성. API → `tiktok_ads_daily` 적재 초안, 2026-04-18 ~ 2026-04-21 post-guard API 수집, source precision summary, ROAS Gap Waterfall, pending audit fate 필드 반영.
- **v2.11-business-api** (2026-04-22 00:36 KST): TikTok Business API 승인 후 OAuth `auth_code` 교환 성공, `backend/.env`에 read-only access token과 advertiser ID 저장. Reporting API 2026-03-19 ~ 2026-04-17 캠페인×일자 147행 dry-run 성공.
- **v2.10-daily-join** (2026-04-19 09:27 KST): `tiktok_ads_daily`와 TJ 관리 Attribution VM 원장을 KST 날짜 기준으로 조인하는 `daily_comparison` API 응답 추가.
- **v2.9-daily** (2026-04-18 14:53 KST): 2026-03-19 ~ 2026-04-17 일별 CSV 수령·분석·적재 반영.
- **v2.8** (2026-04-18 13:33 KST): API 승인 전 Custom report + scheduled export 경로 고정, pending 상위 20건 audit API/프론트 추가.
- **v1 ~ v2.7**: Guard dry-run/enforce, CSV intake, TJ 관리 Attribution VM 원장 read-only 조회, `/ads/tiktok` 초기 화면 구축.
