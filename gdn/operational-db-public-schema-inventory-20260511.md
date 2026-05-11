# 운영DB public 스키마 inventory (Part C)

작성 시각: 2026-05-11 20:00 KST
문서 성격: 운영DB (개발팀 supabase Postgres) `public` 스키마 전체 테이블 inventory
적용 범위: `data/!data_inventory.md` Part A (로컬DB + VM Cloud SQLite 48 테이블) 의 follow-up Part C
관리 원칙: read-only. 운영DB write 0. 외부 send 0. PII (email/phone/jumin/카드) sample 0건. 컬럼 이름과 type 만 기록.
DB 명칭: CLAUDE.md 3분류 (VM Cloud / 운영DB / 로컬DB) 그대로. "운영pg / 원격 PG / operational PG" 표현 금지.
commit hash: (main thread 통합 후 기입)
push 정보: (main thread 통합 후 기입)

---

## §1 사람이 이해하는 작업 설명

### 무엇을 했는가
운영DB 의 `public` 스키마에 들어 있는 **모든 테이블/뷰 89건** 의 이름, row 수, 컬럼 schema (우선 17 테이블), site / channel / store 분포, freshness (최근 데이터 시각) 를 한 곳에 정리했다.

### 왜 했는가
지금까지는 `tb_iamweb_users` 만 정본으로 명시되어 있고 나머지 80여개 테이블 (`tb_playauto_orders`, `tb_sales_toss`, `tb_sales_coupang`, `tb_sales_naver_vat`, `tb_laplace`, `tb_naver_orders`, `tb_consultation_records`, `customer_report_info` 등) 의 row 수 / 컬럼 / 용도 / 신선도 가 한 곳에 없었다. 매출 정합성, 채널별 분석, NPay/검사권/팀키토 매출 추적을 위해 운영DB 의 inventory 가 정본 위치에 필요했다.

### 어떻게 했는가
- `backend/src/postgres.ts` 의 `queryPg` helper 를 `npx tsx scripts/_inv_opdb_step*.ts` 로 호출.
- 4단계 query: (1) information_schema.tables 전체 list, (2) base table 별 `count(*)` 정확값, (3) information_schema.columns 우선 17 테이블 컬럼 메타, (4) site/channel/store/project 그룹별 분포, (5) MAX(date) freshness.
- 임시 스크립트는 모두 작업 종료 후 삭제.
- SELECT only. INSERT / UPDATE / DELETE / DDL 0건.

### 결과가 무엇인가
- 89개 객체 (75 base table + 14 view) 발견. 그 중 56건 데이터 있음, 19건 비어 있거나 0건.
- 우선 17개 priority 테이블 컬럼 schema 캡처. `tb_iamweb_users` 41컬럼, `tb_playauto_orders` 34컬럼, `tb_sales_toss` 29컬럼, `tb_laplace` 29컬럼 (한국어 컬럼) 등.
- backend 코드 안에서 `tb_*` 운영DB 테이블에 INSERT/UPDATE 하는 코드 0건 확인 (운영DB write 금지 invariant 유지).

### 목표에 어떤 영향을 줬는가
- 매출 join / 다채널 분석 / NPay 분석 / 검사권 추적 / 정산 분석 작업이 운영DB 어느 테이블을 봐야 하는지 한 문서에서 결정 가능.
- `data/!data_inventory.md` 의 Part C 자리 (운영DB 부분) 데이터 ready. main thread 가 통합 commit.

### 남은 병목은 무엇인가
- `tb_iamweb_users.raw_data->>'site_code'` 가 99,126건 NULL — site 구분 키가 raw_data 의 어느 path 에 있는지 별도 확인 필요.
- `tb_naver_orders.channel` 4251건 모두 빈 문자열 — 사이트/판매처 구분 키 부재.
- `tb_laplace` freshness 가 2025-11-04 에서 멈춤 — 외부 Laplace export 가 stale.
- `tb_imweb_member` 0건 — schema 만 존재. 운영DB 가 imweb members 를 적재하지 않음 (로컬DB 84,563건과 다름).
- `tb_sales_nicepay` / `tb_sales_recovery_lab` freshness 가 2026-01-31 에서 멈춤 — 분기 upload cadence 추정.

---

## §2 전체 테이블 list (89건)

