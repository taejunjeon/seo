# Palantir AIP 구조 참고 분석 - 선행지표 에이전트와 Growth Harness 적용안

작성 시각: 2026-05-25 17:45 KST
작성 범위: 문서 분석, 구조 제안, 적용 우선순위 정리
Lane: Green documentation (문서 작업만 수행 / 운영DB 변경 없음 / 배포 없음 / 외부 플랫폼 전송 없음)
대상 문서: `project/!indicatoragent.md`, `harness/!harness.md`, `docs/report/text-report-template.md`
추가 확인: `ontology/!ontology.md`, `ontology/attribution-ontology-schema-contract-20260506.md`
이미지 source: TJ님 첨부 Palantir AIP 구조도

## 한 줄 결론

- 결론: 우리 프로젝트에는 Palantir AIP 전체를 그대로 복제할 필요는 없지만, **온톨로지 중심의 AIP-lite 구조**는 바로 적용할 가치가 높다.
- Project: Leading Indicator Agent + Growth Data Agent Harness
- Lane: Green
- Mode: 문서 분석 / 구조 설계 / 실행 없음
- 검증 판정: PASS
- 현재 판정: AIP-lite는 진행 추천, 전체 플랫폼급 구축은 보류
- 자신감: 88%
- 기준 시각: 2026-05-25 17:45 KST

## 10초 요약

첨부 AIP 구조도의 핵심은 LLM을 잘 붙이는 것이 아니다.
핵심은 **데이터, 로직, 액션을 온톨로지로 통합하고, 그 위에서 에이전트 생명주기, 평가, 자동화, 보안, 배포를 운영하는 것**이다.

우리 프로젝트는 이미 하네스 문서, dry-run(운영 반영 전 검증 실행), 승인 게이트, 리포트, 외부 전송 방지 규칙이 있어 AIP의 40-50% 기반은 있다.
추가 확인 결과 `ontology/!ontology.md`에 `Attribution Ontology Lite`가 이미 있다.
따라서 부족한 것은 공통 온톨로지 자체가 아니라, 기존 광고/매출 온톨로지 위에 얹을 **선행지표/행동 분석 사전**, 도구 사용 안내서, 에이전트 실행 기록, 품질 판정 기준, 릴리즈 묶음이다.
다음 단계는 거대한 플랫폼 개발이 아니라 기존 `ontology/!ontology.md`를 정본으로 두고 `구매 전 행동 사전`과 `에이전트 실행 기록`을 문서/JSON으로 고정하는 것이다.

추가 검토 결과, 후속 개발로 **미니 디지털 트윈**은 가능하다.
다만 처음부터 정확한 매출 예측기를 만들기보다, 최근 기준선을 읽은 AI가 몇 가지 가능한 운영 시나리오를 자동 제안하고 예상 주문 수와 매출 범위를 보여주는 `what-if 시뮬레이터`로 시작하는 것이 안전하다.

## 완료한 것

| 항목 | 결과 | 근거/파일 | 데이터/DB 위치 |
|---|---|---|---|
| 선행지표 에이전트 문서 확인 | 완료 | `project/!indicatoragent.md` | 로컬 문서 |
| 하네스 정본 확인 | 완료 | `harness/!harness.md` | 로컬 문서 |
| 결과보고 템플릿 확인 | 완료 | `docs/report/text-report-template.md` | 로컬 문서 |
| 기존 ontology 확인 | 완료 | `ontology/!ontology.md`, `ontology/attribution-ontology-schema-contract-20260506.md` | 로컬 문서 |
| AIP 구조도 해석 | 완료 | TJ님 첨부 이미지 | 이미지 |
| 적용 우선순위 도출 | 완료 | 본 문서 | 로컬 문서 |

## 진척률 %

- 전체 적용 기준 진척률: 45%
- 이번 문서 분석 batch 기준 진척률: 100%
- 100%까지 남은 단계: 기존 Attribution Ontology에 선행지표 사전 추가, 도구 사용 안내서 작성, 품질 판정 기준 설계, 실행 기록 샘플 생성, indicator agent에 연결, 미니 디지털 트윈 시뮬레이터 설계
- 다음 병목: 이미 있는 결제/광고 귀속 온톨로지와 새 구매 전 행동/선행 신호 온톨로지의 경계를 명확히 나누는 것
- 사람이 이해할 수 있는 1문장 설명: 지금은 좋은 에이전트가 여러 개 생기는 단계이고, 다음은 그 에이전트들이 같은 세계관과 같은 검증 기준으로 움직이게 만드는 단계다.

## AIP 구조도에서 읽은 핵심 구성

첨부 이미지 기준 AIP는 아래 층으로 보인다.

