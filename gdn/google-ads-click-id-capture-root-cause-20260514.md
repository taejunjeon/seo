# Google Ads · click id capture funnel root-cause 조사 (2026-05-14)

## 첫 줄 판정

**B — ROOT_CAUSE_FOUND_APPROVAL_NEEDED**.
funnel 5단계 추적 결과 root cause 5+개를 A-grade 로 특정했다. Green 설계 산출은 가능하나 실제 fix 는 backend patch deploy / snapshot refresh cron / GTM publish / Google Ads UI 변경 등 Yellow~Red 승인이 필요하다.

## 10초 요약

1. 광고 클릭 진입 시점 (`marketing_intent` 10,119건) 에서 **gclid capture 0건** — landing 단계에서 query param 이 ledger 에 들어오지 않는다.
2. checkout_started (gclid 440건, 11.1%) → payment_success (19건, 1.30%) 로 결제 funnel 에서 **95.7%** 가 사라진다.
3. 같은 funnel 의 **fbclid 는 oppositely 증가** (checkout 22.9% → payment_success 33.8%) — Meta CAPI 가 서버 측 echo 로 채우는 중. Google 에는 동등 채널 부재.
4. NPay intent capture 단계는 **gclid 87% 정상** (715/820). 그러나 **matched_order_no 100% pending** — intent → order bridge 단 한 건도 작동 안 함.
5. builder 가 읽는 VM snapshot 은 **5/5 시점, 9일 stale**. 마지막 8일 (5/6~5/13) click capture 가 ledger 에 없다.

## harness preflight

```yaml
harness_preflight:
  common_harness_read: harness/common/HARNESS_GUIDELINES.md  # 2026-05-14 02:30 KST
  project_harness_read: harness/gdn/  # README, RULES, VERIFY, AUDITOR_CHECKLIST 존재
  required_context_docs:
    - gdn/google-ads-bi-confirmed-purchase-offline-postcheck-20260514.md
    - gdn/google-ads-confirmed-purchase-no-send-quality-20260514.md
    - data/project/google-ads-confirmed-purchase-no-send-quality-20260514.json
    - gdn/techsol-gads-npay-click-conversion-audit-20260510.md
    - gdn/google-ads-techsol-secondary-off-preaudit-or-result-20260511.md
  lane: Green
  allowed_actions:
    - VM Cloud SQLite SELECT (read-only)
    - 운영DB SELECT (read-only)
    - builder script 정독
    - root-cause / approval packet 산출 (실행 금지)
    - scoped commit
  forbidden_actions:
    - Google Ads upload / mutate
    - GTM Production publish
    - backend deploy / restart
    - cron 등록 / monitor 자동화 실행
    - 운영DB write / VM Cloud SQLite write / schema migration
    - raw email / phone / member_code / order_id / payment_key / click_id 출력
  source_window_freshness_confidence:
    source: VM Cloud snapshot vm-npay-intent-20260505.sqlite3 + 운영DB
    window: 2026-04-14 ~ 2026-05-13 KST (last_30d)
    freshness: snapshot age 9d stale (큰 risk — root cause RC-1)
    confidence: 0.85
```

## funnel 5단계 evidence

| 단계 | source | rows | with_gclid | with_fbclid | fill-rate gclid | 관찰 |
|---|---|---|---|---|---|---|
| A. marketing_intent (landing) | attribution_ledger touchpoint='marketing_intent' | **10,119** | **0** | 0 | **0%** | landing 진입 시점에 gclid 가 ledger 에 1건도 없다 |
| B. checkout_started | attribution_ledger touchpoint='checkout_started' | 3,962 | 440 | 910 | 11.1% | 체크아웃에서 일부 회복. fbclid 의 절반 수준 |
| C. payment_success | attribution_ledger touchpoint='payment_success' AND payment_status='confirmed' | 1,466 | **19** | 496 | **1.30%** | checkout 440 → payment 19, retention 4.3%. fbclid 는 +50% 증가 (server echo) |
| D. NPay intent capture | npay_intent_log site=biocom env=live | 820 | **715** | 25 | **87.2%** | gclid 매우 잘 받음. 하지만 matched_order_no 0건 / match_status 모두 pending |
| E. builder input | bi-confirmed-purchase-operational-dry-run.ts indexVmLedger + indexVmNpayIntents | 1,227 + 820 | 18 + 715 | — | — | ledger 의 attribution_ledger join. NPay intent 는 matched_order_no 가 비어있어 builder 도달 못 함 |

## root cause 분류표

