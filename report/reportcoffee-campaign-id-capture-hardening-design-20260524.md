# reportcoffee campaign_id capture hardening design 20260524

작성 시각: 2026-05-24 11:46 KST
기준일: 2026-05-24
문서 성격: 더클린커피 Google campaign_id capture 보강안 / Green 설계
담당: Codex
상위 문서: [[reportcoffee]], [[reportcoffee-google-click-campaign-bridge-preview-20260523]]
JSON 산출물: `report/reportcoffee-campaign-id-capture-hardening-design-20260524.json`

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
    - harness/coffee-data/LIVE_TAG_INVENTORY.md
    - report/reportcoffee.md
    - report/reportcoffee-google-click-campaign-bridge-preview-20260523.md
    - project/coffee-google-click-id-structured-storage-plan-20260521.md
    - project/coffee-google-click-storage-smoke-result-20260521.md
  lane: Green
  allowed_actions:
    - local_code_read
    - local_fixture_run
    - design_document
    - approval_packet_draft
  forbidden_actions:
    - slack_send
    - operating_db_write
    - vm_cloud_write_or_deploy
    - vm_cloud_restart
    - gtm_publish
    - google_ads_upload
    - google_ads_campaign_change
    - platform_send
    - raw_identifier_output
  source_window_freshness_confidence:
    source: VM Cloud no-raw preview + local backend code + coffee storage smoke + fixture
    window: VM Cloud last_7d/last_30d; coffee smoke 2026-05-21; design 2026-05-24
    freshness: live inventory snapshot is stale since 2026-05-01, so implementation must refresh it before preview/publish
    confidence: high for root category, medium_high for recommended path