| AIP 구성 | 쉬운 뜻 | 우리 프로젝트 대응 |
|---|---|---|
| Secure LLM Integration | LLM 연결, 호스팅, 접근 제어, moderation | Codex/Claude/GPT 사용 규칙, 비식별화, 외부 전송 방지 규칙 |
| End-to-end Observability | 모든 실행 추적과 결과 관측 | JSON result, Markdown report, Telegram, harness preflight |
| Context Engineering | 데이터, 로직, 액션을 모델이 쓸 수 있게 조립 | `CONTEXT_PACK`, `!indicatoragent`, source/window/freshness. 화면에서는 "분석에 필요한 문맥 묶음"으로 설명 |
| Ontology | 객체, 관계, 액션의 공통 세계관 | `ontology/!ontology.md`가 이미 있음. 화면에서는 "공통 데이터 사전"으로 설명 |
| Tool Services | 데이터/로직/액션 도구 연결 | scripts, BigQuery, VM Cloud API, GTM export, docs. 화면에서는 "도구 사용 안내서"로 설명 |
| Security & Governance | 역할, 목적, 승인, checkpoint | Green/Yellow/Red Lane, approval docs, raw ID 금지 |
| Agent Lifecycle | agent build, orchestration, evaluation | 현재 설계 단계. 화면에서는 "에이전트 실행 기록과 품질 판정"으로 설명 |
| Operational Automation | 정기 실행, 이벤트 기반 실행, API 자동화 | cron, VM Cloud, action queue 후보 |
| Development Environments | VS Code, Jupyter, MCP, IDE 확장 | Codex/Claude/ChatGPT + local scripts |
| Human+AI Applications | 사람이 보는 앱과 분석 화면 | `/ai-crm/leading-indicators`, `/conversion-funnel` 후보 |
| Package/Release/Deploy | 패키징, 의존성, 배포 채널 | 아직 약함. agent package 단위 필요 |
| Enterprise Automation / AI FDE | 현장형 AI 개발/운영 루프 | Codex/Claude가 이미 일부 수행. 표준 runbook 필요 |

## 우리에게 바로 도움 되는 7가지

### 1. 구매 전 행동 사전 추가

가장 먼저 적용할 것은 새 온톨로지를 만드는 것이 아니라, 기존 `Attribution Ontology Lite`를 확장하는 것이다.
`ontology/!ontology.md`는 이미 `Site`, `AdClick`, `ClickIdentifier`, `PaidClickIntent`, `ProductEngagementSummary`, `CheckoutIntent`, `ExternalPaymentIntent`, `PaymentCompleteOrder`, `InternalConfirmedRevenue`, `PlatformConversionClaim`, `ConfirmedPurchaseCandidate`, `GuardDecision`, `SourceFreshness`, `ChannelEvidence`, `ChannelAssignment`를 정의한다.

즉 이미 있는 정본은 attribution/revenue/payment/click guard에 강하다.
추가가 필요한 것은 구매 전 행동 분석을 위한 행동/신호 사전이다.

초기 온톨로지 항목 후보(object: 온톨로지 안에서 다루는 대상):

| Object | 상태 | 의미 | 예시 |
|---|---|---|---|
| `Site` | 기존 사용 | 사이트 단위 | biocom, thecleancoffee |
| `ChannelEvidence` | 기존 사용 | 유입 채널 증거 | fbclid, gclid, UTM |
| `ProductEngagementSummary` | 기존 사용 | 상품 몰입 요약 | visible_seconds, max_scroll_percent |
| `SourceFreshness` | 기존 사용 | source 최신성 | fresh, warn, stale |
| `BehaviorSession` | 추가 필요 | 한 방문에서 일어난 행동 묶음 | 같은 방문 안의 페이지 조회, 스크롤, 결제 진행 |
| `BehaviorEvent` | 추가 필요 | 구매 전에 일어난 개별 행동 | 스크롤, 체류, 장바구니, 결제 진행 |
| `Cohort` | 추가 필요 | 같은 기준으로 묶은 비교 집단 | Meta 구매자, 결제 시작 후 이탈자 |
| `Feature` | 추가 필요 | 행동을 숫자로 만든 값 | 체류시간 중앙값, 90% 스크롤 도달률 |
| `LeadingSignal` | 추가 필요 | 매출보다 먼저 움직이는 신호 후보 | 구매자 집단의 체류시간 상승 |
| `Experiment` | 추가 필요 | 실제로 바꿔볼 개선 실험 | 리뷰 랜딩 CTA 변경 |

초기 action 후보(action: 사람이 하거나 에이전트가 제안할 수 있는 행동):

- `read_source`
- `build_cohort`
- `compute_feature`
- `score_signal`
- `recommend_experiment`
- `write_report`
- `request_approval`
- `deploy_after_approval`
- `send_after_approval`

추천 파일:

```text
ontology/leading-indicator-ontology-extension-20260525.md
ontology/leading-indicator-ontology-schema-contract-20260525.md
harness/leading-indicator/TOOL_REGISTRY.md
harness/leading-indicator/EVAL_SUITE.md
```

### 2. 도구 사용 안내서

현재 script와 문서는 많지만, 어떤 도구가 읽기만 하는지, 어떤 도구가 운영 변경 위험이 있는지 한눈에 보이지 않는다.
AIP식 Tool Services를 우리 방식으로 만들려면 `도구 사용 안내서(tool registry: 각 도구가 무엇을 할 수 있고 무엇은 하면 안 되는지 적은 목록)`가 필요하다.

아래는 개발자가 실제 파일로 옮길 때 쓰는 결과 양식 예시다.
화면에는 이 값을 그대로 노출하지 않고, "읽기 전용", "운영 변경 금지", "외부 전송 금지"처럼 번역해서 보여준다.

