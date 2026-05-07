# CAIO 강연용 AI 네이티브 운영 OS 성과 정리

작성 시각: 2026-05-07 00:23 KST
상태: active draft
Owner: CAIO / AI Value-up
참고 정본: [[caio_gpt_0507]], [[front]], [[ai_rollup]], [[../total/!total-current]], [[../harness/!harness]], [[../ontology/!ontology]], [[../data/!datacheckplan]]
공통 하네스 정본: [[../harness/common/HARNESS_GUIDELINES]], [[../harness/common/AUTONOMY_POLICY]], [[../harness/common/REPORTING_TEMPLATE]]
하네스 fork 방지 기준: `harness/common/HARNESS_GUIDELINES.md`, `harness/common/AUTONOMY_POLICY.md`, `harness/common/REPORTING_TEMPLATE.md`를 복사하지 않고 CAIO 강연용 해석만 기록한다.
Do not use for: 실제 매출/광고 숫자 외부 공개 승인, 고객사 제안서 최종본, 투자자료 최종본

## 10초 결론

이번 CAIO 강연의 핵심 메시지는 `AI를 잘 썼다`가 아니다.

우리가 보여줄 것은 **AI가 회사 운영 방식을 어떻게 바꾸고, 그 결과를 매출·광고비·데이터 신뢰도·다음 액션으로 증명하는가**다.

현재 우리가 만드는 시스템은 단순 대시보드가 아니다. `주문·결제·환불 원장`, `광고 클릭 증거`, `플랫폼 주장값`, `내부 확정매출`, `AI 작업 하네스`, `온톨로지`를 묶은 **AI Value-up Operating System**이다.

강연에서 가장 강하게 쓸 성과는 이것이다.

> Google Ads 주문 원장에는 click id가 0.8%만 남아 있는 것처럼 보였지만, BigQuery로 다시 보니 Google Ads 랜딩 세션의 97.75%에는 click id가 살아 있었다.
> 즉 문제는 광고 URL이 아니라 랜딩 이후 checkout/NPay/주문 원장으로 이어지는 구간이었다.
> 우리는 이 병목을 찾아 `paid_click_intent v1` 수집 파이프라인을 운영에 게시했고, 이제 24h/72h 모니터링으로 실제 회복률을 확인하는 단계다.

이 문장은 강연에서 꼭 써야 한다.

> **AI는 답을 대신 내는 도구가 아니라, 회사가 어디서 돈을 벌고 어디서 새는지 스스로 찾아 고치는 운영 체계입니다.**

## 강연 메시지 요약표

| 섹션 | 핵심 메시지 | 보여줄 증거 | 발표용 표현 |
|---|---|---|---|
| 문제 제기 | 대부분 회사는 AI를 써도 성과를 측정하지 못한다 | 플랫폼 ROAS와 내부 confirmed ROAS 차이 | `AI 도입의 문제는 모델이 아니라 운영 장부가 없다는 것입니다` |
| 성과 증명 | 우리는 광고·결제·주문·환불을 주문 단위로 맞춘다 | A/B confirmed net `499,829,436원`, `primarySumMatchesRevenue=true` | `광고 플랫폼 숫자가 아니라 실제 입금 장부부터 닫았습니다` |
| Google Ads 사례 | 0.8% 문제를 97.75% 랜딩 보존률로 재해석했다 | 5/623건 vs 6,724/6,879세션 | `문제 위치를 감으로 찍지 않고 데이터로 좁혔습니다` |
| Meta 사례 | 플랫폼 주장값과 내부 매출을 분리했다 | Meta spend `28,559,014원`, 내부 confirmed `55,743,545원`, ROAS `1.95x` | `ROAS를 믿는 것이 아니라 ROAS가 왜 다른지 설명합니다` |
| NPay 사례 | NPay가 나쁜 것이 아니라 click/count를 구매로 보는 것이 문제다 | NPay actual confirmed 포함, click/count/payment start 제외 | `결제수단과 유입 채널을 섞지 않습니다` |
| 하네스 | AI가 안전한 일은 끝까지 밀고, 위험한 일은 멈춘다 | Green/Yellow/Red Lane, no-send/no-write, auditor | `AI 직원에게 작업장과 안전장치를 함께 준 것입니다` |
| 온톨로지 | 같은 단어를 같은 뜻으로 쓰게 만든다 | `PlatformConversionClaim != InternalConfirmedRevenue` | `AI 조직은 용어 사전이 있어야 확장됩니다` |
| 비즈니스화 | 이 구조는 고객사의 AI 전환 상품이 된다 | AI Diagnostic, Revenue Intelligence, Roll-up Value-up OS | `우리가 만든 것은 AI 컨설팅이 아니라 성과 검증 OS입니다` |

