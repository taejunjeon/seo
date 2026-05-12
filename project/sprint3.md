# Sprint 3. Channel Funnel 14일/30일 확장

작성 시각: 2026-05-13 01:08 KST
상태: 기존 7/14/30 union evidence 활용 / 최신 재조회 설계 준비
Owner: Codex
Lane: Green BigQuery read-only
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
  lane: Green BigQuery read-only funnel expansion
  allowed_actions:
    - existing BigQuery union evidence review
    - read-only BigQuery query design
    - local JSON/Markdown output
  forbidden_actions:
    - platform send/upload
    - ad budget/campaign change
    - operational DB write
    - GTM publish
  source_window_freshness_confidence:
    source: "GA4 BigQuery archive+daily union result + data/!channelfunnel"
    window: "last_7d 2026-05-03~2026-05-09, last_14d 2026-04-26~2026-05-09, last_30d 2026-04-10~2026-05-09"
    freshness: "union generated 2026-05-10 21:17:36 KST; next step is 2026-05-13 latest rerun"
    confidence: 0.87
```

## 10초 요약

7일 기준 paid_tiktok 위험은 단발로 보기 어렵다. 기존 archive+daily union에서 paid_tiktok sessions는 7일 20,937건, 14일 41,352건, 30일 199,375건으로 커졌지만 GA4 purchase는 여전히 budget 판단 근거로 쓰기 어렵다. 다음 행동은 같은 쿼리를 2026-05-13 최신 날짜로 재실행하고, TikTok Ads export가 필요한지 결정하는 것이다.

## Phase-Sprint 요약표 — 실제 개발 순서 기준

| Priority | Phase/Sprint | 무엇을 하는가 | 왜 하는가 | 어떻게 진행하는가 | 지금 상태 | 현재 진척률 % | 100% 조건 | 다음 단계 / 담당 | 승인 필요 여부 | Source 문서 |
|---:|---|---|---|---|---|---:|---|---|---|---|
| P0 | [[#Phase3-Sprint1]] | 7/14/30일 funnel coverage를 확인한다 | 7일 결과가 단기 착시인지 구조인지 판단해야 한다 | archive backfill + daily export union으로 날짜 coverage와 sessions를 비교한다 | 기존 evidence PASS | 70% | 최신 7/14/30 rerun도 coverage PASS | Codex: 최신 rerun 또는 기존 산출 확정 | NO, Green | [[../gdn/campaign-funnel-quality-union-7_14_30d-20260511]] |
| P0 | [[#Phase3-Sprint2]] | paid_tiktok 위험 verdict를 만든다 | 1초 engagement와 낮은 scroll이 계속되면 광고 품질/봇/랜딩 문제로 분해해야 한다 | sessions, scroll90, checkout, add_payment_info, GA4 purchase를 window별로 본다 | 기존 evidence상 지속 위험 유력 | 55% | 지속 위험/완화/반전/데이터 부족 중 하나로 판정 | Codex: latest rerun + verdict 문서 | NO, Green | [[../data/!channelfunnel]] |
| P1 | [[#Phase3-Sprint3]] | TikTok Ads export 필요 여부를 결정한다 | GA4 session만으로는 광고비 대비 효율을 확정할 수 없다 | campaign/adset/day별 spend/click을 GA4 campaign_hint와 비교한다 | 조건부 필요 | 25% | export가 필요한 campaign/adset 목록이 나온다 | TJ: export 필요 시 제공 / Codex: 분석 | 필요 시 YES | [[#Phase3-Sprint3]] |

## 다음 할일 — Auto Green / Approval Needed / Blocked-Parked

### Auto Green

#### A1. 최신 7/14/30 rerun 준비
- 무엇을 하는가: 2026-05-13 기준으로 GA4 BigQuery archive+daily union을 다시 실행할 준비를 한다.
- 왜 하는가: 기존 union은 2026-05-09까지라 배포 후 최신 판단에는 3일 정도 gap이 있다.
- 어떻게 하는가: `campaign-funnel-quality-union` 산출 로직을 찾아 재실행하거나, 기존 JSON의 indicator contract로 BigQuery query를 재작성한다.
- 성공 기준: 7일/14일/30일 모두 coverage PASS, source_group별 sessions/scroll90/checkout/add_payment_info/purchase 표 생성.
- 실패 시 다음 확인점: BigQuery daily export 최신 suffix, archive/daily cutover rule, jobs.query 권한.
- 승인 필요 여부: NO, read-only.
- 산출물: `data/project/channel-funnel-7_14_30d-20260513.json`.
- 진척률에 미치는 영향: Phase3-Sprint1 70% -> 100%.
- 의존성: BigQuery read-only credentials.

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

#### A3. paid_google NPay fire 누락 재확인
- 무엇을 하는가: paid_google의 add_payment_info와 GA4 purchase 차이를 window별로 다시 본다.
- 왜 하는가: ROAS gap의 직접 원인이 NPay click/add_payment_info와 purchase fire 누락인지 최신 확인이 필요하다.
- 어떻게 하는가: paid_google NPay click sessions, add_payment_info, GA4 purchase, internal confirmed match status를 비교한다.
- 성공 기준: NPay click/add_payment_info를 purchase로 쓰면 안 된다는 guard가 유지된다.
- 실패 시 다음 확인점: GTM v138 이후 태그 변경, GA4 purchase pay_method.
- 승인 필요 여부: NO, Green.
- 산출물: Sprint 2 ROAS gap recompute의 input.
- 진척률에 미치는 영향: Track D/I 상승.
- 의존성: A1.

### Approval Needed

#### B1. TikTok Ads export
- 무엇을 하는가: TikTok Ads Manager에서 campaign/adset/day별 spend, clicks, impressions, conversion value export를 받는다.
- 왜 하는가: GA4 session 품질만으로는 광고비를 어디서 줄일지 결정할 수 없다.
- 어떻게 하는가: 2026-04-10 이후 날짜 범위로 export하고 campaign 이름/ID가 보이게 한다.
- 성공 기준: GA4 paid_tiktok campaign_hint와 spend/click이 같은 행에서 비교된다.
- 실패 시 다음 확인점: timezone, campaign name mismatch, UTM 누락.
- 승인 필요 여부: TJ님 외부 화면 작업 필요 시 YES.
- 산출물: paid_tiktok spend-quality join.
- 진척률에 미치는 영향: Phase3-Sprint3 25% -> 80%.
- 의존성: A2에서 지속 위험으로 나오면 우선순위 상승.

### Blocked/Parked

#### C1. 광고 예산 변경
- 무엇을 하는가: TikTok/Meta/Google 예산 증감.
- 왜 보류하는가: 현재 문서는 품질 진단과 evidence 준비 단계다.
- 재개 조건: GA4 quality + platform spend/click + internal confirmed ROAS가 같은 window로 연결됨.
- 승인 필요 여부: YES, 사업 판단.

## 현재 기준 숫자

| window | sessions | paid_google sessions | paid_tiktok sessions | paid_meta sessions | NPay click sessions | GA4 purchase events | coverage |
|---|---:|---:|---:|---:|---:|---:|---|
| last_7d | 65,993 | 5,696 | 20,937 | 28,683 | 499 | 430 | PASS |
| last_14d | 125,942 | 12,300 | 41,352 | 52,500 | 1,157 | 874 | PASS |
| last_30d | 391,430 | 29,418 | 199,375 | 122,532 | 2,000 | 3,715 | PASS |

해석:
- paid_tiktok sessions가 30일 199,375건으로 매우 크다.
- 7일 문서의 paid_tiktok 1초 engagement/scroll90 1.58% 신호가 구조일 가능성이 높다.
- 내부 confirmed match는 아직 `조인 필요`다. GA4 purchase만 보고 actual purchase를 확정하지 않는다.

## 상세 Sprint 설명 — 각 Sprint별 무엇/왜/어떻게/% 올리려면

### Phase3-Sprint1

**이름**: 7/14/30d funnel coverage

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 trend 비교 입력 자체가 믿을 수 있는지 확인하는 것이다.

현재 상태:
- 기존 union evidence는 7/14/30일 coverage PASS.
- daily-only warning은 있었지만 archive+daily union으로 해결 가능하다.

현재 진척률: 70%.

### Phase3-Sprint2

**이름**: Paid TikTok risk verdict

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 paid_tiktok의 낮은 품질 신호가 구조인지 판정하는 것이다.

현재 상태:
- 7일 기준 paid_tiktok avg engagement 1초, scroll90 1.58%, GA4 purchase 0.
- 30일 sessions가 199,375건이라 영향 규모가 크다.

현재 진척률: 55%.

### Phase3-Sprint3

**이름**: TikTok Ads spend-quality join

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 광고비와 세션 품질을 같은 campaign/adset/day 기준으로 보는 것이다.

현재 상태:
- GA4 쪽 품질 신호는 있다.
- TikTok Ads spend/click export가 붙어야 예산 판단으로 넘어갈 수 있다.

현재 진척률: 25%.

## Source / Window / Freshness / Confidence

| 영역 | 값 |
|---|---|
| source | `data/campaign-funnel-quality-union-7_14_30d-20260511.json`, `data/!channelfunnel.md` |
| window | last_7d 2026-05-03~2026-05-09, last_14d 2026-04-26~2026-05-09, last_30d 2026-04-10~2026-05-09 |
| freshness | union generated 2026-05-10 21:17 KST; latest rerun needed |
| confidence | 0.87 |
