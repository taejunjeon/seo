# Meta ROAS와 내부 Attribution ROAS 차이 정리

작성일: 2026-04-10

## 10초 요약

- Meta ROAS는 “PG/결제사 기준 확정 매출 ÷ 광고비”가 아니다. Meta가 Pixel, CAPI, 앱/오프라인 이벤트 등 연결된 비즈니스 도구에서 받은 전환 가치를 자기 attribution 기준으로 광고에 귀속한 값이다.
- 내부 Attribution confirmed ROAS는 전태준 대표님이 구축한 자체 솔루션 원장 기준으로, 실제 주문/결제 상태가 `confirmed`인 매출만 잡는 보수적인 운영 지표다.
- 현재처럼 Meta purchase ROAS가 Attribution confirmed보다 크게 높은 상황에서는, Meta가 더 넓게 잡고 있을 가능성이 크다. 다만 30일 Attribution ROAS는 rollout/cutover bias가 섞여 낮게 보일 수 있으므로 운영 headline으로 쓰기에는 거칠다.
- 지금 운영 메인값은 최근 7일 또는 14일 Attribution confirmed ROAS가 더 적합하다. Meta purchase ROAS는 “플랫폼 참고값”, confirmed+pending은 “확정 지연 보정 참고값”, 잠정 상한선은 내부 date/spend 축을 맞춘 뒤에도 Meta 기여 매출이 아니라 사이트 전체 상한값으로만 봐야 한다.

## 대표용 3줄 결론

- 지금 메인으로 볼 숫자: biocom 최근 7일 Attribution confirmed ROAS 0.92x
- 지금 headline으로 쓰지 말 숫자: 30일 confirmed ROAS 0.23x. rollout/cutover bias가 섞여 실제보다 비관적으로 보일 수 있다.
- 지금 가장 큰 리스크: Pixel/CAPI dedup 의심, biocom GTM/payment page 이벤트 품질, 캠페인별 Attribution ROAS `(unmapped)` 100%

## 공식 정의 표

| 항목 | 공식 문서 기준 의미 | 운영 해석 |
|---|---|---|
| `purchase_roas` | 구매에서 발생한 ROAS. Meta 문서는 이 값이 하나 이상의 연결된 Facebook Business Tools에서 받은 정보와 광고 attribution에 기반한다고 설명한다. | 웹사이트 Pixel만이 아니라 연결된 도구 전반에서 잡힌 구매 가치가 섞일 수 있다. 내부 확정 매출과 같은 개념이 아니다. |
| `website_purchase_roas` | 웹사이트 구매에서 발생한 ROAS. Meta 문서는 웹사이트 Facebook Pixel이 기록한 전환 가치와 광고 attribution에 기반한다고 설명한다. | Pixel 기반 웹 구매 ROAS에 더 가깝다. 그래도 Meta attribution이므로 결제 확정/취소/환불 원장과 1:1로 같다고 보면 안 된다. |
| `action_values` | 광고에 귀속된 모든 전환의 총 가치. | 우리 코드에서는 `action_values` 중 purchase 계열 값을 찾아 Meta 구매 가치 분자로 사용한다. 이 값도 “확정 매출”이 아니라 “Meta가 귀속한 전환 가치”다. |
| `action_attribution_windows` | 전환을 어느 기간/상호작용 기준으로 광고에 귀속할지 정하는 필터다. 예: click/view window. | window가 길거나 view-through가 포함되면 Meta 분자가 커질 수 있다. 수동으로 특정 window를 지정하면 Ads Manager 기본 attribution과 달라질 수 있다. |
| `use_unified_attribution_setting=true` | ad set 레벨의 unified attribution setting을 사용하고 account attribution setting은 무시한다. Meta 문서상 Ads Manager 값과 맞추려면 중요한 옵션이다. | Ads Manager parity를 목표로 하면 기본적으로 켜는 것이 맞다. 우리 `/api/ads` 계열은 기본적으로 이 옵션을 사용한다. |
| `action_report_time=impression` | 광고 노출/클릭이 발생한 날짜에 전환을 붙인다. | 4월 1일 광고를 보고 4월 2일 구매하면 4월 1일 성과로 보일 수 있다. 일별 원장과 어긋나기 쉽다. |
| `action_report_time=conversion` | 실제 전환이 발생한 날짜에 전환을 붙인다. | 내부 주문일/결제일 비교에는 `conversion`이 더 직관적이다. 우리 코드는 기본값을 `conversion`으로 둔다. |

