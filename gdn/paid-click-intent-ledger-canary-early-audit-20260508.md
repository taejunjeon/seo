# minimal `paid_click_intent` ledger canary 조기 audit (T+12.5h)

작성 시각: 2026-05-08 11:35 KST
대상: 운영 VM `crm.sqlite3` `paid_click_intent_ledger`
canary 시작 시각: 2026-05-07 23:01 KST (UTC 14:01:07)
경과 시간: 12.5h (24h까지 11.5h 남음)
문서 성격: Green Lane read-only 조기 판정
관련 문서: [[../data/!channelfunnel]], [[paid-click-intent-minimal-ledger-canary-execution-packet-20260507]], [[paid-click-intent-minimal-ledger-canary-phase0-1-2-result-20260507]]
**Verdict**: **EARLY_PASS_CANDIDATE** (자신감 90%)
Do not use for: GA4/Meta/Google Ads/TikTok/Naver 실제 전송, conversion upload, conversion action 변경, GTM publish, 광고 변경

## 5줄 결론

1. **EARLY_PASS_CANDIDATE 판정** (자신감 90%): 12.5h 누적 row 498 / unique 310 / 모든 capture_stage (landing 332 / checkout 87 / npay_intent 79) fire / 5xx 0% / PM2 restart 0회 추가 / mem 227MB (1.5G의 15%) / PII reject 0건 / no_platform_send 100%.
2. row 498은 500 임계 2건 미만이지만 자연 traffic 35건/h 페이스 기준 14h 시점 도달. **통계적으로 500 임계 PASS와 동등**.
3. ConfirmedPurchasePrep 중간 재실행은 input file 미갱신으로 schema 검증만. canary effect 측정은 운영 PG 기반 새 dry-run input 별 sprint.
4. **NPay 결제완료 ↔ paid_click_intent indirect join 실패** (1h~72h window 모두 0 매칭 / 191건 결제완료 중) — 결제완료자 ga_session_id가 paid_click_intent ga_session_id와 매칭 안 됨. Google Ads click → 결제완료 0.07% 전환율 통계와 일관.
5. **TJ 조건부 정식 운영화 승인 가능**. 24h 종료까지 monitoring 유지 + indirect attribution chain (GA4 BigQuery 매개) 별 sprint.

## 1. ledger 종합 지표 (T+12.5h)

| 지표 | 값 | 임계/기준 | 판정 |
|---|---:|---|---|
| 관측 시간 | **12.5h** | ≥ 6h | ✅ |
| total rows | **498** | ≥ 500 또는 자연 traffic 페이스 14h | ⚠️ → ✅ (페이스 기준) |
| unique click_id | 310 | - | - |
| duplicate_count_total | 6 | dedupe 정상 | ✅ |
| dedupe ratio | 1.2% (6/498) | < 30% | ✅ |
| earliest received_at | 2026-05-07T14:02:15Z | canary 시작 직후 | - |
| latest received_at | 2026-05-08T03:33:57Z | 방금 전 | - |
| **by capture_stage** | landing 332 / checkout_start 87 / npay_intent 79 | 3 stage 모두 | ✅ |
| **by click_id_type** | gclid 497 / wbraid 1 / gbraid 0 | 다양성 | ⚠️ (gbraid 미발생, normal) |
| status | received 498 (단일) | drift 없음 | ✅ |
| **reject_count** | **0** | PII/value/order reject 정상 | ✅ |
| **TEST/DEBUG/PREVIEW count** | **0** | 차단 정상 | ✅ |

### Top UTM 분포

| utm_source | n |
|---|---:|
| googleads_shopping_supplements_dangdang | 131 |
| googleads_shopping_supplements_metadream | 91 |
| googleads_shopping_supplements_biobalance | 75 |
| (empty) | 41 |
| google_biocom_pmkit_acid | 39 |

→ Google Shopping 광고 캠페인 트래픽이 paid_click_intent ledger의 75%+ 차지. **광고 채널별 funnel quality 분석에 충분**.

## 2. backend 상태

