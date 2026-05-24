# reportcoffee Google Ads spend mapping 20260523

작성 시각: 2026-05-23 17:26 KST
기준일: 2026-05-23
문서 성격: 더클린커피 Google Ads 광고비 mapping read-only 결과
담당: Codex
상위 문서: [[reportcoffee]], [[report-ad-spend-source-gap-plan-20260523]]
후속 문서: [[reportcoffee-google-click-id-campaign-id-linkage-20260523]]
JSON 산출물: `report/reportcoffee-google-ads-spend-mapping-20260523.json`

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - report/reportcoffee.md
    - report/report-ad-spend-source-gap-plan-20260523.md
  lane: Green
  allowed_actions:
    - vm_cloud_google_ads_read_only_api
    - local_json_markdown_output
    - no_send_slack_preview_update
  forbidden_actions:
    - slack_send
    - operating_db_write
    - vm_cloud_write_or_deploy
    - platform_send_or_upload
    - google_ads_upload
    - gtm_publish
    - raw_identifier_output
  source_window_freshness_confidence:
    source: VM Cloud Google Ads status/dashboard/final-url-audit read-only APIs
    window: Google Ads last_7d, Google Ads last_30d, VM Cloud landing last_7d
    freshness: Google Ads final-url-audit fetchedAt 2026-05-23T08:25:05.713Z, checked 2026-05-23 17:26 KST
    confidence: high for current Google Ads spend 0 candidate, medium for legacy click route interpretation