## 우리 코드 상태

- `backend/src/routes/ads.ts`는 Meta Insights 호출 시 기본적으로 `action_report_time=conversion`, `use_unified_attribution_setting=true`를 넣고, `action_values`에서 purchase value를 합산한다.
- `backend/src/routes/meta.ts`의 `/api/meta/insights`도 기본 모드에서는 `action_report_time=conversion`, `use_unified_attribution_setting=true`를 넣는다.
- 단, `/api/meta/insights`에서 `attribution_window=1d_click`, `7d_click`, `28d_click`, `1d_view` 같은 수동 window를 요청하면 `action_attribution_windows`를 직접 넣는 custom override 모드가 된다. 이 경우 Ads Manager 기본 설정과 다를 수 있으므로 비교용 headline으로 쓰면 안 된다.
- 현재 코드의 `metaReference` 문구는 방향이 맞다. 핵심은 “Meta ROAS 분자는 PG confirmed revenue가 아니라 Meta가 광고에 귀속한 conversion value”라는 점이다.

## 우리 상황에의 적용

| 내부 비교 기준 | 사람이 읽는 의미 | 주의점 |
|---|---|---|
| Meta purchase ROAS | Meta가 광고에 귀속한 구매 가치 ÷ Meta 광고비 | 플랫폼 attribution 값이다. 확정 결제 매출이 아니다. |
| Attribution confirmed ROAS | 자체 솔루션 원장 기준, Meta 유입으로 확인되고 결제 상태가 확정된 매출 ÷ 광고비 | 운영 판단의 메인값으로 가장 보수적이다. 다만 rollout 전 구간에서는 낮게 보일 수 있다. |
| Attribution confirmed+pending ROAS | confirmed에 아직 확정 전/pending 주문을 더한 매출 ÷ 광고비 | 결제 확정 지연을 감안한 보조값이다. Meta처럼 넓은 attribution 모델은 아니다. |
| 잠정 상한선 | 전체 사이트 확정 매출을 광고비로 나눈 상한선 성격의 참고값 | Meta 기여 매출이 아니라 사이트 전체 매출 기준이다. 내부 site-summary/daily 축은 2026-04-10에 맞췄지만 Ads Manager export와 최종 대조 전까지는 확정 상한이 아니다. |

현재 관측치 기준으로는 최근 7일이 운영 판단에 더 적합하다.

2026-04-10에 date/spend 축을 맞춘 뒤 재측정한 biocom 최근 7일 기준은 아래와 같다.

- 기준 기간: 2026-04-03 - 2026-04-09
- site-summary와 daily 합계: spend ₩27,842,260, Attribution confirmed revenue ₩25,551,740, pending revenue ₩1,358,700, Meta purchase value ₩123,904,111
- 운영 메인: Attribution confirmed ROAS 0.92x
- 운영 보조: Attribution confirmed+pending ROAS 0.97x
- 플랫폼 참고: Meta purchase ROAS 4.45x
- 잠정 상한선: 3.16x

해석은 “Meta가 더 넓게 잡고 있다”가 맞다. pending을 더해도 0.97x 수준이면 4.45x와의 차이는 단순 결제 확정 지연만으로 설명하기 어렵다.

다만 기존 스크린샷의 30일 기준 0.20x vs 5.19x는 메시지는 강하지만 운영 headline으로 쓰면 위험하다. 2026-04-10 재측정 후에도 30일은 confirmed ROAS 0.23x, Meta purchase ROAS 5.25x로 격차가 크지만, 이 구간에는 footer/fetch-fix 반영 전 광고비와 cutover bias가 섞여 Attribution confirmed가 실제보다 낮게 보일 수 있다. 따라서 현재 기본 탭은 7일 또는 14일이 더 적합하다.

## 과장 가능성이 큰 쪽

Meta ROAS가 내부 확정 ROAS보다 높아질 수 있는 경로다.

