# 아임웹 엑셀 다운로드 vs API · 백필 전략 검토

작성일: 2026-04-24
검토 대상 파일: `data/coffee/기본_양식_20260424133106.xlsx` (더클린커피 2025년 1년치 자사몰+네이버페이 주문)

---

## 1. 결론 (먼저)

| 데이터 | 권장 수집 방식 | 이유 |
|---|---|---|
| **더클린커피 2025년** | ✅ 엑셀 (이미 받음) | 마스킹 없음 · 12개월 정합 |
| **더클린커피 2024년 이하** | ✅ **엑셀로 받기 권장** | 이 시기는 PG에 마스킹 데이터만 존재 (자사몰 89% 마스킹). LTV·재구매 분석 위해 비마스킹 필수 |
| **바이오컴 6.5년치** | ⚠️ **선택적 엑셀** | PG `tb_iamweb_users`에 6.5년치 비마스킹 데이터 이미 있음 (97,407건, paid_price·phone 정상). API/PG 백필 우수. 엑셀은 보충 목적만. |
| **결제내역 다운로드** | ✅ **받기 권장** | Toss·네이버페이 정산 검증 + Toss 외 결제 수단(KakaoPay·이체 등) 누락분 발견에 결정적 |
| **API 단독으로 충분?** | ❌ **부족** | (a) 페이지네이션 한계 (b) v2 API의 phone 마스킹 응답 (c) 과거 데이터 한계 |

**핵심 권장**: **백필은 엑셀 + 운영 incremental은 API 하이브리드**. 더클린커피 2024년·2023년 엑셀 추가 다운로드를 다음 우선순위로.

---

## 2. 받은 엑셀 분석

### 2.1 파일 구조

- 행: **16,454행** (주문 단위 아님 · 옵션·품목 단위로 펼쳐진 행)
- 컬럼: **38개**
- 고유 주문번호: **11,018건**
- 고유 전화번호: **4,089명** (정규화 후)
- 기간: 2025-01-01 08:12 ~ 2025-12-31 22:32 (정확히 2025년 1년)

### 2.2 컬럼 매핑 — PG 대비 추가 정보

| 항목 | 엑셀 | PG `tb_playauto_orders` | PG `tb_iamweb_users` |
|---|---|---|---|
| 주문번호 | ✅ `주문번호` | ✅ `shop_ord_no` (공백 분리 변형) | ✅ `order_number` |
| 주문자 이름 | ✅ **전체** (`전숙희`) | ⚠️ 마스킹 (`전숙*`) | ❓ 일부 null |
| **주문자 이메일** | ✅ **전체 보유** | ❌ 컬럼 없음 | ✅ `customer_email` |
| **주문자 전화번호** | ✅ **전체** (`010-8990-2578`) | ⚠️ **89% 마스킹** (`010-8***-2578`) | ✅ `customer_number` |
| 수령자 정보 | ✅ 전체 | ⚠️ 마스킹 | ❌ 없음 |
| **배송지 전체 주소** | ✅ 전체 | ⚠️ 마스킹 | ❌ 없음 |
| 상품명·옵션명 | ✅ | ✅ `shop_sale_name`/`shop_opt_name` | ✅ `product_name`/`option_name` |
| 금액 (최종/할인/배송) | ✅ 4컬럼 분리 | ⚠️ `pay_amt`만 (대부분 0) | ✅ `paid_price`·`final_order_amount`·`item_price` 등 |
| **취소사유·반품사유** | ✅ | ❌ | ✅ `cancellation_reason`·`return_reason` |
| 배송송장 | ✅ | ✅ | ❌ |
| 주문일 | ✅ datetime | ✅ `ship_plan_date` (배송 기준) | ✅ `order_date` |

**엑셀 고유 가치**: ① **phone 비마스킹** ② **이메일** ③ **수령자 분리 정보** ④ **할인 구조 4분할** ⑤ **취소 사유**

### 2.3 채널별 매출 (거래종료 기준 12개월)

