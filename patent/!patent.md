# NPay 외부 결제 채널 attribution recovery — 특허 출원 검토

정본 link: harness/common/HARNESS_GUIDELINES.md · harness/common/AUTONOMY_POLICY.md · harness/common/REPORTING_TEMPLATE.md (본 문서는 project-local 특허 검토안, 정본 fork 아님)

작성 시각: 2026-05-04 KST
작성자: Claude Code (TJ 의 요청에 따른 read-only 분석 + 신규 문서 작성)
대상: 더클린커피 / 바이오컴 NPay (네이버페이 외부 주문형/결제형) 의 attribution recovery 솔루션
면책: 본 Claude Code 는 변리사가 아니다. 본 검토는 evidence 기반 신규성/진보성 추정과 청구범위 초안. 실제 출원/등록 가능성 결론은 한국/미국 변리사 자문 + 정밀 prior art search 필요.

## 5줄 결론

1. NPay 구매 detection 은 두 site 모두 운영 환경에서 실 데이터 capture 성공 — biocom intent 304건 (live publish 2026-04-27, 핵심 필드 채움률 100%) + Coffee ledger row 16건 (A-4 publish 2026-05-02 LIVE, dispatcher v2.1 자동 검증 12/12 PASS, mobile/PC/funnel-capi key timing 873ms 안전 capture).
2. 핵심 발명 7요소 — funnel-capi sessionId/eid + sessionStorage propagation, client-side intent + server-side ledger 분리, dispatcher v2.1 wait-window+tick-retry, dual-key matching (Imweb order_number + NPay channel_order_no), A/B/ambiguous 등급 분류, 9 조기 게이트 자동 평가, Lane 기반 자율 권한 + harness fork detection.
3. 한국 (KIPO) 등록 가능성 추정 **60-75%** — software-implemented 결제 attribution method 는 한국 software 특허로 등록 가능, prior art (Branch.io / Adjust / Adobe Visitor Stitching / Meta CAPI advanced matching) 와의 차별성 = NPay 같은 비표준 외부 결제 채널의 세션 손실 회복 method 가 핵심.
4. 미국 (USPTO) 등록 가능성 추정 **40-60%** — Alice/Mayo (abstract idea) 시험 통과 위해 specific computer architecture 명시 필요. claim 작성 시 server-client 분산 구조 + non-conventional dispatcher timing model 강조.
5. **TJ 결정 권장**: 변리사 자문 진입 (prior art 정밀 search + claim 정제) 또는 보류 (trade secret + 사내 노하우 보존). 본 Claude Code 추천 = **자문 진입 70%** (등록 안 되더라도 prior art search 자체로 경쟁사 출원 risk 평가 가능).

## 1. NPay 구매 detection 성공 evidence

본 섹션은 patent 출원 시 "발명을 실시한 evidence" 로 사용 가능한 실 운영 데이터.

### 1.1 biocom NPay (live publish 2026-04-27 ~)

| 항목 | 값 | 출처 |
|---|---|---|
| live publish 시점 | 2026-04-27 18:10 KST | naver/!npay.md 행 459 |
| live version | `139` (`npay_intent_only_live_20260427`) | naver/!npay.md 행 16 |
| live intent 누적 | 304건 (2026-04-30 21:25 KST 기준) | naver/!npayroas.md 행 16 |
| 핵심 필드 채움률 | client_id / ga_session_id / product_idx 모두 100% | naver/!npay.md 행 18 |
| match dry-run 결과 | strong match 8 (A 6 + B 2), ambiguous 3, purchase_without_intent 0 | naver/!npayroas.md 행 17 |
| GA4 MP 제한 테스트 | 1건 (`202604302383065`) 2026-04-30 21:23 KST 전송, 이후 already_in_ga4 dedup | naver/!npayroas.md 행 17 |
| dual-key lookup | Imweb `order_number` + NPay `channel_order_no` 둘 다 BigQuery guard | naver/!npayroas.md 행 126 |

### 1.2 Coffee NPay (A-4 publish 2026-05-02 ~)

