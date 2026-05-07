# TJ 컨펌 필요 항목 통합 한 장 — 2026-05-07 23:40 KST 기준

작성 시각: 2026-05-07 23:40 KST
작성자: 본 agent (Claude Code)
대상: TJ
관련 정본: [[../total/!total-current]], [[../gdn/!gdnplan_new]], [[../agent/!aiosagentplan]], [[!confirm]]

## 5줄 결론

1. 지금 즉시 회신 필요한 컨펌은 **0건**입니다. 모두 시간 의존 또는 24h+ 후 결정 영역.
2. 24h 안에 한 번 보실 컨펌 후보는 **2건** (P0 minimal_ledger 정식 운영화 / Yellow VM Google Ads token).
3. 1주 안에 결정 영역 컨펌 후보는 **3건** (Google Ads BI confirmed_purchase 실행 / `구매완료` Primary 변경 / Google tag gateway 활성화 옵션).
4. 외부 문의/자료 요청 1건 (Imweb native 지원 여부).
5. 모든 항목에 본 agent 추천과 자신감 표시. 보류 사유와 재개 조건도 명시. 무엇을 왜 컨펌하는지 한 줄 요약.

## 컨펌 우선순위 표

| # | 항목 | 시점 | Lane | 본 agent 추천 | 자신감 | 본 agent 자율 가능? |
|---:|---|---|---|---|---:|---|
| 1 | minimal `paid_click_intent` ledger write 정식 운영화 | canary 24h 종료 후 (~2026-05-08 23:01 KST) | Yellow → Green 전환 | **YES** (24h PASS 시) | 88% | NO (재승인 필요) |
| 2 | VM Google Ads developer token 연결 | 즉시 가능 | Yellow | **YES** | 92% | NO (env 변경 권한) |
| 3 | Google Ads BI confirmed_purchase 실행안 | ConfirmedPurchasePrep 재실행 PASS 후 (~D+1) | Red | **조건부 YES** (click id 보존률 충분 시) | 70% | NO (Google Ads 변경) |
| 4 | Google Ads `구매완료` Primary 변경 | 신규 confirmed_purchase 7일 병행 관측 후 (~D+8) | Red | **YES** (조건 충족 후) | 80% | NO |
| 5 | Google tag gateway 활성화 옵션 결정 | Imweb 회신 후 | Yellow/Red | **NO 즉시 / YES 후속** | 65% | NO (DNS/CDN 권한) |
| 6 | Imweb 측 Google tag gateway native 지원 외부 문의 | 즉시 가능 | Green (외부) | **YES** | 88% | NO (외부 업체 문의) |
| **7** | **biocom freshness source 결정 (hurdlers vs backfill copy)** | **즉시 가능** | **Yellow** | **A: hurdlers 유지** (자신감 75%) 또는 **B: backfill copy 전환** (자신감 60%) | 70% | NO (운영 backend source 위치 변경) |
| **8** | **AIBIO BigQuery 우리 SA query 권한 부여** | **TJ가 외부 (허들러스 또는 GA4 Admin) 요청 가능** | **Yellow** | **YES** (Supabase와 cross-check 가능 시) | 80% | NO (외부 권한 부여) |

---

## 1. minimal `paid_click_intent` ledger write 정식 운영화

### 무엇을 컨펌하는가

canary 24h가 PASS로 종료된 뒤, minimal ledger write를 **무기한 운영 모드**로 전환할지 결정.

### 왜 컨펌이 필요한가

본 agent가 받은 승인은 `1h canary → 24h 제한 write`까지였다. 24h 종료 후 자동 연장은 별 승인. 무기한 운영 = 데이터 보관·암호화·삭제 정책이 영구화되므로 사람 결정.

### 본 agent 추천 방향

**YES (canary 24h PASS 시)**.

