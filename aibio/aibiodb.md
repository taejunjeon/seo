# AIBIO (Recovery Lab) DB 스키마 덤프

작성일: 2026-04-24
출처: Supabase 프로젝트 `aibio-center` (ID: `smyqywkwxfjusvibxrqf`)
추출 방식: Supabase REST API (`/rest/v1/` OpenAPI 스펙)
ORM: Prisma (`_prisma_migrations` 테이블 존재 · 3회 마이그레이션)
연결 자격증명: `backend/.env` 195~200행 · secret key (`sb_secret_…`)
총 테이블 수: **43개**

---

## 1. 한눈에 보기 — 테이블별 Row Count

### 고객

| 테이블 | Rows | 비고 |
|---|---|---|
| `customers` | 1,074 |  |
| `customer_analytics` | _(empty)_ |  |
| `customer_preferences` | _(empty)_ |  |
| `customer_counseling_history` | _(empty)_ |  |
| `customer_product_allocations` | 13 |  |
| `unreflected_customers` | _(empty)_ |  |

### 결제·상품

| 테이블 | Rows | 비고 |
|---|---|---|
| `payments` | 1,018 |  |
| `payment_details` | 14 |  |
| `products` | 42 |  |
| `product_usage` | 11,092 |  |
| `packages` | 43 |  |
| `package_purchases` | _(empty)_ |  |
| `package_products` | 88 |  |
| `room_products` | 18 |  |

### 예약·룸·직원

| 테이블 | Rows | 비고 |
|---|---|---|
| `reservations` | 356 |  |
| `reservation_slots` | _(empty)_ |  |
| `rooms` | 10 |  |
| `staff_schedules` | 7 |  |
| `public_holidays` | 21 |  |
| `users` | 23 |  |

### 리드·캠페인

| 테이블 | Rows | 비고 |
|---|---|---|
| `marketing_leads` | 465 |  |
| `lead_consultation_history` | _(empty)_ |  |
| `reregistration_campaigns` | _(empty)_ |  |
| `campaign_targets` | _(empty)_ |  |

### 문진·검사

| 테이블 | Rows | 비고 |
|---|---|---|
| `questionnaire_templates` | 1 |  |
| `questionnaire_responses` | _(empty)_ |  |
| `questionnaire_analyses` | _(empty)_ |  |
| `questions` | _(empty)_ |  |
| `answers` | _(empty)_ |  |
| `inbody_records` | _(empty)_ |  |
| `kit_types` | 2 |  |
| `kit_management` | 12 |  |

### 메시지·알림

| 테이블 | Rows | 비고 |
|---|---|---|
| `kakao_message_logs` | _(empty)_ |  |
| `kakao_templates` | _(empty)_ |  |
| `sms_logs` | 6 |  |
| `sms_templates` | 3 |  |
| `notifications` | _(empty)_ |  |
| `notification_settings` | _(empty)_ |  |
| `notification_preferences` | _(empty)_ |  |

### 시스템

| 테이블 | Rows | 비고 |
|---|---|---|
| `company_info` | 1 |  |
| `system_settings` | _(empty)_ |  |
| `audit_logs` | _(empty)_ |  |
| `_prisma_migrations` | 3 |  |

---

## 2. 핵심 발견 (집계·해석)

### 2.1 고객·결제 규모
- **customers 1,074명** (Dashboard 표기 1,060과 +14 차이 · 스크린샷 이후 신규 가입 추정)
- **customer_status 분포**: `active: 696` / `lead: 304` → 대시보드 "전체 고객 1,060" ≒ active + lead
- **membership_level 분포**: 전원 `basic` → **멤버십 등급 기능 미사용 · 전략 2 통합 멤버십 도입 시 이 컬럼 활용 가능**
- **payments 1,018건** 누적 · **payment_details 14건** (대부분 결제가 상세 미입력 · payments.amount가 합산액으로 직접 기록)
- **product_usage 11,092건** (세션/방문 실적 · customers × reservations 대비 깊이 있는 기록)

### 2.2 패키지 · 상품
- **packages 43개** / **products 42개** / **package_products 88개** (매핑)
- **package_purchases 0건** → 대시보드 "활성 패키지 0개"와 정합 (패키지 결제는 `payments.amount`에 직접 기록 · 소진 이력은 `customer_product_allocations 13건`에 분산)

### 2.3 미사용/저활용 기능
- `customer_analytics`, `customer_counseling_history`, `customer_preferences`, `inbody_records`, `questionnaire_responses`, `reregistration_campaigns`, `audit_logs`, `kakao_message_logs`, `notifications` 등 **다수가 빈 테이블** → 기능은 있으나 운영 흐름에 통합 안 됨
- `questionnaire_templates` 1개 · `questions` 0개 → 문진 템플릿만 생성되고 질문은 미등록

### 2.4 구매 유형 (payment_details.purchase_type)
- `PACKAGE`: 7 / `PRODUCT`: 6 / `SERVICE`: 1 (14건 샘플만)
- **환불/취소 상태 컬럼 부재** → 매출 정합성 분석 시 별도 경로 필요 (추후 확인)

---

## 3. 테이블별 상세 스키마

### `_prisma_migrations` · 3 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `id` | `character varying` | ✅ |  | 36 | Note: This is a Primary Key.<pk/> |
| 2 | `checksum` | `character varying` | ✅ |  | 64 |  |
| 3 | `finished_at` | `timestamp with time zone` |  |  |  |  |
| 4 | `migration_name` | `character varying` | ✅ |  | 255 |  |
| 5 | `logs` | `text` |  |  |  |  |
| 6 | `rolled_back_at` | `timestamp with time zone` |  |  |  |  |
| 7 | `started_at` | `timestamp with time zone` | ✅ | now() |  |  |
| 8 | `applied_steps_count` | `integer` | ✅ | 0 |  |  |