## 다음 할일

| 순서 | 상태 | 담당 | 할 일 | 왜 하는가 | 어떻게 하는가 | 성공 기준 |
|---:|---|---|---|---|---|---|
| 1 | 진행 가능 | Codex | 강연용 공개 가능 숫자와 비공개 숫자를 분리한다 | 실제 회사 숫자를 그대로 공개하면 민감하다 | 이 문서의 성과표를 `공개 가능`, `익명화 필요`, `내부 전용`으로 표시한다 | 발표 자료에 들어갈 숫자만 확정된다 |
| 2 | 진행 가능 | Codex + Claude Code | `/total`을 `AI Value-up Control Tower` 데모로 다듬는다 | 강연에서 실제 화면이 있어야 신뢰가 생긴다 | 총 확정 매출, platform gap, unknown, action queue를 데모 데이터로 구성한다 | 30초 데모 스크립트가 나온다 |
| 3 | 완료 | Codex | 0.8% vs 97.75% 사례를 슬라이드 1장으로 만든다 | 가장 이해하기 쉬운 기술 성과다 | [[caio-presentation-deck-20260507]]에 `문제처럼 보인 숫자`, `재분석`, `실행`, `다음 모니터링` 순서로 정리했다 | 비개발자도 병목을 이해한다 |
| 4 | 진행 가능 | Codex | 하네스와 온톨로지를 `AI 조직 운영 방식` 슬라이드로 정리한다 | 이 시스템의 차별점은 도구보다 운영 체계에 있다 | Green/Yellow/Red Lane, no-send, Lessons-to-Rules, ontology-lite를 한 장으로 압축한다 | AI 네이티브 조직 스토리가 만들어진다 |
| 5 | TJ 판단 | TJ님 | 실제 회사명/실제 금액 공개 범위를 정한다 | 강연 신뢰와 보안 사이의 균형이 필요하다 | `biocom` 실명 공개 또는 `Healthcare Brand A` 익명화 중 선택한다 | 발표자료 숫자 마스킹 기준 확정 |

## 1. 우리가 만든 것은 무엇인가

우리가 만드는 프로그램은 `AI Revenue Intelligence + Attribution OS`다.

쉽게 말하면 아래 질문에 답하는 시스템이다.

| 질문 | 기존 회사의 문제 | 우리 시스템의 답 |
|---|---|---|
| 이번 달 진짜 매출은 얼마인가 | GA4, Meta, Google Ads, PG, 쇼핑몰 값이 다 다르다 | 아임웹 주문, 토스 결제, NPay 실제 결제완료, 취소/환불로 내부 확정 순매출을 만든다 |
| 어느 광고가 진짜 돈을 벌었나 | 플랫폼 ROAS를 그대로 믿는다 | 플랫폼 주장값과 내부 확정매출을 분리해 비교한다 |
| 왜 ROAS가 다르게 나오나 | 원인을 모른 채 예산을 조정한다 | attribution window, NPay click/count 오염, UTM/click id 유실, campaign mapping 미확정으로 쪼갠다 |
| 무엇을 먼저 고쳐야 하나 | 보고서만 있고 실행 목록이 없다 | `Action Queue`로 다음 작업과 승인 필요 여부를 준다 |
| AI가 안전하게 운영 작업을 해도 되나 | AI가 어디까지 해도 되는지 불명확하다 | 하네스가 Green/Yellow/Red Lane으로 작업 범위를 통제한다 |

