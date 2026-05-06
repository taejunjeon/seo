# Google Ads NPay 오염 및 유입 품질 심층 리포트

작성 시각: 2026-05-05 02:30 KST
최근 업데이트: 2026-05-05 11:40 KST
대상: biocom Google Ads account `2149990943`, Google tag `AW-304339096`
문서 성격: read-only 심층 분석 리포트
관련 문서: [[!gdnplan]], [[google-ads-npay-purchase-contamination-report-20260505]], [[google-ads-campaign-signal-audit-20260505]], [[google-ads-confirmed-purchase-execution-approval-20260505]], [[../total/!total]], [[../GA4/gtm]], [[../GA4/product-engagement-summary-contract-20260505]]
Lane: Green
Mode: No-send / No-write / No-deploy / No-platform-send

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
  source_window_freshness_confidence:
    google_ads_api:
      source: "http://localhost:7020/api/google-ads/dashboard?date_preset=last_7d"
      fetched_at: "2026-05-05 02:27 KST"
      account: "2149990943"
      tag: "AW-304339096"
      confidence: 0.94
    ga4_bigquery_archive:
      source: "project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill.events_*"
      windows:
        - "2026-04-27~2026-05-03"
        - "2026-04-06~2026-05-03"
      credential: "seo-656@seo-aeo-487113.iam.gserviceaccount.com"
      mode: "read-only SELECT"
      confidence: 0.82
    internal_confirmed_warning:
      source: "/api/google-ads/dashboard internal section"
      fetched_at: "2026-05-05 02:27 KST"
      result: "운영 VM attribution ledger 조회 실패 후 local_attribution_ledger fallback"
      local_latest_logged_at: "2026-04-12 13:13 KST"
      decision: "현재 /api/google-ads internal=0은 최신 confirmed 매출로 쓰지 않는다"
      confidence: 0.9
  allowed_actions:
    - Google Ads API read-only query
    - GA4 BigQuery archive read-only SELECT
    - local JSON export
    - documentation
  forbidden_actions:
    - Google Ads conversion action mutation
    - Google Ads conversion upload
    - GTM publish
    - backend deploy
    - operating DB write
    - external platform event send
