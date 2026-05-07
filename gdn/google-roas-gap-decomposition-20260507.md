# Google Ads ROAS gap decomposition — click id 보존 직후 1차 보고

작성 시각: 2026-05-07 23:35 KST
대상: biocom Google Ads ROAS 8.72x vs 내부 confirmed ROAS 0.28x gap (8.44p 차이)
문서 성격: Green Lane read-only 추적 보고
관련 문서: [[paid-click-intent-minimal-ledger-canary-phase0-1-2-result-20260507]], [[backend-errorhandler-payload-hardening-pm2-uplift-deploy-result-20260507]], [[google-ads-confirmed-purchase-candidate-prep-20260507]], [[../total/!total-current]], [[../data/!bigquery]]
Status: 1차 evidence (canary T+30min). 24h+72h 후 후속 측정 예정.
Do not use for: GA4/Meta/Google Ads 실제 전송, conversion upload, conversion action 변경, GTM publish, 광고 변경

```yaml
harness_preflight:
  lane: Green read-only gap analysis
  allowed_actions:
    - 운영 VM ledger same-window 조회
    - 운영 VM canary ledger 조회
    - Google Ads API last_30d read-only
    - confirmedPurchasePrep 후보 분포 비교
    - BigQuery dataset/job 권한 확인
  forbidden_actions:
    - GA4 MP send / Meta CAPI send / Google Ads upload
    - Google Ads conversion action 변경
    - GTM publish
    - 운영 DB write 외 (canary 범위 안에서만)
  source_window_freshness_confidence:
    source: "Google Ads API last_30d (2026-05-07 18:12) + 운영 VM attribution_ledger same-window + 운영 VM paid_click_intent_ledger canary T+30min + ConfirmedPurchasePrep 직전 결과"
    window: "2026-04-07~2026-05-06 KST + 2026-05-07 23:01~23:31 KST canary"
    freshness: "canary T+30min 직후"
    confidence: 0.85
```

## 5줄 결론

1. canary 시작 30분 동안 운영 ledger에 **34건의 자연 Google click id 저장** (이전 0건). 145건/h 페이스 추정.
2. ConfirmedPurchasePrep 직전(2026-05-07 20:13) 결과: 운영 결제완료 623건 중 **with_gclid 5 / missing 618 (99.2% 누락)**. canary 24h 후 재실행 예정.
3. 본 sprint에서 측정한 platform vs internal gap: **Google Ads 8.72x, 내부 0.28x, 차이 8.44p**. 원인 1순위는 NPay click/count Primary 오염 (`구매완료` action 218,196,382원 / 218,196,428원 = 사실상 100%).
4. canary로 click id 보존 문제는 **즉시 진행 중**. 하지만 결제완료 주문 원장에 click id가 함께 저장되는 것은 별 단계 (paid_click_intent ledger ↔ imweb_orders join). join은 다음 sprint.
5. Gap 좁히기 위한 다음 조치 우선순위: ① canary 24h 안정화 ② ConfirmedPurchasePrep 재실행 ③ paid_click_intent ↔ imweb_orders deterministic join ④ BI confirmed_purchase 실행안 ⑤ `구매완료` Primary 변경.

## 1. Gap 측정 (현재까지)

### 1.1 platform 주장값 (Google Ads API last_30d)

```text
조회 시각: 2026-05-07 18:12 KST
Window: 2026-04-07 ~ 2026-05-06 KST
비용: 25,016,556원
Conv. value (Google Ads 주장): 218,196,428원
Google Ads ROAS: 8.72x
```

분자 218,196,428원의 99.99% 가 **`구매완료` action `7130249515`의 known NPay count label `r0vuCKvy-8caEJixj5EB`** (218,196,382원). 즉 Google Ads는 **NPay click/count를 구매로 학습**하고 있다.

### 1.2 internal confirmed value (운영 VM attribution_ledger same-window)

```text
조회 시각: 2026-05-07 18:12 KST
Window: 2026-04-07 ~ 2026-05-06 KST
Source: 운영 VM crm.sqlite3#attribution_ledger
Google evidence payment_success: 29건
confirmed: 27건
confirmed revenue: 7,063,020원
내부 confirmed ROAS: 0.28x
latestWindowLoggedAt: 2026-05-06T14:59:06.844Z
```

### 1.3 Gap