### `answers` · 0 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `answer_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `response_id` | `integer` |  |  |  | Note: This is a Foreign Key to `questionnaire_responses.response_id`.<fk table=' |
| 3 | `question_id` | `integer` |  |  |  | Note: This is a Foreign Key to `questions.question_id`.<fk table='questions' col |
| 4 | `answer_value` | `text` |  |  |  |  |
| 5 | `answer_number` | `double precision` |  |  |  |  |
| 6 | `answer_json` | `jsonb` |  |  |  |  |
| 7 | `answer_date` | `timestamp without time zone` |  |  |  |  |
| 8 | `answered_at` | `timestamp with time zone` | ✅ | now() |  |  |
| 9 | `time_spent_seconds` | `integer` |  |  |  |  |
| 10 | `created_at` | `timestamp with time zone` | ✅ | now() |  |  |
| 11 | `updated_at` | `timestamp with time zone` |  |  |  |  |

### `audit_logs` · 0 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `log_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `user_id` | `integer` |  |  |  | Note: This is a Foreign Key to `users.user_id`.<fk table='users' column='user_id |
| 3 | `details` | `jsonb` |  |  |  |  |
| 4 | `created_at` | `timestamp without time zone` | ✅ | CURRENT_TIMESTAMP |  |  |
| 5 | `entity_id` | `integer` |  |  |  |  |
| 6 | `entity_type` | `character varying` |  |  | 50 |  |
| 7 | `action` | `character varying` | ✅ |  | 50 |  |

### `campaign_targets` · 0 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `target_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `campaign_id` | `integer` |  |  |  | Note: This is a Foreign Key to `reregistration_campaigns.campaign_id`.<fk table= |
| 3 | `contact_date` | `date` |  |  |  |  |
| 4 | `contact_result` | `character varying` |  |  | 200 |  |
| 5 | `converted` | `boolean` | ✅ | false |  |  |
| 6 | `created_at` | `timestamp without time zone` | ✅ | now() |  |  |
| 7 | `customer_id` | `integer` |  |  |  | Note: This is a Foreign Key to `customers.customer_id`.<fk table='customers' col |

### `company_info` · 1 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `company_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `company_name` | `character varying` | ✅ |  | 100 |  |
| 3 | `address` | `text` |  |  |  |  |
| 4 | `phone` | `character varying` |  |  | 20 |  |
| 5 | `email` | `character varying` |  |  | 100 |  |
| 6 | `business_hours` | `jsonb` |  |  |  |  |
| 7 | `holidays` | `jsonb` |  |  |  |  |
| 8 | `created_at` | `timestamp without time zone` | ✅ | CURRENT_TIMESTAMP |  |  |
| 9 | `updated_at` | `timestamp without time zone` | ✅ | CURRENT_TIMESTAMP |  |  |

### `customer_analytics` · 0 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `analytics_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `customer_id` | `integer` | ✅ |  |  | Note: This is a Foreign Key to `customers.customer_id`.<fk table='customers' col |
| 3 | `analysis_date` | `date` | ✅ |  |  |  |
| 4 | `visit_frequency` | `character varying` |  |  | 20 |  |
| 5 | `consistency_score` | `integer` |  |  |  |  |
| 6 | `most_used_service` | `character varying` |  |  | 20 |  |
| 7 | `ltv_estimate` | `numeric` |  |  |  |  |
| 8 | `churn_risk` | `character varying` |  |  | 20 |  |
| 9 | `churn_probability` | `integer` |  |  |  |  |
| 10 | `retention_score` | `integer` |  |  |  |  |
| 11 | `created_at` | `timestamp without time zone` | ✅ | now() |  |  |

### `customer_counseling_history` · 0 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `history_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `customer_id` | `integer` | ✅ |  |  | Note: This is a Foreign Key to `customers.customer_id`.<fk table='customers' col |
| 3 | `consultation_date` | `timestamp with time zone` | ✅ |  |  |  |
| 4 | `consultation_type` | `character varying` | ✅ |  | 50 |  |
| 5 | `result` | `text` |  |  |  |  |
| 6 | `notes` | `text` |  |  |  |  |
| 7 | `next_action` | `text` |  |  |  |  |
| 8 | `cancellation` | `boolean` | ✅ | false |  |  |
| 9 | `reason` | `text` |  |  |  |  |
| 10 | `counselor` | `character varying` |  |  | 100 |  |
| 11 | `created_at` | `timestamp with time zone` | ✅ | now() |  |  |
| 12 | `updated_at` | `timestamp with time zone` | ✅ | now() |  |  |

### `customer_preferences` · 0 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `preference_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `customer_id` | `integer` | ✅ |  |  | Note: This is a Foreign Key to `customers.customer_id`.<fk table='customers' col |
| 3 | `preferred_services` | `text[]` |  |  |  |  |
| 4 | `preferred_time` | `character varying` |  |  | 20 |  |
| 5 | `preferred_intensity` | `character varying` |  |  | 20 |  |
| 6 | `health_interests` | `text[]` |  |  |  |  |
| 7 | `communication_preference` | `character varying` |  |  | 20 |  |
| 8 | `marketing_consent` | `boolean` | ✅ | false |  |  |
| 9 | `created_at` | `timestamp without time zone` | ✅ | now() |  |  |
| 10 | `updated_at` | `timestamp without time zone` | ✅ | now() |  |  |
| 11 | `extra_preferences` | `jsonb` |  |  |  |  |

### `customer_product_allocations` · 13 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `allocation_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `customer_id` | `integer` | ✅ |  |  | Note: This is a Foreign Key to `customers.customer_id`.<fk table='customers' col |
| 3 | `product_id` | `integer` | ✅ |  |  | Note: This is a Foreign Key to `products.product_id`.<fk table='products' column |
| 4 | `total_sessions` | `integer` | ✅ | 0 |  |  |
| 5 | `used_sessions` | `integer` | ✅ | 0 |  |  |
| 6 | `expiry_date` | `date` |  |  |  |  |
| 7 | `created_at` | `timestamp without time zone` | ✅ | now() |  |  |
| 8 | `updated_at` | `timestamp without time zone` | ✅ | now() |  |  |
| 9 | `package_product_id` | `integer` |  |  |  | Note: This is a Foreign Key to `package_products.id`.<fk table='package_products |
| 10 | `purchase_id` | `integer` |  |  |  | Note: This is a Foreign Key to `package_purchases.purchase_id`.<fk table='packag |

