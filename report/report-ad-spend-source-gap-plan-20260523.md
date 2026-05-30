# report ad spend source gap plan 20260523

작성 시각: 2026-05-23 17:26 KST
기준일: 2026-05-23
문서 성격: 더클린커피·바이오컴 광고비 source gap 축소 설계
담당: Codex
상위 문서: [[!report]]
관련 문서: [[reportcoffee]], [[reportbiocom]], [[reportcoffee-naver-ads-campaign-allowlist-dry-run-20260522]], [[reportcoffee-v0.1-readiness-20260523]]

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
    - report/reportcoffee.md
    - report/reportbiocom.md
    - report/reportcoffee-naver-ads-campaign-allowlist-dry-run-20260522.md
  lane: Green
  allowed_actions:
    - source_gap_design
    - read_only_mapping_plan
    - no_write_guard_plan
  forbidden_actions:
    - slack_send
    - operating_db_write
    - vm_cloud_write_or_deploy
    - platform_send_or_upload
    - gtm_publish
    - raw_identifier_output
  source_window_freshness_confidence:
    source: existing VM Cloud API evidence docs + Naver dry-run docs + report source maps
    window: weekly and rolling_30d report windows
    freshness: reviewed 2026-05-23 12:45 KST
    confidence: medium_high for known gaps, medium for Google/TikTok final mapping until read-only probes complete
