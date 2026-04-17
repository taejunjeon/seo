# 운영 DB 상태 보고서

- 작성일: 2026-04-14
- 작성자: TJ 요청 → Claude Code 조사
- 대상 DB: `postgresql://bico_readonly:***@34.47.95.104:5432/dashboard`
- 접근 계정: `bico_readonly` (read-only)
- 관련 코드 리포지토리: `/Users/vibetj/coding/revenue` (백엔드 Python FastAPI, 스케줄러 `app/tasks/scheduler.py`)

---

## 1. 요약 한 줄

운영 DB는 **핵심 3~4개 테이블만 정상 동기화**되고 있고, 나머지 상당수는 수 주~수 개월 단위로 멈춰 있음. 특히 `tb_playauto_orders`(멀티채널 스마트스토어/쿠팡 등)는 약 **한 달째 갱신 중단**, `tb_teamketo_*`는 **9개월째 중단**, `tb_imweb_member`는 **0행**이오. 그리고 전체 동기화/적재 현황을 한눈에 볼 수 있는 감사 로그(sync audit trail)가 사실상 없는 상태요.

---

## 1.5 🚨 `tb_playauto_orders` 한 달 정지 — 왜 이게 심각한가

> 이 섹션은 **"토스·아임웹이 주문 다 받고 있는데 플레이오토가 멈춰도 상관없지 않나?"**라는 질문에 정확히 답하기 위해 별도로 떼낸 심층 분석이오. 결론부터 말하면 **상관 있소. 많이 상관 있음.** 이유를 아래에 차곡차곡 쌓았음.

### 1.5.1 가장 큰 오해 — "플레이오토는 하나의 채널이다"

이 오해가 가장 위험함. 실제 플레이오토는 **채널이 아니라 "여러 채널의 주문을 하나로 합쳐주는 OMS(Order Management System)"**요. 쿠팡·스마트스토어·아임웹·기타 쇼핑몰의 주문을 플레이오토가 **한 화면에서 통합 관리**해주는 SaaS이오.

증거 — `tb_playauto_orders`의 `shop_name` 컬럼 집계 (전체 115,316행 기준):

| shop_name | 행수 | 비율 |
| --------- | ---- | ---- |
| 아임웹 (A~E 5개 스토어 합산) | **91,990** | 약 80% |
| 스마트스토어 (기본) | 5,291 | 4.6% |
| 스마트스토어-B | 6,866 | 6.0% |
| 쿠팡 | 10,881 | 9.4% |
| 직접입력 (수동) | 278 | 0.2% |
| 바이오컴-앱(수동) | 10 | <0.1% |

→ 즉 `tb_playauto_orders`는 **"여러 스토어의 주문이 하나의 통합 OMS에 모인 결과물"**이지, **별도의 제3의 채널이 아니오**. 아임웹만 해도 A~E까지 5개 변종 스토어가 이 테이블 안에서 통합 관리되고 있음.

### 1.5.2 "토스·아임웹으로 주문 다 받고 있으면 플레이오토 없어도 되지 않나?"

답: **주문 자체는 들어오고 있지만, 플레이오토에만 있는 정보가 여럿 있음.** 차이를 표로 정리하면:

| 정보 | `tb_iamweb_users` | `tb_naver_orders` | `tb_coupang_orders` | `tb_sales_toss` | **`tb_playauto_orders`** |
| ---- | ------------------ | ------------------ | ------------------- | --------------- | -------------------------- |
| 주문 자체 | ✅ 아임웹만 | ✅ 네이버만 | ✅ 쿠팡만 | ✅ 토스 결제 건만 | ✅ **전 채널 통합** |
| 결제 금액 | ✅ | ✅ | 일부 | ✅ | ✅ |
| **배송 상태** (배송완료/배송중/취소 등) | 부분 | 일부 | 일부 | ❌ | ✅ **(ord_status 컬럼)** |
| **택배사(carr_name)** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **송장번호(invoice_no)** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **배송 지연 여부(ship_delay_yn)** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **창고(depot_name)** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **배송 예정일(ship_plan_date)** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **직접입력/앱 수동 주문** | ❌ | ❌ | ❌ | ❌ | ✅ **(유일)** |
| 주소·수령인 | 일부 | ✅ | ✅ | ❌ | ✅ (통일된 포맷) |

**핵심 포인트 3개**:

1. **배송/운영 상태를 가진 유일한 테이블**. 아임웹·네이버·쿠팡 원천 테이블에는 "결제됨" 이후의 **"지금 이 주문이 어디쯤 가고 있는가"가 없음**. 플레이오토만이 `ord_status ∈ {신규주문, 주문재확인, 출고대기, 출고보류, 운송장출력, 배송중, 배송완료, 취소완료, 반품완료, 교환요청, 구매결정 ...}`를 통합적으로 유지.
2. **실제 운영 집계는 플레이오토 상태 기준**. 예를 들어 "구매 확정된 매출"은 플레이오토의 `ord_status='구매결정'` 기준으로 잡히오. 쿠팡 원천엔 그 상태가 없음. 토스는 결제 이벤트만 가짐.
3. **수동 입력 주문(`직접입력`, `바이오컴-앱(수동)`)은 오직 플레이오토에만 존재**. 오프라인·전화·앱 매뉴얼 주문은 다른 어떤 테이블에도 안 뜸.

### 1.5.3 플레이오토가 멈추면 구체적으로 뭐가 깨지나

실제로 1개월째 멈춘 상태에서 영향 받는 것들을 구체적 업무 단위로:

| 업무 | 영향 | 심각도 |
| ---- | ---- | ------ |
| **배송 지연 모니터링** | `ship_delay_yn`을 아무도 갱신 못 하니 "배송 지연인 주문이 몇 건인가?"라는 질문이 답을 못 얻음. CS 쪽에서 "택배 어디쯤이에요?"라고 문의가 와도 DB에서는 1개월 전 송장 정보만 나옴. | 🔴 높음 |
| **구매 확정 매출 집계** | `ord_status='구매결정'`으로 잡히는 확정 매출이 3월 13일 이후 데이터가 없음. 회계팀 월 결산에서 차이 발생. | 🔴 높음 |
| **멀티채널 통합 리포트** | 대시보드에서 "전 채널 오늘 매출"을 볼 때, 아임웹·네이버·쿠팡·수동 입력을 합산하려면 플레이오토가 최신이어야 함. 현재는 **수동 입력분이 3월 13일 이후 전부 누락**됨. | 🟠 중간 |
| **택배사 정산 교차 검증** | 월말 택배사(우체국·CJ·한진 등)가 보내주는 청구서를 DB의 `carr_name`·`invoice_no`로 대조하는 작업. 4월분부터 불가능. | 🟠 중간 |
| **반품/취소율 추적** | `ord_status='반품완료'`, `'취소완료'` 비율로 품질 지표 계산. 1개월 밀림. | 🟠 중간 |
| **CS 인바운드 대응** | 고객이 "주문번호 XXX 배송 상태 알려주세요" 문의 시, 3월 13일 이후 주문은 DB로 답할 수 없음. 직원이 플레이오토 SaaS 화면에 직접 들어가서 확인해야 함(DB 경유 자동화 불가). | 🟠 중간 |
| **LTR/코호트 재계산** | 매일 03:00에 도는 `cohort_cache` cron은 플레이오토 기반 구매 이력을 사용함. 1개월째 같은 수치를 반환하고 있을 가능성 높음. | 🟡 낮음~중간 (원본 SQL 확인 필요) |
| **직접입력/앱 주문 추적** | 전화·오프라인 매뉴얼 주문은 오직 이 테이블에만 있음. 1개월째 누락 상태라면, 그 주문들이 어디서 재고·CRM으로 흘러가는지 경로 자체가 끊겨 있음. | 🟠 중간 |

### 1.5.4 "그럼 플레이오토 없이 다른 테이블로 대체할 수 있나?"

결론: **부분 대체는 가능하지만 완전 대체는 불가능**.

가능한 것:
- 아임웹 결제 자체는 `tb_iamweb_users`에 살아있음 → 매출 원천 데이터는 있음.
- 토스 결제는 `tb_sales_toss`에 살아있음 → 결제 시점·PG사 정합성은 확인 가능.
- 네이버·쿠팡 원천 주문은 `tb_naver_orders` / `tb_coupang_orders`에 살아있음.

불가능한 것:
- **배송 상태**(ord_status) — 어느 원천 테이블에도 통합된 형태로 없음.
- **송장·택배사** — 원천 테이블엔 없음. 플레이오토 SaaS가 택배사와 직접 연동되는 지점이라 여기만 가짐.
- **구매 확정 상태** — 쿠팡·네이버의 구매 확정 이벤트가 자동으로 플레이오토 쪽에 반영되고 거기서만 통합 집계됨.
- **직접입력·앱 수동 주문** — 다른 어느 테이블에도 안 나타남.

즉 **"매출 숫자"는 다른 테이블로 대체 가능하지만, "배송·운영·품질 지표"는 플레이오토 없이는 DB 경유로 계산할 방법이 없음**. 이것이 플레이오토의 고유 역할이오.

### 1.5.5 seo 프로젝트 관점에서의 영향

seo 프로젝트는 직접적으로 배송·운영 지표를 많이 쓰진 않고, 주로 **광고/attribution/ROAS** 쪽에 집중되어 있소. 그래서 토스·아임웹·네이버·쿠팡 원천 테이블이 살아있는 한 **광고 효과 측정은 당장 박살나진 않음**. 그런데도 영향이 있음:

1. **재주문/재구매 분석 왜곡**. 재주문 코호트는 "구매 확정" 상태를 기준으로 잡는데, 그 상태가 플레이오토에만 있음. `vw_repurchase_rate_new` 같은 뷰가 1개월 밀린 상태로 반환될 위험.
2. **수동 입력 주문의 CAPI/ROAS 누락**. `직접입력`·`바이오컴-앱(수동)` 주문은 아임웹·네이버·쿠팡 원천엔 없고 오직 플레이오토에만 있음. seo의 CAPI 이벤트 매칭에서 이 주문들을 누락할 위험.
3. **취소/환불 보정 지연**. 광고 ROAS 계산 시 "취소된 주문은 빼야 함"인데, 취소 상태는 플레이오토가 통합 관리. 1개월 밀리면 취소 반영 전 매출로 ROAS가 **과대평가**됨.

이 3가지는 지금 당장 대시보드가 터지지는 않지만, **수치를 서서히 거짓말로 만듦**. 특히 3번(취소 보정 지연)은 ROAS를 실제보다 좋게 보이게 만들기 때문에 **광고 예산을 잘못된 방향으로 집행하게 되는 조용한 독**이오.

### 1.5.6 한 줄 결론

> **`tb_playauto_orders`는 다른 채널과 겹치는 "또 하나의 주문표"가 아니라, 배송 상태·통합 상태·수동 주문을 담당하는 "OMS의 진실 소스"오. 1개월 정지는 매출 숫자 자체보다 배송/운영/품질/취소보정 전반을 조용히 왜곡시키는 문제이고, seo 프로젝트에서는 특히 ROAS 과대평가와 재구매 코호트 왜곡으로 이어질 수 있음.**

→ 따라서 §6의 P0 1번(`tb_playauto_orders` sync 복구)은 **숫자 1개 고치는 수준의 요청이 아니라, 운영 전체의 진실 소스를 되살리는 요청**이오. 개발팀에 전달할 때 이 섹션을 함께 보여주는 것이 맥락 전달에 좋겠음.

---

## 1.6 🛡️ "구매 확정 상태"를 플레이오토 외에 이중으로 만들 수 있는가 — Toss/Imweb API 재검증

> 이 섹션은 **"운영 DB에 없더라도 Toss API·Imweb API로 VM에 임시 구현해서 플레이오토와 이중 보완할 수 있는가?"**라는 질문에 답하기 위해 별도로 떼낸 분석이오. 참고 문서: `/Users/vibetj/coding/seo/tossapi.md`, `/Users/vibetj/coding/seo/imwebapi.md`.

### ⚠️ 정정(Errata) — 이 섹션은 2026-04-14 재조사로 한 번 크게 수정됐소

- **초판(파기됨)**의 핵심 주장**: "구매 확정을 API 하나로 직접 가져오는 것은 불가능. Toss + tb_iamweb_users + Imweb complete_time 3신호 합의로 근사치만 가능."
- **이것은 틀렸소.** TJ가 "정말 없는 것 맞아?"라고 다시 물어본 이유가 있었음. 재조사 결과:
  1. **Imweb v2 API에는 `PURCHASE_CONFIRMATION` 상태가 명시적으로 존재함**. 공식 문서(`old-developers.imweb.me/orders/get`)에 9개 enum 값 중 하나로 확정되어 있음. "주문관리 v2 전용" 표시됨.
  2. **Imweb `complete_time`의 의미도 공식 확정**: "**전체 상품 배송완료 시각**"(Integer Unix timestamp). 내가 "결제인지 배송인지 주문인지 검증 필요"라고 쓴 것은 문서를 안 읽고 단정한 실수였소.
  3. **Toss API에는 구매 확정 개념이 진짜로 없음**. PG 특성상 결제 상태(`DONE`/`CANCELED`/`ABORTED`/`EXPIRED`)만 관리함. 이 부분은 초판이 맞았음.
  4. 우리 기존 `imweb_orders` 캐시(`backend/data/crm.sqlite3`)는 **`status` 필드를 추출하지 않고 있음**. `raw_json`에 뭉쳐 저장만 됨. 그리고 현재 호출 URL(`/v2/shop/orders?offset=&limit=`)에는 `order_version=v2` 파라미터가 빠져 있어서 `PURCHASE_CONFIRMATION`이 결과에 올라오지 않을 가능성 높음.
