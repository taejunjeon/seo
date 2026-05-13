# Sprint 3. Channel Funnel 14일/30일 확장

작성 시각: 2026-05-13 19:15 KST
상태: 최신 7/14/30 BigQuery union rerun 완료 / TikTok campaign API export와 GA4 paid_tiktok quality semantic join dry-run 완료 / campaign_id exact UTM rule 설계 완료
Owner: Codex
Lane: Green BigQuery/API read-only
Do not use for: 광고 예산 변경, platform send/upload, conversion action 변경, 운영DB write

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!channelfunnel.md
    - gdn/!gdnplan_new.md
    - data/campaign-funnel-quality-union-7_14_30d-20260511.json
  lane: Green BigQuery/API read-only funnel expansion
  allowed_actions:
    - existing BigQuery union evidence review
    - read-only BigQuery query design
    - TikTok Business API/export read-only evidence review
    - local JSON/CSV/Markdown output
  forbidden_actions:
    - platform send/upload
    - ad budget/campaign change
    - operational DB write
    - GTM publish
  source_window_freshness_confidence:
    source: "GA4 BigQuery archive+daily union result + data/!channelfunnel + local TikTok Business API export"
    window: "GA4 latest last_7d 2026-05-06~2026-05-12, last_14d 2026-04-29~2026-05-12, last_30d 2026-04-13~2026-05-12; TikTok export 2026-05-07~2026-05-12"
    freshness: "GA4 union generated 2026-05-13 18:50 KST; TikTok API export generated 2026-05-13 01:56 KST; spend-quality join generated 2026-05-13 18:55 KST"
    confidence: 0.9
