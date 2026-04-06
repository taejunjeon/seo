# Data Check 0406

기준일: 2026-04-06  
작성 목적: GA4, Toss, Imweb, PlayAuto 간 데이터 연관성과 현재 정합성 수준을 운영 관점에서 점검하고, 다음 액션과 신규 솔루션 필요 여부를 정리한다.

## 1. 한줄 결론

- 지금 가장 필요한 것은 새 솔루션 도입이 아니라 `식별자 규칙 정리 + 동기화 범위 확대 + 일일 대사(reconciliation)`다.
- 현재 스택만으로도 `운영 의사결정`은 가능하다.
- 다만 `채널별 LTV`, `광고별 ROAS`, `고객 단위 귀속`을 믿고 집행하기에는 아직 정합성이 부족하다.
- 특히 약한 고리는 `GA4 ↔ 실제 결제`와 `Imweb local ↔ 전기간 Toss` 구간이다.

## 2. 점검 범위

- 로컬 API: `GET /health`
- 로컬 API: `GET /api/attribution/ledger`
- 로컬 API: `GET /api/attribution/toss-join`
- 로컬 API: `GET /api/crm-phase1/ops?startDate=2026-03-01&endDate=2026-03-30`
- 로컬 SQLite: `backend/data/crm.sqlite3`
- 운영 Postgres: `tb_sales_toss`, `tb_playauto_orders`

## 3. 현재 상태 요약

### 3-1. GA4

- `crm-phase1/ops` 기준 2026-03-01 ~ 2026-03-30에 `GA4 (not set)` 구매 `896건`, 매출 `₩148,523,642`가 잡힌다.
- 같은 응답에서 `distinctTransactionIds=2,291`, `purchaseEvents=2,481`, `duplicatePurchaseEvents=190`, `transactionCoverageRatio=92.34%`다.
- 즉 GA4는 구매 이벤트를 꽤 잡고 있지만, `source / medium / campaign` 귀속 품질은 아직 약하다.
- 현재 coffee 문서 기준으로는 `GA4_PROPERTY_ID_COFFEE=326949178` 접근 권한이 없어 커피 property는 직접 조회가 막혀 있다.
- 관측성 문제도 있다. `health`는 현재 `env.GA4_PROPERTY_ID`만 보므로 `GA4_BIOCOM_PROPERTY_ID` 기반 실제 조회 성공과 다르게 `ga4=false`처럼 보일 수 있다.

### 3-2. Toss

- 로컬 SQLite 기준 `toss_transactions=37,959건`, `distinct payment_key=34,011건`이다.
- 로컬 SQLite 기준 `toss_settlements=2,942건`, 거래-정산 `payment_key` 직접 매칭은 `2,921건`이다.
- 즉 로컬 Toss 거래 원장은 꽤 넓어졌지만, 정산 원장은 아직 전체 기간을 충분히 따라오지 못했다.
- 커피 store는 0406 기준 `4,194 결제건`, `1,371 정산건`이 local에 있다.
- backend는 now `store=biocom|coffee`를 지원하고, biocom/coffee 둘 다 실제 orderId 조회가 성공한다.

### 3-3. Imweb

- 로컬 SQLite `imweb_members`는 현재 `biocom 69,924`, `thecleancoffee 13,253`, `aibio 100`건이다.
- 로컬 SQLite `imweb_orders`는 현재 `thecleancoffee 1,937건`만 들어 있다.
- 즉 회원 캐시는 다사이트 성격이 있지만, 주문 캐시는 사실상 `커피 쪽만 local 반영`된 상태다.
- 커피 주문 `1,937건`은 전부 `orderer_call`, `member_code`를 가지고 있어 주문 원장 자체의 필드 완전성은 좋다.
- 다만 주문 `1,937건` 중 회원 테이블과 `member_code`로 직접 붙는 건 `1,046건`으로, 주문-회원 직접 결합률은 `54.0%`다.

### 3-4. PlayAuto

- 운영 DB `tb_playauto_orders`는 `115,316행`, `93,249 distinct order`다.
- 전체 행의 `89.5%`가 `pay_amt=0`이다.
- 즉 PlayAuto는 `매출 정본`이 아니라 `상품/출고/전화번호 축`으로 보는 것이 맞다.
- 다만 Toss와 붙는 subset에서는 전화번호 계열(`order_htel` 또는 `to_htel`)이 `100%` 존재했다.
- Toss와 붙는 subset에서 `pay_amt=0` 비율도 `100%`라서, 고객 식별과 상품 분석에는 좋지만 매출 계산 기준으로는 부적합하다.

