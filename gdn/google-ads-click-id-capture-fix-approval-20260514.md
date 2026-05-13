# Google Ads · click id capture fix approval packet (2026-05-14)

## 목적
click id capture root-cause 조사 결과 도출된 fix 후보 9개를 **Green / Yellow / Red** 로 분류하고 TJ 승인 packet 으로 정리한다. 본 sprint 는 **실행 0건** — 분류와 설계만 한다.

## 한 줄 결론

- **Green 즉시 1건** (본 root-cause 산출, 이미 완료)
- **Yellow approval 5건** (snapshot refresh / intent matching / server gclid echo / snippet patch / GTM Preview)
- **Red approval 3건** (GTM Production publish / 8 PURCHASE primary 정리 / BI upload canary)

총 9건 중 어느 것도 본 sprint 에서 실행하지 않았다. TJ 가 Yellow/Red 우선순위를 결정해 다음 sprint approval 형태로 진행해야 한다.

## 의존 관계 그래프

```
Y-1 (snapshot refresh) ──┬→ Y-2 (intent matching)
                         ├→ Y-3 (server gclid echo)
                         └→ Y-4 (snippet patch)

Y-5 (GTM Preview) ──→ R-1 (GTM Production publish)

Y-1..Y-5 + R-1 ──→ R-3 (upload canary)

R-2 (8 primary 정리) — 독립
```

## 9 후보 표 (한눈에 보기)

| ID | Lane | Subject | Owner | 자신감 점수 | 의존 |
|---|---|---|---|---|---|
| G-1 | Green ✅ | root-cause + approval packet 산출 | Claude Code | DONE | — |
| Y-1 | Yellow | VM snapshot refresh cron (24h TTL) | Claude Code | 88 | — |
| Y-2 | Yellow | npay_intent → order matching pipeline | Claude Code | 86 | Y-1 |
| Y-3 | Yellow | server-side gclid echo (Meta CAPI 패턴) | Claude Code | 82 | Y-1, Y-2 |
| Y-4 | Yellow | Imweb attribution snippet patch (checkout→payment 보존) | Claude Code | 80 | Y-1 |
| Y-5 | Yellow | GTM Preview verification (landing trigger) | TJ + Claude Code | 78 | — |
| R-1 | Red | GTM Production publish (landing capture 강화) | TJ | 75 | Y-5 |
| R-2 | Red | 8 PURCHASE primary 정리 | TJ + Claude Code | 72 | — |
| R-3 | Red | BI upload canary (action 7609289411) | TJ | 68 | Y-1..Y-5, R-1 |

## Y-1 — VM snapshot refresh cron

| 항목 | 내용 |
|---|---|
| 원인 | RC-1. builder DEFAULT_VM_DB 가 `vm-npay-intent-20260505.sqlite3` (5/5 mtime) 9일 stale |
| script | `backend/scripts/vm-snapshot-refresh.ts` (신규) |
| source | `att.ainativeos.net /api/attribution/ledger/snapshot` |
| target | `backend/data/vm-attribution-snapshot.sqlite3` (atomic rename) |
| cron | 매일 KST 03:00 |
| TTL invariant | `vm_snapshot_age_hours <= 24` |
| fail-fast | 48h soft warn / 72h hard block |
| no-send invariant | upload 자동 발화 없음 — read-only 데이터 흐름만 갱신 |
| risk | TTL 너무 엄격하면 builder 멈춤 — 48/72h 단계 권장 |

## Y-2 — npay_intent → order matching pipeline

| 항목 | 내용 |
|---|---|
| 원인 | RC-4. npay_intent_log 820 rows / matched_order_no 0건 / match_status 모두 pending |
| 매칭 key 후보 (순서) | 1) intent_key · 2) page_location query merchant_uid · 3) page_location query orderNo · 4) (client_id + captured_at window 30min) → 운영DB order_date |
| match_status 전이 | pending → matched / unmatched / ambiguous |
| cron | 매 시간 (또는 builder pre-step) |
| dedupe | intent_key UNIQUE |
| risk | false-positive 매칭 — A/B/C confidence + ambiguous 처리 필요 |
| no-send | npay_intent_log.matched_order_no 컬럼만 갱신 |