```

## 10초 요약

더클린커피는 Google 클릭 ID 3건을 잡았지만 캠페인 번호는 못 잡았다. 이유는 단순히 API 하나가 빠진 것이 아니라, 브라우저 저장소, 서버 수신점, Google Ads URL 힌트가 모두 약하게 연결돼 있기 때문이다.

권장 순서는 세 단계다. 먼저 서버 수신점이 더클린커피를 허용하게 만들고, 그 다음 브라우저/태그가 `gad_campaignid`를 보존하게 만들고, 실제 광고를 다시 켤 때 Google Ads URL suffix를 붙인다. 이번 문서는 설계만 하며, 배포·GTM publish·Google Ads 변경은 하지 않는다.

## 지금 확인된 병목

### 1. 현재 3건은 campaign_id가 없다

source: [[reportcoffee-google-click-campaign-bridge-preview-20260523]]

- 더클린커피 최근 7일 고객 유입 장부: 549건.
- Google 클릭 ID rows: 3건.
- Google 클릭 ID + `gad_campaignid` 동시 보존 rows: 0건.
- 더클린커피 유료 클릭 의도 장부 rows: 0건.

의미:

현재 3건은 Google 유료 클릭 증거로는 맞다. 하지만 campaign_id가 없으므로 `[SA]더클린커피` 같은 과거 캠페인 후보에 붙이면 안 된다.

### 2. 더클린커피 live 저장소는 campaign hint를 구조화하지 못한다

source: [[coffee-google-click-storage-smoke-result-20260521]]

- `gclid`는 landing 후 cart까지 구조화 필드로 보존된다.
- `gbraid`, `wbraid`, `gad_campaignid`는 URL 문자열에는 남을 수 있지만 구조화 필드에는 없다.

의미:

브라우저 안에서는 일부 Google 클릭 정보가 살아 있어도, checkout/payment payload가 쉽게 읽을 수 있는 형태로 정리되지 않는다.

### 3. 서버 수신점은 현재 paid-click intent 최소 원장을 biocom만 허용한다

local code review:

- `backend/src/routes/attribution.ts`의 `PAID_CLICK_INTENT_ALLOWED_SITES`는 현재 `biocom`만 허용한다.
- 더클린커피 URL이 들어오면 고객 유입 장부에는 fan-out으로 들어갈 수 있지만, 유료 클릭 의도 장부 최소 row는 site gate에서 막힌다.

의미:

더클린커피는 campaign_id 검사용 paid-click intent 원장이 비어 있을 수밖에 없다. 최근 7일/30일 더클린커피 유료 클릭 의도 장부 rows가 0건인 것과 맞다.

### 4. 서버는 campaign hint를 받을 준비가 일부 있지만 저장 경로가 좁다

local code review:

- URL query allowlist에는 이미 `gad_campaignid`, `gad_source`가 있다.
- no-send preview는 landing URL과 current URL 양쪽에서 `gad_campaignid`를 읽을 수 있다.
- 하지만 최소 원장 저장 함수는 현재 `sanitized_landing_url` 중심으로 `allowed_query_json`을 만든다.

의미:

캠페인 힌트가 current URL 또는 explicit payload field에만 있으면 저장 누락 가능성이 있다. 방어적으로 `preview.gad_campaignid -> landing_url -> current_url` 순서로 저장해야 한다.

## 권장 보강안

### P0. 지금 상태 유지

무엇을 하는가:

Google 광고비는 계속 `0원 확인 후보`로 두고, 클릭 3건은 “campaign_id 미보존 유입 증거”로만 표시한다.

왜 하는가:

현재 3건에 campaign_id가 없는데 임의로 캠페인에 붙이면 광고비 비중과 ROAS가 틀어진다.

성공 기준:

- Slack no-send preview에서 Google 광고비 금액은 변하지 않는다.
- 경고 문구만 정확해진다.
- Google Ads upload 후보는 0건이다.

승인 필요 여부: 없음. Green.

### P1. 서버 수신점 보강

무엇을 하는가:

더클린커피도 유료 클릭 의도 장부에 최소 row를 쓸 수 있게 한다. 단, 실제 전송이 아니라 내부 no-send 원장이다.

어떻게 하는가:

1. `PAID_CLICK_INTENT_ALLOWED_SITES`에 `thecleancoffee`를 추가한다.
2. 저장 함수가 `sanitized_current_url`, `gad_campaignid`, `gad_source`를 받을 수 있게 한다.
3. `allowed_query_json`은 아래 순서로 campaign hint를 저장한다.

```text
explicit preview.gad_campaignid
-> sanitized_landing_url query
-> sanitized_current_url query
```

4. Google 클릭 ID 판정은 계속 `gclid/gbraid/wbraid`만 쓴다.
5. `gad_campaignid`만 있는 row는 upload 후보가 되지 않는다.

왜 하는가:

지금 더클린커피 유료 클릭 의도 장부가 0건이라 campaign_id 품질을 계속 측정할 수 없다. 서버 gate를 열어야 이후 capture 개선 효과를 계량할 수 있다.

성공 기준:

- local no-send fixture PASS.
- backend typecheck PASS.
- test payload에서 `site_not_allowed`가 사라진다.
- 외부 플랫폼 send/upload 0건.
- raw click ID 출력 0건.

승인 필요 여부:

- 로컬 설계/패치: Green.
- VM Cloud 배포/restart: Yellow 승인 필요.

### P2. 더클린커피 브라우저 capture 보강

무엇을 하는가:

더클린커피 페이지에서 `gclid/gbraid/wbraid/gad_source/gad_campaignid`를 하나의 Google 클릭 묶음으로 보존한다.

어떻게 하는가:

기존 설계 [[coffee-google-click-id-structured-storage-plan-20260521]]의 규칙을 쓴다.

- 새 URL에 `gclid+gbraid`가 있으면 오래된 `wbraid`를 섞지 않는다.
- 실제 `wbraid` only 클릭은 보존한다.
- `gad_campaignid`는 campaign hint로 보존한다.
- `gad_campaignid`만으로 Google click ID가 있다고 보지 않는다.
- purchase, conversion upload, 플랫폼 send는 하지 않는다.

검증:

`scripts/coffee-click-id-structured-storage-fixture.mjs`는 2026-05-24 실행 기준 9/9 PASS다.

승인 필요 여부:

- fixture/설계: Green.
- GTM Preview 또는 Imweb preview: Yellow 승인 필요.
- GTM Production publish 또는 Imweb 저장/반영: Red 승인 필요.

### P3. Google Ads URL hint 보강

무엇을 하는가:

광고를 다시 켤 때 더클린커피 Google Ads 캠페인 URL에 campaign hint를 붙인다.

예시:

```text
gad_source=1&gad_campaignid={campaignid}
```

왜 하는가:

브라우저와 서버가 아무리 잘 보존해도, 실제 광고 클릭 URL에 campaign id 힌트가 없으면 저장할 값이 없다. 현재 더클린커피 final-url-audit에는 manual UTM, tracking template, final URL suffix가 없다.

주의:

이것은 Google Ads campaign setting 변경이다. 전환 upload나 conversion action 변경은 아니지만 광고 계정 설정을 바꾸므로 별도 승인이 필요하다.

승인 필요 여부: Red. TJ님 명시 승인 전 실행 금지.

## 권장 실행 순서

1. P1 backend local patch + test만 먼저 진행한다.
2. VM deploy 승인안을 만든다.
3. deploy 후 no-send test payload로 `site_not_allowed` 제거를 확인한다.
4. P2 GTM/Imweb Preview로 브라우저 저장과 payload를 확인한다.
5. 실제 Google Ads 광고가 재개될 때 P3 URL suffix를 별도 승인으로 검토한다.

이 순서가 맞는 이유:

- Google Ads 설정을 먼저 바꿔도 서버가 더클린커피를 저장하지 못하면 측정이 안 된다.
- 브라우저 보강만 해도 광고 URL에 `gad_campaignid`가 없으면 campaign_id가 안 생긴다.
- 서버 보강은 외부 전송이 없고 rollback이 쉬운 첫 단계다.

## 승인안 초안

아래는 다음 턴에서 그대로 이어갈 수 있는 승인 문구다. 이 문구는 실행 승인이며, 지금 이 문서 작성만으로는 실행하지 않는다.

```text
승인합니다: 더클린커피 campaign_id capture P1 backend no-send receiver 보강.

