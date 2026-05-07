# Channel funnel quality 정본 (실제 개발 순서)

작성 시각: 2026-05-08 02:00 KST
최종 업데이트: 2026-05-08 02:00 KST
기준일: 2026-05-07
상태: active canonical
Owner: data / channelfunnel
Supersedes: none (신규 정본)
Next document: ConfirmedPurchasePrep 재실행 결과 또는 NPay merchant API join sprint
Do not use for: GA4/Meta/Google Ads/TikTok/Naver 실제 전송, conversion upload, conversion action 변경, 광고 변경, 운영 DB write 외 (paid_click_intent canary 범위 안에서만)

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!datacheckplan.md
    - data/!bigquery_new.md
    - total/!total-current.md
    - gdn/!gdnplan_new.md
    - GA4/gtm.md
  lane: Green BigQuery raw 분석 + 운영 DB read-only join 정본
  allowed_actions:
    - GA4 BigQuery raw read-only query (SA seo-656)
    - 운영 PG read-only (tb_iamweb_users, tb_playauto_orders)
    - 운영 sqlite read-only (imweb_orders, attribution_ledger, paid_click_intent_ledger, npay_intent_log)
    - source_group 분류 + funnel 산출
    - 정본 update
  forbidden_actions:
    - 광고 플랫폼 전송
    - GA4/Meta CAPI/Google Ads upload
    - 운영 DB write 외 (paid_click_intent canary 범위만)
    - 광고 변경
  source_window_freshness_confidence:
    source: "GA4 BigQuery raw (hurdlers-naver-pay) + 운영 imweb_orders + ConfirmedPurchasePrep dry-run + paid_click_intent canary ledger"
    window: "2026-05-01 ~ 2026-05-07 KST (7일 baseline)"
    freshness: "events_20260506 last_mod 2026-05-07 00:39 UTC + canary T+60min row 52"
    confidence: 0.9