| 채널 | 완료 주문 | 매출 |
|---|---|---|
| 더클린 커피 자사몰 | 7,588 | **₩278,189,557 (2.78억)** |
| 네이버페이-주문형 | 25 | ₩903,800 |
| **합계** | **7,613** | **₩279,093,357** |

> 참고: 네이버페이 5,365행 중 거래종료는 25건뿐. 네이버페이는 별도 정산 흐름이라 "거래개시" 단계가 압도적이며, 실 매출 검증은 별도 네이버 정산내역 필요.

### 2.4 PG `tb_sales_toss` 비교

- Toss store=coffee 12개월 net: ₩57,011,477
- 엑셀 자사몰 거래종료 12개월: **₩278,189,557**
- **차이 약 5배** — 의미: Toss는 카드 결제 일부만, 자사몰 전체 결제(포인트·이체·KakaoPay·네이버페이)는 훨씬 큼. 또는 Toss store=coffee 데이터가 일부만 sync 됐을 가능성

→ **엑셀 백필이 없었다면 더클린커피 진짜 매출 규모(2.78억)는 영영 모를 수 있었음**

### 2.5 월별 분포 (안정적 운영 확인)

| 월 | 주문 수 |
|---|---|
| 2025-01 | 1,510 |
| 2025-02 | 1,900 |
| 2025-03 | 1,427 |
| 2025-04 | 1,332 |
| 2025-05 | 1,449 |
| 2025-06 | 1,128 |
| 2025-07 | 1,316 |
| 2025-08 | 1,475 |
| 2025-09 | 1,637 |
| 2025-10 | 1,210 |
| 2025-11 | 997 |
| 2025-12 | 1,073 |

월 평균 약 1,371건 · 안정적 우상향 추세

---

## 3. 엑셀 vs API 비교 분석

### 3.1 아임웹 v2 Open API 한계

| 항목 | 한계 | 영향 |
|---|---|---|
| 페이지네이션 | 페이지당 100건 · 최신순만 | 과거로 갈수록 느려짐 · 1년치 ≒ 100~200 페이지 호출 |
| `maxPage` 제한 | 코드상 500 (실용 120) | 약 6~12개월 이내만 안정적 백필 |
| **phone 마스킹** | 2021년 이후 정책상 일부 마스킹 | LTV·재구매 phone 기반 분석 불가 |
| Rate limit | 명시 없으나 빈번 호출 시 토큰 만료·429 | 야간 1회만 가능 |
| 인증 토큰 갱신 | 1시간 만료 | 장시간 백필 시 토큰 재발급 로직 필요 |
| 응답 깊이 | option·품목별 nested · 파싱 복잡 | 엑셀이 이미 평탄화된 표 |

### 3.2 엑셀 다운로드의 한계

| 항목 | 한계 | 완화 |
|---|---|---|
| 수동 작업 | 사람이 관리자 페이지 방문 → 다운 | 월 1회 백필이면 수용 가능 |
| 동기화 지연 | 다운로드 시점 스냅샷 (실시간 X) | 운영용은 API/Toss 사용 |
| 대용량 시 | 10만+ 건은 분할 다운로드 필요 | 분기별 분할 |
| 포맷 변경 위험 | 아임웹이 양식 바꾸면 import 코드 깨짐 | 포맷 자동 검증 스크립트 필요 |

### 3.3 추천 하이브리드 전략

| 용도 | 방식 |
|---|---|
| 과거 백필 (2024년 이전 등) | **엑셀 일괄** |
| 직전 12개월 정합 분석 | **엑셀 (정합성 우선)** |
| 매일 운영 (당일 신규 주문) | **API incremental** (`POST /api/crm-local/imweb/sync-orders`) |
| 결제·정산 검증 | **결제내역 엑셀** + Toss API 교차확인 |
| 회원 정보 | **API** (이미 작동 중 · `imweb_members` 13,338명) |

---

## 4. 사용자 질문 3가지 답변

### Q1. 더클린커피 2024년 이전도 엑셀로 받으면?

