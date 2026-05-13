# Google Ads · click id capture Yellow Sprint A 결과 (2026-05-14)

## 첫 줄 판정

**C — YELLOW_A_FAIL_NEEDS_GTM_OR_BACKEND_PATCH**.
Y-1 snapshot refresh + Y-2 matching dry-run 모두 click id fill-rate 개선이 미미. Y-1 +0.14pp (1.03% → 1.17%) · Y-2 A-grade 25 match 중 gclid 보유 intent 0건 → 추가 +0. 본체는 RC-2/RC-3 (landing/checkout 단계 자체 gclid 손실). 다음은 **Y-3 server gclid echo / Y-4 snippet patch / R-1 GTM publish** 승인안.

## 10초 요약

1. Y-1 VM snapshot refresh 완료. 5/5 stale → 5/13 fresh, with_click_id **23 → 26 (+3)**.
2. Y-1 결과 fill-rate **1.03% → 1.17% (+0.14pp)**. snapshot stale 은 본체 원인 아님 확정.
3. Y-2 NPay intent → order matching dry-run: **A-grade 25 match (₩772만)** — 그러나 25건 모두 gclid 보유 intent **0건**.
4. Y-2 A-grade write 실행해도 fill-rate 추가 0. NPay button click 사용자 (gclid 87%) 와 실제 NPay 결제완료 사용자 분리.
5. Y-5 GTM Preview 대신 backend snippet 분석: **imwebAttributionSnippet 에 gbraid/wbraid 완전 누락**. gclid 만 capture. payment_success 시점 lastTouch.gclid + URL query 만 — NPay redirect 시 sessionStorage 손실 시 0 fill.

## harness preflight

```yaml
harness_preflight:
  common_harness_read: harness/common/HARNESS_GUIDELINES.md  # 2026-05-14 03:30 KST
  project_harness_read: harness/gdn/
  required_context_docs:
    - gdn/google-ads-click-id-capture-root-cause-20260514.md
    - gdn/google-ads-click-id-capture-fix-approval-20260514.md
    - gdn/google-ads-confirmed-purchase-no-send-quality-20260514.md
  lane: Yellow Sprint A (TJ 명시 승인)
  allowed_actions:
    - Y-1 snapshot refresh + 24h TTL cron
    - Y-2 matching dry-run (aggregate only)
    - Y-2 A-grade write 는 별도 approval packet 작성 (실행 금지)
    - Y-5 GTM Preview verification — backend code audit 대체 수행
    - UA 4개 삭제 capability 검토 (실행 금지)
    - scoped commit
  forbidden_actions:
    - Y-3 backend deploy / Y-4 snippet patch / R-1 GTM publish / R-2 8 primary 정리 / R-3 upload canary
    - Google Ads upload / send / mutate / 기존 primary 수정
    - campaign / budget mutate
    - 운영DB write / import
    - GTM Production publish
    - Y-2 dry-run 결과의 실제 write
    - raw email / phone / member_code / order_id / payment_key / click_id 출력
  source_window_freshness_confidence:
    source: VM Cloud snapshot vm-attribution-snapshot-20260514.sqlite3 (NEW) + 운영DB tb_iamweb_users
    window: 2026-04-14 ~ 2026-05-13 KST (last_30d)
    freshness: snapshot age 약 1h fresh (생성 2026-05-14 03:00 KST)
    confidence: 0.9
```

## 작업 1 — Y-1 snapshot refresh 결과

| 항목 | 이전 | 이후 |
|---|---|---|
| snapshot path | data/vm-npay-intent-20260505.sqlite3 | data/vm-attribution-snapshot-20260514.sqlite3 |
| mtime | 2026-05-05 22:01 KST (9d stale) | 2026-05-14 03:00 KST (fresh) |
| attribution_ledger rows | 18,406 (전체) | 19,637 (전체) |
| max(logged_at) | 2026-05-05T22:00:41 KST | **2026-05-13T23:59:06 KST** |
| last_30d biocom_imweb payment_success confirmed | 1,227 | **1,543** (+316, +25.8%) |
| with gclid | 18 | **22** (+4) |

builder 재실행:

| Metric | baseline (stale snapshot) | post-refresh |
|---|---|---|
| operational_orders | 2,225 | 2,228 (+3) |
| with_google_click_id | 23 | **26** (+3) |
| fill-rate | 1.03% | **1.17%** (+0.14pp) |
| missing_attribution_vm_evidence | 1,014 | 716 (-298, **vm evidence 매칭 +298건**) |

**결론**: snapshot stale 은 source 의 일부 lag 만 야기. fill-rate 본체 원인 아님.

