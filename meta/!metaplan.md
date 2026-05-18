	# Meta 데이터 세트 제한 대응 플랜

작성 시각: 2026-05-18 13:24 KST
기준일: 2026-05-18
문서 성격: Green Lane 의사결정 문서 / Red 실행 전 승인 기준
대상: biocom Meta 광고, Pixel/Dataset, CAPI, UTM 기반 내부 매출 판단
작성 목적: Meta 데이터 소스 카테고리 제한으로 인한 광고 게재 제한을 막기 위해 오늘 무엇을 할지 결정한다.
Do not use for: Meta Ads Manager 설정 변경, 새 데이터 세트 연결, 새 광고 계정 생성, GTM Production publish, Meta CAPI 운영 전송, 운영DB write

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
    - docs/report/text-report-template.md
  project_harness_read:
    - total/!total-current.md
    - data/!datacheckplan.md
    - data/!data_inventory.md
    - imweb/!imwebplan.md
    - gdn/attribution-data-source-decision-guide-20260511.md
    - meta/meta-marketing-intent-gtm-plan-20260504.md
    - meta/meta-roas-gap-confirmation-runbook-20260504.md
    - meta/meta-utm-setup-growth-team-guide-20260504.md
    - capivm/meta-funnel-capi-gtm-first-plan-20260508.md
  required_context_docs:
    - Meta Ads Manager 사용자 제공 캡처 3장
    - Meta Business Tools Terms / Conversions API 공식 도움말 검색 결과
  lane: Green document only
  allowed_actions:
    - 프로젝트 구조 파악
    - 로컬 문서 read-only
    - 대응안 문서 작성
    - 승인 전 실행 기준 분리
  forbidden_actions:
    - Meta Ads Manager live campaign/adset/ad 변경
    - 새 데이터 세트 운영 연결
    - 새 비즈니스 포트폴리오 또는 광고 계정 생성
    - GTM Production publish
    - Meta CAPI / Pixel 신규 운영 전송
    - 운영DB write
    - backend deploy
  source_window_freshness_confidence:
    source: "사용자 제공 Meta Ads Manager/Imweb 캡처 + 로컬 정본 문서 + Meta 공식 도움말/약관 검색 결과"
    window: "캡처 기준 2026-05-11~2026-05-17, 2026-05-18 현재 화면"
    freshness: "문서 작성 2026-05-18 13:24 KST. Meta 공식 Data Source Category 문서는 로그인/차단 redirect로 본문 직접 확인 제한"
    confidence: 0.82