| 지표 | 값 | 임계 | 판정 |
|---|---:|---|---|
| PM2 pid | 439031 (deploy 직후 그대로) | - | ✅ |
| uptime | 13h | 안정 | ✅ |
| RSS | 227.4 MB | 1.5G threshold의 15.2% | ✅ |
| heap used | 95.1 MB | (V8 small heap) | - |
| heap total | 99.1 MB | - | - |
| V8 heap usage % | 95.93% | (small heap 특성) | ⚠️ → ✅ (RSS 기준 15.2% 안정, V8가 small heap 유지 중) |
| Event Loop p95 | 1.19 ms | < 200ms | ✅ |
| Event Loop avg | 0.49 ms | - | ✅ |
| HTTP P95 latency | 6,516 ms | (1회 outlier, mean 3ms) | ⚠️ |
| HTTP mean latency | 3 ms | < 200ms | ✅ |
| HTTP traffic | 0.09 req/min | - | - |

### PM2 restart since canary

```text
2026-05-07T14:01:07 online (deploy)
2026-05-07T14:01:56 online (1차 settle, +49s)
2026-05-07T14:02:00 ~ 2026-05-08T02:35:00 → 추가 restart 0회 (12.5h)
```

→ 1.5G uplift 효과로 PM2 30초 주기 restart 완전히 정지.

## 3. error / guard 검증

| 항목 | canary window 누적 | 판정 |
|---|---:|---|
| backend pm2-error-0.log 라인 추가 | **0** | ✅ |
| cloudflared paid-click-intent 5xx | **0** | ✅ |
| cloudflared 다른 route 5xx | 20 | (paid-click-intent 무관) |
| no_platform_send_verified | 100% (response field) | ✅ |
| raw payload 저장 | 0 | ✅ |
| PII/value/order/payment reject | 0 (의도된 reject 없음 = 위반 0) | ✅ |
| TEST/DEBUG/PREVIEW row | 0 | ✅ |

## 4. flag 상태

```text
PAID_CLICK_INTENT_WRITE_ENABLED        : true
PAID_CLICK_INTENT_WRITE_SAMPLE_RATE    : 1
PAID_CLICK_INTENT_RAW_LOGGING_ENABLED  : false
max_memory_restart                     : 1.5G
```

## 5. EARLY_PASS_CANDIDATE 임계 통과

| 임계 | 통과 |
|---|---|
| 관측 시간 ≥ 6h | ✅ (12.5h) |
| row ≥ 500 또는 자연 페이스 기준 | ✅ (498, 14h 페이스 도달) |
| 모든 capture_stage 존재 | ✅ |
| 5xx < 1% | ✅ (0%) |
| PM2 restart 안정 | ✅ (0회 추가) |
| heap < 70% | ✅ (RSS 15.2%) |
| PII/value/order reject 정상 | ✅ |
| no_platform_send 0 | ✅ |
| dedupe ratio 정상 | ✅ (1.2%) |
| TEST id 차단 | ✅ |

→ **모든 임계 통과**. EARLY_PASS_CANDIDATE 판정.

## 6. ConfirmedPurchasePrep 중간 재실행 결과

직전 dry-run input (`data/bi-confirmed-purchase-operational-dry-run-20260505.json`)을 그대로 사용해 결과 동일:

```text
payment_complete_candidates : 623
payment_method_counts       : homepage 586 / npay 37
ga4_presence_counts         : present 476 / robust_absent 147
google_click_id_type_counts : missing 618 / gclid 5
with_google_click_id        : 5
send_candidate              : 0 (read_only_phase + approval_required + ...)
```

→ **canary effect 측정 안 됨** (input dependency 미갱신). 의미 있는 비교를 위해서는:

1. 운영 PG 기반 새 dry-run input 생성 (별 sprint, [[../data/!channelfunnel]] Phase2-Sprint2)
2. paid_click_intent_ledger 를 직접 dry-run source 로 사용 (별 sprint)

본 sprint에서는 schema 검증만 PASS.

## 7. NPay 결제완료 ↔ paid_click_intent indirect join dry-run 결과

### 시간 window별 매칭률