| 항목 | 값 | 출처 |
|---|---|---|
| publish 시점 | 2026-05-02 16:00 KST (live version 18) | data/!coffeedata.md sprint 20 |
| dispatcher | v2.1 (workspace 22, tag 85, trigger 84) + snippet installer v1 (workspace 23, tag 87, trigger 86) | data/!coffeedata.md sprint 20 |
| ledger row | id=18 까지, payment_button_type=npay, imweb_order_code 채움 | data/!coffeedata.md sprint 20 |
| funnel-capi v3 timing | NPay click → funnelCapi key 박힘 = +873ms 실측 (sprint 19.6 H-2) | data/!coffeedata.md sprint 19.6 |
| Playwright 자동 검증 | scenario A/B/C 모두 PASS, 12/12 PASS, enforce_deduped=0 (v2 의 50% race 0%) | data/!coffeedata.md sprint 19.3, 19.4 |
| mobile flow 검증 | iPhone 14 emulation, `._btn_mobile_npay` selector PASS | data/!coffeedata.md sprint 19.5 H-1 |
| backend 운영 모드 가드 | COFFEE_NPAY_INTENT_PRODUCTION_MODE + daily_quota=500 | data/!coffeedata.md sprint 19.7 |
| 5일 default monitoring | VM cron 매일 09:00 자동, yaml 출력 | data/!coffeedata.md sprint 21 |
| 9 조기 게이트 (EG-1~9) | capture rate / dedup / payment_button_type null / origin / pii / 5xx / dispatcher fetch fail / pm2 restart / production mode quota | data/!coffeedata.md sprint 21 |
| 첫 manual 실행 verdict | `closure-ready (auto-evaluated)`, EG-3/4/5/6 PASS | data/!coffeedata.md sprint 21 |

### 1.3 두 site 의 핵심 차이 (단일 발명의 변형)

| 항목 | biocom | Coffee |
|---|---|---|
| GTM tag | `[118]` Default Workspace 147 | workspace 22 dispatcher tag 85 + workspace 23 installer tag 87 |
| client-side capture trigger | NPay 버튼 click | NPay 버튼 click + sessionStorage funnelCapi key wait |
| dispatcher 모델 | 30초 dedupe sendBeacon | wait-window 3초 + tick retry 1.5초 |
| 매칭 key | client_id + ga_session_id + product_idx | sessionId + payment_button_type + imweb_order_code |
| 운영 모드 가드 | environment=live/preview | smoke_window OR production_mode + daily_quota |
| 외부 send | GA4 MP 1건 제한 테스트만 | A-6 design only, send 0 |

두 site 의 차이 = 하나의 발명적 framework 의 site-specific 변형. claim 작성 시 abstract method (broader claim) + specific embodiment (narrower claim) 의 2-tier 구조 가능.

## 2. 발명의 핵심 요소 (7가지)

### E-1. funnel-capi v3 sessionId / eid 발급 + sessionStorage propagation

- **무엇**: 사용자 click 시점에 client-side 에서 sessionId (예: `mon50xudmqa3m8`) + eid 발급, sessionStorage 에 저장
- **왜 중요**: 외부 결제 채널 (NPay) 로 redirect 시 GTM dataLayer 손실 → sessionStorage 는 동일 origin 의 다른 페이지 (결제 완료 후 복귀 페이지) 에서 read 가능
- **신규성 추정**: GA4 client_id (cookie) / Meta `_fbp` (cookie) / Adobe Analytics visitor ID (cookie) 와는 다른 sessionStorage 기반. 비표준
- **prior art 후보**: Branch.io 의 fingerprint matching, Adjust 의 device matching, Adobe Audience Manager 의 visitor stitching — 단 이들은 cross-device 영역, 본 발명은 same-device cross-page 영역

### E-2. client-side intent + server-side ledger 분리

- **무엇**: client 가 click 시 intent_uuid 생성 + server-side VM SQLite ledger INSERT, 외부 광고 플랫폼 전환 API 호출 0
- **왜 중요**: 클릭 ≠ 구매 이므로 GA4 purchase / Meta CAPI Purchase 보내면 ROAS 부풀려짐. ledger 만 저장하고, 실 주문 원장 매칭 후 confirmed purchase 만 외부 송신
- **신규성 추정**: 표준 GA4 / Meta CAPI 사용법은 "click → purchase event 즉시 전송" — 본 발명은 click → ledger → 매칭 → confirmed purchase send 의 3-stage 분리
- **prior art**: server-side tagging (GTM Server, Stape) — 단 이들은 transport layer 만 변경, 본 발명은 intent 와 confirmed purchase 의 의미적 분리

### E-3. dispatcher v2.1 wait-window + tick-retry 모델

- **무엇**: NPay 외부 페이지 redirect 전에 funnelCapi key 발급 (873ms 측정) 을 wait-window 3초 + 1.5초 tick retry 로 capture
- **왜 중요**: v2 의 1초 sweep race (50% race condition) 를 0% 로 제거. funnel-capi key 미발급 상태에서 ledger INSERT 시 imweb_order_code=null
- **신규성 추정**: 일반 web 의 retry 모델 (exponential backoff, fetch retry) 과 다름. 외부 결제 SDK 의 비동기 key 발급 timing 에 특화된 wait-window
- **prior art**: 일반 retry library — specific to async key emission timing 은 비표준

### E-4. dual-key matching (order_number + channel_order_no)