근거:
- T+30min 시점 row 34건, 145건/h 페이스. PM2 0 추가 restart, paid-click 5xx 0%, mem 222MB 안정.
- ConfirmedPurchasePrep 재실행으로 missing_google_click_id 변화 측정 가능 → Google ROAS gap 좁히기 핵심 입력.
- 보관기간 90일 TTL + click_id_value 만 raw 저장 + PII/order/payment guard로 데이터 노출 위험 최소.

조건:
- canary 24h 동안 5xx < 1%, PM2 restart < 5회, heap < 70%, dedupe ratio 정상.
- 24h 동안 outlier (예: 메모리 누수 시그널, 비정상 5xx burst)가 없을 것.
- 24h 결과 보고서 + ConfirmedPurchasePrep 재실행 결과.

### 어떻게 진행되는가

1. canary 24h 종료 후 본 agent가 자동으로 결과 보고서 작성.
2. TJ 회신 후 본 agent가 정식 운영 status 정본 update.
3. flag 유지 (`PAID_CLICK_INTENT_WRITE_ENABLED=true`).
4. 90일 TTL 만료 cron job 별 sprint에서 추가.

### 실패 시 / 회신 NO 시

- 본 agent 즉시 flag false rollback.
- canary 기간 row TTL 또는 status=rejected 처리.
- 다음 시도 전에 추가 안전 조건 (sample rate 0.1로 제한, 별 schema 격리 등) 검토.

### 산출물

- 24h 결과 보고서: `gdn/paid-click-intent-minimal-ledger-canary-24h-result-20260508.md` (자동 작성 예정)
- 정식 운영 승인안 update: `gdn/paid-click-intent-minimal-ledger-write-approval-20260507.md` Status: executed

### 회신 한 줄

```text
YES: minimal paid_click_intent ledger write 정식 운영화 승인 (canary 24h 결과 PASS 가정)
```

---

## 2. VM Google Ads developer token 연결

### 무엇을 컨펌하는가

운영 VM `.env`에 `GOOGLE_ADS_DEVELOPER_TOKEN` 환경변수를 추가하는 것을 승인.

### 왜 컨펌이 필요한가

token은 비밀정보이고, env 변경은 본 agent 자율 권한 밖. TJ가 token 값을 paste하거나 본 agent에게 별 보안 채널로 전달해야 한다.

### 본 agent 추천 방향

**YES (즉시)**.

근거:
- 현재 VM `/api/google-ads/dashboard` endpoint는 token 미설정으로 500. 직전 sprint Codex가 deploy 한 코드는 정상이지만 token 없어서 read 불가.
- token 연결 시 본 agent가 즉시 same-window 검증 가능 (Google Ads API last_30d ROAS 8.72x 재확인 + 추세 추적).
- read-only token이라 외부 변경 위험 없음.

### 어떻게 진행되는가

1. TJ가 1Password 또는 별 secure channel로 token 값 전달.
2. 본 agent SSH로 운영 VM `.env`에 추가 (백업 후).
3. PM2 restart `--update-env`.
4. `/api/google-ads/status` 200, `/api/google-ads/dashboard?date_preset=last_30d` 200 검증.
5. 결과 보고.

### 실패 시

- token 형식 오류면 정정 후 재시도.
- 권한 부족이면 Google Ads 콘솔에서 SA 권한 확인.

### 회신 한 줄

```text
YES: VM Google Ads developer token 연결 승인 (token 별 secure channel 전달 예정)
```

---

## 3. Google Ads BI confirmed_purchase 실행안 (Red)

### 무엇을 컨펌하는가

Google Ads에 **실제 결제완료 주문만 구매로 알려주는 새 conversion action**을 생성하고 enhanced conversion 또는 offline import로 신호를 보내는 것.

### 왜 컨펌이 필요한가

- Google Ads conversion action 생성 = 자동입찰 학습 영향.
- conversion upload = 플랫폼 숫자 변경.
- 잘못 시작하면 광고 학습이 흔들려 회복에 시간 소요.

### 본 agent 추천 방향

**조건부 YES** (자신감 70%).

