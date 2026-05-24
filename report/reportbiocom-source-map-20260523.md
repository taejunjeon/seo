# reportbiocom source map 20260523

작성 시각: 2026-05-23 12:45 KST
기준일: 2026-05-23
문서 성격: 바이오컴 Slack 주간·월간 매출액/광고비 비중 리포트 source map
담당: Codex
상위 문서: [[reportbiocom]], [[!report]]
관련 문서: [[report-v0.1-readiness-and-next-impact-plan-20260523]], [[report-ad-spend-source-gap-plan-20260523]]

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
    - report/reportbiocom.md
    - report/!report.md
    - gdn/attribution-data-source-decision-guide-20260511.md
    - data/!data_inventory.md
  lane: Green
  allowed_actions:
    - source_map_design
    - no_send_preview_design
    - read_only_probe_plan
  forbidden_actions:
    - slack_send
    - operating_db_write
    - vm_cloud_write_or_deploy
    - platform_send_or_upload
    - gtm_publish
    - raw_identifier_output
  source_window_freshness_confidence:
    source: reportbiocom current doc + attribution source guide + existing Google/Naver/Meta project evidence docs
    window: next weekly and monthly KST report windows, exact numeric dry-run pending
    freshness: source map reviewed 2026-05-23 12:45 KST
    confidence: medium for design, numeric confidence pending first dry-run
```

## 10초 요약

바이오컴은 더클린커피보다 광고 데이터가 많지만, 그래서 더 조심해야 한다.

첫 Slack 보고는 “내부 결제완료 매출이 얼마인지”와 “광고 플랫폼이 주장하는 구매 성과가 얼마인지”를 반드시 나눠야 한다. 특히 Google Ads(구글 광고)는 플랫폼 ROAS(광고 플랫폼이 주장하는 수익률)가 높아 보이더라도 내부 confirmed ROAS(실제 결제완료 주문 원장 기준 수익률)와 다를 수 있다.

따라서 바이오컴의 첫 단계는 숫자 산출이 아니라 source map이다. source map은 “어떤 숫자를 어느 데이터 원천에서 읽고, 예산 판단에 써도 되는지”를 정하는 지도다.

## 리포트 목표

바이오컴 Slack 보고는 아래 질문에 답해야 한다.

1. 이번 주와 이번 달 바이오컴 실제 결제완료 매출은 얼마인가.
2. Google, Meta, Naver, TikTok 광고비는 얼마인가.
3. 매출 대비 광고비 비중은 몇 %인가.
4. 광고 플랫폼 주장 매출과 내부 결제완료 매출은 얼마나 다른가.
5. 어떤 값은 예산 판단에 쓰고, 어떤 값은 참고로만 봐야 하는가.

## 매출 source map

### 내부 결제완료 매출

판정: `primary`

- source: 운영DB `tb_iamweb_users PAYMENT_COMPLETE`.
- 의미: 실제 결제완료 주문 원장 기준 매출이다.
- 사용처: Slack 보고의 매출 분모, 광고비 비중 계산.
- 주의: 운영DB는 개발팀이 관리하는 PostgreSQL dashboard DB다. VM Cloud SQLite와 구분한다.

### NPay actual

판정: `primary subset`

- source: 운영DB `tb_iamweb_users` 중 NPay actual 조건.
- 의미: NPay 클릭이 아니라 실제 결제완료 NPay 주문이다.
- 사용처: 결제수단별 매출 분해.
- 금지: NPay click, count, add_payment_info를 구매완료로 승격하지 않는다.

### VM Cloud payment_success

판정: `cross-check`

- source: VM Cloud 고객 유입 장부와 결제완료 진단 장부.
- 의미: 실시간 유입/결제 진단에 강하다.
- 사용처: freshness, 유입 경로, 누락 탐지.
- 주의: 운영DB 매출 정본을 대체하지 않는다.

### GA4 purchase

판정: `reference_or_guard`

- source: GA4 이벤트.
- 의미: 사이트 이벤트 기준 purchase다.
- 사용처: 누락/중복 guard, trend 참고.
- 금지: GA4 purchase를 내부 actual 매출로 확정하지 않는다.

## 광고비 source map

### Google Ads

판정: `included_with_high_care`

- source: Google Ads API spend.
- 사용처: 광고비 분자.
- 분리 표시:
  - Google Ads platform ROAS: 광고 플랫폼이 주장하는 수익률.
  - 내부 confirmed ROAS: 실제 결제완료 주문 원장 기준 수익률.
- 주의: campaign_id가 없는 주문을 시간만 가까워서 특정 캠페인에 붙이지 않는다.
- 금지: Google Ads conversion upload는 이 리포트 범위가 아니다.

### Meta

판정: `candidate_included`

- source: Meta Ads Insights API 또는 VM Cloud ads summary.
- 사용처: 광고비 분자.
- 주의: Meta 플랫폼 주장 구매값은 내부 매출에 더하지 않는다.

### Naver

판정: `candidate_included_with_warning`

- source: Naver Search Ads API 또는 `naver_ads_daily` cache.
- 현재 근거: biocom cache는 더클린커피보다 준비도가 높다.
- 사용처: 광고비 분자.
- 남은 일: KST 주간·월간 window로 재산출하고 paid/organic 분류를 점검한다.

### TikTok

판정: `pending`

- source: TikTok Business API 또는 local cache.
- 남은 일: 바이오컴 캠페인 mapping과 freshness 확인.
- 금지: TikTok Events API 전송은 하지 않는다.

## 첫 no-send preview 설계

### Slack 메시지 뼈대

```text
[매출·광고비 리포트] 바이오컴 주간 YYYY-MM-DD - YYYY-MM-DD

