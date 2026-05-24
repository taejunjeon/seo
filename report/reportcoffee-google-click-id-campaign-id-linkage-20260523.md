# reportcoffee Google click ID campaign_id linkage 20260523

작성 시각: 2026-05-23 21:52 KST
기준일: 2026-05-23
문서 성격: 더클린커피 Google 클릭 ID 3건의 campaign_id 연결 가능성 Green 조사
담당: Codex
상위 문서: [[reportcoffee]], [[reportcoffee-google-ads-spend-mapping-20260523]]
후속 문서: [[reportcoffee-google-click-campaign-bridge-preview-20260523]]
JSON 산출물: `report/reportcoffee-google-click-id-campaign-id-linkage-20260523.json`

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
    - report/reportcoffee-google-ads-spend-mapping-20260523.md
  lane: Green
  allowed_actions:
    - vm_cloud_google_ads_read_only_api
    - local_code_read
    - local_json_markdown_output
    - no_send_no_write_design
  forbidden_actions:
    - slack_send
    - operating_db_write
    - vm_cloud_write_or_deploy
    - platform_send_or_upload
    - google_ads_upload
    - google_ads_campaign_change
    - gtm_publish
    - raw_identifier_output
  source_window_freshness_confidence:
    source: VM Cloud Google Ads status/dashboard/final-url-audit read-only APIs + local backend route code
    window: Google Ads last_7d, VM Cloud landing last_7d
    freshness: final-url-audit fetchedAt 2026-05-23T12:52:04.990Z, checked 2026-05-23 21:52 KST
    confidence: medium_high for source gap classification, medium for exact campaign_id until no-raw row aggregate is added