```

## 10초 요약

광고비 source gap의 핵심은 “광고비가 없는 것”이 아니라 “어느 브랜드 광고비인지 확실히 말할 수 있는 것만 보고에 넣어야 한다”는 점이다.

더클린커피는 Meta 광고비가 포함 가능하고, Naver는 후보 캠페인 6개가 0원으로 확인됐다. Google Ads(구글 광고)는 최근 7일/30일 더클린커피 비용 row가 없어 0원 후보로 바뀌었다. TikTok은 TJ님 확인 기준 현재 광고 미운영이라 0원으로 둔다.

바이오컴은 광고 source가 더 많지만 그만큼 플랫폼 주장값과 내부 결제완료값이 섞일 위험이 크다. 따라서 바이오컴은 첫 preview부터 “광고 플랫폼이 주장하는 값”과 “내부 원장 기준 값”을 나눠 보여줘야 한다.

## 광고비 source 원칙

1. 광고비는 플랫폼 spend를 쓴다.
   - spend는 실제 광고비 지출이다.
   - 플랫폼 전환값은 내부 매출이 아니다.

2. 브랜드가 불명확한 캠페인은 pending으로 둔다.
   - 캠페인명, landing URL, 계정 범위 중 하나라도 애매하면 포함하지 않는다.

3. 광고비 비중 계산식은 고정한다.

```text
광고비 비중 = included 광고비 / included 내부 매출 * 100
```

4. 내부 매출과 플랫폼 주장 매출을 한 분모에 섞지 않는다.

## 더클린커피 source gap

### Meta

상태: `included`

- 주간 spend: 1,952,104원.
- rolling 30d spend: 3,966,919원.
- 내부 매출에 더하는 것은 spend뿐이다.
- Meta 플랫폼 주장 구매값은 참고값이다.

다음 일:

- Slack preview에는 계속 포함한다.
- 플랫폼 주장 ROAS(광고 플랫폼이 주장하는 수익률)는 “참고”로만 표시한다.

### Naver

상태: `included_with_warning`

- VM Cloud에서 Naver Ads API read-only 조회는 성공했다.
- 더클린커피 후보 캠페인 6개는 모두 PAUSED다.
- 2026-04-22 - 2026-05-21 기준 후보 광고비 0원, 클릭 0회다.
- 계정 전체 광고비 7,305,482원은 더클린커피에 넣으면 안 된다.

다음 일:

1. Naver allowlist guard를 실제 collector preview에 연결한다.
   - 쉽게 말하면, 네이버 광고 계정에서 읽어온 37개 캠페인 중 더클린커피 후보 6개만 내부 수집 프로그램이 통과시키도록 만드는 일이다.
   - collector는 광고비를 네이버 API에서 읽어 내부 DB 캐시에 저장할 수 있는 수집 프로그램이다.
   - preview는 DB에 저장하지 않고 “저장한다면 어떤 캠페인만 남는지” 보는 미리보기 실행이다.

2. DB cache write는 승인 전 금지한다.
   - DB cache는 보고 화면이 빠르게 읽는 내부 저장 테이블이다.
   - 저장 전에 후보 6개만 남는지 검증해야 한다.

성공 기준:

- preview에서 후보 6개만 남고, 나머지 계정 광고비 7,305,482원은 제외된다.
- `site=thecleancoffee`에 바이오컴 캠페인이 섞이지 않는다.

### Google

상태: `included_with_warning_zero_candidate`

필요한 것:

- VM Cloud Google Ads dashboard 최근 7일/30일에서 더클린커피 이름 또는 coffee 키워드 캠페인 비용 row는 0개다.
- 최근 7일 account total cost는 3,911,182.88원이나 반환 캠페인은 모두 바이오컴 계열이다.
- 최근 30일 account total cost는 19,620,103.09원이나 반환 캠페인은 모두 바이오컴 계열이다.
- VM Cloud 방문 원장에는 더클린커피 Google 클릭 ID 3건이 있어 유입 참고 warning은 유지한다.
- legacy `[SA]더클린커피` 일시중지 캠페인과 최근 7일 Google 클릭 ID 3건의 관계는 raw 클릭 ID 출력 없이 count/hash 기준으로 확인한다.
- Slack 보고에는 `Google: 0원 확인 후보`로 표시한다.

금지:

- Google Ads 플랫폼 구매값을 내부 매출로 합산하지 않는다.
- Google Ads conversion upload는 이 프로젝트 범위가 아니다.

### TikTok

상태: `included_zero_user_confirmed_not_running`

필요한 것:

- TJ님 확인 기준 현재 TikTok 광고는 미운영이다.
- Slack 보고에는 `TikTok: 0원 (현재 광고 미운영)`으로 표시한다.

금지:

- TikTok Events API 전송은 하지 않는다.

## 바이오컴 source gap

### Google Ads

상태: `high_care_required`

바이오컴은 Google Ads ROAS 정합성 작업이 이미 많다. 그래서 리포트에서는 두 값을 분리해야 한다.

- Google Ads platform ROAS: 광고 플랫폼이 주장하는 값이다.
- 내부 confirmed ROAS: 실제 결제완료 주문 원장 기준값이다.

다음 일:

- 광고비는 Google Ads spend로 가져온다.
- 내부 매출은 운영DB 결제완료 기준으로 가져온다.
- campaign_id가 붙지 않은 주문을 임의로 캠페인에 붙이지 않는다.

### Meta

상태: `candidate_included`

필요한 것:

- site 기준 spend와 내부 confirmed revenue.
- 플랫폼 주장 구매값과 내부 매출 분리.

### Naver

상태: `candidate_included_with_warning`

현재 문서 근거 기준:

- VM Cloud Naver cache는 biocom 쪽이 더 많이 준비돼 있다.
- 2026-04-21 - 2026-05-20 기준 1,110 rows / spend 7,276,795원 근거가 있다.

다음 일:

- 주간·월간 KST window로 다시 자른다.
- paid/organic(유료 광고/자연 검색) 분류가 리포트에 맞는지 확인한다.

### TikTok

상태: `pending`

필요한 것:

- TikTok spend source freshness.
- 바이오컴 캠페인 mapping.
- 내부 매출과 플랫폼 주장 매출 분리.

## 실행 설계

### Phase1. Coffee Naver guard preview

- 무엇을 하는가: 더클린커피 후보 캠페인 6개만 통과시키는 preview를 만든다.
- 왜 하는가: 계정 전체 광고비가 더클린커피에 잘못 저장되는 것을 막기 위해서다.
- 어떻게 하는가: Naver 수집 스크립트에 allowlist 조건을 넣고 no-write preview를 실행한다.
- 성공 기준: 후보 6개만 남고 광고비 0원이 유지된다.
- 승인 필요 여부: 코드/preview는 NO, DB 저장은 YES.
- 추천 점수/자신감: 88%.

### Phase2. Coffee Google legacy click evidence 정리

- 무엇을 하는가: 더클린커피 Google spend는 0원 후보로 두고, landing Google click evidence 3건은 별도 warning으로 정리한다.
- 왜 하는가: 광고비는 0원인데 유입 증거가 있어 나중에 ROAS 해석이 섞일 수 있기 때문이다.
- 어떻게 하는가: raw 클릭 ID를 출력하지 않고 campaign_id 보존 여부와 legacy 캠페인 가능성을 count/hash 기준으로 본다.
- 성공 기준: `0원 후보 / 유입 warning / legacy 보류`가 Slack 보고와 분석 문서에 같이 표시된다.
- 승인 필요 여부: NO for read-only.
- 추천 점수/자신감: 78%.

### Phase3. Biocom first ad spend source map

- 무엇을 하는가: 바이오컴 Google/Meta/Naver/TikTok 광고비 source를 주간·월간으로 정리한다.
- 왜 하는가: 바이오컴은 플랫폼별 ROAS와 내부 매출 기준이 섞일 위험이 크다.
- 어떻게 하는가: 각 플랫폼별 spend와 내부 결제완료 매출을 분리해 no-send preview 입력으로 만든다.
- 성공 기준: 바이오컴 첫 Slack preview에서 플랫폼 주장값과 내부 매출이 섞이지 않는다.
- 승인 필요 여부: NO for read-only.
- 추천 점수/자신감: 82%.

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

## Guardrails

- Slack send: 0.
- 운영DB write: 0.
- VM Cloud write/deploy/restart: 0.
- platform send/upload: 0.
- GTM publish: 0.
- raw 식별자 출력: 0.