### 3-5. Attribution Ledger

- `/api/attribution/ledger` 기준 전체 엔트리는 `306건`이다.
- 이 중 `payment_success=304`, `live=296`, `replay=5`, `smoke=3`이다.
- `paymentKey`가 들어 있는 엔트리는 `268건`, `orderId`가 들어 있는 엔트리는 `304건`이다.
- `gaSessionId`가 들어 있는 엔트리는 `2건`뿐이다.
- 해석: `결제 성공 로그`는 잡히기 시작했지만, `GA4 세션과 결제의 직접 연결축`은 아직 거의 없다.

## 4. 소스 간 연결 강도

| 연결축 | 현재 평가 | 근거 |
|---|---:|---|
| GA4 ↔ Toss | 55/100 | 일자 단위 비교는 가능하지만 직접 join key가 약하다. ledger의 `gaSessionId`는 `2/306`뿐이고, 3월에는 `GA4 매출은 있는데 live receiver가 없는 날`이 대부분이다. |
| Toss ↔ Attribution | 68/100 | 최근 `/api/attribution/toss-join` 100건 샘플은 `78%`가 `payment_key`로 붙는다. 다만 3월 전체 window로 보면 live capture가 늦게 붙어 `5%` 수준으로 보이는 구간이 있다. |
| Toss ↔ Imweb | 64/100 | 커피 local 기준 전체 커버리지는 `Imweb→Toss 33.6%`, `Toss→Imweb 15.6%`다. 다만 겹치는 기간(2025-12~2026-02)만 보면 `Imweb→Toss 50.7%`, `Toss→Imweb 62.9%`로 올라간다. 즉 핵심 문제는 조인 키보다 `기간/동기화 범위 차이`다. |
| Toss ↔ PlayAuto | 91/100 | 운영 DB 기준 전체 `81.3%` 매칭, coffee `99.6%`, biocom `79.4%`다. order id 구조는 매우 강하다. |
| Imweb ↔ Members | 74/100 | 커피 주문은 필드 완전성이 좋지만, `member_code` 직접 결합률은 `54.0%`라 회원 기반 CRM 분류에는 추가 보정이 필요하다. |
| GA4 ↔ Attribution | 42/100 | UTM 텍스트는 남지만 세션 키가 거의 없어서 광고 효율을 고객 단위로 닫기 어렵다. |

## 5. 무엇을 믿어야 하는가

### 5-1. 지금 매출 정본으로 가장 믿을 수 있는 것

- `Toss`가 1순위다.
- 이유는 `order_id`, `payment_key`, `amount`, `status`, `m_id(store)`가 가장 명확하기 때문이다.
- 단, `정산 수수료`까지 포함한 순수익 관점은 local settlement가 덜 찬 상태라 보수적으로 봐야 한다.

### 5-2. 지금 고객 식별로 가장 믿을 수 있는 것

- `PlayAuto 전화번호 + Imweb 주문자 전화번호/회원코드` 조합이 가장 실무적이다.
- Toss에는 고객 식별자가 거의 없으므로, 고객 단위 LTV는 결국 `Toss 금액`을 `Imweb/PlayAuto 식별자`에 붙여야 한다.

### 5-3. 지금 채널 귀속으로 가장 위험한 것

- `GA4 source/medium/campaign → 실제 결제`를 그대로 믿는 것.
- `(not set)` 매출이 크고, `gaSessionId` 연결이 거의 없어서 아직은 `참고지표`에 가깝다.

## 6. 점수표

점수는 “지금 당장 운영 숫자로 써도 되는가” 기준의 주관 점수다.

| 항목 | 점수 | 해석 |
|---|---:|---|
| 매출 정합성 | 84/100 | Toss가 강하고 biocom/coffee 분기도 닫혔다. 다만 settlement coverage는 아직 약하다. |
| 고객 식별 정합성 | 72/100 | Imweb/PlayAuto에 전화번호와 회원코드는 있지만 정식 customer spine이 없다. |
| 주문-결제 조인 정합성 | 77/100 | PlayAuto↔Toss는 강하다. Imweb↔Toss는 기간 불일치가 남아 있다. |
| 마케팅 귀속 정합성 | 54/100 | GA4 `(not set)`이 크고 session-level join이 거의 없다. |
| 운영 관측성 | 67/100 | health와 실제 상태가 어긋나는 항목이 있고, attribution ledger가 정식 DB 테이블이 아니다. |
| 전체 운영 활용도 | 73/100 | 운영 판단에는 충분하다. 다만 “광고비 1원 단위 최적화”까지 가기엔 아직 이르다. |