```

## 10초 결론

biocom 7일 channel funnel quality 비교 결과, **paid_tiktok은 광고 품질 위험 (sessions 19,563 / avg engagement 1초 / scroll90 1.58% / GA4 purchase 0건)**, **paid_google은 NPay 결제 흐름이 GA4 purchase로 fire 안 됨 (add_payment_info 770 / GA4 purchase 4건)**. **NPay 결제완료는 모든 source_group에서 GA4 purchase event 0건** — 이는 GTM v138 의도된 변경 ("[43] GA4_구매전환_Npay" 를 `purchase` → `add_payment_info` 로 강등) 결과. 실제 NPay 결제완료는 운영 PG/imweb_orders에만 있으며 click id 보존률이 0.8%로 매우 낮아 Google Ads 후보 prep이 어려운 상태. paid_click_intent canary 가 click id transit gap을 메꾸는 단계 (T+60min 자연 traffic 52건 저장).

**90% scroll 비중만으로도 channel quality 격차 명확** (paid_tiktok 1.58% vs organic_naver 31.03% = 19배). 50% scroll은 ProductEngagementSummary POC ([[../GA4/product-engagement-summary-poc-20260508]]) 별 트랙으로 분리하되 90% scroll로 채널 비교는 우선 가능.

## Phase-Sprint 요약표

| Priority | Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|---|
| P0 | Phase1 | [[#Phase1-Sprint1]] | 7일 funnel baseline + NPay fire 누락 확정 | Codex | 100% / 100% | [[#Phase1-Sprint1\|이동]] |
| P0 | Phase1 | [[#Phase1-Sprint2]] | 90% scroll source_group 비교 | Codex | 100% / 100% | [[#Phase1-Sprint2\|이동]] |
| P0 | Phase2 | [[#Phase2-Sprint1]] | NPay merchant 결제완료 ↔ paid_click_intent canary join | Codex | 0% / 0% | [[#Phase2-Sprint1\|이동]] |
| P1 | Phase2 | [[#Phase2-Sprint2]] | ConfirmedPurchasePrep 재실행 (canary 24h+) — Google Ads 후보 click id 보존률 측정 | Codex | 0% / 0% | [[#Phase2-Sprint2\|이동]] |
| P1 | Phase3 | [[#Phase3-Sprint1]] | 14일/30일 funnel 비교 (현 7일 대비 안정성) | Codex | 0% / 0% | [[#Phase3-Sprint1\|이동]] |
| P2 | Phase3 | [[#Phase3-Sprint2]] | paid_tiktok 광고 품질 분리 (TikTok Ads Manager 캠페인 spend/click/conversion vs GA4 funnel) | Codex | 0% / 0% | [[#Phase3-Sprint2\|이동]] |
| P2 | Phase4 | [[#Phase4-Sprint1]] | ProductEngagementSummary POC 진행 (50% scroll + visible_seconds) | Codex | 0% / 0% | [[#Phase4-Sprint1\|이동]] |

## 다음 할일

| 순서 | Phase/Sprint | 상태 | 담당 | 할 일 | 왜 하는가 | 어떻게 하는가 | 의존성 | 상세 | 컨펌 필요 |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | [[#Phase2-Sprint1]] | auto_ready | Codex | NPay 결제완료 ↔ paid_click_intent canary join 가능성 dry-run | NPay 결제완료가 GA4 purchase로 fire 안 됨 → 운영 PG에서 직접 join 필요 | `tb_playauto_orders` 또는 `imweb_orders.payment_method` 로 NPay 결제완료 분리 → `paid_click_intent_ledger.dedupe_key` 의 ga_session_id / client_id 와 join | canary 24h 누적 row 충분히 쌓인 후 (~2026-05-08 23:01 KST) | [[../gdn/google-ads-confirmed-purchase-candidate-prep-20260507]] | NO |
| 2 | [[#Phase2-Sprint2]] | time_waiting | Codex | ConfirmedPurchasePrep 재실행 + missing_google_click_id 변화 측정 | canary 후 click id 보존률 개선 측정 | `npm --prefix backend run agent:confirmed-purchase-prep` | canary 24h+ PASS | [[../gdn/google-ads-confirmed-purchase-candidate-prep-20260507]] | NO |
| 3 | [[#Phase3-Sprint1]] | auto_ready | Codex | 14일/30일 funnel 비교 (7일 안정성 검증) | 7일 sample 의 paid_tiktok 1초 패턴이 추세인지 단발인지 확인 | bq query 14/30일 동일 분류 + sessions/purchase/scroll90 비교 | 독립 (BigQuery 권한 보유) | (작성 예정) | NO |
| 4 | [[#Phase3-Sprint2]] | auto_ready | Codex | paid_tiktok 광고 품질 분리 분석 | 1초 engagement 0 purchase = bot/click farm/dest URL 오류 의심 | TikTok Ads Manager API 또는 csv export → spend/click/conversion vs GA4 sessions 비교 | 독립 | (작성 예정) | NO |
| 5 | [[#Phase4-Sprint1]] | parked_yellow | Codex + TJ | ProductEngagementSummary POC Phase 1 (no-write receiver 구현) | 50% scroll + visible_seconds 정확 측정 | [[../GA4/product-engagement-summary-poc-20260508]] §6 Phase 1 (server receiver 코드 작성) | 본 정본 + POC 설계 검토 | [[../GA4/product-engagement-summary-poc-20260508]] | YES (운영 deploy) |

## 현재 기준

| 항목 | 값 |
|---|---|
| 정본 문서 | [[!channelfunnel]] (이 파일) |
| 분석 window | 2026-05-01 ~ 2026-05-07 (7일) |
| 1차 evidence 시각 | 2026-05-08 01:00 KST 본 sprint 직접 측정 |
| GA4 BigQuery source | hurdlers-naver-pay.analytics_304759974 (events_20260506 70,294 rows last_mod 2026-05-07 00:39 UTC) |
| job project | project-dadba7dd-0229-4ff6-81c (asia-northeast3) |
| SA | seo-656@seo-aeo-487113.iam.gserviceaccount.com |
| 분류 기준 | session_start traffic_source.{source,medium} |
| GA4 purchase event | **homepage 결제만 fire**, NPay 결제완료 0건 (의도된 GTM v138 변경) |
| 90% scroll 측정 가능 | YES (GA4 Enhanced Measurement scroll event) |
| 50% scroll 측정 가능 | NO (GA4 raw 부재, GTM trigger [11] firing tag 미연결, ProductEngagementSummary POC 별 sprint) |
| 7일 GA4 purchase total | 420건 (모두 pay_method=homepage) |
| 7일 운영 결제완료 (5/5 dry-run) | 623건 (homepage 586 + NPay 37) |
| GA4 vs 운영 결제완료 gap | NPay 37건 + GA4 fire 누락 ~166건 |
| Source group별 90% scroll 비중 | organic_naver 31.03% / paid_naver 27.62% / direct 26.41% / organic_search 25.61% / paid_google 22.83% / other 19.18% / paid_meta 9.88% / paid_tiktok 1.58% |
| paid_tiktok 위험 신호 | sessions 19,563 / avg_eng 1초 / GA4 purchase 0 / scroll90 1.58% (광고 품질 또는 bot 의심) |
| paid_google ROAS gap | sessions 5,362 / add_payment_info 770 / GA4 purchase 4 (NPay 결제완료 fire 누락이 직접 원인) |

## 7일 funnel 표 (전체)

| source_group | sessions | users | avg_eng_sec | scroll90_pct | view_item | add_to_cart | begin_checkout | add_payment_info | purchase_homepage | purchase_npay | purchase_no_pay_method |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| paid_meta | 20,122 | 16,291 | 12 | 9.88% | 6,772 | 119 | 307 | 36 | 133 | 0 | 0 |
| paid_tiktok | 19,563 | 17,223 | 1 | 1.58% | 8,824 | 57 | 16 | 65 | 0 | 0 | 0 |
| direct | 5,395 | 4,781 | 28 | 26.41% | 599 | 54 | 240 | 16 | 103 | 0 | 0 |
| paid_google | 5,362 | 2,957 | 40 | 22.83% | 1,175 | 353 | 111 | 770 | 4 | 0 | 0 |
| other | 1,559 | 918 | 79 | 19.18% | 727 | 87 | 133 | 36 | 58 | 0 | 0 |
| organic_naver | 1,505 | 1,284 | 54 | 31.03% | 298 | 31 | 76 | 14 | 41 | 0 | 0 |
| paid_naver | 1,278 | 1,011 | 99 | 27.62% | 354 | 68 | 165 | 18 | 71 | 0 | 0 |
| organic_search | 328 | 234 | 66 | 25.61% | 92 | 5 | 18 | 5 | 10 | 0 | 0 |

→ **전 source_group의 purchase_npay = 0건**. 즉 GA4 purchase event는 NPay 결제완료를 절대 추적하지 않음.

## 90% scroll만으로도 channel quality 비교 가능 (50% 추가 안 해도 유의미)

```text
organic_naver  31.03%  ████████████████████████████  (가장 깊게 봄)
paid_naver     27.62%  ████████████████████████
direct         26.41%  ███████████████████████
organic_search 25.61%  ██████████████████████
paid_google    22.83%  ████████████████████
other          19.18%  █████████████████
paid_meta       9.88%  ████████  (광고 노출 후 빠르게 이탈)
paid_tiktok     1.58%  █  (1초 engagement과 일치, 광고 품질 위험)
```

해석:
- **organic / direct / paid_naver / paid_google / organic_search 22~31% 군**: 관심 있는 사용자 (페이지 끝까지 스크롤). brand 인지 또는 검색 유입.
- **paid_meta 9.88%**: 광고 노출 후 빠른 이탈. 정상 패턴 (Meta는 lookalike + display 노출 비중 큼).
- **paid_tiktok 1.58%**: 비정상 패턴. avg_eng 1초 + purchase 0건과 함께 광고 품질 또는 bot 위험 신호.

→ **50% scroll 추가 없이도 90% scroll만으로 channel quality 격차 19배 명확**. 50% scroll 추가 가치는:
1. 90% 도달 안 한 사용자들 중 "어디까지 봤는가" 분리.
2. middle funnel attention (예: 상품 페이지 50% 도달 = scroll engaged).
3. ProductEngagementSummary POC ([[../GA4/product-engagement-summary-poc-20260508]]) 의 visible_seconds + max_scroll_percent 분석에서 같이 사용.

→ **결론**: 90% scroll로 즉시 운영 분석 가능. 50% scroll 태그 추가는 ProductEngagementSummary POC와 함께 진행하면 효율 (ad-hoc GTM 추가보다 종합 collector가 정확).

## NPay 결제완료 GA4 추적 검증 결과

### TJ 질문: NPay 결제완료를 GA4 purchase로 잡고 있는가?

**답: NO. NPay 결제완료는 모든 source_group의 GA4 purchase event에 0건 fire**.

### 근거

1. GA4 7일 purchase event 총 420건 → pay_method 분포 = `homepage` 420건 / `npay` 0건 / null 0건.
2. 운영 결제완료 5/5 dry-run = 623건 (homepage 586 + NPay 37). GA4 7일 420건과 차이 약 200건 = NPay 결제완료 + GA4 fire 누락 케이스.
3. GTM v138 (2026-04-24 publish) 에서 의도된 변경: `[43] GA4_구매전환_Npay` tag → `purchase` → `add_payment_info` 강등 ([[../GA4/gtm]] §"v138 적용한 변경").
4. 따라서 paid_google `add_payment_info 770` 중 대다수는 NPay 클릭 + 결제완료 시도 (NPay 결제완료 자체가 GA4로 잡히지 않음).

### 의미

- Google Ads `구매완료` Primary action `7130249515` 의 NPay label `r0vuCKvy-...` 분자 99.99% 를 만드는 NPay click/count 는 **자사 GA4 raw에 추적 안 됨**.
- Google Ads 측에는 NPay click 을 conversion으로 학습 → ROAS 8.72x.
- 자사 confirmed revenue (운영 PG/imweb_orders.payment_method='naver_pay' 또는 별도 NPay merchant API)는 GA4에서 분리 측정 불가 → ROAS 0.28x (운영 VM attribution_ledger 기준).
- **Gap 8.44p의 직접 원인 1**: NPay click/count Primary 오염 (Google Ads 측 분자).
- **Gap 8.44p의 직접 원인 2**: NPay 결제완료 GA4 fire 누락 → 자사 confirmed revenue 측정 시 NPay 결제 비중을 GA4 BigQuery로 측정 불가 (운영 PG 직접 read만).

### 해결 방향

1. **NPay 결제완료 ↔ paid_click_intent canary join** (Phase2-Sprint1):
   - 운영 imweb_orders 또는 NPay merchant API에서 `payment_method='naver_pay'` 결제완료 추출.
   - paid_click_intent_ledger 의 `ga_session_id` / `client_id` / `landing_path` 로 join 시도.
   - ConfirmedPurchasePrep 재실행에서 NPay 결제완료에도 click_id 매칭 시도.
2. **GTM 추가 검토** (별 Yellow 승인): NPay 결제완료 콜백 시점에 GA4 purchase event fire 가능한지 검토. 단 NPay 외부 결제 흐름이라 콜백 자체가 자사 페이지로 안 돌아오면 불가.
3. **운영 dashboard 분리 표시** ([[total-frontend-current-design-20260507]]): GA4 purchase = homepage only 명시, NPay 결제완료는 운영 PG 별도 컬럼.

## Active Action Board

| Priority | Status | Phase/Sprint | 작업 | 다음 액션 | 담당 | 컨펌 |
|---|---|---|---|---|---|---|
| P0 | auto_ready | Phase2-Sprint1 | NPay 결제완료 ↔ paid_click_intent canary join dry-run | canary 24h+ row 충분 시 본 agent 자동 실행 | Codex | NO |
| P1 | time_waiting | Phase2-Sprint2 | ConfirmedPurchasePrep 재실행 + missing_click_id 변화 | canary 24h PASS 후 자동 | Codex | NO |
| P1 | auto_ready | Phase3-Sprint1 | 14일/30일 funnel 비교 | 본 agent BigQuery query | Codex | NO |
| P2 | auto_ready | Phase3-Sprint2 | paid_tiktok 광고 품질 분리 분석 | TikTok Ads Manager spend/click/conversion vs GA4 funnel | Codex | NO |
| P2 | parked_yellow | Phase4-Sprint1 | ProductEngagementSummary POC Phase 1 | server receiver 구현 (Yellow deploy) | Codex + TJ | YES (운영 deploy) |

## Approval Queue

현재 open: **없음**.

future:

| 항목 | 재개 조건 |
|---|---|
| ProductEngagementSummary 운영 deploy | POC Phase 0 검토 + 본 정본 link |
| GTM 추가 NPay purchase fire | NPay 외부 결제 흐름 콜백 검토 + 별 Red 승인 |
| TikTok 광고 정지 또는 캠페인 변경 | 광고 품질 분리 분석 결과 + TJ 사업 판단 |

## Completed Ledger

| 완료 시각 | 항목 | 결과 |
|---|---|---|
| 2026-05-08 01:00 KST | 7일 channel funnel baseline 측정 | 8 source_group 분류 + sessions/users/eng/funnel/scroll90/purchase 산출 |
| 2026-05-08 01:00 KST | NPay 결제완료 GA4 fire 누락 확정 | 모든 source_group purchase_npay = 0, pay_method 단일 'homepage' |
| 2026-05-08 01:00 KST | 90% scroll source_group 비교 | paid_tiktok 1.58% vs organic_naver 31.03% (19배 격차) |
| 2026-05-08 01:00 KST | paid_google add_payment_info 770 vs purchase 4 = NPay fire 누락 직접 원인 확정 | Google ROAS gap 8.44p 의 결제 단계 evidence |

## Source / Window / Freshness / Confidence

| 영역 | Source | Window | Freshness | Confidence |
|---|---|---|---|---|
| 7일 funnel + scroll90 + purchase pay_method | hurdlers-naver-pay.analytics_304759974.events_* | 2026-05-01~2026-05-07 | events_20260506 last_mod 2026-05-07 00:39 UTC | 0.92 |
| GTM v138 NPay tag 강등 evidence | [[../GA4/gtm]] §v138 변경 + GA4 BigQuery purchase pay_method 분포 | 2026-04-24 publish | live v142 그대로 | 0.95 |
| 운영 결제완료 (homepage + NPay) | [[../gdn/google-ads-confirmed-purchase-candidate-prep-20260507]] | 2026-05-05 dry-run | dry-run 완료 | 0.85 |
| paid_click_intent canary | [[../gdn/paid-click-intent-minimal-ledger-canary-phase0-1-2-result-20260507]] | 2026-05-07 23:01~00:00 KST | T+60min PASS | 0.90 |

## Phase별 상세

### Phase1-Sprint1

**이름**: 7일 funnel baseline + NPay fire 누락 확정

[[#Phase-Sprint 요약표|▲ 요약표로]]

완료한 것:

- 8 source_group 분류 + sessions/users/avg_eng/funnel/purchase 산출.
- pay_method = homepage 420건 / npay 0건 / null 0건 측정.
- paid_tiktok avg_eng 1초 + purchase 0건 신호 분리.
- paid_google add_payment_info 770 vs purchase 4 = NPay fire 누락 evidence 확보.

남은 것:

- 14일/30일 비교 별 sprint.

### Phase1-Sprint2

**이름**: 90% scroll source_group 비교

[[#Phase-Sprint 요약표|▲ 요약표로]]

완료한 것:

- 8 source_group의 sessions_with_scroll90 / scroll90_pct 산출.
- 19배 격차 확인 (paid_tiktok 1.58% vs organic_naver 31.03%).
- 50% scroll 추가 가치 검토 (POC 별 sprint).

### Phase2-Sprint1

**이름**: NPay 결제완료 ↔ paid_click_intent canary join dry-run

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표: NPay 결제완료 시점 click id 보존률 측정.

방법:
- 운영 imweb_orders `WHERE payment_method = 'naver_pay'` 결제완료 추출.
- paid_click_intent_ledger의 dedupe_key (ga_session_id / client_id / landing_path) 로 join 시도.
- 매칭 row 의 click_id_value 가 NPay 결제완료 주문에 있는지 확인.
- 매칭률 산출.

조건: canary 24h+ paid_click_intent_ledger row 충분 (~3,400건 추정).

### Phase2-Sprint2

**이름**: ConfirmedPurchasePrep 재실행

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표: missing_google_click_id 카운트 변화 측정.

직전: 운영 결제완료 623건 중 with_gclid 5건 (0.8%).

재실행 후 기대: with_gclid 비율이 의미 있게 증가 (예: 30%+) → BI confirmed_purchase 후보 충분.

### Phase3-Sprint1

**이름**: 14일/30일 funnel 비교

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표: 7일 sample의 paid_tiktok 1초 패턴이 추세인지 단발인지 확인.

방법: 동일 분류 14일 / 30일 비교. 격차 변화 추적.

### Phase3-Sprint2

**이름**: paid_tiktok 광고 품질 분리 분석

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표: 1초 engagement + 0 purchase 의 원인 분리 (bot / click farm / dest URL 오류 / 추적 누락).

방법:
- TikTok Ads Manager에서 캠페인별 spend/click/CTR/conversion 추출.
- GA4 raw의 paid_tiktok sessions와 cross-check.
- TikTok pixel/Events API send 로그 ([[../tiktok/!tiktokroasplan]]) 와 비교.

### Phase4-Sprint1

**이름**: ProductEngagementSummary POC Phase 1

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표: visible_seconds + max_scroll_percent 정확 측정 시작.

설계: [[../GA4/product-engagement-summary-poc-20260508]] §6 Phase 1 (server receiver no-write 구현).

조건:
- 본 정본 + POC 설계 검토 통과.
- 운영 deploy Yellow 승인.

## 한 줄 결론

> 7일 baseline에서 NPay 결제완료 GA4 fire 누락 확정 (모든 source_group purchase_npay 0건) + 90% scroll로 channel quality 19배 격차 분리 가능. 다음 단계는 NPay 결제완료 ↔ paid_click_intent canary join + ConfirmedPurchasePrep 재실행으로 click id 보존률 개선 정량화.
