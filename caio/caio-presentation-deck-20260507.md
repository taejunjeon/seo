# CAIO 발표 슬라이드 구조와 `/total` 데모 문구

작성 시각: 2026-05-07 00:31 KST
상태: active draft
Owner: CAIO / presentation
참고 정본: [[!caio]], [[caio_gpt_0507]], [[front]], [[../total/!total-current]], [[../gdn/google-ads-landing-clickid-analysis-20260506]], [[../harness/!harness]], [[../ontology/!ontology]]
공통 하네스 정본: [[../harness/common/HARNESS_GUIDELINES]], [[../harness/common/AUTONOMY_POLICY]], [[../harness/common/REPORTING_TEMPLATE]]
하네스 fork 방지 기준: `harness/common/HARNESS_GUIDELINES.md`, `harness/common/AUTONOMY_POLICY.md`, `harness/common/REPORTING_TEMPLATE.md`를 복사하지 않고 CAIO 발표용 해석만 기록한다.
Do not use for: 외부 공개 최종 숫자 승인, 실제 PPT 디자인 최종본, 고객사 제안서 최종본

## 10초 결론

이번 CAIO 발표는 `AI를 써봤다`가 아니라 **AI가 실제 매출·광고비·데이터 신뢰도·다음 액션을 어떻게 바꾸는지 보여주는 발표**로 가야 한다.

핵심 장면은 3개다.

1. `/total`을 **AI Value-up Control Tower**로 보여준다.
2. `0.8% vs 97.75%` 한 장으로 **AI가 문제 위치를 다시 찾는 방식**을 보여준다.
3. 하네스와 온톨로지로 **AI 네이티브 조직이 왜 빠르고 안전하게 일할 수 있는지** 보여준다.

강연에서 가장 강한 문장은 이것이다.

> **AI는 답을 대신 내는 도구가 아니라, 회사가 어디서 돈을 벌고 어디서 새는지 스스로 찾아 고치는 운영 체계입니다.**

## 다음 할일

| 순서 | 상태 | 담당 | 할 일 | 왜 하는가 | 어떻게 하는가 | 컨펌 필요 |
|---:|---|---|---|---|---|---|
| 1 | 진행 가능 | Codex | 이 문서를 기준으로 실제 PPT 18장 원고를 만든다 | 현재 문서는 구조와 멘트 초안이다 | 각 슬라이드별 제목, 본문 3줄, 발표자 노트 3줄로 압축한다 | NO |
| 2 | 진행 가능 | Claude Code | `/total` 데모 화면의 상단 문구와 카드 문구를 반영한다 | 발표장에서 실제 화면이 설득력을 만든다 | `AI Value-up Control Tower`, 내부 confirmed revenue, platform gap, Action Queue를 화면에 배치한다 | NO |
| 3 | TJ 판단 | TJ님 | 실제 회사명과 금액 공개 범위를 정한다 | 강연 신뢰와 보안 사이 균형이 필요하다 | `biocom/실제 금액` 또는 `Healthcare Brand A/반올림 금액` 중 선택한다 | YES |
| 4 | 진행 가능 | Codex | 0.8% vs 97.75% 슬라이드 그래픽 지시서를 만든다 | PPT 제작자가 숫자 의미를 오해하지 않게 한다 | 좌측 문제, 중앙 재분석, 우측 병목 위치, 하단 실행 조치로 구성한다 | NO |
| 5 | 진행 가능 | Codex | 발표 후 상담 전환용 QR/CTA 문구를 정리한다 | 발표가 리드로 이어져야 한다 | 2주 AI Value Diagnostic, Revenue Intelligence 상담, AI Roll-up Partner CTA로 나눈다 | NO |

## 1. 발표 전체 구조

권장 발표 시간은 20~25분이다.
슬라이드는 18장 정도가 적절하다.

핵심 흐름은 아래다.

```text
문제 제기
→ 우리 회사에서 먼저 겪은 데이터 혼선
→ 실제 매출 장부를 닫는 원칙
→ /total 데모
→ 0.8% vs 97.75% 대표 사례
→ 하네스와 온톨로지
→ 고객사 적용 프로그램
→ CTA
```

## 2. 슬라이드 구조

