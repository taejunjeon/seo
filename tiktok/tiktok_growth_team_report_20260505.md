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
최종 업데이트: 2026-05-07 13:08 KST
대상: TikTok 광고 담당 그로스팀
목적: 현재 TikTok 광고를 계속 집행할지, 중단/축소할지, 또는 제한된 재테스트를 할지 결정하기 위한 공유 보고서

## 10초 요약

현재 데이터 기준으로 TikTok 광고는 2026-05-08 ~ 2026-05-14 KST 7일간 일시 OFF 후 매출 영향도를 보는 쪽을 권장한다.

TikTok은 유입 세션은 충분하지만, 90% 스크롤과 체크아웃 진입이 Meta 대비 크게 낮고, 실제 결제완료 주문은 0건이다. 같은 측정 구조에서 Meta는 checkout, payment_success, confirmed가 정상적으로 잡히므로 “TikTok 구매를 우리가 놓쳤다”기보다는 “TikTok 유입이 구매 직전까지 거의 못 간다”는 해석이 더 강하다.

그로스팀 회신에 따르면 2026-04-29 수요일 예산 감액 이후 GA4 구매 전환은 0건인데 TikTok 대시보드는 약 590만원 매출을 주장했다. 따라서 지금 바로 재확대하기보다, 2026-05-08 ~ 2026-05-14 광고 OFF 기간에 실제 전체 매출이 줄어드는지 확인하고 다음 운영을 결정한다.

다만 현재 TikTok 광고가 “한 번 노출된 사람에게 다시 노출되지 않도록” 설정되어 있다면, 이 설정은 구매 전환에는 불리할 수 있다. 과거 이상한 스토커 고객 이슈 때문에 만든 안전장치였다는 맥락은 유지하되, OFF 테스트 이후에도 TikTok을 재개한다면 제한 완화는 별도 소액 테스트로만 검토한다.

## 2026-05-07 그로스팀 회신 반영

| 항목 | 그로스팀 의견 | Codex 해석 |
|---|---|---|
| 운영 제안 | 2026-05-08 ~ 2026-05-14 KST 7일간 TikTok 광고 OFF 후 매출 영향도 분석 | 동의. 현재는 실제 매출 기여를 판단하기 위해 가장 깨끗한 검증 방법 |
| 배경 | 2026-04-29 수요일 예산 감액 이후 GA4 구매 전환 0건, TikTok 대시보드 약 590만원 매출 주장 | 플랫폼 주장 매출과 내부 구매 신호가 계속 벌어져 있음 |
| 가설 | TikTok 스마트+ 캠페인이 머신러닝으로 UTM 세팅 URL이 아닌 다른 페이지로 랜딩시켰을 가능성 | 확인 가치는 있으나, 최초 세팅부터 스마트 세팅이었다면 2026-04-29 이후 갑자기 생긴 원인일 가능성은 낮음 |
| 가설 확인 | 최초 세팅 시점부터 스마트 세팅 진행. UTM 없는 페이지로 랜딩시켰을 가능성 낮음 | 현재 핵심 가설은 “랜딩 URL 이탈”보다 “TikTok 플랫폼 과대 attribution 또는 실제 assisted effect 여부”로 보는 편이 맞음 |
| 다음 판단 | OFF 기간 실제 매출 영향 확인 | 2026-05-08 ~ 2026-05-14 OFF 기간과 직전 7일, 전년/요일 보정 가능 구간을 비교 |

## 결론

| 판단 항목 | 현재 결론 |
|---|---|
| TikTok 광고 계속 집행 | 비권장 |
| 추천 운영 | 2026-05-08 ~ 2026-05-14 KST 일시 OFF 후 매출 영향도 분석 |
| 중단/대폭 축소 추천 자신감 | 90% |
| 구매 신호 누락 가능성 | 낮음 |
| 구매 신호 누락 가능성이 낮다는 판단 자신감 | 88% |
| 노출 1회 제한 완화 테스트 | 선택지로 검토 가능. 단, 소액/짧은 기간/명확한 중단 기준 필요 |