```yaml
tool_id: leading_indicator_live_read
owner: Codex
lane: Green
source: VM Cloud API
input:
  - site
  - channel
  - window
output:
  - cohort counts
  - feature summary
forbidden:
  - db write
  - platform send
  - deploy
verification:
  - source/window/freshness/confidence required
```

추천 파일:

```text
harness/tool-registry/growth-data-tools.md
harness/tool-registry/growth-data-tools.json
```

### 3. Agent Lifecycle

`project/!indicatoragent.md`에는 Collector, Cohort Builder, Feature Builder, Signal Scorer, Experiment Recommender, Reporter가 이미 있다.
이것을 AIP식 생명주기로 바꾸면 아래처럼 된다.

```text
Spec -> Context Pack -> Plan -> Run -> Eval -> Report -> Lesson -> Promote
```

각 실행은 `에이전트 실행 기록(Agent Run Packet: 입력값, 사용 도구, 판단 근거, 결과, 다음 할 일을 한 번에 남기는 파일)`으로 남긴다.

```yaml
agent: leading_indicator_agent
run_id: leading-indicator-20260525-001
mode: read_only
site: biocom
window: last_7d
context_pack:
  - project/!indicatoragent.md
  - harness/!harness.md
tools:
  - vm_cloud_leading_indicators_read
  - ga4_bigquery_behavior_read
eval:
  - no_send
  - no_write
  - source_freshness
  - cohort_min_n
outputs:
  - json
  - markdown
  - dashboard_contract
```

추천 파일:

```text
harness/leading-indicator/RUN_PACKET_SCHEMA.md
harness/leading-indicator/EVAL_SUITE.md
```

### 4. 품질 판정 기준

지금 하네스에는 auditor와 preflight가 있지만, 선행지표 에이전트의 품질 평가는 아직 더 필요하다.

추천 품질 판정 항목(eval: 에이전트 추천을 사용해도 되는지 판단하는 검사):

| Eval | 성공 기준 |
|---|---|
| source freshness | source/window/freshness/confidence가 모두 있음 |
| cohort minimum | cohort별 n이 최소 기준 이상 |
| leakage guard | 구매 후 이벤트를 구매 전 신호로 잘못 쓰지 않음 |
| actionability | 사람이 바꿀 수 없는 지표는 추천에서 제외 |
| no-send/no-write | 외부 전송, 운영DB write 없음 |
| metric stability | p50/p75 등 outlier-resistant metric 우선 |
| conflict check | GA4와 내부 결제 label 충돌 여부 표시 |

이 품질 판정이 있어야 에이전트가 숫자만 예쁘게 뽑는 것이 아니라, 실제 운영 판단에 쓸 수 있는 신호만 남긴다.

### 5. Human+AI Application

이미 `project/!indicatoragent.md`의 화면 후보는 AIP 구조의 Human+AI Applications에 해당한다.
다만 화면에는 단순 지표 카드보다 아래 상태가 같이 보여야 한다.

- 이 신호가 어떤 온톨로지 항목과 행동 숫자에서 나왔는가.
- 구매자/이탈자 모수는 충분한가.
- 이 신호를 바꾸기 위한 action 후보는 무엇인가.
- 이 action은 Green/Yellow/Red 중 어디인가.
- 마지막 품질 판정(eval verdict: 바로 사용/주의/보류/실패)은 무엇인가.

권장 카드:

```text
오늘 강한 구매 전 신호
근거 비교 집단
추천 행동
안전 등급
품질 판정
다음 실험
```

### 6. Package, Release, Deploy

현재는 결과 문서와 script가 많아질수록 “어떤 파일 묶음이 하나의 에이전트인가”가 흐려질 수 있다.
AIP의 Package/Release/Deploy 개념을 문서형으로 먼저 적용한다.

추천 구조:

```text
agent-packages/
  leading-indicator-agent/
    README.md
    CONTEXT_PACK.md
    TOOL_REGISTRY.md
    RUN_PACKET_SCHEMA.md
    EVAL_SUITE.md
    RELEASE_NOTES.md
```

처음에는 새 디렉토리를 만들기보다 `harness/leading-indicator/`로 시작하는 것이 더 가볍다.

### 7. 미니 디지털 트윈 시뮬레이터

후속 개발로 미니 디지털 트윈은 가능하다.
여기서 디지털 트윈은 실제 쇼핑몰을 완전히 복제하는 거대한 시스템이 아니라, AI가 최근 기준선과 행동 병목을 읽고 몇 가지 매출/주문 시나리오를 제안하는 작은 시뮬레이션 판을 뜻한다.

가능한 1차 범위:

| 항목 | 1차 설계 |
|---|---|
| 기준선 | 방문자 수, 광고비, 구매 전환율, 객단가를 source matrix에서 자동 읽음 |
| AI 제안 | 현재 유지, 결제 이탈 개선, 콘텐츠 몰입 개선, 트래픽 확대 전 점검, 나쁜 경우 방어선 중 3-5개 |
| 출력값 | 예상 주문 수, 예상 매출, 예상 ROAS, 결제 이탈 영향, 우선 개선 지표 |
| 기준선 | 최근 7일/28일 실제 결제완료 주문과 매출 |
| 사용 목적 | "AI가 제안한 개선 시나리오별로 주문/매출 범위가 어떻게 달라질 수 있는가" 확인 |
| 금지 | 자동 예산 조정, 광고 플랫폼 전송, 운영 설정 변경 |

