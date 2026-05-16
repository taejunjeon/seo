# clean Meta landing experiment spec

작성 시각: 2026-05-16 01:51 KST

## 10초 요약

clean landing 실험은 새 광고 계정이나 두 번째 Pixel 없이 진행합니다.

기존 Meta 캠페인의 10~20% 예산만 3~7일 분리해, 건강/웰빙 민감 신호를 줄인 랜딩이 Ads attribution gap을 줄이는지 확인합니다.

## 목적

이 실험은 세 가지를 확인합니다.

1. Meta 유입이 어떤 랜딩에서 결제완료까지 가는지 더 선명하게 본다.
2. 건강/웰빙 민감 신호가 적은 랜딩에서 Ads Manager 구매 귀속이 회복되는지 본다.
3. CAPI payload에서 불필요한 건강 관련 custom data를 줄여도 구매 신호가 유지되는지 본다.

## 실험하지 않는 것

- 새 광고 계정 생성 안 함
- 두 번째 Pixel 삽입 안 함
- Meta send/backfill 안 함
- GTM publish 안 함
- 기존 전체 캠페인 URL 일괄 변경 안 함

## 랜딩 후보

| 후보 path | 역할 | 사용 이유 | 주의 |
|---|---|---|---|
| `/reviews` | 리뷰 중심 | 진단/질병 표현 없이 고객 경험을 보여주기 좋음 | 질병명, 검사명, 효능 보장 표현 금지 |
| `/customer-stories` | 고객 사례 | 후기/스토리로 설득하되 민감 건강 상태 추론을 줄임 | before/after 과장 금지 |
| `/wellness-guide` | 웰니스 가이드 | 건강 관심층을 받되 의료/진단 어휘를 줄임 | 검사/질환 키워드 최소화 |
| `/meta-clean-a` | 실험 전용 | 기존 랜딩과 분리해 측정하기 쉬움 | 운영 노출 전 콘텐츠 QA 필요 |

## 콘텐츠 원칙

사용 가능:

- 고객 후기
- 생활 습관/웰니스 일반 정보
- 서비스 흐름 설명
- 가격/배송/상담 안내
- 쿠폰/혜택

피해야 할 것:

- 질병명
- 진단/검사명 강조
- 특정 증상 기반 타겟팅 문구
- 치료/개선/효능 보장 표현
- 건강 상태를 추론할 수 있는 URL/query/custom_data

## URL / UTM 표준안

기본 템플릿:

```text
https://biocom.kr/meta-clean-a
  ?utm_source=meta
  &utm_medium=paid_social
  &utm_campaign=clean_landing_canary_202605
  &utm_content={{adset.name}}__{{ad.name}}
  &utm_term={{placement}}
```

주의:

- `utm_campaign`에는 질병/검사/증상 단어를 넣지 않습니다.
- campaign/adset/ad 이름은 사람이 읽을 수 있게 남기되, 건강 민감도를 낮춥니다.
- 기존 광고 전체에 적용하지 말고 1개 캠페인 또는 1개 광고세트에서 시작합니다.

## CAPI payload 최소화 후보

유지:

- event_name = Purchase
- event_id
- event_time
- value
- currency
- fbp
- fbc
- fbclid
- client IP/user agent, 단 정책 검토 범위 안

제거 또는 축소 후보:

- content_name
- product_name
- health-related custom_data
- event_source_url query string
- order URL에 붙은 민감 query
- 진단/검사/증상명이 드러나는 custom field

중요: CAPI payload 최소화는 구매 신호를 끄는 작업이 아닙니다. Meta에 꼭 필요한 구매 신호만 남기고, 민감하게 해석될 수 있는 부가 정보를 줄이는 작업입니다.

## 실험 설계

| 항목 | 제안 |
|---|---|
| 기간 | 3~7일 |
| 예산 | 기존 캠페인 일부 10~20% |
| 대상 | 기존 성과 캠페인 중 1개 캠페인 또는 1개 광고세트 |
| Pixel | 기존 `1283400029487161` 유지 |
| 계정 | 기존 광고 계정 유지 |
| 비교군 | 기존 랜딩 |
| 실험군 | clean landing |
| 핵심 지표 | Ads Manager ROAS, 내부 Meta evidence ROAS, gap, CAPI success, AddToCart/InitiateCheckout/AddPaymentInfo, purchase action key |
| 중단 조건 | Ads attribution 0 지속 + 내부 Meta evidence 없음, CAPI failure 증가, landing query stripping, 구매 전환 급락 |

## 성공 기준

1. clean landing에서 내부 Meta evidence 결제완료가 잡힌다.
2. CAPI events_received=1이 유지된다.
3. Ads Manager purchase/value가 기존 랜딩보다 늦게라도 붙는다.
4. 내부 ATT ROAS와 Ads Manager ROAS gap이 기존 랜딩보다 줄어든다.
5. 데이터 공유 제한 경고가 악화되지 않는다.

## 실패 시 해석

- 내부 Meta evidence는 있는데 Ads purchase만 계속 0이면 landing 문제가 아니라 Meta data source restriction 또는 Ads attribution 문제입니다.
- 내부 Meta evidence 자체가 낮으면 광고/랜딩 품질 문제입니다.
- CAPI가 실패하면 서버 전송/guard 문제입니다.
- AddToCart/InitiateCheckout은 있는데 Purchase만 없으면 purchase bridge 또는 Ads restriction 문제입니다.

## Claude Code handoff

Claude Code가 구현할 때 필요한 화면 구성:

1. 실험 랜딩 초안
   - path: `/meta-clean-a`
   - 리뷰/고객 경험 중심
   - 의료/진단/질병/효능 표현 배제

2. 실험 대시보드 카드
   - 기존 랜딩 ATT ROAS
   - clean landing ATT ROAS
   - 기존 랜딩 Ads ROAS
   - clean landing Ads ROAS
   - gap
   - CAPI health
   - purchase action key status

3. 경고 박스
   - `Ads Manager 값은 광고 플랫폼 주장값`
   - `내부 Meta evidence 값은 실제 결제완료 원장 기준값`
   - `전체 confirmed 매출은 Meta 성과가 아님`
