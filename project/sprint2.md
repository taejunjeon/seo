# Sprint 2. ROAS Gap Recompute

작성 시각: 2026-05-13 19:06 KST
상태: read-only recompute 완료 / coffee correction line contract 100% / Option 3 packet 최신 숫자 갱신 완료 / campaign-site spend mapping gap 분류 완료
Owner: Codex
Lane: Green read-only, Red send/upload 금지
Do not use for: Google Ads conversion upload, Google Ads conversion action 변경, 광고 예산 자동 변경, GA4/Meta/TikTok/Naver 실제 전송

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - gdn/!gdnplan_new.md
    - total/!total-current.md
    - data/!coffeedata.md
    - project/sprint1.md
  lane: Green read-only ROAS recompute completed
  allowed_actions:
    - Google Ads dashboard read-only API
    - VM Cloud SQLite read-only aggregate
    - site summary API read-only API
    - local JSON/Markdown evidence
    - no-send dry-run design
  forbidden_actions:
    - platform upload/send
    - conversion action mutate
    - operational DB write
    - GTM publish
    - campaign budget change
  source_window_freshness_confidence:
    source: "VM Cloud Google Ads dashboard API + VM Cloud SQLite /home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3 imweb_orders + site landing summary API"
    window: "Google Ads last_7d/last_30d, coffee Imweb NPay actual 7d/30d, biocom NPay actual dashboard correction"
    freshness: "Google Ads read-only 2026-05-13 18:49 KST, coffee VM Cloud dedicated monitor refreshed 2026-05-13 18:48 KST for /total correction line"
    confidence: 0.9
