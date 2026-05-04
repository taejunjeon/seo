# Data Check Plan

작성 시각: 2026-04-17 19:05 KST
최종 업데이트: 2026-05-04 11:30 KST
기준일: 2026-04-17
문서 성격: 가변형 기준 문서
참조 고정 스냅샷: `data/datacheck0406.md`, `data/datacheck0415.md`, `운영db.md`, `capivm/capi.md`
참조 증거 저장소: `data/roasphase.md` (2026-04-12 기준 Meta ROAS / CAPI dedup / 식별자 품질 / campaign alias의 주문 단위 증거)
참조 sub-plan: `data/!coffee_excel_backfill_plan.md` (더클린커피 엑셀 백필 정본 · phone 비마스킹 LTV 산정), `data/dbstructure.md` (3채널 DB 구조 · SQLite vs PG 검토), `data/bigquery_hurdlers_cutover_20260427.md` (biocom GA4 BigQuery 허들러스 해제·우리 쪽 이관 정본)
공통 하네스 정본: `harness/common/HARNESS_GUIDELINES.md`, `harness/common/AUTONOMY_POLICY.md`, `harness/common/REPORTING_TEMPLATE.md` (본 문서는 project-local 정합성 계획이며 공통 하네스 fork가 아님)

## 다음 할일로 임팩트가 큰 일 (2026-04-25 11:12 KST 기준)

### 2026-05-04 11:07 PASS_WITH_NOTES 피드백 반영 결론

검토 결론은 `PASS_WITH_NOTES`다.
방향은 맞다.
`/ads`가 stale 로컬 원장에 끌려다니지 않고 운영 VM attribution ledger를 기본 read-only 원천으로 보게 만든 것은 올바른 진행이다.
다만 "ROAS gap 해결 완료"가 아니라 "운영자가 매번 같은 기준 숫자를 보게 만드는 정본화 단계"로 봐야 한다.

이번 피드백에서 고정한 운영 원칙은 아래다.

1. 예산 판단 메인은 `Attribution confirmed revenue / Meta spend`다.
2. Meta 참고값 메인은 `1d_click`이다.
3. Meta 기본값은 Ads Manager parity 확인용이다.
4. 모든 ROAS 숫자에는 `queried_at`, `timezone`, `date_range`, `ledger_source`, `meta_attribution_window`, `spend_source`, `currency`, `rounding_rule`를 붙인다.
5. `ledger_source=auto`는 편하지만 화면에서는 반드시 실제 사용 원천을 보여준다. `operational_vm`이면 운영 판단 가능, `local fallback`이면 예산 판단 보류다.

2026-05-04 11:07 KST 로컬 코드 반영 상태는 아래다.

1. `/api/ads/site-summary`, `/api/ads/roas`, `/api/ads/roas/daily`, `/api/ads/channel-comparison`, `/api/ads/campaign-ltv-roas` 응답에 공통 원천 메타정보를 추가했다.
2. 추가 필드는 `queried_at`, `checked_at`, `timezone`, `date_range`, `ledger_source`, `requested_ledger_source`, `source_confidence`, `source_confidence_reason`, `source_max_timestamp`, `row_count`, `order_count`, `fallback_reason`, `spend_source`, `currency`, `rounding_rule`, `meta_attribution_window`, `meta_attribution_windows`, `meta_action_report_time`, `meta_use_unified_attribution_setting`이다.
3. `/ads`와 `/ads/roas` 화면에는 "현재 ROAS 숫자의 기준" 카드를 추가해 운영 VM인지 local fallback인지, 집계 기간과 원장 최신 시각이 무엇인지 바로 보이게 했다.
4. source confidence는 `A/B/C/D`로 표시한다. `A`는 운영 VM ledger 기준, `B`는 운영 VM이지만 warning 있음, `C`는 local 명시, `D`는 auto fallback 주의다.
5. 이번 작업은 로컬 코드/문서 변경만 했다. 운영 DB write, Meta 전송, GTM publish, 배포는 하지 않았다.

숫자 정본화 주의점:

보고서와 문서의 Meta value가 소폭 다르게 기록된 이력이 있다.
예를 들어 같은 최근 7일 기준으로 한 쪽은 Meta parity `114,123,086원`, Meta 1d_click `78,252,972원`을 기록했고, 기존 정본 문서는 Meta parity `113,889,086원`, Meta 1d_click `78,018,972원`을 기록했다.
차이는 크지 않지만 운영 지표에서는 "어느 숫자가 정본인가" 논쟁이 된다.
따라서 앞으로는 금액만 기록하지 않고, 위 공통 메타정보와 함께 API 원본 JSON을 저장해야 한다.
특히 `2026-04-27~2026-05-03`이 KST inclusive인지, Meta API의 `date_preset`/`time_range`가 무엇인지, `action_report_time=conversion`인지, `action_attribution_windows=["1d_click"]`인지 함께 남긴다.

Purchase CAPI 해석도 분리한다.
VM `/api/meta/capi/log`에서 `Purchase` operational send 1,255건, success 1,255건, duplicate 0건이 보인다는 것은 "우리 서버가 같은 주문을 중복 전송하지 않았다"에 가까운 증거다.
이것만으로 Meta Events Manager에서 Browser/Server dedup이 정상이라고 확정하면 안 된다.
현재 확정된 것은 `VM server send 성공`이고, `Meta Events Manager dedup 확인`, `Event Match Quality`, `Advanced Matching Parameters`는 TJ님 캡처 또는 UI 확인 전까지 미확정이다.

