# report v0.1 readiness and next impact plan 20260523

작성 시각: 2026-05-23 17:26 KST
기준일: 2026-05-23
문서 성격: 바이오컴·더클린커피 매출액/광고비 비중 리포트 다음 단계 임팩트 계획
담당: Codex
상위 문서: [[!report]]
관련 문서: [[reportcoffee]], [[reportbiocom]], [[reportcoffee-slack-preview-20260522]], [[reportcoffee-v0.1-readiness-20260523]], [[report-ad-spend-source-gap-plan-20260523]], [[reportbiocom-source-map-20260523]]

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
    - report/!report.md
    - report/reportcoffee.md
    - report/reportbiocom.md
    - report/reportcoffee-slack-preview-20260522.md
  lane: Green
  allowed_actions:
    - canonical_document_review
    - local_report_design
    - no_send_slack_readiness_plan
    - source_gap_planning
  forbidden_actions:
    - slack_send
    - operating_db_write
    - vm_cloud_write_or_deploy
    - platform_send_or_upload
    - gtm_publish
    - raw_identifier_output
  source_window_freshness_confidence:
    source: existing report markdown/json outputs + VM Cloud read-only evidence docs + operational DB aggregate docs
    window: weekly 2026-05-15 - 2026-05-21 KST, rolling_30d 2026-04-22 - 2026-05-21 KST
    freshness: latest local report outputs through 2026-05-22 20:35 KST, reviewed 2026-05-23 12:45 KST
    confidence: medium_high for coffee v0.1 preview readiness, medium for biocom first preview readiness
