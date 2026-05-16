# SEO 데이터 위치 인벤토리

작성 시각: 2026-05-01 10:30 KST
최근 업데이트: 2026-05-16 19:33 KST (funnel-health landing 기준 + VM Cloud/운영DB/로컬DB 테이블 기준 정리)
문서 성격: 데이터 위치 관리 기준판
적용 범위: `seo` 저장소의 주요 분석 데이터 파일, 외부 데이터 소스, 운영 DB/로컬 DB/VM Cloud SQLite 위치
관리 원칙: 데이터 파일을 하나로 합치지 않는다. 위치, 용도, 정본성, 신선도, 개인정보 민감도를 관리한다.
DB 명칭: CLAUDE.md 의 3 분류 (VM Cloud / 운영DB / 로컬DB) 그대로. `운영pg / 원격 PG / operational PG` 표현 금지.

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
  lane: Green
  allowed_actions:
    - read_only_live_api_check
    - read_only_vm_cloud_sqlite_count_check
    - documentation_update
  forbidden_actions:
    - operating_db_write
    - vm_cloud_schema_migration
    - platform_send_or_upload
    - gtm_publish
  source_window_freshness_confidence:
    source: VM Cloud funnel-health API + VM Cloud SQLite read-only
    window: 24h / 7d checkpoint
    freshness: 2026-05-16 19:26~19:33 KST 확인
    confidence: high for table location and funnel source rule, medium_high for attribution interpretation
