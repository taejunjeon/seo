# NPay 결제완료 ↔ paid_click_intent_ledger join dry-run (T+12.5h)

작성 시각: 2026-05-08 11:42 KST
window: canary 시작 2026-05-07 23:01 KST ~ 현재 (12.5h)
문서 성격: Green Lane read-only indirect join 가능성 dry-run
관련 문서: [[../data/!channelfunnel]], [[../data/imweb-orders-npay-readonly-analysis-20260508]], [[paid-click-intent-ledger-canary-early-audit-20260508]]
**Verdict**: **indirect_join_insufficient_for_attribution**
Do not use for: 운영 변경, 광고 변경, 외부 전송, GTM publish

## 5줄 결론

1. canary 기간(12.5h) imweb_orders **결제완료 191건** vs paid_click_intent_ledger **498 row** 시간 window indirect join → **모든 window(1h/6h/24h/72h)에서 0% 매칭**.
2. NPay 결제완료 13건 중 **0건 매칭**. 즉 시간 기반 indirect join은 attribution 측정에 **불충분**.
3. 매칭 0% 원인: ① paid_click_intent ledger의 75%+가 Google Shopping 광고 click 신규 사용자 ② 결제완료자는 brand-aware repeat customer 비중 큼 ③ paid_click_intent.ga_session_id ≠ 결제완료 시점 ga_session_id (cookie 만료/멀티 세션) ④ Google Ads click → 결제 0.07% 전환율 통계와 일관.
4. **alternative paths**: GA4 BigQuery 매개 chain (homepage only attribution 가능), imweb 결제완료 페이지 별 collector (homepage+NPay 가능), paid_click_intent schema에 member_code 추가 (회원 결제 100% 직접 join), NPay merchant API (NPay only).
5. paid_click_intent canary 자체는 click id 보존 정상. attribution 측정은 별 chain 별 sprint.

## 1. canary 기간 imweb_orders 결제완료 분포

| pay_type | n |
|---|---:|
| card | 133 |
| etc | 28 |
| npay | **13** |
| virtual | 13 |
| free | 4 |
| **총** | **191** |

- 모두 회원 결제 (member_code 100%)
- raw_json 안에 GA4 데이터 (`client_id`, `ga_session_id`, `gclid`, `utm_source`) **0% 보존**

## 2. canary paid_click_intent_ledger

| 지표 | 값 |
|---|---:|
| total row | 498 |
| unique click_id_value | 310 |
| unique ga_session_id | 292 |
| unique client_id | 232 |

## 3. 시간 window indirect join 결과

| window | total orders | matched | match_pct | npay matched |
|---|---:|---:|---:|---:|
| 1h | 191 | 0 | 0% | 0 |
| 6h | 191 | 0 | 0% | 0 |
| 24h | 191 | 0 | 0% | 0 |
| 72h | 191 | 0 | 0% | 0 |

→ **모든 window에서 0% 매칭**. 시간 기반 indirect join은 attribution 측정 불충분.

## 4. 매칭 0% 사유 분석

### 사유 1: paid_click_intent ledger 사용자 분포 (Google Shopping 광고 click)

| utm_source 분포 | n | 비중 |
|---|---:|---:|
| googleads_shopping_supplements_dangdang | 131 | 26.3% |
| googleads_shopping_supplements_metadream | 91 | 18.3% |
| googleads_shopping_supplements_biobalance | 75 | 15.1% |
| (empty) | 41 | 8.2% |
| google_biocom_pmkit_acid | 39 | 7.8% |
| 기타 | 121 | 24.3% |
| **합계** | **498** | **100%** |

→ **75%+ 가 Google Shopping 광고 click**. 즉 paid_click_intent ledger 는 신규 광고 클릭 사용자 위주.

### 사유 2: 결제완료자 채널 분포 (Channel Funnel Quality 분석 인용)

[[../gdn/channel-funnel-quality-meta-google-organic-20260508]] §6.5 90% scroll + §6.6 NPay GA4 fire 분석:

| source_group | 7일 sessions | purchase | 전환율 |
|---|---:|---:|---:|
| direct | 5,395 | 100 | **1.85%** ← 결제완료자 비중 큼 |
| paid_naver | 1,278 | 71 | 5.55% |
| paid_meta | 20,122 | 130 | 0.65% |
| organic_naver | 1,505 | 40 | 2.66% |
| paid_google | 5,362 | 4 | **0.07%** ← 매우 낮음 |
| paid_tiktok | 19,563 | 0 | 0% |

→ **paid_google 전환율 0.07%** (결제완료까지 가는 사용자 0.07%). 즉 paid_click_intent ledger 의 Google 광고 click 사용자 498건 × 0.07% = **0.35건** → 통계적으로 0건 매칭은 정상.

### 사유 3: ga_session_id 불일치

- 사용자가 광고 click → 랜딩(paid_click_intent fire, ga_session_id A)
- 며칠 후 다른 device 또는 cookie 만료 후 재방문 → 결제완료 (ga_session_id B)
- A ≠ B → indirect join 매칭 안 됨