왜 지금 검토할 가치가 있는가:

- 선행지표는 "좋아 보이는 숫자"로 끝나면 약하다.
- 운영자가 실제로 궁금한 것은 "이 지표를 고치면 매출이 얼마나 달라질 수 있는가"다.
- 미니 디지털 트윈은 선행지표를 매출 가설로 번역하는 중간 단계가 된다.

주의할 점:

- 1차 버전은 정확한 예측기가 아니다.
- 광고비를 늘리면 방문자 수뿐 아니라 방문자의 질도 바뀔 수 있다.
- NPay, 카드, 가상계좌는 결제 완료 시점이 다르므로 결제완료 주문 기준을 분리해야 한다.
- 따라서 결과는 단일 정답이 아니라 예상 범위와 민감도 순위로 보여줘야 한다.

## 지금 따라 하지 말아야 할 것

| 하지 말 것 | 이유 |
|---|---|
| Palantir급 대형 ontology 플랫폼 구축 | 기존 `ontology/!ontology.md`가 있으므로 지금 필요한 것은 확장 문서와 실행 규칙 |
| raw customer/order identifier를 LLM context에 넣기 | 보안과 개인정보 리스크 |
| 자동으로 Meta/GA4/Google Ads에 전송하는 agent | Red Lane. 승인 전 금지 |
| 모든 스크립트를 하나의 orchestrator로 즉시 묶기 | 실패 지점이 불투명해짐 |
| vector DB부터 도입 | 현재는 구조화된 원장/BigQuery/VM Cloud가 더 중요 |
| model catalog부터 만들기 | 모델보다 source, eval, gate가 먼저 |

## AIP-lite 적용안

### Phase 1. 기존 온톨로지 확장과 도구 사용 안내서

목표: 에이전트가 같은 단어와 같은 금지선으로 실행되게 한다.

산출물:

- `ontology/leading-indicator-ontology-extension-20260525.md`
- `ontology/leading-indicator-ontology-schema-contract-20260525.md`
- `harness/leading-indicator/TOOL_REGISTRY.md`
- `harness/leading-indicator/EVAL_SUITE.md`
- `harness/leading-indicator/RUN_PACKET_SCHEMA.md`

성공 기준:

- 기존 `ontology/!ontology.md`의 revenue/payment/attribution 용어는 유지된다.
- 방문 행동 묶음, 행동 이벤트, 비교 집단, 행동 숫자, 선행 신호, 실험 후보 정의가 확장 문서에 추가된다.
- 각 도구에 안전 등급, 허용 작업, 금지 작업, 결과 기록 양식이 붙음.
- 선행지표 에이전트 실행 시 참고 문서 묶음이 1개로 고정됨.

추천 자신감: 92%

### Phase 2. 선행지표 에이전트 실행 기록

목표: 선행지표 에이전트 실행 1회를 재현 가능한 단위로 남긴다.

산출물:

- `data/project/leading-indicator-agent-run-YYYYMMDD.json`
- `project/leading-indicator-agent-run-YYYYMMDD.md`

성공 기준:

- source/window/freshness/confidence가 자동 기록됨.
- 비교 집단, 행동 숫자, 신호 점수, 품질 판정이 한 JSON에 있음.
- 사람이 보는 Markdown이 같은 JSON에서 생성됨.

추천 자신감: 88%

### Phase 3. 품질 판정 기준과 보고서 연결

목표: 예쁜 숫자가 아니라 운영 판단 가능한 신호만 화면/보고서에 올라가게 한다.

산출물:

- 품질 판정(eval verdict): PASS / PASS_WITH_NOTES / HOLD / FAIL
- 보류 이유 분류(HOLD reason category): `cohort_too_small`, `source_freshness_gap`, `label_conflict`, `not_actionable`, `approval_required`
- `/ai-crm/leading-indicators` 화면 data contract

성공 기준:

- 비교 집단 수가 부족한 신호는 추천 카드에서 제외됨.
- 구매 후 이벤트를 선행지표로 잘못 쓰지 않음.
- Red Lane action은 승인 문서 링크 없이는 실행 후보가 되지 않음.

추천 자신감: 84%

### Phase 4. Operational Automation

목표: 매일 자동으로 읽고, 실패하면 사람이 바로 이해할 수 있는 알림을 준다.

산출물:

- 정기 읽기 전용 실행
- Telegram summary
- Markdown report
- stale source alert

성공 기준:

- 자동 실행은 읽기 전용만 수행.
- 운영 변경, 외부 전송, 배포는 절대 자동 실행하지 않음.
- 보류가 나오면 원인 분류와 다음에 확인할 Green 작업이 같이 나옴.

추천 자신감: 80%

### Phase 5. Mini Digital Twin

목표: 선행지표가 실제 매출 가설로 어떻게 이어지는지 AI가 몇 가지 시나리오로 제안하고, 운영자가 한 화면에서 근거와 예상 범위를 확인한다.