- **수정 후의 핵심 주장**: **Imweb v2 API 한 개만 제대로 호출하면 "구매 확정" 상태를 직접 가져올 수 있소**. 3신호 합의 같은 복잡한 대체 근사치 로직은 필요 없음. 그냥 API 호출 방식과 저장 스키마를 수정하면 됨.

아래 내용은 정정 후 기준이오.

---

### 1.6.1 결론 한 줄 (정정 후)

**Imweb v2 API가 `status='PURCHASE_CONFIRMATION'`을 직접 반환함**. 이것을 seo VM의 기존 `imweb_orders` 캐시에 새 컬럼(`imweb_status`)으로 꺼내고, **v2 플래그를 붙여 재호출**하면, 플레이오토 `ord_status='구매결정'`의 아임웹 주문분(80%)은 **근사치가 아니라 정본으로 이중 보완 가능**. 공수는 초판 추정(1~2일)보다 **훨씬 작음(4~6시간)**. 쿠팡/네이버/수동 20%는 여전히 이 경로로 커버 불가 — 이 부분은 플레이오토가 유일한 소스.

### 1.6.2 "구매 확정"이 정확히 뭔가

한국 이커머스에서 "구매 확정"은 결제 완료가 아니오. 플레이오토와 Imweb 둘 다 같은 정의를 씀:

1. 결제 완료
2. 배송 완료
3. 반품·교환 기간 경과 OR 고객이 "구매 확정" 버튼 클릭
4. 취소·환불 없음

**중요한 건**: Imweb 플랫폼이 이 4단계 상태 머신을 **자체적으로 관리함**. 우리는 그것을 그대로 읽어오면 됨. Imweb이 쇼핑몰 플랫폼이라서 당연한 일이었는데, 초판은 "3신호 합성으로 근사" 방향으로 에둘러 갔음.

### 1.6.3 각 API가 줄 수 있는 신호 매트릭스 (정정 후)

| 조건 | Toss API | Imweb API v2 (재확인) | 운영 DB `tb_iamweb_users` | 운영 DB `tb_playauto_orders` |
| ---- | -------- | --------------------- | -------------------------- | ---------------------------- |
| 1. 결제 완료 | ✅ `status='DONE'` | ✅ `status='PAY_COMPLETE'` 이상 | ✅ `payment_status='PAYMENT_COMPLETE'` | ✅ |
| 2. 배송 완료 | ❌ PG | ✅ **`status='COMPLETE'`** (그리고 `complete_time`이 채워짐) | ❌ | ✅ `ord_status='배송완료'` |
| 3. 구매 확정 | ❌ PG에 개념 없음 | ✅ **`status='PURCHASE_CONFIRMATION'`** (주문관리 v2 전용) | ❌ | ✅ `ord_status='구매결정'` |
| 4. 취소·환불 | ✅ `cancel` 필드 | ✅ `status∈{CANCEL, RETURN, EXCHANGE}` | ✅ `cancellation_reason`/`return_reason` | ✅ |

**Imweb v2 API `status` 필드 전체 enum 값** (공식 문서 기준):

| status | 의미 |
| ------ | ---- |
| `PAY_WAIT` | 입금대기 |
| `PAY_COMPLETE` | 결제완료 |
| `STANDBY` | 배송준비중/배송대기 |
| `DELIVERING` | 배송중 |
| `COMPLETE` | 배송완료 (전체 상품 배송 끝났으나 아직 구매 확정 전) |
| **`PURCHASE_CONFIRMATION`** | **구매확정** (v2 전용) |
| `CANCEL` | 취소완료 |
| `RETURN` | 반품완료 |
| `EXCHANGE` | 교환완료 |

→ **플레이오토 `ord_status` enum과 거의 1:1 대응됨.** 이건 우연이 아니라 같은 쇼핑몰 상태 머신을 다른 도구가 표현하는 방식의 차이요.

### 1.6.4 Toss는 왜 여전히 못 쓰는가 — 확정

`tossapi.md`와 공식 문서 재확인 결과:

- `GET /v1/transactions` 응답의 `Transaction` 객체에는 `status` 필드가 있지만 값은 **결제 성공/실패/취소** 수준(`DONE`/`CANCELED`/`ABORTED`/`EXPIRED`).
- `GET /v1/payments/{paymentKey}` 응답에도 마찬가지. `cancel` 배열은 있으나 "구매 확정" 플래그는 없음.
- 정산(`/v1/settlements`)도 결제 대사·정산 대사용이라 라이프사이클 상태는 다루지 않음.

이유: **Toss는 PG(결제대행)**이오. 상점이 고객으로부터 돈을 받는 순간까지만 관여함. 그 뒤의 배송·구매 확정·반품은 쇼핑몰 플랫폼(Imweb/스마트스토어/쿠팡)의 영역임. PG가 이 정보를 가질 이유가 없소.

→ Toss는 **결제·취소 정합성 검증 용도**로만 쓰고, "구매 확정"은 Imweb에서 직접 읽는 것이 유일한 정석 경로.

### 1.6.5 우리 현재 코드 기준 — 무엇을 놓치고 있었는가

로컬 `imweb_orders` 캐시에 저장된 raw JSON 샘플(2026-04-12 biocom 주문):

```json
{
  "order_code": "o202604127d1a5930ca6e1",
  "order_no": "202604121410057",
  "order_type": "shopping",
  "order_time": 1775962478,
  "complete_time": 0,
  "orderer": { ... },
  "payment": { "pay_type": "npay", "payment_amount": 11900, ... },
  "cash_receipt": { ... }
}
```

- **top-level `status` 필드가 없음**. 이것이 내가 "Imweb에 구매 확정이 없다"고 단정한 근거였으나, **사실은 이 호출이 v1 포맷으로 응답받고 있기 때문**일 가능성이 큼.
- `complete_time: 0`은 "배송 완료 안 됨"을 의미함. 이걸 `complete_time` 필드의 의미 불명으로 해석한 것도 실수였음. 문서가 분명히 "전체 상품 배송완료 시각"이라고 썼소.
- 우리 기존 `imweb_orders` 캐시 통계: biocom 8,362건 중 **7,469건(89.3%)이 `complete_time_unix > 0`** = 배송 완료 상태. 10.7%는 아직 배송 전.

→ 이미 우리는 "배송 완료"까지는 DB에서 바로 뽑을 수 있소. 남은 건 "구매 확정" 상태를 v2 API로 꺼내는 것만.

### 1.6.6 그럼 수정된 구현 계획

**목표**: Imweb v2 API의 `status` 필드를 `imweb_orders` 캐시에 `imweb_status` 컬럼으로 추가. `PURCHASE_CONFIRMATION` 값을 직접 집계해서 플레이오토의 `구매결정`을 대체.

**단계**:

1. **Imweb v2 API 응답에 `status`가 실제 오는지 확인**. `/v2/shop/orders?order_version=v2&offset=1&limit=5`로 샘플 호출 → 응답 JSON에 `status` 필드가 들어오는지 검증. 만약 안 들어오면, `/v2/shop/orders/{order_no}` 개별 상세 호출에도 똑같이 `order_version=v2` 붙여 재확인. **소요: 30분**
2. **`imweb_orders` 테이블에 `imweb_status TEXT` 컬럼 추가** (`ALTER TABLE`). 기존 행은 NULL로 남김. **소요: 10분**
3. **`toImwebOrderRow()`(`routes/crmLocal.ts:570`)에 `imweb_status: String(order.status ?? "")` 한 줄 추가**. 기존 INSERT/UPSERT에 포함. **소요: 20분**
4. **`sync-orders` 엔드포인트 호출 URL에 `order_version=v2` 파라미터 추가**. **소요: 10분**
5. **전체 재sync 1회** (biocom 기준 약 8천 건, 수 분). **소요: 10분 + 실행 대기**
6. **집계 엔드포인트 `/api/crm-local/imweb/purchase-confirm-stats` 신설**:
   - `SELECT imweb_status, COUNT(*), SUM(payment_amount) FROM imweb_orders WHERE site=? GROUP BY imweb_status`
   - 반환: `{ total, paid, delivered, purchase_confirmed, canceled, returned, exchanged, ... }`
   - **소요: 1시간**
7. **ads 대시보드 카드 추가**: "Imweb 구매 확정 매출(플레이오토 독립 검증)". 플레이오토 `구매결정` 숫자와 비교 delta 표시. **소요: 1시간**
8. **한계 배지**: "이 숫자는 아임웹 경로 주문만 포함(약 80%). 쿠팡/네이버/수동 주문은 플레이오토 필수." **소요: 15분**

**합계**: **약 4~6시간**. 초판의 "1~2일"보다 훨씬 작음. 3신호 합성 로직이 통째로 삭제됐기 때문이오.

### 1.6.7 이중 보완 구조 다이어그램 (정정 후)

```
                       [구매 확정 상태]
                              │
           ┌──────────────────┼──────────────────┐
           ▼                                     ▼
  [PRIMARY: 플레이오토]                  [BACKUP: Imweb v2 API 직접]
   tb_playauto_orders                     imweb_orders.imweb_status
   ord_status='구매결정'                   = 'PURCHASE_CONFIRMATION'
   (전 채널 포함)                          (아임웹 경로만, 약 80%)
           │                                     │
           │                                     │
           └──── delta 모니터 ─────────────────────┘
                       │
                       ▼
        [두 소스가 일치? 차이 몇 %?]
         → 차이 크면 경고 (한 쪽 오작동 가능)
```

**운영 시나리오**:
- **평시 (playauto 정상)**: primary=플레이오토, backup=Imweb v2. 두 소스의 일일 delta가 작으면 건강. 크면 경고. 이 cross-check 자체가 **품질 지표**로 쓰임.
- **playauto stale (현재)**: Imweb 기반 backup을 기본 소스로 표시. "80% 커버리지 + 쿠팡/네이버/수동 누락" 배지 노출.
- **playauto 복구 후**: primary 복귀, backup은 다시 검증용으로.

### 1.6.8 남아있는 한계 (정정 후에도 유효)

1. **커버리지 80%가 여전히 상한**. Imweb에 없는 주문(쿠팡·네이버·수동입력)은 이 경로로 절대 못 잡음. 플레이오토가 복구되기 전까지 누락.
2. **Imweb v2 상태가 주문 단위인가, section 단위인가 확인 필요**. 공식 문서에 "order 레벨 `status` 필드" 표현이 있지만, 부분 취소·부분 반품 케이스에서 전체 status가 어떻게 계산되는지 샘플 1~2건 확인 필요. 단계 1에서 같이 볼 것.
3. **v1 주문(`order_version=v1`)에는 `PURCHASE_CONFIRMATION`이 없을 수 있음**. 바이오컴이 v1/v2 중 어느 쪽인지 샘플 확인 필수. v1이면 이 전체 계획이 무효가 됨 → 다시 내 실수가 될 수 있으니 단계 1의 검증이 **go/no-go gate**.
4. **레거시 페이지네이션 불안정** (`imwebapi.md` §"현재 중요한 한계"): 더클린커피는 `data_count` 대비 실회수 건수가 낮아 전량 정본으로 보기 어려움. biocom은 상대적으로 안정적이나, coffee 적용은 별도 검증 필요.
5. **`openapi.imweb.me/orders`(v3) 접근 불가** 상태. 현재 토큰으론 401. 만약 v2 레거시에서도 `status` 필드가 안 나오면 v3 OAuth 앱 등록을 해야 하는데 이건 별도 트랙.
6. **여전히 "임시 방편"임**. 플레이오토 복구 요청(§6 P0 1번)을 멈추면 안 됨. 아임웹 독립 경로는 **검증 소스**로 남기고, 플레이오토가 통합 진실 소스로 복귀해야 함.

### 1.6.9 권장 의사결정 (정정 후)

- **단계 1만 먼저 실행** (샘플 호출 30분). 결과에 따라 분기:
  - **Case A — `status` 필드가 실제로 v2 응답에 들어오고 `PURCHASE_CONFIRMATION` 값을 관측함**: 단계 2~8을 당일 내 진행. 4~6시간짜리 작업. §6.6 mirror 구현과 병행 가능.
  - **Case B — `status` 필드가 안 들어옴 (v1 전용 계정/호환성 문제)**: v3 OpenAPI OAuth 앱 등록 또는 `tb_iamweb_users` + Toss 기반 근사치 경로(초판 §1.6.5의 3신호 합성 전략)로 fallback. 이 경우에만 초판의 방향으로 돌아감.