발표용 한 문장:

> **우리는 AI에게 보고서를 쓰게 한 것이 아니라, 회사의 매출·광고·데이터 운영을 고치는 작업장을 만들었습니다.**

## 2. 대표 성과 1: Google Ads 0.8% 문제를 97.75% 구조로 재해석

이 사례는 강연에서 가장 이해하기 쉽다.

처음에는 Google Ads confirmed purchase를 만들기 어렵다고 보였다.
운영 결제완료 주문 623건 중 Google click id가 남은 주문이 5건뿐이었다.
전체 기준 보존률은 **0.8%**였다.

이 숫자만 보면 결론은 절망적이다.

> `Google Ads click id가 주문까지 거의 안 남는다. 그러면 Google Ads confirmed purchase를 보내도 매칭이 안 된다.`

하지만 BigQuery로 분모를 다시 잡았다.

최근 7일 Google Ads 증거 세션은 6,879개였다.
이 중 URL 또는 collected traffic source에 `gclid/gbraid/wbraid`가 남은 세션은 6,724개였다.
보존률은 **97.75%**였다.

| 기준 | 분모 | click id 있음 | 보존률 | 해석 |
|---|---:|---:|---:|---|
| 운영 결제완료 주문 | 623건 | 5건 | 0.8% | 주문 원장에는 거의 안 남아 있다 |
| Google Ads 랜딩 세션 | 6,879세션 | 6,724세션 | 97.75% | 광고 랜딩에는 대부분 남아 있다 |
| 일반 결제 시작 세션 | 136세션 | 131세션 | 96.32% | checkout 초입까지는 상당히 살아 있다 |
| NPay 클릭 세션 | 577세션 | 575세션 | 99.65% | NPay intent 시점도 click id 연결 가능성이 높다 |

이 분석으로 문제가 바뀌었다.

나쁜 해석:

> Google Ads 데이터가 처음부터 망가졌다.

정확한 해석:

> Google Ads 랜딩에는 click id가 있다. 병목은 랜딩 이후 checkout/NPay/결제완료 주문 원장까지 click id를 보존하지 못하는 것이다.

실행한 조치:

- `paid_click_intent/no-send` receiver route를 만들었다.
- 운영 backend `att.ainativeos.net`에 no-write receiver를 배포했다.
- TEST/negative smoke를 통과했다.
- GTM live version `142 (paid_click_intent_v1_receiver_20260506T150218Z)`를 publish했다.
- live browser smoke에서 TEST gclid storage 저장, receiver 200, `would_store=false`, `would_send=false`를 확인했다.
- 실제 GA4/Meta/Google Ads 전환 전송은 0건이다.

발표용 표현:

> **AI와 데이터 원장을 같이 쓰면, 0.8%로 보이던 막다른 길이 97.75%의 회복 가능한 경로로 바뀝니다. 중요한 것은 숫자를 보는 것이 아니라, 올바른 분모를 찾는 것입니다.**

주의해서 말할 점:

- `0.8%가 97.75%로 복구 완료됐다`고 말하면 과장이다.
- 정확한 표현은 `0.8% 문제의 병목 위치를 찾아냈고, 97.75% 랜딩 증거를 주문 원장으로 이어 붙이는 파이프라인을 운영에 열었다`다.
- 실제 운영 회복률은 24h/72h 모니터링 후 확정한다.

## 3. 대표 성과 2: 플랫폼 ROAS가 아니라 내부 confirmed ROAS를 만든다

많은 회사가 Meta Ads Manager나 Google Ads 화면의 ROAS를 그대로 믿는다.
우리는 그렇게 하지 않는다.

