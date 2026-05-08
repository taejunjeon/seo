# Attribution 개선 우선순위 제안 (P0/P1/P2)

작성 시각: 2026-05-08 13:45 KST
대상: TJ + 본 agent 다음 sprint plan
문서 성격: Green Lane plan (실행 전 우선순위 합의용)
관련 정본: [[../data/!channelfunnel]], [[ga4-path-a-attribution-limit-20260508]], [[path-c-member-code-attribution-design-20260508]], [[npay-actual-confirmed-paid-click-join-dry-run-20260508]], [[bi-confirmed-purchase-operational-dry-run-builder-plan-20260508]]
Status: 우선순위 합의 단계. TJ 컨펌 후 sprint 진입.

## 5줄 결론

1. **P0 (즉시 실행)**: Path C 로컬 코드 작성 (Phase 1) + ConfirmedPurchasePrep input builder 코드 작성 (Phase 1~2). 둘 다 Green Lane, 본 agent 자율.
2. **P1 (Yellow 승인 후 sprint)**: Path C Phase 2~3 운영 deploy + 클라이언트 wrapper, 또는 Path B 별 collector 설계. Path A 한계 본질 회복 단계.
3. **P2 (Red 승인 후 sprint)**: GA4 NPay purchase fire 재활성화 (GTM v138 되돌리기) 또는 server-side confirmed purchase 설계, ProductEngagementSummary 50% scroll POC, Google Ads BI confirmed_purchase Red 승인안 갱신.
4. **이유**: P0 우선 = 빠른 측정 가능 + 본 agent 자율 + Yellow 차단 없음. P1 = 외부 인프라 변경 + Yellow. P2 = 광고 학습/UI/upload 영역 = Red.
5. P0/P1 통합 효과: Path A 0.33% → Path C 60~80% (16~22배 uplift) + NPay 부풀림 9.04배 → 1.8~5.4배 회수 (Path C 단독), 0.9배 정상화 (Path B 보강).

## 1. 우선순위 표

| Pri | 항목 | Lane | 본 agent 자율 | 효과 (정량) | 예상 sprint |
|---|---|---|---|---|---|
| **P0** | Path C 로컬 코드 작성 (Phase 1) | Green | YES | schema 1 컬럼 + lookup 함수 + ConfirmedPurchasePrep loop 변경 (deploy 안 함) | 1 sprint |
| **P0** | ConfirmedPurchasePrep input builder 작성 (Phase 1~2) | Green | YES | canary window 결제 측정 가능 + Path C effect 측정 자동화 | 1 sprint |
| **P0** | NPay actual confirmed dry-run 24h 종료 후 재측정 | Green | YES | 자동 (T+24h) | 자동 |
| **P1** | Path C Phase 2 운영 backend deploy | Yellow | NO (TJ 승인) | NPay 부풀림 9.04배 → 5.4배 회수 (60% 매칭) | 1 sprint |
| **P1** | Path C Phase 3 클라이언트 wrapper (imweb body 또는 GTM) | Yellow | NO (TJ 승인) | member_code 채워진 paid_click_intent ledger 누적 시작 | 1 sprint |
| **P1** | Path B 별 collector 설계 (imweb 결제완료 thanks page) | Yellow | NO | 비회원 NPay 까지 매칭 가능 (부풀림 0.9배 회수) | 1~2 sprint |
| **P1** | ConfirmedPurchasePrep builder Phase 3 cron 등록 | Yellow | NO | 매일 자동 갱신 + Auditor verdict 자동 | 1 sprint |
| **P2** | GA4 NPay purchase fire 재활성화 (GTM v138 되돌리기) | Red | NO (TJ Red 승인) | Path A 자체 회복 + Google Ads 학습 복구. 단 자사 결제 중복 위험 → enhanced_conversions transaction_id 필수 | 1~2 sprint |
| **P2** | server-side confirmed purchase 설계 (NPay 결제완료 server fire) | Red | NO | 클라이언트 cookie 차단 사용자도 매칭 + GA4/Meta 양쪽 fire | 2~3 sprint |
| **P2** | ProductEngagementSummary 50% scroll POC | Yellow→Red | NO | scroll engagement 측정 → SearchAds 정제 | 1~2 sprint |
| **P2** | Google Ads BI confirmed_purchase Red 승인안 갱신 | Red | NO (TJ Red) | 7일 ConfirmedPurchasePrep PASS 후 BI 활성화 | 1 sprint |

## 2. P0 상세 (즉시 실행 권장)

