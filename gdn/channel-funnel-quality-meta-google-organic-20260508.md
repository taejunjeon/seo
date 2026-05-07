# Channel funnel quality — Meta vs Google vs Organic vs TikTok vs Direct (biocom 7일)

작성 시각: 2026-05-08 01:05 KST (scroll90 + NPay 추적 추가: 2026-05-08 02:15 KST)
대상: biocom (`hurdlers-naver-pay.analytics_304759974`)
window: 2026-05-01 ~ 2026-05-07 (7일, daily export 기준)
문서 성격: Green Lane read-only BigQuery 분석
정본 연결: [[../data/!channelfunnel]] (정본), [[../data/!bigquery_new]], [[google-roas-gap-decomposition-20260507]], [[paid-click-intent-minimal-ledger-canary-phase0-1-2-result-20260507]]
Status: 1차 evidence (7일). 14일/30일 후속 또는 14일 단독 비교는 별 sprint.
Do not use for: GA4/Meta/Google Ads 실제 전송, conversion upload, 광고 변경, GTM publish

```yaml
harness_preflight:
  lane: Green read-only BigQuery analysis
  allowed_actions:
    - BigQuery raw event read-only query
    - SA seo-656@seo-aeo-487113 활용
    - source_group 분류 + funnel 산출
  forbidden_actions:
    - 광고 플랫폼 전송
    - GA4/Meta CAPI/Google Ads upload
    - 광고 변경
    - 운영 DB write
  source_window_freshness_confidence:
    source: "GA4 BigQuery raw events_* (hurdlers-naver-pay)"
    window: "2026-05-01 ~ 2026-05-07 KST"
    freshness: "events_20260506 last_mod 2026-05-07 00:39 UTC"
    confidence: 0.88
```

## 5줄 결론

1. **paid_tiktok**은 sessions 19,563건이지만 avg_engagement_sec **1초** + purchase **0건**. 광고 품질 또는 bot traffic 의심.
2. **paid_google**은 add_payment_info 786 vs purchase 4 = 99.5%가 NPay 클릭 후 GA4 자사 purchase fire 안 됨. Google Ads ROAS gap의 직접 원인.
3. **paid_meta**는 sessions 20,122 / purchase 130 (0.65% 전환율). paid_google 0.07%의 9배. NPay 의존도 낮은 funnel.
4. **gclid 보존: GA4 BigQuery 97.2%** vs **imweb_orders 0.8%**. gap은 GA4→DB 사이 결제 흐름에서 발생. paid_click_intent canary 가 메꾸려는 transit gap의 정량 evidence.
5. **GA4 raw에서 50% scroll 측정 불가** (Enhanced Measurement scroll event는 90%만 fire). GTM scrollDepth trigger [11]은 firing tag 미연결 상태. ProductEngagementSummary POC 별 sprint.

## 1. Source group별 funnel summary

| source_group | sessions | users | avg_eng_sec | view_item | add_to_cart | begin_checkout | add_payment_info | purchase | distinct_txn |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **paid_meta** | 20,122 | 16,291 | 12 | 6,772 | 119 | 307 | 36 | **130** | 130 |
| **paid_tiktok** | 19,563 | 17,223 | **1** | 8,824 | 57 | 16 | 65 | **0** | 0 |
| direct | 5,395 | 4,781 | 28 | 599 | 54 | 240 | 16 | 100 | 99 |
| **paid_google** | 5,362 | 2,957 | 40 | 1,175 | 353 | 111 | **786** | **4** | 4 |
| other | 1,559 | 918 | 79 | 727 | 87 | 133 | 38 | 57 | 56 |
| organic_naver | 1,505 | 1,284 | 54 | 298 | 31 | 76 | 14 | 40 | 40 |
| paid_naver | 1,278 | 1,011 | 99 | 354 | 68 | 165 | 18 | 71 | 71 |
| organic_search | 328 | 234 | 66 | 92 | 5 | 18 | 5 | 10 | 10 |

## 2. 전환율 (sessions → purchase)

| source_group | sessions | purchase | 전환율 |
|---|---:|---:|---:|
| direct | 5,395 | 100 | **1.85%** |
| paid_naver | 1,278 | 71 | 5.55% |
| paid_meta | 20,122 | 130 | 0.65% |
| organic_naver | 1,505 | 40 | 2.66% |
| organic_search | 328 | 10 | 3.05% |
| **paid_google** | **5,362** | **4** | **0.07%** ← gap |
| **paid_tiktok** | **19,563** | **0** | **0.00%** ← gap |