우리 기준은 아래다.

```text
내부 confirmed ROAS = 내부 결제완료 원장 기준 확정 매출 / 광고비
플랫폼 reference ROAS = 광고 플랫폼이 주장하는 conversion value / 광고비
```

둘은 일부러 다르게 둔다.

왜냐하면 광고 플랫폼은 자기 attribution window, view-through, cross-device, 자체 전환 액션을 기준으로 값을 만든다.
반면 대표가 예산을 판단할 때 필요한 값은 실제 주문·결제·환불 기준 매출이다.

Meta 사례:

| 항목 | 값 |
|---|---:|
| 기간 | 2026-04-27~2026-05-03 KST |
| source | operational VM ledger |
| Meta spend | 28,559,014원 |
| Attribution confirmed revenue | 55,743,545원 |
| Attribution confirmed ROAS | 1.95x |
| Attribution confirmed orders | 185건 |
| unmapped confirmed revenue | 10,879,100원 / 33건 |

이 값의 의미:

- 내부 ROAS는 `실제 결제확정 원장에 Meta 근거가 붙은 매출` 기준이다.
- unmapped는 `매출은 있는데 캠페인 증거가 부족한 주문`이다.
- 상품군이 맞다고 캠페인 ROAS에 억지로 붙이지 않는다.

Google Ads 사례:

- Google Ads 화면의 ROAS는 내부 confirmed ROAS로 쓰면 안 된다.
- 기존 `구매완료` primary 전환값이 실제 confirmed order가 아니라 NPay count/click 계열 label에 크게 오염돼 있었다.
- 그래서 새 `BI confirmed_purchase`는 홈페이지 결제완료와 NPay 실제 결제완료만 후보로 설계한다.
- NPay click, NPay count, payment start는 구매에서 제외한다.

발표용 표현:

> **우리는 광고 플랫폼이 말하는 ROAS를 믿지 않습니다. 먼저 실제 돈이 들어온 장부를 닫고, 그다음 플랫폼 숫자가 왜 다른지 설명합니다.**

## 4. 대표 성과 3: 월별 실제 매출 장부를 닫는 구조

`/total` 프로젝트의 핵심은 월별 매출을 한 번만 세는 것이다.

2026년 4월 biocom A/B confirmed net 기준으로 `499,829,436원`을 만들었고, primary channel 합계가 전체 매출과 일치하는 것을 검증했다.

| 항목 | 값 |
|---|---:|
| A/B confirmed net | 499,829,436원 |
| ordersTotalAb | 2,216건 |
| 검증 | `primarySumMatchesRevenue=true` |

이 숫자는 GA4나 광고 플랫폼 값이 아니다.
아임웹 주문, 토스 결제, NPay 실제 결제완료, 취소/환불 보정을 묶어 만든 내부 매출 장부다.

발표용 표현:

> **AI 도입의 첫 단계는 자동화가 아니라 장부를 닫는 것입니다. 숫자가 믿을 수 있어야 AI가 추천하는 액션도 믿을 수 있습니다.**

## 5. 대표 성과 4: NPay를 `나쁜 결제수단`이 아니라 `정확히 분리할 대상`으로 재정의

NPay 자체는 문제가 아니다.
오히려 실제 결제완료 전환율이 높다면 좋은 결제수단이다.

문제는 `NPay click`, `NPay count`, `NPay payment start`를 구매로 학습시키는 것이다.

우리 원칙:

```text
NPayClick != Purchase
NPayCount != Purchase
NPayPaymentStart != Purchase
NPayActualConfirmedOrder == PaymentCompleteOrder
```

따라서 NPay 실제 결제완료 주문은 내부 매출에 포함한다.
다만 NPay click/count/payment start만 있는 이벤트는 구매로 보내지 않는다.

발표용 표현:

> **AI가 똑똑해지려면 먼저 좋은 신호와 나쁜 신호를 구분해야 합니다. 우리는 NPay를 막는 것이 아니라, NPay 실제 결제완료만 구매로 인정하도록 신호를 정리했습니다.**