### P0-1. Path C 로컬 코드 작성 (Phase 1)

**무엇**: `backend/src/paidClickIntentLog.ts` 에 schema lazy migration + `lookupByMemberCode` export, `backend/src/routes/attribution.ts` 에 member_code 받음, `backend/scripts/google-ads-confirmed-purchase-candidate-prep.ts` 에 lookup loop.

**왜**: P1 (운영 deploy) 의 사전 조건. 코드 없으면 deploy 진입 불가.

**어떻게**: 본 agent SSH 없이 로컬 변경. typecheck PASS 확인. 운영 영향 없음.

**검증**:
- typecheck PASS
- 로컬 sqlite test: paid_click_intent fixture row + imweb_orders fixture → ConfirmedPurchasePrep 결과에 `paid_click_intent_member_code_match` 카운트 증가
- 기존 canary 회귀 없음 (member_code 빈 fire 도 정상)

**산출물**: 코드 변경 3 파일 + diff stat + typecheck log

**예상 sprint**: 1회

### P0-2. ConfirmedPurchasePrep input builder 작성 (Phase 1~2)

**무엇**: `backend/scripts/confirmed-purchase-prep-input-builder.ts` 신규 ([[bi-confirmed-purchase-operational-dry-run-builder-plan-20260508]] 참조).

**왜**: 현재 input 5/5 fixture 라 canary effect 측정 불가. builder 가 매일 canary window 결제 row 갱신 + Path C 적용 후 attribution_source_breakdown 자동 카운트.

**어떻게**: 운영 PG (`tb_iamweb_users`, `tb_playauto_orders`) read-only query → Path C 매개 chain 시도 → JSON 산출.

**검증**:
- typecheck PASS
- 로컬 dry-run: builder 결과 row count 191~350 (canary 24h 기준) cross-check
- audit JSON 의 attribution_source_breakdown 정상 산출

**산출물**: 코드 1 파일 + audit JSON sample

**예상 sprint**: 1회

### P0-3. NPay actual confirmed dry-run 24h 재측정

**무엇**: T+24h (2026-05-08 23:01 KST) 시점 자동 재측정 + dry-run 정본 update.

**왜**: 12.5h sample 14건 → 24h 약 28건 가정. 부풀림 회수 추정 정밀화.

**어떻게**: 본 agent 자동 (canary monitor + early audit 절차와 동일).

**검증**: T+24h 시점 paid_click_intent_ledger.npay_intent stage row count + imweb_orders.npay actual confirmed count cross-check.

**산출물**: `data/npay-paid-click-intent-join-dry-run-20260508-t24.json` + 정본 update.

**예상 sprint**: 자동 (별 sprint 진입 안 함)

## 3. P1 상세 (Yellow 승인 후 sprint)

### P1-1. Path C Phase 2 운영 backend deploy

**무엇**: paid_click_intent_ledger.member_code schema migration + lookupByMemberCode + ConfirmedPurchasePrep loop 운영 dist 반영.

**왜**: NPay 부풀림 9.04배 회수 시작. canary window 측정에서 Path C effect 직접 관측 가능.

**어떻게**: 본 agent SSH로 backup → scp → restart (errorHandler hardening 절차와 동일).

**검증 (Yellow 승인 조건)**:
- post-deploy smoke 7종 PASS (5xx 0, PII reject 정상, member_code 빈 fire 정상)
- lazy bootstrap ALTER 자동 실행 확인 (29 → 30 컬럼)
- 1h canary monitoring + 24h 재승인

**산출물**: deploy log + post-deploy audit + 24h monitoring 결과

**예상 sprint**: 1회 (TJ 승인 후 본 agent 자율 실행)

### P1-2. Path C Phase 3 클라이언트 wrapper

**무엇**: imweb body 또는 GTM Custom HTML tag 에 member_code 추출 + paid_click_intent payload 첨부.

**왜**: P1-1 deploy 후 비어있는 member_code 컬럼이 실제로 채워지기 시작. attribution chain 활성화.

**어떻게**: imweb body JS 또는 GTM Preview workspace Custom HTML tag.

**검증 (Yellow 승인 조건)**:
- Tag Assistant fire 확인
- backend ledger 에 member_code 채워진 row 추가 확인
- 1h canary + 24h monitoring

**산출물**: GTM 또는 imweb diff + canary monitoring 결과

**예상 sprint**: 1회

### P1-3. Path B 별 collector 설계

**무엇**: imweb 결제완료 thanks page 별도 client-side beacon: order_time, member_code, click_id, ga_session_id, pay_type, pg_type 캡처.

