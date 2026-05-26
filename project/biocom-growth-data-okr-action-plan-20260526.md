작성 시각: 2026-05-26 01:09 KST
기준일: 2026-05-26
문서 성격: 바이오컴 Growth Data / ROAS / Attribution OKR와 KR 진도 가속 액션플랜
담당: Codex
상위 문서: [[reportbiocom]], [[reportbiocom-source-map-20260523]], [[!metaplan]]
관련 문서: [[meta-placeholder-date-comparison-20260526]], [[growth-team-iiari-utm-check-message-20260526]], [[meta-original-landing-bridge-vm-deploy-and-placeholder-diagnostic-20260526]]

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
    - report/reportbiocom.md
    - report/report-v0.1-readiness-and-next-impact-plan-20260523.md
    - meta/!metaplan.md
  lane: Green
  allowed_actions:
    - OKR/action plan document
    - read-only source review
    - investigation/design proposal
    - no-send roadmap
  forbidden_actions:
    - operating DB write
    - VM Cloud SQLite write/deploy
    - Meta/Google/Naver/TikTok platform send
    - GTM publish
    - Slack send
    - raw identifier output
  source_window_freshness_confidence:
    source: existing report/meta docs + VM Cloud read-only Meta bridge result
    window: planning state as of 2026-05-26 KST, Meta /iiary02 bridge 2026-05-18~2026-05-25 KST
    site: biocom
    freshness: 2026-05-26 01:09 KST planning snapshot
    confidence: medium_high for current KR status, medium for progress percentages because 일부는 설계 추정