## 6. 대표 성과 5: Meta CAPI와 중간 퍼널은 안전하게 분리

Meta Purchase CAPI는 운영 VM 로그 기준으로 `Purchase` operational send 1,255건, success 1,255건, duplicate 0건이 확인됐다.

이것은 우리 서버가 같은 주문을 중복 전송하지 않았다는 강한 증거다.
다만 Meta Events Manager에서 Browser/Server dedup이 완전히 닫혔다는 뜻은 아니다.
그래서 문서에서는 `VM server send 성공`과 `Meta Events Manager dedup 확인`을 분리한다.

중간 퍼널 CAPI는 더 조심스럽게 다룬다.

| 이벤트 | 현재 방침 |
|---|---|
| ViewContent | test-only |
| AddToCart | test-only |
| InitiateCheckout | test-only |
| AddPaymentInfo | test-only |
| Purchase | 운영 send 로그 있음, dedup UI 확인은 별도 |

발표용 표현:

> **AI 네이티브 조직은 빠르게 움직이지만, 외부 플랫폼 숫자를 바꾸는 작업은 항상 no-send, dry-run, approval gate를 먼저 통과합니다.**

## 7. 하네스: AI가 스스로 더 잘 일하게 만드는 작업장

하네스는 이번 강연에서 반드시 강조해야 한다.
우리의 차별점은 `Codex를 썼다`가 아니라, **Codex가 안전하게 더 멀리 갈 수 있는 작업 환경을 만들었다**는 것이다.

하네스 도입 전에는 AI에게 매번 길게 설명해야 했다.
무엇을 읽어야 하는지, 어디까지 해도 되는지, 무엇을 하면 안 되는지, 결과보고는 어떻게 해야 하는지, 매번 다시 알려줘야 했다.

하네스 도입 후에는 구조가 생겼다.

| 구성요소 | 역할 | 실제 효과 |
|---|---|---|
| `AGENTS.md` | AI의 기본 운영 규칙 | 세션이 재개돼도 같은 기준으로 시작 |
| `docurule.md` | 문서 작성 품질 기준 | 대표가 읽을 수 있는 결과보고 유지 |
| Green/Yellow/Red Lane | 작업 위험도 분리 | 안전한 작업은 자율 진행, 위험한 작업은 승인 대기 |
| no-send/no-write guard | 외부 전송과 운영 원장 변경 방지 | 플랫폼 숫자 오염 없이 dry-run 가능 |
| Auditor checklist | 결과 검증 | unrelated dirty file, stale number, 승인 누락 방지 |
| Lessons-to-Rules | 시행착오를 규칙으로 승격 | 한 번 배운 예외가 다음 작업의 안전장치가 됨 |
| Active Action Board | 다음 작업 정렬 | Phase 번호보다 실제 개발 순서 중심으로 진행 |

실제 변화:

- Codex가 BigQuery read-only 분석을 자율 진행했다.
- 운영 VM SSH 직접 실패를 `taejun` 경유로 우회했다.
- backend no-write receiver route를 배포했다.
- TEST/negative smoke를 수행했다.
- GTM live version 142를 publish했다.
- live browser smoke까지 확인했다.
- 금지선인 Google Ads 전환 변경, conversion upload, 운영 DB/ledger write, GA4/Meta/Google Ads 실제 전송은 하지 않았다.

이것이 AI 네이티브 조직의 핵심이다.

> **사람이 모든 클릭을 지시하는 조직이 아니라, AI가 안전한 범위 안에서 스스로 조사하고, 개발하고, 검증하고, 보고하고, 배운 것을 규칙으로 남기는 조직.**

발표용 표현:

> **저희가 만든 하네스는 AI 직원의 업무 매뉴얼이자 안전벨트입니다. 안전한 일은 끝까지 밀게 하고, 회사 숫자를 바꾸는 일은 사람 승인 없이는 멈추게 합니다.**