> 분류는 컬럼 이름과 사이트 분포로 추정. base table 만 row_count 표시 (view 14건은 N/A).

### §2.1 매출 / 주문 정본 (priority — 매출 분석에 직접 사용)

| 테이블 | row_count | 용도 추정 | source 추정 |
|---|---:|---|---|
| `tb_iamweb_users` | 99,126 | imweb 주문 정본 — 사이트 통합, 매출/결제/배송/환불 통합 | imweb v2 API sync (개발팀) |
| `tb_playauto_orders` | 123,997 | Playauto 멀티채널 주문 통합 (imweb/쿠팡/스마트스토어/토스쇼핑) | Playauto API sync (개발팀) |
| `tb_sales_toss` | 34,298 | Toss PG 거래 정본 (biocom/coffee/pet store) | Toss API sync (개발팀) |
| `tb_sales_coupang` | 21,006 | 쿠팡 매출 정산 (rg + 3p) | 쿠팡 settlement API sync |
| `tb_sales_naver_vat` | 9,730 | 네이버 매출 VAT 정산 (smartstore + naverpay) | 네이버 정산 export upload |
| `tb_sales_nicepay` | 3,959 | Nicepay PG 매출 (영양제 project) | Nicepay 정산 upload |
| `tb_sales_recovery_lab` | 334 | AIBIO 리커버리랩 센터 오프라인 매출 | 수기 upload |
| `tb_sales_credit_association` | 269 | 신협/조합 매출 | 개발팀 upload |
| `tb_sales_tax_invoice` | 151 | 세금계산서 매출 | 개발팀 upload |
| `tb_sales_upload_log` | 138 | 매출 upload 잡 로그 | 개발팀 upload tool |
| `tb_sales_project_mapping` | 0 | 매출 project 매핑 룰 (대기) | 개발팀 백오피스 |
| `tb_naver_orders` | 4,251 | 네이버 스마트스토어 주문 원본 | 네이버 commerce API sync |
| `tb_laplace` | 92,571 | Laplace 통합 주문 (다채널 9 사이트) | Laplace 외부 export |
| `tb_teamketo_smartstore` | 11,031 | 팀키토 스마트스토어 raw 주문 | 스마트스토어 export upload |
| `tb_teamketo_cafe24` | 834 | 팀키토 Cafe24 raw 주문 | Cafe24 export upload |
| `tb_coupang_orders_rg` | 1,799 | 쿠팡 로켓그로스 주문 | 쿠팡 Wing API |
| `tb_coupang_orders_mp` | 174 | 쿠팡 마플 주문 | 쿠팡 Wing API |
| `tb_coupang_inventory` | 85 | 쿠팡 인벤토리 캐시 | 쿠팡 Wing API |

### §2.2 상품 / 회원 / 상담 / 리포트

| 테이블 | row_count | 용도 추정 | source 추정 |
|---|---:|---|---|
| `tb_iamweb_Products` | 53 | imweb 상품 마스터 (product_no) | imweb v2 API sync |
| `tb_iamweb_backfill_jobs` | 14 | imweb 주문 backfill 잡 추적 | 개발팀 backfill 워커 |
| `tb_imweb_member` | 0 | imweb 회원 (brand/site_code 구분) — schema 만 정의 | imweb v2 members (대기) |
| `tb_consultation_records` | 8,763 | 상담 레코드 (chart_id 기준, 신규 schema) | 개발팀 운영툴 |
| `consultation_records` | 1 | 상담 레코드 legacy schema | legacy |
| `customer_report_info` | 35,882 | 고객 리포트(검사권) 발급 이력 (chart_id) | 개발팀 운영툴 |
| `prediction_history` | 231 | 재고 예측 / ML 결과 히스토리 | 개발팀 ML 잡 |
| `ltr_customer_cohort` | 32,346 | LTR 고객 코호트 매핑 | 개발팀 분석 잡 |
| `ltr_cohort_cache` | 612 | LTR 코호트 분석 캐시 | 개발팀 분석 잡 |
| `tb_influencer_group_buy_customer` | 2,638 | 인플루언서 공동구매 고객 | 개발팀 백오피스 |
| `tb_influencer_group_buy` | 40 | 인플루언서 공동구매 캠페인 | 개발팀 백오피스 |
| `tb_influencer` | 23 | 인플루언서 마스터 | 개발팀 백오피스 |
| `tb_group_buy_option_component` | 148 | 공동구매 옵션 구성요소 | 개발팀 백오피스 |
| `tb_group_buy` | 0 | 공동구매 (미사용) | 개발팀 백오피스 |
| `tb_group_buy_customer` | 0 | 공동구매 고객 (미사용) | 개발팀 백오피스 |