- **`tb_playauto_orders` 복구 요청(§6 P0 1번)은 독립적으로 계속 진행**.
- **이 섹션의 교훈**: **API 문서를 미리 확인하지 않고 "없을 것"으로 단정하지 말 것.** 초판 작성 시 내가 공식 문서를 안 읽고 "근사치로만 가능"이라고 쓴 것은 명백한 실수였소. TJ가 한 번 더 물어본 것이 정정의 계기였음. 이 패턴은 향후에도 조심해야 함 — "어떤 API가 필요한 것을 가지고 있지 않다"는 주장은 **공식 문서 인용 없이는 쓰지 않는다**는 규칙을 적용해야겠음.

---

## 2. 접속/운영 기본 정보

| 항목 | 값 |
| ---- | ---- |
| Host | `34.47.95.104:5432` |
| DB | `dashboard` |
| 전체 테이블 수 | 86 (public 스키마) |
| 읽기 전용 계정 | `bico_readonly` |
| 주요 백엔드 | `revenue/backend` (FastAPI, SQLAlchemy async) |
| 주요 스케줄러 | APScheduler, `app/tasks/scheduler.py` |
| 운영 체인 참고 | seo 프로젝트는 VM(att.ainativeos.net)에서 직접 이 DB의 데이터를 간접 사용함(광고/정산/리포트). |

### 스케줄러 등록 잡 (revenue/backend/app/tasks/scheduler.py)

| Job ID | 주기 | 함수 | 비고 |
| ------ | ---- | ---- | ---- |
| `fetch_and_store_data` | 1일 1회 + 앱 시작시 | iamWeb store API | |
| `fetch_and_product_data` | 1일 1회 + 앱 시작시 | iamWeb product API | |
| `cohort_cache` | 매일 03:00 | cohort 재계산 + LTR 캐시 | |
| `naver_sync` | 매일 04:00 | 네이버 스마트스토어 주문 증분 | |
| `playauto_sync` | 매일 05:00 | 플레이오토 주문 증분 | **등록은 되어 있으나 결과상 1개월째 미실행/실패** |

> **iamWeb 주문 증분 sync**, **쿠팡 주문 증분 sync**, **토스 증분 sync**는 `scheduler.py`에 **job으로 등록되어 있지 않음**. 실제로는 다른 경로(수동 API / 백필 / 이벤트 호출)로 적재되고 있는 것으로 보이니 추적 필요.

---

## 3. 테이블 인벤토리 (최신화 상태 기준)

### ✅ 정상 동기화 (최근 1일 이내)

| 테이블 | 행수 | 최신 데이터 | 마지막 sync | 비고 |
| ------ | ---- | ----------- | ----------- | ---- |
| `tb_iamweb_users` | 96,581 | 2026-04-14 16:55 (order_date) | *synced_at 컬럼 없음* | 바이오컴/더클린커피/AIBIO/PET 등 iamWeb 주문 원천. 사실상 주기적 동기화는 되고 있으나, sync 감사 불가능. |
| `tb_naver_orders` | 3,907 | 2026-04-14 12:45 | 2026-04-14 08:01 | 스케줄러 04:00 cron 정상. |
| `tb_coupang_orders` | 1,196 | `paid_at` 원시값 | 2026-04-14 08:05 | 별도 잡으로 증분 실행 중(스케줄러엔 미등록). |
| `tb_consultation_records` | 8,511 | 2026-04-14 | - | 사내 상담 기록. 내부 툴 기반 입력. |
| `tb_sales_toss` | 7,766 | `approved_at` 2026-04-14 01:40 | 2026-04-13 21:00 | 유일하게 `synced_at` 컬럼이 살아있는 Sales 테이블. |

### ⚠️ 스케줄러 등록되어 있으나 **약 1개월째 멈춤**

| 테이블                  | 행수      | 최신 데이터                      | 마지막 sync         | 정지 기간   |
| -------------------- | ------- | --------------------------- | ---------------- | ------- |
| `tb_playauto_orders` | 115,316 | `ord_time` 2026-03-13 15:18 | 2026-03-13 07:06 | **32일** |

→ `playauto_sync` cron은 매일 05:00에 돌도록 되어 있으나 실제로는 2026-03-13 이후 0건. 예외 처리(로거)만 되고 있어서 침묵 실패 상태.

### ⚠️ 월단위 수동 업로드 기반(그 자체는 정상, 정책 재검토 필요)

`tb_sales_coupang`, `tb_sales_nicepay`, `tb_sales_recovery_lab`, `tb_sales_tax_invoice`, `tb_sales_credit_association`은 `uploaded_at` 기반(수동 CSV 업로드). 현재:

| 테이블 | 행수 | `sales_month` 최신 | 업로드일 |
| ------ | ---- | ------------------ | -------- |
| tb_sales_coupang | 989 | 2026-01 | 2026-03-27 |
| tb_sales_credit_association | 10 | 2026-01 | 2026-03-27 |
| tb_sales_nicepay | 356 | 2026-01 | 2026-03-27 |
| tb_sales_recovery_lab | 15 | 2026-01 | 2026-03-27 |
| tb_sales_tax_invoice | 10 | 2026-01 | 2026-03-27 |
| tb_sales_naver_vat | 1,331 | 2026-03 | 2026-03-31 (synced_at) |

→ `tb_sales_upload_log` 17행, 전부 2026-03-27 단일 세션에서 업로드된 기록. 2월·3월·4월분은 **아직 업로드 자체가 없음**. 이건 회계/정산 프로세스 문제이지 sync 버그는 아니지만, 대시보드에서 사용하는 경우 월말 반영이 2~3주 이상 지연되고 있는 것은 개선 과제.

### 🔴 9개월 이상 멈춘 테이블 (사실상 죽은 싱크)

| 테이블 | 행수 | 최신 데이터 | 멈춤 시점 |
| ------ | ---- | ----------- | --------- |
| `tb_teamketo_cafe24` | 834 | `order_date` 2025-07-25 09:07 | **~9개월 전** |
| `tb_teamketo_smartstore` | 11,031 | `order_time` 2025-07-25 11:36 | **~9개월 전** |
| `tb_laplace` | 92,571 | `결제_일자` 2025-11-03 / `생성일시` 2025-11-04 | **~5개월 전** (일회성 스냅샷으로 추정) |

→ TEAM KETO 브랜드 주문 테이블이 9개월째 멈춰 있다는 건, 사내 어딘가에서 이 데이터를 **쓰고 있다면 잘못된 수치로 사용 중**, **안 쓴다면 테이블만 방치**라는 이분법. 우선 사용처 확인 필요.

→ `tb_laplace`는 한글 컬럼으로 구성된 멀티채널 통합 스냅샷이고 2025-11-04에 일괄 적재 후 손대지 않은 상태. 현재 운영 테이블과는 별개의 분석/이관용 덤프로 보이오.

### 🔴 완전 빈 테이블

| 테이블 | 상태 |
| ------ | ---- |
| `tb_imweb_member` | **0행**. 스키마는 존재하나 적재 로직이 붙지 않았거나 끊긴 상태. |
| `tb_channeltalk_users` | 0행. (`channeltalk_users_20250213` 백업 테이블과 `tb_channeltalk_users`, `channeltalk_users` 3개가 공존하는 것도 난잡함.) |
| `tb_cs_inquiry` | 2행. 거의 비어 있음. |
| `tb_group_buy`, `tb_group_buy_customer` | 0행. 인플루언서 공구 기능의 정식 테이블이 안 쓰이고 있거나 중단 상태. |

### 💥 결과가 항상 비는 뷰

| 뷰 | 상태 |
| -- | ---- |
| `vw_purchase_conversion_details` | `SELECT *` → 0행. `pg_get_viewdef` 반환값 공란(정의 열람 권한 부족 가능). 최소한 "이 뷰는 현재 0행을 돌려주는 상태"라는 것은 사실이고, 대시보드에서 이 뷰를 의존한다면 리포트가 텅 비게 됨. |

---

## 4. 구조적 관찰

### 4.1 sync audit trail이 사실상 없음

- `tb_iamweb_users`: 41개 컬럼 중 `synced_at`, `created_at`, `updated_at` **전무**. 언제 수집되었는지 DB에서는 알 수 없음. `order_date` 최신값으로만 "최근에 들어왔음"을 추정해야 함.
- `tb_sales_*`: 상당수가 `uploaded_at`만 있고 증분 sync 개념이 아님.
- `tb_operation_log`: `domain` 컬럼 값이 실제로는 **`restock` 단 하나뿐**. 주문/멤버/매출 동기화 이벤트는 전혀 기록되지 않음. 즉, "언제 어떤 sync가 실패/성공했는가"를 DB에서 질의할 방법이 없음.

### 4.2 중복/백업 테이블

- `channeltalk_users`, `tb_channeltalk_users`, `channeltalk_users_20250213` 3중 존재.
- `consultation_records`, `tb_consultation_records`, `test_tb_consultation_records` 공존.
- `users`, `bico_user`, `tb_iamweb_users`(사실상 주문표)처럼 네이밍이 일관되지 않음. 신규 개발자가 "사용자"를 찾을 때 혼란 유발.
- `vw_repurchase_*`와 `vw_test_repurchase_*`가 거의 쌍으로 존재 — 테스트용 뷰가 프로덕션 네임스페이스에 살아 있음.

### 4.3 백필 잡 스턱

- `tb_iamweb_backfill_jobs`: 1행. `jisoo`가 요청한 2026-01 ~ 2026-02 구간 백필 잡이 **`status=running`으로 2026-04-06부터 8일째 종료되지 않고 있음**. 진행률 757/3343건. 애플리케이션 재시작 시 복구 로직이 없는 것으로 보이오.

### 4.4 멀티채널 조인의 취약성

- `vw_multichannel_orders`는 13,254행으로 정상이지만, 기반이 되는 `tb_playauto_orders`가 1개월 밀려 있으므로 이 뷰의 결과도 1개월 밀려 있음. 리포트를 보는 사람이 **"왜 3월 후반부터 숫자가 떨어졌지?"** 라고 해석할 수 있는 위험.

---

## 5. seo 프로젝트 관점에서의 영향

- 우리 VM 백엔드(`capivm/att.ainativeos.net`)는 이 DB의 주문/매출 데이터를 직접 읽지는 않고, seo 프로젝트 내 `backend/src/routes/ads.ts`와 attribution 라우트를 통해 광고 ROAS·CAPI 지표에 쓰이오. 결론적으로 **현재 ads 대시보드 숫자는 `tb_playauto_orders` 기반 리포트와 비교하면 이미 정합성이 깨진 상태**라는 점은 인지하고 가야 하오.
- `ltr_customer_cohort` / `ltr_cohort_cache`는 03:00 cron으로 매일 재계산되고 있으나, 인풋이 되는 `tb_playauto_orders`가 멈춰 있다면 코호트 수치도 1개월째 같은 값을 반환하고 있을 가능성이 큼. **코호트 리포트 수치가 이상하다는 보고가 있으면 이 cron을 먼저 의심**해야 함.

---

## 6. 개발팀에 전달할 개선 제안

우선순위는 P0 → P2 순. 요청의 "왜"를 함께 써두었소. 본인들이 반박/수락하기 쉽도록 근거를 함께 붙임.

### P0 — 즉시 대응 (이번 주)

1. **`tb_playauto_orders` sync 복구**
   - 현황: `playauto_sync` cron이 2026-03-13 이후 0건. `scheduler.py`에 등록은 되어 있으나 실제로는 안 돎.
   - 요청: ① cron 실제 실행 여부 확인(APScheduler job 상태, 프로세스 로그), ② 실패 시 알림 채널 연결, ③ 과거 한 달치 백필.
   - 효과: `vw_multichannel_orders`, `vw_purchase_conversion_details`, ROAS 리포트, 코호트 재계산이 현실과 다시 맞아떨어짐.

2. **sync 실패 사일런트 문제 해결**
   - 현황: `app/tasks/scheduler.py` 내 모든 sync 함수가 `try/except`로 로거만 찍고 삼킴. 그 결과 한 달째 아무도 모르고 있었음.
   - 요청: slack/메일/노티 중 하나로 실패 시 자동 알림. 최소한 `tb_operation_log`에 `domain='sync', action='naver/playauto/coupang/iamweb', status='ok/fail'`로 적재.

3. **`tb_iamweb_backfill_jobs` 스턱 잡 정리**
   - 2026-04-06에 시작된 백필 잡이 8일째 `running` 상태. 애플리케이션 재시작 시 고아가 되는 구조로 보이오.
   - 요청: 시작 시 `orphaned running` 잡 탐지 & 자동 `failed` 처리. 타임아웃 기반 하트비트 권장.

### P1 — 2주 내

4. **`tb_iamweb_users`에 `synced_at`, `created_at`, `updated_at` 컬럼 추가**
   - 현황: 41개 컬럼이나 언제 들어왔는지 확인 불가. `order_date`로 우회 추정해야 함.
   - 요청: migration + upsert 로직 업데이트. 신규 데이터만 채워도 충분. 과거 데이터는 NULL 허용.