| # | 원인 | evidence | affected | confidence | Green fix 가능 | Yellow/Red 필요 |
|---|---|---|---|---|---|---|
| RC-1 | VM snapshot 9일 stale (5/5 cutoff) | data/vm-npay-intent-20260505.sqlite3 mtime 2026-05-05 22:01 KST · window 끝 5/13 까지 8일 lag | 1,227 ledger rows 중 약 600 row 미반영 추정 | **A** | snapshot refresh 설계 산출 가능 | Yellow — cron 등록 + VM pull 자동화 |
| RC-2 | marketing_intent gclid 0건 | attribution_ledger marketing_intent 10,119 / gclid 0 (last_30d) | landing 단계 — 모든 광고 진입 영향 | **A** | GTM trigger / query allowlist audit (read-only) | Yellow Preview · Red GTM publish |
| RC-3 | checkout→payment retention 4.3% | checkout_started 440 → payment_success 19 / fbclid 910→496 (54%) 와 비교 | 421 click candidates 손실 | **A** | snippet / NPay return URL flow 점검 | Yellow snippet patch · Red GTM publish |
| RC-4 | npay_intent matched_order_no 0건 | npay_intent_log 820 rows / matched=0 / pending 820 (100%) | 715 gclid-bearing intents 미사용 — NPay actual 164 중 5건만 eligible 원인 | **A** | matching pipeline 설계 (intent_key / page_location order_no 추출 / merchant_uid join) | Yellow — matching cron 등록 |
| RC-5 | Meta CAPI 대비 Google server-side echo 부재 | fbclid checkout 22.9% → payment 33.8% (server fill). gclid 11.1% → 1.30% (drop) | 전체 funnel | **A** | Meta CAPI 코드 패턴 분석 + server-side gclid echo route 설계 | Yellow — backend route patch |
| RC-6 | gbraid/wbraid 거의 0건 | npay_intent_log gbraid=1, wbraid=0 / attribution_ledger 동일 | iOS App / restricted 광고 클릭 — 작은 수치 | **B** | landing query allowlist audit | Yellow GTM trigger 확장 · Red GTM publish |
| RC-7 | site_landing_ledger 로컬 0 rows | crm.sqlite3 site_landing_ledger 정의만 존재 / row=0 | attribution_ledger marketing_intent 가 사실상 대체 — 이중 누락 없음 | **B** | 사용 정책 명시 (deprecated or 활성화 plan) | Yellow — schema 결정 |

## homepage vs NPay drilldown

| 구분 | 운영DB orders | Eligible (with click id) | primary root cause |
|---|---|---|---|
| homepage_confirmed | 2,061 | **18** | landing capture 0% (RC-2) + checkout→payment retention 4.3% (RC-3) + snapshot stale (RC-1) |
| NPay actual confirmed | 164 | **5** | npay_intent matched_order_no 0건 (RC-4) + snapshot stale (RC-1) |

## 작업 3 — Green fix 설계 (실행 금지)

### G1. snapshot refresh policy 설계
- 현재: builder `DEFAULT_VM_DB` 가 5/5 snapshot 정본 사용
- 제안: 24h TTL · VM Cloud `https://att.ainativeos.net/api/attribution/ledger/snapshot` 에서 매일 KST 03:00 pull
- 산출 path: `backend/scripts/vm-snapshot-refresh.ts` (신규, **본 sprint 작성 X**)
- TTL invariant: `vm_snapshot_age_hours <= 24` (no-send 후보 산출 차단 게이트)

### G2. join key normalize 설계 (intent → order)
- npay_intent_log `intent_key`, `page_location` 안의 order/merchant uid 추출 → 운영DB `tb_iamweb_users.order_number` 또는 `channel_order_no` 매칭
- 매칭 키 후보 (순서): `intent_key`, `page_location query merchant_uid`, `page_location query orderNo`, `client_id + captured_at window`
- 산출: matching table mapping (gdn/google-ads-click-id-capture-fix-approval-20260514.md 안)

### G3. gclid/gbraid/wbraid field mapping 표
| stage | source field | target | normalize |
|---|---|---|---|
| landing | URL query param `gclid` | attribution_ledger.gclid | direct |
| landing | URL query param `gbraid` | attribution_ledger metadata_json.gbraid | TBD — 현재 schema 에 별도 컬럼 없음 |
| landing | URL query param `wbraid` | attribution_ledger metadata_json.wbraid | TBD |
| checkout | session storage cached gclid | attribution_ledger.gclid | session_id join |
| npay_intent | page_location query | npay_intent_log.gclid | direct |
| payment_success | server-side echo | attribution_ledger.gclid | **현재 없음 — 신규 fill 필요 (RC-5)** |

### G4. no-send 재계산 계획
- snapshot refresh 직후 builder 재실행 → with_google_click_id 추세 monitor
- target metric: fill-rate 1.03% → 30%+ (Meta fbclid 수준)
- canary 조건: fill-rate 50% + earliest_safe canary time 도달 + Red 승인

### G5. dashboard click_id fill-rate 카드 추가 설계
- `/ads/google` 페이지 진짜 ROAS chip 옆에 새 chip:
  - 라벨: `Google click id capture rate (last_30d)`
  - 값: `N% (paid_naver fbclid baseline X%)`
  - 임계값 색: <10% red / <30% amber / ≥30% green