### §2.3 인벤토리 / 트랜잭션

| 테이블 | row_count | 용도 추정 | source 추정 |
|---|---:|---|---|
| `tb_inventory_snapshot` | 5,453 | 인벤토리 일일 스냅샷 | 개발팀 cron |
| `tb_restock_recommendation` | 741 | 재입고 추천 | 개발팀 분석 잡 |
| `transactions` | 1,751 | 인벤토리 트랜잭션 (입출고) | 개발팀 백오피스 |
| `products` | 23 | 상품 마스터 legacy small | 개발팀 백오피스 |
| `tb_product` | 31 | 상품 마스터 (신규) | 개발팀 백오피스 |
| `tb_product_master` | 14 | 상품 마스터 (legacy) | 개발팀 백오피스 |
| `tb_invoice_product_name` | 31 | 세금계산서 상품명 매핑 | 개발팀 백오피스 |

### §2.4 백오피스 / 채널톡 / 알림

| 테이블 | row_count | 용도 추정 | source 추정 |
|---|---:|---|---|
| `channeltalk_users` | 2,198 | ChannelTalk 사용자 캐시 | ChannelTalk API sync |
| `channeltalk_users_20250213` | 2,198 | 2025-02-13 ChannelTalk 사용자 스냅샷 (백업) | manual snapshot |
| `tb_channeltalk_users` | 0 | ChannelTalk 신규 schema (대기) | ChannelTalk API (예정) |
| `tb_app_config` | 9 | 백오피스 앱 설정 | 개발팀 백오피스 |
| `tb_channel` | 1 | 판매 채널 마스터 | 개발팀 백오피스 |
| `tb_channel_option` | 103 | 채널 옵션 | 개발팀 백오피스 |
| `tb_department` | 8 | 부서 마스터 | 개발팀 백오피스 |
| `tb_menu` | 24 | 백오피스 메뉴 마스터 | 개발팀 백오피스 |
| `tb_menu_department` | 4 | 메뉴-부서 매핑 | 개발팀 백오피스 |
| `tb_notification` | 3 | 알림 (legacy 단수형) | 개발팀 백오피스 |
| `tb_notifications` | 633 | 알림 (신규 복수형) | 개발팀 백오피스 |
| `tb_notification_subscriptions` | 8 | 알림 구독자 | 개발팀 백오피스 |
| `tb_operation_log` | 116 | 백오피스 운영 로그 | 개발팀 백오피스 |
| `tb_option_assignee` | 19 | 옵션 담당자 매핑 | 개발팀 백오피스 |
| `tb_option_policy` | 83 | 옵션 정책 | 개발팀 백오피스 |
| `tb_role` | 4 | 백오피스 권한 역할 | 개발팀 백오피스 |
| `tb_store_info` | 9 | 스토어 마스터 | 개발팀 백오피스 |
| `tb_team_notification_channel` | 2 | 팀 알림 채널 매핑 | 개발팀 백오피스 |
| `tb_user_menu_permission` | 6 | 사용자 메뉴 권한 | 개발팀 백오피스 |
| `bico_user` | 26 | 바이오컴 사내 사용자 | 개발팀 백오피스 |
| `bicotable_menu` | 140 | Bicotable 메뉴 카탈로그 | 개발팀 백오피스 |
| `comments` | 50 | 내부 코멘트/메모 | 개발팀 백오피스 |
| `password_reset_codes` | 12 | 비밀번호 리셋 코드 | 개발팀 백오피스 |
| `users` | 0 | 백오피스 사용자 신규 schema (대기) | 개발팀 백오피스 |
| `user_home_widget_settings` | 2 | 사용자 홈 위젯 설정 | 개발팀 백오피스 |
| `tb_cs_inquiry` | 2 | CS 문의 | 개발팀 백오피스 |
| `tb_cs_message` | 1 | CS 메시지 | 개발팀 백오피스 |
| `alerts` | 0 | 운영 알람 큐 (미사용) | 개발팀 백오피스 |
| `alembic_version` | 1 | Alembic migration version | 개발팀 migration tool |