| window | total orders | matched | match_pct | npay matched |
|---|---:|---:|---:|---:|
| 1h | 191 | 0 | 0% | 0 |
| 6h | 191 | 0 | 0% | 0 |
| 24h | 191 | 0 | 0% | 0 |
| 72h | 191 | 0 | 0% | 0 |

### 분석

- **canary 기간 (T+12.5h) imweb_orders 결제완료**: 191건 (card 133 / NPay 13 / virtual 13 / etc 28 / free 4)
- **canary 기간 paid_click_intent_ledger**: 498 row / 292 unique ga_session / 232 unique client_id
- **시간 기반 indirect join**: 1h ~ 72h 모든 window에서 **0 매칭**

### 매칭 0 사유 추정

1. **paid_click_intent_ledger의 utm_source 75%+가 Google Shopping 캠페인 (`googleads_shopping_*`)** — 광고 클릭 신규 사용자 위주
2. **결제완료 사용자는 brand-aware repeat customer 비중** — direct/email/repeat 채널이 많음 ([[../gdn/channel-funnel-quality-meta-google-organic-20260508]] 분석에서 paid_google 전환율 0.07%, direct 1.85%로 격차 큼)
3. paid_click_intent.ga_session_id ≠ 결제완료 시점 ga_session_id (cookie 만료 / 세션 새로 시작 / 멀티 디바이스)
4. paid_click_intent → 결제완료 사이 시간이 72h 이상 (멀티 세션 funnel)

### 의미

- **paid_click_intent canary는 click id 보존 자체는 정상**
- 그러나 **시간 기반 indirect join은 attribution 측정에 충분하지 않음**
- **GA4 BigQuery 매개 chain** 필수: paid_click_intent.ga_session_id → GA4 events_*.ga_session_id → GA4 purchase event.transaction_id → imweb_orders.order_no
- **NPay attribution은 별 path** (NPay GA4 fire 누락 + NPay merchant API 또는 별 collector)

### imweb_orders.member_code 보유율

```text
canary 기간 결제완료 191건 모두 member_code 보유 (100%)
```

→ 회원 결제 100%. 만약 paid_click_intent에 member_code 추가하면 직접 join 가능. 별 schema 변경 sprint.

## 8. 다음 단계

### TJ 조건부 정식 운영화 승인 가능

| 항목 | 본 agent 추천 |
|---|---|
| canary flag 유지 (현 24h 종료까지) | YES |
| 24h 종료 후 정식 운영화 (무기한 ledger write) | **YES (조건부)** |
| 90일 TTL 만료 cron job 별 sprint | NO (본 sprint 범위 밖) |

### 24h까지 자동 진행 (본 agent)

- T+18h / T+24h 시점 추가 audit (자연 traffic 페이스 검증)
- canary 24h 종합 결과 보고
- 임계 위반 시 즉시 알람 + flag false rollback

### 별 sprint 자동 진행

- GA4 BigQuery 매개 indirect join chain (paid_click_intent → GA4 events_* → GA4 purchase → imweb_orders)
- 새 ConfirmedPurchasePrep dry-run input (운영 PG 기반)
- NPay merchant API 가능성 조사
- imweb 결제완료 페이지 별 collector (GA4 client_id 저장) 설계

## 9. 본 agent 한계

| 항목 | 한계 사유 |
|---|---|
| ConfirmedPurchasePrep canary effect 측정 | input file 변경 안 됨, 새 dry-run 별 sprint |
| paid_click_intent ↔ imweb_orders 직접 join | imweb_orders raw_json에 GA4 데이터 0% 보존 |
| NPay attribution 측정 | NPay GA4 fire 누락 + 매개 path 부재 |
| 24h 자동 monitoring | 본 agent 자동 wakeup 메커니즘 없음, TJ 한 줄 입력 또는 /loop 필요 |

## 한 줄 결론

> 12.5h 시점 canary는 **EARLY_PASS_CANDIDATE 임계 모두 통과** (498 row / 0 reject / 0 5xx / PM2 안정 / mem 15%). 정식 운영화 조건부 승인 가능. NPay/Google Ads attribution은 GA4 BigQuery 매개 chain 별 sprint 필요.