## Y-3 — server-side gclid echo route

| 항목 | 내용 |
|---|---|
| 원인 | RC-5. fbclid 는 checkout 22.9% → payment 33.8% 서버 fill 작동. gclid 동등 채널 부재 |
| 위치 | `backend/src/routes/funnelCapi.ts` 안에 echo logic 추가 |
| 트리거 | payment_success event 수신 시점에 session cache (npay_intent_log 또는 site_landing_ledger) 의 gclid 를 attribution_ledger 에 fill |
| 매칭 키 | client_id + ga_session_id 일치 시만 fill |
| TTL | 30분 cache · 그 이후 unknown |
| risk | 잘못된 session 매칭 — ga_session_id 까지 일치하는 경우만 |

## Y-4 — Imweb attribution snippet patch

| 항목 | 내용 |
|---|---|
| 원인 | RC-3. checkout_started gclid 440 → payment_success 19 retention 4.3% |
| 파일 | `backend/src/imwebAttributionSnippet.ts` |
| 변경 | checkout → payment 사이 sessionStorage 또는 결제 redirect URL 에 gclid/gbraid/wbraid 보존 |
| 보존 방법 | 1) sessionStorage `google_click_id_v1` (TTL 30분) · 2) success URL 에 ?gclid=... 재첨부 (서버 echo 와 중복 안전) |
| risk | URL 노출 — sessionStorage 우선 |

## Y-5 — GTM Preview verification

| 항목 | 내용 |
|---|---|
| 원인 | RC-2. marketing_intent ledger 10,119 rows / gclid 0 |
| 단계 | 1) GTM Preview 모드에서 gclid 포함 광고 URL 진입 · 2) marketing_intent fire 시점 dataLayer 확인 · 3) query param read timing 확인 · 4) allowlist 에 gclid/gbraid/wbraid 모두 포함 확인 |
| owner | TJ (UI 작업) + Claude Code (분석) |
| no-send | Preview 단계 — Production publish 별도 R-1 |

## R-1 — GTM Production publish

| 항목 | 내용 |
|---|---|
| 차단 조건 | Y-5 Preview verification 결과 첨부 |
| ramp | 10% → 50% → 100% (GTM no canary, post-publish monitor) |
| rollback | GTM 이전 version revert |
| risk | GA4 / Meta CAPI / 기타 dispatch 영향 가능 — 사전 site_summary baseline lock |

## R-2 — 8 PURCHASE primary 정리

| 항목 | 내용 |
|---|---|
| 원인 | BI confirmed_purchase_offline 향후 primary 승격 결정 전 학습 신호 정리 |
| 후보 | UA Transaction 4개 (sunset since 2023-07) deprecate + GA4 imported 3개 secondary 강등 검토 + 구매완료 1개 유지 |
| 상세 | [google-ads-purchase-primary-inventory-20260514.md](google-ads-purchase-primary-inventory-20260514.md) |
| canary 기간 | 2주 권장 |
| risk | 입찰 학습 reset / ROAS 변동 가능 |

## R-3 — BI upload canary

| 항목 | 내용 |
|---|---|
| 차단 | Y-1~Y-5 + R-1 모두 완료 + fill-rate 50%+ + earliest_safe canary 도달 (2026-05-15 01:44 KST 이후 권장) |
| 현재 fill-rate | **1.03%** (canary 불가) |
| canary 사이즈 | 1일 5건 → 7일 50건 → 28일 500건 |
| rollback | ClickConversion adjustment_type=RETRACT 또는 action ENABLED=false |
| risk | 학습 신호 영향 · ROAS disruption — site_summary baseline 확보 필수 |

## invariants held (본 sprint)

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

## TJ 결정 필요

1. **Yellow 우선순위** — Y-1 ~ Y-5 중 어느 것부터 진행할지
2. **Red 별도 sprint 시점** — R-1 / R-2 / R-3 분리 일정
3. **Google Ads UI 재확인** — BI action click window 90→30 / view 3→1 mismatch (어제 post-check FAIL 항목)