```

## 왜 필요한가

현재 프로젝트는 GA4 BigQuery, Imweb API, 운영DB (개발팀 supabase Postgres), 로컬DB SQLite (TJ 맥북), VM Cloud SQLite (att.ainativeos.net), 아임웹 엑셀, 광고 CSV가 같이 쓰인다. 파일/테이블 위치를 문서로 고정하지 않으면 같은 데이터를 다시 요청하거나, stale 파일을 정본으로 쓰는 실수가 생긴다.

따라서 이 문서를 "데이터가 어디에 있는지" 보는 기준판으로 둔다.

---

## 0. 데이터 테이블 기준 — 질문별로 먼저 볼 원장

이 섹션은 숫자를 볼 때 “어느 테이블을 먼저 믿을지”를 고정한다. 하나의 DB를 모든 질문의 정답으로 쓰지 않는다.

### 0.1 DB 이름 고정

| 이름 | 뜻 | 대표 위치 | 절대 헷갈리면 안 되는 점 |
|---|---|---|---|
| 운영DB | 개발팀이 관리하는 Supabase/PostgreSQL dashboard DB | `dashboard.public.tb_iamweb_users` 등 | Codex/TJ VM Cloud와 다르다. write/import는 사전 승인 없이는 금지 |
| VM Cloud | TJ님이 관리하는 att.ainativeos.net 수집/보조 원장 | `/home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3` 및 현재 동일 row 수를 보이는 `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3` | 실시간 tracking, CAPI log, funnel-health의 주 원장 |
| 로컬DB | 이 맥북 안의 분석/백필 DB | `/Users/vibetj/coding/seo/backend/data/crm.sqlite3` | 백필/분석은 풍부할 수 있으나 live 수신 정본은 아님 |

### 0.2 질문별 primary / cross-check / 금지 proxy

| 질문 | primary source | cross-check / fallback | 단위 | 금지 proxy / 주의 |
|---|---|---|---|---|
| 방문/유입 수 | VM Cloud `site_landing_ledger` | `attribution_ledger.marketing_intent`는 fallback/diagnostic | first-party landing row | Meta/Google/Naver 플랫폼 클릭수와 같은 값으로 보지 않는다 |
| 결제 시작/결제 페이지 진입 | VM Cloud `attribution_ledger`의 `checkout_started` + `payment_page_seen` | Browser pixel `InitiateCheckout/AddPaymentInfo`는 보조 | event row | 실제 구매완료가 아니다. 중복/재방문/결제 페이지 artifact 가능 |
| 실제 결제완료 수/금액 — biocom | VM Cloud `attribution_ledger payment_success confirmed`는 실시간 dashboard 기준 | 운영DB `dashboard.public.tb_iamweb_users PAYMENT_COMPLETE`, Toss direct, Imweb direct | unique order에 가까운 confirmed ledger row | footer/browser 신호 단독 구매 확정 금지 |
| 실제 결제완료 수/금액 — thecleancoffee NPay | VM Cloud `imweb_orders(site='thecleancoffee')` + Imweb v2 source + status/cancel/freshness guard | GA4 BigQuery는 already_in_ga4 guard, 운영DB coffee match는 cross-check | order row | GA4 purchase revenue를 NPay actual source로 쓰지 않는다 |
| 광고 클릭/주문 연결 evidence | VM Cloud `paid_click_intent_ledger`, `site_landing_ledger`, `attribution_ledger` UTM/referrer/click-id evidence | GA4, Search Console, Naver Search Advisor는 aggregate 참고 | evidence row / aggregate | 클릭/intent/add_payment_info를 구매완료로 승격 금지 |
| Meta CAPI 전송 상태 | VM Cloud Meta CAPI send log reader + `funnel-health.meta_capi_breakdown` | Meta Events Manager UI, Ads Manager는 지연 가능 | send attempt / event_id | site별 Pixel 필터 필수. all_sites 합산을 biocom으로 착각 금지 |
| ROAS | 내부 confirmed ROAS는 VM Cloud/운영DB 결제완료 기준, Ads ROAS는 플랫폼 주장값 | Meta Ads Insights, Google Ads API, Naver/TikTok exports | 매출/광고비 비율 | 플랫폼 주장 매출과 내부 actual 매출을 합산 금지 |

### 0.3 site별 Pixel/CAPI 필터

| site | Meta Pixel ID | 기본 규칙 |
|---|---|---|
| `biocom` | `1283400029487161` | biocom funnel-health/CAPI success는 이 Pixel만 집계 |
| `thecleancoffee` | `1186437633687388` | coffee funnel-health/CAPI success는 이 Pixel만 집계 |
| `all_sites` | 위 Pixel 전체 | 전체 합산 모드에서만 허용. 사이트별 ROAS 화면에는 자동 합산 금지 |

### 0.4 모든 숫자 보고 시 필수 메타데이터

숫자는 항상 아래 5개를 같이 남긴다.

- `source`: 운영DB / VM Cloud / 로컬DB / 외부 API 중 어디인지
- `window`: 24h / 7d / 30d / 특정 날짜 범위
- `freshness`: 조회 시각, 캐시 기준 시각, sync lag
- `site`: biocom / thecleancoffee / all_sites
- `confidence`: high / medium_high / medium / low 와 이유

---

# Part A. SQLite 테이블 인벤토리 (로컬DB + VM Cloud)

> 본 part 는 gpt0508-45 (2026-05-11) 추가. 두 SQLite (로컬DB / VM Cloud) 의 테이블, row 수, 싱크 주기를 한 곳에 정리.

## A1. 전체 테이블 분포 요약 (48 테이블)

| 카테고리 | 테이블 수 | 핵심 |
|---|---:|---|
| imweb sync (회원/주문/쿠폰) | 5 | `imweb_members / imweb_orders / imweb_order_items / imweb_coupon_masters / imweb_issue_coupons` |
| attribution / tracking (실시간) | 5 | `attribution_ledger / order_bridge_ledger / paid_click_intent_ledger / site_landing_ledger / npay_intent_log` |
| Toss / NPay 결제 정합성 | 2 | `toss_transactions / toss_settlements` |
| Coupang | 3 | `coupang_settlements_api / coupang_rg_orders_api / coupang_ordersheets_api` |
| AIBIO 리커버리랩 | 7 | `aibio_customers / aibio_payments / aibio_native_leads / aibio_native_lead_status_log / aibio_contact_events / aibio_contact_tasks / aibio_contact_audit_log` |
| 더클린커피 (커피) | 6 | `coffee_orders_excel / coffee_payments_excel / coffee_subscriber_track / coffee_subscriber_track_log / coffee_npay_intent_log / coffee_npay_intent_smoke_windows / coffee_notification_log` |
| TikTok ads + pixel | 3 | `tiktok_pixel_events / tiktok_ads_daily / tiktok_ads_campaign_range` |
| CRM 실험 / 세그먼트 / 메시지 | 11 | `crm_experiments / crm_assignment_log / crm_consent_log / crm_consent_change_log / crm_conversion_log / crm_customer_groups / crm_customer_group_members / crm_lead_profile / crm_lead_event_log / crm_message_log / crm_saved_segments / crm_scheduled_send` |
| refund / 메타 | 2 | `refund_dispatch_log / schema_versions` |

## A2. imweb sync (회원/주문/쿠폰)

| 테이블 | 로컬DB row | VM Cloud row | source | 싱크 주기 / 트리거 | 비고 |
|---|---:|---:|---|---|---|
| `imweb_members` | 84,563 | 83,277 | `https://api.imweb.me/v2/site/members` | 수동 `POST /api/crm-local/imweb/sync-members` | 3 사이트 통합 (`site` 컬럼) |
| `imweb_orders` | 80,331 | 14,775 | `https://api.imweb.me/v2/shop/orders` | 수동 `POST /api/crm-local/imweb/sync-orders` | **매출 join bridge** — `order_no` + `order_code` 모두 보유. VM Cloud row는 2026-05-16 19:33 KST read-only count |
| `imweb_order_items` | — | 96,304 | imweb v2 주문 상세 | 주문 sync 후 followup | 라인아이템 캐시 |
| `imweb_coupon_masters` | — | 888 | `https://api.imweb.me/v2/shop/coupons` | 수동 `POST /api/crm-local/imweb/sync-coupons` | 쿠폰 마스터 |
| `imweb_issue_coupons` | — | 2,654 | `https://api.imweb.me/v2/shop/issue-coupons/{code}` | 쿠폰 sync 후 백필 | 발행 쿠폰 |

## A3. attribution / tracking (실시간 fan-out)

| 테이블 | 로컬DB | VM Cloud | source 트리거 | 싱크 주기 | 비고 |
|---|---:|---:|---|---|---|
| `attribution_ledger` | 992 | 33,814 | `POST /api/attribution/*` 모든 endpoint | 실시간 | tt / meta / payment_success / checkout / marketing_intent 등 모든 attribution event. VM Cloud row는 2026-05-16 19:33 KST read-only count |
| `order_bridge_ledger` | 0 | 11 | `POST /api/attribution/payment-success` 의 R2 wire | 실시간 (canary 시점만 신규) | gpt0508-37 부터 |
| `paid_click_intent_ledger` | 0 | 3,863 | `POST /api/attribution/paid-click-intent/no-send` | 실시간 (sample rate 적용) | 광고 click 보존, hash only |
| `site_landing_ledger` | (테이블 없음) | **10,399** | fan-out from `marketing-intent / checkout-context / payment-success / paid-click-intent` + 직접 `POST /api/attribution/site-landing` | 실시간 | funnel-health landing primary. VM Cloud row는 2026-05-16 19:33 KST read-only count |
| `npay_intent_log` | 0 | 1,204 | `POST /api/attribution/npay-intent` | 실시간 | NPay click intent |