```text
Google Ads ROAS  8.72x
내부 confirmed   0.28x
Gap             8.44p (≈ 31배)

Conv.value 비교:
  Google 주장: 218,196,428원
  내부 확정:    7,063,020원
  차이:       211,133,408원 (Google 주장의 96.8%)
```

## 2. Gap 원인 분해

### 2.1 분해 매트릭스

| 원인 후보 | 영향 추정 | 본 sprint evidence |
|---|---|---|
| (A) NPay click/count Primary 오염 | **매우 큼** (Google 분자 218M 중 218M = 사실상 100%) | `구매완료` NPay label 비중 99.99% 확인 |
| (B) Google click id 유실 (랜딩→주문 원장 누락) | 매우 큼 | ConfirmedPurchasePrep 직전: with_gclid 5/623 (0.8%). canary 시작 후 paid_click_intent ledger 34건 자연 저장 — 즉시 진행 중 |
| (C) confirmed order 매칭 누락 (transaction_id) | 중 | GA4 BigQuery 권한 보유 (지금 가능, 별 sprint) |
| (D) 광고 유입 자체 품질 저하 | 미확인 | Channel funnel quality 분석 별 sprint (Phase6-Sprint1) |
| (E) 추적 누락 (Google tag gateway 미적용) | 추정 미정 | POC 조사 완료, 활성화 별 sprint |
| (F) 환불/취소 미반영 | 작 | 운영 PG `cancellation_reason`/`return_reason` 별 검증 필요 |

### 2.2 (A) NPay 오염 확정 evidence

`구매완료` action `7130249515` 분석 결과:

```text
Conv. action: 구매완료 (Primary)
NPay label: AW-304339096/r0vuCKvy-8caEJixj5EB
Last_30d Conv.value: 218,196,382원
Total Conv.value (action): 218,196,428원
NPay label 분자 비중: 99.99%
```

→ `구매완료` Primary는 자동입찰에 NPay click/count를 그대로 학습시키는 구조. internal confirmed (7M)과 비교 불가.

해결 방향: 신규 confirmed_purchase 전환 액션 생성 → 7일 병행 관측 → `구매완료` Secondary 강등. 별 sprint Phase3-Sprint5/6.

### 2.3 (B) Google click id 유실 — canary 진행 중

#### 직전 상태 (canary 전, 2026-05-05 dry-run)

```text
운영 결제완료 주문: 623건 (homepage 586 + NPay 37)
GA4 present: 476 (76.4%)
robust_absent: 147 (23.6%)
google_click_id 보유:
  missing: 618 (99.2%)
  gclid:    5 (0.8%)
  gbraid:   0
  wbraid:   0
with_google_click_id: 5
after_approval_structurally_eligible: 0
send_candidate: 0 (read_only_phase + approval_required + ... block)
```

→ 결제완료 주문 99.2%가 click id 누락. Google Ads upload 후보가 만들어지지 않음.

#### 현재 (canary T+30min, 2026-05-07 23:31 KST)

```text
운영 paid_click_intent_ledger:
  row_count: 34
  unique by dedupe_key: 33 (1 dedupe)
  by capture_stage: landing 23, npay_intent 6, checkout_start 5
  by click_id_type: gclid 34
  status: received 34
  duplicate_count_total: 1
  거의 모든 row의 utm_source/utm_campaign:
    googleads_shopping_supplements_biobalance / dangdang
  landing_path: 대부분 /HealthFood/
  referrer_host: 빈값 (Google Shopping → biocom.kr 직접 진입)
```

→ **30분 사이에 자연 traffic으로 Google click id 34건이 운영 ledger에 저장**됨. 145건/h 페이스라면 24h 약 3,400건.

#### join 필요 (paid_click_intent ↔ imweb_orders)

paid_click_intent ledger의 click_id는 결제완료 주문에 직접 붙어 있지 않다. join 필요:

| 대상 | join 키 후보 |
|---|---|
| paid_click_intent_ledger | client_id, ga_session_id, local_session_id, utm_*, landing_path |
| imweb_orders (운영 PG read-only) | order_no, member_code, utm_*, ga_session_id (저장돼 있다면) |
| transaction_id (GA4) | order_no |

→ join 가능성 평가는 별 sprint (Phase4-Sprint8 이후).

### 2.4 (C) confirmed order 매칭 누락

GA4 BigQuery로 확인 가능. 권한:

- `seo-656@seo-aeo-487113.iam.gserviceaccount.com` SA: `hurdlers-naver-pay.analytics_304759974` Data Viewer + `project-dadba7dd` Job User (2026-05-05 부여)
- biocomkr.sns@gmail.com: BigQuery Data Viewer + Job User (허들러스 측 회신)

별 sprint에서 BigQuery raw로 transaction_id 매칭률 측정.

## 3. Gap 좁히기 다음 조치 (우선순위)

| 순서 | 조치 | 의존성 | 효과 추정 |
|---:|---|---|---|
| 1 | canary 24h 안정화 | 시간 의존 (2026-05-08 23:01 KST) | click id 보존 안정성 확정 |
| 2 | ConfirmedPurchasePrep 재실행 (24h 후) | 1번 PASS | with_gclid 카운트 변화 측정 |
| 3 | paid_click_intent ↔ imweb_orders deterministic join 설계 | 별 sprint | 결제완료 주문에 click id 매칭률 산출 |
| 4 | BI confirmed_purchase 실행안 재검토 | 2,3번 결과 | Google Ads에 새 신호 후보 |
| 5 | `구매완료` Primary 변경 | 4번 7일 병행 관측 후 | NPay 오염 차단 → Google ROAS 신뢰도 정상화 |
| 6 | Google tag gateway 활성화 | TJ 결정 | 추적 보강 (B/C 보조) |
| 7 | Channel funnel quality BigQuery 분석 | BigQuery jobs.query (이미 보유) | (D) 광고 품질 분리 |

## 4. 본 agent가 자율 진행할 수 있는 것

| 작업 | 권한 | 시점 |
|---|---|---|
| canary T+45/60min monitoring | SSH (보유) | 시각 도달 |
| canary 6h/12h/24h monitoring | SSH | 시각 도달 |
| ConfirmedPurchasePrep 재실행 | npm script | canary 24h+ |
| paid_click_intent ↔ imweb_orders join dry-run | 운영 PG read-only (CLAUDE.md 명시) + 운영 VM sqlite read | 본 agent 자율 |
| BigQuery raw 조회 (transaction_id 매칭, channel funnel) | seo-656 SA via project-dadba7dd | 본 agent 자율 (backend script 호출 또는 운영 VM에서) |
| Google Ads API 재조회 (1주 후) | 운영 backend `/api/google-ads/dashboard` (현재 token 미설정으로 500) | TJ 권한 후 가능 |

## 5. TJ 영역 (자료/승인)

| 항목 | 비고 |
|---|---|
| VM Google Ads developer token 연결 승인 | 운영 VM `.env`에 `GOOGLE_ADS_DEVELOPER_TOKEN` 추가. 본 agent가 dashboard 200 검증 |
| canary 24h 후 정식 운영화 승인 | 24h 결과 보고 후 결정 |
| Google Ads BI confirmed_purchase 실행안 승인 | Phase3-Sprint5 별 승인안 |
| `구매완료` Primary 변경 승인 | Phase3-Sprint6 별 승인안 |
| Google tag gateway 활성화 (옵션 A/B/C 결정) | Imweb 회신 또는 Cloudflare 도입 결정 |

## 6. 본 sprint 전체 흐름과 연결

```text
2026-05-06 KST  GTM live 142 publish (paid_click_intent receiver)
2026-05-07 18:33 Google Ads VM ledger source recovery deploy → 내부 confirmed ROAS 0.28x 측정
2026-05-07 22:01 errorHandler hardening + PM2 1.5G uplift → 4 blocker 모두 PASS
2026-05-07 22:35 canary execution packet TJ 승인
2026-05-07 23:01 canary deploy → 운영 ledger write 시작
2026-05-07 23:23 T+22min: row 17, 5xx 0%
2026-05-07 23:31 T+30min: row 34, 5xx 0%, 145/h 페이스
2026-05-08 00:01 1h canary 종료 예정
2026-05-08 23:01 24h canary 종료 예정 → ConfirmedPurchasePrep 재실행 → click id fill rate 변화 측정
```

## 7. 한 줄 결론

> Google Ads ROAS gap의 원인 1순위는 NPay 오염, 2순위는 click id 유실이다. 본 sprint에서 click id 유실은 즉시 진행 중 (canary 30분 34건 저장). NPay 오염은 BI confirmed_purchase 실행안 + `구매완료` Primary 변경으로만 해결 가능 (별 Red 승인 필요). canary 24h 결과로 click id 부분의 효과 정량화 후 우선순위 재판정.