범위:
- backend/src/routes/attribution.ts에서 paid-click-intent allowed site에 thecleancoffee 추가.
- backend/src/paidClickIntentLog.ts에서 gad_campaignid/gad_source 저장 우선순위를 explicit preview -> landing_url -> current_url로 확장.
- 로컬 fixture/typecheck/test 실행.
- VM Cloud backend 배포/restart.
- post-deploy no-send smoke와 VM Cloud SQLite read-only aggregate 검증.

금지:
- Google Ads upload.
- Google Ads conversion action 변경.
- Google Ads campaign setting 변경.
- GA4/Meta/TikTok/Naver platform send.
- GTM Production publish.
- Imweb 저장/반영.
- 운영DB write.
- raw click ID, 주문번호, email, phone, payment/member 정보 출력.

성공 기준:
- no-send test에서 site=thecleancoffee가 site_not_allowed로 막히지 않는다.
- gclid/gbraid/wbraid가 있을 때만 live 후보가 된다.
- gad_campaignid만 있는 payload는 upload/purchase 후보가 되지 않는다.
- allowed_query_json에 campaign hint가 no-raw aggregate로 확인된다.
- 외부 send/upload/write/publish 0건.

실패 조건:
- API 5xx.
- raw 식별자 노출.
- external platform send/upload 발생.
- paid_click_intent duplicate spike.
- thecleancoffee click row가 purchase로 승격.

실패 시:
- pre-deploy backup으로 rollback.
- rollback 후 status/API/SQLite aggregate 비교 보고.
```

## 이번 설계에서 하지 않은 것

- VM Cloud deploy/restart 0건.
- GTM Preview/Production publish 0건.
- Google Ads campaign setting 변경 0건.
- Google Ads upload 0건.
- GA4/Meta/TikTok/Naver 전송 0건.
- 운영DB write 0건.
- raw click ID, raw URL, 주문번호, email, phone, payment key 출력 0건.

## Track 진척률

이번 문서는 report project 기준이다.

| Track | 이름 | 이전 | 현재 | 증감 |
|---|---|---:|---:|---:|
| A | 정본 문서/source rule 정렬 | 71% | 72% | +1% |
| B | 더클린커피 매출 source 확인 | 96% | 96% | +0% |
| C | 더클린커피 광고비 source 확인 | 78% | 80% | +2% |
| D | 바이오컴 리포트 source map | 35% | 35% | +0% |
| E | Slack no-send 메시지 설계 | 97% | 97% | +0% |
| F | 자동화/배포 readiness | 89% | 91% | +2% |

## 다음 할일

### Codex가 할 일

1. P1 backend local patch를 준비한다.
   - 무엇을: 더클린커피 paid-click-intent no-send receiver를 로컬에서 보강한다.
   - 왜: 캠페인 ID 보존률을 계속 측정하려면 더클린커피도 최소 원장에 들어와야 한다.
   - 어떻게: allowed site 추가, current URL/explicit campaign hint 저장, fixture/typecheck/test 실행.
   - 성공 기준: 로컬 테스트 PASS, send/upload/write 0건.
   - 실패 시 다음 확인점: `site_not_allowed`, `missing_google_click_id`, `test_click_id_rejected_for_live` 중 어디서 막히는지 분리한다.
   - 의존성: 없음. 로컬 patch는 Green.
   - 승인 필요 여부: 로컬 patch는 NO, VM deploy는 YES.
   - 추천 점수/자신감: 90%.

2. VM deploy 승인 패킷을 분리 작성한다.
   - 무엇을: P1 backend patch를 VM에 반영할지 결정할 수 있는 승인 문서를 만든다.
   - 왜: VM restart/deploy는 Yellow라 승인 범위와 rollback이 필요하다.
   - 어떻게: 변경 파일, pre-snapshot, deploy command, post-snapshot, rollback, hard fail 조건을 쓴다.
   - 성공 기준: TJ님이 승인하면 바로 실행 가능한 수준.
   - 실패 시 다음 확인점: 권한, 백업 경로, pm2 restart, API health check.
   - 의존성: P1 local patch diff.
   - 승인 필요 여부: 승인 문서 작성은 NO, 실제 deploy는 YES.
   - 추천 점수/자신감: 86%.

### TJ님이 할 일

지금 당장 할 일은 없다. Codex가 먼저 로컬 patch와 deploy 승인안을 만들 수 있다. 실제 VM deploy 또는 GTM/Google Ads 변경 단계에서만 승인하면 된다.
