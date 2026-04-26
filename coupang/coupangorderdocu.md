## **1. 개요**

쿠팡은 두 개의 판매 채널을 운영하고 있으며, 각 채널은 서로 다른 API와 테이블로 적재됩니다.

|채널|설명|수집 테이블|계정 수|
|---|---|---|---|
|2P 로켓그로스 (RG)|쿠팡이 물류와 배송을 대행하는 풀필먼트 위탁 채널|`tb_coupang_orders_rg`|1 (바이오컴)|
|3P 마켓플레이스 (MP)|판매자가 직접 배송하는 오픈마켓 채널|`tb_coupang_orders_mp`|2 (바이오컴, 팀키토)|

쿠팡 전체 매출을 산정할 때는 두 채널의 데이터를 합산하여 집계하여야 합니다.

---

## **2. 테이블 상세**

### **2.1 `tb_coupang_orders_rg` — 로켓그로스 주문**

로켓그로스(2P) 채널의 주문 데이터입니다. 주문 아이템 단위로 한 행이 적재되며, 주문번호·상품·수량·단가 중심의 경량 스키마로 구성되어 있습니다. 배송 및 수령인 정보는 포함되어 있지 않습니다.

|컬럼|타입|설명|
|---|---|---|
|id|integer PK|자동 증가 식별자|
|vendor_id|varchar(20)|쿠팡 판매자 ID (바이오컴 1개)|
|order_id|bigint|쿠팡 주문번호|
|paid_at|varchar(50)|결제일시 (epoch 밀리초 문자열 형태, 예: `"1712304000000"`)|
|vendor_item_id|bigint|쿠팡 옵션(아이템) ID|
|product_name|varchar(500)|상품명|
|sales_quantity|integer|판매 수량|
|unit_sales_price|integer|단가 (원)|
|currency|varchar(10)|통화 코드 (고정값 `KRW`)|
|synced_at / created_at / updated_at|timestamp|적재 메타|

**활용 시 참고사항**

- `paid_at` 컬럼이 epoch 밀리초 문자열이므로, 일 단위 집계 시 `to_timestamp(paid_at::bigint / 1000)` 로 변환하여 사용합니다.
- `order_id + vendor_item_id` 조합이 사실상 유일 키 역할을 하며, 적재 로직은 UPSERT 방식으로 동작합니다.

### **2.2 `tb_coupang_orders_mp` — 마켓플레이스 주문**

마켓플레이스(3P) 채널의 주문 데이터입니다. `shipment_box_id × vendor_item_id` 단위로 한 행이 적재되어 분할 배송에 대응하며, 주문 헤더(주문자·수령인·배송) 정보와 아이템(상품·가격) 정보를 함께 담고 있습니다.

하나의 `order_id`가 여러 택배로 분할 배송될 경우 `shipment_box_id`가 다수 생성됩니다. 따라서 주문 건수 집계 시 기준 컬럼 선택에 따라 결과가 달라질 수 있으니 "활용 시 참고사항" 항목을 참고하시기 바랍니다.

### **2.2.1 계정 식별**

|컬럼|타입|설명|
|---|---|---|
|vendor_id|varchar(20)|쿠팡 판매자 ID|
|account_name|varchar(20)|계정 구분자 (`biocom` / `teamkito`). 계정별 집계 시 본 컬럼을 기준으로 사용합니다.|

### **2.2.2 주문 헤더**

|컬럼|타입|설명|
|---|---|---|
|shipment_box_id|bigint|배송 박스 단위 ID (분할 배송 시 여러 개 생성)|
|order_id|bigint|쿠팡 주문번호|
|ordered_at|timestamp|주문일시|
|paid_at|timestamp|결제일시 (timestamp 타입으로 저장되며, RG 테이블과 형식이 상이합니다)|
|status|varchar(30)|주문 상태 (`ACCEPT` / `INSTRUCT` / `DEPARTURE` / `DELIVERING` / `FINAL_DELIVERY` / `NONE_TRACKING`)|
|shipment_type|varchar(30)|배송 타입|
|split_shipping|boolean|분할 배송 여부|
|shipping_price|integer|배송비|
|refer|varchar(30)|구매 경로|
|parcel_print_message|text|택배 인쇄 메시지 (고객 요청사항)|

