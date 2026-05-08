# Path A (GA4 BigQuery 매개 chain) attribution 한계 재정리

작성 시각: 2026-05-08 13:00 KST
대상: paid_click_intent canary T+12.5h evidence 기준
문서 성격: Green Lane 해석 가이드 — 운영자가 수치 의미를 정확히 이해하기 위함
관련 정본: [[../data/!channelfunnel]], [[ga4-bigquery-attribution-chain-dry-run-20260508]], [[paid-click-intent-ledger-canary-early-audit-20260508]]
Status: 1차 정리. 24h 종료 후 재측정.
Do not use for: 운영 변경, conversion upload, 광고 변경

## 5줄 결론

1. **8.3% / 0.33% / 0.07% 세 수치는 모두 "전체 구매율"이 아니라 "좁은 매칭 경로 성공률"** 이다. 운영자가 이걸 광고 효과 ROAS 라고 오해하면 안 된다.
2. **8.3%** = canary 12.5h paid_click_intent ga_session_id 300개 중 GA4 events_20260507(5/7 KST 24h)에서 매칭된 25건 비율 — 시간 window 차이 + cookie 만료 + multi-session 이 주 사유.
3. **0.33%** = paid_click_intent → GA4 매칭 → GA4 purchase fire (homepage only) 까지 모두 통과한 1건 / 300건. **NPay 결제완료는 GA4 fire 누락으로 이 chain에서 영원히 제외**.
4. **0.07%** = paid_google source_group sessions 5,362 중 GA4 homepage purchase 4건 / 7일. NPay 결제 누락 + 자사 결제 fire는 정상이지만 multi-session 사용자가 paid_google 으로만 분류 안 되는 문제도 작용.
5. 즉 Google Ads 효과 측정은 Path A 단독으로 영원히 부족. **Path C (member_code 매개)** 또는 **Path B (별 collector)** 로 보강해야 의미 있는 수치 산출 가능.

## 1. 세 수치의 정확한 정의 (운영자용)

### 8.3% (GA4 event matching)

```text
분자 : 25  (canary paid_click_intent ga_session_id 가 GA4 events_20260507 안에 등장한 unique session 수)
분모 : 300 (canary 12.5h 동안 paid_click_intent ledger 에 누적된 unique ga_session_id 수)
의미 : "광고 클릭 보존된 session 중 GA4 raw event 도 fire한 비율"
```

**실제 구매율과 무관**. 광고 click은 했지만 GA4 raw event는 cookie 만료/세션 변동으로 다른 ga_session_id로 fire 됐을 수 있음.

### 0.33% (Path A attribution rate)

```text
분자 : 1   (paid_click_intent ga_session_id ↔ GA4 events ↔ GA4 purchase ↔ imweb_orders.order_no 4단계 chain 모두 통과한 case)
분모 : 300 (canary 12.5h 동안 paid_click_intent ledger 에 누적된 unique ga_session_id 수)
의미 : "광고 클릭이 자사 결제완료까지 GA4 raw로 추적된 비율"
```

**실제 구매율과 다름**:
- NPay 결제완료는 GA4 purchase event fire 안 됨 → chain 자동 탈락
- multi-session 사용자(예: 며칠 후 재방문 결제)는 ga_session_id 갱신으로 chain 끊김
- 결제완료 사용자가 paid_click_intent fire 안 한 케이스 (cookie 변동) 도 제외

### 0.07% (paid_google conversion rate, [[../gdn/channel-funnel-quality-meta-google-organic-20260508]])

```text
분자 : 4    (GA4 homepage purchase event 중 source_group=paid_google 인 것)
분모 : 5,362 (paid_google 7일 sessions, GA4 BigQuery raw 기준)
의미 : "paid_google 으로 분류된 GA4 session 중 GA4 homepage purchase 가 같은 session에서 fire 된 비율"
```

**실제 paid_google 매출 비율과 다름**:
- NPay 결제완료 0건 (GTM v138 fire 누락)
- 자사 결제완료 4건은 fire 됐지만, 첫 session에서 결제 안 한 사용자는 source_group=direct/email 등으로 재분류
- 즉 0.07% = "paid_google 첫 session 즉시 결제율"이지 "paid_google 광고가 만든 매출율" 이 아님

## 2. 세 수치 비교표

| 수치 | 분자 | 분모 | window | 정확한 의미 | 실제 매출 측정에 사용? |
|---|---:|---:|---|---|---|
| 8.3% | 25 | 300 | canary 12.5h | paid_click_intent session 중 GA4 raw event 도 fire한 비율 | 아님. chain 첫 단계 통과율만 |
| 0.33% | 1 | 300 | canary 12.5h | Path A 4단계 chain 모두 통과한 비율 | 아님. NPay 제외 + multi-session 누락 |
| 0.07% | 4 | 5,362 | 7일 | paid_google session에서 첫 GA4 homepage purchase 발생 비율 | 아님. 같은 session 즉시 결제만 |

## 3. 왜 Path A가 sample이 작은가 (기술적 분해)