- view-through attribution이 포함되면 클릭하지 않고 본 사람의 구매도 Meta 성과로 잡힐 수 있다.
- `purchase_roas`는 Pixel만이 아니라 연결된 Facebook Business Tools 기반 구매 가치가 섞일 수 있다.
- Pixel과 CAPI가 함께 들어오는데 `event_id`/주문번호 dedup이 불완전하면 중복 집계 위험이 있다.
- Meta의 attribution window가 내부 원장의 유입 확인 기준보다 넓으면 더 많은 주문이 Meta 성과로 귀속된다.
- Meta 전환 가치는 결제 확정, 취소, 환불, 네이버페이/토스 상태 정정이 내부 원장처럼 정교하게 반영되지 않을 수 있다.
- `action_report_time=impression`이나 Ads Manager 화면 설정이 섞이면 일별 비교에서 전환 날짜가 내부 주문일과 달라진다.
- privacy/modeling/aggregation 때문에 Ads Manager 값과 원장 값은 원천적으로 완전한 1:1 대사가 어렵다.

## 과소평가 가능성이 큰 쪽

내부 Attribution confirmed ROAS가 낮게 보일 수 있는 경로다.

- 30일/90일에는 rollout 전 구간, footer/fetch-fix 전 구간, 수집 누락 구간이 섞여 cutover bias가 생긴다.
- pending 주문이 아직 confirmed로 전환되지 않았으면 최근 구간도 조금 낮게 보인다.
- UTM campaign alias가 아직 campaign ID와 안정적으로 매칭되지 않으면 캠페인 drill-down에서 `(unmapped)`가 커진다.
- site-summary와 daily의 날짜축/광고비 축은 2026-04-10에 맞췄지만, Ads Manager export/timezone까지 대조하기 전에는 잠정 상한선을 확정 상한으로 읽으면 안 된다.
- 결제 성공 후 자체 솔루션 원장에 적재되는 식별자(`fbclid`, `fbc`, `fbp`, session/client 계열 값 등)가 일부만 들어오면 내부 attribution이 보수적으로 잡힌다.

## Top 3 Blocker

- Pixel/CAPI dedup 의심: `/api/meta/capi/log` summary 기준 CAPI log 692개가 모두 2xx 성공이고, unique event_id는 429개, 주문+이벤트 unique key는 426개다. 중복 전송/재시도/과거 테스트 로그를 분리해야 한다. Meta purchase ROAS 과대 가능성의 핵심 후보로 올려서 봐야 한다.
- biocom GTM/payment page 이벤트 품질: 결제완료 페이지 쪽 오류와 caller 식별자 coverage가 아직 낮다. `/api/attribution/caller-coverage` 기준 payment_success 662건 중 all-three coverage는 110건, 16.62%다.
- campaign drill-down: biocom `last_7d` 기준 90건/₩25,551,740가 전부 `(unmapped)`다. `meta_campaign_aliases.biocom.json`에는 15개 alias seed가 있지만 manual_verified는 0개다. 사이트 전체 Attribution ROAS는 사용 가능하지만, 캠페인별 Attribution ROAS는 아직 운영 판단값으로 사용 금지다.

## Ads Manager와 Marketing API 값이 어긋나는 대표 원인

- Ads Manager는 `purchase_roas`를 보고 있는데 API/우리 UI는 `action_values[purchase] ÷ spend`를 계산하는 경우
- Ads Manager는 ad set unified attribution setting인데 API는 수동 `action_attribution_windows` override를 넣은 경우
- Ads Manager 화면은 impression 기준, API는 conversion 기준처럼 `action_report_time`이 다른 경우
- date range, timezone, account spend, level, breakdown, campaign filter가 다른 경우
- Ads Manager column이 website purchase만 보는지, omni/purchase 전체를 보는지 다른 경우
- Pixel, CAPI, offline event, connected tools 중 어떤 소스가 포함되는지 다른 경우
- 데이터 freshness와 지연 처리 때문에 같은 날 조회 시점이 다른 경우

## 숫자 차이를 줄이기 위한 실행 체크리스트

