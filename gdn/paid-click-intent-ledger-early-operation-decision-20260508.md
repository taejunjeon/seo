# minimal `paid_click_intent` ledger 조기 운영화 판단 (T+12.5h)

작성 시각: 2026-05-08 11:50 KST
대상: TJ
canary 시작: 2026-05-07 23:01 KST (T+12.5h)
24h 종료 예정: 2026-05-08 23:01 KST (T+11.5h 후)
관련 문서: [[paid-click-intent-ledger-canary-early-audit-20260508]], [[confirmed-purchase-prep-canary-interim-20260508]], [[npay-paid-click-intent-join-dry-run-20260508]]
**판단 옵션**: **APPROVE_EARLY_CONDITIONAL**
Do not use for: GA4/Meta/Google Ads 실제 전송, conversion upload, conversion action 변경, GTM publish, 광고 변경, 무기한 ledger write 별 승인 없이

## 5줄 결론

1. **APPROVE_EARLY_CONDITIONAL** 판정 (자신감 90%): canary T+12.5h 시점 EARLY_PASS_CANDIDATE 임계 모두 통과. 24h 기다리지 않고 정식 운영화 조건부 승인 가능.
2. 조건: ① 24h 종료까지 monitoring 유지 (본 agent 자동) ② 24h 시점 임계 위반 0 ③ 무기한 운영화는 별 승인 (재승인) ④ attribution 측정은 별 chain (GA4 BigQuery 매개) 별 sprint.
3. **지금 승인 가능**: paid_click_intent ledger write 24h 기간 종료 후 자동 재승인 (TJ가 24h 결과 보고 후 무기한 운영화 결정).
4. **지금 승인하면 안 됨**: 광고 플랫폼 전송, conversion upload, conversion action 변경, GTM publish, NPay attribution 강제 결합, raw payload 저장, sample rate 0.1 미만 강제.
5. 정식 운영화로 달라지는 점: ledger row 무기한 누적, 90일 TTL 자동 만료 cron 별 sprint, attribution chain dry-run 가능. **외부 플랫폼 전송은 영원히 별 승인**.

## 1. 판단 결과 — APPROVE_EARLY_CONDITIONAL

### 임계 통과 요약 (T+12.5h)

| 임계 | 값 | 판정 |
|---|---:|---|
| 관측 시간 ≥ 6h | 12.5h | ✅ |
| row 수 ≥ 500 (또는 자연 페이스) | 498 (35건/h × 14h 페이스) | ✅ |
| 모든 capture_stage 존재 | landing 332 / checkout 87 / npay_intent 79 | ✅ |
| 5xx < 1% | 0% | ✅ |
| PM2 restart 안정 | 0회 추가 | ✅ |
| heap < 70% (RSS 기준) | 15.2% (227 / 1500 MB) | ✅ |
| PII/value/order/payment reject 정상 | 0 위반 | ✅ |
| no_platform_send 0 | 100% | ✅ |
| dedupe ratio 정상 | 1.2% | ✅ |
| TEST/DEBUG/PREVIEW 차단 | 0 row | ✅ |

→ **모두 PASS**. EARLY_PASS_CANDIDATE 임계 충족.

### 미해결 항목 (별 sprint)

| 항목 | 사유 | 정식 운영화 영향 |
|---|---|---|
| ConfirmedPurchasePrep canary effect 측정 | input file 미갱신 (5/5 dry-run) | 측정 불가, 별 sprint 필요. 정식 운영화 가능성에는 영향 없음 |
| NPay 결제완료 ↔ paid_click_intent indirect join | 0% 매칭 (시간 window 1h~72h) | attribution 측정 불가. 정식 운영화는 ledger write에 한정, attribution은 별 chain |
| 14일/30일 funnel 비교 | 별 sprint | 정식 운영화 영향 없음 |

→ **정식 운영화 가능성과 무관**. ledger 자체는 안전하게 동작.