### `customers` · 1,074 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `customer_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `name` | `character varying` | ✅ |  | 50 |  |
| 3 | `phone` | `character varying` |  |  | 20 |  |
| 4 | `first_visit_date` | `date` |  |  |  |  |
| 5 | `region` | `character varying` |  |  | 100 |  |
| 6 | `referral_source` | `character varying` |  |  | 50 |  |
| 7 | `health_concerns` | `text` |  |  |  |  |
| 8 | `notes` | `text` |  |  |  |  |
| 9 | `assigned_staff` | `character varying` |  |  | 50 |  |
| 10 | `birth_year` | `integer` |  |  |  |  |
| 11 | `gender` | `character varying` |  |  | 10 |  |
| 12 | `email` | `character varying` |  |  | 100 |  |
| 13 | `address` | `text` |  |  |  |  |
| 14 | `emergency_contact` | `character varying` |  |  | 100 |  |
| 15 | `occupation` | `character varying` |  |  | 50 |  |
| 16 | `preferred_time_slots` | `jsonb` |  |  |  |  |
| 17 | `health_goals` | `text` |  |  |  |  |
| 18 | `last_visit_date` | `date` |  |  |  |  |
| 19 | `total_visits` | `integer` | ✅ | 0 |  |  |
| 20 | `average_visit_interval` | `integer` |  |  |  |  |
| 21 | `total_revenue` | `numeric` | ✅ | 0 |  |  |
| 22 | `average_satisfaction` | `numeric` |  |  |  |  |
| 23 | `created_at` | `timestamp without time zone` | ✅ | CURRENT_TIMESTAMP |  |  |
| 24 | `updated_at` | `timestamp without time zone` | ✅ | CURRENT_TIMESTAMP |  |  |
| 25 | `additional_needs` | `text` |  |  |  |  |
| 26 | `deleted` | `boolean` | ✅ | false |  |  |
| 27 | `diet_info` | `text` |  |  |  |  |
| 28 | `exercise_info` | `text` |  |  |  |  |
| 29 | `first_experience_device` | `character varying` |  |  | 100 |  |
| 30 | `health_status` | `text` |  |  |  |  |
| 31 | `is_registered` | `boolean` | ✅ | false |  |  |
| 32 | `visit_purpose` | `text` |  |  |  |  |
| 33 | `membership_level` | `character varying` | ✅ | basic | 20 |  |
| 34 | `customer_status` | `character varying` | ✅ | active | 20 |  |

### `inbody_records` · 0 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `record_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `customer_id` | `integer` | ✅ |  |  | Note: This is a Foreign Key to `customers.customer_id`.<fk table='customers' col |
| 3 | `measurement_date` | `timestamp without time zone` | ✅ | CURRENT_TIMESTAMP |  |  |
| 4 | `weight` | `double precision` |  |  |  | 체중 (kg) |
| 5 | `body_fat_percentage` | `double precision` |  |  |  | 체지방률 (%) |
| 6 | `skeletal_muscle_mass` | `double precision` |  |  |  | 골격근량 (kg) |
| 7 | `extracellular_water_ratio` | `double precision` |  |  |  | 세포외수분비 |
| 8 | `phase_angle` | `double precision` |  |  |  | 위상각 |
| 9 | `visceral_fat_level` | `integer` |  |  |  | 내장지방 레벨 |
| 10 | `notes` | `text` |  |  |  | 측정 관련 메모 |
| 11 | `measured_by` | `character varying` |  |  | 100 | 측정자 |
| 12 | `created_at` | `timestamp without time zone` | ✅ | CURRENT_TIMESTAMP |  |  |
| 13 | `updated_at` | `timestamp without time zone` | ✅ | CURRENT_TIMESTAMP |  |  |

### `kakao_message_logs` · 0 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `log_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `reservation_id` | `integer` |  |  |  | Note: This is a Foreign Key to `reservations.reservation_id`.<fk table='reservat |
| 3 | `customer_id` | `integer` |  |  |  | Note: This is a Foreign Key to `customers.customer_id`.<fk table='customers' col |
| 4 | `template_code` | `character varying` |  |  | 50 |  |
| 5 | `phone_number` | `character varying` |  |  | 20 |  |
| 6 | `message_type` | `character varying` |  |  | 20 |  |
| 7 | `status` | `character varying` |  |  | 20 |  |
| 8 | `message_id` | `character varying` |  |  | 100 |  |
| 9 | `content` | `text` |  |  |  |  |
| 10 | `variables_used` | `jsonb` |  |  |  |  |
| 11 | `sent_at` | `timestamp without time zone` |  |  |  |  |
| 12 | `delivered_at` | `timestamp without time zone` |  |  |  |  |
| 13 | `read_at` | `timestamp without time zone` |  |  |  |  |
| 14 | `error_code` | `character varying` |  |  | 50 |  |
| 15 | `error_message` | `text` |  |  |  |  |
| 16 | `fallback_status` | `character varying` |  |  | 20 |  |
| 17 | `fallback_sent_at` | `timestamp without time zone` |  |  |  |  |
| 18 | `created_at` | `timestamp without time zone` | ✅ | now() |  |  |

### `kakao_templates` · 0 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `template_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `template_code` | `character varying` | ✅ |  | 50 |  |
| 3 | `template_name` | `character varying` | ✅ |  | 100 |  |
| 4 | `template_type` | `character varying` |  |  | 50 |  |
| 5 | `content` | `text` | ✅ |  |  |  |
| 6 | `variables` | `jsonb` |  |  |  |  |
| 7 | `is_active` | `boolean` | ✅ | true |  |  |
| 8 | `approved_at` | `timestamp without time zone` |  |  |  |  |
| 9 | `created_at` | `timestamp without time zone` | ✅ | now() |  |  |
| 10 | `updated_at` | `timestamp without time zone` | ✅ | now() |  |  |

