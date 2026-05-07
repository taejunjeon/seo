# Google Ads ROAS 정합성 정본 (실제 개발 순서)

작성 시각: 2026-05-07 23:35 KST
최종 업데이트: 2026-05-07 23:35 KST
기준일: 2026-05-07
상태: active canonical
Owner: gdn / google_ads_roas
Supersedes: [[!gdnplan_old]]
Next document: 24h canary 결과 보고 또는 minimal_ledger 정식 운영화 승인안
Do not use for: GA4/Meta/Google Ads/TikTok/Naver 실제 전송, conversion upload, conversion action 생성/변경, GTM Production publish, Google tag gateway 활성화, 광고 예산/캠페인 변경

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/gdn/README.md
    - harness/gdn/RULES.md
    - harness/gdn/VERIFY.md
    - total/!total-current.md
    - data/!bigquery.md
    - vm/!vm.md
  lane: Green canonical doc 정렬 (read-only)
  allowed_actions:
    - 정본 재정렬
    - 실제 개발 순서 명시
    - Phase-Sprint 요약과 다음 할일 표 분리
    - completed 항목 Active Board 제거 + Completed Ledger 이동
  forbidden_actions:
    - 운영 DB write
    - 외부 플랫폼 전송
    - Google Ads conversion action 변경
    - GTM publish
    - 광고 예산/캠페인 변경
  source_window_freshness_confidence:
    source: "total/!total-current.md + canary phase result + BigQuery 권한 회신 + 운영 VM SSH evidence"
    window: "2026-05-07 KST canary 진행 중"
    freshness: "T+22min canary monitoring 직후"
    confidence: 0.9
