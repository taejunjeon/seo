# Channel funnel quality 정본 (실제 개발 순서)

작성 시각: 2026-05-08 02:00 KST
최종 업데이트: 2026-05-17 00:37 KST
기준일: 2026-05-17
상태: active canonical
Owner: data / channelfunnel
Supersedes: none (신규 정본)
Next document: [[../gdn/bi-confirmed-purchase-operational-dry-run-20260510]] / [[../gdn/confirmed-purchase-prep-recalc-20260510]] / [[../gdn/vm-cloud-imweb-sync-status-review-20260510]] / [[../gdn/path-b-real-paid-click-actual-order-preview-result-20260510]]
Do not use for: GA4/Meta/Google Ads/TikTok/Naver 실제 전송, conversion upload, conversion action 변경, 광고 변경, 운영DB write 외 (paid_click_intent canary 범위 안에서만)

## 프로젝트 OKR와 액션플랜

이 프로젝트의 목적은 **광고비를 어디에 더 쓰고 어디를 줄일지 판단할 수 있게, 유입부터 실제 결제완료와 Meta CAPI 전송까지 한 화면에서 믿을 수 있게 보는 것**이다. 광고 플랫폼이 주장하는 구매가 아니라, VM Cloud 수집 원장과 운영DB 결제완료 기준을 분리해서 본다. 이 문서는 전송 실행 문서가 아니며, Google Ads/Meta/TikTok/Naver upload·send·광고 변경은 별도 Red 승인 전에는 하지 않는다.

### Objective

2026년 5월 말까지 `유입 -> 장바구니 페이지 진입 -> 결제 시작 -> 결제수단 선택 -> 실제 결제완료 -> Meta CAPI 성공 -> 내부/플랫폼 ROAS 비교` 흐름을 일별·주별로 안정적으로 감시한다. 대표 화면에서는 “지금 어디가 새고 있는지”를 30초 안에 보고, 개발 화면에서는 “어떤 source/table/API를 고쳐야 하는지”를 바로 찾게 한다.

### Key Results

1. **퍼널 관제 속도**: `/ai-crm/conversion-funnel` 기본 화면은 사전 계산된 캐시를 우선 읽어 500ms 안에 보여준다. 기준 데이터 날짜와 다음 갱신 시각을 화면에 표시한다.
2. **결제완료와 CAPI 누락 감시**: `결제완료는 있는데 Meta CAPI 성공 로그가 없는 row`를 0건에 가깝게 유지한다. 누락이 있으면 safe_ref 기준 상세 사유와 다음 조치를 펼쳐 볼 수 있어야 한다.
3. **채널 근거 분리**: Meta/Naver/Google/organic/direct/unknown을 섞지 않는다. 주문·결제 정본과 광고 클릭 evidence를 분리하고, 예산 판단용 값과 참고용 값을 화면과 문서에 명시한다.
4. **ROAS 두 값 병렬 표시**: 내부 ATT ROAS(실제 결제완료 주문 원장 기준)와 매체 주장 ROAS(광고 플랫폼 Ads Manager/Google Ads 기준)를 일별·7일 기준으로 함께 보여준다. 두 값이 다르면 source/window/freshness/caveat를 같이 남긴다.
5. **운영 안전성**: Browser Purchase가 0이어도 Server CAPI가 살아 있으면 치명 장애로 보지 않는다. 단 CAPI failed, duplicate, no-send queue, site/pixel 혼입은 Critical로 올린다.
6. **KR7 전송 준비 분리**: Meta CAPI / GA4 / 외부 전송은 `준비 상태`와 `실제 전송 실행`을 분리한다. no-send, duplicate guard, dedup key, refund/cancel guard, Meta Events Manager 검증, Test Events smoke가 PASS하기 전에는 actual purchase 전송을 확장하지 않는다.

### 현재 판단

- **5/16 이후 CAPI 누락이 줄어든 핵심 이유는 Meta 유입 감소보다 VM Cloud backend 보강 영향이 더 크다.** 5/16에도 Meta evidence confirmed가 있었고, CAPI success가 결제완료 수를 커버했다.
- **Browser Purchase는 아직 보조 리스크다.** Meta 학습 신호는 Server CAPI 성공 여부를 우선 본다.
- **장바구니 단계는 클릭이 아니라 `장바구니 페이지 진입` 기준으로 표시한다.** 아임웹/GTM 코드를 추가로 건드리지 않고 VM Cloud landing row로 먼저 구현한다.
- **당일 데이터는 무거운 실시간 조회가 아니라 4시간 단위 사전 계산값으로 본다.** 기본 화면은 어제 데이터 또는 최신 안정 캐시를 우선 보여주고, 당일 데이터는 버튼으로 분리한다.
- **KR7은 이 문서에 포함한다.** channel funnel은 단순 유입 분석이 아니라 `실제 결제완료 신호가 Meta/GA4/광고 플랫폼으로 안전하게 갈 준비가 됐는지`까지 보는 화면이므로, no-send/중복/환불/Events Manager 검증을 별도 트랙으로 관리해야 한다.

### 액션플랜

