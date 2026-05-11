# SEO 데이터 위치 인벤토리

작성 시각: 2026-05-01 10:30 KST
최근 업데이트: 2026-05-11 19:40 KST (gpt0508-45 — 로컬DB + VM Cloud 테이블 + 싱크 주기 추가)
문서 성격: 데이터 위치 관리 기준판
적용 범위: `seo` 저장소의 주요 분석 데이터 파일, 외부 데이터 소스, 운영 DB/로컬 DB/VM Cloud SQLite 위치
관리 원칙: 데이터 파일을 하나로 합치지 않는다. 위치, 용도, 정본성, 신선도, 개인정보 민감도를 관리한다.
DB 명칭: CLAUDE.md 의 3 분류 (VM Cloud / 운영DB / 로컬DB) 그대로. `운영pg / 원격 PG / operational PG` 표현 금지.

## 왜 필요한가

현재 프로젝트는 GA4 BigQuery, Imweb API, 운영DB (개발팀 supabase Postgres), 로컬DB SQLite (TJ 맥북), VM Cloud SQLite (att.ainativeos.net), 아임웹 엑셀, 광고 CSV가 같이 쓰인다. 파일/테이블 위치를 문서로 고정하지 않으면 같은 데이터를 다시 요청하거나, stale 파일을 정본으로 쓰는 실수가 생긴다.

따라서 이 문서를 "데이터가 어디에 있는지" 보는 기준판으로 둔다.

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
| `imweb_orders` | 80,331 | 13,970 | `https://api.imweb.me/v2/shop/orders` | 수동 `POST /api/crm-local/imweb/sync-orders` | **매출 join bridge** — `order_no` + `order_code` 모두 보유 |
| `imweb_order_items` | — | 96,304 | imweb v2 주문 상세 | 주문 sync 후 followup | 라인아이템 캐시 |
| `imweb_coupon_masters` | — | 888 | `https://api.imweb.me/v2/shop/coupons` | 수동 `POST /api/crm-local/imweb/sync-coupons` | 쿠폰 마스터 |
| `imweb_issue_coupons` | — | 2,654 | `https://api.imweb.me/v2/shop/issue-coupons/{code}` | 쿠폰 sync 후 백필 | 발행 쿠폰 |

## A3. attribution / tracking (실시간 fan-out)

| 테이블 | 로컬DB | VM Cloud | source 트리거 | 싱크 주기 | 비고 |
|---|---:|---:|---|---|---|
| `attribution_ledger` | 992 | 30,736 | `POST /api/attribution/*` 모든 endpoint | 실시간 | tt / meta / payment_success / checkout / marketing_intent 등 모든 attribution event |
| `order_bridge_ledger` | 0 | 11 | `POST /api/attribution/payment-success` 의 R2 wire | 실시간 (canary 시점만 신규) | gpt0508-37 부터 |
| `paid_click_intent_ledger` | 0 | 3,863 | `POST /api/attribution/paid-click-intent/no-send` | 실시간 (sample rate 적용) | 광고 click 보존, hash only |
| `site_landing_ledger` | (테이블 없음) | **141** | fan-out from `marketing-intent / checkout-context / payment-success / paid-click-intent` + 직접 `POST /api/attribution/site-landing` | 실시간 | **본 sprint 신규** (gpt0508-41~45) |
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
| `imweb_orders` | 로컬 80,331 > VM 13,970 — VM 은 부분 sync | **로컬DB** (백필 풍부) |
| `site_landing_ledger` | 로컬 없음, VM 141 | **VM Cloud** |
| `order_bridge_ledger` | 로컬 0, VM 11 | **VM Cloud** |
| `paid_click_intent_ledger` | 로컬 0, VM 3,863 | **VM Cloud** |
| `attribution_ledger` | 로컬 992, VM 30,736 | **VM Cloud** |
| `aibio_customers` | 로컬 1,074, VM 0 | **로컬DB** (sync 진행 중) |
| `tiktok_pixel_events` | 로컬 2 (테스트), VM 3,375 | **VM Cloud** |

**원칙**: 실시간 incoming (attribution / tracking / NPay / pixel) 은 **VM 이 source of truth**. imweb / coupang 같은 외부 API sync 는 **로컬DB 가 더 풍부** (백필 진행 위치).

## A14. 매출 join bridge (gpt0508-45 검증)

`site_landing_ledger.landing_url` → parse `order_code=` → JOIN `imweb_orders.order_code` → `imweb_orders.order_no` → JOIN 운영DB `tb_iamweb_users.order_number` → 결제완료 + 매출 합계. 첫 4건 매칭 / **₩55만 1,000** 검증.
산출: `gdn/site-landing-revenue-join-v2-bridge-success-20260511.md`.

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

# Part C. 다음 보완 후보 (gpt0508-45 추가)

- 운영DB `dashboard.public` 스키마 의 다른 테이블 (예: `tb_iamweb_users / tb_imweb_orders / tb_playauto_orders / tb_imweb_member / tb_sales_toss`) 도 동일 양식으로 inventory 추가.
- cron 주기 정확한 schedule 확인 (`backend/scripts/aios-agent-runner.ts` + crontab).
- 본 문서를 `data/` 의 정본 inventory 로 유지하고 `dbstructure.md` 와 cross-link.