중간 퍼널 CAPI는 계속 test-only다.
`AddPaymentInfo`를 백엔드 허용 이벤트에 추가한 것은 운영 송출이 아니라 Test Events smoke가 400으로 막히지 않게 하는 준비다.
`ViewContent`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo`의 server mirror 운영 ON은 금지한다.
다음 확인 기준은 Meta Test Events code에서 같은 `event_id`로 Browser/Server가 들어오고, Events Manager diagnostics/dedup 문제가 없는지 보는 것이다.

NPay 해석은 아래로 고정한다.
NPay return 누락은 Meta/GA4 암흑 매출의 중요한 조각이다.
하지만 최근 30일 매출 비중이 5.10%, 최근 60일 4.93%, 최근 90일 4.66%라서 Meta 1d_click과 내부 Attribution confirmed ROAS 차이를 단독으로 전부 설명하지는 못한다.
더 큰 축은 `campaign mapping`, `fbclid/UTM first-touch 보존`, `Advanced Matching`, `Meta attribution window 분리`다.
따라서 NPay는 `유지 + recovery ledger + 제한 테스트`로 관리하고, 지금 즉시 NPay recovered Meta CAPI Purchase 운영 송출은 열지 않는다.

이번 피드백 기준 다음 우선순위는 아래다.

1. [Codex] 완료. `/ads` 기준 unmapped confirmed revenue를 `campaign id / adset id / ad id / utm_term / utm_content / utm_campaign / campaign_alias` 기준으로 재분류하도록 matcher를 보강했다. 상품군 추정만으로 Meta 캠페인에 강제 배정하지 않는다.
2. [TJ] Meta Events Manager에서 pixel/dataset `1283400029487161`의 Purchase Browser/Server 표시, dedup 상태, Event Match Quality, Advanced Matching Parameters, 2026-04-18 12:00 KST Purchase spike, custom `Refund` 수신 여부를 캡처한다.
3. [TJ 또는 허들러스] biocom GA4 BigQuery raw 권한을 열어준다. 현재 `hurdlers-naver-pay.analytics_304759974` dataset read 권한이 막혀 `(not set)`, NPay return, 중복 purchase 원인 분해가 제한된다.
4. [Codex + TJ] 중간 퍼널 CAPI는 Meta Test Events code로만 smoke한다. GTM Production publish나 운영 CAPI 전송은 별도 승인 전 금지다.
5. [Codex] Meta용 `marketing_intent` GTM Preview 승인안을 구체화한다. 랜딩 시점에 `fbclid`, `_fbc`, `_fbp`, UTM, landing URL, referrer, GA client/session id를 저장해 결제 완료 시점 유실을 줄인다.

### 2026-05-04 11:30 campaign mapping 재분류 진행 결과

Green Lane에서 로컬 코드와 read-only 운영 VM ledger/API만 사용했다.
운영 DB write, Meta 전송, GTM publish, 배포는 하지 않았다.
임시 백엔드는 `PORT=7021`, `BACKGROUND_JOBS_ENABLED=false`, `SCHEDULED_SEND_ENABLED=false`로만 띄워 API 응답을 확인했다.

코드 반영 내용:

1. 주문 URL과 attribution ledger에서 `meta_campaign_id`, `campaign_id`, `utm_id`, 숫자형 `utm_campaign`을 campaign id 증거로 읽는다.
2. `meta_adset_id`, `adset_id`, 숫자형 `utm_term`을 adset id 증거로 읽고, Meta adset parent campaign으로 역추적한다.
3. `meta_ad_id`, `ad_id`, 숫자형 `utm_content`를 ad id 증거로 읽고, Meta ad parent campaign으로 역추적한다.
4. `campaign_alias`는 `utm_campaign`이 비어 있을 때 보조 alias로 읽는다.
5. live Meta Ads API에서 광고와 creative URL tag를 read-only로 읽고, 실패 시 `data/meta_campaign_alias_audit.biocom.json`의 로컬 스냅샷을 fallback으로 쓴다.
6. live creative alias는 한 alias가 한 campaign에만 연결될 때만 자동 사용한다. 여러 campaign에 걸치면 자동 확정하지 않는다.
7. 상품군, 랜딩페이지, 광고명 추정만으로는 campaign ROAS에 붙이지 않는다.

검증 결과:

```text
queried_at: 2026-05-04T02:36:45.491Z
timezone: Asia/Seoul
date_range: 2026-04-27~2026-05-03 KST inclusive
site: biocom
ledger_source: operational_vm
source_confidence: A
source_max_timestamp: 2026-05-04
row_count: 6,669
order_count: 586
Meta spend: 28,559,014원
Attribution confirmed revenue: 55,743,545원
Attribution confirmed ROAS: 1.95x
Attribution confirmed orders: 185건
unmapped confirmed revenue: 10,879,100원 / 33건
adset_mapping_error: null
ad_mapping_error: null
alias_mapping_error: null
```

현재 결론:

1. 숫자 ID가 있는 주문은 대부분 자동 분류된다. 특히 `utm_term` 또는 `utm_content`가 남은 주문은 adset/ad parent campaign으로 안전하게 붙는다.
2. 남은 `(unmapped)`는 "코드가 못 읽어서"라기보다 "주문에 campaign/adset/ad id 증거가 없거나, alias만으로는 campaign을 확정하면 위험한" 건이 핵심이다.
3. `fbclid`만 있고 Meta campaign/adset/ad id가 없는 주문은 campaign ROAS에 억지 배정하지 않는다. landing이 `/sosohantoon01`, `/kangman03`, `/shop_view/?idx=503`처럼 보여도 상품군/랜딩 추정만으로는 campaign id를 만들 수 없다.
4. `meta_biocom_sosohantoon01_igg`는 adset id가 남은 주문은 parent campaign으로 자동 처리된다. 그러나 id 없이 alias만 남은 묶음은 최신 read-only 후보 기준 약 `12건 / 3,933,000원`이 남아 있어 Ads Manager 수동 확인이 필요하다.
5. `meta_biocom_kkunoping02_igg`는 기존 seed, 2026-04-11 URL evidence, live Ads API 검색에서 campaign 증거가 아직 확인되지 않았다. campaign ROAS에 붙이지 말고 수동 확인 후보로 둔다.
6. `meta_biocom_skintts1_igg`는 alias 자체가 여러 campaign에 걸칠 수 있다. `utm_term=120244759212190396`처럼 adset id가 있을 때만 `120244759209860396` 캠페인으로 붙이고, alias 단독이면 자동 확정하지 않는다.
7. `inpork_biocom_igg`는 IGG 상품군으로는 볼 수 있지만 Meta campaign/adset/ad id가 없다. Meta 캠페인 ROAS에는 붙이지 않고 non-meta influencer 또는 quarantine으로 둔다.

그로스 파트장에게 요청할 수동 확인 자료:

1. Ads Manager에서 `sosohantoon01`, `kkunoping02`, `skintts1`, `kangman03`, `idx=503`을 검색한다.
2. export 컬럼은 `campaign id`, `campaign name`, `adset id`, `adset name`, `ad id`, `ad name`, `Website URL`, `URL Parameters`, `spend`, `purchase`, `purchase conversion value`가 필요하다.
3. 확인 기준은 광고명 일치가 아니라 URL Parameters 또는 Website URL에 남은 `utm_campaign`, `utm_term`, `utm_content`, `campaign_alias`, `meta_campaign_id`, `meta_adset_id`, `meta_ad_id`다.
4. export에서 campaign/adset/ad id가 확인되면 Codex가 seed에 반영하고 dry-run 재계산한다.
5. export에서도 id가 없으면 해당 매출은 product-family 분석에는 남기되 campaign ROAS에는 계속 quarantine으로 둔다.

### 2026-05-04 01:28 Green Lane 조사·설계 결론

이번 블록은 Meta ROAS gap을 줄이는 다섯 축을 정본 문서 최상단에 고정하기 위한 Green Lane 조사 결과다.
Green Lane에서 한 일은 문서 조사, 로컬 코드 확인, read-only source freshness 점검, 설계 정리다.
GTM Preview, GTM Production publish, Meta CAPI 전송, GA4 Measurement Protocol 전송, 운영 DB write, 광고 소재 URL 변경은 실행하지 않았다.

확인한 기준은 아래다.

1. 공식/플랫폼 기준: Meta Pixel Advanced Matching 문서, Meta Conversions API customer information parameter 문서, Meta Ads Insights API 문서, Meta Business Help의 Conversions API 설명.
2. 로컬 코드 기준: `backend/src/attribution.ts`, `backend/src/metaCapi.ts`, `backend/src/sourceFreshness.ts`, `backend/scripts/check-source-freshness.ts`, `backend/scripts/export-meta-campaign-alias-audit.ts`, `frontend/src/app/ads/page.tsx`.
3. 로컬/운영 데이터 기준: `npm exec tsx scripts/check-source-freshness.ts --json` read-only 실행, `data/meta_campaign_alias_audit.biocom.json`, `meta/campaign-url-evidence.biocom.json`, `meta/campaign-alias-mapping.md`.
4. 기준 시각: 2026-05-04 01:26 KST.
5. site: biocom.
6. confidence: 0.84. 이유는 설계와 로컬 근거는 충분하지만, biocom GA4 BigQuery raw 접근과 GTM Preview는 아직 권한/승인 전이기 때문이다.

#### 1. `fbclid`/UTM 랜딩 시점 보존

결론은 "구매 완료 페이지에서만 `fbclid`와 UTM을 읽으면 늦다"다.
Meta 광고 클릭 사용자는 랜딩 후 direct 재방문, PG 이동, NPay 외부 결제, 브라우저 새 탭, 모바일/PC 전환을 거칠 수 있다.
이 흐름에서는 결제 완료 URL에 `fbclid`, `_fbc`, `_fbp`, `utm_campaign`, `utm_term`, `utm_content`가 남아 있지 않을 수 있다.
따라서 랜딩 시점에 광고 흔적을 `marketing_intent`로 먼저 저장하고, 나중에 `checkout_started` 또는 `payment_success`와 연결해야 한다.

Green Lane에서 이미 닫은 것은 로컬 백엔드 인식 로직이다.
`backend/src/attribution.ts`는 이제 `fbclid`, `_fbc`, `_fbp`, Facebook/Instagram referrer, Meta/Facebook/Instagram UTM을 Meta first-touch 후보로 인식한다.
`backend/tests/attribution.test.ts`에는 `marketing_intent -> payment_success` 연결 테스트가 추가됐고 통과했다.

운영 설계는 아래가 안전하다.

1. GTM 태그 목적은 "구매 전송"이 아니라 "광고 랜딩 증거 저장"이다.
2. 발화 조건은 `fbclid` 존재, `_fbc`/`_fbp` 존재, `utm_source=meta/facebook/instagram/fb/ig`, referrer가 Facebook/Instagram인 경우로 제한한다.
3. 저장 필드는 `touchpoint=marketing_intent`, `intentChannel=meta`, `fbclid`, `_fbc`, `_fbp`, UTM 6종, landing URL, referrer, GA client/session id, captured_at이다.
4. direct 방문, 내부 링크 이동, 내부 배너 UTM은 저장하거나 first-touch를 덮어쓰면 안 된다.
5. 같은 브라우저의 같은 `fbclid + landing` 조합은 24시간 dedupe한다.

성공 기준은 간단하다.
결제 완료 이벤트 자체에는 Meta 파라미터가 없어도, 같은 사용자/세션의 이전 `marketing_intent`가 `payment_success.metadata.firstTouch`로 남아야 한다.
실패 기준은 direct 방문까지 Meta intent로 저장되거나, GTM 태그가 의도치 않게 GA4/Meta/TikTok/Google Ads 전송을 같이 하는 것이다.

승인 경계는 명확하다.
로컬 집계 카드 설계와 payload preview는 Green이다.
GTM Preview는 Yellow라 TJ님 승인 후 진행한다.
GTM Production publish는 Red라 별도 명시 승인 전 금지다.

#### 2. campaign mapping 확정

결론은 "상품군이 맞다"와 "Meta 캠페인에 귀속된다"를 분리해야 한다.
IGG 상품 주문이라고 해서 특정 Meta 캠페인의 ROAS에 자동으로 붙이면 안 된다.
캠페인 ROAS에는 Meta campaign/adset/ad id 또는 광고 URL의 UTM 증거가 있어야 한다.

현재 증거 상태는 아래다.

1. `data/meta_campaign_alias_audit.biocom.json`은 2026-04-11 생성 스냅샷이다. campaigns 7개, adsets 26개, ads 410개, alias candidates 19개, landing URL 345개, url tag 340개를 담고 있다.
2. `meta/campaign-url-evidence.biocom.json`도 같은 시각 스냅샷이며, 410개 광고 중 340개에서 `utm_campaign`을 추출했다.
3. 하지만 이 스냅샷은 2026-04-11 기준이라 최신 운영 VM confirmed 주문 기준과는 stale일 수 있다.
4. `meta_biocom_cellcleanerreel_igg`는 `utm_term=120213362391830396`가 있고, 해당 adset parent campaign이 `120213362391690396`로 확인돼 음식물 과민증 검사 전환캠페인으로 임시 분류했다.
5. `inpork_biocom_igg`는 상품군은 IGG/음식물 과민증으로 볼 수 있지만 Meta campaign/adset id가 없어 Meta 캠페인 ROAS에는 강제 배정하지 않는다.

근본 해결책은 앞으로 광고 URL에 사람이 만든 alias와 Meta 실제 ID를 같이 남기는 것이다.

```text
utm_source=meta
utm_medium=paid_social
utm_campaign={{campaign.id}}
utm_term={{adset.id}}
utm_content={{ad.id}}
campaign_alias=meta_biocom_소재또는랜딩명
meta_campaign_id={{campaign.id}}
meta_adset_id={{adset.id}}
meta_ad_id={{ad.id}}
```

이렇게 되면 내부 원장은 `campaign_id`로 캠페인 ROAS를 계산하고, 사람이 만든 alias는 소재/인플루언서/랜딩 분석용 보조 필드로 쓴다.
라이브 광고 URL 파라미터 수정은 광고 운영에 영향이 있으므로 Codex가 승인 없이 실행하지 않는다.
Codex가 Green에서 할 수 있는 것은 최신 evidence 재생성, unmapped 후보표 작성, UTM 템플릿 초안 작성까지다.

#### 3. Meta attribution window와 내부 confirmed revenue 분리

결론은 Meta ROAS와 내부 Attribution ROAS를 같은 분자로 맞추려 하면 안 된다.
Meta Ads Manager 값은 Meta가 광고에 귀속한 conversion value다.
내부 Attribution confirmed ROAS는 실제 결제 확정 원장 중 Meta 근거가 있는 매출이다.
둘은 의도적으로 다른 장부다.

운영 비교 기준은 아래로 고정한다.

1. 운영 예산 판단 메인은 `Attribution confirmed revenue / Meta spend`다.
2. Meta 참고값 메인은 `1d_click`이다.
3. Meta 기본값은 Ads Manager parity 확인용으로만 둔다. 현재 화면 설명상 기본값은 `7d_click + 1d_view` 성격으로 읽는다.
4. `7d_click`, `1d_view`, `28d_click`은 원인 분해용 보조값이다.
5. Meta adset의 실제 attribution setting을 ROAS 숫자 맞추기 목적으로 바꾸지 않는다.

로컬 화면은 이미 이 방향으로 일부 구현돼 있다.
`frontend/src/app/ads/page.tsx`에는 `META_PRIMARY_ATTR_WINDOW = "1d_click"`가 있고, `ATTR_WINDOWS`에 클릭 1일, Meta 기본, 클릭 7일, 클릭 28일, 조회 1일이 분리돼 있다.
`/ads` 설명도 Meta purchase ROAS는 운영 메인값이 아니라 참고값이라고 안내한다.

다음 Green 작업은 화면과 API 응답에서 "Meta 1d_click", "Meta 기본", "Attribution confirmed"를 더 명확히 분리해 운영자가 같은 값을 매번 비교하게 만드는 것이다.
성공 기준은 `/ads`를 보는 사람이 "Meta가 주장하는 ROAS"와 "내부 확정 매출 기준 ROAS"를 혼동하지 않는 것이다.

#### 4. Advanced Matching 품질 개선

결론은 Advanced Matching은 gap을 줄이는 보강책이지만, 내부 ROAS와 Meta ROAS를 100% 같게 만들지는 못한다.
Meta는 자체 로그인/기기 그래프를 쓰고, 내부 원장은 주문·세션·결제 식별자를 쓴다.
따라서 목표는 완전 일치가 아니라 "확정 주문 이벤트가 Meta에서 더 잘 매칭되도록 식별자 품질을 올리는 것"이다.

현재 로컬 CAPI 코드는 일부 기반이 있다.
`backend/src/metaCapi.ts`는 CAPI payload의 `user_data`에 `client_ip_address`, `client_user_agent`, `fbc`, `fbp`를 넣을 수 있고, 이메일과 전화번호는 정규화 후 SHA-256 해시로 `em`, `ph`에 넣는다.
`fbclid`가 있고 `_fbc`가 없으면 `fbc` 값을 생성하는 로직도 있다.
즉 코드 차원에서는 기본 Advanced Matching 재료가 일부 준비돼 있다.

남은 gap은 아래다.

1. `external_id`가 아직 명시적으로 들어가지 않는다. 회원번호, 주문자 전화번호 해시, 내부 고객키 중 무엇을 쓸지 결정해야 한다.
2. 모든 confirmed 주문에 이메일/전화번호가 안정적으로 들어오는지 coverage 리포트가 필요하다.
3. 건강 관련 상품군이라 개인정보·민감정보·동의 범위를 TJ님이 확인해야 한다.
4. Events Manager의 Event Match Quality 화면에서 실제 품질 개선을 확인해야 한다.
5. Purchase 외 중간 퍼널 CAPI는 아직 운영 ON이 아니므로 Test Events 코드로만 소크해야 한다.

Codex가 대신 수행 가능한 Green 작업은 `user_data` coverage audit, payload preview, `external_id` 후보 설계, 테스트 코드 작성이다.
Codex가 대신 결정할 수 없는 것은 개인정보/동의 범위, Meta Events Manager 설정 변경, 운영 CAPI 전송 승인이다.

추천도는 목적별로 다르다.
`user_data` coverage audit은 92%로 바로 진행 가능하다.
`external_id` 후보 설계는 86%로 진행 가능하다.
운영 Purchase CAPI payload 확장은 법적/동의 컨펌 전 48%로 보류한다.
Test Events 코드만 쓰는 중간 퍼널 CAPI 소크는 82%다.

#### 5. source freshness 복구

결론은 `/ads`의 최근 판단을 신뢰하려면 원천 신선도를 먼저 닫아야 한다.
로컬 DB가 stale이면 매출이 0처럼 보이거나, 최근 7일 ROAS 분자가 비어 보인다.
이 경우 Meta API는 광고비와 플랫폼 귀속 매출을 계속 주지만 내부 confirmed revenue가 오래된 상태라 gap이 과장된다.

2026-05-04 01:26 KST read-only source freshness 결과는 아래다.

1. `ga4_bigquery_thecleancoffee`: fresh. latest table `events_20260502`, row 2,496건, purchase 14건, distinct transaction 14건.
2. `ga4_bigquery_biocom`: error. `hurdlers-naver-pay.analytics_304759974` dataset에 `bigquery.datasets.get denied`.
3. `toss_operational`: warn. 최신 sync 기준 약 28.4시간.
4. `playauto_operational`: warn. 최신 sync 기준 약 29.4시간.
5. `imweb_local_orders`: stale. 최신 sync 기준 약 218.7시간.
6. `toss_local_transactions`와 `toss_local_settlements`: stale. 최신 sync 기준 약 236.2시간.
7. `attribution_ledger`: local SQLite 기준 data_sparse. 다만 운영 `/ads`는 VM ledger read-only를 기본으로 보도록 개선됐으므로 로컬 SQLite만 primary로 보면 안 된다.

가장 큰 blocker는 biocom GA4 BigQuery raw 접근이다.
허들러스 프로젝트 `hurdlers-naver-pay.analytics_304759974`에 우리 서비스 계정 read 권한이 없어서 GA4 raw 기반 `(not set)`, NPay return, 중복 purchase 원인 분해가 막힌다.
이 문제는 Codex가 로컬에서 해결할 수 없다.
TJ님 또는 허들러스가 GCP/GA4 권한을 처리해야 한다.

Green에서 Codex가 계속 할 수 있는 것은 아래다.

1. 운영 DB read-only와 VM ledger read-only를 써서 `/ads`의 내부 confirmed revenue를 stale local DB에서 분리한다.
2. `backend/scripts/check-source-freshness.ts` 결과를 매일 문서/화면에 남긴다.
3. biocom BigQuery 권한이 들어오면 즉시 freshness와 raw sanity query를 재실행한다.
4. 권한이 없을 때는 GA4 Data API를 fallback으로 쓰되, 결과 confidence를 낮게 표시한다.

TJ님이 직접 해야 하는 것은 허들러스 dataset read 권한 요청이다.
권한 요청문과 GTM/Meta 컨펌 항목은 `meta/meta-roas-gap-confirmation-runbook-20260504.md`에 분리한다.

### 2026-05-04 현재 결론

로컬 `/ads` 백엔드는 이제 `ledger_source=auto` 기본값으로 운영 VM attribution ledger를 read-only 조회한다.
최근 7일 바이오컴 기준 로컬 stale 원장 때문에 0처럼 보이던 내부 Attribution ROAS는 운영 VM 기준 `55,273,325원 / 광고비 28,552,872원 = 1.94x`로 복구됐다.
같은 기간 Meta Ads Manager parity 값은 `113,889,086원 / 28,552,872원 = 3.99x`다.
Meta attribution window를 `1d_click`로 좁히면 Meta 값은 `78,018,972원 / 28,552,872원 = 2.73x`까지 내려간다.
따라서 gap을 좁히는 1순위는 `/ads`의 운영 기본 비교 기준을 `Meta 1d_click`과 `Attribution confirmed`로 고정하는 것이다.

구매 전 단계 퍼널 CAPI는 아직 운영 송출이 아니다.
바이오컴 live tracking inventory 기준 `funnel-capi v3`는 `ViewContent`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo`에 event id를 주입하지만 `enableServerCapi=false`라 서버 CAPI mirror는 `server skipped (disabled)` 상태다.
VM `/api/meta/capi/log`는 2026-04-16 이후 operational CAPI가 `Purchase` 1,255건, 성공 1,255건, duplicate 0건임을 보여준다.
즉 Purchase CAPI는 안정화됐지만, 중간 퍼널 CAPI는 아직 테스트 이벤트 단계 승인과 운영 전환이 남아 있다.
로컬 백엔드는 향후 server mirror 테스트가 400으로 막히지 않도록 `AddPaymentInfo`도 `/api/meta/capi/track` 허용 이벤트에 추가했다.

NPay 쪽 GTM intent 방식은 Meta ROAS 프로젝트에도 활용 가능하다.
다만 활용 범위는 "광고 클릭 또는 외부결제 intent를 먼저 저장하고, 나중에 실제 주문 원장과 붙여보는 recovery ledger"다.
이걸 바로 Meta CAPI Purchase 송출 장치로 쓰면 안 된다.
근거는 `naver/!npayroas.md`의 현재 상태다: NPay GTM live version `139` 이후 intent 304건, confirmed NPay 주문 11건, strong match 8건, A급 6건, ambiguous 3건이며, GA4 MP 제한 테스트 1건만 승인 전송됐고 Meta/TikTok/Google Ads 전송은 0건이다.
또 NPay intent log는 `fbclid`, `_fbc`, `_fbp`, UTM, GA client/session id를 이미 담는 구조라 Meta 분석 보강에 필요한 식별자 형태도 대체로 맞다.
따라서 NPay intent는 Meta ROAS의 암흑 매출을 찾는 보조 원천으로는 쓸 수 있지만, CAPI Purchase 운영 송출은 7일 후보정과 GA4 MP 제한 테스트 수신 확인 후 별도 승인으로만 연다.
Codex 판단: NPay GTM intent의 Meta ROAS 분석 활용 가능성 89%, 지금 즉시 NPay recovered Meta CAPI Purchase를 운영 송출할 추천도 35%, 7일 후보정과 GA4 MP 수신 확인 후 1~2건 제한 Meta CAPI 테스트 추천도 72%.

운영 CAPI 송출 추천은 목적별로 다르게 본다.
구매 전 단계 퍼널 CAPI를 Events Manager Test Events 코드로만 켜는 것은 추천도 82%다.
이유는 브라우저 event_id 주입 구조가 이미 있고, 로컬 백엔드가 `AddPaymentInfo`까지 받을 수 있게 보강됐으며, 테스트 이벤트는 광고 학습을 크게 오염시키지 않기 때문이다.
반대로 test-only 없이 바로 중간 퍼널 CAPI 운영 ON은 추천도 58%다.
dedup event_id, payload 품질, Events Manager 수신/중복 표시를 먼저 봐야 한다.
NPay recovered Purchase의 Meta CAPI 운영 송출은 지금 추천도 35%다.
리스크는 오매칭 purchase, 같은 주문 중복, `event_id` 불일치, NPay 버튼 클릭만 한 사용자의 구매 오염, 개인정보 해시/동의 범위 미확정이다.

`fbclid`/UTM 유실은 Meta용 `marketing_intent` 수집을 GTM으로 추가해 줄인다.
TikTok 문서에서 검증된 패턴처럼 랜딩 시 `fbclid`, `_fbc`, `_fbp`, `utm_source`, `utm_campaign`, `utm_id`, `utm_term`, `utm_content`, referrer, landing URL, GA client/session id를 first-touch로 저장한다.
이후 `checkout_started`와 `payment_success`가 들어오면 같은 브라우저/세션/주문키로 연결해, direct 재방문이나 PG/NPay 이동 후에도 최초 광고 근거를 잃지 않게 한다.
단, 내부 링크에 UTM을 붙여 원래 source를 덮는 방식은 금지한다.
GA4에는 이미 PG/NPay 도메인 unwanted referral 보강이 들어가 있으므로, Meta 쪽은 "Meta 광고 흔적을 VM ledger에 먼저 남기는 것"이 다음 현실적인 보강이다.
이전 주의점이었던 `backend/src/attribution.ts`의 TikTok 중심 first-touch 매칭은 2026-05-04 Green Lane에서 보강됐다.
이제 로컬 코드는 `fbclid`, `_fbc`, `_fbp`, Facebook/Instagram UTM/referrer를 Meta match reason으로 인정한다.
다만 운영 랜딩에서 실제로 `marketing_intent` row가 쌓이려면 GTM Preview와 Production publish 승인 게이트가 아직 남아 있다.
Codex 판단: Meta용 GTM `marketing_intent` 도입 추천도 88%.

Meta의 크로스디바이스 귀속은 내부 원장만으로 완전히 복원할 수 없다.
Meta는 로그인, 앱, 브라우저, 기기 그래프를 이용해 광고 공로를 주장하지만, 우리 내부 원장은 주문·결제·브라우저 식별자를 기준으로 확인한다.
따라서 같은 수치로 억지 일치시키는 것이 아니라, CAPI Advanced Matching으로 격차를 좁힌다.
confirmed 주문에 한해 법적/동의 범위가 확인된 해시 이메일, 해시 전화번호, `external_id`, `_fbc`, `_fbp`, IP, user agent, order id, event_id를 함께 보내면 Meta 매칭 품질은 올라간다.
다만 이것도 "Meta가 주장하는 크로스디바이스 공로"와 "내부 confirmed 매출"을 100% 같게 만들지는 못한다.
Codex 판단: 크로스디바이스 gap 완전 해소 가능성 45%, Advanced Matching과 intent ledger로 gap을 의미 있게 좁힐 가능성 70%.

