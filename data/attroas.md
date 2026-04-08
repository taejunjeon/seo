# Attribution 기준 ROAS 차이 분석

작성일: 2026-04-09  
대상 화면: `http://localhost:7010/ads`, `http://localhost:7010/ads/roas`

## 1. 한 줄 결론

- 현재 `/ads`에서 보이는 **Attribution 기준 ROAS 0.53x**는 `최근 7일 바이오컴`의 **보수적 확정 기준 ROAS**요.
- 기존에 익숙했던 높은 ROAS는 주로 **Meta Ads의 purchase value / spend** 기준이어서, **광고 플랫폼이 넓게 귀속한 구매값**을 쓰고 있소.
- 즉 둘은 같은 ROAS가 아니오.
  - Attribution 기준 ROAS: `Meta로 귀속된 confirmed revenue / 광고비`
  - 기존 Meta ROAS: `Ads Manager purchase value / 광고비`

## 2. 계산 기준이 어떻게 다른가

### Attribution 기준 ROAS

- 백엔드 구현: [backend/src/routes/ads.ts](/Users/vibetj/coding/seo/backend/src/routes/ads.ts)
- 실제 계산:
  - `payment_success` 원장을 주문 단위로 정규화
  - `payment_status=confirmed`인 주문만 포함
  - 그중 `utm_source=fb/facebook` 또는 `fbclid`가 있는 주문만 Meta 귀속으로 인정
  - `approvedDate`가 조회 기간 안에 들어온 주문 금액만 합산
  - 최종 수식: `confirmed attributed revenue / meta spend`

### 기존 Meta ROAS

- 프론트 보조값: [frontend/src/app/ads/page.tsx](/Users/vibetj/coding/seo/frontend/src/app/ads/page.tsx)
- 실제 계산:
  - `Meta Ads Insights.totalPurchaseValue / totalSpend`
- 즉 Meta Ads가 자기 attribution window로 잡은 `purchase value`를 그대로 쓰오.

## 3. 현재 실측 수치

### 바이오컴 기준 기간별 비교

| 기간 | 광고비 | Attribution 확정 매출 | Attribution ROAS | Meta purchase value | Meta purchase ROAS |
| --- | ---: | ---: | ---: | ---: | ---: |
| 최근 7일 | ₩27,724,670 | ₩14,586,790 | 0.53x | ₩112,991,932 | 4.08x |
| 최근 14일 | ₩55,107,185 | ₩15,938,790 | 0.29x | ₩428,222,024 | 7.77x |
| 최근 30일 | ₩116,320,308 | ₩15,938,790 | 0.14x | ₩594,982,466 | 5.12x |
| 최근 90일 | ₩338,246,870 | ₩15,938,790 | 0.05x | ₩1,531,286,049 | 4.53x |

핵심 해석:

- `0.53x`는 `최근 7일 바이오컴` 수치와 일치하오.
- `최근 14일/30일/90일`의 Attribution 매출이 거의 같은 것은, **광고비는 더 넓은 기간으로 늘어나는데 attribution confirmed 매출은 최근 구간에 몰려 있기 때문**이오.
- 따라서 장기 기간 ROAS는 현재 구조상 **구조적으로 더 낮아 보이는 편향**이 있소.

### 최근 7일 바이오컴을 더 자세히 보면

| 구분 | 주문수 | 매출 |
| --- | ---: | ---: |
| 사이트 전체 confirmed | 207건 | ₩48,924,473 |
| Meta 귀속 confirmed | 49건 | ₩14,586,790 |
| Meta 귀속 pending | 27건 | ₩6,813,750 |
| Meta 귀속 canceled | 1건 | ₩245,000 |

여기서 중요한 점:

- Attribution 기준 ROAS는 **사이트 전체 confirmed 매출**이 아니라, **Meta로 귀속된 confirmed 매출만** 보오.
- 즉 최근 7일 바이오컴 전체 confirmed 매출 `₩48.9M`을 광고비에 나누는 값이 아니라,
  **그중 Meta 귀속으로 판정된 `₩14.6M`만** 분자로 쓰는 것이오.

## 4. 왜 `0.53x`가 기존보다 훨씬 낮게 보이는가

### 1) 분자가 다르다

- 기존 Meta ROAS 분자: `₩112,991,932`
- Attribution ROAS 분자: `₩14,586,790`

같은 최근 7일 광고비 `₩27,724,670`을 나누는데, 분자가 약 `7.75배` 차이 나니 ROAS도 크게 벌어지오.

### 2) Attribution은 `confirmed`만 쓴다

- 최근 7일 Meta 귀속 `pending` 매출은 `₩6,813,750`요.
- 이 금액이 전부 나중에 confirmed로 바뀐다고 가정해도:
  - 현재: `0.53x`
  - pending 전부 반영 가정: 약 `0.77x`

즉 **지연 확정 때문에 낮게 보이는 부분은 분명 있지만**, 그것만으로 기존 Meta ROAS `4.08x`까지 올라가진 않소.

### 3) Attribution은 `Meta로 귀속된 주문`만 인정한다

- 최근 7일 바이오컴 사이트 전체 confirmed 매출은 `₩48.9M`
- 그중 Meta 귀속 confirmed 매출은 `₩14.6M`

즉 최근 7일 confirmed 매출 중 약 `29.8%`만 Meta 귀속으로 잡혔소.  
이건 오류라기보다, **Attribution 기준이 “광고비를 쓴 Meta가 실제로 가져온 confirmed 매출”만 보려는 설계**이기 때문이오.

### 4) 장기 구간은 아직 cutover bias가 있다

- 최근 14일/30일/90일 Attribution 확정 매출이 모두 `₩15.94M` 근처로 거의 같소.
- 반면 광고비는 `₩55.1M → ₩116.3M → ₩338.2M`로 계속 커지오.

이 패턴은 현재 장기 구간 ROAS가 **과거 광고비는 포함하지만, attribution confirmed 매출은 최근 검증 구간 위주로만 잡히는 상태**임을 시사하오.  
즉 **30일/90일 Attribution ROAS는 지금 단계에선 참고용이 아니라 매우 보수적인 잠정치**로 보는 편이 맞소.

## 5. 왜곡 가능성 평가

### A. Attribution 기준 ROAS가 왜곡됐을 확률

#### 1) 최근 7일 `0.53x`가 실제보다 너무 낮게 잡혔을 확률: `중간~높음`

근거:

- `pending` 매출 `₩6.81M`가 아직 제외돼 있소.
- historical/handover 구간은 attribution caller coverage가 완전하지 않소.
- biocom payment_complete 페이지에는 `GTM-W7VXS4D8 ... includes` 오류가 남아 있소.

다만:

- `pending` 전부가 확정돼도 `0.53x → 0.77x` 수준이오.
- 따라서 **최근 7일 기준으로도 현재 수치가 다소 낮게 보일 가능성은 있지만, 4x대 Meta ROAS에 가까워질 정도의 저평가로 보긴 어렵소.**

#### 2) 최근 30일/90일 Attribution ROAS가 실제보다 과도하게 낮게 잡혔을 확률: `높음`

근거:

- 14일/30일/90일 Attribution 매출이 거의 고정돼 있소.
- 이는 장기 기간 광고비는 들어오는데 attribution confirmed 매출은 충분히 backfill되지 않았다는 신호요.

즉 장기 기간의 Attribution ROAS는 **현재 운영 지표로 바로 믿기보다 cutover 이후 기간만 따로 보거나, partial coverage 경고를 붙여야 하오.**

### B. 기존 Meta ROAS가 왜곡됐을 확률

#### 기존 Meta purchase ROAS가 실제 확정 매출 기준보다 높게 잡혔을 확률: `높음`