근거:
- Google Ads ROAS 8.72x vs internal 0.28x gap 8.44p 중 NPay 오염 (`구매완료` action 99.99%) 차단이 주효.
- 새 conversion action을 Secondary 또는 observation으로 7일 병행 관측 후 Primary 교체가 안전 시퀀스.

조건 (모두 충족 시):
- canary 24h+ 안정 (선결).
- ConfirmedPurchasePrep 재실행에서 with_gclid 비율이 5/623 (0.8%) → 의미있는 수준 (예: 30%+) 으로 개선.
- paid_click_intent ↔ imweb_orders deterministic join 후 sendable 후보 N건 이상 확보.
- Rollback 기준: 7일 동안 Google Ads `Conv. value` 변동 < 20%, internal confirmed ROAS 변동 < 30%.

### 어떻게 진행되는가

1. Phase4-Sprint8 (ConfirmedPurchasePrep 재실행) 결과 보고.
2. paid_click_intent ↔ imweb_orders join dry-run 결과 보고.
3. 충분하면 [[../gdn/google-ads-confirmed-purchase-execution-approval-20260505]] update.
4. TJ Red 승인.
5. 본 agent가 새 conversion action 생성 → Secondary 모드 → 7일 병행 → Primary 후보.

### 실패 시 / 회신 NO 시

- click id 보존률만 더 끌어올리는 사이클로 회귀.
- Google tag gateway 활성화 검토 (옵션 5번).

### 회신 한 줄

```text
YES: Google Ads BI confirmed_purchase 실행안 승인 (조건 PASS 시 본 agent 진행)
```

또는 보류 시:

```text
보류: ConfirmedPurchasePrep 재실행 결과 + paid_click_intent join 결과 보고 후 재판정
```

---

## 4. Google Ads `구매완료` Primary 변경

### 무엇을 컨펌하는가

기존 `구매완료` action `7130249515` (NPay label `r0vuCKvy-...`)를 **Secondary로 강등**하고, 신규 confirmed_purchase action을 Primary로 승격.

### 왜 컨펌이 필요한가

- Primary 변경 = 자동입찰 학습 신호 변경.
- 잘못하면 광고 회복이 느림.

### 본 agent 추천 방향

**YES** (자신감 80%, 단 조건 충족 후).

근거:
- 현재 `구매완료` Primary는 NPay click/count를 그대로 학습 (분자 99.99%).
- 신규 confirmed_purchase가 7일 병행으로 안정 신호임이 검증되면, Primary 교체로 자동입찰 신호 정상화.

조건:
- 항목 #3이 7일 안정 PASS.
- 신규 신호 conversion 수, value, cost 안정.

### 어떻게 진행되는가

1. 항목 #3 신규 conversion action 7일 데이터 수집.
2. [[../gdn/google-ads-purchase-primary-change-approval-20260505]] update.
3. TJ Red 승인.
4. 본 agent가 Google Ads UI 또는 API로 변경.
5. 7일 모니터링 후 Secondary 강등 효과 검증.

### 회신 한 줄

```text
YES: 구매완료 Primary 변경 (항목 3번 7일 PASS 시)
```

---

## 5. Google tag gateway 활성화 옵션 결정

### 무엇을 컨펌하는가

Google tag gateway를 biocom.kr / thecleancoffee.com 에 적용할지 결정. 옵션 A (Cloudflare 도입), B (Imweb native 지원), C (자체 backend 구현).

### 왜 컨펌이 필요한가

- 옵션 A: DNS nameserver 변경, 영향 큼.
- 옵션 B: Imweb 회신 의존.
- 옵션 C: 자체 작업량 큼.
- 활성화 자체가 Google 측정 경로 변경 → 측정 신호 영향.

### 본 agent 추천 방향

**즉시 활성화 NO. 활성화 옵션 결정 후속 YES**.