### 2026-05-04 Green Lane 진행 결과

Meta용 `marketing_intent`의 로컬 매칭 기반은 구현됐다.
`backend/src/attribution.ts`가 `fbclid`, `_fbc`, `_fbp`, Facebook/Instagram UTM/referrer를 Meta match reason으로 인식하고, `payment_success`에 `metadata.metaFirstTouchCandidate=true`를 남길 수 있게 됐다.
`backend/tests/attribution.test.ts`에는 Meta `marketing_intent -> payment_success` first-touch 연결 테스트를 추가했다.
검증은 `npm exec tsx --test tests/attribution.test.ts` 35개 통과, `npm run typecheck` 통과다.
운영 배포, GTM publish, 외부 플랫폼 전송은 하지 않았다.
세부 설계 문서는 `meta/meta-marketing-intent-gtm-plan-20260504.md`로 분리했다.

NPay 7일 후보정은 아직 완성창이 아니다.
체크리스트 기준 7일 완성창 종료는 2026-05-04 18:10 KST인데, 현재 실행 시각은 2026-05-04 00:34 KST이고 VM `npay_intent_log` 최신 row는 2026-05-04 00:14 KST다.
그래서 이번 실행은 partial dry-run으로만 해석한다.
Primary source는 TJ 관리 Attribution VM SQLite `/home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3#npay_intent_log`, 주문 원천은 운영 Postgres `public.tb_iamweb_users` read-only다.
window는 `2026-04-27T09:10:00Z ~ 2026-05-04T09:10:00Z`로 뒀다.
결과는 live intent 644건, confirmed NPay 주문 25건, strong match 17건, A급 9건, B급 8건, ambiguous 8건, purchase_without_intent 0건이다.
dispatcher dry-run 후보는 4건이며 모두 2026-04-30 이전 BigQuery robust_absent가 이미 확인된 주문이다.
TJ 수동 NPay 테스트 주문 `202604309594732`은 `manual_test_order`로 차단했다.
2026-05-01 이후 A급 production 주문 3건은 `already_in_ga4=unknown`이라 아직 전송 후보가 아니다.
따라서 현재 판단은 "매칭은 작동하지만, full 7일 재실행과 GA4 robust guard 없이는 Meta/GA4 recovered purchase 전송 금지"다.

최근 30/60/90일 NPay 매출 비중도 운영 DB read-only로 다시 산출했다.
기준 freshness는 운영 DB clean order max `2026-05-04 00:00:04 KST`, NPay max `2026-05-03 14:27:43 KST`다.
최근 30일은 전체 2,169건 / 4억 9,722만 3,085원 중 NPay 132건 / 2,536만 400원으로 주문 6.09%, 매출 5.10%다.
최근 60일은 전체 4,260건 / 9억 7,325만 5,215원 중 NPay 253건 / 4,793만 9,300원으로 주문 5.94%, 매출 4.93%다.
최근 90일은 전체 6,503건 / 15억 1,099만 603원 중 NPay 367건 / 7,036만 900원으로 주문 5.64%, 매출 4.66%다.
해석은 분명하다.
NPay return 누락은 내부 ROAS gap의 중요한 조각이지만, 최근 30일 매출 5.10% 규모라 Meta Ads Manager와 내부 Attribution ROAS 차이를 단독으로 전부 설명하지는 못한다.
NPay는 `유지 + recovery ledger + 제한 테스트`로 가고, Meta gap 축소의 더 큰 축은 `Meta first-touch 보존`, `campaign mapping`, `Meta attribution window 분리`, `Advanced Matching 품질`이다.

### 2026-05-04 다음 할 일

1. [Codex] `/ads`와 `/ads/roas`에서 운영자 기본 비교 기준을 `Meta 1d_click` 대 `Attribution confirmed`로 더 명확히 고정한다. 이유: Ads Manager parity 3.99x는 7d click + 1d view 성격이라 내부 확정 매출과 바로 비교하면 과대 gap처럼 보인다.
2. [TJ + Codex] Meta Events Manager 테스트 이벤트 코드로 `funnel-capi enableServerCapi=true` test-only 소크를 진행한다. 이유: ViewContent/AddToCart/InitiateCheckout/AddPaymentInfo가 브라우저와 서버에서 같은 event_id로 dedup되는지 확인해야 중간 퍼널 CAPI를 운영으로 켤 수 있다.
3. [Codex] 2026-05-04 18:10 KST 이후 NPay full 7일 dry-run을 재실행하고, 2026-05-01 이후 A급 production 후보 3건의 order_number와 channel_order_no를 GA4 robust query로 조회한다. 이유: 현재 partial 실행에서 신규 A급 후보는 `already_in_ga4=unknown`이라 전송 후보가 아니다.
4. [Codex] Meta용 GTM `marketing_intent`의 Preview 승인안을 만든다. 이유: 로컬 backend는 Meta first-touch를 인식하게 됐지만, 운영 랜딩에서 `fbclid`/UTM을 저장하려면 GTM Preview 검증과 Production publish 승인 게이트가 필요하다.
5. [완료/Codex] campaign mapping은 최신 운영 VM confirmed 주문 기준으로 mapped/unmapped를 재계산했다. 다음은 그로스 파트장 Ads Manager export로 `sosohantoon01`, `kkunoping02`, `skintts1`, `kangman03`, `idx=503`의 campaign/adset/ad id 증거를 확인하는 것이다.

### 지금 실제 우선순위

1. [완료/Codex] `/ads` 기준 unmapped confirmed revenue를 `campaign id / adset id / ad id / utm_term / utm_content / utm_campaign / campaign_alias` 기준으로 재분류했다. 현재 blocker는 코드 매칭이 아니라 id 없는 주문의 수동 evidence 확보다.
2. [Codex] 2026-04-25 23:45 KST 이후 v138 24h 창을 다시 집계한다. 이유: 현재 2026-04-25 11:12 KST early window는 `purchase 8건 / distinct transactionId 8건 / duplicate extra 0 / transactionId 결측 0 / pay_method=homepage 8건`으로 정상이나, 하루 완성창으로 닫아야 운영 기준이 된다.
3. [Codex] NPay 매출 비중을 최근 30/60/90일 로컬/운영 원장 기준으로 산출한다. 이유: v138로 NPay 클릭 purchase 오염은 막았지만, NPay 실제 결제 후 biocom 복귀 누락은 여전히 GA4/Meta 암흑 매출이다. 비중을 알아야 `server-side 보정`, `NPay 제거`, `아임웹 설정 수정` 중 하나를 결정할 수 있다.
4. [TJ] Meta Events Manager에서 biocom pixel `1283400029487161`의 2026-04-18 12:00 KST Purchase spike와 custom `Refund` 수신 여부를 캡처한다. 이유: 서버 로그와 Graph stats는 수신 정황을 보여주지만, 운영 증빙은 Events Manager UI가 가장 빠르다.
5. [Codex] VM API 500은 위 1~4가 닫힌 뒤 처리한다. 이유: TJ 확인대로 `https://att.ainativeos.net/`은 일부 프론트만 VM에 올린 상태라 현재 blocker가 아니다.

### 2026-04-27 BigQuery 판단 보강

biocom BigQuery는 기존 `data/bigquery.md`의 일반론대로 바로 진행하지 않는다.
2026-04-27 16:52 KST read-only freshness 기준 더클린커피 `project-dadba7dd-0229-4ff6-81c.analytics_326949178`은 fresh지만, biocom `hurdlers-naver-pay.analytics_304759974`는 `bigquery.datasets.get denied`로 막혀 있다.
TJ GA4 화면에서는 biocom BigQuery Link가 `hurdlers-naver-pay`, location `서울(asia-northeast3)`, 만든 사람 `team@hurdlers.kr`, 작성일 `2024. 9. 9.`, Daily ON으로 확인됐고, `링크 한도에 도달했습니다`가 표시됐다.
정본 실행 계획은 `data/bigquery_hurdlers_cutover_20260427.md`로 고정한다.
핵심 순서는 `허들러스 read 권한 확보 -> raw sanity query -> 2026-04-01 이후 허들러스 table 보존 확인 -> 재연결 승인 여부 결정 -> 기존 링크 삭제 후 새 링크 생성 -> source freshness 전환`이다.
허들러스 해제는 첫 단계가 아니라, 과거 table 보존과 재연결 승인 뒤에만 진행한다.

### P0. 데이터 원천 교차검증 운영 프로토콜

운영 DB를 활용하면 이번 `imweb_orders` 과거 헤더 공백처럼 "원천에는 있는데 로컬 캐시에 없는" 문제는 크게 해결된다.
하지만 운영 DB 하나로 모든 정합성이 해결되지는 않는다.
운영 DB `tb_iamweb_users`는 2019년 이후 주문 히스토리를 보유하지만, 주문×상품 row 구조라 주문 단위 금액은 `SUM`하면 과대계상된다.
또 광고 클릭 식별자, GA4 세션, Meta event_id, Toss 취소 전이 같은 정보는 운영 DB만으로 닫히지 않는다.
따라서 앞으로의 원칙은 단일 원천 의존이 아니라 "역할별 primary + 보조 cross-check + fallback confidence label"이다.

원천별 역할은 아래처럼 고정한다.

| 원천 | primary로 믿을 때 | cross-check로 쓸 때 | 한계와 방어 규칙 |
|---|---|---|---|
| 운영 DB / PG | 장기 주문 히스토리, 상품/회원/주문 헤더 복구, 운영 원장 기준 장기 추세 | 로컬 cache 누락, API pagination 한계, PlayAuto/Imweb 라인 매칭 | row grain을 먼저 확인한다. 주문 단위 금액은 반복 row이면 `MAX` 또는 대표값을 쓰고 `SUM` 금지. 광고 식별자와 취소 전이는 별도 원천이 필요 |
| 로컬 DB / SQLite | 개발·분석용 working cache, 백필 결과 검증, 대시보드 로컬 API | 운영 DB/API/VM 결과를 빠르게 재계산하고 재현 | 정본이 아니라 cache다. 쓰기 전 백업, dry-run, 적용 후 중복/금액/잔여 미조인 검증 필수 |
| VM DB / attribution ledger | 실제 운영 결제 관측, CAPI 이후 internal attribution, confirmed/pending/canceled 상태 전이 | Meta/GA4/로컬 산출과 주문 단위 대사 | VM 일부 프론트/API가 미완성일 수 있다. freshness와 endpoint 상태를 먼저 보고, 장애 시 blocker가 아니라 "VM unavailable" confidence로 degrade |
| 외부 API | 최신 상태, 플랫폼 공식 값, 권한/설정 확인 | 로컬/운영 DB가 stale인지 확인, 소량 샘플의 정본 확인 | pagination/rate limit/권한/시간대/attribution window 한계가 있다. deep history 백필 원천으로 단독 사용 금지 |
| Toss | 결제 승인, 취소, 부분취소, 정산 수수료 | Imweb/운영 DB 주문 금액과 payment_key/order_id 교차검증 | 광고/세션 정보가 약하다. `payment_key` prefix는 site inference 보강에 쓰되, 주문 헤더를 만들 때는 금액/상태 교차검증 필요 |
| GA4 BigQuery/Data API | 세션·유입·행동, GA4 이벤트 수신 검증 | Meta/ledger 이벤트 누락 원인 분해 | 매출 정본으로 쓰지 않는다. `(not set)`, NPay return 누락, Measurement Protocol 반영 지연을 별도 표시 |
| Meta API/Events Manager | 플랫폼 귀속 성과, Ads Manager parity, CAPI 수신 상태 | 내부 confirmed ROAS와 괴리 원인 진단 | Meta ROAS는 광고 공로 장부다. 내부 확정매출과 같은 분자가 아니므로 예산 메인은 Attribution confirmed ROAS |

모든 분석은 아래 순서로 진행한다.

1. 질문을 먼저 고정한다. 예: "주문이 존재했나", "결제가 확정됐나", "광고가 이 주문에 귀속됐나", "환불이 외부 플랫폼에 반영됐나"는 서로 다른 질문이다.
2. 질문별 primary source를 정한다. 매출/취소는 Toss, 과거 주문 헤더는 운영 DB, 운영 attribution은 VM ledger, 플랫폼 귀속은 Meta, 세션은 GA4다.
3. 각 원천의 freshness를 먼저 본다. 최소 `checked_at`, `max(timestamp)`, `row_count`, `window`, `site`, `timezone`을 기록한다.
4. primary 값과 최소 1개 보조 원천을 주문번호/order_id/payment_key/transaction_id 중 하나로 대사한다.
5. 충돌하면 "틀린 숫자"라고 바로 결론내지 말고 row grain, timezone, status definition, attribution window, pagination, 권한 범위를 먼저 의심한다.
6. primary가 막히면 fallback을 쓴다. 단, 결과에는 `A=primary confirmed`, `B=cross-check confirmed`, `C=fallback estimate`, `D=blocked/unresolved` 같은 confidence label을 붙인다.
7. 어떤 원천도 주문 단위로 닫히지 않으면 외부 전송이나 예산 판단에 쓰지 않는다. `quarantine`, `unmatched`, `permission_blocked`, `api_window_limited`로 분류한다.
8. 로컬 DB에 백필하거나 보정할 때는 백업 → dry-run → apply → 중복/금액/잔여 미조인 검증 → 문서 업데이트 순서로만 진행한다.

이 프로토콜의 핵심은 "교차검증으로 정확도를 올리되, 한 원천이 막혔다고 전체 판단이 멈추지 않게 하는 것"이다.
예를 들어 운영 DB가 있으면 Imweb API의 과거 pagination 한계를 우회할 수 있지만, 운영 DB에 광고 식별자가 없으면 VM ledger/GA4/Meta를 붙여야 한다.
반대로 VM API가 일시적으로 500이면 운영 DB와 로컬 DB로 주문·결제 사실을 계속 검증하되, attribution 수렴 판단만 보류한다.

### 결론: Meta ROAS 정합성 분석 위치

Meta ROAS 정합성의 기준판과 다음 액션은 이 문서에서 관리한다.
이유는 Meta ROAS가 `결제 확정`, `pending`, `취소/환불`, `source freshness`, `campaign mapping`, `GA4 (not set)`이 모두 얽힌 운영 판단 주제이기 때문이다.
단, CAPI/Purchase guard의 세부 runbook과 clean window는 `capivm/capi.md`, 주문 단위 증거와 과거 스냅샷은 `data/roasphase.md`를 source로 본다.

### P2. VM API 500은 최후순위로 낮춘다

로컬 기준 `http://localhost:7010/ads`는 2026-04-24 21:42 KST에 정상 렌더된다.
상단에는 source freshness, Imweb CANCEL 분리, Refund Dispatch, Identity Coverage, CAPI 이후 Meta vs Attribution ROAS 카드가 보인다.
다만 브라우저 검사에서 `/ads` 내부 광고 지표 호출 중 VM API `https://att.ainativeos.net/api/meta/insights`, `https://att.ainativeos.net/api/ads/site-summary`가 500 `fetch failed`를 반환했고, CAPI 수렴 카드는 `데이터 부족`으로 떨어진다.
2026-04-24 TJ 확인 기준 `https://att.ainativeos.net/`은 일부 프론트엔드만 일부러 VM에 올린 상태이므로, 이 이슈는 현재 정합성 작업의 blocker가 아니다.

다음 행동:

1. [Codex] VM API 500은 refund/GA4/campaign mapping 정합성이 닫힌 뒤 마지막에 본다.
2. [Codex] 그 전에는 로컬 `http://localhost:7010/ads`와 `http://localhost:7020` API를 기준으로 판단한다.
3. [Codex] 나중에 손볼 때는 `데이터 부족`과 API 장애가 구분되게 실패 endpoint와 마지막 정상 시각을 화면에 노출한다.

### P0. Meta ROAS clean window를 운영 기준으로 고정한다

기준은 아래처럼 둔다.