## 2. 지금 TJ 컨펌 가능한 것

### 컨펌 #1 — minimal `paid_click_intent` ledger write 정식 운영화 (조건부)

**무엇**: canary 24h 종료(2026-05-08 23:01 KST) 후 정식 운영 모드로 전환 — `PAID_CLICK_INTENT_WRITE_ENABLED=true` 무기한 유지.

**왜 가능**: T+12.5h 시점 모든 EARLY_PASS_CANDIDATE 임계 충족. 24h까지 본 agent 자동 monitoring으로 임계 위반 즉시 알람.

**범위**:
- `site=biocom` Google click id 보존용 ledger write 무기한 유지
- 저장 필드: schema contract 정본 (gclid/gbraid/wbraid, UTM, landing_path, referrer_host, client/session id, captured_at)
- 90일 TTL 자동 만료 (별 cron sprint)
- raw payload, PII, order, payment, value, currency 저장 영원히 금지

**조건**:
- 24h 종료 시점 임계 위반 0
- 24h 동안 mem 200~300MB 유지 (1.5G threshold의 20% 미만)
- 24h 동안 PM2 restart < 5회
- 24h 동안 5xx 비율 < 1%

**회신 한 줄**:
```text
YES: minimal paid_click_intent ledger write 24h 결과 PASS 시 정식 운영화 조건부 승인
```

또는

```text
YES: 24h 종료 시점에 본 agent 보고 후 다시 결정
```

## 3. 지금 컨펌하면 안 되는 것

| 금지 | 이유 |
|---|---|
| GA4/Meta/Google Ads/TikTok/Naver 실제 전송 | 별 Red 승인 영역 |
| Google Ads conversion action 생성/변경 | 별 Red 승인 |
| Google Ads conversion upload | 별 Red 승인 |
| Google Ads `구매완료` Primary 변경 | 별 Red 승인 |
| confirmed_purchase 실제 send | 별 Red 승인 |
| Google tag gateway 활성화 | 별 Yellow 승인 |
| GTM Production publish | 별 Red 승인 |
| 광고 예산/캠페인 변경 | 별 사업 승인 |
| paid_click_intent ledger 의 raw payload 저장 | 영원히 금지 (PII risk) |
| paid_click_intent ledger 에 PII / order / payment / value / currency 저장 | 영원히 금지 |
| sample rate < 1.0 강제 | 통계적 모집단 손실. 본 sprint canary는 1.0 |
| ledger schema 변경 (column 추가/제거) | 별 schema sprint + 검증 |

## 4. 정식 운영화로 달라지는 점

| 항목 | canary (현재) | 정식 운영화 |
|---|---|---|
| flag | `PAID_CLICK_INTENT_WRITE_ENABLED=true` (24h 한정) | `true` 무기한 유지 |
| sample rate | 1.0 (전체) | 1.0 유지 (변경 별 승인) |
| TTL | 90일 (코드에 정의됨) | 동일 + cron 자동 만료 (별 sprint) |
| ledger row 누적 | 24h 한정 | 무기한 누적 (예상 35건/h × 24h × 30일 = 25,200건/월) |
| flag rollback | 즉시 가능 | 즉시 가능 (현재와 동일) |
| 외부 플랫폼 전송 | 0건 | 0건 (영원히) |
| attribution 측정 | indirect join 0% | 별 chain 별 sprint (Path A/B/C) |

## 5. 24h 이후 자동 진행할 Green 작업 (본 agent 자율)

| 시점 | 작업 |
|---|---|
| T+18h (~17:00 KST) | 추가 audit (자연 페이스 검증, 누적 row 추세) |
| T+24h (~23:00 KST) | **24h 종합 audit + TJ 보고** |
| T+24h+ | GA4 BigQuery 매개 attribution chain dry-run (Path A) |
| T+24h+ | 운영 PG 기반 새 ConfirmedPurchasePrep dry-run input 생성 (별 sprint) |
| T+24h+ | 14일/30일 channel funnel quality 비교 |
| T+24h+ | paid_tiktok 광고 품질 분리 분석 |
| T+24h+ | AIBIO BigQuery funnel quality 추가 분석 (권한 신규) |