## 3. Google ROAS gap 핵심 원인 (paid_google)

```text
sessions       : 5,362
view_item      : 1,175 (21.9%)
add_to_cart    :   353 (30.0% of view_item)
begin_checkout :   111 (31.4% of add_to_cart)
add_payment_info: 786  ← begin_checkout(111)보다 많음 (NPay 클릭이 add_payment_info에 fire 추정)
결제페이지_진입  :  14 (한국어 custom event)
purchase       :   4 (0.5% of add_payment_info, 0.07% of sessions)
```

### 해석

- **begin_checkout(111) < add_payment_info(786)**: GA4 spec상 add_payment_info는 begin_checkout 다음에 와야 하지만 더 많음. 즉 **NPay 결제 버튼 클릭이 add_payment_info에 fire** 되고, NPay 결제완료는 자사 GA4 purchase event로 fire 안 됨.
- **add_payment_info 786 → purchase 4**: 99.5%의 NPay 클릭/결제시도가 자사 GA4 purchase로 잡히지 않음.
- **Google Ads는 NPay click/count를 conversion으로 학습** (Primary 액션 `구매완료` AW-304/r0vu 라벨 분자의 99.99%, [[google-roas-gap-decomposition-20260507]]).
- **결과**: Google Ads ROAS 8.72x (NPay click 기반) vs internal confirmed 0.28x (실제 결제완료 원장 기반) = **8.44p gap**.

## 4. gclid 보존 transit gap

| 단계 | 측정 | 결과 |
|---|---|---|
| GA4 BigQuery (paid_google session 단위) | 7일 sessions_with_gclid / total users | **97.2% (2,876 / 2,958)** |
| 운영 imweb_orders (결제완료 주문) | ConfirmedPurchasePrep with_gclid / total | **0.8% (5 / 623)** |
| **transit gap** | **96.4%p** | **gclid 96.4%가 결제 단계에서 사라짐** |

### Transit gap 원인 후보

1. NPay 결제 흐름에서 자사 페이지 외부로 이동 → click_id 별도 저장 안 됨.
2. imweb 결제 완료 페이지에서 GA4 client_id / session_id 가 imweb_orders에 join 되지 않음.
3. paid_click_intent canary는 이 gap을 receiver 기반으로 메꾸려는 시도. 본 sprint canary 30분 동안 운영 ledger 34건 자연 traffic 저장 → transit gap 의 receiver 단계는 동작 중.

## 5. paid_tiktok 광고 품질 / 추적 누락 의심

```text
sessions      : 19,563
avg_eng_sec   :     1   ← 사실상 즉시 이탈
purchase      :     0
add_payment_info: 65   ← 일부 사용자 결제 시도
```

### 해석

- avg_engagement 1초는 정상 사용자 활동이 아님. **bot/click farm/잘못된 dest URL** 의심.
- TikTok 광고 spend가 큰데 conversion 0건이면 ROAS 0x. 정합성 측면에서 가장 큰 위험.
- TikTok Ads Manager 캠페인별 spend/click/conversion 비교 별 sprint 필요.

## 6. paid_meta vs paid_google 비교

| 지표 | paid_meta | paid_google | 비고 |
|---|---:|---:|---|
| sessions | 20,122 | 5,362 | meta가 3.7배 |
| avg_engagement_sec | 12 | 40 | google 사용자가 더 머무름 |
| view_item | 6,772 | 1,175 | meta 5.7배 (raw 노출 많음) |
| add_to_cart 비율 | 1.76% | **30.0%** | google 사용자가 cart 더 잘 누름 |
| begin_checkout 비율 (atc 대비) | 258% | 31% | meta는 begin_checkout이 add_to_cart보다 많음 (이상) |
| purchase 비율 (begin_checkout 대비) | **42%** | 4% | meta가 마지막 단계 전환 양호 |
| 전환율 (sessions→purchase) | 0.65% | 0.07% | meta가 9배 |

→ **paid_google은 결제 직전 단계 (add_payment_info)는 강하지만 자사 GA4 purchase 단계에서 NPay 흐름으로 거의 다 빠짐**.
→ **paid_meta는 NPay 의존도 낮고 자사 결제완료 funnel이 끝까지 fire**.

## 6.5. 90% scroll 비중 — source_group별 비교 (추가 evidence 2026-05-08 02:15)