| 장 | 제목 | 핵심 메시지 | 보여줄 증거/화면 | 발표 멘트 |
|---:|---|---|---|---|
| 1 | AI는 도구가 아니라 운영 방식의 재설계다 | AI 전환은 챗봇 도입이 아니라 회사 운영 체계 재설계다 | 표지, TJ님 소개 | `AI를 많이 쓰는 회사가 아니라 AI로 운영 방식을 바꾸는 회사가 이깁니다.` |
| 2 | 대부분 회사의 AI 도입은 성과로 이어지지 않는다 | 도구는 늘었지만 매출·비용·속도는 잘 안 바뀐다 | AI 도입 실패/정체 문제 | `문제는 모델이 아니라, 회사 안에 AI가 일할 장부와 절차가 없다는 것입니다.` |
| 3 | 우리도 처음에는 같은 문제를 겪었다 | 광고 플랫폼, GA4, NPay, PG, 자사몰 주문 숫자가 서로 달랐다 | ROAS/GA4/NPay/주문 분절 예시 | `저희도 처음부터 잘한 것이 아닙니다. 오히려 숫자가 안 맞아서 시작했습니다.` |
| 4 | 원칙: 광고 플랫폼보다 실제 결제 장부를 먼저 믿는다 | 매출은 실제 주문·결제·환불 기준으로 닫는다 | 내부 confirmed revenue 정의 | `플랫폼은 참고값이고, 대표가 믿어야 할 기준은 실제 결제 장부입니다.` |
| 5 | AI Value-up Operating System | 주문·결제·유입·플랫폼·AI 작업 규칙을 하나로 묶는다 | 운영 OS 구조도 | `대시보드 하나를 만든 것이 아니라 AI가 운영 문제를 찾고 고치는 구조를 만들었습니다.` |
| 6 | 데모: AI Value-up Control Tower | `/total`은 대표가 보는 매출·광고·데이터 관제탑이다 | `/total` 첫 화면 | `이 화면은 예쁜 그래프가 아니라 의사결정용 장부입니다.` |
| 7 | 이번 달 진짜 매출은 얼마인가 | GA4나 광고 플랫폼이 아니라 내부 확정 순매출을 본다 | 확정 순매출 카드 | `AI 도입의 첫 단계는 자동화가 아니라 믿을 수 있는 숫자를 만드는 것입니다.` |
| 8 | 어느 채널이 실제로 돈을 벌었는가 | 플랫폼 주장값과 내부 confirmed ROAS를 분리한다 | 채널별 ROAS 테이블 | `플랫폼 관리자 화면은 모두 자기 광고 덕분이라고 말합니다. 우리는 주문 증거로 다시 봅니다.` |
| 9 | ROAS가 높아 보이는데 왜 돈이 안 남을까 | platform reference와 internal confirmed는 다르다 | platform gap 카드 | `ROAS를 믿는 것이 아니라, ROAS가 왜 다른지 설명하는 것이 핵심입니다.` |
| 10 | 0.8%처럼 보인 Google Ads 문제 | 주문 원장 기준으로는 Google click id가 거의 안 남아 있었다 | 좌측 0.8% 카드 | `처음에는 Google Ads confirmed purchase를 만들 수 없을 것처럼 보였습니다.` |
| 11 | 97.75%를 찾은 재분석 | 랜딩 세션에는 click id가 대부분 살아 있었다 | 우측 97.75% 카드 | `올바른 분모를 다시 잡자 문제가 광고 URL이 아니라 중간 연결 구간임이 보였습니다.` |
| 12 | 문제는 광고가 아니라 연결 구간이었다 | 병목은 랜딩 이후 checkout/NPay/주문 원장 연결이다 | 병목 지도 | `AI가 한 일은 답을 찍은 것이 아니라, 문제가 끊기는 위치를 좁힌 것입니다.` |
| 13 | NPay는 나쁜 결제수단이 아니다 | NPay 실제 결제완료는 구매고, click/count는 구매가 아니다 | NPay 개념 분리 | `NPay를 막는 것이 아니라, NPay 실제 결제완료만 구매로 인정하게 만든 것입니다.` |
| 14 | 하네스: AI 직원의 작업장과 안전벨트 | 안전한 일은 밀고, 위험한 일은 멈춘다 | Green/Yellow/Red, no-send/no-write | `AI가 빠르게 일하려면 안전장치가 있어야 합니다.` |
| 15 | 온톨로지: 사람과 AI의 공통 언어 | 같은 단어를 같은 뜻으로 써야 숫자가 안 흔들린다 | ontology-lite 규칙 | `AI 조직에서는 단어 하나가 매출 숫자를 바꿉니다.` |
| 16 | 우리가 얻은 성과 | 매출 장부, 내부 ROAS, click id 병목, AI 작업 하네스가 생겼다 | 성과 요약표 | `가장 큰 성과는 자동화 몇 개가 아니라, 매월 반복 가능한 운영 구조입니다.` |
| 17 | 고객사에 적용하는 프로그램 | 2주 진단, 6주 Sprint, 8~12주 Revenue Intelligence | 프로그램 표 | `이 구조는 우리 회사만의 실험이 아니라 고객사 밸류업 상품이 될 수 있습니다.` |
| 18 | 마무리와 CTA | AI 네이티브 조직은 AI가 회사 운영을 읽고 고치는 조직이다 | QR, 상담 신청 | `우리 회사도 어디서 AI 전환을 시작해야 할지 알고 싶다면 2주 진단부터 시작하면 됩니다.` |

