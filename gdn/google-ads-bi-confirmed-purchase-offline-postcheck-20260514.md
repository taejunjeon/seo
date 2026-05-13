# Google Ads · BI confirmed_purchase_offline read-only post-check (2026-05-14)

## harness preflight

```yaml
harness_preflight:
  common_harness_read: harness/common/HARNESS_GUIDELINES.md  # 2026-05-14 01:30 KST
  project_harness_read: n/a  # google ads · no project-local harness
  required_context_docs:
    - gdn/google-ads-techsol-secondary-off-preaudit-or-result-20260511.md
    - gdn/techsol-gads-npay-click-conversion-audit-20260510.md
    - data/project/google-ads-bi-confirmed-purchase-offline-postcheck-20260514.json
  lane: Green
  allowed_actions:
    - Google Ads API GET conversion_action (read-only)
    - markdown + JSON 산출
    - scoped commit
  forbidden_actions:
    - conversion action create / update / delete
    - 기존 구매완료(7130249515) 수정
    - TechSol(7564830949) 수정 / 삭제
    - BI confirmed_purchase_offline(7609289411) primary 변경
    - ClickConversion upload / Data Manager ingest
    - campaign · campaign_budget mutate
    - GTM Production publish
    - production DB write
  source_window_freshness_confidence:
    source: Google Ads API v22 live (customer 214-999-0943)
    window: 2026-05-14 KST snapshot
    freshness: fetchedAt 2026-05-13T16:44:15.169Z
    confidence: 0.9
```

## 운영자가 한눈에 볼 답

- 새 전환 action **BI confirmed_purchase_offline** (id 7609289411) 가 Google Ads 계정에 정상 등록됨.
- TJ 의도와 API 실제값이 **11개 일치 · 2개 불일치** (click window 90 → 30, view window 3 → 1).
- 기존 **구매완료(7130249515) primary=true 유지**, **TechSol(7564830949) primary=false 유지** — 모두 의도대로.
- 이번 sprint 는 read-only post-check. **upload · campaign · budget mutate 모두 0**.
- 이 action 은 **confirmed_purchase 업로드 관찰 (observation) action** 으로 문서화. TechSol 은 **NPay click/intent 보조** 로 confirmed_purchase 대체 불가.

## 13개 check 결과표

| # | 항목 | 의도 (UI 설정) | API 반환 | 결과 |
|---|---|---|---|---|
| 1 | 새 action id | (신규) | **7609289411** | PASS |
| 2 | name | BI confirmed_purchase_offline | "BI confirmed_purchase_offline" | PASS |
| 3 | category | 구매 (PURCHASE) | PURCHASE | PASS |
| 4 | type/source | 클릭에서 가져오기 | **UPLOAD_CLICKS** | PASS (offline 계열) |
| 5 | primary_for_goal | 보조 액션 (false) | false | PASS |
| 6 | status | (활성) | ENABLED | PASS |
| 7 | counting_type | 모든 전환 | MANY_PER_CLICK | PASS |
| 8 | click-through window | **90일** | **30일** | **FAIL** |
| 9 | value setting | 각기 다른 값 사용, 없는 경우 ₩1 | dynamic (always_use_default_value=false · default=1) | PASS |
| 10 | 구매완료(7130249515) primary | true 유지 | true | PASS |
| 11 | TechSol(7564830949) primary | false 유지 | false | PASS |
| 12 | upload/send/Data Manager ingest | 0 | 0 (호출 안 함) | PASS |
| 13 | campaign/budget change | 0 | 0 | PASS |

추가 (TJ 가 명시했으나 13 list 외 항목):
- **view-through window** 의도 3일 · API 1일 → **FAIL**.

## 새 action raw 정본

```json
{
  "id": "7609289411",
  "name": "BI confirmed_purchase_offline",
  "resource_name": "customers/2149990943/conversionActions/7609289411",
  "status": "ENABLED",
  "type": "UPLOAD_CLICKS",
  "category": "PURCHASE",
  "primary_for_goal": false,
  "counting_type": "MANY_PER_CLICK",
  "click_through_lookback_window_days": 30,
  "view_through_lookback_window_days": 1,
  "value_settings": {
    "default_value_krw": 1,
    "always_use_default_value": false
  },
  "send_to": [],
  "snippet_types": []
}
```

(WEBPAGE/snippet 이 비어있는 것은 UPLOAD_CLICKS type 의 정상 동작 — offline upload 만 받기 때문.)

## 기존 PURCHASE primary action 분포 (추가 발견)

BI confirmed_purchase_offline 외에 **8개의 PURCHASE primary action 이 동시에 ENABLED** 인 상태:

| id | name | type | click_window_days |
|---|---|---|---|
| 782218494 | Transactions (A_view) | GA imported | 30 |
| 916482221 | Transactions (바이오컴펫_main - 필터적용) | GA imported | 30 |
| 916483619 | 더클린커피 웹 (web) purchase | GA imported | 30 |
| 917303941 | 바이오컴펫_와이즈 - GA4 (web) purchase | GA imported | 30 |
| 917325117 | Transactions (전체 웹사이트 데이터) | GA imported | 30 |
| 922178603 | [G4] biocom.kr (web) in_app_purchase | GA4 imported | 90 |
| 945320590 | Transactions (전체 웹사이트 데이터) | GA imported | 30 |
| **7130249515** | **구매완료** | WEBPAGE | 7 |

함의: BI confirmed_purchase_offline 를 향후 primary 로 승격해도, 다른 7개 GA4-imported / Transactions primary 가 동시에 입찰 학습에 들어가고 있음. 단순 승격만으로 학습 신호 정리되지 않음 — **별도 sprint 로 정리 결정 필요**.

## PURCHASE secondary action 현재 분포

| id | name | type | click_window_days |
|---|---|---|---|
| 6630514046 | [G4] biocom.kr (web) 결제완료 | GA4 imported | 90 |
| 7564830949 | TechSol - NPAY구매 50739 | WEBPAGE | 90 |
| **7609289411** | **BI confirmed_purchase_offline** | **UPLOAD_CLICKS** | **30** |

## 문서화 결정

| ID | 항목 | 결정 | Owner | Lock-in |
|---|---|---|---|---|
| decision-1 | BI confirmed_purchase_offline 역할 | **confirmed_purchase 업로드용 관찰 action**. 실제 ClickConversion upload 는 별도 명시 승인 전까지 0. | TJ | upload candidate count > 0 일 때 Red Lane 승인 필요 |
| decision-2 | TechSol - NPAY구매 50739 역할 | **NPay click/intent 보조 신호로 유지**. confirmed_purchase 대체 불가 — '구매' 이름과 달리 실제 NPay 버튼 클릭 시점 트리거. 운영자 결제완료 매출(tb_iamweb_users PAYMENT_COMPLETE) 과 합산 금지. | TJ | [techsol-gads-npay-click-conversion-audit-20260510.md](techsol-gads-npay-click-conversion-audit-20260510.md), [google-ads-techsol-secondary-off-preaudit-or-result-20260511.md](google-ads-techsol-secondary-off-preaudit-or-result-20260511.md) |
| decision-3 | sprint 범위 | read-only post-check. **실제 업로드는 하지 않음.** | TJ | invariants_held 13 항목 모두 0 |

## TJ 확인 필요 질문

| Q | 내용 |
|---|---|
| Q1 | **click-through window 90일** 의도였는데 API 가 30일 반환. UPLOAD_CLICKS type 의 max click window 가 30일로 강제될 가능성 있음 — UI 에서 90일 입력해도 시스템이 30일로 clamp. UI 재확인 필요. |
| Q2 | **view-through window 3일** 의도였는데 API 가 1일 반환. 같은 사유 가능성. UI 재확인. |
| Q3 | BI confirmed_purchase_offline 향후 primary 승격 계획 있는가? 있다면 기존 7개 PURCHASE primary (GA4 imported transactions 류) 정리 시점도 같이 결정 필요. |

## invariants held (이번 sprint)

| invariant | value |
|---|---|
| conversion_action_mutate | 0 |
| existing_primary_modified | 0 |
| new_action_primary_changed | 0 |
| techsol_modified | 0 |
| techsol_deleted | 0 |
| click_conversion_uploaded | 0 |
| data_manager_ingest | 0 |
| campaign_mutate | 0 |
| campaign_budget_mutate | 0 |
| file_upload | 0 |
| external_send_count | 0 |
| operational_db_write | 0 |

## next-action 점수표

| # | Action | Owner | Claude Code 가능 | Data | Timing | Impact | Risk | 종합 | 추천 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Google Ads UI 재확인 — click window 90일, view window 3일 입력값 다시 확인 | TJ | ❌ (UI only) | 100 (API 정본 있음) | 100 (지금) | 70 (UI 표시 오해 방지) | 0 (read-only) | **87** | ✅ |
| 2 | no-send 후보 품질 재계산 dry-run — 새 action id=7609289411 반영, candidate_count=0 invariant 유지 | Claude Code | ✅ | 95 | 80 (다음 sprint) | 60 (upload 결정 근거) | 0 (dry-run) | **92** | ✅ |
| 3 | 8개 PURCHASE primary 정리 결정 sprint — BI confirmed_purchase_offline 승격 vs 기존 강등 vs 동시 운영 | TJ + Claude Code | 부분 (의견 제시) | 70 | 50 (정리 우선순위 정해야) | 90 (입찰 학습 분리) | 80 (실수 시 ROAS 영향) | **80** | Lane Red — 별도 sprint 명시 승인 |

## 산출 paths

- `data/project/google-ads-bi-confirmed-purchase-offline-postcheck-20260514.json` — raw + 13 check + invariants 정본
- `gdn/google-ads-bi-confirmed-purchase-offline-postcheck-20260514.md` — 이 문서
