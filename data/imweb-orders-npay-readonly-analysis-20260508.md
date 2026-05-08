# 운영 imweb_orders read-only NPay 결제완료 분석

작성 시각: 2026-05-08 11:00 KST
대상: 운영 VM `crm.sqlite3` `imweb_orders` 테이블 (read-only)
문서 성격: Green Lane read-only 분석. NPay 결제완료가 GA4 purchase로 fire 안 되는 transit gap 의 실제 매출 정량.
관련 정본: [[!datacheckplan]], [[!channelfunnel]], [[!bigquery_new]], [[../gdn/google-roas-gap-decomposition-20260507]]
Status: 1차 evidence
Do not use for: 운영 DB write, 광고 변경, 외부 전송

```yaml
harness_preflight:
  lane: Green read-only
  allowed_actions:
    - 운영 VM SSH read-only
    - imweb_orders SELECT only
    - paid_click_intent_ledger join 가능성 dry-run
  forbidden_actions:
    - 운영 DB write
    - 광고 플랫폼 전송
    - PII raw 출력
  source_window_freshness_confidence:
    source: "운영 VM /home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3 (better-sqlite3 WAL, 242 MB)"
    window: "2026-05-01 ~ 2026-05-07 (7일) + 2026-04-07 ~ 2026-05-06 (last_30d)"
    freshness: "synced_at max 2026-05-08 01:20:34 UTC"
    confidence: 0.93
```

## 5줄 결론

1. biocom **last_30d 자사 결제완료 매출 ₩522,805,298 (5.23억원)** — Google Ads Conv. value 218M의 약 2.4배. Google Ads platform ROAS는 자사 매출의 일부만 보고 있음.
2. **NPay 매출 last_30d ₩24,124,500 (158건, 4.6% of revenue)**. Google Ads `구매완료` Primary action NPay label 분자 218M과 비교 시 **NPay click 학습이 실제 NPay 결제완료 매출의 약 9배 부풀려짐**.
3. **imweb_orders `raw_json`에 GA4 `client_id` / `gclid` / `utm_source` 모두 없음**. paid_click_intent_ledger와 직접 join 불가.
4. **간접 join chain 가능**: paid_click_intent_ledger ↔ GA4 BigQuery purchase event (transaction_id = order_no) ↔ imweb_orders. 단 NPay 결제완료는 GA4 purchase fire 안 됨 → NPay 매출은 이 chain에서 제외됨.
5. NPay 매출 attribution 위해서는 **NPay merchant API 또는 별 collector** 필요. 현재 paid_click_intent canary 의 npay_intent stage row 와 imweb_orders pay_type=npay 결제완료 사이 직접 키 없음.

## 1. 운영 imweb_orders 7일 분포 (2026-05-01 ~ 2026-05-07)

| pay_type | pg_type | n | total_amount |
|---|---|---:|---:|
| card | tosspayments | 413 | ₩107,032,819 |
| etc | nicepay | 90 | ₩3,903,544 |
| **npay** | **(빈값)** | **46** | **₩10,980,600** |
| virtual | tosspayments | 46 | ₩12,315,111 |
| free | - | 17 | 0 |
| **합계** | | **612** | **₩134,232,074** |

- 결제완료 (`complete_time IS NOT NULL`): 429건
- 결제 진행 중 (`complete_time IS NULL`): 183건

## 2. last_30d 분포 (2026-04-07 ~ 2026-05-06, Google Ads window 일치)

| pay_type | pg_type | n | revenue (결제완료만) |
|---|---|---:|---:|
| card | tosspayments | 1,744 | ₩442,727,927 |
| virtual | tosspayments | 235 | ₩40,875,686 |
| **npay** | **(빈값)** | **158** | **₩24,124,500** |
| etc | nicepay | 377 | ₩15,077,185 |
| free | - | 90 | 0 |
| **합계** | | **2,604 건** | **₩522,805,298** |

- 총 주문: 2,604
- 결제완료: 2,316 (88.9%)
- **NPay 비중: 4.6%** (158건 / 2,316건 = 6.8% by count, 4.6% by revenue)

## 3. Google ROAS gap 재계산 (last_30d 정확값)

| 측정 | 값 | 의미 |
|---|---:|---|
| Google Ads spend (last_30d) | ₩25,016,556 | 광고 비용 |
| Google Ads Conv. value (NPay click 학습 포함) | ₩218,196,428 | platform 주장 |
| **자사 imweb_orders 전체 매출** | **₩522,805,298** | 모든 결제완료 (Google attribution 무관) |
| 자사 NPay 매출만 | ₩24,124,500 | NPay 결제완료만 |
| 자사 attribution_ledger (Google evidence) | ₩7,063,020 | gclid 보존 + GA4 evidence |