5. **`tb_operation_log` 도메인 확장**
   - 현황: `domain`이 `restock` 단 하나. "오늘 sync가 돌았는가?"를 DB에서 질의할 수 없음.
   - 요청: `domain ∈ {sync_naver, sync_playauto, sync_coupang, sync_iamweb, sync_toss, backfill_iamweb, ...}`로 확장하고 각 sync 잡이 시작/종료 시점을 기록.

6. **TEAM KETO 테이블 정책 결정**
   - 현황: `tb_teamketo_cafe24`, `tb_teamketo_smartstore`가 2025-07-25 이후 멈춤.
   - 요청: (a) 브랜드 자체가 중단됐으면 테이블 아카이브·뷰에서 제거, (b) 사용 중이면 sync 파이프라인 재구축. 어느 쪽이든 "멈춘 채 살아있는 상태"는 없애야 함.

7. **`vw_purchase_conversion_details` 뷰 수정 or 삭제**
   - 현황: 0행 반환. 대시보드 의존 여부 확인 필요.

### P2 — 1개월 내

8. **월 단위 수동 업로드 Sales 프로세스 재검토**
   - 현황: 모든 `tb_sales_*` 수동 업로드가 2026-03-27에 한 번 있었고, 그 뒤로는 없음. 2, 3, 4월 데이터 미반영.
   - 요청: (a) 정산 담당자 업로드 스케줄 명시(매월 N일), (b) 미업로드 월이 있을 때 대시보드가 "이 월 데이터 없음"을 경고하도록 UI 보강, (c) 가능하다면 토스처럼 API 기반 자동 수집으로 전환.

9. **빈/중복 테이블 정리**
   - `tb_imweb_member` (0행): 스키마 존치 이유 확인 후 제거 또는 채우기.
   - `channeltalk_users` 계열 3중화, `test_tb_*` 계열 5개, `vw_test_repurchase_*` 계열 5개: 운영/테스트 네임스페이스 분리(`test_` 스키마 사용). 최소한 공용 카탈로그에서 "프로덕션에서 쓰지 말 것" 마킹.
   - `bico_user`, `users`, `tb_iamweb_users`의 역할 차이를 명확히 문서화.

10. **쿠팡/토스/iamWeb sync도 스케줄러에 등록**
    - 현황: `scheduler.py`에 `naver_sync`, `playauto_sync`만 cron 등록. 쿠팡/토스/iamWeb order는 어디서 돌고 있는지 리포지토리만으로는 추적이 어려움.
    - 요청: 실제 실행 경로를 주석 또는 `scheduler.py`에 통일. "어떤 잡이 어디서 돌고 있는지" 한 파일에서 보여야 함.

11. **한글 컬럼명 테이블 이관 계획(`tb_laplace`)**
    - 현황: `판매처`, `상품명` 등 한글 컬럼. 조인·인덱스·ORM 모델링 모두 취약. 현재 2025-11 이후 멈춰 있고 일회성 스냅샷 성격으로 보임.
    - 요청: 사용처가 있으면 영문 컬럼명 버전으로 마이그레이션 후 원본 아카이브. 없으면 아카이브/드롭.

---

## 6.5 판단: 운영 DB를 새로 만들 것인가, 기존 DB 보완을 요청할 것인가

### 결론 (한 줄)

**원천 주문/매출 데이터는 기존 운영 DB 유지 + 개발팀에 P0 3건을 즉시 요청**. 다만 seo 프로젝트가 "데이터가 언제까지 최신이었는지"를 자체 확인할 수 있도록, **seo VM 백엔드에 얇은 "sync-mirror" 레이어**를 우리가 직접 올림. **전면 재구축은 하지 않음** — 비용 대비 수익이 맞지 않소.

### 옵션 A — 운영 DB를 우리가 새로 구축 (❌ 기각)

장점:
- 스키마·감사·알림 전부 우리 통제 가능.
- 개발팀 응답 대기 없음.

단점(치명적):
- 원천 파이프라인 5개(iamWeb / 네이버 / 쿠팡 / 플레이오토 / 토스)를 우리가 직접 유지해야 함. 토큰 갱신, rate limit, 스키마 변화 추적이 **영구 백로그**로 쌓임.
- revenue 팀의 대시보드·리포트·정산은 여전히 기존 DB를 쓰므로 **진실 소스가 두 개**가 되어 split-brain. 수치 불일치가 나오면 "어느 쪽이 맞느냐"를 계속 다퉈야 함.
- 상담 기록·재고·코호트·LTR 같은 revenue 고유 도메인까지 우리가 다시 정의할 이유가 없음.
- seo 프로젝트의 핵심(광고·attribution·CRM Hub, Phase A~J 로드맵)이 파이프라인 유지보수에 밀림.

→ **seo는 "이커머스 주문 파이프라인" 전문가가 아니오**. 여기에 손대면 본업이 느려짐.

### 옵션 B — 기존 운영 DB 보완 요청 단독 (⚠️ 부족)

장점:
- 작업 주체가 원천 데이터 오너.
- 수정 결과가 revenue/seo/기타 소비자 모두에 반영됨.
- 우리 코드 증가 없음.

단점:
- 대응 속도 불확실. P0 3건이 2주 이상 지연되면 그동안 ads/ROAS 대시보드가 틀린 숫자를 계속 보여주게 됨.
- 개발팀 우선순위에서 밀리면 추적 수단이 우리 쪽에 없음. "이 데이터가 언제 기준인지" 현재 우리는 DB에서 질의할 방법조차 없소.

### 옵션 C — 하이브리드 (✅ 채택)

1. **원천 데이터는 건드리지 않음.** P0~P2 개선 요청은 이 문서 그대로 개발팀에 전달.
2. **seo VM 백엔드에 `operational_mirror` 모듈을 얇게 추가**한다:
   - 대상 테이블 5개만: `tb_playauto_orders`, `tb_naver_orders`, `tb_coupang_orders`, `tb_sales_toss`, `tb_iamweb_users`.
   - 1시간 주기 cron으로 `read-only` 계정을 통해 필요한 컬럼만 pull → seo sqlite에 캐시.
   - **우리 쪽 sync 시점/성공/행수 증가량을 직접 기록**하는 `mirror_sync_log(domain, action, status, row_delta, started_at, finished_at, error)` 테이블 운용.
   - staleness 임계값(예: playauto 25시간, 나머지 3시간) 초과 시 로그/알림 + **ads 대시보드 상단에 "데이터는 N시간 전 기준" 경고 배지** 노출.
3. **seo 고유 파생 데이터(CAPI 이벤트, attribution, CRM 발송 이력 등)는 이미 우리 자체 DB에 있음.** 그대로 유지.
4. **에스컬레이션 조건부 확장**: 개발팀 응답이 2주 넘게 지체되고 `tb_playauto_orders`가 복구되지 않으면, mirror를 업스트림 DB 대신 **소스 API(플레이오토) 직접 호출**로 임시 확장한다. 이건 비상 경로이지 기본 경로가 아니오.

### 하이브리드의 핵심 이점

- **진실 소스는 여전히 하나** (revenue DB). split-brain 없음.
- **우리가 통제하는 감사 로그**가 생김 → "데이터가 오래됐다"는 사실을 사람이 발견하기 전에 시스템이 먼저 안다.
- **개발팀 응답을 기다리는 동안에도 대시보드 신뢰도가 유지됨** (stale 경고 배지 덕분에 사용자는 적어도 속지 않음).
- 구현 비용이 작음. 5개 테이블 pull + 로그 테이블 하나.

### 실행 계획

**이번 주**:
- 이 문서의 P0 3건을 개발팀에 정식 전달.
- seo VM 백엔드에 `operational_mirror` 스켈레톤 추가 (5개 테이블 대상).
- ads 대시보드 상단에 staleness 배지 연결 포인트 마련 (실제 로직은 mirror가 채워지면 켠다).

**2주 내**:
- 개발팀 응답 확인. P0 해결 여부에 따라:
  - 해결됐으면 → mirror는 감사/배지 용도로만 유지, 더 이상 확장하지 않음.
  - 미해결이면 → mirror를 플레이오토 API 직접 호출 경로로 확장 (비상 경로).

**1개월 내**:
- 개발팀 P1(특히 `tb_iamweb_users.synced_at`, `tb_operation_log` 도메인 확장) 반영 확인.
- 반영되면 우리 mirror의 감사 로그를 원천 DB의 `tb_operation_log`를 참조하는 형태로 단순화.

### 명시적으로 하지 않을 것

- 전면 재구축(옵션 A)은 기각. 향후에도 "주문 원천 DB를 우리가 직접 만든다"는 경로는 열지 않는다.
- `tb_consultation_records`, `ltr_*`, 재고 관련 테이블은 mirror 대상에서 제외. revenue 고유 도메인이며 seo에서 직접 소비 이유가 약함.
- 한글 컬럼 테이블(`tb_laplace`)은 mirror 대상 아님. revenue 팀 정책 결정 대기.

---

## 6.6 `operational_mirror` 모듈 상세 설계

> 이 섹션은 "얇은 mirror"가 구체적으로 어떤 파일·무엇·왜·어떻게인지 풀어 쓴 것이오. 누가 읽어도 바로 구현에 착수할 수 있도록 파일 경로, 함수 시그니처, 자료구조를 명시했소.

### 6.6.1 설계 전제 (꼭 먼저 이해할 것)

이 프로젝트의 현재 상태를 먼저 못박고 시작하오:

1. **운영 DB에 대한 pg 커넥션은 이미 존재함.** `backend/src/postgres.ts`의 `queryPg()`가 `DATABASE_URL` 환경변수를 통해 `postgresql://bico_readonly@34.47.95.104:5432/dashboard`에 붙어 있음. `callprice.ts`, `consultation.ts`, `crmPhase1.ts`가 이미 이 함수로 운영 DB를 실시간 조회하고 있소.
2. **즉, mirror는 "새 커넥션을 만드는 것"이 아니라 "기존 라이브 쿼리를 캐시 + 감사"하는 얇은 레이어임.** 새 DB 자격증명이나 별도 pool은 필요 없소.
3. **로컬 스토리지는 이미 sqlite가 있음.** `backend/data/crm.sqlite3` (`crmLocalDb.ts`의 `getCrmDb()`). mirror 테이블도 이 파일에 같이 얹는다. 파일이 하나면 백업·마이그레이션이 단순해지오.
4. **백그라운드 잡은 이미 동작 중.** `backend/src/bootstrap/startBackgroundJobs.ts`에 cron 패턴이 이미 있음(예약 발송, Meta CAPI 동기화 등). 여기에 mirror sync 잡 하나를 끼워 넣는다.
5. **환경변수 토글 존재.** `BACKGROUND_JOBS_ENABLED=0`이면 모든 잡이 안 돌도록 이미 설계되어 있음. 개발자 로컬에서 mirror를 끌 수단이 자동 확보됨.

→ 결론: **새 파일 5~7개 + 기존 파일 3개 소규모 수정이면 끝.** 전면적 구조 변경 아님.

### 6.6.2 모듈 구성도

```
frontend/src/app/ads/
 └─ components/
     └─ DataStalenessBadge.tsx         (신규) ← /api/operational-mirror/status 호출

backend/src/
 ├─ operationalMirror/                 (신규 폴더)
 │   ├─ schema.ts                      (신규) mirror sqlite 테이블 정의·마이그레이션
 │   ├─ config.ts                      (신규) 테이블별 staleness 임계값·enabled 플래그
 │   ├─ syncLog.ts                     (신규) mirror_sync_log write/read 헬퍼
 │   ├─ pullers/
 │   │   ├─ types.ts                   (신규) Puller 인터페이스
 │   │   ├─ playautoOrders.ts          (신규) tb_playauto_orders → mirror_playauto_orders
 │   │   ├─ naverOrders.ts             (신규) tb_naver_orders → mirror_naver_orders
 │   │   ├─ coupangOrders.ts           (신규) tb_coupang_orders → mirror_coupang_orders
 │   │   ├─ salesToss.ts               (신규) tb_sales_toss → mirror_sales_toss
 │   │   └─ iamwebUsers.ts             (신규) tb_iamweb_users → mirror_iamweb_users
 │   ├─ runSync.ts                     (신규) 모든 puller를 순차 실행하는 오케스트레이터
 │   └─ staleness.ts                   (신규) 각 테이블의 현재 상태(ok/warn/stale/down) 계산
 ├─ routes/
 │   └─ operationalMirror.ts           (신규) GET /api/operational-mirror/status 등
 ├─ bootstrap/
 │   └─ startBackgroundJobs.ts         (수정) runOperationalMirrorSync cron 추가
 ├─ bootstrap/
 │   └─ registerRoutes.ts              (수정) /api/operational-mirror 라우터 등록
 └─ crmLocalDb.ts                      (수정) getCrmDb() 초기화 시 operationalMirror/schema.ts의 ensureMirrorTables(db) 호출
```

### 6.6.3 각 모듈의 무엇·왜·어떻게 (고등학생도 이해할 수 있게)

#### 먼저 — 전체를 하나의 큰 비유로

우리가 하려는 일을 한 문장으로 요약하면 이렇소:

> **멀리 있는 큰 창고의 물건을, 필요한 것만 뽑아서 우리 사무실 냉장고에 주기적으로 복사해두고, "언제 복사했는지"와 "원본이 언제까지 최신이었는지"를 기록해두는 것.**