## 8. 온톨로지: AI 조직의 공통 언어

온톨로지는 어렵게 말하면 개념 체계다.
쉽게 말하면 `같은 단어를 같은 뜻으로 쓰게 하는 사전`이다.

이 프로젝트에서는 용어 혼선이 곧 돈의 혼선이 된다.

예를 들어:

- `NPay click`을 구매라고 부르면 Google Ads ROAS가 부풀 수 있다.
- `GA4 purchase`를 내부 매출이라고 부르면 환불/취소가 빠질 수 있다.
- `platform conversion value`를 실제 매출이라고 부르면 예산 증액 판단이 흔들린다.
- `source_unavailable_before_publish`를 단순 unmatched로 부르면 수집기가 없던 과거 데이터를 잘못 평가한다.

그래서 우리는 `Attribution Ontology Lite`를 만들었다.

핵심 규칙:

```text
Event is not Revenue
ExternalPaymentIntent is not Purchase
PlatformConversionClaim is not InternalConfirmedRevenue
PaymentCompleteOrder can become ConfirmedPurchaseCandidate
Quarantine before Guess
No-send before Send
```

이 구조가 있으면 Codex, Claude Code, 운영자, 개발자, 대표가 같은 언어로 일한다.
나중에는 특허 명세서, 제품 스키마, API 계약, 대시보드 문구에도 같은 구조를 쓸 수 있다.

발표용 표현:

> **AI 조직은 프롬프트만으로 돌아가지 않습니다. 같은 개념을 같은 뜻으로 쓰게 하는 온톨로지가 있어야 사람과 AI가 함께 확장됩니다.**

## 9. 비즈니스 가치

이 시스템은 내부 운영 도구를 넘어 상품이 될 수 있다.

### 상품 1. AI Value Diagnostic

2주 안에 고객사의 AI 전환 성숙도, 데이터 병목, 광고비 누수, 반복 업무 자동화 후보를 진단한다.

고객이 얻는 것:

- 현재 AI 수준
- 데이터 병목 지도
- Quick Win 10개
- 90일 실행 로드맵
- 경영진용 보고서

### 상품 2. AI Transformation Sprint

6주 동안 특정 업무나 매출 흐름 하나를 실제로 바꾼다.

예:

- 광고비 낭비 분석
- CS 반복질문 자동화
- 주문/결제/환불 원장 연결
- GA4/GTM/CAPI 정합성 개선
- 액션 큐 운영 도입

### 상품 3. AI Revenue Intelligence

8주~12주 동안 고객사의 매출·광고·데이터 관제탑을 구축한다.

제공물:

- 내부 확정 순매출 원장
- 채널별 내부 ROAS
- 플랫폼 ROAS gap 리포트
- unknown/quarantine 원인 분석
- 월간 close 프로세스
- AI Action Queue

### 상품 4. AI Roll-up Value-up OS

멀티 브랜드, 다지점, PE 포트폴리오, 인수 대상 기업의 AI 밸류업 성과를 검증한다.

핵심은 이것이다.

> 회사를 사거나 확장하기 전에, 그 회사의 광고 효율과 매출 장부가 진짜인지 확인한다.
> 인수 후에는 AI 자동화와 운영 개선이 실제 매출·마진·광고비 효율로 이어졌는지 측정한다.

## 10. 강연에서 쓸 수 있는 핵심 문장

### 오프닝

> AI 도입은 챗봇을 쓰는 일이 아닙니다. 회사의 매출, 광고비, 데이터, 의사결정 흐름을 다시 설계하는 일입니다.

### 문제 제기

> 많은 회사가 AI를 도입했지만, 매출이 얼마나 늘었는지, 비용이 얼마나 줄었는지, 어떤 채널이 진짜 돈을 벌었는지 설명하지 못합니다.

### 우리 사례