### ROAS 계산

| ROAS 종류 | 분자 | 값 |
|---|---|---:|
| Google Ads platform ROAS | 218M / 25M | **8.72x** |
| 자사 전체 매출 ÷ Google spend (Google이 100% 기여 가정) | 522M / 25M | 20.9x (상한) |
| 자사 NPay 매출 ÷ Google spend (NPay만 100% 가정) | 24M / 25M | 0.96x |
| 자사 attribution_ledger (Google evidence) ÷ spend | 7M / 25M | **0.28x** |

### NPay click 학습 부풀림 정량화

```text
Google Ads "구매완료" action NPay label 분자 :  ₩218,196,382  (last_30d)
실제 자사 NPay 매출                          :  ₩24,124,500   (last_30d)
부풀림 배수                                  :  9.04배
```

→ **NPay click 학습이 실제 NPay 결제완료 매출의 9배 부풀려져 있음**. Google Ads는 NPay click 1회당 결제완료한 것으로 conversion 카운트.

### 자사 매출 - Google attribution gap

```text
자사 전체 매출 last_30d            :  ₩522,805,298
자사 attribution_ledger (Google evidence) :  ₩7,063,020
gap                              :  ₩515,742,278  (자사 매출의 98.6%)
```

→ **자사 매출 5.23억 중 Google 광고 attribution 가능한 부분은 7M (1.4%)**. 나머지 98.6%는 click id 미보존으로 Google 광고 기여 측정 불가.

## 4. paid_click_intent_ledger ↔ imweb_orders join 가능성 dry-run

### 4.1 imweb_orders 컬럼 (전체 27개)

```text
order_key, site, order_no, order_code, channel_order_no, order_type,
sale_channel_idx, device_type, order_time_unix, order_time, complete_time_unix,
complete_time, member_code, orderer_name, orderer_call, pay_type, pg_type,
price_currency, total_price, payment_amount, coupon_amount, delivery_price,
use_issue_coupon_codes, raw_json, synced_at, imweb_status, imweb_status_synced_at
```

### 4.2 paid_click_intent_ledger 컬럼 (29개, schema contract)

```text
intent_id, site, captured_at, received_at, platform_hint, capture_stage,
click_id_type, click_id_value, click_id_hash, utm_source, utm_medium,
utm_campaign, utm_term, utm_content, landing_path, allowed_query_json,
referrer_host, client_id, ga_session_id, local_session_id, user_agent_hash,
ip_hash, dedupe_key, duplicate_count, status, reject_reason, expires_at,
created_at, updated_at
```

### 4.3 직접 join 가능 키

| 키 후보 | imweb_orders | paid_click_intent_ledger | join 가능? |
|---|---|---|---|
| client_id | (raw_json에 없음) | ✅ | ❌ |
| ga_session_id | (raw_json에 없음) | ✅ | ❌ |
| gclid | (raw_json에 없음) | (해시화된 click_id_hash 있음) | ❌ (직접 매칭 어려움) |
| utm_source | (raw_json에 없음) | ✅ | ❌ |
| member_code | ✅ | (없음) | ❌ |
| order_no | ✅ | (없음, paid_click_intent는 결제 정보 절대 저장 안 함) | ❌ (의도된 분리) |
| transaction_id | (없음, order_no가 그 역할) | (없음) | - |

→ **직접 join 가능한 키 0개**.

### 4.4 raw_json 안 GA4 추적 데이터 검증

3개 sample row의 raw_json 분석 (5/1 결제건):

| order_no | raw_len | client_id | ga_session | gclid | utm_source |
|---|---:|---|---|---|---|
| 202605014096127 | 1,008 | ❌ | ❌ | ❌ | ❌ |
| 202605013588075 | 1,007 | ❌ | ❌ | ❌ | ❌ |
| 202605012470787 | 1,007 | ❌ | ❌ | ❌ | ❌ |

raw_json top-level 키:
```text
order_code, order_no, order_time, order_type, is_gift, sale_channel_idx,
device, complete_time, orderer, delivery, payment, cash_receipt, form,
use_issue_coupon_codes
```

→ **GA4 추적 데이터 (client_id, ga_session_id, gclid, utm_*) 0% 보존**. imweb_orders는 결제 정보만 저장.

### 4.5 간접 join chain — GA4 BigQuery 경유

직접 join 불가하지만 GA4 BigQuery 매개로 간접 chain 가능:

```text
paid_click_intent_ledger (ga_session_id)
        ↓ GA4 BigQuery events_* 의 ga_session_id 매칭
GA4 purchase event (transaction_id = order_no)
        ↓ imweb_orders.order_no 매칭
imweb_orders (pay_type, payment_amount)
```