## 3. 축약 버전

발표 시간이 10~12분이면 아래 9장만 쓴다.

| 순서 | 슬라이드 | 이유 |
|---:|---|---|
| 1 | Slide 1 표지 | 주제 고정 |
| 2 | Slide 2 문제 제기 | 청중 공감 |
| 3 | Slide 4 원칙 | 차별점 설명 |
| 4 | Slide 6 `/total` 데모 | 실제 화면 증거 |
| 5 | Slide 8 채널별 성과 | 매출/광고 연결 |
| 6 | Slide 10~12 통합: 0.8% vs 97.75% | 대표 성과 |
| 7 | Slide 14 하네스 | AI 네이티브 조직 차별점 |
| 8 | Slide 17 프로그램 | 비즈니스 전환 |
| 9 | Slide 18 CTA | 리드 전환 |

## 4. 한 장짜리 슬라이드: 0.8% vs 97.75%

### 슬라이드 제목

> **0.8% 문제는 Google Ads 실패가 아니라, 주문 원장 연결 병목이었다**

### 부제

> AI가 한 일은 숫자를 예쁘게 만든 것이 아니라, 문제가 끊기는 정확한 위치를 찾은 것이다.

### 화면 구성

```text
┌────────────────────┐    ┌────────────────────┐    ┌────────────────────┐
│ 문제처럼 보인 숫자 │ →  │ 분모를 다시 잡음    │ →  │ 진짜 병목 위치      │
├────────────────────┤    ├────────────────────┤    ├────────────────────┤
│ 주문 원장 기준     │    │ GA4 BigQuery raw    │    │ 랜딩 이후 연결 구간 │
│ 5 / 623건          │    │ 6,724 / 6,879세션   │    │ checkout / NPay /  │
│ 0.8%               │    │ 97.75%              │    │ 주문 원장           │
└────────────────────┘    └────────────────────┘    └────────────────────┘
```

### 하단 실행 조치

```text
실행: paid_click_intent v1
목적: gclid/gbraid/wbraid를 랜딩 시점에 저장하고 checkout/NPay intent까지 이어 붙인다.
안전장치: no-send / no-write / no-platform-send
현재 상태: 실제 광고 플랫폼 전환 전송 0건. 24h/72h 모니터링으로 회복률 확인 단계.
```

### 숫자 카드 문구

| 카드 | 큰 숫자 | 작은 설명 |
|---|---:|---|
| 왼쪽 | 0.8% | 운영 결제완료 주문 623건 중 Google click id가 남은 주문 5건 |
| 가운데 | 97.75% | Google Ads 증거 세션 6,879개 중 click id가 남은 세션 6,724개 |
| 오른쪽 | 병목 위치 발견 | 광고 URL 문제가 아니라 랜딩 이후 checkout/NPay/주문 원장 연결 문제 |

### 발표자 노트

> 처음에는 Google Ads 주문 623건 중 click id가 5건뿐이라, confirmed purchase 전송이 거의 불가능해 보였습니다.  
> 그런데 BigQuery에서 랜딩 세션 기준으로 다시 보니 6,879세션 중 6,724세션, 즉 97.75%에는 click id가 살아 있었습니다.  
> 결론은 Google Ads가 처음부터 망가진 것이 아니라, 랜딩 이후 checkout, NPay, 주문 원장으로 이어지는 연결이 끊긴다는 것이었습니다.

### 반드시 피할 표현

| 피할 표현 | 이유 | 추천 표현 |
|---|---|---|
| `0.8%가 97.75%로 복구됐다` | 아직 주문 원장 회복률은 모니터링 전이다 | `병목 위치를 찾고 회복 파이프라인을 열었다` |
| `Google Ads가 문제없다` | confirmed purchase 연결은 아직 추가 검증 필요 | `광고 랜딩까지는 click id가 대부분 살아 있었다` |
| `Google ROAS가 고쳐졌다` | conversion upload와 Primary 변경은 아직 금지 상태다 | `Google ROAS를 고칠 선행 조건을 만들었다` |