이건 GA4 multi-session attribution 일반 문제.

### 사유 4: NPay 결제완료 자체가 13건 (small sample)

- canary 기간 NPay 결제완료 13건만 → 통계적 noise 큼
- 24h+ 누적 + GA4 BigQuery 매개로 더 많은 sample 확보 필요

## 5. Alternative paths (별 chain 후보)

### Path A: GA4 BigQuery 매개 chain ⭐ 추천

```text
paid_click_intent_ledger.ga_session_id
        ↓ GA4 BigQuery events_*.ga_session_id 매칭 (BigQuery query)
GA4 purchase event.transaction_id
        ↓ imweb_orders.order_no 매칭
imweb_orders (pay_type, payment_amount)
```

**장점**:
- BigQuery 권한 보유 (seo-656 SA), 본 agent 자율
- GA4 multi-session 추적 자동
- transaction_id 1:1 매칭 (이전 분석에서 확인)

**한계**:
- **NPay 결제완료는 GA4 purchase fire 안 됨** → homepage only attribution
- NPay 13건은 별 path 필요

**적용 범위**: 191건 중 178건 (homepage 133 + virtual 13 + etc 28 + free 4 = 178). NPay 13건 제외.

**Feasibility**: HIGH. 별 sprint.

### Path B: imweb 결제완료 페이지 별 collector

```text
imweb body 또는 GTM 변경 → 결제완료 페이지에서 GA4 client_id / gclid / ga_session_id 추출 → imweb_orders.raw_json 또는 별 table에 저장
```

**장점**: homepage + NPay 모두 attribution 가능 (결제완료 페이지로 돌아오면).

**한계**: NPay 결제완료가 자사 페이지로 안 돌아오는 경우 (NPay 외부 결제 흐름) attribution 불가.

**Feasibility**: MEDIUM. GTM Yellow 승인 + imweb body 변경 별 sprint.

### Path C: paid_click_intent schema에 member_code 추가

```text
결제 직전 sessionStorage / cookie / localStorage 에서 member_code 읽어 paid_click_intent payload에 포함
→ ledger.member_code 추가
→ imweb_orders.member_code 와 직접 1:1 join
```

**장점**:
- canary 기간 100% 회원 결제 → 모든 결제완료 사용자 매칭 가능
- member_code 안정적 키 (cookie 만료 영향 없음)

**한계**:
- paid_click_intent schema 변경 + 클라이언트 wrapper 변경
- 비회원 결제는 매칭 불가 (현재 100% 회원이라 무관)
- PII guard 검토 필요 (member_code 자체는 PII 아니지만 결합 시 주의)

**Feasibility**: HIGH. 별 schema sprint.

### Path D: NPay merchant API

**장점**: NPay 결제완료 정확한 데이터.

**한계**:
- 네이버측 NPay merchant API에 광고 click ID 정보가 있는지 미확인
- 별 외부 권한 부여 필요

**Feasibility**: LOW. 별 외부 문의.

## 6. 본 sprint 결론과 다음 액션

### 결론

- **시간 기반 indirect join 은 attribution 측정에 불충분** (0% 매칭).
- paid_click_intent canary 자체는 정상 동작 (click id 보존 + UTM 추적).
- attribution 측정은 별 chain (Path A/B/C/D 중 하나 또는 조합) 별 sprint 필요.

### 다음 액션 (우선순위)

| 순서 | Path | 본 agent 자율? | 시점 |
|---:|---|---|---|
| 1 | **Path A** GA4 BigQuery 매개 chain dry-run | YES | 별 sprint, 즉시 가능 |
| 2 | Path C member_code schema 확장 | YES (코드 변경) | 별 schema sprint |
| 3 | Path B imweb 결제완료 별 collector | NO (GTM Yellow 승인) | 별 sprint, TJ 승인 |
| 4 | Path D NPay merchant API | NO (외부) | 별 외부 문의 |

본 agent 추천: **Path A 우선** (즉시 가능, BigQuery 권한 보유).

## 7. 의미 정리 (TJ 입장)

### 좋은 소식

- paid_click_intent canary **정상 동작** (498 row / 0 reject / 0 5xx).
- click id 보존 자체는 잘 됨 (gclid 위주, GA4 BigQuery 데이터와 일관).

### 나쁜 소식

- **시간 기반 indirect join 은 attribution 측정 불가** (0% 매칭).
- NPay 13건 중 0건 매칭 → NPay attribution 별 path 필수.

### 정식 운영화에 미치는 영향

- paid_click_intent ledger 정식 운영화는 가능 ([[paid-click-intent-ledger-canary-early-audit-20260508]] EARLY_PASS_CANDIDATE).
- 단 **attribution 측정 완성도는 별 chain 별 sprint 후에 달성**.
- 즉 정식 운영화 = ledger 보존 시작, attribution 정량 측정 = 다음 sprint.

## 한 줄 결론

> 시간 기반 indirect join 0% 매칭. attribution 측정은 GA4 BigQuery 매개 chain (Path A) 별 sprint. paid_click_intent canary 자체는 정상, 정식 운영화 진행 가능.