```

## 10초 결론

이 문서는 Google Ads ROAS 정합성 작업의 실제 실행 순서를 정한다.

이전 [[!gdnplan_old]]는 "Google Ads ROAS 정합성 체크 및 개선 계획" 단일 로드맵이었으나, 본 sprint에서 분리됐다. 현재 P0는 **minimal `paid_click_intent` ledger write canary 진행 + Google ROAS gap 추적**이다.

지금 시점 핵심:

- canary 1h 진행 중. T+22min에 운영 ledger row 17건 자연 traffic 저장 확인. PM2 0회 추가 restart, paid-click-intent 5xx 0건.
- Google click id 보존 문제는 즉시 해결됨 (이전 ledger 0건 → 22분 17건). 이는 confirmed_purchase no-send 후보 prep의 missing_google_click_id 카운트 감소 가능성을 만든다.
- 24h 결과 후 minimal_ledger_canary 종료 또는 정식 운영화 승인 판단. 그 다음 confirmed_purchase no-send prep 재실행 → Google Ads BI confirmed_purchase 실행안 → `구매완료` Primary 변경 검토 순.
- Google Ads conversion upload, Primary 변경, Google tag gateway 활성화는 모두 future Red 승인 영역으로 유지.

## Phase-Sprint 요약표

실제 실행 우선순위순.

| Priority | Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|---|
| P0 | Phase4 | [[#Phase4-Sprint6]] | paid_click_intent canary write | TJ + Codex | 95% / 75% | [[#Phase4-Sprint6\|이동]] |
| P0 | Phase4 | [[#Phase4-Sprint7]] | Google ROAS gap 추적 (click id 보존 후) | Codex | 30% / 0% | [[#Phase4-Sprint7\|이동]] |
| P1 | Phase4 | [[#Phase4-Sprint8]] | confirmed_purchase no-send 재실행 | Codex | 60% / 0% | [[#Phase4-Sprint8\|이동]] |
| P1 | Phase3 | [[#Phase3-Sprint5]] | Google Ads BI confirmed_purchase 실행안 | TJ + Codex | 50% / 0% | [[#Phase3-Sprint5\|이동]] |
| P2 | Phase3 | [[#Phase3-Sprint6]] | Google Ads `구매완료` Primary 변경 | TJ + Codex | 40% / 0% | [[#Phase3-Sprint6\|이동]] |
| P2 | Phase5 | [[#Phase5-Sprint1]] | Google tag gateway 활성화 결정 | TJ + Codex | 30% / 0% | [[#Phase5-Sprint1\|이동]] |
| P2 | Phase6 | [[#Phase6-Sprint1]] | Channel funnel quality 분석 (Meta vs Google vs Organic) | Codex | 10% / 0% | [[#Phase6-Sprint1\|이동]] |
| P3 | Phase7 | [[#Phase7-Sprint1]] | Meta funnel CAPI readiness | Codex | 20% / 0% | [[#Phase7-Sprint1\|이동]] |

## 다음 할일

| 순서 | Phase/Sprint | 상태 | 담당 | 할 일 | 왜 하는가 | 어떻게 하는가 | 의존성 | 상세 | 컨펌 필요 |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | [[#Phase4-Sprint6]] | time_waiting | Codex | canary T+30/45/60min monitoring 실행 | 1h canary PASS 여부 판정 | `pm2 list` + sqlite read + cloudflared error log + smoke 5종 | 시간 도달 (각 23:33/23:48/24:03 KST) | [[paid-click-intent-minimal-ledger-canary-phase0-1-2-result-20260507]] | NO |
| 2 | [[#Phase4-Sprint6]] | time_waiting | Codex | canary 1h PASS 시 24h 제한 write 자동 연장 | 자연 traffic 24h 누적 후 정합성 판정 | flag true 유지 + 6h/12h/24h 측정 | 1번 PASS | 동일 result 문서 §10 부록 | NO |
| 3 | [[#Phase4-Sprint6]] | approval_waiting | TJ + Codex | minimal ledger 정식 운영화 승인 결정 | canary 24h 후 정식 운영 또는 종료 결정 | 24h 결과 + memory 추세 + dedupe ratio + traffic volume 검토 | 2번 PASS | [[paid-click-intent-minimal-ledger-write-approval-20260507]] | YES |
| 4 | [[#Phase4-Sprint7]] | auto_ready | Codex | Google ROAS gap 추적 (canary 후 click id fill rate 변화) | Google Ads 8.72x vs internal 0.28x gap이 click id 보존으로 좁혀졌는지 확인 | BigQuery + 운영 VM ledger same-window 조회 + ConfirmedPurchasePrep 재실행 | canary 1h+ PASS | [[google-roas-gap-decomposition-20260507]] (작성 예정) | NO |
| 5 | [[#Phase4-Sprint8]] | time_waiting | Codex | ConfirmedPurchasePrep 재실행 (24h 후) | missing_google_click_id 카운트 감소 측정 | `npm --prefix backend run agent:confirmed-purchase-prep` | canary 24h PASS | [[google-ads-confirmed-purchase-candidate-prep-20260507]] 갱신 | NO |
| 6 | [[#Phase3-Sprint5]] | parked_red | TJ + Codex | Google Ads BI confirmed_purchase 실행안 재검토 | NPay click/count Primary 오염을 실제 결제완료로 교체 | no-send 후보, click id 보존률, rollback 기준 PASS 시 [[google-ads-confirmed-purchase-execution-approval-20260505]] update | 5번 PASS | 동일 승인안 | YES |
| 7 | [[#Phase3-Sprint6]] | parked_red | TJ + Codex | Google Ads `구매완료` Primary 변경 | NPay label `r0vuCKvy-...`가 사실상 100% 분자 — Secondary로 강등 | 신규 confirmed_purchase 7일 병행 관측 후 [[google-ads-purchase-primary-change-approval-20260505]] update | 6번 진행 후 | 동일 승인안 | YES |
| 8 | [[#Phase5-Sprint1]] | blocked_data | TJ | Imweb 측 Google tag gateway native 지원 문의 | Cloudflare 도입 우회 가능성 확인 | 외부 업체 문의 (1회 paste) | TJ 외부 문의 | [[../GA4/google-tag-gateway-poc-approval-20260507]] | NO |
| 9 | [[#Phase6-Sprint1]] | auto_ready | Codex | Channel funnel quality BigQuery raw 비교 (Meta vs Google vs Organic) | Google ROAS gap이 광고 품질인지 추적 누락인지 분리 | BigQuery jobs.query (project-dadba7dd 경유) + GA4 ecommerce events raw 7/14/30일 분석 | BigQuery jobs.create 권한 (이미 보유) | [[channel-funnel-quality-meta-google-organic-20260507]] (작성 예정) | NO |
| 10 | [[#Phase7-Sprint1]] | auto_ready | Codex | Meta funnel CAPI readiness 조사 | ViewContent/AddToCart/InitiateCheckout/AddPaymentInfo Test Events 가능성 | 코드 read + Test Events smoke 계획 | 독립 | [[../capivm/meta-funnel-capi-readiness-20260507]] (작성 예정) | NO |

## 현재 기준

| 항목 | 현재값 |
|---|---|
| 정본 문서 | [[!gdnplan_new]] (이 파일) |
| 기존 문서 역할 | [[!gdnplan_old]]는 v1.9 legacy 로드맵, 참고용 |
| 현재 P0 | paid_click_intent canary 1h 진행 중 |
| canary deploy 시각 | 2026-05-07 23:01 KST (Phase 2 flag ON) |
| canary 1h 종료 예정 | 2026-05-08 00:01 KST |
| canary 24h 종료 예정 | 2026-05-08 23:01 KST |
| 운영 ledger row count (T+22min) | 17 unique, 1 dedupe |
| ledger by capture_stage | landing 12, npay_intent 3, checkout_start 2 |
| ledger by click_id_type | gclid 17 |
| paid-click-intent 5xx 비율 (deploy 후 24분) | 0% (cloudflared 4건은 다른 route) |
| backend mem | 221.5 MB / 1500 MB threshold (14.7%) |
| PM2 restart since deploy | 0 추가 (Phase 0/1/2 setup 외) |
| Google Ads API last_30d ROAS (2026-05-07 18:12) | 8.72x |
| 내부 confirmed ROAS (운영 VM ledger same-window) | 0.28x |
| Gap | 8.44p (canary 후 변화 추적 시작) |
| Approval Queue | open 0, future_red 5 (현재) |

## 실제 개발 순서

Phase 번호는 작업 영역 history. 실제 실행은 아래 순서로.

1. **P0: paid_click_intent canary 진행 중 (T+22min)**
   - 목적: Google click id가 운영 ledger에 안전하게 저장되는지 확인. confirmed_purchase no-send 후보 품질의 선결조건.
   - 현재: 운영 ledger 17건 자연 traffic 저장. PM2 0 restart 추가. paid-click-intent 5xx 0건.

2. **P0: Google ROAS gap 추적 (click id 보존 직후)**
   - 목적: canary 후 missing_google_click_id 카운트가 감소하는지 측정.
   - 현재: ConfirmedPurchasePrep 직전 결과는 missing_click_id 618/623. canary 24h 후 재실행 예정.
   - 입력: 운영 VM ledger same-window + Google Ads API last_30d + BigQuery raw (권한 보유).

3. **P1: ConfirmedPurchasePrep 재실행 (canary 24h 후)**
   - 목적: Google Ads upload 가능 후보 (homepage 결제완료 + NPay 실제 결제완료)의 click id 보유 비율을 갱신.

4. **P1: Google Ads BI confirmed_purchase 실행안 재검토**
   - 목적: 새 confirmed purchase 전환 신호를 Google Ads에 알린다.
   - 조건: 3번 결과로 click id 보유 비율이 충분, no-send 후보 품질 PASS.

5. **P2: Google Ads `구매완료` Primary 변경**
   - 목적: NPay label `r0vuCKvy-...`를 Secondary로 강등.
   - 조건: 4번 신규 신호가 7일 병행 관측 후.

6. **P2: Google tag gateway 활성화 결정**
   - 목적: Google 측정 신호 회복 (first-party measurement path).
   - 조건: Imweb native 지원 회신 또는 Cloudflare 도입 결정.

7. **P2: Channel funnel quality BigQuery 분석**
   - 목적: Google 유입의 결제 단계 누락이 추적 누락인지 광고 품질인지 분리.
   - 조건: BigQuery jobs.query 권한 (이미 보유, project-dadba7dd 경유).

8. **P3: Meta funnel CAPI readiness**
   - 목적: 구매 전 퍼널 신호 (ViewContent/AddToCart/InitiateCheckout/AddPaymentInfo) Test Events 가능성.
   - 조건: 본 sprint와 독립, 별 트랙으로 진행.

## Active Action Board

지금 움직여야 하는 것만.

| Priority | Status | Phase/Sprint | 작업 | 왜 하는가 | 다음 액션 | 담당 | 컨펌 | Source |
|---|---|---|---|---|---|---|---|---|
| P0 | time_waiting | Phase4-Sprint6 | canary T+30/45/60min monitoring | 1h PASS 판정 | 시각 도달 시 본 agent 자동 측정 | Codex | NO | [[paid-click-intent-minimal-ledger-canary-phase0-1-2-result-20260507]] |
| P0 | approval_waiting | Phase4-Sprint6 | minimal ledger 정식 운영화 승인 | 24h 종료 후 결정 | 24h 결과 보고 후 TJ 결정 | TJ + Codex | YES | [[paid-click-intent-minimal-ledger-write-approval-20260507]] |
| P0 | auto_ready | Phase4-Sprint7 | Google ROAS gap 추적 | click id 보존 후 gap 변화 측정 | BigQuery + ledger same-window 조회 | Codex | NO | [[google-roas-gap-decomposition-20260507]] (작성 예정) |
| P1 | time_waiting | Phase4-Sprint8 | ConfirmedPurchasePrep 재실행 | missing_click_id 변화 | canary 24h PASS 후 본 agent 자동 | Codex | NO | [[google-ads-confirmed-purchase-candidate-prep-20260507]] |
| P1 | parked_red | Phase3-Sprint5 | Google Ads BI confirmed_purchase | NPay 오염 차단 | 5번 결과 PASS 후 승인안 update | TJ + Codex | YES | [[google-ads-confirmed-purchase-execution-approval-20260505]] |
| P2 | parked_red | Phase3-Sprint6 | `구매완료` Primary 변경 | 자동입찰 신호 정상화 | 6번 7일 병행 관측 후 | TJ + Codex | YES | [[google-ads-purchase-primary-change-approval-20260505]] |
| P2 | blocked_data | Phase5-Sprint1 | Google tag gateway 활성화 옵션 결정 | 측정 회복 | Imweb 회신 또는 Cloudflare 결정 | TJ | NO (조사) / YES (활성화) | [[../GA4/google-tag-gateway-poc-approval-20260507]] |
| P2 | auto_ready | Phase6-Sprint1 | Channel funnel quality BigQuery 분석 | Google ROAS gap 해석 | BigQuery raw 7/14/30일 source_group별 | Codex | NO | (작성 예정) |
| P3 | auto_ready | Phase7-Sprint1 | Meta funnel CAPI readiness | 구매 전 신호 가능성 | 코드 read + Test Events 계획 | Codex | NO (조사) / YES (Test Events 실행) | (작성 예정) |

## Approval Queue

현재 open approval: **없음** (canary 승인은 closed로 분류).

future Red approval (재개 조건 미충족):

| 승인안 | 재개 조건 |
|---|---|
| [[paid-click-intent-minimal-ledger-write-approval-20260507]] | canary 24h 결과 보고 후 정식 운영화 결정 (재가공 또는 새 승인) |
| [[google-ads-confirmed-purchase-execution-approval-20260505]] | ConfirmedPurchasePrep 재실행 PASS 후 |
| [[google-ads-purchase-primary-change-approval-20260505]] | 새 BI confirmed_purchase 7일 병행 관측 후 |
| [[paid-click-intent-gtm-production-publish-approval-20260506]] | (이미 publish 완료, status: executed로 정리됨) |
| [[paid-click-intent-production-receiver-deploy-approval-20260506]] | (이미 deploy 완료, status: executed로 정리됨) |

승인 큐 상세: [[../confirm/!confirm]]

## Completed Ledger

| 완료 시각 | 항목 | 결과 |
|---|---|---|
| 2026-05-06 KST | paid_click_intent Preview/receiver 검증 | gclid/gbraid/wbraid 3종 케이스 통과 |
| 2026-05-06 KST | 운영 backend no-write receiver route 배포 | `POST /api/attribution/paid-click-intent/no-send` 200 |
| 2026-05-07 00:02 KST | GTM live version 142 publish | `paid_click_intent_v1_receiver_20260506T150218Z` |
| 2026-05-07 17:41 KST | Google Ads API last_30d 재조회 | ROAS 8.72x, NPay label 분자 사실상 100% |
| 2026-05-07 18:12 KST | Google Ads x 운영 VM 원장 same-window 재대조 | 내부 confirmed ROAS 0.28x |
| 2026-05-07 18:33 KST | Google Ads VM ledger source recovery deploy | `backend/src/routes/googleAds.ts` 1파일 |
| 2026-05-07 22:01 KST | errorHandler hardening + PM2 1.5G uplift deploy | oversized 413, PM2 30s 주기 → 0회 |
| 2026-05-07 22:25 KST | minimal ledger write 4 선행 blocker 모두 PASS 확정 | T+23min evidence |
| 2026-05-07 22:35 KST | minimal ledger canary 실행 패킷 작성 + TJ 승인 | 8필드 통합 |
| 2026-05-07 23:01 KST | Phase 0/1/2 T+0 deploy + smoke | row 2 unique, dedupe 1, no_platform_send 7/7 |
| 2026-05-07 23:23 KST | canary T+22min monitoring | row 17 (자연 traffic 15건), 5xx 0%, PM2 0 추가 restart |

## Parked / Later

| 항목 | 보류 이유 | 재개 조건 |
|---|---|---|
| Google Ads conversion action 변경 | 자동입찰 학습/숫자 변경 Red Lane | BI confirmed_purchase + click id 보존률 충분 |
| conversion upload | 플랫폼 숫자 변경 Red Lane | no-send 후보, 중복 guard, click id fill-rate, rollback PASS |
| GA4/Meta/Google Ads 실제 purchase 전송 | 플랫폼 전환값 변경 Red Lane | platform별 payload 승인 + Events/BigQuery 중복 guard PASS |
| 운영 DB write (paid_click_intent 외) | 데이터 원장 변경 Red Lane | 별 schema/migration 승인 |
| Google tag gateway 실제 활성화 | DNS/CDN 권한 영향 | Imweb 회신 또는 Cloudflare 도입 결정 |
| Meta funnel CAPI ViewContent/AddToCart 운영 ON | 중복/품질 오염 위험 | Test Events smoke + dedup 검증 PASS |

## Source / Window / Freshness / Confidence

| 영역 | Source | Window | Freshness | Confidence |
|---|---|---|---|---|
| paid_click_intent canary deploy | [[backend-errorhandler-payload-hardening-pm2-uplift-deploy-result-20260507]] + [[paid-click-intent-minimal-ledger-canary-phase0-1-2-result-20260507]] | 2026-05-07 22:01~23:23 KST | T+22min monitoring 직후 | 0.94 |
| paid-click-intent 5xx 비율 | controlled probe + cloudflared error log | 2026-05-07 23:01~23:23 KST | 24분 sample | 0.85 |
| Google Ads API ROAS | local `GET /api/google-ads/dashboard?date_preset=last_30d` | 2026-04-07~2026-05-06 KST | 2026-05-07 18:12 KST 조회 | 0.90 |
| 내부 confirmed ROAS | 운영 VM `crm.sqlite3#attribution_ledger` same-window | 2026-04-07~2026-05-06 KST | 2026-05-07 18:12 KST 복구 | 0.92 |
| Google click id 보존률 | 운영 ledger `paid_click_intent_ledger` row count + capture_stage 분포 | 2026-05-07 23:01~23:23 KST | T+22min 직후 | 0.92 |
| ConfirmedPurchasePrep candidates | [[../gdn/google-ads-confirmed-purchase-candidate-prep-20260507]] | 2026-05-05 운영 결제완료 dry-run | canary 24h 후 재실행 예정 | 0.82 |
| BigQuery raw access | seo-656@seo-aeo-487113 SA + biocomkr.sns@gmail.com | 2026-05-05 권한 부여 | dataset read OK, jobs.query는 project-dadba7dd 경유 | 0.88 |