```

## 10초 요약

이 스프린트의 목적은 플랫폼이 주장하는 ROAS와 내부 confirmed ROAS를 다시 분리해서 보는 것이다. Read-only 재계산은 완료됐고, Google Ads 예산 판단값은 `biocom NPay 보정 후 내부 ROAS`로 둔다. Coffee actual은 source/site가 다르므로 dashboard correction 합계에 조용히 섞지 않고 별도 line으로 보여준다.

## 2026-05-13 18:55 Green 업데이트

- Google Ads dashboard API를 read-only로 다시 읽었다. last_30d 기준 Google Ads 주장 ROAS는 10.2789, 내부 current ROAS는 0.2924, biocom NPay actual 반영 내부 예산 판단 ROAS는 2.0792다.
- NPay actual을 넣어도 last_30d 남은 gap은 8.1997p라서 `Option 3` Red 승인안은 계속 유효하다. 단, 실제 Google Ads 전환 action 변경/upload/send는 0건이다.
- campaign/site spend mapping을 점검했다. 현재 Google Ads last_30d campaign list에는 `thecleancoffee` 전용 spend marker가 없어 coffee actual 315건 / 15,477,100원은 `reference_only`로 유지한다.
- 산출물: `data/project/google-ads-option3-red-packet-refresh-20260513.json`, `gdn/google-ads-option3-red-packet-refresh-20260513.md`, `data/project/google-ads-campaign-site-mapping-readiness-20260513.json`.

## Phase-Sprint 요약표 — 실제 개발 순서 기준

| Priority | Phase/Sprint | 무엇을 하는가 | 왜 하는가 | 어떻게 진행하는가 | 지금 상태 | 현재 진척률 % | 100% 조건 | 다음 단계 / 담당 | 승인 필요 여부 | Source 문서 |
|---:|---|---|---|---|---|---:|---|---|---|---|
| P0 | [[#Phase2-Sprint1]] | platform claim과 internal confirmed를 같은 window에서 다시 비교한다 | 광고 플랫폼 숫자를 예산 판단값으로 쓰면 NPay click 오염이 섞인다 | Google Ads dashboard last_7d/30d와 internal summary를 나란히 저장한다 | 완료 | 100% | last_7d/30d gap table이 최신 API 기준으로 재계산된다 | 완료. Option 3 packet 갱신으로 이동 | NO, Green | [[../gdn/roas-gap-recompute-after-coffee-actual-20260513]] |
| P0 | [[#Phase2-Sprint2]] | coffee actual을 별도 correction line으로 추가한다 | biocom 보정값과 coffee actual을 한 숫자로 합치면 source/site confidence가 흐려진다 | biocom 운영DB PostgreSQL actual, coffee VM Cloud SQLite actual, bridge_pending, legacy complete_time을 source별 line item으로 분리한다 | `/total` contract/API/frontend + decision layer 반영 완료 | 100% | dashboard/API contract가 coffee actual line을 별도 노출하고 Google Ads biocom 예산 ROAS 합계에는 자동 가산하지 않는다 | 완료. 운영 deploy는 별도 승인 | NO, Green | [[../data/project/total-correction-line-contract-20260513]] |
| P1 | [[#Phase2-Sprint3]] | Google Ads Option 3 필요성을 최신화한다 | internal ROAS가 올라도 platform ROAS 오염이 남으면 Primary 전환 구조를 바꿔야 한다 | gap 원인을 NPay actual 누락, NPay click 오염, click id 유실, internal join coverage로 나눈다 | 최신 packet 갱신 완료, 실행은 Red HOLD | 75% | Red 승인안이 최신 수치와 실패 조건으로 갱신된다 | TJ: 실제 Google Ads 변경 승인 여부 판단 / Codex: no-send guard 보강 | YES, Red 실행은 별도 | [[../gdn/google-ads-option3-red-packet-refresh-20260513]] |

## 다음 할일 — Auto Green / Approval Needed / Blocked-Parked

### Auto Green

#### A1. `/total` 공통 correction line contract
- 상태: 완료.
- 무엇을 했는가: `GET /api/total/monthly-channel-summary` 응답에 top-level `correction_lines`를 추가했다. 로컬 `/total` 프론트에도 보정 라인 섹션을 추가했다.
- 왜 하는가: site/source가 다른 매출을 한 ROAS 분자에 섞으면 예산 판단이 왜곡된다.
- 어떻게 했는가: `source`, `db_location`, `site`, `status`, `count`, `amount_krw`, `status_blank_count`, `warning`, `use_for_budget_roas`, `included_in_budget_roas`, `confidence`, `freshness` 필드를 backend contract와 frontend table로 고정했다.
- 성공 기준: biocom 운영DB PostgreSQL `dashboard.public.tb_iamweb_users` NPay actual과 coffee VM Cloud SQLite `imweb_orders` actual이 별도 line으로 보인다. coffee line은 `included_in_budget_roas=false`이며 `provisional_internal_actual_reference_only_until_campaign_site_mapping`이다.
- 산출물: `data/project/total-correction-line-contract-20260513.json`, `total/total-api-contract-20260504.md`, backend/frontend patch.
- 진척률에 미치는 영향: Phase2-Sprint2 85% -> 100%.
- 의존성: Sprint 1 live summary PASS.

#### A2. Google Ads Option 3 Red packet 숫자 갱신
- 상태: 완료.
- 무엇을 하는가: Google Ads Primary 전환 구조 변경안의 예상 효과를 최신 gap 수치로 갱신한다.
- 왜 하는가: NPay actual 보정 후에도 Google Ads 플랫폼 ROAS 10.2789와 내부 예산 판단 ROAS 2.0792 사이 gap이 8.1997p 남는다.
- 어떻게 하는가: `gdn/google-ads-option3-red-packet-refresh-20260513.md`에 최신 last_7d/last_30d gap과 금지선을 따로 남겼다.
- 성공 기준: TJ님이 YES/NO로 판단 가능한 Red 승인안이 된다.
- 실패 시 다음 확인점: no-send 후보 수, click id coverage, duplicate guard.
- 승인 필요 여부: 문서 갱신은 NO, 실제 Google Ads 변경은 YES Red.
- 산출물: `data/project/google-ads-option3-red-packet-refresh-20260513.json`, `gdn/google-ads-option3-red-packet-refresh-20260513.md`.
- 진척률에 미치는 영향: Phase2-Sprint3 60% -> 75%.
- 의존성: Phase2-Sprint1 완료.

#### A3. campaign/site spend mapping gap 줄이기
- 상태: 완료.
- 무엇을 하는가: coffee overlay를 Google Ads 예산 판단값으로 쓸 수 있는지 campaign/site spend mapping을 확인한다.
- 왜 하는가: coffee actual은 내부 매출로는 의미가 있지만, biocom Google Ads cost와 같은 분모에 바로 얹으면 안 된다.
- 어떻게 하는가: landing/site/campaign 기준으로 `biocom`과 `thecleancoffee` spend가 분리되는지 read-only API와 기존 ledger를 대조한다.
- 성공 기준: `cross_site_reference_only`인지 `site_specific_budget_roas`인지 분류된다.
- 실패 시 다음 확인점: campaign naming, UTM site marker, landing URL site attribution.
- 승인 필요 여부: NO, Green.
- 산출물: `data/project/google-ads-campaign-site-mapping-readiness-20260513.json`, `gdn/google-ads-campaign-site-mapping-readiness-20260513.md`.
- 진척률에 미치는 영향: Track D/F 상승.
- 의존성: 일부 독립.

### Approval Needed

현재 recompute와 contract 갱신에는 TJ님 승인이 필요 없다. 실제 Google Ads conversion action 변경, upload/send, campaign budget 변경은 Red Lane으로 별도 명시 승인 전 금지다.

### Blocked/Parked

#### C1. platform send/upload
- 무엇을 하는가: Google Ads/GA4/Meta/TikTok/Naver에 전환을 보내는 일.
- 왜 보류하는가: recompute는 read-only 판단 작업이고, 전송은 외부 숫자와 학습을 바꾸는 Red Lane이다.
- 재개 조건: no-send 후보 품질, duplicate guard, rollback, TJ Red 승인.
- 승인 필요 여부: YES, Red.

## 현재 입력값

| window | platform ROAS | platform cost | platform conv value | internal confirmed ROAS | internal confirmed revenue | with biocom NPay actual ROAS | biocom NPay actual correction |
|---|---:|---:|---:|---:|---:|---:|---:|
| last_7d | 10.5868 | 3,621,237.88원 | 38,337,230.18원 | 0.4059 | 1,470,000원 | 3.5998 | 77건 / 11,565,900원 |
| last_30d | 10.2789 | 22,055,510.65원 | 226,707,351.05원 | 0.2924 | 6,448,110원 | 2.0792 | 232건 / 39,410,800원 |

## 재계산 결과

| window | 예산 판단 ROAS | Google Ads 주장 ROAS | 남은 ROAS gap | coffee 참고 overlay ROAS | 해석 |
|---|---:|---:|---:|---:|---|
| last_7d | 3.5998 | 10.5868 | 6.9870p | 참고 전용 | biocom NPay actual을 넣어도 gap이 크다 |
| last_30d | 2.0792 | 10.2789 | 8.1997p | 참고 전용 | 30일 기준도 Primary 전환 구조 문제가 남는다 |

Coffee actual은 2026-05-13 18:48 KST dedicated monitor 기준 last_30d 315건 / 15,477,100원이다. source는 VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3`의 `imweb_orders(site='thecleancoffee', pay_type='npay')`다. status blank는 32건 / 1,983,600원이며, 원인은 `imweb_orders.imweb_status` status sync lag로 분류했다. 현재 Google Ads campaign/site spend mapping에는 coffee 전용 spend marker가 없어 coffee actual은 예산 ROAS 분자에 자동 가산하지 않는다.

