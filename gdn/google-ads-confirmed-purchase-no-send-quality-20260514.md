# Google Ads · confirmed_purchase no-send candidate 품질 dry-run (2026-05-14)

## 첫 줄 판정

**B — NOT_READY_CLICK_ID_GAP**.
BI confirmed_purchase_offline (id 7609289411) action 자체는 ENABLED 로 정상 등록됨. 그러나 **last_30d (2026-04-14~2026-05-13) 결제완료 주문 2,225건 중 Google click id 가 붙은 row 가 23건 (1.03%) 뿐**. baseline 5/10 의 1.44% 대비 -0.41pp 더 낮아짐. action 준비는 됐지만 upload 매칭 품질이 낮아 canary 전 click id capture 보강이 먼저 필요.

## harness preflight

```yaml
harness_preflight:
  common_harness_read: harness/common/HARNESS_GUIDELINES.md  # 2026-05-14 02:00 KST
  project_harness_read: n/a
  required_context_docs:
    - gdn/google-ads-bi-confirmed-purchase-offline-postcheck-20260514.md
    - data/project/google-ads-bi-confirmed-purchase-offline-postcheck-20260514.json
    - data/confirmed-purchase-integrated-input-20260510.json
    - data/bi-confirmed-purchase-operational-dry-run-20260510-last30.json
    - gdn/techsol-gads-npay-click-conversion-audit-20260510.md
    - gdn/google-ads-techsol-secondary-off-preaudit-or-result-20260511.md
    - project/sprint2.md
  lane: Green
  allowed_actions:
    - 운영DB SELECT (read-only)
    - VM Cloud SQLite SELECT (read-only)
    - confirmed_purchase builder dry-run 재실행
    - markdown + JSON 산출
    - scoped commit
  forbidden_actions:
    - Google Ads conversion action mutate
    - 기존 구매완료(7130249515) / TechSol(7564830949) / BI(7609289411) 수정
    - ClickConversion upload / Data Manager ingest / file upload
    - campaign / budget mutate
    - operational DB write / import
    - VM Cloud SQLite write / schema migration
    - GTM Production publish
    - raw email/phone/member_code/order_id/payment_key/click_id 출력
  source_window_freshness_confidence:
    source: 운영DB tb_iamweb_users + VM Cloud SQLite order_bridge_ledger
    window: 2026-04-14 ~ 2026-05-13 KST (last 30d)
    freshness: imweb_operational source_lag=0.5h (fresh), generated_at 2026-05-14 02:05 KST
    confidence: 0.85 (builder 재실행 + 5/10 baseline 정본 비교)
```

## 작업 1 — confirmed_purchase no-send 후보 재계산

builder script: `backend/scripts/bi-confirmed-purchase-operational-dry-run.ts`
명령: `npx tsx scripts/bi-confirmed-purchase-operational-dry-run.ts --start=2026-04-14 --end=2026-05-13 --skip-bigquery --output=...`

### 핵심 metric (운영자가 한눈에 볼 것)

| 항목 | 값 | 비고 |
|---|---|---|
| total confirmed orders | **2,225** | 5/10 대비 +73 |
| homepage confirmed orders | 2,061 | |
| NPay actual confirmed orders | 164 | NPay 결제완료 정본 |
| total amount KRW | **₩5억 848만** (₩508,480,596) | 5/10 대비 +₩624만 |
| **with Google click id** | **23 (1.03%)** | 5/10 baseline 31 (1.44%) 대비 -0.41pp **↓** |
| ↳ gclid only | 17 | |
| ↳ gclid + gbraid 둘 다 | 6 | |
| ↳ gbraid only | 0 | |
| ↳ wbraid only | 0 | |
| **missing Google click id** | **2,202 (98.97%)** | 압도적 병목 |
| duplicate blocked count | **0** | duplicate guard 통과 |
| zero/negative value | 0 | value guard 통과 |
| already_sent count | 0 | |
| theoretical_upload_eligible_count | **23** | homepage 18 + NPay 5 |
| theoretical_upload_eligible_amount | **₩559만** | homepage ₩498만 + NPay ₩61만 |
| **actual_send_candidate** | **0** | ✅ invariant |
| **upload_candidate** | **0** | ✅ invariant |
| **send_candidate** | **false** | ✅ invariant |