근거:

- 최근 7일 기준 Meta purchase value `₩112.99M` vs confirmed attribution revenue `₩14.59M`
- 비율이 약 `7.75배` 차이 나오오.
- pending까지 모두 반영해도 `₩21.40M` 수준이라 Meta purchase value 대비 약 `5.28배` 차이요.

가능 원인:

- Meta click/view attribution window가 더 넓음
- Ads Manager purchase value는 실제 PG 확정/입금 완료와 1:1이 아님
- 브라우저 픽셀/legacy firing/중복 purchase event 가능성
- 바이오컴은 `GTM-W2Z6PHN` 정본 외에 `GTM-W7VXS4D8` support 컨테이너와 legacy 축이 남아 있어 event 품질 리스크가 존재함

즉 현재 정보만 보면 **기존 Meta purchase ROAS는 운영 판단용 main ROAS로 쓰기엔 과대평가일 가능성이 높소.**

## 6. 운영 판단상 어떻게 읽는 게 맞는가

### 지금 메인 판단값

- 메인 ROAS: **Attribution 기준 confirmed ROAS**
- 보조 참고값: **Meta purchase ROAS**
- 보조 해석값: **confirmed + pending 가정치**

### 추천 해석 문장

- `0.53x`는 “광고비 ₩1당, 현재까지 실제로 Meta 귀속 + 확정까지 확인된 매출이 ₩0.53 들어왔다”는 뜻이오.
- 이 값이 곧바로 “광고가 완전히 망했다”는 뜻은 아니오.
  - 최근 pending이 아직 confirmed로 안 바뀐 부분이 있고
  - 장기 기간은 attribution cutover 이전 광고비가 섞여 있어 보수적으로 눌려 있기 때문이오.
- 반대로 Meta purchase ROAS `4.08x`를 그대로 믿는 것도 위험하오.
  - 실제 확정 매출 기준으로는 과대평가일 가능성이 높기 때문이오.

## 7. 정확도를 높이려면 무엇을 해야 하는가

### 1) `confirmed`와 `pending`를 같이 보여라

- 메인값은 계속 `confirmed ROAS`
- 바로 옆 보조값으로 `potential ROAS = (confirmed + pending) / spend`를 추가하는 것이 좋소.
- 그러면 운영팀이 “지금 낮은 이유가 확정 지연인지, 진짜 효율 저하인지”를 바로 구분할 수 있소.

### 2) 장기 기간에는 cutover 경고를 붙여라

- 최근 30일/90일은 attribution live rollout 이전 광고비가 섞여 있을 수 있소.
- 따라서 이 구간은 `partial attribution coverage` 경고가 필요하오.
- 최소한 `최근 7일/14일 우선, 30일/90일은 참고`라는 운영 문구가 있어야 하오.

### 2-1) 캠페인별 Attribution ROAS는 alias 매핑 없이 바로 붙이면 안 된다

- 현재 `utm_campaign`은 Meta 실제 `campaign_id`나 `campaign_name`이 아니라 운영 alias로 들어오오.
  - 예: `meta_biocom_yeonddle_igg`, `meta_biocom_kimteamjang_supplements`
- 반면 Meta Ads 실제 캠페인명은
  - `[바이오컴] 음식물 과민증 검사 어드밴티지+캠페인(251020)`
  - `공동구매 인플루언서 파트너 광고 모음_3 (260323)`
  같은 형태요.
- 그래서 현재 `최근 7일 바이오컴` confirmed Meta 주문 `49건 / ₩14.59M`이 **전부 `(unmapped)`**로 빠지오.

`2026-04-09`에 alias audit를 실제로 뽑아 보니:

- 산출 파일: [meta_campaign_alias_audit.biocom.json](/Users/vibetj/coding/seo/data/meta_campaign_alias_audit.biocom.json)
- 구성: `campaigns 9 / adsets 32 / ads 591 / aliasCandidates 20`