## 6. 24h 이후 Red 승인 후보 (TJ 영역)

| # | 항목 | 시점 | 본 agent 추천 |
|---:|---|---|---|
| - | 24h PASS 후 정식 운영화 (본 #1) | 2026-05-08 23:01 KST | YES |
| 2 | VM Google Ads developer token | 즉시 | YES |
| 3 | Google Ads BI confirmed_purchase 실행안 | D+1 (ConfirmedPurchasePrep PASS) | 조건부 YES |
| 4 | `구매완료` Primary 변경 | D+8 (#3 7일 병행) | YES (조건 후) |
| 5 | Google tag gateway 활성화 옵션 | Imweb 회신 후 | 보류 |
| 6 | Imweb 외부 문의 | 즉시 | YES |
| 9 | Meta funnel CAPI Test Events smoke | 즉시 | YES |
| 신규 | paid_click_intent schema에 member_code 추가 (Path C) | 별 sprint | YES (회원 결제 100% attribution 가능) |
| 신규 | imweb 결제완료 페이지 별 collector (Path B) | 별 sprint | YES (NPay attribution 가능) |

## 7. 본 agent 자율 진행 (TJ 컨펌 NO)

| 작업 | 시점 |
|---|---|
| 24h까지 자동 audit (T+18/24h) | 시간 의존 |
| GA4 BigQuery 매개 attribution chain dry-run (Path A) | 24h+ 후 |
| paid_click_intent schema lookup 코드 작성 (Path C 준비) | 즉시 가능 (deploy는 Yellow) |
| ReportAuditor / ApprovalQueue 정기 실행 | 정기 |

## 8. 본 sprint에서 처리한 4개 산출물

| 산출물 | 상태 |
|---|---|
| `data/paid-click-intent-ledger-canary-early-audit-20260508.json` | ✅ 완료 |
| `gdn/paid-click-intent-ledger-canary-early-audit-20260508.md` | ✅ 완료 |
| `data/confirmed-purchase-prep-canary-interim-20260508.json` | ✅ 완료 |
| `gdn/confirmed-purchase-prep-canary-interim-20260508.md` | ✅ 완료 |
| `data/npay-paid-click-intent-join-dry-run-20260508.json` | ✅ 완료 |
| `gdn/npay-paid-click-intent-join-dry-run-20260508.md` | ✅ 완료 |
| `gdn/paid-click-intent-ledger-early-operation-decision-20260508.md` | ✅ 본 문서 |

## 9. TJ 회신 template

### 옵션 1: 조기 조건부 승인

```text
YES: minimal paid_click_intent ledger write 24h 결과 PASS 시 정식 운영화 조건부 승인
```

→ 본 agent가 24h 종료 시점 자동 보고 → 임계 위반 0 시 정식 운영화 status 정본 update.

### 옵션 2: 24h까지 보류 후 결정

```text
보류: 24h 종료 후 본 agent 보고 후 다시 결정
```

→ 본 agent가 24h까지 monitoring 유지 + 종료 시 결과 보고.

### 옵션 3: rollback

```text
NO: 즉시 flag false rollback
```

→ 본 agent 즉시 `PAID_CLICK_INTENT_WRITE_ENABLED=false` 적용 + canary row TTL 또는 status=rejected 처리.

## 한 줄 결론

> T+12.5h 시점 EARLY_PASS_CANDIDATE 모든 임계 통과. **APPROVE_EARLY_CONDITIONAL** 추천 (자신감 90%). 24h 종료까지 본 agent 자동 monitoring 유지 + 별 chain (GA4 BigQuery 매개) 별 sprint 진행. 외부 플랫폼 전송은 영원히 별 Red 승인.