## A4. Toss / NPay 결제 정합성

| 테이블 | 로컬DB | VM Cloud | source | 싱크 주기 | 비고 |
|---|---:|---:|---|---|---|
| `toss_transactions` | 39,087 | 40,819 | Toss API (또는 imweb 발 NPay) | 수동 또는 cron | Toss PG 거래 |
| `toss_settlements` | — | 34,153 | Toss Settlements API | 일 1회 추정 | 정산 |

## A5. Coupang

| 테이블 | 로컬DB | VM Cloud | source | 싱크 주기 | 비고 |
|---|---:|---:|---|---|---|
| `coupang_ordersheets_api` | — | (table 만) | Wing Open API ordersheets | 수동 | |
| `coupang_rg_orders_api` | 11,078 | 11,078 | Wing Open API rg/orders | 수동 또는 일 1회 | BIOCOM + TEAMKETO 계정 |
| `coupang_settlements_api` | — | 106 | Wing Open API settlements | 월 1회 | |

## A6. AIBIO 리커버리랩

| 테이블 | 로컬DB | VM Cloud | source | 싱크 주기 | 비고 |
|---|---:|---:|---|---|---|
| `aibio_customers` | 1,074 | 0 | AIBIO Supabase 별도 인스턴스 (`AIBIO_SUPABASE_*`) | sync_design 별 | `aibio/aibio_sync_design.md` 참조 |
| `aibio_payments` | — | 0 | AIBIO Supabase `payments` | sync_design 별 | 음수 amount = 환불 |
| `aibio_native_leads` | — | 0 | AIBIO Supabase native_leads | sync_design 별 | |
| `aibio_native_lead_status_log` | — | (table 만) | AIBIO ledger | sync_design 별 | |
| `aibio_contact_events / tasks / audit_log` | — | (table 만) | AIBIO Supabase | sync_design 별 | |

## A7. 더클린커피 (커피)

| 테이블 | 로컬DB | VM Cloud | source | 싱크 주기 | 비고 |
|---|---:|---:|---|---|---|
| `coffee_orders_excel` | — | 0 | TJ 매주 엑셀 업로드 | 수동 (~주 1회) | `data/!coffee_excel_backfill_plan.md` |
| `coffee_payments_excel` | — | (table 만) | 동일 | 수동 | |
| `coffee_subscriber_track` | — | 0 | imweb_orders + 정기구독 cron | cron + 알림톡 6종 | `data/!coffee_subscriber_ops.md` |
| `coffee_subscriber_track_log` | — | (table 만) | event log | 실시간 | |
| `coffee_npay_intent_log` | — | (table 만) | NPay click 더클린커피 | 실시간 | |
| `coffee_npay_intent_smoke_windows` | — | (table 만) | smoke test window | 실시간 | |
| `coffee_notification_log` | — | (table 만) | 알림톡 발송 log | 실시간 | |

## A8. TikTok

| 테이블 | 로컬DB | VM Cloud | source | 싱크 주기 | 비고 |
|---|---:|---:|---|---|---|
| `tiktok_pixel_events` | 2 | 3,375 | `POST /api/attribution/tiktok-pixel-event` | 실시간 | TikTok pixel event mirror |
| `tiktok_ads_daily` | — | 0 | TikTok Ads API | 일 1회 추정 | 캠페인 일별 |
| `tiktok_ads_campaign_range` | — | (table 만) | TikTok Ads | 일 1회 추정 | 캠페인 범위 |

## A9. CRM 실험 / 세그먼트 / 메시지

| 테이블 | source | 싱크 주기 | 비고 |
|---|---|---|---|
| `crm_experiments` | 수동 정의 | 수동 | A/B 또는 leadmagnet 실험 |
| `crm_assignment_log` | experiment assignment | 실시간 | |
| `crm_consent_log / change_log` | imweb_members consent | 실시간 + 변경 시 | |
| `crm_conversion_log` | crm 전환 이벤트 | 실시간 | |
| `crm_customer_groups / group_members` | 수동 정의 / 자동 segment | 수동 + 자동 | |
| `crm_lead_profile / lead_event_log` | lead magnet 데이터 | 실시간 | |
| `crm_message_log` | 알림톡 / 카카오비즈 발송 log | 실시간 | |
| `crm_saved_segments / scheduled_send` | 수동 정의 | 수동 | |

## A10. 메타 + refund

| 테이블 | 비고 |
|---|---|
| `schema_versions` | 마이그레이션 버전 추적 |
| `refund_dispatch_log` | 환불 dispatch 기록 |
| `sqlite_sequence` | SQLite 자동 시퀀스 (시스템) |

## A11. 싱크 주기 4 분류 요약

| 분류 | 테이블 | 예시 주기 |
|---|---|---|
| **실시간 (event-driven)** | attribution_ledger / order_bridge_ledger / paid_click_intent_ledger / site_landing_ledger / npay_intent_log / tiktok_pixel_events / crm_*_log / coffee_subscriber_track_log / coffee_notification_log / refund_dispatch_log | endpoint 호출 즉시 INSERT |
| **수동 (TJ 명령)** | imweb_members / imweb_orders / imweb_order_items / imweb_coupon_masters / imweb_issue_coupons / coupang_rg_orders_api / coffee_orders_excel | `POST /api/crm-local/imweb/sync-*` |
| **자동 cron (예상, 코드 확인 필요)** | toss_transactions (일 1회) / toss_settlements (일 1회) / tiktok_ads_daily (일 1회) / coupang_settlements_api (월 1회) / coffee_subscriber_track (cron) | `backend/scripts/aios-agent-runner.ts` cron agent |
| **AIBIO sync_design 별** | aibio_* | `aibio/aibio_sync_design.md` 참조 |