## Phase별 상세

### Phase4-Sprint6

**이름**: paid_click_intent canary write

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표: Google click id가 랜딩에서 운영 ledger까지 끊기지 않게 만든다. 이는 confirmed_purchase no-send 후보 품질의 선결조건이다.

완료한 것:

- canary execution packet 8필드 작성 + TJ 승인.
- backend code: `paidClickIntentLog.ts` (391줄) + `attribution.ts` flag 분기 + bootstrap.
- 운영 deploy: backup → scp 1.5G uplift + flag-off 배포.
- Phase 0/1/2 T+0 smoke 7종 PASS.
- T+22min monitoring: row 17, dedupe 1, 5xx 0%, PM2 0 추가 restart.

남은 것:

- T+30/45/60min monitoring (시간 의존).
- 1h PASS 시 24h 자동 연장.
- 24h 종료 후 정식 운영화 또는 종료 결정.

### Phase4-Sprint7

**이름**: Google ROAS gap 추적 (click id 보존 후)

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표: canary 후 missing_google_click_id 카운트가 감소하고, Google ROAS 8.72x vs internal 0.28x gap이 좁혀졌는지 측정한다.

완료한 것:

- canary 후 ledger row 17건 (이전 0건). click id 보존 즉시 효과 evidence.
- BigQuery jobs.query 권한 확인 (project-dadba7dd 경유).