여기서 중요한 점은:

- 많은 ad row에서 `landingUrl=null`이 나왔소.
- 즉 **link_url만으로는 alias를 campaign_id에 안정적으로 붙일 수 없소.**
- `yeonddle`, `proteinstory`, `kimteamjang` 같은 alias는 실제로는 인플루언서/운영명에 가까워서,
  **adset name / ad name / 운영 시작일**을 같이 보고 사람이 수동 검증해야 하오.

따라서 캠페인별 Attribution ROAS를 정확히 높이려면:

1. `utm_campaign alias -> campaign_id` file seed를 만든다
2. 각 rule에 `valid_from / valid_to`를 둔다
3. `confidence=manual_verified`를 남긴다
4. direct match 실패 시에만 alias seed를 적용한다

초기 review seed는 이미 [meta_campaign_aliases.biocom.json](/Users/vibetj/coding/seo/data/meta_campaign_aliases.biocom.json)으로 만들었소. 다만 이 파일은 **즉시 적용용 정답표가 아니라, candidate campaign과 review reason을 담은 수동 검증 대기표**요.

이 작업 없이 UI에 캠페인별 Attribution ROAS를 바로 붙이면, 숫자가 0이거나 잘못된 캠페인으로 붙을 위험이 크오.

### 3) Toss 상태 동기화를 더 자주 돌려라

- 가상계좌 미입금/입금완료 구분은 `payment_status`로 가능하오.
- 다만 신규 주문은 한동안 `pending`으로 남으므로, Toss 상태 sync가 늦으면 ROAS가 더 낮아 보이오.
- 일일 sync만으로 부족하면 당일 2~3회 sync도 검토해야 하오.

### 4) biocom GTM/legacy 축을 정리하라

- `GTM-W7VXS4D8` payment_complete 오류는 그대로 두면 event 품질 리스크가 남소.
- Meta purchase value가 과하게 높은 이유를 확인하려면:
  - payment_complete fired tags
  - legacy purchase sender
  - duplicate firing 여부
  - BigQuery raw purchase / transaction_id 중복
  를 같이 봐야 하오.

### 5) BigQuery raw와 ledger를 same-day로 대조하라

- Meta purchase value가 높은 이유가
  - 실제 주문은 맞는데 ledger가 덜 잡은 것인지
  - 픽셀/태그가 purchase를 과발화한 것인지
  를 raw event 수준에서 분리해야 하오.
- 권장 순서:
  1. BigQuery raw purchase event
  2. `/api/attribution/hourly-compare`
  3. `/api/attribution/caller-coverage`
  4. `/api/crm-phase1/ops`

### 6) Attribution coverage 경계를 명시하라

- 지금 3개 사이트 footer caller는 live 반영이 끝났소.
- 다만 historical row까지 전부 같은 품질이 아니므로, dashboard에는
  - live verified from `2026-04-08`
  - long-range ROAS is conservative
  같은 경계 문구가 필요하오.

## 8. 최종 판단

- **Attribution 기준 ROAS 0.53x는 계산이 틀린 값이라기보다, 더 보수적인 다른 정의의 ROAS**요.
- 다만 지금 단계에선
  - `pending` 미반영
  - 장기 기간 cutover bias
  - biocom GTM/legacy 품질 리스크
  때문에 **특히 30일/90일은 실제보다 낮게 보일 확률이 높소.**
- 반대로 **기존 Meta purchase ROAS는 실제 확정 매출 대비 높게 보일 확률이 높소.**

따라서 운영 원칙은 이거요.

1. 메인 ROAS는 계속 Attribution confirmed 기준으로 유지
2. pending-adjusted 보조값을 같이 표시
3. 장기 기간에는 cutover 경고 표시
4. biocom GTM/legacy purchase 품질 정리
5. BigQuery raw와 ledger를 same-day로 대조해 gap 원인 확정