- **무엇**: Imweb `order_number` 와 NPay `channel_order_no` 둘 다 BigQuery `already_in_ga4` guard 로 조회
- **왜 중요**: NPay 가 사이트 order_number 와 다른 channel_order_no 를 발급. 한 키만 lookup 하면 dedup 누락
- **신규성 추정**: GA4 enhanced ecommerce 표준은 `transaction_id` 1개. 본 발명은 외부 결제 채널 의 별도 order_no 와 사이트 order_no 의 dual-lookup
- **prior art**: 멀티 ID lookup 자체는 일반적 — 단 결제 채널의 외부 order_no 와 site order_no 의 의미적 페어링 + dedup 보호 조합은 비표준

### E-5. A/B/ambiguous 등급 분류 + 제한 전송

- **무엇**: intent + 실주문 매칭 후 strong match 를 A 등급 (production), B 등급 (test_order 가능), ambiguous (수동 검토) 로 분류. A 등급만 외부 광고 플랫폼 송신
- **왜 중요**: 오매칭이 GA4/Meta/TikTok 입찰 학습에 직접 영향. ambiguous 자동 송신 금지 → 광고 비용 보호
- **신규성 추정**: 일반 attribution rule (last-click / first-click) 와 다름. 매칭 confidence 등급 + ambiguous 자동 차단
- **prior art**: machine learning attribution (e.g., Google's data-driven attribution) — 단 본 발명은 rule-based + auditable, ML 비의존

### E-6. 9 조기 게이트 (EG-1~9) 자동 평가

- **무엇**: capture rate / dedup ratio / payment_button_type null=0 / invalid_origin=0 / pii_rejected=0 / endpoint_5xx=0 / dispatcher_fetch_failed<1% / pm2_restart<5/일 / production_mode_quota_exceeded=0 의 9 게이트를 cron 매일 09:00 자동 yaml 출력
- **왜 중요**: 5일 default monitoring 을 3일 PASS 시 closure 인정. 자동 yaml 의 verdict (`closure-ready` / `needs_review`) 가 다음 sprint trigger
- **신규성 추정**: 일반 monitoring (Datadog / Grafana) 는 fixed alert. 본 발명은 9 게이트의 closure 자동 판정 + 다음 단계 trigger
- **prior art**: SLO 기반 release gate (e.g., Spinnaker canary) — 단 본 발명은 결제 attribution recovery 도메인 특화

### E-7. Lane 기반 자율 권한 + harness fork detection

- **무엇**: agent (Codex / Claude Code) 의 작업을 Green / Yellow / Red Lane 분류 + Harness Preflight Block (yaml) 강제 + 정본 fork detect (markdown static analysis)
- **왜 중요**: AI agent 가 self-blindness 로 정본 fork 작성 시 lesson coffee-lesson-016 같은 재발 위험. 자동 detect + pre-commit gate 로 차단
- **신규성 추정**: AI agent governance / autonomy classification 은 신규 영역 (2024-2026). 단 abstract idea 가능성 높음 → 특허 < trade secret + 논문 적합
- **prior art**: AutoGPT / Devin 의 agent autonomy — 단 lane-based multi-tier 자율도 + fork detect 조합은 비표준

## 3. 특허 출원 가능성 검토 (한국 / 미국 / 유럽)

### 3.1 한국 (KIPO)

| 평가 항목 | 결과 | 근거 |
|---|---|---|
| 산업상 이용가능성 | ✅ HIGH | e-커머스 ROAS, GTM/CAPI 사용 사이트 모두 적용 |
| 신규성 | ✅ MID-HIGH | NPay 같은 비표준 외부 결제 채널의 sessionId 매칭 + dual-key matching 조합은 공지 기술 추정 외 |
| 진보성 | ✅ MID | 기존 server-side tagging / advanced matching 의 한계 (NPay 외부 결제 시 dataLayer 손실) 를 client-side intent + server-side ledger + dispatcher wait-window 로 회복 = 통상의 기술자 자명 X (추정) |
| 발명의 단일성 | ⚠ NEEDS WORK | 7 요소가 한 청구항으로 묶이려면 abstract method + specific embodiment 의 2-tier claim 구조 필요 |
| 명세서 작성 가능성 | ✅ HIGH | data/!coffeedata.md (1010줄) + naver/!npay.md (762줄) + naver/!npayroas.md (937줄) + harness/coffee-data/* 의 evidence 가 풍부 |
| **등록 가능성 추정** | **60-75%** | software 특허 한국에서 가능, prior art 정밀 search 후 final 판단 |

### 3.2 미국 (USPTO)

| 평가 항목 | 결과 | 근거 |
|---|---|---|
| utility (35 USC §101) | ⚠ MID | Alice/Mayo (abstract idea) 시험 risk. 단순 "수집-매칭-전송" 추상화 시 거부 가능 |
| novelty (§102) | ✅ MID-HIGH | 한국과 동일 |
| non-obviousness (§103) | ✅ MID | dispatcher v2.1 의 specific timing model + dual-key matching 조합 |
| claim 작성 권장 | specific computer architecture 명시 (server-side SQLite ledger, client-side sessionStorage propagation, async dispatcher with wait-window timing) — abstract idea 회피 |
| **등록 가능성 추정** | **40-60%** | Alice 시험 통과 위해 specific embodiment 강조 + technical effect (real-time conversion recovery in distributed payment system) 명시 |

### 3.3 유럽 (EPO)

| 평가 항목 | 결과 | 근거 |
|---|---|---|
| Article 52 (software per se 제외) | ⚠ LOW-MID | software 자체 제외 — technical effect 명시 시 가능 |
| Inventive step | MID | 한국/미국과 유사 |
| **등록 가능성 추정** | **30-50%** | EPO 의 software 특허 hurdle 가장 높음. 한국/미국 우선 출원 권장 |

### 3.4 prior art 정밀 search 권장 영역

본 Claude Code 가 미조사 — 변리사 자문 시 다음 영역을 조사 권장:

1. Google Patents 의 "client_id session attribution payment recovery" / "external payment redirect attribution"
2. Branch.io / Adjust / AppsFlyer 의 mobile attribution SDK 특허
3. Adobe Visitor Stitching, Tealium IQ Customer Data Hub 특허
4. Meta CAPI advanced matching, GA4 enhanced measurement 특허
5. Stape / GTM Server-side tagging 관련 특허
6. 한국 nepay 자체의 결제 attribution API 특허 (네이버 보유)
7. 한국 imweb 자체의 주문 매칭 특허

## 4. 청구 범위 초안 (claim outline — 변리사 정제 전 draft)

### Claim 1 (independent method claim) — 한국/미국 공통

외부 결제 채널을 통한 구매의 attribution recovery 를 위한 컴퓨터 구현 방법으로서:

(a) 사이트의 결제 시도 click 시점에 client-side 에서 funnel-session-identifier 와 event-identifier 를 발급하여 동일 origin 의 sessionStorage 에 저장하는 단계;

(b) 상기 click 후 외부 결제 채널 페이지로 redirect 하기 전, intent record 를 server-side ledger 에 저장하되 외부 광고 플랫폼으로의 conversion API 호출 없이 저장하는 단계 — 상기 intent record 는 적어도 funnel-session-identifier, product-identifier, payment-button-type 을 포함;

(c) 상기 ledger 의 intent record 와 site 의 order ledger 를 매칭하되, 사이트 order-number 및 외부 결제 채널 channel-order-number 의 dual-key 를 사용하여 already-sent guard 를 적용하는 단계;

(d) 상기 매칭 결과를 strong-match-A, strong-match-B, ambiguous 의 등급으로 분류하는 단계;

(e) 상기 strong-match-A 등급 record 만 외부 광고 플랫폼의 conversion API 로 전송하는 단계 — 단, 상기 dual-key already-sent guard 가 negative 인 경우에 한정.

### Claim 2 (dependent — wait-window dispatcher)

청구항 1에 있어서, 단계 (a) 이전에 funnel-capi key 의 비동기 발급을 capture 하기 위해 wait-window 와 tick-retry 가 결합된 dispatcher 를 client-side 에 install 하고, 상기 wait-window 의 길이는 외부 결제 SDK 의 key 발급 timing 의 95-percentile 보다 크게 설정하는 단계를 더 포함하는 방법.

### Claim 3 (dependent — gate auto-evaluation)

청구항 1에 있어서, 단계 (b) 의 ledger 에 대해 매일 정해진 시각에 capture-rate, dedup-ratio, payment-button-type-null-count, invalid-origin-count, pii-rejected-count, endpoint-5xx-count, dispatcher-fetch-failed-ratio, supervisor-restart-count, production-mode-quota-exceeded-count 의 9 항목을 자동 평가하여 closure-ready 또는 needs-review verdict 를 yaml 출력하는 단계를 더 포함하는 방법.

### Claim 4 (apparatus — system claim)

client-side wrapper module, server-side ledger module, scheduling dispatcher module, cron-based monitoring module 을 포함하는 distributed payment attribution recovery system — 청구항 1-3 의 방법을 수행하도록 구성됨.

### Claim 5 (computer-readable medium)

청구항 1-3 중 어느 하나의 방법을 컴퓨터에 실행시키기 위한 프로그램이 기록된 컴퓨터 판독 가능한 기록 매체.

## 5. 등록 후 방어 가능성 (등록 자체와 별개)

### 5.1 회피 설계 (design-around) 의 어려움

| 회피 시도 | 가능성 | 보호 강도 |
|---|---|---|
| sessionId 대신 cookie 사용 | 가능 (단 GTM dataLayer 의존 회복 — 본 발명 회피하나 NPay 시나리오에서 비효과) | LOW (회피 가능) |
| ledger 대신 즉시 send | 가능 (단 ROAS 부풀림 위험) | LOW |
| dispatcher wait-window 대신 polling | 가능 (단 race 50% 발생) | MID (회피 시 성능 열화) |
| dual-key 대신 single-key | 가능 (단 dedup 누락) | LOW |

회피 가능성 종합: claim 1 의 (a)+(b)+(c)+(d)+(e) 5단계가 모두 결합돼야 발명 가치 발현. 일부 회피 가능하나 효과 열화 → 본 발명 가치 핵심.

### 5.2 침해 입증의 어려움

| 침해 evidence | 입증 가능 |
|---|---|
| client-side wrapper 코드 (압축/난독화) | 어려움 — 단 sessionStorage key 명 (`__seo_funnel_session`) 같은 고유 패턴 식별 가능 |
| server-side ledger schema | 매우 어려움 — 외부 노출 0 |
| dispatcher wait-window timing | 어려움 — JS 분석 필요 |
| 9 게이트 auto-eval | 매우 어려움 — 내부 cron |

침해 입증 종합: claim 1 의 (a) (sessionStorage key 명 / wrapper 패턴) 만 외부 식별 가능. (b)-(e) 는 사이트 운영자 협조 없이 입증 어려움.

### 5.3 권리 활용 시나리오

| 시나리오 | 가능성 | 가치 |
|---|---|---|
| 직접 라이센스 (e-커머스 plugin 업체) | MID | 한국 imweb / cafe24 / 네이버 등 |
| 방어 (경쟁사 출원 차단) | HIGH | 본 분야 prior art 등록만으로 경쟁 출원 risk 감소 |
| 매각 / 인수 자산 | MID | software M&A 시 patent portfolio 가치 |
| 침해 소송 | LOW | 침해 입증 어려움 (5.2) |

## 6. TJ 결정 권장 + 추천 점수

| 옵션 | 추천 점수 | 비용 | 가치 |
|---|---|---|---|
| **A. 변리사 자문 진입** (prior art 정밀 search + claim 정제 + 출원 결정) | **70%** | 자문료 200-500만원 + 출원 시 추가 500-1500만원 (한국/미국 별도) | 등록 시 방어 자산. 등록 안 돼도 prior art search 자체로 risk 평가 |
| B. 보류 + trade secret | 25% | 0원 | 본 노하우 사내 보존, 단 경쟁사 출원 시 freedom-to-operate 위험 |
| C. 논문 / open-source 공개 | 5% | 0원 | 영향력 있으나 본 솔루션의 상업적 가치 0 |

본 Claude Code 추천: **A 진입 (70%)**. 본 솔루션의 7 요소 중 E-1, E-2, E-3, E-4, E-5 는 결제 attribution 도메인 특화 — patent 가치 높음. E-6, E-7 은 software dev methodology — patent 가치 낮음 (논문/open-source 적합).

자문 시 변리사에게 전달할 자료 (이미 본 repo 안):
- data/!coffeedata.md (1010줄) — Coffee NPay sprint 19~22 evidence 전체
- naver/!npay.md (762줄) — biocom NPay intent capture evidence
- naver/!npayroas.md (937줄) — biocom NPay match dry-run evidence
- coffee/!imwebcoffee_code_latest_0501.md — funnel-capi v3 본체 코드
- harness/coffee-data/preview-playwright/a3v21_*.mjs — Playwright 자동 검증 코드
- backend/src/coffeeNpayIntentLog.ts — server-side ledger 본체 (read-only 첨부)
- coffee-a4-publish-decision-and-dispatcher-v21-20260502.md — 9 조기 게이트 정의

## 7. 자기 면책 + 다음 액션

### 자기 면책 (본 검토의 한계)

- 본 Claude Code 는 변리사 아님. 등록 가능성 % 추정은 본 Claude Code 의 evidence 기반 추정. 정확도 ± 25%.
- prior art 정밀 search 미수행. Google Patents / KIPRIS / USPTO Patent Public Search 직접 query 필요.
- 진보성 판단의 "통상의 기술자 자명성" 평가는 변리사/심사관 영역.
- Alice/Mayo 시험 통과 가능성은 미국 software 특허 case law 의 update 빠름 — 2026 시점 case law 기준 변리사 자문 필수.

### 다음 액션

1. **TJ 결정**: 변리사 자문 진입 / 보류 / 공개 중 선택 (본 답변 결정 권장 = 자문 진입)
2. **변리사 자문 진입 시**:
   - 한국 변리사 1명 + 미국 변리사 1명 (또는 한미 동시 출원 가능 사무소 1곳) 선택
   - 위 7번의 자료 일괄 전달
   - 자문 1차 결과 (prior art search + claim 적합성) 후 출원 / 보류 결정
3. **보류 시**:
   - 본 patent/!patent.md 를 시점 lock (date stamp + git commit hash) — 향후 trade secret 입증 자료
   - 6개월 후 재평가 (경쟁사 출원 동향)

자세한 출원 절차 / 비용 / 일정: 변리사 자문 후 본 문서 §4 청구 범위 초안 정제 + 명세서 작성.

## 8. GPT Deep Research 프롬프트

본 섹션은 변리사 자문 진입 전 1차 prior art search + 등록 가능성 정밀 평가를 위해 ChatGPT Deep Research (또는 동등 도구 — Perplexity Pro / Claude with Web Search) 에 입력할 prompt. 한국어 (KIPO 측) + 영어 (USPTO/EPO 측) 2종.

사용 방법:
1. 본 prompt 를 그대로 ChatGPT Deep Research / Perplexity Pro 에 paste.
2. 결과 (15-30분 소요 추정) 를 받아 본 문서 §3 등록 가능성 추정 섹션과 cross-check.
3. prior art 가 critical 하게 발견되면 본 문서 §4 청구 범위 초안 회의 후 변리사 자문 진입.
4. 본 prompt 는 read-only — Deep Research 가 외부 send / 운영 데이터 변경 0.

### 8.1 한국어 prompt (KIPO + 한국 변리사 자문 자료)

```
당신은 한국 특허 변리사이자 prior art search 전문가다. 본 발명에 대한 prior art search 와 한국 KIPO 등록 가능성 평가를 정밀하게 수행해라.

[발명의 본질 — 한 줄]

외부 결제 채널 (네이버페이 / 카카오페이 / 토스 등) 의 click intent 와 confirmed purchase 를 분리하여 attribution recovery 하는 컴퓨터 구현 방법.

[발명의 7 핵심 요소]

E-1. 사용자 click 시점 client-side 에서 funnel-session-identifier + event-identifier 발급, 동일 origin 의 sessionStorage 저장
E-2. client-side intent + server-side ledger 분리 (외부 광고 플랫폼 conversion API 즉시 호출 0)
E-3. dispatcher 의 wait-window (3초) + tick-retry (1.5초) — 외부 결제 SDK 의 비동기 key 발급 timing capture
E-4. dual-key matching — 사이트 order_number + 외부 채널 channel_order_no 둘 다 BigQuery already-sent guard 로 조회
E-5. 매칭 결과를 strong-match-A / strong-match-B / ambiguous 로 등급화, A 등급만 외부 광고 플랫폼 송신
E-6. 9 조기 게이트 (capture rate / dedup / payment_button_type null / origin / pii / 5xx / dispatcher fetch fail / supervisor restart / production_mode quota) cron 매일 자동 yaml 평가
E-7. AI agent 의 Lane 기반 자율 권한 (Green / Yellow / Red) + Harness Preflight Block (yaml) + 정본 fork detection (markdown static analysis)

[운영 환경 evidence]

- 더클린커피 (thecleancoffee.com) 의 NPay 외부 결제 attribution recovery 운영 중 — A-4 publish 2026-05-02, ledger 16 row, dispatcher v2.1 + snippet installer v1 LIVE, Playwright 자동 검증 12/12 PASS, funnel-capi key timing 873ms 실측
- 바이오컴 (biocom) 의 NPay intent capture 운영 중 — live publish 2026-04-27, intent 304건, 핵심 필드 (client_id / ga_session_id / product_idx) 채움률 100%, GA4 MP 제한 테스트 1건

[조사 영역]

1. **KIPRIS** (kipris.or.kr) 정밀 검색
   - 키워드 조합: "결제 attribution recovery", "외부 결제 세션 매칭", "네이버페이 추적", "intent ledger 결제", "client_id session 매칭 결제 회복", "GTM 서버사이드 결제", "전환 신호 회복 외부 결제"
   - IPC: G06Q 30/02 (광고), G06Q 20/40 (결제), H04L 67/146 (session 관리)
   - 네이버 (Naver Corp) / 카카오 (Kakao Corp) / 비바리퍼블리카 (Toss) 보유 결제 attribution 특허 전수 list
   - 한국 imweb / cafe24 / 가비아 / NHN 의 attribution / GTM 관련 특허

2. **Google Patents** 정밀 검색 (한국/일본/중국/미국)
   - "external payment attribution recovery"
   - "session storage payment redirect"
   - "client side intent server side ledger"
   - "dual key payment dedup"
   - "wait window tick retry async key"
   - "payment funnel session id"

3. **USPTO Patent Public Search** + **EPO Espacenet** + **Lens.org**
   - CPC: G06Q 30/02, G06Q 20/40, G06F 16/2455, H04L 67/146

4. **비특허 문헌** (논문 / 블로그 / open-source)
   - Branch.io / Adjust / AppsFlyer 의 mobile attribution SDK 기술 문서
   - Adobe Visitor Stitching, Tealium IQ Customer Data Hub 백서
   - GTM Server-side tagging (Stape / Google) 공개 문서
   - Meta CAPI advanced matching, GA4 enhanced measurement 공개 문서
   - server-side e-commerce attribution 학술 논문 (ACM / IEEE)

5. **한국 결제 채널 자체 특허**
   - 네이버페이 자체의 결제 attribution / 외부 가맹점 conversion API 특허
   - 카카오페이 / 토스페이먼츠 / 페이코 동등 검색

[출력 요구사항]

각 발견 사항은 인용 link (URL) 정확하게 첨부. fabrication 금지.

다음 표 형식으로:

## 1. 발견된 prior art 표

| 번호 | 출처 | 특허번호/논문 | 발명의 명칭 | 출원인/저자 | 출원일/발행일 | 본 발명 7요소 중 어느 것과 겹치는가 | 차별성 |
|---|---|---|---|---|---|---|---|

## 2. 신규성 (한국 특허법 §29 ①) 평가

- 7 요소 각각의 신규성 평가 (HIGH / MID / LOW + 근거)
- 한국 출원 기준 (발명일 기준 6개월 제외기간 vs 출원일)

## 3. 진보성 (한국 특허법 §29 ②) 평가

- 통상의 기술자 자명성 평가
- 7 요소의 결합이 자명한가 vs 비자명한가
- 결합 사유 (motivation to combine) 평가

## 4. 등록 가능성 % 갱신

- 한국 KIPO: __% (근거 명시)
- 미국 USPTO: __% (Alice/Mayo 시험 적용 평가)
- 유럽 EPO: __% (Article 52 software per se 시험)

## 5. claim 1 정제 권장

본 문서 §4 의 claim 1 초안 (5단계 method) 에 대해:
- 어느 element 가 too broad → narrowing 권장
- 어느 element 가 too narrow → broadening 권장
- prior art 회피 위해 추가 limiting feature 제안

## 6. 회피 설계 (design-around) 가능성

- 본 발명 회피 가능 여부 (HIGH / MID / LOW)
- 회피 시 본 발명의 효과 손실 평가

## 7. 출원 전략 권장

- 한국 우선 출원 vs 미국 우선 출원 vs PCT 직출원 비교
- 한국 변리사 / 미국 변리사 자문료 + 출원 비용 최신 추정 (2026 기준)
- 출원 후 등록 결정까지 평균 소요 시간 (한국 / 미국 / 유럽)

## 8. 종합 결론

- 출원 진입 권장 / 보류 / 공개 중 추천
- 추천 점수 % (이유 명시)
- 본 발명의 가장 강한 청구 element (출원 시 priority claim 권장)
- 본 발명의 가장 약한 element (출원 시 dependent claim 으로 보호 또는 제외)

[제약]

- 결과는 한국어 + 인용 link.
- prior art 인용 시 정확한 특허번호 + URL.
- fabrication / hallucination 절대 금지. 모르면 "조사 한계 — 변리사 정밀 search 필요" 명시.
- 본 발명의 가치 평가는 보수적으로 (등록 가능성 < 추정치 +5%, > 추정치 -10% 정도 범위).
```

### 8.2 영어 prompt (USPTO + EPO + 미국 변리사 자문 자료)

```
You are a U.S. patent attorney and prior art research specialist. Conduct precise prior art search and USPTO/EPO patentability assessment for the invention below.

[Essence of the invention — one sentence]

A computer-implemented method for attribution recovery of purchases through external payment channels (e.g., NaverPay, KakaoPay, Toss) by separating click-time intent capture from confirmed-purchase signaling.

[7 core elements]

E-1. At click time, client-side issues a funnel-session-identifier and event-identifier, persisted in same-origin sessionStorage.
E-2. Client-side intent + server-side ledger separation (no immediate conversion API call to external advertising platforms).
E-3. Dispatcher with wait-window (3s) + tick-retry (1.5s) to capture asynchronous key emission timing of external payment SDK.
E-4. Dual-key matching — site order_number + external channel channel_order_no, both queried against BigQuery already-sent guard.
E-5. Match grading into strong-match-A / strong-match-B / ambiguous; only A-grade transmitted to external advertising platform conversion APIs.
E-6. Nine early gates (capture rate / dedup / payment_button_type null / origin / pii / 5xx / dispatcher fetch fail / supervisor restart / production_mode quota) auto-evaluated daily via cron with yaml output.
E-7. AI agent governance — Lane-based autonomy classification (Green / Yellow / Red) + Harness Preflight Block (yaml) + canonical-fork detection (markdown static analysis).

[Operational evidence]

- "thecleancoffee.com" running NPay attribution recovery in production — A-4 publish 2026-05-02, ledger 16 rows, dispatcher v2.1 + snippet installer v1 LIVE, Playwright automated verification 12/12 PASS, funnel-capi key timing 873ms measured.
- "biocom" running NPay intent capture in production — live publish 2026-04-27, intent count 304, core field (client_id / ga_session_id / product_idx) fill rate 100%, GA4 MP limited test 1 transmission.

[Search domains]

1. **USPTO Patent Public Search** (ppubs.uspto.gov)
   - Keywords: "external payment attribution recovery", "session storage payment redirect", "client side intent server ledger", "dual key payment dedup", "asynchronous key emission timing", "payment funnel session"
   - CPC: G06Q 30/02, G06Q 20/40, H04L 67/146, G06F 16/2455

2. **Google Patents** (US, EP, JP, CN, KR — broad)

3. **EPO Espacenet** + **WIPO PATENTSCOPE** + **Lens.org**

4. **Non-patent literature**
   - Branch.io / Adjust / AppsFlyer mobile attribution SDK technical documentation
   - Adobe Visitor Stitching, Tealium IQ Customer Data Hub whitepapers
   - GTM Server-side tagging (Stape / Google) public documentation
   - Meta CAPI advanced matching, GA4 enhanced measurement public documentation
   - Academic literature on server-side e-commerce attribution (ACM / IEEE Xplore)

5. **External payment channel patents** (Korean payment providers — Naver, Kakao, Toss)
   - Search EN equivalents in PATENTSCOPE / Lens

[Output format]

Cite all sources with exact URLs. No fabrication.

## 1. Prior art table

| # | Source | Patent/Paper # | Title | Applicant/Author | Filed/Published | Overlap with E-1..E-7 | Distinguishing feature |
|---|---|---|---|---|---|---|---|

## 2. Novelty (35 USC §102) assessment

- For each of E-1..E-7: HIGH / MID / LOW novelty + reasoning
- Cited prior art if applicable

## 3. Non-obviousness (35 USC §103) assessment

- POSITA (person of ordinary skill in the art) analysis
- Whether combination of E-1..E-7 is obvious or non-obvious
- Motivation-to-combine analysis under KSR International v. Teleflex

## 4. Subject matter eligibility (35 USC §101) — Alice/Mayo two-step test

- Step 1: Is the claim directed to an abstract idea?
- Step 2: Does the claim contain an inventive concept that transforms the abstract idea into patent-eligible subject matter?
- Recommended claim drafting strategies for §101 compliance (specific computer architecture, technical effect emphasis)

## 5. EPO Article 52 software-per-se assessment

- Is the invention purely software? If so, what technical effect can be argued?
- Recommended claim language for EPO

## 6. Updated registration probability

- USPTO: __% (with reasoning)
- EPO: __% (Article 52 hurdle)
- KIPO: __% (cross-reference Korean prompt result)

## 7. Claim 1 refinement recommendations

For the draft claim 1 (5-step method) in §4 of the source document:
- Which element is too broad → narrowing recommendation
- Which element is too narrow → broadening recommendation
- Recommended additional limiting features for prior art avoidance

## 8. Design-around feasibility

- Likelihood that competitor can design around (HIGH / MID / LOW)
- Loss of effect when designing around

## 9. Filing strategy recommendation

- Korea-first vs US-first vs PCT direct comparison
- Korea attorney + US attorney fee + filing cost estimate (2026 baseline)
- Average pendency (Korea / US / EPO)

## 10. Final recommendation

- File / Hold / Publish recommendation
- Recommendation score % (with reasoning)
- Strongest claim element (priority claim recommendation)
- Weakest element (dependent claim or omission recommendation)

[Constraints]

- Output in English with citation URLs.
- For each prior art citation, exact patent number + URL.
- No fabrication / hallucination. If information unavailable, state "research limit — patent attorney precision search required".
- Be conservative in registration probability (within +5% / -10% of source document estimate).
```

### 8.3 Deep Research 결과 처리 routine

| 단계 | 누가 | 무엇 |
|---|---|---|
| 1. Deep Research 실행 | TJ | 위 8.1 + 8.2 prompt 각각 ChatGPT Deep Research / Perplexity Pro 에 paste |
| 2. 결과 받기 | TJ | 약 15-30분 소요. 한국어 + 영어 결과 별도 |
| 3. cross-check | Claude Code | 결과를 본 patent/!patent.md §3 (등록 가능성) 와 cross-check, 본 문서 §3 갱신 |
| 4. critical prior art 판정 | TJ + Claude Code | 발견된 prior art 가 본 발명의 신규성/진보성을 결정적으로 부정하는지 판단 |
| 5. 변리사 자문 진입 결정 | TJ | 자문 진입 / 보류 / 공개 결정. Deep Research 결과 + 본 문서 §6 추천 점수 종합 |
| 6. 자문 자료 일괄 전달 | TJ | 변리사에게 본 patent/!patent.md + Deep Research 결과 (한국어 + 영어) + §7 의 자료 list 전달 |