**✅ 매우 도움됨.**

- PG `tb_playauto_orders` 아임웹-C 41,312건 - 2025년 약 11,000건 = **약 30,000건이 2024년 이하**. 그런데 phone 89% 마스킹.
- 엑셀로 2024·2023·2022년 받으면:
  - 마스킹 해제 → **phone 기반 24~36개월 LTV 분석 가능**
  - "1회 구매 후 12개월 내 재구매" 같은 코호트 분석 가능
  - 통합 멤버십 전략 2의 PRIME/PLATINUM 후보를 더 정확히 식별
- **권장**: 2024년 → 2023년 → 2022년 순으로 1년 단위 다운로드

### Q2. 바이오컴도 엑셀로?

**⚠️ 우선순위 낮음 (보조 목적만).**

- 바이오컴은 PG `tb_iamweb_users`에 **6.5년치 97,407건이 비마스킹으로 존재**. paid_price·customer_number 모두 정상. 별도 백필 불필요.
- 다만 PG에 없는 정보(이메일·취소사유 등) 보강 목적이면 1년치 받아볼 가치 있음.
- 바이오컴 연간 주문이 약 2~4만건이라 엑셀 분할 다운로드 시간 큼.
- **권장**: 먼저 1개월 샘플 받아서 PG와 컬럼 매핑 검증 후 판단.

### Q3. API로 충분한가?

**❌ 부족.** 4가지 이유:

1. **phone 마스킹**: 2021년 이후 v2 API 응답에 부분 마스킹. 자사 어드민 다운로드만 비마스킹.
2. **페이지 한계**: maxPage 120 (실용) → 6~12개월. 더 과거는 사실상 불가.
3. **금액 정확도**: API 응답의 `pay_amt`가 엑셀 `최종주문금액`과 다를 수 있음 (할인·포인트 분해).
4. **취소/반품 사유**: API는 별도 status API 호출 필요(`sync-order-statuses`), 엑셀은 한 행에 통합.

**결론**: API는 운영 incremental에는 충분, **백필·정합성 분석에는 엑셀이 필수**.

---

## 5. 결제내역 다운로드 추가 검토

### 5.1 결제내역 vs 주문내역 차이

| 항목 | 주문내역 (이번 받은 엑셀) | 결제내역 |
|---|---|---|
| 단위 | 주문 (배송지 단위) | 결제 (PG 거래 단위) |
| 부분취소 | "취소사유"만 | 부분취소 금액·날짜 분리 |
| 결제 수단 | 표시 안 됨 | **카드/이체/포인트/네이버페이 분리** |
| PG 정산 | 없음 | **승인번호·승인일·매입일** |
| 환불 시점 | "반품사유"만 | **환불 시점 + 환불 금액** 정확 |

### 5.2 가치

- **Toss 매출 ₩57M vs 엑셀 매출 ₩278M의 5배 차이 원인** 규명 가능. 결제 수단별 분포 보면 Toss store=coffee 외 결제 비중이 어디서 오는지 식별.
- **네이버페이 거래개시 5,346건**의 실제 매출 확인 (네이버페이 정산 API와 매칭).
- **부분환불 정확성** — 주문은 1회, 환불은 분할인 경우 결제내역만이 진실.

### 5.3 권장

**✅ 같이 받기 권장.** 동일 기간(2025년) 결제내역 다운로드 후:
1. 주문내역과 `주문번호` 매칭
2. 결제 수단별 매출 분포 추출
3. Toss `tb_sales_toss` 와 결제내역의 `승인번호` 일치율 측정 → sync 누락분 확인

---

## 6. 다음 액션 제안