#### P0. 관제 화면을 빠르고 안정적으로 만든다
- 무엇을 한다: funnel-health와 ROAS summary를 캐시 기반으로 읽고, 기본 화면은 어제 안정 데이터 또는 최신 precompute 결과를 먼저 보여준다.
- 왜 한다: 대표가 화면을 열 때 Meta API/VM Cloud 실시간 계산 때문에 로딩이 길어지면 관제 화면으로 쓸 수 없다.
- 성공 기준: 기본 로딩 500ms 이하, `데이터 기준 시각`, `다음 갱신 시각`, `source=in_memory_precompute 또는 roas_summary_precompute`가 화면에 보인다.
- 담당: Codex/Claude Code.
- 승인: VM Cloud 배포는 Yellow, 로컬/문서/계약 정리는 Green.

#### P0. CAPI 누락 큐를 사람이 바로 볼 수 있게 한다
- 무엇을 한다: `결제완료는 있는데 Meta CAPI 전송 기록이 없음` 카드를 클릭하면 각 row의 safe_ref, 금액, 결제 시각, source bucket, no-send/누락 사유, 추천 조치가 펼쳐지게 한다.
- 왜 한다: CAPI 누락은 광고 학습 신호가 빠지는 직접 원인이라 Critical이다. 요약 숫자만 있으면 실제 조치를 못 한다.
- 성공 기준: raw order/payment/click/member/email/phone 없이 safe_ref만 표시하고, backfill_ready/no_send_guard/duplicate/value_mismatch/source_gap으로 분류된다.
- 담당: Codex.
- 승인: 표시/분류는 Green, 실제 Meta backfill send는 Red.

#### P0. KR7 전송 준비 guard를 화면과 문서에 고정한다
- 무엇을 한다: Meta CAPI / GA4 / 외부 전송 준비 상태를 `no-send`, `dedup`, `duplicate`, `refund/cancel`, `Events Manager`, `Test Events` 체크로 나누어 관리한다.
- 왜 한다: channel funnel에서 결제완료까지 봐도, 실제 전송 guard가 약하면 Meta/GA4/Google Ads에 중복 구매나 환불 전 구매가 들어가 ROAS가 오염된다.
- 성공 기준: actual purchase 전송 확대 전 `중복 event_id 0`, `환불/취소 no-send`, `0원 no-send`, `payment_page_seen no-send`, `Events Manager 수신 확인`, `Test Events smoke PASS`가 각각 보인다.
- 담당: Codex.
- 승인: guard 설계·화면 표시·dry-run은 Green, 실제 플랫폼 send/upload 확대는 Red.

#### P0. 장바구니 단계를 VM Cloud 기준으로 복구한다
- 무엇을 한다: 장바구니 클릭이 아니라 `/shop_cart` 또는 장바구니 URL landing row를 `cart_page_seen`으로 계산해 퍼널 단계에 넣는다.
- 왜 한다: Meta Pixel AddToCart와 VM Cloud 원장은 다른 source다. 현재 관제 화면은 VM Cloud 기준이므로 VM Cloud에 이미 있는 페이지 진입 evidence부터 써야 한다.
- 성공 기준: `유입 -> 장바구니 페이지 진입 -> 결제 시작` 단계가 모두 0이 아닌 실제 row 기준으로 보이고, source가 `VM Cloud site_landing_ledger`임을 표시한다.
- 담당: Codex.
- 승인: backend/frontend 배포는 Yellow, read-only 검증은 Green.

#### P1. 5/14~5/15 Meta evidence CAPI 누락분을 재분류한다
- 무엇을 한다: 5/14, 5/15에 남은 Meta evidence missing row를 backfill_ready/no_send_guard/duplicate/value_mismatch/source_gap으로 분류한다.
- 왜 한다: 5/16 이후는 안정됐지만 incident 구간의 빠진 구매 신호는 별도 복구 판단이 필요하다.
- 성공 기준: 각 row가 send 가능/금지/보류 중 하나로 닫히고, 실제 send 후보는 duplicate 0과 value guard pass가 확인된다.
- 담당: Codex.
- 승인: 분류는 Green, Meta backfill send는 Red.

#### P1. 14일/30일 채널 퍼널을 정기화한다
- 무엇을 한다: 7일 기준뿐 아니라 14일/30일로 Meta, Google, Naver, TikTok, organic, direct의 유입 품질과 결제 전환을 본다.
- 왜 한다: 하루나 7일만 보면 광고 품질과 tracking 장애를 혼동할 수 있다.
- 성공 기준: landing, cart_page_seen, payment_started, payment_page_seen, confirmed_purchase, CAPI success, Ads Manager attributed purchase가 같은 window로 비교된다.
- 담당: Codex.
- 승인: read-only/문서 Green.