### **2.2.3 주문자 및 수령인**

|컬럼|타입|비고|
|---|---|---|
|orderer_name, orderer_email, orderer_safe_number, orderer_phone|—|주문자 정보 (개인정보)|
|receiver_name, receiver_safe_number, receiver_phone|—|수령인 정보|
|receiver_addr1, receiver_addr2, receiver_post_code|—|배송지 주소|

개인정보에 해당하는 컬럼은 대시보드 노출 시 마스킹 처리가 필요하며, 대량 추출 시 별도의 보안 검토 절차를 준수하시기 바랍니다.

### **2.2.4 배송**

|컬럼|타입|설명|
|---|---|---|
|delivery_company_name|varchar(100)|택배사명|
|invoice_number|varchar(100)|운송장 번호|
|invoice_number_upload_date|timestamp|운송장 등록일|
|in_transit_datetime|timestamp|출고일|
|delivered_date|timestamp|배송 완료일|

### **2.2.5 주문 아이템**

|컬럼|타입|설명|
|---|---|---|
|vendor_item_id|bigint|쿠팡 옵션 ID|
|vendor_item_name|varchar(500)|옵션명|
|seller_product_id|bigint|쿠팡 상품 ID|
|external_vendor_sku_code|varchar(100)|자사 SKU 코드 (매핑된 경우에 한함)|
|shipping_count|integer|배송 수량|
|sales_price|integer|판매 단가|
|order_price|integer|주문 금액 (할인 전 단가 × 수량 기준)|
|discount_price|integer|총 할인액|
|instant_coupon_discount|integer|즉시할인쿠폰 할인액|
|downloadable_coupon_discount|integer|다운로드쿠폰 할인액|
|coupang_discount|integer|쿠팡 부담 할인액|
|estimated_shipping_date|varchar(30)|예상 배송일 (문자열 원본)|

### **2.2.6 원본 및 메타**

|컬럼|타입|설명|
|---|---|---|
|raw_data|jsonb|쿠팡 API 응답 원본. 추후 컬럼이 추가될 경우 재파싱에 활용할 수 있습니다.|
|synced_at / created_at / updated_at|timestamp|적재 메타. UPSERT 시 `updated_at`이 자동 갱신됩니다.|

### **2.2.7 인덱스**

- PK: `id`
- UK: `(shipment_box_id, vendor_item_id)` — UPSERT 키
- `(vendor_id, paid_at DESC)` — 계정별 최신 주문 조회용
- `(order_id)` — 주문번호 역조회용
- `(status, paid_at DESC)` — 상태별 필터링용

### **2.2.8 활용 시 참고사항**

**일별 매출 집계 (아이템 단위 합산)**

```sql
SELECT
    account_name,
    DATE(paid_at AT TIME ZONE 'Asia/Seoul') AS d,
    SUM(order_price) AS gross,
    SUM(order_price - COALESCE(discount_price, 0)) AS net
FROM tb_coupang_orders_mp
WHERE paid_at >= NOW() - INTERVAL '30 days'
GROUP BY 1, 2
ORDER BY 2 DESC, 1;
```

**주문번호 단위 주문 수 (분할 배송 1건을 1주문으로 카운트)**

```sql
SELECT
    account_name,
    DATE(paid_at AT TIME ZONE 'Asia/Seoul') AS d,
    COUNT(DISTINCT order_id) AS order_count
FROM tb_coupang_orders_mp
GROUP BY 1, 2;
```

**최근 7일 상태 분포**

```sql
SELECT account_name, status, COUNT(*)
FROM tb_coupang_orders_mp
WHERE paid_at >= NOW() - INTERVAL '7 days'
GROUP BY 1, 2
ORDER BY 1, 2;
```

**운송장 미등록 주문 조회**

```sql
SELECT account_name, order_id, paid_at, status
FROM tb_coupang_orders_mp
WHERE invoice_number IS NULL
  AND status NOT IN ('FINAL_DELIVERY')
ORDER BY paid_at DESC;
```