| 우선 | 작업 | 비고 |
|---|---|---|
| P0 | 받은 엑셀(2025년) → SQLite/PG로 import 스크립트 작성 | `coffee_orders_2025` 테이블 신설 · phone 비마스킹 LTV 분석 즉시 가능 |
| P0 | 동일 양식 **결제내역 2025년 다운로드** → 같이 import | Toss 5배 차이 규명 |
| P1 | **더클린커피 2024년 주문+결제 엑셀 다운로드** | 12~24개월 LTV 분석 풀 가동 |
| P1 | 통합 등급 v3 산정 (커피 비마스킹 LTV 반영) | `unified-tier-v3.cjs` |
| P2 | 더클린커피 2023·2022년 엑셀 다운로드 | 코호트 분석용 |
| P3 | 바이오컴 1개월 엑셀 샘플로 PG 매칭 검증 | 보강 가치 판단용 |
| P3 | 엑셀 import 자동화 (drop folder 감지) | 정기 백필 운영화 |

---

## 7. 엑셀 import 스키마 제안 (참고)

```sql
CREATE TABLE IF NOT EXISTS coffee_orders_excel (
  row_id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT,                       -- '더클린 커피 (the clean coffee)' / '네이버페이-주문형'
  order_no TEXT NOT NULL,             -- 주문번호
  status TEXT,                        -- 거래종료 / 거래개시
  total_item_amount INTEGER,          -- 총 품목합계금액
  total_discount INTEGER,             -- 총 합계 할인금액
  total_shipping INTEGER,             -- 총 합계 배송비
  total_points_used INTEGER,          -- 총 합계 포인트 사용액
  final_amount INTEGER,               -- 최종주문금액
  orderer_name TEXT,                  -- 주문자 이름
  orderer_email TEXT,                 -- 주문자 이메일
  orderer_phone TEXT,                 -- 주문자 번호 (정규화 별도 컬럼)
  orderer_phone_norm TEXT,            -- 정규화 phone
  ship_method TEXT,
  ship_pay_method TEXT,
  invoice_no TEXT,
  section_no TEXT,                    -- 주문섹션번호
  section_item_no TEXT,
  qty INTEGER,
  product_name TEXT,
  option_name TEXT,
  unit_price INTEGER,
  item_grade_discount INTEGER,
  item_points_used INTEGER,
  item_coupon_discount INTEGER,
  item_paid_price INTEGER,
  receiver_name TEXT,
  receiver_phone TEXT,
  receiver_phone_norm TEXT,
  ship_country_code TEXT,
  ship_zip TEXT,
  ship_addr1 TEXT,
  ship_addr2 TEXT,
  ship_memo TEXT,
  carrier TEXT,
  cancel_reason TEXT,
  return_reason TEXT,
  cancel_reason_detail TEXT,
  return_reason_detail TEXT,
  ordered_at TEXT,                    -- 주문일 (datetime)
  product_uniq_no TEXT,
  source_file TEXT,                   -- 원본 엑셀 파일명 (재import 추적)
  imported_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_coe_phone ON coffee_orders_excel(orderer_phone_norm);
CREATE INDEX IF NOT EXISTS idx_coe_orderno ON coffee_orders_excel(order_no);
CREATE INDEX IF NOT EXISTS idx_coe_date ON coffee_orders_excel(ordered_at);
CREATE INDEX IF NOT EXISTS idx_coe_status ON coffee_orders_excel(status);
```

위 스키마로 가져오면 즉시:
- `SELECT orderer_phone_norm, SUM(final_amount) FROM coffee_orders_excel WHERE status='거래종료' GROUP BY 1 ORDER BY 2 DESC` — 진짜 더클린커피 LTV
- `SELECT cancel_reason, COUNT(*) FROM coffee_orders_excel WHERE cancel_reason IS NOT NULL GROUP BY 1` — 취소 사유 분석

---

## 8. 참고

- 원본 엑셀: `data/coffee/기본_양식_20260424133106.xlsx`
- 비교 대상 PG 테이블: `tb_playauto_orders` (shop_name=`아임웹-C`), `tb_sales_toss` (store=`coffee`)
- 마스킹 실태: `data/dbstructure.md` §5.4 (PG 89% 마스킹)
- 통합 등급 영향: `data/dbstructure.md` §5.5 (커피 842명 중 마스킹 해제 시 1,000+ 추정)
