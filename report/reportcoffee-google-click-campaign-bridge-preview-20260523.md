# reportcoffee Google click campaign bridge preview 20260523

작성 시각: 2026-05-23 22:46 KST
기준일: 2026-05-23
문서 성격: 더클린커피 Google 클릭 ID 3건의 no-raw campaign bridge preview
담당: Codex
상위 문서: [[reportcoffee]], [[reportcoffee-google-click-id-campaign-id-linkage-20260523]]
후속 문서: [[reportcoffee-campaign-id-capture-hardening-design-20260524]]
JSON 산출물: `report/reportcoffee-google-click-campaign-bridge-preview-20260523.json`

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
    - report/reportcoffee-google-click-id-campaign-id-linkage-20260523.md
  lane: Green
  allowed_actions:
    - vm_cloud_sqlite_read_only_aggregate
    - no_raw_campaign_bridge_preview
    - local_json_markdown_output
  forbidden_actions:
    - slack_send
    - operating_db_write
    - vm_cloud_write_or_deploy
    - vm_cloud_restart
    - platform_send_or_upload
    - google_ads_upload
    - google_ads_campaign_change
    - gtm_publish
    - raw_identifier_output
  source_window_freshness_confidence:
    source: VM Cloud SQLite /home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3
    window: rolling last_7d and last_30d
    freshness: VM UTC now 2026-05-23 13:45:05, checked 2026-05-23 22:46 KST
    confidence: high for campaign_id source_gap, medium for root cause until live capture path is reviewed
