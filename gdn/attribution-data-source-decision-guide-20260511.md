# Attribution Data Source Decision Guide v1 (gpt0508-37 작업2)

작성 시각: 2026-05-11 01:00:00 KST
Lane: Green doc / 향후 모든 sprint 가 따르는 데이터 source 정본
자신감: 92%

## 한 줄 결론

**주문/결제 정본**(운영DB · 로컬DB · imweb 어드민)과 **광고 클릭-주문 연결 evidence**(VM Cloud Path B order_bridge_ledger · paid_click_intent_log)는 서로 다른 source요. 한쪽 0이 다른 쪽 0을 의미하지 않으니, 매 보고에서 **두 source를 분리해서 본다**는 규칙을 본 가이드 v1로 고정하오.

2026-05-12 Option C 추가: 운영DB `tb_iamweb_users PAYMENT_COMPLETE`는 **biocom NPay actual confirmed**에는 primary로 쓴다. 그러나 `thecleancoffee`는 `tb_iamweb_users` 안에서 site key가 증명되지 않고 VM Cloud `imweb_orders` coffee NPay 주문번호와 운영DB 주문번호 매칭도 0건이므로, `tb_iamweb_users` 결과를 coffee actual로 올리지 않는다.

2026-05-12 gpt0508-48 정정: 위 문장은 `tb_iamweb_users` 한정 결론이다. 더클린커피 actual source 자체는 있다. `IMWEB_API_KEY_COFFEE`/`IMWEB_SECRET_KEY_COFFEE`로 가져온 Imweb v2 API와 VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3` `imweb_orders(site='thecleancoffee')`는 coffee 주문만 분리되는 primary candidate다. live summary 반영 전에는 `pay_type='npay'`, `payment_amount > 0`, `imweb_status NOT IN ('CANCEL','RETURN','EXCHANGE')`, status freshness, status blank count를 함께 검증한다. GA4 BigQuery `analytics_326949178`은 결제 정본이 아니라 `already_in_ga4` guard로만 쓴다.

2026-05-13 gpt0508-49 live 패치: 더클린커피 summary API source는 `imweb_v2_vm_cloud_imweb_orders`로 배포했다. 필터는 VM Cloud SQLite `imweb_orders` 기준 `site='thecleancoffee'`, `pay_type='npay'`, `order_time >= now-30d`, `payment_amount > 0`, `imweb_status NOT IN ('CANCEL','RETURN','EXCHANGE')`다. status blank는 미결제 단정이 아니므로 `included_with_warning`에 포함하되 `status_blank_count/amount`와 status sync freshness warning을 화면에 같이 내려준다. 2026-05-13 00:57 KST post-snapshot 기준 coffee actual은 309건 / 14,902,800원, status blank는 14건 / 944,900원이다. 2026-05-13 02:02 KST latest read-only 기준 coffee actual은 311건 / 14,970,600원, status blank는 16건 / 1,012,700원이다. blank row는 VM Cloud SQLite `imweb_orders.imweb_status`가 비어 있고 `imweb_status_synced_at` marker가 없어, 현재 원인은 `source_freshness_gap/status sync lag`다.

## 1. DB 명칭 (CLAUDE.md와 동일)

| 명칭 | 운영자 | 위치 / 대표 객체 |
|---|---|---|
| **VM Cloud** | TJ (Cloudflare) | `att.ainativeos.net` SQLite — `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3`, `imweb_orders`, `order_bridge_ledger`, `paid_click_intent_log`, `npay_intent_log` |
| **운영DB** | 개발팀 (PostgreSQL) | `dashboard` 스키마 — `dashboard.public.tb_iamweb_users`, `tb_playauto_orders`, `tb_imweb_member` 등. read-only. |
| **로컬DB** | TJ 맥북 | `/Users/vibetj/coding/seo/backend/data/crm.sqlite3` — `imweb_orders`, `imweb_members`, `imweb_coupon_masters` |

“운영pg / 원격 PG / operational PG” 표현 금지.

## 2. 핵심 데이터 source 표

### 2.1 실제 결제완료 매출 (actual_paid_purchase)

| 우선순위 | source | 필터 |
|---|---|---|
| primary (biocom) | 운영DB PostgreSQL `dashboard.public.tb_iamweb_users` | `payment_status='PAYMENT_COMPLETE'` AND `cancellation_reason/return_reason` 빈값 AND `final_order_amount > 0` |
| primary candidate (thecleancoffee, live patch) | VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3` `imweb_orders(site='thecleancoffee')` | Imweb v2 API `type=npay` / `pay_type='npay'` / `payment_amount > 0` / 취소·반품·교환 status 제외 / status blank + freshness warning 표시 |
| secondary | 로컬DB `imweb_orders` | backend `/api/crm-local/imweb/sync-orders` 가 imweb v2 API에서 fetch한 row (헤더 중심, 라인아이템 없음) |
| fallback | imweb 어드민 | 사람 눈으로 직접 확인 (응급 cross-check) |