1. 운영 메인 ROAS는 `클릭 1일`, `Attribution confirmed revenue / spend`다.
2. Meta ROAS는 platform reference다. Meta가 광고에 귀속한 conversion value라 내부 확정매출과 같은 분자가 아니다.
3. VM ledger/API는 `2026-04-13` 이후 post-CAPI 비교에 사용한다.
4. raw dump 또는 pre-repair cache를 볼 때는 source-label 오염 창 `2026-04-14 22:00 ~ 2026-04-15 20:17 KST`를 제외하거나, `2026-04-15 20:53 KST` SQL 교정 후 값을 사용한다.
5. pending은 보조로만 둔다. 2026-04-13~15 스냅샷에서는 pending `260,000원`이라 Meta/Attribution 격차의 주범은 미입금이 아니라 Meta의 넓은 매칭과 내부 campaign mapping 미완성으로 본다.

### P0. Refund dispatch 수신 검증 결과

`/ads`에는 Refund Dispatch 카드가 보이고, 최근 90일 기준 enforce 활성 상태와 Meta Refund / Meta Purchase(-) / GA4 Refund 건수가 표시된다.
따라서 본문에서 "refund 전송이 없다"는 표현은 낡았다.
2026-04-24 22:15 KST 기준 실제 수신 검증 결과는 아래와 같다.

1. `/api/refund/summary?windowDays=90`: 전체 1,844건 / 498,419,478원, Meta Refund 1,844건, GA4 Refund 1,844건, Meta Purchase(-) 1,844건으로 기록됐다. `biocom` 라벨만 보면 377건 / 112,644,641원이며 전송 에러는 0건이다.
2. `/api/refund/log?limit=20&site=biocom`: 최근 biocom row는 전부 `mode=enforce`, `meta_dispatched=1`, `ga4_dispatched=1`, `purchase_refund_dispatched=1`, 에러 null이다.
3. GA4 Data API `properties/304759974`: 2026-04-18에 `refund` 이벤트 1,821건, `totalRevenue=-497,561,157.78원`이 보고서에 잡혔다. GA4 realtime은 최근 30분 창이라 현재 `refundLast30m=0`이지만, historical report에는 수신이 확인된다.
4. Meta Graph pixel stats `1283400029487161`: 2026-04-18 KST `Purchase`가 1,897~1,902건으로 집계되고, 12:00 KST 한 시간에 `Purchase 1,823건`이 집중됐다. 이는 `Refund-As-Purchase` 음수 Purchase backfill이 Meta 쪽 통계에 반영된 정황이다.
5. Meta custom `Refund` 이벤트명은 stats 응답에 별도 항목으로 보이지 않았다. 서버 로그상 Graph API 2xx 수락은 확인됐지만, Events Manager UI에서 custom event 수신을 직접 확인해야 최종 확정이다.
6. 리스크: 과거 `site=null`은 코드상 biocom 자격증명으로 전송됐다. 이미 전송된 1,444건 `unknown` 중 `iw_bi` 1,393건 / 382,391,118원은 biocom 성격으로 보이나, `iw_th` 51건 / 2,525,399원이 biocom GA4/Meta로 들어갔다. 2026-04-24 코드 수정으로 신규 후보는 `payment_key` prefix 기준 `iw_bi -> biocom`, `iw_th -> thecleancoffee`, 미확정은 외부 전송 skip으로 바뀌었다.

다음 행동:

1. [완료/Codex] 2026-04-24 23:08 KST에 pending refund 후보 22건 / 913,163원을 모두 `iw_th -> thecleancoffee`로 추론한 뒤 enforce 완료했다. Meta Refund, GA4 Refund, Meta Purchase(-) 모두 22/22 성공했고 남은 pending 후보는 0건이다.
2. [완료/Codex] `/api/refund/dispatch` dry-run 기본 동작을 "외부 전송 없음 + 로그 기록 없음"으로 바꿨다. 따라서 dry-run이 enforce 후보를 소모하지 않는다. 예전처럼 관측 로그를 남겨야 할 때만 `recordDryRun=true` 또는 `record=true`를 명시한다.
3. [보류/Codex] 과거 `site=null` 1,444건 중 `iw_th` 51건 / 2,525,399원은 biocom GA4/Meta로 잘못 들어간 이력이지만, 외부 플랫폼에서 안전하게 역보정하지 않는다. GA4 data deletion은 텍스트 parameter 삭제 중심이고 이벤트는 전체 metric에 남으며 numeric value 삭제도 지원하지 않는다. Meta는 현재 전송 API 기준 과거 event delete/update 경로가 없고, 양수 Purchase 보정은 구매 건수와 학습 신호를 왜곡한다.
4. [TJ] Events Manager UI에서 biocom pixel `1283400029487161`의 2026-04-18 12:00 KST Purchase spike와 custom `Refund` 수신 여부를 캡처하면 Meta 쪽 최종 증빙이 닫힌다.

### P0. 공동구매 Q1 로컬 산출치 재계산 결과

2026-04-24 운영 DB 백필과 1월 초 금액 과대계상 보정 후 `/api/ads/coop-order-summary?site=biocom&start_date=2026-01-01&end_date=2026-04-01` 기준 로컬 공동구매 산출치를 다시 고정했다.
현재 biocom 2026년 1분기 로컬 공동구매는 `1,923건 / 587,240,065원`이다.
회사 공유본 `2,253건 / 645,941,680원` 대비 주문 포착률은 `85.4%`, 매출 포착률은 `90.9%`, 남은 격차는 `330건 / 58,701,615원`이다.
백필 전 로컬값 `1,668건 / 512,906,191원` 대비 `+255건 / +74,333,874원` 개선됐다.

월별 재계산 결과는 아래와 같다.

| 월 | 전체 주문 | 공동구매 주문 | 공동구매 매출 | 주요 기준 |
|---|---:|---:|---:|---|
| 2026-01 | 3,245 | 933 | 284,257,900원 | product_family 719건 / product_name_pattern 214건 |
| 2026-02 | 2,319 | 498 | 159,860,874원 | 아랑 4차 allowlist 88건 포함 |
| 2026-03 | 2,522 | 492 | 143,121,291원 | product_name_pattern 408건 중심 |
| 합계 | 8,086 | 1,923 | 587,240,065원 | campaigns_loaded 27개 |

이전 `공동구매내역.md` 상단의 `593,316,365원`은 1월 초 운영 DB 반복 row를 `SUM`으로 보던 시점의 값이다.
2026-04-24 보정 후 1월 공동구매 매출이 `290,334,200원 -> 284,257,900원`으로 `6,076,300원` 낮아졌다.
아랑 4차 잔여 차이와 회사 공유본의 주문번호 미제공 한계는 그대로 남는다.

### P1. Campaign mapping과 GA4 `(not set)`를 이어서 닫는다

`/ads`의 운영 의견은 내부 캠페인 매출 unmapped를 전체 증액 금지 조건으로 보고 있다.
따라서 다음 임팩트는 캠페인 매핑과 GA4 raw 원인 분해다.

2026-04-24 23:31 KST GA4 Data API 기준 `transactionId` 결측과 `pay_method` 결측은 서로 다른 문제로 분해된다.

| 구분 | 2026-04-21 | 2026-04-22 | 2026-04-23 | 2026-04-24 현재 | 판정 |
|---|---:|---:|---:|---:|---|
| purchase 이벤트 | 165 | 170 | 233 | 153 | 04-24는 당일 partial |
| `transactionId` not set/empty | 6 / 3.6% | 5 / 2.9% | 3 / 1.3% | 4 / 2.6% | v136 이후 낮아졌고 잔여는 거의 전부 NPay `/shop_cart` 클릭 발사 |
| duplicate extra events | 65 | 61 | 76 | 7 | HURDLERS `[143]` + 홈피구매 `[48]` 중복 구조. 2026-04-24 23:45 KST v138에서 `[48]` pause 완료, 24~48h 뒤 신규 row 재측정 필요 |
| `pay_method=(not set)` | 90 | 79 | 11 | 0 | 04-23부터 빈 문자열로 이동 |
| `pay_method=""` | 0 | 0 | 83 | 19 | HURDLERS `[143]` 계열이 pay_method parameter를 안 채우는 구조. v138에서 `[143] pay_method=homepage` 보강 완료 |

잔여 `transactionId` 결측 표본은 2026-04-21~24 모두 `pagePath=/shop_cart`, `payMethod=npay`다.
따라서 GA4 `(not set)` 1층 원인은 NPay 버튼 클릭 시점 발사 태그 `[43]`가 실결제 확정 전 `/shop_cart`에서 purchase를 보내는 구조로 본다.
이 이벤트들은 실제 주문번호가 생기기 전이라 `transactionId`가 `(not set)` 또는 빈 문자열이 된다.

더 큰 운영 리스크는 이제 `transactionId` 결측보다 duplicate purchase다.
동일 transactionId에 `(not set 또는 empty)` HURDLERS 이벤트, `/shop_payment_complete` HURDLERS 이벤트, `homepage` 이벤트가 같이 잡히는 3중 구조가 반복된다.
예: 2026-04-22 `202604220754629`는 `(not set)/(not set)`, `(not set)/shop_payment_complete`, `homepage/shop_payment_complete`가 각각 1건씩 잡혀 같은 금액이 3번 들어갔다.

2026-04-24 23:45 KST에 biocom GTM live version `138` (`ga4_purchase_duplicate_fix_20260424`)을 배포했다.
변경은 세 가지다: `[48] GA4_구매전환_홈피구매`는 pause, `[43] GA4_구매전환_Npay`는 `purchase`가 아니라 `add_payment_info`로 강등, `[143] HURDLERS - [이벤트전송] 구매`는 `pay_method=homepage`를 명시했다.
백업은 `gtmaudit/gtm-ga4-purchase-duplicates-backup-20260424144504.json`, 적용 결과는 `gtmaudit/gtm-ga4-purchase-duplicates-result-20260424144504.json`에 있다.
API 검증 기준 live version 138에서 `[143] paused=false eventName=purchase pay_method=homepage`, `[48] paused=true`, `[43] eventName=add_payment_info pay_method=npay`가 확인됐다.

2026-04-25 11:12 KST 1차 검증도 통과했다.
TJ 카드결제 테스트 주문 `202604254861543`은 GA4 Data API에서 `purchase 1건`, `transactionId=202604254861543`, `pay_method=homepage`, `pagePath=/shop_payment_complete`, `eventCount=1`, `purchaseRevenue=5950.53`으로 잡혔다.
같은 pageLocation에 잡힌 9개 이벤트 중 purchase는 1개뿐이라 `[143]+[48]` 중복 purchase는 이 테스트 주문에서 재현되지 않았다.
또 2026-04-25 00:00~11:12 KST early window의 purchase는 `8건`, distinct transactionId `8건`, `transactionId` 결측 `0건`, duplicate extra `0건`, `pay_method=homepage 8건`, pagePath `/shop_payment_complete 8건`이다.
같은 창에서 `add_payment_info`는 `pay_method=npay 11건`, pay_method 빈값 14건이며, NPay 클릭 이벤트가 purchase 매출로 들어오지는 않았다.
남은 리스크는 `[143]` 자체가 같은 주문에서 두 번 발사되는지 여부와 24h 완성창 재측정이며, 이는 2026-04-25 23:45 KST 이후 신규 데이터로 다시 닫는다.

다음 행동:

1. [완료/Codex] unmapped confirmed revenue를 campaign id / adset id / ad id / UTM 기준으로 재분류했다. 증액 후보 캠페인만 `+10~15%` 테스트 대상으로 남기는 판단은 남은 수동 evidence 확인 후 진행한다.
2. [완료/Codex] GTM 태그 `[43] GA4_구매전환_Npay`는 v138에서 `purchase` 발사를 중지하고 `add_payment_info`로 강등했다. 이제 NPay 버튼 클릭은 purchase 건수/매출을 만들지 않아야 한다.
3. [완료/Codex] GTM 태그 `[48] GA4_구매전환_홈피구매`는 v138에서 pause했다. `[143] HURDLERS 구매`를 canonical purchase로 둔다.
4. [완료/Codex] `[143]` 계열 purchase에는 v138에서 `pay_method=homepage`를 명시했다.
5. [TJ] 2026-04-20에 설정한 GA4 Unwanted Referrals 효과를 2026-04-22 이후 raw query로 재측정한다. Data API로는 집계 경향만 보이고, event-level 확정은 biocom BigQuery raw 권한이 필요하다.
6. [Codex] NPay return 누락은 Meta ROAS 암흑 매출 이슈이므로 NPay 매출 비중 산출 후 `유지+server-side 보정` 또는 `제거/A-B` 결정을 지원한다.
7. [부분완료/Codex] 2026-04-25 11:12 KST early window에서 v138 이후 `purchaseEvents`, `distinctTransactionId`, `pay_method`, `pagePath`를 집계했다. 결과는 `purchase 8건 / distinct transactionId 8건 / 결측 0건 / duplicate extra 0건 / homepage 8건`이다. 2026-04-25 23:45 KST 이후 24h 창으로 다시 집계해 운영 기준으로 고정한다.

### P1. biocom Imweb header cache 백필 결과

로컬 `imweb_orders`에 바이오컴 2026-01-01 이전 헤더가 없던 이유는 데이터가 없어서가 아니라 수집 경로 차이 때문이다.
로컬 API 동기화는 아임웹 v2 `shop/orders` 페이지 결과에 의존하는데, 2026-04-24 22:30 KST 재확인 기준 biocom API는 `totalPage=160`, `offset=160`의 가장 오래된 주문이 `2026-01-21T13:40:37Z`, `offset=161`은 빈 응답이다.
따라서 API만으로는 2026-01-21 이전, 특히 2026-01-01 이전 헤더를 복구할 수 없다.

2026-04-24 22:46 KST에 운영 DB `public.tb_iamweb_users`를 원천으로 로컬 SQLite만 백필했다.
적용 범위는 `order_number` prefix `< 20260108`이며, 2026-01-01 이전 전체와 기존 1월 1~7일 공백을 같이 닫았다.
결과는 biocom `imweb_orders`가 API 8,688건 + 운영 DB 백필 69,706건 = 78,394건이 됐고, 가장 오래된 주문번호는 `2019092011633`, 가장 오래된 주문시각은 `2019-09-20T02:51:00Z`다.
주문번호 중복은 0건이다.

기존 1월 초 백필 713건은 `tb_iamweb_users`의 반복 row를 `SUM`으로 집계해 일부 금액이 과대계상되어 있었다.
이번에 백필 스크립트를 `MAX(order-level amount)` 기준으로 고치고 기존 운영 DB 백필분도 보정했다.
보정 대상은 금액/가격 필드 기준 106건이며, 운영 DB 백필 row의 `payment_amount`는 PG `MAX(final_order_amount)`와 69,706건 전부 일치한다.

한계도 남는다.
PlayAuto `imweb_order_items`에는 2026-01-01 이전 `site=null` 주문번호 27,025건이 아직 biocom header와 매칭되지 않는다.
이들은 운영 DB `tb_iamweb_users`에도 주문번호가 없어 이번 원천으로는 백필 불가하다.
반면 `iw_bi` 취소/환불 중 헤더 미조인은 1,373건에서 4건으로 줄었다.
남은 4건은 `pa...` 또는 `O...` 형태의 비표준 `order_id`라 Imweb 주문번호 조인이 아니라 `payment_key` prefix 기반 라우팅으로 처리해야 한다.

### 문서 본문 업데이트 필요성

본문 중 Sprint4, Sprint8, `다음 액션` 일부는 2026-04-21 상태에 머물러 있다.
특히 `/ads`에 이미 붙은 `source freshness`, `CANCEL 서브카테고리`, `Refund Dispatch`를 아직 준비/미구현으로 표현하는 문장은 운영 검증/장애 처리 단계로 바꿔야 한다.
이번 업데이트에서는 최상단 기준과 핵심 미구현 표현만 정정하고, Sprint별 완료율 재산정은 VM API 500과 refund 수신 검증이 끝난 뒤 다시 조정한다.

이 문서는 데이터 정합성 프로젝트의 현재 기준판이다.
`datacheck0406.md`와 `datacheck0415.md`는 그날의 상태를 고정해 둔 사진이고, 이 문서는 개발이 진행될 때마다 계속 바뀌는 작업 지도다.
`roasphase.md`는 ROAS 정합성 서브주제의 깊은 증거(구체 주문번호, event_id, Meta purchase 수치)를 담은 2026-04-12 기준 스냅샷이다. 이 문서의 Sprint3/4/6은 `roasphase.md`의 Phase 3/4/5/6과 주제가 이어지며, 세부 증거가 필요할 때 해당 문서를 source로 본다.