## A12. site 별 분리

`site` 컬럼이 있는 테이블 (대부분 attribution / tracking / imweb sync) 는 `'biocom' / 'thecleancoffee' / 'aibio'` 3 값으로 구분. gpt0508-45 부터 `site_landing_ledger` 도 동일 적용.

## A13. 로컬DB vs VM Cloud 차이

| 테이블 | 차이 | source of truth |
|---|---|---|
| `imweb_members` | 로컬 84,563 > VM 83,277 | **로컬DB** |
| `imweb_orders` | 로컬 80,331 > VM 14,775 — VM 은 부분 sync | **로컬DB** (백필 풍부) |
| `site_landing_ledger` | 로컬 없음, VM 10,399. 2026-05-16 19:26 KST live API 기준 biocom 24h landing 2,949 / coffee 24h 80 / all_sites 7d 10,390 | **VM Cloud** |
| `order_bridge_ledger` | 로컬 0, VM 11 | **VM Cloud** |
| `paid_click_intent_ledger` | 로컬 0, VM 3,863 | **VM Cloud** |
| `attribution_ledger` | 로컬 992, VM 33,814 | **VM Cloud** |
| `aibio_customers` | 로컬 1,074, VM 0 | **로컬DB** (sync 진행 중) |
| `tiktok_pixel_events` | 로컬 2 (테스트), VM 3,375 | **VM Cloud** |

**원칙**: 실시간 incoming (attribution / tracking / NPay / pixel) 은 **VM 이 source of truth**. imweb / coupang 같은 외부 API sync 는 **로컬DB 가 더 풍부** (백필 진행 위치).

주의: "VM row 수"와 "funnel-health window count"는 다르다. 예를 들어 `site_landing_ledger` 전체 row는 2026-05-16 19:33 KST 기준 10,399건이지만, `/api/attribution/funnel-health?site=biocom&window=1d`의 landing count는 같은 시점 2,949건이다. 화면/ROAS 판단에는 항상 window count를 쓴다.

## A14. 매출 join bridge (gpt0508-45 검증)

`site_landing_ledger.landing_url` → parse `order_code=` → JOIN `imweb_orders.order_code` → `imweb_orders.order_no` → JOIN 운영DB `tb_iamweb_users.order_number` → 결제완료 + 매출 합계. 첫 4건 매칭 / **₩55만 1,000** 검증.
산출: `gdn/site-landing-revenue-join-v2-bridge-success-20260511.md`.

## A15. NPay summary source rule (gpt0508-46~49)

`/api/attribution/site-landing/summary`의 NPay 매출은 아래 순서로 해석한다.

| 역할 | source | 쓰는 방식 |
|---|---|---|
| 실제 결제완료 primary (biocom) | 운영DB `public.tb_iamweb_users` + `payment_method='NAVERPAY_ORDER'` + `payment_status='PAYMENT_COMPLETE'` + 취소/반품 제외 + 금액 양수 | biocom 예산/매출 판단에 쓰는 actual confirmed 기준 |
| 실제 결제완료 primary candidate (thecleancoffee, gpt0508-49 live patch) | VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3` `imweb_orders(site='thecleancoffee', pay_type='npay')` + `order_time >= now-30d` + `payment_amount > 0` + `imweb_status NOT IN ('CANCEL','RETURN','EXCHANGE')` | coffee NPay actual included 후보. `included_with_warning`으로 status blank와 freshness warning을 반드시 같이 표시 |
| bridge source | VM Cloud 또는 로컬DB `imweb_orders.order_code/order_no` | `site_landing_ledger`와 주문 원장을 이어주는 연결 증거 |
| diagnostic source | VM Cloud SQLite `imweb_orders.imweb_status`, `raw_json.orderStatus`, `complete_time` | lifecycle/freshness 진단용. actual purchase 단독 판정 금지 |
| freshness source | 운영DB PostgreSQL `dashboard.public.tb_iamweb_users.order_date/payment_complete_time`, VM Cloud SQLite `imweb_orders.synced_at/imweb_status_synced_at` | 최신성 경고와 sync lag 원인 분해. coffee는 status sync 6시간 초과 시 warning |
| forbidden proxy | `complete_time` 공백만으로 미결제 판정, `imweb_status` 단독 결제완료 판정, NPay click/count/add_payment_info 구매 승격 | 금지 |

현재 구현 규칙:

- 기존 `derived.npay_revenue_30d`는 화면 호환용 legacy 값이다. 내부 기준은 `derived.npay_revenue_30d_complete_time_legacy`로 명시한다.
- 새 기준은 `derived.npay_revenue_30d_actual_confirmed`다. biocom은 운영DB PostgreSQL `dashboard.public.tb_iamweb_users` actual confirmed aggregate를 붙인다. thecleancoffee는 gpt0508-49 live patch 기준으로 VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3` `imweb_orders` actual candidate를 `included_with_warning`으로 주입한다. 2026-05-13 00:57 KST post-snapshot 기준 coffee는 309건 / 14,902,800원, status blank 14건 / 944,900원이며 source는 `imweb_v2_vm_cloud_imweb_orders`다. 2026-05-13 02:02 KST latest read-only 기준은 coffee 311건 / 14,970,600원, status blank 16건 / 1,012,700원이다.
- `derived.npay_revenue_30d_bridge_pending`은 complete_time 공백 row를 "미결제"로 보지 않고, 운영DB 주문 단위 bridge가 필요한 row로 표시한다.
- VM Cloud SQLite `imweb_orders`는 부분 sync 원장이므로 `synced_at`과 `imweb_status_synced_at`을 같이 표시한다. 2026-05-13 02:02 KST status blank 16건은 모두 `imweb_status_synced_at` marker가 없고 최신 status sync 이후 order sync로 들어왔으므로 `source_freshness_gap/status sync lag`로 분류한다.
- GA4 BigQuery는 `already_in_ga4` guard로만 쓰고, NPay actual revenue source로 쓰지 않는다.