### `kit_management` · 12 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `kit_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `customer_id` | `integer` |  |  |  | Note: This is a Foreign Key to `customers.customer_id`.<fk table='customers' col |
| 3 | `kit_type_id` | `integer` |  |  |  | Note: This is a Foreign Key to `kit_types.kit_type_id`.<fk table='kit_types' col |
| 4 | `serial_number` | `character varying` |  |  | 50 |  |
| 5 | `result_received_date` | `date` |  |  |  |  |
| 6 | `result_delivered_date` | `date` |  |  |  |  |
| 7 | `created_at` | `timestamp without time zone` | ✅ | now() |  |  |
| 8 | `kit_receipt_date` | `date` |  |  |  |  |
| 9 | `sample_return_date` | `date` |  |  |  |  |
| 10 | `status` | `character varying` | ✅ | distributed | 30 |  |

### `kit_types` · 2 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `kit_type_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `name` | `character varying` | ✅ |  | 100 |  |
| 3 | `code` | `character varying` | ✅ |  | 50 |  |
| 4 | `description` | `text` |  |  |  |  |
| 5 | `price` | `integer` | ✅ |  |  |  |
| 6 | `is_active` | `boolean` | ✅ | true |  |  |
| 7 | `created_at` | `timestamp without time zone` | ✅ | now() |  |  |
| 8 | `updated_at` | `timestamp without time zone` | ✅ | now() |  |  |

### `lead_consultation_history` · 0 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `history_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `consultation_date` | `timestamp without time zone` | ✅ |  |  |  |
| 3 | `consultation_type` | `character varying` | ✅ |  | 50 |  |
| 4 | `result` | `character varying` |  |  | 255 |  |
| 5 | `notes` | `text` |  |  |  |  |
| 6 | `next_action` | `character varying` |  |  | 100 |  |
| 7 | `created_by` | `integer` |  |  |  | Note: This is a Foreign Key to `users.user_id`.<fk table='users' column='user_id |
| 8 | `created_at` | `timestamp without time zone` | ✅ | now() |  |  |
| 9 | `cancellation` | `boolean` | ✅ | false |  |  |
| 10 | `reason` | `text` |  |  |  |  |
| 11 | `customer_id` | `integer` |  |  |  | Note: This is a Foreign Key to `customers.customer_id`.<fk table='customers' col |

### `marketing_leads` · 465 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `lead_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `lead_date` | `date` | ✅ |  |  |  |
| 3 | `age` | `integer` |  |  |  |  |
| 4 | `lead_channel` | `character varying` |  |  | 50 |  |
| 5 | `carrot_id` | `character varying` |  |  | 100 |  |
| 6 | `ad_watched` | `character varying` |  |  | 100 |  |
| 7 | `price_informed` | `boolean` | ✅ | false |  |  |
| 8 | `ab_test_group` | `character varying` |  |  | 20 |  |
| 9 | `db_entry_date` | `date` |  |  |  |  |
| 10 | `phone_consult_date` | `date` |  |  |  |  |
| 11 | `visit_consult_date` | `date` |  |  |  |  |
| 12 | `registration_date` | `date` |  |  |  |  |
| 13 | `db_channel` | `character varying` |  |  | 50 |  |
| 14 | `phone_consult_result` | `character varying` |  |  | 100 |  |
| 15 | `remind_date` | `date` |  |  |  |  |
| 16 | `visit_cancelled` | `boolean` | ✅ | false |  |  |
| 17 | `visit_cancel_reason` | `text` |  |  |  |  |
| 18 | `is_reregistration_target` | `boolean` | ✅ | false |  |  |
| 19 | `last_service_date` | `date` |  |  |  |  |
| 20 | `reregistration_proposal_date` | `date` |  |  |  |  |
| 21 | `purchased_product` | `character varying` |  |  | 200 |  |
| 22 | `no_registration_reason` | `text` |  |  |  |  |
| 23 | `notes` | `text` |  |  |  |  |
| 24 | `revenue` | `numeric` |  |  |  |  |
| 25 | `status` | `character varying` | ✅ | new | 20 |  |
| 26 | `assigned_staff_id` | `integer` |  |  |  | Note: This is a Foreign Key to `users.user_id`.<fk table='users' column='user_id |
| 27 | `created_at` | `timestamp without time zone` | ✅ | now() |  |  |
| 28 | `updated_at` | `timestamp without time zone` | ✅ | now() |  |  |
| 29 | `consultant_name` | `character varying` |  |  | 50 |  |
| 30 | `current_weight` | `numeric` |  |  |  |  |
| 31 | `diet_plan` | `text` |  |  |  |  |
| 32 | `exercise_plan` | `text` |  |  |  |  |
| 33 | `experience_result` | `text` |  |  |  |  |
| 34 | `experience_services` | `character varying` |  |  | 200 |  |
| 35 | `main_concerns` | `text` |  |  |  |  |
| 36 | `past_diet_experience` | `text` |  |  |  |  |
| 37 | `referral_detail` | `text` |  |  |  |  |
| 38 | `rejection_reason` | `text` |  |  |  |  |
| 39 | `target_weight` | `numeric` |  |  |  |  |
| 40 | `visit_purpose` | `character varying` |  |  | 100 |  |
| 41 | `customer_id` | `integer` | ✅ |  |  | Note: This is a Foreign Key to `customers.customer_id`.<fk table='customers' col |

### `notification_preferences` · 0 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `preference_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `user_id` | `integer` | ✅ |  |  |  |
| 3 | `notification_type` | `character varying` |  |  | 50 |  |
| 4 | `in_app` | `boolean` | ✅ | true |  |  |
| 5 | `email` | `boolean` | ✅ | false |  |  |
| 6 | `sms` | `boolean` | ✅ | false |  |  |
| 7 | `created_at` | `timestamp without time zone` | ✅ | now() |  |  |
| 8 | `updated_at` | `timestamp without time zone` | ✅ | now() |  |  |

### `notification_settings` · 0 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `user_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> This is a Foreign Key to `users.user_id`.<fk t |
| 2 | `email_enabled` | `boolean` | ✅ | true |  |  |
| 3 | `sms_enabled` | `boolean` | ✅ | false |  |  |
| 4 | `push_enabled` | `boolean` | ✅ | true |  |  |
| 5 | `package_alerts` | `boolean` | ✅ | true |  |  |
| 6 | `appointment_reminders` | `boolean` | ✅ | true |  |  |
| 7 | `payment_notifications` | `boolean` | ✅ | true |  |  |
| 8 | `system_notifications` | `boolean` | ✅ | true |  |  |
| 9 | `marketing_notifications` | `boolean` | ✅ | false |  |  |
| 10 | `quiet_hours_enabled` | `boolean` | ✅ | false |  |  |
| 11 | `quiet_hours_start` | `character varying` |  |  | 5 |  |
| 12 | `quiet_hours_end` | `character varying` |  |  | 5 |  |
| 13 | `created_at` | `timestamp without time zone` | ✅ | now() |  |  |
| 14 | `updated_at` | `timestamp without time zone` | ✅ | now() |  |  |