### §2.5 테스트 / 임시

| 테이블 | row_count | 용도 추정 | source 추정 |
|---|---:|---|---|
| `test_tb_iamweb_users` | 10,164 | tb_iamweb_users 테스트 사본 | 테스트 fixture |
| `test_tb_consultation_records` | 748 | tb_consultation_records 테스트 사본 | 테스트 fixture |
| `vw_purchase_conversion_details` | 0 | BASE TABLE 인데 count 0 (vw_ prefix, materialized 추정) | 개발팀 분석 잡 |

### §2.6 View 14건 (count skip)

`vw_multichannel_orders`, `vw_repurchase_daily`, `vw_repurchase_joined_data`, `vw_repurchase_monthly`, `vw_repurchase_per_analysis_type`, `vw_repurchase_per_consultation`, `vw_repurchase_rate`, `vw_repurchase_rate_new`, `vw_repurchase_weekly`, `vw_subscription_sales_ratio`, `vw_supplement_subscription_ratio`, `vw_test_repurchase_daily`, `vw_test_repurchase_monthly`, `vw_test_repurchase_per_analysis_type`, `vw_test_repurchase_rate_new`, `vw_test_repurchase_rates`, `vw_test_repurchase_weekly`

→ 재구매율 / 멀티채널 / 구독 분석용 view. 개발팀 백오피스/분석 dashboard 에서 직접 query.

---

## §3 우선순위 17개 테이블 컬럼 상세

### §3.1 `tb_iamweb_users` (99,126행 · 41컬럼)

imweb 주문 정본. 사이트 코드 컬럼이 `raw_data->>'site_code'` 에는 없음 (99,126건 NULL). site 구분 키 추가 조사 필요.

| 순 | 컬럼 | 타입 | NULL | 의미 추정 |
|---:|---|---|---|---|
| 1 | id | integer | NO | PK |
| 2 | order_date | varchar | YES | 주문 일시 (문자열) |
| 3 | order_number | varchar | YES | imweb 주문 번호 |
| 4 | customer_number | varchar | YES | imweb 고객 번호 |
| 5 | product_name | varchar | YES | 상품명 |
| 6 | option_name | varchar | YES | 옵션명 |
| 7 | final_order_amount | integer | YES | 최종 주문 금액 (KRW) |
| 8 | customer_email | varchar | YES | 고객 이메일 (PII) |
| 9 | purchase_quantity | integer | YES | 구매 수량 |
| 10 | cancellation_reason | varchar | YES | 취소 사유 |
| 11 | return_reason | varchar | YES | 반품 사유 |
| 12 | order_section_item_no | varchar | YES | 주문 섹션 아이템 번호 |
| 13 | order_item_code | varchar | YES | 주문 아이템 코드 |
| 14 | item_price | integer | YES | 단가 |
| 15 | grade_discount | integer | YES | 등급 할인 |
| 16 | coupon_discount | integer | YES | 쿠폰 할인 |
| 17 | point_used | integer | YES | 적립금 사용 |
| 18 | promotion_discount | integer | YES | 프로모션 할인 |
| 19 | customer_name | varchar | YES | 고객명 (PII) |
| 20 | base_item_price | integer | YES | 기본 단가 |
| 21 | total_price | integer | YES | 총 금액 |
| 22 | total_discount_price | integer | YES | 총 할인 금액 |
| 23 | total_refunded_price | integer | YES | 총 환불 완료 금액 |
| 24 | total_refund_pending_price | integer | YES | 총 환불 대기 금액 |
| 25 | delivery_price | integer | YES | 배송비 |
| 26 | pg_name | varchar | YES | PG명 (e.g., toss, naverpay) |
| 27 | payment_method | varchar | YES | 결제수단 |
| 28 | payment_status | varchar | YES | 결제 상태 (e.g., PAYMENT_COMPLETE) |
| 29 | paid_price | integer | YES | 실결제 금액 |
| 30 | payment_complete_time | varchar | YES | 결제완료 시각 |
| 31 | raw_data | jsonb | YES | imweb API 원본 (site_code 등) |
| 32-37 | receiver_* / delivery_memo | varchar | YES | 수령인 정보 (PII) |
| 38 | chart_id | varchar | YES | 검사권 chart_id (있으면) |
| 39 | memo | varchar | YES | 메모 |
| 40-41 | changed_address / zipcode | varchar | YES | 주소 변경 이력 |

