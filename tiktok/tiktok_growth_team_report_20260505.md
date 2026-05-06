# TikTok 광고 운영 판단 보고 - 그로스팀 전달용

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - docs/agent-harness/growth-data-harness-v0.md
  required_context_docs:
    - docurule.md
    - docs/report/text-report-template.md
  lane: Green
  allowed_actions:
    - read-only 데이터 근거 정리
    - 그로스팀 전달용 Markdown 문서 작성
    - 광고 운영 선택지와 판단 기준 제안
  forbidden_actions:
    - TikTok 광고 설정 변경
    - GTM Production publish
    - TikTok Events API 전송
    - GA4/Meta/Google 전환 전송
    - 운영DB write
    - TJ 관리 Attribution VM SQLite write
  source_window_freshness_confidence:
    source:
      - GA4 Data API / biocom property
      - TJ 관리 Attribution VM SQLite / attribution_ledger
    window: 2026-04-27 ~ 2026-05-04 KST
    freshness: API checked 2026-05-04T15:02:02Z, VM latest logged 2026-05-04T15:01:46Z
    confidence: 88%
```

작성 시각: 2026-05-05 14:27 KST
대상: TikTok 광고 담당 그로스팀
목적: 현재 TikTok 광고를 계속 집행할지, 중단/축소할지, 또는 제한된 재테스트를 할지 결정하기 위한 공유 보고서

## 10초 요약

현재 데이터 기준으로 TikTok 광고는 일시중단하거나 최소예산으로 낮추는 쪽을 권장한다.

TikTok은 유입 세션은 충분하지만, 90% 스크롤과 체크아웃 진입이 Meta 대비 크게 낮고, 실제 결제완료 주문은 0건이다. 같은 측정 구조에서 Meta는 checkout, payment_success, confirmed가 정상적으로 잡히므로 “TikTok 구매를 우리가 놓쳤다”기보다는 “TikTok 유입이 구매 직전까지 거의 못 간다”는 해석이 더 강하다.

다만 현재 TikTok 광고가 “한 번 노출된 사람에게 다시 노출되지 않도록” 설정되어 있다면, 이 설정은 구매 전환에는 불리할 수 있다. 과거 이상한 스토커 고객 이슈 때문에 만든 안전장치였다는 맥락은 유지하되, 전체 예산을 다시 키우기 전에 제한된 테스트로만 완화 여부를 검토한다.

## 결론

| 판단 항목 | 현재 결론 |
|---|---|
| TikTok 광고 계속 집행 | 비권장 |
| 추천 운영 | 일시중단 또는 최소예산으로 축소 |
| 중단/대폭 축소 추천 자신감 | 90% |
| 구매 신호 누락 가능성 | 낮음 |
| 구매 신호 누락 가능성이 낮다는 판단 자신감 | 88% |
| 노출 1회 제한 완화 테스트 | 선택지로 검토 가능. 단, 소액/짧은 기간/명확한 중단 기준 필요 |

## Source / Window / Freshness

| 항목 | 값 |
|---|---|
| 사이트 | biocom.kr |
| 분석 기간 | 2026-04-27 ~ 2026-05-04 KST |
| GA4 소스 | GA4 Data API / biocom property |
| 내부 원장 소스 | TJ 관리 Attribution VM SQLite / `attribution_ledger` |
| 운영DB 영향 | 없음. 개발팀 관리 PostgreSQL 운영DB write 없음 |
| VM freshness | 2026-05-04T15:01:46Z latest logged |
| 기준 API 확인 시각 | 2026-05-04T15:02:02Z |
| 데이터 자신감 | B+ / 88% |

## 핵심 비교

| 항목 | TikTok | Meta |
|---|---:|---:|
| GA4 세션 | 20,824 | 27,565 |
| 평균 체류 | 1분 43초 | 1분 54초 |
| 90% 스크롤 이벤트 | 299회 / 1.44% | 4,392회 / 15.93% |
| GA4 begin_checkout | 3회 / 약 0.014% | 488회 / 1.77% |
| GA4 구매 | 0건 / 0원 | 162건 / 약 4,766만원 |
| VM checkout 주문 | 5건 | 1,453건 |
| VM confirmed | 0건 / 0원 | 519건 / 약 1.44억원 |

TikTok에서 나온 11,900원 테스트 주문은 manual/test 주문으로 제외했다. 그래서 현재 “실제 TikTok confirmed”는 0건 / 0원이 맞다.

## 용어 풀이

| 용어 | 쉬운 의미 | 이번 판단에서의 역할 |
|---|---|---|
| GA4 세션 | 광고를 타고 들어온 방문 묶음 | 유입 모수 확인 |
| 평균 체류 | 방문자가 사이트에 머문 평균 시간 | 관심도 보조 지표 |
| 90% 스크롤 이벤트 | GA4 기본 scroll 이벤트. 보통 페이지 약 90% 깊이 도달 기준 | 콘텐츠를 끝까지 읽는지 확인 |
| begin_checkout | 결제 시작 화면으로 진입한 이벤트 | 구매 직전 단계 확인 |
| VM checkout 주문 | TJ 관리 Attribution VM에 남은 결제 시작 주문 기록 | 내부 원장 기준 체크아웃 진입 |
| VM confirmed | TJ 관리 Attribution VM 기준 실제 결제완료 주문 | 예산 판단에 가장 중요 |

주의: GA4의 90% 스크롤은 25/50/75/90처럼 구간별 스크롤 깊이를 모두 보는 지표가 아니다. 현재는 “거의 끝까지 읽은 이벤트”에 가깝다.

## 판단

구매 신호를 우리가 못 잡고 있을 가능성은 낮게 본다. 자신감은 88%다.

이유는 세 가지다.

1. 같은 수집 구조에서 Meta는 checkout, payment_success, confirmed가 대량으로 잡힌다. 즉 VM 원장이나 GA4가 전체적으로 죽어 있는 상태가 아니다.
2. TikTok은 유입 세션은 충분하지만 90% 스크롤과 체크아웃 진입이 Meta 대비 크게 낮다. 특히 checkout 진입률은 Meta가 약 120배 높다.
3. TikTok Purchase Guard, GTM marketing intent, VM event log, TikTok Test Events까지 검증했다. 따라서 “실제 구매는 있는데 TikTok만 못 잡는다”보다 “구매 직전 단계까지 거의 못 간다”가 더 강한 해석이다.

## 광고 운영 의견

현재 데이터 기준으로 TikTok 광고는 끄거나 최소예산으로 낮추는 쪽을 권한다. 중단/대폭 축소 추천 자신감은 90%다.

메타, 구글, 센터 운영까지 동시에 봐야 하는 상황이면 TikTok을 계속 파는 비용 대비 기대값이 낮다. 지금은 Meta/Google에서 먼저 실제 confirmed가 나는 위닝 메시지와 소재 구조를 찾고, 그걸 TikTok용 숏폼으로 재가공해서 재확장하는 전략이 더 맞다.

## 노출 1회 제한 설정에 대한 별도 검토

현재 TikTok 광고가 “한 번 노출된 사람에게 다시 노출되지 않도록” 설정되어 있다면, 이 설정은 구매 전환에 불리할 수 있다.

구매형 광고에서는 한 번 보고 바로 사는 사람보다, 여러 번 보고 상품을 이해한 뒤 구매하는 사람이 많다. 특히 건강기능식품, 고관여 상품, 신뢰가 필요한 상품은 반복 노출과 리마인드가 전환에 영향을 줄 수 있다. 현재 설정이 너무 강하면 TikTok이 관심을 보인 사람에게 다시 설득할 기회를 잃는다.

다만 이 설정은 과거 이상한 스토커 고객 이슈 때문에 바꾼 안전장치였다. 그래서 무작정 전체 해제하면 안 된다. 광고 효율 테스트와 고객 리스크 관리를 분리해서 봐야 한다.

### 먼저 확인할 것

그로스팀은 TikTok Ads Manager에서 이 제한이 정확히 어떤 방식으로 걸려 있는지 확인해야 한다.

| 확인 항목 | 확인 이유 |
|---|---|
| Frequency cap 설정인지 | 같은 사람에게 일정 기간 몇 회까지 보여줄지 제한하는 방식인지 확인 |
| Custom audience exclusion인지 | 한 번 본 사람을 제외 audience로 빼고 있는지 확인 |
| Campaign objective / Reach & Frequency 설정인지 | 캠페인 구조상 반복 노출이 막힌 것인지 확인 |
| 문제 고객 관련 exclusion list인지 | 과거 고객 리스크 방어용 설정이 어떤 audience에 연결되어 있는지 확인 |

정확한 설정명이 확인되지 않으면, “노출 제한 때문에 구매가 안 났다”고 단정하면 안 된다. 현재 수치만 보면 TikTok은 반복 노출 이전 단계에서도 체크아웃 진입이 매우 약하다.

## 선택지

### 선택지 A. TikTok 일시중단 또는 최소예산 축소

추천도: 90%

현재 가장 현실적인 선택이다. TikTok에서 실제 confirmed가 0건이고, Meta/Google/센터 리소스도 동시에 필요한 상황이라면 비용과 제작 리소스를 더 잘 되는 채널로 이동한다.

실행 방식:

1. TikTok 캠페인을 일시중단하거나 일 예산을 최소 수준으로 낮춘다.
2. 7일 동안 뒤늦게 들어오는 결제완료가 있는지 `/ads/tiktok`에서 확인한다.
3. Meta/Google에서 confirmed가 나는 메시지와 소재 구조를 먼저 찾는다.
4. 그 소재를 TikTok용 짧은 영상으로 재가공해 재진입한다.

성공 기준:

- TikTok 불필요 지출이 줄어든다.
- Meta/Google에서 구매완료 기준 소재 학습이 더 빨라진다.
- TikTok 재진입 시 “무엇을 검증할지”가 명확해진다.

### 선택지 B. 노출 1회 제한 완화 소액 테스트

추천도: 72%

그로스팀이 “반복 노출 제한 때문에 TikTok 전환이 막혔을 수 있다”고 판단한다면, 전체 예산을 살리는 대신 작은 테스트로만 확인한다.

실행 방식:

1. 기존 전체 캠페인을 그대로 키우지 않는다.
2. 별도 테스트 ad group을 만든다.
3. 한 번 노출 후 제외 설정을 완전히 풀기보다, 빈도 제한을 완화하는 방식으로 테스트한다.
4. 예산은 기존 대비 10~20% 수준 또는 하루 손실 허용액 안에서만 쓴다.
5. 테스트 기간은 3~5일로 제한한다.
6. 문제 고객 리스크가 있던 audience나 지역/연령/행동 조건은 가능한 한 별도 exclusion으로 유지한다.

성공 기준:

- TikTok 90% 스크롤률이 현재 1.44%에서 최소 5% 이상으로 개선된다.
- begin_checkout이 현재 3회 / 20,824세션 수준에서 의미 있게 상승한다.
- 최소 1건 이상의 실제 confirmed가 발생하거나, checkout 진입이 현재 대비 10배 이상 개선된다.
- 이상 고객/댓글/CS 리스크가 다시 커지지 않는다.

중단 기준:

- 3~5일 동안 confirmed 0건이 유지된다.
- begin_checkout/session이 0.05% 미만에 머문다.
- 댓글, DM, CS에서 과거 문제와 비슷한 리스크가 다시 보인다.

### 선택지 C. 현재 TikTok 예산을 그대로 유지

추천도: 20%

비권장이다. 현재는 유입 모수는 충분한데 구매 직전 행동이 약하다. 같은 기간 Meta는 구매와 confirmed가 잡히고 있으므로, 현재 TikTok 캠페인을 같은 방식으로 유지하면 추가 지출의 근거가 약하다.

## 그로스팀에 전달할 요청

1. 현재 TikTok에서 “한 번 노출된 사람에게 다시 노출하지 않는” 설정이 정확히 무엇인지 확인해 달라.
2. 이 설정이 frequency cap인지, audience exclusion인지, campaign objective 구조인지 캡처와 함께 공유해 달라.
3. 과거 스토커 고객 이슈를 막기 위해 반드시 유지해야 하는 exclusion 조건이 무엇인지 분리해 달라.
4. TikTok을 계속 테스트한다면 기존 캠페인 유지가 아니라 “반복 노출 제한 완화 소액 테스트”로 분리해 달라.
5. Meta/Google에서 실제 결제완료가 나는 소재의 후킹, 제품, 오퍼, 랜딩 구조를 TikTok용으로 재가공하는 방향을 우선 검토해 달라.

## 그로스팀에 공유할 한 문장

TikTok은 방문 수가 부족한 문제가 아니라, 방문 후 깊은 탐색과 체크아웃 진입이 Meta 대비 크게 약한 상태입니다. 현재 측정 체계상 구매를 놓쳤을 가능성은 낮으므로, TikTok은 일단 중단/축소하고, 반복 노출 제한 완화는 별도 소액 테스트로만 확인하는 것이 맞습니다.

## 하지 않은 것

| 항목 | 상태 |
|---|---|
| TikTok 광고 설정 변경 | 하지 않음 |
| TikTok Events API 전송 | 하지 않음 |
| GA4/Meta/Google 전환 전송 | 하지 않음 |
| GTM Production publish | 하지 않음 |
| 운영DB write | 하지 않음 |
| TJ 관리 Attribution VM SQLite write | 하지 않음 |

## 다음 액션

| 순서 | Lane | 담당 | 할 일 | 왜 하는가 | 성공 기준 | 승인 필요 |
|---:|---|---|---|---|---|---|
| 1 | Red | TJ + 그로스팀 | TikTok 캠페인 일시중단 또는 최소예산 축소 결정 | 현재 confirmed 0건이라 추가 지출 근거가 약함 | 지출이 줄고 7일 후 지연 confirmed도 0건이면 중단 판단 확정 | YES |
| 2 | Green | 그로스팀 | 현재 “1회 노출 후 재노출 제한” 설정 방식 확인 | 제한 방식이 frequency cap인지 exclusion인지 알아야 테스트 설계 가능 | 설정명/캠페인/캡처 확보 | NO |
| 3 | Yellow | TJ + 그로스팀 | 반복 노출 제한 완화 소액 테스트 승인 여부 결정 | 설정이 전환을 막았을 가능성을 작은 비용으로 검증 | 3~5일 테스트 계획, 예산 상한, 중단 기준 확정 | YES |
| 4 | Green | Codex | 축소/테스트 후 `/ads/tiktok`에서 GA4/VM 지표 재확인 | 실제 결제완료와 체크아웃 개선 여부 확인 | TikTok confirmed, checkout, scroll 변화 기록 | NO |

## Auditor verdict

Auditor verdict: PASS

- Lane: Green
- Mode: 문서 작성
- No-send verified: YES
- No-write verified: YES
- No-deploy verified: YES
- No-publish verified: YES
- No-platform-send verified: YES
- 운영DB write: NO
- TJ 관리 Attribution VM SQLite write: NO
- 판단 confidence: 88%
