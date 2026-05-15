# Sprint 2. ROAS Gap Recompute

작성 시각: 2026-05-13 22:22 KST
상태: read-only recompute 완료 / coffee correction line contract 100% / Option 3 decision refresh 완료 / 관찰용 action 생성은 API 권한 부족으로 UI 필요
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

| Priority | Phase/Sprint        | 무엇을 하는가                                                 | 왜 하는가                                                             | 어떻게 진행하는가                                                                                                                    | 지금 상태                                                 | 현재 진척률 % | 100% 조건                                                                                        | 다음 단계 / 담당                                              | 승인 필요 여부        | Source 문서                                                   |
| -------: | ------------------- | ------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------: | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------- | ----------------------------------------------------------- |
|       P0 | [[#Phase2-Sprint1]] | platform claim과 internal confirmed를 같은 window에서 다시 비교한다 | 광고 플랫폼 숫자를 예산 판단값으로 쓰면 NPay click 오염이 섞인다                         | Google Ads dashboard last_7d/30d와 internal summary를 나란히 저장한다                                                                 | 완료                                                    |     100% | last_7d/30d gap table이 최신 API 기준으로 재계산된다                                                       | 완료. Option 3 packet 갱신으로 이동                             | NO, Green       | [[../gdn/roas-gap-recompute-after-coffee-actual-20260513]]  |
|       P0 | [[#Phase2-Sprint2]] | coffee actual을 별도 correction line으로 추가한다                | biocom 보정값과 coffee actual을 한 숫자로 합치면 source/site confidence가 흐려진다 | biocom 운영DB PostgreSQL actual, coffee VM Cloud SQLite actual, bridge_pending, legacy complete_time을 source별 line item으로 분리한다 | `/total` contract/API/frontend + decision layer 반영 완료 |     100% | dashboard/API contract가 coffee actual line을 별도 노출하고 Google Ads biocom 예산 ROAS 합계에는 자동 가산하지 않는다 | 완료. 운영 deploy는 별도 승인                                    | NO, Green       | [[../data/project/total-correction-line-contract-20260513]] |
|       P1 | [[#Phase2-Sprint3]] | Google Ads Option 3 필요성을 최신화한다                          | internal ROAS가 올라도 platform ROAS 오염이 남으면 Primary 전환 구조를 바꿔야 한다    | 최신 gap, confirmed_purchase 후보 조건, no-send guard, rollback, 실제 Google Ads 승인 화면을 한 결정안으로 묶는다                              | API 생성은 권한 부족으로 blocked. UI 생성 후 post-check 필요   |     100% | TJ님이 새 전환/기존 전환/전송 금지 범위를 YES/NO로 판단할 수 있고, 승인 전 외부 전송 0건이 유지된다                                  | TJ: UI에서 Secondary action 생성 / Codex: post-check             | YES, Red UI 실행     | [[../gdn/google-ads-option3-observe-action-result-20260513]] |

## 다음 할일 — Auto Green / Approval Needed / Blocked-Parked

### Auto Green

현재 즉시 남은 Green 작업은 없다. recompute, correction line contract, Option 3 상세 계획, Red packet 동기화는 완료했고, 실제 Google Ads 변경은 Approval Needed의 Red Lane으로 남긴다.

### Approval Needed

#### B1. Google Ads Option 3 Red 실행 승인 여부
- 무엇을 승인하는가: 새 `BI confirmed_purchase` 전환 action을 Draft 또는 Secondary 관찰 상태로 준비할지, 기존 `구매완료` action `7130249515`와 NPay count label `AW-304339096/r0vuCKvy-8caEJixj5EB`를 7일 병행 관찰 후 입찰 학습 중심에서 뺄지 결정한다.
- 왜 필요한가: Google Ads 주장 ROAS와 내부 confirmed ROAS 사이 gap이 여전히 커서, 기존 Primary 구매 신호가 실제 구매가 아니라 클릭/count 성격을 학습하고 있을 가능성이 남아 있다.
- 어떻게 확인하는가: Google Ads > Goals > Conversions > Summary에서 기존 `구매완료` conversion action과 새 전환 action 후보명을 확인한다. 단, upload/send/Data Manager ingest는 이번 승인에 포함하지 않는다.
- 현재 상태: API `validateOnly` 생성 시도는 `ACTION_NOT_PERMITTED`로 blocked. Codex가 쓰는 API principal은 read-only 성격이며 UI 생성 또는 권한 보강이 필요하다.
- 성공 기준: TJ님이 UI에서 `BI confirmed_purchase`를 Secondary / observe only로 만들고 action id를 확인한다.
- 실패 시 다음 확인점: no-send 후보 수, Google click id fill-rate, duplicate guard, active campaign 구매 goal 공백 여부.
- Codex가 대신 못 하는 이유: Google Ads 전환 설정은 외부 광고 계정의 학습과 비용에 영향을 주는 Red Lane이다.
- 승인 필요 여부: YES, Red.

### Blocked/Parked

#### C1. platform send/upload
- 무엇을 하는가: Google Ads/GA4/Meta/TikTok/Naver에 전환을 보내는 일.
- 왜 보류하는가: recompute는 read-only 판단 작업이고, 전송은 외부 숫자와 학습을 바꾸는 Red Lane이다.
- 재개 조건: no-send 후보 품질, duplicate guard, rollback, TJ Red 승인, active campaign goal 공백 없음.
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

#### 무엇을 하는가

Google Ads가 구매로 학습하는 신호를 실제 결제완료 주문 중심으로 바꿀지 판단한다. Primary 전환은 Google Ads가 입찰 학습에 쓰는 핵심 구매 신호다. Secondary 전환은 입찰에는 쓰지 않고 관찰만 하는 보조 신호다. Option 3는 기존 NPay 클릭/count 성격의 구매완료 신호를 그대로 학습시키지 않고, `BI confirmed_purchase`라는 실제 결제완료 기준 전환 통로를 따로 준비하는 결정안이다.

#### 왜 필요한가

NPay actual을 내부 매출에 반영해도 Google Ads 주장 ROAS와 내부 confirmed ROAS의 차이는 크게 남아 있다. last_30d 기준 Google Ads 주장 ROAS는 10.2789이고, biocom NPay 실제 결제완료를 반영한 내부 예산 판단 ROAS는 2.0792다. 남은 gap은 8.1997p다.

이 차이는 `NPay 매출을 빼야 한다`는 뜻이 아니다. NPay 실제 결제완료 매출은 내부 매출에 포함해야 한다. 문제는 `NPay 클릭`, `NPay count`, `결제 시작`, `add_payment_info` 같은 행동 신호를 구매완료로 학습시키는 구조다. Google Ads 자동입찰이 이 신호를 Primary 전환으로 배우면 실제 구매자가 아니라 클릭/count가 잘 찍히는 유입을 좋은 유입으로 배울 수 있다.

#### 최신 판단 근거

- Google Ads 주장 ROAS: last_7d 10.5868 / last_30d 10.2789.
- 내부 current ROAS: last_7d 0.4059 / last_30d 0.2924.
- biocom NPay 실제 결제완료 보정 후 내부 예산 판단 ROAS: last_7d 3.5998 / last_30d 2.0792.
- 남은 gap: last_7d 6.9870p / last_30d 8.1997p.
- last_30d Google Ads 주장 전환값: 226,707,351.05원.
- last_30d 내부 confirmed + biocom NPay actual 매출: 45,858,910원.
- 결론: NPay actual 합류만으로는 Google Ads Primary 구매 신호 오염 가능성이 닫히지 않는다.

Source / Window / Freshness / Confidence:
- source: VM Cloud Google Ads dashboard API read-only, 운영DB PostgreSQL `dashboard.public.tb_iamweb_users`, Google Ads dashboard `npayActualCorrection` snapshot.
- window: Google Ads last_7d / last_30d, biocom NPay actual rolling 7d/30d.
- freshness: Option 3 packet 2026-05-13 18:55:11 KST, Google Ads read-only refresh 2026-05-13 18:49 KST.
- confidence: 0.90.

보조 근거:
- ConfirmedPurchasePrep last30 dry-run은 운영DB PostgreSQL 결제완료 주문 2,152건 / 502,237,676원을 읽었다.
- 이 중 홈페이지 결제완료는 2,009건이고, NPay 실제 결제완료는 143건이다.
- Google click id(`gclid`/`gbraid`/`wbraid`) 보유는 31건이고, `missing_google_click_id`는 2,121건이다.
- `send_candidate`, `actual_send_candidate`, `upload_candidate`는 모두 0이다.
- source: `data/confirmed-purchase-builder-same-window-input-20260510.json`, `gdn/confirmed-purchase-builder-same-window-input-20260510.md`.
- window: same-window last30 dry-run, 2026-05-10 기준 산출.
- confidence: 0.93.

#### Option 3가 실제로 바꾸는 것

1. 새 Google Ads 전환 action `BI confirmed_purchase`를 만든다.
   - 시작 상태는 Draft 또는 Secondary 관찰이다.
   - 실제 결제완료 주문만 후보로 받는다.
   - 홈페이지 결제완료와 NPay 실제 결제완료를 모두 포함한다.
2. 기존 `구매완료` action `7130249515`와 NPay count label `AW-304339096/r0vuCKvy-8caEJixj5EB`는 오염 의심 신호로 분리한다.
   - 즉시 삭제가 아니라 7일 병행 관찰 후 Secondary 또는 입찰 제외 후보로 둔다.
3. Google Ads upload와 Google Data Manager ingest는 별도 Red 승인 전 0건으로 유지한다.
4. NPay 클릭/결제시작/count label은 evidence로 남길 수 있지만 purchase 후보나 입찰 학습 신호로 승격하지 않는다.

#### confirmed_purchase 후보 조건

포함 조건:
- site는 `biocom`이다.
- 결제완료 주문이어야 한다.
- 홈페이지 결제완료 또는 NPay 실제 결제완료만 포함한다.
- value > 0이어야 한다.
- order id 또는 payment key가 있어야 한다.
- Google Ads upload 가능성 후보가 되려면 `gclid`/`gbraid`/`wbraid` 또는 승인된 enhanced conversion identifier가 있어야 한다.
- duplicate guard를 통과해야 한다.

차단 조건:
- NPay click only.
- NPay count.
- NPay payment start.
- add_payment_info only.
- payment status not complete.
- cancelled/refunded/returned/test/manual row.
- duplicate guard missing.
- missing Google click id.
- already sent.
- approval required.
- read-only phase.

#### no-send guard

- `send_candidate=false` 기본값 유지.
- `actual_send_candidate=0`, `upload_candidate=0` 유지.
- Google Ads conversion upload 0.
- Google Ads conversion action mutation 0.
- Google Data Manager ingest 0.
- Google Ads campaign budget change 0.
- 운영DB write 0.
- VM Cloud SQLite write 0.
- GTM publish 0.
- raw email/phone/member_code/order/payment/click_id 원문 출력 0.

#### 실패 조건

- 새 confirmed_purchase 후보의 click id fill-rate가 너무 낮아 학습/검증이 불가능하다.
- NPay confirmed 주문과 NPay click-only 로그를 구분하지 못한다.
- order id/payment key 중복 방지 기준이 없다.
- value 기준이 gross인지 net인지 문서화되지 않았다.
- 기존 `구매완료`를 Secondary로 낮췄을 때 active campaign의 구매 goal이 비어 버린다.
- Google Ads UI/API write 권한이 필요한데 TJ님 승인 문구가 없다.
- upload/send가 필요해지는 순간 별도 Red 승인이 없다.

#### rollback 기준

1. 새 `BI confirmed_purchase`를 Secondary 또는 observation 상태로 둔다.
2. upload job 또는 dispatcher가 있으면 중단한다. 이번 sprint에서는 upload/send가 0건이어야 한다.
3. 기존 `구매완료` action `7130249515` 설정을 변경 전 상태로 원복할지 판단한다.
4. 변경 전후 24시간의 Google Ads API, GA4 BigQuery raw, 내부 confirmed order를 대조한다.
5. 24h / 72h / 7d 단위로 platform value, 내부 confirmed revenue, Google Ads spend, NPay confirmed 주문을 같이 본다.

#### TJ님 승인 화면

- 내가 실제로 누를 화면: Google Ads > Goals > Conversions > Summary.
- 확인할 기존 설정: 기존 `구매완료` conversion action `7130249515`, Google tag `AW-304339096`, NPay count label `AW-304339096/r0vuCKvy-8caEJixj5EB`.
- 새 설정 후보: `BI confirmed_purchase`.
- 바꾸면 생기는 효과: Google Ads 자동입찰이 실제 결제완료 주문에 가까운 신호를 더 중요하게 학습할 준비가 된다.
- 안 바꾸면 남는 문제: Google Ads 주장 ROAS 10.2789와 내부 예산 판단 ROAS 2.0792의 gap이 계속 예산 판단을 흐릴 수 있다.
- Codex가 대신 못 하는 이유: 외부 광고 계정의 전환 설정은 운영·돈·학습 신호에 영향을 주는 Red Lane이다.

#### 완료한 것

- [x] [Codex] 최신 ROAS gap 반영.
  - 무엇: last_30d platform ROAS 10.2789, internal with biocom NPay ROAS 2.0792, gap 8.1997p를 반영했다.
  - 왜: NPay actual 보정 후에도 플랫폼 학습 신호 오염이 남는지 판단하기 위해서다.
  - 어떻게: VM Cloud Google Ads dashboard API read-only와 내부 correction line 결과를 대조했다.
  - 산출물: `gdn/google-ads-option3-red-packet-refresh-20260513.md`.
  - 검증: 외부 전송/upload 0건.
- [x] [Codex] coffee actual 분리 판단 반영.
  - 무엇: coffee actual을 Google Ads biocom 예산 ROAS에 자동 가산하지 않는 것으로 분리했다.
  - 왜: site/campaign spend mapping이 아직 분리되지 않았기 때문이다.
  - 어떻게: campaign/site mapping readiness 결과를 `reference_only`로 분류했다.
  - 산출물: `data/project/google-ads-campaign-site-mapping-readiness-20260513.json`.
  - 검증: coffee line은 budget ROAS 분자에서 제외.
- [x] [Codex] Phase2-Sprint3 상세 계획 보강.
  - 무엇: 실제 변경 대상, no-send guard, 실패 조건, rollback, TJ님 승인 화면을 이 섹션에 추가했다.
  - 왜: “Option 3 필요”만으로는 Red 승인 판단이 불가능하기 때문이다.
  - 어떻게: 기존 Option 3 승인안과 latest ROAS gap, ConfirmedPurchasePrep dry-run 근거를 합쳤다.
  - 검증: 문서 링크 검증 대상으로 둔다.

#### 남은 것

- [ ] [TJ] Red 실행 승인 여부 판단.
  - 무엇: API 권한이 막혔으므로 TJ님이 Google Ads UI에서 `BI confirmed_purchase`를 직접 Secondary / observe only로 만든다.
  - 왜: Codex API principal은 read-only 조회는 되지만 conversion action mutate 권한이 없다.
  - 어떻게: Google Ads > Goals > Conversions > Summary에서 Import from clicks / Purchase / Secondary 설정으로 만든다.
  - 성공 기준: action id가 확인되고 기존 `구매완료(7130249515)`는 Primary 유지된다.
  - 승인 필요 여부: YES, Red.
  - 의존성: Red 승인 패킷 동기화 완료.

#### 100% 조건

- Red 승인안에 최신 last_7d/last_30d ROAS gap, 실패 조건, rollback, no-send guard가 들어간다.
- TJ님이 실제 Google Ads 화면에서 무엇을 바꾸는지, 바꾸면 생기는 효과, 안 바꾸면 남는 문제를 YES/NO로 판단할 수 있다.
- 승인 전 Google Ads upload/send/conversion action mutate/campaign budget change가 0건임이 명시된다.
- 승인 후 Codex가 할 일과 승인 거절 시 유지할 일이 분리된다.

#### 진척률 기준

- 문서/판단 패킷 기준: 100%.
- 운영 실행 기준: API 생성 blocked, UI 생성 대기.
- 실제 Google Ads upload/send와 기존 구매완료 변경은 별도 승인 전 중지한다.

현재 진척률: 100%.

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
| 2026-05-13 22:24 KST | Phase2-Sprint3 상세 계획 + Red packet 동기화 | 실제 Google Ads 승인 화면, no-send guard, 실패 조건, rollback까지 문서화. 실제 Google Ads 변경/upload/send 0 |
| 2026-05-13 22:50 KST | gpt0508-51 관찰용 action 생성 시도 | Google Ads API validateOnly에서 `ACTION_NOT_PERMITTED`. action 생성 0, 기존 `구매완료(7130249515)` unchanged, upload/send 0 |

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
