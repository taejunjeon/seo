# NPay 매출 — imweb v2 API → VM imweb_orders 가 정본 가능 (운영DB 우회)

작성 시각: 2026-05-11 19:55 KST
**핵심: 운영DB tb_iamweb_users NPay sync 9h lag 회피 가능. imweb v2 API 가 더 빠른 정본.**

## 1. 이번에 가능해진 것

NPay 매출을 운영DB 사용하지 않고도 **imweb v2 API → VM imweb_orders** 캐시로 거의 실시간 (freshness 1시간 20분) 산출 가능함이 확인됐다. 운영DB의 NAVERPAY_ORDER sync 9시간 lag 가 더 이상 NPay 매출 측정의 병목이 아니다.

## 2. 왜 필요했는지

직전 작업에서 NPay 매출 join 0건이 나온 근본 원인이 운영DB sync lag 였는데, "API 로 자체적으로 가져올 수 있는지" 검토. 결과적으로 **imweb v2 API → 로컬 SQLite 캐시** path 가 이미 운영 중이라는 것을 새로 발견.

## 3. 어떻게 작동하는지 (비개발자용)

- imweb 어드민이 제공하는 v2 API (`https://api.imweb.me/v2/shop/orders`) 가 모든 주문의 결제 정보 (`payment` 객체 안 `pay_type` / `pg_type` / `payment_amount`) 를 응답.
- backend 가 그 응답을 `imweb_orders` 테이블에 캐시 (수동 sync 명령 또는 cron).
- VM Cloud SQLite 의 `imweb_orders.pay_type='npay'` 로 NPay 결제만 필터 → 매출 합계.
- 운영DB (개발팀 supabase) 거치지 않으므로 그 쪽 sync lag 와 무관.

## 4. 실제로 확인된 결과 (30일 기준)

| source | freshness | NPay 매출 합계 | row 수 |
|---|---|---|---|
| 운영DB `tb_iamweb_users` (NAVERPAY_ORDER + PAYMENT_COMPLETE) | KST 09:47 (**9.5h lag**) | 약 ₩3,827만 | 214 |
| **VM imweb_orders** (pay_type='npay' + complete_time != null) | **KST 16:55 (1.3h)** | **₩3,479만 6,500** | **368** |
| ↳ biocom only | — | ₩2,449만 7,400 | 124 |
| ↳ thecleancoffee | — | ₩1,029만 9,100 | 244 |

> 두 source 의 row 수 차이 (214 vs 368) 는 운영DB 가 biocom 중심 + cancellation/return 필터 제외 vs VM imweb_orders 가 biocom+thecleancoffee 합산 + complete_time 만 필터. 별도 audit 필요.

## 5. NPay 데이터를 식별하는 imweb_orders 컬럼

| 컬럼 | NPay 식별값 |
|---|---|
| `pay_type` | `'npay'` |
| `pg_type` | `'NAVERPAY_ORDER'` (일부 row 는 비어있음) |
| `channel_order_no` | NPay 측 식별자 (예: `2026051156906130`) |
| `order_no` | imweb 15자리 숫자 (운영DB `order_number` 와 매칭 가능) |
| `payment_amount` | 정수 KRW |
| `complete_time` | 결제완료 시각 (null = 미완료) |

## 6. 대안 API 검토

| API | 사용 가능성 | 결론 |
|---|---|---|
| **imweb v2 API** | ✅ 이미 사용 중, 정본 후보 | **채택** — 운영DB 우회 |
| Naver Pay Open API | 가맹점 partnerID + API key 추가 필요 | 보류 (가치 낮음, imweb 가 이미 NPay 정보 보유) |
| Toss API (`tb_sales_toss`) | NPay 가 Toss 안 거치는 케이스 존재 | 보류 (부분적, cross-check 용도만) |

## 7. site_landing 직접 매칭 한계 (참고)

site_landing 의 NPay 관련 row 11건은 landing_url 이 `thecleancoffee.com/shop_view?...&NaPm=ct%3D...` 형식 — `order_code` 없음. NPay 완료 URL (`orders.pay.naver.com/order/result/mall/{channel_order_no}`) 은 브라우저 referrer policy 가 path 자름 → site_landing 이 channel_order_no 직접 capture 불가. 따라서 site_landing → NPay 매출 직접 join 은 불가능. **대신 imweb_orders 가 NPay 매출 정본**.

## 8. 아직 안 된 것

- 두 source (운영DB 214 vs imweb_orders 368) 간 row 수 차이 audit — biocom 단독으로 비교 + cancellation/return 필터 정렬.
- imweb_orders 의 NPay sync 주기 정확 측정 (현재 1.3h 관측, 시간당 cron 추정).
- thecleancoffee NPay 매출이 운영DB 에 있는지 확인 (운영DB tb_iamweb_users 는 biocom 중심이라 thecleancoffee NPay 0 가능).

## 9. 다음 액션

| Owner | Action | Claude Code가 직접 가능한가 | 못 하면 이유 | 데이터 충분도 | 타이밍 점수 | 목표 영향도 | 위험도 (↓) | 종합 추천 점수 | 추천 |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| Claude Code | imweb_orders NPay vs 운영DB NPay row 수 차이 audit (biocom only / cancellation 처리 / site 분리) | YES — read-only 운영DB + 로컬DB query | — | 85 | 90 | 80 | 5 | **84** | 진행 |
| Claude Code | site_landing summary API 또는 새 endpoint 에 "NPay 매출 (imweb v2 API 정본)" derived 필드 추가 | YES — backend code | — | 80 | 70 | 75 | 15 | **72** | 진행 (위 audit 결과 본 후) |
| Claude Code | imweb v2 API sync 주기 정확 측정 (cron schedule 확인 + max(order_time) trend) | YES — script + scheduling | — | 75 | 70 | 60 | 10 | **66** | 보류 (필요 시) |
| TJ님 | imweb v2 API token rotation / rate limit 정책 확인 | NO — imweb 콘솔 권한 | API key/secret 가 TJ 환경에만 등록 | 60 | 40 | 50 | 20 | **48** | 보류 (현재 lag 1.3h 충분) |

## 10. invariants

| invariant | 결과 |
|---|---|
| operational_db_write | 0 |
| external_send_count | 0 |
| raw_pii_logged | 0 |
| raw_order_no/channel_order_no persisted | 0 |
| imweb v2 API rate limit 위반 | 0 (read-only, 본 audit 이 직접 호출 안 함) |

산출 JSON: `data/npay-revenue-via-imweb-api-not-operational-db-20260511.json`