### Block reason 분포 (multiple flag, 한 candidate 가 동시에 여러 reason 가능)

| reason | count | 설명 |
|---|---|---|
| read_only_phase | 2,225 | 정책 차단 (정상 — 이번 sprint read-only) |
| approval_required | 2,225 | 정책 차단 (정상 — Red 승인 전) |
| already_in_ga4_unknown | 2,225 | GA4 cross-check unknown — BigQuery skip 으로 미작동. dispatch 단계 영향 없음 |
| **missing_google_click_id** | **2,202** | **실제 매칭 병목 — 진짜 fix target** |
| missing_attribution_vm_evidence | 1,014 | VM Cloud ledger 매칭 없음. 일부는 missing_google_click_id 와 중첩 |
| npay_intent_purchase_without_intent | 120 | NPay 결제완료지만 paid_click_intent_log 에 대응 intent 없음 |
| npay_intent_ambiguous | 17 | NPay intent 매칭 모호 |
| npay_intent_not_a_grade_strong | 14 | NPay intent 신뢰도 B 이하 |
| order_has_return_reason | 14 | 환불/취소 row — 정상 제외 |

## 작업 2 — BI confirmed_purchase_offline action 반영

| 항목 | 값 |
|---|---|
| dry-run target action_id | **7609289411** |
| action_name | BI confirmed_purchase_offline |
| type | UPLOAD_CLICKS |
| category | PURCHASE |
| primary_for_goal | false (secondary) |
| status | ENABLED |
| click window | 30일 (의도 90일, FAIL) |
| view window | 1일 (의도 3일, FAIL) |
| value setting | dynamic, default ₩1 |

### earliest safe canary 시점 (action 생성 후 6시간 미만)

- action 첫 API 관측 시점 (fetchedAt): **2026-05-14 01:44 KST**
- 현재 시점: **2026-05-14 02:05 KST** (약 21분 경과)
- earliest 6h buffer: **2026-05-14 07:44 KST**
- earliest 24h buffer (권장): **2026-05-15 01:44 KST**

본 sprint 는 어느 buffer 이전이든 **upload 0 유지**. canary 결정은 별도 sprint + Red Lane 명시 승인.

## 작업 3 — 8개 PURCHASE primary risk inventory 연결

BI confirmed_purchase_offline 외에도 **PURCHASE primary action 이 8개 동시 ENABLED**:

| id | name | type | click_window |
|---|---|---|---|
| 782218494 | Transactions (A_view) | GA imported | 30d |
| 916482221 | Transactions (바이오컴펫_main - 필터적용) | GA imported | 30d |
| 916483619 | 더클린커피 웹 (web) purchase | GA imported | 30d |
| 917303941 | 바이오컴펫_와이즈 - GA4 (web) purchase | GA imported | 30d |
| 917325117 | Transactions (전체 웹사이트 데이터) | GA imported | 30d |
| 922178603 | [G4] biocom.kr (web) in_app_purchase | GA4 imported | 90d |
| 945320590 | Transactions (전체 웹사이트 데이터) | GA imported | 30d |
| **7130249515** | **구매완료** | WEBPAGE | 7d |

함의: BI confirmed_purchase_offline 후보 품질이 좋아져도 **단순 primary 승격만으로 학습 신호가 정리되지 않는다**. 8개 정리는 **별도 Red Lane sprint** 로 분리.

본 sprint invariant: primary_for_goal 변경 **0** · campaign mutate **0** · budget mutate **0**.

## 작업 4 — 판정 (decision tree)

| Option | 결과 | 근거 |
|---|---|---|
| **A. READY_FOR_SECONDARY_UPLOAD_CANARY** | NO | theoretical_upload_eligible_count=23 의미 있으나 click id fill-rate 가 baseline 1.44% → 1.03% 로 더 낮아짐 (개선 X). canary 결정 보류. |
| **B. NOT_READY_CLICK_ID_GAP** | **YES** ✅ | missing_google_click_id=2,202 (98.97%) 가 압도적 병목. action 자체는 ENABLED 정상 등록되었으나 upload 매칭 품질 매우 낮음. 다음 작업은 **click id capture/ledger 개선**. |
| **C. NOT_READY_GUARD_GAP** | NO | duplicate guard 0 위반 / value > 0 100% / cancel_return_exclusion 14건 정상 차단. guard 자체는 통과. 문제는 click_id 부족이지 guard 불충분 아님. |