남은 것:

- canary 1h+ PASS 후 BigQuery + ledger same-window 조회.
- ConfirmedPurchasePrep 재실행으로 missing_click_id 변화 측정.
- gap 원인별 표 작성 (NPay 오염 / click id 유실 / 추적 누락 / 광고 품질).

### Phase4-Sprint8

**이름**: confirmed_purchase no-send 재실행

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표: ConfirmedPurchasePrep 재실행으로 click id 보존률 개선이 후보 품질에 반영되는지 측정한다.

완료한 것:

- ConfirmedPurchasePrep v0 agent 구현. 운영 결제완료 623건 (homepage 586, NPay 37) 처리.
- 직전 결과: missing_google_click_id 618, with_gclid 5, send_candidate 0.

남은 것:

- canary 24h 후 재실행.
- click id 보존률 변화 측정.
- 결과로 BI confirmed_purchase 실행안 재검토 가능 여부 판정.

### Phase3-Sprint5

**이름**: Google Ads BI confirmed_purchase 실행안

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표: Google Ads에 실제 결제완료 주문만 구매로 알려주는 새 전환 신호 생성.

조건:

- ConfirmedPurchasePrep 재실행 결과 click id 보존률 충분.
- no-send 후보 품질 PASS.
- 별도 Red 승인.