---

## **3. 수집 스케줄러 현황**

쿠팡 주문 데이터는 Google Cloud Scheduler(`asia-northeast3`, 프로젝트 `biocom-dashboard`)에서 관리되며, Cloud Run 서비스 `dashboard-backend`의 엔드포인트를 호출하는 방식으로 동작합니다.

|Job 이름|실행 시각 (KST)|호출 엔드포인트|적재 테이블|
|---|---|---|---|
|`dashboard-coupang-incremental-sync`|02:05, 17:05|`/api/scheduler/coupang/incremental-sync`|`tb_coupang_orders_rg`|
|`dashboard-coupang-marketplace-incremental-sync`|02:20, 17:20|`/api/scheduler/coupang/marketplace-incremental-sync`|`tb_coupang_orders_mp`|

두 잡의 실행 시각을 15분 간격으로 분리한 이유는, 동시에 실행될 경우 쿠팡 API 동시 호출량이 증가하여 Rate Limit에 도달할 가능성이 있기 때문입니다.

### **3.1 로켓그로스 잡 동작**

쿠팡 Open API에서 어제~오늘 범위의 주문을 조회한 뒤 `tb_coupang_orders_rg` 테이블에 UPSERT 방식으로 적재합니다.

### **3.2 마켓플레이스 잡 동작**

각 계정(`biocom`, `teamkito`)에 대하여 다음 절차를 순차 수행합니다.

1. 어제~오늘 범위의 주문을 전체 상태(6종)로 조회 후 UPSERT
2. 오늘 기준 10일 전 ~ 어제 범위의 주문을 조회 후 UPSERT (상태·운송장·배송일 변동 반영)

쿠팡 API 제약 사항에 대응하기 위하여 다음과 같은 처리를 포함합니다.

- `status` 파라미터는 1회 호출당 1개만 지정 가능하므로, 6종(ACCEPT / INSTRUCT / DEPARTURE / DELIVERING / FINAL_DELIVERY / NONE_TRACKING) 상태를 순회 호출합니다.
- `createdAtFrom ~ To` 기간은 1회 호출당 최대 7일까지만 허용되므로, 10일 Lookback 구간은 2개의 청크로 분할하여 호출합니다.
- 호출 사이 0.7초의 지연을 두며, 429 및 5xx 응답에 대해 지수 백오프 방식으로 최대 3회 재시도합니다.

### **3.3 수동 실행 방법**

운영 중 수동 동기화가 필요한 경우 다음 방식으로 실행할 수 있습니다.

```bash
TOKEN=$(gcloud secrets versions access latest --secret dashboard-prod_SCHEDULER_API_TOKEN --project biocom-dashboard)

# 로켓그로스
curl -X POST <https://dashboard-backend-831866869450.asia-northeast3.run.app/api/scheduler/coupang/incremental-sync> \\
  -H "X-Scheduler-Token: $TOKEN"

# 마켓플레이스
curl -X POST <https://dashboard-backend-831866869450.asia-northeast3.run.app/api/scheduler/coupang/marketplace-incremental-sync> \\
  -H "X-Scheduler-Token: $TOKEN"
```

응답은 `202 Accepted` 이며, 실제 동기화는 백그라운드에서 진행됩니다. 실행 결과는 Cloud Run 로그 또는 DB의 `synced_at` 값으로 확인할 수 있습니다.

### **3.4 실행 로그 확인**

```bash
gcloud logging read '
  resource.type="cloud_run_revision"
  AND resource.labels.service_name="dashboard-backend"
  AND textPayload:"coupang_marketplace_incremental_sync"
' --limit 20 --project biocom-dashboard --format json
```

---

## **4. 전용 조회 API**

백오피스 내부에서 사용하는 조회용 엔드포인트입니다. 인증이 필요하며 자세한 스펙은 Swagger 문서를 참고하시기 바랍니다.

|엔드포인트|용도|
|---|---|
|`GET /api/orders/coupang/orders`|로켓그로스 주문 목록 조회 (페이지네이션, 날짜 및 상품명 필터 지원)|