```

## 10초 요약

이 프로젝트의 다음 임팩트는 “숫자를 더 많이 모으는 것”이 아니라 “Slack 보고를 예산 판단에 바로 쓸 수 있게 만드는 것”이다.

더클린커피는 주간·rolling 30d 기준으로 매출, Meta 광고비, Naver 0원 후보, 스마트스토어 TOP 상품까지 붙어 no-send preview가 가능한 상태다. 남은 핵심은 실제 Slack 발송 승인 전 `included`, `included_with_warning`, `pending`을 메시지 안에서 더 선명하게 나누는 일이다.

바이오컴은 더클린커피 틀을 그대로 복사하면 안 된다. 바이오컴은 Google Ads(구글 광고), Meta(페이스북·인스타 광고), Naver, TikTok 광고비와 내부 결제완료 매출의 기준이 다르므로 첫 단계는 source map(숫자가 어느 원천에서 나왔는지 정리한 지도)을 만드는 것이다.

## 프로젝트 OKR

OKR은 목표와 핵심 결과다. 목표는 “무엇을 이루려는지”이고, 핵심 결과는 “성공을 숫자로 판단하는 기준”이다.

### Objective 1. 매주·매월 매출과 광고비 비중을 한 번에 판단한다

- KR1. 더클린커피와 바이오컴 각각 주간·월간 매출 합계를 만든다.
- KR2. 매출은 내부 결제완료 기준으로 세고, 광고 플랫폼이 주장하는 구매값은 참고로 분리한다.
- KR3. 광고비 비중은 `포함 가능한 광고비 / 내부 매출 * 100`으로 고정한다.
- KR4. 모든 숫자에 source, window, freshness, confidence를 붙인다.

### Objective 2. Slack 보고를 “읽고 바로 행동할 수 있는 메시지”로 만든다

- KR1. 메시지 첫 화면에 매출, 광고비, 매출 대비 광고비 %가 보인다.
- KR2. 채널별 매출 옆에 잘 팔린 상품 TOP3를 붙인다.
- KR3. 광고비는 Meta, Naver, Google, TikTok을 분리하고 pending 이유를 짧게 보여준다.
- KR4. 실제 Slack 전송은 승인 전 0건이다.

### Objective 3. 예산 판단을 오염시키는 숫자를 막는다

- KR1. NPay 클릭, 결제 시작, 장바구니 신호를 구매완료로 승격하지 않는다.
- KR2. Naver/Google/TikTok 캠페인 중 사이트가 불명확한 광고비는 포함하지 않는다.
- KR3. raw 주문·결제·고객·클릭 식별자는 보고서와 Slack 문구에 출력하지 않는다.
- KR4. 운영DB write, VM Cloud deploy, 광고 플랫폼 전송은 승인 전 0건이다.

## 지금 가능한 것

### 더클린커피

- 주간 strict 매출: 16,913,442원.
- 주간 포함 광고비: 1,952,104원.
- 주간 매출 대비 광고비: 11.54%.
- rolling 30d strict 매출: 60,511,234원.
- rolling 30d 포함 광고비: 3,966,919원.
- rolling 30d 매출 대비 광고비: 6.56%.
- 스마트스토어 TOP 상품: 운영DB PlayAuto(여러 판매 채널 주문을 모은 운영DB 수집 원천) 기준으로 붙일 수 있다.
- 쿠팡: TeamKeto ordersheets(쿠팡 주문서 API, 주문서에서 상품명·수량·금액을 읽는 공식 통로) 기준으로 coffee 상품과 teamketo 상품을 분리할 수 있다.
- Naver Ads(네이버 검색광고): VM Cloud에서 read-only 조회가 됐고 더클린커피 후보 캠페인 6개는 모두 PAUSED, 30일 지출 0원 후보다.

### 바이오컴

- 매출 정본은 운영DB `tb_iamweb_users PAYMENT_COMPLETE`가 우선이다.
- 광고비는 Google Ads, Meta, Naver, TikTok별로 source가 다르다.
- Google Ads 플랫폼 ROAS(광고 플랫폼이 주장하는 수익률)는 내부 confirmed ROAS(실제 결제완료 원장 기준 수익률)와 계속 분리해야 한다.
- 첫 목표는 no-send preview 전 source map을 만드는 것이다.

## 왜 이 순서가 맞는가

1. 더클린커피는 이미 매출 분모가 거의 닫혔다.
   지금 바로 큰 임팩트가 나는 일은 실제 Slack 발송 전 preview를 승인 가능한 문구로 다듬는 것이다.

2. 광고비 전체성을 높이면 예산 판단력이 올라간다.
   Meta만 포함하면 광고비 비중이 과소 계산될 수 있다. Naver는 0원 후보, Google은 0원 확인 후보, TikTok은 현재 광고 미운영 0원으로 분리됐다. 남은 일은 Google 유입 증거 3건을 광고비 0원 후보와 섞이지 않게 warning으로 관리하는 것이다.

3. 바이오컴은 기존 ROAS 정합성 작업이 깊어 섞이면 위험하다.
   그래서 더클린커피처럼 단순히 “채널 매출 + 광고비”로 끝내지 말고, 플랫폼 주장값과 내부 결제완료값을 분리한 source map부터 만든다.

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

## 다음 임팩트 우선순위

### P0. 더클린커피 v0.1 Slack 승인안

무엇을 하는가: 현재 no-send preview를 실제 발송 승인 직전 문구로 만든다.

왜 하는가: 지금 이미 주간/rolling 30d 매출과 Meta 광고비가 붙어 있으므로 가장 빠르게 운영 의사결정에 쓸 수 있다.

어떻게 하는가: 포함값, 경고 포함값, 보류값을 메시지에 나눠 쓰고 실제 Slack send는 승인 전 0건으로 유지한다.

성공 기준: TJ님이 채널과 주기만 정하면 실제 발송 여부를 YES/NO로 판단할 수 있다.

추천 점수/자신감: 92%.

### P1. 광고비 source gap 축소

무엇을 하는가: Naver 0원 후보, Google 0원 확인 후보, TikTok 현재 광고 미운영 0원을 Slack 보고에 분리 표시한다.

왜 하는가: 광고비가 빠지면 매출 대비 광고비 %가 실제보다 낮게 보인다.

어떻게 하는가: 광고 계정 전체 금액을 그대로 쓰지 않고 campaign name, landing URL, 계정 범위로 included/pending/zero candidate를 나눈다.

성공 기준: Meta/Naver/Google/TikTok 각각 `included`, `included_with_warning`, `zero_candidate`, `inactive_zero` 중 하나로 설명된다.

추천 점수/자신감: 86%.

### P2. 바이오컴 첫 no-send preview 준비

무엇을 하는가: 바이오컴도 같은 Slack 보고 틀로 매출, 광고비, 광고비 비중을 만든다.

왜 하는가: 더클린커피만 닫으면 프로젝트 전체 OKR의 절반만 달성된다.

어떻게 하는가: 운영DB 결제완료 매출, Google/Meta/Naver/TikTok 광고비 source를 분리하고 플랫폼 주장값은 참고로 표시한다.

성공 기준: 바이오컴 주간/월간 no-send preview에 내부 매출과 플랫폼 주장값이 섞이지 않는다.

추천 점수/자신감: 82%.

### P3. 제품별 매출을 채널 전반으로 확장

무엇을 하는가: 스마트스토어와 쿠팡에 이어 자사몰 TOP 상품을 붙인다.

왜 하는가: 매출이 오르거나 내릴 때 어떤 상품 때문인지 봐야 광고 소재와 재고 판단이 가능하다.

어떻게 하는가: 자사몰은 Imweb order items(아임웹 주문 안 상품별 행)와 주문 총액을 맞춘다.

성공 기준: 자사몰 TOP 상품이 총매출을 초과하지 않고, 상품 라인 freshness가 표시된다.

추천 점수/자신감: 78%.

## Auto Green / Approval Needed / Blocked-Parked

### Auto Green

1. 더클린커피 v0.1 발송 승인안 초안 작성
   - 담당: Codex.
   - 산출물: Slack 실제 발송 승인 문서.
   - 승인 필요: 문서 작성은 NO, 실제 발송은 YES.
   - 의존성: 현재 no-send preview.

2. Google legacy click evidence 정리
   - 담당: Codex.
   - 산출물: Google spend 0원 후보와 방문 원장 Google click evidence 3건 분리표.
   - 승인 필요: read-only는 NO, 플랫폼 send는 금지.
   - 의존성: VM Cloud landing/read-only ledger 접근.

3. 바이오컴 source map 기반 no-send preview 설계
   - 담당: Codex.
   - 산출물: 바이오컴 주간·월간 preview 구조.
   - 승인 필요: NO.
   - 의존성: 운영DB/VM Cloud/API read-only source.

### Approval Needed

1. Slack 실제 발송 채널과 주기 결정
   - 담당: TJ님.
   - Codex가 대신 못 하는 이유: 어느 채널에 운영 보고를 받을지는 팀 운영 결정이다.
   - 성공 기준: 채널명과 주기, 예를 들어 매일 오전 OK 보고와 매주 월요일 주간 보고가 확정된다.
   - 승인 필요: YES.

2. Naver Ads cache write 승인
   - 담당: TJ님 승인, Codex 실행 가능.
   - Codex가 대신 못 하는 이유: DB 캐시 저장은 내부 보고 원장에 쓰는 작업이라 승인선이 필요하다.
   - 성공 기준: allowlist guard가 먼저 통과하고 `site=thecleancoffee` row만 저장된다.
   - 승인 필요: YES.

### Blocked/Parked

1. 실제 Slack send 자동화
   - 보류 이유: 발송 채널/주기 승인 전이다.
   - Green으로 줄인 것: no-send preview와 발송 승인안 준비.

2. 플랫폼 전환 전송
   - 보류 이유: 이 프로젝트는 매출·광고비 보고가 목표다. 광고 플랫폼에 구매 전환을 보내는 작업은 별도 Red Lane이다.
   - 현재 상태: send/upload 0 유지.

## Guardrails

- Slack send: 0.
- 운영DB write: 0.
- VM Cloud write/deploy/restart: 0.
- Google Ads/GA4/Meta/TikTok/Naver 전송: 0.
- GTM publish: 0.
- raw 고객·주문·결제·회원·클릭 식별자 출력: 0.