### 직접 측정 결과

| source_group | sessions | sessions_scroll90 | scroll90_pct |
|---|---:|---:|---:|
| organic_naver | 1,505 | 467 | **31.03%** |
| paid_naver | 1,278 | 353 | **27.62%** |
| direct | 5,395 | 1,425 | **26.41%** |
| organic_search | 328 | 84 | **25.61%** |
| paid_google | 5,362 | 1,224 | **22.83%** |
| other | 1,559 | 299 | 19.18% |
| paid_meta | 20,122 | 1,989 | **9.88%** |
| paid_tiktok | 19,563 | 309 | **1.58%** |

### 해석

- **organic / direct / paid_naver / paid_google / organic_search 22~31%**: brand 인지 또는 검색 유입, 페이지 끝까지 스크롤하는 사용자.
- **paid_meta 9.88%**: 광고 노출 후 빠른 이탈 (lookalike + display 비중 큼, 정상 패턴).
- **paid_tiktok 1.58%**: avg_engagement 1초 + purchase 0건과 일치 = 광고 품질 또는 bot 위험.

### 90% scroll 만으로도 channel quality 비교 가능

paid_tiktok 1.58% vs organic_naver 31.03% = **19배 격차**. 50% scroll 추가 없이도 광고 유입 품질 분리 가능.

50% scroll 추가 가치 (POC 별 sprint):
1. 90% 도달 안 한 사용자 중 "어디까지 봤는가" 분리.
2. middle funnel attention (상품 페이지 50% 도달 = scroll engaged).
3. ProductEngagementSummary POC ([[../GA4/product-engagement-summary-poc-20260508]]) 의 visible_seconds + max_scroll_percent 분석에서 같이 사용.

→ **결론**: 90% scroll 비중 은 즉시 운영 분석 가능. 50% scroll 태그 ad-hoc 추가보다 ProductEngagementSummary collector 종합 도입이 더 정확.

## 6.6. NPay 결제완료 GA4 추적 검증 (추가 evidence 2026-05-08 02:15)

### TJ 질문: NPay 결제완료를 GA4 purchase event로 잡고 있는가?

**답: NO. 모든 source_group의 GA4 purchase event 에 NPay 결제완료 0건 fire**.

### Per source_group GA4 purchase by pay_method (7일)

| source_group | purchase_homepage | purchase_npay | purchase_no_pay_method | add_payment_info |
|---|---:|---:|---:|---:|
| paid_meta | 133 | **0** | 0 | 36 |
| direct | 103 | **0** | 0 | 16 |
| paid_naver | 71 | **0** | 0 | 18 |
| other | 58 | **0** | 0 | 36 |
| organic_naver | 41 | **0** | 0 | 14 |
| organic_search | 10 | **0** | 0 | 5 |
| paid_google | 4 | **0** | 0 | **770** |
| paid_tiktok | 0 | **0** | 0 | 65 |
| **total** | **420** | **0** | **0** | **960** |

### 의미

1. **GA4 7일 purchase event 420건 모두 `pay_method=homepage`** (NPay 결제완료 0건).
2. 운영 결제완료 dry-run (5/5) 623건 중 **NPay 37건은 GA4 raw에 추적 흔적 없음**.
3. paid_google의 add_payment_info **770건** 중 대다수는 NPay 결제 시작 (NPay 클릭이 GTM에서 add_payment_info에 fire). 이 중 NPay 결제완료가 자사 GA4 purchase event로 fire 되지 않음.
4. 이는 **GTM v138 (2026-04-24) 의도된 변경** 결과: `[43] GA4_구매전환_Npay` tag → `purchase` → `add_payment_info` 강등 ([[../GA4/gtm]] §"v138 적용한 변경").

### Google ROAS gap 직접 원인 확정

- Google Ads는 NPay click/count를 conversion으로 학습 (Primary `구매완료` action `7130249515` NPay label 분자 99.99%).
- 자사 GA4 raw에는 NPay 결제완료 자체가 추적 안 됨 → confirmed revenue 측정 시 GA4 BigQuery 만으로는 불완전.
- 운영 imweb_orders 또는 NPay merchant API로 NPay 결제완료를 별도 추출해야 정확.
- click id 보존: GA4 BigQuery 97.2% vs imweb_orders 0.8% transit gap → paid_click_intent canary 가 메꾸는 단계.

### 해결 방향 (별 sprint)