## A16. funnel-health / total 화면 데이터 계약 (2026-05-16 반영)

`/api/attribution/funnel-health`와 `/total` 계열 화면은 아래 계약을 따른다.

| 화면 지표 | source | unit | 기준 |
|---|---|---|---|
| landing / 유입 | VM Cloud `site_landing_ledger` | first-party landing row | `site_landing_evidence.applied_to_funnel_landing=true`이면 이 값을 퍼널 첫 단계로 사용 |
| legacy landing fallback | VM Cloud `attribution_ledger.marketing_intent` | marketing intent event row | `site_landing_ledger` evidence가 없을 때만 fallback. 지금은 diagnostic 값 |
| payment_started / 결제 시작 | VM Cloud `attribution_ledger` | event row | `checkout_started + payment_page_seen` 합산. 중복 가능 |
| confirmed_purchase / 결제완료 | VM Cloud `attribution_ledger payment_success confirmed` | ledger row ≈ order | 실시간 dashboard 기준. 운영DB/Toss/Imweb은 cross-check |
| meta_capi_success | VM Cloud Meta CAPI send log | send attempt / event_id | site별 Pixel ID로 필터. `all_sites`만 합산 허용 |
| browser_purchase | Browser pixel observation | pixel event | 현재 보조 진단. Server CAPI와 분리 표시 |
| Ads Manager ROAS | Meta Ads Insights API | ad-attributed purchase/value/spend | 광고 플랫폼 주장값. 내부 confirmed ROAS와 합산 금지 |

### A16.1 2026-05-16 19:26 KST live checkpoint

| site/window | landing | payment_started | confirmed_purchase | meta_capi_success | cache/source | confidence |
|---|---:|---:|---:|---:|---|---|
| biocom / 24h | 2,949 | 502 | 45 | 45 | `in_memory_precompute`, VM Cloud `site_landing_ledger` | high for source rule, medium_high for attribution |
| thecleancoffee / 24h | 80 | 60 | 19 | 21 | `in_memory_precompute`, VM Cloud `site_landing_ledger` | high for source rule, medium_high for attribution |
| all_sites / 7d | 10,390 | — | 701 | 685 | `in_memory_precompute`, VM Cloud `site_landing_ledger` | high for source rule, medium_high for attribution |

### A16.2 landing row 해석

`VM Cloud landing row`는 Meta/Google/Naver가 세는 클릭수가 아니다. 우리 VM Cloud가 고객의 랜딩 단계에서 받은 first-party 유입 장부 row다.

쉽게 말하면:

- 광고 플랫폼 클릭수: "광고 플랫폼이 클릭됐다고 주장하는 수"
- VM Cloud landing row: "우리 수집 서버에 실제 랜딩 신호로 들어온 수"
- 둘은 비슷한 방향으로 움직여야 하지만 1:1로 같을 필요는 없다.
- ROAS/퍼널 화면의 첫 단계는 광고 플랫폼 클릭수가 아니라 VM Cloud `site_landing_ledger`를 쓴다.

### A16.3 과소 집계 방지 규칙

이전 `funnel-health`는 `attribution_ledger.marketing_intent`만 landing으로 쓰면 biocom 24h landing이 5건처럼 보일 수 있었다. 2026-05-16 기준으로는 `site_landing_ledger`를 primary로 주입해 biocom 24h 2,949건을 퍼널 첫 단계로 쓴다.

앞으로 아래 상태가 보이면 즉시 원인 분리한다.

- `site_landing_evidence.applied_to_funnel_landing=false`: landing fallback 상태. 과소 집계 위험.
- `site_landing_evidence.total`이 0인데 광고비가 있음: capture/endpoint/Cloudflare route 점검.
- `attribution_ledger_marketing_intent_count`가 작음: 정상일 수 있음. 이 값은 현재 landing primary가 아니라 diagnostic.
- `meta_capi_success`가 사이트별 Pixel을 무시하고 all_sites 합산처럼 보임: Pixel filter regression.

---

# Part B. 더클린커피 아임웹 엑셀 (2026-05-01 작성, 유지)

확인 명령:

```bash
node - <<'NODE'
const fs = require('fs');
const path = require('path');
const XLSX = require('./backend/node_modules/xlsx');
for (const file of fs.readdirSync('data/coffee').filter(f => f.endsWith('.xlsx')).sort()) {
  const p = path.join('data/coffee', file);
  const wb = XLSX.readFile(p, { sheetRows: 10 });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  const header = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })[0] || [];
  console.log(file, Math.max(0, range.e.r - range.s.r), header.slice(0, 6).join(' / '));
}
NODE
```