승인안: [[google-ads-confirmed-purchase-execution-approval-20260505]]

### Phase3-Sprint6

**이름**: Google Ads `구매완료` Primary 변경

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표: 기존 `구매완료` Primary action `7130249515` (NPay label `r0vuCKvy-...`)를 Secondary로 강등하고 신규 confirmed_purchase를 Primary로.

조건:

- Phase3-Sprint5 새 신호 7일 병행 관측 결과 안정.

승인안: [[google-ads-purchase-primary-change-approval-20260505]]

### Phase5-Sprint1

**이름**: Google tag gateway 활성화 옵션 결정

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표: biocom·coffee 사이트의 Google 측정 신호를 first-party measurement path로 회복.

옵션:

- A. Cloudflare 도입 (DNS 이전, 영향 큼).
- B. Imweb native 지원 (TJ 외부 문의 대기).
- C. 자체 backend custom (작업량 큼).

POC: [[../GA4/google-tag-gateway-poc-approval-20260507]]

### Phase6-Sprint1

**이름**: Channel funnel quality BigQuery 분석

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표: Meta vs Google vs Organic 유입의 funnel quality (engagement, scroll, view_item, add_to_cart, begin_checkout, add_payment_info, purchase)를 BigQuery raw로 비교.

조건: BigQuery jobs.query 권한 (이미 보유, project-dadba7dd 경유).

산출물 (작성 예정): `gdn/channel-funnel-quality-meta-google-organic-20260507.md` + `data/channel-funnel-quality-20260507.json`.

### Phase7-Sprint1

**이름**: Meta funnel CAPI readiness

[[#Phase-Sprint 요약표|▲ 요약표로]]

목표: Meta Purchase 외 ViewContent/AddToCart/InitiateCheckout/AddPaymentInfo Test Events 가능성 조사.

조건: 별 트랙, 본 sprint와 독립.

산출물 (작성 예정): `capivm/meta-funnel-capi-readiness-20260507.md`.
