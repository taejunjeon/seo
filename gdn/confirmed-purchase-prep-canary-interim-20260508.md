# ConfirmedPurchasePrep canary 중간 재실행 결과 (T+12.5h)

작성 시각: 2026-05-08 11:40 KST
문서 성격: Green Lane read-only schema 검증 + canary effect 미측정 사유 명시
관련 문서: [[paid-click-intent-ledger-canary-early-audit-20260508]], [[google-ads-confirmed-purchase-candidate-prep-20260507]], [[../data/!channelfunnel]]
Status: schema 검증 PASS / canary effect 측정 불가 (input dependency 미갱신)

## 5줄 결론

1. ConfirmedPurchasePrep agent 재실행 PASS — schema 동작 + send_candidate=0 guard 검증.
2. 결과는 직전(2026-05-07 20:13 KST)과 **완전 동일**: 623 candidates / with_gclid 5 / missing 618 / send_candidate 0.
3. **canary effect 측정 불가**: input file `bi-confirmed-purchase-operational-dry-run-20260505.json` 가 직전 5/5 dry-run 그대로 사용됨.
4. 의미 있는 비교를 위해서는 **운영 PG 기반 새 dry-run input** (5/8 시점) 또는 **paid_click_intent_ledger를 직접 input source로 추가** 필요. 본 sprint 범위 밖.
5. 본 재실행은 **canary로 인한 backend 회귀 없음** 만 확인. Google Ads attribution 변화 측정은 별 sprint (GA4 BigQuery 매개 chain).

## 1. 재실행 결과 (직전과 동일)

| 항목 | 직전 (5/7 20:13) | 현재 (5/8 12:35) | 변화 |
|---|---:|---:|---|
| payment_complete_candidates | 623 | 623 | 동일 |
| homepage | 586 | 586 | 동일 |
| npay | 37 | 37 | 동일 |
| ga4 present | 476 | 476 | 동일 |
| with_google_click_id | 5 | 5 | 동일 |
| missing_google_click_id | 618 | 618 | 동일 |
| send_candidate | 0 | 0 | ✅ guard 유지 |
| block_reason 종류 | 11종 | 11종 | 동일 |

→ **input dependency 미갱신**으로 결과 변화 없음. canary 시작(5/7 23:01 KST) 이전에 만든 dry-run input(5/5)을 그대로 사용한 결과.

## 2. canary effect 측정 불가 사유

ConfirmedPurchasePrep agent 의 input source:
```text
data/bi-confirmed-purchase-operational-dry-run-20260505.json
```

→ 이 파일은 2026-05-05 시점의 운영 PG dry-run 결과를 담은 정적 JSON. canary 시작(5/7) 이후 데이터를 반영 안 함.

**의미 있는 canary effect 측정**을 위해서는:

| 옵션 | 작업 |
|---|---|
| A. 운영 PG 기반 5/8 시점 새 dry-run input 생성 | `tb_iamweb_users` + `tb_playauto_orders` + GA4 BigQuery purchase event 매개 query → 새 JSON. 별 sprint, 본 agent 자율 (CLAUDE.md PG read-only 명시) |
| B. ConfirmedPurchasePrep agent 의 input source 에 paid_click_intent_ledger 추가 | `backend/scripts/google-ads-confirmed-purchase-candidate-prep.ts` 에 ledger lookup join 코드 추가. 별 sprint |
| C. GA4 BigQuery 매개 chain dry-run | paid_click_intent.ga_session_id → GA4 events_*.ga_session_id → GA4 purchase event → imweb_orders. homepage only attribution. NPay 제외. 본 agent 자율 (BigQuery 권한 보유) |

본 agent 추천: **C 우선** (별 sprint), B 후속 (코드 변경).

## 3. canary 안전성 회귀 검증 (본 재실행 의미)

| guard | 본 재실행 결과 |
|---|---|
| send_candidate = 0 | ✅ |
| read_only_phase block | ✅ (623/623) |
| approval_required block | ✅ (623/623) |
| google_ads_conversion_action_not_created block | ✅ (623/623) |
| conversion_upload_not_approved block | ✅ (623/623) |
| would_operational_write | false |
| writes_local_artifacts | true (JSON/MD) |
| platform API call | 0건 |

→ canary로 인한 ConfirmedPurchasePrep schema/guard 회귀 없음.

## 4. 다음 자동 진행 (auto_ready)

| 작업                                           | 의존성                              | 본 agent 자율?    |
| -------------------------------------------- | -------------------------------- | -------------- |
| GA4 BigQuery 매개 chain dry-run                | BigQuery 권한 (보유)                 | YES            |
| 운영 PG 기반 새 dry-run input                     | DATABASE_URL 환경변수 본 agent 가용성 확인 | 환경 의존          |
| paid_click_intent_ledger schema lookup 코드 추가 | 코드 변경 + 검증                       | YES (별 sprint) |
| canary 24h 종료 후 동일 재실행                       | 24h 도달                           | YES            |

## 한 줄 결론

> 본 재실행은 schema/guard 회귀 없음만 확인. canary effect (with_gclid 변화) 측정은 운영 PG 새 dry-run input 또는 GA4 BigQuery 매개 chain 별 sprint 영역.