산출물:

- `project/leading-indicator-mini-digital-twin-plan-20260525.md`
- `report/indicator-mini-digital-twin-prototype-20260525.html`

성공 기준:

- 에이전트가 최근 기준선을 읽고 시나리오 3-5개를 자동 제안한다.
- 각 시나리오에는 왜 제안됐는지, 어떤 source를 썼는지, 예상 주문/매출 범위가 함께 표시된다.
- 예상 ROAS, 결제 이탈 영향, 우선 개선 지표가 함께 표시된다.
- 결과는 "정답 예측"이 아니라 "AI가 제안한 가정에 따른 예상 범위"로 표시된다.
- 자동 예산 조정, 광고 플랫폼 전송, 운영 설정 변경은 하지 않는다.

추천 자신감: 84%

## OKR - 사람 언어 개정안

Objective:
구매 전 행동 신호를 안전하게 읽고, 운영자가 바로 고칠 수 있는 액션과 매출 가설로 바꾼다.

### KR1

**KR**: 구매 전 행동을 설명하는 온톨로지 항목 6개와 항목 간 연결 규칙 9개를 추가하고, 기존 온톨로지와 같은 뜻의 중복 용어 0건을 유지한다.

**해당 KR 설정 이유**:
온톨로지는 우리가 데이터를 부르는 공통 사전이다.
기존 사전은 결제완료와 광고 클릭은 잘 설명하지만, 구매 전 행동인 체류시간, 스크롤, 결제 진행, 비교 집단, 실험 후보를 설명하는 말은 아직 부족하다.

**액션플랜**:

1. 구매 전 행동 항목 6개를 정의한다.
   - 왜: 이 말들이 정해져야 보고서마다 체류시간과 결제 의도를 다르게 해석하지 않는다.
2. 항목 간 연결 규칙 9개를 적는다.
   - 왜: 연결 규칙이 없으면 숫자는 있어도 어떤 액션으로 이어지는지 끊긴다.
3. 기존 온톨로지와 중복되는 말이 없는지 확인한다.
   - 왜: 같은 뜻의 말이 2개 생기면 에이전트와 사람이 서로 다른 기준으로 판단한다.

### KR2

**KR**: 주요 데이터 확인 도구 12개 전부에 "읽기만 가능 / 승인 후 변경 / 자동 실행 금지" 표시와 결과 기록 양식을 붙여, 도구 사용 안내서 완성률 100%를 달성한다.

**해당 KR 설정 이유**:
지금은 script, BigQuery, VM Cloud API, GTM export가 흩어져 있어 어떤 도구가 읽기만 하는지, 어떤 도구가 운영 설정을 바꿀 수 있는지 한눈에 보이지 않는다.

**액션플랜**:

1. 자주 쓰는 확인 도구를 12개로 추린다.
   - 왜: 도구가 많아질수록 위험도와 사용 목적을 먼저 제한해야 한다.
2. 각 도구에 안전 등급을 붙인다.
   - 왜: 에이전트가 실수로 운영 설정 변경이나 외부 전송을 실행하지 못하게 하기 위해서다.
3. 결과 기록 양식을 맞춘다.
   - 왜: 실행 결과가 매번 다르게 남으면 다음 사람이 검증하거나 비교할 수 없다.

### KR3

**KR**: 선행지표 에이전트가 실행될 때마다 입력값, 판단 근거, 결과, 다음 할 일이 기계용 기록 1개와 사람용 보고서 1개로 100% 남는다.

**해당 KR 설정 이유**:
어떤 입력값을 썼는지, 어떤 도구를 썼는지, 왜 그 결론이 나왔는지가 흩어지면 다음 실행에서 재현하거나 비교하기 어렵다.

**액션플랜**:

1. 실행 기록에 꼭 남길 항목을 고정한다.
   - 왜: 같은 질문을 다시 돌렸을 때 결과가 달라지면 원인을 추적해야 하기 때문이다.
2. 같은 기록에서 사람용 보고서와 화면용 데이터를 같이 만들 수 있게 한다.
   - 왜: 보고서, 화면, Telegram 알림이 서로 다른 숫자를 보여주면 신뢰가 깨진다.
3. 샘플 실행 기록 1개를 먼저 만든다.
   - 왜: 자동화 전에 "좋은 실행 결과는 이렇게 남아야 한다"는 기준이 필요하다.

### KR4

**KR**: 추천 후보 100%에 "바로 사용 / 주의하고 사용 / 보류 / 실패" 판정을 붙이고, 결제 후에 생긴 행동을 구매 전 신호로 잘못 쓰는 사례 0건을 유지한다.

**해당 KR 설정 이유**:
선행지표는 결과를 예고하는 행동이어야 한다.
결제완료 뒤에 발생한 이벤트를 선행지표로 쓰면 운영 판단이 뒤집힌다.

**액션플랜**:

1. 추천 후보마다 품질 판정 기준을 붙인다.
   - 왜: 숫자가 커 보여도 실제로 운영에 쓸 수 없는 지표가 많기 때문이다.