#### P2. Meta clean landing 실험을 설계한다
- 무엇을 한다: Meta 유입용 landing bucket을 리뷰/고객 사례/웰니스 가이드처럼 민감도가 낮은 path로 분리하는 실험안을 만든다.
- 왜 한다: biocom.kr이 건강/웰빙 데이터 소스 제한을 받고 있어 Ads Manager attribution이 낮게 잡힐 수 있다.
- 성공 기준: 기존 landing vs clean landing의 내부 ATT ROAS, Ads Manager ROAS, CAPI success, Meta strong evidence가 3~7일 기준으로 비교된다.
- 담당: Codex 설계, TJ님 광고 플랫폼 변경 승인.
- 승인: 설계 Green, 광고 URL/예산 변경 Red 또는 Yellow.

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!datacheckplan.md
    - data/!bigquery_new.md
    - total/!total-current.md
    - gdn/!gdnplan_new.md
    - GA4/gtm.md
  lane: Green BigQuery raw 분석 + 운영DB read-only join 정본
  allowed_actions:
    - GA4 BigQuery raw read-only query (SA seo-656)
    - 운영DB(PostgreSQL) read-only (tb_iamweb_users, tb_playauto_orders)
    - VM Cloud SQLite read-only (imweb_orders, attribution_ledger, paid_click_intent_ledger, npay_intent_log)
    - source_group 분류 + funnel 산출
    - 정본 update
  forbidden_actions:
    - 광고 플랫폼 전송
    - GA4/Meta CAPI/Google Ads upload
    - 운영DB write 외 (paid_click_intent canary 범위만)
    - 광고 변경
  source_window_freshness_confidence:
    source: "GA4 BigQuery raw (hurdlers-naver-pay) + 운영DB(PostgreSQL) tb_iamweb_users + live paid_click_intent canary ledger"
    window: "2026-05-01 ~ 2026-05-07 KST baseline + canary 2026-05-07 23:01~2026-05-08 17:23 KST"
    freshness: "events_20260506 last_mod 2026-05-07 00:39 UTC + 운영DB(PostgreSQL)/VM ledger read-only 2026-05-08 17:23 KST + Path B hash-only design 2026-05-08 20:38 KST + actual Google ad click no-send bridge PASS 2026-05-10 01:31 KST + unpaid vbank exclusion guard 2026-05-10 01:51 KST + VM Cloud biocom/thecleancoffee status sync 2026-05-10 15:12 KST + 운영DB PAYMENT_COMPLETE dry-run 2026-05-10 15:14 KST 반영"
    confidence: 0.93