## 5. `/total` 데모용 문구

### 화면 이름

> **AI Value-up Control Tower**

한국어 이름:

> **AI 밸류업 매출 관제탑**

### 화면 부제

> 여러 브랜드의 실제 확정 매출, 광고 효율, 데이터 신뢰도, 다음 액션을 한 화면에서 보는 운영 대시보드

### 상단 한 줄 결론

내부 발표용:

> **2026년 4월 biocom 확정 순매출은 499,829,436원입니다. 이 값은 GA4나 광고 플랫폼 값이 아니라 아임웹 주문, 토스 결제, NPay 실제 결제완료, 취소·환불 보정을 묶어 만든 내부 정본 매출입니다.**

외부 발표용 익명화 버전:

> **2026년 4월 Healthcare Brand A의 확정 순매출은 약 5억 원입니다. 이 값은 광고 플랫폼 화면이 아니라 실제 주문·결제·환불 장부를 기준으로 만든 내부 정본 매출입니다.**

### 데모 카드 문구

| 카드 | 제목 | 큰 숫자/상태 | 설명 문구 |
|---|---|---:|---|
| 1 | 확정 순매출 | 499,829,436원 | `실제 주문·결제·환불 기준으로 닫은 내부 매출입니다.` |
| 2 | 주문 수 | 2,216건 | `A/B confirmed rail 기준 주문 수입니다.` |
| 3 | 데이터 검증 | 통과 | `primary channel 합계가 전체 confirmed revenue와 일치합니다.` |
| 4 | Meta 내부 ROAS | 1.95x | `플랫폼 주장값이 아니라 Attribution VM confirmed revenue 기준입니다.` |
| 5 | Google click id 병목 | 0.8% → 97.75% | `주문 원장 기준은 낮지만 랜딩 세션 기준으로는 대부분 살아 있습니다.` |
| 6 | 다음 액션 | paid_click_intent 모니터링 | `click id가 checkout/NPay/주문 후보까지 이어지는지 24h/72h로 확인합니다.` |

### `/total` 데모 30초 멘트

> 이 화면은 광고 대시보드가 아닙니다. 대표가 믿고 의사결정할 수 있는 실제 매출 장부입니다.  
> 먼저 실제 결제완료와 환불을 기준으로 확정 순매출을 닫고, 그다음 Meta, Google, NPay, Organic 같은 유입 증거를 주문 단위로 붙입니다.  
> 그래서 플랫폼 ROAS가 아니라 내부 confirmed ROAS를 보고, 숫자가 안 맞는 부분은 unknown으로 숨기지 않고 다음 액션으로 바꿉니다.

### `/total` 데모 90초 멘트

> 기존에는 Meta, Google Ads, GA4, PG, 쇼핑몰 관리자 화면이 모두 다른 숫자를 보여줬습니다.  
> 저희는 먼저 실제 주문·결제·환불 기준으로 월별 확정 매출을 닫았습니다. 2026년 4월 biocom 기준 A/B confirmed net은 499,829,436원이고, primary channel 합계가 전체 매출과 일치하는지 검증했습니다.  
> 그 다음 유입 증거를 붙입니다. 예를 들어 Meta는 내부 confirmed revenue 기준 ROAS를 보고, Google은 기존 `구매완료` label이 NPay click/count 계열로 오염됐는지 분리합니다.  
> 중요한 것은 unknown을 없애 보이게 만드는 것이 아닙니다. 왜 unknown이 생겼는지, 어떤 수집기나 캠페인 맵핑을 고치면 줄어드는지 Action Queue로 바꾸는 것입니다. 이게 AI Value-up Control Tower의 목적입니다.

### `/total` 화면에서 피해야 할 문구

| 피할 문구 | 이유 | 추천 문구 |
|---|---|---|
| `Google ROAS 복구 완료` | confirmed purchase 전송/Primary 변경 전이다 | `Google click id 병목 위치 확인` |
| `NPay 문제` | NPay 자체가 문제가 아니다 | `NPay click/count와 실제 결제완료 분리` |
| `source freshness warn` | 비개발자는 이해하기 어렵다 | `이 데이터는 최신 판단에 쓰기 전 추가 확인이 필요합니다` |
| `platform_reference` | 발표용으로 딱딱하다 | `광고 플랫폼이 주장하는 참고값` |
| `internal_confirmed` | 처음 보면 어렵다 | `실제 결제 장부 기준 매출` |

## 6. 하네스 슬라이드 문구

### 슬라이드 제목