2. 판정 라벨을 4개로 통일한다.
   - 왜: 운영자가 이 신호를 지금 써도 되는지 즉시 알아야 한다.
3. 보류 이유를 쉬운 말로 남긴다.
   - 왜: 보류가 나와도 다음에 무엇을 확인해야 하는지 알아야 한다.

### KR5

**KR**: 보고서 첫 화면에서 핵심 판단 카드 6개 이하로 30초 안에 현재 상태, 이유, 다음 액션을 이해하게 만든다.

**해당 KR 설정 이유**:
보고서는 데이터 창고가 아니라 의사결정판이어야 한다.
카드가 많거나 액션이 없으면 운영자는 다시 원본 데이터를 해석해야 한다.

**액션플랜**:

1. 각 추천 카드에 근거, 다음 행동, 승인 필요 여부를 같이 표시한다.
   - 왜: 좋은 숫자를 봐도 바로 할 일이 없으면 운영 개선으로 이어지지 않는다.
2. 표보다 판단 카드와 도표를 먼저 배치한다.
   - 왜: 처음 보는 사람은 원본 데이터보다 현재 판단과 흐름을 먼저 이해해야 한다.
3. 처음 등장하는 내부 용어에는 쉬운 풀이를 붙인다.
   - 왜: 작성한 에이전트만 이해하는 표현은 보고서의 의사결정 속도를 떨어뜨린다.

### KR6

**KR**: 읽기 전용 자동 점검은 7일 연속 95% 이상 성공하고, 운영 설정 변경·외부 전송·배포는 0건으로 유지하며, 보류 알림 100%에 다음 확인 방법을 포함한다.

**해당 KR 설정 이유**:
자동화는 편하지만 위험하다.
처음에는 읽기와 보고만 자동화하고, 실제 전송이나 배포는 승인 문서 없이는 열지 않아야 한다.

**액션플랜**:

1. 정기 실행은 읽기와 보고서 생성까지만 수행한다.
   - 왜: 자동화 초기에 운영 설정까지 건드리면 실패 영향이 커진다.
2. 보류가 나오면 원인과 다음 확인 방법을 Telegram에 함께 보낸다.
   - 왜: "실패"만 오면 사람이 다시 로그를 뒤져야 한다.
3. 운영 변경, 외부 전송, 배포가 필요하면 자동으로 멈춘다.
   - 왜: 돈과 광고 계정에 영향을 주는 작업은 TJ님 승인 후 진행해야 한다.

### KR7

**KR**: 선행지표 에이전트가 실행될 때마다 최근 기준선을 읽고 매출/주문 시나리오 3-5개를 자동 제안하며, 각 시나리오에 예상 주문 수, 예상 매출 범위, 내부 confirmed ROAS 가능 여부, 결제 이탈 영향, 우선 개선 지표를 100% 표시하는 미니 디지털 트윈 시뮬레이터 1개를 만든다.

**해당 KR 설정 이유**:
선행지표를 보는 이유는 결국 "무엇을 바꾸면 매출이 얼마나 달라질 수 있는가"를 빠르게 판단하기 위해서다.
다만 처음부터 정확한 매출 예측기로 만들지 말고, AI가 몇 가지 운영 시나리오를 제안하고 방향과 민감도를 보는 작은 시뮬레이터로 시작해야 안전하다.

**액션플랜**:

1. 최근 7일/28일 방문자 수, 결제완료 주문 수, 매출, 객단가를 기준선으로 읽는다.
   - 왜: 기준선 없이 가정값만 바꾸면 시뮬레이션이 실제 운영과 떨어진다.
2. AI가 현재 유지, 결제 이탈 개선, 콘텐츠 몰입 개선, 트래픽 확대 전 점검 같은 시나리오를 자동 제안한다.
   - 왜: 운영자가 숫자 슬라이더를 직접 만지는 방식은 무엇을 바꿔야 할지 부담이 크고, 실행 기록 간 비교도 어려워진다.
3. 결과는 단일 숫자가 아니라 범위로 보여준다.
   - 왜: 초기 시뮬레이터는 정답 예측보다 의사결정 방향을 잡는 도구가 맞다.

## Palantir AIP 구조와 현재 문서의 차이

| 영역 | 현재 상태 | 차이 | 보강 방향 |
|---|---|---|---|
| Context Engineering | 문서와 context pack은 있음 | 실행마다 수동 조립이 많음 | agent별 context pack 고정 |
| Ontology | `ontology/!ontology.md`가 active draft로 존재 | attribution/revenue 중심이라 구매 전 행동/신호 확장이 필요 | `ontology/leading-indicator-ontology-extension-20260525.md` |
| Tool Services | scripts/API가 있음 | 읽기/운영 변경/외부 전송 위험도가 흩어짐 | 도구 사용 안내서 |
| Governance | Lane 체계 강함 | 항목별 개인정보/사용 목적 정책은 약함 | policy file |
| Agent Lifecycle | 설계 문서 있음 | 실행/품질 판정/승격 흐름이 약함 | 실행 기록 양식 |
| Observability | 결과 문서/JSON 있음 | 실행별 대시보드 없음 | 품질 판정 로그 index |
| Human App | 화면 후보 있음 | 에이전트 판정과 다음 행동 연결 부족 | card data contract |
| Release | 문서/스크립트 산재 | package 단위 없음 | `harness/leading-indicator` package |