이 비유를 먼저 머리에 박아두시오:

| 비유 | 실제 대응물 |
| ---- | ----------- |
| 🏢 **큰 창고** (다른 도시에 있음) | 운영 PostgreSQL DB (`34.47.95.104`) |
| ❄️ **우리 사무실 냉장고** | `backend/data/crm.sqlite3` 파일 |
| 🚚 **배달 트럭 (한 대)** | 1시간마다 돌아가는 cron |
| 👷 **배달 기사 5명** | puller 5개 (playauto/naver/coupang/toss/iamweb 각 1명) |
| 🧢 **반장** | `runSync.ts` — 기사 5명을 줄 세워 순서대로 출발시킴 |
| 📋 **배송 기록지** | `mirror_sync_log` 테이블 — 누가 언제 몇 개 가져왔나 |
| 📏 **유통기한 표** | `config.ts` — "어느 선반은 몇 시간까지 정상인가" |
| 🕵️ **식품 안전 검사관** | `staleness.ts` — 냉장고 물건이 얼마나 오래됐는지 판정 |
| 🛎️ **1층 안내 데스크** | `routes/operationalMirror.ts` — 외부에서 상태 물으면 답해줌 |
| 🚨 **입구에 붙은 경고 스티커** | `DataStalenessBadge.tsx` — 사용자 눈에 "데이터 오래됨" 표시 |
| ⏰ **알람 시계** | `startBackgroundJobs.ts` 안의 `setInterval` |

이 표를 옆에 두고 아래 ①~⑩를 순서대로 읽으시오. 각 모듈은 **비유 한 줄 → 무엇 → 왜 필요 → 없으면 어떻게 되나 → (필요하면) 코드**의 순서로 써두었소.

---

#### ① `schema.ts` — 🏗️ 냉장고에 선반 짜기

**비유**: 냉장고를 새로 들였는데 안이 텅 비어 있소. 우유 선반, 고기 선반, 채소 선반, 그리고 **배송 기록지 꽂이**까지 먼저 짜둬야 물건을 넣을 수 있음.

**이게 뭐냐**: sqlite 파일 안에 `mirror_playauto_orders`, `mirror_naver_orders` 같은 **빈 테이블(선반)을 미리 만드는 코드**요. 운영 DB의 원본 테이블 중에서 우리가 실제로 쓸 컬럼만 골라 복사본 모양으로 준비하오. 가장 중요한 것은 여기서 같이 만드는 `mirror_sync_log`라는 **"배송 기록지" 테이블**이오. 이게 이 시스템의 심장이오. 누가 언제 뭘 얼마나 가져왔는지 전부 여기에 쌓임.

**왜 필요한가**: sqlite는 "없는 테이블에 INSERT하면 에러"를 내는 DB라 선반이 없으면 아무것도 못 넣음. 그리고 기록지가 없으면 "언제 마지막 sync 됐지?" 같은 질문에 영영 답할 수 없음.

**없으면**: 첫 cron이 돌자마자 "테이블 없음" 에러로 전부 실패. 우리 시스템이 운영 DB의 실수(감사 로그 없음)를 그대로 따라하게 됨.

**언제 실행되나**: 백엔드 서버가 처음 켜질 때 `getCrmDb()` 안에서 자동. `CREATE TABLE IF NOT EXISTS`라서 두 번째 실행부터는 아무 일도 안 함(이미 있는 선반은 안 건드림).

**코드**:

```ts
// backend/src/operationalMirror/schema.ts
import type Database from "better-sqlite3";

export function ensureMirrorTables(db: Database.Database): void {
  db.exec(`
    -- 각 운영 DB 테이블을 미러링한 캐시. 컬럼은 seo에서 실제 쓰는 것만 복제한다.
    -- 목적: (1) 라이브 쿼리 로드 완화 (2) 원본 DB 다운 시 최근 스냅샷으로 페일오버

    CREATE TABLE IF NOT EXISTS mirror_playauto_orders (
      id INTEGER PRIMARY KEY,                -- 원본 tb_playauto_orders.id
      ord_time TEXT,                         -- 주문 시각
      synced_at_src TEXT,                    -- 원본 synced_at (원본 컬럼 복제)
      order_no TEXT,
      channel TEXT,
      product_name TEXT,
      quantity INTEGER,
      paid_amount INTEGER,
      payment_status TEXT,
      buyer_name TEXT,
      buyer_tel TEXT,
      raw_json TEXT,                         -- 필요 시 JSON blob 그대로 보관
      mirrored_at TEXT NOT NULL              -- seo가 이 행을 가져온 시각
    );
    CREATE INDEX IF NOT EXISTS ix_mirror_playauto_ord_time ON mirror_playauto_orders(ord_time);

    CREATE TABLE IF NOT EXISTS mirror_naver_orders (
      product_order_id TEXT PRIMARY KEY,
      order_id TEXT,
      order_date TEXT,
      payed_date TEXT,
      product_name TEXT,
      quantity INTEGER,
      total_amount INTEGER,
      product_order_status TEXT,
      synced_at_src TEXT,
      mirrored_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_mirror_naver_payed ON mirror_naver_orders(payed_date);

    CREATE TABLE IF NOT EXISTS mirror_coupang_orders (
      id INTEGER PRIMARY KEY,
      order_id INTEGER,
      paid_at TEXT,
      product_name TEXT,
      sales_quantity INTEGER,
      unit_sales_price INTEGER,
      synced_at_src TEXT,
      mirrored_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_mirror_coupang_paid ON mirror_coupang_orders(paid_at);

    CREATE TABLE IF NOT EXISTS mirror_sales_toss (
      id INTEGER PRIMARY KEY,
      payment_key TEXT,
      order_id TEXT,
      approved_at TEXT,
      canceled_at TEXT,
      total_amount INTEGER,
      cancel_amount INTEGER,
      status TEXT,
      project TEXT,
      synced_at_src TEXT,
      mirrored_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_mirror_toss_approved ON mirror_sales_toss(approved_at);

    CREATE TABLE IF NOT EXISTS mirror_iamweb_users (
      id INTEGER PRIMARY KEY,
      order_date TEXT,
      order_number TEXT,
      customer_name TEXT,
      product_name TEXT,
      final_order_amount INTEGER,
      payment_status TEXT,
      payment_complete_time TEXT,
      mirrored_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_mirror_iamweb_order_date ON mirror_iamweb_users(order_date);

    -- 모든 puller 실행 기록. 이게 진짜 핵심 — seo가 운영 DB 감사 대신 쓰는 로그.
    CREATE TABLE IF NOT EXISTS mirror_sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT NOT NULL,          -- 'playauto' | 'naver' | 'coupang' | 'toss' | 'iamweb'
      action TEXT NOT NULL,          -- 'incremental' | 'backfill' | 'healthcheck'
      status TEXT NOT NULL,          -- 'ok' | 'partial' | 'fail' | 'skipped'
      started_at TEXT NOT NULL,
      finished_at TEXT,
      rows_seen INTEGER NOT NULL DEFAULT 0,     -- 이번 pull에서 본 원본 행수
      rows_upserted INTEGER NOT NULL DEFAULT 0, -- 실제 mirror에 반영된 행수
      rows_new INTEGER NOT NULL DEFAULT 0,      -- 그 중 신규
      source_max_ts TEXT,                       -- 원본에서 본 가장 최신 데이터 시각 (staleness 판정 기준)
      error_code TEXT,
      error_message TEXT
    );
    CREATE INDEX IF NOT EXISTS ix_mirror_sync_log_domain ON mirror_sync_log(domain, id);
  `);
}
```

→ `crmLocalDb.ts`의 `getCrmDb()` 안에서 `ensureMirrorTables(db)`를 한 줄 호출만 추가하면 됨. 기존 테이블에 영향 없음.

---

#### ② `config.ts` — 📏 벽에 붙은 유통기한 표

**비유**: 식당 주방 벽에 "우유 3일, 고기 1일, 채소 2일"이라고 적힌 한 장의 표가 붙어 있소. 직원마다 머리로 외우면 사람마다 달라지고 사고 남. 표 한 장으로 정해두면 누가 봐도 기준이 같고, 바꿀 때도 표 한 장만 바꾸면 됨.

**이게 뭐냐**: 5개 도메인(playauto/naver/coupang/toss/iamweb) 각각에 대해 "이 도메인은 몇 시간까지 정상(ok), 몇 시간 넘으면 경고(warn/stale), 몇 시간 넘으면 위험(down)"인지를 숫자로 못박은 **설정 파일 하나**오.

**왜 필요한가**:
- playauto는 원본이 "하루 1회 증분"이라 26시간까지는 정상임. 그런데 naver는 원본이 4시간마다 돌기 때문에 3시간만 지나도 뭔가 이상한 것이오. 도메인마다 기준이 다름.
- 이 기준이 코드 여기저기 박혀 있으면 어느 날 "26시간 → 30시간으로 바꾸자"고 할 때 10군데를 고쳐야 함. 한 파일에 모아두면 한 줄만 바꾸면 됨.

**한 번 더 비유**: 매니저가 "내일부터 우유 유통기한 2일로 바꿉시다" 할 때, 직원 10명이 각자 외운 걸 다 바꾸는 것보다 **벽에 붙은 표 한 장만 고치는 것**이 훨씬 안전한 것과 같음.

**없으면**: 임계값 조정이 악몽이 됨. "왜 이 값이 26시간이지? 누가 언제 박아놨지?" 같은 혼란 발생.

**코드**:

```ts
// backend/src/operationalMirror/config.ts
export type MirrorDomain = "playauto" | "naver" | "coupang" | "toss" | "iamweb";

export interface MirrorDomainConfig {
  enabled: boolean;
  /** 원본 데이터 최신 시각이 지금으로부터 이만큼 지나면 'stale' */
  stalenessWarnMs: number;
  /** 이만큼 지나면 'down' (대시보드 붉은 배지) */
  stalenessDownMs: number;
  /** 한 번의 pull에서 가져올 최대 행수 */
  pullLimit: number;
}

const hours = (n: number) => n * 60 * 60 * 1000;

export const MIRROR_CONFIG: Record<MirrorDomain, MirrorDomainConfig> = {
  // playauto는 원본이 1일 1회 증분이니 여유를 크게.
  playauto: { enabled: true, stalenessWarnMs: hours(26), stalenessDownMs: hours(72), pullLimit: 5000 },
  naver:    { enabled: true, stalenessWarnMs: hours(3),  stalenessDownMs: hours(12), pullLimit: 2000 },
  coupang:  { enabled: true, stalenessWarnMs: hours(3),  stalenessDownMs: hours(12), pullLimit: 2000 },
  toss:     { enabled: true, stalenessWarnMs: hours(3),  stalenessDownMs: hours(12), pullLimit: 5000 },
  iamweb:   { enabled: true, stalenessWarnMs: hours(2),  stalenessDownMs: hours(8),  pullLimit: 5000 },
};
```

임계값 변경은 이 파일 한 줄 수정으로 끝나오. PR 리뷰도 이 파일만 보면 됨.

---

#### ③ `syncLog.ts` — ✒️ 배송 기록지를 쓰는 전용 펜

**비유**: 택배 기사가 배송을 마치면 클립보드에 "출발 14:00, 도착 14:30, 상자 20개 전달, 이상 없음" 같은 걸 적지 않소? 이 모듈은 **"그 기록지에 글씨를 쓰기 쉽게 해주는 전용 펜과 양식지"**이오.

**이게 뭐냐**: `mirror_sync_log` 테이블에 쓰거나 읽는 **3개의 작은 함수**:
1. `openSyncLog()` — 배송 **시작할 때** "지금 15시에 playauto 배송 시작합니다" 한 줄 열기. 이 시점엔 상자 개수가 아직 0이고 `status='ok'`로 가열어 둠.
2. `closeSyncLog()` — 배송 **끝날 때** 그 줄로 돌아가서 "상자 50개 받았고 성공/실패는 이거고 에러 메시지는 이거였다" 빈칸을 채워 넣음.
3. `getLatestSyncLog()` — 나중에 검사관이나 안내 데스크가 "저 도메인 마지막 배송 언제였나?" 물으면 최근 기록 한 장 꺼내 보여줌.

**왜 이렇게 분리하는가**:
- puller 5명이 각자 SQL을 직접 쓰면 5군데서 오타 낼 기회가 5번 생김. 한 펜에 묶어두면 오타는 한 번만 나고 한 번에 고쳐짐.
- 기록지 양식이 바뀌면 (컬럼 추가 등) 이 파일 한 군데만 고치면 5명 전부 적용됨.

**없으면**: 5명의 기사가 제각각 클립보드 양식을 써서, 반장이 나중에 읽을 때 해석이 안 됨. 누락된 기록이 어디서 빠졌는지도 못 잡음.

**코드**:

```ts
// backend/src/operationalMirror/syncLog.ts
import { getCrmDb } from "../crmLocalDb";
import type { MirrorDomain } from "./config";

export interface SyncLogInput {
  domain: MirrorDomain;
  action: "incremental" | "backfill" | "healthcheck";
  startedAt: Date;
}

export interface SyncLogFinish {
  id: number;
  status: "ok" | "partial" | "fail" | "skipped";
  rowsSeen?: number;
  rowsUpserted?: number;
  rowsNew?: number;
  sourceMaxTs?: string | null;
  errorCode?: string;
  errorMessage?: string;
}

export function openSyncLog(input: SyncLogInput): number {
  const db = getCrmDb();
  const stmt = db.prepare(`
    INSERT INTO mirror_sync_log (domain, action, status, started_at)
    VALUES (?, ?, 'ok', ?)
  `);
  const res = stmt.run(input.domain, input.action, input.startedAt.toISOString());
  return Number(res.lastInsertRowid);
}

export function closeSyncLog(finish: SyncLogFinish): void {
  const db = getCrmDb();
  db.prepare(`
    UPDATE mirror_sync_log SET
      status = ?, finished_at = ?, rows_seen = ?, rows_upserted = ?, rows_new = ?,
      source_max_ts = ?, error_code = ?, error_message = ?
    WHERE id = ?
  `).run(
    finish.status,
    new Date().toISOString(),
    finish.rowsSeen ?? 0,
    finish.rowsUpserted ?? 0,
    finish.rowsNew ?? 0,
    finish.sourceMaxTs ?? null,
    finish.errorCode ?? null,
    finish.errorMessage ?? null,
    finish.id,
  );
}

export function getLatestSyncLog(domain: MirrorDomain) {
  const db = getCrmDb();
  return db.prepare(`
    SELECT * FROM mirror_sync_log
    WHERE domain = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(domain) as Record<string, unknown> | undefined;
}
```

---

#### ④ `pullers/types.ts` — 📘 기사 업무 매뉴얼 한 장

**비유**: 편의점 알바 첫날 매뉴얼이 "① 출근해서 카드 찍기 ② 재고 파악 ③ 손님 응대 ④ 퇴근 전 청소"처럼 정해져 있지 않소? 이 파일은 **"모든 puller(배달 기사)가 반드시 지켜야 하는 공통 업무 규격"**이오.

**이게 뭐냐**: TypeScript의 `interface` 하나. "Puller는 반드시 ① `domain` 이름이 있어야 하고, ② `runIncremental()`이라는 함수를 갖고 있어야 하며, ③ 그 함수는 `PullerResult`라는 정해진 모양의 객체를 돌려줘야 한다"는 **약속**을 컴파일러 레벨에서 못박소.

**왜 필요한가**:
- 반장(`runSync.ts`)이 5명의 기사를 관리해야 하는데, 기사마다 일하는 방식이 다르면 반장은 5가지 방식을 다 외워야 함. 공통 매뉴얼을 정해두면 **반장은 딱 한 가지 방식만 알면 5명을 다 관리 가능**.
- 새 기사(=새 테이블 미러링)를 뽑아도 매뉴얼만 읽고 바로 투입 가능. 반장 쪽 코드는 건드릴 필요가 없소.

**한 번 더 비유**: 군대 보급병 5명이 각자 다른 양식으로 보급 보고하면 참모가 미침. 양식 통일하면 참모는 5장을 같은 방식으로 훑을 수 있음.

**없으면**: 새 테이블 추가할 때마다 `runSync.ts`에 분기를 5줄씩 추가. 각 기사마다 실패 처리·반환값 모양이 달라져서 디버깅 지옥.

**코드**:

```ts
// backend/src/operationalMirror/pullers/types.ts
import type { MirrorDomain } from "../config";

export interface PullerResult {
  rowsSeen: number;
  rowsUpserted: number;
  rowsNew: number;
  /** 원본에서 본 가장 최신 데이터 시각 (staleness 판정에 쓰임) */
  sourceMaxTs: string | null;
}

export interface Puller {
  domain: MirrorDomain;
  /** 마지막으로 mirror된 이후의 새 데이터만 pull하는 증분 동기화 */
  runIncremental(): Promise<PullerResult>;
}
```

---

#### ⑤ `pullers/playautoOrders.ts` — 🚚 플레이오토 담당 1번 기사

**비유**: 1번 기사, 이름은 "플레이오토". 임무는 이것이오:
> "큰 창고의 playauto 구역에 가서, **우리 냉장고에 아직 없는 신상 상자만** 골라 최대 5000개까지 트럭에 싣고 돌아와, 냉장고 선반에 하나씩 정리해 넣어라."

**이게 뭐냐**: 실제로 운영 DB의 `tb_playauto_orders`에서 SELECT를 날리고, 결과를 sqlite의 `mirror_playauto_orders`에 upsert(있으면 덮어쓰고 없으면 새로 넣기)하는 **구체적인 로직 한 덩어리**오.

**어떻게 동작하나** — 3단계로 쉽게 풀어 쓰면:

**1단계 — "어디까지 가져왔는지 확인"**
냉장고(sqlite)에서 "현재 내가 가진 상자 중 **가장 큰 번호**"를 찾소. 예: 우리 냉장고에 id가 1번~100번까지 있으면 100을 반환.
```sql
SELECT COALESCE(MAX(id), 0) FROM mirror_playauto_orders
→ 100
```
이건 "내가 어디서 멈췄지?"를 우리 스스로에게 묻는 것이오.

**2단계 — "그 다음 것부터만 가져오기"**
운영 DB에서 id가 **101번 이상인 것만** 최대 5000개 가져옴. "이미 가져온 건 또 안 가져온다"는 원칙. 이걸 **증분 동기화(incremental sync)**라 부르오.
```sql
SELECT ... FROM tb_playauto_orders WHERE id > 100 ORDER BY id LIMIT 5000
```
매번 115,316행을 전부 가져오면 느리고 운영 DB에도 부담이 큼. "**어제 이후 새로 생긴 것만**" 가져와야 가볍게 유지됨.

**3단계 — "냉장고에 넣기"**
가져온 상자 한 개 한 개를 sqlite에 upsert. "같은 id가 이미 있으면 덮어쓰고, 없으면 새로 넣음". 이걸 **트랜잭션으로 묶는** 이유는, 중간에 전원이 나가거나 에러가 나도 "반만 들어간 상태"가 생기지 않게 하기 위함이오. **전부 들어가거나, 전부 안 들어가거나** 둘 중 하나로 보장됨.

**왜 playauto부터 구현하나?**
운영 DB에서 **가장 오래 멈춰있는 테이블**(1개월). 이게 mirror에 들어오기 시작하면 "언제 원본이 다시 살아났는지"를 우리가 제일 먼저 감지할 수 있소. 의학으로 치면 **가장 심한 환자부터 모니터링 기기를 붙이는 것**과 같음.

**실패 시나리오**:
- 운영 DB 커넥션 끊김 → 이 기사만 실패 기록. 다른 4명은 정상 운행.
- 원본 컬럼 하나가 사라짐(스키마 변경) → 이 기사만 에러. 배지가 warn으로 뜸. 사람이 바로 확인 가능.

**나머지 4개 puller는 어떻게?**
이 파일을 **그대로 복붙**해서 딱 3가지만 바꾸면 됨:
1. "어느 원본 테이블을 읽을지"
2. "PK 컬럼 이름이 뭔지" (id? product_order_id? payment_key?)
3. "최신 시각 컬럼이 뭔지" (ord_time? paid_at? approved_at?)

한 기사 교육시키면 나머지 4명은 같은 매뉴얼로 일하는 것이오. 한 puller 당 대충 60~90줄.

**코드** (핵심만):

```ts
// backend/src/operationalMirror/pullers/playautoOrders.ts
import { queryPg } from "../../postgres";
import { getCrmDb } from "../../crmLocalDb";
import { MIRROR_CONFIG } from "../config";
import type { Puller, PullerResult } from "./types";

export const playautoPuller: Puller = {
  domain: "playauto",
  async runIncremental(): Promise<PullerResult> {
    const db = getCrmDb();
    const limit = MIRROR_CONFIG.playauto.pullLimit;

    // 1) mirror에 저장된 마지막 id를 찾는다 (증분 기준).
    const lastIdRow = db.prepare(`SELECT COALESCE(MAX(id), 0) AS max_id FROM mirror_playauto_orders`).get() as { max_id: number };
    const lastId = Number(lastIdRow.max_id ?? 0);

    // 2) 운영 DB에서 그 id 이후 + 한도만큼만 가져온다. 필요한 컬럼만.
    const { rows } = await queryPg<{
      id: number;
      ord_time: string | null;
      synced_at: string | null;
      order_no: string | null;
      channel: string | null;
      product_name: string | null;
      quantity: number | null;
      paid_amount: number | null;
      payment_status: string | null;
      buyer_name: string | null;
      buyer_tel: string | null;
    }>(
      `SELECT id, ord_time, synced_at, order_no, channel, product_name,
              quantity, paid_amount, payment_status, buyer_name, buyer_tel
         FROM tb_playauto_orders
        WHERE id > $1
        ORDER BY id ASC
        LIMIT $2`,
      [lastId, limit],
    );

    if (rows.length === 0) {
      // staleness 판단을 위해 원본 현재 max 시각은 별도 가벼운 쿼리로 확인
      const probe = await queryPg<{ max_ts: string | null }>(
        `SELECT MAX(ord_time)::text AS max_ts FROM tb_playauto_orders`,
      );
      return {
        rowsSeen: 0,
        rowsUpserted: 0,
        rowsNew: 0,
        sourceMaxTs: probe.rows[0]?.max_ts ?? null,
      };
    }

    // 3) sqlite에 upsert. 트랜잭션으로 묶어 속도/원자성 확보.
    const upsert = db.prepare(`
      INSERT INTO mirror_playauto_orders
        (id, ord_time, synced_at_src, order_no, channel, product_name,
         quantity, paid_amount, payment_status, buyer_name, buyer_tel, mirrored_at)
      VALUES (@id, @ord_time, @synced_at, @order_no, @channel, @product_name,
              @quantity, @paid_amount, @payment_status, @buyer_name, @buyer_tel, @mirrored_at)
      ON CONFLICT(id) DO UPDATE SET
        ord_time        = excluded.ord_time,
        synced_at_src   = excluded.synced_at_src,
        payment_status  = excluded.payment_status,
        paid_amount     = excluded.paid_amount,
        mirrored_at     = excluded.mirrored_at
    `);

    const now = new Date().toISOString();
    let upserted = 0;
    let maxTs: string | null = null;

    const txn = db.transaction(() => {
      for (const row of rows) {
        upsert.run({ ...row, mirrored_at: now });
        upserted++;
        if (row.ord_time && (!maxTs || row.ord_time > maxTs)) maxTs = row.ord_time;
      }
    });
    txn();

    return {
      rowsSeen: rows.length,
      rowsUpserted: upserted,
      rowsNew: upserted, // 증분이므로 upserted == new로 간주 (완벽하진 않지만 충분)
      sourceMaxTs: maxTs,
    };
  },
};
```

---

#### ⑥ `runSync.ts` — 🧢 배송 반장

**비유**: 오전 조회 시간에 기사 5명을 줄 세우고 "박기사 출발, 이기사 출발, 김기사 출발..." 차례로 내보내는 **반장**. 한 기사가 사고가 나도 다른 기사의 출발을 막지 않음.

**이게 뭐냐**: 5개 puller를 순서대로 호출하는 딱 하나의 async 함수 `runOperationalMirrorSync()`오. 각 puller를 부를 때 "배송 기록지 열기(openSyncLog) → puller 실행 → 결과로 기록지 닫기(closeSyncLog)"를 **자동으로 처리**하오.

**왜 한 곳에 모으나**:
- cron이 호출할 대상은 **딱 하나**여야 함. cron에게 5개를 맡기면 복잡해지고 일부 누락 위험이 생김.
- "한 기사의 실패가 다른 기사를 막지 않는다"는 규칙을 한 군데서 강제 가능. try/catch를 5군데 중복할 필요 없음.

**가장 중요한 설계 원칙** — 반장은 **한 기사가 실패해도 `throw`하지 않고 다음 기사로 넘어감**. 이게 현장에서 굉장히 중요함. playauto가 스키마 바뀌어서 박살나도 naver/coupang/toss/iamweb은 계속 정상 동작해야 하오. 그래야 **한 영역의 장애가 전체를 먹통 만들지 않소**.

**한 번 더 비유**: 축구 감독이 11명 중 1명 부상당했다고 경기 포기하지 않소. 그 포지션만 비는 채로 경기 계속. 이게 **장애 복원력(resilience)의 기본 원칙**이오.

**없으면**: playauto 한 번 실패할 때마다 전체 cron이 멈춰서 정상이던 naver까지 밀림. 하나의 장애가 전염됨.

**코드**:

```ts
// backend/src/operationalMirror/runSync.ts
import { log, obsEvents } from "../obs";
import { MIRROR_CONFIG, type MirrorDomain } from "./config";
import { openSyncLog, closeSyncLog } from "./syncLog";
import type { Puller } from "./pullers/types";
import { playautoPuller } from "./pullers/playautoOrders";
import { naverPuller } from "./pullers/naverOrders";
import { coupangPuller } from "./pullers/coupangOrders";
import { tossPuller } from "./pullers/salesToss";
import { iamwebPuller } from "./pullers/iamwebUsers";

const PULLERS: Puller[] = [playautoPuller, naverPuller, coupangPuller, tossPuller, iamwebPuller];

export async function runOperationalMirrorSync(): Promise<void> {
  for (const p of PULLERS) {
    const cfg = MIRROR_CONFIG[p.domain];
    if (!cfg.enabled) {
      log.info({ evt: obsEvents.mirrorSkipped, domain: p.domain }, "mirror domain disabled");
      continue;
    }
    const logId = openSyncLog({ domain: p.domain, action: "incremental", startedAt: new Date() });
    try {
      const res = await p.runIncremental();
      closeSyncLog({ id: logId, status: "ok", ...res });
      log.info({ evt: obsEvents.mirrorOk, domain: p.domain, rows: res.rowsUpserted, maxTs: res.sourceMaxTs });
    } catch (err) {
      const e = err as Error;
      closeSyncLog({
        id: logId,
        status: "fail",
        errorCode: (e as { code?: string }).code ?? "ERR",
        errorMessage: e.message?.slice(0, 500),
      });
      log.error({ evt: obsEvents.mirrorFail, domain: p.domain, err: e.message }, "mirror pull failed");
      // ⚠️ 한 도메인 실패가 다른 도메인을 막으면 안 되므로 throw 하지 않음.
    }
  }
}
```

---

#### ⑦ `staleness.ts` — 🕵️ 식품 안전 검사관

**비유**: 냉장고 점검하러 온 **식품 안전 검사관**. 선반마다 돌면서 "이건 3시간 지남, 정상. 저건 26시간 지남, 경고. 이 우유는 72시간 지남, 폐기 수준"이라 판정함. 판정 기준은 ② config.ts(유통기한 표)에서 읽어옴.

**이게 뭐냐**: "특정 도메인이 지금 어떤 상태인가?"를 계산해서 돌려주는 **순수 함수**. 결과는 대충 이런 모양:

```
{
  domain: "playauto",
  level: "stale",                  ← ok / warn / stale / down / unknown
  sourceMaxTs: "2026-03-13 15:18", ← 원본 DB에서 본 가장 최신 데이터 시각
  ageMs: 2_764_800_000,            ← 그게 지금으로부터 얼마나 됐나 (밀리초)
  ...
}
```

**어떻게 판정하나** — 4단계:
1. `syncLog.ts`로 "이 도메인의 **가장 최근 배송 기록**" 한 장을 가져옴.
2. 그 기록에 적힌 `source_max_ts` (원본에서 본 가장 최신 데이터 시각)를 본다.
3. 현재 시각에서 그걸 빼서 **나이(age)**를 계산.
4. config의 `stalenessWarnMs`보다 크면 `stale`, `stalenessDownMs`보다 크면 `down`.

**가장 중요한 포인트 — 왜 "원본 데이터 시각"이 기준이고, "sync 실행 시각"이 아닌가?**

이게 이 전체 설계의 핵심이오. 예를 들어 이런 상황을 상상해보시오:

> mirror cron은 매시간 **성공적으로** 돌고 있소. 1시에 출발, 2시에 출발, 3시에 출발... 전부 "OK"로 기록됨. 그런데 **원본 DB 자체가 한 달째 새 데이터를 안 받고 있다면?** mirror는 매시간 "새 상자 0개 가져왔어요"를 반환하고 행복하게 돌아감. "sync 성공률 100%"로 보이지만 **실제로는 데이터가 한 달째 썩고 있는 상태**.

이걸 잡으려면 "내가 배송을 성공했는가?"가 아니라 **"가장 최근에 본 원본 데이터가 얼마나 신선한가?"**를 기준으로 삼아야 함. 그래서 `source_max_ts`라는, 원본의 최신 데이터 시각을 puller가 배송 기록지에 반드시 적도록 설계한 것이오.

**비유로 말하면**: 배달 트럭이 매 시간 왕복했다는 사실만으로는 부족하오. "트럭이 가져온 상자의 생산 날짜"까지 봐야 함. 트럭은 부지런한데 **창고에 이번 주 상자가 없어서 매번 지난주 상자만 실어온 상황**을 감지해야 하는 것이오. 이게 현재 `tb_playauto_orders`에서 실제로 벌어지고 있는 일이오.

**없으면**: "sync 성공/실패"만 보고 판단 → 원본이 멈춘 걸 못 잡아냄 → **지금 운영 DB가 겪는 실수를 우리 쪽에서도 그대로 반복**하게 됨.

**코드**:

```ts
// backend/src/operationalMirror/staleness.ts
import { MIRROR_CONFIG, type MirrorDomain } from "./config";
import { getLatestSyncLog } from "./syncLog";

export type StalenessLevel = "ok" | "warn" | "stale" | "down" | "unknown";

export interface DomainStatus {
  domain: MirrorDomain;
  level: StalenessLevel;
  sourceMaxTs: string | null;      // 원본 DB의 최신 데이터 시각
  lastSyncAt: string | null;       // mirror가 마지막으로 성공한 시각
  lastSyncStatus: string | null;   // 'ok' | 'fail' ...
  ageMs: number | null;            // now - sourceMaxTs
  thresholdWarnMs: number;
  thresholdDownMs: number;
}

export function computeDomainStatus(domain: MirrorDomain, now = new Date()): DomainStatus {
  const cfg = MIRROR_CONFIG[domain];
  const last = getLatestSyncLog(domain);
  if (!last) {
    return {
      domain, level: "unknown",
      sourceMaxTs: null, lastSyncAt: null, lastSyncStatus: null, ageMs: null,
      thresholdWarnMs: cfg.stalenessWarnMs, thresholdDownMs: cfg.stalenessDownMs,
    };
  }
  const maxTs = (last.source_max_ts as string | null) ?? null;
  const ageMs = maxTs ? now.getTime() - new Date(maxTs).getTime() : null;

  let level: StalenessLevel = "ok";
  if (last.status === "fail") level = "warn";
  if (ageMs !== null && ageMs > cfg.stalenessWarnMs) level = "stale";
  if (ageMs !== null && ageMs > cfg.stalenessDownMs) level = "down";

  return {
    domain, level,
    sourceMaxTs: maxTs,
    lastSyncAt: (last.finished_at as string) ?? null,
    lastSyncStatus: (last.status as string) ?? null,
    ageMs,
    thresholdWarnMs: cfg.stalenessWarnMs,
    thresholdDownMs: cfg.stalenessDownMs,
  };
}

export function computeAllStatuses(now = new Date()): DomainStatus[] {
  return (Object.keys(MIRROR_CONFIG) as MirrorDomain[]).map((d) => computeDomainStatus(d, now));
}
```

---

#### ⑧ `routes/operationalMirror.ts` — 🛎️ 1층 안내 데스크

**비유**: 건물 1층 로비의 **안내 데스크**. 누가 "이 건물 냉장고 상태 어때요?"라고 물으면, "playauto는 2시간 됐고, naver는 30분 됐고, 전부 정상입니다" 라고 친절하게 알려주오.

**이게 뭐냐**: Express 라우터 한 개. 엔드포인트 2개만 노출:
- `GET /api/operational-mirror/status` — 5개 도메인의 **현재 상태**를 JSON으로 반환. 프런트엔드가 이걸 60초마다 폴링할 것.
- `POST /api/operational-mirror/sync` — "지금 당장 배송 한 번 돌려!"라는 **수동 트리거** (디버깅·관리자용).

**왜 HTTP로 노출하나**: 프런트엔드(브라우저)는 sqlite 파일에 직접 접근할 방법이 없소. 무조건 HTTP를 통해서만 백엔드 데이터를 받을 수 있음. 그래서 상태 JSON을 작게 빼주는 것이오.

**왜 데이터 자체는 노출 안 하나?** (즉 `GET /mirror/playauto` 같은 건 왜 없나)
- 필요성이 없음. 이미 `routes/ads.ts` 등 기존 라우트가 운영 DB를 직접 쿼리해서 데이터를 서빙하고 있음.
- mirror의 역할은 **"상태 감시"**이지 "새로운 데이터 서빙"이 아님.
- 필요해지면 그때 추가해도 늦지 않음 (**YAGNI 원칙**: You Aren't Gonna Need It).

**없으면**: 프런트엔드가 상태를 모르는 채로 숫자만 표시 → 사용자가 한 달 묵은 숫자를 **오늘 숫자인 줄 알고** 의사결정함.

**코드**:

```ts
// backend/src/routes/operationalMirror.ts
import { Router } from "express";
import { computeAllStatuses } from "../operationalMirror/staleness";
import { runOperationalMirrorSync } from "../operationalMirror/runSync";

export const operationalMirrorRouter = Router();

operationalMirrorRouter.get("/status", (_req, res) => {
  res.json({ ok: true, domains: computeAllStatuses() });
});

// 수동 트리거 (관리자/디버깅용). 내부 IP 또는 토큰으로 보호할 것.
operationalMirrorRouter.post("/sync", async (_req, res) => {
  await runOperationalMirrorSync();
  res.json({ ok: true, domains: computeAllStatuses() });
});
```

그리고 `bootstrap/registerRoutes.ts`에 한 줄:

```ts
app.use("/api/operational-mirror", operationalMirrorRouter);
```

---

#### ⑨ `startBackgroundJobs.ts` 수정 — ⏰ 알람 시계

**비유**: 반장을 **매 시간 깨우는 알람 시계**. "1시, 2시, 3시마다 일어나서 배송 한 바퀴 돌려라." 알람 시계 하나 추가할 뿐이오. **새 파일을 만들지 않음**.

**이게 뭐냐**: 기존 `startBackgroundJobs.ts` 파일 맨 아래에 `setInterval(runOperationalMirrorSync, 60*60*1000)` 한 덩어리 추가. 서버가 켜질 때 한 번 즉시 실행도 같이.

**왜 기존 파일에 넣나** (새 파일 만들면 안 되나?):
- seo 백엔드에는 이미 Meta CAPI 동기화, 예약 발송, 그룹 정리 등 여러 cron이 이 파일 한 곳에 모여 있소.
- 여기가 **"배경에서 돌아가는 모든 잡"의 단일 등록 지점**이오. 새 파일을 만들면 "이 잡이 왜 안 돌지?" 추적이 어려워짐.
- **한 곳만 보면 전체를 알 수 있는 상태**를 깨지 않는 게 원칙.

**중요한 보너스 — 환경변수 스위치 공짜로 붙음**:
이 파일 맨 위에 이미 `if (!env.BACKGROUND_JOBS_ENABLED) return;` 가드가 있소. 그 아래에 mirror 잡을 넣기만 하면, 개발자가 로컬에서 mirror 끄고 싶을 때 **환경변수 하나(`BACKGROUND_JOBS_ENABLED=0`)**로 자동으로 꺼짐. **새 스위치를 만들 필요가 없음**. 무료로 얻는 이점이오.

**왜 `setInterval`이 아니라 진짜 cron 라이브러리(node-cron 등)를 안 쓰나**:
- 기존 잡들도 `setInterval`로 돌고 있어서 일관성 유지.
- "매 시간 정각"이 아니라 "서버 기동 후 1시간마다"도 우리 목적에는 충분함 (분 단위 정밀도 필요 없음).
- 라이브러리 하나 덜 의존하면 배포 단순.

**코드** (추가만 함, 기존 로직은 그대로):

```ts
// 기존 startBackgroundJobs.ts 맨 아래에 추가
import { runOperationalMirrorSync } from "../operationalMirror/runSync";

// ... 기존 코드 ...

export const startBackgroundJobs = () => {
  // ... 기존 잡들 ...

  // 운영 DB mirror: 1시간마다
  const MIRROR_INTERVAL_MS = 60 * 60 * 1000;
  const mirrorTimer = setInterval(() => {
    runOperationalMirrorSync().catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[mirror] sync crashed:", err);
    });
  }, MIRROR_INTERVAL_MS);
  mirrorTimer.unref?.();

  // 프로세스 기동 시 한 번 즉시 실행
  runOperationalMirrorSync().catch(() => { /* 첫 실행 실패는 cron이 복구 */ });
};
```

---

#### ⑩ `DataStalenessBadge.tsx` — 🚨 냉장고 문에 붙은 빨간 경고 스티커

**비유**: 냉장고 문에 붙은 **큼지막한 빨간 경고 스티커**: "이 우유는 48시간 지났습니다!". 사용자가 우유 꺼내려고 문 여는 순간 **무조건 눈에 들어와야** 하오. 떼어내지 못하게 꽉 붙어 있어야 함.

**이게 뭐냐**: React 컴포넌트 하나. 60초마다 `/api/operational-mirror/status`를 호출해서, **`stale`이나 `down` 상태의 도메인이 하나라도 있으면** ads 대시보드 **맨 위에 노란/빨간 배너**를 띄움.

**왜 "맨 위"인가, 왜 크게 띄우는가**:
사용자가 대시보드의 ROAS 숫자를 **믿어버리면 안 되는 순간**이 있소. 지금 `tb_playauto_orders`가 한 달 밀려있는 상황을 예로 들면:
- 사용자가 대시보드를 봄
- "3월 중순 이후로 매출이 왜 이렇게 낮지? 광고 효율 떨어졌나?"
- 광고 예산을 삭감하는 잘못된 의사결정

실제로는 **데이터가 3월 13일에 멈춰있어서** 그 이후 숫자가 전부 비어있는 것인데, 사용자는 광고 문제라고 오인함. 이걸 막는 가장 확실한 방법은 **숫자 바로 위에 "이 데이터는 32일 전 기준입니다" 라는 경고를 눈에 띄게 붙이는 것**이오. 숫자를 가리거나 지우는 게 아니라, **"이 숫자를 믿기 전에 이걸 먼저 보세요"**라고 말해주는 거요.

**왜 60초 폴링인가? 실시간 웹소켓은 왜 안 쓰나**:
- staleness는 **시간 단위**로 변화하는 지표요 (분 단위가 아님). 60초에 한 번 확인이면 차고 넘침.
- 웹소켓 쓰면 복잡도만 올라감. 연결 끊김 처리, 재접속 로직, 메시지 순서 보장 등 신경쓸 게 많아짐.
- **"과하게 복잡하게 만들지 말 것"**이 원칙이오.

**왜 `level === 'ok'`일 때는 아무것도 안 보이나**:
- 정상일 때는 배지가 **존재감 0**이어야 함.
- 배너가 항상 떠있으면 사용자가 학습해서 **무시하게 됨**. 이걸 **"알람 피로(alarm fatigue)"**라고 하오. 병원에서 의사들이 수많은 알람 소리에 둔감해져서 진짜 중요한 알람을 못 듣게 되는 현상과 같소.
- 문제 있을 때만 나타나야 **진짜로 주의를 끌 수 있음**. "닥쳐야 할 때만 닥친다"가 UX 원칙.

**없으면**: 사용자는 숫자를 액면 그대로 믿음 → 잘못된 의사결정 → 운영 DB 장애의 피해가 seo 프로젝트 사용자에게 그대로 전가됨.

**코드** (개념 수준):

```tsx
// frontend/src/app/ads/components/DataStalenessBadge.tsx
'use client';
import { useEffect, useState } from 'react';