```

## 10초 결론

Google Ads ROAS가 대부분 허수라고 보는 판단은 맞다.
정확히는 `Google Ads 유입이 전부 나쁘다`가 아니라, **Google Ads가 ROAS 분자로 쓰는 구매 전환값이 실제 confirmed 매출이 아니라 NPay count label에 거의 전부 의존한다**는 뜻이다.

2026-05-05 02:27 KST 재조회 기준 최근 7일 Google Ads `Conv. value`는 `66,464,812.82원`이다.
이 중 primary NPay label `구매완료`가 만든 값이 `66,464,810.58원`이다.
비중은 사실상 `100%`다.

GA4 raw로 보면 Google Ads 유입자는 Meta 유입자보다 체류와 장바구니는 오히려 강하다.
최근 7일 Google Ads 세션 평균 참여시간은 `36.41초`, Meta는 `14.67초`다.
Google Ads 90% 스크롤 도달률도 `25.35%`로 Meta `12.95%`보다 높다.
하지만 Google Ads는 NPay 클릭 비율이 `8.39%`로 Meta `0.11%`보다 압도적으로 높고, 일반 구매하기 버튼으로 결제 시작한 세션은 `136건`, 실제 홈페이지 purchase는 `4건 / 336,917원`뿐이다.

따라서 결론은 `전체 즉시 OFF`보다 `증액 금지 + PMax/PM 계열 30~50% 감액 또는 7일 pause test + 검색 의도 캠페인 소액 유지`가 더 안전하다.
추천 강도는 `82%`다.

2026-05-05 11:40 KST에 실행 승인 문서를 [[google-ads-confirmed-purchase-execution-approval-20260505]]로 분리했다.
이 승인안은 `NPay 매출 제외`가 아니라 `홈페이지 구매하기 결제완료와 NPay 실제 결제완료 주문은 구매 매출로 포함하고, NPay 클릭/결제 시작은 구매에서 제외한다`는 기준을 따른다.

## 이번 분석이 답한 질문

### 질문 1. 구글이 왜 NPay로 크게 오염됐는가

원인은 세 가지가 겹친다.

1. Google Ads의 primary purchase 액션 `구매완료`가 아임웹 자동 NPay count label과 같다.
2. 아임웹 자동 NPay count는 결제 완료 원장보다 NPay 버튼/결제 흐름 신호에 가까운 경로다.
3. Google Ads 자동입찰은 primary 전환값을 성과와 학습 신호로 쓸 수 있기 때문에, 이 label이 켜진 상태에서는 실제 confirmed 매출보다 NPay count 신호를 학습한다.

핵심 증거는 아래 코드와 API 결과다.

```html
GOOGLE_ADWORDS_TRACE.setUseNpayCount(true,"AW-304339096/r0vuCKvy-8caEJixj5EB");
```

Google Ads API의 `구매완료` 액션도 같은 label을 쓴다.

```text
conversionAction: 7130249515
name: 구매완료
category: PURCHASE
primaryForGoal: true
send_to: AW-304339096/r0vuCKvy-8caEJixj5EB
최근 7일 value: 66,464,810.58원
```

즉 Google Ads 화면에서는 `구매완료`라고 보이지만, 실제 발사 경로는 `실제 통장 입금 confirmed purchase`가 아니라 `아임웹 NPay count`다.
이 이름 때문에 운영자가 가장 쉽게 속는다.

### 질문 2. Meta와 Google Ads 유입 품질은 어떻게 다른가

GA4 BigQuery archive 기준 최근 7일은 `2026-04-27~2026-05-03`이다.
이는 GA4 event_date 기준이고, archive 최신일이 `2026-05-03`이라 Google Ads API `LAST_7_DAYS(2026-04-28~2026-05-04)`와 하루 차이가 있다.
따라서 방향성 비교로 쓰고, 최종 예산 close는 주문 원장 조인으로 다시 닫아야 한다.

| 지표 | Google Ads | Meta | 해석 |
|---|---:|---:|---|
| 세션 | 6,879 | 23,544 | Meta 유입량이 훨씬 큼 |
| 평균 참여시간 | 36.41초 | 14.67초 | Google 유입이 더 오래 봄 |
| 참여시간 45초 이상 | 1,174건 / 17.07% | 1,692건 / 7.19% | Google 쪽 고관여 비율이 높음 |
| 90% 스크롤 도달 | 1,744건 / 25.35% | 3,049건 / 12.95% | Google 쪽 깊게 읽는 비율이 높음 |
| 상품 조회 | 1,245건 / 18.10% | 6,259건 / 26.58% | Meta는 상품 조회 진입이 더 큼 |
| 장바구니 | 478건 / 6.95% | 124건 / 0.53% | Google은 장바구니 전환이 강함 |
| 일반 구매하기 결제 시작 | 136건 / 1.98% | 337건 / 1.43% | 비율은 Google이 약간 높음 |
| NPay 클릭 | 577건 / 8.39% | 26건 / 0.11% | Google은 NPay로 크게 쏠림 |
| 홈페이지 purchase | 4건 / 336,917원 | 199건 / 60,799,430원 | 최종 purchase는 Meta가 압도 |

이 표가 중요한 이유는 단순하다.
Google Ads 유입은 `저품질 클릭만 들어온다`고 보기 어렵다.
실제로 더 오래 보고, 더 많이 스크롤하고, 장바구니도 더 많이 담는다.

하지만 최종 매출이 문제다.
Google Ads는 NPay 클릭이 많고, Google Ads가 이를 purchase primary value로 세고 있다.
그래서 `관심은 있는데 실제 confirmed purchase로 닫히지 않는다` 또는 `NPay confirmed 주문과 내부 attribution이 아직 연결되지 않는다` 둘 중 하나다.
현재 자료만 보면 첫 번째 가능성이 더 크다.

### 질문 3. 네이버페이가 아닌 구매하기 버튼으로 결제 시작한 비율은 어떤가

현재 GA4 raw에서 `begin_checkout` + `/shop_payment/`를 일반 구매하기 버튼으로 결제 시작한 proxy로 봤다.
이는 완벽한 버튼 클릭 로그가 아니라, 실제 결제 페이지 진입 이벤트다.

최근 7일 기준:

- Google Ads: `136세션 / 6,879세션 = 1.98%`
- Meta: `337세션 / 23,544세션 = 1.43%`

NPay 클릭을 같은 세션에서 제외하면:

- Google Ads: `133세션 / 6,879세션 = 1.93%`
- Meta: `330세션 / 23,544세션 = 1.40%`

따라서 Google Ads는 일반 결제 시작 비율만 보면 나쁘지 않다.
문제는 `결제 시작 이후 confirmed purchase`가 약하다는 점이다.
최근 7일 Google Ads homepage purchase는 `4건 / 336,917원`뿐이다.
같은 기간 Meta는 `199건 / 60,799,430원`이다.

### 질문 4. 스크롤 깊이는 어느 정도인가

현재 GTM에는 10/25/50/75/90 스크롤 trigger가 있지만 live 기준 발사 태그가 없다.
따라서 GA4 raw에서 안정적으로 비교 가능한 것은 Enhanced Measurement `scroll` 이벤트다.
이 이벤트는 보통 90% 도달 기준이므로, `평균 스크롤 깊이`가 아니라 `90%까지 내려간 세션 비율`로 읽어야 한다.

최근 7일 기준:

- Google Ads: `1,744세션 / 6,879세션 = 25.35%`
- Meta: `3,049세션 / 23,544세션 = 12.95%`

최근 28일 기준:

- Google Ads: `6,064세션 / 32,373세션 = 18.73%`
- Meta: `21,779세션 / 120,097세션 = 18.13%`

최근 7일만 보면 Google Ads 쪽 스크롤 품질이 더 높다.
28일로 보면 거의 비슷하다.
따라서 `Google Ads 유입 자체가 무의미하다`는 결론은 과하다.
다만 `Google Ads가 현재 보고하는 ROAS는 무의미하다`는 결론은 강하다.

## Google Ads 캠페인별 관찰

최근 7일 Google Ads 상위 캠페인에서 문제가 집중된다.

| 캠페인 | 세션 | 일반 결제 시작 | NPay 클릭 | 홈페이지 purchase |
|---|---:|---:|---:|---:|
| `[PM]검사권 실적최대화` | 2,902 | 66 | 281 | 0 |
| `[PM]건기식 실적최대화` | 2,760 | 51 | 231 | 0 |
| `[PM] 이벤트` | 521 | 9 | 58 | 1 |
| `[SA]바이오컴 검사권` | 221 | 3 | 0 | 0 |

최근 28일로 넓히면 검색 의도 캠페인에는 일부 매출 근거가 있다.

| 캠페인 | 세션 | 일반 결제 시작 | NPay 클릭 | 홈페이지 purchase |
|---|---:|---:|---:|---:|
| `[PM]건기식 실적최대화` | 9,898 | 151 | 588 | 18 / 3,027,962원 |
| `[PM]검사권 실적최대화` | 9,659 | 178 | 617 | 30 / 10,754,425원 |
| `[PM] 이벤트` | 8,788 | 41 | 215 | 13 / 757,517원 |
| `[SA]바이오컴 검사권` | 803 | 15 | 0 | 12 / 3,584,500원 |

이 결과는 예산 판단에 직접 연결된다.
PMax/PM 계열은 유입량과 NPay 클릭은 크지만 최근 7일 홈페이지 purchase가 거의 없다.
반대로 `[SA]바이오컴 검사권`은 최근 7일에는 약하지만, 28일로 보면 NPay 클릭 없이 purchase가 일부 잡힌다.

따라서 같은 Google Ads라도 묶어서 끄면 안 된다.
PMax/PM과 검색 의도 캠페인을 분리해야 한다.

## 우리가 놓치고 있을 수 있는 것

### 놓친 가능성 1. NPay confirmed 주문이 실제로 Google Ads에서 왔을 수 있다

가능성은 있다.
Google Ads 유입은 NPay 클릭이 많다.
따라서 NPay confirmed 주문 중 일부가 Google Ads 유입 매출일 수 있다.

하지만 이 가능성만으로 Google Ads ROAS `15.33x`를 인정하기는 어렵다.
이유는 최근 7일 primary `구매완료` value `66,464,810.58원`이 모두 NPay label에서 나오는데, 이는 confirmed 주문 단위로 검증된 값이 아니다.
또 NPay GA4 Measurement Protocol 복구 테스트는 `2026-04-30` 2건 / `70,000원` 수준으로 분리되어 있으며, Google Ads 전환값 6,646만원을 설명하지 못한다.

### 놓친 가능성 2. Google Ads view-through 또는 cross-device 기여가 있을 수 있다

가능성은 있다.
Google Ads에는 view-through conversion이 있고, Google은 자체 로그인/기기 신호로 일부 전환을 더 넓게 귀속할 수 있다.

하지만 이번 gap의 1순위는 attribution window 차이가 아니다.
최근 7일 `viewThroughConversions`는 12건이고, purchase view-through는 1건이다.
반면 primary NPay label value는 platform conversion value의 사실상 100%다.
따라서 cross-device가 일부 보탤 수는 있어도, 이번 오염의 주원인은 아니다.

### 놓친 가능성 3. GA4 homepage purchase가 내부 confirmed 매출을 과소대표할 수 있다

맞다.
GA4 purchase는 내부 confirmed order 정본이 아니다.
결제 완료 태그 누락, PG/NPay 리다이렉션, 중복/누락이 있다.

그래서 최종 예산 결정은 아래 조인이 필요하다.

```text
GA4 session evidence
-> gclid/gbraid/wbraid/utm/referrer
-> Imweb order
-> Toss/NPay confirmed payment
-> cancel/refund net revenue
```

다만 이 한계가 있어도 현재 판단은 바뀌지 않는다.
Google Ads가 학습하는 primary purchase value가 confirmed order가 아니라 NPay count label이라는 사실은 API와 footer 코드로 이미 확인됐다.

### 놓친 가능성 4. 구매하기와 NPay를 둘 다 구매 전환으로 잡아야 하는가

맞다.
둘 다 잡아야 한다.
다만 기준은 버튼이 아니라 실제 결제완료 주문이다.

권장 기준:

| 결제 흐름 | Google Ads 구매 전환 포함 여부 | 이유 |
|---|---|---|
| 홈페이지 구매하기 -> 카드/가상계좌 결제완료 | 포함 | 내부 confirmed order와 금액이 확인됨 |
| NPay 클릭 | 제외 | 클릭 또는 결제 시작이지 매출 완료가 아님 |
| NPay 결제 시작 | 제외 또는 Secondary intent | 구매 의도 신호일 뿐 매출 완료가 아님 |
| NPay 실제 결제완료 주문 | 포함 | 내부 confirmed NPay 주문이면 실제 매출 |
| 취소/환불 주문 | 제외 또는 adjustment 후보 | 순매출 기준을 맞춰야 함 |

따라서 Google Ads에서 새로 만들 전환은 `purchase_button_purchase`와 `npay_purchase`를 따로 증액 신호로 경쟁시키는 방식보다, 둘을 합쳐 `BI confirmed_purchase` 하나로 시작하는 편이 안전하다.
결제수단별 breakdown은 내부 리포트 필드로 남긴다.

## 예산 판단

### 지금 바로 쓰면 안 되는 값

아래 값은 예산 증액 근거로 쓰지 않는다.

- Google Ads `Conv. value`
- Google Ads `ROAS`
- Google Ads `All conv. value`
- Google Ads UI의 `구매완료` 전환값

이 값들은 `platform_reference`로만 남긴다.
내부 confirmed 매출과 같은 분자로 보면 안 된다.

### 추천안

#### 1. Google Ads 증액 금지

추천 강도: `95%`

왜:
현재 ROAS 분자가 NPay label에 오염되어 있다.
증액 판단에 쓸 수 있는 내부 confirmed ROAS가 아직 닫히지 않았다.

어떻게:
Google Ads 운영 회의/대시보드에서 platform ROAS를 예산 증액 근거에서 제외한다.
`/total`과 `/ads/google`에는 `platform_reference` 경고를 유지한다.

#### 2. PMax/PM 계열 30~50% 감액 또는 7일 pause test

추천 강도: `82%`

왜:
최근 7일 상위 PM 캠페인들은 NPay 클릭은 크지만 홈페이지 purchase가 거의 없다.
특히 `[PM]검사권 실적최대화`, `[PM]건기식 실적최대화`는 일반 결제 시작과 NPay 클릭은 많지만 최근 7일 homepage purchase가 0이다.

어떻게:
전환 액션을 고치기 전까지 `tROAS/전환가치 극대화` 학습을 믿지 않는다.
현금 소진이 부담이면 PM/PMax 계열 예산만 먼저 30~50% 낮춘다.
전체 계정 OFF보다 캠페인군별 감액이 낫다.

성공 기준:
7일 후 Google Ads 유입, 일반 결제 시작, 내부 confirmed 매출, NPay confirmed 매출이 과도하게 꺾이지 않는다.
내부 confirmed ROAS가 개선되거나, 최소한 광고비 낭비가 줄어든다.

#### 3. 검색 의도 캠페인은 소액 cap 유지

추천 강도: `70%`

왜:
`[SA]바이오컴 검사권`은 최근 28일 기준 NPay 클릭 0, homepage purchase 12건 / 3,584,500원이 있다.
최근 7일은 약하지만, 검색 의도 캠페인은 PM/PMax와 성격이 다르다.

어떻게:
바로 끄기보다 낮은 일예산 cap으로 유지한다.
검색어, 랜딩, confirmed order 조인을 먼저 확인한다.

#### 4. Google Ads 전체 즉시 OFF

추천 강도: `62%`

왜:
오염은 심각하지만, Google 유입 자체의 참여 지표는 나쁘지 않다.
전체 OFF는 검색 의도 캠페인의 일부 매출 가능성까지 같이 끊을 수 있다.

언제 선택하는가:
현금 소진 방어가 최우선이고, 전환 액션 수정이 3영업일 이상 지연될 때만 선택한다.

## 운영 변경 전 선행 조건

Google Ads 전환 액션을 바꾸기 전에는 아래를 먼저 문서로 확정한다.

1. `구매완료` primary action `7130249515`를 Secondary로 낮출지.
2. 대체할 confirmed purchase 전환을 client-side로 만들지, offline conversion import로 만들지.
3. 변경 대상 캠페인의 bid strategy가 `tROAS`, `Maximize conversion value`, `Maximize conversions` 중 무엇인지.
4. 변경 후 24시간, 72시간, 7일 모니터링 지표.
5. 롤백 기준.

현재는 read-only 분석만 했다.
Google Ads 설정 변경, conversion upload, GTM publish는 하지 않았다.

## 산출물

- `backend/scripts/biocom-paid-channel-quality-readonly.ts`: GA4 BigQuery archive에서 Google Ads와 Meta 유입 품질을 비교하는 read-only 스크립트.
- `data/biocom-paid-channel-quality-20260505-last7.json`: `2026-04-27~2026-05-03` 비교 결과.
- `data/biocom-paid-channel-quality-20260505-last28.json`: `2026-04-06~2026-05-03` 비교 결과.
- 이 문서: Google Ads NPay 오염 원인, 유입 품질 비교, 예산 판단.

## 하지 않은 것

- Google Ads 전환 액션을 바꾸지 않았다.
- Google Ads conversion upload를 하지 않았다.
- GTM publish를 하지 않았다.
- Meta/GA4/Google/TikTok으로 이벤트를 보내지 않았다.
- 운영 DB write를 하지 않았다.
- backend 운영 배포를 하지 않았다.

## 다음 할일

### Codex가 할 일

1. Google Ads confirmed purchase 변경 승인안 작성
- 추천/자신감: `92%`
- Lane: Green 문서 작성. 실제 변경은 Red.
- 무엇을 하는가: `구매완료` primary action을 계속 쓸지, Secondary로 낮출지, 새 confirmed purchase 전환을 만들지 승인 문서로 정리한다.
- 왜 하는가: 현재 자동입찰이 실제 매출이 아니라 NPay count label을 학습할 수 있기 때문이다.
- 어떻게 하는가: Google Ads API 전환 액션, affected campaign bid strategy, 7/30일 gap, 롤백 조건을 한 문서에 묶는다.
- 성공 기준: TJ님이 `유지/secondary/새 전환` 중 하나를 승인할 수 있다.
- 승인 필요: 문서 작성 NO. 실제 Google Ads 변경 YES.

2. 주문 단위 NPay confirmed 대조 설계
- 추천/자신감: `88%`
- Lane: Green
- 무엇을 하는가: NPay 클릭, NPay confirmed 주문, GA4 purchase, Google Ads conversion action value를 주문 단위로 맞추는 read-only 설계를 만든다.
- 왜 하는가: Google Ads NPay 클릭이 실제 매출로 얼마나 이어졌는지 확인해야 감액 폭을 확정할 수 있다.
- 어떻게 하는가: Imweb NPay 주문, 운영 NPay intent source, GA4 BigQuery transaction_id, Google Ads action stats를 key별로 대조한다.
- 성공 기준: `matched / unmatched / ambiguous / polluted` 분포가 나온다.
- 승인 필요: read-only 자료 접근은 필요할 수 있음. write/send는 금지.

3. `/total`과 `/ads/google`에 platform_reference 경고 강화
- 추천/자신감: `84%`
- Lane: Green/Yellow
- 무엇을 하는가: Google Ads `ROAS`, `Conv. value`, `All conv. value`를 예산 판단용 내부 매출과 분리해 보이게 한다.
- 왜 하는가: 운영자가 Google Ads 화면 ROAS를 실제 매출로 오해하면 예산 결정이 틀어진다.
- 어떻게 하는가: API 응답의 `primaryKnownNpayShareOfPlatform`, `ledgerSource`, `freshness`를 화면 경고와 문서에 고정한다.
- 성공 기준: 화면에서 Google Ads 값이 `platform_reference`로만 보이고, 내부 confirmed 기준과 섞이지 않는다.
- 승인 필요: 로컬 구현 NO. 운영 배포 YES.

### TJ님이 할 일

1. Google Ads 예산 방어선 선택
- 추천/자신감: `82%`
- Lane: Yellow
- 무엇을 하는가: PM/PMax 계열을 30~50% 감액할지, 7일 pause test를 할지, 현상 유지할지 결정한다.
- 왜 하는가: 전환 신호가 오염된 상태에서 증액하거나 자동입찰을 계속 믿으면 광고비가 새어나갈 수 있다.
- 어떻게 하는가: Google Ads UI에서 `[PM]검사권 실적최대화`, `[PM]건기식 실적최대화`, `[PM] 이벤트` 캠페인을 분리해 예산 조정 후보로 본다. `[SA]바이오컴 검사권`은 별도 검색 의도 캠페인으로 소액 유지 후보로 본다.
- 성공 기준: 7일 동안 광고비 소진을 줄이면서 내부 confirmed 매출과 일반 결제 시작이 급락하지 않는다.
- Codex 대체 가능 여부: NO. 실제 광고비 변경은 사업/계정 운영 판단이다.
- 승인 필요: YES.

2. `구매완료` primary 변경 승인
- 추천/자신감: `90%`
- Lane: Red
- 무엇을 하는가: `구매완료` action `7130249515`를 purchase primary에서 내릴지 승인한다.
- 왜 하는가: 이 action이 Google Ads 전환값 거의 전부를 만들고 있으며, label이 NPay count와 일치한다.
- 어떻게 하는가: Codex가 승인안을 만들면 Google Ads UI에서 전환 액션과 목표 포함 여부를 확인하고 승인한다.
- 성공 기준: 실제 confirmed purchase 전환 대안 없이 무작정 끄지 않고, 자동입찰 리스크와 롤백 기준이 정리된다.
- Codex 대체 가능 여부: NO. 외부 광고 계정 설정 변경 승인이다.
- 승인 필요: YES.

## 변경 이력

| 시각 | 내용 | 근거 |
|---|---|---|
| 2026-05-05 02:30 KST | Google Ads와 Meta 유입 품질 비교, NPay 오염 원인, 예산 감액 의견 정리 | GA4 BigQuery archive read-only, Google Ads API read-only |