### `notifications` · 0 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `notification_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `title` | `character varying` | ✅ |  | 200 |  |
| 3 | `message` | `text` | ✅ |  |  |  |
| 4 | `created_at` | `timestamp without time zone` | ✅ | CURRENT_TIMESTAMP |  |  |
| 5 | `action_url` | `character varying` |  |  | 500 |  |
| 6 | `is_read` | `boolean` | ✅ | false |  |  |
| 7 | `is_sent` | `boolean` | ✅ | false |  |  |
| 8 | `priority` | `public."NotificationPriority"` | ✅ | medium |  |  |
| 9 | `read_at` | `timestamp without time zone` |  |  |  |  |
| 10 | `related_id` | `integer` |  |  |  |  |
| 11 | `scheduled_for` | `timestamp without time zone` |  |  |  |  |
| 12 | `user_id` | `integer` |  |  |  | Note: This is a Foreign Key to `users.user_id`.<fk table='users' column='user_id |
| 13 | `type` | `public."NotificationType"` | ✅ |  |  |  |

### `package_products` · 88 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `package_id` | `integer` | ✅ |  |  | Note: This is a Foreign Key to `packages.package_id`.<fk table='packages' column |
| 3 | `product_id` | `integer` | ✅ |  |  | Note: This is a Foreign Key to `products.product_id`.<fk table='products' column |
| 4 | `created_at` | `timestamp without time zone` | ✅ | CURRENT_TIMESTAMP |  |  |
| 5 | `max_sessions` | `integer` | ✅ | 1 |  |  |

### `package_purchases` · 0 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `purchase_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `customer_id` | `integer` | ✅ |  |  | Note: This is a Foreign Key to `customers.customer_id`.<fk table='customers' col |
| 3 | `package_id` | `integer` |  |  |  | Note: This is a Foreign Key to `packages.package_id`.<fk table='packages' column |
| 4 | `purchase_date` | `date` | ✅ |  |  |  |
| 5 | `expiry_date` | `date` |  |  |  |  |
| 6 | `total_sessions` | `integer` |  |  |  |  |
| 7 | `used_sessions` | `integer` | ✅ | 0 |  |  |
| 8 | `remaining_sessions` | `integer` |  |  |  |  |
| 9 | `notes` | `text` |  |  |  |  |
| 10 | `created_at` | `timestamp without time zone` | ✅ | CURRENT_TIMESTAMP |  |  |
| 11 | `updated_at` | `timestamp without time zone` | ✅ | CURRENT_TIMESTAMP |  |  |

### `packages` · 43 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `package_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `package_name` | `character varying` | ✅ |  | 100 |  |
| 3 | `total_sessions` | `integer` |  |  |  |  |
| 4 | `valid_months` | `integer` |  |  |  |  |
| 5 | `base_price` | `integer` |  |  |  |  |
| 6 | `is_active` | `boolean` | ✅ | true |  |  |
| 7 | `description` | `character varying` |  |  | 500 |  |
| 8 | `created_at` | `timestamp without time zone` | ✅ | CURRENT_TIMESTAMP |  |  |
| 9 | `updated_at` | `timestamp without time zone` | ✅ | now() |  |  |
| 10 | `addons` | `text` |  |  |  |  |
| 11 | `discount_pct` | `integer` |  | 0 |  |  |
| 12 | `grade` | `character varying` |  |  | 30 |  |
| 13 | `outcome` | `text` |  |  |  |  |
| 14 | `purpose` | `text` |  |  |  |  |
| 15 | `target` | `text` |  |  |  |  |

### `payment_details` · 14 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `detail_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `payment_id` | `integer` | ✅ |  |  | Note: This is a Foreign Key to `payments.payment_id`.<fk table='payments' column |
| 3 | `purchase_type` | `character varying` | ✅ |  | 20 |  |
| 4 | `product_id` | `integer` |  |  |  | Note: This is a Foreign Key to `products.product_id`.<fk table='products' column |
| 5 | `quantity` | `integer` | ✅ | 1 |  |  |
| 6 | `unit_price` | `integer` | ✅ | 0 |  |  |
| 7 | `amount` | `integer` | ✅ | 0 |  |  |
| 8 | `purchase_date` | `timestamp with time zone` |  |  |  |  |
| 9 | `expiry_date` | `timestamp with time zone` |  |  |  |  |
| 10 | `notes` | `text` |  |  |  |  |
| 11 | `created_at` | `timestamp with time zone` | ✅ | now() |  |  |
| 12 | `package_product_id` | `integer` |  |  |  | Note: This is a Foreign Key to `package_products.id`.<fk table='package_products |

### `payments` · 1,018 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `payment_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `customer_id` | `integer` |  |  |  | Note: This is a Foreign Key to `customers.customer_id`.<fk table='customers' col |
| 3 | `payment_date` | `date` | ✅ |  |  |  |
| 4 | `amount` | `integer` | ✅ | 0 |  |  |
| 5 | `notes` | `character varying` |  |  | 500 |  |
| 6 | `created_at` | `timestamp without time zone` | ✅ | CURRENT_TIMESTAMP |  |  |
| 7 | `updated_at` | `timestamp without time zone` | ✅ | CURRENT_TIMESTAMP |  |  |
| 8 | `card_holder_name` | `character varying` |  |  | 100 |  |
| 9 | `payment_number` | `character varying` |  |  | 20 |  |
| 10 | `payment_method` | `character varying` |  |  | 20 |  |
| 11 | `approval_number` | `character varying` |  |  | 50 |  |