```

## 10초 요약

더클린커피 Google 광고비는 현재 Slack 보고에 `0원 확인 후보`로 넣는 것이 맞다.

Google Ads dashboard(구글 광고 계정의 캠페인별 광고비 조회 기능)에서 최근 7일과 30일 모두 더클린커피 이름의 spend row가 0개였다. 반대로 바이오컴 캠페인은 광고비가 잡힌다. 즉 Google Ads API 자체가 막힌 것이 아니라, 현재 비용이 잡히는 캠페인이 바이오컴 쪽이다.

다만 VM Cloud 방문 원장에는 최근 7일 더클린커피 Google 클릭 ID 3건이 남아 있다. 그래서 결론은 “Google 광고비는 0원 후보, Google 유입 증거는 소량 존재, 과거/일시중지 캠페인 매핑은 보류”다.

후속 조사에서 이 3건의 campaign_id 연결 가능성을 확인했다. 현재 공개 read-only API는 원문 클릭 ID나 행별 `gad_campaignid`를 반환하지 않으므로 exact 연결은 미확정이다. 상세는 [[reportcoffee-google-click-id-campaign-id-linkage-20260523]]에 둔다.

## 이번에 확인한 것

### 1. Google Ads API 상태

- endpoint: `/api/google-ads/status`.
- 결과: `ok=true`.
- customerId: `2149990943`.
- apiVersion: `v22`.

의미:

Google Ads 조회 자체는 된다. 막힌 것은 API 연결이 아니라 더클린커피에 해당하는 현재 광고비 row가 없다는 점이다.

### 2. 최근 7일 광고비

- endpoint: `/api/google-ads/dashboard?date_preset=last_7d&campaign_limit=200`.
- account total cost: 3,911,182.88원.
- campaign metric rows: 4개.
- 더클린커피 이름 또는 coffee 키워드 캠페인 rows: 0개.
- 더클린커피 캠페인 광고비: 0원.
- 반환된 캠페인: 모두 바이오컴 이름 계열.

판정:

더클린커피 Slack 주간 보고에서 Google 광고비는 `0원 확인 후보`다.

### 3. 최근 30일 광고비

- endpoint: `/api/google-ads/dashboard?date_preset=last_30d&campaign_limit=200`.
- account total cost: 19,620,103.09원.
- campaign metric rows: 6개.
- 더클린커피 이름 또는 coffee 키워드 캠페인 rows: 0개.
- 더클린커피 캠페인 광고비: 0원.
- 반환된 캠페인: 모두 바이오컴 이름 계열.

판정:

더클린커피 rolling 30d 보고에서도 Google 광고비는 `0원 확인 후보`다.

## 왜 0원인데 pending이 아닌가

0원이라고 단정하려면 “광고 계정 전체가 0원”이 아니라 “더클린커피로 볼 수 있는 캠페인의 광고비가 0원”이어야 한다.

이번 조회에서는 아래 조건을 만족했다.

1. Google Ads dashboard는 정상 응답했다.
2. 최근 7일과 30일에 비용이 있는 캠페인은 바이오컴 이름 계열이었다.
3. 더클린커피 이름 캠페인은 비용 row로 반환되지 않았다.
4. 최종 URL audit에서 더클린커피 현재 도메인 row는 1개지만 현재 활성 광고 row는 0개였다.

따라서 Slack 표현은 `Google: 0원 확인 후보`가 맞다. 단, 아래 경고를 붙여야 한다.

> 최근 7일 방문 원장에 Google 클릭 ID 3건이 있어 Google 유입 증거는 남아 있습니다. 다만 현재 Google Ads spend row에는 더클린커피 캠페인 비용이 없습니다.

## 유입 증거와 광고비를 분리해야 하는 이유

방문 원장에는 최근 7일 더클린커피 Google 클릭 ID가 3건 있었다.

- VM Cloud landing rows: 559건.
- Google click id rows: 3건.
- Google evidence rows: 3건.
- non-Google paid search rows: 76건.
- latest landing: 2026-05-23T06:59:06.693Z.

이 값은 “Google 유입이 있었다”는 증거다. 하지만 “Google 광고비가 발생했다”는 금액 증거는 아니다.

그래서 보고서에서는 두 줄로 나눈다.

- 광고비: Google 0원 확인 후보.
- 유입 참고: Google 클릭 ID 3건, sample 작음.

## 과거/일시중지 캠페인

최종 URL audit에서 더클린커피 이름 캠페인 후보가 보였다.

- campaign id: `14643928073`.
- campaign name: `[SA]더클린커피`.
- campaign status: PAUSED.
- channel: SEARCH.
- metric row: 최근 7일/30일 dashboard에 없음.
- 판단: 과거 또는 일시중지 캠페인 후보. 현재 광고비에는 포함하지 않는다.

과거 한글 도메인 후보도 일부 보인다. 현재 더클린커피 자사몰 퍼널과 자동으로 같은 캠페인이라고 보지 않는다. 이 후보는 예산 판단용 spend에는 넣지 않고, 필요하면 별도 legacy mapping으로 검토한다.

## Slack preview 반영 규칙

주간:

```text
- Google: 0원 확인 후보
```

rolling 30d:

```text
- Google: 0원 확인 후보
```

주의 문구:

```text
- Google Ads는 API 조회가 되며, 최근 7일/30일 비용이 있는 캠페인은 바이오컴 계열입니다. 더클린커피 이름 캠페인 비용 row는 없고, 방문 원장에는 Google 클릭 ID 3건만 소량 확인됐습니다.
```

TikTok은 TJ님 확인 기준 현재 광고를 하지 않으므로 아래처럼 표시한다.

```text
- TikTok: 0원 (현재 광고 미운영)
```

## 하지 않은 것

- Slack 실제 발송 0건.
- 운영DB write 0건.
- VM Cloud write/deploy/restart 0건.
- Google Ads conversion upload 0건.
- Google Ads campaign 변경 0건.
- GA4/Meta/TikTok/Naver 전송 0건.
- GTM publish 0건.
- raw 식별자 출력 0건.

## Track 진척률

이번 문서는 report project 기준이다.

| Track | 이름 | 이전 | 현재 | 증감 |
|---|---|---:|---:|---:|
| A | 정본 문서/source rule 정렬 | 68% | 69% | +1% |
| B | 더클린커피 매출 source 확인 | 96% | 96% | +0% |
| C | 더클린커피 광고비 source 확인 | 68% | 74% | +6% |
| D | 바이오컴 리포트 source map | 35% | 35% | +0% |
| E | Slack no-send 메시지 설계 | 95% | 96% | +1% |
| F | 자동화/배포 readiness | 85% | 86% | +1% |

## 다음 할일

### Codex가 할 일

1. Slack no-send preview에 Google/TikTok 상태를 반영한다.
   - 무엇을: Google은 0원 확인 후보, TikTok은 현재 광고 미운영 0원으로 바꾼다.
   - 왜: pending으로 남기면 광고비가 아직 모르는 상태처럼 보인다.
   - 어떻게: `reportcoffee-slack-preview-20260522.md/json`의 광고비 줄만 no-send로 갱신한다.
   - 성공 기준: 총 광고비는 그대로 유지되고, Google/TikTok 상태 설명만 더 정확해진다.
   - 승인 필요 여부: NO, Green.
   - 추천 점수/자신감: 94%.

2. legacy Google 클릭 3건의 campaign_id 연결 가능성을 별도 조사한다. - 2026-05-23 21:52 KST 완료, 상세 [[reportcoffee-google-click-id-campaign-id-linkage-20260523]]
   - 무엇을: 방문 원장에 남은 Google 클릭 ID 3건이 어떤 캠페인으로 이어지는지 확인한다.
   - 왜: 광고비는 0원 후보지만, 유입 증거가 남아 있어 나중에 ROAS 분석에서 혼동될 수 있다.
   - 어떻게: raw 클릭 ID를 출력하지 않고 hash/count 기준으로 campaign_id 보존 여부만 확인한다.
   - 성공 기준: `campaign_id 확인 가능 / legacy 보류 / source 부족` 중 하나로 분류된다.
   - 승인 필요 여부: NO for read-only.
   - 추천 점수/자신감: 78%.