```

## 10초 요약

7일 기준 paid_tiktok 위험은 단발로 보기 어렵다. 최신 GA4 BigQuery archive+daily union에서 paid_tiktok sessions는 7일 10,575건, 14일 28,806건, 30일 152,673건이며, 최근 7/14일에는 session 규모 대비 구매 신호가 매우 약하다. TikTok Business API campaign daily export는 2026-05-07~2026-05-12 기준 5개 campaign, spend 140,850원, clicks 5,754건, platform purchase value 0원으로 확보됐고, GA4 paid_tiktok과 의미상 join하면 5,581 sessions, scroll90 1.59%, 평균 engagement 0.61초, GA4 purchase 1건 / 225,300원이다.

## 2026-05-13 18:55 Green 업데이트

- GA4 BigQuery archive+daily union을 최신 window로 다시 실행했다. last_7d/14d/30d 모두 coverage PASS다.
- paid_tiktok 최근 7일은 10,575 sessions이지만 상위 campaign 대부분이 scroll90 0.43~2.52%이고, GA4 purchase는 `tiktok_biocom_yeonddle_acid` 1건만 보였다.
- TikTok API export 2026-05-07~2026-05-12와 GA4 paid_tiktok campaign_hint를 semantic join했다. spend 140,850원 / clicks 5,754건 / platform purchase 0원, GA4 paid_tiktok purchase 1건 / 225,300원이다.
- 판정은 `paid_tiktok_quality_risk_persists_with_join_gap`이다. campaign_id exact join이 없으므로 예산 변경 결론은 HOLD다.
- campaign_id exact UTM rule을 설계했다. 핵심은 `utm_campaign`은 사람이 읽는 slug로 두고, TikTok campaign id는 `utm_id`와 `tt_campaign_id`에 같이 남기는 것이다.
- 산출물: `data/project/channel-funnel-7_14_30d-latest-20260513.json`, `data/project/channel-funnel-quality-tiktok-export-window-20260513.json`, `data/project/tiktok-spend-quality-join-20260513.json`, `gdn/tiktok-campaign-id-exact-utm-rule-20260513.md`.

## Phase-Sprint 요약표 — 실제 개발 순서 기준

| Priority | Phase/Sprint | 무엇을 하는가 | 왜 하는가 | 어떻게 진행하는가 | 지금 상태 | 현재 진척률 % | 100% 조건 | 다음 단계 / 담당 | 승인 필요 여부 | Source 문서 |
|---:|---|---|---|---|---|---:|---|---|---|---|
| P0 | [[#Phase3-Sprint1]] | 7/14/30일 funnel coverage를 확인한다 | 7일 결과가 단기 착시인지 구조인지 판단해야 한다 | GA4 BigQuery archive backfill + daily export union으로 날짜 coverage와 sessions를 비교한다 | 최신 rerun PASS | 100% | 2026-05-13 기준 최신 7/14/30 rerun도 coverage PASS | 완료. verdict와 join 설계로 이동 | NO, Green | [[../gdn/channel-funnel-7_14_30d-latest-20260513]] |
| P0 | [[#Phase3-Sprint2]] | paid_tiktok 위험 verdict를 만든다 | 1초 engagement와 낮은 scroll이 계속되면 광고 품질/봇/랜딩 문제로 분해해야 한다 | sessions, scroll90, checkout, add_payment_info, GA4 purchase를 window별로 본다 | 지속 위험 판정 완료 | 85% | 지속 위험/완화/반전/데이터 부족 중 하나로 판정 | 다음: campaign_id exact 적용 승인 여부 판단 | YES, 광고 URL 변경은 Yellow/Red | [[../data/project/channel-funnel-7_14_30d-latest-20260513]] |
| P1 | [[#Phase3-Sprint3]] | TikTok spend와 GA4 funnel을 campaign/day 기준으로 붙인다 | GA4 session만으로는 광고비 대비 효율을 확정할 수 없다 | TikTok API campaign/day spend/click export와 GA4 campaign_hint를 join한다 | semantic join dry-run 완료, exact UTM rule 설계 완료 | 85% | spend/click/session/scroll90/purchase가 같은 campaign/day key에서 비교된다 | TJ: 1~3개 active campaign URL parameter 적용 승인 / Codex: 24h/72h/7d 검증 쿼리 실행 | YES, 광고 URL 변경은 Yellow/Red | [[../gdn/tiktok-campaign-id-exact-utm-rule-20260513]] |

## 다음 할일 — Auto Green / Approval Needed / Blocked-Parked

### Auto Green

#### A1. 최신 7/14/30 GA4 BigQuery rerun
- 상태: 완료.
- 무엇을 하는가: 2026-05-13 기준으로 GA4 BigQuery archive+daily union을 다시 실행한다.
- 왜 하는가: 기존 union은 2026-05-09까지라 최근 3일 traffic과 TikTok API export 기간이 겹치지 않는다.
- 어떻게 하는가: GA4 BigQuery `project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill.events_*`와 `project-dadba7dd-0229-4ff6-81c.analytics_304759974.events_*`를 union해 source_group별 sessions, scroll90, checkout, add_payment_info, purchase를 집계한다.
- 성공 기준: 7일/14일/30일 모두 coverage PASS, source_group별 sessions/scroll90/checkout/add_payment_info/purchase 표 생성.
- 실패 시 다음 확인점: BigQuery daily export 최신 suffix, archive/daily cutover rule, local `bq` CLI 또는 API query runner 권한.
- 승인 필요 여부: NO, read-only.
- 산출물: `data/project/channel-funnel-7_14_30d-latest-20260513.json`, `gdn/channel-funnel-7_14_30d-latest-20260513.md`.
- 진척률에 미치는 영향: Phase3-Sprint1 70% -> 100%.
- 의존성: 완료. 로컬 `bq` CLI는 없지만 기존 Node BigQuery runner로 read-only 실행했다.

#### A2. paid_tiktok 지속 위험 verdict
- 상태: 완료.
- 무엇을 하는가: paid_tiktok이 7/14/30일 모두 낮은 engagement와 낮은 purchase 신호를 보이는지 판정한다.
- 왜 하는가: 단기 착시가 아니라 구조라면 광고비/소재/랜딩/봇 품질 조사가 필요하다.
- 어떻게 하는가: paid_tiktok sessions, scroll90_rate, checkout, add_payment_info, GA4 purchase, campaign_hint 상위값을 window별로 비교한다.
- 성공 기준: `지속 위험`, `완화`, `반전`, `데이터 부족` 중 하나로 결론.
- 실패 시 다음 확인점: TikTok UTM campaign 누락, paid_tiktok 분류 regex, GA4 sampling/coverage.
- 승인 필요 여부: NO, Green.
- 산출물: `gdn/channel-funnel-7_14_30d-latest-20260513.md`.
- 진척률에 미치는 영향: Phase3-Sprint2 55% -> 85%.
- 의존성: A1 또는 기존 union evidence.

#### A3. TikTok spend-quality join dry-run
- 상태: 완료.
- 무엇을 하는가: TikTok Business API export와 GA4 campaign_hint를 campaign/day 단위로 붙인다.
- 왜 하는가: sessions가 많아도 비용이 작거나 campaign명이 안 맞으면 예산 판단이 달라진다.
- 어떻게 하는가: 로컬 `data/ads_csv/tiktok/processed/20260507_20260512_daily_campaign.csv`의 `report_date`, `campaign_id`, `campaign_name`, `spend`, `clicks`를 GA4 campaign_hint/date와 비교한다.
- 성공 기준: 5개 TikTok campaign 중 semantic join 가능한 행과 exact join 불가능한 행이 분리된다.
- 실패 시 다음 확인점: UTM campaign naming, campaign ID precision loss, timezone, TikTok campaign rename.
- 승인 필요 여부: NO, Green.
- 산출물: `data/project/tiktok-spend-quality-join-20260513.json`.
- 진척률에 미치는 영향: Phase3-Sprint3 45% -> 85%.
- 의존성: A1의 GA4 latest rerun과 부분 의존. 기존 2026-05-09 union으로 dry-run은 가능하다.

### Approval Needed

#### B1. TikTok campaign_id exact UTM rule 적용
- 상태: 설계 완료. 실제 광고 URL 변경은 하지 않았다.
- 무엇을 하는가: TikTok Ads Manager의 active campaign 1~3개 landing URL에 `utm_id=<campaign_id>`와 `tt_campaign_id=<campaign_id>`를 추가한다.
- 왜 하는가: 현재는 campaign name 의미상 매칭이라 campaign/day 예산 판단이 약하다. campaign id가 GA4 BigQuery까지 들어오면 TikTok API spend/click과 GA4 sessions/scroll/purchase quality를 exact로 붙일 수 있다.
- 어떻게 하는가: `utm_source=tiktok`, `utm_medium=paid_social`, `utm_campaign=<slug>`, `utm_id=<campaign_id>`, `tt_campaign_id=<campaign_id>`를 URL parameter로 추가한다.
- 성공 기준: 적용 후 7일 기준 active TikTok spend campaign의 exact campaign id coverage가 95% 이상이다.
- 실패 시 다음 확인점: TikTok URL parameter template 지원 여부, 랜딩 URL 깨짐, GA4 raw export event_params 수집 여부, `ttclid` presence 감소 여부.
- 승인 필요 여부: YES. 광고 URL 변경은 운영 광고 설정 변경이다.
- 산출물: `gdn/tiktok-campaign-id-exact-utm-rule-20260513.md`, `data/project/tiktok-campaign-id-exact-utm-rule-20260513.json`.
- 추천 점수/자신감: 80%.

현재 Sprint 3 Green 분석과 UTM rule 설계는 완료됐다. 남은 것은 TikTok Ads Manager의 실제 URL parameter 변경이므로 TJ님 승인 또는 광고 운영자 작업이 필요하다.

### Blocked/Parked

#### C1. 광고 예산 변경
- 무엇을 하는가: TikTok/Meta/Google 예산 증감.
- 왜 보류하는가: 현재 문서는 품질 진단과 evidence 준비 단계다.
- 재개 조건: GA4 quality + platform spend/click + internal confirmed ROAS가 같은 window로 연결됨.
- 승인 필요 여부: YES, 사업 판단.

## 현재 기준 숫자

### GA4 BigQuery archive+daily union

| window | sessions | paid_google sessions | paid_tiktok sessions | paid_meta sessions | NPay click sessions | GA4 purchase events | coverage |
|---|---:|---:|---:|---:|---:|---:|---|
| last_7d | 59,481 | 4,206 | 10,575 | 33,232 | 475 | 398 | PASS |
| last_14d | 116,852 | 9,767 | 28,806 | 55,720 | 1,073 | 853 | PASS |
| last_30d | 347,663 | 26,617 | 152,673 | 130,223 | 1,929 | 3,478 | PASS |

source: GA4 BigQuery `project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill.events_*` + `project-dadba7dd-0229-4ff6-81c.analytics_304759974.events_*`, generated 2026-05-13 18:50 KST.

### TikTok Business API export

| 항목 | 값 |
|---|---:|
| source | local `data/ads_csv/tiktok/processed/20260507_20260512_daily_campaign.csv` |
| window | 2026-05-07~2026-05-12 |
| rows | 29 |
| campaigns | 5 |
| spend | 140,850원 |
| impressions | 80,752 |
| clicks | 5,754 |
| platform purchase count | 0 |
| platform purchase value | 0원 |

해석:
- GA4 paid_tiktok sessions가 30일 152,673건으로 여전히 크다.
- TikTok API export는 최근 6일 spend/click을 확보했고 GA4 campaign_hint와 의미상 join했다. 다만 campaign_id exact가 없어 campaign/day 정밀 join은 아직 안 됐다.
- GA4 purchase와 TikTok platform purchase value는 actual purchase 정본이 아니다. 실제 예산 판단은 내부 confirmed ROAS와 연결된 뒤에만 가능하다.

## 상세 Sprint 설명 — 각 Sprint별 무엇/왜/어떻게/% 올리려면

### Phase3-Sprint1

**이름**: 7/14/30d funnel coverage

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 trend 비교 입력 자체가 믿을 수 있는지 확인하는 것이다.

현재 상태:
- 최신 union evidence는 7/14/30일 coverage PASS.
- daily-only warning은 있었지만 archive+daily union으로 해결 가능하다.
- 로컬에는 `bq` CLI가 없지만 `backend/scripts/bigquery-archive-daily-union-dry-run.ts` Node runner로 read-only rerun을 완료했다.

100% 조건:
- 2026-05-13 기준 7/14/30일 union이 다시 생성된다.
- coverage PASS와 source_group metrics가 JSON/문서에 저장된다.

실행 단계:
1. [Codex] 기존 union query runner를 찾는다.
2. [Codex] BigQuery read-only rerun을 실행한다.
3. [Codex] freshness, window, confidence를 새 산출물에 기록한다.

현재 진척률: 100%.

### Phase3-Sprint2

**이름**: Paid TikTok risk verdict

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 paid_tiktok의 낮은 품질 신호가 구조인지 판정하는 것이다.

현재 상태:
- 2026-05-07~2026-05-12 기준 GA4 paid_tiktok avg engagement 0.61초, scroll90 1.59%, GA4 purchase 1건 / 225,300원이다.
- 최신 30일 paid_tiktok sessions가 152,673건이라 영향 규모가 크다.
- TikTok API export도 platform purchase value 0원이다.

100% 조건:
- 최신 GA4 7/14/30 window와 TikTok spend/click을 함께 보고 `지속 위험`, `완화`, `반전`, `데이터 부족` 중 하나로 결론 낸다.
- 결론에는 예산 변경 여부가 아니라 다음 조사/승인 기준만 적는다.

실행 단계:
1. [Codex] latest rerun 또는 기존 union evidence로 paid_tiktok quality table을 갱신한다.
2. [Codex] TikTok API export spend/click과 품질 지표를 같은 날짜로 맞춘다.
3. [Codex] verdict와 confidence를 문서화한다.

현재 진척률: 85%.

### Phase3-Sprint3

**이름**: TikTok Ads spend-quality join

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 광고비와 세션 품질을 같은 campaign/adset/day 기준으로 보는 것이다.

현재 상태:
- GA4 쪽 품질 신호는 있다.
- TikTok Business API campaign/day export도 로컬에 있다.
- GA4 campaign_hint와 TikTok `campaign_name` semantic join은 됐다.
- 아직 GA4에 TikTok `campaign_id` exact가 없어 campaign/day exact join은 미완성이다.
- 이를 해결하기 위한 UTM rule은 작성 완료했다. 실제 적용은 TikTok Ads Manager URL 변경 승인 후 진행한다.

100% 조건:
- campaign/day별 spend, clicks, GA4 sessions, scroll90, checkout, add_payment_info, purchase가 한 row에서 비교된다.
- join 실패 row는 naming mismatch, missing UTM, timezone mismatch, data unavailable 중 하나로 분류된다.
- 예산 변경은 HOLD로 남긴다.

실행 단계:
1. [Codex] TikTok API export의 campaign name/id를 normalize한다.
2. [Codex] GA4 campaign_hint와 fuzzy/exact join 후보를 만든다.
3. [Codex] join 결과를 `matched`, `name_mismatch`, `utm_missing`, `timezone_gap`으로 분류한다.

현재 진척률: 85%.

## Source / Window / Freshness / Confidence

| 영역 | 값 |
|---|---|
| GA4 source | BigQuery `project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill.events_*` + `project-dadba7dd-0229-4ff6-81c.analytics_304759974.events_*` |
| TikTok source | local `data/ads_csv/tiktok/api/tiktok_business_api_campaign_daily_20260507_20260512.json`, local processed CSV |
| Window | GA4 last_7d 2026-05-06~2026-05-12, last_14d 2026-04-29~2026-05-12, last_30d 2026-04-13~2026-05-12; TikTok 2026-05-07~2026-05-12 |
| Freshness | GA4 union generated 2026-05-13 18:50 KST; TikTok API export generated 2026-05-13 01:56 KST; spend-quality join generated 2026-05-13 18:55 KST |
| Confidence | 0.9 |