> 저희는 먼저 우리 회사에서 실험했습니다. 광고 플랫폼 숫자를 그대로 믿지 않고, 실제 주문·결제·환불 장부를 닫고, 플랫폼 주장값과 내부 확정매출을 주문 단위로 비교했습니다.

### Google Ads 사례

> 처음에는 Google Ads 주문 중 click id가 0.8%만 남아 있는 것처럼 보였습니다. 그런데 BigQuery로 랜딩 세션을 다시 보니 97.75%에는 click id가 남아 있었습니다. 문제는 광고가 아니라 checkout과 결제 원장으로 이어지는 중간 구간이었습니다.

### 하네스 사례

> AI가 일을 잘하려면 모델만 좋으면 안 됩니다. 작업 규칙, 금지선, 검증, 승인 게이트가 필요합니다. 저희는 이것을 하네스라고 부릅니다.

### 온톨로지 사례

> AI 조직에서는 단어 하나가 숫자를 바꿉니다. NPay click을 구매라고 부르면 ROAS가 부풀고, 플랫폼 전환값을 실제 매출이라고 부르면 예산 판단이 흔들립니다. 그래서 저희는 AI와 사람이 같은 언어를 쓰게 하는 온톨로지를 만들었습니다.

### 사업화

> 이 플레이북은 우리 회사만의 이야기가 아닙니다. 광고비를 쓰고, 여러 툴에 데이터가 흩어져 있고, AI를 성과로 연결하고 싶은 모든 회사에 적용할 수 있습니다.

## 11. 발표용 숫자 후보

| 영역 | 숫자 | 강연 사용 방식 | 공개 주의 |
|---|---:|---|---|
| Google Ads 주문 기준 click id | 5/623건, 0.8% | 문제 발견 | 내부 숫자. 익명화 가능 |
| Google Ads 랜딩 기준 click id | 6,724/6,879세션, 97.75% | 병목 재해석 | 강하게 사용 가능 |
| 일반 결제 시작 click id | 131/136세션, 96.32% | checkout 초입까지 증거 보존 가능성 | 내부 숫자 |
| NPay 클릭 click id | 575/577세션, 99.65% | NPay intent 연결 가능성 | 내부 숫자 |
| 2026년 4월 A/B confirmed net | 499,829,436원 | 내부 매출 장부 사례 | 금액 마스킹 권장 |
| Meta spend | 28,559,014원 | 플랫폼 지출 예시 | 금액 마스킹 권장 |
| Meta internal confirmed revenue | 55,743,545원 | 내부 ROAS 예시 | 금액 마스킹 권장 |
| Meta internal ROAS | 1.95x | 플랫폼 ROAS와 내부 ROAS 분리 | 사용 가능 |
| Meta unmapped revenue | 10,879,100원 / 33건 | unknown을 action으로 바꾸는 사례 | 금액 마스킹 권장 |
| Meta Purchase CAPI server send | 1,255건 success, duplicate 0건 | server guard 성과 | Events Manager dedup 확정으로 말하지 않기 |

## 12. 공개 표현 가이드

강하게 말해도 되는 것:

- AI가 매출·광고·데이터 운영 방식을 바꿨다.
- 플랫폼 ROAS와 내부 confirmed ROAS를 분리했다.
- Google Ads click id 병목을 주문 원장 문제가 아니라 랜딩 이후 연결 문제로 좁혔다.
- 하네스가 AI 개발의 안전성과 속도를 동시에 올렸다.
- 온톨로지가 사람과 AI의 공통 언어가 됐다.

조심해야 하는 것:

- `0.8%가 97.75%로 복구됐다`는 표현은 아직 이르다.
- `Meta CAPI dedup 완전 해결`이라고 말하면 안 된다. VM server send 성공과 Meta Events Manager dedup은 다르다.
- `Google Ads ROAS가 완전히 고쳐졌다`고 말하면 안 된다. 아직 confirmed purchase 전송/Primary 변경은 보류 상태다.
- 실제 회사명과 실제 매출 금액 공개는 TJ님 판단이 필요하다.