| 파일 | 종류 | 데이터 행 | 고유 주문 | 기간 | 용도 | 상태 |
|---|---|---:|---:|---|---|---|
| `data/coffee/coffee_orders_2025.xlsx` | 아임웹 주문내역 | 16,454 | 11,018 | 2025-01-01 ~ 2025-12-31 | 2025 주문/LTV/배송/상품 원장 | 사용 가능 |
| `data/coffee/coffee_payments_2025.xlsx` | 아임웹 결제내역 | 11,341 | 11,018 | 2025-01-01 ~ 2026-01-01 | 2025 결제수단/환불/정산 원장 | 사용 가능 |
| `data/coffee/coffee_orders_2024.xlsx` | 아임웹 주문내역 | 2,800 | 1,987 | 2024-11-01 ~ 2024-12-31 | 2024 주문/LTV 원장 | 사용 가능 |
| `data/coffee/coffee_payments_2024.xlsx` | 아임웹 결제내역 | 2,044 | 1,987 | 2024-11-01 ~ 2024-12-31 | 2024 결제수단/환불/정산 원장 | 사용 가능 |
| `data/coffee/coffee_orders_2023.xlsx` | 아임웹 주문내역 | 0 | 0 | 없음 | 헤더 확인용 | 실제 데이터 없음 |
| `data/coffee/coffee_payments_2023.xlsx` | 아임웹 결제내역 | 0 | 0 | 없음 | 헤더 확인용 | 실제 데이터 없음 |

판단:

- 2024/2025 주문내역과 결제내역 엑셀은 이미 존재한다.
- 2023 파일은 존재하지만 데이터 행이 0개다. 현재 기준 추가 분석 원장으로 쓰지 않는다.
- `!coffeedata`에서 "2025 결제내역, 2024 주문/결제 엑셀 다운로드 필요"라고 되어 있으면 오래된 문구다.

## B1. 더클린커피 주요 외부/DB 소스

| 소스 | 위치/식별자 | 역할 | 정본성 | 주의 |
|---|---|---|---|---|
| Imweb v2 API | `IMWEB_API_KEY_COFFEE`, `IMWEB_SECRET_KEY_COFFEE` | 최신 주문 header/payment/channel_order_no | 운영 incremental primary | read-only 조회만 허용 |
| GA4 BigQuery | `project-dadba7dd-0229-4ff6-81c.analytics_326949178` | GA4 raw purchase, already_in_ga4 guard | GA4 raw primary | 광고 전송 판단에는 actual order와 대조 필요 |
| 운영DB Toss | `public.tb_sales_toss`, `store='coffee'` | Toss/card cross-check | cross-check | 일부 sync gap 가능 |
| 운영DB PlayAuto | `public.tb_playauto_orders`, `shop_name='아임웹-C'` | 상품명/배송상태 cross-check | cross-check | 결제금액 primary로 쓰지 않음 |
| 운영DB Imweb users | `public.tb_iamweb_users` | biocom 중심 기존 원장 | coffee primary 금지 | coffee order_no match 0건 확인 |
| 로컬DB SQLite | `backend/data/crm.sqlite3` | 로컬 분석/백필 결과 | fallback | stale 여부 확인 후 사용 |
| VM Cloud SQLite | `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3` `imweb_orders(site='thecleancoffee')` | coffee Imweb v2 수집/summary actual 후보 | primary candidate | partial sync. `synced_at/imweb_status_synced_at` freshness를 항상 같이 봄 |

## B2. 더클린커피 분석 스크립트

| 스크립트 | 용도 | 쓰기 여부 |
|---|---|---|
| `backend/scripts/coffee-imweb-operational-readonly.ts` | Imweb API, GA4, 운영DB read-only 대조 | write 없음 |
| `backend/scripts/coffee-ga4-robust-guard.ts` | order/channel id가 GA4 raw에 있는지 robust search | write 없음 |
| `backend/scripts/coffee-excel-import-dry-run.ts` | 엑셀을 DB에 넣지 않고 join/금액/결제수단/LTV 검증 | write 없음 |
| `backend/scripts/import-coffee-excel.cjs` | 로컬DB SQLite 실제 주문 엑셀 import | local DB write, 승인 필요 |
| `backend/scripts/import-coffee-payment-excel.cjs` | 로컬DB SQLite 실제 결제 엑셀 import | local DB write, 승인 필요 |

## B3. 파일명 규칙

더클린커피 아임웹 엑셀은 아래 표준 파일명을 사용한다.

```text
data/coffee/coffee_orders_YYYY.xlsx
data/coffee/coffee_payments_YYYY.xlsx
```

예전 문서에 `기본_양식_...xlsx`, `결제_내역_...xlsx`가 나오면, 현재 표준 파일명으로 rename된 것으로 본다.

## B4. 보안/PII 주의

아임웹 엑셀에는 이름, 전화번호, 이메일, 주소가 포함된다.

- 원본 엑셀 파일은 커밋/공유 정책을 별도 확인한다.
- 리포트에는 raw phone/email/address 샘플을 출력하지 않는다.
- 로컬DB import apply는 백업, dry-run, 승인 후에만 한다.
- 운영DB write와 외부 광고 전송은 이 문서 범위에서 금지다.

## B5. 다음 관리 작업

| 작업 | 이유 | 담당 |
|---|---|---|
| 2024/2025 통합 dry-run 결과 문서화 | 24개월 LTV/재구매 기준을 닫기 위해 | Claude Code |
| 2025 amount mismatch 397건 reason 분해 | 주문금액/결제금액 차이를 이해해야 LTV가 정확함 | Claude Code |
| 2023 헤더-only 상태 유지 또는 제거 판단 | 분석 대상이 아니면 혼동을 줄여야 함 | TJ + Claude Code |
| 신규 엑셀 다운로드 시 이 문서 갱신 | 중복 요청과 stale source 오판 방지 | 다운로드 수행자 |

---

# Part C. 운영DB `dashboard.public` 스키마 inventory (gpt0508-45 추가)