- 백엔드 endpoint: `/api/ads/google/click-id-capture-health?since=Y&until=Z` (신규)
- 본 sprint 작성 X — 다음 sprint 후보

### G6. 24h/48h monitor 설계
- 새 cron `vm-snapshot-age-monitor` (Yellow):
  - 매시 정각 vm snapshot mtime 체크
  - >24h 시 slack/log warn · >48h 시 builder block

### G7. fixture/test 설계
- snapshot stale 시 builder 가 fail-fast 하는지 unit test 추가
- intent matching pipeline 의 join key 매핑 test fixture (랜덤 intent_key + order_no pair)

## 작업 4 — Yellow/Red 승인 packet (실행 금지)

별도 산출: [google-ads-click-id-capture-fix-approval-20260514.md](google-ads-click-id-capture-fix-approval-20260514.md)

요약:
- **Green 즉시**: 1건 (본 root-cause 산출)
- **Yellow approval**: 5건 (snapshot refresh cron / intent matching / server gclid echo / snippet patch / GTM Preview)
- **Red approval**: 3건 (GTM Production publish / 8 PURCHASE primary 정리 / BI upload canary)

## 작업 5 — 8 PURCHASE primary read-only inventory

별도 산출: [google-ads-purchase-primary-inventory-20260514.md](google-ads-purchase-primary-inventory-20260514.md)

본 sprint 에서 mutate 0. 정리 순서 초안 only.

## invariants held

| invariant | value |
|---|---|
| google_ads_conversion_action_mutate | 0 |
| google_ads_upload_send | 0 |
| bi_primary_change | 0 |
| existing_primary_modified | 0 |
| techsol_modified / techsol_deleted | 0 / 0 |
| campaign_mutate / campaign_budget_mutate | 0 / 0 |
| operational_db_write | 0 |
| vm_cloud_sqlite_write / schema_migration | 0 / 0 |
| gtm_publish | 0 |
| backend_deploy / backend_restart | 0 / 0 |
| cron_registration / monitor_automation | 0 / 0 |
| external_send_count | 0 |
| raw_identifier_leak | false |

## next-action 점수표 (10초 요약 기반)

| # | Action | Owner | Claude Code 가능 | Data | Timing | Impact | Risk | 종합 | 추천 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | TJ approval decision — 5 Yellow + 3 Red 후보 우선순위 확정 | TJ | ❌ Decision | 95 | 100 | 95 | 0 | **94** | ✅ 즉시 |
| 2 | Yellow #1: VM snapshot refresh cron 등록 + 24h TTL | Claude Code | ✅ (승인 후) | 100 | 100 | 90 | 30 | **88** | ✅ Yellow approval 직후 |
| 3 | Yellow #2: npay_intent → order matching pipeline 구현 | Claude Code | ✅ (승인 후) | 95 | 80 | 95 | 40 | **86** | ✅ Yellow approval 직후 |
| 4 | Yellow #3: server-side gclid echo route (Meta CAPI 패턴) | Claude Code | ✅ (승인 후) | 90 | 70 | 95 | 50 | **82** | ✅ Yellow approval 직후 |
| 5 | Red #1: GTM Production publish (landing capture 강화) | TJ | ❌ | 85 | 50 | 90 | 80 | **75** | ⚠️ Red 승인 후 |
| 6 | Red #2: 8 PURCHASE primary 정리 (UA 4개 deprecate 후보) | TJ + Claude Code | 부분 | 70 | 40 | 90 | 80 | **72** | ⚠️ Red 별도 sprint |

## 산출 paths (이번 sprint)

- `gdn/google-ads-click-id-capture-root-cause-20260514.md` (본 문서)
- `data/project/google-ads-click-id-capture-root-cause-20260514.json`
- `gdn/google-ads-click-id-capture-fix-approval-20260514.md`
- `data/project/google-ads-click-id-capture-fix-approval-20260514.json`
- `gdn/google-ads-purchase-primary-inventory-20260514.md`
- `data/project/google-ads-purchase-primary-inventory-20260514.json`

## 참고

- 어제 post-check: [google-ads-bi-confirmed-purchase-offline-postcheck-20260514.md](google-ads-bi-confirmed-purchase-offline-postcheck-20260514.md)
- 어제 no-send dry-run: [google-ads-confirmed-purchase-no-send-quality-20260514.md](google-ads-confirmed-purchase-no-send-quality-20260514.md)
- 5/10 baseline: `data/bi-confirmed-purchase-operational-dry-run-20260510-last30.json`
- TechSol audit: [techsol-gads-npay-click-conversion-audit-20260510.md](techsol-gads-npay-click-conversion-audit-20260510.md)
- option3 결정: [google-ads-techsol-secondary-off-preaudit-or-result-20260511.md](google-ads-techsol-secondary-off-preaudit-or-result-20260511.md)