## Source / Window / Freshness

| 항목 | 값 |
|---|---|
| source | `project/!indicatoragent.md`, `harness/!harness.md`, `docs/report/text-report-template.md`, TJ님 첨부 AIP 구조도 |
| window | 문서 기준 2026-05-24까지의 선행지표 설계와 2026-05-25 첨부 이미지 |
| freshness | 로컬 문서 읽기 2026-05-25 17:45 KST |
| site | biocom 우선, thecleancoffee 확장 가능 |
| confidence | 88% |

## 하지 않은 것

| 항목 | 하지 않은 이유 | 승인 필요 여부 |
|---|---|---|
| 운영DB 변경 | 이번 범위는 문서 분석 | YES |
| VM Cloud deploy | 구조 제안만 수행 | YES |
| GTM publish | 추적 운영 변경 아님 | YES |
| GA4/Meta/Google/TikTok 전송 | 외부 플랫폼 전환값 변경 금지 | YES |
| 코드 구현 | 먼저 architecture decision이 필요 | NO, 다음 Green으로 가능 |

## No-Send / No-Write 확인

| 항목 | 결과 |
|---|---|
| 외부 전송 없음 | YES |
| 운영DB 변경 없음 | YES |
| 배포 없음 | YES |
| GTM 게시 없음 | YES |
| 광고/분석 플랫폼 전송 없음 | YES |

## 남은 리스크

| 리스크 | 영향 | 대응 |
|---|---|---|
| 기존 ontology를 무시하고 새 ontology를 만드는 것 | 용어 중복과 정본 충돌 | `ontology/!ontology.md`를 기준으로 두고 필요한 항목만 추가 |
| 선행지표 ontology를 너무 크게 잡는 것 | 구현 지연 | 신규 온톨로지 항목은 6개 안으로 제한 |
| 에이전트가 선행지표와 후행지표를 혼동 | 잘못된 운영 판단 | 구매 후 행동 혼입 방지 판정 추가 |
| 도구 사용 안내서 없이 자동화부터 가는 것 | 승인 전 운영 변경/외부 전송 위험 | 도구 사용 안내서를 Phase 1로 둠 |
| 화면부터 만들고 품질 판정이 늦는 것 | 예쁜 숫자만 보임 | 품질 판정을 화면 계약에 포함 |
| 미니 디지털 트윈을 매출 예측 정답처럼 쓰는 것 | 잘못된 예산/운영 판단 | 1차는 what-if 예상 범위와 민감도만 표시 |
| raw ID가 LLM context로 새는 것 | 보안 리스크 | ontology policy에 raw identifier 금지 명시 |

## HOLD Reducer

| 항목 | 값 |
|---|---|
| hold_reason | 전체 AIP 플랫폼급 구축은 지금 과함 |
| hold_reason_category | AIP-lite는 해당 없음, 배포/운영 변경/외부 전송은 approval_required |
| auto_green_followups_available | YES |
| auto_green_followups_done | 본 분석 문서 작성 |
| remaining_blocker | 선행지표 온톨로지 확장/도구 사용 안내서 초안 필요 |
| next_lane | Green |
| tj_action_required | NO for Phase 1 draft |
| codex_next_green_action | `ontology/leading-indicator-ontology-extension-20260525.md`와 `harness/leading-indicator/TOOL_REGISTRY.md` 초안 작성 |

## 다음 액션

### Codex가 할 일

1. 기존 온톨로지 기반 선행지표 사전 작성
- Codex 추천: 진행 추천
- 추천 이유: Palantir AIP에서 우리에게 가장 큰 효용은 대형 플랫폼이 아니라 기존 온톨로지 위에 행동/선행지표 레이어를 얹는 것이다.
- 추천 방향에 대한 자신감: 92%
- Lane: Green
- 무엇을 하는가: `ontology/leading-indicator-ontology-extension-20260525.md`, `TOOL_REGISTRY.md`, `EVAL_SUITE.md`, `RUN_PACKET_SCHEMA.md`를 만든다.
- 왜 하는가: 선행지표 에이전트가 매번 같은 단어, 같은 행동 후보, 같은 데이터 기준, 같은 품질 판정 기준으로 실행되게 한다.
- 어떻게 하는가: `ontology/!ontology.md`의 기존 정의를 기준으로 두고, 구매 전 행동/선행 신호 항목만 추가한다.
- 어디에서 확인하나: `ontology/`, `harness/leading-indicator/`
- 성공 기준: 기존 결제완료/매출/광고 유입 증거와 새 방문 행동/행동 숫자/선행 신호의 관계가 충돌 없이 정의된다.
- 실패 시 해석/대응: 범위가 커지면 항목/행동 후보 수를 줄이고 Phase 1만 남긴다.
- Codex 대체 가능 여부: YES
- 다른 에이전트 검증: 불필요
- 승인 필요: NO