### `product_usage` · 11,092 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `usage_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `customer_id` | `integer` |  |  |  | Note: This is a Foreign Key to `customers.customer_id`.<fk table='customers' col |
| 3 | `service_date` | `date` | ✅ |  |  |  |
| 4 | `product_id` | `integer` |  |  |  | Note: This is a Foreign Key to `products.product_id`.<fk table='products' column |
| 5 | `session_details` | `text` |  |  |  |  |
| 6 | `session_number` | `integer` |  |  |  |  |
| 7 | `created_by` | `character varying` |  |  | 50 |  |
| 8 | `created_at` | `timestamp without time zone` | ✅ | now() |  |  |
| 9 | `status` | `character varying` | ✅ | completed | 20 |  |
| 10 | `reservation_id` | `integer` |  |  |  | Note: This is a Foreign Key to `reservations.reservation_id`.<fk table='reservat |
| 11 | `allocation_id` | `integer` |  |  |  | Note: This is a Foreign Key to `customer_product_allocations.allocation_id`.<fk  |

### `products` · 42 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `product_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `product_name` | `character varying` | ✅ |  | 100 |  |
| 3 | `product_color` | `character varying` |  |  | 7 |  |
| 4 | `default_duration` | `integer` |  | 60 |  |  |
| 5 | `default_price` | `integer` |  | 0 |  |  |
| 6 | `is_active` | `boolean` |  | true |  |  |
| 7 | `created_at` | `timestamp without time zone` |  | CURRENT_TIMESTAMP |  |  |
| 8 | `updated_at` | `timestamp without time zone` |  | CURRENT_TIMESTAMP |  |  |
| 9 | `description` | `text` |  |  |  |  |
| 10 | `default_sessions` | `integer` |  | 10 |  |  |
| 11 | `category` | `character varying` |  |  | 20 |  |
| 12 | `discount_pct` | `integer` |  | 0 |  |  |
| 13 | `sort_order` | `integer` | ✅ | 0 |  |  |

### `public_holidays` · 21 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `date` | `date` | ✅ |  |  |  |
| 3 | `name` | `character varying` | ✅ |  | 100 |  |
| 4 | `is_holiday` | `boolean` | ✅ | true |  |  |
| 5 | `year` | `integer` | ✅ |  |  |  |
| 6 | `month` | `integer` | ✅ |  |  |  |
| 7 | `source` | `character varying` | ✅ | api | 20 |  |
| 8 | `created_at` | `timestamp without time zone` | ✅ | CURRENT_TIMESTAMP |  |  |

### `questionnaire_analyses` · 0 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `analysis_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `response_id` | `integer` | ✅ |  |  | Note: This is a Foreign Key to `questionnaire_responses.response_id`.<fk table=' |
| 3 | `overall_health_score` | `double precision` |  |  |  |  |
| 4 | `body_composition_score` | `double precision` |  |  |  |  |
| 5 | `metabolic_health_score` | `double precision` |  |  |  |  |
| 6 | `stress_score` | `double precision` |  |  |  |  |
| 7 | `sleep_score` | `double precision` |  |  |  |  |
| 8 | `nutrition_score` | `double precision` |  |  |  |  |
| 9 | `recommended_services` | `jsonb` |  |  |  |  |
| 10 | `recommended_supplements` | `jsonb` |  |  |  |  |
| 11 | `recommended_diet` | `jsonb` |  |  |  |  |
| 12 | `detailed_analysis` | `jsonb` |  |  |  |  |
| 13 | `risk_factors` | `jsonb` |  |  |  |  |
| 14 | `improvement_areas` | `jsonb` |  |  |  |  |
| 15 | `analyzed_at` | `timestamp with time zone` | ✅ | now() |  |  |

### `questionnaire_responses` · 0 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `response_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `customer_id` | `integer` |  |  |  | Note: This is a Foreign Key to `customers.customer_id`.<fk table='customers' col |
| 3 | `template_id` | `integer` |  |  |  | Note: This is a Foreign Key to `questionnaire_templates.template_id`.<fk table=' |
| 4 | `inbody_record_id` | `integer` |  |  |  | Note: This is a Foreign Key to `inbody_records.record_id`.<fk table='inbody_reco |
| 5 | `started_at` | `timestamp with time zone` | ✅ | now() |  |  |
| 6 | `completed_at` | `timestamp with time zone` |  |  |  |  |
| 7 | `is_completed` | `boolean` | ✅ | false |  |  |
| 8 | `completion_rate` | `double precision` | ✅ | 0 |  |  |
| 9 | `device_id` | `character varying` |  |  | 100 |  |
| 10 | `app_version` | `character varying` |  |  | 20 |  |
| 11 | `ai_analysis` | `jsonb` |  |  |  |  |
| 12 | `health_scores` | `jsonb` |  |  |  |  |
| 13 | `recommendations` | `jsonb` |  |  |  |  |
| 14 | `created_at` | `timestamp with time zone` | ✅ | now() |  |  |
| 15 | `updated_at` | `timestamp with time zone` |  |  |  |  |

### `questionnaire_templates` · 1 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `template_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `name` | `character varying` | ✅ |  | 100 |  |
| 3 | `description` | `text` |  |  |  |  |
| 4 | `version` | `character varying` | ✅ | 1.0 | 20 |  |
| 5 | `is_active` | `boolean` | ✅ | true |  |  |
| 6 | `created_at` | `timestamp with time zone` | ✅ | now() |  |  |
| 7 | `updated_at` | `timestamp with time zone` |  |  |  |  |

### `questions` · 0 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `question_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `template_id` | `integer` |  |  |  | Note: This is a Foreign Key to `questionnaire_templates.template_id`.<fk table=' |
| 3 | `question_code` | `character varying` | ✅ |  | 50 |  |
| 4 | `question_text` | `text` | ✅ |  |  |  |
| 5 | `question_subtext` | `text` |  |  |  |  |
| 6 | `order_index` | `integer` | ✅ |  |  |  |
| 7 | `is_required` | `boolean` | ✅ | true |  |  |
| 8 | `condition_logic` | `jsonb` |  |  |  |  |
| 9 | `options` | `jsonb` |  |  |  |  |
| 10 | `validation_rules` | `jsonb` |  |  |  |  |
| 11 | `ui_config` | `jsonb` |  |  |  |  |
| 12 | `created_at` | `timestamp with time zone` | ✅ | now() |  |  |
| 13 | `updated_at` | `timestamp with time zone` |  |  |  |  |
| 14 | `section` | `public."QuestionnaireSection"` | ✅ |  |  |  |
| 15 | `question_type` | `public."QuestionType"` | ✅ |  |  |  |

