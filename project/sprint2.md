# Sprint 2. ROAS Gap Recompute

작성 시각: 2026-05-13 01:08 KST
상태: 준비 완료 / read-only recompute next
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
  lane: Green read-only ROAS recompute preparation
  allowed_actions:
    - Google Ads dashboard read-only API
    - summary API read-only API
    - local JSON/Markdown evidence
    - no-send dry-run design
  forbidden_actions:
    - platform upload/send
    - conversion action mutate
    - operational DB write
    - GTM publish
    - campaign budget change
  source_window_freshness_confidence:
    source: "VM Google Ads dashboard API + site landing summary API + gpt0508-49 post-snapshot"
    window: "Google Ads last_7d/last_30d, coffee/biocom NPay actual 30d"
    freshness: "Google Ads read-only 2026-05-13 01:02 KST, summary API post-snapshot 2026-05-13 00:57 KST"
    confidence: 0.88
```

## 10초 요약

이 스프린트의 목적은 플랫폼이 주장하는 ROAS와 내부 confirmed ROAS를 다시 분리해서 보는 것이다. Coffee actual source가 live에 붙었기 때문에, 다음 계산부터는 biocom NPay actual과 coffee NPay actual을 따로 분자에 올릴 수 있다. 단, Google Ads upload나 Primary 전환 변경은 아직 Red Lane이다.

## Phase-Sprint 요약표 — 실제 개발 순서 기준

| Priority | Phase/Sprint | 무엇을 하는가 | 왜 하는가 | 어떻게 진행하는가 | 지금 상태 | 현재 진척률 % | 100% 조건 | 다음 단계 / 담당 | 승인 필요 여부 | Source 문서 |
|---:|---|---|---|---|---|---:|---|---|---|---|
| P0 | [[#Phase2-Sprint1]] | platform claim과 internal confirmed를 같은 window에서 다시 비교한다 | 광고 플랫폼 숫자를 예산 판단값으로 쓰면 NPay click 오염이 섞인다 | Google Ads dashboard last_7d/30d와 internal summary를 나란히 저장한다 | 입력 확보 | 70% | last_7d/30d gap table이 최신 API 기준으로 재계산된다 | Codex: recompute 문서/JSON 생성 | NO, Green | [[../data/project/google-ads-dashboard-last30d-20260513.json]] |
| P0 | [[#Phase2-Sprint2]] | NPay actual correction에 coffee actual을 추가한다 | 기존 Google Ads dashboard correction은 biocom PG NPay 중심이고 coffee actual이 빠져 있었다 | biocom operational DB actual, coffee Imweb actual, bridge_pending을 source별 line item으로 분리한다 | 준비 | 55% | internal confirmed revenue current/with biocom NPay/with coffee NPay가 분리된다 | Codex: recompute script 설계 | NO, Green | [[../project/sprint1]] |
| P1 | [[#Phase2-Sprint3]] | Google Ads Option 3 필요성을 최신화한다 | internal ROAS가 올라도 platform ROAS 오염이 남으면 Primary 전환 구조를 바꿔야 한다 | gap 원인을 NPay actual 누락, NPay click 오염, click id 유실, internal join coverage로 나눈다 | 대기 | 45% | Red 승인안이 최신 수치로 갱신된다 | Codex: approval packet update 후보 | YES, Red 실행은 별도 | [[../gdn/google-ads-conversion-action-red-options-20260511]] |

## 다음 할일 — Auto Green / Approval Needed / Blocked-Parked

### Auto Green

#### A1. last_7d/last_30d gap table 만들기
- 무엇을 하는가: Google Ads platform ROAS와 internal confirmed ROAS를 같은 window로 표준화한다.
- 왜 하는가: platform ROAS는 광고 플랫폼이 주장하는 값이고, internal confirmed ROAS는 실제 결제완료 원장 기준값이다.
- 어떻게 하는가: `data/project/google-ads-dashboard-last7d-20260513.json`와 `data/project/google-ads-dashboard-last30d-20260513.json`을 읽어 platform cost/value/ROAS, internal revenue/ROAS, NPay correction을 산출한다.
- 성공 기준: last_7d와 last_30d 각각 platform ROAS, internal current ROAS, internal with NPay actual ROAS, gap이 나온다.
- 실패 시 다음 확인점: dashboard API 응답 shape, Google Ads token, internal ledger freshness.
- 승인 필요 여부: NO, read-only.
- 산출물: `data/project/roas-gap-recompute-20260513.json`, `gdn/roas-gap-recompute-after-coffee-actual-20260513.md`.
- 진척률에 미치는 영향: Phase2-Sprint1 70% -> 100%.
- 의존성: live dashboard API 200.

#### A2. coffee actual line item을 internal correction에 붙이는 설계
- 무엇을 하는가: coffee actual 309건 / 14,902,800원을 internal correction의 별도 line으로 둔다.
- 왜 하는가: biocom과 coffee의 source가 다르므로 한 숫자로 합치면 source confidence가 흐려진다.
- 어떻게 하는가: `source`, `status`, `amount`, `confidence`, `use_for_budget`, `warning` 필드를 가진 correction item 배열을 설계한다.
- 성공 기준: `biocom_npay_actual`, `coffee_npay_actual_warning`, `bridge_pending`, `legacy_complete_time`이 분리된다.
- 실패 시 다음 확인점: included_with_warning을 확정값으로 표시하는지 provisional로 표시하는지 UI 문구.
- 승인 필요 여부: NO, Green design.
- 산출물: API contract draft.
- 진척률에 미치는 영향: Phase2-Sprint2 55% -> 80%.
- 의존성: Sprint 1 PASS.

#### A3. Meta/GA4/TikTok platform reference 확장 입력 목록 만들기
- 무엇을 하는가: Google Ads 외 Meta/GA4/TikTok의 platform reference를 같은 틀로 비교할 입력을 정한다.
- 왜 하는가: 전체 목표는 Google Ads만이 아니라 모든 플랫폼과 내부 장부를 같은 말로 맞추는 것이다.
- 어떻게 하는가: platform cost/value, internal confirmed revenue, source freshness, guard warning 필드 계약을 만든다.
- 성공 기준: `/total` MVP가 쓸 공통 ROAS comparison schema가 생긴다.
- 실패 시 다음 확인점: Meta/TikTok API token 또는 export freshness.
- 승인 필요 여부: NO, Green design. API mutate/send는 금지.
- 산출물: `project/sprint2.md` 후속 섹션 또는 gdn contract.
- 진척률에 미치는 영향: Track D/F 상승.
- 의존성: 일부 독립, platform export 필요 시 TJ action.

### Approval Needed

#### B1. Google Ads Option 3 Red packet 갱신 여부
- 무엇을 하는가: 새 confirmed_purchase 전환을 만들고 기존 NPay click 성격의 `구매완료` Primary를 낮추는 실행안 갱신 여부를 결정한다.
- 왜 하는가: internal ROAS를 보정해도 Google Ads 자동입찰은 여전히 플랫폼 Primary 전환을 학습한다.
- 어떻게 하는가: A1/A2 계산 후 `google-ads-conversion-action-red-options` 문서를 최신 수치로 갱신한다.
- 성공 기준: TJ님이 YES/NO로 판단 가능한 Red 승인안.
- 실패 시 다음 확인점: no-send 후보 수, click id coverage, 중복 guard.
- 승인 필요 여부: 문서 갱신은 NO, 실제 Google Ads 변경은 YES Red.
- 산출물: approval packet.
- 진척률에 미치는 영향: Phase2-Sprint3 45% -> 75%.
- 의존성: A1/A2 결과.

### Blocked/Parked

#### C1. platform send/upload
- 무엇을 하는가: Google Ads/GA4/Meta/TikTok/Naver에 전환을 보내는 일.
- 왜 보류하는가: recompute는 read-only 판단 작업이고, 전송은 외부 숫자와 학습을 바꾸는 Red Lane이다.
- 재개 조건: no-send 후보 품질, duplicate guard, rollback, TJ Red 승인.
- 승인 필요 여부: YES, Red.

## 현재 입력값

| window | platform ROAS | platform cost | platform conv value | internal confirmed ROAS | internal confirmed revenue | with NPay actual ROAS | NPay actual correction |
|---|---:|---:|---:|---:|---:|---:|---:|
| last_7d | 10.52 | 3,621,244.55원 | 38,080,022.54원 | 0.41 | 1,470,000원 | 3.18 | 70건 / 10,041,200원 |
| last_30d | 10.27 | 22,055,517.32원 | 226,450,143.41원 | 0.29 | 6,448,110원 | 2.07 | 230건 / 39,254,600원 |

주의:
- 위 NPay actual correction은 Google Ads dashboard의 기존 biocom PG snapshot이다.
- coffee actual 309건 / 14,902,800원은 Sprint 1에서 live summary에 붙었지만, Google Ads dashboard correction에는 아직 별도 line item으로 들어가지 않았다.
- coffee actual은 `included_with_warning`이므로 예산 판단값에 넣을 때 warning label이 필요하다.

## 상세 Sprint 설명 — 각 Sprint별 무엇/왜/어떻게/% 올리려면

### Phase2-Sprint1

**이름**: Platform vs internal gap table

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 Google Ads platform ROAS와 internal confirmed ROAS를 같은 기간으로 다시 보는 것이다.

현재 확인:
- last_7d platform ROAS 10.52, internal current 0.41, with NPay actual 3.18.
- last_30d platform ROAS 10.27, internal current 0.29, with NPay actual 2.07.

현재 진척률: 70%.

### Phase2-Sprint2

**이름**: Coffee actual correction line

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 coffee actual을 dashboard correction에 섞지 않고 별도 line으로 추가하는 것이다.

필드 초안:

```json
{
  "source": "imweb_v2_vm_cloud_imweb_orders",
  "site": "thecleancoffee",
  "status": "included_with_warning",
  "count": 309,
  "amount_krw": 14902800,
  "warning": ["status_blank_rows_included_with_warning", "status_sync_stale_over_6h"],
  "use_for_budget_roas": "provisional_internal_actual"
}
```

현재 진척률: 55%.

### Phase2-Sprint3

**이름**: Option 3 decision refresh

[[#Phase-Sprint 요약표 — 실제 개발 순서 기준|▲ 요약표로]]

목표는 Google Ads 전환 구조를 바꿀지 말지 최신 수치로 판단하는 것이다.

현재 판단:
- NPay actual 합류 후 internal ROAS는 크게 올라간다.
- 그래도 platform ROAS 10.27과 internal with NPay 2.07 사이 gap은 남는다.
- 따라서 NPay actual 합류만으로는 자동입찰 학습 신호 오염을 해소하지 못한다.

현재 진척률: 45%.

## Source / Window / Freshness / Confidence

| 영역 | 값 |
|---|---|
| Google Ads dashboard | `https://att.ainativeos.net/api/google-ads/dashboard?date_preset=last_7d,last_30d` |
| Site summary | `https://att.ainativeos.net/api/attribution/site-landing/summary` |
| Window | last_7d, last_30d, NPay actual 30d |
| Freshness | 2026-05-13 01:02 KST read-only |
| Confidence | 0.88 |