### §3.2 `tb_playauto_orders` (123,997행 · 34컬럼)

Playauto 멀티채널 주문 통합. `shop_name` 컬럼으로 채널 구분 (아임웹/쿠팡/스마트스토어/토스쇼핑 등 11개 값).

핵심 컬럼: `uniq` (PK), `bundle_no`, `ord_status`, `shop_name`, `shop_ord_no`, `shop_sale_name`, `shop_opt_name`, `sale_cnt`, `pay_amt` (numeric), `ship_cost`, `ship_method`, `carr_name`, `invoice_no`, `ship_plan_date`, `invoice_send_time`, `order_name` (PII), `order_htel` (PII), `to_name` (PII), `to_htel` (PII), `to_addr1/2/zipcd` (PII), `ship_msg`, `gprivate_no`, `ord_time`, `pay_time`, `pay_method`, `c_sale_cd`, `depot_name`, `ship_delay_yn`, `synced_at`, `created_at`, `updated_at`.

### §3.3 `tb_sales_toss` (34,298행 · 29컬럼)

Toss PG 거래 정본. `channel` (toss_card/toss_cash_receipt) + `store` (biocom/coffee/pet) + `project` (검사권/영양제/커피/팀키토/펫) 조합.

핵심 컬럼: `id`, `channel`, `store`, `mid`, `payment_key` (NOT NULL), `order_id`, `order_name`, `project`, `status`, `method`, `approved_at`, `canceled_at`, `total_amount`, `balance_amount`, `supplied_amount`, `vat`, `tax_free_amount`, `cancel_amount`, `card_approve_no`, `card_type`, `card_issuer_code`, `cash_receipt_*`, `sales_month` (NOT NULL), `data_source`, `synced_at`, `created_at`, `updated_at`.

### §3.4 `tb_iamweb_Products` (53행 · 12컬럼)

imweb 상품 마스터. `id`, `product_no`, `categories`, `name`, `simple_content_plain`, `price_sale`, `price_org`, `price_tax` (boolean), `price_none` (boolean), `point_type` (jsonb), `weight`, `sync_info` (jsonb).

### §3.5 `tb_iamweb_backfill_jobs` (14행 · 17컬럼)

imweb 주문 backfill 잡 추적. `id` (varchar PK), `status` (completed/running/cancelled/cancel_requested), `start_date`, `end_date`, `requested_by`, `current_range_start/end`, `current_order_no`, `processed_orders`, `total_orders`, `inserted`, `updated`, `skipped`, `error_message`, `created_at`, `started_at`, `finished_at`. 최근 finished_at = 2026-04-22 03:48.

### §3.6 `tb_imweb_member` (0행 · 30컬럼 schema 만)

imweb 회원 schema. `id`, `brand`, `member_code` (NOT NULL), `site_code`, `unit_code`, `uid`, `name`, `email`, `callnum`, `gender`, `home_page`, `birth`, `address`, `address_detail`, `address_country`, `post_code`, `sms_agree`, `email_agree`, `third_party_agree`, `join_time`, `recommend_code`, `recommend_target_code`, `last_login_time`, `point`, `grade`, `group` (jsonb), `coupon` (jsonb), `social_login` (jsonb), `created_at`, `updated_at`.

→ 운영DB 에는 imweb 회원 0건. 회원 데이터는 로컬DB `imweb_members` (84,563건) / VM Cloud (83,277건) 에서만 정본.

### §3.7 `tb_sales_coupang` (21,006행 · 22컬럼)

쿠팡 매출 정산. `id`, `channel` (coupang_rg / coupang_3p), `order_id`, `option_id`, `product_name`, `project`, `sales_recognition_date`, `payment_complete_date`, `sales_recognition_month`, `item_type`, `tax_type`, `card_sales`, `cash_sales`, `other_sales`, `card_refund`, `cash_refund`, `other_refund`, `sales_month`, `upload_batch_id`, `uploaded_at`, `created_at`, `updated_at`.