```

## 10초 결론

biocom 7일 channel funnel quality 비교 결과, **paid_tiktok은 광고 품질 위험 (sessions 19,563 / avg engagement 1초 / scroll90 1.58% / GA4 purchase 0건)**, **paid_google은 NPay 결제 흐름이 GA4 purchase로 fire 안 됨 (add_payment_info 770 / GA4 purchase 4건)**. **NPay 결제완료는 모든 source_group에서 GA4 purchase event 0건** — 이는 GTM v138 의도된 변경 ("[43] GA4_구매전환_Npay" 를 `purchase` → `add_payment_info` 로 강등) 결과. 실제 NPay 결제완료는 운영DB(PostgreSQL)/imweb_orders에만 있으며 click id 보존률이 0.8%로 매우 낮아 Google Ads 후보 prep이 어려운 상태. paid_click_intent canary 가 click id transit gap을 메꾸는 단계다.

2026-05-08 17:23 KST Green 재측정 기준, **운영DB(PostgreSQL) 기반 새 dry-run input은 생성 완료**(canary 18.4h window, 결제완료 positive 52 orders / homepage 48 / NPay actual 4 / `send_candidate=0`)했으나, **canary effect/uplift 비교는 아직 HOLD**다. live `paid_click_intent_ledger` 직접 source는 709 rows / unique click hash 428 / checkout_start 135 / npay_intent 113까지 쌓였지만, ledger schema에 `member_code_hash`·`order_number` 결합키가 없어 주문 52건 모두 prior click 후보가 2건 이상(median 329, p90 644)으로 모호하다. 따라서 ledger 직접 source는 **수집기가 잘 작동하는지 보는 건강검진**에는 의미가 있고, confirmed_purchase order-level 효과 비교에는 아직 의미가 없다.

2026-05-08 20:06 KST 결정 반영: **24h audit은 자동 진행**, **Path C wrapper Preview는 비로그인 안전성 PASS / 로그인 NPay 클릭 흐름 확인 / member_code 후보 변수 empty / source 재탐색에서도 usable client-side source 없음**, **backend deploy는 HOLD**, **actual send/Google Ads upload/conversion action 변경은 NO**. wrapper Preview 1단계는 raw member_code를 네트워크로 보내지 않고, live click id 대신 `TEST_` click id만 쓰는 client-side placeholder hash availability 확인으로 제한했지만 현재 source가 없어 Production publish로 승격하지 않는다.

wrapper Preview 실행 결과: 공개 상품 2페이지에서 6개 payload 모두 receiver 200, raw member_code/PII/order/payment/value 0, live click id 0, ledger.stored 0으로 safety는 PASS했다. 이후 TJ님 수동 Tag Assistant 캡처에서 로그인 후 NPay 구매하기 클릭과 주문/결제 창 도달은 확인됐다. 기존 Google Ads/GA4/ChannelTalk NPay 태그가 결제완료 전에도 발화되는 점도 재확인했다. GTM read-only로 `memberCode`, `Retous - [변수] memberCode`, `RETOUS - [변수] member_code`, `Retous - [맞춤] memberCode` 후보 변수가 존재함을 확인했지만, 200/201/203 값은 모두 empty/undefined였다. 추가 source 재탐색에서도 `dataLayer.member_code`, `localStorage.__bs_imweb.memberCode`, `sessionStorage.__bs_imweb_session.memberCode`, `window.imweb.user.member_code`, `window.hurdlers_ga4.member_code` 등은 모두 absent였다.

2026-05-08 20:17 KST fallback bridge 검토를 추가했다. raw email bridge는 운영 사용 금지이고, `email_hash/HMAC` bridge는 개인정보/Yellow 승인 후보로만 남긴다. 비회원까지 커버하려면 Path B `order_confirm` bridge를 hash-only로 설계해야 한다. Retous/Imweb legacy memberCode 변수는 현재 `deprecate_candidate`지만 전체 GTM 태그 정리나 pause/delete는 하지 않는다.

2026-05-10 01:31 KST 실제 Google 광고 클릭에서 바이오컴 주문완료 화면까지 Path B no-send bridge는 PASS했다. order hash, email identity hash, client/session, click hash가 모두 잡혔다. 다만 이 주문은 가상계좌 미입금이므로 실제 결제완료 구매가 아니다. 따라서 channel funnel evidence로는 유용하지만 Google Ads upload, confirmed_purchase, 내부 confirmed ROAS 후보에는 쓰지 않는다. 다음 P0는 `payment_status != confirmed`와 `payment_method=vbank AND paid_at missing`을 block rule로 고정하는 일이다.

2026-05-10 15:14 KST 운영DB `PAYMENT_COMPLETE` 기준 dry-run은 결제완료 주문 4건(homepage 3 / NPay 1), total value 862,000원, send_candidate 0건으로 PASS했다. VM Cloud-only ConfirmedPurchasePrep 재계산은 homepage 35건, NPay actual 0건인데, 이는 VM Cloud에 primary payment status column이 없기 때문이다. 따라서 channel funnel 판단에서는 운영DB confirmed source를 primary로 쓰고, VM Cloud lifecycle status는 보조값으로만 쓴다.

현재 OKR 기준 전체 완성도는 약 68%다. Path B 주문완료 bridge는 88%, NPay actual confirmed 분리는 76%, Google Ads ROAS internal confirmed 전환은 42%, NPay click/count 오염 분리는 72%, HOLD Reducer/GTM lifecycle 정본 patch는 65%로 본다. 다음 상승 구간은 운영DB primary source를 ConfirmedPurchasePrep input에 연결하고, NPay click-only와 미입금/controlled evidence를 upload 후보 0건으로 계속 막는 것이다.

**90% scroll 비중만으로도 channel quality 격차 명확** (paid_tiktok 1.58% vs organic_naver 31.03% = 19배). 50% scroll은 ProductEngagementSummary POC ([[../GA4/product-engagement-summary-poc-20260508]]) 별 트랙으로 분리하되 90% scroll로 채널 비교는 우선 가능.

## Phase-Sprint 요약표 — 실제 개발 순서 기준

| Priority | Phase/Sprint | 무엇을 하는가 | 왜 하는가 | 어떻게 진행하는가 | 지금 상태 | 현재 진척률 % | 100% 조건 | 다음 단계 / 담당 | 승인 필요 여부 | Source 문서 |
|---:|---|---|---|---|---|---:|---|---|---|---|
| P0 | [[#Phase1-Sprint1]] | 7일 channel funnel baseline과 NPay fire 누락을 확정한다 | GA4 purchase가 homepage 중심인지, NPay 결제완료가 어디서 빠지는지 알아야 ROAS gap을 분해할 수 있다 | GA4 BigQuery raw와 운영DB(PostgreSQL) 결제완료를 source_group/pay_method 기준으로 대조한다 | 완료 | 100% | source_group별 sessions/purchase/add_payment_info/pay_method 분포가 문서화됨 | 완료. 후속은 14/30일 안정성 검증 | NO | [[#Phase1-Sprint1]] |
| P0 | [[#Phase1-Sprint2]] | 90% scroll로 채널 품질을 비교한다 | 구매 전환이 적어도 페이지를 실제로 읽는 유입인지 먼저 볼 수 있다 | GA4 scroll event를 source_group별로 비교한다 | 완료 | 100% | paid_tiktok/paid_meta/search/direct 품질 차이가 수치로 분리됨 | 완료. 후속은 ProductEngagementSummary POC | NO | [[#Phase1-Sprint2]] |
| P0 | [[#Phase2-Sprint1]] | NPay/주문완료 흐름과 paid_click_intent 수집을 연결한다 | Google Ads 후보를 만들려면 주문완료와 클릭 ID가 같은 흐름에 남아야 한다 | paid_click_intent ledger, Path B order bridge, actual Google ad click no-send evidence, 운영DB PAYMENT_COMPLETE source를 분리해 본다 | actual ad click no-send bridge PASS. 운영DB dry-run은 4건(homepage 3/NPay 1) send_candidate 0. VM Cloud-only NPay actual 0은 primary status column 부재로 해석 | 88% | confirmed 결제완료만 후보로 남고 미입금 가상계좌는 block된다 | Codex: 운영DB primary source를 ConfirmedPurchasePrep input에 연결 | NO, Green | [[../gdn/path-b-real-paid-click-actual-order-preview-result-20260510]], [[../gdn/bi-confirmed-purchase-operational-dry-run-20260510]], [[../gdn/confirmed-purchase-prep-recalc-20260510]] |
| P1 | [[#Phase2-Sprint2]] | ConfirmedPurchasePrep input을 confirmed-only 기준으로 갱신한다 | 미입금/테스트/order-only evidence가 Google Ads upload 후보로 섞이면 안 된다 | payment status, vbank paid_at, block_reason, send_candidate=false를 dry-run에 반영한다 | builder 기본은 있음. unpaid guard 연결 필요 | 70% | upload 후보 0, raw 저장 0, block_reason 분포 산출 | Codex: builder guard + fixture/dry-run | NO, Green | [[../gdn/unpaid-vbank-controlled-evidence-exclusion-20260510]] |
| P1 | [[#Phase3-Sprint1]] | 14일/30일 funnel 비교로 7일 결과의 안정성을 확인한다 | paid_tiktok 1초/0 purchase가 단발인지 구조적 문제인지 봐야 한다 | 동일 쿼리를 14일/30일 window로 확장한다 | 대기 | 0% | 7일과 14/30일의 source_group 품질 순위가 비교됨 | Codex: BigQuery read-only 재조회 | NO | [[#Phase3-Sprint1]] |
| P2 | [[#Phase3-Sprint2]] | paid_tiktok 광고 품질을 광고비/클릭/세션 품질로 분리한다 | 낮은 engagement가 광고 소재, 랜딩, bot/click 품질 중 어디 때문인지 알아야 한다 | TikTok Ads export/API와 GA4 funnel을 campaign/adset 단위로 비교한다 | 대기 | 0% | spend/click/session/purchase/scroll90이 같은 campaign key로 비교됨 | Codex: read-only/csv 기반 분석. TJ: export 필요 시 제공 | NO 또는 export 필요 | [[#Phase3-Sprint2]] |
| P2 | [[#Phase4-Sprint1]] | ProductEngagementSummary POC로 50% scroll과 visible seconds를 보강한다 | 90% scroll만으로는 중간 관심도를 놓칠 수 있다 | 별도 engagement collector 설계 후 Yellow deploy 판단 | parked | 0% | 50% scroll/visible seconds가 상품별로 수집됨 | 추후 Yellow 승인 | YES, deploy 전 | [[../GA4/product-engagement-summary-poc-20260508]] |

## 다음 할일 — Auto Green / Approval Needed / Blocked-Parked

### Auto Green

#### A1. 운영DB PAYMENT_COMPLETE 기준을 channel/ROAS 후보 입력에 연결한다
- 무엇을 하는가: 운영DB 결제완료 주문을 primary source로 두고, VM Cloud order bridge와 paid_click_intent evidence를 보조로 붙인다.
- 왜 하는가: NPay 실제 결제완료는 VM Cloud `complete_time`/`imweb_status` blank만으로 판단하면 누락된다.
- 어떻게 하는가: [[../gdn/bi-confirmed-purchase-operational-dry-run-20260510]]의 homepage 3/NPay 1 결과를 confirmed source로 쓰고, click-only/add_payment_info-only/미입금/controlled evidence는 block reason으로 남긴다.
- 성공 기준: NPay actual confirmed는 포함되고, 미입금 가상계좌와 NPay click-only는 confirmed ROAS/upload 후보 0건이다.
- 실패 시 다음 확인점: 운영DB 결제 상태 필드, VM Cloud order bridge freshness, 가상계좌 paid_at 반영 방식.
- 승인 필요 여부: NO, Green.
- 산출물: 운영DB primary + VM Cloud bridge 통합 dry-run.
- 진척률에 미치는 영향: [[#Phase2-Sprint1]] 88% -> 94%.
- 의존성: 운영DB dry-run PASS, VM Cloud status sync 보조값 PASS.

#### A2. 14일/30일 channel funnel을 재측정한다
- 무엇을 하는가: 7일 기준 paid_tiktok/paid_google/organic/direct 품질 차이를 14일/30일로 다시 본다.
- 왜 하는가: 7일 샘플만으로 광고 품질 판단을 고정하면 단기 변동에 속을 수 있다.
- 어떻게 하는가: GA4 BigQuery raw read-only로 sessions, avg_eng_sec, scroll90, view_item, add_payment_info, purchase_homepage를 같은 source_group 기준으로 집계한다.
- 성공 기준: 7일/14일/30일 비교표가 생기고 paid_tiktok 위험이 지속/완화/반전 중 하나로 판정된다.
- 실패 시 다음 확인점: GA4 event freshness, source_group 분류, TikTok UTM 누락.
- 승인 필요 여부: NO, read-only.
- 산출물: 14/30일 funnel result 문서.
- 진척률에 미치는 영향: [[#Phase3-Sprint1]] 0% -> 60%.
- 의존성: 독립 실행 가능.

### Approval Needed

#### B1. TikTok Ads export가 필요하면 TJ님이 제공한다
- 무엇을 하는가: campaign/adset별 spend/click/conversion CSV 또는 API 접근을 제공한다.
- 왜 하는가: GA4 session quality만으로는 광고비 대비 품질을 완전히 판단할 수 없다.
- 어떻게 하는가: TikTok Ads Manager에서 2026-05-01 이후 campaign/adset/day 기준 spend/click/impression/conversion export를 받는다.
- 성공 기준: GA4 source_group과 광고비 데이터를 같은 campaign key로 비교한다.
- 실패 시 다음 확인점: UTM campaign naming, campaign id precision loss, export timezone.
- 승인 필요 여부: 필요 시 TJ님 외부 화면 작업.
- 산출물: paid_tiktok 품질 분리 문서.
- 진척률에 미치는 영향: [[#Phase3-Sprint2]] 0% -> 50%.
- 의존성: A2 결과 후 필요 여부 판단.

### Blocked/Parked

#### C1. Google Ads upload와 actual send는 계속 보류한다
- 무엇을 하는가: Google Ads/GA4/Meta/TikTok/Naver 신규 전송을 하지 않는다.
- 왜 하는가: 이 문서는 channel funnel 품질과 bridge evidence 문서이지 실제 전송 승인 문서가 아니다.
- 어떻게 하는가: `send_candidate=false`, `actual_send_candidate=false`, platform send 0을 유지한다.
- 성공 기준: 외부 전송 0건.
- 실패 시 다음 확인점: 기존 live purchase tag와 새 no-send bridge tag scope 혼동 여부.
- 승인 필요 여부: Red, 지금 HOLD.
- 산출물: 없음.
- 진척률에 미치는 영향: 운영 안전성 유지.
- 의존성: confirmed-only guard와 upload 승인 패킷 이후.

## 현재 기준

| 항목 | 값 |
|---|---|
| 정본 문서 | [[!channelfunnel]] (이 파일) |
| 분석 window | 2026-05-01 ~ 2026-05-07 (7일) |
| 1차 evidence 시각 | 2026-05-08 01:00 KST 본 sprint 직접 측정 |
| GA4 BigQuery source | hurdlers-naver-pay.analytics_304759974 (events_20260506 70,294 rows last_mod 2026-05-07 00:39 UTC) |
| job project | project-dadba7dd-0229-4ff6-81c (asia-northeast3) |
| SA | seo-656@seo-aeo-487113.iam.gserviceaccount.com |
| 분류 기준 | session_start traffic_source.{source,medium} |
| GA4 purchase event | **homepage 결제만 fire**, NPay 결제완료 0건 (의도된 GTM v138 변경) |
| 90% scroll 측정 가능 | YES (GA4 Enhanced Measurement scroll event) |
| 50% scroll 측정 가능 | NO (GA4 raw 부재, GTM trigger [11] firing tag 미연결, ProductEngagementSummary POC 별 sprint) |
| 7일 GA4 purchase total | 420건 (모두 pay_method=homepage) |
| 7일 운영 결제완료 (5/5 dry-run) | 623건 (homepage 586 + NPay 37) |
| GA4 vs 운영 결제완료 gap | NPay 37건 + GA4 fire 누락 ~166건 |
| Source group별 90% scroll 비중 | organic_naver 31.03% / paid_naver 27.62% / direct 26.41% / organic_search 25.61% / paid_google 22.83% / other 19.18% / paid_meta 9.88% / paid_tiktok 1.58% |
| paid_tiktok 위험 신호 | sessions 19,563 / avg_eng 1초 / GA4 purchase 0 / scroll90 1.58% (광고 품질 또는 bot 의심) |
| paid_google ROAS gap | sessions 5,362 / add_payment_info 770 / GA4 purchase 4 (NPay 결제완료 fire 누락이 직접 원인) |

## 7일 funnel 표 (전체)

| source_group | sessions | users | avg_eng_sec | scroll90_pct | view_item | add_to_cart | begin_checkout | add_payment_info | purchase_homepage | purchase_npay | purchase_no_pay_method |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| paid_meta | 20,122 | 16,291 | 12 | 9.88% | 6,772 | 119 | 307 | 36 | 133 | 0 | 0 |
| paid_tiktok | 19,563 | 17,223 | 1 | 1.58% | 8,824 | 57 | 16 | 65 | 0 | 0 | 0 |
| direct | 5,395 | 4,781 | 28 | 26.41% | 599 | 54 | 240 | 16 | 103 | 0 | 0 |
| paid_google | 5,362 | 2,957 | 40 | 22.83% | 1,175 | 353 | 111 | 770 | 4 | 0 | 0 |
| other | 1,559 | 918 | 79 | 19.18% | 727 | 87 | 133 | 36 | 58 | 0 | 0 |
| organic_naver | 1,505 | 1,284 | 54 | 31.03% | 298 | 31 | 76 | 14 | 41 | 0 | 0 |
| paid_naver | 1,278 | 1,011 | 99 | 27.62% | 354 | 68 | 165 | 18 | 71 | 0 | 0 |
| organic_search | 328 | 234 | 66 | 25.61% | 92 | 5 | 18 | 5 | 10 | 0 | 0 |

→ **전 source_group의 purchase_npay = 0건**. 즉 GA4 purchase event는 NPay 결제완료를 절대 추적하지 않음.

## 90% scroll만으로도 channel quality 비교 가능 (50% 추가 안 해도 유의미)

```text
organic_naver  31.03%  ████████████████████████████  (가장 깊게 봄)
paid_naver     27.62%  ████████████████████████
direct         26.41%  ███████████████████████
organic_search 25.61%  ██████████████████████
paid_google    22.83%  ████████████████████
other          19.18%  █████████████████
paid_meta       9.88%  ████████  (광고 노출 후 빠르게 이탈)
paid_tiktok     1.58%  █  (1초 engagement과 일치, 광고 품질 위험)
```

해석:
- **organic / direct / paid_naver / paid_google / organic_search 22~31% 군**: 관심 있는 사용자 (페이지 끝까지 스크롤). brand 인지 또는 검색 유입.
- **paid_meta 9.88%**: 광고 노출 후 빠른 이탈. 정상 패턴 (Meta는 lookalike + display 노출 비중 큼).
- **paid_tiktok 1.58%**: 비정상 패턴. avg_eng 1초 + purchase 0건과 함께 광고 품질 또는 bot 위험 신호.

→ **50% scroll 추가 없이도 90% scroll만으로 channel quality 격차 19배 명확**. 50% scroll 추가 가치는:
1. 90% 도달 안 한 사용자들 중 "어디까지 봤는가" 분리.
2. middle funnel attention (예: 상품 페이지 50% 도달 = scroll engaged).
3. ProductEngagementSummary POC ([[../GA4/product-engagement-summary-poc-20260508]]) 의 visible_seconds + max_scroll_percent 분석에서 같이 사용.

→ **결론**: 90% scroll로 즉시 운영 분석 가능. 50% scroll 태그 추가는 ProductEngagementSummary POC와 함께 진행하면 효율 (ad-hoc GTM 추가보다 종합 collector가 정확).

## NPay 결제완료 GA4 추적 검증 결과

### TJ 질문: NPay 결제완료를 GA4 purchase로 잡고 있는가?

**답: NO. NPay 결제완료는 모든 source_group의 GA4 purchase event에 0건 fire**.

### 근거

1. GA4 7일 purchase event 총 420건 → pay_method 분포 = `homepage` 420건 / `npay` 0건 / null 0건.
2. 운영 결제완료 5/5 dry-run = 623건 (homepage 586 + NPay 37). GA4 7일 420건과 차이 약 200건 = NPay 결제완료 + GA4 fire 누락 케이스.
3. GTM v138 (2026-04-24 publish) 에서 의도된 변경: `[43] GA4_구매전환_Npay` tag → `purchase` → `add_payment_info` 강등 ([[../GA4/gtm]] §"v138 적용한 변경").
4. 따라서 paid_google `add_payment_info 770` 중 대다수는 NPay 클릭 + 결제완료 시도 (NPay 결제완료 자체가 GA4로 잡히지 않음).

### 의미

- Google Ads `구매완료` Primary action `7130249515` 의 NPay label `r0vuCKvy-...` 분자 99.99% 를 만드는 NPay click/count 는 **자사 GA4 raw에 추적 안 됨**.
- Google Ads 측에는 NPay click 을 conversion으로 학습 → ROAS 8.72x.
- 자사 confirmed revenue (운영DB(PostgreSQL)/imweb_orders.payment_method='naver_pay' 또는 별도 NPay merchant API)는 GA4에서 분리 측정 불가 → ROAS 0.28x (VM Cloud attribution_ledger 기준).
- **Gap 8.44p의 직접 원인 1**: NPay click/count Primary 오염 (Google Ads 측 분자).
- **Gap 8.44p의 직접 원인 2**: NPay 결제완료 GA4 fire 누락 → 자사 confirmed revenue 측정 시 NPay 결제 비중을 GA4 BigQuery로 측정 불가 (운영DB(PostgreSQL) 직접 read만).

### 해결 방향

1. **NPay 결제완료 ↔ paid_click_intent canary join** (Phase2-Sprint1):
   - 2026-05-08 17:23 KST 기준 운영DB(PostgreSQL) `tb_iamweb_users`에서 canary window NPay actual 결제완료 4건 확인.
   - live `paid_click_intent_ledger` 직접 source는 checkout_start/npay_intent capture health 측정에는 사용 가능.
   - 단 PG 주문에는 `client_id`/`ga_session_id`가 없고 ledger에는 `member_code_hash`/`order_number`가 없어 order-level join은 현재 many-to-many로 HOLD.
2. **GTM 추가 검토** (별 Yellow 승인): NPay 결제완료 콜백 시점에 GA4 purchase event fire 가능한지 검토. 단 NPay 외부 결제 흐름이라 콜백 자체가 자사 페이지로 안 돌아오면 불가.
3. **운영 dashboard 분리 표시** ([[total-frontend-current-design-20260507]]): GA4 purchase = homepage only 명시, NPay 결제완료는 운영DB(PostgreSQL) 별도 컬럼.

## Approval Queue

현재 open: **없음**.

future:

| 항목 | 재개 조건 |
|---|---|
| ProductEngagementSummary 운영 deploy | POC Phase 0 검토 + 본 정본 link |
| GTM 추가 NPay purchase fire | NPay 외부 결제 흐름 콜백 검토 + 별 Red 승인 |
| TikTok 광고 정지 또는 캠페인 변경 | 광고 품질 분리 분석 결과 + TJ 사업 판단 |

## Completed Ledger

| 완료 시각 | 항목 | 결과 |
|---|---|---|
| 2026-05-08 01:00 KST | 7일 channel funnel baseline 측정 | 8 source_group 분류 + sessions/users/eng/funnel/scroll90/purchase 산출 |
| 2026-05-08 01:00 KST | NPay 결제완료 GA4 fire 누락 확정 | 모든 source_group purchase_npay = 0, pay_method 단일 'homepage' |
| 2026-05-08 01:00 KST | 90% scroll source_group 비교 | paid_tiktok 1.58% vs organic_naver 31.03% (19배 격차) |
| 2026-05-08 01:00 KST | paid_google add_payment_info 770 vs purchase 4 = NPay fire 누락 직접 원인 확정 | Google ROAS gap 8.44p 의 결제 단계 evidence |
| 2026-05-08 20:38 KST | Path B email/phone hash-only fallback 패킷 작성 | Path C source 부재를 반영해 Path B를 회원/비회원 주문 bridge 우선 후보로 승격. raw email/phone은 transient backend HMAC 처리만 허용하고 저장은 hash-only로 제한하는 승인안, schema v2, Preview/no-send smoke, 1h canary, GTM dependency map 작성. 실행은 하지 않음 |

## Source / Window / Freshness / Confidence

| 영역 | Source | Window | Freshness | Confidence |
|---|---|---|---|---|
| 7일 funnel + scroll90 + purchase pay_method | hurdlers-naver-pay.analytics_304759974.events_* | 2026-05-01~2026-05-07 | events_20260506 last_mod 2026-05-07 00:39 UTC | 0.92 |
| GTM v138 NPay tag 강등 evidence | [[../GA4/gtm]] §v138 변경 + GA4 BigQuery purchase pay_method 분포 | 2026-04-24 publish | live v142 그대로 | 0.95 |
| 운영 결제완료 (homepage + NPay) | [[../gdn/google-ads-confirmed-purchase-candidate-prep-20260507]] | 2026-05-05 dry-run | dry-run 완료 | 0.85 |
| paid_click_intent canary | [[../gdn/paid-click-intent-minimal-ledger-canary-phase0-1-2-result-20260507]] | 2026-05-07 23:01~00:00 KST | T+60min PASS | 0.90 |
| Path B hash-only bridge 설계 | [[../gdn/path-b-email-phone-hash-bridge-approval-20260508]] + [[../gdn/gtm-retous-imweb-dependency-map-20260508]] | 2026-05-08 KST | 2026-05-08 20:38 KST 문서/GTΜ read-only 생성 | 0.86 |

## Phase별 상세

### Phase1-Sprint1

**이름**: 7일 funnel baseline + NPay fire 누락 확정

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

완료한 것:

- 8 source_group 분류 + sessions/users/avg_eng/funnel/purchase 산출.
- pay_method = homepage 420건 / npay 0건 / null 0건 측정.
- paid_tiktok avg_eng 1초 + purchase 0건 신호 분리.
- paid_google add_payment_info 770 vs purchase 4 = NPay fire 누락 evidence 확보.

남은 것:

- 14일/30일 비교 별 sprint.

### Phase1-Sprint2

**이름**: 90% scroll source_group 비교

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

완료한 것:

- 8 source_group의 sessions_with_scroll90 / scroll90_pct 산출.
- 19배 격차 확인 (paid_tiktok 1.58% vs organic_naver 31.03%).
- 50% scroll 추가 가치 검토 (POC 별 sprint).

### Phase2-Sprint1

**이름**: NPay 결제완료 ↔ paid_click_intent canary join dry-run

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표: NPay 결제완료 시점 click id 보존률 측정.

2026-05-08 17:23 KST 진행 결과:
- 운영DB(PostgreSQL) `tb_iamweb_users` 기준 canary 18.4h window NPay actual confirmed 4건 확인.
- live `paid_click_intent_ledger` 직접 source는 709 rows / npay_intent 113 rows 확인.
- 현 schema 기준 deterministic 결합키 없음: ledger에는 `member_code_hash`/`order_number` 없음, PG 주문에는 `client_id`/`ga_session_id` 없음.
- 따라서 매칭률/효과 산출은 HOLD. capture health만 의미 있게 사용.

다음 조건: canary 24h+ 이후에도 deterministic bridge 없으면 effect 산출 금지. P1-1/P1-2의 `member_code_hash` bridge 또는 동등 order/session bridge가 생기면 재측정.

### Phase2-Sprint2

**이름**: ConfirmedPurchasePrep 재실행

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표: missing_google_click_id 카운트 변화 측정.

직전: 운영 결제완료 623건 중 with_gclid 5건 (0.8%).

2026-05-08 17:23 KST 진행 결과:
- 기존 5/5 정적 input dependency 문제는 해결: 운영DB(PostgreSQL) 기반 새 dry-run input 생성 완료.
- canary 18.4h window 기준 positive 52 orders / homepage 48 / NPay actual 4 / value 12,095,895 KRW / `send_candidate=0`.
- 단 direct ledger source와 주문 결합이 모두 ambiguous라 with_gclid/uplift 비교는 HOLD.

재실행 후 기대: `member_code_hash` bridge 이후 주문별 last eligible paid click이 0/1/n으로 분리되면 with_gclid 비율과 ambiguous count를 산출한다.

### Phase3-Sprint1

**이름**: 14일/30일 funnel 비교

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표: 7일 sample의 paid_tiktok 1초 패턴이 추세인지 단발인지 확인.

방법: 동일 분류 14일 / 30일 비교. 격차 변화 추적.

### Phase3-Sprint2

**이름**: paid_tiktok 광고 품질 분리 분석

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표: 1초 engagement + 0 purchase 의 원인 분리 (bot / click farm / dest URL 오류 / 추적 누락).

방법:
- TikTok Ads Manager에서 캠페인별 spend/click/CTR/conversion 추출.
- GA4 raw의 paid_tiktok sessions와 cross-check.
- TikTok pixel/Events API send 로그 ([[../tiktok/!tiktokroasplan]]) 와 비교.

### Phase4-Sprint1

**이름**: ProductEngagementSummary POC Phase 1

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표: visible_seconds + max_scroll_percent 정확 측정 시작.

설계: [[../GA4/product-engagement-summary-poc-20260508]] §6 Phase 1 (server receiver no-write 구현).

조건:
- 본 정본 + POC 설계 검토 통과.
- 운영 deploy Yellow 승인.

## 한 줄 결론

> 7일 baseline에서 NPay 결제완료 GA4 fire 누락 확정 (모든 source_group purchase_npay 0건) + 90% scroll로 channel quality 19배 격차 분리 가능. 2026-05-08 17:23 KST에 운영DB(PostgreSQL) 기반 새 input과 live ledger 직접 source는 만들었지만, 현재 결합키로는 many-to-many라 confirmed_purchase effect/uplift 정량화는 HOLD다.
