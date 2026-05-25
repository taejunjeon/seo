작성 시각: 2026-05-26 00:43 KST
기준일: 2026-05-26
문서 성격: Meta `/iiary02` D급 placeholder 16건 날짜 비교 + TJ님 제공 검토 클릭 URL 해석

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!data_inventory.md
    - docurule.md
    - project/meta-original-landing-bridge-vm-deploy-and-placeholder-diagnostic-20260526.md
  lane: Green
  allowed_actions:
    - VM Cloud SQLite read-only query
    - sanitized local report write
    - sample click-id hash comparison without raw click-id output
  forbidden_actions:
    - VM Cloud SQLite write
    - operating DB write
    - Meta ads mutation
    - platform send
    - GTM publish
    - deploy or restart
  source_window_freshness_confidence:
    source: VM Cloud SQLite read-only attribution_ledger + site_landing_ledger
    window: 2026-05-18 00:00:00 ~ 2026-05-26 00:00:00 UTC
    site: biocom
    freshness: 2026-05-26 00:29:56 KST read-only query
    confidence: high for A/D date comparison, medium for preview-click interpretation
```

## 10초 요약

D급 16건은 `UTM을 달기 전`에만 들어온 오래된 유입으로 보기 어렵다.

이유는 A급 숫자 ID row가 2026-05-18 10:46 KST부터 이미 존재했고, D급 첫 row는 같은 날 15:31 KST에 나왔기 때문이다. 이후 2026-05-21, 2026-05-22, 2026-05-24에도 A급과 D급이 같은 기간에 섞여 나타났다.

따라서 현재 결론은 `전체 UTM 세팅이 없어서 생긴 문제`가 아니라, `일부 클릭 경로에서 Meta 동적 매개변수 치환이 실패했거나, 검토/공유/게시물성 클릭처럼 실제 광고 클릭과 다른 경로가 섞인 문제`로 보는 것이 맞다.

## 핵심 숫자

Source: VM Cloud SQLite read-only

Window: 2026-05-18 00:00:00 ~ 2026-05-26 00:00:00 UTC

Target path: `/iiary02`

| 등급 | 뜻 | row | 결제 시작 | 결제완료 | 결제완료 금액 | 첫 row | 마지막 row |
|---|---|---:|---:|---:|---:|---|---|
| A급 | 숫자 campaign/adset/ad ID가 있어 매칭 가능 | 132 | 84 | 48 | ₩17,742,820 | 2026-05-18 10:46:09 KST | 2026-05-25 21:22:13 KST |
| D급 | `{{campaign.id}}` 같은 템플릿 문구가 그대로 남음 | 16 | 10 | 6 | ₩1,894,000 | 2026-05-18 15:31:15 KST | 2026-05-24 16:23:14 KST |

## 날짜별 A급과 D급 비교

| 날짜 | A급 row | A급 결제완료 | A급 금액 | D급 row | D급 결제완료 | D급 금액 | 해석 |
|---|---:|---:|---:|---:|---:|---:|---|
| 2026-05-18 | 9 | 2 | ₩680,400 | 2 | 1 | ₩459,000 | 같은 날 A급이 먼저 들어온 뒤 D급 발생 |
| 2026-05-19 | 6 | 3 | ₩914,400 | 0 | 0 | ₩0 | A급만 발생 |
| 2026-05-20 | 0 | 0 | ₩0 | 2 | 1 | ₩234,000 | D급만 보인 날 |
| 2026-05-21 | 17 | 7 | ₩2,737,800 | 6 | 2 | ₩468,000 | 같은 날 A급과 D급이 섞임 |
| 2026-05-22 | 32 | 13 | ₩4,361,400 | 4 | 1 | ₩248,000 | 같은 날 A급과 D급이 섞임 |
| 2026-05-23 | 23 | 6 | ₩2,282,400 | 0 | 0 | ₩0 | A급만 발생 |
| 2026-05-24 | 19 | 8 | ₩3,312,020 | 2 | 1 | ₩485,000 | A급이 계속 들어오던 중 D급 재발 |
| 2026-05-25 | 26 | 9 | ₩3,454,400 | 0 | 0 | ₩0 | A급만 발생 |

## D급 16건 시간대

| 시간대 | row | 결제 시작 | 결제완료 | 결제완료 금액 |
|---|---:|---:|---:|---:|
| 2026-05-18 15:00 KST | 2 | 1 | 1 | ₩459,000 |
| 2026-05-20 23:00 KST | 2 | 1 | 1 | ₩234,000 |
| 2026-05-21 07:00 KST | 4 | 3 | 1 | ₩234,000 |
| 2026-05-21 23:00 KST | 2 | 1 | 1 | ₩234,000 |
| 2026-05-22 02:00 KST | 2 | 1 | 1 | ₩248,000 |
| 2026-05-22 09:00 KST | 2 | 2 | 0 | ₩0 |
| 2026-05-24 16:00 KST | 2 | 1 | 1 | ₩485,000 |

## `/iiary02` A급 광고세트 근거

| campaign ID | adset ID | row | 결제완료 | 결제완료 금액 | 첫 row | 마지막 row | 주 해석 |
|---|---|---:|---:|---:|---|---|---|
| 120245003319500396 | 120245700952890396 | 89 | 32 | ₩10,569,200 | 2026-05-18 10:46:09 KST | 2026-05-25 21:22:13 KST | `meta_biocom_iiari_260518` 계열로 보이는 A급 주력 묶음 |
| 120245003319500396 | 120245956430970396 | 26 | 11 | ₩4,436,570 | 2026-05-22 16:11:08 KST | 2026-05-25 16:24:16 KST | `meta_biocom_iiari_260518 - 사본` 계열로 보이는 A급 묶음 |
| 120242626179290396 | 120242626179270396 | 17 | 5 | ₩2,737,050 | 2026-05-21 14:46:07 KST | 2026-05-25 18:03:42 KST | 이전에 받은 `/hangzassi01` 계열 ID와 같은 campaign/adset 묶음 |

## URL 파라미터 관찰

`/iiary02` A급 132건과 D급 16건 모두 원본 랜딩 URL에는 `utm_campaign`, `utm_term`, `utm_content` 값이 비어 있고, 대신 `meta_campaign_id`, `meta_adset_id`, `meta_ad_id`, `meta_site_source`, `meta_placement`, `campaign_alias`가 남아 있었다.

A급은 `meta_campaign_id`, `meta_adset_id`, `meta_ad_id`가 숫자로 들어왔다. D급은 같은 자리에 `{{campaign.id}}`, `{{adset.id}}`, `{{ad.id}}`, `{{site_source_name}}`, `{{placement}}`가 그대로 들어왔다.

즉 내부 원장 해석 기준은 앞으로 `utm_*`만 보면 안 된다. Meta 숫자 ID 매칭에는 `meta_*` 파라미터를 primary evidence로 함께 써야 한다.

## TJ님 제공 검토 클릭 URL 확인

TJ님이 제공한 이아리 2건, 지현 3건의 `fbclid`는 raw 값으로 출력하지 않고 hash로만 대조했다.

2026-05-26 00:29:56 KST 기준으로 이 5개 검토 클릭은 VM Cloud `site_landing_ledger`에서 일치 row가 0건이었다. 따라서 이 5개 URL은 아직 원장상 A급/D급 판단 근거로 쓰면 안 된다.

다만 별도 원장에는 `/jiihyun01` 실제 결제 흐름 2건이 이미 있었다.

- 시각: 2026-05-25 19:52:44 KST 결제 시작, 19:54:57 KST 결제완료
- campaign ID: 120245003319500396
- adset ID: 120246266837890396
- ad ID: 120246266837880396
- placement: Instagram_Stories

이 `/jiihyun01` 2건도 원본 URL의 `utm_campaign`은 비어 있었지만 `meta_campaign_id`, `meta_adset_id`, `meta_ad_id`는 숫자로 들어왔다. 즉 TJ님이 검토 화면에서 클릭한 URL이 `fbclid`만 보여도, 실제 고객 결제 흐름에서는 숫자 ID가 남을 수 있다.

## 현재 판정

`D급 16건 = UTM 달기 전 유입`은 현재 증거로는 가능성이 낮다.

더 정확한 표현은 아래와 같다.

> `/iiary02`는 2026-05-18부터 A급 숫자 ID가 정상 수집됐다. 다만 2026-05-18~2026-05-24 사이 일부 row는 같은 URL 구조에서 Meta 동적 매개변수가 숫자로 바뀌지 않고 템플릿 문구 그대로 남았다. 따라서 D급은 자동 캠페인 배정하지 않고 Meta 보조 매출 또는 수동확인 quarantine으로 유지한다.

## 하지 않은 것

- VM Cloud SQLite write: 0
- 운영DB write: 0
- Meta 광고 설정 변경: 0
- 외부 플랫폼 전환 전송: 0
- GTM publish: 0
- 배포/restart: 0

## 다음 할일

### Auto Green

1. `/ads/meta-utm` 보고서에서 `utm_*`뿐 아니라 `meta_*`가 실제 숫자 ID 근거라는 설명을 더 명확히 표시한다.
   - 이유: 대표/그로스팀이 `utm_campaign`만 보고 "UTM이 없다"고 오해하지 않게 하기 위해서다.
   - 성공 기준: 보고서에서 A급 132건의 숫자 ID 근거가 `meta_campaign_id/meta_adset_id/meta_ad_id`임을 바로 이해할 수 있다.
   - 의존성: 없음.

2. D급 16건은 계속 자동 배정 금지로 둔다.
   - 이유: 날짜 비교상 "옛날 설정" 하나로 설명되지 않고, 숫자 ID도 없다.
   - 성공 기준: ROAS 집계에서 D급 금액이 임의 광고세트에 섞이지 않는다.
   - 의존성: 없음.

### TJ님 확인 필요

1. 그로스팀에 `meta_biocom_iiari_260518`와 `meta_biocom_iiari_260518 - 사본`이 왜 동시에 머신러닝 진행 중인지 확인한다.
   - 이유: 두 묶음 모두 A급 매출이 잡히지만, 사본 운영 이유가 불명확하면 최적화/예산 해석이 꼬인다.
   - 확인 화면: Meta Ads Manager의 해당 광고세트 두 개.
   - 성공 기준: 사본의 목적이 `테스트`, `복제 실수`, `기존 세트 대체`, `파트너십 권한 이슈` 중 무엇인지 확정된다.