### §3.8 `tb_sales_naver_vat` (9,730행 · 26컬럼)

네이버 매출 VAT 정산 (smartstore / naverpay). `channel`, `sub_channel` (바이오컴), `settle_basis_date`, `order_id`, `product_order_id`, `product_order_type`, `detail_type`, `status`, `product_name`, `project`, `total_sales_amount`, `taxation_sales_amount`, `tax_exemption_sales_amount`, `credit_card_amount`, `cash_income_deduction_amount`, `cash_outgoing_evidence_amount`, `cash_exclusion_issuance_amount`, `other_amount`, `merchant_id`, `merchant_name`, `sales_month`, `data_source`, `synced_at`, `created_at`, `updated_at`.

### §3.9 `tb_sales_nicepay` (3,959행 · 28컬럼)

Nicepay PG 매출. `service_name`, `settlement_date`, `approval_date`, `cancel_date`, `merchant_name`, `mid`, `transaction_amount`, `payment_fee`, `escrow_fee`, `auth_fee`, `vat`, `settlement_amount`, `card_bank`, `approval_no`, `order_no`, `buyer_name` (PII), `product_name`, `transaction_type`, `tid`, `original_tid`, `status`, `project` (영양제 only), `sales_month`, `upload_batch_id`, `uploaded_at`, `created_at`, `updated_at`. 최근 freshness 2026-01-31.

### §3.10 `tb_sales_recovery_lab` (334행 · 19컬럼)

AIBIO 센터 오프라인 매출. `payment_date`, `customer_name` (PII), `program_name`, `project` (센터/영양제/검사권/커피/팀키토), `payment_amount`, `card_holder_name`, `approval_number`, `payment_staff`, `referral_source`, `customer_type`, `note`, `payment_type`, `cash_receipt_issued`, `sales_month`, `upload_batch_id`, `uploaded_at`, `created_at`, `updated_at`. 최근 freshness 2026-01-31.

### §3.11 `tb_naver_orders` (4,251행 · 39컬럼)

네이버 스마트스토어 주문 raw. `product_order_id`, `order_id`, `order_date`, `payed_date`, `product_name`, `option_name`, `quantity`, `unit_price`, `total_amount`, `product_order_status`, `claim_status`, `claim_type`, `delivery_status`, `buyer_name` (PII), `receiver_name` (PII), `product_class`, `delivery_fee_amount`, `channel` (empty), `synced_at`, `created_at`, `updated_at`, `orderer_tel` (PII), `payment_means`, `payment_amount`, `product_discount_amount`, `expected_settlement_amount`, `inflow_path`, `shipping_memo`, `receiver_tel` (PII), `receiver_zipcode/address/changed_*`, `delivery_company`, `tracking_number`, `send_date`, `chart_id`, `memo`.

### §3.12 `tb_teamketo_smartstore` (11,031행 · 15컬럼)

팀키토 스마트스토어 raw 주문. `shopping_mall`, `order_time`, `order_status`, `product_name`, `product_option`, `product_code`, `quantity`, `recipient_name` (PII), `phone_number` (PII), `order_id`, `order_detail_id`, `settlement_amount` (varchar), `shipping_fee` (varchar), `shipping_company`, `product_code_mall`.

### §3.13 `tb_teamketo_cafe24` (834행 · 12컬럼)

팀키토 Cafe24 raw 주문. `shopping_mall`, `order_id`, `total_order_amount`, `total_payment_amount`, `product_id`, `product_name`, `product_options`, `quantity`, `price`, `recipient_name` (PII), `recipient_phone` (PII), `order_date`.

### §3.14 `tb_consultation_records` (8,763행 · 9컬럼)

상담 레코드 (신규 schema). `id`, `consultation_date`, `consultation_time`, `analysis_type`, `customer_name` (PII), `customer_contact` (PII), `manager`, `consultation_status`, `insertdate`. 최근 freshness 2026-05-11.

### §3.15 `customer_report_info` (35,882행 · 9컬럼)

검사권 리포트 발급 이력. `id`, `user_name` (PII), `mobile` (PII), `chart_id`, `report_type`, `test_date`, `insert_date`, `created_at`, `updated_at`. 최근 freshness 2026-05-04.