```

## 10초 요약

바이오컴 프로젝트의 큰 목표는 “광고 플랫폼이 보여주는 ROAS”를 그대로 믿는 것이 아니라, 실제 결제완료 매출 기준으로 예산을 판단할 수 있는 주간·월간 운영 리포트를 만드는 것이다.

Meta UTM 문제는 이 목표의 한 조각이다. 지금은 `/iiary02`처럼 실제 매출은 잡히는데 캠페인·광고세트·광고 단위 확정 근거가 일부 부족한 문제가 있고, Google/Naver/TikTok도 각자 광고비 source와 내부 매출 source가 다르다.

KR 진도를 가장 빨리 빼는 방법은 국소 버그를 하나씩 고치는 것이 아니라, `매출 정본`, `광고비 정본`, `클릭-주문 연결 증거`, `보고서/Slack no-send`, `증분효과 측정`을 한 줄 파이프라인으로 닫는 것이다.

## OKR

OKR은 목표와 핵심 결과다. 목표는 “무엇을 이루려는지”이고, 핵심 결과는 “숫자로 성공을 판단하는 기준”이다.

### Objective 1. 바이오컴 주간·월간 매출과 광고비를 한 화면에서 믿고 판단한다

- KR1. 내부 confirmed 매출은 실제 결제완료 주문 기준으로 주간·월간 합계를 낸다.
- KR2. Meta, Google, Naver, TikTok 광고비는 같은 KST window로 맞추고 source/freshness를 붙인다.
- KR3. 플랫폼 주장 구매값과 내부 결제완료 매출을 분리해서 표시한다.
- KR4. 광고비 비중은 `포함 가능한 광고비 / 내부 confirmed 매출`로 계산한다.
- KR5. raw 주문·결제·고객·클릭 식별자는 보고서에 0건 노출한다.

현재 판정: 58%.

사람 말로 풀면, 매출과 광고비를 한 화면에 놓는 구조는 보이지만 아직 플랫폼별 source가 모두 같은 신뢰도로 닫히지 않았다.

### Objective 2. Meta ROAS를 campaign/adset/ad 단위로 예산 판단에 쓸 수 있게 만든다

- KR1. 주문/결제 원장에 남은 숫자 Meta ID는 A급으로 자동 분리한다.
- KR2. 고유 alias나 그로스팀 제공 ID는 B급 제안 또는 수동 확정으로 관리한다.
- KR3. placeholder, fbclid only, 비광고 IG 유입은 D급 또는 별도 채널로 격리한다.
- KR4. 그로스팀이 Ads Manager에서 확인한 URL/ID는 매핑 사전에 반영한다.
- KR5. 기존 학습이 안정된 광고는 즉시 URL 수정하지 않고, 신규·수정 대상부터 표준 UTM을 적용한다.

현재 판정: 72%.

사람 말로 풀면, Meta는 이미 A/B/C/D 분류 체계와 프론트 보고서가 생겼다. 남은 핵심은 그로스팀 확인값을 흡수해 D급과 B급을 줄이는 일이다.

### Objective 3. “광고 덕분에 늘어난 매출”을 구분할 수 있게 만든다

- KR1. 인플루언서 공동구매 기간과 광고 집행 기간을 같은 캘린더에 올린다.
- KR2. 공동구매 인플루언서 소재 광고의 직접 ROAS와 증분ROAS를 분리한다.
- KR3. 기존 구매 의향이 있던 고객이 광고 클릭으로 잡히는 현상을 별도 보정한다.
- KR4. 환불, 재구매, 상담/검사 이후 매출까지 LTV 후보로 추적한다.
- KR5. 신규 랜딩/신규 데이터 세트는 내부 confirmed 매출과 함께 24~72시간 단위로 검증한다.

현재 판정: 28%.

사람 말로 풀면, 직접 ROAS는 일부 보이지만 “어차피 살 사람까지 광고 성과로 잡힌 것인지”를 판단하는 증분 측정은 아직 설계 단계다.

### Objective 4. 운영자가 30초 안에 읽고 행동할 수 있는 no-send 리포트를 만든다

- KR1. 바이오컴 주간/월간 no-send 리포트에 매출, 광고비, 광고비 비중, 플랫폼별 경고가 보인다.
- KR2. Meta UTM 진단 화면은 매칭 근거와 그로스팀 액션을 사람이 이해하는 말로 표시한다.
- KR3. Slack 실제 발송은 승인 전까지 0건이고, no-send preview만 만든다.
- KR4. 실패 시 “데이터 없음”, “source 다름”, “sync 지연”, “권한 부족”, “verification gap”을 분리해 보여준다.
- KR5. 보고서와 승인 문서는 source/window/freshness/confidence를 항상 남긴다.

현재 판정: 47%.

사람 말로 풀면, 내부 화면은 늘고 있지만 바이오컴 전용 주간/월간 no-send 메시지는 아직 더클린커피만큼 닫히지 않았다.

## KR 진도표

| KR | 현재 진도 | 가장 큰 병목 | 다음에 진도 오르는 작업 |
|---|---:|---|---|
| O1-KR1 내부 confirmed 매출 | 72% | 운영DB/VM Cloud/Imweb 기준 혼선 | 바이오컴 주간·월간 매출 source map을 최신화 |
| O1-KR2 광고비 source | 60% | 플랫폼별 source/freshness 다름 | Meta/Naver/Google/TikTok spend read-only를 같은 KST window로 정렬 |
| O1-KR3 플랫폼값/내부값 분리 | 82% | 보고서마다 용어가 다름 | 보고서 공통 문구와 카드 구조 통일 |
| O1-KR4 광고비 비중 | 42% | 포함 가능한 광고비 분자가 불완전 | included/pending/zero 후보를 플랫폼별로 고정 |
| O2-KR1 Meta A급 자동 분리 | 78% | `meta_*`와 `utm_*` 근거 표현 혼선 | 프론트 보고서에서 `meta_* 숫자 ID`를 A급 근거로 표시 |
| O2-KR2 B급 제안 사전 | 68% | UTM 파일 후보가 자동확정으로 오해될 위험 | B급 proposal-only 사전 유지와 그로스팀 확인값 반영 |
| O2-KR3 D급 격리 | 75% | 일부 D급 원인 미확정 | D급 날짜/시간/경로 진단을 보고서에 표시 |
| O2-KR4 그로스팀 확인값 반영 | 72% | D급 16건은 여전히 숫자 ID 없음 | 이아리 종대사/음과검 소재 구분을 보고서와 매핑 기준에 반영 |
| O3-KR1 공동구매 일정 캘린더 | 20% | 인플루언서 일정 데이터 미수집 | 공동구매 일정·소재·광고세트 입력 양식 설계 |
| O3-KR2 증분ROAS | 18% | holdout 또는 기준선 없음 | baseline/diff-in-diff 설계와 최소 샘플 기준 작성 |
| O4-KR1 바이오컴 no-send 리포트 | 35% | 매출/광고비 source를 한 메시지로 묶지 못함 | reportbiocom no-send preview 생성 |
| O4-KR2 Meta UTM 화면 | 80% | 일부 문구가 기술자 중심 | 프론트 문구 보강과 smoke |

## Phase-Sprint 요약표 — 실제 개발 순서 기준

| Priority | Phase/Sprint | 무엇을 하는가 | 왜 하는가 | 어떻게 진행하는가 | 지금 상태 | 현재 진척률 % | 100% 조건 | 다음 단계 / 담당 | 승인 필요 여부 | Source 문서 |
|---:|---|---|---|---|---|---:|---|---|---|---|
| P0 | [[#Phase1-Sprint1]] | 바이오컴 매출/광고비 source map 최신화 | 예산 판단의 분모·분자가 흔들리면 전체 ROAS가 의미 없다 | 운영DB/VM Cloud/Meta/Naver/Google/TikTok source를 같은 KST window로 정렬한다 | 진행 중 | 58% | 주간/월간 매출과 광고비가 included/pending으로 분리된다 | Codex: no-send source audit | NO, Green | [[reportbiocom]] |
| P0 | [[#Phase1-Sprint2]] | Meta UTM 매칭 근거 화면 보강 | 그로스팀과 대표가 `utm_*`만 보고 UTM 없음으로 오해하면 안 된다 | 프론트에서 `meta_campaign_id/meta_adset_id/meta_ad_id`를 A급 근거로 설명한다 | 진행 중 | 80% | A급/D급 판단과 다음 액션이 화면에서 바로 읽힌다 | Codex: 로컬 패치/검증 | NO, Green | [[meta-placeholder-date-comparison-20260526]] |
| P1 | [[#Phase2-Sprint1]] | 그로스팀 확인값 흡수 루프 만들기 | Ads Manager 실제 설정값이 있어야 B/D급을 줄일 수 있다 | 메시지 초안, 회신 양식, CSV/import rule을 만든다 | 이아리 소재 구분 정정 반영 중 | 72% | 회신값이 매핑 사전에 반영되고 재계산된다 | Codex: 로컬 보고서 반영 / TJ님: 2차 활용 광고 여부 확인 | NO for doc, Yellow only if deploy | [[growth-team-iiari-utm-check-message-20260526]] |
| P1 | [[#Phase2-Sprint2]] | 바이오컴 no-send 주간 리포트 만들기 | 내부 confirmed 매출과 광고비 비중을 반복 보고해야 한다 | 더클린커피 v0.1 구조를 바이오컴 source map에 맞게 적용한다 | 설계 | 35% | raw 식별자 0, send 0, 주간/월간 메시지 생성 | Codex: preview 생성 | NO, Green | [[reportbiocom-source-map-20260523]] |
| P2 | [[#Phase3-Sprint1]] | 첫 유료 유입 보존 설계 | 결제 페이지에서 UTM이 사라져도 마지막 유료 유입을 잃지 않아야 한다 | firstPaidTouch를 checkout 전 고정 저장하고 confirmed 결제와 조인한다 | 설계 필요 | 38% | 주문 row에 firstPaidTouch evidence가 남는다 | Codex: no-write 설계/dry-run | NO for design, Yellow/Red for deploy/write | [[attribution-vm-evidence-join-contract-20260504]] |
| P2 | [[#Phase3-Sprint2]] | 인플루언서 iROAS 설계 | 공동구매 매출과 광고 덕분에 늘어난 매출을 분리해야 한다 | 일정표, 광고세트표, 기준선, holdout 또는 diff-in-diff 설계를 만든다 | 설계 필요 | 18% | 직접 ROAS와 증분ROAS가 별도 표시된다 | Codex: 설계안 / TJ님: 일정 제공 | NO for design | [[iroas]] |
| P3 | [[#Phase4-Sprint1]] | clean landing/data set 운영 판단 | Meta 제한 리스크를 줄이면서 기존 학습을 보존해야 한다 | 신규 랜딩/클린 이벤트 payload preview와 제한 광고세트 복제 기준을 만든다 | 방향 있음 | 45% | 제한/학습/내부 매출 기준으로 go/no-go 가능 | Codex: 승인안 / TJ님: 실행 승인 | Yellow/Red depending action | [[!metaplan]] |

## 상세 Sprint 설명 — 각 Sprint별 무엇/왜/어떻게/% 올리려면

### Phase1-Sprint1

**이름**: 바이오컴 매출/광고비 source map 최신화

- 무엇을 하는가: 바이오컴 주간·월간 내부 매출과 광고비 source를 같은 KST window로 맞춘다.
- 왜 하는가: 매출 분모와 광고비 분자가 따로 움직이면 ROAS와 광고비 비중이 모두 흔들린다.
- 어떻게 하는가: 운영DB, VM Cloud, Meta/Naver/Google/TikTok API 또는 cache를 read-only로 확인한다.
- 현재 진척률: 58%.
- 100% 조건: included/pending/zero 후보가 플랫폼별로 분리되고 source/freshness/confidence가 붙는다.

### Phase1-Sprint2

**이름**: Meta UTM 매칭 근거 화면 보강

- 무엇을 하는가: Meta UTM 진단 화면에서 A급 근거가 `utm_*`만이 아니라 `meta_*` 숫자 ID임을 보여준다.
- 왜 하는가: `utm_campaign`이 비어 있어도 `meta_campaign_id`가 숫자로 남으면 매칭 가능하다는 점을 오해하면 안 된다.
- 어떻게 하는가: 원본 랜딩 bridge 패널과 판단 기준 문구를 수정하고 로컬에서 검증한다.
- 현재 진척률: 80%.
- 100% 조건: 화면에서 A급/D급 차이와 그로스팀 다음 액션이 30초 안에 이해된다.

### Phase2-Sprint1

**이름**: 그로스팀 확인값 흡수 루프

- 무엇을 하는가: 그로스팀이 준 Ads Manager URL/ID 값을 내부 매핑 사전에 반영한다.
- 왜 하는가: 내부 원장만으로 D급을 임의 배정하면 ROAS가 오염된다.
- 어떻게 하는가: 확인 메시지, 회신 양식, B급 proposal-only 사전, 수동 확정 rule을 연결한다.
- 현재 진척률: 52%.
- 100% 조건: 회신값이 재계산 화면에 반영되고 D급/미매핑이 감소한다.

### Phase2-Sprint2

**이름**: 바이오컴 no-send 주간 리포트

- 무엇을 하는가: 바이오컴 주간·월간 매출, 광고비, 광고비 비중을 실제 발송 없이 생성한다.
- 왜 하는가: 대표/운영자가 반복해서 볼 최종 산출물은 코드가 아니라 리포트다.
- 어떻게 하는가: 더클린커피 v0.1 구조를 참고하되 바이오컴 source map에 맞춰 재구성한다.
- 현재 진척률: 35%.
- 100% 조건: raw 식별자 0, send 0, 매출/광고비/비중/source warning 포함.

### Phase3-Sprint1

**이름**: 첫 유료 유입 보존 설계

- 무엇을 하는가: 결제 페이지로 넘어가기 전 마지막 유료 광고 근거를 서버 원장에 고정하는 설계를 만든다.
- 왜 하는가: 결제 완료 시점에는 UTM과 click id가 사라질 수 있다.
- 어떻게 하는가: landing, paid-click-intent, checkout, payment_success를 read-only dry-run으로 이어 본다.
- 현재 진척률: 38%.
- 100% 조건: 주문 row에 firstPaidTouch 또는 lastPaidBeforeCheckout evidence가 안정적으로 붙는다.

### Phase3-Sprint2

**이름**: 인플루언서 iROAS 설계

- 무엇을 하는가: 공동구매 일정과 인플루언서 소재 광고를 묶어 직접 ROAS와 증분ROAS를 분리한다.
- 왜 하는가: 이미 살 고객이 광고를 클릭한 매출까지 광고 성과로 보면 과대 평가된다.
- 어떻게 하는가: 일정표, 광고세트표, 기준선, holdout 가능성을 설계한다.
- 현재 진척률: 18%.
- 100% 조건: TJ님이 일정과 광고세트 정보를 주면 직접 ROAS와 증분ROAS를 분리 계산할 수 있다.

### Phase4-Sprint1

**이름**: clean landing/data set 운영 판단

- 무엇을 하는가: Meta 제한 리스크를 줄이는 신규 랜딩/클린 이벤트/데이터 세트 병행 기준을 만든다.
- 왜 하는가: 플랫폼 최적화 신호는 살리되 민감 데이터 전송과 계정 제한 리스크는 줄여야 한다.
- 어떻게 하는가: payload preview, 제한 광고세트 복제 기준, 기존 픽셀 병행 기준을 승인안으로 만든다.
- 현재 진척률: 45%.
- 100% 조건: 제한/학습/내부 매출 기준으로 go/no-go 결정이 가능하다.

## KR 진도를 빨리 빼는 조사·설계안

### 1. Source Completeness Audit

무엇을 하는가: 바이오컴 주간·월간 기준으로 매출 source와 광고비 source를 한 표로 닫는다.

왜 하는가: 지금은 Meta, Google, Naver, TikTok, 운영DB, VM Cloud 숫자가 각각 살아 있다. 하나씩 고치면 계속 새 gap이 생긴다.

어떻게 하는가:

1. 최근 7일, 최근 30일, 월초~기준일 3개 window를 고정한다.
2. 매출은 내부 confirmed 매출, 플랫폼 주장 매출, UTM/marker 매출을 분리한다.
3. 광고비는 included, included_with_warning, pending, zero_candidate, inactive_zero로 나눈다.
4. 모든 숫자에 source/freshness/confidence를 붙인다.

예상 진도 상승:

- O1-KR1 +10%
- O1-KR2 +15%
- O1-KR4 +20%

### 2. Meta Mapping Reduction Sprint

무엇을 하는가: Meta 미매핑과 D급 placeholder를 줄인다.

왜 하는가: Meta는 지출이 크고, 내부 기준 ROAS 의사결정에 바로 영향을 준다.

어떻게 하는가:

1. A급은 `meta_campaign_id/meta_adset_id/meta_ad_id` 숫자 ID를 primary 근거로 고정한다.
2. B급은 UTM 파일 후보와 그로스팀 제공 ID를 proposal-only로 둔다.
3. D급은 날짜/시간/랜딩/결제 단계만 보여주고 자동 배정하지 않는다.
4. 그로스팀 회신 CSV를 받으면 매핑 사전으로 변환한다.

예상 진도 상승:

- O2-KR1 +8%
- O2-KR2 +12%
- O2-KR4 +20%

### 3. First Paid Touch Bridge 설계

무엇을 하는가: 고객이 결제 페이지로 넘어가기 전 마지막 유료 광고 유입을 서버 원장에 고정한다.

왜 하는가: 결제 완료 URL에는 UTM이 사라질 수 있다. 결제 완료 시점만 보면 늦다.

어떻게 하는가:

1. landing 또는 paid-click-intent 시점에 `fbclid/gclid/ttclid/utm/meta_*`를 hash/raw 정책에 맞게 저장한다.
2. checkout 시작 시점에 같은 브라우저/session/order 후보와 묶는다.
3. payment_success confirmed가 오면 가장 가까운 유료 evidence를 `firstPaidTouch` 또는 `lastPaidBeforeCheckout`으로 붙인다.
4. write 전에는 read-only dry-run으로 매칭률과 오염률을 본다.

예상 진도 상승:

- O2-KR3 +10%
- O3-KR3 +15%
- O4-KR4 +10%

주의: VM Cloud schema/data write나 운영 반영은 Yellow/Red 승인이 필요하다. 지금은 설계와 dry-run까지만 Green이다.

### 4. Influencer iROAS Measurement Design

무엇을 하는가: 인플루언서 공동구매와 같은 기간의 Meta 광고가 만든 “추가 매출”을 추정한다.

왜 하는가: 인플루언서가 이미 수요를 만든 고객이 광고를 클릭하면 직접 ROAS가 과대 평가될 수 있다.

어떻게 하는가:

1. 공동구매 일정, 인플루언서명, 랜딩 path, 광고세트/ad ID, 소재명, 예산을 일정표로 만든다.
2. 같은 상품군의 광고 미집행 기간 또는 다른 인플루언서 비집행 기간을 기준선으로 둔다.
3. 직접 ROAS는 현재 방식대로 계산한다.
4. 증분ROAS는 기준선 대비 증가분, 신규 고객 비율, 재구매/기존 고객 비중을 분리해서 계산한다.
5. 가능하면 future test에서는 audience exclusion 또는 지역/시간 holdout을 설계한다.

예상 진도 상승:

- O3-KR1 +25%
- O3-KR2 +30%
- O3-KR3 +20%

### 5. Biocom no-send Report v0.1

무엇을 하는가: 바이오컴 주간·월간 no-send 리포트를 만든다.

왜 하는가: OKR의 최종 사용자는 코드가 아니라 대표/운영자가 보는 반복 보고서다.

어떻게 하는가:

1. 더클린커피 v0.1 구조를 복사하지 않고, 바이오컴 source map 기준으로 재구성한다.
2. 첫 화면에는 내부 매출, 포함 광고비, 광고비 비중, 플랫폼별 warning만 둔다.
3. Meta/Google/Naver/TikTok은 각각 `플랫폼 주장값`과 `내부 confirmed 값`을 분리한다.
4. 실제 Slack send는 0으로 유지한다.

예상 진도 상승:

- O1 전체 +12%
- O4-KR1 +35%
- O4-KR3 +20%

## 다음 할일 — Auto Green / Approval Needed / Blocked-Parked

### Auto Green

#### A1. 바이오컴 Source Completeness Audit

- 무엇을 하는가: 최근 7일/30일/월초~기준일 기준으로 매출과 광고비 source를 한 번에 점검한다.
- 왜 하는가: KR 진도를 가장 크게 올리는 병목이 source completeness다.
- 어떻게 하는가: VM Cloud/운영DB/API/cache를 read-only로 조회하고 included/pending/zero 후보로 나눈다.
- 성공 기준: reportbiocom no-send preview에 들어갈 분모/분자 후보가 확정된다.
- 실패 시 다음 확인점: 접근 권한, API freshness, 계정/site mapping, sync 지연을 분리한다.
- 승인 필요 여부: NO, Green read-only.
- 의존성: 기존 API/cache 접근.
- 추천 점수/자신감: 92%.

#### A2. Meta UTM 화면 문구 보강

- 무엇을 하는가: `meta_* 숫자 ID`가 A급 근거라는 설명을 프론트 화면에 넣는다.
- 왜 하는가: `utm_campaign`이 비어 있어도 `meta_campaign_id`가 숫자면 A급 매칭 재료라는 점을 오해하지 않게 한다.
- 어떻게 하는가: `/ads/meta-utm`의 원본 랜딩 bridge 패널과 판단 기준 문구를 수정한다.
- 성공 기준: 화면에서 A급 132건과 D급 16건의 차이를 사람이 바로 이해한다.
- 승인 필요 여부: NO for local patch. VM Cloud 배포는 별도 Yellow.
- 의존성: 없음.
- 추천 점수/자신감: 88%.

#### A3. iROAS 설계안 작성

- 무엇을 하는가: 인플루언서 공동구매 일정과 Meta 광고세트를 연결하는 입력 양식과 계산 기준을 만든다.
- 왜 하는가: 직접 ROAS만 보면 공동구매가 만든 기존 수요까지 광고 성과로 잡힐 수 있다.
- 어떻게 하는가: 일정표, 기준선, holdout 가능성, 신규/기존 고객 구분 rule을 문서화한다.
- 성공 기준: TJ님이 공동구매 일정과 광고세트 정보를 주면 직접 ROAS와 증분ROAS를 분리 계산할 수 있다.
- 승인 필요 여부: NO for design.
- 의존성: 일정 데이터는 나중에 TJ님 제공 필요.
- 추천 점수/자신감: 83%.

### Approval Needed

#### Y1. VM Cloud 배포 또는 원장 write

- 무엇을 하는가: 로컬에서 검증한 화면/백엔드 변경을 VM Cloud에 반영하거나, firstPaidTouch 저장 구조를 운영 원장에 붙인다.
- 왜 필요한가: 로컬에서만 보이면 운영 리포트와 팀 공유 화면에 반영되지 않는다.
- 어떻게 하는가: 배포 승인 문서 작성 후 백업, 파일 단위 배포, typecheck/build, pm2 restart, smoke를 수행한다.
- 성공 기준: `https://biocom.ainativeos.net/ads/meta-utm`에서 새 문구와 숫자가 보인다.
- 실패 시 다음 확인점: backend 7020 health, frontend build, API response, CORS, cache.
- 승인 필요 여부: YES, Yellow for deploy. DB write/schema는 Red.
- Codex가 대신 못 하는 이유: 운영 서버 restart/write는 TJ님 승인선이다.
- 추천 점수/자신감: 76%.

### Blocked/Parked

#### P1. 실제 Slack 발송

- 무엇을 하는가: 주간/월간 리포트를 Slack에 자동 발송한다.
- 왜 보류인가: 아직 바이오컴 no-send preview와 채널/주기 승인이 닫히지 않았다.
- 어떻게 풀 것인가: no-send preview를 먼저 만들고 TJ님이 채널과 주기를 승인한다.
- 성공 기준: 발송 전 raw 식별자 0, send 0 preview가 통과한다.
- 승인 필요 여부: YES.
- 추천 점수/자신감: 45%.

## 하지 않은 것

- 운영DB write/import: 0
- VM Cloud SQLite write/deploy: 0
- Meta/Google/Naver/TikTok platform send: 0
- GTM publish: 0
- Slack send: 0
- raw 식별자 출력: 0

## Auditor verdict

PASS_WITH_NOTES.

이 문서는 현재 진행 상황을 OKR과 KR 진도 관점으로 재정리한 Green Lane 계획이다. 숫자별 진도율은 일부 설계 추정이 포함되어 있으므로, 다음 Source Completeness Audit에서 조정해야 한다.