1. Meta raw API snapshot을 같은 날짜/계정/레벨로 저장한다. 필드는 `spend`, `actions`, `action_values`, `purchase_roas`, `website_purchase_roas`를 함께 요청한다.
2. `/api/ads/site-summary`, `/api/ads/roas/daily`, `/api/meta/insights`의 요청 파라미터와 응답 raw JSON을 같은 기간으로 저장한다.
3. site-summary와 daily의 날짜축/광고비 축을 먼저 맞춘다. 내부 API 기준 축은 2026-04-10에 맞췄고, Ads Manager export와 최종 대조 전까지 잠정 상한선은 확정 상한이 아니다.
4. 운영 화면 기본 기간은 7일 또는 14일로 둔다. 30일은 “rollout bias가 섞인 보수치”라고 명시한다.
5. UI 라벨을 “Meta purchase ROAS” 또는 “Meta 귀속 구매 가치 기준 ROAS”로 유지하고, “확정 매출 ROAS”처럼 읽히지 않게 한다.
6. Pixel/CAPI dedup을 점검한다. 같은 주문이 browser Pixel과 server CAPI에서 동시에 들어간다면 `event_id` 또는 주문번호 기반 dedup이 되는지 확인한다.
7. campaign drill-down은 alias seed와 manual_verified matcher가 안정화되기 전까지 운영 판단 headline으로 쓰지 않는다.
8. confirmed+pending을 보조값으로 같이 보여준다. pending을 더해도 Meta 격차가 크면 “결제 확정 지연”이 주원인이 아니라는 근거가 된다.

## 2026-04-10 실행 결과와 현재 완료율

이번에 실제로 먼저 실행한 항목은 “date/spend 축 맞추기”, “account_id별 내부 주문 필터”, “Meta 공식 ROAS 필드 확인 가능화”다.

| 항목 | 현재 완료율 | 이번에 실행한 내용 | 남은 일 |
|---|---:|---|---|
| site-summary와 daily의 날짜축/광고비 축 맞추기 | 95% | `last_7d`, `last_14d`, `last_30d`, `last_90d` 내부 계산을 Meta rolling preset처럼 “어제까지의 완료일” 기준으로 변경했다. 2026-04-10 조회 기준 biocom `last_7d`는 양쪽 모두 2026-04-03 - 2026-04-09, spend ₩27,842,260으로 일치한다. `last_30d`도 양쪽 모두 2026-03-11 - 2026-04-09, spend ₩116,676,439로 일치한다. | Ads Manager 화면 export와 timezone까지 사람이 한 번 더 대조하면 100%로 볼 수 있다. |
| account_id별 내부 주문 필터 | 100% | `/api/ads/roas`와 `/api/ads/roas/daily`가 biocom account_id를 받을 때 biocom 주문만 쓰도록 고쳤다. 이전에는 daily pending에 thecleancoffee pending ₩262,914가 섞일 수 있었다. | 없음. 새 계정을 추가할 때 `SITE_ACCOUNTS`만 같이 업데이트하면 된다. |
| Meta 공식 ROAS 필드 raw 확인 | 80% | `/api/meta/insights` 요청 필드에 `purchase_roas`, `website_purchase_roas`를 추가했다. biocom `last_7d` 첫 캠페인에서 두 필드 모두 5.463816로 정상 반환되는 것을 확인했다. | `/api/ads/site-summary`/`daily`에도 공식 ROAS 원필드를 보조 필드로 노출할지 결정이 남아 있다. 운영 계산값은 지금처럼 `action_values[purchase] ÷ spend`로 유지해도 된다. |
| 운영 화면 기본값과 라벨 | 95% | `/ads`, `/ads/roas` 기본 기간은 `last_7d`이고, 30일은 rollout bias가 섞인 보수치라고 표시되어 있다. confirmed+pending, Meta purchase, 잠정 상한선도 구분되어 있다. | 프론트 화면에서 실제 문구가 너무 길면 짧은 tooltip로 정리하는 정도만 남았다. |
| raw JSON snapshot 보관 | 90% | 2026-04-10 기준 `ads_site_summary_last7d_20260410.json`, `ads_roas_daily_biocom_last7d_20260410.json`, `meta_insights_biocom_last7d_20260410.json`를 추가했다. 세 파일은 모두 2026-04-03 - 2026-04-09, biocom spend ₩27,842,260, Meta purchase value ₩123,904,111 세트다. | Ads Manager 화면 캡처와 export 조건값이 아직 붙지 않아 100%는 아니다. |
| campaign drill-down | 20% | biocom `last_7d` 기준 캠페인 테이블은 90건/₩25,551,740가 전부 `(unmapped)`로 남아 있음을 확인했다. `meta_campaign_alias_audit.biocom.json`은 2026-04-03 - 2026-04-09 범위로 존재하고 aliasCandidates 18개를 담고 있지만, `meta_campaign_aliases.biocom.json`의 15개 seed 중 manual_verified는 0개다. | alias seed를 manual_verified 기준으로 matcher에 태우고, unmapped 비율을 100%에서 단계적으로 낮춰야 한다. |
| Pixel/CAPI dedup | 60% | `/api/meta/capi/log` summary에 duplicate event id와 duplicate order-event key 진단 값을 추가했다. 현재 summary 기준 CAPI log 692개는 모두 2xx 성공이고 unique event_id 429개, unique order-event key 426개라 중복 의심이 명확히 보인다. | 전송 차단 로직은 Meta 전송 정책에 영향을 주므로 즉시 바꾸지 않았다. order_id 기준 중복인지, 같은 이벤트 재시도인지, 과거 테스트 로그인지 먼저 분리한 뒤 승인 받고 고쳐야 한다. |
| caller 식별자 coverage | 35% | `/api/attribution/caller-coverage` 기준 payment_success 662건 중 all-three coverage는 110건, 16.62%다. 최근 일부 유입은 시작됐지만 내부 attribution을 충분히 강하게 만들 수준은 아니다. | 결제완료 caller에서 `ga_session_id`, `client_id`, `user_pseudo_id`, Meta 식별자 계열 값이 안정적으로 들어오는지 계속 올려야 한다. |