주의:
- 위 NPay actual correction은 Google Ads dashboard의 기존 biocom PG snapshot이다.
- coffee actual은 Sprint 1에서 live summary에 붙었지만, Google Ads biocom 예산 판단 ROAS에는 아직 넣지 않는다.
- coffee actual은 `included_with_warning`이므로 화면과 문서에 warning label이 필요하다.

## 상세 Sprint 설명 — 각 Sprint별 무엇/왜/어떻게/% 올리려면

### Phase2-Sprint1

**이름**: Platform vs internal gap table

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 Google Ads platform ROAS와 internal confirmed ROAS를 같은 기간으로 다시 보는 것이다.

완료한 것:
- last_7d platform ROAS 10.5868, internal current 0.4059, biocom NPay 보정 후 3.5998.
- last_30d platform ROAS 10.2789, internal current 0.2924, biocom NPay 보정 후 2.0792.
- 외부 전송/upload 0, 운영DB write 0.

100% 조건:
- latest API 기준 last_7d/last_30d platform claim과 internal confirmed가 같은 문서에 분리되어 있다.
- 예산 판단값과 참고값이 구분되어 있다.

현재 진척률: 100%.

### Phase2-Sprint2

**이름**: Coffee actual correction line

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 coffee actual을 dashboard correction에 섞지 않고 별도 line으로 추가하는 것이다.

무엇을 하는가:
- Google Ads dashboard의 biocom NPay 보정값과 더클린커피 NPay actual을 같은 correction 합계로 더하지 않는다.
- 대신 source line item으로 보여준다.
- 운영자는 “예산 판단에 쓸 값”과 “내부 매출 참고값”을 구분해서 본다.