> **AI 직원에게는 작업장과 안전벨트가 필요하다**

### 한 줄 메시지

> 하네스는 AI가 안전한 일은 끝까지 밀고, 회사 숫자를 바꾸는 일은 사람 승인 없이는 멈추게 하는 운영 규칙이다.

### 화면 구성

| 영역 | 쉬운 설명 | 예시 |
|---|---|---|
| Green | 읽기, 문서, 로컬 검증처럼 안전한 작업 | BigQuery read-only 분석, no-send smoke |
| Yellow | 승인된 제한 실행 | GTM Preview only, 테스트 receiver 확인 |
| Red | 운영 숫자나 외부 플랫폼에 영향 | GTM Production publish, Google Ads 전환 변경, 운영 DB write |
| no-send/no-write | 밖으로 보내지 않고 저장도 안 하는 검증 | `would_send=false`, `would_store=false` |
| Lessons-to-Rules | 실수나 발견을 다음 규칙으로 승격 | `NPay click은 구매가 아니다` |

### 발표자 노트

> AI에게 자유를 주려면 먼저 경계가 있어야 합니다.  
> 하네스는 AI가 할 수 있는 일과 멈춰야 하는 일을 구분합니다.  
> 그래서 Codex는 읽기, 분석, 문서화, 로컬 검증, smoke test는 자율적으로 밀고, 운영 DB나 광고 플랫폼 숫자를 바꾸는 일은 TJ님 승인 없이는 멈춥니다.

## 7. 온톨로지 슬라이드 문구

### 슬라이드 제목

> **AI 조직은 같은 단어를 같은 뜻으로 써야 한다**

### 핵심 규칙

```text
Event is not Revenue
NPayClick is not Purchase
NPayCount is not Purchase
NPayActualConfirmedOrder is PaymentCompleteOrder
PlatformConversionClaim is not InternalConfirmedRevenue
Quarantine before Guess
No-send before Send
```

### 발표자 노트

> 이 프로젝트에서 단어 하나는 매출 숫자를 바꿉니다.  
> NPay click을 구매라고 부르면 Google Ads ROAS가 부풀고, 광고 플랫폼 전환값을 실제 매출이라고 부르면 예산 판단이 흔들립니다.  
> 그래서 우리는 ontology-lite, 즉 사람과 AI가 같이 쓰는 개념 사전을 만들었습니다.

## 8. 공개 범위 가이드

| 항목 | 내부 발표 | 외부 발표 추천 |
|---|---|---|
| 회사명 | biocom 사용 가능 | `Healthcare Brand A` 또는 TJ님 판단 |
| 499,829,436원 | 그대로 사용 가능 | `약 5억 원` |
| 0.8% / 97.75% | 그대로 사용 가능 | 그대로 사용 가능 |
| Meta spend/ROAS | 내부 숫자 사용 가능 | ROAS 배율 중심, 금액은 마스킹 권장 |
| GTM live version | 내부 기술 증거 | 발표에서는 생략 가능 |
| no-send/no-write | 하네스 차별점으로 사용 | 쉬운 말로 풀어서 사용 |

## 9. 발표 후 CTA

### CTA 1. AI Value Diagnostic

> 2주 안에 우리 회사의 AI 전환 병목, 데이터 신뢰도, 자동화 후보, 90일 실행 계획을 진단합니다.

### CTA 2. AI Revenue Intelligence

> 광고비를 쓰지만 ROAS와 실제 매출이 맞지 않는 회사의 주문·결제·유입 원장을 연결합니다.

### CTA 3. AI Roll-up Value-up Partner

> 여러 브랜드나 인수 대상 기업의 매출 장부, 광고 효율, AI 자동화 가능성을 실사하고 개선합니다.

### 발표 마지막 문장

> **AI 네이티브 조직은 AI를 많이 쓰는 조직이 아닙니다. AI가 회사의 매출 장부를 읽고, 문제 위치를 찾고, 안전한 범위에서 실행하고, 사람에게 필요한 결정만 요청하는 조직입니다.**

## 확인할 문서

TJ님이 발표 준비 전에 꼭 확인할 문서는 3개로 줄인다.

| 순서 | 문서 | 왜 보는가 |
|---:|---|---|
| 1 | [[!caio]] | 전체 CAIO 강연 메시지와 성과 정리 정본 |
| 2 | [[caio-presentation-deck-20260507]] | 실제 슬라이드 구조, 0.8% vs 97.75% 슬라이드, `/total` 데모 문구 |
| 3 | [[../total/!total-current]] | 현재 개발 프로젝트의 실제 정본과 Phase 상태 |