### `reregistration_campaigns` · 0 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `campaign_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `campaign_name` | `character varying` | ✅ |  | 100 |  |
| 3 | `campaign_type` | `character varying` |  |  | 50 |  |
| 4 | `start_date` | `date` | ✅ |  |  |  |
| 5 | `end_date` | `date` |  |  |  |  |
| 6 | `target_criteria` | `text` |  |  |  |  |
| 7 | `message_template` | `text` |  |  |  |  |
| 8 | `target_count` | `integer` | ✅ | 0 |  |  |
| 9 | `success_count` | `integer` | ✅ | 0 |  |  |
| 10 | `notes` | `text` |  |  |  |  |
| 11 | `is_active` | `boolean` | ✅ | true |  |  |
| 12 | `created_at` | `timestamp without time zone` | ✅ | now() |  |  |
| 13 | `updated_at` | `timestamp without time zone` |  |  |  |  |
| 14 | `created_by` | `integer` |  |  |  | Note: This is a Foreign Key to `users.user_id`.<fk table='users' column='user_id |

### `reservation_slots` · 0 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `slot_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `staff_id` | `integer` |  |  |  | Note: This is a Foreign Key to `users.user_id`.<fk table='users' column='user_id |
| 3 | `day_of_week` | `integer` |  |  |  |  |
| 4 | `start_time` | `time without time zone` | ✅ |  |  |  |
| 5 | `end_time` | `time without time zone` | ✅ |  |  |  |
| 6 | `is_available` | `boolean` | ✅ | true |  |  |
| 7 | `specific_date` | `date` |  |  |  |  |
| 8 | `created_at` | `timestamp without time zone` | ✅ | now() |  |  |
| 9 | `updated_at` | `timestamp without time zone` | ✅ | now() |  |  |

### `reservations` · 356 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `reservation_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `customer_id` | `integer` | ✅ |  |  | Note: This is a Foreign Key to `customers.customer_id`.<fk table='customers' col |
| 3 | `product_id` | `integer` | ✅ |  |  | Note: This is a Foreign Key to `products.product_id`.<fk table='products' column |
| 4 | `staff_id` | `integer` |  |  |  | Note: This is a Foreign Key to `users.user_id`.<fk table='users' column='user_id |
| 5 | `reservation_date` | `date` | ✅ |  |  |  |
| 6 | `reservation_time` | `time without time zone` | ✅ |  |  |  |
| 7 | `duration_minutes` | `integer` | ✅ | 60 |  |  |
| 8 | `customer_request` | `text` |  |  |  |  |
| 9 | `internal_memo` | `text` |  |  |  |  |
| 10 | `created_at` | `timestamp without time zone` | ✅ | CURRENT_TIMESTAMP |  |  |
| 11 | `updated_at` | `timestamp without time zone` | ✅ | CURRENT_TIMESTAMP |  |  |
| 12 | `cancel_reason` | `text` |  |  |  |  |
| 13 | `cancelled_at` | `timestamp without time zone` |  |  |  |  |
| 14 | `cancelled_by` | `character varying` |  |  | 50 |  |
| 15 | `confirmation_sent` | `boolean` | ✅ | false |  |  |
| 16 | `created_by` | `character varying` |  |  | 50 |  |
| 17 | `recurring_group_id` | `integer` |  |  |  |  |
| 18 | `reminder_sent` | `boolean` | ✅ | false |  |  |
| 19 | `status` | `public."ReservationStatus"` | ✅ | confirmed |  |  |
| 20 | `room_id` | `integer` |  |  |  | Note: This is a Foreign Key to `rooms.room_id`.<fk table='rooms' column='room_id |
| 21 | `allocation_id` | `integer` |  |  |  | Note: This is a Foreign Key to `customer_product_allocations.allocation_id`.<fk  |

### `room_products` · 18 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `room_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> This is a Foreign Key to `rooms.room_id`.<fk t |
| 2 | `product_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> This is a Foreign Key to `products.product_id` |
| 3 | `quantity` | `integer` | ✅ | 1 |  |  |

### `rooms` · 10 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `room_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `room_name` | `character varying` | ✅ |  | 50 |  |
| 3 | `max_concurrent` | `integer` | ✅ | 1 |  |  |
| 4 | `is_active` | `boolean` | ✅ | true |  |  |
| 5 | `created_at` | `timestamp without time zone` | ✅ | CURRENT_TIMESTAMP |  |  |
| 6 | `updated_at` | `timestamp without time zone` | ✅ | CURRENT_TIMESTAMP |  |  |
| 7 | `sort_order` | `integer` | ✅ | 0 |  |  |

### `sms_logs` · 6 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `log_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `customer_id` | `integer` |  |  |  | Note: This is a Foreign Key to `customers.customer_id`.<fk table='customers' col |
| 3 | `reservation_id` | `integer` |  |  |  | Note: This is a Foreign Key to `reservations.reservation_id`.<fk table='reservat |
| 4 | `phone_number` | `character varying` | ✅ |  | 20 |  |
| 5 | `recipient_name` | `character varying` |  |  | 100 |  |
| 6 | `message_type` | `character varying` |  |  | 50 |  |
| 7 | `status` | `character varying` |  |  | 20 |  |
| 8 | `message_id` | `character varying` |  |  | 100 |  |
| 9 | `content` | `text` | ✅ |  |  |  |
| 10 | `sent_at` | `timestamp without time zone` |  |  |  |  |
| 11 | `error_code` | `character varying` |  |  | 50 |  |
| 12 | `error_message` | `text` |  |  |  |  |
| 13 | `sent_by` | `integer` |  |  |  | Note: This is a Foreign Key to `users.user_id`.<fk table='users' column='user_id |
| 14 | `is_multiple` | `boolean` | ✅ | false |  |  |
| 15 | `created_at` | `timestamp without time zone` | ✅ | CURRENT_TIMESTAMP |  |  |

