# Sprint 3. Channel Funnel 14일/30일 확장

작성 시각: 2026-05-13 02:27 KST
상태: 기존 7/14/30 union evidence 활용 / TikTok campaign API export 확보 / 최신 BigQuery rerun 설계 준비
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
    window: "GA4 last_7d 2026-05-03~2026-05-09, last_14d 2026-04-26~2026-05-09, last_30d 2026-04-10~2026-05-09; TikTok export 2026-05-07~2026-05-12"
    freshness: "GA4 union generated 2026-05-10 21:17 KST; TikTok API export generated 2026-05-13 01:56 KST; next step is latest GA4 rerun"
    confidence: 0.86
```

## 10초 요약

7일 기준 paid_tiktok 위험은 단발로 보기 어렵다. 기존 GA4 BigQuery archive+daily union에서 paid_tiktok sessions는 7일 20,937건, 14일 41,352건, 30일 199,375건으로 커졌지만 engagement와 purchase quality는 낮다. TikTok Business API campaign daily export는 2026-05-07~2026-05-12 기준 5개 campaign, spend 140,850원, clicks 5,754건, platform purchase value 0원으로 확보됐고, 다음 행동은 GA4 campaign_hint와 같은 날짜/campaign key로 join하는 것이다.

## Phase-Sprint 요약표 — 실제 개발 순서 기준

| Priority | Phase/Sprint | 무엇을 하는가 | 왜 하는가 | 어떻게 진행하는가 | 지금 상태 | 현재 진척률 % | 100% 조건 | 다음 단계 / 담당 | 승인 필요 여부 | Source 문서 |
|---:|---|---|---|---|---|---:|---|---|---|---|
| P0 | [[#Phase3-Sprint1]] | 7/14/30일 funnel coverage를 확인한다 | 7일 결과가 단기 착시인지 구조인지 판단해야 한다 | GA4 BigQuery archive backfill + daily export union으로 날짜 coverage와 sessions를 비교한다 | 기존 evidence PASS, 최신 rerun 남음 | 70% | 2026-05-13 기준 최신 7/14/30 rerun도 coverage PASS | Codex: query runner 확보 후 latest rerun | NO, Green | [[../gdn/campaign-funnel-quality-union-7_14_30d-20260511]] |
| P0 | [[#Phase3-Sprint2]] | paid_tiktok 위험 verdict를 만든다 | 1초 engagement와 낮은 scroll이 계속되면 광고 품질/봇/랜딩 문제로 분해해야 한다 | sessions, scroll90, checkout, add_payment_info, GA4 purchase를 window별로 본다 | 기존 evidence상 지속 위험 유력 | 55% | 지속 위험/완화/반전/데이터 부족 중 하나로 판정 | Codex: latest rerun + verdict 문서 | NO, Green | [[../data/!channelfunnel]] |
| P1 | [[#Phase3-Sprint3]] | TikTok spend와 GA4 funnel을 campaign/day 기준으로 붙인다 | GA4 session만으로는 광고비 대비 효율을 확정할 수 없다 | TikTok API campaign/day spend/click export와 GA4 campaign_hint를 join한다 | API export 확보, join 남음 | 45% | spend/click/session/scroll90/purchase가 같은 campaign/day key에서 비교된다 | Codex: join key 설계와 dry-run | NO, Green | [[#Phase3-Sprint3]] |

## 다음 할일 — Auto Green / Approval Needed / Blocked-Parked

### Auto Green

#### A1. 최신 7/14/30 GA4 BigQuery rerun
- 무엇을 하는가: 2026-05-13 기준으로 GA4 BigQuery archive+daily union을 다시 실행한다.
- 왜 하는가: 기존 union은 2026-05-09까지라 최근 3일 traffic과 TikTok API export 기간이 겹치지 않는다.
- 어떻게 하는가: GA4 BigQuery `project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill.events_*`와 `project-dadba7dd-0229-4ff6-81c.analytics_304759974.events_*`를 union해 source_group별 sessions, scroll90, checkout, add_payment_info, purchase를 집계한다.
- 성공 기준: 7일/14일/30일 모두 coverage PASS, source_group별 sessions/scroll90/checkout/add_payment_info/purchase 표 생성.
- 실패 시 다음 확인점: BigQuery daily export 최신 suffix, archive/daily cutover rule, local `bq` CLI 또는 API query runner 권한.
- 승인 필요 여부: NO, read-only.
- 산출물: `data/project/channel-funnel-7_14_30d-20260513.json`.
- 진척률에 미치는 영향: Phase3-Sprint1 70% -> 100%.
- 의존성: BigQuery query runner. 현재 로컬에는 `bq` CLI가 없어 기존 runner/script 확인이 필요하다.

#### A2. paid_tiktok 지속 위험 verdict
- 무엇을 하는가: paid_tiktok이 7/14/30일 모두 낮은 engagement와 낮은 purchase 신호를 보이는지 판정한다.
- 왜 하는가: 단기 착시가 아니라 구조라면 광고비/소재/랜딩/봇 품질 조사가 필요하다.
- 어떻게 하는가: paid_tiktok sessions, scroll90_rate, checkout, add_payment_info, GA4 purchase, campaign_hint 상위값을 window별로 비교한다.
- 성공 기준: `지속 위험`, `완화`, `반전`, `데이터 부족` 중 하나로 결론.
- 실패 시 다음 확인점: TikTok UTM campaign 누락, paid_tiktok 분류 regex, GA4 sampling/coverage.
- 승인 필요 여부: NO, Green.
- 산출물: verdict section.
- 진척률에 미치는 영향: Phase3-Sprint2 55% -> 85%.
- 의존성: A1 또는 기존 union evidence.

#### A3. TikTok spend-quality join dry-run
- 무엇을 하는가: TikTok Business API export와 GA4 campaign_hint를 campaign/day 단위로 붙인다.
- 왜 하는가: sessions가 많아도 비용이 작거나 campaign명이 안 맞으면 예산 판단이 달라진다.
- 어떻게 하는가: 로컬 `data/ads_csv/tiktok/processed/20260507_20260512_daily_campaign.csv`의 `report_date`, `campaign_id`, `campaign_name`, `spend`, `clicks`를 GA4 campaign_hint/date와 비교한다.
- 성공 기준: 5개 TikTok campaign 중 campaign/day key로 join 가능한 행과 불가능한 행이 분리된다.
- 실패 시 다음 확인점: UTM campaign naming, campaign ID precision loss, timezone, TikTok campaign rename.
- 승인 필요 여부: NO, Green.
- 산출물: `data/project/tiktok-spend-quality-join-20260513.json`.
- 진척률에 미치는 영향: Phase3-Sprint3 45% -> 80%.
- 의존성: A1의 GA4 latest rerun과 부분 의존. 기존 2026-05-09 union으로 dry-run은 가능하다.

### Approval Needed

현재 Sprint 3 Green 분석에는 TJ님 승인이 필요 없다. TikTok Ads Manager 화면에서 새 export를 직접 내려받아야 하는 상황이 오면 TJ님 확인이 필요하지만, 현재는 로컬 TikTok Business API export가 있어 우선 Codex가 read-only join을 진행할 수 있다.

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
| last_7d | 65,993 | 5,696 | 20,937 | 28,683 | 499 | 430 | PASS |
| last_14d | 125,942 | 12,300 | 41,352 | 52,500 | 1,157 | 874 | PASS |
| last_30d | 391,430 | 29,418 | 199,375 | 122,532 | 2,000 | 3,715 | PASS |

source: GA4 BigQuery `project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill.events_*` + `project-dadba7dd-0229-4ff6-81c.analytics_304759974.events_*`, generated 2026-05-10 21:17 KST.

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
- GA4 paid_tiktok sessions가 30일 199,375건으로 매우 크다.
- TikTok API export는 최근 6일 spend/click을 확보했지만 GA4 campaign/day join은 아직 안 됐다.
- GA4 purchase와 TikTok platform purchase value는 actual purchase 정본이 아니다. 실제 예산 판단은 내부 confirmed ROAS와 연결된 뒤에만 가능하다.

## 상세 Sprint 설명 — 각 Sprint별 무엇/왜/어떻게/% 올리려면

### Phase3-Sprint1

**이름**: 7/14/30d funnel coverage

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 trend 비교 입력 자체가 믿을 수 있는지 확인하는 것이다.

현재 상태:
- 기존 union evidence는 7/14/30일 coverage PASS.
- daily-only warning은 있었지만 archive+daily union으로 해결 가능하다.
- 최신 rerun은 아직 실행 전이다. 로컬에는 `bq` CLI가 없으므로 기존 API runner나 script 확인이 필요하다.

100% 조건:
- 2026-05-13 기준 7/14/30일 union이 다시 생성된다.
- coverage PASS와 source_group metrics가 JSON/문서에 저장된다.

실행 단계:
1. [Codex] 기존 union query runner를 찾는다.
2. [Codex] BigQuery read-only rerun을 실행한다.
3. [Codex] freshness, window, confidence를 새 산출물에 기록한다.

현재 진척률: 70%.

### Phase3-Sprint2

**이름**: Paid TikTok risk verdict

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 paid_tiktok의 낮은 품질 신호가 구조인지 판정하는 것이다.

현재 상태:
- 7일 기준 paid_tiktok avg engagement 1초, scroll90 1.58%, GA4 purchase 0.
- 30일 sessions가 199,375건이라 영향 규모가 크다.
- TikTok API export도 platform purchase value 0원이다.

100% 조건:
- 최신 GA4 7/14/30 window와 TikTok spend/click을 함께 보고 `지속 위험`, `완화`, `반전`, `데이터 부족` 중 하나로 결론 낸다.
- 결론에는 예산 변경 여부가 아니라 다음 조사/승인 기준만 적는다.

실행 단계:
1. [Codex] latest rerun 또는 기존 union evidence로 paid_tiktok quality table을 갱신한다.
2. [Codex] TikTok API export spend/click과 품질 지표를 같은 날짜로 맞춘다.
3. [Codex] verdict와 confidence를 문서화한다.

현재 진척률: 55%.

### Phase3-Sprint3

**이름**: TikTok Ads spend-quality join

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 광고비와 세션 품질을 같은 campaign/adset/day 기준으로 보는 것이다.

현재 상태:
- GA4 쪽 품질 신호는 있다.
- TikTok Business API campaign/day export도 로컬에 있다.
- 아직 GA4 campaign_hint와 TikTok `campaign_id/campaign_name` join이 안 됐다.

100% 조건:
- campaign/day별 spend, clicks, GA4 sessions, scroll90, checkout, add_payment_info, purchase가 한 row에서 비교된다.
- join 실패 row는 naming mismatch, missing UTM, timezone mismatch, data unavailable 중 하나로 분류된다.
- 예산 변경은 HOLD로 남긴다.

실행 단계:
1. [Codex] TikTok API export의 campaign name/id를 normalize한다.
2. [Codex] GA4 campaign_hint와 fuzzy/exact join 후보를 만든다.
3. [Codex] join 결과를 `matched`, `name_mismatch`, `utm_missing`, `timezone_gap`으로 분류한다.

현재 진척률: 45%.

## Source / Window / Freshness / Confidence

| 영역 | 값 |
|---|---|
| GA4 source | BigQuery `project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill.events_*` + `project-dadba7dd-0229-4ff6-81c.analytics_304759974.events_*` |
| TikTok source | local `data/ads_csv/tiktok/api/tiktok_business_api_campaign_daily_20260507_20260512.json`, local processed CSV |
| Window | GA4 last_7d 2026-05-03~2026-05-09, last_14d 2026-04-26~2026-05-09, last_30d 2026-04-10~2026-05-09; TikTok 2026-05-07~2026-05-12 |
| Freshness | GA4 union generated 2026-05-10 21:17 KST; TikTok API export generated 2026-05-13 01:56 KST; latest GA4 rerun needed |
| Confidence | 0.86 |