## Source / Window / Freshness

| 항목 | 값 |
|---|---|
| 사이트 | biocom.kr |
| 분석 기간 | 2026-04-27 ~ 2026-05-04 KST |
| 운영 검증 예정 기간 | TikTok 광고 OFF 2026-05-08 ~ 2026-05-14 KST |
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

현재 데이터 기준으로 TikTok 광고는 2026-05-08 ~ 2026-05-14 KST 7일간 일시 OFF 후 실제 매출 영향도를 보는 쪽을 권한다. 중단/대폭 축소 추천 자신감은 90%다.

메타, 구글, 센터 운영까지 동시에 봐야 하는 상황이면 TikTok을 계속 파는 비용 대비 기대값이 낮다. 지금은 Meta/Google에서 먼저 실제 confirmed가 나는 위닝 메시지와 소재 구조를 찾고, 그걸 TikTok용 숏폼으로 재가공해서 재확장하는 전략이 더 맞다.

## 2026-05-08 ~ 2026-05-14 OFF 테스트 해석 기준

이 테스트는 완전한 A/B 테스트가 아니다. 같은 기간에 계절성, 요일, 다른 채널 예산, 프로모션, 재고, 사이트 이슈가 섞일 수 있다. 그래도 현재 상황에서는 “TikTok이 실제 매출을 만들고 있는지”를 가장 빠르게 확인하는 운영 테스트다.

OFF 기간 판단은 TikTok 대시보드 매출이 아니라 내부 실제 결제완료 매출을 primary로 본다.

| 비교 항목 | Primary / 참고 | 이유 |
|---|---|---|
| 전체 사이트 confirmed 매출 | Primary | 광고를 껐을 때 실제 매출이 줄었는지 확인 |
| 전체 사이트 confirmed 주문수 | Primary | 고가 주문 1건에 흔들리지 않게 주문수도 같이 봄 |
| Meta/Google confirmed 매출 | Cross-check | TikTok OFF 기간에 다른 채널이 매출을 보완했는지 확인 |
| TikTok GA4 purchase | Cross-check | 현재 0건이므로 계속 0인지 확인 |
| TikTok VM confirmed | Cross-check | TJ 관리 Attribution VM 기준 TikTok 결제완료가 생기는지 확인 |
| TikTok 대시보드 매출 | 참고만 | 플랫폼 attribution 주장값이라 내부 매출 판단에는 직접 쓰지 않음 |

### OFF 테스트 결과 해석

| 결과 | 해석 | 다음 결정 |
|---|---|---|
| 전체 confirmed 매출이 유지되거나 상승 | TikTok 실매출 기여 낮음 | TikTok 중단 유지, Meta/Google 우선 |
| 전체 confirmed 매출이 뚜렷하게 하락 | TikTok이 직접 또는 assisted로 매출에 기여했을 가능성 | TikTok 재개 검토. 단, 소재/세팅 수정 후 재개 |
| 전체 매출은 유지되는데 TikTok 대시보드만 매출 감소 | TikTok 대시보드 매출은 과대 attribution일 가능성 강화 | TikTok 플랫폼 ROAS는 예산 판단에서 제외 |
| 전체 매출이 하락했지만 Meta/Google/프로모션도 동시에 변경됨 | TikTok OFF 효과 단독 판단 어려움 | 추가 7일 또는 제한 재테스트 필요 |

## 스마트+ 랜딩 URL 가설 판단

그로스팀 가설은 합리적인 확인 포인트다. 스마트+ 캠페인이 머신러닝에 따라 우리가 UTM을 붙인 URL이 아닌 다른 페이지로 보냈다면 GA4에서 TikTok 유입/구매가 빠질 수 있다.