---

## 10초 요약

현재 목표는 `어떤 광고와 어떤 고객 행동이 실제 확정 매출을 만들었는지`를 시스템끼리 같은 숫자로 말하게 만드는 것이다.
Toss, Imweb, attribution ledger, Meta CAPI는 운영 판단에 쓸 만큼 올라왔고, `/ads`에는 source freshness, CANCEL 분리, Refund Dispatch 관측 카드가 붙었다. 다만 GA4 `(not set)`, Meta Events Manager UI 검증, sync 감사 로그는 아직 덜 닫혔다.
더클린커피 GA4 NPAY 65건은 확인했지만, 현재 네이버 커머스 API 자격 증명은 바이오컴 주문 원장만 열려 더클린커피 네이버 주문 원장 대사는 권한 확보 전까지 닫을 수 없다.
바이오컴 2026년 1분기 공동구매는 2026-04-24 운영 DB 백필과 1월 금액 보정 후 로컬 `1,923건 / 587,240,065원`으로 재산정됐다. 회사 공유본 `2,253건 / 645,941,680원` 대비 매출 포착률은 `90.9%`이고, 주문번호 없는 아랑 4차 잔여분이 마지막 큰 격차다.
현재 전체 완성도는 **67%**로 본다. 코드와 로컬 검증 기준은 **82%**, 운영에서 매일 믿고 보는 기준은 **63%**다.

쉬운 비유로 말하면, 지금은 여러 가게의 장부를 한 권으로 맞추는 작업이다.
계산기는 생겼지만, 몇 장부는 아직 날짜가 밀려 있고, GA4 장부는 손님이 어디서 왔는지 빈칸이 많다.

---

## 문서 목적

이 문서는 데이터 정합성 프로젝트의 목적, 현재 완성도, 남은 병목, 다음 실행 순서를 TJ, Codex, Claude Code가 같은 기준으로 보게 만든다.

---

## 이 작업이 하는 일

이 작업은 `광고 클릭 -> 사이트 행동 -> 주문 생성 -> 결제 확정 -> 취소/환불 -> 재구매`를 한 줄로 이어 보는 일이다.

각 시스템의 역할은 아래처럼 나눈다.

| 시스템 | 믿는 역할 | 조심할 점 |
|---|---|---|
| Toss | 결제 완료, 취소, 정산 수수료 | 고객 식별자와 광고 유입 정보는 약함 |
| Imweb | 주문, 회원, 구매확정 보조 | `CANCEL` 금액은 가상계좌 미입금 때문에 과장될 수 있음 |
| PlayAuto | 배송 상태, 전 채널 OMS 상태, 수동 주문 | sync가 멈추면 구매확정/배송 상태가 한 번에 stale 됨 |
| GA4 | 세션, 유입, 행동 흐름 | `(not set)`과 refund 미구현 때문에 매출 정본으로 쓰면 위험 |
| Attribution Ledger | 우리 기준의 결제 관측 장부 | `pending`과 `confirmed`를 반드시 분리해야 함 |
| Meta CAPI | Meta 학습용 서버 전환 | confirmed만 보내야 하고, 실제 환불 보정은 아직 남음 |

---

## 왜 필요한가

이 작업이 끝나야 아래 판단을 감이 아니라 숫자로 할 수 있다.

- Meta 광고비를 늘릴지 줄일지
- AIBIO, 바이오컴, 더클린커피 중 어디가 진짜 돈을 만들고 있는지
- 상담, 알림톡, 쿠폰, 재구매 캠페인이 실제 추가 매출을 만들었는지
- GA4와 Meta가 말하는 ROAS가 왜 내부 매출과 다른지
- 가상계좌 미입금, 어뷰저, 환불이 광고 성과를 얼마나 오염시키는지

---

## 현재 완성도

| 기준 | 완성도 | 해석 |
|---|---:|---|
| 전체 목표 기준 | **67%** | 운영 판단은 가능하지만, GA4 `(not set)` 원인 분해, refund 반영, 더클린커피 NPAY 원장 권한이 아직 덜 닫힘 |
| 코드/로컬 검증 기준 | **82%** | 주요 API, local SQLite, attribution ledger, CAPI guard, Imweb status 라벨링, source freshness script, NPAY 진단 스크립트가 상당 부분 구현됨 |
| 운영 기준 | **63%** | 운영 DB sync 감사, 일일 대사 책임자, GA4 raw query 루틴, 대시보드 경고 배지, 더클린커피 네이버 주문 원장 권한이 부족함 |
| GA4 `(not set)` 해결 기준 | **25%** | recent row에 식별자 유입은 시작됐지만, 원인별 분해표가 아직 없음 |
| 순매출/취소 보정 기준 | **65%** | Toss 기준 취소 해석과 `/ads` Refund Dispatch 관측은 붙었지만 GA4/Meta 외부 수신 검증과 운영 알림 기준은 남음 |

현재 완성도를 낮게 잡는 이유는 명확하다.
`데이터가 있다`와 `운영자가 매일 믿고 같은 결론을 내린다`는 다른 단계다.

---

## Phase-Sprint 요약표

| Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|
| Phase1 | [[#Phase1-Sprint1]] | 원천 데이터와 진실 소스 | Codex | 92% / 80% | [[#Phase1-Sprint1\|이동]] |
| Phase1 | [[#Phase1-Sprint2]] | 공통 키와 결제 원장 | Codex | 86% / 78% | [[#Phase1-Sprint2\|이동]] |
| Phase2 | [[#Phase2-Sprint3]] | 주문-결제-구매확정 대사 | Codex | 82% / 66% | [[#Phase2-Sprint3\|이동]] |
| Phase2 | [[#Phase2-Sprint4]] | 취소와 순매출 보정 | Codex + Claude Code | 62% / 38% | [[#Phase2-Sprint4\|이동]] |
| Phase3 | [[#Phase3-Sprint5]] | GA4 `(not set)` 원인 분해 | TJ + Codex | 38% / 18% | [[#Phase3-Sprint5\|이동]] |
| Phase3 | [[#Phase3-Sprint6]] | 캠페인 매핑과 ROAS 기준 | Codex + Claude Code | 45% / 30% | [[#Phase3-Sprint6\|이동]] |
| Phase4 | [[#Phase4-Sprint7]] | sync 감사와 stale 경고 | Codex + Claude Code | 50% / 25% | [[#Phase4-Sprint7\|이동]] |
| Phase4 | [[#Phase4-Sprint8]] | 운영 루틴과 대시보드 | TJ + Claude Code | 60% / 42% | [[#Phase4-Sprint8\|이동]] |
| Phase5 | [[#Phase5-Sprint9]] | NPay return 누락 감사 + 제거 A/B | Claude + TJ | 10% / 0% | [[#Phase5-Sprint9\|이동]] |

---

## 현재 기준 판단

### 확인된 것

- Toss는 매출과 취소 판단의 1순위다.
- Attribution ledger는 `pending`, `confirmed`, `canceled`를 나눌 수 있다.
- Meta CAPI는 confirmed 기준으로 보내는 구조가 잡혔다.
- Imweb v2 status로 `PURCHASE_CONFIRMATION`을 직접 라벨링할 수 있다.
- Imweb `CANCEL` 금액은 그대로 취소 금액으로 쓰면 안 된다.
- GA4 purchase는 우리 footer snippet이 직접 쏘는 것이 아니라 biocom GTM에서 발화된다.
- `tb_playauto_orders`는 2026-04-17 18:51 KST 확인 기준 3/13 정지 상태에서 벗어났다.
- thecleancoffee BigQuery raw export는 2026-04-19 09:41 KST 확인 기준 서비스 계정 read-only 조회가 된다.
- 네이버 커머스 API `BIOCOM_STORE_APP_ID/BIOCOM_STORE_APP_SECRET`는 OAuth SELF 토큰 발급과 주문 조회 API가 정상이다. 다만 현재 권한은 바이오컴 스토어 주문 원장 범위다.
- 더클린커피 GA4 `20260412~20260417` NPAY purchase는 65건, gross `2,630,700원`이다. 현재 네이버 커머스 API 권한으로는 이 65건을 더클린커피 네이버 주문 원장과 직접 대사할 수 없다.

### 아직 안 된 것

- GA4 `(not set)`을 원인별로 나눈 표가 없다.
- biocom BigQuery raw export의 기존 `hurdlers-naver-pay` dataset 상태가 아직 닫히지 않았다.
- GA4 MP refund / Meta Refund dispatch는 `/ads`에 관측된다. 다음 단계는 외부 수신 검증, 실패 알림, 운영 기준 고정이다.
- 더클린커피 네이버 커머스 API 앱 또는 판매자 권한이 없다. 현재 자격 증명으로 더클린커피 주문번호를 조회하면 `400 / 101010 / 처리권한이 없는 주문번호를 요청했습니다`가 반환된다.
- `purchase-confirm-stats`의 CANCEL 서브카테고리 분리는 `/ads`에 보인다. 다음 단계는 실제 환불/부분환불/가상계좌 만료/원인 불명의 운영 처리 기준 고정이다.
- `tb_operation_log`에는 sync 기록이 여전히 없다. `domain=restock`만 확인된다.
- 2026년 1~3월 바이오컴 공동구매 내역은 회사 공유본 `data/공동구매_26년 1분기.xlsx`와 캠페인/회차 단위 대사를 완료했지만, 2026-04-24 운영 DB 헤더 백필과 기존 1월 초 금액 보정 이후에는 로컬 산출치를 재계산해야 한다. 회사 공유본에는 주문번호가 없어 주문번호 1:1 대사는 아직 아니다.
- 1월 초 주문 헤더 누락 원인은 로컬 `imweb_orders`가 아임웹 v2 `shop/orders` API 백필 결과에 의존했기 때문이다. 2026-04-24 22:30 KST 재확인 기준 API는 `totalPage=160`, `offset=160`의 가장 오래된 주문은 `2026-01-21T13:40:37Z`, `offset=161` 이후는 빈 응답이다. 운영 DB `tb_iamweb_users` 기반으로 `order_number` prefix `< 20260108`까지 로컬 백필을 적용했고, biocom 헤더 캐시는 API 8,688건 + 운영 DB 백필 69,706건이 됐다. 남은 PlayAuto `site=null` 27,025건은 운영 DB에도 주문번호가 없어 이번 원천으로는 백필 불가하다.

### 지금 가장 큰 병목

첫 번째 병목은 biocom GA4 raw event를 아직 보지 못해 `(not set)` 원인을 추측으로만 좁히는 것이다.
두 번째 병목은 더클린커피 NPAY를 닫을 네이버 판매자 권한이 아직 없다는 것이다.
세 번째 병목은 운영 DB sync가 실패해도 바로 알 수 없는 것이다.
네 번째 병목은 취소/환불 dispatch가 실제 GA4와 Meta에 수신됐는지, 실패 시 누가 언제 보는지 아직 운영 기준으로 닫히지 않은 것이다.

---

#### Phase1-Sprint1

**이름**: 원천 데이터와 진실 소스

### 목표

각 숫자를 어느 시스템에서 믿을지 고정한다.
매출은 Toss, 주문과 회원은 Imweb, 배송과 전 채널 OMS 상태는 PlayAuto, 유입은 GA4, 서버 전환은 attribution ledger와 CAPI로 본다.

### 현재 상태

사실:
- Toss transactions와 settlements는 local SQLite에 충분히 쌓였다.
- Imweb orders와 members는 3사이트 기준으로 운영 판단이 가능한 수준까지 올라왔다.
- thecleancoffee와 aibio BigQuery raw export는 새 프로젝트에 연결됐다.
- thecleancoffee BigQuery는 GA4 화면과 로컬 서비스 계정 조회 기준이 일치한다. property ID는 `326949178`, stream ID는 `3970736456`, measurement ID는 `G-JLSBXX7300`, project ID는 `project-dadba7dd-0229-4ff6-81c`, project number는 `269220955383`, dataset은 `analytics_326949178`, 기본 위치는 `asia-northeast3`, 만든 사람은 `biocom015@gmail.com`, 작성일은 `2026-04-07`이다.
- 2026-04-19 09:41 KST read-only 확인에서 `analytics_326949178` dataset과 `events_*` 테이블 조회가 됐다. 테이블은 `events_20260407`부터 `events_20260417`까지 11개가 보였고, 최신 daily export는 `events_20260417`이다.
- thecleancoffee 최근 raw sanity check 기준 `20260412~20260417` 합계는 `total_events=14,821`, `purchase=123`, `distinct_purchase_transaction_ids=123`, `missing_user_pseudo_id=0`, 최신 이벤트 시각은 `2026-04-17 23:23:45 KST`다.
- 네이버 커머스 API는 현재 `BIOCOM_STORE_APP_ID/BIOCOM_STORE_APP_SECRET`로 OAuth SELF 토큰 발급, `last-changed-statuses`, `product-orders/query`, `orders/{orderId}/product-order-ids` 조회가 된다.
- 같은 자격 증명으로 바이오컴 네이버 주문번호는 조회되지만, 더클린커피 Imweb cache의 네이버 주문번호 샘플 5건은 모두 `400 / 101010 / 처리권한이 없는 주문번호를 요청했습니다`로 막혔다.
- biocom BigQuery raw export는 기존 `hurdlers-naver-pay` 링크 확인이 남았다.
- `tb_playauto_orders`는 0415 스냅샷 기준 정지였지만, 0417 확인 기준 `120,582행`, 최신 주문 `2026-04-16 17:54:02`, 최신 sync `2026-04-16 20:00:12`까지 복구됐다.
- `backend/scripts/check-source-freshness.ts`로 Toss, Imweb, PlayAuto, attribution ledger, thecleancoffee GA4 BigQuery 최신성 점검 스크립트를 만들었다. 2026-04-19 09:41 KST 실행 기준 운영 Toss와 PlayAuto, thecleancoffee BigQuery는 `fresh`, 로컬 Toss, Imweb, attribution ledger는 `stale`이다.

현재 판단:
- 원천 확보는 많이 좋아졌다.
- thecleancoffee는 GA4 property 접근과 BigQuery raw table sanity check가 모두 정상이다.
- 네이버 커머스 API 연결 자체는 정상이다. 다만 더클린커피 NPAY 원장 확인에는 현재 바이오컴 범위 자격 증명이 아니라 더클린커피 판매자 권한 또는 별도 앱 자격 증명이 필요하다.
- PlayAuto는 2026-04-18 자동 sync까지 재확인됐다. 다만 실패 알림과 operation log가 생겼는지는 아직 증명되지 않았다.

### 역할 구분

- TJ: biocom BigQuery legacy dataset 접근 권한과 허들러스 확인을 진행한다.
- Codex: 각 원천별 최신성 쿼리와 staleness 기준을 고정한다.
- Claude Code: 대시보드에 "어느 원천을 믿는가" 문구와 stale 배지를 붙인다.

### 실행 단계

1. [TJ] 허들러스에 `hurdlers-naver-pay` dataset 존재 여부와 최근 `events_*` 적재 여부 확인을 요청한다. 의존성: biocom GA4 raw export 판단의 선행필수.
2. [Codex] PlayAuto가 2026-04-18에도 자동 sync되는지 `MAX(synced_at)`로 재확인한다. 의존성: 병렬가능. 완료: 2026-04-19 09:41 KST 기준 `tb_playauto_orders` 최신 sync는 `2026-04-18 20:00:08 KST`다.
3. [Codex] source별 최신성 체크 쿼리를 하나의 점검 스크립트로 묶는다. 의존성: 부분병렬. 완료: `backend/scripts/check-source-freshness.ts`로 Toss, Imweb, PlayAuto, attribution ledger, thecleancoffee GA4 BigQuery 점검을 묶었다. 실행법은 `cd backend && npx tsx scripts/check-source-freshness.ts`다. biocom GA4 raw export 항목은 1번 결과가 들어온 뒤 추가한다.
4. [Claude Code] `/ads`와 `/crm`에 "데이터 기준 시각" 배지를 붙인다. 의존성: 부분병렬. 화면 자리와 문구는 먼저 만들 수 있지만, 최종 source별 배지 값과 경고 기준은 3번 점검 스크립트의 필드명이 확정된 뒤 연결한다.
5. [TJ] 더클린커피 네이버 커머스 API 앱 권한 또는 판매자 센터 API 권한을 확보한다. 의존성: 더클린커피 NPAY 원장 대사의 선행필수.
6. [Codex] 더클린커피 권한 확보 후 `backend/scripts/reconcile-coffee-ga4-naverpay.py`를 재실행해 GA4 NPAY 65건을 네이버 주문 원장과 닫는다. 의존성: 부분병렬. 스크립트와 GA4 원장 추출은 준비됐지만, 실제 네이버 원장 대사는 5번 권한이 필요하다.

### 완료 기준

- 5개 원천(Toss, Imweb, PlayAuto, GA4, attribution ledger)의 최신성이 한 화면에서 보인다.
- biocom BigQuery raw export 유지/이관 판단이 끝난다.
- PlayAuto sync가 3일 연속 정상 갱신되는지 확인된다.

### 우리 프로젝트에 주는 도움

어느 숫자를 믿어야 하는지 매번 다시 토론하지 않아도 된다.
광고비와 CRM 실험 판단의 기준 숫자가 흔들리지 않는다.

---

#### Phase1-Sprint2

**이름**: 공통 키와 결제 원장

### 목표

같은 주문과 같은 고객을 시스템마다 같은 대상으로 보게 만든다.
핵심 키는 `order_id_base`, `payment_key`, `normalized_phone`, `client_id`, `user_pseudo_id`, `ga_session_id`다.

### 현재 상태

사실:
- Attribution ledger는 `payment_status`를 가지고 있다.
- `WAITING_FOR_DEPOSIT`는 pending으로 남기고 메인 ROAS와 CAPI에서는 제외하는 방향이 잡혔다.
- recent payment_success와 form_submit row에는 GA 식별자가 일부 들어오기 시작했다.
- Meta CAPI는 confirmed 기준으로 보내는 구조가 있다.

현재 판단:
- 결제 원장은 운영 판단에 쓸 수 있다.
- 다만 GA4 raw event와 직접 붙이는 단계는 아직 약하다.

### 역할 구분

- TJ: 운영에서 `pending`을 매출로 보지 않는 기준을 승인한다.
- Codex: ledger의 공통 키 누락률과 상태 전이 결과를 매일 계산한다.
- Claude Code: `pending`, `confirmed`, `canceled`를 화면에서 혼동하지 않게 문구를 정리한다.

### 실행 단계

1. [Codex] `caller-coverage`를 site/source별로 매일 기록한다.
2. [Codex] `sync-status/toss` 결과에서 `pending -> confirmed/canceled` 전이를 요약한다.
3. [Claude Code] ROAS 카드에 `confirmed_revenue` 기준임을 명확히 표시한다.
4. [TJ] 운영자가 pending 금액을 메인 매출로 해석하지 않도록 기준을 공유한다.

### 완료 기준

- 메인 매출, ROAS, CAPI는 confirmed 기준으로만 계산된다.
- pending은 별도 KPI로만 보인다.
- GA 식별자 누락률이 날짜별로 추적된다.

### 우리 프로젝트에 주는 도움

가상계좌 미입금과 실제 결제 완료를 섞지 않는다.
Meta 학습과 내부 ROAS가 가짜 매출로 부풀지 않는다.

---

#### Phase2-Sprint3

**이름**: 주문-결제-구매확정 대사

연관 증거: `data/roasphase.md` Phase 4 (CAPI / Pixel dedup 검증) — 카드 confirmed, 가상계좌 pending 주문 단위 event_id 기록.

### 목표

주문이 실제 결제됐는지, 배송/구매확정 상태가 어디까지 갔는지 교차 확인한다.

### 현재 상태

사실:
- Imweb v2 status 라벨링으로 biocom `PURCHASE_CONFIRMATION`을 직접 읽을 수 있다.
- `datacheck0415.md` 기준 biocom 라벨링 커버리지는 94.4%였다.
- PlayAuto는 0417 확인 기준 백필이 들어왔고, 3/14 이후 `구매결정 2,457건`, `배송완료 2,361건`이 확인됐다.
- PlayAuto는 배송 상태와 전 채널 OMS 상태를 가진다.
- 더클린커피 GA4 `20260412~20260417` purchase는 123건, gross `5,588,498원`이다. 이 중 Toss confirmed와 transaction_id 기준으로 맞는 건은 51건이며 GA4 gross와 Toss confirmed/net 합계 차이는 `0원`이다.
- 같은 기간 GA4 NPAY purchase는 65건, gross `2,630,700원`이다. `backend/scripts/reconcile-coffee-ga4-naverpay.py`로 네이버 커머스 API와 대사했으나 현재 API 권한은 바이오컴 스토어 범위라 unique match는 0건이다.
- 현재 네이버 API 권한으로 조회된 `2026-04-12~2026-04-17` 결제창 주문은 63건, gross `5,273,000원`이지만 상품명/주문 접근 범위상 바이오컴 주문 원장이다. 더클린커피 GA4 NPAY 원장으로 쓰면 안 된다.
- 로컬 Imweb cache 보조 매칭은 더클린커피 NPAY prefix 후보 48건 중 금액 유일 매칭 7건, gross `245,400원`까지만 잡힌다. 이는 원장 대사가 아니라 보조 신호다.

현재 판단:
- PlayAuto가 복구되면 Imweb `PURCHASE_CONFIRMATION`은 primary가 아니라 cross-check로 쓰는 것이 맞다.
- PlayAuto가 stale이면 Imweb status를 임시 primary로 쓰되, 아임웹 경유 주문만 커버한다는 배지를 붙여야 한다.
- 더클린커피 NPAY 65건은 GA4 쪽 분모가 확정됐고, Toss 카드성 결제와 분리도 끝났다. 남은 일은 더클린커피 네이버 주문 원장 권한을 확보해 같은 기간 원장과 직접 맞추는 것이다.

### 역할 구분

- TJ: PlayAuto 복구가 revenue 팀에서 지속 운영되는지 확인한다.
- Codex: PlayAuto `구매결정`과 Imweb `PURCHASE_CONFIRMATION` delta를 계산한다.
- Claude Code: 구매확정 카드에 primary/backup 상태를 표시한다.

### 실행 단계

1. [Codex] PlayAuto와 Imweb 구매확정 비교 쿼리를 만든다.
2. [Codex] site별 delta 허용 범위를 정한다.
3. [Claude Code] `/ads` 또는 `/crm`에 구매확정 cross-check 카드를 붙인다.
4. [TJ] delta가 큰 날은 어느 원천을 기준으로 볼지 운영 판단을 확정한다.
5. [TJ] 더클린커피 네이버 커머스 API 조회 권한을 현재 개발 환경에서 사용할 수 있게 한다. 의존성: NPAY 원장 대사의 선행필수.
6. [Codex] 권한 확보 후 `backend/scripts/reconcile-coffee-ga4-naverpay.py --startSuffix=20260412 --endSuffix=20260417`로 GA4 NPAY 65건을 네이버 주문 원장과 재대사한다. 의존성: 부분병렬. GA4 NPAY 추출과 스크립트는 완료됐지만, 실제 원장 close는 5번 권한이 필요하다.

### 완료 기준

- PlayAuto 정상 시 primary=PlayAuto, backup=Imweb 규칙이 화면과 문서에 반영된다.
- PlayAuto stale 시 primary=Imweb 임시 전환과 커버리지 배지가 보인다.
- delta가 임계값을 넘으면 경고가 뜬다.
- GA4 NPAY 65건이 더클린커피 네이버 주문 원장 기준으로 matched, unmatched, canceled/refunded 후보로 나뉜다.

### 우리 프로젝트에 주는 도움

구매확정 매출과 재구매 코호트가 한 달 밀리는 일을 막는다.
운영자가 숫자의 기준 원천을 바로 알 수 있다.

---

#### Phase2-Sprint4

**이름**: 취소와 순매출 보정

### 목표

가상계좌 미입금, 실제 취소, 부분 취소, legacy 불명확 주문을 나눠서 순매출을 계산한다.

### 현재 상태

사실:
- Imweb `CANCEL` 금액은 실제 취소 금액보다 크게 과장된다.
- `datacheck0415.md` 기준 Imweb CANCEL은 약 10.6억으로 보였지만, Toss 기준 실제 취소율은 약 7.3% 수준이었다.
- 원인은 가상계좌 미입금 만료, Toss DONE but Imweb CANCEL, legacy 주문이 섞인 것이다.
- GA4 refund는 아직 구현되지 않았다.
- `capivm/capi.md` 기준 권장 방향은 A(BI 보정) 즉시, C(MP refund) 2주 내, B(GTM purchase 조건 차단) 금지다.

현재 판단:
- GA4 원본 purchase를 줄이는 방식은 하지 않는다.
- 먼저 BI/대시보드에서 net을 보정하고, 실제 결제 후 취소만 GA4/Meta refund로 보낸다.

### 역할 구분

- TJ: GA4 Measurement Protocol API secret 발급 여부를 결정한다.
- Codex: CANCEL 서브카테고리와 refund diff 배치를 구현한다.
- Claude Code: `/ads`에 gross와 net의 차이를 설명하는 UI를 붙인다.

### 실행 단계

1. [Codex] `purchase-confirm-stats`에서 CANCEL을 `actual_canceled`, `vbank_expired`, `partial_canceled`, `legacy_uncertain`으로 분리한다.
2. [Claude Code] `/ads` 카드에 Imweb 보정 net과 vbank expired를 별도 표시한다.
3. [TJ] GA4 MP API secret을 발급한다. 의존성: GA4 refund 실제 전송의 선행필수.
4. [Codex] Toss 상태 전이 diff에서 실제 refund만 GA4 Measurement Protocol로 보낸다. 의존성: 부분병렬. refund 대상 diff와 dry-run은 먼저 만들 수 있지만, GA4 MP 실제 전송은 3번 secret이 필요하다.
5. [Codex] 같은 diff에서 Meta CAPI Refund 설계를 확정한다. 의존성: 병렬가능. Meta refund 설계는 GA4 MP API secret과 독립적으로 진행할 수 있다.

### 완료 기준

- 대시보드의 순매출은 실제 취소만 반영한다.
- 가상계좌 미입금은 매출 취소가 아니라 결제 시도 후 포기로 분리된다.
- GA4와 Meta에 실제 환불이 따라간다.

### 우리 프로젝트에 주는 도움

광고 ROAS가 취소 전 gross로 부풀지 않는다.
어뷰저와 가상계좌 미입금이 매체 학습을 오염시키는 일을 줄인다.

---

#### Phase3-Sprint5

**이름**: GA4 `(not set)` 원인 분해

연관 증거: `data/roasphase.md` Phase 3 (식별자 품질 / checkout_started) — `fbclid -> _fbc`, `_fbp`, `checkout_id`, GA 3종 식별자 보존 테스트 결과와 새 푸터 운영 기록.

### 목표

GA4에서 구매 매출의 source/medium/campaign이 `(not set)`으로 잡히는 이유를 원인별로 나눈다.
목표는 `(not set)`을 0으로 만드는 것이 아니라, 어떤 몫이 구조 문제이고 어떤 몫이 태그 문제인지 잡아내는 것이다.

### 현재 상태

사실:
- `datacheck0406.md` 기준 2026-03-01~2026-03-30 GA4 `(not set)` 구매는 896건, 매출은 약 1.485억이었다.
- recent attribution ledger row에는 `ga_session_id`, `client_id`, `user_pseudo_id` 유입이 시작됐다.
- biocom GA4 purchase는 우리 footer snippet이 직접 쏘지 않는다. 실제 purchase는 biocom GTM에서 발화된다.
- biocom payment page에는 `GTM-W7VXS4D8 ... includes` 오류가 관찰됐다.
- biocom BigQuery raw export는 legacy link 확인이 아직 끝나지 않았다.

현재 판단:
- `(not set)`의 원인을 footer caller 전체 부재로 보면 틀릴 가능성이 높다.
- 지금 유력한 원인은 historical row, payment complete 페이지 세션 손실, GTM purchase 태그 품질, legacy raw export 미확인, 중복 purchase tag다.

### 원인 가설과 검증 방법

| 가설 | 확인 방법 | 닫히는 기준 |
|---|---|---|
| historical row가 대부분이다 | 2026-04-08 fetch-fix 전후로 `(not set)` 비율을 분리 | fix 이후 비율이 유의미하게 낮아짐 |
| 결제 완료 페이지에서 세션/캠페인 정보가 끊긴다 | BigQuery raw에서 `transaction_id`, `ga_session_id`, `user_pseudo_id`, `page_referrer`, `session_source`를 함께 조회 | purchase event의 session source가 비는 조건 확인 |
| GTM purchase 태그가 campaign 값을 못 싣는다 | W2/W7 Preview, DebugView, event_params 비교 | purchase payload의 source/medium/campaign 누락 위치 확인 |
| W7 custom script 오류가 payment page 태그 품질을 흔든다 | 오류 수정 전후 같은 날짜/상품군 `(not set)` 비율 비교 | 오류 제거 후 payment page console clean |
| 중복 purchase tag가 일부 blank row를 만든다 | GA4 purchaseEvents와 distinctTransactionIds 차이, raw transaction_id 중복 조회 | blank sender와 canonical sender 분리 |
| biocom raw export 부재로 원인 확인이 막힌다 | `hurdlers-naver-pay` dataset 접근 또는 새 export 연결 | raw event sanity query 가능 |

### 역할 구분

- TJ: biocom BigQuery raw dataset 접근 권한을 확보한다.
- Codex: raw query와 Data API fallback 진단 쿼리를 만든다.
- Claude Code: `(not set)` 진단 결과를 대시보드에 원인별 막대로 보여준다.

### 실행 단계

1. [TJ] `hurdlers-naver-pay`의 biocom raw export 접근 가능 여부를 확인한다. 의존성: biocom raw event 실제 조회의 선행필수.
2. [Codex] BigQuery raw query 초안을 만든다. 의존성: 부분병렬. query 초안과 파라미터 구조는 먼저 만들 수 있지만, biocom 실제 실행과 결과 해석은 1번 접근 확인이 필요하다.
   a. `transaction_id`별 purchase event
   b. 같은 `user_pseudo_id + ga_session_id`의 session_start
   c. `collected_traffic_source`와 `session_traffic_source_last_click`
   d. `page_location`, `page_referrer`, `ignore_referrer`
3. [Codex] BigQuery 접근 전 fallback으로 GA4 Data API 진단을 만든다. 의존성: 병렬가능. 1번 raw export 접근과 독립적으로 만들 수 있다.
4. [Codex] `/api/attribution/hourly-compare`, `/api/attribution/caller-coverage`, `/api/crm-phase1/ops`를 같은 날짜 범위로 묶는다.
5. [Claude Code] 원인별 비율 표를 `/ads` 또는 `/tracking-integrity`에 표시한다.
6. [TJ] 원인표를 보고 GTM 수정, BigQuery 이관, 운영 보정 중 무엇을 먼저 할지 결정한다.

### 완료 기준

- `(not set)` 매출이 원인 카테고리별로 나뉜다.
- 최소 카테고리는 `historical`, `session_lost`, `tag_payload_missing`, `duplicate_sender`, `raw_export_unknown`이다.
- 원인 합계가 전체 `(not set)` 구매의 90% 이상을 설명한다.

### 우리 프로젝트에 주는 도움

GA4가 왜 틀렸는지 감으로 말하지 않는다.
광고비 판단에서 GA4를 어디까지 참고할지 명확해진다.

---

#### Phase3-Sprint6

**이름**: 캠페인 매핑과 ROAS 기준

연관 증거: `data/roasphase.md` Phase 5 (Campaign-level ROAS / alias review), Phase 6 (같은 기준 ROAS 비교 뷰) — 연뜰살뜰/현서/송율 manual verified alias, `landingUrl=null` 광고 목록, Meta `1d_click` headline 기준 확정 근거.

### 목표

Meta 캠페인 이름, UTM, attribution ledger 주문, 내부 매출을 같은 캠페인으로 묶는다.

### 현재 상태

사실:
- `/ads`의 메인 ROAS는 Attribution 기준으로 보는 방향이 잡혔다.
- Meta confirmed attribution 주문 일부가 `(unmapped)`로 떨어진다.
- ad creative의 landingUrl만으로는 매핑이 부족하다.

현재 판단:
- 자동 fuzzy matching보다 file-based alias seed와 사람 검증이 먼저다.
- campaign_id, adset name, ad name, 운영 시작일을 같이 봐야 한다.

### 역할 구분

- TJ: 주요 캠페인 alias 후보를 사람 기준으로 승인한다.
- Codex: alias seed와 matcher를 구현한다.
- Claude Code: 캠페인별 ROAS 카드에 mapped/unmapped 비율을 표시한다.

### 실행 단계

1. [Codex] Meta campaign audit 결과에서 alias 후보를 정리한다.
2. [TJ] `manual_verified` 후보만 승인한다. 의존성: 운영 매핑 확정의 선행필수.
3. [Codex] `valid_from`, `valid_to`, `confidence`를 가진 matcher를 붙인다. 의존성: 부분병렬. matcher 구조와 테스트 fixture는 먼저 만들 수 있지만, 운영 alias 적용은 2번 승인 후보만 사용한다.
4. [Claude Code] `/ads`에 unmapped 매출과 mapped 매출을 분리 표시한다. 의존성: 부분병렬. 화면 구조는 먼저 만들 수 있지만, mapped 값은 3번 matcher 결과가 필요하다.
5. [Codex/TJ] `공동구매내역.md`의 로컬 산출치와 회사 추출본을 대사한다. 상태: 캠페인/회차 단위 1차 완료. 의존성: 부분병렬. 회사 공유본에는 주문번호가 없어 주문번호 1:1 대사는 `order_no` 포함 추출본이 필요하다. 현재 차이는 `2026-01-01~01-07 헤더 누락`, `공구 단어 없는 파트너 상품명`, `주문 헤더 금액/운영표 금액 차이`, `회사 파일 내부 메모와 달성매출 불일치`로 분류한다.

### 완료 기준

- 최근 7일 Meta attribution 주문의 80% 이상이 campaign_id로 매핑된다.
- unmapped 주문은 별도 큐로 남는다.
- ROAS 카드는 Attribution 기준과 Meta platform 기준을 혼동하지 않는다.
- 공동구매 로컬 산출치와 회사 추출본의 주문수·매출 차이가 설명 가능해진다. 2026-04-21 기준 캠페인/회차 단위 차이 설명은 완료됐고, 주문번호 1:1 대사는 회사 추출본에 주문번호가 추가되면 진행한다.

### 우리 프로젝트에 주는 도움

캠페인 예산 증감 판단이 계정 단위가 아니라 캠페인 단위로 가능해진다.

---

#### Phase4-Sprint7

**이름**: sync 감사와 stale 경고

### 목표

데이터가 언제까지 최신인지, sync가 실패했는지, 어떤 테이블이 stale인지 매일 자동으로 보이게 만든다.

### 현재 상태

사실:
- 운영 DB `tb_operation_log`는 2026-04-17 확인 기준 `domain=restock`만 있다.
- playauto/sync 관련 operation log는 0건이다.
- PlayAuto 데이터 자체는 백필됐지만, 실패 알림과 감사 로그는 아직 개선되지 않았다.

현재 판단:
- 데이터 복구와 운영 관측성 개선은 별도다.
- 지금 상태에서는 같은 문제가 다시 생겨도 사람이 직접 쿼리하기 전까지 모를 수 있다.

### 역할 구분

- TJ: revenue 팀에 sync 실패 알림과 operation log 확장을 요청한다.
- Codex: seo VM에 얇은 mirror sync log를 만든다.
- Claude Code: stale 경고 배지를 `/ads` 상단에 표시한다.

### 실행 단계

1. [TJ] revenue 팀에 `sync_playauto`, `sync_naver`, `sync_coupang`, `sync_iamweb`, `sync_toss` 로그 추가를 요청한다. 의존성: 운영 DB 감사 로그 확장의 선행필수.
2. [Codex] seo local DB에 `mirror_sync_log`를 만든다. 의존성: 병렬가능. local mirror log는 revenue 팀의 operation log 추가와 독립적으로 만들 수 있다.
3. [Codex] PlayAuto, Naver, Coupang, Toss, Imweb의 max timestamp를 읽어 staleness를 계산한다. 의존성: 병렬가능. max timestamp read-only 계산은 1번 운영 로그 확장 전에도 가능하다.
4. [Claude Code] warn/stale/down 상태를 대시보드에 표시한다. 의존성: 부분병렬. 화면 자리와 문구는 먼저 만들 수 있지만, 실제 상태 값은 3번 계산 결과가 필요하다.
5. [Codex] Slack 또는 대체 알림 경로가 생기면 실패 시 알림을 연결한다.

### 완료 기준

- sync 실패가 조용히 묻히지 않는다.
- 각 원천의 최신 데이터 시각이 화면에 표시된다.
- PlayAuto가 72시간 이상 stale이면 대시보드가 경고한다.

### 우리 프로젝트에 주는 도움

한 달 동안 데이터가 멈췄는데 아무도 모르는 상황을 막는다.

---

#### Phase4-Sprint8

**이름**: 운영 루틴과 대시보드

### 목표

데이터 정합성 확인을 개발자만 할 수 있는 쿼리가 아니라 운영자가 매일 보는 루틴으로 만든다.

### 현재 상태

사실:
- 여러 API와 문서는 존재한다.
- 하지만 매일 누가 무엇을 보고, 어떤 기준이면 이상으로 판단할지는 아직 완전히 고정되지 않았다.
- `/ads`, `/crm`, `/tracking-integrity`에 지표가 흩어져 있다.

현재 판단:
- 다음 단계는 새 원천 추가가 아니라 운영 루틴 고정이다.
- 대표와 운영자가 30초 안에 위험 지점을 볼 수 있어야 한다.

### 역할 구분

- TJ: 매일 볼 핵심 지표 5개를 승인한다.
- Codex: API 응답을 안정화하고 계산 기준을 문서화한다.
- Claude Code: 대시보드 카드와 경고 문구를 정리한다.

### 실행 단계

1. [TJ] 매일 볼 지표를 승인한다. 의존성: 운영 요약 카드의 최종 범위 확정에 선행필수.
   a. confirmed revenue
   b. pending virtual account amount
   c. actual canceled amount
   d. GA4 `(not set)` rate
   e. source staleness
2. [Codex] 위 5개 지표를 한 API 응답으로 묶는다. 의존성: 부분병렬. API 틀과 기존 5개 후보의 계산은 먼저 만들 수 있지만, 운영 고정 지표는 1번 승인 후 확정한다.
3. [Claude Code] `/ads` 상단에 데이터 정합성 요약 카드 5개를 배치한다. 의존성: 부분병렬. 카드 레이아웃은 먼저 만들 수 있지만, 최종 카드 이름과 순서는 1번 승인 결과를 따른다.
4. [TJ] 3일 동안 실제 숫자를 보고 기준을 조정한다.

### 완료 기준

- 운영자가 하루 한 번 화면만 보고 주요 데이터 위험을 판단할 수 있다.
- 쿼리 없이도 stale, pending, cancel, `(not set)` 경고를 본다.
- 이상 발생 시 다음 액션이 문구로 같이 보인다.

### 우리 프로젝트에 주는 도움

데이터 정합성이 프로젝트 문서 안에 머무르지 않고 실제 운영 판단에 들어간다.

---

#### Phase5-Sprint9

**이름**: NPay return 누락 감사 + 제거 A/B

### 목표

네이버페이 결제 완료 후 biocom.kr 로 리턴되지 않아 client-side GA4/Meta purchase 이벤트가 누락되는 구조 이슈를 정량화하고, NPay 버튼 제거 또는 server-side 보정 중 의사결정 근거 마련.

### 현재 상태

사실:
- 2026-04-21 00:47 KST GTM Preview Run 2 에서 **NPay 실제 결제 후 biocom.kr 복귀 안 함** 확인
- `shop_payment_complete` URL 미도달 → [143]/[48]/[43]/[251] 전부 발사 기회 없음
- **GA4 purchase / Meta CAPI Purchase / Meta Pixel Purchase** 이벤트 NPay 결제분에서 미발사
- **Google Ads [248] `TechSol-NPAY구매`** 는 **버튼 클릭 시점**에 발사 = 실제 결제 완료 여부 반영 안 함 (과다집계 위험)
- Backend 서버 DB (`attribution_ledger`, `imweb_orders`, `toss_transactions`) 는 정상 수신 — 매출 집계는 불가 서비스 영향 없음
- TJ 가 **NPay 버튼 제거 옵션 검토 중**

현재 판단:
- NPay 매출 비중을 모르면 제거 결정 불가. 1순위는 비중 측정.
- 서버-사이드 GA4 MP 로 purchase 복구하는 것이 유일한 실행 가능 보정책 (아임웹 설정 수정 외)
- 원본 상세 분석 문서 분리: `/Users/vibetj/coding/seo/GA4/npay_return_missing_20260421.md`

### 역할 구분

- TJ: NPay 매출 비중 확인 후 제거/유지 결정 승인. 아임웹 관리자 NPay 설정 확인.
- Claude Code: 로컬 DB 기반 NPay 매출 비중 쿼리, server-side GA4 MP purchase fallback 구현 (필요 시).
- Codex: 확장 쿼리 (Gooogle Ads [248] 실제 집계 vs 서버 DB 차이).

### 실행 단계

1. [Claude Code] **NPay 매출 비중 쿼리** 실행 — 최근 30/60/90일 `imweb_orders.pay_type='npay'` 비율, gross/confirmed 금액. 의존성: 병렬가능.
2. [TJ] BigQuery 에서 GA4 raw `add_payment_info (pay_method=npay)` vs `purchase (pay_method=npay)` 이벤트 수 비교. 의존성: 병렬가능. 쿼리는 `/Users/vibetj/coding/seo/GA4/npay_return_missing_20260421.md` §4-2 참조.
3. [TJ] 아임웹 관리자 → 결제 → NPay 설정에서 **return URL / 결제완료 동작** 확인. 의존성: 병렬가능.
4. [TJ] **1/2/3 결과 종합 후 의사결정**: (a) NPay 유지 + server-side 보정, (b) NPay 제거 + A/B 비교, (c) 아임웹 설정 수정으로 return URL 정상화 요청. 의존성: 선행필수 (위 1~3 완료).
5. [의사결정 (a)] [Claude Code] `refundDispatcher` 패턴으로 `backend/src/services/npayPurchaseDispatcher.ts` 구현. `imweb_orders.pay_type=npay` 새 주문 감지 → GA4 MP purchase 전송 + Meta CAPI Purchase 전송 (`event_id` dedup 고려). 의존성: 선행필수.
6. [의사결정 (b)] [TJ] NPay 버튼 제거 배포 → 2주 후 시계열 비교 (전체 매출 / 결제수단 분포 / 전환율 변화). 의존성: 선행필수. Rollback 기준 사전 설정 — 주간 매출 10% 이상 감소 시 복귀.

### 완료 기준

- NPay 결제 누락 비중이 정량화 (매출 대비 %)
- TJ 의사결정 (a / b / c) 결정
- 결정 방향에 따른 구현 / 배포 완료
- Publish / 제거 후 2주간 회귀 관측 지표 대시보드 제공

### 우리 프로젝트에 주는 도움

NPay 결제가 GA4 revenue 와 Meta ROAS 에서 보이지 않는 암흑을 밝히거나, 근본 제거로 데이터 정합성을 단순화. Google Ads 자동입찰이 실제 purchase 가 아닌 버튼 클릭으로 학습하는 오염도 같이 해결.

---

## GA4 not set 진단 기준

`(not set)`은 하나의 원인이 아니다.
아래 5개로 나눠서 잡아야 한다.

| 분류 | 설명 | 현재 상태 | 다음 확인 |
|---|---|---|---|
| historical | fetch-fix, CAPI guard, source guard 전 과거 row | 유력 | 2026-04-08, 2026-04-12, 2026-04-15 기준 전후 비교 |
| session lost | PG/결제완료 리다이렉트에서 세션 유입 정보가 끊김 | 유력 | BigQuery raw에서 purchase와 session_start 연결 |
| tag payload missing | GTM purchase payload가 source/medium/campaign을 못 실음 | 유력 | W2/W7 Preview와 DebugView 확인 |
| duplicate sender | 여러 purchase sender 중 하나가 빈 값으로 보냄 | 가능 | transaction_id별 sender/이벤트 중복 조회 |
| raw export unknown | biocom BigQuery raw 접근 부재로 확인이 막힘 | 확정 병목 | `hurdlers-naver-pay` 접근 또는 relink |

### GA4 not set 완료 기준

- `(not set)` 구매와 매출을 위 분류로 90% 이상 설명한다.
- fix 이후 신규 row의 `(not set)` 비율이 별도 추적된다.
- GA4 gross, attribution confirmed, Toss net의 차이를 한 화면에서 설명한다.
- GA4를 예산 판단의 primary로 쓸지, 보조지표로만 둘지 기준이 고정된다.

---

## 다음 액션

### 예약 — 2026-04-22 이후 (GA4 Unwanted Referrals 48h 대기)

2026-04-20 17:45 KST 에 biocom (`G-WJFXN5E2Q1`) + coffee (`G-JLSBXX7300`) GA4 Google 태그 구성에 **원치 않는 추천 7개 신규 추가** (`tosspayments.com` / `m.tosspayments.com` / `nicepay.co.kr` / `m.nicepay.co.kr` / `orders.pay.naver.com` / `new.kakaopay.com` / `pg.innopay.co.kr`). 기대 효과: 쿼리 2 에서 확인된 session_start_missing 1,158건(26%) — `(direct)` fallback 으로 잘못 분류된 PG 리다이렉트 세션의 원 UTM 복원. GA4 반영에 24~48h 필요.

1. [TJ] **2026-04-22 오후 이후** BQ Console 에서 아래 쿼리를 실행해 `(direct)_pct` 추이 확인. 의존성: 선행필수. GA4 반영 시간이 지난 뒤에 돌려야 의미 있다.
   ```sql
   -- 일자별 (direct) 비율 — Unwanted Referrals 설정 전후 비교
   SELECT
     event_date,
     COUNTIF(traffic_source.source = '(direct)') AS direct_events,
     COUNT(*) AS total_events,
     ROUND(100.0 * COUNTIF(traffic_source.source = '(direct)') / NULLIF(COUNT(*), 0), 1) AS direct_pct
   FROM `hurdlers-naver-pay.analytics_304759974.events_*`
   WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
                           AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
     AND event_name = 'purchase'
   GROUP BY event_date
   ORDER BY event_date;
   ```
2. [TJ] 2026-04-21 이후 일자에서 `direct_pct` 가 눈에 띄게 떨어지면 성공. 하락 폭이 기대(~25%) 보다 작으면 **다른 PG 도메인(예: 카카오페이 pg-web) 이 더 있거나 footer UTM 복원 로직이 추가로 필요**.
3. [TJ] 같은 쿼리를 coffee property 에도 돌린다. `GA4_COFFEE_PROPERTY_ID=326949178` 이고 coffee raw export 가 `hurdlers-naver-pay` 밖이라면 프로젝트 경로를 coffee dataset 경로로 바꿔야 한다 (예: `project-dadba7dd-0229-4ff6-81c.analytics_326949178.events_*`).
4. 결과를 `roadmap/confirmed_stopline.md` v2.3 에 기록한다.

### 지금 당장

1. [TJ] biocom BigQuery legacy raw export 접근을 허들러스에 확인한다.
2. [Codex] `purchase-confirm-stats` CANCEL 서브카테고리 설계를 작업 티켓으로 분리한다. 의존성: 병렬가능. CANCEL 설계는 1번 BigQuery 접근 확인과 독립적으로 진행할 수 있다.
3. [Claude Code] `/ads`와 `/crm`에 source freshness 결과를 붙일 화면 배지를 준비한다. 의존성: 부분병렬. 화면 구조는 먼저 만들 수 있지만, 실제 값은 `backend/scripts/check-source-freshness.ts` 결과를 따른다.
4. [TJ] 더클린커피 네이버 커머스 API 앱 권한 또는 판매자 센터 API 권한을 개발 환경에서 사용할 수 있게 한다. 의존성: GA4 NPAY 65건을 네이버 주문 원장으로 닫기 위한 선행필수.
5. [Codex] 권한 확보 후 `backend/scripts/reconcile-coffee-ga4-naverpay.py`를 재실행한다. 의존성: 부분병렬. GA4 NPAY 추출과 스크립트는 준비됐지만, 실제 네이버 원장 close는 4번 권한이 필요하다.

### 이번 주

1. [Codex] GA4 `(not set)` fallback 진단 API를 만든다.
2. [Claude Code] `/ads` 상단에 data trust 요약 카드 초안을 붙인다.
3. [TJ] GA4 MP API secret 발급 여부를 결정한다.
4. [Codex] PlayAuto와 Imweb 구매확정 delta 쿼리를 만든다. 의존성: 병렬가능. 구매확정 delta 쿼리는 3번 GA4 MP API secret과 독립적으로 진행할 수 있다.
5. [Codex/TJ] `공동구매내역.md`의 2026년 1~3월 로컬 산출치(`1,923건 / 587,240,065원`)와 회사 공동구매 추출본(`2,253건 / 645,941,680원`)을 맞춘다. 상태: 캠페인/회차 단위 1차 완료. 다음 단계는 회사 추출본에 주문번호를 붙여 주문번호 기준으로 닫는 것이다.

### 운영 승인 후

1. [Codex] GA4 Measurement Protocol refund를 실제 환불에만 연결한다.
2. [Codex] Meta CAPI Refund 보정 설계를 같은 상태 전이 diff에 연결한다.
3. [Claude Code] mapped/unmapped campaign ROAS 화면을 운영 카드로 고정한다.

---

## 업데이트 규칙

- `datacheck0415.md`는 고정 스냅샷이므로 과거 사실을 바꾸지 않는다.
- 새 사실은 이 문서에 먼저 반영한다.
- 숫자는 반드시 `기준 시각`, `대상 사이트`, `분모`를 같이 적는다.
- 완료율은 단일 숫자보다 `우리 기준 / 운영 기준`을 우선 쓴다.
- 원인이 확정되지 않았으면 `유력`, `가능`, `미확인`으로 나눈다.
- `[TJ]` 단계 다음의 `[Codex]` 또는 `[Claude Code]` 단계는 `의존성: 선행필수`, `의존성: 병렬가능`, `의존성: 부분병렬` 중 하나를 적는다.
- 같은 문서 내 이동 링크는 Obsidian wiki 링크만 쓴다.

---

## 업데이트 이력

| 시각 | 변경 | 근거 |
|---|---|---|
| 2026-04-25 11:12 KST | biocom GTM v138 1차 수신 검증 PASS. TJ 카드결제 테스트 주문 `202604254861543`은 GA4 Data API에서 `purchase 1건`, `transactionId=202604254861543`, `pay_method=homepage`, `pagePath=/shop_payment_complete`, `eventCount=1`, `purchaseRevenue=5950.53`으로 확인됐다. 2026-04-25 00:00~11:12 KST early window도 `purchase 8건 / distinct transactionId 8건 / transactionId 결측 0건 / duplicate extra 0건 / pay_method=homepage 8건`이다. 다음은 24h 완성창 재측정과 campaign mapping으로 이동 | GA4 Data API read-only runReport, property `304759974`, dimensions `eventName`, `transactionId`, `customEvent:pay_method`, `pagePath`, `pageLocation`, metrics `eventCount`, `purchaseRevenue`, `totalRevenue` |
| 2026-04-24 23:45 KST | biocom GTM v138 `ga4_purchase_duplicate_fix_20260424` publish 완료. `[143] HURDLERS purchase`를 canonical으로 유지하고 `pay_method=homepage`를 추가, `[48] GA4_구매전환_홈피구매`는 pause, `[43] GA4_구매전환_Npay`는 `purchase -> add_payment_info`로 강등했다. live API 검증에서 version 138과 세 태그 상태가 일치했다. 다음 검증은 24~48h 뒤 GA4 Data API 신규 row 기준으로 duplicate extra와 `transactionId` 결측 하락 여부를 본다 | `backend/scripts/gtm-fix-ga4-purchase-duplicates.mjs --apply --publish`, GTM API live version 138, `gtmaudit/gtm-ga4-purchase-duplicates-backup-20260424144504.json`, `gtmaudit/gtm-ga4-purchase-duplicates-result-20260424144504.json` |
| 2026-04-24 23:31 KST | GA4 `(not set)` 원인 분해 착수. Data API 기준 2026-04-21~24 `transactionId` 결측은 3.6% → 2.9% → 1.3% → 2.6%(당일 partial)로 낮아졌고, 잔여는 모두 NPay `/shop_cart` 클릭 발사 계열로 확인. 반면 `pay_method=(not set)`은 04-21/22에 90/79건, 04-23부터 빈 문자열 83건으로 이동해 HURDLERS `[143]` 계열 parameter 결측으로 분리. 동일 transactionId 3중 purchase는 `[143]` + `[48]` 동시 발사 구조가 남은 핵심 리스크로 판단 | GA4 Data API read-only runReport, dimensions `date`, `transactionId`, `customEvent:pay_method`, `pagePath`, `sessionSource`, metrics `eventCount`, `purchaseRevenue` |
| 2026-04-24 23:27 KST | 공동구매 Q1 로컬 산출치를 운영 DB 백필 및 1월 금액 보정 후 재계산. 현재 `/api/ads/coop-order-summary` 기준 biocom Q1 공동구매는 `1,923건 / 587,240,065원`, 회사 공유본 대비 매출 포착률 `90.9%`, 남은 격차 `330건 / 58,701,615원`. `/api/refund/dispatch` dry-run 기본 동작을 무기록 preview로 변경해 enforce 후보가 소모되지 않도록 수정. 과거 `site=null` 중 `iw_th` 51건 / 2,525,399원의 biocom GA4/Meta 오송신은 외부 플랫폼 역보정이 숫자/학습 신호를 더 왜곡하므로 미실행으로 결정 | localhost:7020 `/api/ads/coop-order-summary`, local `refund_dispatch_log` read-only prefix 집계, `backend/src/services/refundDispatcher.ts`, `backend/src/routes/refund.ts`, Google Analytics data deletion help |
| 2026-04-24 23:14 KST | 운영 DB, 로컬 DB, VM DB, 외부 API를 단일 정답이 아니라 질문별 primary/cross-check/fallback으로 쓰는 데이터 원천 교차검증 운영 프로토콜 추가. 운영 DB는 Imweb API pagination 한계를 보완해 과거 주문 헤더 공백을 해결할 수 있지만, 광고 식별자·GA4 세션·Meta event_id·Toss 취소 전이는 별도 원천이 필요하므로 confidence label 기반으로 판단하기로 함. 같은 원칙을 `AGENTS.md`에도 반영 | `data/!datacheckplan.md` 상단 프로토콜, `AGENTS.md` 데이터 정합성 작업 규칙 |
| 2026-04-24 23:08 KST | Refund pending 22건 / 913,163원 enforce 완료. dry-run 대체로 `/api/refund/pending-preview`와 local candidate 집계를 먼저 확인했고, 22건 전부 `iw_th -> thecleancoffee`로 추론됨. `POST /api/refund/dispatch?mode=enforce&limit=500` 결과 Meta Refund 22/22, GA4 Refund 22/22, Meta Purchase(-) 22/22 성공, skip 0. 이후 `detectPendingRefundCandidates(5000)` 남은 후보 0건 | localhost:7020 `/api/refund/pending-preview`, `REFUND_DISPATCH_ENFORCE=true`, local `refundDispatcher` candidate 집계, `/api/refund/summary?windowDays=90`, `/api/refund/log?site=thecleancoffee` |
| 2026-04-24 22:46 KST | 바이오컴 로컬 `imweb_orders` 헤더 캐시에 운영 DB `tb_iamweb_users` 기반 백필 적용. 원인은 아임웹 v2 `shop/orders` API 페이지 범위 한계로 확인됨: 2026-04-24 재검증 기준 `totalPage=160`, `offset=160` oldest `2026-01-21T13:40:37Z`, `offset=161` 빈 응답. `order_number` prefix `< 20260108`까지 로컬 SQLite에 적용해 biocom 헤더는 API 8,688건 + ops 69,706건이 됐고, 주문번호 중복은 0건. 기존 1월 초 ops 백필의 `SUM` 과대계상도 `MAX(order-level amount)` 기준으로 보정했으며 PG 금액과 69,706건 전부 일치. `iw_bi` 취소/환불 헤더 미조인은 1,373건에서 4건으로 감소. 남은 4건은 `pa...`/`O...` 비표준 order_id라 payment_key prefix 라우팅으로 처리해야 함 | local `backend/data/crm.sqlite3` 백업 후 apply, `backend/scripts/backfill-iamweb-pre-2026-header.ts --apply`, Imweb v2 order API read-only, 운영 DB `tb_iamweb_users` read-only |
| 2026-04-21 20:32 KST | 바이오컴 2026년 1월 초 주문 헤더 누락분의 Toss 매칭 가능성 검토. 전체 `site` 미확정 상품 라인 주문번호 716개 중 Toss 정산 원장 매칭은 605개, gross `163,058,064원`. 공동구매성 누락 주문은 170개 중 170개 전부 Toss 매칭, gross `50,355,900원`. Toss 미매칭은 운영 DB 기준 정기결제, 네이버페이 주문형, 무료결제가 대부분이라 Toss 단독 백필은 불가. 운영 DB 백필 + Toss 교차검증 구조로 결정 | local `toss_settlements`, `toss_transactions`, `imweb_order_items` read-only, 운영 DB `tb_iamweb_users` read-only |
| 2026-04-21 19:27 KST | 바이오컴 2026년 1월 초 주문 헤더 누락 원인 분석. 로컬 `imweb_orders`는 아임웹 v2 `shop/orders` API 백필 범위에 의존하고, 현재 API는 `offset=165`의 `2026-01-18T11:21:57Z`까지만 반환한다. `offset=166` 이후는 빈 응답. PlayAuto 상품 라인의 2026-01-01~01-07 `site` 미확정 주문번호 716개 중 713개가 운영 DB `tb_iamweb_users`에 매칭되므로 주문은 존재하며, 복구는 운영 DB 기반 백필로 진행해야 한다 | local `backend/data/crm.sqlite3` read-only, Imweb v2 order API read-only, 운영 DB `tb_iamweb_users` read-only |
| 2026-04-21 19:15 KST | 바이오컴 2026년 1분기 공동구매 회사 공유본과 로컬 산출치 1차 대사 완료. 회사 기준 `2,253건 / 645,941,680원`, 로컬 기준 `1,668건 / 512,906,191원`, 차이 `585건 / 133,035,489원`. 핵심 원인은 1월 초 주문 헤더 누락과 아랑 4차 미분류. 주문번호 없는 캠페인 합산표라 주문번호 1:1 대사는 아직 미완료 | `data/공동구매_26년 1분기.xlsx`, `공동구매내역.md`, local `backend/data/crm.sqlite3` read-only 집계 |
| 2026-04-21 01:50 KST | **BigQuery 자체 프로젝트 이전 계획 수립**. 허들러스 `hurdlers-naver-pay.analytics_304759974` → 자체 `seo-aeo-487113.analytics_304759974`. 타이밍: 2026-05-05 (v136/v137 baseline 2주 확보 후). 방식: 신규 GA4 BigQuery Link + 과거 table 일회성 copy. 사전 작업 5개. 비용 월 $1 미만 예상. 상세: `/Users/vibetj/coding/seo/data/bigquery_migration_plan_20260421.md` | GA4 Admin API, `sourceFreshness.ts` `ga4_bigquery_biocom` 현재 미활성 상태, 허들러스 service account 권한 미부여 |
| 2026-04-21 01:40 KST | **🎉 GTM v137 publish 완료**. 가상계좌 미입금 GA4 purchase 차단. 변수 [252] `JS - vbank blocked` + 트리거 [253] Exception + 태그 [143]/[48]/[154] blockingTriggerId 연결. [251] prep v3 (dataLayer.set + server-branch guard). Preview A(카드 11,900원)/B(가상계좌 35,000원) 양쪽 통과 후 배포. C-Sprint 3 vbank_expired ₩966M 의 GA4 확장 이슈 해결 | `backend/gtm_publish.mjs` 실행 log, GTM API live 매칭 확인, `GA4/gtm_exception_trigger_draft_20260421.md` v2 |
| 2026-04-21 01:15 KST | **Phase5-Sprint9 NPay return 누락 감사 + 제거 A/B 신설**. 2026-04-21 00:47 GTM Preview Run 2 에서 NPay 실제 결제 후 biocom.kr 복귀 안 함 관측. `shop_payment_complete` 미도달로 GA4 purchase / Meta CAPI Purchase 미발사. Google Ads [248] 는 버튼 클릭 시점에 발사되어 실제 결제 미반영 과다집계 위험. 상세 분석 문서 신규 작성 | `/Users/vibetj/coding/seo/GA4/npay_return_missing_20260421.md`, GTM Preview Run 2 스크린샷 3장 |
| 2026-04-20 17:45 KST | biocom + coffee GA4 Google 태그에 **원치 않는 추천 7개 추가** (`tosspayments.com` / `m.tosspayments.com` / `nicepay.co.kr` / `m.nicepay.co.kr` / `orders.pay.naver.com` / `new.kakaopay.com` / `pg.innopay.co.kr`). biocom 은 기존 13개 포함 총 20개. 핵심 누락이었던 `tosspayments.com` 포함. GA4 반영 24~48h 후 쿼리 4/5 재실행 필요. `### 예약 — 2026-04-22 이후` 섹션에 실행 쿼리와 예상 패턴 기록 | BQ 쿼리 1/2 로 확인된 session_lost 1,158건(26%), BQ 쿼리 4 로 확인된 raw (not set)=0%, GA4 Admin UI 스크린샷 |
| 2026-04-20 12:29 KST | 바이오컴 2026년 1~3월 공동구매 로컬 산출치와 회사 추출본을 대사해야 하는 항목 추가. 로컬 기준값은 `공동구매내역.md`의 공동구매성 주문 `1,668건`, 주문 매출 `512,906,191원`이며, 회사 추출본과 주문번호 기준으로 일치 여부를 확인해야 한다 | `공동구매내역.md`, local `backend/data/crm.sqlite3` read-only 집계 |
| 2026-04-20 01:19 KST | 더클린커피 GA4 NPAY 65건 대사 시도 결과 반영. GA4 NPAY는 65건, gross `2,630,700원`으로 확정. 현재 네이버 커머스 API 자격 증명은 바이오컴 주문 원장만 조회되고 더클린커피 주문번호 샘플은 `400 / 101010 / 처리권한 없음`으로 막혀 네이버 주문 원장 대사는 권한 확보 전까지 미완료로 분리 | `backend/scripts/reconcile-coffee-ga4-naverpay.py`, BigQuery GA4 raw read-only 조회, Naver Commerce API read-only 조회, local Imweb cache read-only 조회 |
| 2026-04-19 09:41 KST | thecleancoffee BigQuery viewer 권한 반영 확인. GA4 화면의 stream/project metadata를 기준 문서에 저장하고, `ga4_bigquery_thecleancoffee`를 source freshness script에 추가. 최신 daily table은 `events_20260417`, 최근 raw `20260412~20260417` purchase는 123건, distinct transaction_id도 123건 | GA4 화면 메타데이터, BigQuery dataset/table read-only 조회, `backend/scripts/check-source-freshness.ts` 실행 |
| 2026-04-18 02:37 KST | thecleancoffee BigQuery 상태 확인. 문서 기준 새 프로젝트 연결은 유지로 보되, 현재 서비스 계정은 BigQuery dataset 조회 권한이 없어 raw `events_*` 적재 확인은 미완료. GA4 Data API는 property `326949178`에서 최근 7일 이벤트와 purchase 143건 조회 성공 | `data/bigquery0409.md`, GA4 Data API read-only 실행, BigQuery dataset get/list 403 |
| 2026-04-17 KST | `roasphase.md`를 증거 저장소로 연결. Sprint3/5/6에 roasphase Phase 3/4/5/6 교차 참조 추가. 전체 병합은 하지 않는 이유: roasphase는 2026-04-12 시점 주문 단위 증거 스냅샷이고 이 문서는 가변 기준판이라 성격이 다름. Codex 의견도 부분 흡수/분리 유지 권고 | `data/roasphase.md`, `roadmap/roadmap0415.md`의 roasphase 참조 관계 유지 |
| 2026-04-17 19:13 KST | source별 최신성 점검 스크립트 추가. Toss/Imweb/PlayAuto/attribution ledger 병렬 가능 범위를 먼저 구현하고, biocom GA4 raw export는 허들러스 확인 뒤 추가하는 것으로 분리 | `backend/scripts/check-source-freshness.ts`, 2026-04-17 19:13 KST read-only 실행 결과 |
| 2026-04-17 19:05 KST | 최초 작성. 0406 방향 문서와 0415 고정 스냅샷을 합쳐 가변형 기준 문서로 분리 | `datacheck0406.md`, `datacheck0415.md`, 2026-04-17 PlayAuto read-only 확인 |