> 본 part 는 2026-05-11 별도 audit (멀티 에이전트 병렬 실행) 결과. 정본은 `gdn/operational-db-public-schema-inventory-20260511.md` + `data/operational-db-public-schema-inventory-20260511.json`. 본 part 는 핵심만 요약.

## C1. 전체 분포

| 분류 | 개수 |
|---|---:|
| 총 객체 | **89** (base table 75 + view 14) |
| 데이터 있음 | 56 |
| 비어 있음 / 0 row | 19 |

## C2. 우선 17 테이블 row 수 (최상위)

| 테이블 | row | 비고 |
|---|---:|---|
| `tb_playauto_orders` | 123,997 | PlayAuto 발송/주문 |
| `tb_iamweb_users` | 99,126 | imweb 주문 정본 (biocom 중심) |
| `tb_laplace` | 92,571 | **freshness 2025-11-04 stale** |
| `customer_report_info` | 35,882 | 고객 리포트 |
| `tb_sales_toss` | 34,298 | Toss 매출 |
| `tb_sales_coupang` | 21,006 | 쿠팡 매출 |
| `tb_teamketo_smartstore` | 11,031 | 스마트스토어 (teamketo) |
| `tb_sales_naver_vat` | 9,730 | 네이버 VAT |
| `tb_consultation_records` | 8,763 | 상담 기록 |
| `tb_naver_orders` | 4,251 | 네이버 주문 |
| `tb_sales_nicepay` | 3,959 | **2026-01-31 정체** |
| `transactions` | 1,751 | |
| `tb_teamketo_cafe24` | 834 | cafe24 (teamketo) |
| `tb_sales_recovery_lab` | 334 | **2026-01-31 정체** (AIBIO 매출) |
| `tb_iamweb_Products` | 53 | 상품 마스터 |
| `tb_iamweb_backfill_jobs` | 14 | **running 3건 2026-04-22 정체** |
| `tb_imweb_member` | 0 | **로컬DB 84,563 vs 운영DB 0** — 운영DB sync 미적재 |

## C3. 주요 발견 (다음 sprint 후보)

| 발견 | 의미 |
|---|---|
| `tb_iamweb_users.raw_data->>'site_code'` 99,126건 모두 NULL | site 키가 다른 path 에 있을 가능성 — 추가 조사 필요 |
| `tb_laplace` freshness 2025-11-04 | 6개월 stale, 사용 시 주의 |
| `tb_imweb_member` 운영DB 0건 vs 로컬DB 84,563건 | 운영DB 회원 sync 미진행 — `tb_iamweb_users.customer_*` 또는 별도 stream 사용 추정 |
| `tb_iamweb_backfill_jobs` running 3건 2026-04-22 정체 | 백필 job 멈춰있음 — 개발팀 협업 후보 |
| `tb_sales_nicepay` / `tb_sales_recovery_lab` 2026-01-31 정체 | 3 개월 sync 멈춤 |

## C4. NPay 매출 join 시도 결과 (gpt0508-45 액션)

- site_landing → imweb_orders → 운영DB `tb_iamweb_users` NAVERPAY_ORDER 매칭 **0건**.
- 원인: 운영DB NPay sync 9시간 lag (NPay max(order_date) = KST 09:47 vs CARD = KST 16:47).
- 후보 5건 (imweb_orders thecleancoffee NPay, KST 15:45~16:55 합계 ₩28만 200) 는 운영DB 미적재 시점.
- 부가 발견: site_landing 의 NPay 완료 URL 직접 capture 0건 (브라우저 referrer policy 가 path 자름) — imweb_orders bridge 필수.
- 정본: `gdn/site-landing-npay-channel-order-match-20260511.md`.

## C5. 다음 보완 후보

- cron 주기 정확한 schedule 확인 (`backend/scripts/aios-agent-runner.ts` + crontab).
- 본 문서를 `data/` 의 정본 inventory 로 유지하고 `dbstructure.md` 와 cross-link.
- `tb_iamweb_users.raw_data` JSON 내부 site 키 path 찾기 (운영DB site 분리 회복).
- `tb_imweb_member` 운영DB 미적재 회수 — 개발팀 협업.

## C6. Notion 업무포탈 운영DB 관리표 cross-check (2026-05-12)

> source: Notion 새 MCP `테이블 목록` data source (`collection://02756235-303c-48ef-92e4-db98ff252e3d`) read-only 검색. 실제 row 수 / freshness 는 운영DB read-only query 를 우선한다.

### C6-1. 새로 보강된 관리 컬럼

| Notion 컬럼 | 의미 | 이 인벤토리에서 쓰는 방식 |
|---|---|---|
| `API 수집 여부` | API로 수집되는 테이블인지, 엑셀/수동 업로드인지 | sync 가능성 1차 분류 |
| `API 채널명` | 아임웹 / 토스페이먼츠 / 플레이오토 / 네이버커머스 / 쿠팡 등 채널 | source group 보강 |
| `배치 주기` | 매일 1회 / 미사용(수동조회) 등 | freshness 기대값 산정 |
| `배치 시간` | 배치 실행 시각 | stale audit 기준 시각 |
| `스케줄러 잡 이름` | scheduler job 이름 | VM/backend cron grep 과 대조 |
| `설명` / `비고` | 사람이 이해하는 테이블 역할 | 테이블명만으로 모호한 역할 보강 |

### C6-2. 핵심 운영DB 테이블 Notion 관리값