1. **NPay 결제완료 ↔ paid_click_intent canary join** ([[../data/!channelfunnel]] Phase2-Sprint1):
   - 운영 imweb_orders `WHERE payment_method='naver_pay'` 결제완료 추출.
   - paid_click_intent_ledger의 ga_session_id / client_id 로 join 시도.
   - 매칭률 산출 → BI confirmed_purchase 후보 prep 입력.
2. **GTM 추가 검토**: NPay 결제완료 콜백 시점 GA4 purchase event fire 가능한지 (NPay 외부 결제 흐름 의존, 별 Yellow 승인).
3. **운영 dashboard 분리 표시**: GA4 purchase = homepage only 명시, NPay 결제완료는 운영 PG 별도 컬럼.

## 7. 50% scroll 측정 불가 명시

GA4 Enhanced Measurement scroll event는 **90% 도달 시 1회만 fire** (Google 공식 docs).

본 sprint 측정 결과:
- 모든 source_group의 scroll event 카운트가 비슷한 패턴이며 (paid_meta 2636 / paid_google 1619), 모두 90% 한정.
- GTM live v142 의 scrollDepth trigger [11] (10/25/50/75/90 threshold)은 firing tag 미연결 상태로 확인 (이전 [[../GA4/gtm]] 확인).
- 따라서 **50% scroll 비중은 GA4 raw로 측정 불가**.
- 별 sprint: ProductEngagementSummary POC 설계 → `GA4/product-engagement-summary-poc-20260508.md` (작성 예정).

## 8. transaction_id 매칭 (GA4 purchase event)

| source_group | purchase | distinct_txn | 1:1 매칭률 |
|---|---:|---:|---:|
| paid_meta | 130 | 130 | 100% |
| paid_google | 4 | 4 | 100% |
| direct | 100 | 99 | 99% |
| other | 57 | 56 | 98% |

→ purchase event가 fire되는 케이스는 transaction_id가 거의 1:1 매칭. **GA4 → imweb_orders join key 확보 가능**.

문제는 fire 자체가 적음 (paid_google 4건만). NPay 결제완료 event의 fire 누락이 핵심.

## 9. purchase value 0 이슈

모든 source_group의 purchase_value_krw 합계 0. 즉 GA4 `purchase` event의 `value` 필드가 모두 0 또는 null.

원인 추정:
- imweb 결제 흐름에서 GA4 purchase event fire 시 value 파라미터 미전달.
- 또는 GTM tag 설정에서 value 변수 매핑 누락.
- 별 sprint에서 점검.

## 10. 본 sprint 결론과 다음 액션

### 결론

- **paid_google ROAS gap은 NPay 결제완료 event의 자사 GA4 fire 누락**이 핵심 원인.
- **paid_tiktok은 광고 품질 조사 별도 필요** (1초 engagement, 0 purchase).
- **gclid 보존 transit gap 96.4%p**는 paid_click_intent canary로 메꾸는 중 (현재 30분 자연 traffic 34건).
- **50% scroll은 raw 불가**, ProductEngagementSummary POC 별도.

### 다음 액션 (auto_ready)

| 작업 | 내용 |
|---|---|
| ConfirmedPurchasePrep 재실행 (canary 24h+) | gclid 보존 transit gap 좁아졌는지 확인 |
| paid_tiktok 광고 품질 분리 분석 | TikTok Ads Manager spend/click/conversion 직접 query |
| GA4 purchase value 0 원인 분리 | GTM tag 설정 점검 (별 sprint) |
| 14일/30일 funnel 비교 | 본 7일 결과의 안정성 검증 |
| ProductEngagementSummary POC 설계 | GA4/product-engagement-summary-poc-20260508.md |

### TJ 영역 (변동 없음)

| 작업 | 비고 |
|---|---|
| Google Ads BI confirmed_purchase 실행안 | ConfirmedPurchasePrep 재실행 PASS 후 |
| `구매완료` Primary 변경 | 신규 conversion 7일 병행 후 |
| paid_tiktok 광고 정지 또는 캠페인 변경 검토 | 본 evidence 보고 후 사업 판단 |

## 한 줄 결론

> Google ROAS gap의 직접 원인은 paid_google add_payment_info 786 vs purchase 4 (99.5% NPay 흐름 누락) + gclid transit gap 96.4%p. paid_tiktok은 별도 광고 품질 위험. 50% scroll은 raw 불가, ProductEngagementSummary POC로 분리.