### `sms_templates` · 3 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `template_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `name` | `character varying` | ✅ |  | 100 |  |
| 3 | `description` | `character varying` |  |  | 200 |  |
| 4 | `category` | `character varying` |  |  | 50 |  |
| 5 | `content` | `text` | ✅ |  |  |  |
| 6 | `is_active` | `boolean` | ✅ | true |  |  |
| 7 | `is_default` | `boolean` | ✅ | false |  |  |
| 8 | `created_at` | `timestamp without time zone` | ✅ | CURRENT_TIMESTAMP |  |  |
| 9 | `updated_at` | `timestamp without time zone` | ✅ | CURRENT_TIMESTAMP |  |  |

### `staff_schedules` · 7 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `schedule_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `week_start_date` | `date` | ✅ |  |  |  |
| 3 | `schedule_data` | `text` | ✅ |  |  |  |
| 4 | `is_active` | `boolean` | ✅ | true |  |  |
| 5 | `created_at` | `timestamp without time zone` | ✅ | now() |  |  |
| 6 | `updated_at` | `timestamp without time zone` | ✅ | now() |  |  |
| 7 | `created_by` | `character varying` |  |  | 100 |  |
| 8 | `updated_by` | `character varying` |  |  | 100 |  |

### `system_settings` · 0 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `setting_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `setting_key` | `character varying` | ✅ |  | 50 |  |
| 3 | `setting_value` | `text` |  |  |  |  |
| 4 | `setting_type` | `character varying` |  |  | 20 |  |
| 5 | `description` | `text` |  |  |  |  |
| 6 | `created_at` | `timestamp without time zone` | ✅ | now() |  |  |
| 7 | `updated_at` | `timestamp without time zone` | ✅ | now() |  |  |

### `unreflected_customers` · 0 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `original_customer_id` | `integer` |  |  |  |  |
| 3 | `name` | `character varying` | ✅ |  | 100 |  |
| 4 | `phone` | `character varying` |  |  | 20 |  |
| 5 | `email` | `character varying` |  |  | 100 |  |
| 6 | `first_visit_date` | `date` |  |  |  |  |
| 7 | `region` | `character varying` |  |  | 100 |  |
| 8 | `referral_source` | `character varying` |  |  | 100 |  |
| 9 | `health_concerns` | `text` |  |  |  |  |
| 10 | `notes` | `text` |  |  |  |  |
| 11 | `assigned_staff` | `character varying` |  |  | 50 |  |
| 12 | `birth_year` | `integer` |  |  |  |  |
| 13 | `gender` | `character varying` |  |  | 10 |  |
| 14 | `address` | `text` |  |  |  |  |
| 15 | `emergency_contact` | `character varying` |  |  | 20 |  |
| 16 | `occupation` | `character varying` |  |  | 100 |  |
| 17 | `data_source` | `character varying` |  |  | 200 |  |
| 18 | `import_date` | `timestamp without time zone` | ✅ | now() |  |  |
| 19 | `import_notes` | `text` |  |  |  |  |
| 20 | `created_at` | `timestamp without time zone` | ✅ | now() |  |  |
| 21 | `updated_at` | `timestamp without time zone` |  |  |  |  |
| 22 | `status` | `character varying` | ✅ | pending | 20 |  |

### `users` · 23 rows

| # | 컬럼 | 타입 | 필수 | 기본값 | 최대 길이 | 설명 |
|---|---|---|---|---|---|---|
| 1 | `user_id` | `integer` | ✅ |  |  | Note: This is a Primary Key.<pk/> |
| 2 | `email` | `character varying` | ✅ |  | 100 |  |
| 3 | `password_hash` | `character varying` | ✅ |  | 255 |  |
| 4 | `name` | `character varying` | ✅ |  | 50 |  |
| 5 | `role` | `character varying` |  |  | 20 |  |
| 6 | `is_active` | `boolean` | ✅ | true |  |  |
| 7 | `created_at` | `timestamp without time zone` | ✅ | CURRENT_TIMESTAMP |  |  |
| 8 | `updated_at` | `timestamp without time zone` | ✅ | CURRENT_TIMESTAMP |  |  |

---

## 4. 후속 과제 (본 덤프 기반)

1. **(A) 금액대 재검증**: `customers.total_revenue` 컬럼이 이미 집계되어 있음 → 바로 분포 추출 가능
2. **(B) 매출 정합성**: `payments`에 status 컬럼 없음 → `notes`, `payment_method`, `deleted` 플래그 점검 필요. `payment_details.purchase_type`에 REFUND 유형이 없고 샘플이 14건뿐이라 환불 로직은 백엔드 코드 리뷰 필수
3. **(C) seo DB 통합 sync**: `customers`, `payments`, `packages`, `reservations`, `product_usage`가 핵심. `_prisma_migrations`와 운영 테이블 중 sync 우선순위 아래 §5에 정리

## 5. seo DB 통합 대상 우선순위 (제안)

| 우선 | 테이블 | Rows | 목적 |
|---|---|---|---|
| P0 | `customers` | 1,074 | 바이오컴×커피 크로스 조인 키(phone) 생성 |
| P0 | `payments` | 1,018 | 고객별 누적 구매액 산정 |
| P1 | `packages` | 43 | AIBIO 특전 원가 파악 (웰니스 회원권 단가) |
| P1 | `product_usage` | 11,092 | 세션 빈도 → 리텐션 분석 |
| P2 | `reservations` | 356 | 예약 리드타임 · 방문 주기 분석 |
| P2 | `marketing_leads` | 465 | 유입→전환 퍼널 |
| P3 | 기타 | — | 필요 시 추가 |

## 6. 한계 · 주의

- `.env` secret key는 server-only 키이므로 프론트엔드 코드에 절대 노출 금지
- Supabase RLS(Row Level Security) 정책 존재 여부 미확인 — service_role 키는 RLS를 우회하므로 정책 설계가 있다면 동기화 시 주의
- `_prisma_migrations`로 보아 Prisma schema 파일 확인 시 정식 FK 관계·enum·index까지 확인 가능 → aibio-backend 레포 접근 권한 확보 후 추가