**금지 proxy:**
- GA4 purchase event 단독을 actual purchase로 사용 ❌
- VM Cloud complete_time blank-only를 NPay 미결제 판정으로 사용 ❌
- Google Ads platform conversion value를 internal 매출로 사용 ❌

### 2.2 NPay actual

| 우선순위 | source |
|---|---|
| primary (biocom) | 운영DB PostgreSQL `dashboard.public.tb_iamweb_users` WHERE `payment_method='NAVERPAY_ORDER' AND payment_status='PAYMENT_COMPLETE'` |
| primary candidate (thecleancoffee, live patch) | Imweb v2 / VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3` `imweb_orders(site='thecleancoffee', pay_type='npay')` + `payment_amount > 0` + 취소/반품/교환 status 제외 + status blank/freshness warning. 운영DB `tb_iamweb_users` actual included 금지 |
| secondary (미래) | VM Cloud `npay_intent_log` 의 strong_match — channel_order_no_hash schema canary 후 활성 |

금지 proxy:
- NPay click / count / add_payment_info를 actual purchase로 승격 ❌
- `thecleancoffee`를 운영DB `tb_iamweb_users` 결과에 site filter 없이 포함 ❌

### 2.3 Google Ads attribution exact evidence

| 우선순위 | source |
|---|---|
| primary | 운영DB order body의 `gclid/gbraid/wbraid` + Google Ads `click_view` exact (현재 31건) |
| primary (미래) | VM Cloud `order_bridge_ledger` same-order exact (Path B canary 누적 후) |
| primary (미래) | VM Cloud `paid_click_intent_log` same-order exact (`channel_order_no_hash` schema 추가 후) |

금지 proxy:
- UTM campaign hint 단독 (예: `utm_campaign='googleads_*'`) ❌
- time-window-only ❌
- `ga_session_id` 가 같은 시간대에 광고 click 있었음만으로 연결 ❌
- `page_referrer` 가 google 도메인이라는 이유만으로 연결 ❌

### 2.4 campaign_id budget floor

- exact evidence 보유 row만 campaign_id 매칭 + 캠페인 ROAS 안전한 하한(floor) 참고값
- 현재 31건 / ₩7,611,210
- “예산 판단의 안전한 하한”으로만 사용
- Google Ads upload 사용 ❌ (별도 Red 승인 필요)
- platform send 사용 ❌

### 2.5 upload candidate

- 현재 0건 (sprint invariant)
- 승격 조건: exact evidence 보유 + Red Lane 별도 승인 + 동의/검증 절차 통과

### 2.6 dashboard display

- `platform_roas_reference` — Google Ads 주장값, 참고용
- `internal_confirmed_roas_current` — google evidence 보유 row만 분자
- `internal_confirmed_roas_with_npay_actual_pg` — + NPay actual snapshot 합류 후 분자

플랫폼 주장값과 내부 매출값을 한 문단에서 섞을 때는 “예산 판단에 쓸 값 / 참고만 볼 값” 명시.

### 2.7 sync freshness

- 운영DB: `MAX(order_date)` + `sync_lag_minutes` 같이 노출 (gpt0508-37 작업 7에서 dashboard 응답에 추가 예정)
- VM Cloud ledger: `ledger_summary.fetched_at`
- 로컬DB: imweb sync cron 마지막 실행 시각

freshness 라벨이 없는 카운트는 “실시간”으로 오해될 수 있음. 항상 source 옆에 freshness 표시.

## 3. conflicting source 처리 규칙

| 충돌 시나리오 | 해석 / 다음 행동 |
|---|---|
| 운영DB 0건 vs imweb 어드민 5건 | 운영DB sync lag — imweb 어드민 또는 로컬DB sync 결과로 cross-check (예: gpt0508-36 작업6 정정에서 9시간 lag 확인) |
| ledger_summary row=0 vs payment-success endpoint 호출 4건+ | Path B endpoint가 결제 flow에서 호출되지 않음. R2 backend wire(gpt0508-37 작업4) 또는 GTM/footer fallback |
| Google Ads platform ROAS 9.58 vs internal 0.27 | platform 측 NPay click 오염 + internal NPay actual 누락의 합산. 옵션 3 + NPay 합류 둘 다 진행해야 정렬 |
| GA4 purchase 430건 vs 내부 confirmed 25건 (last_7d) | GA4 purchase는 actual purchase 아님. 내부 confirmed가 정본 |

## 4. 질문별 답변 source 순서

### 질문 1. “이번 분기/캠페인의 실제 매출은?”
1. 운영DB `tb_iamweb_users` PAYMENT_COMPLETE
2. 로컬DB `imweb_orders` (sync 후)
3. imweb 어드민 직접

항상 같이 표시: `MAX(order_date) freshness`, 환불/취소 제외 필터, currency=KRW.

### 질문 2. “이 매출 중 NPay는?”
1. biocom: 운영DB `tb_iamweb_users` WHERE `payment_method='NAVERPAY_ORDER' AND payment_status='PAYMENT_COMPLETE'`
2. thecleancoffee: 운영DB PostgreSQL `dashboard.public.tb_iamweb_users`는 actual source로 금지. 대신 Imweb v2 / VM Cloud SQLite `/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3` `imweb_orders(site='thecleancoffee', pay_type='npay')`를 primary candidate로 쓰고, 취소/반품/교환 status 제외 + status freshness + blank status count를 붙인다. gpt0508-49 live patch/test/deploy는 PASS이며, 현재 live summary included 상태는 `included_with_warning`이다.

항상 같이 표시: sync lag 라벨, NPay click 미포함 명시.

### 질문 3. “이 매출 중 Google Ads 캠페인이 들여보낸 손님은?”
1. 운영DB order body `gclid` + click_view exact (31건)
2. (미래) order_bridge_ledger same-order exact
3. (미래) paid_click_intent_log same-order exact

항상 같이 표시: exact evidence count, UTM hint는 진단만 명시.

### 질문 4. “Google Ads upload 가능한 row는?”
1. `upload_candidate_count` (현재 0, sprint invariant)

항상 같이 표시: upload는 Red 별도 승인 + exact evidence + 동의/검증 통과 필요.

## 5. Claude Code 매 sprint 자체 점검

다음 8가지를 매 sprint 결과보고 직전에 자체 확인.

1. 보고하는 매출 / 카운트 옆에 freshness / source가 적혀 있는가?
2. `internal_confirmed`와 `platform_reference`가 따로 표시되는가?
3. NPay click / count / add_payment_info가 actual purchase로 승격되지 않았는가?
4. UTM hint / time-window-only가 budget 판단에 쓰이지 않았는가?
5. ledger row=0만 보고 `NO_TRAFFIC` verdict 단정하지 않았는가? (4-signal decision tree 적용?)
6. raw email/phone/order/payment/member_code가 응답/로그/저장 어디에도 출력되지 않았는가?
7. `send_candidate` / `actual_send_candidate` / `upload_candidate`가 false / 0 유지?
8. DB 명칭이 VM Cloud / 운영DB / 로컬DB 3분류로 일관되는가?

## 6. CLAUDE.md 연계

본 guide의 짧은 요약은 CLAUDE.md “DB 명칭” 섹션 아래에 추가 권장. 본 문서가 단일 정본.

## 7. Verdict

`GUIDE_v1_LOCKED`

산출 JSON: `data/attribution-data-source-decision-guide-20260511.json`