근거:
- 현재 P0/P1은 minimal ledger + ConfirmedPurchasePrep + BI confirmed_purchase. Google tag gateway는 보조 영역.
- biocom·coffee 모두 AWS CloudFront (Imweb 자사몰) → Cloudflare wizard 즉시 적용 불가.
- 옵션 B (Imweb native 지원) 회신부터 받고 결정이 가장 효율.

### 어떻게 진행되는가

1. TJ가 Imweb 측에 "Google tag gateway 또는 first-party measurement endpoint native 지원 여부" 1회 문의.
2. 회신에 따라 옵션 결정.
3. 옵션 결정 후 본 agent가 활성화 승인안 update + 검증/롤백 plan.

### 회신 한 줄

```text
보류: Imweb 회신 후 옵션 결정
```

또는 직접 옵션 선택:

```text
YES: 옵션 A (Cloudflare 도입) 로 진행
YES: 옵션 C (자체 backend custom) 로 진행
```

---

## 6. Imweb Google tag gateway native 지원 외부 문의

### 무엇을 컨펌하는가

TJ가 Imweb 측 (자사몰 호스팅 업체) 에 1회 문의: "Google tag gateway 또는 first-party measurement endpoint를 Imweb이 native로 지원하는가?"

### 왜 컨펌이 필요한가

- 외부 업체 문의는 본 agent 권한 밖.
- 회신이 옵션 5번 결정의 핵심 입력.

### 본 agent 추천 방향

**YES (즉시)**.

근거:
- 비용 0 (이메일 1회).
- 회신이 긍정적이면 옵션 A (Cloudflare 도입, DNS 변경) 자체를 skip 가능.
- 회신이 부정적이면 옵션 A vs C 비교에 즉시 들어갈 수 있음.

### 어떻게 진행되는가

1. TJ가 Imweb 고객센터/메일에 문의.
2. 회신 paste.
3. 본 agent가 옵션 A/B/C 결정 표 update.

### 회신 한 줄

```text
YES: Imweb 문의 진행 예정 (회신 받으면 paste)
```

---

## 본 agent 자율 진행 (TJ 컨펌 NO)

이 항목들은 컨펌 없이 본 agent가 진행합니다 (참고용).

| 작업 | 시점 |
|---|---|
| canary T+45/60min monitoring | 시각 도달 |
| canary 6h/12h/24h monitoring + 결과 보고 | 시각 도달 |
| 24h PASS 시 정식 운영화 결과 보고 후 TJ #1 회신 대기 | 24h 후 |
| ConfirmedPurchasePrep 재실행 (canary 24h PASS 후) | 자동 |
| paid_click_intent ↔ imweb_orders deterministic join dry-run | 본 agent 자율 (CLAUDE.md PG read-only 명시) |
| Channel funnel quality BigQuery 분석 (Meta vs Google vs Organic) | 본 agent 자율 (BigQuery 권한 보유) |
| Meta funnel CAPI readiness 코드 read + Test Events 계획 | 본 agent 자율 (코드 read-only) |
| ReportAuditorAgent 정기 실행 | 자동 |
| ApprovalQueueAgent 정기 실행 | 자동 |

---

## 7. biocom freshness source 결정 (hurdlers vs backfill copy)

### 무엇을 컨펌하는가

운영 backend `sourceFreshness.ts` 가 biocom GA4 BigQuery freshness를 점검할 때, **(A) `hurdlers-naver-pay.analytics_304759974`** (직접 GA4 export) vs **(B) `project-dadba7dd-0229-4ff6-81c.analytics_304759974_hurdlers_backfill`** (TJ 시작한 우리쪽 backfill) 둘 중 어느 dataset을 source로 둘지 결정.

### 본 agent 검증 결과