| 운영DB 테이블 | 기존 row / 상태 | Notion API 수집 여부 | Notion 채널 | Notion 배치 | 스케줄러 잡 이름 | 판단 |
|---|---:|---|---|---|---|---|
| `tb_iamweb_users` | 99,126 | API 수집 테이블 | 아임웹 | 매일 1회, 16시 | `dashboard-iamweb-order-delivery-sync` | 기존 "imweb 주문 정본"에 배치 기준 추가. NPay lag audit 시 16시 기준을 같이 봐야 함 |
| `tb_imweb_member` | 0 | API 수집 테이블 | 아임웹 | 미사용(수동조회) | 없음 | 운영DB 0 row 와 충돌 아님. Notion상 "수동 1회성 API 데이터 수집"이라 active sync 로 보면 안 됨 |
| `tb_sales_toss` | 34,298 | API 수집 테이블 | 토스페이먼츠 | 매일 1회, 6시 | `sales-toss-sync` | Toss/card cross-check freshness 기준을 6시 배치로 보강 |
| `tb_playauto_orders` | 123,997 | API 수집 테이블 | 플레이오토 | 매일 1회, 5시 | `playauto-incremental-sync` | 배송/주문 상태 cross-check freshness 기준을 5시 배치로 보강 |
| `tb_naver_orders` | 4,251 | API 수집 테이블 | 네이버커머스 | 매일 1회, 16시 | `dashboard-naver-order-delivery-sync` | 네이버 배송 상태는 전일 16시-당일 16시 기준으로 해석 |
| `tb_sales_naver_vat` | 9,730 | API 수집 테이블 | 네이버커머스 | 매일 1회, 6시 | `sales-naver-vat-sync` | 네이버 VAT 매출 freshness 기준을 6시 배치로 보강 |
| `customer_report_info` | 35,882 | API 수집 테이블 | SIB(LIS) | 매일 1회, 3시 | `dashboard-customer-report-sync` | 검사데이터 / 상담분석 원장의 배치 기준 추가 |
| `tb_sales_coupang` | 21,006 | API 미수집 테이블 | (없음) | 없음 | 없음 | 엑셀 업로드 방식. API freshness 기대값을 두면 안 됨 |
| `tb_sales_nicepay` | 3,959 / 2026-01-31 정체 | API 미수집 테이블 | (없음) | 없음 | 없음 | 엑셀 업로드 방식이라 정체를 API 장애로 해석하지 않는다 |
| `tb_sales_recovery_lab` | 334 / 2026-01-31 정체 | API 미수집 테이블 | (없음) | 없음 | 없음 | 엑셀 업로드 방식. AIBIO 매출 freshness 는 별도 upload 이력 필요 |

### C6-3. 업데이트된 판단

- `cron 주기 정확한 schedule 확인` 후보는 일부 해소됐다. Notion 관리표 기준으로 아임웹/네이버 배송 상태는 16시, Toss/네이버 VAT 는 6시, PlayAuto 는 5시, SIB 검사데이터는 3시 배치다.
- `tb_imweb_member`는 Notion상 API 수집 테이블이지만 `미사용(수동조회)`다. 따라서 운영DB row 0건은 "정기 sync 실패"가 아니라 "현재 active sync 아님"으로 보는 것이 더 안전하다.
- `tb_sales_coupang`, `tb_sales_nicepay`, `tb_sales_recovery_lab`는 Notion상 API 미수집 테이블이다. stale freshness 는 API 장애가 아니라 엑셀/수동 업로드 중단 또는 미수행 가능성으로 분류한다.
- Notion 관리표에 `tb_laplace`는 검색되지 않았다. 기존 stale 판단은 유지하고, Notion 문서 누락 후보로 둔다.

---

# Part D. 외부 문서 원장 / 업무포탈 DB 관리 문서

> 본 part 는 실제 DB 테이블이 아니라, DB 테이블을 사람이 관리하고 찾기 위한 외부 문서 위치다. 운영DB / VM Cloud / 로컬DB 숫자와 섞지 않는다.

## D1. Notion 업무포탈 DB 테이블 관리

| 항목 | 값 |
|---|---|
| 문서 이름 | `[업무포탈] 전체 DB 테이블 관리` |
| 위치 | Notion |
| URL | `https://www.notion.so/35d1a1c96f9680e0afc5d6eea33cd68a` |
| 원본 공유 URL | `https://www.notion.so/DB-35d1a1c96f9680e0afc5d6eea33cd68a?source=copy_link` |
| 상위 DB | `Biocom Tech` |
| 상위 data source | `Biocom IT(26/2/6~)` |
| 포함 문서/DB | `테이블 목록` DB + inline database 1개 |
| 접근 확인 | 2026-05-12 20:36 KST, 새 Notion MCP read PASS |
| data source | `collection://02756235-303c-48ef-92e4-db98ff252e3d` |
| 주요 속성 | `테이블명`, `스키마명`, `용도`, `설명`, `API 수집 여부`, `API 채널명`, `배치 주기`, `배치 시간`, `스케줄러 잡 이름`, `비고` |
| 주의 | Notion은 관리 문서 원장이다. 실제 row 수 / freshness / 매출 정본은 운영DB read-only query 를 우선한다 |
| 정본성 | 업무포탈/문서 원장. 실제 row 수나 매출 정본은 각 DB/원장별 source of truth 를 따른다 |

판단:

- 이 Notion 문서는 DB 테이블을 운영자가 찾고 관리하기 위한 업무포탈 문서다.
- 새 Notion MCP 로 페이지 / data source / 핵심 운영DB 테이블 행을 읽을 수 있다.
- 실제 데이터 정본은 운영DB / VM Cloud / 로컬DB / 외부 API 별로 위 Part A-C 기준을 따른다.
- Notion 문서 내용을 코드나 sync 기준으로 쓰기 전에는 해당 DB의 live schema/read-only query 로 한 번 더 검증한다.