매출: __원
광고비: __원
매출 대비 광고비: __%

매출 기준
- 내부 결제완료 매출: __원
- NPay actual: __원
- GA4 purchase 참고: __원

광고비
- Google Ads: __원
- Meta: __원
- Naver: __원
- TikTok: pending

주의
- Google Ads 플랫폼 ROAS와 내부 confirmed ROAS는 분리했습니다.
- NPay 클릭/결제시작은 구매완료로 세지 않았습니다.
- campaign_id 없는 주문을 시간만으로 캠페인에 붙이지 않았습니다.
```

### included / reference / pending 구분

| 구분 | 뜻 | Slack 표시 |
|---|---|---|
| included | 예산 판단 계산에 넣는 값 | 매출 또는 광고비 본문 |
| included_with_warning | 넣을 수 있지만 주의가 필요한 값 | 본문 + 주의 |
| reference | 참고만 보는 값 | 참고 줄 |
| pending | 아직 포함하면 안 되는 값 | pending 이유 |

## 첫 dry-run 성공 기준

1. 주간·월간 window가 KST 기준으로 일치한다.
2. 내부 결제완료 매출과 플랫폼 주장값이 분리된다.
3. Google Ads upload, GA4/Meta/TikTok/Naver 전송은 0건이다.
4. 운영DB write는 0건이다.
5. raw 주문·결제·고객·회원·클릭 식별자 출력은 0건이다.
6. campaign_id가 없는 주문을 time-window-only로 캠페인에 붙이지 않는다.

## 다음 조사 설계

### Phase1. 매출 분모 산출

- 무엇을 하는가: 운영DB 결제완료 기준으로 주간·월간 바이오컴 매출을 산출한다.
- 왜 하는가: 광고비 비중의 분모를 먼저 안정화해야 한다.
- 어떻게 하는가: read-only aggregate로 결제완료 상태와 결제수단을 분리한다.
- 성공 기준: 전체 매출, NPay actual, 기타 결제수단이 분리된다.
- 승인 필요 여부: NO for read-only.
- 추천 점수/자신감: 88%.

### Phase2. 광고비 분자 산출

- 무엇을 하는가: Google, Meta, Naver, TikTok 광고비를 같은 기간으로 자른다.
- 왜 하는가: 매출과 광고비 window가 다르면 비중이 틀어진다.
- 어떻게 하는가: 플랫폼별 API/캐시를 read-only로 조회한다.
- 성공 기준: 플랫폼별 spend와 freshness가 나온다.
- 승인 필요 여부: NO for read-only.
- 추천 점수/자신감: 84%.

### Phase3. 첫 no-send preview 생성

- 무엇을 하는가: Slack으로 보낼 바이오컴 메시지를 파일로 만든다.
- 왜 하는가: 실제 발송 전에 숫자와 문구를 검증해야 한다.
- 어떻게 하는가: 더클린커피 v0.1 메시지 구조를 복사하되, Google Ads와 내부 confirmed 값을 분리한다.
- 성공 기준: 매출, 광고비, 광고비 비중, source warning이 들어간다.
- 승인 필요 여부: NO for preview, YES for actual Slack send.
- 추천 점수/자신감: 82%.

## Track 진척률

이번 문서는 report project 기준이다.

| Track | 이름 | 이전 | 현재 | 증감 |
|---|---|---:|---:|---:|
| A | 정본 문서/source rule 정렬 | 65% | 68% | +3% |
| B | 더클린커피 매출 source 확인 | 96% | 96% | +0% |
| C | 더클린커피 광고비 source 확인 | 63% | 68% | +5% |
| D | 바이오컴 리포트 source map | 23% | 35% | +12% |
| E | Slack no-send 메시지 설계 | 94% | 95% | +1% |
| F | 자동화/배포 readiness | 81% | 85% | +4% |

## Guardrails

- Slack send: 0.
- 운영DB write: 0.
- VM Cloud write/deploy/restart: 0.
- Google Ads/GA4/Meta/TikTok/Naver 전송: 0.
- GTM publish: 0.
- raw 식별자 출력: 0.