```

## 사람이 이해하는 작업 설명

무엇을 했는가:

더클린커피 방문 원장에 남은 Google 클릭 3건이 광고 캠페인 번호까지 갖고 있는지 확인했다. 원문 클릭 ID, URL, 주문번호는 보지 않고 count만 조회했다.

왜 했는가:

Google 광고비는 현재 0원 후보인데 Google 클릭 흔적은 3건 남아 있다. 이 3건이 특정 캠페인과 이어지면 나중에 ROAS(광고비 대비 매출 효율)를 더 정확히 쪼갤 수 있고, 안 이어지면 “유입 증거만 있고 캠페인 연결은 없음”으로 분리해야 한다.

어떻게 했는가:

VM Cloud SQLite를 `sqlite3 -readonly`로 열고, 고객 유입 장부 (site_landing_ledger)와 유료 클릭 의도 장부 (paid_click_intent_ledger)를 집계만 조회했다. 반환한 값은 총 row 수, Google 클릭 ID row 수, `gad_campaignid` row 수, 최신 시각뿐이다.

결과가 무엇인가:

최근 7일 더클린커피 고객 유입 장부에는 Google 클릭 ID 3건이 있지만 `gad_campaignid`는 0건이다. 유료 클릭 의도 장부에는 더클린커피 row 자체가 0건이다. 따라서 3건을 campaign_id로 연결할 수 없다.

목표에 어떤 영향을 줬는가:

Slack 광고비 보고의 Google 값은 그대로 `0원 확인 후보`다. 클릭 3건은 광고비가 아니라 “Google 유입 증거가 소량 있었지만 캠페인까지는 못 붙임”이라는 경고로만 둔다.

남은 병목은 무엇인가:

더클린커피 live capture path가 `gad_campaignid`를 저장하지 못하고 있다. 이 값을 앞으로 보존하려면 GTM/수신 서버/요약 API 중 어느 경로에서 보강할지 별도 설계가 필요하다. 후속 설계는 [[reportcoffee-campaign-id-capture-hardening-design-20260524]]에 둔다. 단, 이번 작업에서는 배포나 GTM 변경을 하지 않았다.

## Preview 결과

### 더클린커피 최근 7일

source: VM Cloud SQLite read-only

- 고객 유입 장부 total rows: 549건.
- Google 클릭 ID rows: 3건.
- Google 클릭 ID + `gad_campaignid` 동시 보존 rows: 0건.
- `gad_campaignid` rows: 0건.
- `gad_source` rows: 0건.
- latest landing: 2026-05-23T13:05:27.009Z.
- 유료 클릭 의도 장부 total rows: 0건.

판정:

3건은 Google 유료 클릭 증거지만, 캠페인 번호가 같이 남지 않았다. 따라서 `[SA]더클린커피` 같은 legacy campaign 후보에 붙이면 안 된다.

### 더클린커피 최근 30일

- 고객 유입 장부 total rows: 1,495건.
- Google 클릭 ID rows: 3건.
- Google 클릭 ID + `gad_campaignid` 동시 보존 rows: 0건.
- 유료 클릭 의도 장부 total rows: 0건.

판정:

최근 30일로 넓혀도 더클린커피 campaign_id bridge는 0건이다. 7일 window만 우연히 좁아서 생긴 문제가 아니다.

### Positive control

같은 쿼리가 campaign_id를 감지할 수 있는지 확인하려고 바이오컴을 positive control로 봤다. positive control은 “쿼리 자체가 작동하는지 보는 기준 샘플”이다.

- 바이오컴 고객 유입 장부 최근 7일 Google 클릭 ID rows: 7,716건.
- 그중 `gad_campaignid` 동시 보존 rows: 2,923건.
- 바이오컴 유료 클릭 의도 장부 최근 7일 Google 클릭 ID rows: 8,005건.
- 그중 `gad_campaignid` 동시 보존 rows: 3,088건.

의미:

쿼리가 campaign_id를 못 찾는 것이 아니다. 바이오컴에서는 같은 방식으로 campaign_id가 잡힌다. 더클린커피 0건은 source gap으로 보는 것이 맞다.

## campaign_id 후보 판정

final-url-audit에서 보인 legacy 후보는 유지한다.

- `14643928073` / `[SA]더클린커피` / PAUSED.
- `15647876620` / 더클린펫푸드 / PAUSED.
- `17273589731` / clean skin adwords / PAUSED.
- `17554019723` / clean gdn / PAUSED.

이번 preview에서는 위 후보 중 어느 것도 최근 3건 클릭과 연결되지 않았다. 이유는 3건 클릭 row 안에 campaign_id 값이 없기 때문이다.

## Slack 보고 반영

유지:

```text
Google: 0원 확인 후보
```

주의 문구:

```text
최근 7일 방문 원장에 Google 클릭 ID 3건이 있으나, campaign_id는 보존되지 않아 특정 Google 캠페인에 연결하지 않습니다.
```

하지 말아야 할 것:

- 3건 클릭을 `[SA]더클린커피` 캠페인으로 추정 연결하지 않는다.
- Google 광고비에 금액을 더하지 않는다.
- Google Ads upload 후보로 쓰지 않는다.
- Google ROAS 분자/분모에 이 3건을 캠페인 단위로 억지 배정하지 않는다.

## 하지 않은 것

- Slack 실제 발송 0건.
- 운영DB write 0건.
- VM Cloud write/deploy/restart 0건.
- Google Ads upload 0건.
- Google Ads campaign 변경 0건.
- GA4/Meta/TikTok/Naver 전송 0건.
- GTM publish 0건.
- raw click ID, raw URL, 주문번호, email, phone, payment key 출력 0건.

## Track 진척률

이번 문서는 report project 기준이다.

| Track | 이름 | 이전 | 현재 | 증감 |
|---|---|---:|---:|---:|
| A | 정본 문서/source rule 정렬 | 70% | 71% | +1% |
| B | 더클린커피 매출 source 확인 | 96% | 96% | +0% |
| C | 더클린커피 광고비 source 확인 | 76% | 78% | +2% |
| D | 바이오컴 리포트 source map | 35% | 35% | +0% |
| E | Slack no-send 메시지 설계 | 96% | 97% | +1% |
| F | 자동화/배포 readiness | 88% | 89% | +1% |

## 다음 할일

### Codex가 할 일

1. Slack no-send preview 경고 문구만 반영한다.
   - 무엇을: Google 광고비는 0원 후보로 유지하고, 클릭 3건은 campaign_id 미보존 경고로 표시한다.
   - 왜: 광고비와 유입 증거를 섞으면 매출 대비 광고비 비중이 틀어진다.
   - 어떻게: `reportcoffee-slack-preview-20260522` 문서/JSON의 Google 설명만 no-send로 보강한다.
   - 성공 기준: 광고비 합계는 변하지 않고, Google 경고만 더 정확해진다.
   - 실패 시 다음 확인점: 실제 Google Ads spend row가 새로 생겼는지 dashboard API를 재조회한다.
   - 의존성: 없음.
   - 승인 필요 여부: NO, Green.
   - 추천 점수/자신감: 94%.

2. 더클린커피 campaign_id capture 보강안을 설계한다.
   - 무엇을: 앞으로 Google 클릭이 들어올 때 `gad_campaignid`가 고객 유입 장부나 유료 클릭 의도 장부에 남도록 설계한다.
   - 왜: 현재는 Google 클릭은 남지만 campaign_id가 빠져 캠페인별 ROAS를 계산할 수 없다.
   - 어떻게: GTM, 수신 서버, 요약 API 중 최소 변경 경로를 비교하고 승인안만 작성한다. 실제 publish/deploy는 하지 않는다.
   - 성공 기준: 배포 전 승인안에 변경 위치, 영향, rollback, raw 노출 0 검증이 들어간다.
   - 실패 시 다음 확인점: 더클린커피 GTM 태그가 biocom과 다른지, receiver가 site를 커피로 받는지, URL query allowlist가 빠졌는지 확인한다.
   - 의존성: 없음. 단 실제 반영은 Yellow/Red 승인 필요.
   - 승인 필요 여부: 설계는 NO, GTM/VM 반영은 YES.
   - 추천 점수/자신감: 82%.

### TJ님이 할 일

지금 당장 할 일은 없다. 다음 단계에서 실제 GTM 또는 VM Cloud 배포가 필요하다고 판단될 때만 승인 여부를 결정하면 된다.