### §3.16 `transactions` (1,751행 · 12컬럼)

인벤토리 입출고 트랜잭션. `id`, `product_id`, `transaction_type`, `quantity`, `unit_price` (double), `total_amount` (double), `stock_before`, `stock_after`, `transaction_date`, `notes`, `created_by`, `updated_at`. 최근 freshness 2025-08-06 (stale).

### §3.17 `tb_laplace` (92,571행 · 29컬럼)

Laplace 외부 export 통합 주문. **한국어 컬럼명**. `id`, `판매처`, `판매_채널`, `주문번호`, `상품_주문번호`, `상품번호`, `상품명`, `옵션코드`, `옵션정보`, `결제금액` (numeric), `상품_가격` (numeric), `옵션_가격` (numeric), `판매_수량`, `쿠폰`, `할인`, `배송비`, `적립금`, `예치금`, `주문_상태`, `결제_일자`, `취소_완료_일자`, `취소_요청_일자`, `반품_완료_일자`, `반품_요청_일자`, `환불_완료_일자`, `주문_일자`, `유저id`, `생성일시`, `수정일시`. 최근 freshness 2025-11-04 → stale.

---

## §4 site / channel / store / project 분포

### §4.1 `tb_sales_toss` (Toss PG)

- channel: `toss_card` 29,137 / `toss_cash_receipt` 5,161
- store: `biocom` 32,715 / `coffee` 1,424 / `pet` 159
- project: `검사권` 25,945 / `영양제` 6,461 / `커피` 1,411 / `미분류` 241 / `팀키토` 94 / `펫_영양제 외` 76 / `펫_검사권` 70

### §4.2 `tb_sales_coupang` (쿠팡 정산)

- channel: `coupang_rg` 14,485 / `coupang_3p` 6,521
- project: `커피` 8,892 / `영양제` 8,705 / `미분류` 3,395 / `펫_영양제 외` 14

### §4.3 `tb_sales_naver_vat` (네이버 VAT)

- channel: `smartstore` 4,872 / `naverpay` 4,858
- sub_channel: `바이오컴` 9,730 (전부)
- project: `영양제` 5,240 / `검사권` 3,627 / `미분류` 590 / `팀키토` 267 / `펫_영양제 외` 6

### §4.4 `tb_sales_nicepay` / `tb_sales_recovery_lab`

- nicepay project: `영양제` 3,959 (전부)
- recovery_lab project: `센터` 265 / `영양제` 36 / `검사권` 18 / `커피` 13 / `팀키토` 2

### §4.5 `tb_playauto_orders` (Playauto)

| shop_name | count |
|---|---:|
| 아임웹 | 56,324 |
| 아임웹-C | 41,662 |
| 쿠팡 | 11,272 |
| 스마트스토어-B | 7,575 |
| 스마트스토어 | 5,787 |
| 아임웹-B | 949 |
| 직접입력 | 287 |
| 아임웹-E | 125 |
| 바이오컴-앱(수동) | 10 |
| 토스 쇼핑 | 5 |
| 아임웹-D | 1 |

→ 아임웹 (4 variant: 무접미사/B/C/D/E) 합산 98,061. 쿠팡 11,272. 스마트스토어 (2 variant) 합산 13,362.

### §4.6 `tb_laplace` (Laplace 외부 export)

| 판매처 | count |
|---|---:|
| 바이오컴_아임웹 | 33,884 |
| 팀키토_스마트스토어 | 30,069 |
| 더클린커피_아임웹 | 14,575 |
| TEAM KETO_카페24 | 9,036 |
| 미리바이오_스마트스토어 | 2,545 |
| 록하트_스마트스토어 | 1,883 |
| 바이오컴펫_아임웹 | 556 |
| 바이오컴_쿠팡로켓그로스 | 20 |
| AIBIO_아임웹 | 3 |

| 판매_채널 | count |
|---|---:|
| IMWEB | 49,018 |
| SMARTSTORE | 34,497 |
| CAFE_24 | 9,036 |
| 쿠팡 로켓그로스 | 20 |

### §4.7 `tb_iamweb_users` site 구분

→ `raw_data->>'site_code'` 99,126건 모두 NULL. site 구분 키가 raw_data 안의 다른 path (예: `siteCode`, `unit_code`) 에 있을 가능성. **§5 의 follow-up 액션**.