interface DomainStatus {
  domain: string;
  level: 'ok' | 'warn' | 'stale' | 'down' | 'unknown';
  sourceMaxTs: string | null;
  ageMs: number | null;
}

export function DataStalenessBadge() {
  const [domains, setDomains] = useState<DomainStatus[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const r = await fetch('/api/operational-mirror/status');
      const j = await r.json();
      if (!cancelled) setDomains(j.domains ?? []);
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const problems = domains.filter((d) => d.level === 'stale' || d.level === 'down');
  if (problems.length === 0) return null;

  return (
    <div style={{ background: '#fff3cd', border: '1px solid #ffeeba', padding: 12, marginBottom: 16 }}>
      <strong>데이터 최신화 경고:</strong>{' '}
      {problems.map((p) => {
        const hours = p.ageMs ? Math.floor(p.ageMs / 3600000) : '?';
        return (
          <span key={p.domain} style={{ marginRight: 12 }}>
            {p.domain}: {hours}시간 전 기준 ({p.level})
          </span>
        );
      })}
    </div>
  );
}
```

`frontend/src/app/ads/page.tsx` 상단에 `<DataStalenessBadge />`를 꽂는다.

---

#### 10개 모듈을 한 장면으로 엮으면

이 10개 모듈이 매 시간 어떻게 춤을 추는지 **한 장면의 이야기**로 그려보겠소:

> **🕐 오후 3시 정각**
>
> ⏰ 알람 시계(`startBackgroundJobs.ts`)가 울림.
>
> 🧢 반장(`runSync.ts`)이 기사 5명을 줄 세움.
>
> "박 기사(playauto), 나가거라."
>
> 박 기사가:
> 1. 📋 배송 기록지 한 줄 엶 (`openSyncLog({ domain: 'playauto', startedAt: 15:00:00 })`)
> 2. ❄️ 냉장고 열어서 "내가 가진 마지막 상자 번호가 뭐였더라?" 확인 → 100번
> 3. 🚚 트럭 타고 큰 창고로 감
> 4. 🏢 창고에서 "101번 이상, 최대 5000개" 요청 → 0개 받음 (창고가 신규 입고 없음)
> 5. 🏢 "그러면 현재 가장 최신 상자의 생산 날짜만 알려주세요" → "2026-03-13"
> 6. 🚚 빈 트럭으로 돌아옴
> 7. 📋 기록지 마감: "상자 0개, status=ok, source_max_ts=2026-03-13"
>
> 반장은 박 기사 결과 받고 다음 기사 호출: "이 기사(naver), 나가거라."
> 이 기사는 normal하게 150개 가져와서 냉장고에 넣고 돌아옴.
>
> ... 5명 모두 마치면 반장의 임무 끝. 알람 시계는 다시 1시간 뒤를 대기.
>
> **🕐 오후 3시 10분**
>
> 🖥️ 사용자가 /ads 페이지 열어서 대시보드를 봄.
>
> 🚨 경고 스티커(`DataStalenessBadge`)가 60초마다 안내 데스크를 호출:
>
> "여기요, 상태 어떻게 됐어요?"
>
> 🛎️ 안내 데스크(`GET /status`)가 🕵️ 검사관(`staleness.ts`)을 불러 5개 도메인을 순회 판정.
>
> - playauto: source_max_ts가 32일 전 → **stale** (config에서 26시간 초과 기준 적용)
> - naver: source_max_ts가 30분 전 → **ok**
> - ... 나머지 3개는 ok
>
> 안내 데스크가 이 결과를 JSON으로 돌려줌.
>
> 🚨 경고 스티커가 화면 맨 위에 노란 배너를 띄움:
>
> **"데이터 최신화 경고: playauto 768시간 전 기준(stale)"**
>
> 사용자: "아, playauto 데이터가 밀려 있구나. 이 숫자는 액면가대로 믿지 말고 개발팀에 확인해봐야겠다."
>
> **— 성공**. 잘못된 의사결정이 차단됨.

이 한 장면이 바로 **이 모든 모듈이 존재하는 이유**요. 10개 모듈이 각자 자기 할 일만 하면서 이 시나리오가 매 시간 조용히 돌아가도록 만드는 것이 목표.

### 6.6.4 자료 흐름 한 장 요약

```
[운영 PostgreSQL: 34.47.95.104]
         │
         │ queryPg()  (이미 존재하는 pg pool)
         ▼
[backend/operationalMirror/pullers/*.ts]
         │ 증분 SELECT (id > lastId LIMIT N)
         ▼
[backend/operationalMirror/runSync.ts]  ← cron 1시간마다
         │ upsert + 감사 로그
         ▼
[crm.sqlite3: mirror_* 테이블 + mirror_sync_log]
         │
         │ HTTP GET /api/operational-mirror/status
         ▼
[frontend/app/ads/.../DataStalenessBadge.tsx]
         │ stale/down이면 노란/빨간 배지 노출
         ▼
[사용자가 "이 숫자는 N시간 전 기준"임을 인지]
```

### 6.6.5 실패 모드와 안전장치

| 실패 상황 | 기대 동작 |
| --------- | --------- |
| 운영 DB 커넥션 타임아웃 | `runSync.ts`가 해당 puller의 `mirror_sync_log`에 `status='fail'`로 기록. 다른 puller는 계속 진행. 배지는 `warn`로 표시. |
| sqlite 락 경합 | `better-sqlite3`는 동기 API라 단일 프로세스에서 문제 없음. 다만 mirror sync와 CRM 예약 발송 cron이 **같은 파일**을 쓰므로 sync 잡은 트랜잭션으로만 감싼다(긴 락 금지). |
| 원본 스키마 변경 | puller에서 `undefined` 읽기 → runtime error → 해당 puller만 fail 기록. 배지가 바로 뜨므로 조기 탐지 가능. |
| mirror 파일 용량 폭증 | 각 테이블에 보관 기한(예: 90일) retention cron 추가 여지 남겨둠. 초기에는 하지 않고, sqlite 파일 크기 모니터만. |
| 배포 직후 테이블 없음 | `getCrmDb()`가 시작 시 `ensureMirrorTables()`를 호출하므로 최초 부팅 시 자동 생성. |
| `BACKGROUND_JOBS_ENABLED=0` | 기존 로직 그대로 mirror cron 포함 전부 꺼짐. 개발자 로컬 환경 편의. |

### 6.6.6 구현 순서 (권장)

1. **Day 1**: `schema.ts` + `config.ts` + `syncLog.ts` + `staleness.ts` + 라우트 스켈레톤. 이 시점에서 `/api/operational-mirror/status`가 전 도메인 `unknown`을 반환하면 성공.
2. **Day 2**: `playautoOrders.ts` puller 1개만 구현. `runSync.ts`를 이걸로만 실행. 실제로 sqlite에 행이 들어가고 `source_max_ts`가 감사 로그에 기록되면 성공.
3. **Day 3**: 나머지 4개 puller 복제 (naver, coupang, toss, iamweb). `runSync.ts`에 추가.
4. **Day 4**: `startBackgroundJobs.ts`에 1시간 cron 연결. 프런트 `DataStalenessBadge` 추가. /ads에 꽂고 눈으로 확인.
5. **Day 5**: typecheck/smoke 테스트, `운영db.md` §6.6.5 실패 모드 시나리오 1~2개 수동 검증.

총 5일 이내 짧은 마일스톤. 1인 작업 기준.

### 6.6.7 의도적으로 포함하지 않은 것

- **풀 마이그레이션 도구** (flyway/knex 등): 오버엔지니어링. sqlite `CREATE TABLE IF NOT EXISTS`로 충분.
- **mirror 테이블에 대한 API 노출** (`GET /mirror/playauto`): 필요성이 생기기 전엔 만들지 않음. 필요해지면 그때 추가.
- **풀 이벤트 브로드캐스트** (웹소켓 상태 푸시): 배지는 60초 폴링으로 충분. 실시간성 요구 없음.
- **다중 샤드/파티셔닝**: 5개 테이블, 수만~수십만 행. sqlite 단일 파일로 차고 넘침.
- **백필/대량 재적재 CLI**: 추후 개발팀 P0이 해결되면 필요 없어질 수도 있음. 이쪽이 필요해지는 시점에만 `action='backfill'` 분기를 살리면 됨.

---

## 7. 개발팀 전달용 요약 블록 (복붙용)

```
[운영 DB 상태 공유 — 2026-04-14]

P0 (이번 주 요청):
1. tb_playauto_orders가 2026-03-13부터 1개월째 sync 중단. playauto_sync cron 실제 실행 여부 확인/복구 요청.
2. sync 실패가 로거에만 찍히고 조용히 삼켜지는 구조 → 실패 알림 필요.
3. tb_iamweb_backfill_jobs에 2026-04-06부터 8일째 running 상태로 멈춘 백필 잡 있음. 정리 필요.

P1 (2주 내):
4. tb_iamweb_users에 synced_at 컬럼 추가 (현재 sync 감사 불가).
5. tb_operation_log domain이 'restock'만 있음 → sync 이벤트도 기록하도록 확장.
6. tb_teamketo_cafe24 / tb_teamketo_smartstore 9개월째 멈춤. 사용 여부 결정 필요.
7. vw_purchase_conversion_details가 0행 반환. 사용처 확인 후 수정 또는 제거.

P2 (1개월 내):
8. tb_sales_* 월 단위 수동 업로드가 2026-03-27 이후 없음. 2·3·4월분 미반영. 정산 업로드 스케줄 또는 자동화 필요.
9. channeltalk_users 3중화, test_tb_* 5개, vw_test_repurchase_* 5개 등 중복/테스트 테이블 정리.
10. 쿠팡/토스/iamWeb sync가 scheduler.py에 등록되어 있지 않음. 실제 실행 경로 문서화 요청.
11. tb_laplace(한글 컬럼, 2025-11 이후 정지) 사용처 확인 후 아카이브.

영향도: 현재 ROAS/코호트/매출 리포트 중 tb_playauto_orders에 의존하는 지표는 약 한 달 밀려 있는 상태.
```

---

## 8. 본 조사에서 확인하지 못한 것

- 정확히 어느 프로세스(컨테이너/VM)가 `playauto_sync` cron을 돌려야 했는지 실운영 환경은 확인 못 함. `revenue/backend/docker-compose.yml` 및 배포 스크립트 분석은 별도 작업.
- `pg_get_viewdef('vw_purchase_conversion_details')`가 공란을 돌려준 이유는 view owner 권한 이슈일 가능성. 운영 계정으로 재확인 필요.
- `tb_iamweb_users.site_code` 유무를 재확인했고 없음. 즉 iamWeb 브랜드별(biocom/clean coffee/AIBIO/PET) 구분이 현재 DB 컬럼상 불가능해 보임. `raw_data` jsonb 안에 들어있다면 그 경로로 파싱해야 함. (이건 seo 쪽에서도 고민해야 할 부분.)
- 이 문서는 read-only 조사 결과이오. DDL/데이터 수정은 전혀 하지 않았음.