추천 표현:

> 숫자가 좋아졌다고 말하기보다, 문제 위치를 찾고 회복 파이프라인을 열었다고 말한다.

## 13. 발표용 데모 구조

### 데모 1. AI Value-up Control Tower

보여줄 것:

- 내부 확정 순매출
- 채널별 내부 ROAS
- 플랫폼 주장값과 내부값 차이
- unknown/quarantine 사유
- source freshness
- 다음 액션

핵심 문장:

> 대표가 봐야 하는 것은 광고 관리자 화면이 아니라, 실제 돈 기준의 운영 관제탑입니다.

### 데모 2. Google Ads click id 병목 분해

보여줄 것:

- 주문 기준 0.8%
- 랜딩 기준 97.75%
- 병목 위치: checkout/NPay/주문 원장 연결
- 실행: paid_click_intent v1
- 다음: 24h/72h monitoring

핵심 문장:

> AI는 단순히 그래프를 그리는 것이 아니라, 숫자가 틀어진 정확한 위치를 찾아 다음 액션으로 바꿉니다.

### 데모 3. 하네스와 온톨로지

보여줄 것:

- Green/Yellow/Red Lane
- no-send/no-write
- auditor checklist
- Lessons-to-Rules
- ontology-lite 핵심 규칙

핵심 문장:

> AI를 조직에 넣는다는 것은 사람 대신 AI가 막 움직이게 하는 것이 아닙니다. 안전한 작업장은 더 빠르게, 위험한 작업은 더 엄격하게 만드는 것입니다.

## 14. 최종 포지셔닝

이번 발표에서 TJ님이 팔아야 하는 것은 `AI 컨설팅`이 아니다.

팔아야 하는 것은 아래다.

> **AI Value-up Operating System**

더 구체적으로는:

> **AI Revenue Intelligence + Attribution OS**

한 줄 정의:

> 여러 브랜드와 사업의 실제 확정 매출, 유입 채널, 광고비, 전환 신호, unknown 누수, 플랫폼 주장값 차이를 주문 단위로 검증해 AI 밸류업의 성과를 증명하는 운영 OS.

이 시스템이 비즈니스에 주는 도움:

- 광고비 증액/감액 판단이 빨라진다.
- 플랫폼 ROAS 오염을 줄인다.
- NPay, GA4, Meta, Google Ads, Toss, Imweb 데이터를 같은 장부로 묶는다.
- unknown 매출을 액션 큐로 바꾼다.
- AI가 스스로 조사·개발·검증·보고하는 조직 운영 방식을 만든다.
- 다른 회사에도 2주 진단, 6주 스프린트, 8~12주 Revenue Intelligence 구축 상품으로 확장할 수 있다.

강연 마지막 문장 후보:

> **AI 네이티브 조직은 AI를 많이 쓰는 조직이 아닙니다. AI가 회사의 매출 장부를 읽고, 문제 위치를 찾고, 안전한 범위에서 실행하고, 사람에게 필요한 결정만 요청하는 조직입니다. 우리는 그 운영 OS를 우리 회사에서 먼저 만들고 있습니다.**

## 참고 문서

- [[caio_gpt_0507]]: CAIO 강연 전체 전략, 6주 준비 계획, 상품화 구조
- [[front]]: AI Value-up Control Tower 프론트엔드 방향
- [[ai_rollup]]: AI Roll-up / Value-up 사업 연결성
- [[../total/!total-current]]: 현재 개발 정본, Mode B 상태, Active Action Board
- [[../gdn/google-ads-landing-clickid-analysis-20260506]]: Google Ads 0.8% vs 97.75% 근거
- [[../harness/!harness]]: Growth Data Agent Harness 설계
- [[../ontology/!ontology]]: Attribution Ontology Lite
- [[../data/!datacheckplan]]: Meta ROAS, CAPI, source freshness, 정합성 근거