| 측면 | A. hurdlers | B. backfill copy |
|---|---|---|
| Daily export | 자동 (GA4 직접) | 수동/cron (이번 sprint 검증 시점 2회 batch) |
| 최신 events_table | events_20260506 (last_mod 2026-05-07 00:39 UTC) | events_20260506 (last_mod 2026-05-07 06:38 UTC, 6h 늦음) |
| row_count 무결성 | 70,294 | 70,294 (100% 일치) |
| purchase distinct_txn 7일 | 72/49/59/88/73/79 | 동일 |
| 우리 SA dataset Read 권한 | YES | YES |
| 우리 project jobs.create | NO (project-dadba7dd 경유 필요) | YES (직접) |
| 운영 backend dist update 필요? | dist에 jobProjectId 분리 필요 | 직접 사용 가능 |
| 권한이 외부에 의존? | 허들러스 측 SA 권한 유지 가정 | 우리 GCP project 안 |
| 데이터 손실 위험 | 허들러스 측 link 한도 또는 권한 회수 시 | backfill cron 끊기면 stale |

### 본 agent 추천 방향

| 옵션 | 추천 | 자신감 |
|---|---|---:|
| **A. hurdlers 유지** | **현재 가장 안전. 데이터 직접 출처. dist update만 하면 즉시 freshness PASS** | 75% |
| B. backfill copy 전환 | 권한이 우리쪽이지만 cron 의존. backfill 일정/자동화 안정성 검증 후 | 60% |
| C. dual (A primary + B secondary cross-check) | 안정성 가장 높지만 코드/운영 복잡도 증가 | 55% |

**추천: 옵션 A 유지** (당장은). 단 backfill cron이 hourly/매일 자동이라면 옵션 B 전환 검토. TJ가 backfill 운영 의도 (왜 시작했는지 — 권한 이전 / 비용 절감 / hurdlers 의존성 제거 등) 알려 주시면 자신감 높일 수 있음.

### 회신 한 줄

```text
A: biocom freshness source는 hurdlers 유지
```

또는

```text
B: biocom freshness source는 backfill copy로 전환 (백필 cron 일정 = N시간/일 간격)
```

또는

```text
C: dual (hurdlers primary + backfill secondary cross-check)
```

---

## 8. AIBIO BigQuery 우리 SA query 권한 부여

### 무엇을 컨펌하는가

`project-dadba7dd-0229-4ff6-81c.analytics_326993019` (AIBIO GA4 dataset)는 dataset 자체는 등장했지만 우리 SA `seo-656@seo-aeo-487113`로 `__TABLES__` query 시 Access Denied. **권한 부여 절차** 진행 승인.

### 본 agent 추천 방향

**YES** (자신감 80%).

근거:
- AIBIO 정본은 Supabase (43 table)이지만, GA4 raw event를 BigQuery로 cross-check 가능하면 funnel quality / channel attribution 분석 보강.
- AIBIO Supabase에 GA4 client_id / session_id가 저장되어 있다면 BigQuery raw event ↔ Supabase order join 가능.
- 권한 부여만 받으면 본 agent 자율 분석 가능.

### 어떻게 진행되는가

1. TJ가 GCP IAM 또는 dataset-level access control에서 우리 SA에 BigQuery Data Viewer + Job User 권한 부여 (또는 허들러스/AIBIO 측에 요청).
2. 본 agent가 query 가능 검증.
3. AIBIO GA4 raw event 적재 상태 (events_20260506 row count, purchase 카운트 등) 확인.
4. 별 sprint에서 channel funnel quality (Meta vs Google vs Organic) 비교에 AIBIO 도 포함 여부 결정.

### 회신 한 줄

```text
YES: AIBIO BigQuery 우리 SA query 권한 부여 (외부 측에 요청 진행)
```

---

## 한 줄 결론

> 즉시 회신 컨펌은 0건입니다. canary 24h 후 (#1) 정식 운영화 + 즉시 가능한 (#2) VM Google Ads token + (#6) Imweb 외부 문의 + (#7) biocom freshness source 결정 + (#8) AIBIO 권한 부여 정도가 24시간 안에 다루실 것이고, 나머지는 1주+ 후 단계입니다.