```

## 10초 요약

지금 결론은 **1안 단독 전환이 아니라, 1안의 빠른 복구력과 신규 랜딩/클린 이벤트 설계를 묶은 제한 병행안**이다.

기존 데이터 세트는 끄지 않는다. 다만 게재 제한이 붙은 광고세트는 새 데이터 세트만 바라보게 복제 테스트하고, 기존 세트는 내부 기준값과 Meta review 증거로 병행 관찰한다.

2안인 새 비즈니스 포트폴리오/광고 계정 신설은 오늘의 본대책이 아니라 보험이다. 같은 도메인과 같은 건강/검사 성격이면 새 계정도 다시 제한될 가능성이 있고, 예산 제한과 학습 초기화가 크다.

가장 중요한 원칙은 우회가 아니라 정합성이다. Meta에는 민감한 건강 상태로 해석될 수 있는 이벤트명, URL, parameter, 상품 상세값을 보내지 않고, 내부 예산 판단은 계속 Imweb/GA4 UTM과 VM Cloud/운영DB 결제완료 원장으로 본다.

## 성공 기준

오늘 성공은 광고 계정에서 버튼을 많이 누르는 것이 아니다.

1. 2026-05-18 안에 Meta 담당자에게 줄 결정이 생긴다: "기존 데이터 세트 유지 + 신규 클린 데이터 세트 제한 병행 + 새 포트폴리오는 예비 구축"으로 정한다.
2. Ads Manager에서 게재 제한이 붙은 광고세트와 붙지 않은 광고세트를 분리한다. 제한 표시, spend, 결과, 구매값, ROAS, 도달을 캡처한다.
3. 새 데이터 세트 또는 새 랜딩을 운영에 붙이기 전에는 어떤 이벤트와 parameter를 보낼지 preview 문서로 먼저 확인한다.
4. 내부 기준 매출은 Imweb `마케팅 성과 측정`, GA4 UTM, VM Cloud/운영DB confirmed order로 본다. Meta Ads Manager 구매값은 참고값으로만 둔다.

## 현재 관측

### Meta 화면에서 보이는 위험

사용자 제공 캡처 기준으로 Meta Ads Manager는 데이터 소스 카테고리 문제를 표시한다.

- 경고 문구 의미: 데이터 소스가 카테고리 기반으로 분류되어 일부 전환 이벤트가 차단될 수 있고, 광고 게재가 제한될 수 있다.
- 2026-05-18 화면에서 일부 광고세트에 `게재 제한됨` 표시가 이미 보인다.
- 오늘 화면의 다수 광고세트는 지출이 발생했지만 `웹사이트 구매 전환값`은 0원으로 보인다.

이것은 단순한 ROAS 리포트 문제를 넘어 광고 전달 자체가 막힐 수 있는 신호다.

### Imweb/UTM에서 보이는 사업 신호

사용자 제공 Imweb 캡처 기준 주말 성과는 Meta 유입이 아직 실제 매출에 기여하고 있음을 보여준다.

- 전체 주말 총매출: 27,546,076원
- 전체 방문자: 17,881명
- 전체 구매자: 84명
- 전체 평균 전환율: 0.47%
- Meta 유료 FB/IG: 방문자 14,305명, 구매자 44명, 매출 15,663,000원, 매출 비중 56.9%, 구매전환율 0.31%

해석: Meta 플랫폼 수신이 멈췄거나 제한되어도 Imweb UTM 기준 성과는 계속 잡힌다. 따라서 오늘 의사결정은 "Meta가 0으로 보이니 Meta 매출이 없다"가 아니라 "Meta 내부 최적화 신호가 막히는 동안 내부 원장으로 예산 판단을 이어간다"가 맞다.

### 기존 정본 문서와 맞는 지점

기존 `data/!datacheckplan.md`와 `total/!total-current.md`의 원칙은 이번에도 유지한다.

- Meta ROAS는 Meta가 주장하는 광고 공로 장부다.
- 내부 confirmed ROAS는 실제 결제완료 원장 기준 예산 판단값이다.
- NPay 클릭, 결제 시작, AddPaymentInfo는 구매 완료가 아니다.
- Meta/GA4/Google Ads/TikTok/Naver 전환 전송은 Red Lane이다.
- Pixel/CAPI 이슈는 "실제 구매 매출"과 "플랫폼 최적화 신호"를 분리해서 본다.

## 대안 판단

### 추천안 A: 신규 클린 데이터 세트 + 기존 데이터 세트 병행

Codex 추천: 진행 추천 86%.

오늘의 1순위다.

무엇을 하는가:

기존 데이터 세트는 그대로 두고, 새 데이터 세트는 클린 이벤트 설계와 제한된 광고세트 복제 테스트에만 쓴다. 기존 캠페인을 한 번에 모두 새 데이터 세트로 바꾸지 않는다.

왜 하는가:

이미 일부 광고세트에 게재 제한이 보이므로 복구 통로가 필요하다. 하지만 기존 데이터 세트에는 학습 이력과 증빙이 있고, 완전 종료하면 원인 조사와 review 대응 근거를 잃는다.

어떻게 하는가:

1. 기존 데이터 세트의 카테고리, 제한 메시지, Events Manager 진단, Purchase/AddToCart/InitiateCheckout 수신 상태를 캡처한다.
2. 새 데이터 세트는 민감한 URL path, 건강 상태를 암시하는 custom parameter, 상품/검사명 상세값을 보내지 않는 설계로 만든다.
3. 새 세트에 바로 full budget을 붙이지 않고, `게재 제한됨` 표시가 뜬 광고세트부터 제한 예산으로 복제한다.
4. 내부 매출 판단은 Imweb UTM과 confirmed order 기준으로 본다.

성공 기준:

- 새 데이터 세트가 Test Events 또는 제한 Preview에서 PageView/ViewContent/AddToCart/InitiateCheckout/Purchase 중 필요한 이벤트를 중복 없이 받는다.
- Purchase는 실제 결제완료 주문만 보낸다.
- 24~72시간 안에 `게재 제한됨` 표시가 새 복제 광고세트에서 반복되는지 확인한다.
- 내부 confirmed 매출과 Imweb UTM 매출이 캠페인/광고세트 단위로 계속 대조된다.

주의:

새 데이터 세트가 같은 도메인과 같은 랜딩을 보면 다시 같은 카테고리로 분류될 수 있다. 따라서 "새 세트를 만들면 해결"이 아니라 "새 세트 + 클린 랜딩/이벤트 + review 증거"가 한 묶음이어야 한다.

### 추천안 B: 신규 랜딩페이지를 함께 준비

Codex 추천: 진행 추천 82%.

1안과 같이 가야 하는 보강책이다.

무엇을 하는가:

Meta 광고용 첫 랜딩을 새로 만들되, 상품을 숨기는 페이지가 아니라 민감한 개인 건강 상태 추론을 줄인 설명형 랜딩으로 만든다. URL, 페이지 제목, 이벤트 parameter, form field, query string이 Meta 제한을 다시 부르지 않게 정리한다.

왜 하는가:

Meta의 데이터 소스 제한은 Pixel/CAPI 이벤트뿐 아니라 도메인/페이지 내용/URL/이벤트명/parameter가 함께 영향을 줄 수 있다. 기존 `음식물 과민증 검사` 계열 표현과 상세 상품명이 그대로 노출되면 새 데이터 세트도 빠르게 같은 제한을 받을 가능성이 높다.

어떻게 하는가:

1. 기존 광고 랜딩 중 고지출/고매출 페이지를 1개만 우선 고른다.
2. 새 랜딩은 "고객이 어떤 질환/증상을 가진 사람인지"를 직접 묻거나 암시하는 구조를 피한다.
3. 이벤트 parameter에는 `product_name`, `condition`, `symptom`, 상세 검사명, raw query, raw order/payment/member/email/phone을 보내지 않는다.
4. URL Parameters는 `utm_source=meta`, `utm_medium=paid_social`, `utm_campaign={{campaign.id}}`, `utm_term={{adset.id}}`, `utm_content={{ad.id}}`처럼 campaign mapping에 필요한 값만 둔다.
5. 랜딩 성과는 Meta Ads Manager 구매값보다 Imweb UTM/GA4/VM Cloud confirmed order로 검산한다.

성공 기준:

- 새 랜딩에서 Meta Pixel/CAPI payload preview에 민감한 원문 parameter가 없다.
- direct 방문은 Meta 유입으로 오인되지 않는다.
- 같은 event_id로 browser/server 중복 제거가 가능하다.
- 내부 원장에는 campaign/adset/ad id가 남는다.

주의:

랜딩을 "우회용 가짜 페이지"로 만들면 안 된다. 실제 상품/서비스와 다른 내용을 보여주는 방식은 광고 정책과 장기 운영 리스크가 크다. 목적은 카테고리 회피가 아니라 불필요한 민감 데이터 전송 제거다.

### 추천안 C: 새 비즈니스 포트폴리오 + 새 광고 계정

Codex 추천: 조건부 진행 48%.

오늘의 본대책이 아니라 보험이다.

무엇을 하는가:

새 비즈니스 포트폴리오와 새 광고 계정, 새 이벤트 세트를 준비해 기존 계정이 완전히 막히는 상황에 대비한다.

왜 조심해야 하는가:

같은 브랜드, 같은 도메인, 같은 상품, 같은 결제 흐름이면 새 계정도 같은 카테고리 제한을 받을 가능성이 높다. 또 신규 광고 계정은 일 예산 제한과 학습 초기화가 있어 단기 매출 방어력이 낮다.

언제 실행 가치가 생기는가:

- 기존 광고 계정 또는 비즈니스 자산 단위 제한으로 spend가 급감한다.
- 데이터 소스 review가 장기간 답이 없고, 기존 계정에서 신규 데이터 세트도 같은 제한을 반복한다.
- 새 랜딩/새 이벤트 설계가 먼저 준비됐다.
- Meta 담당자 또는 계정 지원에서 새 자산 병행을 명시적으로 문제없다고 안내한다.

성공 기준:

- 새 계정이 일 예산 제한 안에서 정상 spend를 시작한다.
- 같은 제한 경고가 72시간 안에 재발하지 않는다.
- 내부 UTM/confirmed 매출 기준 CAC가 기존 대비 크게 악화되지 않는다.

주의:

새 계정 신설은 제한을 회피하려는 동작으로 보일 수 있다. 문서상 목적은 우회가 아니라 계정 운영 연속성 확보와 clean data governance여야 한다.

### 비추천안 D: 기존 픽셀/데이터 세트 즉시 중단

Codex 추천: 진행 비추천 18%.

기존 픽셀을 바로 끄면 지금까지의 학습 이력, Events Manager 증거, review 대응 근거, 기존 캠페인 비교 기준을 잃는다.

다만 기존 데이터 세트가 특정 광고세트 게재를 명확히 막는 경우에는 그 광고세트만 새 세트 기준으로 복제 테스트하고, 기존 세트 원본은 비상 롤백과 증거 보존 목적으로 둔다.

## 기존 픽셀 병행 기준

기존 Pixel/Dataset은 당장 삭제하거나 pause하지 않는다.

권장 상태:

1. 기존 Pixel `1283400029487161`은 진단과 기존 캠페인 관찰용으로 유지한다.
2. 신규 데이터 세트는 제한 광고세트 복제 테스트와 클린 랜딩 실험에만 붙인다.
3. 같은 주문을 두 데이터 세트로 보낼 경우 내부 리포트에서는 절대 합산하지 않는다.
4. Meta Ads Manager의 두 데이터 세트 purchase value는 예산 판단값이 아니라 참고값이다.
5. 내부 예산 판단은 Imweb UTM, GA4 UTM, VM Cloud/운영DB confirmed order를 primary로 둔다.

중요:

Browser Pixel과 CAPI를 함께 쓰는 경우에는 같은 데이터 세트 안에서 `event_name + event_id`가 맞아야 중복 제거가 가능하다. 데이터 세트가 2개면 Meta 내부 중복 제거 범위가 달라질 수 있으므로, 내부 원장에서 `source_dataset=old/new`를 분리해야 한다.

## 오늘 실행 순서

### 1. 제한 증거 고정

담당: TJ님 또는 Meta 계정 접근자.

무엇을 하는가:

Ads Manager와 Events Manager에서 제한 메시지를 캡처한다.

왜 하는가:

Meta review, 담당자 escalation, 신규 세트 전환 판단에 증거가 필요하다.

어디에서 하는가:

- Meta Ads Manager
- Events Manager > Data Sources > 해당 Pixel/Dataset > Settings 또는 Manage Data Source Categories
- Account Quality

성공 기준:

- 제한 메시지 원문, 대상 dataset/pixel id, 대상 ad set, 날짜, review status가 남는다.

승인 필요:

NO. read-only 캡처다.

### 2. 신규 데이터 세트 준비 승인

담당: TJ님 승인 + Codex/운영 담당 설계.

무엇을 하는가:

새 데이터 세트 생성과 테스트 연결을 승인할지 정한다.

왜 하는가:

게재 제한이 확대될 때 기존 데이터 세트만으로는 광고 delivery가 막힐 수 있다.

승인 전 확인:

- 새 데이터 세트 이름
- 연결할 도메인/랜딩
- 보낼 이벤트 목록
- 보내지 않을 parameter 목록
- 기존 Pixel 병행 범위
- 내부 리포트에서 old/new dataset 합산 금지 기준

승인 필요:

YES. Meta 외부 계정 설정과 운영 트래킹 영향이 있다.

### 3. 신규 랜딩 초안

담당: Codex.

무엇을 하는가:

Meta 광고용 클린 랜딩 1개를 문서/로컬 초안으로 만든다.

왜 하는가:

새 데이터 세트를 기존 민감한 랜딩에 그대로 붙이면 제한이 재발할 수 있다.

어떻게 하는가:

기존 `frontrule.md`, `imweb/!imwebplan.md`, `meta/meta-utm-setup-growth-team-guide-20260504.md`를 기준으로 광고용 랜딩의 문구, URL parameter, 이벤트 payload를 먼저 문서화한다.

성공 기준:

- raw PII 없음.
- 건강 상태/증상/검사 상세값이 event parameter로 나가지 않음.
- campaign/adset/ad id가 내부 원장에 남음.

승인 필요:

문서/로컬 초안은 NO. 운영 배포, GTM publish, 실제 광고 URL 교체는 YES.

### 4. 새 비즈니스 포트폴리오 준비는 보험으로 분리

담당: TJ님.

무엇을 하는가:

기존 계정 제한이 계속 확대될 때 쓸 새 포트폴리오/광고 계정 준비 여부를 결정한다.

왜 하는가:

계정 단위 delivery 제한이 오면 신규 데이터 세트만으로는 부족할 수 있다.

성공 기준:

- 새 계정의 예산 제한, 결제수단, 픽셀/도메인 인증, 권한, 담당자 접근 여부가 정리된다.

승인 필요:

YES. 외부 계정/결제/광고 운영 자산 생성이다.

## 외부 근거 메모

Meta 공식 문서/약관 검색 결과 기준:

- Meta Conversions API는 Pixel과 함께 쓰면 연결 안정성과 event match 품질을 높일 수 있지만, Meta Business Tools Terms와 privacy/data sharing restriction을 그대로 따른다.
- Meta Business Tools Terms 계열 문서는 Pixel, Conversions API, Offline Conversions 같은 Business Tools로 보내는 데이터가 건강, 금융, 기타 민감 정보와 관련될 수 있으면 제한될 수 있음을 명시한다.
- Meta Data Source Category 공식 도움말 URL은 웹 fetch에서 로그인/차단 redirect가 발생했다. 따라서 이 문서에서는 사용자 제공 Ads Manager 캡처를 1차 관측 근거로 두고, 계정 내 Events Manager에서 원문을 다시 확인해야 한다.

## 하지 않은 것

- Meta Ads Manager에서 캠페인/광고세트/광고를 수정하지 않았다.
- 새 데이터 세트나 새 광고 계정을 만들지 않았다.
- GTM Preview, GTM Production publish를 하지 않았다.
- Meta CAPI 또는 Pixel 신규 운영 전송을 하지 않았다.
- 운영DB, VM Cloud SQLite, 로컬DB에 write하지 않았다.
- backend/frontend 배포를 하지 않았다.

## Auditor verdict

Auditor verdict: PASS_WITH_NOTES

Notes:

- 이번 문서는 Green Lane 의사결정 문서다.
- 실제 새 데이터 세트 생성, 광고세트 복제, 새 광고 계정 생성, GTM publish, CAPI send는 모두 승인 전 실행 금지다.
- 가장 큰 residual risk는 Meta UI 원문과 review status를 Codex가 직접 확인하지 못했다는 점이다. blocker category는 `blocked_access`다.

## 다음 할일

### Codex가 할 일

1. 신규 랜딩/이벤트 payload preview 문서를 만든다.
   - Codex 추천: 진행 추천
   - 추천 방향에 대한 자신감: 84%
   - Lane: Green
   - 무엇을 하는가: 새 데이터 세트에 붙일 이벤트 목록과 보내지 않을 parameter 목록을 문서화한다.
   - 왜 하는가: 새 세트를 만들어도 기존 민감 신호를 그대로 보내면 제한이 반복될 수 있기 때문이다.
   - 어떻게 하는가: `meta/meta-utm-setup-growth-team-guide-20260504.md`와 `capivm/meta-funnel-capi-gtm-first-plan-20260508.md`를 기준으로 payload preview를 만든다.
   - 성공 기준: raw PII 0, 건강 상태/증상/검사 상세 parameter 0, confirmed purchase만 Purchase 후보.
   - 승인 필요: NO.

2. Imweb/GA4/VM Cloud 기준 Meta 유입 매출 비교표를 만든다.
   - Codex 추천: 진행 추천
   - 추천 방향에 대한 자신감: 78%
   - Lane: Green read-only
   - 무엇을 하는가: Meta Ads Manager가 0으로 보이는 기간에도 Imweb UTM과 내부 confirmed 매출이 얼마인지 분리한다.
   - 왜 하는가: 광고비 유지/감액 판단은 Meta 플랫폼 purchase value가 아니라 실제 결제완료 매출로 해야 하기 때문이다.
   - 어떻게 하는가: 접근 가능한 로컬/VM read-only API와 기존 원장 기준으로 source/window/freshness/confidence를 붙인다.
   - 성공 기준: `Meta 플랫폼 주장값`과 `내부 confirmed 매출`이 같은 표에서 분리된다.
   - 승인 필요: NO, read-only.

### TJ님이 할 일

1. Meta UI에서 제한 원문과 review 상태를 캡처한다.
   - Codex 추천: 진행 추천
   - 추천 방향에 대한 자신감: 92%
   - Lane: Green read-only
   - 무엇을 하는가: Events Manager와 Ads Manager에서 데이터 소스 제한 원문, 대상 dataset/pixel, review status, 제한된 ad set 목록을 캡처한다.
   - 왜 하는가: 새 데이터 세트 전환과 Meta 담당자 escalation의 근거가 된다.
   - 어떻게 하는가: Meta Ads Manager > 제한 표시가 뜬 광고세트, Events Manager > Data Sources > Settings 또는 Manage Data Source Categories, Account Quality 화면을 캡처한다.
   - 성공 기준: 제한 메시지 원문, 대상 자산 ID, 날짜, review 버튼/상태가 보인다.
   - Codex가 대신 못 하는 이유: 계정 로그인/2FA/권한이 필요하다.
   - 승인 필요: NO.

2. 신규 데이터 세트 제한 병행을 승인할지 결정한다.
   - Codex 추천: 조건부 진행 추천
   - 추천 방향에 대한 자신감: 86%
   - Lane: Yellow/Red boundary
   - 무엇을 하는가: 새 데이터 세트를 만들고, 제한된 광고세트부터 소규모 복제 테스트에 연결할지 승인한다.
   - 왜 하는가: 기존 데이터 세트 제한이 확대되면 광고 delivery가 막힐 수 있기 때문이다.
   - 어떻게 하는가: 승인 전 `새 dataset 이름`, `기존 pixel 병행 범위`, `보낼 이벤트`, `금지 parameter`, `테스트 예산 상한`, `중단 기준`을 정한다.
   - 성공 기준: 새 복제 광고세트가 24~72시간 동안 게재 제한 없이 spend/클릭/내부 UTM 매출을 만든다.
   - 실패 시 해석: 같은 도메인/랜딩/카테고리 문제로 재분류됐을 가능성이 높다. 이 경우 신규 랜딩과 이벤트 parameter audit을 먼저 본다.
   - Codex가 대신 못 하는 이유: Meta 외부 계정 설정과 광고 운영 자산 변경이다.
   - 승인 필요: YES.

3. 새 비즈니스 포트폴리오/광고 계정은 보험으로만 판단한다.
   - Codex 추천: 조건부 보류
   - 추천 방향에 대한 자신감: 48%
   - Lane: Red
   - 무엇을 하는가: 기존 계정이 account-level로 막힐 때 쓸 새 운영 자산을 준비할지 결정한다.
   - 왜 하는가: 새 계정은 예산 제한과 학습 초기화가 커서 오늘 매출 방어책으로 약하다.
   - 어떻게 하는가: 기존 계정 제한 확대, review 무응답, 새 데이터 세트 재제한 여부를 보고 결정한다.
   - 성공 기준: 새 계정이 정책 리스크 없이 최소 예산으로 정상 spend를 시작하고 내부 UTM 매출이 잡힌다.
   - 실패 시 해석: 같은 비즈니스/도메인/상품 카테고리로 재분류됐거나 신규 계정 신뢰도 제한이 걸렸을 가능성이 높다.
   - Codex가 대신 못 하는 이유: 외부 계정/결제/권한 생성이다.
   - 승인 필요: YES, 명시 승인 필요.