다만 현재 회신 기준으로는 최초 세팅 시점부터 스마트 세팅이었고, 2026-04-29 수요일 예산 감액과 동시에 새로 생긴 현상일 가능성은 낮다. 그래서 이 가설은 “주요 원인”이라기보다 “보조 검산 항목”으로 둔다.

확인할 수 있는 방법은 세 가지다.

1. TikTok Ads Manager에서 캠페인별 Destination URL / Smart+ landing page 확장 설정을 확인한다.
2. GA4에서 TikTok sessionSource 또는 campaignName 기준 landing page 분포를 2026-04-29 전후로 비교한다.
3. TJ 관리 Attribution VM의 `marketing_intent` landing/referrer/utm 기록에서 `ttclid`는 있으나 UTM이 없는 유입 비중이 늘었는지 확인한다.

이 중 2, 3은 Codex가 read-only로 확인 가능하다. 1은 TikTok Ads Manager UI 권한이 필요하므로 그로스팀 또는 TJ님 확인이 필요하다.

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

### 선택지 A. TikTok 7일 일시 OFF 후 매출 영향도 분석

추천도: 90%

현재 가장 현실적인 선택이다. TikTok에서 실제 confirmed가 0건이고, 2026-04-29 수요일 예산 감액 이후에도 TikTok 대시보드는 약 590만원 매출을 주장하고 있어 내부 매출 기준 검증이 필요하다.

실행 방식:

1. 2026-05-08 00:00 KST부터 2026-05-14 23:59 KST까지 TikTok 광고를 OFF로 둔다.
2. 이 기간 전체 사이트 confirmed 매출과 주문수를 매일 기록한다.
3. 직전 7일과 비교하되, Meta/Google 예산 변경과 프로모션 여부를 같이 기록한다.
4. 2026-05-15 KST에 TikTok OFF 기간 리포트를 작성한다.
5. 매출 하락이 없으면 TikTok 중단을 유지하고, Meta/Google에서 위닝 메시지를 먼저 찾는다.
6. 매출 하락이 크면 TikTok 재개를 검토하되, 반복 노출 제한/소재/랜딩을 수정한 새 테스트로 재개한다.

성공 기준:

- OFF 기간에도 전체 confirmed 매출이 유지되거나, 하락 원인이 TikTok OFF 외 요인으로 설명된다.
- TikTok 대시보드 주장 매출과 내부 confirmed 기준의 차이를 더 명확히 분리한다.
- TikTok 재개 여부를 감이 아니라 실제 매출 영향 기준으로 결정한다.

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
| 1 | Red | TJ + 그로스팀 | 2026-05-08 ~ 2026-05-14 KST TikTok 광고 OFF 실행 | 현재 confirmed 0건인데 TikTok 대시보드는 약 590만원 매출을 주장해 실제 매출 영향 확인 필요 | OFF 기간 설정 완료, 기간 중 TikTok spend 0원 또는 최소 잔여 소진만 발생 | YES |
| 2 | Green | Codex | OFF 전 baseline 정리 | OFF 기간과 비교할 직전 7일 기준값이 필요 | 2026-05-01 ~ 2026-05-07 confirmed 매출/주문수, GA4/VM TikTok 지표 기록 | NO |
| 3 | Green | Codex | OFF 기간 일별 모니터링 | 매출 하락 여부와 TikTok 지연 전환 여부 확인 | 2026-05-08 ~ 2026-05-14 일별 confirmed, GA4 purchase, VM confirmed 기록 | NO |
| 4 | Green | 그로스팀 | 스마트+ 랜딩/UTM 설정 캡처 확인 | 랜딩 URL 이탈 가설을 보조 검산 | Destination URL, Smart+ landing setting, UTM 적용 화면 확보 | NO |
| 5 | Yellow | TJ + 그로스팀 | OFF 결과 후 반복 노출 제한 완화 소액 테스트 승인 여부 결정 | OFF로 매출 하락이 보이거나 TikTok 재개 필요성이 생겼을 때만 검증 | 3~5일 테스트 계획, 예산 상한, 중단 기준 확정 | YES |

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
