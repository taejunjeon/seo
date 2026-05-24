# reportcoffee v0.1 readiness 20260523

작성 시각: 2026-05-23 17:26 KST
기준일: 2026-05-23
문서 성격: 더클린커피 Slack 주간·월간 보고 v0.1 준비도 판단
담당: Codex
상위 문서: [[reportcoffee]], [[!report]]
관련 문서: [[reportcoffee-slack-preview-20260522]], [[reportcoffee-smartstore-product-sales-20260522]], [[reportcoffee-naver-ads-campaign-allowlist-dry-run-20260522]], [[reportcoffee-google-ads-spend-mapping-20260523]], [[report-ad-spend-source-gap-plan-20260523]]

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
    - report/reportcoffee-slack-preview-20260522.md
    - report/reportcoffee-smartstore-product-sales-20260522.md
  lane: Green
  allowed_actions:
    - readiness_assessment
    - no_send_message_design
    - local_markdown_update
  forbidden_actions:
    - slack_send
    - operating_db_write
    - vm_cloud_write_or_deploy
    - platform_send_or_upload
    - gtm_publish
    - raw_identifier_output
  source_window_freshness_confidence:
    source: reportcoffee Slack preview JSON/Markdown + SmartStore product dry-run + Naver allowlist dry-run + Coupang TeamKeto aggregate docs
    window: weekly 2026-05-15 - 2026-05-21 KST, rolling_30d 2026-04-22 - 2026-05-21 KST
    freshness: report outputs generated through 2026-05-22 20:35 KST
    confidence: medium_high for no-send v0.1, medium for real send readiness until TJ channel/frequency approval