마켓플레이스 전용 조회 API는 현재 별도로 제공되지 않으며, SQL 직접 조회 또는 BI 도구의 테이블 바인딩을 통해 데이터를 활용하실 수 있습니다. 향후 요구에 따라 추가 가능합니다.

---

## **5. 통합 조회 쿼리 예시**

### **5.1 쿠팡 전체 일 매출 (RG + MP 합산)**

```sql
WITH rg AS (
    SELECT DATE(to_timestamp(paid_at::bigint / 1000) AT TIME ZONE 'Asia/Seoul') AS d,
           SUM(sales_quantity * unit_sales_price) AS revenue,
           'rg' AS channel
    FROM tb_coupang_orders_rg
    WHERE paid_at ~ '^[0-9]+$'
      AND to_timestamp(paid_at::bigint / 1000) >= NOW() - INTERVAL '30 days'
    GROUP BY 1
),
mp AS (
    SELECT DATE(paid_at AT TIME ZONE 'Asia/Seoul') AS d,
           SUM(order_price - COALESCE(discount_price, 0)) AS revenue,
           'mp' AS channel
    FROM tb_coupang_orders_mp
    WHERE paid_at >= NOW() - INTERVAL '30 days'
    GROUP BY 1
)
SELECT d, SUM(revenue) AS total_revenue,
       SUM(revenue) FILTER (WHERE channel = 'rg') AS rg_revenue,
       SUM(revenue) FILTER (WHERE channel = 'mp') AS mp_revenue
FROM (SELECT * FROM rg UNION ALL SELECT * FROM mp) u
GROUP BY d ORDER BY d DESC;
```

### **5.2 마지막 동기화 시각 확인**

```sql
SELECT 'orders_rg' AS tbl, MAX(synced_at) FROM tb_coupang_orders_rg
UNION ALL
SELECT 'orders_mp', MAX(synced_at) FROM tb_coupang_orders_mp;
```

### **5.3 MP 중복 적재 검증 (정상 시 0 건)**

```sql
SELECT shipment_box_id, vendor_item_id, COUNT(*)
FROM tb_coupang_orders_mp
GROUP BY 1, 2 HAVING COUNT(*) > 1;
```

---

## **6. 참고 문서 및 소스**

- 적재 로직: [backend/app/tasks/coupangApi/marketplace_client.py](https://file+.vscode-resource.vscode-cdn.net/Users/shinwoo/Desktop/Biocom/repo/integral-backoffice/backend/app/tasks/coupangApi/marketplace_client.py), [backend/app/tasks/coupangApi/api_client.py](https://file+.vscode-resource.vscode-cdn.net/Users/shinwoo/Desktop/Biocom/repo/integral-backoffice/backend/app/tasks/coupangApi/api_client.py)
- ORM 모델: [backend/app/models/coupang.py](https://file+.vscode-resource.vscode-cdn.net/Users/shinwoo/Desktop/Biocom/repo/integral-backoffice/backend/app/models/coupang.py)
- 스케줄러 라우터: [backend/app/api/scheduler.py](https://file+.vscode-resource.vscode-cdn.net/Users/shinwoo/Desktop/Biocom/repo/integral-backoffice/backend/app/api/scheduler.py)
- 테이블 DDL: [backend/scripts/migrate_coupang_marketplace.sql](https://file+.vscode-resource.vscode-cdn.net/Users/shinwoo/Desktop/Biocom/repo/integral-backoffice/backend/scripts/migrate_coupang_marketplace.sql)
- 배포 가이드: [docs/쿠팡마켓플레이스_배포가이드.md](https://file+.vscode-resource.vscode-cdn.net/Users/shinwoo/Desktop/Biocom/repo/integral-backoffice/docs/%EC%BF%A0%ED%8C%A1%EB%A7%88%EC%BC%93%ED%94%8C%EB%A0%88%EC%9D%B4%EC%8A%A4_%EB%B0%B0%ED%8F%AC%EA%B0%80%EC%9D%B4%EB%93%9C.md)