## 5/10 baseline vs 5/14 비교

| 항목 | 5/10 (정본) | **5/14 (신규)** | Δ |
|---|---|---|---|
| operational_orders | 2,152 | **2,225** | +73 |
| total_value | ₩502,237,676 | **₩508,480,596** | +₩624만 |
| with_google_click_id | 31 | **23** | **-8 ↓** |
| click id fill-rate | 1.44% | **1.03%** | **-0.41pp ↓** |
| missing_google_click_id | 2,121 | **2,202** | +81 |
| send_candidate | 0 | 0 | invariant ✅ |

baseline 대비 4일간 click id capture 개선 없음. 오히려 -8 건 감소. 별도 sprint 로 GTM tracking inventory / paid_click_intent_log 적재 점검 필요.

## 작업 5 — 문서화 결정

| ID | 항목 | 결정 |
|---|---|---|
| decision-1 | BI confirmed_purchase_offline 역할 | confirmed_purchase 업로드용 **관찰(observation) action**. 실제 ClickConversion upload 는 별도 Red Lane 명시 승인 전까지 0 유지. |
| decision-2 | TechSol - NPAY구매 50739 | **NPay click/intent 보조 신호**. confirmed_purchase 대체 불가. 이름과 달리 실제 NPay 버튼 클릭 시점 트리거이므로 운영자 결제완료 매출과 합산 금지. |
| decision-3 | 본 sprint 범위 | read-only no-send dry-run. **upload · campaign · budget mutate 모두 0**. |

## invariants held

| invariant                                | value |
| ---------------------------------------- | ----- |
| conversion_action_mutate                 | 0     |
| existing_primary_modified                | 0     |
| new_action_primary_changed               | 0     |
| techsol_modified / techsol_deleted       | 0 / 0 |
| click_conversion_uploaded                | 0     |
| data_manager_ingest / file_upload        | 0 / 0 |
| campaign_mutate / campaign_budget_mutate | 0 / 0 |
| operational_db_write                     | 0     |
| vm_cloud_sqlite_write / schema_migration | 0 / 0 |
| gtm_publish                              | 0     |
| external_send_count                      | 0     |
| raw_identifier_leak                      | false |

## next-action 점수표

| # | Action | Owner | Claude Code 가능 | Data | Timing | Impact | Risk | 종합 | 추천 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | click id capture 진단 — site_landing_ledger / paid_click_intent_log 에 gclid/gbraid/wbraid 적재 점검 (last_30d) | Claude Code | ✅ | 95 | 100 | 95 | 0 | **94** | ✅ Green Lane 진행 가능 |
| 2 | GTM tracking inventory 재점검 — biocom landing 의 gclid query param capture 시점/필드 확인 | Claude Code | ✅ | 80 | 80 | 90 | 0 | **85** | ✅ Green Lane |
| 3 | 8개 PURCHASE primary 정리 결정 sprint | TJ + Claude Code | 부분 | 70 | 50 | 90 | 80 | **80** | ❌ Red Lane — 별도 명시 승인 |
| 4 | Google Ads UI 재확인 — click 90일 / view 3일 입력 (UPLOAD_CLICKS clamp 의심) | TJ | ❌ UI only | 100 | 100 | 70 | 0 | **87** | ✅ TJ |

## 산출 paths

- `data/project/google-ads-confirmed-purchase-no-send-quality-20260514.json` — raw metric + decision + invariants 정본
- `gdn/google-ads-confirmed-purchase-no-send-quality-20260514.md` — 본 문서

## 참고 문서

- 어제 post-check: [google-ads-bi-confirmed-purchase-offline-postcheck-20260514.md](google-ads-bi-confirmed-purchase-offline-postcheck-20260514.md)
- 5/10 baseline: `data/bi-confirmed-purchase-operational-dry-run-20260510-last30.json`
- TechSol 분석: [techsol-gads-npay-click-conversion-audit-20260510.md](techsol-gads-npay-click-conversion-audit-20260510.md)
- option3 결정: [google-ads-techsol-secondary-off-preaudit-or-result-20260511.md](google-ads-techsol-secondary-off-preaudit-or-result-20260511.md)