```

## 10초 요약

더클린커피 v0.1은 “실제 발송 전 미리보기” 기준으로 준비됐다.

주간 보고에는 매출 16,913,442원, 광고비 1,952,104원, 매출 대비 광고비 11.54%를 보여줄 수 있다. rolling 30d 보고에는 매출 60,511,234원, 광고비 3,966,919원, 매출 대비 광고비 6.56%를 보여줄 수 있다.

다만 이것은 실제 Slack 발송 완료가 아니다. Slack(업무용 메신저) 실제 전송은 외부 채널로 메시지를 보내는 일이므로 TJ님이 받을 채널과 주기를 승인해야 한다.

## v0.1 판정

판정: `NO-SEND PREVIEW READY`

사람 말로 풀면, 지금은 “보낼 문구와 숫자는 만들 수 있지만, 아직 실제 채널에는 보내지 않은 상태”다.

### 포함 가능한 값

| 영역 | 현재 값 | 판정 | 이유 |
|---|---:|---|---|
| 주간 strict 매출 | 16,913,442원 | included_with_warning | 자사몰, 스마트스토어, 쿠팡 coffee 상품까지 같은 KST window로 합산 |
| 주간 광고비 | 1,952,104원 | included | Meta spend만 포함 |
| 주간 광고비 비중 | 11.54% | included | 포함 광고비 / strict 매출 |
| rolling 30d strict 매출 | 60,511,234원 | included_with_warning | 자사몰, 스마트스토어, 쿠팡 coffee 상품까지 합산 |
| rolling 30d 광고비 | 3,966,919원 | included | Meta spend만 포함 |
| rolling 30d 광고비 비중 | 6.56% | included | 포함 광고비 / strict 매출 |

`strict 매출`은 더클린커피로 분류 가능한 금액만 합산한 매출이다. TeamKeto 쿠팡 계정 전체처럼 다른 상품군이 섞일 수 있는 금액은 참고값으로 분리한다.

## 채널별 준비도

### 자사몰

준비도: `included_with_warning`

- 주간: Toss 계열 9,611,622원 + NPay actual 3,693,400원 = 13,305,022원.
- rolling 30d: Toss 계열 31,444,064원 + NPay actual 15,538,800원 = 46,982,864원.
- NPay actual은 클릭이나 결제 시작이 아니라 실제 결제완료 후보 기준이다.
- NPay status blank 4건 / 141,600원은 미결제 단정이 아니라 freshness warning이다.

남은 일:

- 자사몰 TOP 상품은 Imweb order items(아임웹 주문 안 상품별 행) freshness를 확인한 뒤 붙인다.

### 스마트스토어

준비도: `included_with_warning`

- 주간: 2,563,520원.
- rolling 30d: 9,110,570원.
- source: 운영DB PlayAuto. PlayAuto는 여러 판매 채널 주문을 모아 둔 운영DB 수집 원천이다.
- 주간 TOP3:
  1. 더클린 진짜 방탄커피 840ml 10개: 464,600원 / 2개.
  2. 초신선 콜롬비아 스페셜티: 406,710원 / 13개.
  3. 초신선 에티오피아 구지 사키소 G1: 398,900원 / 11개.

남은 일:

- 정산 기준 확정 전까지 `included_with_warning`으로 둔다.

### 쿠팡

준비도: `included_with_warning`

- 주간 coffee 상품: 1,044,900원.
- 주간 TeamKeto 계정 전체 참고: 1,968,100원.
- rolling 30d coffee 상품: 4,417,800원.
- rolling 30d TeamKeto 계정 전체 참고: 7,264,500원.
- source: TeamKeto ordersheets. ordersheets는 쿠팡 주문서 API로 상품명, 수량, 금액을 읽는 공식 통로다.

남은 일:

- 쿠팡 TOP 상품을 Slack preview에 스마트스토어와 같은 형식으로 맞춘다.
- coffee/teamketo 분류에 빠지는 상품명이 있는지 월간 기준으로 점검한다.

## 광고비 준비도

### Meta

준비도: `included`

- 주간 광고비: 1,952,104원.
- rolling 30d 광고비: 3,966,919원.
- Meta 플랫폼 주장 구매값은 내부 매출에 더하지 않는다.

### Naver

준비도: `included_with_warning`

- Naver Ads API(네이버 광고 계정에서 광고비를 읽는 공식 연결 통로)는 VM Cloud에서 read-only 조회가 됐다.
- 더클린커피 후보 캠페인은 6개다.
- 후보 6개는 모두 PAUSED이고 2026-04-22 - 2026-05-21 기준 광고비 0원, 클릭 0회다.
- Slack에는 `Naver: 0원 확인 후보`로 표시할 수 있다.

남은 일:

- 광고비 수집 스크립트에 후보 6개만 통과시키는 안전장치를 붙인다.
- DB 캐시 저장은 별도 승인 전 금지다.

### Google / TikTok

준비도: `included_with_warning_zero_candidate`

- Google Ads는 VM Cloud read-only 조회 기준 최근 7일/30일 더클린커피 비용 row가 없다.
- Slack에는 `Google: 0원 확인 후보`로 표시한다.
- 단, 방문 원장에는 최근 7일 Google 클릭 ID 3건이 있어 유입 참고 warning을 유지한다.
- TikTok은 TJ님 확인 기준 현재 광고 미운영이므로 `TikTok: 0원 (현재 광고 미운영)`으로 표시한다.
- Google Ads conversion upload와 TikTok Events API 전송은 하지 않는다.

## v0.1 Slack 메시지 원칙

1. 첫 줄은 매출, 광고비, 광고비 비중이다.
2. 두 번째 묶음은 자사몰, 스마트스토어, 쿠팡 매출이다.
3. 세 번째 묶음은 광고비다.
4. 마지막 주의 문구에는 pending 이유를 짧게 넣는다.
5. raw 주문, 결제, 고객, 회원, 클릭 식별자는 넣지 않는다.

## 실제 발송 전 남은 조건

1. TJ님이 Slack 채널을 정한다.
   - 예: `growth-signal-bot` 또는 별도 보고 채널.
   - Codex가 대신 못 하는 이유: 어느 채널에 운영 보고를 받을지는 팀 운영 결정이다.

2. TJ님이 주기를 정한다.
   - 후보: 매일 오전 OK 보고, 매주 월요일 주간 보고, 매월 1일 월간 보고.
   - KST(한국 시간) 기준으로 고정해야 한다.

3. Codex가 발송 승인안을 만든다.
   - 문서 작성은 Green이다.
   - 실제 Slack send는 승인 전 금지다.

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

## 다음 할일

### Codex가 할 일

1. Slack 실제 발송 승인안을 만든다.
   - 무엇을: 받을 채널, 발송 주기, 실패 시 처리, 중지 방법을 문서화한다.
   - 왜: 실제 발송은 외부 전송이라 승인선이 필요하다.
   - 어떻게: 현재 no-send preview를 기준으로 승인안만 만들고 send는 하지 않는다.
   - 의존성: 없음.
   - 성공 기준: TJ님이 YES/NO로 승인할 수 있다.
   - 승인 필요 여부: 문서 작성은 NO, 실제 send는 YES.
   - 추천 점수/자신감: 90%.

2. Google legacy 클릭 3건의 campaign_id 연결 가능성을 조사한다.
   - 무엇을: Google 광고비는 0원 후보로 두되, 방문 원장의 Google click evidence 3건이 어떤 캠페인 힌트와 연결되는지 확인한다.
   - 왜: 광고비는 0원인데 유입 증거가 남아 있어 나중에 ROAS 해석이 섞일 수 있다.
   - 어떻게: raw 클릭 ID를 출력하지 않고 hash/count 기준으로 campaign_id 보존 여부만 확인한다.
   - 의존성: VM Cloud landing/read-only ledger 접근.
   - 성공 기준: `campaign_id 확인 가능 / legacy 보류 / source 부족` 중 하나로 분류된다.
   - 승인 필요 여부: read-only는 NO.
   - 추천 점수/자신감: 78%.

### TJ님이 할 일

1. Slack 채널과 주기를 정한다.
   - 무엇을: 보고를 받을 채널과 발송 시간을 정한다.
   - 왜: 실제 발송은 운영 커뮤니케이션이므로 받을 곳과 시간을 먼저 고정해야 한다.
   - 어떻게: 채널명과 주기를 Codex에게 알려준다. 예: 매일 오전 9시 OK 보고, 매주 월요일 오전 9시 주간 보고, 매월 1일 오전 9시 월간 보고.
   - 의존성: no-send preview 확인.
   - 성공 기준: 채널과 KST 발송 시간이 정해진다.
   - 실패 시 확인점: Slack 앱 권한과 채널 접근 권한을 확인한다.
   - Codex가 대신 못 하는 이유: 팀 운영 결정이며 실제 채널 선택 권한은 TJ님에게 있다.
   - 승인 필요 여부: YES.
   - 추천 점수/자신감: 88%.