**bucket loss 주의**: 5/3~5/10 bucket totalEntries=22,317 > limit=10,000 — 약 6,317 rows API limit 으로 누락. fill-rate 영향은 미미 (같은 비율로 sampling).

**rollback path**: builder 의 `--vm-db=data/vm-npay-intent-20260505.sqlite3` 옵션으로 옛 snapshot 복귀 가능. 기존 파일 보존.

## 작업 2 — Y-2 NPay intent → order matching dry-run

| 항목 | 값 |
|---|---|
| window | 2026-04-14 ~ 2026-05-13 KST |
| intent total | 820 |
| intent with gclid | 715 (87.2%) |
| NPay payment_complete orders | 233 |
| 운영DB raw_data->sections 에서 prodNo 추출 성공 | 233 (100%) |

**매칭 key**: `intent.product_idx` ↔ `운영DB raw_data->sections->sectionItems->productInfo->prodNo` + captured_at/order_date window

| Grade | 정의 | count | amount KRW | gclid 보유 매칭 |
|---|---|---|---|---|
| **A-grade** | product_idx + 30min unique 매칭 | **25** | **₩7,720,600** | **0** |
| B-grade | product_idx + 30min~24h single | 100 | — | — |
| C-grade | product_idx + 30min~24h multiple | 145 | — | — |
| ambiguous_30min | >1 candidate in 30min | 5 | — | — |
| unmatched | 매칭 없음 | 545 | — | — |

**핵심 발견**: A-grade 25건 deterministic 매칭 가능. 그러나 **25건 모두 gclid 보유 intent 와 매칭 0건**.

해석: NPay button click 한 사용자 (gclid 87% 보유) 와 실제 NPay 로 결제완료한 사용자는 **다른 사용자/세션**. 즉 gclid 광고 클릭으로 들어온 사람은 NPay button 까지 누르지만 결제완료 단계까지 안 감, NPay 결제완료 한 사람은 광고 안 거치고 직접 진입.

**One-shot write 권장**: **skip**. write 실행해도 click_id pool 증가 0. ROAS 학습 신호 추가 contribution 0. 별도 approval packet 작성 불필요.

**False-positive risk**: B/C/ambiguous 250건은 같은 product_idx + 30분 초과 → 다른 사용자가 같은 제품 결제 가능성. 만약 write 하면 잘못된 gclid 부착 위험. **write 금지** (TJ 승인 조건 충족).

## 작업 3 — Y-5 GTM Preview verification (backend code audit 대체)

GTM Preview 는 TJ UI 작업이라 Codex 직접 수행 불가. 대신 backend `imwebAttributionSnippet.ts` 와 `paidClickIntentLog.ts` 정독.

별도 산출: [google-ads-gtm-preview-result-20260514.md](google-ads-gtm-preview-result-20260514.md)

핵심 finding:

| ID | 발견 | 함의 |
|---|---|---|
| F1 | **imwebAttributionSnippet 에 gbraid/wbraid 완전 누락** (grep count = 0) | iOS App campaign / restricted 광고에서 들어온 gbraid/wbraid 는 어느 단계에서도 ledger 에 fill 안 됨 — RC-6 확정 |
| F2 | payment_success 시점 gclid source 가 lastTouch + URL query 만 | NPay redirect 시 sessionStorage 손실 + 결제 success URL 에 gclid 첨부 안 함 → RC-3 retention 4.3% mechanism |
| F3 | siteLandingChannelClassifier 는 gbraid/wbraid 분류 가능하나 source 데이터 비어있음 | 데이터 모델 단계 컬럼 부재 — 분류 코드는 있어도 실제 데이터 0 |
| F4 | TJ UI 직접 검증 필요 항목 5개 | dataLayer fire timing / receiver allowlist / redirect strip / NPay return URL 등 |

## 작업 4 — no-send 재계산

| 단계 | operational_orders | with_gclid | fill-rate | block 주요 |
|---|---|---|---|---|
| baseline (5/14 dry-run, stale snapshot) | 2,225 | 23 | 1.03% | missing_google_click_id 2,202 |
| post Y-1 snapshot refresh | 2,228 | **26** | **1.17%** | missing_google_click_id 2,202 (변함없음) · missing_attribution_vm_evidence 1,014 → **716** |
| post Y-2 dry-run projected | 2,228 | 26 | 1.17% | A-grade 25 매칭 중 gclid 0 → 추가 0 |
| homepage_eligible | — | 18 | — | — |
| npay_eligible | — | 5 | — | — |
| **actual_send_candidate** | — | **0** | — | ✅ invariant |
| **upload_candidate** | — | **0** | — | ✅ invariant |
| **send_candidate** | — | **false** | — | ✅ invariant |

## UA 4개 삭제 capability 검토