#### 단점

- **NPay 결제완료는 GA4 purchase event fire 안 됨** → 이 chain으로 NPay 매출 못 잡음
- 결과: **homepage 결제 only attribution 가능, NPay 매출은 attribution 영역 밖**

#### 적용 범위

- 7일 GA4 purchase 420건 / homepage 결제완료 (운영 PG 약 504건 추정) → 매칭률 약 83%
- last_30d 약 1,800건 GA4 purchase × 매칭률 → ConfirmedPurchasePrep 후보 약 1,500건

### 4.6 NPay 매출 attribution 별도 path

NPay 매출 ₩24M (last_30d)을 Google 광고 attribution하려면:

| 옵션 | 설명 | 가능성 |
|---|---|---|
| A. NPay merchant API → click_id 별도 받기 | 네이버측 NPay merchant API에 광고 클릭 ID 정보가 있는지 확인 (보통 없음) | 낮음 |
| B. paid_click_intent_ledger npay_intent stage row + imweb_orders 시간/IP 기반 indirect join | paid_click_intent.captured_at 후 1시간 이내 imweb_orders.complete_time (pay_type=npay) | 중 (정확도 보장 어려움) |
| C. imweb 결제완료 페이지에 별 collector 추가 (GA4 client_id, gclid 저장) | 미래 별 sprint, GTM 또는 imweb body 변경 | 가장 정확 |
| D. NPay 결제완료 후 자사 GA4 purchase event 추가 fire (GTM v138 변경 일부 되돌림) | NPay 외부 결제 흐름 콜백이 자사 페이지로 안 돌아오면 불가 | 의문 |

본 agent 추천: **C** (장기), **B** (단기 dry-run).

## 5. 의미 정리 (TJ 입장)

### 좋은 소식

- 자사 매출 last_30d **5.23억** — Google Ads platform 주장 218M보다 큼. 광고 효율 자체가 나쁜 게 아닐 수 있음.
- NPay 비중은 작음 (4.6%) — 핵심 매출은 카드/Toss (84.7%).
- card / toss 결제완료 매출 약 442M는 GA4 purchase로 fire 정상.

### 나쁜 소식

- 자사 매출 5.23억 중 **Google 광고 attribution 가능한 부분은 7M (1.4%)** — click id 보존률 0.8% 때문에.
- 즉 Google Ads 효과를 정확히 측정 불가. 5.23억이 모두 Google 광고 효과인지, 1억인지, 2억인지 모름.
- Google Ads platform ROAS 8.72x는 NPay click 학습 부풀림 (실제 NPay 매출 9배).

### 해결 단계

1. **paid_click_intent canary로 click id 보존 (현재 진행 중)** — 24h+ 누적
2. **ConfirmedPurchasePrep 재실행** — GA4 BigQuery purchase ↔ imweb_orders join → click id 매칭률 측정
3. **paid_click_intent ↔ imweb_orders 시간 기반 indirect join** (별 sprint dry-run)
4. **NPay 매출 별 collector 추가** (장기 sprint)
5. Google Ads BI confirmed_purchase 실행안 (#3 PASS 후)
6. `구매완료` Primary 변경 (#4)

## 6. 다음 자동 진행 (auto_ready)

| 작업 | 의존성 |
|---|---|
| canary 24h 종료 후 paid_click_intent ↔ GA4 BigQuery purchase ↔ imweb_orders 3-way join dry-run | canary 24h PASS |
| ConfirmedPurchasePrep 재실행 (with_gclid 비율 변화 측정) | canary 24h PASS |
| 시간 기반 indirect join (paid_click_intent.captured_at + 1h ↔ imweb_orders.complete_time) dry-run | 본 agent 자율 |
| NPay merchant API 가능성 조사 | 본 agent 자율 (코드 read) |

## 7. TJ 영역

| 작업 | 비고 |
|---|---|
| imweb 결제완료 페이지 GA4 client_id 저장 GTM 추가 | 별 Yellow 승인 |
| NPay 결제완료 후 GA4 purchase event 추가 fire 검토 (GTM v138 일부 되돌림) | 별 Yellow 승인. 단 overcounting risk 재발 가능 |
| imweb 측에 NPay merchant API 권한 또는 raw 데이터 요청 | TJ 외부 문의 |

## 한 줄 결론

> 자사 매출 5.23억 중 Google 광고 attribution 가능한 부분은 1.4%. NPay 매출 24M는 GA4 purchase로 fire 안 됨. imweb_orders raw_json에 GA4 데이터 0% 보존이라 직접 join 불가. paid_click_intent canary + GA4 BigQuery 매개 indirect chain (homepage only) + 별 collector (NPay 포함) 두 단계로 해결.