### §4.8 `tb_iamweb_backfill_jobs` 상태 분포

- completed 8 / running 3 / cancelled 2 / cancel_requested 1
- running 3건이 모두 2026-04-22 created — 4월 22일 새벽에 시작된 잡이 finished_at 없이 멈춤. backfill 잡 정상 종료 추적 필요.

---

## §5 다음 할 일 owner+점수표

| Owner | Action | Claude Code가 직접 가능한가 | 못 하면 이유 | 데이터 충분도 | 타이밍 점수 | 목표 영향도 | 위험도 (낮을수록 좋음) | 종합 추천 점수 | 추천 |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| Claude Code | `data/!data_inventory.md` Part C 통합 (본 산출 2 파일 → main thread 가 흡수) | YES (main thread 가 통합) | n/a | 100 | 95 | 85 | 5 | 92 | 진행 |
| Claude Code | `tb_iamweb_users.raw_data` 의 site 구분 key 조사 (read-only `SELECT raw_data ? 'siteCode' / 'site_code' / 'unitCode'`) | YES | n/a | 80 | 80 | 90 | 10 | 85 | 진행 |
| Claude Code | `tb_iamweb_backfill_jobs` running 3건의 정체 원인 grep (`backend/src` + git log) | YES | n/a | 70 | 60 | 60 | 5 | 65 | 진행 |
| Claude Code | `tb_naver_orders.channel` 빈 문자열 4251건의 사이트 구분 추정 (`inflow_path` / `product_class` 사용) | YES | n/a | 70 | 60 | 65 | 10 | 65 | 진행 |
| Claude Code | view 14건 (`vw_repurchase_*`) 의 정의 (information_schema.views) read 후 part C v2 에 추가 | YES | n/a | 60 | 50 | 50 | 5 | 55 | 조건부 진행 |
| TJ님 | `tb_laplace` Laplace export sync 가 2025-11-04 부터 멈춘 이유 — 외부 서비스 / 개발팀 cron 확인 | NO (외부 서비스 / 개발팀 운영 영역) | Claude Code 는 운영DB read-only 만 | 30 | 40 | 60 | 30 | 45 | 조건부 진행 |
| TJ님 | `tb_sales_nicepay` / `tb_sales_recovery_lab` 2026-01-31 freshness 정체 — 개발팀 정산 upload cadence 확인 | NO (개발팀 cadence 결정 영역) | upload 는 운영DB write 라 read-only 환경에서 추적만 가능 | 40 | 40 | 50 | 20 | 45 | 조건부 진행 |

---

## §6 산출 파일

| 파일 | 내용 |
|---|---|
| `/Users/vibetj/coding/seo/data/operational-db-public-schema-inventory-20260511.json` | 89개 객체 row_count + 우선 17 테이블 column count + site/channel/freshness 메타 (JSON) |
| `/Users/vibetj/coding/seo/gdn/operational-db-public-schema-inventory-20260511.md` | 본 문서 — Part C inventory 정본 (markdown) |

→ `data/!data_inventory.md` 자체 수정은 main thread 가 통합. 본 작업에서는 commit 0건.

---

## §7 source / window / freshness

| 항목 | 값 |
|---|---|
| source | 운영DB (개발팀 supabase Postgres) `public` 스키마 information_schema + pg_class + count(*) |
| window | 2026-05-11 19:55~20:00 KST snapshot |
| freshness | 각 테이블별 MAX(date) 컬럼 §3 / §2.1 표에 명시 |
| site | biocom / thecleancoffee / 팀키토 / pet / AIBIO / 미리바이오 / 록하트 (tb_laplace 기준 9 사이트 발견) |
| confidence | 0.95 (read-only SELECT 만, 컬럼 schema + count 정확) |

## §8 금지선 준수

| 항목 | 결과 |
|---|---|
| No-send verified | YES (외부 전송 0) |
| No-write verified | YES (운영DB write 0건, backend grep INSERT INTO tb_* 매칭 0건) |
| No-deploy verified | YES |
| No-publish verified | YES |
| No-platform-send verified | YES |
| PII sample excluded | YES (컬럼 이름과 type 만 inventory, sample 값 0건) |

---