왜 필요한가:
- biocom NPay actual은 운영DB PostgreSQL `dashboard.public.tb_iamweb_users` `PAYMENT_COMPLETE` 기준이다.
- coffee actual은 VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3` `imweb_orders` 기준이다.
- 두 source를 한 숫자로 합치면 source confidence와 site attribution이 흐려진다.

현재 field contract 후보:

```json
{
  "source": "imweb_v2_vm_cloud_imweb_orders",
  "db_location": "VM Cloud SQLite /home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3",
  "table": "imweb_orders",
  "site": "thecleancoffee",
  "status": "included_with_warning",
  "count": 315,
  "amount_krw": 15477100,
  "status_blank_count": 32,
  "status_blank_amount_krw": 1983600,
  "warning": ["status_blank_rows_included_with_warning", "status_sync_stale_over_6h"],
  "included_in_budget_roas": false,
  "use_for_budget_roas": "provisional_internal_actual_reference_only_until_campaign_site_mapping"
}
```

100% 조건:
- `/ads/site-landing` 화면과 API contract가 coffee actual을 별도 line으로 노출한다.
- `/total` 또는 공통 dashboard contract에도 같은 line item이 들어가고, 화면 첫 영역은 판단 카드로 시작한다.
- Google Ads biocom 예산 판단 ROAS에는 coffee가 자동 가산되지 않는다.
- status blank root cause와 DB 위치가 문서에 같이 남는다.

실행 단계:
1. [완료] `/total` source line item contract를 문서화하고 backend/frontend에 반영한다.
2. [완료] coffee line은 `provisional_internal_actual`의 의미를 살리되 예산 ROAS 자동 합산을 막기 위해 `provisional_internal_actual_reference_only_until_campaign_site_mapping`으로 고정한다.
3. [완료] `/total` 화면 상단에 예산 판단 가능 매출, 참고용 보정 매출, 미분류/보류 매출, 데이터 연결 경고 카드를 추가하고 source diagnostics는 기본 접힘으로 낮춘다.
3. [완료] fixture/test로 coffee line이 `included_in_budget_roas=false`인지 확인한다.

현재 진척률: 100%.

### Phase2-Sprint3

**이름**: Option 3 decision refresh

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 Google Ads 전환 구조를 바꿀지 말지 최신 수치로 판단하는 것이다.

현재 판단:
- NPay actual 합류 후 internal ROAS는 크게 올라간다.
- 그래도 platform ROAS 10.2789와 internal with biocom NPay 2.0792 사이 gap은 8.1997p 남는다.
- 따라서 NPay actual 합류만으로는 자동입찰 학습 신호 오염을 해소하지 못한다.

100% 조건:
- Red 승인안에 최신 ROAS gap, 실패 조건, rollback, no-send guard가 들어간다.
- TJ님이 실제 Google Ads 화면에서 무엇을 바꾸는지 이해할 수 있다.

실행 단계:
1. [Codex] 최신 ROAS gap을 Red approval packet에 반영한다.
2. [Codex] 변경 화면, 설정 이름, 효과, 안 바꾸면 남는 문제를 쉬운 말로 정리한다.
3. [TJ] 실제 Google Ads 전환 설정 변경 여부를 승인한다.

현재 진척률: 75%.

## Completed Ledger

| 완료 시각 | 항목 | 결과 |
|---|---|---|
| 2026-05-13 01:34 KST | Google Ads dashboard last_7d/30d read-only 저장 | PASS |
| 2026-05-13 01:41 KST | ROAS recompute v1 | coffee 309건 overlay |
| 2026-05-13 02:02 KST | coffee VM Cloud SQLite refresh | coffee 311건, status blank 16건 |
| 2026-05-13 02:18 KST | ROAS recompute 최신화 | coffee overlay last_7d 4.85, last_30d 2.75 |
| 2026-05-13 12:56 KST | coffee dedicated monitor + `/total` correction line refresh | coffee 317건 / 15,547,500원, blank 28건을 별도 reference line으로 고정 |
| 2026-05-13 12:59 KST | `/total` decision layer smoke | local 7010 화면 + backend 7020 API 200, 진단 details 4개 기본 접힘 |
| 2026-05-13 18:49 KST | Google Ads dashboard API latest refresh | last_30d platform ROAS 10.2789, internal with biocom NPay 2.0792, gap 8.1997p |
| 2026-05-13 18:55 KST | Option 3 packet + campaign/site mapping 갱신 | coffee는 Google Ads budget ROAS가 아니라 reference_only 유지 |

## Source / Window / Freshness / Confidence

| 영역 | 값 |
|---|---|
| Google Ads dashboard | VM Cloud API `https://att.ainativeos.net/api/google-ads/dashboard?date_preset=last_7d,last_30d` |
| biocom actual source | 운영DB PostgreSQL `dashboard.public.tb_iamweb_users`, Google Ads dashboard `npayActualCorrection` snapshot |
| coffee actual source | VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3` `imweb_orders(site='thecleancoffee', pay_type='npay')` |
| Site summary | VM Cloud API `https://att.ainativeos.net/api/attribution/site-landing/summary` |
| Window | last_7d, last_30d, NPay actual 30d |
| Freshness | ROAS recompute 2026-05-13 18:55 KST; `/total` correction line latest 2026-05-13 18:48 KST; coffee status sync 2026-05-12 04:11:07 |
| Confidence | 0.9 |