2. 선행지표 에이전트 실행 기록 샘플 작성
- Codex 추천: 진행 추천
- 추천 이유: 실행 1회를 재현 가능한 JSON/Markdown 단위로 고정해야 agent lifecycle이 생긴다.
- 추천 방향에 대한 자신감: 88%
- Lane: Green
- 무엇을 하는가: `leading-indicator-agent-run-sample-20260525.json`과 설명 문서를 만든다.
- 왜 하는가: 나중에 자동 실행, 화면, Telegram, weekly report가 같은 결과 기록 양식을 쓰게 하기 위해서다.
- 어떻게 하는가: 현재 live refresh 지표와 가짜 데이터 없는 결과 양식만 사용한다. 운영DB 변경은 하지 않는다.
- 어디에서 확인하나: `data/project/`, `project/`
- 성공 기준: 비교 집단, 행동 숫자, 신호 점수, 품질 판정, 다음 액션이 한 구조로 표현된다.
- 실패 시 해석/대응: 현재 데이터가 부족하면 결과 양식만 검증하는 샘플로 남긴다.
- Codex 대체 가능 여부: YES
- 다른 에이전트 검증: 불필요
- 승인 필요: NO

3. 미니 디지털 트윈 설계 초안 작성
- Codex 추천: 진행 추천, 단 Phase 1-2 이후
- 추천 이유: 선행지표가 실제 매출 판단으로 이어지려면 AI가 기준선과 병목을 읽고 운영자가 볼 만한 시나리오를 먼저 제안해야 한다.
- 추천 방향에 대한 자신감: 84%
- Lane: Green
- 무엇을 하는가: 최근 기준선을 읽고 시나리오 3-5개를 자동 제안하는 what-if 시뮬레이터 설계를 만든다.
- 왜 하는가: 지표 변화가 매출에 얼마나 민감한지 알아야 랜딩/결제 UX/광고비 조정 우선순위를 정할 수 있다.
- 어떻게 하는가: 최근 7일/28일 실제 결제완료 주문과 매출을 기준선으로 두고, 현재 유지/결제 이탈 개선/콘텐츠 몰입 개선/트래픽 확대 전 점검 시나리오를 계산한다.
- 어디에서 확인하나: `project/`, `report/`
- 성공 기준: 예상 주문, 예상 매출, 예상 ROAS, 결제 이탈 영향, 우선 개선 지표 5개가 한 화면에 표현된다.
- 실패 시 해석/대응: 오차가 크면 자동 판단에 쓰지 않고, 민감도 확인용으로만 유지한다.
- Codex 대체 가능 여부: YES
- 다른 에이전트 검증: 시뮬레이션 공식을 운영 의사결정에 쓰기 전에는 선택 검증 권장
- 승인 필요: 문서/정적 화면은 승인 불필요. 운영 자동화 또는 외부 전송은 승인 필요

### TJ님이 할 일

1. AIP-lite 방향만 확인
- Codex 추천: 진행 추천
- 추천 이유: 전체 AIP 플랫폼급 구축은 보류하고, 문서형 온톨로지 확장과 도구 사용 안내서부터 가는 것이 비용 대비 효율이 높다.
- 추천 방향에 대한 자신감: 88%
- Lane: Green decision
- 무엇을 하는가: 본 문서의 방향이 맞는지만 확인한다.
- 왜 하는가: 다음 Green 문서 패키지 작성 범위를 고정하기 위해서다.
- 어떻게 하는가: `기존 광고/매출 온톨로지 확장`, `도구 사용 안내서`, `에이전트 실행 기록`, `미니 디지털 트윈 후보`가 우선순위로 맞는지 본다.
- 어디에서 확인하나: 본 문서.
- 성공 기준: Phase 1 문서 패키지 작성 진행에 이견 없음.
- 실패 시 해석/대응: 우선순위를 `프론트 화면 먼저` 또는 `자동화 먼저`로 바꾼다.
- Codex가 대신 못 하는 이유: 사업/운영 우선순위 판단은 TJ님 결정이 필요하다.
- 다른 에이전트 검증: 선택
- 승인 필요: NO

## 권장안

바로 다음 Green Lane 작업은 기존 `ontology/!ontology.md`를 기준으로 하는 선행지표 온톨로지 확장과 `harness/leading-indicator` 패키지 작성이다.
구현이나 배포가 아니라 문서형 AIP-lite 기반을 먼저 만든다.
이 순서가 맞다.

```text
1. Attribution Ontology 확인
2. Leading Indicator Ontology Extension
   - 쉬운 뜻: 구매 전 행동을 설명하는 온톨로지 사전 추가
3. Tool Registry
   - 쉬운 뜻: 도구 사용 안내서
4. Run Packet Schema
   - 쉬운 뜻: 에이전트 실행 기록 양식
5. Eval Suite
   - 쉬운 뜻: 추천 신호 품질 판정 기준
6. Leading Indicator Agent 연결
7. Mini Digital Twin
   - 쉬운 뜻: AI가 몇 가지 운영 시나리오를 제안하고 예상 매출 범위를 보여주는 작은 시뮬레이터
8. 화면/자동화/Telegram
```

이렇게 가면 Palantir AIP의 장점인 “데이터-로직-액션 통합”을 우리 규모에 맞게 가져오면서도, 대형 플랫폼을 만들다가 속도가 죽는 문제를 피할 수 있다.