이번 수정 뒤 핵심 비교값은 흔들림이 줄었다. biocom 최근 7일 기준 site-summary와 daily가 같은 숫자를 반환한다.

- confirmed ROAS: 0.92x
- confirmed+pending ROAS: 0.97x
- Meta purchase ROAS: 4.45x
- 잠정 상한선: 3.16x

30일도 date/spend 축은 맞았다. 다만 2026-03-11 - 2026-04-09 기준 confirmed ROAS 0.23x, confirmed+pending ROAS 0.25x, Meta purchase ROAS 5.25x라서 여전히 rollout/cutover bias 주석을 달고 읽어야 한다.

## 추가로 필요한 데이터 목록

- 같은 date range와 account 기준의 Meta Insights raw response: `spend`, `actions`, `action_values`, `purchase_roas`, `website_purchase_roas`, `date_start`, `date_stop`
- Ads Manager 화면의 column 설정, attribution setting, report time, timezone
- `/api/ads/site-summary`와 `/api/ads/roas/daily`가 사용한 start/end date, spend source, raw spend 합계
- 자체 솔루션 원장의 주문 단위 샘플: 주문번호, 결제 상태, 결제일, 매출액, 유입 식별자, Meta click/view 관련 식별자
- Pixel/CAPI event log 샘플: event name, value, currency, event_id, order id, source URL, dedup 상태
- 취소/환불/부분환불이 Meta 전환 가치와 내부 confirmed revenue에 각각 어떻게 반영되는지 확인할 수 있는 샘플

## GPT 웹 딥리서치 필요 여부

필요 없음.

이 건은 제너럴 웹 리서치보다 공식 Meta Developers 문서 정의와 우리 코드/원장 기준의 차이를 맞추는 문제가 더 크다. GPT 웹 딥리서치는 우리 프로젝트의 rollout bias, 자체 솔루션 원장, pending/confirmed 기준, site-summary/daily spend mismatch를 모르기 때문에 현재 단계에서는 추가 효용이 낮다.

다만 나중에 AIBIO/biocom처럼 건강 관련 업종에서 Pixel custom conversion, CAPI 파라미터, 민감정보 정책 리스크까지 별도 검토해야 한다면 그때는 정책 리서치용 프롬프트를 따로 작성하는 편이 맞다.

## 확인한 공식 출처

- Meta Developers, Marketing API Ad Account Insights Reference: https://developers.facebook.com/docs/marketing-api/reference/ad-account/insights/
- Meta Developers, Meta Pixel Conversion Tracking: https://developers.facebook.com/docs/meta-pixel/implementation/conversion-tracking/
- Meta Developers, Conversions API Get Started: https://developers.facebook.com/docs/marketing-api/conversions-api/get-started/
- Meta Developers, Conversions API Offline Events: https://developers.facebook.com/docs/marketing-api/conversions-api/offline-events/