| 항목 | 결과 |
|---|---|
| auth scope | `https://www.googleapis.com/auth/adwords` (full scope) ✅ |
| service account | Explorer Access — UI 에서 read-only 권한 가능성 |
| backend code | `googleAds:search` 만 구현. **mutate route 미구현** ❌ |
| 즉시 삭제 가능? | **불가**. mutate route 추가 + Google Cloud Console 권한 승격 필요. Red Lane 별도 sprint. |
| 권장 | **옵션 A**: TJ 가 Google Ads UI 에서 직접 4개 action 의 `primary_for_goal=false` 또는 `status=REMOVED`. UI 작업 1분 내 가능. |

## 판정 (decision tree)

| Option | 결과 | 근거 |
|---|---|---|
| **A. YELLOW_A_PASS_NEXT_Y3_Y4_DESIGN** | NO | Y-1 +0.14pp · Y-2 +0pp — 개선 미미. 'snapshot refresh + Y-2 dry-run 으로 개선 방향 확인됨' 조건 미충족 |
| **B. YELLOW_A_PARTIAL_NEEDS_Y2_WRITE_APPROVAL** | NO | Y-2 A-grade 25건 모두 gclid 0건 — write 실행해도 click id pool 증가 0. one-shot write 비용 대비 효과 0 |
| **C. YELLOW_A_FAIL_NEEDS_GTM_OR_BACKEND_PATCH** | **YES** ✅ | landing/checkout 단계 자체 gclid 손실이 본체. Y-3/Y-4/R-1 가 진짜 fix |

## invariants held

| invariant | value |
|---|---|
| google_ads_conversion_action_mutate | 0 |
| google_ads_upload_send | 0 |
| bi_primary_change | 0 |
| existing_primary_modified | 0 |
| techsol_modified / techsol_deleted | 0 / 0 |
| campaign_mutate / campaign_budget_mutate | 0 / 0 |
| operational_db_write / import | 0 / 0 |
| vm_cloud_sqlite_write_outside_new_snapshot | 0 |
| vm_cloud_sqlite_schema_migration | 0 |
| gtm_publish | 0 |
| y2_one_shot_write_executed | 0 |
| y3_backend_deploy / y4_snippet_patch_deploy | 0 / 0 |
| cron_registered | 0 |
| external_send_count | 0 |
| raw_identifier_leak | false |

## next-action 점수표

| # | Action | Owner | Claude Code 가능 | Data | Timing | Impact | Risk | 종합 | 추천 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Y-3/Y-4 승인 검토 — snippet 패치 (gbraid/wbraid 추가 + lastTouch 보존 + NPay return URL gclid 재첨부) | TJ | ❌ Decision | 95 | 100 | 95 | 30 | **88** | ✅ 즉시 결정 |
| 2 | R-1 GTM Production publish 승인 검토 — marketing_intent landing trigger 강화 | TJ | ❌ Decision | 85 | 80 | 90 | 70 | **75** | ✅ Y-3/Y-4 다음 |
| 3 | Y-1 cron 등록 — 매일 KST 03:00 snapshot refresh 자동화 | Claude Code (TJ 승인 후) | ✅ | 100 | 50 | 60 | 20 | **75** | ✅ 안정화 후 |
| 4 | Y-2 one-shot write **skip** 결정 — fill-rate 개선 0 | TJ | ❌ Decision | 100 | 100 | 0 | 0 | n/a | ⚠️ skip 권장 |
| 5 | UA 4개 삭제 — TJ Google Ads UI 직접 작업 (옵션 A) | TJ | ❌ UI only | 100 | 100 | 80 | 30 | **80** | ✅ TJ |

## 산출 paths

- `gdn/google-ads-click-id-capture-yellow-a-result-20260514.md` (본 문서)
- `data/project/google-ads-click-id-capture-yellow-a-result-20260514.json`
- `gdn/google-ads-gtm-preview-result-20260514.md`

## 참고

- 본 root-cause: [google-ads-click-id-capture-root-cause-20260514.md](google-ads-click-id-capture-root-cause-20260514.md)
- approval packet: [google-ads-click-id-capture-fix-approval-20260514.md](google-ads-click-id-capture-fix-approval-20260514.md)
- 어제 post-check (BI action): [google-ads-bi-confirmed-purchase-offline-postcheck-20260514.md](google-ads-bi-confirmed-purchase-offline-postcheck-20260514.md)
- 어제 no-send dry-run: [google-ads-confirmed-purchase-no-send-quality-20260514.md](google-ads-confirmed-purchase-no-send-quality-20260514.md)
- 8 primary inventory: [google-ads-purchase-primary-inventory-20260514.md](google-ads-purchase-primary-inventory-20260514.md)