```

## 10초 요약

최근 7일 더클린커피 방문 원장에는 Google 유료 클릭 증거 3건이 있다. 다만 현재 열려 있는 read-only API는 “3건이 있다”까지만 보여주고, 그 3건이 어느 campaign_id(광고 캠페인 번호)에서 왔는지는 행 단위로 돌려주지 않는다.

그래서 이번 판정은 `campaign_id 미확정`이다. 광고비 보고에는 변화가 없다. Slack 보고의 Google 광고비는 계속 `0원 확인 후보`로 두고, “Google 클릭 ID 3건은 유입 참고 경고”로만 붙인다. 후속 no-raw preview는 [[reportcoffee-google-click-campaign-bridge-preview-20260523]]에 있다.

## 확인한 것

### 1. Google 클릭 증거는 실제로 있다

source: VM Cloud `/api/google-ads/final-url-audit`

- window: 최근 7일.
- 더클린커피 landing rows: 549건.
- Google click ID rows: 3건.
- click ID type: gclid 3건, gbraid 0건, wbraid 0건.
- Google evidence rows: 3건.
- 다른 매체 paid search rows: 73건.
- latest landing: 2026-05-23T12:21:39.553Z.

의미:

Google 클릭 ID는 Google Ads 자동 태깅이 붙은 방문이라는 뜻이다. 쉽게 말해 “방문자가 Google 광고에서 넘어온 흔적”이다. 하지만 이것만으로 “광고비가 얼마였는지”나 “어느 캠페인인지”까지 자동 확정되지는 않는다.

### 2. 현재 Google 광고비 row는 더클린커피로 안 잡힌다

source: VM Cloud `/api/google-ads/dashboard?date_preset=last_7d&campaign_limit=200`

- Google Ads 계정 전체 최근 7일 광고비: 3,909,208.88원.
- 더클린커피 이름 또는 coffee 이름의 campaign metric row: 0개.
- 더클린커피 캠페인 광고비: 0원.

의미:

Google Ads 조회 자체는 된다. 다만 비용이 잡힌 캠페인은 더클린커피가 아니라 바이오컴 계열이다. 따라서 더클린커피 보고서에 Google 광고비를 추가하면 안 된다.

### 3. legacy 후보 campaign_id는 있지만 exact 연결은 아니다

final-url-audit에서 보인 후보:

- `14643928073` / `[SA]더클린커피` / PAUSED / SEARCH.
- `15647876620` / 더클린펫푸드 / PAUSED / SEARCH.
- `17273589731` / clean skin adwords / PAUSED / SEARCH.
- `17554019723` / clean gdn / PAUSED / DISPLAY.

판정:

`14643928073`은 더클린커피 과거 후보로 볼 수 있다. 하지만 최근 7일 광고비 metric row가 없고, 현재 API가 클릭 3건의 행별 campaign_id를 반환하지 않으므로 “3건이 이 캠페인에서 왔다”고 확정하면 안 된다.

## 왜 아직 못 붙였나

### blocker 1. 현재 API는 집계까지만 돌려준다

`final-url-audit`은 Google click ID 3건을 보여준다. 하지만 원문 click ID나 행별 `gad_campaignid` 값은 반환하지 않는다. 이것은 안전한 설계다. 원문 클릭 ID를 외부로 노출하면 광고 식별자 관리가 흔들리기 때문이다.

그래서 campaign_id를 붙이려면 원문을 보여주는 방식이 아니라, 내부에서만 세고 밖으로는 아래처럼 집계만 내보내야 한다.

```text
site=thecleancoffee
window=7d
google_click_id_rows=3
gad_campaignid_rows=__
top_gad_campaignids=[{campaign_id, rows}]
raw_click_id_output=0
```

### blocker 2. 기존 campaign health는 바이오컴 기준이다

local code review:

- `backend/src/routes/googleAds.ts`의 `buildGoogleCampaignMatchHealth`는 `site = 'biocom'`으로 고정돼 있다.
- `/api/google-ads/click-id-health`도 현재 `site='biocom'`만 허용한다.
- `site=thecleancoffee`로 호출하면 커피 전용 campaign linkage를 주지 않는다.

의미:

현재 dashboard의 campaign match health를 더클린커피 3건에 적용하면 안 된다. 쉽게 말해 “바이오컴용 건강검진표를 더클린커피에 가져다 대면 안 된다”는 뜻이다.

### blocker 3. broad acquisition API는 예산 판단에 부적합하다

`/api/acquisition/channel-analysis?site=thecleancoffee`는 Google/CPC 매출처럼 보이는 broad 값을 반환할 수 있다. 하지만 그 안에는 바이오컴 캠페인명처럼 보이는 source도 섞인다.

판정:

이 API는 “유입 흐름 참고”로는 볼 수 있지만, 이번 3건의 campaign_id 연결이나 Google 광고비 0원 판단에는 쓰지 않는다.

## 이번 결론

더클린커피 Google 클릭 ID 3건은 `Google 유료 유입 증거`로 유지한다.

하지만 다음 중 어느 것도 아직 충족하지 못했다.

- 3건의 행별 `gad_campaignid` 보존 확인.
- 3건과 `[SA]더클린커피` campaign_id의 exact 연결.
- 최근 7일/30일 더클린커피 Google Ads spend row 확인.

따라서 Slack 보고에는 아래처럼 반영한다.

```text
Google: 0원 확인 후보
주의: 최근 7일 방문 원장에 Google 클릭 ID 3건이 있어 유입 증거는 남아 있으나, 현재 API로는 특정 campaign_id와 광고비를 확정 연결하지 못했습니다.
```

## Green 추가 설계

다음 단계는 raw 클릭 ID를 보여주지 않는 집계형 preview를 만드는 것이다.

이름: `coffee_google_click_campaign_bridge_preview`

무엇을 하는가:

VM Cloud의 방문 원장과 클릭 의도 원장에서 더클린커피 행만 읽고, Google 클릭 ID가 있는 행 중 `gad_campaignid`가 보존됐는지 세어 본다.

왜 하는가:

지금은 “Google 클릭 3건이 있다”와 “더클린커피 과거 캠페인이 있다”가 따로 존재한다. 둘 사이를 campaign_id로 연결해야 나중에 유입/매출 분석에서 Google을 잘못 빼거나 잘못 더하지 않는다.

어떻게 하는가:

- `site_landing_ledger`에서 `site='thecleancoffee'`와 최근 7일을 집계한다.
- `click_id_type in ('gclid','gbraid','wbraid')` 또는 landing URL에 Google click ID 단서가 있는 행만 센다.
- 원문 click ID는 절대 출력하지 않는다.
- `gad_campaignid`가 있으면 campaign_id별 count만 반환한다.
- 반환된 campaign_id를 Google Ads 후보 캠페인명과 맞춘다.

성공 기준:

- `gad_campaignid_rows >= 1`이면 campaign_id 보존 가능.
- campaign_id가 Google Ads 후보와 일치하면 `campaign_id exact/strong preserved`.
- 없으면 `source_gap` 유지.
- raw click ID, 주문번호, email, phone, payment key 출력 0건.

## 하지 않은 것

- Slack 실제 발송 0건.
- 운영DB write 0건.
- VM Cloud write/deploy/restart 0건.
- Google Ads upload 0건.
- Google Ads campaign 변경 0건.
- GA4/Meta/TikTok/Naver 전송 0건.
- GTM publish 0건.
- raw click ID 출력 0건.

## Track 진척률

이번 문서는 report project 기준이다.

| Track | 이름 | 이전 | 현재 | 증감 |
|---|---|---:|---:|---:|
| A | 정본 문서/source rule 정렬 | 69% | 70% | +1% |
| B | 더클린커피 매출 source 확인 | 96% | 96% | +0% |
| C | 더클린커피 광고비 source 확인 | 74% | 76% | +2% |
| D | 바이오컴 리포트 source map | 35% | 35% | +0% |
| E | Slack no-send 메시지 설계 | 96% | 96% | +0% |
| F | 자동화/배포 readiness | 86% | 88% | +2% |

## 다음 할일

### Codex가 할 일

1. no-raw campaign bridge preview를 만든다.
   - 무엇을: 더클린커피 Google 클릭 3건이 `gad_campaignid`를 보존했는지 집계만 보는 preview를 만든다.
   - 왜: raw 클릭 ID 없이도 campaign_id 연결 가능성을 닫기 위해서다.
   - 어떻게: VM Cloud SQLite read-only 또는 local backend helper로 `site_landing_ledger`와 `paid_click_intent_ledger`를 count만 반환하게 한다.
   - 성공 기준: campaign_id별 count가 나오거나, 없으면 source_gap으로 확정된다.
   - 실패 시 다음 확인점: VM Cloud 테이블 컬럼이 부족한지, URL query 보존이 안 되는지, 현재 공개 API에 집계 필드가 없는지 분리한다.
   - 의존성: 없음. Green Lane.
   - 승인 필요 여부: NO for local/read-only, YES only if VM route deploy가 필요할 때.
   - 추천 점수/자신감: 88%.

2. Slack preview 경고 문구를 유지한다.
   - 무엇을: Google 광고비는 0원 확인 후보로 두고, 클릭 ID 3건은 작은 유입 증거라고만 표시한다.
   - 왜: 광고비와 유입 증거를 섞으면 매출 대비 광고비 비중이 틀어진다.
   - 어떻게: `reportcoffee-slack-preview-20260522`의 Google 주의 문구를 유지한다.
   - 성공 기준: 광고비 합계는 변하지 않고, Google 유입 경고만 남는다.
   - 실패 시 다음 확인점: 실제 Google Ads spend row가 새로 생겼는지 다시 조회한다.
   - 의존성: 없음.
   - 승인 필요 여부: NO, no-send 문서 preview.
   - 추천 점수/자신감: 94%.

### TJ님이 할 일

현재 즉시 할 일은 없다. Codex가 먼저 no-raw 집계 preview까지 진행할 수 있다. 나중에 VM route로 배포해야 할 때만 별도 승인하면 된다.