**왜**: 비회원 NPay 결제 attribution 가능. NPay 부풀림 0.9배 (정상 수준) 회수.

**어떻게**: 별 endpoint `/api/attribution/order-confirm-beacon/no-send` + GTM Custom HTML tag.

**검증 (Yellow 승인 조건)**: post-deploy smoke + canary monitoring + Auditor verdict.

**산출물**: 새 endpoint + collector schema contract + 1차 dry-run

**예상 sprint**: 1~2회

### P1-4. ConfirmedPurchasePrep builder Phase 3 cron 등록

**무엇**: 매일 KST 02:00 builder 실행 + 02:30 ConfirmedPurchasePrep + 02:45 Auditor verdict.

**왜**: 일일 자동 갱신 → TJ 매일 status 확인 가능 + ConfirmedPurchasePrep PASS 판정 자동화.

**어떻게**: backend agent scheduler 또는 운영 cron.

**검증**: 1주일 cron 실행 결과 stable.

**산출물**: cron 등록 + 자동 실행 log

**예상 sprint**: 1회

## 4. P2 상세 (Red 승인 후 sprint)

### P2-1. GA4 NPay purchase fire 재활성화 (GTM v138 되돌리기)

**무엇**: GTM 변경 → NPay 결제완료 → `purchase` event 재활성화. 자사 결제와 enhanced_conversions transaction_id로 중복 방지.

**왜**: Path A 자체 회복. Google Ads 학습 복구. 단 자사 결제 중복 위험 → enhanced_conversions transaction_id 필수.

**Red 승인 조건**:
- enhanced_conversions transaction_id schema 검증
- 자사 결제 fire 시 npay 결제 fire 둘 다 같은 order_no 매칭 검증
- 1주일 monitoring 후 정식 publish

### P2-2. server-side confirmed purchase 설계

**무엇**: NPay 결제완료 시점 server-side fire (GA4 Measurement Protocol + Meta CAPI). 클라이언트 cookie 차단 사용자도 매칭.

**왜**: cookie 차단 사용자 (Safari ITP, ad-block) 매칭 가능 + GA4/Meta 양쪽 fire 통합.

**Red 승인 조건**: PII 정책 검토 + transaction_id dedupe + Meta CAPI Test Events smoke.

### P2-3. ProductEngagementSummary 50% scroll POC

**무엇**: GA4 BigQuery scroll event 50% 임계 fire → ProductEngagementSummary agent input 추가.

**왜**: 광고 click 후 scroll engagement 측정 → SearchAds 정제 (engagement 기반 RSA 자동 차단).

### P2-4. Google Ads BI confirmed_purchase Red 승인안 갱신

**무엇**: 7일 ConfirmedPurchasePrep PASS 후 Google Ads BI confirmed_purchase 활성화.

**왜**: confirmed_purchase 가 광고 학습 신호로 직접 사용됨.

## 5. 이번 주 본 agent 자율 진행 (P0)

| 시점 | 작업 |
|---|---|
| 즉시 (본 sprint 후) | P0-1 Path C 로컬 코드 작성 |
| 즉시 | P0-2 ConfirmedPurchasePrep input builder 작성 |
| T+24h (2026-05-08 23:01 KST) | P0-3 자동 재측정 |
| T+24h+ | 본 우선순위 표 갱신 + 24h 종합 audit + TJ 보고 |

## 6. TJ 영역 (Yellow/Red 승인 후보)

본 sprint 끝에 TJ 컨펌 큐 추가:

| # | 항목 | Lane | 자신감 |
|---|---|---|---:|
| #10 | P1-1 Path C Phase 2 운영 backend deploy | Yellow | 90% |
| #11 | P1-2 Path C Phase 3 클라이언트 wrapper | Yellow | 85% |
| #12 | P1-3 Path B 별 collector 설계 sprint 진입 | Yellow | 80% |
| #13 | P1-4 ConfirmedPurchasePrep builder cron 등록 | Yellow | 90% |
| #14 | P2-1 GTM v138 NPay GA4 purchase 재활성화 | Red | 70% (자사 결제 중복 위험) |

## 7. 한 줄 결론

> P0 = Path C 로컬 코드 + builder 즉시 (Green, 본 agent 자율). P1 = Path C Phase 2~3 + Path B + builder cron (Yellow, TJ 승인). P2 = GTM 되돌리기 + server-side fire + scroll POC + BI 승인 (Red). **본 sprint 후 P0 즉시 진입, T+24h 자동 재측정**.