### 사유 1: ga_session_id 휘발성

GA4 ga_session_id 는 **GA cookie 의 session 부분** 으로 결정. cookie 변동/만료 시 갱신.

| 시나리오 | ga_session_id 일관성 |
|---|---|
| 같은 session 내 page view | 일관 (24h cookie 기준) |
| 같은 사용자 다음날 재방문 | **새 ga_session_id** (cookie 30분 idle expire 또는 24h 갱신) |
| 같은 사용자 다른 device | **다른 ga_session_id** |
| 광고 click (paid_click_intent fire) → 며칠 후 결제 | **다른 ga_session_id** (대부분의 경우) |

→ paid_click_intent.ga_session_id 와 결제완료 시점 ga_session_id 가 **다른 게 정상**.

### 사유 2: GA4 BigQuery daily 적재 timezone

events_20260507 (5/7 KST 24h) 의 실제 시간 범위:
- UTC 5/6 15:00 ~ 5/7 14:59
- KST 5/7 0:00 ~ 5/7 23:59

canary 시작 5/7 14:01 UTC = 5/7 23:01 KST → events_20260507 의 마지막 1시간만 chain 가능.

→ **새 GA4 Link 의 events_20260508 적재 후에야 24h+ 매칭 측정 가능** (5/9 02:00 UTC 즉 KST 11:00 예상).

### 사유 3: NPay 결제완료 GA4 fire 누락 (의도)

GTM v138 (2026-04-24 publish) 이후 NPay 결제완료 → `add_payment_info` 강등, purchase fire 안 됨.

- 7일 GA4 purchase 420건 모두 pay_method=homepage / NPay 0건
- canary 14건 NPay actual confirmed 도 GA4 chain 자동 탈락

→ Path A는 **NPay 매출 측정 불가능**.

### 사유 4: paid_click_intent ledger의 사용자 분포 편향

| 분포 | n | 비중 |
|---|---:|---:|
| Google Shopping 광고 click 신규 사용자 | ~75% | 높음 |
| 결제까지 가는 brand-aware repeat customer | <5% | 낮음 |

→ paid_click_intent ledger 의 75%+ 가 **결제 안 하는 신규 광고 click 사용자**. 결제완료자와 매칭 안 됨.

### 사유 5: paid_google session → 결제 0.07% 자체가 매우 낮음

[[../gdn/channel-funnel-quality-meta-google-organic-20260508]] 분석:
- paid_google 5,362 sessions / GA4 homepage purchase 4 (0.07%)
- 그러나 이건 **첫 session 즉시 결제** 만 측정
- 사용자가 paid_google 진입 → 며칠 둘러보기 → repeat 방문 시 source_group 변동 → direct/email/repeat 재분류 후 결제
- 즉 **광고가 만든 매출 의 일부만** 첫 session 결제로 잡힘

## 4. Path A의 본질적 한계

| 한계 | 설명 |
|---|---|
| ga_session_id 휘발성 | GA4 design 자체. cookie 만료 시 chain 끊김 |
| NPay 매출 자동 제외 | GTM v138 변경 후 영원히. attribution chain 외부 source 필요 |
| GA4 daily T+24~36h 지연 | 실시간 attribution 불가. canary 같은 짧은 sprint 는 sample 작음 |
| Multi-session funnel 누락 | 광고 → 며칠 후 결제 case 전부 누락 |
| Same-session immediate-purchase only bias | source_group 재분류 효과로 광고 효과 과소 측정 |

## 5. 운영자 해석 가이드 (오해 방지)

### 오해 1: "Path A attribution rate 0.33% = Google 광고 효과 0.33%"

**틀림**. Path A는 NPay 누락 + multi-session 누락 + cookie 휘발 누락 으로 sample이 작음. 실제 광고 효과 측정에는 추가 path 필요.

### 오해 2: "paid_google 0.07% conversion rate 라 paid_google 광고 끄는 게 맞다"

**틀림**. 0.07%는 첫 session 즉시 결제 만. 며칠 후 repeat 방문 결제 + NPay 결제는 별 측정. 결정 전 imweb_orders 직접 read (5.23억 매출 last_30d) 와 cross-check 필수.

### 오해 3: "GA4 event matching 8.3% 라 paid_click_intent canary 가 부정확"

**틀림**. 8.3% 는 chain 첫 단계 통과율. canary 자체는 정상 ([[paid-click-intent-ledger-canary-early-audit-20260508]] EARLY_PASS_CANDIDATE). 매칭 8.3% 는 GA4 design 의 자연 휘발성 결과.

## 6. 한 줄 결론

> 8.3% / 0.33% / 0.07% 는 모두 **chain 통과율** 이지 **실제 매출률** 이 아니다. Path A 한계 본질은 ga_session_id 휘발 + NPay GA4 fire 누락 + multi-session 누락. **Path C (member_code 매개) + Path B (별 collector) 로 보강해야 운영 의사결정에 쓸 수 있는 attribution 측정 가능**.