## 7. 현재 스택으로 충분한가

### 결론

- **당장은 충분하다.**
- 새 SaaS/CDP를 급히 붙일 단계는 아니다.
- 지금의 문제는 도구 부재보다 `식별자 표준화`, `동기화 범위`, `일일 대사` 부족에 가깝다.

### 새 솔루션이 당장 필요하지 않은 이유

- Toss 결제 truth는 확보됐다.
- PlayAuto와의 주문 조인도 꽤 강하다.
- Imweb 회원/주문 축도 최소한의 CRM 연결에는 쓸 수 있다.
- attribution live 수집도 시작됐다.

### 예외적으로 고려할 만한 추가 솔루션

- `GA4 BigQuery export`
  - 목적: raw event 수준 검증, transaction_id 중복 추적, `(not set)` 원인 역추적
  - 판단: 있으면 좋지만 지금 가장 먼저 할 일은 아니다.
- `정식 warehouse/dbt`
  - 목적: fact table 정규화, 비개발자용 분석 재사용
  - 판단: 데이터 모델을 먼저 안정화한 뒤에 가는 것이 맞다.
- `Segment/CDP류`
  - 판단: 지금 단계에서는 과하다. 먼저 현재 스택의 식별자 품질을 올리는 편이 ROI가 높다.

## 8. 정합성을 더 높이는 방법

### P0. 바로 해야 할 것

1. `order_id_base`, `payment_key`, `normalized_phone`를 공통 표준 키로 고정한다.
2. attribution ledger를 JSONL이 아니라 정식 DB 테이블로 승격한다.
3. `checkout_context`, `payment_success`에 `ga_session_id`, `client_id`, `user_pseudo_id`를 함께 남긴다.
4. biocom Imweb 주문도 local cache에 넣어 `Imweb ↔ Toss`를 커피처럼 직접 검증 가능하게 만든다.
5. Toss settlement 페이지네이션/backfill을 끝내서 `수수료 포함 순매출` 기준을 닫는다.

### P1. 이번 주 안에 하면 좋은 것

1. 일일 대사 리포트를 만든다.
2. 기준: `GA4 purchases`, `Toss approvals`, `attribution payment_success`, `Imweb orders`, `PlayAuto distinct order`.
3. 이 리포트는 “수치가 다르면 왜 다른지”를 보여 줘야 한다.
4. 특히 `Toss는 있는데 attribution 없음`, `GA4는 있는데 Toss 없음`, `Imweb는 있는데 Toss 없음`을 자동 표시해야 한다.

### P2. 다음 단계

1. customer spine 테이블을 만든다.
2. 추천 키: `store`, `normalized_phone`, `member_code`, `order_id_base`, `payment_key`.
3. 이렇게 되면 LTV, 재구매율, 메시지 실험군 성과를 한 축으로 볼 수 있다.

## 9. 앞으로의 운영 계획

### 1주 계획

- biocom Imweb 주문 local sync 추가
- attribution ledger DB 승격
- payment success payload에 GA4 session/client 식별자 보강
- Toss settlement backfill 확대

### 2주 계획

- `join_quality` 대시보드 신설
- store별 `Imweb ↔ Toss`, `Toss ↔ PlayAuto`, `GA4 ↔ attribution` 조인율을 매일 기록
- coffee KPI를 0406 backfill 기준으로 재산출

### 1개월 계획

- customer spine 기반 LTV/재구매/광고 귀속 리포트 통합
- 필요 시 그 시점에만 BigQuery export 또는 정식 warehouse를 검토

## 10. 최종 판단

- 지금은 **새 솔루션을 더 붙일 시점이 아니다.**
- 현재 스택으로도 `결제 truth`, `주문 truth`, `출고/전화번호 truth`, `최근 attribution truth`는 각각 확보되고 있다.
- 문제는 truth가 없는 것이 아니라, truth끼리 이어 주는 `공통 키`와 `정식 대사 루틴`이 약하다는 점이다.
- 즉, 다음 성과는 “도구 교체”가 아니라 `정규화`, `백필`, `일일 검증`, `운영 대시보드화`에서 나온다.
